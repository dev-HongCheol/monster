import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../game/assets/scripts/logic/ArenaLogic';
import {
  type Obstacle,
  type ObstacleCircle,
  type ObstacleRect,
  resolveCircleMove,
  steerAroundObstacles,
} from '../../game/assets/scripts/logic/ObstacleLogic';

/**
 * 원(circle) 장애물의 순수 해소·우회 로직 (2026-07-20-circle-obstacle-plan.md §3).
 *
 * 이동 주체는 이미 원(반지름 radius)이라, 원 대 원 판정은 두 중심 거리가 두 반지름 합보다
 * 작으면 중심선을 따라 밀어내는 한 줄이다 — 사각형처럼 축별 클램프·내부 면 선택이 없다.
 * seam은 판별 유니온(ObstacleRect | ObstacleCircle)이고, 이 파일은 그 원 arm의 밀어내기와
 * 접선 우회 스티어링을 검증한다. 사각형 회귀는 BuildingCollision.test.ts가 계속 지킨다.
 *
 * 형태 판별(씬 노드에 붙인 CircleObstacle 마커 → r=width/2 유도)과 색인 방어(F50 비유한 스킵·
 * F55 최소 지름 경고)는 cc 프레임워크 의존이라 여기서 다루지 않는다(7단계 수동 QA).
 */

/** 원점 중심 반지름 100 원(돔). 확장원(이동 주체 반지름 20 더함) 반지름 = 120. */
const DOME: ObstacleCircle = { kind: 'circle', cx: 0, cy: 0, r: 100 };

/** 이동 주체 반지름(px) — 플레이어·적 충돌 반지름(25 근방)과 같은 자릿수. */
const R = 20;

/** 밀어내기 후 이동 주체 중심이 원 중심에서 떨어지는 거리 = r + radius. */
const PUSH = DOME.r + R; // 120

/** 깊은 복제 — 함수 호출이 입력을 변형하지 않는지 비교할 스냅샷을 만든다. */
function snapshot<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

describe('resolveCircleMove — 원 해소', () => {
  it('원 정면 진입 — 표면에서 (r + radius)만큼 떨어져 멈춘다', () => {
    // (0,110)은 중심에서 110 — 확장 반지름 120 미만 침투라 +y 방사로 (0,120)까지 밀린다
    const out = resolveCircleMove({ x: 0, y: 130 }, { x: 0, y: 110 }, R, [DOME]);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(PUSH);
  });

  it('원 비스듬 진입 — 중심선 방사로 확장원 표면까지 밀린다(축 스냅 아님)', () => {
    // 목적지 (14,116)은 중심에서 약 116.8 — 방사로 밀면 중심선을 따라 정확히 120에 안착한다.
    // 축 스냅이면 한 축만 밀려 표면 거리가 120을 벗어나므로 hypot 검증이 깨진다.
    const out = resolveCircleMove({ x: 0, y: 130 }, { x: 14, y: 116 }, R, [DOME]);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(PUSH);
    expect(out.x).toBeGreaterThan(0);
    expect(out.y).toBeGreaterThan(0);
  });

  it('from이 원 내부(스폰 겹침)면 방사 방향으로 표면 밖으로 밀어낸다', () => {
    // (30,0)은 내부(중심에서 30) — +x 방사로 x = r + radius
    const out = resolveCircleMove({ x: 30, y: 0 }, { x: 30, y: 0 }, R, [DOME]);
    expect(out.x).toBeCloseTo(PUSH);
    expect(out.y).toBeCloseTo(0);
  });

  it('이동 주체 중심이 원 중심과 정확히 겹치면(d²=0) 임의 축으로 탈출한다(NaN 없음)', () => {
    // 방향이 없어 방사 밀어내기가 0/0이 된다 — 임의 축(+x)으로 (r + radius)만큼 민다
    const out = resolveCircleMove({ x: 0, y: 0 }, { x: 0, y: 0 }, R, [DOME]);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.y)).toBe(true);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(PUSH);
  });

  it('작은 원 고속 이동이 관통하지 않는다(터널링 방지)', () => {
    // 반지름 10 원을 한 프레임에 400px 이동으로 가로지르려 하면, 스텝 분할이 없으면 목적지가
    // 원 밖이라 그대로 통과한다. 분할이 있으면 왼쪽 표면(x = -(10 + radius))에서 막힌다.
    const small: ObstacleCircle = { kind: 'circle', cx: 0, cy: 0, r: 10 };
    const out = resolveCircleMove({ x: -200, y: 0 }, { x: 200, y: 0 }, R, [small]);
    expect(out.x).toBeCloseTo(-(10 + R));
    expect(out.y).toBeCloseTo(0);
  });

  it('해소된 위치를 같은 인자로 다시 해소하면 그대로다(재해소 무변화)', () => {
    // 어기면 원 표면에 붙어 선 매 프레임 위치가 미세하게 튀는 진동이 생긴다
    const settled = resolveCircleMove({ x: 0, y: 130 }, { x: 0, y: 110 }, R, [DOME]);
    const again = resolveCircleMove(settled, settled, R, [DOME]);
    expect(again.x).toBeCloseTo(settled.x);
    expect(again.y).toBeCloseTo(settled.y);
  });

  it('rect·circle 혼합 배열에서 원만 해소하고 사각형은 무관하게 통과한다', () => {
    // 원(원점)에는 정면 진입해 밀리고, 사각형(멀리 x=300)은 경로에 없어 영향이 없다
    const rect: ObstacleRect = { kind: 'rect', cx: 300, cy: 0, halfW: 50, halfH: 50 };
    const mixed: Obstacle[] = [rect, DOME];
    const out = resolveCircleMove({ x: 0, y: 130 }, { x: 0, y: 110 }, R, mixed);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(PUSH);
  });
});

