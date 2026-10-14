import {
  _decorator,
  Color,
  Component,
  instantiate,
  Node,
  ParticleSystem2D,
  type Prefab,
  Sprite,
  type SpriteFrame,
  UITransform,
} from 'cc';
import {
  applyOverrides,
  COMPARE_LIVE_HALF,
  chainPoints,
  classColorName,
  compareColumns,
  compareGrid,
  emitterSettings,
  type ICompareGrid,
  type ITuneFields,
  type IVfxRecipe,
  COMPARE_LABEL_SPACE as LABEL_SPACE,
  type MethodKey,
  nextClassColor,
  ringPose,
  VFX_SHAPE_PX,
} from '../logic/VfxRecipeLogic';
import { setRingFrame } from './LabVfxSink';
import { GUIDE_RING_RATIO, type VfxFactory } from './VfxFactory';

const { ccclass } = _decorator;

/** 비교판 칸에 그릴 게임 값. 마법 데이터에서 읽고, 못 읽으면 지금 데이터 값으로 둔다. */
export interface ICompareRefs {
  /** 가의 판정 원 — 파이어볼 폭발 반경 */
  burstRadius: number;
  /** 다의 판정 원 — 프로스트 노바 반경 */
  novaRadius: number;
  /** 나의 궤도 — 인페르노 오브 궤도 반경 · 회전 속도(도/초) */
  orbitRadius: number;
  orbitDegPerSec: number;
  /** 라의 발사체 속도 — 아이스 미사일 */
  projectileSpeed: number;
}

/** 「현재」 칸에 띄울 지금 게임의 프리팹. 연결이 없으면 그 행을 만들지 않는다. */
export interface ICurrentPrefabs {
  explosion: Prefab | null;
  nova: Prefab | null;
  orb: Prefab | null;
}

/** 칸 위쪽 글자 하나. 좌표는 격자 가운데 기준(units)이다. */
export interface ICompareLabel {
  text: string;
  x: number;
  y: number;
  selected: boolean;
}

/** 후보 한 행. 다듬은 값은 행마다 따로 든다 — 같은 방식의 다른 후보로 넘어가도 지워지지 않게. */
interface IRow {
  /** null이면 「현재」(지금 프리팹) 행 */
  base: IVfxRecipe | null;
  tune: ITuneFields;
  sizeScale: number;
  countScale: number;
  /** `C` 키로 바꿔 본 분류색. null이면 레시피 색 */
  color: string | null;
  copies: ICopy[];
}

/**
 * 한 칸 안에서 겹쳐 그리는 이펙트 하나. 매 프레임 `step`을 부르고 행을 다시 만들 때 `dispose`한다.
 * 만든 순간이 주기의 시작이다(첫 터짐은 만들 때 한다).
 */
interface ICopy {
  /**
   * @param t 재생 시계(초) — 궤도 · 발사체처럼 끊기지 않고 움직이는 것이 쓴다
   * @param local 공유 주기 안의 시각(초)
   * @param restart 이번 프레임에 새 주기가 시작됐다 — 터짐 · 고리 · 선이 다시 시작한다
   */
  step(dt: number, t: number, local: number, restart: boolean): void;
  dispose(): void;
}

