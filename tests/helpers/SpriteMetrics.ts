/**
 * 스프라이트가 규격을 지키는지 재는 순수 함수들 — 디스크도 PNG 포맷도 모른다.
 *
 * 이 파일이 RGBA 배열만 받는 이유는 판정과 디코딩이 같이 낡지 않게 하기 위해서다. 파일을
 * 읽는 것은 `PngCodec.ts` 하나가 맡고, 여기 있는 판정은 매팅 결과든 파이프라인 중간 산출물이든
 * 합성 픽스처든 똑같이 받는다. 배경 제거를 fal 매팅으로 옮기면서 「이 그림이 됐는가」를 눈이
 * 아니라 숫자가 판정하게 만드는 것이 목적이고, 그 숫자의 정의가 여기 있다.
 */

/** 8비트 RGBA 픽셀 버퍼. `data`는 `[r, g, b, a]`가 `width * height`번 이어진 길이다. */
export interface IRgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** 알파를 성질이 다른 다섯 대역으로 가른 개수. 비율이 아니라 정수 픽셀 수다. */
export interface IAlphaHistogram {
  /** 알파 0 — 완전 투명 */
  transparent: number;
  /** 알파 1~16 — 눈에는 안 보이지만 Cocos의 Trim을 무효로 만드는 잡음 */
  faint: number;
  /** 알파 17~200 — 매팅이 머리카락 경계에서 만들어 내는 대역. **모델을 가르는 값이다** */
  semi: number;
  /**
   * 알파 201~254 — 거의 불투명한데 255가 아닌 픽셀.
   *
   * `semi`와 **반드시 갈라 센다.** 합치면 「경계를 잘 딴 것」과 「내부가 255가 아닌 것」이
   * 같은 숫자로 보인다. `bria`가 실제로 내부를 통째로 254로 내놓아 패널당 30,113~45,580px을
   * 여기 쌓는데, 그건 `normalizeAlpha` 한 줄로 닫히는 양자화이지 매팅 품질이 아니다.
   * 합쳐서 재면 진짜 경계 대역이 bria 3,490 대 birefnet 3,694로 birefnet이 넓은데도
   * 51,580 대 11,535로 **뒤집혀** 보인다.
   */
  nearOpaque: number;
  /** 알파 255 — 완전 불투명 */
  opaque: number;
}

/** 픽셀 좌표계의 사각형. `x`·`y`는 왼쪽 위 모서리다. */
export interface IBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 알파가 0인 픽셀에 남은 색의 통계. */
export interface IResidualRgb {
  /** 알파가 0인 픽셀 수 */
  count: number;
  /** 그 픽셀들의 RGB 평균(소수점 반올림). 대상이 없으면 `[0, 0, 0]` */
  mean: [number, number, number];
  /** 그중 무채색(채널 최대·최소 차가 12 미만)인 비율. 대상이 없으면 0 */
  achromaticRatio: number;
}

/** `backgroundLeak`의 판정 기준. */
export interface IBackgroundLeakOptions {
  /** 배경색과의 유클리드 거리가 이 값 미만이면 「배경색과 구별되지 않는다」 */
  maxDistance: number;
  /** 알파가 이 값 이상인 픽셀만 센다 — 경계 안티에일리어싱을 제외하기 위한 하한 */
  minAlpha: number;
}

/** 무채색으로 볼 채널 간 최대 편차. */
const ACHROMATIC_TOLERANCE = 12;

/** PNG 파일의 첫 8바이트 서명. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * 알파 대역별 픽셀 수를 센다.
 *
 * **가르는 자리가 둘이고 이유가 서로 다르다.** 16과 17 사이는 「후처리가 0으로 눌러 없앨
 * 잡음」과 「남겨야 하는 경계」를 가른다 — 합치면 잡음을 뱉는 모델과 경계를 잘 딴 모델이 같은
 * 점수로 보인다. 200과 201 사이는 「매팅이 만든 경계」와 「내부의 양자화 어긋남」을 가른다 —
 * 자세한 이유는 `nearOpaque` 주석에 있다.
 */
export function alphaHistogram(img: IRgbaImage): IAlphaHistogram {
  const out: IAlphaHistogram = {
    transparent: 0,
    faint: 0,
    semi: 0,
    nearOpaque: 0,
    opaque: 0,
  };
  for (let i = 3; i < img.data.length; i += 4) {
    const a = img.data[i];
    if (a === 0) out.transparent++;
    else if (a <= 16) out.faint++;
    else if (a <= 200) out.semi++;
    else if (a <= 254) out.nearOpaque++;
    else out.opaque++;
  }
  return out;
}

