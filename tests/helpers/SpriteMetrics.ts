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

/** `maskedRegionDelta`가 마스크 밖에서 찾아낸 차이. */
export interface IMaskedRegionDelta {
  /** 네 채널 중 하나라도 다른 픽셀 수 */
  differing: number;
  /** 그중 첫 픽셀의 좌표(위에서 아래, 왼쪽에서 오른쪽 순). 차이가 없으면 `null` */
  firstAt: { x: number; y: number } | null;
}

/**
 * 마스크가 열지 않은 자리에서 두 이미지가 픽셀 단위로 같은지 센다.
 *
 * 인페인팅은 잠재 공간을 거쳐 VAE로 돌아오므로 **지시하지 않은 자리도 미세하게 다시
 * 그려진다.** 그래서 그래프 끝에 `ImageCompositeMasked`를 놓아 마스크 밖을 원본에서
 * 덮어쓰는데, 그게 실제로 걸렸는지는 눈으로 안 보인다 — 차이가 채널당 한둘이라 화면에서는
 * 같은 그림이다. 이 함수가 그 자리를 대신 본다.
 *
 * **근사가 아니라 0을 요구한다.** 파츠는 「얹기 전」과 「얹은 뒤」의 뺄셈으로 떼어 내므로,
 * 마스크 밖에 1이라도 차이가 남으면 그 차이가 파츠 레이어에 얼룩으로 딸려 온다. 몇 px까지는
 * 봐준다고 정해 두면 넘겼는지를 회차마다 다시 판단해야 하고, 얼룩이 눈에 보일 때는 이미
 * 레이어가 여러 장 쌓인 뒤다.
 *
 * **알파가 0인 자리만 「마스크 밖」으로 본다.** 반투명한 자리는 합성이 원본과 결과를 비율로
 * 섞으라고 지시한 자리라 원본과 달라지는 것이 정상이고, 그것까지 세면 제대로 도는 그래프가
 * 실패로 나온다. 대신 마스크를 통째로 옅게 칠하면 셀 자리가 없어져 **0이 공허하게 나오므로**,
 * QA 문서가 「마스크 안은 실제로 다시 그려졌다」를 사람이 보는 항목으로 함께 세워 둔다.
 *
 * @param mask 알파 255가 「모델이 칠해도 되는 자리」다
 * @throws 세 이미지의 크기가 하나라도 어긋나면. 어긋난 채로 0을 돌려주면 「얼렸다」는 거짓 통과가 된다
 */
export function maskedRegionDelta(
  a: IRgbaImage,
  b: IRgbaImage,
  mask: IRgbaImage,
): IMaskedRegionDelta {
  if (
    a.width !== b.width ||
    a.height !== b.height ||
    a.width !== mask.width ||
    a.height !== mask.height
  ) {
    throw new Error(
      `세 이미지의 크기가 다르다: ${a.width}×${a.height} · ${b.width}×${b.height} · ${mask.width}×${mask.height}`,
    );
  }

  let differing = 0;
  let firstAt: { x: number; y: number } | null = null;

  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      if (mask.data[i + 3] !== 0) continue;
      if (
        a.data[i] === b.data[i] &&
        a.data[i + 1] === b.data[i + 1] &&
        a.data[i + 2] === b.data[i + 2] &&
        a.data[i + 3] === b.data[i + 3]
      ) {
        continue;
      }

      differing++;
      if (firstAt === null) firstAt = { x, y };
    }
  }

  return { differing, firstAt };
}

/**
 * 배경색 한 점. 알파가 없는 원본에서 전경을 가를 기준이다.
 *
 * 이 파일의 다른 함수가 배경색을 `[r, g, b]` 튜플로 받는 것과 모양이 다른데, 그쪽은 시트
 * 상수를 그대로 넘기는 자리고 여기는 회차마다 사람이 정한 값을 적어 넣는 자리다 — 이름이
 * 붙어 있으면 세 숫자의 순서를 잘못 적는 사고가 안 난다.
 */
export interface IRgb {
  r: number;
  g: number;
  b: number;
}

/**
 * 배경색에서 충분히 먼 픽셀을 모두 감싸는 사각형 — 알파가 없는 생성 원본의 인물 상자다.
 *
 * `trimBox`가 이미 있는데 따로 두는 이유는 **재는 시점에 알파가 없기** 때문이다. 갓 생성한
 * PNG는 배경 위에 통짜로 불투명해서 `trimBox`는 네 장 모두 캔버스 전체를 돌려주고, 그러면
 * 기하 게이트가 아무것도 안 재고 통과한다 — 계산은 규칙대로 했는데 판정만 없는 상태가 된다.
 *
 * **색 키잉을 배경 제거에 쓰는 것은 2026-08-20에 폐기됐지만, 재는 것은 다르다.** 제거는
 * 인물을 뚫으면 그림이 망가지지만, 상자는 몇 px 어긋나도 4% 허용차 판정을 안 바꾼다.
 * `tools/art/SheetCrop.ts`의 `panelColumns`가 같은 이유로 같은 방식을 쓴다.
 *
 * @param bg 그 회차의 배경색
 * @param tolerance 배경색까지의 거리가 이 값 **이하**면 배경으로 본다. 생성물의 배경은 완전한 단색이 아니라 얼룩이 있고, 그 얼룩을 전경으로 세면 상자가 캔버스 전체가 된다
 * @returns 배경에서 먼 픽셀이 하나도 없으면 `null`
 */
