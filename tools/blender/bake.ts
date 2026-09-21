/**
 * G4 생산 굽기 실행기 — 카메라를 한 번 잡아 기록하고, 그 기록으로 층을 굽는다.
 *
 * 계산은 전부 `LayerBake.ts`에 있고 이 파일은 Blender를 부르고 PNG를 읽고 결과를 찍는다. 굽는 쪽은
 * `bake_motion.py` 하나다.
 *
 * 돌리는 법 (레포 루트에서):
 *
 *   BLENDER='C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' \
 *     node --experimental-strip-types tools/blender/bake.ts camera
 *
 *   camera            맨살 몸을 구워 합집합의 머리 · 발 행을 재고, 그 둘이 규격 행에 오는 카메라를
 *                     `tools/blender/camera.json`에 쓴다. 동작 · 고도 · 모델 · 도구 판을 바꾼 뒤에 다시 돌린다
 *   layers            다섯 층을 네 방향으로 굽고 G4 §4의 판정을 건다. 카메라 기록의 입력 지문이 지금 입력과
 *                     다르면 굽지 않는다. `--only body,staff`로 층을 골라 구울 수 있다
 *   preview           구운 층을 게임의 형제 순서로 겹쳐 재생하는 화면(`docs/temp/3d-gate/g4/preview.html`)을
 *                     쓴다. 굽지 않는다. 기준 컷이 구워져 있으면 화면에서 층 합성과 기준 컷을 번갈아 볼 수 있다
 *   overlap           구운 층끼리 내용이 겹치는 픽셀 수를 방향 · 조합마다 잰다(G4 §5). 굽지 않는다
 *   reference         상의 A · B를 입은 판에 지팡이와 방패를 들려, 가림 없이 한 장으로 구운 기준 컷을 네 방향으로
 *                     굽는다. 자세와 카메라는 층과 같다
 *   compare           층을 게임의 순서(방향마다 다르다 — `LayerBake.ts`의 `STACK_ORDER`)로 겹친 그림을 기준 컷과
 *                     견줘 구멍과 앞에 잘못 보인 픽셀을 센다. 굽지 않는다. 층이나 기준 컷이 지금 입력으로 구운
 *                     것이 아니면 재지 않는다. `--same-order`를 주면 모든 방향을 정면의 순서로 겹쳐 잰다
 *   atlas             구운 층을 층 × 동작 단위로 아틀라스(PNG + cocos2d 포맷 2 plist)에 담아
 *                     `docs/temp/3d-gate/g4/atlas/`에 쓰고, 원본 크기 · 프레임 수 · 왕복을 검사한 뒤 바이트를 찍는다.
 *                     굽지 않는다. 게임 폴더에는 넣지 않는다
 *
 *   --model-dir <폴더>  생산 `.vrm` 셋(`player_base` · `player_top_a` · `player_top_b`)이 있는 폴더.
 *                     커밋하지 않는 파일이라 장비마다 자리가 다를 수 있다
 *
 * 구운 그림은 추적하지 않는 `docs/temp/3d-gate/g4/`에 쓴다. 커밋하는 것은 카메라 기록뿐이다.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  frameSetCheck,
  type IFrameMeasurement,
  PLAYER_FRAME_SPEC,
  unionRowCheck,
} from '../../tests/helpers/FrameSet.ts';
import { type IRgbaImage, visibleBox } from '../../tests/helpers/SpriteMetrics.ts';
import { decodePng, encodePng } from '../art/PngCodec.ts';
import { normalizeAlpha } from '../art/Postprocess.ts';
import {
  buildAtlas,
  checkFrameCounts,
  checkSourceSizes,
  frameName,
  type IAtlasEntry,
  parseFrameName,
  restoreFrame,
  writePlist,
} from './Atlas.ts';
import { CHOSEN_WEAPONS, MODEL_HEIGHT_M, writeChosenSpecs } from './BakeSpec.ts';
import { runBlender, runPool, writeJson } from './BlenderRun.ts';
import {
  alphaOverlap,
  atlasGroups,
  BAKE_ACTIONS,
  BAKE_FACINGS,
  BAKE_LAYERS,
  type BakeFacing,
  type BakeLayer,
  bakeDefinition,
  bakeStamp,
  bakeToon,
  bodyCanvasWidth,
  CONTENT_ALPHA,
  centerOnCanvas,
  definitionHash,
  fitCamera,
  type IBakeInputs,
  type ICameraPose,
  type ICameraRecord,
  type ICanvas,
  type ILayerBakeJob,
  type INamedFrame,
  type IReferenceBakeJob,
  type IStackVerdict,
  layerBakeJobs,
  layerCanvas,
  layerSetCheck,
  layerSource,
  projectRow,
  REFERENCE_LAYER,
  REFERENCE_TOPS,
  referenceBakeJobs,
  STACK_ORDER,
  stackOrder,
  stackVerdict,
  staleReasons,
} from './LayerBake.ts';
import { CHOSEN_MOTION, IDLE_PLAYBACK } from './MotionSpec.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 구운 그림과 중간 JSON의 자리. 추적되지 않는 스크래치다. */
const SCRATCH = 'docs/temp/3d-gate/g4';

/** 카메라 기록. 이 파일은 커밋한다 — 모든 층이 같은 카메라로 구워졌다는 근거다. */
const CAMERA_FILE = 'tools/blender/camera.json';

/** 생산 `.vrm`의 기본 자리. 추적하지 않는 폴더라 다른 장비에서는 `--model-dir`로 준다. */
const DEFAULT_MODEL_DIR = 'cloud-storage/art/production/player/2026-09-16-player-3d';

/** 모델 판과 파일 이름. 판 이름은 카메라 기록의 `inputs.models` 키다. */
const MODEL_FILES = {
  base: 'player_base.vrm',
  topA: 'player_top_a.vrm',
  topB: 'player_top_b.vrm',
} as const;
type ModelName = keyof typeof MODEL_FILES;

/**
 * 카메라를 맞추려고 잴 때의 캔버스 배율과 물러남. 잰 행은 정수라 임시 캔버스의 픽셀 하나만큼 모르므로
 * 기준의 네 배로 굽는다. 고도가 있으면 합집합이 키보다 길어지므로 1.2배 물러나 잘리지 않게 한다 —
 * 그래도 오차는 기준 픽셀의 0.3이라 픽셀 중심에서 반 픽셀의 여유 안에 든다(`fitCamera`).
 */
const PROBE_SCALE = 4;
const PROBE_ZOOM_OUT = 1.2;

/** 게임이 그리는 플레이어 높이(월드 단위, G2 크기 결정 — G5 §2.6). 720p에서 1단위가 1px이다. */
const GAME_HEIGHT_UNITS = 77;

