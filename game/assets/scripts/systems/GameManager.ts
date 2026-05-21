import { _decorator, Component, director } from 'cc';
import type { EnemyController } from '../components/EnemyController';
import { GameState, type IPlayerData } from '../data/GameTypes';

const { ccclass } = _decorator;

const PLAYER_DATA: IPlayerData = {
  maxHp: 100,
  speed: 300,
  attackCooldown: 0.5,
  bulletSpeed: 500,
  bulletDamage: 25,
};

/** 게임 전체 상태와 플레이어 HP를 관리하는 싱글톤 */
@ccclass('GameManager')
export class GameManager extends Component {
  static instance: GameManager = null!;

  private _state: GameState = GameState.Playing;
  private _playerHp: number = PLAYER_DATA.maxHp;
  private _enemies: EnemyController[] = [];

  get state() {
    return this._state;
  }
  get playerHp() {
    return this._playerHp;
  }
  get maxPlayerHp() {
    return PLAYER_DATA.maxHp;
  }
  get playerData() {
    return PLAYER_DATA;
  }
  get enemies() {
    return this._enemies;
  }

  onLoad() {
    GameManager.instance = this;
  }

  onDestroy() {
    if (GameManager.instance === this) {
      GameManager.instance = null!;
    }
  }

  /**
   * 적을 활성 목록에 등록한다.
   * @param enemy 등록할 적 컴포넌트
   */
  registerEnemy(enemy: EnemyController): void {
    this._enemies.push(enemy);
  }

  /**
   * 적을 활성 목록에서 제거한다.
   * @param enemy 제거할 적 컴포넌트
   */
  unregisterEnemy(enemy: EnemyController): void {
    const idx = this._enemies.indexOf(enemy);
    if (idx !== -1) this._enemies.splice(idx, 1);
  }

  /**
   * 플레이어에게 피해를 입힌다. HP가 0 이하면 게임오버로 전환한다.
   * @param amount 피해량
   */
  damagePlayer(amount: number): void {
    if (this._state !== GameState.Playing) return;
    this._playerHp = Math.max(0, this._playerHp - amount);
    if (this._playerHp <= 0) {
      this._state = GameState.GameOver;
    }
  }

  /** 씬을 재로드하여 게임을 재시작한다. */
  restart(): void {
    director.loadScene('main');
  }
}
