/**
 * G2 — 카메라 고도 후보를 굽고, 출하 2D 플레이어 · 귀신 표본과 **실제 표시 크기**로 나란히 놓는 비교 시트.
 *
 * 돌리는 법: `node --experimental-strip-types tools/blender/elevation.ts [--pitches 0,15,30,45] [--sheet-only]`
 *
 * 고도마다 헐 1 외곽선(G2 §8.3에서 정한 인버티드 헐)을 입힌 3D 플레이어(상의 A, 무기 든 기준 컷)에 발밑
 * 마법진 고리를 같이 굽는다. 마법진은 게임에서 별도 노드로 얹는 이펙트지만(§8.2 오라), 어느 고도에서 캐릭터와
 * 마법진이 같이 읽히는지는 여기서 정한다. 고도가 오를수록 캐릭터는 cos만큼 짧아 보이고 고리는 sin 비율의
 * 타원으로 열린다. 캔버스는 고리가 아래로 나가지 않게 세로를 721로 키우고 픽셀/미터는 그대로 둔다.
 *
 * **표시 크기는 게임의 실측이다.** 720p에서 월드 단위 하나가 1px라 플레이어 노드(48×96 단위)는 48×96px이고
 * (`sheet.ts` 머리 주석), 귀신은 노드 높이가 도깨비 70 · 처녀귀신 50 단위다. 귀신 표본은 사용자가 GPT 웹으로
 * 만든 그림이라 여백이 있어, 그린 부분(알파 상자)의 높이가 그 단위 수가 되게 줄인다. 1440p는 두 배다.
 *
 * 귀신 표본과 시트는 커밋하지 않는다(G2 §4). 판정은 사람이 한다 — 고도 선택과 화풍 게이트(§5).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_FRAME_SPEC } from '../../tests/helpers/FrameSet.ts';
import { type IRgbaImage, trimBox } from '../../tests/helpers/SpriteMetrics.ts';
import { encodePng } from '../art/PngCodec.ts';
import { composeGrid, compositeOver, type Rgb, sampleLikeEngine } from './ComparisonSheet.ts';
import {
  bakeAsync,
  DEFAULT_VRM,
  HIPS_BONE,
  HIPS_HEAD,
  type IPaths,
  read,
  runPool,
  TOON_ORIGINAL,
  writeJson,
} from './gear.ts';
import { METHODS, toonSpec } from './outline.ts';
import { writeChosenSpecs } from './weapons.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 산출물 자리. 추적되지 않는 스크래치다. */
const OUT_DIR = 'docs/temp/3d-gate/elevation';

/** 고도 후보(도). 0이 지금까지의 정면 수평이다 */
const DEFAULT_PITCHES = [0, 15, 30, 45];

/**
 * 층 캔버스. 세로를 키워 45°에서 반지름 0.35m 고리의 아래쪽(154px × sin 45° = 109px)이 발 밑 4px 여백을
 * 넘어도 잘리지 않게 한다. 기준 493과 홀짝을 맞춰야 중심이 0.5px 밀리지 않는다(ADR 009).
 */
const LAYER = { width: 600, height: 721 };

/** 720p에서 층 캔버스가 차지하는 크기. 기준 캔버스 246px이 48단위로 보이는 배율 그대로다 */
const GAME_720P = {
  width: Math.round((LAYER.width * 48) / PLAYER_FRAME_SPEC.width),
  height: Math.round((LAYER.height * 96) / PLAYER_FRAME_SPEC.height),
};

/** 시트 배경 — 게임 월드 카메라의 배경색(검정)과 같다(`sheet.ts`) */
const BACKGROUND: Rgb = [0, 0, 0];

/** 출하된 2D 정면. 캔버스가 플레이어 규격이라 720p에서 48×96이다 */
const SHIPPED_2D = 'game/assets/art/player/player_4dir_front.png';

/** 귀신 표본과 노드 높이(720p px). 파일은 커밋하지 않는다 */
const GHOSTS: readonly { label: string; file: string; units: number }[] = [
  { label: '도깨비', file: 'docs/temp/3d-gate/g2/도깨비.png', units: 70 },
  { label: '처녀귀신', file: 'docs/temp/3d-gate/g2/처녀귀신.png', units: 50 },
];

/**
 * 발밑 마법진. 바닥(z 0)에 놓인 발광 고리 둘과 네 방위의 점이다. 툰으로 바꾸지 않는 `Raw` 재질이라
 * 조명 · 외곽선과 무관하게 빛난다. 부품 좌표의 원점이 엉덩이 본 머리(z 0.4748)라 바닥은 그만큼 아래다.
 */
