# QA 체크리스트: 덱 패시브 효과 — 이동속도·픽업범위 (passive-effects)

> - **브랜치:** feat/passive-effects
> - **계획:** [2026-06-09-passive-effects-plan.md](../development/sessions/2026-06-09-passive-effects-plan.md)
> - **선행:** 마법 강화 프레임워크(`EnhancementLogic`)·카드 뽑기 UI(`CardSelectPanel`)·객체 풀링(적·XP)이 모두 머지됨.
> - **테스트 코드:** `tests/logic/PassiveEffects.test.ts` (DeckLogic 누적 — 순수 로직). cc 배선은 아래 수동 체크리스트로 검증.

레벨업 카드의 패시브 중 현재 HP만 작동하는 상태에서 **이동속도(+10%)·픽업범위(+30%)** 를 배선하고 각 카드 1장씩 추가한다. 두 효과 모두 카드를 뽑는 **즉시(라이브)** 반영된다. 신규 에디터 노드는 없고, 변경은 데이터·로직·기존 컴포넌트 배선에 한정된다.

---

## 1. Impact Map (변경 파일별 회귀 확인 범위)

| 파일 | 변경 | 회귀로 반드시 확인할 동작 |
|------|------|--------------------------|
| `logic/DeckLogic.ts` | 이동속도·픽업 누적 필드/getter + `applyCard` 가산 | HP 누적 회귀 없음(기존 `maxHpBonus`) |
| `systems/DeckManager.ts` | getter 위임 2개 + (DEV) 분류 강화 카드 필터 | 기존 강화 라우팅·개별/마법추가 카드 노출 무영향 |
| `data/GameTypes.ts` | `ICardEffect`+2, `IPlayerBaseData`+1 | 타입 컴파일 |
| `data/player.json` | `pickupRadius: 50` 추가 | DataManager 로드(누락 시 픽업 0) |
| `components/PlayerController.ts` | `_move` 속도에 보너스 곱 | 기본 이동(보너스 0)이 기존과 동일 속도 |
| `systems/ExperienceManager.ts` | 픽업 반경 getter 1회 바인딩 + `init` 인자 변경 | XP 스폰/흡수 회귀 없음 |
| `components/XPItemController.ts` | `init`에 `getPickupRadius` 주입, `update` 라이브 판정 | 풀 재사용 시 getter 재주입(잔류 반경 없음) |
| `data/cards.json` | 패시브 카드 2장(`move_speed_up`·`pickup_range_up`) | 드로우 풀 합성 |
| `resources/i18n/{ko,en}.json` | 카드 4키(name/desc × 2) | 카드 표시(키 미해석 시 raw 키 노출) |
| `ui/CardSelectPanel.ts` | `_logEnhancementDebug`에 `[패시브]` 한 줄(DEV) | 기존 강화 로그 회귀 없음 |

---

## 2. 씬/프리팹 변경 사항

**없음.** 새 노드·새 컴포넌트·새 프리팹을 추가하지 않는다. 패시브 효과는 기존 노드(Player, XP 아이템 풀)의 런타임 동작만 바꾼다.

---

## 3. 에디터 연결 체크리스트 (기존 배선 — 신규 `@property` 없음, 존재만 확인)

| 컴포넌트 | 프로퍼티 | 연결 대상 / 값 | 상태 |
|----------|----------|----------------|------|
| `XPItemController`(XP 프리팹) | `pickupRadius` | `50` (코드가 getter를 주입하므로 실사용은 데이터값. **getter 미주입 시 폴백**으로만 의미) | ☐ 기존 유지 |
| `PlayerController`(Player 노드) | — | 신규 `@property` 없음 — `DataManager.playerData.speed` 직접 사용 | ☐ 해당 없음 |

> 픽업 반경의 단일 진실은 `player.json`의 `pickupRadius`(50)로 이동했다. XP 프리팹의 `@property pickupRadius`(=50)는 **getter 미주입 시 폴백**으로만 남으므로, 에디터 값이 50과 달라도 인게임 동작은 코드 주입값을 따른다(혼동 방지로 50 유지 권장).

