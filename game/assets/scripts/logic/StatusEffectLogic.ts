/**
 * CC(상태이상) 다중 타이머 해석기 — cc 비의존 순수 로직 (기획서 §9.4, 백로그 F14).
 *
 * 한 적은 강도별(슬로우·정지·빙결) **독립 타이머**를 가진다. 각 타이머는 동시에 감소하며,
 * 매 순간 살아 있는(남은 시간 > 0) 강도 중 **가장 센 것**이 적용된다. 재적중은 그 강도의
 * 타이머만 갱신하고 다른 강도는 독립으로 계속 흐른다. 이로써 약하고 긴 소스가 강한 강도의
 * 잔여를 max로 늘리던 단일 슬롯(magic-S2)의 결함을 고친다.
 *
 * 슬로우(magic-S3)·정지(magic-S2)는 소스가 배선됐고 빙결(magic-S6)은 해석만 — 소스만
 * 추가하면 된다. 적용(합치기)·틱(동시 감소·만료)·적용 강도 산출·강도별 파생 술어를 순수 함수로 둔다.
 */

/** 컨트롤 강도 (기획서 §9.4 표) — 숫자가 클수록 강하다. `appliedStrength`가 더 큰 값을 우선한다. */
export enum ControlStrength {
  /** 제어 없음 — 정상 이동·접촉 */
  None = 0,
  /** 슬로우 — 감속(이동 유지), 접촉 피해 유지 */
  Slow = 1,
  /** 정지 — 완전 정지(이동 0), 접촉 피해는 유지 */
  Stun = 2,
  /** 빙결 — 완전 정지 + 접촉 피해 차단(완전 무력화) */
  Freeze = 3,
}

/**
 * 적 한 마리의 강도별 남은 지속(초) 타이머. 인덱스 === `ControlStrength` 값이고
 * (0번 = None은 미사용 슬롯), 값이 `> 0`이면 그 강도가 활성, 정확히 0이면 만료다.
 * 길이 4 고정 튜플 — 타입에 길이를 못박는다.
 */
export type ControlTimers = [number, number, number, number];

/**
 * 슬로우의 이동 속도 배율 (placeholder, §14 밸런싱에서 확정). 0보다 크고 1보다 작아야 한다 —
 * 감속이지 정지가 아니다.
 */
export const SLOW_SPEED_FACTOR = 0.5;

/** 빈(제어 없음) 타이머를 새로 만든다. */
export function emptyControl(): ControlTimers {
  return [0, 0, 0, 0];
}

/**
 * 새 컨트롤 소스를 합친다 (§9.4) — 들어온 강도의 타이머만 `max(현재, durationSec)`로 갱신하고,
 * 다른 강도는 건드리지 않는다(독립). 같은 강도로 재적중하면 그 타이머만 새로 길어지며, 더 짧은
 * 지속으로는 줄지 않는다(양방향 max). 입력을 변형하지 않고 새 타이머를 반환한다(순수).
 * @param timers 현재 강도별 타이머
 * @param strength 들어온 소스의 강도
 * @param durationSec 들어온 소스의 지속시간 (sec)
 */
export function applyControl(
  timers: ControlTimers,
  strength: ControlStrength,
  durationSec: number,
): ControlTimers {
  const next: ControlTimers = [timers[0], timers[1], timers[2], timers[3]];
  next[strength] = Math.max(next[strength], durationSec);
  return next;
}

/**
 * 모든 강도 타이머를 dt만큼 줄이고 0에서 클램프한다(음수 잔여 없음) — 강도마다 따로 만료된다.
 * dt가 모든 타이머보다 커도 전부 0으로 떨어진다. 입력을 변형하지 않고 새 타이머를 반환한다(순수).
 * @param timers 현재 강도별 타이머
 * @param dt 경과 시간 (sec)
 */
export function tickControl(timers: ControlTimers, dt: number): ControlTimers {
  return [
    0,
    Math.max(0, timers[ControlStrength.Slow] - dt),
    Math.max(0, timers[ControlStrength.Stun] - dt),
    Math.max(0, timers[ControlStrength.Freeze] - dt),
  ];
}

/**
 * 지금 이 적에게 실제로 작용하는 강도 — 살아 있는(`> 0`) 강도 중 가장 센 것. 전부 0이면 None.
 * 호출부(컴포넌트)가 매 프레임 틱 이후 한 번 산출해 이동·접촉·틴트에 넘긴다.
 * @param timers 현재 강도별 타이머
 */
export function appliedStrength(timers: ControlTimers): ControlStrength {
  if (timers[ControlStrength.Freeze] > 0) return ControlStrength.Freeze;
  if (timers[ControlStrength.Stun] > 0) return ControlStrength.Stun;
  if (timers[ControlStrength.Slow] > 0) return ControlStrength.Slow;
  return ControlStrength.None;
}

/**
 * 살아 있는 타이머(`> 0`)가 하나라도 있으면 참 — 틱·틴트의 빠른 가드. 빈 적은 틱을 건너뛰어
 * 매 프레임 할당을 피한다.
 * @param timers 현재 강도별 타이머
 */
export function hasActiveControl(timers: ControlTimers): boolean {
  return (
    timers[ControlStrength.Slow] > 0 ||
    timers[ControlStrength.Stun] > 0 ||
    timers[ControlStrength.Freeze] > 0
  );
}

/**
 * 강도별 이동 속도 배율 — None=1(정상), Slow=감속(<1), Stun·Freeze=0(완전 정지).
 * @param strength 적용 강도
 */
export function moveSpeedFactor(strength: ControlStrength): number {
  switch (strength) {
    case ControlStrength.Slow:
      return SLOW_SPEED_FACTOR;
    case ControlStrength.Stun:
    case ControlStrength.Freeze:
      return 0;
    default:
      return 1;
  }
}

/**
 * 강도별 접촉 피해 유지 여부 — 빙결만 차단(완전 무력화), 나머지(None·Slow·Stun)는 유지한다.
 * 정지·슬로우는 이동만 영향받고 닿아 있으면 계속 아프다(§9.4).
 * @param strength 적용 강도
 */
export function dealsContactDamage(strength: ControlStrength): boolean {
  return strength !== ControlStrength.Freeze;
}

/**
 * 상태이상(CC) 발동 여부를 판정한다 — 난수가 확률보다 작으면 발동. 정지·슬로우·빙결 공통의
 * 확률 롤이며(강도 무관), 난수는 호출부가 생성해 주입하고 판정만 순수 함수로 떼어 결정적으로
 * 테스트한다.
 * @param rand 0 이상 1 미만 난수 (호출부가 주입)
 * @param chance 발동 확률 (0~1)
 */
export function shouldApplyControl(rand: number, chance: number): boolean {
  return rand < chance;
}
