// @ts-check
/**
 * 통합 검사 — biome · 타입 검사 · vitest를 이 순서로 한 번에 돌리고 결과를 정리한다.
 *
 * `workflow.mjs`의 `start-verification`·`verify`·`pass`가 import해서 쓰는 모듈이고, 혼자 실행할 수는 없다.
 * biome을 먼저 돌리는 이유는 `write`가 참일 때 biome이 고친 코드를 타입 검사와 테스트가 검사하게 하려는
 * 것이다. 순서가 반대면 타입 검사가 본 코드와 디스크에 남는 최종 코드가 달라진다. 하나가 실패해도 멈추지
 * 않고 셋을 다 돌린다 — 세 결과를 한 번에 보게 하려는 것이다.
 *
 * 기본 실행기는 이 파일에만 정의한다. 실행기를 바꿔 끼우는 환경변수는 두지 않는다. 그런 변수가 있으면
 * 변수 하나로 아무 검사도 돌리지 않고 통과를 기록할 수 있게 된다. 시험용 실행기는 단위 테스트가 함수
 * 인자로 넘긴다(`makeRunners`의 `spawn`, 또는 `runVerify`의 `runners`).
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runTypecheck } from '../typecheck.mjs';

/**
 * 검사 하나의 결과. `not-run`은 실행기를 실행하지 못했거나 결과 없이 끝난 경우다 — 코드가 아니라 실행
 * 환경의 문제라서, 전이 판정(`transition.mjs`)이 판단 검사 결과를 지우지 않는다. `format-only`는 biome의
 * 형식 차이만 있는 경우다.
 * @typedef {'pass' | 'fail' | 'format-only' | 'not-run'} CheckStatus
 */
/**
 * @typedef {object} RunnerResult
 * @property {CheckStatus} status
 * @property {'full' | 'logic-only' | null} [scope] 타입 검사가 실제로 본 범위(통과했을 때만)
 * @property {string} summary 요약 줄에서 이름 뒤에 붙는 말(예: 「통과 · 범위 full」)
 * @property {string} details 실패했을 때 붙일 원래 출력
 * @property {string[]} [notes] 상세 내용 앞에 붙일 안내(실행하지 못한 이유, 해결 방법)
 * @property {string} rerun 실패했을 때 직접 다시 돌려 볼 명령
 */
/** @typedef {RunnerResult & { durationMs: number }} TimedResult */
/** @typedef {{ biome: TimedResult, typecheck: TimedResult, vitest: TimedResult }} VerifyResults */
/** @typedef {{ ok: boolean, results: VerifyResults }} VerifyResult */
/** @typedef {(opts: { write: boolean }) => RunnerResult} Runner */
/** @typedef {{ biome: Runner, typecheck: Runner, vitest: Runner }} Runners */
/** @typedef {import('../typecheck.mjs').Spawn} Spawn */

/** 실행 순서이자 출력 순서. */
const ORDER = /** @type {const} */ (['biome', 'typecheck', 'vitest']);

/** 실패한 검사에 붙이는 상세 내용의 줄 수 상한. */
const DETAIL_LINES = 40;

/** tsc·vitest·biome이 수천 줄을 내도 받을 수 있게 한다. 기본값 1MiB로는 다 받지 못하는 날이 있다. */
const MAX_BUFFER = 64 * 1024 * 1024;

const VITEST_RERUN = 'pnpm exec vitest run';

// spawnSync는 겹쳐 정의(overload)된 함수라 Spawn 모양에 바로 맞지 않아서 형을 좁혀 둔다.
const SPAWN_SYNC = /** @type {Spawn} */ (/** @type {unknown} */ (spawnSync));

/**
 * `spawnSync` 결과가 「실행기 자체의 실패」인지 가른다. 아니면 null이다.
 *
 * `error`를 전부 「pnpm 경로 확인」으로 처리하지 않는 이유는, 그러면 타입 오류 수천 줄로 출력이 넘친
 * 경우(`ENOBUFS`)까지 「pnpm이 없다」고 보고하게 되기 때문이다. 넘친 경우는 코드가 실제로 실패했을 수
 * 있어서 실패로 센다. `shell: true`로 실행하면 `pnpm`이 없어도 `error`는 비어 있고 `status`만
 * 9009(`cmd.exe`)·127(`sh`)로 오며, stderr에 셸의 오류 메시지가 찍힌다.
 *
 * @param {string} name 실행기 이름
 * @param {ReturnType<Spawn>} r
 * @param {string} rerun 직접 다시 돌려 볼 명령
 * @returns {{ status: CheckStatus, note: string } | null}
 */
