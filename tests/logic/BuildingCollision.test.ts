import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../game/assets/scripts/logic/ArenaLogic';
import {
  type ObstacleRect,
  resolveCircleMove,
  steerAroundObstacles,
} from '../../game/assets/scripts/logic/ObstacleLogic';

/**
 * 계획 문서(2026-07-16-building-collision-plan.md §4.3·§6)의 순수 장애물 해소 로직.
 *
 * 원(이동 주체, 반지름 radius) 대 축정렬 사각형(장애물)의 이동 해소 — from → to 이동 결과가
 * 장애물과 겹치면 겹친 만큼만 최소 침투 축으로 밀어낸다(collide-and-slide). 비스듬한 진입은
 * 막힌 축만 잃고 벽면을 따라 미끄러지며, 코너에서는 최근접점 방향(대각)으로 밀어내 축 진동
 * 없이 모서리를 돈다. 이동 거리가 radius보다 길면 스텝을 나눠 얇은 장애물 관통(터널링)을 막는다.
 *
 * MapManager의 씬 색인(obstaclesRoot 자식 → AABB 유도, 미연결·크기 0·scale·300px 초과 경고)과
 * 이동 배선(PlayerController 1곳 + EnemyController 4곳)은 cc 프레임워크 의존이라 여기서 다루지
 * 않는다(7단계 수동 QA).
 */

/** 원점 중심 200×100 장애물 — x∈[-100,100], y∈[-50,50]. */
const BOX: ObstacleRect = { kind: 'rect', cx: 0, cy: 0, halfW: 100, halfH: 50 };

/** 이동 주체 반지름(px) — 플레이어·적 충돌 반지름(25 근방)과 같은 자릿수. */
const R = 20;

/** 깊은 복제 — 함수 호출이 입력을 변형하지 않는지 비교할 스냅샷을 만든다. */
function snapshot<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

describe('resolveCircleMove — 기본 해소', () => {
  it('장애물 없음(빈 배열)이면 to를 그대로 돌려준다 (기존 이동 회귀 없음)', () => {
    const out = resolveCircleMove({ x: 0, y: 200 }, { x: 5, y: 195 }, R, []);
    expect(out.x).toBe(5);
    expect(out.y).toBe(195);
  });

  it('정면 진입 — 위에서 수직 하강하면 윗면에서 radius만큼 떨어져 멈춘다', () => {
    // 목적지 (0,60)은 윗면(y=50)에서 10px — radius(20) 미만 침투라 y=70으로 밀려난다
    const out = resolveCircleMove({ x: 0, y: 100 }, { x: 0, y: 60 }, R, [BOX]);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(50 + R);
  });

  it('비스듬 진입 — 막힌 y축만 소거되고 진행 x축 이동은 보존된다(미끄러짐)', () => {
    // 오른쪽 아래 대각 이동: y는 표면+radius(70)에 걸리지만 x는 목적지 30까지 전부 간다
    const out = resolveCircleMove({ x: 0, y: 75 }, { x: 30, y: 55 }, R, [BOX]);
    expect(out.x).toBeCloseTo(30);
    expect(out.y).toBeCloseTo(50 + R);
  });

  it('코너 진입 — 최근접점 방향(대각)으로 밀어내 끼임 없이 모서리를 돈다', () => {
    // 우상단 코너(100,50)로 파고들면 축 스냅이 아니라 코너에서 radius 거리의 대각 방향으로
    // 밀려나야 한다. 축 스냅이면 코너 거리가 radius를 넘어(예: y축만 밀면 √(12²+20²)≈23.3)
    // 아래 근접 검증이 깨진다.
    const out = resolveCircleMove({ x: 130, y: 90 }, { x: 112, y: 62 }, R, [BOX]);
    const dx = out.x - 100;
    const dy = out.y - 50;
    expect(Math.hypot(dx, dy)).toBeCloseTo(R);
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeGreaterThan(0);
  });

  it('from이 장애물 내부(스폰 겹침)면 최근접 면 밖으로 밀어낸다', () => {
    // (90,0)은 내부 — 오른면(x=100)까지 10px로 가장 얕다 → x = 100 + radius로 탈출
    const out = resolveCircleMove({ x: 90, y: 0 }, { x: 90, y: 0 }, R, [BOX]);
    expect(out.x).toBeCloseTo(100 + R);
    expect(out.y).toBeCloseTo(0);
  });
});

