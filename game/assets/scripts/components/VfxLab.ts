import {
  _decorator,
  Camera,
  Component,
  Director,
  director,
  dynamicAtlasManager,
  game,
  Label,
  Node,
  screen,
} from 'cc';
import {
  frameTimeFromOffMedians,
  type IStatSummary,
  isNearThreshold,
  isNearUiThreshold,
  judgeShare,
  judgeUiShare,
  PASS_THRESHOLDS,
  STRESS_THRESHOLDS,
  skipRate,
  summarize,
} from '../logic/FrameStatsLogic';
import {
  type IBlockRecord,
  type IScheduleState,
  MeasureSchedule,
} from '../logic/MeasureScheduleLogic';
import {
  buildFontAbortRecord,
  driverValue,
  fontFileRecord,
  type IFirstShow,
  uiBlockFlags,
} from '../logic/UiFontProbeLogic';
import {
  applyOverrides,
  buildCompareUrl,
  buildMeasureUrl,
  COMPARE_DUMMY_COUNT,
  discardSeconds,
  formatTune,
  type ILabError,
  type ITuneFields,
  type IVfxRecipe,
  METHOD_KEYS,
  METHOD_NAMES,
  type MethodKey,
  pickedRecipeMap,
  resultFileName,
  sanitizeFileToken,
  stepTune,
  type TuneMap,
  tuneKeyAction,
} from '../logic/VfxRecipeLogic';
import { DataManager } from '../systems/DataManager';
import { GameManager } from '../systems/GameManager';
import { isCompareMode, isMeasureMode, LabRuntime } from '../systems/LabRuntime';
import { CameraController } from './CameraController';
import { LabFontLoader } from './LabFontLoader';
import { LabVfxSink } from './LabVfxSink';
import { StatusVfxOverlay } from './StatusVfxOverlay';
import { type ICompareRefs, type ICurrentPrefabs, VfxCompareBoard } from './VfxCompareBoard';
import { VfxFactory } from './VfxFactory';

const { ccclass } = _decorator;

/**
 * 결과 파일 형식 번호. 필드를 바꾸면 올린다 — 옛 결과와 섞어 표를 만들 때 가른다. 2는 UI 몫 측정의 칸
 * (블록별 hudActive · 상위 5% · 20ms 초과 수 · UI 판정 · 폰트 첫 표시 · 폰트 파일 다운로드 기록)을 더한 판이다.
 */
const RESULT_SCHEMA_VERSION = 2;
/** UI 몫 측정에서 HUD에 폰트를 입힌 뒤 첫 블록까지 기다리는 시간(초) — 그 사이 최대 바쁜 시간이 첫 표시 기록이다. */
const FONT_APPLY_SEC = 1;
/** 목표 적 수를 채우는 대기의 상한(초). */
const FILL_TIMEOUT_SEC = 30;
/** HUD 글자 갱신 간격(초). 매 프레임 바꾸면 글자 그리기 비용이 측정 통계에 섞인다. */
const HUD_REFRESH_SEC = 0.25;
/** 블록 하나에 담을 수 있는 최대 프레임 수 — 240Hz × 블록 길이에 여유를 둔 값의 배수. */
const FRAMES_PER_SEC_CAP = 300;
/** 판정 창 크기(실제 픽셀). 이 크기가 아니면 측정 화면에 노란 경고를 띄운다. */
const JUDGE_W = 1920;
const JUDGE_H = 1080;

/** 문자열 바꾸기 장치가 쓰는 HUD 라벨 넷. */
const DRIVE_LABELS = ['hp', 'wave', 'timer', 'level'] as const;

/** 측정 화면 키 안내 한 줄. */
const MEASURE_KEYS = 'Space 측정 시작 · Esc 중단(그 회차는 무효)';
/** 비교판 키 안내 한 줄. 숫자 키의 뜻은 `tuneKeyAction` JSDoc이 정본이다. */
const COMPARE_KEYS =
  'Tab · Shift+Tab 후보 고르기 · 1/2 수 · 3/4 크기 · 5/6 수명 · 7/8 속도(−/+10%) · C 색(화염 · 얼음 · 번개) · 0 되돌림 · J 값 출력 · P PNG · R 다시 재생';

/** 비교판 칸 글자 색 — 고른 행은 노랑 */
const LABEL_COLOR = '#f2f2f2';
const LABEL_SELECTED = '#ffe14d';

/** 비교판이 지금 게임에서 빌려 오는 것 — `SpellCaster`가 `VfxLab`을 붙인 직후 채운다. */
export interface ICompareHost {
  prefabs: ICurrentPrefabs;
  /** 격자를 붙일 게임 월드 노드(발사체 부모의 부모) */
  worldParent: Node | null;
}

/** 켬 − 끔 차이를 부호와 함께 소수 둘째 자리까지 쓴다(+0.12 · −0.03). */
function signed(v: number): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;
}

/** HUD의 방출기 · 알갱이 글자. 그림 공장이 없으면(이펙트를 아직 안 만들었으면) 「-」 */
function liveText(): string {
  const live = LabRuntime.liveCounts?.();
  return live ? `방출기 ${live.emitters} · 알갱이 ${live.particles}` : '방출기 - · 알갱이 -';
}

/** 블록 하나의 프레임 기록. 블록이 시작할 때 한 번 잡아 측정 중 할당이 없게 한다. */
interface IBlockFrames {
  record: IBlockRecord;
  busy: Float64Array;
  interval: Float64Array;
  n: number;
  drawCallsMax: number;
  drawCallsSum: number;
  /** HUD 노드를 켠 블록인가 — UI 몫 측정에서 분기가 맞게 돌았는지 사람이 결과 파일로 확인한다 */
  hudActive: boolean;
  /** 실험실 방출기의 살아 있는 알갱이 합 — 귀속 순서의 셋째 기준(계획 §6.6) */
  particlesMax: number;
  particlesSum: number;
  emittersMax: number;
}

/** 블록 종류 하나를 합친 통계. */
interface ISideStats {
  busy: IStatSummary;
  interval: IStatSummary;
  skipRate: number;
  validBlocks: number;
}

