import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import { GameState, type IEnemyData } from '../data/GameTypes';
import { DataManager } from '../systems/DataManager';
import { GameManager } from '../systems/GameManager';
import { XPItemController } from './XPItemController';

const { ccclass, property } = _decorator;

/** 플레이어를 추적하고 접촉 시 데미지를 주는 적 AI */
@ccclass('EnemyController')
export class EnemyController extends Component {
  /** 추적 대상 플레이어 노드 (인스펙터에서 연결) */
  @property(Node) playerNode: Node | null = null;
  /** enemies.json 의 id 값 (인스펙터에서 설정) */
  @property enemyId: string = 'skeleton';
  /** 사망 시 스폰할 XP 아이템 프리팹 (인스펙터에서 연결) */
  @property(Prefab) xpItemPrefab: Prefab | null = null;

  collisionRadius: number = 25;

  private _data: IEnemyData | null = null;
  private _hp: number = 0;
  private _playerCollisionRadius: number = 0;

  onLoad() {
    GameManager.instance.registerEnemy(this);
    DataManager.instance.onReady(() => {
      this._data = DataManager.instance.getEnemy(this.enemyId);
      if (this._data) {
        this._hp = this._data.maxHp;
        this.collisionRadius = this._data.collisionRadius;
      }
      this._playerCollisionRadius = DataManager.instance.playerData.collisionRadius;
    });
  }

  onDestroy() {
    GameManager.instance?.unregisterEnemy(this);
  }

  update(dt: number) {
    if (!this._data) return;
    if (GameManager.instance.state !== GameState.Playing) return;
    this._followPlayer(dt);
    this._checkContactDamage(dt);
  }

  /** 피해를 입히고 HP가 0 이하면 XP 아이템을 드롭하고 노드를 제거한다. */
  takeDamage(amount: number): void {
    this._hp -= amount;
    if (this._hp <= 0) {
      this._dropXpItem();
      this.node.destroy();
    }
  }

  /** 현재 위치에 XP 아이템을 스폰한다. */
  private _dropXpItem(): void {
    if (!this.xpItemPrefab || !this.playerNode) return;
    const item = instantiate(this.xpItemPrefab);
    this.node.parent?.addChild(item);
    item.setPosition(this.node.position);
    const ctrl = item.getComponent(XPItemController);
    if (ctrl) {
      ctrl.playerNode = this.playerNode;
      ctrl.xpValue = this._data?.xpDrop ?? 0;
    }
  }

  /** 플레이어 방향으로 이동한다. */
  private _followPlayer(dt: number): void {
    if (!this.playerNode || !this._data) return;
    const myPos = this.node.position;
    const targetPos = this.playerNode.position;
    const dir = new Vec3();
    Vec3.subtract(dir, targetPos, myPos);
    if (dir.lengthSqr() < 1) return;
    dir.normalize();
    dir.multiplyScalar(this._data.speed * dt);
    this.node.setPosition(myPos.x + dir.x, myPos.y + dir.y, myPos.z);
  }

  /** 플레이어와 접촉 거리 내에 있으면 초당 데미지를 준다. */
  private _checkContactDamage(dt: number): void {
    if (!this.playerNode || !this._data) return;
    const dist = Vec3.distance(this.node.position, this.playerNode.position);
    const touchRadius = this.collisionRadius + this._playerCollisionRadius;
    if (dist < touchRadius) {
      GameManager.instance.damagePlayer(this._data.contactDamagePerSec * dt);
    }
  }
}
