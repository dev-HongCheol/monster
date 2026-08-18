/**
 * 결정 기록이 현재 정본으로 가는 경로를 들고 있는가 — `docs-references.md` §7의 기계 판정.
 *
 * 단방향 링크(정본은 결정 기록을 링크하지 않는다)는 **링크를 타는 독자만** 보호한다. 의미 검색은
 * 링크 방향을 모르므로 몇 달 전 세션 문서를 현재 정본보다 위에 올려 주고, 그렇게 문서 **안쪽**에
 * 착지한 사람에게 "현재는 여기"를 알려 주는 것이 머리말의 `정본:` 줄이다. 그래서 이 검사는
 * `DocLinks.test.ts`(정본 층)와 층이 갈린다 — 저쪽은 정본이 무엇을 가리키면 안 되는가를 보고,
 * 여기는 결정 기록이 무엇을 가리켜야 하는가를 본다.
 *
 * **판정은 `CanonRef.ts`가 하고 파일 읽기는 `DocFs.ts`가 한다.** 읽는 쪽이 `git ls-files`가 아니라
 * 디스크인 이유는 `loadSessionDocs`의 주석이 든다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkCanonLine,
  ENFORCED_FROM,
  findMissingCanonLines,
  formatViolation,
  isEnforced,
} from '../helpers/CanonRef';
import { loadSessionDocs, ROOT } from '../helpers/DocFs';

/** 머리말 뒤에 본문이 오는 최소 형태. 검사 대상은 첫 `---` 앞이다. */
const frontmatter = (lines: string[]) =>
  ['# 제목', '', ...lines, '', '---', '', '## 1. 본문'].join('\n');

describe('isEnforced — 경계는 파일명의 날짜다', () => {
  it('경계일 이후 세션 문서는 대상이다', () => {
    expect(isEnforced('2026-08-18-docs-references-plan.md', ENFORCED_FROM)).toBe(true);
    expect(isEnforced('2026-09-01-something.md', ENFORCED_FROM)).toBe(true);
  });

  it('경계일 이전 세션 문서는 대상이 아니다 — 소급하지 않는다', () => {
    expect(isEnforced('2026-08-17-something.md', ENFORCED_FROM)).toBe(false);
    expect(isEnforced('2026-05-16-cocos-setup-plan.md', ENFORCED_FROM)).toBe(false);
  });

  it('날짜로 시작하지 않는 파일명은 대상이 아니다', () => {
    // 세션 폴더의 규약은 `YYYY-MM-DD-주제.md`다. 규약 밖의 파일에 날짜 경계를 적용할 방법이
    // 없으므로 조용히 통과시킨다 — 여기서 잡으면 규약 위반과 `정본:` 줄 누락이 한 메시지로
    // 섞여 나와 어느 쪽을 고쳐야 하는지 알 수 없게 된다.
    expect(isEnforced('README.md', ENFORCED_FROM)).toBe(false);
  });
});

