/** 값 목록 하나의 요약 통계. 단위는 넣은 값 그대로(ms). */
export interface IStatSummary {
  mean: number;
  median: number;
  /** 가장 느린 1%(값이 큰 쪽)의 평균. 표본이 100보다 적어도 가장 큰 1개는 들어간다 */
  low1: number;
  max: number;
  count: number;
}

/** 한 종류 블록(켬 또는 끔)을 합친 통계 중 판정에 쓰는 부분. */
export interface IBlockSide {
  busy: { mean: number; low1: number };
  /** 건너뜀 비율(0~1) */
  skipRate: number;
}

/** 몫 판정 문턱. 차이(켬 − 끔)가 이 값 이하여야 통과다. */
export interface IShareThresholds {
  busyMeanMs: number;
  busyLowMs: number;
  /** 건너뜀 비율 차이(0~1, 0.01 = 1%p) */
  skipRate: number;
}

/** 켬 − 끔 차이 셋. */
export interface IShareDeltas {
  busyMeanDelta: number;
  busyLowDelta: number;
  skipDelta: number;
}

/** 몫 판정 결과. */
export interface IShareResult extends IShareDeltas {
  pass: boolean;
  /** 떨어진 지표. 순서는 busyMean → busyLow → skip */
  failed: ShareMetric[];
  /** false면 끔 블록이 이미 한 장 시간을 넘겨 건너뜀 비율을 판정에 쓰지 않았다 */
  skipValid: boolean;
}

export type ShareMetric = 'busyMean' | 'busyLow' | 'skip';

/** 귀속 순서를 매길 방식 한 줄(방식별 회차의 켬 − 끔). */
export interface IAttributionRow<M extends string = string> {
  method: M;
  busyMeanDelta: number;
  skipDelta: number;
  /** HUD 알갱이 합의 블록 최대 */
  maxParticles: number;
}

/**
 * 통과 문턱(계획 2026-10-12-magic-effect-gate-plan.md §6.4). 측정 전이라 근거 없는 제안값이고,
 * 첫 측정 뒤 GPT 2차 검증에서 조정한다. 문턱은 이 상수 한 곳에만 둔다 — HUD의 통과 미리보기와
 * 결과 판정이 다른 숫자를 쓰면 화면은 통과인데 표는 실패인 회차가 생긴다.
 */
export const PASS_THRESHOLDS: IShareThresholds = { busyMeanMs: 3, busyLowMs: 6, skipRate: 0.01 };

/** 400마리 스트레스 회차의 참고선. 통과 조건이 아니다. */
export const STRESS_THRESHOLDS: IShareThresholds = { busyMeanMs: 6, busyLowMs: 12, skipRate: 0.02 };

/**
 * 끔 블록 건너뜀 비율의 유효 상한. 이보다 크면 이펙트 없이 적 비용만으로 한 장 시간을 넘긴다는
 * 뜻이라, 켬 − 끔의 건너뜀 차이는 이펙트 비용이 아니라 이미 넘친 프레임끼리의 비교가 된다.
 */
export const OFF_SKIP_VALID_MAX = 0.05;

/** 건너뜀으로 세는 배수 — 간격이 한 장 시간의 이 배수를 넘으면 한 장을 건너뛴 것이다. */
const SKIP_FACTOR = 1.5;

/** 문턱 근처로 보는 폭. 이 안이면 같은 회차를 한 번 더 돈다. */
const NEAR_BAND = 0.2;

/**
 * 값 목록의 평균 · 중앙값 · 1% low · 최대를 낸다.
 * @param values 바쁜 시간이나 간격(ms). 빈 배열이면 모두 0
 */
