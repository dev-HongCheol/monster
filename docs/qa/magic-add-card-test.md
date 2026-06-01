# QA: magic-add-card (마법 추가 카드 배선)

> **브랜치:** feat/magic-add-card
> **작성일:** 2026-06-02
> **관련 기획:** [마법 시스템 — 마법사](../planning/magic-system-mage.md) § 6 (덱 시스템)
> **관련 플랜:** [2026-06-02-magic-add-card-plan](../development/sessions/2026-06-02-magic-add-card-plan.md)
> **성격:** 순수 로직(드로우 풀 합성) + 런타임 배선(카드 픽 → addSpell). **씬/프리팹 에디터 작업 없음.**

---

## 0. 범위

- `data/GameTypes.ts`: `ICardData.type`에 `'magic'` 추가, `spellId?` 추가. `GameState.WaveClear` → `LevelUp` 리네임 (수정)
- `logic/DeckLogic.ts`: `buildDrawPool` 추가 — base 카드 + 미보유 마법 합성 카드 (수정, 순수)
- `systems/DataManager.ts`: `get spells()` 게터 추가 (수정)
- `systems/DeckManager.ts`: `drawCards`가 `buildDrawPool` 경유 (수정)
- `components/SpellCaster.ts`: `static instance` + `addSpell` 공개 (수정)
- `ui/CardSelectPanel.ts`: 픽 시 magic 카드 분기 → `addSpell` (수정)
- `systems/GameManager.ts`: `setWaveClear`→`enterLevelUp`, `startNextWave`→`resumeFromLevelUp` 리네임 (수정)
- `ui/HudController.ts`: `GameState.WaveClear` 참조 → `LevelUp` (수정)
- `tests/logic/MagicAddCard.test.ts`: `buildDrawPool` 단위 테스트 (신규)

범위 밖(후속 슬라이스): 빈손 시작·시작 카드 패널(§ 5), 개별/분류 강화 엔진, 카드 가중치 추첨·4장화(§ 6.2), 16종 전체 카탈로그, 마법별 전용 비주얼, 웨이브 타이머 리셋 행동 변경.

---

## 1. Impact Map

| 변경 파일 | 변경 내용 | 회귀 확인 범위 |
|---|---|---|
| `data/GameTypes.ts` | `ICardData.type` 유니온 확장 + `spellId?`. `GameState.WaveClear`→`LevelUp` | enum 리네임이 모든 참조처(`GameManager`/`HudController`)에 일관 적용. 카드 픽·레벨업 일시정지 흐름 동일 |
| `logic/DeckLogic.ts` | `buildDrawPool` 신규. 기존 `drawCards`/`applyCard` 불변 | 신규 — 단위 테스트로 전부 커버 |
| `systems/DataManager.ts` | `get spells()` 게터 추가 | 기존 `getSpell`/`cards` 등 영향 없음 |
| `systems/DeckManager.ts` | `drawCards(n)`이 `buildDrawPool`로 풀 합성 후 추출 | **강화/패시브 카드만 있던 기존 드로우 동작 유지** + magic 카드 추가 등장 |
| `components/SpellCaster.ts` | `static instance`/`onDestroy` 정리, `addSpell(id)` 공개 | 기존 발사·시드 동작 불변. 싱글톤 정리 시 null 처리 |
| `ui/CardSelectPanel.ts` | 픽 시 `type==='magic'` 분기, 호출명 `resumeFromLevelUp` | 강화/패시브 카드 픽 → 기존대로 `applyCard` |
| `systems/GameManager.ts` | 메서드 2개 리네임 (행동 동일) | 레벨업 일시정지·재개·HP 보너스 적용 동일 |
| `ui/HudController.ts` | 상태 비교 enum명 변경 | 레벨업 시 카드 패널 활성/비활성 토글 동일 |

---

## 2. 씬/프리팹 변경 사항

**없음.** `SpellCaster.instance`는 코드 내부 싱글톤이므로 에디터 연결이 필요 없다. 신규 노드·프리팹·`@property` 추가 없음.

> 단, 직전 슬라이스에서 `SpellCaster.startingSpellIds`가 비어 있으면 빈손 시작이 되어 검증이 어렵다. **`startingSpellIds`에 최소 1종(예: `["fireball"]`)이 들어 있어야** 한다(기존 세팅 유지).

## 3. 에디터 연결 체크리스트

이번 슬라이스에서 신규 연결 작업 없음. 직전 세팅이 유지되는지만 확인.

| 컴포넌트 | 프로퍼티 | 상태 |
|---|---|---|
| `SpellCaster` | `bulletPrefab` / `bulletParent` (기존 연결 유지) | ✅ (직전 슬라이스에서 설정됨) |
| `SpellCaster` | `startingSpellIds` (최소 1종) | ✅ (기존 유지) |

---

## 4. 자동 테스트로 검증 (MagicAddCard.test.ts)

`buildDrawPool`의 미보유 필터·슬롯 풀 제외·magic 카드 합성 규칙은 단위 테스트로 전부 커버한다. 사용자 수동 작업 불필요.

검증 동작 (플랜 § 4·§ 6 근거) — **`MagicAddCard.test.ts` 5/5 통과, 전체 스위트 46/46 통과 (통과 커밋 `fe427a0`):**

- [x] base 카드(강화/패시브)는 항상 풀에 포함
- [x] 미보유 마법은 `type==='magic'`·`spellId` 일치·`id==='add_'+spellId` 규칙으로 합성
- [x] 이미 보유한 마법(`ownedSpellIds`)은 합성 제외
- [x] `isFull === true` → magic 카드 0개, base 카드만 반환
- [x] 모든 마법 보유 시 → base 카드만 반환

## 5. 수동 테스트 체크리스트 (인게임)

코드로 검증 불가한 런타임 동작만 포함한다.

- [ ] 레벨업(적 처치로 XP 채움) 시 카드 패널에 **"마법 추가" 카드(미보유 마법 이름)** 가 강화/패시브 카드와 섞여 등장할 수 있다
- [ ] "마법 추가" 카드를 고르면 **해당 마법이 즉시 자동 발사 대열에 합류**한다(새 분류 색 발사체가 추가로 날아감)
- [ ] 이미 보유한 마법은 "마법 추가" 카드로 다시 등장하지 않는다
- [ ] 강화/패시브 카드를 고르면 기존과 동일하게 적용된다(회귀 — damageMult/cooldownMult/maxHpBonus)
- [ ] 카드 선택 후 게임이 정상 재개되고 웨이브/HP/이동이 기존과 동일하게 동작한다(레벨업 일시정지→재개 회귀)
- [ ] (참고) 마법 3종을 모두 보유하면 더 이상 "마법 추가" 카드가 나오지 않고 강화/패시브만 나온다
