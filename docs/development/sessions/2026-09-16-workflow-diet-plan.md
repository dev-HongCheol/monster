# 워크플로우 다이어트 1단계 — 해당 없는 게이트를 건너뛰고, 기계 검사를 한 경로로 모으고, 판정 사본을 없앤다

- **작성일:** 2026-09-16 (계획 승인 게이트 2026-09-17)
- **브랜치:** `feat/workflow-diet` · worktree `F:\work\monster-wf`
- **상태:** 계획 — `/autoplan` 리뷰 완료·최종 게이트 승인(2026-09-17). 다음은 사용자 `계획 승인` → `pnpm wf approve-plan`
- **정본:** [`workflow/verification.md`](../workflow/verification.md) · [`workflow/qa-setup.md`](../workflow/qa-setup.md) · [`workflow/README.md`](../workflow/README.md) · [`CLAUDE.md`](../../../CLAUDE.md) 「Workflow」 절 — 이 슬라이스가 검증 단계의 명령 사슬을 통합 검사 하나로 줄이고, 해당 없는 게이트 규칙과 QA 문서 틀의 절 생략 조건·`skip-qa` 규칙을 적는다
- **닫는 백로그:** `F78`(판정 사본) · `F107`(gstack 산출물이 `pnpm check`를 빨갛게 만든다). `F10`은 닫지 않고 2026-09-17 결정(추적 유지, 핸드오프 수단과 함께 다음 도구 슬라이스)을 행에 적는다. `F95`·`F96`은 2단계로 넘기고 이번에 후보 절만 지목한다
- **입력:** 범위·제약 [`2026-09-16-workflow-tooling-diet-brief.md`](2026-09-16-workflow-tooling-diet-brief.md) · 설계 초안(`/office-hours`, 2026-09-17 D13 승인)은 §0이 이어받았다 · 실측 원문과 답변 기록은 `docs/temp/`(git 미추적)
- **문서 구성:** 이 개요 + 작업 묶음 문서 W1~W7 + 2단계 계약 [`2026-09-16-workflow-obligations-contract.md`](2026-09-16-workflow-obligations-contract.md) + 리뷰 기록 [`2026-09-16-workflow-diet-review-record.md`](2026-09-16-workflow-diet-review-record.md). 리뷰 수용 항목은 각 본문에 녹였고 따로 목록을 두지 않는다

---

### 0. 설계 기록 — 어디서 왔나

이 절은 `/office-hours`(2026-09-16)와 외부 검토(GPT, 2026-09-17)로 확정된 설계 초안을 이어받는다. 초안 파일은 계획 승인 뒤 지우므로 다음 사람이 「왜 B안인가」를 되짚을 수 있는 만큼만 여기 남긴다. 범위와 제약의 출처는 [`2026-09-16-workflow-tooling-diet-brief.md`](2026-09-16-workflow-tooling-diet-brief.md)다.

#### 0.1 문제와 실측

지금 워크플로우는 규모와 무관하게 모든 슬라이스가 같은 9단계를 돈다. 문서 검사기 한 줄을 고치는 도구 슬라이스도 게임 코드 슬라이스와 같은 QA 문서 틀을 채우고, `/cso`를 돌리고, `.meta` 검사를 받고, 리뷰에서 무언가 고치면 검증을 처음부터 되감는다. 사용자가 가장 아깝다고 짚은 구간이 이것이고(D3), 줄이고 싶은 부담은 슬라이스 시간·AI가 읽는 양·도구 유지비 셋이다(D2). 사람 개입은 줄일 대상으로 고르지 않았다.

기준선은 이 장비의 세션 기록에서 완료된 도구 슬라이스 넷(`docs-references` `3253727` · `docs-hygiene` `f4eb4b8` · `eol-policy` `9ee8519` · `docs-guard-cut` `7067cb2`, 2026-08-18~20, 넷 다 `game/` 변경 0건)을 잰 것이다. 실제로 실행한 `pnpm wf <전이>` 명령과 그 성공 줄로 phase 경계를 잡고, 그 사이 어시스턴트 메시지의 도구 호출 수·출력 토큰·활동 시간(10분 넘는 공백 제외)을 더했다. 서브에이전트가 쓴 토큰은 별도 기록이라 빠져 있다. 머지 뒤 재측정(§12)은 이 표와 같은 방법으로 잰다.

| 구간 | 도구 호출 | 출력 토큰 | 활동 시간 |
|---|---:|---:|---:|
| 계획 (`/office-hours`·`/autoplan`) | 17% | 34% | 33% |
| QA 문서·RED 테스트 | 4% | 6% | 3% |
| 구현 | 19% | 15% | 10% |
| 검증 → `pass cso`까지 | 32% | 26% | 26% |
| 검증 → `pass ts`·`lint`·`review` 표시 | 4% | 2% | 2% |
| 사용자 검증 진입 (문서 정리·Draft PR) | 16% | 14% | 20% |
| 머지 | 8% | 4% | 6% |

