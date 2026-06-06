# QA: 객체 풀링 — 발사체 (object-pooling)

> - **브랜치:** feat/object-pooling
> - **계획:** [2026-06-06-object-pooling-plan.md](../development/sessions/2026-06-06-object-pooling-plan.md)
> - **범위:** 발사체 풀링(SpellCaster → PoolManager → Projectile). 적·XP 풀링은 후속 슬라이스.

---

## 1. Impact Map (회귀 테스트 기준)

| 변경 파일 | 확인 범위 |
|-----------|-----------|
| `logic/ObjectPoolLogic.ts` (신규) | 자동 테스트(acquire/release/cap/counter) |
| `components/PoolManager.ts` (신규) | 노드 재사용·반환·active 토글·cap 폐기 |
| `components/Projectile.ts` (수정) | **명중 데미지, 화면밖 제거, 발사체 수명, 이중반환 방어** |
| `components/SpellCaster.ts` (수정) | **자동 발사, 부채꼴, 다중 슬롯, 분류색, 데미지 배율** |

> 생성·삭제가 잦은 다른 곳(`EnemySpawner`/`XPItem`)은 이번 변경 대상이 아니다 — 동작 회귀만 확인한다.

---

## 2. 씬/프리팹 변경 사항

**없음.** PoolManager는 cc Component가 아니라 평범한 TS 클래스이며, `SpellCaster`가 기존에 보유한 `@property`(`bulletPrefab`/`bulletParent`)로 생성한다. 따라서 **새로 추가·수정할 노드·컴포넌트·프리팹이 없다.**

---

## 3. 에디터 연결 체크리스트

**새로 연결할 항목은 없다.** 기존 연결이 그대로 유효한지만 확인한다:

| 컴포넌트 | @property | 연결 대상 | 상태 |
|----------|-----------|-----------|------|
| `SpellCaster` | `bulletPrefab` | 발사체 프리팹 | (기존 유지) ✅/❌ |
| `SpellCaster` | `bulletParent` | 발사체 부모 노드 | (기존 유지) ✅/❌ |

> 이 둘이 비어 있으면 풀링 이전에도 발사가 되지 않았다(코드 동작은 동일하다). 풀링이 새로 요구하는 연결은 없다.

---

## 4. 자동 테스트로 검증 (`tests/logic/ObjectPooling.test.ts`)

> **통과 근거:** 피처 테스트 9/9 + 전체 스위트 128/128 GREEN (커밋 44d024c).

- [x] 신규 풀: free/total/active가 모두 0이다
- [x] 빈 풀 acquire 시 create가 호출되고 total/active가 1씩 증가한다
- [x] release 시 free는 1, active는 0이 되고 반환값은 true다
- [x] 재사용: release 후 acquire하면 create를 다시 호출하지 않고 그 항목을 반환한다(total 불변)
- [x] 다중: acquire 3 / release 2 / acquire 2를 하면 재사용분만 반환하고 새로 생성하지 않는다
- [x] 보관 한도(maxFree): 한도 안이면 true로 보관하고, 한도를 넘긴 release는 false를 반환하며 total을 줄인다(활성 회계 유지)
- [x] 멱등: 같은 항목을 중복 release해도 free에 중복 적재되지 않는다(두 번째 호출은 no-op)

---

## 5. 수동 테스트 체크리스트 (코드로 검증 불가한 인게임 동작)

- [x] 발사체가 기존과 동일하게 발사·이동·명중·화면밖 제거된다(체감 차이 없음).
- [x] 적 명중 시 데미지가 정상 적용되고 발사체가 사라진다.
- [x] **다중 슬롯(주 검증):** `SpellCaster.startingSpellIds`를 3색 로드아웃(`["fireball","ice_missile","lightning_bolt"]`)으로 두면, 발사체가 슬롯마다 올바른 **분류색**(fire=주황빨강 / ice=하늘 / lightning=노랑)과 방향으로 나간다. 풀이 3색 노드를 섞어 재사용하므로, 색이나 방향이 이전 상태로 남아 있으면 곧바로 드러난다.
- [ ] ~~부채꼴(count≥2) 발사 시 발사체 수·방향·분류색 정확~~ → **현재 인게임 트리거 없음**: 모든 마법이 `projectileCount=1`이고 "발사체 수 +1" 강화가 아직 배선되지 않았다(엔진 `buildFirePlan`은 count≥2 부채꼴을 지원, #19). 부채꼴 회귀를 보려면 `spells.json`의 `projectileCount`를 임시로 `≥2`로 바꿔 좌우 대칭 N발과 동일 분류색을 확인한 뒤 되돌린다. (발사체 수 강화 슬라이스가 들어오면 정식 항목으로 만든다.)
- [x] **이전 상태가 남지 않음(핵심):** 수 분간 장시간 플레이해도 재사용된 발사체가 이전 방향·색·데미지를 끌고 나오지 않는다 — 색 섞임, 엉뚱한 방향, 데미지 이상이 없다.
- [x] 데미지 강화(per-spell/분류/전역)를 적용한 뒤에도 발사체 데미지에 회귀가 없다.
- [x] (선택) 프로파일러: 지속 발사 중 GC 스파이크와 프레임 드랍이 기존 대비 개선되거나 최소한 동등하다.

---

## 6. 기존 QA 문서와의 관계

기존 발사 관련 수동 항목(자동 발사·부채꼴)은 이 문서 §5가 풀링 관점에서 회귀 확인을 포함한다. 발사 거동 자체를 의도적으로 바꾼 부분은 없으며, 구현 방식만 instantiate에서 풀 재사용으로 교체했다.
