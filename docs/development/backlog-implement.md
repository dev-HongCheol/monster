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
| F43 | 열림 | 중 | 📐🔧 적 경로탐색 — 장애물 회피 | 지금 적은 직선 추적(`_followPlayer`)이라 장애물을 못 피한다. 장애물(**F38**·[`backlog.md`](backlog.md))이 적을 막으려면 회피·경로탐색이 필요하고, 이는 대량 적 성능(**G1**)과 얽힌다. 「맵 장애물」 슬라이스에서 **"적 관통 vs 경로탐색"** 을 먼저 결정해야 한다 — 관통을 택하면 이 항목이 사라진다. | `sessions/2026-07-11-map-arena-plan.md` §7 |
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
| F24 | **열림(다음 슬라이스 후보)** | **높음** | 🐛📐 싱글톤 타입 정직화 — `static instance: T \| null` + 호출부 73곳 가드 | 매니저 7개 전부 `onDestroy`에서 `instance`에 null을 넣으므로 **null은 정상 런타임 값인데**, 타입은 `= null as unknown as T`로 "절대 null 아님"이라 말한다. 그래서 `feat/ts-toolchain`이 켠 타입 게이트가 **씬 리로드 시 싱글톤 null**이라는 실제 함정을 구조적으로 못 본다. 정직한 `T \| null`로 바꾸면 **가드 없는 역참조 73곳(13파일)** 이 드러난다(실측). `I18n.ts:26`은 이미 정직한 패턴이라 선례가 있다. 재료·지뢰·가드 규칙은 아래 **F24 상세** 참조. **원 항목(흡수됨):** 「`GameManager.instance` 접근 null 가드 컨벤션 불일치 — `EnemySpawner`·`WaveManager`는 `if (!GameManager.instance) return;`를 선행하는데 엔티티(`SpellCaster`·`EnemyController`·`PlayerController`·발사체)는 `.state`를 직접 읽는다. 한 컨벤션으로 통일할지 결정.」 타입을 정직하게 만들면 그 결정을 컴파일러가 강제하므로 같은 슬라이스로 합쳤다. | `sessions/2026-07-13-ts-toolchain-plan.md` §7, `../qa/projectile-pause-guard-review-issues.md` M2 |
| F31 | 열림 | 낮음 | ♻️🐛 결과 스냅샷의 정합 가드 2개가 무테스트 + 실패 모드가 엇갈림 | 미발현 — result-stats의 C1 수정이 가드를 순수 함수에서 cc 계층으로 옮기며 순수 테스트 2건이 사라졌다. `buildSpellSnapshots(ownedIds, getSpell, …)` 같은 순수 헬퍼로 추출하면 회귀 테스트가 거의 공짜로 돌아온다. **이때 실패 모드도 통일할 것** — `resultSpellSnapshots`는 즉시 TypeError(시끄러운 실패)인데 `_snapshotResult`는 모든 킬을 조용히 드롭한다(C1이 고친 바로 그 장애 모드). | `../qa/result-stats-review-issues.md` R1·R4 |

### F24 상세 — 다음 슬라이스가 쓸 재료

`feat/ts-toolchain`의 CEO·Eng 리뷰가 **실측으로** 찾아낸 것들이다. 다음 슬라이스는 이걸 다시 발견하지 말고 여기서부터 시작한다. 출처: `sessions/2026-07-13-ts-toolchain-plan.md` §7.

**73곳은 기계적이지 않다. 조기 return이 상태 전이를 반쪽 실행시키는 자리가 셋이다.**

| 자리 | 조기 return을 넣으면 |
|---|---|
| `GameManager._applyDamage()` | HP를 0으로 깎은 **다음** 줄에서 `WaveManager.instance.waveNumber`를 읽는다 → **HP 0인데 GameOver 전이도 죽음 연출도 안 일어난다** |
| `CardSelectPanel._onPickCard()` | `DeckManager.instance.applyCard()` 다음 줄이 `GameManager.instance.resumeFromLevelUp()`이다 → **카드 패널이 열린 채 게임 영구 정지** |
| `GameManager.resumeFromLevelUp()` | 장식적인 HP 보너스 계산 때문에 빠져나오면 `this._state = GameState.Playing`에 도달 못 한다 → **레벨업에서 영구 락** |

**가드 규칙 (이 방향이어야 한다).** 값을 반환하는 호출에 **옵셔널 체이닝을 쓰지 않는다.** `?.`는 `undefined`를 내고 `strict`가 `?? fallback`을 강제하는데, 그럴듯한 fallback이 전부 조용히 게임을 깨뜨린다 — `effectiveCooldown ?? 0`이면 **쿨다운 0 → 매 프레임 발사**, `damageFactor ?? 0`이면 **전 마법 데미지 0**, `_pickupRadius ?? 0`이면 **XP 픽업 영구 불능**. `?.`는 반환값을 버리는 void 호출에만 쓰고, 값이 필요하면 **호이스트 + 조기 return**이다. `SpellCaster.update()`가 최대 레버리지 — 루프 진입 전 싱글톤 3개를 몰아 받으면 23건 중 상당수가 가드 하나로 사라진다.

