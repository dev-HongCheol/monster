# 결과 화면 런 통계 (result-stats) — QA·테스트 체크리스트

- **작성일:** 2026-07-07
- **브랜치:** feat/result-stats
- **계획:** `../development/sessions/2026-07-06-result-stats-plan.md`
- **목업:** `../design/mockups/result-stats.html` (색·스크롤·행 포맷)
- **성격:** 결과 화면(`ResultController`)에 생존·레벨·킬(종류별)·보유 마법(강화 레벨 브레이크다운)·패시브를 얹는다. 순수 조립은 `buildResultStats`(피처 테스트가 덮음), Cocos 의존부(스냅샷 실제 채움·registerKill·RichText 렌더·씬 전환)는 수동 QA.

> **확정 안내:** 아래 프리팹/씬·에디터 섹션은 구현 완료(GREEN) 후 실제 컴포넌트(`ResultController`의 `@property` 이름·노드, RichText 색값)에 맞춰 확정했다 — 코드가 정본, 이 문서가 그 거울이다.

---

## 1. 자동 테스트로 검증 (`tests/logic/ResultStats.test.ts`)

> **GREEN 확인(2026-07-10 리워크 후):** 전체 스위트 429/429 통과. `buildResultStats`는 해석된 입력만 받는 순수 포맷터라 result 씬에서 DataManager 비의존. 아래 항목 자동 테스트로 덮음(정합 가드는 스냅샷 계층으로 이동).
>
> **리워크 사유(2026-07-10 7단계):** 강화를 하나도 안 골랐는데 결과 화면 전역 티어가 `Lv.1 (+0%)`로 찍혔다. DEV 강화 시드(`resources/data/debug-enhancements.json`)의 `"global": { "damage": 0, "cooldown": 0 }`이 `parseDebugEnhancementSeed`를 그대로 통과해 `addGlobal(option, 0)`을 호출했고, 이번 슬라이스가 새로 넣은 `_globalLevel` 카운터가 보너스와 무관하게 +1 되면서 생긴 회귀다(시드 파일 자체는 인페르노 슬라이스 `ec90f36`부터 있었고, 레벨 카운터가 없던 그때는 0이 무해했다). 개별·분류 트랙의 `level <= 0` 가드와 대칭이 되도록 전역 루프에 `bonus === 0` 가드를 넣고 피처 테스트 2건을 추가했다. `DeckManager.start()`가 `DEV` 게이트 뒤라 릴리스 빌드는 영향 없었다.

순수 함수 `buildResultStats(input, getSpell, getEnemy)` 조립을 덮는다.

- [x] 생존 시간 포맷 — 600초 → `"10:00"`, 65초 → `"01:05"` (`formatTimer` 재사용)
- [x] 도달 레벨 그대로 전달
- [x] 킬 총계 = 표시된 종류별 킬의 합
- [x] 킬 종류별을 count 내림차순 정렬 + 적 이름은 데이터(`getEnemy(id).name`)에서 (한국어 고정, §2 OUT)
- [~] 정합 가드(미존재 적 킬 제외)는 **스냅샷 계층으로 이동**(리뷰 C1) — `GameManager._snapshotResult`가 `getEnemy=null` 킬을 제외(수동 QA). 순수 함수는 해석된 이름만 받음
- [x] 마법 티어 라벨(`categoryInitial+티어`, 예 `F1`) + 이름 i18n 키(`spell.<id>.name`) 출력
- [x] 보유 마법 티어 오름차순 정렬 (F1 → I3)
- [~] 정합 가드(미존재 마법 제외)는 **스냅샷 계층으로 이동**(리뷰 C1) — `DeckManager.resultSpellSnapshots`가 `getSpell=null` 마법을 제외(수동 QA)
- [x] 강화 브레이크다운: 옵션 순서 = 데미지 → 쿨다운
- [x] 브레이크다운: 세 티어 레벨 그대로 + **총합 필드 없음**(합계는 `1 + 2 + 3` 형태로 이미 드러남 — 2026-07-10 사용자 결정)
- [x] 데미지 최종 효과 % = `+(factor−1)` 반올림 (배율 2.0 → +100)
- [x] 쿨다운 최종 효과 % = 단축 `−(1−1/factor)` 반올림 (배율 1.25 → −20)
- [x] 미강화 마법 = 세 티어 0 + 효과 % 0
- [x] 패시브 레벨·보너스 그대로 전달
- [x] 빈 입력(킬 0·마법 0) → 빈 리스트·총계 0·생존 `"00:00"`

> **전역 상한(B2) 레벨·패시브 레벨 집계**는 각각 `EnhancementLogic`·`DeckLogic` 테스트가 덮는다: 전역 레벨이 `GLOBAL_UPGRADE_CAP`에서 고정·보너스 동결 / `applyCard` N회 → 패시브 level N. **단, "maxed 전역 카드 드로우 풀 제외"는 `DeckManager._isMaxedGlobalCard`(cc, 단위 테스트 밖) → 수동 QA**(리뷰 M1 정정).

