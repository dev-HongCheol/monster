/**
 * cc 비의존 제네릭 객체 풀 장부 (계획 doc 2026-06-06-object-pooling-plan.md §2.2).
 *
 * 가용(idle) 목록을 재사용하고, 없으면 주입된 팩토리로 생성한다. 실제 cc.Node 생성·
 * active 토글·destroy는 호출부(PoolManager)가 담당하고, 이 클래스는 **재사용 vs 생성
 * 결정·보관 한도(cap)·카운터**만 책임진다 — 덕분에 cc 없이 결정적으로 테스트 가능.
 *
 * 설계 메모:
 * - 생성 부수효과는 `acquire(create)`의 콜백으로 격리한다(로직은 호출 여부만 결정).
 * - `maxFree`는 **idle 보관 상한**이지 활성 상한이 아니다. 스폰(acquire)은 절대 거부하지
 *   않으며, 한도 초과분은 release 시 보관하지 않고 호출부가 폐기하도록 false를 반환한다.
 */
export class ObjectPoolLogic<T> {
  /** 재사용 대기 중인(반환된) 항목들. */
  private readonly _free: T[] = [];
  /** 풀이 인지하는 누적 객체 수(활성 + 가용). */
  private _total = 0;
  /** idle 보관 상한. 0이면 무제한. */
  private readonly _maxFree: number;

  /** @param maxFree 가용(idle) 보관 상한. 0(기본)=무제한. 활성 수는 제한하지 않는다. */
  constructor(maxFree = 0) {
    this._maxFree = maxFree;
  }

  /** 재사용 대기(idle) 수. */
  get freeCount(): number {
    return this._free.length;
  }

  /** 풀이 인지하는 누적 객체 수(활성 + 가용). */
  get totalCount(): number {
    return this._total;
  }

  /** 현재 사용 중(활성)인 수 = 누적 - 가용. */
  get activeCount(): number {
    return this._total - this._free.length;
  }

  /**
   * 가용 항목을 재사용하거나, 없으면 `create()`로 생성·추적해 반환한다.
   * 스폰을 절대 거부하지 않는다(가용이 없으면 항상 새로 만든다).
   * @param create 가용분이 없을 때 새 항목을 만드는 팩토리.
   * @returns 재사용되었거나 새로 생성된 항목.
   */
  acquire(create: () => T): T {
    if (this._free.length > 0) {
      return this._free.pop() as T;
    }
    const item = create();
    this._total++;
    return item;
  }

  /**
   * 항목을 가용 목록으로 반환한다.
   * @param item 반환할 항목.
   * @returns 보관했으면 true. 보관 한도(maxFree) 초과로 보관하지 않으면 false(호출부가 폐기).
   *   이미 가용 목록에 있으면 중복 적재 없이 true(멱등 no-op).
   */
  release(item: T): boolean {
    if (this._free.includes(item)) return true; // 멱등 — 이중 반환 방어
    if (this._maxFree > 0 && this._free.length >= this._maxFree) {
      this._total--; // 보관하지 않고 폐기 → 활성 회계 유지
      return false;
    }
    this._free.push(item);
    return true;
  }
}
