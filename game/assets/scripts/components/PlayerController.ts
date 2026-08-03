import {
  _decorator,
  Component,
  type EventKeyboard,
  Game,
  game,
  Input,
  input,
  KeyCode,
  Sprite,
  SpriteFrame,
  sys,
  UITransform,
  Vec3,
} from 'cc';
import { GameState, type IPlayerBaseData } from '../data/GameTypes';
import { type Facing, facingFromMoveDir } from '../logic/FacingLogic';
import { resolveMoveAtFootprint } from '../logic/FootprintLogic';
import {
  createMoveInputState,
  type IMoveInputState,
  type MoveKey,
  moveInputToVector,
  releaseAllMoveKeys,
  setMoveKey,
} from '../logic/MoveInputLogic';
import { NO_OBSTACLES } from '../logic/ObstacleLogic';
import { playerSpeedMulAt } from '../logic/RegionLogic';
import { DataManager } from '../systems/DataManager';
import { DeckManager } from '../systems/DeckManager';
import { GameManager } from '../systems/GameManager';
import { MapManager } from '../systems/MapManager';

const { ccclass, property } = _decorator;

/** 플레이어 이동, 바라보는 방향, HP 연동을 담당하는 컴포넌트. 자동 발사는 SpellCaster가 담당한다. */
@ccclass('PlayerController')
export class PlayerController extends Component {
  // 네 방향 정지 프레임. 배열 하나로 받지 않고 이름별로 두는 이유는, 배열이면 에디터에서
  // 순서를 잘못 끼워도 아무 에러 없이 통과해 위로 걸을 때 왼쪽 그림이 뜨는 식으로 어긋나기
  // 때문이다. 이름 슬롯은 어긋나면 눈으로 바로 보인다.
  /** 정면 — 카메라를 향해 선 그림(화면 아래쪽으로 걸을 때). */
  @property(SpriteFrame) frameFront: SpriteFrame | null = null;
  /** 뒷모습 — 화면 위쪽으로 걸어갈 때. */
  @property(SpriteFrame) frameBack: SpriteFrame | null = null;
  @property(SpriteFrame) frameLeft: SpriteFrame | null = null;
  @property(SpriteFrame) frameRight: SpriteFrame | null = null;

  private _moveDir: Vec3 = new Vec3();
  /** 같은 노드의 Sprite — 방향이 바뀔 때 이 컴포넌트의 `spriteFrame`을 갈아끼운다. */
  private _sprite: Sprite | null = null;
  /** 현재 바라보는 방향. 프레임 교체 여부를 이 값과 새 판정의 비교로 정한다. */
  private _facing: Facing = 'front';
  private _dataReady = false;
  /** 데이터 준비 시 잡아 두는 플레이어 기본 스탯 — 매 프레임 싱글톤을 역참조하지 않게 한다. */
  private _base: IPlayerBaseData | null = null;
  /** 그림의 반높이(px) — 이동 충돌 원을 발밑으로 내릴 거리의 입력(FootprintLogic). 0이면 오프셋 없음. */
  private _halfHeight = 0;

  /** 지금 눌려 있는 이동키. 포커스를 잃으면 통째로 해제된다(`_onFocusLost`). */
  private _moveInput: IMoveInputState = createMoveInputState();

  // 키 입력·포커스 유실 구독 + 같은 노드의 Sprite·그림 크기 캐시 → 초기 방향(front) 프레임
  // 1회 적용. 초기 프레임을 코드가 정하는 이유는, 씬에 물려 둔 `Sprite.spriteFrame`이 에디터
  // 작업 중 다른 방향으로 바뀌어 있으면 `_facing`은 front인데 화면엔 옆모습이 뜨는 불일치가
  // 나기 때문이다. 그 상태에서 처음 좌우로 걸으면 방향이 안 바뀐 것처럼 보인다.
  onLoad() {
    input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
    // 브라우저에서 포커스를 잃는 사건이 둘로 갈리므로 신호도 둘을 듣는다. `window`의 blur는
    // **창 전체**가 포커스를 잃을 때만 뜨는데, 캔버스는 `tabindex`가 붙어 독립적으로 포커스를
    // 갖기 때문에 페이지 안에서 캔버스 바깥을 클릭하면 창은 포커스를 유지한 채 캔버스만 잃는다.
    // 그때도 keyup은 오지 않으므로 창 신호만 들으면 그 경로가 통째로 새 나간다.
    if (sys.isBrowser) window.addEventListener('blur', this._onFocusLost);
    game.canvas?.addEventListener('blur', this._onFocusLost);
    // 브라우저가 아닌 플랫폼에는 위 둘이 없다. v1(웹)에서는 창 blur와 겹쳐 실행되지 않는
    // 방어이고, 네이티브 빌드에서 백그라운드로 들어갈 때가 이 신호의 유일한 무대다.
    game.on(Game.EVENT_HIDE, this._onFocusLost, this);
    this._sprite = this.getComponent(Sprite);
    // 반높이는 여기서 한 번만 잡는다 — 네 방향 프레임이 Size Mode CUSTOM인 같은 상자에 그려지므로
    // 방향이 바뀌어도 값이 변하지 않는다. UITransform이 없으면 0이 남아 오프셋도 0이 되고,
    // 이동은 리워크 이전과 똑같이 노드 원점 기준으로 굴러간다.
    this._halfHeight = (this.getComponent(UITransform)?.height ?? 0) / 2;
    this._applyFacingFrame();
  }

