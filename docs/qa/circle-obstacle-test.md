# QA 체크리스트 — 원 장애물 (feat/circle-obstacle)

- **브랜치:** feat/circle-obstacle
- **계획 문서:** [`../development/sessions/2026-07-20-circle-obstacle-plan.md`](../development/sessions/2026-07-20-circle-obstacle-plan.md)
- **선행:** [`building-collision-test.md`](building-collision-test.md) (사각형 장애물·`Obstacles` 루트·`@property` 배선 — 이미 씬에 존재, 이 문서는 그 위에 원을 얹는다)
- **대상:** 에디터에 배치한 원형 장애물이 플레이어·적의 **이동만** 막는다(사각형과 같은 D2 규칙). 이동 주체가 이미 원이라 원 대 원 판정은 두 중심 거리가 두 반지름 합보다 작으면 중심선을 따라 밀어내는 한 줄이다 — 대각선 코너에 `0.41R` 투명벽을 만들던 AABB 감싸기가 사라진다. 원 반지름은 손으로 적지 않고 씬 노드의 `UITransform.width / 2`에서 로드 시 1회 유도한다(시각=충돌 일치). 형태 판별은 원 노드에만 붙이는 **`CircleObstacle` 마커 컴포넌트**로 하고, 마커가 없으면 사각형이다(기본값).

---

## 1. Impact Map (변경 파일별 확인 범위)

| 파일 | 변경 | 회귀 확인 범위 |
|------|------|----------------|
| `logic/ObstacleLogic.ts` (수정·순수) | `ObstacleRect`에 `kind:'rect'` + 신규 `ObstacleCircle`(`kind:'circle'`, `r`) + `Obstacle` 판별 유니온. `resolveCircleMove`·`steerAroundObstacles`에 원 분기(중심선 방사 밀어내기 + 접선 우회) | 자동 테스트로 전량 검증. **사각형 경로 회귀 없음**(`BuildingCollision.test.ts` GREEN 유지) |
| `components/CircleObstacle.ts` (신규·Cocos) | 원 노드에 붙이는 빈 마커 컴포넌트(`@ccclass`) — 데이터·로직 없음, 색인이 `getComponent`로 유무만 본다 | 마커 의미 자명(순수 테스트 없음), 7단계 수동 |
| `systems/MapManager.ts` (수정·Cocos) | `_indexObstacles`가 `getComponent(CircleObstacle)` 유무로 원/사각 판별(원 `r=width/2`, `width≠height` 경고) + **F50** 비유한 유도값 스킵 + **F55** 최소 변/지름 하한(120px) 경고 | 기존 사각형 색인·경고 배터리(300px 초과·경계 밖·간격)·`arena`·`regions` 회귀 없음 |
| `components/PlayerController.ts` · `EnemyController.ts` | **변경 없음** — `MapManager.instance.obstacles`(rect·circle 혼합)를 그대로 받는다. 형태 분기는 순수 로직 안에서 끝난다 | 이동·물 감속·아레나 클램프·우회 회귀 없음(배선 무변경) |
| `tests/logic/MapArena.test.ts` · `SpawnGeometry.test.ts` (수정) | **F54** — `ARENA={2400,2400}` "표준 서울 아레나" 라벨을 실제 맵(4800)과 안 어긋나게 중립화(값 2400 불변, 순수 가독성) | 로직 무영향(값 불변) |
| `scenes/main.scene` (수정·사용자 배치) | `Obstacles` 루트에 원 노드 + `CircleObstacle` 마커 추가 | 렌더 순서·레이어 누수(F47) 없음 |

> **OBB(회전 사각형)·캡슐은 이번 스코프 아님**(계획 §5) — 같은 seam 위 후속 슬라이스. 대각선 버스·경기장은 계속 축정렬 사각형으로 둔다.

---

## 2. 자동 테스트로 검증 (`tests/logic/CircleObstacle.test.ts`)

