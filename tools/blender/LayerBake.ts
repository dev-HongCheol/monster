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
import {
  CHOSEN_HULL,
  CHOSEN_PITCH,
  GEAR_TOON,
  hullMaterials,
  type IToonSpec,
  type IWeaponSpec,
} from './BakeSpec.ts';
import { assertSameSize, layerOver } from './ComparisonSheet.ts';
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
      jobs.push({
        layer,
        facing: facing.id,
        yaw: facing.yaw,
        frames: namedFrames(layer, facing.id),
      });
    }
  }
  return jobs;
}

/** 한 방향에서 굽는 프레임 전부(걷기 뒤에 대기)에 이름을 붙인다. 층과 기준 컷이 같은 자세를 굽게 하는 한 자리다. */
function namedFrames(layer: string, facing: BakeFacing): INamedFrame[] {
  return BAKE_ACTIONS.flatMap((action) =>
    actionFrames(action).map((frame, index) => ({
      ...frame,
      name: frameName(layer, action, facing, index),
    })),
  );
}

/** 아틀라스 한 장에 담는 묶음 — 한 층의 한 동작, 네 방향 전부. */
export interface IAtlasGroup {
  /** 아틀라스 파일의 이름(확장자 없음). `<층>_<동작>`이다 */
  id: string;
  layer: BakeLayer;
  action: BakeAction;
  /** 담는 프레임. 방향 순서대로, 한 방향 안에서는 번호 순서대로다 */
  frames: { facing: BakeFacing; name: string }[];
}

/**
 * 구운 프레임을 아틀라스 단위로 묶는다. 단위는 층 × 동작이다(G4 §6).
 *
 * 방향까지 나누면 아틀라스가 마흔 개로 늘어 빌드 파일이 불어나고, 층 하나로 합치면 몸 층이 2048 텍스처를 넘는다.
 * 이름은 굽기 일감과 같은 함수(`frameName`)에서 낸다 — 묶음의 이름이 구운 파일의 이름과 갈리면 그 프레임은
 * 아틀라스에서 빠지고, 게임은 그 이름을 못 찾아 직전 프레임에 멈춘다.
 */
export function atlasGroups(): IAtlasGroup[] {
  const groups: IAtlasGroup[] = [];
  for (const layer of BAKE_LAYERS) {
    for (const action of BAKE_ACTIONS) {
      const frames = BAKE_FACINGS.flatMap((facing) =>
        actionFrames(action).map((_, index) => ({
          facing: facing.id,
          name: frameName(layer, action, facing.id, index),
        })),
      );
      groups.push({ id: `${layer}_${action}`, layer, action, frames });
    }
  }
  return groups;
}

/** 기준 컷의 프레임 이름에서 층 자리에 오는 말. 굽는 쪽의 `--layer whole`과 같다. */
export const REFERENCE_LAYER = 'whole';

/** 기준 컷으로 굽는 상의 판. 방패는 v2 전까지 늘 장착이라 게임에 있는 조합은 상의가 가른다(G4 §5). */
export const REFERENCE_TOPS = ['topA', 'topB'] as const;
export type ReferenceTop = (typeof REFERENCE_TOPS)[number];

/** 기준 컷 굽기 한 번(상의 판 × 방향)의 일감. */
export interface IReferenceBakeJob {
  /** 통째로 굽는 상의 판 */
  top: ReferenceTop;
  facing: BakeFacing;
  yaw: number;
  frames: INamedFrame[];
}

/**
 * 기준 컷의 일감을 낸다. 기준 컷은 상의를 입은 판에 지팡이와 방패를 들려 **가림 없이 한 장으로** 구운 그림이고,
 * 층을 겹친 그림이 맞는지를 이것과 견준다(`stackVerdict`).
 *
 * 자세를 층 일감과 같은 함수에서 낸다. 기준 컷의 자세가 층과 한 장이라도 다르면 자세의 차이가 가림의 차이로
 * 세어지는데, 수치만 봐서는 둘이 구별되지 않는다.
 */
