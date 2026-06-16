import { _decorator, Component, type Node, Vec3, view } from 'cc';
import { type ExplosionTarget, selectExplosionHits } from '../logic/ExplosionLogic';
import { GameManager } from '../systems/GameManager';
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

  /**
   * 발사체를 초기화한다. 풀에서 꺼낸 직후(또는 instantiate 직후) 반드시 호출해야 한다.
   * 재사용 노드의 상태(방향·속도·데미지·반경·반환 플래그)를 매번 새로 설정한다.
   * @param direction 이동 방향 (단위 벡터)
   * @param speed 이동 속도 (units/sec)
   * @param damage 적중 시 데미지
   * @param radius 충돌 반경
   * @param onDespawn 명중·화면밖 시 호출할 풀 반환 콜백 (자신의 node 전달)
   * @param explosion 명중 시 폭발 설정 — null이면 단일 명중(기존 동작)
   */
  init(
    direction: Vec3,
    speed: number,
    damage: number,
    radius: number,
    onDespawn: (node: Node) => void,
    explosion: ProjectileExplosion | null = null,
  ): void {
    this._direction = direction.clone();
    this._speed = speed;
    this._damage = damage;
    this._radius = radius;
    this._onDespawn = onDespawn;
    this._despawned = false;
    this._explosion = explosion;
  }

  // 화면 밖 제거 기준 거리를 계산한다 — 좌표계 원점이 화면 중앙이므로 절반 + 여유 100
  onLoad() {
    const size = view.getVisibleSize();
    this._outOfBoundsLimit = Math.max(size.width, size.height) / 2 + 100;
  }

  // 매 프레임 이동 → 적 명중 판정 → 화면 밖 이탈 판정 순으로 처리한다
  update(dt: number) {
    this._move(dt);
    this._checkEnemyHit();
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

  /** 적과 충돌 여부를 검사해 명중 시 (폭발이면 반경 AoE, 아니면 단일) 데미지를 주고 자신을 제거한다. */
  private _checkEnemyHit(): void {
    const pos = this.node.position;
    // 스냅샷: takeDamage → destroy → unregisterEnemy가 원본 배열을 변경해도 순회 누락 방지
    for (const enemy of [...GameManager.instance.enemies]) {
      if (!enemy?.isValid) continue;
      const dist = Vec3.distance(pos, enemy.node.position);
      if (dist < this._radius + enemy.collisionRadius) {
        // 폭발이면 직격 없이 명중 지점 반경 AoE만(§9.3) — 충돌한 적도 폭발 반경 안이라 1회 받음.
        if (this._explosion) this._detonate(pos);
        else enemy.takeDamage(this._damage);
        this._despawn();
        return;
      }
    }
  }

  /**
   * 명중 지점 반경에 폭발 피해를 준다 (직격 보너스 없음 — §9.3). 시전 단위 dedup으로
   * 같은 시전의 겹친 폭발이 한 적을 1회만 때린다. 후보 적 목록은 여기서 구성한다(그리드-레디 G1).
   * @param center 폭발 중심 (발사체 명중 위치)
   */
  private _detonate(center: Readonly<Vec3>): void {
    if (!this._explosion) return;
    const targets: ExplosionTarget[] = [];
    const ctrls: EnemyController[] = [];
    for (const enemy of GameManager.instance.enemies) {
      if (!enemy?.isValid) continue;
      const p = enemy.node.position;
      targets.push({ x: p.x, y: p.y, collisionRadius: enemy.collisionRadius, id: enemy.spawnId });
      ctrls.push(enemy);
    }
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

  /** 화면 경계를 벗어나면 풀로 반환한다. */
  private _checkOutOfBounds(): void {
    const pos = this.node.position;
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
