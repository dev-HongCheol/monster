/**
 * 마크다운 링크·앵커 검사의 순수 로직 — 디스크를 읽지 않는다.
 *
 * 파일을 읽어 오는 일은 부르는 쪽(`DocLinks.test.ts`와 `pnpm wf check-links`)이 하고, 여기서는
 * 이미 읽힌 본문과 **git이 추적하는 경로 집합**만 받아 판정한다. 존재를 `fs.existsSync`가 아니라
 * 그 집합에 대한 정확한 문자열 비교로 재는 이유가 이 배치의 핵심이다 — `existsSync`는 대소문자를
 * 무시하는 Windows에서 `Code-Conventions.md` 오타를 통과시키고 GitHub에서만 깨진다.
 *
 * **CLI에 판정을 복사하지 않는다.** `wf check-links`는 이 모듈을 베끼는 대신 vitest를 띄워
 * 같은 테스트를 돌린다. 같은 로직이 두 벌이면 한쪽만 고쳤을 때 나머지가 낡은 채로 초록불을
 * 유지하는데(`insertCanonRow`가 실제로 그 상태다), 그 함정을 하나 더 파지 않으려는 것이다.
 */

import path from 'node:path';

/** 검사 대상 문서 하나 — 레포 루트 기준 상대 경로(구분자는 `/`)와 본문. */
export interface DocFile {
  path: string;
  content: string;
}

/** 본문에서 뽑아낸 링크 하나. `target`은 원문 그대로라 앵커가 붙어 있을 수 있다. */
export interface MarkdownLink {
  /** 1부터 세는 줄 번호 */
  line: number;
  target: string;
}

/** 깨진 이유 — 가리키는 파일이 없거나(`missing-file`), 파일은 있는데 그 앵커가 없다(`missing-anchor`). */
export type BrokenReason = 'missing-file' | 'missing-anchor';

/** 깨진 링크 한 건. 사람이 바로 찾아갈 수 있게 파일과 줄 번호를 함께 든다. */
export interface BrokenLink {
  file: string;
  line: number;
  target: string;
  reason: BrokenReason;
}

/** 코드 펜스를 여닫는 줄 — 백틱이나 물결 셋 이상으로 시작한다. */
const FENCE = /^\s*(?:```|~~~)/;

/**
 * 줄 끝을 LF로 맞춘다. **이 레포는 CRLF와 LF를 섞어 쓴다** — `art-generation-playbook.md`는
 * CRLF이고 `conventions.md`는 LF다.
 *
 * 맞추지 않으면 제목 정규식의 `$`가 줄 끝의 `\r` 앞에서 안 맞아 CRLF 문서의 앵커가 **하나도**
 * 수집되지 않고, 그 문서 안의 멀쩡한 앵커 링크가 전부 깨진 것으로 신고된다. 실제로 그 문서
 * 하나에서 열한 건이 그렇게 잡혔다.
 */
function normalizeEol(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/** 마크다운 인라인 링크. 이미지(`!`)도 받는다 — 가리키는 파일이 없으면 렌더가 깨지는 것은 같다. */
const INLINE_LINK = /!?\[[^\]\n]*\]\(\s*<?([^)>\s]+)>?(?:\s+"[^"]*")?\s*\)/g;

/** 슬러그에서 살아남는 문자 — 유니코드 글자·숫자와 밑줄·하이픈·공백뿐이다. */
const SLUG_KEEP = /[^\p{L}\p{N}_\-\s]/gu;

/**
 * 제목 텍스트에서 벗겨 내는 인라인 표기 — 굵게·취소선의 기호들.
 *
 * **밑줄(`_`)은 넣지 않는다.** 기울임으로도 쓰이지만 GitHub는 슬러그에 밑줄을 그대로 남기고,
 * 이 레포 제목에는 `_move`·`SYMLINK_NOT_ALLOWED`처럼 식별자로 들어간 것이 서른 넘게 있다.
 * 지우면 그 제목의 슬러그가 GitHub와 갈려 멀쩡한 앵커가 깨진 것으로 신고된다.
 */
const EMPHASIS = /[*~]{1,3}/g;

/**
 * 코드 펜스 안쪽을 빈 줄로 만든다. **줄 수는 보존한다** — 줄 번호가 밀리면 보고가 쓸모없어진다.
 *
 * @param markdown 원문
 * @returns 펜스 안이 비워진 같은 줄 수의 본문
 */
function blankFences(markdown: string): string {
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (FENCE.test(line)) {
        inFence = !inFence;
        return '';
      }
      return inFence ? '' : line;
    })
    .join('\n');
}

/**
 * 인라인 코드 스팬(`` `…` ``) 안을 같은 길이의 공백으로 덮는다.
 *
 * 백틱 런의 길이가 같은 것끼리 짝지어 닫는다(CommonMark 규칙). 길이를 유지하는 이유는 링크
 * 정규식이 뒤에서 인덱스로 줄 번호를 세기 때문이다 — 길이가 줄면 그 줄부터 전부 어긋난다.
 *
 * 여기서 덮는 것이 검사기의 오탐을 통째로 막는다. 이 레포에는 링크 문법을 **설명하려고**
 * 본문에 적어 둔 코드 스팬이 여덟 군데 있는데(`spec/ops-gbrain.md` §5.5가 그중 하나다), 덮지 않으면
 * 전부 깨진 링크로 잡힌다. 예외 목록으로 막으면 그 목록이 계속 자란다.
 */
function blankInlineCode(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const runs = [...line.matchAll(/`+/g)];
      // `split('')`이지 `[...line]`이 아니다. 스프레드는 코드포인트로 쪼개는데 정규식이 주는
      // `index`는 UTF-16 단위라, 줄 앞쪽 이모지 하나마다 두 좌표계가 한 칸씩 어긋난다. 그러면
      // 덮는 구간이 왼쪽으로 밀려 코드 스팬 바로 뒤의 `](`까지 지우고 링크가 통째로 사라진다.
      // 서로게이트를 반쪽씩 나눠도 무해하다 — 여기서 하는 일은 공백으로 덮는 것뿐이다.
      const chars = line.split('');
      for (let i = 0; i < runs.length - 1; i++) {
        const open = runs[i];
        const close = runs.find((r, j) => j > i && r[0].length === open[0].length);
        if (!close) continue;
        const from = (open.index ?? 0) + open[0].length;
        const to = close.index ?? 0;
        for (let k = from; k < to; k++) chars[k] = ' ';
        i = runs.indexOf(close);
      }
      return chars.join('');
    })
    .join('\n');
}

