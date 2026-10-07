/**
 * 워크플로우 다이어트 1단계(`feat/workflow-diet`)의 테스트.
 *
 * 작업 묶음마다 절을 하나씩 두고, 묶음을 시작할 때 그 절의 실패하는 테스트를 먼저 쓴다. 지금 있는
 * 절은 W1(변경 집합과 적용 판정)이다. W2~W4의 테스트는 그 묶음을 시작할 때 더한다. W5(임시 저장소
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
import { cleanupSandboxes, git, makeRepo } from './helpers/WfSandbox';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/** 임시 저장소를 쓰는 절의 시간 제한. */
const SANDBOX = { timeout: 30_000 };

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
    const cs = collectChangeSet(repo);
    expect(cs.measurable).toBe(true);
    expect(cs.base).toBe(git(repo, 'rev-parse', 'origin/main').trim());
    expect(cs.items).toEqual([]);
  });

  it('추적 파일의 수정·새 파일·삭제를 M·A·D로 잡는다', () => {
    const repo = makeRepo();
    write(repo, 'README.md', 'changed\n');
    write(repo, 'docs/new.md');
    fs.rmSync(path.join(repo, 'docs/development/workflow/README.md'));
    const cs = collectChangeSet(repo);
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
    const cs = collectChangeSet(repo);
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
    expect(collectChangeSet(repo).items).toContainEqual({ status: 'A', path: 'docs/staged.md' });
  });

  it('공백과 한글이 든 파일명을 그대로 돌려준다', () => {
    const repo = makeRepo();
    write(repo, 'docs/새 문서 초안.md');
    expect(collectChangeSet(repo).items).toContainEqual({
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
    const paths = collectChangeSet(repo).items.map((i: { path: string }) => i.path);
    expect(paths).not.toContain('.claude/workflow-state.json');
    expect(paths).not.toContain('game/assets/art/a.png.meta');
  });

  it('--name-status의 T(파일 형식 변경)는 M으로 읽는다', () => {
    const cs = collectChangeSet(ROOT, { run: fakeGitWithDiff('T\0tools/x.sh\0') });
    expect(cs.measurable).toBe(true);
    expect(cs.items).toEqual([{ status: 'M', path: 'tools/x.sh' }]);
  });
});

describe('W1 — 변경 집합을 구할 수 없으면 모든 검사를 한다', SANDBOX, () => {
  /** 네 검사가 전부 「적용」인지. 건너뛰어도 되는지 알 수 없을 때는 건너뛰지 않는다. */
  function expectAllApply(cs: unknown): void {
    const gates = applicableGates(cs);
    for (const name of ['meta', 'fullTypecheck', 'cso', 'qa'] as const) {
      expect(gates[name].applies, name).toBe(true);
    }
  }

  it('origin/main 참조가 없다 → git fetch origin main', () => {
    const repo = makeRepo();
    git(repo, 'update-ref', '-d', 'refs/remotes/origin/main');
    const cs = collectChangeSet(repo);
    expect(cs.measurable).toBe(false);
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
    const cs = collectChangeSet(repo);
    expect(cs.measurable).toBe(false);
    expect(cs.hint).toContain('git fetch --unshallow');
    expectAllApply(cs);
  });

  it('git 저장소가 아니다 → 저장소 루트에서 실행(여기는 git 저장소가 아니다)', () => {
    const dir = makeRepo({ git: false });
    const cs = collectChangeSet(dir);
    expect(cs.measurable).toBe(false);
    expect(cs.hint).toContain('여기는 git 저장소가 아니다');
    expectAllApply(cs);
  });

  it('하위 폴더에서 실행했다 → 저장소 루트에서 실행', () => {
    // 경로 문자열을 비교하지 않는다. 이 장비에서 git은 `F:/…`를, Node는 `F:\…`를 내서 비교가 항상
    // 틀린다. `rev-parse --show-prefix`가 비어 있지 않으면 하위 폴더다.
    const repo = makeRepo();
    const cs = collectChangeSet(path.join(repo, 'docs'));
    expect(cs.measurable).toBe(false);
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
    const cs = collectChangeSet(ROOT, { run });
    expect(cs.measurable).toBe(false);
    expect(cs.hint).toContain('spawn git ENOENT');
    expect(cs.hint).not.toContain('둘째 줄');
    expect(cs.hint).toContain('git status');
    expectAllApply(cs);
  });

  it('U 같은 알 수 없는 상태 글자 → 충돌을 풀고 다시', () => {
    const cs = collectChangeSet(ROOT, { run: fakeGitWithDiff('U\0x.txt\0') });
    expect(cs.measurable).toBe(false);
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