export function summarize(values: readonly number[]): IStatSummary {
  const n = values.length;
  if (n === 0) return { mean: 0, median: 0, low1: 0, max: 0, count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mid = Math.floor(n / 2);
  const median = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  // 표본이 100장보다 적을 때 floor(n/100)은 0이 되어 1% low가 비어 버린다 — 최소 1장은 넣는다
  const k = Math.max(1, Math.floor(n / 100));
  let slowSum = 0;
  for (let i = n - k; i < n; i++) slowSum += sorted[i];
  return { mean: sum / n, median, low1: slowSum / k, max: sorted[n - 1], count: n };
}

/**
 * 간격이 한 장 시간의 1.5배를 넘은 프레임의 비율.
 * @param intervals 연속 프레임 간격(ms)
 * @param frameMs 한 장 시간(ms) — `frameTimeFromOffMedians`로 회차마다 한 번 정한다
 * @returns 0~1. 빈 배열이면 0
 */
export function skipRate(intervals: readonly number[], frameMs: number): number {
  if (intervals.length === 0) return 0;
  const limit = frameMs * SKIP_FACTOR;
  let skipped = 0;
  for (const v of intervals) if (v > limit) skipped++;
  return skipped / intervals.length;
}

/**
 * 회차의 한 장 시간을 끔 블록 간격 중앙값들의 최솟값으로 정한다. 400마리 끔 블록은 이미 넘쳐
 * 중앙값이 두 장 시간으로 나올 수 있는데, 그 값을 쓰면 건너뜀 기준이 두 배로 늘어 실제로 건너뛴
 * 프레임을 세지 못한다.
 * @param offMedians 회차 안 끔 블록마다의 간격 중앙값(ms)
 */
export function frameTimeFromOffMedians(offMedians: readonly number[]): number {
  return Math.min(...offMedians);
}

/**
 * 켬 · 끔 블록 통계로 몫을 판정한다(같은 통계끼리 뺀다).
 * @param on 켬 블록 셋을 합친 통계
 * @param off 끔 블록 셋을 합친 통계
 * @param th 문턱 — 판정은 `PASS_THRESHOLDS`, 400 참고선은 `STRESS_THRESHOLDS`
 */
export function judgeShare(on: IBlockSide, off: IBlockSide, th: IShareThresholds): IShareResult {
  const busyMeanDelta = on.busy.mean - off.busy.mean;
  const busyLowDelta = on.busy.low1 - off.busy.low1;
  const skipDelta = on.skipRate - off.skipRate;
  const skipValid = off.skipRate <= OFF_SKIP_VALID_MAX;
  const failed: ShareMetric[] = [];
  if (busyMeanDelta > th.busyMeanMs) failed.push('busyMean');
  if (busyLowDelta > th.busyLowMs) failed.push('busyLow');
  if (skipValid && skipDelta > th.skipRate) failed.push('skip');
  return { pass: failed.length === 0, failed, skipValid, busyMeanDelta, busyLowDelta, skipDelta };
}

/**
 * 차이 가운데 하나라도 문턱의 ±20% 안이면 true. 문턱 근처에서는 한 번의 잡음이 통과와 실패를
 * 가르므로 같은 회차를 한 번 더 돈다.
 */
export function isNearThreshold(d: IShareDeltas, th: IShareThresholds): boolean {
  const near = (v: number, t: number) => Math.abs(v - t) <= t * NEAR_BAND;
  return (
    near(d.busyMeanDelta, th.busyMeanMs) ||
    near(d.busyLowDelta, th.busyLowMs) ||
    near(d.skipDelta, th.skipRate)
  );
}

/**
 * 합친 회차가 떨어졌을 때 방식별 회차 결과로 범인 후보 순서를 매긴다(계획 §6.6). 게임은 부르지
 * 않는다 — AI가 방식별 결과 파일을 읽어 판정할 때 쓰는 기준이고, 테스트가 그 기준을 고정한다.
 * 떨어진 지표로 먼저 줄 세우고, 비기면 바쁜 시간 평균, 그래도 비기면 알갱이 합 최대로 가른다.
 * 건너뜀 비율은 모든 방식이 0%로 비기는 일이 흔해서 둘째 · 셋째 기준이 없으면 순서가 정해지지 않는다.
 * @param rows 방식별 켬 − 끔
 * @param failedMetric 합친 회차에서 떨어진 쪽 — 바쁜 시간이면 'busy', 간격만이면 'skip'
 * @returns 방식 키, 큰 것부터
 */
export function attributionOrder<M extends string>(
  rows: readonly IAttributionRow<M>[],
  failedMetric: 'busy' | 'skip',
): M[] {
  const primary = (r: IAttributionRow<M>) =>
    failedMetric === 'busy' ? r.busyMeanDelta : r.skipDelta;
  return [...rows]
    .sort(
      (a, b) =>
        primary(b) - primary(a) ||
        b.busyMeanDelta - a.busyMeanDelta ||
        b.maxParticles - a.maxParticles,
    )
    .map((r) => r.method);
}
