import { describe, expect, it } from 'vitest';
import {
  type ISpellData,
  SpellCategory,
  SpellPattern,
  UpgradeOption,
  UpgradeTrack,
} from '../../game/assets/scripts/data/GameTypes';
import {
  EnhancementLogic,
  PROJECTILE_DAMAGE_PENALTY_R,
  penaltyFor,
  UPGRADE_CAP,
} from '../../game/assets/scripts/logic/EnhancementLogic';

const makeSpell = (
  id: string,
  category = SpellCategory.Fire,
  overrides: Partial<ISpellData> = {},
): ISpellData => ({
  id,
  category,
  tier: 1,
  damage: 10,
  projectileSpeed: 400,
  projectileRadius: 8,
  cooldown: 0.5,
  projectileCount: 1,
  pattern: SpellPattern.Directional,
  ...overrides,
});

const fireball = makeSpell('fireball', SpellCategory.Fire);
const iceMissile = makeSpell('ice_missile', SpellCategory.Ice);
/** 자기중심 AOE — 발사체 수 강화 ❌ (§8) */
const inferno = makeSpell('inferno', SpellCategory.Fire, { allowsProjectileCount: false });

const PC = UpgradeOption.ProjectileCount;

describe('EnhancementLogic — 발사체 수 보너스 (§7.6 가산)', () => {
  it('초기 발사체 보너스는 0이다', () => {
    const e = new EnhancementLogic();
    expect(e.projectileBonus(fireball)).toBe(0);
  });

  it('개별 + 분류 레벨을 가산한다 (곡선 아님, +1 가산)', () => {
    const e = new EnhancementLogic();
    e.raise(UpgradeTrack.Individual, 'fireball', PC); // 개별 +1
    e.raise(UpgradeTrack.Category, SpellCategory.Fire, PC); // 분류 +1
    expect(e.projectileBonus(fireball)).toBe(2);
  });

  it('각 트랙 cap 4 → 최대 보너스 8', () => {
    const e = new EnhancementLogic();
    for (let i = 0; i < UPGRADE_CAP; i++) {
      e.raise(UpgradeTrack.Individual, 'fireball', PC);
      e.raise(UpgradeTrack.Category, SpellCategory.Fire, PC);
    }
    expect(e.projectileBonus(fireball)).toBe(8);
  });

  it('다른 분류 마법에는 분류 보너스가 적용되지 않는다', () => {
    const e = new EnhancementLogic();
    e.raise(UpgradeTrack.Category, SpellCategory.Fire, PC);
    expect(e.projectileBonus(fireball)).toBe(1);
    expect(e.projectileBonus(iceMissile)).toBe(0);
  });
});

describe('EnhancementLogic — 유효 발사체 수', () => {
  it('effectiveProjectileCount = 기본 + 보너스', () => {
    const e = new EnhancementLogic();
    e.raise(UpgradeTrack.Individual, 'fireball', PC);
    e.raise(UpgradeTrack.Category, SpellCategory.Fire, PC);
    expect(e.effectiveProjectileCount(fireball)).toBe(1 + 2); // base 1 + bonus 2
  });

  it('보너스 0이면 유효 발사체 수는 기본값과 같다 (회귀)', () => {
    const e = new EnhancementLogic();
    expect(e.effectiveProjectileCount(fireball)).toBe(fireball.projectileCount);
  });
});

describe('penaltyFor — 발사체당 데미지 페널티 (§7.6)', () => {
  it('r = 0.10 (초안값)', () => {
    expect(PROJECTILE_DAMAGE_PENALTY_R).toBeCloseTo(0.1);
  });

  it('보너스 0 → 페널티 없음(1.0)', () => {
    expect(penaltyFor(0)).toBeCloseTo(1.0);
  });

  it('×(1 − 0.10 × 증가수)', () => {
    expect(penaltyFor(1)).toBeCloseTo(0.9);
    expect(penaltyFor(2)).toBeCloseTo(0.8);
    expect(penaltyFor(4)).toBeCloseTo(0.6);
    expect(penaltyFor(8)).toBeCloseTo(0.2); // cap8: 하한 미발동
  });

  it('범위 밖 큰 보너스는 하한으로 클램프된다(음수/0 방어)', () => {
    expect(penaltyFor(100)).toBeGreaterThan(0); // 1 - 10 = -9 → 클램프
  });
});

describe('EnhancementLogic — projectilePenaltyFactor(spell)', () => {
  it('= penaltyFor(projectileBonus(spell))', () => {
    const e = new EnhancementLogic();
    e.raise(UpgradeTrack.Individual, 'fireball', PC);
    e.raise(UpgradeTrack.Category, SpellCategory.Fire, PC); // bonus 2
    expect(e.projectilePenaltyFactor(fireball)).toBeCloseTo(0.8);
  });

  it('보너스 0이면 1.0 (회귀)', () => {
    const e = new EnhancementLogic();
    expect(e.projectilePenaltyFactor(fireball)).toBeCloseTo(1.0);
  });
});

