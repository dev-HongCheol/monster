// 장애물(축정렬 사각형·원) 대 이동 주체(원)의 이동 해소 순수 로직 (건물 충돌 계획 §4.3, 원 계획 §3).
// cc import 없이 평면 좌표·크기만 다뤄 결정적으로 테스트한다. 장애물 목록은 MapManager가
// 씬 노드 바운드에서 로드 시 1회 유도해 보관하고, 이 모듈은 from → to 이동을 그 목록에 대해
// 해소한 최종 위치를 계산하는 순수 함수만 제공한다. 스티어링(어디로 갈지)은 MovementLogic이,
// 해소(갈 수 있는지)는 이 모듈이 맡아 기존 이동 로직·테스트가 전부 그대로 산다.
// 형태는 판별 유니온(Obstacle = ObstacleRect | ObstacleCircle)이라, 밀어내기·우회 스티어링이
// `kind`로 분기한다 — 사각형 경로는 그대로 두고 원 arm만 얹어 갓 안정된 코어를 다시 짜지 않는다.

import type { Vec2 } from './ArenaLogic';

/** 축정렬 장애물 사각형(중심 + 반너비·반높이). MapManager가 씬 노드 바운드에서 유도해 넘긴다. */
export interface ObstacleRect {
  /** 형태 판별자 — 사각형(기본). */
  kind: 'rect';
  /** 중심 x (아레나 원점 중심 좌표, px) */
  cx: number;
  /** 중심 y (아레나 원점 중심 좌표, px) */
  cy: number;
  /** 반너비(px) */
  halfW: number;
  /** 반높이(px) */
  halfH: number;
}

/**
 * 원 장애물(중심 + 반지름). 이동 주체도 원이라 판정이 두 중심 거리 하나로 끝나 사각형보다 싸다 —
 * AABB 감싸기가 대각선 코너에 만들던 `0.41R` 투명벽이 없다. MapManager가 씬 노드의 `CircleObstacle`
 * 마커를 보고 `r = width/2`로 유도해 넘긴다(원 계획 §3.2).
 */
export interface ObstacleCircle {
  /** 형태 판별자 — 원. */
  kind: 'circle';
  /** 중심 x (아레나 원점 중심 좌표, px) */
  cx: number;
  /** 중심 y (아레나 원점 중심 좌표, px) */
  cy: number;
  /** 반지름(px) */
  r: number;
}

/** 볼록 프리미티브 장애물 seam — 밀어내기·우회가 `kind`로 분기한다. 후속 슬라이스에서 OBB·캡슐이 얹힌다. */
export type Obstacle = ObstacleRect | ObstacleCircle;

// 배치 제약(장애물 간격 ≥ 200px ≫ 2×반지름)이 원 하나가 두 장애물에 동시에 닿는 상태를 구조적으로
// 배제하므로 서브스텝당 1패스 해소가 정확하다. 제약이 깨진 데이터(겹치게 배치된 장애물)에서는
// A에서 밀려난 위치가 B에 침투할 수 있어 방어용으로 한 패스만 더 돈다 — 그래도 안 풀리는 배치는
// MapManager의 간격 경고가 이미 소리를 내고 있는 상태다. 수렴까지 반복하는 대신 상한을 둬
// 무한 루프를 원천 차단한다(계획 §7 판단 5).
const MAX_RESOLVE_PASSES = 2;

// 서브스텝 수 상한 — steps = ceil(이동거리/radius)라 병리적 입력(radius 0.001에 이동 수백 px 등)이면
// 한 호출이 수십억 서브스텝을 돌아 프레임이 멎는다. 상한은 이동거리 > 64×radius(실측 반지름 18~40
// 기준 최소 약 1,150px/프레임 — 최고 속도 380px/s로도 dt 3초 이상)부터 물기 시작하고, 그때조차
// 아레나(4800px)의 최대 변위인 대각선(약 6788px)을 한 프레임에 건너도 서브스텝 길이가 6788/64 ≈
// 106px로, 실제 장애물의 확장 두께(최소 변 120px + 2×radius, 최소 반지름 18 기준 156px)보다 얇아
// 관통이 나지 않는다 — 프레임 정지 대신 극단 입력의 관통을 감수한다.
const MAX_SUBSTEPS = 64;

