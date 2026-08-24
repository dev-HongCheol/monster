/**
 * 정렬 기준이 그림 내용과 무관하다는 명세, 그리고 갈아 끼운 열두 장의 출하 규격.
 *
 * **이 파일이 지키는 것은 「소품은 판정에 영향을 주지 않는다」 하나다.** 종전 정렬은 아래 여덟
 * 줄의 불투명 픽셀을 감싸는 바깥 상자를 잡았는데, 바깥 상자는 그 띠 안에 있는 것이 굵은 발인지
 * 6px짜리 막대인지 가리지 않는다. 그래서 지팡이가 발치에 서 있기만 하면 발 중심이 여덟 픽셀
 * 밀렸고, 지팡이 끝이 발보다 아래로 내려오면 그것이 발 밑선 노릇을 했다. 그러면 **그림에 무엇을
 * 더 그렸느냐가 캐릭터가 서는 자리를 바꾼다** — 판정이 아트에 딸려 움직이는 상태다.
 *
 * 새 기준은 발을 먼저 찾고 거기서만 잰다. 굵은 줄이 있는 가장 아래 행을 발로 보고, 그 구간에서
 * 겹치며 이어 붙는 것만 발 띠에 넣는다. 손이 지팡이를 쥐고 있어 그림 전체로는 몸과 지팡이가 한
 * 덩어리지만, **발 띠 안에서는** 둘이 떨어져 있어 갈린다.
 *
 * **합성 회귀에 허용 폭을 두지 않는다.** 지팡이를 얹은 판과 안 얹은 판의 값이 조금이라도 다르면
 * 그것이 곧 소품이 판정에 샌 것이라 봐줄 여지가 없다. 그리고 이 회귀는 지팡이 전용이 아니다 —
 * 다음 소품이 같은 자리에 오면 합성할 PNG만 바꾸면 그대로 쓴다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../tools/art/PngCodec';
import { alignToCanvas, footBand } from '../../tools/art/Postprocess';
import {
  commitAll,
  crossItemViolations,
  type IShipItem,
  type IShippingSpec,
  specViolations,
} from '../../tools/art/Shipping';
import {
  alphaHistogram,
  footLineY,
  footSpanCenterX,
  type IRgbaImage,
  readPngSize,
  trimBox,
} from '../helpers/SpriteMetrics';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * 이 슬라이스가 갈아 끼우는 몸 열두 장.
 *
 * 넷은 v1 화면에 나가고 여덟은 v2 파츠 컷의 입력이라 자리가 다르지만, **같은 실행기가 같은
 * 규격으로 내보내므로 회귀도 열둘을 함께 건다.** 넷만 걸면 나머지 여덟이 아무도 안 재는 채로
 * 남아, 파츠를 자를 때가 되어서야 규격이 다른 것이 드러난다.
 */
const BODY_SHEETS = [
  'game/assets/art/player/player_4dir_front.png',
  'game/assets/art/player/player_4dir_back.png',
  'game/assets/art/player/player_4dir_left.png',
  'game/assets/art/player/player_4dir_right.png',
  'art-source/player/base/player_bald_front.png',
  'art-source/player/base/player_bald_back.png',
  'art-source/player/base/player_bald_left.png',
  'art-source/player/base/player_bald_right.png',
  'art-source/player/base/player_base_front.png',
  'art-source/player/base/player_base_back.png',
  'art-source/player/base/player_base_left.png',
  'art-source/player/base/player_base_right.png',
];

/** 합성 픽스처로 쓰는 지팡이. 이 슬라이스는 이 파일을 안 바꾼다. */
const STAFF = 'game/assets/art/player/player_staff.png';

/** 출하 규격 — `alignToCanvas`가 강제하는 캔버스·발 밑선과 계획 §2.2가 잰 트림 세로 상한. */
const SPEC: IShippingSpec = {
  width: 246,
  height: 493,
  baselineY: 489,
  centerX: 122.5,
  maxTrimHeight: 490,
  mirrorDirections: ['left', 'right'],
  mirrorWidthTolerance: 0.05,
  figureHeightTolerance: 0.04,
};

function loadBytes(rel: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(ROOT, rel)));
}

function load(rel: string): IRgbaImage {
  return decodePng(loadBytes(rel));
}

/** 빈 행 하나 — `fromRuns`의 행 목록을 읽기 쉽게 만든다. */
const EMPTY: Array<[number, number]> = [];

/**
 * 행마다 불투명 구간을 지정해 픽스처를 만든다.
 *
 * 발 판정은 「한 행에서 얼마나 이어졌는가」를 보므로 픽셀을 하나씩 나열하면 20px짜리 발 하나에
 * 스무 칸이 든다. 구간으로 적으면 무엇이 발이고 무엇이 막대인지가 픽스처에서 바로 읽힌다.
 *
 * @param width 캔버스 가로
 * @param rows 위에서 아래 순서의 행별 구간 목록. 구간은 `[from, to]`로 양끝을 포함한다
 * @param alpha 구간을 채울 알파. 기본 255
 */
