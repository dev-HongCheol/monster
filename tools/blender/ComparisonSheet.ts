/**
 * 게임 화면이 그림을 그리는 방식을 흉내 내는 순수 로직 — 디스크도 PNG 포맷도 모른다. 게임 크기로 줄이기
 * (`sampleLikeEngine`)와 층 겹치기 · 견주기(`layerOver` · `occlusionDelta` · `pixelDiff`)를 든다.
 *
 * 이름은 1라운드 화풍 판정(게이트 1)의 비교 시트에서 왔다. 시트를 붙이던 함수(`composeGrid` · `maskRect` ·
 * `compositeOver`)는 그 판정이 끝나 부르는 곳이 없어 지웠다(2026-09-27 — git 이력). **작은 칸은 게임 화면이 실제로
 * 그리는 그림과 같아야 한다**는 원칙은 남는다 — 화질 좋은 축소로 게임 크기 그림을 만들면 게임보다 깨끗한 그림이
 * 나오고, 판정이 게임에 없는 그림을 보고 실제보다 후하게 통과한다.
 *
 * 그래서 축소는 엔진을 흉내 낸다. 출하 텍스처 둘의 `.meta`가 linear 필터 · 밉맵 없음 ·
 * clamp-to-edge이고, 스프라이트 셰이더는 알파를 곱하지 않은 텍스처를 `src_alpha` ·
 * `one_minus_src_alpha`로 섞는다. 알파가 있는 그림을 화질 좋게 줄일 때는 알파를 곱했다가
 * 되돌리는 과정을 빠뜨리면 윤곽에 없던 어두운 테두리가 생기는데, 이 파일은 반대로 **엔진이
 * 만드는 테두리를 일부러 똑같이** 만든다. 그 테두리는 게임 화면에 실제로 있기 때문이다.
 *
 * Cocos 미리보기 스크린샷을 작은 칸으로 쓰지 않는 이유는 미리보기가 캔버스를 창 크기에 맞춰
 * 늘리기 때문이다. 2026-09-14 1440p 실측에서 세로 배율은 1.93인데 가로는 1.53이라, 그 화면의
 * 캐릭터는 가로로 21% 눌려 있었다.
 *
 * **층을 겹치고 견주는 함수(`layerOver` · `occlusionDelta` · `pixelDiff`)도 여기 둔다.** 몸 · 상의 ·
 * 무기 · 망토를 층으로 따로 굽고 게임에서 겹치므로, 층을 겹친 그림이 한 번에 구운 컷과 얼마나
 * 다른지를 재야 한다. 그 겹치기가 엔진의 블렌딩과 다르면 게임에 없는 차이를 재게 되는데, 엔진식
 * 블렌딩의 주인이 이 파일이라 따로 떼면 같은 식이 두 벌이 된다.
 */

import type { IRgbaImage } from '../../tests/helpers/SpriteMetrics.ts';

/** 픽셀 단위 사각형. */
export interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 텍셀 번호를 캔버스 안으로 붙든다 — clamp-to-edge 래핑이다. */
function clampIndex(index: number, size: number): number {
  return Math.min(size - 1, Math.max(0, index));
}

/**
 * 텍스처를 게임이 그리는 방식 그대로 줄이거나 늘린다.
 *
 * 화면 픽셀 하나마다 그 **중심**이 떨어지는 텍스처 좌표에서 이웃 텍셀 넷을 선형 보간한다.
 * 밉맵이 없으므로 넷보다 많이 읽지 않는다 — 크게 줄일수록 그 사이의 텍셀은 결과에 아예 안
 * 들어가고, 그래서 가는 선이 게임 크기에서 사라지거나 깜빡인다. 색과 알파는 따로 보간하므로
 * 투명 픽셀에 남은 색이 윤곽에 섞여 든다.
 *
 * @param img 원본 텍스처. 알파를 곱하지 않은 RGBA여야 한다
 * @param width 결과 가로(px)
 * @param height 결과 세로(px)
 */
