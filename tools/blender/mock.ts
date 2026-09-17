/**
 * G2 — 720p 게임 화면 흉내. 고른 고도의 3D 플레이어(상의 A · B)와 귀신 표본을 실제 표시 크기로 1280×720 검정
 * 바탕에 흩어 놓는다. 화풍 게이트와 몬스터 크기 비율을 사용자가 보는 그림이다 — 판정은 사람이 한다.
 *
 * 돌리는 법: `node --experimental-strip-types tools/blender/mock.ts`
 * 먼저 `elevation.ts`가 `player_p15_circle.png` · `player_top_b_p15_circle.png`를 구워 둬야 한다.
 *
 * **플레이어는 규격(48×96)의 80%다.** 첫 흉내(2026-09-17)를 본 사용자가 플레이어가 너무 크다고 봤다. 규격
 * 자체는 아직 안 고쳤고 여기서만 줄인다 — 크기가 판정되면 규격과 판정값(피격 사각형 · 이동 원)을 따로 고친다.
 * 사전 점검에서 드러난 것: 피격 사각형(36×88)은 `player.json` 고정값이라 그림을 줄여도 따라오지 않고, 이동 원
 * (지름 50)은 줄어든 몸 폭(38)보다 넓어진다. 발치 오프셋만 노드 높이에서 유도돼 저절로 따라온다.
 *
 * **몬스터 크기는 `collisionRadius`에서 뽑는다.** 판정 크기가 몬스터 크기에 비례한다는 것이 사용자의 기준이라
 * `threatScale`(보이는 지름)이 아니라 판정 반지름의 순서를 따른다 — 그래야 판정이 가장 큰 두억시니(40)가
 * 도깨비(38)보다 커진다(`threatScale`로는 1.35 대 1.4로 반대다). 양 끝만 고정한다: 가장 작은 달걀귀신(18)은
 * 50, 가장 큰 두억시니(40)는 75. 사이는 직선이다. 달걀귀신이 커졌다고 같은 배율로 전부 키우면 줄어든
 * 플레이어에 비해 큰 놈들이 너무 커진다(2026-09-17 사용자 결정).
 *
 * 크기는 그린 높이(알파 상자)로 맞춘다. 표본은 여백이 있어 캔버스 높이를 쓰면 실제보다 작아진다.
 *
 * **놓은 뒤 수치로 검증한다.** 놓인 그림마다 720p 그린 높이를 기대값과 견주고 어긋나면 멈춘다 — 첫 고도
 * 시트에서 배율 사고가 판정에 올라간 전례가 있다(`elevation.ts` 머리 주석).
 *
 * 귀신 표본과 흉내는 커밋하지 않는다(G2 §4).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_FRAME_SPEC } from '../../tests/helpers/FrameSet.ts';
import { type IRgbaImage, trimBox, visibleBox } from '../../tests/helpers/SpriteMetrics.ts';
import { encodePng } from '../art/PngCodec.ts';
import {
  CHOSEN_PITCH,
  OUT_DIR,
  SCALE_720P,
  scaleToDrawnHeight,
  toGame,
  VISIBLE_ALPHA,
} from './elevation.ts';
import { read } from './gear.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 720p 화면. 설계 해상도 1280×720에 높이 맞춤이라 월드 단위 하나가 1px다 */
const SCREEN = { width: 1280, height: 720 };

/** 플레이어를 규격의 몇 배로 그리나. 사용자 판정(2026-09-17) */
const PLAYER_SHRINK = 0.8;

/** 판정 반지름이 가장 작은 몬스터와 가장 큰 몬스터의 720p 그린 높이. 사이는 직선 보간이다 */
const SMALLEST_HEIGHT = 50;
const LARGEST_HEIGHT = 75;

/** 그린 높이가 기대값에서 벗어나도 되는 px. 엔진식 축소의 반올림 몫이다 */
const HEIGHT_TOLERANCE_PX = 1;

/** 적 데이터 — `collisionRadius`만 쓴다 */
const ENEMIES_JSON = 'game/assets/resources/data/enemies.json';

