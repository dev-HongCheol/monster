import {
  _decorator,
  Color,
  Component,
  Director,
  director,
  Graphics,
  game,
  JsonAsset,
  Label,
  Layers,
  Node,
  resources,
  type TTFFont,
  UITransform,
  Vec2,
} from 'cc';
import { type I18nCatalog, I18nLogic, type I18nParams } from '../logic/I18nLogic';
import {
  buildVerdictRecord,
  type ColumnLabel,
  type ColumnOrder,
  captureFileToken,
  columnLabels,
  commonBodyWeights,
  digitWidthsEqual,
  type IFontProbeFont,
  type IProbeColumn,
  type IProbeRow,
  type IStackResult,
  type IValidity,
  judgeValidity,
  lineHeightPx,
  nextBodyWeight,
  type OutlineMode,
  PROBE_ROW_GAP_PX,
  type ProbeRowId,
  pageRows,
  RESULT_STEPS,
  stackHeight,
  timerText,
  typeScale,
} from '../logic/UiFontProbeLogic';
import { FONT_PROBE_COUNT } from '../logic/VfxRecipeLogic';
import { LabRuntime } from '../systems/LabRuntime';
import { type ILabFontRequest, LabFontLoader } from './LabFontLoader';
import { downloadBlob } from './VfxLab';

const { ccclass } = _decorator;

// ---------------------------------------------------------------------------
// 화면 값(계획 2026-11-01-ui-font-probe-plan.md §3.5)
// ---------------------------------------------------------------------------

/** 열 폭 — 1280에서 바깥 여백 32 × 2와 열 사이 32를 빼고 둘로 나눈 값 */
const COLUMN_W = 592;
/** 두 열일 때 열 중심의 x(UICanvas 기준) */
const COLUMN_X = 312;
/** 패널 안 글자의 좌우 · 위아래 여백 */
const PANEL_PAD_X = 12;
const PANEL_PAD_Y = 6;
/** 위 띠 · 아래 띠 높이 — 둘을 더하면 `PROBE_BAND_PX`다 */
const BAND_H = 32;
const BAND_FONT = 12;
const BAND_LINE = 15;
/** 지금 HUD의 웨이브 · 타이머 · 레벨 라벨 크기와 HP 숫자 크기(`main.scene`) */
const HUD_PX = 20;
const HP_PX = 14;
/** 지금 레벨업 카드 설명 상자(`main.scene`의 `CardDescLabel_0~2`) */
const CARD_BOX = { w: 150, h: 60 } as const;
/** 2번 줄 타이머가 흐르는 배속 — 숫자가 자주 바뀌어야 폭 흔들림이 보인다 */
const TIMER_SPEED = 10;
/** 단계 비율(1 · 2 · 3 키) · 줄 높이(L) · 기준 크기(B) 후보 */
const SCALE_RATIOS = [1.2, 1.25, 1.333] as const;
const LINE_RATIOS = [1.2, 1.35, 1.5] as const;
const BASE_SIZES = [16, 17, 18] as const;
/** 「저장함」 같은 알림을 띄워 두는 시간(초) */
const NOTICE_SEC = 2;
/** 유효 조건(캔버스 · 배율)을 다시 보는 간격(초) — 창 크기는 판정 중에 바뀔 수 있다 */
const RECHECK_SEC = 0.5;
/** 폰트 첫 다운로드 상한(바이트) — 로드맵 L2-1. 개발자 도구의 kB(1,000바이트)와 같은 단위로 적는다 */
const FONT_BUDGET_BYTES = 1_500_000;

const COLOR_PANEL = new Color(0x16, 0x1d, 0x2e, 255);
const COLOR_TEXT = new Color(0xf3, 0xec, 0xdc, 255);
const COLOR_TEXT_SUB = new Color(0xd0, 0xc9, 0xb9, 255);
const COLOR_OUTLINE = new Color(0x0a, 0x09, 0x08, 255);
const COLOR_SHADOW = new Color(0, 0, 0, 204);
const COLOR_BAND = new Color(0, 0, 0, 190);
const COLOR_VALID = new Color(0x1f, 0x6b, 0x34, 230);
const COLOR_INVALID = new Color(0x8a, 0x1c, 0x1c, 230);
const COLOR_PENDING = new Color(0x40, 0x40, 0x40, 230);
const COLOR_BAND_TEXT = new Color(0xf2, 0xf2, 0xf2, 255);

/**
 * 외곽선 단계. 「1단계」는 1층 HTML 판정판(`-webkit-text-stroke: 2px` + 그림자 `0 1px 2px`)과 바깥에 보이는
 * 두께가 같다. 엔진은 캔버스 선 두께를 `outlineWidth × 2`로 긋고 그 위에 채우기를 덮으므로(엔진
 * `assembler/label/text-processing.ts:536-543 · :664`) 글자 바깥에 `outlineWidth`px가 보이고, CSS 2px
 * 외곽선은 바깥에 약 1px가 보인다. 「후보 폭」은 1단계보다 1px 두껍다.
 */
type OutlineStep = 'none' | 'step1' | 'wide';
const OUTLINE_WIDTH: Readonly<Record<OutlineStep, number>> = { none: 0, step1: 1, wide: 2 };

/** 판정 화면이 문자열 바꾸기로 다시 그리는 타이머 라벨 — CHAR 판은 캐시가 글자 단위다 */
interface ITimerLabel {
  label: Label;
}

/** 줄 하나를 만든 결과. 높이는 패널 여백까지 포함한다 */
interface IBuiltRow {
  node: Node;
  height: number;
  /** 「한 줄」로 정한 줄이 열 폭에서 접혔다 */
  wrapped: boolean;
  onPanel: boolean;
}

/** 열 하나의 줄 묶음. */
interface IBuiltColumn {
  column: IProbeColumn;
  /** 이 열을 그린 폰트 — F 상태면 화면 전체를 그린 폰트다 */
  stem: string;
  rows: Map<string, IBuiltRow>;
  digitWidths: number[];
  cardOverflow: boolean;
}