**클로저에서는 내로잉이 살아남지 않는다.** `if (!X.instance) return;` 뒤라도 `.map(cb)`·`onReady(() => …)` 안에서는 TS18047이 다시 뜬다(Cocos 번들 tsc로 확인). 그 자리에서 호이스트는 선택이 아니라 강제다.

**house 패턴이 이미 3종 공존한다** — `?.`+`??`(`GameManager._snapshotResult`), 호이스트+조기 return(`HudController`), 무가드. **73곳을 손대기 전에 한 가지로 확정**해야 세 스타일로 갈리지 않는다.

**타입체크는 가드의 *존재*만 증명하지 *의미*를 증명하지 않는다.** 위 지뢰는 전부 타입체크 초록불이고, 가드가 들어갈 13개 파일은 전부 `systems/`·`components/`·`ui/`라 **vitest 커버리지 0%**다. 유일한 그물은 수동 플레이스루이며 체크리스트에 위 세 자리를 이름으로 박아야 한다.

**함께 닫을 것 — `DataManager` 콜백 누수 (신규 발견).** `_loadAll()`이 async인데 `onDestroy()`가 `_onReadyCallbacks`를 비우지 않는다. 로딩 중 재시작하면 파괴된 구 컴포넌트의 콜백이 나중에 발화하고, 그때 `DataManager.instance`는 **null이 아니라 새 씬의 인스턴스**다. 옵셔널 체이닝은 이걸 전혀 못 본다 — 새 인스턴스에 대해 멀쩡히 성공해 그 결과를 죽은 컴포넌트에 쓴다. Cocos 관용구 **`this.isValid`** 가드 + `onDestroy`에서의 콜백 정리가 필요하다.

### F-4. 성능 위생 (G1 인접)

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| F6 | 열림 | 낮음 | ♻️ `spellCategoryColor`가 발사마다 `new Color` 할당 → 분류별 캐시 | 핫 패스에 있지만 풀링 이전부터 존재했다. **G1(c)에 흡수.** | `../qa/object-pooling-review-issues.md` M-2 |
| F7 | 열림 | 낮음 | 🔧 `PoolManager` 보관 한도·폐기 경로 테스트 + 제자리 리셋 시 `clear()` | 현재 `maxFree = 0`(무제한)이라 폐기 경로는 실행되지 않는 코드다. 재시작도 씬 리로드라 teardown이 불필요하다. 한도·제자리 리셋이 생기면 함께(**G1(e)**). | `../qa/object-pooling-review-issues.md` I-2·I-3 |
| F36 | 열림 | 낮음 | ♻️🔧 `isOutsideArena` 발사체 핫패스 `{x,y}` 할당 + 비정방 아레나 테스트 | map-arena 리뷰 후속. `Projectile`·`EnemyProjectile._checkOutOfBounds`가 프레임마다 `isOutsideArena({x,y}, …)`로 리터럴을 새로 만든다(발사체 수백이면 미미한 GC 압박) — Vec2 컨벤션과 정합이라 지금은 무해, **G1(S2) 할당 위생**과 함께 정리. 또 `isOutsideArena` 테스트가 정방 2400²만 커버하므로 width≠height 케이스 1건을 더하면 축 스왑 회귀를 방어한다. | `../qa/map-arena-review-issues.md` 재리뷰 |

