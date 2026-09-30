# 워크플로우 다이어트 — 요구사항과 제약 (2026-09-16)

- **작성일:** 2026-09-16 · 제약과 수치는 2026-09-30에 `main`의 `5c9d741` 기준으로 다시 확인했다
- **브랜치:** `feat/workflow-diet` · worktree `F:\work\monster-wf` · phase `planning`
- **정본:** 없음 — 계획 전에 요구사항과 제약을 모은 기록이라 명세를 바꾸지 않는다. 무엇을 어떻게 줄일지는 뒤에 쓸 계획 문서가 정한다

---

## 1. 이 문서가 무엇인가

워크플로우 다이어트 계획이 출발하는 자리다. 사용자가 무엇을 줄이고 싶어 하는지(§2), 그 판단에 쓴 실측(§3), 손댈 수 있는 범위(§4), 계획이 지켜야 할 제약(§5), 이 worktree에서 `pnpm wf`를 고치고 시험할 때 알아야 할 사실(§6), 계획에서 다룰 후보(§7)를 적는다. 설계는 여기 없다. 설계는 `/office-hours`와 `/autoplan`을 거쳐 계획 문서가 정한다.

이 슬라이스는 2026-09-16~17에 계획 문서와 리뷰를 한 번 마쳤다. 2026-09-30에 사용자가 계획 문서부터 전부 다시 검토하기로 했고, 옛 계획을 고쳐 쓰지 않고 요구사항만 남긴 채 계획을 새로 세우기로 정했다. 그래서 옛 계획이 세운 전제와 설계 결정은 이 문서에 옮기지 않았다. 옛 계획 문서 아홉은 이 브랜치의 커밋 `211ae71`에 남아 있다.

파일명에 피처 이름 `workflow-diet`를 넣지 않은 데는 이유가 있다. `approve-plan` 게이트는 `docs/development/sessions/`에서 파일명에 피처 이름이 든 `.md`를 하나 찾기만 한다(`.claude/workflow.mjs`의 `planDocPath`). 이 문서 이름에 `workflow-diet`가 들어가면, 계획 문서를 쓰기 전에도 게이트가 이 문서를 계획 문서로 알고 통과시킨다.

## 2. 요구사항 (사용자, 2026-09-16)

- **아깝다고 짚은 것.** 규모와 무관하게 모든 슬라이스가 같은 9단계 전 과정을 도는 것이다. 어느 한 단계가 아깝다는 말이 아니다.
- **줄이고 싶은 부담 셋.** 슬라이스에 드는 시간, AI가 읽는 양, 도구 유지비다.
- **줄일 대상이 아닌 것.** 사람 개입과 확인은 줄일 대상으로 고르지 않았다.

## 3. 실측

### 3.1 도구 슬라이스 넷의 구간별 비용 (2026-09-16 측정)

이 장비의 세션 기록에서 완료된 도구 슬라이스 넷을 쟀다. `docs-references`(`3253727`), `docs-hygiene`(`f4eb4b8`), `eol-policy`(`9ee8519`), `docs-guard-cut`(`7067cb2`)이고, 2026-08-18~20에 진행했으며 넷 다 `game/` 변경이 0건이다. 실제로 실행한 `pnpm wf <전이>` 명령과 그 성공 줄로 phase 경계를 잡고, 그 사이 어시스턴트 메시지의 도구 호출 수, 출력 토큰, 활동 시간(10분 넘는 공백 제외)을 더했다. 서브에이전트가 쓴 토큰은 별도 기록이라 빠져 있다. 실측 원문은 `docs/temp/`(git 미추적)에 있다.

| 구간 | 도구 호출 | 출력 토큰 | 활동 시간 |
|---|---:|---:|---:|
| 계획 (`/office-hours`·`/autoplan`) | 17% | 34% | 33% |
| QA 문서·RED 테스트 | 4% | 6% | 3% |
| 구현 | 19% | 15% | 10% |
| 검증 → `pass cso`까지 | 32% | 26% | 26% |
| 검증 → `pass ts`·`lint`·`review` 표시 | 4% | 2% | 2% |
| 사용자 검증 진입 (문서 정리·Draft PR) | 16% | 14% | 20% |
| 머지 | 8% | 4% | 6% |

「`pass cso`까지」 구간에는 QA 문서 확정, 정본 선언, `/cso`, 그리고 코드 리뷰 → 수정 → `invalidate` → 재검증이 모두 들어 있다. 네 슬라이스 모두 `invalidate`가 한 번씩 났다.

같은 날 함께 센 것은 아래와 같다.

