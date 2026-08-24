/**
 * 매팅 결과를 게임이 쓰는 규격으로 옮기는 순수 변환들.
 *
 * 배경 제거가 끝난 그림은 아직 스프라이트가 아니다. 잡음 알파를 눌러야 Cocos의 Trim이
 * 제 일을 하고, 네 방향을 같은 캔버스·같은 발 밑선에 세워야 방향을 바꿀 때 캐릭터가
 * 제자리에 선다. 그 두 가지가 여기 있다.
 *
 * 세우는 쪽이 기준을 어디서 잡는가가 이 파일의 어려운 부분이고, 그래서 `footBand`가 따로
 * 서 있다. 요구는 하나다 — **소품은 판정에 영향을 주지 않는다.** 그림에 지팡이를 더 그렸다고
 * 캐릭터가 서는 자리가 달라지면 안 된다.
 */

import type { IRgbaImage } from '../../tests/helpers/SpriteMetrics.ts';
import { trimBox } from '../../tests/helpers/SpriteMetrics.ts';

/** `normalizeAlpha`의 임계값. */
export interface INormalizeOptions {
  /** 이 값 이하의 알파를 0으로 누른다. 기본 16 */
  faintUpTo?: number;
  /** 이 값 이상의 알파를 255로 올린다. 기본 254 */
  opaqueFrom?: number;
}

/** `footBand`가 무엇을 발로 볼지. */
export interface IFootBandOptions {
  /**
   * 한 행에서 이만큼 이어지면 발로 본다. 기본 20.
   *
   * **이 값은 「발은 굵고 소품은 가늘다」에 기댄다.** 첫 캐릭터의 발이 발 밑선 근처에서 20~28px로
   * 이어지고 지팡이 막대는 아래 여덟 줄에서 6~12px이라 그 사이가 비어 있다. 발 밑선 근처에서
   * 이 값을 넘는 소품이 오면 그것을 발로 착각하므로, 밑동이 굵은 무기를 들리게 되면 양쪽을 다시
   * 재서 이 값을 옮겨야 한다.
   */
  minRunWidth?: number;
  /**
   * 발 밑선에서 위로 몇 줄까지 발 띠로 볼지. 기본 8.
   *
   * **발을 찾은 굵은 행은 이 값과 무관하게 언제나 띠에 든다.** 발에 이어져 아래로 늘어진
   * 것이 이 줄 수보다 길면 굵은 행이 띠 밖으로 밀려나는데, 그러면 씨앗이 없어 띠가 통째로
   * 비고 발 중심 자리에 **캔버스 정중앙**이 나온다 — 예외도 `null`도 아니라 부르는 쪽이
   * 알아채지 못한다.
   */
  rows?: number;
  /** 이 값 이하의 알파는 없는 것으로 본다. 기본 16 */
  faintUpTo?: number;
}

/** 캐릭터가 딛고 선 자리. 좌표는 전부 픽셀 인덱스다. */
export interface IFootBand {
  /** 발 밑선 — 발에서 이어지는 가장 아래 행 */
  baselineY: number;
  /** 발 띠의 가로 중심 */
  centerX: number;
  /** 발 띠의 왼끝 */
  from: number;
  /** 발 띠의 오른끝 */
  to: number;
}

/** `alignToCanvas`가 놓을 자리. */
export interface IAlignOptions {
  /** 목표 캔버스 가로 */
  width: number;
  /** 목표 캔버스 세로 */
  height: number;
  /** 발 밑선과 캔버스 아래 끝 사이에 남길 픽셀 수 */
  bottomMargin: number;
  /** 발을 어떻게 찾을지. 생략하면 `footBand`의 기본값 */
  foot?: IFootBandOptions;
}

/** 한 행에서 이어지는 구간. 양끝을 포함한다. */
interface IRun {
  from: number;
  to: number;
}

