import { _decorator, Component, Node, Prefab, Vec3 } from 'cc';
import { CameraController } from '../components/CameraController';
import { EnemyController, type FireProjectileFn } from '../components/EnemyController';
import { EnemyProjectile } from '../components/EnemyProjectile';
import { PoolManager } from '../components/PoolManager';
import { GameState } from '../data/GameTypes';
import type { Arena } from '../logic/ArenaLogic';
import { SpawnDirectorLogic } from '../logic/SpawnDirectorLogic';
import {
  canSpawn,
  clampRecycleDistance,
  classifyByDistance,
  engagementRadius,
  offViewSpawnPoint,
  type SpawnField,
  spawnPerimeterLength,
} from '../logic/SpawnGeometry';
import { DataManager } from './DataManager';
import { GameManager } from './GameManager';
import { MapManager } from './MapManager';
import { WaveManager } from './WaveManager';

const { ccclass, property } = _decorator;

/** 아레나 데이터가 없을 때 쓰는 빈 아레나 — 이때 스폰은 뷰 사각 둘레에서만 뽑는다. */
const NO_ARENA: Arena = { width: 0, height: 0 };

/** 주기적으로 적을 카메라 뷰 밖에서 스폰하고, 너무 멀어진 적을 풀로 회수하는 시스템 */
@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
  /** 적 프리팹 (인스펙터에서 연결) */
  @property(Prefab) enemyPrefab: Prefab | null = null;
  /** 적 발사체 프리팹 (인스펙터에서 연결 — 미연결 시 발사체 적은 발사하지 않음) */
  @property(Prefab) enemyBulletPrefab: Prefab | null = null;
  /** 플레이어 노드 (인스펙터에서 연결) */
  @property(Node) playerNode: Node | null = null;
  /** 게임 카메라의 컨트롤러 (인스펙터에서 연결) — 뷰 크기·위치의 단일 출처 */
  @property(CameraController) cameraController: CameraController | null = null;
  /** 웨이브당 기본 스폰 간격 (sec) */
  @property spawnInterval: number = 2;
  /** 교전 중인 적(교전 반경 안)의 상한 — 도착하지 못한 적은 여기 세지 않는다 */
  @property maxEnemies: number = 20;
  /** 이동 중인 적(교전 반경 밖)의 상한 — 파이프라인 무제한 증식을 막는 성능 상한 */
  @property maxInbound: number = 25;
  /** 웨이브마다 추가되는 최대 적 수 */
  @property enemiesPerWaveScale: number = 4;
  /** 웨이브마다 줄어드는 스폰 간격 (sec) */
  @property intervalReductionPerWave: number = 0.5;
  /** 스폰 간격 최솟값 (sec) */
  @property minSpawnInterval: number = 0.05;
  /** 화면 밖 여유 (px) — 적 몸통이 화면 안에서 태어나지 않도록 하는 계약. 하한 클램프됨 */
  @property spawnMargin: number = 100;
  /** 이 거리를 넘어간 적을 풀로 회수한다 (px). 최대 스폰 거리 위로 클램프됨 */
  @property recycleDistance: number = 2200;

  private _spawnTimer: number = 0;
  private _canvas: Node | null = null;
  /** 웨이브별 적 종류 선택 디렉터. 데이터 로드 후 첫 스폰 시점에 생성 */
  private _director: SpawnDirectorLogic | null = null;
  /** 적 노드 재사용 풀 (onLoad에서 enemyPrefab/Canvas로 생성). */
  private _enemyPool: PoolManager | null = null;
  /** 적 반환 콜백 — 매 스폰마다 closure를 새로 만들지 않도록 1회 바인딩해 재사용. */
  private readonly _releaseEnemy = (node: Node): void => {
    this._enemyPool?.release(node);
  };
  /** 이번 프레임 교전 반경 안에 있는 적 수 (_sweepEnemies가 매 프레임 갱신). */
  private _engaged: number = 0;
  /** 이번 프레임 교전 반경 밖에서 걸어오는 중인 적 수 (_sweepEnemies가 매 프레임 갱신). */
  private _inbound: number = 0;
  /** 유효 스폰 둘레가 0인 퇴화 맵을 이미 경고했는지 — 스폰 틱마다 쏟아지지 않도록 1회만 찍는다. */
  private _warnedDegenerate: boolean = false;
  /** 적 발사체 노드 재사용 풀 (영속 단일 소유자 — onLoad에서 생성). */
  private _enemyBulletPool: PoolManager | null = null;
  /** 적 발사체 반환 콜백 — 1회 바인딩해 재사용. */
  private readonly _releaseEnemyBullet = (node: Node): void => {
    this._enemyBulletPool?.release(node);
  };
  /**
   * 발사체 발사 위임 — 적(EnemyController)이 Fire 에지에서 호출한다. 풀에서 발사체를 꺼내
   * 위치·방향·속도·피해·반경·플레이어 대상·반환 콜백을 주입한다. 풀 미연결이면 무시한다.
   */
  private readonly _fireEnemyProjectile: FireProjectileFn = (
    origin,
    dirX,
    dirY,
    speed,
    damage,
    radius,
  ): void => {
    if (!this._enemyBulletPool || !this.playerNode) return;
    const bullet = this._enemyBulletPool.acquire();
    bullet.setPosition(origin.x, origin.y, 0);
    const proj = bullet.getComponent(EnemyProjectile);
    if (!proj) {
      this._enemyBulletPool.release(bullet);
      return;
    }
    proj.init(
      new Vec3(dirX, dirY, 0),
      speed,
      damage,
      radius,
      this.playerNode,
      this._releaseEnemyBullet,
    );
  };

  // 필수 프로퍼티를 검증하고(실패 시 비활성화) 스폰 부모로 쓸 Canvas 참조와 적 풀을 준비한다
  onLoad() {
    if (!this.enemyPrefab || !this.playerNode || !this.cameraController) {
      console.error('[EnemySpawner] required properties not assigned');
      this.enabled = false;
      return;
    }
    this._canvas = this.playerNode.parent;
    if (!this._canvas) {
      console.error('[EnemySpawner] Canvas not found');
      this.enabled = false;
      return;
    }
    this._enemyPool = new PoolManager(this.enemyPrefab, this._canvas);
    // 적 발사체 풀(선택) — 미연결이면 발사체 적이 발사만 못 할 뿐, 다른 적 스폰엔 영향 없다.
    if (this.enemyBulletPrefab) {
      this._enemyBulletPool = new PoolManager(this.enemyBulletPrefab, this._canvas);
    } else {
      console.warn('[EnemySpawner] enemyBulletPrefab not assigned — ranged enemies will not fire');
    }
  }

  // 멀어진 적을 회수하며 교전/이동 중 적을 집계하고, 스폰 타이머가 차면 두 상한 안에서 1마리 스폰한다
  update(dt: number) {
    const gm = GameManager.instance;
    const wm = WaveManager.instance;
    const cam = this.cameraController;
    if (!gm || !wm || !cam || !this.playerNode) return;
    if (gm.state !== GameState.Playing) return;
    // 스폰 테이블 로드 전이면 보류(타이머 유지) — 데이터 준비 후 디렉터 생성
    if (!this._ensureDirector()) return;

    // 창 크기를 못 읽으면 이번 프레임을 통째로 건너뛴다. 비교를 뒤집어 쓴 것은 NaN 때문이다 —
    // `NaN <= 0`은 false라 그냥 통과해 버리고, 그러면 normSize가 뷰 절반을 0으로 접어 스폰 사각형이
    // 여유 크기(100×100)로 쪼그라든다. 즉 적이 화면 안에서 스폰된다 — 이 슬라이스가 고친 바로 그 회귀다.
    const viewHalfW = cam.viewHalfW;
    if (!(viewHalfW > 0)) return;
    const viewHalfH = cam.viewHalfH;

    this._sweepEnemies(gm, viewHalfW, viewHalfH);

    this._spawnTimer -= dt;
    if (this._spawnTimer > 0) return;

    const wave = wm.waveNumber;
    const maxEngaged = this.maxEnemies + (wave - 1) * this.enemiesPerWaveScale;
    // 압박 상한은 교전 중인 적만 센다 — 도착하지 못한 적이 상한을 먹으면 구석에 붙어 있는 것만으로
    // 신규 스폰이 멈춘다(구석 캠핑 악용). 이동 중인 적은 별도 상한(maxInbound)으로 막는다.
    if (!canSpawn(this._engaged, this._inbound, maxEngaged, this.maxInbound)) return;

    const interval = Math.max(
      this.minSpawnInterval,
      this.spawnInterval - (wave - 1) * this.intervalReductionPerWave,
    );
    this._spawnTimer = interval;
    this._spawnEnemy(wave, viewHalfW, viewHalfH);
  }

  /** 디렉터를 보장한다. 데이터 미로드면 false(스폰 보류). 최초 1회만 생성. */
  private _ensureDirector(): boolean {
    if (this._director) return true;
    const dm = DataManager.instance;
    if (!dm?.isReady) return false;
    this._director = new SpawnDirectorLogic(dm.spawnTable);
    return true;
  }

  /**
   * 활성 적을 한 번 훑어 (a) 재활용 거리를 넘은 적을 풀로 회수하고 (b) 교전/이동 중 적 수를 집계한다.
   * 회수는 목록을 변형하므로 **역순 순회**로 인덱스가 밀리지 않게 한다. 매 프레임 도는 경로라
   * 할당 없이 제곱 거리로만 비교한다.
   * @param gm 활성 적 목록 소유자
   * @param viewHalfW 카메라 뷰 가로 절반(px)
   * @param viewHalfH 카메라 뷰 세로 절반(px)
   */
  private _sweepEnemies(gm: GameManager, viewHalfW: number, viewHalfH: number): void {
    this._engaged = 0;
    this._inbound = 0;
    if (!this.playerNode) return;

    // 매 프레임 재계산한다 — 셋 다 @property라 7단계에서 인스펙터로 조이는 값이고, 캐시하면
    // 조정이 반영되지 않는다. hypot 두 번은 프레임당 비용으로 잡히지 않는다.
    const engageSq = engagementRadius(viewHalfW, viewHalfH, this.spawnMargin) ** 2;
    const recycleSq =
      clampRecycleDistance(this.recycleDistance, viewHalfW, viewHalfH, this.spawnMargin) ** 2;
    const p = this.playerNode.position;

    const enemies = gm.enemies;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (!enemy?.isValid) continue;
      const pos = enemy.node.position;
      const dx = pos.x - p.x;
      const dy = pos.y - p.y;
      switch (classifyByDistance(dx * dx + dy * dy, engageSq, recycleSq)) {
        case 'recycle':
          enemy.recycle(); // 사망이 아니다 — XP·킬 집계·연출을 거치지 않고 곧장 풀로
          break;
        case 'engaged':
          this._engaged++;
          break;
        default:
          this._inbound++;
          break;
      }
    }
  }

  /**
   * 카메라 뷰 사각형 바깥(+ 아레나 안)에 적을 스폰하고, 디렉터가 고른 종류·추적 대상을 설정한다.
   * 기준은 플레이어가 아니라 **카메라**다 — 카메라는 벽에서 클램프되므로 플레이어가 벽에 붙으면
   * 플레이어는 화면 중앙이 아니고, 플레이어 기준으로 뽑으면 반대편 점이 화면 안에 들어온다.
   * @param wave 현재 웨이브 (스폰 디렉터의 종류 선택 게이팅에 사용)
   * @param viewHalfW 카메라 뷰 가로 절반(px)
   * @param viewHalfH 카메라 뷰 세로 절반(px)
   */
  private _spawnEnemy(wave: number, viewHalfW: number, viewHalfH: number): void {
    if (!this.playerNode || !this.cameraController || !this._director || !this._enemyPool) return;

    const enemyId = this._director.selectEnemyId(wave, Math.random());
    const radius = DataManager.instance?.getEnemy(enemyId)?.collisionRadius ?? 0;
    // 맵 데이터가 없으면(MapManager가 에러만 찍고 {0,0}으로 남기는 경로) 아레나 제약 없이 뷰 사각
    // 둘레에서만 뽑는다. 이 분기가 없으면 모든 계산이 원점으로 붕괴해 적이 전부 플레이어 몸 안에서
    // 스폰된다 — "시끄럽게 에러 찍고 플레이는 굴러간다"가 "플레이 불가"로 바뀐다.
    const arena = MapManager.instance?.arena ?? NO_ARENA;

    // 카메라 위치는 CameraController가 lateUpdate에서 쓴 것이라 여기서는 한 프레임 낡았다.
    // 최대 오차는 카메라 속도 × 1프레임(300px/s에서 ~5px)이라 여유(margin 100)가 통째로 흡수한다.
    // 재계산하지 않는 것이 더 중요하다 — 복제본을 들면 F42(카메라 스무딩)에서 말없이 어긋난다.
    const camPos = this.cameraController.node.position;
    const playerPos = this.playerNode.position;
    const field: SpawnField = {
      cam: { x: camPos.x, y: camPos.y },
      player: { x: playerPos.x, y: playerPos.y },
      viewHalfW,
      viewHalfH,
      margin: this.spawnMargin,
      arena,
      radius,
    };
    this._warnIfDegenerate(field);

    const spawn = offViewSpawnPoint(field, Math.random());

    // 풀에서 적을 꺼낸다(가용분 재사용 또는 신규 instantiate). acquire가 Canvas 부착·active=true까지
    // 보장하므로, 종류별 데이터·연출 상태는 acquire 직후 reset()이 매번 새로 적용한다(잔류 방지).
    const enemy = this._enemyPool.acquire();
    enemy.setPosition(new Vec3(spawn.x, spawn.y, 0));
    const enemyCtrl = enemy.getComponent(EnemyController);
    if (!enemyCtrl) {
      this._enemyPool.release(enemy);
      return;
    }
    enemyCtrl.reset(enemyId, this.playerNode, this._releaseEnemy, this._fireEnemyProjectile);
  }

  /**
   * 뷰 밖이면서 아레나 안인 지점이 아예 없는 맵(아레나가 뷰보다 작음)이면 경고한다.
   * 이때 스폰은 "플레이어에게서 가장 먼 아레나 안쪽 점"으로 폴백하므로 플레이는 굴러가지만,
   * 적이 화면 안에서 나타나므로 맵 크기가 잘못됐다는 사실은 드러나야 한다.
   *
   * 검사 자체는 스폰마다 한다(맵 교체·창 크기 변경으로 상태가 뒤집힐 수 있다). 경고 출력만 1회로
   * 잠근다 — 스폰 틱마다 콘솔이 쏟아지면 정작 다른 경고가 묻힌다. 스폰은 초당 0.5~2회라 비용은
   * 무시할 수준이다(계획 §4 — 스폰 경로 할당 최적화는 스코프 밖).
   */
  private _warnIfDegenerate(field: SpawnField): void {
    if (this._warnedDegenerate) return;
    if (spawnPerimeterLength(field) > 0) return;
    this._warnedDegenerate = true;
    console.warn(
      '[EnemySpawner] 아레나가 카메라 뷰보다 작아 화면 밖 스폰 지점이 없습니다 — ' +
        '가장 먼 아레나 안쪽 점으로 폴백합니다. 맵 크기를 확인하세요.',
    );
  }
}
