import { describe, expect, it } from 'vitest';
import {
  type ObstacleRect,
  resolveCircleMove,
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
const BOX: ObstacleRect = { cx: 0, cy: 0, halfW: 100, halfH: 50 };

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
    const thin: ObstacleRect = { cx: 0, cy: 0, halfW: 10, halfH: 100 };
    const out = resolveCircleMove({ x: -200, y: 0 }, { x: 200, y: 0 }, R, [thin]);
    expect(out.x).toBeCloseTo(-10 - R);
    expect(out.y).toBeCloseTo(0);
  });

  it('붙지 않은 장애물 2개 사이 통행 폭(200px)을 곧게 통과한다', () => {
    // 배치 제약 최소 간격(200px) 복도의 한가운데 — 어느 쪽에도 침투하지 않으므로 무보정 통과
    const left: ObstacleRect = { cx: -150, cy: 0, halfW: 50, halfH: 50 };
    const right: ObstacleRect = { cx: 150, cy: 0, halfW: 50, halfH: 50 };
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