---

## 2. Impact Map (변경 파일별 확인 범위)

| 파일 | 변경 | 회귀 확인 |
|------|------|----------|
| `logic/ResultStatsLogic.ts` (신규) | 순수 `buildResultStats` + 뷰모델 타입 | 피처 테스트로 덮음 |
| `logic/EnhancementLogic.ts` | 전역 레벨 상한(`GLOBAL_UPGRADE_CAP`) + `getGlobalLevel` | 기존 강화 배율·카드 생성 회귀 없음(전역 무한 누적 → 유계) — 인게임에서 전역 강화 반복 픽 시 상한 도달 확인 |
| `logic/DeckLogic.ts` | 패시브 획득 횟수(레벨) 집계 + `maxHp/moveSpeed/pickupLevel` getter | 기존 보너스 누적 동작 무변경 |
| `data/GameTypes.ts` | `GameResult` static 확장(survivalSec·level·killsByType·spells 레벨/배율·패시브 레벨/보너스) | 기존 `waveReached`·`gameVictory` 유지 |
| `systems/GameManager.ts` | `_killsByType` + `registerKill` + `_snapshotResult` | 사망·승리 양 경로가 `goToResult()` 경유 → 스냅샷 1회 |
| `systems/DeckManager.ts` | 티어 레벨·배율·패시브 레벨 getter 패스스루 | 순수 위임 — 기존 강화 적용 무변경 |
| `components/EnemyController.ts` | `_startDeath()`에서 `registerKill(enemyId)` 1회 | 실제 킬만(despawn/onDestroy 제외) — 오버카운트 없음 |
| `ui/ResultController.ts` | `buildResultStats` 렌더 + 통계 라벨/스펠 행/패시브 + RichText | 기존 waveLabel·retry/menu 유지 |
| `resources/i18n/ko.json`·`en.json` | `result.stat.*` 라벨 (+ `upgrade.damage/cooldown` 재사용) | 키 정합 가드 통과 |
| `result.scene` | ScrollView + 통계 노드 + `@property` 연결 (7단계) | 헤더·버튼 레이아웃 유지 |

---

## 3. 씬 변경 사항 (`result.scene`, 1280×720)

결과 헤더(승/패 + 웨이브 = `waveLabel`)와 RETRY/MENU 버튼 **사이에** 세로 스크롤 통계 영역을 새로 넣는다(목업 참조). 통계는 나중에 늘 수 있으므로 ScrollView로 둔다.

> **⚠️ 기존 노드 재배치가 필요하다(2026-07-10 정정).** 이 문서는 처음에 헤더·버튼을 "고정, 무변경"이라고 썼으나 **틀렸다.** 걷는 해골 시절의 `result.scene`은 헤더가 `y=+50`, RETRY/MENU가 `y=−50`·`y=−120`으로 **전부 화면 한가운데 세로로 모여 있다.** 반면 목업은 헤더가 상단, 버튼이 하단에 **가로로** 놓인 3단 구조다. 통계 영역(`y=+250 ~ −270`)을 그 사이에 넣으려면 헤더를 위로, 버튼을 아래로 밀어야 한다. 안 그러면 스크롤 영역이 셋을 모두 덮는다. → §4.2 0번

**기존 노드 재배치**

| 노드 | 기존 Position | 변경 Position | 이유 |
|------|--------------|--------------|------|
| `WaveLabel` | `(0, 50)` | `(0, 300)` | 통계 영역 위(`y > 250`)로 |
| `RetryButton` | `(0, −50)` | `(−100, −310)` | 통계 영역 아래(`y < −270`), 가로 배치 |
| `MenuButton` | `(0, −120)` | `(100, −310)` | 위와 같음 |

**추가 노드 요약**

| 노드 | 타입/컴포넌트 | 역할 |
|------|--------------|------|
| `StatsScroll` | Node + **ScrollView**(Elastic=off) + **Sprite**(`#111827`) | 세로 스크롤 컨테이너(Vertical=on, Content=StatsContent). ScrollView를 만들면 **흰색 `Sprite`가 딸려 온다** — 색을 `#111827`로 바꿔 통계 영역 전체를 하나의 모달 패널로 만든다. 흰색 그대로 두면 흰 글씨가 안 보인다(§4.2 1번) |
| `StatsScroll/view` | Node + **Mask** | 보이는 영역 정의·클립(뷰 밖 숨김) |
| `StatsScroll/view/StatsContent` | Node + **Layout**(VERTICAL, ResizeMode=CONTAINER) | 자식 높이 합만큼 자동 확장 → 스크롤 대상 |
| ↳ `SurvivalLabel` | Label | "생존 시간  10:32" |
| ↳ `LevelLabel` | Label | "도달 레벨  Lv.14" |
| ↳ `KillTotalLabel` | Label | "처치  487" |
| ↳ `KillListLabel` | Label(Overflow=RESIZE_HEIGHT) | 종류별 킬 조인(여러 줄) |
| ↳ `SpellListContent` | Node + **Layout**(VERTICAL, ResizeMode=CONTAINER) | 마법 행 부모 — `spellRowPrefab` 복제로 채움(코드) |
| ↳ `PassiveLabel` | Label(Overflow=RESIZE_HEIGHT) | 패시브 3줄(최대HP·이동속도·픽업) |
| `SpellRow` **프리팹**(씬 밖 에셋) | Node + **UITransform** + **Layout**(VERTICAL, CONTAINER) → **직계 자식** `Name`(Label) + `Breakdown`(RichText) | 마법 한 행 템플릿 — `ResultController.spellRowPrefab`에 연결. 두 자식은 **형제**이고, 행 내부에도 Layout이 있어야 세로로 쌓인다(§4.2 5번) |

