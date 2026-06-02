import { _decorator, Component, Label } from 'cc';
import { I18n, type ILocalizable } from '../systems/I18n';

const { ccclass, property } = _decorator;

/**
 * 정적 씬 라벨을 카탈로그 키로 현지화하는 UI 래퍼.
 *
 * `key`(+ 선택 `params`)를 같은 노드의 Label에 `t()`로 해석해 채운다.
 * onEnable에 I18n 레지스트리 등록 + 즉시 1회 resolve → 카탈로그가 늦게 와도
 * onReady/setLanguage 시 refresh로 갱신된다. params는 어순 데모용 정적 치환만 지원
 * (런타임 동적 값은 코드에서 직접 t() 호출 — HudController 등).
 */
@ccclass('LocalizedLabel')
export class LocalizedLabel extends Component implements ILocalizable {
  @property({ tooltip: '카탈로그 키 (예: menu.play)' })
  key = '';

  /** `{name}=value` 형식의 정적 치환 파라미터 (선택, 줄당 하나) */
  @property({ type: [String], tooltip: '정적 치환: name=value (한 줄에 하나)' })
  params: string[] = [];

  private _label: Label | null = null;

  onEnable() {
    this._label = this.getComponent(Label);
    if (!this._label) {
      console.warn(`[LocalizedLabel] Label 컴포넌트 없음 (key=${this.key})`);
      return;
    }
    I18n.instance?.register(this);
    this.refresh();
  }

  onDisable() {
    I18n.instance?.unregister(this);
  }

  /** 활성 언어 기준으로 Label.string을 다시 채운다. */
  refresh(): void {
    if (!this._label) return;
    const i18n = I18n.instance;
    this._label.string = i18n ? i18n.t(this.key, this._parseParams()) : this.key;
  }

  /** `name=value` 문자열 배열을 치환 파라미터 객체로 파싱한다. */
  private _parseParams(): Record<string, string> | undefined {
    if (this.params.length === 0) return undefined;
    const out: Record<string, string> = {};
    for (const entry of this.params) {
      const eq = entry.indexOf('=');
      if (eq > 0) out[entry.slice(0, eq).trim()] = entry.slice(eq + 1).trim();
    }
    return out;
  }
}
