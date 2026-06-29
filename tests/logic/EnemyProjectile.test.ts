import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  IEnemyData,
  IEnemyMoveParams,
  ISpawnTableEntry,
} from '../../game/assets/scripts/data/GameTypes';
// 아직 존재하지 않는 순수 모듈/export — 이 import들이 RED를 만든다(구현 단계에서 생성).
import {
  type AttackParams,
  AttackState,
  MIN_ATTACK_COOLDOWN_SEC,
  tickAttack,
} from '../../game/assets/scripts/logic/EnemyAttackLogic';
import { kiteDirection, type Vec2 } from '../../game/assets/scripts/logic/MovementLogic';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/** repo 루트 기준 상대 경로의 JSON을 읽어 파싱한다. */
function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as T;
}

/** 공격 FSM 파라미터 placeholder — 전이 테스트 기준값. */
const A: AttackParams = {
  range: 400,
  telegraphTime: 0.4,
  cooldown: 1.2,
};
const NEAR: Vec2 = { x: 200, y: 0 }; // dist 200 < range 400
const FAR: Vec2 = { x: 700, y: 0 }; // dist 700 > range 400

// ────────────────────────────── 공격 FSM 전이 ──────────────────────────────

describe('EnemyAttackLogic — 공격 FSM 전이', () => {
  it('한 바퀴 순환: Aim→Telegraph→Fire→Cooldown→Aim', () => {
    const r1 = tickAttack(AttackState.Aim, 0, NEAR, true, A, 0.016);
    expect(r1.state).toBe(AttackState.Telegraph);
    expect(r1.timer).toBeCloseTo(A.telegraphTime);

    const r2 = tickAttack(r1.state, r1.timer, NEAR, true, A, A.telegraphTime);
    expect(r2.state).toBe(AttackState.Fire);
    expect(r2.fired).toBe(true);

    const r3 = tickAttack(r2.state, r2.timer, NEAR, true, A, 0.016);
    expect(r3.state).toBe(AttackState.Cooldown);
    expect(r3.timer).toBeCloseTo(A.cooldown);
    expect(r3.fired).toBeFalsy();

    const r4 = tickAttack(r3.state, r3.timer, NEAR, true, A, A.cooldown);
    expect(r4.state).toBe(AttackState.Aim);
  });

  it('한 주기에 정확히 한 번만 발사한다 — 재발사 없음 (핵심)', () => {
    let s = AttackState.Aim;
    let t = 0;
    let fires = 0;
    // 첫 발사 후 Cooldown을 거쳐 Aim으로 복귀하는 순간까지 한 주기를 센다.
    for (let i = 0; i < 1000; i++) {
      const r = tickAttack(s, t, NEAR, true, A, 0.02);
      if (r.fired) fires++;
      s = r.state;
      t = r.timer;
      if (fires > 0 && s === AttackState.Aim) break; // 한 주기 완료 직후 정지(재발사 전)
    }
    expect(fires).toBe(1);
  });

  it('Fire 직후 Cooldown 틱들은 재발사하지 않는다', () => {
    const fire = tickAttack(AttackState.Telegraph, 0, NEAR, true, A, 0.016);
    expect(fire.state).toBe(AttackState.Fire);
    expect(fire.fired).toBe(true);
    const cd = tickAttack(fire.state, fire.timer, NEAR, true, A, 0.016);
    expect(cd.state).toBe(AttackState.Cooldown);
    expect(cd.fired).toBeFalsy();
    const cd2 = tickAttack(cd.state, cd.timer, NEAR, true, A, 0.016);
    expect(cd2.fired).toBeFalsy();
  });

  it('사거리 밖이면 Aim 유지(텔레그래프 안 함)', () => {
    const r = tickAttack(AttackState.Aim, 0, FAR, true, A, 0.016);
    expect(r.state).toBe(AttackState.Aim);
    expect(r.lockDir).toBeUndefined();
  });

  it('range<=0이면 사거리 무제한 — 멀어도 발동', () => {
    const unlimited: AttackParams = { ...A, range: 0 };
    const r = tickAttack(AttackState.Aim, 0, FAR, true, unlimited, 0.016);
    expect(r.state).toBe(AttackState.Telegraph);
  });

  it('조준 잠금(lockDir)은 Aim→Telegraph 진입 에지에서만 반환된다', () => {
    const entry = tickAttack(AttackState.Aim, 0, NEAR, true, A, 0.016);
    expect(entry.lockDir).toBeDefined();
    expect(entry.lockDir?.x).toBeCloseTo(1);
    expect(entry.lockDir?.y).toBeCloseTo(0);
    // 텔레그래프 진행 틱은 lockDir을 다시 반환하지 않는다(컨트롤러가 최초값 유지).
    const mid = tickAttack(AttackState.Telegraph, 0.2, NEAR, true, A, 0.016);
    expect(mid.lockDir).toBeUndefined();
  });

  it('영벡터 잠금(플레이어가 적 위에 겹침) → 텔레그래프 건너뛰고 Aim 유지', () => {
    const r = tickAttack(AttackState.Aim, 0, { x: 0, y: 0 }, true, A, 0.016);
    expect(r.state).toBe(AttackState.Aim);
    expect(r.lockDir).toBeUndefined();
  });

  it('커밋: 윈드업 중 플레이어가 사거리 밖으로 나가도 발사한다', () => {
    const r = tickAttack(AttackState.Telegraph, A.telegraphTime, FAR, true, A, A.telegraphTime);
    expect(r.state).toBe(AttackState.Fire);
    expect(r.fired).toBe(true);
  });

  it('canAct=false면 FSM 전체 동결 — 상태·타이머 불변, 무발사', () => {
    const frozen = tickAttack(AttackState.Telegraph, 0.2, NEAR, false, A, 0.2);
    expect(frozen.state).toBe(AttackState.Telegraph);
    expect(frozen.timer).toBeCloseTo(0.2); // 타이머가 흐르지 않음
    expect(frozen.fired).toBeFalsy();
    // 정지 중에는 Aim에서 텔레그래프로도 들어가지 않는다.
    const frozenAim = tickAttack(AttackState.Aim, 0, NEAR, false, A, 0.016);
    expect(frozenAim.state).toBe(AttackState.Aim);
  });

  it('telegraphTime=0 즉발 — 텔레그래프 진입 직후 발사', () => {
    const instant: AttackParams = { ...A, telegraphTime: 0 };
    const enter = tickAttack(AttackState.Aim, 0, NEAR, true, instant, 0.016);
    expect(enter.state).toBe(AttackState.Telegraph);
    expect(enter.timer).toBeCloseTo(0);
    const fire = tickAttack(enter.state, enter.timer, NEAR, true, instant, 0.016);
    expect(fire.state).toBe(AttackState.Fire);
    expect(fire.fired).toBe(true);
  });

  it('cooldown=0이면 하한으로 클램프(매 프레임 발사 폭주 방지)', () => {
    const noCd: AttackParams = { ...A, cooldown: 0 };
    const cd = tickAttack(AttackState.Fire, 0, NEAR, true, noCd, 0.016);
    expect(cd.state).toBe(AttackState.Cooldown);
    expect(cd.timer).toBeCloseTo(MIN_ATTACK_COOLDOWN_SEC);
    expect(cd.timer).toBeGreaterThan(0);
  });

  it('dt 오버슈트 — 큰 dt 한 번에 한 상태만 전이(상태 건너뜀 없음)', () => {
    const r = tickAttack(AttackState.Telegraph, 0.2, FAR, true, A, 1.0);
    expect(r.state).toBe(AttackState.Fire); // Cooldown으로 건너뛰지 않음
    expect(r.fired).toBe(true);
    const r2 = tickAttack(AttackState.Cooldown, 0.1, NEAR, true, A, 1.0);
    expect(r2.state).toBe(AttackState.Aim); // Telegraph로 건너뛰지 않음
  });
});