/** 합성 화면의 칸 제목. */
const FACING_LABEL = { front: '정면', right: '오른쪽', back: '뒤', left: '왼쪽' } as const;

/** 명령줄 인자에서 `--name 값`을 읽는다. */
function option(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

/** 생산 `.vrm` 셋의 절대 경로. 하나라도 없으면 무엇이 어디 있어야 하는지 말하며 던진다. */
function modelPaths(): Record<ModelName, string> {
  const dir = path.resolve(ROOT, option('model-dir') ?? DEFAULT_MODEL_DIR);
  const found = {} as Record<ModelName, string>;
  for (const [name, file] of Object.entries(MODEL_FILES) as [ModelName, string][]) {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) {
      throw new Error(
        `생산 .vrm이 없다: ${full}\n  커밋하지 않는 파일이라 이 장비의 cloud-storage/에 있어야 한다. 다른 자리에 있으면 --model-dir로 준다.`,
      );
    }
    found[name] = full;
  }
  return found;
}

/**
 * `value`를 `like`와 홀짝이 같아지게 하나 키운다. 층 캔버스의 홀짝이 기준과 다르면 캔버스 중심이 픽셀 격자에서
 * 반 칸 밀려 굽는 쪽이 거부한다(G4 §3.1).
 */
function matchParity(value: number, like: number): number {
  return value % 2 === like % 2 ? value : value + 1;
}

