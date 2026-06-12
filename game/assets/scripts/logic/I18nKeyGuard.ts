/**
 * i18n 카탈로그↔코드 키 정합 가드 — cc import 없는 순수 로직.
 *
 * `ko.json`/`en.json`이 코드·데이터가 실제 참조하는 키와 어긋나지 않는지 검사한다. 파일을 읽고
 * 소스를 스캔하는 부분은 테스트(가드 design §3.2)가 맡고, 여기서는 **이미 읽힌 입력만 받는** 순수
 * 함수로 4종 이슈를 산출한다 — missing(생키 노출)·orphan(죽은 키)·enOrphan(en 오타)·paramMismatch(치환 누락).
 */

/** 키 정합 이슈 종류 */
export type I18nIssueType = 'missing' | 'orphan' | 'enOrphan' | 'paramMismatch';

/** 정합 위반 한 건 — 종류 + 해당 키 */
export interface I18nKeyIssue {
  type: I18nIssueType;
  key: string;
}

/** 가드 입력 — 카탈로그 + 코드/데이터가 참조하는 키 출처(이미 읽힌 값) */
export interface I18nKeyGuardInput {
  /** ko.json (키 → 객체 `{ message, ... }` 또는 문자열) */
  ko: Record<string, unknown>;
  /** en.json (키 → 문자열 또는 객체) */
  en: Record<string, unknown>;
  /** .ts 소스에서 스캔한 정적 리터럴 키 (번역 함수 호출 인자 + nameKey/descKey 속성의 문자열 리터럴) */
  usedLiterals: string[];
  /** spells.json id — `spell.<id>.name` 패밀리 도메인 */
  spellIds: string[];
  /** cards.json id — `card.<id>.{name,desc}` 패밀리 도메인 */
  cardIds: string[];
  /** SpellCategory 값 — `category.<cat>` 패밀리 도메인 */
  categories: string[];
  /** SLICE_OPTIONS 값 — `upgrade.<opt>` 패밀리 도메인 (range/duration 등 미배선 옵션은 제외돼 갭이 비-이슈) */
  options: string[];
  /** 씬 라벨 키 prefix allowlist (`menu.`/`result.`/`gameover.`) — .ts에 없어 고아 오탐이 되는 것 제외 */
  sceneKeyPrefixes: string[];
}

const TOKEN_RE = /\{(\w+)\}/g;

/** 카탈로그 엔트리에서 message 문자열을 뽑는다 (`I18nLogic`과 동일 규칙: 객체면 `.message`, 문자열이면 그대로). */
function extractMessage(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry;
  if (entry !== null && typeof entry === 'object' && 'message' in entry) {
    const message = (entry as { message: unknown }).message;
    return typeof message === 'string' ? message : undefined;
  }
  return undefined;
}

/** 메시지의 `{token}` 이름 집합을 추출한다 (`I18nLogic`의 치환 토큰 규칙과 동일). */
function extractTokens(message: string): Set<string> {
  const tokens = new Set<string>();
  for (const m of message.matchAll(TOKEN_RE)) tokens.add(m[1]);
  return tokens;
}

/** 코드·데이터가 참조하는 동적 패밀리 키 전체를 도메인(데이터/enum)으로부터 조립한다. */
function buildFamilyKeys(input: I18nKeyGuardInput): Set<string> {
  const keys = new Set<string>();
  for (const id of input.spellIds) keys.add(`spell.${id}.name`);
  for (const id of input.cardIds) {
    keys.add(`card.${id}.name`);
    keys.add(`card.${id}.desc`);
  }
  for (const cat of input.categories) keys.add(`category.${cat}`);
  for (const opt of input.options) keys.add(`upgrade.${opt}`);
  return keys;
}

/**
 * 카탈로그↔코드 키 정합 이슈를 찾는다. 이슈 0건이면 정합(영구 CI 게이트가 GREEN).
 *
 * - **missing**: expected − keys(ko) — 코드·데이터가 쓰는데 ko에 없음(= 플레이어 생키 노출). 최우선.
 * - **orphan**: keys(ko) − expected — ko에 있으나 어디서도 안 씀(죽은 키/오타). 단 sceneKeyPrefixes 제외.
 * - **enOrphan**: keys(en) − keys(ko) — en에만 있는 키(= en 오타, ko 폴백도 못 함).
 * - **paramMismatch**: ko·en 공통 키에서 en이 ko에 없는 `{token}`을 씀(= 치환 누락).
 *
 * expected = usedLiterals ∪ familyKeys(데이터 도메인 조립). 반환 순서는 종류별 → 키 사전순으로 고정.
 * @param input 카탈로그 + 키 출처
 */
export function findCatalogIssues(input: I18nKeyGuardInput): I18nKeyIssue[] {
  const koKeys = new Set(Object.keys(input.ko));
  const enKeys = new Set(Object.keys(input.en));
  const expected = new Set<string>(input.usedLiterals);
  for (const key of buildFamilyKeys(input)) expected.add(key);

  const issues: I18nKeyIssue[] = [];
  const push = (type: I18nIssueType, keys: Iterable<string>): void => {
    for (const key of [...keys].sort()) issues.push({ type, key });
  };

  // missing: 코드·데이터가 기대하는데 ko에 없는 키
  push(
    'missing',
    [...expected].filter((key) => !koKeys.has(key)),
  );

  // orphan: ko에 있으나 기대되지 않는 키 — 씬 라벨 prefix는 제외(코드에 없어도 정상)
  push(
    'orphan',
    [...koKeys].filter(
      (key) =>
        !expected.has(key) && !input.sceneKeyPrefixes.some((prefix) => key.startsWith(prefix)),
    ),
  );

  // enOrphan: en에만 있고 ko에 없는 키
  push(
    'enOrphan',
    [...enKeys].filter((key) => !koKeys.has(key)),
  );

  // paramMismatch: 공통 키에서 en 토큰이 ko 토큰의 부분집합이 아님
  const mismatched: string[] = [];
  for (const key of koKeys) {
    if (!enKeys.has(key)) continue;
    const koMsg = extractMessage(input.ko[key]);
    const enMsg = extractMessage(input.en[key]);
    if (koMsg === undefined || enMsg === undefined) continue;
    const koTokens = extractTokens(koMsg);
    const enHasExtra = [...extractTokens(enMsg)].some((token) => !koTokens.has(token));
    if (enHasExtra) mismatched.push(key);
  }
  push('paramMismatch', mismatched);

  return issues;
}
