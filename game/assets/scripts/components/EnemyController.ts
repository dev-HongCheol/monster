import { _decorator, Color, Component, Graphics, Node, Prefab, Sprite, Vec3 } from 'cc';
import { GameState, type IEnemyAttackData, type IEnemyData } from '../data/GameTypes';
import {
  type AttackParams,
  AttackState,
  coneHitsTarget,
  meleeConeMarkerArc,
  tickAttack,
} from '../logic/EnemyAttackLogic';
import { deathAlpha, deathScale, hitFlashBlend, isDeathDone } from '../logic/EnemyVisualLogic';
import { fanDirections, radialDirections } from '../logic/FireGeometry';
import { circleIntersectsBox } from '../logic/HitboxLogic';
import {
  kiteDirection,
  type LungeParams,
  LungeState,
  lungeMovement,
  lungeReach,
  tickLunge,
  type Vec2,
  vectorToAngle,
  windupBlend,
  zigzagDirection,
} from '../logic/MovementLogic';
import { NO_OBSTACLES, resolveCircleMove, steerAroundObstacles } from '../logic/ObstacleLogic';
import {
  appliedStrength,
  ControlStrength,
  type ControlTimers,
  dealsContactDamage,
  emptyControl,
  hasActiveControl,
  applyControl as mergeControl,
  moveSpeedFactor,
  tickControl,
} from '../logic/StatusEffectLogic';
import { DataManager } from '../systems/DataManager';
import { ExperienceManager } from '../systems/ExperienceManager';
import { GameManager } from '../systems/GameManager';
import { MapManager } from '../systems/MapManager';

const { ccclass, property } = _decorator;

/** 제어(CC) 중 baseTint를 적용 강도의 CC 색 쪽으로 섞는 비율 (placeholder, §14). */
const CC_TINT_BLEND = 0.6;
/** 피격 플래시가 섞는 흰색 (틴트 블렌드 대상). */
const FLASH_COLOR = new Color(255, 255, 255, 255);
/** 돌진 윈드업 텔레그래프 색 (placeholder, §6) — 곧 들이받음을 알리는 빨강. */
const TELEGRAPH_COLOR = new Color(255, 64, 64, 255);
/** 돌진 바닥 마커(LungeMarker)의 기준 폭(px) — 런타임 X 스케일 = lungeReach / (이 값 × 부모 스케일). */
const MARKER_BASE_WIDTH = 100;
/** 근접 휘두르기 부채꼴 마커 색 (placeholder, §6·§14) — 반투명 빨강 범위 오버레이. 최종 이펙트는 아트 단계. */
const MELEE_MARKER_COLOR = new Color(255, 64, 64, 110);
/** 유격(kite) 데드존 절반 폭(px, placeholder §14) — 선호 사거리 ±이 폭 안에선 정지(떨림 억제). */
const KITE_DEADZONE_BAND = 40;

/**
 * 적 발사체 발사 위임 콜백 — 풀 소유자(EnemySpawner)가 제공하고, 컨트롤러가 Fire 에지에서 호출한다.
 * 컨트롤러는 풀을 직접 소유하지 않고 발사만 위임한다(영속 단일 소유자 — 풀 소유권 §D5).
 */
export type FireProjectileFn = (
  origin: Readonly<Vec3>,
  dirX: number,
  dirY: number,
  speed: number,
  damage: number,
  radius: number,
) => void;

/** 풀 재사용마다 증가하는 전역 카운터 — 적 개체 식별자(spawnId)의 출처. */
let _spawnIdCounter = 0;
/** 다음 적 개체 식별자를 발급한다. 살아 있는 적끼리 항상 유일(§10.2 dedup 안정 id). */
function nextSpawnId(): number {
  return ++_spawnIdCounter;
}

/** 플레이어를 추적하고 접촉 시 데미지를 주는 적 AI */
@ccclass('EnemyController')
export class EnemyController extends Component {
  /** 추적 대상 플레이어 노드 (인스펙터에서 연결) */
  @property(Node) playerNode: Node | null = null;
  /** enemies.json 의 id 값 (인스펙터에서 설정) */
  @property enemyId: string = 'cheonyeo';
  /** 사망 시 스폰할 XP 아이템 프리팹 (인스펙터에서 연결) */
  @property(Prefab) xpItemPrefab: Prefab | null = null;
  /** 피격 플래시(흰색 점멸) 지속시간 (sec) */
  @property flashDuration: number = 0.12;
  /** 사망 팝/페이드 연출 지속시간 (sec) */
  @property deathDuration: number = 0.25;
  /** 사망 팝의 최대 스케일 배율 (기준 크기 대비) */
  @property deathPopScale: number = 1.3;
  /** 돌진 바닥 경로 마커 노드 (돌진 적만 사용, 인스펙터에서 연결 — 미연결 시 마커 없이 동작) */
  @property(Node) lungeMarker: Node | null = null;
  /** 근접 휘두르기 부채꼴 범위 마커 노드 (휘두르기 적만 사용, 인스펙터에서 연결 — 미연결 시 마커 없이 동작) */
  @property(Node) meleeConeMarker: Node | null = null;

  collisionRadius: number = 25;
  /** 풀 재사용마다 증가하는 개체 식별자 — 폭발 등 시전 단위 dedup의 안정 id(§10.2). reset마다 새 값. */
  spawnId: number = 0;

