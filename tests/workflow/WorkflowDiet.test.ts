/**
 * 워크플로우 다이어트 1단계(`feat/workflow-diet`)의 테스트.
 *
 * 작업 묶음마다 절을 하나씩 두고, 묶음을 시작할 때 그 절의 실패하는 테스트를 먼저 쓴다. 지금 있는
 * 절은 W1(변경 집합과 적용 판정) · W4(판정 코드 합치기) · W2(통합 검사와 전이 판정)다. W3의 테스트는 그 묶음을 시작할 때 더한다. W5(임시 저장소
 * 도우미)의 테스트는 `WfSandbox.test.ts`에 따로 있다 — 이 파일은 W1의 모듈을 import하므로 그
 * 모듈이 생기기 전에는 불러오기에서 실패해서, 도우미만 먼저 확인할 수 없기 때문이다. 묶음마다 무엇을 확인하기로 했는지는 계획의 묶음 문서
 * `docs/development/sessions/2026-10-06-workflow-diet-w*.md`의 「테스트」 절이 든다.
 *
 * 임시 저장소를 쓰는 절은 시간 제한을 30초로 둔다. 기본값 5초로는 git을 여러 번 띄우는 테스트가
 * CPU가 바쁠 때 시간 초과로 실패한다.
 *
 * 이 파일은 프로세스를 직접 띄우지 않는다. git과 가짜 `pnpm`은 `helpers/WfSandbox.ts`를 거쳐
 * 실행한다 — 테스트 파일을 `/cso` 대상에서 빼는 조건이 그것이다(W1 §3).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { applicableGates, collectChangeSet, csoBaseUsable } from '../../.claude/lib/change-set.mjs';
import { EDITABLE_PHASES } from '../../.claude/lib/phases.mjs';
import {
  csoGuideLine,
  decideTransition,
  failureKind,
  qaRequired,
} from '../../.claude/lib/transition.mjs';
import {
  formatVerifyReport,
  makeRunners,
  runVerify,
  writeModeFor,
} from '../../.claude/lib/verify.mjs';
import {
  cleanupSandboxes,
  git,
  makeRepo,
  type RepoOptions,
  runWf,
  type SandboxState,
} from './helpers/WfSandbox';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/** 임시 저장소를 쓰는 절의 시간 제한. */
const SANDBOX = { timeout: 30_000 };

type ChangeSet = ReturnType<typeof collectChangeSet>;
type Measured = Extract<ChangeSet, { measurable: true }>;
type Unmeasured = Extract<ChangeSet, { measurable: false }>;

/** 구할 수 있었다고 단언하고 좁힌 타입으로 돌려준다 — `base`·`items`를 읽기 위해서다. */
function measured(cs: ChangeSet): Measured {
  if (!cs.measurable) throw new Error(`변경 집합을 구하지 못했다: ${cs.hint}`);
  return cs;
}

/** 구할 수 없었다고 단언하고 좁힌 타입으로 돌려준다 — `hint`를 읽기 위해서다. */
function unmeasured(cs: ChangeSet): Unmeasured {
  if (cs.measurable) throw new Error('변경 집합을 구할 수 있었다 — 구할 수 없어야 하는 경우다');
  return cs;
}

afterEach(cleanupSandboxes);

