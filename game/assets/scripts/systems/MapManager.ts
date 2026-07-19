import { _decorator, Component, Node, resources, Sprite, SpriteFrame, UITransform } from 'cc';
import { CircleObstacle } from '../components/CircleObstacle';
import type { IMapData } from '../data/GameTypes';
import type { Arena } from '../logic/ArenaLogic';
import type { Obstacle } from '../logic/ObstacleLogic';
import type { WaterRegion } from '../logic/RegionLogic';
import { DataManager } from './DataManager';

const { ccclass, property } = _decorator;

/** 장애물 한 변 상한(px) — D4(방 금지): 넘으면 우회 지연이 길어져 유클리드 교전 반경 근사가 깨진다. */
const MAX_OBSTACLE_SIDE = 300;
/**
 * 장애물 한 변(원은 지름) 하한(px, F55) — 이보다 얇으면 고속 dt에서 관통 위험이 생긴다.
 * `resolveCircleMove`의 서브스텝 상한 길이가 맵(4800)에선 ~106px라, 확장 두께(변 + 2×최소 반지름)가
 * 그보다 얇으면 한 프레임에 건너뛴다. 최소 반지름 18 기준 변 120px이면 확장 두께 156px > 106px로 안전.
 * 하드 차단이 아니라 경고다(MAX와 같은 성격 — 배치 실수를 눈에 띄게).
 */
const MIN_OBSTACLE_SIDE = 120;
/**
 * 장애물끼리·아레나 벽과의 최소 통행 간격(px, 잠정 — 7단계 체감으로 확정, 계획 §2.1).
 * 좁으면 복도·막힌 방이 생겨 D4가 깨지고, 해소 로직의 "동시 접촉 없음" 전제(서브스텝당
 * 1패스 정확성)도 무너진다.
 */
const MIN_OBSTACLE_GAP = 200;

/** 활성 맵 데이터로 아레나 크기와 배경을 구성하는 싱글톤. 아레나 크기의 단일 출처다. */
@ccclass('MapManager')
export class MapManager extends Component {
  /** 씬 리로드 시 onDestroy가 null로 되돌리므로 정직하게 nullable이다 (싱글톤 컨벤션 참고). */
  static instance: MapManager | null = null;

  /** 배경 스프라이트 — 아레나 크기에 맞춰 리사이즈되고, 맵 배경 이미지가 있으면 교체된다. */
  @property(Sprite) backdropSprite: Sprite | null = null;

  /** 장애물 루트 노드 — 자식 박스들이 시각이자 충돌 출처다(에디터 배치, 계획 §2.2). */
  @property(Node) obstaclesRoot: Node | null = null;

  private _arena: Arena = { width: 0, height: 0 };
  private _regions: WaterRegion[] = [];
  private _obstacles: Obstacle[] = [];

  /** 원점(0,0) 중심 아레나 크기. 데이터 로드 전에는 {0,0}이라 소비처가 가드한다. */
  get arena(): Arena {
    return this._arena;
  }

  /** 원점 중심 물 구역(소프트 해저드). 데이터에 없으면 빈 배열 — 소비처가 무해저드가 된다. */
  get regions(): readonly WaterRegion[] {
    return this._regions;
  }

  /** 원점 중심 장애물 목록(사각형·원 혼합). 씬 색인 전에는 빈 배열 — 소비처가 무장애물이 된다. */
  get obstacles(): readonly Obstacle[] {
    return this._obstacles;
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
    this._applyRegions(map);
    this._indexObstacles();
    this._sizeBackdrop(map.size[0], map.size[1]);
    this._loadBackdrop(map.backdrop);
  }

