import { type ISpellData, UpgradeOption } from '../data/GameTypes';
import type { IDebugEnhancementSeed } from './DebugEnhancementSeed';
import { UPGRADE_CAP } from './EnhancementLogic';

/**
 * 이펙트 방식 키 여섯(계획 2026-10-12-magic-effect-gate-plan.md §8.1).
 * ga 터짐 · na 계속 뿜기 · da 모양 그림 커지기 · ra 고체 모양 발사체 · ma 두 점을 잇는 선 · ba 적에게 붙는 상태 표시.
 */
export type MethodKey = 'ga' | 'na' | 'da' | 'ra' | 'ma' | 'ba';

/**
 * 임시 그림 다섯. 앞의 넷은 캔버스 한 장(256×64)에 64×64씩 나란히 그린다. `frost`(다의 서리 띠)는
 * 판정 원 크기로 키워도 얼룩이 뭉개지지 않게 256px 그림 셋을 따로 그린다.
 */
export type VfxShape = 'glow' | 'ring' | 'shard' | 'bolt' | 'frost';

/**
 * 후보 하나의 레시피 — `resources/data/vfx-lab.json`의 한 줄. 공통 필드 아래의 선택 필드는
 * 방식마다 필수인 것이 다르고 `validateRecipe`가 확인한다.
 */
export interface IVfxRecipe {
  id: string;
  method: MethodKey;
  shape: VfxShape;
  /** 알갱이 수(방출기의 totalParticles). 정지 스프라이트 후보는 1 */
  count: number;
  /** 알갱이 수명(초) */
  life: number;
  /** 알갱이 크기 배율(64px 그림 기준) */
  size: number;
  /** `#rrggbb` */
  color: string;
  blend: 'add' | 'alpha';
  /** 방출 모양 — 점 · 원 · 선 등. 조립은 `VfxFactory`가 한다 */
  emitShape: string;
  /** 레시피 파일에서 측정 기본값으로 고른 후보 */
  picked: boolean;
  /** 나: 알갱이를 세상 좌표에 남기나(움직이는 것 뒤에 꼬리가 남는다) */
  worldSpace?: boolean;
  /** 나: 초당 방출 수 */
  rate?: number;
  /** 나 · 바: 알갱이 속도(units/sec) */
  speed?: number;
  /** 다: 커지는 동안 고리 두께를 고정하나 */
  fixedThickness?: boolean;
  /** 다: 수명 끝의 크기 배율 */
  endSize?: number;
  /** 다: 커지며 투명해지나 */
  fade?: boolean;
  /** 다: 처음에 빨리 퍼지고 끝에서 느려지나(없으면 같은 빠르기) */
  easeOut?: boolean;
  /** 다: 수명의 이 비율부터 투명해진다(0 이상 1 미만, 없으면 0 — 처음부터) */
  fadeFrom?: number;
  /** 다: 수명 동안 도는 각도(도). 얼룩 그림이 돌며 일렁여 보인다 */
  spin?: number;
  /** 라: 꼬리 길이(units) */
  tailLength?: number;
  /** 라: 꼬리 초당 방출 수 */
  tailRate?: number;
  /** 마: 선 위 알갱이 수 또는 지그재그 조각 수 */
  segments?: number;
  /** 마: 적 둘 사이를 잇는 지그재그 가닥 수(없으면 1). 가닥마다 꺾이는 자리가 달라 굵게 갈라져 보인다 */
  strands?: number;
  /** 바: 작은 루프 방출기인지 가산 정지 스프라이트인지 */
  statusKind?: 'loop' | 'sprite';
}

/** 키로 다듬을 수 있는 값. `tune` 파라미터와 같은 이름이다. */
export interface ITuneFields {
  count?: number;
  size?: number;
  life?: number;
  speed?: number;
  rate?: number;
}

export type TuneMap = Partial<Record<MethodKey, ITuneFields>>;

/** 실험실 오류 한 건. 화면 위쪽 오류 상자에 그대로 띄운다. */
export interface ILabError {
  /** 무엇이 틀렸나 */
  problem: string;
  /** 왜 그것이 문제인가 */
  cause: string;
  /** 어떻게 고치나 */
  fix: string;
  /** 더 볼 곳 */
  ref: string;
}

/**
 * URL에서 만든 실험실 상태. 컴포넌트는 URL을 직접 읽지 않고 이 값만 읽는다 — 한 곳에서 해석해야
 * 스포너는 측정 모드로, 플레이어는 보통 모드로 읽는 식의 어긋남이 생기지 않는다.
 */
export interface ILabMode {
  /** `lab` 파라미터가 있고 레시피 파일도 있다 */
  enabled: boolean;
  kind: 'compare' | 'measure' | null;
  /** 비교판이 보여 줄 방식 */
  method: MethodKey | null;
  load: 'base' | 'max';
  /** 방식별 후보 id — 파라미터에 없으면 레시피 파일의 「고름」 */
  picks: Partial<Record<MethodKey, string>>;
  /** 켜 둘 방식. null이면 전부 */
  only: MethodKey[] | null;
  counts: number[];
  tune: TuneMap;
  sizeScale: Partial<Record<MethodKey, number>>;
  countScale: Partial<Record<MethodKey, number>>;
  blockSec: number;
  /** 오류가 있어 실험실을 시작하지 않는다(오류 상자만 띄운다) */
  startBlocked: boolean;
}

/** 모든 방식 키(표시 순서). */
export const METHOD_KEYS: readonly MethodKey[] = ['ga', 'na', 'da', 'ra', 'ma', 'ba'];

/** HUD 대응표에 쓰는 방식 이름. */
export const METHOD_NAMES: Readonly<Record<MethodKey, string>> = {
  ga: '가. 터짐',
  na: '나. 계속 뿜기',
  da: '다. 모양 그림 커지기',
  ra: '라. 고체 모양 발사체',
  ma: '마. 두 점을 잇는 선',
  ba: '바. 적에게 붙는 상태 표시',
};

/** 오류 상자의 「참고」 — 사용자가 고칠 URL을 찾는 곳. */
const LAB_REF = 'docs/qa/magic-effect-gate-test.md §5(URL과 회차 표)';

const DEFAULT_COUNTS = [63, 200, 400];
const DEFAULT_BLOCK_SEC = 10;
const TUNE_FIELDS: readonly (keyof ITuneFields)[] = ['count', 'size', 'life', 'speed', 'rate'];
const SHAPES: readonly VfxShape[] = ['glow', 'ring', 'shard', 'bolt', 'frost'];

