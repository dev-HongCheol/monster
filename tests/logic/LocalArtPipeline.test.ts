/**
 * 로컬 파이프라인 게이트가 재는 값의 명세.
 *
 * 게이트 셋이 각각 다른 실패를 잡고, 그 판정이 전부 여기 있는 함수로 내려간다. 어느 값을
 * 어떻게 세는지가 곧 게이트의 통과 여부이므로 합성 픽스처로 못 박는다.
 *
 * **왜 알파가 아니라 색으로 전경을 잡는가.** 기존 `trimBox`·`footLineY`는 알파를 보는데,
 * 갓 생성한 PNG는 배경 위에 통짜로 불투명하다. 그대로 재면 네 장 모두 상자가 캔버스 전체이고
 * 발 밑선이 맨 아랫줄이라 **게이트가 공허하게 통과한다.** 배경 제거가 이 슬라이스 범위 밖이라
 * 알파를 만들 수단이 없으므로, 재는 동안만 배경색과의 거리로 전경을 잡는다. 색 키잉을 매팅에
 * 쓰는 것은 2026-08-20에 폐기됐지만 **재는 것은 다르다** — 매팅은 인물을 뚫으면 그림이
 * 망가지고, 측정은 몇 px 어긋나도 4% 허용차 판정을 안 바꾼다.
 *
 * 판정 함수가 PNG를 모르게 두는 규약은 `AiMatting.test.ts`가 세운 것을 그대로 따른다 —
 * RGBA 배열만 받고 파일 읽기는 `decodePng` 하나로 좁힌다. 그래서 픽스처 PNG가 필요 없다.
 */

import { describe, expect, it } from 'vitest';
import {
  chromaBox,
  type IRgbaImage,
  maskedRegionDelta,
  viewGeometrySpread,
} from '../helpers/SpriteMetrics';

/**
 * 픽셀 목록으로 작은 RGBA 이미지를 만든다.
 * @param width 가로 픽셀 수
 * @param pixels `[r, g, b, a]` 네 칸씩 이어 붙인 목록. 길이가 `width * 4`의 배수여야 한다
 */
function image(width: number, pixels: number[]): IRgbaImage {
  const height = pixels.length / 4 / width;
  return { width, height, data: Uint8Array.from(pixels) };
}

/** 불투명 회색 한 픽셀. 배경 자리를 채울 때 쓴다. */
const BG = [128, 128, 128, 255];
/** 불투명 살색 한 픽셀. 전경 자리를 채울 때 쓴다. */
const FG = [230, 190, 170, 255];

/** 같은 픽셀을 `n`번 이어 붙인다. */
function repeat(px: number[], n: number): number[] {
  return Array.from({ length: n }, () => px).flat();
}

describe('maskedRegionDelta — 마스크 밖이 원본 그대로인가', () => {
  // 게이트 2가 이 값 하나로 판정한다. 0이 아니면 뺄셈으로 파츠를 뗄 수 없다.

  it('마스크 밖이 완전히 같으면 다른 픽셀이 0이다', () => {
    const a = image(2, [...BG, ...BG, ...BG, ...BG]);
    const b = image(2, [...BG, ...BG, ...BG, ...BG]);
    // 알파 255가 「모델이 칠해도 되는 자리」다. 여기서는 아무 데도 안 열었다.
    const mask = image(2, repeat([0, 0, 0, 0], 4));

    expect(maskedRegionDelta(a, b, mask).differing).toBe(0);
  });

  it('마스크 밖에서 한 픽셀이 다르면 개수와 좌표를 준다', () => {
    const a = image(2, [...BG, ...BG, ...BG, ...BG]);
    // (1, 1)만 다르다.
    const b = image(2, [...BG, ...BG, ...BG, ...FG]);
    const mask = image(2, repeat([0, 0, 0, 0], 4));

    const delta = maskedRegionDelta(a, b, mask);

    expect(delta.differing).toBe(1);
    expect(delta.firstAt).toEqual({ x: 1, y: 1 });
  });

  it('마스크 안이 달라진 것은 세지 않는다', () => {
    // 마스크 안은 그리라고 연 자리다. 여기가 안 바뀌면 오히려 인페인팅이 안 돈 것이다.
    const a = image(2, [...BG, ...BG, ...BG, ...BG]);
    const b = image(2, [...FG, ...FG, ...BG, ...BG]);
    const mask = image(2, [
      ...[255, 255, 255, 255],
      ...[255, 255, 255, 255],
      ...[0, 0, 0, 0],
      ...[0, 0, 0, 0],
    ]);

    expect(maskedRegionDelta(a, b, mask).differing).toBe(0);
  });

  it('알파만 다른 픽셀도 다른 것으로 센다', () => {
    // RGB가 같아도 알파가 다르면 합성 결과가 달라진다. 「같다」의 기준은 네 채널 전부다.
    const a = image(1, [...BG]);
    const b = image(1, [128, 128, 128, 254]);
    const mask = image(1, [0, 0, 0, 0]);

    expect(maskedRegionDelta(a, b, mask).differing).toBe(1);
  });

  it('세 이미지의 크기가 다르면 던진다', () => {
    // 크기가 어긋난 채로 0을 돌려주면 「얼렸다」는 거짓 통과가 된다.
    const a = image(2, [...BG, ...BG]);
    const b = image(1, [...BG]);
    const mask = image(2, repeat([0, 0, 0, 0], 2));

    // 메시지까지 거는 이유: 맨 `toThrow()`는 「함수가 없다」는 TypeError도 통과로 받아,
    // 구현 전에 초록불이 켜져 정작 재려던 동작을 안 재게 된다.
    expect(() => maskedRegionDelta(a, b, mask)).toThrow(/크기/);
  });
});

