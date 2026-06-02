# 설계: 마법 패턴 엔진 (Spell Pattern Engine)

- **작성일:** 2026-06-02
- **세션:** /office-hours (Builder 모드)
- **브랜치(예정):** feat/spell-pattern-engine
- **상태:** DRAFT (→ /autoplan 리뷰 후 사용자 승인 대기)
- **관련 문서:**
  - [로드맵 v0.2 § 10 — 3주차](../../planning/roadmap.md) (데이터 주도 마법 시스템)
  - [마법 시스템 디자인](../../planning/magic-system-mage.md) (16종 패턴 정의)
  - [ADR 002 — scripts/logic 분리 패턴](../../decisions/002-scripts-logic-pattern.md)
  - [ADR 003 — 테스트 전략](../../decisions/003-testing-strategy.md)

---

## Problem Statement

현재 마법 3종(`fireball`/`ice_missile`/`lightning_bolt`, 모두 티어1)은 **동작이 완전히 동일**하다 — `SpellCaster.update`가 최근접 적을 향해 직선 발사체 1발을 쏜다. 분류 색 틴트만 다르다.

- `ISpellData`에 **`pattern` 개념이 없다.** `SpellCaster._shoot`는 한 가지 동작만 안다.
- `spells.json`의 `projectileCount` 필드는 존재하지만 **`SpellCaster`가 무시**한다(항상 1발).
- `Projectile`은 직선 이동 + 원-겹침 충돌 1종만 안다.

이 구조로는 마법 디자인(`magic-system-mage.md` § 3)이 요구하는 폭발·자기중심 AOE·부채꼴·호밍·체인·메테오·무작위 폭풍 같은 **패턴별 발사**를 데이터로 붙일 수 없다. 티어 2~4 마법을 추가해도 전부 동일한 직선 발사가 된다.

## What Makes This the Keystone

이 슬라이스는 마법 16종을 만드는 게 아니라, **"마법마다 발사 방식이 달라질 수 있는 엔진"이라는 토대 한 장**을 깐다. 이후 모든 티어/패턴 작업이 이 엔진에 case를 추가하는 형태로 붙는다.

## Constraints

- ADR 002: cc 의존은 `systems/`·`components/`에만, 결정 로직은 순수 `logic/`(vitest 검증).
- TDD: ready-impl의 RED 게이트 — 피처 테스트가 먼저 실패해야 구현 전환 가능.
- Safety Rule: 5+ 파일 동시 수정 → 사전 계획 공유(본 문서가 그 역할).
- 피처 테스트 파일명은 피처명 PascalCase여야 `ready-impl` 통과 → `tests/logic/SpellPatternEngine.test.ts`.

## Premises (사용자 동의 완료 — D1)

1. **이 슬라이스 = 토대.** 16종 전량 구현이 아니라 패턴 디스패치 엔진 + 대표 패턴(방향성 발사체 계열) 일부.
2. **ADR 002 + TDD 준수.** 패턴→발사 결정은 순수 함수(`logic/`), `SpellCaster`는 실행만.
3. **`projectileCount` 무시 동작 해소.** 다중 발사를 패턴 엔진이 정의 → 엔진은 더 이상 `projectileCount`를 무시하지 않는다.

## Approaches Considered

### Approach A: 순수 fire-plan 엔진 (선택 — D2)
`logic/SpellPatternLogic.buildFirePlan(spell, ctx) -> ShotSpec[]` 순수 함수. `SpellCaster`는 plan을 순회하며 `Projectile`을 스폰만 한다.
- Pros: 패턴 각도·발사수 로직을 vitest로 RED→GREEN 검증(TDD 게이트 통과). `SpellCaster` 얇게 유지. DeckLogic·FireSchedulerLogic·LoadoutLogic과 동형(ADR 002).
- Cons: logic 파일 1개 + 타입(`ShotSpec`) 신설.
- Reuses: `Projectile`, `LoadoutLogic`, `FireSchedulerLogic`, `spellCategoryColor`, `DataManager`/`DeckManager` 싱글톤.

