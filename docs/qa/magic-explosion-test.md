# QA — 마법 효과 레이어 S1 (Explosion + 파이어볼 AoE화)

> **브랜치:** feat/magic-explosion
> **슬라이스:** 마법 효과 레이어 S1 (`magic-system-mage.md` §12.2)
> **계획 문서:** [2026-06-16-magic-explosion-plan.md](../development/sessions/2026-06-16-magic-explosion-plan.md)
> **닫는 백로그:** A1(일부 — Explosion·dedup), A3(범위 — 폭발 반경)

---

## 1. Impact Map (회귀 테스트 기준)

| 변경 파일 | 변경 내용 | 회귀 확인 범위 |
|---|---|---|
| `logic/ExplosionLogic.ts` (신규) | `selectExplosionHits` 순수 함수 | 단위 테스트로 커버 |
| `logic/EnhancementLogic.ts` | `buildUpgradeCards`에 Range 게이트 추가 | **기존 카드 생성 회귀** — 데미지/쿨다운/발사체 수 카드 수가 변하면 안 됨. `SpellEnhancementFramework.test.ts`의 개별 6·분류 9 카운트가 유지돼야 함(기존 fixture는 `explosionRadius` 없음 → Range 카드 0). |
| `systems/DeckManager.ts` | `rangeFactor(spell)` 접근자 추가 | 기존 damage/cooldown/projectile 접근자 무영향 |
| `data/GameTypes.ts` | `ISpellData`에 `hitEffect?`·`explosionRadius?` 추가 | 옵션 필드라 기존 spells.json·타 마법 무영향 |
| `components/Projectile.ts` | 명중 시 폭발 분기 추가(공유 dedup 집합·반경) | **단일 명중 마법 회귀** — 폭발 아닌 마법은 기존처럼 적 1마리 타격 후 소멸해야 함 |
| `components/SpellCaster.ts` | 시전당 dedup 집합 생성·유효 반경 계산·init 전달 | 기존 발사·발사체 수·데미지 배율 무영향 |
| `components/EnemyController.ts` | `spawnId` 필드 + reset마다 증가 | 기존 스폰·풀 재사용·사망 연출 무영향 |
| `resources/spells.json` | 파이어볼에 `hitEffect=explosion`·`explosionRadius` | 다른 마법 데이터 무영향 |
| `resources/i18n/ko.json`·`en.json` | `upgrade.range` 키 추가 | **i18n 키 정합 가드** — 키 누락 시 가드 RED. 추가 후 GREEN. |

---

## 2. 자동 테스트로 검증 (`tests/logic/MagicExplosion.test.ts`)

> **통과 근거(2026-06-16 GREEN):** 피처 테스트 14/14 + 전체 스위트 182/182 통과(`pnpm wf start-verification` GREEN 게이트). 통과 커밋 SHA는 구현 커밋(`feat/magic-explosion`).

- [x] `selectExplosionHits` — 중심 반경 안 적만 선택 / 경계 밖 제외
- [x] `selectExplosionHits` — 적 충돌 반경 겹침(`radius + collisionRadius`) 판정
- [x] `selectExplosionHits` — 빈 목록·반경 0 엣지
- [x] `selectExplosionHits` — 시전 단위 dedup: alreadyHit 제외 + id 등록 + 두 번째 폭발 빈 결과
- [x] `selectExplosionHits` — id 안정 식별자(같은 좌표·다른 id는 별개)
- [x] `buildUpgradeCards` — 폭발 반경 마법만 개별 Range 카드 생성
- [x] `buildUpgradeCards` — 반경 없는 마법은 Range 카드 없음
- [x] `buildUpgradeCards` — 적격 마법 있는 분류만 분류 Range 카드
- [x] `buildUpgradeCards` — Range 레벨 4면 제외
- [x] `buildUpgradeCards` — Range 카드 키/params(`upgrade.range`) + `factor(Range)` 재사용

