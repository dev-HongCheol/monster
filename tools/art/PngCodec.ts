/**
 * PNG 바이트와 RGBA 배열 사이를 오가는 한 자리.
 *
 * 판정(`tests/helpers/SpriteMetrics.ts`)이 포맷을 모르게 두려면 포맷을 아는 코드가 어딘가
 * 한 곳에 모여 있어야 한다. 그 자리가 여기다. 판정 함수가 늘어나도 디코딩은 이 파일에서만
 * 바뀌고, 반대로 디코더를 갈아 끼워도 판정 단언은 한 줄도 안 바뀐다.
 */

import { PNG } from 'pngjs';
import type { IRgbaImage } from '../../tests/helpers/SpriteMetrics.ts';

/**
 * PNG 바이트를 8비트 RGBA 배열로 푼다.
 *
 * 팔레트·그레이스케일·16비트 PNG도 `pngjs`가 8비트 RGBA로 정규화해 돌려주므로, 이 함수를
 * 지난 뒤에는 채널 구성을 다시 따질 필요가 없다.
 *
 * @throws 바이트가 PNG가 아니거나 손상됐으면
 */
export function decodePng(bytes: Uint8Array): IRgbaImage {
  const png = PNG.sync.read(Buffer.from(bytes));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

/**
 * RGBA 배열을 PNG 바이트로 굽는다.
 *
 * 알파를 쓰는 그림이므로 색 타입은 항상 RGBA(6)이고, 팔레트로 줄이지 않는다. 팔레트 PNG는
 * 알파를 256단계 인덱스로 눌러 반투명 경계를 뭉개는데, 그 경계가 이 파이프라인이 지키려는
 * 바로 그 값이다.
 *
 * @throws `data` 길이가 `width * height * 4`와 다르면
 */
export function encodePng(img: IRgbaImage): Uint8Array {
  const expected = img.width * img.height * 4;
  if (img.data.length !== expected) {
    throw new Error(`RGBA 길이가 안 맞는다: ${img.data.length} (기대 ${expected})`);
  }

  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data);
  return new Uint8Array(PNG.sync.write(png));
}
