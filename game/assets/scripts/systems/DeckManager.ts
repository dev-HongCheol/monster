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

  /** 카드 풀에서 n장을 무작위로 뽑아 반환한다. */
  drawCards(n: number): ICardData[] {
    return this._logic.drawCards(DataManager.instance.cards, n);
  }

  /** 카드 효과를 영구 적용한다. */
  applyCard(card: ICardData): void {
    this._logic.applyCard(card);
  }
}
