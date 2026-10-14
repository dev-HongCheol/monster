import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NodeFactoryPool } from '../../game/assets/scripts/components/NodeFactoryPool';
import type { ISpellData } from '../../game/assets/scripts/data/GameTypes';
import {
  attributionOrder,
  frameTimeFromOffMedians,
  isNearThreshold,
  judgeShare,
  PASS_THRESHOLDS,
  skipRate,
  summarize,
} from '../../game/assets/scripts/logic/FrameStatsLogic';
import { MeasureSchedule } from '../../game/assets/scripts/logic/MeasureScheduleLogic';
import {
  applyOverrides,
  buildCompareUrl,
  buildMeasureUrl,
  burstOverlapStep,
  burstSpeedForRadius,
  chainPoints,
  compareColumns,
  compareGrid,
  compareSpellIds,
  compareThirdStep,
  concurrentStatusCount,
  discardSeconds,
  emitterSettings,
  estimateParticles,
  FIXED_RING_LINES_PX,
  FIXED_RING_PX,
  formatTune,
  hasLabParam,
  type IVfxRecipe,
  labOffMode,
  MEASURE_SPAWN_CLEAR_RADIUS,
  maxLoadSeed,
  measureSpawnPoint,
  nextClassColor,
  parseLabUrl,
  parseTune,
  pickedRecipeMap,
  pickFixedRingLine,
  resultFileName,
  ringPose,
  sanitizeFileToken,
  stepTune,
  textHash,
  tuneKeyAction,
  validateRecipe,
} from '../../game/assets/scripts/logic/VfxRecipeLogic';

/**
 * 마법 이펙트 게이트(계획 sessions/2026-10-12-magic-effect-gate-plan.md)의 순수 로직 셋.
 * - FrameStatsLogic: 블록 통계 · 몫 판정 · 귀속 순서(계획 §6)
 * - MeasureScheduleLogic: 적 수 스윕 · 블록 운전 · 버릴 구간 · 무효 블록(계획 §6.3)
 * - VfxRecipeLogic: 레시피 검증 · URL 해석(LabMode) · tune 왕복 · 부하 계산(계획 §5 · §7)
 */

// ---------------------------------------------------------------------------
// 테스트용 레시피 — 방식마다 필수 필드를 채운 최소 후보
// ---------------------------------------------------------------------------

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

const RECIPES: IVfxRecipe[] = [
  recipe({ id: 'ga1', method: 'ga', picked: true }),
  recipe({ id: 'ga2', method: 'ga', count: 96, life: 0.8 }),
  recipe({ id: 'na1', method: 'na', picked: true, worldSpace: true, rate: 30, speed: 40 }),
  recipe({
    id: 'da1',
    method: 'da',
    shape: 'ring',
    picked: true,
    fixedThickness: true,
    endSize: 2,
    fade: true,
  }),
  recipe({
    id: 'ra1',
    method: 'ra',
    shape: 'shard',
    blend: 'alpha',
    picked: true,
    tailLength: 20,
    tailRate: 30,
  }),
  recipe({ id: 'ma1', method: 'ma', shape: 'bolt', picked: true, segments: 6 }),
  recipe({ id: 'ba1', method: 'ba', picked: true, statusKind: 'loop', speed: 10 }),
];

// ===========================================================================
// FrameStatsLogic
// ===========================================================================

describe('FrameStatsLogic — summarize', () => {
  it('평균 · 중앙값 · 최대 · 개수를 낸다', () => {
    const s = summarize([1, 2, 3, 4, 10]);
    expect(s.mean).toBeCloseTo(4);
    expect(s.median).toBe(3);
    expect(s.max).toBe(10);
    expect(s.count).toBe(5);
  });

  it('1% low는 가장 느린 1%(값이 큰 쪽)의 평균이다 — 1,800장이면 18장', () => {
    const values = Array.from({ length: 1800 }, (_, i) => (i < 18 ? 30 : 10));
    expect(summarize(values).low1).toBeCloseTo(30);
  });

  it('표본이 100장보다 적어도 가장 느린 1장은 1% low에 들어간다', () => {
    expect(summarize([5, 6, 40]).low1).toBe(40);
  });

  it('빈 배열이면 모두 0', () => {
    expect(summarize([])).toEqual({ mean: 0, median: 0, low1: 0, max: 0, count: 0 });
  });
});

describe('FrameStatsLogic — skipRate · 한 장 시간', () => {
  it('간격이 한 장 시간의 1.5배를 넘은 프레임의 비율이다', () => {
    const frame = 1000 / 60;
    const intervals = [frame, frame, frame, frame * 2]; // 하나만 건너뜀
    expect(skipRate(intervals, frame)).toBeCloseTo(0.25);
  });

  it('정확히 1.5배는 건너뜀이 아니다', () => {
    expect(skipRate([15], 10)).toBe(0);
  });

  it('한 장 시간은 끔 블록 간격 중앙값들의 최솟값이다 — 400마리 끔 블록이 두 장 시간이어도 끌려가지 않는다', () => {
    expect(frameTimeFromOffMedians([16.7, 16.8, 33.3])).toBeCloseTo(16.7);
  });
});

