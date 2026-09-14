/**
 * 3D 마스터에서 구운 걷기 프레임이 게임에 실릴 자격이 있는지 재는 판정의 명세.
 *
 * 이 슬라이스는 Blender에서 프레임을 굽고 Cocos에서 재생해 본다. 굽는 쪽은 파이썬이고
 * 파이썬은 타입체크·lint·vitest 어디에도 안 걸리므로, **판정은 전부 TS에 둔다.** 여기 있는
 * 단언이 그 판정의 정의다.
 *
 * 가장 중요한 단언은 「이웃 프레임이 서로 다른가」다. 렌더 루프에서 프레임 번호 갱신을
 * 빠뜨리면 여덟 장이 전부 같은 그림으로 나오는데, 파일도 알파도 정상이라 나머지 검사를
 * 전부 통과한다. 그러면 Cocos에서는 「안 움직인다」로 보여 사람이 재생 설정·Trim·레이어를
 * 뒤지게 되고, 정작 원인은 굽는 쪽에 있다.
 *
 * **재는 순서가 판정을 바꾼다.** `footLineY`와 `trimBox`는 알파를 `> 0`으로 재도록 짜여
 * 있고 임계값 인자가 없다 — 네 방향 정렬에서 발끝 안티앨리어싱을 살려야 했기 때문이다.
 * 그 함수들을 안티앨리어싱이 그대로 남은 원본에 대고 부르면 발 밑선이 발이 아니라 알파
 * 1~3짜리 술의 최하단이 된다. 그래서 `frameSetIntegrity`는 `normalizeAlpha`를 지난 사본에
 * 대고 재고, 두 함수의 시그니처는 건드리지 않는다(건드리면 `AiMatting.test.ts`가 회귀한다).
 *
 * 실제 렌더가 아니라 합성 픽셀로 도는 이유는 `AiMatting.test.ts`와 같다 — 실물 판정은
 * 실행기가 하고, 벤치는 판정의 정의만 든다. 그래야 렌더 결과 없이도 이 테스트가 성립한다.
 *
 * 같은 파일이 **비교 시트**의 명세도 든다. 게이트 1(화풍)은 사람이 시트 한 장을 보고 판정하는데,
 * 시트의 작은 칸이 게임 화면과 다르게 그려지면 그 판정은 게임에 없는 그림을 보고 내린 것이 된다.
 * 그래서 작은 칸을 만드는 축소가 엔진과 같은 결과를 내는지를 여기서 단언한다.
 */

import { describe, expect, it } from 'vitest';
import {
  composeGrid,
  compositeOver,
  maskRect,
  sampleLikeEngine,
} from '../../tools/blender/ComparisonSheet';
import { frameSetIntegrity, PLAYER_FRAME_SPEC } from '../helpers/FrameSet';
import { NO_GATE_LINE, parseGateLine } from '../helpers/GateLine';
import type { IRgbaImage } from '../helpers/SpriteMetrics';

/** 테스트 캔버스 가로. 실제 출하 규격은 `PLAYER_FRAME_SPEC`이 든다. */
const W = 8;
/** 테스트 캔버스 세로. */
const H = 10;

/**
 * 픽셀마다 알파를 받아 합성 프레임을 만든다.
 * @param alphaAt `(x, y)`에 넣을 알파. 색은 판정에 안 쓰는 자리에 채운다
 */
function frame(
  width: number,
  height: number,
  alphaAt: (x: number, y: number) => number,
): IRgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = 10;
      data[i + 1] = 20;
      data[i + 2] = 30;
      data[i + 3] = alphaAt(x, y);
    }
  }
  return { width, height, data };
}

/**
 * 가로 띠 하나만 있는 프레임 — 발 밑선과 불투명 픽셀 수를 따로 정할 수 있다.
 *
 * 띠의 y가 곧 발 밑선이고 띠의 길이가 곧 불투명 픽셀 수다. 두 값을 독립으로 쥐어야
 * 「발 밑선은 맞는데 프레임이 안 바뀐 경우」와 그 반대를 갈라 시험할 수 있다.
 *
 * @param bottomY 띠가 놓일 줄 — 이 값이 발 밑선이 된다
 * @param pixels 띠의 길이 — 이 값이 불투명 픽셀 수가 된다
 * @param alpha 띠의 알파. 기본 255
 */
