/**
 * 정본(canon) 문서 생성기의 순수 로직.
 *
 * `pnpm wf canon <슬러그>`가 이 함수들을 거쳐 문서를 만들고 인덱스에 등재한다. CLI가 아니라
 * 여기 두는 이유는 vitest가 `workflow.mjs`를 import할 수 없어서다 — 그 파일은 모듈 스코프에서
 * 디스패치하고 `process.exit()`을 부른다(`WorkflowSteps.ts`와 같은 사정).
 *
 * **CLI에도 같은 판정이 복사돼 있다.** 한쪽만 고치면 조용히 갈라지므로 양쪽을 함께 고친다.
 */

/**
 * 개발 정본 분류 접두사 — **닫힌 집합**이다.
 * 늘리려면 `docs/development/spec/README.md`를 먼저 고친다. 아무나 새 접두사를 만들면
 * 분류가 아니라 장식이 되어, 폴더를 훑어 무엇이 있는지 보는 목적 자체가 사라진다.
 */
export const DEV_PREFIXES = ['code', 'game', 'docs', 'ops'] as const;

/** 디자인 정본 분류 접두사 — 닫힌 집합. 근거는 `DEV_PREFIXES`와 같다. */
export const DESIGN_PREFIXES = ['art', 'ui'] as const;

export interface CanonSlug {
  /** 분류 접두사 (`code`) */
  prefix: string;
  /** 주제 (`architecture`). 하이픈을 포함할 수 있다 */
  topic: string;
}

/**
 * `<분류>-<주제>` 슬러그를 가른다.
 *
 * 소문자·숫자·하이픈만 받는다. **대문자를 막는 이유**는 대소문자를 무시하는 Windows에서만
 * 통과하는 파일명이 생기기 때문이고, **경로 구분자와 `..`를 막는 이유**는 CLI가 이 값을
 * 그대로 파일 경로로 쓰기 때문이다.
 *
 * @param slug 검사할 슬러그 (확장자 없이)
 * @param allowed 이 폴더에서 허용하는 접두사 집합
 * @throws 규칙에 맞지 않으면 사람이 읽을 메시지와 함께
 */
export function parseCanonSlug(slug: string, allowed: readonly string[]): CanonSlug {
  const m = /^([a-z]+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(slug);
  if (!m) {
    throw new Error(
      `정본 슬러그 형식이 아닙니다: "${slug}"\n` +
        '  <분류>-<주제> 꼴이어야 하고 소문자·숫자·하이픈만 씁니다(확장자는 붙이지 않습니다).',
    );
  }
  const [, prefix, topic] = m;
  if (!allowed.includes(prefix)) {
    throw new Error(
      `허용되지 않은 분류 접두사입니다: "${prefix}"\n` +
        `  이 폴더가 받는 접두사: ${allowed.join(', ')}\n` +
        '  늘리려면 해당 spec/README.md를 먼저 고치세요.',
    );
  }
  return { prefix, topic };
}

/**
 * 정본 문서 본문을 만든다. 머리말 모양은 기존 정본(`writing-style.md`)에 맞춘다.
 *
 * 템플릿에 **결정 기록으로 가는 링크를 넣지 않는다** — 정본이 세션 문서·ADR을 가리키면
 * 링크를 타고 들어간 사람이 폐기된 내용을 현재 명세로 읽는다(「문서 정리 규칙」).
 *
 * @param o.slug 파일 슬러그 (본문에는 안 쓰지만 호출부 실수를 줄이려고 받는다)
 * @param o.title 문서 제목
 * @param o.question 이 문서가 답하는 질문 한 줄
 * @param o.date `YYYY-MM-DD`
 */
export function renderCanonDoc(o: {
  slug: string;
  title: string;
  question: string;
  date: string;
}): string {
  return [
    `# ${o.title}`,
    '',
    `> ${o.question}`,
    '',
    `- **최초 작성:** ${o.date}`,
    '- **상태:** CONFIRMED',
    `- **이력:** ${o.date} — 신설`,
    '',
    '---',
    '',
    '이 문서는 **정본**이다. 내용이 낡으면 새로 만들지 않고 이 문서를 고친다. 이력 절에는',
    '날짜와 무엇이 바뀌었는지만 한 줄 남기고, 그렇게 정한 경위는 그 슬라이스의 세션 문서가 든다.',
    '',
    '## (본문)',
    '',
  ].join('\n');
}

/** 인덱스 표의 헤더 구분선 — 이 줄 다음부터가 데이터 행이다. */
const ROW_START = '| [`';

/**
 * `spec/README.md`의 「목록」 표에 행을 슬러그 사전순으로 끼워 넣는다.
 *
 * **멱등하다** — 같은 슬러그가 이미 있으면 원본을 그대로 돌려준다. CLI가 실패 후 재실행돼도
 * 행이 두 벌 생기지 않는다.
 *
 * @param readme 현재 README 전문
 * @param slug 등재할 슬러그 (확장자 없이)
 * @param question 그 문서가 답하는 질문
 * @throws 「목록」 표를 찾지 못하면. 조용히 통과시키면 등재되지 않은 정본이 생겨,
 *   폴더를 훑어 무엇이 있는지 보려는 목적이 깨진다
 */
export function insertCanonRow(readme: string, slug: string, question: string): string {
  const lines = readme.split('\n');
  const rowIdxs = lines.map((l, i) => (l.startsWith(ROW_START) ? i : -1)).filter((i) => i >= 0);

  const headerIdx = lines.findIndex((l) => /^\|\s*-+\s*\|/.test(l.replace(/\s/g, ' ')));
  if (headerIdx < 0 && rowIdxs.length === 0) {
    throw new Error('README에서 「목록」 표를 찾지 못했습니다 — 표가 있어야 등재할 수 있습니다.');
  }

  if (lines.some((l) => l.startsWith(`${ROW_START}${slug}.md\`]`))) return readme;

  const row = `| [\`${slug}.md\`](${slug}.md) | ${question} |`;
  // 사전순 첫 자리를 찾는다. 없으면 마지막 행 뒤(표가 비었으면 구분선 뒤)에 붙인다.
  const at = rowIdxs.find((i) => lines[i] > row);
  const insertAt = at ?? (rowIdxs.length > 0 ? rowIdxs[rowIdxs.length - 1] + 1 : headerIdx + 1);
  lines.splice(insertAt, 0, row);
  return lines.join('\n');
}
