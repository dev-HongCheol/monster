/**
 * 정본이 **다른 정본의 문장**을 인라인 인용으로 자기 문장 안에 박아 넣는 것을 잡는 검사기의 명세.
 *
 * 왜 형태만 보는지가 이 파일의 전제다. 인용문이 대상 절에 실제로 있는지를 재는 내용 검사는 네
 * 변형을 전부 구현해 실측했고 넷 다 못 쓴다는 결론이 났다(계획 §2). 근본 원인은 **따옴표가 인용에만
 * 쓰이지 않는다**는 것이다 — 정본 24개의 인라인 인용 273개를 훑으면 용도가 진짜 인용·폐기된 값
 * 언급·용어 참조·지어낸 예시 넷인데 넷이 형태상 동일해서, 내용을 보는 어떤 규칙도 이들을 가르지
 * 못한다. 그래서 진짜 인용만 블록인용으로 옮기게 하고, 검사기는 **대상 문서를 열지 않고** 남은
 * 인라인 형태만 판정한다.
 *
 * 여기 있는 것은 이번 슬라이스가 세우는 규칙의 명세뿐이다. 레포 전체에 위반이 0건인지를 재는
 * 회귀망은 슬라이스에 묶이지 않으므로 `DocLinks.test.ts`가 든다.
 */

import { describe, expect, it } from 'vitest';
import { CANON_ALIASES, findInlineCanonQuotes } from '../helpers/LinkCheck';

/** 인용하는 쪽으로 쓸 정본. 실제 위반이 가장 많이 났던 파일이다. */
const SPEC = 'docs/design/spec/art-asset-spec.md';
/** 자기 문서 판정을 재려고 쓰는 두 번째 정본. 스스로를 `playbook`이라 부른다. */
const PLAYBOOK = 'docs/design/spec/art-generation-playbook.md';

/** 문서 하나를 검사기에 통과시킨다. */
function check(content: string, file = SPEC) {
  return findInlineCanonQuotes([{ path: file, content }]);
}

describe('잡아야 하는 것 — 다른 정본의 문장을 인라인으로 인용한 자리', () => {
  it('C1을 형태만으로 잡는다 — 링크로 지목하고 인용하고 귀속한다', () => {
    // F69가 이 링크를 ADR 007에서 `game-combat.md`로 재지정하자 `그 문서가` 뒤의 인용이 대상에
    // 없는 문장이 됐다. 링크는 멀쩡히 풀리므로 `findBrokenLinks`도 통과시킨다 — 그 사각지대를
    // 메우는 것이 이 검사기다.
    const line =
      '[판정 규칙](../../development/spec/game-combat.md)과 어긋나지 않는다. ' +
      '그 문서가 "본체보다 크게 그린 장식은 닿아도 안 맞는다"고 이미 적어 뒀고, 나쁜 방향은 반대쪽이다.';
    expect(check(line)).toEqual([
      {
        file: SPEC,
        line: 1,
        quote: '본체보다 크게 그린 장식은 닿아도 안 맞는다',
        source: '../../development/spec/game-combat.md',
      },
    ]);
  });

  it('링크 없이 산문 별칭으로 귀속해도 잡는다', () => {
    // 지금 위반 대부분이 이 형태다. 귀속이 `art-direction` 같은 산문 별칭이라 독자가 어느 파일인지
    // 추측해야 하고 클릭할 수도 없다 — 이 검사기가 파는 값이 정확히 그 자리다.
    const line =
      'art-direction §5·§8-3이 "각 요괴 원전 도상을 확인하고 추측하지 말 것"을 두 번 못 박았는데, ' +
      '그 원전 근거를 모아 둔 문서가 아직 없다.';
    expect(check(line)).toEqual([
      {
        file: SPEC,
        line: 1,
        quote: '각 요괴 원전 도상을 확인하고 추측하지 말 것',
        source: 'art-direction',
      },
    ]);
  });

  it('파일과 줄 번호를 함께 보고한다', () => {
    // 보고가 파일만 주면 사람이 문서를 처음부터 훑어야 한다. 줄 번호까지 있어야 바로 찾아간다.
    const md = [
      '# 제목',
      '',
      '본문 한 줄.',
      '',
      '사양서 §2.6이 "무기는 손과 분리된 별도 슬롯"이라고 못 박았다.',
    ].join('\n');
    expect(check(md, PLAYBOOK)).toEqual([
      {
        file: PLAYBOOK,
        line: 5,
        quote: '무기는 손과 분리된 별도 슬롯',
        source: '사양서',
      },
    ]);
  });
});

