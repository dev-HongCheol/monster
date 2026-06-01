import { beforeEach, describe, expect, it } from 'vitest';
import { LoadoutLogic, MAX_SLOTS } from '../../game/assets/scripts/logic/LoadoutLogic';

describe('LoadoutLogic', () => {
  let loadout: LoadoutLogic;

  beforeEach(() => {
    loadout = new LoadoutLogic();
  });

  it('초기 로드아웃은 비어 있다 (count=0, isFull=false)', () => {
    expect(loadout.count).toBe(0);
    expect(loadout.isFull).toBe(false);
    expect(loadout.spells).toEqual([]);
  });

  it('addSpell은 추가 성공 시 true를 반환하고 보유 상태가 된다', () => {
    expect(loadout.addSpell('fireball')).toBe(true);
    expect(loadout.count).toBe(1);
    expect(loadout.hasSpell('fireball')).toBe(true);
  });

  it('분류가 같은 서로 다른 마법을 동시에 보유할 수 있다', () => {
    expect(loadout.addSpell('fireball')).toBe(true);
    expect(loadout.addSpell('meteor')).toBe(true);
    expect(loadout.count).toBe(2);
    expect(loadout.hasSpell('fireball')).toBe(true);
    expect(loadout.hasSpell('meteor')).toBe(true);
  });

  it('이미 보유한 마법을 다시 추가하면 false, count 불변', () => {
    loadout.addSpell('fireball');
    expect(loadout.addSpell('fireball')).toBe(false);
    expect(loadout.count).toBe(1);
  });

  it('6슬롯이 가득 차면 isFull=true, 7번째 추가는 false', () => {
    for (let i = 0; i < MAX_SLOTS; i++) {
      expect(loadout.addSpell(`spell${i}`)).toBe(true);
    }
    expect(loadout.isFull).toBe(true);
    expect(loadout.addSpell('overflow')).toBe(false);
    expect(loadout.count).toBe(MAX_SLOTS);
    expect(loadout.hasSpell('overflow')).toBe(false);
  });

  it('removeSpell: 보유 중이면 제거 후 true, 미보유면 false', () => {
    loadout.addSpell('fireball');
    expect(loadout.removeSpell('fireball')).toBe(true);
    expect(loadout.hasSpell('fireball')).toBe(false);
    expect(loadout.count).toBe(0);
    expect(loadout.removeSpell('fireball')).toBe(false);
  });

  it('removeSpell으로 빈 슬롯이 생기면 다시 추가할 수 있다', () => {
    for (let i = 0; i < MAX_SLOTS; i++) loadout.addSpell(`spell${i}`);
    loadout.removeSpell('spell0');
    expect(loadout.isFull).toBe(false);
    expect(loadout.addSpell('newspell')).toBe(true);
  });

  it('spells getter는 복사본을 반환하여 외부 변형이 내부에 영향을 주지 않는다', () => {
    loadout.addSpell('fireball');
    const snapshot = loadout.spells;
    snapshot.push('hacked');
    expect(loadout.count).toBe(1);
    expect(loadout.hasSpell('hacked')).toBe(false);
  });
});
