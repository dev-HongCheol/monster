import { describe, expect, it } from 'vitest';
import { enemyQueryRadius, SpatialGrid } from '../../game/assets/scripts/logic/SpatialGrid';

/**
 * 계획 문서(2026-06-17-spatial-grid-plan.md)의 순수 공간 그리드.
 *
 * 균일한 셀 크기의 희소 해시 격자(점유된 칸만 보관). cc 비의존이라 결정적으로 테스트한다.
 * 항목 타입 T는 number(적의 spawnId를 흉내) — 동일성(===)으로 반환 집합을 검증한다.
 *
 * 프레임 단위 재구축(director.getTotalFrames 기반)은 cc에 의존하는 GameManager 책임이라
 * 여기서 다루지 않는다. 이 모듈은 clear / insert / queryRadius 만 책임진다.
 */

/** 두 좌표 사이 거리가 r 이하인지(브루트포스 기준값 — parity 비교용). */
function withinRadius(px: number, py: number, qx: number, qy: number, r: number): boolean {
  const dx = px - qx;
  const dy = py - qy;
  return dx * dx + dy * dy <= r * r;
}

/** 결정적 의사난수(LCG) — parity 테스트 재현성. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

describe('SpatialGrid — 기본 등록·조회 (T1)', () => {
  it('한 칸 안의 점들을 insert한 뒤 그 칸 반경으로 질의하면 모두 반환한다', () => {
    const grid = new SpatialGrid<number>(100);
    grid.insert(1, 10, 10);
    grid.insert(2, 20, 30);
    grid.insert(3, 40, 5);

    const hits = grid.queryRadius(25, 20, 60);

    expect(sorted(hits)).toEqual([1, 2, 3]);
    expect(grid.size).toBe(3);
  });
});

describe('SpatialGrid — 셀 경계 (T2)', () => {
  it('질의 반경이 여러 칸에 걸치면 경계 너머 항목도 반환한다', () => {
    const grid = new SpatialGrid<number>(100);
    // 셀 크기 100 기준 서로 다른 칸에 배치: (50,50)→칸(0,0), (150,50)→칸(1,0), (50,150)→칸(0,1)
    grid.insert(1, 50, 50);
    grid.insert(2, 150, 50);
    grid.insert(3, 50, 150);

    // (100,100)에서 반경 80이면 세 점 모두 유클리드 거리 ~70.7 < 80 → 모두 포함
    const hits = grid.queryRadius(100, 100, 80);

    expect(sorted(hits)).toEqual([1, 2, 3]);
  });
});

describe('SpatialGrid — 반경 밖 제외 (T3)', () => {
  it('질의 반경 밖의 항목은 반환하지 않는다', () => {
    const grid = new SpatialGrid<number>(50);
    grid.insert(1, 0, 0); // 중심
    grid.insert(2, 200, 0); // 반경 밖

    const hits = grid.queryRadius(0, 0, 60);

    expect(hits).toEqual([1]);
  });
});

describe('SpatialGrid — 빈 그리드 (T4)', () => {
  it('항목이 없으면 빈 결과를 반환한다', () => {
    const grid = new SpatialGrid<number>(100);
    expect(grid.queryRadius(0, 0, 500)).toEqual([]);
    expect(grid.size).toBe(0);
  });
});

describe('SpatialGrid — 음수·원점 좌표 (T5)', () => {
  it('중앙 원점 좌표계의 음수 좌표도 정확히 처리한다', () => {
    const grid = new SpatialGrid<number>(100);
    grid.insert(1, -120, -120);
    grid.insert(2, -10, -10);
    grid.insert(3, 80, 80);

    const hits = grid.queryRadius(0, 0, 30);

    expect(hits).toEqual([2]); // (-10,-10)만 반경 30 안
  });
});

describe('SpatialGrid — parity (T6)', () => {
  it('무작위 위치에서 queryRadius 결과가 브루트포스 반경 내 집합과 일치한다', () => {
    const grid = new SpatialGrid<number>(64);
    const rng = makeRng(20260617);
    const pts: Array<{ id: number; x: number; y: number }> = [];

    for (let i = 1; i <= 200; i++) {
      const x = Math.round((rng() - 0.5) * 4000);
      const y = Math.round((rng() - 0.5) * 4000);
      pts.push({ id: i, x, y });
      grid.insert(i, x, y);
    }

    // 여러 질의점에서 그리드 결과 == 브루트포스 결과
    for (let q = 0; q < 30; q++) {
      const qx = Math.round((rng() - 0.5) * 4000);
      const qy = Math.round((rng() - 0.5) * 4000);
      const r = 50 + Math.round(rng() * 400);

      const brute = pts.filter((p) => withinRadius(p.x, p.y, qx, qy, r)).map((p) => p.id);
      const got = grid.queryRadius(qx, qy, r);

      expect(sorted(got)).toEqual(sorted(brute));
    }
  });
});

describe('SpatialGrid — 재구축 정확성 (T7)', () => {
  it('clear 후 새 위치로 다시 insert하면 질의가 새 위치를 반영한다', () => {
    const grid = new SpatialGrid<number>(100);
    grid.insert(1, 0, 0);
    expect(grid.queryRadius(0, 0, 30)).toEqual([1]);

    grid.clear();
    grid.insert(1, 500, 500);

    expect(grid.queryRadius(0, 0, 30)).toEqual([]); // 옛 위치엔 없음
    expect(grid.queryRadius(500, 500, 30)).toEqual([1]); // 새 위치에 있음
    expect(grid.size).toBe(1);
  });
});

describe('SpatialGrid — 맵 크기 비의존 (T8)', () => {
  it('멀리 떨어진 두 군집에서 한쪽 질의가 반대쪽 항목을 반환하지 않는다', () => {
    const grid = new SpatialGrid<number>(100);
    grid.insert(1, 0, 0);
    grid.insert(2, 30, 0);
    grid.insert(3, 100000, 100000); // 아주 먼 군집
    grid.insert(4, 100030, 100000);

    expect(sorted(grid.queryRadius(15, 0, 60))).toEqual([1, 2]);
    expect(sorted(grid.queryRadius(100015, 100000, 60))).toEqual([3, 4]);
  });

  it('질의 결과 수가 군집 간 거리와 무관하다 (유계 반경)', () => {
    const near = new SpatialGrid<number>(100);
    near.insert(1, 0, 0);
    near.insert(2, 1000, 0); // 가까운 두 번째 군집

    const far = new SpatialGrid<number>(100);
    far.insert(1, 0, 0);
    far.insert(2, 1000000, 0); // 100만 떨어진 두 번째 군집

    // 같은 질의 → 거리가 1000이든 100만이든 첫 군집만, 결과 동일
    expect(near.queryRadius(0, 0, 60)).toEqual([1]);
    expect(far.queryRadius(0, 0, 60)).toEqual([1]);
  });
});

describe('SpatialGrid — 적별 충돌 반경 parity (T9)', () => {
  it('enemyQueryRadius 마진이 정밀 임계값을 통과할 적을 절대 빠뜨리지 않는다', () => {
    // 적마다 충돌 반경이 다른 상황에서, 그리드 광역 후보가 전수 비교 정밀 명중을 빠짐없이 포함하는지.
    const grid = new SpatialGrid<number>(64);
    const rng = makeRng(424242);
    const enemies: Array<{ id: number; x: number; y: number; cr: number }> = [];

    for (let i = 1; i <= 200; i++) {
      const x = Math.round((rng() - 0.5) * 4000);
      const y = Math.round((rng() - 0.5) * 4000);
      const cr = 10 + Math.round(rng() * 40); // 충돌 반경 10~50로 다양화
      enemies.push({ id: i, x, y, cr });
      grid.insert(i, x, y);
    }
    const maxEnemyRadius = Math.max(...enemies.map((e) => e.cr));

    for (let q = 0; q < 40; q++) {
      const px = Math.round((rng() - 0.5) * 4000);
      const py = Math.round((rng() - 0.5) * 4000);
      const reach = 8 + Math.round(rng() * 200); // 발사체/폭발 반경

      // 정밀 명중: GameManager 호출부와 동일한 strict 임계값(reach + 적 충돌 반경)
      const preciseHits = enemies
        .filter((e) => {
          const dx = e.x - px;
          const dy = e.y - py;
          return dx * dx + dy * dy < (reach + e.cr) * (reach + e.cr);
        })
        .map((e) => e.id);

      // 그리드 광역 후보: 프로덕션과 동일한 마진 공식
      const candidates = new Set(grid.queryRadius(px, py, enemyQueryRadius(reach, maxEnemyRadius)));

      for (const id of preciseHits) {
        expect(candidates.has(id)).toBe(true); // 누락 0
      }
    }
  });
});
