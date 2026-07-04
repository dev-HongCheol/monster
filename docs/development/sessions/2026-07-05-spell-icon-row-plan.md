# HUD 마법 아이콘 행 (J4 P0-2) — 구현 계획

- **작성일:** 2026-07-05
- **브랜치:** feat/spell-icon-row
- **성격:** 기능 개발 계획. `/office-hours` 설계 + `/autoplan` 집중 리뷰(Codex 미설치 → 단일 리뷰어) + 사용자 방향 조정을 반영해 확정.
- **정본 연결:** `docs/design/ui-completeness-plan.md` §4 P0-2, `docs/development/backlog.md` 테마 J, [[project_v1_completeness_pivot]]

---

## 1. 배경과 목적

마법·적을 동결하고 완성도로 축을 옮긴 v1 방향 전환(로드맵 v0.3)의 UI 트랙에서, 코어 루프 완성감을 채우는 P0 항목 중 하나가 "보유 마법 아이콘 행"이다. 지금 HUD는 HP·XP 바(승격 완료, hud-layout #50)와 웨이브·타이머·레벨 라벨만 보여줄 뿐, **플레이어가 자기 빌드를 눈으로 확인할 방법이 없다.** 뱀파이어 서바이버즈류에서 보유 무기 행은 화면에서 가장 자주 보는 요소다. 이 슬라이스는 마법 슬롯(정원)을 HUD에 상시 표시하고, 보유 마법을 분류색 placeholder + 티어 라벨로 채워 그 공백을 메운다.

최종 아이콘 아트는 로드맵상 아트 단계(7-9주)에 나오므로, 이 슬라이스는 **구조와 로직을 placeholder로 먼저 완성**하고 아이콘 스프라이트만 나중에 교체한다. 티어 라벨(F1)은 아트가 나와도 유지되는 식별 라벨이다.

## 2. 스코프

### IN (이번 슬라이스)
- HUD에 마법 슬롯 정원 표시 — **`MAX_SLOTS`(현재 6)개 프레임을 항상 보이게**, 슬롯 프리팹을 런타임 인스턴스화. `MAX_SLOTS`만 바꾸면 보이는 칸 수가 따라 변한다(에디터 손 안 댐).
- 보유 마법이 **티어 오름차순**으로 앞칸부터 채움. 남는 칸은 빈 프레임(placeholder).
- 채운 칸 = 분류색 placeholder + **분류 이니셜 + 티어 라벨(F1·I2)**. 빈 칸 = 흐린 빈 프레임.
- 보유·정렬 변경(카드 픽) 시 행 재빌드.
- 순수 로직 seam: 보유 id + 데이터 → 슬롯 배열(티어 정렬·라벨·빈칸 패딩) 빌드.

### OUT (후속/이월)
- **호버 툴팁**(마법 이름 + 개별/분류/전역 강화 브레이크다운, 예 발사체 1+3+2=6) — 마우스 enter/leave + 툴팁 패널이 붙는 별도 작업. 후속 슬라이스 또는 일시정지 메뉴(P0-3)에서 강화 상세를 연다. **이번 슬라이스는 여기까지 안 건드림**(사용자 확정: "구현범위 불변").
- **쿨다운 라디얼**(발사 후 회색 시계형) — Approach C. `FireSchedulerLogic` per-spell 쿨다운 배관 필요. hud-layout 후속 ① 완결.
- **최종 마법 아이콘 아트** — 아트 단계 스프라이트 교체.
- **패시브 아이템 아이콘 행** — 별개 요소.

## 3. 이 슬라이스가 닫는 백로그 항목

- **J4 P0-2** (ui-completeness-plan) — 보유 마법 아이콘 행. 이 슬라이스가 슬롯 정원 + 티어 라벨 부분을 닫는다.
- **hud-layout 후속 ①**(스킬 그리드) 중 슬롯 표시 부분. 쿨다운 라디얼·호버 강화표시는 후속으로 남긴다(OUT).

## 4. 설계

### 4.1 슬롯 모델 (동적 정원)

- **정원 = `MAX_SLOTS`**(LoadoutLogic 단일 출처, 현재 6). HUD가 로드 시 슬롯 프리팹을 `MAX_SLOTS`개 인스턴스화해 컨테이너에 붙인다. `MAX_SLOTS` 상수만 바꾸면 로드아웃 정원과 표시 칸이 함께 변한다(밸런스 튜닝 시 에디터 무변경).
- **채움 규칙:** 보유 마법을 티어 오름차순 정렬해 앞칸부터 채우고, 나머지 칸은 빈 프레임. 새 마법 습득 시 티어 위치에 삽입되며 뒤로 밀린다.

### 4.2 라벨·정렬

- **아이콘 라벨 = 분류 이니셜 + 티어.** 분류 이니셜: fire→F, ice→I, lightning→L, support→S. 티어는 `ISpellData.tier`(1~4). 예: fireball=F1, ice_missile=I1, lightning_bolt=L1, inferno=F2, frost_nova=I3. (아트가 나와도 유지되는 식별 라벨.)
- **정렬 = 티어 오름차순**, 동률은 **획득 순서**(입력 순서 보존 = 안정 정렬). 원하면 후속에서 분류순 등으로 조정 가능.
- 강화 상태(개별/분류/전역)는 이 슬라이스에서 아이콘에 표시하지 않는다 — 호버/일시정지(OUT)에서 연다. 즉 **`Lv{픽수}` 배지는 없앤다**(앞선 레벨 정의 taste 결정은 폐기).

### 4.3 데이터 흐름

```
SpellCaster.instance.loadout.spells   (보유 마법 id[] — 이미 public getter)
        │  각 id → DataManager.getSpell(id) → { category, tier }
        ▼
  buildSpellIconRow(ownedIds, getSpell, MAX_SLOTS)   ← 순수 함수
    · getSpell(id)=null 인 id 생략(정합성 가드, F4류)
    · 티어 오름차순(안정) 정렬
    · 각 → { id, colorRgb: spellCategoryColor(category), label: initial+tier }
    · 길이 MAX_SLOTS로 빈칸(null) 패딩
        ▼  (SpellIconSlot | null)[]  (length = MAX_SLOTS)
  HudController가 슬롯 노드[i]에 적용:
    slot != null → active, Sprite 틴트 = colorRgb, Label = label
    slot == null → 빈 프레임(흐린 테두리, 라벨 비움)
```

### 4.4 아키텍처 (신규/변경)

```
[신규] logic/SpellIconRowLogic.ts (순수, cc import 없음)
  - categoryInitial(category): string          ← F/I/L/S
  - buildSpellIconRow(ownedIds, getSpell, maxSlots): (SpellIconSlot | null)[]
      SpellIconSlot = { id: string; colorRgb: readonly [number,number,number]; label: string }
      · null = 빈 슬롯

[변경] ui/HudController.ts
  - @property(Prefab) spellSlotPrefab            (슬롯 1칸 프리팹)
  - @property(Node)   spellSlotContainer         (슬롯들이 붙는 부모, 가로 레이아웃)
  - onLoad: MAX_SLOTS개 슬롯 인스턴스화 + 초기 빌드
  - _handleStateChange: LevelUp→Playing 전환 시 _rebuildSpellRow() (카드 픽에서만 변함 → 프레임 폴링 불필요)
  - _rebuildSpellRow(): buildSpellIconRow(...) 결과를 슬롯 노드에 매핑

[재사용] logic/SpellVisual.spellCategoryColor · ui/Theme(SIZES.SKILL_SLOT·COLORS·FONT) · LoadoutLogic.MAX_SLOTS

[정정] SpellCaster.loadout·EnhancementLogic.getLevel 모두 이미 public — 신규 getter 불필요.
       레벨 파생(individualLevel)은 이 슬라이스에서 불필요(강화 표시가 OUT) — 호버/일시정지 슬라이스로 이월.
```

### 4.5 노드 구조 (씬 — 7단계 에디터)

- 슬롯 프리팹 1종: 분류색 Sprite(placeholder 박스) + 티어 Label + 빈칸용 테두리. HUD가 `MAX_SLOTS`개 복제.
- 슬롯 컨테이너: 가로 배치(Layout), hud-layout 목업(`docs/decisions/hud-layout.html`)의 스킬 그리드 자리.

## 5. 리뷰 요약 (autoplan 집중 리뷰 — Codex 미설치, 단일 리뷰어 + 사용자 조정)

### CEO/스코프
- 올바른 문제(장르 코어·저비용·고가시성, v1 완성도 P0 정렬). 6개월 후회 리스크 낮음 — placeholder 슬롯 구조 + 순수 빌드는 아트·쿨다운·호버 후속에 그대로 재사용. 강화 상세 표시를 호버/일시정지로 뺀 건 스코프를 작게 유지하는 합리적 분리.

### Design
- **정원 표시:** 미보유 상태에서도 `MAX_SLOTS`칸을 빈 프레임으로 보여 "쓸 수 있는 슬롯 수"를 전달(사용자 요구). 빈/채움 대비는 `Theme.COLORS`(PLACEHOLDER_BORDER vs 분류색).
- **같은 분류 구분:** 색만으론 같은 분류 마법이 안 구분됨 → 티어 라벨(F1/F2)이 구분자 겸 식별자. 현재 로스터는 분류 내 티어가 유일해 충돌 없음(fire: F1·F2, ice: I1·I3).
- 상태별 레이아웃: 고정 `MAX_SLOTS` 프레임 + 티어순 채움으로 정렬 흔들림 방지.

### Eng
- **정정:** 설계 문서의 "loadout getter 추가"는 오기(이미 public). 배관 축소.
- 아키텍처 건전 — 슬롯 빌드(정렬·라벨·빈칸 패딩)를 순수 로직으로 뽑아 HudController는 노드 매핑만. 기존 `_handleStateChange` 패턴 준수.
- **동적 슬롯:** 프리팹 인스턴스화로 `MAX_SLOTS` 튜닝을 에디터 무변경으로 흡수(사용자 요구). 런타임 인스턴스화는 로드 1회라 성능 무영향.
- **엣지 케이스:** ① 보유 0 → 전부 빈 프레임, ② 보유 > MAX_SLOTS(캡으로 불가하나 슬라이스로 클램프), ③ `getSpell(id)=null` → 그 id 생략, ④ 티어 동률 → 안정 정렬로 순서 보존.
- 성능: 카드 픽 시에만 재빌드(프레임 폴링 없음) — 무해.

## 6. 테스트 전략

- **피처 테스트 `tests/logic/SpellIconRow.test.ts`** (RED→GREEN):
  - `categoryInitial`: fire→F / ice→I / lightning→L / support→S.
  - `buildSpellIconRow`: 빈 보유 → 길이 MAX_SLOTS 전부 null / 1개 → 1칸 채움+나머지 null / 티어 오름차순 정렬(F2가 I1보다 뒤) / 동률 안정 정렬 / `getSpell=null` id 생략 / 라벨 = initial+tier / 보유 > maxSlots 클램프.
- **Cocos 의존부**(슬롯 프리팹 인스턴스화·틴트·라벨·빈칸, 상태 전환 재빌드)는 순수 로직 밖 → 수동 QA. 순수 빌드 로직은 위 피처 테스트가 덮으므로 전체 스킵 아님.
- wf 파일명 규칙: 피처 PascalCase = `SpellIconRow` ([[project_wf_test_filename]]).

## 7. QA·에디터 (7단계용 — 상세는 qa 문서)
- 신규 슬롯 프리팹(분류색 Sprite + 티어 Label + 빈칸 테두리) 제작 + 슬롯 컨테이너(가로 Layout) 배치 + `HudController.spellSlotPrefab`·`spellSlotContainer` 연결.
- 인게임: 시작 시 6칸 중 1칸에 파이어볼 F1 + 5칸 빈 프레임 → 마법 추가 픽 → 티어순으로 칸 채워지고 분류색·티어 라벨 구분 확인 → `MAX_SLOTS` 값 변경 시 칸 수 변화 확인(선택).

## 8. 열어 두는 후속 (백로그 반영)
- 호버 툴팁 + 강화 브레이크다운(개별/분류/전역) — 이 슬라이스 슬롯 노드 위에 얹음. 일시정지 메뉴(P0-3)와 함께 닫을 후보.
- 쿨다운 라디얼(Approach C) — hud-layout 후속 ① 완결.
- 최종 마법 아이콘 아트 — 아트 단계 값 교체.