function spawnProblem(name, r, rerun) {
  const code = /** @type {{ code?: string } | undefined} */ (r.error)?.code;
  const firstErr = String(r.stderr ?? '')
    .split(/\r?\n/)[0]
    .trim();
  const noShell =
    !r.error && String(r.stdout ?? '').trim() === '' && (r.status === 9009 || r.status === 127);
  if (code === 'ENOENT' || noShell) {
    const tail = firstErr ? `: ${firstErr}` : '';
    return {
      status: 'not-run',
      note: `실행기 \`${name}\`을 실행할 수 없다(\`pnpm\` 경로 확인)${tail}`,
    };
  }
  if (code === 'ENOBUFS') {
    return { status: 'fail', note: `출력이 너무 커서 잘렸다 — \`${rerun}\`으로 직접 보라` };
  }
  if (r.error) return { status: 'not-run', note: r.error.message };
  return null;
}

/**
 * 실행기 자체가 실패했을 때 붙일 상세 내용. 실행하지 못한 경우는 셸의 오류 메시지뿐이라 안내(note)에 넣은
 * 첫 줄로 충분하고, 출력이 넘친 경우는 잘린 출력이라도 붙인다.
 * @param {{ status: CheckStatus }} p
 * @param {string} out
 */
function detailsFor(p, out) {
  return p.status === 'not-run' ? '' : out;
}

/** @param {ReturnType<Spawn>} r */
function textOf(r) {
  return `${r.stdout ?? ''}${r.stderr ?? ''}`;
}

/** @param {CheckStatus} status */
function label(status) {
  if (status === 'pass') return '통과';
  if (status === 'not-run') return '실행하지 못함';
  if (status === 'format-only') return '형식 차이';
  return '실패';
}

/**
 * biome summary 출력의 「Fixed N files」에서 고친 파일 수를 읽는다. 읽지 못하면 null — 출력에만 쓰고
 * 판정에는 쓰지 않으므로, biome 문구가 바뀌어도 그 줄이 빠질 뿐이다.
 * @param {string} out
 */
function fixedCount(out) {
  const m = /Fixed (\d+) files?/.exec(out);
  return m ? Number(m[1]) : null;
}

/**
 * biome summary 출력의 「need to be formatted」 목록에서 파일 수를 센다. 읽지 못하면 null.
 * @param {string} out
 */
function formatCount(out) {
  const lines = out.split(/\r?\n/);
  const start = lines.findIndex((l) => l.includes('need to be formatted'));
  if (start < 0) return null;
  let n = 0;
  for (const line of lines.slice(start + 1)) {
    if (/^\s+- /.test(line)) n++;
    else if (line.trim() !== '') break;
  }
  return n > 0 ? n : null;
}

/**
 * 실패 출력에 `tsconfig.cocos.json`이 보이면 해결 방법 두 가지. 이 파일은 Cocos가 만들고 git이 무시해서,
 * 새로 만든 작업 폴더에는 없다.
 * @param {string} text
 * @param {string} root
 */
function cocosHint(text, root) {
  if (!text.includes('tsconfig.cocos.json')) return [];
  return [
    'tsconfig.cocos.json이 없어서 테스트를 불러오지 못했다. 둘 중 하나로 고친다:',
    `  - \`${root.split(path.sep).join('/')}/game\`을 Cocos Creator로 한 번 연다`,
    '  - 다른 체크아웃의 `game/temp/tsconfig.cocos.json`을 같은 위치로 복사한다' +
      '(git이 무시하는 파일이라 커밋되지 않는다)',
  ];
}