function fromRuns(width: number, rows: Array<Array<[number, number]>>, alpha = 255): IRgbaImage {
  const data = new Uint8Array(width * rows.length * 4);
  rows.forEach((runs, y) => {
    for (const [from, to] of runs) {
      for (let x = from; x <= to; x++) data.set([10, 20, 30, alpha], (y * width + x) * 4);
    }
  });
  return { width, height: rows.length, data };
}

/**
 * 아래 몇 줄의 불투명 픽셀을 감싸는 바깥 상자.
 *
 * **판정 대상이 아니라 픽스처를 놓을 자리를 정하는 데만 쓴다.** 지팡이를 「발 왼끝에서 8px
 * 왼쪽」에 두려면 발의 왼끝을 알아야 하는데, 그 값을 `footBand`로 잡으면 시험 대상으로 시험
 * 입력을 만드는 꼴이라 함수가 무엇을 하든 픽스처가 따라가 버린다. 종전 정의는 새 기준과
 * 독립이므로 그 자리를 대신 잡는다.
 */
function bottomSpan(img: IRgbaImage, rows: number): { from: number; bottom: number } {
  const bottom = footLineY(img);
  if (bottom === null) throw new Error('픽스처에 불투명 픽셀이 없다');
  const top = Math.max(0, bottom - rows + 1);
  let from = img.width;
  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < from; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] !== 0) {
        from = x;
        break;
      }
    }
  }
  return { from, bottom };
}

/**
 * 몸 위에 지팡이를 얹는다 — 계획 §4.3이 실측에 쓴 배치 그대로다.
 *
 * 막대의 오른끝을 발 왼끝에서 8px 왼쪽에 두어 **발과 떨어져 서게** 한다. 붙여 놓으면 새 기준도
 * 이어 붙은 한 덩어리로 읽어 갈라내지 못하는데, 실제 시트에서 지팡이는 발 옆에 떨어져 선다.
 *
 * @param tipOffset 지팡이 끝을 발 밑선에서 얼마나 아래에 둘지. 음수면 발 밑선 위다
 */
function withStaff(body: IRgbaImage, staff: IRgbaImage, tipOffset: number): IRgbaImage {
  const box = trimBox(staff);
  if (!box) throw new Error('지팡이 픽스처가 비어 있다');
  const span = bottomSpan(body, 8);
  const ox = span.from - 8 - (box.x + box.width - 1);
  const oy = span.bottom + tipOffset - (box.y + box.height - 1);

  const data = new Uint8Array(body.data);
  for (let y = 0; y < staff.height; y++) {
    const ty = y + oy;
    if (ty < 0 || ty >= body.height) continue;
    for (let x = 0; x < staff.width; x++) {
      const tx = x + ox;
      if (tx < 0 || tx >= body.width) continue;
      const src = (y * staff.width + x) * 4;
      if (staff.data[src + 3] === 0) continue;
      data.set(staff.data.subarray(src, src + 4), (ty * body.width + tx) * 4);
    }
  }
  return { width: body.width, height: body.height, data };
}