/** 칸 안의 밝은 배경 조각 색. 가산 이펙트가 밝은 바닥에서 사라지는지 보려는 것이다. */
const BRIGHT_PATCH = new Color(200, 200, 200, 255);
/** 판정 원 색. 화염 · 얼음 · 번개 어느 분류색과도 겹치지 않는 자홍색이다. */
const JUDGE_RING = new Color(255, 64, 255, 220);
/** 바의 더미 적 색 */
const DUMMY = new Color(90, 90, 110, 255);
/** 바의 더미 적 한 변(px) — 지금 적 그림의 대략 크기 */
const DUMMY_PX = 40;
/** 바의 표시를 더미 발밑이 아니라 몸 가운데에 띄우는 높이 — `StatusVfxOverlay`와 같은 값 */
const STATUS_OFFSET_Y = 24;
/** 한 번 재생이 끝나고 다음 재생까지 쉬는 시간(초) — 끝 모양을 눈으로 볼 틈 */
const REPLAY_GAP = 0.5;
/** 「현재」 프리팹의 표시 시간(초) — `SpellCaster`의 폭발 · 노바 표시 시간과 같다 */
const CURRENT_VFX_SEC = 0.25;
/** 라 칸에서 발사체가 지나가는 길이의 절반(units) */
const TRAVEL_HALF = 100;
/** 마 칸에서 시전 자리부터 마지막 적까지 가로 길이의 절반(units) — 적 8마리가 서로 붙지 않는 폭 */
const CHAIN_HALF = 170;
/** 마의 더미 적 한 변(px) — 적 8마리가 나란히 들어가게 바의 더미보다 작다 */
const CHAIN_DUMMY_PX = 24;
/** 마의 지그재그가 적 둘을 잇는 곧은 선에서 벗어나는 최대 폭(units) */
const BOLT_JITTER = 22;
/** 마의 번개가 적 하나에서 다음 적으로 넘어가는 데 걸리는 시간(초) — 거쳐 가는 순서가 보이게 */
const CHAIN_HOP_SEC = 0.06;
/** 마의 지그재그 모양을 바꾸는 빠르기(초당 번) — 번개가 떨려 보이게 */
const BOLT_FLICKER_FPS = 30;

/**
 * 이펙트 비교판의 그림 쪽(계획 2026-10-12-magic-effect-gate-plan.md §4 · §8). `VfxLab`이 비교판
 * 모드에서 격자 노드에 붙이고, 키 · 글자 · 내려받기는 `VfxLab`이 맡는다. 격자는 화면 오른쪽에 있고,
 * 가운데에서는 캐릭터가 고른 칸의 후보로 실제 마법을 더미 적에게 쏜다(`LabVfxSink`).
 *
 * 행은 그 방식의 후보들과 「현재」(가 · 다 · 나만 — 지금 게임의 프리팹), 열은 `compareColumns`가
 * 정한다. 다는 강화 단계(판정 반경 1 · 1.5 · 2배)이고 — 노바는 겹칠 일이 없어 강화로 커지는
 * 모습을 본다 — 나머지는 겹침 1× · 4× · 셋째 단계(계획 §7.2)다. 같은 칸의 복사본은 모두 한 점에
 * 겹쳐 그린다. 판정 원(가 · 다)은 이펙트 위에 그려서 끝이 원 위에 있는지 보이게 한다.
 *
 * 칸마다 오른쪽 절반에 밝은 배경 조각을 깐다. 가산 섞기는 밝은 바닥에서 하얗게 타서 사라지기
 * 때문에, 어두운 바닥에서만 보면 실제 맵의 밝은 곳에서 안 보이는 후보를 고르게 된다.
 */
@ccclass('VfxCompareBoard')
export class VfxCompareBoard extends Component {
  private _method: MethodKey = 'ga';
  private _factory: VfxFactory | null = null;
  private _refs: ICompareRefs | null = null;
  private _prefabs: ICurrentPrefabs = { explosion: null, nova: null, orb: null };
  private _rows: IRow[] = [];
  private _grid: ICompareGrid | null = null;
  private _selected = 0;
  /** 재생 시계(초). `R` 키가 0으로 돌린다 */
  private _t = 0;
  /** 모든 행이 함께 쓰는 재생 주기(초) — 가장 긴 수명 + 쉬는 시간 */
  private _cycle = 1;
  /** 주기 안에서 스크린샷을 찍을 때(초) — 가장 짧은 수명의 절반, 모든 행이 아직 보이는 때 */
  private _captureAt = 0;
  private _captureMoment = false;
  private _back: Node | null = null;
  private _front: Node | null = null;
  private _fx: Node | null = null;

  /** 격자가 쓰는 뷰 세로 절반 — `VfxLab`이 카메라 orthoHeight로 맞춘다 */
  get halfHeight(): number {
    return this._grid?.halfHeight ?? 0;
  }

