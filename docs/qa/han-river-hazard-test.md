# QA 체크리스트 — 한강 소프트 해저드 (feat/han-river-hazard)

- **브랜치:** feat/han-river-hazard
- **계획 문서:** [`../development/sessions/2026-07-15-han-river-hazard-plan.md`](../development/sessions/2026-07-15-han-river-hazard-plan.md)
- **대상:** 한강을 원점 중심 오목 폴리곤 하나로 표현하고, 물속에서 **플레이어만** 이동 속도를 배율(기본 0.5×)로 늦춘다(적 무영향·지속 피해 없음). 같은 `regions` 데이터로 반투명 파랑 물을 렌더해 해저드와 시각을 일치시킨다. 건물 충돌·적 경로탐색·최종 강 아트는 이월(F38·F43·F41).

---

## 1. Impact Map (변경 파일별 확인 범위)

| 파일 | 변경 | 회귀 확인 범위 |
|------|------|----------------|
| `data/GameTypes.ts` (수정) | `IWaterRegion` 추가 + `IMapData.regions?` 선택 필드 | 타입만 — 기존 맵 로드 회귀 없음 |
| `logic/RegionLogic.ts` (신규·순수) | `pointInPolygon`·`playerSpeedMulAt` + `WaterRegion` | 자동 테스트로 전량 검증 |
| `resources/data/maps/seoul.json` (수정·데이터) | `regions` 배열(물 폴리곤 1개) 추가 | 로드 성공, `regions` 없는 기존 동작과 호환 |
| `systems/MapManager.ts` (수정·Cocos) | `regions` 게터 + 검증(정점<3 스킵·`playerSpeedMul` 폴백·정점 아레나 밖 경고) | 맵 로드 시 물 구역 주입, 기존 `arena`·배경 회귀 없음 |
| `components/PlayerController.ts` (수정·Cocos) | `_move`에서 현재 위치 물 배율을 속도에 곱함 | 물 밖 이동 속도·이동감 회귀 없음, 물속 감속 |
| `components/RegionRenderer.ts` (신규·Cocos) | `Graphics`로 물 폴리곤 반투명 파랑 1회 채움 | 물이 배경 위·엔티티 아래에 카메라 따라 표시 |
| `scenes/main.scene` (수정) | 물 렌더용 노드 1개 추가(Graphics + RegionRenderer, DEFAULT 레이어) | 게임 월드 렌더 순서, 레이어 누수(F47) 없음 |

> **적 이동 코드는 손대지 않는다** — 적은 물 영향이 없다(계획 §4.5). 이것이 회귀 표면을 좁힌다.

---

## 2. 자동 테스트로 검증 (`tests/logic/HanRiverHazard.test.ts`)

> **통과 근거:** 피처 테스트 15/15 + 전체 스위트 498/498 (35 파일) GREEN. 통과 커밋 SHA는 커밋(11단계) 후 기재.

- [x] `pointInPolygon` — 볼록 사각형 내부 true / 밖 false(좌우·상하).
- [x] `pointInPolygon` — 오목 "ㄷ"자: 살(만입부 바깥) 내부 true, **만입부 안쪽 점 false**(볼록 근사와 갈리는 지점).
- [x] `pointInPolygon` — 수평 광선이 정점 y를 지나는 퇴화 케이스 일관 처리(마름모 중심·정점 선상 내부 true, 선상 외부 false).
- [x] `pointInPolygon` — 정점 3개 미만(변·점·빈 배열) → false.
- [x] `pointInPolygon` — 좌표 NaN·무한대 → false(유령 감속 차단).
- [x] `playerSpeedMulAt` — 물 구역 안 → 그 구역 배율(0.5), 밖 → 1.0, 빈 배열 → 1.0.
- [x] `playerSpeedMulAt` — 여러 구역 중 점이 걸린 구역 배율, 겹치면 첫 구역(결정적), NaN 좌표 → 1.0.
- [x] 무할당 계약 — `pointInPolygon`·`playerSpeedMulAt`이 입력(폴리곤·regions)을 변형하지 않음(F36).

MapManager의 검증(정점<3 스킵·`playerSpeedMul` 폴백·정점 아레나 밖 경고)과 이동 배선·물 렌더는 cc 의존이라 아래 수동 항목으로 검증한다.

---

## 3. 씬 변경 사항 (`main.scene`) — (확정)

물 구역은 정적이라 런타임에 1회 그린다. 게임 `Camera`(DEFAULT)가 그려야 카메라를 따라가므로, 렌더 노드는 반드시 **게임 `Canvas`(DEFAULT 레이어) 아래**여야 한다(F47 — `UI_2D`로 새면 고정 `UICamera`가 다른 배율로 그려 강이 카메라를 안 따라가고 엉뚱한 곳에 찍힌다).

