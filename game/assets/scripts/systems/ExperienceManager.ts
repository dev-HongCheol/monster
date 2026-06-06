import { _decorator, Component, type Node, type Prefab, type Vec3 } from 'cc';
import { PoolManager } from '../components/PoolManager';
import { XPItemController } from '../components/XPItemController';
import { ExperienceLogic } from '../logic/ExperienceLogic';
import { DataManager } from './DataManager';

const { ccclass } = _decorator;

/** 경험치 및 레벨업을 관리하는 싱글톤 */
@ccclass('ExperienceManager')
export class ExperienceManager extends Component {
  static instance!: ExperienceManager;

  private _logic: ExperienceLogic | null = null;
  private _onLevelUp: (() => void) | null = null;
  /**
   * XP 아이템 재사용 풀. 첫 드롭 시 lazy 생성한다. 씬마다 재생성되는 이 매니저가 소유하므로
   * 씬 리로드(재시작) 시 풀이 노드 트리와 함께 폐기돼 stale 노드 참조가 남지 않는다.
   */
  private _xpPool: PoolManager | null = null;
  /** 흡수 콜백 — 매 스폰마다 closure를 새로 만들지 않도록 1회 바인딩해 재사용. */
  private readonly _absorb = (xpValue: number, node: Node): void => {
    this.addXp(xpValue);
    this._xpPool?.release(node);
  };

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

  /**
   * XP 아이템을 풀에서 꺼내 지정 위치에 스폰한다(가용분 재사용 또는 신규 생성).
   * 풀은 첫 호출 때 주어진 prefab/parent로 lazy 생성되며, 이후 호출의 prefab/parent는
   * 무시된다(모든 XP는 동일한 프리팹·Canvas를 쓴다). 흡수 시 XP 가산·풀 반환은 이 매니저가
   * `_absorb`로 처리하므로 XPItemController는 매니저를 참조하지 않는다(순환 import 차단).
   * @param prefab XP 아이템 프리팹 (EnemyController의 @property를 전달)
   * @param parent 노드를 부착할 부모 (적이 속한 Canvas)
   * @param pos 스폰 위치 (적 사망 위치)
   * @param value 이 아이템이 주는 XP량 (적 종류별 xpDrop)
   * @param playerNode 흡수 판정 대상 플레이어 노드
   */
  spawnXpItem(
    prefab: Prefab,
    parent: Node,
    pos: Readonly<Vec3>,
    value: number,
    playerNode: Node,
  ): void {
    if (!this._xpPool) this._xpPool = new PoolManager(prefab, parent);
    const node = this._xpPool.acquire();
    node.setPosition(pos);
    const ctrl = node.getComponent(XPItemController);
    if (!ctrl) {
      this._xpPool.release(node);
      return;
    }
    ctrl.init(playerNode, value, this._absorb);
  }
}
