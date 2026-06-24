# QA — 마법 효과 레이어 S4b (Orbit + 인페르노)

> **브랜치:** feat/inferno
> **슬라이스:** 마법 효과 레이어 S4b — Orbit(궤도형 회전 발사체) 프리미티브 + 인페르노(화염 등급2) (`magic-system-mage.md` §12.2)
> **계획 문서:** [2026-06-24-inferno-plan.md](../development/sessions/2026-06-24-inferno-plan.md)
> **닫는 백로그:** A1(일부 — Orbit 축), A3(범위 = 오브 크기 / 지속시간 = 활성 수명)

---

## 1. Impact Map (회귀 테스트 기준)

| 변경 파일 | 변경 내용 | 회귀 확인 범위 |
|---|---|---|
| `data/GameTypes.ts` | `SpellPattern`에 `Orbit = 'orbit'` 추가 + `ISpellData`에 `orbitRadius?`·`rotationSpeedDeg?`·`rehitCooldownSec?`·`lifetimeSec?` 추가 | enum·옵셔널 필드 추가뿐 — 기존 `Directional`/`Nova` 무영향 |
| `logic/OrbitLogic.ts` | 신규 순수 로직 (회전·활성 수명·재타격 락아웃·링 반경) | 신규 파일 — 기존 로직 무영향 |
| `logic/SpellPatternLogic.ts` | `buildFirePlan`에 `case Orbit → []` | **발사체 패턴 회귀** — `SpellPatternEngine.test`의 directional·폴백(미지 pattern→directional)이 그대로 통과해야 함. 'orbit'만 빈 배열, 'bogus_pattern'은 여전히 directional 폴백 |
| `logic/EnhancementLogic.ts` | `isRangeCapable`에 `orbitRadius` OR + `isDurationCapable`에 `lifetimeSec` OR + JSDoc 예시에서 인페르노 제거 | **카드 적격 회귀** — 기존 폭발형(범위)·CC형(지속) 마법 적격이 변하면 안 됨. frost-nova·라이트닝볼트·아이스미사일 적격 그대로 |
| `components/SpellCaster.ts` | `update` 디스패치에 Orbit 분기(`consume` + `_castOrbit`) + `_advanceOrbits`·`_applyOrbHit`·`_reconcileOrbVfx`·`_positionOrbVfx`·`_releaseAllOrbVfx` + 오브 VFX 풀·맵 + `@property orbVfxPrefab` | **발사·노바 회귀** — 발사체 마법은 적 있을 때만 발사, 노바는 적 무관 시전. Orbit 분기가 둘을 깨지 않아야 함 |
| `systems/GameManager.ts` | 신규 헬퍼 `collectTargetsInRadius(cx, cy, r) → {targets, ctrls}` (F16 부분) | **동작 무변경 리팩터** — 헬퍼 추출만. 폭발·노바 명중 결과 동일 |
| `components/Projectile.ts` | `_detonate`의 인라인 수집 루프를 `collectTargetsInRadius` 호출로 교체 (F16 부분) | **동작 무변경** — `MagicExplosion.test` 폭발 명중 결과 그대로 |
| `resources/data/spells.json` | `inferno` 항목 추가 | **i18n 키 가드** — `spell.inferno.name` 누락 시 `I18nKeyGuard` RED. `MagicAddCard` 등 실데이터 의존 테스트는 inferno가 "마법 추가" 풀에 포함됨을 전제로 통과 |
| `resources/i18n/ko.json`·`en.json` | `spell.inferno.name` 키 추가 | i18n 키 정합 가드 — 키 추가 후 GREEN |

> **`spells.json`과 i18n 키는 같은 커밋에:** `I18nKeyGuard.test.ts`가 실 `spells.json`을 읽어 `spell.inferno.name` 누락 시 전체 스위트를 RED로 만든다. 데이터 추가와 ko/en 키 추가를 같은 커밋에 넣어야 GREEN을 지난다.

