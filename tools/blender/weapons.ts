/**
 * 지팡이 · 방패 후보를 굽고 한 장으로 붙이는 실행기 — 사람이 하나씩 고를 비교물을 만든다.
 *
 * 무기 출처는 Blender 직접 제작으로 정했고(G0 §5.5), 누가 모델링하는지는 AI가 후보를 짜고
 * 사람이 고르는 쪽으로 정했다(2026-09-16). **모양의 정의가 이 파일의 표다.** 비율이 마음에
 * 안 들면 숫자를 고쳐 다시 굽는 것으로 끝나고, 그 표가 레포에 남으므로 구워 낸 `.blend`는
 * 파생물이 된다.
 *
 * 후보와 시트는 판정 증거라 커밋하지 않는다. 그래서 산출물을 추적되지 않는 `docs/temp/` 아래
 * 둔다.
 *
 * 돌리는 법: `node --experimental-strip-types tools/blender/weapons.ts`
 * Blender 실행 파일은 환경 변수 `BLENDER`로 준다. 자세한 것은 `README.md`에 있다.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGateLine } from '../../tests/helpers/GateLine.ts';
import { decodePng, encodePng } from '../art/PngCodec.ts';
import { composeGrid, compositeOver, type Rgb, sampleLikeEngine } from './ComparisonSheet.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * 굽는 한 장의 크기(px) — 세로로 길게 둔다.
 *
 * 무기는 키 기준 막대와 함께 세로로 긴 덩어리라, 정사각형 캔버스에 담으면 좌우가 거의 비고
 * 정작 볼 것이 작게 나온다. 첫 판이 그랬다(칸 높이의 절반). 캔버스를 세로로 두면 같은 픽셀로
 * 물체가 더 크게 보여 모양을 판정할 수 있다.
 */
const CANVAS = { width: 384, height: 640 };

/** 시트의 한 칸 크기(px). 캔버스와 같은 비율이라 줄일 때 찌그러지지 않는다. */
const CELL = { width: 192, height: 320 };

/** 시트 배경 — 게임 월드 카메라와 같은 검정이다. 배경이 밝으면 실루엣 대비가 게임과 달라진다. */
const BACKGROUND: Rgb = [0, 0, 0];

/** 칸 사이와 시트 바깥 여백(px). */
const GAP = 16;

/** 굽는 자리. `docs/temp/`는 추적되지 않는 스크래치다. */
const OUT_DIR = 'docs/temp/3d-gate/weapons';

/** Blender 한 번을 기다리는 상한(밀리초). 후보 여섯을 두 시점으로 구우면 열두 장이다. */
const BLENDER_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * 이 도구가 요구하는 Node 최소 버전.
 *
 * `--experimental-strip-types`로 `.ts`를 그대로 돌리는데 그 플래그가 22.6에 들어왔다. `gate.ts` ·
 * `sheet.ts`와 같은 기준이다.
 */
const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 6;

/** 부품 하나 — 파이썬이 그대로 세우는 프리미티브다. */
interface IPart {
  type: 'cylinder' | 'cone' | 'sphere' | 'torus' | 'cube';
  radius?: number;
  radius1?: number;
  radius2?: number;
  depth?: number;
  vertices?: number;
  subdivisions?: number;
  major_radius?: number;
  minor_radius?: number;
  major_segments?: number;
  minor_segments?: number;
  size?: number;
  location?: readonly [number, number, number];
  /** X · Y · Z 회전(도) */
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number];
  /** 0~255 sRGB */
  color?: readonly [number, number, number];
}

/** 후보 하나. */
interface ICandidate {
  id: string;
  /** 사람이 읽는 이름 — 시트를 보며 고를 때 부르는 말이다 */
  label: string;
  parts: IPart[];
}

/** 나무 손잡이. */
const WOOD: readonly [number, number, number] = [110, 80, 55];
/** 쇠붙이 — 테두리와 갈래. */
const METAL: readonly [number, number, number] = [170, 175, 185];
/** 마법 보석. */
const GEM: readonly [number, number, number] = [90, 180, 220];
/** 방패 판. */
const PLATE: readonly [number, number, number] = [140, 120, 95];
/** 방패 가운데 장식. */
const BOSS: readonly [number, number, number] = [200, 180, 120];

/**
 * 키 기준 막대.
 *
 * 무기만 나란히 두면 화면에서 크기를 견줄 기준이 없어서, 「긴 지팡이」가 실제로 캐릭터보다
 * 큰지 알 수 없다. 1.2m는 4등신 캐릭터의 대략적인 키이고, 실제 비율 판정은 맨살 몸 렌더가
 * 나온 뒤 G1이 수치로 한다.
 */
