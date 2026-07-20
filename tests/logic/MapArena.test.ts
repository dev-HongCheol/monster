import { describe, expect, it } from 'vitest';
import {
  cameraFollowPosition,
  clampToArena,
  isOutsideArena,
} from '../../game/assets/scripts/logic/ArenaLogic';

/**
 * 계획 문서(2026-07-11-map-arena-plan.md §6·§9)의 순수 아레나 로직.
 *
 * 경계형 아레나는 월드 원점(0,0)을 중심으로 하는 width×height 사각이다.
 * 경계는 x ∈ [-width/2, width/2], y ∈ [-height/2, height/2]. cc 비의존이라 결정적으로 테스트한다.
 *
 * - clampToArena: 반경을 가진 엔티티(플레이어·스폰 적)를 벽 안에 가둔다.
 * - cameraFollowPosition: 카메라가 플레이어를 따라가되 뷰가 벽 밖으로 나가지 않게 클램프한다.
 *
 * 카메라·씬·배경 배선은 cc 프레임워크 의존이라 여기서 다루지 않는다(7단계 수동 QA).
 */

/** 합성 아레나(크기 불가지 — 로직은 값에 무관) — halfW=halfH=1200. 실제 서울 맵은 4800이다(F54). */
const ARENA = { width: 2400, height: 2400 };

describe('clampToArena — 엔티티를 반경만큼 벽 안에 가둔다', () => {
  it('아레나 안쪽 위치는 그대로 둔다', () => {
    expect(clampToArena({ x: 100, y: 50 }, 25, ARENA)).toEqual({ x: 100, y: 50 });
  });

  it('오른쪽 벽을 넘으면 반경만큼 안쪽으로 클램프한다', () => {
    // halfW 1200, radius 25 → maxX 1175
    expect(clampToArena({ x: 2000, y: 0 }, 25, ARENA)).toEqual({ x: 1175, y: 0 });
  });

  it('아래쪽(음수) 벽을 넘으면 반경만큼 안쪽으로 클램프한다', () => {
    // halfH 1200, radius 25 → minY -1175
    expect(clampToArena({ x: 0, y: -2000 }, 25, ARENA)).toEqual({ x: 0, y: -1175 });
  });

  it('x·y를 동시에 클램프한다 (모서리)', () => {
    expect(clampToArena({ x: 5000, y: -5000 }, 25, ARENA)).toEqual({ x: 1175, y: -1175 });
  });

  it('반경이 아레나 절반보다 크면 중앙(0)에 둔다', () => {
    // radius 2000 > halfW 1200 → 클램프 범위가 뒤집혀 중앙으로
    expect(clampToArena({ x: 500, y: 500 }, 2000, ARENA)).toEqual({ x: 0, y: 0 });
  });
});

describe('cameraFollowPosition — 팔로우 + 벽 클램프', () => {
  const VIEW_HALF_W = 640; // 1280 뷰 폭의 절반
  const VIEW_HALF_H = 360; // 720 뷰 높이의 절반

  it('플레이어가 중앙이면 카메라는 플레이어와 일치한다', () => {
    expect(cameraFollowPosition({ x: 0, y: 0 }, VIEW_HALF_W, VIEW_HALF_H, ARENA)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('여유가 있으면 카메라가 플레이어를 그대로 따라간다', () => {
    // |200| < halfW - viewHalfW = 560 → 클램프 없음
    expect(cameraFollowPosition({ x: 200, y: -100 }, VIEW_HALF_W, VIEW_HALF_H, ARENA)).toEqual({
      x: 200,
      y: -100,
    });
  });

  it('플레이어가 벽 근처면 뷰 가장자리가 벽에 맞도록 카메라를 멈춘다', () => {
    // halfW 1200, viewHalfW 640 → maxCamX 560. player 1100 → 560
    expect(cameraFollowPosition({ x: 1100, y: 0 }, VIEW_HALF_W, VIEW_HALF_H, ARENA)).toEqual({
      x: 560,
      y: 0,
    });
  });

  it('아레나가 뷰보다 작으면 카메라를 중앙(0)에 둬 전체가 보이게 한다', () => {
    const small = { width: 1000, height: 1000 }; // halfW 500 < viewHalfW 640
    expect(cameraFollowPosition({ x: 400, y: 0 }, VIEW_HALF_W, VIEW_HALF_H, small)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('isOutsideArena — 아레나 경계 + 여유 밖 판정 (발사체 컬링)', () => {
  const MARGIN = 100; // halfW 1200 + 100 = 1300

  it('아레나 안쪽은 밖이 아니다', () => {
    expect(isOutsideArena({ x: 1000, y: -1000 }, ARENA, MARGIN)).toBe(false);
  });

  it('경계+여유 정확히 위는 밖이 아니다 (경계 포함)', () => {
    expect(isOutsideArena({ x: 1300, y: 0 }, ARENA, MARGIN)).toBe(false);
  });

  it('x가 경계+여유를 넘으면 밖이다', () => {
    expect(isOutsideArena({ x: 1301, y: 0 }, ARENA, MARGIN)).toBe(true);
  });

  it('y가 경계+여유를 넘으면 밖이다', () => {
    expect(isOutsideArena({ x: 0, y: -1301 }, ARENA, MARGIN)).toBe(true);
  });
});
