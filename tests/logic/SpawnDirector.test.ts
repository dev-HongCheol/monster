import { describe, expect, it } from 'vitest';
import type { ISpawnTableEntry } from '../../game/assets/scripts/data/GameTypes';
import { SpawnDirectorLogic } from '../../game/assets/scripts/logic/SpawnDirectorLogic';

/** 계획 문서(2026-06-04-spawn-director-plan.md §3)의 스폰 테이블 픽스처 */
const TABLE: ISpawnTableEntry[] = [
  { fromWave: 1, weights: { skeleton: 80, skeleton_swift: 20 } },
  { fromWave: 3, weights: { skeleton: 35, skeleton_swift: 50, skeleton_tank: 15 } },
  { fromWave: 6, weights: { skeleton_swift: 50, skeleton_tank: 50 } },
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
  it('웨이브 1: roll 전 범위에서 skeleton_tank는 안 나온다', () => {
    const seen = idsAcrossRolls(director(), 1);
    expect(seen.has('skeleton_tank')).toBe(false);
    expect(seen.has('skeleton')).toBe(true);
    expect(seen.has('skeleton_swift')).toBe(true);
  });

  it('웨이브 6: 일반 skeleton은 안 나온다 (swift/tank만)', () => {
    const seen = idsAcrossRolls(director(), 6);
    expect(seen.has('skeleton')).toBe(false);
    expect(seen.has('skeleton_swift')).toBe(true);
    expect(seen.has('skeleton_tank')).toBe(true);
  });

  it('fromWave 사이 값은 직전 구간을 사용한다', () => {
    const d = director();
    // wave 2 → 웨이브 1 구간 (tank 없음)
    expect(idsAcrossRolls(d, 2).has('skeleton_tank')).toBe(false);
    // wave 4, 5 → 웨이브 3 구간 (tank 가능)
    expect(idsAcrossRolls(d, 4).has('skeleton_tank')).toBe(true);
    expect(idsAcrossRolls(d, 5).has('skeleton_tank')).toBe(true);
    // wave 5에서도 skeleton 등장 (웨이브 3 구간이라 일반 있음)
    expect(idsAcrossRolls(d, 5).has('skeleton')).toBe(true);
  });

  it('wave가 첫 구간보다 작으면 첫 구간으로 폴백한다', () => {
    const d = director();
    // wave 0 → fromWave 1 구간 사용
    expect(d.selectEnemyId(0, 0)).toBe('skeleton');
    expect(idsAcrossRolls(d, 0).has('skeleton_tank')).toBe(false);
  });
});

describe('SpawnDirectorLogic — 가중치 경계', () => {
  it('웨이브 1 (skeleton 80 / swift 20): 경계 전후로 갈린다', () => {
    const d = director();
    expect(d.selectEnemyId(1, 0)).toBe('skeleton');
    expect(d.selectEnemyId(1, 0.5)).toBe('skeleton');
    expect(d.selectEnemyId(1, 0.79)).toBe('skeleton'); // 누적 80 직전
    expect(d.selectEnemyId(1, 0.85)).toBe('skeleton_swift'); // 80 이후
    expect(d.selectEnemyId(1, 0.99)).toBe('skeleton_swift');
  });

  it('웨이브 3 (35 / 50 / 15): 3구간 경계', () => {
    const d = director();
    expect(d.selectEnemyId(3, 0)).toBe('skeleton');
    expect(d.selectEnemyId(3, 0.3)).toBe('skeleton'); // [0,35)
    expect(d.selectEnemyId(3, 0.4)).toBe('skeleton_swift'); // [35,85)
    expect(d.selectEnemyId(3, 0.8)).toBe('skeleton_swift');
    expect(d.selectEnemyId(3, 0.9)).toBe('skeleton_tank'); // [85,100)
    expect(d.selectEnemyId(3, 0.99)).toBe('skeleton_tank');
  });

  it('웨이브 6 (swift 50 / tank 50): 절반 경계', () => {
    const d = director();
    expect(d.selectEnemyId(6, 0)).toBe('skeleton_swift');
    expect(d.selectEnemyId(6, 0.4)).toBe('skeleton_swift');
    expect(d.selectEnemyId(6, 0.6)).toBe('skeleton_tank');
    expect(d.selectEnemyId(6, 0.99)).toBe('skeleton_tank');
  });

  it('roll=0 → 첫 항목, roll이 1에 근접 → 마지막 항목', () => {
    const d = director();
    expect(d.selectEnemyId(3, 0)).toBe('skeleton'); // 첫 키
    expect(d.selectEnemyId(3, 0.9999)).toBe('skeleton_tank'); // 마지막 키
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
});
