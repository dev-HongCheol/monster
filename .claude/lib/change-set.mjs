// @ts-check
/**
 * 변경 집합과 적용 판정.
 *
 * 이 브랜치가 main에서 갈라진 뒤 무엇이 바뀌었는지(변경 집합)를 git에서 구하고, 그 목록으로 검사 네 가지
 * (`.meta` 누락 · 게임 전체 타입 검사 · `/cso` · QA 문서)를 할지 말지 판정한다. 적용 경로의 정본은 이
 * 파일의 상수와 그 위 주석이다. 판정 결과는 저장하지 않고 부를 때마다 다시 계산한다.
 *
 * 경로 비교는 git pathspec에 맡기지 않고 여기서 한다. 판정 함수가 메모리의 변경 집합만 받아야 테스트가
 * git 출력을 흉내 내서 넣을 수 있고(`T`·`U` 상태 글자, 실행 실패, Windows에서 만들 수 없는 `.Claude/`),
 * 검사마다 git을 다시 띄우지 않기 때문이다(2026-10-07 pathspec 시험 뒤 결정).
 */

import { git as runGit } from './git.mjs';

/** @typedef {{ status: 'A' | 'M' | 'D', path: string }} ChangeItem */
/** @typedef {{ measurable: true, base: string, items: ChangeItem[] }} MeasurableChangeSet */
/**
 * @typedef {'no-origin-main' | 'no-merge-base' | 'not-a-repo' | 'not-root' | 'git-failed' | 'unknown-status'}
 *   UnmeasurableReason
 */
/** @typedef {{ measurable: false, reason: UnmeasurableReason, hint: string }} UnmeasurableChangeSet */
/** @typedef {MeasurableChangeSet | UnmeasurableChangeSet} ChangeSet */
/** @typedef {{ applies: boolean, matches: string[], rule: string }} GateDecision */
/** @typedef {{ meta: GateDecision, fullTypecheck: GateDecision, cso: GateDecision, qa: GateDecision }} Gates */
/** @typedef {{ status: number | null, stdout: string, stderr: string, error?: Error }} GitResult */
/** @typedef {(args: string[]) => GitResult} GitRunner */

// ---------------------------------------------------------------------------
// 적용 경로 — 상수마다 위 주석이 정책이다. 경로 목록만 고치다가 왜 들어갔는지 잊지 않게 하려는 것이다.
// 글롭은 줄 주석에만 쓴다(블록 주석 안의 `**/`는 주석을 닫는다).
// ---------------------------------------------------------------------------

