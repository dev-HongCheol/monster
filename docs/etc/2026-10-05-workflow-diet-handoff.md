# 워크플로우 다이어트 — 다음 세션이 이어받는 자리 (2026-10-05, 2026-10-09 갱신)

새 세션(다른 장비 포함)이 이 문서 하나만 읽고 이어 갈 수 있게 적었다. 계획 초안과 함께 최종 PR 전에 지운다.

## 1. 지금 어디에 있나

- 브랜치 `feat/workflow-diet`, phase `verification`(2026-10-07 `start-verification` 통과). 구현 묶음 일곱(W5 → W1 → W4 → W2 → W3 → W6 → W7)이 모두 끝났고 커밋됐다. 작업 트리는 깨끗하고 상태 파일도 커밋돼 있어 다른 장비로 옮겨도 phase가 따라간다. 푸시는 안 했다.
- 커밋: `7bfc5e2`(계획 문서) · `0a767c2`(`tests/` 구조 + W5) · `31042a8`(W1) · `df54f74`(W4) · `7474ddb`(W2) · `fabdc85`(W3) · `271058f`(W6) · `2d1849a`(W7) · `7c19f58`(QA 문서 §4 확정 + 상태 파일).
- 검증 단계에서 이미 한 것: QA 문서 §4 전부 `[x]`와 통과 근거(피처 123/123 · 전체 1,236/1,237), §5.1 · §5.2 세 항목 · §5.5 손 확인 결과 기록, `pnpm wf check-qa` 통과, `pnpm wf canon-done`으로 정본 여덟 개(절차 문서 여섯 + `CLAUDE.md` + `spec/ops-skill-routing.md`) 기록. `/cso`와 코드 리뷰는 아직 안 했다(`cso_done` · `code_review_clean` 둘 다 거짓).
- 지금 상태의 확인 결과: 전체 테스트 50 파일 1,236 통과(건너뜀 1) · `pnpm typecheck` 통과(범위 full) · biome 깨끗 · `check-docs` · `check-links` 통과.

## 2. 다음에 할 일

**먼저 할 일 — 테스트 시간 줄이기(2026-10-09 사용자와 합의, 이 슬라이스 안에서 한다).** 통합 검사 한 번이 약 24초인데 계획의 비교 기준은 약 7초다(vitest 3.6초 → 21초). 늘어난 것은 거의 `tests/workflow/WorkflowDiet.test.ts`(18.9초)이고, 원인은 테스트 98개 가운데 약 35개가 임시 폴더에 git 저장소를 처음부터 만들고(`makeRepo` — 커밋 셋, git 약 열 번) 그 안에서 `workflow.mjs`를 프로세스로 띄우기 때문이다. 판정 규칙은 파일 경로와 확장자만 보므로 대부분은 git 없이 확인할 수 있다. 사용자에게는 「통합 검사 = 명령, vitest = 그 안의 검사 하나, `WorkflowDiet.test.ts` = vitest가 돌리는 파일 하나」로 구분해 설명했고, 임시 저장소가 GitHub에 가지 않는 로컬 폴더라는 것도 확인해 드렸다.

고치는 방향 셋. **도구(`.claude/**`)는 건드리지 않는다.** 확인하는 내용도 바꾸지 않는다 — 테스트 이름을 지우지 말고 입력 방식만 바꾼다.

- 가. 적용 판정(`applicableGates`) · QA 필요 판정(`qaRequired`) · 전이 판정(`decideTransition`)은 테스트가 변경 집합 객체(`{ measurable: true, base, items: [{ status, path }] }`)를 손으로 적어 함수를 직접 부른다. W1의 「대표 변경 집합」 표와 「폴더 경계」 절이 첫 대상이다.
- 나. 실제 git 저장소는 「git이 목록을 맞게 주는가」를 재는 `collectChangeSet` 테스트(수정 · 새 파일 · 삭제 · 이름 바꾸기 · 한글 파일명 · `git add`만 한 파일 · 구할 수 없는 경우들)와 `csoBaseUsable`에만 남긴다.
- 다. `runWf`로 명령을 실제로 띄우는 테스트는 함수만 불러서는 안 보이는 것(종료 코드 · 출력 순서 · 실패 뒤 상태 파일에 남는 값)만 남긴다. 같은 상황을 쓰는 테스트는 저장소를 하나 만들어 돌려쓰고, git이 필요 없으면 `makeRepo({ git: false })`를 쓴다. E2E 여섯 개 이하 규칙(W2 §8)은 그대로다.

