# 일시정지 메뉴 (J4 P0-3) — 구현 계획

- **작성일:** 2026-07-06
- **브랜치:** feat/pause-menu
- **성격:** 기능 개발 계획. `/office-hours`로 스코프 3건을 확정하고 `/autoplan` 집중 리뷰(Codex 미설치 → 단일 리뷰어)를 반영해 확정.
- **정본 연결:** `docs/design/ui-completeness-plan.md` §4 P0-3, `docs/development/backlog.md` 테마 J4 · I3, [[project_v1_completeness_pivot]]

---

## 1. 배경과 목적

마법·적 콘텐츠를 동결하고 개발 축을 완성도로 옮긴 v1 방향 전환(로드맵 v0.3)의 UI 트랙에서, 코어 루프 완성감을 채우는 P0 항목 중 하나가 "일시정지 메뉴"다. 지금 게임은 상태가 `Playing`·`LevelUp`·`GameOver`·`Victory` 넷뿐이고 **플레이어가 스스로 게임을 멈출 방법이 없다.** 화장실을 가든 전화를 받든 20분 런을 중간에 세울 수가 없고, 재시작이나 메뉴 복귀도 죽어야만 닿는다. 일시정지 메뉴는 호드 서바이벌 장르에서 사실상 필수 요소이며(ui-completeness-plan §3-C), 이 슬라이스는 ESC로 여는 수동 일시정지 상태와 Resume·재시작·메뉴 3버튼 모달을 붙여 그 공백을 메운다.

함께, 일시정지 오버레이가 카드 선택 패널과 같은 전체 화면 모달이라 백로그 **I3**(정지한 발사체가 UI 위로 렌더돼 가리는 레이어 버그)가 이 화면에서 그대로 재노출된다. 얼어붙은 발사체가 일시정지 메뉴를 덮으면 화면이 고장 난 것처럼 보이므로, 이 슬라이스에서 I3를 함께 닫는다.

## 2. 스코프

세 갈래의 스코프 결정을 `/office-hours`에서 사용자와 확정했다(2026-07-06).

### IN (이번 슬라이스)
- **`Paused` 상태 신설** — `GameState` enum에 `Paused`를 추가한다. 기존 모든 게임 시스템이 이미 `state !== Playing` 가드로 멈추므로(`GameManager.update`·`WaveManager`·`EnemyController`·`Projectile`·`EnemyProjectile`·`SpellCaster`·`PlayerController`), 상태만 `Paused`로 바꾸면 전장이 통째로 얼어붙는다. `director.pause()`를 쓰지 않는 기존 소프트 일시정지 방식(LevelUp과 동일)을 그대로 따른다.
- **ESC 토글** — ESC 키로 `Playing ↔ Paused`를 오간다. 상태 전이는 `enterPause()`/`resumePause()`를 `GameManager`에 신설하되, 기존 `enterLevelUp()`/`resumeFromLevelUp()` 쌍과 같은 패턴(가드 → 상태 세팅)으로 만든다.
- **모달 오버레이 3버튼** — 흐린 배경(딤) + "일시정지" 타이틀 + **Resume · 재시작 · 메뉴** 버튼. 재시작은 `GameManager.restart()`, 메뉴는 `GameManager.goToMenu()`를 **그대로 재사용**한다(둘 다 이미 존재하며 게임오버에서 쓰인다). Resume은 `resumePause()`.
- **I3 레이어 수정** — 정지한 게임 월드 노드(발사체·적)가 UI 오버레이(카드 패널·일시정지 패널) 아래로 렌더되게 한다. 뿌리 원인은 아래 §4.5에서 다루며, 구현은 씬을 열어 조사부터 한다.
- **일시정지 중 XP 흡수 차단 (I2)** — 일시정지 중에는 XP가 흡수되면 안 된다(사용자 확정 2026-07-06). `XPItemController.update` 맨 앞에 `state !== Playing` 가드를 더해 흡수를 막는다. 같은 가드가 LevelUp 중 흡수도 함께 닫는다(§4.6).

### OUT (후속/이월)
- **설정 화면** — 볼륨(마스터·BGM·SFX)·언어 토글. **오디오 시스템(J6)이 아직 없어 볼륨이 제어할 대상이 없다.** 설정은 P1-6 별도 슬라이스로, 사운드 구현 뒤에 연다. 이번 일시정지 메뉴에는 설정 버튼을 넣지 않는다(사용자 확정: "설정 제외, 3버튼만").
- **호버 툴팁 + 강화 브레이크다운** — 보유 마법 아이콘에 마우스를 올리면 개별/분류/전역 강화 상세(예 발사체 1+3+2=6)를 여는 기능. spell-icon-row 계획 §8이 이 슬라이스와 함께 닫을 후보로 지목했으나, 호버 상호작용 + 툴팁 패널 + 강화 수치 포맷이 별개 작업량이라 이월한다(사용자 확정: "이월").
- **일시정지 중 세이브/설정 저장·확인 다이얼로그** — 메타·세이브(J3/P1)와 함께.

