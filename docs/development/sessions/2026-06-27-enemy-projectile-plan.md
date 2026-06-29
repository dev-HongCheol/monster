# 적 로스터 S2a — 적 발사체 시스템 + 유격 이동 + 버스트 데미지 모델 (계획)

- **작성일:** 2026-06-27
- **상태:** 완료 — PR #44로 main 머지. 자동 테스트 GREEN + 수동 QA 체크리스트 전 항목 통과.
- **브랜치:** feat/enemy-projectile
- **슬라이스:** S2a (적 12종 로스터의 세 번째 구현 슬라이스 — 패밀리 2 원거리 발사체의 앞 절반)
- **상위 설계:** [적 시스템 디자인](../../planning/enemy-system.md) — §3 유격 이동, §4 원거리 역할, §5 공격 타입·분리 데미지 모델, §6 텔레그래프, §10 패밀리 2 로스터, §11 데이터 스키마, §14 Open Item. 이 계획은 그 설계의 패밀리 2를 두 슬라이스로 나눈 앞 절반이다.
- **선행 슬라이스:** S1(신규 이동 + 텔레그래프 토대, PR #42 머지) — 지그재그·돌진과 첫 텔레그래프(`_applyTintBlend`·`windupBlend`·바닥 마커)를 들였다. S2a는 그 텔레그래프 토대 위에 첫 *원거리 능동 공격*(발사체)과 그동안 미뤄둔 *분리 데미지 모델*을 얹는다.
- **office-hours 스코프 결정:** 패밀리 2(원거리 발사체)는 코드 경로가 네 개나 새로 생겨(적 발사체 시스템·유격 이동·원거리 역할·`attack` 버스트 데미지 모델) S1보다 크다. 마법 엔진이 "패턴 먼저 → 효과 나중"으로 간 것과 동형으로 **2분할**한다. S2a가 발사체 인프라 전체를 단발(구미호)로 깔고, S2b가 부채꼴(이무기)·확산(물귀신)을 발사 기하만 얹어 잇는다.

---

## 1. 배경·목적

S1까지 모든 적은 플레이어에게 *붙어서* 피해를 준다 — 직진·지그재그·돌진으로 거리를 좁힌 뒤 접촉 피해(`contactDamagePerSec`)를 입히거나, 불가사리가 몸통으로 들이받는다. 거리를 두고 압박하는 적이 아직 없어서, 플레이어는 한 덩어리로 몰려오는 적을 피하기만 하면 된다.

S2a는 **거리를 두고 발사체로 쏘는 적**을 처음 들인다. 구미호는 유격(Kite) 이동으로 선호 사거리를 유지하며 여우불을 단발로 던져 플레이어가 접근을 강제당하게 한다. 이를 위해 세 가지 새 토대가 함께 들어온다.

첫째, **적 발사체 시스템**이다. 지금까지 발사체는 플레이어의 마법(`Projectile`)뿐이고, 그건 모든 적과 충돌하는 다대다 판정에 폭발·dedup·상태이상이 얽혀 있다. 적 발사체는 대상이 플레이어 한 명이라 훨씬 단순하므로, 그 무게를 지지 않는 **신규 경량 컴포넌트**로 분리한다.

둘째, **분리 데미지 모델**이다. S1에서 office-hours 결정 D1로 미뤄둔 것으로(불가사리 돌진이 접촉 경로를 그대로 쓰게 둔 그 결정), 능동 공격(발사체·돌진·휘두르기)은 접촉 지속 피해와 별개로 **발동당 1회 버스트**(`attack.damage`)를 준다(§5). S2a가 이 `attack` 블록을 처음 배선한다.

셋째, **발사 텔레그래프**다. 능동 공격은 예고 없이 맞으면 불공정하므로(§6), 구미호는 발사 직전 윈드업 동안 색이 점멸한다. S1이 일반화해둔 `_applyTintBlend`·`windupBlend`를 그대로 잇는다.

설계 원칙(§1)대로 발사 상태 전이·유격 방향 계산 같은 순수 로직은 `logic/`으로 분리해 TDD(RED→GREEN) 대상으로 삼고, Cocos 의존부(노드 이동·발사체 스폰·텔레그래프 렌더)는 컴포넌트가 얇게 호출한다.

## 2. 이 슬라이스의 스코프 (구현 대상)

| id | 적 | 이동 | 역할 | 공격 | tint(placeholder) | 비고 |
|---|---|---|---|---|---|---|
| `kumiho` | 구미호 | 유격(kite) | 원거리 | 발사체 단발 | 주황(여우불) | 선호 사거리를 유지하며 단발 발사. 첫 원거리·첫 발사체 적. |

**S2b로 미루는 것:** 이무기(부채꼴)·물귀신(확산)과 그에 필요한 발사 기하 분포 수학. S2a는 단발이라 부채꼴 기하가 필요 없다.

**office-hours·autoplan에서 확정한 결정:**

- **(D1) 적 발사체 충돌부는 신규 경량 컴포넌트로 분리한다.** 기존 `Projectile`에 "타격 진영" 파라미터를 더하는 대신 `EnemyProjectile`을 새로 만든다. 기존 발사체의 충돌부(`_checkEnemyHit`)는 그리드 질의 → `selectExplosionHits` dedup → 폭발 AoE → 상태이상까지 다대다 전제로 엮여 있어, 적 발사체에는 전부 불필요하다. 분리하면 적 발사체가 적 목록을 아예 질의하지 않으므로 **친선사격(적→적)이 구조적으로 0으로 보장**되고, 핫패스에 `if (진영)` 분기가 박히지 않는다. 공유하는 코드(이동·화면 밖 판정·풀 반환)는 약 25줄이고 대부분 Cocos 의존이라, 공통 컴포넌트 상속이나 순수 추출보다 **그대로 복제**가 비용이 낮다(순수하게 뺄 가치가 있는 건 화면 밖 한계 계산 정도뿐).
- **(D2) 발사 기하 공유는 S2b로 미룬다.** `SpellPatternLogic.directionalPlan`의 부채꼴 분포 수학은 `ISpellData`에 강하게 결합돼 그대로는 적이 못 쓴다(재사용 가능한 순수 핵은 `rotate` 하나뿐). S2a 단발은 기하가 필요 없으므로, 발사 진입점을 `ShotSpec` 목록 반환(지금은 길이 1)으로 모양만 잡아둔다. 부채꼴이 실제로 착지하는 S2b에서 순수 `fanDirections(aimX, aimY, count, spreadDeg)`를 추출해 마법·적이 공유한다. 미리 추출하면 마법 발사 회귀 위험만 앞당길 뿐 이득이 없다.
- **(D3) `attack.range` 발사 사거리 게이트를 스키마에 추가한다.** 설계 §11의 `attack.projectile`에는 `range`가 없다(`melee`에는 있어 비대칭). 구미호가 화면 끝에서 무한정 쏘지 않게 하려면 발사 사거리가 필요하므로, 선택 필드 `attack.range?`를 지금 스키마에 넣어 한 번에 결정한다(S2b·S3에서 또 건드리지 않도록).
- **(D4) F17(돌진 겹침 가드)은 보류한다.** S2a가 새로 만드는 건 유격(kite) 경로라 F17이 있는 `_moveLunge` Chase/Cooldown 경로와 코드상 겹치지 않는다. kite는 어차피 데드존·영벡터 가드를 새로 넣고, `_followPlayer`에는 이미 겹침 가드가 있다. 큰 신규 시스템 PR에 무관한 코스메틱 픽스를 섞으면 리뷰 표면만 넓어진다. 백로그 F17로 유지한다.
- **(D5) 다중 피해 처리(전역 i-frame + 틱당 max)는 별도 슬라이스 `player-iframe`로 분리했다(PR #43 머지 완료).** 플레이어 피해 게이트는 적 발사체와 의존이 없고 기존 모든 적의 접촉 피해까지 건드리는 플레이어 쪽 토대라 따로 떼어냈다(S2a를 작게 유지). S2a는 그 게이트가 머지된 main 위에서 진행하며, 발사체·접촉은 기존 `GameManager.damagePlayer(amount)` 제출 경로를 그대로 쓴다(특별 배선 없음). 게이트 설계(순수 `PlayerDamageLogic` + 게이트 컴포넌트)·접촉 모델 변경(초당 DoT→틱당 max)·`T` 밸런싱은 그 슬라이스 계획(`sessions/2026-06-27-player-iframe-plan.md`) 소관이다.

**구현 항목:**

1. **`data/GameTypes.ts`** — `IEnemyData`에 선택적 `attack?: IEnemyAttackData` 블록을, `IEnemyMoveParams`에 선택적 `preferredRange?`를 추가한다(아래 §3). 현재 둘 다 없어 데이터를 채워도 컴파일이 막히므로, 이 인터페이스 확장이 S2a의 1차 작업이다. (S1 테스트가 `moveParams`를 로컬 타입으로 우회했던 자국이 있다면 정식 인터페이스로 청산한다.)
2. **`logic/EnemyAttackLogic.ts`(신규)** — 순수 모듈. 공격 상태기계(Aim→Telegraph→Fire→Cooldown) 한 틱 전이, 발동당 정확히 1타 보장, 조준 잠금(텔레그래프 진입 에지에서만 반환), CC 동결. `cc` import 없음. S1 `tickLunge`와 동형 구조.
3. **`logic/MovementLogic.ts`** — `kiteDirection(toPlayer, preferredRange, band)`를 추가한다. 너무 멀면 접근, 너무 가까우면 후퇴, 데드존(히스테리시스 밴드) 안이면 영벡터(정지)를 돌려 떨림을 막는다. NaN·영벡터 가드는 기존 `normalize` 재사용.
4. **`components/EnemyProjectile.ts`(신규)** — 적 발사체 컴포넌트. 이동·화면 밖 판정·풀 반환은 `Projectile`을 미러하되, 충돌부는 **플레이어 한 명만** 판정해 명중 시 `attack.damage`를 기존 `GameManager.damagePlayer(amount)`로 제출하고 자신을 풀로 반환한다(틱당 max·i-frame은 이미 머지된 `player-iframe` 게이트가 처리). 적 목록은 절대 질의하지 않는다(친선사격 0 불변식).
5. **적 발사체 풀 — 영속 단일 소유자.** `EnemyController`가 개체별로 풀을 들면 적이 죽어 풀로 반환될 때 풀이 사라져 발사체가 새거나 유실된다. `SpellCaster`가 `bulletPool`을, `EnemySpawner`가 `_enemyPool`을 영속으로 들 듯, 적 발사체 풀도 한 곳(신규 매니저 또는 `EnemySpawner`/`GameManager`에 얹기)이 소유하고 `EnemyController`는 발사 시 `acquire`만 위임한다.
6. **`components/EnemyController.ts`** — `update`에서 `_move` 분기에 `kite`를 추가하고(미지 값은 chase 폴백 유지), `attack` 블록이 있으면 `EnemyAttackLogic`로 공격 FSM을 틱한다. 텔레그래프(윈드업 점멸)는 S1의 `_applyTintBlend`·`windupBlend`를 잇는다. Fire 에지에서 잠근 방향으로 발사체를 스폰한다. **신규 공격 FSM 상태·텔레그래프 래치를 `reset()`과 `_startDeath()`에 반드시 등록**한다(풀 재사용 시 이전 적의 쿨다운 잔류·시체에 텔레그래프 잔존 방지).
7. **`resources/data/enemies.json`** — `kumiho` 1종 추가(스탯·tint·`moveParams.preferredRange`·`attack` 블록은 placeholder). 기존 6종 유지.
8. **`resources/data/spawn-table.json`** — `kumiho`를 중반 웨이브 구간에 편입(정확한 가중치는 밸런싱).

## 3. 데이터 스키마 변경 (`attack` 블록 + `preferredRange`)

설계 §11의 forward-compatible 스키마에서 S2a가 실제로 쓰는 필드만 추가한다. 전부 선택적 필드라 기존 6종(`attack` 없음)은 영향받지 않는다 — 접촉만 하는 적은 `attack`을 생략하면 컨트롤러가 능동 공격을 시도하지 않는다.

```ts
/** 적 능동 공격 블록 (적 시스템 §5·§11). 접촉만 하는 적은 생략. */
export interface IEnemyAttackData {
  /** 공격 타입 enum (§5). S2a는 'projectile_single'만 배선 — 미지 값은 무공격 폴백. */
  type: 'contact' | 'lunge' | 'projectile_single' | 'projectile_fan' | 'projectile_spread' | 'melee_sweep';
  /** 발동당 1회 버스트 피해 (접촉 DoT와 별개 — §5 분리 데미지 모델) */
  damage: number;
  /** 공격 주기(sec) — 발동 간격. 0이면 하한으로 클램프. */
  cooldown: number;
  /** 텔레그래프(윈드업 점멸) 길이(sec, §6). 0이면 즉발. */
  telegraphTime: number;
  /** 발사 사거리(px, D3) — 이 거리 안에 플레이어가 있을 때만 발사. 생략 시 무제한. */
  range?: number;
  /** 발사체 공격일 때만 */
  projectile?: {
    count: number;          // 발사 수(S2a는 1, 부채꼴·확산은 S2b)
    spreadAngleDeg?: number; // 부채꼴 총 각도(S2b)
    speed: number;          // 발사체 속도
    radius: number;         // 발사체 충돌 반경
  };
}
```

`IEnemyMoveParams`에는 `preferredRange?`(유격 선호 사거리, px) 하나를 더한다. 0이면 추격 폴백(항상 접근)이고, 양수면 그 거리를 유지한다.

타이밍 의미가 두 블록에 쪼개진 점(돌진은 `moveParams.lungeWindup`/`lungeCooldown`, 발사체는 `attack.telegraphTime`/`cooldown`)은 설계 §11이 이미 인정한 이질 케이스다. S2a에는 무해하지만, 후속에서 텔레그래프 시간을 한 곳에서 읽으려면 두 소스를 합쳐야 한다는 점만 기록해 둔다.

## 4. 아키텍처

### 4.1 순수 로직 — `EnemyAttackLogic`

S1 `tickLunge`와 같은 형태로, 가변 상태(공격 상태·타이머·잠근 조준 방향)는 `EnemyController`가 보관하고 이 모듈은 다음 값을 계산하는 순수 함수만 제공한다.

- **상태기계:** `Aim`(사거리 밖이거나 쿨다운) → `Telegraph`(사거리 안 + 발동 가능, 윈드업) → `Fire`(발사 에지) → `Cooldown` → `Aim`.
- **`tickAttack(state, timer, toPlayer, canAct, params, dt)`** — 한 틱 전이. `canAct=false`(정지·빙결)면 FSM 전체를 동결한다(타이머도 멈춰, 정지당한 적이 텔레그래프만 흘려보내고 헛쏘는 것 방지 — S1 CC 동결과 동형). **Fire는 정확히 한 틱만 방출**하고 바로 Cooldown으로 넘어가, 발동당 1타가 순수 테스트로 보장된다.
- **조준 잠금:** 돌진의 `lockDir`처럼 **Telegraph 진입 에지에서만** 조준 방향을 반환한다. 플레이어가 빨강 점멸을 보고 그 방향을 피하는데 Fire 순간 재조준하면 텔레그래프가 거짓말이 되므로, 잠근 방향으로만 쏜다.
- **텔레그래프 커밋:** 윈드업 중 플레이어가 사거리 밖으로 나가도 발사를 수행한다(돌진의 윈드업→돌진 커밋과 동형 — 텔레그래프 약속).

### 4.2 순수 로직 — `kiteDirection`

`kiteDirection(toPlayer, preferredRange, band)`는 적→플레이어 거리로 분기한다. `preferredRange + band`보다 멀면 플레이어 쪽 단위 벡터(접근), `preferredRange − band`보다 가까우면 그 반대(후퇴), 그 사이 데드존이면 영벡터(정지)를 돌려 경계에서 매 프레임 접근↔후퇴가 뒤집히는 떨림을 막는다. 영벡터 입력(겹침)·`preferredRange=0`(추격 폴백) 가드를 포함한다. 측면 선회(strafe)는 S2a 단발에 불필요하므로 넣지 않는다(필요하면 §3.1 선회 이동으로 별도 슬라이스).

### 4.3 컴포넌트 — `EnemyProjectile`과 풀

`EnemyProjectile`은 매 프레임 이동 → 플레이어 충돌 판정 → 화면 밖 판정 순으로 돈다. 충돌부는 플레이어 노드 하나와의 거리만 보고, 닿으면 `attack.damage`를 기존 `GameManager.damagePlayer(amount)`로 제출하고 자신을 풀로 반환한다. 적 목록을 질의하는 코드는 두지 않는다(친선사격 0 불변식). "한 틱 1회·가장 센 것"으로 묶는 건 `player-iframe` 게이트가 하므로, 발사체는 닿으면 제출만 하면 된다(발사체별 dedup 장치 불필요).

풀은 영속 단일 소유자가 들고, `EnemyController`는 Fire 에지에서 그 풀의 `acquire`를 호출해 발사체를 꺼낸 뒤 위치·방향·속도·반경·피해·반환 콜백을 `init`으로 주입한다. 이 흐름은 `SpellCaster._spawnShot`을 그대로 미러한다.

### 4.4 컴포넌트 — `EnemyController` 통합

`_move` 분기에 `kite`를 더하고, `attack` 블록이 있는 적은 매 프레임 `tickAttack`을 돌린다. CC 적용 강도(`appliedStrength`)를 S1처럼 틱 이후 산출해 `canAct`로 넘긴다. 윈드업 동안 본체 색을 `windupBlend` 진행도로 텔레그래프 색에 섞고(기존 `_updateTint` 우선순위 체계에 편입), Fire 에지에서 발사체를 스폰한다.

**풀 재사용·사망 정리:** 신규 공격 FSM 상태(`_attackState`·`_attackTimer`·잠근 조준 방향)와 텔레그래프 래치를 `reset()`에서 비우고, `_startDeath()`에서 텔레그래프 틴트를 끈다. S1이 돌진 FSM·마커에 대해 이미 잡아둔 자리에 attack 항목을 더하는 것으로, 빠뜨리면 풀에서 꺼낸 적이 이전 적의 쿨다운 잔여로 스폰 즉시 쏘거나 영영 안 쏘고, 윈드업 중 죽은 적의 빨강이 시체에 남는다.

## 5. 테스트 계획 (RED로 덮을 항목)

순수 로직은 `tests/logic/EnemyProjectile.test.ts`(파일명은 피처 슬러그 PascalCase 규칙)로 전수 덮는다.

**`EnemyAttackLogic`:**
- Aim→Telegraph→Fire→Cooldown 1주기 순환
- **발동당 정확히 1타** — Fire 에지가 한 번만 방출되고 Cooldown 후속 틱은 재발사 안 함 (핵심)
- `canAct=false`(CC) 전체 동결 — 상태·타이머 불변, 동결 중 무발사
- 조준 잠금이 Telegraph 진입 에지에서만 반환(이후 틱은 미반환)
- 텔레그래프 커밋 — 윈드업 중 사거리 이탈해도 발사
- `telegraphTime=0` 즉발, `cooldown=0` 하한 클램프, dt 오버슈트 시 한 상태만 전이

**`kiteDirection`:**
- 거리 > `preferredRange + band` → 접근(플레이어 향 단위벡터)
- 거리 < `preferredRange − band` → 후퇴(반대)
- 데드존 안 → 영벡터(떨림 0) (핵심)
- 영벡터 입력(겹침) → 영벡터(NaN 없음)
- `preferredRange=0` → 추격 폴백

**데이터 정합(S1 `EnemyMovement.test` 패턴 미러):**
- `kumiho`: `movement='kite'`, `preferredRange>0`, `attack.type='projectile_single'`, `attack.damage>0`, `attack.cooldown>0`, `projectile.speed>0`·`radius>0`
- `kumiho`가 spawn-table에 편입돼 실제 스폰됨

수동 검증(에디터·인게임)은 QA 문서(`docs/qa/enemy-projectile-test.md`)에 별도로 적는다 — 발사체 풀 연결, 텔레그래프 점멸, 유격 거리 유지, 발사체 명중 시 플레이어 피해, 친선사격이 안 일어나는지, 정지 중 발사 동결, 윈드업 중 사망 시 텔레그래프 정리. (i-frame·틱당 max 동작 검증은 `player-iframe` 슬라이스 QA 소관.)

## 6. Open Item 해소 (설계 §14)

- **충돌부 구조** → 신규 경량 `EnemyProjectile` 분리(D1).
- **발사 기하 재사용** → S2b로 연기, S2a는 진입점만 기하-레디(D2).
- **발사 사거리** → `attack.range?` 스키마 추가(D3).
- **다중 피해 처리** → 전역 i-frame + 틱당 max로 결정했고, 적 발사체와 독립이라 **별도 슬라이스 `player-iframe`로 분리**(D5, PR #43 머지 완료). S2a는 그 게이트에 제출만.

## 7. 이 슬라이스가 닫는/미루는 백로그 항목

- **F17(돌진 겹침 가드)** — 이번에 함께 처리하는 안을 검토했으나, kite 경로와 코드상 겹치지 않아 결합 이득이 없어 **보류**로 결정(D4). 백로그에 유지.
- **밸런싱(신규, 구현 중 backlog.md ⚖️로 이관):** 원거리 적 스폰 희소도·발사 텔레그래프 시간·`attack` 수치(즉사 방지). 전부 placeholder로 두고 밸런싱 단계에서 확정. (피격 틱 `T`·접촉 환산값 밸런싱은 `player-iframe` 슬라이스 소관.)
- 새로 생기는 후속 후보(발사 기하 추출 S2b, 사거리 게이트 밸런싱 등)는 구현·검증 중 백로그에 반영한다.

## 8. autoplan 결정 감사 추적

| # | 결정 | 분류 | 근거 | 출처 |
|---|------|------|------|------|
| D1 | 적 발사체는 신규 경량 `EnemyProjectile`로 분리 | CONFIRMED(두 보이스 일치) | 진영 파라미터는 폭발·dedup·AoE를 핫패스에 얽고 친선사격 버그 표면을 만든다. 분리는 친선사격 0을 구조적으로 보장. | autoplan eng(내 분석 + 독립 서브에이전트) |
| D2 | 발사 기하 추출은 S2b로 연기 | CONFIRMED | `directionalPlan`은 `ISpellData` 결합, S2a 단발은 기하 불필요. 미리 추출하면 마법 회귀 위험만 앞당김(YAGNI). | autoplan eng |
| D3 | `attack.range?` 스키마 추가 | TASTE(사용자 승인 A) | §11 스키마 구멍(projectile에 range 없음). 한 번에 결정해 S2b/S3 재작업 방지. | 독립 서브에이전트 발견 |
| D4 | F17 보류 | TASTE(사용자 승인 A) | kite는 `_moveLunge`와 코드상 안 겹침. 큰 신규 PR에 코스메틱 픽스 섞으면 리뷰 표면만 넓힘. | 독립 서브에이전트(내 최초 "포함" 의견 반전) |
| D5 | 발사체 풀 영속 단일 소유자 | mechanical | 개체별 소유 시 적 사망마다 풀 증발→누수/유실. | 독립 서브에이전트 |
| D6 | 공격 FSM 상태를 reset()·_startDeath()에 등록 | mechanical | 풀 재사용 시 쿨다운 잔류·시체 텔레그래프 잔존 방지. | 독립 서브에이전트 |
| D7 | 조준 잠금 = 텔레그래프 진입 에지 | mechanical | Fire 순간 재조준하면 텔레그래프가 거짓말. lunge `lockDir` 미러. | 독립 서브에이전트 |
| D8 | 유격 strafe(선회) 컷 | mechanical(P5) | 단발 검증에 불필요한 복잡도. 필요 시 별도 슬라이스. | 독립 서브에이전트 |
| D9 | 다중 피해 = 전역 i-frame + 틱당 max. 단, **별도 슬라이스 `player-iframe`로 분리**(S2a에서 제외, PR #43 머지 완료) | 사용자 결정 | 게이트는 적 발사체와 독립이고 기존 접촉까지 건드리는 플레이어 토대라 먼저 별도 슬라이스로. S2a는 작게 유지하고 게이트에 제출만. 볼리당 dedup(중간안) 폐기. | 사용자(2026-06-27) |

**리뷰 결과:** 치명적 차단 이슈 0건. Codex 미설치로 듀얼 보이스는 Claude 단독(내 코드 근거 분석 + 독립 서브에이전트)으로 진행. Design/DX 단계는 스킵(게임 내부 렌더·로직, UI 크롬·개발자 대상 API 아님).
