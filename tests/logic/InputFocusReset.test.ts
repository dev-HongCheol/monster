import { describe, expect, it } from 'vitest';
import {
  createMoveInputState,
  moveInputToVector,
  releaseAllMoveKeys,
  setMoveKey,
} from '../../game/assets/scripts/logic/MoveInputLogic';

/**
 * 눌린 이동키 상태와 그 해제 (2026-08-01-input-focus-reset-plan.md §4·§6).
 *
 * 이 모듈이 생긴 이유는 F65다. Cocos의 웹 키보드 입력이 `keydown`·`keyup`을 `GameCanvas`
 * 엘리먼트에만 걸기 때문에, 포커스가 캔버스를 떠나면 그 뒤에 손을 뗀 `keyup`이 캔버스로
 * 오지 않는다. 그러면 "이 키가 눌려 있다"는 기록이 참인 채로 남아, 돌아왔을 때 캐릭터가
 * 그 방향으로 계속 걷는다.
 *
 * 증상이 **반대 방향만 죽는** 모양이 되는 이유는 이동 벡터가 마주 보는 두 축의 뺄셈이기
 * 때문이다. 위쪽이 참으로 굳은 상태에서 아래키를 누르면 y가 `1 - 1 = 0`이 되어 제자리에
 * 서고, 좌우는 다른 축이라 이 뺄셈에 끼지 않아 멀쩡히 움직인다.
 *
 * 포커스 유실 그 자체(`window`·캔버스의 `blur`, `Game.EVENT_HIDE` 배선)는 브라우저 환경이
 * 필요해 여기서 다루지 않는다 — 7단계 수동 QA. 여기가 고정하는 것은 **해제가 불렸을 때
 * 상태가 실제로 풀리는가**이고, 그것이 이 슬라이스에서 자동으로 검증 가능한 전부다.
 */

/** 정규화된 대각선 성분. `PlayerController`가 쓰던 `Vec3.normalize()`가 만들던 값과 같다. */
const DIAG = Math.SQRT1_2;

/** 테스트마다 벡터를 새로 만들지 않도록 호출부와 같은 모양의 out 객체를 쓴다. */
function vectorOf(state: ReturnType<typeof createMoveInputState>): { x: number; y: number } {
  const out = { x: Number.NaN, y: Number.NaN };
  moveInputToVector(state, out);
  return out;
}

describe('releaseAllMoveKeys — 포커스를 잃었을 때 눌린 키 풀기', () => {
  it('해제하지 않으면 반대 방향 키가 상쇄돼 제자리에 선다 (버그의 모양)', () => {
    // 이 테스트는 고쳐야 할 동작이 아니라 **버그가 어떻게 생겼는지**를 붙잡아 둔다.
    // 위로 걷던 중 포커스를 잃어 keyup을 못 받은 상태가 여기 첫 줄이고, 돌아와서 아래키를
    // 누른 것이 둘째 줄이다. 두 축이 상쇄돼 y가 0이 되는 것이 사용자가 겪는 "아래키가
    // 안 먹는다"의 정체다. 이 단언이 깨진다면 벡터 계산 규칙 자체가 바뀐 것이므로,
    // 아래 해소 테스트의 전제도 함께 다시 봐야 한다.
    const state = createMoveInputState();
    setMoveKey(state, 'up', true); // 포커스 유실로 해제되지 못한 채 남은 기록
    setMoveKey(state, 'down', true);

    expect(vectorOf(state).y).toBe(0);
  });

  it('해제한 뒤에는 반대 방향 키가 즉시 먹는다', () => {
    // 이 슬라이스의 중심 단언이다. 위와 같은 순서에 해제만 끼워 넣었고, 그 결과 아래키가
    // 온전히 반영돼야 한다. 여기가 깨지면 사용자는 창을 전환하고 돌아올 때마다 캐릭터가
    // 한 방향으로 걸어가는 것을 손으로 풀어야 한다(같은 키를 한 번 눌렀다 떼기).
    const state = createMoveInputState();
    setMoveKey(state, 'up', true);

    releaseAllMoveKeys(state);
    setMoveKey(state, 'down', true);

    expect(vectorOf(state).y).toBe(-1);
  });

  it('네 축이 모두 눌려 있어도 한 번에 전부 풀린다', () => {
    // 포커스는 키 하나만 눌린 순간에 떠나지 않는다. 대각선으로 달리는 중이면 두 개,
    // 반대 키를 겹쳐 쥐고 있으면 네 개가 참일 수 있다. 일부만 푸는 구현이면 남은 축이
    // 그대로 고착된다.
    const state = createMoveInputState();
    for (const key of ['up', 'down', 'left', 'right'] as const) {
      setMoveKey(state, key, true);
    }

    releaseAllMoveKeys(state);

    expect(state).toEqual({ up: false, down: false, left: false, right: false });
  });

  it('아무것도 눌리지 않은 상태에서 해제해도 달라지지 않는다', () => {
    // 포커스 유실 신호를 세 개(창 blur·캔버스 blur·EVENT_HIDE) 걸기 때문에 한 번의
    // 전환에서 해제가 두세 번 연달아 불릴 수 있다. 여기서 값을 뒤집는 구현(토글 등)이면
    // 두 번째 호출이 눌리지도 않은 키를 켜 버린다.
    const state = createMoveInputState();

    releaseAllMoveKeys(state);
    releaseAllMoveKeys(state);

    expect(state).toEqual({ up: false, down: false, left: false, right: false });
  });
});