describe('resolveCircleMove — 터널링·통행·안정성', () => {
  it('고속 이동(step ≫ radius)이 얇은 장애물을 관통하지 않는다(터널링 방지)', () => {
    // 폭 20px 세로 벽을 한 프레임에 400px 이동으로 가로지르려 하면, 스텝 분할이 없을 때
    // 목적지(x=200)가 벽 밖이라 그대로 통과해 버린다. 분할이 있으면 왼면(x=-10-radius)에 막힌다.
    const thin: ObstacleRect = { kind: 'rect', cx: 0, cy: 0, halfW: 10, halfH: 100 };
    const out = resolveCircleMove({ x: -200, y: 0 }, { x: 200, y: 0 }, R, [thin]);
    expect(out.x).toBeCloseTo(-10 - R);
    expect(out.y).toBeCloseTo(0);
  });

  it('붙지 않은 장애물 2개 사이 통행 폭(200px)을 곧게 통과한다', () => {
    // 배치 제약 최소 간격(200px) 복도의 한가운데 — 어느 쪽에도 침투하지 않으므로 무보정 통과
    const left: ObstacleRect = { kind: 'rect', cx: -150, cy: 0, halfW: 50, halfH: 50 };
    const right: ObstacleRect = { kind: 'rect', cx: 150, cy: 0, halfW: 50, halfH: 50 };
    const out = resolveCircleMove({ x: 0, y: 200 }, { x: 0, y: -200 }, R, [left, right]);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(-200);
  });

  it('해소된 위치를 같은 인자로 다시 해소하면 그대로다(재해소 무변화)', () => {
    // 어기면 벽에 붙어 서 있는 매 프레임 위치가 미세하게 튀는 진동이 생긴다
    const settled = resolveCircleMove({ x: 0, y: 100 }, { x: 0, y: 60 }, R, [BOX]);
    const again = resolveCircleMove(settled, settled, R, [BOX]);
    expect(again.x).toBe(settled.x);
    expect(again.y).toBe(settled.y);
  });

  it('겹치게 배치된 장애물 2개(배치 제약 위반)에서도 2패스로 비침투 위치에 도달한다', () => {
    // A에서 밀려난 위치가 B 내부로 들어가는 배치 — 방어용 2패스가 없으면 침투가 남는다.
    // 정확한 최종 좌표 대신 "어느 장애물에도 침투하지 않음" 속성을 검증한다(특성화 테스트).
    const a: ObstacleRect = { kind: 'rect', cx: 0, cy: 0, halfW: 50, halfH: 50 };
    const b: ObstacleRect = { kind: 'rect', cx: 90, cy: 60, halfW: 50, halfH: 50 };
    const out = resolveCircleMove({ x: 45, y: 45 }, { x: 45, y: 45 }, R, [a, b]);
    for (const ob of [a, b]) {
      const nx = Math.max(ob.cx - ob.halfW, Math.min(ob.cx + ob.halfW, out.x));
      const ny = Math.max(ob.cy - ob.halfH, Math.min(ob.cy + ob.halfH, out.y));
      expect(Math.hypot(out.x - nx, out.y - ny)).toBeGreaterThanOrEqual(R - 1e-9);
    }
  });

  it('내부 겹침 상태에서 이동해도(to ≠ from) 최근접 면 밖으로 탈출한다', () => {
    // (95,0)은 여전히 내부 — 오른면 탈출이 이동보다 우선 적용돼 x = 100 + radius
    const out = resolveCircleMove({ x: 90, y: 0 }, { x: 95, y: 0 }, R, [BOX]);
    expect(out.x).toBeCloseTo(100 + R);
    expect(out.y).toBeCloseTo(0);
  });

  it('병리적 입력(거대 이동 × 극소 radius)도 서브스텝 상한으로 즉시 완주한다', () => {
    // 상한이 없으면 steps = ceil(거리/radius) ≈ 40억이라 이 테스트 자체가 사실상 멎는다(행).
    // 상한이 무는 입력은 한 프레임에 아레나를 넘는 순간이동뿐이라 관통을 감수한다(계획 §4.3 방어).
    const far: ObstacleRect = { kind: 'rect', cx: 1e9, cy: 1e9, halfW: 10, halfH: 10 };
    const out = resolveCircleMove({ x: 0, y: 0 }, { x: 0, y: -2_000_000_000 }, 0.5, [far]);
    expect(out.x).toBe(0);
    expect(out.y).toBe(-2_000_000_000);
  });
});

