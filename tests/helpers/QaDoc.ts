/**
 * QA 슬라이스 문서(`docs/qa/<feature>-test.md`)를 형태로 재는 판정 로직.
 *
 * **문자열 in, 위반 out이다.** 디스크도 `.claude/workflow-state.json`도 안 읽는다. 그래야 같은
 * 판정을 vitest(레포 전체 스윕)와 `wf check-qa`(현재 슬라이스 문서)가 한 벌로 나눠 쓸 수 있다.
 * CLI는 이 파일을 import하지 않고 **vitest를 띄운다** — `.mjs`가 `.ts`를 import하면
 * `tsconfig.tests.json`에 `allowJs`가 없어 TS7016으로 `pass ts`가 막힌다(백로그 F78이 실측으로
 * 접었고, `wf check-links`가 세운 형태를 따른다).
 *
 * 판정 전에 항상 `scrubCode`로 코드 펜스·인라인 스팬을 덮는다. 규칙을 **설명하려고** 적은 예시가
 * 위반으로 잡히는 것을 막기 위해서다(F92).
 */

import { scrubCode } from './LinkCheck';

/** blame 무시 목록 파일의 repo 상대 경로. */
export const BLAME_IGNORE_FILE = '.git-blame-ignore-revs';

/**
 * 줄 끝 정책 도입과 문서 8개 재정규화를 담은 머지 커밋.
 *
 * **브랜치 커밋이 아니라 머지 커밋이다.** 이 레포는 squash merge라 브랜치 SHA는 머지 뒤 조회되지
 * 않는다 — `feat/eol-policy` 리뷰가 그 실수를 잡았다(`docs/qa/eol-policy-review-issues.md` I1).
 */
export const RENORMALIZE_COMMIT = '9ee851997bfd1eee71cf4fa07d779d2bdb857aac';

/**
 * 자동 검증 절의 제목을 찾는 정규식.
 *
 * **접두어로 재고 완전 일치로 재지 않는다.** 실측(2026-08-18, 문서 55개)에서 완전 일치
 * `## N. 자동 테스트로 검증`은 3개만 잡았고, 접두어는 46개를 잡았다. 제목 뒤에 괄호 설명이 붙거나
 * (`## 4. 자동 검증 (사용자가 할 일 아님 — 기록용)`) 번호가 빠진 판이 섞여 있기 때문이다.
 * 새 문자열을 만들어 고정하는 안은 폐기했다 — 어떤 문자열을 골라도 기존 문서 대부분과 안 맞고,
 * 가장 최근 문서부터 검사에서 빠진다.
 */
const AUTO_HEADING = /^## (?:\d+\.\s*)?자동/;

/** `##`로 시작하는 절 제목. 절의 끝을 찾는 데 쓴다. */
const ANY_HEADING = /^## /;

/** 미체크 체크박스 한 줄. 들여쓴 항목도 받는다. */
const UNCHECKED = /^\s*- \[ \]/;

/**
 * 통과 근거로 인정하는 형태.
 *
 * `스킵`은 **사유가 붙어야** 인정한다(`스킵 — <사유>`). 사유 없는 스킵을 받으면 "안 돌렸다"와
 * "돌릴 게 없었다"가 구분되지 않는다. `wf skip-test`가 사유를 필수로 받는 것과 같은 이유다.
 */
const EVIDENCE = /통과 근거|GREEN 통과|스킵\s*[—-]\s*\S/;

