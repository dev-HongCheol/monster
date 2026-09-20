/**
 * G4 생산 굽기의 순수 로직 — 무엇을 굽는지, 카메라를 어떻게 맞추는지, 카메라를 잡은 뒤 입력이 바뀌었는지.
 *
 * Blender를 부르는 일은 실행기(`bake.ts`)가 하고 이 파일은 계산만 한다. 굽는 쪽은 파이썬이라 타입체크 · 린트
 * · vitest 어디에도 안 걸리므로, 파이썬에 넘기는 값과 돌려받은 값을 재는 식은 전부 여기 두고
 * `tests/logic/Blender3dGate.test.ts`가 단언한다.
 *
 * **카메라는 한 번만 잡고 모든 층 · 방향 · 동작이 나눠 쓴다.** 굽기마다 카메라를 다시 계산하면 층끼리 인물의
 * 크기와 위치가 조용히 어긋난다. 1라운드가 그랬고(`retarget_render.py`), 2라운드 탐침은 기준 자세의 몸 상자로
 * 잡아서 고도 15°에서 머리 · 발 행이 규격과 달랐다. 그래서 맨살 몸을 한 번 구워 합집합의 머리 · 발 행을 재고
 * (`fitCamera`), 그 결과를 입력의 지문과 함께 기록해 둔다(`ICameraRecord`).
 */

import { createHash } from 'node:crypto';
import { PLAYER_FRAME_SPEC } from '../../tests/helpers/FrameSet.ts';
import { type IRgbaImage, visibleBox } from '../../tests/helpers/SpriteMetrics.ts';
import { frameName } from './Atlas.ts';
import { CHOSEN_HULL, CHOSEN_PITCH, GEAR_TOON, hullMaterials, type IToonSpec } from './BakeSpec.ts';
import {
  CHOSEN_GAIT,
  CHOSEN_MOTION,
  gaitFrame,
  IDLE_BAKED,
  IDLE_PLAYBACK,
  type IMotionFrame,
  idleFrame,
  PLAYER_LEG_RIG,
  samplePhases,
} from './MotionSpec.ts';

/** 굽는 층. 이름은 아틀라스와 게임이 쓰는 것 그대로다(`Atlas.ts`의 `frameName`). */
export const BAKE_LAYERS = ['body', 'topA', 'topB', 'staff', 'shield'] as const;
export type BakeLayer = (typeof BAKE_LAYERS)[number];

/** 굽는 동작. */
export const BAKE_ACTIONS = ['walk', 'idle'] as const;
export type BakeAction = (typeof BAKE_ACTIONS)[number];

/**
 * 굽는 방향과 모델을 돌리는 각(도). 좌우는 거울로 뒤집지 않고 따로 굽는다 — 오른손에 지팡이, 왼손에 방패라
 * 뒤집으면 든 손이 바뀐다.
 */
export const BAKE_FACINGS = [
  { id: 'front', yaw: 0 },
  { id: 'right', yaw: CHOSEN_MOTION.sideYaw },
  { id: 'back', yaw: 180 },
  { id: 'left', yaw: 360 - CHOSEN_MOTION.sideYaw },
] as const;
export type BakeFacing = (typeof BAKE_FACINGS)[number]['id'];

/** 파일 이름이 붙은 프레임 — 파이썬이 `name`으로 PNG를 쓴다. */
export interface INamedFrame extends IMotionFrame {
  name: string;
}

/** 굽기 한 번(층 × 방향)의 일감. Blender 프로세스 하나가 이 프레임들을 전부 굽는다. */
export interface ILayerBakeJob {
  layer: BakeLayer;
  facing: BakeFacing;
  yaw: number;
  frames: INamedFrame[];
}

