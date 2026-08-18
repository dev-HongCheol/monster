/**
 * 아트 정본 셋과 확정 목업의 이동 단언.
 *
 * **슬라이스 이름이 붙었지만 일회용이 아니다.** `wf ready-impl`이 요구하는 RED를 세우는 것이
 * 첫 역할이지만, "셋이 `docs/design/spec/` 아래에 있다"와 "목업은 결정 기록 폴더에 있지
 * 않다"는 누가 되돌리면 그때 다시 빨개져야 하는 명제라 슬라이스가 끝나도 남긴다. 끝난
 * 슬라이스의 잔재로 보고 지우면 그 순간 되돌리기가 무방비가 된다.
 *
 * 여기 두지 않는 것도 정해져 있다. 링크·앵커·정본 인덱스처럼 슬라이스에 묶이지 않는 규칙은
 * `DocLinks.test.ts`와 `CanonDoc.test.ts`가 든다. 이 파일은 **이 이동이 일어났고 유지된다**만
 * 잰다.
 */

import { describe, expect, it } from 'vitest';
import { findTrackedFiles } from '../helpers/DocFs';

/**
 * 옮기는 아트 정본 셋. 왼쪽이 옛 경로, 오른쪽이 `docs/design/spec/` 아래 새 이름이다.
 *
 * 셋째만 이름이 바뀐다. 디자인 정본의 분류 접두사가 `art-`·`ui-` 닫힌 집합이라
 * `asset-production-spec.md`는 그 집합 밖이다 — 기계가 강제하지는 않지만(접두사 검사는
 * `wf canon`으로 새로 만들 때만 돈다) 예외를 하나 두면 폴더를 훑어 무엇이 있는지 보려던
 * 그 표가 장식이 된다.
 */
const MOVES: ReadonlyArray<readonly [string, string]> = [
  ['docs/design/art-direction.md', 'docs/design/spec/art-direction.md'],
  ['docs/design/art-generation-playbook.md', 'docs/design/spec/art-generation-playbook.md'],
  ['docs/design/asset-production-spec.md', 'docs/design/spec/art-asset-spec.md'],
];

/**
 * 함께 옮기는 확정 목업 셋(HTML 둘 + 렌더 이미지 하나).
 *
 * 이 둘은 결정 기록이 아니라 QA 문서 셋이 **지금도** 레이아웃 기준으로 인용하는 청사진인데
 * `docs/decisions/` 아래 앉아 있었다. 사양서가 `spec/`으로 들어가는 순간 「정본은 결정 기록으로
 * 나가는 링크를 걸지 않는다」가 경로만 보고 이 둘도 위반으로 신고하므로, 검사기에 예외를 다는
 * 대신 파일을 제자리로 옮긴다 — 원인은 링크가 아니라 폴더다.
 */
const MOCKUP_MOVES: ReadonlyArray<readonly [string, string]> = [
  ['docs/decisions/hud-layout.html', 'docs/design/mockups/hud-layout.html'],
  ['docs/decisions/hud-layout.html.png', 'docs/design/mockups/hud-layout.html.png'],
  ['docs/decisions/result-stats.html', 'docs/design/mockups/result-stats.html'],
];

/**
 * 존재 판정은 `fs.existsSync`가 아니라 **git 추적 목록**으로 한다. 이유는 `DocFs.ts`의
 * `findTrackedFiles` 주석이 든다 — 세 벌로 복사돼 있던 것을 그 파일 한 곳으로 접었다.
 */
const tracked = findTrackedFiles();

describe('아트 정본 셋이 docs/design/spec/ 아래로 옮겨 갔다', () => {
  it.each(MOVES)('%s → %s', (_from, to) => {
    expect(tracked.has(to)).toBe(true);
  });

  it.each(MOVES)('옛 경로에 스텁을 남기지 않는다: %s', (from) => {
    expect(tracked.has(from)).toBe(false);
  });

  it('옛 이름으로 옮겨 가지도 않았다 — 접두사 집합 밖이라 개명이 이동의 일부다', () => {
    expect(tracked.has('docs/design/spec/asset-production-spec.md')).toBe(false);
  });
});

describe('확정 목업이 docs/design/mockups/ 아래로 옮겨 갔다', () => {
  it.each(MOCKUP_MOVES)('%s → %s', (_from, to) => {
    expect(tracked.has(to)).toBe(true);
  });

  it.each(MOCKUP_MOVES)('결정 기록 폴더에 남기지 않는다: %s', (from) => {
    // 여기서 재는 것은 **옮겨 갔는가**다. 새 목업이 그 폴더로 돌아오는 것을 막는 일반 규칙은
    // `DocLinks.test.ts`가 별도로 든다 — 이 단언만 있으면 셋을 지워 버려도 초록이 된다.
    expect(tracked.has(from)).toBe(false);
  });
});
