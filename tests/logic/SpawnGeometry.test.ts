import { describe, expect, it } from 'vitest';
import { cameraFollowPosition } from '../../game/assets/scripts/logic/ArenaLogic';
import {
  canSpawn,
  clampRecycleDistance,
  classifyByDistance,
  engagementRadius,
  MIN_SPAWN_MARGIN,
  maxSpawnDistance,
  offViewSpawnPoint,
  type SpawnField,
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

/** 표준 스폰 필드 — 카메라는 실제 배선과 같이 벽 클램프를 거쳐 얻는다. */
function fieldFor(
  player: { x: number; y: number },
  arena = ARENA,
  radius = RADIUS,
  viewHalfW = VIEW_HALF_W,
  viewHalfH = VIEW_HALF_H,
): SpawnField {
  return {
    cam: cameraFollowPosition(player, viewHalfW, viewHalfH, arena),
    player,
    viewHalfW,
    viewHalfH,
    margin: MARGIN,
    arena,
    radius,
  };
}

/** 표준 인자로 스폰점 하나를 뽑는다. */
function spawn(player: { x: number; y: number }, roll: number, arena = ARENA, radius = RADIUS) {
  return offViewSpawnPoint(fieldFor(player, arena, radius), roll);
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

  it('engagementRadius < maxSpawnDistance ≤ recycleDistance — 모든 종횡비·여유에서 (안전 계약)', () => {
    const views = [
      [640, 360], // 16:9
      [360, 640], // 세로 창
      [840, 360], // 21:9
      [1600, 900], // 뷰가 아레나보다 넓음
      [1, 1],
    ];
    for (const [w, h] of views) {
      for (const m of [0, 40, 100, 400]) {
        const engage = engagementRadius(w, h, m);
        const maxSpawn = maxSpawnDistance(w, h, m);
        expect(engage).toBeLessThan(maxSpawn);
        // 셋째 고리 — 인스펙터가 어떤 값을 주든 재활용 거리는 최대 스폰 거리 아래로 못 내려간다
        for (const requested of [0, 500, 2200, Number.NaN]) {
          expect(clampRecycleDistance(requested, w, h, m)).toBeGreaterThanOrEqual(maxSpawn);
        }
      }
    }
  });

  it('뷰가 퇴화(절반 0)면 두 거리가 같아진다 — 이때 호출부는 스폰을 보류한다', () => {
    // 순서 불변식의 유일한 예외. EnemySpawner가 viewHalfW <= 0에서 그 프레임을 건너뛰므로
    // 실제 스폰 경로에는 도달하지 않는다. 계약을 문서화해 두어 나중에 "왜 <가 아니지"로 새지 않게 한다.
    expect(engagementRadius(0, 0, MARGIN)).toBe(maxSpawnDistance(0, 0, MARGIN));
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
    // 사각 둘레 = 2*(2*HW) + 2*(2*HH)
    expect(spawnPerimeterLength(fieldFor({ x: 0, y: 0 }, ARENA, 0))).toBeCloseTo(4 * (HW + HH), 6);
  });

  it('플레이어가 우상단 구석이면 좌·하 두 변만 남는다', () => {
    // cam = (560, 840) — x는 1200-640, y는 1200-360에서 클램프
    expect(camFor({ x: 1175, y: 1175 })).toEqual({ x: 560, y: 840 });

    // 좌변 x=-180 (y: 380..1175 → 795) + 하변 y=380 (x: -180..1175 → 1355)
    expect(spawnPerimeterLength(fieldFor({ x: 1175, y: 1175 }))).toBeCloseTo(795 + 1355, 6);
  });

  it('아레나가 뷰보다 작으면 유효 둘레가 0이다 (퇴화 — 폴백 경로)', () => {
    const small = { width: 800, height: 800 };
    expect(spawnPerimeterLength(fieldFor({ x: 300, y: 300 }, small, 0))).toBe(0);
  });

  it('아레나 데이터가 없으면(width<=0) 아레나 제약 없이 뷰 사각 둘레 전체를 쓴다', () => {
    const none = { width: 0, height: 0 };
    expect(spawnPerimeterLength(fieldFor({ x: 0, y: 0 }, none))).toBeCloseTo(4 * (HW + HH), 6);
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
    const field = fieldFor(player, ARENA, RADIUS, 360, 640);
    for (const roll of ROLLS) {
      const p = offViewSpawnPoint(field, roll);
      const outside =
        Math.abs(p.x - field.cam.x) >= 360 + MARGIN - EPS ||
        Math.abs(p.y - field.cam.y) >= 640 + MARGIN - EPS;
      expect(outside).toBe(true);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1200 - RADIUS + EPS);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1200 - RADIUS + EPS);
    }
  });
});

