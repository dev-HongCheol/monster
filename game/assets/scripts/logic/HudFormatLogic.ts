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
 * 정수를 천단위 콤마로 그룹핑한 문자열로 반환한다. 소수는 내림하고 음수 부호는 보존한다.
 * mm:ss와 마찬가지로 콤마 구분의 언어 중립 숫자 포맷이라 현지화 문자열이 아니다(로케일 무관).
 * HP·보스 HP처럼 자릿수가 커질 수 있는 수치 라벨에 쓴다.
 * @param value 표시할 수치. 소수·음수 허용.
 * @returns 천단위 콤마 문자열 (예: 10058650 → "10,058,650", 205 → "205")
 */
export function formatNumber(value: number): string {
  const abs = Math.floor(Math.abs(value));
  const grouped = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return value < 0 && abs !== 0 ? `-${grouped}` : grouped;
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

/**
 * 가로 ProgressBar의 채움 노드가 바 왼쪽 끝에서 시작하도록 놓일 x를 반환한다.
 * 엔진(3.8.8 `ProgressBar._initBarSprite`)은 바 스프라이트를 연결할 때 한 번만 이 식으로
 * 채움 노드의 x를 놓고, 매 프레임 갱신에서는 다시 계산하지 않는다. 그래서 Widget이 바를
 * 늘리면 채움이 바 안쪽에서 시작하므로, 폭이 바뀔 때 이 값으로 다시 놓는다.
 * 채움 노드가 바의 직계 자식이고 앵커 x가 0이며 reverse가 꺼진 바에만 맞다 — reverse를
 * 켜면 엔진이 채움 앵커를 1로 바꿔 시작점이 오른쪽 끝이 된다.
 * @param barWidth 바 노드의 실제 폭(UITransform.contentSize.width)
 * @param barAnchorX 바 노드의 앵커 x(0~1)
 * @returns 채움 노드의 로컬 x
 */
export function barFillStartX(barWidth: number, barAnchorX: number): number {
  // -(w × 0)은 -0이 되므로 0에서 빼서 앵커 0일 때 +0을 낸다.
  return 0 - barWidth * barAnchorX;
}
