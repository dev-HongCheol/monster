import { describe, expect, it } from 'vitest';
import { cameraFollowPosition } from '../../game/assets/scripts/logic/ArenaLogic';
import {
  canSpawn,
  clampRecycleDistance,
  engagementRadius,
  MIN_SPAWN_MARGIN,
  maxSpawnDistance,
  offViewSpawnPoint,
  spawnPerimeterLength,
} from '../../game/assets/scripts/logic/SpawnGeometry';

/**
 * 계획 문서(2026-07-14-spawn-geometry-plan.md §3·§5·§6)의 순수 스폰 기하.
 *
 * 적을 카메라 뷰 사각형 **바깥** + 아레나 **안** 에서 뽑는다. 뷰 사각형은 플레이어가 아니라
 * **카메라**를 중심으로 잡는다 — 카메라는 벽에서 클램프되므로 플레이어가 벽에 붙으면
 * 플레이어는 화면 중앙이 아니고, 플레이어 기준으로 "충분히 멀다"고 뽑은 점이 반대편에서는
 * 여전히 화면 안일 수 있다.
 *
 * 파생 거리 3종은 뷰 크기에서 유도하며 `engagementRadius < maxSpawnDistance ≤ recycleDistance`
 * 순서가 구조적으로 성립한다(§5.2의 안전 계약). 순서가 깨지면 각각 "모든 적이 즉시 교전 중으로
 * 집계돼 구석 캠핑 수정이 무효화"·"스폰 직후 회수되는 루프"가 된다.
 *
 * Cocos 배선(EnemySpawner·CameraController)은 프레임워크 의존이라 7단계 수동 QA로 검증한다.
 */

/** 720p 기준 카메라 뷰 절반(16:9) — CameraController.orthoHeight = 360. */
const VIEW_HALF_W = 640;
const VIEW_HALF_H = 360;
/** 스폰 여유(px) — "화면 밖"의 계약. 적 최대 반경(40)보다 커야 몸통이 화면에서 태어나지 않는다. */
const MARGIN = 100;
/** 표준 서울 아레나 — halfW = halfH = 1200. */
const ARENA = { width: 2400, height: 2400 };
/** 표준 적 충돌 반경(처녀귀신). */
const RADIUS = 25;

/** 스폰 사각형 절반 크기 — 뷰 절반 + 여유. */
const HW = VIEW_HALF_W + MARGIN; // 740
const HH = VIEW_HALF_H + MARGIN; // 460

const EPS = 1e-6;

/** 실제 배선과 같은 경로로 카메라 위치를 얻는다(CameraController가 쓰는 함수 그대로). */
function camFor(player: { x: number; y: number }, arena = ARENA) {
  return cameraFollowPosition(player, VIEW_HALF_W, VIEW_HALF_H, arena);
}

/** 표준 인자로 스폰점 하나를 뽑는다. */
function spawn(player: { x: number; y: number }, roll: number, arena = ARENA, radius = RADIUS) {
  return offViewSpawnPoint(
    camFor(player, arena),
    player,
    VIEW_HALF_W,
    VIEW_HALF_H,
    MARGIN,
    arena,
    radius,
    roll,
  );
}

/** roll을 0~1로 촘촘히 훑는다(균등 샘플러라 경계 포함). */
const ROLLS = Array.from({ length: 21 }, (_, i) => i / 20);

/** 산술 평균 — 스폰 거리 분포를 비교할 때 쓴다. */
function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** 아레나 전역 — 중앙·변·구석 + 카메라 클램프 경계(±560 / ±840)를 포함한다. */
const PLAYER_GRID = [
  { x: 0, y: 0 },
  { x: 560, y: 0 },
  { x: 561, y: 0 },
  { x: 0, y: 840 },
  { x: -900, y: 300 },
  { x: 1175, y: 1175 },
  { x: -1175, y: 1175 },
  { x: 1175, y: -1175 },
  { x: -1175, y: -1175 },
  { x: 1100, y: -200 },
];

