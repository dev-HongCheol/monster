// 물 구역(소프트 해저드)의 순수 로직 — cc import 없이 평면 좌표·폴리곤만 다뤄 결정적으로 테스트한다.
// 물속에서는 플레이어만 감속하므로 매 프레임 검사하는 점이 플레이어 하나뿐이다. 그래서 폴리곤 판정이
// 사각형보다 비싸다는 통상의 단점이 사라진다 — 정점이 수십 개여도 프레임당 판정 1회로 비용이 사실상 0.

import type { Vec2 } from './ArenaLogic';

/**
 * MapManager가 검증을 마쳐 넘기는 런타임 물 구역. 데이터 원본(`IWaterRegion`)과 달리
 * `playerSpeedMul`이 항상 채워져 있다(누락은 MapManager가 1.0으로 폴백).
 */
export interface WaterRegion {
  /** 폴리곤 정점 [x,y] 배열(오목 허용). 원점(0,0) 중심 좌표계, 읽기 전용으로 참조만 한다. */
  poly: readonly (readonly [number, number])[];
  /** 물속 플레이어 이동 속도 배율. */
  playerSpeedMul: number;
}

/**
 * 점이 폴리곤(오목 허용) 내부인지 판정한다. ray-casting(even-odd) — 점에서 +x 방향 수평 광선을
 * 쏴 폴리곤 변과 교차한 횟수가 홀수면 내부다. 배열·객체를 새로 만들지 않는다(F36 핫패스 위생).
 * @param pt 판정할 점
 * @param poly 폴리곤 정점 배열. 3개 미만이면 면적이 없어 항상 false.
 * @returns 내부면 true. 좌표가 NaN·무한대면 비교가 토글을 만들지 못해 false로 떨어진다(유령 감속 차단).
 */
export function pointInPolygon(pt: Vec2, poly: readonly (readonly [number, number])[]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  const x = pt.x;
  const y = pt.y;
  let inside = false;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    // 변 (i,j)가 수평선 y를 가로지르고(두 끝점 중 한쪽만 y 위) 교차 x가 점 오른쪽이면 광선이 관통한다.
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

/**
 * 점이 걸린 첫 물 구역의 플레이어 속도 배율을 돌려준다. 어느 구역에도 없으면 1.0(무감속).
 * regions는 인덱스 for-루프로만 순회해 배열을 새로 만들지 않는다(F36).
 * @param pt 플레이어 위치
 * @param regions 물 구역 배열(MapManager가 검증해 넘김). 비어 있으면 항상 1.0.
 */
export function playerSpeedMulAt(pt: Vec2, regions: readonly WaterRegion[]): number {
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    if (pointInPolygon(pt, region.poly)) return region.playerSpeedMul;
  }
  return 1;
}
