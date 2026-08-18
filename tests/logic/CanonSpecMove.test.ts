/**
 * 정본 이전 슬라이스의 이동 단언.
 *
 * **이름에 슬라이스가 붙었지만 지우지 않는다.** `wf ready-impl`이 요구하는 RED를 만드는 것이
 * 첫 역할이었지만, "옮긴 여섯이 `spec/` 아래에 있다"는 누가 되돌리면 그때 다시 빨개져야 하는
 * 명제라 슬라이스가 끝나도 남는다(`ArtCanonMove.test.ts`가 아트 셋에 대해 하는 일과 같다).
 * 다만 여기 두는 것은 **이 이동이 일어났고 유지된다**까지다 — 링크·앵커·정본 인덱스처럼
 * 슬라이스에 묶이지 않는 규칙은 `DocLinks.test.ts`와 `CanonDoc.test.ts`가 든다.
 *
 * 인계해 둔 단언 하나는 예정대로 회수했다. 「아트 정본 세 행은 아직 파일명으로 남아 있다」는
 * 그 셋이 옮겨 가기 전까지 라우팅 행을 조기에 접는 것을 막는 장치였고, 실제로 옮긴 슬라이스가
 * 행을 접으면서 2026-08-14에 지웠다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findTrackedFiles, ROOT } from '../helpers/DocFs';

/** 옮기는 개발 정본 여섯. 왼쪽이 옛 경로, 오른쪽이 `docs/development/spec/` 아래 새 이름이다. */
const MOVES: ReadonlyArray<readonly [string, string]> = [
  ['docs/development/conventions.md', 'docs/development/spec/code-conventions.md'],
  ['docs/development/i18n-guide.md', 'docs/development/spec/code-i18n.md'],
  ['docs/development/writing-style.md', 'docs/development/spec/docs-writing-style.md'],
  ['docs/development/glossary.md', 'docs/development/spec/docs-glossary.md'],
  ['docs/development/build-and-distribution.md', 'docs/development/spec/ops-build.md'],
  ['docs/development/environment-setup.md', 'docs/development/spec/ops-environment.md'],
];

/** F74가 신설하는 판정 규칙 정본. ADR 006·007이 떠받치던 자리를 대신 든다. */
const GAME_COMBAT = 'docs/development/spec/game-combat.md';

/** 레포에서 내보내는 문서. 스스로 "AI 작업의 참조원이 아니다"라고 적어 둔 낡은 조감도다. */
const REMOVED = 'docs/development/architecture.md';

/**
 * 존재 판정은 `fs.existsSync`가 아니라 **git 추적 목록**으로 한다. 일반적인 이유는 `DocFs.ts`의
 * `findTrackedFiles` 주석이 들고, 이 파일에는 그것 말고 하나가 더 있다 — `architecture.md`는
 * 디스크에서 지우는 것이 아니라 무시되는 `docs/temp/`에 사본을 남기고 추적만 끊는 것이라,
 * 파일 존재로 재면 "제거됐다"를 영영 확인할 수 없다.
 */
const tracked = findTrackedFiles();

describe('개발 정본 여섯이 spec/ 아래로 옮겨 갔다', () => {
  it.each(MOVES)('%s → %s', (_from, to) => {
    expect(tracked.has(to)).toBe(true);
  });

  it.each(MOVES)('옛 경로에 스텁을 남기지 않는다: %s', (from) => {
    expect(tracked.has(from)).toBe(false);
  });

  it('code-i18n.md에 선택 규칙 절이 생겼다', () => {
    // 이 슬라이스가 메우기로 한 내용 구멍이다(D4). 화면 글자를 만들 때 씬의 `LocalizedLabel`과
    // 코드의 `t()` 중 무엇을 고르는지가 문서에 없어서, 그 선택을 잘못해 되돌린 적이 이미 있다.
    const body = fs.readFileSync(path.join(ROOT, 'docs/development/spec/code-i18n.md'), 'utf8');
    expect(body).toContain('LocalizedLabel');
    expect(body).toMatch(/##\s.*(?:선택|고르)/);
  });
});

describe('architecture.md를 레포에서 제거했다', () => {
  it('git이 더 이상 추적하지 않는다', () => {
    expect(tracked.has(REMOVED)).toBe(false);
  });

  it('spec/ 아래로 옮겨 가지도 않았다 — 정본이 아니라서 내보낸 것이다', () => {
    expect(tracked.has('docs/development/spec/code-architecture.md')).toBe(false);
  });

  it('docs/temp/ 사본도 추적되지 않는다', () => {
    // `git mv`로 옮기면 `.gitignore`를 무시하고 추적된 채로 앉는다. 그러면 "레포에서
    // 제거한다"의 정반대가 되므로, 사본이 추적 목록에 없다는 것까지 재야 제거가 확인된다.
    expect(tracked.has('docs/temp/architecture.md')).toBe(false);
  });
});

describe('판정 규칙 정본을 신설했다', () => {
  it(`${GAME_COMBAT}이 있다`, () => {
    expect(tracked.has(GAME_COMBAT)).toBe(true);
  });

  it('현재 결론만 담고 반전 경위는 담지 않는다', () => {
    const body = fs.readFileSync(path.join(ROOT, GAME_COMBAT), 'utf8');
    // 플레이어는 사각형, 적은 원 — ADR 006·007이 지금도 강제하는 결론이다.
    expect(body).toMatch(/AABB|사각형/);
    // 정본은 결정 기록을 링크하지 않는다. 경위가 필요하면 이력 절에 날짜만 남긴다.
    expect(body).not.toMatch(/\]\([^)]*(?:sessions|decisions)\//);
  });
});

describe('CLAUDE.md 라우팅 표를 접었다', () => {
  const claudeMd = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');

  /** 실패 메시지에 CLAUDE.md 전문이 쏟아지지 않게 포함 여부만 비교한다. */
  const mentions = (needle: string): string => `${needle}: ${claudeMd.includes(needle)}`;
  const expectMention = (needle: string, want: boolean): void => {
    expect(mentions(needle)).toBe(`${needle}: ${want}`);
  };

  it('옮긴 여섯을 옛 경로로 부르지 않는다', () => {
    for (const [from] of MOVES) expectMention(from, false);
  });

  it('두 spec/README.md를 가리키는 층 행이 생겼다', () => {
    expectMention('docs/development/spec/README.md', true);
    expectMention('docs/design/spec/README.md', true);
  });
});
