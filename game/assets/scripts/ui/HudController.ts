import { _decorator, Button, Component, Label, Node, ProgressBar } from 'cc';
import { GameState } from '../data/GameTypes';
import { barRatio, formatNumber, formatTimer } from '../logic/HudFormatLogic';
import { ExperienceManager } from '../systems/ExperienceManager';
import { GameManager } from '../systems/GameManager';
import { I18n } from '../systems/I18n';
import { WaveManager } from '../systems/WaveManager';
import { COLORS } from './Theme';

const { ccclass, property } = _decorator;

/** HP·XP 바, 웨이브 타이머, 게임오버/웨이브클리어 패널을 관리하는 UI 컴포넌트 */
@ccclass('HudController')
export class HudController extends Component {
  @property(Label) hpLabel: Label | null = null;
  @property(Label) waveLabel: Label | null = null;
  @property(Label) timerLabel: Label | null = null;
  @property(Label) levelLabel: Label | null = null;
  @property(Label) xpLabel: Label | null = null;
  @property(ProgressBar) hpBar: ProgressBar | null = null;
  @property(ProgressBar) xpBar: ProgressBar | null = null;
  @property(Node) gameOverPanel: Node | null = null;
  @property(Button) restartButton: Button | null = null;
  @property(Button) menuButton: Button | null = null;
  @property(Node) cardSelectPanel: Node | null = null;

  private _prevState: GameState = GameState.Playing;

  // 필수 프로퍼티 검증 → 패널 숨김 초기화 → 버튼 콜백 배선 → 바 색을 테마에서 적용
  onLoad() {
    if (!this.hpLabel || !this.gameOverPanel || !this.restartButton) {
      console.error('[HudController] required properties not assigned');
      this.enabled = false;
      return;
    }
    this.gameOverPanel.active = false;
    if (this.cardSelectPanel) this.cardSelectPanel.active = false;
    this.restartButton.node.on(Button.EventType.CLICK, this._onRestart, this);
    this.menuButton?.node.on(Button.EventType.CLICK, this._onMenu, this);

    // 바 채움 색을 테마 단일 출처에서 적용 — 에디터의 흰 스프라이트를 코드가 틴트한다.
    if (this.hpBar?.barSprite) this.hpBar.barSprite.color = COLORS.HP_FILL;
    if (this.xpBar?.barSprite) this.xpBar.barSprite.color = COLORS.XP_FILL;
  }

  // 매 프레임 HP·웨이브·XP 레이블을 갱신하고 게임 상태 변화에 따라 패널을 전환한다
  update() {
    this._updateHp();
    this._updateWaveInfo();
    this._updateXpInfo();
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
      max: formatNumber(gm.maxPlayerHp),
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

  /** 레벨·XP 진행도 레이블과 XP 바를 갱신한다. */
  private _updateXpInfo(): void {
    if (!ExperienceManager.instance) return;
    const em = ExperienceManager.instance;
    if (this.levelLabel) {
      this.levelLabel.string = this._t('hud.level', { level: em.level });
    }
    if (this.xpLabel) {
      const req = em.requiredXp === Infinity ? '∞' : String(em.requiredXp);
      this.xpLabel.string = this._t('hud.xp', { cur: em.currentXp, req });
    }
    // requiredXp가 Infinity(상한 도달)면 barRatio가 0을 반환해 바가 비워진다.
    if (this.xpBar) this.xpBar.progress = barRatio(em.currentXp, em.requiredXp);
  }

  /** 게임 상태 변경을 감지해 UI 패널을 전환한다. */
  private _handleStateChange(): void {
    const state = GameManager.instance.state;
    if (state === this._prevState) return;
    this._prevState = state;

    if (state === GameState.GameOver) {
      if (this.gameOverPanel) this.gameOverPanel.active = true;
    } else if (state === GameState.LevelUp) {
      if (this.cardSelectPanel) this.cardSelectPanel.active = true;
    } else if (state === GameState.Playing) {
      if (this.gameOverPanel) this.gameOverPanel.active = false;
      if (this.cardSelectPanel) this.cardSelectPanel.active = false;
    }
  }

  /** 재시작 버튼 콜백. */
  private _onRestart(): void {
    GameManager.instance.restart();
  }

  /** 메뉴 버튼 콜백. */
  private _onMenu(): void {
    GameManager.instance.goToMenu();
  }
}