- 검사 명령의 누적 출력은 2026-08-18 이후 약 45만 자이고, `check-links`만 137회 돌았다.
- 코드 리뷰는 네 슬라이스 모두에서 Critical·Important 결함을 잡았다.
- `/cso`는 레포 전체 이력에서 보안 이슈 문서를 한 번도 만들지 않았다.
- 타입체크는 55회 가운데 13회 실제 오류를 막았다.
- QA 문서의 씬·에디터 절은 네 슬라이스 모두 「없다」로 채웠다.

이 기준선은 도구 슬라이스만 잰 것이다. 게임 코드 슬라이스와 아트 슬라이스의 구간별 비용은 재지 않았다.

### 3.2 읽는 양 (2026-09-30 측정)

- `pnpm wf` 전이가 배달하는 phase 문서 여섯(`planning`·`qa-setup`·`implementation`·`verification`·`user-verification`·`pr-ready`)은 합계 13,575자다.
- `CLAUDE.md`는 11,301자다.
- 의무 독서 합계(`CLAUDE.md`와 「항상 읽는다」 정본 셋)는 37,522자다. 상한이 38,000자라 여유는 478자다(`tests/logic/ClaudeMdSplit.test.ts`의 `BUDGET_LIMIT`). 배달되는 phase 문서는 이 예산에 들어 있지 않다.

### 3.3 기준선을 잰 도구는 지금 도구와 같다

`.claude/workflow.mjs`와 `docs/development/workflow/`는 2026-09-16(`02eb7be`)과 지금(`5c9d741`) 사이에 바뀌지 않았다. 그 사이 `main`이 워크플로우 쪽에서 바꾼 것은 `CLAUDE.md`의 ADR 안내(§5.4)와 상태 파일뿐이다.

## 4. 범위

이번 슬라이스는 워크플로우 자체를 줄인다. 손댈 수 있는 곳은 `pnpm wf` 상태 머신(`.claude/workflow.mjs`와 그 테스트), phase별 절차 문서(`docs/development/workflow/`), `CLAUDE.md`의 「Workflow」 절이다. 무엇을 줄일지는 `/office-hours`에서 정한다.

아래 둘은 이번 슬라이스에서 하지 않는다.

- **서브에이전트 리뷰를 `agy`(안티그래비티)로 돌리는 일.** 영향도가 작은 리뷰를 골라 옮기는 작업인데, 어떤 리뷰가 영향도가 작은지는 다이어트 뒤에 어떤 리뷰가 남느냐에 달려 있다. 게다가 두 작업이 같은 절차 문서의 리뷰 줄을 고치므로 따로 진행하면 충돌한다. 그래서 다이어트가 끝난 뒤 같은 worktree에서 한다.
- **문서 슬라이스로 떼어 둔 정리.** ADR 층을 접는 일(F75), 나머지 정본에서 이력 서사를 걷는 일(F116), 용어 사전을 다시 쓰는 일(F117)은 [`backlog-docs.md`](../backlog-docs.md)의 문서 슬라이스가 한다.

## 5. 제약

### 5.1 상태 파일은 브랜치끼리 충돌한다

`.claude/workflow-state.json`은 git이 추적하는 파일이고 슬라이스마다 자기 상태를 커밋한다. 그래서 두 브랜치가 나란히 진행되면 구조를 바꾸지 않아도 이 파일에서 충돌이 난다. 2026-09-30에 이 브랜치를 `main` 위로 리베이스할 때 실제로 났고, 충돌한 파일은 이것 하나였다. 상태 파일을 커밋할지 말지는 [`backlog-implement.md`](../backlog-implement.md)의 F10이 열어 둔 결정이다.

지금 `main`에 커밋된 상태 파일은 3D 슬라이스의 `user-verification` 상태다. 그 슬라이스는 그 뒤의 전이(`approve-pr`·`pr-done`)를 커밋하지 않은 채 squash merge됐다. 다이어트가 phase 이름이나 상태 파일 구조를 바꾸면, 새 `workflow.mjs`는 `main`에 남은 이 옛 상태 파일을 읽게 된다. 새 도구가 그 파일을 읽지 못하면 다음 슬라이스의 `wf start`나 `wf status`가 막힌다. 그래서 구조를 바꾸는 계획은 옛 상태 파일을 어떻게 읽을지를 함께 정한다.

지금 상태 파일이 가진 키는 아래와 같다.

```
feature · phase · test_skipped · test_skip_reason · ts_check_scope
canon_updated · canon_skip_reason · qa_doc_fingerprint · docs_delivered
verification { cso_done · ts_check_clean · lint_clean · code_review_clean }
```

다른 브랜치에서 진행 중인 슬라이스는 지금 없다. worktree는 원래 폴더(`F:\work\monster`, `main`)와 이 폴더 둘뿐이다.

### 5.2 메모리는 두 폴더가 함께 쓴다

