# QA — 사망 → 게임오버 연출 (death-flow)

> **브랜치:** feat/death-flow
> **슬라이스:** v1 완성도 — 사망→게임오버 연출 (F26)
> **계획 문서:** [2026-07-04-death-flow-plan.md](../development/sessions/2026-07-04-death-flow-plan.md)
> **닫는 백로그:** F26(사망→게임오버 연출) — 죽음 비트 · `gameOverPanel` 죽은 코드 · `HudController` executionOrder 세 조각 전부.
> **테스트:** 순수 로직 없음 → `wf skip-test`. 검증 축은 아래 수동 인게임 체크리스트(§5).

---

## 1. Impact Map (회귀 테스트 기준)

| 변경 파일 | 변경 내용 | 회귀 확인 범위 |
|---|---|---|
| `ui/DeathSequence.ts` (신규) | 죽음 연출 컴포넌트. `play(onComplete)`가 오버레이 UIOpacity를 `fadeSec`(기본 0.8초)에 걸쳐 0→255로 tween 후 콜백. `onLoad`가 오버레이 opacity를 0으로 낮춰 평상시 투명 보장. 오버레이 미배선 시 `scheduleOnce` 폴백. | 죽음 시 화면이 부드럽게 어두워진 뒤 result. 평상시엔 오버레이가 안 보임. |
| `systems/GameManager.ts` | `@property deathSequence` 추가. `DEATH_BEAT_SEC=0.8`은 폴백 전용으로 의미 변경. `_applyDamage`가 HP 0 도달 시 즉시 `goToResult()` 대신 `_startDeathSequence()` 호출 — 연출 위임 or `scheduleOnce` 폴백. 새 상태 필드·`update` 분기 없음. | 사망 → 약 0.8초 페이드(전장 정지 + 빈 HP 바 위에 암전) → result 씬. 승리(`gameTimer` 0)는 즉시 result 유지. 정상 플레이·레벨업 무영향. |
| `ui/HudController.ts` | `@executionOrder(100)` 추가(게임 로직 뒤 실행). `gameOverPanel`·`restartButton`·`menuButton` `@property`와 배선(`onLoad` 초기화·버튼 콜백)·`_onRestart`·`_onMenu`·`_handleStateChange`의 `GameOver` 분기 제거. | HP/XP/웨이브/레벨 라벨·바 정상. 레벨업 카드 패널 전환 정상. 게임오버는 오직 별도 result 씬으로 처리(main 패널 없음). |
| **main.scene (UICanvas)** | `GameOverPanel` 노드 트리(+ 자식 `RestartButton`·`MenuButton`) 제거 + **`DeathOverlay` 노드 신설**(풀스크린 검은 Sprite) + `DeathSequence` 컴포넌트 배치·배선. 7단계 사용자 작업. | 아래 §3~§4. |

> **hud-layout QA 문서 갱신:** 이 슬라이스가 [hud-layout-test.md](./hud-layout-test.md) §6의 "HP 0 → 즉시 result(F26 이월)" 항목과 §5의 "gameOverPanel 유지" 항목을 대체한다(해당 문서에 취소선 + 링크로 표기).

---

## 2. 자동 테스트로 검증

> **스킵 사유(2026-07-05 개정):** 이번 변경은 전부 Cocos 프레임워크에 의존한다 — `DeathSequence`의 `tween`/`UIOpacity`(오버레이 페이드) · `scheduleOnce`(폴백) · `director.loadScene`(씬 로드) · `@executionOrder`(렌더 순서) · 씬 노드 조작으로, 결정적으로 테스트할 순수 로직 파일이 없다. seam 분기(`deathSequence ? play : scheduleOnce`)도 trivial한 배선이다. `pnpm wf skip-test`로 기록. 기존 전체 스위트가 GREEN 유지되는지만 `start-verification` 게이트로 확인한다.

---

## 3. 씬 변경 사항 (7단계 사용자 — Cocos 에디터)

### 3.1 GameOverPanel 제거

`gameOverPanel`류는 result 씬이 사망과 동시에 로드돼 실제로는 뜨지 않던 죽은 UI다. 코드에서 `@property`와 배선을 제거했으므로 씬의 노드도 함께 지운다.

- **삭제 대상:** `UICanvas` 하위의 **`GameOverPanel`** 노드와 그 자식 **`RestartButton`·`MenuButton`** (`HUD`와 형제). 노드명은 `main.scene`에서 확인.
- 삭제 후 씬을 재저장하면 `HudController`에 남은 직렬화 `gameOverPanel`/`restartButton`/`menuButton` 참조도 씻긴다(Cocos는 클래스에 없는 프로퍼티를 로드 시 조용히 버려 런타임 오류 없음).
- 안 지워도 런타임엔 무해(코드가 활성화하지 않음)하나, 죽은 노드 정리를 위해 제거한다.

### 3.2 DeathOverlay 노드 + DeathSequence 컴포넌트 신설 (확정)

죽음 비트에 화면을 덮는 암전 페이드를 주기 위해, 화면 전체를 덮는 검은 오버레이 노드와 그 페이드를 재생하는 컴포넌트를 만든다.

**DeathOverlay 노드 (신규):**

