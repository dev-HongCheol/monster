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

/** 아틀라스 한 장과 함께 나가는 plist의 머리 정보. */
export interface IPlistMetadata {
  /** plist와 같은 폴더에 있는 PNG 파일 이름 */
  textureFileName: string;
  /** 그 PNG의 크기 */
  textureSize: ISize;
}

/** `parsePlist`가 돌려주는 것. */
export interface IParsedPlist {
  entries: IAtlasEntry[];
  metadata: IPlistMetadata & { format: number };
}

/** 이름에서 되읽은 조각. */
export interface IFrameNameParts {
  layer: string;
  action: string;
  facing: string;
  index: number;
}

/**
 * plist 포맷 번호.
 *
 * 파서는 0~3을 읽는데 2만 쓴다. 3은 폴리곤 메시까지 받는 대신 키 이름이 전부 다르고
 * (`spriteSize` · `spriteOffset` · `textureRect`), 우리는 사각형만 담으므로 얻는 것이 없다.
 */
const PLIST_FORMAT = 2;

/** `{x,y}` 꼴. 공백을 넣지 않는다 — 형식이 어긋나면 파서가 통째로 0으로 읽는다. */
function pointText(p: IPoint): string {
  return `{${p.x},${p.y}}`;
}

/** `{w,h}` 꼴. */
function sizeText(s: ISize): string {
  return `{${s.width},${s.height}}`;
}

/** `{{x,y},{w,h}}` 꼴. */
function rectText(r: IRect): string {
  return `{{${r.x},${r.y}},{${r.width},${r.height}}}`;
}

/**
 * 아틀라스 항목을 cocos2d 포맷 2 plist로 적는다.
 *
 * **값은 중괄호 한 겹과 쉼표로만 적고 공백을 넣지 않는다.** 파서가 중괄호 안쪽에 또 중괄호가
 * 있으면 거부하고, 조각이 둘이 아니어도 거부한다. 거부하면 예외가 아니라 0이 되므로, 형식을
 * 틀리면 모든 프레임이 아틀라스 왼쪽 위 0×0 자리를 가리킨 채 조용히 실린다.
 *
 * @param entries `buildAtlas`가 낸 항목. 적는 순서는 이 순서다
 * @param metadata 같은 폴더의 PNG 이름과 크기
 */
export function writePlist(entries: readonly IAtlasEntry[], metadata: IPlistMetadata): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '<key>frames</key>',
    '<dict>',
  ];

  for (const item of entries) {
    lines.push(
      `<key>${item.name}</key>`,
      '<dict>',
      `<key>frame</key><string>${rectText(item.frame)}</string>`,
      `<key>offset</key><string>${pointText(item.offset)}</string>`,
      `<key>rotated</key>${item.rotated ? '<true/>' : '<false/>'}`,
      `<key>sourceSize</key><string>${sizeText(item.sourceSize)}</string>`,
      '</dict>',
    );
  }

  lines.push(
    '</dict>',
    '<key>metadata</key>',
    '<dict>',
    `<key>format</key><integer>${PLIST_FORMAT}</integer>`,
    `<key>size</key><string>${sizeText(metadata.textureSize)}</string>`,
    `<key>textureFileName</key><string>${metadata.textureFileName}</string>`,
    '</dict>',
    '</dict>',
    '</plist>',
    '',
  );
  return lines.join('\n');
}

/**
 * `from` 뒤의 첫 `<dict>`와 짝이 맞는 `</dict>` 사이를 떼어 낸다.
 *
 * 깊이를 세는 이유는 프레임 딕셔너리가 프레임 딕셔너리를 품기 때문이다. 처음 만난 `</dict>`로
 * 자르면 첫 프레임에서 끊겨 나머지가 통째로 사라지는데, 그 결과는 「프레임 수가 모자라다」로
 * 보여 원인이 파서라는 것이 안 드러난다.
 *
 * @returns 안쪽 내용과 닫는 태그 뒤 위치. 짝이 없으면 `null`
 */
function dictAfter(xml: string, from: number): { inner: string; end: number } | null {
  const open = xml.indexOf('<dict>', from);
  if (open < 0) return null;

  let depth = 1;
  let cursor = open + '<dict>'.length;
  while (cursor < xml.length) {
    const nextOpen = xml.indexOf('<dict>', cursor);
    const nextClose = xml.indexOf('</dict>', cursor);
    if (nextClose < 0) return null;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      cursor = nextOpen + '<dict>'.length;
      continue;
    }
    depth--;
    if (depth === 0) {
      return {
        inner: xml.slice(open + '<dict>'.length, nextClose),
        end: nextClose + '</dict>'.length,
      };
    }
    cursor = nextClose + '</dict>'.length;
  }
  return null;
}

/** `<key>이름</key>` 뒤에 오는 딕셔너리를 떼어 낸다. */
function dictOfKey(xml: string, key: string): string | null {
  const marker = `<key>${key}</key>`;
  const at = xml.indexOf(marker);
  if (at < 0) return null;
  return dictAfter(xml, at + marker.length)?.inner ?? null;
}

/** 딕셔너리에서 문자열 값을 읽는다. */
function stringOfKey(dict: string, key: string): string | null {
  return new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(dict)?.[1] ?? null;
}

/** 중괄호 값에서 숫자만 순서대로 꺼낸다. 부호와 소수점을 받는다. */
function numbersIn(text: string): number[] {
  return (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/** 없으면 무엇이 빠졌는지 말하며 던진다. */
function required<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`plist에 ${what}이(가) 없다`);
  return value;
}