/** 판정값 저장 뒤 채팅으로 답할 질문(계획 §5.3). */
const CHAT_QUESTIONS = [
  '채팅으로 답해 주세요:',
  '1. 두 조건(2K 60cm · 노트북 60cm)에서 한글 16px가 읽히나',
  '2. 두 조건에서 숫자 14px(2번 줄의 「100」)가 읽히나',
  '3. 4번 줄의 문장 속 고정 폭 숫자를 받아들일 수 있나',
  '4. 이름 공개 전 짐작 — A는 어느 폰트 같나',
  '(아무 키나 누르면 닫힌다)',
].join('\n');

/**
 * 폰트 판정 화면(`?lab=font`, 계획 2026-11-01-ui-font-probe-plan.md §3.5). 설정 파일의 폰트를 이름을 가린
 * 열로 나란히 그리고, 사용자가 키로 단계 비율 · 줄 높이 · 기준 크기 · 굵기 · 외곽선을 바꿔 가며 고른다.
 * 열 · 줄은 Cocos의 실제 Label로 그린다 — HTML 비교판과 Cocos는 글자를 그리는 과정이 달라서, 게임 안에서
 * 보이는 모양으로 골라야 판정이 출시 화면과 같다.
 *
 * 위 · 아래 띠와 숫자판은 엔진 기본 글꼴로 그린다(후보 폰트를 쓰지 않는다). 띠의 글자까지 후보 폰트로
 * 그리면 띠 모양으로 폰트를 짐작하게 된다.
 *
 * `SpellCaster`가 `lab=font`이고 오류가 없을 때 플레이어 노드에 붙인다. 노드는 `UICanvas` 아래 HUD 바로
 * 다음 형제로 만든다 — 일시정지 화면이 이 위에 그려져야 하기 때문이다.
 */
@ccclass('FontProbe')
export class FontProbe extends Component {
  private _root: Node | null = null;
  private _columnsRoot: Node | null = null;
  private _overlay: Label | null = null;
  private _overlayRoot: Node | null = null;
  private _topLeft: Label | null = null;
  private _topRight: Label | null = null;
  private _topTags: Label[] = [];
  private _topBg: Graphics | null = null;
  private _bottom: Label | null = null;
  private _loading: Label | null = null;
  private _loader: LabFontLoader | null = null;
  private _fonts: IFontProbeFont[] = [];
  private _ko = new I18nLogic();
  private _en = new I18nLogic();
  private _enemyNames: string[] = [];
  private _catalogReady = false;
  private _fontsReady = false;
  private _loadStartedAt = 0;

  private _order: ColumnOrder = 'AB';
  private _full: ColumnLabel | null = null;
  private _base = 16;
  private _ratio = 1.25;
  private _line = 1.35;
  private _weight = 400;
  private _outline: OutlineMode = 'step1';
  /** 지금 화면 — 0이 첫 화면, 1부터 둘째 화면 이후(N 키) */
  private _page = 0;
  /** 첫 화면 밖의 줄을 나눈 화면들 */
  private _pages: string[][] = [];

  private _built: IBuiltColumn[] = [];
  private _stack: IStackResult | null = null;
  private _validity: IValidity | null = null;
  private _timers: ITimerLabel[] = [];
  private _timerSec = 0;
  private _recheck = 0;
  private _notice = '';
  private _noticeLeft = 0;
  private _confirmK = false;
  private _questionsOpen = false;
  private _capturePending = false;
  private _focused = true;
  private readonly _onKey = (e: KeyboardEvent): void => this._handleKey(e);
  private readonly _onBlur = (): void => this._setFocused(false);
  private readonly _onFocus = (): void => this._setFocused(true);
  private readonly _onAfterDraw = (): void => this._captureIfPending();

  onLoad() {
    if (typeof document === 'undefined') return; // 브라우저가 아니면 화면을 만들 곳이 없다
    this._fonts = LabRuntime.fontProbe?.fonts ?? [];
    this._weight = commonBodyWeights(this._fonts)[0] ?? 400;
    LabRuntime.targetAlive = FONT_PROBE_COUNT;
    // 게임 HUD는 위 띠 · 열과 겹치고, 판정 화면은 HUD 숫자를 2번 줄에서 따로 그린다
    LabRuntime.hudControl?.setActive(false);
    this._buildRoot();
    this._loadCatalogs();
    this._loadFonts();
    window.addEventListener('keydown', this._onKey, true);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('focus', this._onFocus);
    director.on(Director.EVENT_AFTER_DRAW, this._onAfterDraw);
    this._focused = document.hasFocus();
  }

  onDestroy() {
    if (typeof document !== 'undefined') {
      window.removeEventListener('keydown', this._onKey, true);
      window.removeEventListener('blur', this._onBlur);
      window.removeEventListener('focus', this._onFocus);
    }
    director.off(Director.EVENT_AFTER_DRAW, this._onAfterDraw);
    this._loader?.dispose();
    if (this._root?.isValid) this._root.destroy();
    LabRuntime.hudControl?.setActive(true);
    LabRuntime.targetAlive = 0;
  }

  // 불러오는 동안은 진행 표시를, 준비된 뒤에는 2번 줄 타이머 · 유효 조건 · 알림 시간을 갱신한다
  update(dt: number) {
    if (!this._fontsReady || !this._catalogReady) {
      this._renderLoading();
      return;
    }
    this._timerSec += dt * TIMER_SPEED;
    const text = timerText(this._timerSec);
    for (const timer of this._timers) if (timer.label.string !== text) timer.label.string = text;
    if (this._noticeLeft > 0) {
      this._noticeLeft -= dt;
      if (this._noticeLeft <= 0) this._renderBands();
    }
    this._recheck -= dt;
    if (this._recheck <= 0) {
      this._recheck = RECHECK_SEC;
      const before = JSON.stringify(this._validity);
      this._judge();
      if (JSON.stringify(this._validity) !== before) this._renderBands();
    }
  }

  // ---------------------------------------------------------------------------
  // 준비
  // ---------------------------------------------------------------------------