export function chromaBox(img: IRgbaImage, bg: IRgb, tolerance: number): IBox | null {
  const toleranceSq = tolerance * tolerance;
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const dr = img.data[i] - bg.r;
      const dg = img.data[i + 1] - bg.g;
      const db = img.data[i + 2] - bg.b;
      if (dr * dr + dg * dg + db * db <= toleranceSq) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** 네 뷰의 기하가 서로 얼마나 어긋나는가. 앞 셋은 비율, `footLine`만 픽셀 수다. */
export interface IViewGeometrySpread {
  /** 인물 세로의 편차 비율 */
  height: number;
  /** 인물 가로의 편차 비율 */
  width: number;
  /** 종횡비(가로 ÷ 세로)의 편차 비율 */
  aspect: number;
  /** 발 밑선이 가장 아래인 장과 가장 위인 장의 차 (px) */
  footLine: number;
}

/**
 * 값 넷이 벌어진 폭을 중앙값으로 나눈다.
 *
 * **나누는 값이 최대도 최소도 아닌 이유는 넷 중 하나만 튀는 것이 이 게이트가 잡으려는
 * 모양이기 때문이다.** 셋이 400이고 하나가 440일 때 알고 싶은 것은 「기준에서 10% 벌어졌다」인데,
 * 최대(440)로 나누면 9.1%가 나오고 최소(400)로 나누면 10%가 나온다 — 같은 크기의 어긋남이
 * 튄 방향에 따라 다른 점수를 받아서, 크게 튄 회차가 작게 튄 회차보다 관대하게 판정된다.
 * 중앙값은 튄 한 장이 기준을 못 끌고 가므로 양쪽이 같은 점수를 받는다.
 *
 * @param values 넷이어야 한다 — 호출부가 이미 개수를 확인한 뒤 부른다
 */
function spreadRatio(values: number[]): number {
  const sorted = [...values].sort((l, r) => l - r);
  const median = (sorted[1] + sorted[2]) / 2;
  return (sorted[3] - sorted[0]) / median;
}

/**
 * 네 방향 View의 상자를 견줘 서로 얼마나 어긋났는지 낸다.
 *
 * **네 장을 따로 생성하면 한 시트가 주던 상호 참조가 사라진다.** 한 이미지 안에 네 방향을
 * 함께 그릴 때는 모델이 옆 패널을 보고 크기를 맞추는데, 방향별로 나눠 뽑으면 그 참조가
 * 없어서 회차마다 인물이 조금씩 다른 크기로 나온다. 그 자리를 이 값이 메운다.
 *
 * **세로와 발 밑선만 재면 부족하다.** 그 둘이 같아도 가로가 다르면 체형이 다른 인물이고,
 * 세로와 가로가 같은 비율로 커지는 드리프트는 앞 둘 다 못 잡는다 — 종횡비가 그 둘을 가른다.
 * 맨몸에 삭발이면 의상 단서가 없어서 육안으로는 더 안 걸린다.
 *
 * **발 밑선만 비율이 아니라 픽셀 수다.** 정렬은 평행 이동으로 맞추는 값이라 「몇 % 어긋났나」는
 * 뜻이 없고 「몇 px 내려야 하나」가 필요하다.
 *
 * @param boxes 네 방향의 인물 상자. 알파가 없는 원본이면 `chromaBox`가, 배경을 지운 뒤면 `trimBox`가 준다
 * @throws 네 장이 아니면. 세 장으로 판정하면 빠진 방향이 조용히 통과한다
 */
export function viewGeometrySpread(boxes: IBox[]): IViewGeometrySpread {
  if (boxes.length !== 4) throw new Error(`네 장이어야 한다: ${boxes.length}장을 받았다`);

  const footLines = boxes.map((b) => b.y + b.height);

  return {
    height: spreadRatio(boxes.map((b) => b.height)),
    width: spreadRatio(boxes.map((b) => b.width)),
    aspect: spreadRatio(boxes.map((b) => b.width / b.height)),
    footLine: Math.max(...footLines) - Math.min(...footLines),
  };
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
