/**
 * 워크플로우 도구(`.claude/workflow.mjs`)를 실제 프로세스로 띄워 보는 시험용 임시 저장소.
 *
 * 두 테스트 파일에 따로 있던 도우미를 합쳤다. `DocsHygiene.test.ts`의 `makeRepo`·`runWf`(임시 git
 * 저장소에서 도구를 실행한다)와 `ClaudeMdSplit.test.ts`의 `makeSandbox`(git이 아닌 폴더에 상태 파일과
 * 절차 문서를 옵션대로 만든다)다. 임시 저장소를 만드는 규칙이 두 벌이면 한쪽만 고쳤을 때 다른 쪽이
 * 낡은 채로 초록불을 유지한다.
 *
 * **프로세스를 띄우는 코드는 영역 폴더의 `helpers/`에만 둔다.** 테스트 파일(`*.test.ts`)은
 * `/cso` 점검 대상이 아니다 — 모든 슬라이스가 기능 테스트 파일을 만들기 때문에, 넣으면 `/cso`가
 * 「해당 없음」으로 나오는 경우가 한 번도 없다. 그 대신 테스트 파일은 프로세스를 띄우지 않아야 하고
 * (`WorkflowDiet.test.ts`가 잰다), 여기 도우미가 할 수 있는 일이 좁아야 한다. 그래서 `git()`은 허용된 하위 명령만 받는다.
 *
 * `makeRepo()`의 기본값: phase `verification`, QA 문서 있음, 게임 변경 없음, `/cso` 해당 없음,
 * `HEAD`는 `feat/demo`, git 저장소 있음.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const WORKFLOW_MJS = path.join(ROOT, '.claude', 'workflow.mjs');
const FAKE_PNPM_SRC = path.join(ROOT, 'tests', 'workflow', 'fixtures', 'fake-pnpm.mjs');

/** 배달 대상 phase — `done`은 제외한다(문서 여섯 개, phase 일곱 개). */
export const DELIVERED_PHASES = [
  'planning',
  'qa-setup',
  'implementation',
  'verification',
  'user-verification',
  'pr-ready',
];

/** 상태 파일의 모양. 이 슬라이스가 더하는 값은 `[key: string]`으로 받는다. */
export interface SandboxState {
  feature: string;
  phase: string;
  test_skipped: boolean;
  test_skip_reason: string | null;
  ts_check_scope: string | null;
  verification: {
    cso_done: boolean;
    ts_check_clean: boolean;
    lint_clean: boolean;
    code_review_clean: boolean;
  };
  docs_delivered: string[];
  canon_updated: string[];
  canon_skip_reason: string | null;
  [key: string]: unknown;
}

export interface RepoOptions {
  /** 시작 phase. 기본 `verification` */
  phase?: string;
  /** 기능 슬러그. 브랜치 `feat/<feature>`와 계획·QA 문서 파일명에 쓴다. 기본 `demo` */
  feature?: string;
  /** 상태 파일에 덮어쓸 값. 옵션으로는 못 만드는 모양(새 키, 옛 형식)을 넣을 때 쓴다 */
  state?: Record<string, unknown>;
  /**
   * `/cso` 통과 표시와 기록용 값 셋(타입·린트·범위)을 통과로 둘지 (전체 pass 경로 테스트용). 코드 리뷰
   * 표시는 거짓으로 남겨 `pass review`가 마지막 기록이 되게 한다
   */
  allChecksClean?: boolean;
  /** 이미 배달된 phase 목록 (차등 배달 테스트용) */
  docsDelivered?: string[];
  /** 정본 갱신 선언 (pass의 정본 게이트) */
  canonUpdated?: string[];
  /** 정본 갱신 없음 사유 (pass의 정본 게이트) */
  canonSkipReason?: string;
  /** 테스트 스킵 상태 — ready-impl이 vitest를 띄우지 않게 한다 */
  testSkipped?: boolean;
  /** 계획 문서를 만들지 (approve-plan 게이트) */
  planDoc?: boolean;
  /** QA 문서를 만들지. false면 만들지 않는다 */
  qaDoc?: boolean;
  /** QA 문서에 미확정 표시를 넣을지 (pass의 QA 확정 게이트) */
  qaProvisional?: boolean;
  /** 이 phase 문서만 만들지 않는다 */
  omitDoc?: string;
  /** 이 phase 문서를 읽을 수 없게 만든다 (파일 자리에 디렉터리를 둔다) */
  unreadableDoc?: string;
  /** 인덱스(README.md)를 만들지 않는다 */
  omitIndex?: boolean;
  /** 절차 문서 디렉터리 자체를 만들지 않는다 */
  omitDir?: boolean;
  /** `c3`에 `game/assets/scripts/x.ts`를 더해 `game/**` 변경을 만든다 */
  gameChange?: boolean;
  /** `c3`에 `.claude/wf-sandbox.mjs`를 더해 `/cso`를 해야 하는 상황을 만든다 */
  csoApplicable?: boolean;
  /** `HEAD`를 `main`에 둔다. `main`에서 `reset --hard HEAD~1`을 하는 테스트가 쓴다 */
  checkout?: 'main';
  /** false면 git 저장소 없이 폴더만 만든다. 기본 true */
  git?: boolean;
}

