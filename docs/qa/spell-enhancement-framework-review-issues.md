# 코드 리뷰 이슈 — per-spell/분류 강화 프레임워크

> **리뷰 커밋:** `b4efd1c` (최초 리뷰 `01d0f0d`, base `6bbcc3b`)
> **리뷰어:** general-purpose subagent (superpowers:requesting-code-review 패턴)
> **결과:** BLOCKER/HIGH 0건. MEDIUM 1 + LOW 2(코드 품질·로버스트니스 → 즉시 수정) + 게임정책 2(note only). 재리뷰(`b4efd1c`) CLEAN — 신규 이슈 0.

---

## 코드 품질·타입 안전성·실제 버그 (즉시 수정)

### #1 [MEDIUM · test-gap] 쿨다운 나눗셈 방향 + 하한이 테스트로 검증되지 않음 — **수정됨**
`SpellCaster.update`의 `spell.cooldown / cooldownFactor` + 0.05s 하한이 이 피처의 핵심 불변(배율↑=간격↓)인데, Cocos 결합부라 vitest 미도달. `/`를 `*`로 뒤집어도 테스트가 통과해버림.
**수정:** 순수 헬퍼 `EnhancementLogic.effectiveCooldown(spell, baseCooldown) = max(base / cooldownFactor, MIN_COOLDOWN_SEC)`로 추출(하한 상수도 logic 레이어로 이동). `SpellCaster`/`DeckManager`는 위임만. 단위 테스트 추가(나눗셈 방향 + 하한).

### #2 [LOW · robustness] 전역 보너스 ≤ -1이면 factor 0/음수 → div-by-zero/음수 쿨다운 — **수정됨**
`factor = indiv × cat × (1 + globalBonus)`, `addGlobal`은 임의 값 허용. 구버전의 `MIN_COOLDOWN_MULT` 하한이 리팩터로 사라짐. 현재 데이터는 +0.05라 미발현이나 방어 필요.
**수정:** `factor()`에서 전역 배율을 `Math.max(MIN_GLOBAL_MULT, 1 + bonus)`로 클램프(0/음수 차단). 단위 테스트 추가.

### #3 [LOW · type-safety] `applyCard`의 upgrade early-return이 동거 effect를 드롭 — **수정됨**
`ICardEffect`는 `upgrade?`/`maxHpBonus?` 등 독립 옵셔널 혼용 허용. 현재 upgrade 카드는 upgrade만 갖지만, early-return 구조라 향후 혼합 시 HP가 조용히 누락.
**수정:** early-return 제거, 각 독립 effect를 순차 if로 적용(upgrade→raise, 전역→addGlobal, 나머지→DeckLogic).

---

## 게임 정책·설계 (note only — 사용자 요청 시에만 수정)

### #4 [NIT] 전역 트랙은 cap 없음 — 위계는 레벨1 픽 단위 보장, 점근적으로는 비보장
개별/분류 곡선은 cap 4, `addGlobal`은 무한 누적. "개별>분류>전역" 위계는 1.3>1.2>1.05(1픽 기준) 검증되나 전역 카드 다수 누적 시 분류 곡선 초과 가능. 설계 §10 밸런싱 TBD라 의도적. 밸런싱 단계에서 전역 cap 검토.

### #5 곡선·전역 수치는 placeholder (§10) — 조치 없음
`INDIVIDUAL_CURVE`/`CATEGORY_CURVE`/±5% 전역은 JSDoc·설계 doc에 임시값 명시. 밸런싱 단계 확정.

---

## 재리뷰 (`b4efd1c`)

#1·#2·#3 수정 커밋(`b4efd1c`) 집중 재리뷰 — **CLEAN, 신규 이슈 0**.
- 쿨다운 추출: 나눗셈 방향·0.05s 하한 동작 동일, `MIN_COOLDOWN_SEC` logic 이관, dangling `cooldownFactor` 참조 없음.
- 전역 클램프: +0.05 정상 보너스는 1.05로 미클램프(위계 유지), bonus ≤ -0.95에서만 발동.
- `applyCard`: DeckLogic이 maxHpBonus만 처리하므로 무조건 위임해도 이중 적용 없음.
- 신규 테스트 4종 비-tautological(방향·하한·음수 전역 방어 실검증). 전체 85/85 GREEN.
