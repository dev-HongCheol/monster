// 장애물(축정렬 사각형) 대 이동 주체(원)의 이동 해소 순수 로직 (건물 충돌 계획 §4.3).
// cc import 없이 평면 좌표·크기만 다뤄 결정적으로 테스트한다. 장애물 목록은 MapManager가
// 씬 노드 바운드에서 로드 시 1회 유도해 보관하고, 이 모듈은 from → to 이동을 그 목록에 대해
// 해소한 최종 위치를 계산하는 순수 함수만 제공한다. 스티어링(어디로 갈지)은 MovementLogic이,
// 해소(갈 수 있는지)는 이 모듈이 맡아 기존 이동 로직·테스트가 전부 그대로 산다.

import type { Vec2 } from './ArenaLogic';

/** 축정렬 장애물 사각형(중심 + 반너비·반높이). MapManager가 씬 노드 바운드에서 유도해 넘긴다. */
export interface ObstacleRect {
  /** 중심 x (아레나 원점 중심 좌표, px) */
  cx: number;
  /** 중심 y (아레나 원점 중심 좌표, px) */
  cy: number;
  /** 반너비(px) */
  halfW: number;
  /** 반높이(px) */
  halfH: number;
}

// 배치 제약(장애물 간격 ≥ 200px ≫ 2×반지름)이 원 하나가 두 장애물에 동시에 닿는 상태를 구조적으로
// 배제하므로 서브스텝당 1패스 해소가 정확하다. 제약이 깨진 데이터(겹치게 배치된 장애물)에서는
// A에서 밀려난 위치가 B에 침투할 수 있어 방어용으로 한 패스만 더 돈다 — 그래도 안 풀리는 배치는
// MapManager의 간격 경고가 이미 소리를 내고 있는 상태다. 수렴까지 반복하는 대신 상한을 둬
// 무한 루프를 원천 차단한다(계획 §7 판단 5).
const MAX_RESOLVE_PASSES = 2;

/**
 * from → to 이동을 장애물에 대해 해소한 최종 위치를 돌려준다.
 * 원(반지름 radius)이 사각형과 겹치면 사각형에 원 중심을 클램프한 최근접점 방향으로 겹친 만큼만
 * 밀어낸다 — 면 앞에서는 그 방향이 면의 수직이라 막힌 축만 소거되고(미끄러짐은 자연 발생), 코너
 * 앞에서는 대각이라 축 진동 없이 모서리를 돈다. 이동 거리가 radius보다 길면 서브스텝(≤ radius)으로
 * 나눠 진행한다 — 판정 지점 사이 간격이 확장 사각형(사각형 + radius 띠)의 최소 두께보다 항상 작아,
 * dt 스파이크로 이동량이 수백 px 튀어도 얇은 장애물을 건너뛰지(터널링) 못한다.
 * 내부 루프는 스칼라 연산만 한다 — 이동 주체 수만큼 매 프레임 불리는 경로다(F36 할당 위생).
 * @param from 현재 위치
 * @param to 이동 후보 위치 (방향 계산 결과)
 * @param radius 이동 주체 충돌 반지름(px). 0 이하·비유한이면 해소 없이 to 반환
 * @param obstacles 장애물 목록 (MapManager.obstacles — 맵 로드 전엔 빈 배열이라 무보정 통과)
 * @returns 해소된 최종 위치 (새 객체 — 입력은 변형하지 않는다)
 */
export function resolveCircleMove(
  from: Vec2,
  to: Vec2,
  radius: number,
  obstacles: readonly ObstacleRect[],
): Vec2 {
  // to가 비유한이면 원위치를 유지한다 — NaN 목적지를 그대로 쓰면 위치가 NaN으로 오염돼
  // 이후 모든 프레임의 이동·충돌·렌더가 함께 무너진다.
  if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return { x: from.x, y: from.y };
  // from이 비유한이면 서브스텝의 출발점이 없다 — 해소를 건너뛰고 이동만 유지한다(유령 충돌 없음).
  if (!Number.isFinite(from.x) || !Number.isFinite(from.y)) return { x: to.x, y: to.y };
  // radius가 0 이하면 침투 판정(거리 < radius)이 성립하지 않고 서브스텝 수(거리/radius)가
  // 발산한다 — 해소 없이 통과시킨다.
  if (!Number.isFinite(radius) || radius <= 0) return { x: to.x, y: to.y };
  if (obstacles.length === 0) return { x: to.x, y: to.y };

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const steps = dist > radius ? Math.ceil(dist / radius) : 1;
  const stepX = dx / steps;
  const stepY = dy / steps;
  const r2 = radius * radius;
  let x = from.x;
  let y = from.y;
  for (let s = 0; s < steps; s++) {
    // 밀어낸 위치에서 남은 서브스텝을 이어가므로, 비스듬한 진입은 막힌 축만 잃고
    // 벽면을 따라 미끄러진다.
    x += stepX;
    y += stepY;
    for (let pass = 0; pass < MAX_RESOLVE_PASSES; pass++) {
      let pushed = false;
      for (let i = 0; i < obstacles.length; i++) {
        const ob = obstacles[i];
        const minX = ob.cx - ob.halfW;
        const maxX = ob.cx + ob.halfW;
        const minY = ob.cy - ob.halfH;
        const maxY = ob.cy + ob.halfH;
        // 사각형에 원 중심을 클램프한 최근접점 — 거리 < radius면 침투
        const nx = x < minX ? minX : x > maxX ? maxX : x;
        const ny = y < minY ? minY : y > maxY ? maxY : y;
        const ddx = x - nx;
        const ddy = y - ny;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 >= r2) continue;
        if (d2 > 0) {
          // 중심이 사각형 밖 — 최근접점에서 중심 방향으로 radius 거리까지 밀어낸다.
          const scale = radius / Math.sqrt(d2);
          x = nx + ddx * scale;
          y = ny + ddy * scale;
        } else {
          // 중심이 사각형 내부(스폰 겹침 등) — 최근접점이 자기 자신이라 밀 방향이 없다.
          // 네 면 중 탈출 거리가 가장 짧은 축으로 밀어낸다.
          const pushRight = maxX + radius - x;
          const pushLeft = x - (minX - radius);
          const pushUp = maxY + radius - y;
          const pushDown = y - (minY - radius);
          let best = pushRight;
          let dir = 0; // 0:+x, 1:-x, 2:+y, 3:-y
          if (pushLeft < best) {
            best = pushLeft;
            dir = 1;
          }
          if (pushUp < best) {
            best = pushUp;
            dir = 2;
          }
          if (pushDown < best) {
            dir = 3;
          }
          if (dir === 0) x = maxX + radius;
          else if (dir === 1) x = minX - radius;
          else if (dir === 2) y = maxY + radius;
          else y = minY - radius;
        }
        pushed = true;
      }
      if (!pushed) break;
    }
  }
  return { x, y };
}
