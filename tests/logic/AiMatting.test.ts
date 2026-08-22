/**
 * 스프라이트 판정 수치의 명세.
 *
 * 배경 제거를 fal 매팅으로 옮기면서 「이 PNG가 규격을 지키는가」를 눈이 아니라 숫자가
 * 판정하게 만든다. 여기 있는 단언이 그 숫자의 정의다 — 어느 알파 대역을 세는지, 경계값을
 * 어느 쪽에 넣는지가 곧 판정 결과이므로 합성 픽스처로 못 박는다.
 *
 * 경계값을 특히 조심한다. 알파 16과 17이 갈리는 자리가 「희미한 알파」와 「반투명」을
 * 가르는데, 앞은 Cocos의 Trim을 무효로 만드는 잡음이고 뒤는 매팅이 머리카락 경계에서
 * 만들어 내는 값이다. 한 칸 어긋나면 성질이 정반대인 두 대역이 섞여, 잡음을 뱉는 모델과
 * 경계를 잘 딴 모델이 같은 점수로 보인다.
 *
 * 판정 함수가 PNG를 모르게 두는 이유는 디코딩과 판정이 같이 낡지 않게 하기 위해서다.
 * 판정은 RGBA 배열만 받고, 파일을 읽는 것은 `decodePng` 하나로 좁힌다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng, encodePng } from '../../tools/art/PngCodec';
import { alignToCanvas, footCenterX, normalizeAlpha } from '../../tools/art/Postprocess';
import { cropColumns, panelColumns } from '../../tools/art/SheetCrop';
import {
  alphaHistogram,
  backgroundLeak,
  edgeHalo,
  footLineY,
  type IRgbaImage,
  readPngSize,
  residualBackgroundRgb,
  trimBox,
} from '../helpers/SpriteMetrics';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * 헤더 읽기를 실제 PNG로 확인할 표본 한 장.
 *
 * **산출물 13장을 파일로 검사하는 절은 여기 없다.** 이 슬라이스는 파이프라인과 판정만
 * 세우고 에셋을 갈아 끼우지 않기로 했기 때문이다(2026-08-22 사용자 결정) — 원본 시트에
 * 지팡이가 그려져 있어, 지금 뽑으면 지팡이가 구워진 몸이 나온다. 지팡이 없는 시트를
 * 뽑는 슬라이스가 그 검사까지 함께 들고 간다.
 */
const SAMPLE_PNG = 'game/assets/art/player/player_4dir_front.png';

/**
 * 픽셀 목록으로 작은 RGBA 이미지를 만든다.
 * @param width 가로 픽셀 수
 * @param pixels `[r, g, b, a]` 네 칸씩 이어 붙인 목록. 길이가 `width`의 배수여야 한다
 */
function image(width: number, pixels: number[]): IRgbaImage {
  const height = pixels.length / 4 / width;
  return { width, height, data: Uint8Array.from(pixels) };
}

/** 알파 하나짜리 픽셀 — 색은 판정에 안 쓰는 자리에 채운다. */
function px(alpha: number): number[] {
  return [10, 20, 30, alpha];
}

describe('alphaHistogram — 알파를 성질이 다른 네 대역으로 가른다', () => {
  it('0 / 1~16 / 17~254 / 255를 각각 센다', () => {
    const img = image(6, [...px(0), ...px(1), ...px(16), ...px(17), ...px(254), ...px(255)]);

    expect(alphaHistogram(img)).toEqual({
      transparent: 1,
      faint: 2,
      semi: 2,
      opaque: 1,
    });
  });

  it('경계값 16은 희미한 알파이고 17은 반투명이다', () => {
    expect(alphaHistogram(image(1, px(16))).faint).toBe(1);
    expect(alphaHistogram(image(1, px(16))).semi).toBe(0);
    expect(alphaHistogram(image(1, px(17))).faint).toBe(0);
    expect(alphaHistogram(image(1, px(17))).semi).toBe(1);
  });
});

describe('trimBox — Cocos의 Trim이 잘라낼 상자', () => {
  it('알파가 0보다 큰 픽셀만 감싼다', () => {
    const img = image(4, [
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(255),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0),
    ]);

    expect(trimBox(img)).toEqual({ x: 1, y: 2, width: 1, height: 1 });
  });

  it('알파 1짜리 잡음 한 점도 상자를 캔버스까지 벌린다', () => {
    const img = image(3, [
      ...px(1),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(255),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(1),
    ]);

    expect(trimBox(img)).toEqual({ x: 0, y: 0, width: 3, height: 3 });
  });

  it('전부 투명하면 null이다', () => {
    expect(trimBox(image(2, [...px(0), ...px(0)]))).toBeNull();
  });
});

