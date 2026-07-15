import { _decorator, Component, director, warn } from 'cc';
import type { EnemyController } from '../components/EnemyController';
import { SpellCaster } from '../components/SpellCaster';
import { GameResult, GameState } from '../data/GameTypes';
import type { ExplosionTarget } from '../logic/ExplosionLogic';
import { accumulateDamage, contactDamagePerTick, tickDamage } from '../logic/PlayerDamageLogic';
import { enemyQueryRadius, SpatialGrid } from '../logic/SpatialGrid';
import { DeathSequence } from '../ui/DeathSequence';
import { DataManager } from './DataManager';
import { DeckManager } from './DeckManager';
import { ExperienceManager } from './ExperienceManager';
import { WaveManager } from './WaveManager';

const { ccclass, property } = _decorator;

/** 공간 그리드 셀 한 변 (월드 단위). 질의 반경을 한두 칸에 담을 크기 — 추후 프로파일링으로 조정. */
const GRID_CELL_SIZE = 128;

/** 플레이어 피격 틱 = 무적 창 길이 T(sec). placeholder — 짧을수록 어려움, 밸런싱 노브(§i-frame). */
const PLAYER_HIT_TICK_SEC = 0.5;

/** DeathSequence 미배선 시 폴백으로 쓰는 죽음 비트 길이(sec). 실제 연출·타이밍은 DeathSequence가 소유한다. */
const DEATH_BEAT_SEC = 0.8;

/** 게임 전체 상태와 플레이어 HP를 관리하는 싱글톤 */
@ccclass('GameManager')
export class GameManager extends Component {
  /** 씬 리로드 시 onDestroy가 null로 되돌리므로 정직하게 nullable이다 (싱글톤 컨벤션 참고). */
  static instance: GameManager | null = null;

  /** 전체 게임 제한 시간 (sec). 0이 되면 승리 */
  @property gameDuration: number = 900;

  /** 사망 시 죽음 비트 연출(오버레이 페이드). 미배선이면 DEATH_BEAT_SEC 폴백. 연출 교체는 이 컴포넌트만 손댄다. */
  @property(DeathSequence) deathSequence: DeathSequence | null = null;

  private _state: GameState = GameState.Playing;
  private _playerHp: number = 0;
  private _maxPlayerHp: number = 0;
  private _gameTimer: number = 0;
  private _started: boolean = false;
  private _enemies: EnemyController[] = [];
  /** 적 충돌·폭발 후보를 빠르게 찾는 공간 그리드. 프레임당 1회 적 위치로 다시 채운다. */
  private readonly _enemyGrid = new SpatialGrid<EnemyController>(GRID_CELL_SIZE);
  /** 매 프레임 update에서 증가. 그리드가 어느 프레임 기준인지 비교하는 토큰(엔진 프레임 API 비의존). */
  private _frameToken: number = 0;
  /** _enemyGrid가 마지막으로 채워진 프레임 토큰. -1이면 아직 미채움. */
  private _gridFrame: number = -1;
  /** 직전 재구축 시점의 최대 적 충돌 반경 — 질의 마진을 매직 넘버 없이 잡는다. */
  private _maxEnemyRadius: number = 0;
  /** 피격 틱 타이머(sec) — PLAYER_HIT_TICK_SEC마다 누적 피해를 1회 적용한다(무적 창). */
  private _hitTickTimer: number = 0;
  /** 현재 피격 틱의 누적 최대 피해 — 그 틱에 들어온 피해원 중 가장 센 한 방만 적용(§i-frame). */
  private _pendingDamageMax: number = 0;
  /** 적 종류별 킬 수 (enemyId → count). EnemyController._startDeath()에서 registerKill로 누적, 결과 화면 스냅샷용. */
  private _killsByType: Record<string, number> = {};

  get state() {
    return this._state;
  }
  get playerHp() {
    return this._playerHp;
  }
  get maxPlayerHp() {
    return this._maxPlayerHp;
  }
  get gameTimer() {
    return this._gameTimer;
  }
  get enemies() {
    return this._enemies;
  }

  onLoad() {
    GameManager.instance = this;
    GameResult.waveReached = 0;
    GameResult.gameVictory = false;
    this._killsByType = {};
  }

