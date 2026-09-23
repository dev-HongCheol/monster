# 워크플로우 다이어트 W6 — 절차 문서·`CLAUDE.md`·QA 문서 틀·ADR 010

- **작성일:** 2026-09-16 (계획 승인 게이트 2026-09-17)
- **브랜치:** `feat/workflow-diet` · worktree `F:\work\monster-wf`
- **상태:** 계획 — `/autoplan` 리뷰 완료·최종 게이트 승인(2026-09-17). 다음은 사용자 `계획 승인` → `pnpm wf approve-plan`
- **정본:** [`workflow/verification.md`](../workflow/verification.md) · [`workflow/qa-setup.md`](../workflow/qa-setup.md) · [`workflow/implementation.md`](../workflow/implementation.md) · [`workflow/README.md`](../workflow/README.md) · [`CLAUDE.md`](../../../CLAUDE.md) 「Workflow」 절 — 이 묶음이 고치는 정본 전부다
- **개요:** [`2026-09-16-workflow-diet-plan.md`](2026-09-16-workflow-diet-plan.md) — 목표·결정·제약·통과 조건과 절 번호(§n)는 그 문서의 것이다

---

#### W6. 절차 문서·`CLAUDE.md`·QA 문서 틀

- `workflow/verification.md`: 「게이트 1 보안 → 2 타입 → 3 린트 → 커밋 → 4 리뷰」 구조를 「`start-verification`이 통합 검사를 이미 돌렸다 → (`/cso`, 적용될 때) → 커밋 → 리뷰 → `pass review` → 코드를 고쳤으면 `wf verify`」로 다시 쓴다. 해당 없음 규칙과 `wf status`로 확인하는 법을 적는다. 「`cso` 적용」과 「`cso` 해당 없음」 두 갈래의 복붙 가능한 명령 블록과 `status` 출력 예시(`meta: 해당 없음(game/assets/** 변경 없음)` 형식의 실제 줄)를 둔다. `verify`와 `invalidate`의 선택 규칙 한 문장(W2)을 둔다. `wf verify`의 역할(전이 없이 결과 확인)과 `pass`가 스스로 검사한다는 점을 적어 `invalidate` 뒤 `verify`를 의무처럼 치지 않게 한다. 「새 문서(ADR·계획 문서·QA 문서)는 `git add` 뒤에 검사한다 — 링크 검사가 대상 존재를 `git ls-files`로 재므로 미추적 새 문서로 가는 링크는 깨진 것으로 잡힌다」 한 문장을 둔다.
- `docs/development/troubleshooting/typescript-version-pin.md` 22행의 `pnpm wf pass ts` 언급을 `pnpm wf verify`로 고친다.
- ADR 010 「게이트를 적용 범위로 재고 기계 검사를 한 경로로 모은다」를 쓴다. ADR 004의 명령 표(`pass <cso|ts|lint|review>`)와 `invalidate` 서술을 무엇으로 뒤집었는지 적는다(CLAUDE.md 규칙: 결정이 뒤집히면 새 ADR). 번호는 3D 브랜치가 쓴 009 다음이다. `CLAUDE.md` ADR 목록에 한 줄을 더한다(예산 표에 포함).
- `workflow/qa-setup.md`: 씬·프리팹·에디터 절의 생략 조건 두 시점, 자동 검증 절에는 통합 검사 한 줄만 적는다는 규칙. `game/assets/**`를 건드리지 않는 슬라이스는 `pnpm wf skip-qa "<사유>"`로 QA 문서 자체를 생략할 수 있다는 규칙(T1)과, 그때도 사용자 검증 단계의 손 확인은 계획 문서에 적는다는 조건.
- `workflow/README.md` 표의 `verification` 행(「보안·타입·린트·커밋·코드 리뷰 / pass 4종」)을 새 게이트로 고친다.
- `workflow/implementation.md`의 나가는 게이트 설명(`start-verification`이 전체 스위트 GREEN을 확인) → 통합 검사로.
- `CLAUDE.md` 「Workflow」 절: 명령 표에 `verify` 행을 넣고 `pass` 행을 `cso|review`로 줄이고 `pass ts` 각주를 `verify` 설명에 합친다. `check-links` 행에 「문서를 옮기거나 새로 쓸 때만」을 단다(실측 1위 137회의 지렛대 절반). 9단계 뼈대 6번 줄을 `→ (/cso → pass cso) → 커밋 → 코드리뷰 → pass review · 코드 수정 시 wf verify`로 줄인다. 의무 독서 예산 테스트가 초록이어야 하므로 자수 델타를 구현 전에 재고 적는다. 뺄 것: `pnpm typecheck` 각주 전체(약 150자, `verify` 행 설명에 합침), `pass` 행의 괄호 설명 축약(약 60자), 9단계 6번 줄 축약(약 40자). 더할 것: `verify` 행(약 120자), `skip-qa` 행(약 90자, T1), `check-links` 각주(약 15자), `pnpm verify:ci`(기록 없음)와 `wf verify`(기록)의 관계 한 줄(약 60자), ADR 010 목록 한 줄(약 70자). 위 합계는 빼기 약 250자 / 더하기 약 265자로 **+15자**다. 구현 전에 실측해 이 표를 갱신하고, 부족분은 명령 표의 `check-meta`·`check-qa`·`check-docs` 행 설명을 줄여 채워 순변화 ≤ 0(§12의 여유 143자 유지)으로 맞춘다.
- `docs/development/spec/docs-references.md` §12 표의 `wf check-links` 두 행은 검사기 위치를 말하는 것이라 그대로 둔다. `ops-skill-routing.md`에는 `pass ts` 언급이 없다(확인 2026-09-17).
- `docs/development/troubleshooting/workflow-state-cross-machine.md`에 3D 브랜치 충돌 레시피 한 줄을 더한다(§12와 같은 문장).
