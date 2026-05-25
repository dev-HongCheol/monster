import type { ICardData } from '../data/GameTypes';

const MIN_COOLDOWN_MULT = 0.1;

/** 카드 드로우·강화 적용 순수 로직 — cc import 없음 */
export class DeckLogic {
  private _damageMult = 1;
  private _cooldownMult = 1;
  private _maxHpBonus = 0;

  get damageMult() {
    return this._damageMult;
  }
  get cooldownMult() {
    return this._cooldownMult;
  }
  get maxHpBonus() {
    return this._maxHpBonus;
  }

  /**
   * 카드 풀에서 n장을 비복원 추출해 반환한다.
   * @param pool 전체 카드 풀 (원본 불변)
   * @param n 뽑을 장 수
   */
  drawCards(pool: ICardData[], n: number): ICardData[] {
    const copy = [...pool];
    const drawn: ICardData[] = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      drawn.push(copy.splice(idx, 1)[0]);
    }
    return drawn;
  }

  /**
   * 카드 효과를 영구 적용한다.
   * @param card 선택한 카드
   */
  applyCard(card: ICardData): void {
    const e = card.effect;
    if (e.damageMult !== undefined) this._damageMult += e.damageMult;
    if (e.cooldownMult !== undefined) {
      this._cooldownMult = Math.max(MIN_COOLDOWN_MULT, this._cooldownMult + e.cooldownMult);
    }
    if (e.maxHpBonus !== undefined) this._maxHpBonus += e.maxHpBonus;
  }
}
