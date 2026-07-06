# 일시정지 메뉴 (J4 P0-3) — QA 테스트

- **브랜치:** feat/pause-menu
- **작성일:** 2026-07-06 · **확정:** 2026-07-06 (GREEN 후 `PauseController` 코드에 맞춰 `@property`·조립 레시피 확정)
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
| `ui/PauseController.ts` (신규, Cocos) | ESC 입력·오버레이 토글·버튼 핸들러·라벨 코드 구동 i18n | 수동 QA(§6) |
| `components/XPItemController.ts` | `update` 맨 앞 `state !== Playing` 가드 (I2) | XP 흡수가 Playing에서만 일어나는지, 정상 플레이 흡수 회귀 없음 |
| `main.scene` | PauseRoot/PausePanel 노드 + PauseController 배선. I3는 라이브 검증(§2.3 — 재현 시에만 카메라/레이어 조정) | HUD·카드 패널·마법 아이콘 행 회귀 없음 |
| `resources/i18n/ko.json`·`en.json` | `pause.*` 키 추가 | 기존 키 회귀 없음 |

---

## 2. 씬 변경 + 에디터 조립 레시피 (확정)

> **왜 조립 레시피인가:** 사용자는 이 문서만 보고 에셋을 만든다. `PauseController`가 `@property`로 찾는 노드를 코드 계약만이 아니라 **만드는 순서·좌표·크기**까지 준다. 좌표계는 기존 HUD 컨벤션(1280×720, 중앙 원점 (0,0))을 따른다. `@property` 이름은 `PauseController` 코드에 맞춰 확정됐다(§3). 노드 이름(`PauseRoot` 등)은 권장 레시피이며 코드가 이름에 의존하진 않는다.

### 2.1 목표 계층 트리 (UICanvas 아래)

```
UICanvas
 ↳ PauseRoot                  (빈 Node — 항상 active, PauseController 컴포넌트)
    ↳ PausePanel              (빈 Node — 모달 콘텐츠 루트, 초기 active=false, 코드가 토글)
       ↳ Backdrop             (Sprite — 반투명 검정 전체화면, 클릭 차단)
       ↳ Title                (Label — PauseController.titleLabel에 연결. 텍스트는 코드가 채움)
       ↳ ResumeButton         (Button + 기본 자식 Label — 텍스트는 코드가 채움)
       ↳ RestartButton        (Button + 기본 자식 Label — 텍스트는 코드가 채움)
       ↳ MenuButton           (Button + 기본 자식 Label — 텍스트는 코드가 채움)
```

> **PauseRoot vs PausePanel을 나누는 이유:** ESC 리스너를 등록하는 `PauseController`는 **항상 active인 노드**에 있어야 한다(비활성 노드는 `onLoad`가 안 돌아 ESC를 못 받는다). 그래서 컨트롤러는 항상 켜진 `PauseRoot`에 두고, 실제로 껐다 켜는 모달 콘텐츠는 자식 `PausePanel`(초기 꺼짐)에 담는다. 부모가 켜져 있으면 자식만 토글해도 컨트롤러는 계속 산다.

### 2.2 만드는 순서

1. **PauseRoot** — `UICanvas` 선택 → `Create → Empty Node` → 이름 `PauseRoot`. Position (0, 0). active 체크 유지.
2. **PausePanel** — `PauseRoot` 아래 `Create → Empty Node` → 이름 `PausePanel`. Position (0, 0). **Inspector에서 노드 active 체크 해제**(초기 숨김 — 코드가 켠다).
3. **Backdrop** — `PausePanel` 아래 `Create → 2D Object → Sprite` → 이름 `Backdrop`.
   - Sprite: Type = SIMPLE, SpriteFrame = 내장 단색(예: `internal/default_ui/default_sprite_splash`)이나 흰색 사각.
   - `Widget` 컴포넌트 추가 → **Top·Bottom·Left·Right 모두 체크, 각 거리 0** → 노드가 부모(1280×720) 전체로 늘어난다. (Widget: 좌우 또는 상하 양쪽 정렬 시 그 방향으로 크기가 stretch됨 — Cocos 3.8 공식 문서 확인.)
   - Color = 검정, 알파 ≈ 178 (약 70% 딤). Backdrop이 화면을 덮어 아래 게임으로 가는 클릭을 막는다(Sprite는 UITransform 영역에서 터치를 소비).