/** 동작 하나의 굽는 프레임. 걷기는 채택한 걸음을 여덟 위상으로, 대기는 구운 위상 셋으로 낸다. */
export function actionFrames(action: BakeAction): IMotionFrame[] {
  if (action === 'walk') {
    return samplePhases(CHOSEN_MOTION.walkFrames).map((phase) =>
      gaitFrame(CHOSEN_GAIT, PLAYER_LEG_RIG, phase),
    );
  }
  return IDLE_PLAYBACK.phases.map((phase) => idleFrame(IDLE_BAKED, PLAYER_LEG_RIG, phase));
}

/**
 * 층 × 방향마다 일감 하나를 낸다. 걷기와 대기를 한 일감에 담는다 — 한 장 11초 가운데 렌더는 2~3초이고 나머지가
 * Blender 시작과 `.vrm` 불러오기라(2026-09-17 실측), 동작마다 프로세스를 따로 띄우면 불러오기만 두 배가 된다.
 */
export function layerBakeJobs(): ILayerBakeJob[] {
  const jobs: ILayerBakeJob[] = [];
  for (const layer of BAKE_LAYERS) {
    for (const facing of BAKE_FACINGS) {
      const frames = BAKE_ACTIONS.flatMap((action) =>
        actionFrames(action).map((frame, index) => ({
          ...frame,
          name: frameName(layer, action, facing.id, index),
        })),
      );
      jobs.push({ layer, facing: facing.id, yaw: facing.yaw, frames });
    }
  }
  return jobs;
}

/**
 * 직교 카메라의 자세 가운데 그림을 바꾸는 값 셋. 카메라는 루트 축(x 0 · y 0) 위의 점 `(0, 0, aimZ)`를 겨냥한 채
 * 정면(−Y 쪽)에서 `pitchDeg`만큼 내려다본다. 겨냥점까지의 거리는 직교라 그림을 안 바꾸므로 여기 없다.
 *
 * **가로 중심을 몸 상자의 중심이 아니라 루트 축에 두는 이유.** 상자 중심에 두면 오른손 지팡이 · 왼손 방패 ·
 * 75° 방향 때문에 몸통이 방향마다 옆으로 밀린다. 게임은 노드 원점을 중심으로 피격 사각형을 잡으므로
 * 그림이 밀리면 판정과 그림이 방향마다 어긋난다.
 */
export interface ICameraPose {
  /** 카메라 고도(도). 0이면 수평, 크면 내려다본다 */
  pitchDeg: number;
  /** 겨냥점의 높이(m) */
  aimZ: number;
  /** 픽셀 하나의 월드 크기(m). 층 캔버스가 달라도 같다 — 캔버스를 키우면 주변이 더 보일 뿐이다(ADR 009) */
  perPixelM: number;
}

/**
 * 월드의 점이 캔버스의 어느 높이에 놓이는지를 위에서부터의 연속 좌표로 돌려준다. 행 `r`의 픽셀 중심이 `r + 0.5`다.
 *
 * 카메라의 「위」 축은 `(0, sin θ, cos θ)`다. 고도 θ로 내려다보면 같은 높이의 점이라도 카메라에서 먼 쪽(y가 큰
 * 쪽)이 화면에서 위로 간다. 방향마다 발 밑선이 달라지는 원인이 이 항이다.
 *
 * @param point 월드 좌표(m) — Blender 축이라 −y가 카메라 쪽, z가 위다
 */
export function projectRow(
  camera: ICameraPose,
  canvasHeight: number,
  point: readonly [number, number, number],
): number {
  const tilt = (camera.pitchDeg * Math.PI) / 180;
  const up = point[1] * Math.sin(tilt) + (point[2] - camera.aimZ) * Math.cos(tilt);
  return canvasHeight / 2 - up / camera.perPixelM;
}

