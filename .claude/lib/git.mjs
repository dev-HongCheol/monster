// @ts-check
/**
 * git을 실행하는 함수 하나. `workflow.mjs`와 `change-set.mjs`가 쓰고, 나머지 `.claude/lib/*.mjs`는 git을
 * 부르지 않는다(입력만 받아 답을 돌려준다). 그 구분에 따라 테스트할 때 임시 저장소가 필요한지가 정해진다.
 */

import { spawnSync } from 'node:child_process';

/**
 * `maxBuffer` 기본값 1MiB로는 큰 아트 슬라이스의 `git diff` 출력을 다 받지 못한다. 그러면 `ENOBUFS`로
 * 끝나고 변경 집합을 구할 수 없게 된다.
 */
const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * `root`에서 git을 실행하고 `spawnSync`의 결과를 그대로 돌려준다. `shell`은 쓰지 않는다.
 *
 * @param {string} root 저장소 경로(작업 폴더로 쓴다)
 * @param {string[]} args git에 넘길 인자
 * @param {import('node:child_process').SpawnSyncOptions} [opts] `spawnSync` 옵션. 브랜치를 바꿀 때처럼
 *   사용자에게 git 출력을 그대로 보여 주려면 `{ stdio: 'inherit' }`를 넘긴다
 * @returns {import('node:child_process').SpawnSyncReturns<string>}
 */
export function git(root, args, opts = {}) {
  return /** @type {import('node:child_process').SpawnSyncReturns<string>} */ (
    spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: MAX_BUFFER, ...opts })
  );
}