  private _data: IEnemyData | null = null;
  private _hp: number = 0;
  /** 플레이어 피해 히트박스 반너비 (px) — init에서 DataManager로부터 캐시. 이동 충돌(collisionRadius, 원)과 별개 축(ADR 006). */
  private _playerHurtboxHalfW: number = 0;
  /** 플레이어 피해 히트박스 반높이 (px) */
  private _playerHurtboxHalfH: number = 0;
  /** Sprite 참조 (색·페이드 적용 대상). onLoad에서 캐시 */
  private _sprite: Sprite | null = null;
  /** 데이터에서 읽은 기준 색(tint) — 플래시/페이드의 기준값 */
  private readonly _baseTint: Color = new Color(255, 255, 255, 255);
  /** 데이터에서 읽은 기준 스케일(threatScale) */
  private _baseScale: number = 1;
  /** 매 프레임 색을 재계산해 담는 스크래치(할당 회피) */
  private readonly _scratchColor: Color = new Color();
  /** 피격 플래시 진행 중 여부 */
  private _flashing: boolean = false;
  /** 피격 후 경과시간 (sec) */
  private _flashElapsed: number = 0;
  /** 사망 연출 진행 중 여부 (이동·접촉·중복 피격 차단) */
  private _dead: boolean = false;
  /** 사망 후 경과시간 (sec) */
  private _deathElapsed: number = 0;
  /** 사망 연출 종료 시 호출할 풀 반환 콜백 (reset에서 주입). null이면 destroy로 폴백. */
  private _onDespawn: ((node: Node) => void) | null = null;
  /** 이미 풀로 반환/소멸 처리됐는지 — 이중 반환 방어(멱등). */
  private _despawned: boolean = false;
  /** 컨트롤(CC) 강도별 타이머 — 정지/슬로우/빙결이 각자 독립으로 감소(§9.4). 매 reset에서 비운다. */
  private _control: ControlTimers = emptyControl();
  /** CC 틴트가 현재 적용돼 있는지 — 제어가 풀릴 때 baseTint로 1회 복원하기 위한 플래그. */
  private _ccTinted: boolean = false;
  /** 정지 틴트 (placeholder, §14) — 번개 정체성의 옅은 노랑. magic-S2 룩 유지(값 불변). */
  private readonly _stunTint: Color = new Color(255, 240, 150, 255);
  /** 슬로우 틴트 (placeholder, §14) — 얼음 정체성의 하늘색. */
  private readonly _slowTint: Color = new Color(130, 200, 255, 255);
  /** 빙결 틴트 (placeholder, §14) — 짙은 얼음 톤. 후속 magic-S6에서 실사용. */
  private readonly _freezeTint: Color = new Color(120, 160, 230, 255);
  /** 돌진(lunge) 상태기계의 현재 상태. reset마다 Chase로. */
  private _lungeState: LungeState = LungeState.Chase;
  /** 현재 돌진 상태의 잔여 타이머 (sec). */
  private _lungeTimer: number = 0;
  /** 윈드업 진입 시 잠근 돌진 방향(단위 벡터). 돌진은 이 방향으로만 간다. */
  private readonly _lockDir: Vec2 = { x: 0, y: 0 };
  /** 지그재그 위상 누적 시간 (sec). reset마다 0. */
  private _zigzagElapsed: number = 0;
  /** 이번 프레임 윈드업 텔레그래프 활성 여부 (틴트 우선순위 산출용). */
  private _windupActive: boolean = false;
  /** 이번 프레임 윈드업 점멸 강도 (0→1 램프). */
  private _windupBlendVal: number = 0;
  /** 텔레그래프 틴트가 현재 적용돼 있는지 — 윈드업이 끝날 때 baseTint/CC로 1회 복원하기 위한 래치. */
  private _telegraphTinted: boolean = false;
  /** 공격(발사체) FSM 상태. reset마다 Aim으로. */
  private _attackState: AttackState = AttackState.Aim;
  /** 현재 공격 상태의 잔여 타이머 (sec). */
  private _attackTimer: number = 0;
  /** 텔레그래프 진입 시 잠근 발사 방향(단위 벡터). 발사는 이 방향으로만 나간다. */
  private readonly _attackLockDir: Vec2 = { x: 0, y: 0 };
  /** 발사체 발사 위임 콜백 (reset에서 주입). null이면 발사 안 함(풀 미연결). */
  private _fireProjectileFn: FireProjectileFn | null = null;

  // Sprite 참조만 캐시한다(컴포넌트는 풀 재사용해도 유지되므로 1회면 충분).
  // 활성 등록은 onEnable, 데이터·시각·연출 상태 적용은 reset()이 담당한다(재사용마다 재적용 필요).
  onLoad() {
    this._sprite = this.getComponent(Sprite);
  }

  // 활성화(최초 + 풀 재사용)마다 활성 적 목록에 자신을 등록한다.
  onEnable() {
    GameManager.instance?.registerEnemy(this);
  }

  // 비활성화(풀 반환 active=false, 씬 해제 모두 포함)마다 목록에서 제거한다(멱등 — 이미 빠졌으면 no-op).
  onDisable() {
    GameManager.instance?.unregisterEnemy(this);
  }