/**
 * 이펙트 실험실(계획 2026-10-12-magic-effect-gate-plan.md §4 · §5 · §6). `LabRuntime.mode.enabled`일
 * 때만 `SpellCaster`가 플레이어 노드에 붙인다.
 *
 * 화면 글자(HUD · 오류 상자)는 브라우저 DOM에 `textContent`로만 쓴다. Cocos `Label`로 그리면 그
 * 글자의 드로우콜이 측정하는 숫자에 섞이고, URL 값을 HTML로 넣으면 남이 만든 링크 하나로 스크립트가
 * 돈다.
 *
 * 측정 시계는 엔진 이벤트 둘이다. `EVENT_BEFORE_UPDATE`에서 바쁜 시간을 켜고 `EVENT_AFTER_DRAW`에서
 * 끈다. 간격은 연속한 `EVENT_BEFORE_UPDATE` 사이다(3.8.8 `director.tick()` 순서).
 *
 * `off=ui`이면 같은 시간표로 이펙트 대신 HUD 노드 전체를 켜고 끄는 UI 몫 측정을 한다(계획
 * 2026-11-01-ui-font-probe-plan.md §3.4). 이펙트는 두 블록 모두 끄고, HUD 라벨 문자열은 문자열 바꾸기
 * 장치만 쓰며, 첫 블록 앞에 폰트를 입혀 첫 표시를 잰다.
 */
@ccclass('VfxLab')
export class VfxLab extends Component {
  private _root: HTMLDivElement | null = null;
  private _hud: HTMLDivElement | null = null;
  private _schedule: MeasureSchedule | null = null;
  private _started = false;
  private _aborted = false;
  private _finished = false;
  private _resultName = '';
  private _resultSummary = '';
  private _frames: IBlockFrames[] = [];
  private _frameStart = 0;
  private _lastBefore = 0;
  /** 이번 프레임을 통계에 넣나 — BEFORE_UPDATE 시점의 판정을 AFTER_DRAW까지 들고 간다 */
  private _measuringThisFrame = false;
  private _hudTimer = 0;
  private _startedAt = '';
  /** 측정 시작 버튼. 시작하면 지운다 */
  private _startButton: HTMLButtonElement | null = null;
  private readonly _onBeforeUpdate = (): void => this._beforeUpdate();
  private readonly _onAfterDraw = (): void => this._afterDraw();
  private readonly _onVisibility = (): void => {
    if (document.hidden) this._schedule?.markEvent('hidden');
  };
  private readonly _onBlur = (): void => this._schedule?.markEvent('blur');
  private readonly _onResize = (): void => this._schedule?.markEvent('resize');
  private readonly _onKey = (e: KeyboardEvent): void => this._handleKey(e);
  /** 비교판에서 빌려 올 것. 비교판이 아니면 쓰지 않는다 */
  compareHost: ICompareHost | null = null;
  private _board: VfxCompareBoard | null = null;
  private _camera: Camera | null = null;
  private _labels: HTMLDivElement | null = null;
  private _panel: HTMLTextAreaElement | null = null;
  /** `P`를 눌렀다 — 다음 `EVENT_AFTER_DRAW`에서 그려진 화면을 받는다 */
  private _capturePending = false;
  private readonly _onCompareAfterDraw = (): void => this._captureIfPending();
  /** UI 몫 측정(`off=ui`)에서 HUD에 입힐 폰트 */
  private _fontLoader: LabFontLoader | null = null;
  private _fontReady = false;
  /** 폰트 첫 표시 기록(계획 2026-11-01-ui-font-probe-plan.md §3.4) */
  private readonly _firstShow: IFirstShow = {
    loadMs: null,
    applyBusyMs: null,
    applyFrame: null,
    maxBusyAfterMs: null,
  };
  /** 측정을 시작한 뒤 센 프레임 번호 — 문자열 바꾸기 장치의 값과 폰트를 입힌 프레임 번호에 쓴다 */
  private _frameNo = 0;
  /** 이번 프레임에 폰트를 입혔다 · 폰트 입힘 단계의 나머지 프레임이다 — AFTER_DRAW에서 바쁜 시간을 첫 표시로 적는다 */
  private _applyFrameThis = false;
  private _fontStageThis = false;
  /** 지금 HUD 노드를 켰나 — 블록 경계에서만 바꾸려고 들고 있는다 */
  private _hudActive = true;
  /** drive=real에서 타이머를 마지막으로 바꾼 초 */
  private _lastDriveSec = -1;
  private _driveStart = 0;

  onLoad() {
    if (typeof document === 'undefined') return; // 브라우저가 아니면 화면을 만들 곳이 없다
    this._buildDom();
    if (LabRuntime.errors.length > 0) {
      this._showErrors(LabRuntime.errors);
      return;
    }
    // 캡처 단계에서 받는다 — 엔진 입력 처리가 이벤트를 먼저 소비해도 측정 시작 키는 놓치지 않는다
    window.addEventListener('keydown', this._onKey, true);
    if (!isMeasureMode()) return;
    const mode = LabRuntime.mode;
    this._schedule = new MeasureSchedule({
      counts: mode.counts,
      blockSec: mode.blockSec,
      discardSec: discardSeconds(this._pickedRecipes()),
      fillTimeoutSec: FILL_TIMEOUT_SEC,
      fontApplySec: mode.off === 'ui' ? FONT_APPLY_SEC : undefined,
    });
    if (mode.off === 'ui') this._loadUiFont();
    director.on(Director.EVENT_BEFORE_UPDATE, this._onBeforeUpdate);
    director.on(Director.EVENT_AFTER_DRAW, this._onAfterDraw);
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('blur', this._onBlur);
    screen.on('window-resize', this._onResize, this);
  }

  start() {
    if (isCompareMode()) this._buildCompare();
  }