describe('footBand — 발을 먼저 찾고 거기서만 잰다', () => {
  it('굵은 줄이 있는 가장 아래 행에서 발끝까지 따라 내려간다', () => {
    // 발끝은 안티에일리어싱으로 가늘어져 굵기 기준에 안 걸린다. 굵은 행에서 멈추면 바닥이 한두
    // 줄 위로 올라가고, 네 장의 가늘어진 정도가 서로 다르면 방향을 바꿀 때 캐릭터가 세로로 튄다.
    const img = fromRuns(40, [
      EMPTY,
      [[10, 29]], // 굵은 줄 — 여기가 발이다
      [[12, 27]],
      [[14, 25]], // 가늘어진 발끝 — 여기까지 회수해야 한다
    ]);

    expect(footBand(img, { minRunWidth: 20 })?.baselineY).toBe(3);
  });

  it('발 밑선 아래로 내려온 가는 막대는 바닥을 안 내린다', () => {
    // 종전 기준은 최하단 불투명 행을 그대로 바닥으로 삼았다. 그래서 지팡이 끝이 발보다 세 줄
    // 아래로 오면 바닥이 489에서 492로 내려갔고, 정렬이 그만큼 캐릭터를 위로 밀어 올렸다.
    const img = fromRuns(40, [
      [[10, 29]],
      [[12, 27]],
      [[2, 7]], // 발과 떨어져 선 막대가 발보다 아래로 내려온 줄
      [[2, 7]],
    ]);

    expect(footBand(img, { minRunWidth: 20 })?.baselineY).toBe(1);
  });

  it('발과 떨어져 선 막대는 발 띠에 안 들어온다', () => {
    const img = fromRuns(40, [
      [
        [2, 7],
        [10, 29],
      ],
      [
        [2, 7],
        [10, 29],
      ],
    ]);

    expect(footBand(img, { minRunWidth: 20 })).toEqual({
      baselineY: 1,
      centerX: 19.5,
      from: 10,
      to: 29,
    });
  });

  it('발에 이어 붙은 구간은 굵기가 모자라도 발 띠에 들어온다', () => {
    // 발가락처럼 굵은 줄에서 갈라져 나온 가는 구간을 잃으면 발 띠가 좁아져 중심이 밀린다.
    // 씨앗은 굵은 구간이되, 거기서 겹치며 이어지는 것은 굵기를 다시 묻지 않는다.
    const img = fromRuns(40, [[[10, 29]], [[10, 33]]]);

    expect(footBand(img, { minRunWidth: 20 })?.to).toBe(33);
  });

  it('최소 굵기와 정확히 같은 구간은 발로 센다', () => {
    // `>=`인지 `>`인지가 갈리는 유일한 자리다. 한 칸 밀리면 굵기가 기준과 딱 같은 발이 소품으로
    // 밀려나고, 그 시트만 정렬 기준이 통째로 달라진다.
    const img = fromRuns(40, [[[10, 29]]]);

    expect(footBand(img, { minRunWidth: 20 })?.from).toBe(10);
  });

  it('최소 굵기보다 하나 가는 구간만 있으면 발을 못 찾는다', () => {
    expect(footBand(fromRuns(40, [[[10, 28]]]), { minRunWidth: 20 })).toBeNull();
  });

  it('알파 16 이하는 없는 것으로 본다', () => {
    // 이름이 「불투명 픽셀」인데 알파 1도 세던 것을 여기서 닫는다(F102 ②). 알파 1~16은
    // `normalizeAlpha`가 0으로 누르기로 한 잡음이고, 실행기에서 정렬은 그 정규화 **뒤에**
    // 오므로 규칙을 이름에 맞춰도 출하물은 달라지지 않는다.
    const img = fromRuns(40, [EMPTY, [[10, 29]]]);
    for (let x = 0; x < 40; x++) img.data.set([10, 20, 30, 16], x * 4);

    expect(footBand(img, { minRunWidth: 20 })?.baselineY).toBe(1);
  });

  it('발에 이어진 것이 발 띠보다 길게 내려가도 발 중심을 잃지 않는다', () => {
    // **이 판이 조용히 틀린 값을 내던 자리다.** 발 띠 창은 바닥에서 위로 `rows`줄인데 발을
    // 찾은 굵은 행은 그 창 안에 있다는 보장이 없었다 — 발에 이어져 아래로 늘어진 것이
    // `rows`줄보다 길면 씨앗이 창 밖으로 밀려나 띠가 통째로 비고, 그러면 `from`이 캔버스 폭,
    // `to`가 -1인 채 반환돼 **중심이 캔버스 정중앙으로 나온다.** 예외도 null도 아니라
    // `alignToCanvas`가 그 값을 그대로 써서 발이 아니라 캔버스를 기준으로 세운다.
    //
    // 발이 캔버스 중앙에서 벗어난 픽스처여야 그 둘이 갈린다 — 발 중심 13.5, 캔버스 중앙 19.5다.
    const img = fromRuns(40, [
      [[4, 23]],
      ...Array.from({ length: 12 }, () => [[9, 11]] as Array<[number, number]>),
    ]);

    expect(footBand(img, { minRunWidth: 20 })).toEqual({
      baselineY: 12,
      centerX: 13.5,
      from: 4,
      to: 23,
    });
  });

  it('굵은 줄이 하나도 없으면 null이다', () => {
    expect(footBand(fromRuns(40, [[[2, 7]]]), { minRunWidth: 20 })).toBeNull();
  });

  it('기본 최소 굵기가 20이다', () => {
    // 인자를 명시로 넘기면 기본값이 안 걸린다. 이 값은 「발은 굵고 소품은 가늘다」에 기대는데,
    // 현행 열두 장의 발이 20~28px이고 지팡이가 아래 여덟 줄에서 6~12px이라 그 사이에 있다.
    expect(footBand(fromRuns(40, [[[10, 29]]]))?.from).toBe(10);
    expect(footBand(fromRuns(40, [[[10, 28]]]))).toBeNull();
  });
});

