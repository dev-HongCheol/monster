import { SpellCategory } from '../data/GameTypes';

/**
 * 마법 분류별 발사체 틴트 색 (RGB, 0~255) — cc import 없음.
 *
 * 기획 § 1 분류 정체성을 색으로 표현(화염=빨강, 얼음=하늘, 번개=노랑).
 * 마법별 전용 스프라이트가 없는 동안 발사체를 분류로 구분하기 위한 용도.
 * 분류 색은 아트 에셋이 나와도 유지되는 값이다.
 *
 * @param category 마법 분류 (미매핑 값은 흰색 기본값)
 * @returns [r, g, b] 0~255
 */
export function spellCategoryColor(category: string): readonly [number, number, number] {
  switch (category) {
    case SpellCategory.Fire:
      return [255, 90, 50];
    case SpellCategory.Ice:
      return [90, 190, 255];
    case SpellCategory.Lightning:
      return [255, 230, 60];
    default:
      return [255, 255, 255];
  }
}