  start() {
    const dm = DataManager.instance;
    if (!dm) {
      console.error(
        '[PlayerController] DataManager 없음 — 이동을 비활성화합니다. 씬 배선을 확인하세요.',
      );
      this.enabled = false;
      return;
    }
    // 콜백은 씬을 넘어 살아남을 수 있으므로(로딩 중 재시작) 발화 시점에 자신이 유효한지 확인하고,
    // 클로저 안에서는 내로잉이 살아남지 않으므로 데이터를 다시 받아 필드에 잡아 둔다.
    dm.onReady(() => {
      if (!this.isValid) return;
      const base = DataManager.instance?.playerData;
      if (!base) {
        console.error('[PlayerController] 플레이어 데이터 없음 — 이동이 동작하지 않습니다.');
        return;
      }
      this._base = base;
      this._dataReady = true;
    });
  }

  // 등록과 해제의 가드 모양을 똑같이 맞춘다. `sys.isBrowser`가 실행 중에 바뀌지는 않지만,
  // 두 곳의 조건이 눈으로 봐서 같아야 한쪽만 걸려 리스너가 남는 실수를 리뷰에서 잡을 수 있다.
  onDestroy() {
    input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
    if (sys.isBrowser) window.removeEventListener('blur', this._onFocusLost);
    game.canvas?.removeEventListener('blur', this._onFocusLost);
    game.off(Game.EVENT_HIDE, this._onFocusLost, this);
  }

  // 데이터 준비 + Playing 상태일 때만 키 입력으로 이동 방향을 계산해, 바라보는 방향을 갱신하고
  // 이동시킨다. Playing이 아니면 여기서 빠지므로 일시정지·레벨업 중엔 방향도 함께 얼어붙는다.
  update(dt: number) {
    if (!this._dataReady) return;
    const gm = GameManager.instance;
    if (!gm) return;
    if (gm.state !== GameState.Playing) return;

    this._updateMoveDir();
    this._updateFacing();
    this._move(dt);
  }

  /** 키 입력으로 이동 방향 플래그를 활성화한다. */
  private _onKeyDown(e: EventKeyboard): void {
    const key = PlayerController._moveKeyOf(e.keyCode);
    if (key) setMoveKey(this._moveInput, key, true);
  }

  /** 키 해제로 이동 방향 플래그를 비활성화한다. */
  private _onKeyUp(e: EventKeyboard): void {
    const key = PlayerController._moveKeyOf(e.keyCode);
    if (key) setMoveKey(this._moveInput, key, false);
  }

  /**
   * 포커스를 잃으면 눌린 것으로 기록된 이동키를 전부 해제한다.
   *
   * 메서드가 아니라 화살표 프로퍼티인 이유는 `removeEventListener`가 **등록할 때와 같은 함수
   * 참조**를 받아야 리스너를 지우기 때문이다. 등록 시점에 `bind`로 만들면 매번 새 함수가 나와
   * `onDestroy`가 아무것도 못 지우고, 씬을 다시 로드할 때마다 죽은 컴포넌트를 붙든 리스너가
   * 쌓인다.
   */
  private _onFocusLost = (): void => {
    releaseAllMoveKeys(this._moveInput);
  };

  /** 이동에 쓰는 키를 축 이름으로 옮긴다. 이동과 무관한 키는 null. 상태가 아니라 조회 표다. */
  private static _moveKeyOf(keyCode: number): MoveKey | null {
    switch (keyCode) {
      case KeyCode.KEY_W:
      case KeyCode.ARROW_UP:
        return 'up';
      case KeyCode.KEY_S:
      case KeyCode.ARROW_DOWN:
        return 'down';
      case KeyCode.KEY_A:
      case KeyCode.ARROW_LEFT:
        return 'left';
      case KeyCode.KEY_D:
      case KeyCode.ARROW_RIGHT:
        return 'right';
      default:
        return null;
    }
  }

