/**
 * 문서 검사들이 디스크에서 읽어 오는 부분 — 한 벌만 둔다.
 *
 * 판정 로직(`LinkCheck.ts`)이 디스크를 읽지 않기로 한 만큼, 읽는 쪽도 어딘가 한 곳에 있어야
 * 한다. 접기 전에는 `findTrackedFiles`가 세 벌(`ArtCanonMove`·`CanonSpecMove`와 `DocLinks`의
 * 인라인 판)이었고 `loadDocs()`는 한 파일 안에서 네 번 불려 매번 `git ls-files`와 추적 마크다운
 * 전량을 다시 읽었다. 사본이 갈리면 한쪽만 고쳤을 때 나머지가 낡은 채로 초록불을 유지한다.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DocFile } from './LinkCheck';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 레포 루트의 절대 경로. */
export const ROOT = path.resolve(HERE, '../..');

/**
 * git이 추적하는 파일 경로 전체(구분자는 `/`).
 *
 * 존재 판정을 `fs.existsSync`가 아니라 이 집합에 대한 정확한 문자열 비교로 하는 이유가 둘이다.
 * 첫째로 `existsSync`는 대소문자를 무시하는 Windows에서 `Code-Conventions.md` 오타를 통과시키고
 * GitHub·Linux에서만 깨진다. 둘째로 링크 검사기가 추적 목록으로 존재를 재므로, 디스크만 보고
 * 초록을 내면 `git add`를 빠뜨린 상태가 통과하는데 그 상태에서는 새 경로로 가는 링크가 검사기
 * 에게 전부 깨진 것으로 잡힌다 — 두 판정이 갈리면 어느 쪽도 못 믿는다.
 */
export function findTrackedFiles(): Set<string> {
  const r = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ls-files 실패: ${r.stderr}`);
  return new Set(r.stdout.split('\n').filter(Boolean));
}

/**
 * 추적되는 마크다운을 **전량** 읽는다. 범위를 좁히면 좁힌 만큼이 사각지대가 된다.
 *
 * @param tracked 이미 구한 추적 목록. 같은 테스트 안에서 여러 검사가 도는 동안 `git ls-files`를
 *   반복하지 않으려고 받는다
 */
export function loadDocs(tracked: ReadonlySet<string> = findTrackedFiles()): DocFile[] {
  return [...tracked]
    .filter((p) => p.endsWith('.md'))
    .map((p) => ({ path: p, content: fs.readFileSync(path.join(ROOT, p), 'utf8') }));
}
