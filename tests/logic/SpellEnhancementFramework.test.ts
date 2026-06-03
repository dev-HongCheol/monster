import { describe, expect, it } from 'vitest';
import {
  type ISpellData,
  SpellCategory,
  SpellPattern,
  UpgradeOption,
  UpgradeTrack,
} from '../../game/assets/scripts/data/GameTypes';
import {
  CATEGORY_CURVE,
  EnhancementLogic,
  INDIVIDUAL_CURVE,
  MIN_COOLDOWN_SEC,
  UPGRADE_CAP,
} from '../../game/assets/scripts/logic/EnhancementLogic';

const makeSpell = (id: string, category = SpellCategory.Fire): ISpellData => ({
  id,
  category,
  tier: 1,
  damage: 10,
  projectileSpeed: 400,
  projectileRadius: 8,
  cooldown: 0.5,
  projectileCount: 1,
  pattern: SpellPattern.Directional,
});

const fireball = makeSpell('fireball', SpellCategory.Fire);
const iceMissile = makeSpell('ice_missile', SpellCategory.Ice);

describe('EnhancementLogic — 레벨 상태', () => {
  it('초기 레벨은 0이고 배율은 1.0이다', () => {
    const e = new EnhancementLogic();
    expect(e.getLevel(UpgradeTrack.Individual, 'fireball', UpgradeOption.Damage)).toBe(0);
    expect(e.factor(fireball, UpgradeOption.Damage)).toBe(1);
  });

  it('raise는 레벨을 +1 하고 true를 반환한다', () => {
    const e = new EnhancementLogic();
    expect(e.raise(UpgradeTrack.Individual, 'fireball', UpgradeOption.Damage)).toBe(true);
    expect(e.getLevel(UpgradeTrack.Individual, 'fireball', UpgradeOption.Damage)).toBe(1);
  });

  it('cap(4) 도달 후 raise는 false를 반환하고 레벨이 4를 넘지 않는다', () => {
    const e = new EnhancementLogic();
    for (let i = 0; i < UPGRADE_CAP; i++) {
      expect(e.raise(UpgradeTrack.Category, SpellCategory.Fire, UpgradeOption.Damage)).toBe(true);
    }
    expect(e.raise(UpgradeTrack.Category, SpellCategory.Fire, UpgradeOption.Damage)).toBe(false);
    expect(e.getLevel(UpgradeTrack.Category, SpellCategory.Fire, UpgradeOption.Damage)).toBe(
      UPGRADE_CAP,
    );
  });
});

