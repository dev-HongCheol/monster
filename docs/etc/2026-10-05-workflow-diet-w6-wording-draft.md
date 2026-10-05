# 워크플로우 다이어트 — W6에서 바꿀 문구 초안 (2026-10-05)

계획 초안 [`2026-10-05-workflow-diet-plan-draft.md`](2026-10-05-workflow-diet-plan-draft.md) W6의 글자 수 표 둘은 이 문서의 문구로 잰 값이다. 구현할 때 이 문구를 그대로 쓰면 표의 수치가 그대로 나오고, 문구를 바꾸면 다시 잰다. 계획 초안과 함께 최종 PR 전에 지운다.

글자 수는 줄 끝을 LF로 맞춘 뒤 유니코드 글자 단위로 센 것이다. 「바꾸기 전」은 2026-10-05의 `main`(`5c9d741`) 내용이다.

## 1. `CLAUDE.md`

### start-verification 행 (+59)

바꾸기 전:

````text
| `pnpm wf start-verification` | AI | `implementation` → `verification` (전체 스위트 **GREEN** 검증 후 전환) |
````

바꾼 뒤:

````text
| `pnpm wf start-verification` | AI | `implementation` → `verification` (**통합 검사**: 타입·biome·전체 테스트 통과 후 전환) |
| `pnpm wf verify` | AI | 통합 검사만 다시 실행 (전이 없음) |
````

### pass 행 (-31)

바꾸기 전:

````text
| `pnpm wf pass <cso\|ts\|lint\|review>` | AI | 개별 검증 통과 (4개 모두 통과 + **QA 확정 게이트** + **정본 선언 게이트** 통과 시 자동 `user-verification`). **`pass ts`는 타입체크를 직접 실행**해 실패하면 차단한다 |
````

바꾼 뒤:

````text
| `pnpm wf pass <cso\|review>` | AI | 판단 검증 통과 표시(`cso`는 적용될 때만). 다 차면 **QA 확정 게이트** · **정본 선언 게이트** · 통합 검사를 지나 자동 `user-verification` |
````

### skip-test 행 뒤에 skip-qa 행 (+71)

바꾸기 전:

````text
| `pnpm wf skip-test "<사유>"` | AI | 테스트 스킵 (순수 로직 없음, 사유 필수) |
````

바꾼 뒤:

````text
| `pnpm wf skip-test "<사유>"` | AI | 테스트 스킵 (순수 로직 없음, 사유 필수) |
| `pnpm wf skip-qa "<사유>"` | AI | QA 문서 생략 (`game/**` 변경이 없는 동안만 유효) |
````

### approve-pr 행 (-5)

바꾸기 전:

````text
(**에셋 `.meta` 게이트** + **타입체크 범위 게이트**: `logic-only`면 차단)
````

바꾼 뒤:

````text
(변경 집합에 걸릴 때만 **에셋 `.meta` 게이트** · **타입체크 범위 게이트**)
````

### status 행 (+0)

바꾸기 전:

````text
| `pnpm wf status` | — | 현재 상태 + 편집 가능 여부 + 현재 phase 절차 문서 경로 |
````

바꾼 뒤:

````text
| `pnpm wf status` | — | 현재 상태 + 편집 가능 여부 + 적용 게이트 + 절차 문서 경로 |
````

### check-links 행 (+14)

바꾸기 전:

````text
| `pnpm wf check-links` | AI/사용자 | 마크다운 링크·앵커 검사 (깨진 링크 시 종료코드 1) |
````

바꾼 뒤:

````text
| `pnpm wf check-links` | AI/사용자 | 마크다운 링크·앵커 검사 (깨진 링크 시 종료코드 1). 통합 검사에 들어 있다 |
````

### typecheck 각주 (-61)

바꾸기 전:

````text
> **`pnpm typecheck`** (wf 커맨드가 아님) — 타입체크 단독 실행. `pass ts`가 내부적으로 **같은 코드**(`.claude/typecheck.mjs`)를 호출하므로, 여기서 통과하면 게이트도 통과한다.
````

바꾼 뒤:

````text
> **`pnpm typecheck`** (wf 커맨드가 아님) — 타입체크 단독 실행. 통합 검사가 같은 코드를 부른다.
````

### 9단계 5번 (+0)

바꾸기 전:

````text
5   구현       GREEN → REFACTOR → wf start-verification (GREEN 게이트)
````

바꾼 뒤:

````text
5   구현       GREEN → REFACTOR → wf start-verification (통합 검사 게이트)
````

### 9단계 6번 (-72)

바꾸기 전:

````text
               → /cso → pass cso → pnpm typecheck → pass ts → pnpm check --write
               → pass lint → 기능 단위 커밋 → 코드리뷰 → pass review
               코드 수정이 끼면 invalidate로 cso·정본 선언부터 다시
````

바꾼 뒤:

````text
               → (적용 시 /cso → pass cso) → 기능 단위 커밋 → 코드리뷰 → pass review
               코드 수정이 끼면 invalidate로 정본 선언부터 다시
````

### .meta 게이트 문단 (+8)

바꾸기 전:

````text
**게이트:** `pnpm wf approve-pr`이 추적되지 않은 `.meta`를 자동 검사해
````

바꾼 뒤:

````text
**게이트:** 에셋 변경이 있으면 `pnpm wf approve-pr`이 추적되지 않은 `.meta`를 검사해
````

순변화 합계: -17자

## 2. 배달되는 절차 문서

### `workflow/verification.md` — 전문을 다시 쓴다 (3,530자 → 3,439자)

````text
# verification — AI 검증

`start-verification`이 통합 검사(타입·biome·전체 테스트)를 이미 통과시켰다. 여기서 남은 것은 판단 검사 둘이다 — 보안 점검(`pass cso`, 적용될 때만)과 코드 리뷰(`pass review`). 둘이 차면 `pass`가 통합 검사를 한 번 더 돌린 뒤 `user-verification`으로 넘기고 스크립트 편집이 잠긴다.

이번 슬라이스에 어느 검사가 적용되는지는 `pnpm wf status`가 변경 집합으로 계산해 이유와 함께 보여 준다.

**중간에 코드를 고쳤으면 `pnpm wf invalidate`로 통과 표시를 지우고 보안 점검부터 다시 한다.** 코드 리뷰에서 나온 수정도 예외가 아니다 — 고친 코드가 보안 점검을 거치지 않는 비대칭을 없애기 위해서다. 타입·린트·테스트는 `pass review`가 스스로 다시 돌리므로 따로 치지 않는다(결과만 보려면 `pnpm wf verify`).

## GREEN 직후 — QA 문서를 먼저 맞춘다

자주 빠뜨리는 단계라 앞에 둔다. **`pass`가 막는다** — 아래 1·2를 안 하면 검증이 다 차도 전이가 안 된다. `skip-qa`가 유효한 슬라이스는 이 절을 건너뛴다.

1. `docs/qa/<feature>-test.md`의 `## N. 자동 …` 절 항목을 `[ ]`에서 `[x]`로 바꾸고, 절 머리에 통과 근거를 적는다(날짜, 피처 테스트 N/N, 전체 스위트 M/M). 자동 검사가 없는 슬라이스는 `스킵 — <사유>`. PR 번호는 여기서 안 적는다 — Draft PR은 다음 phase에서 만든다.
2. 프리팹·씬·에디터 연결 섹션을 **실제 구현된 컴포넌트**(`@property` 이름·노드·부모)에 맞춰 확정하고 `(잠정 …)`·`(가칭 …)` 태그를 `(확정)`으로 바꾼다. 문서와 코드가 어긋나면 코드가 기준이다.

태그가 남아 있으면 전이가 막힌다. `pnpm wf check-qa`로 미리 확인할 수 있다.

## 그다음 — 정본을 맞춘다

이번 슬라이스가 **"지금 이렇다"를 바꿨다면** 그 내용은 정본에 실려야 한다. 세션 문서와 QA 문서에만 적고 넘어가면 다음 사람이 그 규칙을 찾을 곳이 없어서, 결국 시점 기록을 열어 명세로 읽는다.