describe('FrameStatsLogic — judgeShare (계획 §6.4 · §6.5)', () => {
  const off = { busy: { mean: 5, low1: 9 }, skipRate: 0.01 };

  it('문턱은 바쁜 시간 평균 3ms · 1% low 6ms · 건너뜀 1%p다', () => {
    expect(PASS_THRESHOLDS).toEqual({ busyMeanMs: 3, busyLowMs: 6, skipRate: 0.01 });
  });

  it('세 기준을 다 만족하면 통과', () => {
    const r = judgeShare(
      { busy: { mean: 7.9, low1: 14.9 }, skipRate: 0.019 },
      off,
      PASS_THRESHOLDS,
    );
    expect(r.pass).toBe(true);
    expect(r.failed).toEqual([]);
  });

  it('바쁜 시간 평균 차이가 3ms를 넘으면 떨어지고 그 지표를 적는다', () => {
    const r = judgeShare({ busy: { mean: 8.5, low1: 10 }, skipRate: 0.01 }, off, PASS_THRESHOLDS);
    expect(r.pass).toBe(false);
    expect(r.failed).toEqual(['busyMean']);
    expect(r.busyMeanDelta).toBeCloseTo(3.5);
  });

  it('건너뜀 차이만 넘으면 skip만 실패로 적는다', () => {
    const r = judgeShare({ busy: { mean: 5, low1: 9 }, skipRate: 0.03 }, off, PASS_THRESHOLDS);
    expect(r.failed).toEqual(['skip']);
  });

  it('끔 블록 건너뜀이 5%를 넘으면 건너뜀은 판정 불능이고 바쁜 시간으로만 판정한다', () => {
    const heavyOff = { busy: { mean: 5, low1: 9 }, skipRate: 0.08 };
    const r = judgeShare({ busy: { mean: 6, low1: 10 }, skipRate: 0.3 }, heavyOff, PASS_THRESHOLDS);
    expect(r.skipValid).toBe(false);
    expect(r.pass).toBe(true);
    expect(r.failed).toEqual([]);
  });

  it('끔 블록 건너뜀이 정확히 5%면 아직 유효하다', () => {
    const r = judgeShare(
      { busy: { mean: 5, low1: 9 }, skipRate: 0.05 },
      { ...off, skipRate: 0.05 },
      PASS_THRESHOLDS,
    );
    expect(r.skipValid).toBe(true);
  });
});

describe('FrameStatsLogic — isNearThreshold (±20%면 한 번 더)', () => {
  it('차이가 어느 문턱의 ±20% 안이면 true', () => {
    expect(
      isNearThreshold({ busyMeanDelta: 2.5, busyLowDelta: 1, skipDelta: 0 }, PASS_THRESHOLDS),
    ).toBe(true);
    expect(
      isNearThreshold({ busyMeanDelta: 3.5, busyLowDelta: 1, skipDelta: 0 }, PASS_THRESHOLDS),
    ).toBe(true);
  });

  it('모든 차이가 문턱에서 20% 넘게 떨어져 있으면 false', () => {
    expect(
      isNearThreshold({ busyMeanDelta: 1, busyLowDelta: 2, skipDelta: 0 }, PASS_THRESHOLDS),
    ).toBe(false);
  });
});

describe('FrameStatsLogic — attributionOrder (계획 §6.6)', () => {
  const rows = [
    { method: 'ga' as const, busyMeanDelta: 1.0, skipDelta: 0.002, maxParticles: 900 },
    { method: 'ba' as const, busyMeanDelta: 2.0, skipDelta: 0.001, maxParticles: 3000 },
    { method: 'na' as const, busyMeanDelta: 0.5, skipDelta: 0.004, maxParticles: 400 },
  ];

  it('바쁜 시간이 떨어졌으면 바쁜 시간 평균 차이가 큰 순서다', () => {
    expect(attributionOrder(rows, 'busy')).toEqual(['ba', 'ga', 'na']);
  });

  it('간격만 떨어졌으면 건너뜀 차이가 큰 순서다', () => {
    expect(attributionOrder(rows, 'skip')).toEqual(['na', 'ga', 'ba']);
  });

  it('건너뜀이 모두 비기면 바쁜 시간 평균으로, 그래도 비기면 알갱이 합 최대로 가른다', () => {
    const tied = [
      { method: 'ga' as const, busyMeanDelta: 1, skipDelta: 0, maxParticles: 100 },
      { method: 'na' as const, busyMeanDelta: 1, skipDelta: 0, maxParticles: 500 },
      { method: 'da' as const, busyMeanDelta: 2, skipDelta: 0, maxParticles: 10 },
    ];
    expect(attributionOrder(tied, 'skip')).toEqual(['da', 'na', 'ga']);
  });
});

// ===========================================================================
// MeasureScheduleLogic
// ===========================================================================

/**
 * 실제 프레임처럼 1/8초씩 나눠 진행한다. 한 번에 1초를 넘기면 그 자체가 「긴 프레임」이라
 * 블록이 무효가 되므로, 긴 시간을 한 번의 tick으로 넘기면 무효 판정을 시험하는 꼴이 된다.
 * 1/8은 2진수로 정확해 80번 더하면 정확히 10초다(블록 경계가 어긋나지 않는다).
 */
function advance(s: MeasureSchedule, sec: number, alive: number): void {
  for (let t = 0; t < sec; t += 0.125) s.tick(0.125, { alive });
}

