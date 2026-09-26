import {
  _decorator,
  Component,
  type EventKeyboard,
  Input,
  input,
  KeyCode,
  Node,
  Sprite,
  SpriteAtlas,
  type SpriteFrame,
} from 'cc';
import { DEV } from 'cc/env';
import type { Facing } from '../logic/FacingLogic';
import {
  advanceAnim,
  createAnimState,
  DEFAULT_ANIM_FPS,
  frameName,
  type IAnimState,
  type LayerAction,
  resolveLayerFrame,
  type StackSlot,
  stackOrder,
  validateLayers,
} from '../logic/PlayerLayerLogic';
import { PlayerController } from './PlayerController';

const { ccclass, property } = _decorator;

/** 상의 자리에 올 수 있는 아틀라스 층 */
type TopLayer = 'topA' | 'topB';
/** 아틀라스의 층 이름 — 겹치는 순서의 자리 넷 가운데 상의 자리에만 두 층이 온다 */
type AtlasLayer = 'body' | TopLayer | 'staff' | 'shield';

const FACINGS: readonly Facing[] = ['front', 'back', 'left', 'right'];
const ACTIONS: readonly LayerAction[] = ['walk', 'idle'];
const SLOTS: readonly StackSlot[] = ['body', 'top', 'staff', 'shield'];
/** 개발용 옷 전환 키. 이동키(WASD · 화살표)와 일시정지(ESC)를 피했다 */
const DEV_TOP_TOGGLE_KEY = KeyCode.KEY_T;

/** 프레임 배열의 열쇠 — (층, 동작, 방향) */
function frameKey(layer: AtlasLayer, action: LayerAction, facing: Facing): string {
  return `${layer}|${action}|${facing}`;
}

/**
 * 층별 아틀라스에서 프레임을 꺼내 Player의 자식 Sprite 넷(몸 · 상의 · 지팡이 · 방패)에 매 프레임 붙이고, 방향이
 * 바뀌면 자식의 형제 순서를 방향별 겹치는 순서로 다시 매기는 컴포넌트. 규칙은 전부 `PlayerLayerLogic`에 있고 여기는
 * 연결만 한다.
 *
 * `lateUpdate`에서 도는 것은 같은 노드의 `PlayerController.update`가 방향을 갱신한 뒤에 읽어야 한 프레임 늦지 않기
 * 때문이다. 시계는 그 컨트롤러의 getter 셋(`facing` · `isMoving` · `isTicking`)만 보고 돌린다 — 컴포넌트가 스스로
 * 멈춤을 판정하면 레벨업 중에도 시계가 흐를 수 있다.
 */
@ccclass('PlayerLayerSync')
export class PlayerLayerSync extends Component {
  @property(Node) bodyNode: Node | null = null;
  @property(Node) topNode: Node | null = null;
  @property(Node) staffNode: Node | null = null;
  @property(Node) shieldNode: Node | null = null;

  // 아틀라스는 층 × 동작마다 하나다(`bake.ts atlas`가 그렇게 담는다). 배열로 받지 않고 이름별로 두는 이유는
  // PlayerController의 방향 슬롯과 같다 — 배열이면 순서를 잘못 끼워도 에러 없이 통과해 걷기에 대기 그림이 뜬다.
  @property(SpriteAtlas) bodyWalk: SpriteAtlas | null = null;
  @property(SpriteAtlas) bodyIdle: SpriteAtlas | null = null;
  @property(SpriteAtlas) topAWalk: SpriteAtlas | null = null;
  @property(SpriteAtlas) topAIdle: SpriteAtlas | null = null;
  @property(SpriteAtlas) topBWalk: SpriteAtlas | null = null;
  @property(SpriteAtlas) topBIdle: SpriteAtlas | null = null;
  @property(SpriteAtlas) staffWalk: SpriteAtlas | null = null;
  @property(SpriteAtlas) staffIdle: SpriteAtlas | null = null;
  @property(SpriteAtlas) shieldWalk: SpriteAtlas | null = null;
  @property(SpriteAtlas) shieldIdle: SpriteAtlas | null = null;

  /** 걷기 재생 속도(초당 장 수). 굽기에 박히지 않은 값이라 인게임에서 다시 맞출 수 있다 */
  @property walkFps = DEFAULT_ANIM_FPS.walk;
  /** 대기 재생 속도(초당 장 수) */
  @property idleFps = DEFAULT_ANIM_FPS.idle;