describe('resolveCircleMove — 원 입력 방어·불변', () => {
  it('to 좌표가 NaN이면 원위치(from)를 돌려준다', () => {
    const out = resolveCircleMove({ x: 0, y: 130 }, { x: Number.NaN, y: 110 }, R, [DOME]);
    expect(out.x).toBe(0);
    expect(out.y).toBe(130);
  });

  it('입력(from·to·obstacles)을 변형하지 않는다(F36 할당 위생 계약)', () => {
    const from = { x: 0, y: 130 };
    const to = { x: 14, y: 116 };
    const obstacles: Obstacle[] = [{ ...DOME }];
    const snaps = [snapshot(from), snapshot(to), snapshot(obstacles)];
    resolveCircleMove(from, to, R, obstacles);
    expect([from, to, obstacles]).toEqual(snaps);
  });
});

/**
 * `steerAroundObstacles` — 원 접선 우회.
 *
 * DOME(반지름 100)을 이동 주체 반지름 20으로 확장한 확장원은 반지름 120이고, from에서 그 원에
 * 그은 두 접선의 접점이 우회 경유점이다. 정면 진입은 변위가 0이 되는 정지 회귀라 이 스티어링이
 * 접선을 겨눠 접선 성분을 살려야 한다(BuildingCollision.test.ts의 사각형 판과 같은 구조).
 */

/** 플레이어를 향하는 단위 방향 — 우회 없는 순수 추격 스티어링. */
function chaseDir(from: Vec2, target: Vec2): Vec2 {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const len = Math.hypot(dx, dy);
  return len === 0 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}

describe('steerAroundObstacles — 원 우회 발동 조건', () => {
  it('원이 직선 경로를 막지 않으면 원하는 방향을 그대로 돌려준다', () => {
    // 적·플레이어 모두 원 오른쪽(x≥200)을 지난다 — 확장원(반지름 120)에 못 닿아 우회할 이유가 없다
    const dir = { x: 1, y: 0 };
    const out = steerAroundObstacles({ x: 200, y: 0 }, { x: 300, y: 0 }, dir, R, [DOME]);
    expect(out).toBe(dir); // 같은 참조 — 막히지 않으면 할당하지 않는다(F36)
  });

  it('목표에서 멀어지는 이동(유격 후퇴)은 우회하지 않는다', () => {
    const dir = { x: -1, y: 0 };
    const out = steerAroundObstacles({ x: -300, y: 0 }, { x: 300, y: 0 }, dir, R, [DOME]);
    expect(out).toBe(dir);
  });

  it('적이 원 내부(스폰 겹침)면 우회하지 않는다 — 탈출은 밀어내기 해소가 맡는다', () => {
    const dir = { x: 1, y: 0 };
    const out = steerAroundObstacles({ x: 0, y: 0 }, { x: 300, y: 0 }, dir, R, [DOME]);
    expect(out).toBe(dir);
  });
});