  start() {
    const dm = DataManager.instance;
    if (!dm) {
      console.error(
        '[GameManager] DataManager 없음 — 게임을 시작할 수 없습니다. 씬 배선을 확인하세요.',
      );
      this.enabled = false;
      return;
    }
    // 콜백은 씬을 넘어 살아남을 수 있으므로(로딩 중 재시작) 발화 시점에 자신이 유효한지 확인한다.
    dm.onReady(() => {
      if (!this.isValid) return;
      this._onDataReady();
    });
  }

  // 프레임 토큰 증가(그리드 지연 재구축 키) → 전체 게임 타이머를 감소시키고, 0이 되면 승리로 전환해 result 씬으로 보낸다
  update(dt: number) {
    // 가드보다 먼저 증가시켜 프레임당 정확히 한 번 그리드가 재구축되게 한다.
    this._frameToken++;
    if (!this._started) return;
    if (this._state !== GameState.Playing) return;
    // 피격 틱: 이번 틱의 누적 max 피해를 1회 적용한다(무적 창 = 틱 길이).
    this._tickPlayerDamage(dt);
    if (this._state !== GameState.Playing) return; // 피해로 GameOver 전이 시 이후 로직 중단
    this._gameTimer -= dt;
    if (this._gameTimer <= 0) {
      this._gameTimer = 0;
      // waveReached는 결과 화면에 찍히는 장식적 통계라 폴백(0)이 안전하다. 반면 아래 승리
      // 전이는 폴백이 없다 — 여기서 조기 return하면 타이머가 0에 박힌 채 런이 영원히 끝나지
      // 않으므로, 값이 없어도 전이는 반드시 실행한다.
      GameResult.waveReached = WaveManager.instance?.waveNumber ?? 0;
      GameResult.gameVictory = true;
      this._state = GameState.Victory;
      this.goToResult();
    }
  }

  onDestroy() {
    if (GameManager.instance === this) {
      GameManager.instance = null;
    }
  }

  /**
   * 데이터 로드 완료 후 플레이어 HP를 초기화하고 첫 웨이브를 시작한다.
   *
   * **부팅은 전부 성공하거나 전부 실패해야 한다.** 필요한 것(플레이어 데이터·경험치 매니저·
   * 웨이브 매니저)을 먼저 다 받아 두고, 하나라도 없으면 `_started`를 켜지 않은 채 시끄럽게
   * 실패한다. 중간에 빠져나가면 `_started`만 켜진 반쪽 부팅이 되어 — 게임은 돌지만 웨이브가
   * 영영 오지 않고 레벨업 콜백도 안 걸린 상태가 되며, 콘솔에는 아무 단서가 남지 않는다.
   * (클로저 안이라 start()의 내로잉이 여기까지 오지 않으므로 다시 받는다.)
   */
  private _onDataReady() {
    const base = DataManager.instance?.playerData;
    const xp = ExperienceManager.instance;
    const wave = WaveManager.instance;
    if (!base || !xp || !wave) {
      console.error(
        '[GameManager] 부팅 실패 — 플레이어 데이터/ExperienceManager/WaveManager 중 누락이 있어 ' +
          '게임을 시작하지 않습니다. 씬 배선과 resources/data/player.json을 확인하세요.',
      );
      return;
    }
    this._maxPlayerHp = base.maxHp;
    this._playerHp = base.maxHp;
    this._gameTimer = this.gameDuration;
    this._started = true;
    xp.setOnLevelUp(() => this.enterLevelUp());
    wave.startWave();
  }

  /** 활성 적 목록에 등록한다. */
  registerEnemy(enemy: EnemyController): void {
    this._enemies.push(enemy);
  }

  /**
   * 적 종류별 킬을 1 누적한다 — 실제 처치(takeDamage→HP0→_startDeath)에서만 호출한다
   * (despawn/onDestroy 아님 → 오버카운트 없음). 결과 화면 킬 통계의 원천.
   * @param enemyId enemies.json id
   */
  registerKill(enemyId: string): void {
    this._killsByType[enemyId] = (this._killsByType[enemyId] ?? 0) + 1;
  }

