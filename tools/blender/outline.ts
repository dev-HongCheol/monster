/**
 * G2 — 외곽선 방식 후보 셋(인버티드 헐 · Line Art · 후처리)을 같은 시험 세트로 굽고 시트로 만든다.
 *
 * 돌리는 법: `node --experimental-strip-types tools/blender/outline.ts [--only hull,lineart,post] [--cases cape,wings] [--sheet-only]`
 *
 * 시험 세트는 장비 검토 세트에서 통과한 경우(`gear.ts`의 CASES, 정적 사양)와 무기를 든 기준 컷이고, 방향은
 * 앞 · 뒤 · 3/4다. 겨냥 굵기는 493px 캔버스에서 2.75px(귀신 표본 실측 0.55~0.57%, G2 인계 §3.3)이고, 방식마다
 * 그 굵기를 만드는 값이 다르다 — 헐은 폭 0.0062m, Line Art는 반지름 0.0031m, 후처리는 픽셀 그대로 2.75다
 * (`ops-blender-toon.md` §5 · §5.1).
 *
 * **방식마다 층과 기준 컷을 따로 굽는다.** 외곽선은 가림과 함께 고른다(G2 §3) — 층을 가림 전용 몸으로 구우면
 * 방식에 따라 가림 뒤에 외곽선이 남거나 사라진다. 그래서 몸 · 지팡이 · 방패 · 장비 층을 방식별로 굽고, 겹친 것과
 * 무기 든 기준 컷의 픽셀 차이를 적는다. 헐은 몸 헐을 가림 전용에 넣을지가 열려 있어(정본 §5) 정면 지팡이 층을
 * 몸 헐 켬 · 끔으로 구워 지워진 픽셀 수를 센다.
 *
 * **후처리는 이 파일이 긋는다.** Blender가 법선 · 깊이 패스를 내주면(`outline.py`), 실루엣(알파 경계) · 물체 경계
 * (깊이 불연속) · 주름(법선 각)을 가장자리로 잡고 그 둘레 2.75px 띠를 색으로 덮는다. 픽셀 굵기가 정확하고 게임
 * 크기에서 가장 예측 가능한 방식이라 후보에 넣었다.
 *
 * 판정은 사람이 한다. 여기서는 굽고 긋고 세고 시트를 만드는 것까지다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_FRAME_SPEC } from '../../tests/helpers/FrameSet.ts';
import type { IRgbaImage } from '../../tests/helpers/SpriteMetrics.ts';
import { encodePng } from '../art/PngCodec.ts';
import { composeGrid, layerOver, pixelDiff, type Rgb } from './ComparisonSheet.ts';
import {
  bake,
  CASES,
  cells,
  DEFAULT_VIEWS,
  DEFAULT_VRM,
  OUT_DIR as GEAR_DIR,
  gearSettings,
  type IBake,
  type IGearCase,
  type IPaths,
  read,
  TOON_ORIGINAL,
  VIEWS,
  writeJson,
} from './gear.ts';
import { writeChosenSpecs } from './weapons.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 산출물 자리. 추적되지 않는 스크래치다. 방식마다 하위 폴더를 갖는다. */
const OUT_DIR = 'docs/temp/3d-gate/outline';

/** 겨냥 굵기(px, 493px 캔버스). 귀신 표본 둘의 윤곽선이 긴 변의 0.55~0.57%였다. */
const WIDTH_PX = 2.75;

/** 기준 자세 키(m, 2026-09-16 실측). 캔버스 픽셀과 미터를 잇는 유일한 값이다 */
const MODEL_HEIGHT_M = 1.104;

/** 캔버스의 픽셀/미터. 머리 행에서 발 행까지가 키다 */
const PX_PER_M = (PLAYER_FRAME_SPEC.footLineY - PLAYER_FRAME_SPEC.headLineY) / MODEL_HEIGHT_M;

/** 외곽선 색(선형 RGB). VRoid가 내보내는 기본 외곽선 색이다 — 귀신 표본도 검정에 가까운 어두운 선이다 */
const OUTLINE_COLOR_LINEAR: readonly [number, number, number] = [0.061, 0.009, 0.014];

/** 알파가 이 값을 넘으면 보이는 픽셀이다. `gear.ts`와 같다 */
const ALPHA_ON = 8;

/** 후처리 가장자리 판정 — 실루엣은 알파가 이 값을 가르는 곳 */
const ALPHA_EDGE = 128;

