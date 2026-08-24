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

import { alphaHistogram, type IRgbaImage, trimBox } from '../../tests/helpers/SpriteMetrics.ts';
import { footBand } from './Postprocess.ts';

/** 열두 장이 모두 지켜야 하는 값. */
export interface IShippingSpec {
  /** 목표 캔버스 가로 */
  width: number;
  /** 목표 캔버스 세로 */
  height: number;
  /** 발 밑선이 놓일 y */
  baselineY: number;
  /**
   * 트림 상자 세로 상한.
   *
   * 캔버스 세로에서 발 밑선 아래 여백을 뺀 값이다. 넘으면 `alignToCanvas`가 던지는데,
   * 여기서 먼저 잡아야 **어느 장이 얼마나 큰지**가 메시지에 남는다.
   */
  maxTrimHeight: number;
}

/** 내보낼 한 장. `name`은 위반 메시지에 그대로 실린다. */
export interface IShipItem {
  name: string;
  image: IRgbaImage;
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

  const foot = footBand(image);
  if (foot === null) {
    problems.push(`${name}: 발을 못 찾아 밑선을 잴 수 없다`);
  } else if (foot.baselineY !== spec.baselineY) {
    problems.push(`${name}: 발 밑선이 ${foot.baselineY}다 (기대 ${spec.baselineY})`);
  }

  const box = trimBox(image);
  if (box === null) {
    problems.push(`${name}: 알파가 있는 픽셀이 하나도 없다`);
  } else if (box.height > spec.maxTrimHeight) {
    problems.push(`${name}: 트림 세로가 ${box.height}다 (상한 ${spec.maxTrimHeight})`);
  }

  return problems;
}

/**
 * 전부 통과할 때만 준 순서대로 쓴다.
 *
 * @param write 한 장을 실제로 내보내는 함수. 디스크를 만지는 것은 부르는 쪽의 몫이다
 * @throws 한 장이라도 규격에서 떨어지면. 이때 `write`는 **한 번도** 불리지 않는다
 */
export function commitAll(
  items: readonly IShipItem[],
  spec: IShippingSpec,
  write: (item: IShipItem) => void,
): void {
  const problems = items.flatMap((item) => specViolations(item, spec));
  if (problems.length > 0) {
    throw new Error(`출하 규격에서 떨어진 장이 있어 아무것도 쓰지 않았다:\n${problems.join('\n')}`);
  }

  for (const item of items) write(item);
}