  /** `UICanvas` 아래 HUD 바로 다음에 판정 화면 뿌리 노드와 위 · 아래 띠를 만든다. */
  private _buildRoot(): void {
    const ui = director.getScene()?.getChildByName('UICanvas');
    if (!ui) {
      console.error('[FontProbe] UICanvas를 찾지 못해 판정 화면을 만들 수 없다');
      return;
    }
    const root = this._node('FontProbe', ui);
    root.getComponent(UITransform)?.setContentSize(1280, 720);
    const hud = ui.getChildByName('HUD');
    if (hud) root.setSiblingIndex(hud.getSiblingIndex() + 1);
    this._root = root;
    // 줄을 띠보다 먼저 만든다 — 형제 차례가 뒤일수록 위에 그려지므로 띠가 언제나 줄 위에 보인다
    this._columnsRoot = this._node('Columns', root);

    const top = this._node('TopBand', root);
    top.setPosition(0, 360 - BAND_H / 2);
    this._topBg = top.addComponent(Graphics);
    this._topLeft = this._bandLabel(top, -632, BAND_H / 2 - 1);
    this._topRight = this._bandLabel(top, 0, BAND_H / 2 - 1);
    this._topTags = [this._bandLabel(top, 0, -1), this._bandLabel(top, 0, -1)];

    const bottom = this._node('BottomBand', root);
    bottom.setPosition(0, -360 + BAND_H / 2);
    const bg = bottom.addComponent(Graphics);
    bg.fillColor = COLOR_BAND;
    bg.rect(-640, -BAND_H / 2, 1280, BAND_H);
    bg.fill();
    this._bottom = this._bandLabel(bottom, -632, BAND_H / 2 - 1);

    this._loading = this._bandLabel(root, -200, 20);
    this._loading.fontSize = 18;
    this._loading.lineHeight = 24;
    const overlay = this._node('Questions', root);
    this._overlay = this._bandLabel(overlay, -260, 80);
    this._overlay.fontSize = 16;
    this._overlay.lineHeight = 22;
    this._overlay.enableOutline = true;
    this._overlay.outlineWidth = 2;
    this._overlay.outlineColor = COLOR_OUTLINE;
    overlay.active = false;
    this._overlayRoot = overlay;
  }

  /** 결과 화면 문구를 한 · 영으로 만들 카탈로그와 처치 목록의 귀신 이름을 읽는다. */
  private _loadCatalogs(): void {
    resources.load(['i18n/ko', 'i18n/en', 'data/enemies'], JsonAsset, (err, assets) => {
      if (!this.isValid) return;
      if (err || !assets) {
        console.error('[FontProbe] 카탈로그를 읽지 못했다 — 결과 화면 문구가 키로 보인다', err);
      } else {
        const [ko, en, enemies] = assets.map((a) => a?.json);
        this._ko.setCatalog('ko', ko as I18nCatalog);
        this._en.setCatalog('ko', ko as I18nCatalog);
        this._en.setCatalog('en', en as I18nCatalog);
        this._en.setLanguage('en');
        this._enemyNames = ((enemies as { name?: string }[] | null) ?? [])
          .map((e) => e.name ?? '')
          .filter(Boolean);
      }
      this._catalogReady = true;
      this._maybeStart();
    });
  }

  /** 설정 파일의 폰트마다 본문 굵기와 제목 굵기 파일을 모두 불러온다. */
  private _loadFonts(): void {
    // flatMap은 게임 tsconfig의 대상(ES2019 이전)에 없다
    const requests: ILabFontRequest[] = [];
    for (const f of this._fonts) {
      for (const weight of f.body) requests.push({ stem: f.stem, weight });
      requests.push({ stem: f.stem, weight: f.title });
    }
    this._loader = new LabFontLoader(requests);
    this._loadStartedAt = performance.now();
    this._loader.load(() => {
      if (!this.isValid) return;
      this._fontsReady = true;
      this._maybeStart();
    });
  }

  /** 폰트와 카탈로그가 모두 준비되면 열을 그린다. */
  private _maybeStart(): void {
    if (!this._fontsReady || !this._catalogReady) return;
    if (this._loading) this._loading.node.active = false;
    this._layout();
  }

  /** 불러오는 중 표시 — 몇 개 받았나 · 경과 초 · 3초를 넘긴 파일 수. */
  private _renderLoading(): void {
    if (!this._loading || !this._loader) return;
    const total = this._loader.fonts.length;
    const elapsed = (performance.now() - this._loadStartedAt) / 1000;
    const late = this._loader.fonts.filter(
      (f) => (f.loadDoneMs ?? performance.now()) - f.loadStartMs >= 3000,
    ).length;
    this._loading.string =
      `폰트 불러오는 중 ${this._loader.doneCount}/${total} · ${elapsed.toFixed(1)}초` +
      (late > 0 ? `\n3초를 넘긴 파일 ${late}개` : '');
  }

  // ---------------------------------------------------------------------------
  // 배치
  // ---------------------------------------------------------------------------

  /** 지금 설정으로 열과 줄을 모두 다시 만들고, 높이를 재서 첫 화면 · 둘째 화면에 나눠 놓는다. */
  private _layout(): void {
    const parent = this._columnsRoot;
    if (!parent) return;
    this._clear(parent);
    this._timers = [];
    const stems = this._fonts.map((f) => f.stem);
    const columns = columnLabels(this._order, stems);
    const fullStem = this._full ? columns.find((c) => c.label === this._full)?.stem : undefined;
    this._built = columns.map((column) =>
      this._buildColumn(column, fullStem ?? column.stem, parent),
    );

    const ids: ProbeRowId[] = [
      '1-가',
      '1-나',
      '1-다',
      '1-라',
      '1-마',
      '2',
      '3',
      '4',
      '4-en',
      '5',
      '6',
    ];
    const rows: IProbeRow[] = ids.map((id) => ({ id, height: this._rowHeight(id) }));
    this._stack = stackHeight(rows);
    this._pages = pageRows(this._extraIds().map((id) => ({ id, height: this._rowHeight(id) })));
    if (this._page > this._pages.length) this._page = 0;
    const shown = this._page === 0 ? this._stack.first : this._pages[this._page - 1];
    this._place(shown);
    this._judge();
    this._renderBands();
  }

  /** 줄 높이 — 두 열 가운데 큰 값. 두 열의 패널이 크기 · 자리가 같아야 대비가 같다. */
  private _rowHeight(id: string): number {
    return Math.max(0, ...this._built.map((c) => c.rows.get(id)?.height ?? 0));
  }

  /** 첫 화면 밖에 놓을 줄 — 결과 화면 묶음 다음에 첫 화면에서 넘긴 줄. `pageRows`가 화면 단위로 나눈다. */
  private _extraIds(): string[] {
    return [
      'b-title',
      'b-stats',
      'b-kills',
      'b-passives',
      'b-buttons',
      ...(this._stack?.second ?? []),
    ];
  }

