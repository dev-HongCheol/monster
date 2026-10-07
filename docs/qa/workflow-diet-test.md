# QA: 워크플로우 다이어트 1단계 (workflow-diet)

> - **브랜치:** feat/workflow-diet
> - **계획:** [2026-10-06-workflow-diet-plan.md](../development/sessions/2026-10-06-workflow-diet-plan.md) — 개요. 작업 묶음별 문서 W1~W7과 리뷰 기록이 거기서 이어진다
> - **요약:** `pnpm wf`가 변경 집합을 보고 해당 없는 검사(`.meta` · 게임 전체 타입 검사 · `/cso` · QA 문서)를 건너뛰고, 기계 검사 셋(biome · 타입 검사 · vitest)을 명령 하나(`verify`)로 돌리며, 두 곳에 복사된 판정 코드를 `.claude/lib/`에 하나로 합친다. **게임 코드 · 씬 · 프리팹 · 데이터는 전혀 건드리지 않는다.** 바뀌는 것은 개발 도구(`.claude/**`), 테스트 도우미, 절차 문서, `CLAUDE.md`, 백로그다.

---

## 1. Impact Map (회귀 기준)

| 변경 파일 | 확인 범위 |
|-----------|----------|
| `.claude/lib/*.mjs` | **신규 일곱 개**(`git` · `change-set` · `verify` · `transition` · `canon` · `workflow-steps` · `phases`). 상태 파일을 읽거나 쓰지 않는다. git을 실행하는 것은 `git.mjs`와 `change-set.mjs`뿐이고 나머지는 입력만 받아 답을 돌려준다. |
| `.claude/workflow.mjs` | `start-verification` · `pass` · `invalidate` · `rework` · `approve-pr` · `status` · `check-meta`가 바뀌고 `verify` · `skip-qa`가 새로 생긴다. **바뀌지 않아야 하는 것:** `start` · `approve-plan` · `ready-impl` · `canon*` · `steps` · `check-*` · `pr-done`의 동작과 절차 문서 배달. 기존 E2E 85건(`ClaudeMdSplit.test.ts` 56건 · `DocsHygiene.test.ts` 29건)이 그 회귀망이다. |
| `.claude/typecheck.mjs` | `runTypecheck`에 `capture` 옵션이 생기고 `// @ts-check`가 붙는다. `pnpm typecheck`의 동작은 그대로다. |
| `.claude/hooks/gate-scripts.mjs` | 고치지 않는다. `EDITABLE_PHASES` 값이 `phases.mjs`와 같은지만 테스트로 확인한다(W4 §2). |
| `.claude/workflow-state.json` | `cso_commit` · `qa_skip_reason` · 통합 검사 기록용 값 셋이 생긴다. 새 값이 없는 옛 형식 파일을 읽어도 멈추지 않아야 한다. |
| `tests/workflow/helpers/WfSandbox.ts` | **신규.** 임시 git 저장소 · 가짜 `pnpm` · 허용 목록이 있는 `git` 도우미. 테스트 파일에서 프로세스를 띄우는 코드가 전부 여기로 온다. |
| `tests/helpers/CanonDoc.ts` · `WorkflowSteps.ts` | **삭제.** 테스트는 `.claude/lib/canon.mjs` · `workflow-steps.mjs`를 import한다. |
| `tests/workflow/fixtures/fake-pnpm.mjs` | **신규.** 가짜 `pnpm`. 임시 폴더의 `bin/`에 복사돼 별도 프로세스로 돈다. |
| `tests/workflow/fixtures/workflow-state/user-verification-legacy.json` | **신규.** 2026-09-30 main의 실제 상태 파일(옛 형식). |
| `tests/workflow/WorkflowDiet.test.ts` · `tests/workflow/WfSandbox.test.ts` | **신규.** W1~W3의 새 테스트와 W5 도우미 테스트. 묶음을 시작할 때마다 그 묶음의 절을 더한다. |
| `ClaudeMdSplit.test.ts` · `DocsHygiene.test.ts`(→ `tests/workflow/`) · `EolPolicy.test.ts`(→ `tests/docs/`) · `CanonDoc.test.ts` | 자리와 도우미, import 경로만 바꾼다. **확인하는 내용은 바꾸지 않는다.** |
| `tests/` 폴더 구조 | 2026-10-07 사용자 결정으로 무엇을 검사하나(`logic` · `workflow` · `docs`)로 나눈다. 이 슬라이스는 새로 만들거나 고치는 파일만 옮기고 나머지는 백로그(W7 새 항목 10). 그래서 `ready-impl`이 기능 테스트를 `tests/*/<Feature>.test.ts`에서 찾고, `qaDocClean`이 띄우는 판정 파일 경로가 바뀐다. |
| `tsconfig.tests.json` · `biome.json` · `package.json` · `.gitignore` | `allowJs` + `.claude/lib/**` 포함 · `.claude/lib/**`만 biome 대상 + `vcs.useIgnoreFile` · lint-staged에 `mjs` · `cjs` · Claude Code가 만드는 파일 무시. biome이 검사하는 파일 수가 165개에서 `.claude/lib/**`만큼만 늘어야 한다. |
| `docs/development/workflow/*.md` · `CLAUDE.md` · `ops-skill-routing.md` · 트러블슈팅 문서 | 절차와 명령 표가 새 명령에 맞게 바뀐다. 매번 출력되는 절차 문서 여섯 개의 글자 수 합계가 지금(13,575자)보다 늘지 않아야 한다(W6 §1의 상한 테스트). |
| `docs/development/backlog*.md` | 닫는 항목 두 개(F78 · F95, 아카이브 이동은 `pr-ready`), 내용을 고친 항목 넷(F96 · F10 · F71 · F109. F61은 이미 맞았다), 새 항목 열 개(F118~F127). |

