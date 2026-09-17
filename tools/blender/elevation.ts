/**
 * G2 — 카메라 고도 후보를 굽고, 발밑 마법진을 게임처럼 얹은 뒤, 출하 2D 플레이어 · 귀신 표본과 **실제 표시
 * 크기**로 나란히 놓는 비교 시트.
 *
 * 돌리는 법: `node --experimental-strip-types tools/blender/elevation.ts [--pitches 0,15,30,45] [--sheet-only]`
 *
 * **마법진은 3D 장면이 아니라 이 파일이 얹는다 — 게임이 할 방식 그대로다.** 원형 그림(위에서 본 1:1)을 한 장
 * 만들고, 카메라 고도 `p`의 sin 비율로 세로를 눌러 타원으로 만든 뒤 캐릭터 발밑 점에 중심을 두고 캐릭터
 * **뒤에** 깐다. 게임에서는 정원 텍스처 노드를 자식으로 두고 부모의 세로 배율을 sin(p)로 눌러 자식을 돌린다
 * (G2 §8.2). 첫 판은 3D 장면에 고리를 넣었는데 캔버스 밖으로 잘렸고, 지름도 키의 0.6배라 사용자가 준 참고
 * 그림(지름이 키의 두 배쯤, 고도 34°)과 달랐다(2026-09-17).
 *
 * 고도마다 헐 1 외곽선(G2 §8.3)을 입힌 3D 플레이어(상의 A, 무기 든 기준 컷)를 굽는다. 고도가 오를수록 캐릭터는
 * cos만큼 짧아 보이고 마법진 타원은 sin만큼 열린다. 발밑 점은 Blender가 세계 원점을 카메라로 투영해 판정 줄에
 * 실어 준다(`ground_px`) — 고도가 있으면 발 행 규격과 달라져 계산으로는 못 잡는다.
 *
 * **표시 크기는 게임의 실측이다.** 720p에서 월드 단위 하나가 1px라 플레이어 노드(48×96 단위)는 48×96px이고
 * (`sheet.ts` 머리 주석), 3D 칸은 구운 파일의 실제 크기에 같은 배율(가로 48/246, 세로 96/493)을 곱해 줄인다.
 * 귀신은 노드 높이가 도깨비 70 · 처녀귀신 50 단위이고, 표본은 여백이 있어 그린 부분(알파 상자)의 높이가 그 단위
 * 수가 되게 줄인다. 1440p는 두 배다.
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

/** 고도 후보(도). 0이 지금까지의 정면 수평이고, 참고 그림은 34°였다 */
const DEFAULT_PITCHES = [0, 15, 30, 45];

/**
 * 3D를 굽는 층 캔버스. 무기가 몸 옆으로 나가므로 가로를 키운다. 세로는 기준 493 그대로다 — 마법진은 굽지
 * 않고 뒤에 얹으므로 발 밑 여백이 필요 없다. 기준과 홀짝을 맞춘다(ADR 009).
 */
const CANVAS = { width: 600, height: PLAYER_FRAME_SPEC.height };

/** 720p에서 기준 캔버스 246×493이 48×96으로 보이는 배율 */
const SCALE_720P = { x: 48 / PLAYER_FRAME_SPEC.width, y: 96 / PLAYER_FRAME_SPEC.height };

/** 시트 배경 — 게임 월드 카메라의 배경색(검정)과 같다(`sheet.ts`) */
const BACKGROUND: Rgb = [0, 0, 0];

/** 출하된 2D 정면. 캔버스가 플레이어 규격이라 720p에서 48×96이다 */
const SHIPPED_2D = 'game/assets/art/player/player_4dir_front.png';

/** 귀신 표본과 노드 높이(720p px). 파일은 커밋하지 않는다 */
const GHOSTS: readonly { label: string; file: string; units: number }[] = [
  { label: '도깨비', file: 'docs/temp/3d-gate/g2/도깨비.png', units: 70 },
  { label: '처녀귀신', file: 'docs/temp/3d-gate/g2/처녀귀신.png', units: 50 },
];

/** 마법진 지름을 캐릭터 키(px)의 몇 배로 하나. 참고 그림에서 잰 값이다 */
const CIRCLE_DIAMETER_PER_HEIGHT = 2.0;

/** 마법진 색(sRGB). 발광하는 파란빛이라 배경 검정 위에서 잘 보인다 */
const CIRCLE_COLOR: Rgb = [90, 210, 255];