  /** 열 하나의 줄을 모두 만든다(자리는 `_place`가 정한다). */
  private _buildColumn(column: IProbeColumn, stem: string, parent: Node): IBuiltColumn {
    const built: IBuiltColumn = {
      column,
      stem,
      rows: new Map(),
      digitWidths: [],
      cardOverflow: false,
    };
    const body = this._ttf(stem, this._weight);
    const title = this._ttf(stem, this._fonts.find((f) => f.stem === stem)?.title ?? 800);
    const px = typeScale(this._base, this._ratio, RESULT_STEPS);
    const make = (id: string, fn: (n: Node) => { wrapped?: boolean }, onPanel = true) => {
      const node = this._node(`Row_${id}`, parent);
      const inner = this._node('Inner', node);
      if (onPanel) inner.setPosition(PANEL_PAD_X, -PANEL_PAD_Y);
      const r = fn(inner);
      const h = this._stackChildren(inner) + (onPanel ? PANEL_PAD_Y * 2 : 0);
      built.rows.set(id, { node, height: h, wrapped: r.wrapped ?? false, onPanel });
    };
    const textW = COLUMN_W - PANEL_PAD_X * 2;
    const ko = (k: string, p?: I18nParams) => this._ko.t(k, p);
    const en = (k: string, p?: I18nParams) => this._en.t(k, p);

    make('1-가', (n) => ({
      wrapped: this._oneLine(n, ko('result.victory', { wave: 99 }), px[3], title, textW),
    }));
    make('1-나', (n) => ({
      wrapped: this._oneLine(n, this._widest(this._statLines(ko), px[2], body), px[2], body, textW),
    }));
    make('1-다', (n) => ({
      wrapped: this._oneLine(
        n,
        `${ko('result.retry')}    ${ko('result.menu')}`,
        px[1],
        body,
        textW,
      ),
    }));
    make('1-라', (n) => ({
      wrapped: this._oneLine(n, this._widest(this._listLines(ko), px[0], body), px[0], body, textW),
    }));
    make('1-마', (n) => {
      const a = this._oneLine(n, en('result.victory', { wave: 99 }), px[3], title, textW);
      const b = this._oneLine(
        n,
        this._widest(this._statLines(en), px[2], body),
        px[2],
        body,
        textW,
      );
      const c = this._oneLine(
        n,
        `${en('result.retry')}    ${en('result.menu')}`,
        px[1],
        body,
        textW,
      );
      const d = this._oneLine(
        n,
        this._widest(this._listLines(en), px[0], body),
        px[0],
        body,
        textW,
      );
      return { wrapped: a || b || c || d };
    });
    make('2', (n) => this._buildDigitsRow(n, body, built), false);
    make('3', (n) => this._buildCardRow(n, body, built));
    make('4', (n) => {
      this._para(n, '공격력 12% 증가 · 30초 동안 지속', this._base, body, textW);
      return {};
    });
    make('4-en', (n) => {
      this._para(n, 'Damage +12% · Lasts 30 sec', this._base, body, textW);
      return {};
    });
    make('5', (n) => this._buildOutlineRow(n, px[1], body), false);
    make('6', (n) => ({ wrapped: this._oneLine(n, '똠 햏 漢 é € 😀', px[1], body, textW) }));

    // 둘째 화면 — 결과 화면 묶음을 실제 결과 화면 차례대로
    make('b-title', (n) => ({
      wrapped: this._oneLine(n, ko('result.defeat', { wave: 37 }), px[3], title, textW),
    }));
    make('b-stats', (n) => {
      for (const line of this._statLines(ko)) this._oneLine(n, line, px[2], body, textW);
      return {};
    });
    make('b-kills', (n) => {
      const names = this._enemyNames.slice(0, 5);
      this._para(
        n,
        names.map((name, i) => `${name}  ${[412, 187, 96, 31, 4][i]}`).join('\n'),
        px[0],
        body,
        textW,
      );
      return {};
    });
    make('b-passives', (n) => {
      this._para(n, this._passiveLines(ko).join('\n'), px[0], body, textW, COLOR_TEXT_SUB);
      return {};
    });
    make('b-buttons', (n) => ({
      wrapped: this._oneLine(
        n,
        `${ko('result.retry')}    ${ko('result.menu')}`,
        px[1],
        body,
        textW,
      ),
    }));
    return built;
  }

  /** 결과 화면 통계 줄 셋(`ResultController`가 만드는 형식 그대로 — 이름과 값이 한 라벨이다). */
  private _statLines(t: (k: string, p?: I18nParams) => string): string[] {
    return [
      `${t('result.stat.level')}  Lv.99`,
      `${t('result.stat.survival')}  99:59`,
      `${t('result.stat.kills')}  9,999`,
    ];
  }

  /** 결과 화면 패시브 줄 셋(`ResultController._renderPassives` 형식). */
  private _passiveLines(t: (k: string, p?: I18nParams) => string): string[] {
    return [
      `${t('result.stat.passive.hp')}  Lv.5  (+100)`,
      `${t('result.stat.passive.move')}  Lv.5  (+25%)`,
      `${t('result.stat.passive.pickup')}  Lv.5  (+150%)`,
    ];
  }

  /** 처치 목록 · 패시브 줄 후보(1-라는 이 가운데 가장 넓은 줄 하나만 둔다). */
  private _listLines(t: (k: string, p?: I18nParams) => string): string[] {
    return [...this._passiveLines(t), ...this._enemyNames.map((name) => `${name}  999`)];
  }

