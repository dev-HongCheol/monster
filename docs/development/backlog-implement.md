# 개발 백로그 — 코드 (living)

> **목적:** 구현·테스트 중 떠오른 "지금 슬라이스 밖" 할 일 중 **코드가 어떻게 굴러가는가**에 해당하는 것(아키텍처·리팩터·타입·툴체인·성능·데이터 검증·미발현 로버스트니스 버그)을 모은다.
> **게임 쪽 백로그는 [`backlog.md`](backlog.md)에 있다** — 콘텐츠·밸런스·게임필·UI/UX·메타.
> **작성 시작:** 2026-06-11 (원래 `backlog.md`) · **분리:** 2026-07-10
> **성격:** 계속 갱신하는 living 문서. 운영 규칙과 상태·우선 어휘는 [`backlog.md`](backlog.md) 머리말이 정본이다.

**두 파일에 걸친 항목:** 경계에 선 항목은 주 파일 한 곳에만 두고 반대편에서 역링크한다.
- `F8`(카드 라벨 잘림)·`F26`(사망 연출)·`F28`(죽음·승리 비트 강화) → [`backlog.md`](backlog.md)
- `B6`(풀 보관 한도)은 게임 밸런스 항목이지만 아래 `G1`에 흡수됐다.

---

## C. i18n 키 타입 안전성

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| C1 | 보류 | 낮음 | 🔧 i18n 키 타입 코드젠 (가드는 완료) | **가드는 완료**(`feat/i18n-key-guard`) — 카탈로그↔코드 드리프트(누락·고아·오타·파라미터 불일치)를 vitest 영구 게이트로 차단한다. **잔여는 타입 코드젠** — `type I18nKey` union + 타입 붙은 `t()`. AI 주도 개발에선 한계효용이 얇다(가드가 같은 오타를 이미 RED로 잡고, 자동완성 이득은 AI에게 거의 0). 사람이 키를 직접 타이핑하는 비중이 커지면 재검토. | ADR 005, `sessions/2026-06-11-i18n-key-guard-plan.md` §1·§6 |

---

## D. 데이터 · 스키마 (콘텐츠가 늘어날 때)

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| D1 | 열림 | 낮음 | 🔧 `IEnemyData.name` → `enemy.<id>.name` 키화 | i18n 1차는 spells·cards만 키화했다. 현재 `enemy.name`을 표시하는 소비처가 없어 미룬 상태 — **result-stats가 결과 화면 킬 목록에 적 이름을 쓰기 시작했으니** 콘텐츠 단계에 마이그레이션한다. | `../qa/i18n-foundation-review-issues.md` #3 |
| D2 | 열림 | 중 | 🔧 DataManager JSON `as T` 캐스팅 → 스키마 검증 | 필드가 빠지면 런타임에 `undefined`가 조용히 유입된다. `xpDrop: 0` 같은 의도적 0과 누락을 구분하는 것도 포함. **함께:** 마법 단위 테스트가 실 `spells.json`이 아닌 픽스처를 써서 데이터 드리프트를 못 잡는다 → 실데이터를 로드해 마법별 필드를 단언하는 sanity 테스트 도입. **F12·F15의 불변식을 강제할 자리이기도 하다.** | `../qa/xp-drop-per-enemy-review-issues.md`, `../qa/frost-nova-review-issues.md` M-2 |
| D3 | 열림 | 낮음 | ♻️ `en.json`/`ko.json` 포맷 비대칭 정리 | en은 flat string, ko는 `{message, desc}` 객체다. 각 파일 내부 컨벤션은 일관돼서 신규 결함은 아니다. | `../qa/passive-effects-review-issues.md` #4 |

---

## F. 로버스트니스 · 인프라 (기회 될 때 — 대부분 저위험·동작 무영향)

> **미발현**으로 표시된 항목은 현재 코드 경로에서 그 분기에 도달하지 않는다(방어 코드 또는 미래 데이터 조건에서만 발현). 위험은 낮지만 조건이 생기는 슬라이스에서 함께 닫는다.