### Approach B: 패턴 전략 컴포넌트(OO)
`SpellPattern` 인터페이스 + `LinearPattern`/`FanPattern` 구현체가 직접 노드 instantiate.
- Cons: cc 결합 → vitest 검증 불가, 순수 `logic/` 컨벤션 위반, RED 게이트 곤란. **기각.**

### Approach C: SpellCaster 인라인 switch
`_shoot` 안에 `switch(spell.pattern)`.
- Cons: 순수 로직 파일이 없어 RED 게이트를 skip-test로 우회해야 함. 패턴 증가 시 `SpellCaster` 비대화. **기각.**

## Recommended Approach (A) — 상세 설계

### 패턴 범위 (이번 슬라이스)
**방향성 발사체 패턴(`directional`) 하나.** 기존 `Projectile`을 재사용해 새 런타임 동작 없이 엔진을 증명한다.

- `directional` — aim 방향으로 **유효 발사체 수(count)만큼** 부채꼴(fan) 발사. count=1 → 직선 1발, count≥2 → `spreadAngleDeg` 안에 균등 분포.
- single/spread를 **별도 enum으로 쪼개지 않는다.** count가 1이냐 N이냐가 부채꼴 여부를 결정하므로 한 패턴으로 충분(P5 단순). 이것이 발사체 수 강화(아래)를 자연스럽게 받는 구조다.

자기중심 AOE(인페르노/프로스트 노바)·호밍(라이트닝 볼트)·메테오·체인·무작위 폭풍(블리자드)은 각각 신규 동작이 필요하므로 **같은 switch에 case를 추가하는 후속 슬라이스**로 미룬다.

### 강화 연동 — 발사체 수 (2026-06-02 사용자 지적 반영)
강화 옵션 5종(§ 7.1)의 **발사체 수 +1**은 티어 무관으로 티어1 마법(파이어볼 등)에도 붙는다. 즉 강화된 파이어볼은 2발 부채꼴이어야 한다. 따라서 부채꼴 count는 **유효 발사체 수 = 기본 `spell.projectileCount` + 강화 보너스**다.

- **이번 슬라이스:** 발사체 수 강화 트랙이 아직 없으므로(`DeckManager`엔 `damageMult/cooldownMult/maxHpBonus`만 존재) 보너스=0 → count=기본값. 엔진은 "주어진 count대로 부채꼴"이라 **강화 슬라이스가 보너스 소스를 더하면 코드 변경 없이 부챗살이 늘어난다.**
- **이음새:** 유효 count는 `SpellCaster`가 결정해 엔진에 넘긴다(현재는 `spell.projectileCount` 그대로, 향후 `+ bonus`). 엔진은 count를 받는 쪽이라 강화 도입 시 시그니처 불변.

### 조준 정책 (2026-06-02 사용자 질문 반영)
- 조준 = **발사 순간의 최근접 적**. 매 발사(쿨다운)마다 재선정 — 타겟 락온 아님.
- 발사된 `Projectile`은 **직선 고정**(호밍 없음). 충돌은 타겟이 아니라 **경로상 부딪히는 아무 적**과 발생 → 빠른 적이 가로지르면 그 적이 맞는다(의도대로).
- "타겟을 따라 휘는" 동작 = 호밍(라이트닝 볼트), 별도 후속 패턴.

### 타입 (`data/GameTypes.ts`)
```ts
/** 마법 발사 패턴 (magic-system-mage.md § 3). JSON 문자열과 일치 */
export enum SpellPattern {
  /** aim 방향 발사체 패턴 — 유효 count만큼 부채꼴 발사(count=1이면 직선) */
  Directional = 'directional',
}

// ISpellData에 추가:
//   pattern: SpellPattern;
//   spreadAngleDeg?: number;  // count>=2일 때 총 부채꼴 각도(기본 DEFAULT_SPREAD_ANGLE_DEG=30)
```

