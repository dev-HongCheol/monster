# 일시정지 메뉴 (J4 P0-3) — QA 테스트

- **브랜치:** feat/pause-menu
- **작성일:** 2026-07-06 (qa-setup 단계 — 프리팹/에디터·`@property` 섹션은 **잠정**, GREEN 후 코드에 맞춰 확정)
- **관련 계획:** `../development/sessions/2026-07-06-pause-menu-plan.md`
- **정본 연결:** `../design/ui-completeness-plan.md` §4 P0-3, 백로그 I2·I3

> 이 슬라이스는 ESC로 여는 수동 일시정지(`Paused`) 상태 + Resume·재시작·메뉴 모달을 붙이고, 함께 I2(일시정지 중 XP 흡수 차단)·I3(정지 발사체가 UI 위로 렌더되는 레이어 버그)를 닫는다.

---

## 1. Impact Map (회귀 확인 범위)

| 변경 파일 | 무엇이 바뀌나 | 확인 범위 |
|-----------|--------------|-----------|
| `logic/PauseMenuLogic.ts` (신규, 순수) | `pauseToggleAction(state)` — ESC 토글 결정 | 자동 테스트로 검증(§5) |
| `data/GameTypes.ts` | `GameState` enum에 `Paused` 추가 | 기존 상태 분기(LevelUp/GameOver/Victory) 회귀 없음 확인 |
| `systems/GameManager.ts` | `enterPause()`/`resumePause()` 신설 | 기존 `enterLevelUp`/`resumeFromLevelUp`·게임오버 흐름 회귀 없음 |
| `ui/PauseController.ts` (신규, Cocos) | ESC 입력·오버레이 토글·버튼 핸들러 | 수동 QA(§6) |
| `components/XPItemController.ts` | `update` 맨 앞 `state !== Playing` 가드 (I2) | XP 흡수가 Playing에서만 일어나는지, 정상 플레이 흡수 회귀 없음 |
| `main.scene` | PauseRoot/PausePanel 노드 + PauseController 배선, I3 레이어 수정 | HUD·카드 패널·마법 아이콘 행 회귀 없음 |
| `resources/i18n/ko.json`·`en.json` | `pause.*` 키 추가 | 기존 키 회귀 없음 |

---

## 2. 씬 변경 + 에디터 조립 레시피 (잠정)

> **왜 조립 레시피인가:** 사용자는 이 문서만 보고 에셋을 만든다. `PauseController`가 `@property`로 찾는 노드를 코드 계약만이 아니라 **만드는 순서·좌표·크기**까지 준다. 좌표계는 기존 HUD 컨벤션(1280×720, 중앙 원점 (0,0))을 따른다.

### 2.1 목표 계층 트리 (UICanvas 아래) — 잠정

```
UICanvas
 ↳ PauseRoot                  (빈 Node — 항상 active, PauseController 컴포넌트)   (가칭)
    ↳ PausePanel              (빈 Node — 모달 콘텐츠 루트, 초기 active=false, 코드가 토글)  (가칭)
       ↳ Backdrop             (Sprite — 반투명 검정 전체화면, 클릭 차단)
       ↳ Title                (Label + LocalizedLabel key=pause.title)
       ↳ ResumeButton         (Button; 자식 Label + LocalizedLabel key=pause.resume)
       ↳ RestartButton        (Button; 자식 Label + LocalizedLabel key=pause.restart)
       ↳ MenuButton           (Button; 자식 Label + LocalizedLabel key=pause.menu)
```

> **PauseRoot vs PausePanel을 나누는 이유:** ESC 리스너를 등록하는 `PauseController`는 **항상 active인 노드**에 있어야 한다(비활성 노드는 `onLoad`가 안 돌아 ESC를 못 받는다). 그래서 컨트롤러는 항상 켜진 `PauseRoot`에 두고, 실제로 껐다 켜는 모달 콘텐츠는 자식 `PausePanel`(초기 꺼짐)에 담는다. 부모가 켜져 있으면 자식만 토글해도 컨트롤러는 계속 산다.