  /**
   * 풀에서 꺼낸 적을 재사용 가능 상태로 초기화한다. 스포너가 acquire 직후 호출한다.
   * 데이터는 스폰 시점에 항상 로드 완료(EnemySpawner가 DataManager.isReady를 게이트)이므로
   * 동기로 즉시 적용하며, 재사용마다 다른 enemyId의 스탯·시각(색·크기)과 연출 상태를 새로 설정한다.
   * @param enemyId enemies.json id (종류별 스탯·색·크기 결정)
   * @param playerNode 추적 대상 플레이어 노드
   * @param onDespawn 사망 연출 종료 시 호출할 풀 반환 콜백 (자신의 node 전달)
   * @param fireProjectile 발사체 발사 위임 콜백 (풀 소유자가 제공 — 공격 보유 적만 사용)
   */
  reset(
    enemyId: string,
    playerNode: Node,
    onDespawn: (node: Node) => void,
    fireProjectile: FireProjectileFn,
  ): void {
    this.enemyId = enemyId;
    this.spawnId = nextSpawnId();
    this.playerNode = playerNode;
    this._onDespawn = onDespawn;
    this._despawned = false;
    this._dead = false;
    this._deathElapsed = 0;
    this._flashing = false;
    this._flashElapsed = 0;
    this._control = emptyControl();
    this._ccTinted = false;
    // 이동 상태(돌진 FSM·지그재그 위상·텔레그래프)를 비워 풀 재사용 시 이월을 막는다.
    this._lungeState = LungeState.Chase;
    this._lungeTimer = 0;
    this._lockDir.x = 0;
    this._lockDir.y = 0;
    this._zigzagElapsed = 0;
    this._windupActive = false;
    this._windupBlendVal = 0;
    this._telegraphTinted = false;
    this._attackState = AttackState.Aim;
    this._attackTimer = 0;
    this._attackLockDir.x = 0;
    this._attackLockDir.y = 0;
    this._fireProjectileFn = fireProjectile;
    if (this.lungeMarker) this.lungeMarker.active = false;
    if (this.meleeConeMarker) this.meleeConeMarker.active = false;
    // 데이터 조회는 위의 리셋 필드를 **전부 세운 뒤** 한다 — 여기서 값이 없어도 풀에서 되살아난
    // 노드에 이전 생의 상태(_despawned·_dead·이동 FSM)가 남지 않는다.
    const dm = DataManager.instance;
    this._data = dm ? dm.getEnemy(enemyId) : null;
    if (this._data) {
      this._hp = this._data.maxHp;
      this.collisionRadius = this._data.collisionRadius;
      this._applyVisualBaseline(this._data);
    }
    // _data가 없으면 update()가 첫 줄에서 빠지므로(적이 아무것도 하지 않는다) 이 값은 쓰이지 않는다.
    const pd = dm?.playerData;
    this._playerHurtboxHalfW = pd?.hurtboxHalfWidth ?? 0;
    this._playerHurtboxHalfH = pd?.hurtboxHalfHeight ?? 0;
  }

  // 데이터 준비 시 update 분기: 사망 연출 중이면 그것만, 아니면 플래시 갱신 + (Playing일 때) 추적·접촉
  update(dt: number) {
    if (!this._data) return;
    if (this._dead) {
      this._updateDeath(dt);
      return;
    }
    this._updateFlash(dt);
    const gm = GameManager.instance;
    if (!gm || gm.state !== GameState.Playing) return;
    // 제어 중일 때만 틱한다(빈 적은 건너뛰어 매 프레임 할당 회피). appliedStrength는 반드시
    // 틱 *이후* 한 번 산출해 이동·접촉·틴트에 넘긴다 — 틱 전에 읽으면 만료가 한 프레임 늦는다.
    if (hasActiveControl(this._control)) {
      this._control = tickControl(this._control, dt);
    }
    const applied = appliedStrength(this._control);
    this._move(dt, applied);
    this._tickEnemyAttack(dt, applied);
    this._checkContactDamage(applied);
    this._updateTint(applied);
  }

  /**
   * 피해를 입힌다. HP가 0 이하면 사망 연출을 시작하고, 아니면 피격 플래시를 트리거한다.
   * 사망 연출 중에는 중복 피격을 무시한다.
   *
   * `_despawned`(풀에 반환됨)도 함께 막는다 — 공간 그리드는 프레임당 1회만 갱신되는데
   * `EnemySpawner`가 프레임 도중 재활용하므로, 같은 프레임에 만들어진 그리드가 이미 풀에 들어간
   * 적을 발사체에 넘길 수 있다(`isValid`는 파괴 여부일 뿐 활성 여부가 아니라 걸러지지 않는다).
   * 이걸 막지 않으면 회수된 적이 피해를 받아 사망 경로를 타고, 유령 킬이 결과 화면 통계에 잡히며
   * 아무도 없는 곳에 경험치가 떨어진다.
   */
  takeDamage(amount: number): void {
    if (this._dead || this._despawned) return;
    this._hp -= amount;
    if (this._hp <= 0) {
      this._startDeath();
      return;
    }
    this._flashing = true;
    this._flashElapsed = 0;
  }

  /**
   * 컨트롤(CC)을 건다 (§9.4) — 해당 강도의 타이머만 max(현재, durationSec)로 갱신하고 다른
   * 강도는 독립으로 둔다. `Projectile`이 명중 시(확률 통과 시) 호출한다.
   * @param strength 적용할 컨트롤 강도 (정지/슬로우/빙결)
   * @param durationSec 지속시간 (sec)
   */
  applyControl(strength: ControlStrength, durationSec: number): void {
    this._control = mergeControl(this._control, strength, durationSec);
  }

  /**
   * 사망 경로를 거치지 않고 즉시 풀로 반환한다 — 너무 멀어져 도착하지 못한 적을 회수한다(스포너가
   * 재활용 거리를 넘은 적에게 호출). **재활용은 사망이 아니다** — `_startDeath`를 타지 않으므로 킬로
   * 집계되지 않고 XP도 떨구지 않으며 사망 연출도 재생하지 않는다. 풀 반환이 `active=false` →
   * `onDisable` → `unregisterEnemy`를 태우므로 활성 목록에서도 빠진다.
   * 이미 사망 연출 중인 적은 그대로 둔다(연출이 끝나며 스스로 반환된다).
   */
  recycle(): void {
    if (this._dead) return;
    this._returnToPool();
  }

  /** 데이터의 색(tint)·크기(threatScale)를 Sprite/node에 적용한다(스폰 시 1회). */
  private _applyVisualBaseline(data: IEnemyData): void {
    this._baseScale = data.threatScale ?? 1;
    this.node.setScale(this._baseScale, this._baseScale, 1);
    this._baseTint.fromHEX(data.tint ?? '#FFFFFF');
    this._baseTint.a = 255;
    if (this._sprite) this._sprite.color = this._baseTint;
  }

  /** 피격 플래시 진행: 경과시간으로 흰색 블렌드를 계산해 적용하고, 끝나면 원래색으로 복귀. */
  private _updateFlash(dt: number): void {
    if (!this._flashing || !this._sprite) return;
    this._flashElapsed += dt;
    const blend = hitFlashBlend(this._flashElapsed, this.flashDuration);
    this._applyTintBlend(FLASH_COLOR, blend);
    if (this._flashElapsed >= this.flashDuration) {
      this._flashing = false;
      this._sprite.color = this._baseTint; // 원래 tint로 정확히 복귀
    }
  }

