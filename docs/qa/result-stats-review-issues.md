# 결과 화면 런 통계 (result-stats) — 코드 리뷰 이슈

- **리뷰 커밋:** `90d99c9..d9d10c0` (리워크 재리뷰, 2026-07-10). 이전 차수: `c9f4f99..af5169b`(2026-07-07)
- **성격:** superpowers:requesting-code-review 패턴 subagent 리뷰 결과. 코드 품질·타입·실제 버그는 즉시 수정(수정됨 표시), 정책/설계 지적은 기록.

---

## Critical

### C1. 결과 씬에 `DataManager`가 없어 킬·마법 섹션이 **빈 채로 렌더** → **수정됨**
`ResultController`가 렌더 시점에 `DataManager.instance?.getSpell/getEnemy`로 적/마법 데이터를 해석했는데, **result.scene엔 `DataManager` 노드가 없고**(확인: scene에 DataManager 참조 0건) `DataManager.onDestroy`가 메인 씬 teardown 시 static `instance`를 null로 지운다(`DataManager.ts:61-65`). `addPersistRootNode`도 없다. → 결과 씬에서 `DataManager.instance`가 null → 콜백이 모든 id에 null 반환 → `buildResultStats`의 정합 가드가 **모든 킬·모든 마법을 조용히 드롭** → `killTotal=0`, 킬 리스트·마법 행이 빈다(핵심 통계 2종이 공백, 가드가 "데이터 없음"으로 은폐). 생존·레벨·패시브는 `GameResult` 직접 읽어 정상.
- **수정:** 표시에 필요한 값(적 **이름**, 마법 **분류·티어**)을 **스냅샷 시점(메인 씬, DataManager 생존)** 에 이미 해석해 `GameResult`에 담는다. `buildResultStats`는 콜백 없이 해석된 입력만 받아 포맷·정렬·브레이크다운만 한다(계획의 "ResultController는 GameResult만 읽는다" 원칙과 정합). DataManager 결과 씬 배선·async 레이스 불필요.
  - `ResultStatsLogic`: `buildResultStats(input)` 콜백 제거. 입력 `kills: {name,count}[]`(해석됨) + `spells: {id,category,tier,dmg,cd}[]`(분류·티어 포함).
  - `GameManager._snapshotResult`: 킬 이름 해석(미존재 적 스킵) → `GameResult.kills`. 마법은 `DeckManager.resultSpellSnapshots`(분류·티어 포함) → `GameResult.spells`.
  - `ResultController`: `DataManager` import 제거, `GameResult`만 매핑.
  - **정합 가드 이동:** getSpell=null(마법)·getEnemy=null(킬) 제외가 순수 함수 → 스냅샷 계층으로 이동(`resultSpellSnapshots`는 기존부터 getSpell=null 스킵, `_snapshotResult`는 getEnemy=null 스킵). 순수 테스트의 두 가드 케이스는 제거(해당 동작이 계층 이동).

---

## Important

### I1. 필수 `@property` 미연결 시 loud-fail 부재 (QA 문서가 구현 약속) → **수정됨**
`ResultController.onLoad`·렌더가 미연결 `@property`에 조용히 `return`한다. QA 문서 §5.1이 "필수 `@property` 미연결 시 `onLoad` loud-fail(`console.error`)" 구현을 명시(백로그 F29 결)했으나 미구현. 7단계 10개 배선 중 하나만 빠져도 조용히 새는 F29 증상.
- **수정:** `onLoad`에서 필수 `@property`(waveLabel·survivalLabel·levelLabel·killTotalLabel·killListLabel·spellListContent·spellRowPrefab·passiveLabel·retry/menu) null 검사 → `console.error`로 누락 목록 출력 + `this.enabled=false`(HudController house 패턴).