describe('footBand — 현행 열두 장 실측', () => {
  it.each(BODY_SHEETS)('%s의 발 밑선이 489다', (rel) => {
    expect(footBand(load(rel))?.baselineY).toBe(489);
  });

  it.each(BODY_SHEETS)('%s의 발 중심이 캔버스 중앙에서 2px 안이다', (rel) => {
    // 캔버스 246의 중앙은 픽셀 인덱스로 122.5다. 실측이 122.0~124.0이라 2px이 열둘을 다 담으면서
    // 한 장이 통째로 밀리는 것은 잡는다. 이 열둘은 구 파이프라인 산물이라 값이 정확히 모이지 않고,
    // 새 실행기를 지난 교체본은 `alignToCanvas`가 중앙에 세우므로 더 좁게 모인다.
    const band = footBand(load(rel));

    expect(band).not.toBeNull();
    expect(Math.abs((band?.centerX ?? 0) - 122.5)).toBeLessThanOrEqual(2);
  });
});

describe('정렬 기준은 지팡이를 모른다 — 합성 회귀', () => {
  it.each(BODY_SHEETS)('%s에 지팡이를 발 옆에 세워도 발 띠가 그대로다', (rel) => {
    const body = load(rel);

    // 끝을 발 밑선 2px 위에 둔다 — 바닥은 안 건드리고 **발 중심만** 시험하는 배치다.
    expect(footBand(withStaff(body, load(STAFF), -2))).toEqual(footBand(body));
  });

  it.each(BODY_SHEETS)('%s에 지팡이가 발보다 아래로 내려와도 발 띠가 그대로다', (rel) => {
    const body = load(rel);

    // 끝을 발 밑선 3px 아래에 둔다 — 종전 기준이 바닥을 489에서 492로 내리던 배치다.
    expect(footBand(withStaff(body, load(STAFF), 3))).toEqual(footBand(body));
  });
});

describe('alignToCanvas — 발 띠를 기준으로 세운다', () => {
  /**
   * 발이 21px이고 몸통이 그 위에 선 픽스처. 발 중심은 16이고 발 밑선은 마지막 행이다.
   *
   * @param bar 발 왼쪽에 떨어져 세울 막대가 걸칠 행 수. 0이면 막대가 없다
   * @param height 전체 행 수. 발보다 아래 행은 막대만 차지한다
   */
  function figure(bar = 0, height = 5): IRgbaImage {
    const rows: Array<Array<[number, number]>> = Array.from({ length: height }, () => EMPTY);
    const body: Array<[number, number]>[] = [
      [[12, 20]],
      [[12, 20]],
      [[10, 22]],
      [[6, 26]],
      [[6, 26]],
    ];
    body.forEach((runs, i) => {
      rows[i] = [...runs];
    });
    for (let y = 0; y < bar; y++) rows[y] = [[0, 3], ...rows[y]];
    return fromRuns(41, rows);
  }

  it('발 밑선을 여백 위에 놓고 발 중심을 가로 중앙에 맞춘다', () => {
    const out = alignToCanvas(figure(), { width: 41, height: 12, bottomMargin: 1 });

    expect(footBand(out)).toEqual({ baselineY: 10, centerX: 20, from: 10, to: 30 });
  });

  it('발 옆에 선 막대가 놓일 자리를 안 바꾼다', () => {
    // 막대를 발보다 **아래로** 내리는 판은 여기서 시험할 수 없다. 그러면 그림 전체가 캔버스를
    // 벗어나 아래 가드가 먼저 던지기 때문이다 — 그건 맞는 정지라, 그 배치는 위 합성 회귀가
    // `footBand`를 직접 재서 확인한다.
    const out = alignToCanvas(figure(4), { width: 41, height: 12, bottomMargin: 1 });

    expect(footBand(out)).toEqual({ baselineY: 10, centerX: 20, from: 10, to: 30 });
  });

  it('캔버스를 벗어나는지 보는 가드는 지팡이까지 포함한 그림 전체를 본다', () => {
    // 여기서 묻는 것은 「캐릭터가 제자리에 섰는가」가 아니라 「그린 것이 캔버스 안에 다 들어가는가」다.
    // 지팡이도 그려지는 이상 잘리면 안 되므로, 정렬 기준이 발만 보게 된 뒤에도 이 가드는 그대로다.
    // 막대가 발보다 두 줄 아래까지 내려온 판을 발 밑선 여백 1에 세우면 막대 끝이 캔버스 밖이다.
    expect(() => alignToCanvas(figure(7, 7), { width: 41, height: 6, bottomMargin: 1 })).toThrow(
      '세로',
    );
  });

  it('발을 못 찾으면 던진다', () => {
    const barOnly = fromRuns(41, [[[0, 3]], [[0, 3]]]);

    expect(() => alignToCanvas(barOnly, { width: 41, height: 12, bottomMargin: 1 })).toThrow();
  });
});

