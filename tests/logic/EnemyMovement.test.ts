import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { IEnemyData, ISpawnTableEntry } from '../../game/assets/scripts/data/GameTypes';
// 아직 존재하지 않는 순수 모듈 — 이 import가 RED를 만든다(구현 단계에서 생성).
import {
  type LungeParams,
  LungeState,
  lungeMovement,
  lungeReach,
  tickLunge,
  type Vec2,
  vectorToAngle,
  windupBlend,
  zigzagDirection,
} from '../../game/assets/scripts/logic/MovementLogic';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/** repo 루트 기준 상대 경로의 JSON을 읽어 파싱한다. */
function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as T;
}

/** S1 이동 파라미터 — GameTypes에 moveParams가 들어오기 전까지 테스트 로컬 타입으로 읽는다. */
interface IMoveParams {
  zigzagAmplitude?: number;
  zigzagPeriod?: number;
  lungeRange?: number;
  lungeWindup?: number;
  lungeSpeed?: number;
  lungeDuration?: number;
  lungeCooldown?: number;
}
type EnemyWithMove = IEnemyData & { moveParams?: IMoveParams };

const ENEMIES = readJson<EnemyWithMove[]>('game/assets/resources/data/enemies.json');
const SPAWN_TABLE = readJson<ISpawnTableEntry[]>('game/assets/resources/data/spawn-table.json');

/** 돌진 파라미터 placeholder — 전이 테스트 기준값. */
const P: LungeParams = {
  lungeRange: 200,
  lungeWindup: 0.5,
  lungeSpeed: 600,
  lungeDuration: 0.3,
  lungeCooldown: 1.5,
};
const NEAR: Vec2 = { x: 100, y: 0 }; // dist 100 < range 200
const FAR: Vec2 = { x: 500, y: 0 }; // dist 500 > range 200

// ────────────────────────────── 지그재그 ──────────────────────────────

describe('MovementLogic — 지그재그 방향', () => {
  it('위상 0(elapsed=0)에서는 순수 추격 방향이다', () => {
    const dir = zigzagDirection({ x: 1, y: 0 }, 0, 0.6, 0.8);
    expect(dir.x).toBeCloseTo(1);
    expect(dir.y).toBeCloseTo(0);
  });

  it('¼주기에서 수직(좌/우 고정)으로 치우친다 — chirality 핀', () => {
    // toPlayer=+x, perp=+y(90° CCW). 위상 +1 → 방향이 +y로 기운다.
    const dir = zigzagDirection({ x: 1, y: 0 }, 0.8 / 4, 0.6, 0.8);
    expect(dir.y).toBeGreaterThan(0);
    expect(dir.x).toBeGreaterThan(0); // 여전히 전진 성분 보유
  });

  it('amplitude=0이면 항상 추격 방향과 동일(어둑시니 끄기)', () => {
    const dir = zigzagDirection({ x: 0, y: 1 }, 0.8 / 4, 0, 0.8);
    expect(dir.x).toBeCloseTo(0);
    expect(dir.y).toBeCloseTo(1);
  });

  it('period<=0 가드 — 분모 0(NaN) 대신 추격 방향 폴백', () => {
    const dir = zigzagDirection({ x: 1, y: 0 }, 0.3, 0.6, 0);
    expect(Number.isNaN(dir.x)).toBe(false);
    expect(dir.x).toBeCloseTo(1);
    expect(dir.y).toBeCloseTo(0);
  });

  it('toPlayer 영벡터(겹침) 가드 — 영벡터 반환(이동 건너뜀)', () => {
    const dir = zigzagDirection({ x: 0, y: 0 }, 0.2, 0.6, 0.8);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(0);
  });
});

// ────────────────────────────── 돌진 상태기계 ──────────────────────────────

