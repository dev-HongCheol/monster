import { describe, expect, it } from 'vitest';
import {
  type ICardData,
  type ISpellData,
  SpellCategory,
  SpellPattern,
} from '../../game/assets/scripts/data/GameTypes';
import { DeckLogic } from '../../game/assets/scripts/logic/DeckLogic';

const makeCard = (id: string): ICardData => ({
  id,
  type: 'enhancement',
  effect: {},
});

const makeSpell = (id: string, category = SpellCategory.Fire): ISpellData => ({
  id,
  category,
  tier: 1,
  damage: 10,
  projectileSpeed: 400,
  projectileRadius: 8,
  cooldown: 0.5,
  projectileCount: 1,
  pattern: SpellPattern.Directional,
});

describe('DeckLogic.buildDrawPool', () => {
  const base: ICardData[] = [makeCard('dmg'), makeCard('hp')];
  const spells: ISpellData[] = [
    makeSpell('fireball', SpellCategory.Fire),
    makeSpell('ice_missile', SpellCategory.Ice),
    makeSpell('lightning_bolt', SpellCategory.Lightning),
  ];

  const baseIds = base.map((c) => c.id);

  it('base 카드는 항상 풀에 포함된다 (id 기준)', () => {
    const deck = new DeckLogic();
    const pool = deck.buildDrawPool(base, spells, [], false);
    expect(pool.map((c) => c.id)).toEqual(expect.arrayContaining(baseIds));
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

  it('magic 카드는 한글 description 대신 키/params를 산출한다 (i18n)', () => {
    const deck = new DeckLogic();
    const pool = deck.buildDrawPool(base, spells, [], false);
    const fireCard = pool.find((c) => c.spellId === 'fireball');
    // 표시명은 마법 이름 키, 설명은 공통 add_magic 키 + 분류 키·등급 파라미터
    expect(fireCard?.nameKey).toBe('spell.fireball.name');
    expect(fireCard?.descKey).toBe('card.add_magic');
    expect(fireCard?.descParams).toEqual({ category: 'category.fire', tier: 1 });
    // 로직에 한글 표시 문자열이 새지 않는다
    expect(JSON.stringify(fireCard)).not.toContain('등급');
  });

  it('정적(base) 카드는 id 파생 표시 키를 부여받는다', () => {
    const deck = new DeckLogic();
    const pool = deck.buildDrawPool(base, spells, [], false);
    const dmgCard = pool.find((c) => c.id === 'dmg');
    expect(dmgCard?.nameKey).toBe('card.dmg.name');
    expect(dmgCard?.descKey).toBe('card.dmg.desc');
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
    expect(pool.map((c) => c.id)).toEqual(expect.arrayContaining(baseIds));
  });

  it('모든 마법을 보유 중이면 base 카드만 반환한다', () => {
    const deck = new DeckLogic();
    const owned = spells.map((s) => s.id);
    const pool = deck.buildDrawPool(base, spells, owned, false);
    expect(pool.some((c) => c.type === 'magic')).toBe(false);
    expect(pool.map((c) => c.id)).toEqual(expect.arrayContaining(baseIds));
  });
});
