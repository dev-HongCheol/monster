/** XP 누적 및 레벨업 판정 순수 로직 (Cocos 의존성 없음) */
export class ExperienceLogic {
  private _level: number = 1;
  private _currentXp: number = 0;

  /**
   * @param _baseXp   레벨 1→2에 필요한 기본 XP
   * @param _multiplier 레벨마다 요구 XP에 곱하는 배율 (기본값 1.2 = 120%)
   */
  constructor(
    private readonly _baseXp: number,
    private readonly _multiplier: number = 1.2,
  ) {}

  get level() {
    return this._level;
  }

  get currentXp() {
    return this._currentXp;
  }

  /** 현재 레벨에서 다음 레벨까지 필요한 XP. floor(baseXp * multiplier^(level-1)). */
  get requiredXp(): number {
    return Math.floor(this._baseXp * this._multiplier ** (this._level - 1));
  }

  /** XP를 추가하고 레벨업 여부를 반환한다. */
  addXp(amount: number): boolean {
    this._currentXp += amount;
    if (this._currentXp >= this.requiredXp) {
      this._currentXp -= this.requiredXp;
      this._level++;
      return true;
    }
    return false;
  }
}