### F-1. 진단 · 방어 코드

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| F1 | 열림 | 낮음 | ✨ `startingSpellIds` 시드 실패 무알림 | `addSpell`이 6슬롯 초과·중복을 조용히 버린다. `console.warn` 진단 추가. | `sessions/2026-06-01-magic-followups.md` §2 |
| F2 | 열림 | 낮음 | 🐛 `_onPickCard`가 `addSpell` 반환값을 버림 | 미발현 — 1회 픽 흐름엔 무해. 다중 픽 패널이 생기면 거부된 추가가 픽을 소모할 수 있다. | `../qa/magic-add-card-review-issues.md` |
| F3 | 열림 | 낮음 | 🐛 `I18n`·`DataManager`의 `resources.load` 콜백 asset 널 가드 | 로드 실패 시 방어. 두 싱글톤에 일괄 적용. | [next-slice-i18n 메모리] |
| F4 | 열림 | 낮음 | 🐛 `getEnemy(enemyId)`가 null이면 inert 적이 `maxEnemies`를 영구 점유 | 미발현 — director가 유효 id만 고른다. 데이터 정합성 이슈라 D2와 함께 볼 것. | `../qa/enemy-xp-pooling-review-issues.md` M-2 |
| F25 | 열림 | 낮음 | 🐛 `HudFormatLogic` 비유한 입력 가드 | 미발현 — `formatTimer(NaN)` → `"NaN:NaN"`, `formatTimer(Infinity)` → `"Infinity:NaN"`, `barRatio(NaN, ·)` → `NaN`(그대로 `ProgressBar.progress`로 전파), `formatNumber(1e21)` → `"1e+21"`(지수 표기로 바뀌어 자릿수 그룹핑이 깨짐). 현재 호출자(`gameTimer`·`playerHp`·`currentXp`)는 전부 유한하고 1e21 미만이다. 세 함수에 `Number.isFinite` 가드(→ `"00:00"`·`0`·`"0"`) + 순수 테스트. ※ 아카이브의 완료된 F25(근접 마커 클램프)와 **번호가 겹친다** — 원본 문서의 표기 오류이며 이쪽이 현재 열려 있는 F25다. | `../qa/hud-layout-review-issues.md` M2·R3 |
| F29 | 열림 | 낮음 | ✨🔧 에디터 배선 컴포넌트의 필수 `@property` 누락 loud-fail 정합화 | `PauseController.onLoad`는 `pausePanel` 미연결 시 조용히 no-op이라, 7단계 배선 실수가 "ESC로 얼어붙되 메뉴 안 뜸"으로 조용히 샌다. `HudController`·`ResultController`가 쓰는 house 패턴(`console.error` + `this.enabled = false`)으로 맞추면 크게 드러난다. **공통 규칙으로 승격 검토.** | `../qa/pause-menu-review-issues.md` O1 |