describe('backgroundLeak — 스프라이트 안에 남은 배경색', () => {
  const BG: [number, number, number] = [177, 176, 176];

  it('배경색에 가까우면서 불투명한 픽셀만 센다', () => {
    const img = image(4, [
      177,
      176,
      176,
      255, // 배경색 그대로 + 불투명 → 샌 것
      177,
      176,
      176,
      100, // 배경색이지만 반투명 → 경계 안티에일리어싱이라 세지 않는다
      0,
      0,
      0,
      255, // 배경색에서 멀다 → 정상 전경
      170,
      170,
      170,
      255, // 거리 약 10 → 임계값 12 안이라 샌 것
    ]);

    expect(backgroundLeak(img, BG, { maxDistance: 12, minAlpha: 200 })).toBe(2);
  });

  it('맨살 시트의 회색 옷은 정상 전경인데도 이 지표에 잡힌다', () => {
    // 배경과 색이 가까운 옷을 그린 시트가 실제로 있다. 그래서 이 수치는 「배경 잔여」가
    // 아니라 「배경색과 구별되지 않는 불투명 픽셀」이고, 모델 게이트는 이 값이 0인지가
    // 아니라 현행 대비 유지되는지를 본다. 0을 요구하면 옷을 뚫은 모델이 이긴다.
    const graySweatsuit = image(2, [176, 176, 176, 255, 176, 176, 176, 255]);

    expect(backgroundLeak(graySweatsuit, BG, { maxDistance: 12, minAlpha: 200 })).toBe(2);
  });
});

describe('residualBackgroundRgb — 알파 0 픽셀에 남은 색', () => {
  it('완전 투명한 픽셀의 RGB 평균과 무채색 비율을 낸다', () => {
    const img = image(3, [
      120,
      120,
      120,
      0,
      100,
      100,
      100,
      0,
      200,
      10,
      10,
      255, // 불투명 → 이 통계에서 제외된다
    ]);

    expect(residualBackgroundRgb(img)).toEqual({
      count: 2,
      mean: [110, 110, 110],
      achromaticRatio: 1,
    });
  });

  it('정리를 마친 스프라이트는 알파 0 픽셀의 RGB가 검정이다', () => {
    const cleaned = image(2, [0, 0, 0, 0, 0, 0, 0, 255]);

    expect(residualBackgroundRgb(cleaned).mean).toEqual([0, 0, 0]);
  });
});

describe('footLineY — 네 방향을 잇는 기준선', () => {
  it('알파가 있는 가장 아래 행의 y를 낸다', () => {
    const img = image(2, [
      ...px(0),
      ...px(0),
      ...px(255),
      ...px(0),
      ...px(0),
      ...px(3), // 알파 3도 픽셀이다 — 발 밑선은 임계값을 걸기 전에 잰다
      ...px(0),
      ...px(0),
    ]);

    expect(footLineY(img)).toBe(2);
  });

  it('전부 투명하면 null이다', () => {
    expect(footLineY(image(1, px(0)))).toBeNull();
  });
});

describe('readPngSize — 디코딩 없이 헤더만 읽는다', () => {
  it('IHDR에서 가로·세로를 읽는다', () => {
    const bytes = fs.readFileSync(path.join(ROOT, SAMPLE_PNG));

    expect(readPngSize(bytes)).toEqual({ width: 246, height: 493 });
  });

  it('PNG 서명이 아니면 던진다', () => {
    expect(() => readPngSize(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8]))).toThrow();
  });
});

