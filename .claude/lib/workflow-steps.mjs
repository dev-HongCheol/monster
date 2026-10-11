// @ts-check
/**
 * 워크플로 절차 문서(`docs/development/workflow/`)와 phase 어휘의 정합 판정 — 디스크 접근 없는 순수 로직.
 *
 * phase마다 같은 이름의 절차 문서가 하나씩 있고 `pnpm wf` 전이가 그 문서를 배달한다. 매핑을 따로
 * 적어 두지 않고 **파일명 = phase 이름** 규약으로 파생하므로, 어긋나는 순간을 잡아 줄 곳이 필요하다.
 * 파일을 읽는 부분은 부르는 쪽(`workflow.mjs`의 `check-docs`, 테스트)이 맡고 여기서는 이미 읽힌 목록만
 * 받아 이슈 2종을 산출한다 — missing(배달할 문서가 없음)·unexpected(배달되지 않을 문서가 있음).
 * 문서를 실제로 읽고 출력하는 배달 함수는 `workflow.mjs`에 있다.
 */

/** @typedef {'missing' | 'unexpected'} StepDocIssueType */
/** @typedef {{ type: StepDocIssueType, name: string }} StepDocIssue */

/** 절차 문서가 사는 폴더(저장소 루트 기준, 구간별). */
export const STEP_DOC_DIR = ['docs', 'development', 'workflow'];

/** phase 문서가 아니지만 있어야 하는 파일 — 계획부터 머지까지를 한 번에 훑는 통독 경로. */
export const STEP_DOC_INDEX = 'README.md';

/**
 * 절차 문서를 두지 않는 phase.
 *
 * `done`은 슬라이스가 끝난 상태라 그 뒤에 밟을 절차가 없다. 면제하지 않으면 `pr-done`이 없는
 * `done.md`를 찾아 매 슬라이스 마지막마다 누락 경고를 헛발화한다.
 */
export const DOC_EXEMPT_PHASES = new Set(['done']);

/**
 * phase 어휘와 디스크의 파일 목록을 대조해 이슈를 찾는다. 0건이면 정합.
 *
 * - **missing**: 면제되지 않은 phase에 `<phase>.md`가 없다 — 그 전이에서 절차가 배달되지 않는다.
 *   `README.md`도 기대 대상이다. 계획부터 머지까지를 한 번에 읽을 경로가 그것뿐이라, 없으면
 *   분할이 없앤 통독 가능성을 되살릴 방법이 사라진다.
 * - **unexpected**: `.md`인데 기대 목록에 없다 — 아무도 읽지 않는 채로 낡는 문서가 생긴다.
 *   면제 phase의 문서(`done.md`)도 여기 걸린다.
 *
 * 판정은 **정확한 문자열 비교**다. `fs.existsSync`로 하면 대소문자를 무시하는 Windows에서
 * `Verification.md` 오타가 통과하고 Linux에서만 깨진다. 반환 순서는 종류별 → 이름 사전순으로 고정한다.
 *
 * @param {readonly string[]} phases phase 어휘 전체(면제 phase 포함)
 * @param {readonly string[]} filesOnDisk 절차 문서 폴더의 파일명 목록(`readdirSync` 결과)
 * @returns {StepDocIssue[]}
 */
export function findStepDocIssues(phases, filesOnDisk) {
  const expected = [
    STEP_DOC_INDEX,
    ...phases.filter((phase) => !DOC_EXEMPT_PHASES.has(phase)).map((phase) => `${phase}.md`),
  ];
  const expectedSet = new Set(expected);
  const markdown = filesOnDisk.filter((name) => name.endsWith('.md'));
  const present = new Set(markdown);

  /** @type {StepDocIssue[]} */
  const issues = [];
  /**
   * @param {StepDocIssueType} type
   * @param {string[]} names
   */
  const push = (type, names) => {
    for (const name of [...names].sort()) issues.push({ type, name });
  };

  push(
    'missing',
    expected.filter((name) => !present.has(name)),
  );
  push(
    'unexpected',
    markdown.filter((name) => !expectedSet.has(name)),
  );

  return issues;
}
