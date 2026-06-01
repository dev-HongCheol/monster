import { beforeEach, describe, expect, it } from 'vitest';
import { SpellCategory } from '../../game/assets/scripts/data/GameTypes';
import { FireSchedulerLogic } from '../../game/assets/scripts/logic/FireSchedulerLogic';
import { spellCategoryColor } from '../../game/assets/scripts/logic/SpellVisual';

describe('FireSchedulerLogic', () => {
  let scheduler: FireSchedulerLogic;

  beforeEach(() => {
    scheduler = new FireSchedulerLogic();
  });

  it('신규 마법은 첫 tick 후 즉시 발사 가능하다 (isReady=true)', () => {
    scheduler.tick(0.016, ['fireball']);
    expect(scheduler.isReady('fireball')).toBe(true);
  });

  it('미등록 마법은 isReady=false (안전한 기본값)', () => {
    expect(scheduler.isReady('unknown')).toBe(false);
  });

  it('consume 후에는 쿨다운이 끝날 때까지 isReady=false', () => {
    scheduler.tick(0.016, ['fireball']);
    scheduler.consume('fireball', 0.5);
    expect(scheduler.isReady('fireball')).toBe(false);

    // 0.5초가 지나기 전에는 계속 준비 안 됨
    scheduler.tick(0.3, ['fireball']);
    expect(scheduler.isReady('fireball')).toBe(false);
  });

  it('consume 후 쿨다운만큼 tick이 누적되면 다시 발사 가능하다', () => {
    scheduler.tick(0.016, ['fireball']);
    scheduler.consume('fireball', 0.5);

    scheduler.tick(0.3, ['fireball']);
    scheduler.tick(0.3, ['fireball']); // 누적 0.6 >= 0.5
    expect(scheduler.isReady('fireball')).toBe(true);
  });

  it('여러 마법의 타이머는 서로 독립적이다', () => {
    scheduler.tick(0.016, ['fireball', 'lightning_bolt']);
    scheduler.consume('fireball', 0.5);
    // fireball만 소모, lightning_bolt는 그대로 준비 상태
    expect(scheduler.isReady('fireball')).toBe(false);
    expect(scheduler.isReady('lightning_bolt')).toBe(true);
  });

  it('로드아웃에서 빠진 마법은 타이머가 정리되어 재추가 시 즉시 발사 가능하다', () => {
    scheduler.tick(0.016, ['fireball']);
    scheduler.consume('fireball', 0.5);
    expect(scheduler.isReady('fireball')).toBe(false);

    // 로드아웃에서 제거 (activeIds에서 빠짐) → 타이머 정리
    scheduler.tick(0.016, []);
    // 다시 추가 → 신규 취급, 즉시 발사 가능
    scheduler.tick(0.016, ['fireball']);
    expect(scheduler.isReady('fireball')).toBe(true);
  });

  it('타깃이 없어 consume하지 않으면 쿨다운이 소모되지 않고 적 등장 즉시 발사 가능하다', () => {
    // 신규 마법, 여러 프레임 tick만 하고 consume은 안 함 (타깃 없음 가정)
    scheduler.tick(0.3, ['fireball']);
    scheduler.tick(0.3, ['fireball']);
    // consume 호출이 없었으므로 여전히 발사 준비 상태
    expect(scheduler.isReady('fireball')).toBe(true);
  });
});

describe('spellCategoryColor', () => {
  it('화염/얼음/번개는 서로 다른 색을 반환한다', () => {
    const fire = spellCategoryColor(SpellCategory.Fire);
    const ice = spellCategoryColor(SpellCategory.Ice);
    const lightning = spellCategoryColor(SpellCategory.Lightning);
    expect(fire).not.toEqual(ice);
    expect(ice).not.toEqual(lightning);
    expect(fire).not.toEqual(lightning);
  });

  it('미매핑 분류(support 등)는 흰색 기본값을 반환한다', () => {
    expect(spellCategoryColor(SpellCategory.Support)).toEqual([255, 255, 255]);
    expect(spellCategoryColor('unknown')).toEqual([255, 255, 255]);
  });

  it('모든 RGB 성분은 0~255 범위다', () => {
    for (const c of [SpellCategory.Fire, SpellCategory.Ice, SpellCategory.Lightning]) {
      for (const v of spellCategoryColor(c)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    }
  });
});