Claude 자동 메모리는 같은 저장소의 worktree끼리 한 폴더를 쓴다. 그래서 이 폴더에서 절차를 바꾸는 메모리(리뷰 규칙 `feedback_subagent_reviews.md`나 워크플로우 준수 규칙 `feedback_follow_workflow.md` 같은 것)를 고치면, 원래 폴더 세션도 다음에 메모리를 읽을 때부터 그 내용을 따른다. 원래 폴더는 다이어트가 머지되기 전까지 옛 절차 문서를 들고 있으므로, 그 폴더에서 새 슬라이스를 시작하면 문서와 메모리가 서로 다른 절차를 말하게 된다. 그런 메모리는 이 슬라이스의 PR을 머지할 때 고친다.

### 5.3 백로그 새 번호는 F118부터다

`main`의 마지막 번호가 F117이다(2026-09-30). 진행 중인 다른 슬라이스가 없으므로 백로그 머리말대로 `origin/main` 기준으로 따면 된다.

### 5.4 새 ADR을 쓰지 않는다

ADR 층은 폐지하기로 정해졌다(2026-09-28, F75). 그래서 다이어트가 내리는 결정은 세션 문서에 이유를 적고, 정본의 해당 절과 이력 줄에 현재 상태를 적는다. 기존 ADR도 고치지 않는다. 워크플로우 상태 머신을 다루는 ADR 004는 [`docs/decisions/README.md`](../../decisions/README.md)가 접을 자리로 [`workflow/README.md`](../workflow/README.md)를 지목해 두었다. F10 행은 결정을 ADR 004에 반영하라고 적고 있는데, 이 방침에 따라 그 자리는 정본이 된다.

### 5.5 정본 이력 규칙은 F116이 쥐고 있다

`pnpm wf canon`은 새 정본을 만들 때 `이력:` 줄과 「이력 절에는 날짜와 무엇이 바뀌었는지만 한 줄 남긴다」는 문장을 찍어 넣는다(`.claude/workflow.mjs`의 `renderCanonDoc`). 정본에 이력을 어떻게 남길지를 규칙에 못 박는 일은 F116이 맡고 있고 아직 열려 있다. 다이어트에서 이 템플릿이나 [`docs-references.md`](../spec/docs-references.md) §11의 규칙을 건드리면 F116이 내릴 결정을 먼저 내려 버리게 되므로, 건드려야 하면 사용자와 먼저 맞춘다.

### 5.6 의무 독서 예산의 여유가 478자다

`CLAUDE.md`의 「Workflow」 절은 의무 독서 예산 안에 있다(§3.2). 이 절에 글을 더하는 계획은 478자 안에서 움직이거나 다른 곳을 덜어야 하고, 넘으면 `ClaudeMdSplit.test.ts`가 빨갛게 된다.

## 6. 이 worktree에서 `pnpm wf`를 고치고 시험할 때

### 6.1 훅과 설정은 Claude를 실행한 폴더의 것이 돈다

`.claude/settings.json`의 PreToolUse 훅은 Write·Edit·MultiEdit 때 `$CLAUDE_PROJECT_DIR/.claude/hooks/gate-scripts.mjs`를 부른다. 그리고 `gate-scripts.mjs`·`workflow.mjs`·`typecheck.mjs`는 셋 다 `CLAUDE_PROJECT_DIR`를 루트로 쓰고, 그 값이 비어 있을 때만 현재 폴더를 쓴다. 그래서 원래 폴더에서 실행한 Claude가 이 폴더의 파일을 고치면 원래 폴더의 훅이 돈다. 그 훅은 이 폴더의 경로를 자기 루트 밖(`../monster-wf/...`)으로 읽으므로 아무것도 검사하지 않는다. 훅을 고치고 시험하는 일은 이 폴더에서 실행한 Claude로 한다.

### 6.2 전이 시험은 실제 상태 파일이 아니라 임시 폴더에서 한다

이 폴더의 `.claude/workflow-state.json`은 이 슬라이스의 상태다. 여기서 `pnpm wf start <다른 이름>` 같은 전이를 시험 삼아 돌리면 이 슬라이스의 상태가 초기화된다. `git restore`는 마지막으로 커밋한 상태까지만 되돌리므로, 그 뒤에 한 전이를 커밋하지 않았다면 그 전이는 사라진다.

그래서 전이를 바꾸는 시험은 기존 테스트가 하는 방식을 따른다. `tests/logic/ClaudeMdSplit.test.ts`의 `runWf`와 `tests/logic/DocsHygiene.test.ts`의 `wfStart`는 임시 폴더를 만들고 `CLAUDE_PROJECT_DIR`를 그 폴더로 지정한 채 실제 `workflow.mjs` 프로세스를 띄운다. 실제 상태 파일에서 꼭 돌려야 하면 파일을 먼저 복사해 둔다.

