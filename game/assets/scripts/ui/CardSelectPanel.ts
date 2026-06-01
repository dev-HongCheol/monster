import { _decorator, Button, Component, Label } from 'cc';
import { SpellCaster } from '../components/SpellCaster';
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
    const loadout = SpellCaster.instance?.loadout;
    const ownedSpellIds = loadout ? loadout.spells : [];
    const isFull = loadout ? loadout.isFull : false;
    this._drawnCards = DeckManager.instance.drawCards(3, ownedSpellIds, isFull);
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

  /** 카드를 선택해 효과(강화/패시브) 또는 마법 추가를 적용하고 게임을 재개한다. */
  private _onPickCard(idx: number): void {
    const card = this._drawnCards[idx];
    if (!card) return;
    if (card.type === 'magic' && card.spellId) {
      SpellCaster.instance?.addSpell(card.spellId);
    } else {
      DeckManager.instance.applyCard(card);
    }
    GameManager.instance.resumeFromLevelUp();
  }
}
