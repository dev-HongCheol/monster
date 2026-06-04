import { _decorator, Component, director } from 'cc';
import type { EnemyController } from '../components/EnemyController';
import { GameResult, GameState } from '../data/GameTypes';
import { DataManager } from './DataManager';
import { DeckManager } from './DeckManager';
import { ExperienceManager } from './ExperienceManager';
import { WaveManager } from './WaveManager';

const { ccclass, property } = _decorator;

/** 게임 전체 상태와 플레이어 HP를 관리하는 싱글톤 */
@ccclass('GameManager')
export class GameManager extends Component {
  static instance!: GameManager;

  /** 전체 게임 제한 시간 (sec). 0이 되면 승리 */
  @property gameDuration: number = 900;

  private _state: GameState = GameState.Playing;
  private _playerHp: number = 0;
  private _maxPlayerHp: number = 0;
  private _gameTimer: number = 0;
  private _started: boolean = false;
  private _enemies: EnemyController[] = [];

  get state() {
    return this._state;
  }
  get playerHp() {
    return this._playerHp;
  }
  get maxPlayerHp() {
    return this._maxPlayerHp;
  }
  get gameTimer() {
    return this._gameTimer;
  }
  get enemies() {
    return this._enemies;
  }

  onLoad() {
    GameManager.instance = this;
    GameResult.waveReached = 0;
    GameResult.gameVictory = false;
  }

  start() {
    DataManager.instance.onReady(() => this._onDataReady());
  }

  // 전체 게임 타이머를 감소시키고, 0이 되면 승리로 전환해 result 씬으로 보낸다
  update(dt: number) {
    if (!this._started) return;
    if (this._state !== GameState.Playing) return;
    this._gameTimer -= dt;
    if (this._gameTimer <= 0) {
      this._gameTimer = 0;
      GameResult.waveReached = WaveManager.instance.waveNumber;
      GameResult.gameVictory = true;
      this._state = GameState.Victory;
      this.goToResult();
    }
  }

  onDestroy() {
    if (GameManager.instance === this) {
      GameManager.instance = null as unknown as GameManager;
    }
  }

  /** 데이터 로드 완료 후 플레이어 HP를 초기화하고 첫 웨이브를 시작한다. */
  private _onDataReady() {
    const base = DataManager.instance.playerData;
    this._maxPlayerHp = base.maxHp;
    this._playerHp = base.maxHp;
    this._gameTimer = this.gameDuration;
    this._started = true;
    ExperienceManager.instance.setOnLevelUp(() => this.enterLevelUp());
    WaveManager.instance.startWave();
  }

  /** 활성 적 목록에 등록한다. */
  registerEnemy(enemy: EnemyController): void {
    this._enemies.push(enemy);
  }

  /** 활성 적 목록에서 제거한다. */
  unregisterEnemy(enemy: EnemyController): void {
    const idx = this._enemies.indexOf(enemy);
    if (idx !== -1) this._enemies.splice(idx, 1);
  }

  /** 플레이어에게 피해를 주고 HP가 0 이하면 GameOver 상태로 전환 후 result 씬으로 이동한다. */
  damagePlayer(amount: number): void {
    if (this._state !== GameState.Playing) return;
    this._playerHp = Math.max(0, this._playerHp - amount);
    if (this._playerHp <= 0) {
      GameResult.waveReached = WaveManager.instance.waveNumber;
      this._state = GameState.GameOver;
      this.goToResult();
    }
  }

  /** 레벨업으로 카드 선택을 위해 게임을 일시정지(LevelUp) 상태로 전환한다. */
  enterLevelUp(): void {
    if (this._state !== GameState.Playing) return;
    this._state = GameState.LevelUp;
  }

  /** 카드 HP 보너스(이번 레벨업 증가분)를 적용하고 게임을 재개한다. */
  resumeFromLevelUp(): void {
    if (this._state !== GameState.LevelUp) return;
    const newMaxHp = DataManager.instance.playerData.maxHp + DeckManager.instance.maxHpBonus;
    if (newMaxHp > this._maxPlayerHp) {
      const hpDelta = newMaxHp - this._maxPlayerHp;
      this._maxPlayerHp = newMaxHp;
      this._playerHp = Math.min(this._playerHp + hpDelta, this._maxPlayerHp);
    }
    this._state = GameState.Playing;
    // 웨이브 타이머는 LevelUp 동안 WaveManager.update의 state 가드로 이미 멈춰 있으므로,
    // 재개 시 별도 리셋 없이 그대로 이어서 흐른다. (과거 resumeWave()의 타이머 리셋은
    // 잦은 레벨업마다 타이머를 60초로 되돌려 웨이브가 진행되지 않는 버그를 유발했다.)
  }

  /** result 씬으로 이동한다. */
  goToResult(): void {
    director.loadScene('result');
  }

  /** main 씬을 재로드해 게임을 재시작한다. */
  restart(): void {
    director.loadScene('main');
  }

  /** menu 씬으로 이동한다. */
  goToMenu(): void {
    director.loadScene('menu');
  }
}
