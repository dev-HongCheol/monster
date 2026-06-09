# 계획: 덱 패시브 효과 — 이동속도·픽업범위 (passive-effects)

> - **작성일:** 2026-06-09
> - **브랜치:** feat/passive-effects
> - **상태:** 계획 (승인 대기)
> - **상위 설계:** [로드맵 v0.2](../../planning/roadmap.md) §7(본격 덱 시스템)·§9(데이터 주도 설계). 덱 시스템 슬라이싱의 **첫 번째 슬라이스**.
> - **선행:** 마법 강화 프레임워크(3-tier, `EnhancementLogic`)·카드 뽑기 UI(`CardSelectPanel`)·객체 풀링(적·XP)이 모두 머지됨. 본 슬라이스는 그 위에 **빠진 패시브 효과를 채운다.**

---

## 0. 목표 (한 줄)

레벨업 카드의 패시브 효과 중 현재 **HP만** 실제로 작동하는 상태에서, **이동속도(+10%)·픽업범위(+30%) 두 패시브를 작동**시키고 각 카드 1장을 추가한다. 두 효과 모두 카드를 뽑는 **즉시(라이브)** 반영된다.

---

## 1. 배경 / 왜 지금

코드를 확인해 보면 덱 시스템은 생각보다 많이 구현돼 있다. 레벨업 시 3장을 뽑는 UI(`CardSelectPanel`), 개별·분류·전역 3-tier 강화(`EnhancementLogic`), 보유 마법별 강화 카드 동적 합성, 미보유 마법의 "마법 추가" 카드 합성까지 모두 작동한다. 로드맵이 5주차에 적었던 "강화 적용 대상 선택 UI"도 별도 화면 없이 **대상이 박힌 강화 카드**(예: "파이어볼 데미지+", "화염 분류 쿨다운-")를 뽑는 방식으로 이미 해결돼 있다(뱀서/Brotato 모델).

진짜 비어 있는 곳은 **패시브 효과의 다양성**이다. `ICardEffect`에는 `maxHpBonus`만 있고, 로드맵 패시브 목록 중 이동속도·픽업범위는 효과 자체가 배선되지 않았다(플레이어 스탯이 보너스를 읽지 않음).

직업 3종이 post-MVP로 이월되면서(로드맵 v0.2.2) v1은 **마법사 단일로 전체 플로우를 완성**한다. 그만큼 빌드 선택의 깊이 — 즉 덱 — 이 v1 재미의 핵심이 되므로, 빠진 패시브를 채우는 것이 자연스러운 다음 슬라이스다.

부활·추가 슬롯은 특수 메커니즘이라 이번 스코프에서 제외하고, 강화 옵션(동시발사수·사거리)도 별도 슬라이스로 분리한다(§7 참고).

---

## 2. 덱 시스템 슬라이싱 맵

남은 덱 작업을 아래로 나누고, **본 문서는 1번**을 다룬다.