---

## 2. 자동 테스트로 검증

> **통과 근거(2026-06-24 GREEN):** 피처 테스트 24/24(`Inferno.test.ts` 7 + `OrbitLogic.test.ts` 17) + 전체 스위트 260/260 통과(`pnpm wf start-verification` GREEN 게이트). 통과 커밋 SHA는 구현 커밋(`feat/inferno`).

### `tests/logic/Inferno.test.ts` — 디스패치 계약 + 카드 적격(§3 매트릭스)

- [x] `buildFirePlan(orbit)` → 발사체 0발 (궤도라 발사체 경로 안 탐) — **RED 드라이버**
- [x] `buildFirePlan(orbit)` → count가 커도 0발 (발사체 수 무관)
- [x] 강화 카드 적격: 범위 ✅ (`orbitRadius` 보유로 적격) — **RED 드라이버**(`isRangeCapable` 확장 전엔 false)
- [x] 강화 카드 적격: 지속시간 ✅ (`lifetimeSec` 보유로 적격) — **RED 드라이버**(`isDurationCapable` 확장 전엔 false)
- [x] 강화 카드 적격: 발사체 수 ✅ (`allowsProjectileCount:true`)
- [x] 강화 카드 적격: 데미지·쿨다운 ✅
- [x] 강화 카드 적격: 5종 전부 등장 (인페르노 유일)

### `tests/logic/OrbitLogic.test.ts` — 순수 회전·수명·기하·락아웃

- [x] `orbPositions` — 오브 N개가 `360/N` 균등 배치 (count=2: 마주봄 / count=4: 십자)
- [x] `advance` 회전 — `rotationSpeedDeg × dt`만큼 각 전진 (위치로 검증), 360 wrap
- [x] `advance` 수명 — 활성 수명 카운트다운, 수명 경과 시 `expired`에 포함
- [x] `spawn` 갱신 — 재시전 시 **단일 인스턴스**(active 1개) + 수명·수·크기·데미지 **재스냅샷**
- [x] `ringRadius` — 바닥값(`orbitRadius`) 지배 / 간격(spacing) 확장 / clearance 지배 3분기
- [x] `ringRadius` — `count=1` 가드 (0 나눗셈 없이 유한값)
- [x] 재타격 락아웃 — `registerHit` 후 `canHit` false, `tickRehit`로 경과 후 true
- [x] 재타격 독립 — 다른 오브·다른 적은 락아웃 무관(키 분리)

> **명중 판정 재사용:** 오브의 반경 내 적 선택은 S1의 `selectExplosionHits`(중심=오브 위치)를 그대로 쓰며 `MagicExplosion.test.ts`가 이미 커버한다(중복 테스트 생략).
>
> **코드로 검증 불가(수동 항목):** 시전 시 오브 출현·회전·소멸 사이클, 접촉 타격, 동적 링 확장, VFX 추종·풀링, 강화 카드 인게임 반영 — 아래 §6.

---

## 3. 강화 매트릭스 (계약) — 5종 전부 ✅

| 옵션 | 인페르노 | 적격 근거 |
|---|---|---|
| 데미지 | ✅ | 항상(비-보조 공격 마법) |
| 쿨다운 | ✅ | 항상(재시전 간격) |
| 발사체 수 | ✅ | `allowsProjectileCount:true` (오브 수) |
| 범위 | ✅ | `orbitRadius` 보유 → `isRangeCapable` (오브 크기) |
| 지속시간 | ✅ | `lifetimeSec` 보유 → `isDurationCapable` (활성 수명) |

---

## 4. 씬/프리팹 변경 사항

