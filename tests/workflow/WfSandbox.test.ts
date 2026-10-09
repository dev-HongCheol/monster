/**
 * 시험용 임시 저장소 도우미(`tests/workflow/helpers/WfSandbox.ts`)의 테스트 — 워크플로우 다이어트 W5.
 *
 * 도우미 자체가 지켜야 하는 두 가지를 잰다. `git(dir, ...args)`가 허용 목록 밖의 명령을 거부하는 것과,
 * 가짜 `pnpm`이 결과 파일 유무와 `WF_SHIM_FAIL`에 따라 정해진 대로 끝나는 것이다. 도우미를 쓰는 기존
 * 테스트(`ClaudeMdSplit.test.ts` · `DocsHygiene.test.ts`)가 전과 같은 내용을 확인하는지는 그 파일들이
 * 그대로 통과하는 것으로 본다.
 *
 * `WorkflowDiet.test.ts`에 두지 않는 이유는 그 파일이 W1의 모듈을 import해서, 그 모듈이 생기기 전에는
 * 불러오기에서 실패하기 때문이다. 도우미는 W1보다 먼저 만든다.
 *
 * 임시 저장소를 쓰는 절은 시간 제한을 30초로 둔다. 기본값 5초로는 git을 여러 번 띄우는 테스트가
 * CPU가 바쁠 때 시간 초과로 실패한다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupSandboxes, git, makeRepo, runFakePnpm, runWf } from './helpers/WfSandbox';

/** 임시 저장소를 쓰는 절의 시간 제한. */
const SANDBOX = { timeout: 30_000 };

afterEach(cleanupSandboxes);

describe('WfSandbox.git은 허용된 하위 명령만 받는다', SANDBOX, () => {
  it('허용 목록 밖의 하위 명령은 예외다', () => {
    // `config`는 `core.fsmonitor=<명령>`을 적어 그 뒤의 모든 git 호출이 그 명령을 실행하게 하고,
    // `rebase`는 `--exec <명령>`으로 바로 실행한다. 둘 다 어느 테스트도 쓰지 않으므로 목록에 없어야 한다.
    const repo = makeRepo();
    for (const sub of ['log', 'push', 'config', 'rebase']) {
      expect(() => git(repo, sub, 'x')).toThrow(/허용/);
    }
  });

  it('runWf는 WF_로 시작하는 환경변수만 받는다', () => {
    // `NODE_OPTIONS=--require <파일>`을 넘기면 자식 node가 그 파일을 먼저 싣는다. 허용 목록과 같은 구멍이다.
    const repo = makeRepo({ git: false });
    expect(() => runWf(repo, ['status'], { NODE_OPTIONS: '--require x' })).toThrow(/허용/);
    expect(runWf(repo, ['status'], { WF_QUIET: '1' }).status).toBe(0);
  });

  it('전역 옵션이 첫 인자여도 예외다', () => {
    // 도우미가 인자를 그대로 git에 넘기면 `-c core.fsmonitor=<명령>`으로 `tests/logic/`에서
    // 아무 명령이나 실행할 수 있다. 그러면 테스트 파일을 `/cso` 대상에서 뺀 것이 안전하지 않다.
    const repo = makeRepo();
    for (const opt of ['-c', '-C', '--exec-path', '--git-dir', '--work-tree', '--config-env']) {
      expect(() => git(repo, opt, 'x')).toThrow(/허용/);
    }
  });

  it('허용된 하위 명령은 출력을 돌려주고, HEAD는 feat/ 브랜치에 있다', () => {
    const repo = makeRepo();
    expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toMatch(/^feat\//);
  });

  it('기준 커밋 구조: origin/main과 main은 같고, feat/stale은 그보다 한 커밋 뒤다', () => {
    // `DocsHygiene.test.ts`의 「origin/main보다 커밋 하나 뒤」 상황이 그대로 나와야 한다.
    const repo = makeRepo();
    const main = git(repo, 'rev-parse', 'main').trim();
    expect(git(repo, 'rev-parse', 'origin/main').trim()).toBe(main);
    expect(git(repo, 'rev-parse', 'feat/stale').trim()).toBe(
      git(repo, 'rev-parse', 'main~1').trim(),
    );
  });

  it('checkout: main이면 HEAD가 main에 있다', () => {
    const repo = makeRepo({ checkout: 'main' });
    expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('main');
  });

  it('git: false면 저장소 없이 상태 파일과 문서만 있는 폴더다', () => {
    const dir = makeRepo({ git: false, phase: 'planning' });
    expect(fs.existsSync(path.join(dir, '.git'))).toBe(false);
    const state = JSON.parse(
      fs.readFileSync(path.join(dir, '.claude/workflow-state.json'), 'utf8'),
    );
    expect(state.phase).toBe('planning');
    expect(fs.existsSync(path.join(dir, 'docs/development/workflow/qa-setup.md'))).toBe(true);
  });
});

describe('가짜 pnpm', SANDBOX, () => {
  it('exec tsc와 exec biome는 성공으로 끝난다', () => {
    const repo = makeRepo();
    expect(runFakePnpm(repo, ['exec', 'tsc', '-p', 'tsconfig.tests.json']).status).toBe(0);
    expect(runFakePnpm(repo, ['exec', 'biome', 'check', '.']).status).toBe(0);
    expect(runFakePnpm(repo, ['exec', 'biome', 'lint', '.']).status).toBe(0);
  });

  it('--outputFile이 있는 vitest 호출은 실패 0건인 결과 파일을 쓰고 성공한다', () => {
    const repo = makeRepo();
    const out = path.join(repo, 'vitest-result.json');
    const r = runFakePnpm(repo, [
      'exec',
      'vitest',
      'run',
      '--reporter=json',
      `--outputFile=${out}`,
    ]);
    expect(r.status).toBe(0);
    const result = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(result.success).toBe(true);
    expect(result.numFailedTests).toBe(0);
  });

  it('WF_SHIM_FAIL=vitest면 --outputFile이 있는 호출만 실패한다', () => {
    // 「`pass review`가 넘기기 직전 검사에서 실패하면 넘어가지 않는다」는 테스트가 QA 판정(결과 파일
    // 없이 부른다)이 아니라 통합 검사에서 막히는 것을 확인하려면, 둘이 다르게 끝나야 한다.
    const repo = makeRepo();
    const out = path.join(repo, 'vitest-result.json');
    const env = { WF_SHIM_FAIL: 'vitest' };
    const failing = runFakePnpm(repo, ['exec', 'vitest', 'run', `--outputFile=${out}`], env);
    expect(failing.status).not.toBe(0);
    expect(JSON.parse(fs.readFileSync(out, 'utf8')).success).toBe(false);

    const plain = runFakePnpm(
      repo,
      ['exec', 'vitest', 'run', 'tests/workflow/DocsHygiene.test.ts'],
      env,
    );
    expect(plain.status).toBe(0);
  });

  it('exec가 아닌 호출은 실패로 끝난다 — 지원하지 않는 명령이 조용히 통과하지 않는다', () => {
    const repo = makeRepo();
    expect(runFakePnpm(repo, ['install']).status).not.toBe(0);
  });
});