  /**
   * baseTint를 target 색 쪽으로 blend 비율만큼 보간해 Sprite에 적용한다. blend=0이면 baseTint.
   * 피격 플래시(흰색)·윈드업 텔레그래프(빨강)·CC 틴트가 공유하는 색 적용 경로.
   * @param target 섞을 목표 색
   * @param blend 0~1 보간 비율
   */
  private _applyTintBlend(target: Color, blend: number): void {
    if (!this._sprite) return;
    const b = this._baseTint;
    this._scratchColor.set(
      Math.round(b.r + (target.r - b.r) * blend),
      Math.round(b.g + (target.g - b.g) * blend),
      Math.round(b.b + (target.b - b.b) * blend),
      b.a,
    );
    this._sprite.color = this._scratchColor;
  }

  /**
   * 사망 연출을 시작한다: 목록에서 제외(투사체·접촉 무시), XP 1회 드롭, 연출 타이머 리셋.
   * 이후 update가 _updateDeath로 팝/페이드를 진행하고 끝나면 노드를 제거한다.
   */
  private _startDeath(): void {
    this._dead = true;
    // 실제 처치만 이 경로를 지난다(despawn/onDestroy 아님) → 종류별 킬 1회 누적(결과 화면 통계).
    GameManager.instance?.registerKill(this.enemyId);
    GameManager.instance?.unregisterEnemy(this);
    this._dropXpItem();
    this._deathElapsed = 0;
    this._flashing = false;
    // 윈드업 중 사망 시 바닥·부채꼴 마커가 시체에 남지 않도록 끄고, 텔레그래프 틴트 래치도 해제한다.
    this._windupActive = false;
    this._telegraphTinted = false;
    if (this.lungeMarker) this.lungeMarker.active = false;
    if (this.meleeConeMarker) this.meleeConeMarker.active = false;
    if (this._sprite) this._sprite.color = this._baseTint; // 플래시 중 사망 시 기준색에서 페이드 시작
  }

  /** 사망 연출 진행: 팝(스케일)+페이드(알파). 종료 시 노드 제거. */
  private _updateDeath(dt: number): void {
    this._deathElapsed += dt;
    const s = deathScale(this._deathElapsed, this.deathDuration, this.deathPopScale);
    this.node.setScale(this._baseScale * s, this._baseScale * s, 1);
    if (this._sprite) {
      const a = deathAlpha(this._deathElapsed, this.deathDuration);
      const b = this._baseTint;
      this._scratchColor.set(b.r, b.g, b.b, Math.round(255 * a));
      this._sprite.color = this._scratchColor;
    }
    if (isDeathDone(this._deathElapsed, this.deathDuration)) {
      this._returnToPool();
    }
  }

  /** 사망 연출 종료 시 풀로 반환한다(콜백 없으면 destroy 폴백). 이중 호출은 무시(멱등). */
  private _returnToPool(): void {
    if (this._despawned) return;
    this._despawned = true;
    if (this._onDespawn) this._onDespawn(this.node);
    else this.node.destroy();
  }

  /** 현재 위치에 XP 아이템을 스폰한다(ExperienceManager의 풀에 위임). */
  private _dropXpItem(): void {
    if (!this.xpItemPrefab || !this.playerNode || !this._data) return;
    const parent = this.node.parent;
    if (!parent) return;
    ExperienceManager.instance?.spawnXpItem(
      this.xpItemPrefab,
      parent,
      this.node.position,
      this._data.xpDrop,
      this.playerNode,
    );
  }

  /**
   * 이동 알고리즘(movement)에 따라 분기한다 — 지그재그·돌진은 신규 경로, 그 외(chase·미지 값)는
   * 기존 직선 추격으로 폴백한다(설계 §3·§11 forward-compat).
   * @param dt 프레임 경과 시간 (sec)
   * @param applied 이번 프레임 적용 강도 (update에서 틱 이후 산출해 주입)
   */
  private _move(dt: number, applied: ControlStrength): void {
    if (!this._data) return;
    // 근접 휘두르기 적은 윈드업·가격 중엔 멈춰 서서 친다(추격 정지). Aim·Cooldown 중엔 정상 추격하되,
    // 이미 사거리 안이면 멈춰 대기한다(플레이어에 파고들어 겹치는 것 방지 — 아래 _holdAtMeleeRange).
    if (this._isMeleeStriking()) return;
    if (this._holdAtMeleeRange()) return;
    switch (this._data.movement) {
      case 'zigzag':
        this._moveZigzag(dt, applied);
        return;
      case 'lunge':
        this._moveLunge(dt, applied);
        return;
      case 'kite':
        this._moveKite(dt, applied);
        return;
      default:
        this._followPlayer(dt, applied);
    }
  }

  /**
   * 이동 결과 위치를 장애물에 대해 해소해 돌려준다 — setPosition 직전의 후처리 한 단계(계획 §4.4).
   * 방향을 이미 `_steerAround`가 우회로 꺾어 놨으므로 여기서는 남은 침투만 밀어낸다(안전망).
   * 맵 로드 전이나 MapManager 부재 프레임에는 빈 배열이라 무보정 통과다(풀링 노드라 끄지 않고
   * 그 프레임만 폴백 — 싱글톤 컨벤션).
   * @param from 현재 위치 (node.position)
   * @param toX 이동 후보 x
   * @param toY 이동 후보 y
   */
  private _resolveObstacles(from: Readonly<Vec3>, toX: number, toY: number): Vec2 {
    return resolveCircleMove(
      from,
      { x: toX, y: toY },
      this.collisionRadius,
      MapManager.instance?.obstacles ?? NO_OBSTACLES,
    );
  }

