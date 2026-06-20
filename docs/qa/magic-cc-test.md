# magic-cc QA 테스트 — CC 단일 슬롯 + 라이트닝 볼트 확률 정지

> **브랜치:** feat/magic-cc
> **슬라이스:** 마법 효과 레이어 magic-S2 (CC 정지)
> **계획 문서:** `../development/sessions/2026-06-20-magic-cc-plan.md`

라이트닝 볼트가 명중 시 확률로 적을 정지(이동만 멈춤, 접촉 피해 유지)시키고, 지속시간 강화가 정지 시간을 늘리는 슬라이스다. 본체는 순수 로직인 CC 단일 슬롯 해석기다.

---

## 자동 테스트로 검증

> **GREEN 통과:** 피처 테스트 `MagicCc` 22/22 + 전체 스위트 214/214 (2026-06-20, feat/magic-cc, 코드 리뷰 수정 반영 후). biome lint·format 깨끗, TS 진단 0(편집 파일 전체). 통과 커밋 SHA는 구현 커밋(아래 11단계에서 기재).

`tests/logic/MagicCc.test.ts` — CC 해석기(`logic/StatusEffectLogic.ts`)의 순수 동작:

- [x] `applyControl` — 빈 슬롯 적용, 강도는 더 센 쪽으로만 상승, 더 약한 강도는 강도를 안 내림, 지속은 둘 중 더 긴 값으로 갱신, 입력 불변(순수)
- [x] `tickControl` — 지속 감소, 0 이하에서 슬롯 비움(강도 None), 빈 슬롯 멱등
- [x] `moveSpeedFactor` — None=1, Slow=1 미만, Stun·Freeze=0
- [x] `dealsContactDamage` — None·Slow·Stun 유지, Freeze만 차단
- [x] `shouldApplyControl` — 난수<확률 발동, 같거나 크면 미발동, 확률 0이면 항상 미발동

`tests/logic/MagicCc.test.ts` — 지속(Duration) 강화 게이트(`logic/EnhancementLogic.ts` A3, 코드 리뷰 #1로 추가):

- [x] CC(`onHitStatus`) 보유 마법만 개별·분류 Duration 카드 생성, CC 없는 마법(폭발만 가진 것 포함)은 미생성, Duration maxed면 제외

---

## Impact Map (변경 파일별 확인 범위)

| 파일 | 변경 | 회귀 확인 |
|------|------|-----------|
| `logic/StatusEffectLogic.ts` (신규) | CC 해석기·확률 판정 (순수) | 단위 테스트 |
| `data/GameTypes.ts` | `ISpellData.onHitStatus` 필드 | 기존 마법 로드(파이어볼·아이스 미사일) 정상 |
| `resources/data/spells.json` | `lightning_bolt`에 `onHitStatus` | 세 시작 마법 모두 발사 정상 |
| `components/Projectile.ts` | 단일 명중 경로에서 확률 정지 적용 | 파이어볼 폭발·단일 명중 기존 동작 유지 |
| `components/SpellCaster.ts` | 상태이상 설정 빌드 + 유효 지속 계산 | 폭발 빌드·발사·풀 재사용 정상 |
| `components/EnemyController.ts` | 컨트롤 상태·이동/접촉 분기·CC 틴트 | 피격 플래시·사망 페이드 연출 안 깨짐 |
| `logic/EnhancementLogic.ts` | `isDurationCapable` + `Duration` 카드 배선 | 기존 데미지·쿨다운·발사체·범위 카드 정상 |
| `systems/DeckManager.ts` | `durationFactor` 래퍼 | 기존 배율 래퍼 정상 |
| `resources/i18n/en.json`·`ko.json` | `upgrade.duration` 키 | i18n 키 정합 가드 통과 |

---

## 씬/프리팹 변경 사항

이 슬라이스는 **새 노드·프리팹이 필요 없다.** 정지 틴트는 기존 적 스프라이트 색에 적용하고, 정지 동작은 데이터(`spells.json`) + 순수 로직 + 기존 컴포넌트로 처리한다. 폭발 VFX처럼 새 프리팹을 연결할 필요가 없다.

---

## 에디터 연결 체크리스트

`@property` 신규 연결은 없다. 다만 이 슬라이스의 인게임 검증을 위해 **시작 마법을 임시로 바꾼다**(계획 §7).

- [ ] **(테스트 전용)** `Player` 노드의 `SpellCaster` 컴포넌트 → `startingSpellIds`를 `['lightning_bolt']`로 설정 (코드 기본값을 임시 변경했다면 인스펙터에 빈 값/기본 그대로 두어 코드값이 먹게 한다. 인스펙터에 이미 값이 있으면 인스펙터에서 바꾼다 — 한 곳으로 통일)
- [ ] (선택) `EnemyController` 인스펙터에서 적을 1~2마리로 줄이거나 HP를 올려, 정지가 풀리기 전에 적이 죽지 않게 해 관찰을 쉽게 한다 (비커밋)

---

## 수동 테스트 체크리스트

코드로 검증 불가한 인게임 동작만:

- [ ] 게임 시작 시 라이트닝 볼트가 자동 발사된다(임시 시작 마법 적용 확인)
- [ ] 라이트닝 볼트 명중 시 **가끔**(확률) 적이 **그 자리에 멈춘다**(정지 발동)
- [ ] 정지된 적에 **정지 틴트**가 보인다(번개 톤 placeholder)
- [ ] 정지된 적이 플레이어에 닿아 있으면 **접촉 피해가 계속 들어온다**(정지는 이동만 멈춤 — §9.4)
- [ ] 정지 지속이 끝나면 적이 **다시 플레이어를 추격**한다
- [ ] 정지 틴트가 **피격 플래시·사망 페이드 연출을 깨지 않는다**(우선순위 사망>플래시>CC>기본 — 명중 순간 흰 플래시, 죽을 때 팝·페이드가 정상)
- [ ] 레벨업 카드에 라이트닝 볼트 **지속시간 강화 카드**가 등장한다(개별/분류)
- [ ] 지속시간 강화를 픽하면 이후 정지가 **더 길게** 유지된다
- [ ] 다른 시작 마법(파이어볼·아이스 미사일)으로 바꿔도 정지 미발동·기존 동작 정상(회귀)
- [ ] **머지 전 복원:** `startingSpellIds`를 `['fireball']`로 되돌렸다(테스트 전용 변경 — 계획 §7)
