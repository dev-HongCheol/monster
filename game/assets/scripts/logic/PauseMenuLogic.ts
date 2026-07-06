import { GameState } from '../data/GameTypes';

/** ESC 키가 현재 게임 상태에서 해야 할 동작. */
export type PauseAction = 'pause' | 'resume' | 'ignore';

/**
 * 현재 게임 상태에 따라 ESC 키의 동작을 결정하는 순수 함수.
 *
 * - `Playing` → `'pause'` (일시정지 진입)
 * - `Paused` → `'resume'` (재개)
 * - 그 외(`LevelUp`·`GameOver`·`Victory`) → `'ignore'`
 *
 * `LevelUp`(카드 선택) 중 ESC를 무시하는 것이 핵심이다 — 이미 모달로 멈춰 있는 상태에
 * 일시정지를 겹쳐 걸지 않도록 막는다.
 */
export function pauseToggleAction(state: GameState): PauseAction {
  if (state === GameState.Playing) return 'pause';
  if (state === GameState.Paused) return 'resume';
  return 'ignore';
}
