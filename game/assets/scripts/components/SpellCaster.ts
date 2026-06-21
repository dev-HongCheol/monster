import { _decorator, CCString, Color, Component, Node, Prefab, Sprite, Vec3 } from 'cc';
import { GameState, type ISpellData } from '../data/GameTypes';
import { FireSchedulerLogic } from '../logic/FireSchedulerLogic';
import { LoadoutLogic } from '../logic/LoadoutLogic';
import { buildFirePlan, type ShotSpec } from '../logic/SpellPatternLogic';
import { spellCategoryColor } from '../logic/SpellVisual';
import { ControlStrength } from '../logic/StatusEffectLogic';
import { DataManager } from '../systems/DataManager';
import { DeckManager } from '../systems/DeckManager';
import { GameManager } from '../systems/GameManager';
import { PoolManager } from './PoolManager';
import { Projectile, type ProjectileExplosion, type ProjectileStatus } from './Projectile';

const { ccclass, property } = _decorator;

/** 폭발 VFX 표시 시간 (sec) — 이 시간 뒤 풀로 반환. */
const EXPLOSION_VFX_DURATION = 0.25;
/** 폭발 VFX 기준 반경 — 이 반경에서 스케일 1. 유효 반경에 비례해 VFX를 키운다(범위 강화 시 커짐). */
const EXPLOSION_VFX_BASE_RADIUS = 70;

/** spells.json `onHitStatus.kind` 문자열 → CC 강도(`ControlStrength`) 매핑. */
const STATUS_KIND_STRENGTH: Record<'stun' | 'slow' | 'freeze', ControlStrength> = {
  stun: ControlStrength.Stun,
  slow: ControlStrength.Slow,
  freeze: ControlStrength.Freeze,
};

/**
 * 로드아웃(보유 마법)을 들고 보유 마법 전부를 각자 쿨다운으로 자동 발사하는 컴포넌트.
 * 발사 기준 위치는 부착된 노드(Player)의 위치다.
 *
 * 플랜 § 4 근거:
 * - LoadoutLogic + FireSchedulerLogic 소유
 * - 매 프레임 스케줄러 tick → 가장 가까운 적을 향해 준비된 마법만 발사
 * - per-spell/분류/전역 강화(DeckManager.damageFactor/effectiveCooldown)를 마법별로 적용
 */
@ccclass('SpellCaster')
export class SpellCaster extends Component {
  static instance!: SpellCaster;

  /** 발사체 프리팹 (인스펙터에서 연결) */
  @property(Prefab) bulletPrefab: Prefab | null = null;
  /** 발사체가 생성될 부모 노드 (인스펙터에서 연결) */
  @property(Node) bulletParent: Node | null = null;
  /**
   * 시작 시 로드아웃에 채울 마법 id 목록 (spells.json).
   * 씬 인스펙터에 값이 지정돼 있으면 인스펙터가 이 기본값보다 우선하므로 인스펙터에서 바꾼다.
   */
  @property({ type: [CCString] }) startingSpellIds: string[] = ['fireball'];
  /** 폭발 VFX 프리팹 (인스펙터에서 연결 — 폭발형 마법 명중 시 표시). 미연결이면 VFX 생략. */
  @property(Prefab) explosionVfxPrefab: Prefab | null = null;

  private readonly _loadout = new LoadoutLogic();
  private readonly _scheduler = new FireSchedulerLogic();
  private _dataReady = false;
  /** 발사체 재사용 풀 (onLoad에서 prefab/parent로 생성). */
  private _bulletPool: PoolManager | null = null;
  /** 폭발 VFX 재사용 풀 (onLoad에서 prefab/parent로 생성). prefab 미연결이면 null(VFX 생략). */
  private _vfxPool: PoolManager | null = null;
  /** 발사체 반환 콜백 — 매 발사마다 closure를 새로 만들지 않도록 1회 바인딩해 재사용. */
  private readonly _releaseBullet = (node: Node): void => {
    this._bulletPool?.release(node);
  };
  /** 폭발 VFX를 명중 지점에 띄우는 콜백 — 발사체에 1회 바인딩해 재사용. prefab 미연결이면 no-op. */
  private readonly _spawnExplosionVfx = (x: number, y: number, radius: number): void => {
    if (!this._vfxPool) return;
    const vfx = this._vfxPool.acquire();
    vfx.setPosition(x, y, 0);
    const s = radius / EXPLOSION_VFX_BASE_RADIUS;
    vfx.setScale(s, s, 1);
    this.scheduleOnce(() => this._vfxPool?.release(vfx), EXPLOSION_VFX_DURATION);
  };

