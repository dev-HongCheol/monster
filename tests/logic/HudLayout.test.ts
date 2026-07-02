import { describe, expect, it } from 'vitest';
import { barRatio, formatTimer } from '../../game/assets/scripts/logic/HudFormatLogic';

describe('formatTimer — mm:ss 포맷', () => {
  it('0초는 "00:00"이다', () => {
    expect(formatTimer(0)).toBe('00:00');
  });

  it('65초는 "01:05"다 (분/초 분리)', () => {
    expect(formatTimer(65)).toBe('01:05');
  });

  it('600초는 "10:00"이다 (2자리 분)', () => {
    expect(formatTimer(600)).toBe('10:00');
  });

  it('9초는 "00:09"다 (초 2자리 패딩)', () => {
    expect(formatTimer(9)).toBe('00:09');
  });

  it('음수는 "00:00"으로 클램프된다', () => {
    expect(formatTimer(-3)).toBe('00:00');
  });

  it('소수 초는 내림 처리된다 (65.9 → "01:05")', () => {
    expect(formatTimer(65.9)).toBe('01:05');
  });

  it('분이 100 이상이면 자리수를 유지한다 (6000 → "100:00")', () => {
    expect(formatTimer(6000)).toBe('100:00');
  });
});

describe('barRatio — 0~1 채움 비율', () => {
  it('절반이면 0.5다 (50/100)', () => {
    expect(barRatio(50, 100)).toBe(0.5);
  });

  it('가득 차면 1이다 (100/100)', () => {
    expect(barRatio(100, 100)).toBe(1);
  });

  it('최대치를 초과하면 1로 클램프된다 (120/100)', () => {
    expect(barRatio(120, 100)).toBe(1);
  });

  it('max가 0이면 0이다 (0 나눗셈 가드)', () => {
    expect(barRatio(50, 0)).toBe(0);
  });

  it('max가 음수면 0이다', () => {
    expect(barRatio(50, -10)).toBe(0);
  });

  it('cur가 음수면 0으로 클램프된다 (-5/100)', () => {
    expect(barRatio(-5, 100)).toBe(0);
  });
});
