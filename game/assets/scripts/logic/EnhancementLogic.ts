import {
  type ICardData,
  type ISpellData,
  SpellCategory,
  UpgradeOption,
  UpgradeTrack,
} from '../data/GameTypes';

/** 강화 레벨 상한 (기획 § 7.2) — 옵션별 0~4레벨 */
export const UPGRADE_CAP = 4;

/**
 * 비선형 가속 곡선 (기획 § 7.4) — level → 누적 배율. 데미지는 곱(↑), 쿨다운은 나눗셈(간격↓).
 *
 * **강화 위계: 개별 > 분류 > 전역(플레이어).** 적용 범위가 좁을수록 레벨당 값이 크다 —
 * 개별(마법 1종) > 분류(분류 전체) > 전역(모든 마법). 정확한 수치는 밸런싱 단계에서 확정(§ 10).
 */
export const INDIVIDUAL_CURVE = [1.0, 1.3, 1.65, 2.05, 2.5];
/** 분류 강화 곡선 — 개별보다 작고 전역보다 큼 (§ 7.4 예시 기준) */
export const CATEGORY_CURVE = [1.0, 1.2, 1.4, 1.7, 2.05];

/** 강화로 쿨다운이 줄어도 내려가지 않는 하한 (sec) — factor가 커져도 발사 간격 0 방지 */
export const MIN_COOLDOWN_SEC = 0.05;

/**
 * 전역 배율 `(1 + 보너스)`의 하한. 향후 디버프성 전역 보너스(≤ -1)가 들어와도
 * factor가 0/음수가 되어 쿨다운 div-by-zero·음수가 나는 것을 막는다.
 */
const MIN_GLOBAL_MULT = 0.05;

/**
 * 발사체당 데미지 페널티 비율 r (기획 §7.6 초안값 ~10%). 발사체를 늘릴수록 발사체 하나의
 * 데미지가 `r × 증가수`만큼 감소해 "다발 = 군집 이득·단일 손해" 트레이드오프를 만든다.
 * **정확한 값은 밸런싱 단계(로드맵 11-12주)에서 확정.**
 *
 * 참고: 다발이 전부 명중할 때 총출력 `(1+증가수)×(1−r×증가수)`는 증가수≈4.5에서 정점(×3.0) 후
 * cap(8)에서 ×1.8로 하락한다(의도된 diminishing-returns — 버그 아님).
 */
export const PROJECTILE_DAMAGE_PENALTY_R = 0.1;

/** 발사체당 데미지 페널티 하한 — 페널티가 0/음수가 되지 않도록 방어(현 r·cap에선 미발동). */
const MIN_PROJECTILE_PENALTY = 0.05;

/**
 * 발사체 증가수에 대한 발사체당 데미지 페널티 배율 `×(1 − r×증가수)` (§7.6). 하한 클램프.
 * 순수 함수로 분리해 범위 밖 증가수로 하한 도달까지 단위 테스트 가능하게 한다.
 * @param bonus 강화로 늘어난 발사체 수(기본 발사체는 페널티 없음)
 */
export function penaltyFor(bonus: number): number {
  // 상한 1(음수 bonus가 데미지 부스트가 되지 않게), 하한 MIN(0/음수 방어). 정상 bonus는 0~8.
  return Math.min(1, Math.max(MIN_PROJECTILE_PENALTY, 1 - PROJECTILE_DAMAGE_PENALTY_R * bonus));
}

/** 일반 옵션이 적용되는 분류 (보조 분류는 일반 5종 옵션 제외 — § 7.5) */
const GENERAL_OPTION_CATEGORIES: SpellCategory[] = [
  SpellCategory.Fire,
  SpellCategory.Ice,
  SpellCategory.Lightning,
];

/**
 * 카드로 생성·적용하는 옵션 (기획 § 8 매트릭스).
 * 데미지·쿨다운은 모든 비-보조 공격 마법이 ✅. 발사체 수는 자기중심 AOE만 ❌(§8 게이트).
 * 범위·지속시간은 splash/AOE/DOT 레이어 후속.
 */
