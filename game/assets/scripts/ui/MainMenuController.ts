import { _decorator, Button, Component, director } from 'cc';

const { ccclass, property } = _decorator;

/** menu.scene 의 메인 메뉴 UI */
@ccclass('MainMenuController')
export class MainMenuController extends Component {
  @property(Button) playButton: Button | null = null;

  onLoad() {
    if (!this.playButton) {
      console.error('[MainMenuController] playButton not assigned');
      return;
    }
    this.playButton.node.on(Button.EventType.CLICK, this._onPlay, this);
  }

  onDestroy() {
    this.playButton?.node?.off(Button.EventType.CLICK, this._onPlay, this);
  }

  /** 플레이 버튼 콜백 — main 씬으로 이동한다. */
  private _onPlay(): void {
    director.loadScene('main');
  }
}