export function sampleLikeEngine(img: IRgbaImage, width: number, height: number): IRgbaImage {
  const data = new Uint8Array(width * height * 4);
  const src = img.data;

  for (let y = 0; y < height; y++) {
    // 화면 픽셀 중심(+0.5)을 텍셀 중심 좌표계(-0.5)로 옮긴다. 이 반 칸을 빼먹으면 그림이 반
    // 텍셀 밀려서, 크게 줄일 때 읽히는 텍셀이 엔진과 달라지고 어느 선이 사라지는지도 달라진다.
    const ty = ((y + 0.5) / height) * img.height - 0.5;
    const y0 = Math.floor(ty);
    const fy = ty - y0;
    const rowA = clampIndex(y0, img.height) * img.width;
    const rowB = clampIndex(y0 + 1, img.height) * img.width;

    for (let x = 0; x < width; x++) {
      const tx = ((x + 0.5) / width) * img.width - 0.5;
      const x0 = Math.floor(tx);
      const fx = tx - x0;
      const colA = clampIndex(x0, img.width);
      const colB = clampIndex(x0 + 1, img.width);

      const out = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = src[(rowA + colA) * 4 + c] * (1 - fx) + src[(rowA + colB) * 4 + c] * fx;
        const bottom = src[(rowB + colA) * 4 + c] * (1 - fx) + src[(rowB + colB) * 4 + c] * fx;
        data[out + c] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }

  return { width, height, data };
}

/** 두 그림의 크기가 같지 않으면 두 크기를 말하며 던진다. */
export function assertSameSize(a: IRgbaImage, b: IRgbaImage, what: string): void {
  if (a.width === b.width && a.height === b.height) return;
  throw new Error(`${what}: 크기가 다르다 ${a.width}×${a.height} · ${b.width}×${b.height}`);
}

/**
 * 층 하나를 다른 층 위에 엔진의 알파 블렌딩으로 얹는다. 결과는 반투명일 수 있다.
 *
 * 게임은 층을 불투명한 화면에 하나씩 그린다. 이 함수는 층끼리 먼저 겹쳐 두는데, 겹친 결과를
 * 엔진의 알파 블렌딩으로 배경에 얹으면 층을 차례로 그린 화면과 반올림 한 단계 안에서 같다. 알파를
 * 곱하지 않은 채로 겹치므로 결과의 색은 겹친 알파로 다시 나눈다.
 *
 * @param below 아래 층. 알파를 곱하지 않은 RGBA
 * @param above 위 층. 크기가 `below`와 같아야 한다 — 층 캔버스가 다르면 먼저 같은 캔버스로 옮긴다
 * @throws 두 층의 크기가 다르면
 */
export function layerOver(below: IRgbaImage, above: IRgbaImage): IRgbaImage {
  assertSameSize(below, above, 'layerOver');
  const data = new Uint8Array(below.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const sa = above.data[i + 3] / 255;
    const da = below.data[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    data[i + 3] = Math.round(oa * 255);
    for (let c = 0; c < 3; c++) {
      data[i + c] =
        oa === 0
          ? 0
          : Math.round((above.data[i + c] * sa + below.data[i + c] * da * (1 - sa)) / oa);
    }
  }
  return { width: below.width, height: below.height, data };
}

/** `occlusionDelta`의 결과. */
export interface IOcclusionDelta {
  /** 가림을 끈 층에는 보이고 켠 층에서 사라진 픽셀 수 — 몸에 가려진 자리다 */
  removed: number;
  /** 끈 층에는 없는데 켠 층에 새로 생긴 픽셀 수 — 0이어야 한다 */
  added: number;
}

/**
 * 가림을 켜고 구운 층이 끄고 구운 층의 부분집합인지 센다.
 *
 * 가림 전용 몸은 뒤에 있는 것을 지우기만 해야 한다. `added`가 0보다 크면 가림 몸이 렌더에 섞여
 * 나왔거나 두 층의 자세 · 카메라가 서로 다른 것이다.
 *
 * @param raw 가림을 끄고 구운 층
 * @param held 가림을 켜고 구운 층. 크기가 `raw`와 같아야 한다
 * @param alphaOn 이 값을 **넘는** 알파만 보이는 픽셀로 친다. 윤곽의 안티에일리어싱 술을 빼려는 것이다
 * @throws 두 층의 크기가 다르면
 */
export function occlusionDelta(
  raw: IRgbaImage,
  held: IRgbaImage,
  alphaOn: number,
): IOcclusionDelta {
  assertSameSize(raw, held, 'occlusionDelta');
  let removed = 0;
  let added = 0;
  for (let i = 3; i < raw.data.length; i += 4) {
    const seen = raw.data[i] > alphaOn;
    const kept = held.data[i] > alphaOn;
    if (seen && !kept) removed++;
    if (!seen && kept) added++;
  }
  return { removed, added };
}

/**
 * 채널 차가 이 값을 넘어야 다른 픽셀로 센다. EEVEE의 샘플 잡음이 같은 장면을 두 번 구워도 한두 단계씩 흔드는
 * 것을 빼려는 값이다. 가림 비교(`bake.ts compare`)가 이 값을 쓰고, 슬롯 탐침(`slots.ts`)은 같은 값을 자기 사본으로 든다(F114).
 * 두 수치를 견주려면 값이 하나여야 해서 여기 둔다.
 */
export const DIFF_THRESHOLD = 12;

/** `pixelDiff`의 결과. */
export interface IPixelDiff {
  /** 한 채널이라도 문턱을 넘게 다른 픽셀 수 */
  changed: number;
  /** 세지 않은 픽셀까지 포함해 가장 크게 벌어진 채널 차. 둘 다 투명한 픽셀은 뺀다 */
  maxChannel: number;
}

/**
 * 두 그림이 픽셀마다 얼마나 다른지 센다. 층 합성과 한 번에 구운 기준 컷을 견주는 데 쓴다.
 *
 * **둘 다 투명한 픽셀은 건너뛴다.** 렌더러가 투명 픽셀에 남기는 색은 화면에 안 나오는데 굽기마다
 * 달라질 수 있어서, 세면 차이가 보이지 않는 픽셀로 부풀어 회귀 가드가 이유 없이 빨간불이 된다.
 *
 * @param threshold 채널 차가 이 값을 **넘어야** 바뀐 픽셀로 센다
 * @throws 두 그림의 크기가 다르면
 */
export function pixelDiff(a: IRgbaImage, b: IRgbaImage, threshold: number): IPixelDiff {
  assertSameSize(a, b, 'pixelDiff');
  let changed = 0;
  let maxChannel = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i + 3] === 0 && b.data[i + 3] === 0) continue;
    let worst = 0;
    for (let c = 0; c < 4; c++) worst = Math.max(worst, Math.abs(a.data[i + c] - b.data[i + c]));
    maxChannel = Math.max(maxChannel, worst);
    if (worst > threshold) changed++;
  }
  return { changed, maxChannel };
}