/**
 * 본문에서 마크다운 인라인 링크를 순서대로 뽑는다.
 *
 * 코드 펜스와 인라인 코드 스팬 안쪽은 먼저 덮으므로 걸리지 않는다. 외부 주소(`https://` 등)도
 * 일단 뽑는다 — 거르는 것은 `resolveTarget`의 일이다.
 *
 * **받지 않는 형태를 밝혀 둔다.** 아래는 전부 레포에 현재 0건이라 지금은 거짓말을 하지 않지만,
 * 누가 쓰기 시작하면 그 링크는 **조용히** 검사 밖에 있게 된다. 쓰게 되면 정규식을 늘린다.
 *
 * | 형태 | 지금 결과 |
 * |---|---|
 * | 참조 스타일 `[표시][라벨]` | 무시. 정의가 0건인 반면 `[number, number][]` 같은 타입 표기가 열 군데쯤 있어 받으면 오탐만 는다 |
 * | 링크 안의 이미지 `[![배지](img.png)](대상.md)` | 안쪽 `img.png`만 잡고 바깥 대상을 놓친다 |
 * | 중첩 대괄호 `[텍스트 [강조] 더](대상.md)` | 통째로 놓친다 |
 * | 작은따옴표 제목 `[x](대상.md 'title')` | 놓친다(큰따옴표는 받는다) |
 * | 공백 든 각괄호 대상 `[x](<a b.md>)` | 놓친다 |
 * | 대상 안의 괄호 `[x](file_(1).md)` | `file_(1)`로 잘려 **오탐**한다 |
 * | 들여쓰기 코드블록(4칸) | 코드로 보지 않아 그 안의 링크를 잡는다 |
 *
 * @param markdown 문서 본문
 */
export function extractLinks(markdown: string): MarkdownLink[] {
  const scrubbed = blankInlineCode(blankFences(normalizeEol(markdown)));
  const links: MarkdownLink[] = [];
  for (const m of scrubbed.matchAll(INLINE_LINK)) {
    const before = scrubbed.slice(0, m.index ?? 0);
    links.push({ line: before.split('\n').length, target: m[1] });
  }
  return links;
}

/**
 * 제목 텍스트를 GitHub 앵커 슬러그로 바꾼다.
 *
 * 규칙 중 하나가 특히 걸린다 — **구두점을 지우되 그 자리의 공백을 합치지 않는다.**
 * `## 8. 전투 · 마법 시스템`은 가운뎃점이 사라지고 양옆 공백이 남아 `#8-전투--마법-시스템`이
 * 되는데, 공백을 접는 순진한 구현은 이 멀쩡한 링크를 깨진 것으로 신고한다(레포에 실물이 있다).
 *
 * @param heading `#` 기호를 뗀 제목 텍스트
 */
export function slugifyHeading(heading: string): string {
  return heading
    .replace(/`([^`]*)`/g, '$1') // 코드 스팬은 기호만 벗기고 안쪽 글자는 남는다
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크는 표시 텍스트만 남는다
    .replace(EMPHASIS, '')
    .trim()
    .toLowerCase()
    .replace(SLUG_KEEP, '')
    .replace(/\s/g, '-');
}

/**
 * 문서가 제공하는 앵커를 제목 순서대로 모은다.
 *
 * 같은 슬러그가 다시 나오면 `-1`·`-2`를 붙인다(GitHub와 같다). 이 접미사를 빼면
 * `environment-setup.md`의 중복된 `## 설치 확인`을 가리키는 `#설치-확인-1`이 깨진 것으로 잡힌다.
 *
 * 코드 펜스 안의 `#` 줄은 제목이 아니다 — 셸 주석이 앵커로 둔갑하면 없는 앵커를 있다고 하게 된다.
 */