/**
 * 알파를 양끝으로 눌러 규격에 맞춘다. 원본은 건드리지 않는다.
 *
 * 양끝을 다 누르는 이유가 다르다. **아래쪽**은 배경 제거 도구가 피사체 밖에 남기는 희미한
 * 알파를 없앤다 — 그게 남으면 `alpha > 0` 상자가 캔버스 전체가 되어 Cocos의 Trim이 아무것도
 * 잘라내지 못하고, 트림 상자를 기준으로 잡는 종횡비 규칙이 조용히 캔버스 기준으로 떨어진다.
 * **위쪽**은 모델이 내부를 255가 아니라 254로 내놓는 양자화를 되돌린다(`bria`가 그렇다).
 * 안 되돌리면 스프라이트 전체가 아주 살짝 투명한 채로 출하되는데, 눈으로는 안 보인다.
 *
 * 알파를 0으로 누른 자리는 색도 함께 지운다. 완전 투명한 픽셀의 RGB는 화면에 안 나올 것
 * 같지만, 바이리니어 샘플링이 그 값을 이웃 픽셀로 끌어와 캐릭터 외곽에 테두리를 만든다.
 */
export function normalizeAlpha(img: IRgbaImage, opts: INormalizeOptions = {}): IRgbaImage {
  const faintUpTo = opts.faintUpTo ?? 16;
  const opaqueFrom = opts.opaqueFrom ?? 254;
  const data = new Uint8Array(img.data);

  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a <= faintUpTo) {
      data[i - 3] = 0;
      data[i - 2] = 0;
      data[i - 1] = 0;
      data[i] = 0;
    } else if (a >= opaqueFrom) {
      data[i] = 255;
    }
  }
  return { width: img.width, height: img.height, data };
}

/** 한 행에서 알파가 임계값을 넘는 구간을 왼쪽부터 모은다. */
function rowRuns(img: IRgbaImage, y: number, faintUpTo: number): IRun[] {
  const runs: IRun[] = [];
  let start = -1;

  for (let x = 0; x < img.width; x++) {
    const on = img.data[(y * img.width + x) * 4 + 3] > faintUpTo;
    if (on && start < 0) start = x;
    else if (!on && start >= 0) {
      runs.push({ from: start, to: x - 1 });
      start = -1;
    }
  }
  if (start >= 0) runs.push({ from: start, to: img.width - 1 });

  return runs;
}

/** 두 구간이 가로로 겹치는가. 한 칸만 걸쳐도 겹친 것으로 본다. */
function overlaps(a: IRun, b: IRun): boolean {
  return a.from <= b.to && b.from <= a.to;
}