describe('footSpanCenterX — 정렬 기준이 아니라 판정 지표다', () => {
  it('아래 몇 줄의 불투명 픽셀을 감싸는 바깥 상자의 중심을 낸다', () => {
    const img = fromRuns(40, [
      [
        [2, 7],
        [10, 29],
      ],
      [[10, 29]],
    ]);

    expect(footSpanCenterX(img, 1)).toBe(19.5);
    expect(footSpanCenterX(img, 2)).toBe(15.5);
  });

  it('띠를 넓히면 기울어 선 소품이 값을 끌어간다', () => {
    // **이 성질이 이 지표의 값어치다.** 정렬이 지팡이를 모르게 되면 「이 시트에 지팡이가
    // 남았는가」를 정렬 값으로는 알 수 없는데, 바깥 상자는 반대로 소품에 민감하다. 다만 얼마나
    // 벌어져야 지팡이가 남은 것인지는 시트마다 달라서, 통과선은 여기가 아니라 판정 실행기가 든다.
    const img = fromRuns(40, [
      [
        [0, 3],
        [10, 29],
      ],
      [
        [4, 7],
        [10, 29],
      ],
    ]);

    expect(footSpanCenterX(img, 1)).toBe(16.5);
    expect(footSpanCenterX(img, 2)).toBe(14.5);
  });

  it('알파가 있는 픽셀이 없으면 null이다', () => {
    expect(footSpanCenterX(fromRuns(4, [EMPTY]), 1)).toBeNull();
  });
});

describe('출하 규격 — 갈아 끼운 열두 장', () => {
  it.each(BODY_SHEETS)('%s의 캔버스가 246×493이다', (rel) => {
    // 헤더만 읽는다. 캔버스는 열두 장 전부에 대해 재는데 이 항목에는 픽셀이 필요 없고,
    // 전량 디코딩은 그만큼 느리다 — `readPngSize`가 그러라고 있는 함수다.
    expect(readPngSize(loadBytes(rel))).toEqual({ width: SPEC.width, height: SPEC.height });
  });

  it.each(BODY_SHEETS)('%s의 발 밑선이 여백 3 위에 있다', (rel) => {
    // `alignToCanvas`가 출력에 강제하는 값이라 이 단언은 지팡이를 잡지 못한다. 그래도 남기는
    // 이유는 **실행기가 올바른 캔버스·여백 인자로 돌았는지**를 재기 때문이다.
    expect(footBand(load(rel))?.baselineY).toBe(SPEC.baselineY);
  });

  it.each(BODY_SHEETS)('%s에 희미한 알파가 0px이다', (rel) => {
    // 절대 기준으로 잡는다. 현행 열두 장이 0~4px이라 「현행 수준」을 기준선으로 쓰면 정본보다
    // 느슨해지고, 새 실행기는 `normalizeAlpha`를 지나므로 이 값이 정의상 0이 된다.
    expect(alphaHistogram(load(rel)).faint).toBe(0);
  });

  it.each(BODY_SHEETS)('%s의 트림 세로가 490 이하다', (rel) => {
    // 캔버스 세로 493에서 발 밑선 여백 3을 빼면 남는 자리가 490이다. 넘으면 `alignToCanvas`가
    // 던지는데, 이 단언이 예외보다 먼저 어느 장이 얼마나 큰지를 말해 준다.
    expect(trimBox(load(rel))?.height).toBeLessThanOrEqual(SPEC.maxTrimHeight);
  });
});

/**
 * 규격을 지키는 최소 픽스처 — 발 다섯 줄만 서 있다.
 *
 * 시트와 방향을 받아 이름을 짓는 것은 **장끼리 비교하는 판정이 그 둘로 짝을 찾기** 때문이다.
 * 이름만 받으면 픽스처가 어느 시트의 어느 방향인지 말할 수 없어 `crossItemViolations`를 시험할
 * 입력을 못 만든다.
 */
function shippable(sheet: string, direction: string): IShipItem {
  const rows: Array<Array<[number, number]>> = Array.from({ length: SPEC.height }, () => EMPTY);
  for (let y = SPEC.baselineY - 4; y <= SPEC.baselineY; y++) rows[y] = [[113, 132]];
  return { name: `${sheet}_${direction}`, sheet, direction, image: fromRuns(SPEC.width, rows) };
}

/**
 * 발 다섯 줄 위에 몸통을 세운 픽스처 — 트림 상자의 가로·세로를 시험이 정한다.
 *
 * 발은 규격을 지나야 하므로 폭 20px·발 밑선 위 다섯 줄로 고정하고, 그 위에 원하는 크기의
 * 덩어리를 얹어 트림 상자만 바꾼다. 발을 건드리지 않으므로 장끼리 비교하는 판정만 반응한다.
 */
function withFigure(
  sheet: string,
  direction: string,
  figure: { width: number; height: number },
): IShipItem {
  const item = shippable(sheet, direction);
  const top = SPEC.baselineY - 4 - figure.height;
  const from = Math.round(SPEC.centerX) - Math.floor(figure.width / 2);
  for (let y = top; y < top + figure.height; y++) {
    for (let x = from; x < from + figure.width; x++) {
      item.image.data.set([10, 20, 30, 255], (y * SPEC.width + x) * 4);
    }
  }
  return item;
}

