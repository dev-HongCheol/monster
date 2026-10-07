# 워크플로우 다이어트 W3 — `approve-pr` · `status` · `check-meta`

- **작성일:** 2026-10-06
- **브랜치:** `feat/workflow-diet`
- **만드는 것:** `transition.mjs`의 `approvePrDecision`·`formatGateLines` · `workflow.mjs`의 `approve-pr`·`status`·`check-meta` · 없는 명령을 쳤을 때의 안내
- **정본:** [`workflow/user-verification.md`](../workflow/user-verification.md) · [`CLAUDE.md`](../../../CLAUDE.md) 명령 표와 「에셋 `.meta` 관리 규칙」. `approve-pr`의 `.meta` 검사와 타입 검사 범위 확인이 변경 집합에 해당 파일이 있을 때만 이루어진다는 내용을 이 문서들에 적는다(문구는 W6에서 정한다).
- **개요:** [계획 개요](2026-10-06-workflow-diet-plan.md)

---

## 1. `approve-pr`

판정은 `transition.mjs`의 `approvePrDecision({gates, tsScope, tsStatus, missingMeta}) → {ok, reasons}`가 한다. `decideTransition`처럼 입력만 받아 답하는 함수다. 출력할 때는 적용 판정 표를 타입 검사 결과보다 먼저 출력한다.

- `tsStatus !== 0`이면(타입 검사가 실패하면) 적용 판정과 상관없이 막는다(지금 `approve-pr`과 같다). 타입 검사는 지금처럼 `approve-pr`이 머지 직전에 `runTypecheck()`로 다시 돌린다.
- `fullTypecheck`가 「해당 없음」이면 타입 검사 범위가 `logic-only`여도 통과시킨다. 「적용」이면 지금처럼 `full`이어야 한다.
- `meta`가 「해당 없음」이면 `.meta` 검사를 건너뛰고 「해당 없음」을 출력한다. 「적용」이면 지금처럼 git에 올리지 않은 `.meta`가 하나라도 있으면 막는다.
- 변경 집합을 구할 수 없으면(`measurable: false`) 두 검사를 모두 한다. 타입 검사 범위가 `logic-only`면 거부한다.
- 거부할 때의 출력은 「절차: `pnpm wf steps user-verification`」으로 끝낸다.

## 2. `check-meta`

따로 치는 `check-meta` 명령은 변경 집합과 상관없이 항상 검사한다. 사용자가 일부러 부른 명령이라 건너뛰지 않는다.

## 3. `status`

지금 출력하는 상태 아래에, 이번 변경 집합으로 계산한 적용 판정을 검사마다 한 줄씩 출력한다. 예: `meta: 해당 없음 (game/assets/** 변경 없음)`, `cso: 적용 (.claude/workflow.mjs 외 3개)`. 이 브랜치가 main에서 갈라진 커밋과 변경 집합의 항목 수도 출력한다.

- 변경 집합을 구할 수 없으면 「기준을 구할 수 없어 모든 검사를 한다」와 원인별 안내 문구(W1 §2.1)를 출력한다.
- `skip-qa`로 적은 사유가 있으면 사유와 지금도 유효한지를 출력하고, 없으면 「QA 문서 생략: 없음」을 출력한다.
- 상태 파일은 고치지 않는다. git 저장소가 아닌 폴더에서 쳐도 오류로 멈추지 않는다.

`/cso`를 해야 하는 슬라이스에서는 `cso_commit`과 다음 점검 명령을 한 줄로 출력한다. `cso_commit`을 쓸 수 있으면(W1 §5의 `csoBaseUsable`) 「다음 /cso: `/cso --diff --base <cso_commit>`」, 쓸 수 없으면 「다음 /cso: 전체 (<이유: 기록 없음 | 지금 HEAD의 조상이 아님 | 지금 저장소에 없는 커밋>)」이다. 글자 수에 여유가 있으면, W6에서 `qa-setup.md`에 복사해 쓸 수 있는 예로 `다음 /cso: /cso --diff --base 2c41977` 한 줄을 함께 넣는다.

이 적용 판정 출력(검사마다 한 줄 + 갈라진 커밋과 항목 수 + QA 문서 생략 여부 + 다음 `/cso`)은 `transition.mjs`의 순수 함수 `formatGateLines(gates, changeSet, state)`가 만든다. `status`와 `start-verification`의 성공 출력이 같은 함수를 쓴다. 출력 문자열은 단위 테스트로 고정한다.

명령 목록에서 `verify` 옆에는 「(phase가 바뀌지 않음)」을 붙인다. 없는 명령을 치면 「알 수 없는 명령: X」와 명령 목록을 출력한다. `status`에 「다음에 칠 명령」까지 넣을지는 F71의 결과(절차 문서를 출력해 주는 것만으로 AI가 절차를 지키는가)를 본 뒤 정한다(W7).

## 4. 테스트

- `approvePrDecision`의 여섯 경우: 타입 검사가 실패하면(`tsStatus !== 0`) 막힌다. 「적용」·「해당 없음」과 `.meta` 누락·타입 검사 범위를 조합한 네 경우. `measurable: false`면 모두 적용이라 `logic-only`를 거부한다.
- `formatGateLines`의 출력 문자열을 고정한다.
- 옛 형식 상태 파일 견본(W5)을 읽었을 때, `status`가 적용 판정 표와 「다음 /cso: 전체 (기록 없음)」을 출력하고 `approvePrDecision`이 판정을 내는지. `cso_commit`이 `HEAD`의 조상일 때 `--diff --base` 명령을 출력하는지.
- `approve-pr`을 실제 프로세스로 실행하는 테스트는 가짜 `pnpm`(W5) 덕분에 끝까지 돈다. 적용 판정 표가 타입 검사 결과보다 먼저 출력되는지, `pr-ready`로 넘어가는지까지 확인한다.
- `status`와 `approve-pr` 거부 출력의 마지막 줄(「절차: …」).
