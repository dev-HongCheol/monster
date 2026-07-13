import { _decorator, Component, type Node, type Prefab, type Vec3 } from 'cc';
import { PoolManager } from '../components/PoolManager';
import { XPItemController } from '../components/XPItemController';
import { ExperienceLogic } from '../logic/ExperienceLogic';
import { DataManager } from './DataManager';
import { DeckManager } from './DeckManager';

const { ccclass } = _decorator;

/** 경험치 및 레벨업을 관리하는 싱글톤 */
@ccclass('ExperienceManager')
export class ExperienceManager extends Component {
  /** 씬 리로드 시 onDestroy가 null로 되돌리므로 정직하게 nullable이다 (싱글톤 컨벤션 참고). */
  static instance: ExperienceManager | null = null;

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
  /**
   * 데이터 로드 시점에 잡아 두는 기본 픽업 반경(player.json). 아래 `_pickupRadius`가 화살표 함수
   * 필드라 조기 return을 쓸 수 없어, 거기서 싱글톤을 역참조하면 없을 때 `?? 0`밖에 선택지가 없고
   * 그건 픽업 반경 0 — **경험치를 영영 못 줍는** 조용한 파괴다. 그래서 값을 미리 캐시해 그 함수가
   * 싱글톤을 아예 안 보게 만든다. XP 아이템은 데이터 준비 이후에만 생기므로 순서가 보장된다.
   */
  private _basePickupRadius = 0;
  /**
   * 현재 픽업 반경 getter — 매 스폰마다 새 closure를 만들지 않도록 1회 바인딩해 재사용.
   * 캐시한 베이스에 픽업범위 패시브 보너스를 곱한다. XP 아이템이 매 프레임 호출하므로 보너스가
   * 오르면 이미 떠 있는 XP에도 즉시 넓어진 반경이 적용된다(라이브). 보너스가 없을 때의 0은
   * "보너스 없음"이라는 옳은 중립값이라 폴백이 안전하다(반경 자체는 베이스가 유지된다).
   */
  private readonly _pickupRadius = (): number =>
    this._basePickupRadius * (1 + (DeckManager.instance?.pickupRangeBonus ?? 0));

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
    const dm = DataManager.instance;
    if (!dm) {
      console.error(
        '[ExperienceManager] DataManager 없음 — 경험치가 동작하지 않습니다. 씬 배선을 확인하세요.',
      );
      return;
    }
    // 콜백은 씬을 넘어 살아남을 수 있으므로(로딩 중 재시작) 발화 시점에 자신이 유효한지 확인하고,
    // 클로저 안에서는 내로잉이 살아남지 않으므로 싱글톤을 다시 받는다.
    dm.onReady(() => {
      if (!this.isValid) return;
      const data = DataManager.instance;
      const xpData = data?.xpData;
      const player = data?.playerData;
      if (!xpData || !player) {
        console.error(
          '[ExperienceManager] 경험치/플레이어 데이터 없음 — 레벨업이 동작하지 않습니다.',
        );
        return;
      }
      this._logic = new ExperienceLogic(xpData.baseXp, xpData.xpMultiplier);
      this._basePickupRadius = player.pickupRadius;
    });
  }

  onDestroy() {
    if (ExperienceManager.instance === this) {
      ExperienceManager.instance = null;
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
    ctrl.init(playerNode, value, this._pickupRadius, this._absorb);
  }
}
