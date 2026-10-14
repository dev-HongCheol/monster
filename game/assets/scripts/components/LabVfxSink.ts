import { _decorator, Color, Component, Node, ParticleSystem2D, Sprite, UITransform } from 'cc';
import {
  emitterSettings,
  type IVfxRecipe,
  type MethodKey,
  ringPose,
  VFX_SHAPE_PX,
} from '../logic/VfxRecipeLogic';
import { LabRuntime } from '../systems/LabRuntime';
import { NodeFactoryPool } from './NodeFactoryPool';
import type { VfxFactory } from './VfxFactory';

const { ccclass } = _decorator;

/** 수명이 끝나면 반납할 터짐 하나 */
interface ITimed {
  node: Node;
  left: number;
}

/** 커지는 중인 고리 하나 */
interface IRing {
  sprite: Sprite;
  t: number;
  life: number;
  /** 띄울 때의 후보 — 크기 · 투명도 · 각도를 `ringPose`로 정하고, 두께 고정 · 서리 띠면 그림을 바꿔 끼운다 */
  recipe: IVfxRecipe;
  /** 노드 지름(배율 1일 때, units) */
  size: number;
}

/**
 * 측정 모드 켬 블록과 비교판 가운데에서 `SpellCaster`의 이펙트 자리를 맡는다(계획
 * 2026-10-12-magic-effect-gate-plan.md §4의 `IVfxSink` 중 팩토리 구현). 지금 게임은 프리팹 셋을 그대로
 * 쓰고, 이 컴포넌트는 실험 판(측정 · 비교판)에서만 붙는다. 비교판은 고른 칸이 바뀔 때마다
 * `setRecipe`로 후보를 갈아 끼운다.
 *
 * - 폭발 → 방식 가(터짐 방출기). 반경은 시전마다 속도로 맞춘다.
 * - 노바 → 방식 다(고리 스프라이트가 커지며 사라진다).
 * - 오브 → 방식 나(계속 뿜는 방출기). `orbPool`을 `SpellCaster`의 오브 풀 자리에 끼운다.
 * - 발사체 → 방식 라(파편 몸체 + 세상 좌표 꼬리).
 *
 * 노드는 `VfxLayer`(발사체 부모 바로 다음 형제) 아래 가산 · 알파 두 층에 둔다. 섞기 방식별로
 * 모아야 드로우콜이 방출기 수가 아니라 섞기 방식 수에 가까워진다. 발사체 꼬리만은 발사체를 따라가야
 * 해서 발사체의 자식이다.
 *
 * 끔 블록에 들어서는 순간 살아 있는 터짐 · 고리를 모두 멈춰 반납하고 꼬리를 끈다. 그래야 끔 블록
 * 앞부분에 켬 블록의 알갱이가 남아 끔 쪽 비용을 키우지 않는다.
 */
@ccclass('LabVfxSink')
export class LabVfxSink extends Component {
  private _factory: VfxFactory | null = null;
  private _recipes: Partial<Record<MethodKey, IVfxRecipe>> = {};
  private _addLayer: Node | null = null;
  private _alphaLayer: Node | null = null;
  private _burstPool: NodeFactoryPool<Node> | null = null;
  private _ringPool: NodeFactoryPool<Node> | null = null;
  private _orbPool: NodeFactoryPool<Node> | null = null;
  private readonly _timed: ITimed[] = [];
  private readonly _rings: IRing[] = [];
  private readonly _tails = new Set<Node>();
  private _wasOff = false;
  /** 후보 세대. 비교판이 `setRecipe`로 후보를 바꿀 때마다 오른다 */
  private _gen = 0;
  /** 노드를 마지막으로 꾸민 세대 — 풀에서 다시 꺼낼 때 세대가 다르면 새 후보 모습으로 고친다 */
  private readonly _nodeGen = new WeakMap<Node, number>();

  /** 그림 공장 — 비교판 격자도 같은 공장을 써서 HUD 알갱이 수에 가운데와 격자가 함께 잡힌다 */
  get factory(): VfxFactory | null {
    return this._factory;
  }

