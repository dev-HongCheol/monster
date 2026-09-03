/**
 * 로컬 파이프라인 게이트 둘을 실측하는 실행기.
 *
 * 계획 §5의 게이트 2·3이 묻는 것을 `SpriteMetrics`의 판정 함수로 재서 통과·실패를 찍는다.
 * 판정 로직을 여기 옮겨 적지 않고 그 파일을 부르기만 하는 이유는 `judge.ts`가 세운 것과
 * 같다 — 단언은 `LocalArtPipeline.test.ts`가 합성 픽스처로 못 박고, 여기는 그 함수에
 * 진짜 PNG를 먹이는 얇은 껍데기다. 둘이 갈리면 테스트가 통과하는데 게이트만 틀린다.
 *
 * 돌리는 법:
 *   node --experimental-strip-types tools/art/gate.ts freeze <A.png> <B.png> <mask.png>
 *   node --experimental-strip-types tools/art/gate.ts geometry <r,g,b> <허용치> <넉 장.png...>
 */

import fs from 'node:fs';
import {
  chromaBox,
  type IBox,
  type IRgb,
  type IRgbaImage,
  maskedRegionDelta,
  viewGeometrySpread,
} from '../../tests/helpers/SpriteMetrics.ts';
import { decodePng } from './PngCodec.ts';

/** 게이트 3의 허용차 — QA 문서 §4.1이 정본이고 여기 옮겨 적은 값이다. */
const GEOMETRY_LIMITS = { height: 0.04, width: 0.05, aspect: 0.05 };

/**
 * 마스크 PNG를 판정용 알파 마스크로 바꾼다.
 *
 * ComfyUI의 `LoadImageMask`는 마스크를 **빨강 채널**로 읽고(알파로 읽으면 뜻이 뒤집힌다),
 * `maskedRegionDelta`는 **알파 255**를 열린 자리로 본다. 두 규약이 다르므로 같은 파일을
 * 두 번 그리지 않고 여기서 옮긴다 — 파일이 둘이면 그래프가 연 자리와 판정이 본 자리가
 * 어긋나도 아무도 모른다.
 */
function maskFromRed(img: IRgbaImage): IRgbaImage {
  const data = new Uint8Array(img.data.length);
  for (let i = 0; i < img.data.length; i += 4) {
    data[i + 3] = img.data[i] > 127 ? 255 : 0;
  }
  return { width: img.width, height: img.height, data };
}

/** 게이트 2 — 마스크 밖이 원본 그대로인가. */
function freeze(aPath: string, bPath: string, maskPath: string): number {
  const a = decodePng(fs.readFileSync(aPath));
  const b = decodePng(fs.readFileSync(bPath));
  const maskPng = decodePng(fs.readFileSync(maskPath));
  const mask = maskFromRed(maskPng);

  let opened = 0;
  for (let i = 3; i < mask.data.length; i += 4) if (mask.data[i] === 255) opened++;

  const delta = maskedRegionDelta(a, b, mask);

  // 마스크 **안**도 함께 센다. 밖이 0인데 안도 0이면 인페인팅이 아예 안 돈 것이라,
  // 그때의 0은 「얼렸다」가 아니라 「아무 일도 없었다」다.
  const inverted: IRgbaImage = {
    width: mask.width,
    height: mask.height,
    data: mask.data.map((v, i) => (i % 4 === 3 ? 255 - v : v)),
  };
  const inside = maskedRegionDelta(a, b, inverted);

  console.log(`캔버스        ${a.width}×${a.height}`);
  console.log(`마스크 연 자리 ${opened.toLocaleString()}px`);
  console.log(
    `마스크 밖 차이 ${delta.differing.toLocaleString()}px${delta.firstAt ? ` (첫 좌표 ${delta.firstAt.x},${delta.firstAt.y})` : ''}`,
  );
  console.log(`마스크 안 차이 ${inside.differing.toLocaleString()}px`);

  if (delta.differing !== 0) {
    console.log('\n게이트 2 실패 — 마스크 밖이 달라졌다. ImageCompositeMasked가 빠졌는지 본다');
    return 1;
  }
  if (inside.differing === 0) {
    console.log('\n게이트 2 무효 — 마스크 안도 안 바뀌었다. 인페인팅이 안 돈 것이라 0이 공허하다');
    return 1;
  }
  console.log('\n게이트 2 통과 — 마스크 밖 차이가 정확히 0이고, 안은 다시 그려졌다');
  return 0;
}

