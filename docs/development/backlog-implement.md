# 개발 백로그 — 코드 (living)

> **목적:** 구현·테스트 중 떠오른 "지금 슬라이스 밖" 할 일 중 **코드가 어떻게 굴러가는가**에 해당하는 것(아키텍처·리팩터·타입·툴체인·성능·데이터 검증·미발현 로버스트니스 버그)을 모은다.
> **게임 쪽 백로그는 [`backlog.md`](backlog.md)에 있다** — 콘텐츠·밸런스·게임필·UI/UX·메타.
> **작성 시작:** 2026-06-11 (원래 `backlog.md`) · **분리:** 2026-07-10
> **성격:** 계속 갱신하는 living 문서. 운영 규칙과 상태·우선 어휘는 [`backlog.md`](backlog.md) 머리말이 정본이다.

**두 파일에 걸친 항목:** 경계에 선 항목은 주 파일 한 곳에만 두고 반대편에서 역링크한다.
- `F8`(카드 라벨 잘림)·`F26`(사망 연출)·`F28`(죽음·승리 비트 강화) → [`backlog.md`](backlog.md)
- `F64`(발치 기준을 물 구역·적 이동 충돌로도 넓힐지) → [`backlog.md`](backlog.md). 증상은 게임필이라 그쪽이 주 파일이지만, 실제 결정은 `logic/FootprintLogic.ts`를 플레이어 전용에서 공용 규칙으로 승격할지라는 코드 구조 판단이다.
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
| F52 | 열림 | 낮음 | ♻️📐 물 구역 표현 마스크/그리드 재검토 (F39 대안) *(구 F48 — ID 충돌로 2026-07-17 재번호)* | 한강 소프트 해저드(F39)를 폴리곤으로 구현했다. 대안인 **물 마스크**(강을 이미지로 칠해 저해상도 불리언 그리드로 굽고, 런타임은 그리드 룩업)는 정점 손 authoring을 없애고, 그리드가 아레나 전체를 덮도록 정규화돼 `size` 결합도 함께 풀며, **F41 최종 아트의 강 레이어에서 마스크를 자동으로 구우면 authoring 자체가 사라진다.** 폴리곤→마스크 전환은 데이터 스키마·순수 함수(`pointInPolygon`→`isWaterAt`)·렌더를 갈아끼우므로 **최종 아트가 들어오는 F41과 함께** 재검토하는 게 총 공수가 작다. F41 아트 발주에 "강을 별도 레이어/마스크로 내보내 달라"를 함께 넣을 것. | `sessions/2026-07-15-han-river-hazard-plan.md` §7(4)·§2.2 |
| F53 | 열림(원 완료) | 낮음 | 📐🔧 볼록 프리미티브 충돌 — 원 완료 · OBB·캡슐 잔여 | 장애물 충돌이 축정렬 사각형(AABB) 전용이라 원형 건물(동대문 체육관 돔 등)을 감싸면 대각선에서 `~0.41R`(R=200px면 ~83px) 투명벽이 생겨 "닿지도 않았는데 막힘" → 맵 다형성이 죽는다. 이동 주체가 이미 원이라 원 프리미티브가 최저비용 — 형태 seam(`rect|circle` 태그 유니온) 도입 + **원만** 먼저 구현(Approach A), OBB(대각선 버스)·캡슐(경기장)은 같은 seam 위 후속. 밀어내기(`resolveCircleMove`)는 최근접점 일반화로 값싸고, **진짜 비용은 형태별 우회 스티어링(`steerAroundObstacles`, 원=접선)**. 가까운 별개 잔해 사이 통과(좁은 틈) 튜닝·`MAX_RESOLVE_PASSES` 검증 포함. **원 프리미티브 완료**(`feat/circle-obstacle`, PR #62, 2026-07-20 — 판별 유니온 seam + 접선 우회, [[F50]] 좌표 NaN 가드도 함께 흡수). OBB(대각선 버스)·캡슐(경기장)은 같은 seam 위 후속. | `sessions/2026-07-18-convex-primitive-collision-design.md`, `sessions/2026-07-14-map-space-roadmap.md` D2·D4 |

---

## F. 로버스트니스 · 인프라 (기회 될 때 — 대부분 저위험·동작 무영향)

> **미발현**으로 표시된 항목은 현재 코드 경로에서 그 분기에 도달하지 않는다(방어 코드 또는 미래 데이터 조건에서만 발현). 위험은 낮지만 조건이 생기는 슬라이스에서 함께 닫는다.

### F-1. 진단 · 방어 코드

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| F1 | 열림 | 낮음 | ✨ `startingSpellIds` 시드 실패 무알림 | `addSpell`이 6슬롯 초과·중복을 조용히 버린다. `console.warn` 진단 추가. | `sessions/2026-06-01-magic-followups.md` §2 |
| F2 | 열림 | 낮음 | 🐛 `_onPickCard`가 `addSpell` 반환값을 버림 | 미발현 — 1회 픽 흐름엔 무해. 다중 픽 패널이 생기면 거부된 추가가 픽을 소모할 수 있다. | `../qa/magic-add-card-review-issues.md` |
| F4 | 열림 | 낮음 | 🐛 `getEnemy(enemyId)`가 null이면 inert 적이 `maxEnemies`를 영구 점유 | 미발현 — director가 유효 id만 고른다. 데이터 정합성 이슈라 D2와 함께 볼 것. | `../qa/enemy-xp-pooling-review-issues.md` M-2 |
| F25 | 열림 | 낮음 | 🐛 `HudFormatLogic` 비유한 입력 가드 | 미발현 — `formatTimer(NaN)` → `"NaN:NaN"`, `formatTimer(Infinity)` → `"Infinity:NaN"`, `barRatio(NaN, ·)` → `NaN`(그대로 `ProgressBar.progress`로 전파), `formatNumber(1e21)` → `"1e+21"`(지수 표기로 바뀌어 자릿수 그룹핑이 깨짐). 현재 호출자(`gameTimer`·`playerHp`·`currentXp`)는 전부 유한하고 1e21 미만이다. 세 함수에 `Number.isFinite` 가드(→ `"00:00"`·`0`·`"0"`) + 순수 테스트. ※ 아카이브의 완료된 F25(근접 마커 클램프)와 **번호가 겹친다** — 원본 문서의 표기 오류이며 이쪽이 현재 열려 있는 F25다. | `../qa/hud-layout-review-issues.md` M2·R3 |
| F29 | 열림 | 낮음 | ✨🔧 에디터 배선 컴포넌트의 필수 `@property` 누락 loud-fail 정합화 | `PauseController.onLoad`는 `pausePanel` 미연결 시 조용히 no-op이라, 7단계 배선 실수가 "ESC로 얼어붙되 메뉴 안 뜸"으로 조용히 샌다. `HudController`·`ResultController`가 쓰는 house 패턴(`console.error` + `this.enabled = false`)으로 맞추면 크게 드러난다. **공통 규칙으로 승격 검토.** | `../qa/pause-menu-review-issues.md` O1 |
| F56 | 열림 | 낮음 | 🧹 장애물 색인 경고 순서 — F50 스킵 전에 다른 경고가 먼저 뜬다 | 미발현(씬 손상만) — `MapManager._indexObstacles`에서 비정사각(원)·scale·angle 경고가 F50 유한성 가드/`continue`보다 먼저 실행돼, `NaN` 크기 노드가 "비정사각"(NaN ≠ height)과 F50 스킵을 둘 다 뱉는다. 유한성 가드를 크기 계산 직후·경고들 앞으로 올리면 단일 신호가 되나, 블록 재배치 리스크 대비 이득이 낮다(에디터로 도달 불가). | `../qa/circle-obstacle-review-issues.md` M-1 |
| F47 | 열림 | 중 | 🐛🔧 새 프리팹의 Sprite 레이어가 UI_2D로 새어 게임 카메라에서 어긋나 보인다 | 게임 Canvas는 `DEFAULT` 레이어인데, Cocos 에디터에서 `Create → 2D Object → Sprite`로 자식 노드를 만들면 레이어가 `UI_2D`로 붙는다. 게임 `Camera`(visibility=DEFAULT)와 `UICamera`(visibility=UI_2D)의 마스크가 서로 배타적이라, 이렇게 새어 나간 스프라이트는 **플레이어를 따라가지 않는 고정 `UICamera`가, 그것도 다른 배율(orthoHeight 871 대 360)로** 그린다. 그래서 노드의 실제 좌표는 멀쩡한데 그림만 엉뚱한 곳에 찍히고, 에러도 경고도 나지 않는다. 실제로 `NovaVfx`·`OrbVfx`·`EnemyBullet`·`Enemy > LungeMarker`의 자식 Sprite 네 개가 이 병에 걸려 있었다(2026-07-14 에디터에서 레이어 교정). 카메라를 둘로 쪼갠 **H1(PR #35) 이후에 만든 프리팹이 전부 감염됐다는 게 핵심** — 새 프리팹을 만들 때마다 재발한다. 봉합 후보는 `PoolManager.acquire()`(또는 스폰 경로)가 꺼낸 노드의 자식 레이어를 부모 레이어로 강제하거나, 어긋난 레이어를 발견하면 개발 빌드에서 시끄럽게 경고하는 것이다. | 2026-07-14 인게임 테스트 (`feat/singleton-null` 7단계) |

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
| F46 | 열림 | 낮음 | 🐛 `HudController._prevState`와 카드 패널의 즉시 재개가 어긋남 | 미발현(도달 불가 선행조건) — `_handleStateChange`가 `_prevState = state`를 **먼저** 쓰고 그 다음에 `cardSelectPanel.active = true`를 세운다. Cocos는 활성화를 동기 처리하므로 그 대입 안에서 `onEnable`이 돌고, 빈 드로우 가드가 즉시 `resumeFromLevelUp()`을 부르면 프레임 끝 상태가 `panel.active=true` + `state=Playing` + `_prevState=LevelUp`으로 어긋난다. 다음 프레임에 곧바로 레벨업이 또 오면 HUD가 `state === _prevState`로 보고 조기 return해 패널이 이미 열려 있으므로 `onEnable`이 재발화하지 않는다 → **카드 없이 LevelUp에 영구 정지.** 지금은 `drawCards`가 `[]`를 돌려줄 수 없어(무제한 패시브 카드) 도달하지 않는다. 봉합은 HUD 쪽 — 패널 활성화 **뒤** 상태를 다시 읽어 같은 프레임에 닫고 `_prevState`를 실제 값으로 맞춘다(한 프레임 빈 패널 깜빡임도 함께 사라진다). | `../qa/singleton-null-review-issues.md` 재리뷰 |
| F45 | 열림 | 낮음 | 📐 부팅 불변식이 소비처를 가로질러 강제되지 않음 | 미발현 — `GameManager._onDataReady()`는 "전부 성공하거나 전부 실패"(`_started`·`setOnLevelUp`·`startWave`가 한 덩어리)를 지키지만, `EnemySpawner.update()`는 `_started`를 보지 않고 `gm`·`wm`·`dm.isReady`만 본다(`_state` 기본값이 `Playing`). 부팅이 loud-fail한 상황에서도 스포너는 `wave = 0`으로 적을 뿌린다. 소비처마다 준비 상태를 각자 재유도하는 대신 `GameManager.isStarted` 게터 하나를 보게 하면 불변식이 정직해진다(`SpellCaster`·`PlayerController`의 `_dataReady` 래치도 같은 후보). | `../qa/singleton-null-review-issues.md` |
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
| F9 | 열림(부분 완료) | 낮음 | 🔧 씬 **UICamera** 크로스머신 churn | MacBook 작업 / Windows 테스트 시 `main.scene` Camera 노드의 `_lpos.y`·`_orthoHeight`가 재계산돼 무관한 diff가 난다(장비별 해상도 차이로 에디터가 카메라를 재fit·재직렬화). 매 PR 테스트마다 반복된다. **2026-07-13 map-arena에서 게임 `Camera`는 해결** — `CameraController`가 `orthoHeight=360`을 못박고 `Canvas.alignCanvasWithScreen=false`로 꺼서 더는 튀지 않는다. **잔존 범위는 `UICamera` 하나** — `UICanvas.alignCanvasWithScreen=true`라 Cocos가 화면 크기에 맞춰 재fit하며, map-arena 7단계 테스트에서도 `1175.2965…` → `871.6564…`로 churn이 재발했다. 해소하려면 UICanvas 정렬 정책을 바꿔야 하는데 **HUD 스케일링 회귀 검증이 따라붙으므로** 별도 슬라이스로 남긴다. | projectile-count 테스트 (2026-06-11), `../qa/map-arena-test.md` §6 (2026-07-13) |
| F10 | 열림 | 중 | 🔧 `workflow-state.json` 크로스머신 동기화 정책 결정 | 전이를 커밋 안 하면 타 장비가 stale해지고(실제로 겪음), 커밋하면 main 오염·머지 충돌·락 상속이 생긴다. "추적 유지 + 핸드오프 시점만 커밋"(권장) vs `.gitignore` 제외 중 택해 ADR 004에 반영. | `troubleshooting/workflow-state-cross-machine.md`, ADR 004 |
| F59 | 열림 | 낮음(리깅 슬라이스 착수 전) | 🔧🎨 아트 생성·리깅 툴체인 리스크·자동화 | 아트 실행은 [`backlog.md`](backlog.md) **F58**, 계획은 [`../design/art-direction.md`](../design/art-direction.md). 여기 남기는 건 그 계획에서 뜬 툴체인 두 가지다. ① **리깅 도구 결정됨(2026-07-24 해소)** — DragonBones 폐기(공식 사이트가 loongbones.app SaaS로 전환돼 월 구독료 + 에디터 2021 이후 정체). **리깅은 Spine 확정**(기본 요금제 결제 예정)이고 **학습도 Spine에서 한다** — Cocos 내장 컷아웃으로 먼저 실습하는 안은 배우는 것의 절반이 Cocos 전용(뼈·웨이트·IK·스킨이 1급이 아니고, `sp.Skeleton`에선 무효인 앵커·Size 습관이 붙는다)이라 폐기했다. 따라서 "어느 도구를 쓸까" 판단도, DragonBones의 "에디터 구동 확인" 게이트도 남지 않았다. 리깅 슬라이스에 남는 일은 **Spine 요금제 기능 확인·결제 → 파츠 컷·인페인팅 → 리깅 → `sp.Skeleton` 배선**이다. **결제 전 확인 필요:** 메시·웨이트·IK는 상위 등급 전용으로 알려져 있는데, v2 스킨 판매의 토대인 **스킨 기능이 기본 등급에 포함되는지**를 공식 기능 비교표로 확인해야 한다(포함되지 않으면 요금제 선택이 로드맵 v2와 충돌한다). art-direction §3.2. ② **AI·MCP 자동화** — SAM 분할·인페인팅·ControlNet(T포즈)·LayerDiffuse로 미적 노동을, ComfyUI HTTP API를 감싼 MCP 서버로 배치 생성·후처리 운영 노동을 줄여 "손그림·미감 최소화"(art-direction §8) 원칙을 관철. **크로스머신 분리 검토(2026-07-22)** — 생성(GPU)은 윈도우, 마감·통합은 맥으로 가르는 구도. 핸드오프 산출물은 PNG+매니페스트, 맥엔 AI 스택 불필요. 학습은 bitsandbytes(CUDA 전용) 때문에 맥 불가라 윈도우/클라우드에 묶임. 결정 3개(배경 제거 위치·핸드오프 방식·동기화 수단) 미확정. | `../design/art-direction.md` §3·§8-8·부록 C·D, 이 대화(2026-07-21), `sessions/2026-07-22-art-pipeline-cross-machine-split.md`(크로스머신 분리 검토) |

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

### 입력 · 포커스

- **F65** 창 포커스를 잃으면 눌린 이동키가 고착 → **완료**(`feat/input-focus-reset`, 2026-08-01). 이동키를 누른 채 창 밖으로 나갔다 오면 캐릭터가 그 방향으로 계속 걷고 반대 방향 키가 먹지 않던 버그다. 원인은 Cocos의 웹 키보드 입력이 `keydown`·`keyup`을 **`GameCanvas` 엘리먼트에만** 걸어(`pal/input/web/keyboard-input.ts`), 포커스가 캔버스를 떠난 뒤의 `keyup`이 캔버스로 오지 않는 것이다. 이동 벡터가 마주 보는 축의 뺄셈이라 위쪽이 굳으면 아래키가 `1-1=0`으로 상쇄돼 **반대 방향만 죽고 좌우는 멀쩡한** 증상이 된다. **원래 진단(창 `blur` + `Game.EVENT_HIDE`)은 절반만 맞았다** — 계획 리뷰에서 캔버스가 `tabindex`로 **독립적으로 포커스를 갖는다**는 것이 드러났고(빌드된 `index.html`에서 확인), 페이지 안에서 캔버스 바깥을 클릭하면 창은 포커스를 유지한 채 캔버스만 잃어 그 경로가 통째로 샌다. itch.io는 게임을 iframe으로 얹으므로 이 경로가 일상 동선이다. 그래서 **`game.canvas`의 `blur`가 봉합의 핵심**이고(=`keyup` 유실의 정확한 조건), 창 `blur`는 주 경로 백스톱, `Game.EVENT_HIDE`는 네이티브 대비다. 눌린 키 상태는 `logic/MoveInputLogic.ts` 순수 모듈로 꺼내 "해제 뒤 반대 방향이 즉시 먹는다"를 테스트로 고정했다. **받아들인 비용:** 키를 계속 누른 채 돌아오면 캐릭터가 멈춘다(브라우저가 이미 눌린 키의 `keydown`을 다시 안 보낸다). → `sessions/2026-08-01-input-focus-reset-plan.md`, `../qa/input-focus-reset-test.md`, `../qa/input-focus-reset-review-issues.md`
- **F63** `hitbox-viewer.html` biome 에러 4건 → **완료**(`feat/input-focus-reset`, 2026-08-01). 버튼 3개에 `type="button"`(기본값 `submit`), `forEach` 콜백 본문을 중괄호로 감싸 반환값 제거. 이걸로 `pnpm check`가 레포 전체에서 종료코드 0이 된다. 정보 수준 29건(`useTemplate`)은 종료코드에 영향이 없어 남겨 뒀다. biome 대상에서 제외하는 대안은 택하지 않았다 — 제외하면 검사 밖에서 낡는데 F62 최종 아트로 히트박스를 다시 잴 때 또 쓸 도구다.

### 툴체인 · 타입 게이트

- **F51** "인과를 복원할 수 있게 쓴다" 규칙의 3중 복사본 → **완료**(`docs/gbrain-setup`, 2026-07-25). 같은 3원칙이 `CLAUDE.md`·`conventions.md`·`writing-style.md`에 축자적으로 들어가 있어 **한 곳만 고치는 사고가 두 번** 났던 건이다. 리뷰가 제안한 대로 **`writing-style.md`를 정본으로 두고** 나머지 둘에서 원칙 열거를 걷어냈다 — `conventions.md`는 코드 주석에 적용한 예시와 링크만 남기고 "원칙을 여기 옮겨 적지 않는다"는 금지를 사고 이력과 함께 박았으며, `CLAUDE.md`는 트리거 한 줄 + 링크로 줄였다. 두 곳 모두 "복사본은 함께 고친다"는 불변식만 남겨, 규칙 자신이 그 규칙을 어기던 상태를 닫았다. 함께 정리: `architecture.md`에 대상·정본 관계 머리말 추가(참조 0회의 사람용 조감도인데 의미 검색 색인에 들어가면서 낡은 내용이 검색 결과로 샐 수 있게 됐다).

- **F24** 싱글톤 타입 정직화 → **완료**(`feat/singleton-null`, 2026-07-14). 매니저 7개의 `static instance`를 `T | null`로 바꾸고, 타입체크가 짚어낸 **65곳**의 가드 없는 역참조를 닫았다. **설계가 계획 중에 한 번 뒤집혔다** — 원안(호출부마다 조기 return)을 리뷰가 실측으로 반박했다. ① 조기 return이 상태 전이를 반쪽 실행시키는 자리가 **3곳이 아니라 16곳**이었고(승리 전이·부팅 래치·경험치 로직·풀링 재초기화 4곳 — 전부 에러 없이 조용히 죽는다), ② 그 65곳 중 **약 85%는 null이 도달조차 못 하는 자리**였다(Cocos가 파괴를 프레임 끝으로 미루므로 `update()` 중 매니저가 사라지지 않는다 — 실제 null 창은 teardown 1곳뿐이고 이미 `?.`로 막혀 있었다). 채택한 방식은 **활성화 시 1회 검사 후 캐시 + loud-fail**이라, 핫패스에 새 분기가 생기지 않고 지뢰 16곳이 구조적으로 사라진다. 「던지는 게터」 대안은 실행해 보니 `?.`와 `if (!X.instance) return`을 게터가 먼저 throw시켜 `497fb90`이 고친 크래시를 되살려 폐기했다. 함께 닫음: `DataManager`·`I18n` 콜백 누수(`onDestroy` 미정리 → 죽은 컴포넌트 콜백이 **새 씬 인스턴스에 대해 성공** 실행), 데이터 로드 실패 loud-fail, `DataManager` 게터 캐스트 제거. 패턴은 `conventions.md` 「싱글톤 소비」에 박았다. → `sessions/2026-07-13-singleton-null-plan.md`
- **F3** `resources.load` 콜백 asset 널 가드 → **완료**(`feat/singleton-null`, 2026-07-14). `DataManager`·`I18n` 둘 다. **타입체크가 이걸 강제해 주지 않는다** — Cocos 타입 정의상 콜백의 `asset`이 non-nullable이라 손으로 넣어야 한다. `asset`만이 아니라 `asset.json`(nullable)까지 확인한다 — 여기서 null을 흘려보내면 `_playerData`가 null인 채 `_isReady`가 켜져 더 깊은 곳에서 터진다.
- **F44** `approve-pr`이 타입체크를 **실측** → **완료**(`feat/singleton-null`, 2026-07-14). 기록(`ts_check_scope`)만 보던 것을 머지 직전 `runTypecheck()` 실행으로 바꿨다. `verification`은 스크립트 편집을 허용하므로 `pass ts` 뒤에 코드를 고치고 `invalidate`를 잊으면 깨진 타입이 머지되던 구멍이다. 신선한 결과가 `scope === "full"`인지까지 보고(Cocos 미실행 머신의 `logic-only` 프리패스 차단), 상태 파일의 범위 기록도 새 결과로 덮어쓴다. **잔존:** `cso`·`lint`·`review` 세 플래그는 여전히 같은 stale 노출을 갖는다(기계 검증이 불가능한 판단이라 성격이 다르다).
- **F27** `static instance!:`가 TS1255 → **완료**(`feat/ts-toolchain`, 2026-07-13). **원래 진단이 틀렸다.** 백로그는 이걸 "IDE와 Cocos 번들 TS의 버전 불일치로 인한 **오탐**"으로 적어 뒀는데, Cocos 3.8.8이 번들한 바로 그 TypeScript(5.8.2)를 직접 돌려 보니 **동일하게 TS1255를 냈다.** 버전 차이가 아니라 진짜 문법 위반이다 — 정의 할당 단언(`!`)은 static 멤버에 허용되지 않는다. 게임이 돌았던 건 **Cocos가 타입 검사 없이 트랜스파일만 하기 때문**이고, 우리는 진짜 에러를 조용히 무시하고 있었다. 선언 7곳(6개가 아니었다)을 `null as unknown as T`로 통일했다. **타입이 여전히 거짓말한다는 잔여 문제는 F24가 받는다.** → `sessions/2026-07-13-ts-toolchain-plan.md`, `troubleshooting/typescript-version-pin.md`
- **F30** `lib` 미지정으로 ES2017 API가 TS2550 → **완료**(`feat/ts-toolchain`, 2026-07-13). `game/tsconfig.json`에 `lib: ["ES2017", "DOM", "DOM.Iterable"]` + `skipLibCheck` 추가. **제안됐던 `ScriptHost`는 불필요했고, ES2020도 불필요했다** — ES2020을 요구하던 유일한 파일(`I18nKeyGuard.ts`의 `matchAll`)이 알고 보니 **게임에서 한 줄도 안 도는 테스트 전용 헬퍼**였다(참조: 자기 테스트뿐). `tests/helpers/`로 옮기니 shipped 코드는 ES2017로 충분해졌다. `skipLibCheck`가 `cc.d.ts` 에러 102건을 없앤다(우리가 고칠 수 없는 엔진 선언). **단, 그중 미해결 모듈 15건(`pal/input/*`·`pal/audio/*`)은 보고만 꺼질 뿐 타입이 `any`로 새며 `PlayerController`가 그 영역이다.** → `sessions/2026-07-13-ts-toolchain-plan.md` §3
- **타입 게이트 강제** → **완료**(`feat/ts-toolchain`, 2026-07-13). F27·F30을 고쳐도 게이트가 여전히 명예제도였다 — `workflow.mjs`의 `pass()`가 검증 없이 플래그만 뒤집었고, 절차서의 `mcp__ide__getDiagnostics`는 **VS Code에 열린 파일만** 봤다. 이제 `pnpm typecheck`(레포 소유, `tsc --noEmit`)를 신설하고 **`pass ts`가 그 코드를 직접 호출**한다. 검사 범위(`ts_check_scope`)를 상태에 기록해 `approve-pr`이 `logic-only`를 거부한다 — `game/temp/`가 gitignore 대상이라 Cocos를 안 연 머신에서 게임 코드가 검사되지 않는데, 그걸 통과시키면 "Cocos 안 깐 머신 = 게이트 프리패스"가 되기 때문이다. **테스트 코드도 이때 처음으로 타입 검사됐고**(루트 tsconfig 부재 + vitest는 타입을 안 본다), 곧바로 진짜 타입 에러 하나를 잡았다(`MagicAddCard.test.ts` — `ISpellData.pattern` 누락). → `sessions/2026-07-13-ts-toolchain-plan.md` §5

### 렌더 구조 · 일시정지 정합성

- **H1** UI 항상-위 렌더 — UI 카메라 + 레이어 분리 → **완료**(`card-layer-fix`, PR #35). 레벨업 카드 패널 위로 적·플레이어가 겹쳐 보이던 문제. **근본 원인:** 단일 Canvas + 단일 카메라 구조라 2D 렌더 순서가 Canvas 자식 배열 순서로 정해지는데, 적이 런타임 `addChild`로 항상 배열 맨 뒤(=위)에 붙었다. 그래서 에디터에서 패널을 마지막 자식으로 옮기는 것만으론 안 고쳐진다. 게임/UI를 **두 Canvas**로 분리해 닫았다(단일 Canvas + 2카메라 시도는 게임 월드가 UICamera에서 컬링돼 폐기). → `sessions/2026-06-17-card-layer-fix-plan.md`
- **I1** 날아가던 발사체가 LevelUp 일시정지를 무시 → **완료**(`projectile-pause-guard`, PR #47). 멈춤이 전역 `director.pause`가 아니라 각 시스템이 `update()`에서 `state !== Playing`을 확인하는 방식이라, 가드를 안 단 `Projectile`·`EnemyProjectile`이 일시정지 중에도 이동·명중·`damagePlayer`·폭발했다(메뉴 중 피격 — 공정성 문제). 두 `update()` 맨 앞에 가드 추가. → `sessions/2026-07-01-projectile-pause-guard-plan.md`
- **I2** `XPItemController.update`가 일시정지 중 픽업 반경 내 XP를 흡수 → **완료**(`feat/pause-menu`). 오브가 이동하지 않고 플레이어도 정지해 상대 거리가 정적이라 무해했지만(모달 메뉴), 같은 가드로 닫았다. → `../qa/projectile-pause-guard-review-issues.md` M1
- **I3** 정지한 발사체가 카드 선택 패널 위로 렌더 → **완료**(`feat/pause-menu`, 라이브 검증 — 미재현). I1으로 발사체가 화면에 멈춰 서면서 가시화된 레이어 버그(인과 아닌 노출 계기). 현 씬 구성에서 재현되지 않음을 확인. | 2026-07-01 인게임 테스트

### 로버스트니스

- **F43** 적 경로탐색 — 장애물 회피(로컬 회피로 축소) → **완료**(`feat/building-collision`, PR #60, 2026-07-18). 원안은 흐름장(flow field) 경로탐색이었으나, 2026-07-14 결정으로 한강이 배리어가 아니라 소프트 해저드가 되면서(F39) 적이 큰 지형을 우회할 일이 없어져 **건물(F38) 하나를 도는 로컬 회피**로 범위가 줄었다. **원안의 "방향 계산을 안 바꾼다(스티어링·내비게이션 분리)"는 불가능했다** — 밀어내기는 속도의 법선 성분만 지우므로 정면 진입에서 변위가 0이 되고 남는 접선 성분이 정지점을 **끌개**로 만들어 비스듬히 온 적까지 빨려들어 멎는다(해소는 못 갈 곳을 막을 뿐 새 방향을 못 만든다). 실제 구현은 **우회 스티어링(`steerAroundObstacles`, 코너 바이어스) + 밀어내기 해소** 2단계이고, 스티어링이 장애물을 알아야 하므로 분리가 성립하지 않는다. `MovementLogic` 시그니처 자체는 불변(우회는 그 결과를 덧씌우는 별도 단계). **D4(방 금지)가 이 축소를 떠받친다** — 한 변 ≤ 300px 볼록 박스만 쓰면 로컬 회피로 충분하다. 방·복도가 도입되면 부족해지고 spawn-geometry의 유클리드 교전 카운트까지 도달성 기반으로 갈아엎어야 한다. → `sessions/2026-07-16-building-collision-plan.md`, `../qa/building-collision-test.md`
- **F14** CC 다중 타이머 모델 전환 → **완료**(magic-S3, PR #38). 단일 슬롯(강도·지속을 각각 max로 합침)이 **약하고 긴 소스가 강한 강도의 잔여를 늘리는** 설계 오류였다. 강도별 독립 타이머로 재작성 — 동시 감소, 매 순간 살아 있는 것 중 가장 센 강도 적용, 재적중 시 그 강도만 재충전. 슬로우(아이스 미사일)가 두 번째 강도로 들어오며 발현했다. → `sessions/2026-06-21-magic-slow-plan.md` §2.1
- **F16** 그리드 질의 → 타겟 수집 루프 중복 → **완료**(`feat/inferno`). 세 번째 호출부(인페르노 궤도 충돌)가 생겨 rule-of-three가 성립 → `GameManager.collectTargetsInRadius(cx, cy, r)`로 추출해 `_castNova`·`Projectile._detonate`·`_applyOrbHit`가 공유한다(동작 무변경). **잔여:** 중복 제거 집합 수명 통합은 다음 비-발사체 패턴 도입 시 재검토. → `../qa/inferno-review-issues.md` M2
- **F18** 글로서리 "창"(window 직역) 용어 → "구간" 통일 → **완료**(`feat/player-iframe`). 한국어 단독 "창"은 窓·槍으로 먼저 읽혀 시간 스팬 의미로는 비관용적이다. 단어 속 "창"(창백한·얼음 창)은 보존. → `docs/development/glossary.md`
- **F20** kite 정착-vs-사거리 불변식 테스트 + `_fireProjectileFn` 죽은 가드 정리 → **완료**(`feat/enemy-multishot`, PR #46). (a) 실 `enemies.json`을 로드해 유격 적 전부가 `preferredRange + KITE_DEADZONE_BAND(40) ≤ attack.range`를 만족하는지 단언(구미호 360≤420·이무기 380≤460·물귀신 300≤520) — 어기면 적이 사거리 밖에 정착해 거의 안 쏜다. (b) null 가드 주석을 실제 동작에 맞게 정정. → `sessions/2026-06-29-enemy-multishot-plan.md` §8
- **F50·F54·F55 + F53(원 부분)** 원 프리미티브 충돌 + 데이터 경계 가드 → **완료**(`feat/circle-obstacle`, PR #62, 2026-07-20). 축정렬 사각형(AABB) 전용이던 장애물 충돌에 판별 유니온 seam(`rect|circle`)을 도입해 **원 프리미티브**를 더했다(원형 건물 대각선의 `~0.41R` 투명벽 제거) — 밀어내기 최근접점 일반화 + 형태별 접선 우회 스티어링. 같은 슬라이스가 데이터 경계 배터리(`MapManager` 색인)도 채웠다: **F50**(좌표 `Number.isFinite` 가드 — NaN 오염 차단), **F55**(`MIN_OBSTACLE_SIDE=120` 최소 변 하한 경고 — 얇은 박스 관통 위험 차단), **F54**(테스트 픽스처 라벨을 "합성 아레나(크기 불가지)…실제 서울 4800"으로 중립화). **F53은 원만 닫혔고 OBB·캡슐이 잔여**라 열림 유지. 후속 F56(장애물 색인 경고 순서)은 신규 열림. → `sessions/2026-07-18-convex-primitive-collision-design.md`, `../qa/circle-obstacle-review-issues.md`