// ────────────────────────────── 유격(kite) 방향 ──────────────────────────────

describe('MovementLogic — 유격(kite) 방향', () => {
  const PREF = 300;
  const BAND = 40;

  it('선호 사거리+밴드보다 멀면 접근(플레이어 향 단위벡터)', () => {
    const d = kiteDirection({ x: 500, y: 0 }, PREF, BAND);
    expect(d.x).toBeCloseTo(1);
    expect(d.y).toBeCloseTo(0);
  });

  it('선호 사거리−밴드보다 가까우면 후퇴(반대 단위벡터)', () => {
    const d = kiteDirection({ x: 100, y: 0 }, PREF, BAND);
    expect(d.x).toBeCloseTo(-1);
    expect(d.y).toBeCloseTo(0);
  });

  it('데드존(밴드 안)이면 영벡터 — 경계 떨림 0 (핵심)', () => {
    const d = kiteDirection({ x: 300, y: 0 }, PREF, BAND);
    expect(d).toEqual({ x: 0, y: 0 });
  });

  it('겹침(영벡터 입력)이면 영벡터 — NaN 없음', () => {
    const d = kiteDirection({ x: 0, y: 0 }, PREF, BAND);
    expect(Number.isNaN(d.x)).toBe(false);
    expect(d).toEqual({ x: 0, y: 0 });
  });

  it('preferredRange=0이면 추격 폴백(항상 접근)', () => {
    const d = kiteDirection({ x: 0, y: 250 }, 0, BAND);
    expect(d.x).toBeCloseTo(0);
    expect(d.y).toBeCloseTo(1);
  });
});