/** 후처리 — 이웃과 깊이가 이만큼(0~1, 0.9m 범위) 다르면 물체 경계. 0.012 ≈ 1.1cm라 끈(몸에서 6~11mm)이 갈린다 */
const DEPTH_JUMP = 0.012;

/** 후처리 — 이웃 법선과의 각이 이보다 크면 주름 선. 큰 값이라 접힌 곳만 긋는다 */
const CREASE_DEGREES = 75;

/** 채널 차가 이 값을 넘어야 바뀐 픽셀로 센다. `gear.ts` · `layers.ts`와 같은 값이다. */
const DIFF_THRESHOLD = 12;

type Method = 'hull' | 'lineart' | 'post';
const METHODS: readonly Method[] = ['hull', 'lineart', 'post'];
const METHOD_LABEL: Record<Method, string> = {
  hull: '인버티드 헐',
  lineart: 'Line Art',
  post: '후처리',
};

/** 선형 0~1을 sRGB 8비트로. 후처리 색과 시트 라벨에 쓴다. */
function srgb8(linear: number): number {
  const v = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

const OUTLINE_COLOR_SRGB: Rgb = [
  srgb8(OUTLINE_COLOR_LINEAR[0]),
  srgb8(OUTLINE_COLOR_LINEAR[1]),
  srgb8(OUTLINE_COLOR_LINEAR[2]),
];

/** 방식마다 몸(VRoid 재질) · 무기 · 장비가 받는 툰 값. */
function toonSpec(paths: IPaths, method: Method, item: IGearCase | null, bodyHull = true) {
  const gear = item ? gearSettings(paths, item) : { ...TOON_ORIGINAL.materials.GEAR };
  const materials: Record<string, Record<string, unknown>> = { GEAR: gear };
  if (method === 'hull') {
    const hull = {
      outline_mode: 'worldCoordinates',
      outline_width: WIDTH_PX / PX_PER_M,
      outline_color: [...OUTLINE_COLOR_LINEAR],
      outline_lighting_mix: 0,
    };
    // 몸 헐을 끄는 판은 가림 탐침용이다. VRoid 기본값(0.8mm)도 남기지 않도록 `none`을 준다
    materials['*'] = bodyHull ? hull : { outline_mode: 'none' };
    // 눈 · 얼굴 그림(눈썹 · 눈매 · 입)은 얼굴 위 판이라 헐을 두르면 검은 테가 생긴다
    materials.EYE = { outline_mode: 'none' };
    materials.FACE = { outline_mode: 'none' };
    // 무기는 헐이 MToon에서만 나오므로 상의 규칙으로 바꾼다. 재질 확정(열린 항목)과는 별개다
    materials.WEAPON = { like: 'Tops_CLOTH', shade_ratio: 0.6, ...hull };
    materials.GEAR = { ...gear, ...hull };
  }
  return {
    id: `outline_${method}_${item ? item.id : 'body'}${bodyHull ? '' : '_nohull'}`,
    materials,
  };
}

/** Line Art 사양. 굵기는 겨냥 픽셀의 절반을 미터로 */
const LINEART_SPEC = {
  radius: WIDTH_PX / 2 / PX_PER_M,
  color: [...OUTLINE_COLOR_LINEAR],
  crease_degrees: 140,
  contour: true,
  crease: true,
  material: true,
  intersection: true,
  silhouette: 'NONE',
};

/** 방식별 산출물 자리와 굽기 인자. */
interface IMethodPaths {
  dir: string;
  lineart?: string;
}

function methodPaths(outDir: string, method: Method): IMethodPaths {
  const dir = path.join(outDir, method);
  fs.mkdirSync(path.join(dir, 'passes'), { recursive: true });
  return {
    dir,
    lineart:
      method === 'lineart' ? writeJson(path.join(dir, 'lineart.json'), LINEART_SPEC) : undefined,
  };
}

/** 굽기 한 번 — 방식에 맞는 인자를 붙이고, 후처리면 패스 폴더를 준다. */
function bakeFor(
  paths: IPaths,
  method: Method,
  mp: IMethodPaths,
  name: string,
  job: Omit<IBake, 'out' | 'lineart' | 'passes'>,
): string {
  const out = path.join(mp.dir, `${name}.png`);
  const passes = method === 'post' ? path.join(mp.dir, 'passes', name) : undefined;
  bake(paths, { ...job, out, lineart: mp.lineart, passes });
  if (method !== 'post' || !passes) return out;
  const outlined = path.join(mp.dir, `${name}_outlined.png`);
  if (paths.bakeEnabled || !fs.existsSync(outlined)) {
    const drawn = drawOutline(
      read(out),
      read(path.join(passes, 'normal.png')),
      read(path.join(passes, 'depth.png')),
    );
    fs.writeFileSync(outlined, encodePng(drawn));
  }
  return outlined;
}

/**
 * 후처리 외곽선. 가장자리 픽셀을 셋으로 잡고 그 둘레 `WIDTH_PX` 띠를 색으로 덮는다.
 *
 * - 실루엣: 보이는 픽셀(알파 ≥ 128)의 4방향 이웃이 안 보이면 그 픽셀
 * - 물체 경계: 이웃과 깊이가 `DEPTH_JUMP` 넘게 다르면 **가까운 쪽** 픽셀 — 선이 앞 물체에 붙는다
 * - 주름: 이웃 법선과의 각이 `CREASE_DEGREES`보다 크면 그 픽셀
 *
 * 띠는 가장자리 픽셀 중심에서의 거리로 덮음 정도를 정해(`WIDTH_PX / 2 + 0.5 − 거리`) 경계가 안티에일리어싱된다.
 * 실루엣 밖으로도 절반이 나가므로 알파가 그만큼 자란다 — Line Art 획도 경계에 걸쳐 그려지니 같은 조건이다.
 */
export function drawOutline(img: IRgbaImage, normal: IRgbaImage, depth: IRgbaImage): IRgbaImage {
  const { width, height, data } = img;
  if (
    normal.width !== width ||
    depth.width !== width ||
    normal.height !== height ||
    depth.height !== height
  )
    throw new Error(
      `패스 크기가 렌더와 다르다: ${width}×${height} vs ${normal.width}×${normal.height} / ${depth.width}×${depth.height}`,
    );
  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  const depthAt = (x: number, y: number) => depth.data[(y * width + x) * 4] / 255;
  const normalAt = (x: number, y: number): [number, number, number] => {
    const at = (y * width + x) * 4;
    return [
      (normal.data[at] / 255) * 2 - 1,
      (normal.data[at + 1] / 255) * 2 - 1,
      (normal.data[at + 2] / 255) * 2 - 1,
    ];
  };
  const creaseCos = Math.cos((CREASE_DEGREES * Math.PI) / 180);
  const edge = new Uint8Array(width * height);
  const steps: readonly [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alphaAt(x, y) < ALPHA_EDGE) continue;
      const d = depthAt(x, y);
      const n = normalAt(x, y);
      for (const [dx, dy] of steps) {
        const qx = x + dx;
        const qy = y + dy;
        if (qx < 0 || qy < 0 || qx >= width || qy >= height) continue;
        if (alphaAt(qx, qy) < ALPHA_EDGE) {
          edge[y * width + x] = 1;
          break;
        }
        const dq = depthAt(qx, qy);
        if (dq - d > DEPTH_JUMP) {
          edge[y * width + x] = 1;
          break;
        }
        const m = normalAt(qx, qy);
        const dot = n[0] * m[0] + n[1] * m[1] + n[2] * m[2];
        if (dot < creaseCos) {
          edge[y * width + x] = 1;
          break;
        }
      }
    }
  }

  const radius = Math.ceil(WIDTH_PX / 2 + 0.5);
  const cover = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!edge[y * width + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const c = Math.min(1, Math.max(0, WIDTH_PX / 2 + 0.5 - Math.hypot(dx, dy)));
          const at = py * width + px;
          if (c > cover[at]) cover[at] = c;
        }
      }
    }
  }

  const out = new Uint8Array(data);
  for (let i = 0; i < width * height; i++) {
    const c = cover[i];
    if (c <= 0) continue;
    const at = i * 4;
    const a = data[at + 3] / 255;
    const outA = c + a * (1 - c);
    for (let ch = 0; ch < 3; ch++) {
      const under = data[at + ch] * a * (1 - c);
      out[at + ch] = Math.round((OUTLINE_COLOR_SRGB[ch] * c + under) / outA);
    }
    out[at + 3] = Math.round(outA * 255);
  }
  return { width, height, data: out };
}