> **통과 근거:** 피처 테스트 **37/37** + 전체 스위트 **587/587** (37 파일) GREEN. 통과 커밋은 코드리뷰 수정 커밋에서 갱신(초판 `5589c64`, 리뷰 수정 +2 테스트).

**원 밀어내기 (`resolveCircleMove`)**

- [x] 원 정면 진입 → 표면에서 (r + radius)만큼 떨어져 멈춤.
- [x] 원 비스듬 진입 → 중심선 방사로 확장원 표면까지 밀림(축 스냅 아님, hypot=r+radius).
- [x] from이 원 내부(스폰 겹침) → 방사 방향으로 표면 밖 탈출.
- [x] 이동 주체 중심 == 원 중심(d²=0) → 임의 축(+x)으로 탈출(NaN 없음).
- [x] 작은 원 고속 이동 관통 방지(터널링) — 스텝 분할로 표면에서 막힘.
- [x] 재해소 무변화(원 표면에 붙은 위치가 안 튐).
- [x] rect·circle 혼합 배열에서 각자 올바른 형태로 해소.
- [x] to NaN → 원위치, 입력 무변형(F36 계약).

**원 접선 우회 (`steerAroundObstacles`)**

- [x] 직선이 원을 안 막으면 원래 방향 그대로(같은 참조 — 무할당).
- [x] 정면 일직선(적-원-플레이어) → 접선 쪽으로 방향 틈(변위 0 정지 회귀 방지).
- [x] 좌우 동률 → 진행 방향 90° CCW(+y) 고정(떨림 방지).
- [x] 동률 아니면 가까운 쪽 접선(위/아래 대칭).
- [x] 플레이어가 확장원 안(엄폐 대치, 적 반지름 40) → 방사 클램프 후 우회.
- [x] 목표에서 멀어지는 이동(유격 후퇴) → 우회 없음.
- [x] 적이 원 내부(스폰 겹침) → 우회 없음(탈출은 밀어내기).
- [x] 좌표 NaN·radius 0 이하 → 원래 방향 그대로, 입력 무변형(F36).
- [x] 정면 대칭선 0.01px 통과 시 방향 비반전(접선 선택 극한 순환 — C-1 원 판 국소 테스트, 코드리뷰 I-2).
- [x] 목표가 확장원 안이어도 같은 편 바로 뒤 적은 우회 안 함(재판정 조기 반환 — 코드리뷰 I-2).

**도달 스윕 (C-1 원 판 회귀)**

- [x] 실 반지름 8종(18·25·26·27·28·32·38·40) × 접근각 72방위 전수 → 전부 도달. 벽에 붙은 플레이어(목표 방사 클램프 분기)·원 반대편 플레이어 두 배치 모두 갇힌 각도 0.

**사각형 회귀**

- [x] `BuildingCollision.test.ts`(사각형)가 `kind:'rect'` 추가 후 그대로 GREEN.
- [x] `MapArena`·`SpawnGeometry`(F54 라벨) 및 전체 스위트 GREEN.

> `CircleObstacle` 마커·`MapManager` 색인(원 판별·`r=width/2`·`width≠height` 경고·F50 스킵·F55 하한 경고)은 cc 의존이라 아래 수동 항목으로 검증한다.

---

## 3. 씬 변경 사항 (`main.scene`) — (확정)

`Obstacles` 루트(building-collision에서 생성·머지됨)에 원형 장애물 노드를 자식으로 추가한다. 사각형 박스와 같은 형제/레이어 규칙(RegionOverlay 다음·Player 앞, Layer DEFAULT)을 따른다 — 원도 물 위·플레이어 아래에 깔린다.

| 노드 | 변경 | 값 |
|------|------|-----|
| `Dome_*` (신규 원 노드) | `Obstacles`의 자식 Sprite + `CircleObstacle` 마커. Content Size 정사각(width=height)이라야 `r=width/2`가 명확 | 아래 §4 배치표(시작값) |