  private _controller: PlayerController | null = null;
  /** 자리 → 그 자리의 자식 Sprite. 속성이 비어 꺼진 자리는 없다 */
  private _sprites = new Map<StackSlot, Sprite>();
  /** (층, 동작, 방향) → 번호순 프레임. 못 찾은 이름은 null로 남겨 실행 중에 직전 프레임을 유지한다 */
  private _frames = new Map<string, (SpriteFrame | null)[]>();
  /** 아틀라스에서 읽은 동작별 장 수(몸 층의 정면 기준) */
  private _counts = { walk: 0, idle: 0 };
  private _state: IAnimState = createAnimState();
  /** 자리마다 마지막으로 붙인 프레임 — 같은 프레임을 매 프레임 다시 대입하지 않으려는 것 */
  private _drawn = new Map<StackSlot, SpriteFrame | null>();
  /** 이미 「없다」고 알린 프레임 이름 */
  private _reported = new Set<string>();
  /** 지금 입은 상의 층. 시작 복장은 상의 A다(사용자 결정 2026-09-20) */
  private _top: TopLayer = 'topA';
  private _topBReady = false;

  // 자식 Sprite와 아틀라스를 한 번 읽어 프레임 배열을 만든다. 실행 중에 이름 문자열을 조립하지 않으려는 것이다
  onLoad() {
    this._collectSprites();
    if (!this._sprites.has('body')) {
      console.error(
        '[PlayerLayerSync] bodyNode가 없거나 Sprite가 없다 — 비활성화합니다. 씬 배선을 확인하세요.',
      );
      this.enabled = false;
      return;
    }
    const names = this._collectFrames();
    if (!names.body) {
      console.error(
        '[PlayerLayerSync] 몸 아틀라스(bodyWalk · bodyIdle)가 비어 있다 — 비활성화합니다.',
      );
      this.enabled = false;
      return;
    }
    // 층별 장 수가 다르면 그 조합에서 층끼리 다른 장이 겹친다. 어느 아틀라스를 다시 넣을지 알 수 있게 조합과 수를
    // 그대로 찍는다
    const mismatches = validateLayers(names);
    if (mismatches.length > 0) {
      const lines = mismatches.map(
        (m) =>
          `${m.facing} ${m.action}: ${Object.entries(m.counts)
            .map(([layer, count]) => `${layer} ${count}`)
            .join(' · ')}`,
      );
      console.error(
        `[PlayerLayerSync] 층별 프레임 수가 다르다 — 비활성화합니다.\n  ${lines.join('\n  ')}`,
      );
      this.enabled = false;
      return;
    }
    this._counts = {
      walk: this._frames.get(frameKey('body', 'walk', 'front'))?.length ?? 0,
      idle: this._frames.get(frameKey('body', 'idle', 'front'))?.length ?? 0,
    };
  }

  // 컨트롤러를 잡고, 데이터가 준비되기 전에도 정면 대기 0번을 그려 둔다 — 안 그리면 Playing이 될 때까지 투명하다
  start() {
    const controller = this.getComponent(PlayerController);
    if (!controller) {
      console.error('[PlayerLayerSync] 같은 노드에 PlayerController가 없다 — 비활성화합니다.');
      this.enabled = false;
      return;
    }
    this._controller = controller;
    this._applyStackOrder(this._state.facing);
    this._draw(this._state);
  }

  onEnable() {
    if (DEV) input.on(Input.EventType.KEY_DOWN, this._onDevKey, this);
  }

  onDisable() {
    if (DEV) input.off(Input.EventType.KEY_DOWN, this._onDevKey, this);
  }

  // 컨트롤러가 update에서 정한 방향 · 이동 · 진행 여부로 시계를 돌리고, 바뀐 것이 있을 때만 그린다
  lateUpdate(dt: number) {
    const controller = this._controller;
    if (!controller) return;
    const next = advanceAnim(
      this._state,
      {
        facing: controller.facing,
        moving: controller.isMoving,
        ticking: controller.isTicking,
        dt,
      },
      { fps: { walk: this.walkFps, idle: this.idleFps }, counts: this._counts },
    );
    if (next === this._state) return;
    // 형제 순서는 방향에만 달렸으므로 방향이 바뀐 프레임에만 다시 매긴다
    if (next.facing !== this._state.facing) this._applyStackOrder(next.facing);
    this._state = next;
    this._draw(next);
  }

  /** 자리 넷의 자식 노드에서 Sprite를 찾는다. 노드가 비었거나 Sprite가 없는 자리는 오류를 한 번 남기고 건너뛴다. */
  private _collectSprites(): void {
    const nodes: [StackSlot, Node | null][] = [
      ['body', this.bodyNode],
      ['top', this.topNode],
      ['staff', this.staffNode],
      ['shield', this.shieldNode],
    ];
    for (const [slot, node] of nodes) {
      const sprite = node?.getComponent(Sprite) ?? null;
      if (!sprite) {
        console.error(
          `[PlayerLayerSync] ${slot} 자리의 노드가 비었거나 Sprite가 없다 — 그 층은 그리지 않습니다.`,
        );
        continue;
      }
      this._sprites.set(slot, sprite);
    }
  }