### I2. `getComponentInChildren(Label/RichText)` 프리팹 위치 의존 취약성 → **수정됨**
`_renderSpells`가 인스턴스화한 행에서 첫 `Label`·첫 `RichText`를 위치로 찾는다. RichText는 string 세팅 시 자식 Label을 생성하므로, 프리팹 RichText 초기 문자열이 비어 있어야만(관례) 이름 Label이 첫 Label로 잡힌다. 프리팹이 비-빈 placeholder로 저장되면 오라우팅 위험.
- **수정:** 위치 탐색 → **명명 자식**(`getChildByName`)으로 결정적 해석. 프리팹 자식 이름 `Name`(Label)·`Breakdown`(RichText) 규약. QA 문서 §4.2에 반영.

---

## Minor

### M1. QA 문서 커버리지 오귀속 → **수정됨**
QA 문서 §1이 "maxed 전역 카드 제외"를 `EnhancementLogic` 테스트가 덮는다고 했으나, 그 로직은 `DeckManager._isMaxedGlobalCard`(cc, 단위 테스트 없음)에 있다. `EnhancementLogic` 테스트는 레벨 상한·배율 동결만 덮는다. → 문서를 "전역 카드 제외는 수동 QA" 로 정정.

### M2. `_isMaxedGlobalCard` 이중 효과 카드 과다 제외(잠재) → **주석 추가(수정됨)**
`damageMult`·`cooldownMult`를 둘 다 가진 카드는 한 옵션만 maxed여도 제외된다. 현재 그런 카드 없음(`damage_boost`·`cooldown_reduce` 분리, 확인). 단일 효과 가정 주석 추가.

### M3. 킬 정렬 명시적 안정화 → **수정됨**
`buildResultStats` 킬 정렬이 동률에서 ES2019 안정 정렬에 의존(마법 정렬은 idx 타이브레이크 있음). 패리티로 킬에도 idx 타이브레이크 추가.

---

## 재검증
C1(콜백 제거) 리팩터로 코드 변경 → `pnpm wf invalidate` 후 cso→ts→lint→review 재실행.

### TypeScript (`mcp__ide__getDiagnostics`, 2026-07-10)
변경 6개 파일을 VS Code에 열어 진단을 받았다(언어 서버는 **열린 파일만** 분석하므로, 닫힌 파일의 빈 결과는 "에러 없음"이 아니라 "미분석"이다 — 이전 세션이 차단됐던 지점).

- `GameTypes.ts` · `ResultStatsLogic.ts` · `ResultController.ts` · `ResultStats.test.ts` — **Error 0건** ✅
- `DeckManager.ts:25` · `GameManager.ts:28` — `TS1255` (`static instance!:`). **백로그 F27의 알려진 오탐**(VS Code TS ↔ Cocos 번들 TS 불일치). 이번 변경이 건드리지 않은 줄이며, 매니저 싱글톤 6곳이 공유하는 기존 패턴이다.
- `GameManager.ts:310` — `TS2550` (`Object.entries`). Cocos 생성 `tsconfig`가 `target: ES2015`에 `lib` 오버라이드가 없어 ES2017 API가 타입에 없다. **기존 이슈로 확정**: 이미 main에 있는 `SpawnDirectorLogic.ts:46,71`에서 동일 에러가 재현되고(implicit-any 4건까지 파생), 런타임 Chromium에는 `Object.entries`가 존재해 실행은 정상이다. 이번 슬라이스는 이 호출을 `ResultStatsLogic` → `GameManager`로 **옮겼을 뿐 새로 만들지 않았다**. → 백로그 **F30**으로 등재.

결론: 이번 변경에 기인한 TypeScript Error 0건 → `pnpm wf pass ts`.

---

## 재리뷰 (`c9f4f99..c6a3b20`, subagent 리뷰, 2026-07-10)

C1 수정 커밋(`bfb328f`)이 새 결함을 만들지 않았는지 확인하는 재리뷰. **Critical 0건** — "C1 리팩터는 정확하고 완전하며, `GameResult` static은 매 결과 씬 진입마다 새로 채워진다(`loadScene('result')`가 `goToResult()` 한 경로뿐이고 그 앞에서 항상 `_snapshotResult()`가 모든 필드를 재대입)"로 확인됐다.

