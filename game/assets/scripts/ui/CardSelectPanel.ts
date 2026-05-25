import { _decorator, Button, Component, Label } from 'cc';
import type { ICardData } from '../data/GameTypes';
import { DataManager } from '../systems/DataManager';
import { DeckManager } from '../systems/DeckManager';
import { GameManager } from '../systems/GameManager';

const { ccclass, property } = _decorator;

/** 웨이브 클리어 시 카드 3장을 보여주고 선택을 받는 UI */
@ccclass('CardSelectPanel')
export class CardSelectPanel extends Component {
  @property([Button]) cardButtons: Button[] = [];
  @property([Label]) cardNameLabels: Label[] = [];
  @property([Label]) cardDescLabels: Label[] = [];

  private _drawnCards: ICardData[] = [];

  onEnable() {
    if (!DataManager.instance?.isReady) return;
    this._drawnCards = DeckManager.instance.drawCards(3);
    for (let i = 0; i < this.cardButtons.length; i++) {
      const card = this._drawnCards[i];
      if (!card) {
        this.cardButtons[i].node.active = false;
        continue;
      }
      this.cardButtons[i].node.active = true;
      if (this.cardNameLabels[i]) this.cardNameLabels[i].string = card.name;
      if (this.cardDescLabels[i]) this.cardDescLabels[i].string = card.description;

      const idx = i;
      this.cardButtons[i].node.off(Button.EventType.CLICK);
      this.cardButtons[i].node.on(Button.EventType.CLICK, () => this._onPickCard(idx), this);
    }
  }

  /** 카드를 선택해 효과를 적용하고 다음 웨이브를 시작한다. */
  private _onPickCard(idx: number): void {
    const card = this._drawnCards[idx];
    if (!card) return;
    DeckManager.instance.applyCard(card);
    GameManager.instance.startNextWave();
  }
}