「`pass cso`까지」 구간에는 QA 문서 확정, 정본 선언, `/cso`, 그리고 코드 리뷰 → 수정 → `invalidate` → 재검증이 모두 들어 있고, 네 슬라이스 모두 `invalidate`가 한 번씩 났다. 검사 명령의 누적 출력은 2026-08-18 이후 약 45만 자이며 `check-links`만 137회다. 무엇이 실제로 잡았는지도 갈린다 — 코드 리뷰는 네 슬라이스 모두에서 Critical·Important 결함을 잡았고, `/cso`는 레포 전체 이력에서 보안 이슈 문서를 한 번도 만들지 않았으며, 타입체크는 55회 중 13회 실제 오류를 막았고, QA 문서의 씬·에디터 절은 네 슬라이스 모두 「없다」로 채웠다.

#### 0.2 전제 일곱 (D5·D7)

1. 줄일 대상은 규모와 무관하게 모든 슬라이스가 같은 9단계를 도는 것이다.
2. 가벼운/무거운 경로를 상태로 저장하지 않는다. 게이트마다 적용 범위(경로)를 두고 전이 때 변경 집합으로 지금 통과해야 할 게이트를 계산한다. 계획 무게는 계획 문서가 선언한 `scope:`로 정하고(2단계), 선언 밖에서 `game/**`가 나타나도 막지 않고 게이트와 리뷰 구성을 더한 뒤 `status`에 표시한다. 코드 리뷰와 전체 테스트는 경로와 무관하게 늘 건다.
3. 코드 리뷰(서브에이전트)는 남긴다. 줄일 것은 리뷰 뒤의 재검증 비용이다.
4. `/cso`는 비용을 줄일 후보다. 적용 범위를 좁힌다.
5. 사람 게이트 셋(계획 승인·PR 승인·리워크)과 기계 게이트는 유지하되 해당 없는 게이트는 건너뛸 수 있다. 새 사람 게이트는 만들지 않는다.
6. 진행 중인 3D 슬라이스와 호환한다.
7. 읽는 양과 도구 유지비도 범위다. 절차 문서·사본(F78)·실효 없는 게이트를 덜어내되 정본 이력 방침은 건드리지 않는다.

전제 2의 원안은 「경로를 diff로 판정한다」였는데 두 번째 의견(Claude 서브에이전트)이 반론했다. diff는 구현 뒤에 생기므로 가장 비싼 계획 구간을 못 줄이고, 경로가 위험도를 뜻하지도 않는다 — 네 도구 슬라이스는 `game/` 변경이 0건인데도 리뷰가 Critical 결함을 잡았으므로 경로로 리뷰를 빼면 그 결함이 머지된다. 그래서 「코드 리뷰와 전체 테스트는 늘 건다」는 단서를 붙였다. 마지막 문장은 원래 「선언 밖에서 `game/**`가 나타나면 막는다」였는데, 막으면 빠져나오는 길이 필요하고 그 길은 넷째 사람 트리거(`approve-scope`)가 되므로 자동 승격으로 바꿨다. `scope:`는 안전 장벽이 아니라 계획·리뷰 비용을 조절하는 힌트다.

#### 0.3 검토한 대안

- **A 최소안** — `game/` 변경 유무만 보고 해당 없는 게이트를 건너뛴다. 단독으로는 기각했다. 되감기 구조·계획 비용·F44 구멍·사본이 그대로다. 내용은 B 1단계에 들어갔다.
- **C 다른 각도** — 기계 검사를 명령 하나로 묶어 AI 턴 수를 줄인다. 단독으로는 기각했다. 게이트의 의미는 안전하게 유지하지만 해당 없는 게이트와 계획·되감기 구조가 그대로다. 내용은 B 1단계에 들어갔다.
- **B 이상안** — 게이트 표 + 지문 통과 기록 + 계획 `scope:` + 사본 제거. 채택(D8). 고른 부담 셋을 모두 겨냥하는 안은 B뿐이었다. 완결도는 B 9/10 · A+C 7/10 · C 6/10 · A 5/10으로 봤다. 두 단계로 갈라 1단계(이 슬라이스)는 A·C를 흡수한 건너뛰기·통합 검사·사본 제거이고, 2단계는 지문·`scope:`·장부다.

#### 0.4 검토 이력

**서브에이전트 리뷰 세 회차(2026-09-16).** 이슈 서른아홉 가운데 서른셋을 반영했다. 남겨 두었던 다섯(테스트 상수의 두 용도, 러너 교체 환경변수의 우회 경로, `check-meta` 단독 명령, QA 씬 절의 경로, 상위 저장소 오탐)은 외부 검토에서 같은 자리가 다시 짚혀 본문에 넣었다.