/** 귀신 표본. 파일은 이 장비에만 있고 커밋하지 않는다. `id`는 `enemies.json`의 것이다 */
const SAMPLES: readonly { id: string; label: string; file: string }[] = [
  { id: 'dalgyal', label: '달걀귀신', file: 'docs/temp/3d-gate/g2/달걀귀신.png' },
  { id: 'cheonyeo', label: '처녀귀신', file: 'docs/temp/3d-gate/g2/처녀귀신.png' },
  { id: 'dokkaebi', label: '도깨비', file: 'docs/temp/3d-gate/g2/도깨비.png' },
  { id: 'dueokshini', label: '두억시니', file: 'docs/temp/3d-gate/g2/두억시니.png' },
];

/**
 * 놓는 자리(그림 중심, 화면 px). 종류마다 셋을 플레이어(화면 중앙) 둘레 여러 거리에 두고, 가장 큰 그림
 * (75 높이 · 60 폭 안팎)끼리도 안 겹치게 100px 넘게 띄웠다.
 */
const PLACEMENT: Readonly<Record<string, readonly [number, number][]>> = {
  dalgyal: [
    [300, 200],
    [980, 520],
    [760, 150],
  ],
  cheonyeo: [
    [220, 480],
    [1060, 260],
    [560, 600],
  ],
  dokkaebi: [
    [420, 340],
    [900, 400],
    [1150, 620],
  ],
  dueokshini: [
    [150, 640],
    [820, 640],
    [1000, 110],
  ],
};

/** 상의 A · B 흉내 한 장씩. 플레이어 파일은 `elevation.ts`가 마법진까지 얹어 둔 것이다 */
const VARIANTS: readonly { tag: string; player: string }[] = [
  { tag: 'a', player: `player_p${CHOSEN_PITCH}_circle.png` },
  { tag: 'b', player: `player_top_b_p${CHOSEN_PITCH}_circle.png` },
];

interface IEnemyRow {
  id: string;
  name: string;
  collisionRadius: number;
}

/**
 * 판정 반지름을 720p 그린 높이로 옮긴다. 데이터 전체의 최소 · 최대 반지름이 양 끝이라, 표본에 없는 몬스터도
 * 같은 직선 위에 놓인다.
 */
function heightFor(radius: number, range: { min: number; max: number }): number {
  const t = (radius - range.min) / (range.max - range.min);
  return Math.round(SMALLEST_HEIGHT + t * (LARGEST_HEIGHT - SMALLEST_HEIGHT));
}

/** 검정 불투명 바탕 */
function blackScreen(): IRgbaImage {
  const data = new Uint8Array(SCREEN.width * SCREEN.height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width: SCREEN.width, height: SCREEN.height, data };
}

/** 그림 중심을 (cx, cy)에 두고 알파로 얹는다. 바탕이 불투명이라 결과 알파는 255 그대로다 */
function blitCentered(dst: IRgbaImage, src: IRgbaImage, cx: number, cy: number): void {
  const ox = Math.round(cx - src.width / 2);
  const oy = Math.round(cy - src.height / 2);
  for (let y = 0; y < src.height; y++) {
    const ty = y + oy;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = x + ox;
      if (tx < 0 || tx >= dst.width) continue;
      const s = (y * src.width + x) * 4;
      const a = src.data[s + 3] / 255;
      if (a <= 0) continue;
      const t = (ty * dst.width + tx) * 4;
      for (let ch = 0; ch < 3; ch++)
        dst.data[t + ch] = Math.round(src.data[s + ch] * a + dst.data[t + ch] * (1 - a));
    }
  }
}

