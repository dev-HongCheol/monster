import { describe, expect, it } from 'vitest';
import {
  type ISpellData,
  SpellCategory,
  SpellPattern,
} from '../../game/assets/scripts/data/GameTypes';
import {
  buildFirePlan,
  DEFAULT_SPREAD_ANGLE_DEG,
  type ShotSpec,
} from '../../game/assets/scripts/logic/SpellPatternLogic';

/** aim 위쪽(0,1) 단위벡터 기준 테스트 픽스처 */
const AIM = { aimX: 0, aimY: 1 } as const;

/** directional 마법 픽스처 생성 */
function spell(overrides: Partial<ISpellData> = {}): ISpellData {
  return {
    id: 'fireball',
    category: SpellCategory.Fire,
    tier: 1,
    damage: 25,
    projectileSpeed: 500,
    projectileRadius: 8,
    cooldown: 0.5,
    projectileCount: 1,
    pattern: SpellPattern.Directional,
    ...overrides,
  };
}

/** shot 방향과 aim의 내적(=cos(끼인각)). 단위벡터 가정. */
function dotWithAim(shot: ShotSpec): number {
  return shot.dirX * AIM.aimX + shot.dirY * AIM.aimY;
}

function magnitude(shot: ShotSpec): number {
  return Math.hypot(shot.dirX, shot.dirY);
}

describe('buildFirePlan — directional', () => {
  it('count=1 → 1발, 방향은 aim 그대로 (부채꼴 없음)', () => {
    const plan = buildFirePlan(spell(), { ...AIM, count: 1 });
    expect(plan).toHaveLength(1);
    expect(plan[0].dirX).toBeCloseTo(0, 5);
    expect(plan[0].dirY).toBeCloseTo(1, 5);
  });

  it('count=1 → speed/damage/radius를 마법값 그대로 전달', () => {
    const plan = buildFirePlan(spell({ projectileSpeed: 700, damage: 14, projectileRadius: 6 }), {
      ...AIM,
      count: 1,
    });
    expect(plan[0].speed).toBe(700);
    expect(plan[0].damage).toBe(14);
    expect(plan[0].radius).toBe(6);
  });

  it('모든 발사체 방향은 단위벡터다', () => {
    const plan = buildFirePlan(spell(), { ...AIM, count: 3 });
    for (const shot of plan) {
      expect(magnitude(shot)).toBeCloseTo(1, 5);
    }
  });

  it('count=3 → 3발, 중앙은 aim, 외곽 2발은 ±(θ/2) 대칭', () => {
    const theta = DEFAULT_SPREAD_ANGLE_DEG; // 10
    const plan = buildFirePlan(spell(), { ...AIM, count: 3 });
    expect(plan).toHaveLength(3);

    // 내적(cos)으로 정렬: 외곽(cos θ/2) 2개 + 중앙(cos 0 = 1)
    const dots = plan.map(dotWithAim).sort((a, b) => a - b);
    const expectedOuter = Math.cos((theta / 2) * (Math.PI / 180));
    expect(dots[0]).toBeCloseTo(expectedOuter, 5);
    expect(dots[1]).toBeCloseTo(expectedOuter, 5);
    expect(dots[2]).toBeCloseTo(1, 5); // 중앙 = aim

    // 외곽 2발은 dirX 부호가 반대(좌우 대칭)
    const xs = plan.map((s) => s.dirX).filter((x) => Math.abs(x) > 1e-6);
    expect(xs).toHaveLength(2);
    expect(Math.sign(xs[0])).toBe(-Math.sign(xs[1]));
    expect(Math.abs(xs[0])).toBeCloseTo(Math.abs(xs[1]), 5);
  });

  it('count=2 → ±(θ/2) 대칭 2발, 중앙(aim) 발사체 없음', () => {
    const theta = DEFAULT_SPREAD_ANGLE_DEG;
    const plan = buildFirePlan(spell(), { ...AIM, count: 2 });
    expect(plan).toHaveLength(2);

    const expectedOuter = Math.cos((theta / 2) * (Math.PI / 180));
    for (const shot of plan) {
      expect(dotWithAim(shot)).toBeCloseTo(expectedOuter, 5);
    }
    // 중앙(dirX≈0) 발사체가 없어야 함
    expect(plan.some((s) => Math.abs(s.dirX) < 1e-6)).toBe(false);
    // 좌우 대칭
    expect(Math.sign(plan[0].dirX)).toBe(-Math.sign(plan[1].dirX));
  });

  it('count<=0 → 1발로 클램프 (음수·0 방어)', () => {
    expect(buildFirePlan(spell(), { ...AIM, count: 0 })).toHaveLength(1);
    expect(buildFirePlan(spell(), { ...AIM, count: -3 })).toHaveLength(1);
  });

  it('count가 NaN/Infinity → 1발로 클램프 (무발사 방지, R1)', () => {
    expect(buildFirePlan(spell(), { ...AIM, count: Number.NaN })).toHaveLength(1);
    expect(buildFirePlan(spell(), { ...AIM, count: Number.POSITIVE_INFINITY })).toHaveLength(1);
  });

  it('spreadAngleDeg 지정 시 외곽 각도가 그 값을 따른다', () => {
    const plan = buildFirePlan(spell({ spreadAngleDeg: 60 }), { ...AIM, count: 2 });
    const expectedOuter = Math.cos((60 / 2) * (Math.PI / 180)); // cos 30°
    for (const shot of plan) {
      expect(dotWithAim(shot)).toBeCloseTo(expectedOuter, 5);
    }
  });

  it('spreadAngleDeg 생략 시 기본값(10°)을 쓴다', () => {
    const plan = buildFirePlan(spell({ spreadAngleDeg: undefined }), { ...AIM, count: 2 });
    const expectedOuter = Math.cos((DEFAULT_SPREAD_ANGLE_DEG / 2) * (Math.PI / 180));
    for (const shot of plan) {
      expect(dotWithAim(shot)).toBeCloseTo(expectedOuter, 5);
    }
  });

  it('기본 부채꼴 각도는 10°다 (튜닝: 기존 30°에서 축소)', () => {
    expect(DEFAULT_SPREAD_ANGLE_DEG).toBe(10);
  });
});

describe('buildFirePlan — 패턴 폴백', () => {
  it('pattern 미지정 → directional로 폴백(크래시 없음)', () => {
    const s = spell();
    // 데이터에 pattern이 빠진 경우 시뮬레이션
    (s as { pattern?: SpellPattern }).pattern = undefined;
    const plan = buildFirePlan(s, { ...AIM, count: 1 });
    expect(plan).toHaveLength(1);
    expect(plan[0].dirY).toBeCloseTo(1, 5);
  });

  it('미지(未知) pattern 값 → directional로 폴백', () => {
    const s = spell();
    (s as unknown as { pattern: string }).pattern = 'bogus_pattern';
    const plan = buildFirePlan(s, { ...AIM, count: 3 });
    expect(plan).toHaveLength(3);
  });
});
