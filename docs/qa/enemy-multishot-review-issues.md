# 적 로스터 S2b (enemy-multishot) 코드 리뷰 이슈

- **리뷰 커밋:** 65131b0 (BASE `origin/main` 498044e)
- **리뷰어:** general-purpose 서브에이전트 (`superpowers:requesting-code-review` 패턴)
- **평결:** **Ready to merge — Yes** · Critical 0 · Important 0 · Minor 5

## Critical / Important

없음. 빌드·타입·전체 스위트(344/344) 통과, 기능 깨짐·데이터 손상 없음. 리팩터가 마법 동작을 바이트 동일로 보존(`SpellPatternEngine` 12/12 회귀 GREEN), 공격 FSM·풀·`EnemyProjectile` 무변경 확인.

## Minor

모두 현재 데이터·소비자에서 **미발현**인 footgun 방어 또는 문서 정합이다. 리뷰어가 "후속 가능"으로 명시했고, 스크립트 수정 시 `invalidate`로 cso·코드리뷰 전체 재사이클 비용이 과해(미발현 한 줄짜리), 로버스트니스 항목은 백로그로 집약한다(CLAUDE.md 로버스트니스→backlog 규칙).

### M1 — `radialDirections` 부분 확산(spread<360) 비대칭 — 백로그 이관(F21)
`FireGeometry.ts:73`(`offsetDeg = i*spread/n`). 분포가 aim에서 한쪽(CCW)으로만 깔려, `spread<360`이면 aim이 호의 **중심이 아니라 가장자리**가 된다. `spread=360`(유일 소비자 물귀신)은 완전 등분이라 무해. 부분 호 소비자가 생기면 발현 → JSDoc 경고 또는 중심 분포 변형 필요. → **백로그 F21**.

### M2 — 부채꼴 기본각 `?? 0` 스택 footgun — 백로그 이관(F22)
`EnemyController.ts:558`. `projectile_fan`인데 데이터에 `spreadAngleDeg`가 빠지면 N발이 전부 offset 0으로 겹쳐 발사(부채꼴이 단발처럼). 마법은 `DEFAULT_SPREAD_ANGLE_DEG=10` 기본을 쓰는 것과 대비. 현 데이터는 항상 지정(이무기 34)이라 미발현. → **백로그 F22**.

### M3 — F20 테스트 `KITE_DEADZONE_BAND=40` 하드코딩 드리프트 — 백로그 이관(F23)
`EnemyMultishot.test.ts:150`. cc 의존 `EnemyController` 상수를 import 못 해 값을 복제(주석으로 동기화 경고). 그 상수는 순수 `MovementLogic.kiteDirection(band)`로 흘러가는 값이라, `MovementLogic.ts`(또는 순수 상수 모듈)로 올려 컨트롤러·테스트가 공유하면 드리프트가 원천 제거된다. 단순 미러링이라 현재는 안전. → **백로그 F23**.

### M4 — QA 문서 테스트 개수 오기 — ✅ 수정됨
`enemy-multishot-test.md`가 "피처 26/26"으로 적었으나 피처 파일은 **14개**(부채꼴 5 + 확산 6 + 데이터 2 + F20 1). 26은 피처 14 + 회귀 12의 합계 오귀속. "피처 14/14 + 회귀 12/12 + 전체 344/344"로 정정함.

### M5 — `xpDrop` 48/40 vs 메모리 70+ — 기록(의도된 밸런스 보류)
이무기 48·물귀신 40은 `feedback_default_xp_drop_70`과 어긋나나, 계획 §4가 "현 로스터 placeholder 스케일(18~35), 70+는 7단계/밸런스에서 사용자 확정"으로 명시 보류. 의도된 일탈 — 차단 사유 아님. 밸런스 단계에서 확정.

### Recommendation — `origin` 라이브 참조 재사용 계약
`EnemyController.ts:559`의 `const origin = this.node.position`는 노드 내부 벡터의 라이브 참조다. 현재 `_fireEnemyProjectile`가 `.x/.y`를 동기로 읽어 안전. 콜백 계약에 "origin은 즉시 소비·저장 금지" 주석을 못 박으면 장차 참조 보관 사고를 예방 — M2와 함께 F22에서 검토.
