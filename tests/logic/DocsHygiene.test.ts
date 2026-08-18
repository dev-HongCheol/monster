/**
 * 문서 규칙을 기계가 잡게 하는 게이트 셋의 회귀망.
 *
 * 판정 로직은 `tests/helpers/QaDoc.ts` 한 벌이고 이 파일과 `.claude/workflow.mjs`의
 * `check-qa`가 그것을 쓴다. **CLI는 로직을 베끼지 않고 vitest를 띄운다** — `.mjs`가 `.ts`를
 * import할 수 없기 때문이다(`tsconfig.tests.json`에 `allowJs`가 없어 TS7016으로 `pass ts`가
 * 막힌다. 백로그 F78이 실측으로 접었고, `wf check-links`가 세운 형태를 따른다).
 *
 * **레포 전체에 거는 것과 현재 슬라이스에만 거는 것을 갈랐다.** 스윕은 자동 검증 절 안의
 * 미체크만 본다 — 실측상 46개 문서 전부가 이미 0건이라 오늘부터 초록이고 되돌아가면 빨개지는,
 * 불변식으로 딱 맞는 모양이다. 반면 통과 근거 줄은 15개 문서에 없어서 레포 전체에 걸면 과거
 * 기록을 소급해 고쳐야 하고, 그것은 `spec/docs-references.md` §9가 금지한다. 그래서 근거 줄은
 * CLI가 현재 슬라이스 문서에만 요구한다.
 *
 * 어겼을 때 무엇이 잘못되는지는 2026-08-18에 실제로 났다. `feat/eol-policy`가 6단계 절차
 * 1번(자동 검증 항목을 `[x]`로 바꾸고 통과 근거를 적는다)을 통째로 건너뛴 채 사용자 검증까지
 * 갔는데 네 게이트가 전부 초록이었다. 그 절차 문장은 스스로 "자주 빠뜨리는 단계라 앞에 둔다"고
 * 적어 두었지만 자각이 문장에만 있고 게이트에는 없었다.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadDocs, ROOT } from '../helpers/DocFs';
import {
  BLAME_IGNORE_FILE,
  checkSliceQaDoc,
  countUncheckedInAutoSection,
  findAutoSection,
  hasEvidenceLine,
  listProvisionalMarkers,
  RENORMALIZE_COMMIT,
} from '../helpers/QaDoc';

/** QA 슬라이스 문서만 고른다. `*-review-issues.md`·`*-security-issues.md`는 대상이 아니다. */
function qaTestDocs(): { path: string; content: string }[] {
  return loadDocs().filter((d) => d.path.startsWith('docs/qa/') && d.path.endsWith('-test.md'));
}

