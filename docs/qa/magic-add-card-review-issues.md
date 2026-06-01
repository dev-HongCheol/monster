# 코드 리뷰: magic-add-card

> **리뷰 커밋:** `dcfbde9` (BASE `20d0876` origin/main)
> **작성일:** 2026-06-02
> **방식:** superpowers:requesting-code-review 패턴 — general-purpose subagent dispatch
> **관련 플랜:** [2026-06-02-magic-add-card-plan](../development/sessions/2026-06-02-magic-add-card-plan.md)

---

## 결과 요약

**Must-fix 0건.** 정확성 버그·타입 안전성 구멍·품질 회귀 없음.

### 점검 항목별 결과

| 항목 | 결과 |
|---|---|
| `buildDrawPool` 정확성 (합성/미보유 필터/풀 제외/원본 불변) | ✅ 이상 없음. 테스트 5종이 각 축 커버 |
| 싱글톤 라이프사이클 (`SpellCaster.instance`) | ✅ 기존 5개 매니저와 동일 패턴(`!:` 선언 + `=== this` 가드 정리) |
| `drawCards` 시그니처 변경 | ✅ 유일 호출처(CardSelectPanel) 갱신, JSDoc 갱신 |
| magic 분기 (`type==='magic' && spellId`) | ✅ spellId 누락 시 안전 폴백(`effect:{}`라 applyCard no-op). 싱글톤 옵셔널 체이닝 가드 |
| 네이밍 리네임 일관성 | ✅ `game/assets/scripts/`에 WaveClear/setWaveClear/startNextWave 잔존 0건. 동작 동일(가드·HP 보너스 유지) |
| 타입 안전성 (union + optional spellId) | ✅ 합성 리터럴 컨텍스트 타이핑으로 narrowing, 옵셔널 접근 가드됨 |
| 중복/풀 staleness | ✅ `_drawnCards`가 onEnable마다 갱신 + 1회 픽이라 노출 불가. 설령 발생해도 `addSpell`이 false 반환(무손상) |
| 컨벤션·기존 주석 보존 | ✅ 기존 JSDoc/주석 삭제 없음, 금지된 `!` 미도입 |
| 데드 코드 / 웨이브 타이머 관찰 | ✅ 데드 코드 없음. 타이머 리셋은 의도적 미변경(magic-followups에 기록) |

---

## 게임 정책 / 설계 관찰 (수정 불요 — 사용자 요청 시에만)

1. **마법 카드 가중치(밸런싱 레버):** 합성 magic 카드가 base 카드와 평면 풀에서 균등 무작위로 추첨된다. 마법 종수가 늘수록 특정 base 강화 카드의 추첨 확률이 낮아진다. 버그 아님 — `spells.json`/`cards.json` 확장 시 인지할 밸런스 레버. (기획 § 6.2 가중치 추첨은 이미 범위 밖)
2. **레벨업 재개 시 웨이브 타이머 풀 리셋:** 의도적으로 이번 슬라이스 범위 밖. [magic-followups](../development/sessions/2026-06-01-magic-followups.md) § 2에 관찰 기록됨(웨이브 난이도 곡선 설계 시 재검토).

> 추가 로버스트니스 메모(버그 아님): `_onPickCard`가 `addSpell`의 boolean 반환을 버린다. 현재 1회 픽 흐름에선 무해하나, 향후 다중 픽 패널이 생기면 거부된 추가가 레벨업 픽을 소모할 수 있으니 그때 재검토.
