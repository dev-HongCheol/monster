/**
 * 생성 시트를 인물 한 명씩의 패널로 가르는 순수 로직 — 디스크도 PNG도 모른다.
 *
 * 이 단계를 자동화하는 이유가 있다. 배경 제거를 매팅 모델로 옮기면 시트마다 다시 재던
 * 색 임계값 셋이 사라지는데, **크롭만은 여전히 손측정으로 남기 때문이다.** 실제로 첫
 * 캐릭터의 네 인물은 (56–285, 331–550, 605–811, 840–1047)에 서 있어 균등 4분할과 다르다.
 * 폭을 나눠 자르면 팔이 잘리거나 옆 인물이 딸려 들어오고, 그러면 매팅이 무엇을 하든
 * 결과가 틀린다.
 */

/** 열 구간 하나 — 양끝을 포함한다. */
export interface IColumnRange {
  from: number;
  to: number;
}

/** `panelColumns`의 판정 기준. */
export interface IPanelColumnsOptions {
  /** 시트의 배경색 `[r, g, b]` */
  background: readonly [number, number, number];
  /** 배경색과의 거리가 이 값 미만이면 그 픽셀은 배경이다 */
  maxDistance: number;
  /**
   * 한 열을 「인물이 있는 열」로 볼 최소 전경 픽셀 수. 기본 1.
   *
   * 생성 시트의 배경은 완전한 단색이 아니라 약한 잡음이 있어서, 1로 두면 잡음 한 점이
   * 구간을 쪼갠다. 그러면 패널이 넷이 아니라 수십 개로 나온다.
   */
  minColumnPixels?: number;
}

/** `cropColumns`의 여백 설정. */
export interface ICropColumnsOptions {
  /**
   * 구간 양옆으로 더 붙일 열 수. 캔버스 끝에서 멈춘다. 기본 0.
   *
   * `panelColumns`가 내는 구간은 「전경 픽셀이 기준 개수 이상인 열」의 범위라, 인물의 가장
   * 바깥 한두 열이 구간 밖에 남는다 — 첫 시트에서 여덟 경계 중 셋이 그랬다(전경 1~2px).
   * 여백 없이 자르면 그 열이 잘리고, 게다가 매팅이 알파를 원본 색 경계보다 조금 넓게 잡아
   * 결과가 패널 끝에 딱 붙는다. 그러면 윤곽이 아니라 **자른 자리**가 직선으로 남는다.
   */
  margin?: number;
}

/**
 * 열 구간 하나를 패널 이미지로 떼어 낸다. 세로는 시트 전체를 그대로 쓴다.
 *
 * 세로를 안 자르는 이유는 발 밑선이 시트 좌표계에서 정해지기 때문이다. 패널마다 위아래를
 * 다르게 자르면 네 장의 발 밑선이 서로 다른 기준을 갖게 되고, 정렬은 그 뒤에 한 번에 한다.
 *
 * @throws 구간이 캔버스를 벗어나거나 뒤집혀 있으면
 */
export function cropColumns(
  img: { width: number; height: number; data: Uint8Array },
  range: IColumnRange,
  opts: ICropColumnsOptions = {},
): { width: number; height: number; data: Uint8Array } {
  if (range.from < 0 || range.to >= img.width || range.from > range.to) {
    throw new Error(`구간이 캔버스(폭 ${img.width})를 벗어난다: ${range.from}-${range.to}`);
  }

  const margin = opts.margin ?? 0;
  const from = Math.max(0, range.from - margin);
  const to = Math.min(img.width - 1, range.to + margin);

  const width = to - from + 1;
  const data = new Uint8Array(width * img.height * 4);
  for (let y = 0; y < img.height; y++) {
    const src = (y * img.width + from) * 4;
    data.set(img.data.subarray(src, src + width * 4), y * width * 4);
  }
  return { width, height: img.height, data };
}

/** 픽셀 하나가 배경색에서 얼마나 떨어졌는지. 제곱 거리를 그대로 쓴다(제곱근 생략). */
function distanceSq(
  data: Uint8Array,
  offset: number,
  bg: readonly [number, number, number],
): number {
  const dr = data[offset] - bg[0];
  const dg = data[offset + 1] - bg[1];
  const db = data[offset + 2] - bg[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * 배경만 있는 열을 경계로 삼아 인물이 서 있는 열 구간을 찾는다.
 *
 * 균등 분할을 가정하지 않는다 — 생성 모델은 인물을 시트에 고르게 배치해 주지 않으므로,
 * 구간 수도 폭도 시트가 정하게 두고 호출부가 개수를 확인한다.
 *
 * @param img 배경이 아직 남아 있는 원본 시트(매팅 전이다 — 알파가 아니라 색으로 가른다)
 * @returns 왼쪽부터 순서대로의 열 구간. 전경이 없으면 빈 배열
 */
export function panelColumns(
  img: { width: number; height: number; data: Uint8Array },
  opts: IPanelColumnsOptions,
): IColumnRange[] {
  const maxDistanceSq = opts.maxDistance * opts.maxDistance;
  const minPixels = opts.minColumnPixels ?? 1;

  const ranges: IColumnRange[] = [];
  let start = -1;

  for (let x = 0; x < img.width; x++) {
    let foreground = 0;
    for (let y = 0; y < img.height; y++) {
      if (distanceSq(img.data, (y * img.width + x) * 4, opts.background) >= maxDistanceSq) {
        foreground++;
        if (foreground >= minPixels) break;
      }
    }

    const occupied = foreground >= minPixels;
    if (occupied && start < 0) start = x;
    else if (!occupied && start >= 0) {
      ranges.push({ from: start, to: x - 1 });
      start = -1;
    }
  }
  if (start >= 0) ranges.push({ from: start, to: img.width - 1 });

  return ranges;
}