> **게임 실행 경로 변경 없음.** `game/assets/` 아래 파일이 하나도 바뀌지 않으므로 인게임 회귀 항목이 없다. 이 슬라이스의 회귀는 **다음 슬라이스에서 검사가 잘못 건너뛰어지거나 전이가 막히는 것**으로 나타난다. 그래서 자동 테스트가 대표 변경 집합 일곱 개의 판정을 고정하고(§4.2), §5.4가 머지 뒤 실제 폴더에서 한 바퀴 확인한다.

---

## 2. 씬/프리팹 변경 사항

**없음.** 신규 노드 · 프리팹이 없고 기존 씬을 열 필요도 없다.

## 3. 에디터 연결 체크리스트

**없음.** 신규 `@property`가 없어 에디터 작업이 없다.

---

## 4. 자동 테스트로 검증 (`tests/workflow/WorkflowDiet.test.ts` · `WfSandbox.test.ts` + 기존 파일 넷)

**통과 근거:** 2026-10-07 · 피처 테스트 123/123(`WorkflowDiet.test.ts` 113 · `WfSandbox.test.ts` 10) · `tests/workflow` 전체 248/249(건너뜀 1) · 전체 스위트 1236/1237(건너뜀 1) — `start-verification` 통합 검사의 vitest 줄(biome 통과 · typecheck 통과 범위 full).

> 이 슬라이스가 만드는 코드는 `.claude/lib/*.mjs`와 `workflow.mjs`의 명령 처리다. 입력만 받아 답하는 함수는 단위 테스트로, git을 실행하는 함수는 임시 저장소에서, 명령은 실제 프로세스를 띄워서 확인한다. 통합 검사까지 실제로 돌리는 처음부터 끝까지 테스트(E2E)는 여섯 개 이하로 둔다(Windows에서 한 건이 node를 약 다섯 번 띄운다). 묶음의 순서는 구현 순서(W5 → W1 → W4 → W2 → W3)다.

### 4.1 W5 — 시험용 임시 저장소 (`tests/workflow/helpers/WfSandbox.ts`, 테스트는 `tests/workflow/WfSandbox.test.ts`)

> 도우미 테스트를 `WorkflowDiet.test.ts`에 두지 않는 이유는 그 파일이 W1의 모듈을 import해서, 그 모듈이 생기기 전에는 불러오기에서 실패하기 때문이다. 도우미는 W1보다 먼저 만든다.

