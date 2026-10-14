import {
  Color,
  gfx,
  ImageAsset,
  Node,
  ParticleSystem2D,
  Rect,
  Size,
  Sprite,
  SpriteFrame,
  Texture2D,
  type UIRenderer,
  UITransform,
  Vec2,
} from 'cc';
import {
  FIXED_RING_LINES_PX,
  FIXED_RING_PX,
  type IEmitterSettings,
  type IVfxRecipe,
  pickFixedRingLine,
  VFX_SHAPE_PX,
  type VfxShape,
} from '../logic/VfxRecipeLogic';

/** 캔버스 한 장에 그리는 순서. 칸 하나가 64×64px이다. `frost`는 따로 그린다(`buildFrostRings`) */
const SHAPE_ORDER: readonly VfxShape[] = ['glow', 'ring', 'shard', 'bolt'];

/** 서리 띠 그림의 한 변(px)과 장 수. 얼룩 모양이 다른 장을 돌려 끼워 띠가 일렁여 보이게 한다 */
const FROST_PX = 256;
const FROST_VARIANTS = 3;
/** 서리 띠 그림을 바꿔 끼우는 빠르기(초당 장) */
const FROST_FPS = 12;
/**
 * 서리 띠 그림에서 가장 밝은 마루가 놓이는 반지름 ÷ 그림 반지름. 마루가 피해 반경 위에 오게
 * `ringNodeSize`가 이 비율로 키운다. 마루 바깥으로 부드럽게 사라지는 가장자리가 그림 안에 남도록
 * 1보다 충분히 작게 둔다.
 */
const FROST_CREST = 0.8;

/** 이펙트 고리 그림(64px)의 선 두께(px) */
const RING_LINE_PX = 5;

/**
 * 이펙트 고리 그림에서 선 가운데가 놓이는 반지름 ÷ 그림 반지름. 노드 크기를 피해 반경의 지름으로
 * 두면 선은 그 안쪽(약 0.84배)에서 끝나므로, `ringNodeSize`가 지름을 이 비율로 나눠 키운다.
 */
const RING_FRAME_RATIO = (VFX_SHAPE_PX / 2 - RING_LINE_PX) / (VFX_SHAPE_PX / 2);

/** 판정 원 그림의 한 변(px)과 선 두께(px). 크게 그려야 판정 원 크기로 줄여도 선이 가늘게 남는다 */
const GUIDE_RING_PX = 256;

/**
 * 두께 고정 고리 그림에서 선 가운데 반지름 ÷ 그림 반지름. 가장 굵은 선의 바깥 끝이 그림 안에
 * 남도록 그 선 두께의 절반만큼(+1px) 안쪽에 그린다.
 */
const FIXED_RING_RATIO =
  (FIXED_RING_PX / 2 - Math.ceil(Math.max(...FIXED_RING_LINES_PX) / 2) - 1) / (FIXED_RING_PX / 2);

/** 두께 고정 고리가 화면에 보이는 선 두께(units) — 노바 끝(반경 120)에서 이펙트 고리보다 가늘다 */
const FIXED_RING_LINE_UNITS = 8;
const GUIDE_RING_LINE = 3;

/**
 * 판정 원 그림에서 선 가운데가 놓이는 반지름 ÷ 그림 반지름. 선 두께만큼 안쪽에 그려야 선이 그림
 * 밖으로 잘리지 않는다. 비교판은 이 비율로 그림을 키워 선을 실제 반경 위에 맞춘다.
 */
export const GUIDE_RING_RATIO = (GUIDE_RING_PX / 2 - GUIDE_RING_LINE) / (GUIDE_RING_PX / 2);

/** 방출 모양별 위치 흩어짐(px). 점은 0, 원은 사방, 선은 가로로만 */
const EMIT_SPREAD: Readonly<Record<string, [number, number]>> = {
  point: [0, 0],
  circle: [20, 20],
  line: [48, 0],
};

