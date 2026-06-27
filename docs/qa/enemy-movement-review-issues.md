# 적 이동 S1 — 코드 리뷰 이슈

- **브랜치:** feat/enemy-movement
- **리뷰 커밋:** `23b16cf` (재리뷰; 최초 `8b036a7`)
- **리뷰 방식:** 인라인(토큰 절약 — 사용자 요청). 순수 로직은 `EnemyMovement.test.ts` 21개로 덮였고, 단위 테스트가 없는 `EnemyController` 글루를 정밀 검토했다. 설계 단계(autoplan) 독립 리뷰의 16개 발견은 구현에 모두 반영됨(계획 §10 감사 추적 참조).

## 검토 범위·결과

`EnemyController`의 신규 메서드(`_move`/`_moveZigzag`/`_moveLunge`/`_lungeParams`/`_updateLungeTelegraph`/`_updateTint`/`_applyTintBlend`)와 `update` 흐름을 검토했다.

- **update 순서 정확:** `_move`가 돌진 텔레그래프 상태(`_windupActive`·`_windupBlendVal`)를 설정한 뒤 `_updateTint`가 읽는다.
- **정지(CC) 동결 정확:** `canAct=false`면 `tickLunge`가 상태·타이머를 동결하고 `speedFactor=0`으로 이동도 0이며 텔레그래프는 유지된다 → 헛돌진 방지 동작.
- **틴트 우선순위·복원 래치 정확:** 사망>플래시>텔레그래프>CC>기본. 텔레그래프→CC 전이, 윈드업 종료 시 baseTint/CC 복원 모두 처리.
- **마커:** 부모 `threatScale` 상쇄(`lungeReach/(MARKER_BASE_WIDTH×baseScale)`), 사망 시 비활성(`_startDeath`), `reset` 초기화 반영. `@property` 미연결 시 null 가드.
- **회귀 없음:** chase 적은 `_followPlayer`(원본) 그대로 폴백.

## 이슈

### #1 (낮음·비차단) — 돌진 Chase/Cooldown 이동에 겹침 가드 없음

`_moveLunge`의 Chase·Cooldown 이동은 `lungeMovement`가 `normalize(toPlayer)`를 반환하는데, 기존 `_followPlayer`에 있는 `dir.lengthSqr() < 1`(1px 이내 정지) 가드가 없다. 플레이어와 거의 정확히 겹칠 때 방향이 매 프레임 뒤집혀 ~1.6px(속도 100·60fps 기준) 서브픽셀 진동이 가능하다.

- **실질 영향:** 미미·코스메틱. 적은 `lungeRange`(200px)에서 Windup으로 멈추고, Cooldown(1.5s) 중 플레이어와 정확히 겹쳐 추격하는 상황은 드물다. 접촉 피해는 이동과 무관하게 적용된다.
- **수정 방향:** `lungeMovement`의 Chase/Cooldown 분기 또는 컨트롤러 이동부에 `lengthSqr < 1` 가드를 넣어 `_followPlayer`와 일치시킨다(순수 함수 테스트 1건 추가 동반).
- **결정:** 전체 검증(cso 포함) 재초기화 비용 대비 가치가 낮아 **백로그로 이월**한다(`docs/development/backlog.md` F17). 차단하지 않는다.

## 종합

구현이 리뷰된 계획(§4 아키텍처)과 일치하고, 순수 로직은 전수 테스트로 덮였다. 차단 이슈 없음 → `pass review`.

## 재리뷰 (리워크 후 — 커밋 `29cc0f9`·`23b16cf`)

리워크로 implementation 복귀 후 변경분은 **데이터·문서뿐이며 `.ts` 소스는 0줄 변경**(직전 통과본 `8b036a7`과 동일)이라, 신규 코드 검토 표면이 없어 증분만 인라인 검토했다.

- **enemies.json — `zigzagAmplitude` 0.6→1.1:** 밸런스 수치. `zigzagDirection`이 결과를 `normalize`하므로 amplitude>1도 안전(전진 대비 수직 가중만 커져 지그재그가 날카로워짐). `zigzagPeriod`(0.8) 불변. 데이터 sanity 테스트 `>0` 통과.
- **debug-enhancements.json — fire `range` 키 오타 복구 + 시드값 0:** 깨진 키 `lungeMarkerrange`→`range` 복구. `DebugEnhancementSeed.test.ts` 7개 GREEN으로 스키마 검증됨. 디버그 전용 데이터라 인게임 영향 없음.

차단 이슈 없음 → `pass review`. (전체 스위트 298/298, 통과 커밋 `23b16cf`.)
