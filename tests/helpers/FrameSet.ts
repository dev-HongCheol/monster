/**
 * 구운 걷기 프레임 한 벌이 게임에 실릴 자격이 있는지 재는 순수 판정 — 디스크도 PNG 포맷도 모른다.
 *
 * `SpriteMetrics.ts`가 한 장을 재는 반면 이 파일은 **세트를 잰다.** 프레임 하나하나가
 * 멀쩡해도 세트로는 틀릴 수 있기 때문이다. 여덟 장이 전부 같은 그림인 경우, 프레임마다
 * 캔버스가 다른 경우, 세트가 통째로 다른 높이에 서 있는 경우가 그렇고, 셋 다 한 장만 보면
 * 정상이다.
 *
 * 판정을 RGBA 배열에만 걸어 두는 이유는 `SpriteMetrics.ts`와 같다 — 파일을 읽는 것은
 * `PngCodec.ts` 하나가 맡고, 실행기와 벤치가 같은 판정을 나눠 쓴다.
 */

import { normalizeAlpha } from '../../tools/art/Postprocess.ts';
import { footLineY, type IRgbaImage } from './SpriteMetrics.ts';

/**
 * 플레이어 프레임이 서야 하는 캔버스와 발 밑선.
 *
 * 2026-08-07에 실측으로 닫힌 값이고 출하된 4방향 넷이 이미 이 규격에 서 있다. 3D에서 구운
 * 프레임이 같은 자리에 서지 않으면 게임 안에서 캐릭터가 바닥을 뚫거나 떠오른다. 이 값을
 * 왜 이렇게 정했는지는 `docs/design/spec/art-asset-spec.md` §12가 든다.
 */
export const PLAYER_FRAME_SPEC = { width: 246, height: 493, footLineY: 489 } as const;

/** `frameSetIntegrity`가 프레임 세트에 요구하는 것. */
export interface IFrameSetExpectation {
  /** 기대 프레임 수 */
  count: number;
  /** 캔버스 가로 */
  width: number;
  /** 캔버스 세로 */
  height: number;
  /** 발 밑선이 와야 하는 y */
  footLineY: number;
  /** 발 밑선이 기준에서 **위로** 벗어나도 되는 픽셀 수. 걷기는 발이 정당하게 떠오른다 */
  footLineTolerance: number;
  /** 이 값 이하의 알파를 내용으로 안 센다. 기본 16 — `normalizeAlpha`와 같은 기준값이다 */
  faintUpTo?: number;
}

/** 프레임 한 장의 실측. */
export interface IFrameMeasurement {
  /** 0부터 세는 프레임 번호 */
  index: number;
  /** 임계값을 넘은 픽셀 수. 0이면 빈 프레임이다 */
  opaquePixels: number;
  /** 발 밑선 y. 내용이 없으면 `null` */
  footLineY: number | null;
}

/** `frameSetIntegrity`의 결과. */
export interface IFrameSetReport {
  /** 위반 목록. 빈 배열이면 통과다 */
  problems: string[];
  /** 프레임별 실측 — 판정이 떨어져도 사람이 읽을 값이다 */
  frames: IFrameMeasurement[];
}

/**
 * 프레임 세트를 다섯 가지로 잰다 — 개수 · 같은 캔버스 · 빈 프레임 · 이웃 간 차이 · 발 밑선.
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
 * Trim을 뒤지게 만든다. 불투명 픽셀 수가 같은 이웃 쌍이 하나도 없을 것으로 잡는다. 떨어진
 * 두 프레임이 같은 것은 잡지 않는다 — 걷기는 주기 운동이라 같은 실루엣으로 돌아오는 것이
 * 정상이다.
 *
 * **발 밑선은 절대 기준으로 잰다.** 걷기에서는 발 밑선이 정당하게 움직이므로 「프레임끼리
 * 얼마나 다른가」는 판정이 못 된다. 절대 기준을 쓰면 세트가 자기들끼리만 맞고 통째로 다른
 * 높이에 서 있는 경우도 걸린다.
 *
 * @param frames 구운 프레임. 렌더 순서대로 와야 이웃 판정이 성립한다
 * @param expected 이 세트에 요구하는 것
 */
export function frameSetIntegrity(
  frames: readonly IRgbaImage[],
  expected: IFrameSetExpectation,
): IFrameSetReport {
  const faintUpTo = expected.faintUpTo ?? 16;
  const problems: string[] = [];

  // 재기 전에 알파를 누른다. 이 한 줄이 §4.1의 순서 규칙이고, 빼면 발 밑선이 발 대신
  // 안티앨리어싱 술의 최하단으로 내려가 정상 렌더가 아래 발 밑선 판정에 걸린다.
  const measured: IFrameMeasurement[] = frames.map((img, index) => {
    const normalized = normalizeAlpha(img, { faintUpTo });
    let opaquePixels = 0;
    for (let i = 3; i < normalized.data.length; i += 4) {
      if (normalized.data[i] > 0) opaquePixels++;
    }
    return { index, opaquePixels, footLineY: footLineY(normalized) };
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

  for (let i = 0; i + 1 < measured.length; i++) {
    const [a, b] = [measured[i], measured[i + 1]];
    if (a.opaquePixels !== b.opaquePixels) continue;
    problems.push(
      `프레임 ${a.index}과 ${b.index}의 불투명 픽셀 수가 둘 다 ${a.opaquePixels}이다 — ` +
        '렌더 루프가 프레임을 갱신하지 않았을 수 있다',
    );
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