describe('MeasureScheduleLogic — 적 수 스윕과 블록 순서', () => {
  it('적 수마다 채우기 → 끔 · 켬 · 끔 · 켬 · 끔 · 켬 블록을 돌고 끝난다', () => {
    const s = new MeasureSchedule({
      counts: [63, 200],
      blockSec: 10,
      discardSec: 1,
      fillTimeoutSec: 30,
    });
    expect(s.state.stage).toBe('fill');
    expect(s.state.count).toBe(63);

    s.tick(0.1, { alive: 63 }); // 목표 수에 닿으면 첫 블록으로
    const kinds: string[] = [];
    for (let i = 0; i < 6; i++) {
      expect(s.state.stage).toBe('block');
      kinds.push(s.state.kind as string);
      advance(s, 10, 63);
    }
    expect(kinds).toEqual(['off', 'on', 'off', 'on', 'off', 'on']);
    expect(s.state.stage).toBe('fill');
    expect(s.state.count).toBe(200);

    s.tick(0.1, { alive: 200 });
    for (let i = 0; i < 6; i++) advance(s, 10, 200);
    expect(s.state.stage).toBe('done');
    expect(s.blocks).toHaveLength(12);
  });

  it('채우는 동안은 재지 않고, 30초 안에 못 채우면 실측 수를 적고 진행한다', () => {
    const s = new MeasureSchedule({
      counts: [400],
      blockSec: 10,
      discardSec: 1,
      fillTimeoutSec: 30,
    });
    s.tick(20, { alive: 300 });
    expect(s.state.stage).toBe('fill');
    expect(s.state.measuring).toBe(false);
    s.tick(10.5, { alive: 350 });
    expect(s.state.stage).toBe('block');
    expect(s.state.filledCount).toBe(350);
  });

  it('블록이 바뀐 뒤 discardSec 동안은 버릴 구간이다', () => {
    const s = new MeasureSchedule({
      counts: [200],
      blockSec: 10,
      discardSec: 1.5,
      fillTimeoutSec: 30,
    });
    s.tick(0.1, { alive: 200 });
    s.tick(1.0, { alive: 200 });
    expect(s.state.discard).toBe(true);
    expect(s.state.measuring).toBe(false);
    s.tick(0.6, { alive: 200 });
    expect(s.state.discard).toBe(false);
    expect(s.state.measuring).toBe(true);
  });
});

describe('MeasureScheduleLogic — 무효 블록 (계획 §6.3)', () => {
  function started(): MeasureSchedule {
    const s = new MeasureSchedule({
      counts: [200],
      blockSec: 10,
      discardSec: 1,
      fillTimeoutSec: 30,
    });
    s.tick(0.1, { alive: 200 });
    return s;
  }

  it.each(['hidden', 'blur', 'resize'] as const)('%s 사건이 나면 그 블록이 무효다', (reason) => {
    const s = started();
    advance(s, 2, 200);
    s.markEvent(reason);
    expect(s.blocks[0].invalidReasons).toEqual([reason]);
    expect(s.invalidCount).toBe(1);
  });

  it('1초를 넘는 간격(dt)은 그 블록을 무효로 만든다', () => {
    const s = started();
    s.tick(1.2, { alive: 200 });
    expect(s.blocks[0].invalidReasons).toEqual(['longFrame']);
  });

  it('다음 블록은 다시 유효하게 시작한다', () => {
    const s = started();
    s.markEvent('blur');
    advance(s, 10, 200);
    expect(s.blocks[1].invalidReasons).toEqual([]);
  });
});

describe('MeasureScheduleLogic — 개발용 짧은 블록', () => {
  it('blockSec가 10이 아니면 판정 무효 표시가 켜진다', () => {
    expect(
      new MeasureSchedule({ counts: [200], blockSec: 2, discardSec: 1, fillTimeoutSec: 30 })
        .devShortBlock,
    ).toBe(true);
    expect(
      new MeasureSchedule({ counts: [200], blockSec: 10, discardSec: 1, fillTimeoutSec: 30 })
        .devShortBlock,
    ).toBe(false);
  });
});

// ===========================================================================
// VfxRecipeLogic — 레시피
// ===========================================================================

describe('VfxRecipeLogic — validateRecipe', () => {
  it('방식별 필수 필드가 다 있으면 오류가 없다', () => {
    for (const r of RECIPES) expect(validateRecipe(r)).toEqual([]);
  });

  it('필드가 빠지면 「무엇이 · 왜 · 어떻게 고치나」 세 조각을 가진 오류를 낸다', () => {
    const bad = recipe({ id: 'na9', method: 'na' }); // rate · worldSpace · speed 없음
    const errors = validateRecipe(bad);
    expect(errors.length).toBeGreaterThan(0);
    for (const e of errors) {
      expect(e.problem).toMatch(/na9/);
      expect(e.cause.length).toBeGreaterThan(0);
      expect(e.fix.length).toBeGreaterThan(0);
    }
  });
});

describe('VfxRecipeLogic — 수 계산', () => {
  it('살아 있는 알갱이 추정은 min(totalParticles, emissionRate × life)', () => {
    expect(estimateParticles(100, 30, 2)).toBe(60);
    expect(estimateParticles(40, 30, 2)).toBe(40);
  });

  it('터짐 반경 → 속도: 속도 × 수명 = 반경이 되게 한다', () => {
    expect(burstSpeedForRadius(70, 0.5)).toBeCloseTo(140);
  });

  it('버릴 시간은 max(1초, 레시피 최대 수명)', () => {
    expect(discardSeconds(RECIPES)).toBe(1);
    expect(
      discardSeconds([...RECIPES, recipe({ id: 'ga3', method: 'ga', life: 1.6 })]),
    ).toBeCloseTo(1.6);
  });

  it('터짐 겹침 셋째 단계는 9 × ⌈수명 ÷ 쿨다운⌉이고 최소 10 · 최대 50이다', () => {
    expect(burstOverlapStep(0.4, 0.5, 9)).toBe(10);
    expect(burstOverlapStep(0.8, 0.5, 9)).toBe(18);
    expect(burstOverlapStep(5, 0.5, 9)).toBe(50);
  });

  it('동시 상태 표시 수 = 초당 명중 × 확률 × 지속', () => {
    expect(concurrentStatusCount(9 / 0.7, 0.9, 2)).toBeCloseTo(23.14, 1);
  });
});

describe('VfxRecipeLogic — maxLoadSeed (계획 §7.1)', () => {
  const spells = [
    { id: 'fireball', category: 'fire', allowsProjectileCount: undefined },
    { id: 'frost_nova', category: 'ice', allowsProjectileCount: false },
  ] as unknown as ISpellData[];

  it('발사체 수를 허용하는 마법만 개별 4 + 분류 4로 채운다', () => {
    const seed = maxLoadSeed(spells);
    expect(seed.individual?.fireball?.projectile_count).toBe(4);
    expect(seed.category?.fire?.projectile_count).toBe(4);
    expect(seed.individual?.frost_nova).toBeUndefined();
  });
});

