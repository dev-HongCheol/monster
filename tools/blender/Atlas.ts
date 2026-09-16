/**
 * 구운 층별 프레임을 아틀라스 한 장에 담는 순수 로직 — 디스크도 PNG 포맷도 모른다.
 *
 * 층 다섯을 방향 넷 × 동작 둘로 구우면 프레임이 240장을 넘는다. 낱장으로 넣으면 그만큼
 * `.meta`가 생기고 웹 빌드 파일 수가 불어나므로, 층 × 동작 단위로 묶어 한 장에 담고 게임은
 * 이름으로 꺼낸다.
 *
 * **담을 때 투명 여백을 잘라 내고, 잘라 낸 만큼을 plist의 `offset`으로 돌려준다.** 게임은 층마다
 * 246×493 캔버스를 같은 48×96 상자에 넣어 층을 겹치므로, 잘라 낸 사실을 엔진이 모르면 무기와
 * 상의가 몸에서 어긋난다.
 *
 * **`offset`은 원본 중심 대비 트림 상자 중심의 이동량이고 y는 위가 양수다.** 좌상단 좌표가
 * 아니다. 렌더가 꼭짓점을 `offset + (원본 크기 − 트림 크기) / 2`로 잡기 때문이고, 부호를
 * 뒤집으면 판정은 전부 통과하는데 게임 안에서 발치만 조용히 어긋난다. 이 계약과 plist 키 이름을
 * 어디서 확인했는지는
 * `docs/development/sessions/2026-09-15-blender-3d-gate-round2-g4-bake.md` §6이 든다.
 */

import { type IRgbaImage, trimBox } from '../../tests/helpers/SpriteMetrics.ts';
import { normalizeAlpha } from '../art/Postprocess.ts';
import type { IRect } from './ComparisonSheet.ts';

/**
 * 트림할 때 내용으로 안 세는 알파의 상한.
 *
 * 프레임 판정(`tests/helpers/FrameSet.ts`)이 쓰는 값과 같다. 두 잣대가 갈리면 판정은 「빈
 * 프레임」이라 한 장을 작성기는 내용이 있다고 담아, 아틀라스에 투명 여백이 그대로 실린다.
 */
const FAINT_UP_TO = 16;

/** 가로세로 크기. */
export interface ISize {
  width: number;
  height: number;
}

/** 픽셀 좌표의 한 점. */
export interface IPoint {
  x: number;
  y: number;
}

/** `packShelves`에 넣는 칸 하나의 크기. */
export interface IPackBox {
  width: number;
  height: number;
}

/** `packShelves`의 설정. */
export interface IPackOptions {
  /** 아틀라스 가로 상한(px). 이 폭을 넘기 전에 다음 선반으로 내린다 */
  maxWidth: number;
  /** 칸 사이와 바깥 테두리에 두는 여백(px) */
  padding: number;
}

/** `packShelves`의 결과. */
export interface IPackResult {
  /** 입력과 같은 순서의 칸 왼쪽 위 좌표 */
  placements: IPoint[];
  /** 담은 것을 감싸는 아틀라스 가로 */
  width: number;
  /** 담은 것을 감싸는 아틀라스 세로 */
  height: number;
}

/** `buildAtlas`에 넣는 프레임 한 장. */
export interface IAtlasInput {
  /** `frameName`이 만든 이름. 확장자를 붙이지 않는다 */
  name: string;
  /** 구운 프레임 — 원본 캔버스 그대로다 */
  image: IRgbaImage;
}

/** plist 한 항목 — cocos2d 포맷 2가 읽는 값 넷이다. */
export interface IAtlasEntry {
  name: string;
  /** 아틀라스 안에서 이 프레임이 차지하는 상자 */
  frame: IRect;
  /** 원본 중심 대비 트림 상자 중심의 이동량. y는 위가 양수다 */
  offset: IPoint;
  /** 회전해 담지 않는다. offset 해석이 한 겹 늘어나는데 얻는 것이 없다 */
  rotated: boolean;
  /** 트림 전 원본 캔버스 크기 */
  sourceSize: ISize;
}

/** `buildAtlas`의 결과. */
export interface IAtlas {
  /** 담긴 한 장 */
  image: IRgbaImage;
  /** 입력과 같은 순서의 plist 항목 */
  entries: IAtlasEntry[];
}

