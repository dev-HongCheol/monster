# 개발 백로그 — 코드 (living)

> **목적:** 구현·테스트 중 떠오른 "지금 슬라이스 밖" 할 일 중 **코드가 어떻게 굴러가는가**에 해당하는 것(아키텍처·리팩터·타입·툴체인·성능·데이터 검증·미발현 로버스트니스 버그)을 모은다.
> **게임 쪽 백로그는 [`backlog.md`](backlog.md)에 있다** — 콘텐츠·밸런스·게임필·UI/UX·메타.
> **작성 시작:** 2026-06-11 (원래 `backlog.md`) · **분리:** 2026-07-10
> **성격:** 계속 갱신하는 living 문서. 운영 규칙과 상태·우선 어휘는 [`backlog.md`](backlog.md) 머리말이 정본이다.

**두 파일에 걸친 항목:** 경계에 선 항목은 주 파일 한 곳에만 두고 반대편에서 역링크한다.
- `F8`(카드 라벨 잘림)·`F26`(사망 연출)·`F28`(죽음·승리 비트 강화) → [`backlog.md`](backlog.md)
- `F64`(발치 기준을 물 구역·적 이동 충돌로도 넓힐지) → [`backlog.md`](backlog.md). 증상은 게임필이라 그쪽이 주 파일이지만, 실제 결정은 `logic/FootprintLogic.ts`를 플레이어 전용에서 공용 규칙으로 승격할지라는 코드 구조 판단이다.
- `F66`(판정 형태 정합성 — 적 원 vs 플레이어 사각형) → [`backlog.md`](backlog.md). 증상은 게임필·아트 정합(닿지 않았는데 맞는다, 스킨이 판정을 바꾼다)이라 그쪽이 주 파일이지만, 실제 조치는 `threatScale`↔`collisionRadius` 유도 관계와 피격 사각형 중심 오프셋 필드처럼 데이터 스키마·순수 함수 쪽 변경이다. 전수 조사는 [`sessions/2026-08-03-collision-shape-audit.md`](sessions/2026-08-03-collision-shape-audit.md).
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
| F59 | 열림 | 낮음(리깅 슬라이스 착수 전) | 🔧🎨 아트 생성·리깅 툴체인 리스크·자동화 | 아트 실행 자체는 [`backlog.md`](backlog.md) **F60**, 방향은 [`../design/art-direction.md`](../design/art-direction.md)에 있다. 여기 남는 건 툴체인 둘이다. ① **리깅 도구 = Spine 확정**(2026-07-24 — DragonBones는 공식 사이트가 SaaS로 전환돼 폐기, Cocos 내장 컷아웃으로 먼저 실습하는 안도 배우는 것의 절반이 Cocos 전용이라 폐기. 근거는 art-direction §3.2). 도구 판단은 끝났고 **결제 전 확인 하나가 남았다** — 메시·웨이트·IK는 상위 등급 전용으로 알려져 있는데, **v2 스킨 판매의 토대인 스킨 기능이 기본 등급에 포함되는지**를 공식 기능 비교표로 확인해야 한다(빠져 있으면 요금제 선택이 로드맵 v2와 충돌한다). **살 시점은 파츠 분리된 에셋이 한 벌 나왔을 때다** — 그 파일이 메시를 쓰는지 보고 등급(Essential $69 / Pro)을 정하며, 무료 트라이얼은 저장·내보내기가 막혀 Cocos까지 실제로 들어가는지를 확인할 수 없다([유료 전환 계획](sessions/2026-08-04-paid-art-pipeline-plan.md) §10). 그다음은 파츠 컷·인페인팅 → 리깅 → `sp.Skeleton` 배선. ② **자동화 + 크로스머신 분리** — **전제가 2026-08-06에 바뀌었다**: 생성이 유료 서비스(fal.ai)로 옮겨 가 로컬 GPU 도구(SAM·ControlNet·LayerDiffuse)와 ComfyUI HTTP API를 감싼 MCP 서버 안이 전부 무효가 됐고, "생성은 윈도우 / 마감은 맥" 구도도 GPU에 묶일 이유가 사라져 다시 봐야 한다. 자동화의 실체는 이제 **fal.ai API 호출**이다(환경에 `FAL_KEY`를 두면 생성부터 판정까지 한 번에 돈다 — [검토 문서](sessions/2026-08-07-art-cutout-pipeline-review.md) §5.3). 결정 3개(배경 제거 위치·핸드오프 방식·동기화 수단) 미확정. **「배경 제거 위치」는 검토와 실험 설계가 끝났다(2026-08-07)** — 로컬 색 키잉이 하루에 세 번 새면서 임계값이 시트마다 다시 재야 하는 값이 됐고, fal.ai에 매팅(`birefnet/v2`·`bria/background/remove`)과 투명 PNG 레이어 분해(`seedream/v5/pro/layerize`)가 $1 미만으로 있다. 실험 둘의 판정 항목과, layerize가 통과하면 ①의 파츠 컷과 **F67**까지 흡수되는 범위는 [검토 문서](sessions/2026-08-07-art-cutout-pipeline-review.md)에 있다. | `../design/art-direction.md` §3.2·§8-8, `sessions/2026-07-22-art-pipeline-cross-machine-split.md`, `sessions/2026-08-07-art-cutout-pipeline-review.md` |
| F68 | 열림 | 중(에셋이 불어나기 전) | 🔧🎨 채택 생성 서비스·모델의 **상업 이용 조건 확인** | 로드맵 v2가 스킨 판매(상업 배포)를 예고하는데 **채택 모델(`openai/gpt-image-2` via fal.ai)의 약관을 확인한 기록이 없다.** 유료 전환 계획 §4가 라이선스를 가리긴 했으나 거기 있는 것은 FLUX·Gemini·Midjourney이고 OpenAI는 표에 없다 — 그 문서를 쓸 당시 후보가 아니었고 채택은 이틀 뒤 Sandbox 비교로 정해졌다. 즉 **가려 놓은 것과 실제로 쓴 것이 어긋났다.** 확인할 것은 셋 — ① 출력물의 상업적 이용·재배포, ② 워터마크(가시·비가시) 유무, ③ 출력물을 다른 모델 학습에 쓰는 것에 대한 제한(FLUX가 걸었던 종류). **에셋이 불어나기 전에 닫는다** — 나중에 걸리면 이미 만든 것을 전부 다시 뽑아야 한다. | `../design/art-direction.md` 부록 C 머리말, `sessions/2026-08-04-paid-art-pipeline-plan.md` §4 |
| F69 | 열림 | 중(**F74 선행**) | 📐🔧 정본 문서에서 **결정 기록으로 가는 링크 걷어내기** | **판정 규칙은 착지점이 없어 F74가 먼저다** — ADR 006·007 링크는 대신 가리킬 정본이 없어서 지우면 정본에 구멍이 난다. 정본(`docs/design/`·`docs/planning/`)이 세션 문서·ADR을 링크하면 그 결정이 뒤집혔을 때 링크 대상이 낡은 채로 남는데, 독자는 정본을 거쳐 들어왔기 때문에 그것을 현재 명세로 읽는다(2026-08-08에 실제로 났다). 규칙은 `CLAUDE.md` 「문서 정리 규칙」에 들어가 신규 문서가 막혔고 사고가 난 머리말도 고쳤으므로, **남은 것은 기존 본문 링크 정리다.** 착수 전에 출처 §6을 본다 — 대상 목록과 처리 기준(근거 포인터는 날짜 표기로, 내용을 위임한 링크는 개별 판단), 그리고 이미 검토하고 접은 안(2단 참조 · 세션 폴더 README)이 거기 있다. | [`sessions/2026-08-08-canon-session-link-policy.md`](sessions/2026-08-08-canon-session-link-policy.md) §6 |
| F70 | 열림 | 중(F59 ② 뒤) | 🔧 로컬 생성 환경(`F:\ai` 약 21GB) 철거 | 유료 전환이 2026-08-06에 확정돼 철거 조건은 이미 충족됐는데, 계획이 "이 문서가 ADR로 승격될 때 함께 옮긴다"고 걸어 둔 승격이 일어나지 않아 **실행도 항목화도 안 된 채 남았다.** 그냥 지우면 안 되는 이유가 하나 있다 — `rembg`가 지울 대상인 ComfyUI venv 안에 살아서(출처 §12.4), 통째로 지우면 **후처리가 지금 쓰는 배경 제거 도구가 같이 사라진다.** 남길 약 0.3GB(문서가 근거로 인용하는 생성 PNG·LoRA 최종본·드라이버 스크립트)를 먼저 꺼낸 뒤 지운다는 순서도 출처가 든다. **F59 ②를 먼저 닫는다** — 배경 제거가 fal.ai 매팅으로 옮겨 가면 rembg를 별도 venv로 옮기는 일 자체가 없어진다. | [`sessions/2026-08-04-paid-art-pipeline-plan.md`](sessions/2026-08-04-paid-art-pipeline-plan.md) §12 |
| F71 | 열림 | 중(2~3 슬라이스 뒤) | 🔧 절차 배달 전환의 준수율 관찰 | 절차를 `CLAUDE.md` 상주에서 `pnpm wf` 배달로 옮긴 것이 준수율을 떨어뜨리지 않는지 확인한다. 배달은 게이트가 아니라 출력이라 무시해도 아무것도 막지 않고, 압축 저항성은 오히려 후퇴했다(루트 `CLAUDE.md`는 재주입되지만 도구 출력은 아니다). 신호는 절차 누락 — 게이트를 건너뛰거나 단계 순서가 어긋나는 일이 나는가. 나면 롤백 후보다. 근거와 대안(스킬 배달)은 출처 §1·§4. | [`sessions/2026-08-08-claude-md-split-plan.md`](sessions/2026-08-08-claude-md-split-plan.md) §1 |
| F72 | 열림 | 낮음 | 🔧 줄바꿈(EOL) 정책 — `.gitattributes` 도입 | 레포에 `.gitattributes`가 없어 커밋된 바이트가 그대로 남고 파일마다 LF·CRLF가 섞여 있다(`backlog.md`는 CRLF, `backlog-implement.md`는 LF). 편집 도구가 파일 전체를 반대 규약으로 다시 쓰면 **한 줄 변경에 수백 줄 유령 diff**가 붙어 리뷰어가 실제 변경을 못 찾고 `git blame`이 그 줄들에서 끊긴다. 실제로 이 파일에 122줄이 그렇게 붙었다가 되돌렸다. | [`../qa/claude-md-split-review-issues.md`](../qa/claude-md-split-review-issues.md) NEW-1 |
| F73 | 열림 | 중(F74와 한 슬라이스) | 📐 정본을 `spec/` 하위로 모으고 파일명에 분류를 넣는다 | `docs/development/`에 정본·셋업 가이드·백로그가, `docs/design/`에 정본과 초안이 섞여 있어 폴더를 훑어도 무엇이 정본인지 보이지 않는다. `docs/development/spec/`·`docs/design/spec/`을 만들고 `<분류>-<주제>.md`로 옮긴다(접두사는 닫힌 집합, 각 `spec/README.md`가 정의). 함께 `CLAUDE.md` 라우팅 표에 빠져 있는 `architecture.md`·`i18n-guide.md`를 등재한다 — 표에 없어서 ADR 002·005가 그 자리를 대신 채웠다. 옮길 때 절 번호는 건드리지 않고 `git mv` + 경로 일괄 치환만 한다. **깨진 내부 링크를 잡을 도구가 없으므로**(`check-docs`는 phase↔문서만 본다) 이 슬라이스에서 마크다운 링크 검사를 함께 만든다 — 열 개 남짓을 옮기는 변경이라 누락이 조용히 남는다. | [`sessions/2026-08-12-canon-layer-restructure.md`](sessions/2026-08-12-canon-layer-restructure.md) §4-1·§4-5 |
| F74 | 열림 | 중(**F69 선행**) | 📐 판정 규칙 정본 `game-combat.md` 신설 | ADR 006·007이 27회 참조로 떠받치는 자리에 정본이 없다. 그래서 F69가 정본→ADR 링크를 끊으려 해도 대신 가리킬 문서가 없어 지우면 정본에 구멍이 난다. 플레이어 AABB 피해 히트박스·적 원·이동 충돌 원 유지·`player.json` 고정값(스킨 무관)의 **현재 결론만** 옮기고 반전 경위는 ADR 006에 남긴다. | [`sessions/2026-08-12-canon-layer-restructure.md`](sessions/2026-08-12-canon-layer-restructure.md) §4-2 |
| F75 | 열림 | 중(F73·F74 뒤) | 📐 ADR 정의 축소 + A·B군 정본 흡수 | ADR 여덟 중 둘(001·008)만 ADR로서 맞다. 피참조 상위 셋(002=19, 006=15, 007=12)이 전부 지금도 강제되는 규칙이라 결정 기록이 아니라 명세로 쓰이고 있다. ADR을 "정본에 쓸 자리가 없는 일회성 선택"으로 좁히고 002→`architecture.md`, 005→`i18n-guide.md`, 003→`conventions.md`로 흡수한다. **ADR 파일은 지우지 않는다** — 끊는 것은 정본→ADR 링크 37곳(문서 28 + 코드 9)이고 F69와 합류한다. | [`sessions/2026-08-12-canon-layer-restructure.md`](sessions/2026-08-12-canon-layer-restructure.md) §3·§4-3 |
| F76 | 열림 | 중 | 📐 QA 문서의 「이전 문서 링크」 규칙이 실행 불가능 | `qa-setup.md`가 "새 문서에 이번에 무엇이 바뀌었나를 적고 이전 문서를 링크한다"고 하는데 그 이전 문서를 찾을 방법이 없다. 파일명이 슬라이스 슬러그라 계열 판정이 안 되고, 순서를 담은 문서는 49개 중 4개뿐이며, squash merge라 `git log`도 순서를 못 낸다. 역링크가 없어 체인 역주행도 안 되고 `check-qa`는 잠정 태그만 보므로 빠뜨려도 안 걸린다. 처방은 머리말 `이전 문서:` 필수 필드(링크 또는 `없음`)와 찾는 절차 명문화. | [`sessions/2026-08-12-canon-layer-restructure.md`](sessions/2026-08-12-canon-layer-restructure.md) §7 |

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

