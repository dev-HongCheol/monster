// @ts-check
/**
 * 시험용 임시 저장소에서 `pnpm` 자리에 놓는 가짜.
 *
 * `tests/workflow/helpers/WfSandbox.ts`의 `makeRepo`가 이 파일을 임시 폴더의 `bin/`에 복사하고, 그 옆에
 * `pnpm.cmd`(Windows)와 `pnpm`(그 밖의 OS)을 한 줄짜리로 만들어 둘 다 이 파일을 부르게 한다. 인자
 * 해석을 여기 한 곳에 두는 이유는 `cmd` 배치 파일이 `=`를 인자 구분자로 잘라서 `--outputFile=<경로>`가
 * 두 조각으로 나뉘기 때문이다.
 *
 * 개발 도구가 설치되지 않은 임시 폴더에서 `workflow.mjs`가 통합 검사를 돌릴 수 있게 하는 것이 목적이라,
 * 실제 검사는 하지 않고 정해진 대로 끝난다.
 *
 * - `exec tsc …`, `exec biome …`(`check`·`lint` 모두): 성공.
 * - `exec vitest run … --outputFile=<경로>`: 「실패 0건」인 최소한의 결과 파일을 쓰고 성공.
 * - `--outputFile`이 없는 `exec vitest run …`(QA 문서 판정이 이 모양으로 부른다): 항상 성공.
 * - 환경변수 `WF_SHIM_FAIL=vitest`: `--outputFile`이 있는 호출(통합 검사)에만 실패 결과와 실패 종료
 *   코드를 낸다. 그래야 「넘기기 직전 검사에서 실패하면 넘어가지 않는다」는 테스트가 QA 판정이 아니라
 *   통합 검사에서 막히는 것을 확인할 수 있다. 이 변수는 이 파일만 읽는다.
 * - 그 밖의 호출: 종료 코드 2. 지원하지 않는 명령이 조용히 성공하면 도구의 버그가 테스트에서 가려진다.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const [sub, tool, ...rest] = args;

/**
 * `--outputFile=<경로>` 또는 `--outputFile <경로>`에서 경로를 뽑는다. 없으면 null이다.
 * @param {string[]} list
 * @returns {string | null}
 */
function outputFileArg(list) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.startsWith('--outputFile=')) return a.slice('--outputFile='.length);
    if (a === '--outputFile' && i + 1 < list.length) return list[i + 1];
  }
  return null;
}

/** vitest JSON 리포터가 내는 모양 가운데 `verify.mjs`가 읽는 부분만 채운 「전부 통과」 결과. */
function passingResult() {
  return {
    numTotalTestSuites: 1,
    numPassedTestSuites: 1,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numTotalTests: 1,
    numPassedTests: 1,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    startTime: Date.now(),
    success: true,
    testResults: [],
  };
}

/** 테스트 하나가 실패한 결과. 실패 메시지에 왜 실패했는지를 남겨 출력에서 알아볼 수 있게 한다. */
function failingResult() {
  return {
    ...passingResult(),
    numPassedTestSuites: 0,
    numFailedTestSuites: 1,
    numPassedTests: 0,
    numFailedTests: 1,
    success: false,
    testResults: [
      {
        name: 'tests/logic/FakeShim.test.ts',
        status: 'failed',
        message: '',
        assertionResults: [
          {
            fullName: '가짜 pnpm > WF_SHIM_FAIL=vitest로 만든 실패',
            status: 'failed',
            failureMessages: ['WF_SHIM_FAIL=vitest'],
          },
        ],
      },
    ],
  };
}

if (sub !== 'exec') {
  process.stderr.write(`fake pnpm: 지원하지 않는 호출이다: pnpm ${args.join(' ')}\n`);
  process.exit(2);
} else if (tool === 'tsc' || tool === 'biome') {
  process.exit(0);
} else if (tool === 'vitest') {
  const out = outputFileArg(rest);
  if (out === null) process.exit(0);
  const fail = process.env.WF_SHIM_FAIL === 'vitest';
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(fail ? failingResult() : passingResult()));
  process.exit(fail ? 1 : 0);
} else {
  process.stderr.write(`fake pnpm: 지원하지 않는 도구다: ${tool}\n`);
  process.exit(2);
}