**외부 검토(GPT, 2026-09-17).** 방향은 맞다고 보되 승인 전에 고칠 것을 들었고 다음을 받아들였다. `start-verification`과 `verify`가 전체 테스트를 두 번 돌리는 문제는 통합 검사 경로 하나로, 지문이 정본·QA 판단의 낡음을 보호하지 못하는 문제는 둘을 늘 적용되는 게이트로, `user-verification`에서 고친 파일이 `approve-pr`을 지나가는 문제는 2단계 `assertCurrentObligations`를 두 전이에서 부르는 것으로, F78을 위해 strip-types 인프라를 들이는 과설계는 공유 `.mjs`로, `approve-scope` 대신 자동 승격으로, 성공 기준에 비용 지표를 더하는 것으로 각각 닫았다. 받아들이지 않은 것은 상태 파일을 PR1에서 gitignore로 바꾸자는 제안(장비를 옮겨 다니는 작업 방식과 부딪힌다, D12)과 `wf audit` 집계를 빼라는 지적(D9의 사용자 결정)이다.

**`/autoplan`(2026-09-17, CEO → DX → Eng).** 수용 항목 R1~R13·D1~D18·E1~E28은 이 문서와 W 문서 본문에 녹였다. 최종 게이트에서 사용자가 UC1(`tests/logic/**`를 `/cso` 경로에서 뺀다)·UC2(`/cso` 경로 목록 보존)·T1(`skip-qa`)·T3(포맷 자동 적용, `pass` 재실행은 check-only)을 수용하고 PC1(도구 슬라이스 모라토리엄)·T2(`planning.md` 리뷰 구성 한 줄)·T4(`.meta` 검사 늘 돌리기)는 원안을 유지했다. 리뷰 전문은 [`2026-09-16-workflow-diet-review-record.md`](2026-09-16-workflow-diet-review-record.md)다.

#### 0.5 대화에서 본 것

아깝다고 느낀 구간을 어느 단계가 아니라 「규모와 무관하게 모든 슬라이스가 같은 전 과정을 도는 것」이라고 짚었기 때문에 대안이 「어느 검사를 뺄까」가 아니라 「무엇이 언제 적용되는가」로 갔다. 두 번째 의견이 전제 2를 반론했을 때 원안을 지키지 않고 고쳤다. 줄이고 싶은 부담에서 「사람 개입·확인이 많음」을 빼 놓은 것이 전제 5와 넷째 트리거를 만들지 않는 결정으로 이어졌다. 장부는 「기록만」으로 골랐고, 설계 문서를 프로젝트를 모르는 검토자에게 한 번 더 보냈다.

### 1. 무엇을 하나

지금 워크플로우는 규모와 무관하게 모든 슬라이스가 같은 9단계를 돈다. 문서 검사기 한 줄을 고치는 도구 슬라이스도 QA 문서의 씬·에디터 절을 「없다」로 채우고, `/cso`를 돌리고, `.meta` 검사를 받고, 검증에서 명령 넷(`pnpm typecheck` → `pass ts` → `pnpm check --write` → `pass lint`)을 따로 친다. 실측(도구 슬라이스 넷)에서 검증 구간이 도구 호출의 32%를 차지했다. 그 32%는 QA 확정·정본 선언·`/cso`·리뷰 뒤 `invalidate` 재검증의 합이고, `pass ts`·`lint`·`review` 표시 구간은 따로 4%다. 아래 2번(명령 넷→하나)이 줄이는 것은 그 4% 버킷이고, 32%의 몸통인 되감기는 2단계 지문이 줄인다. 검사 명령은 2026-08-18 이후 누적 출력 45만 자를 냈다. 비용은 검사 한 번의 시간이 아니라 횟수(검사 하나가 AI 턴 하나)와 실패 뒤 왕복에서 난다.

이 슬라이스는 승인된 설계(B안)의 **1단계**다. 게이트의 의미는 바꾸지 않고 셋을 한다.

1. **해당 없는 게이트를 건너뛴다.** 변경 집합(merge-base 이후 변경 + 미추적 파일)을 경로로 보고 `.meta` 검사·`full` 타입체크 요구·`/cso`의 적용 여부를 정한다. `/cso` 통과 기록은 걸린 경로 목록과 함께 남겨 `invalidate`가 목록이 같으면 보존한다(UC2). `game/assets/**`를 안 건드리는 슬라이스는 QA 문서를 사유와 함께 생략할 수 있다(T1).
2. **기계 검사를 한 경로로 모은다.** `start-verification`이 타입체크 → biome → 전체 vitest를 한 번 돌려 기록하고, `wf verify`가 같은 경로의 재실행이다. `pass ts`·`pass lint`는 지운다.
3. **판정 사본을 없앤다(F78).** `workflow.mjs`와 `tests/helpers/`에 두 벌씩 있는 판정 코드를 `.claude/lib/*.mjs` 한 벌로 옮기고 CLI와 테스트가 같은 파일을 import한다.