  /** 고른 행의 원본 레시피. 「현재」 행이면 null */
  get selectedBase(): IVfxRecipe | null {
    return this._rows[this._selected]?.base ?? null;
  }

  /** 고른 행의 덮어쓰기 적용 값 — 가운데 실제 마법에 입힐 모습. 「현재」 행이면 null */
  get selectedEffective(): IVfxRecipe | null {
    const row = this._rows[this._selected];
    return row?.base ? this._effective(row) : null;
  }

  /** 고른 행의 다듬은 값 */
  get selectedTune(): ITuneFields {
    return this._rows[this._selected]?.tune ?? {};
  }

  /** 이번 프레임이 스크린샷을 찍을 때다 — 모든 행의 이펙트가 한꺼번에 화면에 떠 있다 */
  get atCaptureMoment(): boolean {
    return this._captureMoment;
  }

  /**
   * 격자를 만들고 재생을 시작한다.
   * @param method 보여 줄 방식
   * @param candidates 그 방식의 후보(레시피 파일 순서)
   * @param initial 후보 id → 처음 다듬은 값 · 배율(URL의 `tune` · `sizeScale` · `countScale`은 고른 후보에만 온다)
   * @param pickedId 처음 고를 행 — URL의 `pick` 또는 레시피 파일의 「고름」
   * @param aspect 화면 가로 ÷ 세로
   * @param minHalfHeight 평소 카메라 orthoHeight
   */
  setup(
    method: MethodKey,
    candidates: readonly IVfxRecipe[],
    initial: Readonly<Record<string, { tune: ITuneFields; sizeScale: number; countScale: number }>>,
    pickedId: string | undefined,
    factory: VfxFactory,
    refs: ICompareRefs,
    prefabs: ICurrentPrefabs,
    aspect: number,
    minHalfHeight: number,
  ): void {
    this._method = method;
    this._factory = factory;
    this._refs = refs;
    this._prefabs = prefabs;
    this._rows = candidates.map((base) => ({
      base,
      tune: { ...(initial[base.id]?.tune ?? {}) },
      sizeScale: initial[base.id]?.sizeScale ?? 1,
      countScale: initial[base.id]?.countScale ?? 1,
      color: null,
      copies: [],
    }));
    if (this._currentPrefab()) {
      this._rows.push({
        base: null,
        tune: {},
        sizeScale: 1,
        countScale: 1,
        color: null,
        copies: [],
      });
    }
    this._selected = Math.max(
      0,
      this._rows.findIndex((r) => r.base?.id === pickedId),
    );
    // 격자는 가운데 실제 마법 자리(캐릭터 둘레)를 비우고 그 오른쪽에 붙인다
    this._grid = compareGrid(
      this._rows.length,
      3,
      this._cellRadius(),
      aspect,
      minHalfHeight,
      COMPARE_LIVE_HALF,
    );

    // 뒤 그림(배경 조각 · 더미) → 이펙트 → 앞 그림(판정 원) 순서로 형제를 둔다
    this._back = new Node('Back');
    this.node.addChild(this._back);
    this._fx = new Node('Fx');
    this.node.addChild(this._fx);
    this._front = new Node('Front');
    this.node.addChild(this._front);
    this._drawGuides();
    this.replay();
  }

  // 공유 주기로 시계를 진행해 모든 칸을 같은 순간에 다시 터뜨린다
  update(dt: number) {
    const prev = this._t;
    this._t += dt;
    const local = this._t % this._cycle;
    const restart = Math.floor(this._t / this._cycle) > Math.floor(prev / this._cycle);
    const prevLocal = restart ? -1 : prev % this._cycle;
    this._captureMoment = prevLocal < this._captureAt && local >= this._captureAt;
    for (const row of this._rows) for (const c of row.copies) c.step(dt, this._t, local, restart);
  }

  onDestroy() {
    for (const row of this._rows) for (const c of row.copies) c.dispose();
  }

