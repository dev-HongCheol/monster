# 사망 → 게임오버 연출 계획 (death-flow)

- **브랜치:** feat/death-flow
- **작성일:** 2026-07-04
- **슬라이스 성격:** 완성도(J4/J2 인접) — 게임 필 버그 + 죽은 코드 정리
- **닫는 백로그 항목:** [F26] 사망→게임오버 연출 (바가 0으로 비는 비트 없이 result 씬 직행 + `gameOverPanel` 죽은 코드 + `HudController` executionOrder 부재)
- **office-hours 결정:** Approach A(죽음 비트 + 정리) — 결정 로그 `f1659861`
- **설계 개정(2026-07-04):** 죽음 비트를 지속 타이머 필드 → 엔진 `scheduleOnce` 위임으로 변경. `GameManager`에 지속 상태(mutable field)를 추가하지 않고, 순수 로직 모듈(`DeathFlowLogic`)도 없앤다(테스트 거리만 위해 뺐던 코드 제거).
- **설계 개정(2026-07-05):** 죽음 비트를 "빈 정지 0.8초"에서 **연출 seam**으로 재설계. `scheduleOnce`만으로는 화면이 아무 움직임 없이 얼어붙어 렉/행처럼 보였다(사용자 인게임 피드백). flow(언제 씬을 넘길지)와 presentation(그 틈에 무엇이 보일지)을 분리해, `GameManager`는 `DeathSequence.play(onComplete)` 하나만 알고 연출은 별도 컴포넌트(`ui/DeathSequence`)가 소유한다. 지금은 가장 간단한 연출(오버레이 페이드) 하나만 꽂고, 플래시·셰이크·슬로모 등 나머지는 백로그로 미룬다 — 연출을 바꿔도 `GameManager`는 불변이다.

---

## 1. 배경과 목적

플레이어가 죽는 순간이 화면에 읽히지 않는다. 지금은 HP가 0이 되는 그 프레임에 곧바로 결과 화면(`result` 씬)이 로드돼, HP 바가 0으로 비는 장면을 볼 틈이 없다. 사용자가 인게임 테스트에서 "바가 안 빈 채 RETRY가 뜬다"고 느낀 것이 이 때문이다. 죽음이 주는 무게가 사라지고, 갑자기 결과창으로 튕겨 나간 것처럼 보인다.

이 슬라이스는 죽는 순간과 결과 화면 사이에 짧은 "죽음 비트"를 넣어, 빈 HP 바를 잠깐 보여준 뒤 결과 화면으로 넘긴다. 같은 흐름에 얽힌 곁가지 두 가지 — 실제로는 뜨지 않는 `gameOverPanel` 죽은 코드와, 사망 프레임에 HUD가 한 프레임 낡게 그려질 수 있는 `executionOrder` 문제 — 를 함께 닫는다.

## 2. 현재 동작 (근거)

피해는 0.5초 피격 틱(무적 창) 단위로 뭉텅이로 들어온다(`GameManager._tickPlayerDamage`). 마지막 틱이 양수이던 HP를 한 번에 0으로 만들고, 그 자리에서 결과 씬을 로드한다.

- `GameManager._applyDamage`(`systems/GameManager.ts:210`) — HP를 깎고 `_playerHp <= 0`이면 `GameResult.waveReached`를 기록하고 `state = GameOver`로 바꾼 뒤 **같은 호출에서** `goToResult()`(=`director.loadScene('result')`)를 부른다.
- `HudController._handleStateChange`(`ui/HudController.ts:100`) — `GameOver`를 감지해 `gameOverPanel.active = true`를 세팅하지만, 결과 씬이 즉시 스왑돼 이 패널이 눈에 띌 틈이 없다. `gameOverPanel`·`restartButton`·`menuButton`은 코드베이스에서 `HudController`에서만 참조되며, 실질적으로 실행되지 않는 코드(dead code)다. (RETRY/MENU 기능은 별도 `result` 씬의 `ResultController`가 담당한다.)
- `GameManager`·`HudController` 둘 다 `@executionOrder`가 없어, HUD가 게임 로직보다 먼저 도는 프레임이면 HP 바가 직전 프레임 값으로 한 프레임 낡게 그려질 수 있다.

`result` 씬은 승리·패배 모두의 정본 결과 화면이다(도달 웨이브 표시 + RETRY/MENU). 이 슬라이스는 그 구조를 유지하고, main 씬 쪽의 중복 게임오버 UI만 걷어낸다.

## 3. 설계

### 3.1 죽음 비트 (연출 seam — flow와 presentation 분리)

죽음 비트를 두 관심사로 가른다. **flow**(언제 result 씬으로 넘길지)는 `GameManager`가, **presentation**(그 틈에 무엇이 보일지)은 별도 `DeathSequence` 컴포넌트가 소유한다. `GameManager`는 연출이 무엇인지·얼마나 긴지 모르고 `play(onComplete)` 하나만 안다. 그래서 나중에 연출을 페이드에서 플래시·셰이크·슬로모·사망 애니로 바꿔도 `DeathSequence`만 손대면 되고 `GameManager`는 불변이다.

