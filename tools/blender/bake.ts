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
import { decodePng } from '../art/PngCodec.ts';
import { parseFrameName } from './Atlas.ts';
import { MODEL_HEIGHT_M, writeChosenSpecs } from './BakeSpec.ts';
import { runBlender, runPool, writeJson } from './BlenderRun.ts';
import {
  BAKE_ACTIONS,
  bakeDefinition,
  bakeToon,
  bodyCanvasWidth,
  CONTENT_ALPHA,
  definitionHash,
  fitCamera,
  type IBakeInputs,
  type ICameraPose,
  type ICameraRecord,
  type ICanvas,
  type ILayerBakeJob,
  layerBakeJobs,
  layerCanvas,
  layerSetCheck,
  layerSource,
  projectRow,
  staleReasons,
} from './LayerBake.ts';

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
}

/**
 * 굽기 일감 하나를 돌린다. 그림은 `<outDir>/<층>/<방향>/`에 쓴다. 앞 실행의 그림이 남아 있으면 굽는 쪽이
 * 덮어쓰기를 거부하므로 폴더를 먼저 비운다.
 */
function bake(job: ILayerBakeJob, shared: IBakeShared): Promise<Record<string, unknown>> {
  const dir = frameDir(shared.outDir, job);
  fs.rmSync(dir, { recursive: true, force: true });
  const definition = writeJson(
    path.join(shared.outDir, 'defs', `${job.layer}_${job.facing}.json`),
    {
      id: `${job.layer}_${job.facing}`,
      frames: job.frames,
    },
  );
  const source = layerSource(job.layer);
  const extra: string[] = [];
  if (source.topModel) extra.push('--top-vrm', shared.models[source.topModel]);
  if (source.weapon) {
    if (!shared.weapons) throw new Error(`${job.layer} 층을 굽는데 무기 사양을 안 받았다`);
    extra.push(`--${source.weapon}-spec`, shared.weapons[source.weapon]);
  }
  return runBlender(
    path.join(ROOT, 'tools/blender/bake_motion.py'),
    [
      '--layer',
      source.pythonLayer,
      ...extra,
      '--vrm',
      shared.models.base,
      '--frames',
      definition,
      '--out-dir',
      dir,
      '--yaw',
      String(job.yaw),
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
    `${job.layer}/${job.facing}`,
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
  const models = modelPaths();
  const record = readCameraRecord();
  const stale = staleReasons(
    record.inputs,
    currentInputs(models, { blender: record.inputs.blender, vrmAddon: record.inputs.vrmAddon }),
  );
  if (stale.length > 0) {
    for (const reason of stale) console.error(`✗ ${reason}`);
    throw new Error(
      '카메라를 잡은 뒤에 입력이 바뀌었다 — `bake.ts camera`로 다시 잡고 모든 층을 굽는다',
    );
  }

  const only = option('only')?.split(',');
  const jobs = layerBakeJobs().filter((job) => !only || only.includes(job.layer));
  const outDir = path.join(ROOT, SCRATCH, 'layers');
  fs.mkdirSync(outDir, { recursive: true });
  const toon = writeJson(path.join(outDir, 'specs', 'toon.json'), bakeToon());
  const [staff, shield] = writeChosenSpecs(path.join(outDir, 'specs'));
  const camera = writePythonCamera(path.join(outDir, 'specs', 'camera.json'), record.camera, {
    blender: record.inputs.blender,
    vrmAddon: record.inputs.vrmAddon,
  });

  console.log(`굽기 ${jobs.length}건 (층 × 방향, 한 건에 ${jobs[0]?.frames.length ?? 0}장)`);
  const started = Date.now();
  const payloads = await runPool(
    jobs.map(
      (job) => () =>
        bake(job, {
          outDir,
          models,
          camera,
          toon,
          weapons: { staff, shield },
          canvas: layerCanvas(job.layer, record.bodyCanvas),
        }),
    ),
  );
  const bakeSeconds = Math.round((Date.now() - started) / 1000);

  const problems: string[] = [];
  const bodySets: IFrameMeasurement[][] = [];
  for (const [i, job] of jobs.entries()) {
    const canvas = layerCanvas(job.layer, record.bodyCanvas);
    const label = `${job.layer}/${job.facing}`;

    // 모든 층 — 기록된 카메라로 구워졌는가. 발밑 점은 캔버스 중심에서 같은 거리만큼 떨어져 있어야 한다
    const expectedGround =
      projectRow(record.camera, PLAYER_FRAME_SPEC.height, [0, 0, 0]) +
      (canvas.height - PLAYER_FRAME_SPEC.height) / 2;
    const [groundX, groundY] = payloads[i].ground_px as [number, number];
    if (Math.abs(groundY - expectedGround) > 0.05 || Math.abs(groundX - canvas.width / 2) > 0.05) {
      problems.push(
        `${label}: 발밑 점이 (${groundX}, ${groundY})인데 (${canvas.width / 2}, ${expectedGround.toFixed(2)})이어야 한다 — 기록된 카메라로 구워지지 않았다`,
      );
    }

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

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'camera') return commandCamera();
  if (command === 'layers') return commandLayers();
  throw new Error(`명령을 모른다: ${command ?? '(없음)'} — camera · layers 중 하나를 준다`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