> Context7 확인(Cocos 3.8): ScrollView = `view`(Mask, 보이는 영역) + `content`(Layout **또는** Widget — 동시 불가). Layout은 자식 배치 + 컨테이너 크기 자동 조정. RichText 색은 `<color=#hex>…</color>`(중첩 가능, 순서 무관).

---

## 4. 에디터 조립 레시피 (7단계 — 문서만 보고 제작)

### 4.1 목표 계층 트리

```
Canvas (기존)
 ↳ (기존) 결과 헤더 waveLabel            ← 고정, 무변경
 ↳ StatsScroll            [신규] ScrollView
    ↳ view                [신규] Mask
       ↳ StatsContent     [신규] Layout(VERTICAL, RESIZE_CONTAINER)
          ↳ SurvivalLabel     [신규] Label
          ↳ LevelLabel        [신규] Label
          ↳ KillTotalLabel    [신규] Label
          ↳ KillListLabel     [신규] Label(RESIZE_HEIGHT)
          ↳ SpellListContent  [신규] Layout(VERTICAL, RESIZE_CONTAINER)  ← 마법 행은 런타임 생성
          ↳ PassiveLabel      [신규] Label(RESIZE_HEIGHT)
 ↳ (기존) RetryButton / MenuButton       ← 고정, 무변경
```

프리팹은 씬 밖 별도 에셋이며, 두 자식이 **형제**(둘 다 `SpellRow`의 직계 자식)여야 한다.

```
SpellRow            [신규 프리팹] Node + UITransform(폭 700) + Layout(VERTICAL, CONTAINER)
 ↳ Name             [신규] Label(Font 20, LineHeight 26, Overflow=RESIZE_HEIGHT, 폭 700, LEFT)
 ↳ Breakdown        [신규] RichText(Font 20, LineHeight 26, maxWidth 700, 초기 문자열 비움)
```

`SpellRow`에 **Layout이 없으면 두 자식이 같은 자리(부모 중심)에 겹쳐 그려진다** — 마법 이름이 강화 브레이크다운 위에 포개진다. 행 높이는 Layout의 `CONTAINER` 모드가 자식 높이에 맞춰 자동 계산한다.

### 4.2 만드는 순서 (좌표는 1280×720, Widget 앵커 기준)

