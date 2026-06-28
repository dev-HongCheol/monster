# 적 로스터 S2a — 적 발사체(구미호) QA 체크리스트

- **브랜치:** feat/enemy-projectile
- **슬라이스:** S2a (원거리 발사체 적 첫 도입 — 구미호 단발)
- **계획:** [2026-06-27-enemy-projectile-plan.md](../development/sessions/2026-06-27-enemy-projectile-plan.md)
- **선행(머지 완료):** player-iframe(전역 i-frame + 틱당 max 피해 게이트, PR #43) — 발사체·접촉 피해가 이 게이트에 제출된다.

> 이 문서는 qa-setup 단계(구현 전)에 작성됐다. **§3 프리팹/씬·§4 에디터 연결은 구현 결과에 따라 확정**되므로, 구현 완료 후(7단계 진입 전) 실제 컴포넌트의 `@property`·노드 구조에 맞춰 갱신한다(현재는 계획 기준 잠정안).

---

## 1. 자동 테스트로 검증 (`tests/logic/EnemyProjectile.test.ts`)

> **통과 (GREEN, 2026-06-28):** 피처 22/22 · 전체 스위트 330/330. 통과 커밋: 본 슬라이스 구현 커밋(아래 PR 커밋 로그).

**`EnemyAttackLogic.tickAttack` (공격 FSM):**

- [x] 한 바퀴 순환: Aim→Telegraph→Fire→Cooldown→Aim
- [x] **한 주기에 정확히 한 번만 발사**(발동당 1타·재발사 없음) — 핵심
- [x] Fire 직후 Cooldown 틱들은 재발사하지 않음
- [x] 사거리 밖이면 Aim 유지(텔레그래프 안 함)
- [x] `range<=0`이면 사거리 무제한(멀어도 발동)
- [x] 조준 잠금(`lockDir`)은 Aim→Telegraph 진입 에지에서만 반환
- [x] 영벡터 잠금(겹침) → 텔레그래프 건너뛰고 Aim 유지
- [x] 커밋: 윈드업 중 사거리 이탈해도 발사
- [x] `canAct=false` 전체 동결 — 상태·타이머 불변, 무발사
- [x] `telegraphTime=0` 즉발, `cooldown=0` 하한 클램프
- [x] dt 오버슈트 시 한 상태만 전이(건너뜀 없음)

**`MovementLogic.kiteDirection` (유격):**

- [x] 선호 사거리+밴드보다 멀면 접근(플레이어 향 단위벡터)
- [x] 선호 사거리−밴드보다 가까우면 후퇴(반대)
- [x] **데드존(밴드 안)이면 영벡터**(경계 떨림 0) — 핵심
- [x] 겹침(영벡터 입력) → 영벡터, NaN 없음
- [x] `preferredRange=0` → 추격 폴백(항상 접근)

**데이터 정합(`enemies.json`·`spawn-table.json`):**

- [x] `kumiho`: `movement=kite`, `preferredRange>0`
- [x] `kumiho`: `attack.type=projectile_single`, `damage>0`, `cooldown>0`, `telegraphTime>=0`
- [x] `kumiho`: `projectile.speed>0`·`radius>0`·`count>=1`
- [x] spawn-table 참조 enemyId가 전부 enemies.json에 존재(무결성)
- [x] `kumiho`가 spawn-table에 편입돼 실제 스폰됨

---

## 2. Impact Map (회귀 테스트 기준)

| 변경 | 영향 범위 — 확인할 것 |
|------|----------------------|
| **신규** `logic/EnemyAttackLogic.ts` | 순수 모듈(신규). 기존 로직 영향 없음. 단위 테스트로 전수. |
| `logic/MovementLogic.ts` (`kiteDirection` 추가) | 기존 `zigzagDirection`·`tickLunge`·`lungeMovement` 회귀 없음 확인(기존 S1 테스트 GREEN 유지). 신규 함수만 추가. |
| **신규** `components/EnemyProjectile.ts` | 적 발사체만 처리(플레이어 1명 대상). **적↔적 충돌 미질의 = 친선사격 0**. 플레이어 마법 `Projectile`과 별개 — 마법 발사 회귀 없음 확인. |
| `components/EnemyController.ts` (`kite` 이동 분기 + `attack` FSM 틱 + 텔레그래프 + `reset`/`_startDeath` 등록) | **기존 chase/zigzag/lunge 적 회귀** 확인(이동·접촉 피해·사망·풀 재사용 정상). 공격 없는 적(`attack` 미보유)은 능동 공격 안 함. |
| `components/EnemySpawner.ts` 또는 풀 소유자 (적 발사체 풀 추가) | 적 풀·XP 풀 회귀 없음 확인. 적 발사체 풀은 **영속 단일 소유자**(적 사망해도 풀 유지). |
| `data/GameTypes.ts` (`IEnemyData.attack?` + `IEnemyMoveParams.preferredRange?`) | 전부 **선택적 필드** — 기존 6종(attack 없음)에 영향 없음(컴파일·런타임). |
| `resources/data/enemies.json` (`kumiho` 추가) | 기존 6종 항목 불변. 신규 1종만. |
| `resources/data/spawn-table.json` (`kumiho` 편입) | 기존 구간 가중치 변경 시 다른 적 스폰 비율 영향 — 확인. |

---

## 3. 씬/프리팹 변경 사항 (잠정 — 구현 후 확정)

플레이어 발사체(`SpellCaster.bulletPrefab` + `PoolManager`) 구조를 미러한다.

### 3.1 신규 프리팹 — 적 발사체(여우불)

| 항목 | 값(잠정) |
|------|----------|
| 이름 | `EnemyBullet`(가칭) |
| 위치 | `game/assets/prefabs/` 아래 (플레이어 `Bullet` 프리팹과 동일 폴더) |
| 루트 노드 | `EnemyBullet` (UITransform 포함) |
| 컴포넌트 | `EnemyProjectile` |
| 스프라이트 | Sprite — 여우불 placeholder(주황 `#FF8C2A` 계열 tint). 플레이어 탄과 색으로 구분 |
| 크기 | `attack.projectile.radius`에 맞춰 충돌 반경과 시각 크기 정합(플레이어 탄 크기 참고) |

### 3.2 씬 노드 — 발사체 부모(스폰 컨테이너)

| 항목 | 값(잠정) |
|------|----------|
| 노드 | 적 발사체를 담을 부모 Node(예: `EnemyBulletParent`) — 게임 월드 Canvas 아래, 적과 같은 가시성 레이어(DEFAULT) |
| 이유 | 플레이어 `bulletParent`와 동형. UI 카메라가 아니라 게임 카메라에 렌더되도록 게임 월드 계층에 둔다 |

---

## 4. 에디터 연결 체크리스트 (잠정 — 구현 후 확정)

> 풀 소유자(EnemySpawner/GameManager 중 구현에서 확정)와 EnemyController의 `@property`는 구현 후 실제 이름으로 갱신한다.

| 컴포넌트 | `@property` | 연결 대상 | 상태 |
|----------|-------------|-----------|:----:|
| 풀 소유자 | `enemyBulletPrefab`(가칭) | §3.1 `EnemyBullet` 프리팹 | ❌ |
| 풀 소유자 | `enemyBulletParent`(가칭) | §3.2 발사체 부모 노드 | ❌ |
| EnemyProjectile(프리팹 내) | (충돌 반경 등 데이터 주입 — `init`으로 런타임 주입이면 에디터 연결 불필요) | — | ❌ |

> 텔레그래프(윈드업 점멸)는 S1 `_applyTintBlend`/`windupBlend`를 잇는 **코드 처리**라 별도 에디터 노드가 필요 없을 수 있다(돌진 `lungeMarker`처럼 바닥 마커를 쓸지는 구현에서 결정 → 쓰면 이 표에 추가).

---

## 5. 수동 테스트 체크리스트 (인게임 — 코드로 검증 불가)

구미호가 스폰되는 웨이브(spawn-table 편입 구간)에서 확인한다. 테스트 편의를 위해 인스펙터에서 구미호 가중치를 임시로 올려도 된다(비커밋).

- [ ] **유격 이동:** 구미호가 플레이어에게 무작정 붙지 않고 **선호 사거리를 유지**한다(가까우면 물러나고 멀면 다가온다). 경계에서 덜덜 떨지 않는다(데드존).
- [ ] **발사 텔레그래프:** 발사 직전 윈드업 동안 색이 점멸(텔레그래프)한 뒤 발사된다 — 예고 없이 맞지 않는다.
- [ ] **단발 발사:** 발동당 발사체가 **정확히 1발** 나간다(연사·다발 아님).
- [ ] **조준 잠금:** 텔레그래프 진입 시점의 방향으로 발사된다 — 발사 순간 재조준해 플레이어를 따라 휘지 않는다(점멸 본 방향으로 피하면 빗나간다).
- [ ] **명중 피해:** 발사체가 플레이어에 닿으면 피해를 준다(HP 감소). 빗나가면 화면 밖에서 소멸.
- [ ] **친선사격 없음:** 적 발사체가 **다른 적에게는 피해를 주지 않는다**(구미호 탄이 다른 요괴를 맞혀도 무효).
- [ ] **정지 중 발사 동결:** 구미호가 정지(라이트닝 볼트)·빙결 상태면 텔레그래프·발사가 **멈춘다**(동결 풀리면 재개).
- [ ] **윈드업 중 사망 정리:** 텔레그래프(점멸) 도중 구미호를 처치하면 점멸 틴트가 시체에 남지 않는다. 풀에서 재사용된 적이 스폰 즉시 쏘거나 이전 쿨다운을 물고 오지 않는다.
- [ ] **기존 적 회귀:** 처녀귀신·달걀귀신·도깨비·장산범(추격), 어둑시니(지그재그), 불가사리(돌진)가 기존대로 동작(이동·접촉 피해·사망).
- [ ] **i-frame 상호작용(참고):** 발사체+접촉이 같은 피격 틱에 겹쳐도 플레이어는 **둘 중 더 센 1회만** 받는다(틱당 max — player-iframe QA에서 검증한 동작의 재확인).

---

## 6. 비고

- **i-frame·틱당 max 동작 자체의 검증**은 `player-iframe` 슬라이스 QA 소관이다. 본 문서는 적 발사체가 그 게이트에 올바르게 **제출**되는지(명중 시 피해 발생, 친선사격 0)까지만 본다.
- 밸런싱(원거리 적 스폰 희소도·텔레그래프 시간·`attack` 수치·선호 사거리)은 전부 placeholder다. 즉사 방지·체감은 밸런싱 단계에서 확정(backlog ⚖️).
