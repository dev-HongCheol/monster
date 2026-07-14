import { _decorator, Component, type EventKeyboard, Input, input, KeyCode, Vec3 } from 'cc';
import { GameState, type IPlayerBaseData } from '../data/GameTypes';
import { clampToArena } from '../logic/ArenaLogic';
import { DataManager } from '../systems/DataManager';
import { DeckManager } from '../systems/DeckManager';
import { GameManager } from '../systems/GameManager';
import { MapManager } from '../systems/MapManager';

const { ccclass } = _decorator;

/** 플레이어 이동, HP 연동을 담당하는 컴포넌트. 자동 발사는 SpellCaster가 담당한다. */
@ccclass('PlayerController')
export class PlayerController extends Component {
  private _moveDir: Vec3 = new Vec3();
  private _dataReady = false;
  /** 데이터 준비 시 잡아 두는 플레이어 기본 스탯 — 매 프레임 싱글톤을 역참조하지 않게 한다. */
  private _base: IPlayerBaseData | null = null;

  private _keyUp: boolean = false;
  private _keyDown: boolean = false;
  private _keyLeft: boolean = false;
  private _keyRight: boolean = false;

  onLoad() {
    input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
  }

  start() {
    const dm = DataManager.instance;
    if (!dm) {
      console.error(
        '[PlayerController] DataManager 없음 — 이동을 비활성화합니다. 씬 배선을 확인하세요.',
      );
      this.enabled = false;
      return;
    }
    // 콜백은 씬을 넘어 살아남을 수 있으므로(로딩 중 재시작) 발화 시점에 자신이 유효한지 확인하고,
    // 클로저 안에서는 내로잉이 살아남지 않으므로 데이터를 다시 받아 필드에 잡아 둔다.
    dm.onReady(() => {
      if (!this.isValid) return;
      const base = DataManager.instance?.playerData;
      if (!base) {
        console.error('[PlayerController] 플레이어 데이터 없음 — 이동이 동작하지 않습니다.');
        return;
      }
      this._base = base;
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
    const gm = GameManager.instance;
    if (!gm) return;
    if (gm.state !== GameState.Playing) return;

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
    // _dataReady가 켜졌다면 _base는 반드시 있다(같은 콜백에서 함께 세운다). 보너스가 없을 때의 0은
    // "보너스 없음"이라는 옳은 중립값이라 폴백이 안전하다 — 기본 속도는 그대로 유지된다.
    const base = this._base;
    if (!base) return;
    const speed = base.speed * (1 + (DeckManager.instance?.moveSpeedBonus ?? 0));
    const pos = this.node.position;
    const nextX = pos.x + this._moveDir.x * speed * dt;
    const nextY = pos.y + this._moveDir.y * speed * dt;
    // 아레나 경계 안으로 클램프 — 플레이어가 벽을 넘지 못하게 한다(아레나 로드 전엔 무클램프).
    const arena = MapManager.instance?.arena;
    if (arena && arena.width > 0) {
      const radius = base.collisionRadius;
      const clamped = clampToArena({ x: nextX, y: nextY }, radius, arena);
      this.node.setPosition(clamped.x, clamped.y, pos.z);
      return;
    }
    this.node.setPosition(nextX, nextY, pos.z);
  }
}
