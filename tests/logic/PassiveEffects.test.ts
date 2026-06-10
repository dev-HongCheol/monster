import { beforeEach, describe, expect, it } from 'vitest';
import type { ICardData } from '../../game/assets/scripts/data/GameTypes';
import { DeckLogic } from '../../game/assets/scripts/logic/DeckLogic';

const makeCard = (id: string, effect: ICardData['effect'] = {}): ICardData => ({
  id,
  type: 'passive',
  effect,
});

// 패시브 효과 슬라이스: DeckLogic이 이동속도·픽업범위 보너스를 HP와 동일한
// 가산(additive)·상한 없음 패턴으로 누적하는지 검증한다(순수 로직 — cc 무의존).
// cc 배선(PlayerController 속도, ExperienceManager/XPItemController 픽업 라이브 적용)은
// 수동 QA(docs/qa/passive-effects-test.md)로 확인한다.
describe('DeckLogic — 패시브 누적 (이동속도·픽업범위)', () => {
  let deck: DeckLogic;

  beforeEach(() => {
    deck = new DeckLogic();
  });

  it('초기값: moveSpeedBonus=0, pickupRangeBonus=0', () => {
    expect(deck.moveSpeedBonus).toBe(0);
    expect(deck.pickupRangeBonus).toBe(0);
  });

  it('moveSpeedBonus가 카드 선택마다 가산 누적된다', () => {
    deck.applyCard(makeCard('move_speed_up', { moveSpeedBonus: 0.1 }));
    deck.applyCard(makeCard('move_speed_up', { moveSpeedBonus: 0.1 }));
    expect(deck.moveSpeedBonus).toBeCloseTo(0.2);
  });

  it('pickupRangeBonus가 카드 선택마다 가산 누적된다', () => {
    deck.applyCard(makeCard('pickup_range_up', { pickupRangeBonus: 0.3 }));
    deck.applyCard(makeCard('pickup_range_up', { pickupRangeBonus: 0.3 }));
    expect(deck.pickupRangeBonus).toBeCloseTo(0.6);
  });

  it('빈 effect는 패시브 수치를 변경하지 않는다', () => {
    deck.applyCard(makeCard('noop', {}));
    expect(deck.moveSpeedBonus).toBe(0);
    expect(deck.pickupRangeBonus).toBe(0);
  });

  it('HP·이동속도·픽업이 서로 독립적으로 누적된다', () => {
    deck.applyCard(makeCard('hp_up', { maxHpBonus: 20 }));
    deck.applyCard(makeCard('move_speed_up', { moveSpeedBonus: 0.1 }));
    deck.applyCard(makeCard('pickup_range_up', { pickupRangeBonus: 0.3 }));
    expect(deck.maxHpBonus).toBe(20);
    expect(deck.moveSpeedBonus).toBeCloseTo(0.1);
    expect(deck.pickupRangeBonus).toBeCloseTo(0.3);
  });
});
