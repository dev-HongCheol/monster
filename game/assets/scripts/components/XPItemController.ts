import { _decorator, Component, Node, Vec3 } from 'cc';
import { ExperienceManager } from '../systems/ExperienceManager';

const { ccclass, property } = _decorator;

/** 적 사망 시 드롭되는 XP 아이템. 플레이어가 근접하면 흡수된다. */
@ccclass('XPItemController')
export class XPItemController extends Component {
  /** 추적 대상 플레이어 노드 (스폰 시 코드로 설정) */
  @property(Node) playerNode: Node | null = null;
  /** 이 아이템이 주는 XP량 */
  @property xpValue: number = 10;
  /** 자동 흡수 반경 (units) */
  @property pickupRadius: number = 50;

  update(_dt: number) {
    if (!this.playerNode || !ExperienceManager.instance) return;
    const dist = Vec3.distance(this.node.position, this.playerNode.position);
    if (dist <= this.pickupRadius) {
      ExperienceManager.instance.addXp(this.xpValue);
      this.node.destroy();
    }
  }
}
