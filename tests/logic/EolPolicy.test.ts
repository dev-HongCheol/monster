/**
 * 줄 끝(EOL) 정책이 저장소 안에서 지켜지는지 재는 검사.
 *
 * **작업 트리가 아니라 인덱스를 본다.** `git add --renormalize`는 인덱스만 고치고 작업 트리의
 * 바이트는 그대로 두므로, 재정규화 직후에도 디스크 파일에는 `\r\n`이 남아 있다. 이 검사를
 * `fs.readFileSync`로 쓰면 그 상태에서 영영 실패하고, 증상이 "재정규화가 안 먹었다"처럼 보여
 * 엉뚱한 곳을 파게 된다. 게다가 `core.autocrlf=true`로 설정한 기여자의 작업 트리는 정상적으로
 * CRLF인데, 그 사람의 커밋은 아무 문제가 없다 — 지켜야 할 대상은 **저장소에 들어가는 바이트**다.
 *
 * 어겼을 때 무엇이 잘못되는지는 2026-08-17에 실제로 났다. CRLF로 저장된 문서에서 `정본:` 줄
 * 검사기가 줄 끝의 `\r` 때문에 줄을 못 찾아, 줄이 멀쩡히 있는데 "없다"고 보고했다(`f2f1910`).
 * 게이트가 거짓으로 실패하는 형태라 가장 나쁘다.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../helpers/DocFs';

/**
 * `git ls-files --eol`의 한 줄에서 인덱스 줄 끝과 경로를 뽑는다.
 *
 * 출력은 `i/<eol> w/<eol> attr/<속성> \t <경로>` 꼴이고, **속성 칸에 공백이 들어갈 수 있다**
 * (`attr/text=auto eol=lf`). 그래서 공백으로 쪼개지 않고 탭 뒤를 경로로 읽는다.
 */
function parseEolLine(line: string): { indexEol: string; file: string } | null {
  const tab = line.lastIndexOf('\t');
  if (tab < 0) return null;
  const indexEol = line.slice(0, line.indexOf(' ')).replace('i/', '');
  return { indexEol, file: line.slice(tab + 1) };
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
    const crlf = entries.filter((e) => e.indexEol === 'crlf').map((e) => e.file);
    expect(crlf).toEqual([]);
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
