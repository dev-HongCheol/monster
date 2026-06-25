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
| `components/SpellCaster.ts` | `update` 디스패치에 Orbit 분기(`consume` + `_castOrbit`) + `_advanceOrbits`(오브 위치 배치 인라인)·`_applyOrbHit`·`_reconcileOrbVfx`·`_releaseAllOrbVfx` + 오브 VFX 풀·맵 + `@property orbVfxPrefab` | **발사·노바 회귀** — 발사체 마법은 적 있을 때만 발사, 노바는 적 무관 시전. Orbit 분기가 둘을 깨지 않아야 함 |
| `systems/GameManager.ts` | 신규 헬퍼 `collectTargetsInRadius(cx, cy, r) → {targets, ctrls}` (F16 부분) | **동작 무변경 리팩터** — 헬퍼 추출만. 폭발·노바 명중 결과 동일 |
| `components/Projectile.ts` | `_detonate`의 인라인 수집 루프를 `collectTargetsInRadius` 호출로 교체 (F16 부분) | **동작 무변경** — `MagicExplosion.test` 폭발 명중 결과 그대로 |
| `resources/data/spells.json` | `inferno` 항목 추가 | **i18n 키 가드** — `spell.inferno.name` 누락 시 `I18nKeyGuard` RED. `MagicAddCard` 등 실데이터 의존 테스트는 inferno가 "마법 추가" 풀에 포함됨을 전제로 통과 |
| `resources/i18n/ko.json`·`en.json` | `spell.inferno.name` 키 추가 | i18n 키 정합 가드 — 키 추가 후 GREEN |

> **`spells.json`과 i18n 키는 같은 커밋에:** `I18nKeyGuard.test.ts`가 실 `spells.json`을 읽어 `spell.inferno.name` 누락 시 전체 스위트를 RED로 만든다. 데이터 추가와 ko/en 키 추가를 같은 커밋에 넣어야 GREEN을 지난다.

### 1-2. 추가 변경 — user-verification 중 재작업 (2026-06-25)

강화 종류가 많아 인게임 카드 픽으로 레벨 조합을 일일이 만들어 검증하기 어려운 문제가 있었다. 이를 풀기 위해 카드 픽 없이 강화 레벨을 주입하는 **DEV 강화 시드 도구**를 더했고, 더불어 궤도 오브의 겹침·거리를 데이터로 조절하는 **`orbGap` 필드**를 추가했다(발사체가 많을 때 오브가 조금 겹치며 플레이어에 가까이 돌게).

| 변경 파일 | 변경 내용 | 회귀 확인 범위 |
|---|---|---|
| `logic/DebugEnhancementSeed.ts` | 신규 순수 로직 — 시드 JSON을 강화 op(개별·분류 `raise` + 전역 보너스)으로 정규화. 알 수 없는 옵션·범위 밖 레벨을 방어적으로 거른다 | 신규 파일 — 기존 로직 무영향. `DebugEnhancementSeed.test.ts` 7케이스 |
| `systems/DeckManager.ts` | `start()`에서 `DEV`일 때만 `data/debug-enhancements.json`을 읽어 `applyDebugSeed`로 적용하고, 공개 메서드 `applyDebugSeed`를 추가 | **DEV 게이트** — 릴리스 빌드는 로드 자체를 안 한다. 파일이 없으면 조용히 무시(시드 미사용 = 정상). 카드 픽 경로(`applyCard`)는 무변경 |
| `resources/data/debug-enhancements.json` | 신규 시드 데이터 — 마법별 개별/분류 강화 레벨과 전역 보너스 | 데이터 파일. Cocos가 `JsonAsset`로 임포트(`.meta`는 7단계에서 생성) |
| `data/GameTypes.ts` | `ISpellData.orbGap?` 추가(생략 시 기본 `ORB_GAP`=0.15) | 옵셔널 필드 — 미지정 마법은 기존 동작 그대로 |
| `logic/OrbitLogic.ts` | `ringRadius(...)`에 `gap` 파라미터 추가(기본값 `ORB_GAP`). 음수면 겹침 허용해 간격 항이 작아진다 | **링 반경 회귀** — `gap` 생략 호출은 기존과 동일. 기존 `OrbitLogic.test.ts` 케이스 그대로 통과 + gap 케이스 2개 추가 |
| `components/SpellCaster.ts` | `_advanceOrbits`가 `spell?.orbGap`을 `ringRadius`에 전달 | `undefined`면 기본값이 적용돼 `orbGap` 없는 마법은 동작 무변경 |
| `resources/data/spells.json` | 인페르노에 `orbGap: -0.1` 추가(현재 튜닝값 — `spells.json`에서 조절) | 오브가 많을 때만 약간 겹치며 링이 안쪽으로. i18n 키와 무관 |