0. **기존 노드 재배치(먼저)** — §3의 재배치 표대로 `WaveLabel`을 `(0, 300)`, `RetryButton`을 `(−100, −310)`, `MenuButton`을 `(100, −310)`으로 옮긴다. 통계 영역이 들어갈 `y = +250 ~ −270` 구간을 비우는 작업이다. 안 하면 스크롤 영역이 헤더·버튼을 덮는다.
1. **StatsScroll** — `Canvas` 우클릭 → Create → UI Component → **ScrollView**. 이름 `StatsScroll`.
   - **Widget** 추가: Top=110, Bottom=90, Left=280, Right=280 (헤더 아래 ~110px, 버튼 위 ~90px, 좌우 280px 여백 → 가시폭 ~720px). Align 4방향 on. 결과 크기는 `720 × 520`, Position `(0, −10)`.
   - **`Sprite` 컴포넌트의 색을 `#111827`(목업의 `bg-gray-900`)로 바꾼다.** ScrollView를 만들면 **흰색 불투명 `Sprite`가 함께 붙는다.** 이걸 그대로 두면 720×520 흰 판 위에 흰 글씨가 올라가 통계가 안 보인다. 색만 바꾸면 통계 영역 전체가 검은 배경 위의 **하나의 모달 패널**로 읽힌다(목업의 의도). 노드 자신의 렌더 컴포넌트는 자식보다 먼저 그려지므로 이 `Sprite`는 통계 뒤에 깔린다.
     - 0번에서 `WaveLabel`·버튼을 스크롤 영역 **밖**으로 옮겼기 때문에 이 `Sprite`가 헤더나 버튼을 가리지 않는다. 재배치 전이라면 헤더가 덮인다.
     - 이미 `Sprite`를 지웠다면 다시 추가한다: `Add Component → 2D → Sprite` → `SpriteFrame`에 내장 `default_sprite_splash`(흰 사각형) 지정 → `Type`=SIMPLE → **`Size Mode`=`CUSTOM`** → `Color`=`#111827`. **`SpriteFrame`을 비워 두면 아무것도 안 그려진다.**
     - **⚠️ `Size Mode`를 반드시 `CUSTOM`으로 바꾼다(2026-07-10 7단계에서 실제로 여기서 막혔다).** `Sprite`를 새로 붙이면 `Size Mode` 기본값이 `TRIMMED`인데, 이 모드는 **노드의 Content Size를 스프라이트 원본 크기로 덮어쓴다.** `default_sprite_splash`는 실제로 **2×2 픽셀** 이미지라, 지정하는 순간 `StatsScroll`이 `720 × 520` → **`2 × 2`로 찌그러진다.** 그 상태에서 Widget의 Align 4방향을 켜면 에디터가 현재 사각형 기준으로 여백을 잡아 `Left/Right=639`, `Top=369`, `Bottom=349`(=1280−639−639=2, 720−369−349=2)가 박히고, Widget이 매 프레임 2×2를 다시 강제해 **되돌릴 수 없는 것처럼 보인다.** 증상 3종이 한꺼번에 나온다.
       - **스크롤이 거의 안 된다** — ScrollView의 터치·휠 히트 영역은 `view`가 아니라 **`StatsScroll` 노드 자신의 사각형**이다. 2×2면 화면 정중앙 2픽셀 위에 커서를 얹었을 때만 휠이 먹는다. (스크롤 계산 자체는 `view` 720×520 기준이라 내용은 정상으로 보여 더 헷갈린다.)
       - **세로 스크롤바가 화면 한가운데 `_` 모양 짧은 가로줄로 나타난다** — `scrollBar`는 Widget으로 부모 높이에 맞춰 늘어나므로 `12 × 2`가 되고, `ScrollBar._updateLength()`가 핸들 길이를 트랙 높이(2px)에 비례시켜 1~2px로 깎는다. `view`의 Mask 밖이라 스크롤해도 안 따라 움직인다.
       - **모달 패널 배경이 사라진다** — 2×2짜리 `#111827` 스프라이트는 사실상 안 보인다. 통계가 순수 검정 위에 떠서, 아래 §4.4의 라벨 텍스처 현상이 눈에 띄기 시작한다.
       - **고치는 법:** `Sprite`의 `Size Mode`를 `CUSTOM`으로 바꾼 뒤, Widget 여백을 `Top=110 / Bottom=90 / Left=280 / Right=280`으로 되돌린다(Content Size가 `720 × 520`, Position이 `(0, −10)`이 되는지 확인). `scrollBar`와 그 자식 `bar`의 `Sprite` `Color` 알파가 `0`으로 저장돼 있으면 `255`로 올린다 — 런타임엔 `ScrollView`가 `ScrollBar.show()`로 되살리지만, 그 전까지 에디터에선 스크롤바가 안 보인다.
   - **ScrollView** 컴포넌트: `Horizontal`=off, `Vertical`=**on**, `Content`= 3번의 `StatsContent`(아래에서 연결), **`Elastic`=off**.
     - `Elastic`이 켜져 있으면 최상단에서 위로, 최하단에서 아래로 끌었을 때 **더 밀렸다가 튕겨 돌아오는 바운스**가 붙는다(`BounceDuration`으로 시간 조절). 이 화면은 통계 열람용이라 바운스를 끈다(2026-07-10 사용자 결정). `Inertia`(관성 감속)는 켠 채로 둔다.
2. **view** — ScrollView 생성 시 자동 생성되는 `view` 자식 사용(없으면 Node 추가 후 **Mask** 컴포넌트).
   - **Content Size를 `720 × 520`으로 직접 맞춘다** — 생성 직후엔 템플릿 기본값 `240 × 250`이라, 그대로 두면 Mask가 가운데 240×250만 남기고 나머지를 **잘라낸다**(통계가 좁은 창으로만 보임). Anchor는 기본 `(0.5, 0.5)` 유지.
   - **템플릿이 함께 만든 `view/content` 노드는 지운다.** 아래 3번의 `StatsContent`가 그 자리를 대신하며, 둘을 형제로 남겨 두면 안 된다.
3. **StatsContent** — `view` 아래 Node `StatsContent` + **Layout**.
   - Layout: `Type`=VERTICAL, `ResizeMode`=**CONTAINER**, `PaddingTop/Bottom`=12, `SpacingY`=10, `HorizontalDirection`/`VerticalDirection` 기본, 자식 정렬은 좌측(원하면 중앙).
   - Content Size 폭 `700`(높이는 CONTAINER가 자동 계산).
   - **Anchor `(0.5, 1)`, Position `(0, 260)`.** `view` Anchor가 `(0.5, 0.5)`라 Position Y는 `view` **중심** 기준이다. 따라서 콘텐츠 위쪽 변을 `view` 위쪽 변에 붙이려면 `view` 높이의 절반(520 ÷ 2 = **260**)을 줘야 한다. Y=0으로 두면 콘텐츠가 화면 한가운데서 시작해 위 절반이 빈다.
   - **1번의 ScrollView `Content`에 이 노드를 지정한다(필수).** 공식 문서상 ScrollView는 content 지정 없이는 동작하지 않는다 — 비워 두면 스크롤이 아예 안 된다. 조립 후 `Content` 칸이 비어 있지 않은지 반드시 확인.
