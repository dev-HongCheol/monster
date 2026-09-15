/**
 * 구운 프레임 한 벌이 게임에 실릴 자격이 있는지 재는 순수 판정 — 디스크도 PNG 포맷도 모른다.
 *
 * `SpriteMetrics.ts`가 한 장을 재는 반면 이 파일은 **세트를 잰다.** 프레임 하나하나가
 * 멀쩡해도 세트로는 틀릴 수 있기 때문이다. 여덟 장이 전부 같은 그림인 경우, 프레임마다
 * 캔버스가 다른 경우, 세트가 통째로 다른 높이에 서 있는 경우가 그렇고, 셋 다 한 장만 보면
 * 정상이다.
 *
 * **판정이 둘로 갈려 있다.** `frameSetCheck`는 (방향, 동작) 세트 하나에 걸고,
 * `unionRowCheck`는 여러 세트를 합쳐 인물의 크기를 잰다. 층마다 걸 수 있는 규칙이 다르기
 * 때문이다 — 상의·무기 층은 몸보다 작게 구워지고 방향에 따라 통째로 비기도 하는 것이
 * 정상이라, 몸 층에 거는 머리·발 행을 그대로 걸면 정상 렌더가 떨어진다. `frameSetIntegrity`는
 * 둘을 합친 래퍼이고, 한 세트만 굽던 1라운드가 그대로 쓴다.
 *
 * 판정을 RGBA 배열에만 걸어 두는 이유는 `SpriteMetrics.ts`와 같다 — 파일을 읽는 것은
 * `PngCodec.ts` 하나가 맡고, 실행기와 벤치가 같은 판정을 나눠 쓴다.
 */

import { normalizeAlpha } from '../../tools/art/Postprocess.ts';
import { footLineY, type IRgbaImage, trimBox } from './SpriteMetrics.ts';

/**
 * 플레이어 프레임이 서야 하는 캔버스와 발 밑선·머리 꼭대기 행.
 *
 * 캔버스와 발 밑선은 2026-08-07에 실측으로 닫힌 값이고 출하된 4방향 넷이 이미 이 규격에 서
 * 있다. 3D에서 구운 프레임이 같은 자리에 서지 않으면 게임 안에서 캐릭터가 바닥을 뚫거나
 * 떠오른다. 이 값을 왜 이렇게 정했는지는 `docs/design/spec/art-asset-spec.md` §12가 든다.
 *
 * 머리 꼭대기 행 2는 출하된 정면 그림(`player_4dir_front.png`)을 `normalizeAlpha`를 거쳐 잰
 * 값이다(2026-09-14 실측, 뒷모습은 3). 게임은 3D 프레임과 출하 아트를 똑같이 48×96 상자에
 * 넣으므로 캔버스를 덜 채운 쪽이 화면에서 작게 보인다. 발 밑선만 맞춰 구운 판은 머리 꼭대기가
 * 33~40행이라 키가 2D의 92%였고, 사용자가 Cocos 테스트 씬에서 눈으로 작다고 봤다.
 *
 * **Blender 스크립트는 이 값을 복사해 두지 않는다.** `tools/blender/gate.ts`가 인자로 넘기고
 * 스크립트는 못 받으면 실패한다. 파이썬이 TS를 import할 수 없다고 값을 스크립트에도 적어 두면,
 * 한쪽만 고쳤을 때 굽기는 옛 값을, 판정은 새 값을 써서 게이트가 떨어진다. 그런데 실패 메시지는
 * 크기·위치 결함을 가리키므로 원인이 두 벌의 불일치라는 것이 드러나지 않는다.
 */
export const PLAYER_FRAME_SPEC = {
  width: 246,
  height: 493,
  footLineY: 489,
  headLineY: 2,
} as const;

