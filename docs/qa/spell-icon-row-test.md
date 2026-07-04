# QA — HUD 마법 아이콘 행 (슬롯 정원 + 티어 라벨)

> **브랜치:** feat/spell-icon-row
> **슬라이스:** J4 P0-2 — 보유 마법 아이콘 행(슬롯 정원 + 분류색 placeholder + 티어 라벨)
> **계획 문서:** [2026-07-05-spell-icon-row-plan.md](../development/sessions/2026-07-05-spell-icon-row-plan.md)
> **레이아웃 청사진:** [hud-layout.html](../decisions/hud-layout.html) (스킬 그리드 자리)
> **닫는 백로그:** J4(UI 완성도) — 부분 전진(슬롯 정원 + 티어 라벨). 호버 강화표시·쿨다운 라디얼·최종 아이콘 아트는 후속.

---

## 1. Impact Map (회귀 테스트 기준)

| 변경 파일 | 변경 내용 | 회귀 확인 범위 |
|---|---|---|
| `logic/SpellIconRowLogic.ts` (신규) | `categoryInitial`·`buildSpellIconRow` 순수 함수 (cc 비의존) | 단위 테스트로 커버(§2). `SpellVisual.spellCategoryColor` 재사용. |
| `ui/HudController.ts` | 슬롯 프리팹 인스턴스화(`MAX_SLOTS`개) + `_rebuildSpellRow()`(LevelUp→Playing 전환 시 호출) 추가. `@property spellSlotPrefab`·`spellSlotContainer` 추가. | **기존 HUD 회귀** — HP/XP 바·웨이브·타이머·레벨 라벨 갱신, 카드 패널 전환(`_handleStateChange`) 무영향. 아이콘 행은 카드 픽 시에만 재빌드. |
| **main.scene (UI Canvas)** | 슬롯 컨테이너(가로 Layout) + 슬롯 프리팹 배선. 7단계 사용자 작업. | 아래 §3~§5. |
| **슬롯 프리팹 (신규 에셋)** | 분류색 Sprite + 티어 Label + 빈칸 테두리. 7단계 사용자 작업(`.meta`는 Cocos 생성). | §3. |

---

## 2. 자동 테스트로 검증 (`tests/logic/SpellIconRow.test.ts`)

> **RED 확인(2026-07-05):** 모듈(`SpellIconRowLogic`) 미존재로 피처 테스트 RED — `pnpm wf ready-impl` RED 게이트 통과.
> **GREEN 통과 근거(2026-07-05):** 피처 테스트 12/12(`SpellIconRow.test.ts`) + 전체 스위트 398/398 통과(`pnpm wf start-verification` GREEN 게이트). 통과 커밋 SHA는 `feat/spell-icon-row` 구현 커밋.

- [x] `categoryInitial` — fire→"F" / ice→"I" / lightning→"L" / support→"S" (각 1건, 총 4건)
- [x] `buildSpellIconRow` — 보유 없음 → 길이 maxSlots 전부 null
- [x] `buildSpellIconRow` — 1개 보유 → 앞칸 채움(`{id, colorRgb, label}`) + 나머지 null
- [x] `buildSpellIconRow` — 티어 오름차순 정렬 (F1 → I3)
- [x] `buildSpellIconRow` — 중간 티어 정렬 (I1 → F2 → I3)
- [x] `buildSpellIconRow` — 같은 티어 입력 순서 보존(안정 정렬)
- [x] `buildSpellIconRow` — `getSpell=null` id 생략(정합성 가드)
- [x] `buildSpellIconRow` — 보유 > maxSlots → 티어순 앞에서 클램프(빈칸 없음)
- [x] `buildSpellIconRow` — 라벨 = 분류 이니셜 + 티어 (inferno → "F2")

> **코드로 검증 불가(수동 항목):** 슬롯 프리팹이 색·라벨로 렌더되는지, 빈칸 프레임 표시, 티어순 배치, `MAX_SLOTS` 변경 시 칸 수 변화 — §5.

---

## 3. 씬/프리팹 변경 사항 (7단계 사용자 — Cocos 에디터)

