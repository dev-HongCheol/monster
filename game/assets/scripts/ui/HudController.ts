import {
  _decorator,
  Color,
  Component,
  instantiate,
  Label,
  Node,
  Prefab,
  ProgressBar,
  Sprite,
  UITransform,
} from 'cc';
import { SpellCaster } from '../components/SpellCaster';
import { GameState } from '../data/GameTypes';
import { barRatio, formatNumber, formatTimer } from '../logic/HudFormatLogic';
import { MAX_SLOTS } from '../logic/LoadoutLogic';
import { buildSpellIconRow, type SpellIconSlot } from '../logic/SpellIconRowLogic';
import { DataManager } from '../systems/DataManager';
import { ExperienceManager } from '../systems/ExperienceManager';
import { GameManager } from '../systems/GameManager';
import { I18n } from '../systems/I18n';
import { WaveManager } from '../systems/WaveManager';
import { COLORS } from './Theme';

const { ccclass, executionOrder, property } = _decorator;

/**
 * HP·XP 바, 웨이브 타이머, 레벨업 카드 선택 패널을 관리하는 UI 컴포넌트.
 * HUD가 게임 로직 뒤에 돌아 매 프레임 최신 상태(HP 포함)를 읽도록 executionOrder를 뒤로 미룬다
 * (GameManager는 기본 0 — 작을수록 먼저 실행). 게임오버는 별도 result 씬으로 처리한다.
 */
@ccclass('HudController')
@executionOrder(100)
export class HudController extends Component {
  @property(Label) hpLabel: Label | null = null;
  @property(Label) waveLabel: Label | null = null;
  @property(Label) timerLabel: Label | null = null;
  @property(Label) levelLabel: Label | null = null;
  @property(ProgressBar) hpBar: ProgressBar | null = null;
  @property(ProgressBar) xpBar: ProgressBar | null = null;
  @property(Node) cardSelectPanel: Node | null = null;
  /** 마법 슬롯 한 칸 프리팹 (분류색 Sprite + 티어 Label). MAX_SLOTS개 복제한다. */
  @property(Prefab) spellSlotPrefab: Prefab | null = null;
  /** 슬롯들이 붙는 부모 노드 (가로 Layout 권장). */
  @property(Node) spellSlotContainer: Node | null = null;

  private _prevState: GameState = GameState.Playing;
  /** 인스턴스화한 슬롯 노드들 (길이 MAX_SLOTS). */
  private _spellSlots: Node[] = [];
  /** 마지막으로 그린 보유 마법 서명(id join) — 바뀔 때만 슬롯을 재빌드한다. */
  private _spellRowKey: string | null = null;

  // 필수 프로퍼티 검증 → 카드 패널 숨김 초기화 → 바 색을 테마에서 적용
  onLoad() {
    if (!this.hpLabel || !this.hpBar) {
      console.error('[HudController] required properties not assigned');
      this.enabled = false;
      return;
    }
    if (this.cardSelectPanel) this.cardSelectPanel.active = false;

    // 바 채움 색을 테마 단일 출처에서 적용 — 에디터의 흰 스프라이트를 코드가 틴트한다.
    if (this.hpBar?.barSprite) this.hpBar.barSprite.color = COLORS.HP_FILL;
    if (this.xpBar?.barSprite) this.xpBar.barSprite.color = COLORS.XP_FILL;

    this._initSpellSlots();
  }

  // 매 프레임 HP·웨이브·XP 레이블을 갱신하고, 보유 마법 변경 시 아이콘 행을 재빌드한다
  update() {
    this._updateHp();
    this._updateWaveInfo();
    this._updateXpInfo();
    this._updateSpellRow();
    this._handleStateChange();
  }

  /** 카탈로그 키를 현재 언어로 해석한다 (로드 전엔 키 폴백). */
  private _t(key: string, params?: Record<string, string | number>): string {
    return I18n.instance ? I18n.instance.t(key, params) : key;
  }

  /** HP 레이블과 HP 바를 현재 값으로 갱신한다. */
  private _updateHp(): void {
    if (!this.hpLabel) return;
    const gm = GameManager.instance;
    this.hpLabel.string = this._t('hud.hp', {
      cur: formatNumber(Math.ceil(gm.playerHp)),
    });
    if (this.hpBar) this.hpBar.progress = barRatio(gm.playerHp, gm.maxPlayerHp);
  }

