import { describe, expect, it } from 'vitest';
import {
  type IEnemyData,
  type ISpellData,
  SpellCategory,
  UpgradeOption,
} from '../../game/assets/scripts/data/GameTypes';
import {
  buildResultStats,
  type ResultStatsInput,
} from '../../game/assets/scripts/logic/ResultStatsLogic';

/** 최소 마법 픽스처 — 결과 통계는 id·category·tier만 읽는다. */
function spell(id: string, category: SpellCategory, tier: number): ISpellData {
  return { id, category, tier } as unknown as ISpellData;
}

/** 최소 적 픽스처 — 킬 리스트는 name만 읽는다(적 이름은 데이터 직접 문자열, §2 OUT — i18n 미대상). */
function enemy(id: string, name: string): IEnemyData {
  return { id, name } as unknown as IEnemyData;
}

/** 픽스처 맵으로 getSpell 콜백을 만든다(미보유 id는 null — 정합 가드). */
function spellLookup(...spells: ISpellData[]): (id: string) => ISpellData | null {
  const map = new Map(spells.map((s) => [s.id, s]));
  return (id: string) => map.get(id) ?? null;
}

/** 픽스처 맵으로 getEnemy 콜백을 만든다(미존재 id는 null — 정합 가드). */
function enemyLookup(...enemies: IEnemyData[]): (id: string) => IEnemyData | null {
  const map = new Map(enemies.map((e) => [e.id, e]));
  return (id: string) => map.get(id) ?? null;
}

/** 한 옵션의 3티어 레벨(전역 g / 분류 c / 개별 i) + 최종 배율 factor. */
function lv(g: number, c: number, i: number, factor: number) {
  return { g, c, i, factor };
}

/** 통계 스냅샷 기본값 — 각 테스트가 필요한 필드만 덮어쓴다. */
function input(overrides: Partial<ResultStatsInput> = {}): ResultStatsInput {
  return {
    survivalSec: 0,
    level: 1,
    killsByType: {},
    spells: [],
    passives: {
      maxHp: { level: 0, bonus: 0 },
      moveSpeed: { level: 0, bonus: 0 },
      pickup: { level: 0, bonus: 0 },
    },
    ...overrides,
  };
}

const noSpells = spellLookup();
const noEnemies = enemyLookup();

describe('buildResultStats — 기본 지표', () => {
  it('생존 시간을 mm:ss로 포맷한다 (600초 → "10:00")', () => {
    const view = buildResultStats(input({ survivalSec: 600 }), noSpells, noEnemies);
    expect(view.survivalTime).toBe('10:00');
  });

  it('생존 시간 초 단위를 올바로 포맷한다 (65초 → "01:05")', () => {
    const view = buildResultStats(input({ survivalSec: 65 }), noSpells, noEnemies);
    expect(view.survivalTime).toBe('01:05');
  });

  it('도달 레벨을 그대로 전달한다', () => {
    const view = buildResultStats(input({ level: 14 }), noSpells, noEnemies);
    expect(view.level).toBe(14);
  });
});

describe('buildResultStats — 킬 통계', () => {
  it('킬 총계는 표시된 종류별 킬의 합이다', () => {
    const view = buildResultStats(
      input({ killsByType: { egg: 152, virgin: 121 } }),
      noSpells,
      enemyLookup(enemy('egg', '달걀귀신'), enemy('virgin', '처녀귀신')),
    );
    expect(view.killTotal).toBe(273);
  });

  it('킬 종류별을 count 내림차순으로 정렬하고 적 이름을 데이터에서 가져온다', () => {
    const view = buildResultStats(
      input({ killsByType: { egg: 10, virgin: 50, goblin: 30 } }),
      noSpells,
      enemyLookup(enemy('egg', '달걀귀신'), enemy('virgin', '처녀귀신'), enemy('goblin', '도깨비')),
    );
    expect(view.killsByType).toEqual([
      { name: '처녀귀신', count: 50 },
      { name: '도깨비', count: 30 },
      { name: '달걀귀신', count: 10 },
    ]);
  });

  it('getEnemy가 null인 킬은 리스트에서 생략하고 총계에도 넣지 않는다 (정합 가드)', () => {
    const view = buildResultStats(
      input({ killsByType: { egg: 10, ghost: 5 } }),
      noSpells,
      enemyLookup(enemy('egg', '달걀귀신')),
    );
    expect(view.killsByType).toEqual([{ name: '달걀귀신', count: 10 }]);
    expect(view.killTotal).toBe(10);
  });
});

