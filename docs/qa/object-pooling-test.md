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

> 다른 churn 소스(`EnemySpawner`/`XPItem`)는 이번 변경 대상 아님 — 동작 회귀만 확인.

---

## 2. 씬/프리팹 변경 사항

**없음.** PoolManager는 cc Component가 아니라 평범한 TS 클래스로, `SpellCaster`가 기존에 보유한 `@property`(`bulletPrefab`/`bulletParent`)로 생성한다. **새 노드·컴포넌트·프리팹 변경이 없다.**

---

## 3. 에디터 연결 체크리스트

**신규 연결 없음.** 기존 연결이 그대로 유효한지만 확인:

| 컴포넌트 | @property | 연결 대상 | 상태 |
|----------|-----------|-----------|------|
| `SpellCaster` | `bulletPrefab` | 발사체 프리팹 | (기존 유지) ✅/❌ |
| `SpellCaster` | `bulletParent` | 발사체 부모 노드 | (기존 유지) ✅/❌ |

> 이 둘이 비어 있으면 기존에도 발사가 안 됐다(코드 동작 동일). 풀링이 새로 요구하는 연결은 없음.

---

## 4. 자동 테스트로 검증 (`tests/logic/ObjectPooling.test.ts`)

> **통과 근거:** 피처 테스트 9/9 + 전체 스위트 128/128 GREEN (커밋 44d024c).

- [x] 신규 풀: free/total/active 모두 0
- [x] 빈 풀 acquire → create 호출, total/active 1 증가
- [x] release → free 1, active 0 (반환 true)
- [x] 재사용: release 후 acquire는 create 재호출 없이 그 항목 반환(total 불변)
- [x] 다중: acquire 3 / release 2 / acquire 2 시 재사용분만 반환, 신규 생성 없음
- [x] cap(maxFree): 한도 내 보관 true, 초과 release는 false + total 감소(활성 회계 유지)
- [x] 멱등: 같은 항목 중복 release → free 중복 적재 없음(두 번째 no-op)

---

## 5. 수동 테스트 체크리스트 (코드로 검증 불가한 인게임 동작)

- [ ] 발사체가 기존과 동일하게 발사·이동·명중·화면밖 제거된다(체감 차이 없음).
- [ ] 적 명중 시 데미지가 정상 적용되고 발사체가 사라진다.
- [ ] 부채꼴/다중 슬롯 발사 시 발사체 수·방향·**분류색**이 정확하다.
- [ ] **상태 잔류 없음(핵심):** 장시간(수 분) 플레이 후에도 재사용된 발사체가 이전 방향·색·데미지를 끌고 나오지 않는다 — 색 섞임, 엉뚱한 방향, 데미지 이상 없음.
- [ ] 데미지 강화(per-spell/분류/전역) 적용 후에도 발사체 데미지 회귀 없음.
- [ ] (선택) 프로파일러: 지속 발사 중 GC 스파이크/프레임 드랍이 기존 대비 개선 또는 최소한 동등.

---

## 6. 기존 QA 문서와의 관계

기존 발사 관련 수동 항목(자동 발사·부채꼴)은 본 문서의 §5가 풀링 관점에서 회귀 확인을 포함한다. 발사 거동 자체의 의도 변경은 없음(구현 방식만 instantiate→풀 재사용으로 교체).
