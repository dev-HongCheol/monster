import { describe, expect, it } from 'vitest';
import { GameState } from '../../game/assets/scripts/data/GameTypes';
import { pauseToggleAction } from '../../game/assets/scripts/logic/PauseMenuLogic';

/**
 * ESC 토글 결정 함수. 현재 게임 상태에 따라 ESC가 무엇을 해야 하는지 돌려준다.
 * 'pause' = 일시정지 진입, 'resume' = 재개, 'ignore' = 무시(카드 선택·게임오버·승리 중).
 */
describe('pauseToggleAction — ESC 토글 결정', () => {
  it('Playing에서 ESC는 일시정지한다', () => {
    expect(pauseToggleAction(GameState.Playing)).toBe('pause');
  });

  it('Paused에서 ESC는 재개한다', () => {
    expect(pauseToggleAction(GameState.Paused)).toBe('resume');
  });

  it('LevelUp(카드 선택) 중 ESC는 무시한다 (이중 일시정지 차단)', () => {
    expect(pauseToggleAction(GameState.LevelUp)).toBe('ignore');
  });

  it('GameOver 중 ESC는 무시한다', () => {
    expect(pauseToggleAction(GameState.GameOver)).toBe('ignore');
  });

  it('Victory 중 ESC는 무시한다', () => {
    expect(pauseToggleAction(GameState.Victory)).toBe('ignore');
  });
});