  /**
   * 고를 행을 옮긴다. 「현재」 행은 다듬을 것이 없어 건너뛴다.
   * @param dir 1이면 다음, −1이면 앞
   */
  moveSelection(dir: 1 | -1): void {
    const n = this._rows.length;
    for (let k = 1; k <= n; k++) {
      const i = (((this._selected + dir * k) % n) + n) % n;
      if (this._rows[i].base) {
        this._selected = i;
        return;
      }
    }
  }

  /**
   * 고른 행의 다듬은 값을 바꾸고 모든 행을 처음부터 다시 재생한다. 그 행만 다시 만들면 그 행만
   * 다른 순간에 터져서 행끼리 나란히 비교할 수 없다(수명이 바뀌면 공유 주기도 바뀐다).
   * @param tune 새 다듬은 값. 빈 객체면 레시피 값으로 되돌린다(URL 배율 · `C`로 바꾼 색도 함께 지운다)
   */
  setSelectedTune(tune: ITuneFields): void {
    this._changeSelected((row) => {
      row.tune = tune;
      if (Object.keys(tune).length === 0) {
        row.sizeScale = 1;
        row.countScale = 1;
        row.color = null;
      }
    });
  }

  /**
   * 고른 행의 색을 다음 분류색(화염 → 얼음 → 번개)으로 바꾸고 모든 행을 다시 재생한다.
   * @returns 바꾼 색의 이름. 「현재」 행이면 null
   */
  cycleSelectedColor(): string | null {
    const row = this._rows[this._selected];
    if (!row?.base) return null;
    const next = nextClassColor(this._effective(row).color);
    this._changeSelected((r) => {
      r.color = next.color;
    });
    return next.name;
  }

  /** 고른 행 하나를 고치고 모든 행을 처음부터 다시 재생한다. 「현재」 행이면 아무것도 안 한다. */
  private _changeSelected(edit: (row: IRow) => void): void {
    const row = this._rows[this._selected];
    if (!row?.base) return;
    edit(row);
    this.replay();
  }

  /** 공유 주기를 다시 잡고 재생 시계를 처음으로 돌린다 — 모든 칸이 같은 순간에 다시 터진다. */
  replay(): void {
    const lives = this._rows.map((row) => (row.base ? this._effective(row).life : CURRENT_VFX_SEC));
    this._cycle = Math.max(...lives) + REPLAY_GAP;
    this._captureAt = Math.min(...lives) / 2;
    this._t = 0;
    for (let i = 0; i < this._rows.length; i++) this._buildRow(i);
  }

  /** 행 이름 · 열 머리 글자와 그 자리(격자 가운데 기준 units). */
  labels(): ICompareLabel[] {
    const g = this._grid;
    if (!g) return [];
    const out: ICompareLabel[] = [];
    this._rows.forEach((row, ri) => {
      const r = row.base ? this._effective(row) : null;
      const cols = this._columns(r);
      const head = r
        ? `${r.id} · ${classColorName(r.color)} · ${r.blend === 'add' ? '가산' : '알파'} · 수 ${r.count} · 크기 ${r.size} · 수명 ${r.life}${r.speed !== undefined ? ` · 속도 ${r.speed}` : ''}`
        : '현재(지금 게임 프리팹)';
      const top = g.cells[ri][0].y + g.cellH / 2 - 2;
      out.push({
        text: head,
        x: g.cells[ri][0].x - g.cellW / 2 + 4,
        y: top,
        selected: ri === this._selected,
      });
      // 열 글자는 칸 오른쪽 끝에 둔다 — 왼쪽에 두면 긴 행 이름이 옆 칸의 열 글자를 덮는다
      g.cells[ri].forEach((cell, ci) => {
        out.push({
          text: cols[ci].label,
          x: cell.x + g.cellW / 2 - 10 - cols[ci].label.length * 10,
          y: top - LABEL_SPACE / 2,
          selected: false,
        });
      });
    });
    return out;
  }

  /** 행 하나의 덮어쓰기 적용 값. */
  private _effective(row: IRow): IVfxRecipe {
    const r = applyOverrides(row.base as IVfxRecipe, row.tune, row.sizeScale, row.countScale);
    if (row.color) r.color = row.color;
    return r;
  }