describe('VfxRecipeLogic — tune 왕복 · 덮어쓰기 순서', () => {
  it('방식 사이는 |, 필드 사이는 ; 로 읽는다', () => {
    expect(parseTune('ga:count=96;size=1.2|na:rate=40')).toEqual({
      ga: { count: 96, size: 1.2 },
      na: { rate: 40 },
    });
  });

  it('비교판이 낸 문자열을 다시 읽으면 같은 값이다', () => {
    const tune = { ga: { count: 96, size: 1.2, life: 0.8 }, ba: { speed: 11 } };
    expect(parseTune(formatTune(tune))).toEqual(tune);
  });

  it('레시피 → tune(절대값) → sizeScale · countScale(곱) 순서로 적용한다', () => {
    const r = applyOverrides(RECIPES[0], { count: 60, size: 2 }, 0.5, 0.5);
    expect(r.count).toBe(30);
    expect(r.size).toBe(1);
    expect(RECIPES[0].count).toBe(48); // 원본은 바꾸지 않는다
  });
});

// ===========================================================================
// VfxRecipeLogic — URL 해석 (LabMode)
// ===========================================================================

describe('VfxRecipeLogic — parseLabUrl 안전 전제', () => {
  it('빈 쿼리면 실험실이 꺼져 있고 오류도 없다', () => {
    const { mode, errors } = parseLabUrl('', RECIPES);
    expect(mode.enabled).toBe(false);
    expect(errors).toEqual([]);
  });

  it('꺼진 실험실 상태(labOffMode)는 URL을 해석하지 않고 바로 만든다 — 빈 쿼리 해석 결과와 같다', () => {
    expect(labOffMode()).toEqual(parseLabUrl('', null).mode);
    expect(labOffMode().enabled).toBe(false);
  });

  it('lab 없이 다른 파라미터만 있으면 무시한다', () => {
    const { mode, errors } = parseLabUrl('?method=ga&counts=400', RECIPES);
    expect(mode.enabled).toBe(false);
    expect(errors).toEqual([]);
  });

  it('레시피 파일이 없으면(null) lab이 있어도 꺼져 있다 — 공개 빌드 차단', () => {
    const { mode, errors } = parseLabUrl('?lab=measure', null);
    expect(mode.enabled).toBe(false);
    expect(errors).toEqual([]);
  });
});

describe('VfxRecipeLogic — parseLabUrl 값', () => {
  it('측정 모드 기본값: load=max · counts=63,200,400 · block=10 · 고름 후보', () => {
    const { mode, errors } = parseLabUrl('?lab=measure', RECIPES);
    expect(errors).toEqual([]);
    expect(mode.enabled).toBe(true);
    expect(mode.kind).toBe('measure');
    expect(mode.load).toBe('max');
    expect(mode.counts).toEqual([63, 200, 400]);
    expect(mode.blockSec).toBe(10);
    expect(mode.picks.ga).toBe('ga1');
    expect(mode.only).toBeNull();
  });

  it('비교판은 method 하나를 보여 준다', () => {
    const { mode } = parseLabUrl('?lab=compare&method=da', RECIPES);
    expect(mode.kind).toBe('compare');
    expect(mode.method).toBe('da');
  });

  it('counts는 커지는 순서여야 한다 — 스포너는 적을 지우지 않아 줄어드는 단계는 앞 단계의 적 위에서 잰다', () => {
    expect(parseLabUrl('?lab=measure&counts=63,200', RECIPES).errors).toEqual([]);
    const { mode, errors } = parseLabUrl('?lab=measure&counts=400,200', RECIPES);
    expect(errors).toHaveLength(1);
    expect(mode.startBlocked).toBe(true);
    expect(parseLabUrl('?lab=measure&counts=200,200', RECIPES).errors).toHaveLength(1);
  });

  it('비교판 가운데서 쏘는 마법은 그 방식을 쓰는 v1 대표 마법이다(마는 게임 코드가 없어 비어 있다)', () => {
    expect(compareSpellIds('ga')).toEqual(['fireball']);
    expect(compareSpellIds('na')).toEqual(['inferno']);
    expect(compareSpellIds('da')).toEqual(['frost_nova']);
    expect(compareSpellIds('ra')).toEqual(['ice_missile']);
    expect(compareSpellIds('ba')).toEqual(['ice_missile', 'lightning_bolt']);
    expect(compareSpellIds('ma')).toEqual([]);
  });

  it('pick · only · counts · tune · sizeScale · countScale · block을 읽는다', () => {
    const q =
      '?lab=measure&pick=ga:ga2&only=ga,na&counts=200&tune=ga:count=60&sizeScale=ga:0.7&countScale=ga:0.5&block=2';
    const { mode, errors } = parseLabUrl(q, RECIPES);
    expect(errors).toEqual([]);
    expect(mode.picks.ga).toBe('ga2');
    expect(mode.only).toEqual(['ga', 'na']);
    expect(mode.counts).toEqual([200]);
    expect(mode.tune).toEqual({ ga: { count: 60 } });
    expect(mode.sizeScale).toEqual({ ga: 0.7 });
    expect(mode.countScale).toEqual({ ga: 0.5 });
    expect(mode.blockSec).toBe(2);
  });
});

