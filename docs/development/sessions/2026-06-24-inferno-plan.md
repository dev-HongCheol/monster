# 인페르노 슬라이스 계획 (inferno — 궤도형 회전 발사체)

- **작성일:** 2026-06-24
- **브랜치:** feat/inferno
- **슬라이스:** 마법 효과 레이어 — 신규 Orbit(궤도) 패턴 프리미티브 + 인페르노(화염 등급2)
- **상태:** 계획 (사용자 승인 대기)
- **관련 문서:** [마법 시스템 디자인](../../planning/magic-system-mage.md) §1·§3.2·§8·§9.2·§10.3·§11, [개발 백로그](../backlog.md) A1·A3·F16, [프로스트 노바 계획](2026-06-23-frost-nova-plan.md)

---

## 1. 배경 / 목적

이 문서는 같은 날 먼저 잡았던 인페르노 초안(자기중심 지속 지대 Aura + DOT)을 갈아엎은 결과다. 게임필을 다시 검토하면서 인페르노를 **궤도형 회전 발사체**로 정의했다. 뱀파이어 서바이버즈의 "킹 바이블(King Bible)" 계열에 해당한다.

인페르노는 쿨다운마다 플레이어 주위에 화염 오브 여러 개를 띄운다. 오브는 적을 향해 날아가지 않고 플레이어를 중심으로 한 링 위를 돌며, 그 궤도에 닿은 적에게 피해를 준다. 일정 시간(활성 수명)이 지나면 오브가 **전부 한꺼번에 사라지고**, 쿨다운이 지나면 다시 나타난다. 같은 자리에 머무는 적은 오브가 쓸고 지나갈 때마다 반복해서 맞지만, 시간이 지나며 누적되는 DOT가 아니라 어디까지나 **접촉 타격**이다. 마법사가 적을 끼고 돌면서 몸 주위를 주기적으로 안전지대로 만드는 역할이다.

이 슬라이스가 효과 레이어에서 두 가지를 처음 연다.

1. **Orbit(궤도) 패턴** — 발사체(이동·충돌·소멸)도, 즉발 버스트도, 바닥에 까는 지대도 아닌 네 번째 계열이다. 시전하면 플레이어를 중심으로 한 링 위를 도는 **지속 히트볼륨**이 생기고, 활성 수명이 끝나면 사라진다.
2. **강화 5종이 모두 붙는 첫 마법** — 데미지·쿨다운(재시전 간격)·발사체 수(오브 수)·범위(오브 크기)·지속시간(활성 수명)이 전부 의미를 가진다. 지속시간 강화로 활성 수명을 쿨다운보다 길게 키우면 사실상 끊김 없이 유지되는 빌드 보상이 나온다.

> **초안 대비 핵심 변경:** Aura·DOT·틱 주기(`tickPeriodSec`)·`AuraLogic`을 폐기하고, Orbit 패턴·동적 링 반경·재타격 락아웃·`OrbitLogic`을 도입한다. 다만 초안의 **수명(`lifetimeSec`) 개념과 `isDurationCapable` 확장은 그대로 살아남는다** — 인페르노가 쿨다운마다 시전돼 활성 수명 동안만 도는 사이클이라, 수명·지속시간 강화가 다시 필요하기 때문이다. 즉 이 설계는 "Aura의 생애주기(쿨다운 시전 + 수명 + 단일 인스턴스 갱신) × Orbit의 메커니즘(회전·접촉 타격·동적 링)"의 결합이다.

---

## 2. 스코프

### 포함

- **Orbit 패턴 프리미티브** — 시전하면 플레이어를 중심으로 한 링 위에 오브 N개가 `360°/N` 균등 각도로 배치돼 회전한다. 발사체가 아니며(생성 시점에 방향이 정해져 날아가지 않음) 즉발도 지대도 아니다. 활성 수명 D 동안 돌고 전부 사라진다.
- **쿨다운 시전 사이클** — 노바처럼 쿨다운마다 시전한다(스케줄러 `consume`). 시전 시 오브가 나타나고, 수명이 끝나면 전부 사라지며, 쿨다운이 지나면 재시전된다. 수명 < 쿨다운이면 오브가 없는 빈 구간이 생기고(= "사라졌다 나타남"), 지속시간·쿨다운 강화로 수명 ≥ 쿨다운이 되면 끊김 없이 유지된다.
- **적별·오브별 재타격 락아웃** — 한 오브가 어떤 적을 때리면, 그 (오브, 적) 짝은 `rehitCooldownSec` 동안 다시 타격하지 않는다. 다른 오브는 독립이라, 오브가 많을수록 같은 적도 더 자주 맞는다.
- **동적 링 반경** — 링 반경을 오브 수·오브 크기·플레이어 반경으로 계산해, 오브끼리 겹치거나 플레이어에 파묻히는 것을 막는다. "지구와 달"처럼 오브가 커지거나 많아지면 궤도가 바깥으로 밀려난다.
- **순수 `OrbitLogic`** — 회전각 누적, 활성 수명 카운트다운(단일 인스턴스 갱신), 재타격 락아웃 관리, 링 반경 기하를 담는 cc 비의존 로직. RED부터 단위 테스트한다.
- **비발사체 디스패치 경로** — `SpellCaster`가 패턴으로 분기해 Orbit 마법은 발사체를 만들지 않고, 시전 시 궤도를 띄우고 매 프레임 회전·충돌·타격하며 수명이 끝나면 거둔다(frost-nova의 B안 경로를 한 갈래 더 넓힌다, §4).
- **인페르노 데이터** — `spells.json` 항목 + i18n 키(`spell.inferno.name`).
- **강화 5종 전부:**
  - **데미지** — 타격당 피해 × `damageFactor` × **`projectilePenaltyFactor`(§7.6)**.
  - **쿨다운** — 재시전 간격. 기존 `effectiveCooldown` 재사용.
  - **발사체 수** — 오브 수(기본 2 + 강화, +1/레벨). `360/N` 재배치. `allowsProjectileCount: true`. §7.6 페널티 적용.
  - **범위** — 오브 충돌 반경(`projectileRadius`) × `rangeFactor`. Orbit 마법이 범위 카드 적격을 만든다.
  - **지속시간** — 활성 수명(`lifetimeSec`) × `durationFactor`. `lifetimeSec` 보유가 지속 카드 적격을 만든다(`isDurationCapable` 확장 — 초안의 그 확장을 그대로 쓴다).