const REFERENCE = { height: 1.2, offset_x: -0.45, color: [70, 70, 80] as const };

/**
 * 후보 여섯 — 지팡이 셋과 방패 셋.
 *
 * 셋씩 두는 이유는 하나를 보여 주면 「이것과 비슷한 다른 것」을 상상해서 고르게 되기 때문이다.
 * 좌표는 미터이고 원점이 바닥이라, 손잡이 길이를 바꾸면 `location`의 z도 절반만큼 함께 옮긴다.
 */
const CANDIDATES: readonly ICandidate[] = [
  {
    id: 'staff_orb',
    label: '지팡이 A — 구슬',
    parts: [
      {
        type: 'cylinder',
        radius: 0.018,
        depth: 1.25,
        vertices: 8,
        location: [0, 0, 0.625],
        color: WOOD,
      },
      {
        type: 'torus',
        major_radius: 0.035,
        minor_radius: 0.012,
        major_segments: 10,
        minor_segments: 6,
        location: [0, 0, 1.2],
        rotation: [0, 0, 0],
        color: METAL,
      },
      { type: 'sphere', radius: 0.062, subdivisions: 2, location: [0, 0, 1.3], color: GEM },
    ],
  },
  {
    id: 'staff_crystal',
    label: '지팡이 B — 결정',
    parts: [
      {
        type: 'cylinder',
        radius: 0.016,
        depth: 1.18,
        vertices: 8,
        location: [0, 0, 0.59],
        color: WOOD,
      },
      {
        type: 'cone',
        radius1: 0.07,
        radius2: 0,
        depth: 0.2,
        vertices: 6,
        location: [0, 0, 1.3],
        color: GEM,
      },
      {
        type: 'cone',
        radius1: 0,
        radius2: 0.07,
        depth: 0.12,
        vertices: 6,
        location: [0, 0, 1.14],
        color: GEM,
      },
    ],
  },
  {
    id: 'staff_fork',
    label: '지팡이 C — 갈래',
    parts: [
      {
        type: 'cylinder',
        radius: 0.018,
        depth: 1.14,
        vertices: 8,
        location: [0, 0, 0.57],
        color: WOOD,
      },
      { type: 'sphere', radius: 0.035, subdivisions: 1, location: [0, 0, 1.16], color: GEM },
      {
        type: 'cylinder',
        radius: 0.011,
        depth: 0.3,
        vertices: 6,
        location: [0.06, 0, 1.3],
        rotation: [0, 20, 0],
        color: METAL,
      },
      {
        type: 'cylinder',
        radius: 0.011,
        depth: 0.3,
        vertices: 6,
        location: [-0.06, 0, 1.3],
        rotation: [0, -20, 0],
        color: METAL,
      },
    ],
  },
  {
    id: 'shield_round',
    label: '방패 A — 원형',
    parts: [
      {
        type: 'cylinder',
        radius: 0.26,
        depth: 0.045,
        vertices: 16,
        location: [0, 0, 0.75],
        rotation: [90, 0, 0],
        color: PLATE,
      },
      {
        type: 'torus',
        major_radius: 0.26,
        minor_radius: 0.022,
        major_segments: 16,
        minor_segments: 6,
        location: [0, 0, 0.75],
        rotation: [90, 0, 0],
        color: METAL,
      },
      { type: 'sphere', radius: 0.07, subdivisions: 2, location: [0, -0.03, 0.75], color: BOSS },
    ],
  },
  {
    id: 'shield_heater',
    label: '방패 B — 방패꼴',
    parts: [
      { type: 'cube', size: 1, scale: [0.44, 0.05, 0.34], location: [0, 0, 0.9], color: PLATE },
      {
        type: 'cone',
        radius1: 0.31,
        radius2: 0,
        depth: 0.42,
        vertices: 4,
        location: [0, 0, 0.52],
        rotation: [90, 0, 45],
        color: PLATE,
      },
      { type: 'sphere', radius: 0.06, subdivisions: 2, location: [0, -0.04, 0.82], color: BOSS },
    ],
  },
  {
    id: 'shield_hex',
    label: '방패 C — 육각',
    parts: [
      {
        type: 'cylinder',
        radius: 0.29,
        depth: 0.05,
        vertices: 6,
        location: [0, 0, 0.78],
        rotation: [90, 0, 0],
        color: PLATE,
      },
      {
        type: 'torus',
        major_radius: 0.29,
        minor_radius: 0.02,
        major_segments: 6,
        minor_segments: 6,
        location: [0, 0, 0.78],
        rotation: [90, 0, 0],
        color: METAL,
      },
      {
        type: 'cylinder',
        radius: 0.05,
        depth: 0.07,
        vertices: 6,
        location: [0, -0.04, 0.78],
        rotation: [90, 0, 0],
        color: BOSS,
      },
    ],
  },
];