### F-5. 툴체인 · 워크플로우

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| F9 | 열림(부분 완료) | 낮음 | 🔧 씬 **UICamera** 크로스머신 churn | MacBook 작업 / Windows 테스트 시 `main.scene` Camera 노드의 `_lpos.y`·`_orthoHeight`가 재계산돼 무관한 diff가 난다(장비별 해상도 차이로 에디터가 카메라를 재fit·재직렬화). 매 PR 테스트마다 반복된다. **2026-07-13 map-arena에서 게임 `Camera`는 해결** — `CameraController`가 `orthoHeight=360`을 못박고 `Canvas.alignCanvasWithScreen=false`로 꺼서 더는 튀지 않는다. **잔존 범위는 `UICamera` 하나** — `UICanvas.alignCanvasWithScreen=true`라 Cocos가 화면 크기에 맞춰 재fit하며, map-arena 7단계 테스트에서도 `1175.2965…` → `871.6564…`로 churn이 재발했다. 해소하려면 UICanvas 정렬 정책을 바꿔야 하는데 **HUD 스케일링 회귀 검증이 따라붙으므로** 별도 슬라이스로 남긴다. | projectile-count 테스트 (2026-06-11), `../qa/map-arena-test.md` §6 (2026-07-13) |
| F44 | 열림 | 중 | 🔧 `approve-pr`이 타입체크를 **실측**하게 — stale 통과 플래그 봉합 | `feat/ts-toolchain`이 `pass ts`를 실제 강제로 만들었지만 **최신성까지는 못 본다.** `verification` phase는 스크립트 편집이 허용되므로, `pass ts` 통과 → 코드 수정 → **`invalidate`도 `pass ts` 재실행도 안 함** → 나머지 `pass`만 채우면 타입이 깨진 코드가 머지된다. 크로스머신 stale(A 머신에서 통과·커밋 → B 머신에서 편집)도 같은 구멍의 변형이다. **성질은 `cso`·`lint`·`review` 세 플래그가 이미 갖고 있는 노출과 같지만**(같은 편집이 저 셋도 stale로 만든다), `ts`만은 기계 검증이 가능하다는 게 그 슬라이스의 명제였으므로 여기까지 마감할 수 있다. **봉합안:** `approve-pr`에서 `runTypecheck()`를 한 번 더 돌린다 — 사람이 트리거하는 마지막 게이트라 tsc 1회 비용이 무의미하고, 편집·`invalidate` 순서와 무관하게 **머지 직전의 실제 코드**를 검사하게 된다(지금은 `ts_check_scope` **기록**만 본다). | `../qa/ts-toolchain-review-issues.md` 재리뷰 |
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

### 툴체인 · 타입 게이트

- **F27** `static instance!:`가 TS1255 → **완료**(`feat/ts-toolchain`, 2026-07-13). **원래 진단이 틀렸다.** 백로그는 이걸 "IDE와 Cocos 번들 TS의 버전 불일치로 인한 **오탐**"으로 적어 뒀는데, Cocos 3.8.8이 번들한 바로 그 TypeScript(5.8.2)를 직접 돌려 보니 **동일하게 TS1255를 냈다.** 버전 차이가 아니라 진짜 문법 위반이다 — 정의 할당 단언(`!`)은 static 멤버에 허용되지 않는다. 게임이 돌았던 건 **Cocos가 타입 검사 없이 트랜스파일만 하기 때문**이고, 우리는 진짜 에러를 조용히 무시하고 있었다. 선언 7곳(6개가 아니었다)을 `null as unknown as T`로 통일했다. **타입이 여전히 거짓말한다는 잔여 문제는 F24가 받는다.** → `sessions/2026-07-13-ts-toolchain-plan.md`, `troubleshooting/typescript-version-pin.md`
- **F30** `lib` 미지정으로 ES2017 API가 TS2550 → **완료**(`feat/ts-toolchain`, 2026-07-13). `game/tsconfig.json`에 `lib: ["ES2017", "DOM", "DOM.Iterable"]` + `skipLibCheck` 추가. **제안됐던 `ScriptHost`는 불필요했고, ES2020도 불필요했다** — ES2020을 요구하던 유일한 파일(`I18nKeyGuard.ts`의 `matchAll`)이 알고 보니 **게임에서 한 줄도 안 도는 테스트 전용 헬퍼**였다(참조: 자기 테스트뿐). `tests/helpers/`로 옮기니 shipped 코드는 ES2017로 충분해졌다. `skipLibCheck`가 `cc.d.ts` 에러 102건을 없앤다(우리가 고칠 수 없는 엔진 선언). **단, 그중 미해결 모듈 15건(`pal/input/*`·`pal/audio/*`)은 보고만 꺼질 뿐 타입이 `any`로 새며 `PlayerController`가 그 영역이다.** → `sessions/2026-07-13-ts-toolchain-plan.md` §3
- **타입 게이트 강제** → **완료**(`feat/ts-toolchain`, 2026-07-13). F27·F30을 고쳐도 게이트가 여전히 명예제도였다 — `workflow.mjs`의 `pass()`가 검증 없이 플래그만 뒤집었고, 절차서의 `mcp__ide__getDiagnostics`는 **VS Code에 열린 파일만** 봤다. 이제 `pnpm typecheck`(레포 소유, `tsc --noEmit`)를 신설하고 **`pass ts`가 그 코드를 직접 호출**한다. 검사 범위(`ts_check_scope`)를 상태에 기록해 `approve-pr`이 `logic-only`를 거부한다 — `game/temp/`가 gitignore 대상이라 Cocos를 안 연 머신에서 게임 코드가 검사되지 않는데, 그걸 통과시키면 "Cocos 안 깐 머신 = 게이트 프리패스"가 되기 때문이다. **테스트 코드도 이때 처음으로 타입 검사됐고**(루트 tsconfig 부재 + vitest는 타입을 안 본다), 곧바로 진짜 타입 에러 하나를 잡았다(`MagicAddCard.test.ts` — `ISpellData.pattern` 누락). → `sessions/2026-07-13-ts-toolchain-plan.md` §5

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
