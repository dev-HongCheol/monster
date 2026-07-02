import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { IEnemyData } from '../../game/assets/scripts/data/GameTypes';
// meleeConeMarkerArc는 리워크(Graphics 섹터)에서 신규 추가 — 미존재 시 import 실패로 파일 전체 RED.
import {
  coneHitsTarget,
  meleeConeMarkerArc,
} from '../../game/assets/scripts/logic/EnemyAttackLogic';
import type { Vec2 } from '../../game/assets/scripts/logic/MovementLogic';

const DEG = Math.PI / 180;

/** 극좌표(각deg·거리)로 toTarget 벡터를 만든다(+x=0°, +y=90°). */
function polar(angleDeg: number, dist: number): Vec2 {
  return { x: Math.cos(angleDeg * DEG) * dist, y: Math.sin(angleDeg * DEG) * dist };
}

// ─────────────────────────────────────────────────────────────────────────
// coneHitsTarget — 잠근 방향(facing) 기준 부채꼴(각·사거리) 안에 대상이 있는지 판정.
// 거리 ≤ range 그리고 facing~toTarget 끼인각 ≤ coneAngleDeg/2 면 히트. 경계는 포함(≤).
// ─────────────────────────────────────────────────────────────────────────
describe('coneHitsTarget — 부채꼴 명중 판정', () => {
  const facing: Vec2 = { x: 1, y: 0 }; // +x를 바라봄
  const cone = 120; // 절반 = 60°
  const range = 100;

  it('정면(각 0)·사거리 안 → 히트', () => {
    expect(coneHitsTarget(facing, polar(0, 50), cone, range)).toBe(true);
  });

  it('옆으로 빠짐(각 > 절반) → 미스', () => {
    expect(coneHitsTarget(facing, polar(90, 50), cone, range)).toBe(false);
  });

  it('사거리 밖(각은 정면) → 미스', () => {
    expect(coneHitsTarget(facing, polar(0, 150), cone, range)).toBe(false);
  });

  it('정확히 경계각(절반)·사거리 안 → 히트(≤ 포함)', () => {
    expect(coneHitsTarget(facing, polar(60, 50), cone, range)).toBe(true);
    expect(coneHitsTarget(facing, polar(-60, 50), cone, range)).toBe(true);
  });

  it('경계각 바로 밖 → 미스', () => {
    expect(coneHitsTarget(facing, polar(61, 50), cone, range)).toBe(false);
  });

  it('정확히 경계거리(= range)·정면 → 히트(≤ 포함)', () => {
    expect(coneHitsTarget(facing, polar(0, 100), cone, range)).toBe(true);
  });

  it('뒤쪽(각 180) → 미스', () => {
    expect(coneHitsTarget(facing, polar(180, 50), cone, range)).toBe(false);
  });

  it('toTarget 영벡터(정확히 겹침) → 히트(코앞에서 휘두르면 맞음)', () => {
    expect(coneHitsTarget(facing, { x: 0, y: 0 }, cone, range)).toBe(true);
  });

  it('facing 영벡터(잠금 방향 비정상) → 미스(NaN 가드)', () => {
    expect(coneHitsTarget({ x: 0, y: 0 }, polar(0, 50), cone, range)).toBe(false);
  });

  it('좌우 대칭 — 같은 각의 ±는 동일 판정', () => {
    for (const a of [30, 45, 59, 60, 61, 90]) {
      expect(coneHitsTarget(facing, polar(a, 50), cone, range)).toBe(
        coneHitsTarget(facing, polar(-a, 50), cone, range),
      );
    }
  });

  it('facing이 +x가 아니어도(대각선) 상대각 기준으로 판정', () => {
    const diag: Vec2 = { x: 1, y: 1 }; // 45°를 바라봄
    expect(coneHitsTarget(diag, polar(45, 50), cone, range)).toBe(true); // 정면(상대각 0)
    expect(coneHitsTarget(diag, polar(115, 50), cone, range)).toBe(false); // 상대각 70 > 60
  });
});

