import { _decorator, Component, Node, Vec3 } from 'cc';
import { GameState, IEnemyData } from '../data/GameTypes';
import { GameManager } from '../systems/GameManager';

const { ccclass, property } = _decorator;

const ENEMY_DATA: IEnemyData = {
  maxHp: 100,
  speed: 150,
  contactDamagePerSec: 20,
  collisionRadius: 25,
};

/** 플레이어를 추적하고 접촉 시 데미지를 주는 적 AI */
@ccclass('EnemyController')
export class EnemyController extends Component {
  /** 추적 대상 플레이어 노드 (인스펙터에서 연결) */
  @property(Node) playerNode: Node | null = null;

  /** 적 충돌 반경 (units) */
  readonly collisionRadius: number = ENEMY_DATA.collisionRadius;

  private _hp: number = ENEMY_DATA.maxHp;

  onLoad() {
    GameManager.instance.registerEnemy(this);
  }

  onDestroy() {
    GameManager.instance.unregisterEnemy(this);
  }

  update(dt: number) {
    if (GameManager.instance.state !== GameState.Playing) return;
    if (!this.playerNode) return;

    this._followPlayer(dt);
    this._checkContactDamage(dt);
  }

  /**
   * 외부(발사체)에서 데미지를 입힌다. HP가 0 이하면 노드를 제거한다.
   * @param amount 피해량
   */
  takeDamage(amount: number): void {
    this._hp -= amount;
    if (this._hp <= 0) {
      this.node.destroy();
    }
  }

  private _followPlayer(dt: number): void {
    const myPos = this.node.worldPosition;
    const targetPos = this.playerNode!.worldPosition;
    const dir = new Vec3();
    Vec3.subtract(dir, targetPos, myPos);

    if (dir.length() < 1) return;
    dir.normalize();
    dir.multiplyScalar(ENEMY_DATA.speed * dt);

    this.node.setWorldPosition(
      myPos.x + dir.x,
      myPos.y + dir.y,
      myPos.z,
    );
  }

  private _checkContactDamage(dt: number): void {
    const dist = Vec3.distance(this.node.worldPosition, this.playerNode!.worldPosition);
    // 플레이어 반경(25) + 적 반경(25) = 50
    if (dist < 50) {
      GameManager.instance.damagePlayer(ENEMY_DATA.contactDamagePerSec * dt);
    }
  }
}