/** 파일의 sha256(16진). */
function fileHash(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** 파이썬이 읽는 카메라 기록을 쓴다. 도구 판을 안 주면 파이썬이 판을 견주지 않는다(재는 굽기). */
function writePythonCamera(
  file: string,
  camera: ICameraPose,
  tools?: { blender: string; vrmAddon: string },
): string {
  return writeJson(file, {
    pitch_deg: camera.pitchDeg,
    aim_z: camera.aimZ,
    per_pixel_m: camera.perPixelM,
    ...(tools ? { blender: tools.blender, vrm_addon: tools.vrmAddon } : {}),
  });
}

/** 굽기들이 나눠 쓰는 입력 — 산출 폴더, 모델 판, 카메라 기록(파이썬용), 툰 사양, 무기 사양. */
interface IBakeShared {
  outDir: string;
  models: Record<ModelName, string>;
  camera: string;
  toon: string;
  /** 무기 사양 JSON의 경로. 무기 층을 안 구우면 없어도 된다 */
  weapons?: Record<'staff' | 'shield', string>;
  canvas: ICanvas;
  /** 구운 폴더에 찍을 도장(`bakeStamp`). 카메라를 잡는 굽기는 견줄 상대가 없어 안 찍는다 */
  stamp?: string;
}

/** 굽는 쪽을 한 번 부르는 데 드는 것 — 어느 판을 어느 층으로 어느 폴더에 굽는가. */
interface IBakeCall {
  /** 정의 파일 이름과 오류 메시지에 쓰는 이름. `/`로 가른 두 마디다 */
  label: string;
  /** 그림을 쓸 폴더 */
  dir: string;
  /** `--vrm`으로 들여올 판 */
  vrm: string;
  /** `bake_motion.py`의 `--layer` 값 */
  pythonLayer: string;
  /** 층마다 다른 인자 — 상의 판, 무기 사양 */
  extra: string[];
  yaw: number;
  frames: INamedFrame[];
}

/** 구운 폴더의 도장 파일. */
const STAMP_FILE = 'stamp.json';

/**
 * 굽는 쪽을 한 번 부른다. 앞 실행의 그림이 남아 있으면 굽는 쪽이 덮어쓰기를 거부하므로 폴더를 먼저 비운다.
 * 도장은 굽기가 성공한 뒤에 찍는다 — 굽다 죽은 폴더가 도장을 달고 남으면 견줄 때 온전한 굽기로 읽힌다.
 */
async function runBake(call: IBakeCall, shared: IBakeShared): Promise<Record<string, unknown>> {
  fs.rmSync(call.dir, { recursive: true, force: true });
  const id = call.label.replace('/', '_');
  const definition = writeJson(path.join(shared.outDir, 'defs', `${id}.json`), {
    id,
    frames: call.frames,
  });
  const payload = await runBlender(
    path.join(ROOT, 'tools/blender/bake_motion.py'),
    [
      '--layer',
      call.pythonLayer,
      ...call.extra,
      '--vrm',
      call.vrm,
      '--frames',
      definition,
      '--out-dir',
      call.dir,
      '--yaw',
      String(call.yaw),
      '--camera',
      shared.camera,
      '--toon',
      shared.toon,
      '--width',
      String(PLAYER_FRAME_SPEC.width),
      '--height',
      String(PLAYER_FRAME_SPEC.height),
      '--foot-row',
      String(PLAYER_FRAME_SPEC.footLineY),
      '--head-row',
      String(PLAYER_FRAME_SPEC.headLineY),
      '--layer-width',
      String(shared.canvas.width),
      '--layer-height',
      String(shared.canvas.height),
    ],
    call.label,
  );
  if (shared.stamp) writeJson(path.join(call.dir, STAMP_FILE), { stamp: shared.stamp });
  return payload;
}

/** 층 굽기 일감 하나를 돌린다. 그림은 `<outDir>/<층>/<방향>/`에 쓴다. */
function bake(job: ILayerBakeJob, shared: IBakeShared): Promise<Record<string, unknown>> {
  const source = layerSource(job.layer);
  const extra: string[] = [];
  if (source.topModel) extra.push('--top-vrm', shared.models[source.topModel]);
  if (source.weapon) {
    if (!shared.weapons) throw new Error(`${job.layer} 층을 굽는데 무기 사양을 안 받았다`);
    extra.push(`--${source.weapon}-spec`, shared.weapons[source.weapon]);
  }
  return runBake(
    {
      label: `${job.layer}/${job.facing}`,
      dir: frameDir(shared.outDir, job),
      vrm: shared.models.base,
      pythonLayer: source.pythonLayer,
      extra,
      yaw: job.yaw,
      frames: job.frames,
    },
    shared,
  );
}

/**
 * 기준 컷 일감 하나를 돌린다. 그림은 `<outDir>/<상의 판>/<방향>/`에 쓴다.
 *
 * 맨살 판에 상의를 얹지 않고 **상의를 입은 판을 통째로** 굽는다. 기준 컷은 층으로 가르지 않았을 때의 정답이어야
 * 하는데, 맨살 판에 상의 면을 얹어 구우면 층 굽기와 같은 조립을 거쳐 같은 오류를 함께 갖는다.
 */
function bakeReference(
  job: IReferenceBakeJob,
  shared: IBakeShared,
): Promise<Record<string, unknown>> {
  if (!shared.weapons) throw new Error('기준 컷을 굽는데 무기 사양을 안 받았다');
  return runBake(
    {
      label: `${job.top}/${job.facing}`,
      dir: path.join(shared.outDir, job.top, job.facing),
      vrm: shared.models[job.top],
      pythonLayer: REFERENCE_LAYER,
      extra: ['--staff-spec', shared.weapons.staff, '--shield-spec', shared.weapons.shield],
      yaw: job.yaw,
      frames: job.frames,
    },
    shared,
  );
}

/** 일감의 그림이 놓이는 폴더. */
function frameDir(outDir: string, job: ILayerBakeJob): string {
  return path.join(outDir, job.layer, job.facing);
}

/** 구운 프레임 한 장을 읽는다. */
function readFrame(dir: string, name: string): IRgbaImage {
  const file = path.join(dir, `${name}.png`);
  if (!fs.existsSync(file)) throw new Error(`구운 프레임이 없다: ${file}`);
  return decodePng(fs.readFileSync(file));
}

/** 프레임 한 장에서 내용이 있는 가장 위 · 아래 행과 왼쪽 · 오른쪽 열. 비었으면 `null`. */
function contentEdges(
  img: IRgbaImage,
): { top: number; bottom: number; left: number; right: number } | null {
  const box = visibleBox(img, CONTENT_ALPHA);
  if (!box) return null;
  return {
    top: box.y,
    bottom: box.y + box.height - 1,
    left: box.x,
    right: box.x + box.width - 1,
  };
}

/** 맨살 몸의 네 방향 일감. */
function bodyJobs(): ILayerBakeJob[] {
  return layerBakeJobs().filter((job) => job.layer === 'body');
}

/**
 * 카메라를 잡는다 — 재는 굽기, 맞추기, 확인 굽기, 기록.
 *
 * 확인 굽기를 따로 하는 것은 맞춘 식이 맞았는지를 그림으로 닫기 위해서다. 식은 직교 투영의 일차식이라 틀릴
 * 곳이 적지만, 파이썬이 기록을 다르게 읽으면(축 · 부호 · 픽셀 중심) 식만으로는 드러나지 않는다.
 */
async function commandCamera(): Promise<void> {
  const models = modelPaths();
  const scratch = path.join(ROOT, SCRATCH, 'camera');
  fs.mkdirSync(scratch, { recursive: true });
  const toon = writeJson(path.join(scratch, 'toon.json'), bakeToon());
  const definition = bakeDefinition();
  const spec = PLAYER_FRAME_SPEC;
  const jobs = bodyJobs();

  // 1. 재는 굽기 — 고도 0의 규격 카메라에서 물러난 자리. 겨냥 높이는 발밑이 발 행에 오는 값에서 출발한다
  const levelPerPixel = MODEL_HEIGHT_M / (spec.footLineY - spec.headLineY);
  const provisional: ICameraPose = {
    pitchDeg: definition.pitchDeg,
    aimZ: (spec.footLineY + 0.5 - spec.height / 2) * levelPerPixel,
    perPixelM: (levelPerPixel / PROBE_SCALE) * PROBE_ZOOM_OUT,
  };
  const probeCanvas = {
    width: matchParity(spec.width * PROBE_SCALE, spec.width),
    height: matchParity(spec.height * PROBE_SCALE, spec.height),
  };
  const probeDir = path.join(scratch, 'probe');
  const probeCamera = writePythonCamera(path.join(scratch, 'camera_probe.json'), provisional);
  console.log(`재는 굽기 ${jobs.length}건 (${probeCanvas.width}×${probeCanvas.height})`);
  const started = Date.now();
  const probePayloads = await runPool(
    jobs.map(
      (job) => () =>
        bake(job, {
          outDir: probeDir,
          models,
          camera: probeCamera,
          toon,
          canvas: probeCanvas,
        }),
    ),
  );

  let topRow = Number.POSITIVE_INFINITY;
  let bottomRow = Number.NEGATIVE_INFINITY;
  // 방향마다 루트 축(캔버스 가로 중심)에서 가장 멀리 나간 거리(재는 캔버스 px) — 몸 층의 가로 폭을 정한다
  const reach = new Map<string, number>();
  for (const job of jobs) {
    for (const frame of job.frames) {
      const edges = contentEdges(readFrame(frameDir(probeDir, job), frame.name));
      if (!edges) throw new Error(`재는 굽기의 프레임이 비었다: ${job.facing}/${frame.name}`);
      if (
        edges.top === 0 ||
        edges.bottom === probeCanvas.height - 1 ||
        edges.left === 0 ||
        edges.right === probeCanvas.width - 1
      ) {
        throw new Error(
          `재는 굽기의 프레임이 캔버스 변에 닿았다: ${job.facing}/${frame.name} — 잘린 그림으로는 합집합을 잴 수 없다`,
        );
      }
      topRow = Math.min(topRow, edges.top);
      bottomRow = Math.max(bottomRow, edges.bottom);
      const centre = probeCanvas.width / 2;
      const far = Math.max(centre - edges.left, edges.right + 1 - centre);
      reach.set(job.facing, Math.max(reach.get(job.facing) ?? 0, far));
    }
  }
  console.log(`합집합 ${topRow}~${bottomRow}행 (재는 캔버스 기준)`);

  // 2. 맞추기
  const camera = fitCamera(provisional, probeCanvas.height, { topRow, bottomRow }, spec);
  let widest = 0;
  for (const [facing, far] of reach) {
    // 재는 캔버스의 픽셀을 맞춘 카메라의 픽셀로 옮긴다. 루트 축이 가로 중심이라 필요한 폭은 먼 쪽의 두 배다
    const needed = ((far * provisional.perPixelM) / camera.perPixelM) * 2;
    widest = Math.max(widest, needed);
    console.log(
      `  ${facing.padEnd(5)} 몸이 차지하는 가로 ${needed.toFixed(1)}px (기준 ${spec.width})`,
    );
  }
  const bodyCanvas = { width: bodyCanvasWidth(widest, spec.width), height: spec.height };
  const tools = {
    blender: String(probePayloads[0].blender),
    vrmAddon: String(probePayloads[0].vrm_addon),
  };
  for (const payload of probePayloads) {
    if (String(payload.blender) !== tools.blender || String(payload.vrm_addon) !== tools.vrmAddon) {
      throw new Error('재는 굽기끼리 도구 판이 다르다 — 굽는 도중에 Blender나 애드온이 바뀌었다');
    }
  }

  // 3. 확인 굽기 — 몸 층 캔버스에 맞춘 카메라로 굽고 합집합 행 판정을 건다. 세로가 기준 그대로라 행은 규격 그대로 읽힌다
  const verifyDir = path.join(scratch, 'verify');
  const verifyCamera = writePythonCamera(path.join(scratch, 'camera_fitted.json'), camera, tools);
  console.log(`확인 굽기 ${jobs.length}건 (${bodyCanvas.width}×${bodyCanvas.height})`);
  const verifyPayloads = await runPool(
    jobs.map(
      (job) => () =>
        bake(job, {
          outDir: verifyDir,
          models,
          camera: verifyCamera,
          toon,
          canvas: bodyCanvas,
        }),
    ),
  );

  const problems: string[] = [];
  const sets = jobs.map((job) =>
    job.frames.map((frame, index) => {
      const edges = contentEdges(readFrame(frameDir(verifyDir, job), frame.name));
      if (edges && (edges.left === 0 || edges.right === bodyCanvas.width - 1)) {
        problems.push(`${job.facing}/${frame.name}: 몸이 몸 층 캔버스의 옆 변에 닿았다`);
      }
      return {
        index,
        opaquePixels: edges ? 1 : 0,
        footLineY: edges ? edges.bottom : null,
        topLineY: edges ? edges.top : null,
      };
    }),
  );
  problems.push(...unionRowCheck(sets, spec).problems);

  // 파이썬이 기록을 TS와 같은 식으로 읽었는지 — 발밑 점이 놓인 행을 두 쪽에서 따로 내어 견준다
  const groundRow = projectRow(camera, spec.height, [0, 0, 0]);
  for (const [i, payload] of verifyPayloads.entries()) {
    const reported = (payload.ground_px as [number, number])[1];
    if (Math.abs(reported - groundRow) > 0.05) {
      problems.push(
        `${jobs[i].facing}: 발밑 점이 굽는 쪽에서는 ${reported}행, 계산으로는 ${groundRow.toFixed(2)}행이다 — 카메라 기록을 두 쪽이 다르게 읽는다`,
      );
    }
  }

  for (const [i, set] of sets.entries()) {
    // 걷기와 대기를 갈라 찍는다. 돌아설 때 캐릭터가 위아래로 튀는지는 대기의 발 행이 방향끼리 같은지로 본다
    for (const action of ['walk', 'idle']) {
      const rows = set.filter((_, at) => jobs[i].frames[at].name.includes(`_${action}_`));
      const tops = rows.flatMap((m) => (m.topLineY === null ? [] : [m.topLineY]));
      const feet = rows.flatMap((m) => (m.footLineY === null ? [] : [m.footLineY]));
      console.log(
        `  ${jobs[i].facing.padEnd(5)} ${action} 머리 ${Math.min(...tops)}~${Math.max(...tops)}행 · 발 ${Math.min(...feet)}~${Math.max(...feet)}행`,
      );
    }
  }
  console.log(
    `픽셀 ${(camera.perPixelM * 1000).toFixed(4)}mm · 겨냥 높이 ${camera.aimZ.toFixed(4)}m · 발밑 점 ${groundRow.toFixed(2)}행 · ${Math.round((Date.now() - started) / 1000)}초`,
  );
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    throw new Error('확인 굽기가 규격을 못 지켰다 — 카메라 기록을 쓰지 않았다');
  }

  // 4. 기록
  const record: ICameraRecord = {
    camera,
    bodyCanvas,
    groundRow,
    inputs: currentInputs(models, tools),
  };
  writeJson(path.join(ROOT, CAMERA_FILE), record);
  console.log(`✓ ${CAMERA_FILE}`);
}

