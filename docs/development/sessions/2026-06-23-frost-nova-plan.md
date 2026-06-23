# 프로스트 노바 슬라이스 계획 (frost-nova — S4 분할 1부)

- **작성일:** 2026-06-23
- **브랜치:** feat/frost-nova
- **슬라이스:** 마법 효과 레이어 S4를 둘로 나눈 첫 번째 — Nova(자기중심 즉발 버스트) 프리미티브 + 프로스트 노바(얼음 등급3)
- **상태:** 계획 (사용자 승인 대기)
- **관련 문서:** [마법 시스템 디자인](../../planning/magic-system-mage.md) §9~§12, [개발 백로그](../backlog.md) A1·A3·F12

---

## 1. 배경 / 목적

마법 효과 레이어는 S1(폭발)·S2(정지)·S3(슬로우)까지 발사체 명중형 효과만 구현돼 있다. 자기중심 광역(Self-AoE)은 아직 없다. 기획서가 나눠 둔 S4는 "Nova(순간) + Aura(지속) + DOT 틱 + 인페르노·프로스트 노바"를 한 묶음으로 묶는데, 프리미티브 3개에 마법 2종이라 한 슬라이스로 크다. 그래서 둘로 나눠 **이번에는 Nova 순간 버스트 한 프리미티브와 그것을 처음 쓰는 프로스트 노바만** 낸다. Aura(지속 지대)·DOT 틱·인페르노는 다음 슬라이스로 분리한다.

프로스트 노바는 플레이어 주변 일정 반경에 1회 즉발 피해를 주는 얼음 등급3 마법이다. 빙결·DOT가 없는 순수 피해다(기획 §3.3). 마법사가 근접 군집에 둘러싸였을 때 자기 주변을 한 번에 쓸어내는 역할이다.

---

## 2. 스코프

### 포함

- **Nova 프리미티브** — 시전 즉시 플레이어 위치를 중심으로 1회 버스트. 발사체가 아니다(이동·충돌 없음).
- **비발사체 디스패치 경로** — `SpellCaster`가 패턴으로 분기해 노바는 발사체 생성 대신 자기중심 버스트를 실행한다(아래 §4 결정).
- **프로스트 노바 데이터** — `spells.json` 항목 + i18n 키(`spell.frost_nova.name`).
- **범위 강화 → 노바 반경** — 기존 `rangeFactor`를 노바 반경에 재사용(A3 일부). 데이터가 `explosionRadius`를 가지므로 범위 카드가 자동 적격이 된다(§5).
- **데미지·쿨다운 강화** — 기존 배율(`damageFactor`/`effectiveCooldown`) 재사용.
- **링 VFX 슬롯** — `@property novaVfxPrefab` + 위치·스케일·풀링 코드(폭발 VFX와 동일 패턴). 실제 링 프리팹/아트는 7단계에서 사용자가 에디터로 생성·연결.

### 제외 (분할 2부 이후로 이월)

- **인페르노**(Aura 지속 지대 + DOT 틱) — 지대·틱 메커니즘은 다음 슬라이스.
- **발사체 수 강화** — 자기중심이라 부채꼴로 퍼질 방향이 없어 ❌(기획 §8, `allowsProjectileCount: false`).
- **지속시간 강화** — 노바는 즉발이라 지속 대상이 없음(`onHitStatus` 없음 → 지속 카드 부적격).
- **facing(A2)** — 자기중심은 조준이 필요 없다(기획 §10.1 `self`).

### 이 슬라이스가 닫는 백로그 항목

- **A1**(마법 효과 레이어)의 Nova 축 — Self-AoE 순간 버스트 프리미티브 도입. A1 자체는 Aura·DOT·낙하·폭풍·체인·빔 잔여로 계속 열림.
- **A3**(범위 강화 활성화) — 노바 반경이 범위 강화의 새 대상이 된다(폭발 반경에 이어 두 번째).

---

## 3. 전제

1. 노바 명중 판정은 S1의 `selectExplosionHits`를 그대로 재사용한다(중심만 플레이어 위치). 새 판정 로직은 만들지 않는다.
2. 후보 적 질의도 `GameManager.queryEnemiesInRadius`(공간 그리드)를 재사용한다 — 노바도 그리드 가속을 공짜로 받는다(G1-레디).
3. VFX는 폭발과 동일 패턴이다 — 프리팹 `@property` 슬롯 + 코드가 위치·스케일·풀링을 한다. 프리팹/아트 에셋은 7단계 사용자 테스트에서 Cocos가 생성한다.
4. 프로스트 노바는 순수 피해다 — 빙결·슬로우·DOT 없음(기획 §3.3).

