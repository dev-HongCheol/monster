/** 측정 운전 설정. */
export interface IMeasureScheduleOptions {
  /** 차례로 돌 적 수 목록(예: 63 · 200 · 400) */
  counts: readonly number[];
  /** 블록 하나의 길이(초). 10이 아니면 개발용 짧은 블록이라 판정에 쓰지 않는다 */
  blockSec: number;
  /** 블록이 바뀐 뒤 통계에서 뺄 시간(초) — `max(1, 레시피 최대 수명)` */
  discardSec: number;
  /** 목표 적 수를 채우는 대기의 상한(초) */
  fillTimeoutSec: number;
}

export type BlockKind = 'off' | 'on';
export type ScheduleStage = 'fill' | 'block' | 'done';
/** 블록을 무효로 만드는 사건 — 창 가림 · 포커스 잃음 · 캔버스 크기 변경 · 1초를 넘는 간격 */
export type InvalidReason = 'hidden' | 'blur' | 'resize' | 'longFrame';

/** 지나간 · 진행 중인 블록 하나의 기록. */
export interface IBlockRecord {
  count: number;
  kind: BlockKind;
  /** 같은 적 수 안의 블록 번호(0~5) */
  index: number;
  /** 블록이 시작할 때 살아 있던 적 수 — 채우기 상한에 걸리면 목표보다 작다 */
  filledCount: number;
  invalidReasons: InvalidReason[];
}

/** 지금 무엇을 하고 있는지. */
export interface IScheduleState {
  stage: ScheduleStage;
  /** 지금(끝났으면 마지막) 적 수 목표 */
  count: number;
  kind: BlockKind | null;
  blockIndex: number;
  /** 블록 전환 직후라 앞 블록의 알갱이가 남아 있는 구간 */
  discard: boolean;
  /** 이 프레임을 통계에 넣어도 되는가 */
  measuring: boolean;
  filledCount: number;
}

/** 한 적 수 안의 블록 순서. 끔으로 시작해 켬 · 끔을 번갈아 세 번씩 돈다. */
const BLOCK_ORDER: readonly BlockKind[] = ['off', 'on', 'off', 'on', 'off', 'on'];

/** 판정에 쓰는 블록 길이(초). */
const JUDGED_BLOCK_SEC = 10;

/** 이 간격(초)을 넘는 프레임은 탭 전환 · 디버거 정지 같은 사고로 보고 그 블록을 무효로 한다. */
const LONG_FRAME_SEC = 1;

/**
 * 측정 모드의 시간표(계획 2026-10-12-magic-effect-gate-plan.md §6.3). 경과 시간과 사건만 받아
 * 지금 단계 · 블록 종류 · 버릴 구간 · 무효 사유를 정한다. 프레임 통계는 `FrameStatsLogic`이 하고,
 * 이 클래스는 「이 프레임을 어느 블록에 넣나, 넣어도 되나」만 답한다.
 */
export class MeasureSchedule {
  private readonly _opts: IMeasureScheduleOptions;
  private readonly _blocks: IBlockRecord[] = [];
  private _countIndex = 0;
  private _stage: ScheduleStage = 'fill';
  private _blockIndex = 0;
  /** 지금 단계에 들어온 뒤 흐른 시간(초) */
  private _elapsed = 0;
  private _filledCount = 0;

  /** @param opts 측정 운전 설정 */
  constructor(opts: IMeasureScheduleOptions) {
    this._opts = opts;
    if (opts.counts.length === 0) this._stage = 'done';
  }

  /** 지나간 블록과 진행 중인 블록의 기록(시간순). */
  get blocks(): readonly IBlockRecord[] {
    return this._blocks;
  }

  /** 무효 사유가 하나라도 붙은 블록 수. */
  get invalidCount(): number {
    return this._blocks.filter((b) => b.invalidReasons.length > 0).length;
  }

  /** 블록 길이가 판정용(10초)이 아니면 true — 결과와 HUD에 「판정 무효」를 박는다. */
  get devShortBlock(): boolean {
    return this._opts.blockSec !== JUDGED_BLOCK_SEC;
  }

  /** 지금 상태. */
  get state(): IScheduleState {
    const count = this._opts.counts[Math.min(this._countIndex, this._opts.counts.length - 1)] ?? 0;
    const inBlock = this._stage === 'block';
    const discard = inBlock && this._elapsed < this._opts.discardSec;
    return {
      stage: this._stage,
      count,
      kind: inBlock ? BLOCK_ORDER[this._blockIndex] : null,
      blockIndex: this._blockIndex,
      discard,
      measuring: inBlock && !discard,
      filledCount: this._filledCount,
    };
  }

  /**
   * 시간을 dt만큼 진행한다. 프레임마다 한 번 부른다.
   * @param dt 이번 프레임의 간격(초)
   * @param ctx alive = 지금 살아 있는 적 수(채우기 판정에 쓴다)
   */
  tick(dt: number, ctx: { alive: number }): void {
    if (this._stage === 'done') return;
    if (this._stage === 'fill') {
      this._elapsed += dt;
      const target = this.state.count;
      if (ctx.alive >= target || this._elapsed >= this._opts.fillTimeoutSec) {
        this._filledCount = Math.min(ctx.alive, target);
        this._startBlock(0);
      }
      return;
    }
    if (dt > LONG_FRAME_SEC) this._markCurrent('longFrame');
    this._elapsed += dt;
    if (this._elapsed < this._opts.blockSec) return;
    const next = this._blockIndex + 1;
    if (next < BLOCK_ORDER.length) {
      this._startBlock(next);
      return;
    }
    this._countIndex++;
    this._elapsed = 0;
    this._stage = this._countIndex < this._opts.counts.length ? 'fill' : 'done';
  }

  /**
   * 블록을 무효로 만드는 사건을 알린다. 블록 밖(채우기 · 끝)에서 난 사건은 버린다 —
   * 재지 않는 구간이라 통계에 영향이 없다.
   */
  markEvent(reason: Exclude<InvalidReason, 'longFrame'>): void {
    this._markCurrent(reason);
  }

  /** 지금 블록에 무효 사유를 붙인다(같은 사유는 한 번만). */
  private _markCurrent(reason: InvalidReason): void {
    if (this._stage !== 'block') return;
    const cur = this._blocks[this._blocks.length - 1];
    if (!cur.invalidReasons.includes(reason)) cur.invalidReasons.push(reason);
  }

  /** index번째 블록을 시작하고 기록을 하나 더한다. */
  private _startBlock(index: number): void {
    this._stage = 'block';
    this._blockIndex = index;
    this._elapsed = 0;
    this._blocks.push({
      count: this.state.count,
      kind: BLOCK_ORDER[index],
      index,
      filledCount: this._filledCount,
      invalidReasons: [],
    });
  }
}