  /**
   * 아틀라스마다 (동작, 방향)별 프레임 배열을 만들고, 층별 프레임 이름 목록을 돌려준다(장 수 검사의 입력).
   * 아틀라스가 빈 층은 오류를 한 번 남기고 그 층의 노드를 끈다 — 속성 하나를 빠뜨린 실수 때문에 캐릭터 전체가
   * 멈추지 않게 한다. 상의 B는 노드를 끄지 않고 옷 전환만 막는다.
   */
  private _collectFrames(): Record<string, string[]> {
    const atlases: [AtlasLayer, SpriteAtlas | null, SpriteAtlas | null][] = [
      ['body', this.bodyWalk, this.bodyIdle],
      ['topA', this.topAWalk, this.topAIdle],
      ['topB', this.topBWalk, this.topBIdle],
      ['staff', this.staffWalk, this.staffIdle],
      ['shield', this.shieldWalk, this.shieldIdle],
    ];
    const names: Record<string, string[]> = {};
    for (const [layer, walk, idle] of atlases) {
      if (!walk || !idle) {
        console.error(
          `[PlayerLayerSync] ${layer} 층의 아틀라스(걷기 · 대기)가 비어 있다 — 그 층은 그리지 않습니다.`,
        );
        this._disableLayer(layer);
        continue;
      }
      if (layer === 'topB') this._topBReady = true;
      const collected: string[] = [];
      for (const action of ACTIONS) {
        const atlas = action === 'walk' ? walk : idle;
        const inAtlas = Object.keys(atlas.spriteFrames);
        collected.push(...inAtlas);
        for (const facing of FACINGS) {
          const prefix = `${layer}_${action}_${facing}_`;
          const count = inAtlas.filter((name) => name.startsWith(prefix)).length;
          const frames = Array.from({ length: count }, (_, i) =>
            atlas.getSpriteFrame(frameName(layer, action, facing, i)),
          );
          this._frames.set(frameKey(layer, action, facing), frames);
        }
      }
      names[layer] = collected;
    }
    return names;
  }

  /** 아틀라스가 빈 층의 노드를 끈다. 상의 B는 층 노드를 공유하므로 끄지 않는다. */
  private _disableLayer(layer: AtlasLayer): void {
    if (layer === 'topB') return;
    const slot: StackSlot = layer === 'topA' ? 'top' : layer;
    const sprite = this._sprites.get(slot);
    if (sprite) sprite.node.active = false;
    this._sprites.delete(slot);
  }

  /** 지금 상태의 프레임을 자리마다 붙인다. 아틀라스에 없는 이름은 직전 프레임을 유지하고 이름마다 한 번만 알린다. */
  private _draw(state: IAnimState): void {
    for (const slot of SLOTS) {
      const sprite = this._sprites.get(slot);
      if (!sprite) continue;
      const layer: AtlasLayer = slot === 'top' ? this._top : slot;
      const name = frameName(layer, state.action, state.facing, state.index);
      const found =
        this._frames.get(frameKey(layer, state.action, state.facing))?.[state.index] ?? null;
      const prev = this._drawn.get(slot) ?? null;
      const { frame, report } = resolveLayerFrame(found, prev, name, this._reported);
      if (report)
        console.error(
          `[PlayerLayerSync] 아틀라스에 프레임이 없다: ${name} — 직전 프레임을 유지합니다.`,
        );
      if (frame && frame !== prev) {
        sprite.spriteFrame = frame;
        this._drawn.set(slot, frame);
      }
    }
  }

  /**
   * 자식의 형제 순서를 그 방향의 겹치는 순서로 다시 매긴다. 자리 넷이 차지한 구간의 첫 번호부터 순서대로 놓으므로,
   * 다른 자식(뒤에 얹을 마법진 등)이 앞뒤에 있어도 그 자리는 안 밀린다.
   */
  private _applyStackOrder(facing: Facing): void {
    const nodes: Node[] = [];
    for (const slot of stackOrder(facing)) {
      const sprite = this._sprites.get(slot);
      if (sprite) nodes.push(sprite.node);
    }
    if (nodes.length === 0) return;
    const base = Math.min(...nodes.map((node) => node.getSiblingIndex()));
    for (let i = 0; i < nodes.length; i++) nodes[i].setSiblingIndex(base + i);
  }

  /** [DEV 전용] T 키로 상의 A · B를 바꿔 입는다. 재생 상태는 그대로라 같은 번호의 프레임으로 이어진다. */
  private _onDevKey(e: EventKeyboard): void {
    if (e.keyCode !== DEV_TOP_TOGGLE_KEY) return;
    if (!this._topBReady) {
      console.warn('[PlayerLayerSync] 상의 B 아틀라스가 없어 옷을 바꿀 수 없다.');
      return;
    }
    this._top = this._top === 'topA' ? 'topB' : 'topA';
    this._draw(this._state);
  }
}
