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
| F59 | 열림 | 낮음(리깅 슬라이스 착수 전) | 🔧🎨 아트 생성·리깅 툴체인 리스크·자동화 | 아트 실행 자체는 [`backlog.md`](backlog.md) **F60**, 방향은 [`../design/spec/art-direction.md`](../design/spec/art-direction.md)에 있다. 여기 남는 건 툴체인 둘이다. ① **리깅 도구 = Spine 확정**(2026-07-24 — DragonBones는 공식 사이트가 SaaS로 전환돼 폐기, Cocos 내장 컷아웃으로 먼저 실습하는 안도 배우는 것의 절반이 Cocos 전용이라 폐기. 근거는 art-direction §3.2). 도구 판단은 끝났고 **결제 전 확인 하나가 남았다** — 메시·웨이트·IK는 상위 등급 전용으로 알려져 있는데, **v2 스킨 판매의 토대인 스킨 기능이 기본 등급에 포함되는지**를 공식 기능 비교표로 확인해야 한다(빠져 있으면 요금제 선택이 로드맵 v2와 충돌한다). **살 시점은 파츠 분리된 에셋이 한 벌 나왔을 때다** — 그 파일이 메시를 쓰는지 보고 등급(Essential $69 / Pro)을 정하며, 무료 트라이얼은 저장·내보내기가 막혀 Cocos까지 실제로 들어가는지를 확인할 수 없다([유료 전환 계획](sessions/2026-08-04-paid-art-pipeline-plan.md) §10). 그다음은 파츠 컷·인페인팅 → 리깅 → `sp.Skeleton` 배선. ② **자동화 + 크로스머신 분리** — **전제가 2026-08-06에 바뀌었다**: 생성이 유료 서비스(fal.ai)로 옮겨 가 로컬 GPU 도구(SAM·ControlNet·LayerDiffuse)와 ComfyUI HTTP API를 감싼 MCP 서버 안이 전부 무효가 됐고, "생성은 윈도우 / 마감은 맥" 구도도 GPU에 묶일 이유가 사라져 다시 봐야 한다. 자동화의 실체는 이제 **fal.ai API 호출**이다(환경에 `FAL_KEY`를 두면 생성부터 판정까지 한 번에 돈다 — [검토 문서](sessions/2026-08-07-art-cutout-pipeline-review.md) §5.3). 결정 3개(배경 제거 위치·핸드오프 방식·동기화 수단) 미확정. **「배경 제거 위치」는 검토와 실험 설계가 끝났다(2026-08-07)** — 로컬 색 키잉이 하루에 세 번 새면서 임계값이 시트마다 다시 재야 하는 값이 됐고, fal.ai에 매팅(`birefnet/v2`·`bria/background/remove`)과 투명 PNG 레이어 분해(`seedream/v5/pro/layerize`)가 $1 미만으로 있다. 실험 둘의 판정 항목과, layerize가 통과하면 ①의 파츠 컷과 **F67**까지 흡수되는 범위는 [검토 문서](sessions/2026-08-07-art-cutout-pipeline-review.md)에 있다. | `../design/spec/art-direction.md` §3.2·§8-8, `sessions/2026-07-22-art-pipeline-cross-machine-split.md`, `sessions/2026-08-07-art-cutout-pipeline-review.md` |
| F68 | 열림 | **높음**(F60 선행 게이트 — 다음 슬라이스) | 🔧🎨 채택 생성 서비스·모델의 **상업 이용 조건 확인** | 로드맵 v2가 스킨 판매(상업 배포)를 예고하는데 **채택 모델(`openai/gpt-image-2` via fal.ai)의 약관을 확인한 기록이 없다.** 유료 전환 계획 §4가 라이선스를 가리긴 했으나 거기 있는 것은 FLUX·Gemini·Midjourney이고 OpenAI는 표에 없다 — 그 문서를 쓸 당시 후보가 아니었고 채택은 이틀 뒤 Sandbox 비교로 정해졌다. 즉 **가려 놓은 것과 실제로 쓴 것이 어긋났다.** 확인할 것은 셋 — ① 출력물의 상업적 이용·재배포, ② 워터마크(가시·비가시) 유무, ③ 출력물을 다른 모델 학습에 쓰는 것에 대한 제한(FLUX가 걸었던 종류). **에셋이 불어나기 전에 닫는다** — 나중에 걸리면 이미 만든 것을 전부 다시 뽑아야 한다. | `../design/spec/art-direction.md` 부록 C 머리말, `sessions/2026-08-04-paid-art-pipeline-plan.md` §4 |
| F70 | 열림 | 중(F59 ② 뒤) | 🔧 로컬 생성 환경(`F:\ai` 약 21GB) 철거 | 유료 전환이 2026-08-06에 확정돼 철거 조건은 이미 충족됐는데, 계획이 "이 문서가 ADR로 승격될 때 함께 옮긴다"고 걸어 둔 승격이 일어나지 않아 **실행도 항목화도 안 된 채 남았다.** 그냥 지우면 안 되는 이유가 하나 있다 — `rembg`가 지울 대상인 ComfyUI venv 안에 살아서(출처 §12.4), 통째로 지우면 **후처리가 지금 쓰는 배경 제거 도구가 같이 사라진다.** 남길 약 0.3GB(문서가 근거로 인용하는 생성 PNG·LoRA 최종본·드라이버 스크립트)를 먼저 꺼낸 뒤 지운다는 순서도 출처가 든다. **F59 ②를 먼저 닫는다** — 배경 제거가 fal.ai 매팅으로 옮겨 가면 rembg를 별도 venv로 옮기는 일 자체가 없어진다. | [`sessions/2026-08-04-paid-art-pipeline-plan.md`](sessions/2026-08-04-paid-art-pipeline-plan.md) §12 |
| F71 | 열림 | 중(2~3 슬라이스 뒤) | 🔧 절차 배달 전환의 준수율 관찰 | 절차를 `CLAUDE.md` 상주에서 `pnpm wf` 배달로 옮긴 것이 준수율을 떨어뜨리지 않는지 확인한다. 배달은 게이트가 아니라 출력이라 무시해도 아무것도 막지 않고, 압축 저항성은 오히려 후퇴했다(루트 `CLAUDE.md`는 재주입되지만 도구 출력은 아니다). 신호는 절차 누락 — 게이트를 건너뛰거나 단계 순서가 어긋나는 일이 나는가. 나면 롤백 후보다. 근거와 대안(스킬 배달)은 출처 §1·§4. | [`sessions/2026-08-08-claude-md-split-plan.md`](sessions/2026-08-08-claude-md-split-plan.md) §1 |
| F75 | 열림 | 중(F69 뒤) | 📐 ADR 정의 축소 + A·B군 정본 흡수 | ADR 여덟 중 둘(001·008)만 ADR로서 맞다. 피참조 상위 셋(002=19, 006=15, 007=12)이 전부 지금도 강제되는 규칙이라 결정 기록이 아니라 명세로 쓰이고 있다. ADR을 "정본에 쓸 자리가 없는 일회성 선택"으로 좁히고 002→`spec/code-conventions.md`, 005→`spec/code-i18n.md`, 003→`spec/code-conventions.md`로 흡수한다(**착지점이 2026-08-13 이전으로 바뀌었다** — 원래 적혀 있던 `architecture.md`는 그때 레포에서 나갔다). 코드 배치를 한 장으로 보는 조감도가 그 제거로 사라졌으므로, 필요해지면 `spec/code-architecture.md`를 **파일 인벤토리 없이** 새로 쓰는 선택지가 여기 붙는다. **ADR 파일은 지우지 않는다** — 끊는 것은 정본→ADR 링크였고, **F69가 문서 24곳을 이미 끊어** 남은 것은 문서 4곳 + 코드 9곳이다. 그 아홉의 착지점도 이제 있다 — ADR 006·007은 `spec/game-combat.md`, ADR 002는 `spec/code-conventions.md`다. | [`sessions/2026-08-12-canon-layer-restructure.md`](sessions/2026-08-12-canon-layer-restructure.md) §3·§4-3 |
| F76 | 열림 | 중 | 📐 QA 문서의 「이전 문서 링크」 규칙이 실행 불가능 | `qa-setup.md`가 "새 문서에 이번에 무엇이 바뀌었나를 적고 이전 문서를 링크한다"고 하는데 그 이전 문서를 찾을 방법이 없다. 파일명이 슬라이스 슬러그라 계열 판정이 안 되고, 순서를 담은 문서는 49개 중 4개뿐이며, squash merge라 `git log`도 순서를 못 낸다. 역링크가 없어 체인 역주행도 안 되고 `check-qa`는 잠정 태그만 보므로 빠뜨려도 안 걸린다. 처방은 머리말 `이전 문서:` 필수 필드(링크 또는 `없음`)와 찾는 절차 명문화. | [`sessions/2026-08-12-canon-layer-restructure.md`](sessions/2026-08-12-canon-layer-restructure.md) §7 |
| F78 | 열림 | 낮음 | ♻️🔧 `insertCanonRow`가 두 벌이다 — 각자 자기 사본을 테스트한다 | 같은 로직이 `.claude/workflow.mjs:181`(실제로 도는 것)과 `tests/helpers/CanonDoc.ts:153`(테스트가 부르는 것)에 각각 있다. 양쪽 다 테스트가 붙어 있지만 **단위 테스트는 사본을, E2E는 실물을 본다.** 그래서 한쪽만 고치면 다른 쪽이 낡은 채로 초록불을 유지하고, 어긋난 것을 알려 주는 장치가 없다. **기다리던 배관은 오지 않는다** — `feat/canon-spec-move`가 공유 `.mjs` 모듈 안을 실측으로 접었다(`tsconfig.tests.json`에 `allowJs`가 없어 `.ts`가 `.mjs`를 import하면 TS7016으로 `pass ts`가 막힌다). 대신 그 슬라이스가 **로직을 `tests/helpers/`에 한 벌 두고 CLI가 vitest를 띄우는** 형태를 세웠으니(`wf check-links`), 이 항목도 같은 모양으로 닫으면 된다. | [`sessions/2026-08-13-canon-spec-move-plan.md`](sessions/2026-08-13-canon-spec-move-plan.md) E4 |
| F79 | 열림 | 낮음 | ♻️ `main.scene` 일시정지 패널의 `LocalizedLabel` 넷이 잔재다 | 같은 네 노드의 같은 네 키(`pause.title`·`resume`·`restart`·`menu`)를 씬의 `LocalizedLabel`과 `PauseController._t()`가 **각각** 쓰고 있다. 겹치면 화면에 무엇이 뜨는지가 어느 쪽이 나중에 도느냐에 달리는데 그 순서는 코드만 봐서 알 수 없고, 키를 고칠 때 한쪽만 고쳐도 나머지가 화면을 맞게 채워 **틀린 것을 알아채지 못한다.** 일시정지 메뉴 슬라이스에서 코드 구동으로 되돌리는 리워크가 났을 때 컴포넌트만 씬에 남아 생겼다. 처방은 씬에서 그 넷을 떼는 것이고, 선택 규칙의 정본은 [`spec/code-i18n.md`](spec/code-i18n.md) §8이다. **씬 편집이라 사용자가 에디터로 해야 한다.** | [`spec/code-i18n.md`](spec/code-i18n.md) §8.2 |
| F80 | 열림 | 낮음 | 📐 옮긴 정본 여섯을 **맨 파일명**으로 부르는 평문 약 123곳 | `feat/canon-spec-move`가 경로가 붙은 참조는 전부 고쳤지만(D5), `conventions.md`처럼 경로 없이 이름만 적힌 언급은 그대로 뒀다. 대부분 세션·QA 문서라 그 시점의 문장으로 보존하는 것이 맞지만, 문제는 **`git grep conventions.md`가 여전히 옛 이름으로 걸린다**는 것이다. 다음 사람이 그 결과를 보고 없는 파일을 찾게 된다. 링크가 아니라서 `wf check-links`가 한 건도 못 잡는다. 고칠지 그대로 둘지를 정하는 것이 이 항목이고, 고치기로 하면 층별로 규칙을 나눠야 한다(현재 명세 층은 고치고 시점 기록은 두는 식). **F69의 개명(`asset-production-spec.md` → `art-asset-spec.md`)이 남긴 맨 이름 여섯 곳은 여기 더하지 않는다** — 전부 세션·QA 시점 기록이라 「다른 슬라이스의 결정 기록은 찾아가 고치지 않는다」에 걸리는 자리이고, **안 고치는 것이 규칙에 맞다.** | [`sessions/2026-08-13-canon-spec-move-plan.md`](sessions/2026-08-13-canon-spec-move-plan.md) D5 |
| F82 | 열림(⑤ 완료) | 낮음 | ♻️🔧 링크 검사 도구의 남은 구멍·중복 다섯 | 2차 코드 리뷰가 낸 저순위 발견이다. ① 「표시 텍스트 = 파일명」 단언만 `blankFences`·`EXTERNAL`을 안 거쳐 코드 펜스 속 예시와 외부 URL을 오탐할 표면이 있다. **더는 이론이 아니다** — 2026-08-15에 QA 문서가 위반 형태를 설명하려고 코드 스팬 안에 링크 모양을 적자 그 단언이 물었고, 검사기에 맞춰 문장을 바꿔야 했다(`canon-quote-guard-review-issues.md`). ② `wf check-links` 가드가 대상 파일에 `findBrokenLinks` **문자열**이 있는지만 봐서, 레포 전체 회귀망 `it`만 지워도 초록을 유지한다. 인용 형태 회귀망이 한때 같은 파일에 세입자로 들어와 이 구멍을 넓혔으나 2026-08-19에 함께 걷혔고, 가드가 `findBrokenLinks` 문자열만 찾는다는 구멍 자체는 그대로다. ③ `EMPHASIS`가 `_`를 뺀 뒤 완전 무동작인데(제목 2,747개 전수로 결과 차이 0건) 상수와 JSDoc 여섯 줄이 남아 "여기서 표기를 벗긴다"고 주장한다 — 지우고 설명을 `SLUG_KEEP`으로 옮긴다. **인용 검사기는 `EMPHASIS`를 쓰지 않으므로 이 제거를 막지 않는다**(2026-08-15 확인). ④ `code-conventions.md`의 표를 포인터로 줄이며 `I18n.instance.t(key, params)`라는 구체 호출 형태가 어느 정본에도 안 남았다 — `code-i18n.md` §8.1에 되살린다. ⑤ ~~검사 도구 쪽 중복 둘~~ → **완료**(`feat/canon-quote-guard`, 2026-08-15). `tests/helpers/DocFs.ts`에 한 벌로 접었다 — **`LinkCheck.ts`가 아니다.** 그 파일은 머리말에서 「디스크를 읽지 않는다」를 스스로 규약으로 걸고 있어 파일 읽기를 넣으면 그 규약이 깨진다. | [`../qa/canon-spec-move-review-issues.md`](../qa/canon-spec-move-review-issues.md) N2~N5 · [`../qa/art-canon-move-review-issues.md`](../qa/art-canon-move-review-issues.md) M5·「넘긴 것」 |
| F83 | 열림 | 중(J4 착수 때) | 📐 `ui-completeness-plan.md`를 정본으로 승격 | 스스로 DRAFT라고 적으면서도 세션 넷과 QA 하나가 머리말에서 `§4 P0-N`으로 부르는 **J4의 실질 인덱스**다. 그런데 §2 감사가 낡았고(닫힌 P0-3·P0-4가 아직 ❌다) 백로그 J4와 서로를 "상세는 저쪽"으로 가리켜 순환 참조다. 처방은 §2·§3 현황 감사를 덜어내고(진행 상태는 J4가 든다) 남는 요소 목록·우선순위·갈림길만 `docs/design/spec/ui-completeness.md`로 올리는 것이다. **절 번호는 그대로 둬야** 세션 여섯의 `P0-N` 참조가 산다. 기각: 세션 폴더로 강등(슬라이스 여섯이 쓰는 P0 인덱스가 시점 기록층으로 사라진다). **J4 착수 때 한다** — 승격에 미확정 스코프(메타 진행 모델·아이콘 아트 의존 시점) 확정이 선행하고 그건 UI 기획 판단이다. | [`sessions/2026-08-13-art-canon-move-plan.md`](sessions/2026-08-13-art-canon-move-plan.md) §8 |
| F85 | 열림 | 낮음 | 🔧📐 README 세 개가 gbrain 색인에서 통째로 빠진다 | gbrain이 `README.md`·`index.md`·`log.md`·`schema.md`·`RESOLVER.md`를 디렉터리 스캐폴딩으로 보고 배제한다(`~/gbrain/src/core/sync.ts:343`). 증분과 전체 동기화가 **같은 상수**를 타므로 `--full`로도 안 들어오고 설정으로 끌 수도 없다. 우리 레포에서 걸리는 셋은 전부 인덱스다 — 두 `spec/README.md`와 `workflow/README.md`. `CLAUDE.md`가 "목록은 저기"로 보내는데 의미 검색으로는 닿지 못한다. 개별 정본은 색인돼 있어 실해는 작다. 고친다면 목록 본문을 색인되는 이름으로 빼고 README는 포인터만 두는 것인데, `index.md`도 같은 배제 목록이라 쓸 이름이 좁고 `wf canon` 등재 대상·`DocLinks` 테스트·문서 참조가 함께 움직인다. | [`sessions/2026-08-14-gbrain-canon-plan.md`](sessions/2026-08-14-gbrain-canon-plan.md) §2-4 |
| F86 | 열림 | 낮음(다음 도구 슬라이스) | 🔧 색인 지연을 묻지 않아도 뜨게 만든다 | F77이 절차를 실행 가능하게 고쳤지만 확인은 여전히 **사람이 물어야** 뜬다. `wf`는 gbrain에 직접 못 묻는다 — 잠금 때문에 읽기 전용 명령도 막히고 체크포인트가 DB 안에 있다. 설계는 브레인이 보고한 `last_commit`을 `pnpm wf gbrain-synced <sha>`로 로컬 파일(gitignore 대상)에 적고 `wf status`가 `origin/main`과 비교해 경고하는 것이며, **판정 여덟 갈래와 함정 둘(squash merge 뒤 `HEAD`는 main 조상이 아니라 영구 오보가 난다 · 기존 테스트 샌드박스에 `git init`이 없어 갈래 넷이 거짓 초록이 된다)까지 출처가 들고 있어 다시 설계할 필요가 없다.** F78·F82와 같은 자리라 함께 집는다. | [`sessions/2026-08-14-gbrain-canon-plan.md`](sessions/2026-08-14-gbrain-canon-plan.md) §2-2 |
| F94 | 열림 | 낮음 | 📐 `DocsReferences.test.ts`의 「「문서 정리 규칙」 이전 결과」 여섯 단언 선별 | `CLAUDE.md` 분할이 일어났고 유지되는지를 재는 블록이라 성격이 `CanonSpecMove`·`ArtCanonMove`(2026-08-19 폐기)와 같다. 다만 여섯이 섞여 있어 일괄 삭제가 안 된다 — 「참조 조항 다섯이 새 정본에 도착했다」와 「`planning.md`가 `정본:` 줄·탈출구·검사기를 다 든다」는 누가 지우면 빨개져야 하는 살아 있는 불변식이고, 나머지 넷이 과거-사건 단언이다. 남길 둘을 성격에 맞는 자리로 옮기고 넷을 걷는다. | [`sessions/2026-08-19-docs-guard-cut-plan.md`](sessions/2026-08-19-docs-guard-cut-plan.md) §3 |
| F95 | 열림 | 중(다음 도구 슬라이스) | 📐 의무 독서 예산이 배달되는 절차 문서를 안 잰다 | 새 예산은 `CLAUDE.md`와 「항상 읽는다」 정본 셋만 재는데, `pnpm wf` 전이가 배달하는 `workflow/*.md` 합계 14,907자도 매 슬라이스 실제로 읽힌다. 종전 예산은 그 부피를 쟀고 이번에 함께 걷혔으므로 **지금은 어떤 기계도 안 본다** — 계획이 "비용이 사는 곳은 읽어야 하는 문서다"라고 한 그 비용의 상당 부분이 감시 밖이다. 대상 집합에 넣으려면 상한을 새 근거로 다시 세워야 해서(37,725 + 14,907) 삭제 슬라이스 밖으로 뺐다. F96과 함께 집는다. | [`../qa/docs-guard-cut-review-issues.md`](../qa/docs-guard-cut-review-issues.md) I1 |
| F96 | 열림 | 중(F95와 함께) | 📐 의무 독서 예산이 여유 0.9%로 출발했다 | 상한 38,000자에 현재 37,725자라 여유가 275자다(0.7%). F91을 폐기한 근거가 "16,000자에 여유 1,216자(7.6%)는 얇다"였는데 대체 예산은 그보다 얇게 시작한다. 게다가 정본을 고칠 때마다 이력 줄이 붙어(이번 슬라이스가 두 정본에 붙인 것이 합쳐 약 120자) 평범한 유지보수 서너 번이면 닿는다. **걸렸을 때 상한을 올리면 이 단언이 태어난 이유가 사라지므로**, 덜어낼 후보 절을 미리 지목해 둔다. | [`../qa/docs-guard-cut-review-issues.md`](../qa/docs-guard-cut-review-issues.md) 백로그 절 |
| F97 | 열림 | 낮음 | ✨ `정본:` 줄 검사 실패 메시지 둘 — F90에서 고아가 됐다 | `DocsReferences.test.ts`의 메시지가 (a) 검사 대상이 머리말 **첫 줄**임을 안 밝히고 (b) 줄이 있는데 형태가 어긋난 경우도 「없음」으로 뭉뚱그린다. 둘 다 `F90`에 얹혀 있었는데 F90이 주석 지칭 수정만 하고 완료로 닫혀 주인이 사라졌다. 검사기 자체는 남았으므로 후속은 살아 있다. | [`../qa/docs-references-review-issues.md`](../qa/docs-references-review-issues.md) |

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