/** 굽는 시점. 정면은 실루엣, 3/4는 두께를 본다. */
const VIEWS = ['front', 'three_quarter'] as const;

/** Node 버전이 최소 기준보다 낮으면 지금 버전을 말하며 던진다. */
function assertNodeVersion(): void {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR)) return;
  throw new Error(
    `Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} 이상이 필요하다 (지금 ${process.versions.node}) — ` +
      '`--experimental-strip-types`가 그 버전부터 있다.',
  );
}

/**
 * Blender 실행 파일의 경로.
 *
 * 환경 변수를 먼저 보는 이유는 윈도우 설치 경로에 버전 번호가 들어가기 때문이다. `gate.ts`와
 * 같은 규칙이다.
 */
function resolveBlender(): string {
  const fromEnv = process.env.BLENDER;
  if (!fromEnv) return 'blender';
  if (!fs.existsSync(fromEnv)) {
    throw new Error(`환경 변수 BLENDER가 가리키는 파일이 없다: ${fromEnv}`);
  }
  return fromEnv;
}

/** 후보 표를 파이썬이 읽을 JSON으로 쓰고 그 절대 경로를 돌려준다. */
function writeSpec(outDir: string): string {
  const specPath = path.join(outDir, 'spec.json');
  const spec = {
    reference: REFERENCE,
    margin: 0.08,
    candidates: CANDIDATES.map((c) => ({ id: c.id, views: VIEWS, parts: c.parts })),
  };
  fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf-8');
  return specPath;
}

/** 후보를 굽고 판정 줄을 읽는다. 실패하면 코드와 메시지를 담아 던진다. */
function bake(outDir: string, specPath: string): void {
  const result = spawnSync(
    resolveBlender(),
    [
      '--background',
      '--python-exit-code',
      '1',
      '--python',
      path.join(ROOT, 'tools/blender/weapons.py'),
      '--',
      '--spec',
      specPath,
      '--out-dir',
      outDir,
      '--canvas-width',
      String(CANVAS.width),
      '--canvas-height',
      String(CANVAS.height),
    ],
    { encoding: 'utf-8', timeout: BLENDER_TIMEOUT_MS },
  );

  const line = parseGateLine(result.stdout ?? '');
  if (line.ok) return;

  // 판정 줄이 없으면 stderr 꼬리가 유일한 단서다. Blender가 시그널로 죽으면 종료 코드도
  // 판정 줄도 아무 말을 하지 않는다.
  const tail = (result.stderr ?? '').split('\n').slice(-12).join('\n');
  throw new Error(`${line.code} ${line.message}\n${tail}`);
}

/** 구운 한 장을 시트 칸으로 줄이고 배경 위에 얹는다. */
function toCell(file: string): ReturnType<typeof compositeOver> {
  const img = decodePng(fs.readFileSync(file));
  return compositeOver(sampleLikeEngine(img, CELL.width, CELL.height), BACKGROUND);
}

try {
  assertNodeVersion();

  const outDir = path.join(ROOT, OUT_DIR);
  fs.mkdirSync(outDir, { recursive: true });
  const specPath = writeSpec(outDir);
  bake(outDir, specPath);

  const rows = CANDIDATES.map((candidate) =>
    VIEWS.map((view) => toCell(path.join(outDir, `${candidate.id}_${view}.png`))),
  );
  const sheet = composeGrid(rows, { gap: GAP, background: BACKGROUND });
  const sheetPath = path.join(outDir, 'sheet.png');
  fs.writeFileSync(sheetPath, encodePng(sheet));

  console.log(`✓ 후보 시트 ${sheet.width}×${sheet.height} — ${path.relative(ROOT, sheetPath)}`);
  console.log(`  줄 순서: ${CANDIDATES.map((c) => c.label).join(' | ')}`);
  console.log(`  열 순서: ${VIEWS.join(' | ')} (왼쪽 가는 막대는 키 ${REFERENCE.height}m 기준선)`);
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}
