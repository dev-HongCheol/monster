# 코드 리뷰 이슈: magic-loadout-core

> **리뷰 커밋:** d2d3ff92b861856b39f370517a7c108e833c5f63 (base 3454c81)
> **리뷰 방식:** general-purpose 서브에이전트 (superpowers:requesting-code-review 패턴)
> **결과:** CRITICAL/must-fix 코드·타입·버그 이슈 **없음**. 사소 항목 2건.

---

## 1. 테스트 파일명 ↔ 클래스명·QA 문서 불일치 (nitpick) — **수정됨**

- **지적:** `tests/logic/MagicLoadoutCore.test.ts`가 검증 대상 클래스(`LoadoutLogic`) 및 형제 테스트 컨벤션(`DeckLogic.test.ts`, `ExperienceLogic.test.ts` = `<Class>.test.ts`)과 불일치. QA 문서는 `LoadoutLogic.test.ts`로 적혀 있어 실제 파일명과도 충돌.
- **결정:** 파일명은 워크플로우 CLI(`.claude/workflow.mjs` `expectedTest()`)가 **피처명 PascalCase**(`MagicLoadoutCore.test.ts`)를 ready-impl 게이트에서 강제하므로 유지한다. 형제 테스트(클래스명 기반)와의 차이는 워크플로우 게이트 도입(#11) 이후의 의도된 분기다.
- **조치:** QA 문서(`magic-loadout-core-test.md`)의 잘못된 파일명 참조 2곳을 실제 파일명(`MagicLoadoutCore.test.ts`)으로 수정. **수정됨.**

## 2. SpellTier/SpellCategory가 JSON 로드 경계에서 미검증 (note only — 기존 이슈)

- **지적:** `DataManager._load`가 `asset.json as T` 무검증 캐스트라 `spells.json`에 `"tier": 5`나 오타 `"categry"`가 있어도 컴파일·로드가 통과한다. `SpellTier`(1~4)·`SpellCategory` enum이 런타임에서 강제되지 않아 정적 타입이 주는 안전감이 실제 로더에는 없음.
- **범위:** 이번 PR 이전부터 존재하는 패턴(모든 JSON 데이터 공통). 이번 변경과 무관.
- **결정:** CLAUDE.md 규칙(무관·기존 이슈는 즉시 수정하지 말고 언급만)에 따라 **기록만 한다.** 향후 데이터 검증(스키마/런타임 가드) 슬라이스에서 다룰 후보.

---

## 기타 (선택, 미조치)

- `addSpell('')` 빈 문자열 id, fresh-empty 상태에서의 `removeSpell` 등 추가 엣지 케이스 테스트 — 선택 사항. 현재 7개 설계 규칙은 모두 커버됨.
- `spells` getter의 삽입 순서 보장은 설계 규칙이 아니므로 미검증(의도).
