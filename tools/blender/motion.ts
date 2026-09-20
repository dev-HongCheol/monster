/**
 * G3 — 걷기 · 대기 후보를 굽고, 수치를 재고, 나란히 재생하는 화면을 만든다.
 *
 * 동작은 그림 한 장으로 판정할 수 없다. 그래서 후보를 한 판씩 구워 보여 주지 않고, 전부 구운 뒤 브라우저에서
 * 나란히 재생해 사람이 고른다(G3 §3). 화면에서 바꿔 볼 수 있는 것은 굽기에 박히지 않는 값들이다 — 프레임 수
 * (6 · 8장, 같은 주기에서 골라 쓴다), 재생 속도, 표시 크기, 이동 흉내, 발밑 마법진의 회전.
 *
 * 재는 것은 G3 §5의 둘(정면에서 발바닥이 카메라를 향하는 각, 발목의 좌우 이동)과 접지 오차 · 머리 오르내림
 * · 미끄러짐 배수다. 파이썬이 모델 좌표로 돌려준 본 위치를 여기서 잰다. 통과 · 탈락을 가르지는 않는다 — 사람이
 * 고른 뒤 그 후보의 수치를 QA 문서에 적는다.
 *
 * 돌리는 법 (레포 루트에서):
 *
 *   BLENDER='C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' \
 *     node --experimental-strip-types tools/blender/motion.ts
 *
 *   --vrm <경로>         옷 입은 판(기본: 상의 A). 생산 `.vrm`은 커밋하지 않아 장비마다 경로가 다를 수 있다
 *   --only a,b           그 후보만 굽는다(`walk_calm` · `walk_brisk` · `jog` · `dash` · `idle`)
 *   --views front,back   그 방향만 굽는다(`front` · `right60` · `right45` · `back`)
 *   --page-only          굽지 않고 이미 있는 `metrics.json`으로 화면만 다시 만든다
 *
 * 산출물은 추적하지 않는 `docs/temp/3d-gate/g3/`에 쓴다. `preview.html`을 브라우저로 연다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_FRAME_SPEC } from '../../tests/helpers/FrameSet.ts';
import {
  CHOSEN_HULL,
  CHOSEN_PITCH,
  CIRCLE_DIAMETER_PER_HEIGHT,
  GEAR_TOON,
  hullMaterials,
  MODEL_HEIGHT_M,
  writeChosenSpecs,
} from './BakeSpec.ts';
import { runBlender, runPool, writeJson } from './BlenderRun.ts';
import {
  GAIT_CANDIDATES,
  gaitFrame,
  IDLE_BAKED,
  IDLE_PLAYBACK,
  type IMotionFrame,
  idleFrame,
  mergedPhases,
  PLAYER_LEG_RIG,
  standFrame,
  stepLength,
} from './MotionSpec.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 산출물 자리. 추적되지 않는 스크래치다. */
const OUT_DIR = 'docs/temp/3d-gate/g3';

/** 상의 A를 입은 판 — 시작 복장이다(2026-09-20 사용자 결정). */
const DEFAULT_VRM = 'cloud-storage/art/production/player/2026-09-16-player-3d/player_top_a.vrm';

/**
 * 굽는 캔버스(px). 지팡이가 머리 위로 올라가고 뛰기는 몸이 뜨므로 기준 246×493보다 크게 잡는다(ADR 009).
 * 가로 · 세로의 홀짝은 기준과 같아야 한다 — 어긋나면 중심이 반 픽셀 밀려 굽기가 거부한다.
 */
const CANVAS = { width: 600, height: 701 };

/** 게임이 그리는 플레이어 높이(월드 단위, G2 크기 결정 — G5 §2.6). 720p에서 1단위가 1px이다. */
const GAME_HEIGHT_UNITS = 77;

/** 게임의 이동 속도(월드 단위/초) — `game/assets/resources/data/player.json`의 `speed`. */
const GAME_SPEED_UNITS = 300;

/** 걷기 프레임 수 후보. 같은 주기에서 골라 쓰므로 한 번만 굽는다(`mergedPhases`). */
const FRAME_COUNTS = [6, 8] as const;

/**
 * 방향. 모델을 돌려 만든다. `flow`는 이동 흉내에서 바닥이 흐르는 방향(화면 기준)으로, 캐릭터가 가는 쪽의 반대다.
 *
 * **좌우는 순수 측면(90°)이 아니다.** 규격 정본이 좌우를 3/4 각도로 정했고(`art-asset-spec.md` §3.4 — 내려다보는
 * 시점에서는 3/4가 더 자연스럽게 읽힌다), G2의 가림 탐침도 45° · 315°로 구웠다. 장비 검토에서는 사용자가 「정면으로
 * 약간 튼 측면」을 골라 순수 측면에서 30° 튼 각(왼쪽 300°)을 썼다. 게임의 좌우가 그 둘 중 어느 각인지는 아직
 * 숫자로 못 박히지 않았으므로 둘 다 굽는다. 첫 판은 90°로 구웠다가 계획과 다르다는 지적을 받았다(2026-09-20).
 */