function bar(bottomY: number, pixels: number, alpha = 255): IRgbaImage {
  return frame(W, H, (x, y) => (y === bottomY && x < pixels ? alpha : 0));
}

/** 규격을 지킨 네 장. 발 밑선 8·8·7·8, 불투명 픽셀 3·4·5·6이라 이웃이 모두 다르다. */
function goodFrames(): IRgbaImage[] {
  return [bar(8, 3), bar(8, 4), bar(7, 5), bar(8, 6)];
}

/** 위 네 장에 맞춘 기대값. 허용 폭 2라 발 밑선은 6~8이 통과한다. */
const EXPECTED = {
  count: 4,
  width: W,
  height: H,
  footLineY: 8,
  footLineTolerance: 2,
} as const;

describe('PLAYER_FRAME_SPEC — 프레임이 서야 하는 캔버스와 발 밑선', () => {
  it('캔버스 246×493에 발 밑선 489이다', () => {
    // 2026-08-07 실측으로 닫힌 값이고 출하된 4방향 넷이 이미 그 규격에 서 있다. 3D에서 구운
    // 프레임이 같은 자리에 서지 않으면 게임 안에서 캐릭터가 바닥을 뚫거나 떠오른다.
    expect(PLAYER_FRAME_SPEC).toEqual({ width: 246, height: 493, footLineY: 489 });
  });
});