describe('decodePng · encodePng — 포맷을 아는 유일한 자리', () => {
  it('실제 PNG를 헤더와 같은 크기의 RGBA로 푼다', () => {
    // 헤더만 읽는 `readPngSize`와 전량 디코딩이 같은 답을 내야, 둘을 섞어 써도 안전하다.
    const bytes = fs.readFileSync(path.join(ROOT, SAMPLE_PNG));
    const img = decodePng(bytes);

    expect({ width: img.width, height: img.height }).toEqual(readPngSize(bytes));
    expect(img.data.length).toBe(img.width * img.height * 4);
  });

  it('구웠다 다시 풀면 픽셀이 그대로다', () => {
    const img = image(2, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

    expect(decodePng(encodePng(img))).toEqual(img);
  });

  it('RGBA 길이가 캔버스와 안 맞으면 던진다', () => {
    expect(() => encodePng({ width: 2, height: 2, data: new Uint8Array(4) })).toThrow();
  });
});

describe('panelColumns — 시트를 인물별로 가르는 열 구간', () => {
  /** 배경색으로 채운 시트에 지정한 열 구간만 전경색으로 세운다. */
  function sheet(width: number, bands: Array<[number, number]>): IRgbaImage {
    const height = 4;
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data.set([177, 176, 176, 255], i * 4);
    }
    for (const [from, to] of bands) {
      for (let y = 0; y < height; y++) {
        for (let x = from; x <= to; x++) {
          data.set([20, 30, 40, 255], (y * width + x) * 4);
        }
      }
    }
    return { width, height, data };
  }

  it('배경만 있는 열을 경계로 인물 구간을 찾는다', () => {
    const img = sheet(20, [
      [2, 5],
      [10, 14],
    ]);

    expect(panelColumns(img, { background: [177, 176, 176], maxDistance: 12 })).toEqual([
      { from: 2, to: 5 },
      { from: 10, to: 14 },
    ]);
  });

  it('균등 분할을 가정하지 않는다 — 폭이 서로 다른 구간도 그대로 낸다', () => {
    const img = sheet(24, [
      [1, 2],
      [8, 16],
      [20, 21],
    ]);

    expect(panelColumns(img, { background: [177, 176, 176], maxDistance: 12 })).toEqual([
      { from: 1, to: 2 },
      { from: 8, to: 16 },
      { from: 20, to: 21 },
    ]);
  });

  it('배경 잡음 한 픽셀짜리 열은 구간을 쪼개지 않는다', () => {
    // 생성 시트의 배경은 완전한 단색이 아니라 약한 잡음이 있다. 잡음 한 점을 인물로 읽으면
    // 구간이 잘게 쪼개져 패널 수가 넷이 아니라 수십 개로 나온다.
    const img = sheet(12, [[3, 8]]);
    img.data.set([20, 30, 40, 255], (0 * 12 + 10) * 4);

    expect(
      panelColumns(img, { background: [177, 176, 176], maxDistance: 12, minColumnPixels: 2 }),
    ).toEqual([{ from: 3, to: 8 }]);
  });
});

describe('cropColumns — 찾은 구간을 패널 이미지로 떼어 낸다', () => {
  it('지정한 열 범위만 잘라 낸다', () => {
    const img = image(4, [
      ...px(1),
      ...px(2),
      ...px(3),
      ...px(4),
      ...px(5),
      ...px(6),
      ...px(7),
      ...px(8),
    ]);

    const panel = cropColumns(img, { from: 1, to: 2 });

    expect(panel.width).toBe(2);
    expect(panel.height).toBe(2);
    expect([...panel.data].filter((_, i) => i % 4 === 3)).toEqual([2, 3, 6, 7]);
  });

  it('요청한 구간이 캔버스를 벗어나면 던진다', () => {
    const img = image(2, [...px(1), ...px(2)]);

    expect(() => cropColumns(img, { from: 0, to: 5 })).toThrow();
  });

  it('여백을 주면 구간 바깥으로 넓혀 자른다', () => {
    // `panelColumns`가 내는 구간은 「전경 픽셀이 기준 개수 이상인 열」의 범위라, 인물의
    // 가장 바깥 한두 열(전경 1~2px짜리 머리카락 끝)이 구간 밖에 남는다. 실제 시트에서
    // 여덟 경계 중 셋이 그랬다. 여백 없이 자르면 그 열이 잘리고, 매팅이 알파를 조금 넓혀
    // 놓기 때문에 결과가 패널 끝에 딱 붙어 투명 여백이 0인 채로 나온다.
    const img = image(6, [...px(1), ...px(2), ...px(3), ...px(4), ...px(5), ...px(6)]);

    const panel = cropColumns(img, { from: 2, to: 3 }, { margin: 1 });

    expect(panel.width).toBe(4);
    expect([...panel.data].filter((_, i) => i % 4 === 3)).toEqual([2, 3, 4, 5]);
  });

  it('여백이 캔버스를 넘으면 캔버스에서 멈춘다', () => {
    const img = image(4, [...px(1), ...px(2), ...px(3), ...px(4)]);

    const panel = cropColumns(img, { from: 0, to: 3 }, { margin: 5 });

    expect(panel.width).toBe(4);
  });
});

