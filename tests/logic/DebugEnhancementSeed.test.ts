import { describe, expect, it } from 'vitest';
import { UpgradeOption, UpgradeTrack } from '../../game/assets/scripts/data/GameTypes';
import { parseDebugEnhancementSeed } from '../../game/assets/scripts/logic/DebugEnhancementSeed';
import { UPGRADE_CAP } from '../../game/assets/scripts/logic/EnhancementLogic';

describe('parseDebugEnhancementSeed', () => {
  it('null/undefined/빈 객체는 빈 ops를 반환한다', () => {
    expect(parseDebugEnhancementSeed(null)).toEqual({ raises: [], globals: [] });
    expect(parseDebugEnhancementSeed(undefined)).toEqual({ raises: [], globals: [] });
    expect(parseDebugEnhancementSeed({})).toEqual({ raises: [], globals: [] });
  });

  it('개별 트랙 레벨을 raise op으로 정규화한다', () => {
    const ops = parseDebugEnhancementSeed({
      individual: { inferno: { damage: 2, projectile_count: 3 } },
    });
    expect(ops.raises).toContainEqual({
      track: UpgradeTrack.Individual,
      key: 'inferno',
      option: UpgradeOption.Damage,
      level: 2,
    });
    expect(ops.raises).toContainEqual({
      track: UpgradeTrack.Individual,
      key: 'inferno',
      option: UpgradeOption.ProjectileCount,
      level: 3,
    });
  });

  it('분류 트랙도 raise op으로 정규화한다', () => {
    const ops = parseDebugEnhancementSeed({ category: { fire: { cooldown: 1 } } });
    expect(ops.raises).toContainEqual({
      track: UpgradeTrack.Category,
      key: 'fire',
      option: UpgradeOption.Cooldown,
      level: 1,
    });
  });

  it('전역 보너스를 global op으로 정규화한다', () => {
    const ops = parseDebugEnhancementSeed({ global: { damage: 0.1, cooldown: 0.05 } });
    expect(ops.globals).toContainEqual({ option: UpgradeOption.Damage, bonus: 0.1 });
    expect(ops.globals).toContainEqual({ option: UpgradeOption.Cooldown, bonus: 0.05 });
  });

  it('레벨을 0~UPGRADE_CAP 정수로 클램프한다', () => {
    const ops = parseDebugEnhancementSeed({
      individual: { inferno: { damage: 99, range: 2.7, duration: -1 } },
    });
    const damage = ops.raises.find((r) => r.option === UpgradeOption.Damage);
    const range = ops.raises.find((r) => r.option === UpgradeOption.Range);
    expect(damage?.level).toBe(UPGRADE_CAP);
    expect(range?.level).toBe(2); // 2.7 → floor 2
    // duration: -1 → 0 이하라 op 자체가 생기지 않는다
    expect(ops.raises.some((r) => r.option === UpgradeOption.Duration)).toBe(false);
  });

  it('알 수 없는 옵션 문자열은 무시한다', () => {
    const ops = parseDebugEnhancementSeed({
      individual: { inferno: { nonsense: 3, damage: 1 } },
    });
    expect(ops.raises).toHaveLength(1);
    expect(ops.raises[0].option).toBe(UpgradeOption.Damage);
  });

  it('유효하지 않은 전역 보너스(비수치/무한)는 무시한다', () => {
    const ops = parseDebugEnhancementSeed({
      global: { damage: Number.POSITIVE_INFINITY, cooldown: 0.05 },
    });
    expect(ops.globals).toEqual([{ option: UpgradeOption.Cooldown, bonus: 0.05 }]);
  });

  it('전역 보너스 0은 op을 만들지 않는다 (레벨 0과 같은 "시드 안 함" 의미)', () => {
    // 시드 파일은 모든 노브를 0으로 나열한 템플릿이다. 0이 op으로 새면 DeckManager가
    // addGlobal(option, 0)을 호출해 보너스 없이 전역 레벨만 1 올린다 —
    // 결과 화면에 `Lv.1 (+0%)`라는 모순된 값이 찍힌다.
    const ops = parseDebugEnhancementSeed({ global: { damage: 0, cooldown: 0 } });
    expect(ops.globals).toEqual([]);
  });

  it('전역 보너스 0은 걸러도 같은 시드의 유효한 보너스는 남긴다', () => {
    const ops = parseDebugEnhancementSeed({ global: { damage: 0, cooldown: 0.05 } });
    expect(ops.globals).toEqual([{ option: UpgradeOption.Cooldown, bonus: 0.05 }]);
  });
});