describe('파생 거리 — 뷰 크기에서 유도하고 순서를 보장한다', () => {
  it('engagementRadius는 "열린 곳에서 스폰될 수 있는 최대 거리"다 (스폰 사각 모서리)', () => {
    // hypot(640+100, 360+100) = hypot(740, 460)
    expect(engagementRadius(VIEW_HALF_W, VIEW_HALF_H, MARGIN)).toBeCloseTo(Math.hypot(740, 460), 6);
  });

  it('maxSpawnDistance는 카메라 클램프까지 감안한 최대 스폰 거리다', () => {
    // 플레이어는 카메라에서 최대 viewHalf만큼 벗어나고(벽 클램프), 스폰점은 viewHalf+margin 밖이다
    expect(maxSpawnDistance(VIEW_HALF_W, VIEW_HALF_H, MARGIN)).toBeCloseTo(
      Math.hypot(2 * 640 + 100, 2 * 360 + 100),
      6,
    );
  });

  it('engagementRadius < maxSpawnDistance — 모든 종횡비·여유에서 (안전 계약)', () => {
    const views = [
      [640, 360], // 16:9
      [360, 640], // 세로 창
      [840, 360], // 21:9
      [1600, 900], // 뷰가 아레나보다 넓음
      [1, 1],
    ];
    for (const [w, h] of views) {
      for (const m of [0, 40, 100, 400]) {
        expect(engagementRadius(w, h, m)).toBeLessThan(maxSpawnDistance(w, h, m));
      }
    }
  });

  it('margin은 하한(MIN_SPAWN_MARGIN)이 있다 — 0·음수·NaN이면 하한으로 올린다', () => {
    const atFloor = engagementRadius(VIEW_HALF_W, VIEW_HALF_H, MIN_SPAWN_MARGIN);
    expect(engagementRadius(VIEW_HALF_W, VIEW_HALF_H, 0)).toBeCloseTo(atFloor, 6);
    expect(engagementRadius(VIEW_HALF_W, VIEW_HALF_H, -50)).toBeCloseTo(atFloor, 6);
    expect(engagementRadius(VIEW_HALF_W, VIEW_HALF_H, Number.NaN)).toBeCloseTo(atFloor, 6);
  });

  it('MIN_SPAWN_MARGIN은 적 최대 충돌 반경(40) 이상이다 — 몸통 절반이 화면 안에서 태어나지 않도록', () => {
    expect(MIN_SPAWN_MARGIN).toBeGreaterThanOrEqual(40);
  });
});

describe('clampRecycleDistance — 재활용은 최대 스폰 거리보다 멀어야 한다', () => {
  const maxSpawn = maxSpawnDistance(VIEW_HALF_W, VIEW_HALF_H, MARGIN);

  it('요청값이 충분히 크면 그대로 쓴다', () => {
    expect(clampRecycleDistance(2200, VIEW_HALF_W, VIEW_HALF_H, MARGIN)).toBe(2200);
  });

  it('요청값이 최대 스폰 거리보다 작으면 그 위로 올린다 (스폰 직후 회수되는 루프 방지)', () => {
    expect(clampRecycleDistance(500, VIEW_HALF_W, VIEW_HALF_H, MARGIN)).toBeCloseTo(maxSpawn, 6);
  });

  it('0·음수·NaN 요청도 최대 스폰 거리로 올린다', () => {
    for (const bad of [0, -1, Number.NaN]) {
      expect(clampRecycleDistance(bad, VIEW_HALF_W, VIEW_HALF_H, MARGIN)).toBeCloseTo(maxSpawn, 6);
    }
  });
});

