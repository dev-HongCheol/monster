import { _decorator, Component, Node, ParticleSystem2D } from 'cc';
import { ControlStrength } from '../logic/StatusEffectLogic';
import { emitterSettings, type IVfxRecipe, VFX_SHAPE_PX } from '../logic/VfxRecipeLogic';
import { GameManager } from '../systems/GameManager';
import { LabRuntime } from '../systems/LabRuntime';
import type { EnemyController } from './EnemyController';
import { NodeFactoryPool } from './NodeFactoryPool';
import type { VfxFactory } from './VfxFactory';

const { ccclass } = _decorator;

/** 표시를 적 발밑이 아니라 몸 가운데쯤에 띄우는 높이(px) */
const STATUS_OFFSET_Y = 24;

/** 붙어 있는 표시 하나. `seen`은 이번 프레임에 그 적이 아직 상태 중인지 */
interface IAttached {
  node: Node;
  seen: boolean;
}

/**
 * 방식 바(적에게 붙는 상태 표시)를 맡는 시스템 하나(계획 2026-10-12-magic-effect-gate-plan.md §4).
 *
 * 표시 노드를 적의 자식으로 두지 않고 별도 층 `StatusLayer` 아래에 모아 적 위치를 따라가게 한다.
 * 적 그림(알파)과 방출기(가산)가 적마다 번갈아 그려지면 엔진이 적마다 그리기를 끊기 때문이다.
 * `StatusLayer`는 Canvas의 마지막 자식으로 유지한다 — 스포너가 적을 Canvas 끝에 붙여서, 한 번
 * 맨 뒤에 둬도 적이 생기면 그 뒤로 밀려 표시가 적 그림에 가려진다.
 *
 * 상태 끝 · 죽음 · 풀 반납 · 블록 경계(끔 블록이면 전부 뗀다)를 모두 `lateUpdate` 한 곳에서
 * 처리한다. 적의 상태는 `EnemyController.controlStrength`로 읽기만 한다.
 */
@ccclass('StatusVfxOverlay')
export class StatusVfxOverlay extends Component {
  private _layer: Node | null = null;
  private _pool: NodeFactoryPool<Node> | null = null;
  private _factory: VfxFactory | null = null;
  private readonly _attached = new Map<EnemyController, IAttached>();

  /**
   * 층과 풀을 만든다. 실험 판(측정 · 비교판)에서 마법 데이터가 준비된 뒤 한 번 부른다.
   * @param factory 그림 · 노드 공장
   * @param recipe 방식 바의 고른 후보(덮어쓰기 적용 값). null이면 `setRecipe`를 받을 때까지 아무것도 붙이지 않는다
   * @param canvas 적이 붙는 Canvas 노드
   */
  setup(factory: VfxFactory, recipe: IVfxRecipe | null, canvas: Node): void {
    const layer = new Node('StatusLayer');
    canvas.addChild(layer);
    this._layer = layer;
    this._factory = factory;
    this._pool = recipe ? this._makePool(factory, recipe, layer) : null;
  }

  /**
   * 후보를 바꾼다(비교판에서 고른 칸이 바뀔 때). 루프 방출기와 정지 스프라이트는 노드 구성이 달라
   * 고쳐 쓸 수 없으므로, 붙어 있던 표시와 풀을 모두 버리고 새 풀로 다시 붙인다.
   * @param recipe 새 후보. null이면 표시를 모두 떼고 더 붙이지 않는다
   */
  setRecipe(recipe: IVfxRecipe | null): void {
    const layer = this._layer;
    const factory = this._factory;
    if (!layer || !factory) return;
    if (this._pool) this._releaseAll(this._pool);
    layer.destroyAllChildren();
    this._pool = recipe ? this._makePool(factory, recipe, layer) : null;
  }

  /** 후보 하나로 표시 노드 풀을 만든다. */
  private _makePool(factory: VfxFactory, recipe: IVfxRecipe, layer: Node): NodeFactoryPool<Node> {
    const isLoop = recipe.statusKind === 'loop';
    return new NodeFactoryPool<Node>({
      create: () => {
        const node = isLoop
          ? factory.makeEmitter(recipe, emitterSettings(recipe, {})).node
          : factory.makeSprite(recipe, VFX_SHAPE_PX * recipe.size).node;
        layer.addChild(node);
        return node;
      },
      onAcquire: (node) => {
        node.active = true;
        emitterOf(node)?.resetSystem();
      },
      onRelease: (node) => {
        emitterOf(node)?.stopSystem();
        node.active = false;
      },
    });
  }

  lateUpdate() {
    const layer = this._layer;
    const pool = this._pool;
    if (!layer || !pool) return;
    const parent = layer.parent;
    if (parent && layer.getSiblingIndex() !== parent.children.length - 1) {
      layer.setSiblingIndex(parent.children.length - 1);
    }
    if (LabRuntime.vfxOff) {
      this._releaseAll(pool);
      return;
    }
    for (const a of this._attached.values()) a.seen = false;
    const enemies = GameManager.instance?.enemies ?? [];
    for (const enemy of enemies) {
      if (!enemy?.isValid || enemy.controlStrength === ControlStrength.None) continue;
      let a = this._attached.get(enemy);
      if (!a) {
        a = { node: pool.acquire(), seen: true };
        this._attached.set(enemy, a);
      }
      a.seen = true;
      const p = enemy.node.position;
      a.node.setPosition(p.x, p.y + STATUS_OFFSET_Y, 0);
    }
    for (const [enemy, a] of this._attached) {
      if (a.seen) continue;
      pool.release(a.node);
      this._attached.delete(enemy);
    }
  }

  private _releaseAll(pool: NodeFactoryPool<Node>): void {
    for (const a of this._attached.values()) pool.release(a.node);
    this._attached.clear();
  }
}

/** 노드에 붙은 방출기. 정지 스프라이트 후보면 null */
function emitterOf(node: Node): ParticleSystem2D | null {
  return node.getComponent(ParticleSystem2D);
}