describe('offViewSpawnPoint — 퇴화 입력 (조용한 폴백이 곧 플레이어 위 스폰)', () => {
  it('아레나 데이터가 없으면(width<=0) 아레나 제약 없이 뷰 사각 둘레에서 뽑는다', () => {
    // 맵 데이터가 깨지면 CameraController가 lateUpdate를 조기 반환해 카메라가 그 자리에 멈춘다.
    // 그래도 계약은 그대로다 — 스폰점은 그 멈춘 카메라의 뷰 밖이다. 이 분기가 없으면 네 변이 전부
    // 잘려 유효 둘레가 0이 되고, 폴백이 플레이어 근처로 적을 쏟아 놓는다.
    const none = { width: 0, height: 0 };
    const field = fieldFor({ x: 500, y: -300 }, none);
    for (const roll of ROLLS) {
      const p = offViewSpawnPoint(field, roll);
      const outside =
        Math.abs(p.x - field.cam.x) >= HW - EPS || Math.abs(p.y - field.cam.y) >= HH - EPS;
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

  it('폴백도 최대 스폰 거리를 넘지 않는다 — 스폰 즉시 회수되는 무한 churn 방지 (정상 아레나)', () => {
    // 사후조건 ③은 폴백 경로에서도 지켜져야 한다. 안 그러면 재활용 거리를 하한(=maxSpawnDistance)까지
    // 낮춘 설정에서 스폰 → 즉시 회수가 무한 반복돼 화면에 적이 하나도 없게 된다.
    //
    // 성질은 기하가 스스로 보장한다. 네 변이 전부 잘리려면(=폴백) 카메라가 아레나 중앙 근처여야 하고,
    // 그러려면 아레나가 충분히 작아야 하므로 대각선이 maxSpawnDistance 아래로 묶인다. 손으로 고른
    // 몇 점이 아니라 폴백이 발생하는 영역을 훑어 이 자기 제한을 못박는다.
    //
    // 전제조건은 "아레나가 적 지름보다 크다"(아래 별도 테스트 참고). 여기서는 그 조건을 만족하는
    // 정상 아레나만 훑는다 — 200px부터 시작하므로 모든 표본이 2·radius(50)를 넘는다.
    const maxSpawn = maxSpawnDistance(VIEW_HALF_W, VIEW_HALF_H, MARGIN);
    let fallbackCases = 0;

    for (let w = 200; w <= 2000; w += 60) {
      for (let h = 200; h <= 2000; h += 60) {
        const arena = { width: w, height: h };
        const hx = Math.max(0, w / 2 - RADIUS);
        const hy = Math.max(0, h / 2 - RADIUS);
        for (const px of [-hx, 0, hx]) {
          for (const py of [-hy, 0, hy]) {
            const player = { x: px, y: py };
            const field = fieldFor(player, arena);
            if (spawnPerimeterLength(field) > 0) continue; // 폴백이 아닌 정상 경로
            fallbackCases++;
            const p = offViewSpawnPoint(field, 0.5);
            expect(Math.hypot(p.x - px, p.y - py)).toBeLessThanOrEqual(maxSpawn + EPS);
            // 폴백점은 여전히 아레나 안이다
            expect(Math.abs(p.x)).toBeLessThanOrEqual(w / 2 + EPS);
            expect(Math.abs(p.y)).toBeLessThanOrEqual(h / 2 + EPS);
          }
        }
      }
    }
    expect(fallbackCases).toBeGreaterThan(100); // 폴백 영역을 실제로 훑었는지 확인
  });

  it('아레나가 적 지름보다 얇으면 사후조건 ③의 전제가 깨진다 — 알려진 한계를 고정한다', () => {
    // 위 불변식의 전제조건("아레나 > 적 지름")이 왜 필요한지 못박는다. 2400×50 아레나는 적(반경 25,
    // 지름 50)을 놓을 세로 띠가 아예 없다. 그러면 네 변이 "카메라가 중앙이라서"가 아니라 "둘 곳이
    // 없어서" 잘리고, 자기 제한 논증이 무너져 폴백이 아레나 반대편 끝을 돌려준다.
    //
    // 이건 버그가 아니라 플레이 불가능한 맵 데이터다(호출부가 1회 경고한다). 그래도 동작을 고정해
    // 두어야 나중에 "왜 여기선 ③이 안 지켜지지"로 새지 않는다.
    const sliver = { width: 2400, height: 50 };
    const player = { x: -1175, y: 0 };
    const p = spawn(player, 0.5, sliver, 25);

    // 폴백은 여전히 플레이어에게서 가장 먼 아레나 안쪽 점이다(플레이어 위 스폰만은 절대 안 한다)
    expect(p).toEqual({ x: 1175, y: 0 });
    // 그리고 그 거리가 최대 스폰 거리를 넘는다 — 정상 맵에서는 일어나지 않는 일이다
    expect(Math.hypot(p.x - player.x, p.y - player.y)).toBeGreaterThan(
      maxSpawnDistance(VIEW_HALF_W, VIEW_HALF_H, MARGIN),
    );
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

  it('뷰 절반이 0·음수·NaN·무한대여도 유한한 점을 돌려준다', () => {
    const player = { x: 0, y: 0 };
    for (const bad of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const p = offViewSpawnPoint(fieldFor(player, ARENA, RADIUS, bad, bad), 0.5);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('카메라·플레이어 좌표가 NaN·무한대여도 유한한 점을 돌려준다 (좌표 NaN이 적을 유령으로 만든다)', () => {
    // NaN 좌표의 적은 재활용 거리 비교도 교전 판정도 전부 false가 돼, 죽지도 닿지도 사라지지도
    // 않으면서 이동 중 상한 슬롯을 영구 점유한다. 스폰 단계에서 NaN이 새어 나가면 안 된다.
    const bad = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const v of bad) {
      for (const field of [
        { ...fieldFor({ x: 0, y: 0 }), cam: { x: v, y: 0 } },
        { ...fieldFor({ x: 0, y: 0 }), cam: { x: 0, y: v } },
        { ...fieldFor({ x: 0, y: 0 }), player: { x: v, y: v } },
      ]) {
        const p = offViewSpawnPoint(field, 0.5);
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
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

describe('classifyByDistance — 매 프레임 스윕의 분류 규칙', () => {
  const ENGAGE_SQ = 871 ** 2;
  const RECYCLE_SQ = 2200 ** 2;

  it('교전 반경 안이면 engaged', () => {
    expect(classifyByDistance(500 ** 2, ENGAGE_SQ, RECYCLE_SQ)).toBe('engaged');
  });

  it('교전 반경 경계는 engaged에 포함한다', () => {
    expect(classifyByDistance(ENGAGE_SQ, ENGAGE_SQ, RECYCLE_SQ)).toBe('engaged');
  });

  it('교전 반경 밖·재활용 거리 안이면 inbound (걸어오는 중 — 압박 상한을 먹지 않는다)', () => {
    expect(classifyByDistance(1500 ** 2, ENGAGE_SQ, RECYCLE_SQ)).toBe('inbound');
  });

  it('재활용 거리 경계는 아직 회수하지 않는다 (스폰 직후 회수 루프 방지의 경계)', () => {
    expect(classifyByDistance(RECYCLE_SQ, ENGAGE_SQ, RECYCLE_SQ)).toBe('inbound');
  });

  it('재활용 거리를 넘으면 recycle', () => {
    expect(classifyByDistance(2500 ** 2, ENGAGE_SQ, RECYCLE_SQ)).toBe('recycle');
  });

  it('거리가 NaN·무한대면 recycle — 유령 적이 상한 슬롯을 영구 점유하지 못하게 한다', () => {
    // 순진하게 비교하면 NaN은 모든 비교가 false라 "회수도 안 되고 교전도 아닌" inbound로 빠져
    // 슬롯을 영원히 점유한다. 분류를 명시적으로 recycle로 몰아 스스로 청소되게 한다.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(classifyByDistance(bad, ENGAGE_SQ, RECYCLE_SQ)).toBe('recycle');
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
