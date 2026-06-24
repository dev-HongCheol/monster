import { describe, expect, it } from 'vitest';
import { ORB_GAP, ORB_MARGIN, OrbitLogic } from '../../game/assets/scripts/logic/OrbitLogic';

/** 기본 spawn 인자 — 개별 테스트가 필요한 필드만 덮어쓴다. */
function spawnArgs(overrides: Partial<Parameters<OrbitLogic['spawn']>[1]> = {}) {
  return {
    count: 2,
    orbSize: 14,
    damage: 6,
    lifetime: 100, // 회전·배치 테스트가 수명 만료로 방해받지 않게 길게
    rotationSpeedDeg: 90,
    ...overrides,
  };
}

describe('OrbitLogic — 오브 배치 (360/N 균등)', () => {
  it('count=2 → 마주보는 두 오브 (theta=0: +x, -x)', () => {
    const logic = new OrbitLogic();
    logic.spawn('inferno', spawnArgs({ count: 2 }));
    const pos = logic.orbPositions('inferno', 2, 80, 0, 0);
    expect(pos).toHaveLength(2);
    expect(pos[0].x).toBeCloseTo(80);
    expect(pos[0].y).toBeCloseTo(0);
    expect(pos[1].x).toBeCloseTo(-80);
    expect(pos[1].y).toBeCloseTo(0);
  });

  it('count=4 → 십자 배치 (theta=0: +x, +y, -x, -y)', () => {
    const logic = new OrbitLogic();
    logic.spawn('inferno', spawnArgs({ count: 4 }));
    const pos = logic.orbPositions('inferno', 4, 80, 0, 0);
    expect(pos).toHaveLength(4);
    expect(pos[0].x).toBeCloseTo(80);
    expect(pos[0].y).toBeCloseTo(0);
    expect(pos[1].x).toBeCloseTo(0);
    expect(pos[1].y).toBeCloseTo(80);
    expect(pos[2].x).toBeCloseTo(-80);
    expect(pos[2].y).toBeCloseTo(0);
    expect(pos[3].x).toBeCloseTo(0);
    expect(pos[3].y).toBeCloseTo(-80);
  });

  it('중심 좌표를 더해 월드 위치로 옮긴다', () => {
    const logic = new OrbitLogic();
    logic.spawn('inferno', spawnArgs({ count: 2 }));
    const pos = logic.orbPositions('inferno', 2, 80, 100, 50);
    expect(pos[0].x).toBeCloseTo(180);
    expect(pos[0].y).toBeCloseTo(50);
    expect(pos[1].x).toBeCloseTo(20);
    expect(pos[1].y).toBeCloseTo(50);
  });
});

describe('OrbitLogic — 회전 (advance)', () => {
  it('rotationSpeedDeg × dt 만큼 각이 전진한다 (90°/s × 1s → 90° 회전)', () => {
    const logic = new OrbitLogic();
    logic.spawn('inferno', spawnArgs({ count: 2, rotationSpeedDeg: 90 }));
    logic.advance(1.0);
    const pos = logic.orbPositions('inferno', 2, 80, 0, 0);
    // theta=90 → orb0 = +y, orb1 = -y
    expect(pos[0].x).toBeCloseTo(0);
    expect(pos[0].y).toBeCloseTo(80);
    expect(pos[1].x).toBeCloseTo(0);
    expect(pos[1].y).toBeCloseTo(-80);
  });

  it('각도는 360°에서 wrap된다 (360°/s × 1.25s → 450° ≡ 90°)', () => {
    const logic = new OrbitLogic();
    logic.spawn('inferno', spawnArgs({ count: 2, rotationSpeedDeg: 360 }));
    logic.advance(1.25);
    const pos = logic.orbPositions('inferno', 2, 80, 0, 0);
    expect(pos[0].x).toBeCloseTo(0);
    expect(pos[0].y).toBeCloseTo(80);
  });
});

describe('OrbitLogic — 활성 수명', () => {
  it('수명 동안은 active, 수명 경과 시 expired', () => {
    const logic = new OrbitLogic();
    logic.spawn('inferno', spawnArgs({ lifetime: 1.0 }));

    const r1 = logic.advance(0.5);
    expect(r1.active.map((a) => a.spellId)).toContain('inferno');
    expect(r1.expired).not.toContain('inferno');

    const r2 = logic.advance(0.6); // 누적 1.1 > 1.0
    expect(r2.expired).toContain('inferno');
    expect(r2.active.map((a) => a.spellId)).not.toContain('inferno');
  });

  it('만료된 궤도는 이후 advance에서 더 이상 나오지 않는다', () => {
    const logic = new OrbitLogic();
    logic.spawn('inferno', spawnArgs({ lifetime: 0.5 }));
    logic.advance(0.6); // 만료
    const r = logic.advance(0.1);
    expect(r.active).toHaveLength(0);
    expect(r.expired).toHaveLength(0);
  });

  it('지대 0개 → {active:[], expired:[]}', () => {
    const logic = new OrbitLogic();
    const r = logic.advance(0.5);
    expect(r.active).toEqual([]);
    expect(r.expired).toEqual([]);
  });
});

