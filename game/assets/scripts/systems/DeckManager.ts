import { _decorator, Component } from 'cc';
import { type ICardData, type ISpellData, UpgradeOption } from '../data/GameTypes';
import { DeckLogic } from '../logic/DeckLogic';
import { type EnhancementDebugSnapshot, EnhancementLogic } from '../logic/EnhancementLogic';
import { DataManager } from './DataManager';

const { ccclass } = _decorator;

/** 카드 풀 관리, 드로우, 강화 적용(플레이어 패시브 + per-spell/분류)을 담당하는 싱글톤 */
@ccclass('DeckManager')
export class DeckManager extends Component {
  static instance!: DeckManager;

  private _logic = new DeckLogic();
  private _enhancement = new EnhancementLogic();

  get maxHpBonus() {
    return this._logic.maxHpBonus;
  }

  /** 마법의 데미지 배율 (개별×분류×전역 강화 — 기본 데미지에 곱한다). */
  damageFactor(spell: ISpellData): number {
    return this._enhancement.damageFactor(spell);
  }

  /** 강화 반영 후 실제 쿨다운(sec) — 기본 쿨다운에 개별×분류×전역 배율·하한 적용. */
  effectiveCooldown(spell: ISpellData): number {
    return this._enhancement.effectiveCooldown(spell, spell.cooldown);
  }

  /** 디버그 로그용 강화 수치 스냅샷 (DEV 빌드의 카드 픽 로그에서 사용). */
  debugEnhancement(spells: ISpellData[]): EnhancementDebugSnapshot {
    return this._enhancement.debugSnapshot(spells);
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
    // 보유 마법·분류의 개별/분류 강화 카드를 합성해 풀에 더한다(레벨4·보조 제외는 EnhancementLogic이 처리).
    const ownedSpells = ownedSpellIds
      .map((id) => DataManager.instance.getSpell(id))
      .filter((s): s is ISpellData => s !== null);
    const upgradeCards = this._enhancement.buildUpgradeCards(ownedSpells);
    return this._logic.drawCards([...pool, ...upgradeCards], n);
  }

  /**
   * 카드 효과를 영구 적용한다. 각 effect는 독립이므로 early-return 없이 모두 반영한다 —
   * 강화 카드(개별/분류)는 raise, 전역 데미지/쿨다운은 addGlobal, 나머지(HP)는 DeckLogic.
   */
  applyCard(card: ICardData): void {
    const e = card.effect;
    if (e.upgrade) {
      this._enhancement.raise(e.upgrade.track, e.upgrade.target, e.upgrade.option);
    }
    // 전역(플레이어) 데미지/쿨다운 강화 — 모든 마법 공통 보너스
    if (e.damageMult !== undefined) this._enhancement.addGlobal(UpgradeOption.Damage, e.damageMult);
    if (e.cooldownMult !== undefined) {
      this._enhancement.addGlobal(UpgradeOption.Cooldown, e.cooldownMult);
    }
    this._logic.applyCard(card);
  }
}
