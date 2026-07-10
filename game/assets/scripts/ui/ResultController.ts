import {
  _decorator,
  Button,
  Component,
  director,
  instantiate,
  Label,
  Node,
  Prefab,
  RichText,
} from 'cc';
import { GameResult, UpgradeOption } from '../data/GameTypes';
import type { I18nParams } from '../logic/I18nLogic';
import {
  buildResultStats,
  type ResultStatsView,
  type ResultUpgradeView,
} from '../logic/ResultStatsLogic';
import { I18n } from '../systems/I18n';

const { ccclass, property } = _decorator;

/** 강화 3티어 색 (전역/분류/개별) — RichText color 태그용. 목업·QA 문서와 동일 hex. */
const TIER_COLOR = { global: '#94a3b8', category: '#c084fc', individual: '#34d399' } as const;

/** result.scene 의 결과 화면 UI — 헤더(승/패·웨이브)와 런 통계(생존·레벨·킬·마법 강화·패시브)를 렌더한다. */
@ccclass('ResultController')
export class ResultController extends Component {
  @property(Label) waveLabel: Label | null = null;
  @property(Button) retryButton: Button | null = null;
  @property(Button) menuButton: Button | null = null;

  // ── 런 통계 라벨/컨테이너 ──
  @property(Label) survivalLabel: Label | null = null;
  @property(Label) levelLabel: Label | null = null;
  @property(Label) killTotalLabel: Label | null = null;
  /** 킬 종류별 조인 라벨 (여러 줄) */
  @property(Label) killListLabel: Label | null = null;
  /** 마법 행 부모(Layout VERTICAL). 보유 마법마다 spellRowPrefab을 복제해 채운다. */
  @property(Node) spellListContent: Node | null = null;
  /** 마법 한 행 프리팹 — 이름 Label + 강화 브레이크다운 RichText. */
  @property(Prefab) spellRowPrefab: Prefab | null = null;
  /** 패시브 3줄 조인 라벨 (최대HP·이동속도·픽업) */
  @property(Label) passiveLabel: Label | null = null;

  // 헤더 + 런 통계를 렌더(카탈로그 늦으면 onReady로 재렌더)하고 재시도/메뉴 버튼을 배선한다
  onLoad() {
    if (!this._checkWiring()) return;
    const render = () => this._render();
    render();
    I18n.instance?.onReady(render);
    this.retryButton?.node.on(Button.EventType.CLICK, () => director.loadScene('main'), this);
    this.menuButton?.node.on(Button.EventType.CLICK, () => director.loadScene('menu'), this);
  }

  /**
   * 필수 `@property` 배선을 검사한다 — 누락 시 loud-fail(console.error + 컴포넌트 비활성)로
   * 조용한 배선 실수를 드러낸다(HudController house 패턴, 백로그 F29 결). 7단계 배선 안전망.
   */
  private _checkWiring(): boolean {
    const missing: string[] = [];
    if (!this.waveLabel) missing.push('waveLabel');
    if (!this.survivalLabel) missing.push('survivalLabel');
    if (!this.levelLabel) missing.push('levelLabel');
    if (!this.killTotalLabel) missing.push('killTotalLabel');
    if (!this.killListLabel) missing.push('killListLabel');
    if (!this.spellListContent) missing.push('spellListContent');
    if (!this.spellRowPrefab) missing.push('spellRowPrefab');
    if (!this.passiveLabel) missing.push('passiveLabel');
    if (!this.retryButton) missing.push('retryButton');
    if (!this.menuButton) missing.push('menuButton');
    if (missing.length > 0) {
      console.error(`[ResultController] 필수 @property 미연결: ${missing.join(', ')}`);
      this.enabled = false;
      return false;
    }
    return true;
  }

  /** I18n 미준비 시 키를 그대로 반환(카탈로그 로드 후 onReady 재렌더로 교체). */
  private _t(key: string, params?: I18nParams): string {
    return I18n.instance ? I18n.instance.t(key, params) : key;
  }

  private _render(): void {
    this._renderWave();
    this._renderStats();
  }