describe('VfxRecipeLogic — parseLabUrl 오류 상자', () => {
  it.each([
    ['?lab=compar', 'lab 값이 틀림'],
    ['?lab=compare&method=zz', '없는 방식'],
    ['?lab=measure&pick=ga:nope', '레시피에 없는 후보'],
    ['?lab=measure&tune=ga:count', '깨진 tune'],
    ['?lab=measure&sizeScale=0.7', '방식 키 없는 배율'],
  ])('%s → 오류를 돌려주고 실험실을 시작하지 않는다 (%s)', (q) => {
    const { mode, errors } = parseLabUrl(q, RECIPES);
    expect(errors.length).toBeGreaterThan(0);
    expect(mode.startBlocked).toBe(true);
    for (const e of errors) {
      expect(e.problem.length).toBeGreaterThan(0);
      expect(e.cause.length).toBeGreaterThan(0);
      expect(e.fix.length).toBeGreaterThan(0);
      expect(e.ref.length).toBeGreaterThan(0);
    }
  });

  it('레시피 검증 오류도 같은 오류 목록으로 온다', () => {
    const bad = [...RECIPES, recipe({ id: 'na9', method: 'na' })];
    const { errors } = parseLabUrl('?lab=compare&method=na', bad);
    expect(errors.some((e) => e.problem.includes('na9'))).toBe(true);
  });
});

describe('VfxRecipeLogic — 측정 URL · 결과 파일', () => {
  it('비교판이 고른 pick · tune으로 완성된 측정 URL을 만들고, 그 URL을 다시 읽으면 같은 값이다', () => {
    const url = buildMeasureUrl(
      'http://localhost:8080/',
      { ga: 'ga2' },
      { ga: { count: 60, size: 1.1 } },
    );
    expect(url.startsWith('http://localhost:8080/?lab=measure')).toBe(true);
    const { mode, errors } = parseLabUrl(url.slice(url.indexOf('?')), RECIPES);
    expect(errors).toEqual([]);
    expect(mode.picks.ga).toBe('ga2');
    expect(mode.tune).toEqual({ ga: { count: 60, size: 1.1 } });
  });

  it('결과 파일 이름은 gate-<창>-<load>-<only 또는 all>-<UTC 시각>.json', () => {
    const at = new Date(Date.UTC(2026, 9, 13, 9, 30, 5));
    expect(resultFileName(1920, 1080, 'max', null, at)).toBe(
      'gate-1920x1080-max-all-20261013t093005.json',
    );
    expect(resultFileName(960, 540, 'base', ['ga', 'na'], at)).toBe(
      'gate-960x540-base-ga,na-20261013t093005.json',
    );
  });

  it('파일 이름에 넣는 값은 [a-z0-9,]만 남긴다', () => {
    expect(sanitizeFileToken('../<script>Ga,na')).toBe('scriptga,na');
  });
});

