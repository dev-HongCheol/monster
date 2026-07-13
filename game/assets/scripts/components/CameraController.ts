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

    const size = view.getVisibleSize();
    if (size.height <= 0) return;
    const viewHalfH = this.orthoHeight;
    const viewHalfW = viewHalfH * (size.width / size.height);

    const p = this.playerNode.position;
    const cam = cameraFollowPosition({ x: p.x, y: p.y }, viewHalfW, viewHalfH, arena);
    this.node.setPosition(cam.x, cam.y, this.node.position.z);
  }
}
