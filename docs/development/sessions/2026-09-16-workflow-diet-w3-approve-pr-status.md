# 워크플로우 다이어트 W3 — `approve-pr`·`status`·`check-meta`

- **작성일:** 2026-09-16 (계획 승인 게이트 2026-09-17)
- **브랜치:** `feat/workflow-diet` · worktree `F:\work\monster-wf`
- **상태:** 계획 — `/autoplan` 리뷰 완료·최종 게이트 승인(2026-09-17). 다음은 사용자 `계획 승인` → `pnpm wf approve-plan`
- **정본:** [`workflow/verification.md`](../workflow/verification.md) — `status` 출력 예시가 그리로 간다. `approve-pr` 판정은 `.claude/lib/change-set.mjs`의 `approvePrDecision` JSDoc이 든다
- **개요:** [`2026-09-16-workflow-diet-plan.md`](2026-09-16-workflow-diet-plan.md) — 목표·결정·제약·통과 조건과 절 번호(§n)는 그 문서의 것이다

---

#### W3. `approve-pr`·`status`·`check-meta`

- `approve-pr`: 판정을 순수 함수 `approvePrDecision({gates, tsScope, tsStatus, missingMeta}) → {ok, reasons}`로 `.claude/lib/change-set.mjs`에 둔다. `meta`가 거짓이면 `.meta` 검사를 건너뛰고 「해당 없음」을 찍는다. `fullTypecheck`가 거짓이면 `ts_check_scope`가 `logic-only`여도 통과한다. 둘 다 참일 때 동작은 지금과 같다. CLI는 게이트 표를 타입체크보다 먼저 출력한다. 게이트 키는 `meta`·`fullTypecheck`·`cso`(camelCase)로 통일하고 `status` 라벨은 `full-typecheck`로 찍어도 된다.
- `check-meta`(단독 진단): 늘 검사한다. 사용자가 명시적으로 부른 것이라 침묵하지 않는다.
- `status`: 상태 JSON 아래에 이번 변경 집합 기준의 적용 게이트를 한 줄씩 찍는다(`meta: 해당 없음(game/assets/** 변경 없음)` 형식, 해당 없음에는 어느 경로가 변경 집합에 없는지 이유를 함께). merge-base SHA와 변경 집합 항목 수도 찍는다. 변경 집합을 못 재면 「기준을 못 재 모든 게이트 적용」과 원인별 처방을 찍는다. 읽기 전용은 유지한다. `start-verification` 성공 출력에도 같은 게이트 표를 찍어 `status`를 한 턴 더 치지 않게 한다. 알 수 없는 명령은 「알 수 없는 명령: X」 뒤 `commands:` 목록을 찍는다.
- 테스트: `approvePrDecision`과 `applicableGates`를 단위로 본다(`game/assets/x.png`가 있을 때와 없을 때의 분기). CLI E2E는 `approve-pr`이 실제 tsc를 띄우므로 stdout 앞부분(게이트 표)만 단언하고, `status` 출력은 그대로 단언한다.