/** 임시 저장소 안에 파일 하나를 쓴다. 중간 폴더는 만든다. */
function write(repo: string, rel: string, body = 'x\n'): void {
  const full = path.join(repo, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
}

/** `spawnSync`가 돌려주는 모양 가운데 변경 집합 코드가 읽는 부분. */
interface GitResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

/**
 * git 실행을 흉내 낸다. 인자 문자열에 열쇠가 들어 있으면 그 답을, 없으면 「성공에 빈 출력」을 낸다.
 * 실제 git으로는 만들기 어려운 출력(`T`·`U` 상태 글자, 실행 실패)을 넣을 때 쓴다.
 */
function fakeGit(answers: Record<string, Partial<GitResult>>) {
  return (args: string[]): GitResult => {
    const joined = args.join(' ');
    const key = Object.keys(answers).find((k) => joined.includes(k));
    return { status: 0, stdout: '', stderr: '', ...(key ? answers[key] : {}) };
  };
}

/** 갈라진 커밋이 있고 diff 출력만 다른 가짜 git. */
function fakeGitWithDiff(diff: string) {
  return fakeGit({
    '--verify': { stdout: 'abc123\n' },
    'merge-base': { stdout: 'abc123\n' },
    diff: { stdout: diff },
  });
}

/** 폴더 아래의 `.ts` 파일을 전부 모은다. */
function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFilesUnder(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// W1 — 변경 집합과 적용 판정
// ---------------------------------------------------------------------------

describe('W1 — collectChangeSet: 변경 집합', SANDBOX, () => {
  it('기준은 origin/main과 갈라진 커밋이고, 상태 파일만 바뀐 저장소의 변경 집합은 비어 있다', () => {
    const repo = makeRepo();
    const cs = measured(collectChangeSet(repo));
    expect(cs.base).toBe(git(repo, 'rev-parse', 'origin/main').trim());
    expect(cs.items).toEqual([]);
  });

  it('추적 파일의 수정·새 파일·삭제를 M·A·D로 잡는다', () => {
    const repo = makeRepo();
    write(repo, 'README.md', 'changed\n');
    write(repo, 'docs/new.md');
    fs.rmSync(path.join(repo, 'docs/development/workflow/README.md'));
    const cs = measured(collectChangeSet(repo));
    expect(cs.items).toEqual(
      expect.arrayContaining([
        { status: 'M', path: 'README.md' },
        { status: 'A', path: 'docs/new.md' },
        { status: 'D', path: 'docs/development/workflow/README.md' },
      ]),
    );
  });

  it('이름을 바꾼 파일은 삭제 하나와 추가 하나로 잡는다', () => {
    // `--no-renames`가 없으면 한 항목이 세 조각(R100·옛 경로·새 경로)으로 나와 그 뒤의 항목까지
    // 잘못 읽는다.
    const repo = makeRepo();
    fs.renameSync(path.join(repo, 'README.md'), path.join(repo, 'docs/moved.md'));
    git(repo, 'add', '-A');
    const cs = measured(collectChangeSet(repo));
    expect(cs.items).toEqual(
      expect.arrayContaining([
        { status: 'D', path: 'README.md' },
        { status: 'A', path: 'docs/moved.md' },
      ]),
    );
    expect(cs.items.some((i: { status: string }) => !['A', 'M', 'D'].includes(i.status))).toBe(
      false,
    );
  });

  it('git add만 한 새 파일도 A로 잡는다', () => {
    const repo = makeRepo();
    write(repo, 'docs/staged.md');
    git(repo, 'add', 'docs/staged.md');
    expect(measured(collectChangeSet(repo)).items).toContainEqual({
      status: 'A',
      path: 'docs/staged.md',
    });
  });

  it('공백과 한글이 든 파일명을 그대로 돌려준다', () => {
    const repo = makeRepo();
    write(repo, 'docs/새 문서 초안.md');
    expect(measured(collectChangeSet(repo)).items).toContainEqual({
      status: 'A',
      path: 'docs/새 문서 초안.md',
    });
  });

  it('상태 파일과 git이 추적하지 않는 *.meta는 변경 집합에서 뺀다', () => {
    // 상태 파일은 도구가 스스로 쓰는 파일이라 넣으면 모든 슬라이스가 `/cso`를 하게 되고, 추적하지 않는
    // `.meta`는 Cocos가 만든 것이지 개발자가 바꾼 것이 아니다.
    const repo = makeRepo();
    write(repo, '.claude/workflow-state.json', '{"phase":"verification"}\n');
    write(repo, 'game/assets/art/a.png.meta');
    const paths = measured(collectChangeSet(repo)).items.map((i: { path: string }) => i.path);
    expect(paths).not.toContain('.claude/workflow-state.json');
    expect(paths).not.toContain('game/assets/art/a.png.meta');
  });

  it('--name-status의 T(파일 형식 변경)는 M으로 읽는다', () => {
    const cs = measured(collectChangeSet(ROOT, { run: fakeGitWithDiff('T\0tools/x.sh\0') }));
    expect(cs.items).toEqual([{ status: 'M', path: 'tools/x.sh' }]);
  });
});

describe('W1 — 변경 집합을 구할 수 없으면 모든 검사를 한다', SANDBOX, () => {
  /** 네 검사가 전부 「적용」인지. 건너뛰어도 되는지 알 수 없을 때는 건너뛰지 않는다. */
  function expectAllApply(cs: ChangeSet): void {
    const gates = applicableGates(cs);
    for (const name of ['meta', 'fullTypecheck', 'cso', 'qa'] as const) {
      expect(gates[name].applies, name).toBe(true);
    }
  }

  it('origin/main 참조가 없다 → git fetch origin main', () => {
    const repo = makeRepo();
    git(repo, 'update-ref', '-d', 'refs/remotes/origin/main');
    const cs = unmeasured(collectChangeSet(repo));
    expect(cs.hint).toContain('git fetch origin main');
    expectAllApply(cs);
  });

  it('origin/main과 공통 조상이 없다 → git fetch --unshallow', () => {
    // 이때 `merge-base`는 종료 코드 1과 빈 출력을 낸다. 따로 잡지 않으면 기준 커밋이 빈 문자열인
    // 채로 `git diff`를 실행한다.
    const repo = makeRepo();
    git(repo, 'checkout', '--orphan', 'unrelated');
    write(repo, 'other.txt');
    git(repo, 'add', '-A');
    git(repo, 'commit', '--quiet', '-m', 'unrelated');
    const unrelated = git(repo, 'rev-parse', 'HEAD').trim();
    git(repo, 'switch', '-');
    git(repo, 'update-ref', 'refs/remotes/origin/main', unrelated);
    const cs = unmeasured(collectChangeSet(repo));
    expect(cs.hint).toContain('git fetch --unshallow');
    expectAllApply(cs);
  });

  it('git 저장소가 아니다 → 저장소 루트에서 실행(여기는 git 저장소가 아니다)', () => {
    const dir = makeRepo({ git: false });
    const cs = unmeasured(collectChangeSet(dir));
    expect(cs.hint).toContain('여기는 git 저장소가 아니다');
    expectAllApply(cs);
  });

  it('하위 폴더에서 실행했다 → 저장소 루트에서 실행', () => {
    // 경로 문자열을 비교하지 않는다. 이 장비에서 git은 `F:/…`를, Node는 `F:\…`를 내서 비교가 항상
    // 틀린다. `rev-parse --show-prefix`가 비어 있지 않으면 하위 폴더다.
    const repo = makeRepo();
    const cs = unmeasured(collectChangeSet(path.join(repo, 'docs')));
    expect(cs.hint).toContain('저장소 루트에서 실행');
    expect(cs.hint).not.toContain('여기는 git 저장소가 아니다');
    expectAllApply(cs);
  });

  it('git 출력을 받지 못했다 → stderr 첫 줄 + git status로 확인', () => {
    const run = fakeGit({
      'rev-parse': {
        status: null,
        stderr: 'spawn git ENOENT\n둘째 줄은 안 나온다',
        error: new Error('spawn git ENOENT'),
      },
    });
    const cs = unmeasured(collectChangeSet(ROOT, { run }));
    expect(cs.hint).toContain('spawn git ENOENT');
    expect(cs.hint).not.toContain('둘째 줄');
    expect(cs.hint).toContain('git status');
    expectAllApply(cs);
  });

  it('U 같은 알 수 없는 상태 글자 → 충돌을 풀고 다시', () => {
    const cs = unmeasured(collectChangeSet(ROOT, { run: fakeGitWithDiff('U\0x.txt\0') }));
    expect(cs.hint).toContain('충돌을 풀고 다시');
    expect(cs.hint).toContain('docs/development/troubleshooting/workflow-state-cross-machine.md');
    expectAllApply(cs);
  });
});

describe('W1 — applicableGates: 대표 변경 집합', SANDBOX, () => {
  /** 변경을 만드는 함수와 기대 판정. 열 순서는 계획 W1 §4 표와 같다(meta · fullTypecheck · cso · QA). */
  const ROWS: Array<[string, (repo: string) => void, boolean, boolean, boolean, boolean]> = [
    ['문서만(docs/**)', (r) => write(r, 'docs/x.md'), false, false, false, false],
    [
      '도구만(tools/blender/**)',
      (r) => write(r, 'tools/blender/bake.py'),
      false,
      false,
      true,
      false,
    ],
    [
      '도구만(.claude/workflow.mjs)',
      (r) => write(r, '.claude/workflow.mjs'),
      false,
      false,
      true,
      false,
    ],
    [
      '순수 로직 테스트만(tests/logic/**)',
      (r) => write(r, 'tests/logic/X.test.ts'),
      false,
      false,
      false,
      false,
    ],
    [
      '워크플로우 테스트 파일만(tests/workflow/*.test.ts)',
      (r) => write(r, 'tests/workflow/X.test.ts'),
      false,
      false,
      false,
      false,
    ],
    [
      '테스트 도우미(tests/workflow/helpers/**)',
      (r) => write(r, 'tests/workflow/helpers/x.ts'),
      false,
      false,
      true,
      false,
    ],
    [
      '추적하지 않는 .meta만',
      (r) => write(r, 'game/assets/art/a.png.meta'),
      false,
      false,
      false,
      false,
    ],
    [
      '그림과 .meta만(game/assets/art/**)',
      (r) => write(r, 'game/assets/art/a.png'),
      true,
      false,
      false,
      true,
    ],
    [
      '게임 TypeScript(game/assets/scripts/**)',
      (r) => write(r, 'game/assets/scripts/a.ts'),
      true,
      true,
      false,
      true,
    ],
    [
      '게임 프로젝트 설정만(game/settings/**)',
      (r) => write(r, 'game/settings/v2/project.json'),
      false,
      true,
      false,
      true,
    ],
  ];

  it.each(ROWS)('%s', (_name, change, meta, fullTypecheck, cso, qa) => {
    const repo = makeRepo();
    change(repo);
    const gates = applicableGates(collectChangeSet(repo));
    expect(gates.meta.applies, 'meta').toBe(meta);
    expect(gates.fullTypecheck.applies, 'fullTypecheck').toBe(fullTypecheck);
    expect(gates.cso.applies, 'cso').toBe(cso);
    expect(gates.qa.applies, 'qa').toBe(qa);
  });

  it('적용이면 어느 파일 때문인지(matches)와 어느 경로 규칙인지(rule)를 든다', () => {
    const repo = makeRepo();
    write(repo, 'game/assets/scripts/a.ts');
    const gates = applicableGates(collectChangeSet(repo));
    expect(gates.meta.matches).toEqual(['game/assets/scripts/a.ts']);
    expect(gates.meta.rule).toBeTruthy();
    expect(gates.cso.matches).toEqual([]);
  });
});

describe('W1 — 적용 경로의 폴더 경계', SANDBOX, () => {
  // pathspec 시험(W1 §3.1)에서 git에 경로 비교를 맡기기로 하면 이 절은 뺀다.
  it('toolsmith/x는 tools/**에 해당하지 않는다', () => {
    const repo = makeRepo();
    write(repo, 'toolsmith/x.txt');
    expect(applicableGates(collectChangeSet(repo)).cso.applies).toBe(false);
  });

  it('game/elsewhere/x.ts는 게임 전체 타입 검사에 해당한다 — 폴더가 아니라 확장자로 본다', () => {
    const repo = makeRepo();
    write(repo, 'game/elsewhere/x.ts');
    expect(applicableGates(collectChangeSet(repo)).fullTypecheck.applies).toBe(true);
  });

  it('대소문자만 다른 .Claude/는 같은 폴더로 본다', () => {
    // Windows 파일 시스템은 두 폴더를 구분하지 못해 실제로 만들 수 없으므로 git 출력을 흉내 낸다.
    const cs = collectChangeSet(ROOT, { run: fakeGitWithDiff('A\0.Claude/hooks/x.mjs\0') });
    expect(applicableGates(cs).cso.applies).toBe(true);
  });
});

describe('W1 — csoBaseUsable: cso_commit을 기준으로 쓸 수 있나', SANDBOX, () => {
  it('값이 없으면 「기록 없음」이다', () => {
    const repo = makeRepo();
    expect(csoBaseUsable(null, repo)).toEqual({ usable: false, reason: '기록 없음' });
    expect(csoBaseUsable(undefined, repo)).toEqual({ usable: false, reason: '기록 없음' });
  });

  it('HEAD의 조상이면 쓸 수 있다', () => {
    const repo = makeRepo();
    const base = git(repo, 'rev-parse', 'HEAD~1').trim();
    expect(csoBaseUsable(base, repo)).toEqual({ usable: true });
  });

  it('조상이 아닌 커밋이면 그 이유를 단다', () => {
    // 리베이스를 했거나 main에서 들어온 변경이 섞였을 때다. 그 커밋을 기준으로 안내하면 명령이
    // 실패하거나 main의 변경까지 점검 범위에 들어간다.
    const repo = makeRepo();
    git(repo, 'checkout', '--orphan', 'unrelated');
    write(repo, 'other.txt');
    git(repo, 'add', '-A');
    git(repo, 'commit', '--quiet', '-m', 'unrelated');
    const unrelated = git(repo, 'rev-parse', 'HEAD').trim();
    git(repo, 'switch', '-');
    expect(csoBaseUsable(unrelated, repo)).toEqual({
      usable: false,
      reason: '지금 HEAD의 조상이 아님',
    });
  });

  it('저장소에 없는 커밋이면 다른 이유를 단다', () => {
    // 다른 장비로 옮겼는데 그 장비에 그 커밋이 없을 때다. 어떤 검사를 할지는 바꾸지 않고 전체 `/cso`만
    // 안내하므로, 변경 집합을 구할 수 없는 경우와 섞지 않는다.
    const repo = makeRepo();
    expect(csoBaseUsable('0'.repeat(40), repo)).toEqual({
      usable: false,
      reason: '지금 저장소에 없는 커밋',
    });
  });
});

describe('W1 — 파일 내용으로 확인하는 것', () => {
  it('저장소 .gitignore에 Claude Code가 만드는 파일이 적혀 있다', () => {
    // biome은 저장소의 `.gitignore`만 읽는다(`vcs.useIgnoreFile`). 전역 git 설정에만 있으면 그 설정이
    // 없는 장비에서 biome이 이 파일들까지 검사한다.
    const lines = fs
      .readFileSync(path.join(ROOT, '.gitignore'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim());
    for (const entry of [
      '.claude/settings.local.json',
      '.claude/scheduled_tasks.json',
      '.claude/scheduled_tasks.lock',
      '.claude/worktrees/',
      '.claude/checkpoints/',
      '.claude/mailbox/',
      '.claude/routines/.state/',
      '.claude/agent-registry.json',
      '.claude/agent-memory-local',
      '.claude/first-run',
      '.claude/assistant-daemon-state.json',
    ]) {
      expect(lines, entry).toContain(entry);
    }
  });

  it('게임 코드는 .json을 import하지 않는다', () => {
    // import하기 시작하면 JSON을 바꿔도 타입 검사 결과가 바뀌므로, 그때 `FULL_TYPECHECK_PATHS`를 넓힌다.
    const offenders = tsFilesUnder(path.join(ROOT, 'game/assets/scripts')).filter((f) =>
      /from\s+['"][^'"]+\.json['"]|import\(\s*['"][^'"]+\.json['"]/.test(
        fs.readFileSync(f, 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('helpers/·fixtures/ 밖의 tests/ 파일은 프로세스를 띄우지 않는다', () => {
    // 테스트 파일을 `/cso` 대상에서 빼는 조건이다. 프로세스를 띄우는 테스트 코드는 각 영역의
    // `helpers/`에 두고, 가짜 도구처럼 복사해 실행하는 파일은 `fixtures/`에 둔다.
    const isHelperOrFixture = (f: string): boolean =>
      path
        .relative(ROOT, f)
        .split(path.sep)
        .some((seg) => seg === 'helpers' || seg === 'fixtures');
    const offenders = tsFilesUnder(path.join(ROOT, 'tests'))
      .filter((f) => !isHelperOrFixture(f))
      .filter((f) =>
        /['"](node:)?(child_process|worker_threads)['"]/.test(fs.readFileSync(f, 'utf8')),
      );
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// W4 — 두 곳에 복사된 판정 코드를 하나로 합치기
// ---------------------------------------------------------------------------

describe('W4 — 판정 코드는 .claude/lib/ 한 곳에만 있다', () => {
  it('workflow.mjs가 canon.mjs · workflow-steps.mjs · phases.mjs를 import한다', () => {
    const src = fs.readFileSync(path.join(ROOT, '.claude/workflow.mjs'), 'utf8');
    for (const mod of ['./lib/canon.mjs', './lib/workflow-steps.mjs', './lib/phases.mjs']) {
      const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(src, mod).toMatch(new RegExp(`from ["']${escaped}["']`));
    }
  });

  it('테스트용 복사본이 없다 — tests/helpers/CanonDoc.ts · WorkflowSteps.ts', () => {
    // 복사본이 남아 있으면 「규칙을 바꾸면 두 곳을 함께 고친다」는 주석이 다시 필요해진다(F78).
    expect(fs.existsSync(path.join(ROOT, 'tests/helpers/CanonDoc.ts'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'tests/helpers/WorkflowSteps.ts'))).toBe(false);
  });

  it('훅의 EDITABLE_PHASES 값이 phases.mjs와 같다 — 훅은 import하지 않고 값만 맞춘다', () => {
    // Claude Code는 PreToolUse 훅이 종료 코드 2가 아닌 코드로 죽으면 편집을 막지 않는다. 훅이 다른
    // 파일을 import하다 실패하면 경고만 하고 편집은 통과시키므로, 훅은 값을 직접 들고 이 테스트가
    // 두 값이 같은지 본다(W4 §2).
    const hook = fs.readFileSync(path.join(ROOT, '.claude/hooks/gate-scripts.mjs'), 'utf8');
    const m = /EDITABLE_PHASES\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(hook);
    expect(m).not.toBeNull();
    const inHook = [...(m as RegExpExecArray)[1].matchAll(/["']([^"']+)["']/g)]
      .map((x) => x[1])
      .sort();
    expect(inHook).toEqual([...EDITABLE_PHASES].sort());
  });

  it('lint-staged 대상에 mjs가 있다', () => {
    // .claude/lib/*.mjs는 biome 검사 대상인데 커밋 훅이 형식을 맞춰 주지 않으면, 커밋은 되는데
    // 통합 검사에서 실패한다.
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const patterns = Object.keys(pkg['lint-staged'] ?? {});
    expect(patterns.some((p) => /\bmjs\b/.test(p))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// W2 — 통합 검사와 전이 판정
// ---------------------------------------------------------------------------

/** 실행기가 받는 `spawnSync` 결과 가운데 통합 검사 코드가 읽는 부분. */
interface SpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error & { code?: string };
}

/**
 * vitest JSON 리포터 결과 파일. 덮어쓸 값만 받고 나머지는 「파일 두 개 전부 통과」로 채운다. 파일 수는
 * `testResults`의 길이다 — `numTotalTestSuites`는 describe까지 센다.
 */
function vitestJson(over: Record<string, unknown> = {}): Record<string, unknown> {
  const passed = (name: string) => ({ name, status: 'passed', message: '', assertionResults: [] });
  return {
    numTotalTestSuites: 5,
    numPassedTestSuites: 5,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numTotalTests: 6,
    numPassedTests: 5,
    numFailedTests: 0,
    numPendingTests: 1,
    numTodoTests: 0,
    success: true,
    testResults: [passed('tests/logic/A.test.ts'), passed('tests/logic/B.test.ts')],
    ...over,
  };
}

/** 가짜 `spawnSync`가 도구마다 돌려줄 답. vitest의 `file`은 결과 파일 내용(`null`이면 쓰지 않는다). */
interface SpawnAnswers {
  biomeCheck?: Partial<SpawnResult>;
  biomeLint?: Partial<SpawnResult>;
  tsc?: Partial<SpawnResult>;
  vitest?: Partial<SpawnResult> & { file?: unknown };
}

/**
 * `spawnSync` 자리에 넣는 가짜. 실행한 명령줄을 `calls`에 적고 도구별 답을 돌려준다. vitest는
 * `--outputFile="<경로>"` 인자를 읽어 그 자리에 결과 파일을 쓴다 — 실제 vitest가 하는 일이다.
 */
function fakeSpawn(answers: SpawnAnswers = {}, calls: string[] = []) {
  return (_cmd: string, args: string[]): SpawnResult => {
    const joined = args.join(' ');
    calls.push(joined);
    const ok = { status: 0, stdout: '', stderr: '' };
    if (joined.includes('biome check')) return { ...ok, ...answers.biomeCheck };
    if (joined.includes('biome lint')) return { ...ok, ...answers.biomeLint };
    if (joined.includes('tsc')) return { ...ok, ...answers.tsc };
    const { file = vitestJson(), ...rest } = answers.vitest ?? {};
    const arg = args.find((a) => a.startsWith('--outputFile='));
    if (arg && file !== null) {
      const out = arg.slice('--outputFile='.length).replace(/^"|"$/g, '');
      fs.writeFileSync(out, typeof file === 'string' ? file : JSON.stringify(file));
    }
    return { ...ok, ...rest };
  };
}

/** 가짜 `spawnSync`로 만든 실행기로 통합 검사를 돌린다. 타입 검사의 Cocos 파일 확인은 빈 폴더에서 한다. */
function verifyWith(answers: SpawnAnswers, write = true) {
  const root = makeRepo({ git: false });
  return runVerify(makeRunners({ root, spawn: fakeSpawn(answers) }), { write });
}

/** 검사 하나의 결과 상태(verify.mjs의 CheckStatus). */
type Status = 'pass' | 'fail' | 'format-only' | 'not-run';

/** 실행기 하나가 돌려주는 모양. 상태만 정한다. */
function runnerResult(status: Status) {
  return { status, summary: '', details: '', rerun: '' };
}

describe('W2 — runVerify: 통합 검사', SANDBOX, () => {
  it('biome → 타입 검사 → vitest 순서로 셋을 다 돌린다 — 앞이 실패해도 멈추지 않는다', () => {
    const order: string[] = [];
    const runner = (name: string, status: Status) => () => {
      order.push(name);
      return runnerResult(status);
    };
    const r = runVerify({
      biome: runner('biome', 'fail'),
      typecheck: runner('typecheck', 'pass'),
      vitest: runner('vitest', 'pass'),
    });
    expect(order).toEqual(['biome', 'typecheck', 'vitest']);
    expect(r.ok).toBe(false);
    for (const k of ['biome', 'typecheck', 'vitest'] as const) {
      expect(typeof r.results[k].durationMs, k).toBe('number');
    }
  });

  it('write 값을 biome 실행기에 넘긴다', () => {
    const seen: boolean[] = [];
    const runners = {
      biome: (o: { write: boolean }) => {
        seen.push(o.write);
        return runnerResult('pass');
      },
      typecheck: () => runnerResult('pass'),
      vitest: () => runnerResult('pass'),
    };
    runVerify(runners, { write: false });
    runVerify(runners);
    expect(seen).toEqual([false, true]);
  });

  it('--no-write와 user-verification phase에서는 파일을 고치지 않는다', () => {
    expect(writeModeFor('implementation', [])).toBe(true);
    expect(writeModeFor('verification', [])).toBe(true);
    expect(writeModeFor('verification', ['--no-write'])).toBe(false);
    expect(writeModeFor('user-verification', [])).toBe(false);
  });

  it('전부 통과하면 검사마다 한 줄에 시간을 적고, vitest 줄에 개수 다섯 가지를 적는다', () => {
    const r = verifyWith({ biomeCheck: { stdout: 'Checked 3 files in 2ms. Fixed 2 files.\n' } });
    expect(r.ok).toBe(true);
    const out = formatVerifyReport(r).join('\n');
    expect(out).toMatch(/^biome: 통과 · 2개 파일을 고쳤다 \([\d,]+ms\)$/m);
    expect(out).toMatch(/^typecheck: 통과 · 범위 logic-only \([\d,]+ms\)$/m);
    expect(out).toMatch(
      /^vitest: 통과 · 파일 2개 · 통과 5 · 실패 0 · 파일 실패 0 · 스킵 1 \([\d,]+ms\)$/m,
    );
    expect(out).toMatch(/^합계 [\d,]+ms$/m);
    expect(out).not.toContain('다시 돌려 보기');
  });

  it('실패한 검사에만 상세 내용을 40줄까지 붙이고 다시 돌려 볼 명령을 적는다', () => {
    const long = Array.from({ length: 45 }, (_, i) => `error TS2322: 줄 ${i + 1}`).join('\n');
    const r = verifyWith({ tsc: { status: 2, stdout: long } });
    expect(r.ok).toBe(false);
    const out = formatVerifyReport(r).join('\n');
    expect(out).toMatch(/^typecheck: 실패/m);
    expect(out).toContain('줄 40');
    expect(out).not.toContain('줄 41');
    expect(out).toContain('…5줄 생략');
    expect(out).toContain('다시 돌려 보기: pnpm typecheck');
    expect(out).not.toContain('다시 돌려 보기: pnpm check');
  });

  it('pnpm을 찾지 못하면(ENOENT) 실행하지 못한 것으로 적는다', () => {
    const error = Object.assign(new Error('spawn pnpm ENOENT'), { code: 'ENOENT' });
    const r = verifyWith({ tsc: { status: null, error } });
    expect(r.results.typecheck.status).toBe('not-run');
    expect(formatVerifyReport(r).join('\n')).toContain('실행기 `typecheck`을 실행할 수 없다');
  });

  it.each([
    9009, 127,
  ])('셸이 %i로 끝나고 stdout이 비면 실행하지 못한 것이다 — stderr 첫 줄을 적는다', (code) => {
    const r = verifyWith({
      biomeCheck: { status: code, stderr: "'pnpm' is not recognized\n둘째 줄" },
    });
    expect(r.results.biome.status).toBe('not-run');
    const out = formatVerifyReport(r).join('\n');
    expect(out).toContain('`pnpm` 경로 확인');
    expect(out).toContain("'pnpm' is not recognized");
    expect(out).not.toContain('둘째 줄');
  });

  it('출력이 넘치면(ENOBUFS) 직접 돌려 보라고 적고 실패로 센다', () => {
    const error = Object.assign(new Error('spawnSync ENOBUFS'), { code: 'ENOBUFS' });
    const r = verifyWith({ tsc: { status: null, error } });
    expect(r.results.typecheck.status).toBe('fail');
    expect(formatVerifyReport(r).join('\n')).toContain(
      '출력이 너무 커서 잘렸다 — `pnpm typecheck`으로 직접 보라',
    );
  });

  it.each([
    ['결과 파일 없이 끝났다', null],
    ['결과 파일이 JSON이 아니다', '{깨진'],
  ])('vitest가 %s → 결과 없이 끝난 것으로 적는다', (_name, file) => {
    const r = verifyWith({ vitest: { file } });
    expect(r.results.vitest.status).toBe('not-run');
    expect(formatVerifyReport(r).join('\n')).toContain(
      '테스트 실행기가 결과 없이 끝났다 — `pnpm exec vitest run`으로 다시 돌려 보라',
    );
  });

  it('테스트 파일을 불러오다 죽으면(파일 실패 1 · 테스트 실패 0) 실패이고 그 메시지를 붙인다', () => {
    const file = vitestJson({
      numFailedTestSuites: 1,
      numFailedTests: 0,
      success: false,
      testResults: [
        {
          name: 'tests/logic/A.test.ts',
          status: 'failed',
          message: '불러오기 오류',
          assertionResults: [],
        },
      ],
    });
    const r = verifyWith({ vitest: { status: 1, file } });
    expect(r.results.vitest.status).toBe('fail');
    const out = formatVerifyReport(r).join('\n');
    expect(out).toMatch(/^vitest: 실패 · .*실패 0 · 파일 실패 1/m);
    expect(out).toContain('불러오기 오류');
    expect(out).toContain('다시 돌려 보기: pnpm exec vitest run tests/logic/A.test.ts');
  });

  it('종료 코드가 0이어도 결과 파일의 success가 거짓이면 실패다', () => {
    const r = verifyWith({ vitest: { status: 0, file: vitestJson({ success: false }) } });
    expect(r.results.vitest.status).toBe('fail');
  });

  it('vitest 실패에 tsconfig.cocos.json이 보이면 해결 방법 두 가지를 적는다', () => {
    const r = verifyWith({
      vitest: {
        status: 1,
        file: vitestJson({
          success: false,
          numFailedTestSuites: 1,
          testResults: [
            {
              name: 'tests/logic/B.test.ts',
              status: 'failed',
              message: 'Cannot find tsconfig.cocos.json',
              assertionResults: [],
            },
          ],
        }),
      },
    });
    const out = formatVerifyReport(r).join('\n');
    expect(out).toContain('Cocos Creator로 한 번 연다');
    expect(out).toContain('game/temp/tsconfig.cocos.json');
  });

  it('write: false에서 biome check가 실패하고 lint가 통과하면 형식 차이만 있는 것이다', () => {
    const r = verifyWith({ biomeCheck: { status: 1 }, biomeLint: { status: 0 } }, false);
    expect(r.results.biome.status).toBe('format-only');
    expect(failureKind(r)).toBe('format-only');
  });

  it('write: false에서 biome check와 lint가 모두 실패하면 린트 실패다', () => {
    const r = verifyWith({ biomeCheck: { status: 1 }, biomeLint: { status: 1 } }, false);
    expect(r.results.biome.status).toBe('fail');
    expect(failureKind(r)).toBe('real');
  });

  it('write: true면 biome check --write를 한 번만 돌린다 — 남은 실패는 린트 위반이다', () => {
    const calls: string[] = [];
    const root = makeRepo({ git: false });
    const spawn = fakeSpawn({ biomeCheck: { status: 1 } }, calls);
    const r = runVerify(makeRunners({ root, spawn }));
    expect(r.results.biome.status).toBe('fail');
    expect(calls.filter((c) => c.includes('biome'))).toEqual([
      'exec biome check --reporter=summary --write .',
    ]);
  });

  it('임시 폴더 경로에 따옴표가 있으면 명령줄을 만들지 않고 실패한다', () => {
    const root = makeRepo({ git: false });
    const r = runVerify(makeRunners({ root, spawn: fakeSpawn(), tmpRoot: 'C:\\a"b' }));
    expect(r.results.vitest.status).toBe('not-run');
    expect(formatVerifyReport(r).join('\n')).toContain(
      '임시 폴더 경로에 따옴표가 들어 있어 명령줄을 만들 수 없다: C:\\a"b',
    );
  });
});

/** 통합 검사 결과 모양. 실행기마다 상태만 정한다. */
function vr(biome: Status, typecheck: Status = 'pass', vitest: Status = 'pass') {
  const one = (status: Status) => ({ ...runnerResult(status), durationMs: 1 });
  return {
    ok: biome === 'pass' && typecheck === 'pass' && vitest === 'pass',
    results: {
      biome: one(biome),
      typecheck: { ...one(typecheck), scope: typecheck === 'pass' ? 'full' : null },
      vitest: one(vitest),
    },
  };
}

/** 적용 판정 하나. */
function gate(applies: boolean) {
  return { applies, matches: applies ? ['x'] : [], rule: '' };
}

/** 판정 입력. 기본값은 「판단 검사 · 정본 기록이 다 찼고, `/cso` 해당, QA 문서 필요」다. */
function input(over: Record<string, unknown> = {}, verification: Record<string, boolean> = {}) {
  return {
    state: {
      phase: 'verification',
      verification: {
        cso_done: true,
        ts_check_clean: false,
        lint_clean: false,
        code_review_clean: true,
        ...verification,
      },
      canon_updated: [],
      canon_skip_reason: '없음',
      cso_commit: 'abc1234',
    },
    gates: { meta: gate(false), fullTypecheck: gate(false), cso: gate(true), qa: gate(false) },
    qa: { required: true, cause: 'no-skip' as const, matches: [] as string[], hint: '' },
    qaDocRel: 'docs/qa/demo-test.md',
    canonDeclared: true,
    csoCommand: '/cso --diff --base abc1234',
    qaFingerprint: 'f'.repeat(16),
    ...over,
  };
}

/** 막힌 단계 이름만 뽑는다. */
function stages(d: { blockers: Array<{ stage: string }> }): string[] {
  return d.blockers.map((b) => b.stage);
}

describe('W2 — decideTransition: 전이 판정', () => {
  it('모두 통과하면 user-verification으로 넘어가고 기록용 값 셋을 적는다', () => {
    const d = decideTransition(input({ qaClean: true, verifyResult: vr('pass') }));
    expect(d.transition).toBe(true);
    expect(d.blockers).toEqual([]);
    expect(d.patch).toEqual({
      phase: 'user-verification',
      ts_check_scope: 'full',
      verification: { ts_check_clean: true, lint_clean: true },
    });
  });

  it.each([
    ['타입', vr('pass', 'fail')],
    ['린트', vr('fail')],
    ['테스트', vr('pass', 'pass', 'fail')],
  ])('통합 검사가 %s로 실패하면 판단 검사 결과와 정본 기록을 지우고 QA 해시값을 적는다', (_n, result) => {
    const d = decideTransition(input({ qaClean: true, verifyResult: result }));
    expect(d.transition).toBe(false);
    expect(d.patch.verification).toMatchObject({ cso_done: false, code_review_clean: false });
    expect(d.patch.canon_updated).toEqual([]);
    expect(d.patch.canon_skip_reason).toBeNull();
    expect(d.patch.qa_doc_fingerprint).toBe('f'.repeat(16));
    expect(d.patch).not.toHaveProperty('cso_commit');
    expect(d.patch).toHaveProperty('ts_check_scope');
    expect(d.blockers[0].message).toContain('통합 검사 실패 — 판단 검사 결과를 지웠다');
    expect(d.blockers[0].message).toContain('/cso --diff --base abc1234');
  });

  it.each([
    ['형식 차이만', vr('format-only'), '형식 차이'],
    ['실행기를 실행하지 못함', vr('pass', 'not-run'), '실행 환경'],
    ['결과 없이 끝남', vr('pass', 'pass', 'not-run'), '실행 환경'],
  ])('%s이면 넘어가지 않되 통과 표시는 그대로다', (_n, result, word) => {
    const d = decideTransition(input({ qaClean: true, verifyResult: result }));
    expect(d.transition).toBe(false);
    expect(d.patch.verification).not.toHaveProperty('cso_done');
    expect(d.patch.verification).not.toHaveProperty('code_review_clean');
    expect(d.patch).not.toHaveProperty('canon_updated');
    expect(d.blockers[0].message).toContain(word);
  });

  it('/cso가 해당 없으면 cso_done이 거짓이어도 통과한다', () => {
    const base = input({ qaClean: true, verifyResult: vr('pass') }, { cso_done: false });
    const d = decideTransition({ ...base, gates: { ...base.gates, cso: gate(false) } });
    expect(d.transition).toBe(true);
  });

  it('/cso를 해야 하는데 안 했으면 막히고, QA 판정과 통합 검사는 돌리지 않는다', () => {
    const d = decideTransition(input({}, { cso_done: false }));
    expect(d.transition).toBe(false);
    expect(d.needsQa).toBe(false);
    expect(d.needsVerify).toBe(false);
    expect(stages(d)).toEqual(['judgement']);
  });

  it('판단 검사가 다 찼고 QA 문서가 필요하면 needsQa다', () => {
    const d = decideTransition(input());
    expect(d.needsQa).toBe(true);
    expect(d.needsVerify).toBe(false);
  });

  it('QA 문서가 필요 없으면 QA 판정 없이 통합 검사로 간다', () => {
    const d = decideTransition(
      input({ qa: { required: false, cause: 'skip-valid', matches: [], hint: '' } }),
    );
    expect(d.needsQa).toBe(false);
    expect(d.needsVerify).toBe(true);
  });

  it('QA 문서가 없으면 막히고 통합 검사를 돌리지 않는다 — 사유가 있으면 사유가 맞지 않는다고 적는다', () => {
    const plain = decideTransition(input({ qaClean: 'missing' }));
    expect(plain.needsVerify).toBe(false);
    expect(plain.blockers[0].message).toBe('QA 문서가 없다: docs/qa/demo-test.md');

    const stale = decideTransition(
      input({
        qaClean: 'missing',
        qa: { required: true, cause: 'game-change', matches: ['game/a.ts'], hint: '' },
      }),
    );
    expect(stale.blockers[0].message).toBe(
      '생략 사유가 더는 맞지 않는다: game/a.ts — QA 문서가 필요하다: docs/qa/demo-test.md',
    );
  });

  it('QA 문서가 확정되지 않았거나 정본 갱신 기록이 없으면 막히고 통합 검사를 돌리지 않는다', () => {
    const qa = decideTransition(input({ qaClean: false }));
    expect(stages(qa)).toEqual(['qa']);
    expect(qa.needsVerify).toBe(false);

    const canon = decideTransition(input({ qaClean: true, canonDeclared: false }));
    expect(stages(canon)).toEqual(['canon']);
    expect(canon.needsVerify).toBe(false);
  });
});

describe('W2 — qaRequired: QA 문서가 필요한가', () => {
  const measurable = (paths: string[]) => ({
    measurable: true as const,
    base: 'abc',
    items: paths.map((p) => ({ status: 'A' as const, path: p })),
  });

  it('사유가 없으면 필요하다', () => {
    expect(qaRequired({}, measurable([])).required).toBe(true);
  });

  it('사유가 있고 game/** 변경이 없으면 생략해도 된다', () => {
    expect(qaRequired({ qa_skip_reason: '문서만' }, measurable(['docs/a.md'])).required).toBe(
      false,
    );
  });

  it('사유가 있어도 game/** 변경이 있으면 필요하다 — 해당한 파일을 든다', () => {
    const q = qaRequired({ qa_skip_reason: '문서만' }, measurable(['game/assets/a.png']));
    expect(q).toMatchObject({
      required: true,
      cause: 'game-change',
      matches: ['game/assets/a.png'],
    });
  });

  it('사유가 있어도 변경 집합을 구할 수 없으면 필요하다 — 원인별 안내를 든다', () => {
    const q = qaRequired(
      { qa_skip_reason: '문서만' },
      {
        measurable: false,
        reason: 'no-origin-main',
        hint: '기준을 구할 수 없어 모든 검사를 한다 — git fetch origin main',
      },
    );
    expect(q).toMatchObject({ required: true, cause: 'unmeasurable' });
    expect(q.hint).toContain('git fetch origin main');
  });
});

describe('W2 — csoGuideLine: 다음 /cso 안내', () => {
  it('해당 없음 · 바뀐 부분만 · 처음부터 전체를 구분한다', () => {
    expect(csoGuideLine({ cso: gate(false) }, { usable: true }, 'abc')).toContain('해당 없음');
    expect(csoGuideLine({ cso: gate(true) }, { usable: true }, 'abc')).toBe(
      '`/cso`는 바뀐 부분만 다시 본다: `/cso --diff --base abc`',
    );
    const full = csoGuideLine({ cso: gate(true) }, { usable: false, reason: '기록 없음' }, null);
    expect(full).toContain('기록 없음');
    expect(full).not.toContain('--diff');
  });
});

/** 임시 저장소의 상태 파일을 읽는다. */
function stateOf(repo: string): SandboxState {
  return JSON.parse(fs.readFileSync(path.join(repo, '.claude/workflow-state.json'), 'utf8'));
}

/** 임시 저장소의 상태 파일에 값을 덮어쓴다(커밋은 하지 않는다). */
function patchState(repo: string, patch: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(repo, '.claude/workflow-state.json'),
    `${JSON.stringify({ ...stateOf(repo), ...patch }, null, 2)}\n`,
  );
}

/** 판단 검사 두 개와 정본 기록이 다 찬 verification 저장소. */
function readyRepo(opts: RepoOptions = {}): string {
  const repo = makeRepo({
    phase: 'verification',
    allChecksClean: true,
    canonSkipReason: '바꾼 명세 없음',
    ...opts,
  });
  patchState(repo, {
    verification: {
      cso_done: true,
      ts_check_clean: true,
      lint_clean: true,
      code_review_clean: true,
    },
  });
  return repo;
}

describe('W2 — 명령: pass · invalidate · skip-qa · verify', SANDBOX, () => {
  it('pass ts · pass lint는 안내와 함께 실패한다', () => {
    const repo = makeRepo({ git: false });
    for (const check of ['ts', 'lint']) {
      const r = runWf(repo, ['pass', check]);
      expect(r.status, check).toBe(1);
      expect(r.stderr).toContain('타입·린트 결과는 통합 검사가 기록한다');
      expect(r.stderr).toContain('pnpm wf verify');
    }
  });

  it('/cso가 해당 없을 때 pass cso는 기준 커밋만 적고 cso_done은 거짓으로 둔다', () => {
    const repo = makeRepo();
    const r = runWf(repo, ['pass', 'cso']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('기준 커밋만 기록한다');
    const s = stateOf(repo);
    expect(s.cso_commit).toBe(git(repo, 'rev-parse', 'HEAD').trim());
    expect(s.verification.cso_done).toBe(false);
  });

  it('/cso를 해야 할 때 pass cso는 cso_done과 cso_commit을 적고 출력에 HEAD를 적는다', () => {
    const repo = makeRepo({ csoApplicable: true });
    const r = runWf(repo, ['pass', 'cso']);
    expect(r.status, r.stderr).toBe(0);
    const head = git(repo, 'rev-parse', 'HEAD').trim();
    expect(r.stdout).toContain(`(HEAD ${git(repo, 'rev-parse', '--short', 'HEAD').trim()})`);
    const s = stateOf(repo);
    expect(s.verification.cso_done).toBe(true);
    expect(s.cso_commit).toBe(head);
  });

  it('invalidate는 /cso 통과 표시를 지우고 cso_commit과 기록용 값 셋은 남긴다', () => {
    const repo = readyRepo({ csoApplicable: true });
    const base = git(repo, 'rev-parse', 'HEAD~1').trim();
    patchState(repo, { cso_commit: base, ts_check_scope: 'full' });
    const r = runWf(repo, ['invalidate']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain(`/cso --diff --base ${base}`);
    const s = stateOf(repo);
    expect(s.verification).toMatchObject({
      cso_done: false,
      code_review_clean: false,
      ts_check_clean: true,
      lint_clean: true,
    });
    expect(s.ts_check_scope).toBe('full');
    expect(s.cso_commit).toBe(base);
  });

  it('cso_commit이 HEAD의 조상이 아니면(리베이스 뒤) invalidate가 전체 /cso를 안내한다', () => {
    const repo = readyRepo({ csoApplicable: true });
    git(repo, 'commit', '--quiet', '--allow-empty', '-m', 'c4');
    const gone = git(repo, 'rev-parse', 'HEAD').trim();
    git(repo, 'reset', '--hard', '--quiet', 'HEAD~1');
    git(repo, 'commit', '--quiet', '--allow-empty', '-m', 'c4 다시');
    patchState(repo, { cso_commit: gone });
    const r = runWf(repo, ['invalidate']);
    expect(r.stdout).toContain('지금 HEAD의 조상이 아님');
    expect(r.stdout).not.toContain('--diff');
  });

  it('/cso를 해야 하는데 pass cso 전에 pass review를 치면 통합 검사를 돌리지 않는다', () => {
    const repo = makeRepo({ csoApplicable: true, canonSkipReason: '없음' });
    const r = runWf(repo, ['pass', 'review']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).not.toContain('▶ 통합 검사');
    expect(stateOf(repo).phase).toBe('verification');
  });

  it('skip-qa는 game/** 변경이 있으면 받지 않는다', () => {
    const repo = makeRepo({ phase: 'implementation', gameChange: true });
    const r = runWf(repo, ['skip-qa', '문서만 바뀐다']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('QA 문서가 필요하다: game/assets/scripts/x.ts');
    expect(r.stderr).toContain('절차: `pnpm wf steps implementation`');
    expect(stateOf(repo)).not.toHaveProperty('qa_skip_reason');
  });

  it('skip-qa는 사유를 적고, --clear 뒤 status는 「QA 문서 생략: 없음」을 출력한다', () => {
    const repo = makeRepo({ phase: 'qa-setup' });
    const set = runWf(repo, ['skip-qa', '문서만 바뀐다']);
    expect(set.status, set.stderr).toBe(0);
    expect(set.stdout).toContain('생략은 `game/**` 변경이 없는 동안만 유효하다');
    expect(stateOf(repo).qa_skip_reason).toBe('문서만 바뀐다');

    expect(runWf(repo, ['skip-qa', '--clear']).status).toBe(0);
    expect(stateOf(repo)).not.toHaveProperty('qa_skip_reason');
    expect(runWf(repo, ['status']).stdout).toContain('QA 문서 생략: 없음');
  });

  it('origin/main이 없으면 skip-qa가 변경 집합을 구할 수 없다는 안내와 함께 받지 않는다', () => {
    const repo = makeRepo({ phase: 'qa-setup' });
    git(repo, 'update-ref', '-d', 'refs/remotes/origin/main');
    const r = runWf(repo, ['skip-qa', '문서만 바뀐다']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('변경 집합을 구할 수 없어 QA 문서가 필요하다: docs/qa/demo-test.md');
    expect(r.stderr).toContain('git fetch origin main');
  });

  it('verify는 planning에서 거부한다', () => {
    const r = runWf(makeRepo({ phase: 'planning', git: false }), ['verify']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('코드를 검사하는 phase가 아니다');
  });
});

describe('W2 — 옛 형식 상태 파일(새 값이 없다)', SANDBOX, () => {
  it('ready-impl은 QA 문서를 요구한다', () => {
    const repo = makeRepo({ phase: 'qa-setup', testSkipped: true, qaDoc: false, git: false });
    const r = runWf(repo, ['ready-impl']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('QA 문서가 없다: docs/qa/demo-test.md');
    expect(r.stderr).toContain('절차: `pnpm wf steps qa-setup`');
  });

  it('pass는 QA 문서를 요구하고 통합 검사를 돌리지 않는다', () => {
    const r = runWf(readyRepo({ qaDoc: false, git: false }), ['pass', 'review']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('QA 문서가 없다: docs/qa/demo-test.md');
    expect(r.stdout).not.toContain('▶ 통합 검사');
  });

  it('status는 「QA 문서 생략: 없음」을 출력하고 멈추지 않는다', () => {
    const repo = makeRepo({ git: false });
    fs.copyFileSync(
      path.join(HERE, 'fixtures/workflow-state/user-verification-legacy.json'),
      path.join(repo, '.claude/workflow-state.json'),
    );
    const r = runWf(repo, ['status']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('QA 문서 생략: 없음');
  });

  it('invalidate는 전체 /cso를 안내한다', () => {
    const r = runWf(readyRepo({ git: false }), ['invalidate']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('기록 없음');
    expect(r.stdout).not.toContain('--diff');
  });
});

// 통합 검사까지 실제로 돌리는 테스트. Windows에서 한 건에 1~1.5초가 걸려 여섯 개 이하로 둔다(W2 §8).
describe('W2 — E2E: 통합 검사를 실제로 돌린다', SANDBOX, () => {
  it('start-verification 성공 — verification으로 넘어가고 기록용 값 셋을 적고, 전체 /cso를 안내한다', () => {
    const repo = makeRepo({ phase: 'implementation', csoApplicable: true });
    const r = runWf(repo, ['start-verification']);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/^vitest: 통과 · 파일 1개/m);
    expect(r.stdout).toContain('기록 없음');
    const s = stateOf(repo);
    expect(s.phase).toBe('verification');
    expect(s.verification).toMatchObject({ ts_check_clean: true, lint_clean: true });
    expect(s.ts_check_scope).toBe('logic-only');
  });

  it('start-verification 실패 — 넘어가지 않고 절차 문서를 찾아갈 한 줄로 끝낸다', () => {
    const repo = makeRepo({ phase: 'implementation' });
    const r = runWf(repo, ['start-verification'], { WF_SHIM_FAIL: 'vitest' });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^vitest: 실패/m);
    expect(r.stderr).toContain('절차: `pnpm wf steps implementation`');
    expect(stateOf(repo).phase).toBe('implementation');
    expect(stateOf(repo).ts_check_scope).toBe('logic-only');
  });

  it('verify는 세 phase에서 돌고 phase와 판단 검사 기록을 건드리지 않는다', () => {
    for (const phase of ['implementation', 'verification', 'user-verification']) {
      const repo = readyRepo({ phase, git: false });
      patchState(repo, { qa_doc_fingerprint: 'q' });
      const before = stateOf(repo);
      const r = runWf(repo, ['verify']);
      expect(r.status, `${phase}: ${r.stderr}`).toBe(0);
      const after = stateOf(repo);
      expect(after.phase).toBe(phase);
      expect(after.verification.cso_done).toBe(before.verification.cso_done);
      expect(after.verification.code_review_clean).toBe(before.verification.code_review_clean);
      expect(after.canon_skip_reason).toBe(before.canon_skip_reason);
      expect(after.canon_updated).toEqual(before.canon_updated);
      expect(after.qa_doc_fingerprint).toBe('q');
    }
  });

  it('pass review의 통합 검사가 실제로 실패하면 넘어가지 않고 판단 검사 결과를 지운다', () => {
    const repo = readyRepo({ git: false });
    const r = runWf(repo, ['pass', 'review'], { WF_SHIM_FAIL: 'vitest' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('판단 검사 결과를 지웠다');
    const s = stateOf(repo);
    expect(s.phase).toBe('verification');
    expect(s.verification).toMatchObject({ cso_done: false, code_review_clean: false });
    expect(s.canon_skip_reason).toBeNull();
    expect(s.qa_doc_fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it('pass review가 형식 차이만으로 실패하면 통과 표시를 남긴다', () => {
    const repo = readyRepo({ git: false });
    const r = runWf(repo, ['pass', 'review'], { WF_SHIM_FAIL: 'biome-format' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('형식 차이');
    const s = stateOf(repo);
    expect(s.phase).toBe('verification');
    expect(s.verification).toMatchObject({ cso_done: true, code_review_clean: true });
    expect(s.canon_skip_reason).toBe('바꾼 명세 없음');
  });

  it('skip-qa 뒤 game/** 변경이 생기면 QA 문서 없이는 pass review가 넘어가지 않는다', () => {
    const repo = readyRepo({ qaDoc: false, gameChange: true });
    patchState(repo, { qa_skip_reason: '문서만' });
    const r = runWf(repo, ['pass', 'review']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(
      '생략 사유가 더는 맞지 않는다: game/assets/scripts/x.ts — QA 문서가 필요하다: docs/qa/demo-test.md',
    );
    expect(stateOf(repo).phase).toBe('verification');
  });
});
