# QA — 마법 효과 레이어 S4-1 (Nova + 프로스트 노바)

> **브랜치:** feat/frost-nova
> **슬라이스:** 마법 효과 레이어 S4 분할 1부 — Nova(자기중심 즉발 버스트) 프리미티브 + 프로스트 노바(얼음3) (`magic-system-mage.md` §12.2)
> **계획 문서:** [2026-06-23-frost-nova-plan.md](../development/sessions/2026-06-23-frost-nova-plan.md)
> **닫는 백로그:** A1(일부 — Nova 축), A3(범위 — 노바 반경)

---

## 1. Impact Map (회귀 테스트 기준)

| 변경 파일 | 변경 내용 | 회귀 확인 범위 |
|---|---|---|
| `data/GameTypes.ts` | `SpellPattern`에 `Nova = 'nova'` 추가 | enum 값 추가뿐 — 기존 `Directional` 무영향 |
| `logic/SpellPatternLogic.ts` | `buildFirePlan`에 `case Nova → []` | **발사체 패턴 회귀** — `SpellPatternEngine.test`의 directional·폴백(미지 pattern→directional)이 그대로 통과해야 함. 'nova'만 빈 배열, 'bogus_pattern'은 여전히 directional 폴백. |
| `components/SpellCaster.ts` | `update` 디스패치 재구조화(조기 반환 제거) + `_castNova` + `_spawnNovaVfx` + `@property novaVfxPrefab` + 노바 VFX 풀 | **발사체 발사 회귀** — 발사체 마법은 적이 있을 때만(기존처럼) 발사·쿨다운 소진해야 함. 적 없을 때 발사체 마법이 발사되면 안 됨. |
| `resources/data/spells.json` | `frost_nova` 항목 추가 | **i18n 키 가드** — `spell.frost_nova.name` 누락 시 `I18nKeyGuard` RED. 실데이터 의존 테스트(`MagicAddCard` 등)는 frost_nova가 "마법 추가" 풀에 포함됨을 전제로 통과해야 함. |
| `resources/i18n/ko.json`·`en.json` | `spell.frost_nova.name` 키 추가 | i18n 키 정합 가드 — 키 추가 후 GREEN |

> **수치 변경 없음:** 기존 `EnhancementLogic`·`DeckManager` 코드는 건드리지 않는다. 범위 카드 적격(`isRangeCapable`)·발사체수 제외(`allowsProjectileCount`)·지속 제외(`isDurationCapable`)는 **이미 있는 게이트**가 frost_nova 데이터에 자동 적용된다 — 그래서 카드 적격 테스트는 신규 코드 없이 통과한다(계약 가드).

---

## 2. 자동 테스트로 검증 (`tests/logic/FrostNova.test.ts`)

> **통과 근거(2026-06-23 GREEN):** 피처 테스트 6/6 + 전체 스위트 236/236 통과(`pnpm wf start-verification` GREEN 게이트). 통과 커밋 SHA는 구현 커밋(`feat/frost-nova`).

- [x] `buildFirePlan(nova)` → 발사체 0발 (자기중심 버스트라 발사체 경로 안 탐) — **RED 드라이버**
- [x] `buildFirePlan(nova)` → count가 커도 0발 (발사체 수 무관)
- [x] 강화 카드 적격: 범위 ✅ (explosionRadius 보유) — 계약 가드
- [x] 강화 카드 적격: 발사체 수 ❌ (allowsProjectileCount=false) — 계약 가드
- [x] 강화 카드 적격: 지속시간 ❌ (onHitStatus 없음) — 계약 가드
- [x] 강화 카드 적격: 데미지·쿨다운 ✅ — 계약 가드

> **명중 판정은 재사용:** 노바의 반경 내 적 선택·dedup은 S1의 `selectExplosionHits`를 그대로 쓰며 `MagicExplosion.test.ts`가 이미 커버한다(중복 테스트 생략).
>
> **코드로 검증 불가(수동 항목):** 시전 시 자기중심 발동, 적 없을 때 발동, 반경 내 다중 타격, 노바 VFX 표시, 범위 강화 시 반경 확대 — 아래 §6.

---

## 3. 씬/프리팹 변경 사항

| 노드/프리팹 | 변경 | 비고 |
|---|---|---|
| **노바 VFX 프리팹 (신규 — 사용자 생성)** | 플레이어 중심에 짧게 표시되는 placeholder 링/방사 효과. 풀 재사용. 아래 **생성 레시피** 참고. | 최종 아트는 7-9주차(A4). |
| `EnemySpawner` 노드 (임시·비커밋) | 노바가 군집을 한 번에 때리는 걸 보려고 `maxEnemies`↑·`spawnInterval`↓ | 아래 §4. **테스트 후 원복, 커밋 금지.** |

#### 노바 VFX 프리팹 생성 레시피 (사용자가 Cocos 에디터에서 생성)

> AI는 프리팹·`.meta`를 만들지 않는다(에셋 `.meta` 규칙). 이 프리팹은 7단계에서 사용자가 만들고, `.meta`는 `PR 승인`(8단계)에 일괄 커밋한다. 구현(`SpellCaster.ts`)은 받을 자리(`novaVfxPrefab` `@property`)와 풀·스폰 로직을 이미 갖춘다.