describe('OrbitLogic — 재시전 갱신 (단일 인스턴스 재스냅샷)', () => {
  it('재시전 시 인스턴스가 둘로 늘지 않고 하나로 유지된다', () => {
    const logic = new OrbitLogic();
    logic.spawn('inferno', spawnArgs({ count: 2, lifetime: 1.0 }));
    logic.advance(0.5);
    logic.spawn('inferno', spawnArgs({ count: 4, lifetime: 3.0 }));
    const r = logic.advance(0.1);
    expect(r.active).toHaveLength(1);
  });

  it('재시전이 수명·수·크기·데미지를 전부 새 값으로 덮어쓴다', () => {
    const logic = new OrbitLogic();
    logic.spawn('inferno', spawnArgs({ count: 2, orbSize: 14, damage: 6, lifetime: 1.0 }));
    logic.advance(0.5); // 남은 수명 0.5
    logic.spawn('inferno', spawnArgs({ count: 4, orbSize: 20, damage: 99, lifetime: 3.0 }));

    const r = logic.advance(0.1); // 새 수명 3.0 기준이라 아직 살아 있어야 함
    expect(r.expired).not.toContain('inferno');
    const a = r.active.find((x) => x.spellId === 'inferno');
    expect(a?.count).toBe(4);
    expect(a?.orbSize).toBe(20);
    expect(a?.damage).toBe(99);
  });
});

describe('OrbitLogic — 동적 링 반경', () => {
  it('오브가 적고 작으면 바닥값(orbitRadius)에 머문다', () => {
    // count=2·orbSize=14: spacing·clearance 모두 바닥값 80보다 작음 → 80
    expect(new OrbitLogic().ringRadius(2, 14, 10, 80)).toBeCloseTo(80);
  });

  it('오브가 많고 크면 겹침 회피로 링이 확장된다 (간격 지배)', () => {
    // spacing = orbSize·(1+GAP) / sin(π/N)
    const expected = (40 * (1 + ORB_GAP)) / Math.sin(Math.PI / 10);
    expect(new OrbitLogic().ringRadius(10, 40, 10, 80)).toBeCloseTo(expected);
    expect(expected).toBeGreaterThan(80); // 실제로 바닥값을 넘는다
  });

  it('플레이어가 크면 파묻힘 회피로 링이 확장된다 (clearance 지배)', () => {
    // clearance = playerRadius + orbSize + MARGIN
    const expected = 200 + 5 + ORB_MARGIN;
    expect(new OrbitLogic().ringRadius(2, 5, 200, 80)).toBeCloseTo(expected);
  });

  it('count=1 가드 — 0 나눗셈 없이 유한값 (바닥값)', () => {
    const r = new OrbitLogic().ringRadius(1, 14, 10, 80);
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeCloseTo(80);
  });
});

describe('OrbitLogic — 재타격 락아웃', () => {
  it('타격 등록 후 그 (오브, 적)은 락아웃 동안 다시 못 맞는다', () => {
    const logic = new OrbitLogic();
    expect(logic.canHit(0, 7)).toBe(true); // 등록 전엔 가능
    logic.registerHit(0, 7, 0.5);
    expect(logic.canHit(0, 7)).toBe(false);
  });

  it('락아웃은 다른 오브·다른 적과 독립이다', () => {
    const logic = new OrbitLogic();
    logic.registerHit(0, 7, 0.5);
    expect(logic.canHit(1, 7)).toBe(true); // 다른 오브
    expect(logic.canHit(0, 8)).toBe(true); // 다른 적
  });

  it('tickRehit로 락아웃이 경과하면 다시 맞을 수 있다', () => {
    const logic = new OrbitLogic();
    logic.registerHit(0, 7, 0.5);
    logic.tickRehit(0.3);
    expect(logic.canHit(0, 7)).toBe(false); // 아직 남음
    logic.tickRehit(0.2);
    expect(logic.canHit(0, 7)).toBe(true); // 경과
  });
});
