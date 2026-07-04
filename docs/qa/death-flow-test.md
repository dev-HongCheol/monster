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
| `systems/GameManager.ts` | `DEATH_BEAT_SEC=0.8` 상수 추가. `_applyDamage`가 HP 0 도달 시 즉시 `goToResult()`를 부르던 것을 `scheduleOnce(() => goToResult, DEATH_BEAT_SEC)`로 지연. 새 필드·`update` 분기 없음. | 사망 → 약 0.8초 프리즈(전장 정지 + 빈 HP 바) → result 씬. 승리(`gameTimer` 0)는 즉시 result 유지. 정상 플레이·레벨업 무영향. |
| `ui/HudController.ts` | `@executionOrder(100)` 추가(게임 로직 뒤 실행). `gameOverPanel`·`restartButton`·`menuButton` `@property`와 배선(`onLoad` 초기화·버튼 콜백)·`_onRestart`·`_onMenu`·`_handleStateChange`의 `GameOver` 분기 제거. | HP/XP/웨이브/레벨 라벨·바 정상. 레벨업 카드 패널 전환 정상. 게임오버는 오직 별도 result 씬으로 처리(main 패널 없음). |
| **main.scene (UICanvas)** | `GameOverPanel` 노드 트리(+ 자식 `RestartButton`·`MenuButton`) 제거. 7단계 사용자 작업. | 아래 §3~§4. |

> **hud-layout QA 문서 갱신:** 이 슬라이스가 [hud-layout-test.md](./hud-layout-test.md) §6의 "HP 0 → 즉시 result(F26 이월)" 항목과 §5의 "gameOverPanel 유지" 항목을 대체한다(해당 문서에 취소선 + 링크로 표기).

---

## 2. 자동 테스트로 검증

> **스킵 사유(2026-07-04):** 이번 변경은 전부 Cocos 프레임워크에 의존한다 — `scheduleOnce`(엔진 스케줄러) · `director.loadScene`(씬 로드) · `@executionOrder`(렌더 순서) · 씬 노드 제거로, 결정적으로 테스트할 순수 로직 파일이 없다. `pnpm wf skip-test`로 기록. 기존 전체 스위트가 GREEN 유지되는지만 `start-verification` 게이트로 확인한다.

---

## 3. 씬 변경 사항 — GameOverPanel 제거 (7단계 사용자 — Cocos 에디터)

`gameOverPanel`류는 result 씬이 사망과 동시에 로드돼 실제로는 뜨지 않던 죽은 UI다. 코드에서 `@property`와 배선을 제거했으므로 씬의 노드도 함께 지운다.

- **삭제 대상:** `UICanvas` 하위의 **`GameOverPanel`** 노드와 그 자식 **`RestartButton`·`MenuButton`** (`HUD`와 형제). 노드명은 `main.scene`에서 확인.
- 삭제 후 씬을 재저장하면 `HudController`에 남은 직렬화 `gameOverPanel`/`restartButton`/`menuButton` 참조도 씻긴다(Cocos는 클래스에 없는 프로퍼티를 로드 시 조용히 버려 런타임 오류 없음).
- 안 지워도 런타임엔 무해(코드가 활성화하지 않음)하나, 죽은 노드 정리를 위해 제거한다.

---

## 4. 에디터 연결 체크리스트 (`@property` ↔ 노드)

> 이 슬라이스는 신규 `@property` 연결이 없다 — **제거**가 전부다.

| 컴포넌트 | `@property` | 조치 | 상태 |
|---|---|---|---|
| `HudController` | `gameOverPanel` (기존) | 코드에서 제거 → 에디터 슬롯 사라짐. 씬 노드 삭제(§3) | ⬜ 확인 |
| `HudController` | `restartButton` (기존) | 코드에서 제거 → 슬롯 사라짐 | ⬜ 확인 |
| `HudController` | `menuButton` (기존) | 코드에서 제거 → 슬롯 사라짐 | ⬜ 확인 |
| `HudController` | `hpLabel`·`hpBar`·`xpBar`·`waveLabel`·`timerLabel`·`levelLabel`·`cardSelectPanel` (기존) | 무변경 — 연결 유지 | ⬜ 유지 확인 |
| `HudController` | `@executionOrder(100)` | 코드 데코레이터(연결 불필요) — HUD가 게임 로직 뒤 실행 | ⬜ 코드 확인 |

---

## 5. 수동 테스트 체크리스트 (인게임 — 7단계 사용자)

- [ ] **HP가 0이 되면 화면이 약 0.8초 멈춘다** — 적·발사체가 정지하고 **HP 바가 0으로 완전히 빈 채** 잠깐 유지된다(죽음 비트).
- [ ] 그 0.8초 뒤 **result(결과) 씬으로 전환**되고 RETRY/MENU 버튼이 뜬다. (이전엔 즉시 전환이라 빈 바를 볼 수 없었음 — F26 해소.)
- [ ] result 씬의 **RETRY**는 main을 재시작, **MENU**는 menu 씬으로 이동한다(회귀 없음).
- [ ] **레벨업 카드 선택 패널**은 그대로 뜨고, 선택 후 게임이 재개된다(`gameOverPanel` 제거가 카드 패널 전환에 영향 없음).
- [ ] 정상 플레이 중 HP 바가 피해에 비례해 즉시 줄어든다(executionOrder — 사망 프레임에도 낡은 값 없이 0 반영).
- [ ] **승리(타이머 0 도달)** 시에는 비트 없이 즉시 result 씬으로 간다(승리 경로는 이번 변경 대상 아님).
- [ ] main 씬에 **게임오버 패널이 뜨지 않는다**(죽은 패널 제거 — 게임오버는 오직 result 씬으로 표현).