### F-2. 데이터 불변식 (미발현 — D2와 함께 강제 후보)

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| F12 | 열림 | 낮음 | 📐 범위 카드 게이트 술어 — `explosionRadius` 보유 vs `hitEffect='explosion'` | 미발현 — `isRangeCapable`이 `explosionRadius` 보유만 본다. `explosionRadius`만 있고 `hitEffect`가 explosion이 아닌 마법을 만들면 아무것도 안 키우는 죽은 카드가 가능하다. "`explosionRadius` ⇒ `hitEffect` explosion" 불변식을 D2로 강제할지 결정. | `../qa/magic-explosion-review-issues.md` #1 |
| F15 | 열림 | 낮음 | 🐛 `hitEffect='explosion'` + `onHitStatus` 동시 보유 마법은 폭발 경로가 CC를 조용히 누락 | 미발현 — `Projectile._checkEnemyHit`이 폭발이면 `_detonate`만 타고 `_applyStatus`를 건너뛴다. 폭발+CC 마법을 추가할 때 폭발 경로로 CC를 확장하거나 "공존 불가" 불변식을 D2로 강제. | `../qa/magic-cc-review-issues.md` #5 |
| F19 | 열림 | 낮음 | 🐛📐 공유 `_windupActive` 충돌 — "돌진+발사 겸용 적" 텔레그래프 | 미발현(겸용 적 없음) — `_updateAttackTelegraph`와 `_updateLungeTelegraph`가 같은 `_windupActive`에 쓴다. `movement:'lunge'` **AND** `attack`을 동시에 가진 적이 생기면 공격 경로가 돌진 텔레그래프를 매 프레임 덮어 점멸을 조용히 억제한다(에러 없음). 겸용 적이 실제로 생길 때 경고·assert 또는 별도 플래그. | `../qa/enemy-projectile-review-issues.md` I-1 |
| F22 | 열림 | 낮음 | ♻️ 적 부채꼴 기본각 `?? 0` + `origin` 라이브 참조 계약 주석 | 미발현 — (a) `projectile_fan`인데 `spreadAngleDeg`가 빠지면 N발이 겹쳐 발사돼 단발이 된다(이무기는 항상 34 지정). fan 타입에 사실상 필수화하거나 "0=스택 의도" 주석. (b) `_fireProjectile`의 `origin`은 노드 내부 벡터의 라이브 참조라 "즉시 소비·저장 금지" 계약 주석이 사고를 예방한다. | `../qa/enemy-multishot-review-issues.md` M2·Rec |

### F-3. 정리 · 리팩터 (동작 무영향)

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| F5 | 열림 | 낮음 | ♻️ `Projectile.ts:70` 노후 주석 갱신 | "takeDamage→destroy→unregisterEnemy"가 이제 "연출 후 release"로 바뀌었다. 한 줄 정리. | `../qa/enemy-xp-pooling-review-issues.md` M-4 |
| F11 | 열림 | 낮음 | ♻️ `Projectile._despawn`에서 `_explosion = null`로 공유 중복 제거 집합 해제 | 풀에 반환된 발사체가 다음 `init`까지 이전 시전의 `ProjectileExplosion`·`hitSet` 참조를 붙들고 있다. 풀 크기로 유계이고 비활성 노드는 `update`가 안 돌아 무해. 한 줄 정리. | `../qa/magic-explosion-review-issues.md` #2 |
| F13 | 열림 | 낮음 | 🎨 폭발 VFX 기준 반경(`EXPLOSION_VFX_BASE_RADIUS = 70`)이 마법 데이터와 커플링 | VFX 스케일 `radius/70`이 파이어볼 기본 반경과 중복이다. 기본 반경이 다른 미래 폭발 마법은 `rangeFactor = 1`에서도 비-1 스케일로 렌더된다. 기본값을 마법에서 유도하거나 커플링을 문서화. | `../qa/magic-explosion-review-issues.md` #4 |
| F17 | 열림 | 낮음 | 🐛 돌진 Chase·Cooldown 이동에 겹침 가드 부재 | 미발현에 가까움 — `lungeMovement`가 `normalize(toPlayer)`를 반환하는데 `_followPlayer`에 있는 `lengthSqr < 1`(1px 이내 정지) 가드가 없다. 플레이어와 거의 겹치면 매 프레임 방향이 뒤집혀 ~1.6px 코스메틱 진동이 가능하다. 가드 + 순수 테스트 1건. | `../qa/enemy-movement-review-issues.md` #1 |
| F21 | 열림 | 낮음 | ♻️ `radialDirections` 부분 확산(spread < 360) 비대칭 | 미발현 — 조준 방향에서 한쪽(CCW)으로만 분포해 `spread < 360`이면 조준이 호의 **가장자리**가 된다(`fanDirections`는 중심 분포라 대비). 유일 소비자 물귀신이 360을 써 완전 등분이다. 부분 호 소비자가 생기면 JSDoc 경고 또는 중심 분포 변형. | `../qa/enemy-multishot-review-issues.md` M1 |
| F23 | 열림 | 낮음 | ♻️🔧 `KITE_DEADZONE_BAND`를 `MovementLogic`으로 추출 | F20 데이터 테스트가 cc 의존 상수(40)를 하드코딩으로 미러링해, 밴드를 튜닝하면 테스트가 조용히 드리프트할 수 있다. 그 값은 순수 `MovementLogic.kiteDirection(band)`로 흘러가므로 순수 모듈로 올려 컨트롤러·테스트가 같은 출처를 import하면 드리프트가 원천 제거된다. | `../qa/enemy-multishot-review-issues.md` M3 |
| F24 | 열림 | 낮음 | ♻️ `GameManager.instance` 접근 null 가드 컨벤션 불일치 | 두 패턴이 공존한다 — `EnemySpawner`·`WaveManager`는 `if (!GameManager.instance) return;`를 선행하고, 엔티티(`SpellCaster`·`EnemyController`·`PlayerController`·발사체)는 `.state`를 직접 읽는다. 신규 리스크는 아니다(엔티티는 스폰 이후에만 존재). 한 컨벤션으로 통일할지 결정. | `../qa/projectile-pause-guard-review-issues.md` M2 |
| F31 | 열림 | 낮음 | ♻️🐛 결과 스냅샷의 정합 가드 2개가 무테스트 + 실패 모드가 엇갈림 | 미발현 — result-stats의 C1 수정이 가드를 순수 함수에서 cc 계층으로 옮기며 순수 테스트 2건이 사라졌다. `buildSpellSnapshots(ownedIds, getSpell, …)` 같은 순수 헬퍼로 추출하면 회귀 테스트가 거의 공짜로 돌아온다. **이때 실패 모드도 통일할 것** — `resultSpellSnapshots`는 즉시 TypeError(시끄러운 실패)인데 `_snapshotResult`는 모든 킬을 조용히 드롭한다(C1이 고친 바로 그 장애 모드). | `../qa/result-stats-review-issues.md` R1·R4 |