**실제 씬 구조(2026-07-16 확인):** 게임 월드는 `Canvas`(DEFAULT, lpos 640×360) 아래에 `Camera`·`Player`(둘 다 DEFAULT)·`BulletParent`·매니저들이 있다. **맵 배경 노드는 현재 없다** — `MapManager.backdropSprite`가 씬에서 `null`이라 서울 배경 스프라이트가 연결돼 있지 않다(map-arena에서 미연결로 남음). 씬에 있는 유일한 `Backdrop` 노드는 `PauseRoot ↳ PausePanel`의 딤 배경(UI_2D)이며 이 슬라이스와 무관하다. 따라서 RegionOverlay는 "Backdrop 뒤"가 아니라 **게임 `Canvas`의 첫 자식**으로 두어 물이 가장 뒤에 깔리게 한다.

| 노드 | 변경 | 값 |
|------|------|-----------|
| `RegionOverlay` (신규) | 게임 `Canvas`의 **첫 자식**, Layer=**DEFAULT**(Player·Canvas와 동일), `Graphics`+`RegionRenderer` 부착 | Position (0,0), UITransform 2400×2400, Anchor (0.5,0.5) |

**렌더 순서(z-order):** 2D는 형제 배열 순서가 뒤일수록 위에 그려진다. `RegionOverlay`를 `Canvas`의 **맨 위 형제(첫 자식)**로 두면 `Player`·`BulletParent`·런타임 적/발사체(뒤 형제이거나 런타임 append)가 전부 물 위에 그려진다. 게임 카메라 ClearFlags가 SOLID_COLOR라, 맵 배경이 없는 지금은 물이 그 단색 배경 위에 깔린다(F41/배경 스프라이트가 생기면 그 아래로 넣는다).

---

## 4. 에디터 조립 레시피 — (확정)

> 사용자가 문서만 보고 세팅할 수 있게 순서·수치를 준다. 컴포넌트 이름·`@property`는 구현 후 코드 기준으로 확정한다.

**목표 계층 (main.scene 관련 부분):**

```
main (Scene)
 ↳ Canvas            (게임, DEFAULT, lpos 640×360)
    ↳ RegionOverlay  (신규 — 물 폴리곤 렌더)   ← Canvas의 첫 자식(맨 위)로 두어 물이 뒤에 깔림
    ↳ Camera         (게임 카메라 — 기존)
    ↳ Player         (기존, DEFAULT)
    ↳ BulletParent   (기존)
    ↳ DataManager · GameManager · EnemySpawner · … (기존 매니저 — Canvas 자식)
 ↳ MapManager        (별도 노드, DEFAULT — Canvas 형제)
 ↳ UICanvas          (HUD·CardSelectPanel·PauseRoot — UI_2D)
    ↳ … ↳ PausePanel ↳ Backdrop   (일시정지 딤 배경 — 우리 물과 무관, 헷갈리지 말 것)
```

**만드는 순서:**

1. **빈 노드 생성** — 게임 `Canvas`를 우클릭 → `Create → Empty Node`. 이름 `RegionOverlay`. (`Create → 2D Object`로 만들지 말 것 — 그 경로는 Layer를 `UI_2D`로 붙여 F47을 재발시킨다.)
2. **Layer 확인/교정** — Inspector 상단 `Layer`를 **`DEFAULT`** 로. `Player`·`Canvas`와 같은 레이어여야 한다(값 `1073741824`).
3. **UITransform 세팅** — `Graphics`는 UI 렌더 컴포넌트라 UITransform이 필요하다(Context7 확인: Graphics는 ui-system 컴포넌트). Content Size `2400 × 2400`, Anchor `(0.5, 0.5)`, Position `(0, 0)`. (Graphics는 노드 로컬 좌표로 그리는데 노드가 원점이라 로컬=월드가 되어 `seoul.json` 정점이 그대로 찍힌다.)
4. **컴포넌트 부착** — `Add Component → Graphics`, 이어서 `Add Component → RegionRenderer`. (채움 색·알파는 `RegionRenderer`가 코드로 지정하므로 Graphics `fillColor`는 손대지 않아도 된다.)
5. **형제 순서 조정** — Hierarchy에서 `RegionOverlay`를 게임 `Canvas`의 **맨 위 형제(첫 자식)**로 드래그한다. 2D는 뒤 형제일수록 위에 그려지므로, 맨 위에 두면 `Player`·`BulletParent`·런타임 적/발사체가 전부 물 위로 그려진다(§3 z-order).
6. **`@property` 연결** — 아래 5절 표대로(현재 추가 연결 없음이 예상 — 구현 후 확정).