describe('steerAroundObstacles — 원 접선 경로', () => {
  it('정면 일직선(적-원-플레이어)에서 접선 쪽으로 방향을 튼다 — 제자리 정지 회귀', () => {
    // 순수 밀어내기는 정면 진입에서 변위가 정확히 0이라 적이 영영 멈춘다. 접선을 겨눠야 살아난다.
    const from = { x: -300, y: 0 };
    const target = { x: 300, y: 0 };
    const out = steerAroundObstacles(from, target, chaseDir(from, target), R, [DOME]);
    expect(Math.abs(out.y)).toBeGreaterThan(0.1); // 정면 그대로(y=0)면 갇힌다
    expect(out.x).toBeGreaterThan(0); // 전진 유지 — 뒤로 물러나지 않는다
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1); // 단위 벡터 계약
  });

  it('정면 일직선의 좌우 동률은 진행 방향 90° CCW 쪽으로 고정한다', () => {
    // 위·아래 접선 우회가 정확히 같아 부호가 뜬다 — +x 진행의 90° CCW는 +y로 고정한다
    const from = { x: -300, y: 0 };
    const target = { x: 300, y: 0 };
    const out = steerAroundObstacles(from, target, chaseDir(from, target), R, [DOME]);
    expect(out.y).toBeGreaterThan(0);
  });

  it('동률이 아니면 가까운 쪽 접선으로 우회한다 (위/아래 대칭)', () => {
    const target = { x: 300, y: 0 };
    const upper = { x: -300, y: 60 };
    const outUp = steerAroundObstacles(upper, target, chaseDir(upper, target), R, [DOME]);
    expect(outUp.y).toBeGreaterThan(0); // 위에 치우치면 윗 접선(위로 넘어가는 쪽)이 짧다
    const lower = { x: -300, y: -60 };
    const outDown = steerAroundObstacles(lower, target, chaseDir(lower, target), R, [DOME]);
    expect(outDown.y).toBeLessThan(0);
  });

  it('플레이어가 벽에 붙어 확장원 안에 들어가도 우회한다 (엄폐 대치)', () => {
    // 적 반지름(40) > 플레이어 반지름이면 벽에 붙은 플레이어가 적의 확장원(반지름 140) 안에 들어간다.
    // 경유점 후보가 전멸해 우회를 포기하면 엄폐 시 적이 반대편에서 굳는다 — 목표 방사 클램프가 막는다.
    const bigR = 40;
    const from = { x: 300, y: 0 };
    const target = { x: -125, y: 0 }; // 중심에서 125 < 확장 반지름 140 — 확장원 내부
    const out = steerAroundObstacles(from, target, chaseDir(from, target), bigR, [DOME]);
    expect(Math.abs(out.y)).toBeGreaterThan(0.1); // 정면 그대로면 갇힌다
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1);
  });

  it('정면 대칭선을 0.01px 지나도 접선 선택이 뒤집히지 않는다 (C-1 원 판 국소)', () => {
    // 사각형 C-1의 원 판: 정면 일직선은 좌우 접선이 동률이라 chirality 타이브레이크가 결정한다.
    // 그 대칭선을 미세하게 지날 때 타이브레이크가 반대 접선으로 뒤집히면 두 프레임이 서로를
    // 되돌리는 극한 순환이 된다. 원의 두 접선은 2α(여기선 약 47°)만큼만 벌어져, 뒤집혀도 두 방향
    // 사이 dot이 양수(약 0.68)라 dot>0 검사로는 못 잡는다 — 그래서 "둘 다 CCW(+y) 쪽"을 직접
    // 본다(뒤집히면 한쪽 y가 −0.4로 떨어진다). 도달 스윕이 이 병을 전수로 잡지만(느린 통합
    // 신호), 여기서 불연속을 국소로 못박는다.
    const target = { x: 300, y: 0 };
    const onLine = { x: -300, y: 0 };
    const past = { x: -300, y: 0.01 };
    const dirOn = steerAroundObstacles(onLine, target, chaseDir(onLine, target), R, [DOME]);
    const dirPast = steerAroundObstacles(past, target, chaseDir(past, target), R, [DOME]);
    expect(dirOn.y).toBeGreaterThan(0);
    expect(dirPast.y).toBeGreaterThan(0);
  });

  it('막을 것이 없으면(플레이어와 같은 편) 우회하지 않는다 — 목표가 확장원 안이어도', () => {
    // 목표가 확장원 안이면 목표까지 선분이 그 안에서 끝나 어느 위치에서도 "막혔다"가 나온다. 바로
    // 뒤에 붙어 선 적이 사이에 아무것도 없는데 옆으로 새면 안 된다 — 목표 클램프 뒤 재판정이 막는다.
    const bigR = 40;
    const player = { x: -125, y: 0 }; // 확장원(반지름 140) 안
    const from = { x: -146, y: 0 }; // 같은 편 바로 뒤(확장원 밖), 사이에 아무것도 없음
    const dir = chaseDir(from, player);
    expect(steerAroundObstacles(from, player, dir, bigR, [DOME])).toBe(dir);
  });
});