- **오브 VFX 슬롯** — `@property orbVfxPrefab` + 오브 수에 맞춰 노드를 풀에서 꺼내/반환하고 매 프레임 오브 위치로 옮기며 크기에 맞춰 스케일하는 코드. 수명이 끝나면 전부 반환. 실제 프리팹/아트는 7단계에서 사용자가 에디터로 생성·연결.
- **수집 서브루프 공유 헬퍼(F16 부분)** — `_castNova`·`Projectile._detonate`·신규 궤도 충돌 세 곳이 글자 단위로 동일한 "반경 질의 → `ExplosionTarget[]` + `EnemyController[]` 병렬 수집" 블록을 쓴다(rule-of-three). 이를 `GameManager.collectTargetsInRadius(cx, cy, r) → {targets, ctrls}` 헬퍼로 떼어내 드리프트를 막는다. 중복 제거라 순 LOC는 ±0에 가깝다.

### 제외 (이월)

- **Aura(지속 DOT 지대) 프리미티브** — 인페르노가 더 이상 쓰지 않아 v1에서 쓰는 마법이 없다(인페르노의 수명·지속시간 강화는 살아남지만, "바닥에 깔려 틱하는 DOT 지대"라는 패턴 자체는 빠진다). 미래에 DOT 데미지 지대형 마법이 생기면 그때 도입한다.
- **빙결·낙하(메테오·썬더스톰)·폭풍(블리자드)·체인·빔** — A1의 나머지 효과 축. 계속 열림.
- **facing(A2)** — 자기중심이라 조준이 필요 없다(기획 §10.1 `self`).
- **§12.1 디스패치 출력 일반화** — Orbit가 두 번째 비발사체 패턴이라 같은 분기 문제가 반복되지만, 이번에도 B안(별도 경로)을 유지한다(§4). 비발사체 진입점이 더 늘면(S5 낙하·S6 폭풍·S8 빔) 한꺼번에 재검토한다.
- **저프레임 터널링 보정** — dt가 매우 크면 오브가 두 프레임 사이에 적을 건너뛸 수 있다. 정상 프레임에선 무관하므로 이번엔 보정하지 않고 엣지로만 기록한다(§10).
- **링 확장 시 시각 보간** — 오브 수·크기가 강화로 늘면 링이 바깥으로 톡 튀는 시각적 팝이 생긴다. 부드러운 보간은 폴리시로 이월(§10).

### 이 슬라이스가 닫는 백로그 항목

- **A1**(마법 효과 레이어)의 Orbit 축 — 궤도형 회전 히트볼륨 프리미티브 도입. A1 자체는 빙결·낙하·폭풍·체인·빔 잔여로 계속 열린다. 자기중심 축(노바·궤도)은 이 슬라이스로 마무리된다.
- **A3**(범위·지속시간 강화 활성화) — **이번 슬라이스로 양 축 모두 실대상을 더한다.** 범위는 오브 크기, 지속시간은 활성 수명이 대상이다. 지속시간은 magic-S2/S3의 CC 지속(정지·슬로우)에서 이미 활성화돼 있었으므로(`SpellCaster._buildStatusEffect`가 `durationFactor`를 곱한다), 인페르노는 **첫 비-CC 지속시간 대상**(오브 활성 수명)을 추가한다. A3는 이 슬라이스로 사실상 닫힌다.

---

## 3. 강화 매트릭스 (기획 §8 변경) — 5종 전부 ✅

| 옵션 | 인페르노 | 적용 대상 |
|------|---------|-----------|
| **데미지** | ✅ | 타격당 피해 × `damageFactor` × **`projectilePenaltyFactor`(§7.6)** |
| **쿨다운** | ✅ | 재시전 간격. `effectiveCooldown(spell)` |
| **발사체 수** | ✅ | 오브 수(기본 2 + 강화). `360/N` 재배치. `allowsProjectileCount: true` |
| **범위** | ✅ | 오브 크기(`projectileRadius`) × `rangeFactor`. 링 반경은 동적이라 직접 강화 대상 아님 |
| **지속시간** | ✅ | 활성 수명(`lifetimeSec`) × `durationFactor` |

**§7.6 발사체당 페널티를 적용하는 이유:** 궤도형은 오브를 늘리면 군집 커버리지뿐 아니라 **링 안의 단일 보스도 매 오브 통과마다 더 맞아** 단일·군집 양쪽에서 순이득이 된다. §7.6이 정확히 막으려는 "발사체 수 = 순수 이득" 상황이라, 타격당 피해에 `projectilePenaltyFactor(= 1 − r × 증가수)`를 곱해 다른 발사체 수 마법과 같은 트레이드오프 곡선에 둔다. 기획 §10.4의 페널티 적용 패턴 목록에 "궤도 오브"를 추가한다.

---

## 4. 디스패치 결정 — frost-nova의 B안 경로 확장

frost-nova에서 비발사체 패턴을 `SpellCaster`의 별도 경로로 분기하기로 정했다(B안: `buildFirePlan`은 발사체만 다루고, 자기중심 패턴은 컴포넌트에서 직접 실행). 인페르노도 같은 경로를 한 갈래 더 넓힌다 — `update` 디스패치에 `SpellPattern.Orbit` 케이스를 두고, 노바의 `_castNova`와 나란히 `_castOrbit`를 둔다.

