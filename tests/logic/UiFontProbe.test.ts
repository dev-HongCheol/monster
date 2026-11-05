import { afterEach, describe, expect, it } from 'vitest';
import {
  isNearUiThreshold,
  judgeUiShare,
  summarize,
  UI_THRESHOLD_MS,
} from '../../game/assets/scripts/logic/FrameStatsLogic';
import { MeasureSchedule } from '../../game/assets/scripts/logic/MeasureScheduleLogic';
import {
  buildFontAbortRecord,
  buildVerdictRecord,
  captureFileToken,
  columnLabels,
  commonBodyWeights,
  digitWidthsEqual,
  driverValue,
  fontFaceStatus,
  fontTimedOut,
  judgeValidity,
  lineHeightPx,
  matchFontTiming,
  nextBodyWeight,
  PROBE_BAND_PX,
  PROBE_ROW_GAP_PX,
  pageRows,
  parseFontProbeConfig,
  stackHeight,
  timerText,
  typeScale,
  uiBlockFlags,
} from '../../game/assets/scripts/logic/UiFontProbeLogic';
import {
  type IVfxRecipe,
  labOffMode,
  parseLabUrl,
  resultFileName,
  uiResultFileName,
} from '../../game/assets/scripts/logic/VfxRecipeLogic';
import {
  isFontProbeMode,
  isLabStage,
  LabRuntime,
  labVfxEnabled,
  pausesGameTimer,
} from '../../game/assets/scripts/systems/LabRuntime';

/**
 * UI 폰트 실행 탐침(폰트 판정 화면 `?lab=font`과 UI 몫 측정 `?lab=measure&off=ui`)의 순수 로직.
 * - UiFontProbeLogic: 글자 단계 · 판정 화면 높이 · 유효 판정 · 폰트 상태 · 결과 JSON
 * - FrameStatsLogic: 상위 5% · 20ms 초과 수 · UI 몫 판정
 * - VfxRecipeLogic.parseLabUrl · MeasureSchedule · LabRuntime: 측정 모드 확장과 판정 화면 분기
 *
 * 폰트 이름은 중립 이름(FontX · FontY)을 쓴다. 판정용 후보 이름이 테스트 고정값으로 저장소에 남으면
 * 판정이 끝난 뒤에도 후보 이름을 지울 수 없기 때문이다.
 */

// ---------------------------------------------------------------------------
// 테스트용 값
// ---------------------------------------------------------------------------

const TWO_FONTS = {
  fonts: [
    { stem: 'FontX', body: [400, 500], title: 800 },
    { stem: 'FontY', body: [400, 500], title: 800 },
  ],
};

/** parseLabUrl이 받는 설정 파일 검사 결과 — DataManager가 넘기는 것과 같은 모양이다. */
const PROBE = parseFontProbeConfig(TWO_FONTS);

function recipe(over: Partial<IVfxRecipe> & Pick<IVfxRecipe, 'id' | 'method'>): IVfxRecipe {
  return {
    shape: 'glow',
    count: 48,
    life: 0.4,
    size: 1,
    color: '#ff6633',
    blend: 'add',
    emitShape: 'point',
    picked: false,
    ...over,
  } as IVfxRecipe;
}

const RECIPES: IVfxRecipe[] = [recipe({ id: 'ga1', method: 'ga', picked: true })];

/** rate · worldSpace · speed가 빠져 레시피 검사에 걸리는 후보 */
const BAD_RECIPES: IVfxRecipe[] = [...RECIPES, recipe({ id: 'na9', method: 'na' })];

/** PerformanceResourceTiming에서 결과 JSON에 쓰는 칸만 가진 항목. */
function timing(
  name: string,
  startTime: number,
  sizes: { transfer: number; encoded: number; decoded: number } = {
    transfer: 410_000,
    encoded: 409_700,
    decoded: 409_700,
  },
) {
  return {
    name,
    startTime,
    transferSize: sizes.transfer,
    encodedBodySize: sizes.encoded,
    decodedBodySize: sizes.decoded,
    duration: 120,
    initiatorType: 'other',
  };
}

const URL_X = 'assets/resources/native/3f/3f2a9c1e-77aa.8b7d6.ttf';
const URL_Y = 'assets/resources/native/5b/5b11d0c4-12cd.0f9e1.ttf';
const ORIGIN = 'http://127.0.0.1:7456/';

// ===========================================================================
// UiFontProbeLogic — 글자 단계 · 줄 높이
// ===========================================================================

describe('UiFontProbeLogic — typeScale · lineHeightPx', () => {
  it.each([
    [16, 1.25, [16, 20, 25, 31]],
    [16, 1.2, [16, 19, 23, 28]],
    [16, 1.333, [16, 21, 28, 38]],
  ])('기준 %d · 비율 %d의 네 단계는 Math.round(기준 × 비율^n) 정수 px다', (base, ratio, px) => {
    expect(typeScale(base, ratio, 4)).toEqual(px);
  });

  it('0단계는 기준 크기 그대로다 — 기준이 가장 작은 글자이기 때문이다', () => {
    expect(typeScale(16, 1.333, 4)[0]).toBe(16);
  });

  it.each([
    [17, 1.25, [17, 21, 27, 33]],
    [18, 1.333, [18, 24, 32, 43]],
  ])('기준을 %d로 올리면 단계가 모두 그 기준에서 다시 나온다', (base, ratio, px) => {
    expect(typeScale(base, ratio, 4)).toEqual(px);
  });

  it('줄 높이는 비율이 아니라 정수 px다 — Cocos Label이 줄 높이를 px로 받기 때문이다', () => {
    expect(lineHeightPx(16, 1.35)).toBe(22);
    expect(lineHeightPx(20, 1.5)).toBe(30);
  });
});

// ===========================================================================
// UiFontProbeLogic — 판정 화면 높이
// ===========================================================================

