import { _decorator, Component, type Node, Vec3, view } from 'cc';
import { GameState } from '../data/GameTypes';
import { isOutsideArena } from '../logic/ArenaLogic';
import { selectExplosionHits } from '../logic/ExplosionLogic';
import { type ControlStrength, shouldApplyControl } from '../logic/StatusEffectLogic';
import { GameManager } from '../systems/GameManager';
import { MapManager } from '../systems/MapManager';
import type { EnemyController } from './EnemyController';

const { ccclass } = _decorator;

/** 발사체 명중 시 폭발 동작 설정 (단일 명중이면 null). */
export interface ProjectileExplosion {
  /** 유효 폭발 반경 (강화 배율 적용 후) */
  radius: number;
  /** 시전 단위 dedup 공유 집합 — 같은 시전(volley)의 발사체들이 같은 참조를 공유(§10.2) */
  hitSet: Set<number>;
  /** 명중 지점에 폭발 VFX를 띄우는 콜백 (없으면 생략) */
  onVfx?: (x: number, y: number, radius: number) => void;
}

/** 발사체 명중 시 거는 상태이상(CC) 설정 (단일 명중 마법의 확률 정지 등 — §9.4). */
export interface ProjectileStatus {
  /** 적용할 컨트롤 강도 (정지/슬로우/빙결) */
  strength: ControlStrength;
  /** 발동 확률 (0~1) */
  chance: number;
  /** 유효 지속시간 (sec) — 지속(Duration) 강화 반영 후 값 */
  durationSec: number;
}

/** 플레이어가 발사하는 마법 발사체 */
@ccclass('Projectile')
export class Projectile extends Component {
  /** 이동 방향 (단위 벡터) */
  private _direction: Vec3 = new Vec3(0, 1, 0);
  private _speed: number = 500;
  private _damage: number = 25;
  private _radius: number = 8;
  private _outOfBoundsLimit: number = 800;
  /** 풀 반환 콜백 (init에서 주입). null이면 destroy로 폴백. */
  private _onDespawn: ((node: Node) => void) | null = null;
  /** 이미 반환/소멸 처리됐는지 — 이중 반환 방어(멱등). */
  private _despawned: boolean = false;
  /** 명중 시 폭발 동작 (단일 명중이면 null). */
  private _explosion: ProjectileExplosion | null = null;
  /** 명중 시 거는 상태이상 (없으면 null). 단일 명중 경로에서 확률로 적용한다. */
  private _status: ProjectileStatus | null = null;

  /**
   * 발사체를 초기화한다. 풀에서 꺼낸 직후(또는 instantiate 직후) 반드시 호출해야 한다.
   * 재사용 노드의 상태(방향·속도·데미지·반경·반환 플래그)를 매번 새로 설정한다.
   * @param direction 이동 방향 (단위 벡터)
   * @param speed 이동 속도 (units/sec)
   * @param damage 적중 시 데미지
   * @param radius 충돌 반경
   * @param onDespawn 명중·화면밖 시 호출할 풀 반환 콜백 (자신의 node 전달)
   * @param explosion 명중 시 폭발 설정 — null이면 단일 명중(기존 동작)
   * @param status 명중 시 거는 상태이상(CC) 설정 — null이면 없음(단일 명중 경로에서만 적용)
   */
  init(
    direction: Vec3,
    speed: number,
    damage: number,
    radius: number,
    onDespawn: (node: Node) => void,
    explosion: ProjectileExplosion | null = null,
    status: ProjectileStatus | null = null,
  ): void {
    this._direction = direction.clone();
    this._speed = speed;
    this._damage = damage;
    this._radius = radius;
    this._onDespawn = onDespawn;
    this._despawned = false;
    this._explosion = explosion;
    this._status = status;
  }

  // 화면 밖 제거 폴백 기준 거리 — 아레나 로드 전에만 쓴다(정적 카메라 가정, 화면 절반 + 여유 100).
  // 아레나 로드 후엔 _checkOutOfBounds가 아레나 경계로 컬링한다(카메라 팔로우라 원점 기준은 무효).
  onLoad() {
    const size = view.getVisibleSize();
    this._outOfBoundsLimit = Math.max(size.width, size.height) / 2 + 100;
  }

  // 매 프레임 이동 → 적 명중 판정 → 화면 밖 이탈 판정 순으로 처리한다
  update(dt: number) {
    // 레벨업 일시정지(state !== Playing) 중엔 멈춘다 — 발사체는 발사 후 독립 이동해,
    // 가드가 없으면 메뉴 중에도 이동·명중·폭발이 계속된다(I1).
    const gm = GameManager.instance;
    if (!gm || gm.state !== GameState.Playing) return;
    this._move(dt);
    this._checkEnemyHit(gm);
    this._checkOutOfBounds();
  }