describe('checkCanonLine — 무엇을 통과시키나', () => {
  it('머리말에 링크가 붙은 `정본:` 줄이 있으면 통과한다', () => {
    const doc = frontmatter([
      '- **작성일:** 2026-08-18',
      '- **정본:** [`spec/docs-references.md`](../spec/docs-references.md) — 이 슬라이스가 신설한다',
    ]);
    expect(checkCanonLine(doc)).toBeNull();
  });

  it('줄이 아예 없으면 잡는다', () => {
    expect(checkCanonLine(frontmatter(['- **작성일:** 2026-08-18']))).toBe('missing');
  });

  it('링크 없이 산문으로만 적으면 잡는다', () => {
    // 산문으로만 적으면 그 문서 안쪽에 착지한 사람이 현재 정본으로 갈 경로를 못 얻는다.
    const doc = frontmatter(['- **정본:** 문서 작성 스타일 문서가 든다']);
    expect(checkCanonLine(doc)).toBe('no-link');
  });

  it('머리말 밖에 있으면 잡는다 — 첫 화면에 있어야 사고 경로 위에 놓인다', () => {
    const doc = [
      '# 제목',
      '',
      '- **작성일:** 2026-08-18',
      '',
      '---',
      '',
      '## 1. 본문',
      '',
      '- **정본:** [`spec/docs-references.md`](../spec/docs-references.md)',
    ].join('\n');
    expect(checkCanonLine(doc)).toBe('not-in-frontmatter');
  });

  it('정본을 안 바꾼 결정 기록은 사유를 적고 빠진다', () => {
    const doc = frontmatter(['- **정본:** 없음 — 판정 수치를 재기만 하고 명세는 안 바꿨다']);
    expect(checkCanonLine(doc)).toBeNull();
  });

  it('사유 없이 「없음」만 적으면 잡는다', () => {
    // `wf canon-skip "<사유>"`와 같은 방식이다. 빈칸으로 빠져나가는 길을 막는다. 구분자만 찍거나
    // 한 글자를 적는 것도 빈칸을 메운 것이지 사유가 아니라서 함께 막는다.
    expect(checkCanonLine(frontmatter(['- **정본:** 없음']))).toBe('empty-reason');
    expect(checkCanonLine(frontmatter(['- **정본:** 없음 —']))).toBe('empty-reason');
    expect(checkCanonLine(frontmatter(['- **정본:** 없음.']))).toBe('empty-reason');
    expect(checkCanonLine(frontmatter(['- **정본:** 없음 — ㅁ']))).toBe('empty-reason');
  });

  it('CRLF 문서에서도 줄을 찾는다', () => {
    // 줄 끝을 LF로 안 맞추면 정규식의 `$`가 `\r` 앞에서 안 맞아, 멀쩡히 있는 줄을 「없다」고
    // 신고한다. 이 레포에 CRLF 문서가 셋 있어서(세션 하나·정본 둘) 가정이 아니다.
    const lines = [
      '# 제목',
      '',
      '- **정본:** [`spec/docs-references.md`](../spec/docs-references.md) — 신설한다',
      '',
      '---',
      '',
      '## 1. 본문',
    ];
    expect(checkCanonLine(lines.join('\r\n'))).toBeNull();
    expect(
      checkCanonLine(['# 제목', '', '- **정본:** 없음 — 명세를 안 바꿨다'].join('\r\n')),
    ).toBeNull();
  });

  it('코드 펜스 안의 `---`는 머리말을 끊지 않는다', () => {
    // 세션 문서가 예시로 펜스를 열면 그 안의 `---`가 머리말을 조기에 끊어, 진짜 `정본:` 줄이
    // 본문에 있는 것으로 오인된다.
    const doc = [
      '# 제목',
      '',
      '```',
      '---',
      '```',
      '- **정본:** [`spec/docs-references.md`](../spec/docs-references.md)',
      '',
      '---',
      '',
      '## 1. 본문',
    ].join('\n');
    expect(checkCanonLine(doc)).toBeNull();
  });

  it('코드 펜스 안의 예시는 진짜 줄로 세지 않는다', () => {
    const doc = [
      '# 제목',
      '',
      '```',
      '- **정본:** [`예시.md`](예시.md) — 이건 예시다',
      '```',
      '',
      '---',
      '',
      '## 1. 본문',
    ].join('\n');
    expect(checkCanonLine(doc)).toBe('missing');
  });
});

describe('formatViolation — 실패 메시지가 고치는 법을 준다', () => {
  it('파일과 요구 형태와 탈출구를 한 줄에 낸다', () => {
    const msg = formatViolation({ file: '2026-08-18-x-plan.md', problem: 'missing' });
    expect(msg).toContain('2026-08-18-x-plan.md');
    expect(msg).toContain('- **정본:**');
    expect(msg).toContain('없음');
  });
});

