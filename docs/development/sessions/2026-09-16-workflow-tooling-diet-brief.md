# 워크플로우 다이어트 — 착수 전 범위와 제약 (2026-09-16)

- **작성일:** 2026-09-16
- **브랜치:** `feat/workflow-diet` · worktree `F:\work\monster-wf` · `main`의 `02eb7be`에서 `pnpm wf start workflow-diet`로 `planning`에 들어왔다
- **정본:** 없음 — 계획 전에 범위와 제약을 모은 기록이라 명세를 바꾸지 않는다. 무엇을 줄일지는 뒤에 쓸 계획 문서가 정한다

---

## 1. 이 문서가 무엇인가

워크플로우 다이어트를 계획하면서 실제로 쓸 것만 모았다. 이번 슬라이스의 범위, 진행 중인 3D 슬라이스와 부딪히는 자리, 이 worktree에서 `pnpm wf`를 고치고 시험할 때 알아야 할 사실이다. 이 worktree를 만든 경위와 같은 worktree에서 할 다른 작업의 인계는 세션을 이어 가기 위한 기록이라 레포에 넣지 않았다. 계획 문서를 쓸 때 여기 적힌 제약을 그 안에 녹인다.

파일명에 피처 이름 `workflow-diet`를 넣지 않은 데는 이유가 있다. `approve-plan` 게이트는 `docs/development/sessions/`에서 파일명에 피처 이름이 든 `.md`를 하나 찾기만 한다(`.claude/workflow.mjs`의 `planDocPath`). 이 문서 이름에 `workflow-diet`가 들어가면, 계획 문서를 쓰기 전에도 게이트가 이 문서를 계획 문서로 알고 통과시킨다.

## 2. 범위

이번 슬라이스는 워크플로우 자체를 줄인다. 손댈 수 있는 곳은 `pnpm wf` 상태 머신(`.claude/workflow.mjs`와 그 테스트), phase별 절차 문서(`docs/development/workflow/`), `CLAUDE.md`의 「Workflow」 절이다. 무엇을 줄일지는 아직 정하지 않았고 `/office-hours`에서 정한다.

아래 둘은 이번 슬라이스에서 하지 않는다.

- **서브에이전트 리뷰를 `agy`(안티그래비티)로 돌리는 일.** 영향도가 작은 리뷰를 골라 옮기는 작업인데, 어떤 리뷰가 영향도가 작은지는 다이어트 뒤에 어떤 리뷰가 남느냐에 달려 있다. 게다가 두 작업이 같은 절차 문서의 리뷰 줄을 고치므로 따로 진행하면 충돌한다. 그래서 다이어트가 끝난 뒤 같은 worktree에서 한다.
- **세션 문서·정본 정리와 3D 캐릭터 슬라이스 정리.** 원래 폴더(`F:\work\monster`)에서 그 슬라이스 도중이나 끝난 뒤에 한다. 문서 정리는 슬라이스 결과에 맞춰 연쇄적으로 일어나므로 슬라이스가 끝나야 한다는 것이 사용자의 판단이다(2026-09-16).

## 3. 진행 중인 3D 슬라이스와 부딪히는 자리

원래 폴더는 `feat/blender-3d-gate`의 `qa-setup` 단계에 있다(2026-09-16 상태 파일 기준). 그 브랜치는 3D 캐릭터 워크플로우가 확정돼야 main에 들어간다. 그래서 다이어트가 먼저 머지되면, 그 슬라이스는 나중에 main을 받으면서 다이어트의 결과를 한꺼번에 받는다.

### 3.1 phase 이름과 상태 파일 구조를 바꾸면 옛 상태를 읽어야 한다

그 슬라이스는 main을 받기 전까지 옛 `workflow.mjs`로 돈다. 다이어트가 phase 이름이나 `.claude/workflow-state.json`의 구조를 바꾸면, 그 슬라이스가 main을 받는 순간 새 `workflow.mjs`가 `qa-setup` 단계의 옛 상태 파일을 읽게 된다. 새 도구가 그 파일을 읽지 못하면 그 슬라이스는 다음 전이에서 막히거나 진행 상태를 잃는다. 그래서 호환을 지키거나 상태를 옮기는 절차를 계획에 함께 둔다.

2026-09-16에 그 슬라이스의 상태 파일이 가진 키는 아래와 같다.

```
feature · phase · test_skipped · test_skip_reason · ts_check_scope
canon_updated · canon_skip_reason · qa_doc_fingerprint · docs_delivered
verification { cso_done · ts_check_clean · lint_clean · code_review_clean }
```

### 3.2 상태 파일은 구조를 안 바꿔도 충돌한다

