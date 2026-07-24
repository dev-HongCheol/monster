# player-4dir — 코드 리뷰 이슈

- **브랜치:** feat/player-4dir
- **리뷰 커밋:** BASE `0c42c2c` → HEAD `142b5a3` (superpowers:requesting-code-review, general-purpose subagent, 2026-07-25)
- **정본:** [계획](../development/sessions/2026-07-24-player-4dir-plan.md), [QA](player-4dir-test.md)

## 판정

**머지 가능(minor 1건 수정 조건).** Critical 0 · Important 0 · Minor 2.

리뷰어가 독립 검증한 것: 피처 테스트 10/10 + 전체 605/605 통과, `tsconfig.tests.json` 타입체크 exit 0, `FacingLogic.ts`에 `cc` import 없음(ADR 002 준수), 범위 내 `.meta` 0개. facing이 변위가 아니라 입력 의도에서 나오는 것, 프레임 교체가 방향 변화 프레임에만 일어나는 것, 대각선 동률 `>=` 경계, `_frameFor` switch의 컴파일타임 소진성(strict union narrowing), 피해 박스 30→44가 두 소비처(`EnemyController`·`EnemyProjectile`)의 가정을 깨지 않는 것까지 코드로 확인.

## 이슈

### Minor 1 — `PlayerHitbox.test.ts:17` 주석이 낡음 → **수정됨(2026-07-25)**

주석이 `player.json`을 `36×60 → 반높이 30`으로 적어 뒀는데, 이번 슬라이스가 그 값을 44로 바꿔 주석이 어긋났다. CLAUDE.md의 "같은 설명이 코드·테스트·문서에 복사돼 있으면 함께 고친다" 규칙에 걸린다. **`PH=30` 상수는 기하 검증 픽스처(경계 기대값이 30 기준으로 계산됨)라 바꾸지 않고**, 주석만 "이 값은 고정 픽스처이며 player.json 라이브 값이 아니다(실제는 18/44)"로 고쳤다. 영향 없음(주석 전용), 해당 테스트 재실행 통과 확인.

### Minor 2 — 미연결 슬롯 가드가 조용한 실패 하나를 다른 것으로 바꿈 → **의도된 트레이드오프(수정 안 함)**

`_applyFacingFrame`이 프레임 null이면 대입을 건너뛰어 직전 그림을 유지한다. 리뷰어도 "결함이 아니라 트레이드오프 확인용"이라 명시했다. null 대입이 캐릭터를 투명하게 만드는 것보다 stale 프레임 유지가 덜 오해되는 실패이고, 이름별 슬롯 + QA 체크리스트 5번(네 방향 각각 확인)이 미연결을 이미 잡는다. 의도가 "stale 프레임 > 투명" 맞으므로 유지.

## Recommendation (다음 슬라이스로)

리뷰어 메모: `hurtboxHalfWidth`는 18로 유지돼 박스 **폭** 커버리지가 브릿지 72%(50px 폭)에서 50%(72px 폭)로 내려갔다. QA 문서가 이를 의도적으로 다뤘으나(몸통 코어·팔 포함 53%), **최종 아트 재튜닝 시 반높이만이 아니라 반너비도 실제 실루엣에서 다시 뽑을 것**. F62에 반영.