export const SLICE_OPTIONS: UpgradeOption[] = [
  UpgradeOption.Damage,
  UpgradeOption.Cooldown,
  UpgradeOption.ProjectileCount,
];

/**
 * 카드 라벨로 등장할 수 있는 강화 옵션 — i18n `upgrade.<opt>` 키가 존재해야 하는 집합.
 * 항상 켜진 SLICE_OPTIONS + 조건부 범위(Range, 반경류 마법만)·지속(Duration, CC·DOT 마법만).
 * i18n 키 정합 가드의 도메인이다.
 */
export const CARD_LABEL_OPTIONS: UpgradeOption[] = [
  ...SLICE_OPTIONS,
  UpgradeOption.Range,
  UpgradeOption.Duration,
];

/** 분류가 일반 강화 옵션을 허용하는지 (보조 분류는 제외 § 7.5) */
function generalOptions(category: SpellCategory): UpgradeOption[] {
  return category === SpellCategory.Support ? [] : SLICE_OPTIONS;
}

/**
 * 범위(Range) 강화 적격 여부 (기획 §10.3 A3 게이트). 폭발 반경 등 반경류 효과를 실제로
 * 가진 마법만 범위 카드를 만든다. 적격 기준은 `explosionRadius`(폭발·노바 반경) 또는
 * `orbitRadius`(궤도 — 범위 강화가 오브 크기를 키운다) 보유.
 */
function isRangeCapable(spell: ISpellData): boolean {
  return spell.explosionRadius !== undefined || spell.orbitRadius !== undefined;
}

/**
 * 지속시간(Duration) 강화 적격 여부 (기획 §10.3 A3 게이트). 지속 효과를 실제로 가진 마법만
 * 지속 카드를 만든다. 적격 기준은 `onHitStatus`(CC 지속) 또는 `lifetimeSec`(궤도 활성 수명 — 인페르노) 보유.
 */
function isDurationCapable(spell: ISpellData): boolean {
  return spell.onHitStatus !== undefined || spell.lifetimeSec !== undefined;
}

/** 개별 마법에 적용할 강화 옵션 — 일반 3종 + (반경류면) 범위 + (지속류면) 지속(§10.3 A3). */
function individualOptionsFor(spell: ISpellData): UpgradeOption[] {
  const base = generalOptions(spell.category);
  if (base.length === 0) return base;
  const opts = [...base];
  if (isRangeCapable(spell)) opts.push(UpgradeOption.Range);
  if (isDurationCapable(spell)) opts.push(UpgradeOption.Duration);
  return opts;
}

/** 분류에 적용할 강화 옵션 — 일반 3종 + (분류에 반경류 있으면) 범위 + (지속류 있으면) 지속(§10.3 A3). */
function categoryOptionsFor(category: SpellCategory, ownedSpells: ISpellData[]): UpgradeOption[] {
  const base = generalOptions(category);
  if (base.length === 0) return base;
  const opts = [...base];
  if (ownedSpells.some((s) => s.category === category && isRangeCapable(s))) {
    opts.push(UpgradeOption.Range);
  }
  if (ownedSpells.some((s) => s.category === category && isDurationCapable(s))) {
    opts.push(UpgradeOption.Duration);
  }
  return opts;
}

/** 디버그 로그용 마법 한 줄 스냅샷 (수치만 — 표시/포맷은 UI 책임) */
export interface EnhancementDebugRow {
  /** 마법 id */
  id: string;
  /** 기본 데미지 */
  baseDamage: number;
  /** 기본 쿨다운(sec) */
  baseCooldown: number;
  /** 개별 데미지 레벨 */
  indivDmgLevel: number;
  /** 분류 데미지 레벨 */
  catDmgLevel: number;
  /** 데미지 배율 = 개별 × 분류 × (1+전역) */
  damageFactor: number;
  /** 최종 데미지 = 기본 × 데미지 배율 */
  effDamage: number;
  /** 개별 쿨다운 레벨 */
  indivCdLevel: number;
  /** 분류 쿨다운 레벨 */
  catCdLevel: number;
  /** 쿨다운 배율 = 개별 × 분류 × (1+전역) */
  cooldownFactor: number;
  /** 최종 쿨다운(sec) = 기본 ÷ 쿨다운 배율(하한 적용) */
  effCooldown: number;
  /** 초당 데미지 = 최종 데미지 / 최종 쿨다운 */
  dps: number;
  /** 발사체 수 강화 보너스(개별+분류 가산) */
  projectileBonus: number;
  /** 발사체당 데미지 페널티 배율 `×(1−r×증가수)` */
  projectilePenalty: number;
  /** 유효 발사체 수 = 기본 + 보너스 */
  effProjectileCount: number;
}

