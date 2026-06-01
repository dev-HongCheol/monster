import { describe, expect, it } from 'vitest';
import {
  type ICardData,
  type ISpellData,
  SpellCategory,
} from '../../game/assets/scripts/data/GameTypes';
import { DeckLogic } from '../../game/assets/scripts/logic/DeckLogic';

const makeCard = (id: string): ICardData => ({
  id,
  name: id,
  description: '',
  type: 'enhancement',
  effect: {},
});

const makeSpell = (id: string, category = SpellCategory.Fire): ISpellData => ({
  id,
  name: `${id}-name`,
  category,
  tier: 1,
  damage: 10,
  projectileSpeed: 400,
  projectileRadius: 8,
  cooldown: 0.5,
  projectileCount: 1,
});

describe('DeckLogic.buildDrawPool', () => {
  const base: ICardData[] = [makeCard('dmg'), makeCard('hp')];
  const spells: ISpellData[] = [
    makeSpell('fireball', SpellCategory.Fire),
    makeSpell('ice_missile', SpellCategory.Ice),
    makeSpell('lightning_bolt', SpellCategory.Lightning),
  ];

  it('base 카드는 항상 풀에 포함된다', () => {
    const deck = new DeckLogic();
    const pool = deck.buildDrawPool(base, spells, [], false);
    expect(pool).toEqual(expect.arrayContaining(base));
  });

  it('미보유 마법은 magic 카드로 합성된다 (type, spellId, id 규칙)', () => {
    const deck = new DeckLogic();
    const pool = deck.buildDrawPool(base, spells, [], false);
    const magicCards = pool.filter((c) => c.type === 'magic');
    expect(magicCards).toHaveLength(3);

    const fireCard = magicCards.find((c) => c.spellId === 'fireball');
    expect(fireCard).toBeDefined();
    expect(fireCard?.id).toBe('add_fireball');
  });

  it('이미 보유한 마법은 magic 카드로 합성되지 않는다', () => {
    const deck = new DeckLogic();
    const pool = deck.buildDrawPool(base, spells, ['fireball'], false);
    const magicSpellIds = pool.filter((c) => c.type === 'magic').map((c) => c.spellId);
    expect(magicSpellIds).not.toContain('fireball');
    expect(magicSpellIds).toEqual(expect.arrayContaining(['ice_missile', 'lightning_bolt']));
  });

  it('로드아웃이 가득 차면(isFull) magic 카드를 합성하지 않고 base 카드만 반환한다', () => {
    const deck = new DeckLogic();
    const pool = deck.buildDrawPool(base, spells, [], true);
    expect(pool.some((c) => c.type === 'magic')).toBe(false);
    expect(pool).toEqual(expect.arrayContaining(base));
  });

  it('모든 마법을 보유 중이면 base 카드만 반환한다', () => {
    const deck = new DeckLogic();
    const owned = spells.map((s) => s.id);
    const pool = deck.buildDrawPool(base, spells, owned, false);
    expect(pool.some((c) => c.type === 'magic')).toBe(false);
    expect(pool).toEqual(expect.arrayContaining(base));
  });
});
