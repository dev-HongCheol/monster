// 플레이어 피격 무적(i-frame) + 틱당 max 피해 게이트의 순수 로직 (player-iframe 슬라이스).
// cc import 없이 시간·수치만 다뤄 결정적으로 테스트한다. 가변 상태(틱 타이머·누적 최대값)는
// GameManager가 보관하고, 이 모듈은 그 상태를 받아 다음 값을 계산하는 순수 함수만 제공한다.
//
// 모델: 플레이어는 고정 주기 T(피격 틱 = 무적 창)마다 피해를 1회 받고, 그 값은 그 틱에 들어온
// 피해원(접촉·발사체·돌진·휘두르기) 중 가장 센 것이다. 부채꼴 N발이 동시에 닿아도, 여러 적이
// 동시에 때려도 그 틱엔 가장 위험한 한 방만 들어온다.

/** `tickDamage` 결과 — 이번 프레임에 적용할 피해, 갱신된 타이머·누적값. */
export interface DamageTickResult {
  /** 이번 프레임에 HP에서 깎을 피해 (틱 경계 미통과면 0). */
  applied: number;
  /** 갱신된 틱 타이머(sec). */
  timer: number;
  /** 갱신된 누적 최대값 (적용됐으면 0). */
  pendingMax: number;
}

/**
 * 한 틱 동안의 피해 누적 — 현재 누적값과 들어온 피해 중 더 센 것을 남긴다.
 * 같은 틱에 여러 피해원이 닿아도 가장 센 한 방만 그 틱 피해가 된다.
 * @param pending 현재 틱의 누적 최대값
 * @param incoming 새로 들어온 피해
 */
export function accumulateDamage(pending: number, incoming: number): number {
  return Math.max(pending, incoming);
}

/**
 * 틱 타이머를 dt만큼 진행시키고, 틱 시간 T를 넘었으면 누적 max를 "적용할 피해"로 돌려준다.
 * 넘기 전에는 적용 0(무적 유지)이며 누적값은 다음 틱까지 보존된다. 넘으면 누적·타이머를
 * 리셋하고 초과분(t − T)을 다음 창으로 이월한다.
 * @param timer 현재 틱 타이머(sec)
 * @param pendingMax 현재 틱의 누적 최대 피해
 * @param dt 프레임 경과 시간(sec)
 * @param tickSec 피격 틱 = 무적 창 길이 T(sec). 0 이하면 무적 없이 즉시 적용.
 */
export function tickDamage(
  timer: number,
  pendingMax: number,
  dt: number,
  tickSec: number,
): DamageTickResult {
  // T가 0 이하면 무적 창이 없다 — 매 호출 즉시 누적값을 적용한다(분모 0/음수 가드).
  if (tickSec <= 0) return { applied: pendingMax, timer: 0, pendingMax: 0 };
  const t = timer + dt;
  // 한 호출은 누적 max를 1회만 적용한다 — dt가 T의 몇 배여도 한 프레임에 여러 틱분이 쌓이지 않는다.
  // 초과분(t − T)은 클램프하지 않고 그대로 이월한다(DPS = 실경과 시간 보존). dt > 2T인 심한 스파이크
  // 뒤엔 이월값이 T를 넘어 다음 프레임이 곧장 또 명중할 수 있으나, 이는 평균 피해율을 맞추는 의도된 동작이다.
  if (t >= tickSec) return { applied: pendingMax, timer: t - tickSec, pendingMax: 0 };
  return { applied: 0, timer: t, pendingMax };
}

/**
 * 초당 접촉 피해를 한 틱 분량으로 환산한다(= 초당값 × T). 틱당 max로 적용해도 단일 접촉의
 * 평균 피해율(DPS)이 보존되도록, T는 청크 크기만 바꾸고 평균은 그대로 둔다.
 * @param contactDamagePerSec 적의 초당 접촉 피해
 * @param tickSec 피격 틱 길이 T(sec)
 */
export function contactDamagePerTick(contactDamagePerSec: number, tickSec: number): number {
  return contactDamagePerSec * tickSec;
}