### 순수 엔진 (`logic/SpellPatternLogic.ts` — 신규)
```ts
/** 한 발의 발사 사양 — cc 비의존(숫자만) */
export interface ShotSpec {
  /** 단위 방향 x */ dirX: number;
  /** 단위 방향 y */ dirY: number;
  speed: number;
  damage: number;   // 마법 기본 데미지(전역 강화는 caster가 곱)
  radius: number;
}

/** 발사 컨텍스트 — 조준 단위 벡터 + 유효 발사체 수 */
export interface FireContext {
  aimX: number;
  aimY: number;
  /** 유효 발사체 수(기본 + 강화 보너스). caster가 해석해 전달. */
  count: number;
}

/** 마법 + 컨텍스트 → 이번 발사로 생성할 ShotSpec 목록(순수). */
export function buildFirePlan(spell: ISpellData, ctx: FireContext): ShotSpec[];
```
- `directional`: `n = max(1, ctx.count)`발을 aim 중심 부채꼴로 균등 배치. 각도 = `spell.spreadAngleDeg ?? 30`.
  - n=1 → aim 방향 1발(부채꼴 없음, div-by-zero 없음).
  - n 홀수 → 중앙 발사체가 정확히 aim, 좌우 ±.
  - n 짝수 → 중앙 없이 ± 대칭.
- 미지정/미지 pattern → `directional` 폴백.

### 실행부 (`components/SpellCaster.ts` — 수정)
`update`의 단일 `_shoot` 호출을 교체:
1. 최근접 적까지 aim 단위 벡터 계산(기존 로직 재사용). 길이≈0(적이 self와 동일)이면 폴백 `(0,1)`.
2. 유효 count 해석(현재 `spell.projectileCount`, 향후 `+ 강화 보너스`).
3. `buildFirePlan(spell, { aimX, aimY, count })`.
4. ShotSpec마다 `Projectile` 스폰 — 전역 `DeckManager.damageMult` 곱, 분류 색 틴트(`spellCategoryColor`) 적용.

> 적이 없으면 현행대로 발사하지 않는다(directional은 타깃 필요). facing 방향 발사는 AOE/블리자드 후속 슬라이스 관심사 → [[project_targetless_fire_direction]].

### 데이터 (`resources/data/spells.json` — 수정)
기존 3종에 `"pattern": "directional"` 추가. 수치 변경 없음(`projectileCount`는 1 유지).

## Success Criteria

- `tests/logic/SpellPatternEngine.test.ts` GREEN: single=1발(방향=aim), spread count=3 대칭 3발(중앙=aim)·count=짝수 대칭·count<=0 방어·각도 부채꼴 범위 내.
- 전체 vitest 스위트 GREEN(start-verification 게이트).
- 인게임 회귀 없음: 기존 3종이 종전과 동일하게 직선 1발(수동 QA).
- 엔진이 `projectileCount`를 더 이상 무시하지 않음(spread 경로로 검증).

## Open Questions (→ /autoplan)

- ~~`spread`를 쓰는 라이브 마법이 없다~~ → **해소(2026-06-02 사용자 지적):** 발사체 수 강화 카드는 티어1 마법(파이어볼 등)에도 붙으므로 count-driven 부채꼴의 직접 소비자다. single/spread를 `directional` 하나로 통합, 강화 보너스 이음새만 열어둠.
- `spreadAngleDeg` 기본 부채꼴 각도(30°) — 밸런싱 단계에서 마법별 조정. 기본값으로 진행.

## Impact Map

| 파일 | 변경 | 회귀 확인 |
|------|------|-----------|
| `data/GameTypes.ts` | `SpellPattern` enum + `ISpellData.pattern`/`spreadAngleDeg` | 타입 컴파일, 기존 ISpellData 소비처 |
| `logic/SpellPatternLogic.ts` | 신규 순수 엔진 | vitest 단독 |
| `components/SpellCaster.ts` | `_shoot` → fire-plan 실행 | 기존 단발 발사 회귀 |
| `resources/data/spells.json` | 3종에 `pattern:"single"` | DataManager 로드 |
| `tests/logic/SpellPatternEngine.test.ts` | 신규 테스트 | — |
| `docs/qa/spell-pattern-engine-test.md` | 신규 QA 문서 | — |

> 코드 파일 4개 + 테스트/QA. 5+ 동시 수정이므로 본 계획 공유로 Safety Rule 충족.

