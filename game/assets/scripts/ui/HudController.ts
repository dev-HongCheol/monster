import { _decorator, Button, Component, Label, Node } from 'cc';
import { GameState } from '../data/GameTypes';
import { ExperienceManager } from '../systems/ExperienceManager';
import { GameManager } from '../systems/GameManager';
import { WaveManager } from '../systems/WaveManager';

const { ccclass, property } = _decorator;

/** HP, 웨이브 타이머, 게임오버/웨이브클리어 패널을 관리하는 UI 컴포넌트 */
@ccclass('HudController')
export class HudController extends Component {
  @property(Label) hpLabel: Label | null = null;
  @property(Label) waveLabel: Label | null = null;
  @property(Label) timerLabel: Label | null = null;
  @property(Label) levelLabel: Label | null = null;
  @property(Label) xpLabel: Label | null = null;
  @property(Node) gameOverPanel: Node | null = null;
  @property(Button) restartButton: Button | null = null;
  @property(Button) menuButton: Button | null = null;
  @property(Node) cardSelectPanel: Node | null = null;

  private _prevState: GameState = GameState.Playing;

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
  }

  update() {
    this._updateHp();
    this._updateWaveInfo();
    this._updateXpInfo();
    this._handleStateChange();
  }

  /** HP 레이블을 현재 값으로 갱신한다. */
  private _updateHp(): void {
    if (!this.hpLabel) return;
    const gm = GameManager.instance;
    this.hpLabel.string = `HP: ${Math.ceil(gm.playerHp)} / ${gm.maxPlayerHp}`;
  }

  /** 웨이브 번호와 전체 게임 잔여 시간을 갱신한다. */
  private _updateWaveInfo(): void {
    const wm = WaveManager.instance;
    if (this.waveLabel) {
      this.waveLabel.string = `Wave ${wm.waveNumber}`;
    }
    if (this.timerLabel) {
      const t = Math.max(0, GameManager.instance.gameTimer);
      const min = Math.floor(t / 60);
      const sec = String(Math.floor(t % 60)).padStart(2, '0');
      this.timerLabel.string = `${min}:${sec}`;
    }
  }

  /** 레벨과 XP 진행도 레이블을 갱신한다. */
  private _updateXpInfo(): void {
    if (!ExperienceManager.instance) return;
    const em = ExperienceManager.instance;
    if (this.levelLabel) {
      this.levelLabel.string = `Lv.${em.level}`;
    }
    if (this.xpLabel) {
      const req = em.requiredXp === Infinity ? '∞' : String(em.requiredXp);
      this.xpLabel.string = `XP: ${em.currentXp} / ${req}`;
    }
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