/** 미확정 표시. `qa-setup`에서 계획 기준 잠정안에 달고 구현 후 확정으로 바꾼다. */
const PROVISIONAL = /\(잠정|\(가칭/;

/** 자동 검증 절의 줄 범위. `start`는 제목 줄, `end`는 절이 끝나는 줄(exclusive). */
export interface AutoSection {
  start: number;
  end: number;
}

/**
 * 자동 검증 절을 찾는다. 없으면 `null`.
 *
 * 절이 없는 문서를 여기서 위반으로 만들지 않는다 — 레포에 그런 문서가 9개 있고 전부 과거 슬라이스의
 * 시점 기록이라, 소급해 고치는 것은 `spec/docs-references.md` §9(과거 기록 불수정)에 걸린다.
 * **현재 슬라이스 문서에 절이 있는지는 CLI가 따로 강제한다.**
 *
 * @param markdown 문서 본문
 */
export function findAutoSection(markdown: string): AutoSection | null {
  const lines = scrubCode(markdown).split('\n');
  const start = lines.findIndex((l) => AUTO_HEADING.test(l));
  if (start < 0) return null;
  const rest = lines.slice(start + 1).findIndex((l) => ANY_HEADING.test(l));
  return { start, end: rest < 0 ? lines.length : start + 1 + rest };
}

/** 자동 검증 절의 본문 줄. 절이 없으면 빈 배열. */
function autoSectionLines(markdown: string): string[] {
  const sec = findAutoSection(markdown);
  if (!sec) return [];
  return scrubCode(markdown)
    .split('\n')
    .slice(sec.start + 1, sec.end);
}

/**
 * 자동 검증 절 안에 남은 미체크 항목 수.
 *
 * **절 경계를 지키는 것이 핵심이다.** 수동 테스트 체크리스트의 `[ ]`는 사용자가 7단계에 채우는
 * 것이라 비어 있는 게 정상인데, 문서 전체를 세면 그것까지 위반이 된다.
 *
 * @param markdown 문서 본문
 */
export function countUncheckedInAutoSection(markdown: string): number {
  return autoSectionLines(markdown).filter((l) => UNCHECKED.test(l)).length;
}

/**
 * 자동 검증 절에 통과 근거가 적혀 있는가.
 *
 * 절이 없으면 `false`다 — 없는 절에서 근거를 찾았다고 하지 않는다.
 *
 * @param markdown 문서 본문
 */
export function hasEvidenceLine(markdown: string): boolean {
  return autoSectionLines(markdown).some((l) => EVIDENCE.test(l));
}

/**
 * 문서에 남은 미확정 표시를 `<줄번호>: <내용>` 목록으로 돌려준다.
 *
 * 줄 번호는 1부터이고 원본 기준이다 — `scrubCode`가 길이를 보존하므로 그대로 쓴다. 보고에는
 * 덮이지 않은 **원본** 줄을 담는다(덮인 줄을 보여 주면 사람이 무엇을 고쳐야 할지 못 읽는다).
 *
 * @param markdown 문서 본문
 */
export function listProvisionalMarkers(markdown: string): string[] {
  const raw = markdown.split(/\r?\n/);
  return scrubCode(markdown)
    .split('\n')
    .flatMap((line, i) => (PROVISIONAL.test(line) ? [`${i + 1}: ${raw[i].trim()}`] : []));
}

/** 현재 슬라이스 문서 하나에 대한 판정 결과. 빈 배열이면 통과. */
export function checkSliceQaDoc(markdown: string): string[] {
  const problems: string[] = [];
  const prov = listProvisionalMarkers(markdown);
  if (prov.length > 0) {
    problems.push(`미확정(잠정) 표시가 남아 있다:\n    ${prov.join('\n    ')}`);
  }
  if (findAutoSection(markdown) === null) {
    problems.push('자동 검증 절이 없다 — 제목을 `## N. 자동 …`으로 만든다.');
    return problems;
  }
  const unchecked = countUncheckedInAutoSection(markdown);
  if (unchecked > 0) {
    problems.push(`자동 검증 절에 미체크가 ${unchecked}건 남았다 — 돌린 뒤 [x]로 바꾼다.`);
  }
  if (!hasEvidenceLine(markdown)) {
    problems.push(
      '자동 검증 절에 통과 근거가 없다 — 날짜 + 피처 N/N + 전체 M/M을 적는다(자동 검사가 없는 슬라이스는 `스킵 — <사유>`).',
    );
  }
  return problems;
}
