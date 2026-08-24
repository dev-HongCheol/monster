/**
 * 출하 규격 판정과 원자적 교체 — 열두 장을 한꺼번에 갈아 끼우는 마지막 관문이다.
 *
 * **여기가 있는 이유는 절반만 새 판인 상태가 가장 나쁘기 때문이다.** 네 방향이 서로 다른
 * 파이프라인 산물이 되면 어느 것이 기준인지 알 방법이 없고, 화면에서는 방향을 바꿀 때만
 * 드러나므로 한참 뒤에야 발견된다. 그래서 판정을 **전부 먼저** 돌리고 한 장이라도 떨어지면
 * 아무것도 쓰지 않는다.
 *
 * 판정을 실행기(`build.ts`)에서 갈라 둔 것은 이 부분이 디스크도 네트워크도 안 만지기
 * 때문이다. 규격이 바뀌면 여기만 고치고, 그 규격을 시험하는 것은 합성 픽스처면 된다.
 */

import {
  alphaHistogram,
  type IBox,
  type IRgbaImage,
  trimBox,
} from '../../tests/helpers/SpriteMetrics.ts';
import { footBand, type IFootBandOptions } from './Postprocess.ts';

/** 열두 장이 모두 지켜야 하는 값. */
export interface IShippingSpec {
  /** 목표 캔버스 가로 */
  width: number;
  /** 목표 캔버스 세로 */
  height: number;
  /** 발 밑선이 놓일 y */
  baselineY: number;
  /**
   * 발 중심이 놓일 x. 보통 캔버스 가로 중앙(`(width - 1) / 2`)이다.
   *
   * **이 슬라이스가 통째로 매달린 값이라 관문이 반드시 잰다.** 정렬이 어떤 이유로든 가로를
   * 놓치면 「전부 통과할 때만 쓴다」가 그것을 그냥 지나보내고, 어긋난 캐릭터는 방향을 바꿀
   * 때만 드러나 한참 뒤에 발견된다.
   */
  centerX: number;
  /**
   * 발을 어떻게 찾을지. 생략하면 `footBand`의 기본값.
   *
   * 규격이 이 인자를 드는 이유는 **정렬과 판정이 같은 기준으로 발을 찾게** 하기 위해서다.
   * 실행기가 정렬에 넘긴 값과 판정이 쓰는 값이 갈리면 「A로 세우고 B로 잰다」가 되어,
   * 통과한 출하물이 실제로는 다른 자리에 서 있을 수 있다.
   */
  foot?: IFootBandOptions;
  /**
   * 트림 상자 세로 상한.
   *
   * 캔버스 세로에서 발 밑선 아래 여백을 뺀 값이다. 넘으면 `alignToCanvas`가 던지는데,
   * 여기서 먼저 잡아야 **어느 장이 얼마나 큰지**가 메시지에 남는다.
   */
  maxTrimHeight: number;
  /**
   * 서로 좌우 대칭이어야 하는 두 방향의 이름.
   *
   * 실행기가 쓰는 방향 이름을 규격이 들게 한 것은, 여기에 `left`·`right`를 박아 두면 방향
   * 이름을 바꿀 때 판정이 조용히 아무 짝도 못 찾는 상태가 되기 때문이다. 짝을 못 찾으면
   * 위반이 0건이라 화면에서는 통과와 구별되지 않는다.
   */
  mirrorDirections: readonly [string, string];
  /**
   * 좌우 두 장의 트림 가로가 서로 벗어나도 되는 비율.
   *
   * **정상 편차와 결함 사이가 넓어서 고르기 쉬운 값이다.** 아래 수치는 전부 `spread`가 내는
   * 값이다(큰 쪽으로 나눈다). 실측에서 정상인 두 시트가 1.2%와 1.3%였고(옷 173/171 ·
   * 대머리 150/148), 팔 하나가 통째로 안 그려진 시트가 16.0%였다(맨살 110/131). 생성 모델이
   * 좌우를 따로 그리므로 0을 요구하면 정상 산출물이 매번 막힌다.
   */
  mirrorWidthTolerance: number;
  /**
   * 같은 방향에서 시트끼리 트림 세로가 벗어나도 되는 비율.
   *
   * 세 시트는 같은 인물의 층이라 인물 크기가 같아야 한다. 맨살만 6.2% 작게 그려진 것이
   * 결함이었다(455 대 485).
   *
   * **4%는 두 몫을 합친 예산이지 한 몫이 아니다.** 정당하게 갈리는 이유가 둘이고 더해진다 —
   * 생성 모델이 시트마다 조금씩 다르게 그리는 몫이 실측 1.0%(옷 480 대 대머리 485)이고,
   * 맨발과 부츠의 밑창 두께가 넉넉히 잡아 2.5%다. 그래서 남는 여유는 1.5%가 아니라 0.5%에
   * 가깝다. 이 값을 다시 잡을 사람은 그 합을 보고 정해야 한다.
   *
   * 잘못 걸렸을 때의 대가는 크지 않다 — 관문은 매팅 **뒤에** 오고 응답이 캐시에 남으므로,
   * 값을 고쳐 다시 돌리는 데 과금이 0이다.
   */
  figureHeightTolerance: number;
}