`_applyDamage`에서 HP가 0 이하가 되면 `GameResult.waveReached`를 기록하고 `state = GameOver`로 바꾼 뒤 `_startDeathSequence()`를 부른다. 이 메서드는 연출이 배선돼 있으면 그쪽에 위임하고, 없으면 `scheduleOnce` 폴백(빈 정지)을 쓴다. 상수 `DEATH_BEAT_SEC = 0.8`은 이제 **폴백 전용**이고, 실제 비트 길이는 `DeathSequence.fadeSec`가 소유한다.

```ts
// GameManager — flow만.
private _startDeathSequence(): void {
  const done = () => this.goToResult();
  if (this.deathSequence) this.deathSequence.play(done);  // 연출이 타이밍 소유
  else this.scheduleOnce(done, DEATH_BEAT_SEC);           // 미배선 폴백
}
```
```ts
// DeathSequence(ui/) — presentation. 지금 연출 = 오버레이 페이드 하나.
play(onComplete: () => void): void {
  // overlay(풀스크린 검은 Sprite)의 UIOpacity를 fadeSec에 걸쳐 0→255로 tween → onComplete
}
```

`state = GameOver`가 되는 순간 모든 게임 시스템(적·발사체·스포너·웨이브·`GameManager.update`의 피해 틱)이 각자의 `Playing` 가드로 멈춘다. `HudController.update`만 상태 가드가 없어 계속 돌며 빈 HP 바(`barRatio(0, maxHp) = 0`)를 그린다. 그 정지 위에 오버레이가 서서히 어두워지는 페이드가 겹쳐, 전장이 멈춘 채 화면이 어두워지는 순간이 `fadeSec`(기본 0.8초)간 흐른 뒤 `onComplete`가 `goToResult()`를 불러 result 씬을 로드한다.

**렉 느낌의 원인과 해소:** 이전 설계는 GameOver로 전환된 순간 화면이 완전히 얼어붙기만 했다 — 완전 정지 프레임은 렉/행과 시각적으로 구분되지 않아 "죽음의 무게"가 아니라 "버벅임"으로 읽혔다. 정지 위에 지속적으로 변하는 모션(페이드)을 겹치면 같은 0.8초가 "정지"가 아니라 "전환"으로 읽힌다. 이것이 이번 개정의 핵심이고, 페이드는 그 최소 구현이다(더 강한 연출은 §6 백로그).

**전제:** freeze를 `director.pause()`가 아니라 시스템별 상태 가드로 구현하는 현 구조라 `scheduleOnce`·tween은 정상 시간으로 흐른다. `_applyDamage`는 `state === Playing`에서만 도달하는 경로(피해 제출·틱이 모두 Playing 가드 뒤)라 GameOver 진입 후 재진입이 없고, `DeathSequence.play`도 `_playing` 가드로 중복 재생을 막는다. tween/UIOpacity API는 Context7로 Cocos 3.8 공식 문서 확인 완료(`tween(uiOpacity).to(sec, { opacity }).call(cb).start()`).

### 3.2 HudController executionOrder

`HudController`에 `@executionOrder(100)`를 준다(`_decorator`에서 `executionOrder` import). `GameManager`는 기본값 0이므로, HUD가 게임 로직 뒤에 돌아 매 프레임 최신 상태(HP 포함)를 읽는다. 코드베이스에 이미 `I18n`이 `@executionOrder(-1)`로 같은 패턴을 쓴다. 이건 상태 변수가 아니라 렌더 순서 데코레이터다.

죽음 비트 프리즈가 사망 프레임의 staleness는 이미 덮으므로(수십 프레임이 HP 0을 그린다), `executionOrder`는 사망 케이스가 아니라 **평상시 HP 표시가 한 프레임 낡는 것**을 막는 별도 정합 개선이다(F26 (b)).

### 3.3 gameOverPanel 죽은 코드 제거

`HudController`에서 다음을 걷어낸다.

- `@property` 세 개: `gameOverPanel`·`restartButton`·`menuButton`.
- `onLoad`의 필수 프로퍼티 가드 `if (!this.hpLabel || !this.gameOverPanel || !this.restartButton)` → `if (!this.hpLabel)`로 축소, `gameOverPanel.active = false` 초기화와 버튼 콜백 배선 제거.
- `_handleStateChange`의 `GameOver` 분기와 Playing 분기의 `gameOverPanel` 비활성화 줄 제거. `LevelUp`↔`Playing`의 `cardSelectPanel` 전환은 그대로 둔다.
- 이제 쓰이지 않는 `_onRestart`·`_onMenu` 메서드 제거.

씬 노드(`GameOverPanel`과 그 자식 `RestartButton`·`MenuButton`)는 사용자가 7단계 에디터 작업에서 제거한다(QA 문서에 명시). 코드에서 `@property`가 사라지면 씬의 해당 참조는 무해하게 방치되므로, 노드 제거는 시각적 정리이며 동작에는 영향이 없다.