  /** 보유 마법 로드아웃 (후속 슬라이스의 카드 시스템 연동용) */
  get loadout(): LoadoutLogic {
    return this._loadout;
  }

  onLoad() {
    SpellCaster.instance = this;
    if (this.bulletPrefab && this.bulletParent) {
      this._bulletPool = new PoolManager(this.bulletPrefab, this.bulletParent);
    } else {
      console.error('[SpellCaster] bulletPrefab or bulletParent not assigned — attack disabled');
    }
    // 폭발 VFX 풀은 선택 — 미연결이면 폭발 피해는 그대로 동작하고 VFX만 생략한다.
    if (this.explosionVfxPrefab && this.bulletParent) {
      this._vfxPool = new PoolManager(this.explosionVfxPrefab, this.bulletParent);
    }
  }

  onDestroy() {
    if (SpellCaster.instance === this) {
      SpellCaster.instance = null as unknown as SpellCaster;
    }
  }

  /**
   * 마법을 로드아웃에 추가한다 (카드 "마법 추가" 픽). 추가된 마법은 다음 프레임부터 자동 발사된다.
   * @param id 마법 id (spells.json)
   * @returns 추가 성공 여부. 슬롯이 가득 찼거나 이미 보유 중이면 false.
   */
  addSpell(id: string): boolean {
    return this._loadout.addSpell(id);
  }

  start() {
    DataManager.instance.onReady(() => {
      for (const id of this.startingSpellIds) this._loadout.addSpell(id);
      this._dataReady = true;
    });
  }

  // 스케줄러 tick → 최근접 적 조준 → 쿨다운 소진된 보유 마법만 전역 강화 적용해 발사
  update(dt: number) {
    if (!this._dataReady) return;
    if (GameManager.instance.state !== GameState.Playing) return;

    const spells = this._loadout.spells;
    this._scheduler.tick(dt, spells);

    const target = this._findNearestEnemy();
    if (!target) return;

    // 발사 기준 조준 단위벡터(플레이어 → 최근접 적). 적이 self와 겹쳐 영벡터면 위쪽 폴백.
    const aim = new Vec3();
    Vec3.subtract(aim, target.position, this.node.position);
    if (aim.lengthSqr() < 1e-8) aim.set(0, 1, 0);
    else aim.normalize();

    for (const id of spells) {
      if (!this._scheduler.isReady(id)) continue;
      const spell = DataManager.instance.getSpell(id);
      if (!spell) continue;

      // per-spell/분류/전역 쿨다운 강화 반영(배율로 나눠 간격 단축 + 하한). 계산은 순수 로직에 위임.
      this._scheduler.consume(id, DeckManager.instance.effectiveCooldown(spell));

      // 유효 발사체 수 = 기본 + 개별·분류 발사체 보너스(§7.6). 패턴 엔진이 부채꼴 형태를 결정.
      const count = DeckManager.instance.effectiveProjectileCount(spell);
      const plan = buildFirePlan(spell, { aimX: aim.x, aimY: aim.y, count });
      // 데미지 = per-spell/분류/전역 배율 × 발사체당 페널티(발사체 늘수록 발당 약화 §7.6).
      const damageMult =
        DeckManager.instance.damageFactor(spell) *
        DeckManager.instance.projectilePenaltyFactor(spell);
      // 폭발형이면 이번 시전의 dedup 공유 집합 + 유효 반경을 만들어 모든 발사체가 공유한다(§10.2·§10.3).
      const explosion = this._buildExplosion(spell);
      // 명중 시 상태이상(CC)을 거는 마법이면 유효 지속까지 계산한 설정을 만든다(§9.4·§10.3 A3).
      const status = this._buildStatusEffect(spell);
      for (const shot of plan) {
        this._spawnShot(shot, damageMult, spell.category, explosion, status);
      }
    }
  }