/** 보이는 픽셀 수. 몸 헐 가림 탐침이 쓴다 */
function visiblePixels(img: IRgbaImage): number {
  let count = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > ALPHA_ON) count++;
  return count;
}

/** 한 방식의 층 · 기준 컷을 전부 굽고 시트 · 수치를 만든다. */
function runMethod(
  paths: IPaths,
  outDir: string,
  method: Method,
  items: readonly IGearCase[],
): Record<string, unknown>[] {
  const mp = methodPaths(outDir, method);
  const numbers: Record<string, unknown>[] = [];
  const rows: IRgbaImage[][] = [];
  const bodyToon = writeJson(path.join(mp.dir, 'toon_body.json'), toonSpec(paths, method, null));

  for (const view of VIEWS.filter((v) => DEFAULT_VIEWS.includes(v.id))) {
    const body = bakeFor(paths, method, mp, `body_${view.id}`, {
      layer: 'body',
      yaw: view.yaw,
      toon: bodyToon,
    });
    const staff = bakeFor(paths, method, mp, `staff_${view.id}`, {
      layer: 'staff',
      yaw: view.yaw,
      toon: bodyToon,
      weaponSpec: paths.staff,
    });
    const shield = bakeFor(paths, method, mp, `shield_${view.id}`, {
      layer: 'shield',
      yaw: view.yaw,
      toon: bodyToon,
      weaponSpec: paths.shield,
    });

    for (const item of items) {
      const gearSpec = writeJson(path.join(mp.dir, `${item.id}.json`), item.spec);
      const toon = writeJson(
        path.join(mp.dir, `toon_${item.id}.json`),
        toonSpec(paths, method, item),
      );
      const whole = bakeFor(paths, method, mp, `${item.id}_${view.id}_whole`, {
        layer: 'whole',
        yaw: view.yaw,
        gearSpec,
        toon,
        weapons: true,
      });
      const gear = bakeFor(paths, method, mp, `${item.id}_${view.id}_gear`, {
        layer: 'gear',
        yaw: view.yaw,
        gearSpec,
        toon,
      });
      // 겹치는 순서는 몸 · 장비 · 지팡이 · 방패다. 층은 몸으로만 가려져 있어 장비와 무기가 서로 가리는 곳은
      // 이 순서가 정한다 — 그 차이도 아래 수치에 든다
      const stacked = layerOver(
        layerOver(layerOver(read(body), read(gear)), read(staff)),
        read(shield),
      );
      const stackedFile = path.join(mp.dir, `${item.id}_${view.id}_stacked.png`);
      fs.writeFileSync(stackedFile, encodePng(stacked));
      const { changed, maxChannel } = pixelDiff(stacked, read(whole), DIFF_THRESHOLD);
      numbers.push({ method, case: item.id, view: view.id, stackedVsWhole: changed, maxChannel });

      const w = cells(whole);
      const s = cells(stackedFile);
      rows.push([w.source, w.game, s.game]);
    }
  }

  if (method === 'hull') {
    // 몸 헐을 가림 전용에 넣으면 지팡이가 몸 윤곽보다 헐 두께만큼 더 지워진다(정본 §5). 켬 · 끔의 차이가 그 양이다
    const noHull = writeJson(
      path.join(mp.dir, 'toon_body_nohull.json'),
      toonSpec(paths, method, null, false),
    );
    const off = bakeFor(paths, method, mp, 'staff_front_body_nohull', {
      layer: 'staff',
      yaw: 0,
      toon: noHull,
      weaponSpec: paths.staff,
    });
    const on = path.join(mp.dir, 'staff_front.png');
    const hullOn = visiblePixels(read(on));
    const hullOff = visiblePixels(read(off));
    numbers.push({
      method,
      case: 'staff-front-holdout',
      hullOn,
      hullOff,
      erasedByHull: hullOff - hullOn,
    });
  }

  const sheet = composeGrid(rows, { gap: 12, background: [40, 40, 44] });
  fs.writeFileSync(path.join(outDir, `sheet_outline_${method}.png`), encodePng(sheet));
  return numbers;
}