### F-4. 성능 위생 (G1 인접)

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| F6 | 열림 | 낮음 | ♻️ `spellCategoryColor`가 발사마다 `new Color` 할당 → 분류별 캐시 | 핫 패스에 있지만 풀링 이전부터 존재했다. **G1(c)에 흡수.** | `../qa/object-pooling-review-issues.md` M-2 |
| F7 | 열림 | 낮음 | 🔧 `PoolManager` 보관 한도·폐기 경로 테스트 + 제자리 리셋 시 `clear()` | 현재 `maxFree = 0`(무제한)이라 폐기 경로는 실행되지 않는 코드다. 재시작도 씬 리로드라 teardown이 불필요하다. 한도·제자리 리셋이 생기면 함께(**G1(e)**). | `../qa/object-pooling-review-issues.md` I-2·I-3 |
| F36 | 열림 | 낮음 | ♻️🔧 `isOutsideArena` 발사체 핫패스 `{x,y}` 할당 + 비정방 아레나 테스트 | map-arena 리뷰 후속. `Projectile`·`EnemyProjectile._checkOutOfBounds`가 프레임마다 `isOutsideArena({x,y}, …)`로 리터럴을 새로 만든다(발사체 수백이면 미미한 GC 압박) — Vec2 컨벤션과 정합이라 지금은 무해, **G1(S2) 할당 위생**과 함께 정리. 또 `isOutsideArena` 테스트가 정방 2400²만 커버하므로 width≠height 케이스 1건을 더하면 축 스왑 회귀를 방어한다. | `../qa/map-arena-review-issues.md` 재리뷰 |