| 항목 | 값 |
|---|---|
| 이름 | `DeathOverlay` |
| 부모 | `UICanvas` 하위, **`HUD`보다 아래(형제 순서상 마지막)** — 뒤 형제가 위에 그려지므로 HUD·게임 위를 덮는다 |
| 타입 | 2D Sprite 노드 (하이어라키 우클릭 → Create → 2D Object → Sprite) |
| SpriteFrame | 단색 스프라이트(예: Cocos 기본 `default_sprite_splash`/흰 단색) — 색으로 검정 틴트 |
| Color | 검정 `(0, 0, 0, 255)` (알파는 코드가 UIOpacity로 제어하므로 여기선 255) |
| 크기 | 화면 전체 — `Widget` 컴포넌트 추가 후 Top/Bottom/Left/Right = 0, 4방향 Align 체크(스트레치) |
| active | **켜짐(true)** — 평상시엔 코드가 opacity 0으로 낮춰 투명하게 유지한다 |

> UIOpacity는 **직접 추가하지 않아도 된다** — `DeathSequence`가 `onLoad`에서 없으면 부착하고 opacity를 0으로 낮춘다. 수동 추가해도 무방(그 경우도 코드가 0으로 세팅).

**DeathSequence 컴포넌트:**

- `UICanvas`(또는 `GameManager`가 붙은 노드처럼 항상 활성인 노드)에 `DeathSequence` 컴포넌트를 추가한다.
- `overlay` 슬롯에 위 `DeathOverlay` 노드를 연결한다.
- `fadeSec`는 기본 0.8. 죽음 비트 길이를 바꾸려면 이 값만 조정한다(코드 수정 불필요).

---

## 4. 에디터 연결 체크리스트 (`@property` ↔ 노드) (확정)

> 신규 연결 2개(`DeathSequence.overlay`, `GameManager.deathSequence`) + 기존 제거 확인.

| 컴포넌트 | `@property` | 조치 | 상태 |
|---|---|---|---|
| `DeathSequence` | `overlay` (신규) | `DeathOverlay` 노드 연결(§3.2) | ⬜ 연결 |
| `DeathSequence` | `fadeSec` (신규) | 기본 0.8 유지(원하면 조정) | ⬜ 확인 |
| `GameManager` | `deathSequence` (신규) | `DeathSequence` 컴포넌트 연결(§3.2) | ⬜ 연결 |
| `HudController` | `gameOverPanel`·`restartButton`·`menuButton` (기존) | 코드에서 제거 → 에디터 슬롯 사라짐. 씬 노드 삭제(§3.1) | ⬜ 확인 |
| `HudController` | `hpLabel`·`hpBar`·`xpBar`·`waveLabel`·`timerLabel`·`levelLabel`·`cardSelectPanel` (기존) | 무변경 — 연결 유지 | ⬜ 유지 확인 |
| `HudController` | `@executionOrder(100)` | 코드 데코레이터(연결 불필요) — HUD가 게임 로직 뒤 실행 | ⬜ 코드 확인 |

---

## 5. 수동 테스트 체크리스트 (인게임 — 7단계 사용자)

- [x] **HP가 0이 되면 화면이 약 0.8초에 걸쳐 서서히 어두워진다** — 적·발사체가 정지하고 **HP 바가 0으로 완전히 빈 채**, 그 위로 검은 오버레이가 부드럽게 페이드인한다(죽음 비트). "그냥 뚝 멈췄다"가 아니라 화면이 계속 어두워지는 전환으로 읽혀야 한다.
- [x] 페이드가 끝나면(약 0.8초 뒤) **result(결과) 씬으로 전환**되고 RETRY/MENU 버튼이 뜬다. (이전엔 즉시 전환이라 빈 바를 볼 수 없었고, 정지만 있어 렉처럼 보였음 — F26 및 렉 느낌 해소.)
- [x] **평상시(죽기 전)엔 DeathOverlay가 보이지 않는다** — 화면이 검게 덮이지 않고 정상 플레이된다(`onLoad`가 opacity 0으로 낮춤).
- [x] **(성능 확인) DeathOverlay overdraw** — 항상 활성인 풀스크린 오버레이(opacity 0)가 상시 드로우콜/오버드로우를 유발하는지 프로파일러로 확인. bullet-heaven에선 무시할 수준으로 예상되나, 유의미하면 백로그(F28)에 활성화-온-데스 전환 검토로 남긴다.
- [x] **(미배선 경고 확인)** `DeathSequence`의 `overlay` 또는 `GameManager`의 `deathSequence`를 일부러 비워 두면 콘솔에 "정적 프리즈로 폴백" 경고가 뜬다(세팅 실수 조기 노출). 정상 배선 시 경고 없음.
- [x] result 씬의 **RETRY**는 main을 재시작, **MENU**는 menu 씬으로 이동한다(회귀 없음). 재시작 후에도 오버레이가 검게 남지 않는다.
- [x] **레벨업 카드 선택 패널**은 그대로 뜨고, 선택 후 게임이 재개된다(`gameOverPanel` 제거가 카드 패널 전환에 영향 없음).
- [x] 정상 플레이 중 HP 바가 피해에 비례해 즉시 줄어든다(executionOrder — 사망 프레임에도 낡은 값 없이 0 반영).
- [x] **승리(타이머 0 도달)** 시에는 비트 없이 즉시 result 씬으로 간다(승리 경로는 이번 변경 대상 아님).
- [x] main 씬에 **게임오버 패널이 뜨지 않는다**(죽은 패널 제거 — 게임오버는 오직 result 씬으로 표현).