/** 디버그 스냅샷 — 마법별 행 + 전역 보너스 */
export interface EnhancementDebugSnapshot {
  rows: EnhancementDebugRow[];
  /** 전역 데미지 보너스 (예: 0.05) */
  globalDamageBonus: number;
  /** 전역 쿨다운 보너스 */
  globalCooldownBonus: number;
}

/** level을 안전 인덱스로 클램프해 주어진 곡선의 배율을 반환한다. */
function curveAt(curve: number[], level: number): number {
  const i = Math.max(0, Math.min(level, UPGRADE_CAP));
  return curve[i];
}

/**
 * 마법 강화 합산(개별·분류·전역)과 배율·카드 생성을 담당하는 순수 로직 — cc import 없음.
 *
 * 기획 § 6.1·§ 7 근거:
 * - 개별·분류 두 트랙을 옵션별 0~4레벨로 독립 관리(§ 7.2)
 * - 전역(플레이어) 강화는 카드 누적 보너스 — 위계상 개별·분류보다 작다(§ 7.3 플레이어 항)
 * - 같은 stat 배율은 곱셈 합산: `factor = 개별 곡선 × 분류 곡선 × (1 + 전역 보너스)`(§ 7.3)
 * - 강화 카드는 보유 마법·분류 × 허용 옵션에서 동적 합성, maxed·보조는 제외(§ 6.2·§ 7.5)
 */
export class EnhancementLogic {
  /** 트랙별 레벨: key(개별=spellId / 분류=category) → option → level */
  private _individual = new Map<string, Map<UpgradeOption, number>>();
  private _category = new Map<string, Map<UpgradeOption, number>>();
  /** 전역(플레이어) 강화 보너스: option → 누적 보너스(factor = 1 + 보너스). 모든 마법 공통 */
  private _global = new Map<UpgradeOption, number>();

  /**
   * 트랙·키·옵션의 현재 강화 레벨을 반환한다 (미강화는 0).
   * @param track 개별 / 분류
   * @param key 개별=마법 id, 분류=분류 값(SpellCategory)
   * @param option 강화 옵션
   */
  getLevel(track: UpgradeTrack, key: string, option: UpgradeOption): number {
    return this._map(track).get(key)?.get(option) ?? 0;
  }

  /**
   * 레벨을 +1 올린다. cap(4)에 도달해 있으면 올리지 않고 false를 반환한다.
   * @param track 개별 / 분류
   * @param key 개별=마법 id, 분류=분류 값
   * @param option 강화 옵션
   * @returns 실제로 올랐으면 true, 이미 maxed면 false
   */
  raise(track: UpgradeTrack, key: string, option: UpgradeOption): boolean {
    const current = this.getLevel(track, key, option);
    if (current >= UPGRADE_CAP) return false;
    const map = this._map(track);
    let options = map.get(key);
    if (!options) {
      options = new Map();
      map.set(key, options);
    }
    options.set(option, current + 1);
    return true;
  }

  /**
   * 전역(플레이어) 강화 보너스를 누적한다 (모든 마법 공통, 위계상 가장 작음).
   * @param option 강화 옵션 (데미지/쿨다운)
   * @param bonus factor 가산 보너스 (예: 0.05 → ×1.05)
   */
  addGlobal(option: UpgradeOption, bonus: number): void {
    this._global.set(option, (this._global.get(option) ?? 0) + bonus);
  }