// ────────────────────────────── 데이터 정합 (백로그 D2 선반영) ──────────────────────────────

/** S2a가 추가하는 attack/preferredRange 필드 — GameTypes 확장 전까지 테스트 로컬 타입으로 읽는다. */
interface IKiteParams {
  preferredRange?: number;
}
interface IProjectileSpec {
  count?: number;
  spreadAngleDeg?: number;
  speed?: number;
  radius?: number;
}
interface IAttackData {
  type?: string;
  damage?: number;
  cooldown?: number;
  telegraphTime?: number;
  range?: number;
  projectile?: IProjectileSpec;
}
type EnemyWithAttack = Omit<IEnemyData, 'moveParams'> & {
  moveParams?: IEnemyMoveParams & IKiteParams;
  attack?: IAttackData;
};

const ENEMIES = readJson<EnemyWithAttack[]>('game/assets/resources/data/enemies.json');
const SPAWN_TABLE = readJson<ISpawnTableEntry[]>('game/assets/resources/data/spawn-table.json');

/** spawn-table.json의 모든 구간에서 참조되는 enemyId 집합. */
function referencedSpawnIds(): Set<string> {
  const referenced = new Set<string>();
  for (const entry of SPAWN_TABLE) {
    for (const id of Object.keys(entry.weights)) referenced.add(id);
  }
  return referenced;
}

describe('적 발사체 S2a — 구미호 데이터 정합', () => {
  it('kumiho: movement=kite, preferredRange>0', () => {
    const e = ENEMIES.find((x) => x.id === 'kumiho');
    expect(e, "enemies.json에 'kumiho'가 없다").toBeDefined();
    expect(e?.movement).toBe('kite');
    expect(e?.moveParams?.preferredRange ?? 0).toBeGreaterThan(0);
  });

  it('kumiho: attack=projectile_single, damage·cooldown 유효', () => {
    const a = ENEMIES.find((x) => x.id === 'kumiho')?.attack;
    expect(a, 'kumiho에 attack 블록이 없다').toBeDefined();
    expect(a?.type).toBe('projectile_single');
    expect(a?.damage ?? 0).toBeGreaterThan(0);
    expect(a?.cooldown ?? 0).toBeGreaterThan(0);
    expect(a?.telegraphTime ?? -1).toBeGreaterThanOrEqual(0);
  });

  it('kumiho: projectile.speed·radius 유효, count>=1', () => {
    const p = ENEMIES.find((x) => x.id === 'kumiho')?.attack?.projectile;
    expect(p, 'kumiho.attack.projectile이 없다').toBeDefined();
    expect(p?.speed ?? 0).toBeGreaterThan(0);
    expect(p?.radius ?? 0).toBeGreaterThan(0);
    expect(p?.count ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe('적 발사체 S2a — 스폰 테이블 무결성', () => {
  it('spawn-table.json이 참조하는 모든 enemyId가 enemies.json에 존재한다', () => {
    const known = new Set(ENEMIES.map((e) => e.id));
    const missing = [...referencedSpawnIds()].filter((id) => !known.has(id));
    expect(missing, `enemies.json에 없는 스폰 id: ${missing.join(', ')}`).toEqual([]);
  });

  it('kumiho가 spawn-table에 편입돼 실제 스폰된다', () => {
    expect(referencedSpawnIds().has('kumiho'), 'kumiho가 어느 웨이브에도 스폰되지 않음').toBe(true);
  });
});
