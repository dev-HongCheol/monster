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
}

interface SandboxOptions {
  /** 시작 phase */
  phase: string;
  /** 네 검증 플래그를 모두 통과로 둘지 (전체 pass 경로 테스트용) */
  allChecksClean?: boolean;
  /** 이미 배달된 phase 목록 (차등 배달 테스트용) */
  docsDelivered?: string[];
  /** 테스트 스킵 상태 — ready-impl이 vitest를 띄우지 않게 한다 */
  testSkipped?: boolean;
  /** 계획 문서를 만들지 (approve-plan 게이트) */
  planDoc?: boolean;
  /** QA 문서에 미확정 표시를 넣을지 (pass의 QA 확정 게이트) */
  qaProvisional?: boolean;
  /** 이 phase 문서만 만들지 않는다 */
  omitDoc?: string;
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
    write('docs/development/workflow/README.md', '# 인덱스\n');
    for (const phase of DELIVERED_PHASES) {
      if (phase === opts.omitDoc) continue;
      write(`docs/development/workflow/${phase}.md`, stubDoc(phase));
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
    const box = makeSandbox({ phase: 'verification', allChecksClean: true });
    const { status, stdout } = runWf(box, ['pass', 'review']);

    expect(status).toBe(0);
    expect(stdout).toContain('BODY-user-verification');
  });

  it('QA 확정 게이트에서 죽으면 배달하지 않는다', () => {
    // pass는 allClean 이후에도 QA 잠정 태그 게이트에서 죽는다. 배달을 allClean 시점에
    // 붙이면 전이하지도 않은 pass에서 user-verification 절차가 샌다.
    const box = makeSandbox({ phase: 'verification', allChecksClean: true, qaProvisional: true });
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

  it('check-docs가 단독으로 돈다 — 정합하면 0, 누락이면 1', () => {
    const ok = makeSandbox({ phase: 'planning' });
    expect(runWf(ok, ['check-docs']).status).toBe(0);

    const broken = makeSandbox({ phase: 'planning', omitDoc: 'verification' });
    const r = runWf(broken, ['check-docs']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('verification.md');
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
