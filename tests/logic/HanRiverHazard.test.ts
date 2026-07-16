import { describe, expect, it } from 'vitest';
import {
  playerSpeedMulAt,
  pointInPolygon,
  type WaterRegion,
} from '../../game/assets/scripts/logic/RegionLogic';

/**
 * 계획 문서(2026-07-15-han-river-hazard-plan.md §4.3·§6)의 순수 물 구역 로직.
 *
 * 한강을 원점(0,0) 중심 좌표계의 오목 폴리곤으로 표현하고, 플레이어 위치 한 점이 물 안인지
 * 판정해 이동 속도 배율을 돌려준다. 물속에서는 **플레이어만** 느려지므로(적은 무영향, §2.1) 매
 * 프레임 검사하는 점이 플레이어 하나뿐이라, 정점이 수십 개인 폴리곤도 프레임당 판정 1회로 끝난다.
 *
 * - pointInPolygon: 점이 폴리곤(오목 허용) 내부인지 ray-casting(even-odd)으로 판정한다.
 * - playerSpeedMulAt: 점이 걸린 첫 물 구역의 배율을 돌려주고, 어디에도 없으면 1.0(무감속).
 *
 * MapManager의 데이터 검증(정점<3 건너뜀·`playerSpeedMul` 폴백·정점 아레나 밖 경고)과 실제 이동
 * 배선(PlayerController)은 cc 프레임워크 의존이라 여기서 다루지 않는다(7단계 수동 QA).
 */

/** 폴리곤 정점 배열 — RegionLogic이 받는 것과 같은 읽기 전용 형태. */
type Poly = readonly (readonly [number, number])[];

/** 볼록 사각형(0,0)-(10,10). */
const SQUARE: Poly = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

/**
 * 오목 "ㄷ"자 — 10×10 사각에서 x∈[4,10]·y∈[4,6] 만입부(notch)를 파낸 모양.
 * 만입부는 폴리곤 밖(물 밖 마른 땅)이라, 오목 판정이 볼록 근사와 갈리는 지점이다.
 */
const NOTCHED: Poly = [
  [0, 0],
  [10, 0],
  [10, 4],
  [4, 4],
  [4, 6],
  [10, 6],
  [10, 10],
  [0, 10],
];

/** 마름모 — 정점 두 개가 y=5에 있어, y=5 수평 광선이 정점을 지나는 퇴화 케이스를 만든다. */
const DIAMOND: Poly = [
  [0, 5],
  [5, 0],
  [10, 5],
  [5, 10],
];

/** 깊은 복제 — 함수 호출이 입력을 변형하지 않는지 비교할 스냅샷을 만든다. */
function snapshot<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

describe('pointInPolygon — 볼록·오목 판정', () => {
  it('볼록 사각형 내부는 true', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, SQUARE)).toBe(true);
  });

  it('볼록 사각형 밖은 false (좌우·상하 모두)', () => {
    expect(pointInPolygon({ x: 15, y: 5 }, SQUARE)).toBe(false);
    expect(pointInPolygon({ x: 5, y: -5 }, SQUARE)).toBe(false);
  });

  it('오목 폴리곤의 살(만입부 바깥쪽)은 내부 → true', () => {
    // 만입부 왼쪽 살(x<4) / 아래 살(y<4) / 위 살(y>6) — 전부 물 안
    expect(pointInPolygon({ x: 2, y: 5 }, NOTCHED)).toBe(true);
    expect(pointInPolygon({ x: 7, y: 2 }, NOTCHED)).toBe(true);
    expect(pointInPolygon({ x: 7, y: 8 }, NOTCHED)).toBe(true);
  });

  it('오목 폴리곤의 만입부 안쪽 점은 물 밖 → false (볼록 근사면 여기서 갈린다)', () => {
    // (7,5)는 파낸 자리 한복판 — 볼록 껍질로 봤다면 물로 오판했을 점이다
    expect(pointInPolygon({ x: 7, y: 5 }, NOTCHED)).toBe(false);
  });

  it('수평 광선이 정점을 지나도 일관되게 판정한다 (ray-casting 퇴화)', () => {
    // (0,5)·(10,5) 두 정점과 같은 y=5를 지난다 — 정점을 두 번 세면 안팎이 뒤집힌다
    expect(pointInPolygon({ x: 5, y: 5 }, DIAMOND)).toBe(true); // 중심
    expect(pointInPolygon({ x: 2, y: 5 }, DIAMOND)).toBe(true); // 정점 y선상 내부
    expect(pointInPolygon({ x: -1, y: 5 }, DIAMOND)).toBe(false); // 정점 y선상 외부
  });

  it('정점이 3개 미만이면 면적이 없어 항상 false', () => {
    expect(
      pointInPolygon({ x: 5, y: 5 }, [
        [0, 0],
        [10, 0],
      ]),
    ).toBe(false); // 변 하나
    expect(pointInPolygon({ x: 0, y: 0 }, [[0, 0]])).toBe(false); // 점 하나
    expect(pointInPolygon({ x: 0, y: 0 }, [])).toBe(false); // 빈 배열
  });
});