| 노드/프리팹 | 변경 | 비고 |
|---|---|---|
| **오브 VFX 프리팹 (신규 — 사용자 생성)** | 회전하는 화염 오브 1개 placeholder. `SpellCaster`가 오브 수만큼 풀에서 꺼내 배치. 아래 **생성 레시피** 참고 | 최종 아트는 7-9주차(A4) |
| `EnemySpawner` 노드 (임시·비커밋) | 오브가 군집을 쓸어내는 걸 보려고 `maxEnemies`↑·`spawnInterval`↓ | 아래 §5. **테스트 후 원복, 커밋 금지** |

#### 오브 VFX 프리팹 생성 레시피 (사용자가 Cocos 에디터에서 생성)

> AI는 프리팹·`.meta`를 만들지 않는다(에셋 `.meta` 규칙). 이 프리팹은 7단계에서 사용자가 만들고, `.meta`는 `PR 승인`(8단계)에 일괄 커밋한다. 구현(`SpellCaster.ts`)은 받을 자리(`orbVfxPrefab` `@property`)와 풀·배치 로직을 이미 갖춘다.

| 항목 | 값 | 근거 |
|---|---|---|
| **파일/위치** | `game/assets/prefabs/OrbVfx.prefab` (PascalCase, `prefabs/` 폴더 권장 — UUID 참조라 위치 자유) | conventions.md 네이밍 |
| **루트 노드** | `cc.Node` 1개 (`OrbVfx`) — **오브 하나**를 나타냄(여러 개는 코드가 풀에서 복제) | `ExplosionVfx.prefab` 구조 참고 |
| **컴포넌트 1 — `cc.UITransform`** | anchor `(0.5, 0.5)`(중심 기준 — 코드가 오브 위치를 노드 position으로 세팅), contentSize ≈ **28×28** | 아래 스케일 근거 |
| **컴포넌트 2 — `cc.Sprite`** | placeholder 원형 화염 스프라이트. 색은 화염 느낌(주황/빨강), 발광 느낌이면 반투명 + 알파 블렌드 | 시각 placeholder. 화염 분류 색 구분 |
| **부모 노드** | 별도 `@property` 없음 — `SpellCaster.bulletParent`를 재사용 | 코드: `if (this.orbVfxPrefab && this.bulletParent)` |

**코드에서 확정될 동작 (`SpellCaster.ts` — 노바 VFX와 유사 패턴):**
- `ORB_VFX_BASE_RADIUS`(= inferno 기본 오브 크기 14) → **scale 1 = 오브 반경 14**. 코드가 `유효 오브 크기 / 14`로 자동 스케일하므로 범위 강화 시 오브가 비례해 커진다. 프리팹은 scale 1에서 반경 14(지름 ~28)를 덮도록 만든다.
- **오브 수만큼 복제·배치:** 코드가 풀에서 오브 노드를 `count`개 꺼내 `360/N` 위치에 둔다. 강화로 `count`가 바뀌면 더 꺼내거나 반환한다(`_reconcileOrbVfx`).
- **수명이 끝나면 전부 반환:** 활성 수명이 다하면 그 시전의 오브 노드를 모두 풀로 돌려보낸다(`_releaseAllOrbVfx`).
- **VFX는 옵션:** 프리팹 미연결이면 오브 **피해는 정상 동작**하고 화면 효과만 생략된다(콜백 no-op). §6의 "VFX 표시"까지 통과하려면 연결 필요.

---

## 5. 오브 검증용 적 밀도 — 임시(비커밋)

오브가 플레이어 주변 군집을 쓸어내는 걸 보려면 적이 플레이어 가까이 빽빽해야 한다. **이 인스펙터 값은 커밋하지 않고 테스트 후 원복한다.** 대량 적 성능은 별도 슬라이스(백로그 G1).

| `EnemySpawner` 프로퍼티 | 평상시(씬 커밋값) | 테스트용 임시 |
|---|---|---|
| `maxEnemies` | 10 | 60 (군집 형성) |
| `spawnInterval` | 2 | 0.3 (빠르게 채움) |

---

## 6. 에디터 연결 체크리스트

