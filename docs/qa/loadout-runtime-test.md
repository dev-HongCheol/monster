# QA: loadout-runtime (로드아웃 런타임 배선)

> **브랜치:** feat/loadout-runtime
> **작성일:** 2026-06-01
> **관련 기획:** [마법 시스템 — 마법사](../planning/magic-system-mage.md) § 4·§ 5
> **관련 플랜:** [2026-06-01-loadout-runtime-plan](../development/sessions/2026-06-01-loadout-runtime-plan.md)
> **성격:** 순수 로직(쿨다운 스케줄러) + Cocos 런타임 배선(SpellCaster 컴포넌트). **씬/프리팹 에디터 작업 있음.**

---

## 0. 범위

- `logic/FireSchedulerLogic.ts`: 마법별 쿨다운 타이머 순수 로직 (신규)
- `components/SpellCaster.ts`: `LoadoutLogic` + `FireSchedulerLogic`를 소유하고 보유 마법 전부를 각자 쿨다운으로 자동 발사하는 컴포넌트 (신규)
- `components/PlayerController.ts`: 발사 책임 제거 → 이동/입력/HP만 (수정)
- `resources/data/spells.json`: `ice_missile`, `lightning_bolt`(tier1) 추가 (수정)
- `tests/logic/LoadoutRuntime.test.ts`: `FireSchedulerLogic` 단위 테스트 (신규)

범위 밖(후속 슬라이스): 카드로 마법 획득(`addSpell` 배선)·시작 카드 패널, 마법 패턴(AOE/호밍/체인/메테오), 개별/분류 강화 엔진, 16종 전체 카탈로그, 마법별 비주얼.

---

## 1. Impact Map

| 변경 파일 | 변경 내용 | 회귀 확인 범위 |
|---|---|---|
| `logic/FireSchedulerLogic.ts` | 신규 순수 클래스 | 신규 — 단위 테스트로 전부 커버 |
| `components/SpellCaster.ts` | 신규 컴포넌트. 발사·조준·쿨다운 담당 | 발사 동작 전반. 단일 마법 시 기존 파이어볼 동작과 동일해야 함 |
| `components/PlayerController.ts` | `_updateAttack`/`_findNearestEnemy`/`_shoot`/`activeSpellId`/`bulletPrefab`/`bulletParent`/`_attackTimer`/`Projectile` import 제거 | **이동·입력·HP 게이팅은 변화 없음.** 발사만 SpellCaster로 이전 |
| `resources/data/spells.json` | 마법 2종 추가(기존 fireball 불변) | `DataManager` 로드 시 JSON ↔ `ISpellData` 형상 일치. `getSpell('ice_missile')`·`getSpell('lightning_bolt')` 정상 반환 |

---

## 2. 씬/프리팹 변경 사항

기존 `main.scene`의 **Player 노드**에 `SpellCaster` 컴포넌트를 **추가**한다. 노드 자체(Position/Size) 변경은 없다.

| 노드 | 변경 | 비고 |
|---|---|---|
| `Player` | `SpellCaster` 컴포넌트 추가 | 기존 `PlayerController`와 같은 노드에 부착 (발사 기준 위치 = 플레이어 위치) |

> 신규 발사체 프리팹·이펙트 추가 없음. 기존 bullet 프리팹을 그대로 재사용.

## 3. 에디터 연결 체크리스트

발사 관련 `@property` 연결을 `PlayerController` → `SpellCaster`로 **이전**한다.

| 컴포넌트 | 프로퍼티 | 연결 대상 | 상태 |
|---|---|---|---|
| `SpellCaster` | `bulletPrefab` | (기존 PlayerController에 연결돼 있던) bullet 프리팹 | ❌ |
| `SpellCaster` | `bulletParent` | (기존 PlayerController에 연결돼 있던) 발사체 부모 노드 | ❌ |
| `SpellCaster` | `startingSpellIds` | 시작 마법 id 배열. 다중 발사 확인을 위해 `["fireball","ice_missile","lightning_bolt"]` 권장 | ❌ |
| `PlayerController` | ~~`bulletPrefab`~~ | **제거됨** — 더 이상 존재하지 않는 프로퍼티 | — |
| `PlayerController` | ~~`bulletParent`~~ | **제거됨** | — |
| `PlayerController` | ~~`activeSpellId`~~ | **제거됨** | — |

> ⚠️ `PlayerController`에서 프로퍼티가 사라지므로, 기존에 연결돼 있던 값은 자동 소실된다. 반드시 `SpellCaster` 쪽에 다시 연결할 것.

---

## 4. 자동 테스트로 검증 (LoadoutRuntime.test.ts)

`FireSchedulerLogic`의 쿨다운 스케줄링은 단위 테스트로 전부 커버한다.

검증 동작 (플랜 § 3·§ 6 근거):
- [ ] 신규 마법은 첫 `tick` 후 `isReady === true` (즉시 발사 가능)
- [ ] 미등록 마법 `isReady === false` (안전한 기본값)
- [ ] `consume(id, cd)` 후 쿨다운 경과 전까지 `isReady === false`
- [ ] `consume` 후 누적 `tick`이 cd를 넘기면 다시 `isReady === true`
- [ ] 여러 마법 타이머 독립 (한쪽 consume이 다른 쪽에 영향 없음)
- [ ] 로드아웃에서 빠진 마법(`activeIds` 제외) 타이머 정리 → 재추가 시 즉시 발사 가능
- [ ] `consume` 없이 `tick`만 누적되면 쿨다운 미소모 (타깃 없을 때 적 등장 즉시 발사)

## 5. 수동 테스트 체크리스트 (인게임 — 에디터 세팅 후)

코드로 검증 불가한 런타임 동작만 포함한다.

- [ ] `startingSpellIds = ["fireball"]` 일 때 기존과 동일하게 파이어볼 단일 자동 발사 (회귀)
- [ ] `startingSpellIds = ["fireball","ice_missile","lightning_bolt"]` 일 때 **세 마법이 각자 다른 주기로 동시에** 가장 가까운 적을 향해 발사됨
- [ ] 라이트닝 볼트(쿨다운 0.35)가 파이어볼(0.5)·아이스 미사일(0.7)보다 눈에 띄게 자주 발사됨
- [ ] 화면에 적이 없을 때는 발사하지 않고, 적이 등장하면 즉시 발사 시작
- [ ] 카드로 `cooldownMult` 강화를 받으면 모든 마법의 발사 간격이 함께 짧아짐 (전역 강화 유지 확인)
- [ ] 플레이어 이동(WASD/방향키)·HP·웨이브 클리어 흐름이 기존과 동일하게 동작 (PlayerController 회귀)