describe('레포 전체 회귀망', () => {
  const docs = loadSessionDocs();

  it('경계 이후 세션 문서가 하나 이상 있다', () => {
    // 대상이 0건이면 아래 검사가 아무것도 재지 않으면서 초록을 낸다. `DocLinks.test.ts`가
    // `CANON_SCOPE`의 층별 누락을 재는 것과 같은 이유다.
    const targets = docs.filter((d) => isEnforced(d.name, ENFORCED_FROM));
    expect(targets.length).toBeGreaterThan(0);
  });

  it('경계 이후 세션 문서가 전부 `정본:` 줄을 든다', () => {
    const violations = findMissingCanonLines(docs, ENFORCED_FROM);
    expect(violations.map(formatViolation).join('\n')).toBe('');
  });
});

describe('「문서 정리 규칙」 이전 결과', () => {
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('`CLAUDE.md`가 「문서 정리 규칙」 절을 더는 들지 않는다', () => {
    expect(read('CLAUDE.md')).not.toContain('### 문서 정리 규칙');
  });

  it('`CLAUDE.md`가 Knowledge Base 표에서 새 정본을 가리킨다', () => {
    // 자리가 Workflow 절이 아니라 Knowledge Base여야 하는 이유는, 이 다섯 조항이 문서를
    // **쓰는 동안** 작동해야 하는 규칙이라 쓰기 전에 조회되는 표에 있어야 하기 때문이다.
    // 그래서 파일 어딘가가 아니라 **그 표의 행**을 재야 이 주장이 지켜진다.
    const row = read('CLAUDE.md')
      .split('\n')
      .find((l) => l.startsWith('| 문서끼리 어떻게 참조하나 |'));
    expect(row).toContain('spec/docs-references.md');
  });

  it('참조 조항 다섯이 새 정본에 실제로 도착했다', () => {
    // 떠난 것(`CLAUDE.md`에서 절이 사라짐)만 재면, 내일 새 정본에서 한 조항이 지워져도
    // 스위트가 초록을 유지한다. 다섯을 절 제목으로 하나씩 잡는다.
    const doc = read('docs/development/spec/docs-references.md');
    const missing = [
      '## 2. 참조 방향',
      '## 4. 순환 참조를 만들지 않는다',
      '## 5. 절 번호',
      '## 9. 과거 결정 기록은 고치지 않는다',
      '## 11. 기각·뒤집힌 안을 남기는 법',
    ].filter((h) => !doc.includes(h));
    expect(missing).toEqual([]);
  });

  it('절차 조항이 `user-verification.md`로 옮겨 갔다', () => {
    const doc = read('docs/development/workflow/user-verification.md');
    expect(doc).toContain('백로그 행은 요약이지 본문이 아니다');
    // 옮겨 온 뒤에도 `CLAUDE.md`를 규칙의 소유자로 부르면 포인터가 그대로 남는다.
    expect(doc).not.toContain('`CLAUDE.md`의 「문서 정리 규칙」');
  });

  it('`planning.md`가 `정본:` 줄과 탈출구와 검사기를 모두 든다', () => {
    // 저자는 `planning`에서 문서를 쓰는데 검사 실패는 세 phase 뒤 `start-verification`에 뜬다.
    // 요구를 여기 적지 않으면 절차 정본이 기계 게이트와 어긋난 채로 남는다.
    //
    // 셋을 함께 재는 이유는 하나만 빠져도 절차가 자족적이지 않기 때문이다. 요구만 있고 탈출구가
    // 없으면 명세를 안 바꾼 슬라이스가 막히고, 검사기 이름이 없으면 저자가 실패를 만났을 때
    // 어디서 온 것인지 못 찾는다.
    const doc = read('docs/development/workflow/planning.md');
    expect(doc).toContain('- **정본:**');
    expect(doc).toContain('없음 — <사유>');
    expect(doc).toContain('DocsReferences.test.ts');
  });

  it('나가는 절을 이름으로 부르던 참조가 남아 있지 않다', () => {
    const stale = ['docs/development/workflow/pr-ready.md', 'CLAUDE.md']
      .filter((f) => read(f).includes('「문서 정리 규칙」'))
      .join(', ');
    expect(stale).toBe('');
  });
});