  /** HUD 숫자 줄 — `00:00` · `11:11` · `88:88` 실측 폭, NONE · CHAR 판 타이머(10배속), 14px 「100」. */
  private _buildDigitsRow(
    n: Node,
    font: TTFFont | null,
    built: IBuiltColumn,
  ): { wrapped?: boolean } {
    const outline: OutlineStep = this._outline === 'step1' ? 'step1' : 'none';
    const lineA = this._node('Widths', n);
    let x = 0;
    for (const s of ['00:00', '11:11', '88:88']) {
      const l = this._label(lineA, s, { size: HUD_PX, font, outline });
      l.node.setPosition(x, 0);
      const w = l.node.getComponent(UITransform)?.width ?? 0;
      built.digitWidths.push(w);
      x += w + 24;
    }
    const lineB = this._node('Timers', n);
    const none = this._label(lineB, '00:00', { size: HUD_PX, font, outline });
    const char = this._label(lineB, '00:00', {
      size: HUD_PX,
      font,
      outline,
      cache: Label.CacheMode.CHAR,
    });
    const hp = this._label(lineB, '100', { size: HP_PX, font, outline });
    none.node.setPosition(0, 0);
    char.node.setPosition(120, 0);
    hp.node.setPosition(240, 0);
    this._timers.push({ label: none }, { label: char });
    this._fitHeight(lineA);
    this._fitHeight(lineB);
    return {};
  }

  /** 카드 설명 줄 — 지금 카드 상자(150×60)를 테두리로 그리고, 실제 카드 문구 가운데 가장 높은 것을 넣는다. */
  private _buildCardRow(n: Node, font: TTFFont | null, built: IBuiltColumn): { wrapped?: boolean } {
    const text = this._tallestCard(font);
    const box = this._node('Box', n);
    const g = box.addComponent(Graphics);
    g.lineWidth = 1;
    g.strokeColor = COLOR_TEXT_SUB;
    g.rect(0, -CARD_BOX.h, CARD_BOX.w, CARD_BOX.h);
    g.stroke();
    box.getComponent(UITransform)?.setContentSize(CARD_BOX.w, CARD_BOX.h);
    const label = this._label(box, text, { size: this._base, font, width: CARD_BOX.w });
    label.node.setPosition(0, 0);
    const h = label.node.getComponent(UITransform)?.height ?? 0;
    built.cardOverflow = h > CARD_BOX.h;
    box.getComponent(UITransform)?.setContentSize(CARD_BOX.w, Math.max(CARD_BOX.h, h));
    return {};
  }

  /** 실제 카드 설명 문구(마법 · 분류 조합 포함) 가운데 상자 폭에서 가장 높이 쌓이는 것. */
  private _tallestCard(font: TTFFont | null): string {
    const cat = this._ko;
    const options = ['upgrade.damage', 'upgrade.cooldown'].map((k) => cat.t(k));
    const spells = ['fireball', 'ice_missile', 'lightning_bolt', 'frost_nova', 'inferno'].map(
      (id) => cat.t(`spell.${id}.name`),
    );
    const categories = ['fire', 'ice', 'lightning', 'support'].map((c) => cat.t(`category.${c}`));
    const plain = [
      'damage_boost',
      'cooldown_reduce',
      'hp_up',
      'move_speed_up',
      'pickup_range_up',
    ].map((k) => cat.t(`card.${k}.desc`));
    const candidates = [
      ...plain,
      ...pairs(spells, options).map(([spell, option]) =>
        cat.t('card.spell_upgrade.desc', { spell, option }),
      ),
      ...pairs(categories, options).map(([category, option]) =>
        cat.t('card.category_upgrade.desc', { category, option }),
      ),
    ];
    const probe = this._measureNode();
    let best = candidates[0] ?? '';
    let bestH = -1;
    for (const text of candidates) {
      const l = this._label(probe, text, { size: this._base, font, width: CARD_BOX.w });
      const h = l.node.getComponent(UITransform)?.height ?? 0;
      if (h > bestH) {
        bestH = h;
        best = text;
      }
    }
    this._clear(probe);
    probe.removeFromParent();
    probe.destroy();
    return best;
  }

  /** 외곽선 줄 — 없음 / 1단계 / 후보 폭을 나란히. O 키와 상관없이 셋을 다 보인다. */
  private _buildOutlineRow(n: Node, size: number, font: TTFFont | null): { wrapped?: boolean } {
    // 한 줄 노드에 가로로 놓는다 — 줄 노드 바로 아래 자식은 `_stackChildren`이 세로로 쌓는다
    const line = this._node('Line', n);
    let x = 0;
    for (const [step, name] of [
      ['none', '없음'],
      ['step1', '1단계'],
      ['wide', '후보 폭'],
    ] as const) {
      const l = this._label(line, `${name} 가나다 99:59`, { size, font, outline: step });
      l.node.setPosition(x, 0);
      x += (l.node.getComponent(UITransform)?.width ?? 0) + 28;
    }
    this._fitHeight(line);
    return {};
  }

  /** 줄들을 정한 차례로 위에서부터 쌓고, 패널 줄 뒤에는 두 열에 같은 크기의 패널을 그린다. */
  private _place(ids: readonly string[]): void {
    const xs = this._built.length === 2 ? [-COLUMN_X, COLUMN_X] : [0];
    const shown = new Set(ids);
    let y = 360 - BAND_H;
    for (const id of ids) {
      const h = this._rowHeight(id);
      this._built.forEach((col, i) => {
        const row = col.rows.get(id);
        if (!row) return;
        row.node.setPosition(xs[i] - COLUMN_W / 2, y);
        if (row.onPanel) this._drawPanel(row.node, h);
      });
      y -= h + PROBE_ROW_GAP_PX;
    }
    for (const col of this._built)
      for (const [id, row] of col.rows) row.node.active = shown.has(id);
  }

  /** 줄 노드 뒤에 불투명 패널을 그린다 — 한쪽 열 뒤로만 적이 지나가 대비가 달라지는 일을 막는다. */
  private _drawPanel(rowNode: Node, h: number): void {
    const g = rowNode.getComponent(Graphics) ?? rowNode.addComponent(Graphics);
    g.clear();
    g.fillColor = COLOR_PANEL;
    g.rect(0, -h, COLUMN_W, h);
    g.fill();
  }

  // ---------------------------------------------------------------------------
  // 판정 · 띠
  // ---------------------------------------------------------------------------

  /** 지금 화면이 유효한지 정한다. */
  private _judge(): void {
    const canvas = game.canvas;
    this._validity = judgeValidity({
      canvasW: canvas?.width ?? 0,
      canvasH: canvas?.height ?? 0,
      dpr: window.devicePixelRatio,
      fonts: (this._loader?.fonts ?? []).map((f) => ({
        stem: f.stem,
        ready: f.loadDoneMs !== null && f.ttf !== null,
        status: f.status,
        timedOut: f.timedOut,
      })),
      firstScreenOverflow: this._stack?.firstScreenOverflow ?? false,
    });
  }

