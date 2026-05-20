import { _decorator, Component, Vec3 } from 'cc';
import { GameManager } from '../systems/GameManager';

const { ccclass } = _decorator;

/** 플레이어가 발사하는 마법 발사체 */
@ccclass('Projectile')
export class Projectile extends Component {
  /** 이동 방향 (단위 벡터) */
  private _direction: Vec3 = new Vec3(0, 1, 0);
  private _speed: number = 500;
  private _damage: number = 25;
  /** 화면 경계 밖 판정 거리 (units) */
  private readonly _outOfBoundsLimit: number = 700;

  /**
   * 발사체를 초기화한다. instantiate 직후 반드시 호출해야 한다.
   * @param direction 이동 방향 (단위 벡터)
   * @param speed 이동 속도 (units/sec)
   * @param damage 적중 시 데미지
   */
  init(direction: Vec3, speed: number, damage: number): void {
    this._direction = direction.clone();
    this._speed = speed;
    this._damage = damage;
  }

  update(dt: number) {
    this._move(dt);
    this._checkEnemyHit();
    this._checkOutOfBounds();
  }

  private _move(dt: number): void {
    const pos = this.node.worldPosition;
    this.node.setWorldPosition(
      pos.x + this._direction.x * this._speed * dt,
      pos.y + this._direction.y * this._speed * dt,
      pos.z,
    );
  }

  private _checkEnemyHit(): void {
    const pos = this.node.worldPosition;
    for (const enemy of GameManager.instance.enemies) {
      if (!enemy || !enemy.isValid) continue;
      const dist = Vec3.distance(pos, enemy.node.worldPosition);
      // 발사체 반경(8) + 적 반경(25) = 33
      if (dist < 33) {
        enemy.takeDamage(this._damage);
        this.node.destroy();
        return;
      }
    }
  }

  private _checkOutOfBounds(): void {
    const pos = this.node.worldPosition;
    if (Math.abs(pos.x) > this._outOfBoundsLimit || Math.abs(pos.y) > this._outOfBoundsLimit) {
      this.node.destroy();
    }
  }
}
