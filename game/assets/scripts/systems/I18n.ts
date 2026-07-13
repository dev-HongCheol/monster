import { _decorator, Component, JsonAsset, resources } from 'cc';
import { type I18nCatalog, I18nLogic, type I18nParams, SOURCE_LANG } from '../logic/I18nLogic';

const { ccclass, executionOrder } = _decorator;

/** I18n 레지스트리에 등록되는 라벨이 구현해야 하는 갱신 인터페이스 */
export interface ILocalizable {
  /** 활성 언어 기준으로 표시 텍스트를 다시 해석한다. */
  refresh(): void;
}

/** 로드할 언어 카탈로그 (resources/i18n/<lang>.json) */
const LANGS = [SOURCE_LANG, 'en'] as const;

/**
 * 활성 언어를 보유하고 카탈로그를 로드해 t()를 제공하는 싱글톤.
 *
 * 카탈로그가 라벨보다 늦게 올 수 있으므로(async load) 명시적 레지스트리를 둔다 —
 * LocalizedLabel가 onEnable에 등록 / onDisable·onDestroy에 해제하고,
 * onReady·setLanguage 시 레지스트리를 순회해 refresh한다 (이벤트 버스/폴링 없음).
 * DataManager보다 먼저 준비되도록 executionOrder를 앞당긴다.
 */
@ccclass('I18n')
@executionOrder(-1)
export class I18n extends Component {
  static instance: I18n | null = null;

  private _logic = new I18nLogic();
  private _isReady = false;
  private _onReadyCallbacks: (() => void)[] = [];
  private _registry = new Set<ILocalizable>();

  get isReady(): boolean {
    return this._isReady;
  }
  get activeLang(): string {
    return this._logic.activeLang;
  }

  onLoad() {
    I18n.instance = this;
    this._loadAll();
  }

  /**
   * 인스턴스를 내리고 **대기 중인 콜백과 라벨 레지스트리를 비운다.** `_loadAll`이 비동기라
   * 카탈로그 로딩 중 씬을 떠나면 이 컴포넌트가 파괴된 뒤에 로드가 끝나는데, 그때 남아 있던
   * 콜백·라벨은 이미 파괴된 컴포넌트를 붙들고 있다(예: ResultController가 등록한 render가
   * 죽은 Label에 쓴다). DataManager와 같은 부류의 누수라 같은 방식으로 막는다.
   */
  onDestroy() {
    this._onReadyCallbacks = [];
    this._registry.clear();
    if (I18n.instance === this) I18n.instance = null;
  }

  /**
   * 키를 현재 언어로 해석한다. 미스 시 ko → 키 자체로 폴백.
   * 카탈로그 로드 전에는 키 자체를 돌려준다(크래시 없음).
   * @param key 카탈로그 키
   * @param params `{name}` 치환 값 (선택)
   */
  t(key: string, params?: I18nParams): string {
    return this._logic.t(key, params);
  }

  /**
   * 활성 언어를 전환하고 등록된 모든 라벨을 즉시 갱신한다.
   * @param lang 언어 코드 ('ko' | 'en' 등)
   */
  setLanguage(lang: string): void {
    this._logic.setLanguage(lang);
    this._refreshAll();
  }

  /** 라벨을 레지스트리에 등록한다 (LocalizedLabel.onEnable). */
  register(label: ILocalizable): void {
    this._registry.add(label);
  }

  /** 라벨을 레지스트리에서 해제한다 (LocalizedLabel.onDisable/onDestroy). */
  unregister(label: ILocalizable): void {
    this._registry.delete(label);
  }

  /** 카탈로그 로드 완료 시 cb를 호출한다. 이미 준비됐으면 즉시 호출. */
  onReady(cb: () => void): void {
    if (this._isReady) {
      cb();
      return;
    }
    this._onReadyCallbacks.push(cb);
  }

  /** 모든 언어 카탈로그를 병렬 로드한다. 실패해도 t()는 키 폴백으로 동작. */
  private async _loadAll() {
    try {
      const catalogs = await Promise.all(LANGS.map((lang) => this._load(`i18n/${lang}`)));
      LANGS.forEach((lang, i) => {
        this._logic.setCatalog(lang, catalogs[i]);
      });
    } catch (err) {
      console.error('[I18n] 카탈로그 로드 실패:', err);
    }
    this._isReady = true;
    this._refreshAll();
    for (const cb of this._onReadyCallbacks) cb();
    this._onReadyCallbacks = [];
  }

  /** 등록된 모든 라벨을 다시 해석한다. */
  private _refreshAll(): void {
    for (const label of this._registry) label.refresh();
  }

  /**
   * resources.load를 Promise로 래핑해 카탈로그 JSON을 로드한다.
   * `asset`은 Cocos 타입 정의상 non-nullable이지만 실제로는 null이 올 수 있고(타입체크가
   * 강제해 주지 않는다), `JsonAsset.json`도 nullable이라 둘 다 확인한다. 실패해도 t()는
   * 키 폴백으로 계속 동작하므로 여기서는 reject만 하면 된다.
   */
  private _load(path: string): Promise<I18nCatalog> {
    return new Promise((resolve, reject) => {
      resources.load(path, JsonAsset, (err, asset) => {
        if (err) {
          reject(err);
          return;
        }
        const json = asset?.json;
        if (json == null) {
          reject(new Error(`[I18n] ${path}: 에셋 또는 json이 비어 있습니다.`));
          return;
        }
        resolve(json as I18nCatalog);
      });
    });
  }
}
