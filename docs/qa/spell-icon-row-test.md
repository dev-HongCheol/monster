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

**목표 계층** (프리팹 1개 = 칸 1개):
```
SpellSlot        (Node + cc.Sprite)   ← 프리팹 루트. 48×48 흰 사각
└── TierLabel    (Node + cc.Label)    ← 자식. "F1" 같은 티어 글자
```

**만드는 순서 (Cocos 에디터):**
1. Hierarchy 우클릭 → **Create → 2D Object → Sprite (Single Color)** → 이름 `SpellSlot`. (`cc.Sprite`·`cc.UITransform`가 이미 붙어 나온다 = **이게 루트**.)
2. `SpellSlot` 인스펙터:
   - **UITransform → Content Size = 48 × 48** (`SIZES.SKILL_SLOT`).
   - **Sprite → Sprite Frame** = 흰 사각 텍스처(엔진 기본 `default_sprite_splash` 또는 흰 단색). **Size Mode = CUSTOM**, Type = SIMPLE. (코드가 이 색을 통째로 틴트하므로 단색 사각이면 된다.)
3. `SpellSlot` 우클릭 → **Create → 2D Object → Label** → 이름 `TierLabel` (자식으로 생성, `cc.Label` 붙어 나옴).
   - **Position (0, 0)**, Anchor (0.5, 0.5), **H/V Align = CENTER**, Font Size ≈ 20, Color 흰색, Overflow = NONE.
4. `SpellSlot` 노드를 `game/assets/` 아래로 드래그 → **프리팹화**. (`.meta`는 Cocos가 자동 생성 — 8단계에서 커밋.)

| 요소 | 타입/컴포넌트 | 코드가 하는 일 |
|---|---|---|
| `SpellSlot` (루트) | **`cc.Sprite`** + `cc.UITransform`(48×48) | `_applySlot`이 `getComponent(Sprite)`로 찾아, 채운 칸이면 `colorRgb`(분류색)로, **빈 칸이면 `COLORS.PLACEHOLDER_BORDER`(90,90,100) 회색**으로 `sprite.color` 틴트. |
| `TierLabel` (자식) | **`cc.Label`** (중앙정렬) | `getComponentInChildren(Label)`로 찾아 `label.string`에 티어 문자열("F1") 세팅. 빈 칸이면 `''`. |

> **빈칸 룩 참고:** 코드는 Sprite **전체 색**을 바꾸는 방식이라 채운 칸=분류색 단색, 빈 칸=회색 단색으로 보인다(목업의 "테두리만" 룩과는 다름). 테두리 룩을 원하면 placeholder를 **속이 빈 프레임(가운데 투명, 테두리만 불투명) 텍스처**로 넣으면 틴트가 테두리에만 먹는다 — 선택 사항, 이 슬라이스 필수 아님.

### 3.2 슬롯 컨테이너 (신규) — 우하단 3×2 그리드

> **배치 확정(2026-07-05 사용자):** plan의 "가로 한 줄" 대신 **목업(`hud-layout.html`)의 3열×2줄 그리드**를 따른다. 위치는 목업의 **오른쪽 하단**(XP 바 바로 위). 코드는 `addChild`만 하므로 Layout 형태는 자유 — 코드 변경 없음.

**목표 계층:**
```
HUD                          (HudController 붙은 기존 노드)
├── HpBar / XpBar / WaveLabel …   (기존 요소)
└── SpellSlotContainer        (Node + cc.Layout[GRID] + cc.Widget)  ← 새로 만듦
       (실행 시 SpellSlot 6개가 자식으로 자동 생성됨)
```

**만드는 순서 (Cocos 에디터):**
1. **HUD 노드 우클릭 → Create → Empty Node** → 이름 `SpellSlotContainer` (기존 HP/XP 바와 **형제**).
2. **UITransform → Content Size = `W × 210`** (W = 슬롯 수로 계산 → **§3.3**. `MAX_SLOTS`=6이면 **160 × 210**). **Anchor는 (0.5, 0.5) 그대로.** ← 슬롯은 런타임에 생성돼 에디터에선 빈 박스지만, 크기를 정해두면 배치·겹침을 눈으로 확인할 수 있다.
   - **높이 210 고정(사용자 확정 2026-07-05):** 2줄 그리드 자체는 104(`2·48+8`)면 되지만, 아래 XP 바 위로 여유를 두려고 컨테이너 높이를 **210**으로 키워 그리드를 위로 띄운다. 슬롯 수가 바뀌어도 **높이는 210 유지**, 너비만 변한다.
3. **Add Component → Layout** (공식: GRID는 *고정 크기 박스 안에* 자식을 채운다):
   - **Type = GRID**
   - **Resize Mode = NONE** ← 2번에서 크기를 직접 줬으므로 자동 리사이즈 끔(에디터에서 빈 박스가 안 사라짐).
   - **Start Axis = HORIZONTAL**, Horizontal Direction = LEFT_TO_RIGHT, Vertical Direction = **TOP_TO_BOTTOM** (F1·I1·F2가 윗줄, 다음 칸이 아랫줄 — 왼→오·위→아래)
   - **Constraint = Fixed Row**, **Constraint Num = 2** ← **줄 수를 2로 고정.** 슬롯이 늘면 *열(가로)* 만 늘고 줄 수는 2 유지 → **넓이만 변한다.** (Fixed Column이면 슬롯 증가 시 3열째가 세로로 쌓여 *줄 수*가 늘어나므로 안 씀.)
   - **Cell Size = 48 × 48**, **Spacing X = 8, Spacing Y = 8** (`SIZES.GAP`)