// 정책: 개발 장비에서 실행되는 코드·자동화·의존성·공급망·git 실행 동작을 바꾸는 파일.
//
// - 테스트 파일(*.test.ts)을 빼는 예외. 테스트도 개발 장비에서 실행되는 코드다. 하지만 넣으면 모든
//   슬라이스가 만드는 기능 테스트 파일 때문에 /cso가 「해당 없음」으로 나오는 경우가 한 번도 없다
//   (2026-09-17 결정). 그 대신 프로세스를 띄우는 테스트 코드는 각 영역의 helpers/에 두고(그 폴더는
//   여기 들어 있다), 「helpers/·fixtures/ 밖의 tests/ 파일은 프로세스를 띄우지 않는다」를 테스트 하나로
//   지킨다(WorkflowDiet.test.ts). 그 테스트는 프로세스 모듈을 직접 import하는지만 보므로, helpers/의
//   git 도우미는 받을 수 있는 하위 명령을 허용 목록으로 제한한다(WfSandbox.ts).
// - 게임 코드(game/**)를 넣지 않는 것도 조건이 붙은 예외다. 지금 게임에는 결제·로그인·서버·외부 연동이
//   없어서 게임 코드가 바뀌어도 /cso가 찾는 위험(개발 장비에서 명령이 실행되거나 비밀값이 새는 것)이
//   생기지 않는다. v2가 Steam 유료 출시와 스킨 판매를 계획하므로(백로그 F61), 구매 확인이나 Steam 연동
//   코드가 게임에 들어오면 그 경로를 여기 더한다. 더하지 않으면 그 코드는 보안 점검 없이 머지된다.
// - 외부 기여자의 PR을 받기 시작하면 CLAUDE.md · .claude/commands/** · docs/development/workflow/**를
//   더한다. AI가 그대로 따라 실행하는 지시문이라 자동화 설정과 같다(백로그 F109).
// - .claude/** 전체가 아니라 저장소가 추적하는 파일만 넣는다. Claude Code가 버전마다 새로 만드는 파일
//   (settings.local.json, worktrees/ 등)은 처음부터 해당하지 않게 된다. .claude/commands/**는 생기면
//   더한다. 상태 파일은 변경 집합에서 빼므로(collectChangeSet) 여기 없어도 같다.
// - .github/** · .npmrc · pnpm-workspace.yaml · .gitmodules · .mcp.json은 아직 없지만 생기는 순간
//   해당해야 해서 미리 넣는다.
// - .env*는 넣지 않는다. git이 이미 무시해서 변경 집합에 들어오지 않고, 비밀값은 어느 파일에든 들어갈 수
//   있어 경로로는 잡을 수 없다. 비밀값은 코드 리뷰가 확인한다.
export const CSO_PATHS = [
  '.claude/*.mjs',
  '.claude/hooks/**',
  '.claude/lib/**',
  '.claude/settings.json',
  'tools/**',
  'tests/**/helpers/**',
  'tests/**/fixtures/**',
  '.husky/**',
  '.vscode/**',
  '.github/**',
  'vitest.config.*',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  'tsconfig*.json',
  'biome.json',
  '.gitattributes',
  '.gitignore',
  '.gitmodules',
  '.mcp.json',
  'game/tsconfig.json',
  'game/package.json',
  '**/*.{sh,ps1,cmd,bat,py}',
];

// 정책: Cocos가 .meta를 만드는 폴더. 여기에 변경이 있을 때만 .meta 누락을 검사한다.
export const META_PATHS = ['game/assets/**'];

// 정책: 게임 코드의 타입 검사 결과를 바꿀 수 있는 파일.
//
// - game/** 전체로 두지 않는다. game/assets/에는 그림과 .meta가 많아서 그렇게 두면 그림만 바꿔도 게임
//   전체 타입 검사를 해야 한다. TypeScript 파일은 폴더가 아니라 확장자로 지정한다 — 지금 .ts는
//   game/assets/scripts/에만 있지만 다른 폴더에 생겨도 해당해야 한다.
// - 게임 코드는 지금 JSON을 import하지 않는다(WorkflowDiet.test.ts가 지킨다). import하기 시작하면 JSON을
//   바꿔도 타입 검사 결과가 바뀌므로 그때 경로를 넓힌다.
// - 루트 package.json은 넣지 않는다. 의존성이 바뀌면 pnpm-lock.yaml도 함께 바뀌고, scripts 줄만 고치는
//   것은 타입과 관계가 없다.
// - game/settings/**를 넣는 이유: Cocos 3.8 매뉴얼(scripting/modules/engine.html)이 `cc` 모듈의 내용은
//   프로젝트 설정의 Feature Cropping에 따라 달라진다고 적고 있고, 그 설정은
//   game/settings/v2/packages/engine.json에 저장된다. 설정이 바뀌면 Cocos가 만드는 cc.d.ts가 바뀐다
//   (2026-10-07 확인).
export const FULL_TYPECHECK_PATHS = [
  'game/**/*.ts',
  'game/tsconfig.json',
  'game/package.json',
  'game/settings/**',
  'pnpm-lock.yaml',
];

// 정책: 게임 동작을 바꿀 수 있어서 사용자가 인게임에서 확인할 목록(QA 문서)이 필요한 파일.
// META_PATHS보다 넓은 이유는 화면 크기나 물리 설정이 든 game/settings/ 아래 파일만 고쳐도 게임 동작이
// 바뀌기 때문이다.
export const QA_PATHS = ['game/**'];

