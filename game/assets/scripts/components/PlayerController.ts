import { _decorator, Component, type EventKeyboard, Input, input, KeyCode, Vec3 } from 'cc';
import { GameState } from '../data/GameTypes';
import { DataManager } from '../systems/DataManager';
import { DeckManager } from '../systems/DeckManager';
import { GameManager } from '../systems/GameManager';

const { ccclass } = _decorator;

/** 플레이어 이동, HP 연동을 담당하는 컴포넌트. 자동 발사는 SpellCaster가 담당한다. */
@ccclass('PlayerController')
export class PlayerController extends Component {
  private _moveDir: Vec3 = new Vec3();
  private _dataReady = false;

  private _keyUp: boolean = false;
  private _keyDown: boolean = false;
  private _keyLeft: boolean = false;
  private _keyRight: boolean = false;

  onLoad() {
    input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
  }

  start() {
    DataManager.instance.onReady(() => {
      this._dataReady = true;
    });
  }

  onDestroy() {
    input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
  }

  // 데이터 준비 + Playing 상태일 때만 키 입력으로 이동 방향을 계산해 이동시킨다
  update(dt: number) {
    if (!this._dataReady) return;
    if (GameManager.instance.state !== GameState.Playing) return;

    this._updateMoveDir();
    this._move(dt);
  }

  /** 키 입력으로 이동 방향 플래그를 활성화한다. */
  private _onKeyDown(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.KEY_W || e.keyCode === KeyCode.ARROW_UP) this._keyUp = true;
    if (e.keyCode === KeyCode.KEY_S || e.keyCode === KeyCode.ARROW_DOWN) this._keyDown = true;
    if (e.keyCode === KeyCode.KEY_A || e.keyCode === KeyCode.ARROW_LEFT) this._keyLeft = true;
    if (e.keyCode === KeyCode.KEY_D || e.keyCode === KeyCode.ARROW_RIGHT) this._keyRight = true;
  }

  /** 키 해제로 이동 방향 플래그를 비활성화한다. */
  private _onKeyUp(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.KEY_W || e.keyCode === KeyCode.ARROW_UP) this._keyUp = false;
    if (e.keyCode === KeyCode.KEY_S || e.keyCode === KeyCode.ARROW_DOWN) this._keyDown = false;
    if (e.keyCode === KeyCode.KEY_A || e.keyCode === KeyCode.ARROW_LEFT) this._keyLeft = false;
    if (e.keyCode === KeyCode.KEY_D || e.keyCode === KeyCode.ARROW_RIGHT) this._keyRight = false;
  }

  /** 키 플래그 상태로 이동 방향 벡터를 계산한다. */
  private _updateMoveDir(): void {
    this._moveDir.set(
      (this._keyRight ? 1 : 0) - (this._keyLeft ? 1 : 0),
      (this._keyUp ? 1 : 0) - (this._keyDown ? 1 : 0),
      0,
    );
    // 대각선 이동 시 속도가 √2배 되는 것 방지
    if (this._moveDir.lengthSqr() > 1) {
      this._moveDir.normalize();
    }
  }

  /** 이동 방향으로 플레이어를 이동시킨다. 매 프레임 이동속도 패시브 보너스를 곱해 라이브 반영한다. */
  private _move(dt: number): void {
    const speed =
      DataManager.instance.playerData.speed * (1 + (DeckManager.instance?.moveSpeedBonus ?? 0));
    const pos = this.node.position;
    this.node.setPosition(
      pos.x + this._moveDir.x * speed * dt,
      pos.y + this._moveDir.y * speed * dt,
      pos.z,
    );
  }
}