describe('UiFontProbeLogic — stackHeight (첫 화면에 넣을 줄 고르기)', () => {
  /** 판정 화면이 가장 길어지는 조합(기준 18 · 비율 1.333 · 줄 높이 1.5)에서 어림한 줄 높이 */
  const WORST = [
    { id: '1-가', height: 65 },
    { id: '1-나', height: 48 },
    { id: '1-다', height: 36 },
    { id: '1-라', height: 27 },
    { id: '1-마', height: 200 },
    { id: '2', height: 60 },
    { id: '3', height: 108 },
    { id: '4', height: 54 },
    { id: '4-en', height: 54 },
    { id: '5', height: 36 },
    { id: '6', height: 36 },
  ] as const;

  /** 처음 값(기준 16 · 비율 1.25 · 줄 높이 1.35)을 어림한 줄 높이 */
  const INITIAL = [
    { id: '1-가', height: 34 },
    { id: '1-나', height: 27 },
    { id: '1-다', height: 22 },
    { id: '1-라', height: 22 },
    { id: '1-마', height: 129 },
    { id: '2', height: 60 },
    { id: '3', height: 88 },
    { id: '4', height: 44 },
    { id: '4-en', height: 44 },
    { id: '5', height: 27 },
    { id: '6', height: 27 },
  ] as const;

  const KOREAN_1_TO_4 = ['1-가', '1-나', '1-다', '1-라', '2', '3', '4'];

  it('쌓은 높이는 위 · 아래 띠 + 줄 높이 합 + 줄 사이 간격이다', () => {
    const rows = [
      { id: '1-가', height: 100 },
      { id: '2', height: 50 },
    ] as const;
    expect(stackHeight(rows).height).toBe(PROBE_BAND_PX + 150 + PROBE_ROW_GAP_PX);
    expect(PROBE_ROW_GAP_PX).toBe(8);
  });

  it('처음 값을 어림한 높이에서는 여섯 줄 모두 첫 화면에 들어간다', () => {
    const r = stackHeight(INITIAL);
    expect(r.second).toEqual([]);
    expect(r.first).toEqual(INITIAL.map((row) => row.id));
    expect(r.firstScreenOverflow).toBe(false);
  });

  it('넘치면 6번 → 5번 → 영어 줄(1-마 · 4번 영어 문장) 차례로 둘째 화면에 보내고, 한국어 1~4번 줄은 남긴다', () => {
    const r = stackHeight(WORST);
    expect(r.second).toEqual(['6', '5', '1-마', '4-en']);
    expect(r.first).toEqual(KOREAN_1_TO_4);
    expect(r.firstScreenOverflow).toBe(false);
    expect(r.height).toBeLessThanOrEqual(720);
  });

  it('6번 하나만 보내서 들어가면 거기서 멈춘다', () => {
    // 3번 줄을 늘려 전체 높이를 721px로 맞춘다. 6번 줄(30px)과 그 앞 간격(8px)만 빼면 720 안에
    // 들어가므로, 5번 줄까지 보내면 필요 이상으로 줄을 둘째 화면에 넘긴 것이다
    const rows = INITIAL.map((row) => (row.id === '6' ? { id: row.id, height: 30 } : row));
    const total = stackHeight(rows).height;
    const extra = 720 - total + 1;
    const tight = rows.map((row) =>
      row.id === '3' ? { id: row.id, height: row.height + extra } : row,
    );
    const r = stackHeight(tight);
    expect(r.second).toEqual(['6']);
    expect(r.firstScreenOverflow).toBe(false);
  });

  it('한국어 1~4번 줄만으로 넘치면 firstScreenOverflow다 — 판정 화면이 무효로 띄운다', () => {
    const rows = WORST.map((row) => (row.id === '3' ? { id: row.id, height: 400 } : row));
    const r = stackHeight(rows);
    expect(r.firstScreenOverflow).toBe(true);
    expect(r.first).toEqual(KOREAN_1_TO_4);
  });

  it('화면 높이를 받으면 그 높이로 판단한다(기본 720)', () => {
    expect(stackHeight(INITIAL, 400).firstScreenOverflow).toBe(true);
  });
});

describe('UiFontProbeLogic — pageRows (둘째 화면에 다 안 들어가면 다음 화면으로)', () => {
  it('다 들어가면 한 화면이다', () => {
    expect(
      pageRows([
        { id: 'b-title', height: 100 },
        { id: 'b-stats', height: 100 },
      ]),
    ).toEqual([['b-title', 'b-stats']]);
  });

  it('넘치면 받은 차례를 지키며 다음 화면으로 넘긴다 — 화면마다 높이가 화면 안이다', () => {
    const rows = [
      { id: 'b-title', height: 300 },
      { id: 'b-stats', height: 300 },
      { id: '6', height: 300 },
    ];
    // 띠 64 + 300 + 간격 8 + 300 = 672 ≤ 720, 셋째 줄까지 넣으면 980이라 넘긴다
    expect(pageRows(rows)).toEqual([['b-title', 'b-stats'], ['6']]);
  });

  it('한 줄이 화면보다 높으면 그 줄 혼자 한 화면이다 — 줄을 쪼개지 않는다', () => {
    expect(
      pageRows([
        { id: 'b-title', height: 100 },
        { id: 'b-kills', height: 900 },
        { id: '6', height: 100 },
      ]),
    ).toEqual([['b-title'], ['b-kills'], ['6']]);
  });

  it('줄이 없으면 화면도 없다', () => {
    expect(pageRows([])).toEqual([]);
  });
});

// ===========================================================================
// UiFontProbeLogic — 숫자 폭 · 설정 파일 · 굵기 돌리기
// ===========================================================================

describe('UiFontProbeLogic — digitWidthsEqual (00:00 · 11:11 · 88:88 폭 비교)', () => {
  it('폭이 같으면 true', () => {
    expect(digitWidthsEqual([52, 52, 52])).toBe(true);
  });

  it('0.4px 차이는 허용 오차(0.5px) 안이라 true', () => {
    expect(digitWidthsEqual([52, 52.4, 52.2])).toBe(true);
  });

  it('0.6px 차이는 false — 숫자가 바뀔 때 타이머 폭이 흔들린다', () => {
    expect(digitWidthsEqual([52, 52.6, 52])).toBe(false);
  });

  it('빈 목록은 false — 재지 못한 것을 통과로 적지 않는다', () => {
    expect(digitWidthsEqual([])).toBe(false);
  });
});

