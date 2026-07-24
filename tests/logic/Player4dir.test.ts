import { describe, expect, it } from 'vitest';
import { type Facing, facingFromMoveDir } from '../../game/assets/scripts/logic/FacingLogic';

/**
 * 플레이어가 바라보는 4방향 판정 순수 로직 (2026-07-24-player-4dir-plan.md §4).
 *
 * 입력은 `PlayerController._updateMoveDir()`가 만든 이동 방향 벡터다. 그 메서드는 키 플래그의
 * 차(-1·0·1)로 벡터를 만들고 길이가 1을 넘으면 정규화하므로, 대각선에서는 x와 y의 절댓값이
 * 정확히 같은 값(1/√2 ≈ 0.707)이 된다 — 우세 축을 크기로 가릴 수 없어 동률 규칙이 필요하다.
 *
 * 방향의 원천은 실제 변위가 아니라 이 입력 의도다. `_move()`는 장애물 해소와 아레나 클램프를
 * 거쳐 위치를 정하므로 벽을 밀고 있으면 입력이 있어도 변위가 0에 가까워지고, 변위로 방향을
 * 뽑으면 벽에 닿는 순간 바라보던 방향을 잃는다 — 원거리 플레이어가 벽을 등지고 쏠 때 캐릭터가
 * 제 방향을 놓고 튄다.
 *
 * 화면 좌표 기준이라 y가 양수면 위쪽이므로 뒷모습(back), 음수면 아래쪽이므로 정면(front)이다.
 *
 * 스프라이트 프레임 교체 배선(`PlayerController`가 방향이 바뀔 때만 `Sprite.spriteFrame`을
 * 갈아끼우는 것)과 네 프레임의 피벗·크기 정합은 cc·에셋 의존이라 여기서 다루지 않는다
 * (7단계 수동 QA).
 */

// 정규화된 대각선 성분 — _updateMoveDir()의 normalize()가 실제로 만드는 값과 같다.
const DIAG = Math.SQRT1_2;

const ALL_FACINGS: Facing[] = ['front', 'back', 'left', 'right'];

describe('facingFromMoveDir — 이동 입력에서 바라보는 방향 뽑기', () => {
  it('오른쪽 입력은 right', () => {
    expect(facingFromMoveDir(1, 0, 'front')).toBe('right');
  });

  it('왼쪽 입력은 left', () => {
    expect(facingFromMoveDir(-1, 0, 'front')).toBe('left');
  });

  it('위쪽 입력은 back (카메라에 등을 보인다)', () => {
    expect(facingFromMoveDir(0, 1, 'front')).toBe('back');
  });

  it('아래쪽 입력은 front (카메라를 향한다)', () => {
    expect(facingFromMoveDir(0, -1, 'back')).toBe('front');
  });

  it('입력이 없으면 직전 방향을 그대로 유지한다', () => {
    // 멈출 때마다 정면으로 되돌리면 걷다 서는 매 순간 캐릭터가 홱 돌아본다.
    for (const prev of ALL_FACINGS) {
      expect(facingFromMoveDir(0, 0, prev)).toBe(prev);
    }
  });

  it('정규화된 대각선 네 조합은 모두 가로로 판정한다', () => {
    // x와 y의 절댓값이 같아 우세 축이 없다. 규칙 없이 두면 부동소수 비교 결과에 따라
    // 좌우와 상하가 프레임마다 흔들린다. 마법사는 모자·지팡이 옆모습이 정면·후면보다
    // 잘 읽히므로 동률이면 가로를 택한다.
    expect(facingFromMoveDir(DIAG, DIAG, 'front')).toBe('right');
    expect(facingFromMoveDir(DIAG, -DIAG, 'front')).toBe('right');
    expect(facingFromMoveDir(-DIAG, DIAG, 'front')).toBe('left');
    expect(facingFromMoveDir(-DIAG, -DIAG, 'front')).toBe('left');
  });

  it('정규화 전 정수 대각선도 같은 동률 규칙을 따른다', () => {
    // 호출부가 정규화를 건너뛰어도 판정이 흔들리지 않아야 한다(비율만 보고 크기는 안 본다).
    expect(facingFromMoveDir(1, 1, 'front')).toBe('right');
    expect(facingFromMoveDir(-1, -1, 'front')).toBe('left');
  });

  it('가로 성분이 우세하면 좌우로 판정한다', () => {
    expect(facingFromMoveDir(1, 0.5, 'front')).toBe('right');
    expect(facingFromMoveDir(-1, -0.5, 'front')).toBe('left');
  });

  it('세로 성분이 우세하면 상하로 판정한다', () => {
    expect(facingFromMoveDir(0.5, 1, 'front')).toBe('back');
    expect(facingFromMoveDir(-0.5, -1, 'front')).toBe('front');
  });

  it('직전 방향은 입력이 있을 때의 판정에 영향을 주지 않는다', () => {
    // 유지는 입력이 0일 때만 하는 일이다. 입력이 있는데 prev가 결과를 끌어당기면
    // 방향을 꺾어도 캐릭터가 이전 방향에 붙어 있게 된다.
    for (const prev of ALL_FACINGS) {
      expect(facingFromMoveDir(0, 1, prev)).toBe('back');
    }
  });
});