/**
 * 임시 카메라로 구운 맨살 몸 합집합의 머리 · 발 행에서, 그 둘이 규격의 머리 행 · 발 행에 오는 카메라를 낸다.
 *
 * 직교 투영은 행과 월드의 「위」 좌표가 일차식이라 한 번에 풀린다. 잰 두 행을 「위」 좌표로 되돌리고, 그 두
 * 좌표가 규격의 두 행 **픽셀 중심**에 오도록 배율과 겨냥 높이를 정한다. 픽셀 중심에 두는 것은 `_common.py`의
 * `setup_camera`와 같은 약속이고, 중심에 두어야 어느 쪽으로든 반 픽셀의 여유가 남는다.
 *
 * 잰 행은 정수라 임시 캔버스의 픽셀 하나만큼 모른다. 그래서 임시 캔버스를 규격보다 촘촘하게 굽는다 —
 * 오차가 규격 픽셀의 반보다 작아야 맞춘 행이 옆 행으로 넘어가지 않는다. 배율은 실행기(`bake.ts`의
 * `PROBE_SCALE`)가 든다.
 *
 * @param provisional 잴 때 쓴 카메라
 * @param provisionalCanvasHeight 잴 때 쓴 캔버스 세로(px)
 * @param measured 합집합에서 내용이 있는 가장 위 행과 가장 아래 행
 * @param spec 맞출 규격 — 캔버스 세로와 머리 · 발 행
 */
export function fitCamera(
  provisional: ICameraPose,
  provisionalCanvasHeight: number,
  measured: { topRow: number; bottomRow: number },
  spec: { height: number; headLineY: number; footLineY: number },
): ICameraPose {
  if (measured.bottomRow <= measured.topRow) {
    throw new Error(
      `합집합의 머리 행(${measured.topRow})이 발 행(${measured.bottomRow})보다 위에 있지 않다 — 굽기가 비었거나 잘렸다`,
    );
  }
  const tilt = (provisional.pitchDeg * Math.PI) / 180;
  // 행 → 「위」 좌표. `projectRow`를 거꾸로 푼 것이다
  const upAt = (row: number): number =>
    provisional.aimZ * Math.cos(tilt) +
    (provisionalCanvasHeight / 2 - (row + 0.5)) * provisional.perPixelM;
  const upTop = upAt(measured.topRow);
  const upBottom = upAt(measured.bottomRow);

  const perPixelM = (upTop - upBottom) / (spec.footLineY - spec.headLineY);
  const aimUp = upBottom - (spec.height / 2 - (spec.footLineY + 0.5)) * perPixelM;
  return { pitchDeg: provisional.pitchDeg, aimZ: aimUp / Math.cos(tilt), perPixelM };
}

/** 몸이 차지하는 폭의 양쪽에 두는 여백(px). 트림 상자가 캔버스 변에 닿으면 잘린 것과 구별할 수 없다. */
const BODY_SIDE_MARGIN_PX = 2;

/**
 * 몸 층의 캔버스 가로를 낸다. 기준 가로보다 좁아지지 않고, 홀짝을 기준과 맞춘다.
 *
 * 기준 가로(246)는 출하 2D 정면 그림의 캔버스에서 온 값이라 걷는 옆모습을 담도록 잡힌 적이 없다. 75° 방향으로
 * 걸으면 보폭이 화면 가로로 펼쳐지고, 루트 축을 가로 중심에 고정하므로 한쪽으로 뻗은 발이 기준 변을 넘는다
 * (2026-09-21 실측 259.2px). 시각 층은 몸 규격보다 클 수 있으므로(ADR 009) 배율은 그대로 두고 캔버스만 넓힌다 —
 * 배율을 줄여 맞추면 인물이 규격보다 작아진다.
 *
 * @param neededPx 루트 축에서 가장 멀리 나간 거리의 두 배(맞춘 카메라의 px) — 루트 축이 가로 중심이어서다
 * @param baseWidth 기준 캔버스 가로
 */
export function bodyCanvasWidth(neededPx: number, baseWidth: number): number {
  const wanted = Math.ceil(neededPx) + BODY_SIDE_MARGIN_PX * 2;
  if (wanted <= baseWidth) return baseWidth;
  return wanted % 2 === baseWidth % 2 ? wanted : wanted + 1;
}

/** 캔버스 크기(px). */
export interface ICanvas {
  width: number;
  height: number;
}

