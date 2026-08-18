/**
 * 줄 끝(EOL) 정책이 저장소 안에서 지켜지는지 재는 검사.
 *
 * **작업 트리가 아니라 인덱스를 본다.** `git add --renormalize`는 인덱스만 고치고 작업 트리의
 * 바이트는 그대로 두므로, 재정규화 직후에도 디스크 파일에는 `\r\n`이 남아 있다. 이 검사를
 * `fs.readFileSync`로 쓰면 그 상태에서 영영 실패하고, 증상이 "재정규화가 안 먹었다"처럼 보여
 * 엉뚱한 곳을 파게 된다. 지켜야 할 대상은 **저장소에 들어가는 바이트**다.
 *
 * (`.gitattributes`의 `eol=lf`는 `core.autocrlf` 설정을 덮으므로, 이 정책이 걸려 있는 한 작업
 * 트리도 어느 장비에서나 LF다. 인덱스를 보는 이유는 기여자 설정 차이가 아니라 위의 재정규화
 * 동작 하나다.)
 *
 * 어겼을 때 무엇이 잘못되는지는 2026-08-18에 실제로 났다. CRLF로 저장된 문서에서 `정본:` 줄
 * 검사기가 줄 끝의 `\r` 때문에 줄을 못 찾아, 줄이 멀쩡히 있는데 "없다"고 보고했다(`3253727` —
 * squash 머지라 봉합 커밋이 따로 남지 않아 머지 커밋을 적는다). 게이트가 거짓으로 실패하는
 * 형태라 가장 나쁘다.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../helpers/DocFs';

/**
 * `git ls-files --eol`의 한 줄에서 인덱스 줄 끝과 경로를 뽑는다.
 *
 * 출력은 `i/<eol> w/<eol> attr/<속성> \t <경로>` 꼴인데 두 칸이 공백을 품는다. 속성 칸은
 * `attr/text=auto eol=lf`처럼 값 안에 공백이 있고, 경로에도 공백이 들어간다(이 레포에는 실제로
 * `Custom Script Template Help Documentation.url`이 있다). 그래서 공백으로 쪼개지 않고, 앞은
 * 정규식으로 첫 칸만 떼고 뒤는 탭 뒤 전부를 경로로 읽는다.
 */
function parseEolLine(line: string): { indexEol: string; file: string } | null {
  const m = /^i\/(\S+)\s.*\t(.+)$/.exec(line);
  return m ? { indexEol: m[1], file: m[2] } : null;
}

/** 추적 파일 전체의 인덱스 줄 끝 목록. */
function listIndexEol(): { indexEol: string; file: string }[] {
  const r = spawnSync('git', ['ls-files', '--eol'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ls-files --eol 실패: ${r.stderr}`);
  return r.stdout
    .split('\n')
    .filter(Boolean)
    .map(parseEolLine)
    .filter((e) => e !== null);
}

describe('줄 끝 정책', () => {
  const entries = listIndexEol();

  it('인덱스에 CRLF로 저장된 파일이 없다', () => {
    // 금지 목록(`crlf`만 센다)이 아니라 허용 목록으로 잡는다. git은 CRLF와 LF가 섞인 블롭에
    // `mixed`를, 바이너리로 판정한 것에 `-text`를 찍는데, 금지 목록으로 두면 `mixed`가 조용히
    // 통과한다. 허용 목록이면 앞으로 git이 새 값을 찍어도 통과가 아니라 실패 쪽으로 기운다.
    const ALLOWED = ['lf', '-text', 'none', ''];
    const bad = entries.filter((e) => !ALLOWED.includes(e.indexEol));
    expect(bad.map((e) => `${e.indexEol} ${e.file}`)).toEqual([]);
  });

  it('`.gitattributes`가 저장소 전체에 LF를 건다', () => {
    // 위 단언만 두면 정책 파일이 지워져도 한동안 초록이 유지된다 — 이미 정규화된 파일은 그대로고
    // 새로 들어오는 파일부터 조용히 어긋나기 때문이다. 정책 파일 자체를 봐야 그 경로가 막힌다.
    const attributes = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8');
    expect(attributes).toContain('* text=auto eol=lf');
  });

  it('검사가 실제로 추적 파일을 봤다', () => {
    // 명령이 빈 목록을 돌려주면 첫 단언이 "위반 0건"으로 초록을 내는데, 그것은 통과가 아니라
    // 검사를 안 한 것이다. `DocsReferences.test.ts`가 같은 이유로 「하나 이상」 단언을 건다.
    expect(entries.length).toBeGreaterThan(100);
  });
});