/** 장애물 없음 폴백(공유 불변 빈 배열) — 소비처가 매 호출 새 배열을 할당하지 않게 한다(F36). */
export const NO_OBSTACLES: readonly Obstacle[] = [];

// 우회 스티어링의 경계 허용오차(px). 두 판정에 서로 반대 방향으로 쓴다.
// ① 막힘 판정 — 확장 사각형을 이만큼 **줄여서** 본다. 벽에 붙어 선 적은 확장 사각형 경계에
//    정확히 안착해 있어, 거기서 목표로 긋는 직선이 경계를 스친다. 그 스침을 막힘으로 세면
//    코너를 다 돌고도 우회가 안 풀려 적이 코너에 붙어 맴돈다.
// ② 경유점 가시성 — 이만큼 **늘려서** 본다. 밀어내기가 안착시킨 좌표는 나눗셈·제곱근을 거쳐
//    경계를 부동소수 오차만큼 넘나든다(±1e-13 규모). 엄격 비교면 그 순간 네 코너가 통째로
//    안 보이는 것으로 판정돼 우회를 포기하고, 적이 다시 벽 앞에 굳는다.
// 게임 좌표는 px 단위 수백~수천이라 1e-3은 눈에 보이지 않으면서 부동소수 잡음보다 10자리 크다.
const STEER_EPS = 1e-3;

/**
 * 선분이 축정렬 사각형에 처음 들어가는 지점의 파라미터 t(0~1)를 돌려준다. 만나지 않으면 -1.
 * 슬랩(slab) 판정 — 축마다 선분이 사각형 범위 안에 있는 t 구간을 구해 교집합을 낸다. 교집합이
 * 비면 못 만나고, 비지 않으면 그 시작점이 진입 지점이다. 선분이 사각형 안에서 시작하면 0.
 */