describe('UiFontProbeLogic — parseFontProbeConfig', () => {
  it('폰트 둘이 정상이면 오류가 없고 설정을 돌려준다', () => {
    const r = parseFontProbeConfig(TWO_FONTS);
    expect(r.errors).toEqual([]);
    expect(r.config?.fonts.map((f) => f.stem)).toEqual(['FontX', 'FontY']);
    expect(r.config?.fonts[0]).toEqual({ stem: 'FontX', body: [400, 500], title: 800 });
  });

  it('폰트 하나도 정상이다 — 판정 뒤 main은 이긴 폰트 하나만 남긴다', () => {
    const r = parseFontProbeConfig({ fonts: [{ stem: 'FontX', body: [400], title: 800 }] });
    expect(r.errors).toEqual([]);
    expect(r.config?.fonts).toHaveLength(1);
  });

  it.each([
    [
      'stem 겹침',
      {
        fonts: [
          { stem: 'FontX', body: [400], title: 800 },
          { stem: 'FontX', body: [500], title: 800 },
        ],
      },
    ],
    ['stem에 공백', { fonts: [{ stem: 'Font X', body: [400], title: 800 }] }],
    ['stem에 ASCII 밖 글자', { fonts: [{ stem: 'Font가', body: [400], title: 800 }] }],
    ['body 빔', { fonts: [{ stem: 'FontX', body: [], title: 800 }] }],
    ['title 없음', { fonts: [{ stem: 'FontX', body: [400] }] }],
    [
      '폰트 셋',
      {
        fonts: [
          { stem: 'FontX', body: [400], title: 800 },
          { stem: 'FontY', body: [400], title: 800 },
          { stem: 'FontZ', body: [400], title: 800 },
        ],
      },
    ],
    ['폰트 없음', { fonts: [] }],
    [
      '두 폰트에 공통 본문 굵기 없음',
      {
        fonts: [
          { stem: 'FontX', body: [400], title: 800 },
          { stem: 'FontY', body: [500], title: 800 },
        ],
      },
    ],
  ])('%s → 오류이고 설정은 null', (_label, json) => {
    const r = parseFontProbeConfig(json);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.config).toBeNull();
  });

  it('두 폰트가 굵기 하나라도 함께 가지면 통과한다', () => {
    const r = parseFontProbeConfig({
      fonts: [
        { stem: 'FontX', body: [400, 500], title: 800 },
        { stem: 'FontY', body: [500], title: 800 },
      ],
    });
    expect(r.errors).toEqual([]);
  });
});

describe('UiFontProbeLogic — commonBodyWeights (두 열에 함께 넣을 수 있는 굵기)', () => {
  it('모든 폰트에 있는 굵기만 첫 폰트의 차례로 남긴다', () => {
    expect(
      commonBodyWeights([
        { stem: 'FontX', body: [500, 400], title: 800 },
        { stem: 'FontY', body: [400, 500, 600], title: 800 },
      ]),
    ).toEqual([500, 400]);
  });

  it('폰트가 하나면 그 목록 그대로, 없으면 빈 목록이다', () => {
    expect(commonBodyWeights([{ stem: 'FontX', body: [500], title: 800 }])).toEqual([500]);
    expect(commonBodyWeights([])).toEqual([]);
  });
});

describe('UiFontProbeLogic — nextBodyWeight (판정 화면의 본문 굵기 바꾸기)', () => {
  it('본문 굵기 목록 안에서만 돌린다', () => {
    expect(nextBodyWeight([400, 500], 400)).toBe(500);
    expect(nextBodyWeight([400, 500], 500)).toBe(400);
  });

  it('목록이 하나면 그대로다', () => {
    expect(nextBodyWeight([500], 500)).toBe(500);
  });

  it('목록이 비었으면 지금 굵기를 그대로 둔다 — undefined를 돌려주지 않는다', () => {
    expect(nextBodyWeight([], 400)).toBe(400);
  });
});

// ===========================================================================
// UiFontProbeLogic — 판정 화면이 유효한가
// ===========================================================================

describe('UiFontProbeLogic — judgeValidity', () => {
  const readyFont = (stem: string) => ({
    stem,
    ready: true,
    status: 'loaded' as const,
    timedOut: false,
  });
  const good = {
    canvasW: 1280,
    canvasH: 720,
    dpr: 1,
    fonts: [readyFont('FontX'), readyFont('FontY')],
    firstScreenOverflow: false,
  };

  it('조건 다섯을 모두 만족하면 유효다', () => {
    expect(judgeValidity(good)).toEqual({ valid: true, reasons: [] });
  });

  it('폰트가 하나여도 같은 조건으로 유효다', () => {
    expect(judgeValidity({ ...good, fonts: [readyFont('FontX')] }).valid).toBe(true);
  });

  it.each([
    ['캔버스', { canvasW: 1600 }],
    ['배율', { dpr: 1.25 }],
    [
      '준비 안 됨',
      {
        fonts: [
          readyFont('FontX'),
          { ...readyFont('FontY'), ready: false, status: 'loading' as const },
        ],
      },
    ],
    ['시간 초과', { fonts: [readyFont('FontX'), { ...readyFont('FontY'), timedOut: true }] }],
    ['1~4번 줄 넘침', { firstScreenOverflow: true }],
  ])('하나만 어긋나면 무효이고 사유는 「%s」 하나다', (reason, over) => {
    expect(judgeValidity({ ...good, ...over })).toEqual({ valid: false, reasons: [reason] });
  });

  it('거부된 폰트(status: error)는 「폰트 거부」다 — 시간 초과 표시도 함께 켜져 있어도 거부로 적는다', () => {
    // 거부된 폰트는 fontTimedOut 규칙상 timedOut도 참이다. 사유를 둘 띄우면 무엇을 고쳐야 할지
    // 흐려지므로, 원인이 더 구체적인 「폰트 거부」 하나만 적는다
    const rejected = { ...readyFont('FontY'), status: 'error' as const, timedOut: true };
    expect(judgeValidity({ ...good, fonts: [readyFont('FontX'), rejected] })).toEqual({
      valid: false,
      reasons: ['폰트 거부'],
    });
  });
});