### 2.2 만드는 순서 (잠정)

1. **PauseRoot** — `UICanvas` 선택 → `Create → Empty Node` → 이름 `PauseRoot`. Position (0, 0). active 체크 유지.
2. **PausePanel** — `PauseRoot` 아래 `Create → Empty Node` → 이름 `PausePanel`. Position (0, 0). **Inspector에서 노드 active 체크 해제**(초기 숨김 — 코드가 켠다).
3. **Backdrop** — `PausePanel` 아래 `Create → 2D Object → Sprite` → 이름 `Backdrop`.
   - Sprite: Type = SIMPLE, SpriteFrame = 내장 단색(예: `internal/default_ui/default_sprite_splash`)이나 흰색 사각.
   - `Widget` 컴포넌트 추가 → **Top·Bottom·Left·Right 모두 체크, 각 거리 0** → 노드가 부모(1280×720) 전체로 늘어난다. (Widget: 좌우 또는 상하 양쪽 정렬 시 그 방향으로 크기가 stretch됨 — Cocos 3.8 공식 문서 확인.)
   - Color = 검정, 알파 ≈ 178 (약 70% 딤). Backdrop이 화면을 덮어 아래 게임으로 가는 클릭을 막는다(Sprite는 UITransform 영역에서 터치를 소비).
4. **Title** — `PausePanel` 아래 `Create → 2D Object → Label` → 이름 `Title`. Position (0, 150). Font Size 48, Horizontal Align CENTER, Color 흰색. `LocalizedLabel` 컴포넌트 추가 → `key = pause.title`.
5. **ResumeButton** — `PausePanel` 아래 `Create → UI → Button` → 이름 `ResumeButton`. Position (0, 50). Content Size 240×64. 자식 `Label`에 `LocalizedLabel` 추가 → `key = pause.resume`.
6. **RestartButton** — `ResumeButton` 복제 → 이름 `RestartButton`. Position (0, -30). 자식 Label `LocalizedLabel key = pause.restart`.
7. **MenuButton** — `ResumeButton` 복제 → 이름 `MenuButton`. Position (0, -110). 자식 Label `LocalizedLabel key = pause.menu`.
8. **PauseController** — `PauseRoot`에 `PauseController` 컴포넌트 추가 → 아래 §3 `@property`를 연결.

> 버튼 클릭은 **에디터 ClickEvents가 아니라 코드에서** `node.on(Button.EventType.CLICK, …)`로 배선한다(프로젝트 컨벤션 = `CardSelectPanel`). 따라서 버튼은 `@property(Button)`로 컨트롤러에 넘기기만 하면 되고, 에디터 Click Events 목록은 비워 둔다.

### 2.3 I3 — 발사체 레이어 (구현 시 조사)

정지한 발사체·적이 UI 오버레이(카드 패널·일시정지 패널) **위로** 그려지는 레이어 버그를 함께 닫는다. 게임 월드 노드는 게임 Canvas 계열(적·적탄 = `playerNode.parent`, 플레이어 발사체·VFX = `SpellCaster.bulletParent`)에 붙고, UI는 `UICanvas`/`UICamera`(priority 1) 아래 있다. **구현 첫 작업으로 씬에서 발사체 부모 노드의 Canvas·카메라·Layer를 조사**해, 게임 월드가 UI 아래로 그려지게 맞춘다. 실제 수정 지점(부모 재지정 / Layer 정정 / 카메라 priority·visibility)은 조사 후 이 절에 확정한다. *(잠정 — GREEN 후 실제 수정 내용으로 채운다.)*

---

## 3. 에디터 연결 체크리스트 (`@property` ↔ 노드) — 잠정

`PauseController`(가칭)가 코드에서 찾는 참조. GREEN 후 실제 `@property` 이름으로 확정한다.

