import { _decorator, Component } from 'cc';
import { DEV } from 'cc/env';
import { type ICardData, type ISpellData, UpgradeOption, UpgradeTrack } from '../data/GameTypes';
import { DeckLogic } from '../logic/DeckLogic';
import { type EnhancementDebugSnapshot, EnhancementLogic } from '../logic/EnhancementLogic';
import { DataManager } from './DataManager';

const { ccclass } = _decorator;

/**
 * [DEV QA 보조 · 임시] 마법 분류(category) 강화 카드를 드로우 풀에서 숨길지.
 * passive-effects 슬라이스 QA용 — 패시브 카드(2종)가 3장 드로우에 잘 뜨게 하려고 분류 카드(최대 6장)를
 * 임시로 제외한다. `cc/env` DEV와 함께 게이팅되므로 릴리스 빌드엔 영향 없음. 후속 편집 가능 단계에서
 * `false`로 복원한다. (순수 로직 EnhancementLogic은 불변 — 여기 cc 레이어에서만 표시 조정)
 */
const HIDE_CATEGORY_UPGRADE_CARDS = true;

/** 카드 풀 관리, 드로우, 강화 적용(플레이어 패시브 + per-spell/분류)을 담당하는 싱글톤 */
@ccclass('DeckManager')
export class DeckManager extends Component {
  static instance!: DeckManager;

  private _logic = new DeckLogic();
  private _enhancement = new EnhancementLogic();

  get maxHpBonus() {
    return this._logic.maxHpBonus;
  }

  /** 이동속도 보너스 누적값 (가산·상한 없음). 소비처: PlayerController._move */
  get moveSpeedBonus() {
    return this._logic.moveSpeedBonus;
  }

  /** 픽업범위 보너스 누적값 (가산·상한 없음). 소비처: ExperienceManager 픽업 반경 getter */
  get pickupRangeBonus() {
    return this._logic.pickupRangeBonus;
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
    let upgradeCards = this._enhancement.buildUpgradeCards(ownedSpells);
    // [DEV QA · 임시] 패시브 카드가 잘 뜨도록 분류 강화 카드를 드로우에서 제외(개별·마법추가·패시브는 유지).
    if (DEV && HIDE_CATEGORY_UPGRADE_CARDS) {
      upgradeCards = upgradeCards.filter((c) => c.effect.upgrade?.track !== UpgradeTrack.Category);
    }
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
