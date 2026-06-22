import { describe, expect, test } from 'vitest';
import {
  type ISpellData,
  SpellCategory,
  SpellPattern,
} from '../../game/assets/scripts/data/GameTypes';
import { EnhancementLogic } from '../../game/assets/scripts/logic/EnhancementLogic';
import {
  appliedStrength,
  applyControl,
  ControlStrength,
  emptyControl,
  hasActiveControl,
  tickControl,
} from '../../game/assets/scripts/logic/StatusEffectLogic';

// magic-S3: 슬로우(아이스 미사일) + CC 다중 타이머 모델(F14, 기획서 §9.4).
// 강도별(슬로우·정지·빙결) 독립 타이머가 동시에 감소하고, 매 순간 살아 있는 것 중
// 가장 센 강도가 적용된다. 단일 슬롯(magic-S2) max/max의 결함 — 약하고 긴 소스가
// 강한 강도의 잔여를 늘리던 것 — 을 강도별 타이머로 고친다.

describe('다중 타이머 — 시나리오 1: 정지3·슬로우5·빙결1 동시 적용', () => {
  // t=0에 정지(지속3)·슬로우(지속5)·빙결(지속1)을 한 적에 모두 건 상태.
  const build = () => {
    let t = emptyControl();
    t = applyControl(t, ControlStrength.Stun, 3);
    t = applyControl(t, ControlStrength.Slow, 5);
    t = applyControl(t, ControlStrength.Freeze, 1);
    return t;
  };

  test('t=0: 가장 센 빙결이 적용된다', () => {
    expect(appliedStrength(build())).toBe(ControlStrength.Freeze);
  });

  test('빙결 1초 → 정지 2초 → 슬로우 2초 → 해제로 전환된다', () => {
    let t = build();
    expect(appliedStrength(t)).toBe(ControlStrength.Freeze);
    t = tickControl(t, 1); // 빙결 만료(1-1=0)
    expect(appliedStrength(t)).toBe(ControlStrength.Stun);
    t = tickControl(t, 2); // 정지 만료(3-1-2=0)
    expect(appliedStrength(t)).toBe(ControlStrength.Slow);
    t = tickControl(t, 2); // 슬로우 만료(5-1-2-2=0)
    expect(appliedStrength(t)).toBe(ControlStrength.None);
    expect(hasActiveControl(t)).toBe(false);
  });

  test('약하고 긴 슬로우가 강한 빙결의 잔여를 늘리지 않는다(단일 슬롯 결함 가드)', () => {
    let t = build();
    t = tickControl(t, 1); // t=1: 빙결은 정확히 만료돼야 한다(5초 내내 빙결이 아님)
    expect(appliedStrength(t)).not.toBe(ControlStrength.Freeze);
  });
});

describe('다중 타이머 — 시나리오 2: t=1에 빙결 재적중', () => {
  test('빙결이 1초 재충전되고, 그 밑 정지는 독립으로 흘러 1초만 노출된다', () => {
    let t = emptyControl();
    t = applyControl(t, ControlStrength.Stun, 3);
    t = applyControl(t, ControlStrength.Slow, 5);
    t = applyControl(t, ControlStrength.Freeze, 1);
    t = tickControl(t, 1); // t=1: 빙결 만료, 정지 2 남음
    expect(appliedStrength(t)).toBe(ControlStrength.Stun);
    t = applyControl(t, ControlStrength.Freeze, 1); // 빙결 재충전
    expect(appliedStrength(t)).toBe(ControlStrength.Freeze);
    t = tickControl(t, 1); // t=2: 빙결 만료, 정지 1 남음
    expect(appliedStrength(t)).toBe(ControlStrength.Stun);
    t = tickControl(t, 1); // t=3: 정지 만료, 슬로우만 남음
    expect(appliedStrength(t)).toBe(ControlStrength.Slow);
  });

  test('재적중은 해당 강도 타이머만 재충전하고 다른 강도는 독립으로 흐른다', () => {
    let t = emptyControl();
    t = applyControl(t, ControlStrength.Stun, 3);
    t = applyControl(t, ControlStrength.Slow, 5);
    t = tickControl(t, 1); // 정지 2, 슬로우 4
    t = applyControl(t, ControlStrength.Stun, 3); // 정지만 3으로 재충전(슬로우 불변)
    t = tickControl(t, 3); // 정지 만료(3-3=0), 슬로우 4-3=1
    expect(appliedStrength(t)).toBe(ControlStrength.Slow);
    t = tickControl(t, 1); // 슬로우 만료
    expect(appliedStrength(t)).toBe(ControlStrength.None);
  });
});

// 슬로우 소스 — 아이스 미사일이 onHitStatus(slow)를 가져 지속(Duration) 강화 적격.
// spells.json placeholder 수치에 결합하지 않도록 인테스트 픽스처로 만든다 —
// 적격은 onHitStatus 보유 여부만 본다.
const makeSlowSpell = (id: string, category: SpellCategory): ISpellData => ({
  id,
  category,
  tier: 1,
  damage: 18,
  projectileSpeed: 450,
  projectileRadius: 8,
  cooldown: 0.7,
  projectileCount: 1,
  pattern: SpellPattern.Directional,
  onHitStatus: { kind: 'slow', chance: 0.9, durationSec: 2 },
});

describe('슬로우 소스 — 지속(Duration) 강화 적격', () => {
  test('슬로우(onHitStatus)를 가진 아이스 미사일은 개별·분류 Duration 카드가 생성된다', () => {
    const e = new EnhancementLogic();
    const ice = makeSlowSpell('ice_missile', SpellCategory.Ice);
    const ids = e.buildUpgradeCards([ice]).map((c) => c.id);
    expect(ids).toContain('upg_ice_missile_duration');
    expect(ids).toContain('cupg_ice_duration');
  });
});
