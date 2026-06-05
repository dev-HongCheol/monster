import { _decorator, CCString, Color, Component, Node, Prefab, Sprite, Vec3 } from 'cc';
import { GameState } from '../data/GameTypes';
import { FireSchedulerLogic } from '../logic/FireSchedulerLogic';
import { LoadoutLogic } from '../logic/LoadoutLogic';
import { buildFirePlan, type ShotSpec } from '../logic/SpellPatternLogic';
import { spellCategoryColor } from '../logic/SpellVisual';
import { DataManager } from '../systems/DataManager';
import { DeckManager } from '../systems/DeckManager';
import { GameManager } from '../systems/GameManager';
import { PoolManager } from './PoolManager';
import { Projectile } from './Projectile';

const { ccclass, property } = _decorator;

/**
 * 로드아웃(보유 마법)을 들고 보유 마법 전부를 각자 쿨다운으로 자동 발사하는 컴포넌트.
 * 발사 기준 위치는 부착된 노드(Player)의 위치다.
 *
 * 플랜 § 4 근거:
 * - LoadoutLogic + FireSchedulerLogic 소유
 * - 매 프레임 스케줄러 tick → 가장 가까운 적을 향해 준비된 마법만 발사
 * - per-spell/분류/전역 강화(DeckManager.damageFactor/effectiveCooldown)를 마법별로 적용
 */
@ccclass('SpellCaster')
export class SpellCaster extends Component {
  static instance!: SpellCaster;

  /** 발사체 프리팹 (인스펙터에서 연결) */
  @property(Prefab) bulletPrefab: Prefab | null = null;
  /** 발사체가 생성될 부모 노드 (인스펙터에서 연결) */
  @property(Node) bulletParent: Node | null = null;
  /** 시작 시 로드아웃에 채울 마법 id 목록 (spells.json) */
  @property({ type: [CCString] }) startingSpellIds: string[] = ['fireball'];

  private readonly _loadout = new LoadoutLogic();
  private readonly _scheduler = new FireSchedulerLogic();
  private _dataReady = false;
  /** 발사체 재사용 풀 (onLoad에서 prefab/parent로 생성). */
  private _bulletPool: PoolManager | null = null;
  /** 발사체 반환 콜백 — 매 발사마다 closure를 새로 만들지 않도록 1회 바인딩해 재사용. */
  private readonly _releaseBullet = (node: Node): void => {
    this._bulletPool?.release(node);
  };

  /** 보유 마법 로드아웃 (후속 슬라이스의 카드 시스템 연동용) */
  get loadout(): LoadoutLogic {
    return this._loadout;
  }

  onLoad() {
    SpellCaster.instance = this;
    if (this.bulletPrefab && this.bulletParent) {
      this._bulletPool = new PoolManager(this.bulletPrefab, this.bulletParent);
    } else {
      console.error('[SpellCaster] bulletPrefab or bulletParent not assigned — attack disabled');
    }
  }

  onDestroy() {
    if (SpellCaster.instance === this) {
      SpellCaster.instance = null as unknown as SpellCaster;
    }
  }

  /**
   * 마법을 로드아웃에 추가한다 (카드 "마법 추가" 픽). 추가된 마법은 다음 프레임부터 자동 발사된다.
   * @param id 마법 id (spells.json)
   * @returns 추가 성공 여부. 슬롯이 가득 찼거나 이미 보유 중이면 false.
   */
  addSpell(id: string): boolean {
    return this._loadout.addSpell(id);
  }

  start() {
    DataManager.instance.onReady(() => {
      for (const id of this.startingSpellIds) this._loadout.addSpell(id);
      this._dataReady = true;
    });
  }

  // 스케줄러 tick → 최근접 적 조준 → 쿨다운 소진된 보유 마법만 전역 강화 적용해 발사
  update(dt: number) {
    if (!this._dataReady) return;
    if (GameManager.instance.state !== GameState.Playing) return;

    const spells = this._loadout.spells;
    this._scheduler.tick(dt, spells);

    const target = this._findNearestEnemy();
    if (!target) return;

    // 발사 기준 조준 단위벡터(플레이어 → 최근접 적). 적이 self와 겹쳐 영벡터면 위쪽 폴백.
    const aim = new Vec3();
    Vec3.subtract(aim, target.position, this.node.position);
    if (aim.lengthSqr() < 1e-8) aim.set(0, 1, 0);
    else aim.normalize();

    for (const id of spells) {
      if (!this._scheduler.isReady(id)) continue;
      const spell = DataManager.instance.getSpell(id);
      if (!spell) continue;

      // per-spell/분류/전역 쿨다운 강화 반영(배율로 나눠 간격 단축 + 하한). 계산은 순수 로직에 위임.
      this._scheduler.consume(id, DeckManager.instance.effectiveCooldown(spell));

      // 유효 발사체 수 = 기본값 (+ 향후 발사체 수 강화 보너스). 패턴 엔진이 부채꼴 형태를 결정.
      const plan = buildFirePlan(spell, { aimX: aim.x, aimY: aim.y, count: spell.projectileCount });
      const damageFactor = DeckManager.instance.damageFactor(spell);
      for (const shot of plan) {
        this._spawnShot(shot, damageFactor, spell.category);
      }
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
   * ShotSpec 한 발을 발사체로 생성하고 발사한다.
   * @param shot 발사 사양 (방향 단위벡터·속도·기본 데미지·반경)
   * @param damageFactor per-spell/분류 데미지 배율 (DeckManager) — 기본 데미지에 곱한다
   * @param category 마법 분류 (발사체 색 틴트용)
   */
  private _spawnShot(shot: ShotSpec, damageFactor: number, category: string): void {
    if (!this._bulletPool) return;

    // 풀에서 발사체를 꺼낸다(가용분 재사용 또는 신규 생성). 위치·색·init은 매 acquire마다
    // 새로 적용하므로 재사용 노드에 이전 상태가 잔류하지 않는다.
    const bullet = this._bulletPool.acquire();
    bullet.setPosition(this.node.position);

    // 마법별 전용 스프라이트가 없는 동안 분류 색으로 발사체를 구분한다.
    const sprite = bullet.getComponent(Sprite);
    if (sprite) {
      const [r, g, b] = spellCategoryColor(category);
      sprite.color = new Color(r, g, b);
    }

    const projectile = bullet.getComponent(Projectile);
    if (!projectile) return;
    projectile.init(
      new Vec3(shot.dirX, shot.dirY, 0),
      shot.speed,
      shot.damage * damageFactor,
      shot.radius,
      this._releaseBullet,
    );
  }
}