const VIEWS = [
  { id: 'front', label: '정면', yaw: 0, flow: [0, -1] },
  { id: 'right60', label: '오른쪽 — 정면으로 30° 튼 측면', yaw: 60, flow: [-1, 0] },
  { id: 'right45', label: '오른쪽 — 3/4', yaw: 45, flow: [-1, 0] },
  { id: 'back', label: '뒤', yaw: 180, flow: [0, 1] },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];

/** 파이썬이 돌려주는 프레임 하나의 실측. 좌표는 모델 축(m)이다. */
interface IMeasuredFrame {
  name: string;
  phase: number;
  bones: Record<string, [number, number, number]>;
  sole_min_z: Record<'L' | 'R', number | null>;
  sole_front_deg: Record<'L' | 'R', number>;
}

/** 후보 하나의 수치 — 화면의 표와 QA 문서에 적는 값이다. */
interface IMotionMetrics {
  /** 정면에서 발바닥이 카메라를 향하는 각의 최댓값(도). G3 통과 조건은 5 이하 */
  soleFrontMaxDeg: number;
  /** 발목이 좌우로 움직인 폭(m) — 두 발 가운데 큰 쪽. G3 통과 조건은 1440p에서 2px 이하 */
  ankleLateralM: number;
  /** 가장 낮은 발바닥의 높이 범위(m). 걷기는 둘 다 0에 가까워야 하고 뛰기는 위쪽이 뜬 높이다 */
  soleLowestM: [number, number];
  /** 머리가 오르내린 폭(m) */
  headBobM: number;
  /** 머리가 좌우로 움직인 폭(m) */
  headLateralM: number;
  /** 지팡이 든 손이 움직인 폭(m, x · y · z) */
  staffHandTravelM: [number, number, number];
}

/** 굽기 한 번(후보 × 방향)의 일감. */
interface IBakeJob {
  id: string;
  view: (typeof VIEWS)[number];
  frames: (IMotionFrame & { name: string })[];
}

