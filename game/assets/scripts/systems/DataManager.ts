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
  /** 씬 리로드 시 onDestroy가 null로 되돌리므로 실제로는 nullable — 타입 정직화는 F24. */
  static instance: DataManager = null as unknown as DataManager;

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
  get playerData(): IPlayerBaseData {
    return this._playerData as IPlayerBaseData;
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
  get xpData(): IXPData {
    return this._xpData as IXPData;
  }
  get mapData(): IMapData {
    return this._mapData as IMapData;
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

  onDestroy() {
    if (DataManager.instance === this) {
      DataManager.instance = null as unknown as DataManager;
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
      console.error('[DataManager] 게임 데이터 로드 실패:', err);
    }
  }

  /** resources.load를 Promise로 래핑해 JSON 에셋을 로드한다. */
  private _load<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      resources.load(path, JsonAsset, (err, asset) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(asset.json as T);
      });
    });
  }
}
