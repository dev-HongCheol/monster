import { _decorator, Color, Component, Node, Prefab, Sprite, Vec3 } from 'cc';
import { GameState, type IEnemyData } from '../data/GameTypes';
import { deathAlpha, deathScale, hitFlashBlend, isDeathDone } from '../logic/EnemyVisualLogic';
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

const { ccclass, property } = _decorator;

/** 제어(CC) 중 baseTint를 적용 강도의 CC 색 쪽으로 섞는 비율 (placeholder, §14). */
const CC_TINT_BLEND = 0.6;

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
  @property enemyId: string = 'skeleton';
  /** 사망 시 스폰할 XP 아이템 프리팹 (인스펙터에서 연결) */
  @property(Prefab) xpItemPrefab: Prefab | null = null;
  /** 피격 플래시(흰색 점멸) 지속시간 (sec) */
  @property flashDuration: number = 0.12;
  /** 사망 팝/페이드 연출 지속시간 (sec) */
  @property deathDuration: number = 0.25;
  /** 사망 팝의 최대 스케일 배율 (기준 크기 대비) */
  @property deathPopScale: number = 1.3;

  collisionRadius: number = 25;
  /** 풀 재사용마다 증가하는 개체 식별자 — 폭발 등 시전 단위 dedup의 안정 id(§10.2). reset마다 새 값. */
  spawnId: number = 0;

  private _data: IEnemyData | null = null;
  private _hp: number = 0;
  private _playerCollisionRadius: number = 0;
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
   */
  reset(enemyId: string, playerNode: Node, onDespawn: (node: Node) => void): void {
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
    this._data = DataManager.instance.getEnemy(enemyId);
    if (this._data) {
      this._hp = this._data.maxHp;
      this.collisionRadius = this._data.collisionRadius;
      this._applyVisualBaseline(this._data);
    }
    this._playerCollisionRadius = DataManager.instance.playerData.collisionRadius;
  }

  // 데이터 준비 시 update 분기: 사망 연출 중이면 그것만, 아니면 플래시 갱신 + (Playing일 때) 추적·접촉
  update(dt: number) {
    if (!this._data) return;
    if (this._dead) {
      this._updateDeath(dt);
      return;
    }
    this._updateFlash(dt);
    if (GameManager.instance.state !== GameState.Playing) return;
    // 제어 중일 때만 틱한다(빈 적은 건너뛰어 매 프레임 할당 회피). appliedStrength는 반드시
    // 틱 *이후* 한 번 산출해 이동·접촉·틴트에 넘긴다 — 틱 전에 읽으면 만료가 한 프레임 늦는다.
    if (hasActiveControl(this._control)) {
      this._control = tickControl(this._control, dt);
    }
    const applied = appliedStrength(this._control);
    this._followPlayer(dt, applied);
    this._checkContactDamage(dt, applied);
    this._updateControlTint(applied);
  }

  /**
   * 피해를 입힌다. HP가 0 이하면 사망 연출을 시작하고, 아니면 피격 플래시를 트리거한다.
   * 사망 연출 중에는 중복 피격을 무시한다.
   */
  takeDamage(amount: number): void {
    if (this._dead) return;
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
    this._applyFlashColor(blend);
    if (this._flashElapsed >= this.flashDuration) {
      this._flashing = false;
      this._sprite.color = this._baseTint; // 원래 tint로 정확히 복귀
    }
  }

  /** baseTint를 blend 비율만큼 흰색으로 보간해 Sprite에 적용한다. blend=0이면 baseTint. */
  private _applyFlashColor(blend: number): void {
    if (!this._sprite) return;
    const b = this._baseTint;
    this._scratchColor.set(
      Math.round(b.r + (255 - b.r) * blend),
      Math.round(b.g + (255 - b.g) * blend),
      Math.round(b.b + (255 - b.b) * blend),
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
    GameManager.instance?.unregisterEnemy(this);
    this._dropXpItem();
    this._deathElapsed = 0;
    this._flashing = false;
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
    dir.multiplyScalar(this._data.speed * speedFactor * dt);
    this.node.setPosition(myPos.x + dir.x, myPos.y + dir.y, myPos.z);
  }

  /**
   * 플레이어와 접촉 거리 내에 있으면 초당 데미지를 준다. 빙결 상태면 접촉 피해를 차단한다(§9.4).
   * @param dt 프레임 경과 시간 (sec)
   * @param applied 이번 프레임 적용 강도 (update에서 틱 이후 산출해 주입)
   */
  private _checkContactDamage(dt: number, applied: ControlStrength): void {
    if (!this.playerNode || !this._data) return;
    // 빙결만 접촉 피해를 막는다(완전 무력화). 정지·슬로우는 닿아 있으면 그대로 아프다.
    if (!dealsContactDamage(applied)) return;
    const dist = Vec3.distance(this.node.position, this.playerNode.position);
    const touchRadius = this.collisionRadius + this._playerCollisionRadius;
    if (dist < touchRadius) {
      GameManager.instance.damagePlayer(this._data.contactDamagePerSec * dt);
    }
  }

  /**
   * 컨트롤(CC) 틴트를 적용한다 — 제어 중이면 baseTint를 적용 강도의 CC 색 쪽으로 섞고, 제어가
   * 풀리면 baseTint로 1회 복원한다. 강도가 바뀌면(빙결→정지→슬로우) 색도 매 프레임 다시 고른다
   * (전이 시점에 래치하지 않는다). 피격 플래시 중에는 플래시가 색을 소유하므로 양보한다
   * (틴트 우선순위: 사망 > 플래시 > CC > 기본).
   * @param applied 이번 프레임 적용 강도 (update에서 틱 이후 산출해 주입)
   */
  private _updateControlTint(applied: ControlStrength): void {
    if (!this._sprite || this._flashing) return;
    if (applied !== ControlStrength.None) {
      const b = this._baseTint;
      const t = this._ccTintFor(applied);
      this._scratchColor.set(
        Math.round(b.r + (t.r - b.r) * CC_TINT_BLEND),
        Math.round(b.g + (t.g - b.g) * CC_TINT_BLEND),
        Math.round(b.b + (t.b - b.b) * CC_TINT_BLEND),
        b.a,
      );
      this._sprite.color = this._scratchColor;
      this._ccTinted = true;
    } else if (this._ccTinted) {
      this._sprite.color = this._baseTint;
      this._ccTinted = false;
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