**2단계**(게이트 표 + 파일 지문 통과 기록 + 계획 `scope:` + 장부)는 §6에 설계 계약으로만 적는다. 이 슬라이스가 머지되고 3D 브랜치 호환을 확인한 뒤 새 슬라이스 `workflow-obligations`로 연다.

이 슬라이스 자체가 새 절차의 첫 사용자다. 이 브랜치의 `workflow.mjs`가 이 슬라이스의 검증 단계를 돌리므로, `verification`에 들어가는 순간 통합 검사 경로와 해당 없음 판정이 실전에서 처음 돈다. 이 브랜치는 `.claude/**`를 고치므로 `/cso`는 적용되고, `game/**`를 안 건드리므로 `.meta`와 `full` 범위 요구는 해당 없음이어야 한다.

### 2. 결정 (2026-09-16~17, 사용자)

`/office-hours` D1~D13의 결과다. 번호는 그 D 번호를 그대로 쓴다.

- **D2·D3 줄일 것.** 슬라이스 시간·AI가 읽는 양·도구 유지비 셋이다. 사람 개입은 줄일 대상이 아니다. 아까운 구간은 「규모와 무관하게 모든 슬라이스가 같은 전 과정을 도는 것」이다.
- **D7 전제 2.** 가벼운/무거운 경로를 상태로 저장하지 않는다. 게이트마다 적용 범위를 두고 변경 집합으로 계산한다. 코드 리뷰와 전체 테스트는 경로와 무관하게 늘 건다. 선언 밖에서 `game/**`가 나타나도 막지 않고 게이트·리뷰 구성을 자동으로 더한다(외부 검토 뒤 마지막 문장을 고침, D13에서 확인).
- **D8 B안 두 단계.** 1단계 = 건너뛰기 + 통합 검사 + 사본 제거, 2단계 = 게이트 표 + 지문 + `scope:`.
- **D9 장부.** 2단계에 기록만. `wf audit`는 게이트별 실행·차단 수만 센다.
- **D10 PR 둘, 계획 한 번.** 이 브랜치는 1단계만. 2단계는 계약 수준으로 지금 리뷰하고, 1단계 실증 뒤 달라진 것이 있을 때만 덧붙임과 델타 리뷰.
- **D12 상태 파일.** `.claude/workflow-state.json`은 git 추적을 유지하고 변경 집합에서만 뺀다. 장비를 옮길 때 phase가 따라오는 것이 브랜치 충돌 두 번보다 가치가 크다.
- **D13 설계 승인.** `/cso`는 「개발 장비에서 실행되는 코드·자동화·의존성·공급망·git 실행 동작을 바꾸는 파일」에만 적용(A 원문과 반대). `pass ts`·`pass lint` 삭제. F78은 공유 `.mjs`. 2단계 지문은 정본 판단·QA 확정도 묶고 `approve-pr`에서도 다시 잰다.

