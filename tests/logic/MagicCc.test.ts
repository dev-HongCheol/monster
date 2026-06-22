import { describe, expect, test } from 'vitest';
import {
  type ISpellData,
  SpellCategory,
  SpellPattern,
  UpgradeOption,
  UpgradeTrack,
} from '../../game/assets/scripts/data/GameTypes';
import { EnhancementLogic, UPGRADE_CAP } from '../../game/assets/scripts/logic/EnhancementLogic';
import {
  appliedStrength,
  applyControl,
  ControlStrength,
  dealsContactDamage,
  emptyControl,
  hasActiveControl,
  moveSpeedFactor,
  SLOW_SPEED_FACTOR,
  shouldApplyControl,
  tickControl,
} from '../../game/assets/scripts/logic/StatusEffectLogic';

// magic-S3: CC 다중 타이머 해석기 (기획서 §9.4, 백로그 F14). 강도별(슬로우·정지·빙결)
// 독립 타이머가 동시에 감소하고, 매 순간 살아 있는(남은 > 0) 강도 중 가장 센 것이 적용된다.
// 단일 슬롯(magic-S2) max/max의 결함 — 약하고 긴 소스가 강한 강도의 잔여를 늘리던 것 — 을 고친다.
// 테스트는 튜플 내부 표현이 아니라 공개 함수(appliedStrength·hasActiveControl·틱 타이밍)로 동작을 본다.

describe('applyControl — 강도별 타이머 갱신(독립·양방향 max)', () => {
  test('빈 상태에 적용하면 그 강도가 적용된다', () => {
    const t = applyControl(emptyControl(), ControlStrength.Stun, 0.5);
    expect(appliedStrength(t)).toBe(ControlStrength.Stun);
  });

  test('다른 강도를 적용해도 기존 강도 타이머는 독립으로 유지된다', () => {
    let t = applyControl(emptyControl(), ControlStrength.Slow, 1.0);
    t = applyControl(t, ControlStrength.Freeze, 0.4); // 빙결 0.4 추가(슬로우 불변)
    t = tickControl(t, 0.4); // 빙결 만료, 슬로우는 0.6 남아야 한다
    expect(appliedStrength(t)).toBe(ControlStrength.Slow);
  });

  test('같은 강도 재적중: 더 긴 지속이면 늘어난다', () => {
    let t = applyControl(emptyControl(), ControlStrength.Stun, 0.2);
    t = applyControl(t, ControlStrength.Stun, 0.6);
    t = tickControl(t, 0.5); // 0.6이면 아직 정지(0.1 남음)
    expect(appliedStrength(t)).toBe(ControlStrength.Stun);
  });

  test('같은 강도 재적중: 더 짧은 지속이면 줄지 않는다(양방향 max)', () => {
    let t = applyControl(emptyControl(), ControlStrength.Stun, 0.8);
    t = applyControl(t, ControlStrength.Stun, 0.3);
    t = tickControl(t, 0.5); // 0.8이 유지됐다면 아직 정지(0.3 남음)
    expect(appliedStrength(t)).toBe(ControlStrength.Stun);
  });

  test('durationSec=0 적용은 사실상 무적용(즉시 None)', () => {
    const t = applyControl(emptyControl(), ControlStrength.Stun, 0);
    expect(appliedStrength(t)).toBe(ControlStrength.None);
    expect(hasActiveControl(t)).toBe(false);
  });

  test('입력 상태를 변형하지 않고 새 상태를 반환한다(순수)', () => {
    const a = applyControl(emptyControl(), ControlStrength.Slow, 0.5);
    applyControl(a, ControlStrength.Stun, 1.0); // 결과 버림 — a는 안 바뀌어야 한다
    expect(appliedStrength(a)).toBe(ControlStrength.Slow);
    expect(appliedStrength(tickControl(a, 0.5))).toBe(ControlStrength.None); // a엔 슬로우 0.5만 있었다
  });
});

