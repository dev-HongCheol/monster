# 개발 백로그 — 코드 (living)

> **목적:** 구현·테스트 중 떠오른 "지금 슬라이스 밖" 할 일 중 **코드가 어떻게 굴러가는가**에 해당하는 것(아키텍처·리팩터·타입·툴체인·성능·데이터 검증·미발현 로버스트니스 버그)을 모은다.
> **게임 쪽 백로그는 [`backlog.md`](backlog.md)에 있다** — 콘텐츠·밸런스·게임필·UI/UX·메타.
> **문서 쪽 백로그는 [`backlog-docs.md`](backlog-docs.md)에 있다** — 정본 구조·문서 규칙·문서 검사 도구·문서 검색 색인.
> **작성 시작:** 2026-06-11 (원래 `backlog.md`) · **분리:** 2026-07-10 게임/코드 · 2026-08-20 문서
> **성격:** 계속 갱신하는 living 문서. 운영 규칙과 상태·우선 어휘는 [`backlog.md`](backlog.md) 머리말이 정본이다.

**파일에 걸친 항목:** 경계에 선 항목은 주 파일 한 곳에만 두고 반대편에서 역링크한다.
- `F8`(카드 라벨 잘림)·`F26`(사망 연출)·`F28`(죽음·승리 비트 강화) → [`backlog.md`](backlog.md)
- `F64`(발치 기준을 물 구역·적 이동 충돌로도 넓힐지) → [`backlog.md`](backlog.md). 증상은 게임필이라 그쪽이 주 파일이지만, 실제 결정은 `logic/FootprintLogic.ts`를 플레이어 전용에서 공용 규칙으로 승격할지라는 코드 구조 판단이다.
- `F66`(판정 형태 정합성 — 적 원 vs 플레이어 사각형) → [`backlog.md`](backlog.md). 증상은 게임필·아트 정합(닿지 않았는데 맞는다, 스킨이 판정을 바꾼다)이라 그쪽이 주 파일이지만, 실제 조치는 `threatScale`↔`collisionRadius` 유도 관계와 피격 사각형 중심 오프셋 필드처럼 데이터 스키마·순수 함수 쪽 변경이다. 전수 조사는 [`sessions/2026-08-03-collision-shape-audit.md`](sessions/2026-08-03-collision-shape-audit.md).
- `B6`(풀 보관 한도)은 게임 밸런스 항목이지만 아래 `G1`에 흡수됐다.
- `F10`(`workflow-state.json` 동기화 정책)·`F79`(씬에 남은 `LocalizedLabel`)·`F100`(생성 기록을 `source.json`으로)은 문서를 고치는 것처럼 보이지만 여기 남는다. 판정 기준과 그 셋을 이렇게 가른 이유는 [`backlog-docs.md`](backlog-docs.md) 머리말이 든다.

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

> 문서 자체를 손대는 항목은 2026-08-20에 [`backlog-docs.md`](backlog-docs.md)로 갈라 나갔다(F71·F75·F76·F78·F80·F82·F83·F85·F86·F94~F97). 여기 남는 것은 씬·상태 파일·아트 툴체인·라이선스처럼 **산출물이 문서가 아닌** 것이다.

