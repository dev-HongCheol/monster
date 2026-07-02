// HUD 표시값 포맷 (순수, cc 비의존). HudController가 인라인으로 갖고 있던 타이머 포맷과
// 바 채움 비율 계산을 순수 함수로 분리한다(ADR 002). mm:ss는 콜론 구분의 언어 중립 숫자
// 포맷이라 현지화 문자열이 아니며(숫자 천단위 포맷과 같은 성격), 바 비율은 UI 컴포넌트
// (ProgressBar)가 그대로 받는 0~1 값이다.

/**
 * 남은 초를 mm:ss 문자열로 포맷한다. 음수는 0으로 클램프하고 소수 초는 내림한다.
 * 분·초 모두 2자리로 패딩하되, 분이 100 이상이면 자리수를 그대로 늘린다.
 * @param remainingSec 남은 시간(초). 음수·소수 허용.
 * @returns "mm:ss" 형식 (예: 65 → "01:05")
 */
export function formatTimer(remainingSec: number): string {
  const total = Math.max(0, Math.floor(remainingSec));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * 바 채움 비율을 0~1로 반환한다. HP·XP 바가 공유한다.
 * @param cur 현재값
 * @param max 최대값 (0 이하면 0 나눗셈 가드로 0 반환)
 * @returns 0~1로 클램프된 채움 비율
 */
export function barRatio(cur: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, cur / max));
}