### F-5. 툴체인 · 워크플로우

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| F27 | 열림 | 중 | 🔧 IDE TS ↔ Cocos 번들 TS 불일치 — `static instance!:`가 TS1255 | VS Code TS 서버는 static 필드의 definite assignment `!`를 `TS1255`로 막지만 Cocos 3.8.8 번들 TS는 허용해 실빌드·실행이 정상이다. 매니저 싱글톤 6개가 공유하는 패턴이라, `pass ts` 게이트가 **매니저를 편집하는 슬라이스마다** 이 오탐을 표면화한다. **해소책(택):** (a) workspace TS 버전을 Cocos 번들에 정렬, (b) 선언을 `static instance: T = null!` 형태로 6곳 통일, (c) 이 진단만 화이트리스트. | death-flow `pass ts` (2026-07-04) |
| F30 | 열림 | 중 | 🔧 `tsconfig`의 `lib`이 `target: ES2015`에 묶여 ES2017 API가 TS2550 | Cocos가 생성하는 `temp/tsconfig.cocos.json`에 `lib` 오버라이드가 없어 `Object.entries`가 타입에 없다. 더 나쁜 건 파생 효과 — `any` 취급이 돼 `SpawnDirectorLogic`의 `reduce` 콜백이 implicit-any로 터진다(**가중 스폰 계산의 타입 안전성이 사실상 꺼져 있다**). 런타임엔 존재해 미발현. **해소책:** `game/tsconfig.json`의 custom 절에 `"lib": ["ES2017", "DOM", "DOM.Iterable", "ScriptHost"]` 추가(`lib`은 타입 체크만 바꾸고 emit엔 무영향). **F27과 함께 처리해야 `pass ts`가 비로소 신호가 된다.** 현 사용처: `SpawnDirectorLogic`(2)·`DebugEnhancementSeed`(3)·`GameManager`(1). **2026-07-10 result-stats 리워크에서 재확인:** `DebugEnhancementSeed.ts`를 열자 TS2550 4건이 그대로 떴다(`Object.values` 1 + `Object.entries` 3). `git show origin/main:`으로 대조해 **main과 동일한 선재 에러**임을 확인하고 `pass ts`를 통과시켰다(리워크가 새로 만든 TS 에러 0건). `lib`을 고치면 `Object.entries`가 `any`를 벗으면서 무관 파일에 진짜 타입 에러가 드러날 수 있어, F27과 묶어 별도 툴체인 슬라이스로 남긴다. | `../qa/result-stats-review-issues.md` 재검증, result-stats 리워크 `pass ts`(2026-07-10) |
| F9 | 열림(부분 완료) | 낮음 | 🔧 씬 **UICamera** 크로스머신 churn | MacBook 작업 / Windows 테스트 시 `main.scene` Camera 노드의 `_lpos.y`·`_orthoHeight`가 재계산돼 무관한 diff가 난다(장비별 해상도 차이로 에디터가 카메라를 재fit·재직렬화). 매 PR 테스트마다 반복된다. **2026-07-13 map-arena에서 게임 `Camera`는 해결** — `CameraController`가 `orthoHeight=360`을 못박고 `Canvas.alignCanvasWithScreen=false`로 꺼서 더는 튀지 않는다. **잔존 범위는 `UICamera` 하나** — `UICanvas.alignCanvasWithScreen=true`라 Cocos가 화면 크기에 맞춰 재fit하며, map-arena 7단계 테스트에서도 `1175.2965…` → `871.6564…`로 churn이 재발했다. 해소하려면 UICanvas 정렬 정책을 바꿔야 하는데 **HUD 스케일링 회귀 검증이 따라붙으므로** 별도 슬라이스로 남긴다. | projectile-count 테스트 (2026-06-11), `../qa/map-arena-test.md` §6 (2026-07-13) |
| F10 | 열림 | 중 | 🔧 `workflow-state.json` 크로스머신 동기화 정책 결정 | 전이를 커밋 안 하면 타 장비가 stale해지고(실제로 겪음), 커밋하면 main 오염·머지 충돌·락 상속이 생긴다. "추적 유지 + 핸드오프 시점만 커밋"(권장) vs `.gitignore` 제외 중 택해 ADR 004에 반영. | `troubleshooting/workflow-state-cross-machine.md`, ADR 004 |

---

## G. 성능 · 스케일 — **이월(v2)**