describe('specViolations — 어느 장의 무슨 값이 틀렸는지 말한다', () => {
  it('규격을 지키면 위반이 없다', () => {
    expect(specViolations(shippable('player_4dir', 'front'), SPEC)).toEqual([]);
  });

  it('캔버스가 다르면 이름과 잰 값이 문장에 든다', () => {
    // 위반 문장은 사람이 읽고 어느 장을 다시 뽑을지 정하는 자리다. 어느 장인지가 빠지면 열두
    // 장을 하나씩 열어 봐야 한다.
    const item: IShipItem = {
      name: 'player_4dir_front',
      sheet: 'player_4dir',
      direction: 'front',
      image: fromRuns(240, [[[0, 19]]]),
    };

    expect(specViolations(item, SPEC).join('\n')).toMatch(/front[\s\S]*240/);
  });

  it('희미한 알파가 하나라도 있으면 위반이다', () => {
    const item = shippable('player_4dir', 'back');
    item.image.data.set([10, 20, 30, 8], 0);

    expect(specViolations(item, SPEC)).toHaveLength(1);
  });

  it('발 밑선이 어긋나면 위반이다', () => {
    const item = shippable('player_4dir', 'right');
    for (let x = 113; x <= 132; x++) {
      item.image.data.set([0, 0, 0, 0], (SPEC.baselineY * SPEC.width + x) * 4);
    }

    expect(specViolations(item, SPEC)).toHaveLength(1);
  });

  it('발 중심이 캔버스 중앙에서 벗어나면 위반이다', () => {
    // **이 슬라이스가 통째로 매달린 값인데 관문이 안 재고 있었다.** 정렬이 어떤 이유로든
    // 가로를 놓치면 「전부 통과할 때만 쓴다」가 그것을 그냥 지나보낸다.
    //
    // 허용 폭 0.5는 조절값이 아니다 — `alignToCanvas`가 `dx`를 정수로 반올림하므로 중심이
    // 목표에서 최대 0.5까지 남는 것이 정상이고, 그보다 벗어났다면 반올림이 아니라 기준이
    // 어긋난 것이다.
    const item = shippable('player_4dir', 'front');
    for (let y = SPEC.baselineY - 4; y <= SPEC.baselineY; y++) {
      for (let x = 113; x <= 132; x++) item.image.data.set([0, 0, 0, 0], (y * SPEC.width + x) * 4);
      for (let x = 133; x <= 152; x++) {
        item.image.data.set([10, 20, 30, 255], (y * SPEC.width + x) * 4);
      }
    }

    expect(specViolations(item, SPEC)).toHaveLength(1);
    expect(specViolations(item, SPEC)[0]).toContain('발 중심');
  });

  it('반올림이 남긴 0.5는 위반이 아니다', () => {
    // 실제 출하본 열두 장이 122.5~123.0으로 나오므로, 0.5를 위반으로 잡으면 정상 산출물이
    // 통째로 막힌다.
    // 발을 한 칸 넓혀 중심을 122.5에서 123.0으로 민다. 폭이 21px이라 굵기 기준은 그대로 넘는다.
    const item = shippable('player_4dir', 'back');
    for (let y = SPEC.baselineY - 4; y <= SPEC.baselineY; y++) {
      item.image.data.set([10, 20, 30, 255], (y * SPEC.width + 133) * 4);
    }

    expect(specViolations(item, SPEC)).toEqual([]);
  });

  it('발을 어떻게 찾을지를 규격이 정한다', () => {
    // 정렬과 판정이 서로 다른 기준으로 발을 찾으면 「A로 세우고 B로 잰다」가 되어, 통과한
    // 출하물이 실제로는 다른 자리에 서 있을 수 있다. 규격이 그 인자를 들어 실행기가 한 곳에서
    // 넘기게 한다.
    const rows: Array<Array<[number, number]>> = Array.from({ length: SPEC.height }, () => EMPTY);
    for (let y = SPEC.baselineY - 4; y <= SPEC.baselineY; y++) rows[y] = [[120, 125]];
    const item: IShipItem = {
      name: 'player_4dir_left',
      sheet: 'player_4dir',
      direction: 'left',
      image: fromRuns(SPEC.width, rows),
    };

    // 굵기 6px짜리 발은 기본 기준(20)으로는 안 잡히고, 규격이 기준을 내려 주면 잡힌다.
    expect(specViolations(item, SPEC).join('\n')).toContain('발');
    expect(specViolations(item, { ...SPEC, foot: { minRunWidth: 6 } })).toEqual([]);
  });

  it('트림 세로가 상한을 넘으면 위반이다', () => {
    // 발 밑선이 여백 3 위에 제대로 섰는데도 걸릴 수 있다. 정렬이 소품을 모르게 된 뒤로는 발보다
    // 아래로 내려온 소품이 발 밑선을 안 밀지만, 그 소품도 캔버스 안에 들어가야 하기 때문이다.
    const item = shippable('player_4dir', 'left');
    for (let x = 113; x <= 132; x++) {
      item.image.data.set([10, 20, 30, 255], (0 * SPEC.width + x) * 4);
    }
    for (let x = 100; x <= 103; x++) {
      item.image.data.set([10, 20, 30, 255], ((SPEC.baselineY + 1) * SPEC.width + x) * 4);
    }

    expect(specViolations(item, SPEC)).toHaveLength(1);
  });
});