기각한 안(한 줄씩):
- A 최소안·C 묶음 실행 단독 — 되감기 구조·계획 비용·사본이 그대로다. 둘 다 1단계에 흡수했다.
- `/cso`를 `game/` 변경 없으면 해당 없음으로 — 게임 코드는 네트워크 없는 클라이언트 로직이라 `/cso`가 볼 것이 없고, 실제로 이력에서 한 번도 잡은 것이 없다. 셸을 실행하는 쪽이 `.claude/**`·`tools/**`·`tests/helpers/**`다. `tests/logic/**`는 뺀다(UC1, 2026-09-17 승인) — 넣으면 `ready-impl`이 모든 슬라이스에 요구하는 `tests/logic/<Feature>.test.ts` 때문에 `/cso` 해당 없음이 한 번도 안 켜진다(머지 PR 45건 대입 확인). 프로세스를 띄우거나 파일을 쓰는 테스트 코드는 `tests/helpers/`에 둔다.
- `pass ts|lint` 호환 유지 — 두 경로가 남으면 「명령 넷에서 하나」 기준이 재지지 않는다.
- strip-types로 `workflow.mjs`가 `tests/helpers/*.ts`를 직접 import — 테스트(`spawnSync(process.execPath, [workflow.mjs])`)와 훅이 플래그 없이 띄우므로 `.ts`를 import하지 않는 런처·기능 감지·자식 재실행·경고 억제·`engines` 상향·`"type": "module"`이 함께 필요했다. `tools/**`가 이미 `node --experimental-strip-types`로 직접 돌지만 그쪽은 사람이 명령을 치는 진입점이라 사정이 다르다. 사본 둘을 없애려고 그보다 큰 인프라를 들이지 않는다. 이 판단은 Node 22.17 기준이다. 22.18 이상에서는 플래그 없이 타입 스트리핑이 켜져 런처·감지·재실행 비용이 사라지므로 그때 재평가한다(`engines.node` 명시는 F111).
- `범위 승인`(`approve-scope`) 넷째 사람 트리거 — 사람 개입은 계획 승인·PR 승인·리워크 셋뿐이라는 규칙과 어긋난다. 범위 이탈은 자동 승격 + `status` 표시 + `PR 승인`으로 받는다.
- 상태 파일을 PR1에서 gitignore — 장비를 옮길 때 phase가 백지가 되고 `wf start`는 planning으로 초기화하므로 복구 수단이 없다(D12).
- `wf audit` 집계 삭제 — D9 결정.
- `start-verification`(GREEN)과 `verify`를 따로 두기 — 전체 vitest는 3.7초라 시간이 아니라 AI 턴 수가 문제이고, 두 명령이면 첫 회차에 턴이 하나 더 든다.
- 러너를 환경변수로 바꿔 끼우는 시험 훅 — 변수 하나로 아무것도 안 돌리고 통과를 기록할 수 있어 명예제도가 뒷문으로 돌아온다. 러너는 모듈 경계에서 주입한다.
- 도구 슬라이스 모라토리엄(PC1, 외부 목소리 단독) — 원안 유지(2026-09-17). v1 축이 완성도로 옮겨 있고 3D 파이프라인 시험이 진행 중이라 도구 슬라이스가 지금의 일이다. 2단계 go/no-go는 §12의 재측정으로 잰다.
- `planning.md`에 「도구 슬라이스는 엔지니어링+DX 리뷰만」 한 줄(T2) — 미룸(2026-09-17). 2단계 `scope:`가 같은 것을 기구로 하고, 그때까지 절차는 유지한다(D14).
- `approve-pr`의 `.meta` 검사를 늘 돌리기(T4, 외부 목소리 단독) — 기각(2026-09-17). 건너뛰어 아끼는 것이 ms·0턴인 것은 맞지만, 게이트는 변경 집합으로 계산한다는 D7과 슬라이스 격리(main의 무관한 `.meta` 누락으로 도구 슬라이스가 막히지 않는 것)가 우선이다. `check-meta`가 늘 도는 진단으로 남는다.

### 3. 뒤집는 과거 결정

결정 기록은 고치지 않고 여기에 무엇을 뒤집는지 적는다.

