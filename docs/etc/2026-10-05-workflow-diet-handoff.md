# 워크플로우 다이어트 — 다음 세션이 이어받는 자리 (2026-10-05, 2026-10-07 갱신)

새 세션(다른 장비 포함)이 이 문서 하나만 읽고 이어 갈 수 있게 적었다. 계획 초안과 함께 최종 PR 전에 지운다.

## 1. 지금 어디에 있나

- 브랜치 `feat/workflow-diet`, phase `implementation`. 계획은 승인됐고(2026-10-07 `approve-plan`), QA 문서와 실패하는 테스트를 쓴 뒤 `ready-impl`을 통과했다.
- 구현 순서는 W5 → W1 → W4 → W2 → W3 → W6 → W7이고, **W5 · W1 · W4 · W2가 끝났다.** 다음은 W3다.
- 커밋: `7bfc5e2`(계획 문서) · `0a767c2`(`tests/` 구조 + W5) · `31042a8`(W1) · `df54f74`(W4) · W2 커밋(`git log --oneline -1 -- .claude/lib/verify.mjs`). 푸시는 사용자가 말할 때 한다.
- **`docs/qa/workflow-diet-test.md`만 일부러 커밋하지 않았다.** 자동 검증 절에 `[ ]` 항목이 남은 채 커밋하면 레포 전체 검사(`tests/workflow/DocsHygiene.test.ts`)가 그것을 잡아 `start-verification`이 막힌다. 검증 단계에서 `[x]`로 채우고 통과 근거를 적은 뒤 커밋한다. **다른 장비로 옮기면 이 파일은 따라가지 않는다** — 이 장비에서 이어 하거나 파일을 따로 옮긴다.
- 지금 상태의 확인 결과(W2 뒤): 전체 테스트 50 파일 1,216 통과(건너뜀 1) · `pnpm typecheck` 통과(범위 full) · biome 깨끗 · 이 저장소에서 `pnpm wf verify --no-write`가 실제 도구로 세 검사 모두 통과. 계획 §7의 손 확인(타입 오류 · 린트 위반 · 실패 테스트를 넣어 `start-verification`이 막히는지)도 끝났고 결과는 QA 문서 §5.1에 있다(QA 문서는 미커밋).

## 2. 다음에 할 일

작업 단위는 W(작업 묶음)다. **묶음 하나를 끝낼 때마다 멈추고 사용자 확인을 받는다**(2026-10-07 사용자 지시). 커밋은 사용자가 말할 때 하되 묶음 단위로 나눈다. 묶음을 시작할 때 그 묶음 문서의 「테스트」 절을 `tests/workflow/WorkflowDiet.test.ts`에 절로 먼저 쓰고 실패를 확인한 뒤 구현한다(W5·W1·W4 절이 그렇게 되어 있다).

1. **W2 — 끝.** 문서와 다르게 한 것: `start-verification` 성공 출력의 적용 판정 표는 W3의 `formatGateLines`가 생길 때 붙인다 · `qaRequired`는 `(state, changeSet)`를 받는다(구할 수 없을 때의 안내 문구가 changeSet에 있다) · vitest 파일 수는 `testResults` 길이로 센다(`numTotalTestSuites`는 describe까지 센다) · 가짜 `pnpm`에 `WF_SHIM_FAIL=biome-format`(형식 차이만 실패)을 더했다 · `ENOBUFS`는 실제 실패로 센다.
2. **W3 — `approve-pr` · `status` · `check-meta`.** 옛 형식 상태 파일 견본은 `tests/workflow/fixtures/workflow-state/user-verification-legacy.json`에 있다. `formatGateLines`를 만들면 `start-verification` 성공 출력에도 붙인다(W2 §2). `status`의 `QA 문서 생략` 줄은 W2가 먼저 만들어 두었다.
3. **W6 — 절차 문서 · `CLAUDE.md` · 트러블슈팅 · `ops-skill-routing.md`.** 글자 수 상한 테스트. `qa-setup.md`와 `CLAUDE.md`의 기능 테스트 경로는 `tests/<영역>/<Feature>.test.ts`로 이미 바뀌어 있다.
4. **W7 — 백로그.** 새 항목은 열 개다(9: `wf status` JSON · `check-links` · `check-qa` 비용, 10: `tests/` 구조의 나머지). 번호는 `origin/main`의 마지막 번호 다음부터.
5. 그다음 `pnpm wf start-verification`으로 검증 단계. QA 문서를 `[x]`로 채우고 커밋 · `canon-done` · `/cso` · `pass` … 절차는 그때 배달되는 문서대로.