  /**
   * 원래 진행 방향을 장애물 우회 방향으로 바꿔 돌려준다 — 방향 계산 직후, 이동 적용 직전 한 단계.
   * 막히지 않았으면 `desiredDir`이 그대로 나오므로 장애물 없는 곳의 이동은 기존 그대로다.
   *
   * 두 단계(우회 스티어링 → 밀어내기 해소)가 다 필요하다. 해소만 있으면 속도의 법선 성분만
   * 지워지는데, 정면 진입에서는 그게 속도 전부라 변위가 0이 되고 방향은 다음 프레임도 같아서
   * 적이 벽 앞에 영영 굳는다. 스티어링만 있으면 우회 대상으로 고르지 않은 장애물(사슬 경로 위의
   * 다른 건물, 스폰 겹침)에 그대로 파고든다. (계획 §4.4 재검토 — 2026-07-17 리워크)
   * @param from 현재 위치 (node.position)
   * @param target 목표 위치 (플레이어)
   * @param desiredDir 장애물을 모르는 원래 진행 방향 (단위 벡터)
   */
  private _steerAround(from: Readonly<Vec3>, target: Readonly<Vec3>, desiredDir: Vec2): Vec2 {
    return steerAroundObstacles(
      from,
      target,
      desiredDir,
      this.collisionRadius,
      MapManager.instance?.obstacles ?? NO_OBSTACLES,
    );
  }

  /**
   * 지그재그 이동 — 플레이어로 다가오되 진행 방향에 좌우 사인파 오프셋을 더해 흔든다(어둑시니).
   * @param dt 프레임 경과 시간 (sec)
   * @param applied 이번 프레임 적용 강도
   */
  private _moveZigzag(dt: number, applied: ControlStrength): void {
    if (!this.playerNode || !this._data) return;
    this._zigzagElapsed += dt; // 위상 시계는 정지 중에도 흐른다(이동 자체는 아래 배율로 막힘)
    const speedFactor = moveSpeedFactor(applied);
    if (speedFactor === 0) return;
    const myPos = this.node.position;
    const targetPos = this.playerNode.position;
    const mp = this._data.moveParams;
    const dir = zigzagDirection(
      { x: targetPos.x - myPos.x, y: targetPos.y - myPos.y },
      this._zigzagElapsed,
      mp?.zigzagAmplitude ?? 0,
      mp?.zigzagPeriod ?? 0,
    );
    if (dir.x === 0 && dir.y === 0) return; // 겹침·period 가드(영벡터)
    // 우회 중에는 좌우 흔들림이 사라진다 — 코너를 겨눈 방향으로 대체되기 때문. 벽을 타는 동안
    // 지그재그가 멎는 편이 흔들다 벽에 처박히는 것보다 낫다(위상 시계는 계속 흘러 우회가 끝나면
    // 원래 위상으로 복귀한다).
    const steer = this._steerAround(myPos, targetPos, dir);
    const step = this._data.speed * speedFactor * dt;
    const resolved = this._resolveObstacles(
      myPos,
      myPos.x + steer.x * step,
      myPos.y + steer.y * step,
    );
    this.node.setPosition(resolved.x, resolved.y, myPos.z);
  }

  /**
   * 유격(kite) 이동 — 선호 사거리를 유지한다(구미호). 멀면 접근, 가까우면 후퇴, 데드존이면 정지.
   * 정지·빙결(speedFactor=0)이면 이동을 건너뛴다(슬로우는 감속).
   * @param dt 프레임 경과 시간 (sec)
   * @param applied 이번 프레임 적용 강도
   */
  private _moveKite(dt: number, applied: ControlStrength): void {
    if (!this.playerNode || !this._data) return;
    const speedFactor = moveSpeedFactor(applied);
    if (speedFactor === 0) return;
    const myPos = this.node.position;
    const targetPos = this.playerNode.position;
    const mp = this._data.moveParams;
    const dir = kiteDirection(
      { x: targetPos.x - myPos.x, y: targetPos.y - myPos.y },
      mp?.preferredRange ?? 0,
      KITE_DEADZONE_BAND,
    );
    if (dir.x === 0 && dir.y === 0) return; // 데드존·겹침(영벡터)
    // 접근할 때만 우회한다 — 후퇴(-toward)는 도착점이 플레이어가 아니라 우회 척도가 성립하지
    // 않으므로 steerAroundObstacles가 방향을 그대로 돌려준다. 후퇴가 벽에 막히면 그 자리에
    // 멈춰 서서 계속 쏜다(플레이어가 움직이면 데드존이 풀린다).
    const steer = this._steerAround(myPos, targetPos, dir);
    const step = this._data.speed * speedFactor * dt;
    const resolved = this._resolveObstacles(
      myPos,
      myPos.x + steer.x * step,
      myPos.y + steer.y * step,
    );
    this.node.setPosition(resolved.x, resolved.y, myPos.z);
  }