describe('EnhancementLogic — 배율 합산(§7.3 곱셈)', () => {
  it('factor = 개별 곡선 × 분류 곡선 × (1 + 전역 보너스)', () => {
    const e = new EnhancementLogic();
    e.raise(UpgradeTrack.Individual, 'fireball', UpgradeOption.Damage); // 개별 lv1
    expect(e.factor(fireball, UpgradeOption.Damage)).toBeCloseTo(INDIVIDUAL_CURVE[1]);

    e.raise(UpgradeTrack.Category, SpellCategory.Fire, UpgradeOption.Damage); // 분류 lv1
    expect(e.factor(fireball, UpgradeOption.Damage)).toBeCloseTo(
      INDIVIDUAL_CURVE[1] * CATEGORY_CURVE[1],
    );

    e.addGlobal(UpgradeOption.Damage, 0.05); // 전역 +5%
    expect(e.factor(fireball, UpgradeOption.Damage)).toBeCloseTo(
      INDIVIDUAL_CURVE[1] * CATEGORY_CURVE[1] * 1.05,
    );
  });

  it('강화 위계: 개별 > 분류 > 전역 (레벨1 1회 강화 기준 §7.3)', () => {
    const indiv = new EnhancementLogic();
    indiv.raise(UpgradeTrack.Individual, 'fireball', UpgradeOption.Damage);
    const cat = new EnhancementLogic();
    cat.raise(UpgradeTrack.Category, SpellCategory.Fire, UpgradeOption.Damage);
    const glob = new EnhancementLogic();
    glob.addGlobal(UpgradeOption.Damage, 0.05);

    const fIndiv = indiv.damageFactor(fireball);
    const fCat = cat.damageFactor(fireball);
    const fGlobal = glob.damageFactor(fireball);
    expect(fIndiv).toBeGreaterThan(fCat);
    expect(fCat).toBeGreaterThan(fGlobal);
    expect(fGlobal).toBeGreaterThan(1);
  });

  it('전역 강화는 모든 마법에 공통 적용된다', () => {
    const e = new EnhancementLogic();
    e.addGlobal(UpgradeOption.Damage, 0.05);
    expect(e.damageFactor(fireball)).toBeCloseTo(1.05);
    expect(e.damageFactor(iceMissile)).toBeCloseTo(1.05);
  });

  it('damageFactor/cooldownFactor 편의 접근이 옵션별 factor와 일치한다', () => {
    const e = new EnhancementLogic();
    e.raise(UpgradeTrack.Individual, 'fireball', UpgradeOption.Cooldown);
    expect(e.cooldownFactor(fireball)).toBeCloseTo(e.factor(fireball, UpgradeOption.Cooldown));
    expect(e.cooldownFactor(fireball)).toBeCloseTo(INDIVIDUAL_CURVE[1]);
    expect(e.damageFactor(fireball)).toBe(1); // 데미지는 강화 안 했으므로 1
  });

  it('개별·분류 트랙은 독립이고, 옵션 간에도 독립이다', () => {
    const e = new EnhancementLogic();
    e.raise(UpgradeTrack.Individual, 'fireball', UpgradeOption.Damage);
    // 분류 트랙 미강화 → 분류 레벨 0
    expect(e.getLevel(UpgradeTrack.Category, SpellCategory.Fire, UpgradeOption.Damage)).toBe(0);
    // 쿨다운 옵션 미강화 → 쿨다운 배율 1
    expect(e.cooldownFactor(fireball)).toBe(1);
    // 다른 마법(ice_missile)은 영향 없음
    expect(e.damageFactor(iceMissile)).toBe(1);
  });
});

describe('EnhancementLogic.effectiveCooldown — 쿨다운 나눗셈 방향 + 하한', () => {
  it('강화 없으면 기본 쿨다운 그대로', () => {
    const e = new EnhancementLogic();
    expect(e.effectiveCooldown(fireball, 0.5)).toBeCloseTo(0.5);
  });

  it('쿨다운 강화는 기본을 배율로 나눈다 (배율↑ = 간격↓)', () => {
    const e = new EnhancementLogic();
    e.raise(UpgradeTrack.Individual, 'fireball', UpgradeOption.Cooldown); // 배율 INDIVIDUAL_CURVE[1]
    const cd = e.effectiveCooldown(fireball, 0.5);
    expect(cd).toBeCloseTo(0.5 / INDIVIDUAL_CURVE[1]);
    expect(cd).toBeLessThan(0.5); // 반드시 짧아진다(방향 고정 — `*`로 뒤집히면 실패)
  });

  it('아무리 강화해도 MIN_COOLDOWN_SEC 아래로 내려가지 않는다', () => {
    const e = new EnhancementLogic();
    for (let i = 0; i < UPGRADE_CAP; i++) {
      e.raise(UpgradeTrack.Individual, 'fireball', UpgradeOption.Cooldown);
      e.raise(UpgradeTrack.Category, SpellCategory.Fire, UpgradeOption.Cooldown);
    }
    expect(e.effectiveCooldown(fireball, 0.05)).toBe(MIN_COOLDOWN_SEC);
  });

  it('전역 보너스 ≤ -1이어도 factor가 0/음수로 떨어지지 않는다(방어)', () => {
    const e = new EnhancementLogic();
    e.addGlobal(UpgradeOption.Damage, -2); // (1 + -2) = -1 → 클램프
    expect(e.damageFactor(fireball)).toBeGreaterThan(0);
    e.addGlobal(UpgradeOption.Cooldown, -5);
    const cd = e.effectiveCooldown(fireball, 0.5);
    expect(Number.isFinite(cd)).toBe(true);
    expect(cd).toBeGreaterThan(0);
  });
});

