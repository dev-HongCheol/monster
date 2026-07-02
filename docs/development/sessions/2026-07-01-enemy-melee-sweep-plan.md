# 적 로스터 S3 — 근접 휘두르기 적(두억시니·야차·그슨대) 계획

- **작성일:** 2026-07-01
- **브랜치:** feat/enemy-melee-sweep
- **슬라이스:** 적 로스터 재기획 S3 (패밀리 3 — 근접 휘두르기, 무기 요괴)
- **선행:** S0(#41)·S1(#42)·S2a(#44)·S2b(#46) 머지, player-iframe(#43)
- **설계 정본:** `docs/planning/enemy-system.md` §3·§5·§6·§10(패밀리 3)·§11·§13(S3)
- **리뷰 수준:** 경량 인라인 + 설계 정본 기반. office-hours 성격의 핵심 스코프 결정(텔레그래프 부채꼴 마커 포함 여부)을 사용자에게 확인해 **옵션 A(부채꼴 범위 마커 포함)로 확정**(2026-07-01). 풀 autoplan 다중 에이전트 파이프라인은 슬라이스 규모 대비 과해 생략(S2b와 같은 결).

---

## 완료 (PR #48)

- **머지:** PR #48로 완료(2026-07-02). 계획 대비 스코프·데이터·로직 흐름은 그대로 이행됐고, 아래 한 가지가 구현 중 리워크됐다.
- **마커 렌더링 리워크:** 계획 §3.2·§6의 **스프라이트 스케일**(`meleeConeMarkerScale`, +X 섹터 스프라이트를 scaleX/scaleY로 늘림) 방식을 7단계 인게임 테스트에서 폐기하고 **Graphics 섹터(호)** 방식(`meleeConeMarkerArc`, `arc(-coneAngleDeg/2, +coneAngleDeg/2)`로 실제 파이 조각을 직접 그림)으로 전환했다. 스프라이트 방식은 방향·anchor·가로세로를 매번 맞춰야 해 반복 어긋났고 넓은 각(두억시니 150°)에선 평평한 삼각형이 실제 부채꼴과 크게 달랐다. Graphics 전환으로 마커와 `coneHitsTarget`이 어떤 각도에서도 같은 각을 써 정합하며, 백로그 **F25**(마커 반각 클램프 비대칭)가 소멸했다.
- **검증:** 피처 테스트 `EnemyMeleeSweep.test.ts` 20/20 + 전체 스위트 364/364 GREEN, TS 진단 0, biome clean. 7단계 수동 인게임 테스트(`docs/qa/enemy-melee-sweep-test.md`) 전 항목 통과.
- **에디터 세팅:** `Enemy.prefab`에 `MeleeConeMarker`(빈 Node + `cc.Graphics`, 비활성) 추가 + `@property meleeConeMarker` 연결(코드가 그리므로 스프라이트·SpriteFrame 불필요).

---

## 1. 배경과 목적

적 로스터의 마지막 공격 타입인 **근접 휘두르기**를 추가한다. 적 공격 taxonomy(접촉·돌진·발사체 3종 완료)에서 근접 휘두르기만 비어 있고, 이걸 채우면 12종 로스터의 공격 분류가 완성된다.

근접 휘두르기는 **추격으로 접근 → 부채꼴 사거리 안에 들면 멈춰 윈드업(부채꼴 범위 마커) → 윈드업 끝에 1회 즉시 부채꼴 판정 → 쿨다운**이다. 발사체와 달리 탄이 비행하지 않고, 윈드업이 끝나는 순간 부채꼴 각도·사거리 안에 플레이어가 있으면 즉시 피해를 준다. 윈드업 동안 플레이어가 옆으로 빠지거나 뒤로 물러나면 회피된다 — 이 "예고 보고 피하기" 루프가 공정성의 핵심이라, 부채꼴 범위를 미리 보여주는 마커가 들어간다.

세 적(설계 §10 패밀리 3):

- **두억시니(`dueokshini`)** — 추격(느림)/탱크, 넓은 부채꼴(~150°)·긴 윈드업. 거대한 방망이를 크고 느리게 휘두르는 묵직형.
- **야차(`yacha`)** — 추격/표준, 표준 부채꼴(~120°). 무기를 부채꼴로 후려치는 표준형.
- **그슨대(`geuseundae`)** — 추격/표준, 좁고 빠름(~90°)·짧은 윈드업·빠른 쿨다운. 그림자 팔을 빠르게 휘두르는 속공형.

**핵심 한 줄:** 공격 FSM `tickAttack`(Aim→Telegraph→Fire→Cooldown)을 **그대로 재사용**한다. 발사체 적과 똑같은 상태기계를 돌리되, Fire 에지에서 (a) 발사 대신 **부채꼴 즉시 판정**을 하고, (b) 휘두르는 동안 추격을 멈추며, (c) 텔레그래프 마커가 **부채꼴 범위**를 그린다(발사체는 점멸만, 돌진은 직선 바닥 막대).

## 2. 스코프

### 이번 슬라이스가 포함하는 것

1. **데이터 스키마** — `IEnemyAttackData`에 `melee?: { coneAngleDeg, range }` 추가(`'melee_sweep'` type은 이미 enum에 있음).
2. **순수 로직(TDD)** — `EnemyAttackLogic.ts`에 ① `coneHitsTarget`(부채꼴 명중 판정) ② `meleeConeMarkerScale`(마커 길이·폭 + 부모 스케일 상쇄) 추가. 회전각은 기존 `vectorToAngle`(`MovementLogic`) 재사용.
3. **`EnemyController` 배선** — `_tickEnemyAttack`에 `melee_sweep` 분기(FSM 재사용, 사거리는 `melee.range`), Fire 에지 `_strikeMelee`, **휘두르는 동안 추격 정지**, 부채꼴 마커 노드 토글·회전·스케일.
4. **데이터 3종 추가**(`enemies.json`) + **스폰 테이블 합류**(후반 웨이브).
5. **피처 테스트** `tests/logic/EnemyMeleeSweep.test.ts`.

### 이 슬라이스가 닫는 백로그 항목

- **없음.** 로드맵 S3 자체다(백로그-구동 fix가 아님).
- **F19**(낮음, 미발현) — 휘두르기 적은 `movement: chase` + `attack`이라 `_updateLungeTelegraph`(돌진 전용)를 건드리지 않는다. 따라서 `lunge` + `attack` 겸용 적의 `_windupActive` 충돌은 **여전히 미발현**이다. 이번 구현에서 미접촉을 재확인만 한다(닫지 않음).

### 명시적으로 범위 밖(NOT in scope)

- **공격 FSM(`tickAttack`)·CC 동결·틴트 우선순위·윈드업 점멸** — S1/S2가 만든 토대를 그대로 재사용. 멈춤(`canAct`)·점멸(`_updateAttackTelegraph`)·틴트 래치 무변경.
- **발사체 경로·`FireGeometry`** — 휘두르기는 탄이 비행하지 않으므로 `_fireProjectile`·`fanDirections`·`radialDirections`를 건드리지 않는다(F21·F22는 발사체 기하 항목이라 이 슬라이스와 무관).
- **부채꼴 마커 최종 비주얼** — placeholder 섹터(단색)로 시작. 최종 이펙트는 아트 단계(로드맵 7–9주).
- **수치 밸런스** — HP·속도·피해·쿨다운·부채꼴 각도·사거리·윈드업은 전부 placeholder. 정확한 값은 7단계/밸런싱에서 확정.

## 3. 접근

### 3.1 데이터 스키마 (`GameTypes.ts`)

`IEnemyAttackData`에 `melee` 하위 객체를 추가한다(발사체의 `projectile`와 대칭, 둘 다 옵셔널).

```ts
/** 근접 휘두르기 공격일 때만 (melee_sweep) */
melee?: {
  /** 휘두르기 부채꼴 각도(deg) — 적별 차별화(두억시니 150·야차 120·그슨대 90) */
  coneAngleDeg: number;
  /** 휘두르기 사거리(px) — 이 안에 플레이어가 있어야 텔레그래프 시작·명중 판정 */
  range: number;
};
```

### 3.2 순수 로직 — `coneHitsTarget` + 마커 기하 (`EnemyAttackLogic.ts`)

공격 FSM이 이미 이 모듈에 있으므로, 휘두르기의 명중 판정과 그 텔레그래프 마커 치수도 여기 둔다(회전각만 `MovementLogic.vectorToAngle` 재사용).

**① 부채꼴 명중 판정**

```
coneHitsTarget(facing, toTarget, coneAngleDeg, range) → boolean
```
- 거리: `|toTarget| ≤ range` (FSM의 Telegraph 트리거와 같은 중심-대-중심 기준으로 일관).
- 각도: `facing`과 `toTarget` 사이 각 ≤ `coneAngleDeg / 2`.
- 엣지: `toTarget` 영벡터(정확히 겹침)면 각이 정의되지 않으나 거리 0이라 **히트로 처리**(코앞에서 휘두르면 맞음). `facing` 영벡터는 잠금 방향이 비정상인 경우라 **미스로 가드**(NaN 방지). 정확히 경계각·경계거리는 포함(`≤`)으로 결정적.

**② 마커 치수**

```
meleeConeMarkerScale(range, coneAngleDeg, parentScale) → { scaleX, scaleY }
```
- 마커는 +X로 뻗는 placeholder 섹터(꼭짓점 = 적). `scaleX`로 사거리 길이, `scaleY`로 부채꼴 폭을 준다.
- `scaleX = range / (MARKER_BASE_LENGTH × parentScale)`, `scaleY = (2 × range × tan(coneAngleDeg/2)) / (MARKER_BASE_WIDTH × parentScale)`.
- **부모 스케일 상쇄**는 S1 돌진 마커(`LUNGE_MARKER_BASE_WIDTH`)와 동일 — 두억시니처럼 `threatScale`이 큰 적이라도 마커가 실제 사거리·각도와 일치한다.

### 3.3 `EnemyController` 배선

- **FSM 분기(`_tickEnemyAttack`):** 현재 발사체 전용 가드(`isProjectile`)를 `isActiveAttack = isProjectile || type === 'melee_sweep'`로 일반화한다. `params.range`는 발사체면 `atk.range`, 휘두르기면 `atk.melee.range`를 쓴다. Fire 에지에서 `result.fired`면 발사체는 `_fireProjectile`, 휘두르기는 신규 `_strikeMelee`를 호출한다. `tickAttack`·`_attackLockDir`(텔레그래프 진입 시 잠근 조준 방향)·`canAct` 동결은 그대로다.
- **`_strikeMelee(atk)`:** 잠근 방향(`_attackLockDir`) 기준으로 현재 플레이어까지 벡터를 다시 구해(윈드업 중 회피 반영) `coneHitsTarget`이면 `GameManager.instance.damagePlayer(atk.damage)`(버스트 i-frame 게이트 — EnemyProjectile과 같은 경로). 빗나가면 무피해.
- **휘두르는 동안 추격 정지:** 휘두르기 적은 `movement: chase` → `_followPlayer` 경로다. `_followPlayer`(또는 `_move`의 default 분기)에서 **이 적이 `melee_sweep`이고 `_attackState ∈ {Telegraph, Fire}`면 이동을 건너뛴다**(멈춰 서서 친다). Aim(접근)·Cooldown(재접근) 중엔 정상 추격. `update()`가 `_move`→`_tickEnemyAttack` 순이라 진입 프레임 한 틱만 추격이 겹치는데(무시 가능), 다음 프레임부터 정지한다.
- **부채꼴 마커:** S1 `lungeMarker`를 미러해 `@property(Node) meleeConeMarker`를 추가한다. `_attackState === Telegraph` 동안 `active=true` + `angle = vectorToAngle(_attackLockDir)` + `meleeConeMarkerScale`로 스케일, 그 외 `active=false`. `reset()`·`_startDeath`에서 비활성화(풀 재사용·윈드업 중 사망 시 마커 잔류 방지 — S1과 동일 패턴).

### 3.4 데이터 3종 + 스폰 테이블

`enemies.json`에 두억시니·야차·그슨대를 추가하고, `spawn-table.json` 후반 웨이브에 합류시킨다(설계 §8.2 — 후반에 근접 휘두르기 가중치 ↑).

## 4. 데이터(placeholder)

수치는 전부 placeholder(설계 §11). **이중 피해 방지(§5):** 휘두르기 적은 `contactDamagePerSec`를 낮게 두고 `attack.damage`(버스트)를 높게 둬, 붙어 있어도 접촉 DoT와 휘두르기가 이중으로 갈리지 않게 한다.

| id | 이동/역할 | maxHp | speed | 접촉/초 | 휘두르기 피해 | coneAngle | range | telegraph | cooldown | tint | scale |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dueokshini | chase(느림)/tank | 220 | 70 | 8 | 48 | 150 | 90 | 0.7 | 1.6 | #6B2E5F | 1.35 |
| yacha | chase/standard | 130 | 110 | 10 | 38 | 120 | 75 | 0.5 | 1.1 | #C0392B | 1.0 |
| geuseundae | chase/standard | 110 | 130 | 8 | 30 | 90 | 60 | 0.35 | 0.8 | #34352F | 1.0 |

> 위 수치는 자리만 잡은 것이다(밸런싱 단계 확정). xpDrop은 placeholder 스케일(현 로스터 18~35 대역)로 두고, 메모리 "기본 70+"는 밸런스 단계에서 일괄 확정한다(S2b와 동일 보류).

## 5. 테스트 전략 (TDD, RED 먼저)

이 슬라이스는 **순수 로직이 있어 skip-test가 아니다.** `tests/logic/EnemyMeleeSweep.test.ts`에 RED부터 작성한다.

- **`coneHitsTarget` 단언:** 정면(각 0) 히트, 옆으로 빠짐(각 > 절반) 미스, 사거리 밖 미스, 정확히 경계각·경계거리 히트(`≤`), 뒤쪽(각 180°) 미스, `toTarget` 영벡터(겹침) 히트, `facing` 영벡터 미스(가드), 비대칭 각도(좌우 대칭).
- **`meleeConeMarkerScale` 단언:** 길이 = range 기반, 폭 = 각도 기반(넓은 각 → 큰 `scaleY`), 부모 스케일 상쇄(parentScale 2배면 로컬 스케일 절반), coneAngle 0/극단 가드.
- **데이터 정합:** 실 `enemies.json`을 로드해 `attack.type === 'melee_sweep'`인 적 전부가 `melee.coneAngleDeg`·`melee.range`를 갖고 `contactDamagePerSec < attack.damage`(이중피해 방지 불변식)인지 단언(D2 인접, S2b의 F20 데이터 테스트와 같은 결).

## 6. QA / 프리팹·에디터

- **`Enemy.prefab`에 부채꼴 마커 자식 노드(placeholder 섹터 Sprite) 추가 + `@property meleeConeMarker` 연결** — Cocos 에셋이라 **7단계 사용자 에디터 테스트에서 추가**(AI는 `.prefab`을 직접 만지지 않음 — 에셋 `.meta` 관리 규칙). 미연결 시 null 가드로 마커 없이도 동작(S1 `lungeMarker`와 동일).
- 마커 placeholder 형태(섹터 스프라이트 vs 삼각형)·기준 치수 상수는 구현 시 확정하고 QA 문서를 코드 기준으로 거울 맞춘다(qa-setup 잠정 → GREEN 후 확정).

## 7. 리스크

- **낮음(핵심 동작):** 공격 FSM·CC 동결·틴트·점멸을 그대로 재사용한다. 새 동작은 부채꼴 판정 한 함수와 이동 정지 한 가지뿐.
- **마커 기하(부모 스케일 상쇄)·이동 정지 타이밍**이 새 위험 지점이나, 둘 다 순수 함수로 빼 테스트로 고정한다(S1이 같은 패턴으로 검증됨).
- **F19 미발현 재확인** — 휘두르기 적은 chase라 lunge 텔레그래프 경로를 안 탄다.