export function collectAnchors(markdown: string): string[] {
  const seen = new Map<string, number>();
  const anchors: string[] = [];
  for (const line of blankFences(normalizeEol(markdown)).split('\n')) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!m) continue;
    const base = slugifyHeading(m[2]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.push(n === 0 ? base : `${base}-${n}`);
  }
  return anchors;
}

/** 검사 대상이 아닌 주소 — 레포 밖이라 존재를 확인할 방법이 없다. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * 링크 대상을 **레포 루트 기준 경로와 앵커**로 푼다. 검사 대상이 아니면 `null`.
 *
 * 상대 경로는 링크를 담은 문서의 위치를 기준으로 푼다. 지금 깨져 있는 링크 여섯이 전부 이
 * 계산을 사람이 틀린 것이다 — `docs/development/sessions/`에서 `../decisions/`를 쓰면
 * `docs/development/decisions/`가 되지 `docs/decisions/`가 되지 않는다.
 *
 * 경로 계산은 `path.posix`만 쓴다. `path.join`을 쓰면 Windows에서 역슬래시가 섞인 결과가
 * 나와 git 추적 목록과 영영 일치하지 않고, 멀쩡한 링크가 전부 깨진 것으로 잡힌다.
 *
 * **원문의 역슬래시와 앞 슬래시는 고쳐 주지 않는다.** 고쳐 주면 GitHub에서 404가 나는 링크를
 * 검사기만 통과시키게 된다 — GitHub는 `spec\code-conventions.md`를 통째로 한 파일명으로 읽고,
 * `/docs/b.md`는 레포 루트가 아니라 사이트 루트로 읽는다. 둘 다 원문 그대로 들고 나가 추적
 * 목록과 안 맞는 것으로 끝낸다.
 *
 * @param fromPath 링크를 담은 문서의 레포 상대 경로
 * @param target 원문 그대로의 링크 대상
 */
export function resolveTarget(
  fromPath: string,
  target: string,
): { path: string; anchor: string } | null {
  if (EXTERNAL.test(target)) return null;

  const hash = target.indexOf('#');
  const rawPath = hash < 0 ? target : target.slice(0, hash);
  const rawAnchor = hash < 0 ? '' : target.slice(hash + 1);
  const anchor = decodePart(rawAnchor).toLowerCase();
  if (rawPath === '') return { path: fromPath, anchor };

  const decoded = decodePart(rawPath);
  if (decoded.startsWith('/')) return { path: decoded, anchor };
  return {
    path: path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), decoded)),
    anchor,
  };
}

/** 퍼센트 인코딩을 되돌린다. 잘못 인코딩된 값은 원문 그대로 쓴다 — 그 자체가 깨진 링크다. */
function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * 문서 전체를 훑어 깨진 링크를 모은다. 0건이면 정합.
 *
 * 앵커는 **본문을 읽은 대상에만** 확인한다. 검사 대상이 `.md`뿐이라 `.html` 목업 같은 곳의
 * 앵커는 알 수 없는데, 모른다는 이유로 깨졌다고 하면 멀쩡한 링크가 빨간불이 된다.
 *
 * @param docs 읽어 온 마크다운 문서 전체
 * @param tracked git이 추적하는 경로 집합(`git ls-files` 결과). 존재 판정의 유일한 근거다
 */
export function findBrokenLinks(
  docs: readonly DocFile[],
  tracked: ReadonlySet<string>,
): BrokenLink[] {
  const bodies = new Map(docs.map((d) => [d.path, d.content]));
  const anchorCache = new Map<string, Set<string>>();
  const anchorsOf = (p: string): Set<string> | null => {
    const body = bodies.get(p);
    if (body === undefined) return null;
    let set = anchorCache.get(p);
    if (!set) {
      set = new Set(collectAnchors(body));
      anchorCache.set(p, set);
    }
    return set;
  };

  // 폴더 링크 판정용. `docs/planning/`처럼 폴더를 가리키는 링크는 GitHub가 목록 페이지로
  // 여는 멀쩡한 링크인데, 추적 목록에는 파일만 있어 그대로 보면 전부 없는 것이 된다.
  const dirs = new Set<string>();
  for (const p of tracked) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }

  const broken: BrokenLink[] = [];
  for (const doc of docs) {
    for (const link of extractLinks(doc.content)) {
      const resolved = resolveTarget(doc.path, link.target);
      if (!resolved) continue;

      const hit = { file: doc.path, line: link.line, target: link.target };
      if (!tracked.has(resolved.path)) {
        // `path.posix.normalize`가 끝의 슬래시를 남기므로 떼고 폴더 집합과 맞춘다.
        if (dirs.has(resolved.path.replace(/\/$/, ''))) continue;
        broken.push({ ...hit, reason: 'missing-file' });
        continue;
      }
      if (resolved.anchor === '') continue;
      const anchors = anchorsOf(resolved.path);
      if (anchors && !anchors.has(resolved.anchor)) {
        broken.push({ ...hit, reason: 'missing-anchor' });
      }
    }
  }
  return broken;
}