  /**
   * 씬 장애물 노드들을 AABB로 색인한다(맵 로드 시 1회 — 장애물은 정적이라 핫패스에서 재색인하지
   * 않는다). 충돌 좌표를 손으로 적는 대신 노드의 위치·UITransform 크기에서 유도하므로, 에디터에서
   * 노드를 옮기면 충돌이 따라온다 — 시각과 충돌이 같은 출처라 어긋날 수 없다(계획 §2.2).
   * 배치 실수는 색인을 유지한 채 경고로 드러낸다 — 장애물은 게임 성립의 필수 요소가 아니라서
   * HUD처럼 없으면 화면이 깨지는 배선과 실패 비용이 다르기 때문에 enabled=false까지는 하지 않는다.
   */
  private _indexObstacles(): void {
    const out: Obstacle[] = [];
    const root = this.obstaclesRoot;
    if (!root) {
      // 조용히 삼키면 7단계 배선 실수가 "장애물이 안 막히는데 에러도 없음"으로 샌다 — 소리는 낸다.
      console.warn(
        '[MapManager] obstaclesRoot 미연결 — 장애물 없이 진행합니다. 씬 배선을 확인하세요.',
      );
      this._obstacles = out;
      return;
    }
    // 루트 자체의 scale/angle은 색인에 반영되지 않는다 — 루트를 변형하면 그림 전체가 옮겨지는데
    // 충돌은 원래 자리라 전 장애물이 한꺼번에 어긋난다. 기본값이 아니면 소리를 낸다.
    if (root.scale.x !== 1 || root.scale.y !== 1 || root.angle !== 0) {
      console.warn(
        `[MapManager] 장애물 루트 '${root.name}'의 scale/angle이 기본값이 아닙니다 — ` +
          '색인이 무시하므로 그림과 충돌이 어긋납니다. 루트는 scale (1,1)·angle 0으로 두세요.',
      );
    }
    const arenaHalfW = this._arena.width / 2;
    const arenaHalfH = this._arena.height / 2;
    const rootPos = root.position;
    const children = root.children;
    const names: string[] = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      // 비활성 노드는 렌더가 꺼져 있으므로 충돌도 함께 꺼야 시각=충돌 일치가 유지된다 — 색인하면
      // 그림 없는 자리에서 막히는 투명 벽이 된다(F47과 같은 증상). 의도적 끄기라 경고는 내지 않는다.
      if (!child.activeInHierarchy) continue;
      const tr = child.getComponent(UITransform);
      if (!tr || tr.width <= 0 || tr.height <= 0) {
        console.warn(`[MapManager] 장애물 '${child.name}' UITransform 없음/크기 0 — 건너뜁니다.`);
        continue;
      }
      // 마커 컴포넌트 유무로 형태를 가른다 — 있으면 원(r = width/2), 없으면 사각형(기본값).
      const isCircle = child.getComponent(CircleObstacle) !== null;
      // 색인은 contentSize만 읽고 스케일을 곱하지 않는다 — 크기 출처가 ContentSize·Scale 둘로
      // 갈라지면 스케일로 키운 장애물이 그림보다 작게 막혀 "보이는 벽의 절반만 단단한" 어긋남이
      // 조용히 생긴다. 어긋난 배치는 경고로 드러낸다(QA 레시피: 크기는 ContentSize로만).
      const scale = child.scale;
      if (scale.x !== 1 || scale.y !== 1) {
        console.warn(
          `[MapManager] 장애물 '${child.name}' scale (${scale.x}, ${scale.y}) ≠ (1, 1) — ` +
            '색인은 ContentSize 기준입니다. 크기는 ContentSize로만 조절하세요.',
        );
      }
      // 회전은 사각형에서만 문제다 — 그림은 돌아가는데 충돌은 축정렬(AABB)로 남아 모서리 근처에서
      // 어긋난다. 원은 회전 불변이라(돌려도 같은 원) 경고하지 않는다.
      if (!isCircle && child.angle !== 0) {
        console.warn(
          `[MapManager] 장애물 '${child.name}' angle ${child.angle}° — 충돌은 축정렬이라 회전이 반영되지 않습니다. angle 0으로 두세요.`,
        );
      }
      // 원은 정사각 노드라야 r = width/2가 명확하다 — width ≠ height면 그림은 타원인데 충돌은
      // width/2 원이라 어긋난다.
      if (isCircle && tr.width !== tr.height) {
        console.warn(
          `[MapManager] 원 장애물 '${child.name}' 크기 ${tr.width}×${tr.height} 비정사각 — ` +
            'r = width/2로 색인합니다. 원은 정사각(width = height)으로 두세요.',
        );
      }
      // 루트가 원점(권장 배치)이 아니어도 자식 중심이 아레나 좌표가 되도록 루트 오프셋을 더하고,
      // 앵커가 (0.5,0.5)가 아니면 그림의 실제 중심에 맞춰 보정한다 — 안 하면 그림과 충돌이 어긋난다.
      const cx = rootPos.x + child.position.x + tr.width * (0.5 - tr.anchorX);
      const cy = rootPos.y + child.position.y + tr.height * (0.5 - tr.anchorY);
      const halfW = tr.width / 2;
      const halfH = tr.height / 2;
      // 유도값이 비유한이면(엔진 손상·씬 파일 수동 편집으로만 도달하는 미발현 경로) 색인에 넣지
      // 않는다 — 넣으면 resolveCircleMove의 거리 비교가 NaN으로 새서 이동 주체 위치가 오염된다(F50).
      // from·to·radius는 이미 핫패스에서 가드되지만 장애물 항목은 무방비라, 데이터 경계에서 막는다.
      if (
        !Number.isFinite(cx) ||
        !Number.isFinite(cy) ||
        !Number.isFinite(halfW) ||
        !Number.isFinite(halfH)
      ) {
        console.warn(`[MapManager] 장애물 '${child.name}' 좌표/크기가 비유한 — 건너뜁니다(F50).`);
        continue;
      }
      if (tr.width > MAX_OBSTACLE_SIDE || tr.height > MAX_OBSTACLE_SIDE) {
        console.warn(
          `[MapManager] 장애물 '${child.name}' 크기 ${tr.width}×${tr.height} — 한 변 ` +
            `${MAX_OBSTACLE_SIDE}px 초과(D4). 우회 지연이 길어져 교전 반경 근사가 깨집니다.`,
        );
      }
      // 하한 미달(F55) — 얇은 장애물은 고속 dt에서 서브스텝이 건너뛸 수 있다. 두 축을 다 보는
      // 바운딩 박스 검사다(정사각 원이면 곧 지름이고, 비정사각 원은 이미 위에서 경고된다).
      if (tr.width < MIN_OBSTACLE_SIDE || tr.height < MIN_OBSTACLE_SIDE) {
        console.warn(
          `[MapManager] 장애물 '${child.name}' 크기 ${tr.width}×${tr.height} — 한 변(원은 지름) ` +
            `${MIN_OBSTACLE_SIDE}px 미만. 고속 이동에서 관통 위험이 생깁니다(F55).`,
        );
      }
      const wallGapX = arenaHalfW - (Math.abs(cx) + halfW);
      const wallGapY = arenaHalfH - (Math.abs(cy) + halfH);
      if (wallGapX < 0 || wallGapY < 0) {
        console.warn(
          `[MapManager] 장애물 '${child.name}'이 아레나 경계(±${arenaHalfW}×±${arenaHalfH}) 밖입니다 — 배치를 확인하세요.`,
        );
      } else if (Math.min(wallGapX, wallGapY) < MIN_OBSTACLE_GAP) {
        console.warn(
          `[MapManager] 장애물 '${child.name}'과 아레나 벽 사이 통행 간격이 ${MIN_OBSTACLE_GAP}px 미만 — 좁은 복도가 생깁니다(§2.1).`,
        );
      }
      names.push(child.name);
      out.push(
        isCircle ? { kind: 'circle', cx, cy, r: halfW } : { kind: 'rect', cx, cy, halfW, halfH },
      );
    }
    this._warnNarrowGaps(out, names);
    this._obstacles = out;
  }

  /**
   * 장애물끼리의 통행 간격이 MIN_OBSTACLE_GAP 미만인 쌍을 경고한다(색인은 유지 — 배치 실수를
   * 눈에 띄게). 간격은 축별 분리 거리의 최대값 max(sepX, sepY)로 잰다 — 통로 폭의 **보수적
   * 하한**이다. 대각으로 어긋난 배치에선 실제 최단 간격(√(sepX²+sepY²))이 이보다 넓어 경고가
   * 과하게 울릴 수 있다 — 놓치는 쪽보다 과경고 쪽으로 기울인 선택이다.
   * @param rects 색인된 장애물 목록(사각형·원 혼합 — 원은 반지름을 반너비·반높이로 본다)
   * @param names rects와 같은 순서의 노드 이름 (경고 메시지용)
   */
  private _warnNarrowGaps(rects: readonly Obstacle[], names: readonly string[]): void {
    // 원은 바운딩 박스(반너비=반높이=r)로 근사해 사각형과 같은 축별 간격 척도로 잰다 — 통로 폭의
    // 보수적 하한이라 원끼리는 실제보다 좁게 볼 수 있으나, 놓치는 쪽보다 과경고 쪽으로 기운다.
    const halfW = (ob: Obstacle): number => (ob.kind === 'circle' ? ob.r : ob.halfW);
    const halfH = (ob: Obstacle): number => (ob.kind === 'circle' ? ob.r : ob.halfH);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const sepX = Math.abs(a.cx - b.cx) - (halfW(a) + halfW(b));
        const sepY = Math.abs(a.cy - b.cy) - (halfH(a) + halfH(b));
        const gap = Math.max(sepX, sepY);
        if (gap < MIN_OBSTACLE_GAP) {
          console.warn(
            `[MapManager] 장애물 '${names[i]}'·'${names[j]}' 통행 간격 ${Math.round(gap)}px < ` +
              `${MIN_OBSTACLE_GAP}px — 복도·막힌 방이 생겨 D4가 깨집니다(§2.1).`,
          );
        }
      }
    }
  }

  /**
   * 맵 데이터의 물 구역을 검증해 런타임 형태(WaterRegion)로 보관한다. 없거나 전부 무효면 빈 배열이라
   * 소비처(PlayerController·RegionRenderer)가 자연히 무해저드가 된다. 검증은 맵 로드 시 1회만 돈다.
   */
  private _applyRegions(map: IMapData): void {
    const out: WaterRegion[] = [];
    const src = map.regions;
    if (src) {
      const halfW = map.size[0] / 2;
      const halfH = map.size[1] / 2;
      for (let i = 0; i < src.length; i++) {
        const r = src[i];
        // 구역 항목이 null이거나(예: "regions":[null]) poly가 배열이 아니거나(JSON 오타·누락 —
        // DataManager는 as T라 런타임 미검증) 정점 3개 미만이면 건너뛰고 알린다. null·배열 확인을
        // 먼저 하지 않으면 역참조가 throw하고, 그 예외가 DataManager._loadAll의 try에 삼켜져
        // 남은 초기화(이동·웨이브·마법)를 통째로 취소한다.
        if (!r || !Array.isArray(r.poly) || r.poly.length < 3) {
          console.warn(
            `[MapManager] 물 구역 #${i} 항목/poly 무효(정점 3개 미만 포함) — 건너뜁니다.`,
          );
          continue;
        }
        // 누락된 배율을 조용히 감속으로 적용하지 않는다 — 의도적 0.5와 누락(무효과)을 구분해 크게 알린다.
        let mul = r.playerSpeedMul;
        if (mul === undefined) {
          console.warn(
            `[MapManager] 물 구역 #${i} playerSpeedMul 누락 — 1.0(무감속)으로 폴백합니다.`,
          );
          mul = 1;
        }
        // 폴리곤 좌표는 size와 같은 원점 중심 공간이라 둘을 함께 맞춰야 한다. 정점이 경계 밖이면
        // size만 키우고 폴리곤을 안 고친 것 — 강이 좌우 강안에 못 닿고 맵 가운데로 뜬다.
        if (this._hasVertexOutside(r.poly, halfW, halfH)) {
          console.warn(
            `[MapManager] 물 구역 #${i} 정점이 아레나 경계 밖입니다(size ${map.size[0]}×${map.size[1]}). ` +
              '폴리곤과 size를 함께 맞추세요 — 강이 맵 가운데로 뜹니다.',
          );
        }
        out.push({ poly: r.poly, playerSpeedMul: mul });
      }
    }
    this._regions = out;
  }

  /** 폴리곤 정점 중 하나라도 아레나 경계(±halfW/±halfH) 밖이면 true. */
  private _hasVertexOutside(
    poly: readonly (readonly [number, number])[],
    halfW: number,
    halfH: number,
  ): boolean {
    for (let i = 0; i < poly.length; i++) {
      if (Math.abs(poly[i][0]) > halfW || Math.abs(poly[i][1]) > halfH) return true;
    }
    return false;
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