  /**
   * 돌진 이동 — 추격하다 사거리 안에서 윈드업 후 잠근 방향으로 들이받고 쿨다운(불가사리).
   * 정지·빙결(canAct=false)이면 FSM 전체가 동결돼, 풀리면 남은 돌진을 마저 한다(§9.4 헛돌진 방지).
   * @param dt 프레임 경과 시간 (sec)
   * @param applied 이번 프레임 적용 강도
   */
  private _moveLunge(dt: number, applied: ControlStrength): void {
    if (!this.playerNode || !this._data) return;
    const myPos = this.node.position;
    const targetPos = this.playerNode.position;
    const toPlayer: Vec2 = { x: targetPos.x - myPos.x, y: targetPos.y - myPos.y };
    const speedFactor = moveSpeedFactor(applied);
    const canAct = speedFactor !== 0; // 정지·빙결이면 false → FSM 동결
    const params = this._lungeParams();

    const result = tickLunge(this._lungeState, this._lungeTimer, toPlayer, canAct, params, dt);
    // lockDir은 Windup 진입 에지에서만 온다 — 받은 그 한 번만 저장하고 이후엔 유지한다.
    if (result.lockDir) {
      this._lockDir.x = result.lockDir.x;
      this._lockDir.y = result.lockDir.y;
    }
    this._lungeState = result.state;
    this._lungeTimer = result.timer;

    const dir = lungeMovement(this._lungeState, this._lockDir, toPlayer);
    if (dir.x !== 0 || dir.y !== 0) {
      // 돌진 중에는 lungeSpeed, 그 외(추격·쿨다운)는 기본 속도. 슬로우(배율)는 둘 다에 적용.
      const inLunge = this._lungeState === LungeState.Lunge;
      const moveSpeed = inLunge ? params.lungeSpeed : this._data.speed;
      // 돌진 중에는 우회하지 않는다 — 윈드업에 잠근 방향으로 간다는 텔레그래프 약속을 지켜야
      // 한다(플레이어는 마커를 보고 피한다). 잠근 방향에 건물이 끼면 그 돌진은 벽에 처박혀
      // 버려지고, 만료 후 Chase로 돌아가면서 우회로 풀린다(계획 §12 관찰 항목 ①).
      const steer = inLunge ? dir : this._steerAround(myPos, targetPos, dir);
      const step = moveSpeed * speedFactor * dt;
      const resolved = this._resolveObstacles(
        myPos,
        myPos.x + steer.x * step,
        myPos.y + steer.y * step,
      );
      this.node.setPosition(resolved.x, resolved.y, myPos.z);
    }
    this._updateLungeTelegraph(params);
  }

  /** enemies.json moveParams에서 돌진 파라미터를 뽑는다(누락 필드는 안전 기본값). */
  private _lungeParams(): LungeParams {
    const mp = this._data?.moveParams;
    return {
      lungeRange: mp?.lungeRange ?? 0,
      lungeWindup: mp?.lungeWindup ?? 0,
      lungeSpeed: mp?.lungeSpeed ?? this._data?.speed ?? 0,
      lungeDuration: mp?.lungeDuration ?? 0,
      lungeCooldown: mp?.lungeCooldown ?? 0,
    };
  }

  /**
   * 돌진 텔레그래프를 갱신한다 — 윈드업 동안만 본체 점멸 강도(_windupBlendVal)를 산출하고 바닥
   * 마커를 켜 잠근 방향으로 회전·도달 거리만큼 길이를 맞춘다. 그 외 상태에선 마커를 끈다.
   * @param params 돌진 파라미터
   */
  private _updateLungeTelegraph(params: LungeParams): void {
    const inWindup = this._lungeState === LungeState.Windup;
    this._windupActive = inWindup;
    if (inWindup) {
      const elapsed = params.lungeWindup - this._lungeTimer;
      this._windupBlendVal = windupBlend(elapsed, params.lungeWindup);
    }
    if (!this.lungeMarker) return;
    if (inWindup) {
      this.lungeMarker.active = true;
      this.lungeMarker.angle = vectorToAngle(this._lockDir);
      // 자식 마커의 월드 길이 = 기준 폭 × 자식 스케일 × 부모 스케일 → 부모(threatScale)를 상쇄한다.
      const sx = lungeReach(params) / (MARKER_BASE_WIDTH * (this._baseScale || 1));
      const cur = this.lungeMarker.scale;
      this.lungeMarker.setScale(sx, cur.y, cur.z);
    } else {
      this.lungeMarker.active = false;
    }
  }

  /**
   * 능동 공격(발사체) FSM을 한 틱 돌린다 — `attack` 블록이 있는 적만(없으면 즉시 반환). 정지·빙결이면
   * 동결한다(슬로우는 정상 공격). 텔레그래프 동안 본체를 점멸시키고, Fire 에지에서 발사를 위임한다.
   * @param dt 프레임 경과 시간 (sec)
   * @param applied 이번 프레임 적용 강도
   */
  private _tickEnemyAttack(dt: number, applied: ControlStrength): void {
    const atk = this._data?.attack;
    // 능동 공격(발사체 단발·부채꼴·확산 + 근접 휘두르기)이 같은 공격 FSM을 돈다. 접촉·돌진·미지 타입은
    // 무공격 폴백(forward-compat). 사거리는 발사체면 atk.range, 휘두르기면 atk.melee.range를 쓴다.
    const isMelee = atk?.type === 'melee_sweep';
    const isActiveAttack =
      atk?.type === 'projectile_single' ||
      atk?.type === 'projectile_fan' ||
      atk?.type === 'projectile_spread' ||
      isMelee;
    if (!atk || !isActiveAttack || !this.playerNode) return;
    const myPos = this.node.position;
    const targetPos = this.playerNode.position;
    const toPlayer: Vec2 = { x: targetPos.x - myPos.x, y: targetPos.y - myPos.y };
    const canAct = moveSpeedFactor(applied) !== 0; // 정지·빙결이면 false → FSM 동결
    const params: AttackParams = {
      range: isMelee ? (atk.melee?.range ?? 0) : (atk.range ?? 0),
      telegraphTime: atk.telegraphTime,
      cooldown: atk.cooldown,
    };
    const result = tickAttack(this._attackState, this._attackTimer, toPlayer, canAct, params, dt);
    // lockDir은 Telegraph 진입 에지에서만 온다 — 받은 그 한 번만 저장하고 이후엔 유지한다.
    if (result.lockDir) {
      this._attackLockDir.x = result.lockDir.x;
      this._attackLockDir.y = result.lockDir.y;
    }
    this._attackState = result.state;
    this._attackTimer = result.timer;
    this._updateAttackTelegraph(params);
    if (isMelee) this._updateMeleeMarker(atk);
    // Fire 에지에서 발사체는 발사, 휘두르기는 부채꼴 즉시 판정.
    if (result.fired) {
      if (isMelee) this._strikeMelee(atk);
      else this._fireProjectile(atk);
    }
  }

