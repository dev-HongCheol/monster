import { _decorator, Button, Component, Label, Node } from 'cc';
import { GameState } from '../data/GameTypes';
import { GameManager } from '../systems/GameManager';

const { ccclass, property } = _decorator;

/** HP 텍스트, 게임오버 패널, 재시작 버튼을 관리하는 UI 컴포넌트 */
@ccclass('HudController')
export class HudController extends Component {
  /** HP 수치를 표시하는 라벨 (인스펙터에서 연결) */
  @property(Label) hpLabel: Label | null = null;
  /** 게임오버 시 표시할 패널 노드 (인스펙터에서 연결) */
  @property(Node) gameOverPanel: Node | null = null;
  /** 재시작 버튼 (인스펙터에서 연결) */
  @property(Button) restartButton: Button | null = null;

  onLoad() {
    if (!this.hpLabel || !this.gameOverPanel || !this.restartButton) {
      console.error('[HudController] required properties not assigned');
      this.enabled = false;
      return;
    }
    this.gameOverPanel.active = false;
    this.restartButton.node.on(Button.EventType.CLICK, this._onRestart, this);
  }

  update() {
    this._updateHp();
    this._checkGameOver();
  }

  /** HP 라벨을 현재 플레이어 HP로 갱신한다. */
  private _updateHp(): void {
    if (!this.hpLabel) return;
    const gm = GameManager.instance;
    this.hpLabel.string = `HP: ${Math.ceil(gm.playerHp)} / ${gm.maxPlayerHp}`;
  }

  /** 게임오버 상태이면 패널을 활성화한다. */
  private _checkGameOver(): void {
    if (!this.gameOverPanel) return;
    const isGameOver = GameManager.instance.state === GameState.GameOver;
    // 상태가 바뀔 때만 active를 토글해 불필요한 DOM 업데이트 방지
    if (isGameOver && !this.gameOverPanel.active) {
      this.gameOverPanel.active = true;
    }
  }

  /** 재시작 버튼 클릭 시 게임을 재시작한다. */
  private _onRestart(): void {
    GameManager.instance.restart();
  }
}
