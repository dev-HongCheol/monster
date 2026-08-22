/**
 * 매팅 결과를 게임이 쓰는 규격으로 옮기는 순수 변환들.
 *
 * 배경 제거가 끝난 그림은 아직 스프라이트가 아니다. 잡음 알파를 눌러야 Cocos의 Trim이
 * 제 일을 하고, 네 방향을 같은 캔버스·같은 발 밑선에 세워야 방향을 바꿀 때 캐릭터가
 * 제자리에 선다. 그 두 가지가 여기 있다.
 */

import type { IRgbaImage } from '../../tests/helpers/SpriteMetrics.ts';
import { footLineY, trimBox } from '../../tests/helpers/SpriteMetrics.ts';

/** `normalizeAlpha`의 임계값. */
export interface INormalizeOptions {
  /** 이 값 이하의 알파를 0으로 누른다. 기본 16 */
  faintUpTo?: number;
  /** 이 값 이상의 알파를 255로 올린다. 기본 254 */
  opaqueFrom?: number;
}

/** `alignToCanvas`가 놓을 자리. */
export interface IAlignOptions {
  /** 목표 캔버스 가로 */
  width: number;
  /** 목표 캔버스 세로 */
  height: number;
  /** 발 밑선과 캔버스 아래 끝 사이에 남길 픽셀 수 */
  bottomMargin: number;
  /** 발 중심을 잴 때 아래에서부터 볼 줄 수. 기본 8 */
  footRows?: number;
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

/**
 * 아래쪽 몇 줄의 불투명 픽셀 가로 중심 — 캐릭터가 실제로 딛고 선 자리다.
 *
 * 트림 상자의 중심을 못 쓰는 이유는 머리카락이 비대칭이기 때문이다. 첫 캐릭터에서 측면
 * 두 장의 트림 상자가 머리카락 때문에 23px씩 반대 방향으로 밀렸고, 그 중심에 맞춰 세우면
 * 좌우를 오갈 때 캐릭터가 가로로 미끄러진다.
 *
 * @param rows 아래에서부터 몇 줄을 볼지. 발만 들어올 만큼 얇게 잡는다
 * @returns 불투명 픽셀이 없으면 `null`
 */
export function footCenterX(img: IRgbaImage, rows: number): number | null {
  const bottom = footLineY(img);
  if (bottom === null) return null;

  const top = Math.max(0, bottom - rows + 1);
  let minX = img.width;
  let maxX = -1;

  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }

  if (maxX < 0) return null;
  return (minX + maxX) / 2;
}

/**
 * 캐릭터를 목표 캔버스에 옮겨 세운다 — 발 밑선은 아래 여백 위에, 발 중심은 가로 중앙에.
 *
 * 크기를 조절하지 않고 평행 이동만 한다. 확대·축소를 넣으면 네 장의 배율이 미세하게 갈려
 * 등신비가 방향마다 달라진다.
 *
 * @throws 캐릭터가 목표 캔버스보다 커서 잘릴 수밖에 없으면
 */
export function alignToCanvas(img: IRgbaImage, opts: IAlignOptions): IRgbaImage {
  const box = trimBox(img);
  const foot = footCenterX(img, opts.footRows ?? 8);
  const bottom = footLineY(img);
  if (!box || foot === null || bottom === null) {
    throw new Error('불투명 픽셀이 없어 정렬 기준을 잡을 수 없다');
  }
  if (box.width > opts.width || box.height > opts.height) {
    throw new Error(
      `캐릭터(${box.width}×${box.height})가 캔버스(${opts.width}×${opts.height})보다 크다`,
    );
  }

  // 발 밑선이 갈 자리와 발 중심이 갈 자리를 먼저 정하고, 그 차이만큼 통째로 민다.
  // 가로 중앙을 `width / 2`가 아니라 `(width - 1) / 2`로 잡는다 — `footCenterX`가 픽셀
  // 인덱스로 답하므로 같은 좌표계여야 한다. 폭 5인 캔버스의 가운데 픽셀은 2이지 2.5가 아니다.
  const dy = opts.height - 1 - opts.bottomMargin - bottom;
  const dx = Math.round((opts.width - 1) / 2 - foot);

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