// ===========================================================================
// UiFontProbeLogic — 폰트 상태 · 시간 초과 · 다운로드 기록
// ===========================================================================

describe('UiFontProbeLogic — fontFaceStatus (document.fonts에서 상태 찾기)', () => {
  it.each([
    'loaded',
    'loading',
    'unloaded',
    'error',
  ] as const)('이름이 맞으면 FontFace.status %s를 그대로 돌려준다', (status) => {
    expect(
      fontFaceStatus(
        [
          { family: 'FontY', status: 'loaded' },
          { family: 'FontX', status },
        ],
        'FontX',
      ),
    ).toBe(status);
  });

  it('따옴표가 붙은 이름도 따옴표를 떼고 비교한다', () => {
    expect(fontFaceStatus([{ family: '"FontX"', status: 'loaded' }], 'FontX')).toBe('loaded');
    expect(fontFaceStatus([{ family: "'FontX'", status: 'loaded' }], 'FontX')).toBe('loaded');
  });

  it('맞는 이름이 없으면 missing이다', () => {
    expect(fontFaceStatus([{ family: 'FontY', status: 'loaded' }], 'FontX')).toBe('missing');
  });
});

describe('UiFontProbeLogic — fontTimedOut (엔진은 3초 뒤에도 완료 콜백을 부른다)', () => {
  it('2,999ms에 loaded면 시간 초과가 아니다', () => {
    expect(fontTimedOut(1000, 3999, 'loaded')).toBe(false);
  });

  it('3,000ms가 걸리면 loaded여도 시간 초과다', () => {
    expect(fontTimedOut(1000, 4000, 'loaded')).toBe(true);
  });

  it.each([
    'loading',
    'unloaded',
    'error',
    'missing',
  ] as const)('빨리 끝나도 상태가 %s면 시간 초과로 본다 — 완료 콜백만으로는 폰트가 실제로 들어왔는지 모른다', (status) => {
    expect(fontTimedOut(1000, 2000, status)).toBe(true);
  });
});

describe('UiFontProbeLogic — matchFontTiming (폰트 파일의 다운로드 기록 찾기)', () => {
  it('nativeUrl로 항목을 찾는다 — MD5 해시가 붙은 빌드 경로도 같다', () => {
    const r = matchFontTiming(
      [timing(`${ORIGIN}assets/main/index.js`, 10), timing(`${ORIGIN}${URL_X}`, 600)],
      [{ nativeUrl: URL_X, loadStartMs: 500 }],
    );
    expect(r.matches[0].timing?.name).toBe(`${ORIGIN}${URL_X}`);
    expect(r.matches[0].reason).toBeNull();
    expect(r.transferTotal).toBe(410_000);
  });

  it('같은 주소의 항목이 둘이면 그 폰트를 불러오기 시작한 뒤에 시작한 늦은 항목을 고른다', () => {
    const early = timing(`${ORIGIN}${URL_X}`, 100, { transfer: 1, encoded: 1, decoded: 1 });
    const late = timing(`${ORIGIN}${URL_X}`, 900);
    const r = matchFontTiming([early, late], [{ nativeUrl: URL_X, loadStartMs: 500 }]);
    expect(r.matches[0].timing?.startTime).toBe(900);
  });

  it('하나라도 못 찾으면 그 파일은 null과 「항목 없음」이고 합계도 null이다', () => {
    const r = matchFontTiming(
      [timing(`${ORIGIN}${URL_X}`, 600)],
      [
        { nativeUrl: URL_X, loadStartMs: 500 },
        { nativeUrl: URL_Y, loadStartMs: 500 },
      ],
    );
    expect(r.matches[0].timing).not.toBeNull();
    expect(r.matches[1]).toEqual({ timing: null, reason: '항목 없음' });
    expect(r.transferTotal).toBeNull();
  });

  it('찾은 파일이 모두 있으면 합계는 transferSize의 합이다', () => {
    const r = matchFontTiming(
      [
        timing(`${ORIGIN}${URL_X}`, 600),
        timing(`${ORIGIN}${URL_Y}`, 610, { transfer: 300, encoded: 290, decoded: 290 }),
      ],
      [
        { nativeUrl: URL_X, loadStartMs: 500 },
        { nativeUrl: URL_Y, loadStartMs: 500 },
      ],
    );
    expect(r.transferTotal).toBe(410_300);
  });
});

// ===========================================================================
// UiFontProbeLogic — 열 이름 · 결과 JSON · 캡처 파일 이름
// ===========================================================================

describe('UiFontProbeLogic — columnLabels (열 이름은 자리가 아니라 폰트를 따라간다)', () => {
  it('AB 순서면 왼쪽부터 A · B다', () => {
    expect(columnLabels('AB', ['FontX', 'FontY'])).toEqual([
      { label: 'A', stem: 'FontX' },
      { label: 'B', stem: 'FontY' },
    ]);
  });

  it('Tab으로 BA가 되어도 FontX의 열은 계속 A다', () => {
    expect(columnLabels('BA', ['FontX', 'FontY'])).toEqual([
      { label: 'B', stem: 'FontY' },
      { label: 'A', stem: 'FontX' },
    ]);
  });

  it('폰트가 하나면 순서와 상관없이 A 하나다', () => {
    expect(columnLabels('BA', ['FontX'])).toEqual([{ label: 'A', stem: 'FontX' }]);
  });
});