const MAGIC_CIRCLE = {
  id: 'magic_circle',
  bone: HIPS_BONE,
  parts: [
    ...[0.35, 0.26].map((radius) => ({
      type: 'torus',
      group: 'Raw',
      major_radius: radius,
      minor_radius: 0.014,
      major_segments: 48,
      minor_segments: 6,
      location: [0, -HIPS_HEAD.y, -HIPS_HEAD.z + 0.005],
      color: [80, 200, 255],
      emission: 1.5,
    })),
    ...[0, 90, 180, 270].map((deg) => ({
      type: 'sphere',
      group: 'Raw',
      radius: 0.03,
      subdivisions: 2,
      location: [
        0.305 * Math.cos((deg * Math.PI) / 180),
        -HIPS_HEAD.y + 0.305 * Math.sin((deg * Math.PI) / 180),
        -HIPS_HEAD.z + 0.01,
      ],
      color: [120, 220, 255],
      emission: 2.0,
    })),
  ],
};

/** 그린 부분의 높이가 `heightPx`가 되게 엔진식으로 줄인다. 여백이 있는 귀신 표본용이다 */
function scaleToDrawnHeight(img: IRgbaImage, heightPx: number): IRgbaImage {
  const box = trimBox(img);
  if (!box) throw new Error('그림이 비어 있다');
  const scale = heightPx / box.height;
  return sampleLikeEngine(img, Math.round(img.width * scale), Math.round(img.height * scale));
}

/** 칸 하나 — 배경 위에 얹는다 */
function cell(img: IRgbaImage): IRgbaImage {
  return compositeOver(img, BACKGROUND);
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  (async () => {
    const argv = process.argv.slice(2);
    const at = argv.indexOf('--pitches');
    const pitches = at >= 0 ? argv[at + 1].split(',').map(Number) : DEFAULT_PITCHES;
    const vrm = path.resolve(ROOT, DEFAULT_VRM);
    if (!fs.existsSync(vrm)) throw new Error(`.vrm이 없다: ${vrm}`);
    for (const ghost of GHOSTS)
      if (!fs.existsSync(path.join(ROOT, ghost.file)))
        throw new Error(
          `귀신 표본이 없다: ${ghost.file} — 이 장비에만 있는 파일이라 다른 장비면 다시 받는다`,
        );

    const outDir = path.join(ROOT, OUT_DIR);
    fs.mkdirSync(outDir, { recursive: true });
    const [staff, shield] = writeChosenSpecs(outDir);
    const paths: IPaths = {
      bakeEnabled: !argv.includes('--sheet-only'),
      outDir,
      vrm,
      staff,
      shield,
      toonOriginal: writeJson(path.join(outDir, 'toon_original.json'), TOON_ORIGINAL),
      toonHard: writeJson(path.join(outDir, 'toon_hard.json'), TOON_ORIGINAL),
    };
    const hull = METHODS.find((m) => m.id === 'hull');
    if (!hull) throw new Error('outline.ts의 표에 hull이 없다');
    const toon = writeJson(path.join(outDir, 'toon_hull1.json'), toonSpec(paths, hull, null));
    const gearSpec = writeJson(path.join(outDir, 'magic_circle.json'), MAGIC_CIRCLE);

    const started = Date.now();
    const files = pitches.map((pitch) => path.join(outDir, `player_p${pitch}.png`));
    await runPool(
      pitches.map(
        (pitch, i) => () =>
          bakeAsync(
            { ...paths },
            {
              out: files[i],
              layer: 'whole',
              yaw: 0,
              gearSpec,
              toon,
              weapons: true,
              pitch,
            },
          ),
      ),
    );
    console.log(`✓ 고도 ${pitches.join(' · ')}° ${((Date.now() - started) / 1000).toFixed(0)}s`);

    // 줄: 720p · 1440p. 열: 3D 고도 후보들 · 출하 2D · 도깨비 · 처녀귀신
    const shipped = read(path.join(ROOT, SHIPPED_2D));
    const ghosts = GHOSTS.map((g) => read(path.join(ROOT, g.file)));
    const rows: IRgbaImage[][] = [];
    for (const factor of [1, 2]) {
      const row: IRgbaImage[] = [];
      for (const file of files)
        row.push(
          cell(sampleLikeEngine(read(file), GAME_720P.width * factor, GAME_720P.height * factor)),
        );
      row.push(cell(sampleLikeEngine(shipped, 48 * factor, 96 * factor)));
      for (const [i, img] of ghosts.entries())
        row.push(cell(scaleToDrawnHeight(img, GHOSTS[i].units * factor)));
      rows.push(row);
    }
    const sheet = path.join(outDir, 'sheet_elevation.png');
    fs.writeFileSync(sheet, encodePng(composeGrid(rows, { gap: 16, background: [40, 40, 44] })));
    console.log(`✓ ${path.relative(ROOT, sheet)}`);
    console.log(
      `줄: 720p · 1440p / 열: 3D ${pitches.map((p) => `${p}°`).join(' · ')} · 출하 2D(96단위) · ${GHOSTS.map((g) => `${g.label}(${g.units}단위)`).join(' · ')}`,
    );
    console.log('원본 크기 후보는 player_p<고도>.png');
  })().catch((err) => {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  });
}
