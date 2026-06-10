# QA: 발사체 수 강화 옵션 (projectile-count)

> - **브랜치:** feat/projectile-count
> - **계획:** [2026-06-10-projectile-count-plan.md](../development/sessions/2026-06-10-projectile-count-plan.md)
> - **요약:** 레벨업 카드로 마법별 발사체 수 +1(개별·분류 트랙, 전역 없음). 발사체당 데미지 페널티 `×(1−0.10×증가수)`. 자기중심 AOE 마법은 §8 게이트로 제외.

---

## 1. Impact Map (회귀 기준)

| 변경 파일 | 확인 범위 |
|-----------|----------|
| `logic/EnhancementLogic.ts` | 발사체 보너스·페널티·effective count·§8 게이트·factor() 가드·디버그행. **데미지/쿨다운 카드·배율 불변 회귀.** |
| `systems/DeckManager.ts` | `effectiveProjectileCount`·`projectilePenaltyFactor` 위임. applyCard·기존 getter 불변. |
| `components/SpellCaster.ts` | 발사 루프 유효 count·damage×penalty. **보너스 0이면 기존 발사와 동일.** |
| `data/GameTypes.ts` | `ISpellData.allowsProjectileCount?` 추가(optional). 기존 직렬화·필드 불변. |
| `resources/i18n/{ko,en}.json` | `upgrade.projectile_count` 키 추가. 기존 키·카드 표시 불변. |
| `ui/CardSelectPanel.ts` | (선택) 디버그 로그에 발사체 수. 기존 패시브/강화 로그 불변. |

---

## 2. 씬/프리팹 변경 사항

**없음.** 신규 노드·프리팹 없음. 발사 배선은 기존 `SpellCaster`(Player 노드) 내부 로직만 수정한다.

## 3. 에디터 연결 체크리스트

**없음.** 신규 `@property` 없음. 기존 `SpellCaster.bulletPrefab`/`bulletParent`/`startingSpellIds` 연결을 그대로 사용한다(에디터 작업 0).

---

## 4. 자동 테스트로 검증 (순수 로직 — `tests/logic/ProjectileCount.test.ts`)

> **GREEN 통과:** 피처 테스트 21/21 + 전체 스위트 154/154. 통과 커밋 `916baa4`(코드리뷰 수정 포함, 누수 차단 테스트 +1).

- [x] `projectileBonus` 초기 0, 개별+분류 가산 누적, 각 트랙 cap 4(최대 8).
- [x] `effectiveProjectileCount` = base + bonus (예: base 1 + bonus 2 = 3).
- [x] `penaltyFor(bonus)`: 0→1.0, 1→0.9, 2→0.8, 4→0.6, 8→0.2; 범위 밖 큰 bonus → 하한 `MIN` 클램프.
- [x] `projectilePenaltyFactor(spell)` = penaltyFor(projectileBonus(spell)).
- [x] `buildUpgradeCards`: ProjectileCount 카드가 개별·분류로 생성, **전역 없음**, 보조 분류 제외, maxed(레벨4) 제외.
- [x] §8 게이트: `allowsProjectileCount===false` 마법은 개별 발사체 카드 미생성.
- [x] `debugSnapshot`: 발사체 보너스·페널티·유효 발사체 수 필드가 채워진다.
- [x] 회귀: 데미지/쿨다운 factor 불변(발사체 추가가 기존 곡선·전역에 영향 없음). + `SpellEnhancementFramework` 카드 수 테스트를 3옵션 기준(개별 6·분류 9)으로 갱신.

---

## 5. 수동 테스트 체크리스트 (인게임 — 코드로 검증 불가)

> 선행: `HIDE_CATEGORY_UPGRADE_CARDS = false` 복원 확인(분류 강화 카드가 다시 노출돼야 발사체 분류 카드 QA 가능).

### 사전: DEV 콘솔 관찰
- [ ] 카드 픽 직후 DEV 콘솔에 발사체 수 디버그(유효 발사체 수·페널티·실효 데미지)가 출력된다.

### 발사체 수 강화 (개별 트랙)
- [ ] "파이어볼 발사체 수+" 류 개별 강화 카드가 드로우 풀에 등장한다.
- [ ] 픽 직후 파이어볼이 **부채꼴로 여러 발** 발사된다(1발 → 2발 → 3발…).
- [ ] 여러 장 누적 시 발사체가 더 많아지고 부채꼴이 촘촘해진다(cap 4까지).

### 발사체 수 강화 (분류 트랙)
- [ ] "화염 분류 발사체 수+" 류 분류 강화 카드가 등장하고, 같은 분류의 모든 마법에 적용된다.
- [ ] 개별 + 분류를 함께 뽑으면 발사체 수가 두 트랙 합으로 늘어난다(최대 base+8).

### 발사체당 데미지 페널티 (트레이드오프)
- [ ] 발사체를 늘린 뒤, **단일 적**에게는 1발만 명중해 처치 시간이 더 걸린다(발당 데미지 감소 체감).
- [ ] **군집**에서는 부채꼴이 더 많은 적을 동시에 때려 전체 처리량이 늘어난다(커버리지 이득).

### i18n
- [ ] `upgrade.projectile_count` 카드 라벨이 한국어로 올바르게 표시된다(raw 키 노출 없음).
- [ ] 언어 en 전환 시 영어 라벨로 표시된다.

### §8 적격 게이트 (현 콘텐츠 한정 회귀)
- [ ] 현재 3종(fireball·ice_missile·lightning_bolt)은 전부 발사체 카드가 정상 등장한다(전부 ✅이므로 게이트가 막지 않음).

### 회귀 (기존 강화)
- [ ] 데미지·쿨다운 강화 카드가 기존대로 동작한다(발사체 추가가 깨지 않음).
- [ ] 발사체 보너스 0 상태(아무 발사체 카드도 안 뽑음)에서 발사가 기존과 동일하다(직선 1발, 데미지 동일).
