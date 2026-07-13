import { _decorator, Component, JsonAsset, resources } from 'cc';
import type {
  ICardData,
  IEnemyData,
  IMapData,
  IPlayerBaseData,
  ISpawnTableEntry,
  ISpellData,
  IXPData,
} from '../data/GameTypes';

const { ccclass } = _decorator;

/** JSON 데이터 파일을 로드하고 제공하는 싱글톤 */
@ccclass('DataManager')
export class DataManager extends Component {
  /** 씬 리로드 시 onDestroy가 null로 되돌리므로 정직하게 nullable이다 (싱글톤 컨벤션 참고). */
  static instance: DataManager | null = null;

  private _playerData: IPlayerBaseData | null = null;
  private _spells: ISpellData[] = [];
  private _enemies: IEnemyData[] = [];
  private _spawnTable: ISpawnTableEntry[] = [];
  private _cards: ICardData[] = [];
  private _xpData: IXPData | null = null;
  private _mapData: IMapData | null = null;
  private _isReady = false;
  private _onReadyCallbacks: (() => void)[] = [];

  get isReady() {
    return this._isReady;
  }
  /** 로드 완료(`isReady`) 전에는 null이다 — 캐스트로 지우지 않고 소비처가 가드한다. */
  get playerData(): IPlayerBaseData | null {
    return this._playerData;
  }
  get cards(): ICardData[] {
    return this._cards;
  }
  get spells(): ISpellData[] {
    return this._spells;
  }
  get spawnTable(): ISpawnTableEntry[] {
    return this._spawnTable;
  }
  /** 로드 완료(`isReady`) 전에는 null이다. */
  get xpData(): IXPData | null {
    return this._xpData;
  }
  /** 로드 완료(`isReady`) 전에는 null이다. */
  get mapData(): IMapData | null {
    return this._mapData;
  }

  /** id로 마법 데이터를 반환한다. 없으면 null. */
  getSpell(id: string): ISpellData | null {
    return this._spells.find((s) => s.id === id) ?? null;
  }

  /** id로 적 데이터를 반환한다. 없으면 null. */
  getEnemy(id: string): IEnemyData | null {
    return this._enemies.find((e) => e.id === id) ?? null;
  }

  onLoad() {
    DataManager.instance = this;
    this._loadAll();
  }

  /**
   * 인스턴스를 내리고 **대기 중인 콜백을 버린다.** 후자가 중요하다 — `_loadAll`이 비동기라
   * 로딩 중 재시작하면 이 컴포넌트가 파괴된 뒤에 로드가 끝난다. 그때 남아 있던 콜백은
   * 파괴된 옛 컴포넌트를 붙든 채 발화하고, 그 시점의 `DataManager.instance`는 null이 아니라
   * **새 씬의 인스턴스**라 옵셔널 체이닝으로는 전혀 걸러지지 않는다(멀쩡히 성공해서 죽은
   * 컴포넌트에 쓴다). 목록을 비우고, 콜백 쪽에서도 `this.isValid`로 한 번 더 막는다.
   */
  onDestroy() {
    this._onReadyCallbacks = [];
    if (DataManager.instance === this) {
      DataManager.instance = null;
    }
  }

  /** 데이터 로드 완료 시 cb를 호출한다. 이미 로드된 경우 즉시 호출한다. */
  onReady(cb: () => void) {
    if (this._isReady) {
      cb();
      return;
    }
    this._onReadyCallbacks.push(cb);
  }

  /** 모든 JSON 데이터 파일을 병렬 로드하고 완료 콜백을 실행한다. */
  private async _loadAll() {
    try {
      const [player, spells, enemies, spawnTable, cards, xpData, mapData] = await Promise.all([
        this._load<IPlayerBaseData>('data/player'),
        this._load<ISpellData[]>('data/spells'),
        this._load<IEnemyData[]>('data/enemies'),
        this._load<ISpawnTableEntry[]>('data/spawn-table'),
        this._load<ICardData[]>('data/cards'),
        this._load<IXPData>('data/experience'),
        // 활성 맵은 현재 seoul 고정 — 다중 맵 셀렉터는 이월(계획 §7)
        this._load<IMapData>('data/maps/seoul'),
      ]);
      this._playerData = player;
      this._spells = spells;
      this._enemies = enemies;
      this._spawnTable = spawnTable;
      this._cards = cards;
      this._xpData = xpData;
      this._mapData = mapData;
      this._isReady = true;
      for (const cb of this._onReadyCallbacks) cb();
      this._onReadyCallbacks = [];
    } catch (err) {
      // 실패하면 _isReady가 영영 켜지지 않아 onReady 콜백이 전부 버려진다 — 게임은 켜지지만
      // 웨이브도 마법도 이동도 없는 정지 상태가 되고, 화면엔 아무 단서가 없다. 무엇이 왜
      // 멈췄는지 콘솔에 크게 남긴다(조용한 실패 금지).
      const pending = this._onReadyCallbacks.length;
      this._onReadyCallbacks = [];
      console.error(
        `[DataManager] 게임 데이터 로드 실패 — 게임을 시작할 수 없습니다. ` +
          `대기 중이던 초기화 콜백 ${pending}건을 취소합니다. resources/data/* 를 확인하세요:`,
        err,
      );
    }
  }

  /**
   * resources.load를 Promise로 래핑해 JSON 에셋을 로드한다.
   * `asset`은 Cocos 타입 정의상 non-nullable이지만 실제로는 null이 올 수 있고(타입체크가
   * 강제해 주지 않는다), `JsonAsset.json`도 nullable이라 둘 다 확인한다 — 여기서 null을
   * 흘려보내면 `_playerData` 등이 null인 채로 `_isReady`가 켜져 더 깊은 곳에서 터진다.
   */
  private _load<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      resources.load(path, JsonAsset, (err, asset) => {
        if (err) {
          reject(err);
          return;
        }
        const json = asset?.json;
        if (json == null) {
          reject(new Error(`[DataManager] ${path}: 에셋 또는 json이 비어 있습니다.`));
          return;
        }
        resolve(json as T);
      });
    });
  }
}