describe('UiFontProbeLogic — buildVerdictRecord (판정을 마치고 내려받는 판정값)', () => {
  const files = matchFontTiming(
    [timing(`${ORIGIN}${URL_X}`, 600)],
    [
      { nativeUrl: URL_X, loadStartMs: 500 },
      { nativeUrl: URL_Y, loadStartMs: 500 },
    ],
  ).matches;

  const state = {
    columns: columnLabels('AB', ['FontX', 'FontY']),
    order: 'AB' as const,
    fullScreenFont: null,
    baseSize: 16,
    scaleRatio: 1.25,
    lineRatio: 1.35,
    bodyWeight: 400,
    outline: 'step1' as const,
    canvas: { w: 1280, h: 720 },
    dpr: 1,
    validity: { valid: true, reasons: [] as string[] },
    fontFiles: [
      {
        stem: 'FontX',
        weight: 400,
        status: 'loaded' as const,
        match: files[0],
        loadStartMs: 500,
        loadDoneMs: 740,
        timedOut: false,
      },
      {
        stem: 'FontY',
        weight: 400,
        status: 'loaded' as const,
        match: files[1],
        loadStartMs: 500,
        loadDoneMs: 760,
        timedOut: false,
      },
    ],
    timingBufferFull: false,
    savedAt: '2026-11-04T00:00:00.000Z',
  };

  it('고른 열은 저장 순간 왼쪽 열이고, 열 이름과 파일 이름의 짝을 함께 적는다', () => {
    const r = buildVerdictRecord(state);
    expect(r).toMatchObject({
      chosenColumn: 'A',
      chosenStem: 'FontX',
      columns: [
        { label: 'A', stem: 'FontX' },
        { label: 'B', stem: 'FontY' },
      ],
      order: 'AB',
      fullScreenFont: null,
      bodyWeight: 400,
      baseSize: 16,
      scaleRatio: 1.25,
      lineRatio: 1.35,
      outline: 'step1',
      typeScalePx: [16, 20, 25, 31],
      canvas: { w: 1280, h: 720 },
      dpr: 1,
      valid: true,
      invalidReasons: [],
      timingBufferFull: false,
      savedAt: '2026-11-04T00:00:00.000Z',
    });
  });

  it('BA 순서면 왼쪽 열 B(FontY)를 고른 것으로 적는다', () => {
    const r = buildVerdictRecord({
      ...state,
      order: 'BA',
      columns: columnLabels('BA', ['FontX', 'FontY']),
    });
    expect(r.chosenColumn).toBe('B');
    expect(r.chosenStem).toBe('FontY');
  });

  it('전체 보기 중이면 고른 열은 화면 전체를 그린 폰트의 열이다 — 왼쪽 열이 아니다', () => {
    const r = buildVerdictRecord({
      ...state,
      order: 'BA',
      columns: columnLabels('BA', ['FontX', 'FontY']),
      fullScreenFont: 'A',
    });
    expect(r.chosenColumn).toBe('A');
    expect(r.chosenStem).toBe('FontX');
    expect(r.fullScreenFont).toBe('A');
  });

  it('무효 상태여도 내려받고, valid: false와 사유 목록을 적는다', () => {
    const r = buildVerdictRecord({ ...state, validity: { valid: false, reasons: ['배율'] } });
    expect(r.valid).toBe(false);
    expect(r.invalidReasons).toEqual(['배율']);
  });

  it('찾은 파일은 다운로드 기록 칸을 모두 적고 크기 출처는 network다', () => {
    expect(buildVerdictRecord(state).fontFiles[0]).toEqual({
      stem: 'FontX',
      weight: 400,
      status: 'loaded',
      transferSize: 410_000,
      encodedBodySize: 409_700,
      decodedBodySize: 409_700,
      sizeSource: 'network',
      initiatorType: 'other',
      duration: 120,
      loadStartMs: 500,
      loadDoneMs: 740,
      timedOut: false,
      timingReason: null,
    });
  });

  it('다운로드 기록을 못 찾은 파일은 크기 칸이 null이고 사유를 적는다', () => {
    expect(buildVerdictRecord(state).fontFiles[1]).toMatchObject({
      stem: 'FontY',
      transferSize: null,
      encodedBodySize: null,
      decodedBodySize: null,
      sizeSource: null,
      timingReason: '항목 없음',
    });
  });

  it.each([
    [{ transfer: 410_000, encoded: 409_700, decoded: 409_700 }, 'network'],
    [{ transfer: 0, encoded: 409_700, decoded: 409_700 }, 'cache'],
    [{ transfer: 0, encoded: 0, decoded: 0 }, 'restricted'],
  ])('크기 출처: %o → %s — transferSize 0은 캐시와 출처 제한 둘 다라 encodedBodySize로 가른다', (sizes, source) => {
    const match = matchFontTiming(
      [timing(`${ORIGIN}${URL_X}`, 600, sizes)],
      [{ nativeUrl: URL_X, loadStartMs: 500 }],
    ).matches[0];
    const r = buildVerdictRecord({ ...state, fontFiles: [{ ...state.fontFiles[0], match }] });
    expect(r.fontFiles[0].sizeSource).toBe(source);
  });

  it('리소스 타이밍 버퍼가 찼으면 timingBufferFull: true를 적는다', () => {
    expect(buildVerdictRecord({ ...state, timingBufferFull: true }).timingBufferFull).toBe(true);
  });
});

describe('UiFontProbeLogic — buildFontAbortRecord (폰트 때문에 측정을 시작하지 못함)', () => {
  it("aborted: 'font'와 첫 표시 · 폰트 파일 · 사유를 담는다", () => {
    const match = matchFontTiming(
      [timing(`${ORIGIN}${URL_X}`, 600)],
      [{ nativeUrl: URL_X, loadStartMs: 500 }],
    ).matches[0];
    const firstShow = { loadMs: 3400, applyBusyMs: null, applyFrame: null, maxBusyAfterMs: null };
    const r = buildFontAbortRecord({
      firstShow,
      fontFiles: [
        {
          stem: 'FontX',
          weight: 400,
          status: 'loading',
          match,
          loadStartMs: 500,
          loadDoneMs: 3900,
          timedOut: true,
        },
      ],
      reason: '시간 초과',
    });
    expect(r.aborted).toBe('font');
    expect(r.firstShow).toEqual(firstShow);
    expect(r.reason).toBe('시간 초과');
    expect(r.fontFiles[0]).toMatchObject({ stem: 'FontX', timedOut: true, sizeSource: 'network' });
  });
});