/**
 * vitest 결과 파일에서 실패 내용을 뽑는다. 테스트 파일을 불러오다 난 오류는 `testResults[].message`에,
 * 실패한 테스트는 `assertionResults[].failureMessages`에 있다.
 * @param {Array<Record<string, any>>} files
 */
function vitestFailureText(files) {
  /** @type {string[]} */
  const out = [];
  for (const f of files) {
    out.push(`✗ ${f.rel}`);
    if (f.message) out.push(String(f.message));
    for (const a of f.assertionResults ?? []) {
      if (a.status !== 'failed') continue;
      out.push(`  ✗ ${a.fullName ?? a.title ?? ''}`);
      for (const m of a.failureMessages ?? []) out.push(String(m));
    }
  }
  return out.join('\n');
}

/**
 * 기본 실행기 세 개를 만든다. 테스트는 `spawn`에 가짜를 넘겨 실행기의 판정 코드를 그대로 시험한다.
 *
 * Windows에서 `pnpm.cmd`를 실행하려면 `shell: true`가 필요하다. 그래서 인자로 넘기는 경로는 따옴표로
 * 감싸고, 임시 폴더 경로에 `"`가 들어 있으면 명령줄을 만들지 않고 실패한다. 명령줄이 잘못 만들어져서
 * 엉뚱한 파일에 조용히 쓰는 것보다 낫다.
 *
 * @param {{ root: string, spawn?: Spawn, tmpRoot?: string }} opts
 *   root는 검사할 저장소, tmpRoot는 vitest 결과 파일을 둘 임시 폴더의 부모(기본 `os.tmpdir()`)
 * @returns {Runners}
 */
export function makeRunners({ root, spawn = SPAWN_SYNC, tmpRoot = os.tmpdir() }) {
  /** @param {string[]} args */
  const pnpm = (args) =>
    spawn('pnpm', args, { cwd: root, encoding: 'utf8', shell: true, maxBuffer: MAX_BUFFER });

  return {
    biome({ write }) {
      const rerun = 'pnpm check';
      const r = pnpm([
        'exec',
        'biome',
        'check',
        '--reporter=summary',
        ...(write ? ['--write'] : []),
        '.',
      ]);
      const out = textOf(r);
      const p = spawnProblem('biome', r, rerun);
      if (p)
        return {
          status: p.status,
          summary: label(p.status),
          details: detailsFor(p, out),
          notes: [p.note],
          rerun,
        };
      if (r.status === 0) {
        // 정보 수준 진단(useTemplate 같은 것)은 종료 코드를 바꾸지 않는다. 요약 줄에 오류처럼 섞이지
        // 않게 고친 파일 수만 적는다.
        const fixed = write ? fixedCount(out) : null;
        return {
          status: 'pass',
          summary: fixed ? `통과 · ${fixed}개 파일을 고쳤다` : '통과',
          details: '',
          rerun,
        };
      }
      // --write로 고친 뒤에도 남은 실패는 고칠 수 없는 린트 위반이다.
      if (write) return { status: 'fail', summary: '실패 · 린트 위반', details: out, rerun };

      // 고치지 않는 모드에서는 「형식 차이만 있다」와 「린트 실패가 있다」를 종료 코드로 가른다. biome의
      // json 출력은 「실험 기능이라 패치 버전에서도 바뀔 수 있다」고 문서에 적혀 있고, summary 글자를
      // 읽는 방법은 biome 버전이 바뀌면 오류 없이 틀린 결과를 낸다(2026-10-06 확인).
      const lint = pnpm(['exec', 'biome', 'lint', '--reporter=summary', '.']);
      const lp = spawnProblem('biome', lint, rerun);
      if (lp) {
        return {
          status: lp.status,
          summary: label(lp.status),
          details: detailsFor(lp, textOf(lint)),
          notes: [lp.note],
          rerun,
        };
      }
      if (lint.status === 0) {
        const n = formatCount(out);
        return {
          status: 'format-only',
          summary: n ? `형식 차이 ${n}개 파일` : '형식 차이',
          details: out,
          rerun,
        };
      }
      return { status: 'fail', summary: '실패 · 린트 위반', details: textOf(lint), rerun };
    },

    typecheck() {
      const rerun = 'pnpm typecheck';
      const t = runTypecheck({ capture: true, spawn, root });
      const p = t.raw ? spawnProblem('typecheck', t.raw, rerun) : null;
      if (p) {
        return {
          status: p.status,
          scope: null,
          summary: label(p.status),
          details: detailsFor(p, t.output),
          notes: [p.note],
          rerun,
        };
      }
      if (t.status === 0) {
        return {
          status: 'pass',
          scope: t.scope,
          summary: `통과 · 범위 ${t.scope}`,
          details: '',
          rerun,
        };
      }
      return { status: 'fail', scope: null, summary: '실패', details: t.output, rerun };
    },

    vitest() {
      if (tmpRoot.includes('"')) {
        const note = `임시 폴더 경로에 따옴표가 들어 있어 명령줄을 만들 수 없다: ${tmpRoot}`;
        return {
          status: 'not-run',
          summary: label('not-run'),
          details: '',
          notes: [note],
          rerun: VITEST_RERUN,
        };
      }
      // 결과 파일을 고정 경로에 두지 않는다. 원래 폴더와 작업 폴더에서 동시에 검사를 돌리면 서로의 결과
      // 파일을 읽게 된다.
      const dir = fs.mkdtempSync(path.join(tmpRoot, 'wf-verify-'));
      try {
        const file = path.join(dir, 'vitest.json');
        const r = pnpm(['exec', 'vitest', 'run', '--reporter=json', `--outputFile="${file}"`]);
        return readVitest(r, file, root);
      } finally {
        // Windows에서는 Defender가 새 파일을 읽는 동안 EBUSY/EPERM이 날 수 있다. 지우다 실패해도 검사
        // 결과가 그 오류로 덮이지 않게 한다.
        try {
          fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        } catch {}
      }
    },
  };
}