---

## 4. 에디터 조립 레시피 — (확정)

> 사각형 박스 만드는 법은 [`building-collision-test.md` §4](building-collision-test.md)에 있다. 여기서는 **원 노드 + 마커**만 다룬다. 하드 제약(지름 ≤ 300px·≥ 120px, 통행 간격 ≥ 200px, 물·벽에서 떨어뜨림)은 사각형과 같고, 어기면 콘솔 경고가 뜬다.

**목표 계층 (Obstacles 아래):**

```
Canvas
 ↳ Obstacles                 (기존 루트, 원점, DEFAULT)
    ↳ Box_N1 … Box_S4         (기존 사각형 — building-collision)
    ↳ Dome_1 (Sprite)         (신규 원)
        + CircleObstacle 컴포넌트   ← 이 마커가 "원"임을 색인에 알린다
    ↳ Dome_2 (Sprite) + CircleObstacle
```

**만드는 순서:**

1. **원 노드 생성** — `Obstacles` 우클릭 → `Create → 2D Object → Sprite`, 이름 `Dome_1`. **⚠ F47: 생성 직후 Layer를 `UI_2D` → `DEFAULT`로 교정**(안 하면 고정 UICamera가 다른 배율로 그려 그림과 충돌이 어긋난다).
2. **원형 시각 세팅** — 둥근 placeholder가 보이도록 Sprite `Color`를 사각형과 구분되는 무채색(예: **(90, 90, 90, 255)**, 시작값)으로. 최종 원형 픽셀 아트는 F41(아트 단계) — 지금은 색으로만 구분한다. (Content Size가 정사각이면 충돌은 그 내접원이므로, placeholder가 사각이어도 "원 표면에서 막힘"을 체감으로 확인할 수 있다.)
3. **크기·위치** — `UITransform` Content Size를 **정사각(width = height)**, Anchor **(0.5, 0.5)**, Position 표대로. **Scale (1, 1) 고정** — 크기는 Content Size로만(색인은 contentSize만 읽는다). 반지름은 `width/2`로 유도되므로 `width ≠ height`면 콘솔 경고가 뜬다(타원 그림 ↔ 원 충돌 어긋남).
4. **`CircleObstacle` 마커 부착** — `Dome_1` 선택 → Inspector `Add Component → Custom Script → CircleObstacle`(또는 Assets에서 `CircleObstacle` 스크립트를 Inspector로 드래그). 이 컴포넌트에 세팅할 값은 없다(빈 마커).
5. **복제** — `Dome_1`을 Ctrl+D로 복제해 이름·Position·Content Size 조정(마커·Layer·Anchor 그대로 물려받음).

**원 배치표 (시작값 — 물 밴드·아레나 벽·기존 박스와 간격 ≥ 200px, 7단계 체감으로 조정):**

| 노드 | Position | Content Size (지름) | 유도 r | 비고 |
|------|----------|---------------------|--------|------|
| `Dome_1` | (500, -300) | 240 × 240 | 120 | 강남 동측 — 원형 건물(돔) 대표 |
| `Dome_2` | (-600, 300) | 200 × 200 | 100 | 강북 서측 — 작은 원 |

> 지름 하한 120px은 얇은 장애물이 고속 dt에서 관통하는 것을 막는 안전 하한(F55)이다 — 240·200 둘 다 안전. 300px 상한(D4)도 지킨다.

---

## 5. 에디터 연결 체크리스트 (`@property`) — (확정)

원 추가로 **새 `@property` 연결은 없다.** 기존 `MapManager.obstaclesRoot → Obstacles` 연결 하나가 원·사각을 다 커버한다(색인이 자식을 훑어 마커 유무로 형태를 가른다). `CircleObstacle`는 `@property`가 아니라 원 노드에 붙이는 컴포넌트다(위 §4 4번).

---

## 6. 수동 테스트 체크리스트 (인게임)

