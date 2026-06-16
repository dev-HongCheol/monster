import { describe, expect, it } from 'vitest';
import {
  type ISpellData,
  SpellCategory,
  SpellPattern,
  UpgradeOption,
  UpgradeTrack,
} from '../../game/assets/scripts/data/GameTypes';
import { EnhancementLogic, UPGRADE_CAP } from '../../game/assets/scripts/logic/EnhancementLogic';
// 아직 구현되지 않은 신규 순수 모듈 — import 실패로 RED. 구현 단계(implementation)에서 생성한다.
import { selectExplosionHits } from '../../game/assets/scripts/logic/ExplosionLogic';

/**
 * 폭발 판정에 넘기는 적 후보 한 마리. 호출부(발사체)가 후보 목록을 만들어 넘긴다.
 * 지금은 전체 활성 적, 나중엔 공간 그리드 질의 결과 — 같은 인터페이스(그리드-레디, 백로그 G1).
 */
interface ExplosionTarget {
  x: number;
  y: number;
  collisionRadius: number;
  /** 안정 식별자 = 적 spawnId (풀 재사용 오판 방지, §10.2) */
  id: number;
}

const target = (id: number, x: number, y: number, collisionRadius = 0): ExplosionTarget => ({
  id,
  x,
  y,
  collisionRadius,
});

describe('selectExplosionHits — 폭발 반경 판정', () => {
  it('중심 반경 안의 적만 고른다', () => {
    const enemies = [target(1, 0, 0), target(2, 50, 0), target(3, 200, 0)];
    // 인덱스 0(거리0)·1(거리50)은 반경 100 안, 2(거리200)는 밖
    expect(selectExplosionHits(0, 0, 100, enemies, new Set())).toEqual([0, 1]);
  });

  it('반경 경계 밖 적은 제외한다', () => {
    const enemies = [target(1, 100.1, 0)];
    expect(selectExplosionHits(0, 0, 100, enemies, new Set())).toEqual([]);
  });

  it('적 충돌 반경만큼 겹치면 맞는다 (radius + collisionRadius)', () => {
    // 중심에서 120 떨어졌지만 적 몸 반경 25 → 100+25=125 안이라 맞음
    const enemies = [target(1, 120, 0, 25)];
    expect(selectExplosionHits(0, 0, 100, enemies, new Set())).toEqual([0]);
  });

  it('빈 적 목록이면 빈 결과', () => {
    expect(selectExplosionHits(0, 0, 100, [], new Set())).toEqual([]);
  });

  it('반경 0이면 정확히 겹친 적만 (몸 반경 포함)', () => {
    const enemies = [target(1, 0, 0, 0), target(2, 1, 0, 0)];
    expect(selectExplosionHits(0, 0, 0, enemies, new Set())).toEqual([0]);
  });
});

describe('selectExplosionHits — 시전 단위 dedup (§10.2)', () => {
  it('이미 맞은 적(alreadyHit)은 건너뛴다', () => {
    const enemies = [target(1, 0, 0), target(2, 10, 0)];
    const already = new Set<number>([1]); // spawnId 1은 이 시전에서 이미 맞음
    // 인덱스 1(id 2)만 새로 맞음
    expect(selectExplosionHits(0, 0, 100, enemies, already)).toEqual([1]);
  });

  it('고른 적의 id를 alreadyHit에 등록한다(다음 폭발이 건너뛰도록)', () => {
    const enemies = [target(7, 0, 0), target(9, 10, 0)];
    const already = new Set<number>();
    selectExplosionHits(0, 0, 100, enemies, already);
    expect(already.has(7)).toBe(true);
    expect(already.has(9)).toBe(true);
  });

  it('같은 집합으로 두 번째 폭발은 이미 맞은 적을 다시 때리지 않는다(겹친 폭발 = 적당 1회)', () => {
    const enemies = [target(7, 0, 0), target(9, 10, 0)];
    const already = new Set<number>();
    const first = selectExplosionHits(0, 0, 100, enemies, already);
    const second = selectExplosionHits(0, 0, 100, enemies, already);
    expect(first).toEqual([0, 1]);
    expect(second).toEqual([]); // 같은 시전의 두 번째 폭발은 모두 중복 → 빈 결과
  });

  it('id가 안정 식별자다 — 같은 좌표라도 다른 id면 별개로 취급(풀 재사용 시나리오)', () => {
    const already = new Set<number>([1]);
    const enemies = [target(2, 0, 0)]; // 같은 위치지만 id 2 (노드 재사용)
    expect(selectExplosionHits(0, 0, 100, enemies, already)).toEqual([0]);
  });
});

