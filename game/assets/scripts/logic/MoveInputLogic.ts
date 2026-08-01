/**
 * 이동 입력의 네 축. 화면 좌표 기준이라 `up`은 화면 위쪽이다.
 *
 * 컨트롤러가 cc의 `KeyCode`를 이 이름으로 옮겨서 넘긴다. 이 모듈이 `KeyCode`를 직접 받지
 * 않는 이유는 `logic/`이 cc를 import하지 않는 순수 모듈이기 때문이고, 숫자 코드를 여기에
 * 베껴 두는 대안은 엔진이 값을 바꿨을 때 조용히 어긋난다.
 */
export type MoveKey = 'up' | 'down' | 'left' | 'right';

/** 지금 눌려 있는 것으로 기록된 이동키. 네 축이 서로 독립이라 대각선은 두 축이 동시에 참이다. */
export interface IMoveInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/**
 * 대각선일 때 각 성분에 곱하는 값(1/√2).
 *
 * 두 축을 그대로 1씩 쓰면 벡터 길이가 √2가 되어 대각선 이동이 직선보다 약 1.41배 빨라진다.
 * 그러면 비스듬히 걷는 것이 항상 이득이라 조작이 한쪽으로 굳는다.
 *
 * 이 상수는 이전에 쓰던 `Vec3.normalize()`의 결과와 **완전히 같지는 않다.** 그쪽은
 * `1 / Math.sqrt(2)`를 만들어 곱하는데, 그 값이 `Math.SQRT1_2`와 부동소수 마지막 자리에서
 * 1 ULP(약 1.1e-16) 어긋난다. 프레임당 변위가 그 오차 × 속도 × dt만큼 달라질 뿐이라 화면에
 * 드러나지 않지만, "같은 값"이라고 믿고 정확한 동등성을 단언하는 테스트를 쓰면 그 테스트가
 * 깨진다. 비교가 필요하면 `toBeCloseTo`를 쓴다.
 */
const DIAGONAL_COMPONENT = Math.SQRT1_2;

/** 아무 키도 눌리지 않은 상태를 만든다. */
export function createMoveInputState(): IMoveInputState {
  return { up: false, down: false, left: false, right: false };
}

/**
 * 한 축의 눌림 여부를 기록한다.
 *
 * @param state 갱신할 상태(제자리에서 수정한다)
 * @param key 이동 축
 * @param pressed 눌렸으면 true, 뗐으면 false
 */
export function setMoveKey(state: IMoveInputState, key: MoveKey, pressed: boolean): void {
  state[key] = pressed;
}

/**
 * 눌린 것으로 기록된 이동키를 전부 해제한다.
 *
 * 포커스를 잃을 때 호출한다. Cocos의 웹 키보드 입력은 키 이벤트를 `GameCanvas` 엘리먼트에만
 * 걸기 때문에, 포커스가 캔버스를 떠난 뒤 손을 뗀 `keyup`은 캔버스로 오지 않는다. 그러면 그
 * 키의 기록이 참인 채로 남아 돌아왔을 때 캐릭터가 그 방향으로 계속 걷고, **마주 보는 축이
 * 상쇄되어 반대 방향 키가 먹지 않는다.**
 *
 * 값을 뒤집지 않고 항상 false를 대입하는 것이 중요하다 — 포커스 유실 신호를 여러 개 구독하고
 * 있어 한 번의 전환에서 이 함수가 두세 번 연달아 불릴 수 있는데, 토글이면 두 번째 호출이
 * 눌리지도 않은 키를 켜 버린다.
 *
 * **받아들인 비용:** 키를 계속 누른 채로 포커스가 돌아오면 캐릭터가 멈춘 상태가 된다. 브라우저는
 * 이미 눌려 있는 키의 `keydown`을 다시 보내지 않아서, 여기서 지운 기록을 되살릴 방법이 없기
 * 때문이다. 사용자는 그 키를 한 번 떼었다 다시 눌러야 움직인다. 고치기 전에는 계속 걸었으므로
 * 이 지점만 이전과 동작이 다르지만, 대안은 고착을 그대로 두는 것뿐이라 이쪽을 택했다.
 *
 * @param state 갱신할 상태(제자리에서 수정한다)
 */
export function releaseAllMoveKeys(state: IMoveInputState): void {
  state.up = false;
  state.down = false;
  state.left = false;
  state.right = false;
}

/**
 * 눌린 키 조합에서 이동 방향 벡터를 계산해 `out`에 쓴다.
 *
 * 마주 보는 두 축의 뺄셈이라 위아래를 함께 누르면 그 축은 0이 된다. 대각선(두 축 모두 0이
 * 아닌 경우)에서만 각 성분에 1/√2를 곱해 길이를 1로 맞춘다.
 *
 * 결과 객체를 새로 만들지 않고 `out`에 쓰는 이유는 이 함수가 **매 프레임 호출**되기 때문이다.
 * 프레임마다 객체를 만들면 그만큼 쓰레기 수집 압박이 늘어난다. 호출부는 이미 갖고 있는
 * `Vec3`을 그대로 넘긴다 — `x`·`y`가 숫자 프로퍼티라 구조가 맞는다.
 *
 * **`out`의 다른 필드는 건드리지 않는다.** `Vec3`의 `z`가 그 대상인데, 이동은 평면에서만
 * 일어나므로 이 함수의 관심 밖이다. 나중에 `z`를 쓰는 코드가 생겨도 이 함수가 그 값을 지우지
 * 않는다고 믿어도 된다.
 *
 * @param state 현재 눌린 키
 * @param out 결과를 쓸 대상. `x`·`y`만 덮어쓴다
 */
export function moveInputToVector(state: IMoveInputState, out: { x: number; y: number }): void {
  const x = (state.right ? 1 : 0) - (state.left ? 1 : 0);
  const y = (state.up ? 1 : 0) - (state.down ? 1 : 0);
  // 한 축이라도 0이면 길이가 이미 0이거나 1이라 손댈 필요가 없다. 여기서 조건 없이
  // 정규화하면 무입력(0,0)에서 0으로 나누게 된다.
  if (x !== 0 && y !== 0) {
    out.x = x * DIAGONAL_COMPONENT;
    out.y = y * DIAGONAL_COMPONENT;
    return;
  }
  out.x = x;
  out.y = y;
}