describe('spawnPerimeterLength — 아레나 밖 구간을 잘라낸 유효 둘레', () => {
  it('플레이어가 중앙이면 스폰 사각형 네 변이 모두 유효하다', () => {
    expect(spawnPerimeterLength(camFor({ x: 0, y: 0 }), VIEW_HALF_W, VIEW_HALF_H, MARGIN, ARENA, 0))
      // 사각 둘레 = 2*(2*HW) + 2*(2*HH)
      .toBeCloseTo(4 * (HW + HH), 6);
  });

  it('플레이어가 우상단 구석이면 좌·하 두 변만 남는다', () => {
    // cam = (560, 840) — x는 1200-640, y는 1200-360에서 클램프
    const cam = camFor({ x: 1175, y: 1175 });
    expect(cam).toEqual({ x: 560, y: 840 });

    // 좌변 x=-180 (y: 380..1175 → 795) + 하변 y=380 (x: -180..1175 → 1355)
    const len = spawnPerimeterLength(cam, VIEW_HALF_W, VIEW_HALF_H, MARGIN, ARENA, RADIUS);
    expect(len).toBeCloseTo(795 + 1355, 6);
  });

  it('아레나가 뷰보다 작으면 유효 둘레가 0이다 (퇴화 — 폴백 경로)', () => {
    const small = { width: 800, height: 800 };
    const cam = camFor({ x: 300, y: 300 }, small);
    expect(spawnPerimeterLength(cam, VIEW_HALF_W, VIEW_HALF_H, MARGIN, small, 0)).toBe(0);
  });

  it('아레나 데이터가 없으면(width<=0) 아레나 제약 없이 뷰 사각 둘레 전체를 쓴다', () => {
    const none = { width: 0, height: 0 };
    expect(
      spawnPerimeterLength({ x: 0, y: 0 }, VIEW_HALF_W, VIEW_HALF_H, MARGIN, none, RADIUS),
    ).toBeCloseTo(4 * (HW + HH), 6);
  });
});