노바와의 공통점은 둘 다 쿨다운마다 시전한다는 점이다(스케줄러 `consume`). 차이는 노바가 시전 즉시 한 번 피해를 주고 끝나는 반면, **인페르노는 시전이 궤도를 띄우고, 실제 피해는 이후 매 프레임 회전하는 오브가 적에 닿을 때 일어나며, 활성 수명이 끝나면 오브가 거둬진다**는 점이다. 그래서 회전·수명·타격 진행은 패턴 루프와 무관하게 매 프레임 `_advanceOrbits(dt)`가 처리한다.

**§12.1 출력 일반화 이월 유지:** Orbit는 노바에 이은 두 번째 비발사체 패턴이라, `buildFirePlan` 반환을 일반화하자는 §12.1의 방향이 다시 떠오른다. 그러나 이번에도 B안을 유지한다 — 기존 발사체 경로·테스트를 건드리지 않아 회귀 위험이 가장 작고, 일반화는 비발사체 진입점이 더 늘었을 때 한꺼번에 하는 게 합리적이다. 백로그 A1·F16에 "세 번째·네 번째 비발사체 패턴에서 일반화 재검토"로 남긴다.

---

## 5. 데이터 스키마 — inferno

`spells.json`에 한 항목을 추가한다. 수치는 전부 placeholder이며 밸런싱(기획 §14)에서 확정한다.

```jsonc
{
  "id": "inferno",
  "category": "fire",
  "tier": 2,
  "damage": 6,                 // placeholder — 타격당 피해
  "projectileSpeed": 0,        // 미사용(오브는 직선 이동 안 함)
  "projectileRadius": 14,      // 오브 충돌 반경(= 오브 크기). 범위 강화 대상
  "cooldown": 5.0,             // placeholder — 재시전 간격(쿨다운 강화 대상)
  "projectileCount": 2,        // 기본 오브 2개
  "pattern": "orbit",          // 신규 enum 값 SpellPattern.Orbit
  "allowsProjectileCount": true,
  "orbitRadius": 80,           // 기본(최소) 링 반경 = 휴식 거리. 동적 확장의 바닥값 + 범위 적격 게이트
  "rotationSpeedDeg": 120,     // deg/sec, 고정 회전 속도
  "rehitCooldownSec": 0.5,     // (오브, 적) 짝의 재타격 락아웃
  "lifetimeSec": 3.0           // placeholder — 오브 활성 수명(지속시간 강화 대상)
}
```

**필드 의미 — `orbitRadius`는 "고정 반경"이 아니다.** 동적 링(§6)의 **바닥값(휴식 거리)**이다. 오브가 적고 작을 때 링은 이 값에 머물고, 오브가 많거나 커지면 겹침·플레이어 충돌을 피하려 그 이상으로 밀려난다.

**카드 적격 게이트 확장(`EnhancementLogic`):**

- `isRangeCapable`: 현재 `explosionRadius !== undefined` → **`orbitRadius !== undefined`도 OR로 더한다.** Orbit 마법은 오브 크기를 범위로 키운다. (게이트 키는 `orbitRadius` 보유, 곱하는 대상은 `projectileRadius` — 약간의 간접이라 코드 주석으로 남긴다.)
- `isDurationCapable`: 현재 `onHitStatus !== undefined` → **`lifetimeSec !== undefined`도 OR로 더한다.** 이 확장은 초안(Aura)이 예고했던 것과 동일하다 — `EnhancementLogic.ts:99`의 기존 주석 "DOT·오라 지속(인페르노 등)은 magic-S4에서 OR로 더한다"가 가리키던 바로 그 확장이다. 인페르노의 활성 수명이 그 첫 비-CC 지속 대상이다.
- 쿨다운·데미지·발사체 수: 기존 게이트 그대로(전 공격 마법 ✅, 발사체 수만 `allowsProjectileCount` 게이트). **`allowsCooldown` 같은 신규 게이트는 도입하지 않는다** — 인페르노는 쿨다운 ✅이라 일반 경로를 그대로 탄다.

**카드 적격 요약(§8 매트릭스):** 데미지 ✅ · 쿨다운 ✅ · 발사체 수 ✅ · 범위 ✅(오브 크기) · **지속시간 ✅(활성 수명)** — 5종 전부.

---

## 6. 메커니즘 상세

### 6.1 재타격 락아웃 — 0.5초는 "체크 주기"가 아니라 데미지 락아웃

충돌 판정 자체는 매 프레임 돈다. `rehitCooldownSec`(0.5초)는 **같은 오브가 같은 적을 다시 때리기까지의 잠금 시간**이다. placeholder 수치 기준 타이밍을 따져보면 왜 안전한지 나온다.

- 오브 접선 속도 = 링 반경 × 회전 각속도 ≈ 80 × (120° → 2.09 rad/s) ≈ **167 units/s**
- 한 오브가 고정된 적을 쓸고 지나가는 **접촉 시간** ≈ 오브 지름 / 접선 속도 ≈ 28 / 167 ≈ **0.17초**
- 같은 오브가 한 바퀴 돌아 그 적에 **다시 오는 주기** = 360° / 120°s = **3초**

즉 `접촉(0.17s) < 락아웃(0.5s) < 재방문(3s)`이다. 락아웃이 접촉 시간보다 길어 **한 번 통과 = 1히트**로 깔끔하게 정리되고, 재방문 주기보다는 짧아 다음 바퀴의 타격은 막지 않는다. 오브 10개면 각 오브가 36°마다 있어 고정된 적은 `36° / 120°s = 0.3초`마다 다른 오브에 맞는다(초당 약 3.3히트). 프레임 수에 좌우되지 않고 예측 가능하다.

동적 링(§6.2) 덕분에 오브가 커지면 링도 같이 커져 접선 속도가 비례해 빨라지므로, 접촉 시간이 거의 일정하게 유지된다. 그래서 0.5초 락아웃은 범위 만렙에서도 그대로 유효하다.

