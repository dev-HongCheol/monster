import { _decorator, Button, Component, type EventKeyboard, Input, input, KeyCode, Node } from 'cc';
import { GameState } from '../data/GameTypes';
import { pauseToggleAction } from '../logic/PauseMenuLogic';
import { GameManager } from '../systems/GameManager';

const { ccclass, property } = _decorator;

/**
 * ESC로 여는 수동 일시정지 메뉴 컨트롤러.
 *
 * **항상 active인 노드**(PauseRoot)에 붙어 ESC 입력을 받는다 — 실제로 껐다 켜는 모달 콘텐츠
 * (`pausePanel`)는 자식으로 두고 상태에 따라 토글한다. 비활성 노드는 `onLoad`가 안 돌아 ESC를
 * 못 받으므로 컨트롤러와 콘텐츠를 분리한다.
 *
 * 게임 정지는 `GameManager.enterPause`/`resumePause`가 상태를 `Paused`로 바꾸면 기존
 * `state !== Playing` 가드로 전장(적·발사체·타이머·XP)이 통째로 얼어붙어 처리된다 —
 * 별도 프리즈 배관이 없다(레벨업 일시정지와 동일 방식).
 */
@ccclass('PauseController')
export class PauseController extends Component {
  /** 껐다 켜는 모달 콘텐츠 루트 (딤 배경 + 타이틀 + 버튼 3개). 초기 숨김. */
  @property(Node) pausePanel: Node | null = null;
  @property(Button) resumeButton: Button | null = null;
  @property(Button) restartButton: Button | null = null;
  @property(Button) menuButton: Button | null = null;

  /** 직전 프레임 상태 — 상태가 바뀔 때만 오버레이를 토글한다(HudController 패턴). */
  private _prevState: GameState = GameState.Playing;

  // ESC 리스너와 버튼 CLICK 핸들러를 등록하고, 오버레이를 숨긴 채 시작한다.
  onLoad() {
    if (this.pausePanel) this.pausePanel.active = false;
    input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    this.resumeButton?.node.on(Button.EventType.CLICK, this._onResume, this);
    this.restartButton?.node.on(Button.EventType.CLICK, this._onRestart, this);
    this.menuButton?.node.on(Button.EventType.CLICK, this._onMenu, this);
  }

  // 씬 재로드 시 전역 입력 리스너·버튼 핸들러가 새지 않도록 해제한다.
  onDestroy() {
    input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    this.resumeButton?.node.off(Button.EventType.CLICK, this._onResume, this);
    this.restartButton?.node.off(Button.EventType.CLICK, this._onRestart, this);
    this.menuButton?.node.off(Button.EventType.CLICK, this._onMenu, this);
  }

  // 상태가 Paused로 바뀌면 오버레이를 켜고, 벗어나면 끈다.
  update() {
    const state = GameManager.instance.state;
    if (state === this._prevState) return;
    this._prevState = state;
    if (this.pausePanel) this.pausePanel.active = state === GameState.Paused;
  }

  /** ESC: 현재 상태에 따라 일시정지/재개하고, 그 외(카드 선택·게임오버·승리)는 무시한다. */
  private _onKeyDown(e: EventKeyboard): void {
    if (e.keyCode !== KeyCode.ESCAPE) return;
    const action = pauseToggleAction(GameManager.instance.state);
    if (action === 'pause') GameManager.instance.enterPause();
    else if (action === 'resume') GameManager.instance.resumePause();
  }

  private _onResume(): void {
    GameManager.instance.resumePause();
  }

  private _onRestart(): void {
    GameManager.instance.restart();
  }

  private _onMenu(): void {
    GameManager.instance.goToMenu();
  }
}
