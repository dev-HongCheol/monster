import { _decorator, Component, JsonAsset, resources } from 'cc';
import { DEV } from 'cc/env';
import { type ICardData, type ISpellData, UpgradeOption, UpgradeTrack } from '../data/GameTypes';
import {
  type IDebugEnhancementSeed,
  parseDebugEnhancementSeed,
} from '../logic/DebugEnhancementSeed';
import { DeckLogic } from '../logic/DeckLogic';
import {
  type EnhancementDebugSnapshot,
  EnhancementLogic,
  GLOBAL_UPGRADE_CAP,
} from '../logic/EnhancementLogic';
import type { ResultSpellSnapshot } from '../logic/ResultStatsLogic';
import { DataManager } from './DataManager';

/** DEV 강화 시드 파일 경로 (resources 기준, 확장자 제외). 없으면 시드 미적용. */
const DEBUG_SEED_PATH = 'data/debug-enhancements';

const { ccclass } = _decorator;

/** 카드 풀 관리, 드로우, 강화 적용(플레이어 패시브 + per-spell/분류)을 담당하는 싱글톤 */
@ccclass('DeckManager')
export class DeckManager extends Component {
  /** 씬 리로드 시 onDestroy가 null로 되돌리므로 정직하게 nullable이다 (싱글톤 컨벤션 참고). */
  static instance: DeckManager | null = null;

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

  /** 최대HP 강화 레벨(획득 횟수) — 결과 화면 패시브 표시용. */
  get maxHpLevel() {
    return this._logic.maxHpLevel;
  }

  /** 이동속도 강화 레벨(획득 횟수) — 결과 화면 패시브 표시용. */
  get moveSpeedLevel() {
    return this._logic.moveSpeedLevel;
  }

  /** 픽업범위 강화 레벨(획득 횟수) — 결과 화면 패시브 표시용. */
  get pickupLevel() {
    return this._logic.pickupLevel;
  }

  /**
   * 결과 화면용 마법 강화 스냅샷을 만든다 — 보유 마법별 데미지·쿨다운의 전역/분류/개별 레벨 + 최종 배율.
   * 데이터가 없는 id(getSpell=null)는 정합 가드로 생략한다. (씬 전환 전 GameManager가 호출.)
   * @param ownedIds 보유 마법 id (로드아웃 순서)
   */
  resultSpellSnapshots(ownedIds: string[]): ResultSpellSnapshot[] {
    const dm = DataManager.instance;
    if (!dm) {
      console.error('[DeckManager] DataManager 없음 — 결과 화면 마법 통계를 만들 수 없습니다.');
      return [];
    }
    const e = this._enhancement;
    const snaps: ResultSpellSnapshot[] = [];
    for (const id of ownedIds) {
      const spell = dm.getSpell(id);
      if (spell === null) continue;
      snaps.push({
        id,
        category: spell.category,
        tier: spell.tier,
        dmg: {
          g: e.getGlobalLevel(UpgradeOption.Damage),
          c: e.getLevel(UpgradeTrack.Category, spell.category, UpgradeOption.Damage),
          i: e.getLevel(UpgradeTrack.Individual, id, UpgradeOption.Damage),
          factor: e.damageFactor(spell),
        },
        cd: {
          g: e.getGlobalLevel(UpgradeOption.Cooldown),
          c: e.getLevel(UpgradeTrack.Category, spell.category, UpgradeOption.Cooldown),
          i: e.getLevel(UpgradeTrack.Individual, id, UpgradeOption.Cooldown),
          factor: e.cooldownFactor(spell),
        },
      });
    }
    return snaps;
  }

  /** 마법의 데미지 배율 (개별×분류×전역 강화 — 기본 데미지에 곱한다). */
  damageFactor(spell: ISpellData): number {
    return this._enhancement.damageFactor(spell);
  }

  /** 강화 반영 후 실제 쿨다운(sec) — 기본 쿨다운에 개별×분류×전역 배율·하한 적용. */
  effectiveCooldown(spell: ISpellData): number {
    return this._enhancement.effectiveCooldown(spell, spell.cooldown);
  }

  /** 강화 반영 후 유효 발사체 수 — 기본 발사체 수 + 개별·분류 발사체 보너스(전역 없음 §7.6). */
  effectiveProjectileCount(spell: ISpellData): number {
    return this._enhancement.effectiveProjectileCount(spell);
  }

  /** 발사체당 데미지 페널티 배율 `×(1−r×증가수)` — 기본 데미지에 damageFactor와 함께 곱한다(§7.6). */
  projectilePenaltyFactor(spell: ISpellData): number {
    return this._enhancement.projectilePenaltyFactor(spell);
  }

  /** 마법의 범위 배율 (개별×분류×전역 강화) — 폭발/AOE 반경 등에 곱한다(§10.3 A3). */
  rangeFactor(spell: ISpellData): number {
    return this._enhancement.factor(spell, UpgradeOption.Range);
  }

