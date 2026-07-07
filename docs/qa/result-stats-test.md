# 결과 화면 런 통계 (result-stats) — QA·테스트 체크리스트

- **작성일:** 2026-07-07
- **브랜치:** feat/result-stats
- **계획:** `../development/sessions/2026-07-06-result-stats-plan.md`
- **목업:** `../decisions/result-stats.html` (색·스크롤·행 포맷)
- **성격:** 결과 화면(`ResultController`)에 생존·레벨·킬(종류별)·보유 마법(강화 레벨 브레이크다운)·패시브를 얹는다. 순수 조립은 `buildResultStats`(피처 테스트가 덮음), Cocos 의존부(스냅샷 실제 채움·registerKill·RichText 렌더·씬 전환)는 수동 QA.

> **잠정 태그 안내:** 아래 프리팹/씬·에디터 섹션의 `@property` 이름·노드·색값은 구현 전 계획 기준이라 `(잠정 …)`으로 단다. 구현 완료(GREEN) 직후 실제 컴포넌트에 맞춰 `(확정)`으로 바꾼다(코드가 정본, 이 문서가 그 거울). `pnpm wf check-qa` 게이트가 잠정 태그 잔존 시 `user-verification` 진입을 막는다.

---

## 1. 자동 테스트로 검증 (`tests/logic/ResultStats.test.ts`)

> **GREEN 시 갱신:** 아래 `[ ]`를 `[x]`로 바꾸고, 통과 근거(피처 N/N + 전체 스위트 M/M + 통과 커밋 SHA)를 이 머리에 기재한다. (현재 qa-setup — RED 상태: `ResultStatsLogic` 미존재로 import 실패.)

순수 함수 `buildResultStats(input, getSpell, getEnemy)` 조립을 덮는다.

- [ ] 생존 시간 포맷 — 600초 → `"10:00"`, 65초 → `"01:05"` (`formatTimer` 재사용)
- [ ] 도달 레벨 그대로 전달
- [ ] 킬 총계 = 표시된 종류별 킬의 합
- [ ] 킬 종류별을 count 내림차순 정렬 + 적 이름은 데이터(`getEnemy(id).name`)에서 (한국어 고정, §2 OUT)
- [ ] `getEnemy=null`인 킬은 리스트·총계에서 생략 (정합 가드)
- [ ] 마법 티어 라벨(`categoryInitial+티어`, 예 `F1`) + 이름 i18n 키(`spell.<id>.name`) 출력
- [ ] 보유 마법 티어 오름차순 정렬 (F1 → I3)
- [ ] `getSpell=null`인 마법은 생략 (정합 가드)
- [ ] 강화 브레이크다운: 옵션 순서 = 데미지 → 쿨다운
- [ ] 브레이크다운: `총합 = 전역 + 분류 + 개별`, 각 티어 레벨 그대로
- [ ] 데미지 최종 효과 % = `+(factor−1)` 반올림 (배율 2.0 → +100)
- [ ] 쿨다운 최종 효과 % = 단축 `−(1−1/factor)` 반올림 (배율 1.25 → −20)
- [ ] 미강화 마법 = 세 티어 0 + 효과 % 0
- [ ] 패시브 레벨·보너스 그대로 전달
- [ ] 빈 입력(킬 0·마법 0) → 빈 리스트·총계 0·생존 `"00:00"`

> **전역 상한(B2)·패시브 레벨 집계**는 각각 `EnhancementLogic`·`DeckLogic` 테스트(구현 시 확장)가 덮는다: 전역 레벨이 `GLOBAL_UPGRADE_CAP`에서 고정·maxed 전역 카드 제외 / `applyCard` N회 → 패시브 level N.

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

기존 결과 헤더(승/패 + 웨이브 = `waveLabel`)와 RETRY/MENU 버튼은 **고정**하고, 그 사이에 **세로 스크롤 통계 영역**을 새로 넣는다(목업 참조). 통계는 나중에 늘 수 있으므로 ScrollView로 둔다.

**추가 노드 요약**