**락아웃은 활성·비활성과 무관하게 자연 감소한다.** 오브가 수명을 다해 사라진 뒤 쿨다운 동안에도 `tickRehit(dt)`가 락아웃을 계속 깎으므로, 다음 시전 때는 대개 비어 있다(빈 구간이 0.5초보다 길면 완전히 비고, 짧으면 잔여가 한 틱 정도 영향). 별도 강제 초기화는 두지 않는다.

### 6.2 동적 링 반경 — 겹침·충돌 회피 (지구-달)

링 반경을 고정하면 오브가 최대(10개)이고 범위 강화로 커졌을 때 `360/10 = 36°` 간격에서 서로 겹친다. 그래서 링 반경을 오브 수·크기로 계산한다. 순수 기하라 `OrbitLogic`에 단위 테스트 가능한 함수로 둔다.

```
ringRadius(count, orbSize, playerRadius):
  // ① 인접 오브가 안 겹치게: 중심간 현(chord) = 2R·sin(π/N) ≥ 2·orbSize
  spacingRing   = count >= 2 ? orbSize * (1 + ORB_GAP) / sin(π / count) : 0
  // ② 플레이어에 안 파묻히게
  clearanceRing = playerRadius + orbSize + ORB_MARGIN
  // ③ 휴식 거리 바닥값(데이터 orbitRadius)
  return max(spacingRing, clearanceRing, baseRing)
```

검증(`baseRing = 80`, `ORB_GAP`·`ORB_MARGIN`은 작은 상수):

- **2개·작은 오브(14):** spacing이 작아 바닥값 80에서 휴식. 두 오브가 마주 보고 돈다.
- **10개·작은 오브(14):** spacing = 14 / sin18° ≈ 45 < 80 → 여전히 80, 겹치지 않는다.
- **10개·큰 오브(40, 범위 만렙):** spacing = 40 / sin18° ≈ 130 → 링이 130으로 **확장**, 겹치지 않는다.

`count = 1` 가드: `sin(π/1) = 0`이라 0 나눗셈이 나므로 `count >= 2`일 때만 `spacingRing`을 계산한다(인페르노 기본은 2라 미발현이지만 방어).

### 6.3 오브 수 상한

기본 2 + (개별 발사체 수 cap 4 + 분류 cap 4) = **최대 10개**다(`projectileBonus`가 개별·분류 가산이라). 동적 링과 §7.6 페널티는 이 상한을 전제로 설계됐다.

### 6.4 생애주기 — 시전 → 활성 수명 → 소멸 → 재시전

- **시전(쿨다운마다):** `_castOrbit`이 강화 반영값을 **시전 시점에 스냅샷**해 단일 궤도 인스턴스를 띄운다(폭발·노바와 일관). 오브는 즉시 나타나 회전하며 접촉 타격을 시작한다(DOT처럼 첫 틱을 기다리지 않는다).
- **활성 수명:** `OrbitLogic`이 수명을 매 프레임 깎는다. 수명이 0이 되면 그 인스턴스는 만료로 표시되고 오브 VFX가 전부 반환된다.
- **재시전이 수명보다 빠를 때(수명 > 쿨다운, 강화 시 의도 상태):** 단일 인스턴스를 **갱신**한다 — 수명·오브 수·크기·데미지를 새 스냅샷으로 덮어쓴다. 인스턴스가 둘로 늘지 않는다. 이때 VFX 노드도 새로 acquire하지 말고 기존 것을 재사용해야 한다(§7 A-1).
- **수명 < 쿨다운:** 오브가 사라진 뒤 다음 시전까지 빈 구간이 생긴다(= 사용자가 말한 "전체가 없어졌다 나타남"). 정상 동작.

---

## 7. 아키텍처

### 순수 로직 — `OrbitLogic`

회전각·활성 수명·재타격 락아웃·링 기하를 관리하는 cc 비의존 로직이다. 마법 1종당 궤도 하나(단일 인스턴스, 재시전은 갱신).

```
OrbitLogic:
  상수: ORB_GAP, ORB_MARGIN              // 링 간격·플레이어 여유(겹침/충돌 회피)
  _orbits: Map<spellId, { theta, remainingLife, count, orbSize, damage, rotationSpeedDeg }>
  _rehit:  Map<string, number>           // 키 `${orbIndex}:${spawnId}` → 잔여 락아웃(sec)

  spawn(spellId, { count, orbSize, damage, lifetime, rotationSpeedDeg }):
    // 이미 있으면 갱신(전 필드 새 스냅샷으로 덮어쓰고 theta는 유지), 없으면 신규. 단일 인스턴스.

  advance(dt) -> { active: {spellId, count, orbSize, damage}[], expired: spellId[] }:
    // 각 궤도마다: theta = (theta + rotationSpeedDeg*dt) mod 360
    //            remainingLife -= dt; <=0 이면 expired에 넣고 제거, 아니면 active에 넣음

  ringRadius(count, orbSize, playerRadius) -> number      // §6.2 공식

  orbPositions(spellId, count, ring, cx, cy) -> {x,y}[]:
    // angle_i = theta + i*(360/count), 각 오브의 월드 좌표

  tickRehit(dt):                          // 모든 락아웃 감소, <=0 제거
  canHit(orbIndex, spawnId) -> bool:      // 락아웃에 없으면 true
  registerHit(orbIndex, spawnId, cooldownSec):
```

**테스트 대상(RED):** `360/N` 균등 배치, 회전 전진·360 wrap, 활성 수명 카운트다운·`expired`, 재시전 갱신 시 단일 인스턴스 + 수명·수·크기·데미지 재스냅샷, `ringRadius` 세 분기 + `count=1` 가드, 락아웃 차단·해제, 오브별·적별 독립.

### 컴포넌트 — `SpellCaster`