---

## 4. 디스패치 결정 — B) 별도 버스트 경로

`buildFirePlan`은 현재 `ShotSpec[]`(발사체)만 반환한다. 노바는 발사체가 아니라 자기중심 버스트라 이 출력으로 표현되지 않는다. 기획 §12.1이 "디스패치 출력을 폭발/라인/지대까지 표현하도록 일반화해야 한다"고 예고한 지점이다.

세 가지 안을 검토했다.

| 안 | 내용 | 판단 |
|----|------|------|
| A) 출력 일반화 | `buildFirePlan` 반환을 `FirePlan{shots, bursts}`로 일반화 | 기획 §12.1 방향·후속 재사용에 유리하나 기존 반환타입·테스트·호출부 변경 |
| **B) 별도 버스트 경로** | `buildFirePlan` 유지 + 자기중심 패턴용 분기를 `SpellCaster`에 추가 | **채택** — 기존 발사체 경로·테스트 무손상, 최소 변경 |
| C) 수명 0 발사체 | 노바를 즉시 폭발하는 발사체로 모델링 | 비채택 — `Projectile` 라이프사이클 남용, Aura 확장에 부적합 |

**채택: B.** 사용자 결정(2026-06-23). 기존 발사체 경로를 건드리지 않아 회귀 위험이 가장 작다.

**트레이드오프(이월):** §12.1의 출력 일반화는 미뤄진다. S5(낙하)·S6(폭풍)·S8(빔)도 비발사체 출력이라 같은 분기 문제가 반복된다. 진입점이 늘어나면 그때 일반화(A)를 재검토하도록 백로그에 남긴다.

---

## 5. 데이터 스키마 — frost_nova

`spells.json`에 한 항목을 추가한다. 수치는 전부 placeholder이며 밸런싱(기획 §14)에서 확정한다.

```jsonc
{
  "id": "frost_nova",
  "category": "ice",
  "tier": 3,
  "damage": 30,              // placeholder
  "projectileSpeed": 0,      // 노바는 발사체 없음 — 미사용(스키마 필수 필드라 0)
  "projectileRadius": 0,     // 미사용
  "cooldown": 2.0,           // placeholder — 자기중심 펄스라 발사체보다 느리게
  "projectileCount": 1,
  "pattern": "nova",         // 신규 enum 값 SpellPattern.Nova
  "allowsProjectileCount": false,  // 자기중심 → 발사체 수 카드 제외(§8)
  "explosionRadius": 120     // placeholder — 노바 반경. 이 필드가 범위 카드 적격을 만든다
}
```

**`explosionRadius` 필드 재사용(DRY):** 노바 반경을 새 필드(`novaRadius`)로 두지 않고 기존 `explosionRadius`를 "버스트 반경"으로 재사용한다. 근거:

- `EnhancementLogic.isRangeCapable`이 `explosionRadius !== undefined`로 범위 카드 적격을 판정한다 → 노바가 이 필드를 가지면 **범위 강화 카드가 자동으로 노바에 적용**된다(별도 배선 0).
- `rangeFactor`가 그대로 노바 반경의 배율 대상이 된다.

**F12 불변식과의 관계(백로그):** 노바는 `explosionRadius`를 갖지만 `hitEffect`는 `'explosion'`이 아니다(자기중심 패턴이라 발사체 명중 폭발 경로를 타지 않는다). 백로그 F12가 가정한 "explosionRadius ⇒ hitEffect=explosion" 불변식의 반례다. 노바가 `explosionRadius`를 **노바 경로에서 정당하게 사용**하므로 죽은 카드가 아니다. F12를 데이터 검증으로 강제한다면 불변식을 "explosionRadius는 발사체 폭발 경로 **또는** 자기중심 노바 경로가 쓴다"로 넓혀야 한다 → F12에 역링크로 남긴다.

**카드 적격 요약(§8 매트릭스 검증):** 데미지 ✅ · 쿨다운 ✅ · 범위 ✅(노바 반경) · 발사체 수 ❌(`allowsProjectileCount:false`) · 지속시간 ❌(`onHitStatus` 없음).

