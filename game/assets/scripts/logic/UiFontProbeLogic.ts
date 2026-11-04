import type { BlockKind } from './MeasureScheduleLogic';
import { sanitizeFileToken } from './VfxRecipeLogic';

// ===========================================================================
// 설정 파일(resources/data/font-probe.json)
// ===========================================================================

/** 판정 화면이 그릴 폰트 하나. 파일 이름은 `<stem>-<굵기>.ttf`다. */
export interface IFontProbeFont {
  /** 파일 이름의 굵기 앞부분. ASCII 영문 · 숫자만 쓴다 */
  stem: string;
  /** 본문 굵기 후보(G 키가 이 안에서만 돌린다) */
  body: number[];
  /** 제목 굵기 — 언제나 같은 가족의 굵은 굵기 하나다 */
  title: number;
}

export interface IFontProbeConfig {
  fonts: IFontProbeFont[];
}

/** 설정 파일 검사 결과. 오류가 하나라도 있으면 `config`는 null이다. */
export interface IFontProbeParse {
  config: IFontProbeConfig | null;
  /** 사람이 읽는 형식 오류 사유 — `parseLabUrl`이 오류 상자에 그대로 옮긴다 */
  errors: string[];
}

/** stem에 쓸 수 있는 글자. 엔진은 공백 있는 글꼴 이름에 따옴표를 붙이는데(font-loader.ts:224-226) 그 이름을 다시 따옴표로 감싸는 경로가 있어 CSS가 깨질 수 있다. */
const STEM_PATTERN = /^[A-Za-z0-9]+$/;

/** 판정 화면은 나란히 비교하는 화면이라 열이 둘을 넘으면 열 폭이 줄어 실제 결과 화면과 다른 줄바꿈을 보게 된다. */
const MAX_PROBE_FONTS = 2;

/**
 * 설정 파일 내용을 검사한다. 폰트는 하나(판정 뒤 main) 또는 둘(후보 빌드)이다.
 *
 * stem이 겹치면 오류다. 두 열이 같은 폰트를 그리면 판정이 무의미한데, 그 상태를 화면이 아니라 여기서
 * 막아야 `F` 키로 화면 전체를 한 폰트로 바꾼 정상 상태를 유효로 둘 수 있다.
 * @param json `font-probe.json`을 읽은 값(형식을 모르는 상태)
 */
export function parseFontProbeConfig(json: unknown): IFontProbeParse {
  const errors: string[] = [];
  const rawFonts = (json as { fonts?: unknown } | null)?.fonts;
  if (!Array.isArray(rawFonts)) {
    return { config: null, errors: ['fonts 목록이 없다'] };
  }
  if (rawFonts.length === 0 || rawFonts.length > MAX_PROBE_FONTS) {
    errors.push(`폰트는 하나 또는 둘이어야 한다(지금 ${rawFonts.length}개)`);
  }
  const fonts: IFontProbeFont[] = [];
  const seen = new Set<string>();
  for (const raw of rawFonts as { stem?: unknown; body?: unknown; title?: unknown }[]) {
    const stem = typeof raw?.stem === 'string' ? raw.stem : '';
    if (!STEM_PATTERN.test(stem)) errors.push(`stem「${stem}」은 ASCII 영문 · 숫자만 쓴다`);
    else if (seen.has(stem)) errors.push(`stem「${stem}」이 겹친다`);
    seen.add(stem);
    const body = Array.isArray(raw?.body) ? raw.body.filter(isWeight) : [];
    if (body.length === 0 || body.length !== (raw?.body as unknown[] | undefined)?.length) {
      errors.push(`${stem}의 body(본문 굵기 목록)가 비었거나 굵기가 아닌 값이 있다`);
    }
    if (!isWeight(raw?.title)) errors.push(`${stem}의 title(제목 굵기)이 없다`);
    fonts.push({ stem, body, title: raw?.title as number });
  }
  return errors.length > 0 ? { config: null, errors } : { config: { fonts }, errors: [] };
}