/** 지금 입력의 지문. 도구 판은 Blender를 돌려 봐야 알므로 받은 값을 그대로 넣는다. */
function currentInputs(
  models: Record<ModelName, string>,
  tools: { blender: string; vrmAddon: string },
): IBakeInputs {
  return {
    definition: definitionHash(bakeDefinition()),
    models: Object.fromEntries(
      (Object.entries(models) as [ModelName, string][]).map(([name, file]) => [
        name,
        fileHash(file),
      ]),
    ),
    blender: tools.blender,
    vrmAddon: tools.vrmAddon,
  };
}

/** 카메라 기록을 읽는다. 없으면 먼저 돌릴 명령을 말하며 던진다. */
function readCameraRecord(): ICameraRecord {
  const file = path.join(ROOT, CAMERA_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(`카메라 기록이 없다: ${CAMERA_FILE} — \`bake.ts camera\`를 먼저 돌린다`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as ICameraRecord;
}

/**
 * 기록된 카메라로 굽는 명령(`layers` · `reference`)의 준비. 카메라를 잡은 뒤에 입력이 바뀌었으면 굽지 않고
 * 던지고(`staleReasons`), 굽는 쪽이 읽을 사양 파일 — 툰 · 무기 둘 · 카메라 — 을 `<outDir>/specs/`에 쓴다.
 *
 * 두 명령이 이 준비를 나눠 쓰는 것은 층과 기준 컷이 같은 사양으로 구워져야 견줄 수 있어서다. 도구 판은 Blender를
 * 돌려 봐야 알므로 여기서는 기록된 값을 그대로 넘기고, 굽는 쪽이 자기 판과 견줘 `camera-stale`로 거부한다.
 */
function prepareRecordedBake(outDir: string): {
  record: ICameraRecord;
  shared: Omit<IBakeShared, 'canvas'>;
} {
  const models = modelPaths();
  const record = readCameraRecord();
  const tools = { blender: record.inputs.blender, vrmAddon: record.inputs.vrmAddon };
  const stale = staleReasons(record.inputs, currentInputs(models, tools));
  if (stale.length > 0) {
    for (const reason of stale) console.error(`✗ ${reason}`);
    throw new Error(
      '카메라를 잡은 뒤에 입력이 바뀌었다 — `bake.ts camera`로 다시 잡고 모든 층을 굽는다',
    );
  }

  fs.mkdirSync(outDir, { recursive: true });
  const specs = path.join(outDir, 'specs');
  const toon = writeJson(path.join(specs, 'toon.json'), bakeToon());
  const [staff, shield] = writeChosenSpecs(specs);
  const camera = writePythonCamera(path.join(specs, 'camera.json'), record.camera, tools);
  return {
    record,
    shared: {
      outDir,
      models,
      camera,
      toon,
      weapons: { staff, shield },
      stamp: bakeStamp(record.inputs, CHOSEN_WEAPONS),
    },
  };
}

/**
 * 구운 폴더의 도장이 지금 입력의 것인지 본다. 아니면 다시 돌릴 명령을 말하며 던진다.
 *
 * 층과 기준 컷을 견주는 명령들이 읽기 전에 부른다. 한쪽만 옛 입력으로 구운 채 견주면 입력의 차이가 가림의
 * 차이로 세어지고, 그 수치로 가림 판을 고르게 된다.
 *
 * @param dir 구운 그림의 폴더
 * @param stamp 지금 입력의 도장
 * @param rebake 이 폴더를 다시 굽는 명령 — 오류 메시지에 넣는다
 */
function assertStamp(dir: string, stamp: string, rebake: string): void {
  const file = path.join(dir, STAMP_FILE);
  const found = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, 'utf-8')) as { stamp?: string }).stamp
    : undefined;
  if (found === stamp) return;
  const where = path.relative(ROOT, dir).split(path.sep).join('/');
  throw new Error(
    found === undefined
      ? `${where}에 도장이 없다 — 굽다가 죽었거나 도장을 찍기 전의 도구로 구웠다. \`${rebake}\`로 다시 굽는다`
      : `${where}은 지금과 다른 입력(동작 · 모델 · 도구 판 · 무기 사양)으로 구운 것이다 — \`${rebake}\`로 다시 굽는다`,
  );
}