describe('UiFontProbeLogic — captureFileToken (화면 캡처 파일 이름 조각)', () => {
  const STAMP = '2026-11-04T01:02:03.000Z';

  it('열 순서를 소문자로 적는다 — sanitizeFileToken이 소문자로 바꾼다', () => {
    expect(captureFileToken('AB', null, STAMP)).toMatch(/^ab/);
    expect(captureFileToken('BA', null, STAMP)).toMatch(/^ba/);
  });

  it('화면 전체를 한 폰트로 바꾼 상태를 이름에 넣는다', () => {
    const split = captureFileToken('AB', null, STAMP);
    const fullA = captureFileToken('AB', 'A', STAMP);
    const fullB = captureFileToken('AB', 'B', STAMP);
    expect(fullA).not.toBe(split);
    expect(fullA).not.toBe(fullB);
  });

  it('Windows 파일 이름에 쓸 수 없는 글자(| · :)가 없다', () => {
    for (const token of [captureFileToken('AB', null, STAMP), captureFileToken('BA', 'B', STAMP)]) {
      expect(token).not.toMatch(/[|:]/);
      expect(token).toBe(token.toLowerCase());
    }
  });
});

describe('UiFontProbeLogic — driverValue (UI 몫 측정의 문자열 바꾸기)', () => {
  const LABELS = ['hp', 'wave', 'timer', 'level'] as const;

  it.each(
    LABELS,
  )('%s: 연속 두 프레임의 값이 다르다 — 매 프레임 다시 그리게 하는 것이 목적이다', (label) => {
    for (const frame of [0, 1, 59, 99, 999, 5999]) {
      expect(driverValue(frame + 1, label)).not.toBe(driverValue(frame, label));
    }
  });

  it.each(LABELS)('%s: 같은 프레임 번호면 같은 값이다(재현 가능)', (label) => {
    expect(driverValue(1234, label)).toBe(driverValue(1234, label));
  });

  it('라벨마다 실제 HUD 형식을 따른다 — 실제 글자 조합이어야 그리기 비용이 같다', () => {
    for (const frame of [0, 7, 1234, 98765]) {
      expect(driverValue(frame, 'hp')).toMatch(/^\d+$/);
      expect(driverValue(frame, 'wave')).toMatch(/^Wave \d+$/);
      expect(driverValue(frame, 'timer')).toMatch(/^\d{2}:[0-5]\d$/);
      expect(driverValue(frame, 'level')).toMatch(/^Lv\.\d+$/);
    }
  });
});

describe('UiFontProbeLogic — timerText (UI 몫 측정의 문자열 바꾸기와 판정 화면 2번 줄의 mm:ss)', () => {
  it.each([
    [0, '00:00'],
    [61.9, '01:01'],
    [5999, '99:59'],
    [6000, '00:00'],
  ])('%s초 → %s', (sec, text) => {
    expect(timerText(sec)).toBe(text);
  });

  it('언제나 다섯 글자다 — 자릿수가 바뀌는 순간 라벨 폭이 흔들리지 않는다', () => {
    for (const sec of [0, 9, 59, 600, 5999, 6001, 123456]) expect(timerText(sec)).toHaveLength(5);
  });

  it('UI 몫 측정의 문자열 바꾸기가 쓰는 timer 값과 같은 형식이다', () => {
    expect(driverValue(125, 'timer')).toBe(timerText(125));
  });
});

describe('VfxRecipeLogic — uiResultFileName (UI 몫 결과 파일 이름)', () => {
  const at = new Date(Date.UTC(2026, 10, 3, 21, 54, 57));

  it('창 · Cache Mode · 문자열 조건 · UTC 시각이 이름에 들어간다', () => {
    expect(uiResultFileName(1920, 1080, 'none', 'worst', at)).toBe(
      'ui-1920x1080-none-worst-20261103t215457.json',
    );
    expect(uiResultFileName(1920, 1080, 'char', 'real', at)).toBe(
      'ui-1920x1080-char-real-20261103t215457.json',
    );
  });

  it('이펙트 측정 결과(gate-)와 이름이 겹치지 않는다', () => {
    expect(uiResultFileName(1920, 1080, 'none', 'worst', at)).not.toBe(
      resultFileName(1920, 1080, 'max', null, at),
    );
  });
});

describe('UiFontProbeLogic — uiBlockFlags (off=ui 블록마다 켤 것)', () => {
  it('켬 블록은 이펙트를 끄고 HUD를 켠다', () => {
    expect(uiBlockFlags('on')).toEqual({ vfxOff: true, hudActive: true });
  });

  it('끔 블록은 이펙트도 HUD도 끈다 — 이펙트는 두 블록 모두 꺼야 1ms 차이가 가려지지 않는다', () => {
    expect(uiBlockFlags('off')).toEqual({ vfxOff: true, hudActive: false });
  });
});

// ===========================================================================
// FrameStatsLogic — 상위 5% · 20ms 초과 · UI 몫
// ===========================================================================

describe('FrameStatsLogic — summarize의 p95 · over20', () => {
  const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it('p95는 가까운 순위 방식이다 — 정렬한 값의 ceil(0.95 × n)번째', () => {
    expect(summarize(range(100)).p95).toBe(95);
    expect(summarize(range(20)).p95).toBe(19);
    expect(summarize([7]).p95).toBe(7);
  });

  it('over20은 20ms를 넘은 값의 개수다 — 정확히 20은 넘은 것이 아니다', () => {
    expect(summarize([10, 20, 20.1, 35]).over20).toBe(2);
  });

  it('빈 배열이면 p95 · over20도 0이다', () => {
    expect(summarize([])).toMatchObject({ p95: 0, over20: 0 });
  });
});