describe('VfxRecipeLogic — 비교판', () => {
  it('셋째 단계: 가는 수명으로 9 × ⌈수명 ÷ 0.5초⌉(10~50), 바는 27, 나머지는 10', () => {
    expect(compareThirdStep('ga', 0.4)).toBe(10);
    expect(compareThirdStep('ga', 0.8)).toBe(18);
    expect(compareThirdStep('ba', 0.6)).toBe(27);
    for (const m of ['na', 'da', 'ra', 'ma'] as const) expect(compareThirdStep(m, 0.3)).toBe(10);
  });

  it('열: 다는 강화 단계(반경 1 · 1.5 · 2배), 마는 거쳐 가는 적 수(3 · 5 · 8), 나머지는 겹침 1× · 4× · 셋째 단계다', () => {
    expect(compareColumns('da', 0.5, 120)).toEqual([
      { copies: 1, radiusScale: 1, targets: 0, label: '반경 120' },
      { copies: 1, radiusScale: 1.5, targets: 0, label: '반경 180' },
      { copies: 1, radiusScale: 2, targets: 0, label: '반경 240' },
    ]);
    expect(compareColumns('ma', 0.25, 120)).toEqual([
      { copies: 1, radiusScale: 1, targets: 3, label: '적 3' },
      { copies: 1, radiusScale: 1, targets: 5, label: '적 5' },
      { copies: 1, radiusScale: 1, targets: 8, label: '적 8' },
    ]);
    expect(compareColumns('ga', 0.8, 60)).toEqual([
      { copies: 1, radiusScale: 1, targets: 0, label: '1×' },
      { copies: 4, radiusScale: 1, targets: 0, label: '4×' },
      { copies: 18, radiusScale: 1, targets: 0, label: '18×' },
    ]);
  });

  it('체인 자리: 시전 자리(왼쪽 끝)와 적 n마리가 오른쪽으로 나아가며 위아래로 번갈아 놓인다', () => {
    const pts = chainPoints(4, 100);
    expect(pts).toHaveLength(5);
    expect(pts[0]).toEqual({ x: -100, y: 0 });
    expect(pts[4].x).toBeCloseTo(100);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].x).toBeGreaterThan(pts[i - 1].x);
      expect(Math.abs(pts[i].y)).toBeLessThanOrEqual(100);
    }
    // 이웃한 적은 위아래 반대편에 있어 선이 꺾여 보인다
    expect(Math.sign(pts[1].y)).toBe(-Math.sign(pts[2].y));
  });

  it('strands(가닥 수)는 양의 정수여야 한다', () => {
    const base = recipe({ id: 'ma3', method: 'ma', shape: 'bolt', segments: 8 });
    expect(validateRecipe({ ...base, strands: 4 })).toEqual([]);
    expect(validateRecipe({ ...base, strands: 0 })).toHaveLength(1);
    expect(validateRecipe({ ...base, strands: 1.5 })).toHaveLength(1);
  });

  it('고리 모습: 크기는 0.15배에서 끝 크기로, 감속이면 앞쪽이 빠르고, fadeFrom 앞까지 불투명, spin만큼 돈다', () => {
    const lin = recipe({ id: 'd', method: 'da', endSize: 1, fade: true });
    expect(ringPose(0, lin)).toEqual({ scale: 0.15, alpha: 1, angle: 0 });
    expect(ringPose(1, lin).scale).toBeCloseTo(1);
    expect(ringPose(0.5, lin).alpha).toBeCloseTo(0.5);
    const frost = recipe({
      id: 'f',
      method: 'da',
      endSize: 1,
      fade: true,
      easeOut: true,
      fadeFrom: 0.6,
      spin: 20,
    });
    expect(ringPose(0.5, frost).scale).toBeGreaterThan(ringPose(0.5, lin).scale);
    expect(ringPose(1, frost).scale).toBeCloseTo(1);
    expect(ringPose(0.6, frost).alpha).toBe(1);
    expect(ringPose(0.8, frost).alpha).toBeCloseTo(0.5);
    expect(ringPose(1, frost).alpha).toBeCloseTo(0);
    expect(ringPose(0.5, frost).angle).toBeCloseTo(10);
    // 투명해지지 않는 후보는 끝까지 불투명
    expect(ringPose(0.9, { ...lin, fade: false }).alpha).toBe(1);
  });

  it('서리 띠 그림(frost)은 다 후보의 그림으로 통과하고, fadeFrom은 0 이상 1 미만이어야 한다', () => {
    const base = recipe({
      id: 'da3',
      method: 'da',
      shape: 'frost',
      blend: 'alpha',
      fixedThickness: false,
      endSize: 1,
      fade: true,
    });
    expect(validateRecipe(base)).toEqual([]);
    expect(validateRecipe({ ...base, fadeFrom: 0.6 })).toEqual([]);
    expect(validateRecipe({ ...base, fadeFrom: 1 })).toHaveLength(1);
  });

  it('숫자 키 1~8은 알갱이 수 · 크기 · 수명 · 속도를 10%씩 바꾸고, 0은 되돌림, 나머지 키는 null', () => {
    expect(tuneKeyAction('Digit1')).toEqual({ field: 'count', factor: 0.9 });
    expect(tuneKeyAction('Digit2')).toEqual({ field: 'count', factor: 1.1 });
    expect(tuneKeyAction('Digit3')).toEqual({ field: 'size', factor: 0.9 });
    expect(tuneKeyAction('Numpad4')).toEqual({ field: 'size', factor: 1.1 });
    expect(tuneKeyAction('Digit6')).toEqual({ field: 'life', factor: 1.1 });
    expect(tuneKeyAction('Digit7')).toEqual({ field: 'speed', factor: 0.9 });
    expect(tuneKeyAction('Digit0')).toBe('reset');
    expect(tuneKeyAction('Digit9')).toBeNull();
    expect(tuneKeyAction('KeyJ')).toBeNull();
  });

  it('두께 고정 고리: 화면 지름이 커질수록 상대 선 두께가 얇은 그림을 고르고, 범위 밖은 끝 그림에 붙는다', () => {
    const n = FIXED_RING_LINES_PX.length;
    // 선 두께 8 units를 지름 40 · 400 units에 그리면 상대 두께는 0.2 · 0.02
    const small = pickFixedRingLine(8 / 40);
    const big = pickFixedRingLine(8 / 400);
    expect(big).toBeLessThan(small);
    expect(pickFixedRingLine(1)).toBe(n - 1);
    expect(pickFixedRingLine(0)).toBe(0);
    // 고른 그림의 상대 두께가 원하는 값에 가장 가깝다
    const want = 8 / 200;
    const got = pickFixedRingLine(want);
    for (let i = 0; i < n; i++)
      expect(Math.abs(FIXED_RING_LINES_PX[got] / FIXED_RING_PX - want)).toBeLessThanOrEqual(
        Math.abs(FIXED_RING_LINES_PX[i] / FIXED_RING_PX - want),
      );
  });

  it('C 키는 분류색을 화염 → 얼음 → 번개 → 화염으로 돌리고, 분류색이 아닌 색은 화염부터 시작한다', () => {
    expect(nextClassColor('#ff6a2a')).toEqual({ color: '#7fd6ff', name: '얼음' });
    expect(nextClassColor('#7fd6ff')).toEqual({ color: '#ffe14d', name: '번개' });
    expect(nextClassColor('#FFE14D')).toEqual({ color: '#ff6a2a', name: '화염' });
    expect(nextClassColor('#123456')).toEqual({ color: '#ff6a2a', name: '화염' });
  });

  it('누를 때마다 지금 값에서 10%씩 바뀌고, 알갱이 수는 1 이상의 정수다', () => {
    const r = recipe({ id: 'ga1', method: 'ga', count: 48, size: 0.5 });
    const t1 = stepTune(r, {}, 'count', 1.1);
    expect(t1).toEqual({ count: 53 });
    const t2 = stepTune(r, t1 ?? {}, 'size', 0.9);
    expect(t2).toEqual({ count: 53, size: 0.45 });
    expect(stepTune(recipe({ id: 'ga9', method: 'ga', count: 1 }), {}, 'count', 0.9)).toEqual({
      count: 1,
    });
  });

  it('속도 필드가 없는 방식에서 속도 키는 아무것도 바꾸지 않는다(null)', () => {
    expect(stepTune(recipe({ id: 'ga1', method: 'ga' }), {}, 'speed', 1.1)).toBeNull();
    expect(stepTune(recipe({ id: 'na1', method: 'na', speed: 20 }), {}, 'speed', 1.1)).toEqual({
      speed: 22,
    });
  });

  it('다듬은 값은 tune 문자열로 내보냈다 다시 읽어도 같다', () => {
    const r = recipe({ id: 'ga1', method: 'ga', count: 48, size: 0.5, life: 0.4 });
    let t = stepTune(r, {}, 'size', 1.1) ?? {};
    t = stepTune(r, t, 'life', 0.9) ?? {};
    expect(parseTune(formatTune({ ga: t }))).toEqual({ ga: t });
  });

  it('격자: 칸마다 판정 원이 들어가고, 모든 칸이 뷰 안에 있고, 뷰가 모자라면 넓힌다', () => {
    const aspect = 16 / 9;
    for (const [rows, radius] of [
      [3, 70],
      [4, 120],
    ] as const) {
      const g = compareGrid(rows, 3, radius, aspect, 360);
      expect(g.cells).toHaveLength(rows);
      expect(g.cells[0]).toHaveLength(3);
      expect(g.cellW).toBeGreaterThan(radius * 2);
      expect(g.cellH).toBeGreaterThan(radius * 2);
      for (const row of g.cells)
        for (const c of row) {
          expect(Math.abs(c.x) + g.cellW / 2).toBeLessThanOrEqual(g.halfHeight * aspect + 1e-6);
          expect(Math.abs(c.y) + g.cellH / 2).toBeLessThanOrEqual(g.halfHeight + 1e-6);
        }
      // 위 줄이 첫 행, 왼쪽 칸이 첫 열이다
      expect(g.cells[0][0].y).toBeGreaterThan(g.cells[1][0].y);
      expect(g.cells[0][0].x).toBeLessThan(g.cells[0][1].x);
    }
    expect(compareGrid(3, 3, 70, aspect, 360).halfHeight).toBe(360);
    expect(compareGrid(4, 3, 120, aspect, 360).halfHeight).toBeGreaterThan(360);
  });

  it('격자: 가운데 실제 마법 자리를 비우면 격자는 그 오른쪽에 붙고, 오른쪽 끝도 뷰 안이다', () => {
    for (const aspect of [16 / 9, 2560 / 1271]) {
      const g = compareGrid(4, 3, 70, aspect, 360, 260);
      for (const row of g.cells)
        for (const c of row) {
          expect(c.x - g.cellW / 2).toBeGreaterThanOrEqual(260 - 1e-6);
          expect(c.x + g.cellW / 2).toBeLessThanOrEqual(g.halfHeight * aspect + 1e-6);
          expect(Math.abs(c.y) + g.cellH / 2).toBeLessThanOrEqual(g.halfHeight + 1e-6);
        }
    }
  });

  it('다음 방식의 비교판 URL에도 고른 후보 · tune이 이어진다', () => {
    const url = buildCompareUrl(
      'http://localhost:8080/',
      'na',
      { ga: 'ga2' },
      { ga: { count: 60 } },
    );
    const { mode, errors } = parseLabUrl(url.slice(url.indexOf('?')), RECIPES);
    expect(errors).toEqual([]);
    expect(mode.kind).toBe('compare');
    expect(mode.method).toBe('na');
    expect(mode.picks.ga).toBe('ga2');
    expect(mode.tune).toEqual({ ga: { count: 60 } });
  });

  it('기본 부하 회차의 측정 URL은 load=base · counts=200이다', () => {
    const url = buildMeasureUrl(
      'http://localhost:8080/',
      { ga: 'ga2' },
      {},
      {
        load: 'base',
        counts: [200],
      },
    );
    const { mode, errors } = parseLabUrl(url.slice(url.indexOf('?')), RECIPES);
    expect(errors).toEqual([]);
    expect(mode.load).toBe('base');
    expect(mode.counts).toEqual([200]);
  });
});