/**
 * 실험실 이펙트의 그림과 노드를 만드는 곳(계획 2026-10-12-magic-effect-gate-plan.md §4).
 *
 * 그림은 AI가 캔버스로 그린 임시 그림 넷이다(§3 d2 — 실제 그림 연결은 생산 슬라이스). 넷을 한
 * 텍스처에 모으는 것은 같은 텍스처 · 같은 섞기 방식이면 엔진이 한 번에 그릴 수 있게 하려는 것이다.
 * 실제로 묶이는지는 HUD의 드로우콜로 확인한다(§10 2-나).
 *
 * 가산 블렌드는 공개 API가 없어 렌더러의 내부 필드(`_srcBlendFactor` · `_dstBlendFactor`)를 쓴다.
 * 엔진은 컴포넌트가 켜질 때(`onEnable`) 이 값으로 머티리얼을 고치므로, 노드를 층에 붙이기 **전에**
 * 값을 넣어야 한다. 이 경로는 컴포넌트마다 머티리얼 사본을 만들어 방출기끼리 묶이지 않을 수 있다.
 */
export class VfxFactory {
  private readonly _frames = new Map<VfxShape, SpriteFrame>();
  private readonly _emitters: ParticleSystem2D[] = [];
  private readonly _counts = { emitters: 0, particles: 0 };
  private _solid: SpriteFrame | null = null;
  private _guideRing: SpriteFrame | null = null;
  private _fixedRings: SpriteFrame[] | null = null;
  private _frostRings: SpriteFrame[] | null = null;

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = VFX_SHAPE_PX * SHAPE_ORDER.length;
    canvas.height = VFX_SHAPE_PX;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      SHAPE_ORDER.forEach((shape, i) => {
        drawShape(ctx, shape, i * VFX_SHAPE_PX);
      });
    }
    const tex = new Texture2D();
    tex.image = new ImageAsset(canvas);
    SHAPE_ORDER.forEach((shape, i) => {
      const sf = new SpriteFrame();
      sf.reset({
        texture: tex,
        rect: new Rect(i * VFX_SHAPE_PX, 0, VFX_SHAPE_PX, VFX_SHAPE_PX),
        originalSize: new Size(VFX_SHAPE_PX, VFX_SHAPE_PX),
        offset: new Vec2(0, 0),
        isRotate: false,
      });
      this._frames.set(shape, sf);
    });
  }

  /** 그림 한 칸. `frost`는 서리 띠 그림의 첫 장이다. */
  frame(shape: VfxShape): SpriteFrame | null {
    if (shape === 'frost') return this._frost()[0];
    return this._frames.get(shape) ?? null;
  }

  /** 서리 띠 그림들 — 처음 쓸 때 그린다(픽셀마다 얼룩을 계산해서 다 후보가 없으면 그리지 않는다). */
  private _frost(): SpriteFrame[] {
    this._frostRings ??= buildFrostRings();
    return this._frostRings;
  }

  /**
   * 꽉 찬 흰 사각형 그림. 비교판의 배경 조각 · 더미 적을 칠한다. `Graphics`로 칠하면 같은 층의
   * 방출기 알갱이가 화면에 나오지 않아서(2026-10-14 웹 빌드에서 확인) 스프라이트로 칠한다.
   */
  solidFrame(): SpriteFrame {
    this._solid ??= canvasFrame(8, (ctx) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 8, 8);
    });
    return this._solid;
  }

  /**
   * 고리 노드의 지름 — 선 가운데(서리 띠는 가장 밝은 마루)가 `radius`에 오는 크기. 그림마다 선이
   * 그림 가장자리보다 안쪽에 있는 비율이 달라서(이펙트 고리 · 두께 고정 고리 · 서리 띠) 레시피를 보고
   * 고른다.
   * @param r 방식 다 레시피
   * @param radius 고리가 끝날 반경(피해 반경)
   */
  ringNodeSize(r: IVfxRecipe, radius: number): number {
    if (r.shape === 'frost') return (radius * 2) / FROST_CREST;
    return (radius * 2) / (r.fixedThickness ? FIXED_RING_RATIO : RING_FRAME_RATIO);
  }

  /**
   * 지금 쓸 고리 그림. 서리 띠면 시간에 따라 얼룩이 다른 장을 돌려 주고, 두께 고정이면 화면 지름에
   * 맞는 두께의 그림을, 아니면 늘 같은 이펙트 고리 그림을 준다. 커지는 동안 매 프레임 불러 바꿔 끼운다.
   * @param r 방식 다 레시피
   * @param displaySize 노드 지름 × 지금 배율(units)
   * @param t 고리가 나타난 뒤 지난 시간(초)
   */
  ringFrame(r: IVfxRecipe, displaySize: number, t: number): SpriteFrame | null {
    if (r.shape === 'frost') {
      const frames = this._frost();
      return frames[Math.floor(t * FROST_FPS) % frames.length];
    }
    if (!r.fixedThickness) return this.frame('ring');
    this._fixedRings ??= buildFixedRings();
    return this._fixedRings[pickFixedRingLine(FIXED_RING_LINE_UNITS / Math.max(1, displaySize))];
  }

  /**
   * 가는 흰 고리 그림(비교판의 판정 원). 이펙트용 고리 그림(64px)을 판정 원 크기로 키우면 선이
   * 10px 넘게 두꺼워져 이펙트 끝이 선 안쪽인지 바깥인지 가릴 수 없다.
   */
  guideRingFrame(): SpriteFrame {
    this._guideRing ??= canvasFrame(GUIDE_RING_PX, (ctx) => {
      const c = GUIDE_RING_PX / 2;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = GUIDE_RING_LINE;
      ctx.beginPath();
      ctx.arc(c, c, c * GUIDE_RING_RATIO, 0, Math.PI * 2);
      ctx.stroke();
    });
    return this._guideRing;
  }

  /** 지금 켜져 있는 방출기 수와 살아 있는 알갱이 합 — HUD가 매 프레임 읽는다. */
  liveCounts(): { emitters: number; particles: number } {
    // 측정 중 매 프레임 불리므로 새 객체를 만들지 않고 같은 칸을 고쳐 돌려준다
    const c = this._counts;
    c.emitters = 0;
    c.particles = 0;
    // 지워진 방출기는 이 자리에서 목록에서 뺀다. 비교판은 키 하나마다 모든 칸을 새로 만들고 옛
    // 방출기를 지우므로, 남겨 두면 다듬을수록 매 프레임 도는 목록이 끝없이 길어진다
    let keep = 0;
    for (const ps of this._emitters) {
      if (!ps.isValid) continue;
      this._emitters[keep++] = ps;
      if (!ps.node.activeInHierarchy) continue;
      c.emitters++;
      c.particles += ps.particleCount;
    }
    this._emitters.length = keep;
    return c;
  }

  /**
   * 방출기 노드를 만든다. 아직 층에 붙이지 않은 노드를 돌려주므로 호출부가 `parent`를 정한다.
   * @param r 레시피(덮어쓰기 적용 값)
   * @param s `emitterSettings`가 낸 값
   */
  makeEmitter(r: IVfxRecipe, s: IEmitterSettings): ParticleSystem2D {
    const node = new Node(`lab-${r.id}`);
    node.addComponent(UITransform);
    const ps = node.addComponent(ParticleSystem2D);
    ps.custom = true;
    ps.spriteFrame = this.frame(r.shape);
    ps.playOnLoad = false;
    ps.autoRemoveOnFinish = false;
    applyEmitter(ps, r, s);
    setBlend(ps, s.additive);
    this._emitters.push(ps);
    return ps;
  }

  /**
   * 정지 스프라이트 노드를 만든다(방식 다의 고리 · 바의 정지 표시 · 라의 몸체).
   * @param r 레시피 — 그림 · 색 · 섞기 방식을 쓴다
   * @param px 그릴 지름(px)
   */
  makeSprite(r: IVfxRecipe, px: number): Sprite {
    const node = new Node(`lab-${r.id}`);
    node.addComponent(UITransform).setContentSize(px, px);
    const sp = node.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.spriteFrame = this.frame(r.shape);
    sp.color = parseColor(r.color, 255);
    setBlend(sp, r.blend === 'add');
    return sp;
  }

  /**
   * 이미 만든 방출기에 새 값을 넣는다(터짐 반경이 시전마다 다를 때).
   * @param ps `makeEmitter`로 만든 방출기
   */
  retune(ps: ParticleSystem2D, r: IVfxRecipe, s: IEmitterSettings): void {
    applyEmitter(ps, r, s);
  }

  /**
   * 이미 만든 노드를 다른 후보의 모습으로 바꾼다(비교판에서 후보를 바꿀 때 풀의 노드를 다시 쓴다).
   * 섞기 방식은 컴포넌트가 켜질 때 머티리얼에 반영되므로 **노드가 꺼져 있을 때** 불러야 한다.
   * @param node `makeEmitter` · `makeSprite`로 만든 노드
   * @param r 새 레시피(덮어쓰기 적용 값)
   * @param s 방출기면 `emitterSettings`가 낸 값. 정지 스프라이트면 쓰지 않는다
   */
  restyle(node: Node, r: IVfxRecipe, s: IEmitterSettings): void {
    node.name = `lab-${r.id}`;
    const ps = node.getComponent(ParticleSystem2D);
    if (ps) {
      ps.spriteFrame = this.frame(r.shape);
      applyEmitter(ps, r, s);
      setBlend(ps, s.additive);
      return;
    }
    const sp = node.getComponent(Sprite);
    if (!sp) return;
    sp.spriteFrame = this.frame(r.shape);
    sp.color = parseColor(r.color, 255);
    setBlend(sp, r.blend === 'add');
  }
}