describe('FrameStatsLogic — judgeUiShare · isNearUiThreshold', () => {
  it('UI 문턱은 1ms이고 이펙트 문턱과 따로 있다', () => {
    expect(UI_THRESHOLD_MS).toBe(1);
  });

  it('켬 − 끔 바쁜 시간 중앙값 차이가 1ms 이하면 통과다', () => {
    const r = judgeUiShare(1.9, 1.0);
    expect(r.delta).toBeCloseTo(0.9);
    expect(r.pass).toBe(true);
  });

  it('1.1ms면 실패다', () => {
    expect(judgeUiShare(2.1, 1.0).pass).toBe(false);
  });

  it('경계 1.0ms는 통과다', () => {
    expect(judgeUiShare(2.0, 1.0).pass).toBe(true);
  });

  it('차이가 문턱의 ±20%(0.8~1.2ms) 안이면 한 번 더 돈다', () => {
    expect(isNearUiThreshold(0.79)).toBe(false);
    expect(isNearUiThreshold(0.8)).toBe(true);
    expect(isNearUiThreshold(1.2)).toBe(true);
    expect(isNearUiThreshold(1.21)).toBe(false);
  });
});

// ===========================================================================
// MeasureScheduleLogic — 폰트 입힘 단계
// ===========================================================================

describe('MeasureScheduleLogic — off=ui의 「폰트 입힘 → 1초 → 블록」', () => {
  const opts = { counts: [200], blockSec: 10, discardSec: 1, fillTimeoutSec: 30 };

  it('적을 다 채우면 폰트 입힘 단계로 가고, 그 첫 프레임에만 폰트를 입히라고 알린다', () => {
    const s = new MeasureSchedule({ ...opts, fontApplySec: 1 });
    s.tick(0.1, { alive: 200 });
    expect(s.state.stage).toBe('font');
    expect(s.state.applyFontNow).toBe(true);
    expect(s.state.measuring).toBe(false);

    s.tick(0.5, { alive: 200 });
    expect(s.state.stage).toBe('font');
    expect(s.state.applyFontNow).toBe(false);
    expect(s.blocks).toHaveLength(0);
  });

  it('폰트를 입힌 뒤 1초가 지나면 끔 블록부터 시작한다', () => {
    const s = new MeasureSchedule({ ...opts, fontApplySec: 1 });
    s.tick(0.1, { alive: 200 });
    s.tick(0.5, { alive: 200 });
    s.tick(0.5, { alive: 200 });
    expect(s.state.stage).toBe('block');
    expect(s.state.kind).toBe('off');
    expect(s.blocks).toHaveLength(1);
  });

  it('폰트 입힘 단계를 주지 않으면(off=vfx) 지금처럼 채우기 다음이 바로 블록이다', () => {
    const s = new MeasureSchedule(opts);
    s.tick(0.1, { alive: 200 });
    expect(s.state.stage).toBe('block');
    expect(s.state.applyFontNow).toBe(false);
  });
});

// ===========================================================================
// LabRuntime — 판정 화면 분기
// ===========================================================================

describe('LabRuntime — font · measure · compare 분기', () => {
  function setMode(kind: 'font' | 'measure' | 'compare', startBlocked = false): void {
    LabRuntime.mode = {
      ...labOffMode(),
      enabled: true,
      kind,
      startBlocked,
    } as typeof LabRuntime.mode;
  }

  afterEach(() => {
    LabRuntime.mode = labOffMode();
  });

  it('font: 실험 판(적 유지 · 피해 없음)이고 게임 시계를 멈추며, 레시피 이펙트는 켜지 않는다', () => {
    setMode('font');
    expect(isFontProbeMode()).toBe(true);
    expect(isLabStage()).toBe(true);
    expect(pausesGameTimer()).toBe(true);
    expect(labVfxEnabled()).toBe(false);
  });

  it.each([
    'measure',
    'compare',
  ] as const)('%s: 레시피 이펙트를 켜고 게임 시계는 지금처럼 흐른다', (kind) => {
    setMode(kind);
    expect(isFontProbeMode()).toBe(false);
    expect(isLabStage()).toBe(true);
    expect(labVfxEnabled()).toBe(true);
    expect(pausesGameTimer()).toBe(false);
  });

  it.each([
    'font',
    'measure',
    'compare',
  ] as const)('%s라도 시작이 막혔으면 모두 거짓이다', (kind) => {
    setMode(kind, true);
    expect(isFontProbeMode()).toBe(false);
    expect(isLabStage()).toBe(false);
    expect(labVfxEnabled()).toBe(false);
    expect(pausesGameTimer()).toBe(false);
  });
});

// ===========================================================================
// VfxRecipeLogic — parseLabUrl 확장
// ===========================================================================