describe('steerAroundObstacles — 원 입력 방어·불변', () => {
  it('radius가 0 이하면 원하는 방향을 그대로 돌려준다', () => {
    const dir = { x: 1, y: 0 };
    expect(steerAroundObstacles({ x: -300, y: 0 }, { x: 300, y: 0 }, dir, 0, [DOME])).toBe(dir);
  });

  it('좌표가 NaN이면 원하는 방향을 그대로 돌려준다 (방향 오염 차단)', () => {
    const dir = { x: 1, y: 0 };
    const nan = Number.NaN;
    expect(steerAroundObstacles({ x: nan, y: 0 }, { x: 300, y: 0 }, dir, R, [DOME])).toBe(dir);
  });

  it('입력(from·target·desiredDir·obstacles)을 변형하지 않는다(F36 할당 위생 계약)', () => {
    const from = { x: -300, y: 0 };
    const target = { x: 300, y: 0 };
    const dir = chaseDir(from, target);
    const obstacles: Obstacle[] = [{ ...DOME }];
    const snaps = [snapshot(from), snapshot(target), snapshot(dir), snapshot(obstacles)];
    steerAroundObstacles(from, target, dir, R, obstacles);
    expect([from, target, dir, obstacles]).toEqual(snaps);
  });
});

/**
 * 도달 스윕 — 실 반지름 × 접근각 전수로 "적은 반드시 플레이어에게 닿는다"를 고정한다.
 *
 * 사각형에서 반지름 25 초과 적(12종 중 9종)이 벽에 붙은 플레이어를 못 잡고 코너를 맴돈 C-1이
 * 원의 접선점 불연속에서도 재발할 수 있다 — 첫 다리 길이가 0에 수렴해도 정규화하면 방향은 full
 * 크기라, 접선점을 지나는 순간 미세한 위치 차가 180° 반전으로 증폭돼 두 프레임이 서로를 되돌리는
 * 극한 순환이 된다. 한 점에서 "방향이 꺾였다"를 보는 대신, 실제로 닿는지를 전수로 본다.
 */
describe('도달 스윕 — 실 반지름 × 접근각 (C-1 원 판)', () => {
  /** enemies.json의 실 충돌 반지름 전종. 25 초과가 9종 — 그쪽이 목표 방사 클램프 분기를 탄다. */
  const ENEMY_RADII = [18, 25, 26, 27, 28, 32, 38, 40];
  /** player.json의 충돌 반지름. 적이 이보다 크면 벽에 붙은 플레이어가 적의 확장원에 잠긴다. */
  const PLAYER_R = 25;
  /** 계획 §2.1 상한(지름 ≤ 300px)의 원 장애물. */
  const WALL: ObstacleCircle = { kind: 'circle', cx: 0, cy: 0, r: 150 };

  /**
   * 적 하나를 접근각 `angle`에서 출발시켜 플레이어에 닿을 때까지 굴린다.
   * @returns 접촉(두 반지름 합)까지 걸린 프레임. 60초 안에 못 닿으면 -1
   */
  function reach(radius: number, angle: number, player: Vec2): number {
    const dt = 1 / 60;
    const speed = 120;
    let pos: Vec2 = { x: Math.cos(angle) * 400, y: Math.sin(angle) * 400 };
    for (let f = 1; f <= 3600; f++) {
      const dx = player.x - pos.x;
      const dy = player.y - pos.y;
      const len = Math.hypot(dx, dy);
      if (len <= radius + PLAYER_R) return f;
      const dir = { x: dx / len, y: dy / len };
      const steer = steerAroundObstacles(pos, player, dir, radius, [WALL]);
      const step = speed * dt;
      pos = resolveCircleMove(
        pos,
        { x: pos.x + steer.x * step, y: pos.y + steer.y * step },
        radius,
        [WALL],
      );
    }
    return -1;
  }

  /** 접근각 전수에서 갇힌 각도 목록. 비어 있어야 한다. */
  function stuckAngles(radius: number, player: Vec2): number[] {
    const stuck: number[] = [];
    const total = 72; // 5° 간격
    for (let i = 0; i < total; i++) {
      if (reach(radius, (i / total) * Math.PI * 2, player) < 0)
        stuck.push(Math.round((i / total) * 360));
    }
    return stuck;
  }

  for (const radius of ENEMY_RADII) {
    it(`반지름 ${radius} — 벽에 붙은 플레이어를 모든 접근각에서 잡는다 (엄폐 대치)`, () => {
      // 플레이어가 왼쪽 표면에 자기 반지름만큼 붙어 선다 — 적 반지름이 25를 넘으면 이 지점이
      // 적의 확장원 안이라 목표 방사 클램프가 발동한다(9종). 클램프 경로가 깨지면 여기서 갇힌다.
      expect(stuckAngles(radius, { x: -(WALL.r + PLAYER_R), y: 0 })).toEqual([]);
    });

    it(`반지름 ${radius} — 원 반대편 플레이어를 모든 접근각에서 잡는다`, () => {
      expect(stuckAngles(radius, { x: -400, y: 0 })).toEqual([]);
    });
  }
});