| # | 상태 | 우선 | 항목 | 요약 · 왜 | 출처 |
|---|------|------|------|-----------|------|
| F9 | 열림(부분 완료) | 낮음 | 🔧 씬 **UICamera** 크로스머신 churn | MacBook 작업 / Windows 테스트 시 `main.scene` Camera 노드의 `_lpos.y`·`_orthoHeight`가 재계산돼 무관한 diff가 난다(장비별 해상도 차이로 에디터가 카메라를 재fit·재직렬화). 매 PR 테스트마다 반복된다. **2026-07-13 map-arena에서 게임 `Camera`는 해결** — `CameraController`가 `orthoHeight=360`을 못박고 `Canvas.alignCanvasWithScreen=false`로 꺼서 더는 튀지 않는다. **잔존 범위는 `UICamera` 하나** — `UICanvas.alignCanvasWithScreen=true`라 Cocos가 화면 크기에 맞춰 재fit하며, map-arena 7단계 테스트에서도 `1175.2965…` → `871.6564…`로 churn이 재발했다. 해소하려면 UICanvas 정렬 정책을 바꿔야 하는데 **HUD 스케일링 회귀 검증이 따라붙으므로** 별도 슬라이스로 남긴다. | projectile-count 테스트 (2026-06-11), `../qa/map-arena-test.md` §6 (2026-07-13) |
| F10 | 열림 | 중 | 🔧 `workflow-state.json` 크로스머신 동기화 정책 결정 | 전이를 커밋 안 하면 타 장비가 stale해지고(실제로 겪음), 커밋하면 main 오염·머지 충돌·락 상속이 생긴다. "추적 유지 + 핸드오프 시점만 커밋"(권장) vs `.gitignore` 제외 중 택해 ADR 004에 반영. | `troubleshooting/workflow-state-cross-machine.md`, ADR 004 |
| F59 | 열림 | 낮음(리깅 슬라이스 착수 전) | 🔧🎨 아트 생성·리깅 툴체인 리스크·자동화 | 아트 실행 자체는 [`backlog.md`](backlog.md) **F60**, 방향은 [`../design/spec/art-direction.md`](../design/spec/art-direction.md)에 있다. 여기 남는 건 툴체인 둘이다. ① **리깅 도구 = Spine 확정**(2026-07-24 — DragonBones는 공식 사이트가 SaaS로 전환돼 폐기, Cocos 내장 컷아웃으로 먼저 실습하는 안도 배우는 것의 절반이 Cocos 전용이라 폐기. 근거는 art-direction §3.2). 도구 판단이 끝났고 **라이선스·등급 확인도 닫혔다**(2026-08-20 정정 — 종전 이 자리에 「결제 전 확인 하나가 남았다」가 있었으나 이미 답이 나온 뒤였다). 스킨 기능이 기본 등급에 있다는 것은 공식 기능 비교표로 확인돼 [`../design/spec/art-asset-spec.md`](../design/spec/art-asset-spec.md) §5.1이 들고, 런타임을 제품에 넣어 파는 조건은 [`spec/ops-licensing.md`](spec/ops-licensing.md) §2가 든다. **살 시점은 파츠 분리된 에셋이 한 벌 나왔을 때다** — 그 파일이 메시를 쓰는지 보고 등급(Essential $69 / Pro)을 정하며, 무료 트라이얼은 저장·내보내기가 막혀 Cocos까지 실제로 들어가는지를 확인할 수 없다([유료 전환 계획](sessions/2026-08-04-paid-art-pipeline-plan.md) §10). 그다음은 파츠 컷·인페인팅 → 리깅 → `sp.Skeleton` 배선. ② **자동화 + 크로스머신 분리** — **전제가 2026-08-06에 바뀌었다**: 생성이 유료 서비스(fal.ai)로 옮겨 가 로컬 GPU 도구(SAM·ControlNet·LayerDiffuse)와 ComfyUI HTTP API를 감싼 MCP 서버 안이 전부 무효가 됐고, "생성은 윈도우 / 마감은 맥" 구도도 GPU에 묶일 이유가 사라져 다시 봐야 한다. 자동화의 실체는 이제 **fal.ai API 호출**이다(환경에 `FAL_KEY`를 두면 생성부터 판정까지 한 번에 돈다 — [검토 문서](sessions/2026-08-07-art-cutout-pipeline-review.md) §5.3). 결정 3개(배경 제거 위치·핸드오프 방식·동기화 수단) 미확정. **「배경 제거 위치」는 2026-08-22에 닫혔다** — fal 매팅(`bria/background/remove`)으로 옮겼고 판정 도구가 `tools/art/`와 `tests/helpers/SpriteMetrics.ts`에 섰다. 조건과 판정 항목은 [`../design/spec/art-generation-playbook.md`](../design/spec/art-generation-playbook.md) §8이 정본이다. **남은 결정은 둘**(핸드오프 방식·동기화 수단)이다. 아래는 그때의 경위 기록이다 — **(닫힘)** — 로컬 색 키잉이 하루에 세 번 새면서 임계값이 시트마다 다시 재야 하는 값이 됐고, fal.ai에 매팅(`birefnet/v2`·`bria/background/remove`)과 투명 PNG 레이어 분해(`seedream/v5/pro/layerize`)가 $1 미만으로 있다. 실험 둘의 판정 항목과, layerize가 통과하면 ①의 파츠 컷과 **F67**까지 흡수되는 범위는 [검토 문서](sessions/2026-08-07-art-cutout-pipeline-review.md)에 있다. | `../design/spec/art-direction.md` §3.2·§8-8, `sessions/2026-07-22-art-pipeline-cross-machine-split.md`, `sessions/2026-08-07-art-cutout-pipeline-review.md` |
| F98 | 열림 | 중(J4·J6 착수 시) | 🔧🎨 폰트·사운드 라이선스 확인 | 라이선스 감사(F68)가 지금 쓰는 도구를 전부 가렸으나 **폰트와 사운드는 대상이 아직 없어 비워 뒀다** — `game/assets/` 아래에 폰트 파일도 오디오 파일도 0개다(2026-08-20 실측). 고르는 시점에 [`spec/ops-licensing.md`](spec/ops-licensing.md) §2 판정표에 행을 붙인다. 사운드는 [`backlog.md`](backlog.md) **J6**이 "로열티 프리 또는 AI 생성"으로 열어 뒀는데 그 둘은 조건이 서로 다르고, 폰트는 한국어·영어를 같은 글꼴이 덮어야 한다는 제약과 함께 본다(J4). **고르고 나서 확인하면 이미 화면에 박힌 뒤다.** | `spec/ops-licensing.md` §2, `sessions/2026-08-20-license-audit-plan.md` |
| F99 | 열림 | 중(출시 준비) | 🔧 상점 AI 고지 + EU AI Act 투명성 의무 | Steam은 배포 전 설문에 AI 사용을 기재하게 하고 그 내용을 스토어 페이지에 공개하며, itch.io는 AI Disclosure 미표기를 **delisting 사유**로 든다(원문·URL은 [`spec/ops-licensing.md`](spec/ops-licensing.md) §6). 우리 아트가 생성 AI 산출물이므로 두 상점 모두 대상이라는 판단까지는 서 있고, **남은 것은 제출 시점의 실제 기재**다. 유럽 판매가 들어가면 EU AI Act의 투명성 표시 의무도 같은 자리에서 함께 본다 — 확인이 안 된 축이라 여기에 묶어 둔다. 빌드·배포 표면은 [`spec/ops-build.md`](spec/ops-build.md)가 든다. | `spec/ops-licensing.md` §6 |
| F100 | 열림 | 낮음(F60 생산과 함께) | 🔧🎨 생성 기록을 기계가 읽는 자리로 옮긴다 | 실행 지침 §9가 채택 컷마다 다섯(엔드포인트 전체 경로·프롬프트 전문·시드·설정·레퍼런스 경로)을 남기라고 정했는데 **그 자리가 산문뿐이라** 세션 문서에 흩어진다. 생성일 폴더마다 `source.json`(서비스·엔드포인트·생성일·시드·서명 여부·파일 목록)을 두면 기록이 한자리에 모이고, 목록에 적힌 파일이 전부 있는지를 테스트가 잴 수 있다. **지금 짓지 않은 이유는 기록이 폴더 하나·파일 넷뿐이라 스키마를 추측으로 정하게 되기 때문이다**(2026-08-20 결정) — 적 12종·이펙트·맵이 들어오는 F60 생산 슬라이스가 스키마를 정할 자리다. 구현은 `game/assets/scripts/`가 아니라 `tests/helpers/`에 둔다(게임이 안 쓰는 파서에 `.meta`와 Cocos 왕복이 붙는다). | `sessions/2026-08-20-license-audit-plan.md` §5 |
| F101 | 열림 | 낮음 | 🧹 씬·프리팹이 안 쓰는 아트 자산 정리 | `player_mage_bridge.png`가 어느 씬·프리팹에서도 참조되지 않는다(UUID 역참조로 확인, 2026-08-20). 4방향 스프라이트로 교체되면서 남은 브릿지 자산이다. `player_staff.png`도 같은 상태지만 이쪽은 **배선 대기**라 성격이 다르다(지팡이 노드 배선이 별도 슬라이스로 남아 있다 — 실행 지침 §8.8). 지우기 전에 Cocos가 참조 없는 자산을 빌드에 싣는지부터 확인한다 — 안 실으면 용량 문제가 아니라 정리 문제일 뿐이라 우선순위가 더 내려간다. | [`sessions/2026-08-20-license-audit-plan.md`](sessions/2026-08-20-license-audit-plan.md) §5 |
| F102 | 열림 | 낮음 | 🧹 아트 파이프라인 도구의 잔여 정리 | `feat/ai-matting` 코드리뷰가 낸 Minor 중 이번에 안 고치고 남긴 것들이다. 사실이 어긋난 항목은 그 슬라이스에서 고쳤고, 여기 남는 것은 **지금 틀리지 않았지만 다음 사람이 걸릴 자리**다. ① `cropColumns`가 음수·비정수 구간을 조용히 받는다 — 지금 호출부가 `panelColumns` 결과뿐이라 안 걸리는데, F67이 손으로 구간을 넣기 시작하면 걸린다. ② `footCenterX`의 JSDoc이 「불투명 픽셀」이라 적고 실제로는 `alpha !== 0`이라 알파 1도 센다 — 이름과 동작 중 하나를 고른다. ③ `minAlpha`가 함수마다 포함(`>= `)·제외(`> `)로 갈린다 — 한쪽으로 통일하고 그 이유를 적는다. ④ `alignToCanvas`가 `trimBox`·`footCenterX`·`footLineY`로 같은 이미지를 세 번 훑는다 — 13장 규모에서는 문제가 아니라 미룬다. ⑤ 매팅 캐시가 `docs/temp/`(「스크립트로 다시 만들 수 있는 것만 둔다」)에 사는데, 지우면 재생성에 **돈이 든다** — 폴더 규칙과 어긋나므로 자리를 옮기거나 규칙에 예외를 적는다. ⑥ 호출부가 없는 산출물 셋(`readPngSize`·`achromaticRatio`·`IMatteResult.cachePath`) — F67의 실행기가 쓸 자리인지 확인하고, 아니면 지운다. **⑤가 제일 먼저다** — 손해가 실제로 돈이고 폴더 규칙이 그걸 모른다. | [`../qa/ai-matting-review-issues.md`](../qa/ai-matting-review-issues.md) M6~M10·덧 |
| F79 | 열림 | 낮음 | ♻️ `main.scene` 일시정지 패널의 `LocalizedLabel` 넷이 잔재다 | 같은 네 노드의 같은 네 키(`pause.title`·`resume`·`restart`·`menu`)를 씬의 `LocalizedLabel`과 `PauseController._t()`가 **각각** 쓰고 있다. 겹치면 화면에 무엇이 뜨는지가 어느 쪽이 나중에 도느냐에 달리는데 그 순서는 코드만 봐서 알 수 없고, 키를 고칠 때 한쪽만 고쳐도 나머지가 화면을 맞게 채워 **틀린 것을 알아채지 못한다.** 일시정지 메뉴 슬라이스에서 코드 구동으로 되돌리는 리워크가 났을 때 컴포넌트만 씬에 남아 생겼다. 처방은 씬에서 그 넷을 떼는 것이고, 선택 규칙의 정본은 [`spec/code-i18n.md`](spec/code-i18n.md) §8이다. **씬 편집이라 사용자가 에디터로 해야 한다.** | [`spec/code-i18n.md`](spec/code-i18n.md) §8.2 |

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

완료 항목은 [`backlog-implement-archive.md`](backlog-implement-archive.md)로 옮겼다(2026-08-06). 슬라이스 시작 시 조회하는 것은 위의 열린 항목뿐이므로, 지나간 결정을 되짚을 때만 그쪽을 연다.