describe('EnhancementLogic — 발사체 카드 생성 (개별·분류, 전역 없음)', () => {
  it('보유 마법의 개별 발사체 카드를 생성한다', () => {
    const e = new EnhancementLogic();
    const cards = e.buildUpgradeCards([fireball]);
    const indiv = cards.filter(
      (c) =>
        c.effect.upgrade?.track === UpgradeTrack.Individual &&
        c.effect.upgrade?.option === PC &&
        c.effect.upgrade?.target === 'fireball',
    );
    expect(indiv).toHaveLength(1);
  });

  it('비-보조 분류의 분류 발사체 카드를 생성한다', () => {
    const e = new EnhancementLogic();
    const cards = e.buildUpgradeCards([fireball]);
    const cat = cards.filter(
      (c) => c.effect.upgrade?.track === UpgradeTrack.Category && c.effect.upgrade?.option === PC,
    );
    expect(cat.length).toBeGreaterThan(0);
  });

  it('전역(플레이어) 발사체 카드는 생성하지 않는다 (§7.6)', () => {
    const e = new EnhancementLogic();
    const cards = e.buildUpgradeCards([fireball]);
    // 모든 발사체 카드는 upgrade(개별/분류) 트랙이며, 전역 효과(damageMult류)가 아니다.
    const projectileCards = cards.filter((c) => c.effect.upgrade?.option === PC);
    for (const c of projectileCards) {
      expect(c.effect.upgrade).toBeDefined();
      expect([UpgradeTrack.Individual, UpgradeTrack.Category]).toContain(c.effect.upgrade?.track);
    }
  });

  it('maxed(레벨4) 개별 발사체 옵션은 카드에서 제외된다', () => {
    const e = new EnhancementLogic();
    for (let i = 0; i < UPGRADE_CAP; i++) e.raise(UpgradeTrack.Individual, 'fireball', PC);
    const cards = e.buildUpgradeCards([fireball]);
    const indivMaxed = cards.filter(
      (c) =>
        c.effect.upgrade?.track === UpgradeTrack.Individual &&
        c.effect.upgrade?.option === PC &&
        c.effect.upgrade?.target === 'fireball',
    );
    expect(indivMaxed).toHaveLength(0);
  });

  it('§8 게이트: allowsProjectileCount=false 마법은 개별 발사체 카드 미생성', () => {
    const e = new EnhancementLogic();
    const cards = e.buildUpgradeCards([inferno]);
    const indiv = cards.filter(
      (c) =>
        c.effect.upgrade?.track === UpgradeTrack.Individual &&
        c.effect.upgrade?.option === PC &&
        c.effect.upgrade?.target === 'inferno',
    );
    expect(indiv).toHaveLength(0);
  });

  it('§8 게이트는 발사체 옵션만 막는다 — inferno도 데미지/쿨다운 개별 카드는 생성', () => {
    const e = new EnhancementLogic();
    const cards = e.buildUpgradeCards([inferno]);
    const indivDmg = cards.filter(
      (c) =>
        c.effect.upgrade?.track === UpgradeTrack.Individual &&
        c.effect.upgrade?.option === UpgradeOption.Damage &&
        c.effect.upgrade?.target === 'inferno',
    );
    expect(indivDmg).toHaveLength(1);
  });
});

describe('EnhancementLogic — debugSnapshot 발사체 필드', () => {
  it('행에 발사체 보너스·페널티·유효 발사체 수가 채워진다', () => {
    const e = new EnhancementLogic();
    e.raise(UpgradeTrack.Individual, 'fireball', PC);
    e.raise(UpgradeTrack.Category, SpellCategory.Fire, PC); // bonus 2
    const snap = e.debugSnapshot([fireball]);
    const row = snap.rows[0];
    expect(row.projectileBonus).toBe(2);
    expect(row.projectilePenalty).toBeCloseTo(0.8);
    expect(row.effProjectileCount).toBe(3);
  });
});

describe('EnhancementLogic — 회귀: 발사체 강화가 데미지/쿨다운에 영향 없음', () => {
  it('발사체 레벨을 올려도 데미지 factor는 불변', () => {
    const e = new EnhancementLogic();
    const before = e.damageFactor(fireball);
    e.raise(UpgradeTrack.Individual, 'fireball', PC);
    e.raise(UpgradeTrack.Category, SpellCategory.Fire, PC);
    expect(e.damageFactor(fireball)).toBeCloseTo(before);
  });
});