  /** 오브 그림 풀 — `SpellCaster`가 프리팹 풀 대신 쓴다. 고른 나 후보가 없으면 null */
  get orbPool(): NodeFactoryPool<Node> | null {
    return this._orbPool;
  }

  /**
   * 층과 풀을 만든다. 실험 판(측정 · 비교판)에서 마법 데이터가 준비된 뒤 한 번 부른다.
   * @param factory 그림 · 노드 공장
   * @param recipes 방식별 고른 후보(덮어쓰기 적용 값). `only`로 빠진 방식은 비어 있다
   * @param bulletParent 발사체 부모 — 바로 다음 형제로 `VfxLayer`를 붙인다
   */
  setup(
    factory: VfxFactory,
    recipes: Partial<Record<MethodKey, IVfxRecipe>>,
    bulletParent: Node,
  ): void {
    this._factory = factory;
    this._recipes = { ...recipes };
    const layer = new Node('VfxLayer');
    const parent = bulletParent.parent;
    if (parent) {
      parent.insertChild(layer, bulletParent.getSiblingIndex() + 1);
      layer.setPosition(bulletParent.position);
    }
    this._addLayer = new Node('Add');
    this._alphaLayer = new Node('Alpha');
    layer.addChild(this._addLayer);
    layer.addChild(this._alphaLayer);
    this._ensurePools();
  }

  /**
   * 한 방식의 후보를 바꾼다(비교판에서 `Tab` · 숫자 키로 고른 칸이 바뀔 때). 이미 풀에 있는 노드는
   * 버리지 않고, 다음에 꺼낼 때 새 후보 모습으로 고친다 — 풀을 새로 만들면 `SpellCaster`가 옛 풀에서
   * 꺼낸 오브를 새 풀에 반납하게 된다. 그래서 지금 화면에 떠 있는 오브는 인페르노가 끝나 반납됐다가
   * 다음 시전에 다시 나올 때 새 모습이 된다(그 사이 몇 초는 옛 모습이다).
   * @param r 새 후보(덮어쓰기 적용 값). null이면 그 방식의 이펙트를 띄우지 않는다
   */
  setRecipe(method: MethodKey, r: IVfxRecipe | null): void {
    if (r) this._recipes[method] = r;
    else delete this._recipes[method];
    this._gen++;
    this._ensurePools();
  }

  /** 후보가 있는 방식의 풀을 만든다. 이미 있으면 그대로 둔다. */
  private _ensurePools(): void {
    const factory = this._factory;
    if (!factory) return;
    if (this._recipes.ga && !this._burstPool) this._burstPool = this._emitterPool('ga');
    if (this._recipes.na && !this._orbPool) this._orbPool = this._emitterPool('na');
    if (this._recipes.da && !this._ringPool) {
      this._ringPool = new NodeFactoryPool<Node>({
        create: () => {
          const r = this._recipes.da as IVfxRecipe;
          const n = this._attach(factory.makeSprite(r, VFX_SHAPE_PX).node, r);
          this._nodeGen.set(n, this._gen);
          return n;
        },
        onAcquire: (n) => {
          this._refresh(n, 'da', {});
          n.active = true;
        },
        onRelease: (n) => {
          n.active = false;
        },
      });
    }
  }

  /**
   * 풀에서 꺼낸 노드가 옛 세대면 지금 후보 모습으로 고친다. 노드가 꺼져 있을 때 불러야 섞기 방식이
   * 반영된다(`VfxFactory.restyle`). 측정 모드는 후보를 바꾸지 않아 늘 그냥 지나간다.
   */
  private _refresh(
    n: Node,
    method: MethodKey,
    ctx: { radius?: number; projectileSpeed?: number },
  ): void {
    const r = this._recipes[method];
    if (!r || !this._factory || this._nodeGen.get(n) === this._gen) return;
    this._factory.restyle(n, r, emitterSettings(r, ctx));
    this._attach(n, r);
    this._nodeGen.set(n, this._gen);
  }