/**
 * 무기 층이 몸 층 캔버스보다 사방으로 더 갖는 여유(px). 지팡이는 머리 위로, 방패는 몸 옆으로 나간다.
 *
 * **양쪽에 같은 값을 더하므로 홀짝이 몸 층과 저절로 같다.** 홀짝이 다르면 캔버스 중심이 픽셀 격자에서 반 칸
 * 밀려 무기가 손에서 0.5px 어긋난다(G4 §3.1). 몸 층이 264×493이면 600×701이 되어 G3의 판정 화면을 굽던
 * 캔버스와 같다. 값이 모자라면 `layerSetCheck`가 「변에 닿았다」로 굽기를 세운다 — 조용히 잘리지 않는다.
 */
const WEAPON_REACH_PX = { x: 168, y: 104 };

/**
 * 층이 굽는 캔버스. 몸과 상의는 몸 층 캔버스를 같이 쓰고 무기는 그보다 넉넉하다. 캔버스를 키워도 인물은 안
 * 커진다 — 픽셀 크기는 카메라 기록의 것 하나이고, 캔버스가 크면 주변이 더 보일 뿐이다(ADR 009).
 *
 * @param bodyCanvas 카메라 기록의 몸 층 캔버스
 */
export function layerCanvas(layer: BakeLayer, bodyCanvas: ICanvas): ICanvas {
  if (layer === 'staff' || layer === 'shield') {
    return {
      width: bodyCanvas.width + WEAPON_REACH_PX.x * 2,
      height: bodyCanvas.height + WEAPON_REACH_PX.y * 2,
    };
  }
  return { width: bodyCanvas.width, height: bodyCanvas.height };
}

/** 층 하나를 굽는 데 드는 것 — 굽는 쪽의 층 이름과, 더 들여올 상의 판이나 들 무기. */
export interface ILayerSource {
  /** `bake_motion.py`의 `--layer` 값 */
  pythonLayer: 'body' | 'top' | 'staff' | 'shield';
  /** 상의 층이 `--top-vrm`으로 들여올 판 */
  topModel?: 'topA' | 'topB';
  /** 무기 층이 사양을 받을 무기 */
  weapon?: 'staff' | 'shield';
}

/**
 * 게임이 쓰는 층 이름을 굽는 쪽의 입력으로 옮긴다. 상의 A · B는 굽는 쪽에서는 같은 층(`top`)이고 들여오는 판만
 * 다르다 — 옷을 한 벌 더하는 일이 굽는 코드를 안 건드리고 판 하나를 더 넘기는 일이 되게 하려는 것이다.
 */
export function layerSource(layer: BakeLayer): ILayerSource {
  if (layer === 'topA' || layer === 'topB') return { pythonLayer: 'top', topModel: layer };
  if (layer === 'staff' || layer === 'shield') return { pythonLayer: layer, weapon: layer };
  return { pythonLayer: 'body' };
}

/**
 * 이 알파부터 내용으로 센다. `FrameSet.ts`의 `faintUpTo`(16 이하는 내용이 아니다)와 같은 잣대여야 한다 —
 * 카메라를 맞출 때와 판정할 때의 잣대가 다르면, 맞춘 행과 판정이 읽는 행이 안티앨리어싱 술만큼 어긋난다.
 */
export const CONTENT_ALPHA = 17;

/**
 * 상의 · 무기 층의 (방향, 동작) 세트 하나에 거는 검사. 위반을 문장으로 돌려주고 비어 있으면 통과다.
 *
 * 몸 층의 규칙(`frameSetCheck`)을 그대로 걸 수 없다. 이 층들은 몸보다 작게 구워지는 것이 정상이라 머리 · 발
 * 행이 없고, 뒷모습에서 몸에 다 가린 무기처럼 **비는 것이 정상인 장**이 있다. 그래서 세 가지만 본다.
 *
 * - 장 수와 캔버스가 선언과 같다. 다르면 아틀라스의 원본 크기와 게임 노드의 크기가 갈린다.
 * - 내용이 캔버스 변에 닿지 않는다. 닿은 그림은 잘린 그림과 구별할 수 없고, 무기가 캔버스에 들어오는지를
 *   가르는 실제 관문이 이것이다.
 * - 세트가 통째로 비지 않는다. 전부 비었으면 가려진 것이 아니라 사양이나 층 선택이 틀린 것이다.
 *
 * @param frames 구운 프레임. 렌더 순서대로 온다
 * @param expected 기대하는 장 수와 캔버스
 */
