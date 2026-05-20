import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';
import { GameState } from '../data/GameTypes';
import { GameManager } from './GameManager';
import { EnemyController } from '../components/EnemyController';

const { ccclass, property } = _decorator;

/** 주기적으로 적을 스폰하는 시스템 */
@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
  /** 적 프리팹 (인스펙터에서 연결) */
  @property(Prefab) enemyPrefab: Prefab | null = null;
  /** 플레이어 노드 (인스펙터에서 연결) */
  @property(Node) playerNode: Node | null = null;
  /** 스폰 간격 (sec) */
  @property spawnInterval: number = 2;
  /** 동시에 존재할 수 있는 최대 적 수 */
  @property maxEnemies: number = 10;

  /** 플레이어로부터 스폰되는 거리 (units) */
  private readonly _spawnRadius: number = 450;
  private _spawnTimer: number = 0;

  onLoad() {
    if (!this.enemyPrefab) { console.error('[EnemySpawner] enemyPrefab not assigned'); return; }
    if (!this.playerNode) { console.error('[EnemySpawner] playerNode not assigned'); return; }
  }

  update(dt: number) {
    if (GameManager.instance.state !== GameState.Playing) return;

    this._spawnTimer -= dt;
    if (this._spawnTimer > 0) return;
    if (GameManager.instance.enemies.length >= this.maxEnemies) return;

    this._spawnTimer = this.spawnInterval;
    this._spawnEnemy();
  }

  private _spawnEnemy(): void {
    if (!this.enemyPrefab || !this.playerNode) return;

    // 플레이어 주변 원 위 랜덤 각도에 스폰
    const angle = Math.random() * Math.PI * 2;
    const spawnPos = new Vec3(
      this.playerNode.worldPosition.x + Math.cos(angle) * this._spawnRadius,
      this.playerNode.worldPosition.y + Math.sin(angle) * this._spawnRadius,
      0,
    );

    const enemy = instantiate(this.enemyPrefab);
    this.node.addChild(enemy);
    enemy.setWorldPosition(spawnPos);
    enemy.getComponent(EnemyController)!.playerNode = this.playerNode;
  }
}
