import { beforeEach, describe, expect, it } from 'vitest';
import type { ICardData } from '../../game/assets/scripts/data/GameTypes';
import { DeckLogic } from '../../game/assets/scripts/logic/DeckLogic';

const makeCard = (id: string, effect: ICardData['effect'] = {}): ICardData => ({
  id,
  name: id,
  description: '',
  type: 'enhancement',
  effect,
});

describe('DeckLogic.drawCards', () => {
  let deck: DeckLogic;
  const pool: ICardData[] = [makeCard('a'), makeCard('b'), makeCard('c')];

  beforeEach(() => {
    deck = new DeckLogic();
  });

  it('n=0 이면 빈 배열을 반환한다', () => {
    expect(deck.drawCards(pool, 0)).toEqual([]);
  });

  it('풀이 비어 있으면 빈 배열을 반환한다', () => {
    expect(deck.drawCards([], 3)).toEqual([]);
  });

  it('n > pool.length 이면 풀 전체를 반환하고 중복 없음', () => {
    const result = deck.drawCards(pool, 10);
    expect(result).toHaveLength(3);
    const ids = result.map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('같은 카드가 한 번의 드로우에서 중복으로 나오지 않는다', () => {
    const result = deck.drawCards(pool, 2);
    const ids = result.map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('원본 pool 배열을 변경하지 않는다', () => {
    const original = [...pool];
    deck.drawCards(pool, 3);
    expect(pool).toEqual(original);
  });
});

describe('DeckLogic.applyCard', () => {
  let deck: DeckLogic;

  beforeEach(() => {
    deck = new DeckLogic();
  });

  it('초기값: damageMult=1, cooldownMult=1, maxHpBonus=0', () => {
    expect(deck.damageMult).toBe(1);
    expect(deck.cooldownMult).toBe(1);
    expect(deck.maxHpBonus).toBe(0);
  });

  it('damageMult가 누적 가산된다', () => {
    deck.applyCard(makeCard('x', { damageMult: 0.2 }));
    deck.applyCard(makeCard('y', { damageMult: 0.3 }));
    expect(deck.damageMult).toBeCloseTo(1.5);
  });

  it('cooldownMult가 누적 가산된다', () => {
    deck.applyCard(makeCard('x', { cooldownMult: -0.2 }));
    expect(deck.cooldownMult).toBeCloseTo(0.8);
  });

  it('cooldownMult는 MIN_COOLDOWN_MULT(0.1) 아래로 내려가지 않는다', () => {
    for (let i = 0; i < 20; i++) {
      deck.applyCard(makeCard(`x${i}`, { cooldownMult: -0.5 }));
    }
    expect(deck.cooldownMult).toBe(0.1);
  });

  it('maxHpBonus가 누적 가산된다', () => {
    deck.applyCard(makeCard('x', { maxHpBonus: 20 }));
    deck.applyCard(makeCard('y', { maxHpBonus: 10 }));
    expect(deck.maxHpBonus).toBe(30);
  });

  it('effect 필드가 undefined이면 해당 수치가 변경되지 않는다', () => {
    deck.applyCard(makeCard('x', {}));
    expect(deck.damageMult).toBe(1);
    expect(deck.cooldownMult).toBe(1);
    expect(deck.maxHpBonus).toBe(0);
  });
});