> **(확정)** — 구현된 `HudController`(`@property spellSlotPrefab`/`spellSlotContainer`)와 슬롯 적용 코드(`_applySlot`)에 맞춘 확정본이다. 프리팹/노드 이름은 사용자 선택(코드가 이름에 의존하지 않음 — `@property` 슬롯 연결 + 아래 컴포넌트 구조만 필요).
>
> **프리팹 컴포넌트 구조(중요 — 코드가 이 구조로 찾음):** `_applySlot`이 슬롯 노드에서 **`getComponent(Sprite)`**(→ 루트 노드에 `cc.Sprite`)와 **`getComponentInChildren(Label)`**(→ 루트 또는 자식에 `cc.Label`)로 찾는다. 따라서 **루트 노드에 Sprite**, **자식(또는 루트)에 Label 하나**를 둔다.

### 3.1 슬롯 프리팹 (신규)

| 요소 | 타입/컴포넌트 | 비고 |
|---|---|---|
| 루트 | `cc.Node` + **`cc.Sprite`** (`SIZES.SKILL_SLOT`=48 정사각 권장, 흰/도형 placeholder 텍스처) | HUD가 `MAX_SLOTS`개 복제해 컨테이너에 붙인다. 코드가 이 Sprite를 `colorRgb`(분류색)로 틴트, 빈칸이면 `COLORS.PLACEHOLDER_BORDER` 톤. |
| 티어 Label | **`cc.Label`** (루트의 자식 노드 권장, 중앙정렬) | 코드가 `label`(예 "F1") 세팅. 빈칸이면 빈 문자열. |

### 3.2 슬롯 컨테이너

| 항목 | 값 | 비고 |
|---|---|---|
| 부모 | UICanvas > HUD 아래 | HudController가 붙은 HUD 노드 하위(기존 HUD 요소와 형제). `spellSlotContainer`에 연결. |
| 컴포넌트 | `cc.Layout` (Horizontal) | 슬롯을 가로로 자동 배치. 간격 `SIZES.GAP`=8 권장. |
| 위치 | 목업 스킬 그리드 자리(하단/우하 등) | `hud-layout.html` 참조. 확정은 사용자 배치. |

---

## 4. 에디터 연결 체크리스트 (`@property` ↔ 노드) — 확정

> **(확정)** — 구현된 `HudController`의 `@property` 이름 기준. 신규는 `spellSlotPrefab`·`spellSlotContainer` 두 개. 연결은 7단계 사용자 에디터 작업(상태 ⬜).

| 컴포넌트 | `@property` | 타입 | 연결 대상 | 상태 |
|---|---|---|---|---|
| `HudController` | `spellSlotPrefab` | `Prefab` | 신규 슬롯 프리팹(§3.1) | ⬜ 7단계 |
| `HudController` | `spellSlotContainer` | `Node` | 신규 슬롯 컨테이너(§3.2, Layout) | ⬜ 7단계 |

---

## 5. 수동 테스트 체크리스트 (인게임 — 7단계 사용자)

- [ ] 시작 시 HUD에 **슬롯 6칸(=`MAX_SLOTS`)이 보이고**, 시작 마법(파이어볼)이 첫 칸에 **분류색(빨강) + "F1"** 로, 나머지 5칸은 **빈 프레임**으로 표시된다.
- [ ] 레벨업에서 **마법 추가 카드**를 픽하면 해당 마법이 **티어 오름차순 위치**에 삽입되고(예: 아이스미사일 I1은 파이어볼 F1 뒤·인페르노 F2 앞), 분류색·티어 라벨로 구분된다.
- [ ] 같은 마법의 **강화 카드**를 픽해도 아이콘 행은 그대로다(이 슬라이스는 강화 상태를 아이콘에 표시하지 않음 — 호버/일시정지는 후속).
- [ ] 6칸을 다 채우면 빈 프레임이 없다. (로드아웃 정원 = `MAX_SLOTS`.)
- [ ] (선택) `LoadoutLogic.MAX_SLOTS` 값을 바꿔 재실행하면 **보이는 슬롯 칸 수가 그 값으로 바뀐다**(에디터 무변경 — 프리팹 동적 인스턴스화).
- [ ] 아이콘 행이 카드 선택 패널·HP/XP 바 등 기존 HUD와 겹치거나 가리지 않는다.