describe('규칙이 건드리지 않는 셋 — 전부 실측으로 확인한 실재 용법이다', () => {
  it('자기 문서의 절을 인용하는 것은 잡지 않는다', () => {
    // 독자가 같은 문서 안에서 바로 확인하므로 링크 재지정으로 거짓이 될 일이 없다. 정본에 11곳 있다.
    const line = '12종을 리깅하면 §8의 "손그림·미감을 최소로" 원칙이 무너진다고 적어 뒀다.';
    expect(check(line)).toEqual([]);
  });

  it('산문 별칭이 자기 문서를 가리키면 잡지 않는다', () => {
    // `art-generation-playbook.md`는 스스로를 `playbook`이라 부른다. 별칭을 문자열로만 보면
    // 자기 인용이 남의 문서 인용으로 둔갑해, 고칠 방법이 없는 위반이 영구히 남는다.
    const line = 'playbook §2.6이 "무기는 손과 분리된 별도 슬롯"이라고 못 박았다.';
    expect(check(line, PLAYBOOK)).toEqual([]);
  });

  it('짧은 명칭·용어 참조는 잡지 않는다 — 문장이 아니라 이름이다', () => {
    // 귀속 동사가 붙지 않는다는 형태 차이로 갈린다. 정본에 3곳 있다.
    const line = '스킨의 한계비용이 낮다(로드맵의 "소환된 추가 영웅"이 같은 토대를 쓴다).';
    expect(check(line)).toEqual([]);
  });

  it('과거형 인용은 잡지 않는다 — 지금 대상에 없는 것이 정상이다', () => {
    // 이 문장은 "그쪽 문구를 고쳤다"까지가 한 덩어리라, 인용문이 대상에 남아 있으면 오히려 틀린
    // 상태다. 블록인용으로 옮기면 폐기된 값이 현재 명세처럼 보인다.
    const line =
      'art-direction §5-3이 잡몹을 "호드에선 20px급으로 작게 보인다"고 적고 있었으나 ' +
      '위 계산과 맞지 않았고, 그쪽 문구는 이 값으로 고쳤다.';
    expect(check(line)).toEqual([]);
  });
});

describe('표기 규칙이 물리적으로 성립하지 않는 자리 — 표 셀', () => {
  it('표 셀 안의 인라인 인용은 잡지 않는다', () => {
    // 마크다운 표 셀에서는 `>` 블록인용이 렌더되지 않는다. 옮길 곳이 없는 자리를 물면 검사기에
    // 맞춰 표를 풀어 헤치게 되고, 그건 문서를 나쁘게 만든다. 예외 목록이 아니라 규칙 자신이 짚는
    // 제약이라 규칙 본문(`docs-writing-style.md`)에도 같은 내용이 적혀 있다.
    const row =
      '| **적 12종** | art-direction §5가 "각 요괴 원전 도상을 확인하고 추측하지 말 것"을 못 박았다 | 도상 시트를 채운 뒤 |';
    expect(check(row)).toEqual([]);
  });
});

describe('전환한 뒤의 형태는 통과한다', () => {
  it('블록인용과 출처 줄로 옮기면 위반이 아니다', () => {
    // 이 슬라이스가 여섯 곳을 옮겨 놓을 착지 형태다. 통과시키지 못하면 규칙이 스스로를 부정한다.
    const md = [
      '이건 새 규칙이 아니라 이미 있는 규칙을 v1 스프라이트에도 적용하는 것이다.',
      '',
      '> 무기는 손과 **분리된 별도 슬롯**이다',
      '> — [`art-asset-spec.md`](art-asset-spec.md) §2.6',
    ].join('\n');
    expect(check(md, PLAYBOOK)).toEqual([]);
  });
});

describe('검사기가 들여다보지 않는 자리', () => {
  it('코드 펜스 안은 보지 않는다', () => {
    // 이 슬라이스의 계획·QA 문서가 위반 형태를 **설명하려고** 펜스 안에 그대로 적어 둔다.
    // 덮지 않으면 규칙을 설명하는 문서가 규칙 위반으로 잡힌다.
    const md = [
      '```',
      'art-direction §1이 "무섭되 유치하지 않게"를 정체성으로 잡았고',
      '```',
      '',
      '위 형태를 쓰지 않는다.',
    ].join('\n');
    expect(check(md)).toEqual([]);
  });

  it('인라인 코드 스팬 안의 따옴표는 보지 않는다', () => {
    const line =
      '쓰면 안 되는 형태는 `사양서 §2.6이 "무기는 손과 분리된 별도 슬롯"이라고 못 박았다`이다.';
    expect(check(line, PLAYBOOK)).toEqual([]);
  });

  it('낫표(「」)는 인용부호로 세지 않는다', () => {
    // 이 레포에서 낫표는 규칙·절 이름을 감싸는 구분자다(제목형 32곳). 인용으로 세면 「정본은
    // 결정 기록을 링크하지 않는다」 같은 규칙 이름이 전부 위반이 된다.
    const line = 'art-direction §5가 「원전 도상 충실」을 못 박았다.';
    expect(check(line)).toEqual([]);
  });
});

describe('그물이 자라는 것을 눈에 보이게 한다', () => {
  it('산문 별칭 집합은 다섯이다', () => {
    // 별칭이 늘면 검사 범위가 조용히 넓어지고, 그만큼 오탐 위험도 함께 는다. 길이를 단언으로
    // 박아 두면 늘리는 사람이 이 줄을 함께 고치게 되어 그 판단이 리뷰에 드러난다.
    expect(CANON_ALIASES.size).toBe(5);
  });

  it('별칭은 전부 실재하는 정본 경로를 가리킨다', () => {
    // 별칭이 가리키는 곳이 없으면 자기 문서 판정이 영영 성립하지 않아, 그 문서의 자기 인용이
    // 남의 문서 인용으로 잡힌다.
    for (const target of CANON_ALIASES.values()) {
      expect(target).toMatch(/^docs\/(?:development|design)\/spec\/|^docs\/planning\//);
      expect(target).toMatch(/\.md$/);
    }
  });
});
