import { beforeEach, describe, expect, it } from 'vitest';
import { ExperienceLogic } from '../../game/assets/scripts/logic/ExperienceLogic';

describe('ExperienceLogic 초기 상태', () => {
  let xp: ExperienceLogic;

  beforeEach(() => {
    xp = new ExperienceLogic(100, 1.2);
  });

  it('초기 레벨은 1이다', () => {
    expect(xp.level).toBe(1);
  });

  it('초기 currentXp는 0이다', () => {
    expect(xp.currentXp).toBe(0);
  });

  it('레벨 1 requiredXp는 baseXp다', () => {
    expect(xp.requiredXp).toBe(100);
  });
});

describe('ExperienceLogic 요구 XP 계산', () => {
  it('레벨 2 requiredXp는 floor(baseXp * multiplier)다', () => {
    const xp = new ExperienceLogic(100, 1.2);
    xp.addXp(100); // 레벨 1→2
    expect(xp.requiredXp).toBe(120); // floor(100 * 1.2^1)
  });

  it('레벨 3 requiredXp는 floor(baseXp * multiplier^2)다', () => {
    const xp = new ExperienceLogic(100, 1.2);
    xp.addXp(100); // 레벨 2
    xp.addXp(120); // 레벨 3
    expect(xp.requiredXp).toBe(144); // floor(100 * 1.2^2) = floor(144)
  });

  it('multiplier 변수가 요구 XP에 반영된다', () => {
    const xp = new ExperienceLogic(100, 1.5);
    xp.addXp(100); // 레벨 2
    expect(xp.requiredXp).toBe(150); // floor(100 * 1.5^1)
  });

  it('레벨이 높아질수록 requiredXp는 계속 증가한다', () => {
    const xp = new ExperienceLogic(100, 1.2);
    const reqs: number[] = [];
    for (let i = 0; i < 5; i++) {
      reqs.push(xp.requiredXp);
      xp.addXp(xp.requiredXp);
    }
    for (let i = 1; i < reqs.length; i++) {
      expect(reqs[i]).toBeGreaterThan(reqs[i - 1]);
    }
  });

  it('레벨 상한이 없어 100레벨도 requiredXp가 유한하다', () => {
    const xp = new ExperienceLogic(100, 1.2);
    for (let i = 0; i < 99; i++) xp.addXp(xp.requiredXp);
    expect(xp.level).toBe(100);
    expect(xp.requiredXp).toBeLessThan(Infinity);
  });
});

describe('ExperienceLogic.addXp', () => {
  let xp: ExperienceLogic;

  beforeEach(() => {
    xp = new ExperienceLogic(100, 1.2);
  });

  it('요구치 미달 시 false를 반환하고 레벨이 오르지 않는다', () => {
    expect(xp.addXp(50)).toBe(false);
    expect(xp.level).toBe(1);
    expect(xp.currentXp).toBe(50);
  });

  it('요구치 정확히 도달 시 true를 반환하고 레벨이 오른다', () => {
    expect(xp.addXp(100)).toBe(true);
    expect(xp.level).toBe(2);
  });

  it('레벨업 후 초과 XP는 다음 레벨로 이월된다', () => {
    xp.addXp(120); // 100 요구, 20 이월
    expect(xp.currentXp).toBe(20);
  });

  it('XP 0 추가 시 false를 반환하고 상태가 변하지 않는다', () => {
    expect(xp.addXp(0)).toBe(false);
    expect(xp.level).toBe(1);
    expect(xp.currentXp).toBe(0);
  });
});
