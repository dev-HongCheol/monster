/**
 * 정본 문서를 형태로 검사하는 순수 로직 — 디스크를 읽지 않는다.
 *
 * 두 가지를 본다. 하나는 마크다운 링크·앵커가 실재하는가(`findBrokenLinks`)이고, 다른 하나는
 * 정본이 다른 정본의 문장을 인라인 인용으로 박아 넣었는가(`findInlineCanonQuotes`)다. 둘은 같은
 * 사각지대의 양면이라 한 파일에 둔다 — 링크를 다른 문서로 재지정하면 링크 자체는 멀쩡히 풀리므로
 * 앞엣것이 침묵하는데, 그 링크에 딸린 인용문은 대상에 없는 문장이 되어 조용히 거짓이 된다.
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

/**
 * 정본을 부르는 산문 별칭과 그 별칭이 가리키는 파일.
 *
 * 정본은 서로를 파일명이 아니라 이 이름들로 부른다. 별칭만으로는 독자가 어느 파일인지 추측해야
 * 하고 클릭할 수도 없는데, 그것이 바로 이 검사기가 없애려는 상태다.
 *
 * **짧게 유지한다.** 늘리면 검사 범위가 조용히 넓어져 오탐 위험이 함께 커지므로, 길이를 테스트가
 * 단언해 늘리는 사람이 그 단언을 함께 고치도록 해 뒀다(`CanonQuoteGuard.test.ts`).
 */
export const CANON_ALIASES: ReadonlyMap<string, string> = new Map([
  ['사양서', 'docs/design/spec/art-asset-spec.md'],
  ['playbook', 'docs/design/spec/art-generation-playbook.md'],
  ['art-direction', 'docs/design/spec/art-direction.md'],
  ['판정 규칙', 'docs/development/spec/game-combat.md'],
  ['로드맵', 'docs/planning/roadmap.md'],
]);

/**
 * 「저 문서가 이렇게 적었다」고 주장하는 동사들.
 *
 * **한국어 활용형이라 유한하지 않다** — 목록에 없는 형태는 조용한 미탐지다. 그래도 좁게 두는
 * 이유는, 전환이 끝난 뒤에는 이 목록이 **새로 쓰는 문장에만** 쓰이기 때문이다. 목록이 자라는
 * 것 자체를 "인라인 인용이 다시 늘고 있다"는 신호이므로, 길이를 테스트가 단언해 늘리는 사람이
 * 그 단언을 함께 고치도록 해 뒀다(`CANON_ALIASES`와 같은 이유다).
 */
export const ATTRIBUTION_VERBS: readonly string[] = [
  '적어 뒀',
  '적어 둔',
  '적었',
  '적고 있',
  '못 박',
  '정해 뒀',
  '정해 둔',
  '규정한',
  '규정했',
  '명시한',
  '명시했',
  '요구한',
  '요구했',
  '잡았',
  '걸어 뒀',
  '선을 그었',
  '선을 긋',
];

/** 있는지만 볼 때. */
const ATTRIBUTION_ANY = new RegExp(ATTRIBUTION_VERBS.join('|'));
/** 어디에 있는지까지 볼 때 — 앞쪽 귀속의 거리를 재려면 위치가 필요하다. */
const ATTRIBUTION_ALL = new RegExp(ATTRIBUTION_VERBS.join('|'), 'g');

/**
 * 과거 회상형 귀속 — 인용문이 지금 대상에 **없는 것이 정상**인 형태다.
 *
 * `§5-3이 "…"고 적고 있었으나 그쪽 문구는 고쳤다`가 실물이다. 이런 문장을 블록인용으로 옮기면
 * 폐기된 값이 현재 명세처럼 보이므로, 규칙이 아예 건드리지 않는다.
 */
const RETROSPECTIVE = /적고 있었|적어 뒀었|적혀 있었/;

/** 표의 한 행. 셀 안에서는 `>` 블록인용이 렌더되지 않아 옮길 자리가 없다. */
const TABLE_ROW = /^\s*\|/;

/**
 * 인라인 인용. 낫표(「」)는 이 레포에서 규칙·절 이름 구분자라 보지 않는다.
 *
 * 상한 200자는 보고 품질을 위한 것이다. 이보다 긴 인용은 조용히 빠지고, 인치 표기처럼 홀로 선
 * `"`가 있으면 짝이 어긋나 엉뚱한 구간이 `quote`에 담긴다. 판정이 아니라 무엇을 보여 줄지가
 * 흔들리는 것이라 상한을 두되 여기 적어 둔다.
 */