4. **Add Component → Widget** (기존 HUD처럼 모서리 앵커):
   - ☑ **Right = 24**, ☑ **Bottom = 24** (XP 바 위로 띄움), **Top/Left 미체크**
   - Align Mode = ON_WINDOW_RESIZE (창 리사이즈 시 우하단 유지)
5. `HudController`의 **`@property spellSlotContainer`** 에 이 노드를 드래그 연결.

> **"오른쪽으로 뻗어나가 잘리지 않나?" — 안 잘린다.** Widget은 **박스의 오른쪽·아래 *모서리*를 화면에 고정**하고(한 점이 아님), GRID는 그 **박스 *안*에서 좌상단부터** 채운다(공식 문서: "arranges child nodes within a fixed container size"). 그래서 박스가 통째로 우하단에 앉고 슬롯이 그 안에 담긴다 — 왼쪽 끝 칸은 화면 오른쪽에서 `W+24`px 안쪽. Top/Left를 체크하지 않는 게 핵심(체크하면 Widget이 폭까지 늘려 왜곡).

| 항목 | 값 |
|---|---|
| 부모 | HUD (HudController 노드) 하위, 기존 HUD 요소와 형제 |
| Content Size | **W × 210** (W=§3.3 계산; `MAX_SLOTS`=6 → **160 × 210**) · Resize Mode=NONE · Constraint=Fixed Row 2 |
| 앵커 위치 | 우하단, XP 바 위 (Widget Right=24 / Bottom=24, Top/Left 미체크) |

### 3.3 컨테이너 넓이 계산식 (슬롯 수 → 너비)

**2줄 고정** 그리드라, 슬롯 수(`MAX_SLOTS`)가 바뀌면 **열 수만 늘고 너비(W)만 변한다**(높이 210·나머지 설정 불변).

```
열 수  C = ceil(MAX_SLOTS / 2)
너비   W = C × SKILL_SLOT + (C − 1) × GAP
        = C × 48 + (C − 1) × 8
        = 56·C − 8
높이   H = 210 (고정)
```

| `MAX_SLOTS` | 열 수 C = ⌈n/2⌉ | 너비 W = 56·C − 8 | Content Size |
|---|---|---|---|
| 6 | 3 | 160 | **160 × 210** |
| 8 | 4 | 216 | 216 × 210 |
| 10 | 5 | 256 | 256 × 210 |

> 홀수 슬롯이면 `C=⌈n/2⌉`라 마지막 열 아랫칸이 빈 슬롯(회색)으로 남는다(예: 7 → C=4 → 8칸 중 1칸 빈칸). `MAX_SLOTS`를 바꿀 땐 이 표대로 **Content Size 너비만** 고치면 된다(에디터 다른 설정·프리팹은 불변).

---

## 4. 에디터 연결 체크리스트 (`@property` ↔ 노드) — 확정

> **(확정)** — 구현된 `HudController`의 `@property` 이름 기준. 신규는 `spellSlotPrefab`·`spellSlotContainer` 두 개. 연결은 7단계 사용자 에디터 작업(상태 ⬜).

| 컴포넌트 | `@property` | 타입 | 연결 대상 | 상태 |
|---|---|---|---|---|
| `HudController` | `spellSlotPrefab` | `Prefab` | 신규 슬롯 프리팹(§3.1) | ⬜ 7단계 |
| `HudController` | `spellSlotContainer` | `Node` | 신규 슬롯 컨테이너(§3.2, Layout) | ⬜ 7단계 |

---

## 5. 수동 테스트 체크리스트 (인게임 — 7단계 사용자)

- [x] 시작 시 HUD **우하단(XP 바 위)에 슬롯 6칸이 3열×2줄 그리드로 보이고**(=`MAX_SLOTS`, 왼→오·위→아래 순), 시작 마법(파이어볼)이 첫 칸에 **분류색(빨강) + "F1"** 로, 나머지 5칸은 **빈 프레임(회색)** 으로 표시된다.
- [x] 레벨업에서 **마법 추가 카드**를 픽하면 해당 마법이 **티어 오름차순 위치**에 삽입되고(예: 아이스미사일 I1은 파이어볼 F1 뒤·인페르노 F2 앞), 분류색·티어 라벨로 구분된다.
- [x] 같은 마법의 **강화 카드**를 픽해도 아이콘 행은 그대로다(이 슬라이스는 강화 상태를 아이콘에 표시하지 않음 — 호버/일시정지는 후속).
- [x] 6칸을 다 채우면 빈 프레임이 없다. (로드아웃 정원 = `MAX_SLOTS`.)
- [x] (선택) `LoadoutLogic.MAX_SLOTS` 값을 바꾸면 **슬롯 노드 수는 동적 인스턴스화라 프리팹 무변경**으로 그 값만큼 생성되지만, **컨테이너 Content Size 너비를 §3.3 식대로 조정**해야 그리드가 안 넘친다(2줄 고정 → 열 수 `⌈n/2⌉`, 너비 `56·C−8`, 높이 210 유지). 조정 후 재실행 시 2줄 그리드가 넓이만 바뀌어 표시된다.
- [x] 아이콘 행이 카드 선택 패널·HP/XP 바 등 기존 HUD와 겹치거나 가리지 않는다.
