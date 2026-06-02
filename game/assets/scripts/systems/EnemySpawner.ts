import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import { EnemyController } from '../components/EnemyController';
import { GameState } from '../data/GameTypes';
import { GameManager } from './GameManager';
import { WaveManager } from './WaveManager';

const { ccclass, property } = _decorator;

/** 주기적으로 적을 스폰하는 시스템 */
@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
  /** 적 프리팹 (인스펙터에서 연결) */
  @property(Prefab) enemyPrefab: Prefab | null = null;
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

  // 필수 프로퍼티를 검증하고(실패 시 비활성화) 스폰 부모로 쓸 Canvas 참조를 캐시한다
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
    }
  }

  // 스폰 타이머가 차면 웨이브 스케일링(최대 적 수↑·간격↓) 한도 내에서 적 1마리를 스폰한다
  update(dt: number) {
    if (!GameManager.instance) return;
    if (GameManager.instance.state !== GameState.Playing) return;

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
    this._spawnEnemy();
  }

  /** 플레이어 주변 랜덤 위치에 적을 스폰하고 추적 대상을 설정한다. */
  private _spawnEnemy(): void {
    if (!this.enemyPrefab || !this.playerNode || !this._canvas) return;

    const angle = Math.random() * Math.PI * 2;
    const spawnPos = new Vec3(
      this.playerNode.position.x + Math.cos(angle) * this._spawnRadius,
      this.playerNode.position.y + Math.sin(angle) * this._spawnRadius,
      0,
    );

    const enemy = instantiate(this.enemyPrefab);
    this._canvas.addChild(enemy);
    enemy.setPosition(spawnPos);
    const enemyCtrl = enemy.getComponent(EnemyController);
    if (!enemyCtrl) return;
    enemyCtrl.playerNode = this.playerNode;
  }
}