/**
 * vitest 실행 결과와 결과 파일을 읽어 검사 결과로 바꾼다.
 *
 * 통과인지 실패인지는 종료 코드로 정하되, 결과 파일의 `success`가 거짓이면 `numFailedTests`가 0이어도
 * 실패다. 테스트 파일 하나가 import 단계에서 죽으면 vitest는 `testResults[].status='failed'`와 `message`를
 * 채우지만 `numFailedTests`는 0일 수 있다. 요약 줄에 「파일 실패」를 따로 두는 이유다.
 *
 * @param {ReturnType<Spawn>} r
 * @param {string} file 결과 파일 경로
 * @param {string} root 저장소 경로 — 결과 파일의 절대 경로를 저장소 기준으로 바꿀 때 쓴다
 * @returns {RunnerResult}
 */
function readVitest(r, file, root) {
  const stderr = String(r.stderr ?? '');
  const p = spawnProblem('vitest', r, VITEST_RERUN);
  if (p) {
    const notes = [p.note, ...cocosHint(textOf(r), root)];
    return {
      status: p.status,
      summary: label(p.status),
      details: detailsFor(p, textOf(r)),
      notes,
      rerun: VITEST_RERUN,
    };
  }

  /** @type {Record<string, any> | null} */
  let json = null;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    json = null;
  }
  if (!json || typeof json !== 'object') {
    // 결과 파일이 없거나 JSON으로 읽히지 않으면 중간에 죽은 것이다. 두 경우의 처방은 같다.
    const notes = [
      `테스트 실행기가 결과 없이 끝났다 — \`${VITEST_RERUN}\`으로 다시 돌려 보라`,
      ...cocosHint(stderr, root),
    ];
    return {
      status: 'not-run',
      summary: label('not-run'),
      details: stderr,
      notes,
      rerun: VITEST_RERUN,
    };
  }

  /** @type {Array<Record<string, any>>} */
  const files = (Array.isArray(json.testResults) ? json.testResults : []).map(
    (/** @type {Record<string, any>} */ t) => ({
      ...t,
      rel: path.isAbsolute(String(t.name))
        ? path.relative(root, String(t.name)).split(path.sep).join('/')
        : String(t.name),
    }),
  );
  const failedFiles = files.filter((t) => t.status === 'failed');
  const failed = r.status !== 0 || json.success === false;
  const status = failed ? 'fail' : 'pass';
  const skipped = (json.numPendingTests ?? 0) + (json.numTodoTests ?? 0);
  const summary =
    `${label(status)} · 파일 ${files.length}개 · 통과 ${json.numPassedTests ?? 0} · ` +
    `실패 ${json.numFailedTests ?? 0} · 파일 실패 ${failedFiles.length} · 스킵 ${skipped}`;
  if (!failed) return { status, summary, details: '', rerun: VITEST_RERUN };

  const details = vitestFailureText(failedFiles) || stderr;
  const rerun =
    failedFiles.length > 0 && failedFiles.length <= 3
      ? `${VITEST_RERUN} ${failedFiles.map((f) => f.rel).join(' ')}`
      : VITEST_RERUN;
  return { status, summary, details, notes: cocosHint(`${details}\n${stderr}`, root), rerun };
}