describe('EnhancementLogic.buildUpgradeCards — 카드 동적 생성', () => {
  it('보유 마법 × {damage,cooldown} 개별 카드 + fire/ice/lightning × {damage,cooldown} 분류 카드를 만든다', () => {
    const e = new EnhancementLogic();
    const cards = e.buildUpgradeCards([fireball, iceMissile]);
    // 개별 2마법 × 2옵션 = 4, 분류 3개 × 2옵션 = 6
    const individual = cards.filter((c) => c.effect.upgrade?.track === UpgradeTrack.Individual);
    const category = cards.filter((c) => c.effect.upgrade?.track === UpgradeTrack.Category);
    expect(individual).toHaveLength(4);
    expect(category).toHaveLength(6);
    expect(cards.every((c) => c.type === 'upgrade')).toBe(true);
  });

  it('개별 카드의 effect/id 규칙', () => {
    const e = new EnhancementLogic();
    const cards = e.buildUpgradeCards([fireball]);
    const dmg = cards.find((c) => c.id === 'upg_fireball_damage');
    expect(dmg).toBeDefined();
    expect(dmg?.effect.upgrade).toEqual({
      track: UpgradeTrack.Individual,
      option: UpgradeOption.Damage,
      target: 'fireball',
    });
  });

  it('레벨4(maxed) 옵션은 카드 풀에서 제외된다', () => {
    const e = new EnhancementLogic();
    for (let i = 0; i < UPGRADE_CAP; i++) {
      e.raise(UpgradeTrack.Individual, 'fireball', UpgradeOption.Damage);
      e.raise(UpgradeTrack.Category, SpellCategory.Fire, UpgradeOption.Damage);
    }
    const ids = e.buildUpgradeCards([fireball]).map((c) => c.id);
    expect(ids).not.toContain('upg_fireball_damage');
    expect(ids).not.toContain('cupg_fire_damage');
    // 같은 마법/분류의 다른 옵션(cooldown)은 남는다
    expect(ids).toContain('upg_fireball_cooldown');
    expect(ids).toContain('cupg_fire_cooldown');
  });

  it('support 마법·보조 분류는 일반 옵션 카드에서 제외된다(§7.5)', () => {
    const e = new EnhancementLogic();
    const support = makeSpell('double_cast', SpellCategory.Support);
    const cards = e.buildUpgradeCards([fireball, support]);
    const ids = cards.map((c) => c.id);
    // support 마법 개별 카드 없음
    expect(ids.some((id) => id.includes('double_cast'))).toBe(false);
    // support 분류 카드 없음
    expect(ids.some((id) => id.startsWith('cupg_support'))).toBe(false);
  });

  it('upgrade 카드는 한글 표시 문자열 없이 키/params만 산출한다(i18n)', () => {
    const e = new EnhancementLogic();
    const cards = e.buildUpgradeCards([fireball]);
    const dmg = cards.find((c) => c.id === 'upg_fireball_damage');
    expect(dmg?.nameKey).toBe('card.spell_upgrade.name');
    expect(dmg?.descKey).toBe('card.spell_upgrade.desc');
    expect(dmg?.descParams).toEqual({ spell: 'spell.fireball.name', option: 'upgrade.damage' });

    const cat = cards.find((c) => c.id === 'cupg_fire_damage');
    expect(cat?.descParams).toEqual({ category: 'category.fire', option: 'upgrade.damage' });

    expect(JSON.stringify(cards)).not.toContain('강화');
  });
});