export function referenceBakeJobs(): IReferenceBakeJob[] {
  const jobs: IReferenceBakeJob[] = [];
  for (const top of REFERENCE_TOPS) {
    for (const facing of BAKE_FACINGS) {
      jobs.push({
        top,
        facing: facing.id,
        yaw: facing.yaw,
        frames: namedFrames(REFERENCE_LAYER, facing.id),
      });
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

/**
 * 층의 그림을 더 큰 캔버스의 중심에 옮긴다. 둘레는 투명이다.
 *
 * 층마다 캔버스가 달라서(몸 · 상의는 몸 층 캔버스, 무기는 그보다 넉넉하다) 그대로는 픽셀 번호를 맞댈 수 없다.
 * 모든 층이 같은 카메라로 구워져 캔버스 중심이 같은 월드 점에 놓이므로, 중심만 맞추면 겹친다 — 게임이 자식
 * 노드를 부모의 원점에 두는 것과 같고, 합성 화면(`layers_preview.html`)도 같은 맞춤을 한다.
 *
 * @throws 캔버스가 그림보다 작거나, 가로 · 세로 가운데 하나라도 홀짝이 그림과 다르면. 홀짝이 다르면 중심이
 *   반 픽셀에 걸려, 어느 쪽으로 내림하든 그 층이 다른 층에서 0.5px 어긋난다(G4 §3.1)
 */
export function centerOnCanvas(img: IRgbaImage, canvas: ICanvas): IRgbaImage {
  if (canvas.width < img.width || canvas.height < img.height) {
    throw new Error(
      `centerOnCanvas: 그림 ${img.width}×${img.height}을 그보다 작은 캔버스 ${canvas.width}×${canvas.height}로 옮길 수 없다`,
    );
  }
  if ((canvas.width - img.width) % 2 !== 0 || (canvas.height - img.height) % 2 !== 0) {
    throw new Error(
      `centerOnCanvas: 그림 ${img.width}×${img.height}과 캔버스 ${canvas.width}×${canvas.height}의 홀짝이 다르다 — 중심이 반 픽셀 어긋난다`,
    );
  }
  const left = (canvas.width - img.width) / 2;
  const top = (canvas.height - img.height) / 2;
  const data = new Uint8Array(canvas.width * canvas.height * 4);
  for (let y = 0; y < img.height; y++) {
    const row = img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4);
    data.set(row, ((y + top) * canvas.width + left) * 4);
  }
  return { width: canvas.width, height: canvas.height, data };
}

/**
 * 두 층의 내용이 함께 있는 픽셀 수. 0이면 두 층은 이 장에서 만나지 않으므로 앞뒤가 틀릴 자리도 없다 —
 * 가림 판 실험은 겹치는 조합에만 한다(G4 §5).
 *
 * @throws 두 층의 캔버스가 다르면. 먼저 `centerOnCanvas`로 같은 캔버스에 옮긴다
 */
export function alphaOverlap(a: IRgbaImage, b: IRgbaImage): number {
  assertSameSize(a, b, 'alphaOverlap');
  let both = 0;
  for (let i = 3; i < a.data.length; i += 4) {
    if (a.data[i] >= CONTENT_ALPHA && b.data[i] >= CONTENT_ALPHA) both++;
  }
  return both;
}

/** 겹치는 순서 안의 자리. 상의 자리에는 입은 상의 층(`topA` · `topB`)이 온다. */
export type StackSlot = 'body' | 'top' | 'staff' | 'shield';

/**
 * 방향마다 층을 겹치는 순서(아래부터) — 게임의 형제 순서가 따라야 하는 값이다(G4 §5에서 채택, 2026-09-21).
 *
 * **무기 층은 맨살 몸으로만 가려 굽는다.** 옷은 맨살보다 나와 있어서, 무기가 옷 뒤를 지나는 자리에는 옷이
 * 맨살보다 나온 만큼의 무기 픽셀이 안 지워지고 남는다. 남은 픽셀을 굽기로 지우려면 무기 층을 상의마다 따로
 * 구워야 하는데(상의 N벌 × 무기 M개), 그 픽셀을 상의가 덮도록 겹치는 순서만 바꾸면 굽기는 그대로다.
 *
 * **그 순서가 방향에 달렸다.** 두 무기를 몸 앞에 들므로 정면에서는 무기가 상의보다 카메라에 가깝고, 뒤에서는
 * 멀다. 실측(2026-09-21, 기준 컷과 견줘 「앞에 잘못 보인 픽셀」을 11장에 걸쳐 셈)에서 뒷모습의 방패를 상의
 * 위에 두면 상의 A가 1,843px, 아래에 두면 111px였다. 나머지 세 방향은 상의 → 지팡이 → 방패가 556 ~ 858px로
 * 가장 적었고, 그 값은 앞뒤가 다 맞는 자리에서도 윤곽을 따라 나오는 크기다. 한 방향 안에서는 장마다 순서가
 * 바뀌지 않았다 — 그래서 (방향, 동작, 프레임)별 표가 아니라 방향별 표다.
 *
 * 몸은 늘 맨 아래다. 다른 층이 전부 맨살 몸을 가림 전용으로 두고 구워져 몸 뒤의 픽셀을 갖고 있지 않다.
 *
 * 게임은 `game/assets` 밖을 import할 수 없어 같은 표를 따로 든다. 두 표가 같은지는 G5의 단언이 붙든다.
 */
export const STACK_ORDER: Record<BakeFacing, readonly StackSlot[]> = {
  front: ['body', 'top', 'staff', 'shield'],
  right: ['body', 'top', 'staff', 'shield'],
  back: ['body', 'staff', 'shield', 'top'],
  left: ['body', 'top', 'staff', 'shield'],
};

/** 그 방향에서 겹치는 층을 아래부터 낸다. 상의 자리를 입은 상의 층으로 바꾼 `STACK_ORDER`다. */
export function stackOrder(facing: BakeFacing, top: ReferenceTop): BakeLayer[] {
  return STACK_ORDER[facing].map((slot) => (slot === 'top' ? top : slot));
}

/** 겹칠 층 하나. `stackVerdict`에는 아래 층부터 게임의 형제 순서로 넘긴다. */
export interface IStackLayer {
  /** 판정 결과에서 이 층을 가리키는 이름 */
  name: string;
  image: IRgbaImage;
}

/** `stackVerdict`의 결과. 층별 값은 **그 층이 맨 위에 그려진 자리**의 픽셀을 센 것이다. */
export interface IStackVerdict {
  /** 구멍 — 기준 컷에는 내용이 있는데 겹친 그림에는 없는 픽셀 수 */
  holes: number;
  /**
   * 「앞에 보이면 안 되는 픽셀」 — 겹친 그림이 기준 컷과 다른데, 맨 위 층부터 걷어내면 기준 컷과 맞는 픽셀 수.
   * 기준 컷이 보여 주는 것이 그 층의 **아래에 깔린 것**이므로 그 층이 가려졌어야 하는 자리다
   */
  misdrawn: Record<string, number>;
  /**
   * 겹친 그림이 기준 컷과 다르고 걷어내도 안 맞는 픽셀 수. 층의 윤곽이 아래 층과 섞인 결과나 음영이 한 번에
   * 구운 것과 다른 자리이고, 층의 앞뒤를 바꿔도 없어지지 않는다 — 가림 판을 고르는 수치가 아니다
   */
  unmatched: Record<string, number>;
  /** 어느 층의 내용도 없는 자리에서 다른 픽셀 수 — 윤곽의 옅은 술끼리의 차이다 */
  fringe: number;
}

/** 두 그림의 `i`번째 픽셀에서 가장 크게 벌어진 채널 차(알파 포함). */
function channelGap(a: IRgbaImage, b: IRgbaImage, i: number): number {
  let worst = 0;
  for (let c = 0; c < 4; c++) worst = Math.max(worst, Math.abs(a.data[i + c] - b.data[i + c]));
  return worst;
}

/**
 * 층을 게임의 순서로 겹친 그림이 한 번에 구운 기준 컷과 어디서 다른지를, 실패의 종류별로 센다.
 *
 * **구멍만 세면 통과해 버리는 오류가 있다.** 옷은 맨살 몸보다 커서, 맨살 몸만 가림 전용으로 두고 구운 무기 층은
 * 소매 뒤이면서 몸 실루엣 밖을 지나는 픽셀을 지우지 못한다. 무기 노드가 상의 노드 위에 있으므로 그 픽셀은 소매
 * 앞에 그려지는데, 빈 자리가 아니라서 구멍으로는 안 잡힌다(G4 §5).
 *
 * **그렇다고 다른 픽셀을 전부 그 오류로 세면 수치가 가림과 무관한 것으로 부푼다.** 층을 따로 구워 겹치면 층의
 * 윤곽이 아래 층과 섞이는 방식이 한 번에 구운 것과 달라서, 앞뒤가 다 맞는 자리에서도 윤곽을 따라 한두 픽셀 폭의
 * 차이가 난다(2026-09-21 실측에서 다른 픽셀의 93%가 이쪽이었고, 무엇의 앞에도 잘못 설 수 없는 몸 층에서도
 * 나왔다). 그래서 다른 픽셀마다 **그 자리의 맨 위 층부터 걷어내 본다.** 걷어낸 그림이 기준 컷과
 * 맞으면 기준 컷이 보여 주는 것은 그 층의 아래에 깔린 것이고, 그 층은 가려졌어야 한다(`misdrawn`). 걷어내도 안
 * 맞으면 앞뒤의 문제가 아니다(`unmatched`). 두 값을 맨 위 층에 세는 것은 화면에 잘못 나온 것이 그 층의 픽셀이고
 * 고칠 것도 그 층의 굽기여서다.
 *
 * 걷어낸 자리에 아무 내용도 없으면 맞는 것으로 치지 않는다. 가릴 것이 없는 자리이고, 둘 다 빈 것을 「맞는다」로
 * 읽으면 기준 컷보다 한 픽셀 넓게 구워진 윤곽이 통째로 가림 오류가 된다.
 *
 * 구멍인 픽셀은 구멍으로만 센다. 다른 픽셀의 판정은 `pixelDiff`와 같다 — 둘 다 투명하면 건너뛰고, 알파를 포함한
 * 네 채널 가운데 하나라도 문턱을 넘어야 센다. 내용이 있고 없고는 층 판정과 같은 잣대(`CONTENT_ALPHA`)로 가른다.
 *
 * @param layers 아래 층부터. 캔버스가 기준 컷과 같아야 한다(`centerOnCanvas`)
 * @param reference 같은 자세를 가림 없이 한 장으로 구운 그림
 * @param threshold 채널 차가 이 값을 **넘어야** 다른 픽셀로 센다
 * @throws 층이 하나도 없거나 캔버스가 기준 컷과 다른 층이 있으면
 */
export function stackVerdict(
  layers: readonly IStackLayer[],
  reference: IRgbaImage,
  threshold: number,
): IStackVerdict {
  if (layers.length === 0) throw new Error('stackVerdict: 겹칠 층이 하나도 없다');
  for (const layer of layers) assertSameSize(layer.image, reference, `stackVerdict ${layer.name}`);

  // stacks[k]는 아래에서부터 k번 층까지 겹친 그림이다. 마지막이 게임 화면이고, 앞의 것들이 걷어낸 그림이다
  const stacks: IRgbaImage[] = [layers[0].image];
  for (const layer of layers.slice(1)) {
    stacks.push(layerOver(stacks[stacks.length - 1], layer.image));
  }
  const merged = stacks[stacks.length - 1];

  const zeros = (): Record<string, number> =>
    Object.fromEntries(layers.map((layer) => [layer.name, 0]));
  const misdrawn = zeros();
  const unmatched = zeros();
  let holes = 0;
  let fringe = 0;
  for (let i = 0; i < reference.data.length; i += 4) {
    const seen = merged.data[i + 3];
    const wanted = reference.data[i + 3];
    if (seen === 0 && wanted === 0) continue;
    if (wanted >= CONTENT_ALPHA && seen < CONTENT_ALPHA) {
      holes++;
      continue;
    }
    if (channelGap(merged, reference, i) <= threshold) continue;

    let onTop = layers.length - 1;
    while (onTop >= 0 && layers[onTop].image.data[i + 3] < CONTENT_ALPHA) onTop--;
    if (onTop < 0) {
      fringe++;
      continue;
    }
    let peeled = onTop - 1;
    while (
      peeled >= 0 &&
      (stacks[peeled].data[i + 3] < CONTENT_ALPHA ||
        channelGap(stacks[peeled], reference, i) > threshold)
    ) {
      peeled--;
    }
    if (peeled >= 0) misdrawn[layers[onTop].name]++;
    else unmatched[layers[onTop].name]++;
  }
  return { holes, misdrawn, unmatched, fringe };
}

/** `bakeMotionArgs`에 넣는 굽기 한 번. 경로는 전부 절대 경로다. */
export interface IBakeMotionCall {
  /** `--vrm`으로 들여올 판 */
  vrm: string;
  /** 키프레임 정의 JSON */
  frames: string;
  /** 그림을 쓸 폴더 */
  outDir: string;
  yaw: number;
  /** 기록된 카메라(굽는 쪽이 읽는 모양) */
  camera: string;
  toon: string;
  /** 이 굽기의 캔버스 */
  canvas: ICanvas;
  /** 층마다 다른 인자 — `--layer`, 상의 판, 무기 · 장비 사양, 남기거나 지울 머티리얼 */
  extra: readonly string[];
}

/**
 * `bake_motion.py`에 넘기는 인자를 짠다. 생산 굽기(`bake.ts`)와 슬롯 범위 탐침(`slots.ts`)이 나눠 쓴다.
 *
 * 규격값(캔버스 · 머리 · 발 행)을 여기서 `PLAYER_FRAME_SPEC`으로 채운다. 굽는 쪽에는 기본값이 없어서 빠지면
 * `spec-args`로 실패하는데, 실행기마다 따로 채우면 한쪽만 고쳤을 때 두 실행기가 다른 규격으로 굽는다.
 */
export function bakeMotionArgs(call: IBakeMotionCall): string[] {
  return [
    ...call.extra,
    '--vrm',
    call.vrm,
    '--frames',
    call.frames,
    '--out-dir',
    call.outDir,
    '--yaw',
    String(call.yaw),
    '--camera',
    call.camera,
    '--toon',
    call.toon,
    '--width',
    String(PLAYER_FRAME_SPEC.width),
    '--height',
    String(PLAYER_FRAME_SPEC.height),
    '--foot-row',
    String(PLAYER_FRAME_SPEC.footLineY),
    '--head-row',
    String(PLAYER_FRAME_SPEC.headLineY),
    '--layer-width',
    String(call.canvas.width),
    '--layer-height',
    String(call.canvas.height),
  ];
}

/** 굽는 쪽이 프레임마다 돌려주는 장비의 자리 — 모델 좌표(m). */
export interface IGearFrame {
  gear: Record<
    string,
    {
      /** 장비가 붙은 본 */
      bone: string;
      /** 장비의 원점 */
      origin: number[];
      /** 장비 위의 한 점(원점에서 장비의 로컬 +z로 0.1m) */
      up: number[];
      /** 붙은 본의 머리와 꼬리 */
      head: number[];
      tail: number[];
    }
  >;
}

/** `gearFollow`의 결과. */
export interface IGearFollow {
  /** 장비의 두 점에서 본의 두 끝까지, 네 거리가 프레임 사이에 벌어진 폭 가운데 가장 큰 것(m). 0이어야 한다 */
  spread: number;
  /** 장비의 원점이 첫 프레임에서 가장 멀리 간 거리(m). 다리에 붙은 장비가 걷는 동안 0이면 안 따라간 것이다 */
  travel: number;
}

/**
 * 장비가 붙은 본을 회전까지 따라갔는지를 굽는 쪽이 돌려준 점 넷으로 잰다.
 *
 * 본을 강체로 따라간 장비는 그 위의 어느 점이든 본의 머리 · 꼬리에서 늘 같은 거리에 있다. **원점 하나만 봐서는
 * 회전이 안 드러난다** — 무기를 옮기는 식(본 머리에 거리만 더한다)으로 따라간 장비도 원점은 본 머리에서 늘 같은
 * 거리에 있는데, 그 장비는 본이 돌아도 곧게 서 있어서 굽은 정강이를 부츠가 뚫고 나온다. 장비 위의 둘째 점과 본의
 * 꼬리까지 넣어야 그 경우에 거리가 변한다. 굽는 쪽은 파이썬이라 어떤 검사에도 안 걸리므로 판정을 여기 둔다.
 *
 * @param frames 굽는 쪽이 돌려준 프레임들
 * @param gear 볼 장비의 이름
 * @throws 그 이름의 장비가 없는 프레임이 있으면
 */
export function gearFollow(frames: readonly IGearFrame[], gear: string): IGearFollow {
  const distance = (a: readonly number[], b: readonly number[]): number =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  const gaps: number[][] = [[], [], [], []];
  let travel = 0;
  for (const [index, frame] of frames.entries()) {
    const at = frame.gear[gear];
    if (!at) throw new Error(`gearFollow: ${index}번 프레임에 장비 ${gear}가 없다`);
    gaps[0].push(distance(at.origin, at.head));
    gaps[1].push(distance(at.origin, at.tail));
    gaps[2].push(distance(at.up, at.head));
    gaps[3].push(distance(at.up, at.tail));
    const first = frames[0].gear[gear];
    if (first) travel = Math.max(travel, distance(at.origin, first.origin));
  }
  const spread = Math.max(...gaps.map((each) => Math.max(...each) - Math.min(...each)));
  return { spread, travel };
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
 * 구운 그림의 폴더마다 찍어 두는 도장 — 그 그림이 어느 입력으로 구워졌는지의 지문이다. 층과 기준 컷을 견주기
 * 전에 실행기가 두 쪽의 도장이 지금 입력과 같은지 본다.
 *
 * **카메라 기록의 입력 지문만으로는 모자라다.** 그 지문은 무기 사양을 안 든다 — 카메라를 맨살 몸만으로 잡으므로
 * 무기를 고쳐도 카메라를 다시 잡을 일이 없기 때문이다. 그래서 무기의 그립을 고친 뒤 무기 층만 다시 굽고 기준
 * 컷을 안 구우면, 옮겨 간 무기가 통째로 「앞에 잘못 보인 픽셀」로 세어지는데 `staleReasons`로는 안 걸린다.
 *
 * @param inputs 카메라 기록의 입력 지문
 * @param weapons 들려 굽는 무기의 사양 전부
 */
export function bakeStamp(inputs: IBakeInputs, weapons: readonly IWeaponSpec[]): string {
  return definitionHash({ inputs, weapons });
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