---

## 2. 자동 테스트로 검증

> **통과 근거(2026-06-24 GREEN):** 피처 테스트 24/24(`Inferno.test.ts` 7 + `OrbitLogic.test.ts` 17) + 전체 스위트 260/260 통과(`pnpm wf start-verification` GREEN 게이트). 통과 커밋 SHA는 구현 커밋(`feat/inferno`).
>
> **추가 검증(2026-06-25, 로컬):** §1-2 추가분으로 `DebugEnhancementSeed.test.ts` 7케이스와 `OrbitLogic.test.ts` gap 케이스 2개가 늘어 전체 스위트 **270/270** 통과. 편집 파일 TS 진단 0건, lint clean. 워크플로 검증 게이트(`start-verification` → cso·ts·lint·review)는 7단계 재진입 시 다시 통과시킨다.

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

- [x] inferno 보유 시 **쿨다운마다 오브가 플레이어 주위에 나타나** 회전한다(발사체가 날아가지 않음).
- [x] 활성 수명이 끝나면 **오브가 전부 한꺼번에 사라진다**.
- [x] 쿨다운이 지나면 **오브가 다시 나타난다**(placeholder 수명 3 < 쿨다운 5라 잠깐 빈 구간이 보임). [핵심]
- [x] **적이 한 마리도 없어도** 오브는 쿨다운마다 나타나 돈다(자기중심 — 발사 보류 없음). [핵심]

### 피해 / 재타격

- [x] 오브에 **닿은 적이 피해**를 받는다(접촉 타격).
- [x] 링 안에 가만히 있는 적은 오브가 쓸고 지나갈 때마다 **반복해서** 맞는다(매 프레임 도배가 아니라 통과마다 1회 — 재타격 락아웃).
- [x] 인페르노가 빙결·슬로우·정지를 걸지 **않는다**(순수 접촉 피해 — 적이 멈추거나 느려지지 않음). [핵심: DOT/CC 아님]

### 강화 (5종 전부)

- [x] **발사체 수** 카드를 고르면 **오브 개수가 늘어난다**(`360/N` 균등 재배치). 기본 2개 → 최대 10개.
- [x] **범위** 카드를 고르면 **오브가 눈에 띄게 커진다**(VFX도 비례 확대).
- [x] 오브가 많거나 커지면 **링 반경이 바깥으로 확장**돼 오브끼리 ~~겹치지 않는다~~ → **`orbGap` 기본값(0.15) 기준**: 음수 `orbGap`이면 의도적으로 약간 겹친다(아래 "궤도 패킹" 참고). 동적 링 확장 자체는 그대로. [핵심: 동적 링]
- [x] **지속시간** 카드를 고르면 **오브가 도는 시간이 길어진다**(빈 구간이 짧아짐).
- [x] **쿨다운** 카드를 고르면 **재출현이 빨라진다**. 지속시간·쿨다운을 충분히 키워 **수명 ≥ 쿨다운**이 되면 오브가 끊김 없이 유지된다.
- [x] **데미지** 강화가 타격당 피해에 반영된다.

### 궤도 패킹 (`orbGap` — 2026-06-25 추가)