  /** 이동 방향으로 발사체를 이동시킨다. */
  private _move(dt: number): void {
    const pos = this.node.position;
    this.node.setPosition(
      pos.x + this._direction.x * this._speed * dt,
      pos.y + this._direction.y * this._speed * dt,
      pos.z,
    );
  }

  /**
   * 적과 충돌 여부를 검사해 명중 시 (폭발이면 반경 AoE, 아니면 단일) 데미지를 주고 자신을 제거한다.
   * @param gm 적 후보 질의 출처 (호출부가 확인해 넘긴다)
   */
  private _checkEnemyHit(gm: GameManager): void {
    const pos = this.node.position;
    // 그리드가 돌려준 후보 배열은 질의마다 새로 생성되므로, takeDamage → unregisterEnemy가
    // 원본 적 목록을 변경해도 순회 누락이 없다(기존 [...enemies] 스냅샷 역할을 대체).
    for (const enemy of gm.queryEnemiesInRadius(pos.x, pos.y, this._radius)) {
      if (!enemy?.isValid) continue;
      const ep = enemy.node.position;
      // 2D 평면 가정(모두 z=0) — z 성분은 보지 않는다. 종전 Vec3.distance(3D) 대비 평면상 동일.
      const dx = pos.x - ep.x;
      const dy = pos.y - ep.y;
      // 제곱거리 비교 — sqrt 없이 (반경 합)² 와 비교(핫패스 sqrt 제거).
      const reach = this._radius + enemy.collisionRadius;
      if (dx * dx + dy * dy < reach * reach) {
        // 폭발이면 직격 없이 명중 지점 반경 AoE만(§9.3) — 충돌한 적도 폭발 반경 안이라 1회 받음.
        if (this._explosion) {
          this._detonate(pos, gm);
        } else {
          // 단일 명중: 데미지 + (설정돼 있으면) 확률 상태이상(정지 등 §9.4).
          enemy.takeDamage(this._damage);
          this._applyStatus(enemy);
        }
        this._despawn();
        return;
      }
    }
  }

  /**
   * 명중 지점 반경에 폭발 피해를 준다 (직격 보너스 없음 — §9.3). 시전 단위 dedup으로
   * 같은 시전의 겹친 폭발이 한 적을 1회만 때린다. 후보 적은 폭발 반경으로 그리드를 질의해
   * 추리고(G1), selectExplosionHits가 그 후보에 정밀 판정·dedup을 적용한다.
   * @param center 폭발 중심 (발사체 명중 위치)
   * @param gm 적 후보 질의 출처 (호출부가 확인해 넘긴다)
   */
  private _detonate(center: Readonly<Vec3>, gm: GameManager): void {
    if (!this._explosion) return;
    // 후보 수집은 F16 공유 헬퍼로(노바·궤도와 동일 블록). 정밀 판정·dedup은 selectExplosionHits.
    const { targets, ctrls } = gm.collectTargetsInRadius(
      center.x,
      center.y,
      this._explosion.radius,
    );
    const hits = selectExplosionHits(
      center.x,
      center.y,
      this._explosion.radius,
      targets,
      this._explosion.hitSet,
    );
    for (const idx of hits) ctrls[idx].takeDamage(this._damage);
    this._explosion.onVfx?.(center.x, center.y, this._explosion.radius);
  }

  /**
   * 단일 명중한 적에게 확률로 상태이상(정지 등)을 건다 (§9.4). 난수는 여기서 굴리고 발동 판정은
   * 순수 함수(`shouldApplyControl`)에 위임해, 발동 규칙을 결정적으로 테스트할 수 있게 한다.
   * @param enemy 방금 명중한 적
   */
  private _applyStatus(enemy: EnemyController): void {
    const s = this._status;
    if (!s) return;
    if (shouldApplyControl(Math.random(), s.chance)) {
      enemy.applyControl(s.strength, s.durationSec);
    }
  }

  /** 아레나(원점 중심) 경계 + 여유를 벗어나면 풀로 반환한다. 아레나 미로드 시 화면 기준 폴백. */
  private _checkOutOfBounds(): void {
    const pos = this.node.position;
    const arena = MapManager.instance?.arena;
    if (arena && arena.width > 0) {
      if (isOutsideArena({ x: pos.x, y: pos.y }, arena, 100)) this._despawn();
      return;
    }
    if (Math.abs(pos.x) > this._outOfBoundsLimit || Math.abs(pos.y) > this._outOfBoundsLimit) {
      this._despawn();
    }
  }

  /** 발사체를 풀로 반환한다(콜백 없으면 destroy 폴백). 이중 호출은 무시(멱등). */
  private _despawn(): void {
    if (this._despawned) return;
    this._despawned = true;
    if (this._onDespawn) this._onDespawn(this.node);
    else this.node.destroy();
  }
}