> Cocos `Graphics` 동작(`moveTo`/`lineTo`/`close`/`fill`/`fillColor`, UI 노드는 UITransform 필요)은 계획 §4.6에서 Context7 공식 문서로 확인했다. 앵커가 Graphics 드로잉 원점에 미치는 영향은 구현 시 실제 렌더로 재확인한다.

---

## 5. 에디터 연결 체크리스트 (`@property`) — (확정)

| 컴포넌트 | `@property` | 연결 노드 | 상태 |
|----------|-------------|-----------|------|
| `RegionRenderer` (RegionOverlay) | `fillColor: Color` (반투명 파랑 기본값 내장 — 노드 연결 불필요, 시인성 튜닝용 선택값) | — (값, 노드 연결 없음) | ❌ |

> 물 구역 데이터는 `MapManager`가 `seoul.json`에서 읽어 싱글톤(`MapManager.instance.regions`)으로 노출하고, `PlayerController`·`RegionRenderer`가 그 값을 읽는다(노드 `@property` 연결 없음). `RegionRenderer`는 같은 노드의 `Graphics`를 `getComponent`로 찾으므로, 에디터에서 확인할 것은 **같은 노드에 `Graphics`가 함께 붙어 있는지**와 **Layer가 DEFAULT인지**다(§4). `상태` ❌는 7단계 사용자 씬 배선에서 확인한다.

---

## 6. 수동 테스트 체크리스트 (인게임)

- [x] **물속 플레이어 감속** — 한강(반투명 파랑) 위로 들어가면 이동이 눈에 띄게 느려지고(기본 0.5×), 물 밖으로 나오면 즉시 원래 속도로 돌아온다.
- [x] **적은 물에서 안 느려짐** — 적이 한강을 전속력으로 건넌다(플레이어만 감속하는 설계 — 물이 적에게 하이웨이가 되는 건 의도된 위험, `enemySpeedMul` 레버는 기본 1.0).
- [x] **지속 피해 없음** — 물속에 서 있어도 HP가 깎이지 않는다(DoT 미도입).
- [x] **물 렌더 위치·레이어(F47 회귀 방지)** — 반투명 파랑 강이 배경 위·적/플레이어 아래로 그려지고, **카메라를 따라간다**(플레이어가 이동해도 강이 배경과 같이 스크롤). 강이 화면에 고정되거나 엉뚱한 크기·위치로 찍히면 `RegionOverlay` 레이어가 `UI_2D`로 샌 것 → DEFAULT로 교정.
- [x] **해저드=시각 일치** — 감속이 시작되는 경계가 눈에 보이는 파랑 물가와 일치한다(같은 `regions` 데이터에서 나옴). 물 밖 마른 땅에서 느려지거나 물속인데 안 느려지는 어긋남이 없다.
- [x] **데이터 방어 — `playerSpeedMul` 누락(임시 조작)** — `seoul.json` 물 구역에서 `playerSpeedMul`을 지우면, 조용한 감속 대신 **1.0(무감속)으로 폴백 + 콘솔 경고**가 뜬다(확인 후 원복).
- [x] **데이터 방어 — 정점<3(임시 조작)** — `poly`를 정점 2개로 줄이면 그 구역을 **건너뛰고 경고**한다(감속 없음, 크래시 없음. 확인 후 원복).
- [x] **데이터 방어 — `poly` 누락/비배열(임시 조작)** — 물 구역에서 `poly` 키를 통째로 지우거나 배열 아닌 값으로 바꾸면, 그 구역을 **건너뛰고 경고**하며 게임은 정상 부팅된다(크래시·전체 초기화 취소 없음 — 코드리뷰 I-1 수정). 확인 후 원복.
- [x] **데이터 방어 — 정점 아레나 밖 / size 결합(임시 조작)** — `size`를 예: `[3000,3000]`으로 키우면(폴리곤은 그대로) 정점이 새 경계 밖이 되어 **콘솔 경고**가 뜨고, 강이 좌우 강안에 안 닿고 맵 가운데로 뜬 게 보인다(폴리곤 좌표는 `size`와 같은 공간이라 함께 맞춰야 한다는 신호. 확인 후 원복).
- [x] **`regions` 없는 맵 회귀** — `regions`를 통째로 지우면 무해저드로 정상 동작한다(감속·물 렌더 없음, 경고·크래시 없음).
- [x] **일시정지/레벨업 회귀** — 물 위에서 ESC 일시정지·레벨업 카드가 정상 동작하고, 재개 시 감속 상태가 올바르게 이어진다.