  /** 활성 적 목록에서 제거한다. */
  unregisterEnemy(enemy: EnemyController): void {
    const idx = this._enemies.indexOf(enemy);
    if (idx !== -1) this._enemies.splice(idx, 1);
  }

  /**
   * (x, y) 반경 reach 안에 있을 수 있는 적 후보를 돌려준다 (충돌·폭발 광역 1차 선별).
   * 그리드는 프레임당 1회 적 위치로 다시 채워지고(지연 재구축), 질의 반경은 enemyQueryRadius로
   * 최대 적 충돌 반경과 슬랙을 더해 충돌 가능한 적을 빠뜨리지 않는다. 호출 컴포넌트가 같은
   * 프레임의 GameManager.update보다 먼저 돌면 직전 프레임 그리드를 재사용할 수 있어 후보 위치가
   * 최대 약 2프레임 낡을 수 있으나, 슬랙이 그 이동분을 덮는다. 정밀 명중 판정(적별 충돌 반경·
   * 현재 위치)은 호출부가 후보에 대해 다시 한다.
   * @param reach 발사체/폭발의 반경
   * @returns 반경 + 마진 안의 적 후보 (순서 미보장)
   */
  queryEnemiesInRadius(x: number, y: number, reach: number): EnemyController[] {
    this._refreshEnemyGrid();
    return this._enemyGrid.queryRadius(x, y, enemyQueryRadius(reach, this._maxEnemyRadius));
  }

  /**
   * (cx, cy) 반경 안의 적 후보를 명중 판정용으로 수집한다 — 정밀 판정용 `ExplosionTarget`(좌표·충돌
   * 반경·spawnId) 배열과 그에 1:1 대응하는 `EnemyController` 배열을 함께 돌려준다. `queryEnemiesInRadius`
   * (그리드 1차 선별)를 감싸 폭발·노바·궤도 세 호출부가 같은 수집 루프를 공유하게 한다(F16). 정밀 명중·
   * dedup은 호출부가 `selectExplosionHits`로 한다.
   * @param cx 중심 x
   * @param cy 중심 y
   * @param r 질의 반경
   * @returns 후보 적의 ExplosionTarget 배열과 1:1 대응 컨트롤러 배열
   */
  collectTargetsInRadius(
    cx: number,
    cy: number,
    r: number,
  ): { targets: ExplosionTarget[]; ctrls: EnemyController[] } {
    const targets: ExplosionTarget[] = [];
    const ctrls: EnemyController[] = [];
    for (const enemy of this.queryEnemiesInRadius(cx, cy, r)) {
      // 풀로 돌아간 적을 폭발·노바 대상에서 뺀다 — 그리드는 프레임당 1회만 갱신되므로 프레임 도중
      // 회수·사망 반환된 적이 후보로 남는다(isValid는 파괴 여부일 뿐 활성 여부가 아니다).
      if (!enemy?.isValid || !enemy.node.activeInHierarchy) continue;
      const p = enemy.node.position;
      targets.push({ x: p.x, y: p.y, collisionRadius: enemy.collisionRadius, id: enemy.spawnId });
      ctrls.push(enemy);
    }
    return { targets, ctrls };
  }

  /** 프레임이 바뀌었으면 그리드를 현재 적 위치로 다시 채운다(프레임당 1회). 같은 루프에서 최대 적 반경도 갱신. */
  private _refreshEnemyGrid(): void {
    if (this._gridFrame === this._frameToken) return;
    this._gridFrame = this._frameToken;
    this._enemyGrid.clear();
    this._maxEnemyRadius = 0;
    for (const enemy of this._enemies) {
      if (!enemy?.isValid) continue;
      const p = enemy.node.position;
      this._enemyGrid.insert(enemy, p.x, p.y);
      if (enemy.collisionRadius > this._maxEnemyRadius) {
        this._maxEnemyRadius = enemy.collisionRadius;
      }
    }
  }

