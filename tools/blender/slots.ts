/**
 * 슬롯 범위 탐침(G4 §12)의 실행기 — **출하하지 않는 시험 굽기다.**
 *
 * v1은 몸 · 상의 · 지팡이 · 방패 다섯 층으로 출하한다. 이 실행기는 그 밖의 슬롯(하의 · 신발 · 머리카락 …)을 층으로
 * 떼는 것이 이 굽기에서 되는지, 뗀 층끼리의 앞뒤를 겹치는 순서만으로 풀 수 있는지를 시험으로 굽고 잰다. 재는 식은
 * 생산 굽기의 가림 판 채택(G4 §5.1)과 같다 — 층을 겹친 그림을 가림 없이 한 장으로 구운 기준 컷과 견줘 구멍과 앞에
 * 잘못 보인 픽셀을 센다(`LayerBake.ts`의 `stackVerdict`). 남기는 것은 규칙이고, 구운 그림은 추적하지 않는
 * `docs/temp/3d-gate/g4/slots/`에 둔다.
 *
 * 돌리는 법 (레포 루트에서):
 *
 *   BLENDER='C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' \
 *     node --experimental-strip-types tools/blender/slots.ts bake
 *
 *   bake      경우마다 층과 기준 컷을 네 방향으로 굽는다. `--only <경우>`로 하나만 굽는다
 *   judge     굽지 않고, 구운 것을 겹치는 순서 후보마다 기준 컷과 견줘 찍는다. `--only <경우>`
 *
 *   --model-dir <폴더>  생산 `.vrm`이 있는 폴더(기본은 `bake.ts`와 같다)
 *
 * 카메라는 생산 굽기의 기록(`camera.json`)을 그대로 쓴다. 탐침의 층이 생산 층과 같은 크기 · 자리로 구워져야
 * 잰 값이 생산 굽기에 그대로 옮겨진다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IRgbaImage } from '../../tests/helpers/SpriteMetrics.ts';
import { decodePng } from '../art/PngCodec.ts';
import { frameName, parseFrameName } from './Atlas.ts';
import { runBlender, runPool, writeJson } from './BlenderRun.ts';
import {
  BAKE_FACINGS,
  bakeMotionArgs,
  bakeToon,
  centerOnCanvas,
  type ICameraRecord,
  type ICanvas,
  layerBakeJobs,
  layerCanvas,
  layerSetCheck,
  REFERENCE_LAYER,
  stackVerdict,
} from './LayerBake.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 구운 그림의 자리. 추적되지 않는 스크래치다. */
const SCRATCH = 'docs/temp/3d-gate/g4/slots';

/** 생산 `.vrm`의 기본 자리 — `bake.ts`와 같다. */
const DEFAULT_MODEL_DIR = 'cloud-storage/art/production/player/2026-09-16-player-3d';

/** 채널 차가 이 값을 넘어야 다른 픽셀로 센다 — 생산 굽기의 비교(`bake.ts compare`)와 같은 문턱이다. */
const DIFF_THRESHOLD = 12;

/** 경우가 쓰는 모델 판의 절대 경로. */
type Models = Record<'base', string>;

/** 탐침 한 경우 — 무엇을 층으로 떼어 굽고, 무엇과 견주고, 어떤 순서 후보를 재는가. */
interface ISlotCase {
  id: string;
  /** 이 경우가 가르려는 것 */
  what: string;
  /** 층마다 `bake_motion.py`에 넘기는 인자. 이름은 프레임 이름의 층 자리에 들어가므로 영문자와 숫자만 쓴다 */
  layers: Record<string, (models: Models) => string[]>;
  /** 기준 컷의 인자 — 같은 것을 가림 없이 한 장으로 굽는다 */
  reference: (models: Models) => string[];
  /** 잴 겹치는 순서(아래부터) */
  orders: string[][];
}

/** 몸 메시에서 지워 맨몸을 남길 옷의 머티리얼. 하의 · 신발을 층으로 떼는 경우들이 나눠 쓴다. */
const STRIPPED = ['--drop-materials', 'Bottoms,Shoes'];

