/**
 * CLAUDE.md 3층 분할 슬라이스의 가드.
 *
 * **파일명과 검증 대상이 어긋난다.** `wf`가 슬라이스 슬러그로 테스트 파일명을 강제하는데
 * (`workflow.mjs`의 `testFilePath`), 여기서 실제로 검증하는 것은 `CLAUDE.md` 본문이 아니라
 * **워크플로 절차 문서의 배달**이다 — phase↔문서 정합, 배달 로직, 그리고 문서가 다시 부푸는
 * 것을 막는 크기 예산 셋. 이름을 되돌리려면 `wf start`를 다시 쳐야 하고 그러면 슬라이스 상태가
 * 초기화되므로, 이름은 그대로 두고 여기 적어 둔다.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { findStepDocIssues, parsePhases } from '../helpers/WorkflowSteps';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const WORKFLOW_MJS = path.join(ROOT, '.claude', 'workflow.mjs');
const STEP_DOC_DIR = path.join(ROOT, 'docs', 'development', 'workflow');

/** 배달 대상 phase — `done`은 제외한다(문서 여섯 개, phase 일곱 개). */
const DELIVERED_PHASES = [
  'planning',
  'qa-setup',
  'implementation',
  'verification',
  'user-verification',
  'pr-ready',
];

// ---------------------------------------------------------------------------
// 4.1 절차 문서 정합 — 순수 함수 (fixture)
// ---------------------------------------------------------------------------

