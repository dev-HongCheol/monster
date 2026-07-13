import { _decorator, Component, resources, Sprite, SpriteFrame, UITransform } from 'cc';
import type { Arena } from '../logic/ArenaLogic';
import { DataManager } from './DataManager';

const { ccclass, property } = _decorator;

/** 활성 맵 데이터로 아레나 크기와 배경을 구성하는 싱글톤. 아레나 크기의 단일 출처다. */
@ccclass('MapManager')
export class MapManager extends Component {
  /** 씬 리로드 시 onDestroy가 null로 되돌리므로 정직하게 nullable이다 (싱글톤 컨벤션 참고). */
  static instance: MapManager | null = null;

  /** 배경 스프라이트 — 아레나 크기에 맞춰 리사이즈되고, 맵 배경 이미지가 있으면 교체된다. */
  @property(Sprite) backdropSprite: Sprite | null = null;

  private _arena: Arena = { width: 0, height: 0 };

  /** 원점(0,0) 중심 아레나 크기. 데이터 로드 전에는 {0,0}이라 소비처가 가드한다. */
  get arena(): Arena {
    return this._arena;
  }

  onLoad() {
    MapManager.instance = this;
  }

  start() {
    const dm = DataManager.instance;
    if (!dm) {
      console.error(
        '[MapManager] DataManager 없음 — 아레나를 구성할 수 없습니다. 씬 배선을 확인하세요.',
      );
      this.enabled = false;
      return;
    }
    // 콜백은 씬을 넘어 살아남을 수 있으므로(로딩 중 재시작) 발화 시점에 자신이 유효한지 확인한다.
    dm.onReady(() => {
      if (!this.isValid) return;
      this._applyMap();
    });
  }

  onDestroy() {
    if (MapManager.instance === this) {
      MapManager.instance = null;
    }
  }

  /** 활성 맵 데이터로 아레나 크기를 세우고 배경을 구성한다. */
  private _applyMap(): void {
    // 클로저 안이라 start()의 내로잉이 살아남지 않는다 — 여기서 다시 받는다.
    const map = DataManager.instance?.mapData;
    if (!map) {
      // 조용히 빠지면 아레나가 {0,0}으로 남아 플레이어 클램프가 사라지고 발사체 컬링이
      // 화면 기준 폴백으로 되돌아간다(카메라 팔로우라 부정확). 눈에 보이게 알린다.
      console.error('[MapManager] 맵 데이터 없음 — 아레나가 구성되지 않았습니다.');
      return;
    }
    this._arena = { width: map.size[0], height: map.size[1] };
    this._sizeBackdrop(map.size[0], map.size[1]);
    this._loadBackdrop(map.backdrop);
  }

  /** 배경 노드를 아레나 크기에 맞춘다(placeholder도 아레나 전체를 덮도록). */
  private _sizeBackdrop(width: number, height: number): void {
    const tr = this.backdropSprite?.getComponent(UITransform);
    if (tr) tr.setContentSize(width, height);
  }

  /** 맵 배경 이미지를 best-effort로 로드해 교체한다. 없으면 씬 placeholder를 유지한다(아트 단계 전). */
  private _loadBackdrop(path: string): void {
    if (!this.backdropSprite) return;
    resources.load(`${path}/spriteFrame`, SpriteFrame, (err, frame) => {
      if (err || !frame || !this.node.isValid) return;
      if (this.backdropSprite) this.backdropSprite.spriteFrame = frame;
    });
  }
}
