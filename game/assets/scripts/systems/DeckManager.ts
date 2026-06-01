import { _decorator, Component } from 'cc';
import type { ICardData } from '../data/GameTypes';
import { DeckLogic } from '../logic/DeckLogic';
import { DataManager } from './DataManager';

const { ccclass } = _decorator;

/** 카드 풀 관리, 드로우, 강화 적용을 담당하는 싱글톤 */
@ccclass('DeckManager')
export class DeckManager extends Component {
  static instance!: DeckManager;

  private _logic = new DeckLogic();

  get damageMult() {
    return this._logic.damageMult;
  }
  get cooldownMult() {
    return this._logic.cooldownMult;
  }
  get maxHpBonus() {
    return this._logic.maxHpBonus;
  }

  onLoad() {
    DeckManager.instance = this;
  }

  onDestroy() {
    if (DeckManager.instance === this) {
      DeckManager.instance = null as unknown as DeckManager;
    }
  }

  /**
   * base 카드 + 미보유 마법 합성 카드로 풀을 만들고 n장을 무작위로 뽑아 반환한다.
   * @param n 뽑을 장 수
   * @param ownedSpellIds 현재 로드아웃 보유 마법 id (마법 추가 카드 합성 제외용)
   * @param isFull 로드아웃이 가득 찼는지 (true면 마법 추가 카드 미합성)
   */
  drawCards(n: number, ownedSpellIds: string[], isFull: boolean): ICardData[] {
    const pool = this._logic.buildDrawPool(
      DataManager.instance.cards,
      DataManager.instance.spells,
      ownedSpellIds,
      isFull,
    );
    return this._logic.drawCards(pool, n);
  }

  /** 카드 효과를 영구 적용한다. */
  applyCard(card: ICardData): void {
    this._logic.applyCard(card);
  }
}
