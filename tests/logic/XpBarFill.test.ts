import { describe, expect, it } from 'vitest';
import { barFillStartX } from '../../game/assets/scripts/logic/HudFormatLogic';

// Widget이 바를 늘린 뒤에도 채움이 바 왼쪽 끝에서 시작하려면, 채움 노드의 x가
// 늘어난 폭 기준으로 다시 계산돼야 한다(엔진은 처음 한 번만 계산한다).
describe('barFillStartX — 채움 노드의 시작 x', () => {
  it('설계 폭 1280 · 앵커 가운데면 엔진이 처음 놓는 -640과 같다', () => {
    expect(barFillStartX(1280, 0.5)).toBe(-640);
  });

  it('바가 1600으로 늘어나면 -800으로 따라간다', () => {
    expect(barFillStartX(1600, 0.5)).toBe(-800);
  });

  it('앵커가 왼쪽(0)이면 0이다', () => {
    expect(barFillStartX(1280, 0)).toBe(0);
  });

  it('앵커가 오른쪽(1)이면 -폭이다', () => {
    expect(barFillStartX(1280, 1)).toBe(-1280);
  });
});