/**
 * 걷기 한 장의 발 밑선이 발 행에서 위로 벗어나도 되는 줄 수. 고도가 있으면 뒤로 뻗은 발과 든 발이 화면에서
 * 위로 올라가므로 고도 0 때보다 넉넉해야 한다 — 실측은 가장 높이 뜬 장이 466행(발 행에서 23줄)이었다
 * (2026-09-21). 세트가 통째로 허용 폭 밖에 선 굽기를 잡는 것이 목적이라, 실측에 몇 줄의 여유만 둔다.
 */
const FOOT_LINE_TOLERANCE = 26;

/**
 * 다섯 층을 네 방향으로 굽고 G4 §4의 판정을 건다. 그림은 `docs/temp/3d-gate/g4/layers/<층>/<방향>/`에 쓴다.
 *
 * 굽기 전에 카메라 기록의 입력 지문을 지금 입력과 견줘, 다르면 굽지 않는다(`staleReasons`). 도구 판은
 * 굽는 쪽이 기록과 견줘 `camera-stale`로 거부한다.
 */
async function commandLayers(): Promise<void> {
  const only = option('only')?.split(',');
  const jobs = layerBakeJobs().filter((job) => !only || only.includes(job.layer));
  const outDir = path.join(ROOT, SCRATCH, 'layers');
  const { record, shared } = prepareRecordedBake(outDir);

  console.log(`굽기 ${jobs.length}건 (층 × 방향, 한 건에 ${jobs[0]?.frames.length ?? 0}장)`);
  const started = Date.now();
  const payloads = await runPool(
    jobs.map(
      (job) => () => bake(job, { ...shared, canvas: layerCanvas(job.layer, record.bodyCanvas) }),
    ),
  );
  const bakeSeconds = Math.round((Date.now() - started) / 1000);

  const problems: string[] = [];
  const bodySets: IFrameMeasurement[][] = [];
  for (const [i, job] of jobs.entries()) {
    const canvas = layerCanvas(job.layer, record.bodyCanvas);
    const label = `${job.layer}/${job.facing}`;

    // 모든 층 — 기록된 카메라로 구워졌는가
    problems.push(...groundProblems(record, canvas, payloads[i], label));

    for (const action of BAKE_ACTIONS) {
      const named = job.frames.filter((frame) => parseFrameName(frame.name)?.action === action);
      const frames = named.map((frame) => readFrame(frameDir(outDir, job), frame.name));
      if (job.layer === 'body') {
        const report = frameSetCheck(frames, {
          count: named.length,
          width: canvas.width,
          height: canvas.height,
          footLineY: PLAYER_FRAME_SPEC.footLineY,
          footLineTolerance: FOOT_LINE_TOLERANCE,
        });
        problems.push(...report.problems.map((p) => `${label} ${action}: ${p}`));
        bodySets.push(report.frames);
      } else {
        problems.push(
          ...layerSetCheck(frames, { count: named.length, canvas }).map(
            (p) => `${label} ${action}: ${p}`,
          ),
        );
      }
    }
  }
  if (bodySets.length > 0) {
    problems.push(...unionRowCheck(bodySets, PLAYER_FRAME_SPEC).problems.map((p) => `body: ${p}`));
  }

  // 비용 기록(G4 §8) — 굽기 벽시계 시간과 층별 PNG 바이트
  const bytes = new Map<string, number>();
  for (const job of jobs) {
    for (const frame of job.frames) {
      const size = fs.statSync(path.join(frameDir(outDir, job), `${frame.name}.png`)).size;
      bytes.set(job.layer, (bytes.get(job.layer) ?? 0) + size);
    }
  }
  for (const [layer, total] of bytes) {
    console.log(`  ${layer.padEnd(6)} PNG 합계 ${(total / 1024).toFixed(0)}KB`);
  }
  console.log(`굽기 ${bakeSeconds}초 · 프레임 ${jobs.length * (jobs[0]?.frames.length ?? 0)}장`);
  writeJson(path.join(outDir, 'report.json'), {
    bakeSeconds,
    bytes: Object.fromEntries(bytes),
    problems,
  });

  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    throw new Error(`판정 ${problems.length}건이 떨어졌다`);
  }
  console.log('✓ 다섯 층이 §4 판정을 통과했다');
}

/**
 * 굽기가 기록된 카메라로 됐는지를 발밑 점으로 본다. 발밑 점(세계 원점)은 어느 캔버스에서든 캔버스 중심에서 같은
 * 거리만큼 떨어져 있어야 한다 — 캔버스를 키우면 주변이 더 보일 뿐이기 때문이다(ADR 009).
 *
 * @param canvas 그 굽기의 캔버스
 * @param payload 굽는 쪽이 돌려준 값. `ground_px`가 발밑 점의 픽셀 좌표다
 */
function groundProblems(
  record: ICameraRecord,
  canvas: ICanvas,
  payload: Record<string, unknown>,
  label: string,
): string[] {
  const expectedGround =
    projectRow(record.camera, PLAYER_FRAME_SPEC.height, [0, 0, 0]) +
    (canvas.height - PLAYER_FRAME_SPEC.height) / 2;
  const [groundX, groundY] = payload.ground_px as [number, number];
  if (Math.abs(groundY - expectedGround) <= 0.05 && Math.abs(groundX - canvas.width / 2) <= 0.05) {
    return [];
  }
  return [
    `${label}: 발밑 점이 (${groundX}, ${groundY})인데 (${canvas.width / 2}, ${expectedGround.toFixed(2)})이어야 한다 — 기록된 카메라로 구워지지 않았다`,
  ];
}

