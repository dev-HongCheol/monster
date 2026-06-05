/**
 * 적의 시간 기반 시각 연출 수치를 계산하는 순수 함수 모음 (cc 비의존).
 *
 * 계획 doc(2026-06-05-enemy-visuals-plan.md §4) 근거:
 * - 피격 플래시·사망 팝/페이드는 경과시간(elapsed)에 대한 보간이다. 보간값만 여기서
 *   계산하고, 실제 적용(cc.Color lerp / node.scale / Sprite.color.a)은 호출부
 *   (EnemyController)가 담당한다. 덕분에 cc 없이 결정적으로 테스트 가능.
 * - 모든 함수는 비정상 입력(음수 elapsed, duration<=0, elapsed>duration)을 클램프해
 *   안전한 값을 반환한다.
 */

/**
 * 피격 플래시 블렌드 비율 [0,1]. 호출부는 `Color.lerp(out, baseTint, WHITE, blend)`로 적용.
 * @param elapsed 피격 후 경과시간 (sec). 음수는 0으로 클램프.
 * @param duration 플래시 지속시간 (sec). 0 이하면 플래시 없음(0 반환).
 * @returns elapsed=0 → 1(완전 흰색), duration 이상 → 0(원래색). 그 사이 선형 감쇠.
 */
export function hitFlashBlend(elapsed: number, duration: number): number {
  if (duration <= 0) return 0;
  const e = Math.max(0, elapsed);
  return Math.max(0, Math.min(1, 1 - e / duration));
}

/**
 * 사망 팝 스케일 배율. 호출부는 `node.setScale(baseScale * deathScale(...))`로 적용.
 * 0초=1 → 중간(p=0.5)에서 peak로 부풀었다 → duration에서 1로 복귀 (sin 곡선).
 * @param elapsed 사망 후 경과시간 (sec).
 * @param duration 사망 연출 지속시간 (sec). 0 이하면 1 반환.
 * @param peak 최대 팝 배율 (예: 1.3).
 */
export function deathScale(elapsed: number, duration: number, peak: number): number {
  if (duration <= 0) return 1;
  const p = Math.max(0, Math.min(1, elapsed / duration));
  return 1 + (peak - 1) * Math.sin(p * Math.PI);
}

/**
 * 사망 페이드 알파 [0,1]. 호출부는 `sprite.color.a = 255 * deathAlpha(...)`로 적용.
 * @param elapsed 사망 후 경과시간 (sec).
 * @param duration 사망 연출 지속시간 (sec). 0 이하면 0 반환(즉시 투명).
 * @returns elapsed=0 → 1(불투명), duration 이상 → 0(투명). 선형 단조 감소.
 */
export function deathAlpha(elapsed: number, duration: number): number {
  if (duration <= 0) return 0;
  const p = Math.max(0, Math.min(1, elapsed / duration));
  return 1 - p;
}

/**
 * 사망 연출 종료 여부. true면 호출부가 노드를 destroy.
 * @param elapsed 사망 후 경과시간 (sec).
 * @param duration 사망 연출 지속시간 (sec).
 */
export function isDeathDone(elapsed: number, duration: number): boolean {
  return elapsed >= duration;
}