export function layerSetCheck(
  frames: readonly IRgbaImage[],
  expected: { count: number; canvas: ICanvas },
): string[] {
  const problems: string[] = [];
  if (frames.length !== expected.count) {
    problems.push(`프레임이 ${frames.length}장인데 ${expected.count}장이어야 한다`);
  }
  let filled = 0;
  for (const [index, img] of frames.entries()) {
    if (img.width !== expected.canvas.width || img.height !== expected.canvas.height) {
      problems.push(
        `${index}번 장의 캔버스가 ${img.width}×${img.height}인데 ${expected.canvas.width}×${expected.canvas.height}이어야 한다`,
      );
      continue;
    }
    const box = visibleBox(img, CONTENT_ALPHA);
    if (!box) continue;
    filled++;
    const touches =
      box.x === 0 ||
      box.y === 0 ||
      box.x + box.width === img.width ||
      box.y + box.height === img.height;
    if (touches) {
      problems.push(
        `${index}번 장의 내용이 캔버스 변에 닿았다 — 잘렸을 수 있다. 층 캔버스를 키운다`,
      );
    }
  }
  if (frames.length > 0 && filled === 0) {
    problems.push(
      '세트의 프레임이 전부 비었다 — 가려진 것이 아니라 사양이나 층 선택이 틀린 것이다',
    );
  }
  return problems;
}

/** 굽기 결과를 바꾸는 입력의 지문 — 카메라 기록에 적어 두고 굽기 전에 지금 입력과 견준다. */
export interface IBakeInputs {
  /** `bakeDefinition()`의 지문 */
  definition: string;
  /** 모델 판마다 `.vrm` 파일의 sha256. VRoid Studio 판이 바뀌어 내보낸 파일이 달라지면 여기서 걸린다 */
  models: Record<string, string>;
  /** Blender 판(`bpy.app.version_string`) */
  blender: string;
  /** VRM 애드온 판 */
  vrmAddon: string;
}

/** 기록해 두는 카메라 — 자세와, 그 자세를 잡을 때의 입력 지문. */
export interface ICameraRecord {
  camera: ICameraPose;
  /** 몸 층의 캔버스(px). 세로는 기준 그대로이고 가로는 옆걸음의 보폭을 담도록 넓힌 값이다(`bodyCanvasWidth`) */
  bodyCanvas: ICanvas;
  /** 발밑 점(세계 원점)이 기준 캔버스에서 놓이는 높이(위에서부터의 연속 좌표, px). 게임의 발치와 마법진 중심이다 */
  groundRow: number;
  inputs: IBakeInputs;
}

/** 굽기 정의 — 모델과 도구 판을 뺀, 코드가 쥔 입력 전부. */
export interface IBakeDefinition {
  frames: Record<BakeAction, IMotionFrame[]>;
  pitchDeg: number;
  facings: typeof BAKE_FACINGS;
  frameSpec: typeof PLAYER_FRAME_SPEC;
  toon: IToonSpec;
}