describe('edgeHalo — 윤곽에 배경색이 섞인 띠가 둘러졌는지 잰다', () => {
  const BG: [number, number, number] = [177, 176, 176];

  /** 한 행짜리 이미지 — 왼쪽부터 색을 나열한다. */
  function row(colors: Array<[number, number, number]>): IRgbaImage {
    const data = new Uint8Array(colors.length * 4);
    colors.forEach((c, i) => {
      data.set([...c, 255], i * 4);
    });
    return { width: colors.length, height: 1, data };
  }

  const DARK: [number, number, number] = [60, 40, 30];
  const MIXED: [number, number, number] = [150, 145, 143];

  it('가장자리가 안쪽보다 배경색에 가까우면 후광으로 센다', () => {
    const img = row([MIXED, DARK, DARK, DARK, DARK, DARK]);

    expect(edgeHalo(img, BG).left.haloRows).toBe(1);
  });

  it('가장자리와 안쪽이 같은 색이면 후광이 아니다', () => {
    const img = row([DARK, DARK, DARK, DARK, DARK, DARK]);

    expect(edgeHalo(img, BG).left.haloRows).toBe(0);
  });

  it('오른쪽 윤곽만 후광이어도 잡는다', () => {
    // 2026-08-22에 이 지표가 놓친 실패다. 왼쪽만 재던 판은 `birefnet`이 오른쪽 윤곽에
    // 배경 회색을 알파 230으로 구워 놓은 것을 통과시켰다 — 왼쪽만 보면 0.8%였고
    // 오른쪽은 56%였다. 한쪽만 재는 지표는 실패의 절반을 구조적으로 못 본다.
    const img = row([DARK, DARK, DARK, DARK, DARK, MIXED]);
    const halo = edgeHalo(img, BG);

    expect(halo.left.haloRows).toBe(0);
    expect(halo.right.haloRows).toBe(1);
  });

  it('잴 수 있는 행이 없으면 양쪽 다 비율이 0이다', () => {
    const empty = { rows: 0, haloRows: 0, ratio: 0 };

    expect(edgeHalo(image(1, px(0)), BG)).toEqual({ left: empty, right: empty });
  });
});

describe('normalizeAlpha — 매팅 결과를 규격으로 누른다', () => {
  it('희미한 알파를 0으로 누르고 그 자리 색까지 지운다', () => {
    const img = image(2, [200, 100, 50, 9, 10, 20, 30, 255]);

    const out = normalizeAlpha(img);

    expect([...out.data.slice(0, 4)]).toEqual([0, 0, 0, 0]);
    expect([...out.data.slice(4)]).toEqual([10, 20, 30, 255]);
  });

  it('거의 불투명한 알파를 255로 올린다', () => {
    // `bria`는 내부를 255가 아니라 254로 내놓는다. 흐린 매트가 아니라 양자화 어긋남이라
    // 그대로 두면 스프라이트 전체가 아주 살짝 투명한 채로 출하된다.
    const img = image(2, [10, 20, 30, 254, 10, 20, 30, 253]);

    const out = normalizeAlpha(img, { opaqueFrom: 254 });

    expect(out.data[3]).toBe(255);
    expect(out.data[7]).toBe(253);
  });

  it('원본을 건드리지 않는다', () => {
    const img = image(1, [200, 100, 50, 9]);

    normalizeAlpha(img);

    expect(img.data[3]).toBe(9);
  });
});

describe('footCenterX — 캐릭터가 실제로 서 있는 가로 위치', () => {
  it('가장 아래 몇 줄의 불투명 픽셀 중심을 낸다', () => {
    // 머리카락이 비대칭이라 트림 상자 중심은 쓸 수 없다. 발은 캐릭터가 실제로 딛는 자리다.
    const img = image(6, [
      ...px(255),
      ...px(255),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0), // 머리카락이 왼쪽으로 쏠린 줄
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(255),
      ...px(255),
      ...px(0), // 발이 있는 줄
    ]);

    expect(footCenterX(img, 1)).toBe(3.5);
  });

  it('불투명 픽셀이 없으면 null이다', () => {
    expect(footCenterX(image(2, [...px(0), ...px(0)]), 1)).toBeNull();
  });
});

describe('alignToCanvas — 네 방향을 같은 캔버스·같은 발 밑선에 세운다', () => {
  it('발 밑선을 지정한 여백 위에 놓고 발 중심을 가로 중앙에 맞춘다', () => {
    const img = image(4, [
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(0),
      ...px(255),
      ...px(0),
      ...px(0),
    ]);

    const out = alignToCanvas(img, { width: 5, height: 6, bottomMargin: 1 });

    expect(out.width).toBe(5);
    expect(out.height).toBe(6);
    // 발 밑선은 y = 6 - 1 - 1 = 4, 발 중심은 x = 2로 옮겨진다.
    expect(out.data[(4 * 5 + 2) * 4 + 3]).toBe(255);
  });

  it('캐릭터가 캔버스보다 크면 던진다', () => {
    const img = image(4, [...px(255), ...px(255), ...px(255), ...px(255)]);

    expect(() => alignToCanvas(img, { width: 2, height: 2, bottomMargin: 0 })).toThrow();
  });
});