  /** 한 행의 열 셋. 「현재」 행은 후보 수명이 없어 0으로 센다(가의 셋째 단계 하한이 된다). */
  private _columns(r: IVfxRecipe | null) {
    return compareColumns(this._method, r?.life ?? 0, this._refs?.novaRadius ?? 0);
  }

  /** 칸 크기를 정하는 반경 — 가장 큰 열의 판정 원이나 움직이는 길이가 칸 안에 들어가야 한다. */
  private _cellRadius(): number {
    const refs = this._refs as ICompareRefs;
    switch (this._method) {
      case 'ga':
        return refs.burstRadius;
      case 'da':
        return refs.novaRadius * Math.max(...this._columns(null).map((c) => c.radiusScale));
      case 'na':
        return refs.orbitRadius + 20;
      case 'ba':
        return 50;
      case 'ma':
        return CHAIN_HALF;
      default:
        return TRAVEL_HALF;
    }
  }

  /** 「현재」 행에 쓸 프리팹 — 가 · 다 · 나만 지금 게임에 그림이 있다. */
  private _currentPrefab(): Prefab | null {
    if (this._method === 'ga') return this._prefabs.explosion;
    if (this._method === 'da') return this._prefabs.nova;
    if (this._method === 'na') return this._prefabs.orb;
    return null;
  }

  /** 배경 조각 · 더미 적 · 판정 원을 놓는다. 칸 배치가 바뀌지 않으므로 한 번만 놓는다. */
  private _drawGuides(): void {
    const g = this._grid;
    const back = this._back;
    const front = this._front;
    const factory = this._factory;
    if (!g || !back || !front || !factory) return;
    const solid = factory.solidFrame();
    // 위쪽 글자 자리는 비워 둔다 — 밝은 조각 위에 흰 글자가 얹히면 읽히지 않는다
    const patchH = g.cellH - LABEL_SPACE;
    for (const row of g.cells)
      for (const c of row) {
        guide(
          back,
          solid,
          BRIGHT_PATCH,
          g.cellW / 2,
          patchH,
          c.x + g.cellW / 4,
          c.y - LABEL_SPACE / 2,
        );
        if (this._method === 'ba') guide(back, solid, DUMMY, DUMMY_PX, DUMMY_PX, c.x, c.y);
      }
    if (this._method === 'ma') {
      // 번개가 거쳐 갈 더미 적 — 0번(시전 자리)은 적이 아니라 비운다
      const cols = this._columns(null);
      for (const row of g.cells)
        row.forEach((c, ci) => {
          for (const p of chainPoints(cols[ci].targets, CHAIN_HALF).slice(1))
            guide(back, solid, DUMMY, CHAIN_DUMMY_PX, CHAIN_DUMMY_PX, c.x + p.x, c.y + p.y);
        });
    }
    const ring = factory.guideRingFrame();
    const refs = this._refs as ICompareRefs;
    const judge =
      this._method === 'ga' ? refs.burstRadius : this._method === 'da' ? refs.novaRadius : 0;
    if (judge > 0) {
      // 판정 원 그림의 선 가운데는 그림 반지름의 GUIDE_RING_RATIO 자리다 — 그만큼 키워야 선이 판정 원 위에 온다
      const cols = this._columns(null);
      for (const row of g.cells)
        row.forEach((c, ci) => {
          const d = (judge * cols[ci].radiusScale * 2) / GUIDE_RING_RATIO;
          guide(front, ring, JUDGE_RING, d, d, c.x, c.y);
        });
    }
  }

  /** 행 하나의 복사본을 모두 지우고 지금 값으로 다시 만든다. */
  private _buildRow(ri: number): void {
    const row = this._rows[ri];
    const g = this._grid;
    if (!row || !g) return;
    for (const c of row.copies) c.dispose();
    row.copies = [];
    const r = row.base ? this._effective(row) : null;
    const cols = this._columns(r);
    g.cells[ri].forEach((cell, ci) => {
      const { copies, radiusScale, targets } = cols[ci];
      for (let k = 0; k < copies; k++) {
        const copy = r
          ? this._makeCopy(r, cell.x, cell.y, radiusScale, targets)
          : this._makeCurrent(cell.x, cell.y, radiusScale);
        if (copy) row.copies.push(copy);
      }
    });
  }

