import {
  _decorator,
  Component,
  type EventKeyboard,
  Input,
  input,
  instantiate,
  KeyCode,
  Node,
  Prefab,
  Vec3,
} from 'cc';
import { GameState } from '../data/GameTypes';
import { GameManager } from '../systems/GameManager';
import { Projectile } from './Projectile';

const { ccclass, property } = _decorator;

/** 플레이어 이동, 자동 사격, HP 연동을 담당하는 컴포넌트 */
@ccclass('PlayerController')
export class PlayerController extends Component {
  /** 발사체 프리팹 (인스펙터에서 연결) */
  @property(Prefab) bulletPrefab: Prefab | null = null;
  /** 발사체가 생성될 부모 노드 (인스펙터에서 연결) */
  @property(Node) bulletParent: Node | null = null;

  private _moveDir: Vec3 = new Vec3();
  private _attackTimer: number = 0;

  private _keyUp: boolean = false;
  private _keyDown: boolean = false;
  private _keyLeft: boolean = false;
  private _keyRight: boolean = false;

  onLoad() {
    if (!this.bulletPrefab || !this.bulletParent) {
      console.error('[PlayerController] required properties not assigned');
      this.enabled = false;
      return;
    }
    input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
  }

  onDestroy() {
    input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
  }

  update(dt: number) {
    if (GameManager.instance.state !== GameState.Playing) return;

    this._updateMoveDir();
    this._move(dt);
    this._updateAttack(dt);
  }

  /** 키 입력으로 이동 방향 플래그를 활성화한다. */
  private _onKeyDown(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.KEY_W || e.keyCode === KeyCode.ARROW_UP) this._keyUp = true;
    if (e.keyCode === KeyCode.KEY_S || e.keyCode === KeyCode.ARROW_DOWN) this._keyDown = true;
    if (e.keyCode === KeyCode.KEY_A || e.keyCode === KeyCode.ARROW_LEFT) this._keyLeft = true;
    if (e.keyCode === KeyCode.KEY_D || e.keyCode === KeyCode.ARROW_RIGHT) this._keyRight = true;
  }

  /** 키 해제로 이동 방향 플래그를 비활성화한다. */
  private _onKeyUp(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.KEY_W || e.keyCode === KeyCode.ARROW_UP) this._keyUp = false;
    if (e.keyCode === KeyCode.KEY_S || e.keyCode === KeyCode.ARROW_DOWN) this._keyDown = false;
    if (e.keyCode === KeyCode.KEY_A || e.keyCode === KeyCode.ARROW_LEFT) this._keyLeft = false;
    if (e.keyCode === KeyCode.KEY_D || e.keyCode === KeyCode.ARROW_RIGHT) this._keyRight = false;
  }

  /** 키 플래그 상태로 이동 방향 벡터를 계산한다. */
  private _updateMoveDir(): void {
    this._moveDir.set(
      (this._keyRight ? 1 : 0) - (this._keyLeft ? 1 : 0),
      (this._keyUp ? 1 : 0) - (this._keyDown ? 1 : 0),
      0,
    );
    // 대각선 이동 시 속도가 √2배 되는 것 방지
    if (this._moveDir.length() > 1) {
      this._moveDir.normalize();
    }
  }

  /** 이동 방향으로 플레이어를 이동시킨다. */
  private _move(dt: number): void {
    const { speed } = GameManager.instance.playerData;
    const pos = this.node.position;
    this.node.setPosition(
      pos.x + this._moveDir.x * speed * dt,
      pos.y + this._moveDir.y * speed * dt,
      pos.z,
    );
  }

  /** 공격 쿨다운을 갱신하고 쿨다운이 끝나면 가장 가까운 적을 공격한다. */
  private _updateAttack(dt: number): void {
    this._attackTimer -= dt;
    if (this._attackTimer > 0) return;

    const target = this._findNearestEnemy();
    if (!target) return;

    this._attackTimer = GameManager.instance.playerData.attackCooldown;
    this._shoot(target);
  }

  /** 활성 적 중 가장 가까운 적 노드를 반환한다. 없으면 null. */
  private _findNearestEnemy(): Node | null {
    const enemies = GameManager.instance.enemies;
    if (enemies.length === 0) return null;

    let nearest: Node | null = null;
    let minDist = Infinity;
    const myPos = this.node.position;

    for (const enemy of enemies) {
      if (!enemy?.isValid) continue;
      const dist = Vec3.distance(myPos, enemy.node.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = enemy.node;
      }
    }
    return nearest;
  }

  /**
   * 대상 방향으로 발사체를 생성하고 발사한다.
   * @param target 조준 대상 노드
   */
  private _shoot(target: Node): void {
    if (!this.bulletPrefab || !this.bulletParent) return;

    const dir = new Vec3();
    Vec3.subtract(dir, target.position, this.node.position);
    dir.normalize();

    const bullet = instantiate(this.bulletPrefab);
    this.bulletParent.addChild(bullet);
    bullet.setPosition(this.node.position);

    const { bulletSpeed, bulletDamage } = GameManager.instance.playerData;
    const projectile = bullet.getComponent(Projectile);
    if (!projectile) return;
    projectile.init(dir, bulletSpeed, bulletDamage);
  }
}
