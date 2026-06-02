import { _decorator, Component } from 'cc';
import { GameState } from '../data/GameTypes';
import { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

/** 타이머 기반 웨이브 진행을 관리하는 싱글톤 */
@ccclass('WaveManager')
export class WaveManager extends Component {
  static instance!: WaveManager;

  /** 웨이브당 지속 시간 (sec) */
  @property waveDuration: number = 180;

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

  /** 게임 시작 시 웨이브 번호를 1로 설정하고 타이머를 초기화한다. */
  startWave() {
    this._waveNumber = 1;
    this._waveTimer = this.waveDuration;
    this._started = true;
  }

  /** 카드 선택 후 타이머만 리셋한다. 웨이브 번호는 변경하지 않는다. */
  resumeWave() {
    this._waveTimer = this.waveDuration;
  }

  // 웨이브 타이머를 감소시키고, 만료되면 웨이브 번호를 올린 뒤 타이머를 리셋한다
  update(dt: number) {
    if (!this._started) return;
    if (!GameManager.instance) return;
    if (GameManager.instance.state !== GameState.Playing) return;
    this._waveTimer -= dt;
    if (this._waveTimer <= 0) {
      this._waveNumber++;
      this._waveTimer = this.waveDuration;
    }
  }
}