  /** 웨이브 번호와 전체 게임 잔여 시간을 갱신한다. */
  private _updateWaveInfo(): void {
    const wm = WaveManager.instance;
    if (this.waveLabel) {
      this.waveLabel.string = this._t('hud.wave', { wave: wm.waveNumber });
    }
    if (this.timerLabel) {
      this.timerLabel.string = this._t('hud.timer', {
        time: formatTimer(GameManager.instance.gameTimer),
      });
    }
  }

  /** 레벨 레이블과 XP 바(진행도)를 갱신한다. XP 진행은 수치 라벨 없이 바로만 표시한다. */
  private _updateXpInfo(): void {
    if (!ExperienceManager.instance) return;
    const em = ExperienceManager.instance;
    if (this.levelLabel) {
      this.levelLabel.string = this._t('hud.level', { level: em.level });
    }
    // XP 바는 하단 풀폭이라 Widget으로 폭이 늘어난다. ProgressBar.totalLength는
    // 고정 px 값이라 스트레치를 안 따라가므로, 매 프레임 실제 UITransform 폭으로
    // 맞춘 뒤 진행도를 세팅한다. (requiredXp가 Infinity면 barRatio가 0을 반환해
    // 바가 비워진다.)
    if (this.xpBar) {
      const width = this.xpBar.node.getComponent(UITransform)?.contentSize.width;
      if (width) this.xpBar.totalLength = width;
      this.xpBar.progress = barRatio(em.currentXp, em.requiredXp);
    }
  }

  /** 게임 상태 변경을 감지해 레벨업 카드 선택 패널을 전환한다. (게임오버는 별도 result 씬으로 처리) */
  private _handleStateChange(): void {
    const state = GameManager.instance.state;
    if (state === this._prevState) return;
    this._prevState = state;

    if (state === GameState.LevelUp) {
      if (this.cardSelectPanel) this.cardSelectPanel.active = true;
    } else if (state === GameState.Playing) {
      if (this.cardSelectPanel) this.cardSelectPanel.active = false;
    }
  }

  /** 슬롯 프리팹을 MAX_SLOTS개 인스턴스화해 컨테이너에 붙인다(로드 1회). MAX_SLOTS만 바꾸면 칸 수가 따라 변한다. */
  private _initSpellSlots(): void {
    if (!this.spellSlotPrefab || !this.spellSlotContainer) return;
    for (let i = 0; i < MAX_SLOTS; i++) {
      const node = instantiate(this.spellSlotPrefab);
      this.spellSlotContainer.addChild(node);
      this._spellSlots.push(node);
    }
  }

  /**
   * 보유 마법이 바뀌었을 때만(id 서명 비교) 아이콘 행을 재빌드한다. 보유·티어는 카드 픽에서만
   * 변하므로 매 프레임 서명만 비교하고, 달라졌을 때 순수 로직으로 슬롯 배열을 만들어 노드에 적용한다.
   */
  private _updateSpellRow(): void {
    if (this._spellSlots.length === 0) return;
    const caster = SpellCaster.instance;
    const dm = DataManager.instance;
    if (!caster || !dm?.isReady) return;
    const ownedIds = caster.loadout.spells;
    const key = ownedIds.join(',');
    if (key === this._spellRowKey) return; // 보유 마법 미변경 → 재빌드 생략
    this._spellRowKey = key;
    const row = buildSpellIconRow(ownedIds, (id) => dm.getSpell(id), MAX_SLOTS);
    for (let i = 0; i < this._spellSlots.length; i++) {
      this._applySlot(this._spellSlots[i], row[i]);
    }
  }

  /** 슬롯 노드 하나에 슬롯 데이터를 적용한다 — 채운 칸은 분류색 + 티어 라벨, 빈 칸은 placeholder 톤 + 빈 라벨. */
  private _applySlot(node: Node, slot: SpellIconSlot | null): void {
    const sprite = node.getComponent(Sprite);
    const label = node.getComponentInChildren(Label);
    if (slot) {
      if (sprite)
        sprite.color = new Color(slot.colorRgb[0], slot.colorRgb[1], slot.colorRgb[2], 255);
      if (label) label.string = slot.label;
    } else {
      if (sprite) sprite.color = COLORS.PLACEHOLDER_BORDER;
      if (label) label.string = '';
    }
  }
}