  /**
   * 후보 하나를 칸 가운데에 띄운다. 방식마다 게임 안에서 움직이는 모양을 흉내 낸다.
   * @param radiusScale 열의 판정 반경 배율 — 다만 1이 아니다
   * @param targets 열의 거쳐 가는 적 수 — 마만 쓴다
   */
  private _makeCopy(
    r: IVfxRecipe,
    x: number,
    y: number,
    radiusScale: number,
    targets: number,
  ): ICopy | null {
    const factory = this._factory;
    const refs = this._refs;
    const fx = this._fx;
    if (!factory || !refs || !fx) return null;
    switch (r.method) {
      case 'ga':
        return burstCopy(factory, fx, r, x, y, refs.burstRadius);
      case 'na':
        return orbitCopy(factory.makeEmitter(r, emitterSettings(r, {})).node, fx, x, y, refs, true);
      case 'da':
        return ringCopy(factory, fx, r, x, y, refs.novaRadius * radiusScale);
      case 'ra':
        return projectileCopy(factory, fx, r, x, y, refs.projectileSpeed);
      case 'ma':
        return chainCopy(factory, fx, r, x, y, targets);
      case 'ba':
        return statusCopy(factory, fx, r, x, y);
    }
  }

  /**
   * 「현재」 행의 프리팹 하나를 칸 가운데에 띄운다.
   * @param radiusScale 열의 판정 반경 배율 — 노바 프리팹을 그만큼 키운다
   */
  private _makeCurrent(x: number, y: number, radiusScale: number): ICopy | null {
    const prefab = this._currentPrefab();
    const fx = this._fx;
    const refs = this._refs;
    if (!prefab || !fx || !refs) return null;
    if (this._method === 'na') {
      const node = instantiate(prefab);
      return orbitCopy(node, fx, x, y, refs, false);
    }
    return prefabBurstCopy(prefab, fx, x, y, radiusScale);
  }
}

/** 칸 안내 그림 하나(배경 조각 · 더미 · 판정 원)를 놓는다. 크기는 w × h, 자리는 가운데 기준. */
function guide(
  parent: Node,
  frame: SpriteFrame,
  color: Color,
  w: number,
  h: number,
  x: number,
  y: number,
): void {
  const node = new Node('Guide');
  node.addComponent(UITransform).setContentSize(w, h);
  const sp = node.addComponent(Sprite);
  sp.sizeMode = Sprite.SizeMode.CUSTOM;
  sp.spriteFrame = frame;
  sp.color = color;
  parent.addChild(node);
  node.setPosition(x, y, 0);
}

/** 가: 터짐 방출기. 주기마다 다시 뿜고, 속도는 판정 원 반경에 맞춘다. */
function burstCopy(
  factory: VfxFactory,
  parent: Node,
  r: IVfxRecipe,
  x: number,
  y: number,
  radius: number,
): ICopy {
  const ps = factory.makeEmitter(r, emitterSettings(r, { radius }));
  parent.addChild(ps.node);
  ps.node.setPosition(x, y, 0);
  ps.resetSystem();
  return {
    step(_dt, _t, _local, restart) {
      if (restart) ps.resetSystem();
    },
    dispose() {
      ps.node.destroy();
    },
  };
}

/** 나 · 「현재」 오브: 궤도를 도는 노드. 방출기면 세상 좌표 꼬리가 궤도 뒤에 남는다. */
function orbitCopy(
  node: Node,
  parent: Node,
  x: number,
  y: number,
  refs: ICompareRefs,
  isEmitter: boolean,
): ICopy {
  parent.addChild(node);
  const place = (t: number) => {
    const a = (t * refs.orbitDegPerSec * Math.PI) / 180;
    node.setPosition(x + Math.cos(a) * refs.orbitRadius, y + Math.sin(a) * refs.orbitRadius, 0);
  };
  place(0);
  if (isEmitter) node.getComponent(ParticleSystem2D)?.resetSystem();
  return {
    step(_dt, t) {
      place(t);
    },
    dispose() {
      node.destroy();
    },
  };
}