/**
 * 프레임 이름을 만든다 — 확장자를 붙이지 않는다.
 *
 * 같은 규칙이 이 작성기와 게임의 동기화 컴포넌트 두 곳에 산다. Cocos 스크립트는 `game/assets`
 * 밖을 import할 수 없어 한 파일로 모을 수 없으므로, 두 쪽이 모든 조합에서 같은 문자열을 내는지를
 * 테스트가 붙든다.
 *
 * 번호를 두 자리로 채우는 것은 에디터 자산 목록의 사전순을 번호순과 맞추기 위해서다. 채우지
 * 않으면 `_1` · `_10` · `_2` 순으로 보여, 사람이 프레임을 눈으로 훑을 때 순서를 잘못 읽는다.
 *
 * @param layer 층 이름 (`body` · `topA` · `topB` · `staff` · `shield`)
 * @param action 동작 이름 (`walk` · `idle`)
 * @param facing 방향 이름 (`front` · `back` · `left` · `right`)
 * @param index 0부터 세는 프레임 번호
 */
export function frameName(layer: string, action: string, facing: string, index: number): string {
  return `${layer}_${action}_${facing}_${String(index).padStart(2, '0')}`;
}

/**
 * 칸을 줄(선반) 단위로 눕혀 담는다.
 *
 * 프레임 크기가 서로 비슷해서 선반 패킹으로 충분하다. 빈틈을 더 줄이는 패킹은 코드가 늘고
 * 순서가 바뀌는데, 이 입력에서는 줄어드는 픽셀이 얼마 안 된다.
 *
 * @param boxes 담을 칸 크기. 결과는 이 순서를 지킨다
 * @param opts 가로 상한과 여백
 */
export function packShelves(boxes: readonly IPackBox[], opts: IPackOptions): IPackResult {
  const placements: IPoint[] = [];
  let x = opts.padding;
  let y = opts.padding;
  let shelfHeight = 0;
  let right = opts.padding;

  for (const box of boxes) {
    // 줄 첫 칸은 폭을 넘더라도 내리지 않는다. 내려도 같은 자리라 빈 선반만 하나 생긴다.
    if (x > opts.padding && x + box.width + opts.padding > opts.maxWidth) {
      y += shelfHeight + opts.padding;
      x = opts.padding;
      shelfHeight = 0;
    }

    placements.push({ x, y });
    x += box.width + opts.padding;
    right = Math.max(right, x);
    shelfHeight = Math.max(shelfHeight, box.height);
  }

  return { placements, width: right, height: y + shelfHeight + opts.padding };
}

/** 이미지에서 사각형 한 칸을 떼어 낸 복사본. */
function copyRect(src: IRgbaImage, box: IRect): IRgbaImage {
  const data = new Uint8Array(box.width * box.height * 4);
  for (let row = 0; row < box.height; row++) {
    const from = ((box.y + row) * src.width + box.x) * 4;
    data.set(src.data.subarray(from, from + box.width * 4), row * box.width * 4);
  }
  return { width: box.width, height: box.height, data };
}

/** 픽셀 하나를 옮겨 적는다. 대상 밖이면 아무것도 하지 않는다. */
function blitPixel(
  dst: IRgbaImage,
  dstX: number,
  dstY: number,
  src: IRgbaImage,
  srcX: number,
  srcY: number,
): void {
  if (dstX < 0 || dstY < 0 || dstX >= dst.width || dstY >= dst.height) return;
  const from = (srcY * src.width + srcX) * 4;
  dst.data.set(src.data.subarray(from, from + 4), (dstY * dst.width + dstX) * 4);
}

/**
 * 담은 칸의 가장자리 픽셀을 1px 바깥으로 늘린다.
 *
 * 늘리지 않으면 축소 샘플링이 칸 경계에서 이웃의 투명 픽셀을 함께 읽어 윤곽이 반투명해진다.
 * 늘린 자리는 트림 상자 밖이라 plist 값에도 왕복 복원에도 들어가지 않는다.
 */
function extrudeEdges(atlas: IRgbaImage, box: IRect, cell: IRgbaImage): void {
  for (let row = 0; row < cell.height; row++) {
    blitPixel(atlas, box.x - 1, box.y + row, cell, 0, row);
    blitPixel(atlas, box.x + box.width, box.y + row, cell, cell.width - 1, row);
  }
  for (let col = 0; col < cell.width; col++) {
    blitPixel(atlas, box.x + col, box.y - 1, cell, col, 0);
    blitPixel(atlas, box.x + col, box.y + box.height, cell, col, cell.height - 1);
  }
  // 네 모서리. 위 두 루프가 변만 채우므로 대각선 자리는 비어 남는다.
  blitPixel(atlas, box.x - 1, box.y - 1, cell, 0, 0);
  blitPixel(atlas, box.x + box.width, box.y - 1, cell, cell.width - 1, 0);
  blitPixel(atlas, box.x - 1, box.y + box.height, cell, 0, cell.height - 1);
  blitPixel(atlas, box.x + box.width, box.y + box.height, cell, cell.width - 1, cell.height - 1);
}

