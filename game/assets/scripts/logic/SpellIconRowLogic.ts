import { type ISpellData, SpellCategory } from '../data/GameTypes';
import { spellCategoryColor } from './SpellVisual';

/**
 * HUD 마법 아이콘 행의 한 칸 표시 데이터 (채워진 슬롯). 빈 슬롯은 `null`로 표현한다.
 * 색·라벨만 담고 렌더(Sprite 틴트·Label)는 HUD(HudController) 책임.
 */
export interface SpellIconSlot {
  /** 마법 id */
  id: string;
  /** 분류색 [r,g,b] (0~255) — spellCategoryColor 결과 */
  colorRgb: readonly [number, number, number];
  /** 표시 라벨 = 분류 이니셜 + 티어 (예: "F1") */
  label: string;
}

/**
 * 마법 분류의 표시 이니셜 (fire→F / ice→I / lightning→L / support→S).
 * 미매핑 분류는 첫 글자 대문자로 폴백한다.
 * @param category 마법 분류 문자열
 */
export function categoryInitial(category: string): string {
  switch (category) {
    case SpellCategory.Fire:
      return 'F';
    case SpellCategory.Ice:
      return 'I';
    case SpellCategory.Lightning:
      return 'L';
    case SpellCategory.Support:
      return 'S';
    default:
      return category.charAt(0).toUpperCase();
  }
}

/**
 * 보유 마법 id 목록을 HUD 슬롯 배열로 빌드한다 (순수 — cc import 없음).
 * 티어 오름차순(동률은 입력=획득 순서 보존)으로 앞칸부터 채우고, 남는 칸은 빈 슬롯(null)으로 패딩한다.
 * 데이터에 없는 id(getSpell=null)는 정합성 가드로 생략한다.
 * @param ownedIds 보유 마법 id (로드아웃 순서)
 * @param getSpell id→마법 데이터 조회 (미존재는 null)
 * @param maxSlots 표시할 슬롯 정원 (= LoadoutLogic.MAX_SLOTS)
 * @returns 길이 maxSlots의 슬롯 배열 (채운 칸은 SpellIconSlot, 나머지는 null)
 */
export function buildSpellIconRow(
  ownedIds: string[],
  getSpell: (id: string) => ISpellData | null,
  maxSlots: number,
): (SpellIconSlot | null)[] {
  // 보유 id → 마법 데이터. 데이터에 없는 id는 생략(정합성 가드).
  const spells = ownedIds.map((id) => getSpell(id)).filter((s): s is ISpellData => s !== null);
  // 티어 오름차순 정렬 — 동률은 인덱스로 타이브레이크해 입력(획득) 순서를 보존한다(명시적 안정 정렬).
  const sorted = spells
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.tier - b.s.tier || a.i - b.i)
    .map((e) => e.s);
  // 정원까지 잘라 슬롯 디스크립터로, 나머지는 빈 슬롯(null)으로 패딩.
  const slots: (SpellIconSlot | null)[] = sorted.slice(0, maxSlots).map((s) => ({
    id: s.id,
    colorRgb: spellCategoryColor(s.category),
    label: `${categoryInitial(s.category)}${s.tier}`,
  }));
  while (slots.length < maxSlots) slots.push(null);
  return slots;
}