describe('tickControl — 동시 감소·0 클램프', () => {
  test('살아 있는 모든 타이머를 dt만큼 줄인다(동시)', () => {
    let t = applyControl(emptyControl(), ControlStrength.Stun, 0.5);
    t = applyControl(t, ControlStrength.Slow, 1.0);
    t = tickControl(t, 0.6); // 정지 만료(0.5-0.6), 슬로우 0.4 남음
    expect(appliedStrength(t)).toBe(ControlStrength.Slow);
  });

  test('타이머가 0 이하로 떨어지면 만료된다(음수 없이 클램프)', () => {
    let t = applyControl(emptyControl(), ControlStrength.Stun, 0.1);
    t = tickControl(t, 0.2);
    expect(appliedStrength(t)).toBe(ControlStrength.None);
  });

  test('dt가 모든 타이머보다 커도 전부 만료된다', () => {
    let t = applyControl(emptyControl(), ControlStrength.Stun, 0.5);
    t = applyControl(t, ControlStrength.Slow, 1.0);
    t = tickControl(t, 5);
    expect(hasActiveControl(t)).toBe(false);
  });

  test('빈 상태는 그대로 빈 상태다', () => {
    expect(hasActiveControl(tickControl(emptyControl(), 0.016))).toBe(false);
  });

  test('입력 상태를 변형하지 않는다(순수)', () => {
    const t = applyControl(emptyControl(), ControlStrength.Stun, 0.5);
    tickControl(t, 0.2); // 결과 버림
    expect(appliedStrength(tickControl(t, 0.4))).toBe(ControlStrength.Stun); // t는 여전히 0.5
  });
});

describe('appliedStrength — 살아 있는 강도 중 가장 센 것(> 0만 활성)', () => {
  test('여러 강도가 살아 있으면 가장 센 것을 반환', () => {
    let t = applyControl(emptyControl(), ControlStrength.Slow, 1.0);
    t = applyControl(t, ControlStrength.Stun, 1.0);
    expect(appliedStrength(t)).toBe(ControlStrength.Stun);
  });

  test('전부 만료면 None', () => {
    expect(appliedStrength(emptyControl())).toBe(ControlStrength.None);
  });

  test('정확히 0인 강도는 만료로 읽힌다', () => {
    let t = applyControl(emptyControl(), ControlStrength.Stun, 0.2);
    t = tickControl(t, 0.2); // 정확히 0
    expect(appliedStrength(t)).toBe(ControlStrength.None);
  });

  test('센 강도가 만료되면 다음으로 센 살아 있는 강도로 내려간다', () => {
    let t = applyControl(emptyControl(), ControlStrength.Slow, 1.0);
    t = applyControl(t, ControlStrength.Stun, 0.3);
    expect(appliedStrength(t)).toBe(ControlStrength.Stun);
    t = tickControl(t, 0.3); // 정지 만료
    expect(appliedStrength(t)).toBe(ControlStrength.Slow);
  });
});

describe('hasActiveControl — 활성 여부', () => {
  test('살아 있는 타이머가 하나라도 있으면 참', () => {
    expect(hasActiveControl(applyControl(emptyControl(), ControlStrength.Slow, 0.5))).toBe(true);
  });

  test('빈 상태면 거짓', () => {
    expect(hasActiveControl(emptyControl())).toBe(false);
  });

  test('같은 프레임에 모든 타이머가 만료되면 거짓', () => {
    let t = applyControl(emptyControl(), ControlStrength.Stun, 0.2);
    t = applyControl(t, ControlStrength.Slow, 0.2);
    t = tickControl(t, 0.2);
    expect(hasActiveControl(t)).toBe(false);
  });
});

describe('단일 강도(정지만) — magic-S2 단일 슬롯과 동일한 결과(회귀 안전망)', () => {
  test('정지 적용→이동 정지·접촉 유지→만료 시 해제', () => {
    let t = applyControl(emptyControl(), ControlStrength.Stun, 0.6);
    expect(appliedStrength(t)).toBe(ControlStrength.Stun);
    expect(moveSpeedFactor(appliedStrength(t))).toBe(0); // 정지 = 이동 0
    expect(dealsContactDamage(appliedStrength(t))).toBe(true); // 정지 = 접촉 유지
    t = tickControl(t, 0.6);
    expect(appliedStrength(t)).toBe(ControlStrength.None);
  });
});

describe('moveSpeedFactor — 강도별 이동 속도 배율', () => {
  test('None은 정상 속도(배율 1)', () => {
    expect(moveSpeedFactor(ControlStrength.None)).toBe(1);
  });

  test('Slow는 1 미만으로 감속', () => {
    const f = moveSpeedFactor(ControlStrength.Slow);
    expect(f).toBe(SLOW_SPEED_FACTOR);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
  });

  test('Stun과 Freeze는 완전 정지(배율 0)', () => {
    expect(moveSpeedFactor(ControlStrength.Stun)).toBe(0);
    expect(moveSpeedFactor(ControlStrength.Freeze)).toBe(0);
  });
});