4. **StatsContent 아래 라벨 5개 + 컨테이너 1개** — 아래 값으로 통일한다. 문자열은 전부 코드가 채우므로 초기 문자열은 비워 둔다.

   | 노드 | 컴포넌트 | Overflow | wrapText | 폭 | Font Size | Horizontal Align |
   |------|----------|----------|----------|-----|-----------|------------------|
   | `SurvivalLabel` | Label | RESIZE_HEIGHT | on | 700 | 26 | LEFT |
   | `LevelLabel` | Label | RESIZE_HEIGHT | on | 700 | 26 | LEFT |
   | `KillTotalLabel` | Label | RESIZE_HEIGHT | on | 700 | 26 | LEFT |
   | `KillListLabel` | Label | RESIZE_HEIGHT | on | 700 | 18 | LEFT |
   | `SpellListContent` | Node + **Layout**(VERTICAL, CONTAINER, SpacingY=8) | — | — | 700 | — | — |
   | `PassiveLabel` | Label | RESIZE_HEIGHT | on | 700 | 18 | LEFT |

   - **`Overflow`를 반드시 `RESIZE_HEIGHT`로 둔다.** 기본값 `NONE`이면 Label이 글자 길이에 맞춰 **Content Size를 스스로 줄여** 폭 700 설정이 무시된다. 그러면 노드 Anchor가 `(0.5, 0.5)`라 글자가 **가운데 정렬처럼 보이고**, 폭 700을 유지하는 다른 라벨(킬 목록·패시브)만 왼쪽에서 시작해 **줄마다 정렬이 어긋난다.**
   - Font Size는 목업(`../design/mockups/result-stats.html`) 비율에서 왔다 — 핵심 지표(생존·레벨·처치)가 크고, 목록성 텍스트(킬 종류별·패시브)는 작다. 헤더(`WaveLabel` 30)보다 크지 않아야 한다.
   - `SpellListContent`는 마법 행을 `ResultController`가 `spellRowPrefab`을 `instantiate`해 채우므로 에디터엔 **빈 컨테이너**만 둔다. 비어 있는 동안 Content Size 높이가 음수(−8)로 보이는 것은 정상이며, 런타임에 행이 붙으면 맞춰진다.
5. **SpellRow 프리팹 제작** — 아래 순서를 그대로 따른다. 세 함정(자식 중첩·루트 UITransform 누락·행 내부 Layout 누락)이 전부 조용히 실패하므로 주의.
   1. `Create → 2D Object → Node`로 `SpellRow`를 만든다. **`Create → Empty Node`를 쓰지 않는다** — 빈 노드는 `UITransform`이 없어서, 부모 `SpellListContent`의 Layout이 행 크기를 못 재 행들이 겹치거나 안 보인다.
   2. `SpellRow`의 Content Size 폭을 `700`으로 주고, **`Layout` 컴포넌트를 붙인다**: `Type`=VERTICAL, `ResizeMode`=**CONTAINER**, `SpacingY`=2, `PaddingTop/Bottom`=6. 높이는 CONTAINER가 자식에 맞춰 자동 계산하므로 직접 주지 않는다.
   3. `SpellRow`의 **직계 자식**으로 `Name`(Label, Font 20, **LineHeight 26**, **Overflow=RESIZE_HEIGHT**, `wrapText`=on, 폭 700, Horizontal Align=LEFT)을 만든다. 4번 표와 같은 이유로 `Overflow`를 `NONE`으로 두면 안 된다 — 라벨이 글자 폭(약 42px)으로 줄어들어 행 가운데에 뜬다.
   4. `SpellRow`의 **직계 자식**으로 `Breakdown`(RichText, **Font 20**, **LineHeight 26**, `maxWidth` **700**, Content Size 폭 700, Horizontal Align=LEFT, 초기 문자열 **비움**)을 만든다. **`Name`의 자식으로 넣지 않는다** — 아래 경고 참조.
      - **글씨가 흐릿하게 보이는 이유:** `RichText`는 시스템 폰트(Arial)로 세그먼트마다 `Label`을 만들어 그린다. 기본값이 `FontSize 16` + `LineHeight 40`이라 글자가 작고 줄 간격만 넓어, 프로젝트의 `fitHeight` 정책(디자인 높이 720)에서 브라우저 창이 720px보다 낮으면 화면 전체가 축소돼 작은 글자가 먼저 뭉갠다. 폰트를 20으로 올리고 줄 간격을 26으로 줄이면 또렷해진다. 최종 확인은 창 높이를 720px 이상으로 두고 본다.
   5. **프리팹으로 저장**하고 `ResultController.spellRowPrefab`에 연결한다.

   > **⚠️ `SpellRow`에 `Layout`이 없으면 두 자식이 겹친다.** 자식은 기본적으로 부모 중심 `(0, 0)`에 놓이므로, Layout이 없으면 `Name`과 `Breakdown`이 **같은 자리에 포개져** 마법 이름이 강화 브레이크다운 위에 얹힌다. 공식 문서상 `ResizeMode = CONTAINER`는 컨테이너를 자식에 맞춰 리사이즈하므로, 행 높이를 고정할 필요가 없다.

   > **⚠️ `Breakdown`은 반드시 `SpellRow`의 직계 자식이어야 한다.** `ResultController._renderSpells`가 `row.getChildByName('Name')`·`row.getChildByName('Breakdown')`으로 찾는데(위치 탐색 아님 — 리뷰 I2), `getChildByName`은 **직계 자식만** 검색한다. `Breakdown`을 `Name` 아래에 두면 조회가 `null`을 반환하고 `if (rich)` 가드에 걸려 **강화 브레이크다운이 통째로 렌더되지 않는다. 에러도 안 난다** — 마법 이름만 뜨고 데미지·쿨다운 줄이 사라진다. 두 자식 이름도 정확히 `Name`·`Breakdown`이어야 한다.