  /**
   * 버스트 피해(발사체·돌진·휘두르기)를 이번 피격 틱에 제출한다. 즉시 차감하지 않고, 틱마다
   * 누적된 가장 센 피해 1회만 적용한다(전역 i-frame + 틱당 max). 실제 차감은 `_tickPlayerDamage`.
   * @param amount 제출할 버스트 피해
   */
  damagePlayer(amount: number): void {
    if (this._state !== GameState.Playing) return;
    this._pendingDamageMax = accumulateDamage(this._pendingDamageMax, amount);
  }

  /**
   * 접촉(초당 DoT) 피해를 이번 피격 틱에 제출한다. 초당값을 틱 길이로 환산해(`contactDamagePerTick`)
   * 다른 피해원과 같은 틱 max 경쟁에 넣는다. 닿아 있는 동안 매 프레임 제출해도 틱당 max라 멱등이고,
   * 단일 접촉의 평균 피해율(DPS)은 보존된다.
   * @param contactDamagePerSec 적의 초당 접촉 피해
   */
  damagePlayerContact(contactDamagePerSec: number): void {
    if (this._state !== GameState.Playing) return;
    this._pendingDamageMax = accumulateDamage(
      this._pendingDamageMax,
      contactDamagePerTick(contactDamagePerSec, PLAYER_HIT_TICK_SEC),
    );
  }

  /** 피격 틱 타이머를 진행시키고, 틱 경계를 넘으면 그 틱의 누적 max 피해를 1회 적용한다. */
  private _tickPlayerDamage(dt: number): void {
    const r = tickDamage(this._hitTickTimer, this._pendingDamageMax, dt, PLAYER_HIT_TICK_SEC);
    this._hitTickTimer = r.timer;
    this._pendingDamageMax = r.pendingMax;
    if (r.applied > 0) this._applyDamage(r.applied);
  }

  /**
   * HP에서 피해를 깎고 0 이하면 GameOver 상태로 전환한 뒤 죽음 비트를 재생한다. 곧바로 씬을
   * 로드하지 않고 _startDeathSequence에 넘긴다 — GameOver로 전환되면 모든 게임 시스템이 각자의
   * Playing 가드로 멈추고 HudController가 빈 HP 바를 계속 그려, 전장이 멈춘 채 빈 바만 남는
   * 순간에 연출(페이드)이 겹쳐 흐른 뒤 result 씬이 로드된다.
   */
  private _applyDamage(amount: number): void {
    this._playerHp = Math.max(0, this._playerHp - amount);
    if (this._playerHp <= 0) {
      // waveReached는 장식적 통계라 폴백(0)이 안전하다. GameOver 전이와 죽음 연출은 아니다 —
      // 여기서 조기 return하면 HP가 0인데 게임오버도 연출도 일어나지 않는다. 항상 실행한다.
      GameResult.waveReached = WaveManager.instance?.waveNumber ?? 0;
      this._state = GameState.GameOver;
      this._startDeathSequence();
    }
  }

  /**
   * 죽음 비트를 재생한 뒤 result 씬으로 넘긴다. 연출(DeathSequence)이 배선돼 있으면 표현·타이밍을
   * 그쪽에 위임하고(GameManager는 flow만 안다 — 연출을 바꿔도 이 클래스는 불변), 없으면
   * DEATH_BEAT_SEC만큼 지연 후 전환하는 폴백을 쓴다.
   */
  private _startDeathSequence(): void {
    const done = () => this.goToResult();
    if (this.deathSequence) {
      this.deathSequence.play(done);
    } else {
      // 미배선이면 연출 없이 정적 프리즈로 폴백된다 — 세팅 실수가 조용히 묻히지 않도록 경고한다.
      warn('[GameManager] deathSequence 미배선 — 죽음 비트가 정적 프리즈로 폴백됩니다.');
      this.scheduleOnce(done, DEATH_BEAT_SEC);
    }
  }

  /** 레벨업으로 카드 선택을 위해 게임을 일시정지(LevelUp) 상태로 전환한다. */
  enterLevelUp(): void {
    if (this._state !== GameState.Playing) return;
    this._state = GameState.LevelUp;
  }

