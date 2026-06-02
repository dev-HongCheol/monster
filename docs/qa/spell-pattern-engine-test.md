# QA: 마법 패턴 엔진 (Spell Pattern Engine)

- **브랜치:** feat/spell-pattern-engine
- **설계 문서:** [2026-06-02-spell-pattern-engine-plan.md](../development/sessions/2026-06-02-spell-pattern-engine-plan.md)
- **자동 테스트로 검증:** ✅ `tests/logic/SpellPatternEngine.test.ts` 피처 11/11 + 전체 스위트 71/71 통과 (통과 커밋 `e9ef5b0`)

---

## 개요

`logic/SpellPatternLogic.buildFirePlan`(순수 함수)이 마법별 발사 형태(geometry)를 결정한다. 이번 슬라이스 패턴은 `directional` 하나 — 유효 발사체 수가 1이면 직선, N이면 부채꼴. `SpellCaster`는 plan을 받아 `Projectile`을 스폰만 한다.

---

## Impact Map (회귀 테스트 기준)

| 변경 파일 | 확인 범위 |
|---|---|
| `data/GameTypes.ts` | `SpellPattern` enum 추가, `ISpellData.pattern`/`spreadAngleDeg` 추가. 기존 `ISpellData` 소비처(DataManager, SpellCaster, DeckLogic) 타입 컴파일 |
| `logic/SpellPatternLogic.ts` (신규) | 순수 함수 — vitest 단독 검증 |
| `components/SpellCaster.ts` | 기존 단발 발사 → fire-plan 실행. **인게임 발사 회귀**(가장 중요) |
| `resources/data/spells.json` | 3종에 `pattern:"directional"` 추가. DataManager 로드 정상 |

---

## 씬/프리팹 변경 사항

**없음.** 신규 노드·프리팹·`@property` 추가 없음. `SpellCaster`는 이미 씬에 존재하며 `bulletPrefab`/`bulletParent`/`startingSpellIds`가 연결돼 있다(이전 슬라이스에서 배선됨).

---

## 에디터 연결 체크리스트

기존 연결이 유지되는지만 확인한다(신규 없음).

- [x] `SpellCaster.bulletPrefab` → 발사체 프리팹 연결 유지
- [x] `SpellCaster.bulletParent` → 발사체 부모 노드 연결 유지
- [x] `SpellCaster.startingSpellIds` → `['fireball']`(기본) 유지

---

## 수동 테스트 체크리스트

코드(vitest)로 검증 불가한 인게임 동작만.

### 회귀 (필수)
- [x] 게임 시작 → 적 스폰 시 파이어볼이 **가장 가까운 적을 향해 직선 1발** 발사된다(종전과 동일).
- [x] 적 처치/이동 시 다음 발사가 **그 시점의 최근접 적**을 향한다(타겟 락온 아님).
- [x] 빠른 적이 발사체 경로를 가로지르면 **그 적이 피격**된다(직선 비호밍, 경로상 충돌).
- [x] 발사체가 화면 밖으로 나가면 제거된다(기존 out-of-bounds 동작 유지).
- [x] 분류 색 틴트 유지(화염=빨강 등).

### 부채꼴(직접 검증은 자동 테스트)
- [x] 부채꼴(count≥2) 동작은 라이브 소비자(발사체 수 강화 / 티어2+ 다발 마법)가 없으므로 **인게임 수동 확인 대상 아님** — `SpellPatternEngine.test.ts`의 count=2/3 케이스로 geometry 검증. 강화 슬라이스 도입 시 이 문서에 수동 항목 추가.

### 성능 참고 (이번 슬라이스 회귀 아님)
- [x] 객체 풀링 미도입 상태 — 발사체 churn은 이전과 동일(single). 부채꼴 도입 후 풀링 슬라이스에서 재점검(설계 E4 / TODOS).
