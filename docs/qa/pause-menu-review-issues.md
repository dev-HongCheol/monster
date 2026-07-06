# 일시정지 메뉴 (J4 P0-3) — 코드 리뷰 기록

- **브랜치:** feat/pause-menu
- **리뷰 커밋:** BASE `6fdaeb3` → HEAD `0f31cb5`
- **리뷰어:** general-purpose subagent (superpowers:requesting-code-review 패턴)
- **결과:** 버그 0 (Critical 0 · Important 0) · 관찰 3건(Minor, 전부 비차단)

---

## 요약

리뷰어가 지목했던 4개 위험을 실제 코드로 검증해 모두 안전 확인:
1. **ESC 엣지** — `pauseToggleAction`이 LevelUp/GameOver/Victory에서 `'ignore'`, `_onKeyDown`은 `'pause'`/`'resume'`에만 동작. 카드 선택·게임오버·승리 중 일시정지 불가(테스트로 잠금).
2. **버튼 리스너 생명주기** — 초기 비활성 `PausePanel` 자식 버튼에 `node.on(CLICK)` 등록은 정상(활성 시에만 발화). `onDestroy`에서 대칭 해제 → 씬 재로드(restart/menu) 누수 없음. `PlayerController` 패턴과 동일.
3. **순환 import** — `GameManager → ExperienceManager → XPItemController → GameManager` 사이클이 실재하나, 모든 참조가 메서드 본문(런타임)에서만 일어나고 모듈 평가 시점엔 없어 안전. 기존 SpellCaster/Projectile 등과 동일. 전체 스위트 403/403 정상 로드.
4. **enum 망라성** — 모든 `GameState` 사용처가 `!== Playing` 가드 또는 개별 동등 비교. 망라 `switch`/`assertNever` 없음. `HudController._handleStateChange`는 LevelUp/Playing만 보고 나머지는 무시 → `Paused` 추가로 회귀 없음.

**평결: 코드 측면 머지 가능(Yes).** 남은 건 7단계 에디터 배선 + 수동 QA + I3 라이브 검증(diff 밖).

## 강점 (리뷰어 지적)
- 기존 패턴 충실 재사용(`enterLevelUp`/`resumeFromLevelUp`·`HudController._handleStateChange`·`PlayerController` 리스너).
- 순수 결정 함수(`pauseToggleAction`)로 유일한 분기 로직을 격리, 5분기 전부 테스트.
- I2 가드 위치 정확(비-Playing 전체 차단 = Paused·LevelUp 동시 닫힘).
- i18n 키 가드 `sceneKeyPrefixes`에 `pause.` 추가로 orphan 오탐 방지(house 패턴).

## 관찰 (Minor — 비차단)

### O1. PauseController가 미배선 `@property`에 조용히 no-op (로버스트니스)
- **위치:** `game/assets/scripts/ui/PauseController.ts` `onLoad`
- **내용:** `HudController.onLoad`(필수 prop 누락 시 `console.error` + `this.enabled=false`)와 달리 PauseController는 `if (this.pausePanel)`·옵셔널 체이닝만 쓴다. 7단계에서 `pausePanel`을 안 연결하면 ESC로 상태는 `Paused`가 되지만 **오버레이가 안 떠 "메뉴 없이 얼어붙은" 증상**이 조용히 난다.
- **판단:** 올바로 배선된 사용에선 버그 아님(리뷰어: optional hardening). QA §3 체크리스트가 배선을 커버한다. **이번 슬라이스에서 수정 안 함** — house 패턴(필수 prop 누락 시 loud fail) 정합화는 백로그 로버스트니스 항목으로 남긴다.

### O2. `enterPause`/`resumePause` 내부 가드는 미테스트·(ESC 경로선) 중복
- **위치:** `game/assets/scripts/systems/GameManager.ts` `enterPause`/`resumePause`
- **내용:** `pauseToggleAction`이 호출부를 이미 게이팅하므로 ESC 경로에선 `if (state !== Playing) return`이 안 걸린다. 다만 버튼은 `resumePause()`를 직접 부르고 `enterLevelUp` 미러라 방어적으로 유지가 맞다. 가드 자체는 Cocos 결합이라 단위 테스트 대상 아님. **변경 없음(의도된 방어).**

### O3. (Trivia) pre-`_started` 로드 비트 중 ESC
- 데이터 로드 전 ESC로 `Paused`가 되어 로딩 프레임 위에 패널이 뜰 수 있으나, 루프가 `_started`·`Playing` 둘 다로 게이팅돼 무해하고 로드 속도상 사실상 도달 불가. **변경 없음.**