describe('resolveCircleMove — 입력 방어·불변', () => {
  it('to 좌표가 NaN이면 원위치(from)를 돌려준다(위치 오염 차단)', () => {
    const out = resolveCircleMove({ x: 0, y: 100 }, { x: Number.NaN, y: 60 }, R, [BOX]);
    expect(out.x).toBe(0);
    expect(out.y).toBe(100);
  });

  it('from 좌표가 NaN이면 to를 그대로 돌려준다(해소 불가 시 이동은 유지, 유령 충돌 없음)', () => {
    const out = resolveCircleMove({ x: Number.NaN, y: Number.NaN }, { x: 0, y: 200 }, R, [BOX]);
    expect(out.x).toBe(0);
    expect(out.y).toBe(200);
  });

  it('radius가 0 이하면 해소 없이 to를 그대로 돌려준다(스텝 분할 무한 루프·유령 충돌 없음)', () => {
    const out = resolveCircleMove({ x: 0, y: 100 }, { x: 0, y: 0 }, 0, [BOX]);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
  });

  it('입력(from·to·obstacles)을 변형하지 않는다(F36 할당 위생 계약)', () => {
    const from = { x: 0, y: 100 };
    const to = { x: 30, y: 55 };
    const obstacles: ObstacleRect[] = [{ ...BOX }];
    const fromSnap = snapshot(from);
    const toSnap = snapshot(to);
    const obstaclesSnap = snapshot(obstacles);
    resolveCircleMove(from, to, R, obstacles);
    expect(from).toEqual(fromSnap);
    expect(to).toEqual(toSnap);
    expect(obstacles).toEqual(obstaclesSnap);
  });
});

/**
 * `steerAroundObstacles` — 장애물 인지 스티어링(코너 우회).
 *
 * BOX(200×100)를 반지름 20으로 확장한 사각형은 x∈[-120,120], y∈[-70,70]이고, 그 네 꼭짓점이
 * 우회 경유점이다. 아래 테스트가 쓰는 좌표는 전부 이 확장 사각형 기준이다.
 */

/** 플레이어를 향하는 단위 방향 — 우회 없는 순수 추격 스티어링(현재 `_followPlayer`의 계산). */
function chaseDir(from: { x: number; y: number }, target: { x: number; y: number }) {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const len = Math.hypot(dx, dy);
  return len === 0 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}

describe('steerAroundObstacles — 우회 발동 조건', () => {
  it('장애물이 없으면 원하는 방향을 그대로 돌려준다 (기존 이동 회귀 없음)', () => {
    const dir = { x: 1, y: 0 };
    const out = steerAroundObstacles({ x: -300, y: 0 }, { x: 300, y: 0 }, dir, R, []);
    expect(out).toBe(dir); // 같은 참조 — 막히지 않으면 할당하지 않는다(F36)
  });

  it('장애물이 직선 경로를 막지 않으면 원하는 방향을 그대로 돌려준다', () => {
    // 적·플레이어 모두 장애물 위쪽(y=200)을 지난다 — 우회할 이유가 없다
    const dir = { x: 1, y: 0 };
    const out = steerAroundObstacles({ x: -300, y: 200 }, { x: 300, y: 200 }, dir, R, [BOX]);
    expect(out).toBe(dir);
  });

  it('목표에서 멀어지는 이동(유격 후퇴)은 우회하지 않는다', () => {
    // kiteDirection의 후퇴는 -toward라 도착점이 플레이어가 아니다 — 코너 우회의 척도가 성립하지 않는다
    const dir = { x: -1, y: 0 };
    const out = steerAroundObstacles({ x: -300, y: 0 }, { x: 300, y: 0 }, dir, R, [BOX]);
    expect(out).toBe(dir);
  });

  it('우회를 마쳐 직선이 뚫리면 원하는 방향으로 되돌아온다 (코너에 붙어 맴돌지 않는다)', () => {
    // 우상단 코너(120,70)에 서면 플레이어(300,0)까지 직선이 확장 사각형을 스치기만 한다 —
    // 스침을 막힘으로 세면 적이 코너에 붙어 영영 우회만 하게 된다
    const from = { x: 120, y: 70 };
    const target = { x: 300, y: 0 };
    const dir = chaseDir(from, target);
    const out = steerAroundObstacles(from, target, dir, R, [BOX]);
    expect(out).toBe(dir);
  });
});