/** 명령줄 인자에서 `--name 값`을 읽는다. */
function option(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

/** 값들의 (최대 − 최소). */
function range(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
}

/**
 * 모델 좌표 실측에서 후보 하나의 수치를 낸다.
 *
 * 어느 방향의 실측을 넣어도 같다 — 파이썬이 모델을 돌리기 전의 축으로 돌려주기 때문이다. 그래서 굽기마다
 * 재지 않고 첫 방향 것만 쓴다.
 */
function measureMotion(frames: readonly IMeasuredFrame[]): IMotionMetrics {
  const axis = (bone: string, index: number): number[] =>
    frames.map((f) => f.bones[bone]?.[index]).filter((v): v is number => typeof v === 'number');
  const lowest = frames.map((f) =>
    Math.min(
      f.sole_min_z.L ?? Number.POSITIVE_INFINITY,
      f.sole_min_z.R ?? Number.POSITIVE_INFINITY,
    ),
  );
  return {
    soleFrontMaxDeg: Math.max(
      ...frames.flatMap((f) => [f.sole_front_deg.L ?? 0, f.sole_front_deg.R ?? 0]),
    ),
    ankleLateralM: Math.max(range(axis('J_Bip_L_Foot', 0)), range(axis('J_Bip_R_Foot', 0))),
    soleLowestM: [Math.min(...lowest), Math.max(...lowest)],
    headBobM: range(axis('J_Bip_C_Head', 2)),
    headLateralM: range(axis('J_Bip_C_Head', 0)),
    staffHandTravelM: [
      range(axis('J_Bip_R_Hand', 0)),
      range(axis('J_Bip_R_Hand', 1)),
      range(axis('J_Bip_R_Hand', 2)),
    ],
  };
}

/** 굽기 일감 하나를 돌린다. 키프레임 정의를 JSON으로 쓰고 `bake_motion.py`에 넘긴다. */
function bake(
  job: IBakeJob,
  shared: { outDir: string; vrm: string; toon: string; staff: string; shield: string },
): Promise<Record<string, unknown>> {
  const dir = path.join(shared.outDir, job.id, job.view.id);
  // 앞 실행의 프레임이 남아 있으면 위상 수를 바꿨을 때 옛 장이 섞여 재생된다
  fs.rmSync(dir, { recursive: true, force: true });
  const definition = writeJson(path.join(shared.outDir, 'defs', `${job.id}.json`), {
    id: job.id,
    frames: job.frames,
  });
  return runBlender(
    path.join(ROOT, 'tools/blender/bake_motion.py'),
    [
      '--vrm',
      shared.vrm,
      '--frames',
      definition,
      '--out-dir',
      dir,
      '--yaw',
      String(job.view.yaw),
      '--pitch',
      String(CHOSEN_PITCH),
      '--toon',
      shared.toon,
      '--staff-spec',
      shared.staff,
      '--shield-spec',
      shared.shield,
      '--width',
      String(PLAYER_FRAME_SPEC.width),
      '--height',
      String(PLAYER_FRAME_SPEC.height),
      '--foot-row',
      String(PLAYER_FRAME_SPEC.footLineY),
      '--head-row',
      String(PLAYER_FRAME_SPEC.headLineY),
      '--layer-width',
      String(CANVAS.width),
      '--layer-height',
      String(CANVAS.height),
    ],
    `${job.id}/${job.view.id}`,
  );
}

/** 프레임에 파일 이름을 붙인다 — `p_00`처럼 자리수를 채워야 사전순과 재생 순서가 같다. */
function named(
  prefix: string,
  frames: readonly IMotionFrame[],
): (IMotionFrame & { name: string })[] {
  return frames.map((frame, i) => ({ ...frame, name: `${prefix}_${String(i).padStart(2, '0')}` }));
}

/** 화면이 읽는 데이터 — `preview.html`에 그대로 박힌다. */
interface IPageData {
  canvas: { width: number; height: number };
  /** 캔버스 1px이 720p에서 몇 px인가 */
  gameScale: number;
  gameHeightUnits: number;
  gameSpeedUnits: number;
  unitsPerMeter: number;
  pitchDeg: number;
  circleDiameterUnits: number;
  views: { id: ViewId; label: string; flow: readonly [number, number] }[];
  picks: Record<number, number[]>;
  phaseCount: number;
  /** 대기 프레임을 재생하는 순서 — 구운 장의 번호다 */
  idleOrder: readonly number[];
  idleBaked: number;
  /** 방향마다 발밑 점(캔버스 px) — 마법진의 중심이자 숨쉬기 배율의 기준점이다 */
  ground: Partial<Record<ViewId, [number, number]>>;
  gaits: { id: string; label: string; stepUnits: number; hop: number; metrics: IMotionMetrics }[];
  idle: { id: string; label: string; metrics: IMotionMetrics } | null;
}

async function main(): Promise<void> {
  const outDir = path.join(ROOT, OUT_DIR);
  const metricsFile = path.join(outDir, 'metrics.json');
  const pageOnly = process.argv.includes('--page-only');

  if (!pageOnly) {
    const vrm = path.resolve(ROOT, option('vrm') ?? DEFAULT_VRM);
    if (!fs.existsSync(vrm)) {
      throw new Error(
        `생산 .vrm이 없다: ${vrm}\n  커밋하지 않는 파일이라 이 장비의 cloud-storage/에 있어야 한다. 다른 자리에 있으면 --vrm으로 준다.`,
      );
    }
    const only = option('only')?.split(',');
    const viewIds = option('views')?.split(',');
    const views = VIEWS.filter((v) => !viewIds || viewIds.includes(v.id));
    const gaits = GAIT_CANDIDATES.filter((g) => !only || only.includes(g.id));
    const withIdle = !only || only.includes('idle');

    fs.mkdirSync(outDir, { recursive: true });
    const [staff, shield] = writeChosenSpecs(path.join(outDir, 'specs'));
    const toon = writeJson(path.join(outDir, 'specs', 'toon_final.json'), {
      id: 'g3_final_look',
      materials: hullMaterials(CHOSEN_HULL, GEAR_TOON),
    });
    const shared = { outDir, vrm, toon, staff, shield };

    const { phases, picks } = mergedPhases(FRAME_COUNTS);
    const jobs: IBakeJob[] = [];
    for (const gait of gaits) {
      const frames = named(
        'p',
        phases.map((phase) => gaitFrame(gait, PLAYER_LEG_RIG, phase)),
      );
      for (const view of views) jobs.push({ id: gait.id, view, frames });
    }
    if (withIdle) {
      const frames = [
        { ...standFrame(), name: 'stand' },
        ...named(
          'b',
          IDLE_PLAYBACK.phases.map((phase) => idleFrame(IDLE_BAKED, PLAYER_LEG_RIG, phase)),
        ),
      ];
      for (const view of views) jobs.push({ id: 'idle', view, frames });
    }

    console.log(
      `굽기 ${jobs.length}건 (후보 ${gaits.length}${withIdle ? ' + 대기' : ''} × 방향 ${views.length})`,
    );
    const started = Date.now();
    const payloads = await runPool(
      jobs.map((job) => async () => {
        const payload = await bake(job, shared);
        // 실측 원본을 남긴다. 표의 수치가 이상할 때 어느 프레임의 어느 본이 그랬는지를 다시 굽지 않고 본다
        writeJson(path.join(outDir, 'defs', `${job.id}_${job.view.id}_measured.json`), payload);
        console.log(`  ✓ ${job.id}/${job.view.id}`);
        return payload;
      }),
    );
    console.log(`굽기 끝 — ${Math.round((Date.now() - started) / 1000)}초`);

    const unitsPerMeter = GAME_HEIGHT_UNITS / MODEL_HEIGHT_M;
    const ground: IPageData['ground'] = {};
    const measured = new Map<string, IMotionMetrics>();
    jobs.forEach((job, i) => {
      const payload = payloads[i];
      ground[job.view.id] = payload.ground_px as [number, number];
      if (!measured.has(job.id)) {
        const frames = (payload.frames as IMeasuredFrame[]).filter((f) => f.name !== 'stand');
        measured.set(job.id, measureMotion(frames));
      }
    });

    // `--only`로 일부만 구웠으면 앞 실행의 나머지 후보를 표에서 잃지 않도록 이어 붙인다
    const previous: IPageData | null = fs.existsSync(metricsFile)
      ? (JSON.parse(fs.readFileSync(metricsFile, 'utf-8')) as IPageData)
      : null;
    const gaitRows = GAIT_CANDIDATES.flatMap((gait) => {
      const metrics =
        measured.get(gait.id) ?? previous?.gaits.find((g) => g.id === gait.id)?.metrics;
      if (!metrics) return [];
      return [
        {
          id: gait.id,
          label: gait.label,
          stepUnits: stepLength(gait, PLAYER_LEG_RIG) * unitsPerMeter,
          hop: gait.hop,
          metrics,
        },
      ];
    });
    const idleMetrics = measured.get('idle') ?? previous?.idle?.metrics;
    const data: IPageData = {
      canvas: CANVAS,
      gameScale: GAME_HEIGHT_UNITS / (PLAYER_FRAME_SPEC.footLineY - PLAYER_FRAME_SPEC.headLineY),
      gameHeightUnits: GAME_HEIGHT_UNITS,
      gameSpeedUnits: GAME_SPEED_UNITS,
      unitsPerMeter,
      pitchDeg: CHOSEN_PITCH,
      circleDiameterUnits: GAME_HEIGHT_UNITS * CIRCLE_DIAMETER_PER_HEIGHT,
      views: VIEWS.map((v) => ({ id: v.id, label: v.label, flow: v.flow })),
      picks,
      phaseCount: phases.length,
      idleOrder: IDLE_PLAYBACK.order,
      idleBaked: IDLE_PLAYBACK.phases.length,
      ground: { ...(previous?.ground ?? {}), ...ground },
      gaits: gaitRows,
      idle: idleMetrics ? { id: 'idle', label: IDLE_BAKED.label, metrics: idleMetrics } : null,
    };
    writeJson(metricsFile, data);
  }

  if (!fs.existsSync(metricsFile)) throw new Error(`--page-only인데 실측이 없다: ${metricsFile}`);
  const data = JSON.parse(fs.readFileSync(metricsFile, 'utf-8')) as IPageData;
  const template = fs.readFileSync(path.join(ROOT, 'tools/blender/motion_preview.html'), 'utf-8');
  const page = path.join(outDir, 'preview.html');
  fs.writeFileSync(page, template.replace('/*__DATA__*/null', JSON.stringify(data)), 'utf-8');

  const px1440 = (meters: number): string => (meters * data.unitsPerMeter * 2).toFixed(2);
  console.log('\n후보별 수치 (1440p px는 표시 높이 77 기준)');
  for (const gait of data.gaits) {
    const m = gait.metrics;
    console.log(
      `  ${gait.label}: 발바닥 앞 각 최대 ${m.soleFrontMaxDeg.toFixed(1)}° · 발목 좌우 ${(m.ankleLateralM * 100).toFixed(2)}cm(${px1440(m.ankleLateralM)}px) · ` +
        `가장 낮은 발바닥 ${(m.soleLowestM[0] * 100).toFixed(2)}~${(m.soleLowestM[1] * 100).toFixed(2)}cm · 머리 오르내림 ${px1440(m.headBobM)}px · 한 걸음 ${gait.stepUnits.toFixed(1)}단위`,
    );
  }
  console.log(`\n화면: ${page}`);
}

main().catch((err: Error) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
