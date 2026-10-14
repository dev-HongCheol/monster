import { type ILabError, type IVfxRecipe, parseLabUrl } from '../logic/VfxRecipeLogic';

/**
 * 이펙트 실험실의 실행 중 상태 하나(계획 2026-10-12-magic-effect-gate-plan.md §4). cc를 import하지
 * 않는 모듈 상태라 어느 컴포넌트에서나 같은 값을 읽는다.
 *
 * `mode`는 `DataManager`가 데이터 로드를 끝내고 `onReady` 콜백을 부르기 **직전**에 한 번 정한다.
 * 레시피 파일이 있는지 알아야 실험실을 켤 수 있는데(공개 빌드는 그 파일을 빼서 실험실을 막는다),
 * 파일은 비동기로 읽히기 때문이다. 스포너 · 마법 · 웨이브는 모두 `onReady` 뒤에야 움직이므로 첫
 * 스폰과 첫 피해보다 먼저 정해진다. 그보다 늦게 정하면 측정 모드의 첫 프레임에 적이 피해를 받거나
 * 스포너가 보통 간격으로 시작한다.
 *
 * `vfxOff` · `targetAlive`는 측정 운전(`VfxLab`)이 매 프레임 쓰고, 마법 · 스포너가 읽는다.
 */
export const LabRuntime = {
  /** 실험실 상태. 정해지기 전과 실험실이 꺼진 게임에서는 꺼진 기본값이다 */
  mode: parseLabUrl('', null).mode,
  /** URL · 레시피 오류. 하나라도 있으면 `mode.startBlocked` */
  errors: [] as ILabError[],
  /** 레시피 파일 내용. 실험실이 꺼져 있으면 null */
  recipes: null as IVfxRecipe[] | null,
  /** 레시피 파일의 해시(결과 파일의 재현 기록) */
  recipeHash: '',
  /** 지금 끔 블록이다 — 이펙트 노드를 만들지도 그리지도 않는다 */
  vfxOff: false,
  /** 측정 모드에서 스포너가 유지할 살아 있는 적 수. 0이면 스폰하지 않는다 */
  targetAlive: 0,
  /**
   * 켜져 있는 실험실 방출기 수와 살아 있는 알갱이 합을 읽는 함수. 측정 모드에서 그림 공장이 생기면
   * 채운다(cc 객체를 이 모듈에 들이지 않으려고 함수로 받는다). 없으면 HUD가 「-」로 적는다
   */
  liveCounts: null as (() => { emitters: number; particles: number }) | null,
};

/** 측정 모드인가(적 수 유지 · 피해 0 · 웨이브 정지). */
export function isMeasureMode(): boolean {
  return (
    LabRuntime.mode.enabled && LabRuntime.mode.kind === 'measure' && !LabRuntime.mode.startBlocked
  );
}

/**
 * 실험 판인가 — 측정 또는 비교판. 둘 다 적이 죽지 않고 제자리에 서며(적 탄 · 웨이브 · 플레이어
 * 피해 없음) 그 위에서 마법을 쏜다. 적 쪽 분기는 이 함수로 묻고, 적 수 · 자리처럼 두 모드가 다른
 * 것만 `isMeasureMode` · `isCompareMode`로 가른다.
 */
export function isLabStage(): boolean {
  return isMeasureMode() || isCompareMode();
}

/** 비교판인가(그 방식의 마법만 가운데 더미 적에게 쏜다). */
export function isCompareMode(): boolean {
  return (
    LabRuntime.mode.enabled && LabRuntime.mode.kind === 'compare' && !LabRuntime.mode.startBlocked
  );
}
