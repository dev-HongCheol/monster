# verification — AI 검증

통합 검사(biome·타입 검사·전체 테스트)는 `start-verification`에서 통과했다. 이 phase에 남은 것은 `pnpm wf pass <cso|review>`로 기록하는 판단 검사 두 개(보안 점검·코드 리뷰)다. 둘을 기록하면 `pass`가 통합 검사를 한 번 더 돌리고, 통과하면 `user-verification`으로 넘어가면서 스크립트 편집이 잠긴다. 할 검사는 `pnpm wf status`의 적용 판정 표가 보여 준다.

**중간에 코드를 고쳤으면 `pnpm wf invalidate`로 판단 검사 기록을 지우고 (`/cso`를 해야 할 때만) 보안 점검부터 다시 한다.** 코드 리뷰에서 나온 수정도 예외가 아니다. 고친 코드가 보안 점검 없이 머지되는 일을 막기 위해서다. biome이 고친 형식 차이만 있으면 예외다.

## GREEN 직후 — QA 문서를 먼저 맞춘다

자주 빠뜨리는 단계라 앞에 둔다. 아래 1·2를 하지 않으면 판단 검사를 다 기록해도 `pass`가 넘기지 않는다.

1. `docs/qa/<feature>-test.md`의 `## N. 자동 …` 절 항목을 `[ ]`에서 `[x]`로 바꾸고, 절 머리에 통과 근거를 적는다(날짜, 피처 테스트 N/N, 전체 스위트 M/M — 통합 검사의 vitest 줄에서 옮긴다). 자동 검사가 없는 슬라이스는 `스킵 — <사유>`. PR 번호는 적지 않는다(Draft PR은 다음 phase에서 만든다).
2. 프리팹·씬·에디터 연결 섹션을 **실제 구현된 컴포넌트**(`@property` 이름·노드·부모)에 맞춰 확정하고 `(잠정 …)`·`(가칭 …)` 태그를 `(확정)`으로 바꾼다. 문서와 코드가 어긋나면 코드가 기준이다.

태그가 남아 있으면 전이가 막힌다. `pnpm wf check-qa`로 미리 확인할 수 있다. `skip-qa`로 QA 문서를 생략했고 그 생략이 아직 유효하면 이 절은 건너뛴다.

## 그다음 — 정본을 맞춘다

이번 슬라이스가 **"지금 이렇다"를 바꿨다면** 그 내용은 정본에 실려야 한다. 세션 문서와 QA 문서에만 적고 넘어가면 다음 사람이 그 규칙을 찾을 곳이 없어서, 결국 시점 기록을 열어 명세로 읽는다.

물을 것은 하나다. **이 변경 뒤에 누가 "지금 어떻게 되어 있나"를 물으면 어느 문서를 열게 되는가.** 어느 문서인지는 `CLAUDE.md`의 Knowledge Base 표가 질문별로 든다.

| 상황 | 명령 |
|---|---|
| 기존 정본을 고쳤다 | `pnpm wf canon-done <경로...>` |
| 답할 정본이 없어 새로 만든다 | `pnpm wf canon <분류>-<주제> "<제목>" "<답하는 질문>"` (디자인 정본은 `--design`) |
| 바꾼 명세가 없다 | `pnpm wf canon-skip "<사유>"` |

**코드 동작만 바뀌었으면 JSDoc이 정본이다.** 별도 문서를 만들지 말고 `canon-skip`에 그렇게 적는다. 새로 만들 때 파일명은 슬라이스 이름이 아니라 **독자가 던질 질문**으로 짓는다 — 좁게 지으면 형제가 생길 때마다 개명과 참조 수정이 따라온다.

셋 중 아무것도 선언하지 않으면 전이가 막힌다. `invalidate`와 `start-verification`이 이 선언을 함께 지우므로 **선언은 이 phase에 들어온 뒤에 한다** — 코드가 바뀌면 "명세도 바뀌었나"라는 판단이 낡기 때문이다. 구현 중에 이미 `canon`으로 문서를 만들었다면 문서는 그대로 있으니 `canon-done`으로 다시 기록하면 된다.