  /** 승리/패배에 따라 도달 웨이브 라벨을 현지화해 채운다. */
  private _renderWave(): void {
    if (!this.waveLabel) return;
    const key = GameResult.gameVictory ? 'result.victory' : 'result.defeat';
    this.waveLabel.string = this._t(key, { wave: GameResult.waveReached });
  }

  /** GameResult 스냅샷 → buildResultStats(순수) → 통계 라벨/마법 행/패시브 렌더. */
  private _renderStats(): void {
    const view = buildResultStats({
      survivalSec: GameResult.survivalSec,
      level: GameResult.level,
      kills: GameResult.kills,
      spells: GameResult.spells,
      passives: {
        maxHp: { level: GameResult.passiveHpLevel, bonus: GameResult.passiveHpBonus },
        moveSpeed: { level: GameResult.passiveMoveLevel, bonus: GameResult.passiveMoveBonus },
        pickup: { level: GameResult.passivePickupLevel, bonus: GameResult.passivePickupBonus },
      },
    });

    if (this.survivalLabel) {
      this.survivalLabel.string = `${this._t('result.stat.survival')}  ${view.survivalTime}`;
    }
    if (this.levelLabel)
      this.levelLabel.string = `${this._t('result.stat.level')}  Lv.${view.level}`;
    if (this.killTotalLabel) {
      this.killTotalLabel.string = `${this._t('result.stat.kills')}  ${view.killTotal}`;
    }
    if (this.killListLabel) {
      this.killListLabel.string = view.killsByType.map((k) => `${k.name}  ${k.count}`).join('\n');
    }
    this._renderSpells(view);
    this._renderPassives(view);
  }

  /** 보유 마법마다 프리팹 행을 복제해 이름 Label + 강화 브레이크다운 RichText를 채운다. */
  private _renderSpells(view: ResultStatsView): void {
    const parent = this.spellListContent;
    if (!parent) return;
    parent.removeAllChildren();
    if (!this.spellRowPrefab) return;
    for (const spell of view.spells) {
      const row = instantiate(this.spellRowPrefab);
      // 명명 자식으로 결정적 해석(위치 탐색은 RichText 생성 자식 Label과 충돌 위험 — 리뷰 I2).
      const nameLabel = row.getChildByName('Name')?.getComponent(Label);
      if (nameLabel) nameLabel.string = `${spell.tierLabel} ${this._t(spell.nameKey)}`;
      const rich = row.getChildByName('Breakdown')?.getComponent(RichText);
      if (rich) rich.string = spell.upgrades.map((u) => this._upgradeLine(u)).join('\n');
      parent.addChild(row);
    }
  }

  /** 강화 한 줄: `데미지 Lv.6 (+201%) = <색>전역</> + <색>분류</> + <색>개별</>` (RichText color 태그). */
  private _upgradeLine(u: ResultUpgradeView): string {
    const optionKey = u.option === UpgradeOption.Damage ? 'upgrade.damage' : 'upgrade.cooldown';
    const sign = u.effectPct >= 0 ? '+' : '';
    const g = `<color=${TIER_COLOR.global}>${u.global}</color>`;
    const c = `<color=${TIER_COLOR.category}>${u.category}</color>`;
    const i = `<color=${TIER_COLOR.individual}>${u.individual}</color>`;
    return `${this._t(optionKey)} Lv.${u.total} (${sign}${u.effectPct}%) = ${g} + ${c} + ${i}`;
  }

  /** 패시브 3줄 — 최대HP는 flat 보너스, 이동속도·픽업은 비율(%)로 표시. */
  private _renderPassives(view: ResultStatsView): void {
    if (!this.passiveLabel) return;
    const p = view.passives;
    const pct = (v: number) => `+${Math.round(v * 100)}%`;
    this.passiveLabel.string = [
      `${this._t('result.stat.passive.hp')}  Lv.${p.maxHp.level}  (+${p.maxHp.bonus})`,
      `${this._t('result.stat.passive.move')}  Lv.${p.moveSpeed.level}  (${pct(p.moveSpeed.bonus)})`,
      `${this._t('result.stat.passive.pickup')}  Lv.${p.pickup.level}  (${pct(p.pickup.bonus)})`,
    ].join('\n');
  }
}