- [ ] 인페르노 오브가 **많아지면**(발사체 수 강화) 오브끼리 **약간 겹치며** 링이 기존보다 **안쪽으로** 들어온다(현재 `orbGap: -0.1`).
- [ ] 오브가 **적을 때는** 변화가 거의 없다 — 바닥값 `orbitRadius`(80)·파묻힘 여유가 지배하는 구간이라 간격 항이 안 지배한다.
- [ ] `spells.json`의 인페르노 `orbGap`을 바꾸면 인게임에 반영된다(더 음수 = 더 겹치고 가까이, `0` = 딱 맞닿음, `0.15` = 원래 간격).

### 강화 카드 등장 (§3 매트릭스)

- [x] 강화 카드 패널에 인페르노 **데미지·쿨다운·발사체 수·범위·지속시간 카드가 모두** 등장한다(5종 전부 — 인페르노 유일).

### 일시정지 / 회귀

- [x] **레벨업·게임오버 중** 오브의 회전·수명·타격이 멈췄다가 재개된다(`update` 게이트).
- [x] 발사체 마법(파이어볼 등)과 함께 보유 시, **발사체 마법은 기존대로** 적을 조준해 발사된다(Orbit 분기가 발사체·노바 경로를 깨지 않음).
- [x] 노바 마법(프로스트 노바)과 함께 보유 시, **노바도 기존대로** 쿨다운마다 자기중심 발동한다.

---

## 8. 테스트 도구 — DEV 강화 시드 (카드 픽 없이 강화 주입)

강화 종류가 많아 인게임에서 레벨 조합을 일일이 만들기 어렵다. `game/assets/resources/data/debug-enhancements.json`에 강화 레벨을 적어 두면 **DEV 빌드(에디터/프리뷰)에서 게임 시작 시 자동 적용**된다(릴리스 빌드는 `DEV` 게이트로 로드하지 않는다). 값을 바꾼 뒤 프리뷰를 다시 돌리면 반영된다.

```jsonc
{
  "individual": { "inferno": { "damage": 2, "cooldown": 2, "projectile_count": 2, "range": 2, "duration": 2 } },
  "category":   { "fire":    { "damage": 0, "cooldown": 0, "projectile_count": 0, "range": 0, "duration": 0 } },
  "global":     { "damage": 0, "cooldown": 0 }
}
```

- **옵션 키:** `damage` · `cooldown` · `projectile_count`(언더스코어) · `range` · `duration`. 마법마다 적격 옵션만 효과가 있다(예: 노바는 발사체 수 ❌, 폭발 없는 마법은 범위 ❌ — §3 매트릭스 기준).
- **레벨 0~4.** 곱셈 곡선은 개별 `[1.0, 1.3, 1.65, 2.05, 2.5]`, 분류 `[1.0, 1.2, 1.4, 1.7, 2.05]`. 발사체 수만 가산(레벨당 +1, 발사체당 데미지 페널티 동반).
- **전역(`global`)은 게임에서 카드로 부여되는 `damage`·`cooldown`만** 둔다(발사체 수는 전역 트랙 없음 §7.6).
- **주의 — `global` 값은 레벨이 아니라 가산 보너스다**(개별·분류는 레벨 0~4, 전역은 배율 가산). 예: `global.damage: 0.1` = ×1.1(+10%). 여기에 `2`를 넣으면 +200%(×3.0)가 되니 레벨처럼 쓰지 말 것.
- 레벨 0/보너스 0은 무효과(키 자리만) — 한 축만 격리하려면 나머지를 0으로 둔다.
- 파일이 없거나 값이 잘못돼도 게임은 정상 동작한다(파서가 알 수 없는 옵션·범위 밖 레벨을 거른다). **키 오타(존재하지 않는 spellId)나 `global.projectile_count`는 조용히 무시된다** — 적용이 안 되면 키 철자를 먼저 확인할 것.

> 이 파일도 `resources/` 데이터라 `.meta`는 Cocos가 7단계 테스트 때 생성하고 `PR 승인`(8단계)에 커밋한다. 시드 도구를 인페르노 PR에 포함할지 별도 슬라이스로 뺄지는 **스코프 결정 대기**([인페르노 플랜 §13](../development/sessions/2026-06-24-inferno-plan.md#13-추가-작업--강화-테스트-도구--궤도-패킹orbgap-2026-06-25) 참고).
