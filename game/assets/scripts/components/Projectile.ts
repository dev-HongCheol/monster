import { _decorator, Component, Vec3, view } from 'cc';
import { GameManager } from '../systems/GameManager';

const { ccclass } = _decorator;

/** 플레이어가 발사하는 마법 발사체 */
@ccclass('Projectile')
export class Projectile extends Component {
  /** 이동 방향 (단위 벡터) */
  private _direction: Vec3 = new Vec3(0, 1, 0);
  private _speed: number = 500;
  private _damage: number = 25;
  private _radius: number = 8;
  private _outOfBoundsLimit: number = 800;

  /**
   * 발사체를 초기화한다. instantiate 직후 반드시 호출해야 한다.
   * @param direction 이동 방향 (단위 벡터)
   * @param speed 이동 속도 (units/sec)
   * @param damage 적중 시 데미지
   * @param radius 충돌 반경
   */
  init(direction: Vec3, speed: number, damage: number, radius: number): void {
    this._direction = direction.clone();
    this._speed = speed;
    this._damage = damage;
    this._radius = radius;
  }

  onLoad() {
    const size = view.getVisibleSize();
    this._outOfBoundsLimit = Math.max(size.width, size.height) / 2 + 100;
  }

  update(dt: number) {
    this._move(dt);
    this._checkEnemyHit();
    this._checkOutOfBounds();
  }

  /** 이동 방향으로 발사체를 이동시킨다. */
  private _move(dt: number): void {
    const pos = this.node.position;
    this.node.setPosition(
      pos.x + this._direction.x * this._speed * dt,
      pos.y + this._direction.y * this._speed * dt,
      pos.z,
    );
  }

  /** 적과 충돌 여부를 검사해 명중 시 데미지를 주고 자신을 제거한다. */
  private _checkEnemyHit(): void {
    const pos = this.node.position;
    // 스냅샷: takeDamage → destroy → unregisterEnemy가 원본 배열을 변경해도 순회 누락 방지
    for (const enemy of [...GameManager.instance.enemies]) {
      if (!enemy?.isValid) continue;
      const dist = Vec3.distance(pos, enemy.node.position);
      if (dist < this._radius + enemy.collisionRadius) {
        enemy.takeDamage(this._damage);
        this.node.destroy();
        return;
      }
    }
  }

  /** 화면 경계를 벗어나면 자신을 제거한다. */
  private _checkOutOfBounds(): void {
    const pos = this.node.position;
    if (Math.abs(pos.x) > this._outOfBoundsLimit || Math.abs(pos.y) > this._outOfBoundsLimit) {
      this.node.destroy();
    }
  }
}