**원 충돌 핵심**

- [x] **원 표면에서 막힘** — 돔으로 걸어가면 눈에 보이는 원 표면(내접원)에서 멈춘다. 파고들기·튕김·떨림 없음.
- [x] **⭐ 대각선 투명벽 소멸 (이 슬라이스의 목적)** — 돔의 대각선 방향(45°)에서 다가가도 원 표면에 **실제로 닿을 때만** 막힌다. AABB 감싸기 시절의 "닿지도 않았는데 코너에서 막힘"(약 0.41×반지름 앞)이 사라졌다.
- [x] **원 미끄러짐** — 원 표면에 비스듬히 밀면 표면을 따라 부드럽게 돌아 미끄러진다(정지 없음). 사각형과 달리 축 스냅 느낌이 없다.
- [x] **적이 원을 돌아 추격** — 추격·지그재그·유격·돌진 4종이 돔을 통과하지 않고 접선으로 돌아 플레이어에게 온다.
- [x] **⭐ 정면 일직선 우회 (C-1 원 판 — 최우선)** — 돔을 사이에 두고 적과 정확히 일직선으로 선 뒤 가만히 있는다. 적이 원 앞에서 굳지 않고 접선 쪽으로 틀어 돌아 나온다. 벽에 붙어 멎으면 회귀.
- [x] **⭐ 엄폐 대치 (C-1 원 판)** — 돔 표면에 바짝 붙어 반대편 적을 기다린다. 큰 적(반지름 40 두억시니 등, 12종 중 9종이 플레이어 25 초과)도 반대편에서 굳지 않고 돌아 나온다. 여러 각도 반복.
- [x] **⭐ 접선 진동 없음 (C-1 원 판)** — 적이 원을 돌 때 접선점 부근에서 좌우로 떨지 않고 한 번에 돌아 나간다(특히 엄폐 대치 상태에서).
- [x] **rect·circle 혼재** — 박스와 돔이 같이 있어도 각자 제 형태로 막힌다(원은 둥글게, 사각은 각지게).

**데이터 방어 (임시 조작 후 원복)**

- [x] **F55 — 지름 하한 위반** — 돔 하나의 Content Size를 100×100(<120)으로 줄이면 최소 지름 경고가 뜨되 충돌은 유지된다.
- [x] **300px 초과** — 돔 하나를 400×400으로 키우면 D4 초과 경고(사각형과 공통 배터리).
- [x] **width ≠ height** — 돔 하나를 240×160(비정사각)으로 바꾸면 "원인데 정사각 아님" 경고가 뜨고, 충돌은 `width/2` 기준 원으로 걸린다.
- [x] **Scale 조작** — 돔 Scale을 (2,2)로 키우면 경고 + 충돌은 원래 Content Size 기준.
- [x] **마커 제거 = 사각형으로 강등** — 돔의 `CircleObstacle` 컴포넌트를 빼면 같은 노드가 사각형(AABB)으로 막힌다(마커 유무가 형태를 가른다는 증거. 확인 후 원복).

> **F50(비유한 좌표 스킵)은 수동 테스트 대상이 아니다** — 반지름·중심이 `UITransform`·노드 좌표에서 유도되므로 에디터로는 NaN을 넣을 수 없다(엔진 손상·씬 파일 수동 편집이라야 도달하는 미발현 방어). 색인의 `Number.isFinite` 스킵은 코드 리뷰로 검증한다.

**회귀 (사각형·기존 시스템)**

- [x] 기존 사각형 박스(building-collision) 충돌·미끄러짐·우회가 그대로 동작한다.
- [x] 발사체·근접 부채꼴이 돔을 통과한다(D2 — 시야 차단 없음).
- [x] XP 오브가 돔 너머·안쪽에서 정상 획득(픽업은 장애물 무시).
- [x] 물 감속·아레나 클램프·일시정지/레벨업이 돔 옆에서 정상.
