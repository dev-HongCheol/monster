# 마법 추가 카드 배선 — 구현 플랜

> **작성일:** 2026-06-02
> **브랜치(예정):** feat/magic-add-card
> **워크플로우 피처명:** `magic-add-card` (wf CLI 피처명 — 테스트 파일 `MagicAddCard.test.ts`)
> **관련 기획:** [마법 시스템 — 마법사](../../planning/magic-system-mage.md) § 6 (덱 시스템)
> **선행 슬라이스:** loadout-runtime (#15) — `SpellCaster`가 로드아웃 마법 전부를 각자 쿨다운으로 자동 발사
> **후속 검토 출처:** [magic-followups](2026-06-01-magic-followups.md) 다음 슬라이스 후보 1

---

## 0. 목적

직전 슬라이스에서 `SpellCaster`가 로드아웃의 마법을 전부 발사하도록 배선했으나, 로드아웃은 아직 `startingSpellIds` `@property`로 **정적 시드**만 된다. 플레이 중 마법이 늘어나지 않는다.

이번 슬라이스는 **레벨업 카드 패널에 "마법 추가" 카드를 등장시켜, 미보유 마법 1종을 골라 로드아웃에 추가**(`LoadoutLogic.addSpell`)하게 만든다. 추가된 마법은 다음 프레임부터 자동 발사된다.

## 1. 스코프 (확정 전제)

| # | 전제 |
|---|---|
| 1 | **레벨업 카드 패널의 "마법 추가" 카드만** 구현. `startingSpellIds` 시드는 유지(빈손 시작·시작 카드 패널 § 5는 다음 슬라이스). |
| 2 | "마법 추가" 카드는 **동적 합성** — `cards.json`을 늘리지 않고 드로우 시점에 `spells.json`의 **미보유 마법**으로 카드를 즉석 생성. |
| 3 | 미보유 마법만 등장(기획 § 6.2). 로드아웃이 가득 차면(6슬롯) 마법 추가 카드는 풀에서 제외(§ 6.3) — 현재 마법 3종이라 6슬롯 도달은 불가하나 로직은 처리. |
| 4 | 카드 수는 현행 유지(3장). 기획 § 6의 4장화·가중치 추첨은 범위 밖(밸런싱 단계). |
| 5 | 마법별 전용 비주얼 없음 — 추가된 마법도 분류 색 틴트로 발사(현 동작 유지). |
| 6 | **네이밍 정리 동반:** `GameState.WaveClear`(실제 의미는 "레벨업으로 카드 선택 일시정지")를 `LevelUp`으로 리네임. 행동 변화 없음, 식별자만. |

## 2. 변경 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `data/GameTypes.ts` | 수정 | `ICardData.type`에 `'magic'` 추가, `spellId?: string` 추가. `GameState.WaveClear` → `LevelUp` 리네임. |
| `logic/DeckLogic.ts` | 수정 (순수) | `buildDrawPool(...)` 추가 — base 카드 + 미보유 마법 합성 카드. cc import 없음. |
| `systems/DataManager.ts` | 수정 | `get spells(): ISpellData[]` 게터 추가(전체 마법 목록 노출). |
| `systems/DeckManager.ts` | 수정 | `drawCards(n)`이 `buildDrawPool`을 거쳐 base + 합성 magic 카드 풀에서 추출. |
| `components/SpellCaster.ts` | 수정 | `static instance` + `onDestroy` 정리, `addSpell(id): boolean` 공개(loadout 위임). |
| `ui/CardSelectPanel.ts` | 수정 | 픽 시 `type==='magic'` → `SpellCaster.instance.addSpell(spellId)`, 그 외 → 기존 `DeckManager.applyCard`. `startNextWave` 호출명 변경. |
| `systems/GameManager.ts` | 수정 | `setWaveClear`→`enterLevelUp`, `startNextWave`→`resumeFromLevelUp` 리네임(행동 동일). |
| `ui/HudController.ts` | 수정 | `GameState.WaveClear` 참조 → `LevelUp`. |
| `tests/logic/MagicAddCard.test.ts` | 신규 | `buildDrawPool` 단위 테스트(RED 먼저). |
| `docs/qa/magic-add-card-test.md` | 신규 | QA 문서. |

> 9개 스크립트 + 신규 테스트/QA. 5개 이상 수정이므로 이 플랜으로 사전 공유(CLAUDE.md Safety Rule).

## 3. 핵심 결정 — "마법 추가" 카드 동적 합성

`cards.json`에 마법별 카드를 수기로 넣는 대신(중복·동기화 부담), 드로우 시점에 `spells.json` 미보유 마법으로 카드를 합성한다.

- 데이터 주도 원칙 부합: spells.json에 마법 한 줄 추가 = 카드 풀 자동 등장(로드맵 § 9).
- 기획 § 6.2(미보유만)·§ 6.3(슬롯 풀 시 제외)이 합성 조건으로 자연 충족.

## 4. 순수 로직 설계 — `DeckLogic.buildDrawPool`

```ts
/** 드로우 후보 풀 = base 카드 + (가득 안 찼으면) 미보유 마법 합성 카드.
 *  @param baseCards   강화/패시브 카드 풀 (cards.json)
 *  @param allSpells   전체 마법 데이터 (spells.json)
 *  @param ownedSpellIds 현재 로드아웃 보유 마법 id
 *  @param isFull      로드아웃이 가득 찼는지 */
buildDrawPool(
  baseCards: ICardData[],
  allSpells: ISpellData[],
  ownedSpellIds: string[],
  isFull: boolean,
): ICardData[]
```

합성 magic 카드:
```ts
{
  id: `add_${spell.id}`,
  name: spell.name,
  description: `신규 마법 추가 (${categoryLabel(spell.category)} · ${spell.tier}등급)`,
  type: 'magic',
  spellId: spell.id,
}
```

- `isFull === true` → 합성 카드 0개(base만).
- `ownedSpellIds`에 든 마법은 합성 제외.
- `drawCards`는 이 풀에서 기존처럼 n장 비복원 추출(현 3장).

## 5. 런타임 흐름

```
레벨업(XP) → GameManager.enterLevelUp() → state=LevelUp(일시정지)
  → HudController가 cardSelectPanel 활성화
  → CardSelectPanel.onEnable: DeckManager.drawCards(3)
       └ buildDrawPool(cards, DataManager.spells, SpellCaster.instance.loadout.spells, .isFull)
  → 카드 픽:
       type==='magic' → SpellCaster.instance.addSpell(spellId)
       그 외          → DeckManager.applyCard(card)
       → GameManager.resumeFromLevelUp() → state=Playing
  → 다음 프레임: SpellCaster.update가 loadout 순회 → 새 마법 즉시 발사
```

## 6. 테스트 (`MagicAddCard.test.ts`, RED 먼저)

- 미보유 마법 → 합성 magic 카드 생성(`type==='magic'`, `spellId` 일치).
- 보유 마법(`ownedSpellIds` 포함) → 합성 제외.
- `isFull === true` → magic 카드 0개, base 카드만.
- base 카드는 항상 포함.
- 모든 마법 보유 시 → base만.

## 7. 에디터 영향 (QA 문서에서 상세화)

- **씬/프리팹 변경 없음.** `SpellCaster.instance`는 코드 내부 싱글톤(에디터 연결 불필요).
- 회귀: 기존 강화/패시브 카드 픽 동작 동일. 레벨업 일시정지·재개 동일.
- 수동 확인: 레벨업 시 마법 추가 카드 등장 → 픽 → 새 분류 색 발사체가 추가로 날아가는지.

## 8. 범위 밖 (후속 슬라이스)

- 빈손 시작 + 시작 카드 패널(§ 5).
- 개별·분류 강화 엔진(곱셈 합산, cap4, 비선형).
- 카드 가중치 추첨·4장화(§ 6.2).
- 16종 전체 카탈로그 + 마법별 비주얼.
- **웨이브 타이머 리셋 동작**(레벨업 재개 시 `resumeWave`가 타이머를 풀로 리셋) — 행동 미변경, [magic-followups](2026-06-01-magic-followups.md)에 관찰 기록.
