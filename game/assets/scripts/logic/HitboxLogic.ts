// 플레이어 AABB 피해 히트박스 판정 순수 로직 (ADR 006).
// cc import 없이 평면 좌표·크기만 다뤄 결정적으로 테스트한다. 플레이어의 피해 히트박스는 축정렬
// 박스(중심 + 반너비·반높이)이고, 적·적 발사체는 원(중심·반지름)이라, 둘의 겹침을 원 중심을 박스에
// clamp한 최근접점과의 거리로 판정한다 — ObstacleLogic.resolveCircleMove의 사각형 침투식과 동형이다.
// 이동 해소(원 대 박스)와 같은 경계 규약(접함 = 안 겹침, `< r²`)을 써서 두 판정이 어긋나지 않는다.

/**
 * 원(중심 cx,cy · 반지름 r)이 축정렬 박스(중심 bx,by · 반너비 halfW · 반높이 halfH)와 겹치는지.
 * 원 중심을 박스 범위로 clamp한 최근접점과 원 중심 사이 제곱거리가 r²보다 **작으면** 겹침이다.
 * 접함(거리 == r)은 겹침이 아니다 — resolveCircleMove가 `d2 >= r2`를 밀어내지 않는 것과 같은
 * 규약이라, 이동 해소와 피해 판정이 경계에서 어긋나지 않는다.
 * @param cx 원 중심 x (px)
 * @param cy 원 중심 y (px)
 * @param r 원 반지름 (px)
 * @param bx 박스 중심 x (px)
 * @param by 박스 중심 y (px)
 * @param halfW 박스 반너비 (px)
 * @param halfH 박스 반높이 (px)
 * @returns 겹치면 true
 */
export function circleIntersectsBox(
  cx: number,
  cy: number,
  r: number,
  bx: number,
  by: number,
  halfW: number,
  halfH: number,
): boolean {
  const minX = bx - halfW;
  const maxX = bx + halfW;
  const minY = by - halfH;
  const maxY = by + halfH;
  // 원 중심을 박스 범위로 clamp한 최근접점.
  const nx = cx < minX ? minX : cx > maxX ? maxX : cx;
  const ny = cy < minY ? minY : cy > maxY ? maxY : cy;
  const ddx = cx - nx;
  const ddy = cy - ny;
  return ddx * ddx + ddy * ddy < r * r;
}
