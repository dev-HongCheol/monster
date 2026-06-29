# 적 로스터 S2b — 다발 발사체 적(이무기·물귀신) 계획

- **작성일:** 2026-06-29
- **브랜치:** feat/enemy-multishot
- **슬라이스:** 적 로스터 재기획 S2b (패밀리 2 — 원거리 발사체의 둘째 증분)
- **선행:** S2a enemy-projectile(#44, 구미호 단발) · player-iframe(#43)
- **설계 정본:** `docs/planning/enemy-system.md` §3·§5·§13
- **리뷰 수준:** 경량 인라인(eng 체크리스트 직접 점검). office-hours에서 전제 점검·대안 비교 완료, 풀 autoplan 다중 에이전트 파이프라인은 슬라이스 규모 대비 과해 생략(사용자 결정 2026-06-29).

---

## 1. 배경과 목적

S2a에서 구미호(단발 발사체)를 통해 적 발사체 시스템 전체를 깔았다. 적이 플레이어를 향해 발사체를 쏘는 공격 상태기계(조준→텔레그래프→발사→쿨다운), 발사체 컴포넌트(`EnemyProjectile`), 영속 발사체 풀, 그리고 발사 위임 콜백이 이미 자리 잡았다. S2a 시점에는 발사 기하가 "단발 한 방향" 하나뿐이다.

이번 슬라이스는 그 위에 **발사 기하만 증분**한다. 마법 시스템이 "패턴 먼저 → 효과 나중"으로 쪼갠 것과 같은 결을 적에도 적용한 둘째 조각이다. 두 적을 추가한다.

- **이무기(`imugi`)** — 유격(느림)/원거리, **부채꼴 발사체**. 느리게 전진하며 전방 부채꼴로 여러 발을 뿌리는 묵직한 원거리 적.
- **물귀신(`mulgwisin`)** — 유격(정지형)/원거리, **확산 발사체**. 거의 제자리에서 사방으로 탄막을 뿌려 플레이어에게 이동을 강제하는 적.

핵심 한 줄: **마법 `SpellPatternLogic.directionalPlan`에 들어 있는 부채꼴 각도 분포 수학을 순수 공유 헬퍼로 추출**해, 마법과 적이 같은 기하를 쓰게 만든다. 이무기의 부채꼴은 마법의 directional 부채꼴과 수학적으로 동일하고, S3(근접 휘두르기)의 부채꼴 판정도 같은 각도 계산을 잇게 된다.

## 2. 스코프

### 이번 슬라이스가 포함하는 것

1. 순수 모듈 `logic/FireGeometry.ts` 신설 — 부채꼴(호) 방향과 확산(링) 방향을 계산하는 순수 함수.
2. `SpellPatternLogic.directionalPlan`을 그 헬퍼를 호출하도록 리팩터(마법 동작 무변경 — 기존 회귀 테스트가 가드).
3. `EnemyController._tickEnemyAttack`/`_fireProjectile`에 `projectile_fan`·`projectile_spread` 배선 — 한 발 위임을 N발 위임으로 확장.
4. 이무기·물귀신 데이터 추가(`enemies.json`) + 스폰 테이블 합류.
5. 피처 테스트 `tests/logic/EnemyMultishot.test.ts`(부채꼴·확산 기하 + F20 데이터 불변식).

### 이 슬라이스가 닫는 백로그 항목

- **F20**(낮음, 발사체 적 테마와 동일) — (a) 유격 적의 **정착-vs-사거리 불변식**(`preferredRange + KITE_DEADZONE_BAND ≤ attack.range`)을 단언하는 데이터 정합 테스트 추가. (b) `EnemyController._fireProjectile`의 `_fireProjectileFn` null 가드 주석 정리(실제 "풀 미연결"은 `EnemySpawner`가 처리하므로 주석이 오해를 부른다).

### 명시적으로 범위 밖(NOT in scope)

- **공격 FSM·`EnemyProjectile`·발사체 풀 변경** — 전부 S2a 그대로 재사용. Fire 에지는 이미 발사하고, 이번엔 그 한 번에 N발을 내보내기만 한다.
- **발사체당 데미지 페널티** — 마법의 발사체 수 강화에만 있는 플레이어 밸런스 개념이고, 적 발사체에는 적용하지 않는다. 한 볼리의 N발은 각각 `attack.damage`를 들되, player-iframe(틱당 max 1회)이 같은 틱에 들어온 다발을 한 번으로 묶으므로 부채꼴·확산이 틱당 피해를 곱하지 않는다(의도된 동작).
- **S2b 적의 고유 스프라이트/이펙트** — placeholder 색·크기만. 아트는 로드맵 7–9주.
- **F19**(돌진+발사 겸용 적 `_windupActive` 충돌) — 이무기·물귀신은 kite+발사라 `_windupActive`를 건드리지 않아 여전히 미발현. 겸용 적이 실제 생기는 시점(S3 등)으로 이월. 이번 구현에서 미접촉을 재확인만 한다.

## 3. 접근 — 공유 `fanDirections` 추출 (office-hours 확정)

office-hours에서 세 대안(공유 헬퍼 추출 / 적 전용 중복 / `buildFirePlan` 일반화)을 놓고 **공유 헬퍼 추출**을 골랐다. `enemy-system.md` §13의 설계 의도("부채꼴 기하는 `SpellPatternLogic` 재사용 검토")와 맞고, 같은 각도 수학을 마법·적 부채꼴·적 확산·S3 근접 부채꼴 네 곳이 쓰게 될 것이라 rule-of-three를 이미 넘는다.

### 3.1 신규 모듈 `logic/FireGeometry.ts` (순수, cc 비의존)

각도 분포만 다루는 중립 모듈이다. 마법(`ISpellData`)도 적(`IEnemyAttackData`)도 import하지 않아, 어느 쪽 데이터 모델에도 묶이지 않는다.

```
fanDirections(aimX, aimY, count, spreadAngleDeg) → readonly [number, number][]
```
- **부채꼴(호):** aim을 중심으로 `-총각/2 ~ +총각/2`를 `count-1` 분모로 균등 분포. `count=1`이면 aim 직선 1발, 홀수는 중앙 발사체가 정확히 aim·짝수는 중앙 없이 대칭. 이는 현재 `directionalPlan`(79–82줄)의 수학 그대로다.

```
radialDirections(aimX, aimY, count, spreadAngleDeg) → readonly [number, number][]
```
- **확산(링):** `count` 분모로 균등 분포(끝점 중복 없음). `spreadAngleDeg=360`이면 사방 등간격 N발. `count=1`이면 aim 1발.

두 함수는 같은 `rotate` 헬퍼를 공유한다(현재 `SpellPatternLogic`의 private `rotate`를 이 모듈로 이동). **count 클램프 규칙을 `directionalPlan`에서 그대로 가져온다** — `Math.floor` 후 비유한값(NaN/Infinity)이면 1로, 1 미만이면 1로. 이 규칙을 빠뜨리면 마법 회귀가 깨지므로 추출의 핵심 불변식이다.

> 부채꼴과 확산을 한 함수에 `mode` 플래그로 합치는 대신 두 함수로 두는 이유: 분모(`n-1` vs `n`)와 끝점 포함 여부가 다르고, 호출부에서 어떤 기하인지 이름으로 드러나는 편이 읽기 쉽다(explicit over clever). 최종 시그니처는 TDD로 확정한다.

### 3.2 `SpellPatternLogic.directionalPlan` 리팩터 (동작 무변경)

`directionalPlan`은 방향 목록을 `fanDirections`에서 받고, 각 방향에 `spell`의 속도·데미지·반경을 입혀 `ShotSpec`을 조립하는 역할만 남긴다. 공식·순서·클램프가 동일하므로 출력은 바이트 단위로 같다. **`tests/logic/SpellPatternEngine.test.ts`가 회귀 가드**다 — 추출 후 이 스위트가 GREEN이어야 한다.

### 3.3 `EnemyController` 배선

- **`_tickEnemyAttack`(500줄 부근):** 현재 `atk.type !== 'projectile_single'`만 통과시키는 가드를 세 발사체 타입(`projectile_single`·`projectile_fan`·`projectile_spread`)을 받도록 넓힌다. 공격 FSM 자체는 타입에 무관하게 동일하게 돈다(조준→텔레그래프→발사→쿨다운).
- **`_fireProjectile`(541줄 부근):** 지금은 잠근 조준 방향으로 한 발 위임한다. 이를 `atk.type`에 따라 `fanDirections`(부채꼴) 또는 `radialDirections`(확산)로 N개 방향을 구한 뒤, 각 방향마다 `_fireProjectileFn`을 호출하는 루프로 바꾼다. `projectile_single`은 `count=1`로 자연히 흡수된다(별도 분기 불필요).
- **텔레그래프(`_updateAttackTelegraph`):** 타입 비의존(`_attackState`만 읽음)이라 변경 없음. 부채꼴·확산도 같은 단일 윈드업 점멸을 쓴다.
- 방향 계산은 순수(헬퍼)이고, N발 발사 루프는 cc 글루다 — S2a가 FSM(순수)/발사(글루)를 가른 패턴 그대로다.

## 4. 데이터 (placeholder)

수치는 전부 placeholder이며 밸런스 단계(로드맵 11–12주)에서 확정한다. **F20 불변식 `preferredRange + KITE_DEADZONE_BAND(40) ≤ attack.range`를 두 적 모두 만족**하도록 잡는다(어기면 적이 사거리 밖에 정착해 거의 안 쏜다).

### 이무기 `imugi` — kite(느림) / 원거리 / 부채꼴

- 느린 전진·큰 덩치: `speed` 낮게, `maxHp`·`threatScale` 크게, `tint` 청록.
- `moveParams.preferredRange` + 40 ≤ `attack.range` 성립하게(예: 300 + 40 = 340 ≤ 420).
- `attack`: `type: "projectile_fan"`, `projectile.count` 3 안팎, `projectile.spreadAngleDeg` 30 안팎, 속도·반경·쿨다운·텔레그래프.

### 물귀신 `mulgwisin` — kite(정지형) / 원거리 / 확산

- **정지형 거동은 데이터로 달성**(신규 코드 없음): `speed`를 낮게 두면 kite가 `preferredRange` 데드존에 정착해 거의 제자리에 머문다. `kiteDirection`은 데드존에서 영벡터(정지)를 돌려준다.
- `moveParams.preferredRange` + 40 ≤ `attack.range`.
- `attack`: `type: "projectile_spread"`, `projectile.count` 8 안팎, `projectile.spreadAngleDeg` 360, 쿨다운은 다발 보상으로 길게.
- 구현 단계에서 데드존(±40)만으로 "정지형" 체감이 충분한지 인게임 확인. 부족하면 `speed`/`preferredRange` 튜닝(데이터)으로 조정.

> **주의(밸런스 플래그):** 메모리 `feedback_default_xp_drop_70`은 신규 적 `xpDrop` 기본 70+를 말하지만, 현 로스터 placeholder는 18~35 스케일이다(S0 placeholder는 사용자 관리 영역). 이무기·물귀신 `xpDrop`은 로스터 스케일에 맞춘 placeholder로 두고, 70+ 적용 여부는 7단계/밸런스에서 사용자가 확정한다.

## 5. 테스트 전략

피처 테스트 `tests/logic/EnemyMultishot.test.ts`(순수 로직만). cc 의존 글루(N발 발사 루프·풀 acquire)는 QA 수동 체크리스트로 검증한다.

- **`fanDirections`:** count 클램프(0·음수·NaN·Infinity → 1), count=1=aim, 홀수 중앙=aim, 짝수 대칭(중앙 없음), 총각 양끝이 `±총각/2`, 단위벡터 보존(입력 단위 → 출력 단위).
- **`radialDirections`:** count=1=aim, 360 등간격에서 끝점 중복 없음, 균등 간격, 단위벡터 보존.
- **`directionalPlan` 회귀:** `SpellPatternEngine.test.ts` 기존 케이스가 추출 후 전부 GREEN(전체 스위트로 확인).
- **F20 데이터 불변식:** kite 이동 + `attack` 보유 적 전부가 `preferredRange + 40 ≤ attack.range`를 만족하는지 단언(실 `enemies.json` 또는 픽스처 로드). 구미호·이무기·물귀신 대상.

RED 게이트: 위 테스트를 먼저 작성해 실패를 확인한 뒤 구현한다(`pnpm wf ready-impl`).

## 6. 경량 인라인 리뷰 (eng 체크리스트)

- **아키텍처:** 중립 모듈로 각도 수학을 모아 마법/적 상호 import를 피한다. `directionalPlan`은 조립 책임만 남아 결합도가 오히려 내려간다. ASCII로 보면 `FireGeometry`(순수) ← `SpellPatternLogic`(마법 조립) / `EnemyController`(적 발사 글루) 두 소비자가 같은 헬퍼를 가리키는 구조다.
- **엣지케이스:** count 클램프·끝점 중복·단위벡터 보존·aim 영벡터(호출자 FSM이 `dist>0`에서만 방향을 잠그므로 헬퍼는 단위 aim 가정 — `directionalPlan`과 동일 계약)을 테스트로 덮는다.
- **회귀 리스크:** 추출이 부동소수 결과를 바꾸지 않는다(동일 공식·동일 루프 순서). `SpellPatternEngine.test.ts`가 안전망.
- **다중 피해:** player-iframe(틱당 max)이 한 볼리 다발을 한 틱 1회로 묶어 부채꼴·확산이 틱당 피해를 곱하지 않는다. 볼리당 dedup 불필요.
- **성능:** 발사당 N발(≤~8)·발사는 쿨다운(≥1s)으로 드묾 → 프레임 비용 무시 가능. 핫패스 아님.
- **보안:** 순수 수학 + 데이터. 입력/네트워크/인증 표면 없음 — 해당 없음.
- **F19 재확인:** 이무기·물귀신은 `movement: "kite"` + `attack`이고 kite는 `_windupActive`를 안 건드린다 → 겸용 충돌 미발현 유지.

## 7. 작업 순서(예정)

1. QA 문서 `docs/qa/enemy-multishot-test.md` 작성(프리팹/씬·에디터 섹션은 잠정 태그) + `EnemyMultishot.test.ts` RED.
2. `pnpm wf ready-impl`(RED 게이트) → 구현.
3. `FireGeometry.ts` 신설 → `directionalPlan` 리팩터(회귀 GREEN 확인) → `EnemyController` 배선 → 데이터 추가 → F20 테스트·주석 정리.
4. `pnpm wf start-verification`(전체 GREEN) → `/cso` → ts → lint → 커밋 → 코드 리뷰.
5. QA 문서 프리팹/에디터 섹션을 실제 구현 기준으로 확정.

## 8. 닫는 백로그 — 처리 후 이동

구현 완료 후 `docs/development/backlog.md`의 **F20**을 「승격됨/완료」로 옮기고 이 슬라이스로 역링크한다.
