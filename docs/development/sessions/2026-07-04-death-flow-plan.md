# 사망 → 게임오버 연출 계획 (death-flow)

- **브랜치:** feat/death-flow
- **작성일:** 2026-07-04
- **슬라이스 성격:** 완성도(J4/J2 인접) — 게임 필 버그 + 죽은 코드 정리
- **닫는 백로그 항목:** [F26] 사망→게임오버 연출 (바가 0으로 비는 비트 없이 result 씬 직행 + `gameOverPanel` 죽은 코드 + `HudController` executionOrder 부재)
- **office-hours 결정:** Approach A(죽음 비트 + 정리) — 결정 로그 `f1659861`
- **설계 개정(2026-07-04):** 죽음 비트를 지속 타이머 필드 → 엔진 `scheduleOnce` 위임으로 변경. `GameManager`에 지속 상태(mutable field)를 추가하지 않고, 순수 로직 모듈(`DeathFlowLogic`)도 없앤다(테스트 거리만 위해 뺐던 코드 제거).

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

### 3.1 죽음 비트 (엔진 스케줄러에 위임)

`GameManager`는 "죽었다"는 상태만 바꾸고, 0.8초 뒤 결과 씬 로드는 엔진 스케줄러(`Component.scheduleOnce`)에 던진다. 지속 타이머 필드나 `update` 카운트다운을 두지 않는다 — 게임 상태·HP를 관리하는 클래스에 연출 타이밍용 가변 상태를 얹지 않기 위해서다.

- 상수 `DEATH_BEAT_SEC = 0.8`(placeholder, 튜닝 노브)만 추가한다. 새 필드는 없다.
- `_applyDamage`에서 HP가 0 이하가 되면 `GameResult.waveReached`를 기록하고 `state = GameOver`로 바꾼 뒤, **즉시 `goToResult()`를 부르던 줄을 `scheduleOnce`로 지연시킨다.**

```ts
private _applyDamage(amount: number): void {
  this._playerHp = Math.max(0, this._playerHp - amount);
  if (this._playerHp <= 0) {
    GameResult.waveReached = WaveManager.instance.waveNumber;
    this._state = GameState.GameOver;
    this.scheduleOnce(() => this.goToResult(), DEATH_BEAT_SEC);
  }
}
```

`state = GameOver`가 되는 순간 모든 게임 시스템(적·발사체·스포너·웨이브·`GameManager.update`의 피해 틱)이 각자의 `Playing` 가드로 멈춘다. `HudController.update`만 상태 가드가 없어 계속 돌며 빈 HP 바(`barRatio(0, maxHp) = 0`)를 여러 프레임 그린다. 즉 전장이 멈춘 채 빈 바만 남는 "죽음의 정지" 순간이 0.8초간 유지되고, 그 뒤 스케줄러가 `goToResult()`를 불러 결과 씬을 로드한다.

이 방식이 **지속 상태를 0개 추가**하는 게 핵심이다. 손수 만든 타이머-필드 방식이었다면 후속으로 승리 비트·페이드 등이 생길 때마다 `GameManager`에 `_victoryBeatTimer` 같은 필드가 누적됐겠지만, fire-and-forget 스케줄러 호출은 후속 전이도 같은 한 줄로 끝나 필드가 쌓이지 않는다. 씬 플로우(`goToResult`·`restart`·`goToMenu`)는 원래 `GameManager` 소관이므로, 그 전이에 딜레이를 다는 것도 같은 책임 범위 안이다(연출 로직을 UI에서 끌어오는 게 아니다).

**전제:** freeze를 `director.pause()`가 아니라 시스템별 상태 가드로 구현하는 현 구조라 `scheduleOnce`는 정상 시간으로 흐른다. `_applyDamage`는 `state === Playing`에서만 도달하는 경로(피해 제출·틱이 모두 Playing 가드 뒤)라 GameOver 진입 후 재진입이 없어 중복 스케줄 걱정도 없다. (구현 시 `scheduleOnce` 시그니처는 Context7로 Cocos 3.8 공식 문서 확인 후 확정.)

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
| `systems/GameManager.ts` | `DEATH_BEAT_SEC` 상수 추가, `_applyDamage`에서 즉시 `goToResult` → `scheduleOnce(() => goToResult, DEATH_BEAT_SEC)`로 지연. 새 필드·`update` 분기 없음 |
| `ui/HudController.ts` | `@executionOrder(100)`, `gameOverPanel`/`restartButton`/`menuButton` 및 관련 배선·`_onRestart`·`_onMenu` 제거, `onLoad` 가드·`_handleStateChange` 정리 |
| (씬, 사용자) `main.scene` | `GameOverPanel` 노드 트리 제거 (7단계) |

## 5. 테스트 전략

이번 변경은 전부 Cocos 프레임워크에 의존한다 — `scheduleOnce`(엔진 스케줄러)·`director.loadScene`(씬 로드)·`@executionOrder`(렌더 순서)·씬 노드 제거로, 결정적으로 테스트할 순수 로직 파일이 없다. 따라서 `pnpm wf skip-test "죽음 비트는 엔진 scheduleOnce + 씬 로드로 구현돼 순수 로직 없음"`으로 피처 테스트를 스킵한다. 기존 전체 스위트는 GREEN 유지 여부만 확인한다.

죽음 비트의 실제 프리즈·씬 로드 타이밍, `executionOrder` 반영, 씬 노드 제거는 7단계 수동 인게임 테스트로 검증한다(QA 문서 체크리스트).

## 6. 스코프 밖 (OUT)

- **승리(Victory) 비트:** `gameTimer`가 0이 되는 승리 경로는 "바가 비는" 문제가 없어 지금처럼 즉시 `goToResult()`를 유지한다. 대칭 연출이 필요하면 후속으로 같은 `scheduleOnce` 패턴을 재사용할 수 있다(백로그 후보).
- **페이드/암전 트랜지션:** 비트를 빈 바만으로 둔다. 검은 오버레이 페이드아웃(씬 로드 플래시까지 덮는)은 별도 오버레이 노드가 필요해 UI 완성도 슬라이스(J4)로 미룬다.
- **인게임 게임오버 패널 승격(Approach C):** result 씬을 대체하는 인게임 오버레이는 씬 재구조화·승패 UI 분기 위험으로 이번 스코프에서 제외(office-hours에서 기각).

## 7. Impact Map (회귀 기준)

- `GameManager._applyDamage`: 사망 시 즉시 씬 로드 → `scheduleOnce`로 0.8초 뒤 로드. **회귀 확인:** 죽으면 약 0.8초 후 result 씬에 도달하는가, 그 사이 전장이 멈춘 채 HP 바가 0으로 비는가. 승리(`gameTimer` 0) 경로는 즉시 로드 유지 확인.
- `HudController`: executionOrder + 죽은 코드 제거. **회귀 확인:** HP/XP/웨이브/레벨 레이블·바 정상, 레벨업 카드 패널 전환 정상, 게임오버 패널 제거 후 이상 없음.