describe('pointInPolygon — 비유한 좌표는 물 밖으로 (유령 감속 차단)', () => {
  it('좌표가 NaN·무한대면 false — 던지지 않고 물 밖으로 처리한다', () => {
    // NaN 좌표를 물로 판정하면 플레이어가 원인 모를 감속에 걸린다. 비교가 전부 false가 되는
    // ray-casting 특성상 자연히 물 밖(false)이 나오지만, 계약으로 고정해 둔다.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(pointInPolygon({ x: bad, y: 5 }, SQUARE)).toBe(false);
      expect(pointInPolygon({ x: 5, y: bad }, SQUARE)).toBe(false);
    }
  });
});

describe('playerSpeedMulAt — 위치별 플레이어 속도 배율', () => {
  const REGIONS: readonly WaterRegion[] = [{ poly: SQUARE, playerSpeedMul: 0.5 }];

  it('물 구역 안이면 그 구역의 배율을 돌려준다', () => {
    expect(playerSpeedMulAt({ x: 5, y: 5 }, REGIONS)).toBe(0.5);
  });

  it('모든 구역 밖이면 1.0 (무감속)', () => {
    expect(playerSpeedMulAt({ x: 50, y: 50 }, REGIONS)).toBe(1);
  });

  it('빈 regions 배열이면 1.0 (무해저드)', () => {
    expect(playerSpeedMulAt({ x: 5, y: 5 }, [])).toBe(1);
  });

  it('여러 구역 중 점이 걸린 구역의 배율을 쓴다', () => {
    const far: WaterRegion = {
      poly: [
        [100, 100],
        [110, 100],
        [110, 110],
        [100, 110],
      ],
      playerSpeedMul: 0.7,
    };
    const regions: readonly WaterRegion[] = [{ poly: SQUARE, playerSpeedMul: 0.5 }, far];
    expect(playerSpeedMulAt({ x: 105, y: 105 }, regions)).toBe(0.7);
  });

  it('구역이 겹치면 순회 순서상 첫 구역의 배율을 쓴다 (결정적)', () => {
    // 두 구역이 (5,5)에서 겹친다 — 배선이 배열 앞쪽부터 훑으므로 0.5가 이긴다
    const overlapping: readonly WaterRegion[] = [
      { poly: SQUARE, playerSpeedMul: 0.5 },
      { poly: SQUARE, playerSpeedMul: 0.9 },
    ];
    expect(playerSpeedMulAt({ x: 5, y: 5 }, overlapping)).toBe(0.5);
  });

  it('좌표가 NaN이면 1.0 — 어느 구역에도 안 걸린다', () => {
    expect(playerSpeedMulAt({ x: Number.NaN, y: Number.NaN }, REGIONS)).toBe(1);
  });
});

describe('무할당 계약 — 입력을 변형하지 않는다 (F36 핫패스 위생)', () => {
  it('pointInPolygon은 폴리곤을 변형하지 않는다', () => {
    const before = snapshot(NOTCHED);
    pointInPolygon({ x: 7, y: 5 }, NOTCHED);
    expect(NOTCHED).toEqual(before);
  });

  it('playerSpeedMulAt은 regions를 변형하지 않는다', () => {
    const regions: readonly WaterRegion[] = [{ poly: SQUARE, playerSpeedMul: 0.5 }];
    const before = snapshot(regions);
    playerSpeedMulAt({ x: 5, y: 5 }, regions);
    expect(regions).toEqual(before);
  });
});