/** 방식마다 반드시 있어야 하는 선택 필드. 빠지면 `VfxFactory`가 그 방식을 조립할 수 없다. */
const REQUIRED_BY_METHOD: Readonly<Record<MethodKey, readonly (keyof IVfxRecipe)[]>> = {
  ga: [],
  na: ['worldSpace', 'rate', 'speed'],
  da: ['fixedThickness', 'endSize', 'fade'],
  ra: ['tailLength', 'tailRate'],
  ma: ['segments'],
  ba: ['statusKind', 'speed'],
};

/** 터짐 겹침 셋째 단계의 하한 · 상한 — 하한은 흔한 최대(9발)를 넉넉히 덮는 10, 상한은 더미 수 50 */
const OVERLAP_STEP_MIN = 10;
const OVERLAP_STEP_MAX = 50;

/** 값이 유한한 양수인가. */
function isPositive(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/** 방식 키인가. */
function isMethod(v: string): v is MethodKey {
  return (METHOD_KEYS as readonly string[]).includes(v);
}

/** 오류 객체를 만든다(참고는 늘 QA 문서의 URL 절). */
function labError(problem: string, cause: string, fix: string): ILabError {
  return { problem, cause, fix, ref: LAB_REF };
}

/**
 * 레시피 하나를 검증한다. 공통 필드와 그 방식의 필수 필드를 본다.
 * @returns 오류 목록. 문제없으면 빈 배열
 */
export function validateRecipe(r: IVfxRecipe): ILabError[] {
  const errors: ILabError[] = [];
  const where = `레시피 ${r.id}`;
  const file = 'resources/data/vfx-lab.json';
  if (!isMethod(r.method)) {
    errors.push(
      labError(
        `${where}: 방식 '${r.method}'를 모른다`,
        '방식은 ga · na · da · ra · ma · ba 여섯뿐이다',
        `${file}에서 이 후보의 method를 고친다`,
      ),
    );
    return errors;
  }
  if (!SHAPES.includes(r.shape)) {
    errors.push(
      labError(
        `${where}: 그림 종류 '${r.shape}'를 모른다`,
        '임시 그림은 glow · ring · shard · bolt · frost 다섯뿐이다',
        `${file}에서 shape를 고친다`,
      ),
    );
  }
  for (const f of ['count', 'life', 'size'] as const) {
    if (!isPositive(r[f])) {
      errors.push(
        labError(
          `${where}: ${f}가 양수가 아니다`,
          '알갱이 수 · 수명 · 크기가 0이면 아무것도 그려지지 않는다',
          `${file}에서 ${f}에 양수를 넣는다`,
        ),
      );
    }
  }
  if (r.blend !== 'add' && r.blend !== 'alpha') {
    errors.push(
      labError(
        `${where}: 섞기 방식 '${r.blend}'를 모른다`,
        '섞기 방식은 add(가산) · alpha 둘뿐이다',
        `${file}에서 blend를 고친다`,
      ),
    );
  }
  if (r.strands !== undefined && !(Number.isInteger(r.strands) && r.strands >= 1)) {
    errors.push(
      labError(
        `${where}: strands ${r.strands}가 양의 정수가 아니다`,
        'strands는 적 둘 사이에 긋는 지그재그 가닥 수라 1 이상의 정수여야 한다',
        `${file}에서 strands를 1 이상의 정수로 고친다`,
      ),
    );
  }
  if (r.fadeFrom !== undefined && !(r.fadeFrom >= 0 && r.fadeFrom < 1)) {
    errors.push(
      labError(
        `${where}: fadeFrom ${r.fadeFrom}이 0 이상 1 미만이 아니다`,
        'fadeFrom은 수명 중 투명해지기 시작하는 비율이라 1이면 끝까지 불투명하다가 갑자기 사라진다',
        `${file}에서 fadeFrom을 0 이상 1 미만으로 고친다`,
      ),
    );
  }
  for (const f of REQUIRED_BY_METHOD[r.method]) {
    if (r[f] === undefined) {
      errors.push(
        labError(
          `${where}: ${f} 필드가 없다`,
          `${METHOD_NAMES[r.method]} 방식은 ${f}가 있어야 방출기를 조립할 수 있다`,
          `${file}의 ${r.id} 후보에 ${f}를 넣는다`,
        ),
      );
    }
  }
  return errors;
}

/**
 * 방출기 하나에 살아 있는 알갱이 수를 추정한다. 방출이 수명보다 빠르면 상한(totalParticles)에서 멈춘다.
 * @param totalParticles 방출기 상한
 * @param emissionRate 초당 방출 수
 * @param life 알갱이 수명(초)
 */
export function estimateParticles(
  totalParticles: number,
  emissionRate: number,
  life: number,
): number {
  return Math.min(totalParticles, emissionRate * life);
}

/**
 * 터짐 알갱이가 수명 끝에 판정 원에 닿는 속도. 속도 × 수명 = 반경이어야 이펙트의 끝이 실제 피해
 * 반경과 맞는다 — 레시피에 속도를 따로 두면 반경 강화로 피해 원이 커질 때 그림만 그대로 남는다.
 * @param radius 피해 반경(units)
 * @param life 알갱이 수명(초)
 */
export function burstSpeedForRadius(radius: number, life: number): number {
  return radius / life;
}

/** 임시 그림 한 칸의 크기(px). 레시피의 size는 이 크기에 곱하는 배율이다. */
export const VFX_SHAPE_PX = 64;

/** 두께 고정 고리 그림 한 장의 한 변(px) */
export const FIXED_RING_PX = 256;

/**
 * 두께 고정 고리 그림들의 선 두께(px, 한 변 `FIXED_RING_PX` 기준). 고리가 작을 때는 굵은 선, 클
 * 때는 가는 선 그림을 써서 화면에 보이는 두께를 일정하게 한다. 대략 1.35배 간격이라 바꿔 끼울 때
 * 두께가 튀는 것이 눈에 띄지 않는다. 선 바깥 끝이 그림 밖으로 잘리지 않는 상한이 25px이다.
 */
export const FIXED_RING_LINES_PX: readonly number[] = [2, 3, 4, 5, 7, 9, 12, 16, 20, 25];

/**
 * 두께 고정 고리에서 지금 쓸 그림 번호. 원하는 상대 두께(화면 선 두께 ÷ 화면 지름)에 가장 가까운
 * 그림을 고른다. 범위를 벗어나면 끝 그림을 쓴다 — 고리가 막 나타난 아주 작은 순간에는 선이 원하는
 * 두께보다 조금 가늘어진다.
 * @param lineRel 원하는 선 두께 ÷ 화면 지름
 */
export function pickFixedRingLine(lineRel: number): number {
  let best = 0;
  for (let i = 1; i < FIXED_RING_LINES_PX.length; i++) {
    const d = Math.abs(FIXED_RING_LINES_PX[i] / FIXED_RING_PX - lineRel);
    if (d < Math.abs(FIXED_RING_LINES_PX[best] / FIXED_RING_PX - lineRel)) best = i;
  }
  return best;
}

/** 터짐이 알갱이를 다 뿜는 시간(초). 0이면 엔진이 한 프레임에 몰아 뿜지 못해 수가 모자란다. */
const BURST_EMIT_SEC = 0.05;

/** 방출기 하나에 넣을 값. `VfxFactory`가 `ParticleSystem2D`에 그대로 옮긴다. */
export interface IEmitterSettings {
  totalParticles: number;
  /** 뿜는 시간(초). -1이면 멈출 때까지 */
  duration: number;
  emissionRate: number;
  life: number;
  speed: number;
  /** 방출 방향의 흔들림(도). 180이면 사방 */
  angleVar: number;
  startSize: number;
  endSize: number;
  /** 알갱이를 세상 좌표에 남기나 — 움직이는 방출기 뒤에 꼬리가 남는다 */
  worldSpace: boolean;
  additive: boolean;
}

/**
 * 레시피 하나를 방출기 값으로 바꾼다. 방식 다(고리 그림)와 바의 정지 스프라이트는 방출기가 아니라
 * 스프라이트라서 이 함수를 쓰지 않는다.
 *
 * - 가. 터짐: 짧은 시간에 count개를 다 뿜고, 속도는 `burstSpeedForRadius`로 피해 반경에 맞춘다.
 * - 나. 계속 뿜기: 레시피의 방출률 · 속도 · 세상 좌표를 그대로 쓴다.
 * - 라. 고체 발사체의 꼬리: 꼬리 길이만큼 발사체가 나아가는 동안 살아 있게 수명을 잡는다.
 * - 바. 루프 상태 표시: 수명 동안 count개가 유지되게 방출률을 잡는다.
 * - 마. 선 위 알갱이: 터짐처럼 한 번 뿜되 퍼지지 않는다(선 모양은 조립하는 쪽이 준다).
 * @param r 레시피(덮어쓰기를 적용한 값)
 * @param ctx radius = 가의 피해 반경, projectileSpeed = 라의 발사체 속도
 */
export function emitterSettings(
  r: IVfxRecipe,
  ctx: { radius?: number; projectileSpeed?: number },
): IEmitterSettings {
  const startSize = VFX_SHAPE_PX * r.size;
  const out: IEmitterSettings = {
    totalParticles: r.count,
    duration: -1,
    emissionRate: r.count / r.life,
    life: r.life,
    speed: r.speed ?? 0,
    angleVar: 180,
    startSize,
    endSize: startSize * 0.3,
    worldSpace: false,
    additive: r.blend === 'add',
  };
  switch (r.method) {
    case 'ga':
      out.duration = BURST_EMIT_SEC;
      out.emissionRate = r.count / BURST_EMIT_SEC;
      out.speed = burstSpeedForRadius(ctx.radius ?? 0, r.life);
      break;
    case 'na':
      out.emissionRate = r.rate ?? out.emissionRate;
      out.worldSpace = r.worldSpace ?? false;
      break;
    case 'ra': {
      const rate = r.tailRate ?? 0;
      out.life = (r.tailLength ?? 0) / (ctx.projectileSpeed ?? 1);
      out.emissionRate = rate;
      out.totalParticles = Math.max(1, Math.ceil(rate * out.life) + 1);
      out.speed = 0;
      out.worldSpace = true;
      break;
    }
    case 'ma':
      out.duration = BURST_EMIT_SEC;
      out.emissionRate = r.count / BURST_EMIT_SEC;
      out.speed = 0;
      out.endSize = startSize;
      break;
    default:
      break;
  }
  return out;
}

/**
 * 블록 전환 뒤 통계에서 뺄 시간(초) = max(1초, 레시피 최대 수명). 1초로 고정하면 수명이 1초를
 * 넘는 레시피의 알갱이가 끔 블록에 남아, 끔 쪽이 비싸져 몫이 작게 나온다.
 */
export function discardSeconds(recipes: readonly IVfxRecipe[]): number {
  return Math.max(1, ...recipes.map((r) => r.life));
}

/**
 * 터짐 겹침 시험의 셋째 단계. 한 번 시전한 perCast발이 같은 무리에 맞고, 수명이 쿨다운을 넘으면
 * 다음 시전의 터짐이 겹친다 — perCast × ⌈수명 ÷ 쿨다운⌉. 결과는 10~50으로 자른다.
 * @param life 고른 후보의 수명(초)
 * @param cooldown 마법 쿨다운(초)
 * @param perCast 한 번 시전의 발사체 수(최대 강화)
 */
export function burstOverlapStep(life: number, cooldown: number, perCast: number): number {
  const raw = perCast * Math.ceil(life / cooldown);
  return Math.min(OVERLAP_STEP_MAX, Math.max(OVERLAP_STEP_MIN, raw));
}

/**
 * 동시에 켜진 상태 표시 수의 위 끝 = 초당 명중 × 확률 × 지속. 명중마다 아직 상태가 없는 다른 적을
 * 맞힌다고 본 값이다.
 */
export function concurrentStatusCount(
  hitsPerSec: number,
  chance: number,
  durationSec: number,
): number {
  return hitsPerSec * chance * durationSec;
}

/** 가의 대표인 파이어볼의 쿨다운(초)과 최대 강화 한 번 시전의 발사체 수(계획 §7.2) */
const BURST_REF_COOLDOWN = 0.5;
const BURST_REF_PER_CAST = 9;
/** 바의 셋째 단계 — 동시에 켜진 상태 표시 수의 위 끝(계획 §7.1의 합, 약 27) */
const STATUS_OVERLAP_STEP = 27;

/**
 * 비교판 겹침 시험의 셋째 단계(계획 §7.2). 가는 후보 수명에 따라 터짐이 다음 시전과 겹치므로
 * `burstOverlapStep`으로 칸마다 계산하고, 바는 동시 표시 수 27, 나머지는 넉넉한 하한 10이다.
 * @param life 그 칸 후보의 수명(초) — 가만 쓴다
 */
export function compareThirdStep(method: MethodKey, life: number): number {
  if (method === 'ga') return burstOverlapStep(life, BURST_REF_COOLDOWN, BURST_REF_PER_CAST);
  if (method === 'ba') return STATUS_OVERLAP_STEP;
  return OVERLAP_STEP_MIN;
}

/** 다의 강화 단계 열 — 노바 피해 반경에 곱하는 배율. 강화하면 반경이 이만큼 넓어진다고 가정한다 */
export const NOVA_LEVEL_SCALES: readonly number[] = [1, 1.5, 2];

/** 마의 강화 단계 열 — 번개가 거쳐 가는 적 수. 강화하면 더 많은 적을 거쳐 간다고 가정한다 */
export const CHAIN_LEVEL_TARGETS: readonly number[] = [3, 5, 8];

/** 비교판 열 하나 — 한 칸에 겹쳐 띄울 수, 판정 반경 배율, 거쳐 가는 적 수(마만, 나머지는 0), 열 머리 글자 */
export interface ICompareColumn {
  copies: number;
  radiusScale: number;
  targets: number;
  label: string;
}

/**
 * 비교판의 열 셋. 다(노바)는 캐릭터 하나가 2초마다 한 번 터뜨려 겹칠 일이 없으므로, 겹침 대신
 * 강화 단계마다 판정 반경과 고리가 함께 커지는지를 본다(`NOVA_LEVEL_SCALES`). 마(체인 라이트닝)도
 * 강화가 겹침이 아니라 거쳐 가는 적 수를 늘리므로 적 수 단계다(`CHAIN_LEVEL_TARGETS`). 둘 다 지금
 * 게임 코드에 없는 강화라 가정한 값이다. 나머지 방식은 겹침 1× · 4× · 셋째 단계다.
 * @param life 그 칸 후보의 수명(초) — 가의 셋째 단계에 쓴다
 * @param novaRadius 노바의 지금 피해 반경 — 다의 열 글자에 쓴다
 */
export function compareColumns(
  method: MethodKey,
  life: number,
  novaRadius: number,
): ICompareColumn[] {
  if (method === 'da') {
    return NOVA_LEVEL_SCALES.map((k) => ({
      copies: 1,
      radiusScale: k,
      targets: 0,
      label: `반경 ${Math.round(novaRadius * k)}`,
    }));
  }
  if (method === 'ma') {
    return CHAIN_LEVEL_TARGETS.map((n) => ({
      copies: 1,
      radiusScale: 1,
      targets: n,
      label: `적 ${n}`,
    }));
  }
  return [1, 4, compareThirdStep(method, life)].map((n) => ({
    copies: n,
    radiusScale: 1,
    targets: 0,
    label: `${n}×`,
  }));
}

/** 체인 자리에서 적이 가운데 줄에서 위아래로 벗어나는 폭(칸 가로 절반에 대한 비율) */
const CHAIN_SWAY = 0.35;

/**
 * 마 칸의 체인 자리 — 0번은 시전 자리(칸 왼쪽 끝), 1~n번은 번개가 차례로 거쳐 가는 적이다. 적은
 * 오른쪽으로 고르게 나아가며 가운데 줄 위아래로 번갈아 놓여, 적이 많아도 선이 겹치지 않고 꺾여 보인다.
 * @param n 거쳐 가는 적 수
 * @param half 칸 가운데에서 양 끝까지의 거리(units)
 * @returns 칸 가운데 기준 좌표 n + 1개
 */
export function chainPoints(n: number, half: number): { x: number; y: number }[] {
  const pts = [{ x: -half, y: 0 }];
  for (let k = 1; k <= n; k++) {
    pts.push({ x: -half + (2 * half * k) / n, y: (k % 2 === 1 ? 1 : -1) * half * CHAIN_SWAY });
  }
  return pts;
}

/** 다의 고리가 처음 나타나는 크기(끝 크기에 대한 비율) */
export const RING_START_SCALE = 0.15;

/**
 * 다의 고리가 수명 중 한 순간에 가질 크기 배율 · 불투명도 · 각도. 가운데 실제 마법과 비교판 칸이
 * 같은 모습으로 움직이게 둘 다 이 함수를 쓴다.
 * @param k 수명 중 지난 비율(0~1)
 * @param r 다 후보 — endSize · fade · easeOut · fadeFrom · spin을 읽는다
 * @returns scale = 노드 배율, alpha = 0~1, angle = 도
 */
export function ringPose(
  k: number,
  r: IVfxRecipe,
): { scale: number; alpha: number; angle: number } {
  const t = Math.min(1, Math.max(0, k));
  const grow = r.easeOut ? 1 - (1 - t) * (1 - t) : t;
  const scale = (r.endSize ?? 1) * (RING_START_SCALE + (1 - RING_START_SCALE) * grow);
  const from = r.fadeFrom ?? 0;
  const alpha = r.fade === false || t <= from ? 1 : 1 - (t - from) / (1 - from);
  return { scale, alpha, angle: (r.spin ?? 0) * t };
}

/** 분류색 셋(화염 · 얼음 · 번개) — 레시피 파일 후보들이 쓰는 색과 같다. `C` 키가 이 순서로 돈다. */
const CLASS_COLORS: readonly { color: string; name: string }[] = [
  { color: '#ff6a2a', name: '화염' },
  { color: '#7fd6ff', name: '얼음' },
  { color: '#ffe14d', name: '번개' },
];

/**
 * 비교판 `C` 키의 다음 분류색. 4번 물음(색만 바꿔도 화염 · 얼음 · 번개로 보이나)은 머릿속으로
 * 색을 바꿔 상상하면 판정이 흔들려서, 같은 모양을 실제 색으로 바꿔 본다. 가산 섞기는 색마다 하얗게
 * 타는 겹 수도 달라서 2번 물음도 색별로 다시 볼 수 있다.
 * @param color 지금 색 `#rrggbb`(대소문자 무관)
 * @returns 다음 분류색과 이름. 분류색이 아니면 화염부터
 */
export function nextClassColor(color: string): { color: string; name: string } {
  const i = CLASS_COLORS.findIndex((c) => c.color === color.toLowerCase());
  return { ...CLASS_COLORS[(i + 1) % CLASS_COLORS.length] };
}

/** 분류색 이름. 분류색이 아니면 색 값 그대로 */
export function classColorName(color: string): string {
  return CLASS_COLORS.find((c) => c.color === color.toLowerCase())?.name ?? color;
}

/** 비교판 숫자 키로 다듬는 필드. 방출률(`rate`)은 키가 없고 `tune`으로만 바꾼다. */
export type TuneKeyField = 'count' | 'size' | 'life' | 'speed';

/** 숫자 키 하나의 뜻 — 필드를 배율만큼 바꾸거나, 칸을 레시피 값으로 되돌린다. */
export type TuneKeyAction = { field: TuneKeyField; factor: number } | 'reset';

/** 키 1 · 2 = 알갱이 수, 3 · 4 = 크기, 5 · 6 = 수명, 7 · 8 = 속도. 홀수는 −10%, 짝수는 +10% */
const TUNE_KEY_FIELDS: readonly TuneKeyField[] = ['count', 'size', 'life', 'speed'];

/**
 * 비교판 키 코드를 다듬기 동작으로 바꾼다. `KeyboardEvent.code`를 받는다 — 한글 입력기가 켜져
 * 있으면 `key`가 'Process'로 오는 일이 있어 글자 대신 자판 위치를 본다.
 * @param code `Digit1` · `Numpad1` 같은 키 코드
 * @returns 숫자 키 1~8이면 필드와 배율, 0이면 'reset', 그 밖은 null
 */
export function tuneKeyAction(code: string): TuneKeyAction | null {
  const m = /^(?:Digit|Numpad)([0-8])$/.exec(code);
  if (!m) return null;
  const n = Number(m[1]);
  if (n === 0) return 'reset';
  return { field: TUNE_KEY_FIELDS[Math.floor((n - 1) / 2)], factor: n % 2 === 1 ? 0.9 : 1.1 };
}

/**
 * 칸 하나의 다듬은 값에 키 한 번을 적용한 새 값을 낸다. 지금 값(다듬은 값, 없으면 레시피 값)에서
 * 배율만큼 바꾼다. 알갱이 수는 1 이상의 정수이고, 반올림해서 그대로면 한 개씩 움직인다 — 그래야
 * 수가 작을 때(4 × 1.1 = 4.4) 키를 눌러도 값이 멈추지 않는다. 나머지는 소수 셋째 자리까지 남긴다.
 * @param base 그 칸의 레시피(덮어쓰기 전 원본)
 * @param cur 지금까지 다듬은 값
 * @returns 새 값. 그 방식에 속도 필드가 없거나 값이 0이면 null(`tune`은 양수만 받는다)
 */
export function stepTune(
  base: IVfxRecipe,
  cur: ITuneFields,
  field: TuneKeyField,
  factor: number,
): ITuneFields | null {
  const now = cur[field] ?? base[field];
  if (!isPositive(now)) return null;
  let next: number;
  if (field === 'count') {
    next = Math.round(now * factor);
    if (next === now) next = now + (factor > 1 ? 1 : -1);
    next = Math.max(1, next);
  } else {
    next = Math.round(now * factor * 1000) / 1000;
  }
  return { ...cur, [field]: next };
}

/** 비교판 칸에서 판정 원 바깥에 두는 여백 배율과 칸 위쪽 글자 자리(units) */
const COMPARE_CELL_PAD = 1.3;
export const COMPARE_LABEL_SPACE = 36;
/** 오른쪽 정렬 격자와 화면 오른쪽 끝 사이 여백(units) — 끝 칸이 화면 가장자리에 잘려 보이지 않게 */
const COMPARE_EDGE_MARGIN = 24;

/**
 * 비교판 가운데 실제 마법 자리의 절반 폭(units). 캐릭터가 이 안의 더미 적에게 마법을 쏘고, 격자는
 * 이 오른쪽에 붙는다. 노바 반경(120)과 더미 적이 서는 둘레(`MEASURE_SPAWN_CLEAR_RADIUS` 150 바깥)를
 * 함께 담는 크기다.
 */
export const COMPARE_LIVE_HALF = 260;

/** 비교판 가운데에 세우는 더미 적 수. 가운데 터짐 · 상태 표시가 여럿 겹쳐 보일 만큼이다. */
export const COMPARE_DUMMY_COUNT = 12;

/** 방식별로 비교판 가운데서 쏘는 마법 — 그 방식의 v1 대표(계획 §8.1). 마는 게임 코드가 없다. */
const COMPARE_SPELLS: Readonly<Record<MethodKey, readonly string[]>> = {
  ga: ['fireball'],
  na: ['inferno'],
  da: ['frost_nova'],
  ra: ['ice_missile'],
  ba: ['ice_missile', 'lightning_bolt'],
  ma: [],
};

/**
 * 비교판 가운데서 캐릭터가 쏠 마법 id. 그 방식의 이펙트가 게임 안에서 어떻게 보이는지만 보려는
 * 것이라, 다른 마법의 이펙트가 섞이지 않게 그 방식을 쓰는 마법만 쏜다.
 */
export function compareSpellIds(method: MethodKey): string[] {
  return [...COMPARE_SPELLS[method]];
}

/** 비교판 격자. 칸은 정사각형이고 좌표는 카메라 가운데가 원점이다. */
export interface ICompareGrid {
  /** 카메라 orthoHeight로 쓸 뷰 세로 절반(units) */
  halfHeight: number;
  cellW: number;
  cellH: number;
  /** `cells[행][열]` 칸 가운데. 0행이 맨 위, 0열이 맨 왼쪽이다 */
  cells: { x: number; y: number }[][];
}

/**
 * 비교판 격자를 잡는다. 칸 하나에 판정 원(지름 2 × radius)과 여백, 위쪽 글자 자리가 들어가야
 * 이펙트 끝이 원 위에 있는지 볼 수 있다. 그 크기로 행 · 열을 다 담지 못하면 뷰를 넓힌다 — 칸을
 * 줄이면 판정 원이 실제 피해 반경과 달라져 3번 물음(끝이 원 위에 있나)을 판정할 수 없다.
 * @param rows 행 수(후보 + 「현재」)
 * @param cols 열 수(겹침 1× · 4× · 셋째 단계)
 * @param radius 칸에 그릴 판정 원 반경(units)
 * @param aspect 화면 가로 ÷ 세로
 * @param minHalfHeight 평소 뷰 세로 절반 — 이보다 좁히지 않는다
 * @param leftReserve 카메라 가운데에서 오른쪽으로 비워 둘 폭(units). 0이면 격자를 가운데에 놓고,
 *   양수면 격자 왼쪽 끝을 이 자리에 붙인다(가운데 실제 마법 자리를 가리지 않게)
 */
export function compareGrid(
  rows: number,
  cols: number,
  radius: number,
  aspect: number,
  minHalfHeight: number,
  leftReserve = 0,
): ICompareGrid {
  const cell = radius * 2 * COMPARE_CELL_PAD + COMPARE_LABEL_SPACE;
  // 가운데 정렬이면 격자 반폭이, 오른쪽 정렬이면 비운 폭 + 격자 폭이 뷰 가로 절반 안에 들어가야 한다
  const needHalfW =
    leftReserve > 0 ? leftReserve + cols * cell + COMPARE_EDGE_MARGIN : (cols * cell) / 2;
  const halfHeight = Math.max(minHalfHeight, (rows * cell) / 2, needHalfW / aspect);
  const x0 = leftReserve > 0 ? leftReserve + cell / 2 : (-(cols - 1) / 2) * cell;
  const cells: { x: number; y: number }[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: { x: number; y: number }[] = [];
    for (let c = 0; c < cols; c++) row.push({ x: x0 + c * cell, y: ((rows - 1) / 2 - r) * cell });
    cells.push(row);
  }
  return { halfHeight, cellW: cell, cellH: cell, cells };
}

/**
 * 「최대 강화」 부하 시드 — 발사체 수를 허용하는 마법마다 개별 · 분류 트랙을 상한까지 채운다.
 * 더블 캐스팅은 코드에 없어 넣지 않는다(계획 §7.1). `DeckManager.applyDebugSeed`에 넘긴다.
 */
export function maxLoadSeed(spells: readonly ISpellData[]): IDebugEnhancementSeed {
  const individual: Record<string, Record<string, number>> = {};
  const category: Record<string, Record<string, number>> = {};
  for (const s of spells) {
    if (s.allowsProjectileCount === false) continue;
    individual[s.id] = { [UpgradeOption.ProjectileCount]: UPGRADE_CAP };
    category[s.category] = { [UpgradeOption.ProjectileCount]: UPGRADE_CAP };
  }
  return { individual, category };
}

/**
 * `tune` 문자열을 읽는다. 방식 사이는 `|`, 필드 사이는 `;`, 값은 절대값.
 * 예: `ga:count=96;size=1.2|na:rate=40`
 * @returns 읽은 값. 문법이 깨졌거나 모르는 방식 · 필드 · 양수 아닌 값이 있으면 null
 */
export function parseTune(s: string): TuneMap | null {
  const out: TuneMap = {};
  if (s.trim() === '') return out;
  for (const part of s.split('|')) {
    const colon = part.indexOf(':');
    if (colon < 0) return null;
    const method = part.slice(0, colon);
    if (!isMethod(method)) return null;
    const fields: ITuneFields = {};
    for (const kv of part.slice(colon + 1).split(';')) {
      const eq = kv.indexOf('=');
      if (eq < 0) return null;
      const key = kv.slice(0, eq) as keyof ITuneFields;
      const value = Number(kv.slice(eq + 1));
      if (!TUNE_FIELDS.includes(key) || !isPositive(value)) return null;
      fields[key] = value;
    }
    out[method] = fields;
  }
  return out;
}

/** `parseTune`의 반대. 비교판의 `J` 출력과 측정 URL이 같은 문자열을 쓴다. */
export function formatTune(tune: TuneMap): string {
  return METHOD_KEYS.filter((m) => tune[m] && Object.keys(tune[m] as object).length > 0)
    .map((m) => {
      const fields = tune[m] as ITuneFields;
      const body = TUNE_FIELDS.filter((f) => fields[f] !== undefined)
        .map((f) => `${f}=${fields[f]}`)
        .join(';');
      return `${m}:${body}`;
    })
    .join('|');
}

/**
 * 레시피에 덮어쓰기를 적용한 새 레시피를 낸다. 순서는 레시피 파일 → `tune`(절대값) →
 * `sizeScale` · `countScale`(곱)이다. 원본은 바꾸지 않는다 — 비교판의 `0` 키가 원본으로 되돌린다.
 */
export function applyOverrides(
  r: IVfxRecipe,
  tune: ITuneFields | undefined,
  sizeScale = 1,
  countScale = 1,
): IVfxRecipe {
  const out: IVfxRecipe = { ...r, ...(tune ?? {}) };
  out.size = out.size * sizeScale;
  out.count = Math.max(1, Math.round(out.count * countScale));
  return out;
}

/** 쉼표로 이은 `방식:값` 목록을 읽는다. 하나라도 틀리면 null. */
function parseKeyed(
  s: string,
  parseValue: (v: string) => string | number | null,
): Partial<Record<MethodKey, string | number>> | null {
  const out: Partial<Record<MethodKey, string | number>> = {};
  for (const item of s.split(',')) {
    const colon = item.indexOf(':');
    if (colon < 0) return null;
    const m = item.slice(0, colon);
    const v = parseValue(item.slice(colon + 1));
    if (!isMethod(m) || v === null) return null;
    out[m] = v;
  }
  return out;
}

/**
 * 실험실이 꺼진 상태 — 지금 게임 그대로. URL을 해석하지 않고 만들므로 `LabRuntime`이 모듈을 불러올
 * 때 초기값으로 쓴다(`URLSearchParams`가 없는 런타임에서도 게임이 import 단계에서 깨지지 않는다).
 */
export function labOffMode(): ILabMode {
  return {
    enabled: false,
    kind: null,
    method: null,
    load: 'max',
    picks: {},
    only: null,
    counts: [...DEFAULT_COUNTS],
    tune: {},
    sizeScale: {},
    countScale: {},
    blockSec: DEFAULT_BLOCK_SEC,
    startBlocked: false,
  };
}

/**
 * URL 쿼리를 실험실 상태로 해석한다. **실험실 사용법의 정본이다**(계획 · QA 문서는 거울).
 *
 * 파라미터: `lab=compare|measure` · `method=ga|na|da|ra|ma|ba` · `load=base|max`(기본 max) ·
 * `pick=ga:id,na:id` · `only=ga,na` · `counts=63,200,400` · `tune=ga:count=96;size=1.2|na:rate=40` ·
 * `sizeScale=ga:0.7` · `countScale=ga:0.5` · `block=<초>`(기본 10).
 *
 * 안전 규칙: `lab`이 없으면 다른 파라미터는 모두 무시하고 꺼진 상태를 낸다. 레시피 파일이 없으면
 * (`recipes === null`) `lab`이 있어도 꺼진 상태다 — 공개 빌드는 그 파일을 빼서 실험실을 막는다.
 * `lab`이 있으면 오류를 무시하지 않는다. 조용히 기본값으로 돌면 사용자는 자기가 고른 후보를 잰 줄
 * 알고 다른 후보의 숫자를 받기 때문이다. 오류가 하나라도 있으면 `startBlocked`가 켜진다.
 *
 * @param query `location.search`(앞의 `?`는 있어도 없어도 된다)
 * @param recipes 레시피 파일 내용. 파일이 없으면 null
 */
export function parseLabUrl(
  query: string,
  recipes: readonly IVfxRecipe[] | null,
): { mode: ILabMode; errors: ILabError[] } {
  const mode = labOffMode();
  const errors: ILabError[] = [];
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const lab = params.get('lab');
  if (lab === null || recipes === null) return { mode, errors };

  mode.enabled = true;
  if (lab === 'compare' || lab === 'measure') {
    mode.kind = lab;
  } else {
    errors.push(
      labError(
        `lab=${lab}을 모른다`,
        '실험실 모드는 compare(비교판) · measure(측정) 둘뿐이다',
        'URL을 ?lab=compare&method=ga 또는 ?lab=measure로 고친다',
      ),
    );
  }

  for (const r of recipes) errors.push(...validateRecipe(r));

  for (const m of METHOD_KEYS) {
    const picked = recipes.find((r) => r.method === m && r.picked);
    if (picked) mode.picks[m] = picked.id;
  }

  const method = params.get('method');
  if (method !== null) {
    if (isMethod(method)) mode.method = method;
    else
      errors.push(
        labError(
          `method=${method}을 모른다`,
          '방식 코드는 ga · na · da · ra · ma · ba 여섯뿐이다',
          'HUD의 방식 대응표에서 코드를 골라 method에 넣는다',
        ),
      );
  } else if (mode.kind === 'compare') {
    mode.method = 'ga';
  }

  const load = params.get('load');
  if (load !== null) {
    if (load === 'base' || load === 'max') mode.load = load;
    else
      errors.push(
        labError(
          `load=${load}을 모른다`,
          '부하는 base(기본) · max(최대 강화) 둘뿐이다',
          'load=max로 고친다',
        ),
      );
  }

  const pick = params.get('pick');
  if (pick !== null) {
    const parsed = parseKeyed(pick, (v) => v);
    const bad =
      parsed === null
        ? pick
        : Object.entries(parsed).find(
            ([m, id]) => !recipes.some((r) => r.method === m && r.id === id),
          );
    if (parsed === null || bad) {
      errors.push(
        labError(
          `pick=${pick}에 레시피에 없는 후보가 있다`,
          'pick은 방식:후보id를 쉼표로 이은 것이고, 그 방식의 레시피에 있는 id여야 한다',
          '비교판의 J 출력에 나온 측정 URL을 그대로 쓴다',
        ),
      );
    } else {
      Object.assign(mode.picks, parsed);
    }
  }

  const only = params.get('only');
  if (only !== null) {
    const list = only.split(',');
    if (list.every(isMethod)) mode.only = list as MethodKey[];
    else
      errors.push(
        labError(
          `only=${only}에 모르는 방식이 있다`,
          'only는 방식 코드를 쉼표로 이은 것이다',
          'only=ga,na처럼 고친다',
        ),
      );
  }

  const counts = params.get('counts');
  if (counts !== null) {
    const list = counts.split(',').map(Number);
    // 스포너는 적을 지우지 않고 채우기만 해서, 줄어드는 단계는 앞 단계의 적 위에서 재면서도 결과
    // 파일에는 목표 수로 적힌다 — 그래서 커지는 순서만 받는다
    const ascending = list.every((n, i) => i === 0 || n > list[i - 1]);
    if (list.length > 0 && list.every((n) => Number.isInteger(n) && n > 0) && ascending)
      mode.counts = list;
    else
      errors.push(
        labError(
          `counts=${counts}를 읽을 수 없다`,
          'counts는 양의 정수를 커지는 순서로 쉼표로 이은 것이다(측정 중 적을 지우지 않는다)',
          'counts=63,200,400처럼 고친다',
        ),
      );
  }

  const tune = params.get('tune');
  if (tune !== null) {
    const parsed = parseTune(tune);
    if (parsed) mode.tune = parsed;
    else
      errors.push(
        labError(
          `tune=${tune}을 읽을 수 없다`,
          'tune은 방식:필드=값;필드=값을 |로 이은 것이고 값은 양수다(필드: count · size · life · speed · rate)',
          '비교판의 J 출력에 나온 tune 조각을 그대로 붙인다',
        ),
      );
  }

  for (const key of ['sizeScale', 'countScale'] as const) {
    const raw = params.get(key);
    if (raw === null) continue;
    const parsed = parseKeyed(raw, (v) => (isPositive(Number(v)) ? Number(v) : null));
    if (parsed) mode[key] = parsed as Partial<Record<MethodKey, number>>;
    else
      errors.push(
        labError(
          `${key}=${raw}을 읽을 수 없다`,
          `${key}는 방식 키가 필수다 — 어느 방식의 후보를 줄일지 정해야 한다`,
          `${key}=ga:0.7처럼 방식:배율로 쓴다`,
        ),
      );
  }

  const block = params.get('block');
  if (block !== null) {
    if (isPositive(Number(block))) mode.blockSec = Number(block);
    else
      errors.push(
        labError(
          `block=${block}을 읽을 수 없다`,
          'block은 블록 길이(초)이고 양수다',
          'block을 지우거나(기본 10) 양수를 넣는다',
        ),
      );
  }

  mode.startBlocked = errors.length > 0;
  return { mode, errors };
}

/**
 * 비교판에서 고른 값으로 완성된 측정 URL을 만든다. 사용자는 이 줄을 그대로 주소창에 붙인다.
 * @param base 페이지 주소(쿼리 없이)
 * @param opts 회차별 프리셋 — 기본 부하 회차는 `{ load: 'base', counts: [200] }`. 없으면 판정 스윕
 *   (load=max, 적 수는 기본 63 · 200 · 400)
 */
export function buildMeasureUrl(
  base: string,
  picks: Partial<Record<MethodKey, string>>,
  tune: TuneMap,
  opts: { load?: 'base' | 'max'; counts?: readonly number[] } = {},
): string {
  const params = new URLSearchParams();
  params.set('lab', 'measure');
  params.set('load', opts.load ?? 'max');
  if (opts.counts) params.set('counts', opts.counts.join(','));
  setPickAndTune(params, picks, tune);
  return `${base}?${params.toString()}`;
}

/**
 * 다른 방식의 비교판 URL. 지금까지 고른 후보 · 다듬은 값을 실어 보내서, 방식을 하나씩 넘겨 가며
 * 다듬은 결과가 마지막 측정 URL에 모두 남게 한다.
 * @param base 페이지 주소(쿼리 없이)
 * @param method 다음에 볼 방식
 */
export function buildCompareUrl(
  base: string,
  method: MethodKey,
  picks: Partial<Record<MethodKey, string>>,
  tune: TuneMap,
): string {
  const params = new URLSearchParams();
  params.set('lab', 'compare');
  params.set('method', method);
  setPickAndTune(params, picks, tune);
  return `${base}?${params.toString()}`;
}

/** `pick` · `tune` 파라미터를 채운다. 비어 있으면 넣지 않는다. */
function setPickAndTune(
  params: URLSearchParams,
  picks: Partial<Record<MethodKey, string>>,
  tune: TuneMap,
): void {
  const pickStr = METHOD_KEYS.filter((m) => picks[m])
    .map((m) => `${m}:${picks[m]}`)
    .join(',');
  if (pickStr) params.set('pick', pickStr);
  const tuneStr = formatTune(tune);
  if (tuneStr) params.set('tune', tuneStr);
}

/**
 * 파일 이름에 넣을 값에서 소문자 · 숫자 · 쉼표만 남긴다. URL 값이 그대로 들어가면 `../` 같은
 * 경로 문자나 태그 조각이 파일 이름에 실린다.
 */
export function sanitizeFileToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9,]/g, '');
}