const CASES: ISlotCase[] = [
  {
    id: 'bottomsShoes',
    what: '기본 하의 · 신발을 머티리얼로 골라 층으로 떼어도 걷는 동안 몸과 어긋나지 않는가, 둘의 앞뒤는 어느 쪽인가',
    layers: {
      // 맨살 판의 몸 메시에서 옷의 면을 지운 맨몸. 옷을 전부 끈 판을 안 쓰는 이유는 `bake_motion.py`의
      // `drop_materials`가 든다(그 판은 신발 밑창만큼 내려가 있고 발 모양이 다르다)
      bodyBare: () => ['--layer', 'body', ...STRIPPED],
      bottoms: (m) => [
        '--layer',
        'top',
        '--top-vrm',
        m.base,
        '--keep-material',
        'Bottoms',
        ...STRIPPED,
      ],
      shoes: (m) => [
        '--layer',
        'top',
        '--top-vrm',
        m.base,
        '--keep-material',
        'Shoes',
        ...STRIPPED,
      ],
    },
    reference: () => ['--layer', REFERENCE_LAYER],
    orders: [
      ['bodyBare', 'bottoms', 'shoes'],
      ['bodyBare', 'shoes', 'bottoms'],
    ],
  },
];

/** 명령줄 인자에서 `--name 값`을 읽는다. */
function option(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

/** 돌릴 경우들. `--only`가 모르는 이름이면 아는 이름을 말하며 던진다. */
function chosenCases(): ISlotCase[] {
  const only = option('only');
  if (!only) return CASES;
  const found = CASES.filter((each) => each.id === only);
  if (found.length === 0) {
    throw new Error(
      `경우를 모른다: ${only} — ${CASES.map((each) => each.id).join(' · ')} 중 하나를 준다`,
    );
  }
  return found;
}

/** 모델 판의 절대 경로. 없으면 어디 있어야 하는지 말하며 던진다. */
function modelPaths(): Models {
  const dir = path.resolve(ROOT, option('model-dir') ?? DEFAULT_MODEL_DIR);
  const base = path.join(dir, 'player_base.vrm');
  if (!fs.existsSync(base)) {
    throw new Error(
      `생산 .vrm이 없다: ${base}\n  커밋하지 않는 파일이다. 다른 자리에 있으면 --model-dir로 준다.`,
    );
  }
  return { base };
}

/** 생산 굽기의 카메라 기록. */
function readCameraRecord(): ICameraRecord {
  const file = path.join(ROOT, 'tools/blender/camera.json');
  if (!fs.existsSync(file)) throw new Error('카메라 기록이 없다 — `bake.ts camera`를 먼저 돌린다');
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as ICameraRecord;
}

/** 탐침의 캔버스 — 생산 굽기에서 층을 겹쳐 재는 캔버스(무기 층의 것)와 같다. 장비가 몸 캔버스를 넘을 수 있다. */
function probeCanvas(record: ICameraRecord): ICanvas {
  return layerCanvas('staff', record.bodyCanvas);
}

/** 한 방향에서 굽는 프레임의 자세. 생산 굽기와 같은 함수에서 낸다 — 자세가 다르면 잰 값을 옮길 수 없다. */
function facingPoses(facing: string) {
  const job = layerBakeJobs().find((each) => each.layer === 'body' && each.facing === facing);
  if (!job) throw new Error(`굽는 방향에 ${facing}이 없다`);
  return job;
}

/** 자세에 그 층의 이름을 붙인다. */
function namedFor(layer: string, facing: string) {
  return facingPoses(facing).frames.map((frame) => {
    const parts = parseFrameName(frame.name);
    if (!parts) throw new Error(`프레임 이름이 규칙에 안 맞는다: ${frame.name}`);
    return { ...frame, name: frameName(layer, parts.action, facing, parts.index) };
  });
}

/** 경우마다 층과 기준 컷을 네 방향으로 굽고, 구운 세트가 비지 않았고 캔버스 변에 안 닿았는지 본다. */
async function commandBake(): Promise<void> {
  const models = modelPaths();
  const record = readCameraRecord();
  const canvas = probeCanvas(record);

  for (const item of chosenCases()) {
    const outDir = path.join(ROOT, SCRATCH, item.id);
    fs.rmSync(outDir, { recursive: true, force: true });
    const camera = writeJson(path.join(outDir, 'specs', 'camera.json'), {
      pitch_deg: record.camera.pitchDeg,
      aim_z: record.camera.aimZ,
      per_pixel_m: record.camera.perPixelM,
      blender: record.inputs.blender,
      vrm_addon: record.inputs.vrmAddon,
    });
    const toon = writeJson(path.join(outDir, 'specs', 'toon.json'), bakeToon());

    const bakes = [
      ...Object.entries(item.layers).map(([layer, args]) => ({ layer, extra: args(models) })),
      { layer: REFERENCE_LAYER, extra: item.reference(models) },
    ];
    const jobs = bakes.flatMap(({ layer, extra }) =>
      BAKE_FACINGS.map((facing) => async () => {
        const frames = namedFor(layer, facing.id);
        const definition = writeJson(path.join(outDir, 'defs', `${layer}_${facing.id}.json`), {
          id: `${layer}_${facing.id}`,
          frames,
        });
        const dir = path.join(outDir, layer, facing.id);
        await runBlender(
          path.join(ROOT, 'tools/blender/bake_motion.py'),
          bakeMotionArgs({
            vrm: models.base,
            frames: definition,
            outDir: dir,
            yaw: facing.yaw,
            camera,
            toon,
            canvas,
            extra,
          }),
          `${item.id} ${layer}/${facing.id}`,
        );
        const images = frames.map((frame) => readFrame(dir, frame.name));
        return layerSetCheck(images, { count: frames.length, canvas }).map(
          (problem) => `${layer}/${facing.id}: ${problem}`,
        );
      }),
    );

    console.log(`${item.id} — 굽기 ${jobs.length}건`);
    const started = Date.now();
    const problems = (await runPool(jobs)).flat();
    console.log(`  ${Math.round((Date.now() - started) / 1000)}초`);
    if (problems.length > 0) {
      for (const problem of problems) console.error(`✗ ${problem}`);
      throw new Error(`${item.id}: 구운 세트 ${problems.length}건이 검사에서 떨어졌다`);
    }
  }
  console.log(`✓ ${SCRATCH}`);
}

/** 구운 프레임 한 장을 읽는다. */
function readFrame(dir: string, name: string): IRgbaImage {
  const file = path.join(dir, `${name}.png`);
  if (!fs.existsSync(file))
    throw new Error(`구운 프레임이 없다: ${file} — \`slots.ts bake\`를 먼저 돌린다`);
  return decodePng(fs.readFileSync(file));
}

/**
 * 경우마다 겹치는 순서 후보를 기준 컷과 견줘 찍는다. 한 줄은 그 방향 11장의 합계다.
 *
 * 「앞에 잘못 보임」이 순서를 가르는 값이고, 「걷어내도 안 맞음」은 층을 따로 구워 겹치면 어느 순서에서든 윤곽을
 * 따라 나오는 차이다(G4 §5.1).
 */
function commandJudge(): void {
  const canvas = probeCanvas(readCameraRecord());
  const report: Record<string, unknown>[] = [];
  for (const item of chosenCases()) {
    const outDir = path.join(ROOT, SCRATCH, item.id);
    console.log(`${item.id} — ${item.what}`);
    for (const order of item.orders) {
      console.log(`  순서 ${order.join(' → ')}`);
      for (const facing of BAKE_FACINGS) {
        let holes = 0;
        let unmatched = 0;
        const misdrawn: Record<string, number> = Object.fromEntries(
          order.map((layer) => [layer, 0]),
        );
        let worst = { frame: '', pixels: 0 };
        for (const pose of facingPoses(facing.id).frames) {
          const parts = parseFrameName(pose.name);
          if (!parts) throw new Error(`프레임 이름이 규칙에 안 맞는다: ${pose.name}`);
          const at = (layer: string) =>
            centerOnCanvas(
              readFrame(
                path.join(outDir, layer, facing.id),
                frameName(layer, parts.action, facing.id, parts.index),
              ),
              canvas,
            );
          const verdict = stackVerdict(
            order.map((layer) => ({ name: layer, image: at(layer) })),
            at(REFERENCE_LAYER),
            DIFF_THRESHOLD,
          );
          holes += verdict.holes;
          let here = verdict.holes;
          for (const layer of order) {
            misdrawn[layer] += verdict.misdrawn[layer];
            unmatched += verdict.unmatched[layer];
            here += verdict.misdrawn[layer];
          }
          if (here > worst.pixels)
            worst = { frame: `${parts.action} ${parts.index}`, pixels: here };
        }
        report.push({ case: item.id, order, facing: facing.id, holes, misdrawn, unmatched, worst });
        const total = Object.values(misdrawn).reduce((a, b) => a + b, 0);
        console.log(
          `    ${facing.id.padEnd(5)} 구멍 ${String(holes).padStart(3)} · 앞에 잘못 보임 ${String(total).padStart(5)} (${order
            .map((layer) => `${layer} ${misdrawn[layer]}`)
            .join(
              ' · ',
            )}) · 가장 나쁜 장 ${worst.frame} ${worst.pixels}px · 걷어내도 안 맞음 ${unmatched}`,
        );
      }
    }
  }
  writeJson(path.join(ROOT, SCRATCH, 'report.json'), report);
  console.log(`✓ ${SCRATCH}/report.json`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'bake') return commandBake();
  if (command === 'judge') return commandJudge();
  throw new Error(`명령을 모른다: ${command ?? '(없음)'} — bake · judge 중 하나를 준다`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
