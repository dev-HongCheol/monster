import { _decorator, Component, director } from 'cc';
import type { EnemyController } from '../components/EnemyController';
import { GameResult, GameState } from '../data/GameTypes';
import { SpatialGrid } from '../logic/SpatialGrid';
import { DataManager } from './DataManager';
import { DeckManager } from './DeckManager';
import { ExperienceManager } from './ExperienceManager';
import { WaveManager } from './WaveManager';

const { ccclass, property } = _decorator;

/** 공간 그리드 셀 한 변 (월드 단위). 질의 반경을 한두 칸에 담을 크기 — 추후 프로파일링으로 조정. */
const GRID_CELL_SIZE = 128;
/** 질의 반경에 더하는 슬랙 (월드 단위) — 한 프레임 사이 적 이동분을 흡수해 후보 누락을 막는다. */
const GRID_QUERY_SLACK = 32;

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
  /** 적 충돌·폭발 후보를 빠르게 찾는 공간 그리드. 프레임당 1회 적 위치로 다시 채운다. */
  private readonly _enemyGrid = new SpatialGrid<EnemyController>(GRID_CELL_SIZE);
  /** 매 프레임 update에서 증가. 그리드가 어느 프레임 기준인지 비교하는 토큰(엔진 프레임 API 비의존). */
  private _frameToken: number = 0;
  /** _enemyGrid가 마지막으로 채워진 프레임 토큰. -1이면 아직 미채움. */
  private _gridFrame: number = -1;
  /** 직전 재구축 시점의 최대 적 충돌 반경 — 질의 마진을 매직 넘버 없이 잡는다. */
  private _maxEnemyRadius: number = 0;

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

  // 프레임 토큰 증가(그리드 지연 재구축 키) → 전체 게임 타이머를 감소시키고, 0이 되면 승리로 전환해 result 씬으로 보낸다
  update(dt: number) {
    // 가드보다 먼저 증가시켜 프레임당 정확히 한 번 그리드가 재구축되게 한다.
    this._frameToken++;
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

  /**
   * (x, y) 반경 reach 안에 있을 수 있는 적 후보를 돌려준다 (충돌·폭발 광역 1차 선별).
   * 그리드는 프레임당 1회 적 위치로 다시 채워지고(지연 재구축), 질의 반경에는 최대 적
   * 충돌 반경과 한 프레임 이동분(슬랙)을 더해 충돌 가능한 적을 빠뜨리지 않는다. 정밀
   * 명중 판정(적별 충돌 반경·현재 위치)은 호출부가 후보에 대해 다시 한다.
   * @param reach 발사체/폭발의 반경
   * @returns 반경 + 마진 안의 적 후보 (순서 미보장)
   */
  queryEnemiesInRadius(x: number, y: number, reach: number): EnemyController[] {
    this._refreshEnemyGrid();
    return this._enemyGrid.queryRadius(x, y, reach + this._maxEnemyRadius + GRID_QUERY_SLACK);
  }

  /** 프레임이 바뀌었으면 그리드를 현재 적 위치로 다시 채운다(프레임당 1회). 같은 루프에서 최대 적 반경도 갱신. */
  private _refreshEnemyGrid(): void {
    if (this._gridFrame === this._frameToken) return;
    this._gridFrame = this._frameToken;
    this._enemyGrid.clear();
    this._maxEnemyRadius = 0;
    for (const enemy of this._enemies) {
      if (!enemy?.isValid) continue;
      const p = enemy.node.position;
      this._enemyGrid.insert(enemy, p.x, p.y);
      if (enemy.collisionRadius > this._maxEnemyRadius) {
        this._maxEnemyRadius = enemy.collisionRadius;
      }
    }
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