describe('chromaBox — 배경색과의 거리로 전경 상자를 잡는다', () => {
  // 알파가 없는 생성 원본을 재기 위한 것이다. 알파가 있으면 기존 `trimBox`를 쓴다.

  it('배경색만 있는 이미지는 상자가 없다', () => {
    const img = image(2, repeat(BG, 4));

    expect(chromaBox(img, { r: 128, g: 128, b: 128 }, 12)).toBeNull();
  });

  it('배경과 먼 픽셀 하나를 감싸는 최소 상자를 준다', () => {
    // (1, 0) 한 곳만 전경이다.
    const img = image(2, [...BG, ...FG, ...BG, ...BG]);

    expect(chromaBox(img, { r: 128, g: 128, b: 128 }, 12)).toEqual({
      x: 1,
      y: 0,
      width: 1,
      height: 1,
    });
  });

  it('허용치 안의 미세한 차이는 배경으로 본다', () => {
    // 생성물의 배경은 완전한 단색이 아니다. 그 얼룩을 전경으로 세면 상자가 캔버스가 된다.
    const img = image(2, [...BG, ...[132, 128, 128, 255], ...BG, ...BG]);

    expect(chromaBox(img, { r: 128, g: 128, b: 128 }, 12)).toBeNull();
  });

  it('허용치는 포함 경계다 — 거리가 정확히 허용치면 배경이다', () => {
    // 경계값을 어느 쪽에 넣는지가 판정을 뒤집으므로 못 박는다.
    const atLimit = image(1, [140, 128, 128, 255]); // 거리 12
    const overLimit = image(1, [141, 128, 128, 255]); // 거리 13
    const bg = { r: 128, g: 128, b: 128 };

    expect(chromaBox(atLimit, bg, 12)).toBeNull();
    expect(chromaBox(overLimit, bg, 12)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});

describe('viewGeometrySpread — 네 뷰가 서로 얼마나 어긋나는가', () => {
  // 개별 View 생성은 한 시트가 주던 상호 참조를 버린다. 그 자리를 이 값이 메운다.

  /** 상자 하나를 짧게 적는다. */
  const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

  it('네 상자가 같으면 편차가 전부 0이다', () => {
    const spread = viewGeometrySpread([
      box(0, 0, 100, 400),
      box(0, 0, 100, 400),
      box(0, 0, 100, 400),
      box(0, 0, 100, 400),
    ]);

    expect(spread.height).toBe(0);
    expect(spread.width).toBe(0);
    expect(spread.aspect).toBe(0);
    expect(spread.footLine).toBe(0);
  });

  it('세로가 하나만 다르면 그 비율이 세로 편차로 나온다', () => {
    // 400 대 380 → 최대 대비 5%.
    const spread = viewGeometrySpread([
      box(0, 0, 100, 400),
      box(0, 0, 100, 400),
      box(0, 0, 100, 400),
      box(0, 20, 100, 380),
    ]);

    expect(spread.height).toBeCloseTo(0.05, 5);
  });

  it('세로와 가로가 같은 비율로 커지면 종횡비 편차는 0이다', () => {
    // 균일 확대는 체형이 같다. 종횡비가 그것을 세로 편차와 갈라 준다.
    const spread = viewGeometrySpread([
      box(0, 0, 100, 400),
      box(0, 0, 110, 440),
      box(0, 0, 100, 400),
      box(0, 0, 100, 400),
    ]);

    expect(spread.aspect).toBeCloseTo(0, 5);
    expect(spread.height).toBeCloseTo(0.1, 5);
  });

  it('가로만 벌어지면 종횡비 편차가 잡는다', () => {
    // 세로와 발 밑선만 재면 통과해 버리는 드리프트다. 체형이 다른 인물이 섞인 것이다.
    const spread = viewGeometrySpread([
      box(0, 0, 100, 400),
      box(0, 0, 120, 400),
      box(0, 0, 100, 400),
      box(0, 0, 100, 400),
    ]);

    expect(spread.width).toBeCloseTo(0.2, 5);
    expect(spread.aspect).toBeCloseTo(0.2, 5);
  });

  it('발 밑선 편차는 비율이 아니라 픽셀 수다', () => {
    // 정렬은 평행 이동으로 맞추는 값이라 비율로 재면 뜻이 없다. 몇 px 어긋났는지가 필요하다.
    const spread = viewGeometrySpread([
      box(0, 0, 100, 400), // 발 밑선 400
      box(0, 0, 100, 400),
      box(0, 3, 100, 400), // 발 밑선 403
      box(0, 0, 100, 400),
    ]);

    expect(spread.footLine).toBe(3);
  });

  it('네 장이 아니면 던진다', () => {
    // 방향은 넷이다. 세 장으로 판정하면 빠진 방향이 조용히 통과한다.
    expect(() => viewGeometrySpread([box(0, 0, 100, 400)])).toThrow(/네 장/);
  });
});