/**
 * 알파가 0보다 큰 픽셀을 모두 감싸는 사각형 — Cocos의 Trim이 잘라낼 상자다.
 *
 * 임계값이 아니라 `> 0`인 이유는 이 함수가 재는 것이 눈에 보이는 형태가 아니라 **엔진이
 * 무엇을 자르는가**이기 때문이다. 알파 1짜리 잡음 한 점이 구석에 있으면 상자는 캔버스
 * 전체가 되고, 그러면 트림 상자를 기준으로 잡는 종횡비 규칙이 조용히 캔버스 기준으로
 * 떨어진다 — 계산은 규칙대로 했는데 결과만 틀린 상태가 된다.
 *
 * @returns 알파가 있는 픽셀이 하나도 없으면 `null`
 */
export function trimBox(img: IRgbaImage): IBox | null {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * 배경색과 구별되지 않으면서 불투명한 픽셀 수를 센다.
 *
 * **이 값이 0이어야 한다고 읽으면 안 된다.** 이름이 「잔여」지만 재는 것은 「배경색에 가까운
 * 불투명 픽셀」이고, 그림이 배경과 비슷한 색을 쓰면 정상 전경도 여기 잡힌다. 맨살 시트의
 * 회색 운동복이 실제로 그렇다. 그래서 모델 판정은 이 값이 0인지가 아니라 현행 대비
 * 유지되는지를 본다 — 0을 요구하면 옷을 배경으로 오인해 뚫은 모델이 이긴다.
 *
 * @param bg 그 시트의 배경색 `[r, g, b]`
 */
export function backgroundLeak(
  img: IRgbaImage,
  bg: readonly [number, number, number],
  opts: IBackgroundLeakOptions,
): number {
  const maxDistanceSq = opts.maxDistance * opts.maxDistance;
  let n = 0;

  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < opts.minAlpha) continue;
    const dr = img.data[i] - bg[0];
    const dg = img.data[i + 1] - bg[1];
    const db = img.data[i + 2] - bg[2];
    if (dr * dr + dg * dg + db * db < maxDistanceSq) n++;
  }
  return n;
}

/**
 * 알파가 0인 픽셀에 어떤 색이 남아 있는지 잰다.
 *
 * 완전 투명한 픽셀의 RGB는 화면에 안 나오므로 무시해도 될 것 같지만 그렇지 않다. 알파를
 * 무시하는 뷰어는 그 값을 그대로 그리고, 인게임에서도 바이리니어 샘플링이 이웃한 투명
 * 픽셀의 색을 가장자리로 끌어온다. 그래서 배경 회색이 남아 있으면 어두운 배경 위에서
 * 캐릭터 외곽에 밝은 테두리가 생긴다.
 */
export function residualBackgroundRgb(img: IRgbaImage): IResidualRgb {
  let count = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let achromatic = 0;

  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] !== 0) continue;
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    count++;
    sumR += r;
    sumG += g;
    sumB += b;
    if (Math.max(r, g, b) - Math.min(r, g, b) < ACHROMATIC_TOLERANCE) achromatic++;
  }

  if (count === 0) return { count: 0, mean: [0, 0, 0], achromaticRatio: 0 };
  return {
    count,
    mean: [Math.round(sumR / count), Math.round(sumG / count), Math.round(sumB / count)],
    achromaticRatio: achromatic / count,
  };
}

/**
 * 알파가 있는 가장 아래 행의 y — 네 방향을 같은 캔버스에 정렬할 때 쓰는 기준선이다.
 *
 * 알파 임계값을 걸기 **전에** 재는 값이라 `> 0`으로 판정한다. 임계값을 건 뒤에 재면 발끝의
 * 안티에일리어싱이 잘려 나가 기준선이 한두 픽셀 올라가는데, 네 장의 잘린 정도가 서로 다르면
 * 방향을 바꿀 때 캐릭터가 세로로 튄다.
 *
 * @returns 알파가 있는 픽셀이 하나도 없으면 `null`
 */
export function footLineY(img: IRgbaImage): number | null {
  for (let y = img.height - 1; y >= 0; y--) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] > 0) return y;
    }
  }
  return null;
}

/** 윤곽 한쪽의 후광 측정치. `ratio`는 잰 행 중 후광이 있는 행의 비율이다. */
export interface IEdgeHalo {
  /** 가장자리와 안쪽을 둘 다 잴 수 있었던 행 수 */
  rows: number;
  /** 그중 가장자리가 배경색에 뚜렷이 더 가까웠던 행 수 */
  haloRows: number;
  /** `haloRows / rows`. 잰 행이 없으면 0 */
  ratio: number;
}

/**
 * 왼쪽 윤곽과 오른쪽 윤곽을 따로 담은 `edgeHalo`의 결과.
 *
 * **한 숫자로 합치지 않는 것이 이 타입의 요점이다.** 합치면 깨끗한 쪽이 더러운 쪽을 희석해
 * 비율이 절반으로 보이고, 실패했을 때 어느 윤곽인지도 잃는다.
 */
