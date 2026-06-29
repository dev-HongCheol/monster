import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { IEnemyData } from '../../game/assets/scripts/data/GameTypes';
// 아직 존재하지 않는 모듈(구현 단계에서 생성) — 이 import 실패로 파일 전체가 RED.
import { fanDirections, radialDirections } from '../../game/assets/scripts/logic/FireGeometry';

/** aim 위쪽(0,1) 단위벡터 기준 픽스처. SpellPatternEngine.test.ts와 동일 관례. */
const AIM_X = 0;
const AIM_Y = 1;

type Dir = readonly [number, number];

function mag(d: Dir): number {
  return Math.hypot(d[0], d[1]);
}

/** +x=0°, +y=90°. atan2 기반 각도(deg). */
function angleDeg(d: Dir): number {
  return (Math.atan2(d[1], d[0]) * 180) / Math.PI;
}

/** aim과의 내적(=cos 끼인각). 단위벡터 가정. */
function dotAim(d: Dir): number {
  return d[0] * AIM_X + d[1] * AIM_Y;
}

// ─────────────────────────────────────────────────────────────────────────
// 부채꼴(호) — 이무기. aim 중심, ±총각/2를 (count-1)로 균등 분포(끝점 포함).
// SpellPatternLogic.directionalPlan에서 추출한 수학과 동일해야 한다.
// ─────────────────────────────────────────────────────────────────────────
describe('fanDirections — 부채꼴(호)', () => {
  it('count=1 → 1개, 방향은 aim 그대로', () => {
    const dirs = fanDirections(AIM_X, AIM_Y, 1, 30);
    expect(dirs).toHaveLength(1);
    expect(dirs[0][0]).toBeCloseTo(0, 5);
    expect(dirs[0][1]).toBeCloseTo(1, 5);
  });

  it('모든 방향은 단위벡터다', () => {
    for (const d of fanDirections(AIM_X, AIM_Y, 5, 40)) {
      expect(mag(d)).toBeCloseTo(1, 5);
    }
  });

  it('count=3, 총각=30 → 중앙은 aim, 외곽 2개는 ±15° 대칭', () => {
    const dirs = fanDirections(AIM_X, AIM_Y, 3, 30);
    expect(dirs).toHaveLength(3);
    const outer = Math.cos((15 * Math.PI) / 180);
    const dots = dirs.map(dotAim).sort((a, b) => a - b);
    expect(dots[0]).toBeCloseTo(outer, 5);
    expect(dots[1]).toBeCloseTo(outer, 5);
    expect(dots[2]).toBeCloseTo(1, 5); // 중앙 = aim
    // 외곽 2개는 x부호 반대(좌우 대칭)
    const xs = dirs.map((d) => d[0]).filter((x) => Math.abs(x) > 1e-6);
    expect(xs).toHaveLength(2);
    expect(Math.sign(xs[0])).toBe(-Math.sign(xs[1]));
    expect(Math.abs(xs[0])).toBeCloseTo(Math.abs(xs[1]), 5);
  });

  it('count=2, 총각=60 → ±30° 대칭 2개, 중앙(aim) 없음', () => {
    const dirs = fanDirections(AIM_X, AIM_Y, 2, 60);
    expect(dirs).toHaveLength(2);
    const outer = Math.cos((30 * Math.PI) / 180);
    for (const d of dirs) expect(dotAim(d)).toBeCloseTo(outer, 5);
    expect(dirs.some((d) => Math.abs(d[0]) < 1e-6)).toBe(false);
    expect(Math.sign(dirs[0][0])).toBe(-Math.sign(dirs[1][0]));
  });

  it('count<=0 / NaN / Infinity → 1개로 클램프', () => {
    expect(fanDirections(AIM_X, AIM_Y, 0, 30)).toHaveLength(1);
    expect(fanDirections(AIM_X, AIM_Y, -4, 30)).toHaveLength(1);
    expect(fanDirections(AIM_X, AIM_Y, Number.NaN, 30)).toHaveLength(1);
    expect(fanDirections(AIM_X, AIM_Y, Number.POSITIVE_INFINITY, 30)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 확산(링) — 물귀신. 총각을 count로 균등 분포(끝점 중복 없음). 첫 방향 = aim.
// 360이면 사방 등간격 N발(탄막).
// ─────────────────────────────────────────────────────────────────────────
describe('radialDirections — 확산(링)', () => {
  it('count=1 → 1개, 방향은 aim 그대로', () => {
    const dirs = radialDirections(AIM_X, AIM_Y, 1, 360);
    expect(dirs).toHaveLength(1);
    expect(dirs[0][0]).toBeCloseTo(0, 5);
    expect(dirs[0][1]).toBeCloseTo(1, 5);
  });

  it('모든 방향은 단위벡터다', () => {
    for (const d of radialDirections(AIM_X, AIM_Y, 8, 360)) {
      expect(mag(d)).toBeCloseTo(1, 5);
    }
  });

  it('count=4, 총각=360 → 사방(상·하·좌·우) 4발', () => {
    const dirs = radialDirections(AIM_X, AIM_Y, 4, 360);
    expect(dirs).toHaveLength(4);
    const has = (x: number, y: number) =>
      dirs.some((d) => Math.abs(d[0] - x) < 1e-6 && Math.abs(d[1] - y) < 1e-6);
    expect(has(0, 1)).toBe(true); // 위(aim)
    expect(has(-1, 0)).toBe(true); // 좌
    expect(has(0, -1)).toBe(true); // 아래
    expect(has(1, 0)).toBe(true); // 우
  });

  it('count=8, 총각=360 → 8발 모두 서로 다른 방향(끝점 중복 없음)', () => {
    const dirs = radialDirections(AIM_X, AIM_Y, 8, 360);
    expect(dirs).toHaveLength(8);
    // 어떤 두 방향도 일치하지 않는다
    for (let i = 0; i < dirs.length; i++) {
      for (let j = i + 1; j < dirs.length; j++) {
        const same =
          Math.abs(dirs[i][0] - dirs[j][0]) < 1e-6 && Math.abs(dirs[i][1] - dirs[j][1]) < 1e-6;
        expect(same).toBe(false);
      }
    }
  });

  it('count=8, 총각=360 → 인접 방향 간격이 균등(45°)', () => {
    const dirs = radialDirections(AIM_X, AIM_Y, 8, 360);
    const angles = dirs.map(angleDeg).sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBeCloseTo(45, 4);
    }
  });

  it('count<=0 / NaN / Infinity → 1개로 클램프', () => {
    expect(radialDirections(AIM_X, AIM_Y, 0, 360)).toHaveLength(1);
    expect(radialDirections(AIM_X, AIM_Y, -4, 360)).toHaveLength(1);
    expect(radialDirections(AIM_X, AIM_Y, Number.NaN, 360)).toHaveLength(1);
    expect(radialDirections(AIM_X, AIM_Y, Number.POSITIVE_INFINITY, 360)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// S2b 데이터 — 이무기·물귀신 추가 + 유격 정착-사거리 불변식(백로그 F20)
// ─────────────────────────────────────────────────────────────────────────
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ENEMIES = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'game/assets/resources/data/enemies.json'), 'utf8'),
) as IEnemyData[];

/**
 * EnemyController.ts의 KITE_DEADZONE_BAND와 동일해야 한다. 그 상수는 cc 의존 컴포넌트에
 * 있어 vitest에서 import할 수 없으므로 값을 미러링한다(변경 시 동기화 필요).
 */
const KITE_DEADZONE_BAND = 40;

describe('S2b 데이터 — 이무기·물귀신', () => {
  it('이무기(imugi): kite·원거리 부채꼴 발사체로 존재', () => {
    const e = ENEMIES.find((x) => x.id === 'imugi');
    expect(e, "enemies.json에 'imugi'가 없다").toBeDefined();
    expect(e?.movement).toBe('kite');
    expect(e?.attack?.type).toBe('projectile_fan');
  });

  it('물귀신(mulgwisin): kite·원거리 확산 발사체로 존재', () => {
    const e = ENEMIES.find((x) => x.id === 'mulgwisin');
    expect(e, "enemies.json에 'mulgwisin'이 없다").toBeDefined();
    expect(e?.movement).toBe('kite');
    expect(e?.attack?.type).toBe('projectile_spread');
  });
});

describe('유격 정착-사거리 불변식 (F20)', () => {
  it('kite + attack 적은 preferredRange + 데드존폭 ≤ attack.range (정착점이 사거리 안)', () => {
    const kiters = ENEMIES.filter((e) => e.movement === 'kite' && e.attack);
    expect(kiters.length, 'kite+attack 적이 하나도 없다').toBeGreaterThan(0);
    for (const e of kiters) {
      const preferred = e.moveParams?.preferredRange ?? 0;
      const range = e.attack?.range ?? 0;
      expect(
        preferred + KITE_DEADZONE_BAND,
        `${e.id}: 정착점(preferredRange ${preferred} + 데드존 ${KITE_DEADZONE_BAND})이 사거리 ${range} 밖 → 거의 안 쏨`,
      ).toBeLessThanOrEqual(range);
    }
  });
});