### R1. 이동한 정합 가드 두 개가 무테스트 상태 → **백로그 이관(F31)**
C1에서 정합 가드가 순수 함수에서 cc 계층으로 옮겨가며(`GameManager._snapshotResult`의 getEnemy=null 스킵, `DeckManager.resultSpellSnapshots`의 getSpell=null 스킵) 순수 테스트 2건이 삭제됐고, 옮겨간 자리는 `DataManager.instance` static에 묶여 vitest로 태울 수 없다. 커버리지 회귀가 맞다.

다만 두 가드가 지키는 분기는 **실질적으로 도달 불가능한 방어 코드**다 — 런타임 id는 가드가 대조하는 바로 그 JSON에서 나온다. 리뷰어도 "merge 차단 아님"으로 판정했고, 해소책(`buildSpellSnapshots(ownedIds, getSpell, getLevel…)` 순수 헬퍼 추출)은 슬라이스 밖 리팩터라 백로그 **F31**로 올린다. QA 문서는 이미 이 분기를 수동 QA로 표기하고 있다.

### R2. `GameResult.spells` 인라인 타입이 `ResultSpellSnapshot`과 구조적으로만 연결 → **의도된 것(기록만)**
`GameTypes`가 `ResultStatsLogic`을 import하면 순환 import가 된다(`ResultStatsLogic` → `GameTypes`). 코드에 이미 그 사유가 주석돼 있고, `ResultController` 호출부가 구조 불일치 시 컴파일 에러를 낸다(부분적 컴파일 타임 보호). 변경 없음.

### R3. 승리 시 생존 시간 문서 오기 → **수정됨**
QA 문서 §6이 승리 생존 시간을 `20:00`으로 적었으나 `GameManager.gameDuration`은 기본값·main 씬 직렬화 값 모두 `900`초라 실제로는 `15:00`이다. 수동 테스터를 오도할 수 있어 문서를 실제 값 기준으로 고쳤다. 코드(`survivalSec = gameDuration - gameTimer`)는 정상.

### R4. `DeckManager.resultSpellSnapshots`의 `DataManager.instance.getSpell` 옵셔널 체이닝 부재 → **의도된 것(반영 안 함)**
리뷰어는 주변이 `?.`를 쓰는데 여기만 안 쓴다는 스타일 불일치로 지적했다. **반영하지 않는다** — 이 슬라이스가 고친 C1의 교훈이 정확히 그 반대 방향이기 때문이다.

`DataManager.instance`가 null인 상황에서 `?.`를 붙이면 `getSpell`이 `undefined`를 반환하고, 기존 `spell === null` 가드가 이를 잡지 못한 채(strict 비교) 다음 줄 `spell.category`에서 터지거나, 가드를 `== null`로 느슨하게 바꾸면 **모든 마법이 조용히 드롭돼 마법 섹션이 빈 채로 렌더**된다. 이는 C1이 만든 장애 모드(정합 가드가 "데이터 없음"으로 은폐)와 동일하다. 지금처럼 `?.` 없이 두면 그 상황에서 즉시 TypeError로 크게 실패한다 — 조용한 빈 화면보다 낫다.

호출 맥락상 이 함수는 메인 씬 teardown 전(`_snapshotResult`)에만 불리므로 `DataManager.instance`는 항상 살아 있다. 즉 이 분기는 "일어나면 버그"이고, 그때는 시끄럽게 죽는 게 맞다.

> 참고: 같은 논리로 보면 `_snapshotResult`의 `DataManager.instance?.getEnemy(id)?.name`(킬 이름) 쪽이 오히려 instance null 시 **모든 킬을 조용히 드롭**한다. 동일 호출 맥락이라 현재 발현하지 않지만, F31에서 순수 헬퍼로 추출할 때 두 경로의 실패 모드를 "시끄럽게 실패"로 통일하는 것을 함께 검토한다.

