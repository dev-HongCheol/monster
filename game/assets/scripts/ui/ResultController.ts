import { _decorator, Button, Component, director, Label } from 'cc';
import { GameResult } from '../data/GameTypes';
import { I18n } from '../systems/I18n';

const { ccclass, property } = _decorator;

/** result.scene 의 결과 화면 UI */
@ccclass('ResultController')
export class ResultController extends Component {
  @property(Label) waveLabel: Label | null = null;
  @property(Button) retryButton: Button | null = null;
  @property(Button) menuButton: Button | null = null;

  onLoad() {
    if (this.waveLabel) {
      // 카탈로그 로드 전이면 onReady로 다시 채운다(키 노출 방지).
      const render = () => this._renderWave();
      render();
      I18n.instance?.onReady(render);
    }
    this.retryButton?.node.on(Button.EventType.CLICK, () => director.loadScene('main'), this);
    this.menuButton?.node.on(Button.EventType.CLICK, () => director.loadScene('menu'), this);
  }

  /** 승리/패배에 따라 도달 웨이브 라벨을 현지화해 채운다. */
  private _renderWave(): void {
    if (!this.waveLabel) return;
    const key = GameResult.gameVictory ? 'result.victory' : 'result.defeat';
    const params = { wave: GameResult.waveReached };
    this.waveLabel.string = I18n.instance ? I18n.instance.t(key, params) : key;
  }
}