## 3. 이 슬라이스가 닫는 백로그 항목
- **J4 P0-3** (ui-completeness-plan) — 일시정지 메뉴. 이 슬라이스가 `Paused` 상태 + Resume·재시작·메뉴 부분을 닫는다(설정 진입은 P1-6로 남김).
- **I3** (백로그 I) — 정지한 발사체가 전체 화면 오버레이 위로 렌더돼 가리는 레이어 버그. 일시정지 오버레이가 같은 모달이라 함께 닫는다.
- **I2** (백로그 I) — `XPItemController.update`가 일시정지 중 픽업 반경 내 XP를 흡수하는 미가드. **일시정지 중 흡수 금지가 사용자 확정 요구사항이므로 이 슬라이스에서 닫는다**(§4.6). 같은 가드가 LevelUp 중 흡수도 함께 닫는다.

## 4. 설계

### 4.1 상태 모델 (`Paused` 신설)

`GameState`에 `Paused`를 더한다. 핵심은 **기존 가드 재사용**이다 — 모든 update 루프가 `if (state !== GameState.Playing) return`으로 멈추므로, `Paused`도 `LevelUp`처럼 자동으로 전장을 얼린다. 새 프리즈 배관이 필요 없다.

```
enum GameState { Playing, LevelUp, GameOver, Victory, Paused }  // Paused 추가
```

### 4.2 ESC 토글

ESC의 동작은 현재 상태에 따라 갈린다. 이 분기를 순수 함수로 뽑아 테스트로 잠근다(§6).

```
pauseToggleAction(state):
  Playing → 'pause'     // enterPause()
  Paused  → 'resume'    // resumePause()
  그 외    → 'ignore'    // LevelUp(카드 선택)·GameOver·Victory 중 ESC 무시
```

카드 선택(LevelUp) 중 ESC가 "일시정지 위에 일시정지"를 걸지 않는 것이 핵심 엣지다 — `'ignore'`로 막는다. `enterPause()`도 `if (state !== Playing) return` 가드를 둬 이중 안전장치를 건다(기존 `enterLevelUp`과 동일).

### 4.3 오버레이 토글

상태가 `Paused`로 바뀌면 일시정지 패널을 `active = true`, 벗어나면 `false`로 켜고 끈다. 이는 `HudController._handleStateChange`가 `LevelUp`에서 `cardSelectPanel.active`를 토글하는 패턴과 동일하다. 딤 배경 노드는 전체 화면을 덮어 아래 게임으로 가는 클릭을 막는다(표준 모달).

### 4.4 아키텍처 (신규/변경)

```
[신규] logic/PauseMenuLogic.ts (순수, cc import 없음)
  - pauseToggleAction(state: GameState): 'pause' | 'resume' | 'ignore'

[변경] data/GameTypes.ts
  - GameState enum에 Paused 추가

[변경] systems/GameManager.ts
  - enterPause(): Playing일 때만 state=Paused (enterLevelUp 미러)
  - resumePause(): Paused일 때만 state=Playing (resumeFromLevelUp 미러, HP 보너스 로직 없음 — 순수 재개)

[신규] ui/PauseController.ts (Cocos 컴포넌트)
  - onLoad: input.on(KEY_DOWN) 등록 (PlayerController 패턴), 패널 active=false 초기화
  - onDestroy: input.off (씬 재로드 누수 방지)
  - _onKeyDown(ESC): pauseToggleAction(state) → enterPause()/resumePause()/무시
  - update 또는 상태 감시: state===Paused → 패널 active 토글 (HudController._handleStateChange 미러)
  - 버튼 핸들러: Resume→resumePause(), 재시작→GameManager.restart(), 메뉴→GameManager.goToMenu()

[변경] main.scene (7단계 에디터)
  - UICanvas 아래 PausePanel(딤 배경 + "일시정지" 타이틀 + 버튼 3개)
  - PauseController 컴포넌트 + @property 배선(패널·버튼)

[변경] i18n 카탈로그 (ko.json / en.json)
  - pause.title / pause.resume / pause.restart / pause.menu 키 추가

[변경] components/XPItemController.ts
  - update 맨 앞에 state !== Playing 가드 + GameManager/GameState import (I2, §4.6)

[I3 수정] 씬 카메라/레이어/부모 설정 (§4.5)

[재사용] GameManager.restart()·goToMenu(), 기존 state 가드 프리즈, ui/Theme(COLORS·FONT·SIZES), i18n t()
```

