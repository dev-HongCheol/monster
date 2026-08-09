# verification — AI 검증

네 가지를 순서대로 통과시킨다. 각각 `pnpm wf pass <cso|ts|lint|review>`로 표시하고, 넷이 모두 차면 자동으로 `user-verification`으로 넘어가면서 스크립트 편집이 잠긴다.

**중간에 코드를 고쳤으면 `pnpm wf invalidate`로 전부 되돌리고 보안 검사부터 다시 돈다.** 코드 리뷰에서 나온 수정도 예외가 아니다 — 고친 코드가 보안 검사를 거치지 않는 비대칭을 없애기 위해서다.

## GREEN 직후 — QA 문서를 먼저 맞춘다

자주 빠뜨리는 단계라 앞에 둔다.

1. `docs/qa/<feature>-test.md`의 "자동 테스트로 검증" 항목을 `[ ]`에서 `[x]`로 바꾸고, 섹션 머리에 통과 근거를 적는다(피처 테스트 N/N, 전체 스위트 M/M, 통과 커밋 SHA).
2. 프리팹·씬·에디터 연결 섹션을 **실제 구현된 컴포넌트**(`@property` 이름·노드·부모)에 맞춰 확정하고 `(잠정 …)`·`(가칭 …)` 태그를 `(확정)`으로 바꾼다. 문서와 코드가 어긋나면 코드가 기준이다 — 코드가 정본이고 QA 문서가 그 거울이다.

태그가 남아 있으면 네 검증이 다 차도 전이가 막힌다. `pnpm wf check-qa`로 미리 확인할 수 있다.

## 게이트 1 — 보안 (`pass cso`)

`/cso`로 OWASP·STRIDE 점검을 한다. 이슈가 나오면 `docs/qa/<feature>-security-issues.md`에 기록하고 즉시 고친 뒤 해당 항목에 "수정됨"을 표시하고, `pnpm wf invalidate`로 전체 검증을 초기화해 여기서부터 다시 시작한다. 재실행할 때 기존 문서는 그대로 두고 신규 이슈만 더한다. 모든 이슈가 "수정됨"이면 `pnpm wf pass cso`.

**이 게이트를 통과하기 전에는 다음으로 가지 않는다.**

## 게이트 2 — 타입 (`pass ts`)

`pnpm typecheck`를 돌려 에러를 0으로 만든다. 두 프로젝트를 검사한다 — `tsconfig.tests.json`(테스트·로직·데이터. Cocos와 무관해 어디서든 돈다)과 `game/tsconfig.json`(게임 전체. Cocos가 만든 `game/temp/`가 있어야 한다).

`game/temp/`는 gitignore 대상이라 **Cocos Creator로 프로젝트를 한 번이라도 연 머신에서만** 게임 코드가 검사된다. 안 열었으면 검사 범위가 `logic-only`로 기록되고 나중에 `approve-pr`이 차단한다. 그 경우 Cocos로 프로젝트를 한 번 연 뒤 `pnpm wf rework` → `pnpm wf start-verification`으로 검증을 다시 돌린다(`invalidate`는 이 phase에서만 되는데 차단은 다음 phase에서 일어나므로 여기선 쓸 수 없다).

`pnpm wf pass ts`는 **타입체크를 직접 다시 돌린다.** 실패하면 막히므로 "돌렸다고 말하는 것"으로는 통과할 수 없다.

## 게이트 3 — 린트 (`pass lint`)

`pnpm check --write`로 린트와 포맷을 최종 확인한 뒤 `pnpm wf pass lint`.

## 커밋

기능 단위로 나눠 순차 커밋한다. husky가 staged 파일에 `biome check --write`를 자동 실행한다.

## 게이트 4 — 코드 리뷰 (`pass review`)

`superpowers:requesting-code-review` 패턴으로 별도 subagent를 띄운다. `git rev-parse origin/main`이 BASE_SHA, `git rev-parse HEAD`가 HEAD_SHA다.

**리뷰 템플릿은 이 레포의 파일이 아니다.** 스킬을 invoke하면 동봉된 `code-reviewer.md`의 위치(플러그인 캐시 안, 버전 경로 포함)를 알려 준다. 레포에서 그 이름을 찾으면 "없음"으로 뜬다. 스킬이 가리키는 템플릿을 읽어 `{DESCRIPTION}`·`{PLAN_OR_REQUIREMENTS}`·`{BASE_SHA}`·`{HEAD_SHA}`를 채운 뒤 `general-purpose` 타입 Agent로 dispatch한다.

모든 이슈를 `docs/qa/<feature>-review-issues.md`에 기록한다. 문서가 이미 있으면 덮어쓰지 말고 기존 항목을 보존한 채 하단에 "재리뷰 (커밋 SHA 또는 차수)" 섹션으로 더하며, 이미 "수정됨"인 항목은 그대로 둔다. 상단의 리뷰 커밋만 최신 SHA로 갱신한다.

- **코드 품질·타입 안전성·실제 버그** — 즉시 고치고 "수정됨"을 표시한다. 고쳤으면 `pnpm wf invalidate`로 되돌려 보안 검사부터 다시 돈다.
- **게임 정책·설계에 대한 지적** — 문서에 기록만 하고 넘어간다. 수정은 사용자가 요청할 때만 한다.

추가 수정이 없으면 `pnpm wf pass review`.

## 마무리

`superpowers:verification-before-completion`을 호출한다. 네 게이트가 다 차면 phase가 `user-verification`으로 넘어간다.
