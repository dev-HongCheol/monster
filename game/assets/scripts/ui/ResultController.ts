import { _decorator, Button, Component, director, Label } from 'cc';
import { GameResult } from '../data/GameTypes';

const { ccclass, property } = _decorator;

/** result.scene 의 결과 화면 UI */
@ccclass('ResultController')
export class ResultController extends Component {
  @property(Label) waveLabel: Label | null = null;
  @property(Button) retryButton: Button | null = null;
  @property(Button) menuButton: Button | null = null;

  onLoad() {
    if (this.waveLabel) {
      this.waveLabel.string = GameResult.gameVictory
        ? `승리! ${GameResult.waveReached}웨이브 도달`
        : `${GameResult.waveReached}웨이브 도달`;
    }
    this.retryButton?.node.on(Button.EventType.CLICK, () => director.loadScene('main'), this);
    this.menuButton?.node.on(Button.EventType.CLICK, () => director.loadScene('menu'), this);
  }
}