describe('steerAroundObstacles — 코너 우회 경로', () => {
  it('정면 일직선(적-장애물-플레이어)에서 코너 쪽으로 방향을 튼다 — 제자리 정지 회귀', () => {
    // 이 슬라이스의 회귀 버그: 순수 밀어내기는 정면 진입에서 변위가 정확히 0이라 적이 영영 멈춘다.
    // 스티어링이 코너를 겨눠야 접선 성분이 생긴다.
    const from = { x: -300, y: 0 };
    const target = { x: 300, y: 0 };
    const out = steerAroundObstacles(from, target, chaseDir(from, target), R, [BOX]);
    expect(Math.abs(out.y)).toBeGreaterThan(0.1); // 정면 그대로(y=0)면 갇힌다
    expect(out.x).toBeGreaterThan(0); // 전진은 유지 — 뒤로 물러나지 않는다
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1); // 단위 벡터 계약
  });

  it('정면 일직선의 좌우 동률은 진행 방향 90° CCW 쪽으로 고정한다 (zigzag와 같은 chirality)', () => {
    // 위·아래 우회 거리가 정확히 같아 부호가 뜬다 — 고정하지 않으면 매 프레임 좌우가 뒤집혀 떨린다.
    // +x 진행의 90° CCW는 +y(zigzagDirection의 perp 규약과 동일).
    const from = { x: -300, y: 0 };
    const target = { x: 300, y: 0 };
    const out = steerAroundObstacles(from, target, chaseDir(from, target), R, [BOX]);
    expect(out.y).toBeGreaterThan(0);
  });

  it('동률이 아니면 가까운 쪽 코너로 우회한다 (위/아래 대칭)', () => {
    const target = { x: 300, y: 0 };
    // 적이 위쪽에 치우쳐 있으면 윗 코너가 짧다
    const upper = { x: -300, y: 40 };
    const outUp = steerAroundObstacles(upper, target, chaseDir(upper, target), R, [BOX]);
    expect(outUp.y).toBeGreaterThan(0);
    // 아래쪽에 치우쳐 있으면 아랫 코너 — CCW 타이브레이크가 동률이 아닌 경우까지 먹으면 깨진다
    const lower = { x: -300, y: -40 };
    const outDown = steerAroundObstacles(lower, target, chaseDir(lower, target), R, [BOX]);
    expect(outDown.y).toBeLessThan(0);
  });

  it('코너에 도달하면 다음 코너로 이어간다 (경유점 갱신)', () => {
    // 좌상단 코너(-120,70)에 도착해도 플레이어(300,0)까지는 아직 막혀 있다 — 윗변을 따라
    // 우상단 코너(120,70)로 이어가야 한다. 자기 자신을 겨누면 영벡터라 다시 멈춘다.
    const from = { x: -120, y: 70 };
    const target = { x: 300, y: 0 };
    const out = steerAroundObstacles(from, target, chaseDir(from, target), R, [BOX]);
    expect(out.x).toBeGreaterThan(0.9); // 윗변을 따라 +x
    expect(Math.abs(out.y)).toBeLessThan(0.1);
  });

  it('코너를 지나쳐도 되돌아가지 않는다 (경유점 진동 없음)', () => {
    // 좌상단 코너를 1px 넘어선 위치. "가장 가까운 코너"로 고르면 방금 지난 코너(-120,70)가
    // 붙어 있어 되돌아가고, 다음 프레임엔 다시 앞으로 — 코너에 끼여 진동한다.
    const from = { x: -120, y: 71 };
    const target = { x: 300, y: 0 };
    const out = steerAroundObstacles(from, target, chaseDir(from, target), R, [BOX]);
    expect(out.x).toBeGreaterThan(0.9);
  });

  it('플레이어가 벽에 붙어 확장 사각형 안에 들어가도 우회한다 (엄폐 대치)', () => {
    // 적 반지름(40) > 플레이어 반지름(25)이면 벽에 붙은 플레이어가 적의 확장 사각형 내부에 들어간다
    // (12종 중 8종이 25 초과). 경유점 후보가 전멸해 우회를 포기하면 엄폐 시 적이 반대편에서 굳는다.
    const bigR = 40;
    const from = { x: 300, y: 0 };
    const target = { x: -125, y: 0 }; // 왼면(x=-100)에 반지름 25로 붙은 플레이어
    const out = steerAroundObstacles(from, target, chaseDir(from, target), bigR, [BOX]);
    expect(Math.abs(out.y)).toBeGreaterThan(0.1); // 정면 그대로면 갇힌다
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1);
  });
});

