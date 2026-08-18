/**
 * 결정 기록이 현재 정본으로 가는 경로를 들고 있는가를 형태로 재는 순수 로직 — 디스크를 읽지 않는다.
 *
 * `LinkCheck.ts`와 층이 갈린다. 저쪽은 **정본이 무엇을 가리키면 안 되는가**를 보고, 여기는
 * **결정 기록이 무엇을 가리켜야 하는가**를 본다. 두 검사가 한 규칙의 양면인데(정본 → 결정 기록
 * 링크를 막으면 결정 기록 쪽에서 정본으로 가는 길이 유일한 연결이 된다) 대상 문서 집합이 겹치지
 * 않아 파일을 나눴다.
 *
 * 파일을 읽어 오는 일은 부르는 쪽(`DocsReferences.test.ts`)이 `DocFs.ts`로 한다.
 */

/** 검사 대상 세션 문서 하나. `name`은 경계 판정에 쓰는 파일명이라 경로와 따로 든다. */
export interface SessionDoc {
  /** 레포 루트 기준 상대 경로(구분자는 `/`) */
  path: string;
  /** 확장자를 포함한 파일명 — `YYYY-MM-DD-주제.md` */
  name: string;
  content: string;
}

/**
 * `정본:` 줄이 규약을 못 지키는 형태 넷.
 *
 * `no-link`와 `empty-reason`을 `missing`과 따로 두는 이유는 고치는 법이 다르기 때문이다 —
 * 줄이 없으면 쓰면 되지만, 산문으로만 적힌 줄은 이미 있어서 저자가 다 썼다고 여긴다.
 */
export type CanonLineProblem = 'missing' | 'not-in-frontmatter' | 'no-link' | 'empty-reason';

/** 위반 한 건. 사람이 바로 열 수 있게 파일명을 함께 든다. */
export interface CanonLineViolation {
  file: string;
  problem: CanonLineProblem;
}

/**
 * 이 날짜 이상의 파일명을 가진 세션 문서부터 `정본:` 줄을 강제한다.
 *
 * 규칙을 세운 슬라이스의 날짜다. 소급하지 않기로 했으므로(`docs-references.md` §13) 경계가
 * 필요한데, 세션 파일명이 `YYYY-MM-DD-`로 시작하는 규약을 그대로 쓰면 별도 예외 목록 없이
 * 위반 0건에서 출발할 수 있다.
 */
export const ENFORCED_FROM = '2026-08-18';

/** 머리말과 본문을 가르는 줄 — 앞뒤 공백만 있는 `---`. */
const HORIZONTAL_RULE = /^\s*---\s*$/;

/** 머리말의 `정본:` 줄과 그 값. 값이 비어 있어도 줄로는 잡아야 하므로 `(.*)`다. */
const CANON_LINE = /^-\s*\*\*정본:\*\*\s*(.*)$/;

/** 마크다운 인라인 링크 — 표시 텍스트는 비어 있어도 되고 대상만 있으면 된다. */
const MARKDOWN_LINK = /\[[^\]]*\]\([^)\s]+\)/;

/** 「없음」 뒤에 사유를 잇는 구분자. 줄표·하이픈·콜론 중 무엇을 써도 받는다. */
const NONE_WITH_REASON = /^없음\s*[—\-:]?\s*(.*)$/;

/**
 * 파일명의 날짜가 경계 이상인가.
 *
 * 날짜로 시작하지 않는 파일은 대상에서 뺀다. 세션 폴더의 규약은 `YYYY-MM-DD-주제.md`인데,
 * 규약 밖의 파일까지 여기서 잡으면 「파일명이 규약에 안 맞는다」와 「`정본:` 줄이 없다」가 한
 * 메시지로 섞여 나와 무엇을 고쳐야 하는지 알 수 없게 된다.
 *
 * @param name 확장자를 포함한 파일명
 * @param boundary `YYYY-MM-DD` 형식의 경계일. 이 날짜를 포함해 그 이후가 대상이다
 */