/**
 * 프레임을 트림해 한 장에 담고 plist 항목을 만든다.
 *
 * **트림은 알파를 누른 사본에 대고 한다.** 알파 1짜리 먼지가 구석에 한 점 있으면 `> 0` 기준
 * 트림 상자는 캔버스 전체가 되고, 그러면 아틀라스가 투명 여백을 그대로 싣는다.
 *
 * **통째로 빈 프레임도 항목을 남긴다.** 무기 층은 방향에 따라 비는 것이 정상이라(뒷모습에서
 * 몸에 가려진 지팡이), 항목을 빼면 게임이 그 이름을 못 찾아 직전 프레임을 붙든 채로 남는다.
 * 그런 프레임은 투명한 1×1로 담고 `offset`을 0으로 둔다.
 *
 * @param inputs 담을 프레임. 결과 항목은 이 순서를 지킨다
 * @param opts 가로 상한과 여백
 */
export function buildAtlas(inputs: readonly IAtlasInput[], opts: IPackOptions): IAtlas {
  const normalized = inputs.map((input) => normalizeAlpha(input.image, { faintUpTo: FAINT_UP_TO }));
  const boxes = normalized.map((img) => trimBox(img));
  const cells = boxes.map((box, i) =>
    box === null ? { width: 1, height: 1, data: new Uint8Array(4) } : copyRect(normalized[i], box),
  );

  const packed = packShelves(cells, opts);
  const atlas: IRgbaImage = {
    width: packed.width,
    height: packed.height,
    data: new Uint8Array(packed.width * packed.height * 4),
  };

  const entries = inputs.map((input, i) => {
    const cell = cells[i];
    const at = packed.placements[i];
    const box: IRect = { x: at.x, y: at.y, width: cell.width, height: cell.height };

    for (let row = 0; row < cell.height; row++) {
      const from = row * cell.width * 4;
      atlas.data.set(
        cell.data.subarray(from, from + cell.width * 4),
        ((box.y + row) * atlas.width + box.x) * 4,
      );
    }
    extrudeEdges(atlas, box, cell);

    const source = normalized[i];
    const trimmed = boxes[i];
    const offset =
      trimmed === null
        ? { x: 0, y: 0 }
        : {
            x: trimmed.x + trimmed.width / 2 - source.width / 2,
            y: source.height / 2 - (trimmed.y + trimmed.height / 2),
          };

    return {
      name: input.name,
      frame: box,
      offset,
      rotated: false,
      sourceSize: { width: source.width, height: source.height },
    };
  });

  return { image: atlas, entries };
}

/**
 * 담긴 프레임을 원본 캔버스로 되돌린다 — plist에 적은 값만 보고 계산한다.
 *
 * 작성기의 내부 값을 쓰지 않는 것이 요점이다. 같은 변수를 나눠 쓰면 부호를 틀려도 왕복이 맞아,
 * 게임에서만 어긋나는 오류를 테스트가 못 잡는다.
 *
 * @param atlas 담긴 한 장
 * @param entry 그 프레임의 plist 항목
 */
export function restoreFrame(atlas: IRgbaImage, entry: IAtlasEntry): IRgbaImage {
  const { width, height } = entry.sourceSize;
  const out: IRgbaImage = { width, height, data: new Uint8Array(width * height * 4) };

  // `offset`이 중심 이동량이므로 좌상단은 중심에서 트림 크기의 절반을 물린 자리다. 빈 프레임의
  // 1×1은 나누어떨어지지 않을 수 있는데, 그 픽셀은 투명이라 어디에 놓아도 결과가 같다.
  const left = Math.round(width / 2 + entry.offset.x - entry.frame.width / 2);
  const top = Math.round(height / 2 - entry.offset.y - entry.frame.height / 2);

  for (let row = 0; row < entry.frame.height; row++) {
    const dstY = top + row;
    if (dstY < 0 || dstY >= height) continue;
    const from = ((entry.frame.y + row) * atlas.width + entry.frame.x) * 4;
    out.data.set(
      atlas.data.subarray(from, from + entry.frame.width * 4),
      (dstY * width + left) * 4,
    );
  }

  return out;
}
