import { _decorator, CCString, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import { GameState } from '../data/GameTypes';
import { FireSchedulerLogic } from '../logic/FireSchedulerLogic';
import { LoadoutLogic } from '../logic/LoadoutLogic';
import { DataManager } from '../systems/DataManager';
import { DeckManager } from '../systems/DeckManager';
import { GameManager } from '../systems/GameManager';
import { Projectile } from './Projectile';

const { ccclass, property } = _decorator;

/**
 * 로드아웃(보유 마법)을 들고 보유 마법 전부를 각자 쿨다운으로 자동 발사하는 컴포넌트.
 * 발사 기준 위치는 부착된 노드(Player)의 위치다.
 *
 * 플랜 § 4 근거:
 * - LoadoutLogic + FireSchedulerLogic 소유
 * - 매 프레임 스케줄러 tick → 가장 가까운 적을 향해 준비된 마법만 발사
 * - 전역 강화(DeckManager.damageMult/cooldownMult)는 모든 마법에 곱해 적용
 */
@ccclass('SpellCaster')
export class SpellCaster extends Component {
  /** 발사체 프리팹 (인스펙터에서 연결) */
  @property(Prefab) bulletPrefab: Prefab | null = null;
  /** 발사체가 생성될 부모 노드 (인스펙터에서 연결) */
  @property(Node) bulletParent: Node | null = null;
  /** 시작 시 로드아웃에 채울 마법 id 목록 (spells.json) */
  @property({ type: [CCString] }) startingSpellIds: string[] = ['fireball'];

  private readonly _loadout = new LoadoutLogic();
  private readonly _scheduler = new FireSchedulerLogic();
  private _dataReady = false;

  /** 보유 마법 로드아웃 (후속 슬라이스의 카드 시스템 연동용) */
  get loadout(): LoadoutLogic {
    return this._loadout;
  }

  onLoad() {
    if (!this.bulletPrefab || !this.bulletParent) {
      console.error('[SpellCaster] bulletPrefab or bulletParent not assigned — attack disabled');
    }
  }

  start() {
    DataManager.instance.onReady(() => {
      for (const id of this.startingSpellIds) this._loadout.addSpell(id);
      this._dataReady = true;
    });
  }

  update(dt: number) {
    if (!this._dataReady) return;
    if (GameManager.instance.state !== GameState.Playing) return;

    const spells = this._loadout.spells;
    this._scheduler.tick(dt, spells);

    const target = this._findNearestEnemy();
    if (!target) return;

    for (const id of spells) {
      if (!this._scheduler.isReady(id)) continue;
      const spell = DataManager.instance.getSpell(id);
      if (!spell) continue;

      const cooldown = spell.cooldown * DeckManager.instance.cooldownMult;
      this._scheduler.consume(id, cooldown);
      this._shoot(
        target,
        spell.projectileSpeed,
        spell.damage * DeckManager.instance.damageMult,
        spell.projectileRadius,
      );
    }
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
   * @param bulletSpeed 발사체 속도
   * @param damage 발사체 피해량
   * @param radius 발사체 충돌 반경
   */
  private _shoot(target: Node, bulletSpeed: number, damage: number, radius: number): void {
    if (!this.bulletPrefab || !this.bulletParent) return;

    const dir = new Vec3();
    Vec3.subtract(dir, target.position, this.node.position);
    dir.normalize();

    const bullet = instantiate(this.bulletPrefab);
    this.bulletParent.addChild(bullet);
    bullet.setPosition(this.node.position);

    const projectile = bullet.getComponent(Projectile);
    if (!projectile) return;
    projectile.init(dir, bulletSpeed, damage, radius);
  }
}