| `@property` (잠정) | 타입 | 연결 노드 | 상태 |
|-------------------|------|-----------|------|
| `pausePanel` | Node | `PausePanel` | ❌ |
| `resumeButton` | Button | `ResumeButton` | ❌ |
| `restartButton` | Button | `RestartButton` | ❌ |
| `menuButton` | Button | `MenuButton` | ❌ |

동작 계약(코드가 하는 일): `onLoad`에서 ESC 키 리스너(`input.on(KEY_DOWN)`)와 세 버튼의 CLICK 핸들러를 등록하고 `pausePanel.active=false`로 초기화한다. 매 프레임 상태가 `Paused`면 `pausePanel.active=true`, 아니면 `false`로 동기화한다. ESC → `pauseToggleAction(state)` 결과로 `enterPause()`/`resumePause()`. 버튼 → `resumePause()` / `GameManager.restart()` / `GameManager.goToMenu()`.

---

## 4. i18n 카탈로그 키 (신규)

`resources/i18n/ko.json`·`en.json`에 추가한다. *(잠정 문구 — 구현 시 확정.)*

| 키 | ko | en |
|----|----|----|
| `pause.title` | 일시정지 | Paused |
| `pause.resume` | 계속하기 | Resume |
| `pause.restart` | 재시작 | Restart |
| `pause.menu` | 메인 메뉴 | Main Menu |

---

## 5. 자동 테스트로 검증 (`tests/logic/PauseMenu.test.ts`)

> GREEN 후 채움: 피처 테스트 N/N + 전체 스위트 M/M, 통과 커밋 SHA.

- [ ] `pauseToggleAction(Playing)` → `'pause'`
- [ ] `pauseToggleAction(Paused)` → `'resume'`
- [ ] `pauseToggleAction(LevelUp)` → `'ignore'` (카드 선택 중 ESC 무시 = 이중 일시정지 차단)
- [ ] `pauseToggleAction(GameOver)` → `'ignore'`
- [ ] `pauseToggleAction(Victory)` → `'ignore'`

---

## 6. 수동 테스트 체크리스트 (인게임 — 7단계 사용자)

- [ ] 플레이 중 **ESC** → 전장이 즉시 멈추고(적·발사체·타이머·XP 이동 정지) 일시정지 오버레이(딤 + "일시정지" + 버튼 3개)가 뜬다.
- [ ] 오버레이가 뜬 상태에서 **ESC 다시** 또는 **계속하기** → 오버레이가 닫히고 게임이 멈춘 지점에서 그대로 재개된다.
- [ ] **재시작** 버튼 → main 씬이 재로드돼 새 런으로 시작한다.
- [ ] **메인 메뉴** 버튼 → menu 씬으로 이동한다.
- [ ] **카드 선택(레벨업) 중 ESC를 눌러도 일시정지 메뉴가 뜨지 않는다**(이중 일시정지 차단). 카드 선택은 그대로 유지된다.
- [ ] 게임오버/승리 전환 중 ESC는 무시된다(오버레이 안 뜸).
- [ ] **I3:** 발사체가 화면에 떠 있을 때 일시정지해도, 얼어붙은 발사체가 일시정지 오버레이(딤·타이틀·버튼)를 가리지 않는다(발사체가 UI 아래로 렌더). 같은 개선으로 레벨업 카드 패널도 발사체에 안 가려진다.
- [ ] **I2:** XP 오브를 픽업 반경 안에 둔 채 ESC로 일시정지 → **흡수되지 않는다**(레벨·XP 바 불변). 재개하면 다시 흡수된다. 카드 선택(LevelUp) 중에도 흡수되지 않는다.
- [ ] 언어를 KO/EN으로 바꾸면 일시정지 오버레이의 타이틀·버튼 라벨이 해당 언어로 표시된다.
- [ ] 일시정지 오버레이가 HP/XP 바·마법 아이콘 행 등 기존 HUD와 겹쳐 깨지지 않는다.