/**
 * 위에서 본 마법진 그림(정원, 투명 배경). 바깥 고리 · 안 고리 · 그 사이 방사선 열여섯 · 룬 자리 여덟 · 은은한
 * 안쪽 빛으로 이루어진다. 실제 그림은 아티스트가 그리고, 여기서는 타원으로 눌렀을 때 어떻게 읽히는지만 본다.
 */
function magicCircleTexture(diameter: number): IRgbaImage {
  const size = diameter;
  const data = new Uint8Array(size * size * 4);
  const r = diameter / 2;
  const ringOuter = { from: 0.9, to: 1.0 };
  const ringInner = { from: 0.62, to: 0.68 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - r) / r;
      const dy = (y + 0.5 - r) / r;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      const angle = Math.atan2(dy, dx);
      let alpha = 0;
      if (d >= ringOuter.from && d <= ringOuter.to) alpha = 0.95;
      else if (d >= ringInner.from && d <= ringInner.to) alpha = 0.9;
      else if (d > ringInner.to && d < ringOuter.from) {
        // 방사선 열여섯 — 각도 폭이 좁은 선
        const spoke = Math.abs((((angle / (2 * Math.PI)) * 16 + 0.5) % 1) - 0.5);
        if (spoke < 0.03) alpha = 0.7;
        // 룬 자리 여덟 — 고리 사이 가운데의 짧은 사각
        const rune = Math.abs((((angle / (2 * Math.PI)) * 8 + 0.25) % 1) - 0.5);
        if (rune < 0.05 && d > 0.75 && d < 0.83) alpha = Math.max(alpha, 0.85);
      } else if (d < ringInner.from) {
        // 안쪽 빛 — 중심으로 갈수록 옅어지는 안개
        alpha = 0.18 * (1 - d / ringInner.from) + 0.05;
      }
      if (alpha <= 0) continue;
      const at = (y * size + x) * 4;
      data[at] = CIRCLE_COLOR[0];
      data[at + 1] = CIRCLE_COLOR[1];
      data[at + 2] = CIRCLE_COLOR[2];
      data[at + 3] = Math.round(alpha * 255);
    }
  }
  return { width: size, height: size, data };
}

/** 세로를 `ratio`로 눌러 타원으로 만든다(선형 보간). 카메라 고도 p의 sin이 그 비율이다 */
function squash(img: IRgbaImage, ratio: number): IRgbaImage {
  const height = Math.max(1, Math.round(img.height * ratio));
  return sampleLikeEngine(img, img.width, height);
}

/**
 * 캐릭터 렌더 뒤에 마법진을 깐 한 장. 마법진 중심을 `ground`(렌더 픽셀 좌표)에 두고, 마법진이 렌더 밖으로
 * 나가면 캔버스를 그만큼 키운다. 캐릭터가 마법진을 가리고 마법진의 앞부분은 발 아래 보인다 — 게임의 노드
 * 순서와 같다.
 */
function withCircle(
  render: IRgbaImage,
  circle: IRgbaImage,
  ground: [number, number],
): { img: IRgbaImage; renderOffset: [number, number] } {
  const cx = Math.round(ground[0]);
  const cy = Math.round(ground[1]);
  const left = Math.min(0, cx - Math.floor(circle.width / 2));
  const top = Math.min(0, cy - Math.floor(circle.height / 2));
  const right = Math.max(render.width, cx + Math.ceil(circle.width / 2));
  const bottom = Math.max(render.height, cy + Math.ceil(circle.height / 2));
  const width = right - left;
  const height = bottom - top;
  const data = new Uint8Array(width * height * 4);
  const blit = (src: IRgbaImage, ox: number, oy: number) => {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const s = (y * src.width + x) * 4;
        const sa = src.data[s + 3] / 255;
        if (sa <= 0) continue;
        const tx = x + ox;
        const ty = y + oy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        const t = (ty * width + tx) * 4;
        const da = data[t + 3] / 255;
        const outA = sa + da * (1 - sa);
        for (let ch = 0; ch < 3; ch++)
          data[t + ch] = Math.round((src.data[s + ch] * sa + data[t + ch] * da * (1 - sa)) / outA);
        data[t + 3] = Math.round(outA * 255);
      }
    }
  };
  blit(circle, cx - Math.floor(circle.width / 2) - left, cy - Math.floor(circle.height / 2) - top);
  blit(render, -left, -top);
  return { img: { width, height, data }, renderOffset: [-left, -top] };
}