### 4.5 I3 — 발사체가 UI 위로 렌더되는 레이어 버그

**관측된 현상:** 발사체가 일시정지(과거엔 카드 선택)로 화면에 멈춰 서면, 발사체가 UI 패널보다 **위**에 그려져 텍스트·버튼을 가린다(projectile-pause-guard 7단계 테스트에서 노출).

**뿌리 원인 방향:** 게임 월드 노드는 게임 Canvas 계열에 붙는다 — 적·적 발사체는 `EnemySpawner._canvas = playerNode.parent`(게임 Canvas)에, 플레이어 발사체·VFX는 `SpellCaster.bulletParent`(에디터 지정 노드)에 부착된다. 씬에는 `UICanvas` + `UICamera`(priority 1)가 있고 카드 패널·HUD가 그 아래 있다. 정상이라면 UI 카메라(priority 1)가 게임 카메라 뒤에 그려져 위로 올라와야 하는데 그렇지 않으므로, **발사체 부모 노드가 어느 Canvas·카메라·Layer로 해석되는지**를 씬에서 확인해 게임 월드가 UI 아래로 가게 맞춘다(부모 재지정 / Layer 정정 / 카메라 priority·visibility 조정 중 실제 원인에 맞는 것).

**접근:** 코드로 형태를 확정하지 않고, **구현 첫 작업으로 씬을 열어 카메라·Layer·부모를 조사**한다(H1 card-layer-fix가 깐 두-Canvas 구조 위에서). 조사 결과에 따라 수정 지점이 씬 설정이면 QA 문서에 에디터 절차로, 코드면 해당 시스템에 반영한다. 이 항목이 예상보다 커지면(별도 카메라 재설계 수준) 사용자와 재상의해 분리한다.

### 4.6 I2 — 일시정지 중 XP 흡수 차단 (확정)

일시정지 중에는 XP가 흡수되면 안 된다(사용자 확정 2026-07-06). 지금 `XPItemController.update`(`:51`)는 `_absorbed`·`playerNode`만 보고 거리로 흡수를 판정하며 상태 가드가 없어, 일시정지 중 픽업 반경 안에 든 XP가 그대로 빨려 들어간다. `Projectile`·`EnemyProjectile`이 projectile-pause-guard(I1)에서 받은 것과 동일한 패턴으로, `update` 맨 앞에 `if (GameManager.instance.state !== GameState.Playing) return;`를 더하고 `GameManager`·`GameState`를 import한다(약 3줄). 이 가드는 `Paused`뿐 아니라 `LevelUp` 중 흡수도 함께 막는다(둘 다 non-Playing). 순수 시맨이 없어(Cocos 상태·노드 위치 의존) 검증은 수동 QA로 한다.

## 5. 리뷰 요약 (/autoplan 집중 리뷰 — Codex 미설치, 단일 리뷰어)

### CEO/스코프
- 올바른 문제다. 일시정지는 장르 표준 필수 요소이고 v1 완성도 P0에 정렬한다. 저비용·고빈도(런 중 언제든 닿는 화면). 6개월 후회 리스크 낮음 — `Paused` 상태 + 모달 오버레이 구조는 설정 화면(P1-6)·향후 인터럽트 UI에 그대로 재사용된다.
- 스코프 분리가 합리적이다. 설정은 오디오(J6) 선행이라 빼는 게 맞고, 호버 툴팁은 별개 작업량이라 이월이 타당하다. I3 포함은 정당하다 — 오버레이가 그 버그를 재노출하고, 발사체에 덮인 모달은 고장으로 보인다.
- **재사용 강함:** `restart()`·`goToMenu()`(GameManager), state 가드 프리즈, `_handleStateChange` 오버레이 토글 패턴(HudController), `input.on(KEY_DOWN)` 패턴(PlayerController), Theme, i18n. 새로 만드는 건 얇은 상태 전이 2개 + 컨트롤러 1개 + 순수 토글 결정 함수뿐.