/**
 * 게임에 들어간 plist를 도로 읽는다.
 *
 * 검사 명령이 재는 것은 우리가 방금 만든 값이 아니라 **파일에 실제로 실린 것**이라, 파일을
 * 거쳐 돌아오는 경로가 필요하다. 작성기의 내부 값을 그대로 검사하면 직렬화가 틀려도 통과한다.
 *
 * @throws `frames`·`metadata`나 프레임의 필수 키가 없으면
 */
export function parsePlist(xml: string): IParsedPlist {
  const framesDict = required(dictOfKey(xml, 'frames'), 'frames 딕셔너리');
  const metaDict = required(dictOfKey(xml, 'metadata'), 'metadata 딕셔너리');

  const entries: IAtlasEntry[] = [];
  const keyPattern = /<key>([^<]+)<\/key>/g;
  let match = keyPattern.exec(framesDict);
  while (match !== null) {
    const name = match[1];
    const frameDict = required(
      dictAfter(framesDict, match.index + match[0].length),
      `프레임 ${name}의 딕셔너리`,
    );
    const frame = numbersIn(required(stringOfKey(frameDict.inner, 'frame'), `${name}의 frame`));
    const offset = numbersIn(required(stringOfKey(frameDict.inner, 'offset'), `${name}의 offset`));
    const source = numbersIn(
      required(stringOfKey(frameDict.inner, 'sourceSize'), `${name}의 sourceSize`),
    );

    entries.push({
      name,
      frame: { x: frame[0], y: frame[1], width: frame[2], height: frame[3] },
      offset: { x: offset[0], y: offset[1] },
      rotated: /<key>rotated<\/key>\s*<true\/>/.test(frameDict.inner),
      sourceSize: { width: source[0], height: source[1] },
    });

    // 프레임 딕셔너리 안쪽의 키(frame · offset …)를 프레임 이름으로 읽지 않도록 건너뛴다.
    keyPattern.lastIndex = frameDict.end;
    match = keyPattern.exec(framesDict);
  }

  const size = numbersIn(required(stringOfKey(metaDict, 'size'), 'metadata의 size'));
  return {
    entries,
    metadata: {
      format: Number(/<key>format<\/key>\s*<integer>(-?\d+)<\/integer>/.exec(metaDict)?.[1] ?? 0),
      textureFileName: required(
        stringOfKey(metaDict, 'textureFileName'),
        'metadata의 textureFileName',
      ),
      textureSize: { width: size[0], height: size[1] },
    },
  };
}

/** 프레임 이름의 형태. 번호는 두 자리 이상이고 나머지 셋에는 밑줄이 없다. */
const FRAME_NAME_PATTERN = /^([A-Za-z0-9]+)_([A-Za-z0-9]+)_([A-Za-z0-9]+)_(\d{2,})$/;

/**
 * `frameName`이 만든 이름을 도로 가른다.
 *
 * 검사가 층 · 동작 · 방향으로 묶어 세려면 이름에서 그 셋을 되읽어야 한다. 게임과 작성기가 쓰는
 * 규칙이 하나이므로 되읽기도 같은 자리에 둔다.
 *
 * @returns 규칙에 안 맞으면 `null`
 */
export function parseFrameName(name: string): IFrameNameParts | null {
  const match = FRAME_NAME_PATTERN.exec(name);
  if (match === null) return null;
  return { layer: match[1], action: match[2], facing: match[3], index: Number(match[4]) };
}

/**
 * 들어간 항목의 원본 크기가 규격인지 본다.
 *
 * 게임은 층마다 같은 원본 캔버스를 같은 48×96 상자에 넣어 겹친다. 한 층만 원본 크기가 다르면
 * 그 층이 몸에서 어긋나는데, 그림 자체는 멀쩡해서 눈으로는 「무기가 좀 뜬다」로만 읽힌다.
 *
 * @param spec 기대 캔버스. `PLAYER_FRAME_SPEC`을 그대로 넘긴다
 */
export function checkSourceSizes(entries: readonly IAtlasEntry[], spec: ISize): string[] {
  const problems: string[] = [];
  for (const item of entries) {
    if (item.sourceSize.width === spec.width && item.sourceSize.height === spec.height) continue;
    problems.push(
      `${item.name}의 원본 크기가 ${item.sourceSize.width}×${item.sourceSize.height}인데 ` +
        `${spec.width}×${spec.height}를 기대했다`,
    );
  }
  return problems;
}

/**
 * (동작, 방향)마다 층별 프레임 수가 같은지 본다.
 *
 * 층마다 수가 다르면 동기화 컴포넌트가 같은 번호를 찾지 못해 그 층만 직전 프레임에 멈춘 채
 * 나머지가 걷는다. 굽기 폴더가 아니라 **게임에 들어간 이름 목록**으로 재야, 실제로 실린 것이
 * 검사 대상이 된다.
 */
export function checkFrameCounts(names: readonly string[]): string[] {
  const problems: string[] = [];
  const byCombo = new Map<string, Map<string, number>>();

  for (const name of names) {
    const parts = parseFrameName(name);
    if (parts === null) {
      problems.push(`이름 규칙에 안 맞는 프레임이다: ${name}`);
      continue;
    }
    const combo = `${parts.action}|${parts.facing}`;
    const byLayer = byCombo.get(combo) ?? new Map<string, number>();
    byLayer.set(parts.layer, (byLayer.get(parts.layer) ?? 0) + 1);
    byCombo.set(combo, byLayer);
  }

  for (const [combo, byLayer] of byCombo) {
    const counts = [...byLayer.values()];
    if (Math.max(...counts) === Math.min(...counts)) continue;
    const [action, facing] = combo.split('|');
    const detail = [...byLayer].map(([layer, count]) => `${layer} ${count}장`).join(' · ');
    problems.push(`(${action}, ${facing})의 층별 프레임 수가 다르다 — ${detail}`);
  }
  return problems;
}