/**
 * 세트의 머리·발 행이 기준에서 안쪽으로 벗어나도 되는 줄 수.
 *
 * 카메라는 세트에서 가장 높은 점과 가장 낮은 점을 각자의 행 **픽셀 중심**에 놓는다. 그 점을 덮는
 * 픽셀의 알파가 안티앨리어싱으로 임계값을 못 넘으면 한 줄 안쪽이 끝으로 잡히므로, 0으로 잡으면
 * 정상 렌더가 떨어질 수 있다.
 */
const SET_EDGE_TOLERANCE = 1;

/**
 * 이웃 프레임을 「같은 그림」으로 볼 채널당 최대 차이.
 *
 * `normalizeAlpha`가 0으로 누르는 기준과 같은 값을 쓴다. 판정 둘이 다른 잣대를 쓰면, 알파를
 * 눌러 없앤 잡음이 이웃 비교에서는 「움직였다」로 살아나 프레임 번호를 안 올린 굽기가 통과한다.
 */
const NEIGHBOR_DIFF_UP_TO = 16;

/** `frameSetCheck`가 세트 하나에 요구하는 것. */
export interface ISetCheckExpectation {
  /** 기대 프레임 수 */
  count: number;
  /** 캔버스 가로 */
  width: number;
  /** 캔버스 세로 */
  height: number;
  /**
   * 발 밑선이 와야 하는 y.
   *
   * 프레임마다는 이 행보다 아래로 내려가면 안 되고 위로는 `footLineTolerance`까지 허용한다.
   * 세트를 합쳐 재는 규칙은 `unionRowCheck`가 든다.
   */
  footLineY: number;
  /** 발 밑선이 기준에서 **위로** 벗어나도 되는 픽셀 수. 걷기는 발이 정당하게 떠오른다 */
  footLineTolerance: number;
  /** 이 값 이하의 알파를 내용으로 안 센다. 기본 16 — `normalizeAlpha`와 같은 기준값이다 */
  faintUpTo?: number;
  /** 이웃 비교에서 이 값 이하로만 다른 픽셀은 같은 것으로 본다. 기본 16 */
  neighborDiffUpTo?: number;
}

/** `unionRowCheck`가 세트들의 합집합에 요구하는 것. */
export interface IUnionRowExpectation {
  /**
   * 합집합에서 머리가 가장 높이 뜬 장의 머리 꼭대기가 와야 하는 y. 한 줄 아래까지 허용한다.
   *
   * 세트 하나가 아니라 합집합으로 재는 이유는 카메라가 모든 방향·동작을 합친 상자로 한 번만
   * 잡기 때문이다. 옆모습이 정면보다 머리가 낮게 나오는 것은 정상이고, 가장 높은 머리 하나가
   * 이 행에 닿으면 된다.
   */
  headLineY: number;
  /** 합집합에서 가장 낮은 발이 닿아야 하는 y. 한 줄 위까지 허용한다 */
  footLineY: number;
}

/** `frameSetIntegrity`가 프레임 세트에 요구하는 것 — 세트 규칙과 합집합 행을 한 번에 받는다. */
export interface IFrameSetExpectation extends ISetCheckExpectation {
  /** 세트에서 머리가 가장 높이 뜬 장의 머리 꼭대기가 와야 하는 y. 한 줄 아래까지 허용한다 */
  headLineY: number;
}

/** 프레임 한 장의 실측. */
export interface IFrameMeasurement {
  /** 0부터 세는 프레임 번호 */
  index: number;
  /** 임계값을 넘은 픽셀 수. 0이면 빈 프레임이다 */
  opaquePixels: number;
  /** 발 밑선 y. 내용이 없으면 `null` */
  footLineY: number | null;
  /** 머리 꼭대기 y — 알파를 정리한 뒤 내용이 있는 가장 위 줄. 내용이 없으면 `null` */
  topLineY: number | null;
}

/** `frameSetCheck`·`frameSetIntegrity`의 결과. */
export interface IFrameSetReport {
  /** 위반 목록. 빈 배열이면 통과다 */
  problems: string[];
  /** 프레임별 실측 — 판정이 떨어져도 사람이 읽을 값이고, `unionRowCheck`가 받는 모양이다 */
  frames: IFrameMeasurement[];
}

