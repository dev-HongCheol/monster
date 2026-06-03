import { beforeEach, describe, expect, it } from 'vitest';
import type { ICardData } from '../../game/assets/scripts/data/GameTypes';
import { DeckLogic } from '../../game/assets/scripts/logic/DeckLogic';

const makeCard = (id: string, effect: ICardData['effect'] = {}): ICardData => ({
  id,
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

describe('DeckLogic.applyCard — 플레이어 강화(전역 패시브)', () => {
  let deck: DeckLogic;

  beforeEach(() => {
    deck = new DeckLogic();
  });

  it('초기값: maxHpBonus=0 (마법 데미지/쿨다운 합산은 EnhancementLogic 담당 — DeckLogic은 비전투 패시브만)', () => {
    expect(deck.maxHpBonus).toBe(0);
  });

  it('maxHpBonus가 누적 가산된다', () => {
    deck.applyCard(makeCard('x', { maxHpBonus: 20 }));
    deck.applyCard(makeCard('y', { maxHpBonus: 10 }));
    expect(deck.maxHpBonus).toBe(30);
  });

  it('effect가 비어 있으면 수치가 변경되지 않는다', () => {
    deck.applyCard(makeCard('x', {}));
    expect(deck.maxHpBonus).toBe(0);
  });
});
