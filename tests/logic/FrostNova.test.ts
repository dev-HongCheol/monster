import { describe, expect, it } from 'vitest';
import {
  type ISpellData,
  SpellCategory,
  SpellPattern,
  UpgradeOption,
  UpgradeTrack,
} from '../../game/assets/scripts/data/GameTypes';
import { EnhancementLogic } from '../../game/assets/scripts/logic/EnhancementLogic';
import { buildFirePlan } from '../../game/assets/scripts/logic/SpellPatternLogic';

/** aim 위쪽(0,1) 단위벡터 — 노바는 조준이 필요 없지만 buildFirePlan 시그니처상 전달 */
const AIM = { aimX: 0, aimY: 1 } as const;

/** 프로스트 노바(얼음 등급3) 데이터 픽스처 — 자기중심 즉발 버스트(Nova 패턴). */
function frostNova(overrides: Partial<ISpellData> = {}): ISpellData {
  return {
    id: 'frost_nova',
    category: SpellCategory.Ice,
    tier: 3,
    damage: 30,
    projectileSpeed: 0, // 노바는 발사체 없음 — 미사용
    projectileRadius: 0, // 미사용
    cooldown: 2.0,
    projectileCount: 1,
    pattern: SpellPattern.Nova,
    allowsProjectileCount: false, // 자기중심 → 발사체 수 카드 제외(§8)
    explosionRadius: 120, // 노바 반경 — 이 필드가 범위 카드 적격을 만든다
    ...overrides,
  };
}

/** 개별 트랙에서 주어진 마법에 적용된 강화 옵션 집합을 추린다. */
function individualOptions(spell: ISpellData): Set<UpgradeOption> {
  const cards = new EnhancementLogic().buildUpgradeCards([spell]);
  return new Set(
    cards
      .filter(
        (c) =>
          c.effect.upgrade?.track === UpgradeTrack.Individual &&
          c.effect.upgrade?.target === spell.id,
      )
      .map((c) => c.effect.upgrade?.option)
      .filter((o): o is UpgradeOption => o !== undefined),
  );
}

describe('프로스트 노바 — Nova 패턴 디스패치', () => {
  it('nova 패턴 → 발사체 0발 (자기중심 버스트라 발사체 경로를 타지 않음)', () => {
    const plan = buildFirePlan(frostNova(), { ...AIM, count: 1 });
    expect(plan).toHaveLength(0);
  });

  it('count가 커도 nova는 발사체를 만들지 않는다 (발사체 수 무관)', () => {
    const plan = buildFirePlan(frostNova(), { ...AIM, count: 5 });
    expect(plan).toHaveLength(0);
  });
});

describe('프로스트 노바 — 강화 카드 적격 (§8 매트릭스 계약)', () => {
  it('범위 ✅ — explosionRadius 보유로 범위 카드 적격', () => {
    expect(individualOptions(frostNova()).has(UpgradeOption.Range)).toBe(true);
  });

  it('발사체 수 ❌ — allowsProjectileCount=false로 제외', () => {
    expect(individualOptions(frostNova()).has(UpgradeOption.ProjectileCount)).toBe(false);
  });

  it('지속시간 ❌ — onHitStatus 없음(순수 피해)으로 제외', () => {
    expect(individualOptions(frostNova()).has(UpgradeOption.Duration)).toBe(false);
  });

  it('데미지·쿨다운 ✅ — 항상 적격', () => {
    const opts = individualOptions(frostNova());
    expect(opts.has(UpgradeOption.Damage)).toBe(true);
    expect(opts.has(UpgradeOption.Cooldown)).toBe(true);
  });
});