/**
 * 층을 겹쳐 재는 캔버스 — 모든 층을 담는 가장 큰 캔버스다. 층 캔버스끼리 홀짝이 같으므로(`layerCanvas`) 어느
 * 층을 옮겨도 중심이 어긋나지 않는다. 합성 화면과 기준 컷도 이 캔버스를 쓴다.
 */
function stageCanvas(bodyCanvas: ICanvas): ICanvas {
  const sizes = BAKE_LAYERS.map((layer) => layerCanvas(layer, bodyCanvas));
  return {
    width: Math.max(...sizes.map((size) => size.width)),
    height: Math.max(...sizes.map((size) => size.height)),
  };
}

/**
 * 구운 프레임을 겹쳐 재는 캔버스에 옮겨 읽는 함수를 낸다. 몸과 무기의 같은 장을 상의마다 다시 풀지 않게
 * 기억해 둔다 — PNG 풀기가 재는 시간의 대부분이다.
 */
function stagedReader(stage: ICanvas): (dir: string, name: string) => IRgbaImage {
  const seen = new Map<string, IRgbaImage>();
  return (dir, name) => {
    const key = path.join(dir, name);
    let img = seen.get(key);
    if (!img) {
      img = centerOnCanvas(readFrame(dir, name), stage);
      seen.set(key, img);
    }
    return img;
  };
}

/** 한 방향에서 굽는 프레임의 (동작, 번호) — 층과 기준 컷이 같은 차례로 굽는다. */
function facingFrames(facing: BakeFacing): { action: string; index: number }[] {
  const job = bodyJobs().find((each) => each.facing === facing);
  if (!job) throw new Error(`굽는 방향에 ${facing}이 없다`);
  return job.frames.map((frame) => {
    const parts = parseFrameName(frame.name);
    if (!parts) throw new Error(`프레임 이름이 규칙에 안 맞는다: ${frame.name}`);
    return { action: parts.action, index: parts.index };
  });
}

/**
 * 내용이 겹치는지 재는 층의 짝(G4 §5). 몸은 넣지 않는다 — 다른 층이 전부 맨살 몸을 가림 전용으로 두고 구워져
 * 몸과의 앞뒤는 굽기가 이미 풀었다. 상의 A와 B는 게임에서 함께 보이지 않으므로 짝이 아니다.
 */
const OVERLAP_PAIRS: readonly (readonly [BakeLayer, BakeLayer])[] = [
  ['staff', 'shield'],
  ['topA', 'staff'],
  ['topA', 'shield'],
  ['topB', 'staff'],
  ['topB', 'shield'],
];

/**
 * 구운 층끼리 내용이 겹치는 픽셀 수를 방향 · 짝마다 잰다. 굽지 않는다.
 *
 * 겹침이 0인 짝은 그 방향에서 만나지 않으므로 앞뒤가 틀릴 자리도 없다. 겹치는 짝이 있는 조합만 기준 컷과 견줘
 * 가림 판을 고른다(`compare`).
 */
function commandOverlap(): void {
  const record = readCameraRecord();
  const stamp = bakeStamp(record.inputs, CHOSEN_WEAPONS);
  const read = stagedReader(stageCanvas(record.bodyCanvas));
  const layersDir = path.join(ROOT, SCRATCH, 'layers');

  const rows: Record<string, unknown>[] = [];
  for (const facing of BAKE_FACINGS) {
    const frames = facingFrames(facing.id);
    for (const [a, b] of OVERLAP_PAIRS) {
      const dirs = [a, b].map((layer) => path.join(layersDir, layer, facing.id));
      for (const dir of dirs) assertStamp(dir, stamp, 'bake.ts layers');
      let hit = 0;
      let most = 0;
      let mostAt = '';
      for (const { action, index } of frames) {
        const count = alphaOverlap(
          read(dirs[0], frameName(a, action, facing.id, index)),
          read(dirs[1], frameName(b, action, facing.id, index)),
        );
        if (count > 0) hit++;
        if (count > most) {
          most = count;
          mostAt = `${action} ${index}`;
        }
      }
      rows.push({ facing: facing.id, pair: `${a}∩${b}`, framesHit: hit, most, mostAt });
      console.log(
        `  ${facing.id.padEnd(5)} ${`${a}∩${b}`.padEnd(13)} 겹치는 장 ${String(hit).padStart(2)}/${frames.length} · 가장 많이 ${String(most).padStart(5)}px${most > 0 ? ` (${mostAt})` : ''}`,
      );
    }
  }
  writeJson(path.join(ROOT, SCRATCH, 'overlap.json'), rows);
  console.log(`✓ ${SCRATCH}/overlap.json`);
}

/**
 * 기준 컷을 굽는다 — 상의 A · B를 입은 판에 지팡이와 방패를 들려 가림 없이 한 장으로, 네 방향을 층과 같은 자세
 * 와 카메라로. 그림은 `docs/temp/3d-gate/g4/reference/<상의 판>/<방향>/`에 쓴다.
 *
 * 캔버스는 겹쳐 재는 캔버스(무기 층의 것)다. 몸 층 캔버스에 구우면 머리 위로 올라간 지팡이가 잘려, 층 합성에는
 * 있는 픽셀이 기준 컷에 없는 것으로 세어진다.
 */
async function commandReference(): Promise<void> {
  const outDir = path.join(ROOT, SCRATCH, 'reference');
  const { record, shared } = prepareRecordedBake(outDir);
  const canvas = stageCanvas(record.bodyCanvas);
  const jobs = referenceBakeJobs();

  console.log(
    `기준 컷 굽기 ${jobs.length}건 (상의 판 × 방향, 한 건에 ${jobs[0]?.frames.length ?? 0}장)`,
  );
  const started = Date.now();
  const payloads = await runPool(
    jobs.map((job) => () => bakeReference(job, { ...shared, canvas })),
  );

  const problems: string[] = [];
  for (const [i, job] of jobs.entries()) {
    const label = `${job.top}/${job.facing}`;
    problems.push(...groundProblems(record, canvas, payloads[i], label));
    const dir = path.join(outDir, job.top, job.facing);
    const frames = job.frames.map((frame) => readFrame(dir, frame.name));
    problems.push(
      ...layerSetCheck(frames, { count: job.frames.length, canvas }).map((p) => `${label}: ${p}`),
    );
  }
  console.log(`굽기 ${Math.round((Date.now() - started) / 1000)}초`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    throw new Error(`기준 컷 판정 ${problems.length}건이 떨어졌다`);
  }
  console.log(`✓ ${SCRATCH}/reference`);
}