W2부터 지키는 것 셋.

- **`tests/` 구조.** 새로 만들거나 고치는 파일은 영역 폴더로 둔다 — `tests/workflow/`(워크플로우 도구) · `tests/docs/`(문서 규칙), 각 안에 `helpers/` · `fixtures/`. 기존 게임 테스트(`tests/logic/`)와 `tests/helpers/`의 기존 파일은 옮기지 않는다(W7 새 항목 10). 테스트 파일은 프로세스를 직접 띄우지 않고 `helpers/`를 거친다(`WorkflowDiet.test.ts`가 잰다).
- **블록 주석 안에 `**/` 글롭을 쓰지 않는다.** `*/`로 읽혀 주석이 닫힌다(W5에서 한 번 났다). 글롭은 줄 주석에 쓴다.
- **`.claude/lib/*.mjs`는 첫 줄 `// @ts-check`, 내보내는 함수마다 JSDoc(`@param` · `@returns` · `@typedef`).** `pnpm typecheck`가 이 파일들을 검사하고(`allowJs`) biome도 검사한다(홑따옴표 · 세미콜론). `workflow.mjs`·`typecheck.mjs`는 biome 대상이 아니다(쌍따옴표 그대로).

`/autoplan`이 이 장비에서 막혔던 원인은 이렇다(2026-10-06에 확정). gstack의 진입 검사(`autoplan/bin/phase-publication-hook.ts`)는 지금 실행하려는 도구 호출이 Claude Code의 세션 기록 파일에 2초 안에 적혀 있기를 요구하는데, Claude Code 2.1.289는 그 호출 기록을 진입 검사(PreToolUse 훅)가 끝난 뒤에야 쓴다. 그래서 세션 길이와 상관없이 첫 단계 진입에서 막혔다(「세션이 길어서 3.1초가 걸렸다」는 2026-10-05의 틀린 진단이다). 사용자가 패치(`docs/temp/2026-10-06-gstack-autoplan-in-flight-entry.patch`, git 밖)를 `cd ~/.claude/skills/gstack && git apply <패치>`로 넣어 돌게 했다. gstack 자동 업데이트가 패치를 밀어내면 다시 넣는다. AI는 이 파일을 못 고친다(자동 모드 분류기가 「자기 수정」으로 막는다).

다음 `/autoplan`에서 지킬 것은 셋이다. `gstack-autoplan-snapshot.ts`의 명령은 다른 명령이나 파이프와 묶지 않고 단독으로 실행한다. 단계 보고는 「Phase N complete.」 한 줄만 따로 보낸다(긴 글은 세션 기록에 요약으로 적혀 검사가 못 찾는다). 그리고 도중에 사용자가 말을 걸면 진입 검사가 그 호출을 끝난 것으로 봐서 뒤의 Read·Agent가 「identity is unavailable after this invocation ended」로 막히고 되살릴 길이 없다 — 컨텍스트가 차면 새 세션이 아니라 `/compact`로 잇는다.

## 3. 사용자가 정한 것