```
update(dt):
  ... scheduler.tick, aim 계산(기존) ...
  for each ready spell:
    if (pattern === Nova):  consume(effectiveCooldown); _castNova(spell)     // frost-nova
    elif (pattern === Orbit): consume(effectiveCooldown); _castOrbit(spell)  // 신규 — 궤도 시전/갱신
    else: ... 발사체 경로(기존) ...
  _advanceOrbits(dt)          // 패턴 루프와 무관하게 매 프레임 회전·수명·타격

_castOrbit(spell):
  count    = effectiveProjectileCount(spell)                    // 기본 2 + 보너스
  orbSize  = spell.projectileRadius * rangeFactor(spell)
  damage   = spell.damage * damageFactor(spell) * projectilePenaltyFactor(spell)  // §7.6
  lifetime = spell.lifetimeSec * durationFactor(spell)
  _orbitLogic.spawn(spell.id, { count, orbSize, damage, lifetime, rotationSpeedDeg: spell.rotationSpeedDeg })
  _reconcileOrbVfx(spell.id, count)                             // 멱등 — 오브 노드 수를 count에 맞춤(A-1)

_advanceOrbits(dt):
  _orbitLogic.tickRehit(dt)
  { active, expired } = _orbitLogic.advance(dt)
  center = this.node.position
  for { spellId, count, orbSize, damage } in active:
    ring = _orbitLogic.ringRadius(count, orbSize, playerCollisionRadius)
    positions = _orbitLogic.orbPositions(spellId, count, ring, center.x, center.y)
    for orbIndex, pos in positions:
      _applyOrbHit(orbIndex, pos, orbSize, damage)
      _positionOrbVfx(spellId, orbIndex, pos, orbSize)          // 위치·스케일 갱신
  for spellId in expired: _releaseAllOrbVfx(spellId)            // 오브 전부 반환

_applyOrbHit(orbIndex, pos, orbSize, damage):
  { targets, ctrls } = GameManager.instance.collectTargetsInRadius(pos.x, pos.y, orbSize)  // F16 공유 헬퍼
  hits = selectExplosionHits(pos.x, pos.y, orbSize, targets, new Set())   // 이번 오브의 접촉 적
  for idx in hits:
    if (_orbitLogic.canHit(orbIndex, targets[idx].id)):
      ctrls[idx].takeDamage(damage)
      _orbitLogic.registerHit(orbIndex, targets[idx].id, rehitCooldownSec)
```

핵심 설계점:

- **오브 VFX는 수명·오브 수에 종속된다.** 폭발·노바 VFX는 `scheduleOnce`로 고정 시간 뒤 반환했지만, 오브는 가변 수명 동안 돌고 수가 강화로 바뀐다. 그래서 `SpellCaster`가 `spellId → orbNode[]` 맵을 들고, 매 프레임 오브 위치로 옮기며, `count`가 바뀌면 풀에서 더 꺼내거나 반환하고(`_reconcileOrbVfx`), 수명이 끝나면 전부 반환한다(`_releaseAllOrbVfx`). VFX 스케일 기준 반경은 `ORB_VFX_BASE_RADIUS` 상수로 둔다(노바의 `NOVA_VFX_BASE_RADIUS`와 같은 패턴).
- **`_reconcileOrbVfx`는 멱등이어야 한다(A-1, HIGH).** 재시전 때(수명 > 쿨다운으로 활성 중 재시전) 맵에 이미 오브 노드가 있으면 새로 acquire하지 말고 수를 맞춰 재사용한다. 그러지 않으면 활성 노드를 풀로 반환하지 못한 채 참조를 덮어써 누수가 난다. placeholder 수치(수명 3.0 < 쿨다운 5.0)에선 만료 후 재시전이라 잠복하지만, **지속시간·쿨다운 강화로 수명 ≥ 쿨다운 상태에 들어가는 순간** 매 쿨다운마다 노드가 샌다. 이는 `OrbitLogic.spawn`이 단일 인스턴스 갱신을 지키는 것의 VFX 쪽 짝이다(초안 Aura의 A-1 지적이 그대로 유효).
- **수치 스냅샷.** 오브 수·크기·데미지·수명은 시전 시점의 강화값으로 고정한다. 수명 중 강화가 바뀌어도 다음 재시전(쿨다운마다) 때 새 값으로 갱신된다 — 폭발·노바와 일관.
- **일시정지는 자동.** `_advanceOrbits`가 `update` 안에서 불리고, `update`는 `GameState.Playing`이 아니면 조기 반환하므로, 레벨업·게임오버 중에는 회전·수명·타격이 함께 멈췄다가 재개된다.
- **`node.position`을 매 프레임 새로 읽는다(Vec3 에일리어싱 회피).** 중심 좌표(`center.x`/`center.y`)를 프레임마다 읽어 오브 위치를 계산하고, 내부 벡터 참조를 궤도 상태에 저장하지 않는다.
- **수집 헬퍼 `collectTargetsInRadius` 공유(F16 부분).** `_castNova`·`Projectile._detonate`·신규 `_applyOrbHit` 세 곳이 같은 수집 블록을 쓰므로(rule-of-three) `GameManager`에 헬퍼로 올린다. dedup·VFX·피해 적용은 호출부마다 달라 그대로 남긴다.

### 순수 로직 — `buildFirePlan`의 Orbit 케이스

`SpellPatternLogic.buildFirePlan`에 `case SpellPattern.Orbit: return []`를 추가한다. 오브는 발사체를 만들지 않으므로 빈 배열이 맞다. 명시적 케이스가 없으면 `default → directionalPlan`으로 떨어져 발사체를 만들어 버린다(잠재 버그). 실제 궤도 실행은 `_castOrbit`/`_advanceOrbits`가 하지만, 디스패처가 Orbit에 대해 발사체를 만들지 않는다는 계약을 이 케이스가 보장하고 테스트한다.

---

## 8. 변경 파일

