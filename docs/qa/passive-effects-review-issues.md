# 코드 리뷰 이슈: 덱 패시브 효과 (passive-effects)

> - **브랜치:** feat/passive-effects
> - **리뷰 커밋:** `8f426ed` (base `55d1b3f`)
> - **리뷰 방식:** `superpowers:requesting-code-review` 패턴 — general-purpose subagent dispatch
> - **판정:** Ready to merge — With fixes (minor). Critical/Important 코드 버그 없음.

리뷰어가 §3.1–§3.6 계획과 대조해 검토. 순수/cc 분리, 1회 바인딩 라이브 getter 주입, 풀 재사용 재주입,
DEV 게이팅(릴리스 무영향), 전체 스위트 133/133 GREEN(HP 회귀 없음)을 모두 확인. 기능 버그 0건.

---

## Critical
없음.

## Important

### 1. `HIDE_CATEGORY_UPGRADE_CARDS = true`가 main에 머지되어 모든 개발자의 에디터/프리뷰에서 분류 강화 카드가 무기한 숨겨짐
- **위치:** `game/assets/scripts/systems/DeckManager.ts:16,84`
- **지적:** 릴리스 영향은 0(DEV 게이팅 정상)이고 임시임이 주석에 명시돼 있으나, main에 올라가면 다음 슬라이스 수동 QA에서 "왜 분류 카드가 안 뜨지?" 혼란을 줄 수 있다. 코드 주석 외에 복원을 보장할 추적 장치가 없다.
- **분류:** **프로세스/정책** (리뷰어 본인이 "This is process, not code"로 명시) → 워크플로우상 즉시 수정 대상이 아니라 **기록 후 진행**.
- **처리:** **기록됨 (정책).** 계획 문서(2026-06-09-passive-effects-plan.md §3.6)가 이미 "후속 편집 가능 단계에서 `false` 복원"을 명시. 현재 단계는 스크립트 잠금(user-verification 진입)으로 사전 복원 불가. 다음 슬라이스 계획에 복원 작업을 명시적 추적 항목으로 잇도록 사용자에게 보고. 코드 변경 아님 → `wf invalidate` 불필요.

## Minor

### 2. QA 문서 GREEN 근거가 SHA 대신 "본 피처 구현 커밋"으로 모호
- **위치:** `docs/qa/passive-effects-test.md:48`
- **지적:** GREEN-step 규칙은 통과 커밋 SHA 기재를 요구. 133/133 주장 자체는 정확(로컬 검증).
- **처리:** **수정됨** — 실제 SHA `8f426ed`로 갱신.

### 3. `XPItemController.update`의 프레임당 비용 소폭 증가
- **위치:** `game/assets/scripts/components/XPItemController.ts:53`
- **지적:** 캐시 필드 읽기 → 함수 호출 + 싱글톤 프로퍼티 체인 2회 + 산술로 변경. 예상 XP 개수에서 무시 가능.
- **처리:** **조치 없음 (의도된 트레이드오프).** 라이브 요구사항을 위한 정상 비용. 스냅샷으로 되돌리면 라이브가 깨지므로 "최적화"하지 않는다(리뷰어도 동일 의견).

### 4. i18n 포맷 비대칭 (기존 이슈, 본 PR 도입 아님)
- **위치:** `en.json`(flat string) vs `ko.json`(`{message,desc}` 객체)
- **지적:** 신규 키는 각 파일의 기존 컨벤션을 정확히 따라 PR 내부적으로 일관됨. 신규 결함 아님.
- **처리:** **조치 없음.** 본 슬라이스 범위 밖(선행 i18n 작업 영역).

---

## 결론
코드 수정 필요 항목 0건(코드 품질·타입·버그 없음). Minor 문서 정확성 1건만 수정(#2). #1은 정책으로 기록 후
사용자 보고. → `pnpm wf pass review` 진행.
