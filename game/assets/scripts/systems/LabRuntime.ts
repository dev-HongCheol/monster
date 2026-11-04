import type { IFontProbeConfig } from '../logic/UiFontProbeLogic';
import { type ILabError, type IVfxRecipe, labOffMode } from '../logic/VfxRecipeLogic';

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
 * `hudControl` · `hudDriven`은 UI 몫 측정(`off=ui`)과 폰트 판정 화면(`lab=font`)이 HUD를 다룰 때 쓴다
 * (계획 2026-11-01-ui-font-probe-plan.md §3.4).
 */
export const LabRuntime = {
  /** 실험실 상태. 정해지기 전과 실험실이 꺼진 게임에서는 꺼진 기본값이다 */
  mode: labOffMode(),
  /** URL · 레시피 오류. 하나라도 있으면 `mode.startBlocked` */
  errors: [] as ILabError[],
  /** 레시피 파일 내용. 실험실이 꺼져 있으면 null */
  recipes: null as IVfxRecipe[] | null,
  /** 레시피 파일의 해시(결과 파일의 재현 기록) */
  recipeHash: '',
  /** 폰트 설정 파일 내용(`font-probe.json`). 없거나 틀렸으면 null — 그 경우 폰트를 쓰는 URL은 시작이 막혀 있다 */
  fontProbe: null as IFontProbeConfig | null,
  /** 지금 끔 블록이다 — 이펙트 노드를 만들지도 그리지도 않는다 */
  vfxOff: false,
  /** 측정 모드에서 스포너가 유지할 살아 있는 적 수. 0이면 스폰하지 않는다 */
  targetAlive: 0,
  /**
   * 켜져 있는 실험실 방출기 수와 살아 있는 알갱이 합을 읽는 함수. 측정 모드에서 그림 공장이 생기면
   * 채운다(cc 객체를 이 모듈에 들이지 않으려고 함수로 받는다). 없으면 HUD가 「-」로 적는다
   */
  liveCounts: null as (() => { emitters: number; particles: number }) | null,
  /**
   * HUD 노드를 켜고 끄는 손잡이와 HUD 라벨. `HudController`가 `onLoad`에서 맡기고 `onDestroy`에서
   * 거둔다. HUD 노드를 끄면 그 노드에 붙은 `HudController.update`도 멈춰 스스로 다시 켤 수 없으므로,
   * 바깥(실험실)이 이 손잡이로 켜고 끈다. 함수 칸으로 받는 이유는 `liveCounts`와 같다(cc 객체를 이
   * 모듈에 들이지 않으려고). 라벨은 `unknown`으로 두고 받는 쪽이 `Label`로 쓴다
   */
  hudControl: null as {
    setActive: (active: boolean) => void;
    labels: { hp: unknown; wave: unknown; timer: unknown; level: unknown; spellSlots: unknown[] };
  } | null,
  /**
   * HUD 라벨 문자열을 실험실의 문자열 바꾸기 장치만 쓴다. 참이면 `HudController.update`가 문자열
   * 쓰기를 건너뛴다 — 둘이 같은 라벨에 매 프레임 쓰면 늦게 도는 쪽이 이겨, 문자열이 바뀌는 횟수가
   * 실행 순서에 따라 달라진다
   */
  hudDriven: false,
};

/** 측정 모드인가(적 수 유지 · 피해 0 · 웨이브 정지). */
export function isMeasureMode(): boolean {
  return (
    LabRuntime.mode.enabled && LabRuntime.mode.kind === 'measure' && !LabRuntime.mode.startBlocked
  );
}

/**
 * 실험 판인가 — 측정 · 비교판 · 폰트 판정 화면. 셋 다 적이 죽지 않고 제자리에 서며(적 탄 · 웨이브 ·
 * 플레이어 피해 없음) 그 위에서 마법을 쏜다. 적 쪽 분기는 이 함수로 묻고, 적 수 · 자리처럼 모드마다
 * 다른 것만 `isMeasureMode` · `isCompareMode` · `isFontProbeMode`로 가른다.
 */
export function isLabStage(): boolean {
  return isMeasureMode() || isCompareMode() || isFontProbeMode();
}

/** 폰트 판정 화면인가(`lab=font`). */
export function isFontProbeMode(): boolean {
  return (
    LabRuntime.mode.enabled && LabRuntime.mode.kind === 'font' && !LabRuntime.mode.startBlocked
  );
}

/**
 * 레시피 후보 이펙트를 켜는 실험 판인가 — 측정 · 비교판. 폰트 판정 화면은 실험 판이어도 이펙트가
 * 지금 게임의 프리팹 그대로여야 하므로 여기서 빠진다. `isLabStage`로 물으면 판정 화면의 배경이 레시피
 * 후보 이펙트로 바뀐다.
 */
export function labVfxEnabled(): boolean {
  return isMeasureMode() || isCompareMode();
}

/**
 * 게임 시계를 멈추는가 — 폰트 판정 화면에서만 참이다. 판정은 다섯 단계 · 두 거리 · 캡처까지 해서
 * 15분(게임 길이)을 넘기기 쉬운데, 시계가 흐르면 승리로 바뀌고 결과 화면으로 넘어가 판정 화면이
 * 사라진다. 측정 · 비교판은 지금 동작을 그대로 둔다 — 이펙트 게이트 기준값을 잰 조건이 바뀌지 않게
 * 하려는 것이다.
 */
export function pausesGameTimer(): boolean {
  return isFontProbeMode();
}

/** 비교판인가(그 방식의 마법만 가운데 더미 적에게 쏜다). */
export function isCompareMode(): boolean {
  return (
    LabRuntime.mode.enabled && LabRuntime.mode.kind === 'compare' && !LabRuntime.mode.startBlocked
  );
}