/**
 * 코드를 고친 뒤 바뀐 부분만 다시 보는 `/cso` 명령. `invalidate`·`start-verification`·`status`와
 * 테스트가 모두 이 상수를 쓴다. 전체 명령은 `${CSO_DIFF_COMMAND} <기준 커밋>`이다.
 */
export const CSO_DIFF_COMMAND = '/cso --diff --base';

/** 변경 집합에서 빼는 파일. 도구가 스스로 쓰는 파일이라 넣으면 모든 슬라이스에 `.claude/**` 변경이 생긴다. */
const STATE_FILE = '.claude/workflow-state.json';

/** 변경 집합을 구할 수 없을 때의 원인별 안내. 적용 판정을 쓰는 모든 명령이 같은 문구를 출력한다. */
const HINTS = {
  'no-origin-main': 'origin/main 참조가 없다. `git fetch origin main`',
  'no-merge-base':
    'origin/main과 HEAD에 공통 조상이 없다(얕은 클론이거나 이력이 다른 origin/main). ' +
    '`git fetch --unshallow` 또는 `git fetch origin main`',
  'not-a-repo': '저장소 루트에서 실행(여기는 git 저장소가 아니다)',
  'not-root': '저장소 루트에서 실행',
  'unknown-status':
    '알 수 없는 상태 글자가 나왔다. 충돌을 풀고 다시 ' +
    '(`docs/development/troubleshooting/workflow-state-cross-machine.md`)',
};

/**
 * 「구할 수 없음」 결과를 만든다. 문구는 「기준을 구할 수 없어 모든 검사를 한다 — 원인. 처방」 한 줄이다.
 *
 * @param {UnmeasurableReason} reason
 * @param {string} detail 원인에 붙일 설명(`git-failed`는 stderr 첫 줄)
 * @returns {UnmeasurableChangeSet}
 */
function unmeasurable(reason, detail) {
  return { measurable: false, reason, hint: `기준을 구할 수 없어 모든 검사를 한다 — ${detail}` };
}

/**
 * git 실행 자체가 실패했을 때(`error`가 있거나 `status`가 null) 쓸 안내.
 * @param {GitResult} r
 */
function gitFailed(r) {
  const firstLine = (r.stderr || r.error?.message || '').split(/\r?\n/)[0].trim();
  return unmeasurable('git-failed', `git 출력을 받지 못했다: ${firstLine}. \`git status\`로 확인`);
}

/**
 * `spawnSync` 결과가 「실행은 됐다」인지. `error`가 있거나 `status`가 null이면 실행이 안 된 것이다.
 * @param {GitResult} r
 */
function ran(r) {
  return !r.error && r.status !== null;
}

/**
 * 이 브랜치의 변경 집합을 구한다.
 *
 * 기준은 `git merge-base origin/main HEAD`(이 브랜치가 main에서 갈라진 커밋)다. 추적 파일의 변경은
 * `git diff --name-status -z --no-renames <기준>`으로, 추적하지 않는 새 파일은
 * `git ls-files -o --exclude-standard -z`로 얻어서 합친다. 그래서 작업 폴더의 지금 파일 기준이다 —
 * `git add`만 한 새 파일은 `A`로, 커밋하지 않은 수정은 `M`으로 잡힌다.
 *
 * - `--no-renames`가 있어야 이름을 바꾼 파일이 「삭제 하나 + 추가 하나」로 나온다. 없으면 한 항목이 세
 *   조각(R100·옛 경로·새 경로)으로 나와 그 뒤의 항목까지 잘못 읽는다.
 * - `T`(파일 형식 변경)는 `M`으로 읽는다. 그 밖의 글자(`U` 등)가 나오면 구할 수 없음으로 처리한다.
 * - 뺀다: 상태 파일(STATE_FILE), 그리고 git이 추적하지 않는 `*.meta`. 후자는 Cocos가 만든 것이지
 *   개발자가 바꾼 것이 아니고, 빼도 `.meta` 누락 검사 결과는 같다 — 그 검사는 「추적하는 자산 파일 옆의
 *   `.meta`도 추적되는가」로 판정하고, 새 자산은 자산 파일 자체가 `game/assets/**`에 속하기 때문이다.
 * - 판정하기 전에 `fetch`하지 않는다. 로컬 `origin/main`이 원격보다 뒤처져 있으면 갈라진 커밋이 더
 *   앞쪽이 되어 변경 집합이 커지기만 하므로, 틀리더라도 검사를 덜 하는 쪽으로는 틀리지 않는다.
 *
 * 저장소 루트인지는 `rev-parse --show-prefix`가 비어 있는지로 본다. 경로 문자열을 비교하면 git은 `F:/…`를,
 * Node는 `F:\…`를 내서 항상 틀린다.
 *
 * @param {string} root 명령을 실행한 폴더
 * @param {{ run?: GitRunner }} [deps] `run`을 주면 git 대신 그것을 부른다(테스트가 git 출력을 흉내 낼 때)
 * @returns {ChangeSet}
 */
