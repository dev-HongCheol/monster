import { instantiate, type Node, type Prefab } from 'cc';
import { ObjectPoolLogic } from '../logic/ObjectPoolLogic';

/**
 * 프리팹 노드 재사용 풀. 순수 장부 `ObjectPoolLogic` 위에 cc.Node 생성(instantiate)·
 * 표시 토글(active)·폐기(destroy)를 입힌 얇은 바인딩이다.
 *
 * cc `Component`가 아니라 일반 클래스다 — 소유자(예: SpellCaster)가 이미 보유한
 * prefab/parent `@property`로 생성하므로 **새 에디터 배선이 필요 없다**. Cocos 3.8
 * 권장 패턴대로 `destroy` 대신 `active=false`로 숨겨 보관하고, 재사용 시 `active=true`로
 * 되살린다(상태 리셋은 호출부가 acquire 직후 재설정).
 */
export class PoolManager {
  private readonly _prefab: Prefab;
  private readonly _parent: Node;
  private readonly _logic: ObjectPoolLogic<Node>;

  /**
   * @param prefab 풀이 생성·재사용할 노드의 프리팹.
   * @param parent 노드를 부착할 부모.
   * @param maxFree idle 보관 상한(0=무제한). 활성 수는 제한하지 않는다.
   */
  constructor(prefab: Prefab, parent: Node, maxFree = 0) {
    this._prefab = prefab;
    this._parent = parent;
    this._logic = new ObjectPoolLogic<Node>(maxFree);
  }

  /** 재사용 대기(idle) 노드 수. */
  get freeCount(): number {
    return this._logic.freeCount;
  }

  /** 현재 사용 중(활성) 노드 수. */
  get activeCount(): number {
    return this._logic.activeCount;
  }

  /**
   * 노드를 꺼낸다 — 가용분을 재사용하거나 없으면 새로 instantiate해 부모에 부착한다.
   * @returns active=true 상태의 노드. 호출부가 위치·상태를 리셋해야 한다.
   */
  acquire(): Node {
    const node = this._logic.acquire(() => {
      const created = instantiate(this._prefab);
      this._parent.addChild(created);
      return created;
    });
    node.active = true;
    return node;
  }

  /**
   * 노드를 풀로 반환한다. 보관하면 `active=false`로 숨기고, 보관 한도 초과면 `destroy`한다.
   * @param node 반환할 노드.
   */
  release(node: Node): void {
    if (this._logic.release(node)) {
      node.active = false;
    } else {
      node.destroy();
    }
  }
}