- [x] `git(dir, ...args)`가 허용 목록 밖의 하위 명령(`log` · `push`)과 전역 옵션(`-c` · `-C` · `--exec-path` · `--git-dir` · `--work-tree` · `--config-env`)을 받으면 예외를 던진다.
- [x] 가짜 `pnpm`이 `exec tsc` · `exec biome`에 성공으로 끝난다.
- [x] 가짜 `pnpm`이 `--outputFile`이 있는 `exec vitest run`에 「실패 0건」 결과 파일을 쓰고 성공한다.
- [x] `WF_SHIM_FAIL=vitest`를 주면 `--outputFile`이 있는 호출만 실패하고, 없는 호출(QA 판정)은 그대로 성공한다.
- [x] 기존 E2E 85건(`ClaudeMdSplit.test.ts` 56건 · `DocsHygiene.test.ts` 29건, 건너뜀 1건)이 도우미로 옮긴 뒤에도 같은 내용을 확인한다. 확인하는 내용은 바꾸지 않는다. (2026-10-07 검증 단계에서 main과 테스트 이름을 대조했다. `ClaudeMdSplit.test.ts`는 55건이다 — W4가 `workflow.mjs`에서 `PHASES` 배열을 읽어 내던 파서를 없애고 `phases.mjs`를 import하게 해서 그 파서 테스트 둘이 빠졌고, W6 상한 테스트가 하나 늘었다. 이름만 바꾼 테스트가 둘이다(「네 검증」 → 「판단 검사」). `DocsHygiene.test.ts`는 29건 그대로다.)
- [x] `EolPolicy.test.ts`의 git 실행이 `tests/helpers/DocFs.ts`로 옮겨져, `helpers/`·`fixtures/` 밖의 `tests/` 파일이 프로세스 모듈을 import하지 않는다(§4.2의 마지막 항목이 잰다).

### 4.2 W1 — 변경 집합과 적용 판정 (`.claude/lib/change-set.mjs`)

- [x] 변경 집합: 추적 파일 수정(`M`) · 새 파일(`A`) · 삭제(`D`) · 이름 바꾸기(`D` + `A`) · 공백과 한글이 든 파일명 · `git add`만 한 새 파일(`A`) · 커밋하지 않은 수정(`M`) · `T`는 `M`으로.
- [x] 변경 집합에서 상태 파일과 git이 추적하지 않는 `*.meta`가 빠진다.
- [x] 구할 수 없는 경우 여섯 가지(`origin/main` 없음 · 공통 조상 없음 · git 저장소 아님 · 하위 폴더 · git 출력 못 받음 · `U` 글자)에 `measurable: false`가 되고, 네 검사가 모두 「적용」이며, 안내 문구가 W1 §2.1 표와 같다.
- [x] 대표 변경 집합(문서만 · 도구만 · 순수 로직 테스트만 · 워크플로우 테스트 파일만 · 테스트 도우미 · 추적하지 않는 `.meta`만 · 그림과 `.meta` · 게임 TypeScript · 게임 프로젝트 설정)의 판정이 W1 §4 표와 같다. 테스트 파일은 영역과 관계없이 `/cso` 해당 없음이고 `helpers/` · `fixtures/`는 적용이다.
- [x] 게임 프로젝트 설정 줄의 `fullTypecheck` 기대값은 「적용」이다 (확정 — 2026-10-07에 Cocos 3.8 매뉴얼 「Engine Modules」로 확인했다. `cc` 모듈의 내용은 Feature Cropping 설정에 따라 달라지고 그 설정은 `game/settings/v2/packages/engine.json`에 저장되므로, 설정이 바뀌면 Cocos가 만드는 `cc.d.ts`가 바뀐다. 계획 §11).
- [x] 적용이면 `matches`에 해당 파일 경로가, `rule`에 해당한 적용 경로가 든다.
- [x] 폴더 경계 셋: `toolsmith/x`는 `tools/**`가 아니다 · `game/elsewhere/x.ts`는 게임 전체 타입 검사에 해당한다 · `.Claude/`는 `.claude/`와 같은 폴더다 (확정 — W1 §3.1의 pathspec 시험 뒤 경로 비교를 직접 짠 코드로 하기로 해서 이 항목을 둔다, 2026-10-07).
- [x] `csoBaseUsable`: 값 없음 → 「기록 없음」, 조상 → 쓸 수 있음, 조상 아님 → 「지금 HEAD의 조상이 아님」, 저장소에 없음 → 「지금 저장소에 없는 커밋」.
- [x] 파일 내용으로 확인하는 것 셋: 저장소 `.gitignore`에 Claude Code가 만드는 파일 열한 개가 적혀 있다 · 게임 코드가 `.json`을 import하지 않는다 · `helpers/` · `fixtures/` 밖의 `tests/` 파일이 `child_process` · `worker_threads`를(접두사 `node:` 유무와 관계없이) import하지 않는다.

### 4.3 W4 — 두 곳에 복사된 판정 코드 합치기 (`canon.mjs` · `workflow-steps.mjs` · `phases.mjs`)