  /**
   * 마법의 한 옵션에 대한 최종 강화 배율 = 개별 곡선 × 분류 곡선 × (1 + 전역 보너스) (§ 7.3 곱셈).
   * @param spell 대상 마법 (개별 키=id, 분류 키=category)
   * @param option 강화 옵션
   */
  factor(spell: ISpellData, option: UpgradeOption): number {
    // factor()는 곱셈 곡선 옵션(데미지·쿨다운) 전용이다. 발사체 수는 가산(+1)이라 곡선 배율을
    // 적용하면 안 된다 — projectileBonus/projectilePenaltyFactor 경로를 쓴다(§7.6).
    console.assert(
      option !== UpgradeOption.ProjectileCount,
      '[EnhancementLogic] factor()는 발사체 수에 쓰지 않는다 — projectileBonus를 사용',
    );
    const indiv = curveAt(
      INDIVIDUAL_CURVE,
      this.getLevel(UpgradeTrack.Individual, spell.id, option),
    );
    const cat = curveAt(
      CATEGORY_CURVE,
      this.getLevel(UpgradeTrack.Category, spell.category, option),
    );
    // 전역 배율은 0/음수 방지 하한으로 클램프 (디버프성 보너스 방어)
    const global = Math.max(MIN_GLOBAL_MULT, 1 + (this._global.get(option) ?? 0));
    return indiv * cat * global;
  }

  /** 마법의 데미지 배율 (기본 데미지에 곱한다). */
  damageFactor(spell: ISpellData): number {
    return this.factor(spell, UpgradeOption.Damage);
  }

  /** 마법의 쿨다운 배율 (기본 쿨다운을 이 값으로 나눈다 → 간격 단축). */
  cooldownFactor(spell: ISpellData): number {
    return this.factor(spell, UpgradeOption.Cooldown);
  }

  /**
   * 강화 반영 후 실제 쿨다운(sec)을 계산한다 — `기본 ÷ 쿨다운 배율`, 하한 클램프.
   * 핵심 불변(배율↑ = 간격↓)을 순수 로직에 담아 단위 테스트로 고정한다.
   * @param spell 대상 마법
   * @param baseCooldown 기본 쿨다운(sec) — 보통 `spell.cooldown`
   */
  effectiveCooldown(spell: ISpellData, baseCooldown: number): number {
    return Math.max(baseCooldown / this.cooldownFactor(spell), MIN_COOLDOWN_SEC);
  }

  /**
   * 발사체 수 강화 보너스 = 개별 레벨 + 분류 레벨 (가산, §7.6 — 곡선·전역 없음).
   * 데미지/쿨다운과 달리 레벨당 +1 발사체이고 전역 트랙이 없다.
   * @param spell 대상 마법 (개별 키=id, 분류 키=category)
   */
  projectileBonus(spell: ISpellData): number {
    // §8 게이트(소스): 자기중심 AOE는 발사체 보너스 0 — 분류 트랙으로도 새지 않게 한 점에서 막는다.
    if (spell.allowsProjectileCount === false) return 0;
    return (
      this.getLevel(UpgradeTrack.Individual, spell.id, UpgradeOption.ProjectileCount) +
      this.getLevel(UpgradeTrack.Category, spell.category, UpgradeOption.ProjectileCount)
    );
  }

  /** 강화 반영 후 유효 발사체 수 = 기본 발사체 수 + 발사체 보너스. caster가 패턴 엔진에 넘긴다. */
  effectiveProjectileCount(spell: ISpellData): number {
    return spell.projectileCount + this.projectileBonus(spell);
  }

  /** 마법의 발사체당 데미지 페널티 배율 `×(1−r×증가수)` (§7.6). 기본 데미지에 곱한다. */
  projectilePenaltyFactor(spell: ISpellData): number {
    return penaltyFor(this.projectileBonus(spell));
  }

  /** 전역(플레이어) 강화 보너스 값 (factor = 1 + 보너스). 미강화는 0. */
  globalBonus(option: UpgradeOption): number {
    return this._global.get(option) ?? 0;
  }