describe('dealsContactDamage — 강도별 접촉 피해 유지 여부', () => {
  test('None·Slow·Stun은 접촉 피해를 유지한다', () => {
    expect(dealsContactDamage(ControlStrength.None)).toBe(true);
    expect(dealsContactDamage(ControlStrength.Slow)).toBe(true);
    expect(dealsContactDamage(ControlStrength.Stun)).toBe(true);
  });

  test('Freeze만 접촉 피해를 차단한다(완전 무력화)', () => {
    expect(dealsContactDamage(ControlStrength.Freeze)).toBe(false);
  });
});

describe('shouldApplyControl — 확률 판정(난수 주입)', () => {
  test('난수가 확률보다 작으면 발동', () => {
    expect(shouldApplyControl(0.1, 0.2)).toBe(true);
  });

  test('난수가 확률보다 크면 미발동', () => {
    expect(shouldApplyControl(0.5, 0.2)).toBe(false);
  });

  test('경계: 난수가 확률과 같으면 미발동', () => {
    expect(shouldApplyControl(0.2, 0.2)).toBe(false);
  });

  test('확률 0이면 항상 미발동', () => {
    expect(shouldApplyControl(0, 0)).toBe(false);
  });
});

// CC(onHitStatus)를 가진 마법 — 지속(Duration) 강화 적격
const makeCcSpell = (id: string, category: SpellCategory): ISpellData => ({
  id,
  category,
  tier: 1,
  damage: 10,
  projectileSpeed: 400,
  projectileRadius: 8,
  cooldown: 0.5,
  projectileCount: 1,
  pattern: SpellPattern.Directional,
  onHitStatus: { kind: 'stun', chance: 0.25, durationSec: 0.6 },
});

// CC가 없는 마법(폭발 반경만 보유) — 범위 적격이나 지속 부적격
const makePlainSpell = (id: string, category: SpellCategory): ISpellData => ({
  id,
  category,
  tier: 1,
  damage: 10,
  projectileSpeed: 400,
  projectileRadius: 8,
  cooldown: 0.5,
  projectileCount: 1,
  pattern: SpellPattern.Directional,
  explosionRadius: 80,
});

describe('EnhancementLogic.buildUpgradeCards — 지속시간(Duration) 강화 게이트 (A3)', () => {
  test('CC(onHitStatus)를 가진 마법은 개별 Duration 카드가 생성된다', () => {
    const e = new EnhancementLogic();
    const bolt = makeCcSpell('lightning_bolt', SpellCategory.Lightning);
    const ids = e.buildUpgradeCards([bolt]).map((c) => c.id);
    expect(ids).toContain('upg_lightning_bolt_duration');
  });

  test('CC가 없는 마법은 Duration 카드가 생성되지 않는다(폭발만 가진 마법도 제외)', () => {
    const e = new EnhancementLogic();
    const fireball = makePlainSpell('fireball', SpellCategory.Fire);
    const ids = e.buildUpgradeCards([fireball]).map((c) => c.id);
    expect(ids.some((id) => id.endsWith('_duration'))).toBe(false);
  });

  test('CC 적격 마법이 있는 분류만 분류 Duration 카드가 생성된다', () => {
    const e = new EnhancementLogic();
    const bolt = makeCcSpell('lightning_bolt', SpellCategory.Lightning);
    const ids = e.buildUpgradeCards([bolt]).map((c) => c.id);
    expect(ids).toContain('cupg_lightning_duration'); // 번개엔 적격 마법(라이트닝 볼트)이 있음
    expect(ids).not.toContain('cupg_fire_duration'); // 화염엔 적격 마법 없음
    expect(ids).not.toContain('cupg_ice_duration');
  });

  test('Duration 레벨 4(maxed)면 그 마법의 Duration 카드는 제외된다', () => {
    const e = new EnhancementLogic();
    const bolt = makeCcSpell('lightning_bolt', SpellCategory.Lightning);
    for (let i = 0; i < UPGRADE_CAP; i++) {
      e.raise(UpgradeTrack.Individual, 'lightning_bolt', UpgradeOption.Duration);
    }
    const ids = e.buildUpgradeCards([bolt]).map((c) => c.id);
    expect(ids).not.toContain('upg_lightning_bolt_duration');
    expect(ids).toContain('upg_lightning_bolt_damage'); // 다른 옵션은 남는다
  });
});
