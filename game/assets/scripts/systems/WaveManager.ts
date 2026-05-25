import { _decorator, Component } from 'cc';
import { GameState } from '../data/GameTypes';
import { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

/** 타이머 기반 웨이브 진행을 관리하는 싱글톤 */
@ccclass('WaveManager')
export class WaveManager extends Component {
  static instance!: WaveManager;

  /** 웨이브당 지속 시간 (sec) */
  @property waveDuration: number = 30;

  private _waveNumber: number = 0;
  private _waveTimer: number = 0;
  private _started: boolean = false;

  get waveNumber() {
    return this._waveNumber;
  }
  get waveTimer() {
    return this._waveTimer;
  }

  onLoad() {
    WaveManager.instance = this;
  }

  onDestroy() {
    if (WaveManager.instance === this) {
      WaveManager.instance = null as unknown as WaveManager;
    }
  }

  /** 웨이브 번호를 증가시키고 타이머를 초기화한다. */
  startWave() {
    this._waveNumber++;
    this._waveTimer = this.waveDuration;
    this._started = true;
  }

  update(dt: number) {
    if (!this._started) return;
    if (!GameManager.instance) return;
    if (GameManager.instance.state !== GameState.Playing) return;
    this._waveTimer -= dt;
    if (this._waveTimer <= 0) {
      this._waveTimer = 0;
      GameManager.instance.setWaveClear();
    }
  }
}