describe('blame 무시 목록', () => {
  it('파일이 레포 루트에 있고 재정규화 머지 커밋을 든다', () => {
    const p = path.join(ROOT, BLAME_IGNORE_FILE);
    expect(fs.existsSync(p), `${BLAME_IGNORE_FILE}이 없다`).toBe(true);
    expect(fs.readFileSync(p, 'utf8')).toContain(RENORMALIZE_COMMIT);
  });

  it('적힌 SHA가 실재하는 커밋이다', () => {
    // 존재 확인 없이 두면 오타가 조용히 산다 — git은 모르는 SHA를 무시 목록에서 그냥 넘긴다.
    const r = spawnSync('git', ['cat-file', '-t', RENORMALIZE_COMMIT], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(r.status, `${RENORMALIZE_COMMIT}을 못 찾는다: ${r.stderr}`).toBe(0);
    expect(r.stdout.trim()).toBe('commit');
  });
});

describe('QA 문서 자동 검증 절 — 레포 전체 스윕', () => {
  it('절을 가진 문서가 46개 이상 잡힌다', () => {
    // 경로나 정규식이 틀려 빈 목록이 오면 아래 단언이 "위반 0건"으로 초록을 낸다. 그것은 통과가
    // 아니라 검사를 안 한 것이다. 실측 기준선은 55개 중 46개다.
    const withSection = qaTestDocs().filter((d) => findAutoSection(d.content) !== null);
    expect(withSection.length).toBeGreaterThanOrEqual(46);
  });

  it('그 절 안에 미체크 항목이 하나도 없다', () => {
    const offenders = qaTestDocs()
      .map((d) => ({ path: d.path, n: countUncheckedInAutoSection(d.content) }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.path} (${x.n}건)`);
    expect(offenders, `자동 검증 절에 미체크가 남았다:\n${offenders.join('\n')}`).toEqual([]);
  });
});

/**
 * 현재 슬라이스 문서 판정. `wf check-qa`가 문서 경로를 `WF_QA_DOC`으로 넘겨 이 블록만 켠다.
 *
 * **CLI가 판정을 베끼지 않게 하려고 이 통로를 뒀다.** 상태 파일을 아는 쪽은 CLI뿐이고 판정을 아는
 * 쪽은 여기뿐이라, 경로 하나만 건네면 사본이 안 생긴다. 변수가 없는 평소 실행에서는 통째로
 * 건너뛴다 — 그래야 테스트가 장비의 wf 상태에 의존하지 않는다.
 */
describe.runIf(process.env.WF_QA_DOC)('현재 슬라이스 QA 문서', () => {
  it('미확정 표시가 없고 자동 검증 절이 채워져 있다', () => {
    const rel = process.env.WF_QA_DOC as string;
    const md = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(checkSliceQaDoc(md), `${rel}:\n${checkSliceQaDoc(md).join('\n')}`).toEqual([]);
  });
});

describe('findAutoSection — 절 판정은 접두어로 한다', () => {
  const body = ['- [x] 하나', '', '## 5. 수동 테스트 체크리스트', '- [ ] 사용자 몫'].join('\n');

  it('번호가 붙은 제목을 잡는다', () => {
    expect(findAutoSection(`## 4. 자동 테스트로 검증\n${body}`)).not.toBeNull();
  });

  it('괄호 접미사가 붙은 제목을 잡는다', () => {
    expect(findAutoSection(`## 4. 자동 검증 (사용자가 할 일 아님)\n${body}`)).not.toBeNull();
  });

  it('번호 없는 제목도 잡는다', () => {
    expect(findAutoSection(`## 자동 테스트로 검증\n${body}`)).not.toBeNull();
  });

  it('절이 없으면 null이다 — 소급 강제는 CLI 몫이라 여기서는 조용히 넘긴다', () => {
    expect(findAutoSection('## 1. Impact Map\n- [ ] 뭔가')).toBeNull();
  });

  it('다음 `##`에서 절이 끝난다 — 수동 절의 미체크를 세지 않는다', () => {
    expect(countUncheckedInAutoSection(`## 4. 자동 검증\n${body}`)).toBe(0);
  });
});

describe('countUncheckedInAutoSection — 코드는 세지 않는다 (F92)', () => {
  it('코드 펜스 안의 예시를 안 센다', () => {
    const md = ['## 4. 자동 검증', '', '```md', '- [ ] 이건 예시다', '```', '', '- [x] 진짜'].join(
      '\n',
    );
    expect(countUncheckedInAutoSection(md)).toBe(0);
  });

  it('인라인 코드 스팬 안의 예시를 안 센다 — F92 자체의 회귀 테스트다', () => {
    const md = [
      '## 4. 자동 검증',
      '',
      '체크는 `- [ ]`에서 `- [x]`로 바꾼다.',
      '',
      '- [x] 진짜',
    ].join('\n');
    expect(countUncheckedInAutoSection(md)).toBe(0);
  });

  it('평문 미체크는 센다', () => {
    expect(countUncheckedInAutoSection('## 4. 자동 검증\n\n- [ ] 안 돌렸다')).toBe(1);
  });
});

describe('hasEvidenceLine — 통과 근거와 스킵 탈출구', () => {
  it('통과 근거 줄을 인정한다', () => {
    const md = '## 4. 자동 검증\n\n**통과 근거(2026-08-19):** 피처 3/3, 전체 48파일 842/842.';
    expect(hasEvidenceLine(md)).toBe(true);
  });

  it('사유가 붙은 스킵을 인정한다', () => {
    const md = '## 4. 자동 검증\n\n**스킵 — 순수 로직이 없어 `wf skip-test`로 넘긴 슬라이스다.**';
    expect(hasEvidenceLine(md)).toBe(true);
  });

  it('사유 없는 스킵은 인정하지 않는다', () => {
    expect(hasEvidenceLine('## 4. 자동 검증\n\n**스킵**')).toBe(false);
  });

  it('근거가 아예 없으면 false다', () => {
    expect(hasEvidenceLine('## 4. 자동 검증\n\n- [x] 돌렸다')).toBe(false);
  });

  it('절이 없으면 false다 — 없는 절에서 근거를 찾았다고 하지 않는다', () => {
    expect(hasEvidenceLine('## 1. Impact Map\n\n**통과 근거:** 아무거나')).toBe(false);
  });
});

/**
 * `wf start` 기준점 가드의 E2E. 진짜 git 저장소를 임시로 만들어 실제 `workflow.mjs`를 띄운다.
 *
 * 순수 함수로 못 재는 판정이라 여기서만 잡힌다 — 걸리는 것이 `git merge-base`·`rev-list`의 실제
 * 동작이고, 그 배선이 틀리면 가드가 **조용히 통과**해서 낡은 트리 위에서 슬라이스가 선다.
 */
describe('wf start — 기준점 가드', () => {
  const sandboxes: string[] = [];
  afterEach(() => {
    for (const d of sandboxes.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  /** main에 커밋 둘, `feat/stale`은 첫 커밋에 세워 두고, origin/main은 두 번째를 가리키게 한다. */
  function makeRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-base-'));
    sandboxes.push(dir);
    const run = (...args: string[]): void => {
      const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    };
    run('init', '--quiet', '--initial-branch=main');
    run('config', 'user.email', 't@t');
    run('config', 'user.name', 't');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one\n');
    run('add', '-A');
    run('commit', '--quiet', '-m', 'c1');
    run('branch', 'feat/stale'); // 여기서 갈라져 뒤처진 브랜치
    fs.writeFileSync(path.join(dir, 'a.txt'), 'two\n');
    run('add', '-A');
    run('commit', '--quiet', '-m', 'c2');
    run('update-ref', 'refs/remotes/origin/main', 'main'); // origin/main = c2
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    return dir;
  }

  function wfStart(dir: string, feature: string): { status: number | null; stderr: string } {
    const r = spawnSync(
      process.execPath,
      [path.join(ROOT, '.claude', 'workflow.mjs'), 'start', feature],
      {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
      },
    );
    return { status: r.status, stderr: r.stderr ?? '' };
  }

  it('이미 있는 브랜치가 origin/main보다 뒤처졌으면 막는다', () => {
    // 2026-08-19에 실제로 난 경로다. 브랜치가 예전에 만들어져 있으면 `wf start`가 그 낡은 지점으로
    // 그냥 전환했고, 계획이 최근 머지된 인프라가 없는 트리 위에 섰다.
    const dir = makeRepo();
    const r = wfStart(dir, 'stale');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('origin/main보다 1커밋 뒤');
    expect(r.stderr).toContain('git merge --ff-only origin/main');
  });

  it('로컬 main이 뒤처졌으면 새 이름이어도 막는다', () => {
    // 이 경로로 두 번 샜고 백로그 ID 충돌로 남았다(F47·F48).
    const dir = makeRepo();
    spawnSync('git', ['reset', '--hard', '--quiet', 'HEAD~1'], { cwd: dir, encoding: 'utf8' });
    const r = wfStart(dir, 'brand-new');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('main이(가) origin/main보다 1커밋 뒤');
  });

  it('기준점이 origin/main을 담고 있으면 통과시킨다', () => {
    const dir = makeRepo();
    const r = wfStart(dir, 'brand-new');
    expect(r.status, r.stderr).toBe(0);
    const state = JSON.parse(
      fs.readFileSync(path.join(dir, '.claude', 'workflow-state.json'), 'utf8'),
    );
    expect(state.feature).toBe('brand-new');
  });
});

describe('listProvisionalMarkers — 미확정 표시도 코드를 세지 않는다 (F92)', () => {
  it('평문 미확정 표시를 잡는다', () => {
    expect(listProvisionalMarkers('제목 (잠정 — 구현 후 확정)')).toHaveLength(1);
  });

  it('코드 스팬 안의 태그 이름은 안 잡는다', () => {
    // 2026-08-18에 실제로 났다. "미확정 항목이 없다"고 선언한 문장 자체가 물려 게이트가 거짓으로
    // 실패했고, 그 문서는 태그 이름을 안 쓰는 쪽으로 문장을 비틀어 우회했다.
    expect(listProvisionalMarkers('미확정 값에는 `(잠정 …)`을 붙인다.')).toEqual([]);
  });

  it('코드 펜스 안의 태그 이름도 안 잡는다', () => {
    expect(listProvisionalMarkers('```md\n제목 (가칭 Foo)\n```')).toEqual([]);
  });
});
