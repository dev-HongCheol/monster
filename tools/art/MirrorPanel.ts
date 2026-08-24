/**
 * 시트 안에서 한 방향 패널을 좌우 반전해 다른 방향 자리에 얹는다.
 *
 * **왜 유료 회차 대신 이것이 성립하는가.** 슬롯을 역할로 나누기로 하면서 측면 두 장은 둘 다
 * 쥔 팔이 화면 가까운 쪽이 됐고, 그래서 좌·우 패널은 서로 **거울상**이어야 맞는다(실행 지침
 * §7.1). 한쪽이 제대로 나왔다면 반대쪽은 그것을 뒤집은 것과 같으므로, 다시 뽑을 이유가 없다.
 * 편집 회차는 컷마다 과금되는 데다 시트 전체를 다시 그려서 멀쩡하던 패널까지 흔들고 인물을
 * 2~3%씩 줄이는데, 이 길은 그 셋을 전부 피한다.
 *
 * **전경만 옮기고 배경은 행 배경색으로 덮는다.** 사각형을 통째로 복사하면 배경의 세로
 * 그라데이션이 어긋나 이음매가 남는다. 어차피 뒤에 매팅이 배경을 걷어내지만, 이 시트는 그
 * 전에 편집 회차의 입력으로 한 번 더 모델에게 들어가므로 깨끗한 편이 낫다.
 *
 * **쓰기 전에 확인할 것 하나.** 좌우 비대칭인 요소(가르마·한쪽 어깨 장식·가슴의 지퍼)는 함께
 * 뒤집힌다. 대칭으로 읽히는 시트에서만 쓰고, 결과를 눈으로 본 뒤 채택한다.
 *
 * 돌리는 법:
 *
 * ```
 * node --experimental-strip-types tools/art/MirrorPanel.ts <입력> <출력> --from <방향> --to <방향>
 * ```
 *
 * 방향은 `front`·`back`·`left`·`right`이고 시트의 패널 순서를 그대로 따른다.
 */

import fs from 'node:fs';
import { assertNodeVersion } from './NodeVersion.ts';
import { decodePng, encodePng } from './PngCodec.ts';
import { type IColumnRange, panelColumns } from './SheetCrop.ts';

/** 시트의 패널 순서. `build.ts`와 같은 순서를 쓴다. */
const DIRECTIONS = ['front', 'back', 'left', 'right'] as const;
type Direction = (typeof DIRECTIONS)[number];

/**
 * 패널 검출 기준. `build.ts`의 값을 그대로 쓴다 — 같은 시트를 같은 구간으로 갈라야
 * 여기서 만든 판이 그쪽 실행기에서 다시 넷으로 갈린다.
 */
const PANEL_DETECTION = { maxDistance: 24, minColumnPixels: 3, rowBackground: true };

/** 배경으로 볼 최대 거리. `PANEL_DETECTION.maxDistance`와 같은 기준을 픽셀 하나에 쓴다. */
const BACKGROUND_DISTANCE = 24;

/** 원본 패널을 뜰 때 구간 양옆으로 더 붙일 열 수. `cropColumns`의 여백과 같은 이유다. */
const SOURCE_MARGIN = 10;

/** 지울 자리를 대상 패널 구간 양옆으로 얼마나 넓힐지. 검출에 안 걸린 옅은 열까지 걷는다. */
const ERASE_MARGIN = 30;

interface IRgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * 그 행의 배경색을 낸다. 패널 사이 빈 열에서 뽑으므로 세로 그라데이션을 그대로 따라간다.
 *
 * 캔버스 양 끝이 아니라 **패널 사이**를 쓰는 이유는 얹을 자리 바로 옆의 색이 필요하기
 * 때문이다. 가로로도 밝기가 변하는 시트에서 반대편 끝 색으로 덮으면 그 차이가 띠로 남는다.
 */
function rowBackground(img: IRgbaImage, x: number, y: number): [number, number, number] {
  const o = (y * img.width + x) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2]];
}

/** 이 픽셀이 그 행의 배경에서 충분히 먼가. */
function isForeground(img: IRgbaImage, x: number, y: number, bgX: number): boolean {
  const o = (y * img.width + x) * 4;
  const [r, g, b] = rowBackground(img, bgX, y);
  const d = (img.data[o] - r) ** 2 + (img.data[o + 1] - g) ** 2 + (img.data[o + 2] - b) ** 2;
  return d >= BACKGROUND_DISTANCE * BACKGROUND_DISTANCE;
}