/** 로컬 타입 확장 — 구현 단계에서 ISpellData에 explosionRadius가 추가되면 제거한다. */
type RadiusSpell = ISpellData & { explosionRadius?: number };

const makeSpell = (id: string, category: SpellCategory, explosionRadius?: number): RadiusSpell => ({
  id,
  category,
  tier: 1,
  damage: 10,
  projectileSpeed: 400,
  projectileRadius: 8,
  cooldown: 0.5,
  projectileCount: 1,
  pattern: SpellPattern.Directional,
  ...(explosionRadius !== undefined ? { explosionRadius } : {}),
});

describe('EnhancementLogic.buildUpgradeCards — 범위(Range) 강화 게이트 (A3)', () => {
  it('폭발 반경을 가진 마법은 개별 Range 카드가 생성된다', () => {
    const e = new EnhancementLogic();
    const fireball = makeSpell('fireball', SpellCategory.Fire, 80);
    const ids = e.buildUpgradeCards([fireball]).map((c) => c.id);
    expect(ids).toContain('upg_fireball_range');
  });

  it('폭발 반경이 없는 마법은 Range 카드가 생성되지 않는다', () => {
    const e = new EnhancementLogic();
    const ice = makeSpell('ice_missile', SpellCategory.Ice); // explosionRadius 없음
    const ids = e.buildUpgradeCards([ice]).map((c) => c.id);
    expect(ids.some((id) => id.endsWith('_range'))).toBe(false);
  });

  it('범위 적격 마법이 있는 분류만 분류 Range 카드가 생성된다', () => {
    const e = new EnhancementLogic();
    const fireball = makeSpell('fireball', SpellCategory.Fire, 80);
    const ids = e.buildUpgradeCards([fireball]).map((c) => c.id);
    expect(ids).toContain('cupg_fire_range'); // 화염엔 적격 마법(파이어볼)이 있음
    expect(ids).not.toContain('cupg_ice_range'); // 얼음엔 적격 마법 없음
    expect(ids).not.toContain('cupg_lightning_range');
  });

  it('Range 레벨 4(maxed)면 그 마법의 Range 카드는 제외된다', () => {
    const e = new EnhancementLogic();
    const fireball = makeSpell('fireball', SpellCategory.Fire, 80);
    for (let i = 0; i < UPGRADE_CAP; i++) {
      e.raise(UpgradeTrack.Individual, 'fireball', UpgradeOption.Range);
    }
    const ids = e.buildUpgradeCards([fireball]).map((c) => c.id);
    expect(ids).not.toContain('upg_fireball_range');
    expect(ids).toContain('upg_fireball_damage'); // 다른 옵션은 남는다
  });

  it('Range 카드는 표시 키/params만 산출하고, 반경 배율은 factor(Range)를 재사용한다', () => {
    const e = new EnhancementLogic();
    const fireball = makeSpell('fireball', SpellCategory.Fire, 80);
    const card = e.buildUpgradeCards([fireball]).find((c) => c.id === 'upg_fireball_range');
    expect(card?.descParams).toEqual({ spell: 'spell.fireball.name', option: 'upgrade.range' });
    // factor(Range)는 발사체 수 assert에 걸리지 않고 곡선 배율을 돌려준다(폭발 반경에 곱할 값)
    e.raise(UpgradeTrack.Individual, 'fireball', UpgradeOption.Range);
    expect(e.factor(fireball, UpgradeOption.Range)).toBeGreaterThan(1);
  });
});