/**
 * 내보낼 한 장. `name`은 위반 메시지에 그대로 실린다.
 *
 * `sheet`와 `direction`을 따로 드는 것은 **장끼리 비교하는 판정이 짝을 찾아야** 하기 때문이다
 * (`crossItemViolations`). 이름에서 뽑아 쓸 수도 있지만, 그러면 이름 짓는 규칙이 곧 판정의
 * 입력이 되어 파일 이름을 바꾸는 순간 판정이 짝을 잃는다 — 그때 위반은 0건으로 나온다.
 */
export interface IShipItem {
  name: string;
  image: IRgbaImage;
  /** 이 장을 낸 시트. 같은 값을 가진 장끼리 좌우 대칭을 잰다 */
  sheet: string;
  /** 이 장의 방향. 같은 값을 가진 장끼리 시트 간 인물 크기를 잰다 */
  direction: string;
}

/**
 * 규격 위반을 사람이 읽을 문장으로 돌려준다. 빈 배열이면 통과다.
 *
 * **문장마다 앞에 이름을 붙인다.** 열두 장을 한 번에 판정하므로 이름이 빠지면 어느 장을 다시
 * 뽑아야 하는지 알 수 없고, 결국 열두 장을 하나씩 열어 보게 된다.
 *
 * 위반을 처음 하나에서 멈추지 않고 다 모으는 것도 같은 이유다. 하나만 말하면 고치고 다시
 * 돌릴 때마다 다음 하나가 나오는데, 이 판정 앞에는 유료 매팅 호출이 있다.
 */
export function specViolations(item: IShipItem, spec: IShippingSpec): string[] {
  const { name, image } = item;
  const problems: string[] = [];

  if (image.width !== spec.width || image.height !== spec.height) {
    problems.push(
      `${name}: 캔버스가 ${image.width}×${image.height}다 (기대 ${spec.width}×${spec.height})`,
    );
  }

  const faint = alphaHistogram(image).faint;
  if (faint > 0) {
    problems.push(`${name}: 희미한 알파(1~16)가 ${faint}px 남았다 (기대 0px)`);
  }

  const foot = footBand(image, spec.foot);
  if (foot === null) {
    problems.push(`${name}: 발을 못 찾아 밑선을 잴 수 없다`);
  } else {
    if (foot.baselineY !== spec.baselineY) {
      problems.push(`${name}: 발 밑선이 ${foot.baselineY}다 (기대 ${spec.baselineY})`);
    }
    // 허용 폭 0.5는 조절값이 아니다. `alignToCanvas`가 밀 거리를 정수로 반올림하므로 중심이
    // 목표에서 최대 반 픽셀 남는 것이 정상이고, 그보다 벗어났다면 반올림이 아니라 기준이
    // 어긋난 것이다.
    if (Math.abs(foot.centerX - spec.centerX) > 0.5) {
      problems.push(`${name}: 발 중심이 ${foot.centerX}다 (기대 ${spec.centerX} ±0.5)`);
    }
  }

  const box = trimBox(image);
  if (box === null) {
    problems.push(`${name}: 알파가 있는 픽셀이 하나도 없다`);
  } else if (box.height > spec.maxTrimHeight) {
    problems.push(`${name}: 트림 세로가 ${box.height}다 (상한 ${spec.maxTrimHeight})`);
  }

  return problems;
}