describe('VfxRecipeLogic — parseLabUrl: lab=font', () => {
  it('lab=font는 판정 화면 모드이고 load 기본값은 base다', () => {
    const { mode, errors } = parseLabUrl('?lab=font', RECIPES, PROBE);
    expect(errors).toEqual([]);
    expect(mode.kind).toBe('font');
    expect(mode.load).toBe('base');
    expect(mode.startBlocked).toBe(false);
  });

  it('lab=font&load=max는 허용한다', () => {
    const { mode, errors } = parseLabUrl('?lab=font&load=max', RECIPES, PROBE);
    expect(errors).toEqual([]);
    expect(mode.load).toBe('max');
  });

  it.each([
    'counts=200',
    'method=ga',
    'only=ga',
    'pick=ga:ga1',
    'tune=ga:count=96',
    'sizeScale=ga:0.7',
    'countScale=ga:0.5',
    'block=10',
    'off=ui',
    'font=FontX',
    'weight=400',
    'cache=char',
    'drive=real',
  ])('lab=font에 %s를 쓰면 오류다 — 판정 화면은 설정 파일의 폰트를 모두 보이고 적 수는 200 고정이다', (param) => {
    const { mode, errors } = parseLabUrl(`?lab=font&${param}`, RECIPES, PROBE);
    expect(errors.length).toBeGreaterThan(0);
    expect(mode.startBlocked).toBe(true);
  });

  it('설정 파일이 없으면 lab=font는 오류다', () => {
    expect(
      parseLabUrl('?lab=font', RECIPES, { config: null, errors: [] }).errors.length,
    ).toBeGreaterThan(0);
    expect(parseLabUrl('?lab=font', RECIPES).errors.length).toBeGreaterThan(0);
  });

  it('설정 파일 형식이 틀리면 lab=font는 오류이고, 그 사유가 오류 목록에 그대로 있다', () => {
    const bad = parseFontProbeConfig({
      fonts: [
        { stem: 'FontX', body: [400], title: 800 },
        { stem: 'FontX', body: [400], title: 800 },
      ],
    });
    const { errors } = parseLabUrl('?lab=font', RECIPES, bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain(bad.errors[0]);
  });

  it('레시피 내용 오류가 있어도 lab=font는 막지 않는다 — 판정 화면은 레시피 이펙트를 쓰지 않는다', () => {
    expect(parseLabUrl('?lab=font', BAD_RECIPES, PROBE).errors).toEqual([]);
    expect(parseLabUrl('?lab=measure', BAD_RECIPES, PROBE).errors.length).toBeGreaterThan(0);
  });

  it('레시피 파일이 없으면(null) lab=font도 꺼져 있다 — 공개 빌드 차단 규칙 그대로', () => {
    const { mode, errors } = parseLabUrl('?lab=font', null, PROBE);
    expect(mode.enabled).toBe(false);
    expect(errors).toEqual([]);
  });
});

describe('VfxRecipeLogic — parseLabUrl: off=ui 측정', () => {
  const UI = '?lab=measure&counts=200&off=ui&font=FontX&weight=400';

  it('측정 모드 기본값: off=vfx · cache=none · drive=worst · 폰트 없음', () => {
    const { mode, errors } = parseLabUrl('?lab=measure', RECIPES, PROBE);
    expect(errors).toEqual([]);
    expect(mode).toMatchObject({
      off: 'vfx',
      font: null,
      weight: null,
      cache: 'none',
      drive: 'worst',
    });
  });

  it('off=ui에 font · weight를 주면 그 폰트로 잰다(cache · drive는 기본값)', () => {
    const { mode, errors } = parseLabUrl(UI, RECIPES, PROBE);
    expect(errors).toEqual([]);
    expect(mode).toMatchObject({
      off: 'ui',
      font: 'FontX',
      weight: 400,
      cache: 'none',
      drive: 'worst',
    });
  });

  it('cache=char · drive=real을 읽는다', () => {
    const { mode, errors } = parseLabUrl(`${UI}&cache=char&drive=real`, RECIPES, PROBE);
    expect(errors).toEqual([]);
    expect(mode).toMatchObject({ cache: 'char', drive: 'real' });
  });

  it('weight는 제목 굵기(title)도 받는다', () => {
    const { mode, errors } = parseLabUrl(
      '?lab=measure&off=ui&font=FontX&weight=800',
      RECIPES,
      PROBE,
    );
    expect(errors).toEqual([]);
    expect(mode.weight).toBe(800);
  });

  it.each([
    ['?lab=compare&method=ga&off=ui', 'off는 measure에서만'],
    ['?lab=measure&off=zz', 'off 값이 틀림'],
    ['?lab=measure&off=ui&weight=400', 'off=ui인데 font 없음'],
    ['?lab=measure&font=FontX&weight=400', 'off=ui가 아닌데 font'],
    ['?lab=measure&off=ui&font=FontZ&weight=400', '설정 파일에 없는 stem'],
    ['?lab=measure&off=ui&font=FontX', 'font가 있는데 weight 없음'],
    ['?lab=measure&off=ui&font=FontX&weight=300', 'body · title에 없는 굵기'],
    ['?lab=measure&cache=char', 'cache는 off=ui에서만'],
    [`${UI}&cache=zz`, 'cache 값이 틀림'],
    ['?lab=measure&drive=real', 'drive는 off=ui에서만'],
    [`${UI}&drive=zz`, 'drive 값이 틀림'],
  ])('%s → 오류 상자를 띄우고 시작하지 않는다 (%s)', (q) => {
    const { mode, errors } = parseLabUrl(q, RECIPES, PROBE);
    expect(errors.length).toBeGreaterThan(0);
    expect(mode.startBlocked).toBe(true);
    for (const e of errors) {
      expect(e.problem.length).toBeGreaterThan(0);
      expect(e.cause.length).toBeGreaterThan(0);
      expect(e.fix.length).toBeGreaterThan(0);
      expect(e.ref.length).toBeGreaterThan(0);
    }
  });

  it('font를 쓴 측정 URL에서 설정 파일 형식이 틀리면 오류다', () => {
    const bad = parseFontProbeConfig({ fonts: [] });
    expect(parseLabUrl(UI, RECIPES, bad).errors.length).toBeGreaterThan(0);
  });

  it('font를 쓰지 않는 측정 URL은 설정 파일 오류를 무시한다 — 이펙트 측정과 상관이 없다', () => {
    const bad = parseFontProbeConfig({ fonts: [] });
    expect(parseLabUrl('?lab=measure', RECIPES, bad).errors).toEqual([]);
  });

  it('lab이 없으면 폰트 파라미터와 설정 파일 오류를 모두 무시한다', () => {
    const bad = parseFontProbeConfig({ fonts: [] });
    const { mode, errors } = parseLabUrl('?off=ui&font=FontZ&cache=zz', RECIPES, bad);
    expect(mode.enabled).toBe(false);
    expect(errors).toEqual([]);
  });
});