| 파일 | 변경 |
|------|------|
| `data/GameTypes.ts` | `SpellPattern`에 `Orbit = 'orbit'` 추가 + `ISpellData`에 `orbitRadius?`·`rotationSpeedDeg?`·`rehitCooldownSec?`·`lifetimeSec?` 추가. `allowsProjectileCount` JSDoc의 "자기중심(인페르노·프로스트노바) ❌" 예시에서 인페르노 제거(이제 ✅) |
| `logic/OrbitLogic.ts` | 신규 — 회전각·활성 수명·재타격 락아웃·링 반경 순수 로직 |
| `logic/SpellPatternLogic.ts` | `buildFirePlan`에 `case Orbit → []` 추가 |
| `logic/EnhancementLogic.ts` | `isRangeCapable`에 `orbitRadius` OR + `isDurationCapable`에 `lifetimeSec` OR. `projectileBonus`·`buildUpgradeCards` JSDoc의 "자기중심(인페르노) ❌" 예시에서 인페르노 제거 |
| `components/SpellCaster.ts` | `update` 디스패치에 Orbit 분기(`consume` + `_castOrbit`) + `_advanceOrbits`·`_applyOrbHit`·`_reconcileOrbVfx`·`_positionOrbVfx`·`_releaseAllOrbVfx` + 오브 VFX 풀·맵 + `@property orbVfxPrefab` |
| `systems/GameManager.ts` | 신규 헬퍼 `collectTargetsInRadius(cx, cy, r) → {targets, ctrls}` (F16 부분) |
| `components/Projectile.ts` | `_detonate`의 인라인 수집 루프를 `collectTargetsInRadius` 호출로 교체(F16 부분) — 동작 무변경 |
| `resources/data/spells.json` | `inferno` 항목 추가 |
| `resources/i18n/ko.json`·`en.json` | `spell.inferno.name` 키 추가 |
| `tests/logic/OrbitLogic.test.ts` | 신규 (RED) — 회전·배치·수명·갱신·링 반경·재타격 락아웃 |
| `tests/logic/Inferno.test.ts` | 신규 (RED) — 디스패치 계약 + 카드 적격(5종) |

11개 파일 — Safety Rules의 "5개 이상 동시 수정 시 먼저 계획 공유" 기준에 맞춰 이 문서로 공유한다. (`GameManager.ts`·`Projectile.ts`는 F16 부분 추출로 추가된 동작 무변경 리팩터.)

> **피처 테스트 파일명:** ready-impl의 RED 게이트는 피처명 PascalCase 테스트(`Inferno.test.ts`)를 찾아 돌린다. 그래서 디스패치·적격 계약은 `Inferno.test.ts`에 두고, 순수 회전·수명·기하 로직은 `OrbitLogic.test.ts`로 분리한다.

---

## 9. 테스트 계획 (RED 대상)

| 코드패스 | 종류 | 커버리지 |
|---------|------|---------|
| `OrbitLogic.orbPositions` — `360/N` 균등 배치, 회전각 반영 | 순수 | **신규 단위** — 각도·좌표 수식(RED→GREEN) |
| `OrbitLogic.advance` — 회전 전진·360 wrap + 활성 수명 카운트다운·`expired` | 순수 | **신규 단위** — 회전·수명 만료 |
| `OrbitLogic.spawn` 갱신 — 재시전 시 단일 인스턴스 + 수명·수·크기·데미지 재스냅샷 | 순수 | **신규 단위** — 수명만 리셋이 아니라 수치까지 새로 덮어쓰는지 단언(§6.4 회귀 방지) |
| `OrbitLogic.ringRadius` — 바닥값/간격 확장/clearance 3분기 + `count=1` 가드(0 나눗셈 방어) | 순수 | **신규 단위** — §6.2 공식 검증(2개·10개·큰 오브) |
| `OrbitLogic` 재타격 락아웃 — 락아웃 중 차단, 경과 후 허용, 오브별·적별 독립 | 순수 | **신규 단위** — `canHit`/`registerHit`/`tickRehit` + 키 분리 |
| `buildFirePlan(pattern=Orbit)` → `[]`, count>1에도 `[]` | 순수 | **신규 단위** — 궤도가 발사체를 만들지 않음(RED→GREEN) |
| inferno 카드 적격: 데미지 ✅·쿨다운 ✅·발사체 수 ✅·**범위 ✅·지속 ✅** | 순수 | **신규 단위** — `EnhancementLogic.buildUpgradeCards`를 실데이터로 검증(§3 매트릭스). 범위·지속 ✅는 `isRangeCapable`/`isDurationCapable` 확장 전엔 RED |
| `selectExplosionHits`(중심=오브 위치) | 순수 | 기존 `ExplosionLogic.test`로 커버(재사용) |
| `_castOrbit`·`_advanceOrbits`·`_applyOrbHit` 그리드 질의 → 접촉 타격 | 컴포넌트 | 수동 인게임(Cocos) |
| 오브 VFX 수 재조정·플레이어 추종·크기 스케일·수명 끝 반환·풀링(A-1 멱등) | 컴포넌트 | 수동 인게임(Cocos) |
| 동적 링 — 오브 수·크기 강화 시 링 확장(겹침 없음) | 컴포넌트 | 수동 인게임(Cocos) |
| 사이클 — 시전→수명→소멸→재시전(수명<쿨다운 빈 구간 / 수명≥쿨다운 끊김 없음) | 컴포넌트 | 수동 인게임(Cocos) |
| 레벨업 중 회전·수명·타격 정지·재개 | 컴포넌트 | 수동 인게임(Cocos) |

**RED 게이트:** `tests/logic/Inferno.test.ts`가 구현 전에 실패해야 한다. `buildFirePlan(Orbit)`는 구현 전엔 `default → directionalPlan`으로 빈 배열이 아닌 발사체를 돌려주고, 범위·지속 적격은 `isRangeCapable(orbitRadius)`·`isDurationCapable(lifetimeSec)` 확장 전엔 false라 둘 다 RED다.

---

## 10. 엣지 / 실패 모드