describe('commitAll — 한 장이라도 떨어지면 아무것도 안 쓴다', () => {
  it('전부 통과하면 준 순서대로 쓴다', () => {
    const written: string[] = [];

    commitAll(
      [
        shippable('player_4dir', 'front'),
        shippable('player_4dir', 'back'),
        shippable('player_4dir', 'left'),
      ],
      SPEC,
      (item) => {
        written.push(item.name);
      },
    );

    expect(written).toEqual(['player_4dir_front', 'player_4dir_back', 'player_4dir_left']);
  });

  it('한 장이 규격에서 떨어지면 쓰기가 0번 불린다', () => {
    // **이 단언이 이 절의 이유다.** 절반만 새 판인 상태가 가장 나쁘다 — 열두 장이 서로 다른
    // 파이프라인 산물이 되면 어느 것이 기준인지 알 방법이 없고, 화면에서는 방향을 바꿀 때만
    // 드러난다. 그래서 판정을 전부 먼저 돌리고 한 장이라도 떨어지면 손을 뗀다.
    const written: string[] = [];
    const bad: IShipItem = {
      name: 'player_4dir_left',
      sheet: 'player_4dir',
      direction: 'left',
      image: fromRuns(240, [[[0, 19]]]),
    };

    expect(() =>
      commitAll(
        [shippable('player_4dir', 'front'), shippable('player_4dir', 'back'), bad],
        SPEC,
        (item) => {
          written.push(item.name);
        },
      ),
    ).toThrow('left');
    expect(written).toEqual([]);
  });

  it('쓰기가 도중에 던지면 이미 쓴 장을 이름으로 말한다', () => {
    // **규격 판정은 원자성을 지키지만 쓰기 자체는 못 지킨다.** 이 워크플로는 사용자가 Cocos를
    // 열어 둔 채로 돌리는 것을 전제하는데, Windows에서 에디터가 임포트 중인 PNG를 잡고 있으면
    // 덮어쓰기가 `EBUSY`로 떨어진다. 그때 앞서 쓴 것은 남으므로, 무엇이 남았는지를 사람이
    // 알아야 되돌릴 수 있다.
    const written: string[] = [];

    expect(() =>
      commitAll(
        [
          shippable('player_4dir', 'front'),
          shippable('player_4dir', 'back'),
          shippable('player_4dir', 'left'),
        ],
        SPEC,
        (item) => {
          if (item.name === 'player_4dir_left') throw new Error('EBUSY');
          written.push(item.name);
        },
      ),
    ).toThrow(/front[\s\S]*back/);
    expect(written).toEqual(['player_4dir_front', 'player_4dir_back']);
  });

  it('떨어진 장이 여럿이면 전부 말한다', () => {
    // 하나만 말하고 멈추면 고치고 다시 돌릴 때마다 다음 하나가 나와, 유료 호출이 든 실행을 그
    // 횟수만큼 되풀이하게 된다.
    const items: IShipItem[] = [
      {
        name: 'player_4dir_front',
        sheet: 'player_4dir',
        direction: 'front',
        image: fromRuns(240, [[[0, 19]]]),
      },
      {
        name: 'player_4dir_back',
        sheet: 'player_4dir',
        direction: 'back',
        image: fromRuns(200, [[[0, 19]]]),
      },
    ];

    expect(() => commitAll(items, SPEC, () => {})).toThrow(/front[\s\S]*back/);
  });
});