6. **`@property` 연결** — `result.scene`의 `Result` 노드(`ResultController` 보유)에 아래 5.1 표대로 노드·프리팹을 드래그해 연결.

### 4.3 RichText 색 규약 (마법 강화 브레이크다운, 확정 — `ResultController.TIER_COLOR`)

마법 행의 강화 줄은 RichText 한 개로 `(효과%) = 전역 + 분류 + 개별`를 렌더하되, 세 티어 값에 색 태그를 건다. ~~`Lv.N (효과%) = …`~~ → **의도적 제거**: 합계 `Lv.N`은 바로 옆의 `1 + 2 + 3`과 중복이라 뺐다 (2026-07-10 사용자 결정, result-stats).

| 티어 | 색 (hex) | 예 |
|------|----------|----|
| 전역 | `#94a3b8` (회색) | `<color=#94a3b8>1</color>` |
| 분류 | `#c084fc` (보라) | `<color=#c084fc>2</color>` |
| 개별 | `#34d399` (초록) | `<color=#34d399>3</color>` |

> 카테고리 틴트(화염 빨강·얼음 파랑·번개 노랑)와 겹치지 않게 고른 값이다. 패시브는 티어가 없어 색 브레이크다운 없이 `Lv.N` 단일.

### 4.4 라벨 뒤에 비치는 옅은 사각형 — 원인과 `Cache Mode` 대응

`SurvivalLabel`·`LevelLabel`·`KillTotalLabel` 같은 라벨 뒤에 **라벨 노드 사각형(폭 700) 전체를 덮는 아주 옅은 판**이 비친다. 라벨에 배경색 속성이 붙은 게 아니다. Cocos는 시스템 폰트 라벨을 **캔버스에 텍스트를 그려 텍스처로 올리는 방식**으로 렌더하는데, 그 캔버스를 흰색 알파 `1/255`로 한 번 전면 `fillRect`한다. 엔진 소스에 주석까지 그대로 있다: *"Add a white background to avoid black edges."* (`cocos/2d/assembler/label/font-utils.ts:120,195`, `text-processing.ts:511-517`). 검은 테두리 방지용 의도적 처리라 **인스펙터에서 끄는 스위치가 없고, 공식 문서에도 언급이 없다.**

판의 색은 `흰색 × 1/255 + 배경 × 254/255`, 즉 배경보다 정확히 **채널당 1만큼 밝다**. 검정 위 `(0,0,0) → (1,1,1)`, `#111827` 패널 위 `(17,24,39) → (18,25,40)`. 값은 미미하지만 **폭 700의 평면**이라 경계가 눈에 띈다.

