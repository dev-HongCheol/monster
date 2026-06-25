import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ISpawnTableEntry } from '../../game/assets/scripts/data/GameTypes';
import { SpawnDirectorLogic } from '../../game/assets/scripts/logic/SpawnDirectorLogic';

/**
 * 스폰 테이블 픽스처 — 가중치 구조는 spawn-director 플랜(2026-06-04 §3) 그대로 두고,
 * id만 S0 로스터(feat/enemy-roster)로 갱신했다(skeleton→cheonyeo, skeleton_swift→dalgyal,
 * skeleton_tank→dokkaebi). SpawnDirectorLogic은 id 문자열을 키로만 쓰므로 경계 단언은 그대로 유효하다.
 */
const TABLE: ISpawnTableEntry[] = [
  { fromWave: 1, weights: { cheonyeo: 80, dalgyal: 20 } },
  { fromWave: 3, weights: { cheonyeo: 35, dalgyal: 50, dokkaebi: 15 } },
  { fromWave: 6, weights: { dalgyal: 50, dokkaebi: 50 } },
];

function director(table: ISpawnTableEntry[] = TABLE): SpawnDirectorLogic {
  return new SpawnDirectorLogic(table);
}

/** [0,1) 구간을 step 간격으로 훑으며 selectEnemyId 결과 집합을 모은다. */
function idsAcrossRolls(d: SpawnDirectorLogic, wave: number, step = 0.01): Set<string> {
  const seen = new Set<string>();
  for (let roll = 0; roll < 1; roll += step) {
    seen.add(d.selectEnemyId(wave, roll));
  }
  return seen;
}

describe('SpawnDirectorLogic — 웨이브 구간 게이팅', () => {
  it('웨이브 1: roll 전 범위에서 dokkaebi는 안 나온다', () => {
    const seen = idsAcrossRolls(director(), 1);
    expect(seen.has('dokkaebi')).toBe(false);
    expect(seen.has('cheonyeo')).toBe(true);
    expect(seen.has('dalgyal')).toBe(true);
  });

  it('웨이브 6: 일반 cheonyeo는 안 나온다 (dalgyal/dokkaebi만)', () => {
    const seen = idsAcrossRolls(director(), 6);
    expect(seen.has('cheonyeo')).toBe(false);
    expect(seen.has('dalgyal')).toBe(true);
    expect(seen.has('dokkaebi')).toBe(true);
  });

  it('fromWave 사이 값은 직전 구간을 사용한다', () => {
    const d = director();
    // wave 2 → 웨이브 1 구간 (tank 없음)
    expect(idsAcrossRolls(d, 2).has('dokkaebi')).toBe(false);
    // wave 4, 5 → 웨이브 3 구간 (tank 가능)
    expect(idsAcrossRolls(d, 4).has('dokkaebi')).toBe(true);
    expect(idsAcrossRolls(d, 5).has('dokkaebi')).toBe(true);
    // wave 5에서도 cheonyeo 등장 (웨이브 3 구간이라 일반 있음)
    expect(idsAcrossRolls(d, 5).has('cheonyeo')).toBe(true);
  });

  it('wave가 첫 구간보다 작으면 첫 구간으로 폴백한다', () => {
    const d = director();
    // wave 0 → fromWave 1 구간 사용
    expect(d.selectEnemyId(0, 0)).toBe('cheonyeo');
    expect(idsAcrossRolls(d, 0).has('dokkaebi')).toBe(false);
  });
});

describe('SpawnDirectorLogic — 가중치 경계', () => {
  it('웨이브 1 (cheonyeo 80 / dalgyal 20): 경계 전후로 갈린다', () => {
    const d = director();
    expect(d.selectEnemyId(1, 0)).toBe('cheonyeo');
    expect(d.selectEnemyId(1, 0.5)).toBe('cheonyeo');
    expect(d.selectEnemyId(1, 0.79)).toBe('cheonyeo'); // 누적 80 직전
    expect(d.selectEnemyId(1, 0.85)).toBe('dalgyal'); // 80 이후
    expect(d.selectEnemyId(1, 0.99)).toBe('dalgyal');
  });

  it('웨이브 3 (35 / 50 / 15): 3구간 경계', () => {
    const d = director();
    expect(d.selectEnemyId(3, 0)).toBe('cheonyeo');
    expect(d.selectEnemyId(3, 0.3)).toBe('cheonyeo'); // [0,35)
    expect(d.selectEnemyId(3, 0.4)).toBe('dalgyal'); // [35,85)
    expect(d.selectEnemyId(3, 0.8)).toBe('dalgyal');
    expect(d.selectEnemyId(3, 0.9)).toBe('dokkaebi'); // [85,100)
    expect(d.selectEnemyId(3, 0.99)).toBe('dokkaebi');
  });

  it('웨이브 6 (dalgyal 50 / dokkaebi 50): 절반 경계', () => {
    const d = director();
    expect(d.selectEnemyId(6, 0)).toBe('dalgyal');
    expect(d.selectEnemyId(6, 0.4)).toBe('dalgyal');
    expect(d.selectEnemyId(6, 0.6)).toBe('dokkaebi');
    expect(d.selectEnemyId(6, 0.99)).toBe('dokkaebi');
  });

  it('roll=0 → 첫 항목, roll이 1에 근접 → 마지막 항목', () => {
    const d = director();
    expect(d.selectEnemyId(3, 0)).toBe('cheonyeo'); // 첫 키
    expect(d.selectEnemyId(3, 0.9999)).toBe('dokkaebi'); // 마지막 키
  });
});

describe('SpawnDirectorLogic — 결정성 & 엣지', () => {
  it('같은 (wave, roll)은 항상 같은 결과', () => {
    const d = director();
    expect(d.selectEnemyId(3, 0.5)).toBe(d.selectEnemyId(3, 0.5));
    expect(d.selectEnemyId(6, 0.7)).toBe(d.selectEnemyId(6, 0.7));
  });

  it('단일 구간 테이블: 항상 그 구간 안에서 선택', () => {
    const d = director([{ fromWave: 1, weights: { only: 100 } }]);
    expect(d.selectEnemyId(1, 0)).toBe('only');
    expect(d.selectEnemyId(99, 0.999)).toBe('only');
  });

  it('roll 음수 → 첫 항목, roll>=1 → 마지막 항목 (방어적 클램프)', () => {
    const d = director();
    expect(d.selectEnemyId(1, -0.5)).toBe('cheonyeo'); // 음수 → 0 취급
    expect(d.selectEnemyId(3, 1)).toBe('dokkaebi'); // >=1 → 마지막 키
    expect(d.selectEnemyId(3, 5)).toBe('dokkaebi');
  });
});

describe('SpawnDirectorLogic — 비정상 데이터 방어', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('빈 테이블: 크래시 없이 빈 id 반환 + 생성 시 경고', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = director([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(d.selectEnemyId(1, 0.5)).toBe('');
  });

  it('빈 weights 구간: 크래시 없이 빈 id 반환 + 생성 시 경고', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = director([{ fromWave: 1, weights: {} }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(d.selectEnemyId(1, 0.5)).toBe('');
  });

  it('가중치 합 0: 첫 키로 결정적 폴백 + 생성 시 경고', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = director([{ fromWave: 1, weights: { a: 0, b: 0 } }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(d.selectEnemyId(1, 0)).toBe('a');
    expect(d.selectEnemyId(1, 0.99)).toBe('a');
  });

  it('정상 테이블은 경고하지 않는다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    director();
    expect(warn).not.toHaveBeenCalled();
  });
});