물을 것은 하나다. **이 변경 뒤에 누가 "지금 어떻게 되어 있나"를 물으면 어느 문서를 열게 되는가.** 어느 문서인지는 `CLAUDE.md`의 Knowledge Base 표가 질문별로 든다.

| 상황 | 명령 |
|---|---|
| 기존 정본을 고쳤다 | `pnpm wf canon-done <경로...>` |
| 답할 정본이 없어 새로 만든다 | `pnpm wf canon <분류>-<주제> "<제목>" "<답하는 질문>"` (디자인 정본은 `--design`) |
| 바꾼 명세가 없다 | `pnpm wf canon-skip "<사유>"` |

**코드 동작만 바뀌었으면 JSDoc이 정본이다.** 별도 문서를 만들지 말고 `canon-skip`에 그렇게 적는다. 새로 만들 때 파일명은 슬라이스 이름이 아니라 **독자가 던질 질문**으로 짓는다 — 좁게 지으면 형제가 생길 때마다 개명과 참조 수정이 따라온다.

셋 중 아무것도 선언하지 않으면 전이가 막힌다. `invalidate`와 `start-verification`이 이 선언을 함께 지우므로 **선언은 이 phase에 들어온 뒤에 한다** — 코드가 바뀌면 "명세도 바뀌었나"를 다시 판단해야 하기 때문이다. 구현 중에 이미 `canon`으로 문서를 만들었다면 문서는 그대로 있으니 `canon-done`으로 다시 기록하면 된다.

## 보안 점검 (`pass cso`) — 적용될 때만

`status`가 `cso: 해당 없음`이면 건너뛴다. 적용이면 `/cso`로 OWASP·STRIDE 점검을 한다. 이슈가 나오면 `docs/qa/<feature>-security-issues.md`에 기록하고 즉시 고친 뒤 해당 항목에 "수정됨"을 표시하고, `pnpm wf invalidate`로 여기서부터 다시 시작한다. 재실행할 때 기존 문서는 그대로 두고 신규 이슈만 더한다. 모든 이슈가 "수정됨"이면 `pnpm wf pass cso`.

`invalidate`나 리워크 뒤의 재점검은 **바뀐 부분만** 본다 — 그때 출력되는 `/cso --diff --base <직전 통과 커밋>`을 쓴다.

게임 코드는 지금 결제·로그인·서버·외부 연동이 없어서 `/cso` 대상이 아니다. 구매 확인이나 Steam 연동 같은 코드가 들어오면 그 경로를 `CSO_PATHS`에 더한다.

## 커밋

기능 단위로 나눠 순차 커밋한다. husky가 staged 파일에 `biome check --write`를 자동 실행한다. 새 문서로 가는 링크는 그 문서를 `git add`한 뒤에야 링크 검사를 통과한다.

## 코드 리뷰 (`pass review`)

`superpowers:requesting-code-review` 패턴으로 별도 subagent를 띄운다. `git rev-parse origin/main`이 BASE_SHA, `git rev-parse HEAD`가 HEAD_SHA다. diff에 API 키·비밀값이 없는지도 보게 한다.

**리뷰 템플릿은 이 레포의 파일이 아니다.** 스킬을 invoke하면 동봉된 `code-reviewer.md`의 위치(플러그인 캐시 안, 버전 경로 포함)를 알려 준다. 레포에서 그 이름을 찾으면 "없음"으로 뜬다. 스킬이 가리키는 템플릿을 읽어 `{DESCRIPTION}`·`{PLAN_OR_REQUIREMENTS}`·`{BASE_SHA}`·`{HEAD_SHA}`를 채운 뒤 `general-purpose` 타입 Agent로 dispatch한다.

모든 이슈를 `docs/qa/<feature>-review-issues.md`에 기록한다. 문서가 이미 있으면 덮어쓰지 말고 기존 항목을 보존한 채 하단에 "재리뷰 (커밋 SHA 또는 차수)" 섹션으로 더하며, 이미 "수정됨"인 항목은 그대로 둔다. 상단의 리뷰 커밋만 최신 SHA로 갱신한다.