/** 실제 프로세스를 띄운 결과. */
export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * `git(dir, ...args)`가 받는 하위 명령.
 *
 * 전역 옵션(`-c`·`-C`·`--exec-path`·`--git-dir`·`--work-tree`·`--config-env`)은 하위 명령 앞에 오므로
 * 첫 인자를 이 목록과 비교하는 것으로 함께 막힌다. 받은 인자를 그대로 넘기면 `-c core.fsmonitor=<명령>`
 * 으로 테스트 파일에서 아무 명령이나 실행할 수 있다.
 */
const ALLOWED_GIT = new Set([
  'init',
  'config',
  'add',
  'commit',
  'branch',
  'switch',
  'checkout',
  'update-ref',
  'reset',
  'cat-file',
  'rev-parse',
  'merge-base',
  'rebase',
]);

/** 이 세션이 만든 임시 폴더(저장소와 `bin/`의 부모). `cleanupSandboxes`가 지운다. */
const sandboxes: string[] = [];

/** stub 절차 문서 — 제목 줄(요약에 살아남는 부분)과 본문 표식을 분리해 둔다. */
export function stubDoc(phase: string): string {
  return [
    `# ${phase} 절차`,
    '',
    '## 첫 게이트',
    '',
    `BODY-${phase}`,
    '',
    '## 둘째 게이트',
    '',
    `BODY-${phase}-끝`,
    '',
  ].join('\n');
}

/** `dir`이 속한 임시 폴더. 임시 폴더 밖(예: 이 레포)이면 null이다. */
function sandboxRootOf(dir: string): string | null {
  return sandboxes.find((s) => dir === s || dir.startsWith(s + path.sep)) ?? null;
}

/**
 * git을 실행할 때의 환경변수. 장비의 전역 설정(`commit.gpgsign=true`, `core.hooksPath`)이 임시
 * 저장소의 커밋을 서명 비밀번호 입력창에서 멈추게 하거나 다른 저장소의 훅을 실행하지 않게 한다.
 *
 * `GIT_CEILING_DIRECTORIES`에는 임시 폴더의 부모를 줘서 git이 그 바깥의 저장소를 찾아 올라가지 않게
 * 한다. 경로는 `realpathSync.native`로 전체 이름으로 바꾼다 — Windows의 짧은 이름(`CHOI-H~1`)으로 주면
 * 이 설정이 적용되지 않는다.
 *
 * 임시 폴더 밖(이 레포 자체)에서 부르면 환경을 바꾸지 않는다.
 */
function envFor(dir: string): NodeJS.ProcessEnv {
  const root = sandboxRootOf(dir);
  if (root === null) return { ...process.env };
  return {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'),
    GIT_AUTHOR_NAME: 'wf-sandbox',
    GIT_AUTHOR_EMAIL: 'wf-sandbox@example.invalid',
    GIT_COMMITTER_NAME: 'wf-sandbox',
    GIT_COMMITTER_EMAIL: 'wf-sandbox@example.invalid',
    GIT_CEILING_DIRECTORIES: fs.realpathSync.native(path.dirname(root)),
  };
}

/**
 * 허용된 하위 명령으로 git을 실행하고 stdout을 돌려준다. 종료 코드가 0이 아니면 예외다.
 *
 * @param dir 저장소 경로. 임시 저장소가 아니어도 된다(`cat-file`로 이 레포의 커밋을 확인하는 데도 쓴다)
 * @param args git에 넘길 인자. 첫 인자가 허용 목록 밖이면 실행하지 않고 예외를 던진다
 */