/** 같은 경우 · 방향을 네 판(없음 · 헐 · Line Art · 후처리)으로 나란히 — 방향마다 한 장. */
function writeCompareSheets(
  outDir: string,
  methods: readonly Method[],
  items: readonly IGearCase[],
): string[] {
  const files: string[] = [];
  for (const view of VIEWS.filter((v) => DEFAULT_VIEWS.includes(v.id))) {
    const rows: IRgbaImage[][] = [];
    for (const item of items) {
      const sources: IRgbaImage[] = [];
      const games: IRgbaImage[] = [];
      const none = path.join(ROOT, GEAR_DIR, `${item.id}_${view.id}_whole.png`);
      if (fs.existsSync(none)) {
        const c = cells(none);
        sources.push(c.source);
        games.push(c.game);
      }
      for (const method of methods) {
        const suffix = method === 'post' ? '_outlined' : '';
        const file = path.join(outDir, method, `${item.id}_${view.id}_whole${suffix}.png`);
        if (!fs.existsSync(file)) continue;
        const c = cells(file);
        sources.push(c.source);
        games.push(c.game);
      }
      rows.push([...sources, ...games]);
    }
    const file = path.join(outDir, `sheet_outline_compare_${view.id}.png`);
    fs.writeFileSync(file, encodePng(composeGrid(rows, { gap: 12, background: [40, 40, 44] })));
    files.push(file);
  }
  return files;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const argv = process.argv.slice(2);
    const pick = (flag: string): string[] | null => {
      const at = argv.indexOf(flag);
      return at >= 0 ? argv[at + 1].split(',') : null;
    };
    const only = pick('--only');
    const caseIds = pick('--cases');
    const methods = METHODS.filter((m) => !only || only.includes(m));
    const items = CASES.filter((c) => !caseIds || caseIds.includes(c.id));
    const vrm = path.resolve(ROOT, DEFAULT_VRM);
    if (!fs.existsSync(vrm)) throw new Error(`.vrm이 없다: ${vrm}`);

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

    const numbers: Record<string, unknown>[] = [];
    for (const method of methods) {
      const started = Date.now();
      numbers.push(...runMethod(paths, outDir, method, items));
      console.log(
        `✓ ${METHOD_LABEL[method]} ${((Date.now() - started) / 1000).toFixed(0)}s — sheet_outline_${method}.png`,
      );
    }
    for (const file of writeCompareSheets(outDir, methods, items))
      console.log(`✓ ${path.relative(ROOT, file)}`);
    writeJson(path.join(outDir, 'numbers.json'), numbers);

    console.log(
      `\n겨냥 굵기 ${WIDTH_PX}px (${PX_PER_M.toFixed(1)}px/m) — 헐 폭 ${(WIDTH_PX / PX_PER_M).toFixed(4)}m · Line Art 반지름 ${LINEART_SPEC.radius.toFixed(4)}m · 후처리 ${WIDTH_PX}px`,
    );
    console.log('\n방식      경우      방향            층합성차이  최대채널차');
    for (const n of numbers) {
      if (n.stackedVsWhole === undefined) continue;
      console.log(
        `${String(n.method).padEnd(9)} ${String(n.case).padEnd(9)} ${String(n.view).padEnd(15)} ${String(n.stackedVsWhole).padStart(9)}  ${String(n.maxChannel).padStart(9)}`,
      );
    }
    const probe = numbers.find((n) => n.case === 'staff-front-holdout');
    if (probe)
      console.log(
        `\n몸 헐 가림 탐침(정면 지팡이 층): 헐 켬 ${probe.hullOn}px · 끔 ${probe.hullOff}px → 헐이 더 지운 픽셀 ${probe.erasedByHull}`,
      );
    console.log(
      '\n방식 시트 열: 기준 컷(원본 크기) · 기준 컷 720p · 층 합성 720p / 줄: 경우 × 방향(앞 · 뒤 · 3/4)',
    );
    console.log(
      '비교 시트(방향마다 한 장) 열: 없음 · 헐 · Line Art · 후처리를 원본 크기로, 이어서 같은 순서로 720p / 줄: 경우',
    );
    console.log('\n볼 것:');
    for (const check of [
      '720p에서 선이 귀신 표본 굵기(긴 변의 0.55%)로 읽히나',
      '지팡이 대(2.1px)가 외곽선에 뭉툭해지나 — 뭉툭하면 weapons.ts 대 반지름을 다시 본다',
      '두께 없는 망토 · 날개 판에서 선이 깨지거나 두 겹으로 겹치나',
      '얇은 사슬 · 뿔 · 끈처럼 가는 것이 선에 먹히나',
      '가림 뒤 외곽선이 남거나 사라지나 (층 합성 720p vs 기준 컷 720p)',
      '헐: 몸 헐을 가림에 넣을 때 지팡이가 더 지워지는 양이 받아들일 만한가 (수치)',
    ])
      console.log(`  - ${check}`);
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
}
