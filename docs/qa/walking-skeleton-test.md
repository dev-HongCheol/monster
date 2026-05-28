# Walking Skeleton 수동 테스트

- **브랜치:** `feat/walking-skeleton`
- **날짜:** 2026-05-23
- **목적:** PR merge 전 전체 플로우 1회 통과 확인

## Impact Map — 변경 파일별 테스트 범위

파일을 수정했을 때 **해당 행의 범위만** 재확인한다.

| 변경 파일 | 확인 범위 |
|-----------|----------|
| `systems/DataManager.ts` | JSON 로드, data/*.json 수치 인게임 반영 |
| `systems/GameManager.ts` | HP 피해, 게임오버 판정, 웨이브 클리어 전환, 전체 게임 타이머 → 0 시 승리, 씬 이동 |
| `systems/WaveManager.ts` | 타이머 카운트다운, 타이머 0 → Wave 번호 증가 (WaveClear 트리거 없음) |
| `systems/EnemySpawner.ts` | 적 스폰 발생, 웨이브별 스폰 간격/최대 수 변화 |
| `systems/DeckManager.ts` | 카드 드로우 3장, 카드 효과 수치 반영 |
| `components/EnemyController.ts` | 적 추적 이동, 접촉 데미지, 적 사망 처리 |
| `components/PlayerController.ts` | WASD 이동, 자동 조준 발사, 쿨다운 간격 |
| `ui/HudController.ts` | HP·Wave·전체 게임 잔여 시간(MM:SS) 표시, GameOver 패널, 카드 선택 패널 |
| `ui/CardSelectPanel.ts` | 카드 3장 표시, 선택 → 강화 적용 → 다음 웨이브 |
| `ui/MainMenuController.ts` | [Play] → main.scene |
| `ui/ResultController.ts` | 웨이브 수 표시, [Retry]/[Menu] 동작 |
| `resources/data/player.json` | 초기 HP, 이동 속도 반영 |
| `resources/data/spells.json` | 발사체 속도, 데미지, 쿨다운 반영 |
| `resources/data/enemies.json` | 적 HP, 이동 속도, 접촉 데미지 반영 |
| `resources/data/cards.json` | 카드 이름·설명 표시, 효과 수치 적용 |

---

## 씬 노드 구성

> 캔버스 해상도: **1280 × 720** (Canvas 중심 기준 좌표계)

### main.scene — 현재 구성

> Label Size는 텍스트 내용에 따라 자동 조절 (Overflow: NONE 기본값), 수동 설정 불필요.
> 계층 순서: DataManager → WaveManager → DeckManager → GameManager 순서를 지켜야 onLoad 의존성이 올바르게 해결된다.

| 노드 | 타입 | Position | Size | 컴포넌트 | 상태 |
|------|------|----------|------|----------|------|
| Camera | 빈 노드 | (0, 0, 1000) | — | Camera | ✅ |
| Player | Sprite | (0, 0) | 50×50 | UITransform, Sprite, PlayerController | ✅ |
| DataManager | 빈 노드 | (-640, -360) | — | DataManager | ✅ |
| WaveManager | 빈 노드 | (-640, -360) | — | WaveManager (waveDuration: 180) | ✅ |
| DeckManager | 빈 노드 | (-640, -360) | — | DeckManager | ✅ |
| GameManager | 빈 노드 | (-640, -360) | — | GameManager (gameDuration: 900) | ✅ |
| HUD | 빈 노드 | (0, 0) | — | HudController | ✅ |
| ↳ HpLabel | Label | (-300, 220) | 자동 | UITransform, Label(fontSize 20) | ✅ |
| ↳ WaveLabel | Label | (0, 220) | 자동 | UITransform, Label(fontSize 20) | ✅ |
| ↳ TimerLabel | Label | (300, 220) | 자동 | UITransform, Label(fontSize 20) | ✅ |
| BulletParent | 빈 노드 | (0, 0) | — | — | ✅ |
| GameOverPanel | 빈 노드 | (0, 0) | 100×100 | UITransform | ✅ active:false |
| ↳ "GAME OVER" | Label | (0, 0) | 자동 | Label(fontSize 48) | ✅ |
| ↳ RestartButton | Button | (0, -80) | 100×40 | UITransform, Sprite, Button | ✅ |
| EnemySpawner | 빈 노드 | (-640, -360) | — | EnemySpawner | ✅ |
| CardSelectPanel | 빈 노드 | (0, 0) | 600×400 | UITransform, CardSelectPanel | ✅ active:false |
| ↳ CardButton_0~2 | Button | (-200/0/200, 0) | 160×220 | UITransform, Sprite, Button | ✅ |

### main.scene — 추가 생성 필요

| 노드 | 타입 | Position | Size | 컴포넌트 | 연결 대상 |
|------|------|----------|------|----------|----------|
| GameOverPanel > MenuButton | Button | (0, -130) | 100×40 | UITransform, Sprite, Button + Label("MENU") | HudController.menuButton |
| CardSelectPanel > ↳ CardNameLabel_0~2 | Label | (0, 60) (각 카드 내부) | 자동 | UITransform, Label(fontSize 16) | CardSelectPanel.cardNameLabels[0~2] |
| CardSelectPanel > ↳ CardDescLabel_0~2 | Label | (0, 0) (각 카드 내부) | 자동 | UITransform, Label(fontSize 12) | CardSelectPanel.cardDescLabels[0~2] |

> ⚠️ CardSelectPanel은 active: false 로 시작해야 한다. HudController.onLoad에서 강제 비활성화하지만 씬에서도 false로 설정해야 한다.

> ⚠️ `goToResult()` 미연결 — GameOver 시 result.scene 이동 경로 없음. MenuButton을 통해 menu.scene으로 이동하거나, GameOverPanel에 ResultButton을 추가하고 `GameManager.instance.goToResult()` 연결 필요.

---

### menu.scene — 신규 생성

| 노드 | 타입 | Position | Size | 컴포넌트 | 연결 대상 |
|------|------|----------|------|----------|----------|
| Canvas | Canvas 노드 | (640, 360) | 1280×720 | UITransform, Canvas, Widget | — |
| ↳ Camera | 빈 노드 | (0, 0, 1000) | — | Camera | Canvas.cameraComponent |
| ↳ TitleLabel | Label | (0, 100) | 자동 | UITransform, Label(fontSize 40, "MONSTER") | — |
| ↳ PlayButton | Button | (0, -50) | 160×60 | UITransform, Sprite, Button + Label("PLAY") | MainMenuController.playButton |
| ↳ MainMenu | 빈 노드 | (0, 0) | — | MainMenuController | — |

---

### result.scene — 신규 생성

| 노드 | 타입 | Position | Size | 컴포넌트 | 연결 대상 |
|------|------|----------|------|----------|----------|
| Canvas | Canvas 노드 | (640, 360) | 1280×720 | UITransform, Canvas, Widget | — |
| ↳ Camera | 빈 노드 | (0, 0, 1000) | — | Camera | Canvas.cameraComponent |
| ↳ WaveLabel | Label | (0, 50) | 자동 | UITransform, Label(fontSize 30, "0웨이브 도달") | ResultController.waveLabel |
| ↳ RetryButton | Button | (0, -50) | 160×50 | UITransform, Sprite, Button + Label("RETRY") | ResultController.retryButton |
| ↳ MenuButton | Button | (0, -120) | 160×50 | UITransform, Sprite, Button + Label("MENU") | ResultController.menuButton |
| ↳ Result | 빈 노드 | (0, 0) | — | ResultController | — |

---

## 에디터 연결 체크리스트

> 씬 실행 전 인스펙터에서 모두 연결돼 있어야 한다.

### main.scene — HudController 연결

| 프로퍼티 | 연결 노드 | 현재 상태 |
|---------|----------|----------|
| hpLabel | HUD > HpLabel | ✅ |
| gameOverPanel | GameOverPanel | ✅ |
| restartButton | GameOverPanel > RestartButton | ✅ |
| waveLabel | HUD > WaveLabel | ✅ |
| timerLabel | HUD > TimerLabel | ✅ |
| menuButton | GameOverPanel > MenuButton | ❌ MenuButton 노드 생성 후 연결 필요 |
| cardSelectPanel | CardSelectPanel | ✅ |

### main.scene — CardSelectPanel 연결

| 프로퍼티 | 연결 노드 | 현재 상태 |
|---------|----------|----------|
| cardButtons[0] | CardSelectPanel > CardButton_0 | ✅ |
| cardButtons[1] | CardSelectPanel > CardButton_1 | ✅ |
| cardButtons[2] | CardSelectPanel > CardButton_2 | ✅ |
| cardNameLabels[0~2] | CardButton_0~2 > CardNameLabel | ❌ Label 노드 생성 후 연결 필요 |
| cardDescLabels[0~2] | CardButton_0~2 > CardDescLabel | ❌ Label 노드 생성 후 연결 필요 |

### menu.scene

| 노드 | 컴포넌트 | 연결 항목 |
|------|----------|-----------|
| MainMenu | `MainMenuController` | `playButton` → PlayButton 노드 |

### result.scene

| 노드 | 컴포넌트 | 연결 항목 |
|------|----------|-----------|
| Result | `ResultController` | `waveLabel`, `retryButton`, `menuButton` |

---

## 테스트 체크리스트

### 씬 전환

- [x] menu.scene 실행 → 메인 메뉴 표시
- [x] [Play] 클릭 → main.scene 로드, 게임 시작
- [x] GameOver → result.scene 이동 ⚠️ `HudController`에 `goToResult()` 호출 경로 없음 — 에디터 버튼 연결 확인 필요
- [x] result.scene [Retry] → main.scene
- [x] result.scene [Menu] → menu.scene
- [x] GameOver 패널 [Restart] → main.scene 재시작
- [ ] GameOver 패널 [Menu] → menu.scene

### 게임플레이 기본

- [ ] WASD / 방향키 이동
- [ ] 대각선 이동 속도가 일반 이동과 동일 (normalize 적용)
- [ ] 가장 가까운 적에게 자동 발사
- [ ] 발사체 명중 → 적 HP 감소
- [ ] 적 HP 0 → 소멸
- [ ] WaveClear / GameOver 상태에서 이동·발사 정지

### 적 시스템

- [ ] 게임 시작 후 적 스폰
- [ ] 적이 플레이어 추적
- [ ] 적 접촉 → 플레이어 HP 감소 (HUD 반영)
- [ ] Wave 2 이후 스폰 간격 단축, 최대 적 수 증가

### 웨이브 시스템

- ~~[ ] HUD에 `Wave 1`, 타이머 카운트다운 표시~~ → **변경됨**: HUD 타이머가 웨이브 단위가 아닌 전체 게임 잔여 시간으로 교체 (xp-system)
- ~~[ ] 타이머 0 → 일시정지, CardSelectPanel 표시~~ → **의도적 제거**: 카드 선택 트리거를 타이머에서 레벨업(XP)으로 분리 (xp-system)
- ~~[ ] 카드 선택 후 Wave 2 타이머 30초로 리셋~~ → **변경됨**: 웨이브 지속 시간 30초 → 180초 (xp-system)
- [ ] HUD에 `Wave 1`, 전체 잔여 시간 `15:00`부터 MM:SS 카운트다운 표시
- [ ] 웨이브 타이머(3분) 0 → Wave 번호 증가, **CardSelectPanel 표시 안 됨**
- [ ] 레벨업(XP 충족) → CardSelectPanel 표시, 타이머 일시 정지
- [ ] 카드 선택 후 게임 재개, 웨이브 타이머 3분으로 리셋
- [ ] Wave 번호 2, 3... 증가
- [ ] 전체 타이머 0 → result.scene 이동, `승리!` 표시

### 카드 선택

- [ ] 카드 3장 이름·설명 표시
- [ ] 3장 미만이면 빈 슬롯 비활성화
- [ ] 카드 선택 → 게임 재개, 다음 웨이브 시작
- [ ] 데미지 카드 선택 → 이후 발사 데미지 증가
- [ ] 쿨다운 카드 선택 → 발사 간격 단축
- [ ] HP 카드 선택 → 최대 HP 및 현재 HP 증가

### HP / 게임오버

- [ ] HUD HP 실시간 감소
- [ ] HP 0 → GameOver 전환, 게임 정지
- [ ] GameOver 패널 표시

### 데이터 연동

- [ ] `player.json` maxHp·speed 인게임 반영
- [ ] `spells.json` fireball 수치 반영
- [ ] `enemies.json` skeleton 수치 반영
- [ ] `cards.json` 카드 내용 표시·적용