/** 레시피 값을 방출기에 옮긴다. 엔진 기본값이 남아 모양이 흔들리지 않게 흩어짐 값도 모두 정한다. */
function applyEmitter(ps: ParticleSystem2D, r: IVfxRecipe, s: IEmitterSettings): void {
  ps.totalParticles = s.totalParticles;
  ps.duration = s.duration;
  ps.emissionRate = s.emissionRate;
  ps.life = s.life;
  ps.lifeVar = 0;
  ps.emitterMode = ParticleSystem2D.EmitterMode.GRAVITY;
  ps.gravity = new Vec2(0, 0);
  ps.speed = s.speed;
  ps.speedVar = s.speed * 0.2;
  ps.tangentialAccel = 0;
  ps.tangentialAccelVar = 0;
  ps.radialAccel = 0;
  ps.radialAccelVar = 0;
  ps.angle = 90;
  ps.angleVar = s.angleVar;
  ps.startSize = s.startSize;
  ps.startSizeVar = 0;
  ps.endSize = s.endSize;
  ps.endSizeVar = 0;
  ps.startSpin = 0;
  ps.startSpinVar = 0;
  ps.endSpin = 0;
  ps.endSpinVar = 0;
  const [vx, vy] = EMIT_SPREAD[r.emitShape] ?? EMIT_SPREAD.point;
  ps.posVar = new Vec2(vx, vy);
  ps.startColor = parseColor(r.color, 255);
  ps.startColorVar = new Color(0, 0, 0, 0);
  ps.endColor = parseColor(r.color, 0);
  ps.endColorVar = new Color(0, 0, 0, 0);
  ps.positionType = s.worldSpace
    ? ParticleSystem2D.PositionType.FREE
    : ParticleSystem2D.PositionType.RELATIVE;
}

