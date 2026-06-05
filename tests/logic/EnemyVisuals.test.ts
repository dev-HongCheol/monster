import { describe, expect, it } from 'vitest';
import {
  deathAlpha,
  deathScale,
  hitFlashBlend,
  isDeathDone,
} from '../../game/assets/scripts/logic/EnemyVisualLogic';

/**
 * 계획 문서(2026-06-05-enemy-visuals-plan.md §4)의 순수 시각 로직.
 * 경과시간 → 피격 플래시 블렌드 / 사망 스케일·알파 / 완료 여부.
 * cc 비의존이라 결정적으로 테스트 가능. 적용(cc.Color/node)은 EnemyController 책임.
 */
describe('hitFlashBlend — 피격 플래시 블렌드 [0,1]', () => {
  const DUR = 0.2;

  it('피격 직후(elapsed=0)는 1 (완전 흰색)', () => {
    expect(hitFlashBlend(0, DUR)).toBe(1);
  });

  it('duration에 도달하면 0 (원래색)', () => {
    expect(hitFlashBlend(DUR, DUR)).toBe(0);
  });

  it('중간 지점은 선형 보간값', () => {
    expect(hitFlashBlend(DUR / 2, DUR)).toBeCloseTo(0.5, 5);
    expect(hitFlashBlend(DUR * 0.25, DUR)).toBeCloseTo(0.75, 5);
  });

  it('duration 초과는 0으로 클램프', () => {
    expect(hitFlashBlend(DUR * 2, DUR)).toBe(0);
  });

  it('음수 elapsed는 1로 클램프', () => {
    expect(hitFlashBlend(-0.5, DUR)).toBe(1);
  });

  it('duration<=0이면 플래시 없음(0)', () => {
    expect(hitFlashBlend(0, 0)).toBe(0);
    expect(hitFlashBlend(0.1, -1)).toBe(0);
  });
});

describe('deathScale — 사망 팝 스케일 배율', () => {
  const DUR = 0.3;
  const PEAK = 1.3;

  it('시작(elapsed=0)은 1 (기준 크기)', () => {
    expect(deathScale(0, DUR, PEAK)).toBeCloseTo(1, 5);
  });

  it('중간(p=0.5)은 peak에 도달', () => {
    expect(deathScale(DUR / 2, DUR, PEAK)).toBeCloseTo(PEAK, 5);
  });

  it('끝(elapsed=duration)은 다시 1로 복귀', () => {
    expect(deathScale(DUR, DUR, PEAK)).toBeCloseTo(1, 5);
  });

  it('duration 초과도 종료값 1 부근 (클램프)', () => {
    expect(deathScale(DUR * 2, DUR, PEAK)).toBeCloseTo(1, 5);
  });

  it('duration<=0이면 1', () => {
    expect(deathScale(0.1, 0, PEAK)).toBe(1);
  });
});

describe('deathAlpha — 사망 페이드 알파 [0,1]', () => {
  const DUR = 0.3;

  it('시작(elapsed=0)은 1 (불투명)', () => {
    expect(deathAlpha(0, DUR)).toBe(1);
  });

  it('duration에서 0 (완전 투명)', () => {
    expect(deathAlpha(DUR, DUR)).toBe(0);
  });

  it('단조 감소한다', () => {
    const a = deathAlpha(DUR * 0.25, DUR);
    const b = deathAlpha(DUR * 0.5, DUR);
    const c = deathAlpha(DUR * 0.75, DUR);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('duration 초과는 0으로 클램프', () => {
    expect(deathAlpha(DUR * 2, DUR)).toBe(0);
  });
});

describe('isDeathDone — 사망 연출 종료 여부', () => {
  const DUR = 0.3;

  it('duration 미만은 미완료(false)', () => {
    expect(isDeathDone(0, DUR)).toBe(false);
    expect(isDeathDone(DUR * 0.99, DUR)).toBe(false);
  });

  it('duration 이상은 완료(true)', () => {
    expect(isDeathDone(DUR, DUR)).toBe(true);
    expect(isDeathDone(DUR * 2, DUR)).toBe(true);
  });
});
