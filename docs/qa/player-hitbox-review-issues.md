# player-hitbox — 코드 리뷰 이슈

- **리뷰 커밋:** `b1c7b84` (BASE `5b6e1b9` = origin/main)
- **리뷰:** `general-purpose` 서브에이전트 (superpowers:requesting-code-review 패턴), 2026-07-23
- **판정:** **Ready to merge: Yes** — Critical 0 / Important 0 / Minor 3 (전부 선택·정확성 무영향)

## 강점 (리뷰어 검증)

- **불변식이 코드에서 실제로 지켜짐:** 이동은 원 유지(`PlayerController._move`·`resolveCircleMove`·아레나 클램프 무변경), 적 핫패스 무변경(`Projectile._checkEnemyHit`·`SpatialGrid`·`ExplosionLogic`가 여전히 `enemy.collisionRadius`), 어떤 적도 박스가 되지 않음.
- **경계 규약 `< r²`가 `resolveCircleMove`의 rect 침투식(`d2 >= r2` continue)과 문자 그대로 동형** — JSDoc의 "동형" 주장이 실제로 성립.
- `_playerCollisionRadius` 잔존 참조 0, `Vec3` 여전히 사용(미사용 import 아님), 신규 `.meta` 0, 필수 필드 추가가 타입 안전(리터럴 생성처 없음).
- 테스트 8케이스가 동기 실패모드(머리높이 명중·좌우 그레이즈·코너 경계)를 실제로 검증.

## Minor (선택 — 정확성 무영향)

1. **퇴화(반너비/반높이 0) 경로 테스트 없음.** 데이터 누락 시 `?? 0`으로 박스가 점으로 퇴화한다. **기존 코드(`reach = enemyR + 0`)와 동일 동작이라 회귀가 아니다** — 발사체/적 원이 자기 반지름 안에 플레이어 중심을 담으면 여전히 명중. 1줄 테스트로 퇴화 계약을 못박을 수 있다. → **미수정(선택 후속).** 리뷰어도 "otherwise ship as-is". 정확성 영향이 없고, 이번엔 이 항목만을 위한 전체 재검증 사이클이 과하다.
2. **clamp 수식이 `HitboxLogic`과 `ObstacleLogic.resolveCircleMove`(rect 분기)에 중복.** `resolveCircleMove`는 겹침 여부(bool)가 아니라 밀어내기 벡터가 필요해 공유 헬퍼가 어색하다. 양방향 상호참조 주석이 이미 있어 "복사본은 함께 고친다"의 추적성은 확보. → **미수정(리뷰어도 "leaving as-is is defensible").**
3. **`circleIntersectsBox`에 NaN/유한성 가드 없음.** 입력이 `node.position`(항상 유한) + 저작 데이터라 실질 영향이 없다. → **미수정(리뷰어 "not worth adding").**

## 결론

Critical·Important·실제 버그·타입 안전성 이슈 **0**. Minor 3건은 전부 선택 사항이며 정확성에 영향이 없어 이번 슬라이스에서 미수정한다(사유는 각 항목). `pass review`로 진행.
