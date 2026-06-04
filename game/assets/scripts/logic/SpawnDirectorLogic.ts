import type { ISpawnTableEntry } from '../data/GameTypes';

/**
 * 웨이브에 따라 스폰할 적 종류(enemyId)를 결정하는 순수 로직 (cc 비의존).
 *
 * 설계 doc(enemy-system.md §8) 근거:
 * - 웨이브 구간별 가중 테이블에서 현재 웨이브 이하인 마지막 구간을 고르고,
 *   그 구간의 가중치 비례로 enemyId를 추출한다(후반일수록 강한 적 ↑).
 * - 난수는 주입식(roll 인자)이라 결정적으로 테스트 가능. 호출자(EnemySpawner)가
 *   `Math.random()`을 넘긴다.
 */
export class SpawnDirectorLogic {
  /** fromWave 오름차순으로 정렬된 구간 목록 */
  private readonly _table: ISpawnTableEntry[];

  /** @param table 스폰 테이블 구간 목록 (정렬 여부 무관 — 내부에서 오름차순 정렬) */
  constructor(table: ISpawnTableEntry[]) {
    this._table = [...table].sort((a, b) => a.fromWave - b.fromWave);
    this._validate();
  }

  /**
   * 웨이브 + 난수로 스폰할 enemyId를 결정한다.
   * @param wave 현재 웨이브 번호
   * @param roll [0,1) 난수 (테스트 결정성을 위해 주입)
   * @returns 선택된 enemyId. 비정상 데이터(빈 테이블/빈 weights)면 빈 문자열(호출부가 무시).
   */
  selectEnemyId(wave: number, roll: number): string {
    const entry = this._entryForWave(wave);
    if (!entry) return ''; // 빈 테이블 — 생성자에서 경고됨. 호출부는 빈 id를 무시한다.
    return this._pickWeighted(entry.weights, roll);
  }

  /** wave 이하 fromWave 중 가장 큰 구간. 없으면(웨이브가 첫 구간보다 작음) 첫 구간. 빈 테이블이면 undefined. */
  private _entryForWave(wave: number): ISpawnTableEntry | undefined {
    let chosen = this._table[0];
    for (const e of this._table) {
      if (e.fromWave <= wave) chosen = e;
      else break;
    }
    return chosen;
  }

  /** 가중치 비례 추출. roll∈[0,1)을 누적 가중치 구간에 매핑. 비정상 데이터는 안전 폴백. */
  private _pickWeighted(weights: Record<string, number>, roll: number): string {
    const entries = Object.entries(weights);
    if (entries.length === 0) return ''; // 빈 weights — 생성자에서 경고됨
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    // 합이 0 이하면 비례 선택 불가 → 첫 키로 결정적 폴백(생성자에서 경고됨).
    if (total <= 0) return entries[0][0];
    // roll<0 방어. roll>=1이면 target>=total → 루프 폴스루로 마지막 키 반환.
    const target = Math.max(0, roll) * total;
    let acc = 0;
    for (const [id, w] of entries) {
      acc += w;
      if (target < acc) return id;
    }
    return entries[entries.length - 1][0];
  }

  /**
   * 데이터 무결성 1회 검사 — 비정상 테이블/구간을 생성 시점에 1회 경고한다.
   * (스폰 틱마다 폴백 경고가 쏟아지는 것을 막기 위해 생성자에서만 검사.)
   */
  private _validate(): void {
    if (this._table.length === 0) {
      console.warn('[SpawnDirector] 스폰 테이블이 비어 있습니다 — 적이 스폰되지 않습니다.');
      return;
    }
    for (const e of this._table) {
      const entries = Object.entries(e.weights);
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      if (entries.length === 0 || total <= 0) {
        console.warn(
          `[SpawnDirector] fromWave=${e.fromWave} 구간의 weights가 비었거나 합이 0 이하입니다 — 폴백 적용.`,
        );
      }
    }
  }
}