/** 두 값이 큰 쪽 기준으로 얼마나 벌어졌는가. 둘 다 0이면 0이다. */
function spread(a: number, b: number): number {
  const max = Math.max(a, b);
  return max === 0 ? 0 : Math.abs(a - b) / max;
}

/** 트림 상자를 못 잡은 장은 `specViolations`가 이미 말하므로 여기서는 뺀다. */
function boxed(items: readonly IShipItem[]): Array<{ item: IShipItem; box: IBox }> {
  return items.flatMap((item) => {
    const box = trimBox(item.image);
    return box ? [{ item, box }] : [];
  });
}

/**
 * 장끼리 비교해야만 드러나는 어긋남을 찾는다. 빈 배열이면 통과다.
 *
 * **한 장씩 보는 판정으로는 못 잡는 결함이 있다.** 캔버스도 발 밑선도 발 중심도 규격 안인 두
 * 장이, 서로 견주면 같은 인물이 아닌 경우다. 2026-08-24 리워크에서 실제로 둘이 나왔다 —
 * 맨살 시트의 왼쪽 패널에서 지팡이 쥐던 팔이 통째로 안 그려졌고(트림 가로 110 대 131), 맨살
 * 시트만 인물이 6% 작게 그려졌다(트림 세로 455 대 480·485). 열두 장이 전부 `specViolations`를
 * 통과했고, 사람이 눈으로 볼 때까지 아무도 몰랐다.
 *
 * 재는 것이 둘이다.
 *
 * 1. **같은 시트의 좌우 트림 가로.** 좌우는 같은 인물을 반대에서 본 것이라 실루엣 폭이 비슷해야
 *    한다. 한쪽 팔이 빠지면 그 폭만큼 갈린다.
 * 2. **같은 방향의 시트 간 트림 세로.** 세 시트는 같은 인물의 층이고 `alignToCanvas`는 크기를
 *    안 건드리므로, 시트 하나가 다른 배율로 그려지면 그대로 출하된다. 층 구조는 맨살 위에 옷을
 *    얹는 것이라(`art-direction.md` §6) 몸이 작으면 소매가 팔을 안 덮는다.
 *
 * 방향을 가로질러 세로를 비교하지는 않는다. 정면과 측면은 실루엣이 달라 트림 세로도 다를 수
 * 있고, 섞어 재면 정상 편차가 위반이 되어 사람이 판정을 끄게 된다.
 */
