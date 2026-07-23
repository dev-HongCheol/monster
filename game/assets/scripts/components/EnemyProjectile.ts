import { _decorator, Component, type Node, Vec3, view } from 'cc';
import { GameState } from '../data/GameTypes';
import { isOutsideArena } from '../logic/ArenaLogic';
import { circleIntersectsBox } from '../logic/HitboxLogic';
import { DataManager } from '../systems/DataManager';
import { GameManager } from '../systems/GameManager';
import { MapManager } from '../systems/MapManager';

const { ccclass } = _decorator;

/**
 * 적이 발사하는 발사체. 대상은 **플레이어 한 명뿐**이라 적 목록을 절대 질의하지 않는다
 * (친선사격 0 불변식 — §D1). 명중 시 버스트 피해를 피격 게이트(`damagePlayer`)에 제출만 하고
 * 풀로 반환한다 — "한 틱 1회·가장 센 것" 묶음은 전역 i-frame 게이트가 처리하므로 발사체별 dedup이 없다.
 * 이동·화면 밖 판정·풀 반환은 플레이어 마법 `Projectile`을 미러한다.
 */
@ccclass('EnemyProjectile')
export class EnemyProjectile extends Component {
  /** 이동 방향 (단위 벡터) */
  private _direction: Vec3 = new Vec3(0, 1, 0);
  /** 이동 속도 (px/sec) */
  private _speed: number = 380;
  /** 명중 시 버스트 피해 */
  private _damage: number = 10;
  /** 충돌 반경 (px) */
  private _radius: number = 12;
  /** 충돌 판정 대상 플레이어 노드 */
  private _playerNode: Node | null = null;
  /** 플레이어 피해 히트박스 반너비·반높이 (px) — init에서 DataManager로부터 캐시(ADR 006). */
  private _playerHurtboxHalfW: number = 0;
  private _playerHurtboxHalfH: number = 0;
  /** 화면 밖 제거 기준 거리 */
  private _outOfBoundsLimit: number = 800;
  /** 풀 반환 콜백 (init에서 주입). null이면 destroy로 폴백. */
  private _onDespawn: ((node: Node) => void) | null = null;
  /** 이미 반환/소멸 처리됐는지 — 이중 반환 방어(멱등). */
  private _despawned: boolean = false;

  /**
   * 발사체를 초기화한다. 풀에서 꺼낸 직후 반드시 호출한다. 재사용 노드의 상태를 매번 새로 설정한다.
   * @param direction 이동 방향 (단위 벡터)
   * @param speed 이동 속도 (px/sec)
   * @param damage 명중 시 버스트 피해
   * @param radius 충돌 반경 (px)
   * @param playerNode 충돌 판정 대상 플레이어 노드
   * @param onDespawn 명중·화면밖 시 호출할 풀 반환 콜백 (자신의 node 전달)
   */
  init(
    direction: Vec3,
    speed: number,
    damage: number,
    radius: number,
    playerNode: Node,
    onDespawn: (node: Node) => void,
  ): void {
    this._direction = direction.clone();
    this._speed = speed;
    this._damage = damage;
    this._radius = radius;
    this._playerNode = playerNode;
    // 조기 return을 두지 않는다 — 여기서 빠져나가면 아래 _despawned = false가 실행되지 않아
    // 풀에서 되살아난 발사체가 영영 반환되지 않는(그리고 계속 피해를 주는) 노드가 된다.
    // 데이터가 없으면 플레이어 피해 박스가 0이 되어 명중 범위가 발사체 반지름만 남을 뿐이고,
    // 그 상황은 다른 곳에서 이미 시끄럽게 신고된다.
    const pd = DataManager.instance?.playerData;
    this._playerHurtboxHalfW = pd?.hurtboxHalfWidth ?? 0;
    this._playerHurtboxHalfH = pd?.hurtboxHalfHeight ?? 0;
    this._onDespawn = onDespawn;
    this._despawned = false;
  }

  // 화면 밖 제거 폴백 기준 거리 — 아레나 로드 전에만 쓴다(정적 카메라 가정, 화면 절반 + 여유 100).
  // 아레나 로드 후엔 _checkOutOfBounds가 아레나 경계로 컬링한다(카메라 팔로우라 원점 기준은 무효).
  onLoad() {
    const size = view.getVisibleSize();
    this._outOfBoundsLimit = Math.max(size.width, size.height) / 2 + 100;
  }

  // 매 프레임 이동 → 플레이어 명중 판정 → 화면 밖 이탈 판정 순으로 처리한다
  update(dt: number) {
    // 레벨업 일시정지(state !== Playing) 중엔 멈춘다 — 가드가 없으면 메뉴 중에도
    // 플레이어로 날아가 damagePlayer가 발생한다(I1, 공정성).
    const gm = GameManager.instance;
    if (!gm || gm.state !== GameState.Playing) return;
    this._move(dt);
    this._checkPlayerHit(gm);
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
   * 플레이어와 충돌하면 버스트 피해를 게이트에 제출하고 자신을 제거한다. 적은 절대 질의하지 않는다.
   * @param gm 피해 게이트 (호출부가 확인해 넘긴다)
   */
  private _checkPlayerHit(gm: GameManager): void {
    if (!this._playerNode?.isValid) return;
    const pos = this.node.position;
    const pp = this._playerNode.position;
    // 발사체(원) 대 플레이어(피해 박스) 겹침 — 이동 충돌과 별개 축이다(ADR 006).
    if (
      circleIntersectsBox(
        pos.x,
        pos.y,
        this._radius,
        pp.x,
        pp.y,
        this._playerHurtboxHalfW,
        this._playerHurtboxHalfH,
      )
    ) {
      gm.damagePlayer(this._damage);
      this._despawn();
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
