# 적 로스터 S1 — 신규 이동 + 텔레그래프 토대 (계획)

- **작성일:** 2026-06-26
- **브랜치:** feat/enemy-movement
- **슬라이스:** S1 (신규 이동 + 텔레그래프 토대) — 적 12종 로스터의 두 번째 구현 슬라이스
- **상위 설계:** [적 시스템 디자인](../../planning/enemy-system.md) — §3 이동 알고리즘, §5 공격 타입·데미지 모델, §6 텔레그래프, §11 데이터 스키마, §13 슬라이스 로드맵. 이 계획은 그 설계의 S1 부분을 구현 단위로 좁힌 것이다.
- **선행 슬라이스:** S0(역할 베이스 확정, PR #41 머지) — 추격×역할 베이스 4종(처녀귀신·도깨비·달걀귀신·장산범)을 데이터로 확정했다. S1은 그 위에 신규 *이동 알고리즘*과 첫 *능동 공격 예고(텔레그래프)*를 얹는다.

---

## 1. 배경·목적

S0까지 모든 적은 직진 추격에 접촉 피해만 준다. `EnemyController._followPlayer`가 매 프레임 플레이어 방향으로 직선 이동하는 한 가지 경로뿐이고, `IEnemyData.movement` 필드는 `"chase"` 문자열로 존재하지만 런타임에서 분기되지 않는다(데이터 자리만 잡아둔 상태).

S1은 이 `movement` 필드를 실제 런타임 분기로 처음 활성화하고, 두 가지 새 이동을 들여온다. 어둑시니는 좌우로 흔들며 다가와 직선 조준을 빗나가게 하고(지그재그), 불가사리는 평소 느릿하게 쫓다가 사거리 안에 들면 잠깐 멈칫한 뒤 플레이어를 향해 몸통으로 들이받는다(돌진). 불가사리의 돌진은 예고 없이 맞으면 불공정하므로, 이 슬라이스에서 **첫 텔레그래프(공정성 예고)**를 함께 도입한다 — 윈드업 동안 색이 번쩍이고, 돌진할 방향을 바닥 마커로 미리 보여준다.

설계 원칙(§1)대로 이동 방향 계산과 돌진 상태 전이 같은 순수 로직은 `logic/MovementLogic.ts`로 분리해 TDD(RED→GREEN) 대상으로 삼고, Cocos 의존부(노드 이동·텔레그래프 렌더)는 `EnemyController`가 얇게 호출한다.

## 2. 이 슬라이스의 스코프 (구현 대상)

| id | 적 | 이동 | 역할 | 공격 | tint(placeholder) | 비고 |
|---|---|---|---|---|---|---|
| `eodukshini` | 어둑시니 | 지그재그(zigzag) | 표준 | 접촉 | 짙은 회청 | 좌우 사인파로 흔들며 접근. 텔레그래프 없음(능동 공격 아님). |
| `bulgasari` | 불가사리 | 돌진(lunge) | 표준 | 접촉 | 금속 회색 | 추격→윈드업→돌진→쿨다운 상태기계. 첫 텔레그래프 적. |

**office-hours에서 확정한 스코프 결정 두 가지:**

- **(D1) 돌진 데미지는 S1에서 기존 접촉 경로를 유지한다.** 설계 §5의 분리 데미지 모델(능동 공격 = `attack.damage` 발동당 1회 버스트, 접촉과 별개)은 확정돼 있지만, 그 버스트 인프라(1돌진=1타 보장·접촉/버스트 분리·`attack` 블록 배선)는 발사체(S2)·근접 휘두르기(S3) 능동 공격과 함께 들여온다. S1의 불가사리는 돌진으로 거리를 빠르게 좁혀 `contactDamagePerSec` 접촉 피해를 입히고, 그 접촉 값은 0이 아닌 의미 있는 값으로 둔다(돌진이 본체 위협). 따라서 **S1에는 `attack` 블록 스키마를 추가하지 않는다** — `moveParams`만 추가한다.
- **(D2) 텔레그래프는 윈드업 점멸 + 돌진 바닥 경로 마커 둘 다 구현한다.** 윈드업 점멸은 기존 피격 플래시 메커니즘을 색만 바꿔 재사용하고, 바닥 마커는 돌진 방향으로 늘린 placeholder 단색 막대 스프라이트다. 이 둘이 S1/S2가 공유할 텔레그래프 토대가 된다.

**구현 항목:**

1. **`data/GameTypes.ts`** — `IEnemyData`에 선택적 `moveParams` 블록을 추가한다(아래 §3). `movement`는 이미 `string`이므로 타입 변경 없음. `attack` 블록은 추가하지 않는다(S2).
2. **`logic/MovementLogic.ts`(신규)** — 순수 모듈. 지그재그 이동 방향 계산, 돌진 상태기계 전이(추격→윈드업→돌진→쿨다운), 상태별 이동 벡터 계산. cc import 없음.
3. **`components/EnemyController.ts`** — `_followPlayer`를 `movement` 값으로 분기한다(chase/zigzag/lunge, 미구현·미지 값은 chase 폴백). 돌진 상태·타이머·잠금 방향을 컨트롤러가 보관하고 `MovementLogic`에 위임한다. 윈드업 점멸 틴트와 바닥 마커 노드 토글·트랜스폼을 구동한다. 마커 노드 참조용 `@property(Node)` 1개 추가.
4. **`resources/data/enemies.json`** — `eodukshini`·`bulgasari` 2종 추가(스탯·tint·`moveParams`는 placeholder). 기존 4종 유지.
5. **`resources/data/spawn-table.json`** — 두 신규 id를 중반 웨이브 구간에 편입(설계 §11 예시 기준, 정확한 가중치는 밸런싱).
6. **`Enemy.prefab`** — 돌진 바닥 마커 자식 노드(placeholder Sprite) 추가 + `@property` 연결. **Cocos 에셋이라 7단계 사용자 에디터 테스트에서 갱신**(AI는 .prefab을 직접 만지지 않는다 — 에셋 `.meta` 관리 규칙과 동일 취지).

## 3. 데이터 스키마 변경 (`moveParams`)

설계 §11의 forward-compatible 스키마에서 S1이 실제로 쓰는 이동 파라미터만 추가한다. 전부 선택적 필드라 기존 4종(`moveParams` 없음)은 영향받지 않는다.

`IEnemyMoveParams`는 **모든 필드가 선택적**이다 — 지그재그 적은 lunge 필드가 없고 돌진 적은 zigzag 필드가 없다. 향후 유격(S2)의 `preferredRange`도 같은 블록에 들어오므로 lunge 전용 모양으로 굳히지 않는다.

```jsonc
// IEnemyData에 추가 (IEnemyMoveParams, 전 필드 선택적)
"moveParams": {
  "zigzagAmplitude": 0.6,   // 지그재그 좌우 흔들림 세기 (전진 방향 대비 수직 가중, placeholder)
  "zigzagPeriod": 0.8,      // 지그재그 1주기 시간(sec) — 0/음수 금지(0이면 분모 0 → NaN, E1)
  "lungeRange": 200,        // 돌진 발동 거리(px) — 플레이어가 이 안에 들면 윈드업 시작
  "lungeWindup": 0.5,       // 돌진 전 윈드업(텔레그래프) 시간(sec)
  "lungeSpeed": 600,        // 돌진 중 속도(px/sec, 상수 — 가속 아님)
  "lungeDuration": 0.3,     // 돌진 지속 시간(sec) — 이 동안 잠금 방향으로 등속 이동 후 쿨다운
  "lungeCooldown": 1.5      // 돌진 후 재추격·재돌진 금지 쿨다운(sec)
}
```

> **placeholder 값은 0이 아닌 유효값으로 둔다.** 위 수치는 자리만 잡은 placeholder지만, **분모·정규화에 쓰이는 값(`zigzagPeriod` 등)은 0을 쓰지 않는다** — 0이면 런타임에 NaN이 새고 Cocos는 조용히 적을 원점으로 보낸다(E1·E2, §6). 데이터 sanity 테스트가 "필드 존재"가 아니라 **`> 0`을 단언**해 이 함정을 RED로 잡는다(§5 단언 4).
>
> **설계 §11과의 차이 — `lungeDuration` 신설:** §11 예시에는 `lungeSpeed`·`lungeCooldown`만 있고 돌진이 *얼마나 오래* 지속되는지가 빠져 있다. 돌진 종료 조건을 명시적 시간으로 두는 게 가장 또렷하고 테스트하기 쉬워 `lungeDuration`(sec)을 추가한다(거리/속도로 유도하거나 "플레이어 도달 시 종료"로 두는 대안보다 결정적 — 독립 리뷰 S2도 동의). 이 추가는 설계 §11 스키마에 역반영한다(구현 시 §11·§14 갱신).
>
> **돌진은 등속(상수 `lungeSpeed`)으로 확정.** 설계 §3의 "가속 돌진" 서술과 달리 S1은 등속으로 둔다 — 그래야 돌진 도달 거리 = `lungeSpeed · lungeDuration`이 정확해 바닥 마커 길이가 실제 도달과 일치한다(가속이면 마커가 거짓말, E7). 설계 §3 문구도 등속으로 갱신.
>
> **`zigzagAmplitude` 단위:** §11은 px라 적었으나, S1은 전진 속도에 수직 성분을 더하는 속도 기반 모델을 쓰므로 amplitude는 "전진 대비 수직 가중"(무차원 비율에 가까움)으로 해석한다. placeholder 수치라 밸런싱 단계에서 체감으로 확정한다.

## 4. 아키텍처 (리뷰 초점)

### 4.1 `MovementLogic.ts` — 순수 모듈 형태

cc import 없는 순수 함수 모음. 입력은 평면 좌표(`{x, y}`)·시간·`moveParams` 수치, 출력은 이동 방향/상태다. 기존 `logic/`(StatusEffectLogic·SpawnDirectorLogic 등)과 같은 결정적 테스트 대상.

- **지그재그:** `zigzagDirection(toPlayer, elapsedSec, amplitude, period) → {x, y}`. 플레이어로 향하는 단위 벡터에 그 수직 방향 사인 성분(`sin(2π·elapsed/period) · amplitude`)을 더해 정규화한 진행 방향을 돌려준다. 컨트롤러가 이 방향에 `speed · dt`를 곱해 이동한다.
  - **가드(E1·E2):** `period ≤ 0`이면 분모 0이 되어 NaN이 새므로 **순수 추격 방향으로 폴백**한다. `toPlayer`가 영벡터(플레이어가 적 위에 정확히 겹침)면 정규화가 NaN이므로 영벡터를 그대로 돌려준다(컨트롤러가 이동을 건너뜀). amplitude 0이면 항상 추격 방향과 동일.
  - 수직 성분의 좌/우 방향(외적 부호, chirality)을 한 곳에 고정해 이후 리팩터가 흔들림 방향을 뒤집지 못하게 한다(테스트로 핀).
- **돌진 상태기계:** 상태 enum `Chase | Windup | Lunge | Cooldown`. **틱 시그니처를 TDD 전에 확정한다(독립 리뷰 A2):**

  ```
  tickLunge(state, timer, toPlayer:{x,y}, canAct:boolean, params, dt)
    → { state, timer, lockDir?: {x,y} }
  ```

  - `lockDir`은 **`Chase→Windup` 진입 에지에서만 non-null**로 반환한다(그 한 프레임에 윈드업 시작 시점의 플레이어 방향을 잠근다). 컨트롤러는 받은 값을 그대로 저장만 한다 — "정확히 한 번, 올바른 에지에서 잠금"이 순수 함수 테스트로 덮인다(독립 리뷰 A1). 잠금 벡터가 영벡터(겹침)면 윈드업을 건너뛰고 `Cooldown`/`Chase`로 폴백(E2).
  - **`canAct`(정지/빙결 아님)가 false면 FSM 전체를 동결한다 — 타이머도 멈춘다(E3).** 이동만 막고 타이머를 흘리면, 0.3초 돌진이 1초 정지당했을 때 거리 0을 이동하고 만료돼 텔레그래프가 약속한 타격이 헛친다. 동결이라 정지가 풀리면 남은 돌진을 마저 수행한다.
  - 상태 전이:
    - `Chase`: `canAct`이고 거리 ≤ `lungeRange`면 `Windup`으로(타이머 = `lungeWindup`, `lockDir` 반환).
    - `Windup`: 정지. 타이머 소진 시 `Lunge`로(타이머 = `lungeDuration`).
    - `Lunge`: 잠금 방향으로 등속 `lungeSpeed` 이동. 타이머 소진 시 `Cooldown`으로(타이머 = `lungeCooldown`).
    - `Cooldown`: 추격은 하되 **`lungeRange` 안에 있어도 재돌진 금지**. 타이머 소진 시 `Chase`로(이때 비로소 재돌진 가능, E8).
- **상태별 이동 벡터:** `lungeMovement(state, lockedDir, toPlayer, params) → {x, y}` — 상태에 따라 추격 방향(Chase·Cooldown) 또는 잠금 방향(Lunge) 또는 0(Windup)을 돌려준다.
- **텔레그래프·마커 기하(순수로 추출, 독립 리뷰 T4·E6):**
  - `windupBlend(elapsed, windup) → 0..1` — 윈드업 점멸/램프 곡선. 기존 `hitFlashBlend`는 1→0 단조 감쇠(한 번 페이드)라 "점멸"이 아니므로 별도 함수로 둔다.
  - `lungeReach(params) = lungeSpeed · lungeDuration`, `vectorToAngle(lockDir) → deg` — 바닥 마커 길이·회전을 순수로 계산해 테스트한다. 컨트롤러엔 `node.active`/`setRotation` 같은 엔진 호출만 남는다.

> 상태·타이머·잠금 방향이라는 *가변 상태*는 `EnemyController`가 보관하고(`reset()`에서 초기화), `MovementLogic`은 그 상태를 받아 다음 값을 계산하는 *순수 함수*만 제공한다. cc `Vec3` 같은 엔진 타입은 컨트롤러 경계 밖으로 넘기지 않는다(평면 좌표만).

### 4.2 `EnemyController` 분기

`update`의 추격·접촉 구간에서 `_followPlayer`를 `this._data.movement`로 분기한다.

```
movement === 'zigzag' → MovementLogic.zigzagDirection(...)로 방향 산출 후 이동
movement === 'lunge'  → 돌진 상태기계 틱 → 상태별 이동 벡터 → 이동 + 텔레그래프 구동
그 외(chase·미지 값)    → 기존 직선 추격(현행 유지)
```

- CC(정지·슬로우·빙결)와의 상호작용: `applied`로 `canAct`(정지·빙결이면 false)를 산출해 `tickLunge`에 넘긴다. `canAct`가 false면 FSM 전체가 동결돼(타이머 포함) 정지가 풀릴 때 남은 돌진을 마저 한다(§6, 독립 리뷰 E3). 슬로우(×0.5)는 `canAct=true`라 돌진은 진행하되 본체가 마커 길이보다 덜 가는 가벼운 불일치만 남는다(알려진 사소 항목).
- **`reset()` 초기화 목록(풀 재사용 이월 방지):** 돌진 상태(→`Chase`)·각 타이머·잠금 방향·지그재그 위상 elapsed에 더해, **바닥 마커 `active=false`**·**텔레그래프 틴트 래치 해제**까지 비운다. 뒤 둘을 빠뜨리면 재사용된 적이 돌진 중간 상태나 멈춘 마커를 달고 스폰되는 고전적 풀 재사용 유령이 생긴다(독립 리뷰 hidden-complexity). 기존 `reset()`(EnemyController.ts:109-128)의 꼼꼼한 초기화 패턴을 따른다.

### 4.3 텔레그래프 렌더

- **윈드업 점멸:** `Windup` 동안 sprite 색을 텔레그래프 색(placeholder, 예: 옅은 빨강)으로 `windupBlend(elapsed, windup)` 진행도에 따라 섞는다.
  - **`_applyFlashColor` 일반화 필요(독립 리뷰 A4):** 기존 `_applyFlashColor`(EnemyController.ts:197-207)는 흰색(255,255,255) 고정 블렌드라 색 인자를 안 받는다. "색만 바꿔 재사용"이 아니라 `_applyTintBlend(target, blend)`로 일반화하는 작은 리팩터다(기존 흰 플래시도 이걸 호출).
  - **틴트 우선순위 + 복원 래치(독립 리뷰 E5):** 우선순위는 사망 > 피격 플래시 > 텔레그래프 > CC > 기본. 단순 순서가 아니라 **복원 래치**가 필요하다 — `_updateControlTint`가 텔레그래프에도 양보하고, 텔레그래프는 `_flashing`에 양보하며, 윈드업이 끝날 때 색을 복원할 `_telegraphTinted` 래치를 둔다(복원 대상: CC 중이면 CC 색, 아니면 baseTint). 래치를 빠뜨리면 빨강이 박힌 적이 남는다. `update()`(EnemyController.ts:138-148)의 기존 색 기록 순서(`_updateFlash`→`_updateControlTint`)에 텔레그래프 기록을 정확한 위치로 끼운다.
- **바닥 경로 마커:** `Enemy.prefab`에 placeholder 단색 막대 Sprite 자식 노드를 두고 `@property(Node)`로 참조한다(미연결 시 null 가드로 마커 없이도 동작). `Windup` 동안만 활성화하고, 잠금 방향으로 회전(`vectorToAngle`)·돌진 도달 길이(`lungeReach`)만큼 길이를 스케일한다.
  - **부모 스케일 상쇄(독립 리뷰 A3):** 마커는 자식 노드라 월드 길이 = 자식 로컬 스케일 × 부모 스케일이다. 불가사리는 `threatScale`이 큰 대형 적이라 마커가 그만큼 늘어난다 → 자식 로컬 스케일을 `lungeReach / parentScale`로 계산해 상쇄한다. 마커 가시성·트랜스폼은 매 프레임 현재 상태에서 유도하고, **`_startDeath`에서 마커를 비활성화**한다(윈드업 중 사망 시 바닥 막대가 사망 연출 내내 남는 것 방지, E4).
  - 돌진 이동과 무관한 적(chase·zigzag)은 마커가 항상 비활성이라 비용이 거의 없다.

## 5. 순수 로직 테스트 전략 (TDD)

- **파일:** `tests/logic/EnemyMovement.test.ts`(피처명 PascalCase = `EnemyMovement` — `ready-impl` 게이트 규칙). `MovementLogic` 순수 함수와 데이터 sanity를 함께 단언한다.
- **단언(지그재그):**
  1. 위상 0에서는 순수 추격 방향, 위상 ¼주기에서는 수직으로 최대 치우친 방향(부동소수라 `toBeCloseTo`). amplitude 0이면 항상 추격 방향과 동일.
  2. **가드** — `period ≤ 0`(0 포함)이면 추격 방향 폴백(NaN 금지, E1). `toPlayer` 영벡터면 영벡터 반환(E2). 수직 성분의 좌/우 부호(chirality)를 핀해 흔들림 방향 고정.
- **단언(돌진 상태기계):**
  3. **한 바퀴 전이** — `Chase`(거리 ≤ `lungeRange`)→`Windup`→`Lunge`→`Cooldown`→`Chase`로 정확히 순환. 거리 > `lungeRange`면 `Chase` 유지.
  4. **방향 잠금** — `Windup` 진입 에지에서만 `lockDir`이 non-null로 반환되고, 그 뒤 플레이어가 움직여도 `Lunge` 동안 불변. 잠금 벡터가 영벡터면 윈드업을 건너뛰어 폴백(E2).
  5. **CC 동결(E3)** — `canAct=false`면 상태·타이머가 그대로 멈추고(돌진 타이머 안 흐름), `true`로 돌아오면 남은 돌진을 마저 수행.
  6. **커밋·재무장(E8)** — 윈드업 중 플레이어가 `lungeRange` 밖으로 나가도 돌진은 수행(텔레그래프 약속 지킴). `Cooldown` 중에는 `lungeRange` 안에 있어도 재돌진 안 함(타이머 소진 후에만).
  7. **dt 오버슈트** — 잔여 타이머보다 큰 `dt`가 들어와도 상태를 건너뛰거나 잃지 않음.
- **단언(텔레그래프·마커 기하):**
  8. `windupBlend`가 윈드업 진행에 따라 의도한 곡선(점멸/램프), `lungeReach = lungeSpeed·lungeDuration`, `vectorToAngle`가 잠금 방향을 올바른 각도로 변환.
- **단언(데이터 sanity, 백로그 D2 일부 선반영 — 독립 리뷰 T1):**
  9. `enemies.json`에 `eodukshini`(`movement:"zigzag"`)·`bulgasari`(`movement:"lunge"`) 존재. **필드 "존재"가 아니라 수치 유효성을 단언** — 돌진 적은 `lungeRange`·`lungeWindup`·`lungeSpeed`·`lungeDuration` **> 0**, `lungeCooldown` **≥ 0**; 지그재그 적은 `zigzagPeriod` **> 0**(분모 0 → NaN 차단), `zigzagAmplitude` ≥ 0. 이 단언이 placeholder `period:0` 같은 함정을 RED로 잡는다.
  10. **무결성:** `spawn-table.json`이 참조하는 모든 enemyId가 `enemies.json`에 존재(S0 가드 유지·확장).
- 신규 함수·데이터가 아직 없으니 1~9가 **RED**로 시작 → 구현 후 **GREEN**. 기존 스위트(EnemyRoster·SpawnDirector 등)도 GREEN 유지.

## 6. 위험·주의

- **Cocos에서 NaN은 조용하다(독립 리뷰 hidden-complexity).** `node.setPosition(NaN, …)`은 예외를 안 던지고 적을 원점으로 보낸다. `zigzagPeriod:0`(E1)·영벡터 잠금(E2) 둘 다 이 경로라 placeholder 데이터로 *실제* 발현한다. 가드(§4.1)와 sanity 테스트의 `> 0` 단언(§5 단언 9)으로 RED에서 막는다 — 이 슬라이스 최대 함정.
- **돌진 × CC 상호작용 — 확정:** `canAct=false`(정지·빙결)면 돌진 FSM 전체를 **동결**한다(타이머 포함). 이동만 막고 타이머를 흘리면 정지당한 돌진이 거리 0으로 만료돼 텔레그래프가 헛친다(독립 리뷰 E3). 동결이라 정지가 풀리면 남은 돌진을 마저 한다. 슬로우(×0.5)는 `canAct=true`라 돌진은 진행하되 본체가 마커보다 덜 가는 사소 불일치만(알려진 항목). 테스트(§5 단언 5)로 고정.
- **돌진 종료 조건:** `lungeDuration` 시간 기반으로 확정(거리 기반·플레이어 도달 기반 대안은 비결정적이거나 추가 상태 필요). 등속이라 도달 거리 = `lungeSpeed·lungeDuration`이 정확해 마커 길이와 일치(E7).
- **마커 노드와 단일 프리팹:** 모든 적이 한 `Enemy.prefab`을 공유하므로, 바닥 마커 자식 노드도 모든 적에 존재하되 돌진 적의 윈드업에서만 활성화된다. 다른 적에선 비활성이라 비용이 거의 없다. `@property` 미연결 시 null 가드로 안전(마커 없이도 동작). 자식 스케일은 부모 `threatScale`을 상쇄해야 함(§4.3 A3).
- **돌진 데미지 체감(D1 기대치 — 독립 리뷰 S1):** D1로 돌진 데미지를 접촉 경로로 두면, `lungeSpeed=600`에서 적이 플레이어를 ~0.1초 만에 *관통*해 접촉 피해가 1~1.5로 미미하다(빠를수록 접촉이 줄어듦). 즉 **S1의 돌진은 "텔레그래프 + 이동 수직 슬라이스"이고 실질 데미지는 S2 버스트 전까지 미미하다**가 정직한 서술이다. QA 문서·인게임 테스트 항목에 이를 명시해, 7단계 테스터가 "돌진이 데미지를 안 준다"를 버그로 오인하지 않게 한다(접촉 값을 무리하게 올리면 S2 버스트 도입 시 이중 피해 씨앗이 되므로 올리지 않는다).
- **수치는 전부 placeholder:** tint·스탯·`moveParams`·스폰 가중치는 구분/동작 확인용이며 밸런싱 단계(로드맵 11-12주)에서 확정한다. 단, 분모·정규화 값은 0을 쓰지 않는다(위 NaN 항목).
- **`movement` 폴백:** 미구현·미지 `movement` 값은 chase로 폴백해, 데이터에 zigzag/lunge 외 값이 들어와도 깨지지 않는다(설계 §11 forward-compat 원칙).

## 7. 백로그 확인 (워크플로우 0-1)

`docs/development/backlog.md`를 확인했다. S1이 직접 닫는 항목은 없으나, 다음이 관련된다.

- **D2(중) — DataManager 스키마 검증 + 실데이터 sanity 테스트.** `moveParams` 같은 신규 이동 데이터 필드가 들어오므로 필드 누락·오타 방어가 필요해진다. S1에서 위 §5의 데이터 sanity 테스트(단언 4~5)로 *일부를 선반영*한다(전면 스키마 검증/zod 도입은 D2로 계속 열어둠).

## 8. 스코프 밖 (이번 슬라이스에서 안 함)

- `attack` 블록 스키마와 능동 공격 버스트 데미지(`attack.damage`) — S2/S3.
- 유격(kite) 이동·적 발사체 — S2.
- 근접 휘두르기·부채꼴 즉시 판정 — S3.
- 돌진 × CC 외의 능동 공격 텔레그래프 정교화(범위 마커 형태·색 최종) — 아트 단계.
- 밸런싱 수치 확정(HP·속도·`moveParams`·가중치 — 전부 placeholder).

## 9. 후속 슬라이스 (예고 — 이번 스코프 아님)

- **S2 — 적 발사체:** 구미호·이무기·물귀신. 유격 이동 + 적 발사체 + 발사 형태(단발·부채꼴·확산) + 발사 텔레그래프. 분리 데미지 모델(`attack.damage`)이 여기서 처음 착지한다.
- **S3 — 근접 휘두르기:** 두억시니·야차·그슨대. 부채꼴 즉시 판정 + 범위 텔레그래프.

---

## 10. /autoplan 리뷰 반영 (CEO + Eng)

이 계획은 office-hours(스코프·핵심 결정 2건) 후 `/autoplan`으로 CEO·Eng 리뷰를 거쳤다. Design·DX 페이즈는 스코프가 없어 건너뛰었다(적 AI + 최소 텔레그래프 마커 — UI/개발자 대면 산출물 아님). Codex는 미설치라 외부 보이스는 독립 Claude 서브에이전트로 수행했다(degradation 경로).

**CEO 렌즈 (스코프·전략):** 슬라이스가 설계 §13 로드맵의 S1을 그대로 따르고, office-hours에서 D1(돌진 데미지 접촉 유지)·D2(텔레그래프 점멸+마커)로 스코프를 좁혀 한 슬라이스 분량으로 적절하다. 전제 5개는 office-hours에서 확인됨. 신규 적 2종 + 순수 이동 로직 + 첫 텔레그래프로, 기존 토대(`EnemyController`·피격 플래시·풀링) 위에 점진 확장하는 건전한 범위. "능동 공격 버스트"를 S2로 미룬 컷은 슬라이스를 작게 유지하는 합리적 선택이나, 그 대가로 S1 돌진의 실질 데미지가 미미하다는 점을 정직하게 서술해야 한다(아래 반영).

**Eng 렌즈 (아키텍처·테스트):** 순수 로직/컨트롤러 분리는 프로젝트 패턴(ADR 002)과 정합. 돌진 FSM을 주입 상태 + 순수 전이로 두는 형태는 옳다. 다만 독립 리뷰가 구현 전 손봐야 할 정합성·테스트 구멍을 다수 짚었고, 아래 감사 추적대로 계획에 반영했다.

### 독립 리뷰 컨센서스 (Eng — 서브에이전트 단독, Codex N/A)

| 차원 | 평가 |
|---|---|
| 1. 아키텍처 건전성 | 근본 건전(순수/컨트롤러 분리 정확). 잠금 래치·틱 시그니처는 보강 필요 → 반영 |
| 2. 테스트 커버리지 | 초안 부족(해피패스 1바퀴만) → 가드·CC·커밋·오버슈트·sanity `>0`까지 확장 |
| 3. 성능 리스크 | 낮음(적별 상수 작업, 마커는 윈드업에만 활성) |
| 4. 보안 위협 | 해당 없음(로컬 게임 로직, 입력 외부 노출 없음) |
| 5. 에러 경로 | **취약 — NaN 무성 전파(E1·E2)가 최대 위험** → 가드 + sanity 단언으로 반영 |
| 6. 배포 리스크 | 낮음(인게임 기능, 별도 배포 채널 없음) |

### 결정 감사 추적 (6원칙 자동결정)

| # | 발견 | 분류 | 원칙 | 결정 | 반영 위치 |
|---|------|------|------|------|----------|
| 1 | E1 `zigzagPeriod:0` → NaN 유령 | 기계적(critical) | P1 완전성 | 가드(`period≤0`→추격) + sanity `>0` 단언 | §3·§4.1·§5(9)·§6 |
| 2 | E2 영벡터 잠금 → NaN | 기계적(high) | P1 | 영벡터 폴백 가드 + 테스트 | §4.1·§5(4) |
| 3 | E3 CC 중 타이머 흐름 → 헛돌진 | 기계적(high) | P5 명시 | `canAct`로 FSM 전체 동결 | §4.1·§4.2·§5(5)·§6 |
| 4 | A1 잠금 래치가 컨트롤러 글루 | 기계적(high) | P5 | 순수 전이가 Windup 에지에서 `lockDir` 반환 | §4.1 |
| 5 | A2 틱 시그니처 미확정 → 재TDD | 기계적(high) | P5 | `(state,timer,toPlayer,canAct,params,dt)` 확정 | §4.1·§5 |
| 6 | T1 sanity가 "존재"만 검사 | 기계적(high) | P1 | 수치 유효성(`>0`) 단언으로 강화 | §5(9) |
| 7 | E7 가속 vs 등속 모순 | 기계적(medium) | P3 실용 | S1은 등속 확정(마커 길이 정확) | §3·§4.1·§6 |
| 8 | A3 마커 부모 스케일 상속 | 기계적(medium) | P5 | 자식 스케일 = `lungeReach/parentScale` | §4.3 |
| 9 | A4 `_applyFlashColor` 흰색 고정 | 기계적(medium) | P5 | `_applyTintBlend(target,blend)`로 일반화 | §4.3 |
| 10 | E4 윈드업 중 사망 시 마커 잔류 | 기계적(medium) | P5 | `_startDeath`에서 마커 비활성 | §4.3 |
| 11 | E5 틴트 우선순위 복원 래치 | 기계적(medium) | P5 | `_telegraphTinted` 복원 래치 | §4.3 |
| 12 | E6 점멸 곡선 = 단조 감쇠 | 기계적(medium) | P1 | `windupBlend` 신규 순수 함수 | §4.1·§5(8) |
| 13 | E8 쿨다운 중 재무장 | 기계적(low) | P5 | Cooldown은 범위 내여도 재돌진 금지 | §4.1·§5(6) |
| 14 | T4 마커 기하 미테스트 | 기계적(medium) | P1 | `lungeReach`·`vectorToAngle` 순수 추출 | §4.1·§5(8) |
| 15 | reset 누락(마커·텔레그래프 래치) | 기계적(high) | P5 | reset 목록에 마커 active=false·래치 해제 추가 | §4.2 |
| 16 | S1 돌진 데미지 체감 미미(D1) | **사용자 알림** | P6 | 컷 유지(D1 사용자 확정), 기대치를 정직 서술 | §6·QA 문서 |
| 17 | S2 `lungeDuration` 신설 적절 | 확인 | — | 채택, `IEnemyMoveParams` 전 필드 선택적 | §3 |

> **사용자 챌린지 없음.** 두 모델(여기선 독립 서브에이전트)이 사용자의 명시 방향(D1·D2)을 뒤집자고 하지 않았다 — 리뷰는 그 결정 위에서 *구현을 단단히* 했을 뿐이다. #16만 "기대치 프레이밍"으로 사용자에게 알린다(데이터 결정 반전 아님).
