import { _decorator, Color, Component, Graphics } from 'cc';
import { DataManager } from '../systems/DataManager';
import { MapManager } from '../systems/MapManager';

const { ccclass, property } = _decorator;

/**
 * MapManager의 물 구역 폴리곤을 같은 노드의 Graphics로 반투명 파랑 채움으로 그린다. 물 구역은 정적이라
 * 맵 데이터 준비 시점에 1회만 그린다(매 프레임 비용 없음). 해저드 판정과 화면에 보이는 물이 같은
 * `regions` 데이터에서 나오므로 100% 일치한다. 최종 강 아트(F41) 전까지 이 채움이 강 그림 역할을 한다.
 *
 * 이 노드는 게임 Canvas 아래 DEFAULT 레이어여야 한다 — UI_2D로 새면 고정 UICamera가 다른 배율로 그려
 * 강이 카메라를 안 따라가고 엉뚱한 곳에 찍힌다(F47). 레이어는 에디터 세팅으로 보장한다(QA 문서 §4).
 */
@ccclass('RegionRenderer')
export class RegionRenderer extends Component {
  /** 물 채움 색(반투명 파랑). 알파·색조 시인성은 7단계에서 조정한다. */
  @property(Color)
  fillColor: Color = new Color(60, 130, 200, 120);

  start() {
    const dm = DataManager.instance;
    if (!dm) {
      console.error(
        '[RegionRenderer] DataManager 없음 — 물을 그릴 수 없습니다. 씬 배선을 확인하세요.',
      );
      this.enabled = false;
      return;
    }
    // 콜백은 씬을 넘어 살아남을 수 있으므로(로딩 중 재시작) 발화 시점에 자신이 유효한지 확인한다.
    dm.onReady(() => {
      if (!this.isValid) return;
      // MapManager도 같은 onReady에서 regions를 채운다. 두 콜백의 발화 순서는 컴포넌트 start 순서에
      // 달려 보장되지 않으므로, 한 프레임 미뤄 regions가 채워진 뒤 그린다 — 안 그러면 MapManager가
      // 나중에 돌 때 빈 물(아무것도 안 그려짐)이 남는다.
      this.scheduleOnce(() => {
        if (this.isValid) this._draw();
      }, 0);
    });
  }

  /** 물 구역 폴리곤들을 Graphics 반투명 채움으로 그린다(1회). */
  private _draw(): void {
    const g = this.getComponent(Graphics);
    if (!g) {
      console.error('[RegionRenderer] Graphics 컴포넌트 없음 — 같은 노드에 Graphics를 붙이세요.');
      return;
    }
    const mm = MapManager.instance;
    if (!mm) {
      console.error('[RegionRenderer] MapManager 없음 — 물 구역을 읽을 수 없습니다.');
      return;
    }
    g.clear();
    g.fillColor = this.fillColor;
    const regions = mm.regions;
    let drawn = false;
    for (let i = 0; i < regions.length; i++) {
      const poly = regions[i].poly;
      if (poly.length < 3) continue;
      g.moveTo(poly[0][0], poly[0][1]);
      for (let v = 1; v < poly.length; v++) {
        g.lineTo(poly[v][0], poly[v][1]);
      }
      g.close();
      drawn = true;
    }
    // 여러 폴리곤을 하나의 fill로 채운다(각 폴리곤은 close로 분리된 서브패스). 그릴 게 없으면 건너뛴다.
    if (drawn) g.fill();
  }
}