export function isEnforced(name: string, boundary: string): boolean {
  const m = /^(\d{4}-\d{2}-\d{2})-/.exec(name);
  // ISO 날짜는 자릿수가 고정이라 문자열 비교가 곧 시간 비교다.
  return m !== null && m[1] >= boundary;
}

/**
 * 본문 하나를 재서 위반 형태를 돌려준다. 규약을 지키면 `null`이다.
 *
 * 머리말을 첫 `---` 이전으로 잡는 이유는 `정본:` 줄의 값이 위치에 있기 때문이다. 파일 맨 아래에
 * 적어도 내용은 같지만, 의미 검색으로 문서 **안쪽**에 착지한 사람이 못 보므로 그 줄이 막으려던
 * 사고(낡은 값을 현재로 읽는 것)를 그대로 남긴다.
 *
 * @param content 세션 문서 전문
 */
export function checkCanonLine(content: string): CanonLineProblem | null {
  const lines = content.split('\n');
  const ruleAt = lines.findIndex((l) => HORIZONTAL_RULE.test(l));
  // `---`가 없으면 문서 전체가 아직 머리말이다 — 본문을 안 쓴 문서를 위치 위반으로 잡지 않는다.
  const frontmatterEnd = ruleAt === -1 ? lines.length : ruleAt;

  const valueAt = (from: number, to: number): string | null => {
    for (let i = from; i < to; i++) {
      const m = CANON_LINE.exec(lines[i]);
      if (m) return m[1].trim();
    }
    return null;
  };

  const value = valueAt(0, frontmatterEnd);
  if (value === null) {
    return valueAt(frontmatterEnd, lines.length) === null ? 'missing' : 'not-in-frontmatter';
  }

  const none = NONE_WITH_REASON.exec(value);
  if (none) return none[1].trim() === '' ? 'empty-reason' : null;

  return MARKDOWN_LINK.test(value) ? null : 'no-link';
}

/**
 * 경계 이후 세션 문서 전부를 재서 위반만 추린다.
 *
 * @param docs 세션 폴더에서 읽어 온 문서 전량. 경계 판정은 이 함수가 한다
 * @param boundary `YYYY-MM-DD` 형식의 경계일
 */
export function findMissingCanonLines(
  docs: readonly SessionDoc[],
  boundary: string,
): CanonLineViolation[] {
  const out: CanonLineViolation[] = [];
  for (const doc of docs) {
    if (!isEnforced(doc.name, boundary)) continue;
    const problem = checkCanonLine(doc.content);
    if (problem) out.push({ file: doc.name, problem });
  }
  return out;
}

/** 위반 형태별로 무엇이 잘못됐는지. 고치는 법은 아래 `formatViolation`이 함께 붙인다. */
const PROBLEM_TEXT: Record<CanonLineProblem, string> = {
  missing: '머리말에 `정본:` 줄이 없다',
  'not-in-frontmatter': '`정본:` 줄이 첫 `---` 뒤에 있다 — 머리말로 올린다',
  'no-link': '`정본:` 줄에 링크가 없다 — 산문으로만 적으면 갈 경로가 없다',
  'empty-reason': '`정본: 없음`에 사유가 없다',
};

/**
 * 실패 메시지 한 줄. 무엇이 잘못됐는지와 **어떻게 고치는지**를 함께 낸다.
 *
 * 이 게이트는 앞으로 새 세션 문서를 쓸 때마다 걸릴 수 있어서 메시지가 곧 비용이다. 무엇이 없는지만
 * 알려 주면 그때마다 규칙 문서를 찾아 읽게 되므로, 요구 형태와 탈출구를 메시지가 직접 든다.
 */
export function formatViolation(v: CanonLineViolation): string {
  return (
    `${v.file}: ${PROBLEM_TEXT[v.problem]}\n` +
    '    → `- **정본:** [`<파일명>`](<경로>) — <이 슬라이스가 무엇을 바꿨나>`\n' +
    '    → 명세를 안 바꿨으면 `- **정본:** 없음 — <사유>`'
  );
}