하지 않는 것(2026-10-09에 사용자에게 설명하고 합의): 도구가 바뀐 파일 목록을 환경변수나 상태 파일에서 읽게 만들지 않는다. 그러면 `pnpm wf pass review`를 칠 때 목록을 바꿔 넣어 `/cso`를 건너뛸 수 있다 — 계획 §2.2가 기각한 「환경변수로 실행기를 바꿔 끼우는 장치」와 같은 뒷문이다. 목록은 언제나 git에서 가져오고, 저장해 두면 낡는다(계획 §2.1의 2026-09-16 결정). 목표는 vitest를 기준(약 3.6초) 가까이로 되돌리는 것이다.

그다음 순서(절차 문서 `verification.md`대로).

1. 테스트 코드를 고쳤으므로 `pnpm wf invalidate`(판단 검사 기록은 아직 없지만 정본 기록을 지우고 QA 해시값을 새로 찍는다) → `pnpm wf verify`로 통과와 시간을 확인한다.
2. QA 문서 §5.5의 시간 측정 항목에 고친 뒤 값을 더한다(지금 적힌 약 24초는 「고치기 전」으로 남긴다). §4 통과 근거의 테스트 수가 바뀌면 함께 고친다.
3. `pnpm wf canon-done`을 같은 여덟 경로로 다시 친다(`invalidate`가 지운다).
4. 커밋.
5. `/cso`를 처음부터 전체로 돈다(`status`의 「다음 /cso」 줄이 「전체 (기록 없음)」이다) → `pnpm wf pass cso`. 제출 규칙은 메모리 `feedback_cso_helper_submission`.
6. `superpowers:requesting-code-review`로 서브에이전트 리뷰 → `docs/qa/workflow-diet-review-issues.md` → `pnpm wf pass review`(넘기기 직전에 통합 검사를 한 번 더 돌린다).
7. `user-verification`: 문서 정리 · Draft PR. **최종 PR 전에 지울 것:** 이 인계 문서와 `docs/etc/2026-10-05-workflow-diet-*.md` 초안 넷(계획 개요 §9).

**함께 처리할 것 — 동그라미 숫자.** 2026-10-09에 전역 규칙이 생겼다. 문서와 터미널 출력에 `①②③`을 쓰지 않고 `가.` `나.` `다.`를 쓴다(`~/.claude/CLAUDE.md`). 이 브랜치가 새로 적은 줄 가운데 동그라미 숫자가 든 곳은 `backlog-implement.md` 5줄(F10 · F126 · F127) · `backlog-docs.md` 1줄(F96) · `backlog.md` 1줄(F109) · 계획 개요 15줄 · 리뷰 기록 4줄 · W2 문서 1줄 · 초안 3줄이다. 이 슬라이스의 문서는 아직 고칠 수 있으므로(`docs-references.md` §9) PR 전에 바꾼다. 다른 슬라이스가 쓴 옛 줄은 건드리지 않는다.

### 묶음별로 문서와 다르게 한 것