/** `unionRowCheck`의 결과. */
export interface IUnionRowReport {
  /** 위반 목록. 빈 배열이면 통과다 */
  problems: string[];
}

/**
 * 두 프레임이 사람 눈에 다른 그림인지 본다 — 알파를 정리한 사본끼리 견준다.
 *
 * 캔버스가 다르면 잰 자리가 서로 다른 픽셀을 가리키므로 비교하지 않고 다른 그림으로 본다.
 * 캔버스 위반은 그 자체로 따로 보고되니, 여기서 또 잡으면 한 결함이 두 줄이 된다.
 *
 * 색은 **양쪽 다 보이는 픽셀에서만** 본다. 투명한 자리에 남은 색은 화면에 안 나오므로, 그것까지
 * 세면 보이지도 않는 차이로 「움직였다」가 된다.
 *
 * @param upTo 이 값 이하의 채널 차이는 같은 것으로 본다
 */
function framesDiffer(a: IRgbaImage, b: IRgbaImage, upTo: number): boolean {
  if (a.width !== b.width || a.height !== b.height) return true;

  for (let i = 0; i < a.data.length; i += 4) {
    const alphaA = a.data[i + 3];
    const alphaB = b.data[i + 3];
    if (Math.abs(alphaA - alphaB) > upTo) return true;
    if (alphaA === 0 || alphaB === 0) continue;
    for (let c = 0; c < 3; c++) {
      if (Math.abs(a.data[i + c] - b.data[i + c]) > upTo) return true;
    }
  }
  return false;
}

/**
 * (방향, 동작) 세트 하나를 여섯 가지로 잰다 — 개수 · 같은 캔버스 · 빈 프레임 · 이웃 간 차이 ·
 * 루프 이음새 · 프레임별 발 밑선.
 *
 * **`normalizeAlpha`를 지난 사본에 대고 잰다.** `footLineY`는 알파를 `> 0`으로 재고 임계값
 * 인자가 없는데(네 방향 정렬에서 발끝 안티앨리어싱을 살려야 했기 때문이다), 그 함수를
 * 안티앨리어싱이 남은 원본에 부르면 발 밑선이 발이 아니라 알파 1~3짜리 술의 최하단이 된다.
 * 그러면 정상 렌더가 「기준보다 아래」로 떨어진다. 그 함수의 시그니처는 바꾸지 않는다 —
 * 바꾸면 그 동작에 의존하는 4방향 정렬 판정이 함께 틀어진다.
 *
 * **이웃 간 차이가 이 판정의 핵심이다.** 렌더 루프에서 프레임 번호 갱신을 빠뜨리면 여덟 장이
 * 전부 같은 그림으로 나오는데, 파일도 알파도 캔버스도 정상이라 나머지 검사를 다 통과한다.
 * 그 결과는 Cocos에서 「안 움직인다」로 보여, 원인이 굽는 쪽에 있는데도 사람이 재생 설정과
 * Trim을 뒤지게 만든다. **픽셀별로 견주고 불투명 픽셀 수는 세지 않는다** — 숨쉬기 대기는 가슴만
 * 오르내려 이웃 두 장의 넓이가 같을 수 있고, 넓이가 같은 다른 자세도 있어서 수로만 재면 정상
 * 렌더가 떨어진다. 떨어진 두 프레임이 같은 것은 잡지 않는다 — 걷기는 주기 운동이라 같은
 * 실루엣으로 돌아오는 것이 정상이다. 다만 **마지막 장과 첫 장은 이웃으로 본다.** 클립이 Loop로
 * 돌아 마지막 장 다음에 첫 장이 오는데, 샘플링이 한 주기의 끝 프레임까지 넣으면 그 둘이 같은
 * 자세라 재생이 이음새에서 한 박자 멈춘다.
 *
 * **발 밑선은 절대 기준으로 잰다.** 걷기에서는 발 밑선이 정당하게 움직이므로 「프레임끼리
 * 얼마나 다른가」는 판정이 못 된다. 절대 기준을 쓰면 세트가 자기들끼리만 맞고 통째로 허용 폭
 * 밖에 서 있는 경우가 걸린다.
 *
 * @param frames 구운 프레임. 렌더 순서대로 와야 이웃 판정이 성립한다
 * @param expected 이 세트에 요구하는 것
 */
