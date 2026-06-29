# 적 발사체(S2a) 코드 리뷰 이슈

- **브랜치:** feat/enemy-projectile
- **리뷰 커밋:** `a59f11b` (BASE `origin/main` e964623 .. HEAD a59f11b)
- **리뷰 방식:** `superpowers:requesting-code-review` 패턴, general-purpose 서브에이전트 디스패치 (2026-06-28)
- **판정:** Ready to merge — **Yes** (Critical 0). 전체 330/330, lint 클린.

## 강점 (리뷰 요약)

- 검증된 `tickLunge` FSM와 동형 구조라 추론·리뷰가 쉬움.
- **친선사격 0이 구조적으로 보장**: `EnemyProjectile._checkPlayerHit`이 `_playerNode`만 읽고 적 목록을 절대 질의하지 않음(D1 의도 달성).
- 순수 로직·테스트의 엣지 커버리지 우수(겹침 NaN 가드·range≤0·텔레그래프 커밋·즉발·쿨다운 클램프·dt 오버슈트·canAct 동결).
- 풀 재사용 잔류 완전 처리(`reset()`이 공격 FSM·텔레그래프 상태 초기화).
- 데미지 게이트 계약 준수(D5 — per-projectile dedup 없음, 게이트에 제출만).
- 기하 정합: kite 정착 밴드 [280,360] ⊂ `attack.range` 420 → 정착한 구미호는 항상 발사 사거리 안.

## 이슈와 처리

### Important (1)

| # | 이슈 | 처리 |
|---|------|------|
| I-1 | **공유 `_windupActive` 클로버 — 미래 "돌진+발사 겸용 적"** (`EnemyController._updateAttackTelegraph` ↔ `_updateLungeTelegraph`가 같은 `_windupActive`/`_windupBlendVal`에 씀). `update()`에서 `_move`→`_tickEnemyAttack` 순이라, `movement:'lunge'` **AND** `attack` 블록을 동시에 가진 적이 생기면 공격 경로가 돌진 텔레그래프를 매 프레임 덮어 점멸을 조용히 억제. | **백로그 이관 (forward-compat, 현재 미발현).** 현존 적 중 돌진+발사 겸용 없음(kumiho=kite+발사, kite는 `_windupActive` 미접촉). 리뷰어도 "머지 차단 아님, 겸용 적 도입 전 후속". 로스터 S2b/S3에서 겸용 적이 실제로 생길 때 처리 → backlog **F19**. |

### Minor (4)

| # | 이슈 | 처리 |
|---|------|------|
| M-1 | `_fireProjectileFn` 죽은 null 가드 + 오해 소지 주석(실 미연결 케이스는 `EnemySpawner._fireEnemyProjectile`가 처리). | 백로그 **F20**(소소 정리). 무해한 방어 코드라 즉시 수정 안 함(수정 시 전체 재검증 불균형). |
| M-2 | **구미호가 텔레그래프 중에도 계속 kite 이동**(돌진은 윈드업에 정지하는 것과 대비). 조준은 진입 에지에 잠겨 기능상 무해하나 "멈칫" 텔레그래프 시맨틱과 가독성 차이 — **설계 판단**. | **설계 지적 → 기록 후 진행.** 7단계 인게임 테스트에서 체감 확인 후 사용자 판단(움직이며 점멸 vs 멈칫). 수정은 사용자 요청 시. |
| M-3 | 정지(stun) 중 텔레그래프면 노랑 정지 틴트 대신 빨강 유지(`_updateTint`가 `_windupActive` 우선). **기존 돌진과 동일 동작**이라 pre-existing·범위 밖. | 인지만(범위 밖). 필요 시 CC 틴트 우선순위 재논의는 별도. |
| M-4 | kite 정착-vs-사거리 불변식(`preferredRange + band ≤ range`)을 강제하는 테스트 없음 — 미래 적이 어기면 사거리 밖에 정착해 거의 안 쏨. | 백로그 **F20**(데이터 정합 테스트, D2 인접). |

## Recommendations (리뷰어)

1. 겸용 적 도입 전 lunge+attack 가드(`reset()` 경고/assert 또는 별도 `_attackWindupActive`) → F19.
2. `preferredRange + band ≤ range` 데이터 정합 테스트 → F20/D2.
3. 컴포넌트 배선(공격 FSM↔틴트↔풀 리셋)은 순수 테스트 불가 → QA 수동 체크리스트가 1발/시전·조준잠금 빗나감·재사용 적 무발사를 덮는지 확인(현 QA 문서 §5에 포함됨).