describe('crossItemViolations — 한 장만 봐서는 못 잡는 어긋남', () => {
  /**
   * 세 시트가 같은 인물을 같은 크기로 그린, 어긋남 없는 열두 장.
   *
   * 인물 크기를 시트마다 조금씩 다르게 둔 것은 **정상 편차를 통과시키는지도 함께 재기**
   * 위해서다. 실측에서 옷 입은 판과 대머리 판이 트림 세로 480과 485로 1% 안에 들었고, 판정이
   * 그 정도를 위반으로 잡으면 정상 산출물이 통째로 막힌다.
   */
  function healthySet(): IShipItem[] {
    const items: IShipItem[] = [];
    for (const [sheet, h] of [
      ['player_4dir', 480],
      ['player_bald', 485],
      ['player_base', 470],
    ] as const) {
      for (const [direction, w] of [
        ['front', 216],
        ['back', 218],
        ['left', 173],
        ['right', 171],
      ] as const) {
        items.push(withFigure(sheet, direction, { width: w, height: h }));
      }
    }
    return items;
  }

  it('세 시트가 같은 크기로 그려졌으면 위반이 없다', () => {
    expect(crossItemViolations(healthySet(), SPEC)).toEqual([]);
  });

  it('한 시트의 좌우 트림 가로가 크게 다르면 위반이다', () => {
    // 실측한 결함이 이것이다 — 맨살 시트의 왼쪽 패널에서 지팡이 쥐던 팔이 통째로 안 그려져
    // 트림 가로가 110과 131로 갈렸다(19% 차). 한 장씩 보는 판정은 둘 다 규격 안이라 통과시킨다.
    const items = healthySet().map((item) =>
      item.name === 'player_base_left'
        ? withFigure('player_base', 'left', { width: 110, height: 470 })
        : item,
    );

    const problems = crossItemViolations(items, SPEC);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('player_base_left');
    expect(problems[0]).toContain('player_base_right');
  });

  it('좌우가 조금 다른 것은 위반이 아니다', () => {
    // 옷 입은 판이 173과 171로 1.2% 갈려 있다. 생성 모델이 두 장을 따로 그리므로 완전한 대칭은
    // 애초에 안 나오고, 0을 요구하면 정상 산출물이 매번 막힌다.
    expect(crossItemViolations(healthySet(), SPEC)).toEqual([]);
  });

  it('시트끼리 인물 키가 다르면 위반이다', () => {
    // 실측한 결함이 이것이다 — 맨살 시트만 6% 작게 그려져 출하본 트림 세로가 455 대 480·485로
    // 갈렸다. `alignToCanvas`는 평행 이동만 하므로 이 차이가 그대로 출하된다. 층 구조는 맨살
    // 위에 옷을 얹는 것이라, 몸이 작으면 소매가 팔을 안 덮는다.
    const items = healthySet().map((item) =>
      item.sheet === 'player_base'
        ? withFigure('player_base', item.direction, { width: 200, height: 450 })
        : item,
    );

    // 네 방향 전부가 걸린다 — 한 방향만 말하면 나머지 셋을 고치고 다시 돌릴 때 또 나온다.
    expect(crossItemViolations(items, SPEC)).toHaveLength(4);
    expect(crossItemViolations(items, SPEC)[0]).toContain('front');
  });

  it('다른 방향끼리는 키를 비교하지 않는다', () => {
    // 정면과 측면은 실루엣이 달라 트림 세로도 다를 수 있다. 방향을 섞어 재면 정상 편차가 위반이
    // 되고, 그러면 사람이 판정을 끄게 된다.
    const items = [
      withFigure('player_4dir', 'front', { width: 216, height: 480 }),
      withFigure('player_4dir', 'left', { width: 173, height: 300 }),
    ];

    expect(crossItemViolations(items, SPEC)).toEqual([]);
  });

  it('짝이 없는 방향은 대칭을 안 잰다', () => {
    // 실행기가 네 방향을 다 내지만, 시험과 부분 실행은 한두 장만 넘길 수 있다. 짝이 없다고
    // 위반으로 잡으면 그 쓰임이 통째로 막힌다.
    const items = [withFigure('player_4dir', 'left', { width: 110, height: 480 })];

    expect(crossItemViolations(items, SPEC)).toEqual([]);
  });

  it('위반 문장이 잰 값을 든다', () => {
    // 사람이 이 문장만 보고 어느 시트를 다시 뽑을지 정한다. 값이 없으면 결국 열두 장을 열어
    // 눈으로 재게 된다.
    const items = healthySet().map((item) =>
      item.name === 'player_base_left'
        ? withFigure('player_base', 'left', { width: 110, height: 470 })
        : item,
    );

    expect(crossItemViolations(items, SPEC)[0]).toMatch(/110[\s\S]*171|171[\s\S]*110/);
  });

  it('commitAll이 이 판정도 함께 돌린다', () => {
    // **여기서 안 돌리면 판정이 있으나 마나다.** 실행기가 따로 부르는 구조면 부르는 것을 잊어도
    // 아무 신호가 없고, 어긋난 열두 장이 조용히 나간다.
    const written: string[] = [];
    const items = healthySet().map((item) =>
      item.name === 'player_base_left'
        ? withFigure('player_base', 'left', { width: 110, height: 470 })
        : item,
    );

    expect(() => commitAll(items, SPEC, (item) => written.push(item.name))).toThrow(
      'player_base_left',
    );
    expect(written).toEqual([]);
  });
});