describe('buildResultStats — 보유 마법 라벨', () => {
  it('티어 라벨(분류 이니셜+티어)과 이름 i18n 키를 낸다', () => {
    const view = buildResultStats(
      input({ spells: [{ id: 'fireball', dmg: lv(0, 0, 0, 1), cd: lv(0, 0, 0, 1) }] }),
      spellLookup(spell('fireball', SpellCategory.Fire, 1)),
      noEnemies,
    );
    expect(view.spells[0]).toMatchObject({
      id: 'fireball',
      tierLabel: 'F1',
      nameKey: 'spell.fireball.name',
    });
  });

  it('보유 마법을 티어 오름차순으로 정렬한다 (F1 → I3)', () => {
    const view = buildResultStats(
      input({
        spells: [
          { id: 'frost_nova', dmg: lv(0, 0, 0, 1), cd: lv(0, 0, 0, 1) },
          { id: 'fireball', dmg: lv(0, 0, 0, 1), cd: lv(0, 0, 0, 1) },
        ],
      }),
      spellLookup(
        spell('fireball', SpellCategory.Fire, 1),
        spell('frost_nova', SpellCategory.Ice, 3),
      ),
      noEnemies,
    );
    expect(view.spells.map((s) => s.tierLabel)).toEqual(['F1', 'I3']);
  });

  it('getSpell이 null인 마법은 생략한다 (정합 가드)', () => {
    const view = buildResultStats(
      input({
        spells: [
          { id: 'ghost', dmg: lv(0, 0, 0, 1), cd: lv(0, 0, 0, 1) },
          { id: 'fireball', dmg: lv(0, 0, 0, 1), cd: lv(0, 0, 0, 1) },
        ],
      }),
      spellLookup(spell('fireball', SpellCategory.Fire, 1)),
      noEnemies,
    );
    expect(view.spells).toHaveLength(1);
    expect(view.spells[0].id).toBe('fireball');
  });
});

describe('buildResultStats — 강화 레벨 브레이크다운', () => {
  it('데미지·쿨다운 순으로 두 옵션을 낸다', () => {
    const view = buildResultStats(
      input({ spells: [{ id: 'fireball', dmg: lv(1, 1, 1, 2), cd: lv(1, 0, 0, 1.25) }] }),
      spellLookup(spell('fireball', SpellCategory.Fire, 1)),
      noEnemies,
    );
    expect(view.spells[0].upgrades.map((u) => u.option)).toEqual([
      UpgradeOption.Damage,
      UpgradeOption.Cooldown,
    ]);
  });

  it('총합 = 전역 + 분류 + 개별이고 각 티어 레벨을 그대로 낸다', () => {
    const view = buildResultStats(
      input({ spells: [{ id: 'fireball', dmg: lv(1, 2, 3, 2), cd: lv(1, 0, 0, 1.25) }] }),
      spellLookup(spell('fireball', SpellCategory.Fire, 1)),
      noEnemies,
    );
    const dmg = view.spells[0].upgrades[0];
    expect(dmg).toMatchObject({ global: 1, category: 2, individual: 3, total: 6 });
  });

  it('데미지 최종 효과 %는 +(factor−1) 반올림이다 (배율 2.0 → +100%)', () => {
    const view = buildResultStats(
      input({ spells: [{ id: 'fireball', dmg: lv(1, 1, 1, 2), cd: lv(0, 0, 0, 1) }] }),
      spellLookup(spell('fireball', SpellCategory.Fire, 1)),
      noEnemies,
    );
    expect(view.spells[0].upgrades[0].effectPct).toBe(100);
  });

  it('쿨다운 최종 효과 %는 단축 −(1−1/factor) 반올림이다 (배율 1.25 → −20%)', () => {
    const view = buildResultStats(
      input({ spells: [{ id: 'fireball', dmg: lv(0, 0, 0, 1), cd: lv(1, 0, 0, 1.25) }] }),
      spellLookup(spell('fireball', SpellCategory.Fire, 1)),
      noEnemies,
    );
    expect(view.spells[0].upgrades[1].effectPct).toBe(-20);
  });

  it('미강화 마법은 세 티어 모두 0이고 효과 %도 0이다', () => {
    const view = buildResultStats(
      input({ spells: [{ id: 'fireball', dmg: lv(0, 0, 0, 1), cd: lv(0, 0, 0, 1) }] }),
      spellLookup(spell('fireball', SpellCategory.Fire, 1)),
      noEnemies,
    );
    for (const u of view.spells[0].upgrades) {
      expect(u).toMatchObject({ global: 0, category: 0, individual: 0, total: 0, effectPct: 0 });
    }
  });
});

describe('buildResultStats — 패시브 레벨', () => {
  it('패시브 레벨·보너스를 그대로 전달한다', () => {
    const view = buildResultStats(
      input({
        passives: {
          maxHp: { level: 4, bonus: 40 },
          moveSpeed: { level: 3, bonus: 0.15 },
          pickup: { level: 5, bonus: 0.25 },
        },
      }),
      noSpells,
      noEnemies,
    );
    expect(view.passives).toEqual({
      maxHp: { level: 4, bonus: 40 },
      moveSpeed: { level: 3, bonus: 0.15 },
      pickup: { level: 5, bonus: 0.25 },
    });
  });
});

describe('buildResultStats — 빈 입력', () => {
  it('킬 0·마법 0이면 빈 리스트와 총계 0, 생존 00:00을 낸다', () => {
    const view = buildResultStats(input(), noSpells, noEnemies);
    expect(view.killTotal).toBe(0);
    expect(view.killsByType).toEqual([]);
    expect(view.spells).toEqual([]);
    expect(view.survivalTime).toBe('00:00');
  });
});