describe('frameSetIntegrity — 프레임 세트가 규격을 지키는가', () => {
  it('규격을 지킨 세트는 위반이 없다', () => {
    expect(frameSetIntegrity(goodFrames(), EXPECTED).problems).toEqual([]);
  });

  it('프레임별 실측을 돌려준다 — 판정이 떨어져도 사람이 읽을 값이다', () => {
    const report = frameSetIntegrity(goodFrames(), EXPECTED);

    expect(report.frames).toEqual([
      { index: 0, opaquePixels: 3, footLineY: 8 },
      { index: 1, opaquePixels: 4, footLineY: 8 },
      { index: 2, opaquePixels: 5, footLineY: 7 },
      { index: 3, opaquePixels: 6, footLineY: 8 },
    ]);
  });

  it('프레임 수가 기대와 다르면 잡고, 두 숫자를 메시지에 담는다', () => {
    const report = frameSetIntegrity(goodFrames().slice(0, 3), { ...EXPECTED, count: 4 });

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('3');
    expect(report.problems[0]).toContain('4');
  });

  it('캔버스가 다른 프레임 한 장을 잡는다', () => {
    const frames = goodFrames();
    frames[2] = frame(W + 1, H, (x, y) => (y === 8 && x < 5 ? 255 : 0));

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('2');
  });

  it('빈 프레임을 잡는다', () => {
    const frames = goodFrames();
    frames[1] = frame(W, H, () => 0);

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.problems.some((p) => p.includes('1'))).toBe(true);
  });

  it('희미한 알파만 있는 프레임도 빈 프레임으로 잡는다', () => {
    // 이 단언이 임계값의 이유다. 알파를 `> 0`으로 재면 알파 1짜리 먼지가 한 점 있는 프레임이
    // 「내용이 있다」로 통과하고, 게임에서는 아무것도 안 보인다. `normalizeAlpha`의 기준값
    // 16 이하는 전부 0으로 눌러 놓고 세야 한다.
    const frames = goodFrames();
    frames[1] = bar(8, 4, 16);

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.frames[1]).toEqual({ index: 1, opaquePixels: 0, footLineY: null });
    expect(report.problems.some((p) => p.includes('1'))).toBe(true);
  });

  it('임계값 바로 위(17)는 내용으로 센다', () => {
    const frames = goodFrames();
    frames[1] = bar(8, 4, 17);

    expect(frameSetIntegrity(frames, EXPECTED).problems).toEqual([]);
  });

  it('이웃 프레임의 불투명 픽셀 수가 같으면 잡는다', () => {
    // 렌더 루프가 프레임 번호를 안 올리면 여덟 장이 같은 그림으로 나온다. 파일 수도 알파도
    // 캔버스도 정상이라 다른 검사가 전부 통과하는데, 그 결과는 Cocos에서 「안 움직인다」로
    // 보여 원인을 재생 설정 쪽에서 찾게 만든다.
    const frames = [bar(8, 3), bar(8, 4), bar(8, 4), bar(8, 6)];

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('1');
    expect(report.problems[0]).toContain('2');
  });

  it('이웃이 아닌 두 프레임이 같은 픽셀 수인 것은 잡지 않는다', () => {
    // 걷기는 주기 운동이라 떨어진 두 프레임이 같은 실루엣으로 돌아오는 것이 정상이다.
    const frames = [bar(8, 3), bar(8, 4), bar(7, 5), bar(8, 3)];

    expect(frameSetIntegrity(frames, EXPECTED).problems).toEqual([]);
  });

  it('발 밑선이 기준보다 아래로 내려가면 잡는다', () => {
    const frames = goodFrames();
    frames[2] = bar(9, 5);

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('9');
  });

  it('발 밑선이 허용 폭보다 위로 떠오르면 잡는다', () => {
    const frames = goodFrames();
    frames[2] = bar(5, 5);

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('5');
  });

  it('허용 폭의 경계는 통과시킨다', () => {
    const frames = goodFrames();
    frames[2] = bar(6, 5);

    expect(frameSetIntegrity(frames, EXPECTED).problems).toEqual([]);
  });

  it('세트가 통째로 다른 높이에 서 있으면 전부 잡는다', () => {
    // 상대 편차로 재면 이 세트가 통과한다 — 프레임끼리는 완벽하게 맞기 때문이다. 그래서
    // 기준을 절대값으로 잡는다.
    const frames = [bar(3, 3), bar(3, 4), bar(3, 5), bar(3, 6)];

    expect(frameSetIntegrity(frames, EXPECTED).problems).toHaveLength(4);
  });

  it('발 아래 희미한 알파가 번져 있어도 발 밑선이 밀리지 않는다', () => {
    // 안티앨리어싱 술을 원본에 대고 재면 발 밑선이 술의 최하단으로 내려간다. 여기서는 발이
    // 8에 있고 9에 알파 3짜리 술이 있으므로, 임계값을 안 걸면 9로 읽혀 위 「기준보다 아래」
    // 위반이 된다 — 정상 렌더가 게이트에 걸리는 거짓 실패다.
    const frames = goodFrames();
    frames[2] = frame(W, H, (x, y) => {
      if (y === 7 && x < 5) return 255;
      if (y === 9 && x < 5) return 3;
      return 0;
    });

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.frames[2]).toEqual({ index: 2, opaquePixels: 5, footLineY: 7 });
    expect(report.problems).toEqual([]);
  });

  it('빈 세트는 프레임 수 위반 하나로만 보고한다', () => {
    const report = frameSetIntegrity([], EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.frames).toEqual([]);
  });
});