/**
 * 통합 검사를 돌린다. 실행기를 부르기 전후로 시간을 재서 결과마다 `durationMs`를 더한다.
 *
 * @param {Runners} [runners] 기본은 `CLAUDE_PROJECT_DIR`(없으면 현재 폴더)을 검사하는 실제 실행기
 * @param {{ write?: boolean }} [opts] write가 참이면 biome이 형식 차이를 고친다
 * @returns {VerifyResult}
 */
export function runVerify(runners = defaultRunners(), { write = true } = {}) {
  /** @type {Partial<VerifyResults>} */
  const results = {};
  for (const name of ORDER) {
    const t0 = Date.now();
    const r = runners[name]({ write });
    results[name] = { ...r, durationMs: Date.now() - t0 };
  }
  const full = /** @type {VerifyResults} */ (results);
  return { ok: ORDER.every((n) => full[n].status === 'pass'), results: full };
}

/** 실제 실행기. 부를 때 만든다 — import만 하는 테스트가 환경변수를 읽지 않게 한다. */
function defaultRunners() {
  return makeRunners({ root: process.env.CLAUDE_PROJECT_DIR || process.cwd() });
}

/** @param {number} ms */
function msText(ms) {
  return `${ms.toLocaleString('en-US')}ms`;
}

/**
 * 결과를 출력할 줄로 만든다. 검사마다 요약 한 줄(걸린 시간 포함), 실패한 검사에만 안내와 상세 내용
 * 40줄과 다시 돌려 볼 명령, 마지막 줄에 합계 시간이다. QA 문서의 「전체 스위트 M/M」은 vitest 줄에서
 * 옮겨 적는다 — 그 개수를 보려고 vitest를 따로 돌리지 않게 하려는 것이다.
 *
 * @param {VerifyResult} result
 * @returns {string[]}
 */
export function formatVerifyReport(result) {
  /** @type {string[]} */
  const lines = [];
  let total = 0;
  for (const name of ORDER) {
    const r = result.results[name];
    total += r.durationMs;
    lines.push(`${name}: ${r.summary || label(r.status)} (${msText(r.durationMs)})`);
    if (r.status === 'pass') continue;
    for (const note of r.notes ?? []) lines.push(`  ${note}`);
    const detail = String(r.details ?? '')
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '');
    for (const l of detail.slice(0, DETAIL_LINES)) lines.push(`    ${l}`);
    if (detail.length > DETAIL_LINES) lines.push(`    …${detail.length - DETAIL_LINES}줄 생략`);
    if (r.rerun) lines.push(`  다시 돌려 보기: ${r.rerun}`);
  }
  lines.push(`합계 ${msText(total)}`);
  return lines;
}

/**
 * biome이 파일을 고쳐도 되는지. `user-verification`에서는 훅이 게임 스크립트 편집을 막는데 `biome.json`은
 * `game/assets/scripts`도 검사하므로, 고치게 두면 편집이 막힌 코드를 도구가 고치게 된다. 그래서 그
 * phase에서는 옵션과 상관없이 고치지 않는다. `--no-write`는 검사를 끄지 않고 파일 수정만 끈다.
 *
 * @param {string} phase
 * @param {string[]} args 명령 인자
 */
export function writeModeFor(phase, args) {
  return phase !== 'user-verification' && !args.includes('--no-write');
}
