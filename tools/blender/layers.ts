/**
 * 층으로 구운 PNG를 재고 겹치는 실행기 — 가림 판정, 층 합성, 기준 컷과의 차이.
 *
 * 플레이어는 몸 · 상의 · 무기 · 장비를 층으로 따로 굽고 게임에서 겹친다(G2 §2). 그래서 굽기마다
 * 세 가지를 확인한다. 가림을 켠 층이 끈 층의 부분집합인지, 층을 겹친 그림이 어떻게 보이는지,
 * 그 그림이 한 번에 구운 기준 컷과 얼마나 다른지다. 재는 규칙은 `ComparisonSheet.ts`가 들고
 * `Blender3dGate.test.ts`가 단언한다. 이 파일은 PNG를 읽고 쓰고 결과를 찍기만 한다.
 *
 * 돌리는 법:
 *
 *   node --experimental-strip-types tools/blender/layers.ts subset <가림끔.png> <가림켬.png>
 *   node --experimental-strip-types tools/blender/layers.ts stack <출력.png> <아래층.png> <위층.png>...
 *   node --experimental-strip-types tools/blender/layers.ts diff <a.png> <b.png>
 *
 * `stack`은 출력 옆에 `<이름>_720p.png`도 쓴다. 굵기 · 테두리 판정은 그 크기로 한다 — 탐침
 * 렌더는 게임보다 여러 배 크게 보여서, 게임에서 사라지는 선이 살아 있는 것처럼 보인다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng } from '../art/PngCodec.ts';
import { layerOver, occlusionDelta, pixelDiff, sampleLikeEngine } from './ComparisonSheet.ts';

/**
 * 이 알파를 넘어야 보이는 픽셀로 친다. 윤곽의 안티에일리어싱 술을 가림 판정에서 뺀다.
 * G2 가림 판정(2026-09-16)이 이 값으로 「새로 생김 0」을 냈다.
 */
const ALPHA_ON = 8;

/** 채널 차가 이 값을 넘어야 바뀐 픽셀로 센다. EEVEE 샘플 잡음이 한두 단계 흔드는 것을 뺀다. */
const DIFF_THRESHOLD = 12;

/**
 * 기준 몸 캔버스 가로(px)와 720p에서 그 캔버스가 차지하는 가로(월드 단위).
 *
 * 층 캔버스가 기준보다 넓어도 배율은 같으므로(ADR 009), 게임 크기는 `층 가로 × 48 / 246`로
 * 구한다. 세로 493 → 96도 같은 배율이다. 두 값의 주인은 `tests/helpers/FrameSet.ts`의
 * `PLAYER_FRAME_SPEC`과 `sheet.ts`의 `ROWS`다.
 */
const BASE_WIDTH = 246;
const GAME_WIDTH_720P = 48;

/** PNG 한 장을 읽는다. 없으면 경로를 말하며 던진다. */
function read(file: string) {
  if (!fs.existsSync(file)) throw new Error(`파일이 없다: ${file}`);
  return decodePng(fs.readFileSync(file));
}

/** 가림 판정을 찍는다. 새로 생긴 픽셀이 있으면 종료 코드 1이다. */
function subset(rawFile: string, heldFile: string): number {
  const { removed, added } = occlusionDelta(read(rawFile), read(heldFile), ALPHA_ON);
  console.log(`지워짐 ${removed} · 새로 생김 ${added}`);
  if (added === 0) return 0;
  console.error(
    '✗ 가림을 켠 층에 끈 층에 없던 픽셀이 있다 — 가림 몸이 섞였거나 두 층의 자세가 다르다',
  );
  return 1;
}

/** 층을 아래부터 겹쳐 쓰고 720p 크기판도 쓴다. */
function stack(outFile: string, layerFiles: string[]): number {
  if (layerFiles.length < 2) throw new Error('겹칠 층이 둘 이상 필요하다');
  let merged = read(layerFiles[0]);
  for (const file of layerFiles.slice(1)) merged = layerOver(merged, read(file));
  fs.writeFileSync(outFile, encodePng(merged));

  const scale = GAME_WIDTH_720P / BASE_WIDTH;
  const game = sampleLikeEngine(
    merged,
    Math.round(merged.width * scale),
    Math.round(merged.height * scale),
  );
  const gameFile = outFile.replace(/\.png$/, '_720p.png');
  fs.writeFileSync(gameFile, encodePng(game));
  console.log(`✓ ${outFile} · ${gameFile} (${game.width}×${game.height})`);
  return 0;
}

/** 두 그림의 차이를 찍는다. 판정 기준은 두지 않는다 — G2에서 잰 값은 G4의 회귀 가드로 쓴다. */
function diff(aFile: string, bFile: string): number {
  const { changed, maxChannel } = pixelDiff(read(aFile), read(bFile), DIFF_THRESHOLD);
  console.log(
    `바뀐 픽셀 ${changed} (채널 차 ${DIFF_THRESHOLD} 초과) · 가장 큰 채널 차 ${maxChannel}`,
  );
  return 0;
}

const [command, ...args] = process.argv.slice(2);
const files = args.map((a) => path.resolve(a));
try {
  let code: number;
  if (command === 'subset' && files.length === 2) code = subset(files[0], files[1]);
  else if (command === 'stack') code = stack(files[0], files.slice(1));
  else if (command === 'diff' && files.length === 2) code = diff(files[0], files[1]);
  else throw new Error('사용법은 이 파일 머리 주석에 있다 — subset · stack · diff');
  process.exit(code);
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}
