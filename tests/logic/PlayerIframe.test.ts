import { describe, expect, it } from 'vitest';
// 아직 존재하지 않는 순수 모듈 — 이 import가 RED를 만든다(구현 단계에서 생성).
import {
  accumulateDamage,
  contactDamagePerTick,
  type DamageTickResult,
  tickDamage,
} from '../../game/assets/scripts/logic/PlayerDamageLogic';

// 플레이어 피격 무적(i-frame) + 틱당 max 피해 게이트의 순수 로직.
// 플레이어는 고정 주기 T(피격 틱=무적 창)마다 피해를 1회 받고, 그 값은 그 틱에
// 들어온 피해원 중 가장 센 것이다(설계: 2026-06-27-player-iframe-plan.md §3·§4.1).

describe('accumulateDamage — 한 틱 누적은 max', () => {
  it('들어온 피해 중 더 큰 값을 남긴다', () => {
    expect(accumulateDamage(0, 40)).toBe(40);
    expect(accumulateDamage(25, 40)).toBe(40);
    expect(accumulateDamage(40, 25)).toBe(40);
  });

  it('더 작은 피해는 무시한다(가장 센 것만 유지)', () => {
    expect(accumulateDamage(40, 10)).toBe(40);
  });
});

describe('tickDamage — 틱 경계에서만 누적 max를 적용', () => {
  it('틱 시간이 차기 전에는 피해를 적용하지 않는다(무적 유지)', () => {
    const r: DamageTickResult = tickDamage(0, 40, 0.1, 0.5);
    expect(r.applied).toBe(0);
    expect(r.timer).toBeCloseTo(0.1);
    expect(r.pendingMax).toBe(40); // 누적값은 다음 틱까지 유지
  });

  it('틱 시간을 넘으면 누적 max를 적용하고 누적·타이머를 리셋한다', () => {
    const r = tickDamage(0.45, 40, 0.1, 0.5); // 0.45 + 0.1 = 0.55 ≥ 0.5
    expect(r.applied).toBe(40);
    expect(r.pendingMax).toBe(0);
    expect(r.timer).toBeCloseTo(0.05); // 초과분(0.55 − 0.5)을 다음 창으로 이월
  });

  it('dt가 틱 시간보다 커도 한 번만 적용한다(랙 스파이크 — 한 프레임에 여러 틱분 누적 금지)', () => {
    // dt=1.2s, T=0.5s. 한 프레임에 2틱(1.0s)분이 들어와도 단일 호출은 누적 max를 1회만 적용한다.
    const r = tickDamage(0, 40, 1.2, 0.5);
    expect(r.applied).toBe(40); // 두 배가 아니라 한 번만
    expect(r.pendingMax).toBe(0);
    expect(r.timer).toBeCloseTo(0.7); // 초과분(1.2 − 0.5)을 그대로 이월(DPS 보존, 비클램프)
  });

  it('한 틱에 여러 피해가 들어와도 가장 센 것만 적용한다', () => {
    let pending = 0;
    for (const hit of [10, 40, 25]) pending = accumulateDamage(pending, hit);
    const r = tickDamage(0.45, pending, 0.1, 0.5);
    expect(r.applied).toBe(40);
  });

  it('연속한 틱마다 각 틱의 max를 따로 적용한다', () => {
    const T = 0.5;
    let timer = 0;
    let pending = 0;
    const applied: number[] = [];

    // 틱 1: 30 누적 후 틱 경계 통과
    pending = accumulateDamage(pending, 30);
    let r = tickDamage(timer, pending, T, T);
    applied.push(r.applied);
    timer = r.timer;
    pending = r.pendingMax;

    // 틱 2: 50 누적 후 틱 경계 통과
    pending = accumulateDamage(pending, 50);
    r = tickDamage(timer, pending, T, T);
    applied.push(r.applied);

    expect(applied).toEqual([30, 50]);
  });

  it('틱 시간이 0 이하면 무적 없이 즉시 적용한다', () => {
    const r = tickDamage(0, 30, 0.016, 0);
    expect(r.applied).toBe(30);
    expect(r.pendingMax).toBe(0);
  });
});

describe('contactDamagePerTick — 초당 접촉을 틱당 청크로 환산', () => {
  it('초당 접촉 × 틱 시간으로 한 틱 값을 만든다', () => {
    expect(contactDamagePerTick(10, 0.5)).toBe(5);
  });

  it('틱당 max로 적용해도 단일 접촉의 평균 피해율(DPS)을 보존한다', () => {
    const cdps = 10;
    const T = 0.5;
    const ticks = 100;
    let timer = 0;
    let pending = 0;
    let total = 0;

    for (let i = 0; i < ticks; i++) {
      pending = accumulateDamage(pending, contactDamagePerTick(cdps, T));
      const r = tickDamage(timer, pending, T, T); // dt=T라 매 틱 경계 통과
      total += r.applied;
      timer = r.timer;
      pending = r.pendingMax;
    }

    const elapsed = ticks * T;
    expect(total / elapsed).toBeCloseTo(cdps); // 평균 = 초당 접촉값
  });
});
