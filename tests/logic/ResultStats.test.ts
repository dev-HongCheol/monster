import { describe, expect, it } from 'vitest';
import { SpellCategory, UpgradeOption } from '../../game/assets/scripts/data/GameTypes';
import {
  buildResultStats,
  type ResultSpellSnapshot,
  type ResultStatsInput,
} from '../../game/assets/scripts/logic/ResultStatsLogic';

/** 한 옵션의 3티어 레벨(전역 g / 분류 c / 개별 i) + 최종 배율 factor. */
function lv(g: number, c: number, i: number, factor: number) {
  return { g, c, i, factor };
}

/** 마법 강화 스냅샷 픽스처 — 분류·티어까지 해석 완료(DataManager 비의존). */
function spellSnap(
  id: string,
  category: SpellCategory,
  tier: number,
  dmg = lv(0, 0, 0, 1),
  cd = lv(0, 0, 0, 1),
): ResultSpellSnapshot {
  return { id, category, tier, dmg, cd };
}

/** 통계 스냅샷 기본값 — 각 테스트가 필요한 필드만 덮어쓴다. */
function input(overrides: Partial<ResultStatsInput> = {}): ResultStatsInput {
  return {
    survivalSec: 0,
    level: 1,
    kills: [],
    spells: [],
    passives: {
      maxHp: { level: 0, bonus: 0 },
      moveSpeed: { level: 0, bonus: 0 },
      pickup: { level: 0, bonus: 0 },
    },
    ...overrides,
  };
}

describe('buildResultStats — 기본 지표', () => {
  it('생존 시간을 mm:ss로 포맷한다 (600초 → "10:00")', () => {
    expect(buildResultStats(input({ survivalSec: 600 })).survivalTime).toBe('10:00');
  });

  it('생존 시간 초 단위를 올바로 포맷한다 (65초 → "01:05")', () => {
    expect(buildResultStats(input({ survivalSec: 65 })).survivalTime).toBe('01:05');
  });

  it('도달 레벨을 그대로 전달한다', () => {
    expect(buildResultStats(input({ level: 14 })).level).toBe(14);
  });
});

describe('buildResultStats — 킬 통계', () => {
  it('킬 총계는 종류별 킬의 합이다', () => {
    const view = buildResultStats(
      input({
        kills: [
          { name: '달걀귀신', count: 152 },
          { name: '처녀귀신', count: 121 },
        ],
      }),
    );
    expect(view.killTotal).toBe(273);
  });

  it('킬 종류별을 count 내림차순으로 정렬한다 (적 이름은 스냅샷에서 해석됨)', () => {
    const view = buildResultStats(
      input({
        kills: [
          { name: '달걀귀신', count: 10 },
          { name: '처녀귀신', count: 50 },
          { name: '도깨비', count: 30 },
        ],
      }),
    );
    expect(view.killsByType).toEqual([
      { name: '처녀귀신', count: 50 },
      { name: '도깨비', count: 30 },
      { name: '달걀귀신', count: 10 },
    ]);
  });

  it('동률 킬은 입력 순서를 보존한다 (안정 정렬)', () => {
    const view = buildResultStats(
      input({
        kills: [
          { name: '가', count: 5 },
          { name: '나', count: 5 },
          { name: '다', count: 5 },
        ],
      }),
    );
    expect(view.killsByType.map((k) => k.name)).toEqual(['가', '나', '다']);
  });
});

describe('buildResultStats — 보유 마법 라벨', () => {
  it('티어 라벨(분류 이니셜+티어)과 이름 i18n 키를 낸다', () => {
    const view = buildResultStats(
      input({ spells: [spellSnap('fireball', SpellCategory.Fire, 1)] }),
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
          spellSnap('frost_nova', SpellCategory.Ice, 3),
          spellSnap('fireball', SpellCategory.Fire, 1),
        ],
      }),
    );
    expect(view.spells.map((s) => s.tierLabel)).toEqual(['F1', 'I3']);
  });

  it('같은 티어는 입력(획득) 순서를 보존한다 (안정 정렬)', () => {
    const view = buildResultStats(
      input({
        spells: [
          spellSnap('lightning_bolt', SpellCategory.Lightning, 1),
          spellSnap('fireball', SpellCategory.Fire, 1),
          spellSnap('ice_missile', SpellCategory.Ice, 1),
        ],
      }),
    );
    expect(view.spells.map((s) => s.id)).toEqual(['lightning_bolt', 'fireball', 'ice_missile']);
  });
});

describe('buildResultStats — 강화 레벨 브레이크다운', () => {
  it('데미지·쿨다운 순으로 두 옵션을 낸다', () => {
    const view = buildResultStats(
      input({
        spells: [spellSnap('fireball', SpellCategory.Fire, 1, lv(1, 1, 1, 2), lv(1, 0, 0, 1.25))],
      }),
    );
    expect(view.spells[0].upgrades.map((u) => u.option)).toEqual([
      UpgradeOption.Damage,
      UpgradeOption.Cooldown,
    ]);
  });

  it('총합 = 전역 + 분류 + 개별이고 각 티어 레벨을 그대로 낸다', () => {
    const view = buildResultStats(
      input({
        spells: [spellSnap('fireball', SpellCategory.Fire, 1, lv(1, 2, 3, 2), lv(1, 0, 0, 1.25))],
      }),
    );
    expect(view.spells[0].upgrades[0]).toMatchObject({
      global: 1,
      category: 2,
      individual: 3,
      total: 6,
    });
  });

  it('데미지 최종 효과 %는 +(factor−1) 반올림이다 (배율 2.0 → +100%)', () => {
    const view = buildResultStats(
      input({
        spells: [spellSnap('fireball', SpellCategory.Fire, 1, lv(1, 1, 1, 2), lv(0, 0, 0, 1))],
      }),
    );
    expect(view.spells[0].upgrades[0].effectPct).toBe(100);
  });

  it('쿨다운 최종 효과 %는 단축 −(1−1/factor) 반올림이다 (배율 1.25 → −20%)', () => {
    const view = buildResultStats(
      input({
        spells: [spellSnap('fireball', SpellCategory.Fire, 1, lv(0, 0, 0, 1), lv(1, 0, 0, 1.25))],
      }),
    );
    expect(view.spells[0].upgrades[1].effectPct).toBe(-20);
  });

  it('미강화 마법은 세 티어 모두 0이고 효과 %도 0이다', () => {
    const view = buildResultStats(
      input({ spells: [spellSnap('fireball', SpellCategory.Fire, 1)] }),
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
    const view = buildResultStats(input());
    expect(view.killTotal).toBe(0);
    expect(view.killsByType).toEqual([]);
    expect(view.spells).toEqual([]);
    expect(view.survivalTime).toBe('00:00');
  });
});
