/**
 * i18n 카탈로그 lookup + `{param}` 치환 + 폴백체인 — cc import 없는 순수 로직.
 *
 * 소스 언어(ko)는 키당 객체 `{ message, desc?, params? }`,
 * 타겟 언어(en 등)는 순수 문자열 `{ key: message }`를 가질 수 있다 (기획 § 3.1).
 * `desc`/`params`는 번역 맥락 노트 — 런타임은 `message`만 사용한다.
 */

/** 소스 카탈로그 엔트리 (번역 맥락 메타 포함) */
export interface I18nEntry {
  message: string;
  /** 번역 맥락 노트 (오번역 방지) — 런타임 무시 */
  desc?: string;
  /** 치환 토큰 목록 — 런타임 무시 */
  params?: string[];
}

/** 카탈로그 엔트리: 소스는 객체, 타겟은 문자열 (혼용 허용) */
export type I18nMessage = string | I18nEntry;

/** 한 언어의 카탈로그 (키 → 메시지) */
export type I18nCatalog = Record<string, I18nMessage>;

/** 치환 파라미터 (`{name}` → 값) */
export type I18nParams = Record<string, string | number>;

/** 소스/기본 언어 — 모든 폴백의 최종 목적지 */
export const SOURCE_LANG = 'ko';

const TOKEN_RE = /\{(\w+)\}/g;

/** 카탈로그 lookup·치환·폴백을 담당하는 순수 로직 — cc import 없음 */
export class I18nLogic {
  private _catalogs = new Map<string, I18nCatalog>();
  private _activeLang = SOURCE_LANG;

  /** 현재 활성 언어 */
  get activeLang(): string {
    return this._activeLang;
  }

  /**
   * 한 언어의 카탈로그를 등록한다.
   * @param lang 언어 코드 (예: 'ko', 'en')
   * @param catalog 키 → 메시지 맵
   */
  setCatalog(lang: string, catalog: I18nCatalog): void {
    this._catalogs.set(lang, catalog);
  }

  /**
   * 활성 언어를 전환한다. 카탈로그가 없는 언어로 바꿔도 폴백(ko)으로 동작한다.
   * @param lang 언어 코드
   */
  setLanguage(lang: string): void {
    this._activeLang = lang;
  }

  /**
   * 키를 현재 언어로 해석한다. 미스 시 ko → 키 자체로 폴백한다.
   * @param key 카탈로그 키 (예: 'result.victory')
   * @param params `{name}` 토큰 치환 값 (선택)
   */
  t(key: string, params?: I18nParams): string {
    const message = this._lookup(key);
    if (message === undefined) return key;
    return this._interpolate(message, params);
  }

  /** 활성 언어 → ko 순으로 키를 찾는다. 둘 다 미스면 undefined. */
  private _lookup(key: string): string | undefined {
    const fromActive = this._extract(this._catalogs.get(this._activeLang)?.[key]);
    if (fromActive !== undefined) return fromActive;
    if (this._activeLang !== SOURCE_LANG) {
      const fromSource = this._extract(this._catalogs.get(SOURCE_LANG)?.[key]);
      if (fromSource !== undefined) return fromSource;
    }
    return undefined;
  }

  /** 엔트리에서 message를 뽑는다. 빈 문자열은 미번역으로 보고 미스(undefined) 처리. */
  private _extract(entry: I18nMessage | undefined): string | undefined {
    if (entry === undefined) return undefined;
    const message = typeof entry === 'object' ? entry.message : entry;
    return message === '' ? undefined : message;
  }

  /** `{name}` 토큰을 params 값으로 치환한다. 누락 토큰은 그대로 보존(개발 신호). */
  private _interpolate(message: string, params?: I18nParams): string {
    if (!params) return message;
    return message.replace(TOKEN_RE, (whole, name: string) =>
      name in params ? String(params[name]) : whole,
    );
  }
}