## 커밋

기능 단위로 나눠 순차 커밋한다. husky가 staged 파일에 `biome check --write`를 자동 실행한다. 보안 점검보다 커밋을 먼저 하는 이유는 `pass cso`가 그때의 커밋을 다음 점검의 기준으로 적기 때문이다. 점검한 변경이 그 커밋에 들어 있어야 다음 점검이 이미 본 부분을 다시 보지 않는다. 새 문서를 가리키는 링크는 그 문서를 `git add`한 뒤에야 링크 검사를 통과한다.

## 게이트 1 — 보안 (`pass cso`, 해당할 때만)

`status`가 `cso: 적용`이면 `/cso`로 OWASP·STRIDE 점검을 한다. 대상은 개발 장비에서 실행되는 코드·자동화·의존성 파일(`CSO_PATHS`)이다. 게임 코드는 결제·로그인·외부 연동이 없어 지금은 대상이 아니고, 그런 코드가 들어오면 `CSO_PATHS`에 더한다. 코드를 고친 뒤의 점검은 바뀐 부분만 본다. `status`의 「다음 /cso」 줄에 나온 명령을 쓴다.

이슈가 나오면 `docs/qa/<feature>-security-issues.md`에 기록하고 즉시 고친 뒤 해당 항목에 "수정됨"을 표시하고 `pnpm wf invalidate`를 친다. 재실행할 때 기존 문서는 그대로 두고 신규 이슈만 더한다. 모든 이슈가 "수정됨"이면 `pnpm wf pass cso`.

## 게이트 2 — 코드 리뷰 (`pass review`)

`superpowers:requesting-code-review` 패턴으로 별도 subagent를 띄운다. `git rev-parse origin/main`이 BASE_SHA, `git rev-parse HEAD`가 HEAD_SHA다.

**리뷰 템플릿은 이 레포의 파일이 아니다.** 스킬을 invoke하면 동봉된 `code-reviewer.md`의 위치(플러그인 캐시 안, 버전 경로 포함)를 알려 준다. 레포에서 그 이름을 찾으면 "없음"으로 뜬다. 스킬이 가리키는 템플릿을 읽어 `{DESCRIPTION}`·`{PLAN_OR_REQUIREMENTS}`·`{BASE_SHA}`·`{HEAD_SHA}`를 채운 뒤 `general-purpose` 타입 Agent로 dispatch한다.

모든 이슈를 `docs/qa/<feature>-review-issues.md`에 기록한다. 문서가 이미 있으면 덮어쓰지 말고 기존 항목을 보존한 채 하단에 "재리뷰 (커밋 SHA 또는 차수)" 섹션으로 더하며, 이미 "수정됨"인 항목은 그대로 둔다. 상단의 리뷰 커밋만 최신 SHA로 갱신한다.

- **코드 품질·타입 안전성·실제 버그** — 즉시 고치고 "수정됨"을 표시한다. diff에 API 키·비밀값이 없는지도 본다.
- **게임 정책·설계에 대한 지적** — 문서에 기록만 하고 넘어간다. 수정은 사용자가 요청할 때만 한다.

추가 수정이 없으면 `pnpm wf pass review`.

## 마무리

`superpowers:verification-before-completion`을 호출한다. `pass`가 돌린 통합 검사가 형식 차이만으로 실패하면 `pnpm wf verify`로 고치고 커밋한 뒤 같은 `pass`를 다시 친다. 타입·린트·테스트로 실패하면 도구가 판단 검사 기록을 지우므로 고친 뒤 위 절차를 다시 돈다.

게임 코드를 바꾼 슬라이스는 Cocos로 프로젝트를 한 번 연 장비에서 검증한다. `game/temp/`가 없으면 타입 검사 범위가 `logic-only`가 되어 `approve-pr`이 막으므로, Cocos로 연 뒤 `pnpm wf rework` → `pnpm wf start-verification`으로 다시 돈다.