1. **W2 — 끝.** 문서와 다르게 한 것: `start-verification` 성공 출력의 적용 판정 표는 W3의 `formatGateLines`가 생길 때 붙인다 · `qaRequired`는 `(state, changeSet)`를 받는다(구할 수 없을 때의 안내 문구가 changeSet에 있다) · vitest 파일 수는 `testResults` 길이로 센다(`numTotalTestSuites`는 describe까지 센다) · 가짜 `pnpm`에 `WF_SHIM_FAIL=biome-format`(형식 차이만 실패)을 더했다 · `ENOBUFS`는 실제 실패로 센다.
2. **W3 — 끝.** 문서와 다르게 한 것: `formatGateLines`는 `csoBaseUsable` 결과를 넷째 인자로 받는다(함수가 git을 부르지 않게) · `approve-pr`은 타입 검사가 실패해도 `.meta` 검사까지 하고 막는 이유를 한 번에 낸다 · `status` 마지막 줄을 「절차: `pnpm wf steps <phase>`」로 바꿨다. 이 브랜치의 `status`는 계획 §7대로 meta·fullTypecheck 해당 없음, cso 적용을 보여 준다.
3. **W6 — 끝.** 절차 문서 여섯 개 합계 13,575자(main과 같음, 상한 테스트 `ClaudeMdSplit.test.ts`의 `STEP_DOC_LIMIT`) · `CLAUDE.md` 11,294자(main 11,301자). 합계를 맞추려고 W6 표 밖에서도 다른 정본이 이미 든 내용을 옮겨 적은 문장(PR 본문 규칙 목록 · 문서 참조 조항 나열 · `pnpm typecheck` 각주 경로)을 줄였다. 옛 절차를 가리키던 코드·테스트 주석 일곱 곳도 고쳤다(사용자 지시).
4. **W7 — 끝.** 새 항목 F118~F127. F96 · F10 · F71 · F109의 내용을 고쳤고 F61은 이미 맞아 그대로 뒀다. F78 · F95는 상태만 「진행중」으로 바꿨다 — 아카이브 이동은 `pr-ready.md`대로 `pr-ready`에서 한다. 그때 `backlog-docs.md` 「문서 규칙 · 절차 문서」 머리 문장도 F95가 빠진 상태와 맞는지 본다.

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
- **측정값이 계획의 기준과 크게 다르면 그 묶음을 보고할 때 바로 짚는다.** 2026-10-07에 W2를 마치고 `verify`를 돌렸을 때 vitest가 이미 17.9초(기준 3.6초)였는데 숫자만 보여 주고 늘었다고 말하지 않아, 사용자가 검증 단계 보고에서야 알았다. 사용자가 「프로젝트 지식 누락이 점점 증가하고 있다 — 마지막 결과물을 알릴 때 캐치하고 있다」고 했다(2026-10-09).
- **같은 말로 다른 것을 가리키지 않는다.** 「통합 검사」(명령) · 「vitest」(그 안의 검사 하나) · 「`WorkflowDiet.test.ts`」(vitest가 돌리는 파일 하나)를 섞어 써서 사용자가 「통합 테스트 파일이 왜 git 저장소를 만드나」로 읽었다. 도구 · 검사 · 테스트 파일을 가를 때는 이름을 따로 쓴다.
- **동그라미 숫자(①②③)를 쓰지 않는다.** 순서는 `가.` `나.` `다.`로 적는다(2026-10-09 전역 규칙, `~/.claude/CLAUDE.md`).
- **초안은 원래 `docs/temp/`에 쓰고, 정리된 내용만 세션 문서로 쓴다.** `docs/etc/`에는 새 문서를 만들지 않는다. 이 슬라이스의 초안 넷만 사용자 결정(2026-10-05)으로 `docs/etc/`에 그대로 두고, 최종 PR 전에 지운다. 다른 곳으로 옮기지 않는다.

## 6. 다른 장비에서 시작할 때

1. `git fetch origin` 뒤 `feat/workflow-diet`를 받는다.
2. `pnpm install`을 돌린다. 3D 슬라이스가 의존성을 바꿨다.
3. 그 장비에서 Cocos Creator로 프로젝트를 한 번도 열지 않았으면 테스트 대부분이 불러오기에서 실패한다. Cocos가 만드는 `game/temp/tsconfig.cocos.json`이 필요하다. 프로젝트를 한 번 연다.
4. `pnpm wf status`로 `workflow-diet` · `planning`인지 확인한다.
5. `.claude/settings.local.json`은 git에 없다. 그 장비에 확인창 규칙이 없으면 위 네 명령에 확인창이 뜨지 않는다. 그래도 사람이 확인하는 지점은 사용자가 말할 때만 실행한다.

## 7. 함께 열려 있는 것

- **PR #94** — 문서 작성 규칙에 「비유나 작업하며 지어낸 이름으로 설명을 대신하지 않는다」를 넣었다. 머지를 기다린다. 먼저 머지되면 계획 초안 W6의 수치 둘이 바뀐다(글자 수 여유 478자 → 301자, 절차 문서 합계 13,575자 → 13,560자). 계획 초안에 두 경우를 다 적어 두었다.