### Eng
- **아키텍처 건전.** `Paused` enum + `enterPause`/`resumePause`가 기존 LevelUp 쌍을 그대로 미러한다. 소프트 일시정지(가드 기반)라 프리즈 배관을 새로 안 짠다.
- **엣지 케이스:** ① 카드 선택(LevelUp) 중 ESC → `'ignore'`로 이중 일시정지 차단(가장 중요). ② GameOver/Victory 중 ESC → 무시. ③ ESC 리스너는 `onLoad` 등록·`onDestroy` 해제로 씬 재로드 누수 방지. ④ 재시작·메뉴는 `loadScene`이라 `Paused` 상태에서 눌러도 씬이 재구축돼 문제없음(별도 resume 불필요). ⑤ I2(XP 흡수)는 LevelUp과 동일한 기존 동작 — §4.6에서 함께 닫기 권장.
- **최대 불확실성 = I3 뿌리 원인.** 씬 카메라/Layer/부모 조사가 선행이며 크기가 아직 미정. 조사 우선·필요 시 분리로 관리(§4.5).
- **테스트 시맨:** 상태 전이는 Cocos `GameManager`에 있어 순수 밖이지만, **ESC 토글 결정(`pauseToggleAction`)은 순수 함수로 뽑을 값이 있다** — 상태별 분기(특히 LevelUp 중 무시)는 잠글 만한 correctness다. 따라서 **테스트 스킵이 아니라** 얇은 순수 결정 함수 + 피처 테스트를 쓴다(§6).

### Design (UI 스코프)
- **정보 위계:** "일시정지" 타이틀 → Resume(주 동작) → 재시작 → 메뉴. 딤 배경으로 "멈춤"을 전달하고 아래 게임 클릭을 막는다.
- **모달 상태:** 배경은 전체 화면을 덮어 입력을 가로채야 한다(표준 모달). 버튼은 Theme 색·폰트, 라벨은 i18n `pause.*` 키.
- **상호작용:** ESC로 열고 ESC로 닫는(재개) 관례를 따른다. 버튼 hover/press 폴리시는 비주얼 시스템(`/design-review`) 몫 — 이 슬라이스는 동작까지.
- I3 수정이 있어야 이 모달이 실제로 모달로 보인다(발사체가 위에 안 뜸).

### 타세(taste) 결정 — 계획 승인 시 조정 가능
- **전용 `PauseController` vs 기존 컴포넌트에 병합:** 단일 책임(ESC 리스너 + 오버레이 토글 + 버튼 핸들러)이라 전용 `PauseController`를 권장한다. `CardSelectPanel`이 별도 컴포넌트인 것과 같은 결. (Explicit over clever.)

## 6. 테스트 전략

- **피처 테스트 `tests/logic/PauseMenu.test.ts`** (RED→GREEN):
  - `pauseToggleAction`: `Playing → 'pause'` / `Paused → 'resume'` / `LevelUp → 'ignore'`(카드 선택 중 ESC 무시) / `GameOver → 'ignore'` / `Victory → 'ignore'`.
- **Cocos 의존부**(상태 전이 실제 적용, ESC 입력 배선, 오버레이 토글, 버튼 → restart/goToMenu, I3 레이어)는 순수 로직 밖 → 수동 QA. 순수 토글 결정은 위 피처 테스트가 덮으므로 **전체 스킵 아님**.
- wf 파일명 규칙: 피처 PascalCase = `PauseMenu` ([[project_wf_test_filename]]).

## 7. QA·에디터 (7단계용 — 상세는 qa 문서)
- UICanvas 아래 PausePanel(딤 배경 + "일시정지" 타이틀 + Resume·재시작·메뉴 버튼) 제작 + `PauseController` 배선(패널·버튼 `@property`).
- **I3 조사·수정:** 씬에서 발사체/적 부모 노드의 Canvas·카메라·Layer를 확인해 게임 월드가 UI 아래로 그려지게 맞춘다.
- 인게임: 플레이 중 ESC → 전장 정지 + 메뉴 표시, ESC 다시/Resume → 재개. 적·발사체·타이머·XP가 모두 얼었는지 확인. 재시작·메뉴 버튼 동작. **카드 선택 중 ESC 무시**. 일시정지 오버레이가 얼어붙은 발사체에 안 가려짐(I3).
- **I2 확인:** XP 오브를 픽업 반경 안에 둔 채 ESC로 일시정지 → 흡수되지 않음(레벨·XP 바 불변). 재개하면 다시 흡수됨. LevelUp(카드 선택) 중에도 흡수 없음.

## 8. 열어 두는 후속 (백로그 반영)
- 설정 화면(P1-6) — 볼륨·언어. 오디오(J6) 선행. 일시정지 메뉴에 설정 진입 버튼을 그때 추가.
- 호버 툴팁 + 강화 브레이크다운 — spell-icon-row 슬롯 노드 위에 얹음. 일시정지/도감과 함께 닫을 후보.
- 레벨업 카드 폴리시(P0-5) — 등급색·아이콘·스킵. I3와 기술 축이 겹쳤으나 이 슬라이스에서 I3를 먼저 닫으므로 카드 폴리시는 순수 폴리시만 남는다.