| 날짜 | 결정 |
|---|---|
| 2026-09-16 | 줄일 것은 슬라이스 시간, AI가 읽는 양, 도구 유지비 셋이다. 사람이 확인하는 지점은 줄이지 않는다 |
| 2026-09-30 | 옛 계획(커밋 `211ae71`)은 「내용은 괜찮았고 사정이 바뀌어 맞지 않게 됐다」. 옛 계획을 바탕으로 바뀐 곳만 다시 맞춘다 |
| 2026-09-30 | 전제 아홉에 동의(설계 문서 「전제」) |
| 2026-10-05 | 접근은 축소형 A다. 두 단계를 유지하고, 2단계는 약속 넷만 지금 적는다 |
| 2026-10-05 | 코드를 고친 뒤의 `/cso`는 바뀐 부분만 다시 본다. 2026-09-17의 「대상 파일 목록이 같으면 다시 하지 않는다」를 뒤집었다 |
| 2026-10-07 | 점검에 걸린 `wf status` · `check-links` · `check-qa`는 이 슬라이스에 넣지 않고 따로 한다(W7 새 항목 9). 확인은 작업 묶음(W) 하나가 끝날 때마다 받는다 |
| 2026-10-07 | `tests/` 아래를 무엇을 검사하나로 나눈다(`logic` · `workflow` · `docs`, 각 안에 `helpers/` · `fixtures/`). 새로 만들거나 고치는 파일만 옮기고 나머지와 `logic/` 세분화는 W7 새 항목 10. Eng 리뷰는 다시 돌리지 않는다 |

## 4. 문서가 어디에 있나

git에 있는 것(어느 장비에서나 보인다):

| 문서 | 무엇인가 |
|---|---|
| `docs/development/sessions/2026-09-16-workflow-tooling-diet-brief.md` | 요구사항, 실측, 범위, 제약 |
| `docs/etc/2026-10-05-workflow-diet-design-draft.md` | 설계 문서. 무엇을 그대로 두고 무엇을 고치는지의 결정 기록 |
| `docs/development/sessions/2026-10-06-workflow-diet-plan.md` + `…-w1-change-set.md` ~ `…-w7-backlog.md` + `…-review.md` | 리뷰를 반영한 계획(개요 · 작업 묶음 일곱 · 리뷰 기록). 구현은 이것을 본다 |
| `docs/etc/2026-10-05-workflow-diet-plan-draft.md` | 계획 초안. `/autoplan` 리뷰 기록이 붙은 마지막 모습이고, 위 세션 문서가 이어받았다 |
| `docs/etc/2026-10-05-workflow-diet-w6-wording-draft.md` | `CLAUDE.md`와 절차 문서에서 바꿀 문구의 초안. 계획 초안의 글자 수 표가 이 문구로 잰 값이다 |
| 커밋 `211ae71` | 옛 계획 문서 아홉. `git show 211ae71 --stat`으로 목록을 본다 |

사용자가 두 문서를 읽을 때의 순서는 이렇게 안내했다.

- **설계 문서 먼저.** 「문제」, 「전제」, 「검토한 접근」, 「1단계에서 고치는 것」(표, M1~M18. 여기가 핵심), 「1단계에서 빼는 것」, 「2단계 — 약속 넷」. 「다른 검토자의 의견」과 「Reviewer Concerns」는 건너뛰어도 된다.
- **계획 초안 다음.** §1, §2.1, §3, §6, §7, 그리고 W6의 표 둘. W1~W5와 W7은 `/autoplan` 리뷰어가 본다.
- 설계 문서의 「2단계 — 약속 넷」과 계획 초안 §6은 같은 내용이다.

이 장비(Windows)에만 있고 git에 없는 것:

