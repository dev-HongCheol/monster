import { describe, expect, test } from 'vitest';
import {
  applyControl,
  type ControlState,
  ControlStrength,
  dealsContactDamage,
  emptyControl,
  moveSpeedFactor,
  SLOW_SPEED_FACTOR,
  shouldApplyStun,
  tickControl,
} from '../../game/assets/scripts/logic/StatusEffectLogic';

// magic-S2: CC 단일 슬롯 해석기 (기획서 §9.4). 한 적은 컨트롤 슬롯 하나만 가진다 —
// 슬로우·정지·빙결이 겹치면 강도는 더 센 쪽, 지속은 둘 중 더 긴 값으로 유지된다.
// 이번 슬라이스가 실제로 생산하는 강도는 Stun뿐이지만 해석기는 세 강도를 모두 다룬다.

describe('applyControl — 합치기(강도 max·지속 max)', () => {
  test('빈 슬롯에 적용하면 강도와 지속이 그대로 들어간다', () => {
    const next = applyControl(emptyControl(), ControlStrength.Stun, 0.5);
    expect(next.strength).toBe(ControlStrength.Stun);
    expect(next.remaining).toBeCloseTo(0.5);
  });

  test('더 센 강도가 들어오면 강도가 올라간다', () => {
    const slowed: ControlState = { strength: ControlStrength.Slow, remaining: 1.0 };
    const next = applyControl(slowed, ControlStrength.Freeze, 0.4);
    expect(next.strength).toBe(ControlStrength.Freeze);
  });

  test('더 약한 강도가 들어와도 강도는 내려가지 않는다(둘 중 센 쪽)', () => {
    const frozen: ControlState = { strength: ControlStrength.Freeze, remaining: 0.3 };
    const next = applyControl(frozen, ControlStrength.Slow, 1.0);
    expect(next.strength).toBe(ControlStrength.Freeze);
  });

  test('지속은 현재와 새 값 중 더 긴 쪽으로 갱신된다', () => {
    const stunnedShort: ControlState = { strength: ControlStrength.Stun, remaining: 0.2 };
    const next = applyControl(stunnedShort, ControlStrength.Stun, 0.6);
    expect(next.remaining).toBeCloseTo(0.6);
  });

  test('새 지속이 더 짧으면 기존의 더 긴 지속을 유지한다', () => {
    const stunnedLong: ControlState = { strength: ControlStrength.Stun, remaining: 0.8 };
    const next = applyControl(stunnedLong, ControlStrength.Stun, 0.3);
    expect(next.remaining).toBeCloseTo(0.8);
  });

  test('입력 상태를 변형하지 않고 새 상태를 반환한다(순수)', () => {
    const current: ControlState = { strength: ControlStrength.Slow, remaining: 0.5 };
    applyControl(current, ControlStrength.Stun, 1.0);
    expect(current.strength).toBe(ControlStrength.Slow);
    expect(current.remaining).toBeCloseTo(0.5);
  });
});

describe('tickControl — 지속 감소와 만료', () => {
  test('지속을 dt만큼 줄인다', () => {
    const state: ControlState = { strength: ControlStrength.Stun, remaining: 0.5 };
    const next = tickControl(state, 0.2);
    expect(next.strength).toBe(ControlStrength.Stun);
    expect(next.remaining).toBeCloseTo(0.3);
  });

  test('지속이 0 이하가 되면 슬롯을 비운다(강도 None)', () => {
    const state: ControlState = { strength: ControlStrength.Stun, remaining: 0.1 };
    const next = tickControl(state, 0.2);
    expect(next.strength).toBe(ControlStrength.None);
    expect(next.remaining).toBe(0);
  });

  test('이미 빈 슬롯은 그대로 빈 슬롯이다', () => {
    const next = tickControl(emptyControl(), 0.016);
    expect(next.strength).toBe(ControlStrength.None);
    expect(next.remaining).toBe(0);
  });
});

describe('moveSpeedFactor — 강도별 이동 속도 배율', () => {
  test('None은 정상 속도(배율 1)', () => {
    expect(moveSpeedFactor(ControlStrength.None)).toBe(1);
  });

  test('Slow는 1 미만으로 감속', () => {
    const f = moveSpeedFactor(ControlStrength.Slow);
    expect(f).toBe(SLOW_SPEED_FACTOR);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
  });

  test('Stun과 Freeze는 완전 정지(배율 0)', () => {
    expect(moveSpeedFactor(ControlStrength.Stun)).toBe(0);
    expect(moveSpeedFactor(ControlStrength.Freeze)).toBe(0);
  });
});

describe('dealsContactDamage — 강도별 접촉 피해 유지 여부', () => {
  test('None·Slow·Stun은 접촉 피해를 유지한다', () => {
    expect(dealsContactDamage(ControlStrength.None)).toBe(true);
    expect(dealsContactDamage(ControlStrength.Slow)).toBe(true);
    expect(dealsContactDamage(ControlStrength.Stun)).toBe(true);
  });

  test('Freeze만 접촉 피해를 차단한다(완전 무력화)', () => {
    expect(dealsContactDamage(ControlStrength.Freeze)).toBe(false);
  });
});

describe('shouldApplyStun — 확률 판정(난수 주입)', () => {
  test('난수가 확률보다 작으면 발동', () => {
    expect(shouldApplyStun(0.1, 0.2)).toBe(true);
  });

  test('난수가 확률보다 크면 미발동', () => {
    expect(shouldApplyStun(0.5, 0.2)).toBe(false);
  });

  test('경계: 난수가 확률과 같으면 미발동', () => {
    expect(shouldApplyStun(0.2, 0.2)).toBe(false);
  });

  test('확률 0이면 항상 미발동', () => {
    expect(shouldApplyStun(0, 0)).toBe(false);
  });
});