describe('parseGateLine — 기계가 읽는 한 줄을 stdout에서 고른다', () => {
  it('GATE_OK 줄의 JSON을 payload로 준다', () => {
    const out = parseGateLine('GATE_OK {"frames": 8, "canvas": "246x493"}');

    expect(out).toEqual({ ok: true, payload: { frames: 8, canvas: '246x493' } });
  });

  it('Blender가 뒤에 자기 종료 로그를 찍어도 고른다', () => {
    // 마지막 줄로 읽으면 여기서 틀린다. Blender는 스크립트가 끝난 뒤에도 자기 로그를 더
    // 찍으므로, 뒤에서부터 `GATE_` 줄을 찾아야 한다.
    const stdout = [
      'Read prefs: ...',
      'GATE_OK {"frames": 8}',
      'Info: Saved ...',
      'Blender quit',
    ].join('\n');

    expect(parseGateLine(stdout)).toEqual({ ok: true, payload: { frames: 8 } });
  });

  it('GATE_ 줄이 여럿이면 마지막 것을 쓴다', () => {
    const stdout = ['GATE_OK {"frames": 8}', 'GATE_FAIL render-path 출력 경로에 쓸 수 없다'].join(
      '\n',
    );

    expect(parseGateLine(stdout)).toEqual({
      ok: false,
      code: 'render-path',
      message: '출력 경로에 쓸 수 없다',
    });
  });

  it('GATE_FAIL의 코드와 메시지를 가른다', () => {
    const out = parseGateLine('GATE_FAIL blender-version 기대 4.2~5.2, 지금 4.1.2');

    expect(out).toEqual({
      ok: false,
      code: 'blender-version',
      message: '기대 4.2~5.2, 지금 4.1.2',
    });
  });

  it('GATE_ 줄이 하나도 없으면 실패로 접는다', () => {
    // 종료 코드를 믿을 수 없는 경로가 실제로 있다. EEVEE가 컨텍스트를 못 잡아 Blender가
    // 시그널로 죽으면 `--python-exit-code`도 `try/except`도 발화하지 않으므로, 그 실행은
    // 성공처럼 보이면서 산출물이 없다.
    const out = parseGateLine('Read prefs: ...\nBlender quit\n');

    expect(out).toEqual({ ok: false, code: NO_GATE_LINE, message: expect.any(String) });
  });

  it('빈 stdout도 같은 실패로 접는다', () => {
    expect(parseGateLine('')).toMatchObject({ ok: false, code: NO_GATE_LINE });
  });

  it('GATE_OK의 JSON이 깨졌으면 성공으로 읽지 않는다', () => {
    const out = parseGateLine('GATE_OK {frames: 8');

    expect(out).toMatchObject({ ok: false });
  });

  it('GATE_OK에 payload가 없으면 성공으로 읽지 않는다', () => {
    expect(parseGateLine('GATE_OK')).toMatchObject({ ok: false });
  });

  it('CRLF로 와도 파싱한다', () => {
    // 이 프로젝트는 Windows에서 Blender를 돌린다. `\r`을 줄 안에 남기면 JSON 끝에 그것이
    // 붙어 파싱이 깨지고, 그 실패가 「판정 줄이 없다」와 구별되지 않는다.
    const stdout = 'Read prefs: ...\r\nGATE_OK {"frames": 8}\r\nBlender quit\r\n';

    expect(parseGateLine(stdout)).toEqual({ ok: true, payload: { frames: 8 } });
  });

  it('줄 앞뒤 공백은 무시한다', () => {
    expect(parseGateLine('   GATE_OK {"frames": 8}   ')).toEqual({
      ok: true,
      payload: { frames: 8 },
    });
  });

  it('줄 가운데 나온 GATE_ 문자열은 고르지 않는다', () => {
    // 파이썬 트레이스백이 판정 줄을 인용하는 경우가 있다. 그것을 판정으로 읽으면 실패한
    // 실행이 성공으로 보고된다.
    const stdout = 'Traceback: printed GATE_OK {"frames": 8} earlier\nBlender quit';

    expect(parseGateLine(stdout)).toMatchObject({ ok: false, code: NO_GATE_LINE });
  });
});

/**
 * 픽셀마다 RGBA를 받아 합성 이미지를 만든다. 위 `frame`은 색을 고정하고 알파만 다루므로, 색이
 * 결과에 들어가는 비교 시트 단언은 이것을 쓴다.
 * @param rgbaAt `(x, y)`에 넣을 `[r, g, b, a]`
 */