| 컴포넌트 | `@property` | 연결 대상 | 상태 |
|---|---|---|---|
| `SpellCaster` | `orbVfxPrefab` | 신규 `OrbVfx.prefab`(위 §4 레시피) | ❌ |
| `SpellCaster` | `startingSpellIds` | 인페르노 테스트 위해 `inferno` 포함(또는 단독)으로 임시 변경 | ❌ |
| `SpellCaster` | (VFX 부모) | **연결 불필요** — `bulletParent` 재사용(전용 프로퍼티 없음) | — |
| `EnemySpawner`(임시) | `maxEnemies` | 60 | ❌ |
| `EnemySpawner`(임시) | `spawnInterval` | 0.3 | ❌ |

> 인페르노를 보려면 로드아웃에 inferno가 있어야 한다. 인스펙터 `startingSpellIds`에 `inferno`를 넣어 테스트하고, 끝나면 원복한다(또는 레벨업 "마법 추가" 카드로 획득).

---

## 7. 수동 테스트 체크리스트 (인게임)

### 생애주기 (시전 → 회전 → 소멸 → 재출현)

- [ ] inferno 보유 시 **쿨다운마다 오브가 플레이어 주위에 나타나** 회전한다(발사체가 날아가지 않음).
- [ ] 활성 수명이 끝나면 **오브가 전부 한꺼번에 사라진다**.
- [ ] 쿨다운이 지나면 **오브가 다시 나타난다**(placeholder 수명 3 < 쿨다운 5라 잠깐 빈 구간이 보임). [핵심]
- [ ] **적이 한 마리도 없어도** 오브는 쿨다운마다 나타나 돈다(자기중심 — 발사 보류 없음). [핵심]

### 피해 / 재타격

- [ ] 오브에 **닿은 적이 피해**를 받는다(접촉 타격).
- [ ] 링 안에 가만히 있는 적은 오브가 쓸고 지나갈 때마다 **반복해서** 맞는다(매 프레임 도배가 아니라 통과마다 1회 — 재타격 락아웃).
- [ ] 인페르노가 빙결·슬로우·정지를 걸지 **않는다**(순수 접촉 피해 — 적이 멈추거나 느려지지 않음). [핵심: DOT/CC 아님]

### 강화 (5종 전부)

- [ ] **발사체 수** 카드를 고르면 **오브 개수가 늘어난다**(`360/N` 균등 재배치). 기본 2개 → 최대 10개.
- [ ] **범위** 카드를 고르면 **오브가 눈에 띄게 커진다**(VFX도 비례 확대).
- [ ] 오브가 많거나 커지면 **링 반경이 바깥으로 확장**돼 오브끼리 겹치지 않는다("지구-달"). [핵심: 동적 링]
- [ ] **지속시간** 카드를 고르면 **오브가 도는 시간이 길어진다**(빈 구간이 짧아짐).
- [ ] **쿨다운** 카드를 고르면 **재출현이 빨라진다**. 지속시간·쿨다운을 충분히 키워 **수명 ≥ 쿨다운**이 되면 오브가 끊김 없이 유지된다.
- [ ] **데미지** 강화가 타격당 피해에 반영된다.

### 강화 카드 등장 (§3 매트릭스)

- [ ] 강화 카드 패널에 인페르노 **데미지·쿨다운·발사체 수·범위·지속시간 카드가 모두** 등장한다(5종 전부 — 인페르노 유일).

### 일시정지 / 회귀

- [ ] **레벨업·게임오버 중** 오브의 회전·수명·타격이 멈췄다가 재개된다(`update` 게이트).
- [ ] 발사체 마법(파이어볼 등)과 함께 보유 시, **발사체 마법은 기존대로** 적을 조준해 발사된다(Orbit 분기가 발사체·노바 경로를 깨지 않음).
- [ ] 노바 마법(프로스트 노바)과 함께 보유 시, **노바도 기존대로** 쿨다운마다 자기중심 발동한다.