// ─────────────────────────────────────────────────────────────────────────
// meleeConeMarkerArc — Graphics 섹터 마커의 로컬 호(arc) 파라미터. 반지름은 부모(threatScale)
// 스케일을 상쇄하고, 호는 로컬 +X 중심 ±coneAngleDeg/2. coneHitsTarget과 같은 각을 그려 마커=판정 정합.
// ─────────────────────────────────────────────────────────────────────────
describe('meleeConeMarkerArc — 부채꼴 마커 호 파라미터', () => {
  it('radius = range / 부모 스케일 (부모 threatScale 상쇄)', () => {
    expect(meleeConeMarkerArc(90, 120, 1).radius).toBeCloseTo(90, 5);
    expect(meleeConeMarkerArc(90, 120, 1.5).radius).toBeCloseTo(60, 5);
  });

  it('start/end 각은 ±coneAngleDeg/2 (rad), 좌우 대칭', () => {
    const a = meleeConeMarkerArc(90, 120, 1);
    expect(a.startRad).toBeCloseTo(-60 * DEG, 5);
    expect(a.endRad).toBeCloseTo(60 * DEG, 5);
    expect(a.startRad).toBeCloseTo(-a.endRad, 5);
  });

  it('넓은 각일수록 호 스팬이 크다', () => {
    const wide = meleeConeMarkerArc(90, 150, 1);
    const narrow = meleeConeMarkerArc(90, 90, 1);
    expect(wide.endRad - wide.startRad).toBeGreaterThan(narrow.endRad - narrow.startRad);
  });

  it('사거리가 길수록 radius가 크다', () => {
    expect(meleeConeMarkerArc(120, 120, 1).radius).toBeGreaterThan(
      meleeConeMarkerArc(80, 120, 1).radius,
    );
  });

  it('parentScale 0/음수 → 1로 폴백(분모 0 가드)', () => {
    const a = meleeConeMarkerArc(90, 120, 0);
    expect(Number.isFinite(a.radius)).toBe(true);
    expect(a.radius).toBeCloseTo(90, 5);
  });

  it('호 스팬 = coneAngleDeg (rad) — 명중 판정과 동일 각(마커=판정 정합, 클램프 비대칭 없음)', () => {
    const a = meleeConeMarkerArc(90, 150, 1);
    expect(a.endRad - a.startRad).toBeCloseTo(150 * DEG, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// S3 데이터 — 두억시니·야차·그슨대 추가 + 이중 피해 방지 불변식(§5)
// ─────────────────────────────────────────────────────────────────────────
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ENEMIES = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'game/assets/resources/data/enemies.json'), 'utf8'),
) as IEnemyData[];

describe('S3 데이터 — 근접 휘두르기 적(두억시니·야차·그슨대)', () => {
  it('세 적이 melee_sweep 공격으로 존재한다', () => {
    for (const id of ['dueokshini', 'yacha', 'geuseundae']) {
      const e = ENEMIES.find((x) => x.id === id);
      expect(e, `enemies.json에 '${id}'가 없다`).toBeDefined();
      expect(e?.attack?.type, `${id}의 attack.type`).toBe('melee_sweep');
    }
  });

  it('melee_sweep 적 전부가 melee.coneAngleDeg·range를 갖는다', () => {
    const sweepers = ENEMIES.filter((e) => e.attack?.type === 'melee_sweep');
    expect(sweepers.length, 'melee_sweep 적이 하나도 없다').toBeGreaterThan(0);
    for (const e of sweepers) {
      expect(e.attack?.melee?.coneAngleDeg, `${e.id}: coneAngleDeg`).toBeGreaterThan(0);
      expect(e.attack?.melee?.range, `${e.id}: range`).toBeGreaterThan(0);
    }
  });

  it('이중 피해 방지 불변식 — 접촉/초 < 휘두르기 버스트(§5)', () => {
    const sweepers = ENEMIES.filter((e) => e.attack?.type === 'melee_sweep');
    for (const e of sweepers) {
      expect(
        e.contactDamagePerSec,
        `${e.id}: 접촉 ${e.contactDamagePerSec} ≥ 휘두르기 ${e.attack?.damage} → 이중피해 위험`,
      ).toBeLessThan(e.attack?.damage ?? 0);
    }
  });
});