  /**
   * 디버그 로그용 수치 스냅샷을 만든다 — 마법별 레벨·배율·최종값·DPS + 전역 보너스.
   * 표시명/포맷/console 출력은 UI(CardSelectPanel) 책임. 여기선 숫자만 산출(테스트 가능).
   * @param spells 보유 마법 데이터 (출력 순서 보존)
   */
  debugSnapshot(spells: ISpellData[]): EnhancementDebugSnapshot {
    const rows: EnhancementDebugRow[] = spells.map((spell) => {
      const damageFactor = this.damageFactor(spell);
      const cooldownFactor = this.cooldownFactor(spell);
      const effDamage = spell.damage * damageFactor;
      const effCooldown = this.effectiveCooldown(spell, spell.cooldown);
      return {
        id: spell.id,
        baseDamage: spell.damage,
        baseCooldown: spell.cooldown,
        indivDmgLevel: this.getLevel(UpgradeTrack.Individual, spell.id, UpgradeOption.Damage),
        catDmgLevel: this.getLevel(UpgradeTrack.Category, spell.category, UpgradeOption.Damage),
        damageFactor,
        effDamage,
        indivCdLevel: this.getLevel(UpgradeTrack.Individual, spell.id, UpgradeOption.Cooldown),
        catCdLevel: this.getLevel(UpgradeTrack.Category, spell.category, UpgradeOption.Cooldown),
        cooldownFactor,
        effCooldown,
        dps: effDamage / effCooldown,
        projectileBonus: this.projectileBonus(spell),
        projectilePenalty: this.projectilePenaltyFactor(spell),
        effProjectileCount: this.effectiveProjectileCount(spell),
      };
    });
    return {
      rows,
      globalDamageBonus: this.globalBonus(UpgradeOption.Damage),
      globalCooldownBonus: this.globalBonus(UpgradeOption.Cooldown),
    };
  }

  /**
   * 보유 마법·분류로 강화 카드 풀을 동적 합성한다 (기획 § 6.1·§ 6.2).
   *
   * - 개별 카드: 보유 마법 × 허용 옵션 (§ 8 매트릭스, 보조 마법 제외 § 7.5)
   * - 분류 카드: 비-보조 분류 × 허용 옵션 (미보유 분류라도 등장 § 6.2)
   * - 양 트랙 모두 **레벨 4 도달 옵션은 제외**(§ 6.2)
   * 표시는 키/params만 산출하고 결합 해석은 UI(`CardSelectPanel`)가 t()로 한다(i18n).
   * @param ownedSpells 현재 로드아웃 보유 마법 데이터
   */
  buildUpgradeCards(ownedSpells: ISpellData[]): ICardData[] {
    const cards: ICardData[] = [];

    for (const spell of ownedSpells) {
      for (const option of individualOptionsFor(spell)) {
        if (this.getLevel(UpgradeTrack.Individual, spell.id, option) >= UPGRADE_CAP) continue;
        // §8 게이트: 자기중심 AOE 마법(allowsProjectileCount=false)은 발사체 수 카드 제외.
        if (option === UpgradeOption.ProjectileCount && spell.allowsProjectileCount === false) {
          continue;
        }
        cards.push({
          id: `upg_${spell.id}_${option}`,
          type: 'upgrade',
          effect: { upgrade: { track: UpgradeTrack.Individual, option, target: spell.id } },
          nameKey: 'card.spell_upgrade.name',
          descKey: 'card.spell_upgrade.desc',
          descParams: { spell: `spell.${spell.id}.name`, option: `upgrade.${option}` },
        });
      }
    }

    for (const category of GENERAL_OPTION_CATEGORIES) {
      for (const option of categoryOptionsFor(category, ownedSpells)) {
        if (this.getLevel(UpgradeTrack.Category, category, option) >= UPGRADE_CAP) continue;
        cards.push({
          id: `cupg_${category}_${option}`,
          type: 'upgrade',
          effect: { upgrade: { track: UpgradeTrack.Category, option, target: category } },
          nameKey: 'card.category_upgrade.name',
          descKey: 'card.category_upgrade.desc',
          descParams: { category: `category.${category}`, option: `upgrade.${option}` },
        });
      }
    }

    return cards;
  }

  /** 트랙에 해당하는 내부 맵을 반환한다. */
  private _map(track: UpgradeTrack): Map<string, Map<UpgradeOption, number>> {
    return track === UpgradeTrack.Individual ? this._individual : this._category;
  }
}
