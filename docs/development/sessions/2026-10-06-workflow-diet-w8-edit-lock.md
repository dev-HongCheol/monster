# 워크플로우 다이어트 W8 — 편집 잠금을 모든 코드로 넓히고, 고장 때는 멈춰서 확인받기

- **작성일:** 2026-10-09
- **브랜치:** `feat/workflow-diet`
- **만드는 것:** `.claude/hooks/gate-scripts.mjs` · `.claude/lib/phases.mjs` · `.claude/workflow.mjs`(`status` 출력과 전이 문구) 수정 · `tests/workflow/helpers/WfSandbox.ts`에 `runGateHook` 추가 · `CLAUDE.md` 두 줄 · 절차 문서 두 줄 · `troubleshooting/wf-tool-recovery.md` · `spec/ops-skill-routing.md`
- **정본:** [`spec/ops-skill-routing.md`](../spec/ops-skill-routing.md) — `/cso` 칸의 대체 규칙. 잠금 범위는 훅의 머리 주석과 `phases.mjs`의 JSDoc에 있다.
- **개요:** [계획 개요](2026-10-06-workflow-diet-plan.md)

---

## 1. 왜 하나

사용자 검증 단계에서 복구 문서(`wf-tool-recovery.md`)를 리뷰하다가 사용자가 두 가지를 짚었다(2026-10-09).

첫째, 훅은 게임 스크립트(`game/assets/scripts/**/*.ts`)만 phase로 막고 있었다. 워크플로우 도구, 훅, 테스트, `tools/` 스크립트는 어느 phase에서든 고칠 수 있었다. 그래서 사용자 검증이나 PR 승인 단계에서도 AI가 도구를 고쳐 막힌 검사를 지나갈 수 있었고, 복구 문서도 이것을 「방법 1」로 적고 있었다. 사용자는 모든 코드가 잠겨야 한다고 정했다.

둘째, 도구가 고장 났을 때 AI가 다른 길로 돌아가는 방법(도구를 고치는 브랜치를 따로 따기, 옛 도구로 상태 넘기기, `/cso` 대신 `security-review` 쓰기)이 문서에 있었지만, 쓰기 전에 사용자에게 알리고 확인받으라는 규칙은 옛 도구로 상태를 넘기는 방법에만 있었다. 사용자는 어느 방법이든 먼저 멈추고 알린 뒤 확인을 받고 쓰도록 정했다.

## 2. 무엇을 잠그나

| 파일 | 고칠 수 있는 phase |
|---|---|
| 저장소 안의 코드 파일(`.ts`·`.tsx`·`.mts`·`.cts`·`.js`·`.jsx`·`.mjs`·`.cjs`·`.py`·`.sh`·`.ps1`·`.cmd`·`.bat`) | `implementation`·`verification` |
| 그중 `tests/` 아래 코드 | `qa-setup`·`implementation`·`verification` |
| 고치면 훅이나 검사를 끌 수 있는 설정(`.claude/settings.json`·`.claude/settings.local.json`·`package.json`·`biome.json(c)`·`tsconfig*.json(c)`·`.husky/`) | `implementation`·`verification` |
| 상태 파일(`.claude/workflow-state.json`) | 없음(늘 `pnpm wf`로만) |
| 그 밖의 파일(문서, 데이터 `.json`, 저장소 밖 파일, `node_modules/`) | 잠그지 않는다. 저장소 밖에는 같은 저장소의 다른 작업 폴더도 들어간다 — 그쪽 phase는 보지 않는다 |

- **확장자로 가른다.** 폴더 목록으로 가르면 새 폴더에 스크립트를 두었을 때 잠금이 빠진다. 지금 저장소에서 코드 확장자를 가진 파일은 `.claude/`·`game/assets/`·`tests/`·`tools/`·루트 `vitest.config.ts`에만 있고, `docs/`에는 없다.
- **설정 파일도 잠근다.** 코드만 잠그면 `.claude/settings.json`에서 훅 등록을 지우거나 `package.json`·biome·tsconfig에서 검사 범위를 줄여 잠금과 검사를 끌 수 있다. `.claude/settings.local.json`도 잠근다. 개인 설정이지만 훅을 모두 끄는 설정(`disableAllHooks`)이나 환경변수를 넣을 수 있기 때문이다(코드 리뷰에서 짚었고 2026-10-09에 사용자가 잠그기로 정했다). `.vscode/settings.json`은 검사와 상관없는 편집기 설정이라 잠그지 않는다.
- **대소문자를 가리지 않고 판정한다.** Windows 파일 시스템은 대소문자를 가리지 않아서, `.CLAUDE/Settings.json`·`tools/a.MJS`처럼 대소문자만 바꾼 경로로 고쳐도 같은 파일이 바뀐다. 상태 파일 비교도 같다(코드 리뷰에서 찾았다).
- **테스트 코드는 `qa-setup`부터 연다.** RED 테스트를 `qa-setup`에서 쓰고 `ready-impl`이 그 테스트가 실패하는지 확인하기 때문이다. 테스트 폴더의 데이터 파일(`fixtures/*.json`)은 코드가 아니라서 원래 잠그지 않는다.

## 3. 훅의 짜임새

훅은 계속 다른 파일을 import하지 않는다(W4 §2). 그래서 `EDITABLE_PHASES`에 더해 `TEST_EDITABLE_PHASES`도 훅과 `phases.mjs`에 같은 값으로 두고, 두 값이 같은지 테스트가 잰다.

