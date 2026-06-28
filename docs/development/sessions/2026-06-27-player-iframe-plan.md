# 플레이어 피격 무적(i-frame) + 틱당 max 피해 게이트 (계획)

- **작성일:** 2026-06-27
- **브랜치:** feat/player-iframe
- **슬라이스:** 플레이어 피해 처리 토대 (적 발사체 슬라이스 S2a에서 분리한 선행 슬라이스)
- **상위 맥락:** 적 로스터 S2a(`sessions/2026-06-27-enemy-projectile-plan.md`)를 설계하던 중, 다중 피해 처리(여러 발사체·여러 적 동시 명중)를 어떻게 묶을지 결정하면서 도출됐다. 이 게이트는 적 발사체와 의존이 없고 기존 모든 적의 접촉 피해까지 건드리는 플레이어 쪽 토대라, S2a를 작게 유지하려고 **먼저 별도 슬라이스로** 뗐다.
- **리뷰:** office-hours·autoplan은 재실행하지 않는다. 이 게이트는 S2a autoplan 단계에서 독립 eng 서브에이전트가 이미 함께 검토했고 차단 이슈가 없었다(중복 리뷰 가치 얇음 — 사용자 승인). 계획 문서 작성 후 바로 계획 승인 → TDD로 간다.

---

## 1. 배경·목적

지금 플레이어 피해는 `GameManager.damagePlayer(amount)`가 받은 즉시 HP에서 깎는 구조다. 적 접촉(`EnemyController._checkContactDamage`)은 닿아 있는 동안 매 프레임 `contactDamagePerSec × dt`를 호출하고, **닿은 적마다 따로** 호출하므로 떼로 둘러싸이면 그만큼 합산된다.

여기에 적 발사체(S2a)와 부채꼴·확산(S2b)이 들어오면, 한 번에 여러 발이 동시 명중해 피해가 그대로 N배로 들어오는 문제가 생긴다. 이를 막는 표준 장치가 **피격 무적(i-frame)**이고, 사용자 결정은 한 발 더 나아가 **"한 틱에 들어온 여러 피해 중 가장 센 것 1회만"** 적용하는 모델이다.

이 슬라이스는 그 장치를 플레이어 피해 경로 한 곳에 만든다. 적 발사체가 들어오기 전에 토대를 깔아두면, S2a·S2b는 발사체가 `damagePlayer`를 호출하는 것만으로 자동으로 이 규칙을 따른다(특별 배선 불필요).

## 2. 스코프 (구현 대상)

- 신규 순수 모듈 `logic/PlayerDamageLogic.ts` — 틱 누적(`max`)과 틱 해소.
- `GameManager`에 피해 틱 게이트를 얹는다(`_tickTimer`·`_tickMax`). `GameManager`가 이미 `_playerHp`·`update(dt)`·`damagePlayer`를 소유하므로 새 컴포넌트 없이 여기 둔다.
- 기존 경로 두 곳 리팩터: `GameManager.damagePlayer`(즉시 차감 → 틱 제출), `EnemyController._checkContactDamage`(`× dt` 매 프레임 차감 → `× T` 틱 제출).
- 피격 틱 시간 `T`는 placeholder 상수(밸런싱 노브).
- 이 슬라이스가 **출하하는 게임플레이 변화:** 접촉이 "초당 DoT(닿은 적 합산)"에서 "틱당 max"로 바뀐다 — 기존 적(S0~S1) 대상이라 독립적으로 QA한다.

**스코프 밖:** 적 발사체·attack 버스트 피해의 *제출*은 S2a 소관(이 게이트는 `damagePlayer` 진입점만 제공한다). 현재 이 게이트를 지나는 피해원은 접촉(돌진 포함, 돌진은 현재 접촉 경로 사용)뿐이다.

## 3. 결정 (피해 모델)

사용자와의 논의로 확정한 모델이다.

- **전역 i-frame + 틱당 max.** 플레이어는 고정 주기 `T`(피격 틱 = 무적 창)마다 피해를 **한 번**만 받는다. 그 한 번의 값은 그 틱 동안 들어온 모든 피해원(접촉·발사체·돌진·휘두르기) 중 **가장 센 것**이다. 부채꼴 N발이 동시에 닿아도, 여러 적이 동시에 때려도 그 틱엔 가장 위험한 한 방만 들어온다.
- **왜 max(가장 센 것)인가.** i-frame을 쓰면 "겹친 여러 피해 중 무엇을 적용하나"를 정해야 한다. 먼저 잡힌 것(iteration order, 임의적) 대신 **가장 센 것**을 적용해, 강한 적과 약한 적이 겹쳤을 때 약한 쪽만 맞는 허점을 없앤다(사용자 결정).
- **접촉도 포함(전역).** i-frame이 접촉까지 묶으므로 §5 접촉 모델이 "초당 DoT(닿은 적 합산)"에서 "틱당 max"로 바뀐다. 접촉이 한 틱에 내는 값은 `contactDamagePerSec × T`로 둬 단일 접촉의 평균 피해율을 보존한다(`T`는 청크 크기만 바꿈). **의도된 체감 변화:** 근접 적이 떼로 붙어도 더는 합산되지 않고 가장 센 한 마리만큼만 들어온다(뱀서식 — 떼의 위협이 합산 피해가 아니라 가둠·DPS 체크로 옮겨감).
- **`T`는 밸런싱 노브.** 코드엔 placeholder 상수로 두고 수치(틱이 짧을수록 어려움)는 밸런싱 단계에서 정한다.