describe('MovementLogic — 돌진 FSM 전이', () => {
  it('한 바퀴 순환: Chase→Windup→Lunge→Cooldown→Chase', () => {
    const r1 = tickLunge(LungeState.Chase, 0, NEAR, true, P, 0.016);
    expect(r1.state).toBe(LungeState.Windup);
    expect(r1.timer).toBeCloseTo(P.lungeWindup);

    const r2 = tickLunge(r1.state, r1.timer, NEAR, true, P, P.lungeWindup);
    expect(r2.state).toBe(LungeState.Lunge);
    expect(r2.timer).toBeCloseTo(P.lungeDuration);

    const r3 = tickLunge(r2.state, r2.timer, FAR, true, P, P.lungeDuration);
    expect(r3.state).toBe(LungeState.Cooldown);
    expect(r3.timer).toBeCloseTo(P.lungeCooldown);

    const r4 = tickLunge(r3.state, r3.timer, NEAR, true, P, P.lungeCooldown);
    expect(r4.state).toBe(LungeState.Chase);
  });

  it('사거리 밖이면 Chase 유지(윈드업 안 함)', () => {
    const r = tickLunge(LungeState.Chase, 0, FAR, true, P, 0.016);
    expect(r.state).toBe(LungeState.Chase);
    expect(r.lockDir).toBeUndefined();
  });

  it('lockDir은 Chase→Windup 진입 에지에서만 반환된다', () => {
    const entry = tickLunge(LungeState.Chase, 0, NEAR, true, P, 0.016);
    expect(entry.lockDir).toBeDefined();
    expect(entry.lockDir?.x).toBeCloseTo(1);
    expect(entry.lockDir?.y).toBeCloseTo(0);
    // 윈드업 진행 틱·돌진 틱은 lockDir을 다시 반환하지 않는다(컨트롤러가 최초값 유지).
    const mid = tickLunge(LungeState.Windup, 0.3, NEAR, true, P, 0.016);
    expect(mid.lockDir).toBeUndefined();
  });

  it('영벡터 잠금(플레이어가 적 위에 겹침) → 윈드업 건너뛰고 Chase 유지', () => {
    const r = tickLunge(LungeState.Chase, 0, { x: 0, y: 0 }, true, P, 0.016);
    expect(r.state).toBe(LungeState.Chase);
    expect(r.lockDir).toBeUndefined();
  });

  it('canAct=false면 FSM 전체 동결 — 상태·타이머 불변(헛돌진 방지)', () => {
    const frozen = tickLunge(LungeState.Lunge, 0.3, FAR, false, P, 0.3);
    expect(frozen.state).toBe(LungeState.Lunge);
    expect(frozen.timer).toBeCloseTo(0.3); // 타이머가 흐르지 않음
    // 정지 중에는 Chase에서 윈드업으로도 들어가지 않는다.
    const frozenChase = tickLunge(LungeState.Chase, 0, NEAR, false, P, 0.016);
    expect(frozenChase.state).toBe(LungeState.Chase);
  });

  it('커밋: 윈드업 중 플레이어가 사거리 밖으로 나가도 돌진을 수행한다', () => {
    const r = tickLunge(LungeState.Windup, P.lungeWindup, FAR, true, P, P.lungeWindup);
    expect(r.state).toBe(LungeState.Lunge);
  });

  it('Cooldown 중에는 사거리 안에 있어도 재돌진하지 않는다(타이머 소진 후에만)', () => {
    const r = tickLunge(LungeState.Cooldown, 1.0, NEAR, true, P, 0.1);
    expect(r.state).toBe(LungeState.Cooldown);
    expect(r.timer).toBeCloseTo(0.9);
  });

  it('dt 오버슈트 — 큰 dt 한 번에 한 상태만 전이(상태 건너뜀 없음)', () => {
    const r = tickLunge(LungeState.Windup, 0.2, FAR, true, P, 1.0);
    expect(r.state).toBe(LungeState.Lunge); // Cooldown으로 건너뛰지 않음
    expect(r.timer).toBeCloseTo(P.lungeDuration); // 오버슈트는 버리고 새 타이머 충전
  });
});

describe('MovementLogic — 상태별 이동 벡터', () => {
  it('Lunge는 잠금 방향으로, Windup은 정지(0), Chase는 플레이어 방향', () => {
    const lock: Vec2 = { x: 1, y: 0 };
    expect(lungeMovement(LungeState.Lunge, lock, FAR).x).toBeCloseTo(1);
    expect(lungeMovement(LungeState.Windup, lock, NEAR)).toEqual({ x: 0, y: 0 });
    const chase = lungeMovement(LungeState.Chase, lock, { x: 0, y: 50 });
    expect(chase.x).toBeCloseTo(0);
    expect(chase.y).toBeCloseTo(1);
  });
});

