# 계획: 발사체 수 강화 옵션 (projectile-count)

> - **작성일:** 2026-06-10
> - **브랜치:** feat/projectile-count
> - **상태:** 계획 (승인 대기)
> - **상위 설계:** [로드맵 v0.2](../../planning/roadmap.md) §7(강화 5종 — 동시 발사 수 +1)·§10(7-9주 콘텐츠). [마법 시스템](../../planning/magic-system-mage.md) §7.6(발사체 수 밸런스 — 발사체당 데미지 페널티).
> - **선행:** 패시브 효과 슬라이스(PR #29) 머지 완료. 강화 프레임워크(`EnhancementLogic` 개별·분류 트랙), 부채꼴 패턴 엔진(`SpellPatternLogic`), 객체 풀링 모두 기존재.
> - **슬라이스 위치:** 덱 시스템 슬라이싱 맵의 **슬라이스 2** (passive-effects 플랜 §2). 슬라이스 1(패시브) 완료 후 선행 의존 없는 다음 작업.

---

## 0. 목표 (한 줄)

레벨업 카드로 마법별 **발사체 수를 +1 강화**(개별·분류 트랙)하고, 늘어난 발사체에 **발사체당 데미지 페널티**(`×(1 − r×증가수)`, r=0.10 placeholder)를 적용해 "다발 = 군집 이득·단일 손해" 트레이드오프를 만든다.

---

## 1. 배경 / 왜 지금

덱 시스템 슬라이싱 맵(passive-effects 플랜 §2)에서 슬라이스 1(패시브)이 끝났고, 슬라이스 3(사거리/지속)은 AOE/DOT 레이어 선행 의존으로 막혀 있다. **선행 의존 없이 착수 가능한 다음 슬라이스가 발사체 수**다.

인프라는 이미 대부분 깔려 있다:
- `SpellPatternLogic.buildFirePlan`이 `count`를 받아 부채꼴 ShotSpec N개를 생성한다(홀수=중앙 aim, 짝수=± 대칭). **패턴 엔진 완성.**
- `SpellCaster.ts:107`이 이미 `count: spell.projectileCount`로 호출하며 주석에 `(+ 향후 발사체 수 강화 보너스)`로 배선 지점을 표시해뒀다.
- `EnhancementLogic`의 `raise`/`getLevel`이 옵션 무관 제네릭이고, `DeckManager.applyCard:97`이 upgrade 카드를 `raise(track,target,option)`로 라우팅한다 → ProjectileCount 카드도 적용 경로는 자동.
- `UpgradeOption.ProjectileCount` enum 값이 이미 존재(`GameTypes.ts:44`, 주석 "후속(projectile-count-upgrade)").

이 슬라이스는 **빠진 두 가지**만 채운다: (1) 발사체 수 보너스를 유효 count에 반영, (2) 발사체당 데미지 페널티.

---

## 2. 데미지/쿨다운과 다른 점 (핵심 설계 제약)

발사체 수는 기존 데미지/쿨다운 강화와 **다르게** 동작해야 한다 (기획 §7.6):

| 항목 | 데미지/쿨다운 | 발사체 수 |
|------|--------------|-----------|
| 합산 방식 | 곱셈 비선형 곡선(`INDIVIDUAL_CURVE`/`CATEGORY_CURVE`) | **+1 가산** (레벨당 발사체 1개) |
| 전역(플레이어) 트랙 | 있음(`addGlobal`) | **없음** — §7.6 "전역 발사체 수 증가는 없다" |
| 부수 효과 | 없음 | **발사체당 데미지 페널티** `×(1 − r×증가수)` |

> §7.6 근거: 전역이면 최소 +1이라 어떤 덱에서든 무조건 픽이 돼 밸런스 불가. 균등분할(각 발=기본/N)을 쓰면 "범위 강화"와 같아지므로, 발당 페널티 r로 총 출력을 체감 증가시켜 데미지(단일 깊이)·범위(커버리지)·발사체 수(군집 다타격)를 삼각 분리한다.

---

## 3. 설계 — 최소 미러 (office-hours Phase 4 채택)

### 3.1 EnhancementLogic (순수 로직 — 단위 테스트 대상)

- **`projectileBonus(spell): number`** = `getLevel(Individual, spell.id, ProjectileCount) + getLevel(Category, spell.category, ProjectileCount)`. 가산. 각 트랙 cap 4(기존 `UPGRADE_CAP`) → 최대 보너스 8. 곡선(`factor`) 경로를 타지 않는다.
- **`effectiveProjectileCount(spell): number`** = `spell.projectileCount + projectileBonus(spell)`. (Eng 리뷰) base+bonus 산술을 순수 로직으로 끌어와 단위 테스트 대상화 — `effectiveCooldown` 패턴 미러. SpellCaster는 이 값을 그대로 쓰는 얇은 호출부가 된다.
- **`PROJECTILE_DAMAGE_PENALTY_R = 0.10`** 상수(export). 기획 §7.6 초안값, 밸런싱 단계(로드맵 11-12주) 확정. 주석에 출처·확정 시점 명시.
- **`penaltyFor(bonus: number): number`** = `Math.max(MIN, 1 − R × bonus)` 순수 헬퍼 + **`projectilePenaltyFactor(spell)`** = `penaltyFor(projectileBonus(spell))`. (Eng 리뷰) 클램프를 헬퍼로 분리해 범위 밖 bonus로 **하한 도달을 직접 단위 테스트** 가능하게 한다(공개 API로는 max bonus 8 → 0.2라 하한 미도달).
- **총출력 곡선(문서화):** 다발 전부 명중 시 `(1+bonus)×(1−0.10×bonus)`는 **bonus≈4.5에서 ×3.0 정점 후 cap 8에서 ×1.8로 하락**한다(§7.6 의도된 diminishing-returns). 밸런싱 때 버그로 오인하지 않도록 상수 주석에 명시.
- **`factor()` 가드:** `factor()`는 데미지/쿨다운(곱셈 곡선) 전용이다. (Eng 리뷰) `ProjectileCount`가 `SLICE_OPTIONS`에 들어가면 미래에 `factor(spell, ProjectileCount)` 오용 시 count에 곡선 배율이 적용되는 silent 버그 가능 → `factor()`에 데미지/쿨다운 전용 주석/가드(`console.assert`) 추가.
- **카드 생성 + §8 적격 게이트:** `SLICE_OPTIONS`에 `ProjectileCount` 추가. `buildUpgradeCards`는 개별·분류만 생성하므로 자동으로 발사체 카드가 **개별·분류 트랙으로만** 합성된다(전역 없음 = §7.6 충족). **추가로 `option===ProjectileCount && spell.allowsProjectileCount===false`면 개별 카드 skip**(자기중심 AOE 마법 제외 — 기획 §8, 아래 3.4). 분류 카드는 분류 단위라 해당 분류에 ✅ 마법이 하나라도 있으면 노출(현 3종 전부 ✅). 보조 분류 제외(`generalOptions` §7.5)·maxed 제외(기존 로직)도 그대로 적용.
- **디버그 스냅샷:** `EnhancementDebugRow`에 발사체 보너스·페널티·유효 발사체 수 필드 추가(패시브 로그처럼 인게임 가시성 확보용, UI는 CardSelectPanel).

### 3.2 DeckManager (cc 위임 — 수동 QA 대상)

- `projectileBonus(spell)`·`projectilePenaltyFactor(spell)` getter를 `EnhancementLogic`에 위임(기존 `damageFactor`/`effectiveCooldown` 패턴 그대로).
- `applyCard`는 **수정 불필요** — `raise`가 ProjectileCount upgrade 카드를 이미 제네릭으로 처리(`DeckManager.ts:97`).

### 3.3 SpellCaster (cc 배선 — 수동 QA 대상)

`update()` 발사 루프(`:106-111`):
```
const count = DeckManager.instance.effectiveProjectileCount(spell);
const plan = buildFirePlan(spell, { aimX, aimY, count });
const damageFactor = DeckManager.instance.damageFactor(spell);
const penalty = DeckManager.instance.projectilePenaltyFactor(spell);
for (const shot of plan) this._spawnShot(shot, damageFactor * penalty, spell.category);
```
`_spawnShot`의 `shot.damage * damageFactor` → `shot.damage * (damageFactor * penalty)`. 보너스 0이면 count=기본·penalty=1이라 기존과 완전 동일(회귀 안전). **JSDoc 갱신(Eng 리뷰):** `_spawnShot`의 `@param damageFactor`가 이제 `damageFactor×penalty`를 받으므로 주석 업데이트(CLAUDE.md "파라미터 변경 시 @param 갱신").

### 3.4 데이터 · i18n

- `data/GameTypes.ts`: `ISpellData`에 **`allowsProjectileCount?: boolean`** 추가(기본 true, 자기중심 AOE만 false — 기획 §8). `UpgradeOption.ProjectileCount` enum 주석의 "후속" 표기도 갱신(이제 배선됨).
- `spells.json`: 각 공격 마법의 기본 `projectileCount`는 이미 존재. 현 3종(fireball·ice_missile·lightning_bolt)은 전부 directional·발사체 수 ✅라 `allowsProjectileCount`는 기본값(true) 의존 — 데이터 변경 불필요. (자기중심 AOE 마법 추가 시 그 마법에 `false` 명시.)
- `i18n/{ko,en}.json`: 발사체 수 옵션 라벨 키 `upgrade.projectile_count`를 **ko·en 양쪽** 추가(개별/분류 카드 desc가 `upgrade.${option}` 참조 — `EnhancementLogic.ts:245`, enum 문자열 `'projectile_count'`와 일치). 카드는 동적 합성이라 별도 카드 엔트리 불필요.

---

## 4. 테스트 (TDD — 순수 로직)

`EnhancementLogic`은 순수 로직이라 RED→GREEN 단위 테스트 가능(스킵 아님).

`tests/logic/ProjectileCount.test.ts`:
- `projectileBonus` 초기 0, 개별+분류 가산 누적, 각 트랙 cap 4(최대 8).
- `effectiveProjectileCount`: base 1 + bonus 2 = 3 등 base+bonus 결합. (Eng 리뷰 — cc 레이어 산술을 순수로 끌어와 검증)
- `penaltyFor(bonus)` 직접: 0→1.0, 1→0.9, 2→0.8, 4→0.6, 8→0.2(하한 미발동 확인), 범위 밖 큰 bonus→하한 `MIN` 클램프. (Eng 리뷰 — 공개 API로 못 미치는 클램프를 헬퍼로 직접 검증)
- `buildUpgradeCards`: ProjectileCount 카드가 개별·분류로 생성, **전역 없음**, 보조 분류 제외, maxed(레벨4) 제외, **`allowsProjectileCount===false` 마법은 개별 발사체 카드 미생성**(§8 게이트).
- `debugSnapshot`: 새 발사체 보너스·페널티·유효 발사체 수 필드가 채워지는지. (Eng 리뷰)
- 회귀: 데미지/쿨다운 factor 불변(발사체 추가가 기존 곡선에 영향 없음).

---

## 5. Impact Map (회귀 기준)

| 파일 | 변경 | 회귀 확인 |
|------|------|----------|
| `logic/EnhancementLogic.ts` | projectileBonus·effectiveProjectileCount·penaltyFor·projectilePenaltyFactor·상수·SLICE_OPTIONS·§8 게이트·factor() 가드·디버그행 | 데미지/쿨다운 카드·배율 불변 |
| `systems/DeckManager.ts` | getter 위임(effectiveProjectileCount·projectilePenaltyFactor) | applyCard·기존 getter 불변 |
| `components/SpellCaster.ts` | effectiveProjectileCount, damage×penalty + `_spawnShot` JSDoc | 보너스 0 시 기존 발사 동일 |
| `data/GameTypes.ts` | `ISpellData.allowsProjectileCount?` + enum 주석 갱신 | 기존 필드·직렬화 불변 |
| `resources/i18n/{ko,en}.json` | `upgrade.projectile_count` 키(양쪽) | 기존 키 불변 |
| `ui/CardSelectPanel.ts` | (선택) 디버그 로그에 발사체 수 | 기존 로그 불변 |

---

## 6. 착수 전 선행 작업

- **`HIDE_CATEGORY_UPGRADE_CARDS = false` 복원** — passive-effects가 QA용으로 켜둔 DEV 플래그(`DeckManager.ts`). 발사체 수와 무관하나 분류 강화 카드가 다시 노출돼야 발사체 분류 카드 QA가 가능하므로 **implementation 진입 직후 첫 작업**으로 복원.

---

## 7. 스코프 밖 (후속 슬라이스)

- 정확한 r 값 튜닝, 비선형 발사체 곡선(현재 선형 +1) → 밸런싱 단계.
- 사거리/지속 강화(슬라이스 3, AOE/DOT 선행), 메테오·체인 등 비-Directional 패턴의 다발 배치 → 해당 패턴 슬라이스.
- 자기중심 AOE 마법(인페르노·프로스트 노바) 자체 추가 → 그 슬라이스에서 `allowsProjectileCount:false` 명시. (게이트는 이번에 깔아둠)
- 카드 등급/리롤 등 폴리시.

---

## 8. autoplan 리뷰 결과 (2026-06-10, Codex 부재 → Claude 서브에이전트 단독)

**CEO 페이즈:**
- **F1 (페널티 제거 권고) — 기각.** v1엔 보스가 없어 "단일 손해"가 빈다는 지적이나, 패턴 엔진이 부채꼴 각 발사체에 풀데미지(`SpellPatternLogic.ts:81`)를 줘서 페널티를 빼면 +1 = 데미지 ×2 strict 업그레이드가 된다. 페널티는 v1 군집 콘텐츠에서도 "무조건 픽" 방지의 load-bearing 장치 → **유지.** r=0.10이 monotonic이라는 지적도 오류(총출력은 bonus 4.5 정점 후 하락 — peak-and-decline 성립).
- **F3 (슬라이스 vs 콘텐츠 우선순위) — 플래그만.** 발사체 수 대신 마법/적 추가가 "재미 검증(전제 3)"에 더 기여할 수 있다는 지적. 단 슬라이싱 맵(passive-effects §2)에서 이미 슬라이스 2로 확정·사용자 승인됨. 기록만.
- **F5 (로드맵 §7 "사거리 +30%" stale) — 무관 이슈 플래그.** magic-system §7.1이 사거리/관통 개념을 제거했으나 로드맵 §7 강화 5종 목록에 잔존. 이번 슬라이스 범위 밖, 밸런싱 단계 전 정합 필요(즉시 수정 안 함).

**Eng 페이즈:** 설계 승인(분리 경로 정당·no-global 구조적 보장·페널티 필수 확인). 지적은 전부 테스트/문서 보강 → 본 계획 §3·§4에 반영:
- `effectiveProjectileCount`·`penaltyFor` 순수 헬퍼 추출(테스트 가능성), `factor()` 데미지/쿨다운 전용 가드, 디버그 필드·effective count 테스트, JSDoc·주석 갱신.

**F2 (사용자 결정): §8 적격 게이트 — 지금 데이터 플래그로 추가.** `allowsProjectileCount?:boolean`(기본 true). 현 3종 전부 ✅라 동작 불변, 자기중심 AOE 추가 시 자동 제외되는 안전장치. 패턴 추론이 아닌 마법별 명시 플래그(파이어 블래스트류 부채꼴도 ✅ 정확 유지).

### 결정 감사 추적 (Decision Audit Trail)

| # | 페이즈 | 결정 | 분류 | 원칙 | 근거 |
|---|--------|------|------|------|------|
| 1 | CEO | 페널티 유지(F1 기각) | 분석 기각 | P5 | 풀데미지 부채꼴 → 페널티 없으면 strict ×2, load-bearing |
| 2 | CEO | r=0.10 placeholder 유지 | mechanical | P6 | 총출력 peak-and-decline 성립, 정밀값은 밸런싱 |
| 3 | CEO | 슬라이스 진행(F3) | mechanical | P6 | 슬라이싱 맵 확정·승인된 순서 |
| 4 | CEO | §7 stale 플래그만(F5) | mechanical | P3 | 무관 이슈, 즉시 수정 안 함 |
| 5 | Eng | 순수 헬퍼 추출·테스트 보강 | mechanical | P1·P5 | 산술을 cc 밖으로, 클램프 직접 테스트 |
| 6 | Eng | factor() 가드 추가 | mechanical | P5 | 미래 오용(곡선 적용) silent 버그 방지 |
| 7 | F2 | §8 적격 게이트 지금 추가(데이터 플래그) | **사용자 결정** | P2 | 싼 안전장치, 현 동작 불변 |

**리뷰 종합:** 설계 결함 0. 모든 지적이 테스트/문서/게이트 보강으로 흡수됨. 승인 가능.
