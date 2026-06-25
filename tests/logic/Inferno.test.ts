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

/** aim 위쪽(0,1) 단위벡터 — 궤도는 조준이 필요 없지만 buildFirePlan 시그니처상 전달 */
const AIM = { aimX: 0, aimY: 1 } as const;

/** 인페르노(화염 등급2) 데이터 픽스처 — 궤도형 회전 발사체(Orbit 패턴). */
function inferno(overrides: Partial<ISpellData> = {}): ISpellData {
  return {
    id: 'inferno',
    category: SpellCategory.Fire,
    tier: 2,
    damage: 6,
    projectileSpeed: 0, // 미사용(오브는 직선 이동 안 함)
    projectileRadius: 14, // 오브 크기 — 범위 강화 대상
    cooldown: 5.0, // 재시전 간격 — 쿨다운 강화 대상
    projectileCount: 2, // 기본 오브 2개
    pattern: SpellPattern.Orbit,
    allowsProjectileCount: true, // 궤도 오브 수 — 발사체 수 카드 적격(§8)
    orbitRadius: 80, // 기본 링 반경 — 이 필드가 범위 카드 적격을 만든다
    rotationSpeedDeg: 120,
    rehitCooldownSec: 0.5,
    lifetimeSec: 3.0, // 활성 수명 — 이 필드가 지속시간 카드 적격을 만든다
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

describe('인페르노 — Orbit 패턴 디스패치', () => {
  it('orbit 패턴 → 발사체 0발 (궤도라 발사체 경로를 타지 않음)', () => {
    const plan = buildFirePlan(inferno(), { ...AIM, count: 2 });
    expect(plan).toHaveLength(0);
  });

  it('count가 커도 orbit은 발사체를 만들지 않는다 (발사체 수 무관)', () => {
    const plan = buildFirePlan(inferno(), { ...AIM, count: 10 });
    expect(plan).toHaveLength(0);
  });
});

describe('인페르노 — 강화 카드 적격 (§8 매트릭스 계약, 5종 전부 ✅)', () => {
  it('범위 ✅ — orbitRadius 보유로 범위 카드 적격(오브 크기)', () => {
    expect(individualOptions(inferno()).has(UpgradeOption.Range)).toBe(true);
  });

  it('지속시간 ✅ — lifetimeSec 보유로 지속 카드 적격(활성 수명)', () => {
    expect(individualOptions(inferno()).has(UpgradeOption.Duration)).toBe(true);
  });

  it('발사체 수 ✅ — allowsProjectileCount=true(궤도 오브 수)', () => {
    expect(individualOptions(inferno()).has(UpgradeOption.ProjectileCount)).toBe(true);
  });

  it('데미지·쿨다운 ✅ — 항상 적격', () => {
    const opts = individualOptions(inferno());
    expect(opts.has(UpgradeOption.Damage)).toBe(true);
    expect(opts.has(UpgradeOption.Cooldown)).toBe(true);
  });

  it('강화 5종 전부 등장 — 인페르노는 모든 옵션이 적격인 유일한 마법', () => {
    const opts = individualOptions(inferno());
    expect(opts).toEqual(
      new Set([
        UpgradeOption.Damage,
        UpgradeOption.Cooldown,
        UpgradeOption.ProjectileCount,
        UpgradeOption.Range,
        UpgradeOption.Duration,
      ]),
    );
  });
});