/** 다: 고리 스프라이트가 끝 크기(그 열의 판정 반경)까지 커지며 사라진다(`ringPose`). 주기마다 다시. */
function ringCopy(
  factory: VfxFactory,
  parent: Node,
  r: IVfxRecipe,
  x: number,
  y: number,
  radius: number,
): ICopy {
  const sprite = factory.makeSprite(r, VFX_SHAPE_PX);
  parent.addChild(sprite.node);
  // 고리 그림의 선은 그림 가장자리보다 안쪽에 있어서, 선이 판정 원 위에서 끝나게 그만큼 키운다
  const d = factory.ringNodeSize(r, radius);
  sprite.node.getComponent(UITransform)?.setContentSize(d, d);
  sprite.node.setPosition(x, y, 0);
  const base = sprite.color.clone();
  const show = (local: number) => {
    const visible = local < r.life;
    sprite.node.active = visible;
    if (!visible) return;
    const p = ringPose(local / r.life, r);
    sprite.node.setScale(p.scale, p.scale, 1);
    sprite.node.angle = p.angle;
    setRingFrame(factory, sprite, r, d * p.scale, local);
    sprite.color = new Color(base.r, base.g, base.b, Math.round(255 * p.alpha));
  };
  show(0);
  return {
    step(_dt, _t, local) {
      show(local);
    },
    dispose() {
      sprite.node.destroy();
    },
  };
}

/** 라: 파편 몸체가 칸을 왼쪽에서 오른쪽으로 지나가고 세상 좌표 꼬리를 남긴다. 끝에 닿으면 처음으로. */
function projectileCopy(
  factory: VfxFactory,
  parent: Node,
  r: IVfxRecipe,
  x: number,
  y: number,
  speed: number,
): ICopy {
  const body = factory.makeSprite(r, VFX_SHAPE_PX * r.size);
  parent.addChild(body.node);
  const tail = factory.makeEmitter(r, emitterSettings(r, { projectileSpeed: speed }));
  body.node.addChild(tail.node);
  tail.resetSystem();
  const span = TRAVEL_HALF * 2;
  let lastD = 0;
  body.node.setPosition(x - TRAVEL_HALF, y, 0);
  return {
    step(_dt, t) {
      const d = (t * speed) % span;
      body.node.setPosition(x - TRAVEL_HALF + d, y, 0);
      // 끝에서 처음으로 돌아갈 때 꼬리가 칸을 가로질러 그어지지 않게 남은 알갱이를 지운다
      if (d < lastD) tail.resetSystem();
      lastD = d;
    },
    dispose() {
      body.node.destroy();
    },
  };
}

/**
 * 마: 시전 자리에서 더미 적 `targets`마리를 차례로 거쳐 가는 번개. 이웃한 두 자리를 번개 조각
 * 스프라이트 여러 개로 지그재그로 잇고, 한 구간을 `strands` 가닥으로 긋는다. 구간은 앞 구간보다
 * `CHAIN_HOP_SEC`만큼 늦게 나타나 거쳐 가는 순서가 보이고, 보이는 동안 모양을 계속 바꿔 떤다.
 * @param targets 거쳐 가는 적 수(열의 강화 단계)
 */