  onDestroy() {
    director.off(Director.EVENT_BEFORE_UPDATE, this._onBeforeUpdate);
    director.off(Director.EVENT_AFTER_DRAW, this._onAfterDraw);
    director.off(Director.EVENT_AFTER_DRAW, this._onCompareAfterDraw);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibility);
      window.removeEventListener('blur', this._onBlur);
      window.removeEventListener('keydown', this._onKey, true);
    }
    screen.off('window-resize', this._onResize, this);
    this._root?.remove();
    LabRuntime.vfxOff = false;
    LabRuntime.targetAlive = 0;
    this._restoreHud();
    this._fontLoader?.dispose();
  }

  // 비교판 격자를 카메라 가운데에 붙여 두고, HUD 글자는 초당 4회만 고친다
  update(dt: number) {
    this._followCamera();
    this._hudTimer -= dt;
    if (this._hudTimer > 0) return;
    this._hudTimer = HUD_REFRESH_SEC;
    this._renderHud();
  }

  /** 측정 시계를 켜고 시간표를 한 칸 진행해 이번 프레임의 블록 종류 · 목표 적 수를 정한다. */
  private _beforeUpdate(): void {
    const now = performance.now();
    const intervalMs = this._lastBefore > 0 ? now - this._lastBefore : 0;
    this._lastBefore = now;
    this._frameStart = now;
    this._measuringThisFrame = false;
    const s = this._schedule;
    if (!s || !this._started || this._finished) return;

    const prevBlocks = s.blocks.length;
    s.tick(intervalMs / 1000, { alive: GameManager.instance?.enemies.length ?? 0 });
    if (s.blocks.length > prevBlocks)
      this._frames.push(this._newBlock(s.blocks[s.blocks.length - 1]));

    const st = s.state;
    if (st.stage === 'done') {
      this._finish();
      return;
    }
    LabRuntime.targetAlive = st.count;
    if (LabRuntime.mode.off === 'ui') this._driveUiFrame(st);
    else LabRuntime.vfxOff = st.kind === 'off';
    this._measuringThisFrame = st.measuring && intervalMs > 0;
    if (this._measuringThisFrame) {
      const cur = this._frames[this._frames.length - 1];
      cur.interval[cur.n] = intervalMs;
    }
  }

  /** 바쁜 시간을 끄고 이번 프레임을 지금 블록에 넣는다. 폰트를 입힌 프레임과 그 뒤 1초는 첫 표시로 적는다. */
  private _afterDraw(): void {
    if (this._applyFrameThis || this._fontStageThis) {
      const busy = performance.now() - this._frameStart;
      if (this._applyFrameThis) this._firstShow.applyBusyMs = busy;
      else this._firstShow.maxBusyAfterMs = Math.max(this._firstShow.maxBusyAfterMs ?? 0, busy);
      this._applyFrameThis = false;
    }
    if (!this._measuringThisFrame) return;
    const cur = this._frames[this._frames.length - 1];
    if (cur.n >= cur.busy.length) return; // 주사율이 상한을 넘는 장비 — 남은 프레임은 버린다
    cur.busy[cur.n] = performance.now() - this._frameStart;
    const dc = director.root?.device.numDrawCalls ?? 0;
    cur.drawCallsMax = Math.max(cur.drawCallsMax, dc);
    cur.drawCallsSum += dc;
    const live = LabRuntime.liveCounts?.();
    if (live) {
      cur.particlesMax = Math.max(cur.particlesMax, live.particles);
      cur.particlesSum += live.particles;
      cur.emittersMax = Math.max(cur.emittersMax, live.emitters);
    }
    cur.n++;
  }

  /** 블록 하나의 기록 칸을 잡는다. */
  private _newBlock(record: IBlockRecord): IBlockFrames {
    const cap = Math.ceil(LabRuntime.mode.blockSec * FRAMES_PER_SEC_CAP);
    return {
      record,
      busy: new Float64Array(cap),
      interval: new Float64Array(cap),
      n: 0,
      drawCallsMax: 0,
      drawCallsSum: 0,
      hudActive: LabRuntime.mode.off === 'ui' ? uiBlockFlags(record.kind).hudActive : true,
      particlesMax: 0,
      particlesSum: 0,
      emittersMax: 0,
    };
  }

  /** 측정 모드에서 쓰는 후보(고른 것 + tune · 배율 적용, `only`로 거른 것). */
  private _pickedRecipes(): IVfxRecipe[] {
    return Object.values(pickedRecipeMap(LabRuntime.mode, LabRuntime.recipes ?? []));
  }

  /** 키 입력. 비교판이면 `_handleCompareKey`로 넘긴다. */
  private _handleKey(e: KeyboardEvent): void {
    if (this._board) {
      this._handleCompareKey(e);
      return;
    }
    if (!this._schedule) return;
    // 한글 입력기가 켜져 있으면 Chrome이 key를 'Process'로 넘기는 일이 있어 code와 key를 둘 다 본다
    const isSpace = e.code === 'Space' || e.key === ' ';
    if (isSpace && !this._started) {
      e.preventDefault();
      this._start();
    } else if (e.code === 'Escape' && this._started && !this._finished) {
      this._aborted = true;
      this._finish();
    }
  }

  /** 측정 회차를 시작한다(Space 또는 시작 버튼). */
  private _start(): void {
    if (!this._schedule || this._started || this._finished) return;
    // UI 몫 측정은 폰트가 준비된 뒤에만 시작한다 — 준비 전에 블록을 돌면 대체 글꼴로 잰 값이 판정에 들어간다
    if (LabRuntime.mode.off === 'ui') {
      if (!this._fontReady) return;
      this._prepareUiRun();
    }
    this._started = true;
    this._startedAt = new Date().toISOString();
    this._startButton?.remove();
    this._startButton = null;
  }

  /** 시간표가 끝났거나 중단됐다 — 통계를 내고 결과 파일을 내려받는다. */
  private _finish(): void {
    this._finished = true;
    LabRuntime.vfxOff = false;
    // 끔 블록 중에 끝나거나 Esc로 멈추면 HUD가 꺼진 채 남는다 — 끝날 때 늘 되돌린다
    this._restoreHud();
    const result = this._buildResult();
    const canvas = game.canvas;
    this._resultName = resultFileName(
      canvas?.width ?? 0,
      canvas?.height ?? 0,
      LabRuntime.mode.load,
      LabRuntime.mode.only,
      new Date(),
    );
    downloadJson(result, this._resultName);
  }

  /** UI 몫 측정의 폰트를 불러 들고만 있는다 — 입히는 것은 시간표의 「폰트 입힘」 프레임이다. */
  private _loadUiFont(): void {
    const { font, weight } = LabRuntime.mode;
    if (font === null || weight === null) return;
    const loader = new LabFontLoader([{ stem: font, weight }]);
    this._fontLoader = loader;
    loader.load(() => {
      if (!this.isValid) return;
      const f = loader.fonts[0];
      this._firstShow.loadMs = f.loadDoneMs === null ? null : f.loadDoneMs - f.loadStartMs;
      if (f.ttf && !f.timedOut) {
        this._fontReady = true;
        return;
      }
      this._abortFont(
        f.status === 'error' ? '폰트 거부' : f.error ? `불러오기 실패(${f.error})` : '시간 초과',
      );
    });
  }

  /**
   * 폰트가 시간 초과하거나 거부됐다 — 블록을 시작하지 않고 작은 결과 JSON을 내려받은 뒤 오류 상자를 띄운다.
   * 느린 4G 회차가 보려는 장면이 이 경로라, 여기서 기록이 남지 않으면 그 회차의 첫 표시를 얻을 수 없다.
   */
  private _abortFont(reason: string): void {
    this._finished = true;
    this._aborted = true;
    this._startButton?.remove();
    this._startButton = null;
    const record = buildFontAbortRecord({
      firstShow: this._firstShow,
      fontFiles: this._fontLoader?.fileInputs() ?? [],
      reason,
    });
    this._resultName = `font-abort-${sanitizeFileToken(new Date().toISOString())}.json`;
    this._resultSummary = `폰트 때문에 측정을 시작하지 않았다 — ${reason}`;
    downloadJson(record, this._resultName);
    this._showErrors([
      {
        problem: `폰트를 쓸 수 없어 측정을 시작하지 않았다 — ${reason}`,
        cause: '대체 글꼴로 잰 UI 몫은 판정에 쓸 수 없다',
        fix: `내려받은 ${this._resultName}의 firstShow · fontFiles를 QA 문서의 느린 4G 회차에 적는다`,
        ref: 'docs/qa/ui-font-probe-test.md §5.5(느린 4G 회차)',
      },
    ]);
  }

  /** 측정을 시작하는 순간 UI 몫 회차를 준비한다 — 문자열 주인을 장치로 넘기고 Cache Mode를 정한다. */
  private _prepareUiRun(): void {
    LabRuntime.hudDriven = true;
    LabRuntime.vfxOff = true;
    this._driveStart = performance.now();
    const labels = this._hudLabels();
    // cache=char는 숫자와 기호로만 된 hp · timer만 CHAR로 바꾼다 — wave · level은 「Wave」 · 「Lv.」 글자가
    // 있어 문장 라벨 규칙(NONE)을 따른다. 폰트를 입히기 전에 정해 두어야 첫 표시 기록에 Cache Mode를 바꾸는
    // 비용이 섞이지 않는다
    for (const key of DRIVE_LABELS) {
      const label = labels[key];
      if (!label) continue;
      const char = LabRuntime.mode.cache === 'char' && (key === 'hp' || key === 'timer');
      label.cacheMode = char ? Label.CacheMode.CHAR : Label.CacheMode.NONE;
    }
  }

  /** HUD 라벨 넷과 마법 슬롯 라벨 — `HudController`가 맡긴 손잡이에서 꺼낸다. */
  private _hudLabels(): {
    hp: Label | null;
    wave: Label | null;
    timer: Label | null;
    level: Label | null;
    spellSlots: Label[];
  } {
    const l = LabRuntime.hudControl?.labels;
    return {
      hp: (l?.hp as Label | null | undefined) ?? null,
      wave: (l?.wave as Label | null | undefined) ?? null,
      timer: (l?.timer as Label | null | undefined) ?? null,
      level: (l?.level as Label | null | undefined) ?? null,
      spellSlots: (l?.spellSlots as Label[] | undefined) ?? [],
    };
  }

  /**
   * UI 몫 측정의 한 프레임 — 블록마다 HUD를 켜고 끄고, 폰트 입힘 프레임에 폰트를 넣고, 블록 안에서만
   * 문자열을 바꾼다. 이펙트는 모든 단계에서 끈다.
   */
  private _driveUiFrame(st: IScheduleState): void {
    const flags = st.kind === null ? { vfxOff: true, hudActive: true } : uiBlockFlags(st.kind);
    LabRuntime.vfxOff = flags.vfxOff;
    this._setHud(flags.hudActive);
    if (st.applyFontNow) {
      this._applyFont();
      this._applyFrameThis = true;
      this._firstShow.applyFrame = this._frameNo;
    }
    this._fontStageThis = st.stage === 'font' && !st.applyFontNow;
    // 채우기 · 폰트 입힘 단계에는 문자열을 바꾸지 않는다 — 첫 표시 기록에 문자열 바꾸기 비용이 섞인다
    if (st.stage === 'block') this._drive();
    this._frameNo++;
  }

  /**
   * HUD 라벨 넷과 마법 슬롯 라벨에 폰트를 넣는다. `font` 세터는 그 자리에서 다시 그리므로(엔진
   * `2d/components/label.ts:466-487`) 이 프레임의 바쁜 시간에 그 비용이 들어간다.
   */
  private _applyFont(): void {
    const ttf = this._fontLoader?.fonts[0]?.ttf ?? null;
    if (!ttf) return;
    const l = this._hudLabels();
    for (const label of [l.hp, l.wave, l.timer, l.level, ...l.spellSlots])
      if (label) label.font = ttf;
  }

  /**
   * 문자열 바꾸기 — worst는 HUD 라벨 넷에 매 프레임 쓰고, real은 타이머만 1초에 한 번 바꾼다(측정 모드에는
   * 피해 · 처치가 없어 다른 라벨은 실제로도 바뀌지 않는다). 켬 · 끔 두 블록에 똑같이 쓴다 — 꺼진 라벨에
   * 쓰는 비용은 문자열 비교와 대입뿐이다.
   */
  private _drive(): void {
    const l = this._hudLabels();
    if (LabRuntime.mode.drive === 'real') {
      const sec = Math.floor((performance.now() - this._driveStart) / 1000);
      if (sec !== this._lastDriveSec && l.timer) {
        this._lastDriveSec = sec;
        l.timer.string = driverValue(sec, 'timer');
      }
      return;
    }
    for (const key of DRIVE_LABELS) {
      const label = l[key];
      if (label) label.string = driverValue(this._frameNo, key);
    }
  }

  /** HUD 노드를 켜고 끈다. 같은 값이면 건드리지 않는다 — 다시 켜면 라벨 전체를 다시 그린다. */
  private _setHud(active: boolean): void {
    if (this._hudActive === active) return;
    this._hudActive = active;
    LabRuntime.hudControl?.setActive(active);
  }

  /** HUD를 켜고 문자열 주인을 `HudController`에 되돌린다(끝 · 중단 · 컴포넌트가 사라질 때). */
  private _restoreHud(): void {
    if (LabRuntime.mode.off !== 'ui') return;
    LabRuntime.hudDriven = false;
    this._hudActive = true;
    LabRuntime.hudControl?.setActive(true);
  }

  /** 블록 기록을 적 수별 켬 · 끔 통계와 판정으로 묶는다. */
  private _buildResult(): Record<string, unknown> {
    const s = this._schedule;
    const valid = this._frames.filter((f) => f.record.invalidReasons.length === 0);
    // 한 장 시간은 회차 안 끔 블록 간격 중앙값의 최솟값 — 적 수 셋에 같이 쓴다
    const offMedians = valid
      .filter((f) => f.record.kind === 'off' && f.n > 0)
      .map((f) => summarize(Array.from(f.interval.subarray(0, f.n))).median);
    const frameMs = offMedians.length > 0 ? frameTimeFromOffMedians(offMedians) : 0;
    // Set을 펼치기([...set])로 배열로 만들지 않는다 — Cocos 웹 빌드는 펼치기를 배열 전용으로 바꿔
    // Set 자체가 원소 하나가 되고, 적 수별 통계가 통째로 빈다(2026-10-13 웹 빌드에서 확인)
    const counts = Array.from(new Set(this._frames.map((f) => f.record.count)));
    const summaryLines: string[] = [];
    const uiRun = LabRuntime.mode.off === 'ui';
    const perCount = counts.map((count) => {
      const side = (kind: 'on' | 'off'): ISideStats => {
        const blocks = valid.filter((f) => f.record.count === count && f.record.kind === kind);
        const busy: number[] = [];
        const interval: number[] = [];
        for (const f of blocks) {
          for (let i = 0; i < f.n; i++) {
            busy.push(f.busy[i]);
            interval.push(f.interval[i]);
          }
        }
        return {
          busy: summarize(busy),
          interval: summarize(interval),
          skipRate: skipRate(interval, frameMs),
          validBlocks: blocks.length,
        };
      };
      const on = side('on');
      const off = side('off');
      const th = count >= 400 ? STRESS_THRESHOLDS : PASS_THRESHOLDS;
      const judge = judgeShare(on, off, th);
      const near = isNearThreshold(judge, th);
      const judged = count === 200;
      if (uiRun) {
        // UI 몫은 중앙값으로 판정한다(사용자 결정). 평균 차이도 함께 적는 이유: drive=real처럼 문자열이
        // 초당 한 번만 바뀌면 60프레임 중 1프레임만 다시 그려 그 비용이 중앙값 · 상위 5%에는 안 보이고
        // 평균에만 남는다
        const share = judgeUiShare(on.busy.median, off.busy.median);
        const uiNear = isNearUiThreshold(share.delta);
        const ui = {
          ...share,
          nearThreshold: uiNear,
          meanDelta: on.busy.mean - off.busy.mean,
          p95Delta: on.busy.p95 - off.busy.p95,
          maxDelta: on.busy.max - off.busy.max,
          over20: { on: on.busy.over20, off: off.busy.over20 },
        };
        summaryLines.push(
          `${count}마리 UI 몫: 바쁜 시간 중앙값 ${signed(share.delta)}ms · 평균 ${signed(ui.meanDelta)}ms · 상위 5% ${signed(ui.p95Delta)}ms` +
            ` → ${share.pass ? '통과' : '실패'}${uiNear ? ' · 문턱 근처 — 한 번 더' : ''}`,
        );
        return { count, judged, thresholds: th, on, off, judge, nearThreshold: near, ui };
      }
      summaryLines.push(
        `${count}마리: 바쁜 시간 ${signed(judge.busyMeanDelta)}ms · 1% low ${signed(judge.busyLowDelta)}ms · 건너뜀 ${signed(judge.skipDelta * 100)}%p` +
          (judged
            ? ` → ${judge.pass ? '통과' : `실패(${judge.failed.join(', ')})`}${near ? ' · 문턱 근처 — 한 번 더' : ''}`
            : ' (참고)'),
      );
      return { count, judged, thresholds: th, on, off, judge, nearThreshold: near };
    });
    const invalid = s?.invalidCount ?? 0;
    const devShort = s?.devShortBlock ?? false;
    this._resultSummary = [
      this._aborted ? '중단됨 — 이 회차는 무효' : '',
      devShort ? '판정 무효 — 개발용 짧은 블록' : '',
      invalid > 0 ? `무효 블록 ${invalid} — 다시 돌리세요` : '',
      ...summaryLines,
    ]
      .filter(Boolean)
      .join('\n');
    const canvas = game.canvas;
    return {
      schemaVersion: RESULT_SCHEMA_VERSION,
      url: typeof location === 'undefined' ? '' : location.href,
      userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
      canvasPx: { width: canvas?.width ?? 0, height: canvas?.height ?? 0 },
      dynamicAtlas: dynamicAtlasManager.enabled,
      vrr: '사용자가 QA 문서에 적는다(브라우저가 알려 주지 않는다)',
      recipeHash: LabRuntime.recipeHash,
      recipes: this._pickedRecipes(),
      mode: LabRuntime.mode,
      startedAt: this._startedAt,
      finishedAt: new Date().toISOString(),
      aborted: this._aborted,
      devShortBlock: devShort,
      invalidBlocks: invalid,
      frameMs,
      interpretation: uiRun
        ? 'UI 몫 = HUD 노드 전체(글자 라벨 · HP · XP 바 · 마법 슬롯)를 켠 블록과 끈 블록의 바쁜 시간 차이 — 폰트 자체의 비용이 아니다'
        : '바쁜 시간 = CPU 제출 비용, GPU 비용은 간격(건너뜀) 쪽에 나타난다',
      ...(uiRun
        ? {
            firstShow: { ...this._firstShow },
            fontFiles: (this._fontLoader?.fileInputs() ?? []).map(fontFileRecord),
            timingBufferFull: this._fontLoader?.timingBufferFull ?? false,
            server: typeof location === 'undefined' ? '' : location.origin,
          }
        : {}),
      perCount,
      blocks: this._frames.map((f) => ({
        ...f.record,
        frames: f.n,
        drawCallsMax: f.drawCallsMax,
        drawCallsMean: f.n > 0 ? f.drawCallsSum / f.n : 0,
        hudActive: f.hudActive,
        particlesMax: f.particlesMax,
        particlesMean: f.n > 0 ? f.particlesSum / f.n : 0,
        emittersMax: f.emittersMax,
      })),
    };
  }

  /** 화면 왼쪽 위 HUD와 오류 상자를 담을 DOM을 만든다. 마우스 입력은 게임으로 통과시킨다. */
  private _buildDom(): void {
    const root = document.createElement('div');
    root.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:10;font:13px/1.45 monospace;color:#f2f2f2';
    const hud = document.createElement('div');
    hud.style.cssText =
      'position:absolute;left:8px;top:8px;max-width:46em;padding:6px 8px;background:rgba(0,0,0,.62);white-space:pre-wrap';
    root.appendChild(hud);
    // 키 입력은 주소창에 입력 칸이 남아 있으면 페이지에 닿지 않는다 — 클릭은 늘 닿으므로 버튼도 둔다
    if (isMeasureMode() && LabRuntime.errors.length === 0) {
      const btn = document.createElement('button');
      btn.textContent = '측정 시작';
      btn.style.cssText =
        'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:14px 28px;font:bold 20px sans-serif;pointer-events:auto;cursor:pointer';
      btn.addEventListener('click', () => this._start());
      root.appendChild(btn);
      this._startButton = btn;
    }
    document.body.appendChild(root);
    this._root = root;
    this._hud = hud;
  }

  /** 오류 상자 — 문제 · 원인 · 고칠 법 · 참고. 실험실은 시작하지 않는다. */
  private _showErrors(errors: readonly ILabError[]): void {
    if (!this._root) return;
    const box = document.createElement('div');
    box.style.cssText =
      'position:absolute;left:50%;top:8px;transform:translateX(-50%);max-width:52em;padding:10px 12px;background:#5a1414;border:1px solid #ff8080;white-space:pre-wrap;pointer-events:auto';
    box.textContent = [
      `이펙트 실험실을 시작하지 않았다 — 오류 ${errors.length}건`,
      ...errors.map(
        (e) => `\n문제: ${e.problem}\n원인: ${e.cause}\n고칠 법: ${e.fix}\n참고: ${e.ref}`,
      ),
    ].join('\n');
    this._root.appendChild(box);
  }

  /** HUD 글자를 지금 상태로 다시 쓴다. */
  private _renderHud(): void {
    if (!this._hud || LabRuntime.errors.length > 0) return;
    const mode = LabRuntime.mode;
    const lines: string[] = [];
    const legend = METHOD_KEYS.map((m) => `${m} = ${METHOD_NAMES[m]}`).join(' · ');
    if (!isMeasureMode()) {
      const method = mode.method ?? 'ga';
      const base = this._board?.selectedBase;
      const tuned = formatTune({ [method]: this._board?.selectedTune ?? {} });
      lines.push(
        `이펙트 비교판 — ${method} = ${METHOD_NAMES[method]}`,
        `드로우콜 ${director.root?.device.numDrawCalls ?? '-'} · ${liveText()}`,
        `고른 칸: ${base ? `${base.id} · 다듬은 값 ${tuned || '없음'}` : '-'}`,
        method === 'ma'
          ? '가운데: 마는 게임에 마법이 없어 격자로만 본다'
          : `가운데: 캐릭터가 ▶ 고른 칸의 후보로 실제 마법을 쏜다(더미 적 ${COMPARE_DUMMY_COUNT}마리, 피해 0)`,
        '오른쪽 격자: 자홍색 원 = 판정 원(실제 피해 반경) · 칸 오른쪽 밝은 조각 = 밝은 바닥에서 보이나',
        COMPARE_KEYS,
        legend,
      );
      this._hud.textContent = lines.join('\n');
      this._placeLabels();
      return;
    }
    const canvas = game.canvas;
    const w = canvas?.width ?? 0;
    const h = canvas?.height ?? 0;
    const s = this._schedule;
    lines.push(
      mode.off === 'ui'
        ? `UI 몫 측정 — font=${mode.font} · weight=${mode.weight} · cache=${mode.cache} · drive=${mode.drive} · counts=${mode.counts.join(',')}`
        : `이펙트 측정 — load=${mode.load} · counts=${mode.counts.join(',')} · block=${mode.blockSec}초`,
    );
    lines.push(`캔버스 ${w}×${h}px · devicePixelRatio ${window.devicePixelRatio}`);
    if (w !== JUDGE_W || h !== JUDGE_H)
      lines.push(`⚠ 판정 창은 ${JUDGE_W}×${JUDGE_H}이다 — 지금 크기는 비교 기록으로만 쓴다`);
    if (s?.devShortBlock) lines.push('⚠ 판정 무효 — 개발용 짧은 블록');
    const last = this._frames[this._frames.length - 1];
    lines.push(
      `드로우콜 ${last && last.n > 0 ? Math.round(last.drawCallsSum / last.n) : '-'} · 적 ${GameManager.instance?.enemies.length ?? 0} · ${liveText()}`,
    );
    if (!this._started && mode.off === 'ui' && !this._fontReady && !this._finished) {
      lines.push('폰트 불러오는 중 — 준비되면 「측정 시작」이나 Space로 시작할 수 있다');
    } else if (!this._started && !this._finished) {
      lines.push(
        '가운데 「측정 시작」 버튼이나 Space를 누르면 시작한다. 측정 중에는 마우스 · 키를 건드리지 마세요.',
      );
    } else if (!this._finished && s) {
      const st = s.state;
      const stage =
        st.stage === 'fill'
          ? `적 채우는 중(목표 ${st.count})`
          : st.stage === 'font'
            ? `폰트 입힘 — ${FONT_APPLY_SEC}초 기다림`
            : `${st.count}마리 · ${st.kind === 'on' ? '켬' : '끔'} 블록 ${st.blockIndex + 1}/6${st.discard ? ' · 버림 구간' : ''}`;
      lines.push(stage, '마우스 · 키를 건드리지 마세요.');
      if (s.invalidCount > 0) lines.push(`무효 블록 ${s.invalidCount} — 끝나고 다시 돌리세요`);
    } else {
      lines.push(`끝 — 내려받은 파일: ${this._resultName}`, this._resultSummary);
    }
    lines.push(MEASURE_KEYS);
    this._hud.textContent = lines.join('\n');
  }

  /**
   * 비교판 격자를 만든다. 칸 크기를 판정 원에 맞추고, 격자가 화면에 다 들어가게 카메라 뷰를 넓힌다.
   * 「현재」 행과 판정 원 반경은 지금 게임의 프리팹 · 마법 데이터에서 읽는다 — 상수로 적으면 마법
   * 데이터가 바뀔 때 판정 원만 옛 반경으로 남는다.
   */
  private _buildCompare(): void {
    const host = this.compareHost;
    const world = host?.worldParent;
    const mode = LabRuntime.mode;
    const method = mode.method;
    if (!host || !world || !method) {
      console.error(
        '[VfxLab] 비교판에 붙일 게임 월드 노드가 없다 — SpellCaster의 bulletParent를 확인하세요.',
      );
      return;
    }
    const recipes = LabRuntime.recipes ?? [];
    const candidates = recipes.filter((r) => r.method === method);
    const pickedId = mode.picks[method];
    const initial: Record<string, { tune: ITuneFields; sizeScale: number; countScale: number }> =
      {};
    if (pickedId) {
      initial[pickedId] = {
        tune: mode.tune[method] ?? {},
        sizeScale: mode.sizeScale[method] ?? 1,
        countScale: mode.countScale[method] ?? 1,
      };
    }
    const dm = DataManager.instance;
    const refs: ICompareRefs = {
      burstRadius: dm?.getSpell('fireball')?.explosionRadius ?? 70,
      novaRadius: dm?.getSpell('frost_nova')?.explosionRadius ?? 120,
      orbitRadius: dm?.getSpell('inferno')?.orbitRadius ?? 80,
      orbitDegPerSec: dm?.getSpell('inferno')?.rotationSpeedDeg ?? 120,
      projectileSpeed: dm?.getSpell('ice_missile')?.projectileSpeed ?? 450,
    };
    const ctrl = director.getScene()?.getComponentInChildren(CameraController) ?? null;
    this._camera = ctrl?.getComponent(Camera) ?? null;
    const canvas = game.canvas;
    const aspect = canvas && canvas.height > 0 ? canvas.width / canvas.height : 16 / 9;
    // 가운데 실제 마법과 같은 공장을 써야 HUD 알갱이 수에 둘이 함께 잡힌다
    const factory = this.getComponent(LabVfxSink)?.factory ?? new VfxFactory();
    LabRuntime.liveCounts = () => factory.liveCounts();
    LabRuntime.targetAlive = COMPARE_DUMMY_COUNT;

    const boardNode = new Node('VfxCompare');
    world.addChild(boardNode);
    const board = boardNode.addComponent(VfxCompareBoard);
    board.setup(
      method,
      candidates,
      initial,
      pickedId,
      factory,
      refs,
      host.prefabs,
      aspect,
      ctrl?.orthoHeight ?? 360,
    );
    this._board = board;
    // 컨트롤러 값도 함께 바꿔야 벽 클램프가 넓어진 뷰로 계산된다
    if (ctrl) ctrl.orthoHeight = board.halfHeight;
    if (this._camera) this._camera.orthoHeight = board.halfHeight;
    this._followCamera();
    this._syncLive();
    director.on(Director.EVENT_AFTER_DRAW, this._onCompareAfterDraw);
  }

  /**
   * 가운데 실제 마법에 고른 칸의 후보를 입힌다. 격자에서 고른 칸 · 다듬은 값이 바뀔 때마다 부른다 —
   * 격자만 바뀌고 가운데가 그대로면 「게임 안에서 어떻게 보이나」를 옛 후보로 판정하게 된다.
   */
  private _syncLive(): void {
    const method = LabRuntime.mode.method;
    if (!this._board || !method) return;
    const r = this._board.selectedEffective;
    this.getComponent(LabVfxSink)?.setRecipe(method, r);
    if (method === 'ba') this.getComponent(StatusVfxOverlay)?.setRecipe(r);
  }

  /** 격자 가운데를 카메라 가운데에 맞춘다 — 칸 글자 자리를 카메라 기준으로 계산하기 때문이다. */
  private _followCamera(): void {
    const board = this._board;
    const cam = this._camera;
    if (!board || !cam) return;
    const p = cam.node.worldPosition;
    board.node.setWorldPosition(p.x, p.y, board.node.worldPosition.z);
  }

  /** 비교판 키. 키의 뜻은 `COMPARE_KEYS` 한 줄과 같다. */
  private _handleCompareKey(e: KeyboardEvent): void {
    const board = this._board;
    if (!board) return;
    // 텍스트 상자에서 글을 고르고 복사하는 중에는 키를 가로채지 않는다(Esc로 닫기만)
    if (e.target === this._panel) {
      if (e.code === 'Escape') this._togglePanel(false);
      return;
    }
    if (e.code === 'Tab') {
      board.moveSelection(e.shiftKey ? -1 : 1);
      this._syncLive();
    } else if (e.code === 'KeyJ') {
      this._togglePanel(true);
    } else if (e.code === 'KeyP') {
      this._capturePending = true;
    } else if (e.code === 'KeyC') {
      board.cycleSelectedColor();
      this._syncLive();
    } else if (e.code === 'KeyR') {
      board.replay();
    } else if (e.code === 'Escape') {
      this._togglePanel(false);
    } else {
      const action = tuneKeyAction(e.code);
      const base = board.selectedBase;
      if (!action || !base) return;
      if (action === 'reset') board.setSelectedTune({});
      else {
        const next = stepTune(base, board.selectedTune, action.field, action.factor);
        if (next) board.setSelectedTune(next);
      }
      this._syncLive();
    }
    e.preventDefault();
    this._hudTimer = 0;
  }

  /**
   * `J` 텍스트 상자를 열거나 닫는다. 열 때는 고른 칸의 레시피 JSON · `tune` 조각 · 회차별 측정 URL ·
   * 다음 방식 비교판 URL을 지금 값으로 다시 쓴다.
   */
  private _togglePanel(open: boolean): void {
    if (!open) {
      this._panel?.remove();
      this._panel = null;
      return;
    }
    if (!this._root) return;
    if (!this._panel) {
      const ta = document.createElement('textarea');
      ta.readOnly = true;
      ta.style.cssText =
        'position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:min(90vw,72em);height:16em;font:12px/1.4 monospace;background:#111;color:#eee;border:1px solid #888;pointer-events:auto';
      this._root.appendChild(ta);
      this._panel = ta;
    }
    this._panel.value = this._panelText();
    this._panel.focus();
    this._panel.select();
  }

  /** `J` 상자 글. 다음 방식으로 넘어가도 지금까지 고른 후보 · 다듬은 값이 URL에 이어진다. */
  private _panelText(): string {
    const board = this._board;
    const mode = LabRuntime.mode;
    const method = mode.method;
    const base = board?.selectedBase;
    if (!board || !method || !base) return '고른 칸이 없다 — Tab으로 후보 행을 고른다';
    const rowTune = board.selectedTune;
    const picks: Partial<Record<MethodKey, string>> = { ...mode.picks, [method]: base.id };
    const tune: TuneMap = { ...mode.tune };
    if (Object.keys(rowTune).length > 0) tune[method] = rowTune;
    else delete tune[method];
    const page = `${location.origin}${location.pathname}`;
    const next = METHOD_KEYS[(METHOD_KEYS.indexOf(method) + 1) % METHOD_KEYS.length];
    const effective: IVfxRecipe = { ...applyOverrides(base, rowTune), picked: true };
    return [
      '[레시피 JSON — vfx-lab.json의 이 후보 줄을 바꿀 때]',
      JSON.stringify(effective, null, 2),
      '',
      `[tune 조각] ${formatTune({ [method]: rowTune }) || '(다듬은 값 없음)'}`,
      '',
      '[판정 스윕 · 비교 스윕(960×540) — 측정 URL]',
      buildMeasureUrl(page, picks, tune),
      '',
      '[기본 부하 — 측정 URL]',
      buildMeasureUrl(page, picks, tune, { load: 'base', counts: [200] }),
      '',
      `[다음 방식 비교판 — ${next} = ${METHOD_NAMES[next]}]`,
      buildCompareUrl(page, next, picks, tune),
    ].join('\n');
  }

  /** 칸 글자를 화면 자리에 놓는다. 격자 가운데가 카메라 가운데라서 뷰 높이 비율로 바로 바꾼다. */
  private _placeLabels(): void {
    const board = this._board;
    const canvas = game.canvas;
    if (!board || !canvas || !this._root || board.halfHeight <= 0) return;
    if (!this._labels) {
      this._labels = document.createElement('div');
      this._root.appendChild(this._labels);
    }
    const rect = canvas.getBoundingClientRect();
    const k = rect.height / (2 * board.halfHeight);
    const box = this._labels;
    box.textContent = '';
    for (const l of board.labels()) {
      const div = document.createElement('div');
      div.textContent = `${l.selected ? '▶ ' : ''}${l.text}`;
      div.style.cssText = `position:fixed;left:${rect.left + rect.width / 2 + l.x * k}px;top:${rect.top + rect.height / 2 - l.y * k}px;font:12px/1.3 monospace;white-space:pre;color:${l.selected ? LABEL_SELECTED : LABEL_COLOR};text-shadow:0 0 3px #000`;
      box.appendChild(div);
    }
  }

  /**
   * `P`를 눌렀으면 그려진 화면을 PNG로 내려받는다. WebGL 캔버스는 그리기 버퍼를 보존하지 않아서
   * 키를 누른 순간에 읽으면 빈 그림이 나온다. 그래서 그리기가 끝난 직후(`EVENT_AFTER_DRAW`) 같은
   * 흐름에서 읽는다. 칸 글자는 DOM이라 캔버스에 없으므로 2D 캔버스에 옮겨 그린 뒤 함께 붙인다.
   *
   * 키를 누른 순간이 아니라 다음 주기의 찍을 때(`atCaptureMoment`)까지 기다린다. 아무 때나 찍으면
   * 터짐이 끝나고 쉬는 동안이 찍혀 빈 칸만 남는다.
   */
  private _captureIfPending(): void {
    if (!this._capturePending || !this._board?.atCaptureMoment) return;
    this._capturePending = false;
    const src = game.canvas;
    const board = this._board;
    if (!src || !board) return;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(src, 0, 0);
    const k = src.height / (2 * board.halfHeight);
    const fontPx = Math.max(12, Math.round(src.height / 80));
    ctx.font = `${fontPx}px monospace`;
    ctx.textBaseline = 'top';
    for (const l of board.labels()) {
      ctx.fillStyle = l.selected ? LABEL_SELECTED : LABEL_COLOR;
      const lines = `${l.selected ? '▶ ' : ''}${l.text}`.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, src.width / 2 + l.x * k, src.height / 2 - l.y * k + i * fontPx * 1.3);
      });
    }
    const method = LabRuntime.mode.method ?? 'ga';
    const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
    const a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = `compare-${sanitizeFileToken(method)}-${sanitizeFileToken(stamp)}.png`;
    a.click();
  }
}

/**
 * JSON을 파일로 내려받는다. 다운로드가 시작되기 전에 주소를 거두면 Firefox · Safari는 받기를 취소한다 —
 * 결과 파일은 다시 얻으려면 회차를 처음부터 돌려야 하므로 한 박자 늦게 거둔다.
 */
function downloadJson(data: unknown, name: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  const href = a.href;
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