  /**
   * 근접 휘두르기 적이 윈드업·가격 중(Telegraph·Fire)이면 true — 이 동안 추격을 멈춰 제자리에서 친다.
   * Aim(접근)·Cooldown(재접근) 중엔 false라 정상 추격한다.
   */
  private _isMeleeStriking(): boolean {
    return (
      this._data?.attack?.type === 'melee_sweep' &&
      (this._attackState === AttackState.Telegraph || this._attackState === AttackState.Fire)
    );
  }

  /**
   * 근접 휘두르기 적이 이미 휘두르기 사거리 안에 있으면 true — 추격을 멈춰 사거리에서 대기한다.
   * 순수 chase는 플레이어까지 1px로 파고들어 겹치는데, 겹치면 쿨다운마다 회피 불가 연타가 된다.
   * 사거리에서 서서 쳐야 "예고 보고 피하기"가 성립한다. 사거리 밖이면 false라 정상 접근한다.
   */
  private _holdAtMeleeRange(): boolean {
    const melee = this._data?.attack?.type === 'melee_sweep' ? this._data.attack.melee : undefined;
    if (!melee || !this.playerNode) return false;
    return Vec3.distance(this.node.position, this.playerNode.position) <= melee.range;
  }

  /**
   * 부채꼴 범위 마커를 갱신한다 — Telegraph 동안만 켜서 잠근 조준 방향으로 회전한다. 비활성으로
   * 시작한 마커는 첫 활성화 전엔 Graphics 렌더 impl이 없어 그리기가 no-op이므로(onLoad는 노드
   * 최초 활성화 시 실행 — Cocos 매뉴얼), reset이 아니라 **활성화 에지(Aim→Telegraph)에서 1회**
   * 그린다. active=true가 onLoad를 동기 실행해 impl이 준비된 직후다. 이후 프레임엔 회전만(매 프레임
   * 재그리기 없음). 미연결(null)이면 마커 없이 동작한다.
   * @param atk 이 적의 공격 데이터(melee 유무 확인)
   */
  private _updateMeleeMarker(atk: IEnemyAttackData): void {
    if (!this.meleeConeMarker) return;
    const active = this._attackState === AttackState.Telegraph && !!atk.melee;
    const wasActive = this.meleeConeMarker.active;
    this.meleeConeMarker.active = active;
    if (!active) return;
    if (!wasActive) this._drawMeleeCone(); // 활성화 직후(impl 준비됨) 1회만 그린다
    this.meleeConeMarker.angle = vectorToAngle(this._attackLockDir);
  }

  /**
   * 부채꼴 마커 섹터를 Graphics로 그린다(활성화 에지에서 1회 호출). 로컬 +X를 중심으로
   * ±coneAngleDeg/2 호를 그려 실제 명중 부채꼴(coneHitsTarget)과 각을 맞춘다. 반지름은
   * 부모(threatScale) 스케일을 상쇄한다. 매 호출 clear로 시작해 풀 재사용 시 이전 섹터가 남지 않는다.
   * 휘두르기 적이 아니거나 Graphics 미부착이면 지우기만 한다.
   */
  private _drawMeleeCone(): void {
    const g = this.meleeConeMarker?.getComponent(Graphics);
    if (!g) return;
    g.clear();
    const melee = this._data?.attack?.melee;
    if (!melee) return; // 휘두르기 적이 아니면 섹터 없음
    const { radius, startRad, endRad } = meleeConeMarkerArc(
      melee.range,
      melee.coneAngleDeg,
      this._baseScale || 1,
    );
    g.fillColor = MELEE_MARKER_COLOR;
    g.moveTo(0, 0); // 꼭짓점 = 적 중심
    // counterclockwise=true여야 소각(콘) 쪽 호를 그린다. false면 여집합(360−콘, 안전지대)이
    // 칠해져 위험/안전 구역이 반전된다(각은 +X에서 clockwise 측정 — Cocos 매뉴얼).
    g.arc(0, 0, radius, startRad, endRad, true);
    g.lineTo(0, 0); // 호 끝 → 중심 연결로 섹터(파이 조각) 완성
    g.close();
    g.fill();
  }

  /**
   * 휘두르기 가격(Fire 에지) — 잠근 방향 기준으로 지금 플레이어까지 벡터를 다시 구해(윈드업 중 회피
   * 반영) 부채꼴 안이면 버스트 피해를 피격 게이트(damagePlayer)에 제출한다. 빗나가면 무피해.
   * @param atk 이 적의 공격 데이터(피해·melee 부채꼴 각·사거리)
   */
  private _strikeMelee(atk: IEnemyAttackData): void {
    const melee = atk.melee;
    if (!this.playerNode || !melee) return;
    const myPos = this.node.position;
    const targetPos = this.playerNode.position;
    const toTarget: Vec2 = { x: targetPos.x - myPos.x, y: targetPos.y - myPos.y };
    if (coneHitsTarget(this._attackLockDir, toTarget, melee.coneAngleDeg, melee.range)) {
      // 반환값을 쓰지 않는 호출이라 옵셔널 체이닝이 안전하다(값 폴백으로 게임이 왜곡될 여지가 없다).
      GameManager.instance?.damagePlayer(atk.damage);
    }
  }

  /**
   * 발사 텔레그래프를 갱신한다 — 텔레그래프 상태 동안만 본체 점멸 강도(_windupBlendVal)를 산출한다.
   * 돌진과 같은 `_windupActive`→`_updateTint` 경로를 공유한다(한 적이 돌진·발사를 겸하지 않음).
   * @param params 공격 파라미터
   */
  private _updateAttackTelegraph(params: AttackParams): void {
    const inTelegraph = this._attackState === AttackState.Telegraph;
    this._windupActive = inTelegraph;
    if (inTelegraph) {
      const elapsed = params.telegraphTime - this._attackTimer;
      this._windupBlendVal = windupBlend(elapsed, params.telegraphTime);
    }
  }