export function git(dir: string, ...args: string[]): string {
  const sub = args[0];
  if (sub === undefined || !ALLOWED_GIT.has(sub)) {
    throw new Error(
      `WfSandbox.git: 허용하지 않는 인자다: git ${args.join(' ')}\n` +
        `  허용하는 하위 명령: ${[...ALLOWED_GIT].join(' ')}`,
    );
  }
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: envFor(dir) });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

/**
 * 가짜 `pnpm`을 `bin/`에 만든다. `pnpm.cmd`와 `pnpm`은 한 줄짜리고 인자 해석은 `fake-pnpm.mjs`가 한다.
 * `pnpm`에 실행 권한을 주지 않으면 `spawnSync`가 `EACCES`로 끝나서 맥북에서 E2E 테스트가 모두 실패한다.
 */
function installFakePnpm(bin: string): void {
  fs.mkdirSync(bin, { recursive: true });
  fs.copyFileSync(FAKE_PNPM_SRC, path.join(bin, 'fake-pnpm.mjs'));
  fs.writeFileSync(path.join(bin, 'pnpm.cmd'), '@node "%~dp0fake-pnpm.mjs" %*\r\n');
  const sh = path.join(bin, 'pnpm');
  fs.writeFileSync(sh, '#!/bin/sh\nexec node "$(dirname "$0")/fake-pnpm.mjs" "$@"\n');
  fs.chmodSync(sh, 0o755);
}

/** 임시 저장소 커밋의 작성자. 테스트가 뒤에 하는 커밋은 `envFor`의 같은 값을 쓴다. */
const AUTHOR = 'wf-sandbox <wf-sandbox@example.invalid>';

/** 상태 파일의 저장소 기준 경로. */
const STATE_FILE = '.claude/workflow-state.json';

/** fast-import 스트림의 `data` 블록. 길이는 글자 수가 아니라 바이트 수다(절차 문서 제목에 한글이 든다). */
function dataBlock(body: string): string {
  return `data ${Buffer.byteLength(body)}\n${body}\n`;
}

/**
 * 커밋 하나를 fast-import 명령으로 적는다. `files`는 그 커밋에서 바뀌는 파일만 든다 — `from`이 가리키는
 * 커밋의 트리를 이어받으므로 나머지 파일은 그대로다.
 */
function commitBlock(
  ref: string,
  mark: number,
  message: string,
  from: number | null,
  files: Record<string, string>,
): string {
  const who = `${AUTHOR} ${Math.floor(Date.now() / 1000)} +0000`;
  let out = `commit ${ref}\nmark :${mark}\nauthor ${who}\ncommitter ${who}\n${dataBlock(message)}`;
  if (from !== null) out += `from :${from}\n`;
  for (const [rel, body] of Object.entries(files)) {
    out += `M 100644 inline ${rel}\n${dataBlock(body)}`;
  }
  return `${out}\n`;
}

/**
 * 커밋과 브랜치를 `git fast-import` 한 번으로 만든다. 커밋마다 `add`·`commit`을 띄우면 저장소 하나에
 * git을 열두 번 띄워 약 0.3초가 걸리고, 이렇게 하면 세 번(`init` · `fast-import` · `reset`)에 약 0.15초다.
 * 스트림은 이 파일이 옵션으로 조립하므로 테스트가 명령을 넣을 자리가 없다 — 그래서 `git()`의 허용
 * 목록에는 넣지 않는다.
 */