function chainCopy(
  factory: VfxFactory,
  parent: Node,
  r: IVfxRecipe,
  x: number,
  y: number,
  targets: number,
): ICopy {
  const segs = Math.max(1, r.segments ?? 1);
  const strands = Math.max(1, r.strands ?? 1);
  const pts = chainPoints(targets, CHAIN_HALF).map((p) => ({ x: x + p.x, y: y + p.y }));
  const thick = VFX_SHAPE_PX * r.size;
  // links[i] = i번 자리에서 i+1번 자리로 가는 구간의 가닥들, 가닥 하나는 조각 segs개
  const links: Sprite[][][] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const link: Sprite[][] = [];
    for (let k = 0; k < strands; k++) {
      const pieces: Sprite[] = [];
      for (let j = 0; j < segs; j++) {
        const sp = factory.makeSprite(r, VFX_SHAPE_PX);
        parent.addChild(sp.node);
        pieces.push(sp);
      }
      link.push(pieces);
    }
    links.push(link);
  }
  const reshape = (i: number) => {
    const a = pts[i];
    const b = pts[i + 1];
    for (const pieces of links[i]) zigzag(pieces, a.x, a.y, b.x, b.y, thick);
  };
  let lastFlicker = -1;
  const show = (local: number) => {
    const flicker = Math.floor(local * BOLT_FLICKER_FPS);
    links.forEach((link, i) => {
      const start = i * CHAIN_HOP_SEC;
      const visible = local >= start && local < start + r.life;
      for (const pieces of link) for (const p of pieces) p.node.active = visible;
      if (visible && flicker !== lastFlicker) reshape(i);
    });
    lastFlicker = flicker;
  };
  show(0);
  return {
    step(_dt, _t, local) {
      show(local);
    },
    dispose() {
      for (const link of links) for (const pieces of link) for (const p of pieces) p.node.destroy();
    },
  };
}

/**
 * 조각 스프라이트들을 (ax, ay)에서 (bx, by)까지 지그재그로 늘어놓는다. 양 끝은 두 자리에 붙이고,
 * 사이의 꺾이는 점만 곧은 선에서 수직으로 최대 `BOLT_JITTER`만큼 흔든다.
 * @param thick 조각 두께(units)
 */
function zigzag(
  pieces: readonly Sprite[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  thick: number,
): void {
  const n = pieces.length;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  // 곧은 선에 수직인 단위 벡터
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  let px = ax;
  let py = ay;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    const off = i === n - 1 ? 0 : (Math.random() * 2 - 1) * BOLT_JITTER;
    const qx = ax + (bx - ax) * t + nx * off;
    const qy = ay + (by - ay) * t + ny * off;
    const node = pieces[i].node;
    node.getComponent(UITransform)?.setContentSize(Math.hypot(qx - px, qy - py), thick);
    node.setPosition((px + qx) / 2, (py + qy) / 2, 0);
    node.angle = (Math.atan2(qy - py, qx - px) * 180) / Math.PI;
    px = qx;
    py = qy;
  }
}

/** 바: 더미 적 위에 상태 표시(루프 방출기 또는 정지 스프라이트)를 붙인다. */
function statusCopy(factory: VfxFactory, parent: Node, r: IVfxRecipe, x: number, y: number): ICopy {
  const node =
    r.statusKind === 'loop'
      ? factory.makeEmitter(r, emitterSettings(r, {})).node
      : factory.makeSprite(r, VFX_SHAPE_PX * r.size).node;
  parent.addChild(node);
  node.setPosition(x, y + STATUS_OFFSET_Y, 0);
  node.getComponent(ParticleSystem2D)?.resetSystem();
  return {
    step() {},
    dispose() {
      node.destroy();
    },
  };
}

/**
 * 「현재」 폭발 · 노바: 지금 프리팹을 주기마다 새로 만들어 표시 시간 뒤 지운다. 크기는 게임과 같은
 * 1에 열의 판정 반경 배율을 곱한다. 프리팹의 애니메이션은 노드가 처음 켜질 때 한 번 돌기 때문에,
 * 껐다 켜지 않고 새로 만든다.
 * @param scale 열의 판정 반경 배율
 */
function prefabBurstCopy(prefab: Prefab, parent: Node, x: number, y: number, scale: number): ICopy {
  let node: Node | null = null;
  const clear = () => {
    node?.destroy();
    node = null;
  };
  const spawn = () => {
    clear();
    node = instantiate(prefab);
    parent.addChild(node);
    node.setPosition(x, y, 0);
    node.setScale(scale, scale, 1);
  };
  spawn();
  return {
    step(_dt, _t, local, restart) {
      if (restart) spawn();
      else if (node && local >= CURRENT_VFX_SEC) clear();
    },
    dispose() {
      clear();
    },
  };
}