function segmentRectEntry(
  px: number,
  py: number,
  qx: number,
  qy: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): number {
  const dx = qx - px;
  const dy = qy - py;
  let tmin = 0;
  let tmax = 1;
  // 축에 평행한 성분(d≈0)은 나눗셈이 ±Infinity로 새므로 "그 축 범위 안에 있나"만 본다.
  if (Math.abs(dx) < 1e-12) {
    if (px < minX || px > maxX) return -1;
  } else {
    let t1 = (minX - px) / dx;
    let t2 = (maxX - px) / dx;
    if (t1 > t2) {
      const t = t1;
      t1 = t2;
      t2 = t;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-12) {
    if (py < minY || py > maxY) return -1;
  } else {
    let t1 = (minY - py) / dy;
    let t2 = (maxY - py) / dy;
    if (t1 > t2) {
      const t = t1;
      t1 = t2;
      t2 = t;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  return tmin;
}

/**
 * 선분 P→Q가 원(중심 c, 반지름 radius)에 처음 들어가는 지점의 파라미터 t(0~1)를 돌려준다.
 * 만나지 않으면 -1. 시작점이 이미 원 안이면 0. `|P + t·(Q−P) − C|² = radius²`의 근 중 작은 쪽(첫
 * 진입)을 t로 쓴다 — 우회 대상 원(블로커)을 고를 때 사각형의 `segmentRectEntry`와 같은 역할이다.
 */
function segmentCircleEntry(
  px: number,
  py: number,
  qx: number,
  qy: number,
  cx: number,
  cy: number,
  radius: number,
): number {
  const dx = qx - px;
  const dy = qy - py;
  const fx = px - cx;
  const fy = py - cy;
  const a = dx * dx + dy * dy;
  const c = fx * fx + fy * fy - radius * radius;
  // 시작점이 원 안(c ≤ 0)이면 진입은 t=0이다 — 퇴화 선분(P==Q)도 이 검사로 함께 걸린다.
  if (c <= 0) return 0;
  if (a === 0) return -1; // P==Q인데 밖 — 절대 안 들어간다
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1; // 선분 직선이 원을 스치지도 않는다
  const t1 = (-b - Math.sqrt(disc)) / (2 * a); // 작은 근 = 첫 진입
  // c > 0(밖에서 출발)이라 t1 < 0은 불가능하다. t1 > 1이면 원이 선분 끝 너머라 이 이동으로는 못 닿는다.
  return t1 <= 1 ? t1 : -1;
}

// 확장 사각형의 코너 색인은 반시계(CCW) 순서다 — 0:좌하 1:우하 2:우상 3:좌상.
// 이 순서 덕에 인접 코너가 (i±1) mod 4로 나온다(사슬 탐색이 쓰는 성질).

/** 코너 i의 x 좌표. */
function cornerX(i: number, minX: number, maxX: number): number {
  return i === 1 || i === 2 ? maxX : minX;
}

/** 코너 i의 y 좌표. */
function cornerY(i: number, minY: number, maxY: number): number {
  return i >= 2 ? maxY : minY;
}

/**
 * 점 (px,py)에서 확장 사각형의 코너 i가 보이는지 — 그 점에서 코너로 그은 선분이 사각형 내부를
 * 지나지 않는지. 축정렬 사각형에서는 "점이 그 코너를 이루는 두 변 중 **하나라도** 바깥쪽
 * 반평면에 있으면 보인다"가 정확한 판정이다. 예컨대 점이 왼면 바깥(px ≤ minX)이면 좌상·좌하
 * 코너로 가는 선분은 x가 minX를 넘지 않은 채 유지되므로 내부(x > minX)에 못 들어간다.
 * 경계 허용오차는 STEER_EPS ①②의 ② — 안착 좌표의 부동소수 오차를 흡수한다.
 */
function cornerVisible(
  i: number,
  px: number,
  py: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  switch (i) {
    case 0:
      return px <= minX + STEER_EPS || py <= minY + STEER_EPS;
    case 1:
      return px >= maxX - STEER_EPS || py <= minY + STEER_EPS;
    case 2:
      return px >= maxX - STEER_EPS || py >= maxY - STEER_EPS;
    default:
      return px <= minX + STEER_EPS || py >= maxY - STEER_EPS;
  }
}

/**
 * 원 블로커(확장원 = 원 + 이동 주체 반지름)를 우회하는 첫 방향을 돌려준다 — `steerAroundObstacles`가
 * 블로커가 원일 때 위임하는 접선 조준 분기. 사각형의 코너 사슬과 목적은 같고(정면 진입 변위 0 정지와
 * 목표-확장형태-삼킴 순환을 둘 다 막는다) 형태 계산만 다르다.
 *
 * **접선 조준.** `from`에서 확장원에 그은 두 접선의 방향은 중심 방향 `u`를 ±α로 회전한 것이다
 * (sin α = 확장반지름 / 중심거리). 둘 중 `desiredDir`과 더 나란한 쪽(작은 헤딩 변화 = 대개 짧은 우회)을
 * 고르고, 정면 대칭이라 사실상 동률이면 진행 방향 90° CCW 쪽으로 고정한다(사각형 코너 타이브레이크와
 * 같은 chirality — 안 고정하면 매 프레임 좌우가 뒤집혀 떤다).
 *
 * **목표가 확장원 안(엄폐 대치).** 적 반지름이 플레이어 반지름을 넘어(12종 중 9종) 벽에 붙은
 * 플레이어가 확장원에 삼켜지면 어느 접선에서도 목표가 안 보인다. 목표를 확장원 경계의 방사 최근접점으로
 * 끌어내 방향만 얻되, **끌어낸 목표로 막힘을 재판정한다** — 원래 목표가 확장원 안이면 거기로 긋는
 * 선분이 그 안에서 끝나 어느 위치에서도 "막혔다"가 나오고, 우회가 안 풀려 바로 옆인데도 옆으로 새거나
 * 접선점을 지나는 순간 방향이 180° 뒤집히는 극한 순환(사각형에서 난 C-1의 원 판)에 빠진다.
 *
 * **`from`이 확장원 안**이면 접선이 없다(방향 없음) — 우회를 접고 밀어내기 해소의 방사 탈출에 맡긴다
 * (사각형에서 "보이는 코너 없음"과 같은 처리). 밀어내기가 방사라 접선 성분이 남아 몇 프레임 안에
 * 표면으로 표류해 나가고, 도달 스윕이 이 구간을 전수로 지난다.
 */
function steerAroundCircle(
  from: Vec2,
  target: Vec2,
  desiredDir: Vec2,
  radius: number,
  blocker: ObstacleCircle,
): Vec2 {
  const rExp = blocker.r + radius;
  const rExp2 = rExp * rExp;
  const ax = from.x - blocker.cx;
  const ay = from.y - blocker.cy;
  const da2 = ax * ax + ay * ay;
  // from이 확장원 안(경계 포함) — 접선이 퇴화한다. 밀어내기 방사 탈출에 맡긴다.
  if (da2 <= rExp2) return desiredDir;

  // 목표가 확장원 안이면 경계로 끌어내고, 끌어낸 목표로 막힘을 재판정한다(C-1 순환 차단).
  let gx = target.x;
  let gy = target.y;
  const tx = target.x - blocker.cx;
  const ty = target.y - blocker.cy;
  const dt2 = tx * tx + ty * ty;
  if (dt2 < rExp2) {
    const dtl = Math.sqrt(dt2);
    if (dtl > 0) {
      gx = blocker.cx + (tx / dtl) * rExp;
      gy = blocker.cy + (ty / dtl) * rExp;
    } else {
      // 목표가 원 중심과 정확히 겹침 — 경계점을 임의(+x)로 잡는다.
      gx = blocker.cx + rExp;
      gy = blocker.cy;
    }
    if (segmentCircleEntry(from.x, from.y, gx, gy, blocker.cx, blocker.cy, rExp - STEER_EPS) < 0) {
      return desiredDir;
    }
  }

  // 접선 방향 = 중심 방향 u를 ±α 회전. u는 단위라 회전 결과도 단위(재정규화 불필요).
  const d = Math.sqrt(da2);
  const ux = -ax / d; // from → 중심 단위 벡터
  const uy = -ay / d;
  const sinA = rExp / d; // d > rExp이라 sinA < 1
  const cosA = Math.sqrt(Math.max(0, 1 - sinA * sinA));
  const dirPx = ux * cosA - uy * sinA; // +α (CCW) 회전
  const dirPy = ux * sinA + uy * cosA;
  const dirMx = ux * cosA + uy * sinA; // −α (CW) 회전
  const dirMy = -ux * sinA + uy * cosA;

  const dotP = dirPx * desiredDir.x + dirPy * desiredDir.y;
  const dotM = dirMx * desiredDir.x + dirMy * desiredDir.y;
  let chooseP: boolean;
  if (Math.abs(dotP - dotM) > STEER_EPS) {
    chooseP = dotP > dotM; // desiredDir과 더 나란한 쪽(작은 헤딩 변화)
  } else {
    // 정면 대칭 동률 — 진행 방향 90° CCW(perp) 쪽으로 고정한다.
    const perpX = -desiredDir.y;
    const perpY = desiredDir.x;
    chooseP = dirPx * perpX + dirPy * perpY > dirMx * perpX + dirMy * perpY;
  }
  return chooseP ? { x: dirPx, y: dirPy } : { x: dirMx, y: dirMy };
}

/**
 * 목표로 가는 직선이 장애물에 막혀 있으면, 그 장애물을 우회하는 최단 경로의 **첫 경유점**을
 * 겨누는 방향으로 바꿔 돌려준다. 막히지 않으면 `desiredDir`을 그대로 돌려준다.
 *
 * **왜 필요한가.** `resolveCircleMove`는 밀어내기라 속도의 법선 성분만 지우고 접선 성분은 남긴다.
 * 즉 실제 변위가 `speed·sin(θ)`(θ=진행 방향과 벽면 법선의 각)로 줄고, 정면 진입(θ=0)이면 정확히
 * 0이 된다. 스티어링이 장애물을 모르면 다음 프레임도 같은 정면 방향이라 적이 영영 멈춘다. 게다가
 * 남는 접선 성분은 적을 **정면 지점 쪽으로** 미끄러뜨리므로 θ가 계속 작아진다 — 비스듬히 들어온
 * 적까지 정지점으로 빨려든다(정지점이 끌개). 해소만으로는 못 푸는 이유이고, 스티어링을 바꿔야
 * 하는 이유다. 어긋나면 증상은 "건물 뒤 플레이어를 향해 적이 벽에 붙은 채 굳음"이다.
 *
 * **경로 척도.** 볼록 사각형을 피하는 최단 경로는 확장 사각형의 코너를 경유하는 둘레 사슬이고,
 * 짧은 쪽 사슬은 코너를 2개 넘게 지나지 않는다(3개를 도는 것은 반대로 1개를 도는 것보다 언제나
 * 길다). 그래서 "보이는 첫 코너 + 필요하면 이웃 코너 하나"만 훑으면 최단이 나온다. 비용이
 * 위치만의 함수라 잠금 없이도 **이력(hysteresis)이 없다** — "현재 위치에서 가장 가까운 코너"로
 * 고르는 대안은 첫 다리가 0에 수렴해 방금 지난 코너가 항상 제일 싸 보이므로 되돌아간다.
 *
 * **다만 이력이 없다고 순환이 없는 것은 아니다.** 비용장이 단일값이어도 거기서 뽑아낸 *첫
 * 경유점* 사상은 코너에서 불연속이고, 그 불연속을 사이에 두고 방향이 뒤집힐 수 있다 — 첫 다리
 * 길이가 0에 수렴해도 정규화하면 방향은 full 크기라 미세한 위치 차가 180° 반전으로 증폭된다.
 * 두 프레임이 서로를 되돌리면 잠금이 없어도 극한 순환(limit cycle)이다. 그래서 불연속은 가정으로
 * 지우지 말고 **명시적으로 처리해야 한다** — 아래 목표 클램프 뒤의 재판정이 그 처리다. 실제로
 * 이 구분을 놓쳐 C-1이 났다(코드리뷰 2026-07-17).
 *
 * 위 경로 척도·불연속 논의는 **사각형 arm**(코너 사슬)을 설명한다. 블로커가 원이면 `steerAroundCircle`로
 * 위임한다 — 접선점 조준이지만 불연속을 명시 처리해야 하는 성질(C-1)은 똑같다.
 *
 * @param from 현재 위치
 * @param target 가려는 목표 위치(적 → 플레이어)
 * @param desiredDir 장애물을 모르는 원래 진행 방향(단위 벡터, `MovementLogic` 산출)
 * @param radius 이동 주체 충돌 반지름(px). 0 이하·비유한이면 우회 없음
 * @param obstacles 장애물 목록 (MapManager.obstacles — 사각형·원 혼합)
 * @returns 우회가 필요하면 새 단위 방향, 아니면 `desiredDir` **그 참조 그대로**(무할당 — F36)
 */
export function steerAroundObstacles(
  from: Vec2,
  target: Vec2,
  desiredDir: Vec2,
  radius: number,
  obstacles: readonly Obstacle[],
): Vec2 {
  if (obstacles.length === 0) return desiredDir;
  if (!Number.isFinite(radius) || radius <= 0) return desiredDir;
  if (!Number.isFinite(from.x) || !Number.isFinite(from.y)) return desiredDir;
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return desiredDir;
  if (!Number.isFinite(desiredDir.x) || !Number.isFinite(desiredDir.y)) return desiredDir;
  // 영벡터는 상위 스티어링의 "이동 안 함" 신호다(겹침·유격 데드존) — 방향을 만들어 주면 안 된다.
  if (desiredDir.x === 0 && desiredDir.y === 0) return desiredDir;
  // 목표에서 멀어지는 이동(유격 후퇴)은 도착점이 목표가 아니라 코너 우회의 거리 척도가 성립하지
  // 않는다 — 손대지 않고, 후퇴가 벽에 막히는 것은 밀어내기 해소에 맡긴다.
  const toTargetX = target.x - from.x;
  const toTargetY = target.y - from.y;
  if (desiredDir.x * toTargetX + desiredDir.y * toTargetY <= 0) return desiredDir;

  // 목표까지의 직선을 가장 먼저 막는 장애물을 고른다 — 가까운 것부터 풀어야 우회가 국소적으로 맞는다.
  // 확장 형태(원래 형태 + 이동 주체 반지름)에 대한 진입 파라미터를 형태별로 구한다. STEER_EPS만큼
  // 줄여 보는 것은 막힘 판정의 ①(벽에 붙어 선 적의 스침을 막힘으로 세지 않기)과 같은 취지다.
  let blocker: Obstacle | null = null;
  let bestEntry = Number.POSITIVE_INFINITY;
  for (let i = 0; i < obstacles.length; i++) {
    const ob = obstacles[i];
    let t: number;
    if (ob.kind === 'circle') {
      const rr = ob.r + radius - STEER_EPS;
      if (rr <= 0) continue; // 확장해도 반지름이 없다 — 막을 수 없다
      t = segmentCircleEntry(from.x, from.y, target.x, target.y, ob.cx, ob.cy, rr);
    } else {
      const hw = ob.halfW + radius - STEER_EPS;
      const hh = ob.halfH + radius - STEER_EPS;
      if (hw <= 0 || hh <= 0) continue; // 확장해도 두께가 없다 — 막을 수 없다
      t = segmentRectEntry(
        from.x,
        from.y,
        target.x,
        target.y,
        ob.cx - hw,
        ob.cy - hh,
        ob.cx + hw,
        ob.cy + hh,
      );
    }
    if (t >= 0 && t < bestEntry) {
      bestEntry = t;
      blocker = ob;
    }
  }
  if (!blocker) return desiredDir;

  // 원 블로커는 접선 조준으로 위임한다 — 이 뒤로는 blocker가 사각형으로 좁혀진다.
  if (blocker.kind === 'circle') {
    return steerAroundCircle(from, target, desiredDir, radius, blocker);
  }

  const minX = blocker.cx - blocker.halfW - radius;
  const maxX = blocker.cx + blocker.halfW + radius;
  const minY = blocker.cy - blocker.halfH - radius;
  const maxY = blocker.cy + blocker.halfH + radius;

  // 목표가 확장 사각형 **안**이면(적 반지름 > 플레이어 반지름이라, 벽에 붙은 플레이어를 적의 확장
  // 사각형이 삼킨 경우 — 12종 중 9종이 플레이어의 25를 넘는다) 어느 코너에서도 목표가 안 보여
  // 사슬이 전멸한다. 그러면 우회를 포기해 엄폐 중인 플레이어 반대편에서 적이 굳는다. 목표를 확장
  // 사각형 경계의 최근접점으로 끌어내 "어느 쪽으로 돌지"만 얻는다 — 근사지만 방향은 옳다.
  let gx = target.x;
  let gy = target.y;
  const goalInside = gx > minX && gx < maxX && gy > minY && gy < maxY;
  if (goalInside) {
    const dLeft = gx - minX;
    const dRight = maxX - gx;
    const dDown = gy - minY;
    const dUp = maxY - gy;
    let best = dLeft;
    let side = 0; // 0:왼면, 1:오른면, 2:아랫면, 3:윗면
    if (dRight < best) {
      best = dRight;
      side = 1;
    }
    if (dDown < best) {
      best = dDown;
      side = 2;
    }
    if (dUp < best) {
      side = 3;
    }
    if (side === 0) gx = minX;
    else if (side === 1) gx = maxX;
    else if (side === 2) gy = minY;
    else gy = maxY;

    // 막힘 판정은 **원래** 목표로 했는데 사슬은 **끌어낸** 목표로 돈다 — 목표를 끌어냈다면 그
    // 판정을 끌어낸 목표로 다시 해야 한다. 원래 목표가 확장 사각형 안이면 거기로 긋는 선분은
    // 그 안에서 끝나므로 **어느 위치에서 재도 "막혔다"가 나온다**. 그러면 우회가 영영 안 풀려,
    // ① 플레이어 바로 옆(사이에 아무것도 없음)에서도 옆으로 새고 ② 코너에 도달한 적이 코너를
    // 0.01px 지나는 순간 방금 지난 코너가 첫 다리 0.01로 제일 싸 보여 되돌아간다 — 첫 다리가
    // 0에 수렴해도 정규화하면 방향은 full 크기라, 그 미세한 차이가 180° 반전으로 증폭돼 두
    // 프레임이 서로를 되돌리는 극한 순환에 빠진다(코드리뷰 C-1: 반지름 25 초과 9종이 벽에 붙은
    // 플레이어를 접근각 30%에서 영영 못 잡았다).
    const hw = blocker.halfW + radius - STEER_EPS;
    const hh = blocker.halfH + radius - STEER_EPS;
    if (
      segmentRectEntry(
        from.x,
        from.y,
        gx,
        gy,
        blocker.cx - hw,
        blocker.cy - hh,
        blocker.cx + hw,
        blocker.cy + hh,
      ) < 0
    ) {
      return desiredDir;
    }
  }

  // 좌우 동률(정면 일직선)에서 부호가 뜬다 — 고정하지 않으면 매 프레임 뒤집혀 적이 제자리에서
  // 떤다. 진행 방향의 90° CCW를 기준으로 고정한다(zigzagDirection의 perp 규약과 같은 chirality).
  const perpX = -desiredDir.y;
  const perpY = desiredDir.x;

  let bestCost = Number.POSITIVE_INFINITY;
  let bestSide = Number.NEGATIVE_INFINITY;
  let bestLegX = 0;
  let bestLegY = 0;
  let found = false;
  for (let i = 0; i < 4; i++) {
    if (!cornerVisible(i, from.x, from.y, minX, minY, maxX, maxY)) continue;
    const cix = cornerX(i, minX, maxX);
    const ciy = cornerY(i, minY, maxY);
    const legX = cix - from.x;
    const legY = ciy - from.y;
    const leg1 = Math.hypot(legX, legY);
    // 이미 그 코너 위면 겨눌 방향이 없다(영벡터). 건너뛰어도 경로를 잃지 않는다 — 이웃 코너를
    // 첫 경유점으로 삼는 사슬이 같은 경로를 같은 비용으로 이미 담고 있다.
    if (leg1 <= STEER_EPS) continue;
    // 이 코너를 첫 경유점으로 하는 최단 사슬의 비용: 목표가 곧장 보이면 코너 하나로 끝나고,
    // 아니면 이웃 코너(둘레를 따라 좌·우) 하나를 더 거친다.
    let cost = Number.POSITIVE_INFINITY;
    if (cornerVisible(i, gx, gy, minX, minY, maxX, maxY)) {
      cost = leg1 + Math.hypot(gx - cix, gy - ciy);
    }
    for (let k = 0; k < 2; k++) {
      const j = k === 0 ? (i + 1) % 4 : (i + 3) % 4;
      if (!cornerVisible(j, gx, gy, minX, minY, maxX, maxY)) continue;
      const cjx = cornerX(j, minX, maxX);
      const cjy = cornerY(j, minY, maxY);
      const c = leg1 + Math.hypot(cjx - cix, cjy - ciy) + Math.hypot(gx - cjx, gy - cjy);
      if (c < cost) cost = c;
    }
    if (cost === Number.POSITIVE_INFINITY) continue;
    const side = legX * perpX + legY * perpY;
    // 비용이 뚜렷이 낮으면 교체, 사실상 동률이면 CCW 쪽(side가 큰 쪽)으로 교체한다.
    if (cost < bestCost - STEER_EPS || (cost <= bestCost + STEER_EPS && side > bestSide)) {
      // bestCost는 채택한 값이 아니라 **지금까지의 최솟값**에 붙들어 둔다(그래서 `= cost`가
      // 아니다). 동률 분기로 조금 더 비싼 후보를 채택할 때 기준까지 끌어올리면, 그다음 후보가
      // 또 EPS 안이라 채택되는 식으로 기준이 계단처럼 밀려 올라가 결국 EPS를 훌쩍 넘는 후보까지
      // 동률로 통과한다. 최솟값에 고정하면 동률 판정이 언제나 진짜 최솟값 대비로 남는다.
      if (cost < bestCost) bestCost = cost;
      bestSide = side;
      bestLegX = legX;
      bestLegY = legY;
      found = true;
    }
  }
  // 보이는 코너가 하나도 없다 = 적이 확장 사각형 안에 있다. 스폰 겹침만이 아니라 **코너를 도는
  // 동안 매번** 지나는 상태다 — 확장 사각형은 진짜 Minkowski 합(모서리가 둥근 꼴)이 아니라 그것을
  // 감싼 사각형이라, 코너마다 반지름×반지름짜리 여유 구역이 남는다. 밀어내기는 적을 진짜 사각형
  // 코너에서 radius 거리에 세우므로 적은 그 구역 안(확장 사각형 경계에서 최대 0.41×radius 안쪽)에
  // 들어가고, 그동안 우회는 꺼진 채 순수 추격 + 밀어내기로만 움직인다. 그래도 갇히지 않는 이유는
  // 코너 밀어내기가 방사 방향이라 접선 성분이 항상 남고, 그 표류가 몇 프레임 안에 적을 면 접선
  // 위치로 밀어내 가시성이 돌아오기 때문이다(도달 스윕이 이 구간을 전수로 지난다). 이 성질이
  // 깨지면 증상은 "적이 코너 호를 도는 중에 멎음"이다. 억지 우회 대신 최근접 면 탈출에 맡긴다.
  if (!found) return desiredDir;
  const len = Math.hypot(bestLegX, bestLegY);
  if (len === 0) return desiredDir;
  return { x: bestLegX / len, y: bestLegY / len };
}

/**
 * from → to 이동을 장애물에 대해 해소한 최종 위치를 돌려준다.
 * 사각형은 원 중심을 사각형에 클램프한 최근접점 방향으로 겹친 만큼만 밀어낸다 — 면 앞에서는 그
 * 방향이 면의 수직이라 막힌 축만 소거되고(미끄러짐은 자연 발생), 코너 앞에서는 대각이라 축 진동
 * 없이 모서리를 돈다. 원은 더 단순해 중심선(두 중심을 잇는 선) 방향으로 두 반지름 합까지 밀어낸다
 * — 내부 면 선택이 없다. 이동 거리가 radius보다 길면 서브스텝(≤ radius)으로 나눠 진행한다 — 판정
 * 지점 사이 간격이 확장 형태(형태 + radius 띠)의 최소 두께보다 항상 작아, dt 스파이크로 이동량이
 * 수백 px 튀어도 얇은 장애물을 건너뛰지(터널링) 못한다.
 * 내부 루프는 스칼라 연산만 한다 — 이동 주체 수만큼 매 프레임 불리는 경로다(F36 할당 위생).
 * @param from 현재 위치
 * @param to 이동 후보 위치 (방향 계산 결과)
 * @param radius 이동 주체 충돌 반지름(px). 0 이하·비유한이면 해소 없이 to 반환
 * @param obstacles 장애물 목록 (MapManager.obstacles — 사각형·원 혼합, 맵 로드 전엔 빈 배열이라 무보정 통과)
 * @returns 해소된 최종 위치 (새 객체 — 입력은 변형하지 않는다)
 */
export function resolveCircleMove(
  from: Vec2,
  to: Vec2,
  radius: number,
  obstacles: readonly Obstacle[],
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
  const steps = dist > radius ? Math.min(Math.ceil(dist / radius), MAX_SUBSTEPS) : 1;
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
        if (ob.kind === 'circle') {
          // 원은 중심선 방사 밀어내기 — 두 중심 거리가 두 반지름 합(rr)보다 작으면 침투다.
          const ddx = x - ob.cx;
          const ddy = y - ob.cy;
          const d2 = ddx * ddx + ddy * ddy;
          const rr = ob.r + radius;
          if (d2 >= rr * rr) continue;
          if (d2 > 0) {
            const scale = rr / Math.sqrt(d2);
            x = ob.cx + ddx * scale;
            y = ob.cy + ddy * scale;
          } else {
            // 이동 주체 중심이 원 중심과 정확히 겹침 — 방향이 없어 임의 축(+x)으로 rr만큼 민다.
            x = ob.cx + rr;
            y = ob.cy;
          }
          pushed = true;
          continue;
        }
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
