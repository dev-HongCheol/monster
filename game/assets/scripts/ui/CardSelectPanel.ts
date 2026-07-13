import { _decorator, Button, Component, Label } from 'cc';
import { DEV } from 'cc/env';
import { SpellCaster } from '../components/SpellCaster';
import type { ICardData, ISpellData } from '../data/GameTypes';
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
  // (이 노드는 비활성으로 시작하므로 onEnable이 start보다 먼저 돈다 — 호이스트를 여기서 한다.)
  onEnable() {
    // 이전 레벨업의 카드가 남아 다시 적용되는 일이 없도록 먼저 비운다.
    this._drawnCards = [];
    const dm = DataManager.instance;
    const deck = DeckManager.instance;
    if (!dm?.isReady || !deck) {
      // 카드를 못 뽑는 상태에서 패널만 열어 두면 플레이어가 레벨업에 영구히 갇힌다.
      // 레벨업을 건너뛰더라도 게임은 반드시 재개시킨다.
      console.error(
        '[CardSelectPanel] 데이터/DeckManager 없음 — 카드를 건너뛰고 게임을 재개합니다.',
      );
      GameManager.instance?.resumeFromLevelUp();
      return;
    }
    const loadout = SpellCaster.instance?.loadout;
    const ownedSpellIds = loadout ? loadout.spells : [];
    const isFull = loadout ? loadout.isFull : false;
    this._drawnCards = deck.drawCards(3, ownedSpellIds, isFull);
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

  /**
   * 카드를 선택해 효과(강화/패시브) 또는 마법 추가를 적용하고 게임을 재개한다.
   * **재개는 어떤 경우에도 실행한다** — 카드 적용에 실패했다고 여기서 빠져나가면 패널이 열린 채
   * 게임이 영구 정지한다. 카드 하나를 못 받는 것보다 게임이 멈추는 게 훨씬 나쁘다.
   */
  private _onPickCard(idx: number): void {
    const card = this._drawnCards[idx];
    if (!card) return;
    const deck = DeckManager.instance;
    if (card.type === 'magic' && card.spellId) {
      SpellCaster.instance?.addSpell(card.spellId);
    } else if (deck) {
      deck.applyCard(card);
    } else {
      console.error('[CardSelectPanel] DeckManager 없음 — 카드 효과를 건너뛰고 재개합니다.');
    }
    this._logEnhancementDebug(card);
    this._logPassiveDebug();
    GameManager.instance?.resumeFromLevelUp();
  }

  /**
   * [DEV 전용] 카드 픽 직후 패시브 누적 보너스·실효값을 한 줄로 출력한다.
   * 패시브(이동속도/픽업범위)는 인게임에서 수치를 눈으로 확인하기 어려워 관찰용 로그를 남긴다.
   * 보너스는 `DeckManager` getter, 베이스는 `DataManager.playerData`에서 읽어 실효값(base×(1+bonus))을
   * 표시한다. 마법 강화와 독립이라 보유 마법이 없어도 출력된다. `cc/env` `DEV`로 게이팅 — 릴리스 제거.
   */
  private _logPassiveDebug(): void {
    if (!DEV) return;
    const deck = DeckManager.instance;
    const base = DataManager.instance?.playerData;
    if (!base) return;
    const hpBonus = deck?.maxHpBonus ?? 0;
    const msBonus = deck?.moveSpeedBonus ?? 0;
    const prBonus = deck?.pickupRangeBonus ?? 0;
    const pct = (v: number): number => Math.round(v * 100);
    const round1 = (v: number): number => Number(v.toFixed(1));
    console.log(
      `[패시브] HP +${hpBonus} (실효 maxHp=${base.maxHp + hpBonus}) · ` +
        `이동속도 +${pct(msBonus)}% (실효 speed=${round1(base.speed * (1 + msBonus))}) · ` +
        `픽업범위 +${pct(prBonus)}% (실효 반경=${round1(base.pickupRadius * (1 + prBonus))})`,
    );
  }

  /**
   * [DEV 전용] 카드 픽 직후 보유 마법별 강화 수치를 console.table로 출력한다.
   * `cc/env`의 `DEV`로 게이팅 — 에디터/프리뷰/디버그 빌드에서만 찍히고 릴리스 빌드에선 제거된다.
   * 수치 계산은 순수 로직(EnhancementLogic.debugSnapshot), 여기선 표시명 해석·포맷·출력만 한다.
   */
  private _logEnhancementDebug(card: ICardData): void {
    if (!DEV) return;
    const loadout = SpellCaster.instance?.loadout;
    const dm = DataManager.instance;
    const deck = DeckManager.instance;
    if (!loadout || !dm?.isReady || !deck) return;
    // .map 클로저 안에서는 내로잉이 살아남지 않으므로 위에서 받아 둔 dm을 쓴다.
    const spells = loadout.spells
      .map((id) => dm.getSpell(id))
      .filter((s): s is ISpellData => s !== null);
    if (spells.length === 0) return;

    const snap = deck.debugEnhancement(spells);
    const i18n = I18n.instance;
    const round = (v: number, n: number): number => Number(v.toFixed(n));
    const table: Record<string, Record<string, number>> = {};
    for (const r of snap.rows) {
      const name = i18n ? i18n.t(`spell.${r.id}.name`) : r.id;
      table[name] = {
        개D: r.indivDmgLevel,
        분D: r.catDmgLevel,
        배율D: round(r.damageFactor, 2),
        DMG: round(r.effDamage, 1),
        기본: r.baseDamage,
        개C: r.indivCdLevel,
        분C: r.catCdLevel,
        배율C: round(r.cooldownFactor, 2),
        CD: round(r.effCooldown, 2),
        DPS: Math.round(r.dps),
        발수: r.effProjectileCount,
        발배: round(r.projectilePenalty, 2),
      };
    }
    const pick = i18n ? this._resolveDesc(card) : card.id;
    const gd = Math.round(snap.globalDamageBonus * 100);
    const gc = Math.round(snap.globalCooldownBonus * 100);
    console.log(`[강화] 픽: ${pick}   전역: DMG +${gd}% / CD +${gc}%`);
    console.table(table);
  }
}