### 결론
Critical·Important 중 **코드 수정이 필요한 항목 없음**(R1은 백로그 이관, R2·R4는 의도된 설계, R3은 문서 수정). 코드 변경이 없으므로 `pnpm wf invalidate` 불필요 → `pnpm wf pass review`.

---

## 재리뷰 (`90d99c9..d9d10c0`, 리워크, 2026-07-10)

7단계 사용자 테스트에서 나온 두 가지(전역 보너스 0 회귀 / 브레이크다운 `Lv.N` 제거)를 리워크한 뒤 재리뷰했다. **Critical 0건.**

### K1. 음수 전역 보너스(디버프 시드)를 잠그는 테스트 부재 → **수정됨**
가드를 `bonus === 0`으로 쓴 게 이 diff에서 가장 미묘한 결정인데, 그걸 지키는 테스트가 없었다. 개별·분류의 `level <= 0`을 흉내 내 누군가 `bonus <= 0`으로 "대칭을 맞추면" 디버프 시드가 조용히 사라지고 스위트는 초록으로 남는다.

`EnhancementLogic.ts:33-37`의 `MIN_GLOBAL_MULT` JSDoc이 **"향후 디버프성 전역 보너스(≤ -1)"** 를 명시적으로 상정하고 `factor()`가 하한을 클램프하므로, 음수는 의도된 시나리오가 맞다. `tests/logic/DebugEnhancementSeed.test.ts`에 `{ global: { damage: -0.1 } }`가 op으로 살아남는지 확인하는 테스트를 추가했다(전체 430/430).

### K2. `addGlobal`은 여전히 보너스 0에도 레벨을 올린다 → **잠재 이슈, 반영 안 함**
가드를 파서에 뒀으므로 `EnhancementLogic.addGlobal(:240)`은 그대로다. `DeckManager.applyCard(:214-216)`가 카드 데이터의 `damageMult`를 바로 넘기니, `damageMult: 0`인 카드가 생기면 같은 괴리(레벨은 오르고 보너스는 0)가 재현된다. 그런 카드는 현재 없다.

**`addGlobal`에 방어 가드를 넣지 않는다.** 시드 파일의 "0 = 시드 안 함" 규약을 범용 메서드에 심는 셈이고, 진짜 호출자 버그를 가리게 된다. `addGlobal`의 계약은 "1회 호출 = 1회 획득"이고, 호출 여부는 호출자가 정하는 게 맞다. 이 규약을 한 곳에 문서화하는 문제는 백로그 **D2**(카드·시드 데이터에서 "의도된 0"과 "누락"을 구분)에 이미 있다.

### K3. `collectRaises`는 헬퍼, `global` 루프는 인라인 → **의도된 것(반영 안 함)**
비대칭은 맞지만 이유가 있다. `collectRaises`는 개별·분류 **두 번** 불려서 추출했고, 전역 테이블은 **한 번**만 돈다. DRY가 추출을 요구하지 않는다. `collectGlobals` 헬퍼는 병렬 구조와 단위 테스트 용이성을 사지만 지금은 선택 사항이라, 순수 헬퍼 추출을 다루는 백로그 **F31**에 얹는다.

### K4. `ResultStats.test.ts`의 `toEqual`(:157)과 `toMatchObject`(:189) 혼용 → **의도된 것(반영 안 함)**
같은 `ResultUpgradeView` 형태를 두 매처로 검사한다. 형태를 정확히 못 박는 건 한 번(`toEqual`)이면 충분하고, 다른 하나는 두 옵션을 순회하며 값만 본다. 전부 `toEqual`로 바꾸면 옵션별로 기대값을 갈라 써야 해 테스트가 길어진다.

### 재리뷰 결론
Important 1건(K1) **수정됨**. K2는 잠재 이슈로 D2에 위임, K3은 F31에 위임, K4는 무해. 코드(테스트) 변경이 있었으므로 `pnpm wf invalidate` 후 8번(/cso)부터 재실행했다.