  /** 위 띠(유효 · 숫자판 · 열 이름표)와 아래 띠(키 안내 · 알림)를 다시 쓴다. */
  private _renderBands(): void {
    const v = this._validity;
    if (this._topBg) {
      const g = this._topBg;
      g.clear();
      g.fillColor = v === null ? COLOR_PENDING : v.valid ? COLOR_VALID : COLOR_INVALID;
      g.rect(-640, -BAND_H / 2, 1280, BAND_H);
      g.fill();
    }
    if (this._topLeft) {
      this._topLeft.string =
        v === null ? '아직 검사 전' : v.valid ? '유효' : `무효: ${v.reasons.join(' · ')}`;
    }
    if (this._topRight) {
      this._topRight.string = this._boardText();
      // 문자열을 바꾼 직후에는 폭이 아직 옛 값이다 — 다시 그려야 오른쪽 끝에 맞출 폭을 읽는다
      this._topRight.updateRenderData(true);
      const w = this._topRight.node.getComponent(UITransform)?.width ?? 0;
      this._topRight.node.setPosition(632 - w, BAND_H / 2 - 1);
    }
    const xs = this._built.length === 2 ? [-COLUMN_X, COLUMN_X] : [0];
    this._topTags.forEach((tag, i) => {
      const col = this._built[i];
      tag.node.active = col !== undefined;
      if (!col) return;
      const late = this._loader?.fonts.some((f) => f.stem === col.stem && f.timedOut) ?? false;
      // F 상태에서는 두 열이 같은 폰트를 그리므로 이름표도 그 폰트의 열 이름 하나다
      tag.string = `${this._full ? `${this._full} (전체)` : col.column.label}${late ? ' · 대체 글꼴일 수 있음' : ''}`;
      tag.updateRenderData(true);
      const w = tag.node.getComponent(UITransform)?.width ?? 0;
      tag.node.setPosition(xs[i] - w / 2, -1);
    });
    if (this._bottom) this._bottom.string = `${this._keyLine()}\n${this._statusLine()}`;
  }

  /** 숫자판 — 캔버스 · 배율 · 숫자 폭 · 폰트 준비 · 용량. */
  private _boardText(): string {
    const canvas = game.canvas;
    const fonts = this._loader?.fonts ?? [];
    const ready = fonts.filter((f) => f.ttf !== null).length;
    const latest = Math.max(0, ...fonts.map((f) => (f.loadDoneMs ?? 0) - f.loadStartMs));
    const digitsOk =
      this._built.length > 0 && this._built.every((c) => digitWidthsEqual(c.digitWidths));
    // 후보 빌드의 파일 여섯을 더한 합계는 상한과 비교할 의미가 없고, 열마다 크기를 보이면 파일 크기로
    // 폰트가 드러난다 — 용량은 폰트가 하나인 최종 빌드에서만 보인다
    let capacity = '후보 빌드 — 용량 판정은 최종 빌드에서';
    if (this._fonts.length === 1) {
      const total = this._loader?.transferTotal() ?? null;
      capacity =
        total === null
          ? '전송 크기를 찾지 못했다'
          : `전송 ${(total / 1000).toFixed(0)}kB ${total <= FONT_BUDGET_BYTES ? '≤' : '>'} 1,500kB`;
    }
    return [
      `캔버스 ${canvas?.width ?? 0}×${canvas?.height ?? 0}`,
      `배율 ${window.devicePixelRatio}`,
      `숫자 폭 ${digitsOk ? '같음' : '다름'}`,
      `폰트 ${ready}/${fonts.length}(가장 늦게 ${Math.round(latest)}ms)`,
      capacity,
    ].join(' · ');
  }