const INLINE_QUOTE = /"([^"\n]{1,200})"/g;

/**
 * 인용구 **바로 앞**의 귀속을 인정하는 거리(글자 수).
 *
 * 한국어에서 앞쪽 귀속은 관형형으로 인용구를 직접 수식한다 — `§6이 계획으로 적어 둔 "…"은`이
 * 실물이고, 동사와 인용부호 사이가 한 칸이다. 반대로 `§6이 슬롯 분해를 정해 뒀으므로, 우리는 이
 * 단계를 "임시"라고 부른다`처럼 동사가 멀리 떨어져 있으면 그 인용은 그 문서를 인용한 것이 아니다.
 * 거리를 안 재면 뒤엣것까지 물어서 **규칙을 지켜도 통과시킬 방법이 없는 줄**이 생긴다.
 */
const ADNOMINAL_GAP = 4;

/** 형태 위반 한 건. 사람이 바로 찾아갈 수 있게 파일과 줄 번호를 함께 든다. */
export interface InlineCanonQuote {
  file: string;
  line: number;
  /** 인라인으로 박혀 있는 인용문 */
  quote: string;
  /** 그 줄이 지목한 출처 — 산문 별칭이거나 원문 그대로의 링크 대상이다 */
  source: string;
}

/**
 * 링크의 표시 텍스트를 같은 길이의 공백으로 덮는다. **길이를 유지한다** — 뒤에서 별칭과 링크의
 * 등장 위치를 비교하므로 길이가 줄면 순서 판정이 어긋난다.
 *
 * 덮는 이유는 `[판정 규칙](…/game-combat.md)` 때문이다. 표시 텍스트가 마침 산문 별칭과 같은
 * 글자라, 덮지 않으면 별칭이 링크보다 앞에 있는 것으로 잡혀 **링크가 있는데도 별칭을 출처로**
 * 보고하게 된다. 링크가 실제 지목이므로 그쪽이 이겨야 한다.
 */
function blankLinkLabels(line: string): string {
  return line.replace(/\[([^\]\n]*)\]\(/g, (_m, label: string) => `[${' '.repeat(label.length)}](`);
}

/**
 * 그 줄이 지목한 출처 중 **가장 먼저 나오는 것**. 지목이 없으면 `null`.
 *
 * 자기 문서를 가리키는 지목은 세지 않는다. 자기 문서의 절 인용은 독자가 같은 문서 안에서 바로
 * 확인하므로 링크 재지정으로 거짓이 될 일이 없고, 규칙이 건드리지 않기로 한 자리다.
 *
 * @param fromPath 그 줄을 담은 문서의 레포 상대 경로
 * @param line 코드 스팬이 이미 덮인 한 줄
 */