---

## 6. 아키텍처

### 현재 흐름 (변경 전)

```
SpellCaster.update(dt):
  scheduler.tick
  target = _findNearestEnemy()
  if (!target) return            ← 적 없으면 전체 발사 차단
  aim = normalize(target - self)
  for each ready spell:
    consume cooldown
    plan = buildFirePlan(spell, {aim, count})   → ShotSpec[]
    for each shot: _spawnShot(...)              → 발사체 생성
```

### 변경 후 흐름

```
SpellCaster.update(dt):
  scheduler.tick
  target = _findNearestEnemy()          ← null 허용
  aim = target ? normalize(target - self) : null
  for each ready spell:
    if (spell.pattern === Nova):
        consume cooldown
        _castNova(spell)                ← 자기중심: target 무관하게 발동
    else:                               ← 발사체 경로(기존 동작 보존)
        if (!aim) continue              ← 적 없으면 이 마법만 발사 보류
        consume cooldown
        plan = buildFirePlan(...) → _spawnShot(...)
```

핵심: **조기 반환을 없애고**, 발사체 경로는 `if (!aim) continue`로 기존의 "적 없으면 발사 보류"를 그 마법에 한정해 보존한다. 노바는 `aim` 없이도 발동한다. 쿨다운 소진(`consume`)은 각 경로가 실제 발동할 때만 일어나므로 발사체 쿨다운 타이밍은 회귀가 없다.

### `_castNova` — `Projectile._detonate` 미러링

```
_castNova(spell):
  if (spell.explosionRadius === undefined) return        // 데이터 방어
  radius = spell.explosionRadius × rangeFactor(spell)
  damage = spell.damage × damageFactor(spell)            // 발사체 수 페널티 없음(count ❌)
  center = this.node.position
  // _detonate와 동일: 그리드 질의 → 후보 + 컨트롤러 병렬 수집
  for enemy in GameManager.queryEnemiesInRadius(center.x, center.y, radius):
    targets.push({x, y, collisionRadius, id: spawnId}); ctrls.push(enemy)
  hits = selectExplosionHits(center.x, center.y, radius, targets, new Set())
  for idx in hits: ctrls[idx].takeDamage(damage)
  _spawnNovaVfx(center.x, center.y, radius)
```

`Projectile._detonate`와의 유일한 차이는 (1) 중심이 명중 지점이 아니라 플레이어 위치, (2) 트리거가 명중이 아니라 시전, (3) 데미지 배율에 발사체 수 페널티가 없다는 것뿐이다. dedup 집합은 시전당 1회 버스트라 매번 새로 만든다.

### 순수 로직 — `buildFirePlan`의 Nova 케이스

`SpellPatternLogic.buildFirePlan`에 `case SpellPattern.Nova: return []`를 추가한다. 노바는 발사체를 만들지 않으므로 빈 배열이 맞다. 현재는 미지 패턴이 `default → directionalPlan`으로 떨어져 **노바인데 발사체를 만들어 버린다**(잠재 버그). 명시적 케이스로 막는다. 실제 노바 실행은 `_castNova`가 하지만, 디스패처가 노바에 대해 발사체를 만들지 않는다는 계약을 이 케이스가 보장하고 테스트한다.

---

## 7. 변경 파일

| 파일 | 변경 |
|------|------|
| `data/GameTypes.ts` | `SpellPattern`에 `Nova = 'nova'` 추가 |
| `logic/SpellPatternLogic.ts` | `buildFirePlan`에 `case Nova → []` 추가 |
| `components/SpellCaster.ts` | `update` 디스패치 재구조화 + `_castNova` + `_spawnNovaVfx` + `@property novaVfxPrefab` + 노바 VFX 풀 |
| `resources/data/spells.json` | `frost_nova` 항목 추가 |
| `resources/i18n/ko.json`·`en.json` | `spell.frost_nova.name` 키 추가 |
| `tests/logic/FrostNova.test.ts` | 신규 (RED) |

5개 파일 수정 — Safety Rules의 "5개 이상 동시 수정 시 계획 공유" 기준에 맞춰 이 문서로 공유한다.

---

## 8. 테스트 계획 (RED 대상)

순수 로직 테스트는 두 갈래다. 명중 판정 자체(`selectExplosionHits`)는 S1에서 이미 검증돼 재사용하므로, 이 슬라이스의 신규 순수 표면은 (1) 디스패치 계약과 (2) 데이터 기반 카드 적격이다.

