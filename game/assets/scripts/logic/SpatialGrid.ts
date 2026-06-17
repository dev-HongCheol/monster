/** cc 비의존 희소 해시 공간 그리드 — 균일 셀에 항목을 등록하고 반경 질의로 후보를 돌려준다 (계획 doc 2026-06-17-spatial-grid-plan.md). */
export class SpatialGrid<T> {
  /** 점유된 칸만 보관: 키 `cellX,cellY` → 그 칸의 항목들(좌표 동반). */
  private readonly _cells = new Map<string, Array<{ item: T; x: number; y: number }>>();
  /** 셀 한 변의 길이 (월드 단위). */
  private readonly _cellSize: number;
  /** 등록된 항목 수. */
  private _size = 0;

  /** @param cellSize 셀 한 변 길이(월드 단위). 질의 반경을 한두 칸에 담을 크기를 권장한다. */
  constructor(cellSize: number) {
    this._cellSize = cellSize;
  }

  /** 등록된 항목 수. */
  get size(): number {
    return this._size;
  }

  /** 모든 항목을 비운다 (프레임 단위 재구축 전에 호출). */
  clear(): void {
    this._cells.clear();
    this._size = 0;
  }

  /** 항목을 (x, y) 위치로 등록한다. */
  insert(item: T, x: number, y: number): void {
    const key = this._cellKey(x, y);
    const bucket = this._cells.get(key);
    if (bucket) bucket.push({ item, x, y });
    else this._cells.set(key, [{ item, x, y }]);
    this._size++;
  }

  /**
   * (x, y)에서 반경 radius 안의 항목을 돌려준다.
   * 반경과 겹치는 칸만 훑으므로 비용은 맵 크기가 아니라 반경·밀도에 비례한다.
   * @param radius 질의 반경 (월드 단위)
   * @returns 반경 내 항목 배열 (순서 미보장)
   */
  queryRadius(x: number, y: number, radius: number): T[] {
    const result: T[] = [];
    const r2 = radius * radius;
    const minCx = Math.floor((x - radius) / this._cellSize);
    const maxCx = Math.floor((x + radius) / this._cellSize);
    const minCy = Math.floor((y - radius) / this._cellSize);
    const maxCy = Math.floor((y + radius) / this._cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this._cells.get(`${cx},${cy}`);
        if (!bucket) continue;
        for (const e of bucket) {
          // 칸은 후보를 좁힐 뿐 — 정밀 판정은 제곱거리로(반경 모서리 칸의 헛맞음 제거).
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= r2) result.push(e.item);
        }
      }
    }
    return result;
  }

  /** (x, y)가 속한 칸의 키. 큰 좌표·음수 좌표도 floor 나눗셈으로 일관 처리한다. */
  private _cellKey(x: number, y: number): string {
    return `${Math.floor(x / this._cellSize)},${Math.floor(y / this._cellSize)}`;
  }
}

/** 적 질의 반경에 더하는 슬랙 (월드 단위) — 그리드가 최대 약 2프레임 낡을 수 있는 적 이동분을 흡수해 후보 누락을 막는다. */
export const ENEMY_QUERY_SLACK = 32;

/**
 * 적 충돌·폭발 광역 1차 선별에 쓸 그리드 질의 반경을 구한다 (순수 함수 — parity 단위 테스트 대상).
 * 발사체/폭발 반경에 최대 적 충돌 반경과 슬랙을 더한다. maxEnemyRadius는 모든 적 충돌 반경의
 * 최댓값이므로 (reach + maxEnemyRadius) ≥ (reach + 임의의 적 충돌 반경)이고, 따라서 정밀 임계값
 * `reach + 적.collisionRadius`를 통과할 적은 반드시 이 반경 안에 든다(누락 없음). 슬랙은 그 위에
 * 프레임 사이 위치 낡음까지 덮는다.
 * @param reach 발사체/폭발의 반경
 * @param maxEnemyRadius 현재 살아 있는 적들의 충돌 반경 최댓값
 */
export function enemyQueryRadius(reach: number, maxEnemyRadius: number): number {
  return reach + maxEnemyRadius + ENEMY_QUERY_SLACK;
}