function namedSource(fromPath: string, line: string): string | null {
  let best: { at: number; name: string } | null = null;

  for (const m of line.matchAll(/\]\(\s*<?([^)>\s#]+\.md)/g)) {
    const resolved = resolveTarget(fromPath, m[1]);
    if (!resolved || resolved.path === fromPath) continue;
    const at = m.index ?? 0;
    if (!best || at < best.at) best = { at, name: m[1] };
  }

  const bare = blankLinkLabels(line);
  for (const [alias, target] of CANON_ALIASES) {
    if (target === fromPath) continue;
    const at = bare.indexOf(alias);
    if (at >= 0 && (!best || at < best.at)) best = { at, name: alias };
  }

  return best?.name ?? null;
}

/**
 * 정본이 다른 정본의 문장을 인라인 인용으로 박아 넣은 자리를 찾는다. 0건이면 정합.
 *
 * 「다른 문서를 지목하는 출처 + 인라인 `"…"` + 귀속 동사」 세 조건이 한 줄에서 모두 성립하면
 * 위반이다. **대상 문서를 열지 않는다** — 절 파서도, 문장 분할기도, 내용 비교도 없다.
 *
 * **이 그물이 잡지 않는 것을 밝혀 둔다.** 형태를 잡지 거짓을 잡지 않으므로, 같은 거짓을 블록인용
 * 으로 썼다면 통과시킨다. 그래도 값이 남는 이유는 출처가 **링크로 드러나** 독자가 한 번 눌러
 * 확인할 수 있게 되기 때문이다. 막는 것은 거짓 귀속이 아니라 **귀속을 감추는 표기**다.
 *
 * **판정 단위는 줄이 아니라 인용구다.** 이 레포는 한 줄이 곧 한 문단이라 줄이 600자를 넘기도
 * 하는데, 줄 단위로 재면 회상형 인용 하나가 같은 줄의 살아 있는 위반을 통째로 가린다.
 *
 * | 놓치는 것 | 왜 |
 * |---|---|
 * | 블록인용 안의 거짓 | 대상을 열지 않으니 대조할 방법이 없다 |
 * | 목록에 없는 귀속 동사 활용형 | `ATTRIBUTION_VERBS`의 주석 참고 |
 * | 조사로만 귀속한 형태(`사양서 §3.2의 "…"가`) | 조건에 넣으면 명칭 참조가 함께 걸려 규칙 밖을 문다 |
 * | 표 셀 | `>` 블록인용이 렌더되지 않아 옮길 자리가 없다 |
 * | 200자를 넘는 인용 | `INLINE_QUOTE`의 주석 참고 |
 *
 * | 잘못 물 수 있는 것 | 왜 |
 * |---|---|
 * | 출처·인용·동사가 우연히 한 문장에 모인 줄 | 절을 가르지 않으므로, 인용이 그 출처의 것이 아니어도 `ADNOMINAL_GAP` 안에 동사가 있으면 문다 |
 *
 * @param docs 읽어 온 마크다운 문서. 정본 범위로 좁혀 넘기는 것은 부르는 쪽의 일이다
 */
export function findInlineCanonQuotes(docs: readonly DocFile[]): InlineCanonQuote[] {
  const hits: InlineCanonQuote[] = [];
  for (const doc of docs) {
    const lines = blankFences(normalizeEol(doc.content)).split('\n');
    lines.forEach((raw, i) => {
      // 표 판정만 원문 줄을 본다. `blankInlineCode`는 백틱 **안쪽**만 덮으므로 첫 글자는 절대
      // 바뀌지 않아 두 판정이 같지만, 읽는 사람이 매번 그 추론을 다시 하지 않도록 적어 둔다.
      if (TABLE_ROW.test(raw)) return;
      const line = blankInlineCode(raw);
      const quotes = [...line.matchAll(INLINE_QUOTE)];
      quotes.forEach((m, q) => {
        const start = m.index ?? 0;
        const prev = quotes[q - 1];
        const next = quotes[q + 1];
        // 이웃 인용구까지를 이 인용구의 문맥으로 본다. 더 좁히려면 절을 갈라야 하는데, 한국어
        // 절 분할은 계획 §2가 오탐 때문에 기각한 바로 그 종류의 추측이다.
        const before = line.slice(prev ? (prev.index ?? 0) + prev[0].length : 0, start);
        const after = line.slice(start + m[0].length, next ? (next.index ?? 0) : line.length);

        if (!liveAttribution(before, after)) return;
        const source = namedSource(doc.path, before) ?? namedSource(doc.path, after);
        if (source === null) return;
        hits.push({ file: doc.path, line: i + 1, quote: m[1], source });
      });
    });
  }
  return hits;
}

/**
 * 이 인용구에 **살아 있는** 귀속이 붙어 있는가 — 회상형이면 붙어 있어도 아니다.
 *
 * 회상 여부를 뒤쪽에서 먼저 보는 이유는 어순이다. 한국어에서 회상은 인용을 받아 `"…"고 적고
 * 있었으나`로 나오지 인용 앞에 서지 않는다. 앞쪽까지 회상으로 보면 **바로 앞 인용구의 회상이
 * 다음 인용구를 가려서**, 한 줄에 회상 하나와 살아 있는 위반 하나가 같이 있을 때 뒤엣것을
 * 놓친다(이 레포는 한 줄이 곧 한 문단이라 그 배치가 실제로 나온다).
 *
 * 귀속 동사도 뒤쪽은 거리를 안 잰다 — `"…"이라고 못 박았다`가 기본 어순이다. 앞쪽은 관형형으로
 * 인용구를 직접 수식할 때만 인정하며, 그 근거는 `ADNOMINAL_GAP`이 든다. 관형형 회상
 * (`적고 있었던 "…"`)은 그 자리에서 다시 걸러 낸다.
 *
 * @param before 인용구 앞의 문맥
 * @param after 인용구 뒤의 문맥
 */
function liveAttribution(before: string, after: string): boolean {
  if (RETROSPECTIVE.test(after)) return false;
  if (ATTRIBUTION_ANY.test(after)) return true;

  const last = [...before.matchAll(ATTRIBUTION_ALL)].pop();
  if (!last) return false;
  const at = last.index ?? 0;
  if (RETROSPECTIVE.test(before.slice(at))) return false;
  return before.length - (at + last[0].length) <= ADNOMINAL_GAP;
}