export function frameSetCheck(
  frames: readonly IRgbaImage[],
  expected: ISetCheckExpectation,
): IFrameSetReport {
  const faintUpTo = expected.faintUpTo ?? 16;
  const neighborDiffUpTo = expected.neighborDiffUpTo ?? NEIGHBOR_DIFF_UP_TO;
  const problems: string[] = [];

  // 재기 전에 알파를 누른다. 이 한 줄이 §4.1의 순서 규칙이고, 빼면 발 밑선이 발 대신
  // 안티앨리어싱 술의 최하단으로 내려가 정상 렌더가 아래 발 밑선 판정에 걸린다. 이웃 비교도
  // 같은 사본에 대고 해야 눌러 없앤 잡음이 「움직였다」로 살아나지 않는다.
  const normalized = frames.map((img) => normalizeAlpha(img, { faintUpTo }));

  const measured: IFrameMeasurement[] = normalized.map((img, index) => {
    let opaquePixels = 0;
    for (let i = 3; i < img.data.length; i += 4) {
      if (img.data[i] > 0) opaquePixels++;
    }
    return {
      index,
      opaquePixels,
      footLineY: footLineY(img),
      topLineY: trimBox(img)?.y ?? null,
    };
  });

  if (frames.length !== expected.count) {
    problems.push(`프레임이 ${frames.length}장인데 ${expected.count}장을 기대했다`);
  }

  frames.forEach((img, index) => {
    if (img.width === expected.width && img.height === expected.height) return;
    problems.push(
      `프레임 ${index}의 캔버스가 ${img.width}×${img.height}인데 ` +
        `${expected.width}×${expected.height}를 기대했다`,
    );
  });

  for (const m of measured) {
    if (m.opaquePixels === 0) {
      problems.push(`프레임 ${m.index}이 비었다 — 알파 ${faintUpTo}을 넘는 픽셀이 없다`);
    }
  }

  for (let i = 0; i + 1 < normalized.length; i++) {
    if (framesDiffer(normalized[i], normalized[i + 1], neighborDiffUpTo)) continue;
    problems.push(
      `프레임 ${i}과 ${i + 1}이 픽셀까지 같다 — 렌더 루프가 프레임을 갱신하지 않았을 수 있다`,
    );
  }

  // 루프 이음새. 두 장짜리 세트는 이음새가 곧 위의 이웃 쌍이라 같은 위반을 두 번 적지 않는다.
  if (normalized.length >= 3) {
    const lastIndex = normalized.length - 1;
    if (!framesDiffer(normalized[lastIndex], normalized[0], neighborDiffUpTo)) {
      problems.push(
        `프레임 ${lastIndex}과 0(루프 이음새)이 픽셀까지 같다 — 한 주기의 끝 프레임까지 뽑아 ` +
          '첫 장과 같은 자세가 들어갔을 수 있다',
      );
    }
  }

  const lowest = expected.footLineY - expected.footLineTolerance;
  for (const m of measured) {
    // 빈 프레임은 발 밑선을 잡을 수 없다. 위에서 이미 그 이유로 보고했으므로 같은 원인을
    // 두 번 적지 않는다.
    if (m.footLineY === null) continue;
    if (m.footLineY >= lowest && m.footLineY <= expected.footLineY) continue;
    problems.push(
      `프레임 ${m.index}의 발 밑선이 ${m.footLineY}인데 ` +
        `${lowest}~${expected.footLineY} 안이어야 한다`,
    );
  }

  return { problems, frames: measured };
}