/**
 * 채널 차가 이 값을 넘어야 다른 픽셀로 센다. EEVEE의 샘플 잡음이 같은 장면을 두 번 구워도 한두 단계씩 흔드는
 * 것을 빼려는 값이고, G2의 층 합성 수치(`layers.ts`의 `DIFF_THRESHOLD`)와 같아야 그 수치와 견줄 수 있다.
 */
const DIFF_THRESHOLD = 12;

/**
 * 층을 게임의 형제 순서(`STACK_ORDER` — 방향마다 다르다)로 겹친 그림을 기준 컷과 견줘, 구멍과 앞에 잘못 보인
 * 픽셀을 상의 판 · 방향마다 센다(G4 §5). 굽지 않는다 — `layers`와 `reference`가 구운 그림을 읽는다.
 *
 * 수치로 가림 판을 고르므로, 두 쪽이 지금 입력으로 구워진 것이 아니면 재지 않는다(`assertStamp`).
 */
function commandCompare(): void {
  const record = readCameraRecord();
  const stamp = bakeStamp(record.inputs, CHOSEN_WEAPONS);
  const read = stagedReader(stageCanvas(record.bodyCanvas));
  const layersDir = path.join(ROOT, SCRATCH, 'layers');
  const referenceDir = path.join(ROOT, SCRATCH, 'reference');

  // `--same-order`는 모든 방향을 정면의 순서로 겹쳐 잰다. 방향별 순서가 아직 필요한지를 되짚을 때 쓴다 —
  // 옷이나 무기를 바꾼 뒤 두 결과가 같아졌으면 방향별 표를 접을 수 있다
  const sameOrder = process.argv.includes('--same-order');
  const report: Record<string, unknown>[] = [];
  for (const top of REFERENCE_TOPS) {
    for (const facing of BAKE_FACINGS) {
      const order = stackOrder(sameOrder ? 'front' : facing.id, top);
      const dirs = order.map((layer) => path.join(layersDir, layer, facing.id));
      for (const dir of dirs) assertStamp(dir, stamp, 'bake.ts layers');
      const cutDir = path.join(referenceDir, top, facing.id);
      assertStamp(cutDir, stamp, 'bake.ts reference');

      const zeros = () => Object.fromEntries(order.map((layer) => [layer, 0]));
      const total: IStackVerdict = { holes: 0, misdrawn: zeros(), unmatched: zeros(), fringe: 0 };
      // 앞에 잘못 보인 픽셀이 가장 많은 장 — 사람이 합성 화면에서 먼저 볼 자리다
      let worst = { frame: '', misdrawn: 0 };
      const frames: Record<string, unknown>[] = [];
      for (const { action, index } of facingFrames(facing.id)) {
        const verdict = stackVerdict(
          order.map((layer, at) => ({
            name: layer,
            image: read(dirs[at], frameName(layer, action, facing.id, index)),
          })),
          read(cutDir, frameName(REFERENCE_LAYER, action, facing.id, index)),
          DIFF_THRESHOLD,
        );
        total.holes += verdict.holes;
        total.fringe += verdict.fringe;
        let misdrawnHere = 0;
        for (const layer of order) {
          total.misdrawn[layer] += verdict.misdrawn[layer];
          total.unmatched[layer] += verdict.unmatched[layer];
          misdrawnHere += verdict.misdrawn[layer];
        }
        if (misdrawnHere > worst.misdrawn) {
          worst = { frame: `${action} ${index}`, misdrawn: misdrawnHere };
        }
        frames.push({ frame: `${action} ${index}`, ...verdict });
      }
      report.push({ top, facing: facing.id, total, worst, frames });
      const perLayer = (counts: Record<string, number>): string =>
        order.map((layer) => `${layer} ${String(counts[layer]).padStart(4)}`).join(' · ');
      console.log(
        `  ${top} ${facing.id.padEnd(5)} 구멍 ${String(total.holes).padStart(3)} · 앞에 잘못 보임 ${perLayer(total.misdrawn)} (가장 많은 장 ${worst.frame} ${worst.misdrawn}px)`,
      );
      console.log(
        `  ${' '.repeat(top.length + 6)} 걷어내도 안 맞음 ${perLayer(total.unmatched)} · 술 ${total.fringe}`,
      );
    }
  }
  writeJson(path.join(ROOT, SCRATCH, 'compare.json'), report);
  console.log(`✓ ${SCRATCH}/compare.json (한 줄은 그 방향 11장의 합계, 장별 값은 파일에)`);
}

/**
 * 아틀라스를 담는 설정(G4 §6). 가로 상한 2048은 몸 걷기 32장이 한 장에 들어가는 크기이고, 여백 2px은 가장자리를
 * 1px 늘려 둔 것(extrude)이 이웃 칸에 닿지 않는 최소값이다. 밉맵을 켜는 판은 축소 단계에서 이웃 프레임이 번지므로
 * 여백을 8로 늘려야 한다 — 그 비교는 Cocos 임포트 때 한다.
 */
const ATLAS_PACK = { maxWidth: 2048, padding: 2 };

/**
 * 구운 층을 층 × 동작 단위로 아틀라스에 담고, 담은 것을 검사한 뒤 바이트를 찍는다. 굽지 않는다. 산출물은
 * 추적하지 않는 `docs/temp/3d-gate/g4/atlas/`에 쓴다 — 게임 폴더에 넣는 것은 용량 판단(G4 §8) 뒤의 일이다.
 *
 * 검사는 셋이다. 원본 크기가 그 층이 선언한 캔버스인가(`checkSourceSizes`), 층별 (방향, 동작) 프레임 수가
 * 같은가(`checkFrameCounts`), plist에 적은 값만으로 되돌린 프레임이 담기 전과 바이트까지 같은가(`restoreFrame`).
 * 셋째가 실제 그림에서 `offset`의 부호와 반 픽셀을 붙든다 — 틀리면 판정은 통과하는데 게임 안 발치만 어긋난다.
 */