---

## 4. 자동 테스트로 검증

> **GREEN 근거:** 피처 테스트 5/5 + 전체 스위트 133/133 통과(`start-verification` GREEN 게이트). 통과 커밋: 본 피처 구현 커밋.

- [x] `tests/logic/PassiveEffects.test.ts` GREEN — `DeckLogic`의 `moveSpeedBonus`/`pickupRangeBonus`가 카드 선택마다 가산 누적되고, 미강화 시 0이며, HP·이동속도·픽업이 서로 독립 누적됨(5 케이스).
- [x] 전체 스위트 GREEN — 기존 회귀 없음(`start-verification` GREEN 게이트로 검증, 133/133).

> cc 배선(`PlayerController` 속도, `ExperienceManager`/`XPItemController` 픽업 라이브 적용, `CardSelectPanel` DEV 로그)은 cc 프레임워크 의존이라 단위 테스트 대상이 아니다 → 아래 수동 체크리스트 + DEV 콘솔 로그로 검증.

---

## 5. 수동 테스트 체크리스트 (인게임 — 코드로 검증 불가)

### 사전: DEV 콘솔 관찰
- [ ] 에디터/프리뷰(=DEV 빌드)에서 카드 픽 직후 콘솔에 `[패시브] HP +N (실효 maxHp=X) · 이동속도 +M% (실효 speed=Y) · 픽업범위 +P% (실효 반경=Z)` 한 줄이 출력된다.
- [ ] QA 동안 드로우 3장에 **마법 분류(화염/얼음/번개 × 데미지/쿨다운) 강화 카드가 나타나지 않는다**(`HIDE_CATEGORY_UPGRADE_CARDS` true). 개별 마법 강화·패시브·마법 추가 카드는 정상 노출.

### 이동속도 (+10%)
- [ ] 이동속도 카드를 뽑은 **즉시** 플레이어 이동이 빨라진다(레벨업 후 다음 입력부터 체감).
- [ ] 이동속도 카드를 여러 장 뽑으면 누적으로 더 빨라진다.
- [ ] DEV 로그의 `이동속도 +M%`·`실효 speed=Y`가 픽 횟수에 맞게 갱신된다(예: 1장 +10% → speed 330, 2장 +20% → speed 360).

### 픽업범위 (+30%) — 라이브
- [ ] 픽업 카드를 뽑은 **즉시**, 화면에 **이미 떠 있던** XP 아이템들이 더 멀리서부터 빨려 들어온다(새로 떨어진 XP만이 아님).
- [ ] 픽업 카드를 여러 장 뽑으면 흡수 반경이 누적으로 더 넓어진다.
- [ ] DEV 로그의 `픽업범위 +P%`·`실효 반경=Z`가 갱신된다(예: 1장 +30% → 반경 65).

### 카드 표시(i18n)
- [ ] `move_speed_up`·`pickup_range_up` 카드가 드로우 풀에 등장하고, 한국어 이름·설명이 올바르게 표시된다(raw 키 `card.move_speed_up.name` 노출 없음).
- [ ] 언어를 en으로 바꾸면 영어 이름·설명으로 표시된다.

### 회귀 (기존 패시브)
- [ ] HP 카드(`hp_up`)를 뽑으면 기존대로 최대 HP가 증가한다(이동속도·픽업 추가가 HP 누적을 깨지 않음).
- [ ] 보너스 0 상태(아무 패시브도 안 뽑음)에서 기본 이동속도·픽업 반경이 기존과 동일하다.

### 풀 재사용 무결성 (픽업 getter 재주입)
- [ ] 픽업 카드를 뽑아 반경을 넓힌 뒤, 새로 드롭되는(=풀에서 재사용되는) XP도 넓어진 반경으로 흡수된다(재사용 노드가 옛 반경으로 굳지 않음).