describe('steerAroundObstacles — 입력 방어·불변', () => {
  it('radius가 0 이하면 원하는 방향을 그대로 돌려준다', () => {
    const dir = { x: 1, y: 0 };
    expect(steerAroundObstacles({ x: -300, y: 0 }, { x: 300, y: 0 }, dir, 0, [BOX])).toBe(dir);
  });

  it('좌표가 NaN이면 원하는 방향을 그대로 돌려준다 (방향 오염 차단)', () => {
    const dir = { x: 1, y: 0 };
    const nan = Number.NaN;
    expect(steerAroundObstacles({ x: nan, y: 0 }, { x: 300, y: 0 }, dir, R, [BOX])).toBe(dir);
    expect(steerAroundObstacles({ x: -300, y: 0 }, { x: nan, y: 0 }, dir, R, [BOX])).toBe(dir);
  });

  it('원하는 방향이 영벡터면 그대로 돌려준다 (겹침·데드존 가드 보존)', () => {
    const dir = { x: 0, y: 0 };
    expect(steerAroundObstacles({ x: -300, y: 0 }, { x: 300, y: 0 }, dir, R, [BOX])).toBe(dir);
  });

  it('적이 장애물 내부(스폰 겹침)면 우회하지 않는다 — 탈출은 밀어내기 해소가 맡는다', () => {
    // 내부에서는 경유점이 보이지 않는다. 억지 우회 대신 resolveCircleMove의 최근접 면 탈출에 맡긴다.
    const dir = { x: 1, y: 0 };
    const out = steerAroundObstacles({ x: 0, y: 0 }, { x: 300, y: 0 }, dir, R, [BOX]);
    expect(out).toBe(dir);
  });

  it('입력(from·target·desiredDir·obstacles)을 변형하지 않는다(F36 할당 위생 계약)', () => {
    const from = { x: -300, y: 0 };
    const target = { x: 300, y: 0 };
    const dir = chaseDir(from, target);
    const obstacles: ObstacleRect[] = [{ ...BOX }];
    const snaps = [snapshot(from), snapshot(target), snapshot(dir), snapshot(obstacles)];
    steerAroundObstacles(from, target, dir, R, obstacles);
    expect([from, target, dir, obstacles]).toEqual(snaps);
  });
});

describe('스티어링 + 해소 통합 — 적이 장애물을 돌아 플레이어에 도달한다', () => {
  /**
   * 적 한 마리를 프레임 단위로 굴린다 — 매 프레임 추격 방향을 구하고, 우회 스티어링으로 꺾은 뒤,
   * 밀어내기로 해소해 위치를 갱신한다(EnemyController._followPlayer의 배선과 같은 순서).
   * @param startY 적 시작 y (플레이어는 (300,0) 고정)
   * @returns 플레이어에 도달하기까지 걸린 프레임 수. 제한 안에 못 닿으면 -1
   */
  function framesToReach(startY: number): number {
    const target = { x: 300, y: 0 };
    const speed = 120;
    const dt = 1 / 60;
    let pos = { x: -300, y: startY };
    for (let f = 1; f <= 1800; f++) {
      // 30초 상한
      const dir = steerAroundObstacles(pos, target, chaseDir(pos, target), R, [BOX]);
      const step = speed * dt;
      pos = resolveCircleMove(pos, { x: pos.x + dir.x * step, y: pos.y + dir.y * step }, R, [BOX]);
      if (Math.hypot(target.x - pos.x, target.y - pos.y) <= R) return f;
    }
    return -1;
  }

  // 우회 없는 직선 거리는 600px = 5초(300프레임). 우회로는 그보다 길지만, 갇히면 -1이 나온다.
  it('정면 일직선(startY=0)에서 갇히지 않고 도달한다', () => {
    expect(framesToReach(0)).toBeGreaterThan(0);
  });

  it('준정면(startY=40)에서 정지점으로 빨려들지 않고 도달한다', () => {
    // 밀어내기만 있으면 y가 0으로 수렴하면서 접선 성분이 함께 죽어 정지점에 갇힌다
    expect(framesToReach(40)).toBeGreaterThan(0);
  });

  it('면 밖(startY=200)에서 출발해도 정지점으로 빨려들지 않고 도달한다', () => {
    expect(framesToReach(200)).toBeGreaterThan(0);
  });

  it('우회 지연이 직선 대비 2배를 넘지 않는다 (교전 반경 근사 유지 — 계획 §2.1 크기 제약)', () => {
    // 한 변 ≤ 300px 제약이 우회 지연을 짧게 묶는다는 계획의 전제를 고정한다
    expect(framesToReach(0)).toBeLessThan(600);
  });
});