> **이월(2026-07-02 방향 전환):** 적을 더 안 늘리기로 해 현재 `maxEnemies` 캡으로 성능이 안전하다. 단, 완성도 작업 중 실제 프레임 드랍이 관측되면 그 시점에 재검토한다.
>
> 동시 적 수 상한(`maxEnemies`)은 설계 문서에 없는 비공식 구현 스로틀이고, **난이도 조절과 성능 안전망 두 역할을 겸한다**(2026-06-16 확인). 상한을 없애려면 그 두 역할을 의도적으로 대체해야 한다 — 그것이 G1이다. 목표는 "수백 마리 적도 프레임 드랍 없이"(사용자 우선순위).

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| G1 | 이월(v2) | — | 🔧📐 동시 적 수 상한 제거 + 대량 적 성능 | 현재 전수 비교 구조라 ~100마리에서 흔들리고 300+에서 깨진다. 병목 순서: 할당·GC > `Projectile._checkEnemyHit`의 O(p×n) + 배열 복사 > 드로우콜 > `unregisterEnemy`의 O(n) splice. 공간 그리드 + 할당 위생 + 배칭으로 수백~1000마리 60fps가 이 장르의 표준 달성선이다. 토대는 우호적(순수 로직 분리·풀링 기존). **마법 효과 타겟팅이 전부 반경·라인 질의라 그리드는 모든 효과 슬라이스에 공유 이득이다.** | `sessions/2026-06-16-magic-explosion-plan.md` §3 |

**G1의 3분할 (2026-06-17)** — 한 슬라이스로 크고, (a)가 난이도 곡선이라는 게임 디자인 결정을 품으며, (d)는 스프라이트 아틀라스 아트가 선행돼야 해서 나눴다.