describe('moveInputToVector — 눌린 키 조합에서 이동 방향 벡터 뽑기', () => {
  it('단일 축 입력은 성분이 정확히 1이다', () => {
    const state = createMoveInputState();
    setMoveKey(state, 'right', true);
    expect(vectorOf(state)).toEqual({ x: 1, y: 0 });

    releaseAllMoveKeys(state);
    setMoveKey(state, 'up', true);
    expect(vectorOf(state)).toEqual({ x: 0, y: 1 });
  });

  it('화면 좌표를 따른다 — 위쪽이 y 양수, 왼쪽이 x 음수', () => {
    // 이 부호 규약이 뒤집히면 `facingFromMoveDir`가 정면과 뒷모습을 바꿔 판정해,
    // 위로 걸을 때 캐릭터가 카메라를 쳐다본다.
    const state = createMoveInputState();
    setMoveKey(state, 'down', true);
    setMoveKey(state, 'left', true);
    expect(vectorOf(state)).toEqual({ x: -DIAG, y: -DIAG });
  });

  it('대각선은 각 성분이 1/√2라 속도가 √2배로 빨라지지 않는다', () => {
    // 정규화를 빼먹으면 대각선으로 달리는 것이 직선보다 약 1.41배 빨라져, 플레이어가
    // 항상 비스듬히 움직이는 것이 최적 전략이 된다.
    const state = createMoveInputState();
    setMoveKey(state, 'right', true);
    setMoveKey(state, 'up', true);

    const out = vectorOf(state);

    expect(out.x).toBeCloseTo(DIAG, 12);
    expect(out.y).toBeCloseTo(DIAG, 12);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1, 12);
  });

  it('마주 보는 두 축을 함께 누르면 그 축은 0이다', () => {
    const state = createMoveInputState();
    setMoveKey(state, 'up', true);
    setMoveKey(state, 'down', true);
    setMoveKey(state, 'right', true);

    // y가 상쇄되고 x만 남으므로 대각선이 아니라 단일 축 취급이다 — 성분이 1이어야 한다.
    expect(vectorOf(state)).toEqual({ x: 1, y: 0 });
  });

  it('아무 키도 눌리지 않으면 두 성분 모두 0이다', () => {
    expect(vectorOf(createMoveInputState())).toEqual({ x: 0, y: 0 });
  });

  it('키를 떼면 그 축이 벡터에서 빠진다', () => {
    const state = createMoveInputState();
    setMoveKey(state, 'right', true);
    setMoveKey(state, 'up', true);
    setMoveKey(state, 'up', false);

    expect(vectorOf(state)).toEqual({ x: 1, y: 0 });
  });

  it('같은 out 객체를 다시 넘겨도 이전 값이 남지 않는다', () => {
    // 호출부는 매 프레임 같은 `_moveDir`을 넘긴다(프레임마다 객체를 새로 만들지 않으려는
    // 의도적 설계). 두 성분 중 하나만 쓰는 구현이면 직전 프레임 값이 남아, 키를 뗐는데도
    // 캐릭터가 그 방향으로 계속 미끄러진다.
    const state = createMoveInputState();
    setMoveKey(state, 'right', true);
    setMoveKey(state, 'up', true);
    const out = { x: 0, y: 0 };
    moveInputToVector(state, out);

    releaseAllMoveKeys(state);
    moveInputToVector(state, out);

    expect(out).toEqual({ x: 0, y: 0 });
  });

  it('out에 z 같은 다른 필드가 있어도 건드리지 않는다', () => {
    // 호출부가 넘기는 것은 Vec3이고 그 z는 이 함수의 관심 밖이다. 여기서 z를 0으로
    // 덮어쓰든 말든 현재 동작은 같지만, 계약을 테스트로 박아 두면 나중에 z를 쓰는 코드가
    // 생겼을 때 이 함수가 그 값을 지우는지 아닌지를 두고 헤매지 않는다.
    const state = createMoveInputState();
    setMoveKey(state, 'right', true);
    const out = { x: 0, y: 0, z: 7 };
    moveInputToVector(state, out);

    expect(out.z).toBe(7);
  });
});
