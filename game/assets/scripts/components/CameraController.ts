import { _decorator, Camera, Component, Node, view } from 'cc';
import { cameraFollowPosition } from '../logic/ArenaLogic';
import { MapManager } from '../systems/MapManager';

const { ccclass, property } = _decorator;

/** 게임 카메라를 플레이어에 따라 이동시키되 아레나 벽에서 클램프하는 컨트롤러. */
@ccclass('CameraController')
export class CameraController extends Component {
  /** 따라갈 플레이어 노드 */
  @property(Node) playerNode: Node | null = null;
  /** 고정 직교 투영 높이(px, 뷰 세로 절반). 코드에서 못박아 장비별 재fit(F9 churn)을 막는다. */
  @property orthoHeight: number = 360;

  private _camera: Camera | null = null;

  /** 카메라 뷰 세로 절반(px) — 직교 투영에서 orthoHeight가 곧 뷰 절반이다. */
  get viewHalfH(): number {
    return this.orthoHeight;
  }

  /**
   * 카메라 뷰 가로 절반(px). 창 종횡비에서 유도한다(프로젝트 설정이 FIXED_HEIGHT라 visibleSize의
   * 종횡비가 실제 창 종횡비와 일치한다). 창 크기를 못 읽거나 결과가 비유한값이면 **0**을 돌려주며,
   * 호출부는 그 프레임을 건너뛴다 — Infinity/NaN 좌표의 적은 죽지도 닿지도 사라지지도 않는다.
   * 유한성 검사를 결과에 직접 거는 이유는 `NaN <= 0`이 false라 크기 검사만으로는 새기 때문이다.
   */
  get viewHalfW(): number {
    const size = view.getVisibleSize();
    if (!(size.height > 0)) return 0;
    const half = this.orthoHeight * (size.width / size.height);
    return Number.isFinite(half) && half > 0 ? half : 0;
  }

  onLoad() {
    this._camera = this.getComponent(Camera);
    if (!this.playerNode || !this._camera) {
      console.error('[CameraController] required properties not assigned');
      this.enabled = false;
      return;
    }
    // orthoHeight를 코드에서 고정 — 에디터/장비별 _orthoHeight 재계산(F9 churn)을 차단한다.
    this._camera.orthoHeight = this.orthoHeight;
  }

  // 플레이어 이동(update) 이후에 카메라를 팔로우·클램프한다 — lateUpdate로 늦춰 한 프레임 잔상을 막는다.
  lateUpdate() {
    if (!this.playerNode) return;
    const arena = MapManager.instance?.arena;
    if (!arena || arena.width <= 0) return;

    // 창 크기를 못 읽음 — 이번 프레임만 건너뛴다. `NaN <= 0`은 false라 그냥 통과하므로 비교를 뒤집는다.
    const viewHalfW = this.viewHalfW;
    if (!(viewHalfW > 0)) return;
    const viewHalfH = this.viewHalfH;

    const p = this.playerNode.position;
    const cam = cameraFollowPosition({ x: p.x, y: p.y }, viewHalfW, viewHalfH, arena);
    this.node.setPosition(cam.x, cam.y, this.node.position.z);
  }
}