// ────────────────────────────── 텔레그래프·마커 기하 ──────────────────────────────

describe('MovementLogic — 텔레그래프·마커 기하', () => {
  it('windupBlend는 윈드업 진행에 따라 0→1로 램프된다', () => {
    expect(windupBlend(0, 0.5)).toBeCloseTo(0);
    expect(windupBlend(0.25, 0.5)).toBeCloseTo(0.5);
    expect(windupBlend(0.5, 0.5)).toBeCloseTo(1);
    expect(windupBlend(1, 0.5)).toBeCloseTo(1); // 상한 클램프
  });

  it('lungeReach = lungeSpeed × lungeDuration', () => {
    expect(lungeReach(P)).toBeCloseTo(600 * 0.3);
  });

  it('vectorToAngle: +x=0°, +y=90°, -x=180°', () => {
    expect(vectorToAngle({ x: 1, y: 0 })).toBeCloseTo(0);
    expect(vectorToAngle({ x: 0, y: 1 })).toBeCloseTo(90);
    expect(Math.abs(vectorToAngle({ x: -1, y: 0 }))).toBeCloseTo(180);
  });
});

// ────────────────────────────── 데이터 sanity (백로그 D2 선반영) ──────────────────────────────

/** S1 신규 적 2종과 그 이동·파라미터 정합. 필드 "존재"가 아니라 수치 유효성을 단언한다. */
describe('적 이동 S1 — 신규 2종 데이터 정합', () => {
  it('eodukshini: movement=zigzag, zigzagPeriod>0(분모 0=NaN 차단)·amplitude>=0', () => {
    const e = ENEMIES.find((x) => x.id === 'eodukshini');
    expect(e, "enemies.json에 'eodukshini'가 없다").toBeDefined();
    expect(e?.movement).toBe('zigzag');
    expect(e?.moveParams?.zigzagPeriod ?? 0).toBeGreaterThan(0);
    expect(e?.moveParams?.zigzagAmplitude ?? -1).toBeGreaterThanOrEqual(0);
  });

  it('bulgasari: movement=lunge, lunge 파라미터가 전부 유효(분모·정규화 값 >0)', () => {
    const e = ENEMIES.find((x) => x.id === 'bulgasari');
    expect(e, "enemies.json에 'bulgasari'가 없다").toBeDefined();
    expect(e?.movement).toBe('lunge');
    const mp = e?.moveParams ?? {};
    expect(mp.lungeRange ?? 0).toBeGreaterThan(0);
    expect(mp.lungeWindup ?? 0).toBeGreaterThan(0);
    expect(mp.lungeSpeed ?? 0).toBeGreaterThan(0);
    expect(mp.lungeDuration ?? 0).toBeGreaterThan(0);
    expect(mp.lungeCooldown ?? -1).toBeGreaterThanOrEqual(0);
  });
});

/** spawn-table.json의 모든 구간에서 참조되는 enemyId 집합. */
function referencedSpawnIds(): Set<string> {
  const referenced = new Set<string>();
  for (const entry of SPAWN_TABLE) {
    for (const id of Object.keys(entry.weights)) referenced.add(id);
  }
  return referenced;
}

describe('적 이동 S1 — 스폰 테이블 무결성', () => {
  it('spawn-table.json이 참조하는 모든 enemyId가 enemies.json에 존재한다', () => {
    const known = new Set(ENEMIES.map((e) => e.id));
    const missing = [...referencedSpawnIds()].filter((id) => !known.has(id));
    expect(missing, `enemies.json에 없는 스폰 id: ${missing.join(', ')}`).toEqual([]);
  });

  it('신규 2종(어둑시니·불가사리)이 spawn-table에 편입돼 실제 스폰된다', () => {
    const referenced = referencedSpawnIds();
    const unspawnable = ['eodukshini', 'bulgasari'].filter((id) => !referenced.has(id));
    expect(unspawnable, `어느 웨이브에서도 스폰되지 않는 적: ${unspawnable.join(', ')}`).toEqual(
      [],
    );
  });
});
