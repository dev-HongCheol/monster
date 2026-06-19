# 코드 리뷰 이슈 — S1 공간 그리드 코어

- **브랜치:** feat/spatial-grid
- **리뷰 커밋:** 60110803 (BASE 92a151de)
- **리뷰 방식:** superpowers:requesting-code-review 패턴, general-purpose 서브에이전트 1인(Codex 미설치 환경 — 단독 독립 리뷰)
- **판정:** With fixes (minor — 머지 차단 이슈 없음). Critical 0건.

리뷰어가 parity 마진을 실제 적 속도 데이터(`enemies.json` 최대 280px/s)로 검증해 명중 누락 위험이 없음을 확인했고, 동시 수정 안전성(`queryRadius`가 매 호출 새 배열 반환 → 기존 `[...enemies]` 스냅샷 대체)과 폭발 dedup parity 보존도 확인했다.

---

## 처리한 이슈

| # | 심각도 | 내용 | 처리 |
|---|--------|------|------|
| 1 | Important | parity 핵심 마진 로직(`reach + maxEnemyRadius + slack`)이 cc 결합 `GameManager`에만 있어 자동 테스트 공백 — 테스트 피라미드 역전(쉬운 격자는 테스트, 미묘한 마진은 수동 QA만) | **수정됨** — 마진을 순수 함수 `enemyQueryRadius()` + 상수 `ENEMY_QUERY_SLACK`로 `SpatialGrid.ts`에 추출. `GameManager`는 이를 import해 사용. 테스트 T9 추가: 적별 충돌 반경을 다양화한 무작위 상황에서 그리드 광역 후보가 전수 비교 정밀 명중을 **빠짐없이 포함**(누락 0)함을 프로덕션과 동일한 마진 공식으로 검증. |
| 2 | Minor | z축 차원 무언의 변경 — 기존 `Vec3.distance`(3D) → 제곱거리(2D). 게임은 z=0 평면이라 동작 동일하나 미문서화 | **수정됨** — `Projectile._checkEnemyHit`에 2D 평면 가정 주석 추가. (`EnemyController._checkContactDamage`는 여전히 3D `Vec3.distance` 사용 — 정합성 정리는 별도, 동작 무영향) |
| 3 | Minor | staleness가 실제로는 "한 프레임"이 아니라 호출 순서에 따라 **최대 약 2프레임** | **수정됨** — 계획 문서와 `GameManager.queryEnemiesInRadius` JSDoc 문구를 "최대 약 2프레임"으로 정정하고 슬랙이 그 이동분(≤18.6px@30fps)을 덮음을 명시. |

## 백로그로 이월한 지적 (이 슬라이스 비스코프)

| # | 심각도 | 내용 | 이월 |
|---|--------|------|------|
| 4 | Minor | 그리드가 프레임마다 신규 할당 재도입(엔트리 객체·버킷 배열·셀 키 문자열·결과 배열) — 이 슬라이스가 지목한 GC 압박과 일부 상충 | **백로그 G1/S2(할당 위생)** 에 구체 출처로 기록 |
| 5 | Minor | `SpellCaster._findNearestEnemy`는 여전히 all-pairs(시전당 전역 최근접). 핫패스 아님(프레임당 발사체 루프 아님)이라 정당한 비스코프지만 미래 그리드 소비처 | **백로그 G1** 에 미래 그리드 소비처로 기록(그리드 최근접은 확장-링 탐색 필요) |

> 4·5는 동작 무영향이며 의도된 비스코프다. 출처: 2026-06-17 코드 리뷰.