  /**
   * 폭발 자리에 방식 가 터짐을 띄운다.
   * @param radius 피해 반경 — 알갱이가 수명 끝에 이 원에 닿게 속도를 맞춘다
   */
  explosion(x: number, y: number, radius: number): void {
    const r = this._recipes.ga;
    if (!r || !this._burstPool || !this._factory || LabRuntime.vfxOff) return;
    const node = this._burstPool.acquire();
    const ps = node.getComponent(ParticleSystem2D);
    if (!ps) return;
    const s = emitterSettings(r, { radius });
    this._factory.retune(ps, r, s);
    node.setPosition(x, y, 0);
    ps.resetSystem();
    this._timed.push({ node, left: s.duration + s.life });
  }

  /**
   * 노바 자리에 방식 다 고리를 띄운다. 고리는 수명 동안 커지고 끝 크기가 피해 반경과 같다.
   * @param radius 피해 반경
   */
  nova(x: number, y: number, radius: number): void {
    const r = this._recipes.da;
    const factory = this._factory;
    if (!r || !factory || !this._ringPool || LabRuntime.vfxOff) return;
    const node = this._ringPool.acquire();
    const sprite = node.getComponent(Sprite);
    if (!sprite) return;
    // 고리 그림의 선은 그림 가장자리보다 안쪽에 있어서, 선이 피해 반경 위에서 끝나게 그만큼 키운다
    const d = factory.ringNodeSize(r, radius);
    node.getComponent(UITransform)?.setContentSize(d, d);
    node.setPosition(x, y, 0);
    const ring: IRing = { sprite, t: 0, life: r.life, recipe: r, size: d };
    poseRing(factory, ring);
    this._rings.push(ring);
  }

  /**
   * 발사체에 방식 라를 입힌다 — 몸체를 파편 그림으로 바꾸고 꼬리 방출기를 자식으로 붙인다.
   * 끔 블록이면 꼬리를 끈다(몸체는 `SpellCaster`가 끈다).
   * @param bullet 풀에서 꺼낸 발사체 노드
   * @param speed 발사체 속도 — 꼬리 길이를 수명으로 바꾸는 데 쓴다
   */
  projectile(bullet: Node, speed: number): void {
    const r = this._recipes.ra;
    const factory = this._factory;
    if (!r || !factory) return;
    const sprite = bullet.getComponent(Sprite);
    const frame = factory.frame(r.shape);
    if (sprite && frame && sprite.spriteFrame !== frame) {
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = frame;
    }
    let tail = bullet.getChildByName('LabTail');
    // 비교판이 후보를 바꿨으면 옛 꼬리를 버리고 새로 단다 — 꼬리는 발사체마다 하나라 풀이 없다
    if (tail && this._nodeGen.get(tail) !== this._gen) {
      this._tails.delete(tail);
      tail.destroy();
      tail = null;
    }
    if (!tail) {
      tail = factory.makeEmitter(r, emitterSettings(r, { projectileSpeed: speed })).node;
      tail.name = 'LabTail';
      bullet.addChild(tail);
      this._tails.add(tail);
      this._nodeGen.set(tail, this._gen);
    }
    tail.active = !LabRuntime.vfxOff;
    if (tail.active) tail.getComponent(ParticleSystem2D)?.resetSystem();
  }

  update(dt: number) {
    const off = LabRuntime.vfxOff;
    if (off && !this._wasOff) this._clearAll();
    this._wasOff = off;

    for (let i = this._timed.length - 1; i >= 0; i--) {
      const t = this._timed[i];
      t.left -= dt;
      if (t.left > 0) continue;
      this._burstPool?.release(t.node);
      this._timed.splice(i, 1);
    }
    for (let i = this._rings.length - 1; i >= 0; i--) {
      const g = this._rings[i];
      g.t += dt;
      if (this._factory) poseRing(this._factory, g);
      if (g.t < g.life) continue;
      this._ringPool?.release(g.sprite.node);
      this._rings.splice(i, 1);
    }
  }