describe('VfxRecipeLogic — 레시피 파일을 읽을지 · 재현 기록', () => {
  it('lab 파라미터가 있을 때만 레시피 파일을 읽는다 — 보통 게임은 파일을 건드리지 않는다', () => {
    expect(hasLabParam('?lab=measure')).toBe(true);
    expect(hasLabParam('lab=compare&method=ga')).toBe(true);
    expect(hasLabParam('')).toBe(false);
    expect(hasLabParam('?method=ga')).toBe(false);
  });

  it('레시피 해시는 같은 글이면 같고 한 글자만 달라도 다르다(16진수 8자리)', () => {
    const a = textHash('{"id":"ga1"}');
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(textHash('{"id":"ga1"}')).toBe(a);
    expect(textHash('{"id":"ga2"}')).not.toBe(a);
  });
});

describe('vfx-lab.json — 실제 레시피 파일', () => {
  const file: IVfxRecipe[] = JSON.parse(
    readFileSync('game/assets/resources/data/vfx-lab.json', 'utf-8'),
  );

  it('모든 후보가 검증을 통과한다', () => {
    expect(file.flatMap(validateRecipe)).toEqual([]);
  });

  it('방식 여섯마다 후보가 둘 이상이고 「고름」이 정확히 하나다 — 후보가 하나면 방식 판정과 취향 판정이 섞인다', () => {
    for (const m of ['ga', 'na', 'da', 'ra', 'ma', 'ba']) {
      const mine = file.filter((r) => r.method === m);
      expect(mine.length, m).toBeGreaterThanOrEqual(2);
      expect(mine.filter((r) => r.picked).length, m).toBe(1);
    }
  });

  it('후보 id가 겹치지 않는다', () => {
    expect(new Set(file.map((r) => r.id)).size).toBe(file.length);
  });
});