/**
 * 결과 파일 이름 `gate-<창>-<load>-<only 또는 all>-<UTC 시각>.json`.
 * @param only 켜 둔 방식(없으면 all)
 * @param at 측정이 끝난 시각
 */
export function resultFileName(
  width: number,
  height: number,
  load: string,
  only: readonly string[] | null,
  at: Date,
): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${at.getUTCFullYear()}${p(at.getUTCMonth() + 1)}${p(at.getUTCDate())}t${p(at.getUTCHours())}${p(at.getUTCMinutes())}${p(at.getUTCSeconds())}`;
  const scope = only && only.length > 0 ? only.join(',') : 'all';
  const tokens = [`${Math.round(width)}x${Math.round(height)}`, load, scope, stamp].map(
    sanitizeFileToken,
  );
  return `gate-${tokens.join('-')}.json`;
}

/**
 * URL에 `lab` 파라미터가 있는가. 없으면 데이터 로더가 레시피 파일을 읽지도 않는다 — 보통 게임의
 * 로딩 경로가 실험실 때문에 바뀌지 않게 한다.
 * @param query `location.search`(앞의 `?`는 있어도 없어도 된다)
 */
export function hasLabParam(query: string): boolean {
  return new URLSearchParams(query.startsWith('?') ? query.slice(1) : query).has('lab');
}

/**
 * 측정에 쓸 후보를 방식별로 고른다 — 고른 후보(`picks`)에 tune · 배율을 적용한 값이다.
 * `only`가 있으면 그 방식만 남긴다. 빠진 방식은 켬 블록에서도 이펙트를 띄우지 않는다(귀속 회차는
 * 방식 하나의 비용만 재야 한다).
 * @param mode `parseLabUrl`이 낸 실험실 상태
 * @param recipes 레시피 파일 내용
 */
export function pickedRecipeMap(
  mode: ILabMode,
  recipes: readonly IVfxRecipe[],
): Partial<Record<MethodKey, IVfxRecipe>> {
  const out: Partial<Record<MethodKey, IVfxRecipe>> = {};
  for (const m of METHOD_KEYS) {
    if (mode.only && !mode.only.includes(m)) continue;
    const r = recipes.find((x) => x.method === m && x.id === mode.picks[m]);
    if (r)
      out[m] = applyOverrides(r, mode.tune[m], mode.sizeScale[m] ?? 1, mode.countScale[m] ?? 1);
  }
  return out;
}

/**
 * 측정 모드에서 플레이어 주변을 비워 두는 원의 반지름(px). 이 안에 적이 서면 플레이어 몸과
 * 노바 · 오브 그림에 가려 화면에서 적이 보이지 않는다.
 */
export const MEASURE_SPAWN_CLEAR_RADIUS = 150;

/** 화면 가장자리 안쪽으로 남기는 비율. 적의 몸이 화면 밖으로 잘리지 않게 한다. */
const MEASURE_SPAWN_VIEW_FILL = 0.9;

/**
 * 측정 모드의 적 한 마리 자리. 보통 스폰은 화면 밖에서 내고 적이 걸어 들어오지만, 측정 모드의
 * 적은 죽지 않아서 그대로 두면 모두 플레이어 한 점으로 모여 쌓인다. 그러면 화면에 적이 안 보이고,
 * 마법도 한 점에서만 터져 실제 판(적이 화면에 퍼진 상태)과 다른 부하를 잰다. 그래서 측정 모드는
 * 화면 안에 고르게 흩어 놓고 적을 제자리에 세운다.
 *
 * 플레이어 주변 `MEASURE_SPAWN_CLEAR_RADIUS` 원 안에 떨어진 점은 원 둘레로 밀어낸다. 정확히
 * 플레이어 자리면 방향이 없으므로 오른쪽 둘레로 보낸다.
 * @param field center = 플레이어 위치, viewHalfW · viewHalfH = 카메라 뷰 절반(px)
 * @param u 가로 난수(0~1)
 * @param v 세로 난수(0~1)
 */
export function measureSpawnPoint(
  field: { center: { x: number; y: number }; viewHalfW: number; viewHalfH: number },
  u: number,
  v: number,
): { x: number; y: number } {
  const dx = (u * 2 - 1) * field.viewHalfW * MEASURE_SPAWN_VIEW_FILL;
  const dy = (v * 2 - 1) * field.viewHalfH * MEASURE_SPAWN_VIEW_FILL;
  const d = Math.hypot(dx, dy);
  if (d >= MEASURE_SPAWN_CLEAR_RADIUS) return { x: field.center.x + dx, y: field.center.y + dy };
  const ux = d > 0 ? dx / d : 1;
  const uy = d > 0 ? dy / d : 0;
  return {
    x: field.center.x + ux * MEASURE_SPAWN_CLEAR_RADIUS,
    y: field.center.y + uy * MEASURE_SPAWN_CLEAR_RADIUS,
  };
}

/**
 * 글의 32비트 FNV-1a 해시(16진수 8자리). 결과 파일에 쓴 레시피를 적어, 같은 숫자가 같은
 * 레시피에서 나왔는지 나중에 가릴 수 있게 한다. 보안용이 아니다.
 */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
