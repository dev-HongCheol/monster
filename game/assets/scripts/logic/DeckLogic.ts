import type { ICardData, ISpellData } from '../data/GameTypes';

/**
 * 카드 드로우 + 플레이어 강화(전역 패시브) 적용 순수 로직 — cc import 없음.
 *
 * 마법 데미지·쿨다운 합산(개별·분류·전역 3-tier)은 `EnhancementLogic`이 담당한다(기획 § 7.3).
 * 여기서는 비전투 플레이어 패시브(현재 maxHp, 향후 이동속도/픽업 등)만 누적한다.
 */
export class DeckLogic {
  private _maxHpBonus = 0;
  private _moveSpeedBonus = 0;
  private _pickupRangeBonus = 0;
  // 결과 화면 표시용 패시브 레벨(획득 횟수). 마법 강화와 달리 티어·상한 없는 단일 카운트.
  private _maxHpLevel = 0;
  private _moveSpeedLevel = 0;
  private _pickupRangeLevel = 0;

  get maxHpBonus() {
    return this._maxHpBonus;
  }

  /** 이동속도 보너스 누적값 (가산·상한 없음). 소비처: PlayerController._move */
  get moveSpeedBonus() {
    return this._moveSpeedBonus;
  }

  /** 픽업범위 보너스 누적값 (가산·상한 없음). 소비처: ExperienceManager 픽업 반경 getter */
  get pickupRangeBonus() {
    return this._pickupRangeBonus;
  }

  /** 최대HP 강화 획득 횟수(레벨). 결과 화면 패시브 표시용. */
  get maxHpLevel() {
    return this._maxHpLevel;
  }

  /** 이동속도 강화 획득 횟수(레벨). 결과 화면 패시브 표시용. */
  get moveSpeedLevel() {
    return this._moveSpeedLevel;
  }

  /** 픽업범위 강화 획득 횟수(레벨). 결과 화면 패시브 표시용. */
  get pickupLevel() {
    return this._pickupRangeLevel;
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
    // 정적 카드: id 파생 표시 키 부여 (표시 해석은 UI가 t()로 — logic엔 표시 문자열 없음)
    const base: ICardData[] = baseCards.map((card) => ({
      ...card,
      nameKey: `card.${card.id}.name`,
      descKey: `card.${card.id}.desc`,
    }));
    if (isFull) return base;

    const owned = new Set(ownedSpellIds);
    const magicCards: ICardData[] = allSpells
      .filter((spell) => !owned.has(spell.id))
      .map((spell) => ({
        id: `add_${spell.id}`,
        type: 'magic',
        effect: {},
        spellId: spell.id,
        // 마법 이름 키 + 공통 add_magic 설명 키 + 분류 키·등급 파라미터 (UI에서 결합 해석)
        nameKey: `spell.${spell.id}.name`,
        descKey: 'card.add_magic',
        descParams: { category: `category.${spell.category}`, tier: spell.tier },
      }));

    return [...base, ...magicCards];
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
   * 플레이어 강화 카드 효과를 영구 적용한다. (강화 카드의 per-spell/분류 효과는 DeckManager가 라우팅)
   * @param card 선택한 카드
   */
  applyCard(card: ICardData): void {
    const e = card.effect;
    // 보너스 누적 + 획득 횟수(레벨) 증가를 함께 센다(레벨은 결과 화면 표시용).
    if (e.maxHpBonus !== undefined) {
      this._maxHpBonus += e.maxHpBonus;
      this._maxHpLevel++;
    }
    if (e.moveSpeedBonus !== undefined) {
      this._moveSpeedBonus += e.moveSpeedBonus;
      this._moveSpeedLevel++;
    }
    if (e.pickupRangeBonus !== undefined) {
      this._pickupRangeBonus += e.pickupRangeBonus;
      this._pickupRangeLevel++;
    }
  }
}