describe('findStepDocIssues — fixture', () => {
  /** 정합한 디스크 상태: 배달 대상 phase 문서 여섯 개 + 인덱스. */
  function cleanFiles(): string[] {
    return ['README.md', ...DELIVERED_PHASES.map((p) => `${p}.md`)];
  }

  const allPhases = [...DELIVERED_PHASES, 'done'];

  it('phase 목록과 디스크가 맞으면 이슈 0건', () => {
    expect(findStepDocIssues(allPhases, cleanFiles())).toEqual([]);
  });

  it('missing: 배달 대상 phase 문서가 없으면 그 이름만 플래그', () => {
    const files = cleanFiles().filter((f) => f !== 'verification.md');
    expect(findStepDocIssues(allPhases, files)).toEqual([
      { type: 'missing', name: 'verification.md' },
    ]);
  });

  it('done 면제: done.md가 없어도 missing이 아니다', () => {
    // phase는 일곱인데 문서는 여섯이다. 면제하지 않으면 pr-done이 매 슬라이스 마지막에
    // 누락 경고를 헛발화한다.
    expect(findStepDocIssues(allPhases, cleanFiles())).toEqual([]);
  });

  it('unexpected: done.md가 있으면 플래그(배달되지 않는 문서는 읽히지 않은 채 낡는다)', () => {
    const files = [...cleanFiles(), 'done.md'];
    expect(findStepDocIssues(allPhases, files)).toEqual([{ type: 'unexpected', name: 'done.md' }]);
  });

  it('unexpected: phase 이름도 README.md도 아닌 .md를 플래그', () => {
    const files = [...cleanFiles(), 'notes.md'];
    expect(findStepDocIssues(allPhases, files)).toEqual([{ type: 'unexpected', name: 'notes.md' }]);
  });

  it('missing: README.md가 없으면 플래그(통독 경로가 그것뿐이다)', () => {
    // 분할이 없앤 것은 계획→머지를 위에서 아래로 한 번에 읽는 경험이고, README가 그걸 되살린다.
    const files = cleanFiles().filter((f) => f !== 'README.md');
    expect(findStepDocIssues(allPhases, files)).toEqual([{ type: 'missing', name: 'README.md' }]);
  });

  it('.md가 아닌 파일은 무시한다', () => {
    const files = [...cleanFiles(), '.gitkeep', 'diagram.png'];
    expect(findStepDocIssues(allPhases, files)).toEqual([]);
  });

  it('대소문자가 다르면 missing과 unexpected를 둘 다 낸다', () => {
    // Windows는 대소문자를 무시하므로 fs.existsSync로 판정하면 이 오타가 이 장비에서만
    // 통과하고 Linux에서 깨진다. 판정은 readdir 결과에 대한 정확한 문자열 비교여야 한다.
    const files = cleanFiles().map((f) => (f === 'verification.md' ? 'Verification.md' : f));
    expect(findStepDocIssues(allPhases, files)).toEqual([
      { type: 'missing', name: 'verification.md' },
      { type: 'unexpected', name: 'Verification.md' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 4.2 phase 어휘 파싱 (fixture)
// ---------------------------------------------------------------------------

describe('parsePhases — fixture', () => {
  it('PHASES 배열의 문자열을 선언 순서대로 뽑는다', () => {
    const src = [
      'const CHECKS = ["cso"];',
      'const PHASES = [',
      '  "planning",',
      "  'qa-setup',",
      '  "done",',
      '];',
    ].join('\n');
    expect(parsePhases(src)).toEqual(['planning', 'qa-setup', 'done']);
  });

  it('PHASES를 찾지 못하면 예외를 던진다', () => {
    // 빈 배열을 돌려주면 기대 문서가 0개가 되어 정합 테스트가 조용히 통과한다 —
    // 가드가 침묵으로 죽는 경로를 막는다.
    expect(() => parsePhases('const NOTHING = [];')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4.3 실물 게이트
// ---------------------------------------------------------------------------

describe('절차 문서 실물 게이트', () => {
  it('workflow.mjs의 phase 어휘와 docs/development/workflow/가 정합한다', () => {
    const phases = parsePhases(fs.readFileSync(WORKFLOW_MJS, 'utf8'));
    const files = fs.readdirSync(STEP_DOC_DIR);
    expect(findStepDocIssues(phases, files)).toEqual([]);
  });

  it('README.md가 존재한다 (통독 경로)', () => {
    expect(fs.readdirSync(STEP_DOC_DIR)).toContain('README.md');
  });
});

// ---------------------------------------------------------------------------
// 4.4 배달 로직 — 샌드박스 E2E
// ---------------------------------------------------------------------------

/** 샌드박스 상태 파일의 모양 — `docs_delivered`는 verification 객체 **밖**이다. */
interface SandboxState {
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
}

interface SandboxOptions {
  /** 시작 phase */
  phase: string;
  /** 네 검증 플래그를 모두 통과로 둘지 (전체 pass 경로 테스트용) */
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
}

const FEATURE = 'demo';
const sandboxes: string[] = [];

afterEach(() => {
  for (const dir of sandboxes.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** stub 절차 문서 — 제목 줄(요약에 살아남는 부분)과 본문 표식을 분리해 둔다. */
function stubDoc(phase: string): string {
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

/** 임시 디렉터리에 최소 레포 구조를 꾸미고 경로를 반환한다. 정리는 afterEach가 한다. */
function makeSandbox(opts: SandboxOptions): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-steps-'));
  sandboxes.push(dir);

  const write = (rel: string, body: string): void => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  };

  const clean = opts.allChecksClean === true;
  const state: SandboxState = {
    feature: FEATURE,
    phase: opts.phase,
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
  };
  write('.claude/workflow-state.json', `${JSON.stringify(state, null, 2)}\n`);

  write(
    `docs/qa/${FEATURE}-test.md`,
    opts.qaProvisional === true ? '# QA\n\n## 프리팹 (잠정 이름)\n' : '# QA\n\n## 프리팹 (확정)\n',
  );

  if (opts.planDoc !== false) {
    write(`docs/development/sessions/2026-01-01-${FEATURE}-plan.md`, '# 계획\n');
  }

  if (opts.omitDir !== true) {
    fs.mkdirSync(path.join(dir, 'docs', 'development', 'workflow'), { recursive: true });
    if (opts.omitIndex !== true) write('docs/development/workflow/README.md', '# 인덱스\n');
    for (const phase of DELIVERED_PHASES) {
      if (phase === opts.omitDoc) continue;
      write(`docs/development/workflow/${phase}.md`, stubDoc(phase));
    }
    if (opts.unreadableDoc !== undefined) {
      // 이름은 readdir에 남되 readFileSync가 EISDIR로 던지게 만든다. 권한 조작보다 이식성이 좋다.
      const target = path.join(dir, 'docs/development/workflow', `${opts.unreadableDoc}.md`);
      fs.rmSync(target, { force: true });
      fs.mkdirSync(target);
    }
  }

  return dir;
}

/** 샌드박스를 ROOT로 삼아 실제 workflow.mjs 프로세스를 띄운다. */
function runWf(
  sandbox: string,
  args: string[],
  extraEnv: Record<string, string> = {},
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [WORKFLOW_MJS, ...args], {
    cwd: sandbox,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: sandbox, ...extraEnv },
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** 샌드박스의 현재 상태를 읽는다. */
function readState(sandbox: string): SandboxState {
  return JSON.parse(fs.readFileSync(path.join(sandbox, '.claude/workflow-state.json'), 'utf8'));
}

/** 배달 경로 안내 줄 — 경로는 항상 슬래시로 나온다. */
function pathLine(phase: string): string {
  return `▶ ${phase} 절차: docs/development/workflow/${phase}.md`;
}

describe('배달 — 전이 시점', () => {
  it('전이에 성공하면 새 phase 문서를 배달한다', () => {
    const box = makeSandbox({ phase: 'planning' });
    const { status, stdout } = runWf(box, ['approve-plan']);

    expect(status).toBe(0);
    expect(stdout).toContain('BODY-qa-setup');
    expect(readState(box).phase).toBe('qa-setup');
  });

  it('경로와 재출력 안내가 본문보다 먼저 나오고, 상태 줄이 본문 뒤에 한 번 더 나온다', () => {
    // 배달물이 자체 `#` 제목을 가진 마크다운이라, 구분자가 없으면 문서 제목이 CLI가 하는
    // 말처럼 읽힌다. 또 vitest·tsc 출력 뒤에 배달되는 커맨드가 있어 본문이 잘릴 수 있는데,
    // 경로가 먼저 나오면 잘려도 회복된다.
    const box = makeSandbox({ phase: 'planning' });
    const { stdout } = runWf(box, ['approve-plan']);

    const at = (needle: string): number => stdout.indexOf(needle);
    const statusLine = '✓ approve-plan → phase=qa-setup';
    expect(at(pathLine('qa-setup'))).toBeGreaterThanOrEqual(0);
    expect(at(pathLine('qa-setup'))).toBeLessThan(at('BODY-qa-setup'));
    expect(at('pnpm wf steps qa-setup')).toBeLessThan(at('BODY-qa-setup'));
    // 앞의 것은 커맨드 자신이 찍은 줄(뒤에 확인 내역이 붙는다), 뒤의 것이 배달이 다시 찍는 줄이다.
    expect(stdout.split(statusLine).length - 1).toBe(2);
    expect(stdout.lastIndexOf(statusLine)).toBeGreaterThan(at('BODY-qa-setup'));
  });

  it('배달 기록을 docs_delivered에 남긴다', () => {
    const box = makeSandbox({ phase: 'planning' });
    runWf(box, ['approve-plan']);
    expect(readState(box).docs_delivered).toEqual(['qa-setup']);
  });

  it('전이가 실패하면 배달하지 않는다', () => {
    const box = makeSandbox({ phase: 'planning', planDoc: false });
    const { status, stdout } = runWf(box, ['approve-plan']);

    expect(status).toBe(1);
    expect(stdout).not.toContain('BODY-');
    expect(readState(box).phase).toBe('planning');
  });

  it('부분 pass는 phase를 바꾸지 않으므로 배달하지 않는다', () => {
    const box = makeSandbox({ phase: 'verification' });
    const { status, stdout } = runWf(box, ['pass', 'cso']);

    expect(status).toBe(0);
    expect(stdout).not.toContain('BODY-');
  });

  it('전체 pass는 user-verification 문서를 배달한다', () => {
    // 정본 게이트는 여기서 검증하지 않는다(아래 별도 describe) — 선언을 채워 배달만 본다.
    const box = makeSandbox({
      phase: 'verification',
      allChecksClean: true,
      canonSkipReason: '바꾼 명세 없음',
    });
    const { status, stdout } = runWf(box, ['pass', 'review']);

    expect(status).toBe(0);
    expect(stdout).toContain('BODY-user-verification');
  });

  it('allClean 뒤 게이트에서 죽으면 배달하지 않는다', () => {
    // pass는 allClean 이후에도 게이트에서 죽는다. 배달을 allClean 시점에 붙이면 전이하지도 않은
    // pass에서 user-verification 절차가 샌다.
    //
    // 게이트 둘 중 **정본 선언** 쪽으로 잰다. QA 확정 게이트는 2026-08-19부터 판정을 vitest에
    // 맡기는데(F92·F93 — 로직 한 벌을 tests/helpers/QaDoc.ts에 두려고), 샌드박스에는 vitest가
    // 설치돼 있지 않아 그 게이트로는 "죽었다"와 "못 돌렸다"가 구분되지 않는다.
    const box = makeSandbox({
      phase: 'verification',
      allChecksClean: true,
      qaProvisional: true,
    });
    const { status, stdout } = runWf(box, ['pass', 'review']);

    expect(status).toBe(1);
    expect(stdout).not.toContain('BODY-');
    expect(readState(box).phase).toBe('verification');
  });

  it('ready-impl이 implementation 문서를 배달한다', () => {
    const box = makeSandbox({ phase: 'qa-setup', testSkipped: true });
    const { status, stdout } = runWf(box, ['ready-impl']);

    expect(status).toBe(0);
    expect(stdout).toContain('BODY-implementation');
  });

  it('rework는 전문을 다시 배달한다 (리워크는 새 회차다)', () => {
    const box = makeSandbox({
      phase: 'user-verification',
      docsDelivered: ['implementation', 'verification', 'user-verification'],
    });
    const { status, stdout } = runWf(box, ['rework']);

    expect(status).toBe(0);
    expect(stdout).toContain('BODY-implementation');
  });

  it('pr-done은 배달하지 않고 경고도 하지 않는다', () => {
    // done은 배달 대상 phase가 아니다. 일반 구현이면 done.md를 찾다 없어서 매 슬라이스
    // 마지막에 누락 경고를 헛발화한다.
    const box = makeSandbox({ phase: 'pr-ready' });
    const { status, stdout, stderr } = runWf(box, ['pr-done']);

    expect(status).toBe(0);
    expect(stdout).not.toContain('BODY-');
    expect(stderr).not.toContain('⚠');
  });
});

describe('배달 — 반복 배달 차등', () => {
  it('invalidate가 verification 문서를 재배달한다', () => {
    const box = makeSandbox({ phase: 'verification', docsDelivered: [] });
    const { status, stdout } = runWf(box, ['invalidate']);

    expect(status).toBe(0);
    expect(stdout).toContain('BODY-verification');
  });

  it('같은 phase 두 번째부터는 제목과 재출력 안내만 낸다', () => {
    // invalidate는 한 슬라이스에서 여러 번 돈다. 매번 전문을 쏟으면 사람에게는 벽이고
    // 에이전트에게는 둔감화다. 절차를 다시 돌라는 신호(제목 = 게이트 목록)는 유지한다.
    const box = makeSandbox({ phase: 'verification', docsDelivered: ['verification'] });
    const { stdout } = runWf(box, ['invalidate']);

    expect(stdout).toContain('## 첫 게이트');
    expect(stdout).toContain('## 둘째 게이트');
    expect(stdout).toContain('전문: pnpm wf steps verification');
    expect(stdout).not.toContain('BODY-verification');
  });

  it('phase를 벗어났다가 돌아오면 다시 전문을 낸다', () => {
    const box = makeSandbox({
      phase: 'qa-setup',
      testSkipped: true,
      docsDelivered: ['qa-setup', 'implementation'],
    });
    const { stdout } = runWf(box, ['ready-impl']);

    expect(stdout).toContain('BODY-implementation');
  });

  it('WF_QUIET=1이면 본문을 억제하고 경로 안내는 남긴다', () => {
    const box = makeSandbox({ phase: 'planning' });
    const { status, stdout } = runWf(box, ['approve-plan'], { WF_QUIET: '1' });

    expect(status).toBe(0);
    expect(stdout).toContain(pathLine('qa-setup'));
    expect(stdout).not.toContain('BODY-qa-setup');
  });
});

describe('배달 — 읽기 전용 재출력', () => {
  it('steps는 상태를 바꾸지 않고 전문을 낸다', () => {
    const box = makeSandbox({ phase: 'verification', docsDelivered: ['verification'] });
    const statePath = path.join(box, '.claude/workflow-state.json');
    const before = fs.readFileSync(statePath, 'utf8');

    const { status, stdout } = runWf(box, ['steps']);

    expect(status).toBe(0);
    // 읽기 전용 재출력이므로 차등 배달 규칙을 타지 않는다 — 다시 보려고 친 명령이다.
    expect(stdout).toContain('BODY-verification');
    expect(fs.readFileSync(statePath, 'utf8')).toBe(before);
  });

  it('steps <phase>는 인자로 받은 phase의 문서를 낸다', () => {
    const box = makeSandbox({ phase: 'planning' });
    const { status, stdout } = runWf(box, ['steps', 'pr-ready']);

    expect(status).toBe(0);
    expect(stdout).toContain('BODY-pr-ready');
  });

  it('status는 경로 한 줄만 내고 본문은 내지 않는다', () => {
    // 압축 이후 "나 어디 있지"를 묻는 정본 커맨드라, 절차 문서의 존재가 여기서 신호로 온다.
    // 부재는 스스로를 알리지 않으므로 "모르면 읽어라"는 방아쇠가 될 수 없다.
    const box = makeSandbox({ phase: 'implementation' });
    const { status, stdout } = runWf(box, ['status']);

    expect(status).toBe(0);
    expect(stdout).toContain(pathLine('implementation'));
    expect(stdout).not.toContain('BODY-implementation');
  });

  it('status는 done phase에서 절차 경로를 말하지 않는다', () => {
    const box = makeSandbox({ phase: 'done' });
    const { status, stdout, stderr } = runWf(box, ['status']);

    expect(status).toBe(0);
    expect(stdout).not.toContain('docs/development/workflow/');
    expect(stderr).not.toContain('⚠');
  });
});

describe('배달 — 누락 처리', () => {
  it('문서가 없어도 전이를 막지 않고 경고만 한다', () => {
    // 막으면 문서 하나 누락으로 워크플로가 멈추는데 빠져나올 경로가 없다.
    const box = makeSandbox({ phase: 'planning', omitDoc: 'qa-setup' });
    const { status, stderr } = runWf(box, ['approve-plan']);

    expect(status).toBe(0);
    expect(readState(box).phase).toBe('qa-setup');
    expect(stderr).toContain('⚠ [배달]');
    expect(stderr).toContain('docs/development/workflow/qa-setup.md');
  });

  it('파일만 없는 경우와 디렉터리가 없는 경우를 구분해 말한다', () => {
    // 고치는 방법이 다르고 코드가 쉽게 구별할 수 있다.
    const onlyFile = makeSandbox({ phase: 'planning', omitDoc: 'qa-setup' });
    expect(runWf(onlyFile, ['approve-plan']).stderr).toContain('디렉터리는 있으나 이 파일만 없음');

    const noDir = makeSandbox({ phase: 'planning', omitDir: true });
    expect(runWf(noDir, ['approve-plan']).stderr).toContain('절차 문서 디렉터리 자체가 없음');
  });

  it('문서를 읽을 수 없어도 전이는 진행하고 원인을 말한다', () => {
    // 이름은 readdir에 있는데 읽기가 실패하는 경우. 예외를 그대로 올리면 배달 쪽 catch가 진단까지
    // 삼켜 아무 말 없이 절차가 안 나간다 — 이 기구가 막으려는 단 하나의 결과다.
    const box = makeSandbox({ phase: 'planning', unreadableDoc: 'qa-setup' });
    const { status, stdout, stderr } = runWf(box, ['approve-plan']);

    expect(status).toBe(0);
    expect(readState(box).phase).toBe('qa-setup');
    expect(stdout).not.toContain('BODY-qa-setup');
    expect(stderr).toContain('⚠ [배달]');
    expect(stderr).toContain('파일은 있으나 읽을 수 없음');
  });

  it('문서를 읽을 수 없어도 steps는 죽지 않는다', () => {
    // steps는 압축 이후의 복구 커맨드라, 여기서 원시 스택으로 죽으면 복구 경로 자체가 사라진다.
    const box = makeSandbox({ phase: 'verification', unreadableDoc: 'verification' });
    const { status, stderr } = runWf(box, ['steps']);

    expect(status).toBe(0);
    expect(stderr).toContain('⚠ [배달]');
    expect(stderr).not.toContain('EISDIR');
  });

  it('steps <phase>는 상태 파일이 없어도 돈다', () => {
    // 절차를 잃어버렸을 때 치는 커맨드다. 상태까지 잃은 상황에서 안 돌면 쓸모가 없다.
    const box = makeSandbox({ phase: 'planning' });
    fs.rmSync(path.join(box, '.claude/workflow-state.json'));
    const { status, stdout } = runWf(box, ['steps', 'verification']);

    expect(status).toBe(0);
    expect(stdout).toContain('BODY-verification');
  });

  it('check-docs가 단독으로 돈다 — 정합하면 0, 누락이면 1', () => {
    const ok = makeSandbox({ phase: 'planning' });
    expect(runWf(ok, ['check-docs']).status).toBe(0);

    const broken = makeSandbox({ phase: 'planning', omitDoc: 'verification' });
    const r = runWf(broken, ['check-docs']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('verification.md');
  });

  it('check-docs가 README.md 누락도 잡는다 (CLI와 순수 함수가 같은 규칙이어야 한다)', () => {
    // 판정 로직이 workflow.mjs와 tests/helpers/WorkflowSteps.ts 두 곳에 복사돼 있다(CLI가 그
    // 모듈을 import할 수 없다). 헬퍼 쪽만 fixture로 덮으면 CLI 쪽을 되돌려도 초록불이 뜨므로,
    // "두 곳을 함께 고친다"는 규율에 이빨이 없다. 이 단언이 그 이빨이다.
    const box = makeSandbox({ phase: 'planning', omitIndex: true });
    const r = runWf(box, ['check-docs']);

    expect(r.status).toBe(1);
    expect(r.stderr).toContain('README.md');
  });

  it('커맨드 목록에 steps와 check-docs가 있다', () => {
    // 치명적 판정을 런타임 로드 시점에 두지 않는다 — 그 자리는 status·check-meta·도움말까지
    // 모든 경로가 지나므로, 거기서 죽이면 오타 하나로 진단 수단까지 잃고 훅이 상태 파일
    // 편집을 막아 사람이 갇힌다.
    const box = makeSandbox({ phase: 'planning' });
    const { status, stdout } = runWf(box, []);

    expect(status).toBe(0);
    expect(stdout).toContain('steps');
    expect(stdout).toContain('check-docs');
  });
});

// ---------------------------------------------------------------------------
// 4.5 크기 예산 — 재성장 차단
// ---------------------------------------------------------------------------

describe('크기 예산 (재성장 차단)', () => {
  // 자수는 UTF-8 문자열 길이, 줄 수는 그 문자열의 개행 분할 수로 잰다. PowerShell로 재면
  // 한국어 문서의 자수가 약 1.18배 부풀고 빈 줄이 누락돼 값이 어긋난다.
  const claudeMd = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');

  it('CLAUDE.md가 14,000자 이하다', () => {
    // 컨텍스트 비용이 실제로 사는 곳이라 자수가 주 지표다. 분할 전 24,971자.
    expect(claudeMd.length).toBeLessThanOrEqual(14_000);
  });

  it('CLAUDE.md가 240줄 이하다', () => {
    // 이 파일은 한 줄이 200자를 넘는 곳이 30군데라 줄 수는 비용의 대리지표로 나쁘다.
    // 공식 권장치 200줄은 잔류 목록의 산술상 도달 불가라 걸지 않는다. 분할 전 355줄.
    expect(claudeMd.split('\n').length).toBeLessThanOrEqual(240);
  });

  it('절차 문서가 개당 4,000자 이하다', () => {
    const oversized = fs
      .readdirSync(STEP_DOC_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({ f, size: fs.readFileSync(path.join(STEP_DOC_DIR, f), 'utf8').length }))
      .filter((d) => d.size > 4_000);
    expect(oversized).toEqual([]);
  });

  it('절차 문서 합계가 16,000자 이하다', () => {
    const total = fs
      .readdirSync(STEP_DOC_DIR)
      .filter((f) => f.endsWith('.md'))
      .reduce((sum, f) => sum + fs.readFileSync(path.join(STEP_DOC_DIR, f), 'utf8').length, 0);
    expect(total).toBeLessThanOrEqual(16_000);
  });
});

// ---------------------------------------------------------------------------
// 4.4 정본 선언 게이트 — 샌드박스 E2E
// ---------------------------------------------------------------------------

/**
 * canon 테스트용 인덱스 — **실물과 같이 「분류 접두사」 표가 「목록」보다 앞에 온다.**
 * 표가 하나뿐인 픽스처를 쓰면 "파일의 첫 구분선에 넣는" 버그가 초록불로 지나간다.
 */
const SPEC_README = `# 정본

## 분류 접두사 — 닫힌 집합

| 접두사 | 범위 |
|---|---|
| \`code-\` | 코드 작성 규약 |

## 목록

| 문서 | 답하는 질문 |
|---|---|
`;

describe('정본 선언 게이트', () => {
  it('선언이 없으면 네 검증이 다 차도 전이를 막는다', () => {
    const box = makeSandbox({ phase: 'verification', allChecksClean: true });
    const { status, stderr } = runWf(box, ['pass', 'review']);

    expect(status).toBe(1);
    expect(stderr).toContain('정본 갱신 여부가 선언되지 않았습니다');
    expect(readState(box).phase).toBe('verification');
  });

  it('막힌 뒤에도 pass 플래그는 보존된다 — 선언하고 다시 치면 곧장 전이', () => {
    const box = makeSandbox({ phase: 'verification', allChecksClean: true });
    runWf(box, ['pass', 'review']);
    expect(readState(box).verification.code_review_clean).toBe(true);

    runWf(box, ['canon-skip', '코드 동작만 바뀌어 JSDoc이 정본이다']);
    expect(runWf(box, ['pass', 'review']).status).toBe(0);
    expect(readState(box).phase).toBe('user-verification');
  });

  it('canon-done은 실재하는 경로만 받는다', () => {
    const box = makeSandbox({ phase: 'verification', allChecksClean: true });
    const missing = runWf(box, ['canon-done', 'docs/development/spec/없는문서.md']);

    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('그런 파일이 없습니다');
    expect(readState(box).canon_updated).toEqual([]);
  });

  it('canon-done이 기록하면 전이가 열린다', () => {
    const box = makeSandbox({ phase: 'verification', allChecksClean: true });
    fs.mkdirSync(path.join(box, 'docs/development/spec'), { recursive: true });
    fs.writeFileSync(path.join(box, 'docs/development/spec/code-foo.md'), '# foo');

    expect(runWf(box, ['canon-done', 'docs/development/spec/code-foo.md']).status).toBe(0);
    // 경로는 항상 슬래시로 저장된다 — Windows 구분자가 들어가면 머신마다 갈린다.
    expect(readState(box).canon_updated).toEqual(['docs/development/spec/code-foo.md']);
    expect(runWf(box, ['pass', 'review']).status).toBe(0);
  });

  it('canon-skip은 사유가 없으면 거부한다', () => {
    const box = makeSandbox({ phase: 'verification', allChecksClean: true });
    expect(runWf(box, ['canon-skip']).status).toBe(1);
    expect(readState(box).canon_skip_reason).toBeNull();
  });

  it('invalidate가 정본 선언을 함께 지운다', () => {
    // 코드가 바뀌면 "명세도 바뀌었나"라는 판단이 낡는다. 남겨 두면 초기 구현 기준으로
    // 한 번 선언한 뒤의 모든 변경이 게이트를 그냥 통과한다.
    const box = makeSandbox({
      phase: 'verification',
      allChecksClean: true,
      canonSkipReason: '바꾼 명세 없음',
    });
    runWf(box, ['invalidate']);

    const s = readState(box);
    expect(s.canon_skip_reason).toBeNull();
    expect(s.canon_updated).toEqual([]);
  });

  it('canon은 접두사 집합 밖의 슬러그를 거부한다', () => {
    const box = makeSandbox({ phase: 'implementation' });
    const { status, stderr } = runWf(box, ['canon', 'misc-foo', '제목', '질문']);

    expect(status).toBe(1);
    expect(stderr).toContain('허용되지 않은 분류 접두사');
  });

  it('canon은 인덱스가 없으면 문서를 만들지 않는다', () => {
    // 등재 없이 문서만 생기면 폴더를 훑어 무엇이 있는지 보려는 목적이 깨진다.
    const box = makeSandbox({ phase: 'implementation' });
    const { status } = runWf(box, ['canon', 'code-foo', '제목', '질문']);

    expect(status).toBe(1);
    expect(fs.existsSync(path.join(box, 'docs/development/spec/code-foo.md'))).toBe(false);
  });

  it('canon이 문서를 만들고 인덱스에 등재하고 갱신을 기록한다', () => {
    const box = makeSandbox({ phase: 'implementation' });
    fs.mkdirSync(path.join(box, 'docs/development/spec'), { recursive: true });
    fs.writeFileSync(path.join(box, 'docs/development/spec/README.md'), SPEC_README);

    expect(runWf(box, ['canon', 'game-combat', '판정 규칙', '무엇이 무엇에 맞나']).status).toBe(0);

    const doc = fs.readFileSync(path.join(box, 'docs/development/spec/game-combat.md'), 'utf8');
    expect(doc).toContain('# 판정 규칙');
    expect(doc).toContain('> 무엇이 무엇에 맞나');
    // 머리말이 CLI 쪽에서도 나오는지 고정한다 — 이 표시가 "새로 만들지 말고 고쳐라"를
    // 읽는 사람에게 알리는 자리다(코드리뷰 5차).
    expect(doc).toContain('- **상태:** CONFIRMED');

    const readme = fs.readFileSync(path.join(box, 'docs/development/spec/README.md'), 'utf8');
    expect(readme).toContain('[`game-combat.md`](game-combat.md)');

    expect(readState(box).canon_updated).toEqual(['docs/development/spec/game-combat.md']);
  });

  it('--design은 디자인 폴더에 쓰고 목록 표에 등재한다', () => {
    // 코드리뷰 4차 전까지 이 분기는 커버리지가 0이었고, 실물 두 표 README에서 행이
    // 「분류 접두사」 표로 들어가는 결함이 여기 살아 있었다.
    const box = makeSandbox({ phase: 'implementation' });
    fs.mkdirSync(path.join(box, 'docs/design/spec'), { recursive: true });
    // 뒤에 와야 할 행을 미리 넣어 CLI 쪽 정렬까지 여기서 고정한다.
    fs.writeFileSync(
      path.join(box, 'docs/design/spec/README.md'),
      `${SPEC_README}| [\`ui-zzz.md\`](ui-zzz.md) | 나중 것 |\n`,
    );

    const r = runWf(box, ['canon', 'ui-flow', '화면 흐름', '화면이 어떻게 이어지나', '--design']);
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(box, 'docs/design/spec/ui-flow.md'))).toBe(true);
    expect(fs.existsSync(path.join(box, 'docs/development/spec/ui-flow.md'))).toBe(false);

    const readme = fs.readFileSync(path.join(box, 'docs/design/spec/README.md'), 'utf8');
    const lines = readme.split('\n');
    expect(lines.findIndex((l) => l.includes('ui-flow.md'))).toBeGreaterThan(
      lines.findIndex((l) => l.trim() === '## 목록'),
    );
    expect(lines.findIndex((l) => l.includes('ui-flow.md'))).toBeLessThan(
      lines.findIndex((l) => l.includes('ui-zzz.md')),
    );
    expect(readState(box).canon_updated).toEqual(['docs/design/spec/ui-flow.md']);
  });

  it('--design은 개발 접두사를, 개발 쪽은 디자인 접두사를 거부한다', () => {
    const box = makeSandbox({ phase: 'implementation' });
    for (const dir of ['docs/design/spec', 'docs/development/spec']) {
      fs.mkdirSync(path.join(box, dir), { recursive: true });
      fs.writeFileSync(path.join(box, dir, 'README.md'), SPEC_README);
    }
    expect(runWf(box, ['canon', 'code-x', 'T', 'Q', '--design']).status).toBe(1);
    expect(runWf(box, ['canon', 'art-x', 'T', 'Q']).status).toBe(1);
  });

  it('canon-done은 레포 밖 경로를 거부한다', () => {
    // /cso가 잡은 결함이다. 파일을 쓰지는 않지만 밖을 가리키는 경로는 타 머신에서 의미가 없고,
    // 존재 검사를 넣은 목적(아무 경로로 게이트만 통과시키는 것을 막는다)이 그대로 샜다.
    const box = makeSandbox({ phase: 'verification', allChecksClean: true });
    const outside = path.join(box, '..', `outside-${path.basename(box)}.txt`);
    fs.writeFileSync(outside, 'x');
    try {
      const { status, stderr } = runWf(box, ['canon-done', `../${path.basename(outside)}`]);
      expect(status).toBe(1);
      expect(stderr).toContain('레포 밖 경로');

      // **절대 경로도 막는다.** Windows에서 드라이브가 다르면 path.relative가 `../`가 아니라
      // 절대 경로를 그대로 돌려주므로 위 상대 경로 케이스만으로는 그 절반이 비어 있다
      // (샌드박스는 임시 드라이브, 이 레포는 F: — 코드리뷰 5차 NEW-1).
      // POSIX는 루트가 하나라 `../`로 떨어지지만, 어느 쪽이든 거부되는 것이 계약이다.
      expect(runWf(box, ['canon-done', path.join(ROOT, 'package.json')]).status).toBe(1);

      // 디렉터리도 정본이 아니다.
      expect(runWf(box, ['canon-done', 'docs']).status).toBe(1);

      expect(readState(box).canon_updated).toEqual([]);
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  it('canon 재실행이 인덱스 행을 두 벌로 만들지 않는다', () => {
    // M1로 쓰기 순서를 뒤집으면서 재실행이 **설계된 복구 경로**가 됐다. CLI 쪽 멱등 판정이
    // 헬퍼와 갈라지면 그 복구가 중복 행을 낳는다(코드리뷰 5차 NEW-1).
    const box = makeSandbox({ phase: 'implementation' });
    const spec = path.join(box, 'docs/development/spec');
    fs.mkdirSync(spec, { recursive: true });
    fs.writeFileSync(path.join(spec, 'README.md'), SPEC_README);

    expect(runWf(box, ['canon', 'code-x', '제목', '질문']).status).toBe(0);
    // 인덱스만 쓰이고 문서 쓰기 직전에 죽은 상태를 만든다.
    fs.rmSync(path.join(spec, 'code-x.md'));
    expect(runWf(box, ['canon', 'code-x', '제목', '질문']).status).toBe(0);

    const rows = fs.readFileSync(path.join(spec, 'README.md'), 'utf8').split('\n');
    expect(rows.filter((l) => l.includes('code-x.md'))).toHaveLength(1);
    expect(fs.existsSync(path.join(spec, 'code-x.md'))).toBe(true);
  });

  it('canon은 질문의 줄바꿈을 거부한다 — 인덱스에 가짜 행이 앉는다', () => {
    const box = makeSandbox({ phase: 'implementation' });
    fs.mkdirSync(path.join(box, 'docs/development/spec'), { recursive: true });
    fs.writeFileSync(path.join(box, 'docs/development/spec/README.md'), SPEC_README);

    const injected = 'Q |\n| [`fake.md`](fake.md) | 가짜 행 |';
    expect(runWf(box, ['canon', 'code-x', '제목', injected]).status).toBe(1);

    const readme = fs.readFileSync(path.join(box, 'docs/development/spec/README.md'), 'utf8');
    expect(readme).not.toContain('fake.md');
  });

  it('canon은 이미 있는 문서를 덮어쓰지 않는다', () => {
    const box = makeSandbox({ phase: 'implementation' });
    fs.mkdirSync(path.join(box, 'docs/development/spec'), { recursive: true });
    fs.writeFileSync(path.join(box, 'docs/development/spec/README.md'), SPEC_README);
    fs.writeFileSync(path.join(box, 'docs/development/spec/game-combat.md'), '기존 내용');

    const { status, stderr } = runWf(box, ['canon', 'game-combat', '판정', '질문']);
    expect(status).toBe(1);
    expect(stderr).toContain('정본은 새로 만들지 않고 고칩니다');
    expect(fs.readFileSync(path.join(box, 'docs/development/spec/game-combat.md'), 'utf8')).toBe(
      '기존 내용',
    );
  });
});
