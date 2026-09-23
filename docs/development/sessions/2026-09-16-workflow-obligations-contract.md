# 워크플로우 다이어트 2단계 설계 계약 — `workflow-obligations`

- **작성일:** 2026-09-16 (계획 승인 게이트 2026-09-17)
- **브랜치:** `feat/workflow-diet` · worktree `F:\work\monster-wf`
- **상태:** 계획 — `/autoplan` 리뷰 완료·최종 게이트 승인(2026-09-17). 다음은 사용자 `계획 승인` → `pnpm wf approve-plan`
- **정본:** 없음 — 2단계 슬라이스를 열 때 계획과 정본을 정한다. 이 문서는 1단계 머지 뒤 델타 리뷰의 기준선이다
- **개요:** [`2026-09-16-workflow-diet-plan.md`](2026-09-16-workflow-diet-plan.md) — 목표·결정·제약·통과 조건과 절 번호(§n)는 그 문서의 것이다
- **읽는 법:** 1단계 실증에서 여기 적힌 것과 다른 사실이 나오면 이 문서를 고치지 않고 덧붙임(addendum) 절을 아래에 더한다. 달라진 것이 없으면 이 문서로 바로 2단계 계획 승인을 받는다(D10). 선행 조건 둘(3D 브랜치가 main을 받은 뒤 `wf status`가 옛 상태를 읽는다 · 다음 슬라이스의 재측정)은 개요 §12에 있다

---

### 6. 2단계 설계 계약 — `workflow-obligations`

1단계는 기록에 지문이 없어 `verify` 뒤 파일을 고친 것을 기록으로는 잡지 못한다. 다만 `pass`가 전이 직전에 통합 검사를 다시 돌리므로 타입·린트·테스트는 항상 현재 코드 기준이다. 리뷰·`/cso`·정본·QA 판단의 낡음은 2단계 지문이 닫는다.

이 절은 1단계 머지 뒤 델타 리뷰의 기준선이다. 여기 적힌 것과 다른 사실이 1단계 실증에서 나오면 덧붙임을 쓴다.

- **게이트 표 `.claude/lib/obligations.mjs`.** W1의 상수를 이 표로 승격한다. 늘 적용되고 정의역이 변경 집합 전체인 게이트 다섯: 통합 검사, `/cso`(적용 경로에 걸릴 때, 정의역은 그 경로 안 변경), 코드 리뷰, 정본 판단, QA 확정. 경로 게이트: `.meta`·QA 씬 절(`game/assets/**`), `full` 타입체크(`game/**` + 의존성).
- **지문.** 「변경 집합 ∩ 적용 경로」 항목들의 정규형(status·path·mode·blob, 삭제는 merge-base object id)을 정렬해 이어 해시. `git hash-object --stdin-paths`. 집합이 비면 해당 없음. 상태 파일은 집합 밖이라 저장이 지문을 바꾸지 않는다.
- **통과 기록과 판정.** `verification.<flag>: false | "<지문>"`. `assertCurrentObligations(state)`가 「게이트마다 해당 없음이거나 기록 지문 == 현재 지문」을 재고, `pass`·`verify`(→ `user-verification`)와 `approve-pr`(→ `pr-ready`)에서 부른다. `invalidate`는 낡은 게이트를 보여 주는 명령. 옛 `true`는 낡음. `resetVerification`의 정본·QA 초기화 역할은 지문이 대신한다.
- **`scope:`.** 개요 계획 문서 머리말 한 줄, 어휘 `docs`·`tooling`·`game`의 집합, 모르면 전체. `approve-plan`이 상태에 기록하고 리뷰 구성을 출력(`docs`→DX, `tooling`→엔지니어링+DX, `game`→넷, 여럿→합집합). `planDocPath`는 전체 매치를 훑어 `scope:`가 둘 이상이면 막는다. 범위 이탈은 자동 승격 + `status` 표시.
- **장부.** `.claude/wf-audit.jsonl`(gitignore) 한 줄/판정, `wf audit`는 게이트별 실행·차단 수.
- **절차 문서 재작성 + 배달 문서 예산(F95).** 13,575자 → 10,000자 이하 목표, 상한은 실측 뒤.
- **ADR.** 통과 기록 모델(플래그 → 지문)은 ADR 004를 대체하는 새 ADR로 남긴다. 번호는 그때 두 브랜치를 보고 정한다.
