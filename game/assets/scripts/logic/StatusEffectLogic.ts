/**
 * CC(상태이상) 단일 슬롯 해석기 — cc 비의존 순수 로직 (기획서 §9.4).
 *
 * 한 적은 컨트롤 슬롯을 하나만 가진다. 슬로우·정지·빙결이 겹쳐도 적용 강도는 가장 센 것
 * 하나이고, 지속시간은 둘 중 더 긴 값으로 유지된다. 슬롯 상태를 `{ strength, remaining }`
 * 한 쌍으로 표현하고, 적용(합치기)·틱(감소·만료)·강도별 파생 술어를 순수 함수로 둔다.
 *
 * 이번 슬라이스(magic-S2)가 실제로 생산하는 강도는 Stun뿐이지만, 해석기는 세 강도를 모두
 * 다룬다 — 슬로우(magic-S3)·빙결(magic-S6)이 소스만 추가하면 되도록.
 */

/** 컨트롤 강도 (기획서 §9.4 표) — 숫자가 클수록 강하다. 합치기는 더 큰 값으로만 올라간다. */
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

/** 적 한 마리의 컨트롤 슬롯 상태. remaining이 0 이하면 슬롯은 비어 있다(strength=None). */
export interface ControlState {
  /** 현재 적용 강도 */
  strength: ControlStrength;
  /** 남은 지속시간 (sec) */
  remaining: number;
}

/**
 * 슬로우의 이동 속도 배율 (placeholder, §14 밸런싱에서 확정). 0보다 크고 1보다 작아야 한다 —
 * 감속이지 정지가 아니다.
 */
export const SLOW_SPEED_FACTOR = 0.5;

/** 빈(제어 없음) 슬롯 상태를 새로 만든다. */
export function emptyControl(): ControlState {
  return { strength: ControlStrength.None, remaining: 0 };
}

/**
 * 새 컨트롤 소스를 현재 슬롯에 합친다 (§9.4) — 강도는 더 센 쪽으로만 오르고, 지속은 둘 중
 * 더 긴 값으로 갱신된다. 입력 상태는 변형하지 않고 새 상태를 반환한다(순수).
 * @param current 현재 슬롯 상태
 * @param strength 들어온 소스의 강도
 * @param durationSec 들어온 소스의 지속시간 (sec)
 */
export function applyControl(
  current: ControlState,
  strength: ControlStrength,
  durationSec: number,
): ControlState {
  return {
    strength: Math.max(current.strength, strength) as ControlStrength,
    remaining: Math.max(current.remaining, durationSec),
  };
}

/**
 * 슬롯을 dt만큼 진행시킨다 — 남은 지속을 줄이고, 0 이하가 되면 슬롯을 비운다(강도 None).
 * 입력 상태는 변형하지 않고 새 상태를 반환한다(순수).
 * @param state 현재 슬롯 상태
 * @param dt 경과 시간 (sec)
 */
export function tickControl(state: ControlState, dt: number): ControlState {
  const remaining = state.remaining - dt;
  if (remaining <= 0) return emptyControl();
  return { strength: state.strength, remaining };
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
 * 정지는 이동만 멈추고 닿아 있으면 계속 아프다(§9.4).
 * @param strength 적용 강도
 */
export function dealsContactDamage(strength: ControlStrength): boolean {
  return strength !== ControlStrength.Freeze;
}

/**
 * 정지 발동 여부를 판정한다 — 난수가 확률보다 작으면 발동. 난수는 호출부가 생성해 주입하고
 * 판정만 순수 함수로 떼어 결정적으로 테스트한다.
 * @param rand 0 이상 1 미만 난수 (호출부가 주입)
 * @param chance 발동 확률 (0~1)
 */
export function shouldApplyStun(rand: number, chance: number): boolean {
  return rand < chance;
}