> **코드로 검증 불가(수동 항목):** 발사체 비행·명중 트리거, 폭발 VFX 표시, 인게임 다중 타격 체감 — 아래 §5.

---

## 3. 씬/프리팹 변경 사항

| 노드/프리팹 | 변경 | 비고 |
|---|---|---|
| **폭발 VFX 프리팹 (신규)** | 명중 지점에 짧게 표시되는 placeholder 폭발 효과(확장+페이드 스프라이트 권장). 풀 재사용. | 구현 단계에서 방식 확정. 최종 아트는 7-9주차. |
| `EnemySpawner` 노드 (임시·비커밋) | 폭발 다중 타격 검증용으로 `maxEnemies`↑·`spawnInterval`↓ | 아래 §4 참고. **테스트 후 원복, 커밋 금지.** |

> 폭발 VFX의 정확한 트리거 경로(발사체가 VFX 스폰 콜백을 받는지, 전용 이펙트 노드인지)는 구현에서 확정한다. 발사체 풀과 동일 패턴(소유자가 prefab/parent `@property` 보유)을 권장.

---

## 4. 폭발 검증용 적 밀도 — 임시(비커밋)

폭발이 군집을 한 번에 때리는 걸 보려면 적이 빽빽해야 한다. **이 단계의 인스펙터 값은 커밋하지 않고 테스트 후 원복한다.** 동시 적 수 상한 제거 자체와 대량 적 성능은 별도 슬라이스(백로그 G1).

| `EnemySpawner` 프로퍼티 | 평상시(씬 커밋값) | 테스트용 임시 |
|---|---|---|
| `maxEnemies` | 10 | 60 (군집 형성) |
| `spawnInterval` | 2 | 0.3 (빠르게 채움) |

---

## 5. 에디터 연결 체크리스트

| 컴포넌트 | `@property` | 연결 대상 | 상태 |
|---|---|---|---|
| 폭발 VFX 소유 컴포넌트(구현서 확정) | VFX 프리팹 | 신규 폭발 VFX 프리팹 | ❌ |
| 폭발 VFX 소유 컴포넌트 | VFX 부모 노드 | Canvas(또는 발사체 부모) | ❌ |
| `EnemySpawner`(임시) | `maxEnemies` | 60 | ❌ |
| `EnemySpawner`(임시) | `spawnInterval` | 0.3 | ❌ |

> 구체 `@property` 이름은 구현 단계에서 폭발 VFX 트리거 방식 확정 후 갱신한다.

---

## 6. 수동 테스트 체크리스트 (인게임)

- [ ] 파이어볼이 적에 명중하면 **명중 지점에서 폭발**하고 발사체는 소멸한다.
- [ ] 폭발 반경 안 **여러 적이 한 번에** 피해를 받는다(군집에 던졌을 때).
- [ ] 직격당한 적도 **추가 직격 없이 폭발 1회**만 받는다(§9.3 — 직격 보너스 없음 체감: 단일 적도 폭발 피해만).
- [ ] 빗나가 아무 적에도 안 닿으면 **폭발 없이** 화면 밖에서 사라진다.
- [ ] 발사체 수 강화(부채꼴 N발) 시, 겹친 폭발이 한 적을 **1회만** 때린다(과도하게 녹지 않음 — 커버리지 이득).
- [ ] 폭발마다 **VFX가 명중 지점에** 표시된다.
- [ ] 범위 강화 카드를 고르면 **폭발 반경이 눈에 띄게 커진다**.
- [ ] 강화 카드 패널에 **파이어볼 범위 카드**·**화염 분류 범위 카드**가 등장하고, 라벨이 "범위"로 표시된다(i18n `upgrade.range`).
- [ ] 폭발이 다수 적을 죽여도(임시 밀도 60) 명백한 프레임 드랍/오류 없이 동작한다(성능 정밀 검증은 G1 별도).
