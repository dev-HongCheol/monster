# 마법 효과 레이어 S1 — Explosion 프리미티브 + 파이어볼 AoE화 계획

> **작성일:** 2026-06-16
> **상태:** 완료 (구현·검증·7단계 인게임 테스트 통과 → PR #34, 2026-06-17)
> **브랜치:** feat/magic-explosion
> **슬라이스:** 마법 효과 레이어 S1 (기획 `magic-system-mage.md` §12.2)
> **닫는 백로그:** A1(일부 — Explosion·시전 단위 dedup 프리미티브), A3(범위 — 폭발 반경 강화 활성화)
> **관련 문서:**
> - [마법 시스템 디자인 v1.2](../../planning/magic-system-mage.md) — §9.3 Explosion, §10.2 시전 단위 dedup, §10.3 범위 매핑, §11 파이어볼 분해표, §12 조합 모델·슬라이스
> - [ADR 002: scripts/logic 분리](../../decisions/002-scripts-logic-pattern.md) — 순수 로직/컴포넌트 경계
> - [개발 백로그](../backlog.md) — A1·A3

---

## 1. 스코프 (확정 — 타이트)

이번 슬라이스는 효과 레이어의 **기반**을 깐다. 파이어볼 하나를 단일 명중에서 폭발(AoE)로 바꾸면서, 이후 모든 폭발형 마법(메테오·썬더스톰·블리자드)이 재사용할 **Explosion 순수 로직 프리미티브**와 **시전 단위 중복 제거(dedup) 인프라**를 함께 만든다.

포함하는 것:

1. **Explosion 프리미티브** — 중심·반경·적 목록·이미 맞은 집합을 받아 새로 맞을 적을 골라내는 순수 함수(`logic/`).
2. **시전 단위 dedup** — 한 번의 시전(volley)이 만든 모든 발사체가 적 식별자 집합 하나를 공유해, 같은 적을 시전당 1회만 맞힌다. 안정 식별자로 적 `spawnId`(풀 재사용마다 증가하는 number)를 도입한다.
3. **파이어볼 AoE화** — 명중 시 직격 피해 없이 폭발만 한다(기획 §9.3). 빗나가면 폭발 없이 화면 밖에서 소멸.
4. **범위 강화(폭발 반경)** — 지금 no-op인 `Range` 옵션을 폭발 반경에 처음 연결한다(A3). 강화 배율은 `EnhancementLogic.factor(Range)`를 재사용한다.
5. **폭발 VFX** — 명중 지점에 폭발 시각 효과(Cocos 에셋, 7단계에서 사용자가 생성).

미루는 것 (이번 스코프 밖):

- **facing(A2)** — S5로 미룬다. 파이어볼은 공격 마법이라 적이 없으면 발사를 보류해도 손실이 없고, facing 폴백이 진짜 필요한 건 지속·설치형(블리자드 S6)이다.
- **`buildFirePlan` 출력 일반화(기획 §12.1)** — 아래 §3 D1 참고. S1엔 불필요하므로 미룬다.
- **지속시간 강화(A3 지속)** — 폭발은 즉발이라 지속 대상이 없다. CC·DOT가 생기는 S2/S4에서.
- **동시 적 수 상한(`maxEnemies`) 제거·대량 적 성능** — 백로그 G1로 분리. S1은 손대지 않는다. 폭발 AoE 검증에 필요한 밀도는 7단계에서 인스펙터 값으로만 임시 확보한다(아래 §6).

---

## 2. 현재 코드 동작 (출발점)

- `SpellPatternLogic.buildFirePlan(spell, ctx)`가 `ShotSpec[]`(발사체별 방향·속도·데미지·반경)을 반환한다. 파이어볼은 `Directional` 패턴으로 count만큼 부채꼴 발사체를 만든다.
- `SpellCaster.update`가 매 시전마다 `buildFirePlan` 결과를 돌며 발사체 하나씩 `_spawnShot` → `Projectile.init`으로 띄운다. 데미지 배율(개별×분류×전역 × 발사체당 페널티)은 caster가 곱한다.
- `Projectile`이 매 프레임 이동하다 적과 충돌하면 그 적에게 `takeDamage` 1회 후 자신을 풀로 반환한다(단일 명중). 화면 밖이면 그냥 반환.
- `EnemyController`는 풀 재사용마다 `reset()`으로 상태를 새로 잡는다. 종류 id인 `enemyId`(string)만 있고 **개체별 안정 id는 없다.**
- `EnhancementLogic.factor(spell, option)`은 데미지·쿨다운에 쓰이며, `Range`/`Duration`도 곡선상 동작하지만(발사체 수만 assert로 차단) 아직 아무 데도 곱해지지 않는다(A3 no-op).
- i18n 카탈로그에는 `upgrade.damage`·`upgrade.cooldown`·`upgrade.projectile_count`만 있고 **`upgrade.range`는 없다.**

---

## 3. 엔지니어 리뷰 — 핵심 설계 결정

### D1. `buildFirePlan` 출력 일반화는 S1에서 하지 않는다 (미룸)

기획 §12.1은 "`buildFirePlan`이 발사체(`ShotSpec[]`)만 반환하므로, '이 지점에 폭발 / 라인 타격 / 지대 생성'도 표현하도록 출력을 일반화해야 한다"고 적는다. 하지만 그 일반화가 필요한 건 **발사체가 아닌 결과를 내는 패턴**(빔·지정 낙하·지대)이 처음 등장할 때다. 파이어볼은 여전히 `Directional` 발사체이고, 폭발은 그 발사체가 적에 닿을 때 일어나는 **명중 시 효과**다. 따라서 S1의 폭발은 기존 발사체 경로 위에 얹히며, 출력 타입을 바꿀 이유가 없다.

→ **결정:** `buildFirePlan`/`ShotSpec`은 손대지 않는다. 명중 시 효과(단일/폭발)는 발사체별 기하 정보와 무관하게 마법 전체가 공유하므로, `SpellCaster`가 마법 데이터에서 읽어 발사체에 전달한다. 출력 일반화는 S4(자기중심 광역) 또는 S5(지정 낙하)에서 그 패턴을 처음 만들 때 한다.

### D2. 시전 단위 dedup — 공유 집합을 발사체들이 들고 다닌다

기획 §10.2의 식별 단위는 "한 번의 시전(volley)"이다. 파이어볼 발사체 수 강화(✅)로 한 시전이 부채꼴 N발을 쏘면, 각 발사체가 제 명중 지점에서 폭발한다. 이때 N개의 폭발이 겹쳐도 한 적은 그 시전에서 **1회만** 피해를 받아야 한다(다발 = 커버리지 이득이지 같은 자리 누적이 아님).

N발은 비행 거리가 달라 **서로 다른 프레임에 명중**하므로, 공유 식별자 집합은 시전이 살아 있는 동안(발사체가 하나라도 남은 동안) 유지돼야 한다.

→ **결정:** `SpellCaster`가 시전마다 `Set<number>`(맞은 적 `spawnId` 집합) 하나를 만들어 그 시전의 모든 발사체 `init`에 같은 참조로 넘긴다. 발사체는 명중 시 이 공유 집합을 들고 Explosion 로직을 돌린다. 발사체가 모두 소멸하면 집합도 함께 회수된다. 발사체 수 1이어도 같은 경로(집합 하나를 한 폭발이 쓴다)로 일관 처리한다.

### D3. 적 `spawnId` — 풀 재사용 오판 방지

적은 풀에서 재사용되므로 노드 참조로 dedup하면 "죽고 같은 노드로 재사용된 다른 적"을 같은 적으로 오판할 수 있다(기획 §10.2). 그래서 dedup 집합은 노드가 아니라 개체별 안정 id를 담아야 한다.

→ **결정:** `EnemyController`에 `spawnId: number` 필드를 추가하고, `reset()`마다 모듈 단조 증가 카운터에서 새 값을 받는다. 살아 있는 적끼리 항상 유일하다. dedup 순수 로직은 이 id를 소비할 뿐, id 생성 책임은 컴포넌트에 둔다.

### D4. Explosion은 순수 로직 프리미티브로 분리한다 (ADR 002)

폭발의 "어떤 적이 맞나"(중심 반경 안 + 미중복) 판정은 cc 비의존 순수 함수로 떼어 단위 테스트로 고정한다. 이게 A1이 닫는 재사용 프리미티브다 — S5(메테오·썬더스톰), S6(블리자드)도 같은 함수를 쓴다.

→ **결정:** `logic/ExplosionLogic.ts`(신규)에 다음을 둔다.

```
selectExplosionHits(
  centerX, centerY, radius,
  enemies: { x, y, collisionRadius, id }[],
  alreadyHit: Set<number>,
): number[]   // 새로 맞을 적의 enemies 인덱스 목록
```

- 판정: `distance(center, enemy) <= radius + enemy.collisionRadius` (적의 몸이 폭발에 겹치면 맞음).
- dedup: `alreadyHit`에 없는 적만 고르고, 고른 적의 id를 `alreadyHit`에 더한다(dedup 불변을 순수 계층에 둬 테스트로 고정).
- 컴포넌트는 반환된 인덱스로 `takeDamage`만 적용한다.
- **그리드-레디(성능 백로그 G1 대비):** `enemies`는 "후보 적 목록"을 받는 인자다. 지금은 호출부가 전체 활성 적 목록을 넘기지만(적 수가 작아 무방), 나중에 공간 그리드가 생기면 같은 인터페이스에 **그리드 반경 질의 결과**만 넘기면 된다 — 함수 재작업 없이 O(n)→O(k)로 전환된다. 따라서 `selectExplosionHits`는 전체 적을 직접 스캔하지 않고 받은 목록만 훑도록 구현한다.

### D5. 범위 강화 배선 + 카드 게이트 + i18n 키 (A3)

폭발 반경이 생겨야 `Range` 강화가 처음으로 곱할 대상을 갖는다.

→ **결정:**
- `DeckManager.rangeFactor(spell)` 추가 → `EnhancementLogic.factor(spell, Range)`. 유효 폭발 반경 = `기본 explosionRadius × rangeFactor`. `SpellCaster`가 시전 때 계산해 발사체에 넘긴다.
- 카드 생성 게이트(기획 §10.3 A3): `Range` 카드는 폭발 반경을 실제로 가진 마법만 생성한다. `allowsProjectileCount`와 같은 방식의 능력 플래그(`explosionRadius`를 가진 마법 = 범위 강화 적격)로 판정한다. 지금은 파이어볼만 적격 → 파이어볼 개별 카드와 화염 분류 카드에만 `Range`가 붙는다.
- **i18n:** `upgrade.range` 키가 카탈로그에 없으므로 `ko.json`·`en.json`에 추가한다. 추가하지 않으면 방금 머지한 i18n 키 정합 가드가 테스트에서 RED를 띄운다(카탈로그↔코드 드리프트).

### D6. 파이어볼 명중 = 폭발만, 직격 없음

발사체가 적과 충돌하면 그 적에게 직접 `takeDamage`를 주지 않고, 충돌 지점에서 폭발만 한다(기획 §9.3). 충돌을 일으킨 적도 폭발 반경 안에 있으므로 폭발 피해 1회를 받는다(직격 보너스 없음). 단일 명중 마법(다른 마법)은 기존 경로를 그대로 쓴다.

→ **결정:** 발사체에 명중 효과 종류를 실어 분기한다. 폭발이면 충돌 적을 따로 때리지 않고 Explosion 로직만 돌린다.

---

## 4. 순수 로직 / 컴포넌트 경계 (ADR 002)

| 구분 | 대상 | 테스트 |
|---|---|---|
| **순수 로직** | `ExplosionLogic.selectExplosionHits`(반경 판정 + dedup) | ✅ 단위 |
| **순수 로직** | `EnhancementLogic.factor(Range)` 재사용 + 유효 폭발 반경 산출 | ✅ 단위 |
| **순수 로직** | `EnhancementLogic.buildUpgradeCards` 범위 카드 게이트(적격 마법만) | ✅ 단위 |
| **컴포넌트** | `EnemyController.spawnId` 부여(reset마다 증가) | 수동 QA |
| **컴포넌트** | `Projectile` 명중 시 폭발 분기(공유 집합·반경 소비) | 수동 QA |
| **컴포넌트** | `SpellCaster` 시전당 dedup 집합 생성·유효 반경 계산·init 전달 | 수동 QA |
| **컴포넌트** | `DeckManager.rangeFactor` 접근자 | (얇은 위임) |
| **데이터** | `spells.json` 파이어볼: 명중 효과·폭발 반경 필드 | 수동 QA |
| **에셋** | 폭발 VFX (Cocos 생성 — 7단계) | 수동 QA |

---

## 5. 파일별 변경 계획

- **`logic/ExplosionLogic.ts` (신규)** — `selectExplosionHits` 순수 함수(§3 D4).
- **`data/GameTypes.ts`** — `ISpellData`에 명중 효과 종류(`hitEffect?: 'single' | 'explosion'`, 기본 single)와 `explosionRadius?: number` 추가. 범위 강화 적격은 `explosionRadius` 유무로 판정(또는 명시 플래그). `UpgradeOption.Range`는 이미 enum에 있음.
- **`logic/EnhancementLogic.ts`** — `buildUpgradeCards`에 `Range` 옵션을 적격 마법·분류에 한해 추가(게이트). `SLICE_OPTIONS`는 그대로 두고 범위는 능력 게이트로 분기. `factor(Range)`는 이미 동작(변경 없음).
- **`systems/DeckManager.ts`** — `rangeFactor(spell)` 접근자 추가(EnhancementLogic 위임).
- **`components/EnemyController.ts`** — `spawnId: number` 필드 + 모듈 단조 카운터, `reset()`에서 부여. dedup용 getter 노출.
- **`components/Projectile.ts`** — `init` 시그니처에 명중 효과 종류·폭발 반경·공유 dedup 집합 추가. 명중 시 폭발이면 `selectExplosionHits`로 범위 내 적에 피해 + 집합 등록 후 소멸, 단일이면 기존 경로. 폭발 VFX 트리거.
- **`components/SpellCaster.ts`** — 시전마다 `Set<number>` 생성, 유효 폭발 반경(`기본 × rangeFactor`) 계산, `_spawnShot`/`init`에 명중 효과·반경·집합 전달.
- **`game/assets/resources/spells.json`** — 파이어볼에 명중 효과=폭발, 폭발 반경(placeholder) 추가.
- **`game/assets/resources/i18n/ko.json`·`en.json`** — `upgrade.range` 키 추가.

> 신규 `.ts`·`.json`의 `.meta`는 AI가 만들지 않는다(에셋 `.meta` 규칙). 7단계 Cocos 테스트에서 생성, 8단계에서 커밋.

---

## 6. 테스트 계획 (TDD — RED 먼저)

피처 테스트: `tests/logic/MagicExplosion.test.ts` (피처명 PascalCase — `wf ready-impl` RED 게이트 통과 요건).

1. **반경 판정** — 중심 반경 안 적만 고른다. 경계 밖 적·빈 목록·반경 0 처리.
2. **적 몸 겹침** — `radius + enemy.collisionRadius` 기준으로 몸이 겹친 적이 잡힌다.
3. **dedup(시전 단위)** — 같은 집합으로 두 번 호출 시 두 번째는 이미 맞은 적을 건너뛴다. 고른 적의 id가 집합에 등록된다.
4. **유효 폭발 반경** — `기본 × factor(Range)`. 개별·분류 `Range` 레벨을 올리면 곡선 곱으로 반경이 커진다. `factor(Range)`가 발사체 수 assert에 걸리지 않음 확인.
5. **범위 카드 게이트** — 폭발 반경을 가진 마법(파이어볼)은 개별 `Range` 카드가 생성되고, 없는 마법(아이스 미사일 등)은 생성되지 않는다. `Range` 레벨 4면 제외. 화염 분류 카드에 `Range` 포함 / 적격 마법 없는 분류는 제외.

수동 QA(7단계, `docs/qa/magic-explosion-test.md`에 작성): 파이어볼이 명중 지점에서 폭발하며 범위 내 다중 적을 한 번에 타격하는지, 빗나가면 폭발하지 않는지, 발사체 수 강화 시 겹친 폭발이 한 적을 1회만 때리는지, 범위 강화 카드가 폭발 반경을 키우는지, 폭발 VFX 표시.

> **폭발 다중 타격 검증용 밀도 — 임시(비커밋):** 폭발이 군집을 한 번에 때리는 걸 보려면 적이 빽빽해야 한다. 7단계 테스트 동안만 Cocos 인스펙터에서 `EnemySpawner`의 `maxEnemies`를 크게(예 60)·`spawnInterval`을 짧게(예 0.3) 잡아 군집을 만든다. **이 값은 커밋하지 않고 테스트 후 원복한다.** 동시 적 수 상한 자체의 제거와 대량 적 성능은 별도 슬라이스(백로그 G1)다.

---

## 7. 리스크 / 엣지 케이스

- **공유 집합 수명·풀링** — 발사체는 풀 재사용되므로 `init`마다 dedup 집합 참조를 새로 받아야 한다(이전 시전 집합 잔류 금지). `init`이 매 acquire마다 새 집합을 주입하므로 안전.
- **순회 중 배열 변경** — 폭발이 여러 적을 죽이면 `GameManager.enemies`가 순회 중 줄어든다. 기존 `Projectile._checkEnemyHit`처럼 스냅샷을 떠 순수 함수에 넘긴다.
- **성능** — 폭발은 활성 적 수에 비례(O(적)). 발사체당 1회로, 기존 발사체 충돌 검사와 같은 비용 등급이라 새 위험 없음.
- **빗나간 발사체** — 화면 밖 소멸 경로는 폭발하지 않는다(명중 경로만 폭발).

---

## 8. 작업 순서

1. (3단계) `docs/qa/magic-explosion-test.md` + `tests/logic/MagicExplosion.test.ts`(RED) 작성 → `wf ready-impl`.
2. (5단계) `ExplosionLogic` → 데이터·강화 게이트 → 컴포넌트 배선 → i18n 키 순으로 GREEN.
3. (6단계) 전체 스위트 GREEN → `/cso` → 타입 → lint → 커밋 → 코드리뷰 → 검증.
4. (7단계) 사용자 Cocos 테스트(폭발 VFX 노드·`@property` 연결, 인게임 확인) + 신규 `.meta` 생성.
