/**
 * 정본(canon) 문서 생성기의 순수 로직 가드.
 *
 * CLI(`pnpm wf canon`)가 이 함수들로 슬러그를 검증하고 본문·인덱스 행을 만든다. 게이트 쪽
 * E2E는 `ClaudeMdSplit.test.ts`가 든다 — 샌드박스 하네스가 거기 있다.
 */

import { describe, expect, it } from 'vitest';
import {
  assertOneLineField,
  DESIGN_PREFIXES,
  DEV_PREFIXES,
  insertCanonRow,
  parseCanonSlug,
  renderCanonDoc,
} from '../helpers/CanonDoc';

describe('parseCanonSlug', () => {
  it('접두사와 주제로 가른다', () => {
    expect(parseCanonSlug('code-architecture', DEV_PREFIXES)).toEqual({
      prefix: 'code',
      topic: 'architecture',
    });
  });

  it('주제에 하이픈이 여럿이어도 접두사는 첫 조각 하나다', () => {
    expect(parseCanonSlug('game-combat-rules', DEV_PREFIXES)).toEqual({
      prefix: 'game',
      topic: 'combat-rules',
    });
  });

  it('주제에 숫자를 허용한다 (i18n)', () => {
    expect(parseCanonSlug('code-i18n', DEV_PREFIXES)).toEqual({ prefix: 'code', topic: 'i18n' });
  });

  it('디자인 쪽은 접두사 집합이 다르다', () => {
    expect(parseCanonSlug('art-direction', DESIGN_PREFIXES)).toEqual({
      prefix: 'art',
      topic: 'direction',
    });
    // 개발 접두사를 디자인 쪽에 쓰면 막힌다 — 집합이 폴더마다 닫혀 있다.
    expect(() => parseCanonSlug('code-foo', DESIGN_PREFIXES)).toThrow(/접두사/);
  });

  it('닫힌 집합 밖의 접두사를 거부하고 허용 목록을 알려 준다', () => {
    expect(() => parseCanonSlug('misc-foo', DEV_PREFIXES)).toThrow(/code/);
  });

  it('주제가 없으면 거부한다', () => {
    expect(() => parseCanonSlug('code', DEV_PREFIXES)).toThrow();
    expect(() => parseCanonSlug('code-', DEV_PREFIXES)).toThrow();
  });

  it('대문자를 거부한다 — 파일명 대소문자가 갈리면 Windows에서만 통과한다', () => {
    expect(() => parseCanonSlug('Code-Architecture', DEV_PREFIXES)).toThrow();
  });

  it('확장자를 붙이면 거부한다 — CLI가 .md를 붙인다', () => {
    expect(() => parseCanonSlug('code-architecture.md', DEV_PREFIXES)).toThrow();
  });

  it('경로 구분자와 상위 참조를 거부한다 (CLI가 이 값으로 파일을 쓴다)', () => {
    for (const bad of ['../evil', 'code-a/b', 'code-a\\b', '..', 'code-..']) {
      expect(() => parseCanonSlug(bad, DEV_PREFIXES), bad).toThrow();
    }
  });
});

describe('assertOneLineField', () => {
  it('평범한 한 줄은 통과한다', () => {
    expect(() => assertOneLineField('무엇이 무엇에 맞나', '질문')).not.toThrow();
  });

  it('줄바꿈을 거부한다 — 인덱스 표에 가짜 행이 삽입된다', () => {
    // /cso가 잡은 결함이다. `Q |\n| [\`fake.md\`](fake.md) | 가짜 |`를 넣으면 목록에
    // 등재된 적 없는 정본이 한 줄 앉는다.
    expect(() => assertOneLineField('Q\n| [`fake.md`](fake.md) | 가짜 |', '질문')).toThrow(
      /줄바꿈/,
    );
    expect(() => assertOneLineField('Q\r\nX', '질문')).toThrow(/줄바꿈/);
  });

  it('파이프를 거부한다 — 그 자리에서 열이 갈린다', () => {
    expect(() => assertOneLineField('a | b', '질문')).toThrow(/\|/);
  });

  it('빈 값과 공백만 있는 값을 거부한다', () => {
    expect(() => assertOneLineField('', '제목')).toThrow();
    expect(() => assertOneLineField('   ', '제목')).toThrow();
  });
});

describe('renderCanonDoc', () => {
  const doc = renderCanonDoc({
    slug: 'game-combat',
    title: '판정 규칙',
    question: '무엇이 무엇에 맞나',
    date: '2026-08-12',
  });

  it('제목과 답하는 질문을 맨 위에 둔다', () => {
    expect(doc.startsWith('# 판정 규칙\n')).toBe(true);
    expect(doc).toContain('> 무엇이 무엇에 맞나');
  });

  it('기존 정본과 같은 머리말을 쓴다 (writing-style.md 모양)', () => {
    expect(doc).toContain('- **최초 작성:** 2026-08-12');
    expect(doc).toContain('- **상태:** CONFIRMED');
    expect(doc).toContain('- **이력:** 2026-08-12 — 신설');
  });

  it('정본을 고쳐 쓰라는 안내를 본문에 심는다', () => {
    // 이 한 줄이 "새로 만들지 말고 고친다"를 쓰는 시점에 상기시킨다.
    expect(doc).toMatch(/새로 만들지 않고 이 문서를 고친다/);
  });

  it('결정 기록으로 나가는 링크를 넣지 않는다', () => {
    // 정본 → 세션·ADR 링크는 「문서 정리 규칙」이 금지한 방향이다. 템플릿이 그걸 심으면 안 된다.
    expect(doc).not.toMatch(/\]\(.*(sessions|decisions)\//);
  });
});

describe('insertCanonRow', () => {
  const README = [
    '# 개발 정본 (spec)',
    '',
    '## 목록',
    '',
    '| 문서 | 답하는 질문 |',
    '|---|---|',
    '| [`code-conventions.md`](code-conventions.md) | 코드를 어떻게 쓰나 |',
    '',
  ].join('\n');

  it('목록 표에 행을 넣는다', () => {
    const out = insertCanonRow(README, 'game-combat', '무엇이 무엇에 맞나');
    expect(out).toContain('| [`game-combat.md`](game-combat.md) | 무엇이 무엇에 맞나 |');
  });

  it('슬러그 사전순으로 정렬해 넣는다', () => {
    const out = insertCanonRow(README, 'code-architecture', '폴더 구조가 어떻게 되나');
    const rows = out.split('\n').filter((l) => l.startsWith('| ['));
    expect(rows[0]).toContain('code-architecture.md');
    expect(rows[1]).toContain('code-conventions.md');
  });

  it('멱등하다 — 이미 있는 슬러그면 원본을 그대로 돌려준다', () => {
    const once = insertCanonRow(README, 'game-combat', '무엇이 무엇에 맞나');
    expect(insertCanonRow(once, 'game-combat', '다른 설명')).toBe(once);
  });

  it('목록 표가 없으면 예외 — 조용히 통과하면 등재 안 된 정본이 생긴다', () => {
    expect(() => insertCanonRow('# 목록 없음\n', 'game-combat', '질문')).toThrow(/목록/);
  });
});
