import { ObjectPoolLogic } from '../logic/ObjectPoolLogic';

/** `NodeFactoryPool`에 주입하는 함수들. */
export interface INodeFactoryHooks<T> {
  /** 비어 있을 때 새로 만든다 */
  create: () => T;
  /** 꺼낼 때마다 — 노드를 켜고 방출기를 다시 시작한다 */
  onAcquire?: (item: T) => void;
  /** 반납할 때마다 — 방출기를 멈추고 노드를 끈다 */
  onRelease?: (item: T) => void;
}

/**
 * 코드로 조립하는 이펙트 노드의 얇은 풀(계획 2026-10-12-magic-effect-gate-plan.md §4).
 *
 * 기존 `PoolManager`는 프리팹으로만 노드를 만들어서, 프리팹이 없는 실험실 방출기는 담을 수 없다.
 * 그래서 재사용 판단은 같은 장부(`ObjectPoolLogic`)에 맡기고 만드는 법만 주입받는다. 겉모양
 * (`acquire` · `release`)이 `PoolManager`와 같아서 `SpellCaster`가 풀 자리에 그대로 끼워 쓴다.
 *
 * cc를 import하지 않는다 — 노드를 다루는 일은 모두 주입한 함수가 한다. 그래서 테스트가 가짜
 * 객체로 재사용 순서를 확인할 수 있다.
 */
export class NodeFactoryPool<T> {
  private readonly _ledger = new ObjectPoolLogic<T>();
  private readonly _hooks: INodeFactoryHooks<T>;
  private readonly _active: T[] = [];

  /** @param hooks 만들기 · 꺼낼 때 · 반납할 때 할 일 */
  constructor(hooks: INodeFactoryHooks<T>) {
    this._hooks = hooks;
  }

  /** 지금 꺼내 쓰고 있는 것들. HUD가 매 프레임 알갱이 수를 더할 때 읽는다(고치지 말 것) */
  get active(): readonly T[] {
    return this._active;
  }

  /** 반납된 것을 다시 쓰거나 새로 만든다. */
  acquire(): T {
    const item = this._ledger.acquire(this._hooks.create);
    this._active.push(item);
    this._hooks.onAcquire?.(item);
    return item;
  }

  /**
   * 반납한다. 이미 반납된 것이면 아무것도 하지 않는다 — 블록 경계에서 일괄 반납과 수명 끝 반납이
   * 같은 노드를 두 번 부를 수 있다.
   * @param item `acquire`로 꺼낸 것
   */
  release(item: T): void {
    const i = this._active.indexOf(item);
    if (i < 0) return;
    this._active.splice(i, 1);
    this._hooks.onRelease?.(item);
    this._ledger.release(item);
  }
}
