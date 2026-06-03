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

/** 일반 옵션이 적용되는 분류 (보조 분류는 일반 5종 옵션 제외 — § 7.5) */
const GENERAL_OPTION_CATEGORIES: SpellCategory[] = [
  SpellCategory.Fire,
  SpellCategory.Ice,
  SpellCategory.Lightning,
];

/**
 * 이번 슬라이스에서 카드로 생성·적용하는 옵션 (기획 § 8 매트릭스).
 * 데미지·쿨다운은 모든 비-보조 공격 마법이 ✅. 발사체수/범위/지속시간은 후속.
 */
const SLICE_OPTIONS: UpgradeOption[] = [UpgradeOption.Damage, UpgradeOption.Cooldown];

/** 분류가 일반 강화 옵션을 허용하는지 (보조 분류는 제외 § 7.5) */
function generalOptions(category: SpellCategory): UpgradeOption[] {
  return category === SpellCategory.Support ? [] : SLICE_OPTIONS;
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
    const indiv = curveAt(
      INDIVIDUAL_CURVE,
      this.getLevel(UpgradeTrack.Individual, spell.id, option),
    );
    const cat = curveAt(
      CATEGORY_CURVE,
      this.getLevel(UpgradeTrack.Category, spell.category, option),
    );
    const global = 1 + (this._global.get(option) ?? 0);
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
      for (const option of generalOptions(spell.category)) {
        if (this.getLevel(UpgradeTrack.Individual, spell.id, option) >= UPGRADE_CAP) continue;
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
      for (const option of generalOptions(category)) {
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