function commandAtlas(): void {
  const record = readCameraRecord();
  const stamp = bakeStamp(record.inputs, CHOSEN_WEAPONS);
  const layersDir = path.join(ROOT, SCRATCH, 'layers');
  const outDir = path.join(ROOT, SCRATCH, 'atlas');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const problems: string[] = [];
  const entries: IAtlasEntry[] = [];
  const rows: Record<string, unknown>[] = [];
  const bytesByLayer = new Map<string, number>();
  let gpuBytes = 0;
  for (const group of atlasGroups()) {
    const inputs = group.frames.map((frame) => {
      const dir = path.join(layersDir, group.layer, frame.facing);
      assertStamp(dir, stamp, 'bake.ts layers');
      return { name: frame.name, image: readFrame(dir, frame.name) };
    });
    const atlas = buildAtlas(inputs, ATLAS_PACK);
    for (const [i, entry] of atlas.entries.entries()) {
      // 작성기가 트림 전에 옅은 알파를 누르므로 담기 전 그림도 같은 잣대로 눌러 견준다
      const before = normalizeAlpha(inputs[i].image, { faintUpTo: CONTENT_ALPHA - 1 });
      const after = restoreFrame(atlas.image, entry);
      if (Buffer.compare(Buffer.from(before.data), Buffer.from(after.data)) !== 0) {
        problems.push(`${entry.name}: plist 값으로 되돌린 프레임이 담기 전과 다르다`);
      }
    }
    entries.push(...atlas.entries);

    const png = encodePng(atlas.image);
    const textureFileName = `${group.id}.png`;
    fs.writeFileSync(path.join(outDir, textureFileName), png);
    const plist = writePlist(atlas.entries, {
      textureFileName,
      textureSize: { width: atlas.image.width, height: atlas.image.height },
    });
    fs.writeFileSync(path.join(outDir, `${group.id}.plist`), plist, 'utf-8');

    const bytes = png.length + Buffer.byteLength(plist, 'utf-8');
    bytesByLayer.set(group.layer, (bytesByLayer.get(group.layer) ?? 0) + bytes);
    gpuBytes += atlas.image.width * atlas.image.height * 4;
    rows.push({
      id: group.id,
      frames: inputs.length,
      width: atlas.image.width,
      height: atlas.image.height,
      pngBytes: png.length,
      plistBytes: Buffer.byteLength(plist, 'utf-8'),
    });
    console.log(
      `  ${group.id.padEnd(12)} ${String(inputs.length).padStart(2)}장 · ${atlas.image.width}×${atlas.image.height} · PNG ${(png.length / 1024).toFixed(0)}KB`,
    );
  }

  const declared = Object.fromEntries(
    BAKE_LAYERS.map((layer) => [layer, layerCanvas(layer, record.bodyCanvas)]),
  );
  problems.push(...checkSourceSizes(entries, PLAYER_FRAME_SPEC, declared));
  problems.push(...checkFrameCounts(entries.map((entry) => entry.name)));

  let total = 0;
  for (const [layer, bytes] of bytesByLayer) {
    total += bytes;
    console.log(`  ${layer.padEnd(6)} 합계 ${(bytes / 1024).toFixed(0)}KB`);
  }
  console.log(
    `파일 ${rows.length * 2}개(PNG · plist) · 합계 ${(total / 1024 / 1024).toFixed(2)}MB · GPU 메모리(RGBA) ${(gpuBytes / 1024 / 1024).toFixed(1)}MB`,
  );
  writeJson(path.join(outDir, 'report.json'), {
    pack: ATLAS_PACK,
    atlases: rows,
    bytesByLayer: Object.fromEntries(bytesByLayer),
    totalBytes: total,
    gpuBytes,
    problems,
  });

  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    throw new Error(`아틀라스 검사 ${problems.length}건이 떨어졌다`);
  }
  console.log(`✓ ${SCRATCH}/atlas — 원본 크기 · 프레임 수 · 왕복 검사를 통과했다`);
}

/**
 * 구운 층을 게임의 형제 순서로 겹쳐 재생하는 화면을 쓴다. 굽지 않는다 — `layers`가 구운 그림을 읽는다.
 *
 * 돌아서는 모습과 층끼리의 가림은 그림 한 장으로 판정할 수 없어서, 사람이 브라우저에서 방향 · 상의 · 무기를
 * 바꿔 가며 본다(G4 §5). 화면이 읽는 값은 전부 여기서 박아 넣는다 — 템플릿에 규격값을 적어 두면 카메라를
 * 다시 잡았을 때 화면만 옛 값으로 남는다.
 */
function commandPreview(): void {
  const record = readCameraRecord();
  if (!fs.existsSync(path.join(ROOT, SCRATCH, 'layers'))) {
    throw new Error(`구운 층이 없다: ${SCRATCH}/layers — \`bake.ts layers\`를 먼저 돌린다`);
  }
  const layers = Object.fromEntries(
    BAKE_LAYERS.map((layer) => [layer, layerCanvas(layer, record.bodyCanvas)]),
  );
  const stage = stageCanvas(record.bodyCanvas);
  // 기준 컷은 구워져 있을 때만 넘긴다. 없으면 화면이 「기준 컷」 보기를 잠근다
  const reference = fs.existsSync(path.join(ROOT, SCRATCH, 'reference'))
    ? { root: 'reference', layer: REFERENCE_LAYER, tops: REFERENCE_TOPS, canvas: stage }
    : null;
  const data = {
    root: 'layers',
    stage,
    layers,
    order: STACK_ORDER,
    reference,
    facings: BAKE_FACINGS.map((f) => ({ id: f.id, label: `${FACING_LABEL[f.id]} (${f.yaw}°)` })),
    frames: { walk: CHOSEN_MOTION.walkFrames, idle: IDLE_PLAYBACK.phases.length },
    idleOrder: IDLE_PLAYBACK.order,
    fps: { walk: CHOSEN_MOTION.walkFps, idle: CHOSEN_MOTION.idleFps },
    groundRow: record.groundRow,
    bodyHeight: PLAYER_FRAME_SPEC.height,
    gameHeightUnits: GAME_HEIGHT_UNITS,
  };
  const template = fs.readFileSync(path.join(ROOT, 'tools/blender/layers_preview.html'), 'utf-8');
  // 자리표시자가 정확히 한 번 있어야 한다. 주석에 같은 문자열이 하나 더 있으면 `replace`가 그쪽을 바꿔
  // 화면이 값 없이 뜨는데, 굽기도 명령도 멀쩡히 끝나서 브라우저를 열기 전에는 드러나지 않는다
  const placeholder = '/*__DATA__*/null';
  if (template.split(placeholder).length !== 2) {
    throw new Error(`layers_preview.html에 자리표시자 ${placeholder}가 정확히 한 번 있어야 한다`);
  }
  const page = path.join(ROOT, SCRATCH, 'preview.html');
  fs.writeFileSync(page, template.replace(placeholder, JSON.stringify(data)), 'utf-8');
  console.log(`✓ ${SCRATCH}/preview.html`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'camera') return commandCamera();
  if (command === 'layers') return commandLayers();
  if (command === 'preview') return commandPreview();
  if (command === 'overlap') return commandOverlap();
  if (command === 'reference') return commandReference();
  if (command === 'compare') return commandCompare();
  if (command === 'atlas') return commandAtlas();
  throw new Error(
    `명령을 모른다: ${command ?? '(없음)'} — camera · layers · preview · overlap · reference · compare · atlas 중 하나를 준다`,
  );
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
