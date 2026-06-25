import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { IEnemyData, ISpawnTableEntry } from '../../game/assets/scripts/data/GameTypes';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/** repo 루트 기준 상대 경로의 JSON을 읽어 파싱한다. */
function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as T;
}

const ENEMIES = readJson<IEnemyData[]>('game/assets/resources/data/enemies.json');
const SPAWN_TABLE = readJson<ISpawnTableEntry[]>('game/assets/resources/data/spawn-table.json');

/**
 * S0 추격×역할 베이스 4종 (계획 §2). 전부 직진 추격(chase)·접촉이며, 역할(role)만 다르다.
 * 한국 요괴 IP로 리네이밍한 id와 설계상 역할 라벨을 한곳에 고정해 오타·참조 누락을 잡는다.
 */
const ROSTER: ReadonlyArray<{ id: string; role: string }> = [
  { id: 'cheonyeo', role: 'standard' }, // 처녀귀신 — 기본 군집(baseline)
  { id: 'dokkaebi', role: 'tank' }, // 도깨비 — 느린 벽
  { id: 'dalgyal', role: 'swarmer' }, // 달걀귀신 — 작고 빠른 다수
  { id: 'jangsanbeom', role: 'standard' }, // 장산범 — 신규 4번째(호랑이 미믹)
];

describe('적 로스터 S0 — 베이스 4종 정합', () => {
  for (const { id, role } of ROSTER) {
    it(`${id}: enemies.json에 존재하고 movement=chase·role=${role}`, () => {
      const enemy = ENEMIES.find((e) => e.id === id);
      expect(enemy, `enemies.json에 '${id}'가 없다`).toBeDefined();
      expect(enemy?.movement).toBe('chase');
      expect(enemy?.role).toBe(role);
    });
  }
});

describe('적 로스터 S0 — 스폰 테이블 무결성', () => {
  it('spawn-table.json이 참조하는 모든 enemyId가 enemies.json에 존재한다', () => {
    const known = new Set(ENEMIES.map((e) => e.id));
    const referenced = new Set<string>();
    for (const entry of SPAWN_TABLE) {
      for (const id of Object.keys(entry.weights)) referenced.add(id);
    }
    const missing = [...referenced].filter((id) => !known.has(id));
    expect(missing, `enemies.json에 없는 스폰 id: ${missing.join(', ')}`).toEqual([]);
  });
});