| 코드패스 | 종류 | 커버리지 |
|---------|------|---------|
| `buildFirePlan(pattern=Nova)` → `[]` | 순수 | **신규 단위** — 노바가 발사체를 만들지 않음을 보장(RED→GREEN) |
| frost_nova 카드 적격: 범위 ✅·발사체수 ❌·지속 ❌·데미지 ✅·쿨다운 ✅ | 순수 | **신규 단위** — `EnhancementLogic` 게이팅을 실데이터로 검증(§8 매트릭스) |
| `selectExplosionHits`(중심=플레이어, dedup) | 순수 | 기존 `ExplosionLogic.test`로 커버(재사용) |
| `_castNova` 그리드 질의 → 데미지 적용 | 컴포넌트 | 수동 인게임(Cocos) |
| `update` 디스패치 분기 + target 무관 발동 | 컴포넌트 | 수동 인게임(Cocos) |
| 노바 VFX 생성·스케일·풀링 | 컴포넌트 | 수동 인게임(Cocos) |

RED 게이트: `tests/logic/FrostNova.test.ts`가 구현 전에 실패해야 한다. `buildFirePlan(Nova)`는 구현 전엔 `default → directionalPlan`으로 빈 배열이 아닌 발사체를 돌려주므로 실패한다.

---

## 9. 엣지 / 실패 모드 레지스트리

| # | 상황 | 처리 |
|---|------|------|
| 1 | **적 없음** | 노바는 쿨다운마다 발동(VFX만, 0히트). `update` 조기 반환 제거가 이를 가능케 함 [핵심] |
| 2 | Nova 마법에 `explosionRadius` 없음 | `_castNova`가 방어적으로 즉시 반환(크래시 없음) |
| 3 | `novaVfxPrefab` 미연결 | 데미지는 동작, VFX만 생략(폭발 VFX 선택 패턴과 동일) |
| 4 | 범위 강화 | `isRangeCapable`(explosionRadius 보유)로 자동 적격 → `rangeFactor`가 노바 반경 확대 |
| 5 | 발사체 수 카드 | `allowsProjectileCount:false`로 제외(§8) |
| 6 | 지속시간 카드 | `onHitStatus` 없음 → `isDurationCapable` false로 제외 |
| 7 | 그리드 재사용 | `_castNova`가 `queryEnemiesInRadius` 사용 — 전수 비교 아님(G1-레디) |
| 8 | 데미지 배율 | 발사체 수 페널티 미적용(count ❌) → `damage × damageFactor`만 |

---

## 10. 자동 결정 (autoplan 원칙 — 사용자 검토용)

duos(Codex)는 미설치라 서브에이전트 단독 격하, Design·DX 단계는 스코프 없어 생략. 아래는 6원칙으로 자동 결정한 항목이며 "계획 승인" 시 덮어쓸 수 있다.

| # | 결정 | 채택 | 원칙 | 기각 |
|---|------|------|------|------|
| 1 | 노바 반경 데이터 필드 | 기존 `explosionRadius` 재사용 | P4(DRY) | 신규 `novaRadius` — 범위 게이팅 중복 |
| 2 | enum 값 | `Nova = 'nova'`(즉발 버스트 전용) | P5(명시) | 광범위 `SelfAoE` — Aura와 혼동 |
| 3 | 적 없을 때 | 노바는 쿨다운마다 발동 | P1·기획 §10.1(self=조준 불필요) | 적 있을 때만 발동 — 특수 케이스·Aura 확장에 불리 |

---

## 11. 후속 / 백로그 영향

- **§12.1 출력 일반화 이월** — B안이라 비발사체 디스패치 일반화는 S5·S6·S8로 미뤄진다. 진입점이 늘면 일반화 재검토. (백로그 A1 노트에 반영)
- **F12** — 노바가 "explosionRadius 보유 + hitEffect≠explosion"의 정당한 사례. 데이터 검증(D2) 도입 시 F12 불변식을 노바 경로 포함하도록 넓혀야 함. (백로그 F12에 역링크)
- **밸런싱** — frost_nova의 damage/cooldown/explosionRadius는 placeholder(§14). 첫 30초 체감·자기중심 펄스 주기는 밸런싱 구간에서 확정.