export function crossItemViolations(items: readonly IShipItem[], spec: IShippingSpec): string[] {
  const problems: string[] = [];
  const measured = boxed(items);

  const [leftName, rightName] = spec.mirrorDirections;
  const sheets = [...new Set(measured.map(({ item }) => item.sheet))];
  for (const sheet of sheets) {
    const ofSheet = measured.filter(({ item }) => item.sheet === sheet);
    const left = ofSheet.find(({ item }) => item.direction === leftName);
    const right = ofSheet.find(({ item }) => item.direction === rightName);
    // 짝이 없으면 안 잰다. 실행기는 네 방향을 다 내지만 시험과 부분 실행은 한두 장만 넘긴다.
    if (!left || !right) continue;
    if (spread(left.box.width, right.box.width) <= spec.mirrorWidthTolerance) continue;
    problems.push(
      `${left.item.name}와 ${right.item.name}의 트림 가로가 ${left.box.width}와 ${right.box.width}로 갈렸다 ` +
        `(서로 ${(spec.mirrorWidthTolerance * 100).toFixed(0)}% 안이어야 한다 — 한쪽 팔이 안 그려졌을 수 있다)`,
    );
  }

  const directions = [...new Set(measured.map(({ item }) => item.direction))];
  for (const direction of directions) {
    const ofDirection = measured.filter(({ item }) => item.direction === direction);
    if (ofDirection.length < 2) continue;
    // 가장 큰 장과 가장 작은 장만 말한다. 셋 이상일 때 모든 짝을 늘어놓으면 문장이 늘어나기만
    // 하고, 사람이 다시 뽑을 대상은 결국 양 끝 둘이다.
    const sorted = [...ofDirection].sort((a, b) => a.box.height - b.box.height);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    if (spread(low.box.height, high.box.height) <= spec.figureHeightTolerance) continue;
    problems.push(
      `${direction} 방향의 인물 키가 시트마다 다르다: ${low.item.name} ${low.box.height} · ${high.item.name} ${high.box.height} ` +
        `(서로 ${(spec.figureHeightTolerance * 100).toFixed(0)}% 안이어야 한다 — 한 시트가 다른 배율로 그려졌다)`,
    );
  }

  return problems;
}

/**
 * 전부 통과할 때만 준 순서대로 쓴다.
 *
 * **원자성이 미치는 범위는 규격 판정까지다.** 판정을 전부 먼저 돌리므로 규격에서 떨어진
 * 장이 있으면 `write`가 한 번도 안 불린다. 반면 `write` **자체가 던지는 것**은 못 막는다 —
 * 이 파이프라인은 사용자가 Cocos 에디터를 열어 둔 채로 돌리는 것을 전제하는데, Windows에서
 * 에디터가 임포트 중인 PNG를 잡고 있으면 덮어쓰기가 `EBUSY`로 떨어진다. 그때 앞서 쓴 것은
 * 남으므로, **무엇이 남았는지를 예외 메시지가 이름으로 말한다.** 그게 없으면 사람이 열두
 * 장을 하나씩 열어 어느 것이 새 판인지 가려야 한다.
 *
 * 돌리는 판정은 둘이다 — 한 장씩 보는 `specViolations`와 장끼리 견주는 `crossItemViolations`.
 *
 * @param write 한 장을 실제로 내보내는 함수. 디스크를 만지는 것은 부르는 쪽의 몫이다
 * @throws 두 판정 중 하나라도 위반을 내면(`write` 0번), 또는 `write`가 던지면(이미 쓴 것은 남는다)
 */
export function commitAll(
  items: readonly IShipItem[],
  spec: IShippingSpec,
  write: (item: IShipItem) => void,
): void {
  // 한 장씩 보는 판정과 장끼리 견주는 판정을 **여기서 함께** 돌린다. 실행기가 뒤쪽을 따로
  // 부르는 구조면 부르는 것을 잊어도 아무 신호가 없어, 어긋난 열두 장이 조용히 나간다.
  const problems = [
    ...items.flatMap((item) => specViolations(item, spec)),
    ...crossItemViolations(items, spec),
  ];
  if (problems.length > 0) {
    throw new Error(`출하 규격에서 떨어진 장이 있어 아무것도 쓰지 않았다:\n${problems.join('\n')}`);
  }

  const written: string[] = [];
  for (const item of items) {
    try {
      write(item);
    } catch (err) {
      const done = written.length > 0 ? written.join(', ') : '없음';
      throw new Error(
        `${item.name}을(를) 쓰다 실패해 절반만 새 판이다: ${(err as Error).message}\n` +
          `    이미 쓴 장: ${done}\n` +
          '    매팅 결과는 캐시에 있으므로 원인을 없앤 뒤 다시 돌리면 과금 없이 마저 쓴다.',
      );
    }
    written.push(item.name);
  }
}