| 무엇 | 어디 | 없으면 |
|---|---|---|
| 두 검토의 원문(Claude 서브에이전트, GPT) | `docs/temp/2026-09-30-workflow-diet-gpt-review/` 폴더의 `11`·`12` 파일 | 결론은 설계 문서와 계획 초안에 다 옮겼다. 세부 근거만 못 본다 |
| 사용자용 전체 그림 설명 | `docs/temp/2026-10-03-workflow-diet-overview.md` | 2026-10-05의 결정 셋이 빠져 있어 지금은 맞지 않는 곳이 있다. 사용자가 원하면 고쳐 준다 |
| `/autoplan` 테스트 계획 | `~/.gstack/projects/dev-HongCheol-monster/Choi-HC-feat-workflow-diet-eng-review-test-plan-20261006-125851.md` | QA 문서를 쓸 때 옮겨 적을 확인 항목이고, 내용은 리뷰 기록 Eng 단계 「테스트 검토」에도 있다 |
| 설계 문서 리뷰 기록 세 회차 | `~/.gstack/projects/dev-HongCheol-monster/` 아래 설계 문서 이름 뒤에 `.review.R4lrng`가 붙은 폴더 | 마지막 지적은 설계 문서 끝에 그대로 있다 |
| gstack의 결정 기록, Claude 메모리 | `~/.gstack`, `~/.claude` | 다른 장비의 Claude는 이 문서로 대신한다 |

## 5. 사용자와 일할 때 지킬 것

다른 장비에는 이 장비의 메모리와 전역 설정이 없으므로 여기 적는다.

- **쉬운 한국어로 말한다.** 작업하며 지어낸 이름(「되감기」, 「낡다」, 「지문」, 「장부」)을 쓰지 않고, 실제로 일어나는 일을 문장으로 쓴다. 사용자가 2026-10-05에 「되감기가 뭘 말하는 거고 낡았다는 게 뭘 뜻하는지 모르겠어」라고 지적했다. 문서 규칙에도 넣었다(PR #94, 2026-10-05 현재 머지 전).
- **한 번에 너무 많이 주지 않는다.** 사용자가 「너무 많은 내용이라 다 파악이 힘들어」라고 했다. 결정이 필요한 것은 하나씩, 무엇을 고르면 무엇이 달라지는지와 함께 묻는다.
- **터미널에 파일 경로를 쓸 때 경로 바로 뒤에 조사를 붙이지 않는다.** VS Code 터미널이 조사까지 링크로 잡는다. 「`index.md` 파일을」처럼 명사를 넣거나 경로를 문장 끝에 둔다.
- **리뷰는 서브에이전트로 띄운다.** `/autoplan`과 코드 리뷰가 그렇다.
- **확인창이 뜨는 명령은 미리 말한다.** `pnpm wf start`·`approve-plan`·`approve-pr`·`rework`다.
- **절차가 시키는 커밋 말고는, 커밋과 푸시는 사용자가 말할 때 한다.**
- **초안은 원래 `docs/temp/`에 쓰고, 정리된 내용만 세션 문서로 쓴다.** `docs/etc/`에는 새 문서를 만들지 않는다. 이 슬라이스의 초안 넷만 사용자 결정(2026-10-05)으로 `docs/etc/`에 그대로 두고, 최종 PR 전에 지운다. 다른 곳으로 옮기지 않는다.

## 6. 다른 장비에서 시작할 때

1. `git fetch origin` 뒤 `feat/workflow-diet`를 받는다.
2. `pnpm install`을 돌린다. 3D 슬라이스가 의존성을 바꿨다.
3. 그 장비에서 Cocos Creator로 프로젝트를 한 번도 열지 않았으면 테스트 대부분이 불러오기에서 실패한다. Cocos가 만드는 `game/temp/tsconfig.cocos.json`이 필요하다. 프로젝트를 한 번 연다.
4. `pnpm wf status`로 `workflow-diet` · `planning`인지 확인한다.
5. `.claude/settings.local.json`은 git에 없다. 그 장비에 확인창 규칙이 없으면 위 네 명령에 확인창이 뜨지 않는다. 그래도 사람이 확인하는 지점은 사용자가 말할 때만 실행한다.

## 7. 함께 열려 있는 것

- **PR #94** — 문서 작성 규칙에 「비유나 작업하며 지어낸 이름으로 설명을 대신하지 않는다」를 넣었다. 머지를 기다린다. 먼저 머지되면 계획 초안 W6의 수치 둘이 바뀐다(글자 수 여유 478자 → 301자, 절차 문서 합계 13,575자 → 13,560자). 계획 초안에 두 경우를 다 적어 두었다.