  /** 키 플래그 상태로 이동 방향 벡터를 계산한다. */
  private _updateMoveDir(): void {
    // 대각선 정규화도 이 함수 안에서 끝난다(MoveInputLogic). `_moveDir.z`는 건드리지 않는데,
    // 생성 시 0이고 이동이 평면에서만 일어나 그 값을 바꾸는 코드가 없기 때문이다.
    moveInputToVector(this._moveInput, this._moveDir);
  }

  /** 이동 입력에서 바라볼 방향을 판정하고, 방향이 바뀐 프레임에만 그림을 갈아끼운다. */
  private _updateFacing(): void {
    const next = facingFromMoveDir(this._moveDir.x, this._moveDir.y, this._facing);
    // 같은 방향이면 대입 자체를 하지 않는다 — 엔진이 같은 값 대입을 걸러 주는지에 기대지 않고,
    // 교체가 일어나는 지점을 "방향이 바뀐 프레임" 하나로 좁혀 둔다.
    if (next === this._facing) return;
    this._facing = next;
    this._applyFacingFrame();
  }

  /** 현재 `_facing`에 해당하는 프레임을 Sprite에 적용한다. */
  private _applyFacingFrame(): void {
    const sprite = this._sprite;
    if (!sprite) return;
    const frame = this._frameFor(this._facing);
    // 미연결 슬롯이면 직전 그림을 그대로 둔다. null을 대입하면 그 방향으로 걷는 동안 캐릭터가
    // 화면에서 사라져, 연결을 하나 빼먹은 것이 "플레이어가 투명해지는" 버그로 보인다.
    if (!frame) return;
    sprite.spriteFrame = frame;
  }

  /** 방향에 대응하는 프레임을 돌려준다. 에디터에서 연결하지 않은 슬롯은 null이다. */
  private _frameFor(facing: Facing): SpriteFrame | null {
    switch (facing) {
      case 'front':
        return this.frameFront;
      case 'back':
        return this.frameBack;
      case 'left':
        return this.frameLeft;
      case 'right':
        return this.frameRight;
    }
  }

  /** 이동 방향으로 플레이어를 이동시킨다. 매 프레임 이동속도 패시브 보너스를 곱해 라이브 반영한다. */
  private _move(dt: number): void {
    // _dataReady가 켜졌다면 _base는 반드시 있다(같은 콜백에서 함께 세운다). 보너스가 없을 때의 0은
    // "보너스 없음"이라는 옳은 중립값이라 폴백이 안전하다 — 기본 속도는 그대로 유지된다.
    const base = this._base;
    if (!base) return;
    const pos = this.node.position;
    // MapManager를 진입부에서 1회 받는다 — 물 배율과 아레나 클램프가 같은 싱글톤을 본다(컨벤션 §싱글톤 소비).
    const mm = MapManager.instance;
    // 물속에선 플레이어만 감속한다(적 무영향). 현재 위치로 판정 — 이번 프레임 속도는 지금 물에
    // 있느냐로 정한다. 물 밖이거나 맵 로드 전이면 배율 1.0이라 기존 이동이 그대로 유지된다.
    const waterMul = playerSpeedMulAt(pos, mm?.regions ?? []);
    const speed = base.speed * (1 + (DeckManager.instance?.moveSpeedBonus ?? 0)) * waterMul;
    const nextX = pos.x + this._moveDir.x * speed * dt;
    const nextY = pos.y + this._moveDir.y * speed * dt;
    const radius = base.collisionRadius;
    // 이동 제약은 발밑 접지점에서 풀고 원점 좌표로 되돌려 받는다(FootprintLogic) — 앵커가
    // (0.5, 0.5)라 노드 원점이 캐릭터 한가운데에 있어, 충돌 원을 원점에 두면 원의 아래 끝이
    // 발바닥보다 `반높이 - 반지름`만큼 위에 떠 그만큼 다리가 장애물에 잠긴 채 멈춘다
    // (72×96·반지름 25에서 23px). 좌표계를 오가는 순서와 아레나 클램프를 원점 기준으로 두는
    // 결정은 그 순수 함수가 들고 있다 — 여기서 풀어 쓰면 화면에 안 드러나는 실패(아레나 경계가
    // 통째로 밀리는 것)를 자동 테스트가 못 잡는다. 장애물 해소와 아레나 클램프의 순서, 그 순서를
    // 안전하게 만드는 맵 배치 제약도 같은 이유로 그쪽 JSDoc에 있다.
    const resolved = resolveMoveAtFootprint(
      pos,
      { x: nextX, y: nextY },
      radius,
      this._halfHeight,
      mm?.obstacles ?? NO_OBSTACLES,
      mm?.arena ?? null,
    );
    this.node.setPosition(resolved.x, resolved.y, pos.z);
  }
}