/**
 * 두 패널 사이에서 배경을 뽑을 열을 고른다. 대상 패널 **왼쪽**의 빈 구간 한가운데다.
 *
 * @throws 대상이 첫 패널이라 왼쪽에 빈 구간이 없으면
 */
function backgroundColumn(columns: readonly IColumnRange[], toIndex: number): number {
  if (toIndex === 0) throw new Error('첫 패널에는 왼쪽 빈 구간이 없다 — 대상을 바꾼다');
  return Math.round((columns[toIndex - 1].to + columns[toIndex].from) / 2);
}

/**
 * `from` 패널을 좌우 반전해 `to` 패널 자리에 얹은 새 이미지를 낸다. 원본은 안 건드린다.
 *
 * 두 패널의 **중심**을 맞춘다. 폭이 다를 수 있기 때문인데(소품이 한쪽에만 걸치면 그렇다),
 * 왼쪽 끝을 맞추면 인물이 옆으로 밀린다. 발 밑선은 세로를 안 건드리므로 그대로 유지된다.
 */
export function mirrorPanel(img: IRgbaImage, from: Direction, to: Direction): IRgbaImage {
  const background = rowBackground(img, 0, 0);
  const columns = panelColumns(img, { background, ...PANEL_DETECTION });
  if (columns.length !== DIRECTIONS.length) {
    throw new Error(`인물 구간이 ${DIRECTIONS.length}개가 아니라 ${columns.length}개다`);
  }

  const fromRange = columns[DIRECTIONS.indexOf(from)];
  const toRange = columns[DIRECTIONS.indexOf(to)];
  const bgX = backgroundColumn(columns, DIRECTIONS.indexOf(to));

  const out = new Uint8Array(img.data);
  const erase = {
    from: Math.max(0, toRange.from - ERASE_MARGIN),
    to: Math.min(img.width - 1, toRange.to + ERASE_MARGIN),
  };
  for (let y = 0; y < img.height; y++) {
    const [r, g, b] = rowBackground(img, bgX, y);
    for (let x = erase.from; x <= erase.to; x++) {
      const o = (y * img.width + x) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  }

  const fromCenter = (fromRange.from + fromRange.to) / 2;
  const toCenter = (toRange.from + toRange.to) / 2;
  const source = {
    from: Math.max(0, fromRange.from - SOURCE_MARGIN),
    to: Math.min(img.width - 1, fromRange.to + SOURCE_MARGIN),
  };
  for (let y = 0; y < img.height; y++) {
    for (let sx = source.from; sx <= source.to; sx++) {
      if (!isForeground(img, sx, y, bgX)) continue;
      const dx = Math.round(toCenter + (fromCenter - sx));
      if (dx < 0 || dx >= img.width) continue;
      const so = (y * img.width + sx) * 4;
      const dofs = (y * img.width + dx) * 4;
      out[dofs] = img.data[so];
      out[dofs + 1] = img.data[so + 1];
      out[dofs + 2] = img.data[so + 2];
      out[dofs + 3] = img.data[so + 3];
    }
  }

  return { width: img.width, height: img.height, data: out };
}

function readDirection(args: string[], flag: string): Direction {
  const value = args[args.indexOf(flag) + 1];
  if (!DIRECTIONS.includes(value as Direction)) {
    throw new Error(`${flag} 뒤에 ${DIRECTIONS.join('·')} 중 하나를 적는다`);
  }
  return value as Direction;
}

function main(): void {
  assertNodeVersion();

  const args = process.argv.slice(2);
  const [input, output] = args.filter(
    (a) => !a.startsWith('--') && !DIRECTIONS.includes(a as Direction),
  );
  if (!input || !output) throw new Error('입력과 출력 경로를 적는다');

  const img = decodePng(new Uint8Array(fs.readFileSync(input)));
  const from = readDirection(args, '--from');
  const to = readDirection(args, '--to');
  const mirrored = mirrorPanel(img, from, to);

  fs.writeFileSync(output, encodePng(mirrored));
  console.log(`✓ ${from} → ${to} 반전 완료: ${output}`);
}

main();