export interface IEdgeHaloBySide {
  left: IEdgeHalo;
  right: IEdgeHalo;
}

/** `edgeHalo`의 판정 기준. */
export interface IEdgeHaloOptions {
  /** 가장자리에서 몇 픽셀 안쪽을 비교 대상으로 삼을지. 기본 4 */
  depth?: number;
  /** 이 값보다 알파가 큰 픽셀만 본다. 기본 200 */
  minAlpha?: number;
  /** 배경색까지의 거리 차가 이 값을 넘으면 후광으로 본다. 기본 25 */
  threshold?: number;
}

/**
 * 윤곽에 배경색이 섞인 띠가 둘러졌는지 잰다.
 *
 * **이 항목은 사람 눈이 먼저 잡았다(2026-08-21).** 손수 키잉으로 만든 스프라이트의 왼쪽
 * 윤곽에 밝은 회색 띠가 머리부터 다리까지 둘러져 있었는데, 그때까지 있던 판정 다섯이 전부
 * 통과시켰다. 통과한 이유가 분명하다 — 그 띠는 캐릭터 색과 배경색이 **섞인** 색이라
 * 배경색과의 절대 거리로는 멀고(그래서 `backgroundLeak`에 안 걸린다) 알파도 온전하다
 * (그래서 알파 지표에도 안 걸린다).
 *
 * 그래서 절대값이 아니라 **같은 행 안쪽 픽셀과의 상대 비교**로 잡는다. 정상 윤곽이면
 * 가장자리와 안쪽이 같은 계열 색이라 배경색까지의 거리가 비슷하고, 후광이 있으면
 * 가장자리만 배경 쪽으로 끌려가 그 거리가 뚜렷이 짧아진다.
 *
 * **양쪽 윤곽을 다 재고 따로 돌려준다(2026-08-22).** 처음에는 왼쪽만 쟀는데, 그 판이
 * `birefnet`을 통과시켰다 — 오른쪽 윤곽에 배경 회색을 알파 230으로 구워 놓은 결과가
 * 왼쪽만 보면 0.8%이고 오른쪽으로는 56%였다. 눈에 훤히 보이는 회색 선을 지표가 0으로
 * 돌려준 것이라, 원인은 임계값이 아니라 **쳐다보지 않은 절반**이었다.
 *
 * @param bg 그 시트의 배경색 `[r, g, b]`
 */
export function edgeHalo(
  img: IRgbaImage,
  bg: readonly [number, number, number],
  opts: IEdgeHaloOptions = {},
): IEdgeHaloBySide {
  const depth = opts.depth ?? 4;
  const minAlpha = opts.minAlpha ?? 200;
  const threshold = opts.threshold ?? 25;

  const distanceToBg = (offset: number): number => {
    const dr = img.data[offset] - bg[0];
    const dg = img.data[offset + 1] - bg[1];
    const db = img.data[offset + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  /** @param step 윤곽을 찾아 들어가는 방향. 왼쪽 윤곽은 +1, 오른쪽 윤곽은 -1이다 */
  const scan = (step: 1 | -1): IEdgeHalo => {
    let rows = 0;
    let haloRows = 0;

    for (let y = 0; y < img.height; y++) {
      const start = step === 1 ? 0 : img.width - 1;
      let edgeX = -1;
      for (let x = start; x >= 0 && x < img.width; x += step) {
        if (img.data[(y * img.width + x) * 4 + 3] > minAlpha) {
          edgeX = x;
          break;
        }
      }
      const innerX = edgeX + depth * step;
      if (edgeX < 0 || innerX < 0 || innerX >= img.width) continue;

      const inner = (y * img.width + innerX) * 4;
      if (img.data[inner + 3] <= minAlpha) continue;

      rows++;
      if (distanceToBg(inner) - distanceToBg((y * img.width + edgeX) * 4) > threshold) haloRows++;
    }

    return { rows, haloRows, ratio: rows === 0 ? 0 : haloRows / rows };
  };

  return { left: scan(1), right: scan(-1) };
}

/**
 * PNG의 IHDR에서 가로·세로만 읽는다 — 압축을 풀지 않는다.
 *
 * 캔버스 규격은 13장 전부에 대해 재는데 전량 디코딩은 그만큼 느리고, 크기만 보면 되는
 * 자리에서 디코더 의존성을 끌어올 이유가 없다. IHDR은 서명 8바이트 + 길이 4 + 타입 4
 * 다음에 오므로 오프셋이 고정이다.
 *
 * @throws PNG 서명이 아니거나 IHDR을 담기에 파일이 짧으면
 */
export function readPngSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 24) throw new Error(`PNG로 보기엔 너무 짧다: ${bytes.length}바이트`);
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error('PNG 서명이 아니다');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