- [x] `workflow.mjs`가 `canon.mjs` · `workflow-steps.mjs` · `phases.mjs`를 import한다.
- [x] 훅 `gate-scripts.mjs`의 `EDITABLE_PHASES` 값이 `phases.mjs`의 값과 같다(훅은 import하지 않고 값만 맞춘다).
- [x] lint-staged 대상에 `mjs`가 있다.
- [x] `CanonDoc.test.ts`가 `canon.mjs`를 import하고 지금 확인하는 내용을 그대로 확인한다.
- [x] `ClaudeMdSplit.test.ts`에서 「판정 코드가 두 곳에 복사돼 있다」를 전제로 하던 확인이 「한 모듈에 있다」로 바뀐다.

### 4.4 W2 — 통합 검사와 전이 판정 (`verify.mjs` · `transition.mjs`)

- [x] `decideTransition`: 모두 통과하면 다음 phase로 넘어가고 적을 값이 맞다 · 통합 검사가 타입·린트·테스트로 실패하면 넘어가지 않고 통과 표시 둘과 정본 갱신 기록이 지워지며 QA 문서 해시값이 적히고 `cso_commit`과 기록용 값 셋은 남는다 · 형식 차이만 있는 실패 · 실행기를 못 띄운 경우 · 결과 없이 끝난 경우에는 넘어가지 않되 통과 표시는 그대로다 · `/cso` 해당 없음이면 `cso_done`이 거짓이어도 통과한다 · QA 문서와 정본 갱신 기록에서 막힌다 · 앞 조건에서 막혔으면 `needsVerify`가 거짓이다 · 통과 표시가 다 차지 않았으면 `needsQa`가 거짓이고 다 찼고 QA 문서가 필요하면 참이다.
- [x] `qaRequired`: W2 §6 표의 네 줄.
- [x] `runVerify`(시험용 실행기): 전부 성공 · 일부 실패 · 전부 실패의 결과와 출력 모양(검사마다 한 줄에 시간, vitest 줄의 개수 다섯 가지, 실패한 검사만 상세) · 실행 순서 biome → 타입 검사 → vitest · 실행기를 못 띄운 경우(`ENOENT`, stdout이 비고 9009/127) · `ENOBUFS` · vitest가 결과 없이 끝남 · 결과 파일이 깨짐 · 「파일 실패 1 · 테스트 실패 0」 · 형식만 실패 · 린트 실패 두 가지 · `--no-write`와 `user-verification`에서 biome에 `write: false`가 전달된다.
- [x] 옛 형식 상태 파일을 읽는 다섯 곳: `ready-impl`과 `pass`는 QA 문서를 요구한다 · `status`는 「QA 문서 생략: 없음」을 출력하고 멈추지 않는다 · `invalidate`와 `start-verification`은 전체 `/cso`를 안내한다.
- [x] 명령 테스트(임시 저장소): `pass ts`가 안내와 함께 실패한다 · `/cso` 해당 없음일 때 `pass cso`가 「기준 커밋만 기록한다」를 출력하고 `cso_commit`만 적는다 · `pass cso`가 `cso_commit`을 적는다 · `invalidate`가 `/cso` 표시를 지우고 `cso_commit`과 기록용 값 셋은 남긴다 · `/cso`를 해야 하는데 `pass cso` 전에 `pass review`를 치면 통합 검사가 돌지 않는다 · `skip-qa`가 `game/**` 변경이 있으면 거부하고 `--clear` 뒤 `status`가 「QA 문서 생략: 없음」을 출력하며 `origin/main` 없는 저장소에서 W2 §6 넷째 줄의 안내가 나온다 · `verify`가 세 phase에서 돌고 phase와 `cso_done` · `code_review_clean` · `canon_*` · `qa_doc_fingerprint`를 건드리지 않으며 `planning`에서는 거부한다 · `cso_commit`이 `HEAD`의 조상이 아닐 때 전체 `/cso`를 안내한다.
- [x] E2E 여섯 개 이하: `start-verification` 성공(`verification`으로 넘어가고 기록용 값 셋이 적힌다) · `start-verification` 실패(`WF_SHIM_FAIL=vitest`, 넘어가지 않고 실패로 적힌다) · `verify`는 phase가 바뀌지 않는다 · `pass review` 실패는 넘어가지 않고 통과 표시가 지워진다 · `pass review` 형식만 실패는 통과 표시가 남는다 · `skip-qa` 뒤 `game/**` 변경이 생기면 QA 문서 없이는 `pass review`가 넘어가지 않는다.
- [x] `ClaudeMdSplit.test.ts`의 세 테스트(「전체 pass → user-verification」 · 「막힌 뒤 기록하고 다시 치면 넘어간다」 · 「canon-done이 기록하면 넘어간다」)가 가짜 `pnpm`으로 계속 통과한다.

