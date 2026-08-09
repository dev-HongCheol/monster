/**
 * 워크플로 절차 문서(`docs/development/workflow/`)와 phase 어휘의 정합 검사 — 디스크 접근 없는 순수 로직.
 *
 * phase마다 같은 이름의 절차 문서가 하나씩 있고 `pnpm wf` 전이가 그 문서를 배달한다. 매핑을 따로
 * 적어 두지 않고 **파일명 = phase 이름** 규약으로 파생하므로, 어긋나는 순간을 잡아 줄 곳이 필요하다.
 * 파일을 읽는 부분은 테스트가 맡고 여기서는 이미 읽힌 목록만 받아 이슈 2종을 산출한다 —
 * missing(배달할 문서가 없음)·unexpected(배달되지 않을 문서가 있음).
 *
 * **같은 판정이 `.claude/workflow.mjs`의 `check-docs`에도 있다**(그쪽은 CLI라 이 모듈을 import할 수
 * 없다). 규칙을 바꾸면 두 곳을 함께 고친다.
 */

/** 정합 이슈 종류 */
export type StepDocIssueType = 'missing' | 'unexpected';

/** 정합 위반 한 건 — 종류 + 파일명 */
export interface StepDocIssue {
  type: StepDocIssueType;
  name: string;
}

/**
 * 절차 문서를 두지 않는 phase.
 *
 * `done`은 슬라이스가 끝난 상태라 그 뒤에 밟을 절차가 없다. 면제하지 않으면 `pr-done`이 없는
 * `done.md`를 찾아 매 슬라이스 마지막마다 누락 경고를 헛발화한다.
 */
export const DOC_EXEMPT_PHASES: readonly string[] = ['done'];

/** phase 문서가 아니지만 있어야 하는 파일 — 계획부터 머지까지를 한 번에 훑는 통독 경로 */
export const STEP_DOC_INDEX = 'README.md';

const PHASES_BLOCK_RE = /const\s+PHASES\s*=\s*\[([\s\S]*?)\]/;
const QUOTED_RE = /['"]([^'"]+)['"]/g;

/**
 * `workflow.mjs` 소스에서 phase 어휘를 선언 순서대로 뽑는다.
 *
 * phase 이름의 진짜 출처는 그 파일의 `PHASES` 배열이므로, 목록을 여기 베껴 두면 한쪽만 늘었을 때
 * 아무도 모른다. 대신 소스를 읽어 파생한다.
 *
 * @param source `.claude/workflow.mjs`의 내용
 * @throws 배열을 찾지 못하면 예외. 빈 배열을 돌려주면 기대 문서가 0개가 되어 정합 검사가 조용히
 *   통과하므로, 파싱 실패는 침묵이 아니라 소리로 끝나야 한다.
 */
export function parsePhases(source: string): string[] {
  const block = PHASES_BLOCK_RE.exec(source);
  const phases = block ? [...block[1].matchAll(QUOTED_RE)].map((m) => m[1]) : [];
  if (phases.length === 0) {
    throw new Error(
      'workflow.mjs에서 PHASES 배열을 찾지 못했습니다 — 절차 문서 정합을 검사할 수 없습니다.',
    );
  }
  return phases;
}

/**
 * phase 어휘와 디스크의 파일 목록을 대조해 이슈를 찾는다. 0건이면 정합.
 *
 * - **missing**: 면제되지 않은 phase에 `<phase>.md`가 없다 — 그 전이에서 절차가 배달되지 않는다.
 * - **unexpected**: `.md`인데 배달 대상 phase 이름도 `README.md`도 아니다 — 아무도 읽지 않는 채로
 *   낡는 문서가 생긴다. 면제 phase의 문서(`done.md`)도 여기 걸린다.
 *
 * 판정은 **정확한 문자열 비교**다. `fs.existsSync`로 하면 대소문자를 무시하는 Windows에서 `Verification.md`
 * 오타가 통과하고 Linux에서만 깨진다. 반환 순서는 종류별 → 이름 사전순으로 고정한다.
 *
 * @param phases `workflow.mjs`의 phase 어휘 전체(면제 phase 포함)
 * @param filesOnDisk 절차 문서 디렉터리의 파일명 목록(`readdirSync` 결과)
 */
export function findStepDocIssues(
  phases: readonly string[],
  filesOnDisk: readonly string[],
): StepDocIssue[] {
  const expected = phases
    .filter((phase) => !DOC_EXEMPT_PHASES.includes(phase))
    .map((phase) => `${phase}.md`);
  const expectedSet = new Set(expected);
  const markdown = filesOnDisk.filter((name) => name.endsWith('.md'));
  const present = new Set(markdown);

  const issues: StepDocIssue[] = [];
  const push = (type: StepDocIssueType, names: string[]): void => {
    for (const name of [...names].sort()) issues.push({ type, name });
  };

  push(
    'missing',
    expected.filter((name) => !present.has(name)),
  );
  push(
    'unexpected',
    markdown.filter((name) => name !== STEP_DOC_INDEX && !expectedSet.has(name)),
  );

  return issues;
}