function fastImport(repo: string, stream: string): void {
  const r = spawnSync('git', ['fast-import', '--quiet'], {
    cwd: repo,
    encoding: 'utf8',
    env: envFor(repo),
    input: stream,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`git fast-import: ${r.stderr}`);
}

/**
 * 임시 폴더 아래에 `repo/`(저장소)와 `bin/`(가짜 `pnpm`)을 나란히 만들고 `repo/`의 경로를 돌려준다.
 *
 * 가짜 `pnpm`을 저장소 안에 두지 않는 이유는 `*.cmd` 파일이 `/cso` 적용 경로에 해당해서, 모든 임시
 * 저장소에서 `/cso`를 해야 하는 것으로 판정되기 때문이다.
 *
 * 커밋은 세 개다. `c1`은 빈 README 하나, `c2`(기준 커밋)는 절차 문서·계획 문서·QA 문서·판정 테스트
 * 파일 자리·상태 파일, `c3`은 상태 파일을 지정한 phase에 맞게 고친 것이다. `main`과 `origin/main`은
 * `c2`, `feat/stale`은 `c1`, `feat/<feature>`는 `c3`이고 `HEAD`는 `feat/<feature>`에 둔다. 변경 집합
 * 테스트의 기준 커밋이 `c2`라서, 옵션 없이 만든 저장소의 변경 집합은 비어 있다(상태 파일은 변경
 * 집합에서 빠진다). 세 커밋은 파일 목록을 메모리에서 조립해 `fastImport`로 한 번에 만든다.
 *
 * `git: false`면 저장소 없이 같은 파일만 폴더에 둔다. 변경 집합이나 `cso_commit`을 확인하지 않는
 * 테스트가 이 방식을 쓴다 — 전부 git 저장소로 만들면 Windows에서 전체 테스트 시간이 몇 초 는다.
 */
export function makeRepo(opts: RepoOptions = {}): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-sandbox-'));
  sandboxes.push(tmp);
  const repo = path.join(tmp, 'repo');
  fs.mkdirSync(repo);
  installFakePnpm(path.join(tmp, 'bin'));
  // 저장소 설정이 아니라 `envFor`가 가리키는 전역 설정 파일에 적는다. `git config`를 띄우지 않아도 되고,
  // 테스트가 뒤에 하는 커밋에도 같은 설정이 적용된다.
  fs.writeFileSync(
    path.join(tmp, 'gitconfig'),
    '[core]\n\tautocrlf = false\n[commit]\n\tgpgsign = false\n',
  );

  const feature = opts.feature ?? 'demo';
  if (!/^[A-Za-z0-9._-]+$/.test(feature)) {
    // 브랜치 이름과 fast-import 스트림의 경로에 그대로 들어간다.
    throw new Error(`WfSandbox.makeRepo: feature에 쓸 수 없는 글자가 있다: ${feature}`);
  }
  const useGit = opts.git !== false;

  const clean = opts.allChecksClean === true;
  const state: SandboxState = {
    feature,
    phase: opts.phase ?? 'verification',
    test_skipped: opts.testSkipped === true,
    test_skip_reason: opts.testSkipped === true ? '순수 로직 없음' : null,
    ts_check_scope: clean ? 'full' : null,
    verification: {
      cso_done: clean,
      ts_check_clean: clean,
      lint_clean: clean,
      code_review_clean: false,
    },
    docs_delivered: opts.docsDelivered ?? [],
    canon_updated: opts.canonUpdated ?? [],
    canon_skip_reason: opts.canonSkipReason ?? null,
    ...opts.state,
  };
  const stateJson = (s: SandboxState): string => `${JSON.stringify(s, null, 2)}\n`;

  // c2 — 기준 커밋의 파일
  const c2: Record<string, string> = {};
  if (opts.omitDir !== true) {
    if (opts.omitIndex !== true) c2['docs/development/workflow/README.md'] = '# 인덱스\n';
    for (const phase of DELIVERED_PHASES) {
      if (phase === opts.omitDoc) continue;
      c2[`docs/development/workflow/${phase}.md`] = stubDoc(phase);
    }
  }
  if (opts.planDoc !== false) {
    c2[`docs/development/sessions/2026-01-01-${feature}-plan.md`] = '# 계획\n';
  }
  if (opts.qaDoc !== false) {
    c2[`docs/qa/${feature}-test.md`] =
      opts.qaProvisional === true
        ? '# QA\n\n## 프리팹 (잠정 이름)\n'
        : '# QA\n\n## 프리팹 (확정)\n';
  }
  // 가짜 vitest는 항상 성공으로 끝나므로 내용은 상관없다. `qaDocClean`이 「판정 파일이 있는가」를
  // 확인할 때 통과하려고 둔다.
  c2['tests/workflow/DocsHygiene.test.ts'] = '';
  c2[STATE_FILE] = stateJson({ ...state, phase: 'planning' });

  // c3 — 요청한 상태에서 c2와 달라지는 파일
  const c3: Record<string, string> = { [STATE_FILE]: stateJson(state) };
  if (opts.gameChange === true) c3['game/assets/scripts/x.ts'] = 'export const x = 1;\n';
  if (opts.csoApplicable === true) c3['.claude/wf-sandbox.mjs'] = 'export {};\n';

  if (useGit) {
    // HEAD가 설 브랜치를 init에서 정하면 뒤에 switch를 띄우지 않아도 된다. fast-import가 끝나도 index와
    // 작업 트리는 비어 있으므로 reset --hard로 HEAD의 트리를 꺼낸다.
    const head = opts.checkout === 'main' ? 'main' : `feat/${feature}`;
    git(repo, 'init', '--quiet', `--initial-branch=${head}`);
    fastImport(
      repo,
      commitBlock('refs/heads/main', 1, 'c1', null, { 'README.md': '' }) +
        commitBlock('refs/heads/main', 2, 'c2', 1, c2) +
        'reset refs/heads/feat/stale\nfrom :1\n\nreset refs/remotes/origin/main\nfrom :2\n\n' +
        commitBlock(`refs/heads/feat/${feature}`, 3, 'c3', 2, c3),
    );
    git(repo, 'reset', '--hard', '--quiet');
  } else {
    if (opts.omitDir !== true) {
      fs.mkdirSync(path.join(repo, 'docs', 'development', 'workflow'), { recursive: true });
    }
    for (const [rel, body] of Object.entries({ ...c2, ...c3 })) {
      const full = path.join(repo, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, body);
    }
  }

  if (opts.unreadableDoc !== undefined) {
    // 이름은 readdir에 남되 readFileSync가 EISDIR로 던지게 만든다. 권한 조작보다 이식성이 좋다.
    const target = path.join(repo, 'docs/development/workflow', `${opts.unreadableDoc}.md`);
    fs.rmSync(target, { force: true });
    fs.mkdirSync(target);
  }

  return repo;
}