/** 보이는 높이가 기대값 ±허용 안인지. 크기를 맞춘 상자와 같은 문턱으로 잰다. 어긋나면 배율 사고다 */
function assertDrawnHeight(img: IRgbaImage, expected: number, label: string): number {
  const box = visibleBox(img, VISIBLE_ALPHA);
  if (!box) throw new Error(`${label}: 그림이 비어 있다`);
  if (Math.abs(box.height - expected) > HEIGHT_TOLERANCE_PX)
    throw new Error(
      `${label}: 720p 그린 높이 ${box.height}px — 기대 ${expected}px(±${HEIGHT_TOLERANCE_PX})`,
    );
  return box.height;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const enemies = JSON.parse(
      fs.readFileSync(path.join(ROOT, ENEMIES_JSON), 'utf-8'),
    ) as IEnemyRow[];
    const radii = enemies.map((e) => e.collisionRadius);
    const range = { min: Math.min(...radii), max: Math.max(...radii) };

    // 귀신 — 표본을 그린 높이에 맞춰 줄이고 수치로 확인한다
    const ghosts = SAMPLES.map((sample) => {
      const row = enemies.find((e) => e.id === sample.id);
      if (!row) throw new Error(`${ENEMIES_JSON}에 ${sample.id}가 없다`);
      const file = path.join(ROOT, sample.file);
      if (!fs.existsSync(file))
        throw new Error(
          `귀신 표본이 없다: ${sample.file} — 이 장비에만 있는 파일이라 다른 장비면 다시 받는다`,
        );
      const expected = heightFor(row.collisionRadius, range);
      const img = scaleToDrawnHeight(read(file), expected);
      const measured = assertDrawnHeight(img, expected, sample.label);
      return { ...sample, radius: row.collisionRadius, expected, measured, img };
    });

    // 플레이어 — 규격 배율에 축소 배율을 곱한다. 마법진이 발 아래로 내려와 상자를 키우므로 높이 확인은 마법진
    // 없는 렌더로 한다. 고도가 있어 몸통은 cos만큼 짧고 앞으로 나온 발끝 · 방패가 sin만큼 더해지므로 한 점이
    // 아니라 범위로 본다(`elevation.ts`의 칸 높이 검사와 같은 이유)
    const outDir = path.join(ROOT, OUT_DIR);
    const upright =
      (PLAYER_FRAME_SPEC.footLineY - PLAYER_FRAME_SPEC.headLineY) * SCALE_720P.y * PLAYER_SHRINK;
    const low = upright * Math.cos((CHOSEN_PITCH * Math.PI) / 180) * 0.9;
    const high = upright * 1.1;
    const playerHeights: string[] = [];
    for (const variant of VARIANTS) {
      const rawFile = path.join(outDir, variant.player.replace('_circle', ''));
      const box = trimBox(toGame(read(rawFile), PLAYER_SHRINK));
      if (!box) throw new Error(`${variant.player}: 렌더가 비어 있다`);
      if (box.height < low || box.height > high)
        throw new Error(
          `상의 ${variant.tag.toUpperCase()}: 720p 그린 높이 ${box.height}px — 허용 ${low.toFixed(1)}~${high.toFixed(1)}px`,
        );
      playerHeights.push(`상의 ${variant.tag.toUpperCase()} ${box.height}px`);

      const screen = blackScreen();
      for (const ghost of ghosts)
        for (const [cx, cy] of PLACEMENT[ghost.id] ?? []) blitCentered(screen, ghost.img, cx, cy);
      const player = toGame(read(path.join(outDir, variant.player)), PLAYER_SHRINK);
      blitCentered(screen, player, SCREEN.width / 2, SCREEN.height / 2);
      const out = path.join(outDir, `mock_${variant.tag}_720p.png`);
      fs.writeFileSync(out, encodePng(screen));
      console.log(`✓ ${path.relative(ROOT, out)}`);
    }

    console.log(
      `플레이어: 규격 48×96의 ${PLAYER_SHRINK * 100}% (직립 기대 ${upright.toFixed(1)}px, 실측 ${playerHeights.join(' · ')})`,
    );
    console.log(
      `몬스터(collisionRadius → 720p 그린 높이, 직선 ${range.min}→${SMALLEST_HEIGHT} · ${range.max}→${LARGEST_HEIGHT}):`,
    );
    for (const g of ghosts)
      console.log(
        `  ${g.label} r=${g.radius} → ${g.expected}px (실측 ${g.measured}) × ${(PLACEMENT[g.id] ?? []).length}`,
      );
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
}
