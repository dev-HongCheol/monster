import { _decorator, Component } from 'cc';
import { ExperienceLogic } from '../logic/ExperienceLogic';
import { DataManager } from './DataManager';

const { ccclass } = _decorator;

/** 경험치 및 레벨업을 관리하는 싱글톤 */
@ccclass('ExperienceManager')
export class ExperienceManager extends Component {
  static instance!: ExperienceManager;

  private _logic: ExperienceLogic | null = null;
  private _onLevelUp: (() => void) | null = null;

  get level() {
    return this._logic?.level ?? 1;
  }
  get currentXp() {
    return this._logic?.currentXp ?? 0;
  }
  get requiredXp() {
    return this._logic?.requiredXp ?? Infinity;
  }

  onLoad() {
    ExperienceManager.instance = this;
  }

  start() {
    DataManager.instance.onReady(() => {
      const { baseXp, xpMultiplier } = DataManager.instance.xpData;
      this._logic = new ExperienceLogic(baseXp, xpMultiplier);
    });
  }

  onDestroy() {
    if (ExperienceManager.instance === this) {
      ExperienceManager.instance = null as unknown as ExperienceManager;
    }
  }

  /** 레벨업 시 호출될 콜백을 등록한다. */
  setOnLevelUp(cb: () => void): void {
    this._onLevelUp = cb;
  }

  /** XP를 추가하고 레벨업이 발생하면 콜백을 호출한다. */
  addXp(amount: number): void {
    if (!this._logic) return;
    const leveled = this._logic.addXp(amount);
    if (leveled) {
      this._onLevelUp?.();
    }
  }
}