4. **Title** — `PausePanel` 아래 `Create → 2D Object → Label` → 이름 `Title`. Position (0, 150). Font Size 48, Horizontal Align CENTER, Color 흰색. **Content Size를 텍스트가 들어갈 만큼 넉넉히**(예: 320×70 — 라벨 노드가 글자보다 작으면 잘린다. 잘림 = 라벨 크기 문제). **LocalizedLabel 불필요** — 텍스트는 `PauseController`가 코드로 채운다(§8에서 `titleLabel`에 연결).
5. **ResumeButton** — `PausePanel` 아래 `Create → UI → Button` → 이름 `ResumeButton`. Position (0, 50). Content Size 240×64. **버튼의 기본 자식 `Label`의 Content Size를 버튼 폭(240)에 맞춰** 잘리지 않게 한다. 자식 Label 텍스트는 `PauseController`가 `pause.resume`으로 채우므로 **LocalizedLabel·수동 텍스트 불필요**(임시로 뭘 적어둬도 런타임에 덮어씀).
6. **RestartButton** — `ResumeButton` 복제 → 이름 `RestartButton`. Position (0, -30). (텍스트는 코드가 `pause.restart`로 채움.)
7. **MenuButton** — `ResumeButton` 복제 → 이름 `MenuButton`. Position (0, -110). (텍스트는 코드가 `pause.menu`로 채움.)
8. **PauseController** — `PauseRoot`에 `PauseController` 컴포넌트 추가 → 아래 §3 `@property`(pausePanel·titleLabel·resume/restart/menuButton)를 연결.

> **버튼 클릭·라벨 텍스트 모두 코드가 처리한다.** 클릭은 `node.on(Button.EventType.CLICK, …)`(프로젝트 컨벤션 = `CardSelectPanel`)로, 라벨 텍스트는 패널이 열릴 때 `PauseController._applyI18n()`이 `t()`로 채운다(main 씬 나머지와 동일한 코드 구동 i18n — `LocalizedLabel` 안 씀). 에디터 Click Events 목록은 비워 두고, 버튼 자식 Label에 별도 컴포넌트도 안 붙인다.

### 2.3 I3 — 발사체 레이어 (7단계 라이브 검증)

**정적 조사 결과(2026-07-06):** 현재 씬의 카메라/레이어 구성은 이미 올바르다.
- 발사체·VFX 프리팹(`Bullet`·`EnemyBullet`·`ExplosionVfx`·`NovaVfx`·`OrbVfx`)의 루트 `_layer`는 전부 `DEFAULT`(1073741824)다. UI 프리팹(`SpellSlot`)만 `UI_2D`(33554432).
- 발사체 부모(`SpellCaster.bulletParent` → 게임 `Canvas`의 자식 `BulletParent`)와 적/적탄 부모(`playerNode.parent` = 게임 `Canvas`)가 모두 게임 Canvas 아래다.
- 게임 카메라: priority 0, clearFlags SOLID_COLOR(7), visibility DEFAULT. UICamera: priority 1, clearFlags DEPTH_ONLY(6), visibility UI_2D. → UICamera가 나중에 그려져 **UI가 게임 월드 위로** 렌더되는 표준 오버레이 구성(Cocos 3.8 공식 권장과 일치).

즉 정적 기준으로는 발사체가 UI 아래로 그려져야 한다. I3가 처음 관측된 시점(projectile-pause-guard) 이후 `main.scene`이 #50·#52로 크게 재작업됐으므로 **이미 해결됐을 가능성이 크다.** 실제 렌더 순서는 인게임에서만 확정되므로 7단계에서 라이브로 확인한다(§6 I3 항목).