| # | 상황 | 처리 |
|---|------|------|
| 1 | **적 없음** | 오브는 수명 동안 회전(VFX만, 0히트). 자기중심이라 aim 없이 동작 |
| 2 | `count = 1`(데이터 이상) | `ringRadius`가 `count>=2`에서만 간격 계산 → 0 나눗셈 방어. 인페르노 기본 2라 미발현 |
| 3 | 프레임 스파이크(큰 dt) | 회전이 크게 점프해 오브가 적을 건너뛸 수 있음(터널링). 수명도 그만큼 깎임(클램프 0). 정상 프레임에선 무관. 이번엔 보정 안 함(이월, §2) |
| 4 | 재시전이 수명보다 빠름(수명 ≥ 쿨다운) | 단일 인스턴스 재스냅샷(수명·수·크기·데미지 갱신, 스택 없음). 끊김 없이 유지 |
| 4b | **재시전 시 VFX 노드 누락(A-1)** | `_reconcileOrbVfx` 멱등 — 이미 있으면 재사용. 안 그러면 수명 ≥ 쿨다운(강화 시 의도 상태)에서 매 쿨다운 노드 누수 [핵심] |
| 5 | `orbVfxPrefab` 미연결 | 피해는 동작, VFX만 생략(폭발·노바 선택 슬롯과 동일) |
| 6 | 범위 강화로 오브 커짐 | `rangeFactor`가 오브 크기에 곱해지고, 링이 겹침 회피로 확장. 접촉 시간은 거의 일정(§6.1) |
| 7 | 레벨업·게임오버 중 | `update` 게이트로 회전·수명·타격 정지 → 재개 |
| 8 | 씬 리로드(재시작) | 오브·VFX는 씬과 함께 사라짐. `OrbitLogic`은 컴포넌트 멤버라 함께 폐기. 별도 teardown 불필요 |
| 9 | 링 확장 시 시각 팝 | 오브가 바깥으로 톡 튐. 보간은 폴리시로 이월(§2) |

---

## 11. 후속 / 백로그 영향

- **A1 계속 열림** — 빙결·낙하(메테오·썬더스톰)·폭풍(블리자드)·체인·빔이 남는다. 자기중심 축(노바·궤도)은 이 슬라이스로 마무리. **Aura(지속 DOT 지대) 패턴은 v1 미사용으로 A1에서 빠진다** — 인페르노의 수명·지속시간 강화는 살아남지만 "바닥에 깔려 틱하는 DOT 지대"는 쓰는 마법이 없다. 미래 DOT 데미지 지대형 마법이 생기면 그때 도입.
- **A3 사실상 닫힘** — 범위(오브 크기)·지속시간(활성 수명) 둘 다 인페르노가 실대상을 추가한다. 지속시간은 magic-S2/S3 CC 지속에 이어 인페르노가 **첫 비-CC 대상**을 더한다. 백로그 A3를 「완료」로 옮길 후보(잔여 no-op 없음).
- **F16 부분 닫힘** — 수집 서브루프를 `collectTargetsInRadius`로 추출해 `_castNova`·`_detonate`·`_applyOrbHit` 3곳이 공유한다. 백로그 F16을 "수집 서브루프 추출됨 / dedup 수명 통합 잔여"로 갱신하고, 남은 통합은 §12.1 출력 일반화와 함께 묶을 후보로 남긴다.
- **D2 실데이터 sanity 테스트** — 인페르노가 `pattern`/`orbitRadius`/`rotationSpeedDeg`/`rehitCooldownSec`/`lifetimeSec` 필드를 더한다. frost-nova 리뷰 M-2가 제안한 실 `spells.json` 로드 sanity 테스트가 생기면 이 필드들도 단언 대상에 포함.
- **밸런싱** — `damage`·`cooldown`·`lifetimeSec`·`orbitRadius`·`rotationSpeedDeg`·`rehitCooldownSec`·오브 크기 전부 placeholder(§14). 초당 피해 = 오브 수 × 접촉 빈도 × 타격당 피해, 그리고 활성 수명/쿨다운 비율(빈 구간 길이)이 궤도형의 체감 안전지대·보상을 좌우 — 밸런싱 구간에서 확정. `ORB_GAP`·`ORB_MARGIN`·`ORB_VFX_BASE_RADIUS` 상수도 튜닝 대상.

---

## 12. 자동 결정 (사용자 검토용)

아래는 설계 대화(2026-06-24)에서 사용자가 직접 정했거나 6원칙으로 자동 결정한 항목이다. "계획 승인" 시 덮어쓸 수 있다.

| # | 결정 | 채택 | 근거 | 기각 |
|---|------|------|------|------|
| 1 | 인페르노 정의 | 궤도형 회전 발사체(Orbit) | 사용자 결정 2026-06-24 — DOT 아님, 접촉 타격 | 초안 Aura+DOT |
| 2 | 생애주기 | 쿨다운 시전 + 활성 수명 후 전체 소멸 → 재시전(VS 킹 바이블) | 사용자 결정 — "오브가 전체가 없어졌다 나타남" | 상시 ON(쿨다운 없음) — 이전 결정 뒤집음 |
| 3 | 강화 5종 | 데미지·쿨다운·발사체수·범위(오브 크기)·지속시간(활성 수명) 전부 ✅ | 사용자 결정 — 지속시간 ✅ | 쿨다운/지속시간 일부 ❌ |
| 4 | 재타격 규칙 | 적별·오브별 재타격 락아웃 | 사용자 결정 — VS 성경식, 프레임 독립·예측 가능 | 통과 1회+재진입 / 매 프레임 접촉(DOT) |
| 5 | 링 반경 | 동적(오브 수·크기·플레이어 반경) | 사용자 결정 — 겹침·충돌 회피("지구-달") | 고정 반경 — 만렙에서 오브 겹침 |
| 6 | 범위 강화 대상 | 오브 크기(`projectileRadius`) | 사용자 결정 — 링은 동적이라 직접 강화 안 함 | 링 반경 강화 |
| 7 | 발사체 수 페널티 | §7.6 적용(타격당 피해에 곱) | 궤도 발사체 수는 단일·군집 순이득 → 프레임워크 일관 | 미적용 — 순수 이득 방치 |
| 8 | 구현 접근 | A(`SpellCaster` 궤도 경로 + 순수 `OrbitLogic`) | 기존 발사체 경로 무변경·회귀 최소·확립된 패턴 | B(`Projectile` 개조) / C(환형 지대) |
| 9 | F16 수집 헬퍼 | 수집 서브루프만 추출 | 드리프트 차단 + 순 LOC ±0 | 주석만 / 전체 추출(스코프 확대) |