- **코드 품질·타입 안전성·실제 버그** — 즉시 고치고 "수정됨"을 표시한다. 고쳤으면 `pnpm wf invalidate`로 보안 점검부터 다시 한다.
- **게임 정책·설계에 대한 지적** — 문서에 기록만 하고 넘어간다. 수정은 사용자가 요청할 때만 한다.

추가 수정이 없으면 `pnpm wf pass review`.

## 마무리

`superpowers:verification-before-completion`을 호출한다.

게임 코드를 바꾼 슬라이스는 **Cocos Creator로 프로젝트를 한 번이라도 연 머신에서** 검증한다. 안 열었으면 타입 검사 범위가 `logic-only`로 기록되고 `approve-pr`이 차단한다 — Cocos로 한 번 연 뒤 `pnpm wf rework` → `pnpm wf start-verification`.
````

### `workflow/qa-setup.md`

(+197) 바꾸기 전:

````text
| 수동 테스트 체크리스트 | `[ ]` 항목. 코드로 검증할 수 없는 인게임 동작만 |
````

바꾼 뒤:

````text
| 수동 테스트 체크리스트 | `[ ]` 항목. 코드로 검증할 수 없는 인게임 동작만 |

계획이 `game/**`를 건드리지 않으면 씬/프리팹·에디터 연결 두 섹션은 쓰지 않는다. 그런 슬라이스는 `pnpm wf skip-qa "<사유>"`로 이 문서 자체를 생략할 수 있고, 사용자 검증에서 손으로 볼 것은 계획 문서에 적는다. 생략은 `game/**` 변경이 없는 동안만 유효하다 — 나중에 건드리면 `pass`가 이 문서를 요구한다.
````

(-12) 바꾸기 전:

````text
태그가 남아 있으면 검증 4종이 다 차도 다음 phase로 넘어가지 못한다
````

바꾼 뒤:

````text
태그가 남아 있으면 다음 phase로 넘어가지 못한다
````

(-105) 바꾸기 전:

````text
어겼을 때 무엇이 잘못되는지는 2026-08-08에 실제로 겪었다. 후속 슬라이스가 `player-4dir-test.md`의 완료 항목(`Content Size 72×96` `✅`)을 취소선과 함께 `⬜`로 되돌려, **그 슬라이스가 실제로 수행하고 검증했다는 기록이 사라졌다.**
````

바꾼 뒤:

````text
완료 항목을 나중에 되돌리면 **그 슬라이스가 실제로 수행하고 검증했다는 기록이 사라진다.**
````

(+17) 바꾸기 전:

````text
QA 문서가 있는가, 테스트 파일이 있거나
````

바꾼 뒤:

````text
QA 문서가 있는가(생략이 유효하면 없어도 된다), 테스트 파일이 있거나
````

### `workflow/implementation.md`

(+10) 바꾸기 전:

````text
`pnpm wf start-verification`이 전체 스위트를 돌려 **전부 통과할 때만** 검증으로 넘어간다. 실패가 있으면 차단되고 이 phase에 머문다. 따로 `pnpm test`를 돌릴 필요는 없다.
````

바꾼 뒤:

````text
`pnpm wf start-verification`이 통합 검사(타입·biome·전체 테스트)를 돌려 **전부 통과할 때만** 검증으로 넘어간다. 실패가 있으면 차단되고 이 phase에 머문다. 따로 검사 명령을 돌릴 필요는 없다.
````

### `workflow/user-verification.md`

(+29) 바꾸기 전:

````text
`docs/qa/<feature>-test.md` 체크리스트를 참고해
````

바꾼 뒤:

````text
`docs/qa/<feature>-test.md` 체크리스트(QA 문서를 생략했으면 계획 문서의 손 확인 목록)를 참고해
````

(-67) 바꾸기 전:

````text
 — 2026-08-06에 두 백로그 조회만 57.6k 토큰이었고 그 부피의 38%가 항목 **여섯 개**에 몰려 있었다. 그래서
````

바꾼 뒤:

````text
. 그래서
````

(+11) 바꾸기 전:

````text
`approve-pr`은 추적되지 않은 `.meta`를 검사해
````

바꾼 뒤:

````text
`approve-pr`은 에셋 변경이 있으면 추적되지 않은 `.meta`를 검사해
````