  /**
   * 잠근 방향을 중심으로 발사체를 발사한다(풀 소유자에 위임). 공격 타입에 따라 발사 기하가 다르다 —
   * 단발은 1발, 부채꼴(projectile_fan)은 전방 호로 N발, 확산(projectile_spread)은 사방 링으로 N발.
   * 방향 계산은 순수 FireGeometry가 맡고 여기선 방향마다 위임 콜백을 호출한다. 발사체 데이터가 없으면
   * 발사하지 않는다. (`_fireProjectileFn`은 reset()에서 항상 주입되며, 풀 미연결 자체는 EnemySpawner의
   * _fireEnemyProjectile가 따로 막는다 — 여기 null 체크는 방어용이다.)
   * @param atk 이 적의 공격 데이터(발사체 속도·반경·피해·발사 수·부채꼴 각도)
   */
  private _fireProjectile(atk: IEnemyAttackData): void {
    const proj = atk.projectile;
    const fire = this._fireProjectileFn;
    if (!proj || !fire) return;
    const lock = this._attackLockDir;
    // 확산은 사방 링(기본 360°), 부채꼴·단발은 전방 호. 단발은 count=1이라 호가 1발을 돌려준다.
    const dirs =
      atk.type === 'projectile_spread'
        ? radialDirections(lock.x, lock.y, proj.count, proj.spreadAngleDeg ?? 360)
        : fanDirections(lock.x, lock.y, proj.count, proj.spreadAngleDeg ?? 0);
    const origin = this.node.position;
    for (const [dirX, dirY] of dirs) {
      fire(origin, dirX, dirY, proj.speed, atk.damage, proj.radius);
    }
  }

  /**
   * 플레이어 방향으로 이동한다. 컨트롤(CC) 강도에 따라 감속(슬로우)하거나 멈춘다(정지·빙결, §9.4).
   * @param dt 프레임 경과 시간 (sec)
   * @param applied 이번 프레임 적용 강도 (update에서 틱 이후 산출해 주입)
   */
  private _followPlayer(dt: number, applied: ControlStrength): void {
    if (!this.playerNode || !this._data) return;
    // 정지·빙결이면 배율 0이라 이동을 건너뛴다. 슬로우면 1 미만 배율로 감속한다.
    const speedFactor = moveSpeedFactor(applied);
    if (speedFactor === 0) return;
    const myPos = this.node.position;
    const targetPos = this.playerNode.position;
    const dir = new Vec3();
    Vec3.subtract(dir, targetPos, myPos);
    if (dir.lengthSqr() < 1) return;
    dir.normalize();
    const steer = this._steerAround(myPos, targetPos, dir);
    const step = this._data.speed * speedFactor * dt;
    const resolved = this._resolveObstacles(
      myPos,
      myPos.x + steer.x * step,
      myPos.y + steer.y * step,
    );
    this.node.setPosition(resolved.x, resolved.y, myPos.z);
  }

  /**
   * 플레이어와 접촉 거리 내에 있으면 접촉 피해를 피격 게이트에 제출한다(전역 i-frame + 틱당 max).
   * 초당값을 넘기면 게이트가 틱 길이로 환산하므로 dt가 필요 없다. 빙결 상태면 접촉 피해를 차단한다(§9.4).
   * @param applied 이번 프레임 적용 강도 (update에서 틱 이후 산출해 주입)
   */
  private _checkContactDamage(applied: ControlStrength): void {
    if (!this.playerNode || !this._data) return;
    // 빙결만 접촉 피해를 막는다(완전 무력화). 정지·슬로우는 닿아 있으면 그대로 아프다.
    if (!dealsContactDamage(applied)) return;
    const ep = this.node.position;
    const pp = this.playerNode.position;
    // 적(원, collisionRadius) 대 플레이어(피해 박스) 겹침 — 이동 충돌과 별개 축이다(ADR 006).
    if (
      circleIntersectsBox(
        ep.x,
        ep.y,
        this.collisionRadius,
        pp.x,
        pp.y,
        this._playerHurtboxHalfW,
        this._playerHurtboxHalfH,
      )
    ) {
      // 반환값을 쓰지 않는 호출이라 옵셔널 체이닝이 안전하다.
      GameManager.instance?.damagePlayerContact(this._data.contactDamagePerSec);
    }
  }

  /**
   * 매 프레임 틴트를 우선순위로 해소한다(사망 > 플래시 > 텔레그래프 > CC > 기본). 윈드업
   * 텔레그래프가 있으면 CC보다 우선해 빨강을 섞고, 텔레그래프·CC가 끝나면 baseTint로 1회
   * 복원한다(복원 래치). 강도가 바뀌면(빙결→정지→슬로우) 색도 매 프레임 다시 고른다.
   * 피격 플래시 중에는 플래시가 색을 소유하므로 양보한다.
   * @param applied 이번 프레임 적용 강도 (update에서 틱 이후 산출해 주입)
   */
  private _updateTint(applied: ControlStrength): void {
    if (!this._sprite || this._flashing) return; // 플래시가 색을 소유
    if (this._windupActive) {
      this._applyTintBlend(TELEGRAPH_COLOR, this._windupBlendVal);
      this._telegraphTinted = true;
      return;
    }
    if (applied !== ControlStrength.None) {
      this._applyTintBlend(this._ccTintFor(applied), CC_TINT_BLEND);
      this._ccTinted = true;
      this._telegraphTinted = false;
    } else if (this._ccTinted || this._telegraphTinted) {
      this._sprite.color = this._baseTint;
      this._ccTinted = false;
      this._telegraphTinted = false;
    }
  }

  /** 적용 강도별 CC 틴트 색 — 슬로우=하늘색, 정지=노랑, 빙결=짙은 얼음(placeholder, §14). */
  private _ccTintFor(strength: ControlStrength): Color {
    switch (strength) {
      case ControlStrength.Slow:
        return this._slowTint;
      case ControlStrength.Freeze:
        return this._freezeTint;
      default:
        return this._stunTint;
    }
  }
}