export function collectChangeSet(root, { run = (args) => runGit(root, args) } = {}) {
  const prefix = run(['rev-parse', '--show-prefix']);
  if (!ran(prefix)) return gitFailed(prefix);
  if (prefix.status !== 0) return unmeasurable('not-a-repo', HINTS['not-a-repo']);
  if (prefix.stdout.trim() !== '') return unmeasurable('not-root', HINTS['not-root']);

  const origin = run(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main']);
  if (!ran(origin)) return gitFailed(origin);
  if (origin.status !== 0) return unmeasurable('no-origin-main', HINTS['no-origin-main']);

  // 공통 조상이 없으면 merge-base는 종료 코드 1과 빈 출력을 낸다. status가 null이 아니라 실행 실패와는
  // 다르고, 잡지 않으면 기준 커밋이 빈 문자열인 채로 diff를 실행하게 된다.
  const mergeBase = run(['merge-base', 'refs/remotes/origin/main', 'HEAD']);
  if (!ran(mergeBase)) return gitFailed(mergeBase);
  if (mergeBase.status === 1 && mergeBase.stdout.trim() === '') {
    return unmeasurable('no-merge-base', HINTS['no-merge-base']);
  }
  if (mergeBase.status !== 0) return gitFailed(mergeBase);
  const base = mergeBase.stdout.trim();

  const diff = run(['diff', '--name-status', '-z', '--no-renames', base]);
  if (!ran(diff) || diff.status !== 0) return gitFailed(diff);
  const untracked = run(['ls-files', '-o', '--exclude-standard', '-z']);
  if (!ran(untracked) || untracked.status !== 0) return gitFailed(untracked);

  /** @type {ChangeItem[]} */
  const items = [];
  const tracked = diff.stdout.split('\0').filter((s) => s !== '');
  for (let i = 0; i + 1 < tracked.length; i += 2) {
    const letter = tracked[i][0];
    const p = tracked[i + 1];
    if (letter === 'A' || letter === 'M' || letter === 'D') items.push({ status: letter, path: p });
    else if (letter === 'T') items.push({ status: 'M', path: p });
    else return unmeasurable('unknown-status', HINTS['unknown-status']);
  }
  for (const p of untracked.stdout.split('\0')) {
    if (p !== '' && !p.endsWith('.meta')) items.push({ status: 'A', path: p });
  }

  return {
    measurable: true,
    base,
    items: items
      .filter((it) => it.path !== STATE_FILE)
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  };
}

/**
 * 글롭 하나를 정규식으로 바꾼다. 지원하는 것은 적용 경로 상수가 쓰는 네 가지다 — `**`(폴더 깊이 무관),
 * `*`(한 구간 안에서 아무 글자), `{a,b}`(둘 중 하나), 그리고 글자 그대로. 폴더 경계를 지키므로
 * `tools/**`는 `toolsmith/x`에 맞지 않는다. 대소문자는 구분하지 않는다 — 보호하는 폴더 이름과 대소문자만
 * 다른 경로(`.Claude/`)를 같은 폴더로 보기 위해서다.
 *
 * @param {string} glob
 * @returns {RegExp}
 */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**/` 는 「폴더 0개 이상」, 끝의 `**`는 「나머지 전부」다.
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '{') {
      const end = glob.indexOf('}', i);
      re += `(?:${glob
        .slice(i + 1, end)
        .split(',')
        .map(escapeRegExp)
        .join('|')})`;
      i = end;
    } else {
      re += escapeRegExp(c);
    }
  }
  return new RegExp(`^${re}$`, 'i');
}

/** @param {string} s */
function escapeRegExp(s) {
  return s.replace(/[.+?^$()|[\]\\]/g, '\\$&');
}

/**
 * 변경 집합이 적용 경로 목록에 해당하는지 판정한다.
 *
 * @param {ChangeItem[]} items
 * @param {string[]} patterns
 * @returns {GateDecision} `matches`는 해당한 파일 경로, `rule`은 그 파일이 해당한 적용 경로(없으면 빈 문자열)
 */
function decide(items, patterns) {
  const compiled = patterns.map((p) => ({ glob: p, re: globToRegExp(p) }));
  /** @type {string[]} */
  const matches = [];
  /** @type {Set<string>} */
  const rules = new Set();
  for (const it of items) {
    const hit = compiled.filter((c) => c.re.test(it.path));
    if (hit.length === 0) continue;
    matches.push(it.path);
    for (const h of hit) rules.add(h.glob);
  }
  return { applies: matches.length > 0, matches, rule: [...rules].join(' · ') };
}

/**
 * 검사 네 가지를 할지 말지. 변경 집합을 구할 수 없으면 전부 「적용」이다 — 건너뛰어도 되는지 알 수 없을
 * 때는 건너뛰지 않는다.
 *
 * @param {ChangeSet} changeSet
 * @returns {Gates}
 */
export function applicableGates(changeSet) {
  if (!changeSet.measurable) {
    const all = () => ({ applies: true, matches: [], rule: '변경 집합을 구할 수 없음' });
    return { meta: all(), fullTypecheck: all(), cso: all(), qa: all() };
  }
  const { items } = changeSet;
  return {
    meta: decide(items, META_PATHS),
    fullTypecheck: decide(items, FULL_TYPECHECK_PATHS),
    cso: decide(items, CSO_PATHS),
    qa: decide(items, QA_PATHS),
  };
}

/**
 * 상태 파일의 `cso_commit`을 `/cso --diff --base`의 기준으로 쓸 수 있는지.
 *
 * 쓸 수 없는 경우는 셋이고 이유가 다르다. 값이 없으면 「기록 없음」. 그 커밋이 지금 `HEAD`의 조상이
 * 아니면(`--is-ancestor`가 1) 리베이스를 했거나 main의 변경이 섞인 것이라, 그 커밋을 기준으로 안내하면
 * 명령이 실패하거나 main의 변경까지 점검 범위에 들어간다. 그 커밋이 지금 저장소에 없으면(128) 다른
 * 장비로 옮긴 경우다. 어느 쪽이든 어떤 검사를 할지는 바꾸지 않고 전체 `/cso`만 안내하므로, 변경 집합을
 * 구할 수 없는 경우(`measurable: false`)와 섞지 않는다.
 *
 * @param {string | null | undefined} csoCommit 상태 파일의 `cso_commit`
 * @param {string} root 저장소 경로
 * @param {{ run?: GitRunner }} [deps]
 * @returns {{ usable: true } | { usable: false, reason: string }}
 */
export function csoBaseUsable(csoCommit, root, { run = (args) => runGit(root, args) } = {}) {
  if (!csoCommit) return { usable: false, reason: '기록 없음' };
  const r = run(['merge-base', '--is-ancestor', csoCommit, 'HEAD']);
  if (ran(r) && r.status === 0) return { usable: true };
  if (ran(r) && r.status === 1) return { usable: false, reason: '지금 HEAD의 조상이 아님' };
  return { usable: false, reason: '지금 저장소에 없는 커밋' };
}
