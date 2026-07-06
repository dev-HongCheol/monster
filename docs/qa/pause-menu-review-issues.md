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

---

## 7단계 발견 + 리워크 (2026-07-06)

### B1. 재시작·메뉴 버튼 클릭 시 크래시 (실버그 — 수정됨)
- **위치:** `game/assets/scripts/ui/PauseController.ts` `onDestroy` (구 `:42`)
- **증상:** `Uncaught TypeError: Cannot read properties of null (reading 'off') at PauseController.onDestroy`. Resume은 정상, **재시작·메뉴만** 크래시.
- **원인:** 재시작/메뉴는 `director.loadScene()`로 씬을 파괴 → `onDestroy` 실행. `this.resumeButton?.node.off(...)`의 `?.`는 `resumeButton`(컴포넌트) null만 가드하는데, teardown 중엔 버튼 노드가 먼저 파괴돼 `resumeButton.node`가 `null` → `null.off(...)` 크래시. Resume은 `resumePause()`(씬 로드 없음)라 `onDestroy` 미실행 → 무증상. **코드 리뷰의 "cleanup 대칭·누수 없음" 판단이 teardown 시 `.node=null` 케이스를 놓쳤다.**
- **수정됨:** 버튼 CLICK 리스너는 노드가 씬과 함께 파괴될 때 자동 정리되므로 수동 off가 불필요(오히려 크래시 원인). `onDestroy`에서 버튼 `.off` 3줄을 제거하고 **전역 `input.off`만** 남겼다(`CardSelectPanel`도 버튼 리스너를 onDestroy에서 정리하지 않음 — 같은 이유).

### C1. i18n 방식 전환 — LocalizedLabel → 코드 구동 (사용자 결정)
- **배경:** 7단계에서 라벨이 번역 키 원문(`pause.title`)으로 표시. 파일·임포트·UUID 매핑은 모두 정상이었고, 원인은 라벨 배선(LocalizedLabel 미부착 가능성)/카탈로그 로드 타이밍이었다. main 씬 나머지(HUD·카드·결과)는 전부 코드 구동 i18n을 쓰는데 pause만 LocalizedLabel(menu 씬 방식)이라 일관성도 떨어졌다.
- **결정(사용자):** 코드 구동으로 전환. `PauseController`에 `titleLabel` `@property` 추가 + 버튼 자식 Label을 `getComponentInChildren(Label)`로 찾아, 패널 열림 때 `_applyI18n()`이 `_t('pause.*')`로 채운다. `LocalizedLabel` 의존 제거 → 무조건 해석되고 main 씬과 일관. `_t('pause.*')` 리터럴이라 i18n 키 가드가 사용 키로 detect(이전에 넣었던 `sceneKeyPrefixes: 'pause.'` 화이트리스트 회수).
- QA 문서 §2·§3·§4를 코드 구동 기준으로 갱신. 잘림은 라벨 크기(버튼 대비) 문제였음(사용자 정정 — overflow 아님) → 레시피를 Content Size 기준으로 수정.

### 재리뷰 (rework delta `0f31cb5..e5a2344`)
독립 subagent 재리뷰: Critical 0 · Important 0 · Minor 2(비차단). 평결 **머지 가능(Yes)**.
- onDestroy 수정이 크래시를 완전히 닫음 확인 — 자손 노드가 컨트롤러보다 오래 못 살아 버튼 리스너 누수 없음, 전역 `input.off`는 `onLoad`와 정확히 대칭.
- 코드 구동 i18n 건전(HudController 패턴), null 가드 정상. `getComponentInChildren(Label)`도 `HudController._applySlot`와 동일 관용.
- `sceneKeyPrefixes` 회수 안전 검증 — 4개 `_t('pause.*')` 리터럴 전부 스캐너 detect(카탈로그·코드 정확히 4키 일치), 가드 13/13.
- Minor 2건(비차단): ① 일시정지 중 언어 전환은 다음 열림에 반영(의도된 trade-off, 인게임 언어 토글 미도달) ② 미배선 `titleLabel`/자식 Label 없으면 조용히 미현지화(null 가드로 크래시는 없음 — 에디터 배선 = QA 체크리스트 소관). 수정 불필요.