  /**
   * 카드 HP 보너스(이번 레벨업 증가분)를 적용하고 게임을 재개한다.
   * HP 보너스 계산은 부수적이라 필요한 것이 없으면 건너뛰지만, **재개(Playing 복귀)는 어떤
   * 경우에도 실행한다** — 여기서 빠져나가면 레벨업 상태에 영구히 갇힌다(카드 패널이 열린 채
   * 게임이 멈춘다).
   */
  resumeFromLevelUp(): void {
    if (this._state !== GameState.LevelUp) return;
    const base = DataManager.instance?.playerData;
    const deck = DeckManager.instance;
    if (base && deck) {
      const newMaxHp = base.maxHp + deck.maxHpBonus;
      if (newMaxHp > this._maxPlayerHp) {
        const hpDelta = newMaxHp - this._maxPlayerHp;
        this._maxPlayerHp = newMaxHp;
        this._playerHp = Math.min(this._playerHp + hpDelta, this._maxPlayerHp);
      }
    }
    this._state = GameState.Playing;
    // 웨이브 타이머는 LevelUp 동안 WaveManager.update의 state 가드로 이미 멈춰 있으므로,
    // 재개 시 별도 리셋 없이 그대로 이어서 흐른다. (과거 resumeWave()의 타이머 리셋은
    // 잦은 레벨업마다 타이머를 60초로 되돌려 웨이브가 진행되지 않는 버그를 유발했다.)
  }

  /** ESC로 게임을 수동 일시정지(Paused) 상태로 전환한다. Playing일 때만 동작한다(카드 선택·게임오버 중 무시). */
  enterPause(): void {
    if (this._state !== GameState.Playing) return;
    this._state = GameState.Paused;
  }

  /** 수동 일시정지를 풀고 게임을 재개한다. Paused일 때만 동작한다. 카드 적용이 없어 상태만 되돌린다. */
  resumePause(): void {
    if (this._state !== GameState.Paused) return;
    this._state = GameState.Playing;
  }

  /** result 씬으로 이동한다. 씬 파괴로 매니저가 사라지기 전에 런 통계를 GameResult로 스냅샷한다. */
  goToResult(): void {
    this._snapshotResult();
    director.loadScene('result');
  }

  /**
   * 사망/승리 시점의 런 통계를 GameResult 전역으로 스냅샷한다 — 사망·승리 두 경로가 모두 goToResult를
   * 지나므로 여기 한 곳에서 복사한다(DRY). 이 시점 매니저는 모두 살아 있고 이후 값이 얼어 있다(GameOver/Victory).
   * 매니저 null 가드로 방어한다.
   */
  private _snapshotResult(): void {
    GameResult.survivalSec = this.gameDuration - this._gameTimer;
    GameResult.level = ExperienceManager.instance?.level ?? 1;
    // 적 이름을 지금(메인 씬, DataManager 생존) 해석해 담는다 — result 씬엔 DataManager가 없다.
    // 데이터 미존재 적(getEnemy=null)은 여기서 제외한다(정합 가드).
    const kills: { name: string; count: number }[] = [];
    for (const [id, count] of Object.entries(this._killsByType)) {
      const name = DataManager.instance?.getEnemy(id)?.name;
      if (name == null) continue;
      kills.push({ name, count });
    }
    GameResult.kills = kills;
    const ownedIds = SpellCaster.instance?.loadout.spells ?? [];
    GameResult.spells = DeckManager.instance?.resultSpellSnapshots(ownedIds) ?? [];
    const deck = DeckManager.instance;
    GameResult.passiveHpLevel = deck?.maxHpLevel ?? 0;
    GameResult.passiveHpBonus = deck?.maxHpBonus ?? 0;
    GameResult.passiveMoveLevel = deck?.moveSpeedLevel ?? 0;
    GameResult.passiveMoveBonus = deck?.moveSpeedBonus ?? 0;
    GameResult.passivePickupLevel = deck?.pickupLevel ?? 0;
    GameResult.passivePickupBonus = deck?.pickupRangeBonus ?? 0;
  }

  /** main 씬을 재로드해 게임을 재시작한다. */
  restart(): void {
    director.loadScene('main');
  }

  /** menu 씬으로 이동한다. */
  goToMenu(): void {
    director.loadScene('menu');
  }
}