| 과거 결정 | 어디 | 이번에 |
|---|---|---|
| 검증은 `/cso` → `pass cso` → `pnpm typecheck` → `pass ts` → `pnpm check --write` → `pass lint` → 커밋 → 리뷰 → `pass review` 순이다 | `workflow/verification.md` · `CLAUDE.md` 9단계 뼈대 6번 | `start-verification`이 통합 검사를 돌리고, 검증 안에서는 (`/cso` → `pass cso`가 적용될 때만) → 커밋 → 리뷰 → `pass review`. 코드를 고치면 `wf verify`로 재실행 |
| `pass ts`가 타입체크를 직접 실행한다(PR #56) | `CLAUDE.md` 명령 표 · `workflow.mjs`의 `pass` | 실행은 유지하되 자리가 통합 검사 경로로 옮겨 간다. `pass ts`·`pass lint` 명령은 없어진다 |
| QA 문서는 씬·프리팹·에디터 절을 항상 채운다 | `workflow/qa-setup.md` | 계획이 `game/assets/**`를 건드리지 않으면 생략한다. `verification`의 QA 확정 때 `wf status`가 `.meta` 게이트를 적용으로 보이면 그때 채운다 |
| `approve-pr`은 `ts_check_scope`가 `full`이 아니면 거부한다 | `workflow.mjs`의 `approve-pr` 주석 | 변경 집합에 `game/**`·`package.json`·`pnpm-lock.yaml`이 없으면 `logic-only`를 허용한다 |
| F78은 「`check-links`처럼 로직을 `tests/helpers/`에 한 벌 두고 CLI가 vitest를 띄우는 형태」로 닫는다 | `backlog-docs.md` F78 | CLI가 테스트 프로세스를 띄우는 대신 `.claude/lib/*.mjs`를 CLI와 테스트가 함께 import한다. `check-links`·`check-qa`는 지금 형태를 유지한다 |

### 4. 제약

- **3D 슬라이스 호환.** phase 이름을 바꾸지 않는다. 상태 파일의 키를 없애지 않는다. 새 키는 둘(`cso_paths`·`qa_skip_reason`)이고 옛 파일에 없으면 `null`로 읽는다(UC2·T1). `feat/blender-3d-gate`의 실제 상태 파일(`qa-setup`, 검증 플래그 넷 `false`, `canon_updated` 1건, `qa_doc_fingerprint` 있음)을 픽스처로 삼아 새 `workflow.mjs`가 읽고 전이하는지 테스트로 고정한다.
- **상태 파일은 추적 유지(D12).** 슬라이스 끝에 최종 상태를 커밋하는 관행도 그대로다. 3D 브랜치가 이 PR을 받을 때 이 파일에서 충돌이 나는 것은 알고 들어간다.
- **같은 파일 충돌.** 3D 브랜치가 `CLAUDE.md` ADR 목록 한 줄(ADR 009)과 백로그 세 파일(`F105`~`F108`)을 더했다. 이 슬라이스는 `CLAUDE.md` 「Workflow」 절과 `backlog-docs.md`·`backlog-implement.md`를 고치므로 충돌이 난다. 새 백로그 번호는 `F109`부터, 새 ADR은 1단계에서 만들지 않는다(2단계에서 만들 때 두 브랜치의 번호를 확인한다).
- **정본 이력 방침은 건드리지 않는다.** `renderCanonDoc`을 `.claude/lib/canon.mjs`로 옮기되 `이력:` 템플릿의 문구는 그대로 옮긴다.
- **메모리는 머지 때 고친다.** `feedback_follow_workflow`(커밋 단계 표기)·`feedback_ide_diagnostics_open_files`(`pass ts`가 타입체크를 실행) 같은 메모리가 새 명령과 어긋나게 되지만 PR 머지 시점에 고친다.
- **전이 시험은 임시 폴더에서.** 실제 상태 파일에서 `wf start`를 돌리면 이 슬라이스의 `planning`이 사라진다. 변경 집합 판정은 git이 필요하므로 `DocsHygiene.test.ts`의 `makeRepo`(커밋 둘 + `refs/remotes/origin/main`)를 공유 헬퍼로 올린다.
- **의무 독서 예산.** `CLAUDE.md` + 정본 셋 합계 37,857자, 상한 38,000자, 여유 143자. `CLAUDE.md` 「Workflow」 절을 고칠 때 더하는 만큼 뺀다.
- **`.meta`는 만들지 않는다.** 이 슬라이스는 `game/**`를 건드리지 않으므로 신규 `.meta`가 0개여야 하고, 그것이 `.meta` 게이트 「해당 없음」의 첫 실증이다.
- **탈출구 없음.** 새 `workflow.mjs`의 버그가 `pass`에서 터지면 `verification`에서 고치면 되지만 `approve-pr`에서 터지면 `rework` 절차다. 옛 CLI로 돌리는 우회는 없다(`git show origin/main:.claude/workflow.mjs`는 상대 import 때문에 단독 실행이 안 된다). 알고 들어간다.
- **`agy` 리뷰 이관은 밖이다.**

### 5. 1단계 작업

작업 묶음 W1~W7이다. 계획 승인 뒤 개요 + 묶음별 문서로 나눌 때 이 번호를 파일 이름에 쓴다.

| 묶음 | 문서 | 무엇을 |
|---|---|---|
| W1 | [`2026-09-16-workflow-diet-w1-change-set.md`](2026-09-16-workflow-diet-w1-change-set.md) | 변경 집합과 적용 판정 |
| W2 | [`2026-09-16-workflow-diet-w2-verify-transition.md`](2026-09-16-workflow-diet-w2-verify-transition.md) | 통합 검사 경로와 전이 판정 |
| W3 | [`2026-09-16-workflow-diet-w3-approve-pr-status.md`](2026-09-16-workflow-diet-w3-approve-pr-status.md) | `approve-pr`·`status`·`check-meta` |
| W4 | [`2026-09-16-workflow-diet-w4-dedupe-f78.md`](2026-09-16-workflow-diet-w4-dedupe-f78.md) | 판정 사본 제거(F78) |
| W5 | [`2026-09-16-workflow-diet-w5-sandbox-legacy-state.md`](2026-09-16-workflow-diet-w5-sandbox-legacy-state.md) | 공유 샌드박스와 옛 상태 파일 호환 |
| W6 | [`2026-09-16-workflow-diet-w6-docs-claude-md.md`](2026-09-16-workflow-diet-w6-docs-claude-md.md) | 절차 문서·`CLAUDE.md`·QA 문서 틀·ADR 010 |
| W7 | [`2026-09-16-workflow-diet-w7-backlog.md`](2026-09-16-workflow-diet-w7-backlog.md) | 백로그 |

### 6. 2단계 설계 계약 — `workflow-obligations`

별도 문서 [`2026-09-16-workflow-obligations-contract.md`](2026-09-16-workflow-obligations-contract.md)로 뺐다. 1단계 머지 뒤 델타 리뷰의 기준선이고, 여기 §12의 선행 조건 둘을 마친 뒤 그 문서로 2단계 계획 승인을 받는다.

### 7. 자동 검증

- **RED.** `tests/logic/WorkflowDiet.test.ts`를 먼저 써서 `ready-impl`의 RED 게이트를 지난다. W1의 판정 케이스, W2의 가짜 러너 케이스, W3의 분기, W5의 옛 상태 파일 픽스처 둘, `decideTransition` 단위, `pnpm` 심 E2E가 든다.
- **GREEN.** 이 브랜치의 새 `start-verification`이 통합 검사를 돌린다. 지금 47개 파일 861개 통과가 기준선이다(worktree에 `game/temp/tsconfig.cocos.json`을 복사해 둔 상태).
- **QA 문서 `docs/qa/workflow-diet-test.md`.** 이 슬라이스의 QA 문서는 아직 옛 틀(`qa-setup.md`)이 배달되는 시점에 쓰므로 옛 틀대로 씬·에디터 절을 「없다」로 채운다. 새 틀은 이 슬라이스가 만드는 것이고 다음 슬라이스부터 적용된다. 자동 검증 절에는 통합 검사 한 줄과 아래 손 확인을 적는다.
- **손 확인(사용자 검증 단계).** 이 브랜치에서 `pnpm wf status`가 `meta: 해당 없음 · full-typecheck: 해당 없음 · cso: 적용`을 보이는지. `pnpm wf pass ts`가 안내 후 실패하는지. `pnpm wf verify`가 검사마다 한 줄을 내는지. 원래 폴더의 3D 브랜치에서는 머지 뒤에 확인한다(§12).

### 8. 정본 개정 목록

| 정본 | 무엇을 |
|---|---|
| `workflow/verification.md` | 통합 검사 뒤의 검증 순서, 해당 없음 규칙, `verify` 재실행 |
| `workflow/qa-setup.md` | 씬·에디터 절 생략 조건 두 시점, 자동 검증 절 한 줄 규칙, `skip-qa` 규칙 |
| `workflow/implementation.md` | 나가는 게이트가 통합 검사임 |
| `workflow/README.md` | `verification` 행 |
| `CLAUDE.md` 「Workflow」 | 명령 표(`verify` 추가, `pass cso|review`), 9단계 뼈대 6번, `pnpm typecheck` 각주 |
| `backlog-docs.md`·`backlog-implement.md` | W7 |

`pnpm wf canon-done`으로 위 경로를 선언한다. 새 정본은 만들지 않는다.

### 9. 최종 PR에서 정리할 것

- `docs/etc/2026-09-16-workflow-diet-design-draft.md`와 이 초안(`...-plan-draft.md`)을 지운다. 내용은 `sessions/`의 계획 문서 셋이 이어받는다.
- `docs/temp/`는 git 미추적이라 PR에 들지 않는다. 진행 기록은 이 장비에만 남는다.
- 상태 파일은 관행대로 최종 상태를 커밋한다(D12).
- 신규 `.meta`는 0개여야 한다. 1개라도 생기면 `.meta` 게이트 「해당 없음」 판정이 틀린 것이다.

### 10. 구현 쟁점 — 이 리뷰가 닫는다

1. **`allowJs`의 부작용.** `tsconfig.tests.json`에 `allowJs`를 켜면 import를 따라 들어오는 `.mjs`가 타입 검사 대상이 된다. `.claude/lib/*.mjs`만 들어오는지, `typecheck.mjs`까지 끌려오는지, JSDoc 없는 함수가 `any`로 무너져 단언이 약해지는지. 대안은 `.d.mts`.
- 2. **biome의 부정 패턴 순서.** `includes: ["**", "!**/.claude", ...]`에 `.claude/lib/**`를 다시 넣는 것이 biome 2.4에서 허용되는지. 안 되면 `.claude/lib`를 다른 자리(`tools/wf-lib/`?)에 두는지, 제외를 `!**/.claude/hooks`·`!**/.claude/workflow.mjs`처럼 좁히는지.
3. **통합 검사의 출력 형식.** 실패 상세를 어디까지 찍나. vitest 실패는 수백 줄이 될 수 있다. 실패한 파일·테스트 이름과 첫 오류만 찍고 전문은 재현 명령을 안내하는 쪽으로.
4. **`start-verification`에서 biome 실패의 처리.** 포맷 불일치도 에러라 `pnpm check --write` 한 번 뒤 재시도가 흔하다. `start-verification` 실패 메시지가 그 명령을 안내한다. → T3 수용으로 포맷 차이는 `start-verification`·`verify`가 자동 적용한다. 남는 실패는 린트 위반뿐이다.
5. **`status`의 변경 집합 계산 비용.** `git diff`·`ls-files` 두 번이라 수십 ms다. 문제없지만 `status`가 git 없는 폴더에서도 죽지 않아야 한다(`measurable: false` 경로).
6. **`tests/**`를 `/cso` 경로에 넣은 효과.** 도구 슬라이스는 대개 테스트를 고치므로 `/cso`가 거의 늘 적용된다. 그래도 넣는 이유는 테스트가 프로세스를 띄우고 임시 파일을 쓰기 때문이다. 리뷰가 이 판단을 다시 봤다 → UC1로 `tests/logic/**`를 뺐다(§2).

### 11. 남은 질문

설계 §8의 셋이다. 도구 슬라이스의 QA 문서 자체를 생략할지(T1 `skip-qa`로 닫음), `allowJs` vs `.d.mts`(§10-1), 배달 문서 예산 상한 수치(2단계).

### 12. 통과 조건

- `tests/logic/WorkflowDiet.test.ts`가 RED에서 GREEN으로 갔고, 전체 스위트가 통합 검사 경로로 통과한다.
- 이 브랜치에서 `wf status`가 `meta`·`full-typecheck` 해당 없음, `cso` 적용을 보인다. `pass ts`·`pass lint`는 없다.
- `pass cso`가 `cso_paths`를 저장하고, `invalidate`가 CSO 경로 목록이 같으면 `cso_done`을 보존하고 다르면 비운다(테스트로 고정).
- `skip-qa`는 변경 집합에 `game/assets/**`가 있으면 거부한다(테스트로 고정). 이 슬라이스는 `game/**`를 안 건드리므로 `skip-qa`가 열려 있지만 쓰지 않는다 — §7대로 옛 틀의 QA 문서를 쓴다(손 확인 목록이 거기 든다).
- 첫 검증 회차에 AI가 치는 기계 검사 명령이 1회다(`start-verification`). 전체 vitest 자체는 `start-verification`과 `pass` 직전에 두 번, QA 게이트가 `DocsHygiene` 한 파일을 한 번 더 돌린다 — 줄이는 것은 명령 수(턴)이고 실행 수가 아니다.
- `tests/helpers/CanonDoc.ts`·`WorkflowSteps.ts`가 없고, `workflow.mjs`·테스트가 `.claude/lib/*.mjs`를 import한다. 훅은 import하지 않고 `EDITABLE_PHASES` 리터럴을 유지하며 테스트가 그것이 `phases.mjs`의 export와 같음을 단언한다. 판정 코드가 두 벌인 자리는 그 리터럴 하나(테스트가 지킨다)뿐이다.
- 옛 상태 파일 픽스처로 `status`·전이가 돈다.
- 의무 독서 예산 여유가 143자 이상이다.
- 신규 `.meta` 0개.
- 머지 뒤 원래 폴더의 3D 브랜치에서 main을 받고 `pnpm wf status`가 옛 `qa-setup` 상태를 읽는다. 그때 `.claude/workflow-state.json` 충돌은 `git merge main`이면 `git checkout --ours -- .claude/workflow-state.json`(3D 브랜치 쪽 유지), rebase면 `--theirs`로 풀고 `pnpm wf status`가 `feature: blender-3d-gate`, `phase: qa-setup`을 보이는지 확인한다. 틀리게 고르면 진행 중 슬라이스가 조용히 `done`이 되고 `wf start`로는 복구가 안 된다. 이것이 2단계 계획 승인의 선행 조건 하나다.
- `verify`는 전이하지 않고 `pass`만 전이하며, `pass review`가 전이 직전 통합 검사에서 실패하면 전이하지 않는다(`decideTransition` 단위 + `pnpm` 심 E2E로 고정).
- `start-verification`의 검사 출력 부분이 성공 시 요약 세 줄 + 게이트 표이고(첫 진입의 `verification.md` 배달은 그 뒤에 붙는다), 실패 시 실패 검사의 상세가 40줄을 넘지 않는다. 이 슬라이스의 실제 로그로 확인한다.
- `.claude/lib/*.mjs` 전부에 `// @ts-check`가 있고 `pnpm typecheck`가 초록이다. `tsconfig.tests.json`의 `include`가 `.claude/lib/**/*.mjs`를 들어 import 여부와 무관하게 전부 검사된다.
- 이 브랜치의 루트에서 `wf status`가 「기준을 못 잼」이 아니라 게이트 표를 보인다(Windows 경로 정규화의 실증).
- 머지 뒤 다음 슬라이스(종류 무관, 가능하면 게임 슬라이스 하나 포함)를 `tools/wf-measure`로 재서 확인한다: 검증 회차당 기계 검사 명령 1회, `invalidate` 뒤 `/cso` 재실행 0회(CSO 경로 변경이 없을 때), `check-links` 단독 실행 슬라이스당 2회 이하. 이것이 2단계 계획 승인의 다른 선행 조건이다.

---
