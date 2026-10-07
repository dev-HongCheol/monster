<!-- /autoplan restore point: "C:\\Users\\Choi-HC\\.gstack\\projects\\dev-HongCheol-monster\\feat-workflow-diet-autoplan-restore-20261006-075623.md" -->
## Implementation plan
# 워크플로우 다이어트 1단계 계획 초안 — 해당 없는 검사를 건너뛰고, 기계 검사를 한 번에 돌리고, 두 벌인 판정 코드를 합친다

- **작성일:** 2026-10-05
- **브랜치:** `feat/workflow-diet` · worktree `F:\work\monster-wf` · phase `planning`
- **상태:** `/autoplan` 리뷰 반영 중 — 사양 리뷰 세 회차의 지적을 반영했다. 리뷰를 반영한 뒤 `docs/development/sessions/`로 옮기면서 개요와 작업 묶음별 문서로 나눈다
- **고칠 정본:** `workflow/verification.md` · `workflow/qa-setup.md` · `workflow/implementation.md` · `workflow/user-verification.md` · `workflow/planning.md`(한 곳) · `workflow/README.md` · `CLAUDE.md` 「Workflow」 절과 「에셋 `.meta` 관리 규칙」 절
- **닫는 백로그:** F78(두 벌인 판정 코드), F95(배달되는 절차 문서의 글자 수를 재는 검사가 없다). F10은 닫지 않고 새로 확인한 사실을 행에 더한다
- **입력:** 요구사항과 제약 [`2026-09-16-workflow-tooling-diet-brief.md`](../development/sessions/2026-09-16-workflow-tooling-diet-brief.md) · 설계 [`2026-10-05-workflow-diet-design-draft.md`](2026-10-05-workflow-diet-design-draft.md)
- **바탕:** 2026-09-17에 리뷰를 마친 옛 계획(이 브랜치의 커밋 `211ae71`). 이 초안은 그 계획에 설계 문서의 수정 M1~M19를 반영해 처음부터 다시 쓴 것이다. 설계 문서 끝의 「Reviewer Concerns」에 남은 지적 열둘(R3-1~R3-12)은 이 초안과 설계 문서 본문에 모두 반영했다

---

## 0. 이 문서에서 쓰는 말

- **슬라이스** — 기능 하나를 계획부터 머지까지 끝내는 작업 단위다. 브랜치 하나, PR 하나다.
- **phase** — 슬라이스가 지금 있는 단계다. `planning` → `qa-setup` → `implementation` → `verification` → `user-verification` → `pr-ready` → `done` 순서다.
- **전이** — 다음 phase로 넘어가는 것이다. `pnpm wf <명령>`으로만 일어난다.
- **상태 파일** — `.claude/workflow-state.json`. phase와 검사 통과 여부를 적는 파일이다.
- **통과 표시** — 검사를 통과했다고 상태 파일에 남기는 값이다. 지금은 `verification` 안의 참·거짓 값 넷(`cso_done`·`ts_check_clean`·`lint_clean`·`code_review_clean`)이다.
- **변경 집합** — 브랜치가 main에서 갈라진 뒤 바뀐 파일과, 아직 git에 올리지 않은 새 파일을 합친 목록이다.
- **적용 경로** — 검사마다 정해 두는 파일 경로 목록이다. 변경 집합에 이 경로의 파일이 있으면 그 검사를 하고, 없으면 「해당 없음」으로 건너뛴다.
- **통합 검사** — 타입 검사, biome(코드 형식과 린트), 전체 테스트(vitest)를 명령 하나로 차례로 돌리는 것이다.
- **판단 검사** — 기계가 재지 못해서 AI가 판단하는 검사다. 넷이다. 보안 점검(`/cso`)과 코드 리뷰는 `pass cso`·`pass review`로 통과 표시를 남긴다. 정본 갱신 확인은 `wf canon*`으로 선언하고, QA 확정은 QA 문서의 표시를 고쳐서 한다. 이 문서에서 넷 가운데 일부만 가리킬 때는 이름을 든다.
- **원래 폴더** — main을 꺼내 둔 저장소 폴더(`F:\work\monster`)다. 이 슬라이스는 그 옆의 별도 작업 폴더(git worktree)에서 한다. 그래서 이 슬라이스가 머지되기 전까지 원래 폴더에는 고치기 전의 도구가 그대로 있다.

## 1. 무엇을 하나

지금은 슬라이스가 크든 작든 같은 9단계를 전부 돈다. 문서 검사기 한 줄을 고치는 슬라이스도 QA 문서의 씬·에디터 절을 「없다」로 채우고, `/cso`를 하고, `.meta` 검사를 받고, 검증에서 명령 넷(`pnpm typecheck` → `pass ts` → `pnpm check --write` → `pass lint`)을 따로 친다. 리뷰를 받고 코드를 고치면 통과 표시 넷을 전부 지우고 검사 넷을 처음부터 다시 한다.

이 슬라이스는 두 단계로 나눈 계획의 **1단계**다. 검사의 뜻은 바꾸지 않고 셋을 한다.

1. **해당 없는 검사를 건너뛴다.** 변경 집합을 보고 `.meta` 검사, 게임 전체 타입 검사 의무, `/cso`의 적용 여부를 정한다. `game/` 폴더를 건드리지 않는 슬라이스는 QA 문서를 사유와 함께 생략할 수 있다.
2. **기계 검사를 한 번에 돌린다.** `start-verification`이 통합 검사를 돌려 결과를 적는다. `pass ts`와 `pass lint`는 없앤다. `pass review`가 다음 phase로 넘기기 직전에 통합 검사를 한 번 더 돌린다.
3. **두 벌인 판정 코드를 한 벌로 합친다(F78).** `workflow.mjs`와 `tests/helpers/`에 복사돼 있는 판정 코드를 `.claude/lib/*.mjs`로 옮기고, 도구와 테스트가 같은 파일을 쓴다.

**2단계**는 통과 표시를 남기는 방식을 바꾼다. 지금 정하는 것은 약속 넷뿐이고(§6), 1단계를 머지해 실제로 써 본 뒤 새 슬라이스로 연다.

이 슬라이스가 새 절차의 첫 사용자다. 이 브랜치의 `workflow.mjs`가 이 슬라이스의 검증을 돌리므로, `verification`에 들어가는 순간 통합 검사와 적용 판정이 실전에서 처음 돈다. 이 브랜치는 `.claude/**`를 고치므로 `/cso`가 적용되고, `game/**`를 건드리지 않으므로 `.meta` 검사와 게임 전체 타입 검사 의무는 해당 없음이어야 한다.

**부담 셋 가운데 1단계가 줄이는 것.** 시간은 검증 명령 수와 건너뛰는 검사로 줄인다. 도구 유지비는 두 벌인 판정 코드를 합쳐 줄인다. AI가 읽는 양은 검증 중의 출력에서 줄어든다(명령이 넷에서 하나가 되고, 통합 검사 출력은 검사마다 요약 한 줄에 실패 상세 40줄까지다). 절차 문서는 이번에는 늘리지 않는 데까지만 한다(W6). 절차 문서를 줄이는 일은 따로 새 백로그 항목으로 올린다(W7). 1단계는 슬라이스마다 드는 비용을 줄이는 대신 도구 코드의 양은 늘린다(새 모듈 일곱, 임시 저장소 도우미, 테스트). 실제 유지비는 §6의 줄 수·테스트 시간으로 잰다.

## 2. 결정

### 2.1 사용자가 정한 것

- **줄일 것(2026-09-16).** 슬라이스에 드는 시간, AI가 읽는 양, 도구 유지비 셋이다. 사람이 확인하는 지점은 줄이지 않는다. 아까운 것은 「규모와 상관없이 모든 슬라이스가 같은 전 과정을 도는 것」이다.
- **검사를 변경 집합으로 계산한다(2026-09-16).** 가벼운 절차와 무거운 절차를 상태로 저장하지 않는다. 검사마다 적용 경로를 두고 필요할 때마다 변경 집합으로 계산한다. 코드 리뷰와 전체 테스트는 경로와 상관없이 항상 한다. 계획이 적은 범위 밖에서 게임 파일이 바뀌어도 막지 않고 검사를 자동으로 더한다.
- **`/cso`의 적용 경로(2026-09-17).** 「개발 장비에서 실행되는 코드·자동화·의존성·공급망·git 실행 동작을 바꾸는 파일」에만 적용한다.
- **`pass ts`·`pass lint`를 없앤다(2026-09-17).** 두 길을 함께 남기면 명령이 줄지 않는다.
- **두 단계, PR 둘(2026-09-16, 2026-10-05에 축소형으로 다시 정함).** 이 브랜치는 1단계만 구현한다. 2단계는 약속 넷만 지금 적어 함께 리뷰하고, 세부는 2단계를 열 때 정한다. 나누는 이유는 둘이다. 1단계는 지금의 통과 표시 방식을 그대로 두고 그 위에 적용 판정과 통합 검사를 얹지만, 2단계는 통과 표시 방식 자체를 바꿔서 잘못됐을 때 영향이 훨씬 넓다. 그리고 1단계를 써 본 결과가 2단계를 갈지 말지의 근거가 된다.
- **코드를 고친 뒤의 `/cso`는 바뀐 부분만 다시 본다(2026-10-05).** 2026-09-17에는 「`/cso` 대상 파일의 목록이 그대로면 다시 하지 않는다」로 정했는데 이를 뒤집는다. 그 뒤 `/cso`에 직전 커밋 뒤 바뀐 부분만 보는 짧은 방식이 생겼고 3D 슬라이스에서 이미 그렇게 썼다. 옛 방식은 같은 파일을 고친 내용이 보안 점검을 받지 않고 지나가고, 상태 파일의 새 값과 목록 비교와 그 테스트가 든다.
- **상태 파일의 git 추적은 이 슬라이스에서 바꾸지 않는다(2026-10-05).** 추적할지 말지는 백로그 F10이 정한다. 2026-09-17에는 「장비를 옮길 때 phase가 따라오는 것이 브랜치 충돌보다 가치가 크다」로 추적을 유지하기로 했는데, 그 뒤 2026-09-30 리베이스에서 충돌이 실제로 났고 머지된 슬라이스의 상태가 main에 남는 일도 생겼다. 그래서 다시 확정하지 않고 이 두 사실을 F10의 입력으로 넘긴다. 변경 집합에서는 상태 파일을 뺀다.
- **새 ADR을 쓰지 않는다(2026-09-28).** 결정의 이유는 이 계획 문서에, 지금의 절차는 절차 문서 본문에 적는다. 절차 문서에 새 이력 줄도 만들지 않는다. 정본의 이력 규칙은 F116이 정할 일이다.

### 2.2 기각한 안

- **게임 변경이 없으면 검사를 건너뛰는 것만 하는 안, 기계 검사를 묶기만 하는 안.** 각각 단독으로는 리뷰 뒤에 검사를 전부 다시 하는 구조, 계획 비용, 두 벌인 코드가 그대로 남는다. 둘 다 1단계에 들어 있다.
- **`/cso`를 「게임 변경이 없으면 해당 없음」으로 두는 안.** 게임 코드는 네트워크가 없는 클라이언트 로직이라 `/cso`가 볼 것이 없고, 실제로 이 저장소 이력에서 `/cso`가 찾은 것이 없다. 도구 경로(`.claude/**`·`tools/**`)에서도 0건이다 — `docs/qa/`에 `*-security-issues.md`가 하나도 없다(2026-10-06 확인). 셸을 실행하는 쪽은 `.claude/**`·`tools/**`·`tests/helpers/**`다. `tests/logic/**`는 적용 경로에서 뺀다. 넣으면 모든 슬라이스가 만드는 `tests/logic/<Feature>.test.ts` 때문에 `/cso` 해당 없음이 한 번도 나오지 않는다. 프로세스를 띄우거나 파일을 쓰는 테스트 코드는 `tests/helpers/`에 둔다.
- **`pass ts`·`pass lint`를 호환용으로 남기는 안.** 두 길이 남으면 「명령 넷에서 하나」가 지켜지는지 잴 수 없다.
- **`workflow.mjs`가 `tests/helpers/*.ts`를 직접 import하는 안.** 테스트와 훅이 옵션 없이 `node`를 띄우므로 `.ts`를 읽게 하려면 별도 실행 파일, 기능 감지, 자기 재실행이 함께 필요했다. 두 벌을 없애려고 그보다 큰 장치를 들이지 않는다.
- **넷째 사람 확인 지점(`범위 승인`).** 사람이 확인하는 지점은 셋뿐이라는 규칙과 어긋난다. 범위 밖 변경은 검사를 자동으로 더하고 `status`에 표시하고 `PR 승인`에서 받는다.
- **`start-verification`과 `verify`가 서로 다른 검사를 하는 안.** 전체 테스트는 4초가 안 걸린다. 문제는 시간이 아니라 AI가 치는 명령 수이고, 검사가 둘로 갈리면 첫 검증에 명령이 하나 더 든다.
- **환경변수로 검사 실행기를 바꿔 끼우는 시험용 장치.** 변수 하나로 아무 검사도 돌리지 않고 통과를 적을 수 있게 된다. 시험용 실행기는 함수 인자로 넣는다.
- **도구 슬라이스를 한동안 멈추는 안.** v1의 방향이 완성도 쪽이고 그 작업들이 이 워크플로우를 계속 지난다. 2단계를 갈지는 §6의 기준으로 정한다.
- **`approve-pr`의 `.meta` 검사를 항상 하는 안.** 건너뛰어 아끼는 시간은 작지만, 「검사는 변경 집합으로 계산한다」는 결정과 「main의 무관한 `.meta` 누락 때문에 도구 슬라이스가 막히지 않는다」가 우선이다. 단독 명령 `check-meta`는 항상 검사한다.
- **CI용 스크립트 `verify:ci`를 두는 안(2026-10-05).** 이 저장소에는 CI가 없다. 같은 검사에 입구를 둘 두는 비용만 남는다.
- **재측정 도구를 `tools/wf-measure/`로 커밋하는 안(2026-10-05).** 도구 유지비를 줄이려는 슬라이스가 유지할 도구를 하나 더 만드는 것은 맞지 않는다.
- **1단계만 계획하고 2단계는 리뷰하지 않는 메모로 붙이는 안, 1·2단계를 한 PR로 내는 안(2026-10-05).** 앞의 것은 2단계를 열 때 계획을 처음부터 다시 세운다. 2단계의 약속과 여는 기준을 지금 리뷰하는 데도 비용이 들지만(§6이 한 절 분량이다), 그때 처음부터 다시 세우는 것보다는 적다고 본다. 뒤의 것은 변경이 커지고 1단계를 써 보고 정하는 판단 지점이 사라진다.

### 2.3 이 슬라이스에서 정하지 않거나 미루는 것

- **상태 파일을 git 추적 대상에서 뺄지.** 정하지 않는다. F10이 정한다(§2.1).
- **계획 절차 문서(`planning.md`)에 도구 슬라이스의 리뷰 구성을 적을지.** 미룬다. 계획 문서에 범위를 적는 2단계에서 함께 정한다.
- **검사가 몇 번 돌았고 몇 번 막았는지를 파일에 적어 둘지.** 옛 계획은 2단계에 넣기로 했지만, 지금 2단계에 대해 정하는 것은 약속 넷뿐이다. 2단계를 열 때 정한다.
- **요구사항 문서 §7이 든 후보 가운데 뺀 것.** `approve-plan`이 계획 문서를 파일 이름으로만 찾는 문제, `wf start`가 진행 중인 슬라이스도 초기화하는 문제, F71, F76, F86이다. 후보별 이유는 설계 문서 「요구사항 문서가 든 후보의 처리」에 있다.

## 3. 지금 절차에서 바뀌는 것

| 지금 | 어디에 적혀 있나 | 이 슬라이스 뒤 |
|---|---|---|
| 검증은 `/cso` → `pass cso` → `pnpm typecheck` → `pass ts` → `pnpm check --write` → `pass lint` → 커밋 → 리뷰 → `pass review` 순이다 | `workflow/verification.md` · `CLAUDE.md` 9단계 뼈대 6번 | `start-verification`이 통합 검사를 돌린다. 검증 안에서는 커밋 → (적용될 때만 `/cso` → `pass cso`) → 리뷰 → `pass review` 순이다. 커밋을 앞에 두는 이유는 `pass cso`가 적는 `cso_commit`이 점검한 변경을 담은 커밋이 되게 하려는 것이다 — 그래야 다음 `/cso --diff --base`가 이미 본 부분을 다시 보지 않는다 |
| `pass ts`가 타입 검사를 직접 돌린다 | `CLAUDE.md` 명령 표 · `workflow.mjs`의 `pass` | 타입 검사는 통합 검사 안에서 돈다. `pass ts`·`pass lint` 명령은 없다 |
| 코드를 고친 뒤의 `/cso`는 처음과 같은 범위로 다시 한다 | `workflow/verification.md` | 직전에 통과한 커밋 뒤 바뀐 부분만 본다 |
| QA 문서는 씬·프리팹·에디터 절을 항상 채운다 | `workflow/qa-setup.md` | 계획이 `game/**`를 건드리지 않으면 그 절을 쓰지 않는다. QA 문서 자체도 사유와 함께 생략할 수 있다 |
| `approve-pr`은 타입 검사 범위가 `full`이 아니면 거부한다 | `workflow.mjs`의 `approve-pr` · `CLAUDE.md` 명령 표 | 변경 집합에 게임 전체 타입 검사의 적용 경로가 없으면 `logic-only`도 받는다 |
| `approve-pr`은 추적되지 않은 `.meta`를 항상 검사한다 | `CLAUDE.md` 「에셋 `.meta` 관리 규칙」 · `workflow/user-verification.md` | 변경 집합에 `game/assets/**`가 있을 때만 검사한다 |
| F78은 「판정 코드를 `tests/helpers/`에 한 벌 두고 도구가 vitest를 띄우는 형태」로 닫는다 | `backlog-docs.md` F78 | `.claude/lib/*.mjs`를 도구와 테스트가 함께 import한다. `check-links`·`check-qa`는 지금 형태를 유지한다 |

ADR 004(워크플로우 상태 머신)의 명령 표는 이 슬라이스 뒤로 지금 절차와 더 달라진다. ADR은 고치지 않는다. `docs/decisions/README.md`가 이미 ADR 004를 지금의 명세로 읽지 말라고 적고 있고, 백로그 F75가 그 내용을 `workflow/README.md`로 옮길 예정이다.

## 4. 제약

- **phase 이름을 바꾸지 않고 상태 파일의 기존 키를 없애지 않는다.** 새 키는 둘이고 상태 파일 최상위에 둔다. `qa_skip_reason`은 QA 문서 생략 사유이고 `cso_commit`은 `pass cso`를 친 때의 커밋이다. 키가 없으면 「값 없음」으로 읽는다. 이 규칙은 옛 파일만을 위한 것이 아니다. 새 도구도 `skip-qa`를 친 적 없는 슬라이스의 상태 파일에는 `qa_skip_reason`을 쓰지 않는다. 그래서 새 키를 읽는 모든 자리가 「없을 수 있다」를 받아야 한다. 새 키를 `verification` 안에 넣지 않는 이유는 옛 도구가 그 안의 값이 전부 참인지로 판정하기 때문이다. 넣으면 아래 복구 절차에서 옛 도구가 새 상태 파일을 읽지 못한다.
- **기록용 값 셋을 남긴다.** `ts_check_clean`·`lint_clean`·`ts_check_scope`는 전이의 조건이 아니라 기록이 된다(W2). 그래도 지우지 않는 이유는 셋이다. `status`가 마지막 통합 검사 결과를 이 값으로 보여 준다. 복구 절차에서 옛 도구가 이 값을 읽는다. 기존 테스트가 이 값들을 쓴다. 2단계를 열지 않기로 정하면 이 값 셋을 정리할지 묻는 백로그 항목을 그때 만든다.
- **새 도구가 깨졌을 때의 복구 절차.** 새 트러블슈팅 문서(W6)에 적는다. 요약하면 이렇다. `verification`에서 터진 결함은 그 자리에서 고친다. `approve-pr`에서 터진 것은 `rework`로 돌아가 고친다. 그것도 안 되면 깨지기 전의 `workflow.mjs`를 환경변수 `CLAUDE_PROJECT_DIR`로 이 폴더에 겨눠 쓴다. 이 슬라이스가 머지되기 전에는 원래 폴더(`F:\work\monster`)의 `workflow.mjs`가 그것이다. 이 길은 `pnpm wf` 모양이 아니라서 사람 확인창을 거치지 않는다. 그래서 AI가 스스로 쓰지 않고 사용자가 직접 지시할 때만 쓴다.
- **정본의 이력 규칙은 건드리지 않는다.** `renderCanonDoc`을 `.claude/lib/canon.mjs`로 옮기되 `이력:` 줄을 찍는 문구는 그대로 옮긴다. 절차 문서를 고칠 때 본문에는 지금의 절차만 적는다.
- **전이 시험은 임시 폴더에서 한다.** 실제 상태 파일에서 `wf start`를 돌리면 이 슬라이스의 상태가 사라진다(요구사항 문서 §6.2).
- **구현 단계에 들어가면 `workflow.mjs`에 손대기 전에 상태 파일을 한 번 커밋한다.** 반쯤 고친 도구가 상태 파일을 잘못 쓰면 `git restore`로 돌아갈 곳이 마지막 커밋이다.
- **글자 수 상한.** `CLAUDE.md`와 「항상 읽는다」 정본 셋의 합계는 상한 38,000자에 여유 478자다(PR #94가 먼저 머지되면 301자). 이 슬라이스는 그 합계를 늘리지 않는다(W6에 실측).
- **`.meta`를 만들지 않는다.** 이 슬라이스는 `game/**`를 건드리지 않으므로 새 `.meta`가 0개여야 한다.
- **메모리는 머지 때 고친다.** 절차를 말하는 Claude 자동 메모리가 새 명령과 어긋나게 되지만, 원래 폴더가 함께 쓰는 메모리라 PR을 머지할 때 고친다(요구사항 문서 §5.2). 대상은 계획 승인 뒤 목록으로 만든다.
- **서브에이전트 리뷰를 다른 도구로 옮기는 일은 범위 밖이다.**

## 5. 1단계 작업

작업 묶음 일곱이다. 구현 순서는 W5(시험 도우미) → W1 → W4 → W2 → W3 → W6 → W7을 권한다. 뒤의 묶음이 앞의 묶음을 쓴다.

### W1. 변경 집합과 적용 판정 — `.claude/lib/git.mjs` · `.claude/lib/change-set.mjs`

**변경 집합을 구한다.** `collectChangeSet(root)`가 `git merge-base origin/main HEAD`로 갈라진 지점을 구한다. git이 추적하는 파일의 변경은 `git diff --name-status -z --no-renames <갈라진 지점>`으로, 추적하지 않는 새 파일은 `git ls-files -o --exclude-standard -z`로 얻어 합친다. `--no-renames`가 있어야 이름을 바꾼 파일이 삭제 하나와 추가 하나로 나온다. 없으면 한 항목이 세 토막으로 나와 그 뒤 항목까지 어긋나게 읽는다. 항목은 `{status: 'A'|'M'|'D', path}`이고 경로는 git이 낸 저장소 기준 경로를 그대로 쓴다(소문자로 바꾸지 않는다). `.claude/workflow-state.json`은 뺀다. 도구가 스스로 쓰는 파일이라, 넣으면 모든 슬라이스의 변경 집합에 `.claude/**`가 들어가 `/cso`가 항상 적용된다.

**구할 수 없으면 모든 검사를 적용한다.** 아래 경우에는 `measurable: false`를 돌려주고, 그러면 검사 셋이 모두 적용되고 QA 문서 생략도 받지 않는다. 건너뛰어도 되는지 알 수 없을 때 건너뛰지 않기 위해서다.

- `origin/main` 참조가 없다.
- `origin/main`과 `HEAD`에 공통 조상이 없다(`git merge-base`가 종료 코드 1에 빈 출력 — 얕은 클론이거나 이력이 다른 `origin/main`이다). `status`가 `null`이 아니라서 이 줄이 없으면 빈 기준 커밋으로 `git diff`를 치게 된다.
- git 저장소가 아니다.
- 실행한 폴더가 저장소 루트가 아니다. `git rev-parse --show-prefix`가 빈 문자열인지로 잰다. 경로 문자열을 비교하지 않는 이유는 이 장비에서 git은 `F:/…`를, Node는 `F:\…`를 내서 비교가 항상 어긋나기 때문이다.
- git 출력을 받지 못했다(`spawnSync`의 `error`가 있거나 `status`가 `null`이다).

원인별 처방 문장(「`origin/main`이 없다 → `git fetch origin main`」, 「하위 폴더에서 실행했다 → 저장소 루트에서 실행」)은 함수 하나가 만들고, 적용 판정을 쓰는 모든 명령이 같은 문장을 찍는다. 판정 전에 `fetch`하지 않는다. 로컬의 `origin/main`이 뒤처져 있으면 갈라진 지점이 앞으로 가서 변경 집합이 커지기만 하므로, 검사가 덜 걸리는 쪽으로는 틀리지 않는다.

git을 띄우는 `spawnSync`에는 모두 `maxBuffer: 64 * 1024 * 1024`를 준다. 기본값 1MiB는 큰 아트 슬라이스의 `git diff` 출력에서 넘친다.

**적용 경로는 이 파일의 상수다.** 각 상수 위에 정책 문장을 주석으로 적어, 나중에 목록만 고치고 이유를 잃지 않게 한다.

| 상수 | 경로 | 정책 |
|---|---|---|
| `CSO_PATHS` | `.claude/*.mjs`, `.claude/hooks/**`, `.claude/lib/**`, `.claude/settings.json`(저장소가 추적하는 자리만 — Claude Code가 판마다 만드는 생성물은 걸리지 않는다; `.claude/commands/**`는 생기면 더한다), `tools/**`, `tests/helpers/**`, `tests/fixtures/**`, `.husky/**`, `.vscode/**`, `vitest.config.*`, 루트의 `package.json`·`pnpm-lock.yaml`·`tsconfig*.json`·`biome.json`·`.gitattributes`·`.gitignore`, `game/tsconfig.json`, `game/package.json`(git이 추적하는 게임 쪽 의존성 목록 — `game/pnpm-lock.yaml`이 생기면 함께), `**/*.{sh,ps1,cmd,bat,py}`. 생기면 `.github/**`·`.npmrc`·`pnpm-workspace.yaml`·`.gitmodules`·`.mcp.json` | 개발 장비에서 실행되는 코드·자동화·의존성·공급망·git 실행 동작을 바꾸는 파일 |
| `META_PATHS` | `game/assets/**` | Cocos가 `.meta`를 만드는 자리 |
| `FULL_TYPECHECK_PATHS` | `game/**/*.ts`, `game/tsconfig.json`, `game/package.json`, `game/settings/**`, `pnpm-lock.yaml` | 게임 코드의 타입 검사 결과를 바꿀 수 있는 파일 |
| `QA_PATHS` | `game/**` | 게임 동작을 바꿀 수 있어 사용자가 인게임에서 확인할 목록이 필요한 파일 |

- `CSO_PATHS`에서 `tests/logic/**`를 빼는 것은 예외다. 테스트도 개발 장비에서 실행되는 코드지만, 넣으면 모든 슬라이스가 만드는 피처 테스트 때문에 `/cso` 해당 없음이 한 번도 나오지 않는다(2026-09-17 결정). 그 대신 프로세스를 띄우는 테스트 코드는 `tests/helpers/`에 둔다. 이 약속을 테스트 하나로 지킨다. 「`tests/logic/` 아래 파일은 `node:child_process`를 import하지 않는다」다. 지금 직접 띄우는 세 파일은 W5에서 고친다. 이 예외와 이유를 `CSO_PATHS` 위 주석에 함께 적는다.
- `CSO_PATHS`에 게임 코드(`game/**`)가 없는 것도 조건이 붙은 예외다. 지금 게임에는 결제·로그인·서버·외부 연동이 없어서, 게임 코드가 바뀌어도 `/cso`가 찾는 위험(개발 장비에서 명령이 실행되거나 비밀값이 밖으로 나가는 것)이 생기지 않는다. 그런데 v2는 Steam 유료 출시와 스킨 판매를 계획한다(백로그 F61). 구매 확인이나 Steam 연동 코드가 게임에 들어오면 「사지 않은 스킨이 풀린다」「저장 파일을 고쳐 유료 아이템을 얻는다」 같은 위험이 게임 코드 안에 생기는데, 그 경로가 `CSO_PATHS` 밖이면 그 코드는 보안 점검 없이 머지된다. 그래서 이 조건과 「그런 코드가 들어오면 그 경로를 `CSO_PATHS`에 더한다」를 `CSO_PATHS` 위 주석과 `verification.md`의 `/cso` 적용 문장 옆에 함께 적는다. 같은 할 일을 F61 행에도 적어, v2 작업을 여는 사람이 백로그에서 보게 한다.
- `QA_PATHS`를 `META_PATHS`보다 넓게 잡는 이유는, 화면 크기나 물리 설정이 든 `game/settings/` 아래 파일만 고쳐도 게임 동작이 바뀌기 때문이다.

- `FULL_TYPECHECK_PATHS`를 `game/**` 전체로 두지 않는다. `game/assets/`에는 그림과 `.meta`가 많아서, 그렇게 두면 그림만 바꿔도 게임 전체 타입 검사 의무가 생긴다. TypeScript는 폴더가 아니라 확장자로 잡는다. 지금 `.ts`는 `game/assets/scripts/` 밖에 없지만(2026-10-05 확인), 나중에 다른 폴더에 생겨도 걸려야 하기 때문이다.
- 게임 코드는 지금 JSON 파일을 import하지 않는다(2026-10-05 확인). import하기 시작하면 JSON 변경도 타입 검사 결과를 바꾼다. 그래서 「`game/assets/scripts/` 아래 코드가 `.json`을 import하지 않는다」를 테스트 하나로 지키고, 깨지면 그때 적용 경로를 넓힌다.
- 루트 `package.json`은 `FULL_TYPECHECK_PATHS`에 넣지 않는다. 의존성이 바뀌면 `pnpm-lock.yaml`이 함께 바뀌고, `scripts` 줄만 고치는 것은 타입과 무관하다. 이 슬라이스도 lint-staged 설정 때문에 루트 `package.json`을 고친다.
- `.env*`는 `CSO_PATHS`에 넣지 않는다. `.env`와 `.env.local`은 이미 git이 무시해서 변경 집합에 들어오지 않고, 비밀값은 어느 파일에든 들어갈 수 있어 경로로는 잡히지 않는다. 비밀값은 코드 리뷰가 본다(W6).
- 경로 맞추기는 폴더 경계를 지킨다. `toolsmith/x`는 `tools/**`에 걸리지 않고, `game/package.json`은 루트 `package.json`에 걸리지 않는다. 보호하는 폴더 이름의 대소문자만 다른 경로(`.Claude/`)도 같은 폴더로 본다.

**검사별 적용 여부를 돌려준다.** `applicableGates(changeSet)`가 `meta`·`fullTypecheck`·`cso`·`qa` 각각에 대해 `{applies, matches, rule}`을 돌려준다. `qa`는 변경 집합에 `QA_PATHS`가 걸렸는지이고, QA 문서가 필요한지 판정할 때 쓴다(W2). `matches`는 변경 집합에서 걸린 경로이고 `rule`은 걸린 적용 경로다. `status`와 전이가 막혔을 때의 안내가 「어느 파일 때문에 적용됐는지」와 「어느 경로가 없어서 해당 없음인지」를 이 값으로 찍는다. 적용 여부는 저장하지 않는다. `status`·`skip-qa`·`ready-impl`·`start-verification`·`pass`·`approve-pr`이 부를 때마다 다시 계산한다.

`.claude/lib/*.mjs`는 상태 파일을 읽거나 쓰지 않는다. 상태 파일은 `workflow.mjs`만 쓴다.

**저장소 `.gitignore`에 Claude Code가 만드는 파일을 적는다.** `.claude/settings.local.json`과 실행 중에 생기는 것들(`.claude/scheduled_tasks.json`·`.claude/scheduled_tasks.lock`·`.claude/worktrees/`·`.claude/checkpoints/`·`.claude/mailbox/`·`.claude/routines/.state/`·`.claude/agent-registry.json`·`.claude/agent-memory-local`·`.claude/first-run`·`.claude/assistant-daemon-state.json`)이다. 지금은 이 파일들을 무시하는 규칙이 이 장비의 전역 설정과 `.git/info/exclude`에만 있다. 그 설정이 없는 장비에서는 biome(`vcs.useIgnoreFile`, W4)이 이 파일들을 검사 대상으로 본다. `CSO_PATHS`는 `.claude` 아래의 추적 자리만 들므로 `/cso` 적용 여부는 이 파일들에 흔들리지 않는다.

**테스트(W5의 임시 저장소에서).**
- 변경 집합: 추적 파일 수정, 새 파일, 삭제, 이름 바꾸기(삭제 + 추가로 읽힌다), 공백이 든 파일명, 한글 파일명, 상태 파일 제외.
- 구할 수 없는 경우: `origin/main` 없음, 하위 폴더에서 실행, git 출력 실패(`error` 주입). 각각 모든 검사가 적용되는지.
- 경로 경계: `toolsmith/x` ∉ `tools/**`, `game/package.json` ∉ 루트 `package.json`, `game/assets/art/a.png` ∉ `FULL_TYPECHECK_PATHS`, `game/elsewhere/x.ts` ∈ `FULL_TYPECHECK_PATHS`.
- 대표 변경 집합 여섯의 판정이 아래 표와 같은지.
- 저장소 `.gitignore`에 위 줄들이 있는지, 게임 코드가 `.json`을 import하지 않는지, `tests/logic/` 아래 파일이 `node:child_process`를 import하지 않는지를 파일 내용으로 확인한다.

| 바꾼 것 | `meta` | `fullTypecheck` | `cso` | QA 문서 |
|---|---|---|---|---|
| 문서만(`docs/**`) | 해당 없음 | 해당 없음 | 해당 없음 | 생략 가능 |
| 도구만(`tools/blender/**` 또는 `.claude/workflow.mjs`) | 해당 없음 | 해당 없음 | 적용 | 생략 가능 |
| 순수 로직 테스트만(`tests/logic/**`) | 해당 없음 | 해당 없음 | 해당 없음 | 생략 가능 |
| 그림과 `.meta`만(`game/assets/art/**`) | 적용 | 해당 없음 | 해당 없음 | 필요 |
| 게임 TypeScript(`game/assets/scripts/**`) | 적용 | 적용 | 해당 없음 | 필요 |
| 게임 프로젝트 설정만(`game/settings/**`) | 해당 없음 | 적용 | 해당 없음 | 필요 |

### W2. 통합 검사와 전이 판정 — `.claude/lib/verify.mjs` · `.claude/lib/transition.mjs` · `workflow.mjs`

**통합 검사.** `runVerify(runners = defaultRunners, { write = true } = {})`가 biome, 타입 검사, vitest를 차례로 돌리고 출력을 받아 둔다. biome을 먼저 돌리는 이유는 `write`가 참일 때 biome이 고친 뒤의 코드를 타입 검사와 테스트가 보게 하려는 것이다 — 반대 순서면 타입 검사가 본 코드와 디스크의 최종 코드가 다르다. 하나가 실패해도 멈추지 않고 셋을 다 돌린다. 한 번에 세 결과를 보게 하려는 것이다.

- 타입 검사는 `typecheck.mjs`의 `runTypecheck`에 `{ capture: true }` 옵션을 더해 출력을 돌려받는다. `pnpm typecheck` 단독 실행은 지금처럼 화면에 바로 찍는다.
- vitest는 `--reporter=json --outputFile=<실행마다 새로 만든 임시 폴더의 파일>`로 돌리고 끝나면 그 폴더를 지운다. 고정 경로를 쓰지 않는 이유는 원래 폴더와 이 폴더에서 동시에 돌 때 서로의 결과를 읽지 않게 하려는 것이다.
- biome은 `--reporter=summary`로 돌린다. `write`가 참이면 `--write`를 붙여 형식 차이를 자동으로 고치고, 린트 위반만 실패로 센다. 요약에 「n개 파일을 고쳤다」를 찍는다.
- 각 실행기는 `{status, scope?, summary, details}`를 돌려주고, `runVerify`는 `{ok, results: {typecheck, biome, vitest}}`를 돌려준다.
- 출력은 검사마다 요약 한 줄이다. 실패한 검사에만 상세를 40줄까지 붙이고(넘으면 「…N줄 생략」) 다시 돌려 볼 명령(`pnpm typecheck`·`pnpm check`·`pnpm exec vitest run`)을 찍는다. biome이 내는 정보 수준 진단(지금 `hitbox-viewer.html`에서 29건)은 실패가 아니므로 요약 줄에 오류로 섞이지 않게 한다.
- 기본 실행기 정의는 `verify.mjs` 한 곳에만 둔다. 실행기를 바꿔 끼우는 환경변수는 만들지 않는다. 시험용 실행기는 단위 테스트가 함수 인자로 넣는다.
- 실행기를 띄우지 못하면(`ENOENT`) 「실행기 `<이름>`을 실행할 수 없다(`pnpm` 경로 확인)」를 찍고 실패로 센다. vitest가 결과 파일 없이 실패로 끝나면 「테스트 실행기가 결과 없이 끝났다, `pnpm exec vitest run`으로 다시 돌려 보라」를 찍는다. vitest 실패 출력에 `tsconfig.cocos.json`이 보이면 「Cocos가 만드는 파일이 없어 게임 스크립트를 불러오지 못했다. Cocos로 프로젝트를 한 번 열어라」를 덧붙인다(W7의 새 백로그 항목을 가리킨다).
- `verify.mjs`는 `workflow.mjs`가 import해서 쓰는 모듈이다. 단독으로 실행하는 입구는 만들지 않는다.
- Windows에서 `.cmd`를 띄우려면 `shell: true`가 필요하므로 유지한다. 그래서 인자의 경로는 따옴표로 감싼다.

**`start-verification`.** 지금은 전체 테스트만 돌린다. 이제 `runVerify`를 돌리고, 셋이 다 통과해야 `verification`으로 넘어간다. 넘어가면서 `ts_check_clean`·`lint_clean`·`ts_check_scope`를 적는다. 성공 출력 끝에 `status`와 같은 적용 판정 표를 찍어 `status`를 한 번 더 치지 않게 한다.

**`verify`(새 명령, `implementation`·`verification`·`user-verification`에서).** 통합 검사를 다시 돌려 기록용 값 셋만 다시 적는다. 어느 phase에서도 다음 phase로 넘기지 않는다 — 기록용 값은 조건이 아니라 어디서 적어도 해가 없다. `pass`가 넘기기 직전에 스스로 통합 검사를 돌리므로, 코드를 고친 뒤 `verify`를 먼저 칠 의무는 없다. 쓰임은 「넘기지 않고 지금 결과만 보고 싶을 때」와 「`user-verification`에서 사용자가 잡은 작은 수정 뒤 기계 검사 셋을 한 번에 돌릴 때」다. `user-verification`에서는 biome을 `write: false`로 돌린다(플래그로도 켜지 못한다) — 그 phase는 훅이 게임 스크립트 편집을 막는 phase인데 `biome.json`이 `game/assets/scripts`를 검사 대상으로 두므로, `--write`로 돌리면 도구가 잠긴 코드를 고치게 된다. 형식 차이가 나오면 실패로 세고 「`pnpm wf rework` 뒤 `pnpm wf verify`로 고친다」를 안내한다. 그 밖의 phase(`planning`·`qa-setup`·`pr-ready`·`done`)에서 치면 「코드를 검사하는 phase가 아니다」로 거부한다.

**전이 판정.** `transition.mjs`의 `decideTransition({state, gates, qaRequired, qaClean?, canonDeclared, verifyResult?})`가 `{transition, needsQa, needsVerify, blockers, patch}`를 돌려준다. 입력만으로 답을 내는 함수라 단위 테스트로 모든 갈래를 볼 수 있다. 순서는 이렇다.

1. 통과 표시를 남기는 판단 검사 둘이 통과했는가. `code_review_clean`은 항상 본다. `cso_done`은 `/cso`가 적용될 때만 본다.
2. QA 문서가 필요하면(아래 판정표) 확정됐는가.
3. 정본 갱신을 선언했는가.
4. 위 셋이 다 통과했는데 `verifyResult`가 없으면 `needsVerify: true`를 돌려준다. 그러면 `workflow.mjs`가 통합 검사를 `write: false`로 돌리고 그 결과를 넣어 다시 부른다. 커밋과 리뷰가 끝난 뒤라서 파일을 고치지 않는 쪽으로 돌린다. 위 셋 가운데 하나라도 막혀 있으면 통합 검사를 돌리지 않는다.
5. 통합 검사가 통과하면 `user-verification`으로 넘어간다.

`ts_check_clean`·`lint_clean`·`ts_check_scope`는 조건이 아니라 4번의 결과를 적는 기록이다. 조건에 넣으면 `invalidate`가 그 값을 거짓으로 만들어, 코드를 고칠 때마다 `verify`를 한 번 더 쳐야 한다. 이 슬라이스가 줄이려는 것이 바로 그 반복이다.

4번에서 통합 검사가 실패하면 넘어가지 않는다. 타입·린트·테스트 가운데 하나라도 진짜로 실패했으면 코드가 바뀌어야 한다는 뜻이므로, 그 자리에서 `invalidate`와 같은 일을 한다 — 통과 표시 둘(`cso_done`·`code_review_clean`)과 정본 선언을 비우고 QA 문서의 지문을 찍는다(`cso_commit`과 기록용 값 셋은 남긴다). 안내만 하고 표시를 남겨 두면, 실패를 본 직후 고치고 `pass review`를 다시 치는 가장 자연스러운 손놀림에서 고치기 전 코드로 받은 리뷰·`/cso` 표시가 그대로 통과한다 — §6이 「세기 어렵다」고 적은 둘째 경우가 바로 이 길에서 가장 자주 난다. 지우지 않는 실패는 둘이다. biome 형식 차이만 실패한 경우(판단 검사와 무관하다)와, 실행기를 띄우지 못했거나 테스트 실행기가 결과 없이 끝난 경우(코드가 아니라 환경의 문제다). 안내는 「통합 검사 실패 — 판단 검사 표시를 지웠다. 고친 뒤 절차대로 다시 한다(정본 선언 → QA 문서가 필요하면 갱신 → 커밋 → 적용 시 `/cso --diff --base <커밋>` → 리뷰 → `pass review`)」다. 코드를 고쳤으면 통과 표시를 지운다는 규칙(`CLAUDE.md` 9단계 6번)을 도구가 대신 지키는 것이고, 명령 수는 늘지 않는다(어차피 `invalidate`를 쳐야 했다).

막혔을 때는 `status`와 같은 모양의 줄(어느 검사가 왜 적용되는지)과 다음에 칠 명령을 찍는다. `verify`·`pass`·`start-verification`의 실패 안내는 모두 「절차: `pnpm wf steps verification`」으로 끝낸다. 실패했을 때는 절차 문서가 출력되지 않으므로 이 한 줄이 절차 문서로 가는 유일한 길이다.

**`pass`.** 인자는 `cso`와 `review`만 받는다. `ts`나 `lint`를 치면 「통합 검사는 `pnpm wf verify`로 다시 돌린다」를 안내하고 실패로 끝낸다. `/cso`가 해당 없음일 때 `pass cso`를 치면 받되 「`/cso` 해당 없음(`CSO_PATHS` 변경 없음 — `pnpm wf status`로 확인) — 기준 커밋만 남긴다」를 찍고 `cso_commit`만 적는다. `cso_done`은 거짓으로 둔다. 자발적으로 돌린 점검의 기준 커밋은 남기되 통과 표시는 적용될 때만 생기게 하려는 것이다 — 해당 없음일 때 참을 적어 두면, 뒤에 `.claude/**`를 고쳐 `/cso`가 적용으로 바뀌었는데 `invalidate`를 잊었을 때 그 값이 판정을 그냥 지난다(적용 여부는 매번 다시 계산하면서 통과 표시는 적용 여부와 무관하게 남는 비대칭이다).

**코드를 고친 뒤의 `/cso`는 바뀐 부분만 본다.** `/cso` 통과 표시는 지금처럼 코드를 고칠 때마다 지운다(`invalidate`와 `rework`가 지운다). 달라지는 것은 다시 할 때의 범위다.

- `pass cso`가 그때의 `HEAD` 커밋을 `cso_commit`에 적는다.
- `invalidate`와, 리워크 뒤의 `start-verification`은 `/cso`가 적용되고 `cso_commit`을 쓸 수 있으면 「`/cso`는 바뀐 부분만 다시 본다: `/cso --diff --base <cso_commit>`」을 안내한다.
- `cso_commit`을 쓸 수 없으면 전체 `/cso`를 안내한다. 쓸 수 없는 경우는 둘이다. 키가 없다. 또는 그 커밋이 지금 `HEAD`의 조상이 아니다(`git merge-base --is-ancestor <cso_commit> HEAD`로 확인한다). 리베이스를 했거나, 다른 장비로 옮겼는데 그 커밋이 거기 없을 때가 그렇다. 조상이 아닌데 그대로 안내하면 명령이 실패하거나 main에서 들어온 변경까지 범위에 들어간다.
- 절차는 커밋 뒤에 `/cso` → `pass cso`를 치게 한다(§3). 그래도 `pass cso`를 커밋 전에 쳤다면 `cso_commit`은 점검한 내용보다 앞선 커밋이다. 그러면 다음 점검이 이미 본 부분까지 다시 본다. 더 보는 쪽으로만 틀린다.
- `cso_commit`은 통과 표시가 아니라 다음 점검의 기준일 뿐이다. 통과 표시를 지우는 함수는 이 값을 건드리지 않는다. `wf start`가 만드는 새 상태에는 이 키가 없다.

**QA 문서 생략 — `skip-qa "<사유>"`(새 명령, `qa-setup`·`implementation`·`verification`에서. `skip-qa --clear`는 사유를 지운다).** 사유를 `qa_skip_reason`에 적는다. `--clear`는 키를 없애 「생략 없음」으로 되돌린다 — 상태 파일을 손으로 고치는 길은 훅이 막으므로 되돌릴 명령이 있어야 한다. 생략해도 되는지는 명령을 친 순간에 굳히지 않고 필요할 때마다 다시 판정한다. `qa-setup`에서는 아직 구현 전이라 어떤 슬라이스든 변경 집합에 게임 파일이 없기 때문이다. 보는 경로는 `QA_PATHS`(`game/**`)다.

| `qa_skip_reason` | 변경 집합의 `game/**` | QA 문서 |
|---|---|---|
| 없음 | 상관없음 | 필요하다(지금과 같다) |
| 있음 | 없음 | 생략이 유효하다 |
| 있음 | 있음 | 필요하다. 「생략 사유가 더는 맞지 않는다: <걸린 파일>」을 안내한다. 저장한 사유는 지우지 않는다 |
| 있음 | 변경 집합을 구할 수 없음 | 필요하다 |

- 이 판정을 `qaRequired(state, gates)` 함수 하나가 내고, 쓰는 자리는 넷이다. `skip-qa`는 치는 순간 이미 `game/**` 변경이 있으면 「QA 문서가 필요하다」며 받지 않는다. `ready-impl`은 QA 문서가 필요할 때만 문서가 있는지 본다(지금은 무조건 본다). `pass`는 `user-verification`으로 넘기기 전에 QA 문서가 필요할 때만 문서가 확정됐는지 본다. `status`는 사유와 함께 지금 유효한지를 찍고, 사유가 없으면 「QA 문서 생략: 없음」을 찍는다.
- `start-verification`은 지금도 QA 문서를 보지 않고 앞으로도 보지 않는다. `approve-pr`은 다시 판정하지 않는다(§6의 「1단계가 막지 못하는 경우」와 같은 성격이다).
- 게임 슬라이스가 `qa-setup`에서 생략했다가 검증에서 막히는 것은 의도한 쓰임이 아니라 안전장치다. `qa-setup.md`에 「계획이 `game/**`를 건드리면 생략하지 않는다」고 적는다.

**테스트.**
- `decideTransition` 단위: 통과 → 넘어감과 적을 값. 통합 검사 실패(타입·린트·테스트) → 넘어가지 않음, 통과 표시 둘과 정본 선언이 비고 QA 지문이 찍힘, `cso_commit`·기록용 값 셋은 남음. 형식 차이만 실패, 실행기 없음, 결과 없음 → 넘어가지 않되 표시는 그대로. `/cso` 해당 없음이면 `cso_done`이 거짓이어도 통과. QA 문서와 정본 선언에서 막힘. 앞의 조건이 막혀 있으면 `needsVerify`가 거짓.
- `qaRequired` 단위: 위 판정표의 네 줄.
- 새 키가 없는 상태 객체(옛 형식)로 읽는 자리 다섯이 이렇게 움직이는지: `ready-impl`과 `pass`는 QA 문서를 요구하고, `status`는 「QA 문서 생략: 없음」을 찍으며 죽지 않고, `invalidate`와 `start-verification`은 전체 `/cso`를 안내한다.
- `cso_commit`이 `HEAD`의 조상이 아닐 때(임시 저장소에서 리베이스로 만든다) 전체 `/cso`를 안내하는지.
- `runVerify`: 시험용 실행기로 전부 성공, 일부 실패, 전부 실패의 결과와 출력 모양(검사마다 한 줄, 실패한 것만 상세). 실행기를 띄우지 못한 경우와 vitest가 결과 없이 끝난 경우의 안내.
- 명령: `pass ts`가 안내와 함께 실패한다. `/cso` 해당 없음일 때 `pass cso`가 「기준 커밋만 남긴다」를 찍고 `cso_commit`만 적으며 `cso_done`은 거짓 그대로다. `pass cso`가 `cso_commit`을 적는다. `invalidate`가 `/cso` 통과 표시를 지우고 `cso_commit`은 남긴다. `skip-qa`가 `game/**` 변경이 있으면 받지 않는다.
- 실제 프로세스로 도는 기존 테스트: `ClaudeMdSplit.test.ts`의 세 케이스(「전체 pass → user-verification」, 「막힌 뒤 선언하고 다시 치면 넘어간다」, 「canon-done이 기록하면 넘어간다」)는 `pass`를 자식 프로세스로 띄운다. 새 `pass`는 넘기기 직전에 통합 검사를 돌리므로, 개발 도구가 없는 임시 폴더에서는 이 셋이 깨진다. W5의 가짜 `pnpm`으로 통과를 유지한다. 같은 가짜 `pnpm`이 vitest 실패를 내는 변형으로 「`pass review`가 넘기기 직전 검사에서 실패하면 넘어가지 않는다」와 「`verify`는 넘기지 않는다」를 실제 프로세스로 고정한다. 통합 검사에 「`tests/logic`이 없으면 건너뛴다」 같은 예외는 두지 않는다. 그런 예외가 있으면 폴더 하나를 지우는 것만으로 기계 검사가 꺼진다.

### W3. `approve-pr` · `status` · `check-meta`

- **`approve-pr`.** 판정을 `approvePrDecision({gates, tsScope, tsStatus, missingMeta}) → {ok, reasons}`로 `transition.mjs`에 둔다(`decideTransition`과 같은, 입력만으로 답하는 함수다). `meta`가 해당 없음이면 `.meta` 검사를 건너뛰고 「해당 없음」을 찍는다. `fullTypecheck`가 해당 없음이면 타입 검사 범위가 `logic-only`여도 통과한다. 둘 다 적용이면 지금과 같다. 적용 판정 표를 타입 검사보다 먼저 찍는다.
- **`check-meta`.** 단독 명령은 항상 검사한다. 사용자가 일부러 부른 것이라 건너뛰지 않는다.
- **`status`.** 상태 아래에 이번 변경 집합 기준의 적용 판정을 검사마다 한 줄로 찍는다. 예: `meta: 해당 없음 (game/assets/** 변경 없음)`, `cso: 적용 (.claude/workflow.mjs 외 3개)`. 갈라진 지점의 커밋과 변경 집합 항목 수도 찍는다. 변경 집합을 구할 수 없으면 「기준을 구할 수 없어 모든 검사를 적용한다」와 원인별 처방을 찍는다. `skip-qa` 사유가 있으면 사유와 지금 유효한지를 찍는다. 상태 파일은 고치지 않는다. git 저장소가 아닌 폴더에서도 죽지 않는다.
- 없는 명령을 치면 「알 수 없는 명령: X」와 명령 목록을 찍는다.

**테스트.** `approvePrDecision`의 네 갈래(적용·해당 없음 × `.meta`·타입 검사 범위). 옛 형식 상태 파일 견본(W5)으로 `status`가 적용 판정 표를 내고 `approvePrDecision`이 판정을 내는지. `approve-pr`을 실제 프로세스로 띄우는 테스트는 가짜 `pnpm`(W5) 덕에 끝까지 돈다 — 적용 판정 표가 타입 검사보다 먼저 찍히는 것과 `pr-ready`로 넘어가는 것까지 확인한다.

### W4. 두 벌인 판정 코드 합치기 (F78)

| 지금 도는 것 | 복사본 | 이번에 |
|---|---|---|
| `workflow.mjs`의 `parseCanonSlug`·`assertOneLineField`·`renderCanonDoc`·`insertCanonRow`·`locateCanonListTable`과 접두사 상수 | `tests/helpers/CanonDoc.ts` | `.claude/lib/canon.mjs`로 옮긴다. `workflow.mjs`와 `CanonDoc.test.ts`가 import하고 `CanonDoc.ts`는 지운다 |
| `workflow.mjs`의 `check-docs` 판정 | `tests/helpers/WorkflowSteps.ts`의 `findStepDocIssues` | `.claude/lib/workflow-steps.mjs`로 옮긴다. `parsePhases`는 옮기지 않고 지운다. phase 목록을 import할 수 있게 되면 `workflow.mjs`의 글자를 정규식으로 읽어 낼 이유가 없다 |
| `DOC_EXEMPT_PHASES`·`STEP_DOC_INDEX` | 같은 파일 | `workflow-steps.mjs`에 한 벌 |
| `workflow.mjs`의 `PHASES`·`EDITABLE_PHASES` | 훅 `gate-scripts.mjs`의 `EDITABLE_PHASES` | `.claude/lib/phases.mjs`가 내보내고 `workflow.mjs`와 테스트가 import한다. **훅은 import하지 않고 자기 값을 그대로 둔다**(아래) |

- **훅이 import하지 않는 이유.** 편집 도구의 훅은 불러오기에 실패하면 경고만 하고 편집을 통과시킨다. 실패하면 막도록 바꾸면, `phases.mjs`에 문법 오류 하나가 생겼을 때 그 오류를 고치는 편집까지 막혀 빠져나올 수 없다. 그래서 훅에는 값 하나를 그대로 두고, 테스트가 훅 파일의 그 값이 `phases.mjs`가 내보내는 값과 같은지 확인한다.
- **타입 검사.** `tsconfig.tests.json`에 `allowJs: true`를 켜고 `include`에 `.claude/lib/**/*.mjs`를 더한다. `.claude/lib/*.mjs`는 첫 줄에 `// @ts-check`를 두고, 내보내는 함수마다 JSDoc(`@param`·`@returns`·`@typedef`)을 단다. JSDoc이 없는 함수는 타입이 `any`가 되어 테스트의 타입 확인이 약해진다(2026-09-17 실측). 옮길 코드는 지금까지 타입 검사를 받은 적이 없으므로, 함수 하나를 먼저 옮겨 고칠 양을 재고 나머지 분량을 다시 잡는다.
- **biome.** `biome.json`의 제외 목록에서 `!**/.claude`를 `!**/.claude/hooks`·`!**/.claude/*.mjs`·`!**/.claude/*.json`으로 바꿔 `.claude/lib/**`만 검사 대상이 되게 한다. 제외한 폴더의 하위를 다시 포함하는 방식은 biome 2.4.15에서 동작하지 않는다(2026-09-17 실측). 그리고 `"vcs": {"enabled": true, "clientKind": "git", "useIgnoreFile": true}`를 두어 git이 무시하는 파일을 biome도 무시하게 한다. 그러면 제외 목록의 `game/` 아래 여섯 줄과 `docs/temp`·`cloud-storage`·`.gstack` 세 줄은 `.gitignore`와 겹치므로 지운다. 이렇게 바꿔도 검사하는 파일 수가 지금과 같은 165개인 것을 원래 폴더에서 확인했다(2026-09-30, 서브에이전트 검토). biome은 저장소 `.gitignore`만 읽으므로, W1에서 `.gitignore`에 Claude Code 파일을 적는 일이 여기서도 필요하다. 적지 않으면 `.claude/worktrees/` 같은 폴더가 생겼을 때 biome이 그 안을 검사한다.
- **커밋 훅.** `package.json`의 lint-staged 대상 `*.{ts,tsx,js,jsx,json}`에 `mjs`와 `cjs`를 더한다. 없으면 `.claude/lib/*.mjs`가 biome 검사 대상인데 커밋 훅은 형식을 맞추지 않아서, 커밋은 되고 통합 검사는 실패한다. 대상에 `mjs`가 있는지 파일 내용으로 확인하는 테스트를 하나 둔다.
- **주석.** `workflow.mjs`에서 F78을 이유로 복사본과 vitest 띄우기를 설명하는 주석 넷, `QaDoc.ts`와 `DocsHygiene.test.ts` 머리말의 관련 설명을 F78을 닫은 뒤의 사실로 고친다. `check-links`와 `check-qa`가 vitest를 띄우는 이유(판정이 한 벌이다)는 남긴다.
- **테스트.** `ClaudeMdSplit.test.ts`의 「판정 코드가 두 곳에 복사돼 있다」를 전제로 한 확인을 「한 모듈에 있다」로 바꾼다. `workflow.mjs`가 `canon.mjs`·`workflow-steps.mjs`·`phases.mjs`를 import하는지, 훅의 `EDITABLE_PHASES` 값이 `phases.mjs`와 같은지를 파일 내용으로 확인한다.

### W5. 시험용 임시 저장소와 옛 형식 상태 파일

- **`tests/helpers/WfSandbox.ts`(새 파일).** `DocsHygiene.test.ts`의 `makeRepo`(임시 git 저장소)·`runWf`(그 안에서 `workflow.mjs`를 띄운다)와 `ClaudeMdSplit.test.ts`의 `makeSandbox(opts)`(git이 아닌 폴더에 상태 파일·문서를 옵션으로 꾸민다)를 하나로 합쳐 옮겨 온다. 내보내는 것은 `makeRepo(opts)`(git 저장소 + `makeSandbox`의 옵션), `runWf(dir, args, env)`, `git(dir, ...args)` 셋이고, `DocsHygiene.test.ts`의 나머지 git 호출(`cat-file`, `reset --hard`)은 `git(dir, ...args)`로 바꾼다. 두 테스트는 이 도우미를 쓰게 고치되 확인하는 내용은 바꾸지 않는다. `makeRepo`는 `git -c core.autocrlf=false init`으로 만들고(Windows의 줄 끝 변환이 diff를 흔들지 않게), 커밋 둘과 `refs/remotes/origin/main`을 만든다. `GIT_CEILING_DIRECTORIES`를 임시 폴더의 부모로 주어 git이 바깥 저장소로 올라가지 않게 한다. 임시 폴더 경로는 `fs.realpathSync.native`로 편 뒤 넣는다(Windows의 짧은 경로 이름에서 이 설정이 듣지 않는 것을 피한다).
- **가짜 `pnpm`.** 임시 폴더의 `bin/`에 `pnpm.cmd`(Windows)와 `pnpm`(그 밖)을 쓰고 `runWf`가 `PATH` 앞에 그 폴더를 붙인다. 가짜는 `exec tsc …`와 `exec biome …`에는 성공으로 끝나고, `exec vitest run … --outputFile=<경로>`에는 「실패 0건」인 최소 결과 파일을 쓰고 성공으로 끝난다. 변수 `WF_SHIM_FAIL=vitest`를 주면 실패 결과와 실패 코드를 낸다. 이 변수는 가짜 `pnpm`만 읽고 `workflow.mjs`와 `verify.mjs`는 읽지 않으므로, §2.2에서 기각한 「환경변수로 검사 실행기를 바꿔 끼우는 장치」가 아니다. 가짜가 없으면 개발 도구가 없는 임시 폴더에서 `pass`가 통합 검사를 띄우다 죽는다.
- **옛 형식 상태 파일 견본 하나.** `tests/fixtures/workflow-state/user-verification-legacy.json`에 2026-09-30 main에 있던 실제 상태 파일을 둔다(3D 슬라이스의 `user-verification`, 통과 표시 넷이 참, 새 키 없음). 새 `workflow.mjs`의 `status`가 이 파일을 읽어 적용 판정 표를 내는지, `approvePrDecision`이 판정을 내는지 고정한다(W3). 새 키를 읽는 나머지 자리는 W2의 단위 테스트가 새 키가 없는 상태 객체로 고정한다.
- **프로세스를 띄우는 코드를 `tests/helpers/`로 모은다.** `tests/logic/`에서 지금 `node:child_process`를 직접 쓰는 파일은 셋이다. `ClaudeMdSplit.test.ts`와 `DocsHygiene.test.ts`는 위 `WfSandbox.ts`로 옮기면서 풀린다. `EolPolicy.test.ts`는 git을 띄우는 부분을 `tests/helpers/`의 도우미로 옮긴다. 그 뒤 W1의 테스트(「`tests/logic/` 아래 파일은 `node:child_process`를 import하지 않는다」)가 이 상태를 지킨다.
- **피처 테스트 파일.** `tests/logic/WorkflowDiet.test.ts`다(`ready-impl`이 피처 이름을 PascalCase로 바꿔 찾는다). W1~W3의 새 테스트를 여기에 두고, 기존 테스트 파일의 확인을 바꾸는 것은 그 파일에서 한다.

### W6. 절차 문서 · `CLAUDE.md` · 그 밖의 문서

**배달되는 절차 문서의 글자 수를 늘리지 않는다.** `pnpm wf` 전이가 출력하는 절차 문서 여섯의 합계가 지금 13,575자다. `ClaudeMdSplit.test.ts`에 이 합계가 상한을 넘지 않는지 확인하는 테스트를 하나 더한다. 상한은 구현을 시작할 때의 합계로 둔다(지금 13,575자, PR #94가 먼저 머지되면 13,560자). 곧 이 슬라이스가 한 글자도 늘리지 않는다는 조건이다. 이 테스트가 F95를 닫는다. 이 상한은 이 슬라이스 뒤에도 지킨다. 나중에 넘겨야 하면 같은 PR에서 덜어 낼 문장을 먼저 찾고, 그래도 안 되면 그 슬라이스의 계획 문서에 이유를 적고 상한을 올린다. 이 규칙을 테스트의 상수 위 주석에 적는다.

바꿀 문구를 실제로 써서 쟀다(2026-10-05). 합계가 11자 준다. 구현할 때 문구가 달라지면 다시 잰다.

| 문서 | 지금 | 뒤 | 무엇을 더하고 무엇을 덜어 내나 |
|---|---:|---:|---|
| `workflow/verification.md` | 3,530 | 3,439 | 덜어 냄: 「게이트 2 — 타입」 절과 「게이트 3 — 린트」 절 전체, 「ADR 002·006·007이 그렇게 정본 자리에 섰다」 문장, 「코드가 정본이고 QA 문서가 그 거울이다」 구절, 「마무리」 절의 「다 차면 `user-verification`으로 넘어간다」 문장(첫머리가 이미 말한다). 더함: 첫머리를 「통합 검사는 이미 통과했고 남은 것은 통과 표시를 남기는 판단 검사 둘」로 다시 쓴다(§0은 판단 검사를 넷으로 정의하므로 수를 맞춘다). 적용 판정은 `pnpm wf status`로 본다는 문장. 코드를 고친 뒤의 `/cso`는 바뀐 부분만 본다는 문장. 게임 코드가 `/cso` 대상이 아닌 이유와 「결제·연동 코드가 들어오면 `CSO_PATHS`에 더한다」는 조건. 코드 리뷰에 「diff에 API 키·비밀값이 없는지도 보게 한다」. 「새 문서로 가는 링크는 그 문서를 `git add`한 뒤에야 링크 검사를 통과한다」. `logic-only` 범위 설명은 「마무리」 절로 옮겨 「게임 코드를 바꾼 슬라이스」로 좁힌다 |
| `workflow/qa-setup.md` | 2,702 | 2,799 | 더함: 「계획이 `game/**`를 건드리지 않으면 씬/프리팹·에디터 연결 섹션은 쓰지 않는다. 그런 슬라이스는 `skip-qa`로 문서 자체를 생략할 수 있고, 손으로 볼 것은 계획 문서에 적는다. 생략은 `game/**` 변경이 없는 동안만 유효하고, 나중에 건드리면 `pass`가 이 문서를 요구한다」 한 문단. 나가는 조건에 「생략이 유효하면 없어도 된다」. 덜어 냄: 2026-08-08 사례를 날짜와 파일명 없이 한 문장(「완료 항목을 나중에 되돌리면 그 슬라이스가 실제로 수행하고 검증했다는 기록이 사라진다」)으로 줄인다 |
| `workflow/implementation.md` | 1,049 | 1,059 | 나가는 조건을 「통합 검사(타입·biome·전체 테스트)를 돌려 전부 통과할 때만」으로 고친다 |
| `workflow/user-verification.md` | 3,334 | 3,307 | 더함: 나가는 조건의 `.meta` 검사에 「에셋 변경이 있으면」. 사용자에게 알리는 문장에 「QA 문서를 생략했으면 계획 문서의 손 확인 목록」. 덜어 냄: 2026-08-06의 토큰 수치 문장 |
| `workflow/planning.md` · `workflow/pr-ready.md` | 2,960 | 2,960 | `planning.md`는 「`start-verification`의 GREEN 게이트」를 「통합 검사 게이트」로 한 곳만 고친다(글자 수 같음). `pr-ready.md`는 고치지 않는다 |
| **합계** | **13,575** | **13,564** | |

덜어 내는 두 사례 문장은 정본 본문에 날짜가 든 경위를 적어 둔 자리다. 정본 본문에는 지금만 적는다는 규칙(2026-09-29)을 이번에 건드리는 문서에 적용한 것이다. 규칙이 왜 있는지(어기면 무엇이 잘못되는지)는 한 문장으로 남긴다.

`workflow/README.md`(배달되지 않는다)는 표의 `verification` 행을 「(적용 시 보안 점검) · 커밋 · 코드 리뷰 / `pass cso`·`pass review`」로 고친다.

**`CLAUDE.md`.** 바꿀 문자열을 실제로 써서 쟀다(2026-10-05). 아래 열 군데를 바꾸면 순변화가 −17자다. 구현할 때 문구가 달라지면 다시 재고, 합계가 늘지 않게 맞춘다. 지금 있는 테스트는 합계가 38,000자 이하인지만 보므로, 「늘지 않았다」는 이 표를 구현한 문구로 다시 재서 손으로 확인한다.

| 자리 | 바꾸는 내용 | 순변화 |
|---|---|---:|
| 명령 표 `start-verification` 행 | 「전체 스위트 GREEN 검증 후 전환」을 「통합 검사: 타입·biome·전체 테스트 통과 후 전환」으로. 아래에 `verify` 행(「통합 검사만 다시 실행 (전이 없음)」)을 더한다 | +59 |
| 명령 표 `pass` 행 | `pass <cso\|review>`로 줄이고 설명을 「판단 검증 통과 표시(`cso`는 적용될 때만). 다 차면 QA 확정 게이트 · 정본 선언 게이트 · 통합 검사를 지나 자동 `user-verification`」으로 | −31 |
| 명령 표 `skip-test` 행 아래 | `skip-qa "<사유>"` 행(「QA 문서 생략 (`game/**` 변경이 없는 동안만 유효)」)을 더한다 | +71 |
| 명령 표 `approve-pr` 행 | 괄호 안을 「변경 집합에 걸릴 때만 에셋 `.meta` 게이트 · 타입체크 범위 게이트」로 | −5 |
| 명령 표 `status` 행 | 「현재 phase 절차 문서 경로」를 「적용 게이트 + 절차 문서 경로」로 | 0 |
| 명령 표 `check-links` 행 | 끝에 「통합 검사에 들어 있다」를 더한다. 링크 검사는 전체 테스트 안의 `DocLinks.test.ts`가 하므로 통합 검사가 돌 때마다 함께 돈다. 단독으로 칠 일이 드물다는 것을 표에서 알게 한다 | +14 |
| `pnpm typecheck` 각주 | 「타입체크 단독 실행. 통합 검사가 같은 코드를 부른다.」로 줄인다 | −61 |
| 9단계 뼈대 5번 | 「GREEN 게이트」를 「통합 검사 게이트」로 | 0 |
| 9단계 뼈대 6번 | 가운데 두 줄을 「→ 기능 단위 커밋 → (적용 시 /cso → pass cso) → 코드리뷰 → pass review」 한 줄로, 마지막 줄을 「코드 수정이 끼면 invalidate로 정본 선언부터 다시」로 | −72 |
| 「에셋 `.meta` 관리 규칙」의 「게이트:」 문단 | 앞에 「에셋 변경이 있으면」을 넣는다 | +8 |

**그 밖의 문서.**
- `docs/development/troubleshooting/wf-tool-recovery.md`(새 문서) — 「`pnpm wf`가 깨졌을 때」를 적는다. 첫째, `workflow.mjs`와 훅은 phase와 상관없이 고칠 수 있으므로 `wf start` 없이 git으로 브랜치를 만들어 고친다. 이 길에서는 도구가 검사를 요구하지 않으므로 손으로 한다. 전체 테스트와 타입 검사, 바뀐 부분에 대한 `/cso`, 서브에이전트 코드 리뷰를 하고 PR 본문에 결과를 적는다. 둘째, 진행 중인 슬라이스의 전이가 급하면 깨지기 전 커밋을 임시 worktree로 꺼내(`git worktree add <임시 폴더> <커밋>`) 그 안의 `workflow.mjs`를 `CLAUDE_PROJECT_DIR=<작업 폴더> node <임시 폴더>/.claude/workflow.mjs <명령>`으로 쓴다. 둘째 길은 사람 확인창을 거치지 않으므로 사용자가 직접 지시할 때만 쓴다고 적는다.
- `docs/development/troubleshooting/typescript-version-pin.md` — 표의 `pnpm wf pass ts`를 `pnpm wf verify`로, 「`approve-pr`이 그 범위를 거부한다」를 「게임 코드를 바꾼 슬라이스면 `approve-pr`이 그 범위를 거부한다」로 고친다.
- `docs/development/troubleshooting/workflow-state-cross-machine.md` — 「정책 확정 시 ADR 004에 절을 추가한다」를 `workflow/README.md`에 적는 것으로 고친다. 상태 파일 충돌을 푸는 명령을 넣는다. 리베이스 중이면 `git checkout --theirs -- .claude/workflow-state.json`, 머지 중이면 `--ours`다. 푼 뒤 `pnpm wf status`로 슬라이스 이름과 phase가 자기 것인지 확인한다. 틀린 쪽을 고르면 진행 중인 슬라이스의 상태가 main에 있던 다른 슬라이스의 상태로 바뀐다(2026-09-30에 실제로 충돌을 겪었다).
- `docs/development/spec/docs-references.md` §12 표의 `wf check-links` 두 행은 검사기의 위치를 말하는 것이라 그대로 둔다.

### W7. 백로그

- **F78** — 닫고 `backlog-docs.md`의 완료 아카이브로 옮긴다.
- **F95** — W6의 글자 수 테스트로 닫고 아카이브로 옮긴다. 행에 적힌 옛 수치(14,907자)는 아카이브 한 줄에 지금 값으로 적는다.
- **F96** — 닫지 않는다. 행의 수치(37,857자, 여유 143자)를 머지 시점 값으로 고친다. 그 행이 요구하는 「덜어 낼 후보 절」도 적는다(2026-10-05에 `CLAUDE.md`를 공식 문서의 권고에 대 본 결과다). gbrain 검색 안내 문단은 `ops-gbrain.md`로 옮기고 한 줄만 남길 수 있다. 「에셋 `.meta` 관리 규칙」의 시점 표는 절차 문서 둘(`implementation.md`·`user-verification.md`)이 이미 든다. ADR 안내는 두 번 나오는데 F75가 그 줄들을 다시 쓴다. `wf` 명령 표와 9단계 뼈대도 후보지만, 배달만으로 절차가 지켜지는지를 보는 F71이 닫힌 뒤에 줄인다. 이 슬라이스는 후보를 적기만 하고 줄이지 않는다. 같은 명령 표를 이 슬라이스가 고치고 있어서, 함께 줄이면 머지 뒤에 AI가 절차를 빠뜨렸을 때 어느 변경 때문인지 가를 수 없다.
- **F10** — 닫지 않는다. 행에 셋을 더한다. 이 슬라이스는 추적 방식을 바꾸지 않았다. 2026-09-30 리베이스에서 상태 파일이 실제로 충돌했다. 머지된 슬라이스의 `user-verification` 상태가 main에 남았다. 「ADR 004에 반영」은 「`workflow/README.md`에 반영」으로 고친다. 장비를 옮길 때 상태를 넘기는 방법도 이 항목이 함께 정한다.
- **F71** — 닫지 않는다. 이 슬라이스가 절차 문서 다섯을 고쳤다는 한 줄을 더한다.
- **새 항목 일곱(F118부터, `origin/main`의 마지막 번호를 확인하고 딴다).** 2단계와 무관한 일은 2단계 항목에 얹지 않고 따로 만든다. 2단계를 열지 않기로 하면 그 항목이 닫히면서 함께 사라지기 때문이다.
  - 새로 받은 저장소나 worktree에는 Cocos가 만드는 `game/temp/tsconfig.cocos.json`이 없어서 vitest가 대부분의 테스트 파일을 불러오지 못한다. 이 슬라이스는 통합 검사가 그 실패를 알아보고 처방을 찍는 데까지만 한다. `backlog-implement.md`.
  - 2단계 슬라이스. §6의 약속 넷과 갈지 정하는 기준, 재측정 결과를 적는 자리다. `backlog-implement.md`.
  - 1단계가 막지 못하는 경우 둘(§6). 2단계가 열리면 거기서 닫고, 열리지 않으면 이 항목으로 남는다. `backlog-implement.md`.
  - 배달되는 절차 문서를 10,000자 이하로 줄인다. `backlog-docs.md`.
  - `approve-plan`이 계획 문서를 파일 이름으로만 찾는다. `backlog-implement.md`.
  - 커밋 훅에 비밀값 검사를 더한다. `/cso`를 받지 않는 슬라이스에서는 코드 리뷰만 비밀값을 본다. `backlog-implement.md`.
  - `wf start`가 진행 중인 슬라이스도 초기화한다. 지금은 사람 확인창이 막고 있다. `backlog-implement.md`.
- 옛 계획이 만들려던 항목 가운데 「`engines.node` 명시」와 「상태 핸드오프 수단」은 따로 만들지 않는다. 앞의 것은 기각한 안에만 걸리고, 뒤의 것은 F10에 들어간다.

## 6. 2단계 — 약속 넷

2단계는 1단계를 머지하고 실제로 써 본 뒤 새 슬라이스로 연다. 지금 정하는 것은 넷뿐이다. 값의 이름, 출력 모양, 파일 배치는 2단계를 열 때 정한다.

1. 검사를 통과시킬 때, 그때 검사한 파일 목록과 내용을 통과 표시와 함께 기록한다. 대상은 통과한 뒤 코드가 바뀌면 다시 해야 하는 판단 넷(코드 리뷰, 보안 점검, 정본 갱신 확인, QA 확정)이다.
2. `user-verification`으로 넘어갈 때와 `approve-pr` 때, 그 기록과 지금 파일이 같은지 비교한다. 다르면 해당 검사를 다시 하게 한다. Cocos 에디터가 만든 `.meta`처럼 판단 대상이 아닌 파일은 비교에서 뺀다. 게임 슬라이스는 규칙대로 `PR 승인` 직전에 `.meta`를 커밋하므로, 빼지 않으면 매번 달라진다. `user-verification`에 들어온 뒤 절차가 시키는 문서 정리(세션 문서, 백로그 행, 참조 고치기)와 상태 파일도 같은 이유로 뺀다. 사용자가 그 단계에서 에디터로 만들거나 고친 씬·프리팹도 뺀다. 사용자가 인게임에서 직접 확인한 것이기 때문이다. 무엇을 빼는지의 정확한 목록은 2단계를 열 때 정한다. `approve-pr`에서 다르다고 나왔을 때 돌아가는 길은 지금 있는 `rework`다. 새 길을 만들지 않는다.
3. 계획이 적은 범위 밖의 파일이 나타나도 막지 않고 검사만 자동으로 더한다. 사람이 확인하는 지점을 새로 만들지 않는다.
4. 1단계를 실제로 써 보고 잰 뒤에 2단계를 갈지 정한다.

**2단계를 갈지 정하는 기준.** 1단계를 머지한 뒤 슬라이스 둘을 본다. 그 가운데 하나는 게임 슬라이스로 한다. 저장소 밖 일회성 스크립트나 세션 기록을 손으로 세어 잰다. 결과는 2단계 백로그 항목에 적는다.

| 재는 것 | 뜻 | 기대 |
|---|---|---|
| 검증 중에 AI가 통합 검사 말고 따로 친 기계 검사 명령 수 | 1단계가 뜻대로 도는가 | 0 |
| `check-links`를 단독으로 친 횟수 | 단독 실행이 줄었는가 | 1 + `user-verification`에 들어온 횟수 이하 |
| 코드를 고친 뒤 다시 한 판단 검사 가운데, 그 검사가 보는 파일이 바뀌지 않았던 것의 수 | 2단계가 줄일 수 있는 양 | 2단계의 근거 |
| phase가 `user-verification`인 동안 고친 코드·도구 파일의 수 | 2단계가 막으려는 것 | 2단계의 근거 |

- 첫째 값이 세는 것은 `pnpm typecheck`·`pnpm check`·`pnpm exec vitest run`처럼 통합 검사가 이미 하는 일을 따로 친 것이다. 통합 검사가 실패해서 고치고 다시 친 `start-verification`과, 결과만 보려고 친 `verify`는 도구가 뜻대로 돈 것이라 세지 않는다.
- 둘째 값의 기대는 단독 실행이 필요한 때를 센 것이다. 계획 문서를 쓴 직후 한 번, 그리고 `user-verification`에 들어올 때마다 문서를 정리한 직후 한 번이다. 리워크가 있으면 들어온 횟수만큼 는다. 그 밖에는 통합 검사가 돌 때 전체 테스트 안의 링크 검사가 함께 돈다. 1단계에서 달라지는 것은 둘이다. `CLAUDE.md` 명령 표가 「통합 검사에 들어 있다」고 알려 주고, 검증 중에는 `verify`와 `pass review`가 링크 검사까지 다시 돌린다. 기준선은 2026-08-18 이후 누적 137회(요구사항 문서 §3.1)를 그 기간의 슬라이스 수로 나눈 슬라이스당 평균으로 적는다(계획 승인 뒤 센다).
- 첫째와 둘째 값은 1단계가 뜻대로 도는지를 본다. 기대를 벗어나면 1단계의 결함으로 보고 백로그 항목을 만든다. 2단계를 여는 조건에는 쓰지 않는다.
- 셋째 값은 다시 한 검사 가운데 헛일이었던 것을 센다. 예를 들어 정본 문서가 그대로인데 정본 갱신을 다시 선언했거나, 문서만 고쳤는데 코드 리뷰를 다시 받은 경우다. 코드를 고칠 때마다 도구가 판단 검사를 전부 다시 시키므로, 다시 한 횟수만 세면 「코드를 고친 적이 있다」와 같은 말이 된다. 보안 점검은 세지 않는다. 1단계가 이미 바뀐 부분만 다시 보게 했기 때문이다.
- 넷째 값은 phase가 `user-verification`인 동안 리워크 없이 고쳐 커밋한 코드·도구 파일만 센다. 세지 않는 것은 넷이다. `.meta`, 상태 파일, 절차가 시킨 문서 정리(`docs/**`), 사용자가 에디터로 만들거나 고친 씬·프리팹·에셋이다. 앞의 셋은 절차대로 하면 늘 생기고, 마지막은 사용자가 인게임에서 직접 확인한 것이다. 리워크로 돌아가 구현·검증 단계에서 한 커밋도 세지 않는다. 그 커밋은 검사를 다시 받는다.

2단계를 여는 조건은 둘 가운데 하나다. 넷째 값이 한 번이라도 0보다 크다. 또는 셋째 값이 두 슬라이스 모두에서 0보다 크다. 둘 다 아니면 2단계를 열지 않고 2단계 백로그 항목을 닫는다. 셋째 값은 코드 수정이 한 번이라도 있으면 보통 1 이상이다(`invalidate`가 정본 선언을 비우므로). 그래서 이 조건은 사실상 『리뷰 뒤 코드 수정이 두 슬라이스에서 있었는가』를 묻는다.

**1단계가 막지 못하는 경우 둘.** 둘 다 지금도 그렇고, 약속 1·2가 막는다. 2단계가 열리지 않아도 잊히지 않게 W7에서 백로그 항목 하나에 둘을 적는다.

- `user-verification`에서 고친 파일은 검사 없이 `approve-pr`을 지난다. 타입 검사만 `approve-pr`이 다시 돌린다.
- `verification`에서 `/cso`나 리뷰를 통과한 뒤 코드를 고치고 `invalidate`를 치지 않으면, 고치기 전 코드로 받은 통과 표시가 그대로 남는다. 통합 검사는 넘기기 직전에 다시 돌지만 판단 검사는 다시 하지 않는다. 이 경우는 세션 기록만으로 세기 어려워서 위 기준에서는 세지 않는다.

## 7. 자동 검증과 손 확인

- **실패하는 테스트부터.** `tests/logic/WorkflowDiet.test.ts`를 먼저 써서 `ready-impl`의 「테스트가 실제로 실패하는가」 조건을 지난다.
- **통과.** 이 브랜치의 새 `start-verification`이 통합 검사를 돌린다. 기준선은 48개 파일, 1,114개 통과(1개 스킵)다(2026-09-30).
- **이 슬라이스의 QA 문서.** `docs/qa/workflow-diet-test.md`를 쓴다. `qa-setup`에 들어갈 때 출력되는 절차 문서가 아직 옛 틀이므로 옛 틀대로 씬·에디터 절을 「없다」로 채운다. `skip-qa`는 이 슬라이스가 만드는 것이라 이 슬라이스에는 쓰지 않는다.
- **통합 검사가 진짜 실패를 실패로 읽는지 손으로 확인한다(구현 단계, 첫 `start-verification` 전).** 테스트는 실패를 시험용 실행기와 가짜 `pnpm`으로만 만든다. 그 실패 모양은 짐작한 것이라, 진짜 biome 요약이나 vitest 결과 파일의 실패 모양과 다르면 테스트는 통과하는데 도구는 실패를 통과로 읽는다. 그리고 이 슬라이스의 검증은 전부 통과하는 길만 지나서 거기서도 드러나지 않는다. 그래서 타입 오류 하나, 린트 위반 하나, 실패하는 테스트 하나를 차례로 일부러 넣고, 그때마다 `start-verification`이 넘어가지 않으며 어느 검사가 실패했는지 찍는 것을 확인한 뒤 되돌린다. 결과를 QA 문서에 적는다. 이 확인에서 친 명령은 §12의 명령 수에서 세지 않는다.
- **손 확인(검증 단계, `pass review` 전).** `pass`는 `verification`에서만 받으므로 여기서 한다(`verify`는 `user-verification`에서도 돈다).
  - 이 브랜치에서 `pnpm wf status`가 `meta: 해당 없음`, `fullTypecheck: 해당 없음`, `cso: 적용`을 보인다.
  - `pnpm wf pass ts`가 안내와 함께 실패한다.
  - `pnpm wf verify`가 검사마다 한 줄을 낸다.
- **머지 뒤 손 확인.** 원래 폴더에서 main을 받은 뒤 `pnpm wf status`가 돌고, 다음 슬라이스의 `pnpm wf start`가 돈다. `wf start`가 새 도구에서 도는 것은 머지 전에 기존 테스트가 임시 저장소에서 실제 프로세스로 이미 확인한다. 머지 뒤에 깨져 있으면 W6의 복구 문서대로 한다.

## 8. 정본 선언

`pnpm wf canon-done`으로 선언할 경로는 W6의 표에 있는 절차 문서 다섯(`planning.md` 포함), `workflow/README.md`, `CLAUDE.md`다. 새 정본은 만들지 않는다. 새 트러블슈팅 문서는 정본이 아니라 복구 절차다.

## 9. 최종 PR에서 정리할 것

- `docs/etc/`의 설계 초안과 이 계획 초안을 지운다. 내용은 `docs/development/sessions/`의 계획 문서가 이어받는다.
- 상태 파일은 지금 관행대로 마지막 상태를 커밋한다(§2.1).
- 새 `.meta`가 0개인지 본다. 하나라도 있으면 `.meta` 해당 없음 판정이 틀린 것이다.
- §4의 메모리 목록을 머지할 때 고친다.

## 10. 구현하면서 재야 하는 것

- **W4에서 옮길 코드를 타입 검사에 넣는 비용.** 함수 하나를 먼저 옮겨 고칠 양을 잰다.
- **글자 수.** W6의 두 표는 초안 문구로 잰 값이다. 구현한 문구로 다시 잰다.
- **통합 검사 한 번의 시간.** 지금 재면 vitest 약 3.6초, 타입 검사 약 2.7초, biome 약 0.5초로 합쳐 약 7초다(2026-09-30).

## 11. 열린 질문

1. **`FULL_TYPECHECK_PATHS`의 `game/settings/**`.** 엔진 모듈 설정이 Cocos가 만드는 타입 선언을 바꿀 수 있다고 보고 넣었다. 실제로 그런지는 확인하지 않았다. 구현하면서 Cocos 공식 문서로 확인하고, 아니면 뺀다. 넣어 둔 채로 틀려도 검사가 더 걸릴 뿐이다. 빼면 W1의 대표 변경 집합 표 여섯째 줄의 `fullTypecheck` 기대값을 「해당 없음」으로 고치고 테스트도 함께 고친다. 그 줄의 QA 문서 「필요」는 그대로다.

## 12. 통과 조건

테스트가 지키는 것은 각 작업 묶음의 「테스트」에 적었다. 여기에는 사람이 보거나 머지 뒤에 재는 것만 둔다.

- 전체 테스트가 새 통합 검사로 통과한다.
- 이 슬라이스의 검증에서 AI가 통합 검사 말고 따로 친 기계 검사 명령이 없다. 지금은 넷을 따로 친다(`pnpm typecheck`·`pass ts`·`pnpm check --write`·`pass lint`).
- §7의 손 확인(일부러 넣은 실패 셋, 검증 단계의 셋, 머지 뒤)이 통과한다.
- 새 `.meta`가 0개다.
- 머지 뒤 §6의 기준대로 슬라이스 둘을 재서 2단계 백로그 항목에 적는다.

<!-- autoplan-accepted:ceo -->
- 통합 검사(`runVerify`)는 검사마다 요약 한 줄에 걸린 시간을 밀리초로 함께 찍는다(예: `typecheck: 통과 (2,713ms)`). 세 검사의 합계도 마지막 줄에 찍는다. 시간은 `runVerify`가 실행기 호출 전후로 재서 결과 객체에 `durationMs`로 더한다 — 실행기의 반환 모양 `{status, scope?, summary, details}`는 그대로다. 시험용 실행기로 돌리는 `runVerify` 단위 테스트가 요약 줄에 시간 필드가 있는지 확인한다.
- vitest의 요약 줄은 결과 파일에서 읽은 수를 든다: 「vitest: 통과 · 파일 n개 · 통과 a · 실패 b · 스킵 c (N ms)」. QA 문서의 「피처 테스트 N/N, 전체 스위트 M/M」은 이 줄에서 옮겨 적고, 그 수를 보려고 `pnpm exec vitest run`을 따로 치지 않는다. 시험용 실행기 단위 테스트가 네 수를 확인한다.
- 세 실행기의 명령줄을 정한다. 타입 검사: `pnpm exec tsc -p <프로젝트> --noEmit`(지금 `typecheck.mjs`와 같다). biome: `pnpm exec biome check --reporter=summary [--write] .`. vitest: `pnpm exec vitest run --reporter=json --outputFile=<임시 파일>`. 다시 돌려 볼 명령으로 안내하는 것은 `pnpm typecheck`·`pnpm check`·`pnpm exec vitest run`이지만 통합 검사가 띄우는 것은 위 셋이고, W5의 가짜 `pnpm`은 `exec tsc`·`exec biome`·`exec vitest run`으로 알아본다.
- 실행기를 찾지 못한 경우의 판정: `shell: true`로 띄우면 `pnpm`이 없어도 `spawnSync`의 `error`는 비고 `status`만 9009(`cmd.exe`) 또는 127(`sh`)로 온다. 그래서 「`error`가 있거나, `status`가 9009·127이고 출력이 비면」 실행기를 찾지 못한 것으로 보고 「실행기 `<이름>`을 실행할 수 없다(`pnpm` 경로 확인)」를 찍는다. 시험용 실행기 단위 테스트에 이 갈래를 둔다.
- W6 `verification.md` 표에 더한다: 「`pnpm wf invalidate`로 전부 되돌리고 보안 검사부터 다시 돈다」와 같은 말을 하는 문장 셋(지금 5·34·62행)을 「(적용 시) 보안 검사부터」로 고친다. `planning.md` 33행의 「`start-verification`의 GREEN 게이트」는 「통합 검사 게이트」로 고친다(글자 수 같음, `planning.md` 행의 「고치지 않는다」를 「이 한 곳만」으로). 두 변경 뒤 절차 문서 합계를 다시 재서 상한을 넘지 않는지 확인한다.
- `pass`가 QA 문서를 판정할 때 `qaRequired`가 참이면 QA 문서 파일이 있어야 한다. `verify`는 QA 문서를 보지 않는다(통합 검사를 돌려 기록용 값 셋만 적는 명령이다). 파일이 없을 때의 안내는 둘로 가른다: `qa_skip_reason`이 있으면 「생략 사유가 더는 맞지 않는다: <걸린 파일> — QA 문서가 필요하다: <경로>」, 없으면(문서를 지웠거나 옛 상태 파일) 「QA 문서가 없다: <경로>」. `qaDocClean`의 「파일이 없으면 통과」는 `qaRequired`가 참인 자리에는 적용하지 않는다(그 규칙은 `ready-impl`이 존재를 강제하던 때의 것이다). 테스트: `skip-qa` 뒤 `game/**` 변경이 생기면 QA 문서 없이는 `pass review`가 넘어가지 않는다(W5의 임시 저장소에서 실제 프로세스로).
- `decideTransition`은 `qaClean`을 미리 받지 않는다. 통과 표시 둘이 통과했고 `qaRequired`가 참인데 `qaClean`이 없으면 `needsQa: true`를 돌려주고, 그러면 `workflow.mjs`가 그때 `qaDocClean`(vitest를 띄운다)을 구해 다시 부른다 — `verifyResult`와 같은 모양이다. 그래서 부분 `pass`나 통과 표시가 덜 찬 `pass`에서는 vitest가 돌지 않는다(지금 동작과 같다). 단위 테스트: 통과 표시가 덜 찼을 때 `needsQa`가 거짓, 다 찼고 QA가 필요하면 참.
- W5의 임시 저장소(`makeRepo(opts)`)의 모양을 정한다. 임시 루트 아래에 `repo/`(git 저장소)와 `bin/`(가짜 `pnpm`)을 형제로 둔다 — 가짜가 저장소 안에 있으면 `*.cmd`가 `CSO_PATHS`에 걸려 모든 임시 저장소에 `/cso`가 적용된다. 커밋은 셋이다. `c1`: 빈 README 하나. `c2`(기준 커밋): 절차 문서 stub(`docs/development/workflow/*.md`와 README)·계획 문서·QA 문서(옵션으로 뺄 수 있다)·`tests/logic/DocsHygiene.test.ts` 자리의 빈 stub(가짜 vitest가 성공으로 끝내므로 내용은 상관없다. `qaDocClean`의 판정 파일 존재 검사를 지나기 위한 것이다)·`.claude/workflow-state.json` — 미커밋 새 파일이 남지 않게 한다. `c3`: 상태 파일을 phase에 맞게 고친 커밋. 브랜치는 `main` = `c2`, `refs/remotes/origin/main` = `c2`, `feat/stale` = `c1`(`DocsHygiene.test.ts`의 「`origin/main`보다 1커밋 뒤」가 그대로 나온다), `feat/<feature>` = `c3`이고 `HEAD`는 `feat/<feature>`에 선다. `main`이 있어야 `wf start`(`git switch -c … main`)가 돈다. 옵션: `phase`·`state`(상태 파일 내용, `makeSandbox`의 옵션을 받는다), `qaDoc: false`(QA 문서를 안 만든다), `gameChange: true`(`c3`에 `game/assets/scripts/x.ts` 하나를 더해 `game/**` 변경을 만든다), `csoApplicable: true`(`c3`에 `.claude/wf-sandbox.mjs`를 더한다), `checkout: 'main'`(`HEAD`를 `main`에 둔다 — `DocsHygiene.test.ts`의 「로컬 main이 뒤처졌으면」이 `main`에서 `reset --hard HEAD~1`을 하므로), `git: false`(git 저장소를 만들지 않는다 — 아래). E3의 `status` 테스트와 「`/cso` 해당 없음일 때 `pass cso`를 받지 않는다」는 `csoApplicable`을 각각 켜고 끈 저장소로 돈다. 변경 집합 테스트의 기준은 `c2`다.
- `makeRepo({ git: false })`는 git 저장소 없이 폴더만 꾸민다(지금 `ClaudeMdSplit.test.ts`의 `makeSandbox`가 하는 일). 그 폴더에서는 변경 집합을 구할 수 없어 모든 검사가 적용되고, 통합 검사는 가짜 `pnpm`으로 통과하며, `pass cso`는 `HEAD`를 읽지 못해 `cso_commit`을 적지 않는다. `ClaudeMdSplit.test.ts`의 샌드박스 테스트 약 40개 가운데 변경 집합·`cso_commit`을 보지 않는 것은 이 길을 쓴다 — 전부 git 저장소로 만들면 Windows에서 스위트가 수 초 늘어 §10의 「통합 검사 한 번의 시간」이 흔들린다. 구현 뒤 §10에서 스위트 시간을 다시 잰다.
- 가짜 `pnpm`의 모양: `bin/pnpm.cmd`(Windows)는 `node "%~dp0fake-pnpm.mjs" %*` 한 줄, `bin/pnpm`(그 밖)은 같은 파일을 부르는 셸 스크립트 한 줄이고, 인자 해석과 `WF_SHIM_FAIL`은 `bin/fake-pnpm.mjs` 한 곳에 둔다 — `cmd` 배치는 `=`를 인자 구분자로 잘라 `--outputFile=<경로>`가 두 토막 나기 때문이다. `--outputFile`이 없는 `exec vitest run …` 호출(`qaDocClean`의 호출이 이 모양이다)에는 항상 0으로 끝낸다. `WF_SHIM_FAIL=vitest`는 `--outputFile`이 있는 호출(통합 검사)에만 듣는다. 그래야 「`pass review`가 넘기기 직전 검사에서 실패하면 넘어가지 않는다」가 QA 단계가 아니라 통합 검사에서 막히는 것을 확인한다.
- QA 판정표 넷째 줄(사유 있음 + 변경 집합을 구할 수 없음)에서 `pass`·`ready-impl`이 찍는 문장: 「변경 집합을 구할 수 없어 QA 문서가 필요하다: <경로> — <W1의 원인별 처방>」. 테스트: `origin/main`이 없는 임시 저장소에서 이 문장.
- `start-verification`의 실패 안내는 「절차: `pnpm wf steps implementation`」으로 끝낸다(실패하면 phase가 아직 `implementation`이고 나가는 조건이 그 문서에 있다). `verify`·`pass`는 「절차: `pnpm wf steps verification`」 그대로다.
- `approvePrDecision`은 `tsStatus !== 0`이면 적용 판정과 상관없이 막는다(지금 `approve-pr`과 같다). 테스트에 이 갈래를 더해 다섯 갈래로 한다.
- 통합 검사 실패 상세의 출처: vitest는 결과 파일의 `testResults[].assertionResults[].failureMessages`와 수집 단계 오류가 드는 `testResults[].message`에서 뽑고, 결과 파일이 없으면 stderr를 쓴다(`tsconfig.cocos.json` 안내는 그 둘 어디에 보여도 붙인다). 타입 검사와 biome은 표준 출력·오류를 그대로 40줄까지다.
- `invalidate`와 `rework`는 기록용 값 셋(`ts_check_clean`·`lint_clean`·`ts_check_scope`)을 비우지 않고 남긴다 — 마지막 통합 검사의 결과라 `status`가 그대로 보여 주고, `CHECKS`에서 `ts`·`lint`를 빼면 `resetVerification`이 저절로 건드리지 않는다. 옛 도구 복구 경로에서 이 값이 참으로 남아 있어도 `cso_done`·`code_review_clean`이 거짓이라 옛 도구도 넘어가지 않는다. 테스트: `invalidate` 뒤 셋이 그대로인지.
- `runTypecheck({ capture: true })`는 진행 줄(「▶ 타입체크 1/2」)과 `⚠` 안내를 화면에 찍지 않고 tsc 출력만 `details`로 돌려준다. `pnpm typecheck` 단독 실행(capture 없음)은 지금처럼 바로 찍는다.
- W6 `verification.md` 표의 글자 수: 「(적용 시)」 셋을 더하면 합계가 상한 13,575자를 넘으므로 지금 덜어 낼 문장을 정한다 — 34행의 「`pnpm wf invalidate`로 전체 검증을 초기화해 여기서부터 다시 시작한다」는 5행이 이미 말하므로 「`pnpm wf invalidate`를 친다」로 줄이고, 62행의 「고쳤으면 `pnpm wf invalidate`로 되돌려 보안 검사부터 다시 돈다」는 「고쳤으면 `pnpm wf invalidate`(위와 같다)」로 줄인다. 구현한 문구로 다시 재서 합계가 13,575자 이하인지 확인하고 표를 그 값으로 고친다.
- `qaDocClean`의 「`tests/logic` 폴더가 없으면 건너뛴다」 예외를 없앤다. 그 예외의 이유(툴체인 없는 임시 폴더)는 W5의 가짜 `pnpm`이 없앤다 — 임시 저장소에서는 vitest 호출이 가짜로 성공한다. 판정 파일(`tests/logic/DocsHygiene.test.ts`) 하나만 없을 때 막는 동작은 그대로 둔다. 기존 `qaDocClean` 테스트는 유지하고, 임시 저장소 E2E는 가짜 `pnpm`으로 통과해야 한다.
- `start-verification`을 W5의 임시 저장소에서 실제 프로세스로 고정하는 테스트 둘을 둔다. 성공: `verification`으로 넘어가고 `ts_check_clean`·`lint_clean`·`ts_check_scope`가 적힌다. 실패(`WF_SHIM_FAIL=vitest`): 넘어가지 않고 기록용 값이 실패로 적힌다.
- W7의 F71 행에 한 줄을 더한다: 「`status`에 「다음에 칠 명령」을 넣을지는 F71의 결과(절차 배달만으로 절차가 지켜지는가)를 본 뒤 정한다」. 사양 리뷰가 미룬 제안 E4의 기록이다.
- `cso_commit`을 쓸 수 있는지의 판정은 `change-set.mjs`의 `csoBaseUsable(csoCommit, root)` 하나다. 키가 있고 `git merge-base --is-ancestor <cso_commit> HEAD`가 참이면 쓸 수 있다. `invalidate`·`start-verification`·`status`가 모두 이 함수를 부른다. `.claude/lib/*.mjs`는 상태 파일을 읽고 쓰지 않을 뿐, git은 띄운다(`change-set.mjs`가 이미 그렇다).
- biome의 `write` 값: `start-verification`과 `verify`는 `write: true`로 돌려 형식 차이를 고치고 「n개 파일을 고쳤다」를 찍는다. `pass`만 `write: false`다(커밋과 리뷰가 끝난 뒤라 파일을 고치지 않는다).
- `runWf`는 가짜 `pnpm` 폴더를 `PATH` 앞에 붙일 때 `process.env`에서 대소문자를 무시하고 `PATH` 키를 찾아(Windows는 `Path`) 그 키의 값을 고친다. 키를 새로 만들지 않는다 — 같은 이름의 키가 둘이 되면 자식 프로세스가 어느 쪽을 읽을지 보장이 없다.
- `collectChangeSet`은 `git diff --name-status`의 `T`(형식 변경)를 `M`으로 읽는다. `A`·`M`·`D`·`T` 밖의 글자(`U` 등)가 나오면 `measurable: false`로 돌려 모든 검사를 적용한다. 테스트: `T` 한 줄이 든 출력과 `U` 한 줄이 든 출력.
- `status`는 `/cso`가 적용되는 슬라이스에서 `cso_commit`과 다음 점검 명령을 한 줄로 찍는다. `cso_commit`을 쓸 수 있으면(키가 있고 `HEAD`의 조상이면) 「다음 /cso: `/cso --diff --base <cso_commit>`」, 쓸 수 없으면 「다음 /cso: 전체 (<이유: 기록 없음 | 지금 HEAD의 조상이 아님>)」이다. 쓸 수 있는지의 판정은 `invalidate`·`start-verification`이 쓰는 함수 하나를 그대로 쓴다. 옛 형식 상태 파일 견본으로 「전체 (기록 없음)」을, `cso_commit`이 `HEAD`의 조상일 때 diff 명령을 확인하는 테스트를 둔다.
- `skip-qa`는 사유를 적은 뒤 성공 출력에 「생략은 `game/**` 변경이 없는 동안만 유효하다 — 그 변경이 생기면 `pass`가 QA 문서를 요구한다」 한 줄을 찍는다. 명령 출력을 확인하는 테스트에 이 줄을 포함한다.
- §6의 표에 결과를 재는 줄 넷을 더한다(2단계를 열지 정하는 조건에는 쓰지 않고, 1단계가 줄이겠다는 셋이 실제로 줄었는지를 본다): ① 검증 phase에서 AI가 친 `pnpm wf`·`pnpm` 명령 총수, ② 그 명령 출력의 글자 수 합계(세션 기록에서 센다), ③ `.claude/**`와 `tests/helpers/**`의 줄 수와 전체 테스트 한 번의 시간, ④ 계획 문서 글자 수·리뷰 회차·계획 승인까지 든 세션 수. 기준선은 계획 승인 뒤 직전 슬라이스 둘의 세션 기록으로 재서 2단계 백로그 항목에 적고, ④는 이 슬라이스(2026-09-16부터)를 첫 표본으로 적는다. 이 숫자가 §2.2 「도구 슬라이스를 멈추는 안」을 다시 볼 때의 근거가 된다.
- §1에 한 문장을 더한다: 「1단계는 슬라이스마다 드는 비용을 줄이는 대신 도구 코드의 양은 늘린다(새 모듈 여섯, 임시 저장소 도우미, 테스트). 실제 유지비는 §6의 줄 수·테스트 시간으로 잰다.」
- §2.2의 「실제로 이 저장소 이력에서 `/cso`가 찾은 것이 없다」 옆에 「도구 경로(`.claude/**`·`tools/**`)에서도 0건이다 — `docs/qa/`에 `*-security-issues.md`가 하나도 없다(2026-10-06 확인)」를 적는다.
- `CSO_PATHS`에서 `.claude/**`를 저장소가 추적하는 자리로 좁힌다: `.claude/*.mjs`·`.claude/hooks/**`·`.claude/lib/**`·`.claude/settings.json`. 지금 추적하는 `.claude` 파일 여섯(`workflow.mjs`·`typecheck.mjs`·`hooks/gate-scripts.mjs`·`hooks/check-gstack.sh`·`settings.json`·`workflow-state.json`)이 전부 들고(상태 파일은 변경 집합에서 빼므로 걸리지 않는다), Claude Code가 판마다 새로 만드는 생성물은 애초에 걸리지 않는다. `.claude/commands/**`는 지금 없으니 생기면 더한다고 주석에 적는다. W1의 `.gitignore` 목록은 biome `vcs` 모드가 저장소 `.gitignore`만 읽기 때문에 그대로 둔다 — 「`/cso`가 항상 적용된다」는 이유는 이 좁힘으로 사라진다. 대표 변경 집합 표의 「도구만(`.claude/**`)」 줄은 `.claude/workflow.mjs`로 돈다.
- `CSO_PATHS` 위 주석에 조건 하나를 더 적는다: 「외부 기여자의 PR을 받기 시작하면 `CLAUDE.md`·`.claude/commands/**`·`docs/development/workflow/**`를 더한다 — AI가 그대로 실행하는 지시문이라 자동화 설정과 같다」. 백로그 F109(공개 여부) 행에도 같은 한 줄을 건다. `verification.md`에는 넣지 않는다(글자 수 상한).
- `/cso` 명령 문자열(`/cso --diff --base <커밋>`)은 `.claude/lib/change-set.mjs`의 상수 하나에 두고 `invalidate`·`start-verification`·`status`와 테스트가 그 상수를 쓴다. 절차 문서에는 「바뀐 부분만 본다(기준 커밋은 `status`가 보여 준다)」까지만 적고, 정확한 옵션과 gstack이 깨졌을 때의 대체(Claude Code의 `security-review`는 브랜치의 미반영 변경을 본다)는 `docs/development/spec/ops-skill-routing.md`의 `/cso` 행에 한 줄 둔다. §8의 `canon-done` 경로에 그 문서를 더한다.
- `pass review`·`canon-done`·`canon-skip`과 `user-verification` 전이의 출력 줄에 그때의 `HEAD` 짧은 해시를 찍는다(예: `✓ pass review (HEAD 2c41977)`). 상태 파일에는 적지 않는다(§4 「새 키는 둘」). §6 셋째 값은 이 해시와 `git diff --stat <그 해시> <다음 통과 해시> -- <그 검사가 보는 경로>`로 잰다. §6에 한 문장을 더한다: 「셋째 값은 코드 수정이 한 번이라도 있으면 보통 1 이상이다(`invalidate`가 정본 선언을 비우므로). 그래서 사실상 『리뷰 뒤 코드 수정이 두 슬라이스에서 있었는가』를 묻는 조건이다.」 여는 조건 자체는 바꾸지 않는다.
- W7의 F10 행에 둘을 더한다: 「1단계가 상태 파일 때문에 둔 예외(변경 집합에서 제외)와 그 테스트는 추적을 끊으면 지운다」, 「F10은 2단계보다 먼저 정한다」.
- W1을 짜기 전에 git pathspec으로 같은 판정이 나오는지 한 번 돌려 본다: `git diff --name-status --no-renames <기준> -- ':(glob)<경로>'`와 `git ls-files -o --exclude-standard -- ':(glob,icase)<경로>'`(이 장비 git 2.50에서 `:(glob)`·`icase`가 돈다, 2026-10-06 확인). 대표 변경 집합 여섯의 판정 표가 그대로 나오면 직접 짠 경로 맞추기와 경계 테스트(`toolsmith/x`·`game/package.json`·`.Claude/`)를 빼고 git에 맡긴다. 안 나오는 경우를 기록하고 지금 안으로 간다. 어느 쪽이든 여섯 줄 판정 표와 `measurable: false` 규칙이 계약이다.
- `pass`가 `write: false`로 biome을 돌려 형식 차이가 나오면 실패로 세고 「형식 차이 n개 파일 — `pnpm wf verify`로 고치고 커밋한 뒤 다시 친다」를 안내한다. 커밋 훅(lint-staged)이 커밋한 파일의 형식을 맞추므로, 여기서 형식 차이가 나온다는 것은 미커밋 파일이 있다는 뜻이다.
- 「`tests/logic/` 아래 파일은 프로세스를 띄우지 않는다」 테스트는 `node:child_process`뿐 아니라 접두사 없는 `child_process`, `node:worker_threads`, `worker_threads`의 import도 잡는다.
- §6 둘째 값의 기준선 「137회」는 2026-08-18 이후 누적이므로 그 기간의 슬라이스 수로 나눈 슬라이스당 평균으로 적는다(계획 승인 뒤 센다). 기대값 「1 + `user-verification`에 들어온 횟수」도 슬라이스당이다.
- sessions/로 옮기며 개요와 작업 묶음별 문서로 나눌 때, 이 승인 항목들은 해당 W절 본문에 녹이고 §12에는 결과 조건 다섯만 남긴다. 어느 리뷰에서 왔는지는 리뷰 기록 문서에 둔다.
- `verify.mjs`의 실행별 임시 폴더는 `finally`에서 지운다(실패·예외에서도). vitest 결과 파일이 없거나 JSON으로 읽히지 않으면(중간에 죽은 경우) 둘 다 「테스트 실행기가 결과 없이 끝났다 — `pnpm exec vitest run`으로 다시 돌려 보라」 길로 보낸다. 시험용 실행기 단위 테스트에 깨진 JSON 경우를 더한다.
- git 띄우기는 `change-set.mjs`의 `git(root, args)` 하나다(`spawnSync`, `maxBuffer` 64MiB, `shell` 없음). `workflow.mjs`의 `git()`은 이것을 import해 쓰고 자기 `spawnSync("git", …)`을 없앤다.
- `status`와 `start-verification` 성공 출력이 찍는 적용 판정 줄(검사마다 한 줄 + 갈라진 지점·항목 수 + QA 생략 + 다음 `/cso`)은 `change-set.mjs`의 순수 함수 `formatGateLines(gates, changeSet, state)`가 만들고 둘이 같은 함수를 쓴다. 단위 테스트가 문자열로 고정한다.
<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:dx -->
- `verify`는 `implementation`·`verification`·`user-verification`에서 받는다. 어느 phase에서도 전이하지 않고 기록용 값 셋만 적는다. 그 밖의 phase에서 치면 「코드를 검사하는 phase가 아니다」로 거부한다. 테스트: 세 phase에서 각각 돌아가고 phase가 그대로인지, `planning`에서 거부하는지.
- 통합 검사의 vitest 실패 출력에 `tsconfig.cocos.json`이 보이면 처방을 두 길로 찍는다: 「`<작업 폴더>/game`을 Cocos Creator로 한 번 연다」 또는 「다른 체크아웃의 `game/temp/tsconfig.cocos.json`을 같은 자리로 복사한다(git이 무시하는 파일이라 커밋되지 않는다)」. W7의 해당 백로그 항목에도 두 길을 적는다.
- `skip-qa`는 `qa-setup`·`implementation`·`verification`에서 받는다. `skip-qa --clear`는 `qa_skip_reason` 키를 지워 「생략 없음」으로 되돌린다. 테스트: `--clear` 뒤 `status`가 「QA 문서 생략: 없음」을 찍는다.
- `collectChangeSet`은 추적되지 않은 `*.meta` 파일을 변경 집합에서 뺀다(상태 파일을 빼는 자리에 같이 두고 주석에 「Cocos가 만드는 파일이지 개발자의 변경이 아니다. `.meta` 누락 검사는 추적 자산의 형제 `.meta`가 추적되는지로 판정하므로 결과가 달라지지 않는다」를 적는다). 대표 변경 집합 표에 「추적되지 않은 `.meta`만」 줄을 더하고 `meta`·`fullTypecheck`·`cso` 해당 없음, QA 생략 가능으로 고정한다. 새 자산은 자산 파일 자체가 `game/assets/**`에 걸린다.
- `pass`(`write: false`)가 biome 형식 차이만으로 실패하면 출력을 「형식 차이 n개 파일 — `pnpm wf verify`로 고치고 커밋한 뒤 `pnpm wf pass review`를 다시 친다. 형식만 고친 것은 판단 검사를 다시 하지 않는다」로 찍는다. 그 밖의 실패(타입·린트·테스트)는 「고친 뒤 `pnpm wf invalidate` → 절차대로」다. `verification.md`의 `invalidate` 문장 옆에 「biome이 고친 형식 차이는 예외다」 한 구절을 둔다(글자 수는 W6 표에서 다시 잰다).
- `status`의 명령 목록에서 `verify`에 「(전이 없음)」을 붙인다. `pass ts`·`pass lint` 거부 문구는 「타입·린트는 통합 검사가 기록한다 — 표시할 것이 없다. 결과만 다시 보려면 `pnpm wf verify`」다.
- `makeRepo(opts)`의 기본값: 옵션 없이 부르면 phase `verification`, QA 문서 있음, 게임 변경 없음, `/cso` 해당 없음(`csoApplicable: false`), `HEAD`는 `feat/<feature>`, git 저장소 있음(`git: true`). `WfSandbox.ts` 머리말 주석에 이 한 줄을 둔다.
- 변경 집합을 구할 수 없는 원인별 처방은 다섯 줄 전부 둔다: `origin/main` 없음 → 「`git fetch origin main`」, 하위 폴더 → 「저장소 루트에서 실행」, git 저장소 아님 → 「저장소 루트에서 실행(여기는 git 저장소가 아니다)」, git 출력 실패 → stderr 첫 줄 + 「`git status`로 확인」, `U` 등 알 수 없는 상태 → 「충돌을 풀고 다시 (`docs/development/troubleshooting/workflow-state-cross-machine.md`)」. 테스트에 `U` 경우의 문장을 더한다.
- 실행기를 찾지 못한 경우의 판정은 「`error`가 있거나, stdout이 비고 `status`가 9009(`cmd.exe`) 또는 127(`sh`)」이다(stderr에는 셸의 메시지가 찍히므로 stderr는 비어 있지 않다). 안내에 stderr 첫 줄을 함께 찍는다. 시험용 실행기는 stderr를 채운 모양으로 만든다. 이 항목이 앞 단계의 「출력이 비면」 표현을 대체한다.
- `ready-impl`·`skip-qa`·`approve-pr`의 거부 출력도 「절차: `pnpm wf steps <그 phase>`」로 끝낸다. vitest 실패 상세의 다시 돌려 볼 명령은 실패한 파일 경로를 붙인 `pnpm exec vitest run <파일>`(결과 파일의 `testResults[].name`)이고, 파일이 셋을 넘으면 `pnpm exec vitest run`만 찍는다.
- `skip-qa` 거부 문장은 「QA 문서가 필요하다: <걸린 파일>」로 걸린 파일을 든다.
- W6 `verification.md`에서 덜어 낼 때 「위와 같다」 같은 참조형 축약을 쓰지 않는다. 34행은 「`pnpm wf invalidate`를 친다」로 완결 문장으로 줄이고, 62행의 「고쳤으면 `pnpm wf invalidate`로 되돌려 보안 검사부터 다시 돈다」는 문장을 지운다(5행이 같은 말을 한다). 이 항목이 앞 단계의 「(위와 같다)」 표현을 대체한다. 상한 13,575자는 그대로다.
- 글자 수가 남으면 복사해 칠 예 둘을 넣는다: `qa-setup.md`의 `skip-qa` 문단에 `pnpm wf skip-qa "문서만 고친다 — game/** 변경 없음"` 한 줄, W3 `status` 출력 예에 `다음 /cso: /cso --diff --base 2c41977` 한 줄. 남지 않으면 넣지 않는다.
- `workflow/README.md`에 한 줄을 더한다: 「어느 검사가 언제 적용되는지는 `pnpm wf status`가 보여 주고, 규칙은 `.claude/lib/change-set.mjs`의 상수 위 주석이 정본이다」. 배달되지 않는 문서라 상한 밖이다.
- §4 「메모리는 머지 때 고친다」에 지금 아는 대상 셋을 적는다: 커밋 워크플로우(`feedback_commit_workflow`), 워크플로우 그대로 따르기(`feedback_follow_workflow`), `pass ts`는 진짜 게이트(`feedback_ide_diagnostics_open_files`). 계획 승인 뒤 목록을 마저 채운다.
- `/cso`가 해당 없음일 때 `pass cso`는 거부하지 않고 「`/cso` 해당 없음(`CSO_PATHS` 변경 없음 — `pnpm wf status`로 확인) — 기록만 남긴다」를 찍은 뒤 `cso_done`·`cso_commit`을 적는다. 전이 조건은 바뀌지 않는다(해당 없음이면 `cso_done`을 보지 않는다). 앞 단계 항목의 「`/cso` 해당 없음일 때 `pass cso`를 받지 않는다」 테스트는 「기록만 남긴다 + 전이 조건 불변」 테스트로 바꾼다.
- `start-verification`과 `verify`에 `--no-write` 플래그를 둔다. 켜면 biome을 `--write` 없이 돌려 형식 차이를 고치지 않고 실패로만 센다. 검사를 끄는 장치가 아니라 파일 수정만 끄는 것이다(§2.2에서 기각한 환경변수 교체와 다르다). 테스트: 플래그가 있으면 시험용 biome 실행기에 `write: false`가 전달된다.
- 검증 순서는 「커밋 → (적용 시) `/cso` → `pass cso` → 리뷰 → `pass review`」다(§3·W6·`verification.md`·`CLAUDE.md` 9단계 6번을 같은 순서로). `cso_commit`이 점검한 변경을 담은 커밋이 되게 하려는 것이다. 최종 승인에서 사용자가 보는 Taste 항목이다.
<!-- /autoplan-accepted:dx -->

<!-- autoplan-accepted:eng -->
- `/cso` 해당 없음일 때 `pass cso`는 `cso_commit`만 적고 `cso_done`은 거짓으로 둔다. 출력은 「`/cso` 해당 없음(`CSO_PATHS` 변경 없음 — `pnpm wf status`로 확인) — 기준 커밋만 남긴다」다. 앞 단계(DX) 항목의 「`cso_done`·`cso_commit`을 적는다」와 「기록만 남긴다 + 전이 조건 불변」 테스트는 이 모양으로 바꾼다. 이유: 해당 없음일 때 참을 적어 두면 뒤에 `.claude/**`를 고쳐 `/cso`가 적용으로 바뀌었는데 `invalidate`를 잊었을 때 그 값이 판정을 그냥 지난다.
- 모듈 배치는 일곱이다. `.claude/lib/git.mjs`: `git(root, args, opts = {})` 하나(`spawnSync`, `maxBuffer` 64MiB, `shell` 없음; `opts`는 `workflow.mjs`의 `switch`가 쓰는 `{ stdio: "inherit" }` 같은 `spawnSync` 옵션을 그대로 넘긴다 — 지금 `git(args, opts)`가 그렇게 쓰인다). `.claude/lib/change-set.mjs`: 적용 경로 상수·`collectChangeSet`·`applicableGates`·`csoBaseUsable`·`/cso` 명령 상수(git을 띄우는 파일). `.claude/lib/transition.mjs`: `decideTransition`·`qaRequired`·`approvePrDecision`·`formatGateLines`(입력만으로 답하는 파일 — 임시 저장소 없이 단위 테스트한다). 앞 단계 항목이 `change-set.mjs`에 두기로 한 `git(root, args)`·`approvePrDecision`·`formatGateLines`는 이 배치가 대체한다.
- `runVerify`의 순서는 biome → 타입 검사 → vitest다. 출력 줄의 순서도 같다. 시험용 실행기 단위 테스트가 호출 순서를 확인한다.
- `user-verification`에서 `verify`는 biome을 `write: false`로 돌린다. 플래그로도 켜지 못한다. 형식 차이가 나오면 실패로 세고 「`pnpm wf rework` 뒤 `pnpm wf verify`로 고친다」를 안내한다. 테스트: `user-verification` 상태에서 시험용 biome 실행기에 `write: false`가 전달된다. 앞 단계 항목 「`start-verification`과 `verify`는 `write: true`」는 `implementation`·`verification`에서만 그렇다.
- 통합 검사가 타입·린트·테스트로 진짜 실패하면 `pass`가 그 자리에서 `resetVerification`과 같은 일을 한다 — `cso_done`·`code_review_clean`·정본 선언을 비우고 QA 문서 지문을 찍는다. `cso_commit`과 기록용 값 셋은 남긴다. 예외 둘: biome 형식 차이만 실패(앞 단계 항목대로 「`pnpm wf verify`로 고치고 커밋한 뒤 다시 친다」), 실행기를 띄우지 못했거나 테스트 실행기가 결과 없이 끝남(환경 문제). 안내: 「통합 검사 실패 — 판단 검사 표시를 지웠다. 고친 뒤 절차대로 다시 한다(정본 선언 → QA 문서가 필요하면 갱신 → 커밋 → 적용 시 `/cso --diff --base <커밋>` → 리뷰 → `pass review`)」. 테스트: 단위(실패 → 표시 비움·기록 셋 남김, 예외 둘은 표시 유지)와 E2E `WF_SHIM_FAIL=vitest`. **최종 승인에서 사용자가 보는 Taste 항목이다.**
- `WfSandbox.ts`의 git 격리: 도우미가 띄우는 모든 git 호출에 `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=<임시 루트의 빈 gitconfig 파일>`, `GIT_AUTHOR_NAME`·`GIT_AUTHOR_EMAIL`·`GIT_COMMITTER_NAME`·`GIT_COMMITTER_EMAIL`, `GIT_CEILING_DIRECTORIES`를 준다. `init` 뒤 저장소 안에 `core.autocrlf=false`·`commit.gpgsign=false`를 `git config`로 적는다(`-c`는 `init` 한 번에만 듣는다). 전역에 `commit.gpgsign`·`core.hooksPath`가 있는 장비에서 샌드박스 커밋이 멈추거나 남의 훅을 돌리지 않게 하려는 것이다.
- `WfSandbox.git(dir, ...args)`는 부명령 허용 목록(`init`·`config`·`add`·`commit`·`branch`·`switch`·`checkout`·`update-ref`·`reset`·`cat-file`·`rev-parse`·`merge-base`·`rebase`)만 받고, 첫 인자가 그 밖(`-c`·`-C`·`--exec-path`·`--git-dir`·`--work-tree`·`--config-env` 등 전역 옵션 포함)이면 던진다. 「`tests/logic/` 아래 파일은 프로세스를 띄우지 않는다」 가드가 직접 import만 보므로, 도우미의 API가 좁아야 그 예외가 선다. `CSO_PATHS` 위 주석에 「`tests/logic/**` 예외는 도우미의 좁은 API에 기대고 있다」를 적는다. 테스트: 허용 목록 밖 인자에 던진다.
- 가짜 `pnpm`의 POSIX 쪽(`bin/pnpm`)은 쓰고 나서 `fs.chmodSync(path, 0o755)`를 한다 — 실행 비트가 없으면 `spawnSync`가 `EACCES`로 끝나 맥북에서 E2E가 전부 깨진다.
- 실행기 실패 판정은 `error.code`로 가른다: `error.code === 'ENOENT'` 또는 (stdout이 비고 `status`가 9009·127) → 「실행기 `<이름>`을 실행할 수 없다(`pnpm` 경로 확인)」 + stderr 첫 줄; `ENOBUFS` → 「출력이 너무 커서 잘렸다 — `<다시 돌려 볼 명령>`으로 직접 보라」; 그 밖의 `error` → `error.message` 그대로. 실행기 셋의 `spawnSync`에 모두 `maxBuffer: 64 * 1024 * 1024`를 준다. 이 항목이 앞 단계(DX) 항목의 판정 문장을 대체한다. 시험용 실행기 단위 테스트에 `ENOBUFS` 갈래를 더한다.
- vitest 요약 줄에 「파일 실패 n」(`numFailedTestSuites`)을 더한다. 결과 파일의 `success`가 거짓이면 `numFailedTests`가 0이어도 실패로 찍는다. 통과·실패 자체는 실행기 종료 코드가 정한다. 근거: vitest의 JSON reporter는 파일 suite가 실패하면 `testResults[].status='failed'`·`message`를 채우고 `numFailedTests`는 0일 수 있다(수집 오류 — `tsconfig.cocos.json`이 없는 경우가 이 모양이다). 시험용 결과 파일 테스트에 「suite 실패 1·test 실패 0」 모양을 둔다.
- 변경 집합을 구할 수 없는 원인에 「`origin/main`과 `HEAD`에 공통 조상이 없다(`git merge-base` 종료 코드 1, 빈 출력)」를 더하고 처방은 「`git fetch --unshallow` 또는 `git fetch origin main`」이다(원인별 처방은 여섯 줄이 된다). `csoBaseUsable`에서 `git merge-base --is-ancestor`가 128(모르는 커밋)로 끝나면 「쓸 수 없음 — 지금 저장소에 없는 커밋」으로 전체 `/cso`를 안내하고 변경 집합 실패와 섞지 않는다. 테스트: 이력이 다른 `origin/main`을 둔 임시 저장소, 없는 커밋 해시를 `cso_commit`에 둔 상태 파일.
- biome 결과의 분류는 JSON reporter를 쓰지 않는다(biome CLI 참조가 `json`·`json-pretty`를 「experimental, 패치 판에서 바뀔 수 있다」고 적는다 — 2026-10-06 Context7 확인). 판정은 종료 코드로: `write: false`에서 `biome check`가 실패하면 `biome lint .`를 한 번 더 띄워 그것이 통과하면 「형식 차이만」, 아니면 린트 실패로 분류한다(추가 호출은 실패 길에서만 든다). 「n개 파일을 고쳤다」 수는 summary 출력에서 읽되 못 읽으면 찍지 않는다(판정에 쓰지 않는다). 가짜 `pnpm`은 `exec biome lint`도 알아보고 성공으로 끝낸다. 시험용 실행기 테스트: 형식만 실패·린트 실패 두 갈래.
- pathspec 실험(앞 단계 항목) 전에 정해 두는 것 셋: `:(glob)`은 중괄호 확장을 하지 않으므로 `**/*.{sh,ps1,cmd,bat,py}`는 다섯 pathspec으로 푼다. `icase`는 pathspec 전체에 걸리므로 `.claude` 항목에만 붙인다. 게이트마다 git 한 번(패턴 여럿을 한 호출에)으로 하고, `rule`은 걸린 경로를 JS에서 패턴에 다시 대 보지 않고 「그 게이트의 경로 목록」으로 찍는다 — `status` 한 번에 git 호출이 게이트 수(넷)+3을 넘지 않게.
- `WfSandbox`의 정리와 `verify.mjs`의 실행별 임시 폴더 정리는 `fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })`로 한다. `verify.mjs`의 `finally` 정리는 try/catch로 감싸 정리 실패가 검사 결과를 덮지 않게 한다(Windows에서 Defender가 새 파일을 읽는 동안 `EBUSY`/`EPERM`).
- 통합 검사까지 가는 E2E는 여섯 이하로 둔다: `start-verification` 성공·실패, `verify` 전이 없음, `pass review` 실패·형식만 실패, `skip-qa` 뒤 게임 변경. 그 밖의 갈래는 `decideTransition`·`runVerify` 단위로. `WfSandbox`를 쓰는 테스트 파일에는 `testTimeout: 30_000`을 둔다. 구현 뒤 §10에 「스위트 전체」와 「샌드박스 파일만」의 시간을 따로 적는다.
- 더하는 테스트 다섯: `verify`가 phase뿐 아니라 `cso_done`·`code_review_clean`·`canon_*`·`qa_doc_fingerprint`도 건드리지 않는다. `approvePrDecision`에 `measurable: false` 갈래(모두 적용 → `logic-only` 거부, 여섯째). `collectChangeSet`이 `git add`만 한 새 파일을 `A`로, 커밋하지 않은 수정을 `M`으로 잡는다(변경 집합이 작업 트리 기준이라는 전제). `/cso`가 적용인데 `pass cso` 전에 `pass review`를 치면 통합 검사가 돌지 않는다. 글자 수 테스트의 세는 단위(`String.prototype.length`, UTF-16 단위)와 CRLF를 LF로 정규화한 뒤 센다는 것을 상수 옆 주석에 적는다.
- `CSO_PATHS`에 `game/package.json`을 더한다(git이 추적하는 게임 쪽 의존성 목록). `game/pnpm-lock.yaml`이 생기면 함께 더한다고 주석에 적는다.
- `verify.mjs`는 임시 폴더 경로에 `"`가 들어 있으면 「임시 폴더 경로에 따옴표가 들어 있어 명령줄을 만들 수 없다: <경로>」로 분명히 실패한다(`shell: true` 명령줄이 조용히 다른 파일에 쓰는 것보다 낫다).
- 복구 문서(`wf-tool-recovery.md`)의 둘째 길 끝에 한 줄을 더한다: 「그 길을 쓴 뒤 `git diff .claude/workflow-state.json`으로 바뀐 키를 눈으로 보고 커밋한다 — 옛 도구가 새 키(`qa_skip_reason`·`cso_commit`)를 모르고 지우는 경우를 여기서 잡는다」.
- `.claude/typecheck.mjs`에도 `// @ts-check`를 붙인다. `verify.mjs`가 import하면 `allowJs` 때문에 프로그램에 들어오는데, 붙여야 `runTypecheck`의 JSDoc 반환 타입이 서서 `verify.mjs`의 호출부가 검사된다. 고칠 양은 W4의 첫 함수 측정에 함께 잰다.
- §10에 한 줄을 더한다: 「`pass review`는 `DocsHygiene.test.ts`를 두 번 돌린다(`qaDocClean`의 `WF_QA_DOC` 호출과 통합 검사의 전체 스위트, 약 1초). 2단계에서 QA 판정을 통합 검사 안에 넣을지 판단할 때의 근거다」.
- §4 「메모리는 머지 때 고친다」의 대상에 `feedback_doc_only_slice_skips_wf`(문서만 바뀌는 슬라이스는 wf를 생략한다)를 더한다. 이 슬라이스 뒤에는 문서 슬라이스도 `skip-qa`·`/cso` 해당 없음으로 wf를 싸게 지나므로 그 메모리가 그대로 맞는지 머지 때 다시 본다.
- W7의 새 항목에 여덟째를 더한다(`backlog-implement.md`): 「`workflow.mjs`를 biome·tsc 검사 대상에 넣는다 — `biome.json`에 `.claude/**` override(`quoteStyle: "double"`)를 두면 따옴표 변환으로 큰 diff가 나지 않는다. 명령 본문을 `.claude/lib/`로 더 옮기는 것도 같은 항목이다」. 2단계와 무관하므로 따로 만든다.
- `verification.md` 첫머리는 「통합 검사는 이미 통과했고 남은 것은 통과 표시를 남기는 판단 검사 둘」로 쓴다(§0의 「판단 검사 넷」과 수를 맞춘다). 글자 수는 W6 표에서 다시 잰다.
<!-- /autoplan-accepted:eng -->
## Review record

> `/autoplan` 2026-10-06 실행 기록. 리뷰어가 보는 것은 위 「Implementation plan」뿐이고, 분석·결정·감사 기록은 여기 둔다. 사용자가 읽을 때는 이 절을 건너뛰어도 된다 — 받아들인 요구사항은 승인 블록(`autoplan-accepted:*`)으로 계획 본문 끝에 옮겨진다.

**최종 승인 게이트(Phase 4): APPROVED — 2026-10-06, 사용자 선택 A(그대로 승인). Taste 여섯(DAT #13·#43·#45·#51·#61·#92)은 권장안대로, 사용자 도전 0.**

### CEO 단계 (Phase 1) — SELECTIVE EXPANSION

**실행 조건.** 모드는 `/autoplan` 기본 규칙(SELECTIVE EXPANSION: 기존 범위를 다지고 더할 것은 하나씩 재서 고른다). Codex 미설치 → 바깥 리뷰어 없음, Claude 독립 리뷰어(서브에이전트)만. UI 범위 없음(화면 용어 0건), DX 범위 있음(용어 38건 + AI가 주로 쓰는 개발 도구). 리뷰 깊이는 구현 가능 수준(implementation-ready).

**시스템 점검(Pre-review audit).** 브랜치 `feat/workflow-diet`는 main(`5c9d741`) 위 커밋 6개가 전부 문서다. 작업 폴더 깨끗. stash 둘은 다른 슬라이스 것(무관). `.ts`·`.mjs`·`.json`에 TODO/FIXME 표식 0건. 최근 30일 손댄 파일은 전부 이 슬라이스의 문서. 설계 문서(`2026-10-05-workflow-diet-design-draft.md`, `Status: APPROVED`)를 문제·제약·접근의 출처로 읽었다. 그 문서와 인계 문서에 리뷰어를 겨냥한 지시문은 없다.

**회고(Retrospective).** 옛 계획(`211ae71`)은 2026-09-17 Eng 리뷰 30건을 반영한 뒤 승인 직전에 멈췄고, 그때 결정 가운데 하나(「`/cso` 대상 목록이 같으면 다시 하지 않는다」)를 사용자가 2026-10-05에 뒤집었다. 그 뒤 반복해서 걸린 문제 셋은 이미 계획에 들어 있다: 상태 파일이 변경 집합을 오염시킨다(→ W1이 뺀다), 툴체인 없는 임시 폴더에서 `pass`가 죽는다(→ W5 가짜 `pnpm`), Windows에서 git과 Node의 경로 표기가 다르다(→ W1 `--show-prefix`). Prior learning applied: `wf-state-file-pollutes-change-set`(9/10, 2026-09-16), `wf-sandbox-e2e-breaks-when-pass-spawns-toolchain`(9/10, 2026-09-17), `git-toplevel-vs-node-realpath-slash-mismatch`(9/10, 2026-09-17), `biome-vcs-useignorefile-worktree`(9/10, 2026-09-17).

**Taste 기준.** 따를 것: `.claude/typecheck.mjs`(한 벌 코드를 `pnpm typecheck`와 게이트가 같이 쓰고, 검사 범위를 결과로 돌려주고, 왜를 주석으로 적는다), `workflow.mjs`의 `check-links`(판정을 복사하지 않고 vitest를 띄운다). 피할 것: `tests/helpers/CanonDoc.ts`·`WorkflowSteps.ts`의 복사본(F78), `qaDocClean`의 「`tests/logic`이 없으면 건너뛴다」 예외(샌드박스를 통과시키려고 판 구멍 — 계획 W2가 같은 예외를 통합 검사에는 두지 않기로 한 이유).

**Landscape.** Layer 1(검증된 방식): 모노레포 CI의 경로 필터와 affected-only 실행(Nx·Turborepo). Layer 2(검색): 두 함정이 반복 지적된다 — 경로 목록이 코드 변화를 따라가지 못해 검사하지 않은 변경에 초록불이 켜진다, 공유 코드가 있으면 경로 필터가 틀린다. Layer 3(첫 원칙): 이 계획은 그 둘을 피하는 쪽으로 서 있다. 코드 리뷰와 전체 테스트는 경로와 무관하게 항상 돌고, 변경 집합을 구할 수 없으면 모든 검사를 적용하며(닫힌 쪽으로 틀린다), 경로 목록의 예외 둘(`tests/logic/**` 제외, `game/**` 제외)은 각각 테스트 하나와 F61 조건으로 지킨다. 남는 위험은 「경로 목록이 낡는다」이고, 그 대비는 상수 위 정책 주석과 대표 변경 집합 여섯의 판정 테스트다. Eureka 없음.

#### 0A 전제 (Premise Challenge)

- **진짜 문제.** 규모와 상관없이 모든 슬라이스가 같은 9단계를 돈다. 문서 검사기 한 줄 슬라이스도 QA 씬 절·`/cso`·`.meta` 검사·검증 명령 넷을 전부 지난다.
- **목표 결과.** 검증 중 AI가 통합 검사 말고 따로 치는 기계 검사 명령 0개, 해당 없는 검사 셋 건너뜀, 판정 코드 한 벌, 절차 문서 글자 수 증가 0.
- **아무것도 안 하면.** 요구사항 문서 §3.1의 기준선(2026-08 도구 슬라이스 넷)이 그대로다 — 검증 시작부터 `pass cso`까지가 한 슬라이스 비용의 32%, `check-links` 단독 실행 137회(2026-08-18 이후).
- **직접 푸나, 대리 지표를 푸나.** 시간과 유지비는 직접 푼다(명령 수·건너뛰기·F78). 읽는 양은 검증 출력에서만 줄고 절차 문서는 「늘리지 않는다」까지다 — 계획이 스스로 밝힌 한계이고, 줄이는 일은 W7 새 백로그 항목으로 간다. 대리 지표가 아니라 범위를 나눈 것이다.
- **전제 아홉 검토(설계 문서 「전제」).** 1~8은 사용자가 동의했고 코드로 뒷받침된다(예: 전제 6 「옛 형식 상태 파일을 읽는다」는 `workflow.mjs`가 이미 `canon_updated ?? []`로 같은 방식을 쓴다). 전제 9(기준선을 다시 재지 않는다)는 한계를 스스로 적었고 대표 변경 집합 테스트로 보완한다. **뒤집을 전제 없음 → User Challenge 0건.**
- **`/cso` 적용 경로에서 `game/**`를 빼는 전제.** 지금 게임 코드에는 결제·네트워크·외부 연동이 없다(2026-10-05 확인). 조건부 예외로 두고 F61에 할 일을 적는 것으로 충분하다.

#### 0B 기존 코드 (Existing Code Leverage)

| 하위 문제 | 지금 있는 것 | 계획의 처리 |
|---|---|---|
| 변경 집합·적용 판정 | 없음 | 새로 만든다(`change-set.mjs`). `git()` 헬퍼(`workflow.mjs:358`)의 `spawnSync` 패턴을 따른다 |
| 타입 검사 | `.claude/typecheck.mjs` `runTypecheck()` — 범위(`full`/`logic-only`)를 돌려준다 | 그대로 쓰고 `{ capture: true }`만 더한다 |
| 전체 테스트 실행 | `workflow.mjs:347 runVitest()` — `pnpm exec vitest run`, `shell: true` | `verify.mjs`가 같은 호출에 `--reporter=json --outputFile`을 더한다 |
| biome | `package.json` `check` 스크립트 | 새 실행기(`--reporter=summary`, `--write`) |
| 전이 판정 | `pass()` 안에 인라인(`workflow.mjs:642~704`): QA 확정 게이트 → 정본 선언 게이트 → 전이 | `transition.mjs decideTransition`으로 뽑아낸다. 순서는 지금과 같고 통합 검사가 마지막에 붙는다 |
| `approve-pr` | 인라인(`819~863`): 타입 검사 → 범위 게이트 → `.meta` | `approvePrDecision`으로 뽑고 적용 판정을 앞에 둔다 |
| `.meta` 누락 검사 | `listMissingAssetMeta`·`requireAssetMeta`(`366~423`) | 그대로 쓴다. `approve-pr`에서 호출 여부만 판정에 따른다 |
| QA 문서 확정 | `qaDocClean`(vitest `DocsHygiene.test.ts`) + `qaDocFingerprint` | 그대로. `qaRequired`가 「필요한가」를 앞에서 판정한다 |
| 정본 도우미 | `workflow.mjs:128~203` + 복사본 `tests/helpers/CanonDoc.ts` | `.claude/lib/canon.mjs` 한 벌로 옮기고 복사본을 지운다(F78) |
| 절차 문서 정합 | `check-docs` 판정 + 복사본 `tests/helpers/WorkflowSteps.ts findStepDocIssues` | `.claude/lib/workflow-steps.mjs` 한 벌 |
| phase 목록 | `workflow.mjs PHASES` + 훅 `gate-scripts.mjs:13 EDITABLE_PHASES` | `phases.mjs` 내보내기 + 훅은 값 유지, 테스트로 동일성 확인 |
| 임시 저장소 도우미 | `ClaudeMdSplit.test.ts`·`DocsHygiene.test.ts`에 각각 | `tests/helpers/WfSandbox.ts`로 모은다 |

다시 짓는 것은 없다. 전부 옮기기·뽑아내기·덧붙이기다.

#### 0C 꿈의 상태 (Dream State)

```
  CURRENT STATE                      THIS PLAN                           12-MONTH IDEAL
  슬라이스마다 9단계 전부      --->   변경 집합으로 검사 적용 판정   --->   판단 검사도 「무엇을 보고 통과했나」를
  검증 명령 넷(typecheck·pass ts·       통합 검사 하나(start-verification·        기록하고 바뀐 것만 다시 한다(2단계)
  check·pass lint)                      verify·pass review 직전)                 절차 문서 ≤10,000자
  판정 코드 두 벌(F78)                  .claude/lib 한 벌                        상태 파일 정책 확정(F10)
  .meta·QA 문서 항상                    해당 없으면 건너뜀, QA는 사유와 함께 생략   헛 재검사 0
  코드 고치면 /cso 전체 재실행          바뀐 부분만(cso_commit)                   (CI는 지금 없다 — 두지 않는다)
```

이 계획은 꿈의 상태 쪽으로 간다. 2단계를 갈지는 §6의 측정 기준이 정한다.

#### 0D 대안 — 필요 없음

접근은 사용자가 2026-10-05에 축소형 A로 정했고(설계 문서 「검토한 접근」: B·C 기각), 뒤집을 근거가 없다. 결정 행을 만들지 않는다.

#### 0E 모드

`/autoplan` 규칙으로 SELECTIVE EXPANSION. 바꾸는 파일 수(추정): 새 파일 10(`.claude/lib/*.mjs` 여섯, `WfSandbox.ts`, `WorkflowDiet.test.ts`, 옛 형식 상태 파일 견본, `wf-tool-recovery.md`), 고치는 파일 약 23(`workflow.mjs`·`typecheck.mjs`·`biome.json`·`package.json`·`tsconfig.tests.json`·`.gitignore`, 테스트 넷, 절차 문서 넷+README, `CLAUDE.md`, 트러블슈팅 둘, 백로그 셋, 주석 둘), 지우는 파일 2(`CanonDoc.ts`·`WorkflowSteps.ts`). 합계 약 35. 15개를 넘으므로 수만 보면 SCOPE REDUCTION 권고 조건이지만, 절반이 문서·테스트이고 코드 핵심은 새 모듈 여섯과 CLI 하나다. 모드는 `/autoplan` 규칙대로 유지한다(Mechanical).

#### 0F·0G 범위 분석

**HOLD SCOPE 점검 셋.**
1. **복잡도.** 8파일·2모듈을 넘는다. 더 적은 부품으로 같은 목표가 되나? `.claude/lib`를 여섯 파일 대신 둘로 합칠 수는 있지만, 테스트가 파일 단위로 import하고(`canon.mjs`는 `CanonDoc.test.ts`만, `phases.mjs`는 훅 동일성 테스트만), 합치면 `workflow.mjs`를 import하는 길로 돌아가 F78의 원인(한 파일이 CLI와 판정을 같이 든다)을 되살린다. 유지한다.
2. **최소 변경.** 목표(검증 명령 하나·건너뛰기·한 벌)에 W1~W5가 다 필요하다. W6은 절차가 바뀌므로 필수. W7은 백로그 정리라 필수. 막지 않고 미룰 수 있는 것: W4의 `parsePhases` 삭제(계획대로 지운다 — 미룰 이유가 없다), 트러블슈팅 문서 둘의 수정(지금 절차와 어긋나므로 같은 PR).
3. **불변식·통과 조건.** §12의 조건 다섯과 §4의 제약을 그대로 지킨다. 「통합 검사에 `tests/logic` 없으면 건너뛴다 같은 예외를 두지 않는다」가 핵심 불변식이다.

**10x 야심.** 10x 판은 2단계(판단 검사의 입력 지문 기록 + 재비교) + 절차 문서 다이어트 + 상태 파일 정책이다. 계획은 그것을 일부러 뒤로 뺐고, 2단계를 열 조건을 숫자로 정했다. 플랫폼 가능성: `.claude/lib/*.mjs`는 이후 모든 워크플로 변경(F10, 2단계 지문, F71 관찰)이 올라탈 공통 바닥이 된다.

**Delight scan (30분짜리 인접 개선 — 각각 따로 판정).**

| ID | 제안 | 효과 | 노력 | 위험 | 판정(원칙) |
|---|---|---|---|---|---|
| E1 | 통합 검사 요약 줄마다 걸린 시간(ms)을 찍는다 | §10 「통합 검사 한 번의 시간」 측정이 공짜가 되고 2단계 기준 재기에 쓰인다 | S (human ~30min / CC ~3min) | low | **Add** — 영향 범위 안(`verify.mjs`), 파일 1 (P2) |
| E2 | `pass cso` 때 커밋되지 않은 변경이 있으면 경고 한 줄 | 계획이 말한 「cso_commit이 앞선 커밋이면 더 넓게 본다」를 그 자리에서 알려 준다 | S (human ~30min / CC ~3min) | low | **Add** — 영향 범위 안(`workflow.mjs pass`), 파일 1 (P2) |
| E3 | `status`가 `/cso` 적용 슬라이스에서 `cso_commit`과 다음 점검 명령(`/cso --diff --base <해시>` 또는 「전체」)을 찍는다 | 지금은 `invalidate`·`start-verification` 출력에서만 보여서 지나가면 잃는다 | S (human ~1h / CC ~5min) | low | **Add** — W3 `status`에 한 줄, 판정 함수는 W2 것을 재사용 (P2·P4) |
| E4 | `status`에 「다음에 칠 명령」 한 줄 | 절차 문서를 다시 읽지 않게 한다 | M | medium — 절차 배달·준수율 관찰(F71)의 영역 | **Defer** → 백로그(F71 행에 후보로) (P3: 영향 범위 밖, 이 슬라이스의 부담 셋과 간접) |
| E5 | `verify` 실패 출력에 다시 돌려 볼 명령 | — | — | — | **중복** — 계획 W2가 이미 든다 (P4) |
| E6 | `skip-qa` 성공 출력에 「`game/**` 변경이 생기면 `pass`가 QA 문서를 요구한다」 한 줄 | 생략이 조건부라는 것을 치는 순간 알린다 | S (human ~15min / CC ~2min) | low | **Add** — W2 `skip-qa` 출력 한 줄 (P2) |
| E7 | 변경 집합을 구할 때 `origin/main` 뒤처짐을 알린다 | 갈라진 지점이 앞으로 가는 것을 알린다 | S | medium — fetch 없이는 알 수 없다 | **Skip** — 계획이 「fetch하지 않는다, 더 보는 쪽으로만 틀린다」로 이미 정했다 (P6) |

Add 넷(E1·E2·E3·E6)은 모두 영향 범위 안·파일 1·CC 5분 이하라 자동 승인 조건(P2)에 든다. 각 요구사항과 테스트는 아래 승인 블록에 적었다.

#### 0H CEO 요약 · 사양 리뷰 루프

CEO 요약: `C:\Users\Choi-HC\.gstack\projects\dev-HongCheol-monster\ceo-plans\2026-10-06-workflow-diet.md`. 사양 리뷰 루프의 입력은 그 요약 + `amend-input`이 내보낸 현재 계획 본문. 결과는 아래 「사양 리뷰 루프 결과」에 적는다.

#### 0H 문서 승인

사양 리뷰 루프가 끝난 뒤의 문서 승인(A 승인 / B 수정 / C 중단)은 `/autoplan` 규칙으로 A다(DAT #39). CEO 요약과 계획 본문이 같은 결정을 담고 있는 것을 3회차 입력(`autoplan-ceo-iSmYcv`)으로 확인했다. 승인은 이 두 문서의 지금 판본에 대한 것이고, 구현은 승인되지 않았다.

#### 0I 시간순 점검 (Temporal Interrogation)

```
  HOUR 1 (바닥):      W5 먼저 — 임시 저장소 모양(c1·c2·c3, 브랜치 넷, 옵션 여섯)과 가짜 pnpm(fake-pnpm.mjs).
                      이것이 없으면 W1~W3의 테스트를 하나도 못 돌린다. 구현자가 알아야 할 것: 지금 두 테스트의
                      makeRepo/makeSandbox가 무엇을 만드는지(DocsHygiene 188~241행, ClaudeMdSplit 210행).
  HOUR 2-3 (핵심):    W1 change-set.mjs(경로 맞추기 경계, T·U 처리, measurable:false) → W4 lib 분리(canon·
                      workflow-steps·phases, allowJs·JSDoc 비용은 함수 하나로 먼저 잰다) → W2 verify.mjs·
                      transition.mjs(needsQa·needsVerify 두 단계 재호출). 걸릴 모호함: biome --reporter=summary의
                      실제 출력 모양, vitest JSON 결과 파일의 필드 — 둘 다 실물로 한 번 찍어 보고 파서를 쓴다.
  HOUR 4-5 (연결):    workflow.mjs가 lib를 import하고 pass·start-verification·verify·approve-pr·status·skip-qa를
                      고친다. 놀랄 것: shell:true에서 실행기 없음이 9009/127로 온다, 상태 파일이 늘 미커밋이다,
                      Windows PATH 키가 Path다, 이 브랜치 자신의 검증이 새 도구로 처음 돈다(§1).
  HOUR 6+ (마무리):   W3 approvePrDecision 다섯 갈래, W6 문구를 실제로 써서 글자 수 재기(덜어 낼 문장 둘 포함),
                      W7 백로그(F118부터, F71 행에 E4 후보), §7의 일부러 넣은 실패 셋 확인. 미리 계획해 둘 것:
                      첫 start-verification 전에 상태 파일 커밋(§4), 메모리 갱신 목록(§4).
```

- **범위·실현성 막힘(0D로 풀 것):** 없음. 3회차 리뷰의 막음 1건(임시 저장소 모양)은 승인 항목으로 풀었다.
- **미정으로 남기는 설계 선택:** §11의 `game/settings/**`(Cocos 문서로 확인 뒤 결정), W4 JSDoc 비용(함수 하나로 재서 결정). 둘 다 계획이 이미 그렇게 적었다.
- **노력:** 사람 팀 약 3~4일 / CC+gstack 약 3~4시간(테스트 포함, 글자 수 맞추기와 손 확인 셋이 뒤에 붙는다).

#### Step 0.5 양쪽 목소리 (Dual Voices)

**Claude CEO 독립 리뷰어(서브에이전트, `autoplan-ceo-imUNgx/native-prompt.md` 435줄 전부 읽음, INPUT 해시 일치).** critical 0, high 5, medium 9, 낮음 3. 한 줄 판정: 「1단계가 만드는 것은 방향이 맞고 설계는 촘촘하다. 빠진 것은 줄이겠다는 셋(시간·읽는 양·유지비)을 재는 기준이고, 2단계를 열지 정하는 기준은 지금 설계로는 잴 수 없거나 재기 전에 답이 정해져 있다.」 `[subagent-only]` — Codex 미설치.

**Codex CEO 목소리.** 미설치 → unavailable. 바깥 목소리 없음.

```
CEO DUAL VOICES — CONSENSUS TABLE:
  Dimension                           Claude  Codex  Consensus
  1. Premises valid?                   부분    —      N/A (유지비 전제는 순계로 거꾸로일 수 있다 [2-1])
  2. Right problem to solve?           예      —      N/A (단, 가장 큰 비용인 계획·리뷰는 재지 않는다 [1-2])
  3. Scope calibration correct?        예      —      N/A (구현 범위 그대로, 측정 설계만 고친다)
  4. Alternatives sufficiently explored?부분   —      N/A (pathspec 안 [4-2], 멈추는 안의 손익 [4-1])
  5. Competitive/market risks covered? 예      —      N/A (플랫폼 흡수 위험만: cso_commit·/cso 문자열)
  6. 6-month trajectory sound?         부분    —      N/A (2단계 여는 기준 [3-1], .claude/** [3-2])
CONFIRMED 없음 — 바깥 목소리가 없어 여섯 칸 모두 N/A. 단일 목소리의 high 다섯은 아래에 따로 판정했다.
```

**지적별 판정(0D, `/autoplan` 자동 결정).** 사용자 결정(사람 확인 지점 셋, 축소형 A, 바뀐 부분만 `/cso`)을 바꾸는 제안은 없었다.

| ID | 지적(요지) | 판정 | 원칙 | 어떻게 반영 |
|---|---|---|---|---|
| C-1-1 | 줄이겠다는 셋을 재는 자리가 없다 | **Add** | P1 | §6 표에 결과 측정 셋을 더한다: 검증 phase에서 AI가 친 `pnpm wf`·`pnpm` 명령 총수, 그 출력 글자 수(세션 기록), `.claude/**`+`tests/helpers/**` 줄 수와 전체 테스트 시간. 기준선은 계획 승인 뒤 직전 슬라이스 둘의 세션 기록으로 잰다 (DAT #40) |
| C-1-2 | 가장 큰 비용(계획·리뷰)을 재지 않는다 | **Add(측정만)** | P1 | §6에 「계획 문서 글자 수·리뷰 회차·계획 승인까지 세션 수」 한 줄, 이 슬라이스(09-16부터)를 첫 표본으로. 사람 확인 지점·리뷰 구성은 바꾸지 않는다 (DAT #41) |
| C-2-1 | 유지비는 순계로 늘 수 있다 | **Add** | P5 | §1에 「1단계는 슬라이스마다 드는 비용을 줄이는 대신 도구 코드의 양은 늘린다. 실제 유지비는 §6의 줄 수·테스트 시간으로 잰다」 (DAT #42) |
| C-2-2 | `/cso`가 찾은 것이 없는데 `cso_commit` 장치가 넷이다 | **부분 Add — E2 철회** | P3·P5 | 저장소에 `*-security-issues.md`가 없다 = 도구 경로에서도 0건. §2.2에 그 사실을 적는다. 조상 확인(`csoBaseUsable`)은 사용자 결정(바뀐 부분만 `/cso`)의 안내가 리베이스 뒤에 틀리지 않게 하는 최소 장치라 남긴다. **E2 미커밋 경고는 뺀다** — 절차 순서가 「`/cso` → `pass cso` → 커밋」이라 `pass cso` 때는 거의 늘 미커밋이고, 경고가 거의 매번 떠서 신호가 아니라 소음이다(DAT #4 철회, DAT #43, **Taste**) |
| C-2-3 | 외부 기여를 받기 시작하면 `CLAUDE.md`·절차 문서도 자동화 설정이다 | **Add(주석·백로그)** | P1 | `CSO_PATHS` 위 주석과 F109 행에 조건을 적는다. `verification.md`에는 넣지 않는다(글자 수 상한) (DAT #44) |
| C-3-1 | 2단계 여는 기준이 잴 수 없거나 답이 정해져 있다 | **부분 Add** | P5 | 상태 파일 키를 더하지 않는다(§4 「새 키는 둘」, F10). 대신 `pass review`·`canon-done`·`canon-skip`·`user-verification` 전이의 출력 줄에 그때의 `HEAD` 짧은 해시를 찍어 세션 기록에서 「그 검사가 본 파일이 그 뒤 바뀌었나」를 `git diff --stat`으로 잴 수 있게 한다. 여는 조건은 그대로 두되 §6에 「셋째 값은 코드 수정이 한 번이라도 있으면 보통 1 이상이라, 사실상 『리뷰 뒤 코드 수정이 두 슬라이스에서 있었는가』를 묻는 조건이다」를 적는다. 비용 기준으로 바꾸는 안은 측정이 더 어려워 기각 (DAT #45, **Taste**) |
| C-3-2 | `.claude/**` 전체가 적용 경로면 Claude Code 생성물마다 `/cso`가 붙는다 | **Add(a)** | P5 | `CSO_PATHS`의 `.claude/**`를 저장소가 추적하는 자리로 좁힌다: `.claude/*.mjs`·`.claude/hooks/**`·`.claude/lib/**`·`.claude/settings.json`(지금 추적 파일 여섯이 전부 든다; `.claude/commands/**`는 없으므로 생기면 더한다). `.gitignore` 목록은 biome vcs 때문에 그대로 둔다 (DAT #46) |
| C-3-3 | `/cso --diff --base` 문자열이 세 곳에 박힌다 | **Add** | P4·P5 | 명령 문자열은 `.claude/lib/change-set.mjs`의 상수 하나, 테스트는 그 상수를 import. 절차 문서에는 「바뀐 부분만 본다(기준 커밋은 `status`가 보여 준다)」까지만. 정확한 옵션과 gstack이 깨졌을 때의 대체(Claude Code `security-review`)는 `ops-skill-routing.md`에 한 줄 — §8 정본 선언 목록에 더한다 (DAT #47) |
| C-3-4 | §12가 두 번째 사양이 됐다 | **Add(문서 정리 지시)** | P5 | sessions/로 나눌 때 §12의 승인 항목을 해당 W절 본문에 녹이고 §12에는 결과 조건 다섯만 남긴다. 출처는 리뷰 기록 문서에 (DAT #48) |
| C-3-5 | F10을 미루면서 상태 파일에 더 쓴다 | **Add** | P1 | F10 행에 「1단계가 상태 파일 때문에 둔 예외(변경 집합 제외)와 그 테스트는 추적을 끊으면 지운다」와 「F10을 2단계보다 먼저 정한다」 (DAT #49) |
| C-4-1 | 멈추는 안을 숫자 없이 기각 | **C-1-2로 닫힘** | — | §6 측정의 숫자를 2단계 항목에 적을 때 기각 근거로 다시 쓴다 (DAT #50) |
| C-4-2 | 경로 맞추기를 git pathspec에 맡기는 안 | **시험 뒤 결정** | P4·P5 | 이 장비 git 2.50에서 `:(glob)`·`:(glob,icase)`가 돈다(확인). W1 구현 전에 pathspec으로 대표 변경 집합 여섯의 판정이 나오는지 돌려 보고, 되면 직접 짠 맞추기와 그 테스트를 뺀다. 여섯 줄 판정 표가 계약이고 구현 방식은 거기 맞춘다 (DAT #51, **Taste**) |
| C-5 | 플랫폼 흡수 위험 | C-2-2·C-3-3으로 닫힘 | — | — |
| C-s1 | `pass`(`write: false`)에서 형식 차이가 나오면 | **Add** | P5 | 커밋 훅(lint-staged)이 커밋 파일의 형식을 맞추므로 `pass`에서 형식 차이가 나오면 미커밋 파일이 있다는 뜻이다. 안내: 「형식 차이 n개 파일 — `pnpm wf verify`로 고치고 커밋한 뒤 다시」. 실패로 센다 (DAT #52) |
| C-s2 | `child_process` 금지 테스트의 범위 | **Add** | P1 | 접두사 없는 `child_process`와 `node:worker_threads`·`worker_threads`도 잡는다 (DAT #52) |
| C-s3 | 둘째 값 기준선 137회의 단위 | **Add** | P5 | 슬라이스당 평균으로 맞춘다(그 기간의 슬라이스 수로 나눈다, 계획 승인 뒤 센다) (DAT #52) |

#### Phase 2 (Design Review) — SKIPPED

UI 범위 없음(Phase 0 판정: 화면 용어 0건). 이 단계는 돌지 않았고 완료가 아니다.

#### Review Sections 1~11 (CEO)

**Current scope(Section 1 앞 공표).** 모드 SELECTIVE EXPANSION(`/autoplan` 규칙). 받아들인 것: 원안 W1~W7 + E1·E3·E6 + 사양 리뷰 41건 + 독립 리뷰 반영 13건(위 표). 철회: E2. 미룸: E4(F71 행). 기각: E5·E7. 미정: §11 `game/settings/**`, W4 JSDoc 비용, W1 pathspec(시험 뒤).

**Section 1: Architecture Review.**

```
                 ┌────────────────────────────────────────────────────────────┐
                 │ .claude/workflow.mjs  (CLI · 상태 파일을 읽고 쓰는 유일한 곳) │
                 └───────┬───────────────┬──────────────┬────────────┬────────┘
                         │               │              │            │
            ┌────────────▼──┐  ┌─────────▼───────┐ ┌────▼──────┐ ┌──▼─────────────┐
            │ lib/change-set│  │ lib/verify      │ │ lib/      │ │ lib/canon      │
            │ collectChange │  │ runVerify       │ │ transition│ │ lib/workflow-  │
            │ Set · appli-  │  │ (tsc·biome·     │ │ decide-   │ │ steps · lib/   │
            │ cableGates ·  │  │  vitest 실행기) │ │ Transition│ │ phases         │
            │ csoBaseUsable │  │                 │ │ (순수)    │ │                │
            │ approvePrDec. │  └───────┬─────────┘ └───────────┘ └──┬─────────────┘
            └──────┬────────┘          │ typecheck.mjs.runTypecheck   │
                   │ git(spawnSync)    │ ({capture})                  │
            ┌──────▼────────┐  ┌───────▼─────────┐              ┌────▼────────────┐
            │ git           │  │ pnpm exec       │              │ tests/logic/*.ts│
            │ (merge-base,  │  │ tsc·biome·vitest│              │ (lib를 직접     │
            │  diff, ls-    │  │ (W5: 가짜 pnpm) │              │  import)        │
            │  files)       │  └─────────────────┘              └─────────────────┘
            └───────────────┘
   훅 .claude/hooks/gate-scripts.mjs ── import 없음(EDITABLE_PHASES 복사본, 테스트가 동일성 확인)
```

- 의존 방향은 한쪽이다: CLI → lib → (git·pnpm). lib는 상태 파일을 모른다. 테스트는 lib를 직접 import한다. 훅은 아무것도 import하지 않는다(불러오기 실패가 편집을 막지 않게).
- 데이터 흐름 넷(변경 집합): 정상 — git 출력 → 항목 목록 → 적용 판정; 없음(nil) — `origin/main`·저장소·git 없음 → `measurable: false` → 모든 검사 적용, QA 생략 무효; 빈 값 — 변경 집합 0건 → 세 검사 해당 없음, QA 생략 유효; 오류 — git `error`/`status null`/알 수 없는 글자 → `measurable: false`.
- 상태 기계: phase 일곱은 그대로. 새 상태 값 둘(`qa_skip_reason`·`cso_commit`)은 최상위에, 없을 수 있다. 통과 표시는 둘(`cso_done`·`code_review_clean`)로 줄고 기록용 값 셋은 조건이 아니다. 불가능한 전이는 지금처럼 `requirePhase`가 막는다. `decideTransition`은 두 번 다시 불릴 수 있다(`needsQa` → `needsVerify`) — 순서가 「판단 검사 → QA → 정본 → 통합 검사」라 비싼 검사가 뒤에 온다.
- 결합: `workflow.mjs`가 lib 여섯을 import한다(새 결합, 정당 — 한 벌). `typecheck.mjs`에 `capture` 분기 하나. 훅과 lib 사이의 값 동일성은 테스트가 쥔다.
- 10x·100x: 로컬 도구라 부하는 변경 집합 크기뿐. `maxBuffer` 64MiB로 아트 슬라이스도 든다. pathspec 안이면 git 호출이 2회에서 8회로 — 0.5초 안.
- 단일 실패점: `origin/main` 참조(없으면 닫힌 쪽으로), 가짜 `pnpm`(테스트에서만), `game/temp/tsconfig.cocos.json`(없으면 `logic-only` 범위 — 지금과 같다).
- 보안 경계: 새 입력 통로 없음(아래 Section 3).
- 운영 실패 시나리오: `pnpm`이 PATH에 없다 → 9009/127 판정으로 「실행기를 실행할 수 없다」; vitest가 결과 파일 없이 죽는다 → 안내 + 다시 돌릴 명령; 리베이스로 `cso_commit`이 조상이 아니다 → 전체 `/cso` 안내. 셋 다 계획이 든다.
- 되돌리기: PR revert 하나. 새 상태 키는 없어도 되는 값이라 옛 도구가 새 상태 파일을 읽는다(§4). 걸리는 시간: 머지 뒤 revert 1회.
- **Finding A-1.** `verify.mjs`가 만드는 실행별 임시 폴더는 실패·예외에서도 지워야 한다. 계획은 「끝나면 그 폴더를 지운다」만 말한다. → `finally`에서 지운다고 적는다(DAT #53, Mechanical P1).
- 새 엔지니어에게 명백하게: 모듈 이름이 하는 일을 말하고(변경 집합·검사·전이), 상수 위 정책 주석이 이유를 든다. 플랫폼: lib가 2단계·F10·F71의 바닥.

**Section 2: Error & Rescue Map.**

```
  METHOD/CODEPATH                 | WHAT CAN GO WRONG                          | 분류
  --------------------------------|--------------------------------------------|---------------------
  collectChangeSet                | git 없음 / 저장소 아님 / origin/main 없음   | spawn error · status≠0
                                  | 하위 폴더에서 실행                         | show-prefix ≠ ''
                                  | 출력 초과(1MiB 기본)                       | ENOBUFS → maxBuffer 64MiB
                                  | 알 수 없는 상태 글자(U 등)                 | parse
  runVerify / 실행기              | 실행기 없음(shell:true)                    | status 9009/127 + 빈 출력
                                  | tsc 실패 / biome 린트 실패 / 형식 차이     | status≠0
                                  | vitest 결과 파일 없음 · JSON 깨짐          | ENOENT · SyntaxError
                                  | 임시 폴더 못 만듦                          | EACCES 등
  runTypecheck({capture})         | game/temp 없음(logic-only)                 | 범위 보고(지금과 같다)
  csoBaseUsable                   | 키 없음 / 조상 아님 / git 오류             | 셋 다 「쓸 수 없음」
  qaRequired · decideTransition   | 새 키 없음(옛 상태 파일)                   | undefined → 「값 없음」
  skip-qa                         | 이미 game/** 변경 있음                     | 거부
  pass ts|lint                    | 없어진 명령                                | 거부 + 안내
  status                          | git 저장소가 아닌 폴더                     | measurable:false, 죽지 않음

  EXCEPTION/CASE                  | RESCUED? | RESCUE ACTION                         | USER SEES
  --------------------------------|----------|---------------------------------------|-------------------------------
  git 없음·저장소 아님·ref 없음    | Y        | measurable:false → 모든 검사 적용     | 원인별 처방 한 줄
  하위 폴더                       | Y        | measurable:false                      | 「저장소 루트에서 실행」
  출력 초과                       | Y        | maxBuffer 64MiB                       | 없음(정상 동작)
  알 수 없는 상태 글자             | Y        | measurable:false                      | 처방 한 줄
  실행기 없음                     | Y        | 실패로 셈                             | 「실행기 X를 실행할 수 없다」
  tsc/biome/vitest 실패           | Y        | 셋 다 돌린 뒤 요약+상세 40줄          | 실패한 검사와 다시 돌릴 명령
  vitest 결과 없음·JSON 깨짐       | Y(A-2)   | 「결과 없이 끝났다」 + 명령 안내       | 안내 한 줄 (JSON 깨짐도 같은 길)
  임시 폴더 못 만듦               | Y        | 실패로 셈, finally로 정리             | 오류 메시지 그대로
  cso_commit 쓸 수 없음           | Y        | 전체 /cso 안내                        | 「다음 /cso: 전체 (이유)」
  옛 상태 파일                    | Y        | 없는 키 = 값 없음                      | 「QA 문서 생략: 없음」 등
  skip-qa 거부·pass ts 거부        | Y        | 거부 + 다음 명령                       | 안내
  status 비-git                   | Y        | 죽지 않고 처방                         | 처방
```

- 포괄 예외(`catch (e)` 뒤 삼킴)는 두지 않는다. 각 실행기 실패는 「어느 검사가, 어떤 출력으로」를 남긴다.
- **Finding A-2 (GAP).** vitest 결과 파일이 있는데 JSON이 깨진 경우(중간에 죽음)는 계획의 「결과 없이 끝났다」 길에 들어가야 한다. → 「결과 파일이 없거나 JSON으로 읽히지 않으면」으로 넓힌다(DAT #53).

**Section 3: Security & Threat Model.** 새 네트워크 입구·새 파일 권한·새 의존성 없음. 셸을 거치는 호출은 `pnpm`(`shell: true`) 하나이고 인자는 고정 문자열 + `os.tmpdir()` 아래 임시 경로(따옴표로 감싼다)뿐이라 사용자 문자열이 셸에 닿지 않는다(`skip-qa` 사유는 JSON으로 상태 파일에만 쓴다, `canon`의 슬러그·제목은 지금처럼 검증한다). git은 `shell` 없이 인자 배열로 띄운다. 비밀값은 코드 리뷰가 본다(W6, C-2-3 조건). `/cso` 적용 경로를 좁히는 것 자체가 위협 모델의 변경이지만 조건(F61·F109)이 주석과 백로그에 걸린다. **No issues found** — 살펴본 것: 셸 인자, 상태 파일 쓰기, 경로 비교의 대소문자, 임시 파일 자리.

**Section 4: Data Flow & Interaction Edge Cases.**

```
  git 출력 ─▶ 파싱(-z, --no-renames, A|M|D|T) ─▶ 상태 파일 제외 ─▶ 경로 맞추기(또는 pathspec) ─▶ {applies, matches, rule}
     │nil: git 없음 → measurable:false      │빈 값: 0건 → 전부 해당 없음           │오류: U 등 → measurable:false
  실행기 셋 ─▶ {status, summary, details, durationMs} ─▶ ok ─▶ 기록용 값 셋 ─▶ (pass) decideTransition
     │nil: 실행기 없음 → 실패                │빈 값: vitest 0 테스트 → 통과(파일 n개 0)│오류: 결과 없음/JSON 깨짐 → 실패
```

- 공백·한글 파일명(-z), 이름 바꾸기(삭제+추가), 삭제된 `.meta`(META_PATHS 적용 → 누락 검사는 지금 함수), 분리된 HEAD(merge-base는 돈다), HEAD가 `origin/main`과 같음(변경 집합 0건 → 생략 유효) — 전부 든다.
- 비동기 순서: 없다. 모든 spawn은 `spawnSync`다. 원래 폴더와 worktree에서 동시에 돌 때 부딪치는 것은 vitest 결과 파일뿐이고 실행별 임시 폴더로 푼다.
- 상호작용: `pass review`를 두 번 치면 두 번째는 phase가 바뀌어 `requirePhase`가 막는다. `verify` 중 Ctrl-C → 임시 폴더는 `finally`가 못 지운다(프로세스 종료) — OS 임시 폴더라 남아도 해가 없다. **No unhandled edge case** beyond A-2.

**Section 5: Code Quality Review.**
- 구조: 새 모듈이 지금 패턴(`typecheck.mjs`의 「한 벌 코드를 CLI와 게이트가 같이 쓴다」)을 따른다. 이름은 하는 일을 말한다.
- **Finding Q-1 (중복).** `workflow.mjs:358 git()`과 `change-set.mjs`가 각자 `spawnSync("git", …)`을 갖게 된다. → git 띄우기는 `change-set.mjs`의 `git(root, args)` 하나로 두고(`maxBuffer` 64MiB 포함) `workflow.mjs`가 그것을 import한다(DAT #54, Mechanical P4).
- **Finding Q-2 (복잡도).** `status`는 적용 판정 표·QA 생략·`cso_commit` 줄·갈라진 지점을 찍어 분기가 5를 넘는다. → 줄을 만드는 순수 함수 `formatGateLines(gates, changeSet, state)`를 `change-set.mjs`에 두고 `status`와 `start-verification` 성공 출력이 같은 함수를 쓴다. 단위 테스트는 문자열로 고정한다(DAT #54, Mechanical P5).
- 과잉 설계 없음(환경변수 실행기 교체는 기각됐다). 부족한 방어: 없음(닫힌 쪽으로 틀린다).

**Section 6: Test Review.**

```
  새 것                         | 테스트 종류 | 계획에 있나 | 정상 / 실패 / 경계
  ------------------------------|-------------|-------------|----------------------------------------------
  collectChangeSet              | 단위(임시 저장소) | W1    | 수정·추가·삭제·T / git 없음·하위 폴더·U / 공백·한글·상태 파일 제외
  applicableGates · 경로 경계    | 단위        | W1·C-4-2    | 대표 여섯 / — / toolsmith·game/package.json·.Claude(pathspec이면 git에 맡김)
  csoBaseUsable                 | 단위(임시 저장소) | W2    | 조상 / 키 없음 / 리베이스로 조상 아님
  runVerify                     | 단위(시험용 실행기) | W2  | 전부 성공 / 일부·전부 실패·실행기 없음·결과 없음·JSON 깨짐(A-2) / 시간 필드·수 넷
  decideTransition              | 단위        | W2          | 통과→전이 / 통합 검사 실패·QA·정본 막힘 / needsQa·needsVerify 순서
  qaRequired                    | 단위        | W2          | 판정표 네 줄
  approvePrDecision             | 단위        | W3          | 다섯 갈래(tsStatus≠0 포함)
  명령(E2E, 가짜 pnpm)           | 통합        | W2·W3·W5    | pass review 전이 / WF_SHIM_FAIL / start-verification 성공·실패 / skip-qa 거부 / pass ts 거부 / approve-pr pr-ready
  파일 내용 고정                 | 단위        | W1·W4       | .gitignore 줄 · JSON import 없음 · child_process·worker_threads 없음 · lint-staged mjs · 훅 상수 동일 · 절차 문서 글자 수(F95)
  formatGateLines               | 단위        | Q-2         | 문자열 고정
```

- 2시 금요일 테스트: §7의 「일부러 넣은 실패 셋」(타입·린트·테스트 하나씩)으로 `start-verification`이 막히는 것을 손으로 본다 — 시험용 실행기만으로는 실패 모양이 짐작이기 때문이다(계획이 이미 든다).
- 적대적 QA: `tests/logic/` 폴더를 지워도 통합 검사가 꺼지지 않는다(예외 없음), 판정 파일 하나만 지우면 막힌다, 가짜 `pnpm`이 저장소 밖에 있어 `/cso` 판정을 오염시키지 않는다.
- 혼돈: vitest를 중간에 죽이면 결과 파일 없음·JSON 깨짐 길(A-2).
- 피라미드: 단위 다수(lib 순수 함수) · 통합 소수(가짜 `pnpm` E2E) · E2E 없음(머지 뒤 손 확인) — 올바른 방향.
- 흔들림 위험: 임시 저장소는 git 설치·Windows 줄 끝(`core.autocrlf=false`)·`GIT_CEILING_DIRECTORIES`로 묶는다. 시간 의존 없음. 스위트 시간은 `git: false` 길과 §10 재측정으로 관리.
- LLM/프롬프트 변경: `CLAUDE.md`·절차 문서는 AI 지시문이지만 이 저장소에 eval 스위트는 없다(F71이 준수율을 관찰한다). 해당 없음.

**Section 7: Performance Review.** DB·네트워크 없음. git 호출 2회(pathspec이면 8회, 0.5초 안), 통합 검사 약 7초(§10 실측 — vitest 3.6 · tsc 2.7 · biome 0.5), `status`마다 변경 집합 재계산 0.1초쯤. 메모리는 git 출력 최대 64MiB. 캐시 불필요(판정을 저장하지 않는 것이 결정이다). **No issues found** — 살펴본 것: 호출 횟수, 출력 크기, 임시 파일 I/O.

**Section 8: Observability & Debuggability Review.** 로그는 명령 출력이 전부이고 세션 기록에 남는다: 적용 판정 표(어느 파일 때문에·어느 경로가 없어서), 검사마다 요약 한 줄 + 시간(E1), 실패 상세 40줄 + 다시 돌릴 명령, 전이 줄의 `HEAD` 해시(C-3-1), `status`의 갈라진 지점·항목 수·`cso_commit`·다음 `/cso` 명령(E3). 지표는 §6의 측정 넷+넷. 3주 뒤 재구성: 세션 기록 + 상태 파일 + git. 운영 대응서: `wf-tool-recovery.md`(W6). 관리 도구: 없음(필요 없음). **No gaps found** — 운영자가 한 사람이고 모든 신호가 터미널에 찍힌다.

**Section 9: Deployment & Rollout Review.** 배포는 main 머지다. 마이그레이션: 상태 파일 새 키 둘은 없어도 되는 값 — 옛 도구가 새 파일을, 새 도구가 옛 파일을 읽는다(§4, 테스트 W2). 기능 플래그: 없음(환경변수 교체는 기각). 순서: 이 브랜치의 검증이 새 도구로 처음 돈다(§1) → 머지 → 원래 폴더가 main을 받으면 다음 `wf start`부터 새 도구. 되돌리기: PR revert. 위험 창: 머지 직후 원래 폴더에 옛 `workflow.mjs`가 남아 있는 동안은 둘이 공존하지만 상태 파일 형식이 호환이라 문제없다. 머지 뒤 확인: `pnpm wf status`(원래 폴더), 다음 슬라이스의 `wf start`(§7). 스테이징: 임시 저장소 E2E가 그 역할. **No new risks** — §7·§9가 이미 든다.

**Section 10: Long-Term Trajectory Review.** 부채: 가짜 `pnpm`(테스트 전용 코드, W5), `CSO_PATHS` 목록 낡음(주석·테스트·F61·F109로 묶음), 상태 파일 정책 미정(F10 — 2단계보다 먼저). 경로 의존: lib 분리는 이후 변경을 쉽게 한다. 지식 집중: 복구 문서 + 상수 위 정책 주석 + 이 계획의 결정 기록. 되돌리기 점수 4/5(revert 하나, 상태 키는 없어도 되는 값). 생태계: `.mjs` + `@ts-check` + JSDoc은 `typecheck.mjs`와 같은 결. 1년 뒤 명백한가: 「검사는 변경 집합으로 계산한다」와 「판정 코드는 lib 한 벌」 두 문장으로 설명된다. 다음 단계: 2단계(지문)·F10·F71 — 전부 lib 위에 선다. 회고: 받아들인 cherry-pick 셋(E1·E3·E6)은 전부 출력 한 줄이라 아키텍처에 영향 없음; 철회한 E2는 옳은 철회(절차 순서상 소음); 기각한 E7은 하중을 받지 않는다.

**Section 11: Design & UX Review.** SKIPPED (no UI scope).

#### 닫기 — 남은 TODO 선택

바깥 목소리(Outside Voice)는 `/autoplan`의 양쪽 목소리가 대신했다(위, Codex unavailable). 남은 TODO 제안: 없음 — 미룬 것(E4)은 W7 F71 행으로, 새 백로그 일곱은 계획 W7이 이미 든다. 저장소에 `TODOS.md`가 없고 백로그 셋이 그 자리다.

#### 필수 산출물 (Required Outputs)

**NOT in scope.**
- 미룸(백로그로): E4 `status`에 「다음에 칠 명령」(F71 결과 뒤). 상태 파일 추적 정책(F10, 2단계보다 먼저). 절차 문서 10,000자 이하(W7 새 항목). 2단계 지문 기록(§6 약속 넷). 비밀값 커밋 훅(W7 새 항목). `wf start` 초기화 문제·`approve-plan` 파일명 문제(W7 새 항목).
- 기각(백로그 없음): E5(중복), E7(fetch 없이 못 잰다), 상태 파일 키 셋 추가(C-3-1 대안 — §4 「새 키는 둘」), `verification.md`에 외부 기여 조건 문장(글자 수), 비용 기준의 2단계 조건(측정이 더 어렵다), 테스트를 `pass review`로 바꾸기(확인 내용이 달라진다), 2단계를 한 PR로(C안), E2 미커밋 경고(철회).

**What already exists.** 0B 표(위)가 하위 문제 열둘을 지금 코드에 대응시켰다. 다시 짓는 것은 없다.

**Dream state delta.** 0C(위). 이 계획 뒤 남는 간격: 판단 검사의 입력 기록(2단계), 절차 문서 분량, 상태 파일 정책. 셋 다 백로그 항목과 여는 조건이 있다.

**Error & Rescue Registry.** Section 2의 두 표(위). GAP 1건(A-2, vitest JSON 깨짐)은 승인 항목으로 닫았다. 남은 CRITICAL GAP 0.

**Failure Modes Registry.**

```
  CODEPATH               | FAILURE MODE                     | RESCUED? | TEST? | USER SEES?             | LOGGED?
  -----------------------|----------------------------------|----------|-------|------------------------|--------
  collectChangeSet       | git/ref/루트 없음 · U 글자        | Y        | Y     | 처방 한 줄              | 출력
  collectChangeSet       | 출력 초과                        | Y        | N(*)  | 없음                   | —
  applicableGates        | 경로 목록이 낡음                  | 부분     | Y(여섯 줄) | status의 matches    | 출력
  runVerify              | 실행기 없음 9009/127             | Y        | Y     | 안내                   | 출력
  runVerify              | 검사 실패                        | Y        | Y     | 요약+상세 40줄+명령     | 출력
  runVerify              | vitest 결과 없음/JSON 깨짐        | Y        | Y     | 안내                   | 출력
  runVerify              | 임시 폴더 못 만듦                 | Y        | N(*)  | 오류                   | 출력
  decideTransition       | 옛 상태 파일(키 없음)             | Y        | Y     | 「값 없음」 기준 안내   | 출력
  csoBaseUsable          | 리베이스로 조상 아님              | Y        | Y     | 「전체 /cso」          | 출력
  pass(write:false)      | 형식 차이                        | Y        | Y     | 「verify로 고치고 커밋」| 출력
  status                 | 비-git 폴더                      | Y        | Y     | 처방                   | 출력
  가짜 pnpm(테스트)       | PATH 키 대소문자 · =로 토막       | Y        | Y     | —                      | —
  (*) 출력 초과·임시 폴더 실패는 재현이 어려워 테스트를 두지 않는다 — RESCUED=Y, USER SEES≠Silent라 CRITICAL GAP 아님.
```

CRITICAL GAP(RESCUED=N, TEST=N, Silent) 0건.

**Scope Expansion Decisions.** Accepted: E1·E3·E6 + 사양 리뷰 41건 + 독립 리뷰 반영 13건(A-1·A-2·Q-1·Q-2 포함). Deferred: E4. Skipped: E5·E7. Withdrawn: E2.

**Diagrams.** (1) 시스템 구조 — Section 1. (2) 데이터 흐름(그림자 경로) — Section 4. (3) 상태 기계:

```
  planning → qa-setup → implementation → verification → user-verification → pr-ready → done
                 │skip-qa(사유)            │start-verification(통합 검사 GREEN)      │approve-pr
                 │                         │  verification 안: [cso_done?] [code_review_clean] + 기록용 값 셋
                 │                         │  pass cso/review · verify · invalidate(표시 지움, cso_commit·기록 값 유지)
                 │                         └─ pass(둘 다 참) → needsQa → needsVerify → user-verification
                 └ qa_skip_reason은 phase와 무관하게 남고, 유효성은 매번 변경 집합으로 판정
  rework: user-verification → implementation (표시 지움)
```

(4) 오류 흐름 — Section 2 둘째 표. (5) 배포 순서 — 이 브랜치 검증(새 도구로 첫 실행) → Draft PR → 사용자 검증 → `.meta` 0개 확인 → `PR 승인` → squash merge → 원래 폴더 `pnpm wf status` → 다음 슬라이스 `wf start`. (6) 되돌리기 — 머지 뒤 깨짐 발견 → `wf-tool-recovery.md`: 첫째 `wf start` 없이 브랜치 만들어 고친다 / 둘째 급하면 깨지기 전 커밋을 임시 worktree로 꺼내 `CLAUDE_PROJECT_DIR`로 쓴다(사용자 지시 때만) / 셋째 PR revert.

**Stale Diagram Audit.** 이 계획이 건드리는 파일에 ASCII 다이어그램: `workflow.mjs` 머리말의 phase 흐름 주석(있다면 `pass ts|lint` 줄을 지운다 — W4 주석 갱신에 포함), `docs/development/workflow/README.md`의 표(W6이 `verification` 행을 고친다), `CLAUDE.md` 9단계 뼈대(W6). 그 밖에 없음.

#### Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above. Run with Claude Code; checkbox as you ship. (jq가 없어 `/autoplan` 집계용 JSONL은 쓰지 않았다 — `scoop install jq` 뒤에 다시 돌리면 집계된다.)

- [ ] **T1 (P1, human: ~2h / CC: ~10min)** — `.claude/lib/verify.mjs` — 임시 폴더를 `finally`에서 지우고, vitest 결과 파일이 없거나 JSON이 깨지면 「결과 없이 끝났다」 길로 보낸다
  - Surfaced by: Section 1 A-1 · Section 2 A-2
  - Files: `.claude/lib/verify.mjs`, `tests/logic/WorkflowDiet.test.ts`
  - Verify: 시험용 실행기로 결과 파일 없음·깨진 JSON 두 경우가 같은 안내를 내는 단위 테스트
- [ ] **T2 (P2, human: ~1h / CC: ~5min)** — `.claude/lib/change-set.mjs` — git 띄우기 `git(root, args)` 한 벌(`maxBuffer` 64MiB)과 `formatGateLines()` 순수 함수를 두고 `workflow.mjs`의 `git()`·`status`·`start-verification`이 쓴다
  - Surfaced by: Section 5 Q-1 · Q-2
  - Files: `.claude/lib/change-set.mjs`, `.claude/workflow.mjs`, `tests/logic/WorkflowDiet.test.ts`
  - Verify: `workflow.mjs`에 `spawnSync("git"`이 남지 않는다(grep); `formatGateLines` 문자열 고정 테스트
- [ ] **T3 (P1, human: ~1h / CC: ~5min)** — `.claude/lib/change-set.mjs` — `CSO_PATHS`를 `.claude` 추적 자리 넷으로 좁히고 주석에 F61·F109·`.claude/commands/**` 조건 셋을 적는다
  - Surfaced by: Dual Voices C-3-2 · C-2-3
  - Files: `.claude/lib/change-set.mjs`, `docs/development/backlog.md`(F109 행)
  - Verify: 대표 변경 집합 여섯 줄 테스트(「도구만」 줄은 `.claude/workflow.mjs`)
- [ ] **T4 (P2, human: ~30min / CC: ~3min)** — `.claude/workflow.mjs` — `pass review`·`canon-done`·`canon-skip`·`user-verification` 전이 출력에 `HEAD` 짧은 해시
  - Surfaced by: Dual Voices C-3-1
  - Files: `.claude/workflow.mjs`, `tests/logic/ClaudeMdSplit.test.ts`
  - Verify: 임시 저장소 E2E 출력에 `(HEAD <7자>)`가 있는지
- [ ] **T5 (P1, human: ~1h / CC: ~10min)** — W1 착수 전 — git pathspec 시험: 대표 변경 집합 여섯을 `:(glob)`·`:(glob,icase)`로 판정해 표와 같은지 본 뒤 맞추기 코드를 둘지 정한다
  - Surfaced by: Dual Voices C-4-2
  - Files: to be determined (`.claude/lib/change-set.mjs` 또는 없음)
  - Verify: 여섯 줄 판정 표가 그대로 나온다; 결과를 계획 문서(W1)에 한 줄 적는다
- [ ] **T6 (P2, human: ~2h / CC: ~15min)** — 문서 — §6에 측정 넷(명령 수·출력 글자 수·도구 줄 수와 테스트 시간·계획 비용)과 셋째 값의 성격 한 문장, 137회의 슬라이스당 단위; `ops-skill-routing.md` `/cso` 행에 옵션·대체 한 줄; F10·F71·F109 행
  - Surfaced by: Dual Voices C-1-1 · C-1-2 · C-3-1 · C-3-3 · C-3-5 · 작은 것 셋
  - Files: 계획 문서(sessions/로 옮기며), `docs/development/spec/ops-skill-routing.md`, 백로그 셋
  - Verify: `pnpm wf check-links`; 계획 승인 뒤 기준선 수치가 2단계 백로그 항목에 적혀 있다
- [ ] **T7 (P2, human: ~30min / CC: ~3min)** — `.claude/lib/verify.mjs` — `pass`(`write: false`)의 형식 차이를 실패로 세고 「`verify`로 고치고 커밋」 안내
  - Surfaced by: Dual Voices 작은 것 (i)
  - Files: `.claude/lib/verify.mjs`, `.claude/workflow.mjs`
  - Verify: 시험용 biome 실행기가 「형식 차이」를 낼 때 안내 문자열
- _No new tasks from Section 3, 7, 8, 9, 10._ (사양 리뷰 41건과 Step 0 확장은 승인 항목으로 계획 본문에 들어가 W1~W7의 일부가 됐다 — 따로 과제로 세지 않는다.)

#### Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION (/autoplan 규칙)         |
  | System Audit         | 문서만 바뀐 브랜치 · TODO 0 · 반복 문제 셋 반영 |
  | Step 0               | 접근 결정 없음 · 확장 Add 3/Defer 1/Skip 2/철회 1 · 사양 리뷰 3회 41건 반영 |
  | Section 1  (Arch)    | 1 issues found (A-1)                          |
  | Section 2  (Errors)  | 13 error paths mapped, 1 GAPS (A-2, 닫음)     |
  | Section 3  (Security)| 0 issues found, 0 High severity               |
  | Section 4  (Data/UX) | 7 edge cases mapped, 0 unhandled              |
  | Section 5  (Quality) | 2 issues found (Q-1·Q-2)                      |
  | Section 6  (Tests)   | Diagram produced, 0 gaps (A-2 테스트 포함)     |
  | Section 7  (Perf)    | 0 issues found                                |
  | Section 8  (Observ)  | 0 gaps found                                  |
  | Section 9  (Deploy)  | 0 risks flagged (§7·§9가 든다)                |
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 3             |
  | Section 11 (Design)  | SKIPPED (no UI scope)                         |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (6 deferred, 9 rejected)              |
  | What already exists  | written (0B)                                  |
  | Dream state delta    | written (0C)                                  |
  | Error/rescue registry| 13 rows, 0 CRITICAL GAPS                      |
  | Failure modes        | 12 total, 0 CRITICAL GAPS                     |
  | TODOS.md updates     | 0 items proposed (백로그 항목은 W7이 든다)      |
  | Scope proposals      | 7 proposed, 4 accepted(1 철회 → 3) (SEL)       |
  | CEO plan             | written (~/.gstack/.../ceo-plans/2026-10-06-workflow-diet.md) |
  | Outside voice        | codex: unavailable(not installed); Claude subagent: completed |
  | Lake Score           | N/A (coverage-scored questions 0)             |
  | Diagrams produced    | 6 (architecture, data flow, state, error, deploy, rollback) |
  | Stale diagrams found | 0 (W4·W6이 고치는 셋은 계획에 든다)             |
  | Unresolved decisions | 0 (Taste 4건은 최종 승인에서 사용자가 본다)     |
  +====================================================================+
```

**Unresolved Decisions.** 없음. 사용자에게 보일 Taste 4건: 통합 검사 실패 뒤 안내(K2, DAT #13), E2 철회(DAT #43), 2단계 측정·조건(DAT #45), pathspec 시험(DAT #51).

### DX 단계 (Phase 2.5) — DX POLISH

**실행 조건.** 모드는 `/autoplan` 규칙(DX POLISH: 범위는 그대로, 닿는 자리마다 빈틈을 메운다). 제품 유형: **CLI 도구**(`pnpm wf <명령>`, 상태 파일, 절차 문서 배달)가 1차이고, 2차로 「AI가 그대로 실행하는 지시문」(`CLAUDE.md`·`docs/development/workflow/*.md`)이다. Claude Code 스킬(SKILL.md)은 아니므로 부록 체크리스트는 돌리지 않는다. Codex 미설치 → 바깥 목소리 없음, Claude DX 독립 리뷰어만.

**시스템 점검(DX).** 지금 `pnpm wf`를 인자 없이 치면 명령 이름 열아홉만 한 줄로 찍는다(설명 없음). 없는 명령도 같은 줄을 찍는다(계획 W3이 「알 수 없는 명령: X」를 더한다). `pnpm wf status`는 상태 파일 JSON을 그대로 찍는다(계획 W3이 적용 판정 줄을 더한다). 절차 문서 일곱은 28,779바이트(배달되는 여섯은 13,575자). README §7·§8이 시작 가이드와 스크립트를 든다. 설계 문서·인계 문서에 리뷰어를 겨냥한 지시문 없음.

**페르소나 (0A, 자동 결정 P6).**

```
TARGET DEVELOPER PERSONA
========================
Who:       Claude Code 세션(AI 에이전트) — 이 저장소에서 `pnpm wf`를 치는 주 사용자. 사람은 한 명(저장소 주인)이고
           세 확인 지점(계획 승인·PR 승인·리워크)만 직접 친다. 장비를 옮겨 다니므로 「새 장비의 새 세션」이 곧 첫 사용자다.
Context:   슬라이스마다 `CLAUDE.md` 9단계 뼈대를 따라 `wf start`부터 `pr-done`까지 친다. phase 전이가 절차 문서를 배달한다.
Tolerance: 명령 하나가 막히면 안내 한 줄로 다음 명령을 알아야 한다. 안내가 없으면 절차 문서를 다시 읽거나(수천 자) 추측해서 친다.
           추측해서 친 명령이 §6의 「따로 친 기계 검사 명령」이다.
Expects:   `pnpm wf status`가 지금 어디인지와 무엇이 걸리는지를 말해 줄 것, 막힌 명령이 다음 명령을 말해 줄 것,
           새 장비에서 `pnpm install` + Cocos 한 번 열기로 돌 것.
```

대안으로 본 페르소나: 사람 개발자(저장소 주인, 수동으로 `pnpm wf`를 친다 — 실제로는 세 명령만), 외부 기여자(지금 없음, F109 조건). AI 에이전트를 1차로 둔 이유는 `/autoplan` 규칙(AI가 주 사용자면 DX 범위)과 요구사항 문서 §3.1(검증 명령을 치는 쪽이 AI)이다.

**공감 서사 (0B).** 나는 다른 장비에서 막 열린 Claude Code 세션이다. 인계 문서가 시키는 대로 `git fetch`, `pnpm install`, Cocos로 프로젝트를 한 번 연 뒤 `pnpm wf status`를 친다. 지금은 JSON 덩어리가 나온다 — phase가 `planning`인 것은 알겠는데 이 슬라이스에 어떤 검사가 걸리는지는 모른다(관찰). 계획을 승인받고 `ready-impl`을 치니 QA 문서가 없다며 막힌다. 도구 슬라이스라 씬도 프리팹도 없는데 QA 문서의 씬 절을 「없다」로 채워야 한다(관찰, 현재 절차). 구현을 끝내고 `start-verification`을 치면 전체 테스트가 돌고 `verification.md` 3,530자가 배달된다. 거기 적힌 대로 `/cso`를 하고 `pass cso`, `pnpm typecheck`, `pass ts`, `pnpm check --write`, `pass lint`를 차례로 친다(관찰: 명령 넷). 리뷰어가 고치라고 한 것을 고치면 `invalidate`가 넷을 지우고 처음부터 다시다. 계획대로 바뀌면: `status`가 「meta: 해당 없음 / fullTypecheck: 해당 없음 / cso: 적용(.claude/workflow.mjs 외 n개)」를 찍고, `start-verification`이 셋을 한 번에 돌려 요약 셋과 시간을 찍고, 검증에서 내가 칠 것은 `/cso`(적용 시)·`pass cso`·커밋·리뷰·`pass review`뿐이다. 막히면 어느 검사가 왜 적용됐는지와 다음 명령, 그리고 「절차: `pnpm wf steps verification`」 한 줄이 나온다(예측 — 계획 W2·W3). 내가 헷갈릴 자리는 둘이라고 예측한다: `verify`와 `pass review`의 차이, 그리고 리뷰 뒤 코드를 고쳤을 때 `invalidate`를 쳐야 하는가.

**경쟁 DX 기준 (0C).** 시계: 「새 장비의 새 세션이 저장소를 받은 뒤 → `pnpm wf status`가 이 슬라이스에 걸리는 검사와 다음 명령을 보여 줄 때까지」. 비교 대상은 같은 종류(변경 집합으로 검사를 고르는 도구)의 첫 결과까지다. 검색은 CEO 단계의 WebSearch 결과를 다시 쓴다(Aside 없음).

| Tool | Start → result | Time + evidence type | DX choice | Source |
|---|---|---|---|---|
| Nx `affected` | 설치 → `nx affected -t test`가 영향 받은 프로젝트를 찍음 | 수 분(설정 파일 생성 포함), reported | 의존 그래프로 계산, `--base`를 사용자가 준다 | nx.dev 모노레포 CI 모범 사례 |
| GitHub Actions `paths` 필터 | 워크플로 YAML에 경로 → PR이 돌 때 보임 | 첫 PR까지 수 분, reported | 선언적, 공유 코드에서 깨짐, 통과 보고용 gate job 필요 | codewithkarani 글, GitHub 토론 #177835 |
| lint-staged (이 저장소에 있음) | `git commit` → 걸린 파일만 biome | 즉시, observed | 스테이지 파일 기준, 설정 한 줄 | `package.json` |
| **이 계획의 `pnpm wf`** | `pnpm install` + Cocos 한 번 → `pnpm wf status` | 약 1분(설치 제외), estimated — `status` 자체는 0.2초 observed | 변경 집합을 매번 계산, 저장하지 않음, 못 구하면 전부 적용 | 계획 W1·W3 |

시간은 경계가 달라 숫자로 견주지 않고 DX 선택만 견준다. 이 계획은 `--base`를 사용자가 주지 않아도 되고(merge-base), 통과 보고용 별도 장치가 없으며(사람 확인 지점이 받는다), 공유 코드 문제는 전체 테스트·리뷰를 경로와 무관하게 늘 돌려 피한다. **목표 등급: Champion(< 2분)** — 자동 결정(P1): 지금 궤적이 이미 그 안이고(`status` 한 번), 1단계는 그 출력에 판정을 더할 뿐이다. 설치(`pnpm install`, Cocos 열기)는 시계 밖이다 — 이 슬라이스가 바꾸지 않는다.

**마법의 순간 (0D, 자동 결정 P5).** `pnpm wf status`를 친 순간 「이 슬라이스에 어느 검사가 걸리고, 어느 파일 때문인지, 다음 `/cso`는 어디부터인지」가 한 화면에 보이는 것. 전달 수단은 계획 W3의 `status` 출력(+ E3·`formatGateLines`)이다 — 새 장치 없이 가장 싼 수단이고 `start-verification` 성공 출력이 같은 표를 다시 찍는다. 대안(별도 `pnpm wf gates` 명령, Draft PR 본문에 표 붙이기)은 명령 수를 늘리거나 범위 밖이라 기각.

**모드 (0E).** DX POLISH — `/autoplan` 규칙, 기존 제품의 개선. 범위 추가 없음.

**개발자 여정 (0F).** 실제 문서·명령을 따라간 것이고, 마찰은 증거를 들었다.

```
STAGE           | DEVELOPER DOES                                   | FRICTION POINTS                                              | STATUS
----------------|--------------------------------------------------|--------------------------------------------------------------|--------
1. Discover     | CLAUDE.md 「Workflow」 절·README §8을 읽는다       | 명령 표가 pass ts·pass lint를 든다(계획 뒤 틀린 안내) — W6이 고친다 | fixed(계획)
2. Install      | pnpm install, Cocos로 한 번 열기(game/temp)        | Cocos를 안 열면 vitest가 대부분 못 불러온다 — W2가 안내 문구, W7 백로그 | ok(안내)/deferred(근본)
3. Hello World  | pnpm wf status                                    | 지금은 JSON만 — W3이 적용 판정·갈라진 지점·다음 /cso를 찍는다       | fixed(계획)
4. Real Usage   | wf start → … → start-verification → pass review   | 검증 명령 넷 → 하나(W2); QA 씬 절 강제 → skip-qa(W2)              | fixed(계획)
5. Debug        | 막힌 명령의 안내를 읽는다                          | 지금 안내는 명령마다 다르고 절차 문서로 가는 길이 없다 — W2 「절차: steps …」 한 줄; 실행기 없음 9009/127; 결과 없음·JSON 깨짐 | fixed(계획)
6. Upgrade      | 머지 뒤 원래 폴더에서 main을 받는다                 | 옛 상태 파일 호환(§4), 깨졌을 때 wf-tool-recovery.md(W6), 메모리 갱신(§4) | fixed(계획)
```

남은 마찰(이 슬라이스 범위 밖, 아래 NOT in scope): `pnpm wf`를 인자 없이 쳤을 때 명령 설명이 없다(한 줄 설명을 붙이면 `CLAUDE.md` 명령 표 의존이 준다 — F96·F71 영역), `approve-plan`의 파일명 의존(W7 백로그), Cocos 없는 장비(W7 백로그).

**첫 사용자 혼란 보고 (0G).** 새 장비의 새 세션이 인계 문서 §6대로 시작한다고 가정한다.

```
FIRST-TIME DEVELOPER REPORT
============================
Persona: 새 장비의 Claude Code 세션
Attempting: feat/workflow-diet 이어받기 → 다음 슬라이스 하나 돌리기

CONFUSION LOG:
T+0:00  git fetch · pnpm install. `pnpm wf status` → 상태 파일 JSON. phase는 알겠는데 걸리는 검사는 모른다. (관찰, 지금)
        → 계획 뒤: 적용 판정 줄 셋 + 갈라진 지점 + QA 생략 + 다음 /cso. (W3·E3)
T+0:30  Cocos를 안 열고 `pnpm wf start-verification` → 테스트가 tsconfig.cocos.json 없음으로 우수수 실패. 왜인지 출력에 없다. (관찰, 지금)
        → 계획 뒤: 「Cocos가 만드는 파일이 없어 … 한 번 열어라」 한 줄. (W2) 근본 해결은 W7 백로그.
T+1:00  검증에서 `pnpm wf verify`와 `pnpm wf pass review`가 뭐가 다른지 헷갈린다. (예측)
        → `verify`는 「넘기지 않고 지금 결과만」, `pass`는 넘기기 직전 스스로 돌린다 — verification.md 첫머리가 말한다. (W6)
        → 남은 위험: `implementation`에서 `verify`를 치면 「start-verification을 쓴다」 안내. (W2) 됐다.
T+2:00  리뷰 뒤 코드를 고쳤다. `invalidate`를 쳐야 하나, 바로 `pass review`를 다시 쳐도 되나. (예측)
        → 안내 문구가 「invalidate → 절차대로」로 통일됐고(사양 리뷰 K2), 잊어도 통합 검사는 다시 돈다. 됐다.
T+3:00  `pass cso`를 쳤는데 「표시할 것이 없다」며 거부. /cso가 왜 해당 없음인지 모른다. (예측)
        → 거부 문구에 적용 판정 줄(cso: 해당 없음 — 걸린 경로 없음)을 같이 찍는다. **이 보고에서 새로 받아들인 것** (DX-1).
```

혼란 로그에서 새로 결정한 것은 DX-1 하나다(아래 승인 블록). 나머지는 계획이 이미 든다.

#### DX 양쪽 목소리 (Dual Voices)

**Claude DX 독립 리뷰어(서브에이전트, `autoplan-dx-ZB1QAz/native-prompt.md` 449줄 전부 읽음, INPUT 해시 `56e976eb…` 일치).** 높음 1, 중간 8, 낮음 8. 요약: 검증 phase의 명령 수가 도구 슬라이스 9→5, 문서 슬라이스 9→3으로 준다. 안전 쪽 기본값(구할 수 없으면 전부 적용, 환경변수 교체 없음, 실행마다 임시 폴더, `status`와 `start-verification`이 같은 판정 표, 실패 꼬리의 `steps` 안내)은 좋다. **Codex: 미설치 → unavailable.** 지적 원문(판정은 다음 작업에서 — 아직 0D 판정 전):

| ID | 심각도 | 지적 요지 | 리뷰어의 제안 |
|---|---|---|---|
| DX-G1 | 중간 | `verify`가 `verification`에서만 돈다 — `implementation`에서 결과만 보고 싶을 때, `user-verification`에서 사소한 수정 뒤 통합 검사를 돌릴 명령이 없다(§6 막지 못하는 경우 첫째와 맞물림) | `verify`를 `implementation`·`verification`·`user-verification` 셋에서 받는다(전이 없는 명령이라 해가 없다). `implementation` 안내문은 지운다 |
| DX-G2 | 중간 | 새 클론·worktree의 첫 `start-verification`은 `tsconfig.cocos.json` 없음으로 반드시 실패. 처방이 「Cocos로 한 번 열어라」뿐 — worktree에서 어느 폴더를 여는지, 복사해도 되는지 없음 | 처방 두 길: 「`<작업 폴더>/game`을 Cocos로 연다」 또는 「다른 체크아웃의 `game/temp/tsconfig.cocos.json`을 같은 자리로 복사」. W7 백로그 항목에도 둘 다 |
| DX-G3 | 낮음 | `skip-qa`를 `implementation`에서 받지 않는 이유가 없다 | 받거나, 안 받는 이유를 W2에 한 줄 |
| DX-E1 | **높음** | 변경 집합이 미추적 `*.meta`(`.gitignore`가 일부러 무시하지 않음)를 포함해, 문서 슬라이스 중 Cocos를 열어 main의 빠진 `.meta`가 생기면 `meta: 적용`·`qa: 적용`이 되어 `approve-pr`이 막히고 `skip-qa` 사유가 뒤집힌다. §2.2의 기각 이유(「무관한 `.meta` 누락 때문에 막히지 않는다」)와 W1 정의가 어긋남. 지금 `check-meta`는 추적 자산의 형제 `.meta`가 추적되는지로 판정하므로(`workflow.mjs` 362~411) 미추적 `.meta`를 빼도 검사 결과는 같다 | `collectChangeSet`에서 미추적 `*.meta`를 뺀다(상태 파일과 같은 자리, 「Cocos가 만드는 파일이지 개발자의 변경이 아니다」). 대표 변경 집합 표에 「미추적 `.meta`만」 줄 추가 — 넷 다 해당 없음/생략 가능 |
| DX-E2 | 중간 | `pass review` 직전 검사 실패 처방이 둘로 갈린다 — 일반 「`invalidate` → 절차대로」 vs 형식 차이 「`verify`로 고치고 커밋한 뒤 다시」. biome이 고친 형식 차이가 「코드를 고쳤다」에 드는지 없다 | 「biome이 고친 형식 차이는 판단 검사를 다시 하지 않는다 — `invalidate` 없이 커밋하고 `pass review`만」을 `verification.md`와 `pass` 실패 문장에 명시, `pass` 실패 출력을 「형식 차이」/「그 밖」으로 분기 |
| DX-E3 | 중간 | 절차 순서 「`/cso` → `pass cso` → 커밋」이라 `cso_commit`이 늘 점검 내용보다 앞선 커밋 → 다음 `/cso --diff`가 매번 이미 본 부분까지 본다 | `verification.md` 순서를 「커밋 → `/cso` → `pass cso`」로(글자 수 변화 없음), 또는 `pass cso`가 작업 트리가 더러우면 「커밋 뒤에 치면 다음 점검 범위가 줄어든다」 한 줄 |
| DX-E4 | 낮음 | 이름의 결 — 기계 검사 가족은 `check-*`인데 새 명령은 `verify`; phase 이름 `verification`과 겹쳐 「verification으로 가라」로 읽힌다 | `check-all`로 바꾸거나, 그대로 두면 `status`의 명령 목록에 「전이 없음」 표시 |
| DX-E5 | 낮음 | 거부 문장이 의도와 어긋남 — `pass ts`·`pass lint` 거부 「통합 검사는 `verify`로」; `pass cso` 해당 없음 거부 「표시할 것이 없다」 | 「타입·린트는 통합 검사가 기록한다 — 표시할 것이 없다. 결과만 다시 보려면 `pnpm wf verify`」; `pass cso` 거부에 「`CSO_PATHS` 변경 없음 — `pnpm wf status`로 확인」 |
| DX-E6 | 낮음 | `makeRepo(opts)` 옵션 일곱의 기본값이 없다 | 한 줄: 「옵션 없이 부르면 `verification`, QA 문서 있음, 게임 변경 없음, `/cso` 해당 없음, `HEAD`는 `feat/<feature>`」 |
| DX-H1 | 중간 | 구할 수 없는 원인 다섯 가운데 처방이 둘뿐 | 저장소 아님 → 「저장소 루트에서 실행」, 출력 실패 → stderr 첫 줄 + 「`git status`로 확인」, `U` → 「충돌을 풀고 다시(`troubleshooting/workflow-state-cross-machine.md`)」. 테스트에 `U` 문장 |
| DX-H2 | 중간 | 실행기 못 찾음 조건 「9009·127이고 출력이 비면」 — `cmd.exe`·`sh`가 stderr에 메시지를 찍어 출력이 비지 않는다 | 「stdout이 비고 `status`가 9009·127」로 못 박고 안내에 stderr 첫 줄을 찍는다. 시험용 실행기도 stderr를 채운 모양 |
| DX-H3 | 낮음 | 실패 꼬리 「절차: `steps <phase>`」가 세 명령에만 — `ready-impl`·`skip-qa`·`approve-pr`은? vitest 재시도 명령은 실패 파일 경로를 붙이면 싸다(`testResults[].name`) | 세 명령에도 꼬리; `pnpm exec vitest run <파일>` |
| DX-H4 | 낮음 | `skip-qa` 거부 문장에 걸린 파일이 없다 | 「QA 문서가 필요하다: <걸린 파일>」 |
| DX-D1 | 중간 | 글자 수 여유 0 → 「위와 같다」 같은 참조형 축약이 생김(AI는 절을 건너뛰어 읽는다) | 덜어 낼 때는 문장을 통째로 지우거나 상한에 100자쯤 여유, 또는 10,000자 항목을 바로 다음 슬라이스로 |
| DX-D2 | 낮음 | 새 명령의 복사해 칠 예가 없다 | `qa-setup.md`에 `pnpm wf skip-qa "문서만 고친다 — game/** 변경 없음"`, `status` 예에 `다음 /cso: /cso --diff --base 2c41977` |
| DX-D3 | 낮음 | 적용 경로 정책의 사람용 입구 | `workflow/README.md`(배달되지 않음)에 「어느 검사가 언제 적용되는지는 `pnpm wf status`, 규칙은 `.claude/lib/change-set.mjs` 상수 주석이 정본」 한 줄 |
| DX-D4 | 낮음 | 메모리 수정 대상을 지금 적어 둔다 | 이미 아는 셋(커밋 워크플로우·워크플로우 그대로 따르기·`pass ts`는 진짜 게이트)을 §4에 |
| DX-X1 | 중간 | `skip-qa`를 되돌릴 길이 없다(상태 파일 직접 편집은 훅이 막음, 남는 길은 `wf start`뿐); `/cso` 해당 없음일 때 자발적 `/cso`의 `cso_commit`을 기록할 길도 없다 | `skip-qa --clear`로 키 삭제; `pass cso` 해당 없음을 거부 대신 「기록만 남긴다」로 |
| DX-X2 | 낮음 | biome `--write`를 끌 길이 없다 | `--no-write` 플래그(검사를 끄는 게 아니라 파일 수정만) |
| DX-X3 | 좋음 | 복구 경로(W6)는 그대로 간다 | — |

리뷰어가 「바꾸지 말 것」으로 든 것: `measurable: false`·저장하지 않는 판정, `decideTransition`의 순서, 가짜 `pnpm`과 `WF_SHIM_FAIL`, `.claude/lib/**`가 `CSO_PATHS`에 드는 것, 전이 출력의 `HEAD` 해시, 훅이 import하지 않는 이유.

```
DX DUAL VOICES — CONSENSUS TABLE:
  Dimension                           Claude  Codex  Consensus
  1. Getting started < 5 min?          예      —      N/A (TTHW는 status 한 번, 첫 실행 함정은 G2)
  2. API/CLI naming guessable?         부분    —      N/A (E4 verify 이름, E5 거부 문구)
  3. Error messages actionable?        부분    —      N/A (H1 처방 다섯, H2 stdout 조건, H3·H4)
  4. Docs findable & complete?         부분    —      N/A (D1 참조형 축약, D2 예, D3 README 입구)
  5. Upgrade path safe?                예      —      N/A (옛 상태 파일 호환, 복구 문서 — X3)
  6. Dev environment friction-free?    부분    —      N/A (G2 Cocos 파일, X1·X2 빠져나갈 길)
CONFIRMED 없음 — 바깥 목소리가 없어 여섯 칸 모두 N/A. 단일 목소리의 높음 1건(E1)은 코드로 확인하고 받아들였다.
```

**지적별 판정(0D, `/autoplan` 자동 결정 — DX POLISH, P1·P5).** 사용자 결정을 바꾸는 제안 없음. 사람 확인 지점 추가 없음.

| ID | 판정 | 원칙 | 어떻게 반영 |
|---|---|---|---|
| DX-G1 | **Add** | P5 | `verify`를 `implementation`·`verification`·`user-verification`에서 받는다(본문 치환). 그 밖 phase는 거부 문구 (DAT #56) |
| DX-G2 | **Add** | P1 | 처방 두 길(worktree의 `game`을 Cocos로 열기 / 다른 체크아웃의 파일 복사)을 통합 검사 안내와 W7 백로그 항목에 (DAT #57) |
| DX-G3 | **Add** | P5 | `skip-qa`를 `implementation`에서도 받는다(본문 치환) (DAT #58) |
| DX-E1 | **Add** | P1 | `workflow.mjs` 366~398행을 확인: `.meta` 검사는 `git ls-files game/assets`(추적 파일)만 본다. 미추적 `*.meta`를 변경 집합에서 빼도 검사 결과는 같고, 새 자산은 자산 파일이 스스로 걸린다. 대표 표에 줄 추가 (DAT #59) |
| DX-E2 | **Add** | P5 | biome이 고친 형식 차이는 판단 검사를 다시 하지 않는다 — CEO K2(`invalidate` → 절차대로)의 예외로 적는다. `pass` 실패 출력을 「형식 차이」/「그 밖」으로 분기 (DAT #60, K2 Taste의 보강) |
| DX-E3 | **Add(Taste)** | P3 | 검증 순서를 「커밋 → (적용 시) `/cso` → `pass cso` → 리뷰 → `pass review`」로(본문 치환, §3·W6·W2). 대안(커밋 전 경고 한 줄)은 E2 철회와 같은 이유로 기각. 사용자 절차 순서를 바꾸므로 최종 승인에서 본다 (DAT #61, **Taste**) |
| DX-E4 | **Keep** | P5 | 이름은 `verify` 그대로 — 바꾸면 `CLAUDE.md`·절차 문서·테스트 문자열이 함께 움직이고 글자 수가 는다. `status`의 명령 목록에 「(전이 없음)」을 붙인다 (DAT #62) |
| DX-E5 | **Add** | P1 | 거부 문구 둘을 의도에 맞게 (DAT #63) |
| DX-E6 | **Add** | P5 | `makeRepo(opts)` 기본값 한 줄 (DAT #63) |
| DX-H1 | **Add** | P1 | 원인별 처방 다섯 줄 + `U` 테스트 (DAT #64) |
| DX-H2 | **Add** | P1 | 「stdout이 비고 `status`가 9009·127」 + stderr 첫 줄. CEO 항목(「출력이 비면」)을 이 표현으로 대체 (DAT #64) |
| DX-H3 | **Add** | P1 | `ready-impl`·`skip-qa`·`approve-pr` 거부에도 「절차: `steps <phase>`」; vitest 재시도 명령에 실패 파일 경로 (DAT #65) |
| DX-H4 | **Add** | P1 | `skip-qa` 거부 문장에 걸린 파일 (DAT #65) |
| DX-D1 | **Add(부분)** | P5 | 상한은 그대로(늘리지 않는다). 덜어 낼 때 「위와 같다」 같은 참조형 축약을 쓰지 않고 문장을 통째로 지운다 — 34행은 「`pnpm wf invalidate`를 친다」(완결 문장), 62행은 문장 삭제. CEO 항목의 「(위와 같다)」를 대체. 10,000자 항목의 순서는 백로그가 정한다 (DAT #66) |
| DX-D2 | **Add(조건부)** | P5 | 복사해 칠 예 둘(`skip-qa` 한 줄, `status`의 「다음 /cso」 줄)은 글자 수가 남을 때만 (DAT #66) |
| DX-D3 | **Add** | P1 | `workflow/README.md`에 입구 한 줄(배달되지 않아 상한 밖) (DAT #67) |
| DX-D4 | **Add** | P1 | §4 메모리 목록에 이미 아는 셋을 적는다 (DAT #67) |
| DX-X1 | **Add** | P5 | `skip-qa --clear`(본문 치환); `/cso` 해당 없음일 때 `pass cso`는 거부 대신 「기록만 남긴다」(본문 치환, CEO 항목의 「받지 않는다」 테스트를 대체) (DAT #68) |
| DX-X2 | **Add** | P4 | `start-verification`·`verify`에 `--no-write` 플래그(검사를 끄는 것이 아니라 파일 수정만 끈다) (DAT #69) |
| DX-X3 | 좋음 | — | 그대로 |

본문 치환 기록(`prepare-close dx`가 적용한다):

<!-- autoplan-baseline-edits:dx {"sourceSha256":"ffe1af8f48702cf17f954091c868d9cc88907d312da80e4a123bba2e54a1f81a","replacements":[{"oldText":"**`verify`(새 명령, `verification`에서만).** 통합 검사를 다시 돌려 기록용 값 셋만 다시 적는다. 다음 phase로 넘기지 않는다. `pass`가 넘기기 직전에 스스로 통합 검사를 돌리므로, 코드를 고친 뒤 `verify`를 먼저 칠 의무는 없다. 쓰임은 「넘기지 않고 지금 결과만 보고 싶을 때」다. `implementation`에서 치면 「`pnpm wf start-verification`을 쓴다(같은 검사를 하고 다음 phase로 넘긴다)」를 안내한다.","newText":"**`verify`(새 명령, `implementation`·`verification`·`user-verification`에서).** 통합 검사를 다시 돌려 기록용 값 셋만 다시 적는다. 어느 phase에서도 다음 phase로 넘기지 않는다 — 기록용 값은 조건이 아니라 어디서 적어도 해가 없다. `pass`가 넘기기 직전에 스스로 통합 검사를 돌리므로, 코드를 고친 뒤 `verify`를 먼저 칠 의무는 없다. 쓰임은 「넘기지 않고 지금 결과만 보고 싶을 때」와 「`user-verification`에서 사용자가 잡은 작은 수정 뒤 기계 검사 셋을 한 번에 돌릴 때」다. 그 밖의 phase(`planning`·`qa-setup`·`pr-ready`·`done`)에서 치면 「코드를 검사하는 phase가 아니다」로 거부한다."},{"oldText":"**QA 문서 생략 — `skip-qa \"<사유>\"`(새 명령, `qa-setup`과 `verification`에서).** 사유를 `qa_skip_reason`에 적는다.","newText":"**QA 문서 생략 — `skip-qa \"<사유>\"`(새 명령, `qa-setup`·`implementation`·`verification`에서. `skip-qa --clear`는 사유를 지운다).** 사유를 `qa_skip_reason`에 적는다. `--clear`는 키를 없애 「생략 없음」으로 되돌린다 — 상태 파일을 손으로 고치는 길은 훅이 막으므로 되돌릴 명령이 있어야 한다."},{"oldText":"`/cso`가 해당 없음일 때 `pass cso`를 치면 「표시할 것이 없다」며 받지 않는다.","newText":"`/cso`가 해당 없음일 때 `pass cso`를 치면 받되 「`/cso` 해당 없음(`CSO_PATHS` 변경 없음 — `pnpm wf status`로 확인) — 기록만 남긴다」를 찍고 `cso_done`·`cso_commit`을 적는다. 자발적으로 돌린 점검의 기준 커밋을 남기기 위해서이고, 전이 조건에는 들지 않는다(해당 없음이면 `cso_done`을 보지 않는다)."},{"oldText":"`/cso` 해당 없음일 때 `pass cso`를 받지 않는다. `pass cso`가 `cso_commit`을 적는다.","newText":"`/cso` 해당 없음일 때 `pass cso`가 「기록만 남긴다」를 찍고 `cso_commit`을 적되 전이 조건을 바꾸지 않는다. `pass cso`가 `cso_commit`을 적는다."},{"oldText":"검증 안에서는 (적용될 때만 `/cso` → `pass cso`) → 커밋 → 리뷰 → `pass review` 순이다 |","newText":"검증 안에서는 커밋 → (적용될 때만 `/cso` → `pass cso`) → 리뷰 → `pass review` 순이다. 커밋을 앞에 두는 이유는 `pass cso`가 적는 `cso_commit`이 점검한 변경을 담은 커밋이 되게 하려는 것이다 — 그래야 다음 `/cso --diff --base`가 이미 본 부분을 다시 보지 않는다 |"},{"oldText":"가운데 두 줄을 「→ (적용 시 /cso → pass cso) → 기능 단위 커밋 → 코드리뷰 → pass review」 한 줄로","newText":"가운데 두 줄을 「→ 기능 단위 커밋 → (적용 시 /cso → pass cso) → 코드리뷰 → pass review」 한 줄로"},{"oldText":"`pass cso`를 커밋 전에 쳤다면 `cso_commit`은 점검한 내용보다 앞선 커밋이다. 그러면 다음 점검이 이미 본 부분까지 다시 본다. 더 보는 쪽으로만 틀린다.","newText":"절차는 커밋 뒤에 `/cso` → `pass cso`를 치게 한다(§3). 그래도 `pass cso`를 커밋 전에 쳤다면 `cso_commit`은 점검한 내용보다 앞선 커밋이다. 그러면 다음 점검이 이미 본 부분까지 다시 본다. 더 보는 쪽으로만 틀린다."}]} -->

<!-- autoplan-accepted:dx -->
- `verify`는 `implementation`·`verification`·`user-verification`에서 받는다. 어느 phase에서도 전이하지 않고 기록용 값 셋만 적는다. 그 밖의 phase에서 치면 「코드를 검사하는 phase가 아니다」로 거부한다. 테스트: 세 phase에서 각각 돌아가고 phase가 그대로인지, `planning`에서 거부하는지.
- 통합 검사의 vitest 실패 출력에 `tsconfig.cocos.json`이 보이면 처방을 두 길로 찍는다: 「`<작업 폴더>/game`을 Cocos Creator로 한 번 연다」 또는 「다른 체크아웃의 `game/temp/tsconfig.cocos.json`을 같은 자리로 복사한다(git이 무시하는 파일이라 커밋되지 않는다)」. W7의 해당 백로그 항목에도 두 길을 적는다.
- `skip-qa`는 `qa-setup`·`implementation`·`verification`에서 받는다. `skip-qa --clear`는 `qa_skip_reason` 키를 지워 「생략 없음」으로 되돌린다. 테스트: `--clear` 뒤 `status`가 「QA 문서 생략: 없음」을 찍는다.
- `collectChangeSet`은 추적되지 않은 `*.meta` 파일을 변경 집합에서 뺀다(상태 파일을 빼는 자리에 같이 두고 주석에 「Cocos가 만드는 파일이지 개발자의 변경이 아니다. `.meta` 누락 검사는 추적 자산의 형제 `.meta`가 추적되는지로 판정하므로 결과가 달라지지 않는다」를 적는다). 대표 변경 집합 표에 「추적되지 않은 `.meta`만」 줄을 더하고 `meta`·`fullTypecheck`·`cso` 해당 없음, QA 생략 가능으로 고정한다. 새 자산은 자산 파일 자체가 `game/assets/**`에 걸린다.
- `pass`(`write: false`)가 biome 형식 차이만으로 실패하면 출력을 「형식 차이 n개 파일 — `pnpm wf verify`로 고치고 커밋한 뒤 `pnpm wf pass review`를 다시 친다. 형식만 고친 것은 판단 검사를 다시 하지 않는다」로 찍는다. 그 밖의 실패(타입·린트·테스트)는 「고친 뒤 `pnpm wf invalidate` → 절차대로」다. `verification.md`의 `invalidate` 문장 옆에 「biome이 고친 형식 차이는 예외다」 한 구절을 둔다(글자 수는 W6 표에서 다시 잰다).
- `status`의 명령 목록에서 `verify`에 「(전이 없음)」을 붙인다. `pass ts`·`pass lint` 거부 문구는 「타입·린트는 통합 검사가 기록한다 — 표시할 것이 없다. 결과만 다시 보려면 `pnpm wf verify`」다.
- `makeRepo(opts)`의 기본값: 옵션 없이 부르면 phase `verification`, QA 문서 있음, 게임 변경 없음, `/cso` 해당 없음(`csoApplicable: false`), `HEAD`는 `feat/<feature>`, git 저장소 있음(`git: true`). `WfSandbox.ts` 머리말 주석에 이 한 줄을 둔다.
- 변경 집합을 구할 수 없는 원인별 처방은 다섯 줄 전부 둔다: `origin/main` 없음 → 「`git fetch origin main`」, 하위 폴더 → 「저장소 루트에서 실행」, git 저장소 아님 → 「저장소 루트에서 실행(여기는 git 저장소가 아니다)」, git 출력 실패 → stderr 첫 줄 + 「`git status`로 확인」, `U` 등 알 수 없는 상태 → 「충돌을 풀고 다시 (`docs/development/troubleshooting/workflow-state-cross-machine.md`)」. 테스트에 `U` 경우의 문장을 더한다.
- 실행기를 찾지 못한 경우의 판정은 「`error`가 있거나, stdout이 비고 `status`가 9009(`cmd.exe`) 또는 127(`sh`)」이다(stderr에는 셸의 메시지가 찍히므로 stderr는 비어 있지 않다). 안내에 stderr 첫 줄을 함께 찍는다. 시험용 실행기는 stderr를 채운 모양으로 만든다. 이 항목이 앞 단계의 「출력이 비면」 표현을 대체한다.
- `ready-impl`·`skip-qa`·`approve-pr`의 거부 출력도 「절차: `pnpm wf steps <그 phase>`」로 끝낸다. vitest 실패 상세의 다시 돌려 볼 명령은 실패한 파일 경로를 붙인 `pnpm exec vitest run <파일>`(결과 파일의 `testResults[].name`)이고, 파일이 셋을 넘으면 `pnpm exec vitest run`만 찍는다.
- `skip-qa` 거부 문장은 「QA 문서가 필요하다: <걸린 파일>」로 걸린 파일을 든다.
- W6 `verification.md`에서 덜어 낼 때 「위와 같다」 같은 참조형 축약을 쓰지 않는다. 34행은 「`pnpm wf invalidate`를 친다」로 완결 문장으로 줄이고, 62행의 「고쳤으면 `pnpm wf invalidate`로 되돌려 보안 검사부터 다시 돈다」는 문장을 지운다(5행이 같은 말을 한다). 이 항목이 앞 단계의 「(위와 같다)」 표현을 대체한다. 상한 13,575자는 그대로다.
- 글자 수가 남으면 복사해 칠 예 둘을 넣는다: `qa-setup.md`의 `skip-qa` 문단에 `pnpm wf skip-qa "문서만 고친다 — game/** 변경 없음"` 한 줄, W3 `status` 출력 예에 `다음 /cso: /cso --diff --base 2c41977` 한 줄. 남지 않으면 넣지 않는다.
- `workflow/README.md`에 한 줄을 더한다: 「어느 검사가 언제 적용되는지는 `pnpm wf status`가 보여 주고, 규칙은 `.claude/lib/change-set.mjs`의 상수 위 주석이 정본이다」. 배달되지 않는 문서라 상한 밖이다.
- §4 「메모리는 머지 때 고친다」에 지금 아는 대상 셋을 적는다: 커밋 워크플로우(`feedback_commit_workflow`), 워크플로우 그대로 따르기(`feedback_follow_workflow`), `pass ts`는 진짜 게이트(`feedback_ide_diagnostics_open_files`). 계획 승인 뒤 목록을 마저 채운다.
- `/cso`가 해당 없음일 때 `pass cso`는 거부하지 않고 「`/cso` 해당 없음(`CSO_PATHS` 변경 없음 — `pnpm wf status`로 확인) — 기록만 남긴다」를 찍은 뒤 `cso_done`·`cso_commit`을 적는다. 전이 조건은 바뀌지 않는다(해당 없음이면 `cso_done`을 보지 않는다). 앞 단계 항목의 「`/cso` 해당 없음일 때 `pass cso`를 받지 않는다」 테스트는 「기록만 남긴다 + 전이 조건 불변」 테스트로 바꾼다.
- `start-verification`과 `verify`에 `--no-write` 플래그를 둔다. 켜면 biome을 `--write` 없이 돌려 형식 차이를 고치지 않고 실패로만 센다. 검사를 끄는 장치가 아니라 파일 수정만 끄는 것이다(§2.2에서 기각한 환경변수 교체와 다르다). 테스트: 플래그가 있으면 시험용 biome 실행기에 `write: false`가 전달된다.
- 검증 순서는 「커밋 → (적용 시) `/cso` → `pass cso` → 리뷰 → `pass review`」다(§3·W6·`verification.md`·`CLAUDE.md` 9단계 6번을 같은 순서로). `cso_commit`이 점검한 변경을 담은 커밋이 되게 하려는 것이다. 최종 승인에서 사용자가 보는 Taste 항목이다.
<!-- /autoplan-accepted:dx -->

**Pass 1~8 (DX POLISH, 0~10).** 점수는 받아들인 것을 반영한 뒤의 값이고, 괄호는 반영 전이다.

- **Pass 1 시작하기 — 8 (6).** 시계 안의 일(`pnpm wf status`)은 Champion 등급. 깎는 것은 시계 밖의 Cocos 파일 함정(G2 — 처방 두 길로 보강, 근본은 백로그)과 설치가 두 단계(`pnpm install` + Cocos)라는 점. 10은 「받자마자 `pnpm wf status`가 돌고 첫 `start-verification`이 실패하지 않는 것」 — 이 슬라이스 범위 밖(W7).
- **Pass 2 CLI 설계 — 8 (6).** 이름은 기존 결(`pass`·`skip-*`·`check-*`)을 따르고 `verify`만 결이 다르나 「(전이 없음)」 표시로 메운다(E4). 기본값은 「구할 수 없으면 전부 적용」·`write: true`로 안전 쪽. 거부 문구 둘(E5)과 phase 제한(G1·G3)을 고쳤다. 빠져나갈 길(X1·X2) 추가. 10은 명령마다 한 줄 설명이 `pnpm wf`에 나오는 것 — F96·F71 영역(NOT in scope).
- **Pass 3 오류 처리 — 8 (5).** 세 경로를 따라갔다: ① 실행기 없음 — 지금은 셸 메시지만 → 「실행기 X를 실행할 수 없다(pnpm 경로 확인)」 + stderr 첫 줄 (H2); ② 변경 집합 못 구함 — 지금은 없음 → 원인별 처방 다섯 (H1); ③ 통합 검사 실패 — 지금은 vitest 전체 출력 → 검사마다 요약 한 줄 + 상세 40줄 + 다시 돌릴 명령(파일 경로 포함, H3) + 「절차: steps <phase>」 꼬리. 모든 거부 출력이 문제·원인·다음 명령·절차 문서 위치를 든다. 10은 문서 링크(절차 문서 §)까지 — 글자 수와 바꿔야 해서 보류.
- **Pass 4 문서 — 7 (6).** 정보 구조는 「phase 전이가 그 단계 문서를 배달」로 찾기 쉬움. 참조형 축약을 없앴고(D1), 복사해 칠 예는 조건부(D2), 사람용 입구 한 줄(D3). 깎는 것은 글자 수 상한 때문에 예와 설명을 더 못 넣는 것 — 10,000자 다이어트(W7)가 풀 일.
- **Pass 5 업그레이드 — 9 (8).** 옛 상태 파일 호환(§4, 테스트), 없어도 되는 새 키, 복구 문서(W6), PR revert 하나로 되돌림. 메모리 갱신 대상을 미리 적음(D4). 깎는 것은 F10(추적 정책) 미정.
- **Pass 6 개발 환경 — 8 (7).** Windows·셸(`shell: true`, `Path` 키, 9009/127)을 명시, 임시 저장소 테스트가 git·Windows 줄 끝을 묶음, CI 없음(의도). `--no-write`(X2). 깎는 것은 Cocos 의존(G2).
- **Pass 7 커뮤니티·생태계 — N/A → 점수 매기지 않음.** 한 사람의 저장소 도구다. 외부 기여 조건(F109)만 걸어 둔다. 스코어카드에는 「해당 없음」으로 적고 평균에서 뺀다.
- **Pass 8 측정·피드백 — 8 (4).** CEO 단계에서 §6 측정 넷+넷을 넣었고(명령 수·출력 글자 수·도구 줄 수·테스트 시간·계획 비용), 전이 출력의 `HEAD` 해시로 셋째 값을 잴 수 있다. 부메랑: 머지 뒤 슬라이스 둘을 재서 2단계 백로그 항목에 적는다(§6). 깎는 것은 측정이 세션 기록을 손으로 세는 방식이라는 것(의도된 선택 — 재측정 도구를 두지 않기로 했다).

```
+====================================================================+
|              DX PLAN REVIEW — SCORECARD                             |
+====================================================================+
| Dimension            | Score  | Prior  | Trend  |
|----------------------|--------|--------|--------|
| Getting Started      |  8/10  |  6/10  |  +2 ↑  |
| API/CLI/SDK          |  8/10  |  6/10  |  +2 ↑  |
| Error Messages       |  8/10  |  5/10  |  +3 ↑  |
| Documentation        |  7/10  |  6/10  |  +1 ↑  |
| Upgrade Path         |  9/10  |  8/10  |  +1 ↑  |
| Dev Environment      |  8/10  |  7/10  |  +1 ↑  |
| Community            |  N/A   |  N/A   |   —    |
| DX Measurement       |  8/10  |  4/10  |  +4 ↑  |
+--------------------------------------------------------------------+
| TTHW                 | <1 min | <1 min |  = (status 한 번; 설치는 시계 밖) |
| Competitive Rank     | Champion                                     |
| Magical Moment       | designed via `pnpm wf status`의 적용 판정 표   |
| Product Type         | CLI 도구 (+ AI가 실행하는 절차 문서)            |
| Mode                 | POLISH                                       |
| Overall DX           |  8/10  |  6/10  |  +2 ↑  (Pass 7 제외 일곱의 평균 8.0)
+====================================================================+
| DX PRINCIPLE COVERAGE                                               |
| Zero Friction      | covered (status 한 번; Cocos 함정은 백로그)     |
| Learn by Doing     | covered (phase 전이가 절차 문서를 배달)         |
| Fight Uncertainty  | covered (문제·원인·다음 명령·절차 꼬리)         |
| Opinionated + Escape Hatches | covered (전부 적용 기본값 + --clear·--no-write·check-meta·typecheck 단독) |
| Code in Context    | gap (복사해 칠 예는 글자 수가 남을 때만)        |
| Magical Moments    | covered (status/start-verification의 판정 표)   |
+====================================================================+
```

프리어 점수(「반영 전」)는 이 리뷰 안의 계획 초안 기준이고, 이전 DX 리뷰 기록은 없다(`gstack-review-read`에 `plan-devex-review` 없음 — 확인은 close 때).

```
DX IMPLEMENTATION CHECKLIST
============================
[x] Time to hello world < 2 min (status 한 번)
[x] Installation is one command — 아니다: pnpm install + Cocos 한 번 (범위 밖, W7)
[x] First run produces meaningful output (status의 적용 판정 표)
[x] Magical moment delivered via status/start-verification 판정 표
[x] Every error message has: problem + cause + fix (+ 절차 문서 위치; 문서 링크는 보류)
[x] API/CLI naming is guessable (기존 결 유지, verify에 「전이 없음」)
[x] Every parameter has a sensible default (전부 적용·write: true·makeRepo 기본값)
[~] Docs have copy-paste examples (글자 수가 남을 때만)
[x] Examples show real use cases (대표 변경 집합 여섯, 손 확인 셋)
[x] Upgrade path documented (옛 상태 파일 호환, wf-tool-recovery.md)
[x] Breaking changes have deprecation warnings (pass ts·pass lint 거부 문구가 안내)
[x] TypeScript types included (lib는 @ts-check + JSDoc, allowJs)
[x] Works in CI/CD — CI 없음(의도), 비대화형 동작
[-] Free tier / changelog / search / community channel — 한 사람의 저장소 도구라 해당 없음
```

**NOT in scope (DX).** `pnpm wf` 명령별 한 줄 설명(F96·F71 영역) · Cocos 없는 장비의 근본 해결(W7 백로그) · 오류 안내의 문서 링크(글자 수) · `verify` 이름 변경(기각) · 10,000자 다이어트의 순서(백로그가 정한다).

**What already exists (DX).** 절차 문서 배달(`emitStepDoc`), `pnpm wf steps`, `check-*` 단독 명령, `typecheck.mjs`의 범위 보고와 Cocos 안내, 훅의 편집 게이트, 트러블슈팅 문서 둘 — 계획이 전부 재사용한다.

#### Implementation Tasks (DX)

Synthesized from this review's findings. (jq 없음 — JSONL은 쓰지 않았다.)

- [ ] **T8 (P1, human: ~1h / CC: ~5min)** — `.claude/lib/change-set.mjs` — 추적되지 않은 `*.meta`를 변경 집합에서 빼고 대표 표에 줄을 더한다
  - Surfaced by: DX-E1
  - Files: `.claude/lib/change-set.mjs`, `tests/logic/WorkflowDiet.test.ts`
  - Verify: 임시 저장소에 미추적 `x.png.meta`만 둔 경우 넷 다 해당 없음
- [ ] **T9 (P2, human: ~2h / CC: ~10min)** — `.claude/workflow.mjs` — `verify`·`skip-qa`의 phase 범위, `skip-qa --clear`, `pass cso` 해당 없음의 「기록만」, `--no-write`, 거부 문구 셋, `steps` 꼬리 셋
  - Surfaced by: DX-G1·G3·X1·X2·E5·H3·H4
  - Files: `.claude/workflow.mjs`, `tests/logic/ClaudeMdSplit.test.ts`, `tests/logic/WorkflowDiet.test.ts`
  - Verify: 임시 저장소 E2E — 각 명령의 phase별 수락/거부와 출력 문자열
- [ ] **T10 (P1, human: ~1h / CC: ~5min)** — `.claude/lib/verify.mjs`·`change-set.mjs` — 실행기 없음 조건(stdout 빈 + 9009/127 + stderr 첫 줄), 원인별 처방 다섯, 형식 차이 분기, vitest 재시도 명령에 파일 경로
  - Surfaced by: DX-H1·H2·E2·H3
  - Files: `.claude/lib/verify.mjs`, `.claude/lib/change-set.mjs`
  - Verify: 시험용 실행기 단위 테스트(stderr 채운 모양, `U` 출력, 형식 차이만 실패)
- [ ] **T11 (P2, human: ~1h / CC: ~10min)** — 문서 — 검증 순서(커밋 → /cso → pass cso)를 §3·`verification.md`·`CLAUDE.md`에, 축약 대신 문장 삭제, 조건부 예 둘, README 입구 한 줄, 메모리 대상 셋, Cocos 처방 두 길
  - Surfaced by: DX-E3·D1·D2·D3·D4·G2
  - Files: `docs/development/workflow/verification.md`, `workflow/README.md`, `CLAUDE.md`, 계획 문서
  - Verify: 절차 문서 합계 ≤ 13,575자 테스트, `pnpm wf check-links`
- _No new tasks from Pass 5, Pass 7._

#### 결정 장부 (Decision ledger)

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| L-A (접근) | 설계 문서 「검토한 접근」, 사용자 2026-10-05 | 축소형 A | — | approved | 사용자 결정 2026-10-05 (인계 문서 §3) |
| L-E1 (verify.mjs) | 통합 검사 요약 줄에 시간 | 없음 | 검사마다 ms | approved | `/autoplan` 자동 결정 P2 (DAT #3) |
| L-E2 (workflow.mjs pass) | `pass cso` 미커밋 변경 경고 | 없음 | 경고 한 줄, 기록은 그대로 | declined (철회) | DAT #4로 승인했다가 독립 리뷰 C-2-2로 철회(DAT #43) — 절차상 `pass cso` 때는 거의 늘 미커밋이라 소음 |
| L-E3 (status) | `cso_commit`·다음 점검 명령 표시 | 없음 | 한 줄 | approved | `/autoplan` 자동 결정 P2·P4 (DAT #5) |
| L-E4 (status) | 다음 명령 안내 | 없음 | 백로그 F71 행에 후보 | deferred | `/autoplan` 자동 결정 P3 (DAT #6) |
| L-E6 (skip-qa) | 유효 조건 안내 한 줄 | 없음 | 한 줄 | approved | `/autoplan` 자동 결정 P2 (DAT #7) |
| L-S1 (W2 pass/verify) | 사양 리뷰 1회차 Completeness 1 — `qaDocClean`이 파일 없으면 통과(`workflow.mjs:504`) | 파일 없음 = 통과 | `qaRequired`면 파일 존재부터 요구 | approved | `/autoplan` 자동 결정 P1 (DAT #9) |
| L-S2 (E2) | Completeness 2 — 상태 파일이 늘 미커밋 | 모든 미커밋 변경에 경고 | 상태 파일 제외 | declined (E2 철회로 소멸) | DAT #10 → DAT #43 |
| L-S3 (W2 테스트) | Completeness 3 — `start-verification` 프로세스 테스트 없음 | 손 확인만 | 성공·실패 E2E 둘 | approved | `/autoplan` 자동 결정 P1 (DAT #11) |
| L-S4 (§7·§12) | Consistency 1 — 손 확인이 명령 막히는 phase | 사용자 검증 단계 | 검증 단계(`pass review` 전) | approved | `/autoplan` 자동 결정 P5, 본문 치환 기록 (DAT #12) |
| L-S5 (W2 안내) | Consistency 2 — 실패 뒤 안내가 `invalidate` 규칙과 어긋남 | 「고친 뒤 `pass review`」 | 「고친 뒤 `invalidate` → 절차대로」 | approved (TASTE) | `/autoplan` 자동 결정 P5 — 대안(형식·타입 수정은 invalidate 면제)은 최종 승인에서 사용자가 본다 (DAT #13) |
| L-S6 (W7 F71) | Consistency 3 — E4 미룸 기록 누락 | 없음 | F71 행에 후보 한 줄 | approved | `/autoplan` 자동 결정 P1 (DAT #14) |
| L-S7 (qaDocClean) | Consistency 4 — `tests/logic` 없음 예외의 거취 | 예외 있음(`workflow.mjs:511`) | 없앤다, 가짜 `pnpm`이 자리를 메운다 | approved | `/autoplan` 자동 결정 P1 (DAT #15) |
| L-S8 (이름·모양) | Clarity 1~6 — 검사 이름, `csoBaseUsable` 자리, `durationMs`, `verify`의 `write`, `WfSandbox` 내보내기, PATH 키 | 미정 | 각각 정함 | approved | `/autoplan` 자동 결정 P5 (DAT #16) |
| L-S9 (W5 샌드박스) | Feasibility 1 — `pass cso` 거부가 기존 테스트(`ClaudeMdSplit.test.ts:334`)를 깨뜨림 | 변경 집합에 `.claude/**` 없음 | `makeRepo({csoApplicable:true})` | approved | `/autoplan` 자동 결정 P5 — 테스트를 `pass review`로 바꾸는 대안은 기각(확인 내용이 달라진다) (DAT #17) |
| L-S10 (W1 파서) | Feasibility 2 — `git diff --name-status`의 `T` | A·M·D만 | `T`→`M`, 그 밖은 `measurable:false` | approved | `/autoplan` 자동 결정 P1 (DAT #18) |
| L-C (독립 리뷰 13건) | Dual Voices 표(위) | — | — | approved (Taste 3: DAT #43·#45·#51) | `/autoplan` 자동 결정 (DAT #40~#52) |
| L-R (Section 1·2·5) | A-1·A-2·Q-1·Q-2 | — | — | approved | `/autoplan` 자동 결정 (DAT #53·#54) |

**Approval readiness: PASS** — 검사한 행: L-A(사용자 2026-10-05), L-E1·L-E3·L-E6(DAT #3·#5·#7), L-E2(철회 DAT #43), L-E4(미룸 DAT #6), L-S1~L-S10(DAT #9~#18), L-C(DAT #40~#52), L-R(DAT #53·#54). 승인 블록은 이 행들의 요구사항만 든다. 사용자 결정을 뒤집는 항목 없음. Taste 4건(DAT #13·#43·#45·#51)은 잠정 자동 결정이며 최종 승인에서 사용자가 본다.

| L-DX (독립 리뷰 17건) | DX 양쪽 목소리 표(위) | — | — | approved (Taste 1: DAT #61, Keep 1: E4) | `/autoplan` 자동 결정 (DAT #56~#69) |

**Eng 단계에서 고칠 본문 한 곳(DX 마무리 묶음 검토에서 발견):** §7 「손 확인」의 「`pass`와 `verify`는 `verification`에서만 받으므로」는 DX 승인 항목(`verify`는 세 phase에서 받는다)과 어긋난다 → 「`pass`는 `verification`에서만 받으므로 여기서 한다(`verify`는 `user-verification`에서도 돈다)」로 Eng 단계 치환 기록에 넣는다.

**Approval readiness (DX): PASS** — 검사한 행: L-DX(DAT #56~#69). 승인 블록 `dx`는 이 행의 요구사항만 든다. 앞 단계 항목을 대체한 것 넷(H2 조건, D1 축약, X1 `pass cso` 거부, E2 형식 차이 예외)은 `dx` 블록에 「대체한다」로 적었다. 사용자 결정을 뒤집는 항목 없음. Taste는 DAT #61(검증 순서) 하나가 더해져 다섯이다.

#### 사양 리뷰 루프 결과 (0H Spec Review Loop)

**1회차 (서브에이전트, 두 입력 전부 읽음, 계획이 인용한 코드·수치를 저장소에서 확인).** 점수 6/10, Overall FAIL. Scope PASS. 지적 15건: Completeness 3, Consistency 4, Clarity 6, Feasibility 2. 전부 받아들였다(위 장부 L-S1~L-S10). 본문 문장을 바꿔야 하는 넷(손 확인의 단계와 검사 이름, §12의 같은 구절, 실패 뒤 안내, W5의 도우미 설명)은 아래 치환 기록으로 고치고, 나머지는 승인 블록에 요구사항으로 더했다. CEO 요약의 「Reviewer Concerns」도 같이 갱신했다.

**2회차.** 점수 7/10, Overall FAIL(Scope만 PASS). 1회차 15건이 전부 들어 있고 서로 어긋나지 않는 것을 확인했다. 새 지적 13건: Completeness 3(vitest 요약 줄의 수, `verification.md`의 「보안 검사부터」 문장 셋과 `planning.md`의 「GREEN 게이트」, 가짜 `pnpm`과 `qaDocClean` 호출), Consistency 3(`verify`의 QA 역할, `invalidate` 뒤 절차의 정본·QA, `approve-pr` E2E 범위), Clarity 4(임시 저장소 모양, `qaClean` 시점, 사유 없는 메시지, 실행기 명령줄), Feasibility 3(가짜 `pnpm` 위치, `shell: true`의 ENOENT, `tests/logic` 예외 제거 뒤 판정 파일). 전부 받아들였다(DAT #19~#30). 치환 기록에 둘을 더했다(`invalidate` 뒤 절차 문장, `approve-pr` E2E 문장) — 승인 블록에는 여섯을 더하고 둘을 고쳤다.

**3회차(마지막).** 점수 7/10, Overall FAIL. 2회차 13건이 전부 들어 있고 서로 맞는 것을 확인했다. 새 지적 13건: 막음 1(임시 저장소의 브랜치 모양이 `DocsHygiene.test.ts`의 두 기대와 어긋남), 보강 12(Completeness 3, Consistency 4, Clarity 3, Feasibility 2). 전부 받아들였다(DAT #31~#38). 치환 기록에 다섯을 더했다(상태 줄, 머리말 「고칠 정본」, §8·W7의 「절차 문서 넷」→「다섯」, W6 `planning.md` 행, W2 `decideTransition` 서명) — 승인 블록에서 임시 저장소 항목을 다시 쓰고 여덟을 더했다. 리뷰어 호출 상한(3회)에 닿아 루프는 여기서 멈춘다. **3회차 지적의 반영분은 리뷰어의 재확인을 받지 않았다** — CEO 요약 「Reviewer Concerns」에 그렇게 적는다. 측정값: 호출 3회, 지적 41건, 반영 41건, 미해결 0건(재확인 없음), 마지막 점수 7.

본문 치환 기록(`amend-input`이 적용한다):

<!-- autoplan-baseline-edits:ceo {"sourceSha256":"c9e1ac2316e7b217f8fedd69eac612cd2064ff0db7d2f567f1af4e5964cff230","replacements":[{"oldText":"- **손 확인(사용자 검증 단계).**","newText":"- **손 확인(검증 단계, `pass review` 전).** `pass`와 `verify`는 `verification`에서만 받으므로 사용자 검증 단계가 아니라 여기서 한다."},{"oldText":"`full-typecheck: 해당 없음`","newText":"`fullTypecheck: 해당 없음`"},{"oldText":"사용자 검증 단계의 셋","newText":"검증 단계의 셋"},{"oldText":"다음에 할 일은 「고친 뒤 `pnpm wf pass review`를 다시 친다」다. 그때 통합 검사가 다시 돈다. 그래서 리뷰를 받고 코드를 고친 뒤 `verify`를 잊어도, 고친 코드로 통합 검사를 통과하지 않고는 넘어가지 못한다.","newText":"다음에 할 일은 「고친 뒤 `pnpm wf invalidate`를 치고 절차대로 다시 한다(정본 선언 → QA 문서가 필요하면 갱신 → 적용 시 `/cso --diff` → 커밋 → 리뷰 → `pass review`)」다. `invalidate`는 지금처럼 정본 선언을 비우고 QA 문서의 지문을 찍으므로 그 둘도 다시 한다. 코드를 고쳤으면 통과 표시를 지운다는 규칙(`CLAUDE.md` 9단계 6번)과 같다. `invalidate`를 잊고 `pass review`만 다시 쳐도 통합 검사는 다시 돌므로, 고친 코드로 통합 검사를 통과하지 않고는 넘어가지 못한다."},{"oldText":"`approve-pr`을 실제 프로세스로 띄우는 테스트는 출력 앞부분(적용 판정 표)만 확인한다. 뒤는 실제 타입 검사가 돌기 때문이다.","newText":"`approve-pr`을 실제 프로세스로 띄우는 테스트는 가짜 `pnpm`(W5) 덕에 끝까지 돈다 — 적용 판정 표가 타입 검사보다 먼저 찍히는 것과 `pr-ready`로 넘어가는 것까지 확인한다."},{"oldText":"임시 git 저장소를 만드는 `makeRepo`와 그 안에서 `workflow.mjs`를 띄우는 `runWf`를 `DocsHygiene.test.ts`와 `ClaudeMdSplit.test.ts`에서 옮겨 온다. 두 테스트는 이 도우미를 쓰게 고치되 확인하는 내용은 바꾸지 않는다.","newText":"`DocsHygiene.test.ts`의 `makeRepo`(임시 git 저장소)·`runWf`(그 안에서 `workflow.mjs`를 띄운다)와 `ClaudeMdSplit.test.ts`의 `makeSandbox(opts)`(git이 아닌 폴더에 상태 파일·문서를 옵션으로 꾸민다)를 하나로 합쳐 옮겨 온다. 내보내는 것은 `makeRepo(opts)`(git 저장소 + `makeSandbox`의 옵션), `runWf(dir, args, env)`, `git(dir, ...args)` 셋이고, `DocsHygiene.test.ts`의 나머지 git 호출(`cat-file`, `reset --hard`)은 `git(dir, ...args)`로 바꾼다. 두 테스트는 이 도우미를 쓰게 고치되 확인하는 내용은 바꾸지 않는다."},{"oldText":"- **상태:** 초안 — `/autoplan` 리뷰 전이다.","newText":"- **상태:** `/autoplan` 리뷰 반영 중 — 사양 리뷰 세 회차의 지적을 반영했다."},{"oldText":"`workflow/user-verification.md` · `workflow/README.md` · `CLAUDE.md`","newText":"`workflow/user-verification.md` · `workflow/planning.md`(한 곳) · `workflow/README.md` · `CLAUDE.md`"},{"oldText":"절차 문서 넷, `workflow/README.md`","newText":"절차 문서 다섯(`planning.md` 포함), `workflow/README.md`"},{"oldText":"절차 문서 넷을 고쳤다는 한 줄","newText":"절차 문서 다섯을 고쳤다는 한 줄"},{"oldText":"| `workflow/planning.md` · `workflow/pr-ready.md` | 2,960 | 2,960 | 고치지 않는다 |","newText":"| `workflow/planning.md` · `workflow/pr-ready.md` | 2,960 | 2,960 | `planning.md`는 「`start-verification`의 GREEN 게이트」를 「통합 검사 게이트」로 한 곳만 고친다(글자 수 같음). `pr-ready.md`는 고치지 않는다 |"},{"oldText":"qaClean, canonDeclared, verifyResult})`가 `{transition, needsVerify, blockers, patch}`를 돌려준다","newText":"qaClean?, canonDeclared, verifyResult?})`가 `{transition, needsQa, needsVerify, blockers, patch}`를 돌려준다"},{"oldText":"| `CSO_PATHS` | `.claude/**`, `tools/**`,","newText":"| `CSO_PATHS` | `.claude/*.mjs`, `.claude/hooks/**`, `.claude/lib/**`, `.claude/settings.json`(저장소가 추적하는 자리만 — Claude Code가 판마다 만드는 생성물은 걸리지 않는다; `.claude/commands/**`는 생기면 더한다), `tools/**`,"},{"oldText":"그 설정이 없는 장비에서는 이 파일들이 변경 집합에 들어가 `.claude/**`에 걸리고, 모든 슬라이스에 `/cso`가 적용된다.","newText":"그 설정이 없는 장비에서는 biome(`vcs.useIgnoreFile`, W4)이 이 파일들을 검사 대상으로 본다. `CSO_PATHS`는 `.claude` 아래의 추적 자리만 들므로 `/cso` 적용 여부는 이 파일들에 흔들리지 않는다."},{"oldText":"| 도구만(`tools/blender/**` 또는 `.claude/**`) |","newText":"| 도구만(`tools/blender/**` 또는 `.claude/workflow.mjs`) |"},{"oldText":"실제로 이 저장소 이력에서 `/cso`가 찾은 것이 없다.","newText":"실제로 이 저장소 이력에서 `/cso`가 찾은 것이 없다. 도구 경로(`.claude/**`·`tools/**`)에서도 0건이다 — `docs/qa/`에 `*-security-issues.md`가 하나도 없다(2026-10-06 확인)."},{"oldText":"둘 다 아니면 2단계를 열지 않고 2단계 백로그 항목을 닫는다.","newText":"둘 다 아니면 2단계를 열지 않고 2단계 백로그 항목을 닫는다. 셋째 값은 코드 수정이 한 번이라도 있으면 보통 1 이상이다(`invalidate`가 정본 선언을 비우므로). 그래서 이 조건은 사실상 『리뷰 뒤 코드 수정이 두 슬라이스에서 있었는가』를 묻는다."},{"oldText":"기준선은 2026-08-18 이후 137회다(요구사항 문서 §3.1).","newText":"기준선은 2026-08-18 이후 누적 137회(요구사항 문서 §3.1)를 그 기간의 슬라이스 수로 나눈 슬라이스당 평균으로 적는다(계획 승인 뒤 센다)."},{"oldText":"절차 문서를 줄이는 일은 따로 새 백로그 항목으로 올린다(W7).","newText":"절차 문서를 줄이는 일은 따로 새 백로그 항목으로 올린다(W7). 1단계는 슬라이스마다 드는 비용을 줄이는 대신 도구 코드의 양은 늘린다(새 모듈 여섯, 임시 저장소 도우미, 테스트). 실제 유지비는 §6의 줄 수·테스트 시간으로 잰다."}]} -->

<!-- AUTONOMOUS DECISION LOG -->
### Eng 단계 (Phase 3) — FULL_REVIEW

- **입력:** 체크포인트 `autoplan-eng-T2kBiI/eng-implementation.md`(sha256 `489bbff1…`), 방법론 `autoplan-eng-methodology-vJN0VB/methodology.md` 2228줄 전부.
- **대조한 코드(이 worktree, 커밋 `2c41977`):** `.claude/workflow.mjs`(1014줄) · `.claude/typecheck.mjs` · `.claude/hooks/gate-scripts.mjs` · `tests/helpers/CanonDoc.ts`·`WorkflowSteps.ts`·`QaDoc.ts` · `tests/logic/ClaudeMdSplit.test.ts`(880줄, `makeSandbox`·`runWf`) · `DocsHygiene.test.ts`(`makeRepo`) · `EolPolicy.test.ts` · `biome.json` · `package.json` · `tsconfig.tests.json` · `vitest.config.ts` · `.gitignore` · `.husky/pre-commit`. 외부 문서는 Context7로 biome(`--reporter` 표)과 vitest(JSON reporter 소스)를 확인했다.
- **진입 검사 사정:** 사용자가 Phase 3 도중에 말을 걸어(컨텍스트 정리 상의) gstack 진입 검사가 이 호출을 「끝난 것」으로 보게 됐다. 그 상태의 검사는 기록이 제때 적히면 그냥 허용하고 늦으면 막으므로, 방법론 뒤쪽 두 구간은 셸로 읽었고 독립 리뷰어는 같은 지시문에 머리글 한 줄을 더해 띄웠다(리뷰어가 읽는 파일·해시·판정 기준은 같다). 되살리는 길(`init` 재실행)은 계획 파일이 이미 자라서 오류를 내므로 없다.

#### Step 0 범위 검토 (Scope Challenge)

**A. 무엇이 이미 푸나.**

| 계획의 부분 문제 | 지금 있는 것 | 이번에 |
|---|---|---|
| 상태 파일 읽고 쓰기, phase 전이 | `workflow.mjs` `load`·`save`·`requirePhase`·`resetVerification`(77~118행) | 그대로 쓴다. `resetVerification`은 `CHECKS`에서 `ts`·`lint`가 빠지면 기록용 값 셋을 건드리지 않게 된다(CEO 항목) |
| 타입 검사 | `typecheck.mjs` `runTypecheck()`(두 프로젝트, `logic-only` 범위 보고) | `{ capture: true }` 옵션만 더한다 |
| 전체 테스트 띄우기 | `workflow.mjs` `runVitest()`(347행, `stdio: inherit`) | 통합 검사는 JSON reporter + 결과 파일로 돌리므로 새 실행기다. `qaDocClean`의 호출은 그대로다 |
| QA 문서 판정 | `qaDocClean`(502행)·`qaDocFingerprint`·`DocsHygiene.test.ts`의 `WF_QA_DOC` 경로 | 「`tests/logic` 없으면 건너뜀」 예외만 없앤다(CEO 항목) |
| `.meta` 누락 검사 | `listMissingAssetMeta`·`requireAssetMeta`(366~423행) | 그대로 쓰고 적용 여부만 앞에 건다 |
| git 띄우기 | `workflow.mjs` `git(args, opts)`(358행) — `switch`는 `{ stdio: "inherit" }`를 넘긴다(449~450행) | `.claude/lib/git.mjs`로 옮기되 `opts`를 받아야 한다(아래 S0-1) |
| 정본 문서 판정 | `workflow.mjs` 120~228행 ↔ `tests/helpers/CanonDoc.ts` 168줄(복사본) | W4가 한 벌로 합친다 |
| 절차 문서 정합 판정 | `workflow.mjs` `check-docs`(922행) ↔ `tests/helpers/WorkflowSteps.ts` 99줄 | W4 |
| 임시 저장소·샌드박스 | `DocsHygiene.test.ts` `makeRepo`(188행) · `ClaudeMdSplit.test.ts` `makeSandbox`(210행)·`runWf`(267행) | W5가 `WfSandbox.ts`로 합친다 |
| 변경 집합 | 없음 — `git diff --name-status`·`ls-files -o`는 git 기본 기능 | W1이 새로 짠다. 경로 맞추기는 git pathspec 실험(CEO 항목)이 정한다 |
| 통합 검사 실행기 | 없음 — `package.json`의 `check`·`typecheck`·`test:run`이 따로 있다 | W2가 새로 짠다. 명령줄은 기존 스크립트와 같은 바이너리를 부른다 |
| 커밋 훅 | `.husky/pre-commit` = `pnpm lint-staged`, 대상 `*.{ts,tsx,js,jsx,json}` | `mjs`·`cjs`만 더한다 |

**최소 변경 점검.** 새 코드 가운데 미룰 수 있는 것은 없다 — 셋(건너뛰기·통합 검사·한 벌)이 서로 기대고, 사용자가 2026-10-05에 축소형 A로 이미 줄였다. 범위가 느는 쪽은 테스트 도우미(가짜 `pnpm`·git 격리)인데, 그것이 없으면 기존 E2E 셋이 깨진다(계획 W2 「실제 프로세스로 도는 기존 테스트」).

**복잡도.** 바뀌는 파일은 약 32개다 — 도구 2(`workflow.mjs`·`typecheck.mjs`), 설정 4(`biome.json`·`package.json`·`tsconfig.tests.json`·`.gitignore`), 테스트 도우미 3(새 `WfSandbox.ts`, 지우는 `CanonDoc.ts`·`WorkflowSteps.ts`), 테스트 5(새 `WorkflowDiet.test.ts`, 고치는 `ClaudeMdSplit`·`DocsHygiene`·`EolPolicy`·`CanonDoc`), 견본 1, 문서 약 17(절차 문서 5 + README + `CLAUDE.md` + 트러블슈팅 3 + `ops-skill-routing.md` + 백로그 3 + 세션 계획 문서). 새 모듈은 일곱(`git`·`change-set`·`verify`·`transition`·`canon`·`workflow-steps`·`phases`), 새 클래스·서비스는 0이다.

**B. 복잡도 선택.** 8개 이상이라 게이트가 선다. `/autoplan` 규칙(범위를 줄이지 않는다, P2)과 CEO 단계의 결정(#1 SELECTIVE EXPANSION 유지)으로 자동 결정한다. 기능 삭감 질문: 제안할 삭감 없음. 구조 질문: **원래 배치** 유지 — 더 작은 배치는 모듈을 다시 `workflow.mjs`에 넣는 것뿐인데, 그러면 F78(두 벌인 판정 코드)을 닫지 못한다. 범위 기록: `feature answers: 삭감 제안 없음(자동); structure: A 원래 배치(자동, /autoplan P2·DAT #1); accepted scope: 계획 §5 W1~W7 전부; pending remedies: 없음`.

**검색 점검.** 새 아키텍처 패턴·인프라·동시성은 없다. 쓰는 것은 전부 기존 도구의 기본 기능이다 — git pathspec·`merge-base`·`ls-files` **[Layer 1]**, vitest JSON reporter **[Layer 1]**, biome 종료 코드·`lint` 부명령 **[Layer 1]**, `spawnSync` **[Layer 1]**. Aside는 없고 웹 검색은 이 프로젝트 규칙상 쓰지 않으므로, 대신 Context7로 공식 문서 둘을 확인했다: biome CLI 참조는 `json`·`json-pretty` reporter를 「experimental, 패치 판에서 바뀔 수 있다」고 적는다(아래 E5 판정의 근거). vitest `json.ts` 소스는 파일 suite가 실패하면 `testResults[].status='failed'`·`message`가 채워지고 `numFailedTests`는 0일 수 있음을 보여 준다(E3의 근거).

**TODOS 교차 참조.** 이 저장소에는 `TODOS.md`가 없고 백로그 3분할(`backlog.md`·`backlog-implement.md`·`backlog-docs.md`)이 그 자리다(`CLAUDE.md`). 이 계획을 막는 항목은 없다. 닫는 항목 F78·F95, 고치는 항목 F10·F61·F71·F96·F109, 새 항목 일곱은 W7에 있다. Eng가 미루는 A6(아래)은 여덟째 새 항목으로 W7에 더한다.

**완전성·배포 점검.** 테스트·경계·오류 길은 계획이 묶음마다 든다. 배포 산출물은 없다(저장소 안 도구, CI 없음 — §2.2).

**C. 범위 검토 결과.**

- **S0-1** [P1] (confidence: 9/10) `workflow.mjs:358,449-450` — 계획의 `git(root, args)`에는 `opts`가 없는데, 지금 `git()`은 `opts`를 받아 `switch`가 `{ stdio: "inherit" }`로 사용자에게 git 출력을 보여 준다(`git(["switch", branch], { stdio: "inherit" })`). 그대로 옮기면 `wf start`의 전환 출력이 사라진다. 고침: `git(root, args, opts = {})`. — **수용**(DAT #71).
- **S0-2** [P2] (confidence: 8/10) 계획 W5 「`bin/pnpm`(그 밖)은 같은 파일을 부르는 셸 스크립트 한 줄」 — POSIX에서 실행 비트가 없는 파일은 `spawnSync`가 `EACCES`로 끝낸다. `fs.writeFileSync`는 0o644로 만든다. 사용자의 맥북에서 E2E가 전부 「실행기를 실행할 수 없다」로 깨진다. 고침: 쓰고 나서 `fs.chmodSync(path, 0o755)`. — **수용**(DAT #72).
- **S0-3** [P3] (confidence: 7/10) 계획 CEO 항목 「`verify.mjs`의 실행별 임시 폴더는 `finally`에서 지운다」 — Windows에서 `fs.rmSync`는 방금 만든 파일을 Defender가 읽는 동안 `EBUSY`/`EPERM`을 던질 수 있다. `finally` 안에서 던지면 검사 결과가 그 예외에 덮인다. 고침: 재시도 옵션 + try/catch. 리뷰어 E7과 합쳐 처리한다. — **수용**(DAT #85).

결과: **scope accepted as-is**(FULL_REVIEW). 보류 중인 처방 없음.

#### Step 0.5 양쪽 목소리 (Dual Voices)

**Codex SAYS (eng — architecture challenge):** 돌리지 못했다. 사전 점검 결과 `codex_reviews=enabled`이지만 `codex` CLI가 이 장비에 없다(`not_installed`). 이전 두 단계와 같은 사정이고 외부 커버리지는 「없음」으로 적는다. 대체로 아래 Claude 서브에이전트가 돌았다(원래 설계의 native 쪽이지 outside 커버리지가 아니다).

**Claude SUBAGENT (eng — independent review):** 독립 리뷰어가 `native-prompt.md` 468줄을 세 번에 나눠 전부 읽고 `INPUT: eng 489bbff1…`로 시작하는 보고를 냈다. 코드 대조 파일은 위 목록과 같다. 전체 방향은 타당하다고 봤고 26건을 냈다(심각도: Medium 7, Low 19). 「확인한 전제(문제 없음)」로 든 것: `--no-renames`·`-z`·`T→M`·상태 파일 제외·미추적 `.meta` 제외, 훅이 `phases.mjs`를 import하지 않는 이유(PreToolUse 훅이 2가 아닌 코드로 죽으면 편집이 통과한다 = fail-open), `biome.json` 제외 목록 변경과 `vcs.useIgnoreFile`, lint-staged에 `mjs`가 정말 빠져 있음, `tests/logic`에서 `child_process`를 쓰는 파일 셋, 이 슬라이스의 기대 판정(`meta`·`fullTypecheck` 해당 없음, `cso` 적용).

| ID | 심각도 | 지적 | 판정 | 근거 |
|---|---|---|---|---|
| A1 | Medium | 해당 없음일 때 `pass cso`가 `cso_done: true`를 적으면 뒤에 `/cso`가 적용으로 바뀌어도 그 값이 판정을 지난다 | **수용** | 적용 여부는 매번 다시 계산하면서 통과 표시는 남기는 비대칭. `cso_commit`만 적고 `cso_done`은 거짓(DAT #73) |
| A2 | Low | `decideTransition`의 되부르기 대신 게으른 함수 둘을 인자로 | 기각 | CEO 항목이 되부르기 모양을 이미 정했고 `qaClean?`·`verifyResult?`가 선택 입력인 것은 그 설계와 맞다(「문서 안에서 어긋난다」는 오독). 두 안의 명시성은 같다(DAT #74) |
| A3 | Low | `change-set.mjs`가 잡동사니가 된다 — git 실행·순수 판정을 가르자 | **수용(축소)** | `git.mjs`(실행) · `change-set.mjs`(수집·경로 정책·`csoBaseUsable`) · `transition.mjs`(`decideTransition`·`qaRequired`·`approvePrDecision`·`formatGateLines`). 새 모듈 일곱(DAT #75) |
| A4 | Low | `user-verification`에서 `verify`가 biome `--write`로 잠긴 게임 스크립트를 고친다 | **수용** | `gate-scripts.mjs`가 막는 phase에서 도구가 코드를 쓰면 안 된다. 그 phase에서는 `write: false` 고정(DAT #76) |
| A5 | Low | biome(`--write`) → 타입 검사 → vitest 순이어야 타입 검사가 디스크의 최종 코드를 본다 | **수용** | 비용 0(DAT #77) |
| A6 | Low | `workflow.mjs`가 tsc·biome 밖에서 계속 커진다 — 명령 본문을 `lib/`로 더 밀고 `.claude/**` override로 biome에 넣자 | 미룸 | 이 슬라이스 밖. W7 새 항목으로(DAT #78) |
| E1 | Medium | `git -c core.autocrlf=false init`은 `init`에만 듣고 뒤 명령은 전역 설정을 읽는다(`commit.gpgsign`·`core.hooksPath`) | **수용** | `GIT_CONFIG_NOSYSTEM`·`GIT_CONFIG_GLOBAL`·작성자 env + 저장소 안 `config`(DAT #79) |
| E2 | Medium | `error`가 있으면 전부 「pnpm 경로 확인」으로 읽는다 — `ENOBUFS`(tsc 수천 줄)가 「pnpm 없음」으로 보고된다 | **수용** | `error.code`로 가르고 실행기 셋에도 `maxBuffer` 64MiB. DX H1·H2 판정 문장을 대체(DAT #80) |
| E3 | Low | vitest 수집 오류는 `numFailedTests`에 안 잡힌다 | **수용** | vitest `json.ts`로 확인. `success:false`면 실패, 「파일 실패 n」 더함(DAT #81) |
| E4 | Low | `merge-base`가 공통 조상을 못 찾는 경우가 `measurable: false` 목록에 없다; `--is-ancestor` 128을 변경 집합 실패와 섞지 말 것 | **수용** | 종료 코드 1·빈 출력은 지금 목록을 전부 지난다(DAT #82) |
| E5 | Low | biome summary 글자를 읽는 분류는 판이 바뀌면 조용히 깨진다 — `--reporter=json`으로 | **수용(다른 처방)** | biome 문서가 JSON reporter를 experimental로 적는다. 분류는 종료 코드로: `check` 실패 뒤 `biome lint .`를 한 번 더 띄워 통과하면 「형식만」(DAT #83) |
| E6 | Low | pathspec 실험 전에 `:(glob)` 중괄호·`icase` 범위·호출 횟수를 정해 둘 것 | **수용** | 실험 해석이 흔들리지 않게(DAT #84) |
| E7 | Low | Windows `rmSync`는 `EBUSY`/`EPERM`에 던진다 — 재시도 옵션 | **수용** | S0-3과 합침(DAT #85) |
| T1 | Medium | 끝까지 도는 E2E 한 건이 Windows에서 1~1.5초, 스위트 기준선 3.6초가 서너 배로 — 그 스위트가 검증마다 세 번 돈다 | **수용** | E2E 상한·`testTimeout`·시간 따로 재기(DAT #86) |
| T2 | Low | 빠진 테스트 다섯 | **수용** | 전부 한 줄씩(DAT #87) |
| T3 | Low | `child_process` 가드는 직접 import만 본다 — 도우미 API가 좁아야 한다 | **수용** | S1과 함께(DAT #88) |
| S1 | Medium | `WfSandbox.git(dir, ...args)`가 인자를 그대로 넘기면 `/cso` 밖 경로에서 `-c core.fsmonitor=<명령>`으로 임의 명령이 돈다 | **수용** | 부명령 허용 목록(DAT #88) |
| S2 | Low | `CSO_PATHS`에 `game/package.json`이 없다 | **수용** | `git ls-files`로 추적 확인(DAT #89) |
| S3 | Low | `TMP`에 `"`가 든 장비에서 `shell: true` 명령줄이 깨진다 | **수용** | 명확한 오류 한 줄(DAT #90) |
| S4 | Low | 복구 문서 둘째 길 뒤 `git diff .claude/workflow-state.json`으로 바뀐 키를 보라는 줄 | **수용** | 한 줄(DAT #91) |
| H1 | Medium | `pass`의 통합 검사가 진짜로 실패하면 도구가 그 자리에서 판단 검사 표시를 지워야 한다 | **수용 — Taste** | 실패 직후 고치고 `pass review`를 다시 치는 길에서 고치기 전 코드의 리뷰 표시가 통과한다. 형식만 실패·환경 실패는 예외(DAT #92) |
| H2 | Low | `verify.mjs`가 import하는 `typecheck.mjs`에도 `@ts-check`를 붙일지 W4에서 정할 것 | **수용** | 붙인다 — 86줄에 JSDoc이 이미 있다(DAT #93) |
| H3 | Low | `pass review`가 `DocsHygiene.test.ts`를 두 번 돌린다(약 1초) | **수용(기록)** | §10에 적는다(DAT #94) |
| H4 | Low | 글자 수 상한 상수 주석에 「넘기려면 계획 문서에 이유를 적고 값을 올린다」 | 변경 없음 | W6이 이미 「이 규칙을 테스트의 상수 위 주석에 적는다」고 든다(DAT #95) |
| H5 | Low | §4 메모리 목록에 `feedback_doc_only_slice_skips_wf` | **수용** | 머지 때 다시 본다(DAT #96) |
| H6 | Low | §0 「판단 검사 넷」 ↔ `verification.md` 첫머리 「판단 검사 둘」 | **수용** | 「통과 표시를 남기는 판단 검사 둘」(DAT #97) |

```
ENG DUAL VOICES — CONSENSUS TABLE:
  Dimension                           Claude   Codex  Consensus
  1. Architecture sound?               YES*     —      N/A (single voice; A1·A4 고침 뒤 YES)
  2. Test coverage sufficient?         YES*     —      N/A (T1·T2 고침 뒤 YES)
  3. Performance risks addressed?      PARTIAL  —      N/A (T1 스위트 시간, E2 maxBuffer)
  4. Security threats covered?         YES*     —      N/A (S1 도우미 좁히기, S2 한 줄)
  5. Error paths handled?              PARTIAL  —      N/A (E2·E3·E4 — 환경 실패를 코드 실패로 읽는 길)
  6. Deployment risk manageable?       YES      —      N/A (복구 문서 W6, 훅은 독립)
CONFIRMED = native + outside agree; primary cannot replace outside. DISAGREE → taste.
Missing/disabled voice = N/A, never CONFIRMED. Flag any single-voice critical finding.
단일 목소리 critical: 없음 (Medium 7건이 최고 — 전부 수용했다). Codex 없음.
```

#### Section 1 — 아키텍처

```
                    pnpm wf <명령>            PreToolUse 훅
                         │                        │
                 .claude/workflow.mjs      .claude/hooks/gate-scripts.mjs
                 (상태 파일의 유일한 작성자)   (phase → 편집 허용, import 없음)
                 │       │        │     │              │
                 │       │        │     └── typecheck.mjs ◄── runTypecheck({capture})
     ┌───────────┘       │        └────────────┐
     ▼                   ▼                     ▼
 lib/transition.mjs   lib/change-set.mjs    lib/verify.mjs
 (입력→답, git 없음)  (경로 상수·수집·       (biome → tsc → vitest,
  decideTransition     applicableGates·       결과 파일은 실행별 임시 폴더)
  qaRequired           csoBaseUsable·          │
  approvePrDecision    /cso 명령 상수)         └── pnpm exec … (shell: true)
  formatGateLines          │
                           ▼
                      lib/git.mjs ──── spawnSync("git", …, maxBuffer 64MiB)
                      (workflow.mjs의 switch·fetch도 이것을 쓴다)

 lib/canon.mjs · lib/workflow-steps.mjs · lib/phases.mjs
   ▲                        ▲                  ▲
   └── workflow.mjs         └── workflow.mjs   └── workflow.mjs · 테스트
   └── tests/logic/CanonDoc.test.ts            (훅은 자기 값을 둔다 — 테스트가 같음을 확인)

 tests/helpers/WfSandbox.ts ── makeRepo(opts)·runWf·git(허용 목록) ── bin/fake-pnpm.mjs
                                                                      (repo/의 형제 폴더)
```

- **경계와 결합.** 상태 파일은 `workflow.mjs`만 쓴다(계획 W1 「`.claude/lib/*.mjs`는 상태 파일을 읽거나 쓰지 않는다」). `lib/`는 두 종류로 갈린다 — git을 띄우는 파일(`git.mjs`·`change-set.mjs`)과 입력만으로 답하는 파일(`transition.mjs`·`canon.mjs`·`workflow-steps.mjs`·`phases.mjs`). 이 구분이 테스트 성격(임시 저장소가 필요한가)을 정한다(A3).
- **데이터 흐름.** `pass review` 한 번: 상태 읽기 → `collectChangeSet`(git 3~4회) → `applicableGates` → `decideTransition`(통과 표시·정본) → `needsQa`면 `qaDocClean`(vitest 1회) → 다시 → `needsVerify`면 `runVerify`(biome·tsc·vitest) → 다시 → 전이. 되부르기는 둘 다 「앞 조건이 전부 통과했을 때만 비싼 검사를 돌린다」를 위한 것이고 CEO 단계에서 정했다.
- **병목·단일 실패점.** `workflow.mjs`가 여전히 모든 명령의 본문을 든다(A6, 미룸). 훅은 `lib/`를 import하지 않으므로 `lib/`의 문법 오류가 편집을 잠그지 않는다(계획 W4, 리뷰어 확인).
- **보안.** `shell: true`로 띄우는 명령줄의 인자는 전부 도구 내부 상수와 `mkdtempSync` 경로다(사용자 입력 없음). `TMP`에 `"`가 든 환경만 막는다(S3). `CSO_PATHS`는 「개발 장비에서 실행되는 코드」 정책이고, `game/package.json`이 빠져 있었다(S2). 테스트 도우미가 git 전역 옵션을 그대로 넘기면 `/cso` 밖 경로에서 명령이 돈다(S1).
- **새 경로별 현실적인 실패 하나.** `collectChangeSet`: `origin/main`이 없거나 공통 조상이 없음 → `measurable: false`로 모든 검사를 적용(fail-closed, E4로 완성). `runVerify`: 실행기를 못 찾거나 출력이 잘림 → 실패로 세고 원인별 문장(E2). `decideTransition`: 입력만 받으므로 실패 없음. `pass` 되부르기: 통합 검사 실패 → 넘어가지 않고 판단 검사 표시를 지움(H1). `skip-qa`: 게임 변경이 생김 → `pass`가 문서를 요구(계획 W2). `approve-pr`: 타입 검사 실패 → `rework` 안내(지금과 같다). 가짜 `pnpm`: 실행 비트 없음 → E2E 전멸(S0-2).
- **배포 아키텍처.** 산출물 없음. 이 브랜치의 `workflow.mjs`가 이 슬라이스의 검증을 돌리는 것이 유일한 「배포」이고, 깨졌을 때의 길은 W6 복구 문서가 든다.

Dispositions: A1 수용(#73) · A3 수용(#75) · A4 수용(#76) · A5 수용(#77) · A6 미룸(#78) · S2 수용(#89) · S3 수용(#90).

#### Section 2 — 코드 품질

**공유 코드 평가(W4, 규칙대로).**
- 호출자 둘 확인: `parseCanonSlug`·`assertOneLineField`·`renderCanonDoc`·`insertCanonRow`·`locateCanonListTable`은 `workflow.mjs` 128~202행(`canon`·`canon-done` 명령이 부른다)과 `tests/helpers/CanonDoc.ts` 39~168행(`CanonDoc.test.ts`가 부른다)에 있다. `findStepDocIssues`·`DOC_EXEMPT_PHASES`·`STEP_DOC_INDEX`는 `workflow.mjs` 230~234·922~940행과 `tests/helpers/WorkflowSteps.ts` 28~99행에 있다. `EDITABLE_PHASES`는 `workflow.mjs:36`과 `gate-scripts.mjs:13`에 있다(훅 쪽은 남긴다).
- 재사용 먼저: 기존 의존성에 같은 일을 하는 것이 없다(저장소 고유 규칙).
- 작은 도우미: 세 모듈의 계약은 지금 함수 서명 그대로다. 옮기는 순서는 함수 하나로 타입 검사 비용을 재는 것부터(계획 §10).
- 변경 전체: 구현 줄 삭제 약 110(`workflow.mjs` canon 절) + 99(`WorkflowSteps.ts`) + 168(`CanonDoc.ts`) ≈ 377, 추가 약 300(세 모듈 + JSDoc), 순절감 약 70줄. 테스트·통합을 더하면 `ClaudeMdSplit.test.ts`의 「두 곳에 복사」 확인이 「한 모듈」 확인으로 바뀌고 import 경로가 바뀐다 — 총 변경은 더 커지되 복사본은 0이 된다. 신뢰 이득은 「규칙을 바꾸면 두 곳을 함께 고친다」는 주석(`workflow.mjs:118-119`)이 사라지는 것이다.
- 순위: 신뢰 이득이 주이고 줄 수 절감은 부차다. 기각할 유사성 없음.

**발견.**
- **S0-1** [P1] (9/10) `git()`의 `opts` — 위 Step 0. 수용(#71).
- **H2** [P3] (8/10) `typecheck.mjs:44-50` — `runTypecheck`에 JSDoc 반환 타입이 이미 있다. `verify.mjs`가 import하면 `allowJs`로 프로그램에 들어오므로 `// @ts-check`를 붙여 호출부 검사를 살린다. 수용(#93).
- **E5** [P2] (8/10) 계획 W2 「biome은 `--reporter=summary`로 돌린다 … 린트 위반만 실패로 센다」와 DX 항목 「형식 차이만으로 실패하면」 — 둘을 가르는 분류기가 summary 글자라면 판이 바뀔 때 조용히 깨진다. 그런데 리뷰어의 처방(JSON reporter)도 biome 문서가 experimental로 적는다. 판정은 종료 코드로 한다: `write: false`에서 `biome check`가 실패하면 `biome lint .`를 한 번 더 띄워 통과하면 「형식 차이만」, 아니면 린트 실패. 추가 호출은 실패 길에서만 든다(약 0.5초). 수용(#83).
- **E6** [P3] (8/10) 계획 CEO 항목(pathspec 실험) — `:(glob)`은 중괄호 확장을 하지 않고 `icase`는 pathspec 전체에 걸린다. 실험 전에 적어 둔다. 수용(#84).
- **H6** [P3] (9/10) 계획 W6 표 ↔ §0 — 수 어긋남. 수용(#97).
- **A2** 기각(#74) — 위 표.
- 오류 처리 틈: E2(실행기 실패 분류)·E3(수집 오류)·E4(공통 조상 없음)는 「환경 실패를 코드 실패로, 또는 그 반대로 읽는 길」이다. 셋 다 수용.

Dispositions: S0-1 수용(#71) · H2 수용(#93) · E5 수용(#83) · E6 수용(#84) · H6 수용(#97) · A2 기각(#74).

#### Section 3 — 테스트 검토

**프레임워크.** `CLAUDE.md`에 `## Testing` 절은 없다. `package.json`의 `test`·`test:run`이 vitest이고 `vitest.config.ts`가 `tests/**/*.test.ts`를 든다. 기준선 48개 파일·1,114개 통과(계획 §7). 피처 테스트는 `tests/logic/WorkflowDiet.test.ts`(`ready-impl`의 RED 게이트가 `.claude/lib/*.mjs`가 없어 import에 실패하는 것으로 선다).

**Step 1~2. 경로와 흐름.** 아래 다이어그램은 계획이 든 코드 경로(전부 제안)와 AI·사용자가 밟는 흐름이다. `[계획 ★★★]`는 계획의 「테스트」 절에 이미 든 것, `[GAP→추가]`는 이 리뷰가 더한 것, `[★★ 있음]`은 지금 있는 테스트가 그대로 지키는 것이다.

```
CODE PATHS                                                      AI/USER FLOWS
[+] lib/git.mjs · lib/change-set.mjs                            [+] 문서만 고치는 슬라이스
  ├── collectChangeSet()                                          ├── [계획 ★★★] skip-qa → ready-impl 문서 없이 통과
  │   ├── [계획 ★★★] 수정·새 파일·삭제·이름 바꾸기·공백·한글명      ├── [계획 ★★★] status: 셋 해당 없음
  │   ├── [계획 ★★★] 상태 파일·미추적 .meta 제외                    ├── [수정 ★★★] pass cso → cso_commit만, cso_done 거짓(A1)
  │   ├── [계획 ★★★] origin/main 없음·하위 폴더·git 오류 → 전부 적용   └── [계획 ★★★] pass review → 통합 검사 → user-verification
  │   ├── [계획 ★★★] T→M, U → measurable:false                   [+] 게임 슬라이스
  │   ├── [GAP→추가] 공통 조상 없음 → measurable:false (E4)          ├── [계획 ★★★] meta·fullTypecheck 적용, QA 필요
  │   └── [GAP→추가] git add만 한 새 파일 = A, 미커밋 수정 = M (T2)   ├── [계획 ★★★] skip-qa 뒤 game/** 변경 → pass가 문서 요구 (E2E)
  ├── applicableGates() [계획 ★★★] 대표 변경 집합 일곱 줄·경계 넷      └── [계획 ★★★] approve-pr: 적용 판정 표 → 타입 → .meta → pr-ready (E2E)
  └── csoBaseUsable() [계획 ★★★] 조상 아님 / [GAP→추가] 128 (E4)    [+] 검증 중 코드 수정
[+] lib/transition.mjs                                            ├── [계획 ★★★] invalidate: cso_done·review 비움, cso_commit·기록 셋 남김
  ├── decideTransition()                                          ├── [수정 ★★★] pass review 통합 검사 실패 → 표시 자동 삭제 (H1)
  │   ├── [계획 ★★★] 통과 → 전이·적을 값                             ├── [계획 ★★★] 형식만 실패 → 표시 유지·verify 안내 (E2E 변형)
  │   ├── [수정 ★★★] 실패 → 표시 비움·기록 셋 남김 (H1)                └── [GAP→추가] pass cso 전 pass review → 통합 검사 안 돔 (T2)
  │   ├── [계획 ★★★] cso 해당 없음이면 cso_done 안 봄                [+] 환경 실패
  │   ├── [계획 ★★★] QA·정본에서 막힘, needsQa·needsVerify 순서        ├── [계획 ★★★] 실행기 없음(ENOENT·9009·127)
  │   └── [계획 ★★★] 앞 조건 막히면 needsVerify 거짓                  ├── [GAP→추가] ENOBUFS → 「출력이 잘렸다」 (E2)
  ├── qaRequired() [계획 ★★★] 판정표 네 줄                           ├── [계획 ★★★] vitest 결과 없음·깨진 JSON
  ├── approvePrDecision() [계획 ★★★] 다섯 갈래 / [GAP→추가] measurable:false (T2)   └── [계획 ★★★] tsconfig.cocos.json 처방 두 길
  └── formatGateLines() [계획 ★★★] 문자열 고정                      [+] 사용자 검증·복구
[+] lib/verify.mjs                                                 ├── [계획 ★★★] verify 세 phase·planning 거부
  ├── runVerify()                                                 ├── [GAP→추가] verify가 다른 키를 안 건드림 (T2)
  │   ├── [계획 ★★★] 전부 성공·일부·전부 실패, 시간·네 수              ├── [수정 ★★★] user-verification verify = write:false (A4)
  │   ├── [수정 ★★★] 순서 biome→tsc→vitest (A5)                    └── [계획 — 손 확인] 일부러 넣은 실패 셋, 머지 뒤 status·wf start
  │   ├── [GAP→추가] suite 실패·test 실패 0 → 실패 (E3)             [+] 테스트 기반
  │   ├── [수정 ★★★] 형식만 vs 린트: lint 재실행으로 분류 (E5)          ├── [계획 ★★★] tests/logic이 child_process·worker_threads를 import 안 함
  │   └── [계획 ★★★] 임시 폴더 정리 / [수정] 재시도 (E7)               ├── [계획 ★★★] 게임 코드가 .json을 import 안 함
  └── runTypecheck({capture}) [계획 ★★★] 진행 줄 안 찍음              ├── [계획 ★★★] 훅 EDITABLE_PHASES == phases.mjs, lint-staged에 mjs
[+] workflow.mjs 명령                                               ├── [GAP→추가] 글자 수 세는 단위·CRLF 정규화 명시 (T2)
  ├── [계획 ★★★] start-verification 성공·실패 (E2E 둘)              └── [★★ 있음] ClaudeMdSplit 56건·DocsHygiene 29건 (내용 유지)
  ├── [계획 ★★★] pass ts 거부, skip-qa 거부·--clear, verify 전이 없음
  ├── [계획 ★★★] 옛 형식 상태 파일 다섯 자리
  └── [★★ 있음] 배달·정본 게이트·QA 지문·wf start 기준 — 기존 E2E
[+] tests/helpers/WfSandbox.ts
  ├── [수정] git 격리 env + 저장소 config (E1)  ├── [수정] 부명령 허용 목록 (S1)
  ├── [수정] 가짜 pnpm chmod 0o755 (S0-2)      └── [수정] rmSync 재시도 (E7)

COVERAGE(제안 경로): 계획이 든 것 41 + 이 리뷰가 더한 것 9 = 50 / 50 (100%, 전부 제안·구현 전)
QUALITY: ★★★ 계획·추가 50  |  ★★ 있음(유지) 85건  |  GAPS: 0 (E2E 2, 손 확인 1 — 계획 §7)
```

Legend: `[계획 ★★★]` 계획의 테스트 절에 든 것 | `[GAP→추가]` 이 리뷰가 더한 것 | `[수정 ★★★]` 리뷰로 내용이 바뀐 것 | `[★★ 있음]` 지금 테스트가 지킨다 | `[→E2E]`는 계획이 이미 실제 프로세스로 정한 것을 「(E2E)」로 적었다.

**Step 3. 기존 테스트 대조.** 기존 E2E(`ClaudeMdSplit.test.ts` 56건, `DocsHygiene.test.ts` 29건)는 W5가 도우미로 옮기되 「확인하는 내용은 바꾸지 않는다」(계획). `pass`를 자식 프로세스로 띄우는 세 케이스는 가짜 `pnpm`으로 살린다. 가치 기준: 위 `[GAP→추가]` 아홉은 모두 「어떤 회귀가 깨뜨리나」가 있다(아래 카드). ★ 수준의 존재 확인은 없다.

**회귀 규칙.** 위험에 놓이는 기존 동작은 `pass`의 전이·QA 지문·정본 게이트, `start-verification`, `approve-pr`, `wf start`의 기준 검사, 절차 문서 배달이다. 기존 E2E 85건이 그대로 지키고(계획 W5의 약속), 바뀌는 동작은 `pass ts`·`pass lint`의 거부와 `start-verification`이 통합 검사를 도는 것뿐이다 — 그 둘은 새 테스트가 든다. 새 질문 없음(정확한 약속이 계획에 있다).

**LLM/eval 범위.** 프롬프트·LLM 코드 변경 없음(`CLAUDE.md`에 해당 패턴 목록도 없다). eval 없음.

**Step 5. 더한 테스트(값 카드).**
- `collectChangeSet` 미커밋 변경: `Value: protects=변경 집합이 작업 트리 기준이라는 전제; fails_when=HEAD 기준 diff로 바꾸거나 ls-files를 빠뜨리면; why_new=W1 목록이 커밋된 경우로 읽힐 수 있다; seam=none`
- `collectChangeSet` 공통 조상 없음: `Value: protects=기준을 모르면 전부 적용; fails_when=merge-base 종료 코드 1을 성공으로 읽으면; why_new=지금 목록은 status null만 본다; seam=none`
- `approvePrDecision` `measurable:false`: `Value: protects=기준 없으면 logic-only 거부; fails_when=gates 기본값이 해당 없음이면; why_new=다섯 갈래에 없다; seam=none`
- `verify` 키 불변: `Value: protects=verify는 기록용 값 셋만 적는다; fails_when=resetVerification을 잘못 부르면; why_new=기존 테스트는 phase만 본다; seam=none`
- `pass review` before `pass cso`: `Value: protects=앞 조건이 막히면 통합 검사를 돌리지 않는다; fails_when=needsVerify 순서가 바뀌면; why_new=W2 2번 문장의 실체; seam=none`
- `ENOBUFS` 분류: `Value: protects=출력이 잘린 것을 pnpm 없음으로 읽지 않는다; fails_when=error.code를 안 보면; why_new=DX 판정 문장이 error 전부를 한 갈래로; seam=none`
- vitest suite 실패: `Value: protects=수집 오류가 성공으로 읽히지 않는다; fails_when=numFailedTests만 보면; why_new=vitest json.ts 확인; seam=none`
- `--is-ancestor` 128: `Value: protects=없는 커밋은 전체 /cso; fails_when=128을 measurable:false로 읽으면; why_new=둘을 섞지 않게; seam=none`
- 글자 수 단위: `Value: protects=상한 비교가 장비마다 같다; fails_when=CRLF로 읽거나 단위가 다르면; why_new=11자 차이가 넘었다로; seam=none`

**폐기되는 테스트.** 없음. 지워지는 것은 테스트가 아니라 도우미 둘(`CanonDoc.ts`·`WorkflowSteps.ts`)이고 그 테스트는 새 모듈을 import한다. `ClaudeMdSplit.test.ts`의 「두 곳에 복사」 확인은 「한 모듈」 확인으로 고친다(계획 W4).

**테스트 계획 산출물.** `C:\Users\Choi-HC\.gstack\projects\dev-HongCheol-monster\Choi-HC-feat-workflow-diet-eng-review-test-plan-20261006-125851.md`에 썼다. 보류 결정 없음.

Dispositions: T1 수용(#86) · T2 수용(#87) · T3·S1 수용(#88) · E1 수용(#79) · E7·S0-3 수용(#85) · S0-2 수용(#72).

#### Section 4 — 성능

- **T1** [P2] (7/10) 스위트 시간 — 끝까지 도는 E2E 한 건은 `cmd.exe`를 거쳐 node를 약 5번 띄운다(`workflow.mjs` + `qaDocClean` vitest 가짜 + 실행기 셋 가짜). Windows에서 건당 1~1.5초(추정, 미실측), 같은 파일 안은 직렬. 기준선 3.6초(계획 §10)가 서너 배 될 수 있고 검증마다 세 번(`start-verification`·`verify`·`pass`) 돈다. 상한: 통합 검사까지 가는 E2E는 여섯 이하(`start-verification` 성공·실패, `verify` 전이 없음, `pass review` 실패·형식만 실패, `skip-qa` 뒤 게임 변경). `approve-pr`·`status` E2E는 통합 검사 전에 끝나 가볍다. `WfSandbox`를 쓰는 파일은 `testTimeout: 30_000`. 구현 뒤 §10에 스위트 전체와 샌드박스 파일만의 시간을 따로 적는다. 수용(#86).
- **H3** [P3] (9/10) `pass review`가 `DocsHygiene.test.ts`를 두 번 돌린다(`qaDocClean`의 `WF_QA_DOC` 호출 + 통합 검사의 전체 스위트, 약 1초). 지금은 받아들이고 §10에 적는다 — 2단계에서 QA 판정을 통합 검사 안에 넣을지의 근거. 수용(#94).
- **E2** [P2] (8/10) `maxBuffer` — 실행기 셋의 `spawnSync` 기본 1MiB. tsc가 수천 줄을 내는 날 `ENOBUFS`. 64MiB. 수용(#80).
- `status`의 git 호출 — `merge-base`·`diff`·`ls-files`·`show-prefix`·(`is-ancestor`) 4~5회, Windows에서 합쳐 0.2~0.3초(추정). pathspec 실험이 게이트마다 한 번으로 가면 +4회. 허용.
- 메모리·캐시·N+1 — 해당 없음(단발 CLI, 결과 파일은 수십 KB).

Dispositions: T1 수용(#86) · H3 수용(#94) · E2 수용(#80).

#### Outside Voice

사전 점검: `codex_reviews=enabled`, `codex` CLI 없음 → `not_installed`. 설치 안내: `npm install -g @openai/codex`. 네이티브 대체는 위 Claude 서브에이전트이고 외부 커버리지는 **없음(unavailable)**으로 적는다. Cross-model tension은 돌지 않았다. 리뷰 로그는 최종 승인 게이트에서 다른 단계와 함께 남긴다.

#### 필수 산출물

**NOT in scope.**
- `workflow.mjs`를 biome·tsc 검사 대상에 넣고 명령 본문을 `lib/`로 더 옮기는 일(A6) — 이 슬라이스는 F78(복사본 제거)까지다. W7 새 항목.
- QA 판정(`qaDocClean`)을 통합 검사 안에 넣는 일(H3) — 2단계가 통과 표시 방식을 바꿀 때 함께 본다.
- 상태 파일 git 추적(F10), 계획 절차 문서의 리뷰 구성, 검사 횟수 기록 — 계획 §2.3 그대로.
- 서브에이전트 리뷰를 다른 도구로 옮기는 일 — 계획 §4.

**What already exists.** 위 Step 0 A 표. 다시 짜는 것은 변경 집합과 통합 검사 실행기뿐이고, 둘 다 git·vitest·biome·tsc의 기본 기능을 부르는 얇은 층이다. W4는 재사용이 아니라 복사본 제거다(공유 코드 평가는 Section 2).

**다이어그램.** 의존 그래프(Section 1)와 테스트 다이어그램(Section 3). 인라인 다이어그램이 필요한 파일: `transition.mjs`(되부르기 순서 — `decideTransition` JSDoc에 「통과 표시 → QA → 정본 → 통합 검사 → 전이」 순서를 적는다), `change-set.mjs`(적용 경로 상수 위 정책 주석 — 계획 W1).

**실패 모드 등록부.**

| 새 경로 | 현실적인 실패 | 테스트 | 오류 처리 | 사용자가 보는 것 | critical gap |
|---|---|---|---|---|---|
| `collectChangeSet` | `origin/main` 없음·공통 조상 없음·하위 폴더·git 오류·`U` | 있음(계획 + E4) | `measurable: false` → 전부 적용 + 원인별 처방 | 분명한 문장 | 아니오 |
| `collectChangeSet` | 큰 아트 슬라이스의 diff 출력이 1MiB를 넘음 | 없음(실측 불가) | `maxBuffer` 64MiB | — | 아니오 |
| `runVerify` 실행기 | `pnpm` 없음·`ENOBUFS`·셸 못 띄움 | 있음(계획 + E2) | `error.code`별 문장 | 분명한 문장 | 아니오 |
| `runVerify` vitest | 결과 파일 없음·깨진 JSON·suite 실패만 | 있음(계획 + E3) | 실패 + 다시 돌려 볼 명령 | 분명한 문장 | 아니오 |
| `runVerify` 임시 폴더 | Windows `EBUSY` 정리 실패 | 없음(실측 불가) | 재시도 + try/catch(E7) | 결과는 그대로 보임 | 아니오 |
| `pass` 되부르기 | 통합 검사 실패 뒤 고치고 바로 `pass review` | 있음(H1) | 표시 자동 삭제 → 리뷰 다시 | 「표시를 지웠다」 문장 | 아니오 |
| `pass cso` 해당 없음 | 뒤에 `.claude/**` 수정 + `invalidate` 잊음 | 있음(A1) | `cso_done` 거짓이라 `/cso` 요구 | 막힘 + 안내 | 아니오 |
| `skip-qa` | 생략 뒤 `game/**` 변경 | 있음(계획, E2E) | `pass`가 문서 요구 | 걸린 파일 | 아니오 |
| `verify` in `user-verification` | 형식 차이 | 있음(A4) | `write: false`, 실패 + `rework` 안내 | 분명한 문장 | 아니오 |
| `approve-pr` | 타입 실패·범위 `logic-only`·`.meta` 누락 | 있음(계획) | 지금과 같다 | 지금과 같다 | 아니오 |
| 가짜 `pnpm` | 실행 비트 없음(맥) | 없음(이 장비에서 실측 불가) | `chmod 0o755`(S0-2) | E2E 실패 문장 | 아니오 |
| `WfSandbox` git | 전역 `commit.gpgsign`·`hooksPath` | 없음(장비 의존) | env 격리(E1) | 멈춤 없음 | 아니오 |
| 복구 둘째 길 | 옛 도구가 새 키를 지움 | 없음(손 절차) | 문서의 `git diff` 확인 줄(S4) | 사람이 본다 | 아니오 |

critical gap: **0**. 「테스트 없음·오류 처리 없음·조용함」이 겹치는 줄이 없다.

**병렬화 전략.** 묶음 일곱이 모두 `workflow.mjs`를 거친다(W1·W2·W3·W4가 고치고 W5는 그것을 띄우며 W6·W7은 그 결과를 적는다).

| 단계 | 건드리는 모듈 | 의존 |
|---|---|---|
| W5 샌드박스 | `tests/helpers/`, `tests/logic/` | — |
| W1 변경 집합 | `.claude/lib/`(git·change-set), `.gitignore` | W5(테스트) |
| W4 한 벌 | `.claude/lib/`(canon·workflow-steps·phases), `workflow.mjs`, `tsconfig.tests.json`, `biome.json`, `package.json` | — (W1과 독립이지만 `workflow.mjs`를 같이 고친다) |
| W2 통합 검사·전이 | `.claude/lib/`(verify·transition), `workflow.mjs`, `typecheck.mjs` | W1·W5 |
| W3 approve-pr·status | `workflow.mjs`, `.claude/lib/transition.mjs` | W1·W2 |
| W6 문서 | `docs/development/workflow/`, `CLAUDE.md`, 트러블슈팅 | W2·W3(문구·글자 수) |
| W7 백로그 | `docs/development/backlog*.md` | 전부 |

**Sequential implementation, no parallelization opportunity.** W4를 별도 worktree로 돌릴 수는 있지만 `workflow.mjs`에서 충돌을 손으로 풀어야 하고(충돌 표시: `workflow.mjs`·`tsconfig.tests.json`·`biome.json`), 얻는 시간보다 크다. 계획의 순서 W5 → W1 → W4 → W2 → W3 → W6 → W7을 그대로 권한다.

**TODOS.** `TODOS.md`는 없고 백로그 3분할이 그 자리다. 이번 리뷰가 미룬 것은 A6 하나이고 W7의 새 항목 여덟째로 적는다(아래 수용 항목). 앞 단계가 미룬 것(E4 → F71 행, 2단계 항목, 막지 못하는 경우 둘)은 이미 W7에 있다. 사용자에게 따로 묻지 않는다(`/autoplan` 자동 결정, 최종 게이트에 Taste로 올림).

#### Implementation Tasks (Eng)

Synthesized from this review's findings. Each task derives from a specific finding above. 사람/CC 추정은 테스트·버그 수정 비율(20~50배)로 잡았다.

- [ ] **T1 (P1, human: ~3h / CC: ~10min)** — `transition.mjs`·`workflow.mjs` — 통합 검사가 진짜로 실패하면 판단 검사 표시를 그 자리에서 지운다(형식만·환경 실패 예외)
  - Surfaced by: Step 0.5 H1 / Section 1
  - Files: `.claude/lib/transition.mjs`, `.claude/workflow.mjs`, `tests/logic/WorkflowDiet.test.ts`
  - Verify: `decideTransition` 단위 「실패 → 표시 비움·기록 셋 남김」 + E2E `WF_SHIM_FAIL=vitest`
- [ ] **T2 (P1, human: ~1h / CC: ~3min)** — `workflow.mjs` — 해당 없음일 때 `pass cso`는 `cso_commit`만 적고 `cso_done`은 거짓
  - Surfaced by: A1
  - Files: `.claude/workflow.mjs`, `tests/logic/WorkflowDiet.test.ts`
  - Verify: 「기준 커밋만 남긴다 + `cso_done` 거짓」 테스트
- [ ] **T3 (P1, human: ~4h / CC: ~15min)** — `tests/helpers/WfSandbox.ts` — git 격리 env·저장소 config, 부명령 허용 목록, `rmSync` 재시도, 가짜 `pnpm` `chmod 0o755`
  - Surfaced by: E1 · S1 · T3 · E7 · S0-2
  - Files: `tests/helpers/WfSandbox.ts`
  - Verify: 허용 목록 밖 인자에 던지는 단위 테스트; 기존 E2E 85건 통과
- [ ] **T4 (P1, human: ~3h / CC: ~10min)** — `verify.mjs`·`typecheck.mjs` — 실행기 실패를 `error.code`로 가르고 `maxBuffer` 64MiB, `typecheck.mjs`에 `@ts-check`
  - Surfaced by: E2 · H2
  - Files: `.claude/lib/verify.mjs`, `.claude/typecheck.mjs`
  - Verify: 시험용 실행기 `ENOBUFS` 갈래; `pnpm typecheck` 통과
- [ ] **T5 (P1, human: ~2h / CC: ~5min)** — `verify.mjs` — vitest `success:false`·suite 실패를 실패로, 「파일 실패 n」
  - Surfaced by: E3
  - Files: `.claude/lib/verify.mjs`
  - Verify: 「suite 실패 1·test 실패 0」 결과 파일 테스트
- [ ] **T6 (P1, human: ~2h / CC: ~5min)** — `change-set.mjs` — 공통 조상 없음 → `measurable: false` + 처방; `--is-ancestor` 128 → 쓸 수 없음
  - Surfaced by: E4
  - Files: `.claude/lib/change-set.mjs`
  - Verify: 임시 저장소에서 이력이 다른 `origin/main` / 없는 커밋 테스트
- [ ] **T7 (P2, human: ~3h / CC: ~10min)** — `verify.mjs` — 형식만 실패 분류를 `biome lint .` 재실행(종료 코드)으로; 가짜 `pnpm`이 `exec biome lint`를 알아봄
  - Surfaced by: E5
  - Files: `.claude/lib/verify.mjs`, `tests/helpers/WfSandbox.ts`
  - Verify: 형식만 실패·린트 실패 두 갈래 테스트
- [ ] **T8 (P2, human: ~1h / CC: ~5min)** — `.claude/lib/` — `git.mjs`(`opts` 포함) 분리, `approvePrDecision`·`formatGateLines`를 `transition.mjs`로
  - Surfaced by: A3 · S0-1
  - Files: `.claude/lib/git.mjs`, `change-set.mjs`, `transition.mjs`, `workflow.mjs`
  - Verify: `wf start`의 `switch` 출력이 화면에 보임(E2E stdout)
- [ ] **T9 (P2, human: ~1h / CC: ~5min)** — `verify.mjs`·`workflow.mjs` — 순서 biome → tsc → vitest; `user-verification`의 `verify`는 `write: false` 고정
  - Surfaced by: A5 · A4
  - Files: `.claude/lib/verify.mjs`, `.claude/workflow.mjs`
  - Verify: 시험용 실행기 호출 순서·`write` 값 테스트
- [ ] **T10 (P2, human: ~4h / CC: ~20min)** — 테스트 — T2의 다섯, E2E 상한 여섯·`testTimeout`, `TMP` 따옴표 가드, 글자 수 단위 주석
  - Surfaced by: T2 · T1 · S3
  - Files: `tests/logic/WorkflowDiet.test.ts`, `ClaudeMdSplit.test.ts`, `.claude/lib/verify.mjs`
  - Verify: 전체 스위트 통과, §10 시간 둘 기록
- [ ] **T11 (P3, human: ~1h / CC: ~10min)** — 문서 — `verification.md` 「통과 표시를 남기는 판단 검사 둘」, 복구 문서 `git diff` 줄, §4 메모리 하나, §10 H3, W7 여덟째 항목, pathspec 실험 메모
  - Surfaced by: H6 · S4 · H5 · H3 · A6 · E6
  - Files: `docs/development/workflow/verification.md`, `docs/development/troubleshooting/wf-tool-recovery.md`, 계획 문서, `backlog-implement.md`
  - Verify: `pnpm wf check-links`, 글자 수 테스트

JSONL 산출물: `jq`가 이 장비에 없어 쓰지 않았다(앞 두 단계도 같다). 설치: `winget install jqlang.jq` 또는 `scoop install jq`. 위 목록이 집계 입력이다.

**미해결 결정.** 없음(Unresolved decisions that may bite you later: 0).

#### Completion Summary (Eng)

- Step 0: Scope Challenge — scope accepted as-is
- Architecture Review: 5 issues found (A1·A3·A4·A5·A6; A2 기각은 따로)
- Code Quality Review: 6 issues found (S0-1·H2·E5·E6·H6·A2)
- Test Review: diagram produced, 10 gaps identified (T2 다섯·E4·E3·E2·`--is-ancestor` 128·글자 수 단위) — 전부 테스트를 더했다
- Performance Review: 3 issues found (T1·H3·E2 maxBuffer)
- Security(따로 센다): S1·S2·S3·S4 — 전부 수용
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 1 item proposed(A6 → W7, 자동 결정)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: provider codex — unavailable (not installed); native Claude subagent completed, 26 findings
- Parallelization: 1 lane, 0 parallel / 7 sequential
- Lake Score: N/A (완전성 점수를 매긴 답 0 — `/autoplan` 자동 결정)
- Taste(최종 게이트로): H1 — 통합 검사가 진짜로 실패하면 도구가 판단 검사 표시를 자동으로 지운다(DAT #92)

#### Eng 단계 Implementation 수정 기록

<!-- autoplan-baseline-edits:eng {"sourceSha256":"8301959789f5278b0815f4dd615116bf6a56878b8cffeda8d536086851d1af90","replacements":[{"oldText":"`pass`와 `verify`는 `verification`에서만 받으므로 사용자 검증 단계가 아니라 여기서 한다.","newText":"`pass`는 `verification`에서만 받으므로 여기서 한다(`verify`는 `user-verification`에서도 돈다)."},{"oldText":"`runVerify(runners = defaultRunners, { write = true } = {})`가 타입 검사, biome, vitest를 차례로 돌리고 출력을 받아 둔다.","newText":"`runVerify(runners = defaultRunners, { write = true } = {})`가 biome, 타입 검사, vitest를 차례로 돌리고 출력을 받아 둔다. biome을 먼저 돌리는 이유는 `write`가 참일 때 biome이 고친 뒤의 코드를 타입 검사와 테스트가 보게 하려는 것이다 — 반대 순서면 타입 검사가 본 코드와 디스크의 최종 코드가 다르다."},{"oldText":"4번에서 통합 검사가 실패하면 넘어가지 않는다. `code_review_clean`은 그대로 두고 기록용 값만 실패로 적는다. 다음에 할 일은 「고친 뒤 `pnpm wf invalidate`를 치고 절차대로 다시 한다(정본 선언 → QA 문서가 필요하면 갱신 → 적용 시 `/cso --diff` → 커밋 → 리뷰 → `pass review`)」다. `invalidate`는 지금처럼 정본 선언을 비우고 QA 문서의 지문을 찍으므로 그 둘도 다시 한다. 코드를 고쳤으면 통과 표시를 지운다는 규칙(`CLAUDE.md` 9단계 6번)과 같다. `invalidate`를 잊고 `pass review`만 다시 쳐도 통합 검사는 다시 돌므로, 고친 코드로 통합 검사를 통과하지 않고는 넘어가지 못한다.","newText":"4번에서 통합 검사가 실패하면 넘어가지 않는다. 타입·린트·테스트 가운데 하나라도 진짜로 실패했으면 코드가 바뀌어야 한다는 뜻이므로, 그 자리에서 `invalidate`와 같은 일을 한다 — 통과 표시 둘(`cso_done`·`code_review_clean`)과 정본 선언을 비우고 QA 문서의 지문을 찍는다(`cso_commit`과 기록용 값 셋은 남긴다). 안내만 하고 표시를 남겨 두면, 실패를 본 직후 고치고 `pass review`를 다시 치는 가장 자연스러운 손놀림에서 고치기 전 코드로 받은 리뷰·`/cso` 표시가 그대로 통과한다 — §6이 「세기 어렵다」고 적은 둘째 경우가 바로 이 길에서 가장 자주 난다. 지우지 않는 실패는 둘이다. biome 형식 차이만 실패한 경우(판단 검사와 무관하다)와, 실행기를 띄우지 못했거나 테스트 실행기가 결과 없이 끝난 경우(코드가 아니라 환경의 문제다). 안내는 「통합 검사 실패 — 판단 검사 표시를 지웠다. 고친 뒤 절차대로 다시 한다(정본 선언 → QA 문서가 필요하면 갱신 → 커밋 → 적용 시 `/cso --diff --base <커밋>` → 리뷰 → `pass review`)」다. 코드를 고쳤으면 통과 표시를 지운다는 규칙(`CLAUDE.md` 9단계 6번)을 도구가 대신 지키는 것이고, 명령 수는 늘지 않는다(어차피 `invalidate`를 쳐야 했다)."},{"oldText":"통합 검사 실패 → 넘어가지 않음, `code_review_clean` 유지, 기록용 값만 바뀜.","newText":"통합 검사 실패(타입·린트·테스트) → 넘어가지 않음, 통과 표시 둘과 정본 선언이 비고 QA 지문이 찍힘, `cso_commit`·기록용 값 셋은 남음. 형식 차이만 실패, 실행기 없음, 결과 없음 → 넘어가지 않되 표시는 그대로."},{"oldText":"`/cso`가 해당 없음일 때 `pass cso`를 치면 받되 「`/cso` 해당 없음(`CSO_PATHS` 변경 없음 — `pnpm wf status`로 확인) — 기록만 남긴다」를 찍고 `cso_done`·`cso_commit`을 적는다. 자발적으로 돌린 점검의 기준 커밋을 남기기 위해서이고, 전이 조건에는 들지 않는다(해당 없음이면 `cso_done`을 보지 않는다).","newText":"`/cso`가 해당 없음일 때 `pass cso`를 치면 받되 「`/cso` 해당 없음(`CSO_PATHS` 변경 없음 — `pnpm wf status`로 확인) — 기준 커밋만 남긴다」를 찍고 `cso_commit`만 적는다. `cso_done`은 거짓으로 둔다. 자발적으로 돌린 점검의 기준 커밋은 남기되 통과 표시는 적용될 때만 생기게 하려는 것이다 — 해당 없음일 때 참을 적어 두면, 뒤에 `.claude/**`를 고쳐 `/cso`가 적용으로 바뀌었는데 `invalidate`를 잊었을 때 그 값이 판정을 그냥 지난다(적용 여부는 매번 다시 계산하면서 통과 표시는 적용 여부와 무관하게 남는 비대칭이다)."},{"oldText":"`/cso` 해당 없음일 때 `pass cso`가 「기록만 남긴다」를 찍고 `cso_commit`을 적되 전이 조건을 바꾸지 않는다.","newText":"`/cso` 해당 없음일 때 `pass cso`가 「기준 커밋만 남긴다」를 찍고 `cso_commit`만 적으며 `cso_done`은 거짓 그대로다."},{"oldText":"- `origin/main` 참조가 없다.\n- git 저장소가 아니다.","newText":"- `origin/main` 참조가 없다.\n- `origin/main`과 `HEAD`에 공통 조상이 없다(`git merge-base`가 종료 코드 1에 빈 출력 — 얕은 클론이거나 이력이 다른 `origin/main`이다). `status`가 `null`이 아니라서 이 줄이 없으면 빈 기준 커밋으로 `git diff`를 치게 된다.\n- git 저장소가 아니다."},{"oldText":"`game/tsconfig.json`, `**/*.{sh,ps1,cmd,bat,py}`. 생기면","newText":"`game/tsconfig.json`, `game/package.json`(git이 추적하는 게임 쪽 의존성 목록 — `game/pnpm-lock.yaml`이 생기면 함께), `**/*.{sh,ps1,cmd,bat,py}`. 생기면"},{"oldText":"(W7). 1단계는 슬라이스마다 드는 비용을 줄이는 대신 도구 코드의 양은 늘린다(새 모듈 여섯,","newText":"(W7). 1단계는 슬라이스마다 드는 비용을 줄이는 대신 도구 코드의 양은 늘린다(새 모듈 일곱,"},{"oldText":"### W1. 변경 집합과 적용 판정 — `.claude/lib/change-set.mjs`","newText":"### W1. 변경 집합과 적용 판정 — `.claude/lib/git.mjs` · `.claude/lib/change-set.mjs`"},{"oldText":"판정을 `approvePrDecision({gates, tsScope, tsStatus, missingMeta}) → {ok, reasons}`로 `change-set.mjs`에 둔다.","newText":"판정을 `approvePrDecision({gates, tsScope, tsStatus, missingMeta}) → {ok, reasons}`로 `transition.mjs`에 둔다(`decideTransition`과 같은, 입력만으로 답하는 함수다)."},{"oldText":"쓰임은 「넘기지 않고 지금 결과만 보고 싶을 때」와 「`user-verification`에서 사용자가 잡은 작은 수정 뒤 기계 검사 셋을 한 번에 돌릴 때」다.","newText":"쓰임은 「넘기지 않고 지금 결과만 보고 싶을 때」와 「`user-verification`에서 사용자가 잡은 작은 수정 뒤 기계 검사 셋을 한 번에 돌릴 때」다. `user-verification`에서는 biome을 `write: false`로 돌린다(플래그로도 켜지 못한다) — 그 phase는 훅이 게임 스크립트 편집을 막는 phase인데 `biome.json`이 `game/assets/scripts`를 검사 대상으로 두므로, `--write`로 돌리면 도구가 잠긴 코드를 고치게 된다. 형식 차이가 나오면 실패로 세고 「`pnpm wf rework` 뒤 `pnpm wf verify`로 고친다」를 안내한다."},{"oldText":"더함: 첫머리를 「통합 검사는 이미 통과했고 남은 것은 판단 검사 둘」로 다시 쓴다.","newText":"더함: 첫머리를 「통합 검사는 이미 통과했고 남은 것은 통과 표시를 남기는 판단 검사 둘」로 다시 쓴다(§0은 판단 검사를 넷으로 정의하므로 수를 맞춘다)."}]} -->

<!-- autoplan-accepted:eng -->
- `/cso` 해당 없음일 때 `pass cso`는 `cso_commit`만 적고 `cso_done`은 거짓으로 둔다. 출력은 「`/cso` 해당 없음(`CSO_PATHS` 변경 없음 — `pnpm wf status`로 확인) — 기준 커밋만 남긴다」다. 앞 단계(DX) 항목의 「`cso_done`·`cso_commit`을 적는다」와 「기록만 남긴다 + 전이 조건 불변」 테스트는 이 모양으로 바꾼다. 이유: 해당 없음일 때 참을 적어 두면 뒤에 `.claude/**`를 고쳐 `/cso`가 적용으로 바뀌었는데 `invalidate`를 잊었을 때 그 값이 판정을 그냥 지난다.
- 모듈 배치는 일곱이다. `.claude/lib/git.mjs`: `git(root, args, opts = {})` 하나(`spawnSync`, `maxBuffer` 64MiB, `shell` 없음; `opts`는 `workflow.mjs`의 `switch`가 쓰는 `{ stdio: "inherit" }` 같은 `spawnSync` 옵션을 그대로 넘긴다 — 지금 `git(args, opts)`가 그렇게 쓰인다). `.claude/lib/change-set.mjs`: 적용 경로 상수·`collectChangeSet`·`applicableGates`·`csoBaseUsable`·`/cso` 명령 상수(git을 띄우는 파일). `.claude/lib/transition.mjs`: `decideTransition`·`qaRequired`·`approvePrDecision`·`formatGateLines`(입력만으로 답하는 파일 — 임시 저장소 없이 단위 테스트한다). 앞 단계 항목이 `change-set.mjs`에 두기로 한 `git(root, args)`·`approvePrDecision`·`formatGateLines`는 이 배치가 대체한다.
- `runVerify`의 순서는 biome → 타입 검사 → vitest다. 출력 줄의 순서도 같다. 시험용 실행기 단위 테스트가 호출 순서를 확인한다.
- `user-verification`에서 `verify`는 biome을 `write: false`로 돌린다. 플래그로도 켜지 못한다. 형식 차이가 나오면 실패로 세고 「`pnpm wf rework` 뒤 `pnpm wf verify`로 고친다」를 안내한다. 테스트: `user-verification` 상태에서 시험용 biome 실행기에 `write: false`가 전달된다. 앞 단계 항목 「`start-verification`과 `verify`는 `write: true`」는 `implementation`·`verification`에서만 그렇다.
- 통합 검사가 타입·린트·테스트로 진짜 실패하면 `pass`가 그 자리에서 `resetVerification`과 같은 일을 한다 — `cso_done`·`code_review_clean`·정본 선언을 비우고 QA 문서 지문을 찍는다. `cso_commit`과 기록용 값 셋은 남긴다. 예외 둘: biome 형식 차이만 실패(앞 단계 항목대로 「`pnpm wf verify`로 고치고 커밋한 뒤 다시 친다」), 실행기를 띄우지 못했거나 테스트 실행기가 결과 없이 끝남(환경 문제). 안내: 「통합 검사 실패 — 판단 검사 표시를 지웠다. 고친 뒤 절차대로 다시 한다(정본 선언 → QA 문서가 필요하면 갱신 → 커밋 → 적용 시 `/cso --diff --base <커밋>` → 리뷰 → `pass review`)」. 테스트: 단위(실패 → 표시 비움·기록 셋 남김, 예외 둘은 표시 유지)와 E2E `WF_SHIM_FAIL=vitest`. **최종 승인에서 사용자가 보는 Taste 항목이다.**
- `WfSandbox.ts`의 git 격리: 도우미가 띄우는 모든 git 호출에 `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=<임시 루트의 빈 gitconfig 파일>`, `GIT_AUTHOR_NAME`·`GIT_AUTHOR_EMAIL`·`GIT_COMMITTER_NAME`·`GIT_COMMITTER_EMAIL`, `GIT_CEILING_DIRECTORIES`를 준다. `init` 뒤 저장소 안에 `core.autocrlf=false`·`commit.gpgsign=false`를 `git config`로 적는다(`-c`는 `init` 한 번에만 듣는다). 전역에 `commit.gpgsign`·`core.hooksPath`가 있는 장비에서 샌드박스 커밋이 멈추거나 남의 훅을 돌리지 않게 하려는 것이다.
- `WfSandbox.git(dir, ...args)`는 부명령 허용 목록(`init`·`config`·`add`·`commit`·`branch`·`switch`·`checkout`·`update-ref`·`reset`·`cat-file`·`rev-parse`·`merge-base`·`rebase`)만 받고, 첫 인자가 그 밖(`-c`·`-C`·`--exec-path`·`--git-dir`·`--work-tree`·`--config-env` 등 전역 옵션 포함)이면 던진다. 「`tests/logic/` 아래 파일은 프로세스를 띄우지 않는다」 가드가 직접 import만 보므로, 도우미의 API가 좁아야 그 예외가 선다. `CSO_PATHS` 위 주석에 「`tests/logic/**` 예외는 도우미의 좁은 API에 기대고 있다」를 적는다. 테스트: 허용 목록 밖 인자에 던진다.
- 가짜 `pnpm`의 POSIX 쪽(`bin/pnpm`)은 쓰고 나서 `fs.chmodSync(path, 0o755)`를 한다 — 실행 비트가 없으면 `spawnSync`가 `EACCES`로 끝나 맥북에서 E2E가 전부 깨진다.
- 실행기 실패 판정은 `error.code`로 가른다: `error.code === 'ENOENT'` 또는 (stdout이 비고 `status`가 9009·127) → 「실행기 `<이름>`을 실행할 수 없다(`pnpm` 경로 확인)」 + stderr 첫 줄; `ENOBUFS` → 「출력이 너무 커서 잘렸다 — `<다시 돌려 볼 명령>`으로 직접 보라」; 그 밖의 `error` → `error.message` 그대로. 실행기 셋의 `spawnSync`에 모두 `maxBuffer: 64 * 1024 * 1024`를 준다. 이 항목이 앞 단계(DX) 항목의 판정 문장을 대체한다. 시험용 실행기 단위 테스트에 `ENOBUFS` 갈래를 더한다.
- vitest 요약 줄에 「파일 실패 n」(`numFailedTestSuites`)을 더한다. 결과 파일의 `success`가 거짓이면 `numFailedTests`가 0이어도 실패로 찍는다. 통과·실패 자체는 실행기 종료 코드가 정한다. 근거: vitest의 JSON reporter는 파일 suite가 실패하면 `testResults[].status='failed'`·`message`를 채우고 `numFailedTests`는 0일 수 있다(수집 오류 — `tsconfig.cocos.json`이 없는 경우가 이 모양이다). 시험용 결과 파일 테스트에 「suite 실패 1·test 실패 0」 모양을 둔다.
- 변경 집합을 구할 수 없는 원인에 「`origin/main`과 `HEAD`에 공통 조상이 없다(`git merge-base` 종료 코드 1, 빈 출력)」를 더하고 처방은 「`git fetch --unshallow` 또는 `git fetch origin main`」이다(원인별 처방은 여섯 줄이 된다). `csoBaseUsable`에서 `git merge-base --is-ancestor`가 128(모르는 커밋)로 끝나면 「쓸 수 없음 — 지금 저장소에 없는 커밋」으로 전체 `/cso`를 안내하고 변경 집합 실패와 섞지 않는다. 테스트: 이력이 다른 `origin/main`을 둔 임시 저장소, 없는 커밋 해시를 `cso_commit`에 둔 상태 파일.
- biome 결과의 분류는 JSON reporter를 쓰지 않는다(biome CLI 참조가 `json`·`json-pretty`를 「experimental, 패치 판에서 바뀔 수 있다」고 적는다 — 2026-10-06 Context7 확인). 판정은 종료 코드로: `write: false`에서 `biome check`가 실패하면 `biome lint .`를 한 번 더 띄워 그것이 통과하면 「형식 차이만」, 아니면 린트 실패로 분류한다(추가 호출은 실패 길에서만 든다). 「n개 파일을 고쳤다」 수는 summary 출력에서 읽되 못 읽으면 찍지 않는다(판정에 쓰지 않는다). 가짜 `pnpm`은 `exec biome lint`도 알아보고 성공으로 끝낸다. 시험용 실행기 테스트: 형식만 실패·린트 실패 두 갈래.
- pathspec 실험(앞 단계 항목) 전에 정해 두는 것 셋: `:(glob)`은 중괄호 확장을 하지 않으므로 `**/*.{sh,ps1,cmd,bat,py}`는 다섯 pathspec으로 푼다. `icase`는 pathspec 전체에 걸리므로 `.claude` 항목에만 붙인다. 게이트마다 git 한 번(패턴 여럿을 한 호출에)으로 하고, `rule`은 걸린 경로를 JS에서 패턴에 다시 대 보지 않고 「그 게이트의 경로 목록」으로 찍는다 — `status` 한 번에 git 호출이 게이트 수(넷)+3을 넘지 않게.
- `WfSandbox`의 정리와 `verify.mjs`의 실행별 임시 폴더 정리는 `fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })`로 한다. `verify.mjs`의 `finally` 정리는 try/catch로 감싸 정리 실패가 검사 결과를 덮지 않게 한다(Windows에서 Defender가 새 파일을 읽는 동안 `EBUSY`/`EPERM`).
- 통합 검사까지 가는 E2E는 여섯 이하로 둔다: `start-verification` 성공·실패, `verify` 전이 없음, `pass review` 실패·형식만 실패, `skip-qa` 뒤 게임 변경. 그 밖의 갈래는 `decideTransition`·`runVerify` 단위로. `WfSandbox`를 쓰는 테스트 파일에는 `testTimeout: 30_000`을 둔다. 구현 뒤 §10에 「스위트 전체」와 「샌드박스 파일만」의 시간을 따로 적는다.
- 더하는 테스트 다섯: `verify`가 phase뿐 아니라 `cso_done`·`code_review_clean`·`canon_*`·`qa_doc_fingerprint`도 건드리지 않는다. `approvePrDecision`에 `measurable: false` 갈래(모두 적용 → `logic-only` 거부, 여섯째). `collectChangeSet`이 `git add`만 한 새 파일을 `A`로, 커밋하지 않은 수정을 `M`으로 잡는다(변경 집합이 작업 트리 기준이라는 전제). `/cso`가 적용인데 `pass cso` 전에 `pass review`를 치면 통합 검사가 돌지 않는다. 글자 수 테스트의 세는 단위(`String.prototype.length`, UTF-16 단위)와 CRLF를 LF로 정규화한 뒤 센다는 것을 상수 옆 주석에 적는다.
- `CSO_PATHS`에 `game/package.json`을 더한다(git이 추적하는 게임 쪽 의존성 목록). `game/pnpm-lock.yaml`이 생기면 함께 더한다고 주석에 적는다.
- `verify.mjs`는 임시 폴더 경로에 `"`가 들어 있으면 「임시 폴더 경로에 따옴표가 들어 있어 명령줄을 만들 수 없다: <경로>」로 분명히 실패한다(`shell: true` 명령줄이 조용히 다른 파일에 쓰는 것보다 낫다).
- 복구 문서(`wf-tool-recovery.md`)의 둘째 길 끝에 한 줄을 더한다: 「그 길을 쓴 뒤 `git diff .claude/workflow-state.json`으로 바뀐 키를 눈으로 보고 커밋한다 — 옛 도구가 새 키(`qa_skip_reason`·`cso_commit`)를 모르고 지우는 경우를 여기서 잡는다」.
- `.claude/typecheck.mjs`에도 `// @ts-check`를 붙인다. `verify.mjs`가 import하면 `allowJs` 때문에 프로그램에 들어오는데, 붙여야 `runTypecheck`의 JSDoc 반환 타입이 서서 `verify.mjs`의 호출부가 검사된다. 고칠 양은 W4의 첫 함수 측정에 함께 잰다.
- §10에 한 줄을 더한다: 「`pass review`는 `DocsHygiene.test.ts`를 두 번 돌린다(`qaDocClean`의 `WF_QA_DOC` 호출과 통합 검사의 전체 스위트, 약 1초). 2단계에서 QA 판정을 통합 검사 안에 넣을지 판단할 때의 근거다」.
- §4 「메모리는 머지 때 고친다」의 대상에 `feedback_doc_only_slice_skips_wf`(문서만 바뀌는 슬라이스는 wf를 생략한다)를 더한다. 이 슬라이스 뒤에는 문서 슬라이스도 `skip-qa`·`/cso` 해당 없음으로 wf를 싸게 지나므로 그 메모리가 그대로 맞는지 머지 때 다시 본다.
- W7의 새 항목에 여덟째를 더한다(`backlog-implement.md`): 「`workflow.mjs`를 biome·tsc 검사 대상에 넣는다 — `biome.json`에 `.claude/**` override(`quoteStyle: "double"`)를 두면 따옴표 변환으로 큰 diff가 나지 않는다. 명령 본문을 `.claude/lib/`로 더 옮기는 것도 같은 항목이다」. 2단계와 무관하므로 따로 만든다.
- `verification.md` 첫머리는 「통합 검사는 이미 통과했고 남은 것은 통과 표시를 남기는 판단 검사 둘」로 쓴다(§0의 「판단 검사 넷」과 수를 맞춘다). 글자 수는 W6 표에서 다시 잰다.
<!-- /autoplan-accepted:eng -->

### Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | 모드 SELECTIVE EXPANSION 유지(파일 수 약 35로 REDUCTION 권고 조건이지만) | Mechanical | `/autoplan` 규칙 | 절반이 문서·테스트, 코드 핵심은 모듈 여섯+CLI 하나 | SCOPE REDUCTION |
| 2 | CEO | 접근 결정(0D) 없음 — 사용자가 축소형 A 확정 | Mechanical | P6 | 2026-10-05 사용자 결정, 뒤집을 근거 없음 | B(2단계 메모), C(한 PR) |
| 3 | CEO | E1 통합 검사 요약 줄에 걸린 시간 — Add | Mechanical | P2 | 영향 범위 안, 파일 1, CC 3분 | — |
| 4 | CEO | E2 `pass cso` 미커밋 변경 경고 — Add | Mechanical | P2 | 영향 범위 안, 파일 1 | — |
| 5 | CEO | E3 `status`에 `cso_commit`·다음 점검 명령 — Add | Mechanical | P2·P4 | W3 한 줄, 판정 함수 재사용 | — |
| 6 | CEO | E4 `status`에 다음 명령 — Defer(백로그 F71 행) | Mechanical | P3 | F71 관찰 영역, 영향 범위 밖 | Add |
| 7 | CEO | E6 `skip-qa` 유효 조건 안내 — Add | Mechanical | P2 | 한 줄 | — |
| 8 | CEO | E5 중복 Skip, E7 Skip | Mechanical | P4·P6 | W2가 이미 든다 / fetch 없이 알 수 없고 계획이 이미 정함 | Add |
| 9 | CEO | 사양 C1 — `qaRequired`면 QA 문서 존재부터 요구 | Mechanical | P1 | `qaDocClean`이 파일 없으면 통과라 안전장치가 비어 있었다 | 그대로 두기 |
| 10 | CEO | 사양 C2 — E2 경고에서 상태 파일 제외 | Mechanical | P1 | 상태 파일은 `pass cso` 때 거의 늘 미커밋 | 그대로 두기 |
| 11 | CEO | 사양 C3 — `start-verification` 성공·실패 E2E 추가 | Mechanical | P1 | 통합 검사의 첫 입구가 테스트 없이 손 확인에만 있었다 | — |
| 12 | CEO | 사양 K1 — 손 확인 둘을 검증 단계로 옮기고 검사 이름 통일 | Mechanical | P5 | `pass`·`verify`는 `verification`에서만 받는다 | `pass`가 인자 검사를 phase보다 먼저 |
| 13 | CEO | 사양 K2 — 통합 검사 실패 뒤 안내를 「`invalidate` → 절차대로」로 | **Taste** | P5 | `CLAUDE.md` 6번 규칙과 맞춘다; §6 셋째 측정값이 헛 재검사를 센다 | 형식·타입 수정은 `invalidate` 면제(규칙에 예외가 생긴다) |
| 14 | CEO | 사양 K3 — W7 F71 행에 E4 후보 한 줄 | Mechanical | P1 | 요약과 계획의 불일치 | — |
| 15 | CEO | 사양 K4 — `qaDocClean`의 `tests/logic` 없음 예외 제거 | Mechanical | P1 | W5 가짜 `pnpm`이 이유를 없앤다; W2 불변식과 같은 형태 | 남기기 |
| 16 | CEO | 사양 Cl1~Cl6 — 이름·모양·`write`·PATH 키 확정 | Mechanical | P5 | 구현자가 되묻지 않게 | — |
| 17 | CEO | 사양 F1 — `makeRepo({csoApplicable:true})` 옵션 | Mechanical | P5 | 기존 테스트의 확인 내용을 바꾸지 않는다 | 테스트를 `pass review`로 바꾸기 |
| 18 | CEO | 사양 F2 — `T`→`M`, 그 밖은 `measurable:false` | Mechanical | P1 | 닫힌 쪽으로 틀린다 | — |
| 19 | CEO | 사양 2회차 Co1 — vitest 요약 줄에 파일·통과·실패·스킵 수 | Mechanical | P1 | 숫자가 없으면 AI가 vitest를 따로 쳐서 §12 둘째 조건이 깨진다 | — |
| 20 | CEO | 사양 2회차 Co2 — `verification.md`의 「보안 검사부터 다시」 셋을 「(적용 시)」로, `planning.md`의 「GREEN 게이트」를 「통합 검사 게이트」로 | Mechanical | P1 | `/cso` 해당 없음 슬라이스에 틀린 안내 · 이름 불일치 | planning.md 그대로 두기 |
| 21 | CEO | 사양 2회차 Co3 — 가짜 `pnpm`은 `--outputFile` 없는 vitest 호출에 항상 0 | Mechanical | P5 | `qaDocClean`의 호출을 덮는다 | — |
| 22 | CEO | 사양 2회차 Cn1 — `verify`는 QA 문서를 보지 않는다 | Mechanical | P5 | `verify`는 기록용 값만 적는 명령 | `verify`도 QA를 본다 |
| 23 | CEO | 사양 2회차 Cn2 — `invalidate` 뒤 절차에 정본 선언·QA 갱신을 넣는다 | Mechanical | P1 | `resetVerification`이 둘을 지우는 동작은 그대로다 | — |
| 24 | CEO | 사양 2회차 Cn3 — `approve-pr` E2E는 끝까지 확인 | Mechanical | P1 | 가짜 `pnpm`이 있어 뒤도 돈다 | 앞부분만 |
| 25 | CEO | 사양 2회차 Cl1·F3 — `makeRepo` 저장소 모양·옵션·판정 파일 stub | Mechanical | P5 | 임시 저장소 테스트 전부가 여기에 걸린다 | — |
| 26 | CEO | 사양 2회차 Cl2 — `qaClean`은 통과 표시가 다 찼을 때만 구한다(`needsQa`) | Mechanical | P3 | 지금 동작(669행)과 같고 vitest를 헛돌리지 않는다 | 미리 구해 넘기기 |
| 27 | CEO | 사양 2회차 Cl3 — 사유 없는 경우 메시지 분리 | Mechanical | P5 | 없는 사유를 인용하지 않는다 | — |
| 28 | CEO | 사양 2회차 Cl4 — 실행기 명령줄 명시 | Mechanical | P5 | 가짜 `pnpm`이 받는 모양과 맞춘다 | — |
| 29 | CEO | 사양 2회차 F1 — 가짜 `pnpm`을 저장소 밖 형제 폴더에 | Mechanical | P1 | 저장소 안이면 `*.cmd`가 `CSO_PATHS`에 걸려 모든 샌드박스에 `/cso` 적용 | `.git/info/exclude` |
| 30 | CEO | 사양 2회차 F2 — `shell: true`에서는 `status` 9009/127 + 빈 출력을 「실행기 없음」으로 | Mechanical | P5 | `ENOENT`는 그 모양에서 안 온다 | 경로를 먼저 찾아 shell 없이 띄우기 |
| 31 | CEO | 사양 3회차 F1(막음) — 임시 저장소를 `main`=`c2`, `origin/main`=`c2`, `feat/stale`=`c1`, `feat/<feature>`=`c3`로, `checkout:'main'` 옵션 | Mechanical | P1 | `DocsHygiene.test.ts` 188~241행의 두 기대(뒤처진 브랜치, 뒤처진 main)가 그대로 나와야 한다 | — |
| 32 | CEO | 사양 3회차 F3 — `makeRepo({ git: false })` 길을 남긴다 | Mechanical | P3 | 샌드박스 40개를 전부 git으로 만들면 스위트가 수 초 는다 | 전부 git + §10 재측정만 |
| 33 | CEO | 사양 3회차 F2 — `pnpm.cmd`는 `node fake-pnpm.mjs %*` 한 줄 | Mechanical | P5 | `cmd`가 `=`를 잘라 `--outputFile=`이 두 토막 난다 | — |
| 34 | CEO | 사양 3회차 Co1~Co3 — 변경 집합 없는 QA 문장, `start-verification`의 steps 안내, `tsStatus` 갈래 | Mechanical | P1 | 빠진 경우 셋 | — |
| 35 | CEO | 사양 3회차 Cn1·Cn4 — `planning.md`를 고치는 문서로 세고 상태 줄 갱신(치환 다섯) | Mechanical | P1 | 요약과 본문의 수 불일치 | — |
| 36 | CEO | 사양 3회차 Cn2 — 덜어 낼 문장 둘(34·62행)을 지금 지목 | Mechanical | P1 | 「(적용 시)」 셋이 상한을 넘긴다 | 구현 때 정하기 |
| 37 | CEO | 사양 3회차 Cn3 — `decideTransition` 서명에 `qaClean?`·`needsQa`(치환) | Mechanical | P5 | 승인 항목과 본문 불일치 | — |
| 38 | CEO | 사양 3회차 Cl1~Cl3 — 실패 상세 출처, `invalidate`가 기록용 값 셋을 남김, `capture`의 진행 줄 | Mechanical | P5 | 되묻지 않게 | 기록용 값을 비우기 |
| 39 | CEO | 0H 문서 승인 — A(승인, 0I로) | Mechanical | `/autoplan` 규칙 | 두 문서가 같은 결정을 담는다 | B 수정, C 중단 |
| 40 | CEO | 독립 리뷰 C-1-1 — §6에 결과 측정 셋(명령 수·출력 글자 수·도구 줄 수와 테스트 시간) | Mechanical | P1 | 줄이겠다는 셋을 재는 자리가 없었다 | — |
| 41 | CEO | 독립 리뷰 C-1-2 — §6에 계획·리뷰 비용 한 줄, 이 슬라이스가 첫 표본 | Mechanical | P1 | 측정만; 사람 확인 지점·리뷰 구성은 그대로 | 리뷰 구성 변경 |
| 42 | CEO | 독립 리뷰 C-2-1 — §1에 「도구 코드 양은 는다」 명시 | Mechanical | P5 | 정직한 전제 | — |
| 43 | CEO | 독립 리뷰 C-2-2 — **E2 미커밋 경고 철회**(DAT #4 뒤집음), 조상 확인은 유지, §2.2에 「도구 경로 0건」 | **Taste** | P3·P5 | 절차상 `pass cso` 때는 거의 늘 미커밋이라 경고가 소음 | E2 유지 |
| 44 | CEO | 독립 리뷰 C-2-3 — 외부 기여 조건을 `CSO_PATHS` 주석과 F109 행에 | Mechanical | P1 | 솔로 전제가 적혀 있지 않았다 | `verification.md`에도(글자 수) |
| 45 | CEO | 독립 리뷰 C-3-1 — 전이 출력에 `HEAD` 해시, §6에 셋째 값의 성격 명시, 여는 조건은 유지 | **Taste** | P5 | 상태 키를 안 늘리고 재게 한다 | 상태 키 셋 추가 / 비용 기준 조건 |
| 46 | CEO | 독립 리뷰 C-3-2 — `CSO_PATHS`의 `.claude/**`를 추적 자리 넷으로 좁힘 | Mechanical | P5 | Claude Code 생성물에 흔들리지 않는다 | `status` 안내문 |
| 47 | CEO | 독립 리뷰 C-3-3 — `/cso` 명령 문자열은 상수 하나, 옵션은 `ops-skill-routing.md`에 | Mechanical | P4·P5 | 스킬 판이 바뀌면 한 곳만 고친다 | — |
| 48 | CEO | 독립 리뷰 C-3-4 — sessions/로 나눌 때 §12를 W절에 녹인다 | Mechanical | P5 | 두 번째 사양을 남기지 않는다 | — |
| 49 | CEO | 독립 리뷰 C-3-5 — F10 행에 예외·테스트 정리와 「2단계보다 먼저」 | Mechanical | P1 | 충돌 면적이 는다 | — |
| 50 | CEO | 독립 리뷰 C-4-1 — C-1-2로 닫음 | Mechanical | P6 | 숫자가 생기면 기각 근거로 쓴다 | — |
| 51 | CEO | 독립 리뷰 C-4-2 — pathspec 시험 뒤 구현 방식 결정(판정 표가 계약) | **Taste** | P4·P5 | git이 경계·대소문자를 보장 | 직접 짠 맞추기 고정 |
| 52 | CEO | 독립 리뷰 작은 것 셋 — `pass` 형식 차이 안내, `child_process` 테스트 범위, 137회 단위 | Mechanical | P1·P5 | 한 줄씩 | — |
| 53 | CEO | Section 1·2 A-1·A-2 — 임시 폴더는 finally로, vitest JSON 깨짐도 「결과 없음」 길 | Mechanical | P1 | 조용한 실패를 막는다 | — |
| 54 | CEO | Section 5 Q-1·Q-2 — git 띄우기 한 벌, formatGateLines 순수 함수 | Mechanical | P4·P5 | 중복·분기 수 | — |
| 55 | CEO | 남은 TODO 제안 없음 · 바깥 목소리는 양쪽 목소리로 대신 | Mechanical | P6 | 백로그는 W7이 든다 | — |
| 56 | DX | G1 — `verify`를 implementation·verification·user-verification에서 | Mechanical | P5 | 전이 없는 명령, 기록용 값은 어디서 적어도 해가 없다 | verification 한정 |
| 57 | DX | G2 — Cocos 파일 처방 두 길 | Mechanical | P1 | 첫 실행 실패의 처방이 한 길뿐이었다 | — |
| 58 | DX | G3 — `skip-qa`를 implementation에서도 | Mechanical | P5 | 뺄 이유가 없다 | — |
| 59 | DX | E1(높음) — 미추적 `*.meta`를 변경 집합에서 제외 | Mechanical | P1 | 검사 결과는 같고 §2.2의 보장이 산다(`workflow.mjs` 366~398 확인) | — |
| 60 | DX | E2 — biome이 고친 형식 차이는 판단 검사 재실행 예외 | Mechanical | P5 | 공백 하나로 정본·리뷰를 다시 하지 않는다(K2 보강) | 예외 없음 |
| 61 | DX | E3 — 검증 순서를 커밋 → /cso → pass cso로 | **Taste** | P3 | `cso_commit`이 점검한 변경을 담게 된다 | 커밋 전 경고 한 줄(E2 철회와 같은 이유로 기각) |
| 62 | DX | E4 — `verify` 이름 유지, 「(전이 없음)」 표시 | Mechanical | P5 | 이름 변경은 문서·테스트·글자 수를 흔든다 | `check-all` |
| 63 | DX | E5·E6 — 거부 문구 둘, `makeRepo` 기본값 | Mechanical | P1·P5 | 의도에 맞는 문구 | — |
| 64 | DX | H1·H2 — 처방 다섯, stdout 빈 + 9009/127 + stderr 첫 줄 | Mechanical | P1 | 조건이 그대로면 안내가 영영 안 뜬다 | — |
| 65 | DX | H3·H4 — steps 꼬리 셋 더, vitest 파일 경로, skip-qa 걸린 파일 | Mechanical | P1 | 한 줄씩 | — |
| 66 | DX | D1·D2 — 참조형 축약 금지(문장 삭제), 예는 글자 수가 남을 때만 | Mechanical | P5 | 상한은 그대로 | 상한에 여유 100자 |
| 67 | DX | D3·D4 — README 입구 한 줄, 메모리 대상 셋 | Mechanical | P1 | 상한 밖 문서 / 머지 날 빠뜨리지 않게 | — |
| 68 | DX | X1 — `skip-qa --clear`, 해당 없음 `pass cso`는 기록만 | Mechanical | P5 | 되돌릴 길 | 거부 유지 |
| 69 | DX | X2 — `--no-write` 플래그 | Mechanical | P4 | 파일 수정만 끄는 빠져나갈 길 | — |
| 70 | ENG | Step 0 복잡도 게이트(파일 약 32·새 모듈 일곱) — 삭감 없음, 구조 「원래 배치」 | Mechanical | `/autoplan` P2 | CEO #1과 같다. 더 작은 배치는 F78을 못 닫는다 | 더 작은 배치 |
| 71 | ENG | S0-1 `git(root, args, opts = {})` — Add | Mechanical | P1 | `workflow.mjs:449-450`의 `switch`가 `stdio: inherit`를 넘긴다 | — |
| 72 | ENG | S0-2 가짜 `pnpm` POSIX 스크립트 `chmod 0o755` — Add | Mechanical | P1 | 실행 비트 없으면 맥북에서 E2E 전멸 | — |
| 73 | ENG | A1 해당 없음 `pass cso`는 `cso_commit`만, `cso_done` 거짓 — Add | Mechanical | P1 | 적용 여부는 매번 계산하면서 통과 표시는 남는 비대칭 | DX X1 그대로 |
| 74 | ENG | A2 되부르기 대신 게으른 함수 둘 — Reject | Mechanical | P5 | CEO 항목이 정한 모양, 명시성 같음, 「문서 안 어긋남」은 선택 입력의 오독 | 게으른 함수 |
| 75 | ENG | A3 `git.mjs` 분리, 순수 판정은 `transition.mjs` — Add(축소) | Mechanical | P5 | git을 띄우는 파일과 입력만으로 답하는 파일을 가른다 | `change-set.mjs` 한 파일 |
| 76 | ENG | A4 `user-verification`의 `verify`는 `write: false` 고정 — Add | Mechanical | P1 | 훅이 잠근 phase에서 도구가 코드를 쓰면 안 된다 | 플래그로 켜기 |
| 77 | ENG | A5 순서 biome → tsc → vitest — Add | Mechanical | P1 | 타입 검사가 디스크의 최종 코드를 본다 | — |
| 78 | ENG | A6 `workflow.mjs`를 biome·tsc에 넣기 — Defer(W7 여덟째 항목) | Mechanical | P3 | 슬라이스 밖, 2단계와 무관 | 지금 넣기 |
| 79 | ENG | E1 샌드박스 git 격리 env·저장소 config — Add | Mechanical | P1 | `-c`는 `init` 한 번에만 듣는다 | — |
| 80 | ENG | E2 실행기 실패를 `error.code`로, `maxBuffer` 64MiB — Add | Mechanical | P1 | `ENOBUFS`가 「pnpm 없음」으로 읽힌다. DX #64의 판정 문장을 대체 | — |
| 81 | ENG | E3 vitest `success:false`·suite 실패를 실패로 — Add | Mechanical | P1 | vitest `json.ts`로 확인(Context7) | — |
| 82 | ENG | E4 공통 조상 없음 → `measurable: false`, `--is-ancestor` 128은 따로 — Add | Mechanical | P1 | 종료 코드 1·빈 출력은 지금 목록을 전부 지난다 | — |
| 83 | ENG | E5 biome 분류는 종료 코드 + `biome lint` 재실행 — Add(다른 처방) | Mechanical | P5 | JSON reporter는 experimental(biome CLI 참조) | `--reporter=json` |
| 84 | ENG | E6 pathspec 실험 전 결정 셋(중괄호·`icase`·호출 횟수) — Add | Mechanical | P1 | 실험 해석이 흔들리지 않게 | — |
| 85 | ENG | E7·S0-3 `rmSync` 재시도 + `finally` try/catch — Add | Mechanical | P1 | Windows `EBUSY`/`EPERM` | — |
| 86 | ENG | T1 통합 검사까지 가는 E2E 여섯 이하·`testTimeout` 30s·시간 따로 — Add | Mechanical | P1 | 스위트가 검증마다 세 번 돈다 | 상한 없음 |
| 87 | ENG | T2 테스트 다섯 — Add | Mechanical | P1 | 각각 깨뜨리는 회귀가 있다(값 카드) | — |
| 88 | ENG | T3·S1 `WfSandbox.git` 부명령 허용 목록 + 주석 — Add | Mechanical | P1 | `/cso` 밖 경로에서 임의 명령이 돈다 | 전역 옵션만 거부 |
| 89 | ENG | S2 `CSO_PATHS`에 `game/package.json` — Add | Mechanical | P1 | 추적 확인(`git ls-files`), 의존성 범주 | — |
| 90 | ENG | S3 임시 경로 `"` 가드 — Add | Mechanical | P1 | 조용히 다른 파일에 쓰는 것보다 낫다 | — |
| 91 | ENG | S4 복구 문서 `git diff` 확인 줄 — Add | Mechanical | P1 | 옛 도구가 새 키를 지우는 경우 | — |
| 92 | ENG | H1 통합 검사 진짜 실패 → 판단 검사 표시 자동 삭제(형식만·환경 실패 예외) | **Taste** | P1 | 실패 직후 고치고 `pass review`를 다시 치는 길에서 고치기 전 코드의 리뷰 표시가 통과한다. 명령 수는 같다 | 안내만(계획 원안) |
| 93 | ENG | H2 `typecheck.mjs`에 `@ts-check` — Add | Mechanical | P1 | `verify.mjs` 호출부 검사가 산다 | — |
| 94 | ENG | H3 `DocsHygiene` 두 번 — §10에 기록 | Mechanical | P4 | 2단계에서 QA 판정을 통합 검사에 넣을지의 근거 | 지금 합치기 |
| 95 | ENG | H4 상한 상수 주석 — 변경 없음 | Mechanical | P4 | W6이 이미 든다 | — |
| 96 | ENG | H5 메모리 `feedback_doc_only_slice_skips_wf` — Add | Mechanical | P1 | 머지 때 빠뜨리지 않게 | — |
| 97 | ENG | H6 「통과 표시를 남기는 판단 검사 둘」 — Add | Mechanical | P5 | §0의 넷과 수를 맞춘다 | — |
| 98 | ENG | Codex 없음(`not_installed`) → 외부 커버리지 없음, 네이티브만 | Mechanical | P6 | 앞 두 단계와 같은 사정 | — |
| 99 | ENG | 진입 검사가 호출을 끝난 것으로 본 뒤 리뷰어 지시문에 머리글 한 줄을 더해 띄움(파일·해시·기준 동일), 방법론 두 구간은 셸로 읽음 | Mechanical | `/autoplan` 규칙 | 사용자 개입 뒤 검사가 풀렸고 되살릴 길이 없다. 사용자에게 보고한다 | 중단·새 세션 |

<!-- autoplan-accepted:ceo -->
- 통합 검사(`runVerify`)는 검사마다 요약 한 줄에 걸린 시간을 밀리초로 함께 찍는다(예: `typecheck: 통과 (2,713ms)`). 세 검사의 합계도 마지막 줄에 찍는다. 시간은 `runVerify`가 실행기 호출 전후로 재서 결과 객체에 `durationMs`로 더한다 — 실행기의 반환 모양 `{status, scope?, summary, details}`는 그대로다. 시험용 실행기로 돌리는 `runVerify` 단위 테스트가 요약 줄에 시간 필드가 있는지 확인한다.
- vitest의 요약 줄은 결과 파일에서 읽은 수를 든다: 「vitest: 통과 · 파일 n개 · 통과 a · 실패 b · 스킵 c (N ms)」. QA 문서의 「피처 테스트 N/N, 전체 스위트 M/M」은 이 줄에서 옮겨 적고, 그 수를 보려고 `pnpm exec vitest run`을 따로 치지 않는다. 시험용 실행기 단위 테스트가 네 수를 확인한다.
- 세 실행기의 명령줄을 정한다. 타입 검사: `pnpm exec tsc -p <프로젝트> --noEmit`(지금 `typecheck.mjs`와 같다). biome: `pnpm exec biome check --reporter=summary [--write] .`. vitest: `pnpm exec vitest run --reporter=json --outputFile=<임시 파일>`. 다시 돌려 볼 명령으로 안내하는 것은 `pnpm typecheck`·`pnpm check`·`pnpm exec vitest run`이지만 통합 검사가 띄우는 것은 위 셋이고, W5의 가짜 `pnpm`은 `exec tsc`·`exec biome`·`exec vitest run`으로 알아본다.
- 실행기를 찾지 못한 경우의 판정: `shell: true`로 띄우면 `pnpm`이 없어도 `spawnSync`의 `error`는 비고 `status`만 9009(`cmd.exe`) 또는 127(`sh`)로 온다. 그래서 「`error`가 있거나, `status`가 9009·127이고 출력이 비면」 실행기를 찾지 못한 것으로 보고 「실행기 `<이름>`을 실행할 수 없다(`pnpm` 경로 확인)」를 찍는다. 시험용 실행기 단위 테스트에 이 갈래를 둔다.
- W6 `verification.md` 표에 더한다: 「`pnpm wf invalidate`로 전부 되돌리고 보안 검사부터 다시 돈다」와 같은 말을 하는 문장 셋(지금 5·34·62행)을 「(적용 시) 보안 검사부터」로 고친다. `planning.md` 33행의 「`start-verification`의 GREEN 게이트」는 「통합 검사 게이트」로 고친다(글자 수 같음, `planning.md` 행의 「고치지 않는다」를 「이 한 곳만」으로). 두 변경 뒤 절차 문서 합계를 다시 재서 상한을 넘지 않는지 확인한다.
- `pass`가 QA 문서를 판정할 때 `qaRequired`가 참이면 QA 문서 파일이 있어야 한다. `verify`는 QA 문서를 보지 않는다(통합 검사를 돌려 기록용 값 셋만 적는 명령이다). 파일이 없을 때의 안내는 둘로 가른다: `qa_skip_reason`이 있으면 「생략 사유가 더는 맞지 않는다: <걸린 파일> — QA 문서가 필요하다: <경로>」, 없으면(문서를 지웠거나 옛 상태 파일) 「QA 문서가 없다: <경로>」. `qaDocClean`의 「파일이 없으면 통과」는 `qaRequired`가 참인 자리에는 적용하지 않는다(그 규칙은 `ready-impl`이 존재를 강제하던 때의 것이다). 테스트: `skip-qa` 뒤 `game/**` 변경이 생기면 QA 문서 없이는 `pass review`가 넘어가지 않는다(W5의 임시 저장소에서 실제 프로세스로).
- `decideTransition`은 `qaClean`을 미리 받지 않는다. 통과 표시 둘이 통과했고 `qaRequired`가 참인데 `qaClean`이 없으면 `needsQa: true`를 돌려주고, 그러면 `workflow.mjs`가 그때 `qaDocClean`(vitest를 띄운다)을 구해 다시 부른다 — `verifyResult`와 같은 모양이다. 그래서 부분 `pass`나 통과 표시가 덜 찬 `pass`에서는 vitest가 돌지 않는다(지금 동작과 같다). 단위 테스트: 통과 표시가 덜 찼을 때 `needsQa`가 거짓, 다 찼고 QA가 필요하면 참.
- W5의 임시 저장소(`makeRepo(opts)`)의 모양을 정한다. 임시 루트 아래에 `repo/`(git 저장소)와 `bin/`(가짜 `pnpm`)을 형제로 둔다 — 가짜가 저장소 안에 있으면 `*.cmd`가 `CSO_PATHS`에 걸려 모든 임시 저장소에 `/cso`가 적용된다. 커밋은 셋이다. `c1`: 빈 README 하나. `c2`(기준 커밋): 절차 문서 stub(`docs/development/workflow/*.md`와 README)·계획 문서·QA 문서(옵션으로 뺄 수 있다)·`tests/logic/DocsHygiene.test.ts` 자리의 빈 stub(가짜 vitest가 성공으로 끝내므로 내용은 상관없다. `qaDocClean`의 판정 파일 존재 검사를 지나기 위한 것이다)·`.claude/workflow-state.json` — 미커밋 새 파일이 남지 않게 한다. `c3`: 상태 파일을 phase에 맞게 고친 커밋. 브랜치는 `main` = `c2`, `refs/remotes/origin/main` = `c2`, `feat/stale` = `c1`(`DocsHygiene.test.ts`의 「`origin/main`보다 1커밋 뒤」가 그대로 나온다), `feat/<feature>` = `c3`이고 `HEAD`는 `feat/<feature>`에 선다. `main`이 있어야 `wf start`(`git switch -c … main`)가 돈다. 옵션: `phase`·`state`(상태 파일 내용, `makeSandbox`의 옵션을 받는다), `qaDoc: false`(QA 문서를 안 만든다), `gameChange: true`(`c3`에 `game/assets/scripts/x.ts` 하나를 더해 `game/**` 변경을 만든다), `csoApplicable: true`(`c3`에 `.claude/wf-sandbox.mjs`를 더한다), `checkout: 'main'`(`HEAD`를 `main`에 둔다 — `DocsHygiene.test.ts`의 「로컬 main이 뒤처졌으면」이 `main`에서 `reset --hard HEAD~1`을 하므로), `git: false`(git 저장소를 만들지 않는다 — 아래). E3의 `status` 테스트와 「`/cso` 해당 없음일 때 `pass cso`를 받지 않는다」는 `csoApplicable`을 각각 켜고 끈 저장소로 돈다. 변경 집합 테스트의 기준은 `c2`다.
- `makeRepo({ git: false })`는 git 저장소 없이 폴더만 꾸민다(지금 `ClaudeMdSplit.test.ts`의 `makeSandbox`가 하는 일). 그 폴더에서는 변경 집합을 구할 수 없어 모든 검사가 적용되고, 통합 검사는 가짜 `pnpm`으로 통과하며, `pass cso`는 `HEAD`를 읽지 못해 `cso_commit`을 적지 않는다. `ClaudeMdSplit.test.ts`의 샌드박스 테스트 약 40개 가운데 변경 집합·`cso_commit`을 보지 않는 것은 이 길을 쓴다 — 전부 git 저장소로 만들면 Windows에서 스위트가 수 초 늘어 §10의 「통합 검사 한 번의 시간」이 흔들린다. 구현 뒤 §10에서 스위트 시간을 다시 잰다.
- 가짜 `pnpm`의 모양: `bin/pnpm.cmd`(Windows)는 `node "%~dp0fake-pnpm.mjs" %*` 한 줄, `bin/pnpm`(그 밖)은 같은 파일을 부르는 셸 스크립트 한 줄이고, 인자 해석과 `WF_SHIM_FAIL`은 `bin/fake-pnpm.mjs` 한 곳에 둔다 — `cmd` 배치는 `=`를 인자 구분자로 잘라 `--outputFile=<경로>`가 두 토막 나기 때문이다. `--outputFile`이 없는 `exec vitest run …` 호출(`qaDocClean`의 호출이 이 모양이다)에는 항상 0으로 끝낸다. `WF_SHIM_FAIL=vitest`는 `--outputFile`이 있는 호출(통합 검사)에만 듣는다. 그래야 「`pass review`가 넘기기 직전 검사에서 실패하면 넘어가지 않는다」가 QA 단계가 아니라 통합 검사에서 막히는 것을 확인한다.
- QA 판정표 넷째 줄(사유 있음 + 변경 집합을 구할 수 없음)에서 `pass`·`ready-impl`이 찍는 문장: 「변경 집합을 구할 수 없어 QA 문서가 필요하다: <경로> — <W1의 원인별 처방>」. 테스트: `origin/main`이 없는 임시 저장소에서 이 문장.
- `start-verification`의 실패 안내는 「절차: `pnpm wf steps implementation`」으로 끝낸다(실패하면 phase가 아직 `implementation`이고 나가는 조건이 그 문서에 있다). `verify`·`pass`는 「절차: `pnpm wf steps verification`」 그대로다.
- `approvePrDecision`은 `tsStatus !== 0`이면 적용 판정과 상관없이 막는다(지금 `approve-pr`과 같다). 테스트에 이 갈래를 더해 다섯 갈래로 한다.
- 통합 검사 실패 상세의 출처: vitest는 결과 파일의 `testResults[].assertionResults[].failureMessages`와 수집 단계 오류가 드는 `testResults[].message`에서 뽑고, 결과 파일이 없으면 stderr를 쓴다(`tsconfig.cocos.json` 안내는 그 둘 어디에 보여도 붙인다). 타입 검사와 biome은 표준 출력·오류를 그대로 40줄까지다.
- `invalidate`와 `rework`는 기록용 값 셋(`ts_check_clean`·`lint_clean`·`ts_check_scope`)을 비우지 않고 남긴다 — 마지막 통합 검사의 결과라 `status`가 그대로 보여 주고, `CHECKS`에서 `ts`·`lint`를 빼면 `resetVerification`이 저절로 건드리지 않는다. 옛 도구 복구 경로에서 이 값이 참으로 남아 있어도 `cso_done`·`code_review_clean`이 거짓이라 옛 도구도 넘어가지 않는다. 테스트: `invalidate` 뒤 셋이 그대로인지.
- `runTypecheck({ capture: true })`는 진행 줄(「▶ 타입체크 1/2」)과 `⚠` 안내를 화면에 찍지 않고 tsc 출력만 `details`로 돌려준다. `pnpm typecheck` 단독 실행(capture 없음)은 지금처럼 바로 찍는다.
- W6 `verification.md` 표의 글자 수: 「(적용 시)」 셋을 더하면 합계가 상한 13,575자를 넘으므로 지금 덜어 낼 문장을 정한다 — 34행의 「`pnpm wf invalidate`로 전체 검증을 초기화해 여기서부터 다시 시작한다」는 5행이 이미 말하므로 「`pnpm wf invalidate`를 친다」로 줄이고, 62행의 「고쳤으면 `pnpm wf invalidate`로 되돌려 보안 검사부터 다시 돈다」는 「고쳤으면 `pnpm wf invalidate`(위와 같다)」로 줄인다. 구현한 문구로 다시 재서 합계가 13,575자 이하인지 확인하고 표를 그 값으로 고친다.
- `qaDocClean`의 「`tests/logic` 폴더가 없으면 건너뛴다」 예외를 없앤다. 그 예외의 이유(툴체인 없는 임시 폴더)는 W5의 가짜 `pnpm`이 없앤다 — 임시 저장소에서는 vitest 호출이 가짜로 성공한다. 판정 파일(`tests/logic/DocsHygiene.test.ts`) 하나만 없을 때 막는 동작은 그대로 둔다. 기존 `qaDocClean` 테스트는 유지하고, 임시 저장소 E2E는 가짜 `pnpm`으로 통과해야 한다.
- `start-verification`을 W5의 임시 저장소에서 실제 프로세스로 고정하는 테스트 둘을 둔다. 성공: `verification`으로 넘어가고 `ts_check_clean`·`lint_clean`·`ts_check_scope`가 적힌다. 실패(`WF_SHIM_FAIL=vitest`): 넘어가지 않고 기록용 값이 실패로 적힌다.
- W7의 F71 행에 한 줄을 더한다: 「`status`에 「다음에 칠 명령」을 넣을지는 F71의 결과(절차 배달만으로 절차가 지켜지는가)를 본 뒤 정한다」. 사양 리뷰가 미룬 제안 E4의 기록이다.
- `cso_commit`을 쓸 수 있는지의 판정은 `change-set.mjs`의 `csoBaseUsable(csoCommit, root)` 하나다. 키가 있고 `git merge-base --is-ancestor <cso_commit> HEAD`가 참이면 쓸 수 있다. `invalidate`·`start-verification`·`status`가 모두 이 함수를 부른다. `.claude/lib/*.mjs`는 상태 파일을 읽고 쓰지 않을 뿐, git은 띄운다(`change-set.mjs`가 이미 그렇다).
- biome의 `write` 값: `start-verification`과 `verify`는 `write: true`로 돌려 형식 차이를 고치고 「n개 파일을 고쳤다」를 찍는다. `pass`만 `write: false`다(커밋과 리뷰가 끝난 뒤라 파일을 고치지 않는다).
- `runWf`는 가짜 `pnpm` 폴더를 `PATH` 앞에 붙일 때 `process.env`에서 대소문자를 무시하고 `PATH` 키를 찾아(Windows는 `Path`) 그 키의 값을 고친다. 키를 새로 만들지 않는다 — 같은 이름의 키가 둘이 되면 자식 프로세스가 어느 쪽을 읽을지 보장이 없다.
- `collectChangeSet`은 `git diff --name-status`의 `T`(형식 변경)를 `M`으로 읽는다. `A`·`M`·`D`·`T` 밖의 글자(`U` 등)가 나오면 `measurable: false`로 돌려 모든 검사를 적용한다. 테스트: `T` 한 줄이 든 출력과 `U` 한 줄이 든 출력.
- `status`는 `/cso`가 적용되는 슬라이스에서 `cso_commit`과 다음 점검 명령을 한 줄로 찍는다. `cso_commit`을 쓸 수 있으면(키가 있고 `HEAD`의 조상이면) 「다음 /cso: `/cso --diff --base <cso_commit>`」, 쓸 수 없으면 「다음 /cso: 전체 (<이유: 기록 없음 | 지금 HEAD의 조상이 아님>)」이다. 쓸 수 있는지의 판정은 `invalidate`·`start-verification`이 쓰는 함수 하나를 그대로 쓴다. 옛 형식 상태 파일 견본으로 「전체 (기록 없음)」을, `cso_commit`이 `HEAD`의 조상일 때 diff 명령을 확인하는 테스트를 둔다.
- `skip-qa`는 사유를 적은 뒤 성공 출력에 「생략은 `game/**` 변경이 없는 동안만 유효하다 — 그 변경이 생기면 `pass`가 QA 문서를 요구한다」 한 줄을 찍는다. 명령 출력을 확인하는 테스트에 이 줄을 포함한다.
- §6의 표에 결과를 재는 줄 넷을 더한다(2단계를 열지 정하는 조건에는 쓰지 않고, 1단계가 줄이겠다는 셋이 실제로 줄었는지를 본다): ① 검증 phase에서 AI가 친 `pnpm wf`·`pnpm` 명령 총수, ② 그 명령 출력의 글자 수 합계(세션 기록에서 센다), ③ `.claude/**`와 `tests/helpers/**`의 줄 수와 전체 테스트 한 번의 시간, ④ 계획 문서 글자 수·리뷰 회차·계획 승인까지 든 세션 수. 기준선은 계획 승인 뒤 직전 슬라이스 둘의 세션 기록으로 재서 2단계 백로그 항목에 적고, ④는 이 슬라이스(2026-09-16부터)를 첫 표본으로 적는다. 이 숫자가 §2.2 「도구 슬라이스를 멈추는 안」을 다시 볼 때의 근거가 된다.
- §1에 한 문장을 더한다: 「1단계는 슬라이스마다 드는 비용을 줄이는 대신 도구 코드의 양은 늘린다(새 모듈 여섯, 임시 저장소 도우미, 테스트). 실제 유지비는 §6의 줄 수·테스트 시간으로 잰다.」
- §2.2의 「실제로 이 저장소 이력에서 `/cso`가 찾은 것이 없다」 옆에 「도구 경로(`.claude/**`·`tools/**`)에서도 0건이다 — `docs/qa/`에 `*-security-issues.md`가 하나도 없다(2026-10-06 확인)」를 적는다.
- `CSO_PATHS`에서 `.claude/**`를 저장소가 추적하는 자리로 좁힌다: `.claude/*.mjs`·`.claude/hooks/**`·`.claude/lib/**`·`.claude/settings.json`. 지금 추적하는 `.claude` 파일 여섯(`workflow.mjs`·`typecheck.mjs`·`hooks/gate-scripts.mjs`·`hooks/check-gstack.sh`·`settings.json`·`workflow-state.json`)이 전부 들고(상태 파일은 변경 집합에서 빼므로 걸리지 않는다), Claude Code가 판마다 새로 만드는 생성물은 애초에 걸리지 않는다. `.claude/commands/**`는 지금 없으니 생기면 더한다고 주석에 적는다. W1의 `.gitignore` 목록은 biome `vcs` 모드가 저장소 `.gitignore`만 읽기 때문에 그대로 둔다 — 「`/cso`가 항상 적용된다」는 이유는 이 좁힘으로 사라진다. 대표 변경 집합 표의 「도구만(`.claude/**`)」 줄은 `.claude/workflow.mjs`로 돈다.
- `CSO_PATHS` 위 주석에 조건 하나를 더 적는다: 「외부 기여자의 PR을 받기 시작하면 `CLAUDE.md`·`.claude/commands/**`·`docs/development/workflow/**`를 더한다 — AI가 그대로 실행하는 지시문이라 자동화 설정과 같다」. 백로그 F109(공개 여부) 행에도 같은 한 줄을 건다. `verification.md`에는 넣지 않는다(글자 수 상한).
- `/cso` 명령 문자열(`/cso --diff --base <커밋>`)은 `.claude/lib/change-set.mjs`의 상수 하나에 두고 `invalidate`·`start-verification`·`status`와 테스트가 그 상수를 쓴다. 절차 문서에는 「바뀐 부분만 본다(기준 커밋은 `status`가 보여 준다)」까지만 적고, 정확한 옵션과 gstack이 깨졌을 때의 대체(Claude Code의 `security-review`는 브랜치의 미반영 변경을 본다)는 `docs/development/spec/ops-skill-routing.md`의 `/cso` 행에 한 줄 둔다. §8의 `canon-done` 경로에 그 문서를 더한다.
- `pass review`·`canon-done`·`canon-skip`과 `user-verification` 전이의 출력 줄에 그때의 `HEAD` 짧은 해시를 찍는다(예: `✓ pass review (HEAD 2c41977)`). 상태 파일에는 적지 않는다(§4 「새 키는 둘」). §6 셋째 값은 이 해시와 `git diff --stat <그 해시> <다음 통과 해시> -- <그 검사가 보는 경로>`로 잰다. §6에 한 문장을 더한다: 「셋째 값은 코드 수정이 한 번이라도 있으면 보통 1 이상이다(`invalidate`가 정본 선언을 비우므로). 그래서 사실상 『리뷰 뒤 코드 수정이 두 슬라이스에서 있었는가』를 묻는 조건이다.」 여는 조건 자체는 바꾸지 않는다.
- W7의 F10 행에 둘을 더한다: 「1단계가 상태 파일 때문에 둔 예외(변경 집합에서 제외)와 그 테스트는 추적을 끊으면 지운다」, 「F10은 2단계보다 먼저 정한다」.
- W1을 짜기 전에 git pathspec으로 같은 판정이 나오는지 한 번 돌려 본다: `git diff --name-status --no-renames <기준> -- ':(glob)<경로>'`와 `git ls-files -o --exclude-standard -- ':(glob,icase)<경로>'`(이 장비 git 2.50에서 `:(glob)`·`icase`가 돈다, 2026-10-06 확인). 대표 변경 집합 여섯의 판정 표가 그대로 나오면 직접 짠 경로 맞추기와 경계 테스트(`toolsmith/x`·`game/package.json`·`.Claude/`)를 빼고 git에 맡긴다. 안 나오는 경우를 기록하고 지금 안으로 간다. 어느 쪽이든 여섯 줄 판정 표와 `measurable: false` 규칙이 계약이다.
- `pass`가 `write: false`로 biome을 돌려 형식 차이가 나오면 실패로 세고 「형식 차이 n개 파일 — `pnpm wf verify`로 고치고 커밋한 뒤 다시 친다」를 안내한다. 커밋 훅(lint-staged)이 커밋한 파일의 형식을 맞추므로, 여기서 형식 차이가 나온다는 것은 미커밋 파일이 있다는 뜻이다.
- 「`tests/logic/` 아래 파일은 프로세스를 띄우지 않는다」 테스트는 `node:child_process`뿐 아니라 접두사 없는 `child_process`, `node:worker_threads`, `worker_threads`의 import도 잡는다.
- §6 둘째 값의 기준선 「137회」는 2026-08-18 이후 누적이므로 그 기간의 슬라이스 수로 나눈 슬라이스당 평균으로 적는다(계획 승인 뒤 센다). 기대값 「1 + `user-verification`에 들어온 횟수」도 슬라이스당이다.
- sessions/로 옮기며 개요와 작업 묶음별 문서로 나눌 때, 이 승인 항목들은 해당 W절 본문에 녹이고 §12에는 결과 조건 다섯만 남긴다. 어느 리뷰에서 왔는지는 리뷰 기록 문서에 둔다.
- `verify.mjs`의 실행별 임시 폴더는 `finally`에서 지운다(실패·예외에서도). vitest 결과 파일이 없거나 JSON으로 읽히지 않으면(중간에 죽은 경우) 둘 다 「테스트 실행기가 결과 없이 끝났다 — `pnpm exec vitest run`으로 다시 돌려 보라」 길로 보낸다. 시험용 실행기 단위 테스트에 깨진 JSON 경우를 더한다.
- git 띄우기는 `change-set.mjs`의 `git(root, args)` 하나다(`spawnSync`, `maxBuffer` 64MiB, `shell` 없음). `workflow.mjs`의 `git()`은 이것을 import해 쓰고 자기 `spawnSync("git", …)`을 없앤다.
- `status`와 `start-verification` 성공 출력이 찍는 적용 판정 줄(검사마다 한 줄 + 갈라진 지점·항목 수 + QA 생략 + 다음 `/cso`)은 `change-set.mjs`의 순수 함수 `formatGateLines(gates, changeSet, state)`가 만들고 둘이 같은 함수를 쓴다. 단위 테스트가 문자열로 고정한다.
<!-- /autoplan-accepted:ceo -->
