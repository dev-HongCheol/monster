# 설계: per-spell/분류 강화 프레임워크 (Spell Enhancement Framework)

- **작성일:** 2026-06-03
- **세션:** superpowers:brainstorming (설계 합의) → 프로젝트 워크플로우 구현
- **브랜치(예정):** feat/spell-enhancement-framework
- **상태:** AI 검증 완료 → 사용자 인게임 검증 대기 (자동 87/87 GREEN + /cso 0건 + 코드리뷰 2회 CLEAN). DEV 강화 디버그 로그(console.table) 포함.
- **관련 문서:**
  - [마법 시스템 디자인](../../planning/magic-system-mage.md) § 6.1, § 7.1~7.4, § 8 (강화 트랙·옵션·매트릭스)
  - [발사체 수 밸런스 설계 메모](../../planning/magic-system-mage.md#76-발사체-수-밸런스-룰--발사체당-데미지-페널티) § 7.6
  - [마법 패턴 엔진 플랜](2026-06-02-spell-pattern-engine-plan.md) (count-driven 발사 — 발사체수 강화의 소비자)
  - [ADR 002 — scripts/logic 분리 패턴](../../decisions/002-scripts-logic-pattern.md)
  - [ADR 005 — i18n 자체 경량 t()](../../decisions/005-i18n-approach.md)

---

## Problem Statement

기획(§ 6.1)은 강화를 **4종 카드** 중 "선택 마법 강화(개별)"·"분류 강화" 두 트랙으로, 옵션 5종(데미지/쿨다운/발사체수/범위/지속시간)을 옵션별 0~4레벨로 관리하고, 같은 stat은 곱셈 합산(§ 7.3)·비선형 가속(§ 7.4)으로 쌓도록 설계했다.

그러나 현재 코드는 walking-skeleton 단순화 상태다:

- `DeckLogic`이 **전역** `damageMult`/`cooldownMult`/`maxHpBonus`만 가진다 — 모든 마법에 일괄 곱.
- `cards.json`의 `damage_boost`(전역 +20%)/`cooldown_reduce`(전역 -20%)도 전역 카드.
- `SpellCaster.update`가 `DeckManager.damageMult`/`cooldownMult`를 모든 마법에 똑같이 적용.

즉 "파이어볼만 강화" / "화염 분류 전체 강화" 같은 기획의 핵심 빌드 다양성이 불가능하다. 이 슬라이스는 전역 배율을 **per-spell(개별)·분류 두 트랙**으로 교체하는 토대를 깐다.

## What Makes This the Keystone

마법 16종이나 옵션 5종을 다 만드는 게 아니라, **"강화가 마법별/분류별로 갈라져 곱셈으로 쌓이는 프레임워크"** 한 장을 깐다. 이후 발사체수(§ 7.6 페널티)·범위·지속시간은 이 위에 옵션을 얹고, 티어 2~4 마법은 매트릭스(§ 8) 항목만 추가하면 된다.

## Constraints

- ADR 002: 결정 로직은 순수 `logic/`(vitest), cc 의존은 `systems/`·`components/`.
- ADR 005: `logic/`은 표시 문자열 없이 키/params만 산출, 결합 해석은 UI.
- TDD: ready-impl RED 게이트 — 피처 테스트가 먼저 실패해야 구현 전환.
- 피처 테스트 파일명 = 피처명 PascalCase → `tests/logic/SpellEnhancementFramework.test.ts`.
- Safety Rule: 5+ 파일 동시 수정 → 사전 계획 공유(본 문서).

## Premises (사용자 결정 완료)

1. **적용 stat 범위 = 데미지 + 쿨다운만 (D1).** 범위·지속시간은 splash/AOE/DOT 효과 레이어가 미구현이라 곱할 대상이 없다 → `UpgradeOption` enum·매트릭스에만 존재(no-op). 발사체수는 후속 `projectile-count-upgrade`(§ 7.6 발사체당 데미지 페널티 포함)로 분리.
2. **카드 풀 범위 = 구조 + 레벨4 제외만 (D2).** 개별/분류 강화 카드 동적 생성 + 레벨4 도달 옵션 제외(§ 6.2). 추첨은 기존처럼 균등 무작위 — 카드 종류별 가중치·웨이브 등급 게이팅 수치는 § 10 Open Items(밸런싱 단계)로 미룬다.
3. **3-tier 강화 위계 = 개별 > 분류 > 전역 (D3, 2026-06-03 사용자 정정).** 기획 § 7.3 합산식 `× (1+개별) × (1+분류) × (1+플레이어)`대로 **전역(플레이어) 데미지/쿨다운은 존재한다.** 다만 위계상 가장 작아 수치를 대폭 낮춘다(기존 ±20% → placeholder ±5%, 최종 밸런싱은 § 10). `damage_boost`/`cooldown_reduce` 카드 유지. 적용 범위가 좁을수록 레벨당 값이 크다(개별 마법 1종 > 분류 전체 > 모든 마법). HP(hp_up)는 비전투 플레이어 패시브로 별도.

## Approaches Considered

### Approach A: 순수 `EnhancementLogic` + DeckManager 통합 소유 (선택)
per-spell/분류 레벨·곡선·매트릭스·카드 생성을 순수 `logic/EnhancementLogic`에 두고, **기존 `DeckManager`가 이를 소유**(별도 씬 노드 없음).
- Pros: vitest로 RED→GREEN 검증(ADR 002/TDD). 신규 `@property`·씬 노드 0건 → 에디터 QA 부담 없음. DeckLogic(플레이어 패시브)·EnhancementLogic(per-spell/분류) 책임 분리.
- Cons: `DeckManager`가 두 로직을 소유(applyCard 라우팅 분기 1곳).
- Reuses: `DeckLogic.buildDrawPool`/`drawCards`(풀에 합성 카드 concat), `CardSelectPanel`(중첩키 해석), `DataManager.getSpell`, i18n 카탈로그 패턴.

### Approach B: 독립 `EnhancementManager` 싱글톤
분리도는 높지만 새 씬 노드 + `@property` 배선이 늘어 사용자 에디터 작업(7단계)이 증가. **기각** — 통합으로 충분.

### Approach C: spells.json에 강화 상태 내장
런타임 가변 상태를 데이터 파일에 두는 건 부적절(데이터는 언어 중립·불변 기준값). **기각.**

## Recommended Approach (A) — 상세 설계

### 타입 (`data/GameTypes.ts`)
```ts
export enum UpgradeOption { Damage='damage', Cooldown='cooldown', ProjectileCount='projectile_count', Range='range', Duration='duration' }
export enum UpgradeTrack { Individual='individual', Category='category' }
export interface IUpgradeEffect { track: UpgradeTrack; option: UpgradeOption; target: string; } // 개별=spellId, 분류=category
// ICardEffect: damageMult/cooldownMult 제거, { maxHpBonus?, upgrade?: IUpgradeEffect }
// ICardData.type: ... | 'upgrade'
```

### 순수 로직 (`logic/EnhancementLogic.ts` — 신규)
- 상태: `individual: Map<spellId, Map<option, level>>`, `category: Map<category, Map<option, level>>` (트랙 독립 § 7.2) + `global: Map<option, bonus>`(전역/플레이어, 카드 누적).
- `UPGRADE_CAP = 4`. **트랙별 곡선 분리**(위계 개별>분류): `INDIVIDUAL_CURVE = [1,1.3,1.65,2.05,2.5]`, `CATEGORY_CURVE = [1,1.2,1.4,1.7,2.05]`(§ 7.4 예시). 전역은 카드당 +0.05 placeholder. **모두 § 10 밸런싱 TBD.**
- `factor(spell, option) = INDIVIDUAL_CURVE(개별) × CATEGORY_CURVE(분류) × (1 + 전역보너스)` (§ 7.3 3-tier 곱셈).
- `damageFactor`/`cooldownFactor` 편의 접근. **데미지는 곱, 쿨다운은 나눗셈**(`cooldown / factor` → 간격 단축).
- `raise(track, key, option)`: cap 도달 시 false. `addGlobal(option, bonus)`: 전역 보너스 누적.
- `buildUpgradeCards(ownedSpells)`: 보유 마법 × 허용옵션 개별 카드 + 비-보조 분류 × 허용옵션 분류 카드. **maxed 제외(§ 6.2)·보조 분류 제외(§ 7.5).** 키/params만 산출(ADR 005).

### 매니저 (`systems/DeckManager.ts` — 수정)
- `EnhancementLogic` 소유. `applyCard`: `type==='upgrade'` → `raise()`(개별/분류), 전역 `damageMult`/`cooldownMult` → `addGlobal()`, 그 외(HP) → `DeckLogic`.
- `drawCards`: base+magic 풀(DeckLogic) + upgrade 카드(EnhancementLogic) concat 후 균등 추첨. 전역 카드는 cards.json 정적 base.
- `damageFactor(spell)`/`cooldownFactor(spell)` 노출(EnhancementLogic 위임 — 3-tier 포함).

### 실행부 (`components/SpellCaster.ts` — 수정)
전역 `damageMult`/`cooldownMult` → per-spell `damageFactor`/`cooldownFactor`. 쿨다운은 `max(spell.cooldown / cooldownFactor, MIN_COOLDOWN_SEC=0.05)` 하한 클램프.

### UI (`ui/CardSelectPanel.ts` — 수정)
`_resolveDesc`의 중첩키 선해석을 `category`뿐 아니라 `spell`/`option`까지 일반화(`NESTED_KEY_PARAMS`). `t()`는 1단계 치환만 하므로 카탈로그 키 파라미터는 UI가 사전 해석(ADR 005).

### 강화 디버그 로그 (DEV 전용 — 2026-06-03 사용자 요청 추가)
수동 검증 시 강화 수치를 눈으로 확인할 수 없어, 카드 픽 직후 보유 마법별 레벨·배율·최종 DMG/CD·DPS를 `console.table`로 출력. `cc/env`의 `DEV`(= DEBUG/EDITOR/PREVIEW)로 게이팅 → 에디터·프리뷰에서만 찍고 릴리스 빌드에선 제거. 수치 계산은 순수 `EnhancementLogic.debugSnapshot(spells)`(레벨·배율·최종값·DPS + 전역 보너스)로 분리해 단위 테스트로 고정하고, 표시명 해석·포맷·`console` 출력만 UI가 담당(ADR 002/005 유지). 포맷은 "레벨 컬럼 전개"형(개D/분D/배율D/DMG/기본/개C/분C/배율C/CD/DPS).

### 데이터·카탈로그
- `cards.json`: `damage_boost`/`cooldown_reduce` **유지하되 수치↓**(±0.2 → ±0.05 placeholder), `hp_up` 유지.
- `ko.json`/`en.json`: `card.spell_upgrade.*`/`card.category_upgrade.*`/`upgrade.damage`/`upgrade.cooldown` 추가, 전역 카드 라벨 수치 갱신(+5%/-5%). ko에 `desc`(번역 맥락 노트) 동반.

## Success Criteria

- `tests/logic/SpellEnhancementFramework.test.ts` GREEN: raise/cap, factor 곱셈, 트랙·옵션 독립, buildUpgradeCards 생성·maxed/보조 제외, i18n 키/params.
- 전체 vitest 스위트 GREEN(start-verification 게이트).
- 인게임: 개별 강화 → 해당 마법만, 분류 강화 → 분류 전체, 개별×분류×전역 곱셈 합산(위계 개별>분류>전역). 전역 카드 수치↓ 후에도 정상 동작·회귀 없음(수동 QA).

## Impact Map

| 파일 | 변경 | 회귀 확인 |
|------|------|-----------|
| `data/GameTypes.ts` | `UpgradeOption`/`UpgradeTrack`/`IUpgradeEffect`, ICardEffect/ICardData 수정 | 타입 컴파일, ISpellData/ICardData 소비처 |
| `logic/EnhancementLogic.ts` | 신규 순수 로직 | vitest 단독 |
| `logic/DeckLogic.ts` | damage/cooldown 합산 제거 → EnhancementLogic 이관(비전투 패시브만) | `DeckLogic.test.ts` 갱신 |
| `systems/DeckManager.ts` | EnhancementLogic 소유, applyCard 라우팅(개별/분류/전역/HP), factor 노출, drawCards 합성 | 인게임 카드 적용·발사 |
| `components/SpellCaster.ts` | 3-tier 배율 적용(개별×분류×전역) | 단발 발사 회귀 |
| `ui/CardSelectPanel.ts` | 중첩키 해석 일반화 | 카드 라벨 |
| `resources/data/cards.json` | 전역 카드 2종 수치↓(유지) | DataManager 로드 |
| `resources/i18n/{ko,en}.json` | 강화 카드·옵션 키 추가/정리 | 카드 라벨 |
| `tests/logic/SpellEnhancementFramework.test.ts` | 신규 | — |
| `docs/qa/spell-enhancement-framework-test.md` | 신규 QA 문서 | — |

> 코드 6개 + 데이터/카탈로그 + 테스트/QA. 5+ 동시 수정이므로 본 계획 공유로 Safety Rule 충족.

## Open Questions (→ 밸런싱 단계 / 후속 슬라이스)

- `INDIVIDUAL_CURVE`/`CATEGORY_CURVE` 정확한 수치 + 전역 보너스·전역 cap (위계 점근 보장) (§ 7.4·§ 10).
- 카드 종류별 가중치·웨이브 등급 게이팅 (§ 6.2·§ 10).
- 발사체수 옵션 + 발사체당 데미지 페널티 `r` (§ 7.6) → `projectile-count-upgrade`.
- 범위·지속시간 옵션 → splash/AOE/DOT 효과 레이어 도입 후.
- 보조 마법 단일 특수옵션 강화 트랙 (§ 3.5·§ 7.5) → 별도 슬라이스.

## What I noticed

- 전역 → per-spell/분류 전환이 카드 생성·적용·UI를 동시에 건드리는 가로지르는 변경이라, "데미지+쿨다운만 / 구조+레벨4제외만"으로 스코프를 좁힌 게 회귀 면적을 크게 줄였다.
- `EnhancementLogic`을 DeckManager에 통합해 새 씬 노드를 만들지 않은 덕에 사용자 에디터 작업(7단계)이 사실상 0 — 이 슬라이스는 코드만으로 닫힌다.