| 항목 | 값 | 근거 |
|---|---|---|
| **파일/위치** | `game/assets/prefabs/NovaVfx.prefab` (PascalCase, `prefabs/` 폴더 권장 — UUID 참조라 위치 자유) | conventions.md 네이밍 |
| **루트 노드** | `cc.Node` 1개 (`NovaVfx`) | `ExplosionVfx.prefab` 구조 참고 |
| **컴포넌트 1 — `cc.UITransform`** | anchor `(0.5, 0.5)`(중심 기준 — 코드가 플레이어 위치를 노드 position으로 세팅), contentSize ≈ **240×240** | 아래 스케일 근거 |
| **컴포넌트 2 — `cc.Sprite`** | placeholder 링/방사형 스프라이트. 색은 얼음 느낌(하늘색/흰색), 반투명 + 알파 블렌드 | 시각 placeholder. 얼음 분류 색 구분 |
| **컴포넌트 3 (선택) — `cc.Animation`** | 짧은 **확장+페이드** 클립. 없으면 정적 스프라이트로 표시(코드는 스케일 1회 세팅 후 표시만 함) | 폴리시 |
| **부모 노드** | 별도 `@property` 없음 — `SpellCaster.bulletParent`를 재사용 | 코드: `if (this.novaVfxPrefab && this.bulletParent)` |

**코드에서 확정될 동작 (`SpellCaster.ts` — 폭발 VFX와 동일 패턴):**
- `NOVA_VFX_BASE_RADIUS`(= frost_nova 기본 반경 120) → **scale 1 = 반경 120**. 코드가 `유효 반경 / 120`으로 자동 스케일하므로 범위 강화 시 링도 비례해 커진다. 프리팹은 scale 1에서 반경 120(지름 ~240)을 덮도록 만든다. (F13 스타일 커플링 — 미래 다른 노바 반경 마법이 생기면 기본값 유도 검토.)
- `NOVA_VFX_DURATION`(≈ 0.25초) → 발동 후 풀로 반환.
- **VFX는 옵션:** 프리팹 미연결이면 노바 **피해는 정상 동작**하고 화면 효과만 생략된다(콜백 no-op). §6의 "VFX 표시"까지 통과하려면 연결 필요.

---

## 4. 노바 검증용 적 밀도 — 임시(비커밋)

노바가 플레이어 주변 군집을 한 번에 쓸어내는 걸 보려면 적이 플레이어 가까이 빽빽해야 한다. **이 인스펙터 값은 커밋하지 않고 테스트 후 원복한다.** 대량 적 성능은 별도 슬라이스(백로그 G1).

| `EnemySpawner` 프로퍼티 | 평상시(씬 커밋값) | 테스트용 임시 |
|---|---|---|
| `maxEnemies` | 10 | 60 (군집 형성) |
| `spawnInterval` | 2 | 0.3 (빠르게 채움) |

---

## 5. 에디터 연결 체크리스트

| 컴포넌트 | `@property` | 연결 대상 | 상태 |
|---|---|---|---|
| `SpellCaster` | `novaVfxPrefab` | 신규 `NovaVfx.prefab`(위 §3 레시피) | ❌ |
| `SpellCaster` | `startingSpellIds` | 노바 테스트 위해 `frost_nova` 포함(또는 단독)으로 임시 변경 | ❌ |
| `SpellCaster` | (VFX 부모) | **연결 불필요** — `bulletParent` 재사용(전용 프로퍼티 없음) | — |
| `EnemySpawner`(임시) | `maxEnemies` | 60 | ❌ |
| `EnemySpawner`(임시) | `spawnInterval` | 0.3 | ❌ |

> 노바를 보려면 로드아웃에 frost_nova가 있어야 한다. 인스펙터 `startingSpellIds`에 `frost_nova`를 넣어 테스트하고, 끝나면 원복한다(또는 레벨업 "마법 추가" 카드로 획득).

---

## 6. 수동 테스트 체크리스트 (인게임)

- [ ] frost_nova 보유 시 **쿨다운마다 플레이어 중심에서 노바가 발동**한다(발사체가 날아가지 않음).
- [ ] 노바 반경 안 **여러 적이 한 번에** 피해를 받는다(플레이어 주변 군집).
- [ ] 반경 **밖** 적은 피해를 받지 않는다.
- [ ] **적이 한 마리도 없어도** 노바는 쿨다운마다 발동한다(자기중심 — 발사 보류 없음). [핵심]
- [ ] 노바가 빙결·슬로우를 걸지 **않는다**(순수 피해 — 적이 멈추거나 느려지지 않음).
- [ ] 발동마다 **노바 VFX가 플레이어 위치에** 표시된다.
- [ ] 범위 강화 카드를 고르면 **노바 반경이 눈에 띄게 커진다**(VFX 링도 비례 확대).
- [ ] 강화 카드 패널에 **프로스트 노바 범위 카드**가 등장한다(라벨 "범위", i18n `upgrade.range`).
- [ ] 강화 카드 패널에 **프로스트 노바 발사체 수 카드가 등장하지 않는다**(자기중심 — 제외).
- [ ] 강화 카드 패널에 **프로스트 노바 지속시간 카드가 등장하지 않는다**(순수 피해 — 제외).
- [ ] 데미지·쿨다운 강화 카드는 정상 등장하고 적용된다.
- [ ] 발사체 마법(파이어볼 등)과 함께 보유 시, **발사체 마법은 기존대로** 적을 조준해 발사된다(노바 분기가 발사체 경로를 깨지 않음).