/**
 * 도달 스윕 — 실 반지름 × 접근각 전수로 "적은 반드시 플레이어에게 닿는다"를 고정한다.
 *
 * 위 통합 테스트들은 반지름을 20 하나로 고정하고 목표를 장애물 바깥 먼 곳에 뒀다. 그 조합은
 * 목표 클램프 분기(목표가 확장 사각형 안)를 **한 번도 타지 않는다** — 그래서 반지름 25 초과인
 * 적(12종 중 9종)이 벽에 붙은 플레이어를 못 잡고 코너를 맴도는 버그를 통과시켰다(코드리뷰 C-1).
 * 고른 한 점에서 "방향이 꺾였다"를 보는 대신, 실제로 닿는지를 전수로 본다.
 */
describe('도달 스윕 — 실 반지름 × 접근각 (C-1 회귀)', () => {
  /** enemies.json의 실 충돌 반지름 전종. 25 초과가 9종 — 그쪽이 목표 클램프 분기를 탄다. */
  const ENEMY_RADII = [18, 25, 26, 27, 28, 32, 38, 40];
  /** player.json의 충돌 반지름. 적이 이보다 크면 벽에 붙은 플레이어가 적의 확장 사각형에 잠긴다. */
  const PLAYER_R = 25;
  /** 계획 §2.1 상한(한 변 ≤ 300px)의 장애물. */
  const WALL: ObstacleRect = { kind: 'rect', cx: 0, cy: 0, halfW: 150, halfH: 150 };

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
      // 플레이어가 왼면에 자기 반지름만큼 붙어 선다 — 적 반지름이 25를 넘으면 이 지점이 적의
      // 확장 사각형 안이라 목표 클램프가 발동한다(9종). 클램프 경로가 깨지면 여기서 갇힌다.
      expect(stuckAngles(radius, { x: -(WALL.halfW + PLAYER_R), y: -140 })).toEqual([]);
    });

    it(`반지름 ${radius} — 장애물 반대편 플레이어를 모든 접근각에서 잡는다`, () => {
      expect(stuckAngles(radius, { x: -400, y: 0 })).toEqual([]);
    });
  }

  it('코너에 정확히 선 적과 0.01px 지난 적의 방향이 뒤집히지 않는다 (2프레임 극한 순환)', () => {
    // C-1의 씨앗: 코너 위에서는 자기 자신을 건너뛰어 다음 코너를 겨누는데, 0.01px 지나면 방금
    // 지난 코너가 첫 다리 0.01로 제일 싸 보여 되돌아간다 — 두 프레임이 서로를 되돌려 영영 맴돈다.
    // 첫 다리가 0에 수렴해도 정규화되면 방향은 full 크기라, 미세한 차이가 180° 반전으로 증폭된다.
    const radius = 32;
    const player = { x: -(WALL.halfW + PLAYER_R), y: -140 };
    const ex = WALL.halfW + radius; // 확장 사각형 좌상단 코너 = (-182, 182)
    const onCorner = { x: -ex, y: ex };
    const pastCorner = { x: -ex, y: ex - 0.01 };
    const dirOn = steerAroundObstacles(onCorner, player, chaseDir(onCorner, player), radius, [
      WALL,
    ]);
    const dirPast = steerAroundObstacles(pastCorner, player, chaseDir(pastCorner, player), radius, [
      WALL,
    ]);
    expect(dirOn.x * dirPast.x + dirOn.y * dirPast.y).toBeGreaterThan(0);
  });

  it('막을 것이 없으면 우회하지 않는다 — 플레이어와 같은 편에 서 있을 때', () => {
    // 목표가 확장 사각형 안이면 목표까지의 선분이 그 안에서 끝나 어느 위치에서도 "막혔다"가
    // 나온다 — 바로 앞에 플레이어가 있어도 우회해 옆으로 샌다.
    const radius = 32;
    const player = { x: -(WALL.halfW + PLAYER_R), y: -140 };
    const from = { x: player.x - 21, y: player.y }; // 21px 앞, 사이에 아무것도 없다
    const dir = chaseDir(from, player);
    expect(steerAroundObstacles(from, player, dir, radius, [WALL])).toBe(dir);
  });
});