## 4. 아키텍처

### 4.1 순수 로직 — `PlayerDamageLogic`

`cc` import 없이 누적·해소만 다뤄 결정적으로 테스트한다.

- **누적:** `accumulateDamage(pending, incoming)` = `Math.max(pending, incoming)` — 현재 틱에 들어온 값 중 최대만 남긴다.
- **틱 해소:** 경과 타이머가 `T`를 넘으면 누적값을 "이번 틱에 적용할 피해"로 반환하고 누적을 0으로, 타이머를 0(또는 `−T`)으로 리셋한다. `tickDamage(timer, pendingMax, dt, T) → { applied, timer, pendingMax }` 형태로, 컨트롤러가 이 결과로 HP를 깎는다.

### 4.2 게이트 컴포넌트 — `GameManager`

`GameManager`가 `_tickTimer`와 `_tickMax`를 새로 든다.

- **제출:** `damagePlayer(amount)`는 이제 즉시 차감하지 않고 `_tickMax = max(_tickMax, amount)`로 합친다(상태가 Playing이 아니면 기존처럼 무시).
- **해소:** `update(dt)`에서 `_tickTimer`를 진행하다 `T`를 넘으면 `_tickMax`만큼 HP를 깎고(여기서 `_playerHp ≤ 0`이면 기존 GameOver 전이), `_tickMax`·`_tickTimer`를 리셋한다. HP 차감·GameOver 판정이 즉시 경로에서 이 틱 경로로 옮겨온다.
- 고정 주기 모델이라 "한 대 맞은 직후의 무적"은 다음 틱까지 자연히 생긴다(별도 무적 플래그 불필요).

### 4.3 접촉 경로 리팩터 — `EnemyController._checkContactDamage`

닿아 있는 동안 매 프레임 `contactDamagePerSec × dt`로 즉시 차감하던 것을, `contactDamagePerSec × T`를 `damagePlayer`로 **제출**하는 것으로 바꾼다. 매 프레임 제출해도 게이트가 `max`로 합치므로 멱등이고, 단일 접촉의 평균 피해율은 보존된다. 돌진(현재 접촉 경로 사용)도 자동으로 이 게이트를 지난다.

## 5. 테스트 계획 (RED로 덮을 항목)

순수 로직은 `tests/logic/PlayerIframe.test.ts`(파일명은 피처 슬러그 PascalCase 규칙)로 덮는다.

**`PlayerDamageLogic`:**
- `accumulateDamage(pending, incoming)` = `max` — 큰 값으로 갱신, 작은 값은 무시 (핵심)
- 한 틱에 여러 번 제출 → 가장 센 것만 남음
- 틱 경과(타이머 ≥ `T`) → 누적값을 적용값으로 반환 + 누적·타이머 리셋
- 틱 미경과 → 적용값 0(무적 유지)
- 여러 틱 연속 → 각 틱마다 그 틱의 max를 적용
- 접촉 환산 `contactDamagePerSec × T`가 단일 접촉의 평균 DPS를 보존하는지(틱 누적 합 ÷ 시간 = 원래 DPS)

수동 검증(인게임)은 QA 문서(`docs/qa/player-iframe-test.md`)에 적는다 — 여러 적이 동시에 때려도 한 틱 한 방(가장 센 것)만 들어오는지, **회귀: 기존 근접 적 접촉이 의도대로 틱당 max로 바뀌었는지(떼로 둘러싸도 합산 안 됨)**, 단일 적 접촉의 평균 피해가 기존과 비슷한지.

## 6. Impact Map (회귀 기준)

| 변경 파일 | 확인 범위 |
|---|---|
| `logic/PlayerDamageLogic.ts`(신규) | 순수 테스트 전수 |
| `systems/GameManager.ts` | `damagePlayer` 제출 전환·`update` 틱 해소·GameOver 전이가 틱 경로에서 정상 동작 |
| `components/EnemyController.ts` | `_checkContactDamage`가 `× T` 제출로 바뀐 뒤 접촉 피해가 의도대로(틱당 max, 떼 합산 없음) |

**의도된 동작 변경(회귀 아님):** 접촉 떼 합산 폐기. 이미 머지된 적(S0~S1)의 접촉 체감이 바뀌므로 QA에서 의도된 변경임을 확인한다.

## 7. 백로그 (밸런싱 — 구현 중 backlog.md ⚖️로 이관)

- 피격 틱 `T`(=i-frame 창) 수치 — 짧을수록 어려움.
- 접촉 한 틱 환산값(`contactDamagePerSec × T`)이 단일/소수 접촉 상황에서 기존 체감과 맞는지 검증.

## 8. 후속

이 슬라이스가 머지되면 적 발사체 S2a(`feat/enemy-projectile`)를 main 위에서 재개한다 — S2a의 발사체·접촉은 이 게이트의 `damagePlayer` 제출 경로를 그대로 쓴다.