/**
 * 여러 세트의 실측을 합쳐 인물의 크기를 잰다 — 머리 꼭대기 행과 발 밑선이다.
 *
 * 카메라는 모든 방향·동작을 합친 상자의 가장 높은 점을 머리 행에, 가장 낮은 점을 발 밑선에
 * 놓는다. 그러므로 합집합에서 가장 높이 뜬 머리와 가장 낮은 발은 각자의 행에 닿아야 한다.
 * 닿지 않으면 인물이 규격보다 작거나 크게 구워졌거나 허용 폭 안에서 통째로 떠 있는 것인데,
 * 이 결함은 세트마다 거는 발 밑선·빈 프레임·이웃 판정을 전부 통과한다.
 *
 * **이 판정은 몸 층에만 건다.** 상의·무기 층은 몸보다 작게 구워지는 것이 정상이라 같은 규칙을
 * 걸면 정상 렌더가 떨어진다. 층마다 무엇을 거는지는
 * `docs/development/sessions/2026-09-15-blender-3d-gate-round2-g4-bake.md` §4가 든다.
 *
 * @param sets 세트별 실측. `frameSetCheck`가 돌려준 `frames`를 그대로 넣는다
 * @param expected 합집합에 요구하는 행
 */
export function unionRowCheck(
  sets: readonly (readonly IFrameMeasurement[])[],
  expected: IUnionRowExpectation,
): IUnionRowReport {
  const problems: string[] = [];
  const measured = sets.flat();

  const tops = measured.flatMap((m) => (m.topLineY === null ? [] : [m.topLineY]));
  if (tops.length > 0) {
    const highest = Math.min(...tops);
    const headLimit = expected.headLineY + SET_EDGE_TOLERANCE;
    if (highest < expected.headLineY || highest > headLimit) {
      problems.push(
        `세트에서 가장 높이 뜬 머리가 ${highest}행인데 ${expected.headLineY}~${headLimit}행이어야 ` +
          `한다 — ${highest > headLimit ? '인물이 규격보다 작게 구워졌거나 세트가 아래로 밀렸다' : '인물이 규격보다 크게 구워졌거나 세트가 위로 떴다'}`,
      );
    }
  }

  const feet = measured.flatMap((m) => (m.footLineY === null ? [] : [m.footLineY]));
  if (feet.length > 0) {
    const deepest = Math.max(...feet);
    const footLimit = expected.footLineY - SET_EDGE_TOLERANCE;
    // 발 밑선보다 아래로 내려간 장은 세트 검사의 프레임별 판정이 이미 보고했으므로 위쪽만 본다.
    if (deepest < footLimit) {
      problems.push(
        `세트에서 가장 낮은 발이 ${deepest}행인데 ${footLimit}~${expected.footLineY}행이어야 ` +
          '한다 — 어느 장도 발 밑선에 닿지 않았다. 세트가 통째로 떴거나 인물이 작게 구워졌다',
      );
    }
  }

  return { problems };
}

/**
 * 세트 하나에 세트 규칙과 합집합 행을 함께 건다 — `frameSetCheck`와 `unionRowCheck`의 래퍼다.
 *
 * 한 방향·한 동작만 굽던 1라운드가 이 모양을 쓴다. 층과 방향이 늘어난 뒤로는 층마다 거는
 * 규칙이 달라지므로, 새 굽기는 두 함수를 따로 부른다.
 *
 * @param frames 구운 프레임. 렌더 순서대로 와야 이웃 판정이 성립한다
 * @param expected 이 세트에 요구하는 것
 */
export function frameSetIntegrity(
  frames: readonly IRgbaImage[],
  expected: IFrameSetExpectation,
): IFrameSetReport {
  const set = frameSetCheck(frames, expected);
  const union = unionRowCheck([set.frames], {
    headLineY: expected.headLineY,
    footLineY: expected.footLineY,
  });

  return { problems: [...set.problems, ...union.problems], frames: set.frames };
}