  /** 아래 띠 첫 줄 — 지금 값과 키. */
  private _keyLine(): string {
    const two = this._built.length === 2;
    return [
      `기준 ${this._base} [B]`,
      `비율 ${this._ratio} [1·2·3]`,
      `줄 ${this._line} [L]`,
      `굵기 ${this._weight} [G]`,
      `외곽선 ${this._outline === 'step1' ? '1단계' : '없음'} [O]`,
      two ? `순서 ${this._order} [Tab]` : '',
      two ? `전체 ${this._full ?? '끔'} [F]` : '',
      `화면 ${this._page + 1}/${this._pages.length + 1} [N]`,
      '캡처 [P]',
      '저장 [K]',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  /** 아래 띠 둘째 줄 — 초점 · 알림 · 줄바꿈 · 카드 상자 · 둘째 화면으로 보낸 줄 · 판정 순서. */
  private _statusLine(): string {
    if (!this._focused) return '한 번 눌러 키 켜기';
    if (this._noticeLeft > 0 || this._confirmK) return this._notice;
    const notes: string[] = [];
    const wrapped = new Set<string>();
    for (const col of this._built)
      for (const [id, row] of col.rows) if (row.wrapped && !id.startsWith('b-')) wrapped.add(id);
    for (const id of wrapped) notes.push(`${id}번 줄 열 폭에서 줄바꿈`);
    if (this._built.some((c) => c.cardOverflow)) notes.push('카드 상자 넘침');
    const second = this._stack?.second ?? [];
    if (second.length > 0) notes.push(`${second.join(' · ')}번 줄은 N`);
    notes.push('CHAR 판은 그림자 없음(엔진 제한)');
    notes.push('순서: 폰트 → 굵기 → 최소 글자 → 비율 → 줄 높이');
    return notes.join(' · ');
  }

  /** 알림을 띄운다. */
  private _say(text: string, sec = NOTICE_SEC): void {
    this._notice = text;
    this._noticeLeft = sec;
    this._renderBands();
  }

  /** 창 초점 — iframe 안에서는 한 번 눌러야 키를 받는다. */
  private _setFocused(focused: boolean): void {
    this._focused = focused;
    this._renderBands();
  }

  // ---------------------------------------------------------------------------
  // 키 · 저장
  // ---------------------------------------------------------------------------

  /**
   * 키 입력. `e.code`로 판정한다 — 한글 입력기가 켜져 있으면 `e.key`가 `Process`로 들어온다. `Tab`은
   * 초점 이동을 막는다. 키를 누르고 있어 생기는 자동 반복은 무시한다 — K를 반 초쯤 누르고 있으면 반복
   * 입력이 두 번째 누르기가 되어 확인 없이 저장되고, B · L · 1~3은 반복될 때마다 열 전체를 다시 만든다.
   * K가 아닌 키를 누르면 K 확인 대기를 푼다.
   */
  private _handleKey(e: KeyboardEvent): void {
    if (!this._fontsReady || !this._catalogReady) return;
    if (e.repeat) {
      if (e.code === 'Tab') e.preventDefault();
      return;
    }
    if (this._questionsOpen) {
      this._questionsOpen = false;
      if (this._overlayRoot) this._overlayRoot.active = false;
    }
    if (e.code !== 'KeyK' && this._confirmK) {
      this._confirmK = false;
      // 아래에서 처리하지 않는 키(WASD 등)로 빠져나가도 띠의 「K를 한 번 더 누르면 저장」이 남지 않게 바로
      // 다시 그린다 — 남기면 화면은 저장 대기인데 다음 K는 확인부터 다시 한다
      this._renderBands();
    }
    const two = this._built.length === 2;
    let relayout = true;
    switch (e.code) {
      case 'Tab':
        e.preventDefault();
        if (!two) return;
        this._order = this._order === 'AB' ? 'BA' : 'AB';
        break;
      case 'KeyF': {
        if (!two) return;
        const [left, right] = columnLabels(
          this._order,
          this._fonts.map((f) => f.stem),
        ).map((c) => c.label);
        this._full = this._full === null ? left : this._full === left ? right : null;
        break;
      }
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Numpad1':
      case 'Numpad2':
      case 'Numpad3':
        this._ratio = SCALE_RATIOS[Number(e.code.slice(-1)) - 1];
        break;
      case 'KeyL':
        this._line = cycle(LINE_RATIOS, this._line);
        break;
      case 'KeyB':
        this._base = cycle(BASE_SIZES, this._base);
        break;
      case 'KeyG':
        this._weight = nextBodyWeight(commonBodyWeights(this._fonts), this._weight);
        break;
      case 'KeyO':
        this._outline = this._outline === 'step1' ? 'none' : 'step1';
        break;
      case 'KeyN':
        this._page = (this._page + 1) % (this._pages.length + 1);
        break;
      case 'KeyP':
        this._capturePending = true;
        relayout = false;
        break;
      case 'KeyK':
        this._pressK();
        relayout = false;
        break;
      default:
        return;
    }
    if (relayout) this._layout();
    else this._renderBands();
  }

  /** K — 처음 누르면 고른 값을 보이고, 한 번 더 누르면 판정값 JSON을 내려받는다. */
  private _pressK(): void {
    const left = this._built[0];
    if (!left) return;
    const chosen = this._full ?? left.column.label;
    if (!this._confirmK) {
      this._confirmK = true;
      this._notice = `${this._full ? '전체' : '왼쪽 열'} ${chosen} · 본문 ${this._weight} · 기준 ${this._base} · 비율 ${this._ratio} · 줄 ${this._line}를 고름 — K를 한 번 더 누르면 저장`;
      this._noticeLeft = 0;
      return;
    }
    this._confirmK = false;
    // 유효 판정은 0.5초마다 다시 보므로, 저장 직전에 창 크기 · 배율이 바뀌었으면 낡은 값이 기록된다
    this._judge();
    const canvas = game.canvas;
    const savedAt = new Date().toISOString();
    const record = buildVerdictRecord({
      columns: this._built.map((c) => c.column),
      order: this._order,
      fullScreenFont: this._full,
      baseSize: this._base,
      scaleRatio: this._ratio,
      lineRatio: this._line,
      bodyWeight: this._weight,
      outline: this._outline,
      canvas: { w: canvas?.width ?? 0, h: canvas?.height ?? 0 },
      dpr: window.devicePixelRatio,
      validity: this._validity ?? { valid: false, reasons: [] },
      fontFiles: this._loader?.fileInputs() ?? [],
      timingBufferFull: this._loader?.timingBufferFull ?? false,
      savedAt,
    });
    const name = `font-verdict-${captureFileToken(this._order, this._full, savedAt)}.json`;
    downloadBlob(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }), name);
    this._say(`저장함: ${name}`);
    if (this._overlay && this._overlayRoot) {
      this._overlay.string = CHAT_QUESTIONS;
      this._overlayRoot.active = true;
      this._questionsOpen = true;
    }
  }

