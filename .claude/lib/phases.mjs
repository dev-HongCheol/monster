// @ts-check
/**
 * phase 어휘. `workflow.mjs`와 테스트가 함께 import한다 — 목록을 두 곳에 베껴 두면 한쪽만 늘었을 때
 * 아무도 모른다.
 *
 * 훅(`hooks/gate-scripts.mjs`)만은 이 파일을 import하지 않고 `EDITABLE_PHASES` 값을 직접 든다. Claude
 * Code는 PreToolUse 훅이 종료 코드 2가 아닌 코드로 죽으면 편집을 막지 않으므로, 훅이 다른 파일을
 * import하다 실패하면 경고만 하고 편집은 그대로 통과시킨다. 실패하면 막도록 바꾸면 이 파일에 문법 오류가
 * 하나 생겼을 때 그 오류를 고치려는 편집까지 막혀 빠져나올 길이 없다. 두 값이 같은지는
 * `WorkflowDiet.test.ts`가 잰다.
 */

/** phase 순서 = 정상 진행 순서. 상태 파일의 `phase`가 단일 진실이다. */
export const PHASES = [
  'planning',
  'qa-setup',
  'implementation',
  'verification',
  'user-verification',
  'pr-ready',
  'done',
];

/** 게임 스크립트(`game/assets/scripts` 아래 `.ts`) 편집이 허용되는 phase. 훅과 같은 값이어야 한다. */
export const EDITABLE_PHASES = new Set(['implementation', 'verification']);
