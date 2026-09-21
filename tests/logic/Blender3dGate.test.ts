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
  buildAtlas,
  checkFrameCounts,
  checkSourceSizes,
  frameName,
  packShelves,
  parseFrameName,
  parsePlist,
  restoreFrame,
  writePlist,
} from '../../tools/blender/Atlas';
import {
  CHOSEN_PITCH,
  CHOSEN_WEAPONS,
  OUTLINE_WIDTH_M,
  STAFF_ORB,
  WEAPON_TOON,
} from '../../tools/blender/BakeSpec';
import {
  composeGrid,
  compositeOver,
  layerOver,
  maskRect,
  occlusionDelta,
  pixelDiff,
  sampleLikeEngine,
} from '../../tools/blender/ComparisonSheet';
import {
  actionFrames,
  alphaOverlap,
  atlasGroups,
  BAKE_FACINGS,
  BAKE_LAYERS,
  bakeDefinition,
  bakeMotionArgs,
  bakeStamp,
  bakeToon,
  bodyCanvasWidth,
  centerOnCanvas,
  definitionHash,
  fitCamera,
  gearFollow,
  type IBakeInputs,
  type ICameraPose,
  type IGearFrame,
  layerBakeJobs,
  layerCanvas,
  layerSetCheck,
  layerSource,
  projectRow,
  referenceBakeJobs,
  STACK_ORDER,
  stackOrder,
  stackVerdict,
  staleReasons,
} from '../../tools/blender/LayerBake';
import { type IModelDump, matchModels } from '../../tools/blender/ModelMatch';
import {
  bump,
  CHOSEN_GAIT,
  CHOSEN_MOTION,
  gaitFrame,
  hipsLift,
  IDLE_BAKED,
  IDLE_PLAYBACK,
  type IGaitSpec,
  idleFrame,
  legAngles,
  legPoints,
  mergedPhases,
  PLAYER_LEG_RIG,
  samplePhases,
  standFrame,
  stepLength,
} from '../../tools/blender/MotionSpec';
import {
  frameSetCheck,
  frameSetIntegrity,
  PLAYER_FRAME_SPEC,
  unionRowCheck,
} from '../helpers/FrameSet';
import { BAD_GATE_PAYLOAD, NO_GATE_LINE, parseGateLine } from '../helpers/GateLine';
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

/** 테스트 프레임의 머리 꼭대기 줄. `EXPECTED.headLineY`와 같다. */
const HEAD_Y = 1;

/**
 * 가로 띠 하나와 머리 점 하나가 있는 프레임 — 발 밑선과 불투명 픽셀 수를 따로 정할 수 있다.
 *
 * 띠의 y가 곧 발 밑선이고, 불투명 픽셀 수는 띠의 길이에 머리 점 하나를 더한 값이다. 두 값을
 * 독립으로 쥐어야 「발 밑선은 맞는데 프레임이 안 바뀐 경우」와 그 반대를 갈라 시험할 수 있다.
 * 머리 점은 오른쪽 끝 열에 두어 띠와 겹치지 않게 했고, 이 점이 세트의 머리 꼭대기 행이 된다.
 *
 * @param bottomY 띠가 놓일 줄 — 이 값이 발 밑선이 된다
 * @param pixels 띠의 길이 — 불투명 픽셀 수는 이 값에 머리 점 하나를 더한 것이다
 * @param alpha 띠와 머리 점의 알파. 기본 255
 * @param headY 머리 점이 놓일 줄. 기본 `HEAD_Y`
 */
function bar(bottomY: number, pixels: number, alpha = 255, headY = HEAD_Y): IRgbaImage {
  return frame(W, H, (x, y) =>
    (y === bottomY && x < pixels) || (y === headY && x === W - 1) ? alpha : 0,
  );
}

/**
 * 규격을 지킨 네 장. 발 밑선 8·8·7·8, 띠 길이 3·4·5·6이라 이웃과 루프 이음새(넷째 장과
 * 첫째 장)가 모두 다르다.
 */
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
  headLineY: HEAD_Y,
} as const;

describe('PLAYER_FRAME_SPEC — 프레임이 서야 하는 캔버스와 발 밑선·머리 행', () => {
  it('캔버스 246×493에 발 밑선 489, 머리 꼭대기 2이다', () => {
    // 캔버스와 발 밑선은 2026-08-07 실측으로 닫힌 값이고 출하된 4방향 넷이 이미 그 규격에 서
    // 있다. 3D에서 구운 프레임이 같은 자리에 서지 않으면 게임 안에서 캐릭터가 바닥을 뚫거나
    // 떠오른다. 머리 꼭대기 2는 출하된 정면 그림을 알파 정리 뒤에 잰 값이고, 여기서 벗어나면
    // 같은 48×96 상자에 들어가는 3D 인물이 출하 아트보다 작거나 크게 보인다.
    expect(PLAYER_FRAME_SPEC).toEqual({ width: 246, height: 493, footLineY: 489, headLineY: 2 });
  });
});