/**
 * 섞기 방식을 정한다. 노드가 켜지기 전에 불러야 엔진이 켜질 때 머티리얼에 반영한다.
 * @param additive true면 가산(SRC_ALPHA, ONE), false면 보통 알파
 */
function setBlend(r: UIRenderer, additive: boolean): void {
  const raw = r as unknown as { _srcBlendFactor: number; _dstBlendFactor: number };
  raw._srcBlendFactor = gfx.BlendFactor.SRC_ALPHA;
  raw._dstBlendFactor = additive ? gfx.BlendFactor.ONE : gfx.BlendFactor.ONE_MINUS_SRC_ALPHA;
}

/**
 * 두께 고정 고리 그림들을 한 텍스처에 가로로 그려 칸마다 그림으로 나눈다. 한 텍스처라서 매 프레임
 * 그림을 바꿔 끼워도 같은 텍스처끼리 묶여 그려진다.
 */
function buildFixedRings(): SpriteFrame[] {
  const n = FIXED_RING_LINES_PX.length;
  const canvas = document.createElement('canvas');
  canvas.width = FIXED_RING_PX * n;
  canvas.height = FIXED_RING_PX;
  const ctx = canvas.getContext('2d');
  const c = FIXED_RING_PX / 2;
  if (ctx) {
    ctx.strokeStyle = '#fff';
    FIXED_RING_LINES_PX.forEach((line, i) => {
      ctx.lineWidth = line;
      ctx.beginPath();
      ctx.arc(i * FIXED_RING_PX + c, c, c * FIXED_RING_RATIO, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  const tex = new Texture2D();
  tex.image = new ImageAsset(canvas);
  return FIXED_RING_LINES_PX.map((_, i) => {
    const sf = new SpriteFrame();
    sf.reset({
      texture: tex,
      rect: new Rect(i * FIXED_RING_PX, 0, FIXED_RING_PX, FIXED_RING_PX),
      originalSize: new Size(FIXED_RING_PX, FIXED_RING_PX),
      offset: new Vec2(0, 0),
      isRotate: false,
    });
    return sf;
  });
}

/**
 * 서리 띠 그림들을 한 텍스처에 가로로 그린다(방식 다 후보 da3). 반듯한 선 대신 안쪽에서 차오르다
 * 마루에서 가장 밝고 바깥으로 부드럽게 사라지는 두꺼운 띠다. 띠 가장자리는 각도마다 출렁이고, 띠
 * 안은 얼룩(겹친 값 노이즈)으로 비치는 정도가 달라 서리처럼 보인다. 장마다 시드가 달라 돌려 끼우면
 * 얼룩이 일렁인다. 흰색 · 회색만 그리고 색은 스프라이트가 곱한다.
 */
function buildFrostRings(): SpriteFrame[] {
  const canvas = document.createElement('canvas');
  canvas.width = FROST_PX * FROST_VARIANTS;
  canvas.height = FROST_PX;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(FROST_PX * FROST_VARIANTS, FROST_PX);
    for (let v = 0; v < FROST_VARIANTS; v++) drawFrost(img, v * FROST_PX, v + 1);
    ctx.putImageData(img, 0, 0);
  }
  const tex = new Texture2D();
  tex.image = new ImageAsset(canvas);
  return Array.from({ length: FROST_VARIANTS }, (_, i) => {
    const sf = new SpriteFrame();
    sf.reset({
      texture: tex,
      rect: new Rect(i * FROST_PX, 0, FROST_PX, FROST_PX),
      originalSize: new Size(FROST_PX, FROST_PX),
      offset: new Vec2(0, 0),
      isRotate: false,
    });
    return sf;
  });
}

/** 서리 띠 한 장을 `img`의 x0 칸에 픽셀로 칠한다. */
function drawFrost(img: ImageData, x0: number, seed: number): void {
  const half = FROST_PX / 2;
  const phase = seed * 1.7;
  for (let y = 0; y < FROST_PX; y++) {
    for (let x = 0; x < FROST_PX; x++) {
      const dx = x + 0.5 - half;
      const dy = y + 0.5 - half;
      const d = Math.hypot(dx, dy) / half;
      const a = Math.atan2(dy, dx);
      // 띠 가장자리가 각도마다 출렁인다 — 반듯한 원이면 파동처럼 보인다
      const wob =
        0.03 * Math.sin(5 * a + phase) +
        0.02 * Math.sin(9 * a - phase * 2) +
        0.012 * Math.sin(17 * a + phase * 3);
      const crest = FROST_CREST + wob * 0.5;
      const inner = smoothstep(0.4, crest - 0.04, d) ** 1.3;
      const outer = 1 - smoothstep(crest, Math.min(0.99, crest + 0.13 + wob), d);
      const band = inner * outer;
      if (band <= 0.002) continue;
      const n = fbm(x, y, seed);
      const ridge = Math.exp(-(((d - crest) / 0.05) ** 2));
      // 띠 안 드문드문 밝은 얼음 알갱이
      const speck = hash(x, y, seed + 31) > 0.993 ? 1 : 0;
      const alpha = Math.min(1, band * (0.25 + 0.95 * n) + ridge * 0.12 + speck * band);
      const bright = Math.min(1, 0.55 + 0.2 * ridge + 0.35 * n + speck);
      const i = (y * img.width + x0 + x) * 4;
      img.data[i] = 255 * bright;
      img.data[i + 1] = 255 * bright;
      img.data[i + 2] = 255 * bright;
      img.data[i + 3] = 255 * alpha;
    }
  }
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** 정수 격자점의 0~1 난수(시드별로 다르고 늘 같은 값). */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** 격자 칸 안을 부드럽게 이은 값 노이즈. */
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smoothstep(0, 1, x - xi);
  const v = smoothstep(0, 1, y - yi);
  const top = hash(xi, yi, seed) * (1 - u) + hash(xi + 1, yi, seed) * u;
  const bottom = hash(xi, yi + 1, seed) * (1 - u) + hash(xi + 1, yi + 1, seed) * u;
  return top * (1 - v) + bottom * v;
}

/** 크기가 다른 값 노이즈 셋을 겹친 얼룩(0~1). 큰 구름 위에 잔 얼룩이 얹힌다. */
function fbm(x: number, y: number, seed: number): number {
  return (
    valueNoise(x / 28, y / 28, seed) * 0.55 +
    valueNoise(x / 12, y / 12, seed + 7) * 0.3 +
    valueNoise(x / 5, y / 5, seed + 13) * 0.15
  );
}

/** 정사각 캔버스 한 장에 그려 그림 하나로 만든다. */
function canvasFrame(px: number, draw: (ctx: CanvasRenderingContext2D) => void): SpriteFrame {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const tex = new Texture2D();
  tex.image = new ImageAsset(canvas);
  const sf = new SpriteFrame();
  sf.texture = tex;
  return sf;
}

/** `#rrggbb` → Color. 레시피 검증을 통과한 값만 들어온다. */
function parseColor(hex: string, alpha: number): Color {
  const n = Number.parseInt(hex.slice(1), 16);
  return new Color((n >> 16) & 255, (n >> 8) & 255, n & 255, alpha);
}

/** 흰 그림 하나를 칸에 그린다. 색은 방출기 · 스프라이트가 곱한다. */
function drawShape(ctx: CanvasRenderingContext2D, shape: VfxShape, x0: number): void {
  const c = VFX_SHAPE_PX / 2;
  const cx = x0 + c;
  ctx.save();
  switch (shape) {
    case 'glow': {
      const g = ctx.createRadialGradient(cx, c, 0, cx, c, c);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, VFX_SHAPE_PX, VFX_SHAPE_PX);
      break;
    }
    case 'ring':
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = RING_LINE_PX;
      ctx.beginPath();
      ctx.arc(cx, c, c - RING_LINE_PX, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'shard':
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(x0 + 4, c);
      ctx.lineTo(cx, c - 10);
      ctx.lineTo(x0 + VFX_SHAPE_PX - 4, c);
      ctx.lineTo(cx, c + 10);
      ctx.closePath();
      ctx.fill();
      break;
    case 'bolt':
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x0 + 2, c);
      ctx.lineTo(x0 + 18, c - 12);
      ctx.lineTo(x0 + 30, c + 10);
      ctx.lineTo(x0 + 44, c - 10);
      ctx.lineTo(x0 + 62, c);
      ctx.stroke();
      break;
  }
  ctx.restore();
}
