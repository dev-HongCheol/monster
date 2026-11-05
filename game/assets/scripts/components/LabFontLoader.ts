import { resources, TTFFont } from 'cc';
import {
  type FontStatus,
  fontFaceStatus,
  fontTimedOut,
  type IFontFileInput,
  type IResourceTimingLike,
  matchFontTiming,
} from '../logic/UiFontProbeLogic';

/** 불러올 폰트 파일 하나 — `resources/fonts/<stem>-<weight>.ttf`. */
export interface ILabFontRequest {
  stem: string;
  weight: number;
}

/** 불러온 폰트 파일 하나의 상태. */
export interface ILabFont extends ILabFontRequest {
  ttf: TTFFont | null;
  /** 엔진이 `@font-face`로 등록한 글꼴 이름. 못 불렀으면 null */
  family: string | null;
  /** 다운로드 기록을 찾는 열쇠 */
  nativeUrl: string | null;
  loadStartMs: number;
  loadDoneMs: number | null;
  status: FontStatus;
  timedOut: boolean;
  /** `resources.load`가 실패한 사유 */
  error: string | null;
}

/** 리소스 타이밍 버퍼 크기. 기본 250개라 앞서 받은 파일이 많으면 폰트 항목이 조용히 빠진다. */
const TIMING_BUFFER_SIZE = 2000;

/**
 * 판정 화면 · UI 몫 측정이 함께 쓰는 폰트 로더.
 * 폰트 파일을 `resources.load`로 부르고, 시작 · 완료 시각과 `document.fonts` 상태 · 시간 초과를 적고,
 * 결과 JSON에 넣을 다운로드 기록 재료를 만든다. 판정 규칙(시간 초과 · 기록 찾기)은 `UiFontProbeLogic`이
 * 들고, 이 클래스는 브라우저 · 엔진에서 값을 모으기만 한다.
 */
export class LabFontLoader {
  readonly fonts: ILabFont[];
  /** 리소스 타이밍 버퍼가 찼다 — 결과 JSON에 표시해, 기록을 못 찾은 이유를 가린다 */
  timingBufferFull = false;
  private readonly _onBufferFull = (): void => {
    this.timingBufferFull = true;
  };

  /** @param requests 불러올 파일 목록(화면에 놓는 차례) */
  constructor(requests: readonly ILabFontRequest[]) {
    this.fonts = requests.map((r) => ({
      ...r,
      ttf: null,
      family: null,
      nativeUrl: null,
      loadStartMs: 0,
      loadDoneMs: null,
      status: 'missing',
      timedOut: false,
      error: null,
    }));
  }

  /** 모든 파일의 완료 콜백을 받았다. */
  get done(): boolean {
    return this.fonts.every((f) => f.loadDoneMs !== null);
  }

  /** 완료 콜백을 받은 파일 수. */
  get doneCount(): number {
    return this.fonts.filter((f) => f.loadDoneMs !== null).length;
  }

  /**
   * 모든 파일을 불러온다. 버퍼 크기는 불러오기 직전에 늘린다 — 늘리기 전에 버퍼가 차 있으면 폰트 항목이
   * 들어갈 자리가 없다.
   * @param onDone 모든 파일의 완료 콜백을 받은 뒤 한 번
   */
  load(onDone: () => void): void {
    performance.setResourceTimingBufferSize(TIMING_BUFFER_SIZE);
    performance.addEventListener('resourcetimingbufferfull', this._onBufferFull);
    for (const f of this.fonts) {
      f.loadStartMs = performance.now();
      resources.load(`fonts/${f.stem}-${f.weight}`, TTFFont, (err, ttf) => {
        f.loadDoneMs = performance.now();
        if (err || !ttf) {
          f.error = err ? String(err) : '빈 자산';
          f.status = 'missing';
          f.timedOut = true;
        } else {
          f.ttf = ttf;
          // 엔진이 등록한 이름은 공개 API가 없고 `_nativeAsset` 게터가 돌려준다(ttf-font.ts:51-55).
          // 파일 이름으로 다시 만들면 빌드의 MD5 캐시가 붙인 해시 때문에 틀린다
          f.family = (ttf as unknown as { _nativeAsset: string | null })._nativeAsset;
          f.nativeUrl = ttf.nativeUrl;
          f.status = LabFontLoader.faceStatus(f.family ?? '');
          f.timedOut = fontTimedOut(f.loadStartMs, f.loadDoneMs, f.status);
        }
        if (this.done) onDone();
      });
    }
  }

  /** 결과 JSON에 넣을 폰트 파일 재료 — 다운로드 기록은 지금 버퍼에서 찾는다. */
  fileInputs(): IFontFileInput[] {
    const entries = performance.getEntriesByType('resource') as unknown as IResourceTimingLike[];
    const { matches } = matchFontTiming(
      entries,
      this.fonts.map((f) => ({ nativeUrl: f.nativeUrl ?? '', loadStartMs: f.loadStartMs })),
    );
    return this.fonts.map((f, i) => ({
      stem: f.stem,
      weight: f.weight,
      status: f.status,
      match: f.nativeUrl ? matches[i] : { timing: null, reason: '항목 없음' },
      loadStartMs: f.loadStartMs,
      loadDoneMs: f.loadDoneMs,
      timedOut: f.timedOut,
    }));
  }

  /** 전송 크기 합계. 하나라도 기록을 못 찾으면 null(합계가 작게 나와 상한을 잘못 통과하지 않게). */
  transferTotal(): number | null {
    const entries = performance.getEntriesByType('resource') as unknown as IResourceTimingLike[];
    if (this.fonts.some((f) => !f.nativeUrl)) return null;
    return matchFontTiming(
      entries,
      this.fonts.map((f) => ({ nativeUrl: f.nativeUrl as string, loadStartMs: f.loadStartMs })),
    ).transferTotal;
  }

  /** 버퍼 사건 구독을 거둔다. */
  dispose(): void {
    performance.removeEventListener('resourcetimingbufferfull', this._onBufferFull);
  }

  /** `document.fonts`에서 그 글꼴 이름의 상태를 읽는다. */
  static faceStatus(family: string): FontStatus {
    const faces: { family: string; status: string }[] = [];
    document.fonts.forEach((f) => {
      faces.push({ family: f.family, status: f.status });
    });
    return fontFaceStatus(faces, family);
  }
}
