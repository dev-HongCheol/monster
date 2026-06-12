import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SpellCategory } from '../../game/assets/scripts/data/GameTypes';
import { SLICE_OPTIONS } from '../../game/assets/scripts/logic/EnhancementLogic';
import {
  findCatalogIssues,
  type I18nKeyGuardInput,
  type I18nKeyIssue,
} from '../../game/assets/scripts/logic/I18nKeyGuard';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/** repo 루트 기준 상대 경로의 JSON을 읽어 파싱한다. */
function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as T;
}

/** 디렉터리를 재귀 순회하며 `.ts` 파일 경로를 yield한다. */
function* walkTs(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkTs(full);
    else if (entry.name.endsWith('.ts')) yield full;
  }
}

/**
 * `game/assets/scripts/**\/*.ts`에서 정적 리터럴 키를 수집한다(가드 design §3.2).
 * 두 출처: `t('...')` 호출과 `nameKey`/`descKey: '...'` 객체 속성. 동적 패밀리 키(template literal)는
 * 스캔하지 않고 데이터 도메인 규칙으로 별도 커버하므로 여기서 빠져도 정상이다.
 */
function scanUsedLiterals(dir: string): string[] {
  const literals = new Set<string>();
  const T_RE = /t\(['"]([^'"]+)/g;
  const KEY_RE = /(?:name|desc)Key:\s*['"]([^'"]+)/g;
  for (const file of walkTs(dir)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(T_RE)) literals.add(m[1]);
    for (const m of src.matchAll(KEY_RE)) literals.add(m[1]);
  }
  return [...literals];
}

/** 이슈 배열에서 한 타입의 키만 뽑는다. */
function keysOf(issues: I18nKeyIssue[], type: I18nKeyIssue['type']): string[] {
  return issues.filter((i) => i.type === type).map((i) => i.key);
}

/**
 * 정합한(이슈 0건) 기준 입력. 각 테스트는 이 입력을 한 군데만 비틀어 해당 이슈 한 종만 유발한다.
 * - ko는 키당 객체 `{ message }`, en은 순수 문자열 (카탈로그 혼용 규칙).
 * - `menu.play`는 씬 라벨(코드에 없음)이라 sceneKeyPrefixes로 고아 제외 대상.
 */
function cleanInput(): I18nKeyGuardInput {
  return {
    ko: {
      'hud.hp': { message: 'HP: {cur} / {max}' },
      'menu.play': { message: 'PLAY' },
      'spell.fireball.name': { message: '파이어볼' },
      'card.hp_up.name': { message: '생명력 강화' },
      'card.hp_up.desc': { message: '최대 HP +20' },
      'category.fire': { message: '화염' },
      'upgrade.damage': { message: '데미지' },
    },
    en: {
      'hud.hp': 'HP: {cur} / {max}',
      'menu.play': 'PLAY',
      'spell.fireball.name': 'Fireball',
      'card.hp_up.name': 'Vitality',
      'card.hp_up.desc': 'Max HP +20',
      'category.fire': 'Fire',
      'upgrade.damage': 'Damage',
    },
    usedLiterals: ['hud.hp'],
    spellIds: ['fireball'],
    cardIds: ['hp_up'],
    categories: ['fire'],
    options: ['damage'],
    sceneKeyPrefixes: ['menu.'],
  };
}

describe('findCatalogIssues — fixture', () => {
  it('정합한 입력은 이슈 0건', () => {
    expect(findCatalogIssues(cleanInput())).toEqual([]);
  });

  it('missing: 코드가 쓰는 키가 ko에 없으면 그 키만 플래그(최우선)', () => {
    const input = cleanInput();
    input.usedLiterals = ['hud.hp', 'hud.mp']; // hud.mp는 ko에 없음 = 플레이어 생키 노출
    const issues = findCatalogIssues(input);
    expect(keysOf(issues, 'missing')).toEqual(['hud.mp']);
    expect(keysOf(issues, 'orphan')).toEqual([]);
    expect(keysOf(issues, 'enOrphan')).toEqual([]);
    expect(keysOf(issues, 'paramMismatch')).toEqual([]);
  });

  it('orphan: ko에 있으나 어디서도 안 쓰는 키를 플래그', () => {
    const input = cleanInput();
    input.ko = { ...input.ko, 'card.dead.name': { message: '죽은 키' } };
    const issues = findCatalogIssues(input);
    expect(keysOf(issues, 'orphan')).toEqual(['card.dead.name']);
    expect(keysOf(issues, 'missing')).toEqual([]);
  });

  it('orphan 제외: sceneKeyPrefixes로 시작하는 씬 라벨 키는 고아로 보지 않는다', () => {
    const input = cleanInput();
    // result.* 씬 라벨은 .ts에 없지만 prefix allowlist로 고아 오탐을 막는다.
    input.ko = { ...input.ko, 'result.victory': { message: '승리' } };
    input.en = { ...input.en, 'result.victory': 'Victory' };
    input.sceneKeyPrefixes = ['menu.', 'result.'];
    expect(keysOf(findCatalogIssues(input), 'orphan')).toEqual([]);
  });

  it('enOrphan: en에만 있고 ko에 없는 키를 플래그(ko 폴백 불가 = en 오타)', () => {
    const input = cleanInput();
    input.en = { ...input.en, 'extra.en_only': 'Orphan' };
    const issues = findCatalogIssues(input);
    expect(keysOf(issues, 'enOrphan')).toEqual(['extra.en_only']);
    expect(keysOf(issues, 'missing')).toEqual([]);
    expect(keysOf(issues, 'orphan')).toEqual([]);
  });

  it('paramMismatch: en이 ko에 없는 {token}을 쓰면 플래그(치환 누락)', () => {
    const input = cleanInput();
    input.en = { ...input.en, 'hud.hp': 'HP: {cur} / {max} ({extra})' };
    expect(keysOf(findCatalogIssues(input), 'paramMismatch')).toEqual(['hud.hp']);
  });

  it('paramMismatch 없음: en 토큰이 ko의 부분집합이면 정상', () => {
    const input = cleanInput();
    input.en = { ...input.en, 'hud.hp': 'HP: {cur}' }; // ko의 {cur,max} 중 일부만 → 정상
    expect(keysOf(findCatalogIssues(input), 'paramMismatch')).toEqual([]);
  });

  it('upgrade 도메인 갭(range/duration)은 비-이슈: 도메인을 옵션 목록으로 한정', () => {
    const input = cleanInput();
    input.options = ['damage', 'cooldown', 'projectile_count'];
    input.ko = {
      ...input.ko,
      'upgrade.cooldown': { message: '쿨다운' },
      'upgrade.projectile_count': { message: '발사체 수' },
    };
    input.en = {
      ...input.en,
      'upgrade.cooldown': 'Cooldown',
      'upgrade.projectile_count': 'Projectiles',
    };
    const issues = findCatalogIssues(input);
    // upgrade.range / upgrade.duration은 도메인 밖이라 missing(코드 미사용)·orphan(카탈로그 부재) 어디에도 안 잡힌다.
    expect(issues.map((i) => i.key)).not.toContain('upgrade.range');
    expect(issues.map((i) => i.key)).not.toContain('upgrade.duration');
    expect(issues).toEqual([]);
  });
});

describe('findCatalogIssues — 실제 카탈로그 게이트 (영구 CI 게이트)', () => {
  it('ko·en·데이터·소스가 키 정합한다 (회귀 시 RED)', () => {
    const ko = readJson<Record<string, unknown>>('game/assets/resources/i18n/ko.json');
    const en = readJson<Record<string, unknown>>('game/assets/resources/i18n/en.json');
    const spells = readJson<{ id: string }[]>('game/assets/resources/data/spells.json');
    const cards = readJson<{ id: string }[]>('game/assets/resources/data/cards.json');
    const usedLiterals = scanUsedLiterals(path.join(ROOT, 'game/assets/scripts'));

    const issues = findCatalogIssues({
      ko,
      en,
      usedLiterals,
      spellIds: spells.map((s) => s.id),
      cardIds: cards.map((c) => c.id),
      categories: Object.values(SpellCategory),
      options: SLICE_OPTIONS,
      sceneKeyPrefixes: ['menu.', 'result.', 'gameover.'],
    });

    expect(issues).toEqual([]);
  });
});