  /**
   * `P`를 눌렀으면 그려진 화면을 PNG로 내려받는다. 그리기가 끝난 직후(`EVENT_AFTER_DRAW`)에 읽어야 캔버스가
   * 비어 있지 않다 — 키를 누른 순간에 읽으면 빈 그림이 나온다.
   */
  private _captureIfPending(): void {
    if (!this._capturePending) return;
    this._capturePending = false;
    const src = game.canvas;
    if (!src) return;
    // WebGL 캔버스는 그리기가 끝나면 버퍼가 비워질 수 있어, 비동기인 toBlob을 바로 걸지 않고 지금 2D 캔버스로
    // 옮겨 둔다(비교판의 P 캡처와 같은 방식)
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    out.getContext('2d')?.drawImage(src, 0, 0);
    const name = `font-probe-${captureFileToken(this._order, this._full, new Date().toISOString())}.png`;
    out.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, name);
      this._say(`저장함: ${name}`);
    }, 'image/png');
  }

  // ---------------------------------------------------------------------------
  // 노드 · 라벨
  // ---------------------------------------------------------------------------

  /** 불러온 폰트 파일. 없으면 null — 라벨은 엔진 기본 글꼴로 그려지고 그 열의 이름표가 알린다. */
  private _ttf(stem: string, weight: number): TTFFont | null {
    return this._loader?.fonts.find((f) => f.stem === stem && f.weight === weight)?.ttf ?? null;
  }

  /** UI_2D 레이어의 빈 노드. 코드로 만든 노드의 기본 레이어는 DEFAULT라 UICamera가 그리지 않는다. */
  private _node(name: string, parent: Node): Node {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    const tr = n.addComponent(UITransform);
    tr.setAnchorPoint(0, 1);
    parent.addChild(n);
    return n;
  }

  /** 띠 · 숫자판 · 안내 글자 — 엔진 기본 글꼴, 왼쪽 위 기준. */
  private _bandLabel(parent: Node, x: number, y: number): Label {
    const n = this._node('BandLabel', parent);
    n.setPosition(x, y);
    const l = n.addComponent(Label);
    l.useSystemFont = true;
    l.fontSize = BAND_FONT;
    l.lineHeight = BAND_LINE;
    l.color = COLOR_BAND_TEXT;
    l.horizontalAlign = Label.HorizontalAlign.LEFT;
    l.verticalAlign = Label.VerticalAlign.TOP;
    l.overflow = Label.Overflow.NONE;
    return l;
  }

  /**
   * 후보 폰트로 그리는 라벨. 줄 높이는 지금 줄 높이 비율의 정수 px다. `width`를 주면 그 폭에서 줄을 바꾸고
   * 높이가 늘어난다(RESIZE_HEIGHT) — 글자를 줄이지 않으면서 실제 줄바꿈과 줄 높이가 보인다. 자동 축소(SHRINK)는
   * 쓰지 않는다. 폭을 안 주면 글자 실제 폭으로 놓인다(NONE). 만든 뒤 바로 다시 그려 크기를 잴 수 있게 한다.
   */
  private _label(
    parent: Node,
    text: string,
    o: {
      size: number;
      font: TTFFont | null;
      width?: number;
      outline?: OutlineStep;
      cache?: number;
      color?: Color;
    },
  ): Label {
    const n = this._node('Text', parent);
    const l = n.addComponent(Label);
    l.horizontalAlign = Label.HorizontalAlign.LEFT;
    l.verticalAlign = Label.VerticalAlign.TOP;
    l.fontSize = o.size;
    l.lineHeight = lineHeightPx(o.size, this._line);
    l.color = o.color ?? COLOR_TEXT;
    l.cacheMode = o.cache ?? Label.CacheMode.NONE;
    if (o.width !== undefined) {
      l.overflow = Label.Overflow.RESIZE_HEIGHT;
      n.getComponent(UITransform)?.setContentSize(o.width, l.lineHeight);
    } else {
      l.overflow = Label.Overflow.NONE;
    }
    const outline = o.outline ?? (this._outline === 'step1' ? 'step1' : 'none');
    l.enableOutline = outline !== 'none';
    if (outline !== 'none') {
      l.outlineWidth = OUTLINE_WIDTH[outline];
      l.outlineColor = COLOR_OUTLINE;
      l.enableShadow = true;
      l.shadowColor = COLOR_SHADOW;
      // CSS 그림자 `0 1px 2px`는 아래로 1px — 엔진은 y를 뒤집어 캔버스에 넘기므로(text-processing.ts:674) -1이다
      l.shadowOffset = new Vec2(0, -1);
      l.shadowBlur = 2;
    } else {
      l.enableShadow = false;
    }
    if (o.font) l.font = o.font;
    else l.useSystemFont = true;
    l.string = text;
    l.updateRenderData(true);
    return l;
  }

  /**
   * 「한 줄」로 정한 줄 하나. 열 폭을 고정하고 넘치면 줄을 바꾸게 둔다(겹침 · 화면 밖보다 낫다).
   * @returns 열 폭에서 두 줄 이상으로 접혔다
   */
  private _oneLine(
    parent: Node,
    text: string,
    size: number,
    font: TTFFont | null,
    width: number,
  ): boolean {
    const l = this._label(parent, text, { size, font, width });
    const h = l.node.getComponent(UITransform)?.height ?? 0;
    return h > l.lineHeight * 1.5;
  }

  /** 여러 줄 문단(열 폭에서 줄을 바꾼다). */
  private _para(
    parent: Node,
    text: string,
    size: number,
    font: TTFFont | null,
    width: number,
    color?: Color,
  ): void {
    this._label(parent, text, { size, font, width, color });
  }

  /** 후보 문자열 가운데 배치한 실제 폭이 가장 넓은 것(1-나 · 1-라는 가장 긴 줄 하나만 둔다). */
  private _widest(texts: readonly string[], size: number, font: TTFFont | null): string {
    const probe = this._measureNode();
    let best = texts[0] ?? '';
    let bestW = -1;
    for (const t of texts) {
      const w = this._label(probe, t, { size, font }).node.getComponent(UITransform)?.width ?? 0;
      if (w > bestW) {
        bestW = w;
        best = t;
      }
    }
    this._clear(probe);
    probe.removeFromParent();
    probe.destroy();
    return best;
  }

  /**
   * 크기를 재는 임시 노드. 화면 밖에 두어 잰 라벨이 한 프레임이라도 보이지 않게 한다.
   */
  private _measureNode(): Node {
    const n = this._node('Measure', this._columnsRoot ?? (this._root as Node));
    n.setPosition(-10000, 0);
    return n;
  }

  /**
   * 자식을 바로 떼고 지운다. `destroy`만 부르면 프레임 끝까지 남아 새 줄과 한 프레임 겹쳐 보인다.
   */
  private _clear(n: Node): void {
    for (const child of [...n.children]) {
      child.removeFromParent();
      child.destroy();
    }
  }

  /** 자식들을 위에서부터 차례로 쌓고(자식 안의 가로 배치는 그대로) 쌓은 높이를 돌려준다. */
  private _stackChildren(n: Node): number {
    let y = 0;
    for (const child of n.children) {
      const h = child.getComponent(UITransform)?.height ?? 0;
      child.setPosition(child.position.x, -y);
      y += h;
    }
    n.getComponent(UITransform)?.setContentSize(COLUMN_W, y);
    return y;
  }

  /** 가로로 놓은 자식들 가운데 가장 높은 것에 노드 높이를 맞춘다. */
  private _fitHeight(n: Node): void {
    const h = Math.max(0, ...n.children.map((c) => c.getComponent(UITransform)?.height ?? 0));
    n.getComponent(UITransform)?.setContentSize(COLUMN_W, h);
  }
}

/** 두 목록의 모든 짝(앞 목록 차례대로). */
function pairs<A, B>(as: readonly A[], bs: readonly B[]): [A, B][] {
  const out: [A, B][] = [];
  for (const a of as) for (const b of bs) out.push([a, b]);
  return out;
}

/** 목록에서 지금 값의 다음 값(끝이면 처음). */
function cycle<T>(list: readonly T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length];
}
