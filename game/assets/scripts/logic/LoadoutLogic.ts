/** 로드아웃 슬롯 최대 수 (기획 § 4 — 6슬롯) */
export const MAX_SLOTS = 6;

/**
 * 마법 슬롯(로드아웃) 관리 순수 로직 — cc import 없음.
 *
 * 기획 § 4·§ 6.1 근거:
 * - 최대 6슬롯, 분류 중복 허용(서로 다른 마법이면 같은 분류라도 동시 보유 가능)
 * - 동일 마법(같은 id)은 중복 보유 불가 — 카드 "마법 추가"는 미보유 마법만 등장
 */
export class LoadoutLogic {
  private _spells: string[] = [];

  /** 현재 보유 마법 수 */
  get count(): number {
    return this._spells.length;
  }

  /** 모든 슬롯이 찼는지 */
  get isFull(): boolean {
    return this._spells.length >= MAX_SLOTS;
  }

  /** 보유 마법 id 목록(복사본 — 외부 변형 차단) */
  get spells(): string[] {
    return [...this._spells];
  }

  /** 해당 마법을 보유 중인지 */
  hasSpell(id: string): boolean {
    return this._spells.includes(id);
  }

  /**
   * 마법을 슬롯에 추가한다.
   * @param id 마법 id
   * @returns 추가 성공 여부. 슬롯이 가득 찼거나 이미 보유 중이면 false.
   */
  addSpell(id: string): boolean {
    if (this.isFull || this.hasSpell(id)) return false;
    this._spells.push(id);
    return true;
  }

  /**
   * 마법을 슬롯에서 제거한다.
   * @param id 마법 id
   * @returns 제거 성공 여부. 보유 중이 아니면 false.
   */
  removeSpell(id: string): boolean {
    const idx = this._spells.indexOf(id);
    if (idx === -1) return false;
    this._spells.splice(idx, 1);
    return true;
  }
}