/**
 * 캐릭터가 딛고 선 자리를 잰다 — **그림에 무엇이 더 그려져 있든 같은 값이 나와야 한다.**
 *
 * 기준이 둘 있고 둘 다 쓰지 못한 이유가 다르다. **트림 상자의 중심**은 머리카락이 비대칭이라
 * 못 쓴다 — 첫 캐릭터의 측면 두 장이 머리카락 때문에 23px씩 반대 방향으로 밀렸고, 그 중심에
 * 맞춰 세우면 좌우를 오갈 때 캐릭터가 가로로 미끄러진다. **아래 여덟 줄의 바깥 상자**는 그
 * 문제를 피하지만 소품에 걸린다 — 상자는 그 띠 안에 있는 것이 굵은 발인지 6px짜리 막대인지
 * 가리지 않으므로, 지팡이가 발치에 서 있기만 해도 중심이 여덟 픽셀 밀리고 지팡이 끝이 발보다
 * 아래로 내려오면 그것이 발 밑선 노릇을 한다. 그러면 **그림에 무엇을 더 그렸느냐가 캐릭터가
 * 서는 자리를 바꾼다**(2026-08-23 사용자 지적).
 *
 * 그래서 발을 먼저 찾고 거기서만 잰다. 순서가 셋이다.
 *
 * 1. **굵은 줄이 있는 가장 아래 행을 찾는다.** 한 행에서 `minRunWidth` 이상 이어지는 구간이
 *    있으면 그것은 발이다. 지팡이 막대는 그 절반에 못 미쳐 후보에 안 든다.
 * 2. **거기서 겹치며 아래로 따라 내려간 행이 발 밑선이다.** 굵은 행에서 멈추면 안 되는데,
 *    발끝이 안티에일리어싱으로 가늘어져 굵기 기준에 안 걸리기 때문이다. 네 장의 가늘어진
 *    정도가 서로 다르면 방향을 바꿀 때 캐릭터가 세로로 튄다. 이 하강에는 줄 수 제한이
 *    없다 — 발에 이어져 늘어진 것이 있으면 그 끝까지 따라간다.
 * 3. **발 띠 안에서 굵은 구간과 이어 붙는 것만 모아 중심을 잰다.** 손이 지팡이를 쥐고 있어
 *    그림 전체로는 몸과 지팡이가 한 덩어리지만, 발 띠 안에서는 둘이 떨어져 있어 갈린다.
 *
 * 씨앗은 굵은 구간이되 거기서 이어지는 것은 굵기를 다시 묻지 않는다. 발가락처럼 굵은 줄에서
 * 갈라져 나온 가는 구간을 떨구면 발 띠가 좁아져 중심이 도로 밀린다.
 *
 * 알파 `faintUpTo` 이하를 없는 것으로 보는 것은 이 함수가 「불투명 픽셀」을 잰다고 말하기
 * 때문이다. 알파 1~16은 `normalizeAlpha`가 0으로 누르기로 한 잡음이고 실행기에서 정렬은 그
 * 정규화 **뒤에** 오므로, 규칙을 이름에 맞춰도 출하물은 달라지지 않는다.
 *
 * @returns 굵은 줄이 하나도 없어 발을 못 찾으면 `null`
 */
export function footBand(img: IRgbaImage, opts: IFootBandOptions = {}): IFootBand | null {
  const minRunWidth = opts.minRunWidth ?? 20;
  const rows = opts.rows ?? 8;
  const faintUpTo = opts.faintUpTo ?? 16;
  const isThick = (run: IRun): boolean => run.to - run.from + 1 >= minRunWidth;

  let thickRowY = -1;
  for (let y = img.height - 1; y >= 0; y--) {
    if (rowRuns(img, y, faintUpTo).some(isThick)) {
      thickRowY = y;
      break;
    }
  }
  if (thickRowY < 0) return null;

  let baselineY = thickRowY;
  let chain = rowRuns(img, thickRowY, faintUpTo).filter(isThick);
  while (baselineY + 1 < img.height) {
    const next = rowRuns(img, baselineY + 1, faintUpTo).filter((run) =>
      chain.some((c) => overlaps(c, run)),
    );
    if (next.length === 0) break;
    baselineY++;
    chain = next;
  }

  // 발 띠 안의 굵은 구간을 씨앗으로 잡고, 이웃 행과 겹치는 것을 이어짐이 멎을 때까지
  // 따라 붙인다. 한 번 훑는 것으로는 모자라다 — 씨앗보다 위에 있는 구간이 그보다 더 위의
  // 구간을 다시 끌어오기 때문이다.
  //
  // **띠의 위 끝은 `rows`와 씨앗 행 중 더 위쪽이다.** `rows`만 쓰면 2단계에서 길게 내려간
  // 만큼 씨앗이 띠 밖으로 밀려나고, 그러면 씨앗 없는 띠가 남아 아래 훑기가 아무것도 못
  // 고른다 — `from`이 캔버스 폭, `to`가 -1인 채로 나와 중심이 캔버스 정중앙이 된다.
  const top = Math.min(thickRowY, Math.max(0, baselineY - rows + 1));
  const band: IRun[][] = [];
  for (let y = top; y <= baselineY; y++) band.push(rowRuns(img, y, faintUpTo));

  const taken = band.map((runs) => runs.map(isThick));
  const queue: Array<[number, number]> = [];
  taken.forEach((flags, i) => {
    flags.forEach((flag, j) => {
      if (flag) queue.push([i, j]);
    });
  });

  while (queue.length > 0) {
    const [i, j] = queue.pop() as [number, number];
    for (const k of [i - 1, i + 1]) {
      if (k < 0 || k >= band.length) continue;
      band[k].forEach((run, m) => {
        if (taken[k][m] || !overlaps(run, band[i][j])) return;
        taken[k][m] = true;
        queue.push([k, m]);
      });
    }
  }

  let from = img.width;
  let to = -1;
  band.forEach((runs, i) => {
    runs.forEach((run, j) => {
      if (!taken[i][j]) return;
      if (run.from < from) from = run.from;
      if (run.to > to) to = run.to;
    });
  });

  return { baselineY, centerX: (from + to) / 2, from, to };
}