  /** 끔 블록에 들어설 때 — 살아 있는 터짐 · 고리를 반납하고 꼬리를 끈다. */
  private _clearAll(): void {
    for (const t of this._timed) this._burstPool?.release(t.node);
    this._timed.length = 0;
    for (const g of this._rings) this._ringPool?.release(g.sprite.node);
    this._rings.length = 0;
    for (const tail of this._tails) if (tail.isValid) tail.active = false;
  }

  /**
   * 한 방식의 방출기 풀을 만든다. 만들 때와 꺼낼 때 그 방식의 **지금** 후보를 읽는다 — 비교판이
   * 후보를 바꿔도 풀은 그대로 두고 노드만 고친다. 꺼낼 때 다시 시작하고 반납할 때 멈춘다.
   */
  private _emitterPool(method: 'ga' | 'na'): NodeFactoryPool<Node> {
    const factory = this._factory;
    return new NodeFactoryPool<Node>({
      create: () => {
        const r = this._recipes[method];
        if (!factory || !r) throw new Error('[LabVfxSink] 후보 없이 풀에서 노드를 만들었다');
        const n = this._attach(factory.makeEmitter(r, emitterSettings(r, {})).node, r);
        this._nodeGen.set(n, this._gen);
        return n;
      },
      onAcquire: (n) => {
        this._refresh(n, method, {});
        n.active = true;
        n.getComponent(ParticleSystem2D)?.resetSystem();
      },
      onRelease: (n) => {
        n.getComponent(ParticleSystem2D)?.stopSystem();
        n.active = false;
      },
    });
  }

  /** 섞기 방식에 맞는 층에 붙인다. 블렌드 값은 이미 들어 있어 붙는 순간 머티리얼에 반영된다. */
  private _attach(node: Node, r: IVfxRecipe): Node {
    const layer = r.blend === 'add' ? this._addLayer : this._alphaLayer;
    if (layer && node.parent !== layer) node.setParent(layer);
    return node;
  }
}

/**
 * 커지는 중인 고리 하나를 지금 시각의 모습(`ringPose`)으로 맞춘다. 투명도는 매번 불투명에서 다시
 * 계산하므로, 앞 고리가 투명해진 채 반납된 노드도 처음 맞출 때 불투명으로 돌아간다.
 */
function poseRing(factory: VfxFactory, g: IRing): void {
  const p = ringPose(g.t / g.life, g.recipe);
  g.sprite.node.setScale(p.scale, p.scale, 1);
  g.sprite.node.angle = p.angle;
  setRingFrame(factory, g.sprite, g.recipe, g.size * p.scale, g.t);
  setSpriteAlpha(g.sprite, p.alpha);
}

/** 색 대입용 칸 하나 — 고리마다 매 프레임 새 `Color`를 만들면 측정 켬 블록에 쓰레기가 쌓인다 */
const _tint = new Color();

/**
 * 스프라이트의 색은 그대로 두고 불투명도만 바꾼다. `sprite.color`는 대입해야 렌더 데이터가 갱신되므로
 * 같은 칸에 값을 넣어 대입한다(엔진이 값을 복사한다).
 * @param alpha 0~1
 */
export function setSpriteAlpha(sprite: Sprite, alpha: number): void {
  const c = sprite.color;
  _tint.set(c.r, c.g, c.b, Math.round(255 * alpha));
  sprite.color = _tint;
}

/**
 * 고리 그림을 지금 화면 크기 · 시각에 맞는 것으로 바꾼다. 두께 고정 후보면 커질수록 가는 선 그림으로,
 * 서리 띠면 시간에 따라 얼룩이 다른 장으로, 아니면 늘 같은 그림이다. 같은 그림이면 넣지 않는다 —
 * 넣을 때마다 렌더 데이터가 다시 만들어진다.
 * @param displaySize 노드 지름 × 지금 배율(units)
 * @param t 고리가 나타난 뒤 지난 시간(초)
 */
export function setRingFrame(
  factory: VfxFactory,
  sprite: Sprite,
  r: IVfxRecipe,
  displaySize: number,
  t: number,
): void {
  const frame = factory.ringFrame(r, displaySize, t);
  if (frame && sprite.spriteFrame !== frame) sprite.spriteFrame = frame;
}