| 노드 | 타입/컴포넌트 | 역할 |
|------|--------------|------|
| `StatsScroll` | Node + **ScrollView** | 세로 스크롤 컨테이너(Vertical=on, Content=StatsContent) |
| `StatsScroll/view` | Node + **Mask** | 보이는 영역 정의·클립(뷰 밖 숨김) |
| `StatsScroll/view/StatsContent` | Node + **Layout**(VERTICAL, ResizeMode=CONTAINER) | 자식 높이 합만큼 자동 확장 → 스크롤 대상 |
| ↳ `SurvivalLabel` | Label | "생존 시간  10:32" |
| ↳ `LevelLabel` | Label | "도달 레벨  Lv.14" |
| ↳ `KillTotalLabel` | Label | "처치  487" |
| ↳ `KillListLabel` | Label(Overflow=RESIZE_HEIGHT) | 종류별 킬 조인(여러 줄) |
| ↳ `SpellListContent` | Node + **Layout**(VERTICAL, ResizeMode=CONTAINER) | 마법 행 런타임 생성 부모(코드가 채움) |
| ↳ `PassiveLabel` | Label(Overflow=RESIZE_HEIGHT) | 패시브 3줄(최대HP·이동속도·픽업) |

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

### 4.2 만드는 순서 (좌표는 1280×720, Widget 앵커 기준)

1. **StatsScroll** — `Canvas` 우클릭 → Create → UI Component → **ScrollView**. 이름 `StatsScroll`.
   - **Widget** 추가: Top=110, Bottom=90, Left=280, Right=280 (헤더 아래 ~110px, 버튼 위 ~90px, 좌우 280px 여백 → 가시폭 ~720px). Align 4방향 on.
   - **ScrollView** 컴포넌트: `Horizontal`=off, `Vertical`=**on**, `Content`= 3번의 `StatsContent`(아래에서 연결), `Elastic`=on 권장.
2. **view** — ScrollView 생성 시 자동 생성되는 `view` 자식 사용(없으면 Node 추가 후 **Mask** 컴포넌트). Content Size는 StatsScroll에 맞춤(Widget Stretch 또는 부모 크기).
3. **StatsContent** — `view` 아래 Node `StatsContent` + **Layout**.
   - Layout: `Type`=VERTICAL, `ResizeMode`=**CONTAINER**, `PaddingTop/Bottom`=12, `SpacingY`=10, `HorizontalDirection`/`VerticalDirection` 기본, 자식 정렬은 좌측(원하면 중앙).
   - Anchor Y=1(위 기준), Position Y=0 → 위에서부터 아래로 쌓임. ScrollView `Content`에 이 노드를 지정.
4. **SurvivalLabel / LevelLabel / KillTotalLabel** — `StatsContent` 아래 Label 3개. Content Size 폭 ~700, Font Size 28, 좌측 정렬(값은 코드가 채움 — 초기 문자열 비워도 됨).
5. **KillListLabel** — Label, `Overflow`=**RESIZE_HEIGHT**, `wrapText`=on, 폭 ~700, Font Size 22. 종류별 킬을 코드가 여러 줄로 조인.
6. **SpellListContent** — Node + **Layout**(VERTICAL, ResizeMode=CONTAINER, SpacingY=8). 폭 ~700. **마법 행(이름 Label + 데미지·쿨다운 RichText)은 `ResultController`가 런타임 생성**하므로 에디터엔 빈 컨테이너만 둔다.
7. **PassiveLabel** — Label, `Overflow`=RESIZE_HEIGHT, 폭 ~700, Font Size 24. 최대HP·이동속도·픽업 3줄을 코드가 채운다.
8. **프리팹화 불필요** — 마법 행은 코드가 `Node`+`RichText`로 만든다(에디터 행 노드 없음). `SpellListContent`만 부모로 연결.
9. **`@property` 연결** — `Canvas`(또는 ResultController 보유 노드)의 `ResultController`에 아래 5.1 표대로 노드를 드래그해 연결.

### 4.3 RichText 색 규약 (마법 강화 브레이크다운) (잠정 — 색값 확정은 목업/디자인)