describe('offViewSpawnPoint — 사후조건 (속성 테스트)', () => {
  it('모든 플레이어 위치 × roll에서 ① 뷰 밖 ② 아레나 안 ③ 최대 스폰 거리 이내', () => {
    const maxSpawn = maxSpawnDistance(VIEW_HALF_W, VIEW_HALF_H, MARGIN);
    for (const player of PLAYER_GRID) {
      const cam = camFor(player);
      for (const roll of ROLLS) {
        const p = spawn(player, roll);

        // ① 뷰 밖 — 카메라 기준으로 최소 viewHalf + margin 만큼 벗어나 있다
        const outside = Math.abs(p.x - cam.x) >= HW - EPS || Math.abs(p.y - cam.y) >= HH - EPS;
        expect(outside).toBe(true);

        // ② 아레나 안 — 적 반경까지 포함해 벽을 파고들지 않는다
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1200 - RADIUS + EPS);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(1200 - RADIUS + EPS);

        // ③ 재활용 루프 방지 — 스폰 직후 회수될 거리를 절대 돌려주지 않는다
        expect(Math.hypot(p.x - player.x, p.y - player.y)).toBeLessThanOrEqual(maxSpawn + EPS);
      }
    }
  });

  it('중앙 무손상 — 플레이어가 열린 곳이면 모든 스폰점이 교전 반경 안이다', () => {
    // 이 성질이 "maxEnemies를 교전 중인 적으로 세도 중앙 밸런스가 그대로"임을 보장한다(§5.2)
    const engage = engagementRadius(VIEW_HALF_W, VIEW_HALF_H, MARGIN);
    for (const player of [
      { x: 0, y: 0 },
      { x: 200, y: -100 },
      { x: -300, y: 400 },
    ]) {
      for (const roll of ROLLS) {
        const p = spawn(player, roll);
        expect(Math.hypot(p.x - player.x, p.y - player.y)).toBeLessThanOrEqual(engage + EPS);
      }
    }
  });

  it('구석 — 우상단에 붙으면 좌·하에서만 나오고 우·상에서는 절대 나오지 않는다 (F35)', () => {
    const player = { x: 1175, y: 1175 };
    for (const roll of ROLLS) {
      const p = spawn(player, roll);
      expect(p.x).toBeLessThanOrEqual(player.x + EPS);
      expect(p.y).toBeLessThanOrEqual(player.y + EPS);
      // 벽 쪽 구간이 유효 둘레에서 빠졌으므로 벽면에 눌린 클램프 몰림이 없다
      expect(p.x < player.x - EPS || p.y < player.y - EPS).toBe(true);
    }
  });

  it('구석 relief의 출처 — 구석 스폰점 대부분이 교전 반경 밖이다 (§5.2)', () => {
    // 이것이 구석 캠핑 수정의 동력이다. 구석에서는 스폰점 대부분이 교전 반경 밖이라 압박 상한을
    // 먹지 않고, 그래서 스포너가 멈추지 않는다. (전부는 아니다 — 스폰 사각 아래변의 가장 가까운
    // 끝은 플레이어 바로 아래 795px이라 교전 반경 871px 안이다. 그 적은 실제로 코앞이니 정직하다.)
    const engage = engagementRadius(VIEW_HALF_W, VIEW_HALF_H, MARGIN);
    const player = { x: 1175, y: 1175 };
    const dists = ROLLS.map((roll) => {
      const p = spawn(player, roll);
      return Math.hypot(p.x - player.x, p.y - player.y);
    });
    const beyond = dists.filter((d) => d > engage).length;
    expect(beyond).toBeGreaterThan(ROLLS.length / 2);

    // 그리고 평균 스폰 거리가 열린 곳보다 훨씬 멀다 — 상한을 먹지 않는 몫이 여기서 나온다.
    const centerMean = mean(
      ROLLS.map((roll) => {
        const p = spawn({ x: 0, y: 0 }, roll);
        return Math.hypot(p.x, p.y);
      }),
    );
    expect(mean(dists)).toBeGreaterThan(centerMean * 1.5);
  });

  it('카메라 기준 회귀 가드 — 스폰 사각형의 중심은 플레이어가 아니라 카메라다', () => {
    // 플레이어가 벽에 붙으면 카메라는 클램프돼 플레이어와 다른 곳에 있다.
    // 플레이어 기준으로 뽑으면 반대편 점이 화면 안에 들어와 회귀가 재발한다.
    const player = { x: 1100, y: 0 };
    const cam = camFor(player);
    expect(cam.x).toBe(560); // 클램프됨 — 플레이어(1100)와 다르다
    for (const roll of ROLLS) {
      const p = spawn(player, roll);
      const onSpawnRect =
        Math.abs(Math.abs(p.x - cam.x) - HW) < EPS || Math.abs(Math.abs(p.y - cam.y) - HH) < EPS;
      expect(onSpawnRect).toBe(true);
    }
  });

  it('결정성 — 같은 입력은 같은 출력', () => {
    const player = { x: -900, y: 300 };
    expect(spawn(player, 0.37)).toEqual(spawn(player, 0.37));
  });
});

describe('offViewSpawnPoint — 비정방 아레나·종횡비 변주 (축 스왑 회귀)', () => {
  const WIDE = { width: 3200, height: 1800 };

  it('3200×1800 아레나에서도 사후조건이 성립한다', () => {
    for (const player of [
      { x: 0, y: 0 },
      { x: 1575, y: 875 },
      { x: -1575, y: -875 },
      { x: 1500, y: 0 },
    ]) {
      const cam = camFor(player, WIDE);
      for (const roll of ROLLS) {
        const p = spawn(player, roll, WIDE);
        const outside = Math.abs(p.x - cam.x) >= HW - EPS || Math.abs(p.y - cam.y) >= HH - EPS;
        expect(outside).toBe(true);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1600 - RADIUS + EPS);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(900 - RADIUS + EPS);
      }
    }
  });

  it('세로 창(뷰 절반 360×640)에서도 뷰 밖·아레나 안이다', () => {
    const player = { x: 800, y: 800 };
    const cam = cameraFollowPosition(player, 360, 640, ARENA);
    for (const roll of ROLLS) {
      const p = offViewSpawnPoint(cam, player, 360, 640, MARGIN, ARENA, RADIUS, roll);
      const outside =
        Math.abs(p.x - cam.x) >= 360 + MARGIN - EPS || Math.abs(p.y - cam.y) >= 640 + MARGIN - EPS;
      expect(outside).toBe(true);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1200 - RADIUS + EPS);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1200 - RADIUS + EPS);
    }
  });
});