  /**
   * 폭발형 마법이면 이번 시전의 폭발 설정을 만든다 (단일 명중 마법이면 null).
   * 시전 단위 dedup 집합은 시전마다 새로 만들어 그 시전의 모든 발사체가 공유한다(§10.2).
   * 유효 폭발 반경 = 기본 반경 × 범위 강화 배율(§10.3 A3).
   * @param spell 발사 중인 마법
   */
  private _buildExplosion(spell: ISpellData): ProjectileExplosion | null {
    if (spell.hitEffect !== 'explosion' || spell.explosionRadius === undefined) return null;
    return {
      radius: spell.explosionRadius * DeckManager.instance.rangeFactor(spell),
      hitSet: new Set<number>(),
      onVfx: this._spawnExplosionVfx,
    };
  }

  /**
   * 명중 시 상태이상(CC)을 거는 마법이면 이번 시전의 상태이상 설정을 만든다 (없으면 null).
   * 데이터의 `kind` 문자열을 CC 강도로 매핑하고, 유효 지속 = 기본 지속 × 지속(Duration) 강화
   * 배율을 계산한다(§9.4·§10.3 A3).
   * @param spell 발사 중인 마법
   */
  private _buildStatusEffect(spell: ISpellData): ProjectileStatus | null {
    const s = spell.onHitStatus;
    if (!s) return null;
    return {
      strength: STATUS_KIND_STRENGTH[s.kind],
      chance: s.chance,
      durationSec: s.durationSec * DeckManager.instance.durationFactor(spell),
    };
  }

  /** 활성 적 중 가장 가까운 적 노드를 반환한다. 없으면 null. */
  private _findNearestEnemy(): Node | null {
    const enemies = GameManager.instance.enemies;
    if (enemies.length === 0) return null;

    let nearest: Node | null = null;
    let minDist = Infinity;
    const myPos = this.node.position;

    for (const enemy of enemies) {
      if (!enemy?.isValid) continue;
      const dist = Vec3.distance(myPos, enemy.node.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = enemy.node;
      }
    }
    return nearest;
  }

  /**
   * ShotSpec 한 발을 발사체로 생성하고 발사한다.
   * @param shot 발사 사양 (방향 단위벡터·속도·기본 데미지·반경)
   * @param damageMult 기본 데미지에 곱할 배율 = per-spell/분류/전역 데미지 배율 × 발사체당 페널티(§7.6)
   * @param category 마법 분류 (발사체 색 틴트용)
   * @param explosion 명중 시 폭발 설정 — null이면 단일 명중
   * @param status 명중 시 상태이상(CC) 설정 — null이면 없음(단일 명중 경로에서만 적용)
   */
  private _spawnShot(
    shot: ShotSpec,
    damageMult: number,
    category: string,
    explosion: ProjectileExplosion | null,
    status: ProjectileStatus | null,
  ): void {
    if (!this._bulletPool) return;

    // 풀에서 발사체를 꺼낸다(가용분 재사용 또는 신규 생성). 위치·색·init은 매 acquire마다
    // 새로 적용하므로 재사용 노드에 이전 상태가 잔류하지 않는다.
    const bullet = this._bulletPool.acquire();
    bullet.setPosition(this.node.position);

    // 마법별 전용 스프라이트가 없는 동안 분류 색으로 발사체를 구분한다.
    const sprite = bullet.getComponent(Sprite);
    if (sprite) {
      const [r, g, b] = spellCategoryColor(category);
      sprite.color = new Color(r, g, b);
    }

    const projectile = bullet.getComponent(Projectile);
    if (!projectile) return;
    projectile.init(
      new Vec3(shot.dirX, shot.dirY, 0),
      shot.speed,
      shot.damage * damageMult,
      shot.radius,
      this._releaseBullet,
      explosion,
      status,
    );
  }
}
