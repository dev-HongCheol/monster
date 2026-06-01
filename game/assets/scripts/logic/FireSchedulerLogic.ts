/**
 * 마법별 자동 발사 쿨다운 타이머 관리 순수 로직 — cc import 없음.
 *
 * 플랜 § 3 근거:
 * - 보유 마법 각각 독립 쿨다운 타이머로 자동 발사
 * - 타깃이 없어 발사하지 못하면(`consume` 미호출) 쿨다운이 소모되지 않아
 *   적 등장 즉시 발사된다 (기존 단일 발사 `_attackTimer` 동작 보존)
 */
export class FireSchedulerLogic {
  /** 마법 id → 남은 쿨다운(sec). <= 0 이면 발사 준비됨. */
  private _timers = new Map<string, number>();

  /**
   * 활성 마법들의 타이머를 dt만큼 감소시킨다.
   * 신규 마법(타이머 없음)은 0으로 초기화 → 즉시 발사 가능.
   * 로드아웃에서 빠진 마법(`activeIds`에 없음)의 타이머는 정리한다.
   * @param dt 경과 시간(sec)
   * @param activeIds 현재 로드아웃 보유 마법 id 목록
   */
  tick(dt: number, activeIds: string[]): void {
    const active = new Set(activeIds);
    for (const id of activeIds) {
      const t = this._timers.get(id);
      // 신규 마법은 0(즉시 발사 가능), 기존 마법은 dt만큼 감소
      this._timers.set(id, t === undefined ? 0 : t - dt);
    }
    // 로드아웃에서 빠진 마법 타이머 정리
    for (const id of [...this._timers.keys()]) {
      if (!active.has(id)) this._timers.delete(id);
    }
  }

  /**
   * 해당 마법이 발사 준비됐는지 여부.
   * @param id 마법 id
   * @returns 타이머가 0 이하이면 true. 미등록 마법은 false.
   */
  isReady(id: string): boolean {
    const t = this._timers.get(id);
    return t !== undefined && t <= 0;
  }

  /**
   * 발사 후 호출 — 타이머를 쿨다운으로 리셋한다.
   * @param id 마법 id
   * @param cooldown 다음 발사까지 대기 시간(sec)
   */
  consume(id: string, cooldown: number): void {
    this._timers.set(id, cooldown);
  }
}