`pnpm wf start <이름>`은 상태만 초기화하지 않고 이 폴더의 브랜치도 `feat/<이름>`으로 바꾼다. 그 브랜치가 없으면 로컬 `main`에서 새로 자르고, 로컬 `main`이 `origin/main`보다 뒤처져 있으면 막는다(`ensureFeatureBranch`·`requireCurrentBase`). git은 다른 worktree가 체크아웃한 브랜치를 체크아웃하지 못하게 하므로, 원래 폴더가 열어 둔 브랜치는 이 폴더에서 열 수 없다.

### 6.3 사람 게이트 명령에는 확인창이 뜬다

`.claude/settings.local.json`의 `ask` 규칙이 `pnpm wf start`·`approve-plan`·`approve-pr`·`rework` 넷을 Bash와 PowerShell 양쪽에서 확인받게 한다. 2026-09-14에 사용자 동의로 넣은 규칙이고, auto 모드에서도 명시적 `ask` 규칙은 확인창을 띄운다. 넣은 이유는 명령마다 다르다. `wf start`는 phase를 보지 않고 상태를 전부 초기화하므로 잘못 실행되는 것을 막으려는 것이다. 나머지 셋은 사람이 판단하는 게이트라서, AI가 사용자 말 없이 실행하려 할 때 확인창이 두 번째 잠금이 되게 하려는 것이다.

이 파일은 git이 추적하지 않는다. 이 폴더의 것은 2026-09-16에 원래 폴더에서 복사했고, 복사한 뒤로 두 파일은 따로 바뀐다. auto 모드는 설정 파일 수정을 자기 권한을 바꾸는 동작으로 보고 막으므로, 이 파일은 사용자가 직접 고친다.

### 6.4 새 worktree에서는 Cocos 생성 파일을 채워야 테스트가 돈다

`game/tsconfig.json`이 이어받는 `game/temp/tsconfig.cocos.json`은 Cocos가 프로젝트를 열 때 만드는 파일이고 git이 추적하지 않아서 새 worktree에는 없다. 이 파일이 없으면 vitest가 게임 로직 파일을 변환하다 그 tsconfig를 찾지 못해 테스트 파일 대부분이 불러오는 단계에서 실패한다. 이 폴더에는 원래 폴더의 `game/temp/tsconfig.cocos.json`과 `game/temp/declarations/`를 복사해 채웠다(2026-09-16).

2026-09-30 기준선은 `pnpm vitest run` 48개 파일 1,114개 통과(1개 스킵)와 `pnpm typecheck` full 범위 통과다.

이 증상은 트러블슈팅 문서 [`typescript-version-pin.md`](../troubleshooting/typescript-version-pin.md)에 없다. 그 문서는 타입체크 쪽 증상만 적는다.

## 7. 계획에서 다룰 후보

범위에 넣을지는 `/office-hours`에서 정한다.

- `approve-plan` 게이트가 계획 문서를 파일명으로만 찾는다(§1).
- `wf start`에 phase 가드가 없어서 진행 중인 슬라이스도 초기화한다. 지금은 확인창이 그 자리를 막고 있다(§6.3).
- 규모에 따라 과정을 달리하는 장치는 지금 하나뿐이다. 코드가 없는 문서 작업은 `wf` phase를 아예 거치지 않는다([`CLAUDE.md`](../../../CLAUDE.md) 「문서/설계 작업」). 그 경로에는 절차 문서가 배달되지 않는다.

백로그 세 파일에서 다이어트와 걸리는 열린 항목은 아래와 같다(2026-09-30 확인).

| 항목 | 파일 | 다이어트와 걸리는 자리 |
|---|---|---|
| F10 | [`backlog-implement.md`](../backlog-implement.md) | 상태 파일 커밋 정책. §5.1의 충돌이 이 결정에 달려 있다 |
| F71 | [`backlog-docs.md`](../backlog-docs.md) | 절차를 `pnpm wf` 배달로 옮긴 뒤의 준수율 관찰. 절차 문서를 줄이면 배달되는 내용이 바뀐다 |
| F76 | [`backlog-docs.md`](../backlog-docs.md) | `qa-setup.md`의 「이전 문서 링크」 규칙이 실행할 수 없는 규칙이다. 이 절차 문서를 고치면 함께 걸린다 |
| F95·F96 | [`backlog-docs.md`](../backlog-docs.md) | 의무 독서 예산. 배달되는 절차 문서의 부피를 재지 않고, 상한까지 여유가 거의 없다(§3.2) |
| F78 | [`backlog-docs.md`](../backlog-docs.md) | `insertCanonRow`가 `workflow.mjs`와 테스트 헬퍼에 두 벌 있어 한쪽만 고쳐도 초록불이다 |
| F86 | [`backlog-docs.md`](../backlog-docs.md) | `wf status`가 검색 색인 지연을 알리게 하는 설계. 다음 도구 슬라이스로 미뤄 둔 항목이다 |
