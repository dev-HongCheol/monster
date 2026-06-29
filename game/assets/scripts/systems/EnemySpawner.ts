import { _decorator, Component, Node, Prefab, Vec3 } from 'cc';
import { EnemyController, type FireProjectileFn } from '../components/EnemyController';
import { EnemyProjectile } from '../components/EnemyProjectile';
import { PoolManager } from '../components/PoolManager';
import { GameState } from '../data/GameTypes';
import { SpawnDirectorLogic } from '../logic/SpawnDirectorLogic';
import { DataManager } from './DataManager';
import { GameManager } from './GameManager';
import { WaveManager } from './WaveManager';

const { ccclass, property } = _decorator;

/** 주기적으로 적을 스폰하는 시스템 */
@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
  /** 적 프리팹 (인스펙터에서 연결) */
  @property(Prefab) enemyPrefab: Prefab | null = null;
  /** 적 발사체 프리팹 (인스펙터에서 연결 — 미연결 시 발사체 적은 발사하지 않음) */
  @property(Prefab) enemyBulletPrefab: Prefab | null = null;
  /** 플레이어 노드 (인스펙터에서 연결) */
  @property(Node) playerNode: Node | null = null;
  /** 웨이브당 기본 스폰 간격 (sec) */
  @property spawnInterval: number = 2;
  /** 동시에 존재할 수 있는 최대 적 수 */
  @property maxEnemies: number = 20;
  /** 웨이브마다 추가되는 최대 적 수 */
  @property enemiesPerWaveScale: number = 4;
  /** 웨이브마다 줄어드는 스폰 간격 (sec) */
  @property intervalReductionPerWave: number = 0.5;
  /** 스폰 간격 최솟값 (sec) */
  @property minSpawnInterval: number = 0.05;

  private readonly _spawnRadius: number = 350;
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
    if (!this.enemyPrefab || !this.playerNode) {
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

  // 스폰 타이머가 차면 웨이브 스케일링(최대 적 수↑·간격↓) 한도 내에서 적 1마리를 스폰한다
  update(dt: number) {
    if (!GameManager.instance) return;
    if (GameManager.instance.state !== GameState.Playing) return;
    // 스폰 테이블 로드 전이면 보류(타이머 유지) — 데이터 준비 후 디렉터 생성
    if (!this._ensureDirector()) return;

    this._spawnTimer -= dt;
    if (this._spawnTimer > 0) return;

    const wave = WaveManager.instance.waveNumber;
    const maxEnemies = this.maxEnemies + (wave - 1) * this.enemiesPerWaveScale;
    if (GameManager.instance.enemies.length >= maxEnemies) return;

    const interval = Math.max(
      this.minSpawnInterval,
      this.spawnInterval - (wave - 1) * this.intervalReductionPerWave,
    );
    this._spawnTimer = interval;
    this._spawnEnemy(wave);
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
   * 플레이어 주변 랜덤 위치에 적을 스폰하고, 디렉터가 고른 종류·추적 대상을 설정한다.
   * @param wave 현재 웨이브 (스폰 디렉터의 종류 선택 게이팅에 사용)
   */
  private _spawnEnemy(wave: number): void {
    if (!this.playerNode || !this._director || !this._enemyPool) return;

    const angle = Math.random() * Math.PI * 2;
    const spawnPos = new Vec3(
      this.playerNode.position.x + Math.cos(angle) * this._spawnRadius,
      this.playerNode.position.y + Math.sin(angle) * this._spawnRadius,
      0,
    );

    const enemyId = this._director.selectEnemyId(wave, Math.random());
    // 풀에서 적을 꺼낸다(가용분 재사용 또는 신규 instantiate). acquire가 Canvas 부착·active=true까지
    // 보장하므로, 종류별 데이터·연출 상태는 acquire 직후 reset()이 매번 새로 적용한다(잔류 방지).
    const enemy = this._enemyPool.acquire();
    enemy.setPosition(spawnPos);
    const enemyCtrl = enemy.getComponent(EnemyController);
    if (!enemyCtrl) {
      this._enemyPool.release(enemy);
      return;
    }
    enemyCtrl.reset(enemyId, this.playerNode, this._releaseEnemy, this._fireEnemyProjectile);
  }
}