`.claude/workflow-state.json`은 git이 추적하는 파일이고 두 브랜치가 모두 바꾼다. 지금 관행대로 다이어트 PR이 이 파일의 최종 상태를 커밋한 채 main에 들어가면, 3D 슬라이스가 main을 받을 때 이 파일에서 충돌이 난다. 상태 파일을 커밋할지 말지는 [`backlog-implement.md`](../backlog-implement.md)의 F10이 열어 둔 결정이다.

### 3.3 메모리는 두 폴더가 함께 쓴다

Claude 자동 메모리는 같은 저장소의 worktree끼리 한 폴더를 쓴다. 그래서 이 폴더에서 절차를 바꾸는 메모리(리뷰 규칙 `feedback_subagent_reviews.md`나 워크플로우 준수 규칙 `feedback_follow_workflow.md` 같은 것)를 고치면, 원래 폴더 세션도 다음에 메모리를 읽을 때부터 그 내용을 따른다. 그 세션은 옛 절차 문서를 든 브랜치에 있으므로 문서와 메모리가 서로 다른 절차를 말하게 된다. 그런 메모리는 이 슬라이스의 PR을 머지할 때 고친다.

### 3.4 같은 파일을 고치면 머지 때 충돌한다

3D 브랜치는 `CLAUDE.md`의 ADR 목록에 한 줄(ADR 009)을 더했고, 백로그 세 파일에 `F105`~`F108` 네 행을 더했다. 다이어트가 같은 파일을 고치면 그 슬라이스를 머지할 때 충돌이 난다. 충돌은 작지만 알고 들어간다.

백로그에 새 항목을 더할 때는 `F109`부터 쓴다. 백로그 머리말은 새 번호를 `origin/main` 기준으로 따라고 하는데, 지금 main의 마지막 번호가 `F102`라 그대로 따르면 `F103`이 나온다. 그런데 3D 브랜치 계획 문서에 따르면 `F103`·`F104`는 다른 슬라이스(`feat/staff-layer`·`feat/local-art-pipeline`)가 이미 잡았고, `F105`~`F108`은 main에 아직 없는 3D 브랜치가 쓴다. main만 보고 번호를 따면 두 브랜치가 머지되는 순간 한 번호를 두 항목이 나눠 갖는다.

### 3.5 정본 이력 방침은 앞질러 정하지 않는다

`pnpm wf canon`은 새 정본을 만들 때 `이력:` 줄과 「이력 절에는 날짜와 무엇이 바뀌었는지만 한 줄 남긴다」는 문장을 찍어 넣는다(`.claude/workflow.mjs`의 `renderCanonDoc`). 이력을 어떻게 남길지는 원래 폴더에서 나중에 할 문서 정리가 정할 일이다. 다이어트에서 이 템플릿이나 [`docs-references.md`](../spec/docs-references.md) §11의 규칙을 건드리면 그 결정을 먼저 내려 버리게 되므로, 건드려야 하면 사용자와 먼저 맞춘다.

## 4. 이 worktree에서 `pnpm wf`를 고치고 시험할 때

### 4.1 훅과 설정은 Claude를 실행한 폴더의 것이 돈다

`.claude/settings.json`의 PreToolUse 훅은 Write·Edit·MultiEdit 때 `$CLAUDE_PROJECT_DIR/.claude/hooks/gate-scripts.mjs`를 부른다. 그리고 `gate-scripts.mjs`·`workflow.mjs`·`typecheck.mjs`는 셋 다 `CLAUDE_PROJECT_DIR`를 루트로 쓰고, 그 값이 비어 있을 때만 현재 폴더를 쓴다. 그래서 원래 폴더에서 실행한 Claude가 이 폴더의 파일을 고치면 원래 폴더의 훅이 돈다. 그 훅은 이 폴더의 경로를 자기 루트 밖(`../monster-wf/...`)으로 읽으므로 아무것도 검사하지 않는다. 훅을 고치고 시험하는 일은 이 폴더에서 실행한 Claude로 한다.

### 4.2 전이 시험은 실제 상태 파일이 아니라 임시 폴더에서 한다

지금 이 폴더의 `.claude/workflow-state.json`은 이 슬라이스의 `planning` 상태이고 아직 커밋하지 않았다. 여기서 `pnpm wf start <다른 이름>` 같은 전이를 시험 삼아 돌리면 이 슬라이스의 상태가 초기화된다. `git restore`로 되돌려도 소용없다. 커밋된 옛 상태(`ai-matting`의 `done`)로 돌아갈 뿐이라 이 슬라이스의 상태는 그대로 사라진다.

그래서 전이를 바꾸는 시험은 기존 테스트가 하는 방식을 따른다. `tests/logic/ClaudeMdSplit.test.ts`의 `runWf`와 `tests/logic/DocsHygiene.test.ts`의 `wfStart`는 임시 폴더를 만들고 `CLAUDE_PROJECT_DIR`를 그 폴더로 지정한 채 실제 `workflow.mjs` 프로세스를 띄운다. 실제 상태 파일에서 꼭 돌려야 하면 파일을 먼저 복사해 둔다.