파일을 가르는 판정은 훅 안의 함수 `editablePhasesFor`로 꺼내 내보낸다. 테스트가 이 함수를 직접 불러 파일 종류를 하나하나 재고, 훅 프로세스는 phase와 파일 종류의 조합만 띄워서 확인한다. 모든 조합을 프로세스로 띄우면 120번쯤 띄우게 되어 테스트가 약 2초 늘었다.

훅은 import만 해도 입력을 기다리는 `main()`을 돌린다. 테스트는 환경변수 `GATE_HOOK_IMPORT_ONLY=1`을 켜고 import해서 `main()`을 건너뛴다. 다만 훅 파일을 직접 실행했으면 이 값과 상관없이 `main()`을 돈다. 이 값만 보면, 사용자 설정(`settings.local.json`의 env 등)에 이 값이 들어갔을 때 훅이 아무것도 하지 않아 잠금이 풀리기 때문이다(보안 점검 중에 찾았다). 직접 실행인지는 `process.argv[1]`의 파일 이름만 비교한다. 전체 경로를 비교하면 드라이브 문자 대소문자 같은 표기 차이로 어긋나서, 훅이 아무것도 하지 않고 끝날 수 있다.

막을 때 내는 문장에는 「다른 방법으로 돌아가지 말고 멈춘 뒤 사용자에게 알리고 확인을 받으세요」를 넣는다. AI가 막힌 뒤 바로 보는 글이 이 문장이기 때문이다.

## 4. 잠그면 생기는 일

- **도구가 고장 나면 AI 혼자서는 고칠 수 없는 phase가 생긴다.** `user-verification`·`pr-ready`·`done`에서 도구가 고장 나면, 사용자가 `리워크`를 입력하거나 옛 도구로 상태를 넘기도록 승인해야 고칠 수 있다. 사용자가 정한 「고장 때는 멈춰서 확인받기」와 같은 방향이라 그대로 둔다.
- **잠긴 phase에서는 `.claude/settings.json`·`.claude/settings.local.json`의 권한 규칙도 AI가 고칠 수 없다.** 사용자가 「이 명령 허용해 줘」라고 해도 훅이 막는다. 그때는 사용자가 직접 고치거나 구현 단계에서 고친다.
- **훅 자체가 죽으면 잠금이 풀린다.** Claude Code는 PreToolUse 훅이 종료 코드 2가 아닌 코드로 죽으면 편집을 막지 않는다(W4 §2). 훅에 문법 오류가 생겼을 때 그 오류를 고칠 길을 남기려고 이 동작을 그대로 둔다.
- **Bash로 고치는 것은 막지 않는다.** 훅은 Edit·Write 도구에만 걸려서, `sed`나 스크립트로 파일을 고치면 잠금을 거치지 않는다. 이번에 넓힌 범위뿐 아니라 원래 잠그던 게임 스크립트도 마찬가지다. Bash 명령을 읽고 어떤 파일을 고치는지 가르는 일은 이 묶음보다 커서 백로그로 보낸다(W7에 더한 새 항목).
- **저장소 밖의 설정은 잠그지 않는다.** 사용자 전역 설정(`~/.claude/settings.json`)에도 `disableAllHooks`를 넣을 수 있지만, 저장소 밖 파일이라 이 훅이 판정하지 않는다. Bash와 같은 백로그 항목에 함께 적는다.

## 5. 문서

- `CLAUDE.md` 「워크플로우 상태」의 훅 설명을 「코드 편집은 `implementation`·`verification`에서만(테스트는 `qa-setup`부터)」로 고치고, 「행동 규칙」에 「도구·검사 고장 시 우회 말고 멈춰 알린 뒤 확인받는다」를 더한다. 두 줄을 합쳐 글자 수가 늘지 않게 맞춘다(§4 제약).
- 절차 문서 `implementation.md`·`user-verification.md`의 「스크립트 편집」을 「코드 편집」으로 고친다. 절차 문서 합계 상한(13,575자)을 넘지 않는다.
- `wf-tool-recovery.md`는 「먼저 멈추고 사용자에게 알린다」 절을 앞에 두고, 「도구 파일은 언제든 고칠 수 있다」던 방법 1을 「다른 작업 폴더에서 새 슬라이스로 고친다」로 바꾼다.
- `ops-skill-routing.md`의 `/cso` 칸에서 「gstack이 고장 났으면 `security-review`로 대신한다」를 「멈추고 알린 뒤 확인을 받은 뒤에만 대신한다」로 고친다.

## 6. 테스트

`WorkflowDiet.test.ts`의 W8 절과 W4 절에 있다.

- `editablePhasesFor`가 코드·설정·테스트 코드·잠그지 않는 파일을 각각 맞게 가르는지.
- 훅 프로세스가 `planning`·`user-verification`·`pr-ready`·`done`에서 게임 스크립트·도구 코드·설정·테스트 코드를 모두 막고, `qa-setup`에서는 테스트 코드만 통과시키고, `implementation`·`verification`에서는 모두 통과시키는지.
- 저장소 밖 파일과 문서는 잠긴 phase에서도 통과하고, 절대 경로로 준 저장소 안의 코드는 막는지.
- 대소문자만 바꾼 경로(`.CLAUDE/Settings.json`·`.claude/WORKFLOW.MJS`·`.claude/Workflow-State.json`)도 막는지.
- 막는 문장에 phase와 「사용자에게 알리」가 들어 있는지.
- `GATE_HOOK_IMPORT_ONLY=1`이 켜진 환경에서 훅을 직접 띄워도 막는지.
- `pnpm wf status`가 `code editable: YES` · `tests only` · `no (locked)`를 phase에 맞게 출력하는지.
- 훅의 `EDITABLE_PHASES`·`TEST_EDITABLE_PHASES`가 `phases.mjs`와 같은지(W4 절).
