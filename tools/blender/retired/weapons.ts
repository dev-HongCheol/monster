/**
 * 지팡이 · 방패 후보를 굽고 한 장으로 붙이는 실행기 — 사람이 하나씩 고를 비교물을 만든다.
 *
 * 무기 출처는 Blender 직접 제작으로 정했고(G0 §5.5), 누가 모델링하는지는 AI가 후보를 짜고
 * 사람이 고르는 쪽으로 정했다(2026-09-16). 비율이 마음에 안 들면 숫자를 고쳐 다시 굽는 것으로
 * 끝나고, 그 숫자가 레포에 남으므로 구워 낸 `.blend`는 파생물이 된다.
 *
 * **판정이 끝나 물러난 도구다(2026-09-19).** 채택한 둘의 모양은 `../BakeSpec.ts`가 들고, 이 파일에는
 * 떨어진 넷과 후보 시트를 만드는 길만 남았다. G4가 끝나면 지운다(`README.md`).
 *
 * 후보와 시트는 판정 증거라 커밋하지 않는다. 그래서 산출물을 추적되지 않는 `docs/temp/` 아래
 * 둔다.
 *
 * 돌리는 법: `node --experimental-strip-types tools/blender/retired/weapons.ts`
 * Blender 실행 파일은 환경 변수 `BLENDER`로 준다. 자세한 것은 `../README.md`에 있다.
 *
 * `--dump-chosen <폴더>`를 주면 굽지 않고 채택한 무기 둘의 사양을 `<id>.json`으로만 쓴다.
 * 층 탐침(`probe_layers.py`)을 손으로 부를 때 그 JSON을 넘긴다.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGateLine } from '../../../tests/helpers/GateLine.ts';
import { decodePng, encodePng } from '../../art/PngCodec.ts';
import {
  BOSS,
  CHOSEN_WEAPONS,
  GEM,
  type IWeaponSpec,
  METAL,
  PLATE,
  SHIELD_ROUND,
  STAFF_ORB,
  WOOD,
  writeChosenSpecs,
} from '../BakeSpec.ts';
import { composeGrid, compositeOver, type Rgb, sampleLikeEngine } from '../ComparisonSheet.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

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
 *
 * **사용자가 `staff_orb`와 `shield_round`를 골랐다(2026-09-16).** 그 둘의 모양은 `../BakeSpec.ts`가 들고
 * 여기서는 시트의 줄 순서를 지키려고 같은 자리에 끼워 넣는다. 떨어진 넷은 지우지 않고
 * 남긴다 — 지우면 다음 사람이 같은 안을 다시 짜고, 왜 그것이 아니었는지도 사라진다.
 */
export const CANDIDATES: readonly IWeaponSpec[] = [
  STAFF_ORB,
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
  SHIELD_ROUND,
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

/** 사용자가 고른 둘(2026-09-16). 게임 크기 장에는 이 둘만 넣는다. 모양은 `../BakeSpec.ts`가 든다. */
const CHOSEN = CHOSEN_WEAPONS.map((weapon) => weapon.id);

/**
 * 게임이 캐릭터를 그리는 크기.
 *
 * 후보 시트는 크게 보므로 가는 테두리와 갈래가 살아 있는 것처럼 보이는데, 게임은 이 크기로
 * 그린다. 그 크기에서 사라지는 선은 판정에서 빠져야 한다. 두 값의 근거(디자인 세로 720 실측)는
 * `sheet.ts`의 `ROWS`가 든다.
 *
 * 굽는 캔버스를 통째로 줄이는 것이라 어림값이다. 캔버스는 키 1.2m 기준 막대까지 담고 있어서
 * 화면의 무기는 캐릭터 키와 비슷한 크기로 보인다. 실제 비율은 맨살 몸이 나온 뒤 G1이 잰다.
 *
 * **지팡이 대의 굵기는 이 크기로 보고 정했다.** 처음에는 대가 1~2px로 보여도 툰 외곽선이 두껍게
 * 보이게 할 수 있어 굵기 판단을 G2로 미뤘는데, 같은 날 반지름을 0.012(720p에서 2.1px)로 고친 판을
 * 사용자가 확정했다(2026-09-16). 값과 근거는 `../BakeSpec.ts`의 `STAFF_ORB` 대 부품 주석이 든다.
 */
const GAME_SIZES = [
  { label: '1440p 96×192', width: 96, height: 192 },
  { label: '720p 48×96', width: 48, height: 96 },
] as const;

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

// **이 파일을 import해도 굽기가 돌지 않게 한다.** 진입점 가드가 없으면 후보 표(`CANDIDATES`)를 읽으려고
// import한 것만으로 Blender가 열두 번 돈다.
const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

const dumpAt = process.argv.indexOf('--dump-chosen');

if (isMain && dumpAt >= 0) {
  const dir = process.argv[dumpAt + 1];
  if (!dir) {
    console.error('✗ --dump-chosen 뒤에 쓸 폴더를 준다');
    process.exit(1);
  }
  for (const file of writeChosenSpecs(path.resolve(ROOT, dir))) {
    console.log(`✓ ${path.relative(ROOT, file)}`);
  }
} else if (isMain) {
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

    const chosenRows = GAME_SIZES.map((size) =>
      CHOSEN.map((id) => {
        const img = decodePng(fs.readFileSync(path.join(outDir, `${id}_front.png`)));
        return compositeOver(sampleLikeEngine(img, size.width, size.height), BACKGROUND);
      }),
    );
    const chosenSheet = composeGrid(chosenRows, { gap: GAP, background: BACKGROUND });
    const chosenPath = path.join(outDir, 'chosen.png');
    fs.writeFileSync(chosenPath, encodePng(chosenSheet));

    console.log(`✓ 후보 시트 ${sheet.width}×${sheet.height} — ${path.relative(ROOT, sheetPath)}`);
    console.log(`  줄 순서: ${CANDIDATES.map((c) => c.label).join(' | ')}`);
    console.log(
      `  열 순서: ${VIEWS.join(' | ')} (왼쪽 가는 막대는 키 ${REFERENCE.height}m 기준선)`,
    );
    console.log(
      `✓ 게임 크기 ${chosenSheet.width}×${chosenSheet.height} — ${path.relative(ROOT, chosenPath)}`,
    );
    console.log(
      `  줄 순서: ${GAME_SIZES.map((s) => s.label).join(' | ')} · 열 순서: ${CHOSEN.join(' | ')}`,
    );
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
}
