import { _decorator, Button, Component, Label } from 'cc';
import { SpellCaster } from '../components/SpellCaster';
import type { ICardData } from '../data/GameTypes';
import type { I18nParams } from '../logic/I18nLogic';
import { DataManager } from '../systems/DataManager';
import { DeckManager } from '../systems/DeckManager';
import { GameManager } from '../systems/GameManager';
import { I18n } from '../systems/I18n';

const { ccclass, property } = _decorator;

/** 웨이브 클리어 시 카드 3장을 보여주고 선택을 받는 UI */
@ccclass('CardSelectPanel')
export class CardSelectPanel extends Component {
  @property([Button]) cardButtons: Button[] = [];
  @property([Label]) cardNameLabels: Label[] = [];
  @property([Label]) cardDescLabels: Label[] = [];

  /** descParams 중 값이 카탈로그 키(중첩 키)인 파라미터 — UI가 먼저 t()로 선해석한다 */
  private static readonly NESTED_KEY_PARAMS = ['category', 'spell', 'option'];

  private _drawnCards: ICardData[] = [];

  // 패널이 열릴 때 카드 3장을 뽑아 버튼별 이름·설명을 채우고 선택 콜백을 배선한다
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
      if (this.cardNameLabels[i]) this.cardNameLabels[i].string = this._resolveName(card);
      if (this.cardDescLabels[i]) this.cardDescLabels[i].string = this._resolveDesc(card);

      const idx = i;
      this.cardButtons[i].node.off(Button.EventType.CLICK);
      this.cardButtons[i].node.on(Button.EventType.CLICK, () => this._onPickCard(idx), this);
    }
  }

  /** 카드 표시 이름을 카탈로그 키로 해석한다 (키 없으면 id 폴백). */
  private _resolveName(card: ICardData): string {
    const key = card.nameKey ?? card.id;
    return I18n.instance ? I18n.instance.t(key) : key;
  }

  /**
   * 카드 설명을 해석한다. `category`/`spell`/`option` 파라미터는 카탈로그 키(`category.fire`,
   * `spell.fireball.name`, `upgrade.damage`)이므로 먼저 t()로 해석한 뒤 설명 템플릿에 치환한다(중첩 키).
   */
  private _resolveDesc(card: ICardData): string {
    const i18n = I18n.instance;
    if (!card.descKey) return '';
    if (!i18n) return card.descKey;
    let params: I18nParams | undefined = card.descParams;
    if (params) {
      const resolved: I18nParams = { ...params };
      for (const name of CardSelectPanel.NESTED_KEY_PARAMS) {
        const value = resolved[name];
        if (typeof value === 'string') resolved[name] = i18n.t(value);
      }
      params = resolved;
    }
    return i18n.t(card.descKey, params);
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
