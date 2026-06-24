import { _decorator, CCString, Color, Component, Node, Prefab, Sprite, Vec3 } from 'cc';
import { GameState, type ISpellData, SpellPattern } from '../data/GameTypes';
import { selectExplosionHits } from '../logic/ExplosionLogic';
import { FireSchedulerLogic } from '../logic/FireSchedulerLogic';
import { LoadoutLogic } from '../logic/LoadoutLogic';
import { OrbitLogic } from '../logic/OrbitLogic';
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
/** 노바 VFX 표시 시간 (sec) — 이 시간 뒤 풀로 반환. */
const NOVA_VFX_DURATION = 0.25;
/** 노바 VFX 기준 반경 — 이 반경에서 스케일 1. 유효 반경에 비례해 VFX를 키운다(범위 강화 시 커짐). frost_nova 기본 반경과 동일. */
const NOVA_VFX_BASE_RADIUS = 120;
/** 오브 VFX 기준 반경 — 이 반경에서 스케일 1. 유효 오브 크기에 비례해 스케일(범위 강화 시 커짐). inferno 기본 오브 크기와 동일. */
const ORB_VFX_BASE_RADIUS = 14;

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
  /** 노바 VFX 프리팹 (인스펙터에서 연결 — 자기중심 노바 발동 시 표시). 미연결이면 VFX 생략. */
  @property(Prefab) novaVfxPrefab: Prefab | null = null;
  /** 오브 VFX 프리팹 (인스펙터에서 연결 — 궤도 오브 표시). 미연결이면 VFX 생략. */
  @property(Prefab) orbVfxPrefab: Prefab | null = null;

  private readonly _loadout = new LoadoutLogic();
  private readonly _scheduler = new FireSchedulerLogic();
  private _dataReady = false;
  /** 발사체 재사용 풀 (onLoad에서 prefab/parent로 생성). */
  private _bulletPool: PoolManager | null = null;
  /** 폭발 VFX 재사용 풀 (onLoad에서 prefab/parent로 생성). prefab 미연결이면 null(VFX 생략). */
  private _vfxPool: PoolManager | null = null;
  /** 노바 VFX 재사용 풀 (onLoad에서 prefab/parent로 생성). prefab 미연결이면 null(VFX 생략). */
  private _novaVfxPool: PoolManager | null = null;
  /** 오브 VFX 재사용 풀 (onLoad에서 prefab/parent로 생성). prefab 미연결이면 null(VFX 생략). */
  private _orbVfxPool: PoolManager | null = null;
  /** 궤도 회전·활성 수명·재타격 락아웃 순수 로직. */
  private readonly _orbitLogic = new OrbitLogic();
  /** spellId → 현재 띄운 오브 VFX 노드들. 오브 수에 맞춰 늘리고 줄이며, 수명이 끝나면 전부 반환한다. */
  private readonly _orbNodes = new Map<string, Node[]>();
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
  /** 노바 VFX를 플레이어 위치에 띄우는 콜백 — 유효 반경에 비례해 스케일. prefab 미연결이면 no-op. */
  private readonly _spawnNovaVfx = (x: number, y: number, radius: number): void => {
    if (!this._novaVfxPool) return;
    const vfx = this._novaVfxPool.acquire();
    vfx.setPosition(x, y, 0);
    const s = radius / NOVA_VFX_BASE_RADIUS;
    vfx.setScale(s, s, 1);
    this.scheduleOnce(() => this._novaVfxPool?.release(vfx), NOVA_VFX_DURATION);
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
    // 노바 VFX 풀도 선택 — 미연결이면 노바 피해는 그대로 동작하고 VFX만 생략한다.
    if (this.novaVfxPrefab && this.bulletParent) {
      this._novaVfxPool = new PoolManager(this.novaVfxPrefab, this.bulletParent);
    }
    // 오브 VFX 풀도 선택 — 미연결이면 궤도 피해는 그대로 동작하고 VFX만 생략한다.
    if (this.orbVfxPrefab && this.bulletParent) {
      this._orbVfxPool = new PoolManager(this.orbVfxPrefab, this.bulletParent);
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

  // 스케줄러 tick → 자기중심(Nova)은 적 무관 발동, 발사체 마법은 최근접 적 조준 시에만 발동
  update(dt: number) {
    if (!this._dataReady) return;
    if (GameManager.instance.state !== GameState.Playing) return;

    const spells = this._loadout.spells;
    this._scheduler.tick(dt, spells);

    // 최근접 적 조준 단위벡터 — 적이 있을 때만 계산(없으면 null). 발사체 마법만 필요하다.
    // 자기중심(Nova)은 조준이 필요 없어(§10.1 self) 적이 없어도 아래에서 발동한다.
    const target = this._findNearestEnemy();
    let aim: Vec3 | null = null;
    if (target) {
      aim = new Vec3();
      Vec3.subtract(aim, target.position, this.node.position);
      // 적이 self와 겹쳐 영벡터면 위쪽 폴백.
      if (aim.lengthSqr() < 1e-8) aim.set(0, 1, 0);
      else aim.normalize();
    }

    for (const id of spells) {
      if (!this._scheduler.isReady(id)) continue;
      const spell = DataManager.instance.getSpell(id);
      if (!spell) continue;

      if (spell.pattern === SpellPattern.Nova) {
        // 자기중심 즉발 버스트 — 적 유무와 무관하게 쿨다운마다 발동(조준 불필요).
        this._scheduler.consume(id, DeckManager.instance.effectiveCooldown(spell));
        this._castNova(spell);
        continue;
      }

      if (spell.pattern === SpellPattern.Orbit) {
        // 궤도는 적 유무와 무관하게 쿨다운마다 (재)시전 — 회전·타격은 _advanceOrbits가 매 프레임 처리.
        this._scheduler.consume(id, DeckManager.instance.effectiveCooldown(spell));
        this._castOrbit(spell);
        continue;
      }

      // 발사체 마법은 조준이 필요하다 — 적이 없으면 이 마법만 발사 보류(쿨다운도 유지).
      if (!aim) continue;

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

    // 활성 궤도(인페르노 등)는 패턴 루프와 무관하게 매 프레임 회전·수명·타격을 진행한다.
    this._advanceOrbits(dt);
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

  /**
   * 자기중심 노바를 발동한다 (기획 §9.2 Self-AoE/Nova). 플레이어 위치를 중심으로 유효 반경 안
   * 적에게 1회 피해를 준다. 발사체가 아니며 적 유무와 무관하게 시전된다.
   *
   * 후보 적 질의·dedup·데미지 적용은 `Projectile._detonate`와 같은 경로(`queryEnemiesInRadius`
   * + `selectExplosionHits`)를 재사용한다 — 차이는 중심이 플레이어 위치, 트리거가 시전이라는 점뿐이다.
   * 발사체 수 페널티는 없다(노바는 발사체 수 ❌, §7.6).
   * @param spell 발동 중인 노바 마법
   */
  private _castNova(spell: ISpellData): void {
    if (spell.explosionRadius === undefined) return; // 데이터 방어 — 반경 없으면 발동 불가
    const radius = spell.explosionRadius * DeckManager.instance.rangeFactor(spell);
    const damage = spell.damage * DeckManager.instance.damageFactor(spell);
    const center = this.node.position;

    // 폭발과 동일: 반경으로 후보를 수집(F16 공유 헬퍼)하고, dedup 집합은 1회 버스트라 새로 만든다(§10.2).
    const { targets, ctrls } = GameManager.instance.collectTargetsInRadius(
      center.x,
      center.y,
      radius,
    );
    const hits = selectExplosionHits(center.x, center.y, radius, targets, new Set<number>());
    for (const idx of hits) ctrls[idx].takeDamage(damage);
    this._spawnNovaVfx(center.x, center.y, radius);
  }

  /**
   * 궤도형 마법을 (재)시전한다 (기획 §9.2 Orbit). 강화 반영값을 시전 시점에 스냅샷해 OrbitLogic에 단일
   * 인스턴스로 띄운다. 데미지는 발사체 수 페널티(§7.6)까지 곱한다. 실제 회전·타격은 _advanceOrbits가 한다.
   * 적 유무와 무관하게 발동한다(자기중심 — §10.1 self).
   * @param spell 발동 중인 궤도 마법
   */
  private _castOrbit(spell: ISpellData): void {
    const count = DeckManager.instance.effectiveProjectileCount(spell);
    const orbSize = spell.projectileRadius * DeckManager.instance.rangeFactor(spell);
    const damage =
      spell.damage *
      DeckManager.instance.damageFactor(spell) *
      DeckManager.instance.projectilePenaltyFactor(spell);
    const lifetime = (spell.lifetimeSec ?? 0) * DeckManager.instance.durationFactor(spell);
    this._orbitLogic.spawn(spell.id, {
      count,
      orbSize,
      damage,
      lifetime,
      rotationSpeedDeg: spell.rotationSpeedDeg ?? 0,
    });
  }

  /**
   * 매 프레임 활성 궤도를 전진시킨다 — 회전·수명을 진행하고(OrbitLogic.advance), 각 오브 위치에서 접촉
   * 타격을 적용하며, 오브 VFX를 플레이어 주위로 배치한다. 만료된 궤도의 VFX는 전부 반환한다.
   * @param dt 프레임 델타 (sec)
   */
  private _advanceOrbits(dt: number): void {
    this._orbitLogic.tickRehit(dt);
    const { active, expired } = this._orbitLogic.advance(dt);
    // 에일리어싱 회피 — node.position 내부 벡터를 저장하지 않고 좌표만 매 프레임 읽는다.
    const center = this.node.position;
    const playerRadius = DataManager.instance.playerData.collisionRadius;
    for (const orbit of active) {
      const spell = DataManager.instance.getSpell(orbit.spellId);
      const baseRing = spell?.orbitRadius ?? 0;
      const rehitCooldown = spell?.rehitCooldownSec ?? 0;
      const ring = this._orbitLogic.ringRadius(orbit.count, orbit.orbSize, playerRadius, baseRing);
      const positions = this._orbitLogic.orbPositions(
        orbit.spellId,
        orbit.count,
        ring,
        center.x,
        center.y,
      );
      this._reconcileOrbVfx(orbit.spellId, orbit.count, orbit.orbSize);
      const nodes = this._orbNodes.get(orbit.spellId);
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        this._applyOrbHit(
          orbit.spellId,
          i,
          pos.x,
          pos.y,
          orbit.orbSize,
          orbit.damage,
          rehitCooldown,
        );
        nodes?.[i]?.setPosition(pos.x, pos.y, 0);
      }
    }
    for (const spellId of expired) this._releaseAllOrbVfx(spellId);
  }

  /**
   * 한 오브 위치 반경에 접촉한 적에게 타격을 준다 — (마법, 오브, 적) 짝이 재타격 락아웃에 걸려 있지 않을 때만.
   * 후보 수집은 collectTargetsInRadius(F16 공유), 정밀 판정은 selectExplosionHits를 재사용한다(오브당 새 집합).
   * @param spellId 마법 id (재타격 락아웃 키 — 궤도별 독립)
   * @param orbIndex 오브 인덱스 (재타격 락아웃 키)
   * @param x 오브 중심 x
   * @param y 오브 중심 y
   * @param orbSize 오브 충돌 반경
   * @param damage 타격당 피해
   * @param rehitCooldown 재타격 락아웃 (sec)
   */
  private _applyOrbHit(
    spellId: string,
    orbIndex: number,
    x: number,
    y: number,
    orbSize: number,
    damage: number,
    rehitCooldown: number,
  ): void {
    const { targets, ctrls } = GameManager.instance.collectTargetsInRadius(x, y, orbSize);
    const hits = selectExplosionHits(x, y, orbSize, targets, new Set<number>());
    for (const idx of hits) {
      const spawnId = targets[idx].id;
      if (this._orbitLogic.canHit(spellId, orbIndex, spawnId)) {
        ctrls[idx].takeDamage(damage);
        this._orbitLogic.registerHit(spellId, orbIndex, spawnId, rehitCooldown);
      }
    }
  }

  /**
   * 오브 VFX 노드 수를 count에 맞춘다 (멱등) — 모자라면 풀에서 더 꺼내고, 남으면 반환한다. 각 노드는 오브
   * 크기에 맞춰 스케일한다. 재시전 때 기존 노드를 재사용해 누수를 막는다(§7 A-1). 프리팹 미연결이면 no-op.
   * @param spellId 마법 id
   * @param count 목표 오브 수
   * @param orbSize 오브 크기 (스케일 기준)
   */
  private _reconcileOrbVfx(spellId: string, count: number, orbSize: number): void {
    if (!this._orbVfxPool) return;
    let nodes = this._orbNodes.get(spellId);
    if (!nodes) {
      nodes = [];
      this._orbNodes.set(spellId, nodes);
    }
    while (nodes.length < count) nodes.push(this._orbVfxPool.acquire());
    while (nodes.length > count) {
      const extra = nodes.pop();
      if (extra) this._orbVfxPool.release(extra);
    }
    const s = orbSize / ORB_VFX_BASE_RADIUS;
    for (const node of nodes) node.setScale(s, s, 1);
  }

  /** 한 마법의 오브 VFX 노드를 전부 풀로 반환한다 (활성 수명 만료 시). */
  private _releaseAllOrbVfx(spellId: string): void {
    const nodes = this._orbNodes.get(spellId);
    if (!nodes) return;
    if (this._orbVfxPool) {
      for (const node of nodes) this._orbVfxPool.release(node);
    }
    this._orbNodes.delete(spellId);
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