| # | 슬라이스 | 상태 | 비고 |
|---|---------|------|------|
| **1** | **패시브 효과** (이동속도·픽업범위) | **이번** | 작고 독립적. 누적 로직은 순수 함수 → 단위 테스트 가능 |
| 2 | 동시발사수 강화 옵션 | 후속 | 발사 패턴 엔진 연결 + per-spell 전용·발사체당 데미지 페널티(기획 PR #20) |
| 3 | 사거리/지속 강화 | 후속(선행 의존) | AOE/DOT 효과 레이어 슬라이스가 먼저 필요 |
| 4 | 카드 콘텐츠·튜닝 | 밸런싱 단계 | 수치·양 확장(데이터 작업) |

(등급/아이콘/리롤 같은 카드 폴리시는 폴리시 구간으로.)

---

## 3. 설계

### 3.1 패시브 누적 — 기존 HP 패턴 미러링

현재 HP 패시브는 `DeckLogic._maxHpBonus`가 카드 선택마다 가산(`+=`)으로 누적되고, `DeckManager.maxHpBonus` getter로 노출되며, 소비처(`GameManager`)가 `playerData.maxHp + bonus`로 읽는다. **이 패턴을 그대로 이동속도·픽업에 확장**한다.

- `DeckLogic`에 `_moveSpeedBonus`·`_pickupRangeBonus` 누적 필드 + getter 추가, `applyCard`가 두 효과를 가산.
- `DeckManager`에 `moveSpeedBonus`·`pickupRangeBonus` getter를 위임 추가.
- 누적은 **가산(additive)·상한 없음** — HP와 동일. 값은 placeholder(이동속도 0.10, 픽업 0.30)이며 수치 튜닝은 밸런싱 단계로 미룬다.

> 대안으로 스탯 보너스를 `Map<stat, number>`로 일반화할 수도 있으나, 지금 패시브 스탯이 3개(HP·이동속도·픽업)뿐이라 YAGNI다. 기존 HP 패턴을 미러링하는 것이 일관·최소이며, 패시브가 늘어나면 그때 맵으로 리팩터한다.

### 3.2 이동속도 (+10%) — `PlayerController`

`PlayerController._move`는 매 프레임 `DataManager.playerData.speed`(=300)를 직접 읽어 이동한다. 여기에 보너스를 곱한다:

```ts
const speed = DataManager.instance.playerData.speed * (1 + (DeckManager.instance?.moveSpeedBonus ?? 0));
```

매 프레임 읽으므로 카드를 뽑아 보너스가 오르면 **즉시** 반영된다(추가 배선 불필요). `DeckManager.instance`가 없을 가능성은 `?? 0`으로 방어.

### 3.3 픽업범위 (+30%) — 라이브 getter 주입

**요구:** 보너스가 오르면 새로 떨어진 XP뿐 아니라 **이미 화면에 떠 있는 XP에도 즉시** 넓어진 흡수 반경이 적용돼야 한다.

이를 위해 반경 값을 아이템에 고정하지 않고, **현재 반경을 돌려주는 getter를 주입**한다. XP 아이템은 매 프레임 그 getter로 반경을 재계산해 흡수 판정한다. 이 코드베이스가 이미 쓰는 콜백 주입 패턴(`XPItemController._onAbsorb`, `ExperienceManager._absorb`)과 동일해, XP 아이템이 `DeckManager`를 직접 알 필요가 없다(디커플링 유지).

- `XPItemController.init` 시그니처: 고정 `pickupRadius: number` 대신 `getPickupRadius: () => number` 주입. `update`에서 `const r = this._getPickupRadius()`로 매 프레임 판정. 기존 `@property pickupRadius`(=50)는 getter 미주입 시 폴백으로 유지.
- `ExperienceManager`는 반경 getter를 **1회 바인딩**해 재사용(매 스폰 새 클로저 방지):

```ts
private readonly _pickupRadius = (): number =>
  DataManager.instance.playerData.pickupRadius * (1 + (DeckManager.instance?.pickupRangeBonus ?? 0));
```

`spawnXpItem`에서 `ctrl.init(playerNode, value, this._pickupRadius, this._absorb)`로 전달.

> 대안: `XPItemController`가 `DeckManager.instance`를 직접 읽으면 더 짧지만 XP 아이템이 덱 시스템에 결합된다. getter 주입이 디커플링을 지키면서 라이브 적용도 되므로 채택.

### 3.4 데이터·타입

- `GameTypes.ts` — `ICardEffect`에 `moveSpeedBonus?: number`·`pickupRangeBonus?: number` 추가. `IPlayerBaseData`에 `pickupRadius: number` 추가.
- `player.json` — `pickupRadius: 50` 추가(픽업 베이스를 플레이어 스탯으로 이동. 픽업범위는 본질적으로 플레이어 스탯이라 아이템 @property보다 데이터가 맞음 — §6 결정 a).
- `cards.json` — 정적 패시브 카드 2장 추가: `move_speed_up`(`{ moveSpeedBonus: 0.10 }`), `pickup_range_up`(`{ pickupRangeBonus: 0.30 }`). 표시 키는 `buildDrawPool`이 `card.<id>.name/desc`로 부여(기존 규칙).
- `resources/i18n/ko.json`·`en.json` — `card.move_speed_up.{name,desc}`, `card.pickup_range_up.{name,desc}` 4키 추가(기존 정적 카드 키와 동일 구조).

### 3.5 DEV 디버그 로그 — 패시브 수치 관찰

패시브 효과는 인게임에서 눈으로 수치를 확인하기 어렵다(이동속도/픽업범위가 "조금 빨라졌다/넓어졌다" 수준). 그래서 이미 DEV 전용으로 강화 수치를 `console.table`로 찍는 `CardSelectPanel._logEnhancementDebug`에 **패시브 한 줄**을 추가해, 카드 픽 직후 누적 보너스와 실효값을 출력한다:

```
[패시브] HP +N (실효 maxHp=X) · 이동속도 +M% (실효 speed=Y) · 픽업범위 +P% (실효 반경=Z)
```

- 보너스는 `DeckManager` getter(`maxHpBonus`/`moveSpeedBonus`/`pickupRangeBonus`)에서, 베이스는 `DataManager.playerData`(maxHp/speed/pickupRadius)에서 읽어 실효값(`base × (1+bonus)`)을 계산해 표시. 수치 산출은 단순 곱이라 표시·포맷은 UI 책임으로 둔다(기존 강화 로그와 동일 altitude).
- `cc/env`의 `DEV` 게이팅 — 에디터/프리뷰/디버그 빌드에서만 출력되고 릴리스 빌드에선 제거된다.

### 3.6 분류 강화 카드 임시 숨김 (DEV QA 보조)

패시브 카드(2종)가 뽑기 3장에 잘 뜨도록, QA 동안 **마법 분류(category) 강화 카드를 드로우 풀에서 임시로 제외**한다. 시작 시 분류 카드만 화염·얼음·번개 × 데미지·쿨다운 = 최대 6장이라 패시브가 묻히기 때문이다.

- **위치:** `DeckManager.drawCards` — `EnhancementLogic.buildUpgradeCards` 결과에서 `effect.upgrade.track === Category`인 카드를 필터. **`EnhancementLogic`(순수 로직)은 건드리지 않는다** → 분류 카드 생성/단위 테스트·릴리스 동작 불변. 필터는 cc 레이어의 DEV 전용 표시 조정일 뿐.
- **게이팅:** `cc/env` `DEV` + 상수 `HIDE_CATEGORY_UPGRADE_CARDS`(기본 `true`, 이번 슬라이스 QA용) → 릴리스 빌드 영향 0. 개별 마법 강화·패시브·마법 추가 카드는 그대로 노출.
- **임시·복원:** 패시브 QA 편의용. 워크플로우상 `user-verification` 단계엔 스크립트 편집이 잠기므로 PR 직전 복원이 불가 → DEV 게이팅으로 릴리스 안전을 보장하고, `false` 복원은 **후속 편집 가능 단계(다음 슬라이스/별도 chore)** 에서 수행한다.

---

## 4. Impact Map (변경 파일별 확인 범위)

| 파일 | 변경 | 회귀 확인 |
|------|------|----------|
| `logic/DeckLogic.ts` | 이동속도·픽업 누적 필드/getter + `applyCard` | HP 누적 회귀 없음 |
| `systems/DeckManager.ts` | getter 위임 2개 + (DEV) 분류 강화 카드 필터(§3.6) | 기존 강화 라우팅 무영향 |
| `data/GameTypes.ts` | `ICardEffect`+2, `IPlayerBaseData`+1 | 타입 컴파일 |
| `data/player.json` | `pickupRadius` 추가 | DataManager 로드 |
| `components/PlayerController.ts` | `_move` 속도 보너스 | 기본 이동(보너스 0) 동일 |
| `systems/ExperienceManager.ts` | 픽업 반경 getter 바인딩 + `init` 인자 | XP 스폰/흡수 회귀 없음 |
| `components/XPItemController.ts` | `init`에 `getPickupRadius` 주입, `update` 라이브 판정 | 풀 재사용 시 getter 재주입 |
| `data/cards.json` | 패시브 카드 2장 | 드로우 풀 합성 |
| `resources/i18n/{ko,en}.json` | 카드 4키 | 카드 표시 |
| `ui/CardSelectPanel.ts` | `_logEnhancementDebug`에 `[패시브]` 한 줄 추가(DEV) | 기존 강화 로그 회귀 없음 |
| `tests/logic/PassiveEffects.test.ts` | 신규 — 누적 단위 테스트 | — |

---

## 5. 테스트 전략

패시브 누적은 `DeckLogic`의 순수 로직이라 **이번엔 실제 RED→GREEN 단위 테스트**가 가능하다(풀링 슬라이스가 cc 의존으로 스킵했던 것과 대조).

- `tests/logic/PassiveEffects.test.ts`(피처명 PascalCase — wf RED 게이트 대상): `DeckLogic`의 `moveSpeedBonus`/`pickupRangeBonus`가 카드 선택마다 가산 누적되는지, 미강화 시 0인지 검증.
- cc 배선(`PlayerController` 속도, `ExperienceManager`/`XPItemController` 픽업 라이브 적용)은 수동 QA로 검증(QA 문서 체크리스트).
- **수동 QA 관찰성:** 카드 픽 시 DEV 콘솔의 `[패시브]` 로그(§3.5)로 누적 보너스·실효값(speed/반경)을 직접 확인 → "수치가 실제로 올랐는지"를 눈으로 검증.

---

## 6. 결정 기록

- **(a) 픽업 베이스를 `player.json`으로 이동** — 픽업범위는 플레이어 스탯이므로 아이템 `@property`(50)보다 데이터가 적절. @property는 에디터 폴백으로 유지.
- **(b) 누적은 가산·상한 없음, 값은 placeholder** — HP 패턴과 동일. 수치 튜닝은 밸런싱 단계(로드맵 11~12주차).
- **(c) 픽업 보너스는 라이브 적용** — 매 프레임 getter로 재계산해 이미 떠 있는 XP에도 즉시 반영. 이동속도도 매 프레임 읽어 라이브 → 두 패시브 모두 "픽 즉시" 통일.

---

## 7. 스코프 밖 (후속 슬라이스)

- 동시발사수 강화 옵션(슬라이스 2), 사거리/지속 강화(슬라이스 3, AOE/DOT 선행), 카드 콘텐츠 양·튜닝(슬라이스 4).
- 부활 1회·추가 슬롯 +1 패시브(특수 메커니즘 — 별도).
- 카드 폴리시(등급/아이콘/리롤).

---

## 8. 완료 정의 (DoD)

- `DeckLogic` 이동속도·픽업 누적 단위 테스트 GREEN + 전체 스위트 GREEN.
- 인게임: 이동속도 카드 픽 → 플레이어가 즉시 빨라짐. 픽업 카드 픽 → 화면의 **기존** XP 포함 흡수 반경이 즉시 넓어짐.
- 두 카드가 i18n(ko/en)으로 올바르게 표시되고 드로우 풀에 등장.
- DEV 빌드에서 패시브 카드 픽 시 `[패시브]` 로그가 갱신된 보너스·실효값을 출력.
- cso / ts / lint / 코드리뷰 통과.