/**
 * 캔버스 테두리에서 배경색을 추정한다 — 채널별 중앙값이다.
 *
 * **모서리 한 픽셀을 쓰면 안 된다.** 생성물의 맨 가장자리 줄에는 아티팩트가 껴서 실제 배경과
 * 십수 단위씩 어긋나는 일이 있고, 그 값을 기준으로 삼으면 배경 전체가 「배경이 아닌 것」으로
 * 잡혀 상자가 캔버스가 된다. 2026-08-29에 실제로 그렇게 한 번 잘못 읽었다. 중앙값은 그런
 * 점 몇 개에 안 흔들린다.
 *
 * @param inset 테두리에서 몇 px 안쪽 링을 표본으로 삼을지
 */
function borderBackground(img: IRgbaImage, inset = 4): IRgb {
  const channel: [number[], number[], number[]] = [[], [], []];
  const push = (x: number, y: number): void => {
    const i = (y * img.width + x) * 4;
    for (let c = 0; c < 3; c++) channel[c].push(img.data[i + c]);
  };
  for (let x = inset; x < img.width - inset; x += 4) {
    push(x, inset);
    push(x, img.height - 1 - inset);
  }
  for (let y = inset; y < img.height - inset; y += 4) {
    push(inset, y);
    push(img.width - 1 - inset, y);
  }

  const median = (xs: number[]): number => xs.sort((l, r) => l - r)[Math.floor(xs.length / 2)];
  return { r: median(channel[0]), g: median(channel[1]), b: median(channel[2]) };
}

/**
 * 게이트 3 — 네 장의 기하가 서로 허용차 안인가.
 *
 * @param bgText `r,g,b` 또는 `auto`. **넷의 배경색이 서로 다르면 `auto`를 쓴다** — 생성물의
 *   배경은 회차마다 몇십 단위씩 흔들려서, 한 색을 넷에 같이 걸면 어떤 장은 배경이 전경으로
 *   잡히고 어떤 장은 인물이 배경으로 잡힌다
 */
function geometry(bgText: string, toleranceText: string, paths: string[]): number {
  if (paths.length !== 4) throw new Error(`넉 장이어야 한다: ${paths.length}장을 받았다`);
  const fixed = bgText === 'auto' ? null : bgText.split(',').map(Number);
  const tolerance = Number(toleranceText);

  const boxes: IBox[] = paths.map((p) => {
    const img = decodePng(fs.readFileSync(p));
    const bg = fixed ? { r: fixed[0], g: fixed[1], b: fixed[2] } : borderBackground(img);
    const box = chromaBox(img, bg, tolerance);
    if (box === null)
      throw new Error(`${p}: 배경에서 먼 픽셀이 하나도 없다 — 배경색·허용치를 본다`);
    console.log(`  ${p}  ${box.width}×${box.height}@${box.x},${box.y}  발밑 ${box.y + box.height}`);
    return box;
  });

  const spread = viewGeometrySpread(boxes);
  const percent = (v: number): string => `${(v * 100).toFixed(1)}%`;
  console.log(`\n세로 편차   ${percent(spread.height)}  (한계 ${percent(GEOMETRY_LIMITS.height)})`);
  console.log(`가로 편차   ${percent(spread.width)}  (한계 ${percent(GEOMETRY_LIMITS.width)})`);
  console.log(`종횡비 편차 ${percent(spread.aspect)}  (한계 ${percent(GEOMETRY_LIMITS.aspect)})`);
  console.log(`발 밑선 차  ${spread.footLine}px  (한계 0px)`);

  const failed = [
    spread.height > GEOMETRY_LIMITS.height && '세로',
    spread.width > GEOMETRY_LIMITS.width && '가로',
    spread.aspect > GEOMETRY_LIMITS.aspect && '종횡비',
    spread.footLine > 0 && '발 밑선',
  ].filter(Boolean);

  if (failed.length > 0) {
    console.log(`\n게이트 3 실패 — ${failed.join(' · ')}`);
    return 1;
  }
  console.log('\n게이트 3 통과');
  return 0;
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'freeze') process.exit(freeze(rest[0], rest[1], rest[2]));
else if (mode === 'geometry') process.exit(geometry(rest[0], rest[1], rest.slice(2)));
else {
  console.log('쓰는 법: gate.ts freeze <A> <B> <mask> | gate.ts geometry <r,g,b> <허용치> <넉 장>');
  process.exit(2);
}