| 조각 | 상태 | 내용 |
|------|------|------|
| **S1 — 공간 그리드 코어** | ✅ 완료 (PR #36) | `logic/SpatialGrid.ts` 희소 해시 격자 + 충돌·폭발을 그리드 질의로 전환(배열 복사 제거·O(p×n)→O(p+n)·제곱거리). `maxEnemies`는 유지. → `sessions/2026-06-17-spatial-grid-plan.md` |
| **S2 — 할당·레지스트리 위생** | 대기 | `unregisterEnemy` swap-remove + Color 캐시(**F6** 흡수) + 풀 보관 한도·제자리 리셋(**B6**·**F7** 흡수) + **그리드 신규 할당 출처 정리** — `SpatialGrid` 재구축·질의가 프레임마다 엔트리 객체·버킷 배열·셀 키 문자열·결과 배열을 새로 만든다. |
| **S3 — 캡 제거 + 스폰 곡선** | 대기 | `maxEnemies` 상한 제거 + 난이도 스폰 속도 곡선 + 멀리 떨어진 적 컬링. **게임 디자인 결정 포함** — [`backlog.md`](backlog.md)의 밸런싱과 연동. |
| **(d) 배칭** | 아트 단계로 분리 | 적·발사체 스프라이트 아틀라스 배칭(드로우콜). 스프라이트 아틀라스 선행. |

> **미래 그리드 소비처:** `SpellCaster._findNearestEnemy`는 시전당 전역 최근접이라 여전히 전수 비교다(프레임당 발사체 루프가 아니라 정당한 비스코프). 그리드 최근접은 확장-링 탐색이 필요하다. 마법 효과 레이어(A1)의 노바·체인·빔 타겟팅과 함께 묶을 후보.

---

## 완료 아카이브 (코드)

### 렌더 구조 · 일시정지 정합성

- **H1** UI 항상-위 렌더 — UI 카메라 + 레이어 분리 → **완료**(`card-layer-fix`, PR #35). 레벨업 카드 패널 위로 적·플레이어가 겹쳐 보이던 문제. **근본 원인:** 단일 Canvas + 단일 카메라 구조라 2D 렌더 순서가 Canvas 자식 배열 순서로 정해지는데, 적이 런타임 `addChild`로 항상 배열 맨 뒤(=위)에 붙었다. 그래서 에디터에서 패널을 마지막 자식으로 옮기는 것만으론 안 고쳐진다. 게임/UI를 **두 Canvas**로 분리해 닫았다(단일 Canvas + 2카메라 시도는 게임 월드가 UICamera에서 컬링돼 폐기). → `sessions/2026-06-17-card-layer-fix-plan.md`
- **I1** 날아가던 발사체가 LevelUp 일시정지를 무시 → **완료**(`projectile-pause-guard`, PR #47). 멈춤이 전역 `director.pause`가 아니라 각 시스템이 `update()`에서 `state !== Playing`을 확인하는 방식이라, 가드를 안 단 `Projectile`·`EnemyProjectile`이 일시정지 중에도 이동·명중·`damagePlayer`·폭발했다(메뉴 중 피격 — 공정성 문제). 두 `update()` 맨 앞에 가드 추가. → `sessions/2026-07-01-projectile-pause-guard-plan.md`
- **I2** `XPItemController.update`가 일시정지 중 픽업 반경 내 XP를 흡수 → **완료**(`feat/pause-menu`). 오브가 이동하지 않고 플레이어도 정지해 상대 거리가 정적이라 무해했지만(모달 메뉴), 같은 가드로 닫았다. → `../qa/projectile-pause-guard-review-issues.md` M1
- **I3** 정지한 발사체가 카드 선택 패널 위로 렌더 → **완료**(`feat/pause-menu`, 라이브 검증 — 미재현). I1으로 발사체가 화면에 멈춰 서면서 가시화된 레이어 버그(인과 아닌 노출 계기). 현 씬 구성에서 재현되지 않음을 확인. | 2026-07-01 인게임 테스트

### 로버스트니스

- **F14** CC 다중 타이머 모델 전환 → **완료**(magic-S3, PR #38). 단일 슬롯(강도·지속을 각각 max로 합침)이 **약하고 긴 소스가 강한 강도의 잔여를 늘리는** 설계 오류였다. 강도별 독립 타이머로 재작성 — 동시 감소, 매 순간 살아 있는 것 중 가장 센 강도 적용, 재적중 시 그 강도만 재충전. 슬로우(아이스 미사일)가 두 번째 강도로 들어오며 발현했다. → `sessions/2026-06-21-magic-slow-plan.md` §2.1
- **F16** 그리드 질의 → 타겟 수집 루프 중복 → **완료**(`feat/inferno`). 세 번째 호출부(인페르노 궤도 충돌)가 생겨 rule-of-three가 성립 → `GameManager.collectTargetsInRadius(cx, cy, r)`로 추출해 `_castNova`·`Projectile._detonate`·`_applyOrbHit`가 공유한다(동작 무변경). **잔여:** 중복 제거 집합 수명 통합은 다음 비-발사체 패턴 도입 시 재검토. → `../qa/inferno-review-issues.md` M2
- **F18** 글로서리 "창"(window 직역) 용어 → "구간" 통일 → **완료**(`feat/player-iframe`). 한국어 단독 "창"은 窓·槍으로 먼저 읽혀 시간 스팬 의미로는 비관용적이다. 단어 속 "창"(창백한·얼음 창)은 보존. → `docs/development/glossary.md`
- **F20** kite 정착-vs-사거리 불변식 테스트 + `_fireProjectileFn` 죽은 가드 정리 → **완료**(`feat/enemy-multishot`, PR #46). (a) 실 `enemies.json`을 로드해 유격 적 전부가 `preferredRange + KITE_DEADZONE_BAND(40) ≤ attack.range`를 만족하는지 단언(구미호 360≤420·이무기 380≤460·물귀신 300≤520) — 어기면 적이 사거리 밖에 정착해 거의 안 쏜다. (b) null 가드 주석을 실제 동작에 맞게 정정. → `sessions/2026-06-29-enemy-multishot-plan.md` §8