## Next Steps

1. `/autoplan` — CEO + Eng 리뷰 → 사용자 승인.
2. 사용자 `계획 승인` → `pnpm wf approve-plan`.
3. QA 문서 + `SpellPatternEngine.test.ts`(RED) 작성 → `pnpm wf ready-impl`.
4. 구현(GREEN) → 검증 파이프라인.

## /autoplan 리뷰 반영 (2026-06-02, 단일 모델 모드)

CEO+Eng 풀뎁스 리뷰 결과. Design/DX 페이즈는 스코프 해당 없음(순수 로직).

### 구현 시 확정 사항 (Eng 발견 해소)
- **E1 조준 영벡터:** `SpellCaster`는 aim 단위벡터를 `buildFirePlan`에 넘기기 전, 길이 ≈ 0(적이 self와 동일 위치)이면 폴백 `(0, 1)`을 쓴다. `SpellPatternLogic`은 ctx.aim이 단위벡터라고 가정한다(NaN 전파 방지).
- **E2 미지정 패턴:** `buildFirePlan`의 `pattern` switch는 미지정/미지 값을 `single`로 폴백한다(크래시 없음). 테스트로 고정.
- **E3 `spreadAngleDeg` 기본값:** 상수 `DEFAULT_SPREAD_ANGLE_DEG = 30`. 데이터에서 생략 시 적용. 밸런싱 단계에서 마법별 조정.
- **E5 데미지 합산:** `ShotSpec.damage = spell.damage`(기본값)만 담는다. 전역 `DeckManager.damageMult`는 `SpellCaster`가 스폰 시 곱한다 — 엔진은 DeckManager 비의존(순수 유지).
- **count 클램프:** `buildFirePlan`은 `Math.max(1, spell.projectileCount)`로 클램프(0/음수 방어).

### 알려진 리스크 (이월)
- **E4 객체 풀링 부재:** spread가 캐스트당 발사체를 N배로 늘려 `instantiate`/`destroy` churn을 악화시킨다(6슬롯 동시 발사 시 누적). 풀링은 로드맵 day-1 원칙이나 **독립 시스템(>1일)**이라 이 슬라이스 밖 → `TODOS.md` 이월. 이 슬라이스는 풀링 없이도 회귀 없음(기존 single도 instantiate 사용).

### 테스트 케이스 (SpellPatternEngine.test.ts, RED 먼저)
- directional count=1 → 1발, dir==aim, speed/damage/radius 전달 (부채꼴 없음, div-by-zero 없음)
- directional count=3 → 3발, 중앙 dir==aim, 외곽 ±θ/2 대칭
- directional count=2 → ±θ/2 대칭(중앙 없음)
- count<=0 → 1발로 클램프
- pattern 미지정/미지 값 → directional 폴백
- spreadAngleDeg 생략 → 기본 30° 적용

### 결정 감사 로그 (auto-decided)
| # | 결정 | 원칙 |
|---|------|------|
| E1 | 조준 영벡터 caster 폴백 (0,1) | P5 명시 |
| E2 | 미지정 패턴 → single 폴백 | P1 완전성 |
| E3 | spreadAngleDeg 기본 30° | P3 실용 |
| E4 | 풀링 이월(TODOS) | P2/P3 |
| E5 | damageMult는 caster에서 곱 | P5 명시 |

> **승인 게이트 해소(2026-06-02):** single/spread 분리 대신 **count-driven `directional` 단일 패턴**으로 통합. 발사체 수 강화가 티어1에도 적용된다는 사용자 지적으로 라이브 소비자 확인 → premise #3 충족, spread 별도 enum 불필요. 조준 정책(최근접·직선·비호밍)도 명문화.

## What I noticed

- "토대부터가 정석" 판단에 바로 동의 — 16종 욱여넣기 대신 키스톤 한 장을 먼저 깐다는 스코프 규율이 분명함.
- 순수 함수 vs OO 컴포넌트 선택에서 테스트 가능성을 기준으로 A를 고른 것은 이 프로젝트의 ADR 002/TDD 자산을 실제로 활용하는 선택.