describe('offViewSpawnPoint — 퇴화 입력 (조용한 폴백이 곧 플레이어 위 스폰)', () => {
  it('아레나 데이터가 없으면(width<=0) 뷰 사각 둘레에서만 뽑는다 — 원점으로 붕괴하지 않는다', () => {
    const none = { width: 0, height: 0 };
    const player = { x: 500, y: -300 };
    for (const roll of ROLLS) {
      const p = offViewSpawnPoint(
        player,
        player,
        VIEW_HALF_W,
        VIEW_HALF_H,
        MARGIN,
        none,
        RADIUS,
        roll,
      );
      const outside = Math.abs(p.x - player.x) >= HW - EPS || Math.abs(p.y - player.y) >= HH - EPS;
      expect(outside).toBe(true);
    }
  });

  it('아레나가 뷰보다 작으면 플레이어에게서 가장 먼 아레나 안쪽 점으로 폴백한다 (중심 금지)', () => {
    const small = { width: 800, height: 800 };
    const player = { x: 300, y: 300 };
    const p = spawn(player, 0.5, small, 0);
    // 반대편 구석 — 중앙(0,0) = 플레이어 근처로 돌아가지 않는다
    expect(p).toEqual({ x: -400, y: -400 });
  });

  it('roll이 범위를 벗어나거나 NaN이어도 유효한 점을 돌려준다', () => {
    const player = { x: 0, y: 0 };
    for (const roll of [-1, 0, 1, 2, Number.NaN]) {
      const p = spawn(player, roll);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      const outside = Math.abs(p.x) >= HW - EPS || Math.abs(p.y) >= HH - EPS;
      expect(outside).toBe(true);
    }
  });

  it('뷰 절반이 0·음수·NaN이어도 유한한 점을 돌려준다 (NaN 좌표 적은 상한 슬롯을 영구 점유한다)', () => {
    const player = { x: 0, y: 0 };
    for (const bad of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const p = offViewSpawnPoint(player, player, bad, bad, MARGIN, ARENA, RADIUS, 0.5);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('반경이 0·40·아레나 절반 초과여도 아레나 안이다', () => {
    const player = { x: 0, y: 0 };
    for (const radius of [0, 40, 5000]) {
      const p = spawn(player, 0.25, ARENA, radius);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1200 + EPS);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1200 + EPS);
    }
  });
});

describe('canSpawn — 압박 상한(교전) + 성능 상한(이동 중)', () => {
  it('둘 다 여유가 있으면 스폰한다', () => {
    expect(canSpawn(10, 5, 20, 25)).toBe(true);
  });

  it('교전 중인 적이 상한이면 보류한다', () => {
    expect(canSpawn(20, 0, 20, 25)).toBe(false);
  });

  it('이동 중인 적이 상한이면 보류한다 (파이프라인 무제한 증식 차단)', () => {
    expect(canSpawn(0, 25, 20, 25)).toBe(false);
  });

  it('도착하지 않은 적은 압박 상한을 먹지 않는다 — 구석 캠핑이 스폰을 멈추지 못한다', () => {
    // 살아 있는 적 30마리 중 교전 중은 2마리뿐(28마리가 구석으로 걸어오는 중)
    expect(canSpawn(2, 24, 20, 25)).toBe(true);
  });

  it('NaN·음수 상한이면 보류한다 (조용한 폭주 대신 멈춤)', () => {
    expect(canSpawn(0, 0, Number.NaN, 25)).toBe(false);
    expect(canSpawn(0, 0, 20, Number.NaN)).toBe(false);
    expect(canSpawn(0, 0, -1, 25)).toBe(false);
  });
});