---

## 13. 추가 작업 — 강화 테스트 도구 + 궤도 패킹(orbGap) (2026-06-25)

> 이 절은 인페르노가 `user-verification`(6단계 완료, 검토용 Draft PR 존재)에 있던 중 추가한 작업을 기록한다. 강화 밸런스를 직접 확인하려다 나온 두 갈래이며, `리워크`로 `implementation`에 복귀해 작업했다. (원래 별도 세션 문서였으나 이 플랜에 병합했다.)

### 13.1 배경

강화는 개별·분류·전역 × 5종 옵션이라 조합이 많아, 인게임에서 레벨업 카드를 일일이 뽑아 특정 레벨 조합을 만들기가 번거로웠다. 사용자가 "데이터로 강화 레벨을 미리 주입해 시작하고 싶다"고 했다. 처음엔 `spells.json`의 인페르노 기본 수치를 강화 효과값으로 바꿔 미리보는 방안을 시도했으나, 강화 배율 곡선을 실제로 태우는 게 아니라 기본값을 바꾸는 것이라 의도와 달랐다. 그래서 강화 시스템을 실제로 거치는 시드 방식으로 방향을 잡았다.

### 13.2 DEV 강화 시드 도구

카드 픽 없이 강화 레벨을 주입하는 DEV 전용 도구다.

- 파싱·검증은 순수 로직 `logic/DebugEnhancementSeed.ts`로 분리했다(ADR 002). 시드 JSON을 개별·분류 `raise` op과 전역 보너스 op으로 정규화하고, 알 수 없는 옵션·범위 밖 레벨을 방어적으로 거른다.
- 적용은 `systems/DeckManager.ts`가 맡는다. `start()`에서 `cc/env`의 `DEV`일 때만 `data/debug-enhancements.json`을 로드해 `applyDebugSeed`로 강화 트랙에 누적한다. 릴리스 빌드는 로드 자체를 안 하고, 파일이 없으면 조용히 무시한다(시드 미사용 = 정상).
- 시드 데이터는 `resources/data/debug-enhancements.json`. 마법별 개별/분류 강화 레벨과 전역 보너스를 적는다. 사용법은 QA 문서 §8 참고.

### 13.3 궤도 패킹을 데이터로 — orbGap (B안)

"발사체가 많을 때 오브가 조금씩 겹치고 플레이어에 더 가까이 돌면 좋겠다"는 요구가 나왔다. 기존 링 반경은 `OrbitLogic.ringRadius`가 간격·파묻힘 여유·바닥값의 최댓값으로 정하는데, 겹침 간격을 정하는 `ORB_GAP`(0.15)이 **코드 상수**여서 데이터만으로는 조절할 수 없었다. (A) 상수를 직접 낮추기와 (B) spell 데이터에 `orbGap` 필드를 추가해 마법별로 조절하기 중, 사용자가 데이터 튜닝 흐름을 원해 **B안**을 택했다.

- `ISpellData.orbGap?`를 추가하고(생략 시 기본 `ORB_GAP`), `ringRadius`에 `gap` 파라미터(기본값 `ORB_GAP`)를 더했다. `SpellCaster._advanceOrbits`가 `spell?.orbGap`을 넘긴다.
- `gap`이 음수면 인접 오브 간 현이 `2·orbSize`보다 작아져 겹침을 허용하고, 그만큼 간격 항이 줄어 링이 안쪽으로 당겨진다. 오브가 적을 때는 바닥값(`orbitRadius`)·파묻힘 여유가 지배해 영향이 거의 없다 — 즉 발사체가 많아질수록 자연스럽게 겹치며 가까워진다.
- 인페르노는 `orbGap: -0.1`로 두되 `spells.json`에서 자유롭게 조절한다. §6.2 `ringRadius` 의사코드의 `ORB_GAP` 상수 자리에 이제 데이터 `orbGap`(미지정 시 `ORB_GAP`)이 들어온다.

### 13.4 변경 파일 (추가분)

| 파일 | 변경 |
|---|---|
| `logic/DebugEnhancementSeed.ts` (신규) | 시드 JSON → 강화 op 정규화(순수, 방어적 검증) |
| `systems/DeckManager.ts` | DEV 게이트 `start()` 로드 + `applyDebugSeed` |
| `resources/data/debug-enhancements.json` (신규) | 강화 시드 데이터 |
| `data/GameTypes.ts` | `ISpellData.orbGap?` |
| `logic/OrbitLogic.ts` | `ringRadius`에 `gap` 파라미터 |
| `components/SpellCaster.ts` | `ringRadius`에 `spell?.orbGap` 전달 |
| `resources/data/spells.json` | 인페르노 `orbGap: -0.1` |
| `tests/logic/DebugEnhancementSeed.test.ts` (신규) | 파서 7케이스 |
| `tests/logic/OrbitLogic.test.ts` | gap 케이스 2개 |

검증(로컬): 전체 스위트 270/270, 편집 파일 TS 진단 0건, lint clean.

### 13.5 미결 — 스코프 결정 대기

DEV 강화 시드 도구는 인페르노에 한정되지 않는 **재사용 가능한 테스트 인프라**다. 인페르노 PR에 함께 넣을지, 별도 슬라이스로 분리할지는 사용자 판단을 기다린다. 반면 `orbGap`은 인페르노 자체 동작(링 패킹) 변경이라 인페르노 작업 범위에 포함된다. 7단계 재진입 시 검증 파이프라인(`start-verification` → cso·ts·lint·review)을 다시 통과시키고 Draft PR을 push로 갱신한다.
