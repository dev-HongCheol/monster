import { _decorator, Component, Node, Vec3 } from 'cc';
import { GameState } from '../data/GameTypes';
import { GameManager } from '../systems/GameManager';

const { ccclass, property } = _decorator;

/** 적 사망 시 드롭되는 XP 아이템. 플레이어가 근접하면 흡수된다. */
@ccclass('XPItemController')
export class XPItemController extends Component {
  /** 추적 대상 플레이어 노드 (스폰 시 코드로 설정) */
  @property(Node) playerNode: Node | null = null;
  /** 이 아이템이 주는 XP량 */
  @property xpValue: number = 10;
  /** 자동 흡수 반경 (units) — getter 미주입 시 폴백. 실사용 반경은 init의 getPickupRadius. */
  @property pickupRadius: number = 50;

  /**
   * 흡수 시 호출할 콜백 (init에서 주입). XP 가산·풀 반환은 소유자(ExperienceManager)가
   * 책임진다 — XPItemController가 ExperienceManager를 직접 참조하지 않도록 역주입해
   * 순환 import를 끊는다. null이면 destroy로 폴백.
   */
  private _onAbsorb: ((xpValue: number, node: Node) => void) | null = null;
  /**
   * 현재 흡수 반경을 돌려주는 getter (init에서 주입). 매 프레임 호출해 반경을 재계산하므로
   * 픽업범위 패시브가 오르면 이미 떠 있는 XP에도 즉시 넓어진 반경이 적용된다(라이브).
   * null이면 `@property pickupRadius`로 폴백.
   */
  private _getPickupRadius: (() => number) | null = null;
  /** 이미 흡수 처리됐는지 — 이중 흡수 방어(멱등). */
  private _absorbed: boolean = false;

  /**
   * XP 아이템을 초기화한다. 풀에서 꺼낸 직후(또는 instantiate 직후) 반드시 호출한다.
   * 재사용 노드의 상태(추적 대상·획득 값·흡수 플래그)를 매번 새로 설정한다.
   * @param playerNode 흡수 판정 대상 플레이어 노드
   * @param xpValue 흡수 시 가산할 XP량
   * @param getPickupRadius 현재 흡수 반경을 돌려주는 getter (매 프레임 호출 — 픽업범위 패시브 라이브 반영)
   * @param onAbsorb 흡수 시 호출할 콜백 (xpValue와 자신의 node 전달)
   */
  init(
    playerNode: Node,
    xpValue: number,
    getPickupRadius: () => number,
    onAbsorb: (xpValue: number, node: Node) => void,
  ): void {
    this.playerNode = playerNode;
    this.xpValue = xpValue;
    this._getPickupRadius = getPickupRadius;
    this._onAbsorb = onAbsorb;
    this._absorbed = false;
  }

  update(_dt: number) {
    // 일시정지(Paused)·레벨업(LevelUp) 등 비-Playing 상태에서는 XP를 흡수하지 않는다(I2).
    // Projectile·EnemyProjectile의 일시정지 가드와 동일 패턴.
    if (GameManager.instance.state !== GameState.Playing) return;
    if (this._absorbed || !this.playerNode) return;
    const radius = this._getPickupRadius ? this._getPickupRadius() : this.pickupRadius;
    const dist = Vec3.distance(this.node.position, this.playerNode.position);
    if (dist <= radius) {
      this._absorbed = true;
      if (this._onAbsorb) this._onAbsorb(this.xpValue, this.node);
      else this.node.destroy();
    }
  }
}