describe('frameSetIntegrity — 프레임 세트가 규격을 지키는가', () => {
  it('규격을 지킨 세트는 위반이 없다', () => {
    expect(frameSetIntegrity(goodFrames(), EXPECTED).problems).toEqual([]);
  });

  it('프레임별 실측을 돌려준다 — 판정이 떨어져도 사람이 읽을 값이다', () => {
    const report = frameSetIntegrity(goodFrames(), EXPECTED);

    expect(report.frames).toEqual([
      { index: 0, opaquePixels: 4, footLineY: 8, topLineY: HEAD_Y },
      { index: 1, opaquePixels: 5, footLineY: 8, topLineY: HEAD_Y },
      { index: 2, opaquePixels: 6, footLineY: 7, topLineY: HEAD_Y },
      { index: 3, opaquePixels: 7, footLineY: 8, topLineY: HEAD_Y },
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
    // 캔버스가 다른 장은 이웃 판정이 견주지 않고 다른 그림으로 넘긴다. 잰 자리가 서로 다른
    // 픽셀을 가리키기 때문이다. 그래서 여기서 잡히는 위반은 캔버스 하나뿐이다.
    frames[2] = frame(W + 1, H, (x, y) => (y === 8 && x < 6 ? 255 : 0));

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

    expect(report.frames[1]).toEqual({
      index: 1,
      opaquePixels: 0,
      footLineY: null,
      topLineY: null,
    });
    expect(report.problems.some((p) => p.includes('1'))).toBe(true);
  });

  it('임계값 바로 위(17)는 내용으로 센다', () => {
    const frames = goodFrames();
    frames[1] = bar(8, 4, 17);

    expect(frameSetIntegrity(frames, EXPECTED).problems).toEqual([]);
  });

  it('이웃 프레임이 같은 그림이면 잡는다', () => {
    // 렌더 루프가 프레임 번호를 안 올리면 여덟 장이 같은 그림으로 나온다. 파일 수도 알파도
    // 캔버스도 정상이라 다른 검사가 전부 통과하는데, 그 결과는 Cocos에서 「안 움직인다」로
    // 보여 원인을 재생 설정 쪽에서 찾게 만든다.
    const frames = [bar(8, 3), bar(8, 4), bar(8, 4), bar(8, 6)];

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('1');
    expect(report.problems[0]).toContain('2');
  });

  it('이웃이 아닌 두 프레임이 같은 그림인 것은 잡지 않는다', () => {
    // 걷기는 주기 운동이라 떨어진 두 프레임이 같은 실루엣으로 돌아오는 것이 정상이다. 첫째 장과
    // 셋째 장이 픽셀까지 같고, 루프 이음새인 넷째 장과 첫째 장은 다르다.
    const frames = [bar(8, 3), bar(8, 4), bar(8, 3), bar(8, 6)];

    expect(frameSetIntegrity(frames, EXPECTED).problems).toEqual([]);
  });

  it('마지막 장과 첫 장이 같은 그림이면 잡는다 — 루프 이음새도 이웃이다', () => {
    // 클립은 Loop로 돌므로 마지막 장 다음에 첫 장이 온다. 샘플링이 한 주기의 끝 프레임까지 넣으면
    // 그 장이 첫 장과 같은 자세라, 재생이 이음새에서 한 박자 멈춘 것처럼 보인다. 이음새를 안 보면
    // 나머지 검사를 전부 통과한다.
    const frames = [bar(8, 3), bar(8, 4), bar(7, 5), bar(8, 3)];

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('3');
    expect(report.problems[0]).toContain('루프 이음새');
  });

  it('두 장짜리 세트는 이음새를 따로 보고하지 않는다 — 이음새가 곧 이웃 쌍이다', () => {
    const report = frameSetIntegrity([bar(8, 3), bar(8, 3)], { ...EXPECTED, count: 2 });

    expect(report.problems).toHaveLength(1);
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
    // 기준을 절대값으로 잡는다. 프레임마다 하나씩 넷에, 세트의 가장 낮은 발이 발 밑선에 안
    // 닿는다는 위반 하나가 더해진다.
    const frames = [bar(3, 3), bar(3, 4), bar(3, 5), bar(3, 6)];

    expect(frameSetIntegrity(frames, EXPECTED).problems).toHaveLength(5);
  });

  it('발 아래 희미한 알파가 번져 있어도 발 밑선이 밀리지 않는다', () => {
    // 안티앨리어싱 술을 원본에 대고 재면 발 밑선이 술의 최하단으로 내려간다. 여기서는 발이
    // 7에 있고 9에 알파 3짜리 술이 있으므로, 임계값을 안 걸면 9로 읽혀 위 「기준보다 아래」
    // 위반이 된다 — 정상 렌더가 게이트에 걸리는 거짓 실패다. 이웃 두 장과는 띠가 놓인 줄이
    // 달라 이웃 판정에도 안 걸린다.
    const frames = goodFrames();
    frames[2] = frame(W, H, (x, y) => {
      if (y === 7 && x < 6) return 255;
      if (y === 9 && x < 6) return 3;
      return 0;
    });

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.frames[2]).toEqual({ index: 2, opaquePixels: 6, footLineY: 7, topLineY: 7 });
    expect(report.problems).toEqual([]);
  });

  it('세트에서 가장 높이 뜬 머리가 머리 행에 안 닿으면 잡는다 — 인물이 작게 구워진 경우', () => {
    // 2026-09-14까지 구운 판이 이랬다. 카메라가 여백을 머리 위로 몰아 머리 꼭대기가 33행에서
    // 시작했고, 발 밑선은 489로 맞았으므로 발 밑선·빈 프레임·이웃 판정이 전부 통과했다. 게임은
    // 3D 프레임과 출하 아트를 같은 48×96 상자에 넣으므로 캔버스를 덜 채운 3D만 작게 보였다.
    const frames = [bar(8, 3, 255, 3), bar(8, 4, 255, 3), bar(7, 5, 255, 3), bar(8, 6, 255, 3)];

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('3');
    expect(report.problems[0]).toContain('작게');
  });

  it('가장 높이 뜬 머리가 머리 행보다 위에 있어도 잡는다 — 인물이 크게 구워진 경우', () => {
    const frames = [bar(8, 3, 255, 0), bar(8, 4), bar(7, 5), bar(8, 6)];

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('크게');
  });

  it('머리 행에서 한 줄 아래까지는 통과시킨다', () => {
    // 카메라는 가장 높은 점을 머리 행의 픽셀 중심에 놓는데, 그 점을 덮는 안티앨리어싱이 알파
    // 임계값을 못 넘으면 한 줄 아래가 머리 꼭대기로 잡힌다.
    const frames = [bar(8, 3, 255, 2), bar(8, 4, 255, 2), bar(7, 5, 255, 2), bar(8, 6, 255, 2)];

    expect(frameSetIntegrity(frames, EXPECTED).problems).toEqual([]);
  });

  it('머리가 가장 높이 뜬 한 장만 머리 행에 닿으면 된다', () => {
    // 카메라는 여덟 장을 합친 상자로 한 번만 잡는다. 걷기에서 머리가 오르내리므로 나머지 장은
    // 머리 행보다 몇 줄 아래에 서는 것이 정상이다.
    const frames = [bar(8, 3, 255, 4), bar(8, 4, 255, 4), bar(7, 5), bar(8, 6, 255, 4)];

    expect(frameSetIntegrity(frames, EXPECTED).problems).toEqual([]);
  });

  it('세트에서 가장 낮은 발이 발 밑선에 안 닿으면 잡는다', () => {
    // 프레임마다 보면 전부 허용 폭 안이다. 그래도 카메라는 가장 낮은 발을 발 밑선에 놓으므로,
    // 어느 장도 발 밑선에 닿지 않았다면 세트가 통째로 떠 있는 것이다.
    const frames = [bar(6, 3), bar(6, 4), bar(6, 5), bar(6, 6)];

    const report = frameSetIntegrity(frames, EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('6');
  });

  it('가장 낮은 발이 발 밑선에서 한 줄 위까지는 통과시킨다', () => {
    const frames = [bar(7, 3), bar(7, 4), bar(6, 5), bar(7, 6)];

    expect(frameSetIntegrity(frames, EXPECTED).problems).toEqual([]);
  });

  it('빈 세트는 프레임 수 위반 하나로만 보고한다', () => {
    const report = frameSetIntegrity([], EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.frames).toEqual([]);
  });
});

/**
 * 세트 검사에 거는 기대값 — 머리·발 합집합 행은 `UNION_EXPECTED`가 든다.
 *
 * 둘을 가른 이유는 층마다 거는 규칙이 달라서다. 상의·무기 층은 몸보다 작게 구워지고 방향에
 * 따라 통째로 비기도 하는 것이 정상이라, 몸 층에 거는 머리·발 행을 그대로 걸면 정상 렌더가
 * 떨어진다.
 */
const SET_EXPECTED = {
  count: 4,
  width: W,
  height: H,
  footLineY: 8,
  footLineTolerance: 2,
} as const;

/** 합집합 행 기대값. 테스트 프레임의 머리 점은 `HEAD_Y`, 발 밑선은 8이다. */
const UNION_EXPECTED = { headLineY: HEAD_Y, footLineY: 8 } as const;

/** 세트를 재서 실측만 꺼낸다 — 합집합 검사가 받는 모양이다. */
function measure(frames: readonly IRgbaImage[]) {
  return frameSetCheck(frames, SET_EXPECTED).frames;
}

/** 머리 점만 `headY`로 옮긴 규격 세트 — 합집합 판정을 갈라 시험하려는 것이다. */
function framesWithHead(headY: number): IRgbaImage[] {
  return [
    bar(8, 3, 255, headY),
    bar(8, 4, 255, headY),
    bar(7, 5, 255, headY),
    bar(8, 6, 255, headY),
  ];
}

describe('frameSetCheck — 세트 하나에 거는 검사', () => {
  it('규격을 지킨 세트는 위반이 없다', () => {
    expect(frameSetCheck(goodFrames(), SET_EXPECTED).problems).toEqual([]);
  });

  it('프레임별 실측을 돌려준다 — 합집합 검사가 이 값을 받는다', () => {
    expect(frameSetCheck(goodFrames(), SET_EXPECTED).frames).toEqual([
      { index: 0, opaquePixels: 4, footLineY: 8, topLineY: HEAD_Y },
      { index: 1, opaquePixels: 5, footLineY: 8, topLineY: HEAD_Y },
      { index: 2, opaquePixels: 6, footLineY: 7, topLineY: HEAD_Y },
      { index: 3, opaquePixels: 7, footLineY: 8, topLineY: HEAD_Y },
    ]);
  });

  it('머리·발 합집합 행은 보지 않는다', () => {
    // 세트가 통째로 작게 구워진 경우다. 래퍼는 몸 층 기준으로 이것을 잡아야 하고, 세트 검사는
    // 넘겨야 한다 — 같은 규칙을 상의·무기 층에 걸면 정상 렌더가 떨어지기 때문이다.
    const frames = framesWithHead(3);

    expect(frameSetCheck(frames, SET_EXPECTED).problems).toEqual([]);
    expect(frameSetIntegrity(frames, EXPECTED).problems).toHaveLength(1);
  });

  it('프레임별 발 밑선은 세트 검사가 본다 — 합집합 판정과 다른 규칙이다', () => {
    const frames = goodFrames();
    frames[2] = bar(9, 5);

    expect(frameSetCheck(frames, SET_EXPECTED).problems).toHaveLength(1);
  });
});

describe('이웃 판정 — 불투명 픽셀 수가 아니라 픽셀별 차이로 본다', () => {
  it('불투명 픽셀 수가 같아도 그림이 다르면 통과시킨다', () => {
    // 숨쉬기 대기가 이 경우다. 가슴이 오르내리기만 하는 두 장은 넓이가 같을 수 있는데, 수만
    // 비교하면 정상 대기가 「안 움직인다」로 떨어진다. 넓이가 같은 다른 자세도 마찬가지다.
    const frames = [bar(8, 3), bar(8, 4), bar(7, 4), bar(8, 6)];

    expect(frameSetCheck(frames, SET_EXPECTED).problems).toEqual([]);
  });

  it('픽셀까지 같은 이웃은 잡는다', () => {
    // 렌더 루프가 프레임 번호를 안 올리면 여덟 장이 같은 그림으로 나온다. 파일 수도 알파도
    // 캔버스도 정상이라 나머지 검사를 전부 통과하는데, Cocos에서는 「안 움직인다」로 보인다.
    const frames = [bar(8, 3), bar(8, 4), bar(8, 4), bar(8, 6)];

    const report = frameSetCheck(frames, SET_EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('1');
    expect(report.problems[0]).toContain('2');
  });

  it('임계값 이하로만 다른 이웃은 같은 그림으로 본다', () => {
    // 알파가 몇 단계 흔들린 것을 「움직였다」로 읽으면, 프레임 번호를 안 올린 굽기가 그 잡음
    // 하나로 통과한다. 여기서는 띠 전체가 알파 245라 255와 10만큼 다르다.
    const frames = [bar(8, 3), bar(8, 4), bar(8, 4, 245), bar(8, 6)];

    expect(frameSetCheck(frames, SET_EXPECTED).problems).toHaveLength(1);
  });

  it('임계값을 넘게 다르면 다른 그림으로 본다', () => {
    const frames = [bar(8, 3), bar(8, 4), bar(8, 4, 200), bar(8, 6)];

    expect(frameSetCheck(frames, SET_EXPECTED).problems).toEqual([]);
  });

  it('루프 이음새도 픽셀로 본다', () => {
    const frames = [bar(8, 3), bar(8, 4), bar(7, 5), bar(8, 3)];

    const report = frameSetCheck(frames, SET_EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('루프 이음새');
  });

  it('캔버스가 다른 이웃은 다른 그림으로 본다 — 위반을 겹쳐 보고하지 않는다', () => {
    const frames = goodFrames();
    frames[2] = frame(W + 1, H, (x, y) => (y === 8 && x < 4 ? 255 : 0));

    const report = frameSetCheck(frames, SET_EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('캔버스');
  });
});

describe('unionRowCheck — 여러 세트의 합집합에 머리·발 행을 건다', () => {
  it('한 세트만 머리 행에 닿아도 통과한다', () => {
    // 카메라는 네 방향 × 두 동작을 합친 상자로 한 번만 잡는다. 옆모습이 정면보다 머리가 낮게
    // 나오는 것은 정상이고, 합집합에서 가장 높은 머리 하나가 머리 행에 닿으면 된다.
    const sets = [measure(framesWithHead(4)), measure(goodFrames())];

    expect(unionRowCheck(sets, UNION_EXPECTED).problems).toEqual([]);
  });

  it('어느 세트도 머리 행에 안 닿으면 잡는다', () => {
    const sets = [measure(framesWithHead(3)), measure(framesWithHead(4))];

    const report = unionRowCheck(sets, UNION_EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('작게');
  });

  it('머리가 행보다 위로 올라가도 잡는다', () => {
    const report = unionRowCheck([measure(framesWithHead(0))], UNION_EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('크게');
  });

  it('어느 세트도 발 밑선에 안 닿으면 잡는다', () => {
    // 세트 검사는 프레임마다 허용 폭 안이라 통과시킨다. 그래도 카메라는 가장 낮은 발을 발
    // 밑선에 놓으므로, 세트를 합쳐도 닿지 않았다면 인물이 통째로 떠 있는 것이다.
    const floating = [bar(6, 3), bar(6, 4), bar(6, 5), bar(6, 6)];

    expect(frameSetCheck(floating, SET_EXPECTED).problems).toEqual([]);

    const report = unionRowCheck([measure(floating), measure(floating)], UNION_EXPECTED);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('6');
  });

  it('빈 실측만 오면 아무것도 보고하지 않는다', () => {
    // 빈 세트는 세트 검사가 프레임 수 위반으로 이미 보고했다. 여기서 또 적으면 같은 원인이
    // 두 줄로 늘어난다.
    expect(unionRowCheck([[]], UNION_EXPECTED).problems).toEqual([]);
  });
});

/** 아틀라스 단언용 — `(x, y)`에 흰 점 하나만 있고 나머지는 완전 투명인 프레임. */
function dot(x: number, y: number): IRgbaImage {
  return image(W, H, (px, py) => (px === x && py === y ? [255, 255, 255, 255] : [0, 0, 0, 0]));
}

/** 아틀라스 작성기의 기본 설정 — 칸 사이와 바깥에 2px, 가로 상한 64px. */
const PACK = { maxWidth: 64, padding: 2 } as const;

describe('frameName — 아틀라스 작성기와 게임이 같은 문자열을 만든다', () => {
  it('층 · 동작 · 방향 · 번호를 밑줄로 잇고 확장자를 안 붙인다', () => {
    // 이름 규칙이 작성기와 게임 두 곳에 사는데 Cocos 스크립트는 `game/assets` 밖을 import할 수
    // 없어 한 파일로 모을 수 없다. 그래서 두 쪽이 같은 문자열을 내는지를 단언으로 붙든다.
    expect(frameName('body', 'walk', 'front', 0)).toBe('body_walk_front_00');
  });

  it('번호는 두 자리로 채운다 — 에디터 목록에서 사전순이 번호순과 같아야 한다', () => {
    expect(frameName('staff', 'idle', 'left', 12)).toBe('staff_idle_left_12');
  });
});

describe('packShelves — 프레임을 줄 단위로 눕혀 담는다', () => {
  it('한 줄에 들어가면 가로로 잇고 칸 사이와 바깥에 패딩을 둔다', () => {
    const out = packShelves(
      [
        { width: 4, height: 3 },
        { width: 5, height: 2 },
      ],
      { maxWidth: 32, padding: 2 },
    );

    expect(out.placements).toEqual([
      { x: 2, y: 2 },
      { x: 8, y: 2 },
    ]);
  });

  it('줄이 넘치면 다음 선반으로 내리고, 선반 높이는 그 줄에서 가장 높은 칸이 정한다', () => {
    const out = packShelves(
      [
        { width: 10, height: 4 },
        { width: 10, height: 2 },
      ],
      { maxWidth: 16, padding: 2 },
    );

    expect(out.placements).toEqual([
      { x: 2, y: 2 },
      { x: 2, y: 8 },
    ]);
  });

  it('아틀라스 크기는 담은 칸과 패딩을 감싼다', () => {
    const out = packShelves(
      [
        { width: 10, height: 4 },
        { width: 10, height: 2 },
      ],
      { maxWidth: 16, padding: 2 },
    );

    expect([out.width, out.height]).toEqual([14, 12]);
  });
});

describe('buildAtlas — 트림해 담고 plist 항목을 만든다', () => {
  it('sourceSize는 원본 캔버스이고 회전은 하지 않는다', () => {
    // 게임은 층마다 246×493 캔버스를 같은 48×96 상자에 넣는다. sourceSize가 트림 크기로
    // 들어가면 층끼리 크기가 달라져 무기가 몸에서 떨어진다. 회전은 켜면 offset 해석이 한 겹
    // 늘어나는데 얻는 것이 없다.
    const atlas = buildAtlas([{ name: 'a', image: dot(3, 4) }], PACK);

    expect(atlas.entries[0].sourceSize).toEqual({ width: W, height: H });
    expect(atlas.entries[0].rotated).toBe(false);
    expect(atlas.entries[0].frame).toEqual({ x: 2, y: 2, width: 1, height: 1 });
  });

  it('offset은 원본 중심 대비 트림 상자 중심의 이동량이고 y는 위가 양수다', () => {
    // 캔버스 8×10의 중심은 (4, 5)이고 점 하나짜리 트림 상자의 중심은 (3.5, 4.5)라, 가로로 0.5
    // 왼쪽 · 세로로 0.5 위다. 렌더가 꼭짓점을 `offset + (원본 − 트림) / 2`로 잡으므로 부호를
    // 뒤집으면 판정은 통과하는데 게임 안 발치만 조용히 어긋난다.
    const atlas = buildAtlas([{ name: 'a', image: dot(3, 4) }], PACK);

    expect(atlas.entries[0].offset).toEqual({ x: -0.5, y: 0.5 });
  });

  it('희미한 알파는 트림 전에 눌러 없앤다', () => {
    // 알파 1짜리 먼지가 구석에 한 점 있으면 `> 0` 기준 트림 상자가 캔버스 전체가 되고, 아틀라스가
    // 투명 여백을 그대로 싣는다. 판정이 쓰는 기준값(16)과 같은 값으로 눌러야 둘이 갈리지 않는다.
    const dusty = image(W, H, (x, y) => {
      if (x === 3 && y === 4) return [255, 255, 255, 255];
      if (x === 0 && y === 0) return [9, 9, 9, 1];
      return [0, 0, 0, 0];
    });

    const atlas = buildAtlas([{ name: 'a', image: dusty }], PACK);

    expect(atlas.entries[0].frame).toEqual({ x: 2, y: 2, width: 1, height: 1 });
  });

  it('통째로 빈 프레임도 항목을 남긴다', () => {
    // 무기 층은 방향에 따라 통째로 비는 것이 정상이다(뒷모습에서 몸에 가려진 지팡이). 항목을
    // 빼면 게임이 그 이름을 못 찾아 직전 프레임을 붙든 채로 남는다.
    const atlas = buildAtlas([{ name: 'empty', image: image(W, H, () => [0, 0, 0, 0]) }], PACK);

    expect(atlas.entries[0].frame.width).toBe(1);
    expect(atlas.entries[0].frame.height).toBe(1);
    expect(atlas.entries[0].offset).toEqual({ x: 0, y: 0 });
  });

  it('가장자리 픽셀을 1px 바깥으로 늘려 둔다', () => {
    // 늘리지 않으면 축소 샘플링이 칸 경계에서 이웃의 투명 픽셀을 함께 읽어 윤곽이 반투명해진다.
    // 늘린 자리는 트림 상자 밖이라 plist 값과 왕복 복원에는 들어가지 않는다.
    const atlas = buildAtlas([{ name: 'a', image: dot(3, 4) }], PACK);
    const box = atlas.entries[0].frame;

    expect(pixel(atlas.image, box.x - 1, box.y)).toEqual([255, 255, 255, 255]);
  });

  it('여러 장을 담아도 이름과 자리가 하나씩 대응한다', () => {
    const atlas = buildAtlas(
      [
        { name: 'a', image: dot(1, 1) },
        { name: 'b', image: dot(6, 8) },
      ],
      PACK,
    );

    expect(atlas.entries.map((e) => e.name)).toEqual(['a', 'b']);
    expect(atlas.entries[0].frame).not.toEqual(atlas.entries[1].frame);
  });
});

describe('restoreFrame — 담은 것을 원본 캔버스로 되돌린다', () => {
  it('왕복하면 원본과 바이트가 같다', () => {
    // 이 단언이 offset 부호를 붙든다. 복원은 plist에 적은 값(frame · offset · sourceSize)만 보고
    // 계산하므로, 작성기가 부호를 틀리면 여기서 복원이 어긋난다.
    const src = image(W, H, (x, y) =>
      x >= 2 && x <= 4 && y >= 6 && y <= 8 ? [200, 100, 50, 200] : [0, 0, 0, 0],
    );

    const atlas = buildAtlas([{ name: 'a', image: src }], PACK);

    expect(restoreFrame(atlas.image, atlas.entries[0])).toEqual(src);
  });

  it('빈 프레임도 원래 캔버스로 되돌아온다', () => {
    const empty = image(W, H, () => [0, 0, 0, 0]);

    const atlas = buildAtlas([{ name: 'empty', image: empty }], PACK);

    expect(restoreFrame(atlas.image, atlas.entries[0])).toEqual(empty);
  });
});

/** plist 단언용 항목 하나. 값은 파서가 읽는 네 키를 모두 채운다. */
function entry(name: string, overrides: Partial<Parameters<typeof writePlist>[0][0]> = {}) {
  return {
    name,
    frame: { x: 2, y: 2, width: 10, height: 20 },
    offset: { x: -0.5, y: 1.5 },
    rotated: false,
    sourceSize: { width: 246, height: 493 },
    ...overrides,
  };
}

describe('writePlist — cocos2d 포맷 2로 적는다', () => {
  it('plist 머리말과 포맷 2, 텍스처 이름과 크기를 metadata에 담는다', () => {
    const xml = writePlist([entry('body_walk_front_00')], {
      textureFileName: 'player_body_walk.png',
      textureSize: { width: 64, height: 64 },
    });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<plist version="1.0">');
    expect(xml).toContain('<key>format</key><integer>2</integer>');
    expect(xml).toContain('<key>textureFileName</key><string>player_body_walk.png</string>');
    expect(xml).toContain('<key>size</key><string>{64,64}</string>');
  });

  it('frame · offset · sourceSize를 중괄호 형식으로 적고 공백을 넣지 않는다', () => {
    // 파서가 중괄호 한 겹과 쉼표로 나뉜 두 조각만 받고, 안쪽에 중괄호가 또 있으면 거부한다.
    // 형식이 어긋나면 값이 0으로 읽혀 프레임이 아틀라스 왼쪽 위에 겹쳐 그려진다.
    const xml = writePlist([entry('body_walk_front_00')], {
      textureFileName: 't.png',
      textureSize: { width: 64, height: 64 },
    });

    expect(xml).toContain('<key>frame</key><string>{{2,2},{10,20}}</string>');
    expect(xml).toContain('<key>offset</key><string>{-0.5,1.5}</string>');
    expect(xml).toContain('<key>sourceSize</key><string>{246,493}</string>');
    expect(xml).toContain('<key>rotated</key><false/>');
  });

  it('프레임 이름을 키로 쓴다', () => {
    const xml = writePlist([entry('staff_idle_left_03')], {
      textureFileName: 't.png',
      textureSize: { width: 8, height: 8 },
    });

    expect(xml).toContain('<key>staff_idle_left_03</key>');
  });
});

describe('parsePlist — 게임에 들어간 plist를 도로 읽는다', () => {
  it('왕복하면 적은 값이 그대로 나온다', () => {
    // 검사 명령이 읽는 것은 우리가 적은 문자열이 아니라 파일이다. 직렬화와 파싱이 같은 형식을
    // 쓰는지 여기서 붙들지 않으면, 검사 명령이 0으로 읽은 값을 통과시킨다.
    const entries = [entry('body_walk_front_00'), entry('body_walk_front_01')];

    const parsed = parsePlist(
      writePlist(entries, { textureFileName: 't.png', textureSize: { width: 64, height: 64 } }),
    );

    expect(parsed.entries).toEqual(entries);
    expect(parsed.metadata).toEqual({
      format: 2,
      textureFileName: 't.png',
      textureSize: { width: 64, height: 64 },
    });
  });

  it('frames가 없으면 무엇이 빠졌는지 말하며 던진다', () => {
    expect(() => parsePlist('<?xml version="1.0"?><plist><dict></dict></plist>')).toThrow(/frames/);
  });
});

describe('parseFrameName — 이름에서 층 · 동작 · 방향 · 번호를 되읽는다', () => {
  it('`frameName`이 만든 이름을 도로 가른다', () => {
    expect(parseFrameName(frameName('topA', 'walk', 'back', 7))).toEqual({
      layer: 'topA',
      action: 'walk',
      facing: 'back',
      index: 7,
    });
  });

  it('규칙에 안 맞는 이름은 null이다', () => {
    expect(parseFrameName('body_walk_front')).toBeNull();
    expect(parseFrameName('body_walk_front_xx')).toBeNull();
  });
});

describe('checkSourceSizes — 들어간 plist의 원본 크기가 그 층의 규격인가', () => {
  it('규격이면 위반이 없다', () => {
    expect(checkSourceSizes([entry('body_walk_front_00')], PLAYER_FRAME_SPEC)).toEqual([]);
  });

  it('다른 원본 크기를 이름과 실측으로 보고한다', () => {
    // 층이 선언한 캔버스와 다르면 그 층이 몸에서 어긋난다. 그림은 멀쩡해 보여서 눈으로는
    // 「무기가 좀 뜬다」로만 읽힌다.
    const problems = checkSourceSizes(
      [entry('staff_walk_front_00', { sourceSize: { width: 246, height: 400 } })],
      PLAYER_FRAME_SPEC,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('staff_walk_front_00');
    expect(problems[0]).toContain('400');
  });

  it('층이 더 큰 캔버스를 선언하면 그 크기를 기대한다', () => {
    // 몸보다 큰 무기 · 망토 · 날개가 이 자리를 쓴다. 굽기가 카메라를 층끼리 공유하므로 캔버스가
    // 넓어져도 인물 크기는 그대로다(2026-09-16 실측 — 246×493과 600×701에서 인물 트림 상자가
    // 둘 다 182×490이었다).
    const byLayer = { staff: { width: 600, height: 701 } };
    const entries = [
      entry('body_walk_front_00'),
      entry('staff_walk_front_00', { sourceSize: { width: 600, height: 701 } }),
    ];

    expect(checkSourceSizes(entries, PLAYER_FRAME_SPEC, byLayer)).toEqual([]);
  });

  it('선언한 층 캔버스가 기준보다 작으면 막는다', () => {
    const problems = checkSourceSizes([], PLAYER_FRAME_SPEC, {
      staff: { width: 200, height: 493 },
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('몸이 잘린다');
  });

  it('선언한 층 캔버스의 홀짝이 기준과 다르면 막는다', () => {
    // 캔버스 중심이 픽셀 격자에 놓이는 자리가 홀짝에 따라 반 칸 달라진다. 246×493 기준에서
    // 600×700은 세로가 0.5px 밀렸고 600×701은 정확히 맞았다(2026-09-16 실측).
    const problems = checkSourceSizes([], PLAYER_FRAME_SPEC, {
      staff: { width: 600, height: 700 },
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('홀짝');
  });

  it('이름 규칙에 안 맞는 프레임은 층을 못 고르므로 보고한다', () => {
    const problems = checkSourceSizes([entry('staff_walk_front')], PLAYER_FRAME_SPEC);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('이름 규칙');
  });
});

describe('checkFrameCounts — 층별 (방향, 동작) 프레임 수가 같은가', () => {
  it('모든 층이 같은 수면 위반이 없다', () => {
    const names = ['body', 'staff'].flatMap((layer) =>
      [0, 1].map((i) => frameName(layer, 'walk', 'front', i)),
    );

    expect(checkFrameCounts(names)).toEqual([]);
  });

  it('한 층만 수가 모자라면 그 조합과 두 수를 보고한다', () => {
    // 층마다 프레임 수가 다르면 동기화 컴포넌트가 같은 번호를 찾지 못해, 그 층만 직전 프레임에
    // 멈춘 채로 나머지가 걷는다.
    const names = [
      ...[0, 1, 2].map((i) => frameName('body', 'walk', 'front', i)),
      ...[0, 1].map((i) => frameName('staff', 'walk', 'front', i)),
    ];

    const problems = checkFrameCounts(names);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('walk');
    expect(problems[0]).toContain('front');
    expect(problems[0]).toContain('3');
    expect(problems[0]).toContain('2');
  });

  it('규칙에 안 맞는 이름은 따로 보고한다', () => {
    const problems = checkFrameCounts(['body_walk_front_00', 'wrong-name']);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('wrong-name');
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

  it('GATE_FAIL에 실패 코드가 없으면 판정 줄이 깨진 것으로 본다', () => {
    // 코드를 빈 문자열로 돌려주면 실행기가 README의 실패 코드 표에서 찾을 것이 없어, 사람이
    // 무엇이 안 됐는지 알 길이 없다. 판정 줄 자체가 깨진 것으로 보고한다.
    expect(parseGateLine('GATE_FAIL')).toMatchObject({ ok: false, code: BAD_GATE_PAYLOAD });
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

  it('세로로 줄여도 가로와 같은 규칙이다', () => {
    // 플레이어 칸은 세로가 가로의 두 배라 세로 축소가 더 크다. 가로 테스트만 있으면 세로 좌표를
    // 가로 크기로 나누는 실수가 정사각형이 아닌 입력에서만 드러나는데, 그런 입력이 테스트에 없다.
    const column = image(1, 4, (_, y) => {
      const v = [0, 100, 200, 50][y];
      return [v, v, v, 255];
    });

    expect(reds(sampleLikeEngine(column, 1, 2))).toEqual([50, 125]);
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

  it('크기가 0인 사각형도 던진다', () => {
    // 크기 0은 캔버스 안에 있어도 아무것도 안 덮는다. 상수를 잘못 옮겨 적은 것인데 조용히
    // 통과하면 얼굴이 드러난 시트가 나온다.
    const src = image(3, 3, () => [0, 0, 0, 0]);

    expect(() => maskRect(src, { x: 1, y: 1, width: 0, height: 1 }, [0, 0, 0])).toThrow();
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

  it('행마다 칸 수가 달라도 열 너비는 칸이 있는 행이 정하고 빈 칸은 배경으로 남긴다', () => {
    const out = composeGrid([[A, B], [C]], opts);

    // 열 너비 2·1과 행 높이 3·2에 간격이 가로세로 셋씩 붙는다.
    expect([out.width, out.height]).toEqual([6, 8]);
    // 둘째 행(y 5~6)의 둘째 열(x 4)에는 칸이 없다.
    expect(pixel(out, 4, 6)).toEqual([0, 0, 0, 255]);
    expect(pixel(out, 4, 3)).toEqual([20, 0, 0, 255]);
  });
});

describe('layerOver — 층을 다른 층 위에 엔진의 알파 블렌딩으로 얹는다', () => {
  it('위 층이 불투명하면 위 층의 색이 그대로 남는다', () => {
    const below = image(1, 1, () => [200, 0, 0, 255]);
    const above = image(1, 1, () => [0, 0, 200, 255]);

    expect(pixel(layerOver(below, above), 0, 0)).toEqual([0, 0, 200, 255]);
  });

  it('위 층이 투명하면 아래 층이 알파까지 그대로 남는다', () => {
    // 층 캔버스의 대부분이 투명이다. 여기서 아래 층의 알파를 바꾸면 겹친 결과 전체가 옅어진다.
    const below = image(1, 1, () => [200, 100, 50, 128]);
    const above = image(1, 1, () => [9, 9, 9, 0]);

    expect(pixel(layerOver(below, above), 0, 0)).toEqual([200, 100, 50, 128]);
  });

  it('겹친 뒤 배경에 얹은 결과가 층을 배경에 차례로 얹은 결과와 반올림 차이 안에서 같다', () => {
    // 게임은 층을 하나씩 화면에 그린다. 층을 먼저 겹쳐 두고 배경에 얹는 이 함수가 그 순서와 다른
    // 그림을 내면, 층 합성과 한 번에 구운 컷의 차이를 잴 때 게임에 없는 차이까지 잰다.
    const below = image(1, 1, () => [200, 0, 0, 128]);
    const above = image(1, 1, () => [0, 0, 200, 128]);

    const merged = pixel(compositeOver(layerOver(below, above), [0, 0, 0]), 0, 0);

    // 차례로 얹으면 빨강 200 → 100 → 50, 파랑 0 → 0 → 100이다.
    expect(Math.abs(merged[0] - 50)).toBeLessThanOrEqual(1);
    expect(Math.abs(merged[2] - 100)).toBeLessThanOrEqual(1);
  });

  it('두 층의 크기가 다르면 두 크기를 말하며 던진다', () => {
    // 층마다 캔버스가 다를 수 있다(ADR 009). 크기가 다른 채로 픽셀 번호를 맞대면 오른쪽 층이
    // 줄마다 밀려 겹치는데, 결과는 멀쩡한 그림처럼 보인다.
    expect(() =>
      layerOver(
        image(2, 1, () => [0, 0, 0, 0]),
        image(1, 1, () => [0, 0, 0, 0]),
      ),
    ).toThrow(/2×1.*1×1/);
  });
});

describe('occlusionDelta — 가림을 켠 층이 끈 층의 부분집합인가', () => {
  it('가림이 지운 픽셀을 세고, 가림이 없던 픽셀을 만들지 않았으면 새로 생김이 0이다', () => {
    const raw = image(3, 1, () => [0, 0, 0, 255]);
    const held = image(3, 1, (x) => [0, 0, 0, x === 0 ? 255 : 0]);

    expect(occlusionDelta(raw, held, 8)).toEqual({ removed: 2, added: 0 });
  });

  it('끈 층에 없던 픽셀이 켠 층에 생기면 새로 생김으로 센다', () => {
    // 가림은 지우기만 해야 한다. 새로 생긴 픽셀이 있으면 가림 전용 몸이 렌더에 섞여 나온 것이다.
    const raw = image(2, 1, (x) => [0, 0, 0, x === 0 ? 255 : 0]);
    const held = image(2, 1, () => [0, 0, 0, 255]);

    expect(occlusionDelta(raw, held, 8)).toEqual({ removed: 0, added: 1 });
  });

  it('알파가 문턱과 같으면 보이는 픽셀로 치지 않는다', () => {
    // 가장자리 안티에일리어싱이 남긴 알파 1~8짜리 술은 가림 판정에서 뺀다. 넣으면 몸 윤곽을
    // 따라 한 줄씩 「지워짐」이 흔들려 같은 렌더를 두 번 재도 수치가 달라진다.
    const raw = image(1, 1, () => [0, 0, 0, 8]);
    const held = image(1, 1, () => [0, 0, 0, 0]);

    expect(occlusionDelta(raw, held, 8)).toEqual({ removed: 0, added: 0 });
  });
});

describe('pixelDiff — 두 그림이 픽셀마다 얼마나 다른가', () => {
  it('같은 그림이면 바뀐 픽셀이 0이다', () => {
    const a = image(2, 2, (x, y) => [x * 50, y * 50, 7, 255]);

    expect(pixelDiff(a, a, 12)).toEqual({ changed: 0, maxChannel: 0 });
  });

  it('둘 다 투명한 픽셀은 숨은 색이 달라도 세지 않는다', () => {
    // 렌더러가 투명 픽셀에 남기는 색은 굽기마다 달라질 수 있고 화면에는 안 나온다. 세면 층 합성과
    // 기준 컷의 차이가 보이지도 않는 픽셀로 부풀어, 회귀 가드가 이유 없이 빨간불이 된다.
    const a = image(1, 1, () => [255, 0, 0, 0]);
    const b = image(1, 1, () => [0, 255, 0, 0]);

    expect(pixelDiff(a, b, 12)).toEqual({ changed: 0, maxChannel: 0 });
  });

  it('한 채널이라도 문턱을 넘으면 바뀐 픽셀로 세고, 문턱과 같으면 세지 않는다', () => {
    const a = image(2, 1, () => [100, 100, 100, 255]);
    const b = image(2, 1, (x) => (x === 0 ? [113, 100, 100, 255] : [100, 100, 112, 255]));

    expect(pixelDiff(a, b, 12)).toEqual({ changed: 1, maxChannel: 13 });
  });

  it('크기가 다르면 던진다', () => {
    expect(() =>
      pixelDiff(
        image(1, 2, () => [0, 0, 0, 0]),
        image(2, 1, () => [0, 0, 0, 0]),
        12,
      ),
    ).toThrow();
  });
});

// ── G3 걷기 · 대기의 키프레임 정의 ─────────────────────────────────────────────────────────────
// 자세를 내는 식이 전부 TS에 있어서 굽지 않고도 단언할 수 있다. 여기서 막는 것은 굽고 나서야 보이던
// 결함들이다 — 주기가 안 이어져 이음새에서 튀는 것, 좌우 다리가 반 주기로 안 맞는 것, 디딘 발이 허공에
// 뜨거나 땅을 뚫는 것, 정면에서 발바닥이 보이는 것(1라운드 H는 16°였다).

/**
 * 뛰기 픽스처. 채택한 것은 걷기라 생산 값만으로는 두 발이 뜨는 경로(`hop` · `stanceEnd` · `thighLead`)가 돌지
 * 않는다. 그 경로가 식에 남아 있는 동안은 여기서 돌려 본다 — 값은 떨어진 후보 「질주」의 것이다.
 */
const RUN_FIXTURE: IGaitSpec = {
  id: 'run_fixture',
  label: '뛰기 픽스처',
  thighSwing: 30,
  thighBias: 12,
  thighLead: 0.1,
  stanceEnd: 0.3,
  kneeStance: 34,
  kneeStanceWidth: 0.4,
  kneeSwing: 110,
  footStrike: 0,
  footOff: 38,
  hop: 0.05,
  lean: 16,
  twist: 6,
};

/** 단언을 거는 걸음새 — 채택한 걷기와 뛰기 픽스처. */
const GAITS: readonly IGaitSpec[] = [CHOSEN_GAIT, RUN_FIXTURE];

/** 촘촘한 위상 표본. 프레임 수(6 · 8)의 위상이 전부 들어가도록 24의 배수로 잡는다. */
const DENSE_PHASES = Array.from({ length: 48 }, (_, i) => i / 48);

/** 그 위상에서 허리를 맞춘 뒤 두 발 가운데 낮은 쪽의 발바닥 높이(m). */
function lowestSole(spec: IGaitSpec, phase: number): number {
  const lift = hipsLift(spec, PLAYER_LEG_RIG, phase);
  const left = legPoints(PLAYER_LEG_RIG, legAngles(spec, phase), lift);
  const right = legPoints(PLAYER_LEG_RIG, legAngles(spec, phase + 0.5), lift);
  return Math.min(left.lowest, right.lowest);
}

describe('bump — 끝이 0이고 주기를 넘어 이어지는 혹', () => {
  it('중심에서 1이고 폭의 절반 밖에서 0이다', () => {
    expect(bump(0.3, 0.3, 0.2)).toBeCloseTo(1, 9);
    expect(bump(0.4, 0.3, 0.2)).toBe(0);
    expect(bump(0.2, 0.3, 0.2)).toBe(0);
  });

  it('위상 0을 중심으로 두면 1 직전에서도 값이 있다', () => {
    expect(bump(0.95, 0, 0.2)).toBeCloseTo(bump(0.05, 0, 0.2), 9);
    expect(bump(0.95, 0, 0.2)).toBeGreaterThan(0);
  });

  it('폭이 0이면 어디서도 0이다 — 걷기의 뜨는 구간이 이 경우다', () => {
    expect(bump(0.5, 0.5, 0)).toBe(0);
  });
});

describe('samplePhases · mergedPhases — 프레임 수와 위상', () => {
  it('0부터 같은 간격으로 나눈다', () => {
    expect(samplePhases(8)).toEqual([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]);
  });

  it('2 미만이거나 정수가 아니면 던진다', () => {
    expect(() => samplePhases(1)).toThrow();
    expect(() => samplePhases(6.5)).toThrow();
  });

  it('6장과 8장을 합치면 겹치는 위상(0 · 0.5)을 한 번만 굽는다', () => {
    const { phases, picks } = mergedPhases([6, 8]);
    expect(phases).toHaveLength(12);
    expect(picks[6].map((i) => phases[i])).toEqual(samplePhases(6));
    expect(picks[8].map((i) => phases[i])).toEqual(samplePhases(8));
  });
});

describe('legAngles — 위상에서 한쪽 다리의 각도', () => {
  it.each(GAITS)('$id: 주기의 끝이 처음으로 이어진다', (spec) => {
    const start = legAngles(spec, 0);
    const end = legAngles(spec, 0.9999);
    for (const key of ['thigh', 'shin', 'foot', 'toe'] as const) {
      expect(Math.abs(start[key] - end[key])).toBeLessThan(0.5);
    }
  });

  it.each(GAITS)('$id: 이웃 위상 사이에서 어떤 관절도 튀지 않는다', (spec) => {
    // 48등분이면 한 칸이 0.02 주기다. 가장 빠른 관절(질주의 무릎 110°)도 한 칸에 15°를 넘지 않아야
    // 프레임 사이가 이어져 보인다. 혹의 경계를 잘못 잡으면 한 칸에서 수십 도가 튄다.
    for (let i = 0; i < DENSE_PHASES.length; i++) {
      const a = legAngles(spec, DENSE_PHASES[i]);
      const b = legAngles(spec, DENSE_PHASES[(i + 1) % DENSE_PHASES.length]);
      for (const key of ['thigh', 'shin', 'foot', 'toe'] as const) {
        expect(Math.abs(a[key] - b[key])).toBeLessThan(15);
      }
    }
  });

  it.each(GAITS)('$id: 발끝을 드는 각이 어느 위상에서도 5°를 넘지 않는다', (spec) => {
    // 정면에서 발바닥이 카메라를 향하는 각이 곧 이 값이다(G3 §5 통과 조건)
    for (const phase of DENSE_PHASES) {
      expect(legAngles(spec, phase).foot).toBeLessThanOrEqual(5);
    }
  });

  it.each(GAITS)('$id: 무릎은 뒤로만 접힌다', (spec) => {
    // 정강이 각이 허벅지 각보다 크면 무릎이 앞으로 꺾인 것이다
    for (const phase of DENSE_PHASES) {
      const { thigh, shin } = legAngles(spec, phase);
      expect(shin).toBeLessThanOrEqual(thigh + 1e-9);
    }
  });
});

describe('hipsLift — 디딘 발을 땅에 놓는 허리 높이', () => {
  it.each(GAITS)('$id: 어느 발도 땅을 1.5cm 넘게 뚫지 않는다', (spec) => {
    // 1.5cm는 720p 게임 크기에서 1px이다. 그 안쪽은 화면에서 안 보인다
    for (const phase of DENSE_PHASES) {
      expect(lowestSole(spec, phase)).toBeGreaterThan(-0.015);
    }
  });

  it.each(GAITS.filter((spec) => spec.hop === 0))('$id: 걷기는 늘 한 발이 땅에 있다', (spec) => {
    for (const phase of DENSE_PHASES) {
      expect(lowestSole(spec, phase)).toBeLessThan(0.015);
    }
  });

  it.each(
    GAITS.filter((spec) => spec.hop > 0),
  )('$id: 뛰기는 두 발이 다 뜨는 위상이 있다', (spec) => {
    const highest = Math.max(...DENSE_PHASES.map((phase) => lowestSole(spec, phase)));
    expect(highest).toBeGreaterThan(0.02);
  });

  it.each(GAITS)('$id: 허리 높이가 이웃 위상 사이에서 튀지 않는다', (spec) => {
    // 접지할 발을 끊어서 바꾸면 그 위상에서 허리가 한 칸(0.02 주기)에 5cm 넘게 튄다. 뛰기는 디딘 직후 무릎이
    // 눌리며 한 칸에 1.6cm까지 정상으로 내려가므로 문턱을 2.5cm에 둔다
    for (let i = 0; i < DENSE_PHASES.length; i++) {
      const a = hipsLift(spec, PLAYER_LEG_RIG, DENSE_PHASES[i]);
      const b = hipsLift(spec, PLAYER_LEG_RIG, DENSE_PHASES[(i + 1) % DENSE_PHASES.length]);
      expect(Math.abs(a - b)).toBeLessThan(0.025);
    }
  });

  it.each(GAITS)('$id: 앞 절반과 뒤 절반의 허리 높이가 같다', (spec) => {
    for (const phase of [0, 0.1, 0.25, 0.4]) {
      expect(hipsLift(spec, PLAYER_LEG_RIG, phase)).toBeCloseTo(
        hipsLift(spec, PLAYER_LEG_RIG, phase + 0.5),
        9,
      );
    }
  });
});

describe('gaitFrame — 굽는 쪽이 그대로 입히는 프레임', () => {
  const spec = CHOSEN_GAIT;

  it('부모 본이 자식보다 앞에 온다', () => {
    const names = gaitFrame(spec, PLAYER_LEG_RIG, 0.3).bones.map(([name]) => name);
    const parentFirst = (parent: string, child: string) =>
      expect(names.indexOf(parent)).toBeLessThan(names.indexOf(child));
    parentFirst('J_Bip_C_Spine', 'J_Bip_C_UpperChest');
    parentFirst('J_Bip_C_UpperChest', 'J_Bip_C_Head');
    for (const side of ['L', 'R']) {
      parentFirst(`J_Bip_${side}_UpperLeg`, `J_Bip_${side}_LowerLeg`);
      parentFirst(`J_Bip_${side}_LowerLeg`, `J_Bip_${side}_Foot`);
      parentFirst(`J_Bip_${side}_Foot`, `J_Bip_${side}_ToeBase`);
    }
  });

  it('오른다리는 왼다리의 반 주기 뒤 자세다', () => {
    const now = new Map(gaitFrame(spec, PLAYER_LEG_RIG, 0.2).bones);
    const later = new Map(gaitFrame(spec, PLAYER_LEG_RIG, 0.7).bones);
    for (const part of ['UpperLeg', 'LowerLeg', 'Foot', 'ToeBase']) {
      expect(now.get(`J_Bip_R_${part}`)).toEqual(later.get(`J_Bip_L_${part}`));
    }
  });

  it('다리는 앞뒤 평면에서만 돈다 — 좌우 성분이 식에 없다', () => {
    // 1라운드의 「춤추는 느낌」은 허벅지 회전에 섞인 좌우 흔들림이었다. 여기서는 Y · Z가 늘 0이다
    for (const phase of DENSE_PHASES) {
      for (const [name, angles] of gaitFrame(spec, PLAYER_LEG_RIG, phase).bones) {
        if (!name.includes('Leg') && !name.includes('Foot') && !name.includes('Toe')) continue;
        expect(angles[1]).toBe(0);
        expect(angles[2]).toBe(0);
      }
    }
  });

  it('앞으로 나간 다리는 Blender X로 음수다', () => {
    // 부호를 뒤집는 곳이 한 군데(`toBlenderX`)라, 여기가 틀리면 캐릭터가 뒤로 걷는다
    const bones = new Map(gaitFrame(spec, PLAYER_LEG_RIG, 0).bones);
    expect(bones.get('J_Bip_L_UpperLeg')?.[0]).toBeLessThan(0);
    expect(bones.get('J_Bip_R_UpperLeg')?.[0]).toBeGreaterThan(0);
  });

  it('머리는 늘 각도 0으로 되돌린다', () => {
    for (const candidate of GAITS) {
      const head = new Map(gaitFrame(candidate, PLAYER_LEG_RIG, 0.4).bones).get('J_Bip_C_Head');
      expect(head).toEqual([0, 0, 0]);
    }
  });

  it('같은 입력이면 같은 JSON을 낸다 — G4가 정의의 해시로 카메라를 고정한다', () => {
    const a = JSON.stringify(gaitFrame(spec, PLAYER_LEG_RIG, 1 / 3));
    const b = JSON.stringify(gaitFrame(spec, PLAYER_LEG_RIG, 1 / 3));
    expect(a).toBe(b);
    expect(a).not.toContain('-0,');
  });
});

describe('stepLength — 굽기 전에 보폭을 어림한다', () => {
  it('허벅지를 크게 흔들수록 보폭이 크다', () => {
    const wider = { ...CHOSEN_GAIT, thighSwing: CHOSEN_GAIT.thighSwing + 8 };
    expect(stepLength(wider, PLAYER_LEG_RIG)).toBeGreaterThan(
      stepLength(CHOSEN_GAIT, PLAYER_LEG_RIG),
    );
  });

  it('채택한 걷기의 한 걸음은 게임 단위로 21 안팎이다', () => {
    // 미끄러짐 배수(한 주기 이동 거리 ÷ 두 걸음)의 분모다. 값을 고치면 QA에 적은 5.6배도 다시 잰다
    const units = stepLength(CHOSEN_GAIT, PLAYER_LEG_RIG) * (77 / 1.104);
    expect(units).toBeGreaterThan(20);
    expect(units).toBeLessThan(23);
  });

  it('다리 길이의 두 배를 넘지 않는다', () => {
    const leg = Math.abs(PLAYER_LEG_RIG.thigh[1]) + Math.abs(PLAYER_LEG_RIG.shin[1]);
    for (const spec of GAITS) {
      expect(stepLength(spec, PLAYER_LEG_RIG)).toBeGreaterThan(0);
      expect(stepLength(spec, PLAYER_LEG_RIG)).toBeLessThan(2 * leg);
    }
  });
});

describe('CHOSEN_MOTION — 굽기와 재생의 확정값', () => {
  it('걷기 장 수로 위상을 나누면 왼발 디딤(0)과 오른발 디딤(0.5)이 둘 다 프레임에 들어간다', () => {
    const phases = samplePhases(CHOSEN_MOTION.walkFrames);
    expect(phases).toContain(0);
    expect(phases).toContain(0.5);
  });

  it('좌우 각은 완전 측면(90°)에서 정면 쪽으로 튼 각이다', () => {
    // 60° 아래는 옆으로 걸을 때 게걸음으로 보여 떨어졌다(2026-09-20)
    expect(CHOSEN_MOTION.sideYaw).toBeGreaterThan(60);
    expect(CHOSEN_MOTION.sideYaw).toBeLessThanOrEqual(90);
  });
});

describe('idleFrame · standFrame — 대기', () => {
  it('서 있는 한 장은 아무 본도 돌리지 않는다', () => {
    expect(standFrame()).toEqual({ phase: 0, hips: [0, 0, 0], bones: [] });
  });

  it('숨을 다 들이쉰 위상(0.5)에서 몸이 정지 높이로 올라온다', () => {
    expect(idleFrame(IDLE_BAKED, PLAYER_LEG_RIG, 0.5).hips[2]).toBeCloseTo(0, 4);
    expect(idleFrame(IDLE_BAKED, PLAYER_LEG_RIG, 0).hips[2]).toBeLessThan(0);
  });

  it('무릎은 정말 살짝만 굽혔다 편다 — 사용자가 본 후보 14°와 6° 사이다', () => {
    // 처음 값은 30°였다. 게임 크기에서 몸이 1px쯤 오르내리게 하려던 값인데, 크게 보면 숨쉬기가 아니라 앉았다
    // 일어서기로 보였다(2026-09-21 사용자 판정). 30 · 20 · 14 · 10 · 6°를 나란히 재생해 10°를 골랐다
    expect(IDLE_BAKED.kneeFlex).toBeLessThan(14);
    expect(IDLE_BAKED.kneeFlex).toBeGreaterThan(6);
  });

  it('고른 굽힘에서는 몸이 게임 크기로 반 픽셀도 안 내려앉는다', () => {
    // 굽힘을 줄인 대가다 — 사용자가 720p · 1440p 보기에서 이 폭을 함께 보고 받았다. 몸의 오르내림이 아니라
    // 무릎 · 가슴 · 어깨의 작은 움직임이 대기를 만든다. 0이면 다리가 아예 안 움직여 굽는 뜻이 없다
    const unitsPerMeter = 77 / 1.104;
    const sink = -idleFrame(IDLE_BAKED, PLAYER_LEG_RIG, 0).hips[2] * unitsPerMeter;
    expect(sink).toBeGreaterThan(0);
    expect(sink).toBeLessThan(0.5);
  });

  it('들이쉬는 절반과 내쉬는 절반이 같은 자세라 세 장만 굽는다', () => {
    // 0.25와 0.75가 같은 그림이어야 0 → 1 → 2 → 1 재생이 네 장 재생과 같다. 식을 비대칭으로 바꾸면 여기서 걸린다
    const rising = idleFrame(IDLE_BAKED, PLAYER_LEG_RIG, 0.25);
    const falling = idleFrame(IDLE_BAKED, PLAYER_LEG_RIG, 0.75);
    expect(falling.hips).toEqual(rising.hips);
    expect(falling.bones).toEqual(rising.bones);
    expect(IDLE_PLAYBACK.phases).toEqual([0, 0.25, 0.5]);
    expect(IDLE_PLAYBACK.order).toEqual([0, 1, 2, 1]);
  });

  it('두 다리가 같은 각으로 굽는다', () => {
    const bones = new Map(idleFrame(IDLE_BAKED, PLAYER_LEG_RIG, 0).bones);
    expect(bones.get('J_Bip_L_UpperLeg')).toEqual(bones.get('J_Bip_R_UpperLeg'));
    expect(bones.get('J_Bip_L_LowerLeg')).toEqual(bones.get('J_Bip_R_LowerLeg'));
  });
});

describe('layerBakeJobs — 다섯 층을 네 방향으로 굽는 일감', () => {
  it('층 다섯 × 방향 넷이라 스무 건이고, 한 건이 걷기 8장과 대기 3장을 함께 굽는다', () => {
    const jobs = layerBakeJobs();
    expect(jobs).toHaveLength(BAKE_LAYERS.length * BAKE_FACINGS.length);
    for (const job of jobs) {
      expect(job.frames).toHaveLength(CHOSEN_MOTION.walkFrames + IDLE_PLAYBACK.phases.length);
    }
  });

  it('좌우는 고른 각으로 따로 굽는다 — 오른쪽 75°, 왼쪽은 그 반대편 285°', () => {
    const yaw = new Map(BAKE_FACINGS.map((f) => [f.id, f.yaw]));
    expect(yaw.get('front')).toBe(0);
    expect(yaw.get('right')).toBe(CHOSEN_MOTION.sideYaw);
    expect(yaw.get('back')).toBe(180);
    expect(yaw.get('left')).toBe(360 - CHOSEN_MOTION.sideYaw);
  });

  it('프레임 이름이 아틀라스 규칙 그대로라 이름에서 층 · 동작 · 방향을 되읽을 수 있다', () => {
    const names: string[] = [];
    for (const job of layerBakeJobs()) {
      for (const frame of job.frames) {
        const parts = parseFrameName(frame.name);
        expect(parts?.layer).toBe(job.layer);
        expect(parts?.facing).toBe(job.facing);
        expect(['walk', 'idle']).toContain(parts?.action);
        names.push(frame.name);
      }
    }
    expect(new Set(names).size).toBe(names.length);
    // 게임에 들어간 plist에 거는 검사와 같은 잣대다 — 굽는 쪽이 처음부터 그 잣대를 지킨다
    expect(checkFrameCounts(names)).toEqual([]);
  });

  it('같은 방향이면 모든 층이 같은 자세를 굽는다', () => {
    // 층마다 자세가 다르면 겹쳤을 때 상의와 무기가 몸에서 떨어진다. 이름만 다르고 자세는 같아야 한다
    const poses = (layer: string) =>
      layerBakeJobs()
        .filter((job) => job.layer === layer && job.facing === 'front')
        .flatMap((job) => job.frames.map(({ phase, hips, bones }) => ({ phase, hips, bones })));
    for (const layer of BAKE_LAYERS) expect(poses(layer)).toEqual(poses('body'));
  });

  it('걷기는 채택한 걸음의 위상 여덟, 대기는 구운 위상 셋이다', () => {
    expect(actionFrames('walk').map((f) => f.phase)).toEqual(
      samplePhases(CHOSEN_MOTION.walkFrames),
    );
    expect(actionFrames('idle').map((f) => f.phase)).toEqual([...IDLE_PLAYBACK.phases]);
    expect(actionFrames('walk')[0]).toEqual(gaitFrame(CHOSEN_GAIT, PLAYER_LEG_RIG, 0));
  });
});

describe('projectRow — 고도가 있는 직교 카메라에서 점이 놓이는 행', () => {
  /** 고도 0에서 키 1.104m를 2행과 489행 사이에 채우는 카메라. `_common.setup_camera`와 같은 식이다 */
  const perPixelM = 1.104 / (PLAYER_FRAME_SPEC.footLineY - PLAYER_FRAME_SPEC.headLineY);
  const level: ICameraPose = {
    pitchDeg: 0,
    aimZ: (PLAYER_FRAME_SPEC.footLineY + 0.5 - PLAYER_FRAME_SPEC.height / 2) * perPixelM,
    perPixelM,
  };

  it('고도 0이면 발밑(z 0)이 발 행의 픽셀 중심에, 정수리가 머리 행의 픽셀 중심에 온다', () => {
    expect(projectRow(level, PLAYER_FRAME_SPEC.height, [0, 0, 0])).toBeCloseTo(489.5, 6);
    expect(projectRow(level, PLAYER_FRAME_SPEC.height, [0, 0, 1.104])).toBeCloseTo(2.5, 6);
  });

  it('고도 0이면 앞뒤 위치(y)가 행을 바꾸지 않는다', () => {
    expect(projectRow(level, PLAYER_FRAME_SPEC.height, [0, 0.3, 0.5])).toBeCloseTo(
      projectRow(level, PLAYER_FRAME_SPEC.height, [0, -0.3, 0.5]),
      6,
    );
  });

  it('내려다보면 카메라에서 먼 점(y가 큰 쪽)이 같은 높이여도 화면에서 위로 간다', () => {
    // 방향마다 발 밑선이 달라지는 원인이 이것이다 — 앞으로 내디딘 발은 아래로, 뒤로 뻗은 발은 위로 간다
    const tilted: ICameraPose = { ...level, pitchDeg: CHOSEN_PITCH };
    const far = projectRow(tilted, PLAYER_FRAME_SPEC.height, [0, 0.1, 0]);
    const near = projectRow(tilted, PLAYER_FRAME_SPEC.height, [0, -0.1, 0]);
    expect(far).toBeLessThan(near);
    // 0.2m 떨어진 두 점의 행 차이는 sin(15°) × 0.2m ÷ 픽셀 크기다
    expect(near - far).toBeCloseTo((Math.sin((15 * Math.PI) / 180) * 0.2) / perPixelM, 4);
  });
});

describe('fitCamera — 맨살 몸 합집합의 머리 · 발 행에서 카메라를 맞춘다', () => {
  /** 잴 때 쓰는 넉넉한 캔버스. 기준의 세 배로 구워 행을 1/3px까지 읽는다 */
  const PROBE_HEIGHT = 1479;
  const provisional: ICameraPose = {
    pitchDeg: CHOSEN_PITCH,
    aimZ: 0.55,
    perPixelM: 1.104 / 487 / 3,
  };
  /** 합집합의 맨 위와 맨 아래를 만드는 두 점 — 정수리는 몸 뒤쪽, 발끝은 카메라 쪽에 있다 */
  const top: [number, number, number] = [0, 0.04, 1.12];
  const bottom: [number, number, number] = [0, -0.09, 0.0];
  const measured = {
    topRow: Math.floor(projectRow(provisional, PROBE_HEIGHT, top)),
    bottomRow: Math.floor(projectRow(provisional, PROBE_HEIGHT, bottom)),
  };

  it('맞춘 카메라로 다시 구우면 합집합이 머리 2행 · 발 489행의 픽셀 중심에 온다', () => {
    const fitted = fitCamera(provisional, PROBE_HEIGHT, measured, PLAYER_FRAME_SPEC);
    // 잰 행이 1/3px 단위라 맞춘 결과도 그만큼까지만 정확하다. 픽셀 중심에서 ±0.5 안이면 그 행으로 읽힌다
    const topAt = projectRow(fitted, PLAYER_FRAME_SPEC.height, top);
    const bottomAt = projectRow(fitted, PLAYER_FRAME_SPEC.height, bottom);
    expect(Math.abs(topAt - 2.5)).toBeLessThan(0.34);
    expect(Math.abs(bottomAt - 489.5)).toBeLessThan(0.34);
  });

  it('고도는 바꾸지 않는다 — 고도는 G2가 고른 값이고 맞추는 것은 배율과 높이뿐이다', () => {
    const fitted = fitCamera(
      provisional,
      PROBE_HEIGHT,
      { topRow: 10, bottomRow: 1400 },
      PLAYER_FRAME_SPEC,
    );
    expect(fitted.pitchDeg).toBe(CHOSEN_PITCH);
  });

  it('고도가 있으면 발밑 점(세계 원점)이 발 행보다 위에 온다', () => {
    // 발끝이 카메라 쪽으로 나와 있어 합집합의 맨 아래는 발끝이고, 두 발 사이 바닥은 그보다 뒤(위)다.
    // 게임의 발치 기준점과 마법진 중심이 발 행이 아니라 이 점이어야 하는 이유다
    const fitted = fitCamera(provisional, PROBE_HEIGHT, measured, PLAYER_FRAME_SPEC);
    const ground = projectRow(fitted, PLAYER_FRAME_SPEC.height, [0, 0, 0]);
    expect(ground).toBeLessThan(489);
    expect(ground).toBeGreaterThan(470);
  });

  it('잰 행이 뒤집혔거나 같으면 던진다', () => {
    expect(() =>
      fitCamera(provisional, PROBE_HEIGHT, { topRow: 500, bottomRow: 500 }, PLAYER_FRAME_SPEC),
    ).toThrow(/합집합/);
  });
});

describe('bodyCanvasWidth — 몸 층의 캔버스 가로를 실측에서 낸다', () => {
  it('옆걸음의 보폭이 기준 가로를 넘으면 여백을 두고 넓힌다', () => {
    // 2026-09-21 실측 — 75° 방향 걷기에서 루트 축 기준으로 259.2px을 차지했다(기준 246)
    expect(bodyCanvasWidth(259.2, PLAYER_FRAME_SPEC.width)).toBe(264);
  });

  it('기준보다 좁게 나와도 기준 아래로 내려가지 않는다', () => {
    // 층 캔버스는 기준보다 작을 수 없다(G4 §3.1) — 몸 층이 곧 기준이다
    expect(bodyCanvasWidth(187.1, PLAYER_FRAME_SPEC.width)).toBe(PLAYER_FRAME_SPEC.width);
  });

  it('가로의 홀짝을 기준과 맞춘다', () => {
    // 홀짝이 다르면 캔버스 중심이 픽셀 격자에서 반 칸 밀려 층끼리 0.5px 어긋난다
    for (const needed of [250.2, 251.2, 252.9, 300]) {
      expect(bodyCanvasWidth(needed, 246) % 2).toBe(0);
      expect(bodyCanvasWidth(needed, 247) % 2).toBe(1);
    }
  });

  it('차지하는 폭보다 양쪽으로 2px 이상 넓다', () => {
    for (const needed of [250.2, 251.2, 252.9, 300]) {
      expect(bodyCanvasWidth(needed, 246) - needed).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('STAFF_ORB.grip — 지팡이는 손목이 아니라 손 안에 선다', () => {
  /**
   * 기준 자세의 오른손에서, 손목(손 본의 머리)에서 손가락이 감싼 자리의 중심까지(모델 좌표, m).
   * 2026-09-21에 본 좌표로 쟀다 — 바깥(−x)으로 0.0175, 앞(−y)으로 0.0592.
   */
  const TUNNEL = { out: 0.0175, forward: 0.0592 };

  it('그립의 x · y가 손목과 손가락이 감싼 자리의 중심 사이에 있다', () => {
    // 굽기는 그립 점을 손목에 맞추므로, 그립을 키우면 지팡이가 그만큼 −방향(바깥 · 앞)으로 간다. 처음 값은
    // x −0.005 · y 0.015라 지팡이가 손목에서 앞으로 1.5cm, 안쪽으로 0.5cm에 섰고, 옆에서 보면 손이 아니라
    // 손목에 들린 것처럼 보였다(2026-09-21 사용자 판정). 중심보다 멀리 두면 지팡이의 축이 손가락이 감싼
    // 자리를 벗어나 손가락 쪽으로 넘어간다
    const [x, y] = STAFF_ORB.grip ?? [Number.NaN, Number.NaN];
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThanOrEqual(TUNNEL.out);
    expect(y).toBeGreaterThanOrEqual(0.03);
    expect(y).toBeLessThanOrEqual(TUNNEL.forward);
  });
});

describe('layerCanvas · layerSource — 층마다 어느 캔버스에 무엇을 굽나', () => {
  const bodyCanvas = { width: 264, height: 493 };

  it('몸과 상의는 몸 층 캔버스에 굽는다', () => {
    for (const layer of ['body', 'topA', 'topB'] as const) {
      expect(layerCanvas(layer, bodyCanvas)).toEqual(bodyCanvas);
    }
  });

  it('무기는 몸보다 넉넉한 캔버스에 굽고 홀짝은 몸 층과 같다', () => {
    // 지팡이는 머리 위로, 방패는 몸 옆으로 나간다. 홀짝이 다르면 중심이 반 픽셀 밀려 손에서 어긋난다
    for (const layer of ['staff', 'shield'] as const) {
      const canvas = layerCanvas(layer, bodyCanvas);
      expect(canvas.width).toBeGreaterThan(bodyCanvas.width);
      expect(canvas.height).toBeGreaterThan(bodyCanvas.height);
      expect(canvas.width % 2).toBe(bodyCanvas.width % 2);
      expect(canvas.height % 2).toBe(bodyCanvas.height % 2);
    }
  });

  it('상의 A · B는 같은 굽기 층(top)이고 들여오는 판만 다르다', () => {
    expect(layerSource('topA')).toEqual({ pythonLayer: 'top', topModel: 'topA' });
    expect(layerSource('topB')).toEqual({ pythonLayer: 'top', topModel: 'topB' });
  });

  it('무기 층은 그 무기의 사양만 받는다', () => {
    expect(layerSource('staff')).toEqual({ pythonLayer: 'staff', weapon: 'staff' });
    expect(layerSource('shield')).toEqual({ pythonLayer: 'shield', weapon: 'shield' });
    expect(layerSource('body')).toEqual({ pythonLayer: 'body' });
  });
});

describe('layerSetCheck — 상의 · 무기 층의 세트에 거는 검사', () => {
  const canvas = { width: W, height: H };
  /** 가운데에 점 하나가 있는 장 */
  const dot = () => frame(W, H, (x, y) => (x === 4 && y === 5 ? 255 : 0));
  const empty = () => frame(W, H, () => 0);

  it('빈 장은 허용한다 — 뒷모습에서 몸에 다 가린 무기는 비는 것이 정상이다', () => {
    expect(layerSetCheck([dot(), empty(), dot()], { count: 3, canvas })).toEqual([]);
  });

  it('세트가 통째로 비면 걸린다', () => {
    const problems = layerSetCheck([empty(), empty()], { count: 2, canvas });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/전부 비었다/);
  });

  it('장 수가 기대와 다르면 걸린다', () => {
    expect(layerSetCheck([dot()], { count: 2, canvas })[0]).toMatch(/1장/);
  });

  it('캔버스가 선언한 크기와 다른 장을 말한다', () => {
    const problems = layerSetCheck([dot(), frame(W + 2, H, () => 255)], { count: 2, canvas });
    expect(problems.some((p) => p.includes('1번'))).toBe(true);
  });

  it('내용이 캔버스 변에 닿은 장을 말한다 — 잘린 것과 구별할 수 없다', () => {
    const touching = frame(W, H, (x, y) => (x === 0 && y === 5 ? 255 : 0));
    const problems = layerSetCheck([dot(), touching], { count: 2, canvas });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/1번/);
    expect(problems[0]).toMatch(/변에 닿았다/);
  });

  it('옅은 술(알파 16 이하)은 내용으로 안 센다', () => {
    const faint = frame(W, H, (x, y) => (x === 0 ? 10 : x === 4 && y === 5 ? 255 : 0));
    expect(layerSetCheck([faint], { count: 1, canvas })).toEqual([]);
  });
});

describe('bakeDefinition · definitionHash — 카메라를 잡은 입력의 지문', () => {
  it('키 순서가 달라도 같은 값이면 지문이 같다', () => {
    expect(definitionHash({ a: 1, b: { c: [1, 2], d: 'x' } })).toBe(
      definitionHash({ b: { d: 'x', c: [1, 2] }, a: 1 }),
    );
  });

  it('값이 하나라도 다르면 지문이 다르다', () => {
    expect(definitionHash({ a: 1, b: [1, 2] })).not.toBe(definitionHash({ a: 1, b: [2, 1] }));
  });

  it('굽기 정의가 동작 · 고도 · 방향 · 규격 · 툰 사양을 전부 든다', () => {
    const definition = bakeDefinition();
    expect(definition.pitchDeg).toBe(CHOSEN_PITCH);
    expect(definition.frames.walk).toHaveLength(CHOSEN_MOTION.walkFrames);
    expect(definition.frames.idle).toHaveLength(IDLE_PLAYBACK.phases.length);
    expect(definition.facings).toEqual(BAKE_FACINGS);
    expect(definition.frameSpec).toEqual(PLAYER_FRAME_SPEC);
    // 외곽선 헐이 실루엣을 넓히므로 툰 사양이 바뀌면 합집합 행도 바뀐다
    expect(Object.keys(definition.toon.materials).length).toBeGreaterThan(0);
  });

  it('무기 · 장비의 음영 규칙은 모든 굽기 장면에 있는 부위(하의)에서 복사한다', () => {
    // 무기 층은 맨살 판으로 굽는데 맨살 판에는 상의 머티리얼이 없다. 상의를 지목하면 굽는 쪽이 `toon-spec`으로
    // 죽는다(2026-09-21). 하의는 맨살 판과 상의 판 모두에 있고, 복사하는 열두 값이 상의 A · B와 같다(같은 날 실측)
    const { materials } = bakeToon();
    expect(materials.WEAPON.like).toBe('Bottoms_CLOTH');
    expect(materials.GEAR.like).toBe('Bottoms_CLOTH');
    // 음영색 비율과 외곽선은 G2가 확정한 값 그대로다
    expect(materials.WEAPON.shade_ratio).toBe(WEAPON_TOON.shade_ratio);
    expect(materials.WEAPON.outline_width).toBe(OUTLINE_WIDTH_M);
  });

  it('걸음 값을 하나 고치면 지문이 바뀐다', () => {
    const definition = bakeDefinition();
    const walk = definition.frames.walk.map((f, i) =>
      i === 3 ? { ...f, hips: [f.hips[0], f.hips[1], f.hips[2] + 0.001] } : f,
    );
    const nudged = { ...definition, frames: { ...definition.frames, walk } };
    expect(definitionHash(nudged)).not.toBe(definitionHash(definition));
  });
});

describe('staleReasons — 카메라를 잡은 뒤에 입력이 바뀌었는가', () => {
  const recorded: IBakeInputs = {
    definition: 'aaa',
    models: { base: 'm0', topA: 'm1', topB: 'm2' },
    blender: '5.2.1',
    vrmAddon: '4.7.1',
  };

  it('전부 같으면 이유가 없다', () => {
    expect(staleReasons(recorded, structuredClone(recorded))).toEqual([]);
  });

  it('굽기 정의가 바뀌면 걸린다', () => {
    const reasons = staleReasons(recorded, { ...recorded, definition: 'bbb' });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/굽기 정의/);
  });

  it('모델 판 하나가 바뀌면 그 판의 이름을 말한다', () => {
    const reasons = staleReasons(recorded, {
      ...recorded,
      models: { ...recorded.models, topA: 'changed' },
    });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/topA/);
  });

  it('기록에 없던 판을 굽거나 기록된 판이 빠져도 걸린다', () => {
    expect(
      staleReasons(recorded, { ...recorded, models: { ...recorded.models, topC: 'm3' } })[0],
    ).toMatch(/topC/);
    expect(staleReasons(recorded, { ...recorded, models: { base: 'm0', topA: 'm1' } })[0]).toMatch(
      /topB/,
    );
  });

  it('Blender나 VRM 애드온의 판이 바뀌면 두 판을 함께 말한다', () => {
    // 도구를 올리면 임포트 결과나 음영 식이 달라질 수 있는데, 키프레임과 모델의 지문은 그대로라 이것 없이는 안 걸린다
    const blender = staleReasons(recorded, { ...recorded, blender: '5.3.0' });
    expect(blender[0]).toContain('5.2.1');
    expect(blender[0]).toContain('5.3.0');
    const addon = staleReasons(recorded, { ...recorded, vrmAddon: '4.8.0' });
    expect(addon[0]).toContain('4.7.1');
    expect(addon[0]).toContain('4.8.0');
  });
});

describe('bakeStamp — 구운 그림이 어느 입력으로 구워졌는가', () => {
  const inputs: IBakeInputs = {
    definition: 'aaa',
    models: { base: 'm0', topA: 'm1', topB: 'm2' },
    blender: '5.2.1',
    vrmAddon: '4.7.1',
  };

  it('입력과 무기 사양이 같으면 도장이 같다', () => {
    expect(bakeStamp(inputs, CHOSEN_WEAPONS)).toBe(
      bakeStamp(structuredClone(inputs), structuredClone(CHOSEN_WEAPONS)),
    );
  });

  it('무기의 그립만 바뀌어도 도장이 바뀐다', () => {
    // 굽기 정의의 지문은 무기를 안 든다(카메라를 몸만으로 잡는다). 그래서 그립을 고친 뒤 무기 층만 다시 굽고
    // 기준 컷을 안 구우면, 옮겨 간 지팡이가 「앞에 잘못 보인 픽셀」로 세어지는데 지문으로는 안 걸린다
    const moved = CHOSEN_WEAPONS.map((weapon) => {
      if (weapon.id !== STAFF_ORB.id || !weapon.grip) return weapon;
      const [x, y, z] = weapon.grip;
      return { ...weapon, grip: [x + 0.01, y, z] as const };
    });

    expect(bakeStamp(inputs, moved)).not.toBe(bakeStamp(inputs, CHOSEN_WEAPONS));
  });

  it('카메라 기록의 입력이 바뀌면 도장이 바뀐다', () => {
    expect(bakeStamp({ ...inputs, definition: 'bbb' }, CHOSEN_WEAPONS)).not.toBe(
      bakeStamp(inputs, CHOSEN_WEAPONS),
    );
  });
});

describe('centerOnCanvas — 층을 더 큰 캔버스의 중심에 옮긴다', () => {
  it('캔버스 중심을 맞춰 옮기고 둘레는 투명으로 남긴다', () => {
    // 모든 층이 같은 카메라로 구워져 캔버스 중심이 같은 월드 점이다. 그래서 중심만 맞추면 겹친다
    const small = image(2, 1, (x) => [x === 0 ? 200 : 100, 0, 0, 255]);

    const moved = centerOnCanvas(small, { width: 4, height: 3 });

    expect(moved.width).toBe(4);
    expect(moved.height).toBe(3);
    expect(pixel(moved, 1, 1)).toEqual([200, 0, 0, 255]);
    expect(pixel(moved, 2, 1)).toEqual([100, 0, 0, 255]);
    expect(pixel(moved, 0, 1)).toEqual([0, 0, 0, 0]);
    expect(pixel(moved, 1, 0)).toEqual([0, 0, 0, 0]);
  });

  it('같은 크기면 그림이 그대로다', () => {
    const img = image(2, 2, (x, y) => [x * 9, y * 9, 1, 255]);

    expect(Array.from(centerOnCanvas(img, { width: 2, height: 2 }).data)).toEqual(
      Array.from(img.data),
    );
  });

  it('홀짝이 다른 캔버스로는 옮기지 않는다 — 중심이 반 픽셀에 걸려 층이 0.5px 어긋난다', () => {
    const img = image(3, 1, () => [0, 0, 0, 255]);

    expect(() => centerOnCanvas(img, { width: 4, height: 1 })).toThrow(/홀짝/);
  });

  it('그림보다 작은 캔버스로는 옮기지 않고 두 크기를 말한다', () => {
    const img = image(4, 2, () => [0, 0, 0, 255]);

    expect(() => centerOnCanvas(img, { width: 2, height: 2 })).toThrow(/4×2.*2×2/);
  });
});

describe('alphaOverlap — 두 층의 내용이 함께 있는 픽셀 수', () => {
  it('둘 다 내용이 있는 픽셀만 센다', () => {
    const a = frame(3, 1, (x) => (x <= 1 ? 255 : 0));
    const b = frame(3, 1, (x) => (x >= 1 ? 255 : 0));

    expect(alphaOverlap(a, b)).toBe(1);
  });

  it('옅은 술(알파 16 이하)은 내용으로 안 센다 — 층 판정과 같은 잣대다', () => {
    const solid = frame(2, 1, () => 255);
    const faint = frame(2, 1, (x) => (x === 0 ? 16 : 17));

    expect(alphaOverlap(solid, faint)).toBe(1);
  });

  it('캔버스가 다르면 두 크기를 말하며 던진다 — 먼저 같은 캔버스로 옮겨야 한다', () => {
    expect(() =>
      alphaOverlap(
        frame(2, 1, () => 255),
        frame(1, 1, () => 255),
      ),
    ).toThrow(/2×1.*1×1/);
  });
});

describe('stackVerdict — 층을 겹친 그림이 한 번에 구운 기준 컷과 어디서 다른가', () => {
  const SKIN = [200, 150, 120, 255] as const;
  const CLOTH = [240, 240, 240, 255] as const;
  const WOOD = [90, 60, 30, 255] as const;
  const STEEL = [120, 130, 140, 255] as const;
  const CLEAR = [0, 0, 0, 0] as const;

  it('겹친 그림이 기준 컷과 같으면 아무것도 세지 않는다', () => {
    const body = image(2, 1, () => SKIN);
    const staff = image(2, 1, (x) => (x === 1 ? WOOD : CLEAR));
    const reference = image(2, 1, (x) => (x === 1 ? WOOD : SKIN));

    expect(
      stackVerdict(
        [
          { name: 'body', image: body },
          { name: 'staff', image: staff },
        ],
        reference,
        12,
      ),
    ).toEqual({
      holes: 0,
      misdrawn: { body: 0, staff: 0 },
      unmatched: { body: 0, staff: 0 },
      fringe: 0,
    });
  });

  it('기준 컷에는 있는데 어느 층에도 없는 픽셀은 구멍이다', () => {
    const body = image(2, 1, (x) => (x === 0 ? SKIN : CLEAR));
    const reference = image(2, 1, () => SKIN);

    const verdict = stackVerdict([{ name: 'body', image: body }], reference, 12);

    expect(verdict.holes).toBe(1);
    // 구멍은 구멍으로만 센다. 같은 픽셀을 두 실패에 겹쳐 세면 어느 쪽을 고쳐야 하는지가 흐려진다
    expect(verdict.misdrawn).toEqual({ body: 0 });
    expect(verdict.unmatched).toEqual({ body: 0 });
  });

  it('맨 위 층을 걷어내면 기준 컷과 맞는 자리는 그 층이 앞에 잘못 보인 것이다', () => {
    // 소매 뒤이면서 맨살 몸의 실루엣 밖을 지나는 지팡이는 맨살 몸만 가림으로 둔 굽기에서 안 지워진다.
    // 지팡이 노드가 상의 노드 위라 그 픽셀이 소매 앞에 그려지는데, 빈 자리가 아니라서 구멍으로는 안 잡힌다
    const body = image(3, 1, () => CLEAR);
    const top = image(3, 1, (x) => (x <= 1 ? CLOTH : CLEAR));
    const staff = image(3, 1, (x) => (x >= 1 ? WOOD : CLEAR));
    const reference = image(3, 1, (x) => (x <= 1 ? CLOTH : WOOD));

    const verdict = stackVerdict(
      [
        { name: 'body', image: body },
        { name: 'topA', image: top },
        { name: 'staff', image: staff },
      ],
      reference,
      12,
    );

    expect(verdict.misdrawn).toEqual({ body: 0, topA: 0, staff: 1 });
    expect(verdict.unmatched).toEqual({ body: 0, topA: 0, staff: 0 });
  });

  it('두 무기가 겹친 자리는 맨 위에 그려진 쪽에 센다', () => {
    // 화면에 실제로 잘못 나온 것은 맨 위 층의 픽셀이다. 아래 층에 세면 고칠 층을 잘못 짚는다
    const staff = image(1, 1, () => WOOD);
    const shield = image(1, 1, () => STEEL);
    const reference = image(1, 1, () => WOOD);

    const verdict = stackVerdict(
      [
        { name: 'staff', image: staff },
        { name: 'shield', image: shield },
      ],
      reference,
      12,
    );

    expect(verdict.misdrawn).toEqual({ staff: 0, shield: 1 });
  });

  it('두 층을 걷어내야 맞는 자리도 맨 위 층에 센다', () => {
    // 방패와 지팡이가 둘 다 소매 뒤에 있어야 하는 자리다. 한 층만 걷어내 보고 그만두면 이 픽셀이 가림
    // 오류가 아닌 쪽으로 빠진다
    const top = image(1, 1, () => CLOTH);
    const staff = image(1, 1, () => WOOD);
    const shield = image(1, 1, () => STEEL);
    const reference = image(1, 1, () => CLOTH);

    const verdict = stackVerdict(
      [
        { name: 'topA', image: top },
        { name: 'staff', image: staff },
        { name: 'shield', image: shield },
      ],
      reference,
      12,
    );

    expect(verdict.misdrawn).toEqual({ topA: 0, staff: 0, shield: 1 });
  });

  it('걷어내도 기준 컷과 안 맞는 차이는 가림 오류로 세지 않는다', () => {
    // 층의 윤곽이 아래 층과 섞이는 방식이나 음영이 기준 컷과 다른 자리다. 앞뒤를 바꿔도 안 없어지므로
    // 가림 판을 고르는 수치에 섞이면 안 되고, 크기는 맨 아래 층(무엇의 앞에도 잘못 설 수 없다)의 값이 가늠해 준다
    const body = image(2, 1, () => SKIN);
    const staff = image(2, 1, (x) => (x === 1 ? WOOD : CLEAR));
    const reference = image(2, 1, (x) => (x === 1 ? [120, 60, 30, 255] : [170, 150, 120, 255]));

    const verdict = stackVerdict(
      [
        { name: 'body', image: body },
        { name: 'staff', image: staff },
      ],
      reference,
      12,
    );

    expect(verdict.misdrawn).toEqual({ body: 0, staff: 0 });
    expect(verdict.unmatched).toEqual({ body: 1, staff: 1 });
  });

  it('걷어낸 자리에 아무 내용도 없으면 가림 오류가 아니다 — 가릴 것이 없다', () => {
    // 무기의 윤곽이 기준 컷보다 한 픽셀 넓게 구워진 자리다. 걷어낸 자리와 기준 컷이 둘 다 비어서 「맞는다」고
    // 읽으면, 윤곽의 술이 통째로 가림 오류로 세어진다
    const body = image(1, 1, () => CLEAR);
    const staff = image(1, 1, () => [90, 60, 30, 40]);
    const reference = image(1, 1, () => CLEAR);

    const verdict = stackVerdict(
      [
        { name: 'body', image: body },
        { name: 'staff', image: staff },
      ],
      reference,
      12,
    );

    expect(verdict.misdrawn.staff).toBe(0);
    expect(verdict.unmatched.staff).toBe(1);
  });

  it('문턱 이하의 색 차이는 세지 않는다 — 굽기마다 흔들리는 렌더 잡음이다', () => {
    const body = image(1, 1, () => [100, 100, 100, 255]);
    const near = image(1, 1, () => [112, 100, 100, 255]);
    const far = image(1, 1, () => [113, 100, 100, 255]);

    expect(stackVerdict([{ name: 'body', image: body }], near, 12).unmatched.body).toBe(0);
    expect(stackVerdict([{ name: 'body', image: body }], far, 12).unmatched.body).toBe(1);
  });

  it('어느 층의 내용도 없는 자리의 차이는 술로 따로 센다', () => {
    // 윤곽의 안티앨리어싱이 남긴 옅은 알파끼리의 차이다. 층의 실패로 세면 윤곽 길이만큼 수가 부푼다
    const body = image(1, 1, () => [200, 150, 120, 10]);
    const reference = image(1, 1, () => CLEAR);

    expect(stackVerdict([{ name: 'body', image: body }], reference, 8)).toEqual({
      holes: 0,
      misdrawn: { body: 0 },
      unmatched: { body: 0 },
      fringe: 1,
    });
  });

  it('층이 없거나 캔버스가 기준 컷과 다르면 던진다', () => {
    const reference = image(2, 1, () => SKIN);

    expect(() => stackVerdict([], reference, 12)).toThrow(/층/);
    expect(() =>
      stackVerdict([{ name: 'body', image: image(1, 1, () => SKIN) }], reference, 12),
    ).toThrow(/1×1.*2×1/);
  });
});

describe('stackOrder — 방향마다 층을 겹치는 순서', () => {
  it('정면 · 오른쪽 · 왼쪽은 몸 → 상의 → 지팡이 → 방패다', () => {
    for (const facing of ['front', 'right', 'left'] as const) {
      expect(stackOrder(facing, 'topA')).toEqual(['body', 'topA', 'staff', 'shield']);
    }
  });

  it('뒷모습은 무기가 상의 아래로 간다', () => {
    // 뒤에서 보면 두 손이 몸통보다 카메라에서 멀다. 무기 층은 맨살 몸으로만 가려 구워서, 옷이 맨살보다 나온
    // 만큼의 무기 픽셀이 남는데 그 픽셀을 상의가 덮어야 한다. 방패를 상의 위에 두면 그 픽셀이 상의 앞에
    // 그려진다(2026-09-21 실측 — 상의 A에서 11장에 1,843px, 아래로 내리면 111px)
    expect(stackOrder('back', 'topA')).toEqual(['body', 'staff', 'shield', 'topA']);
  });

  it('입은 상의가 상의 자리에 온다', () => {
    expect(stackOrder('back', 'topB')).toEqual(['body', 'staff', 'shield', 'topB']);
    expect(stackOrder('front', 'topB')).toEqual(['body', 'topB', 'staff', 'shield']);
  });

  it('어느 방향이든 몸이 맨 아래이고 네 자리가 한 번씩 나온다', () => {
    // 다른 층이 전부 맨살 몸을 가림 전용으로 두고 구워져 몸 뒤의 픽셀이 없다. 몸이 맨 아래가 아니면 몸이 그 층을 덮는다
    for (const facing of BAKE_FACINGS) {
      const order = STACK_ORDER[facing.id];
      expect(order[0]).toBe('body');
      expect([...order].sort()).toEqual(['body', 'shield', 'staff', 'top']);
    }
  });
});

describe('atlasGroups — 구운 프레임을 층 × 동작 단위로 묶는다', () => {
  it('층 다섯 × 동작 둘이라 열 묶음이다', () => {
    const groups = atlasGroups();

    expect(groups).toHaveLength(BAKE_LAYERS.length * 2);
    expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length);
    expect(groups.map((group) => group.id)).toContain('body_walk');
    expect(groups.map((group) => group.id)).toContain('shield_idle');
  });

  it('한 묶음에 네 방향의 그 동작 프레임이 전부 들어간다', () => {
    // 방향까지 나누면 아틀라스가 마흔 개로 늘어 빌드 파일이 불어난다(G4 §6)
    for (const group of atlasGroups()) {
      const count =
        group.action === 'walk' ? CHOSEN_MOTION.walkFrames : IDLE_PLAYBACK.phases.length;
      expect(group.frames).toHaveLength(BAKE_FACINGS.length * count);
      for (const frame of group.frames) {
        expect(parseFrameName(frame.name)).toMatchObject({
          layer: group.layer,
          action: group.action,
          facing: frame.facing,
        });
      }
    }
  });

  it('묶음을 다 합치면 굽는 프레임 전부이고 겹치는 이름이 없다', () => {
    // 빠진 프레임은 게임이 그 이름을 못 찾아 직전 프레임에 멈추고, 겹친 이름은 plist에서 뒤엣것이 앞엣것을 덮는다
    const packed = atlasGroups().flatMap((group) => group.frames.map((frame) => frame.name));
    const baked = layerBakeJobs().flatMap((job) => job.frames.map((frame) => frame.name));

    expect(new Set(packed).size).toBe(packed.length);
    expect([...packed].sort()).toEqual([...baked].sort());
  });
});

describe('referenceBakeJobs — 기준 컷은 층과 같은 자세를 한 장으로 굽는다', () => {
  it('게임에 있는 조합이 상의 둘이라 상의 둘 × 방향 넷, 여덟 건이다', () => {
    const jobs = referenceBakeJobs();

    expect(jobs).toHaveLength(2 * BAKE_FACINGS.length);
    expect(new Set(jobs.map((job) => job.top))).toEqual(new Set(['topA', 'topB']));
  });

  it('같은 방향의 층 일감과 각도 · 자세가 같다', () => {
    // 자세가 한 장이라도 다르면 자세의 차이가 가림의 차이로 세어지고, 수치만 봐서는 구별되지 않는다
    const layerJobs = layerBakeJobs().filter((job) => job.layer === 'body');
    for (const job of referenceBakeJobs()) {
      const like = layerJobs.find((each) => each.facing === job.facing);
      expect(like?.yaw).toBe(job.yaw);
      expect(job.frames.map(({ name: _name, ...pose }) => pose)).toEqual(
        like?.frames.map(({ name: _name, ...pose }) => pose),
      );
    }
  });

  it('프레임 이름은 층 자리만 whole이고 동작 · 방향 · 번호는 층과 같다', () => {
    const layerJobs = layerBakeJobs().filter((job) => job.layer === 'body');
    for (const job of referenceBakeJobs()) {
      const like = layerJobs.find((each) => each.facing === job.facing);
      expect(job.frames.map((f) => f.name)).toEqual(
        like?.frames.map((f) => f.name.replace(/^body_/, 'whole_')),
      );
    }
  });
});

describe('matchModels — 두 판이 같은 몸인가', () => {
  const SKIN = 'N00_000_00_Body_00_SKIN (Instance)';
  const BONES = ['J_Bip_C_Hips', 'J_Bip_C_Head', 'J_Bip_L_Hand'];
  const FACE = [
    [0, -0.1, 1.0],
    [0.05, -0.1, 1.05],
    [-0.05, -0.08, 0.95],
  ];
  const HAIR = [
    [0, 0.1, 1.1],
    [0.1, 0.1, 0.9],
  ];
  const TORSO = [
    [0, 0, 0.5],
    [0.1, 0, 0.6],
    [0, 0.1, 0.7],
  ];
  const text = (points: number[][], lift = 0) =>
    points.map(([x, y, z]) => `${x.toFixed(5)},${y.toFixed(5)},${(z + lift).toFixed(5)}`);

  /** 덤프 하나를 짠다. `lift`만큼 모델 전체를 위로 옮긴다 */
  function dump(over: {
    bones?: string[];
    skin?: number[][];
    face?: number[][];
    hair?: number[][] | null;
    lift?: number;
    skinMaterial?: string;
  }): IModelDump {
    const lift = over.lift ?? 0;
    const meshes: IModelDump['meshes'] = [
      {
        name: 'Body',
        vertices: 3,
        digest: 'unused',
        byMaterial: { [over.skinMaterial ?? SKIN]: text(over.skin ?? TORSO, lift) },
      },
      {
        name: 'Face',
        vertices: 3,
        digest: 'unused',
        byMaterial: { 'N00_000_00_Face_00_SKIN (Instance)': text(over.face ?? FACE, lift) },
      },
    ];
    if (over.hair !== null) {
      meshes.push({
        name: 'Hair',
        vertices: 2,
        digest: 'unused',
        byMaterial: { 'N00_000_Hair_00_HAIR (Instance)': text(over.hair ?? HAIR, lift) },
      });
    }
    return { vrm: 'x.vrm', bones: over.bones ?? BONES, meshes };
  }

  it('같은 몸이면 문제가 없고 코어 본 수와 맨살 점 수를 돌려준다', () => {
    const match = matchModels(dump({}), dump({}));

    expect(match.problems).toEqual([]);
    expect(match).toMatchObject({ coreBones: 3, skinInLess: 3, skinInMore: 3, skinRemoved: 0 });
  });

  it('옷을 더 입은 판의 맨살이 덜 입은 판의 부분집합이면 통과하고, 지워진 점을 센다', () => {
    // VRoid는 옷 아래의 살을 지운 채 내보낸다. 그래서 정점 수는 판마다 다른 것이 정상이고, 같은 몸인지는
    // 「더 입은 판에 남은 살이 전부 덜 입은 판에도 있는가」로 본다(G1 실측 — 흰 티 아래 708점, 나시 아래 327점)
    const less = dump({ skin: [...TORSO, [0.2, 0, 0.5]] });
    const more = dump({ skin: [TORSO[0], TORSO[2]] });

    const match = matchModels(less, more);

    expect(match.problems).toEqual([]);
    expect(match.skinRemoved).toBe(2);
    expect(match.skinOutside).toBe(0);
  });

  it('더 입은 판에만 있는 맨살 점이 있으면 걸리고, 그 점들의 높이를 말한다', () => {
    // 모든 층이 덜 입은 판을 가림 전용 몸으로 쓴다. 더 입은 판의 살이 그 밖으로 나가 있으면 가림이 그만큼
    // 어긋나 구멍이나 겹침이 생기는데, 굽기는 끝까지 돌고 그림도 멀쩡해 보인다
    const less = dump({ skin: TORSO });
    const more = dump({ skin: [TORSO[0], [0.3, 0.3, 0.65]] });

    const match = matchModels(less, more);

    expect(match.skinOutside).toBe(1);
    expect(match.problems).toHaveLength(1);
    expect(match.problems[0]).toMatch(/1개/);
    expect(match.problems[0]).toContain('0.650');
  });

  it('모델이 통째로 같은 거리만큼 옮겨져 있으면 그 이동을 빼고 견준다', () => {
    // 신발을 벗긴 판은 VRoid가 밑창 높이만큼 통째로 내려서 내보낸다(2026-09-21 실측 16.23mm). 몸은 같은데
    // 좌표가 전부 달라서, 이동을 안 빼면 모든 점이 「밖」으로 나온다
    const match = matchModels(dump({ lift: -0.01623 }), dump({}));

    expect(match.problems).toEqual([]);
    expect(match.offset[2]).toBeCloseTo(0.01623, 5);
    expect(match.skinOutside).toBe(0);
  });

  it('정해 준 높이 아래의 맨살은 부분집합 검사에서 빼고, 뺀 점을 따로 센다', () => {
    // 신발 속의 발은 굽에 맞춰 세워져 있어 맨발과 모양이 다르다. 발을 빼고 견줄 수 있어야 「발목 위는 같은
    // 몸」을 확인할 수 있는데, 조용히 빼면 다른 자리의 어긋남까지 묻히므로 높이를 부르는 쪽이 정해 준다
    const foot = [0.05, -0.05, 0.03];
    const less = dump({ skin: TORSO });
    const more = dump({ skin: [...TORSO, foot] });

    expect(matchModels(less, more).skinOutside).toBe(1);
    const match = matchModels(less, more, { ignoreBelowZ: 0.1 });
    expect(match.problems).toEqual([]);
    expect(match.skinOutside).toBe(0);
    expect(match.skinIgnored).toBe(1);
  });

  it('코어 본이 한쪽에만 있으면 그 이름을 말한다', () => {
    const match = matchModels(dump({}), dump({ bones: ['J_Bip_C_Hips', 'J_Bip_C_Head'] }));

    expect(match.problems).toHaveLength(1);
    expect(match.problems[0]).toContain('J_Bip_L_Hand');
  });

  it('흔들림 본이 다른 것은 문제가 아니다 — 옷마다 붙는 수가 다르다', () => {
    const match = matchModels(
      dump({}),
      dump({ bones: [...BONES, 'J_Sec_L_TopsUpperArm_01', 'J_Sec_Hair1_03'] }),
    );

    expect(match.problems).toEqual([]);
    expect(match.coreBones).toBe(3);
  });

  it('얼굴이나 머리카락의 모양이 다르면 걸린다', () => {
    // 화면에 보이는 얼굴 · 머리카락은 맨살 판의 것이고 상의 층만 다른 판에서 온다. 두 판의 머리가 다르면
    // 상의 층이 다른 머리에 가려진 채로 구워진다
    const otherFace = [FACE[0], FACE[1], [-0.05, -0.02, 0.9]];
    const otherHair = [HAIR[0], [0.1, 0.2, 0.8]];

    expect(matchModels(dump({}), dump({ face: otherFace })).problems.join()).toMatch(/Face/);
    expect(matchModels(dump({}), dump({ hair: otherHair })).problems[0]).toMatch(/Hair/);
  });

  it('메시가 한쪽에 없으면 걸린다', () => {
    expect(matchModels(dump({}), dump({ hair: null })).problems[0]).toMatch(/Hair/);
  });

  it('맨살 머티리얼을 못 찾으면 통과시키지 않는다', () => {
    // 빈 집합은 무엇의 부분집합이기도 하다. 머티리얼 이름이 바뀌어 맨살을 못 고른 것을 「같은 몸」으로 읽으면
    // 이 검사는 아무것도 안 보면서 통과만 한다
    const blank = dump({ skinMaterial: 'N00_001_01_Bottoms_01_CLOTH (Instance)' });

    expect(matchModels(dump({}), blank).problems[0]).toMatch(/맨살/);
  });
});

describe('gearFollow — 장비가 붙은 본을 회전까지 따라갔는가', () => {
  /** 무릎(머리)을 축으로 앞뒤 평면에서 `deg`만큼 굽은 정강이와, 그 본에 붙은 장비의 한 프레임 */
  function shinFrame(deg: number, rigid: boolean): IGearFrame {
    const t = (deg * Math.PI) / 180;
    const head = [0.1, 0, 0.5 + deg * 0.001];
    // 본의 축은 아래(−z)를 향하고 y-z 평면에서 돈다
    const along = (len: number, side: number) => [
      head[0],
      head[1] + len * Math.sin(t) + side * Math.cos(t),
      head[2] - len * Math.cos(t) + side * Math.sin(t),
    ];
    const tail = along(0.4, 0);
    const origin = rigid ? along(0.2, 0.05) : [head[0], head[1] + 0.05, head[2] - 0.2];
    const up = rigid ? along(0.1, 0.05) : [origin[0], origin[1], origin[2] + 0.1];
    return { gear: { boot: { bone: 'J_Bip_L_LowerLeg', origin, up, head, tail } } };
  }
  const swing = [0, 20, 45, 10];

  it('본을 회전까지 따라간 장비는 본의 두 끝에서 늘 같은 거리에 있다', () => {
    const follow = gearFollow(
      swing.map((deg) => shinFrame(deg, true)),
      'boot',
    );

    expect(follow.spread).toBeLessThan(1e-9);
    expect(follow.travel).toBeGreaterThan(0.05);
  });

  it('위치만 따라간 장비는 본이 돌 때 꼬리와의 거리가 변한다', () => {
    // 무기를 옮기는 식(손 위치에 거리만 더한다)을 장비에 쓰면 이렇게 된다. 부츠가 곧게 선 채로 굽은
    // 정강이를 뚫고 나오는데, 원점은 무릎에서 늘 같은 거리라 원점만 봐서는 드러나지 않는다
    const follow = gearFollow(
      swing.map((deg) => shinFrame(deg, false)),
      'boot',
    );

    expect(follow.spread).toBeGreaterThan(0.01);
  });

  it('그 이름의 장비가 없는 프레임이 있으면 던진다', () => {
    expect(() => gearFollow([shinFrame(0, true), { gear: {} }], 'boot')).toThrow(/boot/);
  });
});

describe('bakeMotionArgs — 굽는 쪽에 넘기는 인자', () => {
  const call = {
    vrm: 'base.vrm',
    frames: 'frames.json',
    outDir: 'out',
    yaw: 75,
    camera: 'camera.json',
    toon: 'toon.json',
    canvas: { width: 600, height: 701 },
    extra: ['--layer', 'staff', '--staff-spec', 'staff.json'],
  };
  /** `--name` 뒤의 값 */
  const argAfter = (args: string[], name: string) => args[args.indexOf(name) + 1];

  it('규격값은 PLAYER_FRAME_SPEC에서 넘긴다 — 굽는 쪽에는 기본값이 없다', () => {
    const args = bakeMotionArgs(call);

    expect(argAfter(args, '--width')).toBe(String(PLAYER_FRAME_SPEC.width));
    expect(argAfter(args, '--height')).toBe(String(PLAYER_FRAME_SPEC.height));
    expect(argAfter(args, '--foot-row')).toBe(String(PLAYER_FRAME_SPEC.footLineY));
    expect(argAfter(args, '--head-row')).toBe(String(PLAYER_FRAME_SPEC.headLineY));
  });

  it('층 캔버스와 방향 · 카메라 · 툰 사양 · 층마다 다른 인자를 그대로 싣는다', () => {
    const args = bakeMotionArgs(call);

    expect(argAfter(args, '--layer-width')).toBe('600');
    expect(argAfter(args, '--layer-height')).toBe('701');
    expect(argAfter(args, '--yaw')).toBe('75');
    expect(argAfter(args, '--camera')).toBe('camera.json');
    expect(argAfter(args, '--toon')).toBe('toon.json');
    expect(argAfter(args, '--vrm')).toBe('base.vrm');
    expect(argAfter(args, '--frames')).toBe('frames.json');
    expect(argAfter(args, '--out-dir')).toBe('out');
    expect(argAfter(args, '--layer')).toBe('staff');
    expect(argAfter(args, '--staff-spec')).toBe('staff.json');
  });
});