/**
 * 캐릭터를 목표 캔버스에 옮겨 세운다 — 발 밑선은 아래 여백 위에, 발 중심은 가로 중앙에.
 *
 * 크기를 조절하지 않고 평행 이동만 한다. 확대·축소를 넣으면 네 장의 배율이 미세하게 갈려
 * 등신비가 방향마다 달라진다.
 *
 * **가드는 크기가 아니라 놓일 자리를 본다**(2026-08-22 리뷰 반영). 잘리느냐를 정하는 것은
 * 캐릭터가 캔버스보다 작은지가 아니라 **밀고 난 뒤 어디에 있는지**다. 세로는 발 밑선을
 * 여백 위에 놓으므로 `높이 + 여백`이 캔버스를 넘으면 머리가 잘리고, 가로는 **발 중심**에
 * 맞추므로 머리카락이 한쪽으로 쏠리면 트림 상자가 캔버스보다 좁아도 반대쪽이 넘친다.
 * 크기만 보던 판은 둘 다 통과시켰고, 넘친 픽셀은 아래 두 `continue`가 말없이 버렸다 —
 * 예외도 경고도 없이 **머리가 자로 그은 듯 잘린 정상 PNG**가 나온다.
 *
 * @throws 발을 못 찾아 기준을 잡을 수 없거나, 밀고 나면 캐릭터가 캔버스를 벗어나면
 */
export function alignToCanvas(img: IRgbaImage, opts: IAlignOptions): IRgbaImage {
  const box = trimBox(img);
  const foot = footBand(img, opts.foot);
  if (!box || foot === null) {
    throw new Error('발을 찾지 못해 정렬 기준을 잡을 수 없다');
  }

  // 발 밑선이 갈 자리와 발 중심이 갈 자리를 먼저 정하고, 그 차이만큼 통째로 민다.
  // 가로 중앙을 `width / 2`가 아니라 `(width - 1) / 2`로 잡는다 — `footBand`가 픽셀
  // 인덱스로 답하므로 같은 좌표계여야 한다. 폭 5인 캔버스의 가운데 픽셀은 2이지 2.5가 아니다.
  const dy = opts.height - 1 - opts.bottomMargin - foot.baselineY;
  const dx = Math.round((opts.width - 1) / 2 - foot.centerX);

  const top = box.y + dy;
  const left = box.x + dx;
  if (top < 0 || top + box.height > opts.height) {
    throw new Error(
      `발 밑선을 여백 ${opts.bottomMargin} 위에 놓으면 캐릭터 높이 ${box.height}가 캔버스 세로 ${opts.height}를 벗어난다`,
    );
  }
  if (left < 0 || left + box.width > opts.width) {
    throw new Error(
      `발 중심에 맞추면 캐릭터 폭 ${box.width}가 캔버스 가로 ${opts.width}를 벗어난다`,
    );
  }

  const data = new Uint8Array(opts.width * opts.height * 4);
  for (let y = box.y; y < box.y + box.height; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= opts.height) continue;
    for (let x = box.x; x < box.x + box.width; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= opts.width) continue;
      const src = (y * img.width + x) * 4;
      data.set(img.data.subarray(src, src + 4), (ty * opts.width + tx) * 4);
    }
  }
  return { width: opts.width, height: opts.height, data };
}
