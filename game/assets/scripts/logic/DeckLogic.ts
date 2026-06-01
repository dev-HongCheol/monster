import { type ICardData, type ISpellData, SpellCategory } from '../data/GameTypes';

const MIN_COOLDOWN_MULT = 0.1;

/** 마법 분류 → 한글 라벨 (합성 카드 설명용) */
const CATEGORY_LABEL: Record<SpellCategory, string> = {
  [SpellCategory.Fire]: '화염',
  [SpellCategory.Ice]: '얼음',
  [SpellCategory.Lightning]: '번개',
  [SpellCategory.Support]: '보조',
};

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
   * 드로우 후보 풀을 만든다 — base 카드(강화/패시브) + 미보유 마법 합성 카드(기획 § 6).
   *
   * 미보유 마법만 "마법 추가" 카드로 등장하고(§ 6.2), 로드아웃이 가득 차면 합성하지 않는다(§ 6.3).
   * cards.json을 늘리지 않고 spells.json에서 즉석 합성하므로 마법 추가 = 데이터 한 줄.
   * @param baseCards 강화/패시브 카드 풀 (cards.json)
   * @param allSpells 전체 마법 데이터 (spells.json)
   * @param ownedSpellIds 현재 로드아웃 보유 마법 id
   * @param isFull 로드아웃이 가득 찼는지
   */
  buildDrawPool(
    baseCards: ICardData[],
    allSpells: ISpellData[],
    ownedSpellIds: string[],
    isFull: boolean,
  ): ICardData[] {
    if (isFull) return [...baseCards];

    const owned = new Set(ownedSpellIds);
    const magicCards: ICardData[] = allSpells
      .filter((spell) => !owned.has(spell.id))
      .map((spell) => ({
        id: `add_${spell.id}`,
        name: spell.name,
        description: `신규 마법 추가 (${CATEGORY_LABEL[spell.category]} · ${spell.tier}등급)`,
        type: 'magic',
        effect: {},
        spellId: spell.id,
      }));

    return [...baseCards, ...magicCards];
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
