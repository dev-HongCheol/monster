# 한강 소프트 해저드 (han-river-hazard) — 구현 계획

- **작성일:** 2026-07-15
- **브랜치:** feat/han-river-hazard
- **백로그:** 이 슬라이스가 닫는 항목 = **F39**(한강을 소프트 해저드로). 함께 의식하는 코드 항목 = **D2**(맵 JSON 스키마 방어), **F36**(이동 핫패스 할당 위생), **F47**(새 노드 레이어가 UI_2D로 새는 문제).
- **부모 문서:** [`2026-07-14-map-space-roadmap.md`](2026-07-14-map-space-roadmap.md) — 「맵 장애물」이 세 슬라이스로 갈라진 경위. 이 슬라이스는 그 둘째(①스폰 회귀 → **②한강 해저드** → ③건물 충돌).
- **선행:** 없음. 첫째 슬라이스 `feat/spawn-geometry`(PR #58, 머지됨)와 독립이다.

---

## 1. 배경 — 왜 이걸 하나

`feat/map-arena`(PR #55)가 서울 배경·경계형 아레나·카메라 팔로우를 놓으면서 한강을 시각 placeholder로만 남겼다. 지금 한강은 배경 그림의 일부일 뿐 게임에 아무 영향이 없다. 로드맵 결정 D3은 한강을 **건널 수 없는 하드 배리어가 아니라 소프트 해저드**로 만들기로 했다. 건널 수는 있되 물속에선 불리하게 한다.

하드 배리어로 하지 않는 이유는 부모 문서 §3에 있다. 배리어는 다리 입구 농성 같은 초크포인트 악용을 부르고, 영역 연결성·경로탐색·원거리 적 컬링을 전부 딸려 오게 한다. 반면 소프트 해저드는 **순수 함수 하나로 끝나면서** "서울에서 싸운다"는 체감은 오히려 더 준다 — 플레이어가 한강을 건너며 실제로 느려질 때 이 맵이 서울임을 몸으로 느끼기 때문이다.

---

## 2. 확정 설계 (office-hours에서 사용자와 잠금, 2026-07-15)

### 2.1 감속 모델 — 플레이어만 감속, 지속 피해 없음

물속에서는 **플레이어만** 이동 속도가 배율(기본 0.5×)로 느려진다. 적은 물의 영향을 받지 않고 전속력으로 움직인다. 물속 지속 피해(DoT)는 넣지 않는다.

이 모델이 로드맵이 남긴 밸런스 미결("감속이 양쪽 동일하면 원거리 우위 플레이어가 강 한복판에서 무한 카이팅한다")을 **감속 하나만으로** 닫는다. 인과는 이렇다. 물에서 플레이어만 느려지고 적은 안 느려지면, 플레이어가 물에 들어가는 순간 적이 상대적으로 더 빨라져 플레이어를 따라잡는다. 그래서 물은 플레이어에게 서 있으면 안 되는 위험지대가 되고, 플레이어는 물을 피해 육지에서 싸우게 된다. 대칭 감속이었다면 상대 속도가 그대로라 물속 카이팅 난도가 육지와 같고, 게다가 발사체는 물에서 안 느려지므로 슬로모션으로 다가오는 적을 계속 쏘는 안전지대가 됐을 것이다 — 그것이 로드맵이 우려한 실패 모드다.

대가로 "적이 물을 전속력으로 건너 강을 하이웨이처럼 쓰며 플레이어를 압박한다"는 그림이 딸려온다. 이건 의도된 위험이며(사용자 확인), 데이터에 `enemySpeedMul` 레버(기본 1.0)를 둬 7단계 체감에서 어긋나면 코드 변경 없이 적도 감속시킬 수 있게 남긴다.

### 2.2 강 형태 — 중앙을 가로지르는 S자 오목 폴리곤 하나

한강을 서울 중앙을 서→동으로 가로지르는 **오목 폴리곤 하나**로 표현한다(네이버 지도 캡처 `docs/hangang.png` 참조 — 이 파일은 임시이며 이 슬라이스 종료 시 삭제한다). 실제 한강처럼 왼쪽에서 들어와 중앙에서 아래로 처졌다가 오른쪽으로 다시 올라가는 형태다. 맵을 남·북으로 가르지만 소프트 해저드라 아무 데서나 건널 수 있어 초크포인트가 생기지 않는다.

폴리곤을 고른 이유: 곡선 강을 축정렬 사각형 여러 개로 계단식 근사하면, 최종 배경 그림은 매끈한데 감속은 계단처럼 걸려서 "물 밖 마른 땅에서 느려지는" 어긋남이 영구히 남는다. 폴리곤은 강을 따라가므로 그 어긋남이 없다. 폴리곤 판정 비용이 사각형보다 비싸다는 통상의 단점은 여기서 사라진다 — **플레이어만 감속하므로 매 프레임 검사하는 점이 딱 하나(플레이어)뿐**이라, 정점이 수십 개여도 프레임당 판정 1회로 비용이 사실상 0이기 때문이다.

### 2.3 시각화 — 같은 폴리곤을 런타임 반투명 파랑으로 채움

물 구역 폴리곤을 런타임에 반투명 파랑 `Graphics` 채움으로 그린다. 해저드 판정과 화면에 보이는 물이 **같은 `regions` 데이터에서 나오므로 100% 일치**한다. 최종 픽셀 아트(F41)가 들어오기 전까지 이 채움이 사실상 강 그림 역할을 한다. 최종 아트가 오면 그 위에 덮거나 이 채움을 걷어낸다.

---

## 3. 스코프

### 3.1 이 슬라이스가 하는 것

- `seoul.json`에 물 구역(`regions`) 데이터 추가.
- 순수 로직: 점이 폴리곤 안에 있는지 판정(point-in-polygon) + 위치별 플레이어 속도 배율 조회.
- 플레이어 이동에 물 감속 배율 배선(호출 지점 한 곳).
- 물 구역 폴리곤을 반투명 파랑으로 그리는 렌더 컴포넌트.

### 3.2 스코프 밖 (명시)

| 항목 | 어디서 | 이유 |
|------|--------|------|
| 건물 충돌 | F38 (셋째 슬라이스) | 로드맵이 한강 다음으로 잡음 |
| 적 경로탐색 | F43 | 해저드는 우회가 필요 없어 범위 축소됨 |
| 적 물 감속 | — | 플레이어-전용이 설계. `enemySpeedMul` 레버만 남기고 기본 1.0 |
| 물속 지속 피해(DoT) | — | 감속만으로 악용이 닫혀 불필요 |
| 다중 물 구역/여러 폴리곤 | — | 한강 하나로 충분. `regions`는 배열이라 확장은 데이터만 추가 |
| 최종 강 픽셀 아트 | F41 | 아트 파이프라인 단계 |

---

## 4. 아키텍처 (Eng 리뷰)

### 4.1 데이터 흐름

```
seoul.json (regions)
      │  DataManager가 로드 (resources/data/maps/seoul.json)
      ▼
DataManager.mapData : IMapData   ← regions 필드 추가
      │  MapManager.onReady 콜백에서 읽음
      ▼
MapManager.regions : WaterRegion[]   ← arena 게터 옆에 새 게터
      ├────────────────────────────────┐
      ▼                                 ▼
PlayerController._move             RegionRenderer (신규 컴포넌트)
  RegionLogic.speedMulAt(pos, regions)   폴리곤을 Graphics 반투명 채움으로 1회 렌더
  → speed에 배율 곱함
```

### 4.2 데이터 스키마 (`seoul.json` / `IMapData`)

`IMapData`(`GameTypes.ts:321`)에는 주석으로 "장애물·지형(obstacles/regions) 필드는 장애물 슬라이스에서 추가한다"고 이미 예약돼 있다. 여기에 `regions`를 **선택 필드**로 추가한다.

```jsonc
// seoul.json
{
  "id": "seoul",
  "size": [2400, 2400],
  "backdrop": "maps/seoul/backdrop",
  "regions": [
    {
      "type": "water",
      "poly": [[-1200,370],[-700,250],[-200,20],[0,-30],[300,70],[700,250],[1200,600],
               [1200,160],[700,-190],[300,-370],[0,-470],[-200,-420],[-700,-190],[-1200,-70]],
      "playerSpeedMul": 0.5,
      "enemySpeedMul": 1.0
    }
  ]
}
```

```ts
// GameTypes.ts
export interface IWaterRegion {
  type: 'water';
  /** 원점(0,0) 중심 좌표계의 폴리곤 정점 [x,y] 배열. 오목 허용. */
  poly: [number, number][];
  /** 물속 플레이어 이동 속도 배율. 없으면 1.0(효과 없음) + 경고. */
  playerSpeedMul?: number;
  /** 물속 적 이동 속도 배율. 이번 슬라이스는 항상 1.0(미사용 레버). */
  enemySpeedMul?: number;
}

export interface IMapData {
  id: string;
  size: [number, number];
  backdrop: string;
  /** 지형 구역(물 등). 없으면 무해저드. */
  regions?: IWaterRegion[];
}
```

**D2(스키마 방어) 편입 범위** — 이번엔 전면 스키마 검증(D2 전체)을 하지 않고, 이 필드에 대한 **국소 방어**만 넣는다. `regions`가 없으면 무해저드(안전 기본값). 정점이 3개 미만인 폴리곤은 면적이 없어 판정이 무의미하므로 건너뛰고 한 번 경고한다. `playerSpeedMul`이 누락되면 의도치 않은 감속을 조용히 적용하지 않도록 **1.0(효과 없음)으로 폴백하고 경고**한다(의도적 0.5와 누락을 구분 — D2의 핵심 취지). 이 방어들이 어긋나면 나타나는 증상: 방어가 없으면 오타 하나가 강 전체를 감속 0으로 만들거나(무효과) 잘못된 배율로 조용히 굴러가 7단계에서 원인을 못 찾는다.

### 4.3 순수 로직 — `logic/RegionLogic.ts` (신규)

`ArenaLogic`이 아레나 경계를 다루듯, 물 구역 판정은 별개 관심사라 새 모듈에 둔다. `Vec2`는 기존 `ArenaLogic`(또는 `MovementLogic`)에서 import해 **세 번째 정의를 만들지 않는다**.

```ts
import type { Vec2 } from './ArenaLogic';

export interface WaterRegion {
  poly: readonly (readonly [number, number])[];
  playerSpeedMul: number;   // MapManager가 폴백(1.0)까지 적용해 넘김
}

/** 점이 폴리곤(오목 허용) 내부인지 판정한다. ray-casting(even-odd). 무할당. */
export function pointInPolygon(pt: Vec2, poly: readonly (readonly [number, number])[]): boolean;

/** 위치에 걸린 플레이어 속도 배율을 돌려준다. 어느 물 구역에도 없으면 1.0. */
export function playerSpeedMulAt(pt: Vec2, regions: readonly WaterRegion[]): number;
```

`playerSpeedMulAt`은 `regions`를 for-루프로 순회하며 `pointInPolygon`이 true인 첫 구역의 `playerSpeedMul`을 돌려주고, 없으면 1.0을 돌려준다. **F36 계약:** 두 함수 모두 배열·객체를 새로 만들지 않는다(`.map`/`.filter`/스프레드 금지, 인덱스 for-루프만). 폴리곤 정점 배열은 인자로 받은 것을 그대로 읽는다.

### 4.4 데이터 노출 — `MapManager`

`arena` 게터 옆에 `regions` 게터를 둔다. `_applyMap()`에서 `map.regions`를 읽어 검증(정점 3개 미만 건너뜀 + `playerSpeedMul` 폴백)한 뒤 `RegionLogic.WaterRegion[]` 형태로 보관한다. 없으면 빈 배열이라 소비처가 자연히 무해저드가 된다.

### 4.5 이동 배선 — `PlayerController._move`

현재 (`PlayerController.ts:103`):

```ts
const speed = base.speed * (1 + (DeckManager.instance?.moveSpeedBonus ?? 0));
```

여기에 물 감속을 한 겹 곱한다. 현재 위치(`pos`)를 기준으로 판정한다 — 이번 프레임의 속도는 플레이어가 지금 물에 있느냐로 정한다.

```ts
const regions = MapManager.instance?.regions ?? [];
const waterMul = playerSpeedMulAt(pos, regions);   // 물 밖이면 1.0
const speed = base.speed * (1 + (DeckManager.instance?.moveSpeedBonus ?? 0)) * waterMul;
```

**적 이동 코드(`EnemyController` 추격·유격·돌진·지그재그 4곳)는 손대지 않는다.** 적은 물 영향이 없기 때문이다. 이것이 이 슬라이스가 적 이동 로직을 건드리지 않는 이유이자, `enemySpeedMul`이 이번엔 미사용 레버로만 남는 이유다.

### 4.6 렌더링 — `RegionRenderer` (신규 컴포넌트)

`MapManager.regions`를 읽어 각 물 폴리곤을 `Graphics`로 반투명 파랑 채움(`moveTo`/`lineTo`/`close`/`fill`)으로 그린다. 물 구역은 정적이므로 맵 데이터 준비 시점에 **1회만** 그린다(매 프레임 비용 없음). MapManager를 배경·아레나 크기에 집중시키기 위해 별도 컴포넌트로 둔다(대안: MapManager 확장 — §7 판단 참조).

**F47 주의 (필수 QA 항목):** 이 채움 노드는 반드시 **게임 월드 계층의 `DEFAULT` 레이어**여야 한다. Cocos 에디터에서 `Create → 2D Object`로 노드를 만들면 레이어가 `UI_2D`로 붙는데, 그러면 플레이어를 따라가는 게임 `Camera`(DEFAULT)가 아니라 **고정된 `UICamera`(UI_2D)가 다른 배율로** 그려서, 강이 플레이어를 안 따라가고 엉뚱한 위치·크기로 찍힌다(에러도 경고도 없이). 이 노드는 배경 위·게임플레이 엔티티 아래로 z-order를 잡아 적·플레이어가 물 위에 그려지게 한다.

> **Cocos API 확인:** 구현 시 `Graphics`의 폴리곤 채움 API(`moveTo`/`lineTo`/`close`/`fillColor`/`fill`)와 레이어 지정을 Context7 공식 문서로 확인한 뒤 작성한다(추측 금지 — CLAUDE.md Cocos 규칙).

---

## 5. CEO 리뷰 (스코프·가치)

**옳은 문제인가.** 그렇다. 로드맵 D3이 이미 소프트 해저드로 방향을 정했고, 이 슬라이스는 F39를 닫으며 "서울에서 싸운다"는 정체성을 **가장 싼 방법**으로 전달한다. 순수 함수 하나 + 배선이 전부라 위험이 낮다.

**이미 있는 것(재사용).**

| 필요 | 이미 있는 것 |
|------|-------------|
| 아레나 크기 단일 출처 + 맵 데이터 경로 | `MapManager`(arena 게터), `DataManager.mapData` |
| 평면 벡터·순수 로직 컨벤션 | `ArenaLogic`(`Vec2`, clamp 함수들) |
| 플레이어 속도 적용 지점 | `PlayerController._move:103` |
| 폴리곤 채움 렌더 | Cocos `Graphics`(엔진 내장) |

**스코프 보정.** 좁고 정확하다. 플레이어-전용 감속·무 DoT·단일 폴리곤으로 최소 쐐기를 잡았다. 확장(적 감속·다중 구역)은 전부 데이터 레버 또는 배열 추가로 열려 있어 코드 재작업이 없다.

**6개월 후 후회 시나리오.** 폴리곤 정점을 placeholder 배경에 맞춰 손으로 짠다. 최종 아트(F41)에서 강 경로가 바뀌면 정점을 다시 훑어야 한다. 이건 문서화돼 있고(§2.2), 정점이 `seoul.json` 데이터라 다시 훑기가 쉽다. 수용 가능.

**딸려오는 위험 하나.** 플레이어-전용 감속은 "적이 강을 전속력 하이웨이로 쓴다"는 그림을 만든다. 불공평하게 느껴질 수 있다. 완화책은 `enemySpeedMul` 레버(기본 1.0)로, 7단계 체감에서 어긋나면 코드 없이 적도 감속시킨다. 값 결정은 인게임 체감으로 미룬다.

---

## 6. 테스트 계획 (Eng §3)

순수 로직이라 vitest로 결정적으로 검증한다. wf 게이트 규칙상 피처 테스트 파일명은 피처명 PascalCase여야 하므로 **`tests/logic/HanRiverHazard.test.ts`** 로 만들고, 그 안에서 `RegionLogic`을 테스트한다(RED 먼저).

| 대상 | 케이스 |
|------|--------|
| `pointInPolygon` | 볼록 사각형 내부 → true / 외부 → false |
| `pointInPolygon` | **오목** 폴리곤(S자 띠) 내부 → true, "만입부(notch)"의 물 밖 점 → false |
| `pointInPolygon` | 정점과 같은 y를 지나는 수평 광선(ray-casting 퇴화 케이스) 일관 처리 |
| `pointInPolygon` | 정점 3개 미만 → false(면적 없음) |
| `playerSpeedMulAt` | 물 구역 안 → 그 구역 `playerSpeedMul` |
| `playerSpeedMulAt` | 모든 구역 밖 → 1.0 |
| `playerSpeedMulAt` | 빈 `regions` 배열 → 1.0 |

MapManager의 검증 로직(정점<3 건너뜀, `playerSpeedMul` 폴백)은 Cocos 의존이라 순수 테스트가 아니며, QA 문서의 수동 항목(임시 데이터 조작)으로 검증한다.

---

## 7. 리뷰에서 나온 판단 (taste decisions)

전부 저위험 엔지니어링 판단이라 6원칙(특히 P5 명시성·P3 실용)으로 결정하고 근거를 남긴다. 사용자 도전(both-models-disagree) 항목은 없다. Codex는 미설치라 2차 보이스 없이 인라인 리뷰로 진행했다.

1. **순수 로직 배치 — 새 `RegionLogic.ts`** (대안: `ArenaLogic` 확장). 물 구역은 아레나 경계와 다른 관심사라 새 모듈이 명확하다(P5). `Vec2`만 재사용해 중복을 피한다.
2. **렌더링 — 별도 `RegionRenderer` 컴포넌트** (대안: `MapManager` 확장). MapManager를 아레나 크기·배경에 집중시키고, 물 오버레이는 독립적으로 배선·토글되게 한다(단일 책임). MapManager 확장이 파일 하나 적지만, 렌더와 데이터 관심사가 섞인다.
3. **`playerSpeedMul` 누락 폴백 — 1.0 + 경고** (대안: 0.5). 데이터 오타가 의도치 않은 감속으로 조용히 굴러가지 않게, 누락은 "효과 없음"으로 크게 경고한다(D2 취지).

---

## 8. 구현 순서

1. `GameTypes.ts` — `IWaterRegion` + `IMapData.regions` 추가.
2. `logic/RegionLogic.ts` — `pointInPolygon`·`playerSpeedMulAt`(무할당).
3. `tests/logic/HanRiverHazard.test.ts` — RED(§6 케이스). ← 이 시점 `wf ready-impl`의 RED 게이트.
4. GREEN — RegionLogic 구현.
5. `seoul.json` — `regions` 데이터(§4.2 정점).
6. `MapManager` — `regions` 게터 + 검증.
7. `PlayerController._move` — 물 감속 배선.
8. `RegionRenderer` — Graphics 반투명 채움(DEFAULT 레이어, Context7 확인).

---

## 9. 미확정 / 7단계 튜닝

- `playerSpeedMul` 기본 **0.5**(데이터 레버). 감속 세기 체감으로 조정.
- `enemySpeedMul` 기본 **1.0**(미적용). 적 하이웨이가 불공평하면 낮춤.
- 폴리곤 정점: §4.2는 네이버 지도 참조로 유도한 시작값. 최종은 에디터에서 배경 위에 맞춰 확정.
- 반투명 파랑의 알파·색조: 시인성 체감으로 조정.

---

## 10. 정리 항목

- `docs/hangang.png`(네이버 지도 캡처, 임시)는 **커밋하지 않고 슬라이스 종료 시 삭제**한다. 강 형태는 이 계획과 `seoul.json` 정점에 남으므로 이후 불필요하다.