### 4.5 W3 — `approve-pr` · `status` · `check-meta`

- [x] `approvePrDecision`의 여섯 경우: 타입 검사 실패면 막힌다 · 「적용」/「해당 없음」과 `.meta` 누락·타입 검사 범위를 조합한 네 경우 · `measurable: false`면 `logic-only`를 거부한다.
- [x] `formatGateLines`의 출력 문자열이 고정된다.
- [x] 옛 형식 상태 파일 견본으로 `status`가 적용 판정 표와 「다음 /cso: 전체 (기록 없음)」을 출력하고 `approvePrDecision`이 판정을 낸다. `cso_commit`이 조상이면 `--diff --base` 명령을 출력한다.
- [x] `approve-pr`을 실제 프로세스로 실행하면 적용 판정 표가 타입 검사 결과보다 먼저 나오고 `pr-ready`로 넘어간다.
- [x] `status`와 `approve-pr` 거부 출력의 마지막 줄이 「절차: …」다.

### 4.6 W6 — 문서의 글자 수 상한

- [x] 매번 출력되는 절차 문서 여섯 개의 글자 수 합계가 상한을 넘지 않는다(`ClaudeMdSplit.test.ts`의 상한 테스트, W6 §1).

---

## 5. 수동 테스트 체크리스트

사용자가 에디터를 열 일은 없다. 아래는 터미널에서 명령을 치고 출력을 보는 확인이다.

### 5.1 구현 단계 — 통합 검사가 실제 실패를 실패로 읽는가 (첫 `start-verification` 전)

테스트는 시험용 실행기와 가짜 `pnpm`으로만 실패를 만들고, 그 출력은 짐작해서 만든 것이다. 실제 biome 요약이나 vitest 결과 파일과 모양이 다르면 테스트는 통과하는데 도구는 실제 실패를 통과로 읽을 수 있다. 그래서 하나씩 일부러 넣고 되돌린다. 여기서 친 명령은 계획 §12의 명령 수에 넣지 않는다.

- [x] 타입 오류 하나를 넣고 `pnpm wf start-verification` → 넘어가지 않고 `typecheck: 실패`가 찍힌다. 되돌린다.
- [x] 린트 위반 하나를 넣고 `pnpm wf start-verification` → 넘어가지 않고 biome 줄이 실패로 찍힌다. 되돌린다.
- [x] 실패하는 테스트 하나를 넣고 `pnpm wf start-verification` → 넘어가지 않고 vitest 줄이 실패로 찍힌다. 되돌린다.

**결과(2026-10-07, W2 직후).** 세 문제를 임시 파일 세 개로 한꺼번에 넣고 `start-verification`을 한 번 쳤다. 통합 검사는 하나가 실패해도 셋을 다 돌리므로, 한 번의 실행으로 세 검사가 각각 실패를 읽는지 볼 수 있다. 종료 코드 1, phase는 `implementation` 그대로였고, 마지막 줄은 「절차: `pnpm wf steps implementation`」이었다. 확인 뒤 세 파일을 지웠다.

| 넣은 문제 | 임시 파일 | 출력 |
|---|---|---|
| 타입 오류(`const n: number = 'x'`) | `tests/logic/FaultType.ts` | `typecheck: 실패` — `FaultType.ts(1,14): error TS2322` |
| 자동으로 고쳐지지 않는 린트 위반(`a == 1`) | `tests/logic/FaultLint.ts` | `biome: 실패 · 린트 위반` — `noDoubleEquals` 1건 |
| 실패하는 테스트(`expect(1).toBe(2)`) | `tests/logic/FaultTest.test.ts` | `vitest: 실패 · 파일 51개 · 통과 1216 · 실패 1 · 파일 실패 1 · 스킵 1`, 다시 돌려 볼 명령에 그 파일이 들어감 |

린트 위반은 `==`처럼 biome이 고치지 못하는 것이어야 한다. `start-verification`은 biome을 고치는 모드로 돌리므로, 따옴표나 들여쓰기처럼 고칠 수 있는 위반은 고친 뒤 통과한다.

### 5.2 검증 단계 — `pass review` 전

`pass`는 `verification` phase에서만 받으므로 이때 한다.