/** 굵기 값인가(양의 정수). */
function isWeight(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/**
 * 본문 굵기 목록 안에서 다음 굵기로 돌린다(G 키). 제목 굵기는 목록에 없으므로 돌지 않는다 — 제목은
 * 언제나 같은 가족의 800이고, 굵기 판정은 본문만 한다.
 * @param list 본문 굵기 목록
 * @param current 지금 굵기. 목록에 없으면 목록의 첫 값으로 간다
 */
export function nextBodyWeight(list: readonly number[], current: number): number {
  const i = list.indexOf(current);
  return list[(i + 1) % list.length];
}

// ===========================================================================
// 글자 단계 · 줄 높이
// ===========================================================================

/**
 * 글자 단계 크기 목록. 기준이 가장 작은 단계(0단계)이고 n단계는 `Math.round(기준 × 비율^n)` 정수
 * px다 — Cocos Label의 글자 크기는 정수로 넣어야 화면과 기록이 같은 값을 가리킨다.
 * @param base 기준 크기(px) — 최소 글자 판정으로 정한다(16 · 17 · 18)
 * @param ratio 단계 비율(1.2 · 1.25 · 1.333)
 * @param steps 단계 수 — 결과 화면은 목록 · 버튼 · 통계 · 제목 넷이다
 */
export function typeScale(base: number, ratio: number, steps: number): number[] {
  return Array.from({ length: steps }, (_, n) => Math.round(base * ratio ** n));
}

/**
 * 줄 높이 px. Cocos Label은 줄 높이를 비율이 아니라 px로 받으므로 정수로 바꾼다.
 * @param size 글자 크기(px)
 * @param ratio 줄 높이 비율(1.2 · 1.35 · 1.5)
 */
export function lineHeightPx(size: number, ratio: number): number {
  return Math.round(size * ratio);
}

// ===========================================================================
// 판정 화면 높이
// ===========================================================================

/**
 * 판정 화면의 줄 이름(계획 2026-11-01-ui-font-probe-plan.md §3.5 표). `4-en`은 4번 줄의 영어 문장이다 —
 * 같은 4번 줄이어도 영어 문장은 첫 화면이 모자랄 때 둘째 화면으로 보낼 수 있어서 따로 셈한다.
 */
export type ProbeRowId =
  | '1-가'
  | '1-나'
  | '1-다'
  | '1-라'
  | '1-마'
  | '2'
  | '3'
  | '4'
  | '4-en'
  | '5'
  | '6';

/** 배치한 뒤 잰 줄 하나의 높이. */
export interface IProbeRow {
  id: ProbeRowId;
  /** UITransform 높이(px) */
  height: number;
}

export interface IStackResult {
  /** 첫 화면에 남긴 줄을 쌓은 높이(위 · 아래 띠와 줄 사이 간격 포함) */
  height: number;
  /** 첫 화면에 남긴 줄(받은 차례 그대로) */
  first: ProbeRowId[];
  /** 둘째 화면(N 키)으로 보낸 줄(보낸 차례) */
  second: ProbeRowId[];
  /** 한국어 1~4번 줄만으로도 화면을 넘친다 — 판정 화면이 무효로 띄운다 */
  firstScreenOverflow: boolean;
}

/** 줄 사이 간격(px). */
export const PROBE_ROW_GAP_PX = 8;

/** 위 띠와 아래 띠 높이의 합(px). */
export const PROBE_BAND_PX = 64;

/**
 * 첫 화면이 넘칠 때 둘째 화면으로 보내는 차례. 6번(없는 글자) → 5번(외곽선) → 영어 줄 순이다.
 * 한국어 1~4번 줄은 결과 화면 · HUD 숫자 · 카드 · 문장이라 판정의 본체여서 보내지 않는다. 영어 줄
 * 둘은 한 묶음으로 보낸다 — 한쪽만 남기면 영어판을 반쪽만 보고 판정하게 된다.
 */
const MOVE_ORDER: readonly (readonly ProbeRowId[])[] = [['6'], ['5'], ['1-마', '4-en']];

/**
 * 판정 화면 줄을 첫 화면과 둘째 화면으로 나눈다. 줄 높이는 이 함수가 짐작하지 않는다 — 3 · 4번 줄이
 * 몇 줄로 접힐지는 폰트의 글자 폭에 달려 미리 알 수 없으므로, `FontProbe`가 배치 뒤 잰 값을 넘긴다.
 * @param rows 줄과 잰 높이(화면에 놓는 차례)
 * @param screenH 화면 높이(px)
 */
export function stackHeight(rows: readonly IProbeRow[], screenH = 720): IStackResult {
  const moved = new Set<ProbeRowId>();
  const kept = () => rows.filter((r) => !moved.has(r.id));
  const heightOf = (list: readonly IProbeRow[]) =>
    PROBE_BAND_PX +
    list.reduce((acc, r) => acc + r.height, 0) +
    PROBE_ROW_GAP_PX * Math.max(0, list.length - 1);
  for (const group of MOVE_ORDER) {
    if (heightOf(kept()) <= screenH) break;
    for (const id of group) if (rows.some((r) => r.id === id)) moved.add(id);
  }
  const height = heightOf(kept());
  return {
    height,
    first: kept().map((r) => r.id),
    // flat()은 게임 tsconfig의 대상(ES2019 이전)에 없다
    second: ([] as ProbeRowId[]).concat(...MOVE_ORDER).filter((id) => moved.has(id)),
    firstScreenOverflow: height > screenH,
  };
}

/**
 * 첫 화면 밖의 줄(결과 화면 묶음과 첫 화면에서 넘긴 줄)을 화면 단위로 나눈다. N 키가 이 화면들을 차례로
 * 돈다. 받은 차례를 지키며 화면 높이가 넘치기 직전까지 채우고, 한 줄이 화면보다 높으면 그 줄 혼자 한
 * 화면이다 — 줄을 쪼개면 그 줄의 줄바꿈 · 줄 높이를 한눈에 볼 수 없다.
 * @param rows 줄과 잰 높이(놓을 차례)
 * @param screenH 화면 높이(px)
 */
export function pageRows<T extends string>(
  rows: readonly { id: T; height: number }[],
  screenH = 720,
): T[][] {
  const pages: T[][] = [];
  let cur: T[] = [];
  let h = PROBE_BAND_PX;
  for (const r of rows) {
    const gap = cur.length > 0 ? PROBE_ROW_GAP_PX : 0;
    if (cur.length > 0 && h + gap + r.height > screenH) {
      pages.push(cur);
      cur = [];
      h = PROBE_BAND_PX;
    }
    h += (cur.length > 0 ? PROBE_ROW_GAP_PX : 0) + r.height;
    cur.push(r.id);
  }
  if (cur.length > 0) pages.push(cur);
  return pages;
}

// ===========================================================================
// 숫자 폭 · 유효 판정
// ===========================================================================

/** 숫자 폭이 같다고 보는 허용 오차(px). 캔버스 폭 측정은 소수점 아래가 흔들린다. */
const DIGIT_WIDTH_TOLERANCE_PX = 0.5;

/**
 * `00:00` · `11:11` · `88:88`처럼 잰 폭들이 허용 오차 안에서 같은가. 같지 않으면 타이머 숫자가 바뀔
 * 때마다 줄 길이가 흔들린다. 빈 목록은 false다 — 재지 못한 것을 통과로 적지 않는다.
 * @param widths 잰 폭(px)
 * @param tolPx 허용 오차(px)
 */
export function digitWidthsEqual(
  widths: readonly number[],
  tolPx = DIGIT_WIDTH_TOLERANCE_PX,
): boolean {
  if (widths.length === 0) return false;
  return Math.max(...widths) - Math.min(...widths) <= tolPx;
}

/** `FontFace.status`의 네 값과, `document.fonts`에서 이름을 찾지 못한 경우. */
export type FontStatus = 'loaded' | 'loading' | 'unloaded' | 'error' | 'missing';

/** 판정 화면 무효 사유. 위쪽 빨간 띠에 이 말 그대로 뜬다. */
export type ValidityReason =
  | '캔버스'
  | '배율'
  | '준비 안 됨'
  | '시간 초과'
  | '폰트 거부'
  | '1~4번 줄 넘침';

export interface IValidity {
  valid: boolean;
  reasons: ValidityReason[];
}

/** 최소 글자 판정의 캔버스 크기. itch 임베드와 같은 1280×720 화소에서 글자 크기가 정의된다. */
export const PROBE_CANVAS = { w: 1280, h: 720 } as const;

/**
 * 판정 화면이 유효한지와 무효 사유. 조건 다섯을 모두 만족해야 유효다 — 캔버스 1280×720, 배율 1,
 * 모든 폰트 준비, 시간 초과하거나 거부된 폰트 없음, 한국어 1~4번 줄이 첫 화면에 들어감.
 *
 * 폰트마다 사유는 하나만 적는다. 거부된 폰트는 `fontTimedOut` 규칙상 시간 초과도 참이 되는데, 둘을
 * 함께 띄우면 무엇을 고쳐야 할지 흐려지므로 더 구체적인 「폰트 거부」를 앞세운다.
 * @param s 화면 상태. `fonts`는 폰트마다 준비 여부 · 상태 · 시간 초과
 */
export function judgeValidity(s: {
  canvasW: number;
  canvasH: number;
  dpr: number;
  fonts: readonly { stem: string; ready: boolean; status: FontStatus; timedOut: boolean }[];
  firstScreenOverflow: boolean;
}): IValidity {
  const reasons: ValidityReason[] = [];
  const add = (r: ValidityReason) => {
    if (!reasons.includes(r)) reasons.push(r);
  };
  if (s.canvasW !== PROBE_CANVAS.w || s.canvasH !== PROBE_CANVAS.h) add('캔버스');
  if (s.dpr !== 1) add('배율');
  for (const f of s.fonts) {
    if (f.status === 'error') add('폰트 거부');
    else if (!f.ready) add('준비 안 됨');
    else if (f.timedOut) add('시간 초과');
  }
  if (s.firstScreenOverflow) add('1~4번 줄 넘침');
  return { valid: reasons.length === 0, reasons };
}

// ===========================================================================
// 폰트 상태 · 시간 초과
// ===========================================================================

/** 따옴표를 뗀 글꼴 이름. 브라우저는 `family`를 `"UiSans"`처럼 따옴표를 붙여 돌려줄 수 있다. */
function bareFamily(name: string): string {
  return name.trim().replace(/^["']|["']$/g, '');
}

/**
 * `document.fonts`에서 뽑은 목록에서 엔진이 등록한 이름의 상태를 찾는다.
 *
 * 비교할 이름은 파일 이름으로 다시 만들지 않고 불러온 `TTFFont`가 엔진에 등록한 이름을 받는다 —
 * 빌드에서 MD5 캐시를 켜면 파일 이름에 해시가 붙어 다시 만든 이름이 틀리기 때문이다.
 * `document.fonts.check`는 쓰지 않는다. 일치하는 글꼴이 하나도 없는 이름을 받으면 참을 돌려주므로
 * (MDN 「Nonexistent fonts」), 이름이 조금만 틀려도 시간 초과를 놓친다.
 * @param faces `document.fonts`의 항목마다 `{family, status}`
 * @param family 엔진이 등록한 글꼴 이름
 */
export function fontFaceStatus(
  faces: readonly { family: string; status: string }[],
  family: string,
): FontStatus {
  const want = bareFamily(family);
  const hit = faces.find((f) => bareFamily(f.family) === want);
  return hit ? (hit.status as FontStatus) : 'missing';
}

/** 엔진이 폰트 불러오기를 기다리는 한도(ms). 넘으면 경고 4933을 내고 완료로 처리한다. */
export const FONT_TIMEOUT_MS = 3000;

/**
 * 폰트가 시간 초과했는가. 엔진은 3초가 지나면 경고 4933을 내고도 「완료」 콜백을 부른다(엔진
 * `font-loader.ts:84-86`). 그래서 콜백만으로는 폰트가 실제로 들어왔는지 모르고, 3,000ms 이상
 * 걸렸거나 콜백 뒤 상태가 `loaded`가 아니면 시간 초과로 본다.
 *
 * 게임 코드의 시계는 `resources.load` 호출부터 재고 엔진의 시계는 자산 정보 파일을 받은 뒤 시작하므로
 * 이 판정은 엔진보다 조금 엄격하다(무효 쪽으로 틀린다).
 * @param startMs 불러오기를 시작한 시각(`performance.now()`)
 * @param doneMs 완료 콜백을 받은 시각
 * @param status 콜백 뒤 `fontFaceStatus`
 */
export function fontTimedOut(startMs: number, doneMs: number, status: FontStatus): boolean {
  return doneMs - startMs >= FONT_TIMEOUT_MS || status !== 'loaded';
}

// ===========================================================================
// 다운로드 기록
// ===========================================================================

/** `PerformanceResourceTiming`에서 결과 JSON에 쓰는 칸. */
export interface IResourceTimingLike {
  name: string;
  startTime: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  duration: number;
  initiatorType: string;
}

export interface IFontTimingMatch {
  timing: IResourceTimingLike | null;
  /** 못 찾았을 때만 「항목 없음」 */
  reason: '항목 없음' | null;
}

/** 리소스 타이밍 항목의 주소가 불러온 폰트 파일 주소와 같은가(쿼리 · 조각은 뗀다). */
function sameResource(entryName: string, nativeUrl: string): boolean {
  const target = nativeUrl.replace(/^\.?\//, '');
  const name = entryName.split(/[?#]/)[0];
  return name === target || name.endsWith(`/${target}`);
}

/**
 * 폰트 파일마다 다운로드 기록을 찾는다. 열쇠는 불러온 `TTFFont`의 `nativeUrl`이다 — 빌드 경로는
 * `native/xx/<uuid>/…`이고 MD5 캐시면 해시가 붙어, 파일 이름으로는 찾을 수 없다.
 *
 * 같은 주소의 항목이 여럿이면 그 폰트의 불러오기 시작 시각 이후에 시작한 항목 가운데 가장 늦은 것을
 * 쓴다. 앞선 요청의 항목을 이번 다운로드로 잘못 읽지 않기 위해서다.
 *
 * 합계는 하나라도 못 찾으면 null이다. 브라우저의 리소스 타이밍 버퍼(기본 250개)가 차면 폰트 항목이
 * 조용히 빠지는데, 찾은 것만 더하면 그 빠진 파일만큼 작은 값이 용량 판정을 통과해 버린다.
 * @param entries `performance.getEntriesByType('resource')`
 * @param fonts 폰트 파일마다 `nativeUrl`과 불러오기 시작 시각
 */
export function matchFontTiming(
  entries: readonly IResourceTimingLike[],
  fonts: readonly { nativeUrl: string; loadStartMs: number }[],
): { matches: IFontTimingMatch[]; transferTotal: number | null } {
  const matches = fonts.map((f): IFontTimingMatch => {
    let best: IResourceTimingLike | null = null;
    for (const e of entries) {
      if (!sameResource(e.name, f.nativeUrl) || e.startTime < f.loadStartMs) continue;
      if (best === null || e.startTime > best.startTime) best = e;
    }
    return best ? { timing: best, reason: null } : { timing: null, reason: '항목 없음' };
  });
  const transferTotal = matches.every((m) => m.timing !== null)
    ? matches.reduce((acc, m) => acc + (m.timing as IResourceTimingLike).transferSize, 0)
    : null;
  return { matches, transferTotal };
}

/**
 * 다운로드 크기를 어디서 읽었나. `transferSize` 0은 캐시와 출처 제한 둘 다에서 나오므로(MDN
 * `transferSize`) 0 하나로 캐시라고 적으면 첫 다운로드를 캐시로 잘못 기록한다 — `encodedBodySize`로
 * 가른다. 셋 모두 0이면 다른 출처에서 `Timing-Allow-Origin` 없이 받아 크기가 가려진 판이다.
 */
export type SizeSource = 'network' | 'cache' | 'restricted';

/** 다운로드 기록 하나의 크기 출처. */
function sizeSourceOf(t: IResourceTimingLike): SizeSource {
  if (t.transferSize > 0) return 'network';
  if (t.encodedBodySize > 0) return 'cache';
  return 'restricted';
}

// ===========================================================================
// 결과 JSON
// ===========================================================================

/** 폰트 파일 하나의 기록 재료 — 화면 · 측정 모드가 모아 넘긴다. */
export interface IFontFileInput {
  stem: string;
  weight: number;
  status: FontStatus;
  match: IFontTimingMatch;
  loadStartMs: number;
  loadDoneMs: number | null;
  timedOut: boolean;
}

/** 결과 JSON의 폰트 파일 칸. 다운로드 기록을 못 찾으면 크기 칸이 null이고 `timingReason`에 사유를 적는다. */
export interface IFontFileRecord {
  stem: string;
  weight: number;
  status: FontStatus;
  transferSize: number | null;
  encodedBodySize: number | null;
  decodedBodySize: number | null;
  sizeSource: SizeSource | null;
  /** 판단에 쓰지 않고 디버깅용으로만 적는다 */
  initiatorType: string | null;
  duration: number | null;
  loadStartMs: number;
  loadDoneMs: number | null;
  timedOut: boolean;
  timingReason: string | null;
}

/** 폰트 파일 기록 재료를 결과 JSON 칸으로 바꾼다. 판정값 JSON · 측정 결과 JSON · 중단 JSON이 같은 모양을 쓴다. */
export function fontFileRecord(f: IFontFileInput): IFontFileRecord {
  const t = f.match.timing;
  return {
    stem: f.stem,
    weight: f.weight,
    status: f.status,
    transferSize: t ? t.transferSize : null,
    encodedBodySize: t ? t.encodedBodySize : null,
    decodedBodySize: t ? t.decodedBodySize : null,
    sizeSource: t ? sizeSourceOf(t) : null,
    initiatorType: t ? t.initiatorType : null,
    duration: t ? t.duration : null,
    loadStartMs: f.loadStartMs,
    loadDoneMs: f.loadDoneMs,
    timedOut: f.timedOut,
    timingReason: f.match.reason,
  };
}

/** 열 이름. 자리가 아니라 폰트를 따라간다. */
export type ColumnLabel = 'A' | 'B';

export interface IProbeColumn {
  label: ColumnLabel;
  stem: string;
}

/** 열 순서. `Tab`이 맞바꾼다. */
export type ColumnOrder = 'AB' | 'BA';

/**
 * 왼쪽부터 놓을 열과 그 이름. 설정 파일의 첫 폰트가 A, 둘째가 B다. `Tab`으로 좌우를 바꿔도 같은
 * 폰트의 열은 같은 이름을 지킨다 — 이름이 자리를 따라가면 사용자가 「A가 낫다」고 한 말이 어느
 * 폰트인지 바뀐다. 폰트가 하나면 순서와 상관없이 A 하나다.
 * @param order 지금 열 순서
 * @param stems 설정 파일의 폰트 차례
 */
export function columnLabels(order: ColumnOrder, stems: readonly string[]): IProbeColumn[] {
  const cols = stems
    .slice(0, MAX_PROBE_FONTS)
    .map((stem, i): IProbeColumn => ({ label: i === 0 ? 'A' : 'B', stem }));
  return order === 'BA' && cols.length === 2 ? [cols[1], cols[0]] : cols;
}

/** 외곽선 상태(O 키). 5번 줄은 이 값과 상관없이 없음 · 1단계 · 후보 폭을 모두 보인다. */
export type OutlineMode = 'none' | 'step1';

/** 판정값 JSON을 만드는 재료. */
export interface IVerdictState {
  /** 왼쪽부터 놓인 열 */
  columns: readonly IProbeColumn[];
  order: ColumnOrder;
  /** F 상태에서 화면 전체를 그린 폰트의 열. 아니면 null */
  fullScreenFont: ColumnLabel | null;
  baseSize: number;
  scaleRatio: number;
  lineRatio: number;
  bodyWeight: number;
  outline: OutlineMode;
  canvas: { w: number; h: number };
  dpr: number;
  validity: { valid: boolean; reasons: readonly string[] };
  fontFiles: readonly IFontFileInput[];
  timingBufferFull: boolean;
  /** 저장한 시각(ISO 문자열) — 순수 함수라 시계를 직접 읽지 않는다 */
  savedAt: string;
}

/** 결과 화면 글자 단계 수 — 목록 · 버튼 · 통계 · 제목. */
const RESULT_STEPS = 4;

/**
 * `K` 키가 내려받는 판정값 JSON. 판정과 판정 화면 쪽 기록을 이 파일 하나가 모두 든다.
 *
 * 고른 열은 저장 순간 왼쪽 열이다 — 사용자는 고른 열을 `Tab`으로 왼쪽에 둔 뒤 저장한다. `F` 상태면
 * 화면 전체를 그린 폰트의 열이다. 열 이름과 파일 이름의 짝(`columns`)을 함께 적어 두면, 설정 파일을
 * 고친 뒤에도 이 기록만으로 어느 파일을 골랐는지 알 수 있다. stem은 가려진 이름이라 폰트를 드러내지
 * 않는다. 무효 상태여도 내려받는다 — 느린 4G 회차도 이 파일로 기록한다.
 * @param s 저장 순간의 화면 상태
 */
export function buildVerdictRecord(s: IVerdictState) {
  const chosenColumn = s.fullScreenFont ?? s.columns[0]?.label ?? null;
  const chosenStem = s.columns.find((c) => c.label === chosenColumn)?.stem ?? null;
  return {
    chosenColumn,
    chosenStem,
    columns: s.columns.map((c) => ({ ...c })),
    order: s.order,
    fullScreenFont: s.fullScreenFont,
    bodyWeight: s.bodyWeight,
    baseSize: s.baseSize,
    scaleRatio: s.scaleRatio,
    lineRatio: s.lineRatio,
    outline: s.outline,
    typeScalePx: typeScale(s.baseSize, s.scaleRatio, RESULT_STEPS),
    canvas: { ...s.canvas },
    dpr: s.dpr,
    valid: s.validity.valid,
    invalidReasons: [...s.validity.reasons],
    fontFiles: s.fontFiles.map(fontFileRecord),
    timingBufferFull: s.timingBufferFull,
    savedAt: s.savedAt,
  };
}

/** 측정 모드의 폰트 첫 표시 기록. 폰트를 입히기 전에 멈췄으면 뒤의 셋은 null이다. */
export interface IFirstShow {
  /** 폰트 불러오기 시작부터 완료까지(ms) */
  loadMs: number | null;
  /** 폰트를 입힌 프레임의 바쁜 시간(ms) */
  applyBusyMs: number | null;
  /** 폰트를 입힌 프레임 번호 */
  applyFrame: number | null;
  /** 그 뒤 1초의 최대 바쁜 시간(ms) */
  maxBusyAfterMs: number | null;
}

/**
 * 측정 모드에서 폰트가 시간 초과하거나 거부돼 블록을 시작하지 못했을 때 내려받는 작은 결과 JSON.
 * 느린 4G 회차가 보려는 장면이 바로 이 경로라, 여기서 기록이 남지 않으면 그 회차의 첫 표시를 얻을
 * 수 없다.
 * @param a 첫 표시 · 폰트 파일 재료 · 멈춘 사유
 */
export function buildFontAbortRecord(a: {
  firstShow: IFirstShow;
  fontFiles: readonly IFontFileInput[];
  reason: string;
}) {
  return {
    aborted: 'font' as const,
    firstShow: { ...a.firstShow },
    fontFiles: a.fontFiles.map(fontFileRecord),
    reason: a.reason,
  };
}

/**
 * 캡처 파일 이름 조각. 열 순서와 전체 바꾸기 상태 · 시각을 이어 붙이고 조각마다 `sanitizeFileToken`을
 * 거친다 — Windows 파일 이름에 쓸 수 없는 글자(`|` · `:` 등)가 들어가지 않게 하려는 것이다. 그 함수가
 * 소문자로 바꾸므로 결과는 `ab-split-…`처럼 소문자다.
 * @param order 열 순서
 * @param fullScreenFont F 상태의 열(아니면 null)
 * @param stamp 시각(ISO 문자열)
 */
export function captureFileToken(
  order: ColumnOrder,
  fullScreenFont: ColumnLabel | null,
  stamp: string,
): string {
  return [order, fullScreenFont ? `full${fullScreenFont}` : 'split', stamp]
    .map(sanitizeFileToken)
    .join('-');
}

// ===========================================================================
// 측정 모드(off=ui)
// ===========================================================================

/** 문자열 바꾸기 장치가 쓰는 HUD 라벨. */
export type HudDriveLabel = 'hp' | 'wave' | 'timer' | 'level';

/**
 * 문자열 바꾸기 장치가 그 프레임에 쓸 값. 프레임 번호에서 만들어 재현할 수 있고, 연속한 두 프레임은
 * 언제나 다른 값이라 매 프레임 라벨을 다시 그리게 된다. 라벨마다 실제 HUD 형식(`ko.json`의
 * `hud.hp` · `hud.wave` · `hud.timer` · `hud.level`)을 따른다 — 실제 글자 조합이어야 그리기 비용이
 * 실제 플레이와 같다.
 * @param frame 측정 시작부터 센 프레임 번호
 * @param label HUD 라벨
 */
export function driverValue(frame: number, label: HudDriveLabel): string {
  switch (label) {
    case 'hp':
      // 늘 세 자리로 둔다 — 자릿수가 바뀌면 그 프레임만 라벨 폭이 달라져 비용이 흔들린다
      return String(100 + (frame % 900));
    case 'wave':
      return `Wave ${1 + (frame % 99)}`;
    case 'timer': {
      const n = frame % 6000;
      const mm = String(Math.floor(n / 60)).padStart(2, '0');
      const ss = String(n % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    }
    case 'level':
      return `Lv.${1 + (frame % 99)}`;
  }
}

/**
 * `off=ui` 블록마다 켤 것. 이펙트는 두 블록 모두 끈다 — 이펙트 발사 박자와 알갱이 수의 흔들림이 1ms
 * 차이를 가리지 않게 하려는 것이다. HUD는 켬 블록에서만 켠다.
 *
 * 분기를 잘못 짜도 숫자는 그럴듯하게 나오므로 이 짝을 순수 함수로 뺀다. 결과 JSON에 블록별
 * `hudActive`와 알갱이 수를 남겨 사람도 확인할 수 있다.
 * @param kind 지금 블록
 */
export function uiBlockFlags(kind: BlockKind): { vfxOff: boolean; hudActive: boolean } {
  return { vfxOff: true, hudActive: kind === 'on' };
}