/**
 * 무기 · 장비가 음영 규칙을 복사해 올 VRoid 부위. G2의 확정값(`WEAPON_TOON` · `GEAR_TOON`)은 상의를 지목하는데
 * 생산 굽기는 하의로 바꿔 넘긴다.
 *
 * 무기 층은 맨살 판으로 굽고(맨살 몸이 가림 전용이다) 맨살 판에는 상의 머티리얼이 없어서, 상의를 지목하면
 * 굽는 쪽이 `toon-spec`으로 죽는다. 하의는 맨살 판과 상의 판 모두에 있다. 복사해 오는 값 — 음영 경계 · 림 ·
 * 외곽선 모드와 색 — 열두 항목이 하의와 상의 A · B에서 같다는 것은 `inspect_mtoon.py` 덤프로 확인했다
 * (2026-09-21). VRoid에서 옷을 바꿔 새 판을 내보내면 이 같음이 깨질 수 있으므로 그때 다시 덤프해 견준다.
 */
const LIKE_PART = 'Bottoms_CLOTH';

/**
 * 모든 층이 입는 툰 사양. 외곽선 헐이 실루엣을 넓히므로 카메라를 맞출 때도 이 사양으로 굽는다.
 *
 * 층마다 사양을 달리하지 않는다. 사양이 하나여야 굽기 정의의 지문도 하나이고, 어느 층이 어느 사양으로
 * 구워졌는지를 따로 기록하지 않아도 된다.
 */
export function bakeToon(): IToonSpec {
  const materials = hullMaterials(CHOSEN_HULL, GEAR_TOON);
  for (const klass of ['WEAPON', 'GEAR']) {
    if (materials[klass]?.like !== undefined) {
      materials[klass] = { ...materials[klass], like: LIKE_PART };
    }
  }
  return { id: 'g4_final_look', materials };
}

/** 지금 코드가 쥔 굽기 정의. 이 가운데 하나라도 바뀌면 모든 층을 다시 굽는다. */
export function bakeDefinition(): IBakeDefinition {
  return {
    frames: { walk: actionFrames('walk'), idle: actionFrames('idle') },
    pitchDeg: CHOSEN_PITCH,
    facings: BAKE_FACINGS,
    frameSpec: PLAYER_FRAME_SPEC,
    toon: bakeToon(),
  };
}

/** 키를 정렬해 직렬화한다. 객체를 짜는 순서가 바뀌었다고 지문이 바뀌면 안 된다. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, inner]) => `${JSON.stringify(key)}:${canonicalJson(inner)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** 값의 sha256(16진). 키 순서와 무관하다. */
export function definitionHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

/**
 * 카메라를 잡을 때의 입력과 지금 입력이 어디서 다른지를 사람이 읽을 문장으로 돌려준다. 비어 있으면 같다.
 *
 * 다르면 굽기를 거부한다. 입력 하나를 고친 뒤 일부 층만 다시 구우면 새 층이 옛 층과 크기 · 위치 · 음영이
 * 조용히 어긋나는데, 파일도 알파도 정상이라 겹쳐 보기 전에는 드러나지 않는다.
 */
export function staleReasons(recorded: IBakeInputs, current: IBakeInputs): string[] {
  const reasons: string[] = [];
  if (recorded.definition !== current.definition) {
    reasons.push('굽기 정의(동작 · 고도 · 방향 · 규격 · 툰 사양)가 카메라를 잡은 뒤에 바뀌었다');
  }
  const names = new Set([...Object.keys(recorded.models), ...Object.keys(current.models)]);
  for (const name of [...names].sort()) {
    const before = recorded.models[name];
    const now = current.models[name];
    if (before === undefined) reasons.push(`모델 판 ${name}은 카메라 기록에 없다`);
    else if (now === undefined)
      reasons.push(`카메라 기록에 있는 모델 판 ${name}이 지금 입력에 없다`);
    else if (before !== now) reasons.push(`모델 판 ${name}의 파일이 카메라를 잡은 뒤에 바뀌었다`);
  }
  if (recorded.blender !== current.blender) {
    reasons.push(`Blender 판이 다르다 (기록 ${recorded.blender}, 지금 ${current.blender})`);
  }
  if (recorded.vrmAddon !== current.vrmAddon) {
    reasons.push(`VRM 애드온 판이 다르다 (기록 ${recorded.vrmAddon}, 지금 ${current.vrmAddon})`);
  }
  return reasons;
}