/**
 * `PATH` 맨 앞에 가짜 `pnpm` 폴더를 붙인 환경변수 한 쌍.
 *
 * `process.env`에서 대소문자를 구분하지 않고 `PATH` 키를 찾아(Windows에서는 `Path`) 그 키의 값을
 * 고친다. 키를 새로 만들면 이름이 같은 키가 둘이 되는데, 자식 프로세스가 어느 쪽을 읽을지는
 * 보장되지 않는다.
 */
function pathWithFakePnpm(repo: string): Record<string, string> {
  const bin = path.join(path.dirname(repo), 'bin');
  const key = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  return { [key]: `${bin}${path.delimiter}${process.env[key] ?? ''}` };
}

/**
 * 임시 저장소를 `CLAUDE_PROJECT_DIR`로 삼아 실제 `workflow.mjs` 프로세스를 띄운다.
 *
 * @param repo `makeRepo`가 돌려준 경로
 * @param args `workflow.mjs`에 넘길 인자
 * @param extraEnv 더 넣을 환경변수(예: `WF_SHIM_FAIL`)
 */
export function runWf(
  repo: string,
  args: string[],
  extraEnv: Record<string, string> = {},
): RunResult {
  const r = spawnSync(process.execPath, [WORKFLOW_MJS, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...envFor(repo), ...pathWithFakePnpm(repo), CLAUDE_PROJECT_DIR: repo, ...extraEnv },
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * 가짜 `pnpm`을 직접 실행한다. 도우미의 규칙(결과 파일 유무, `WF_SHIM_FAIL`)을 테스트할 때 쓴다.
 *
 * @param repo `makeRepo`가 돌려준 경로
 * @param args `pnpm`에 넘길 인자(예: `['exec', 'vitest', 'run']`)
 * @param extraEnv 더 넣을 환경변수
 */
export function runFakePnpm(
  repo: string,
  args: string[],
  extraEnv: Record<string, string> = {},
): RunResult {
  const script = path.join(path.dirname(repo), 'bin', 'fake-pnpm.mjs');
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * 이 세션이 만든 임시 폴더를 전부 지운다. `afterEach`에 건다. 절 안에서 저장소를 돌려쓰는 파일은
 * `afterAll`에 건다(`WorkflowDiet.test.ts`).
 *
 * Windows에서는 Defender가 새 파일을 읽는 중이거나 git이 파일을 아직 놓지 않았을 때 `EBUSY`/`EPERM`이
 * 나므로 다시 시도한다.
 */
export function cleanupSandboxes(): void {
  for (const dir of sandboxes.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