마법 행의 강화 줄은 RichText 한 개로 `Lv.N (효과%) = 전역 + 분류 + 개별`를 렌더하되, 세 티어 값에 색 태그를 건다.

| 티어 | 색 (hex) | 예 |
|------|----------|----|
| 전역 | `#94a3b8` (회색) | `<color=#94a3b8>1</color>` |
| 분류 | `#c084fc` (보라) | `<color=#c084fc>2</color>` |
| 개별 | `#34d399` (초록) | `<color=#34d399>3</color>` |

> 카테고리 틴트(화염 빨강·얼음 파랑·번개 노랑)와 겹치지 않게 고른 값이다. 패시브는 티어가 없어 색 브레이크다운 없이 `Lv.N` 단일.

---

## 5. 에디터 연결 체크리스트 (`ResultController` `@property`)

### 5.1 노드 매핑 (잠정 — `@property` 이름은 GREEN 후 코드 기준 확정)

| `@property` (잠정) | 타입 | 연결 노드 | 상태 |
|--------------------|------|-----------|------|
| `waveLabel` | Label | (기존) 결과 헤더 라벨 | ⬜ |
| `retryButton` | Button | (기존) RetryButton | ⬜ |
| `menuButton` | Button | (기존) MenuButton | ⬜ |
| `survivalLabel` (잠정) | Label | `SurvivalLabel` | ⬜ |
| `levelLabel` (잠정) | Label | `LevelLabel` | ⬜ |
| `killTotalLabel` (잠정) | Label | `KillTotalLabel` | ⬜ |
| `killListLabel` (잠정) | Label | `KillListLabel` | ⬜ |
| `spellListContent` (잠정) | Node | `SpellListContent` | ⬜ |
| `passiveLabel` (잠정) | Label | `PassiveLabel` | ⬜ |

> 필수 `@property` 미연결 시 `ResultController.onLoad`가 loud-fail(`console.error`)하도록 구현 예정(배선 누락이 조용히 새지 않게 — 백로그 F29 결).

---

## 6. 수동 테스트 체크리스트 (인게임 — 코드로 검증 불가)

한 판 플레이 → 사망 또는 20분 승리 → 결과 화면에서 확인.

- [ ] **생존 시간** — 실제 플레이 시간과 맞는다(mm:ss). 승리 시 = 게임 길이(20:00).
- [ ] **도달 레벨** — 인게임 최종 레벨과 일치.
- [ ] **킬 총계 + 종류별** — 적 몇 종만 골라 잡고, 종류별 수·총계가 맞는지(총계 = 종류별 합). count 내림차순 정렬.
- [ ] **적 이름** — EN 모드에서도 한국어(처녀귀신 등, §2 OUT).
- [ ] **보유 마법** — 항목별 한 줄, 티어 오름차순(F1 → I3), `F1 파이어볼` 형태.
- [ ] **강화 브레이크다운** — 각 마법 아래 데미지·쿨다운이 `Lv.N (효과%) = 전역+분류+개별`. 전역·분류 레벨은 여러 마법에 공유 표시(같은 값), 개별만 마법별. 세 값 색이 각각 다름(전역 회색·분류 보라·개별 초록).
- [ ] **최종 효과 %** — 강화한 마법에서 데미지 +%, 쿨다운 단축 −%가 실제 강화와 방향·크기 대략 일치.
- [ ] **전역 강화 상한** — 전역 강화 카드를 반복해서 뽑으면 상한 도달 후 그 옵션 전역 레벨이 더 안 오르고, 해당 전역 카드가 더 안 뜬다.
- [ ] **패시브** — 최대HP·이동속도·픽업이 `Lv.N (보너스)`로, 획득 횟수·값과 일치.
- [ ] **스크롤** — 통계가 화면을 넘치면 세로 스크롤되고, 넘친 부분은 view 밖에서 클립(숨김)된다. 헤더·버튼은 스크롤 안 됨(고정).
- [ ] **빈 케이스** — 킬 0/마법 0(초반 즉사)에서도 레이아웃이 깨지지 않는다(빈 리스트).
- [ ] **버튼** — RETRY→main, MENU→menu 정상.