## 4. 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `ui/DeathSequence.ts` (신규) | 죽음 연출 컴포넌트. `play(onComplete)`가 `overlay`(풀스크린 검은 Sprite)의 UIOpacity를 `fadeSec`에 걸쳐 0→255로 tween한 뒤 콜백. 오버레이 미배선 시 `scheduleOnce` 폴백, `_playing` 중복 재생 가드 |
| `systems/GameManager.ts` | `@property deathSequence` 추가, `DEATH_BEAT_SEC`는 폴백 전용으로 의미 변경. `_applyDamage`가 즉시 `goToResult` 대신 `_startDeathSequence()` 호출 — 연출 배선 시 위임, 아니면 `scheduleOnce` 폴백. 새 상태 필드·`update` 분기 없음 |
| `ui/HudController.ts` | `@executionOrder(100)`, `gameOverPanel`/`restartButton`/`menuButton` 및 관련 배선·`_onRestart`·`_onMenu` 제거, `onLoad` 가드·`_handleStateChange` 정리 |
| (씬, 사용자) `main.scene` | `GameOverPanel` 노드 트리 제거 + **`DeathOverlay` 노드 신설**(풀스크린 검은 Sprite) + `DeathSequence` 컴포넌트 배치·배선 (7단계) |

## 5. 테스트 전략

이번 변경은 전부 Cocos 프레임워크에 의존한다 — `DeathSequence`의 `tween`/`UIOpacity`(오버레이 페이드)·`scheduleOnce`(폴백)·`director.loadScene`(씬 로드)·`@executionOrder`(렌더 순서)·씬 노드 조작으로, 결정적으로 테스트할 순수 로직 파일이 없다. seam 분기(`deathSequence ? play : scheduleOnce`)도 trivial한 배선이라 순수 모듈로 뺄 거리가 아니다. 따라서 `pnpm wf skip-test`으로 피처 테스트를 스킵하고, 기존 전체 스위트는 GREEN 유지 여부만 확인한다.

죽음 비트의 실제 페이드·씬 로드 타이밍, `executionOrder` 반영, 씬 노드 조작은 7단계 수동 인게임 테스트로 검증한다(QA 문서 체크리스트).

## 6. 스코프 (IN / OUT)

**이번에 IN:** 연출 seam(`DeathSequence`) + 가장 간단한 연출 하나 — 오버레이 페이드. 정지 위에 화면이 어두워지는 모션을 겹쳐 렉 느낌을 없애는 최소 구현이다.

**OUT (백로그로 — 전부 `DeathSequence` 안에서 layering하며 `GameManager`는 불변):**

- **더 강한 죽음 연출:** 순간 붉은 플래시(t=0 펀치)·카메라 셰이크·슬로모션(전역 타임스케일 — 시스템 관여 필요)·채도 감소(그레이스케일)·플레이어 사망 애니메이션. 페이드로 렉 느낌은 이미 해소되므로 이들은 "필(feel) 강화"로 뒤로 미룬다.
- **씬 로드 플래시 가리기:** 오버레이는 `director.loadScene` 시 현재 씬과 함께 파괴돼 로드 순간의 플래시까지는 덮지 못한다. 오버레이를 씬 로드 너머까지 유지(persist)하거나 result 씬을 검은 화면에서 페이드인하는 것은 별도 작업으로 미룬다.
- **승리(Victory) 비트:** `gameTimer`가 0이 되는 승리 경로는 "바가 비는" 문제가 없어 지금처럼 즉시 `goToResult()`를 유지한다. 대칭 연출이 필요하면 같은 seam(`DeathSequence`/후속 `VictorySequence`)을 재사용한다(백로그 후보).
- **인게임 게임오버 패널 승격(Approach C):** result 씬을 대체하는 인게임 오버레이는 씬 재구조화·승패 UI 분기 위험으로 이번 스코프에서 제외(office-hours에서 기각).

## 7. Impact Map (회귀 기준)

- `GameManager._applyDamage` → `_startDeathSequence`: 사망 시 즉시 씬 로드 → 연출(`DeathSequence.play`)에 위임 후 콜백에서 로드(미배선이면 `scheduleOnce` 폴백). **회귀 확인:** 죽으면 약 0.8초에 걸쳐 화면이 어두워진 뒤 result 씬에 도달하는가, 그 사이 전장이 멈춘 채 HP 바가 0으로 비는가. 승리(`gameTimer` 0) 경로는 즉시 로드 유지 확인.
- `DeathSequence`(신규): 오버레이 페이드 + 콜백. **회귀 확인:** 오버레이가 0→불투명으로 부드럽게 어두워지는가, 페이드 종료와 동시에 씬이 넘어가는가, 오버레이 미배선 시에도(폴백) 크래시 없이 전환되는가.
- `HudController`: executionOrder + 죽은 코드 제거. **회귀 확인:** HP/XP/웨이브/레벨 레이블·바 정상, 레벨업 카드 패널 전환 정상, 게임오버 패널 제거 후 이상 없음.