describe('VfxRecipeLogic — measureSpawnPoint (측정 모드 적 배치)', () => {
  const field = { center: { x: 100, y: -50 }, viewHalfW: 960, viewHalfH: 540 };

  it('난수 범위 끝에서도 화면 안에 놓는다', () => {
    for (const [u, v] of [
      [0, 0],
      [1, 1],
      [0, 1],
      [1, 0],
    ]) {
      const p = measureSpawnPoint(field, u, v);
      expect(Math.abs(p.x - 100)).toBeLessThan(960);
      expect(Math.abs(p.y + 50)).toBeLessThan(540);
    }
  });

  it('플레이어 주변 빈 원 안에 떨어진 점은 원 둘레로 밀어낸다', () => {
    const p = measureSpawnPoint(field, 0.52, 0.5);
    expect(Math.hypot(p.x - 100, p.y + 50)).toBeCloseTo(MEASURE_SPAWN_CLEAR_RADIUS, 5);
    expect(p.x).toBeGreaterThan(100);
  });

  it('정확히 플레이어 자리에 떨어져도 원 둘레의 한 점을 준다(0으로 나누지 않는다)', () => {
    const p = measureSpawnPoint(field, 0.5, 0.5);
    expect(Math.hypot(p.x - 100, p.y + 50)).toBeCloseTo(MEASURE_SPAWN_CLEAR_RADIUS, 5);
  });

  it('난수가 다르면 떨어진 자리에 놓아 화면에 퍼진다', () => {
    const a = measureSpawnPoint(field, 0.1, 0.2);
    const b = measureSpawnPoint(field, 0.9, 0.7);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(500);
  });
});

describe('VfxRecipeLogic — emitterSettings (레시피 → 방출기 값)', () => {
  const base: IVfxRecipe = {
    id: 't',
    method: 'ga',
    shape: 'glow',
    count: 48,
    life: 0.4,
    size: 0.5,
    color: '#ff6a2a',
    blend: 'add',
    emitShape: 'point',
    picked: true,
  };

  it('가. 터짐은 짧게 한 번 다 뿜고, 속도 × 수명이 피해 반경과 같다', () => {
    const s = emitterSettings(base, { radius: 70 });
    expect(s.duration).toBeGreaterThan(0);
    expect(s.emissionRate * s.duration).toBeCloseTo(48, 5);
    expect(s.speed * s.life).toBeCloseTo(70, 5);
    expect(s.totalParticles).toBe(48);
    expect(s.angleVar).toBe(180);
    expect(s.additive).toBe(true);
  });

  it('나. 계속 뿜기는 끝없이 뿜고 레시피의 방출률 · 속도 · 세상 좌표를 쓴다', () => {
    const s = emitterSettings(
      { ...base, method: 'na', rate: 30, speed: 20, worldSpace: true, count: 40, life: 0.5 },
      {},
    );
    expect(s.duration).toBe(-1);
    expect(s.emissionRate).toBe(30);
    expect(s.speed).toBe(20);
    expect(s.worldSpace).toBe(true);
  });

  it('라. 꼬리는 꼬리 길이 ÷ 발사체 속도만큼 산다', () => {
    const s = emitterSettings(
      { ...base, method: 'ra', shape: 'shard', tailLength: 24, tailRate: 30, blend: 'alpha' },
      { projectileSpeed: 480 },
    );
    expect(s.duration).toBe(-1);
    expect(s.life).toBeCloseTo(24 / 480, 6);
    expect(s.emissionRate).toBe(30);
    expect(s.worldSpace).toBe(true);
    expect(s.additive).toBe(false);
  });

  it('바. 루프 상태 표시는 수명 동안 count개가 유지되게 뿜는다', () => {
    const s = emitterSettings(
      { ...base, method: 'ba', statusKind: 'loop', count: 12, life: 0.6, speed: 15 },
      {},
    );
    expect(s.duration).toBe(-1);
    expect(s.emissionRate * s.life).toBeCloseTo(12, 5);
  });

  it('알갱이 시작 크기는 64px 그림 × size다', () => {
    expect(emitterSettings(base, { radius: 70 }).startSize).toBeCloseTo(32, 5);
  });
});

describe('NodeFactoryPool — 생성 함수 주입', () => {
  it('비어 있으면 생성 함수로 만들고, 반납한 것은 다시 꺼낸다', () => {
    let made = 0;
    const log: string[] = [];
    const pool = new NodeFactoryPool<{ id: number }>({
      create: () => ({ id: ++made }),
      onAcquire: (n) => log.push(`a${n.id}`),
      onRelease: (n) => log.push(`r${n.id}`),
    });
    const a = pool.acquire();
    pool.release(a);
    const b = pool.acquire();
    expect(b).toBe(a);
    expect(made).toBe(1);
    expect(log).toEqual(['a1', 'r1', 'a1']);
  });

  it('살아 있는 것만 따로 들고 있어 매 프레임 집계에 쓴다', () => {
    let made = 0;
    const pool = new NodeFactoryPool<{ id: number }>({ create: () => ({ id: ++made }) });
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(a);
    expect(pool.active).toEqual([b]);
  });

  it('두 번 반납해도 한 번만 들어간다', () => {
    const pool = new NodeFactoryPool<{ id: number }>({ create: () => ({ id: 1 }) });
    const a = pool.acquire();
    pool.release(a);
    pool.release(a);
    expect(pool.acquire()).toBe(a);
    expect(pool.acquire()).not.toBe(a);
  });
});

describe('VfxRecipeLogic — pickedRecipeMap (측정에 쓸 후보)', () => {
  const file = JSON.parse(
    readFileSync('game/assets/resources/data/vfx-lab.json', 'utf8'),
  ) as IVfxRecipe[];

  it('방식마다 고른 후보에 tune · 배율을 적용해 돌려준다', () => {
    const mode = parseLabUrl('?lab=measure&tune=ga:count=10&countScale=ga:2', file).mode;
    const m = pickedRecipeMap(mode, file);
    expect(m.ga?.id).toBe('ga1');
    expect(m.ga?.count).toBe(20);
    expect(Object.keys(m).sort()).toEqual(['ba', 'da', 'ga', 'ma', 'na', 'ra']);
  });

  it('only가 있으면 그 방식만 남긴다', () => {
    const mode = parseLabUrl('?lab=measure&only=ga,ba', file).mode;
    expect(Object.keys(pickedRecipeMap(mode, file)).sort()).toEqual(['ba', 'ga']);
  });
});
