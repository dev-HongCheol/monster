import { describe, expect, it } from 'vitest';
import { type Facing, facingFromMoveDir } from '../../game/assets/scripts/logic/FacingLogic';
import { footprintOffsetY } from '../../game/assets/scripts/logic/FootprintLogic';

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

/**
 * 이동 충돌 원을 발밑으로 내리는 오프셋 (리워크 2026-07-25).
 *
 * 이동 해소는 반지름 `collisionRadius`인 원 하나로 하는데, 그 원을 노드 원점(= 앵커 0.5,0.5인
 * 스프라이트의 한가운데)에 두면 원의 아래 끝이 발바닥보다 `반높이 - 반지름`만큼 위에 뜬다.
 * 그 차이만큼 캐릭터가 장애물 위쪽 변을 밀고 내려갈 때 다리가 장애물 안으로 잠긴다 —
 * 72×96 그림에 반지름 25면 48 - 25 = 23px, 그림 높이의 24%(정강이까지)다.
 *
 * 그래서 해소에 넘길 원의 중심을 원점에서 아래로 내린다. 오프셋을 캐릭터 데이터로 받지 않고
 * 그림의 반높이에서 유도하는 이유는, 캐릭터(기사 등)가 늘어도 각자의 Content Size가 곧 답이라
 * 사람이 다시 잴 값이 없기 때문이다. 유도가 성립하려면 네 규약이 필요하다 — 앵커 (0.5, 0.5),
 * Trim 켬(발이 상자 바닥에 붙음), 직립 전신, 발이 그림 최하단. 공중에 뜬 캐릭터처럼 이 규약이
 * 깨지는 실루엣이 나오면 그때 캐릭터별 override를 얹는다.
 */
describe('footprintOffsetY — 이동 충돌 원을 발밑으로 내리는 오프셋', () => {
  it('72×96 그림에 반지름 25면 -23을 돌려준다', () => {
    // 반높이 48 - 반지름 25. 리워크를 부른 실측값이다(스크린샷에서 다리가 23px 잠겼다).
    expect(footprintOffsetY(48, 25)).toBe(-23);
  });

  it('원의 아래 끝이 그림의 발바닥과 정확히 맞는다', () => {
    // 오프셋의 정의 자체 — 이 관계가 깨지면 발이 뜨거나(그림자처럼 떠 보임) 잠긴다.
    const halfHeight = 48;
    const radius = 25;
    expect(footprintOffsetY(halfHeight, radius) - radius).toBe(-halfHeight);
  });

  it('그림 크기가 다른 캐릭터는 반높이만으로 오프셋이 따라온다', () => {
    // 기사(120px 그림, 반높이 60)와 마법사(96px)가 같은 반지름을 써도 각자 발이 맞는다.
    // 캐릭터별 튜닝 필드 없이 Content Size 하나로 끝난다는 것이 이 함수의 존재 이유다.
    expect(footprintOffsetY(60, 25)).toBe(-35);
    expect(footprintOffsetY(32, 25)).toBe(-7); // 브릿지 시절 50×64 — 예전 겹침이 7px였던 근거
  });

  it('반지름이 반높이 이상이면 0을 돌려준다', () => {
    // 원이 이미 발바닥까지 덮은 상태다. 여기서 더 내리면 원이 그림 아래로 삐져나와,
    // 캐릭터가 장애물 앞에서 허공을 두고 멈춘다.
    expect(footprintOffsetY(25, 25)).toBe(0);
    expect(footprintOffsetY(20, 25)).toBe(0);
  });

  it('비정상 입력에서는 0을 돌려준다', () => {
    // 0이면 오프셋 없음 = 리워크 이전 동작이다. 그림이 잠깐 어색해질 뿐 이동은 계속 굴러간다.
    // 여기서 NaN을 흘리면 해소 좌표가 통째로 NaN이 돼 캐릭터가 화면에서 사라진다.
    expect(footprintOffsetY(Number.NaN, 25)).toBe(0);
    expect(footprintOffsetY(48, Number.NaN)).toBe(0);
    expect(footprintOffsetY(-48, 25)).toBe(0);
    expect(footprintOffsetY(48, -25)).toBe(0);
    expect(footprintOffsetY(Number.POSITIVE_INFINITY, 25)).toBe(0);
  });
});