function image(
  width: number,
  height: number,
  rgbaAt: (x: number, y: number) => readonly number[],
): IRgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(rgbaAt(x, y), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** 가로 한 줄짜리 불투명 회색 이미지. 값 하나가 픽셀 하나의 밝기다. */
function grayRow(values: readonly number[]): IRgbaImage {
  return image(values.length, 1, (x) => [values[x], values[x], values[x], 255]);
}

/** 빨강 채널을 행 우선으로 편다 — 회색 이미지의 밝기를 한 줄로 견주려는 것이다. */
function reds(img: IRgbaImage): number[] {
  const out: number[] = [];
  for (let i = 0; i < img.data.length; i += 4) out.push(img.data[i]);
  return out;
}

/** `(x, y)` 픽셀의 `[r, g, b, a]`. */
function pixel(img: IRgbaImage, x: number, y: number): number[] {
  const i = (y * img.width + x) * 4;
  return Array.from(img.data.subarray(i, i + 4));
}

describe('sampleLikeEngine — 게임이 텍스처를 줄이는 방식을 그대로 흉내 낸다', () => {
  it('같은 크기면 원본과 같다', () => {
    const src = image(3, 2, (x, y) => [x * 40, y * 90, 7, 200]);

    expect(sampleLikeEngine(src, 3, 2)).toEqual(src);
  });

  it('정확히 절반으로 줄이면 이웃 두 텍셀을 평균한다', () => {
    expect(reds(sampleLikeEngine(grayRow([0, 100, 200, 50]), 2, 1))).toEqual([50, 125]);
  });

  it('밉맵이 없어서 많이 줄이면 사이의 텍셀을 아예 읽지 않는다', () => {
    // 이 동작이 720p 칸을 따로 두는 이유다. 화면 픽셀 하나마다 텍셀을 넷만 읽으므로, 네 배로
    // 줄이면 텍셀 넷 중 가운데 둘만 읽히고 바깥 둘은 결과에 전혀 들어가지 않는다. 그래서 1텍셀
    // 두께의 외곽선이나 하이라이트는 게임 크기에서 통째로 사라지거나, 걸을 때 읽히는 자리에
    // 들어왔다 나갔다 하며 깜빡인다. 화질 좋은 축소는 이 선을 흐리게라도 남겨 결함을 가린다.
    const lineAtEdge = grayRow([255, 0, 0, 0, 0, 0, 0, 0]);
    const lineInside = grayRow([0, 255, 0, 0, 0, 0, 0, 0]);

    expect(reds(sampleLikeEngine(lineAtEdge, 2, 1))).toEqual([0, 0]);
    expect(reds(sampleLikeEngine(lineInside, 2, 1))).toEqual([128, 0]);
  });

  it('캔버스 밖을 읽을 때는 가장자리 텍셀을 늘려 쓴다', () => {
    // 출하 텍스처의 `.meta`가 clamp-to-edge다. 반복(repeat)으로 흉내 내면 캐릭터 발끝 줄에
    // 반대편 머리 꼭대기 줄이 섞여 들어온다.
    expect(reds(sampleLikeEngine(grayRow([0, 200]), 4, 1))).toEqual([0, 50, 150, 200]);
  });

  it('알파를 곱하지 않은 채 보간해서, 투명한 이웃의 색이 가장자리에 섞여 들어온다', () => {
    // 엔진은 색과 알파를 따로 보간한다. 그래서 투명 픽셀에 남아 있는 색이 검정이면, 흰 픽셀과
    // 그 투명 픽셀 사이를 읽은 결과는 색이 절반으로 어두워진 반투명이 된다. 게임 화면의 윤곽에
    // 생기는 어두운 테두리가 이것이고, 시트에서 이것을 빼면 게임에 있는 결함을 판정에서 못 본다.
    const src = image(2, 1, (x) => (x === 0 ? [255, 255, 255, 255] : [0, 0, 0, 0]));

    expect(pixel(sampleLikeEngine(src, 1, 1), 0, 0)).toEqual([128, 128, 128, 128]);
  });
});

describe('compositeOver — 엔진의 알파 블렌딩으로 배경 위에 얹는다', () => {
  it('불투명 픽셀은 그대로, 투명 픽셀은 배경색이 되고 결과는 전부 불투명이다', () => {
    const src = image(2, 1, (x) => (x === 0 ? [10, 20, 30, 255] : [99, 99, 99, 0]));

    const out = compositeOver(src, [200, 150, 100]);

    expect(pixel(out, 0, 0)).toEqual([10, 20, 30, 255]);
    expect(pixel(out, 1, 0)).toEqual([200, 150, 100, 255]);
  });

  it('반투명 픽셀은 알파 비율로 배경과 섞는다', () => {
    // 위 보간 테스트의 결과(색 128 · 알파 128)를 흰 배경에 얹은 값이다. 흰 윤곽이 흰 배경
    // 위에서 191로 어두워지므로, 보간에서 생긴 어두운 테두리가 합성을 지나도 시트에 남는다.
    const src = image(1, 1, () => [128, 128, 128, 128]);

    expect(pixel(compositeOver(src, [255, 255, 255]), 0, 0)).toEqual([191, 191, 191, 255]);
  });
});

describe('maskRect — 판정에서 뺄 자리를 불투명 색으로 덮는다', () => {
  it('사각형 안만 덮고 원본은 건드리지 않는다', () => {
    const src = image(3, 3, () => [1, 2, 3, 0]);

    const out = maskRect(src, { x: 1, y: 1, width: 2, height: 1 }, [50, 60, 70]);

    expect(pixel(out, 1, 1)).toEqual([50, 60, 70, 255]);
    expect(pixel(out, 2, 1)).toEqual([50, 60, 70, 255]);
    expect(pixel(out, 0, 1)).toEqual([1, 2, 3, 0]);
    expect(pixel(out, 1, 0)).toEqual([1, 2, 3, 0]);
    expect(pixel(src, 1, 1)).toEqual([1, 2, 3, 0]);
  });

  it('사각형이 캔버스를 벗어나면 캔버스 크기를 말하며 던진다', () => {
    // 얼굴 자리는 원본 PNG마다 손으로 잰 상수다. 원본을 다시 구워 캔버스가 달라졌는데 상수를
    // 안 고치면, 잘라서 덮는 쪽은 얼굴 일부가 드러난 시트를 조용히 내놓는다. 멈춰야 그 시트로
    // 판정하는 일이 없다.
    const src = image(3, 3, () => [0, 0, 0, 0]);

    expect(() => maskRect(src, { x: 2, y: 0, width: 2, height: 1 }, [0, 0, 0])).toThrow(/3×3/);
  });
});

describe('composeGrid — 칸을 표로 붙여 시트 한 장을 만든다', () => {
  const A = image(2, 3, () => [10, 0, 0, 255]);
  const B = image(1, 1, () => [20, 0, 0, 255]);
  const C = image(1, 2, () => [30, 0, 0, 255]);
  const D = image(3, 1, () => [40, 0, 0, 255]);
  const opts = { gap: 1, background: [0, 0, 0] as const };

  it('열 너비와 행 높이는 그 줄에서 가장 큰 칸이 정하고, 칸 사이와 바깥에 간격을 둔다', () => {
    const out = composeGrid(
      [
        [A, B],
        [C, D],
      ],
      opts,
    );

    // 열 너비 2·3과 행 높이 3·2에 간격이 가로세로 셋씩 붙는다.
    expect([out.width, out.height]).toEqual([8, 8]);
  });

  it('칸을 열 가운데에 두고 행 바닥에 붙인다', () => {
    // 바닥에 붙이는 이유는 같은 행의 칸 크기가 다를 때 두 캐릭터의 발을 같은 줄에 세우기
    // 위해서다. 위아래 가운데로 두면 발이 서로 다른 높이에 서서, 크기와 무게감을 나란히
    // 견주기 어려워진다.
    const out = composeGrid(
      [
        [A, B],
        [C, D],
      ],
      opts,
    );

    // B는 둘째 열(x 4~6)의 가운데 x=5, 첫 행(y 1~3)의 바닥 y=3에 선다.
    expect(pixel(out, 5, 3)).toEqual([20, 0, 0, 255]);
    expect(pixel(out, 5, 2)).toEqual([0, 0, 0, 255]);
    expect(pixel(out, 4, 3)).toEqual([0, 0, 0, 255]);
  });
});