/** 구운 파일의 실제 크기에 기준 배율을 곱해 게임 크기로 줄인다. `factor` 1이 720p, 2가 1440p */
function toGame(img: IRgbaImage, factor: number): IRgbaImage {
  return sampleLikeEngine(
    img,
    Math.max(1, Math.round(img.width * SCALE_720P.x * factor)),
    Math.max(1, Math.round(img.height * SCALE_720P.y * factor)),
  );
}

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

    const started = Date.now();
    const files = pitches.map((pitch) => path.join(outDir, `player_p${pitch}.png`));
    const groundFile = path.join(outDir, 'ground.json');
    const grounds: Record<string, [number, number]> = fs.existsSync(groundFile)
      ? JSON.parse(fs.readFileSync(groundFile, 'utf-8'))
      : {};
    const payloads = await runPool(
      pitches.map(
        (pitch, i) => () =>
          bakeAsync(paths, {
            out: files[i],
            layer: 'whole',
            yaw: 0,
            toon,
            weapons: true,
            pitch,
            canvas: CANVAS,
          }),
      ),
    );
    payloads.forEach((payload, i) => {
      const ground = payload.ground_px as [number, number] | undefined;
      if (ground) grounds[String(pitches[i])] = ground;
      if (!grounds[String(pitches[i])])
        throw new Error(
          `고도 ${pitches[i]}°의 발밑 점(ground_px)이 없다 — --sheet-only면 먼저 구워야 한다`,
        );
    });
    writeJson(groundFile, grounds);
    console.log(`✓ 고도 ${pitches.join(' · ')}° ${((Date.now() - started) / 1000).toFixed(0)}s`);

    // 마법진 — 캐릭터 키(px, 정면 기준 발 행 − 머리 행)의 두 배 지름
    const heightPx = PLAYER_FRAME_SPEC.footLineY - PLAYER_FRAME_SPEC.headLineY;
    const texture = magicCircleTexture(Math.round(heightPx * CIRCLE_DIAMETER_PER_HEIGHT));
    fs.writeFileSync(path.join(outDir, 'magic_circle_texture.png'), encodePng(texture));

    const composed = pitches.map((pitch, i) => {
      const ratio = Math.sin((pitch * Math.PI) / 180);
      const circle = squash(texture, Math.max(ratio, 0.02));
      const { img } = withCircle(read(files[i]), circle, grounds[String(pitch)]);
      const file = path.join(outDir, `player_p${pitch}_circle.png`);
      fs.writeFileSync(file, encodePng(img));
      return img;
    });

    // 줄: 720p · 1440p. 열: 3D 고도 후보들(마법진 포함) · 출하 2D · 도깨비 · 처녀귀신 · 마법진 원본(위에서 본 1:1)
    const shipped = read(path.join(ROOT, SHIPPED_2D));
    const ghosts = GHOSTS.map((g) => read(path.join(ROOT, g.file)));
    const rows: IRgbaImage[][] = [];
    for (const factor of [1, 2]) {
      const row: IRgbaImage[] = [];
      for (const img of composed) row.push(cell(toGame(img, factor)));
      row.push(cell(sampleLikeEngine(shipped, 48 * factor, 96 * factor)));
      for (const [i, img] of ghosts.entries())
        row.push(cell(scaleToDrawnHeight(img, GHOSTS[i].units * factor)));
      row.push(cell(toGame(texture, factor)));
      rows.push(row);
    }
    const sheet = path.join(outDir, 'sheet_elevation.png');
    fs.writeFileSync(sheet, encodePng(composeGrid(rows, { gap: 16, background: [40, 40, 44] })));
    console.log(`✓ ${path.relative(ROOT, sheet)}`);
    console.log(
      `줄: 720p · 1440p / 열: 3D ${pitches.map((p) => `${p}°`).join(' · ')}(마법진 포함) · 출하 2D(96단위) · ${GHOSTS.map((g) => `${g.label}(${g.units}단위)`).join(' · ')} · 마법진 원본(위에서 본 1:1)`,
    );
    console.log(
      `마법진 지름은 캐릭터 키의 ${CIRCLE_DIAMETER_PER_HEIGHT}배(${texture.width}px, 720p에서 ${Math.round(texture.width * SCALE_720P.x)}px). 원본 크기 후보는 player_p<고도>_circle.png`,
    );
  })().catch((err) => {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  });
}
