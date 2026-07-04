import { describe, expect, it } from 'vitest';
import { type ISpellData, SpellCategory } from '../../game/assets/scripts/data/GameTypes';
import {
  buildSpellIconRow,
  categoryInitial,
} from '../../game/assets/scripts/logic/SpellIconRowLogic';
import { spellCategoryColor } from '../../game/assets/scripts/logic/SpellVisual';

/** 최소 마법 픽스처 — 아이콘 행 로직은 id·category·tier만 읽는다. */
function spell(id: string, category: SpellCategory, tier: number): ISpellData {
  return { id, category, tier } as unknown as ISpellData;
}

/** 픽스처 맵으로 getSpell 콜백을 만든다(미보유 id는 null). */
function lookup(...spells: ISpellData[]): (id: string) => ISpellData | null {
  const map = new Map(spells.map((s) => [s.id, s]));
  return (id: string) => map.get(id) ?? null;
}

describe('categoryInitial — 분류 이니셜', () => {
  it('fire는 "F"다', () => {
    expect(categoryInitial(SpellCategory.Fire)).toBe('F');
  });

  it('ice는 "I"다', () => {
    expect(categoryInitial(SpellCategory.Ice)).toBe('I');
  });

  it('lightning은 "L"이다', () => {
    expect(categoryInitial(SpellCategory.Lightning)).toBe('L');
  });

  it('support는 "S"다', () => {
    expect(categoryInitial(SpellCategory.Support)).toBe('S');
  });
});

describe('buildSpellIconRow — 슬롯 배열 빌드', () => {
  it('보유가 없으면 길이 maxSlots 전부 빈 슬롯(null)이다', () => {
    const row = buildSpellIconRow([], lookup(), 6);
    expect(row).toHaveLength(6);
    expect(row.every((s) => s === null)).toBe(true);
  });

  it('1개 보유면 앞칸을 채우고 나머지는 빈 슬롯이다', () => {
    const fireball = spell('fireball', SpellCategory.Fire, 1);
    const row = buildSpellIconRow(['fireball'], lookup(fireball), 6);
    expect(row).toHaveLength(6);
    expect(row[0]).toEqual({
      id: 'fireball',
      colorRgb: spellCategoryColor(SpellCategory.Fire),
      label: 'F1',
    });
    expect(row.slice(1).every((s) => s === null)).toBe(true);
  });

  it('티어 오름차순으로 정렬한다 (F1 → I3)', () => {
    const fireball = spell('fireball', SpellCategory.Fire, 1);
    const frostNova = spell('frost_nova', SpellCategory.Ice, 3);
    // 입력은 티어 역순으로 넣어도 정렬돼야 한다
    const row = buildSpellIconRow(['frost_nova', 'fireball'], lookup(fireball, frostNova), 6);
    expect(row[0]?.label).toBe('F1');
    expect(row[1]?.label).toBe('I3');
  });

  it('중간 티어를 사이에 끼워 정렬한다 (I1 → F2 → I3)', () => {
    const iceMissile = spell('ice_missile', SpellCategory.Ice, 1);
    const inferno = spell('inferno', SpellCategory.Fire, 2);
    const frostNova = spell('frost_nova', SpellCategory.Ice, 3);
    const row = buildSpellIconRow(
      ['frost_nova', 'inferno', 'ice_missile'],
      lookup(iceMissile, inferno, frostNova),
      6,
    );
    expect(row[0]?.label).toBe('I1');
    expect(row[1]?.label).toBe('F2');
    expect(row[2]?.label).toBe('I3');
  });

  it('같은 티어는 입력(획득) 순서를 보존한다 (안정 정렬)', () => {
    const fireball = spell('fireball', SpellCategory.Fire, 1);
    const iceMissile = spell('ice_missile', SpellCategory.Ice, 1);
    const lightning = spell('lightning_bolt', SpellCategory.Lightning, 1);
    const row = buildSpellIconRow(
      ['lightning_bolt', 'fireball', 'ice_missile'],
      lookup(fireball, iceMissile, lightning),
      6,
    );
    expect(row[0]?.id).toBe('lightning_bolt');
    expect(row[1]?.id).toBe('fireball');
    expect(row[2]?.id).toBe('ice_missile');
  });

  it('getSpell이 null인 id는 슬롯에서 생략한다 (데이터 정합성 가드)', () => {
    const fireball = spell('fireball', SpellCategory.Fire, 1);
    const row = buildSpellIconRow(['ghost', 'fireball'], lookup(fireball), 6);
    expect(row[0]?.id).toBe('fireball');
    expect(row.filter((s) => s !== null)).toHaveLength(1);
  });

  it('보유가 maxSlots를 넘으면 티어순 앞에서 잘라 채운다 (빈칸 없음)', () => {
    const fireball = spell('fireball', SpellCategory.Fire, 1);
    const iceMissile = spell('ice_missile', SpellCategory.Ice, 1);
    const frostNova = spell('frost_nova', SpellCategory.Ice, 3);
    const row = buildSpellIconRow(
      ['frost_nova', 'fireball', 'ice_missile'],
      lookup(fireball, iceMissile, frostNova),
      2,
    );
    expect(row).toHaveLength(2);
    expect(row.every((s) => s !== null)).toBe(true);
    // 티어 3(frost_nova)은 잘려 나간다
    expect(row.some((s) => s?.id === 'frost_nova')).toBe(false);
  });

  it('라벨은 분류 이니셜 + 티어다 (inferno → "F2")', () => {
    const inferno = spell('inferno', SpellCategory.Fire, 2);
    const row = buildSpellIconRow(['inferno'], lookup(inferno), 6);
    expect(row[0]?.label).toBe('F2');
  });
});