  /** 마법의 지속시간 배율 (개별×분류×전역 강화) — CC·DOT 지속에 곱한다(§10.3 A3). */
  durationFactor(spell: ISpellData): number {
    return this._enhancement.factor(spell, UpgradeOption.Duration);
  }

  /** 디버그 로그용 강화 수치 스냅샷 (DEV 빌드의 카드 픽 로그에서 사용). */
  debugEnhancement(spells: ISpellData[]): EnhancementDebugSnapshot {
    return this._enhancement.debugSnapshot(spells);
  }

  onLoad() {
    DeckManager.instance = this;
  }

  // [DEV 전용] 강화 시드 파일이 있으면 카드 픽 없이 강화 레벨을 미리 적용한다(레벨별 밸런스 점검).
  start() {
    if (!DEV) return;
    // 파일이 없으면 err만 받고 조용히 넘어간다(시드 미사용 = 정상). 릴리스는 DEV 게이트로 아예 로드 안 함.
    // 비동기라 씬을 넘어 살아남을 수 있으므로(로딩 중 재시작) 파괴된 인스턴스에 쓰지 않도록 isValid를 본다.
    resources.load(DEBUG_SEED_PATH, JsonAsset, (err, asset) => {
      if (err || !asset || !this.isValid) return;
      this.applyDebugSeed(asset.json as IDebugEnhancementSeed);
      console.log('[DeckManager] DEV 강화 시드 적용:', asset.json);
    });
  }

  onDestroy() {
    if (DeckManager.instance === this) {
      DeckManager.instance = null;
    }
  }

  /**
   * [DEV 전용] 디버그 시드를 강화 트랙에 적용한다 — 카드 한 장씩 픽한 것과 동일하게 `raise`를 레벨만큼
   * 반복하고 전역 보너스를 누적한다. 파싱·검증은 순수 로직(parseDebugEnhancementSeed)에 위임한다.
   * @param raw 시드 파일 JSON (부분/누락 허용)
   */
  applyDebugSeed(raw: IDebugEnhancementSeed | null | undefined): void {
    const ops = parseDebugEnhancementSeed(raw);
    for (const op of ops.raises) {
      // raise는 cap(4)에서 자동으로 멈추므로 레벨만큼 반복해도 안전하다.
      for (let i = 0; i < op.level; i++) this._enhancement.raise(op.track, op.key, op.option);
    }
    for (const g of ops.globals) this._enhancement.addGlobal(g.option, g.bonus);
  }

  /**
   * base 카드 + 미보유 마법 합성 카드로 풀을 만들고 n장을 무작위로 뽑아 반환한다.
   * @param n 뽑을 장 수
   * @param ownedSpellIds 현재 로드아웃 보유 마법 id (마법 추가 카드 합성 제외용)
   * @param isFull 로드아웃이 가득 찼는지 (true면 마법 추가 카드 미합성)
   */
  drawCards(n: number, ownedSpellIds: string[], isFull: boolean): ICardData[] {
    const dm = DataManager.instance;
    if (!dm) {
      console.error('[DeckManager] DataManager 없음 — 카드를 뽑을 수 없습니다.');
      return [];
    }
    const pool = this._logic.buildDrawPool(dm.cards, dm.spells, ownedSpellIds, isFull);
    // 보유 마법·분류의 개별/분류 강화 카드를 합성해 풀에 더한다(레벨4·보조·발사체 적격은 EnhancementLogic이 처리).
    // .map 클로저 안에서는 내로잉이 살아남지 않으므로 위에서 받아 둔 dm을 쓴다.
    const ownedSpells = ownedSpellIds
      .map((id) => dm.getSpell(id))
      .filter((s): s is ISpellData => s !== null);
    const upgradeCards = this._enhancement.buildUpgradeCards(ownedSpells);
    // 전역 강화가 상한(GLOBAL_UPGRADE_CAP·B2)에 도달한 옵션의 베이스 카드는 풀에서 뺀다
    // (상한 도달 후 아무 효과 없는 카드가 뜨지 않도록 — 개별/분류 maxed 제외와 대칭).
    const available = [...pool, ...upgradeCards].filter((card) => !this._isMaxedGlobalCard(card));
    return this._logic.drawCards(available, n);
  }

  /**
   * 전역 강화(데미지/쿨다운) 카드가 해당 옵션 상한에 도달했는지 — drawCards 풀 제외용.
   * 현 전역 카드는 damageMult·cooldownMult 중 하나만 갖는다(damage_boost·cooldown_reduce 분리).
   * 둘 다 가진 카드가 생기면 한 옵션만 maxed여도 제외되므로, 그때 옵션별 판정으로 분리할 것.
   */
  private _isMaxedGlobalCard(card: ICardData): boolean {
    const e = card.effect;
    if (
      e.damageMult !== undefined &&
      this._enhancement.getGlobalLevel(UpgradeOption.Damage) >= GLOBAL_UPGRADE_CAP
    ) {
      return true;
    }
    return (
      e.cooldownMult !== undefined &&
      this._enhancement.getGlobalLevel(UpgradeOption.Cooldown) >= GLOBAL_UPGRADE_CAP
    );
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