**만약 재현되면(진단 레시피):** ① 씬에서 게임 `Camera`와 `UICamera`의 **Priority**를 확인 — UICamera가 더 커야 한다(위로 렌더). ② 두 카메라의 **ClearFlags** — 게임=SOLID_COLOR, UI=DEPTH_ONLY. ③ 각 `Canvas`의 **Camera Component** 링크가 서로 맞물렸는지(UICanvas→UICamera, 게임 Canvas→게임 Camera). ④ 화면에 뜬 발사체 노드의 **Layer**가 `UI_2D`로 새지 않았는지. 재현 시 위 항목 중 어긋난 것을 에디터에서 바로잡고 이 절에 실제 수정 내용을 기록한다(코드 변경 없음 — 프리팹 레이어는 이미 맞음).

---

## 3. 에디터 연결 체크리스트 (`@property` ↔ 노드) — 확정

`PauseController`가 코드에서 찾는 참조(아래 이름은 실제 `@property`와 일치 — 확정).

| `@property` | 타입 | 연결 노드 | 상태 |
|-------------|------|-----------|------|
| `pausePanel` | Node | `PausePanel` | ❌ |
| `titleLabel` | Label | `Title` | ❌ |
| `resumeButton` | Button | `ResumeButton` | ❌ |
| `restartButton` | Button | `RestartButton` | ❌ |
| `menuButton` | Button | `MenuButton` | ❌ |

동작 계약(코드가 하는 일): `onLoad`에서 ESC 키 리스너(`input.on(KEY_DOWN)`)와 세 버튼의 CLICK 핸들러를 등록하고 `pausePanel.active=false`로 초기화한다. `onDestroy`는 **전역 `input` 리스너만** 해제한다(버튼 CLICK 리스너는 노드가 씬과 함께 파괴될 때 자동 정리 — 수동 off는 파괴된 노드 참조로 크래시하므로 안 한다). 상태가 `Paused`로 바뀌면 `pausePanel.active=true`로 켜고 **그때 `titleLabel`과 세 버튼의 자식 Label을 `pause.*` 키로 채운다**(코드 구동 i18n). ESC → `pauseToggleAction(state)`로 `enterPause()`/`resumePause()`. 버튼 → `resumePause()` / `GameManager.restart()`(`main` 재로드) / `GameManager.goToMenu()`(`menu` 로드).

---

## 4. i18n 카탈로그 키 (신규)

`resources/i18n/ko.json`·`en.json`에 추가했다(확정 — 코드에 반영됨). 라벨 텍스트는 `PauseController._applyI18n`이 패널 열림 때 `t()`로 채운다(`LocalizedLabel` 미사용 — main 씬 나머지와 동일 코드 구동 방식).

> **인게임에서 라벨이 `pause.title`처럼 원문으로 뜨면:** 코드 구동이라 라벨 배선 문제는 아니고, 실행 중인 Preview가 카탈로그 갱신 전에 시작돼 옛 카탈로그를 들고 있는 것이다(`I18n`은 게임 시작 시 1회 로드, `t()`는 미스 시 키 원문 폴백). **Preview를 재시작**하면 갱신된 카탈로그가 로드된다. 그래도 원문이면 Assets 패널에서 `resources/i18n` 우클릭 → Reimport 후 재실행.

| 키 | ko | en |
|----|----|----|
| `pause.title` | 일시정지 | Paused |
| `pause.resume` | 계속하기 | Resume |
| `pause.restart` | 재시작 | Restart |
| `pause.menu` | 메인 메뉴 | Main Menu |

---

## 5. 자동 테스트로 검증 (`tests/logic/PauseMenu.test.ts`)

> **GREEN 확인:** 피처 테스트 5/5 + 전체 스위트 403/403 통과 (구현 커밋 `5374786`). RED→GREEN 확인(`PauseMenuLogic` 미존재로 RED → 구현 후 GREEN).

- [x] `pauseToggleAction(Playing)` → `'pause'`
- [x] `pauseToggleAction(Paused)` → `'resume'`
- [x] `pauseToggleAction(LevelUp)` → `'ignore'` (카드 선택 중 ESC 무시 = 이중 일시정지 차단)
- [x] `pauseToggleAction(GameOver)` → `'ignore'`
- [x] `pauseToggleAction(Victory)` → `'ignore'`

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