`pnpm wf start <이름>`은 상태만 초기화하지 않고 이 폴더의 브랜치도 `feat/<이름>`으로 바꾼다. 그 브랜치가 없으면 로컬 `main`에서 새로 자르고, 로컬 `main`이 `origin/main`보다 뒤처져 있으면 막는다(`ensureFeatureBranch`·`requireCurrentBase`). git은 다른 worktree가 체크아웃한 브랜치를 체크아웃하지 못하게 하므로, 원래 폴더의 `feat/blender-3d-gate`는 이 폴더에서 열 수 없다.

### 4.3 사람 게이트 명령에는 확인창이 뜬다

`.claude/settings.local.json`의 `ask` 규칙이 `pnpm wf start`·`approve-plan`·`approve-pr`·`rework` 넷을 Bash와 PowerShell 양쪽에서 확인받게 한다. 2026-09-14에 사용자 동의로 넣은 규칙이고, auto 모드에서도 명시적 `ask` 규칙은 확인창을 띄운다. 넣은 이유는 명령마다 다르다. `wf start`는 phase를 보지 않고 상태를 전부 초기화하므로 잘못 실행되는 것을 막으려는 것이다. 나머지 셋은 사람이 판단하는 게이트라서, AI가 사용자 말 없이 실행하려 할 때 확인창이 두 번째 잠금이 되게 하려는 것이다. 2026-09-16에는 이 확인창이 막아 둔 사용자 설정(`blockReadsOutsideWorkingDirectories`)이 되살아난 것으로 오인된 적이 있다.

이 파일은 git이 추적하지 않는다. 이 폴더의 것은 2026-09-16에 원래 폴더에서 복사했고, 복사한 뒤로 두 파일은 따로 바뀐다. auto 모드는 설정 파일 수정을 자기 권한을 바꾸는 동작으로 보고 막으므로, 이 파일은 사용자가 직접 고친다.

### 4.4 새 worktree에서는 Cocos 생성 파일을 채워야 테스트가 돈다

`game/tsconfig.json`이 이어받는 `game/temp/tsconfig.cocos.json`은 Cocos가 프로젝트를 열 때 만드는 파일이고 git이 추적하지 않아서 새 worktree에는 없다. 이 파일이 없으면 vitest가 게임 로직 파일을 변환하다 그 tsconfig를 찾지 못해, 47개 테스트 파일 중 39개가 불러오는 단계에서 실패한다. 이 폴더에는 원래 폴더의 `game/temp/tsconfig.cocos.json`과 `game/temp/declarations/`를 복사해 채웠다(2026-09-16). 복사한 뒤 기준선은 `pnpm vitest run` 47개 파일 861개 통과(1개 스킵)와 `pnpm typecheck` full 범위 통과였다.

이 증상은 트러블슈팅 문서 [`typescript-version-pin.md`](../troubleshooting/typescript-version-pin.md)에 없다. 그 문서는 타입체크 쪽 증상만 적는다.

## 5. 다이어트에서 다룰 수 있는 것으로 이미 드러난 것

범위에 넣을지는 `/office-hours`에서 정한다.

- `approve-plan` 게이트가 계획 문서를 파일명으로만 찾는다(§1).
- `wf start`에 phase 가드가 없어서 진행 중인 슬라이스도 초기화한다. 지금은 확인창이 그 자리를 막고 있다(§4.3).

슬라이스 시작 때 백로그 세 파일을 열어 다이어트와 걸리는 항목을 골랐다.

| 항목 | 파일 | 다이어트와 걸리는 자리 |
|---|---|---|
| F10 | [`backlog-implement.md`](../backlog-implement.md) | 상태 파일 커밋 정책. §3.2의 충돌이 이 결정에 달려 있다 |
| F71 | [`backlog-docs.md`](../backlog-docs.md) | 절차를 `pnpm wf` 배달로 옮긴 뒤의 준수율 관찰. 절차 문서를 줄이면 배달되는 내용이 바뀐다 |
| F95·F96 | [`backlog-docs.md`](../backlog-docs.md) | 의무 독서 예산. 배달되는 절차 문서의 부피를 재지 않고, 상한까지 여유가 거의 없다 |
| F78 | [`backlog-docs.md`](../backlog-docs.md) | `insertCanonRow`가 `workflow.mjs`와 테스트 헬퍼에 두 벌 있어 한쪽만 고쳐도 초록불이다 |
| F86 | [`backlog-docs.md`](../backlog-docs.md) | `wf status`가 검색 색인 지연을 알리게 하는 설계. 다음 도구 슬라이스로 미뤄 둔 항목이다 |