**핵심은 "캔버스 한 장의 크기"다.** 공식 매뉴얼 [Label > Cache Mode](https://docs.cocos.com/creator/3.8/manual/en/ui-system/components/editor/label.html)가 세 모드를 이렇게 구분한다.

| Cache Mode | 공식 문서 설명 | 전면 채움이 덮는 범위 |
|------------|----------------|----------------------|
| `NONE` (기본) | "generating a bitmap for the **entire text**" | 라벨 노드 사각형 전체 (폭 700) |
| `BITMAP` | "also generates a bitmap for the **entire text**" + 다이내믹 아틀라스 병합 | 위와 같음 |
| `CHAR` | "caches text into a global shared bitmap **by characters**" | **글자 한 자의 셀** |

`CHAR`은 글자마다 별도 캔버스를 만든다 — `font-utils.ts`의 `LetterTexture._updateProperties()`가 캔버스 크기를 `글자 폭 + margin×2 + bleed`로 잡는다. 같은 `1/255` 채움이 들어가지만 범위가 글자 셀로 줄어들어 **폭 700짜리 판이 사라진다.** 글자 주위에 아주 좁은 셀 틴트만 남는다.

**`CHAR`의 제약(공식 문서)과 이 화면의 적합성:**

| 제약 | 이 화면 |
|------|---------|
| 고정 폰트 크기만 지원 | ✅ 라벨마다 고정 |
| `SHRINK` overflow 미지원 | ✅ 전부 `RESIZE_HEIGHT` |
| `IsBold`/`IsItalic`/`IsUnderline` 미지원 | ✅ 전부 off |
| 다이내믹 아틀라스 불참 | ✅ 결과 화면 드로우콜은 무시할 수준 |
| 전역 공유 비트맵 1024×1024, 씬 전환 시에만 초기화 | ✅ 등장 글자 수가 적다(통계 라벨 + 적·마법 이름) |

> 문서상 캐시 모드를 쓰려면 프로젝트 설정에 `RenderTexture` 모듈이 포함돼야 한다. 이 프로젝트는 `game/settings/v2/packages/engine.json`의 `includeModules`가 비어 있어(= 전 모듈 포함) 별도 조치가 필요 없다.

**완전히 0으로 만들려면 비트맵 폰트(BMFont)** 뿐이다. `bmfont` 어셈블러는 폰트 아틀라스를 직접 샘플링하므로 캔버스 채움 경로 자체를 타지 않는다([Fonts > Using font assets](https://docs.cocos.com/creator/3.8/manual/en/asset/font.html)). 다만 한글은 글리프 수가 많아 아틀라스가 무거워진다 — 결과 화면 하나 때문에 도입할 만한지는 별도 판단.

**권장 순서:** ① 라벨 6개 + `WaveLabel`의 `Cache Mode`를 `CHAR`로 바꿔 확인(인스펙터 1클릭, 되돌리기 쉽다) → ② 남는 셀 틴트가 거슬리면 BMFont 도입 여부를 결정하거나 `1/255` 차이를 감수한다.

---

## 5. 에디터 연결 체크리스트 (`ResultController` `@property`)

### 5.1 노드 매핑 (확정 — `ResultController` `@property` 기준)

| `@property` | 타입 | 연결 노드 | 상태 |
|-------------|------|-----------|------|
| `waveLabel` | Label | (기존) 결과 헤더 라벨 | ⬜ |
| `retryButton` | Button | (기존) RetryButton | ⬜ |
| `menuButton` | Button | (기존) MenuButton | ⬜ |
| `survivalLabel` | Label | `SurvivalLabel` | ⬜ |
| `levelLabel` | Label | `LevelLabel` | ⬜ |
| `killTotalLabel` | Label | `KillTotalLabel` | ⬜ |
| `killListLabel` | Label | `KillListLabel` | ⬜ |
| `spellListContent` | Node | `SpellListContent` | ⬜ |
| `spellRowPrefab` | Prefab | `SpellRow` 프리팹(에셋) | ⬜ |
| `passiveLabel` | Label | `PassiveLabel` | ⬜ |

> 필수 `@property` 미연결 시 `ResultController.onLoad`가 loud-fail(`console.error`로 누락 목록 출력 + 컴포넌트 비활성)한다(배선 누락이 조용히 새지 않게 — 백로그 F29 결, 리뷰 I1). 인게임에서 통계가 안 뜨면 콘솔의 `[ResultController] 필수 @property 미연결: …`를 먼저 확인한다.

`@property`는 `result.scene`의 **`Result` 노드**(`ResultController` 보유)에 연결한다. `main.scene`이 아니다.

### 5.2 조립 자가 점검 (인게임 테스트 전)

`@property` 연결과 달리 아래 항목은 **미설정이어도 에러가 안 나고 조용히 실패**한다. 실제로 이 다섯 곳에서 막혔으므로(2026-07-10 7단계) 인게임 테스트 전에 하나씩 눈으로 확인한다.

| 확인 | 잘못됐을 때 증상 | ✅/❌ |
|------|------------------|------|
| 노드가 `result.scene`의 `Canvas` 아래에 있다 (`main.scene`의 HUD 아래가 아니다) | 결과 화면에 통계가 안 뜨고, 대신 인게임 플레이 중 화면에 스크롤 뷰가 떠 있다 | ⬜ |
| `StatsScroll`의 `Sprite` 색이 `#111827`이다 (템플릿 기본 흰색 아님) | 흰 배경 위 흰 글씨라 통계가 거의 안 보인다 | ⬜ |
| `StatsScroll`의 `Sprite` `Size Mode` = `CUSTOM`, Content Size = `720 × 520` (Widget 여백 `280/280/110/90`) | 노드가 `2 × 2`로 찌그러진다 → 휠이 화면 정중앙에서만 먹고, 스크롤바가 한가운데 `_` 모양 가로줄로 뜨고, 모달 배경이 사라진다 (§4.2 1번) | ⬜ |
| `scrollBar`와 `scrollBar/bar`의 `Sprite` `Color` 알파가 `0`이 아니다 | 에디터에서 스크롤바가 안 보인다 (런타임은 `ScrollBar.show()`가 복구) | ⬜ |
| `Hierarchy` 최상위(`Canvas` 바깥)에 `SpellRow` 프리팹 인스턴스가 떨어져 있지 않다 | 렌더는 안 되지만 씬 파일에 불필요한 `PrefabInstance`가 커밋된다 — 프리팹은 `spellRowPrefab` **에셋 슬롯에만** 연결한다 | ⬜ |
| 라벨 6개 + `WaveLabel`의 `Cache Mode` = `CHAR` (§4.4) | 라벨 사각형(폭 700)만큼 배경보다 `1/255` 밝은 판이 비친다 | ⬜ |
| `SpellRow` 루트에 `Layout`(VERTICAL, CONTAINER)이 있다 | `Name`과 `Breakdown`이 둘 다 `(0, 0)`에 놓여 마법 이름이 브레이크다운 첫 줄 위에 겹친다 | ⬜ |
| `StatsScroll`의 ScrollView `Elastic` = off | 최상단·최하단에서 더 밀렸다가 튕겨 돌아온다 | ⬜ |
| `WaveLabel` `(0, 300)` · `RetryButton` `(−100, −310)` · `MenuButton` `(100, −310)` | 헤더·버튼이 스크롤 영역과 겹친다 | ⬜ |
| `StatsScroll`의 ScrollView `Content` = `StatsContent` (씬 파일에서는 `_content` 키) | 스크롤이 아예 동작하지 않는다 | ⬜ |
| `SpellRow`에 `Layout`(VERTICAL, CONTAINER)이 있고 `Name`의 `Overflow`가 `RESIZE_HEIGHT`다 | 마법 이름이 강화 브레이크다운 위에 겹쳐 행 가운데에 뜬다 | ⬜ |
| `view`의 Content Size = `720 × 520` (템플릿 기본 `240 × 250` 아님) | 통계가 화면 가운데 좁은 창으로만 보이고 나머지가 잘린다 | ⬜ |
| `StatsContent`의 Anchor = `(0.5, 1)`, Position = `(0, 260)` | 내용이 왼쪽으로 밀리거나 화면 한가운데서 시작해 위 절반이 빈다 | ⬜ |
| 라벨 5개의 `Overflow` = `RESIZE_HEIGHT` (기본 `NONE` 아님) | 위 세 줄만 가운데 정렬처럼 보이고 아래 두 줄은 왼쪽 정렬이라 어긋난다 | ⬜ |
| `SpellRow` 루트에 `UITransform`(`700 × 80`)이 있다 | 마법 행들이 겹치거나 아예 안 보인다 | ⬜ |
| `Breakdown`이 `SpellRow`의 **직계 자식**이다 (`Name`의 자식 아님) | 마법 이름만 뜨고 강화 브레이크다운 줄이 통째로 사라진다(에러 없음) | ⬜ |

---

## 6. 수동 테스트 체크리스트 (인게임 — 코드로 검증 불가)

한 판 플레이 → 사망 또는 승리(제한 시간 소진) → 결과 화면에서 확인.

- [ ] **생존 시간** — 실제 플레이 시간과 맞는다(mm:ss). 승리 시 = 게임 길이(`GameManager.gameDuration`, 현재 main 씬 직렬화 값 900초 → `15:00`).
- [ ] **도달 레벨** — 인게임 최종 레벨과 일치.
- [ ] **킬 총계 + 종류별** — 적 몇 종만 골라 잡고, 종류별 수·총계가 맞는지(총계 = 종류별 합). count 내림차순 정렬.
- [ ] **적 이름** — EN 모드에서도 한국어(처녀귀신 등, §2 OUT).
- [ ] **보유 마법** — 항목별 한 줄, 티어 오름차순(F1 → I3), `F1 파이어볼` 형태.
- [ ] **강화 브레이크다운** — 각 마법 아래 데미지·쿨다운이 `(효과%) = 전역+분류+개별`. 전역·분류 레벨은 여러 마법에 공유 표시(같은 값), 개별만 마법별. 세 값 색이 각각 다름(전역 회색·분류 보라·개별 초록). 강화를 하나도 안 골랐으면 `데미지 (+0%) = 0 + 0 + 0`.
- [ ] **최종 효과 %** — 강화한 마법에서 데미지 +%, 쿨다운 단축 −%가 실제 강화와 방향·크기 대략 일치.
- [ ] **전역 강화 상한** — 전역 강화 카드를 반복해서 뽑으면 상한 도달 후 그 옵션 전역 레벨이 더 안 오르고, 해당 전역 카드가 더 안 뜬다.
- [ ] **패시브** — 최대HP·이동속도·픽업이 `Lv.N (보너스)`로, 획득 횟수·값과 일치.
- [ ] **스크롤** — 통계가 화면을 넘치면 세로 스크롤되고, 넘친 부분은 view 밖에서 클립(숨김)된다. 헤더·버튼은 스크롤 안 됨(고정).
- [ ] **빈 케이스** — 킬 0/마법 0(초반 즉사)에서도 레이아웃이 깨지지 않는다(빈 리스트).
- [ ] **버튼** — RETRY→main, MENU→menu 정상.