- [x] 이 브랜치에서 `pnpm wf status`가 `meta: 해당 없음` · `fullTypecheck: 해당 없음` · `cso: 적용`을 보여 주고, 갈라진 커밋과 항목 수, 「다음 /cso」 줄이 나온다. (2026-10-07: 「갈라진 커밋 5c9d741 · 변경 61개」, `cso: 적용 (.claude/lib/canon.mjs 외 20개)`, 「다음 /cso: 전체 (기록 없음)」)
- [x] `pnpm wf pass ts`가 안내 문구와 함께 실패한다. (2026-10-07: 종료 코드 1, 「타입·린트 결과는 통합 검사가 기록한다 — … `pnpm wf verify`」)
- [x] `pnpm wf verify`가 검사마다 한 줄씩 결과와 걸린 시간을 내고 phase가 그대로다. (2026-10-07: biome 405ms · typecheck 범위 full 2,536ms · vitest 파일 50개 통과 1236 스킵 1 21,435ms · 합계 24,376ms, phase=verification 그대로)
- [ ] `/cso`를 통과한 뒤 코드를 고치고 `pnpm wf invalidate` → `status`의 「다음 /cso」가 `/cso --diff --base <cso_commit>`으로 바뀐다.

### 5.3 PR 전

- [ ] 새 `.meta`가 하나도 없다(`pnpm wf check-meta`, `git status`). 하나라도 있으면 `.meta` 「해당 없음」 판정이 틀린 것이다.
- [ ] `pnpm wf approve-pr`이 적용 판정 표를 타입 검사 결과보다 먼저 출력하고 `pr-ready`로 넘어간다.

### 5.4 머지 뒤 — 원래 폴더(`F:\work\monster`)에서

- [ ] main을 받은 뒤 `pnpm wf status`가 돈다.
- [ ] 다음 슬라이스의 `pnpm wf start <feature>`가 돈다. 고장 나 있으면 W6에서 만드는 복구 문서대로 한다.

### 5.5 구현하면서 재서 적는 것 (계획 §10)

- [x] W4에서 옮길 코드를 타입 검사 대상에 넣는 비용: 함수 하나를 먼저 옮겨 고칠 양을 재고, `typecheck.mjs`에 `@ts-check`를 붙이는 비용도 함께 잰다. (2026-10-07 측정: `allowJs`를 켠 뒤 tsc 오류는 넷이었다 — `.claude/lib/*.mjs` 다섯 파일 0건(JSDoc을 처음부터 붙였다), `typecheck.mjs` 1건(`runTsc`의 인자 타입), 테스트 3건(`collectChangeSet` 결과의 합집합 타입을 `measured()`로 좁히기). 고치는 데 든 것은 함수 하나와 도우미 둘이다.)
- [x] W6의 글자 수 표 둘을 실제로 구현한 문구로 다시 잰다. (2026-10-07: 절차 문서 여섯 개 합계 13,575자로 main과 같다 — verification 3,599 · qa-setup 2,866 · user-verification 3,129 등. W6 표 밖에서도 다른 정본이 이미 든 내용을 옮겨 적은 문장을 줄여 맞췄다. `CLAUDE.md`는 11,294자로 main 11,301자보다 7자 적다.)
- [x] 통합 검사 한 번에 걸리는 시간을 「전체 테스트」와 「임시 저장소 테스트 파일만」으로 나눠 적는다. 비교 기준은 2026-09-30의 약 7초(vitest 약 3.6초 · 타입 검사 약 2.7초 · biome 약 0.5초)다. (2026-10-07: **기준보다 크게 늘었다.** 통합 검사 약 24초 — vitest 약 21초 · 타입 검사 약 2.5초 · biome 약 0.4초. vitest를 `tests/workflow`만 돌리면 파일별 소요가 `WorkflowDiet.test.ts` 18.9초 · `ClaudeMdSplit.test.ts` 3.8초 · `WfSandbox.test.ts` 3.6초 · `DocsHygiene.test.ts` 2.5초이고, 늘어난 시간 대부분이 `WorkflowDiet.test.ts`의 임시 git 저장소 테스트다.)

---

## 이력

- 2026-10-07 — 작성(`qa-setup`). §4의 항목은 계획 묶음 문서 W1~W6의 「테스트」 절과 `/autoplan` Eng 리뷰의 테스트 계획에서 옮겼다. 자동 테스트 파일은 W5 · W1 절만 먼저 썼고, 나머지 절은 묶음을 시작할 때 더한다.
