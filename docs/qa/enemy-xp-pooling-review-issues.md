# 코드 리뷰 이슈: 객체 풀링 — 적·XP (enemy-xp-pooling)

> - **브랜치:** feat/enemy-xp-pooling
> - **리뷰 커밋:** `546b4a5` (base `538478e` = origin/main)
> - **리뷰 방식:** `superpowers:requesting-code-review` 패턴 — general-purpose subagent dispatch
> - **평결:** **Ready to merge — Yes.** Critical 0 · Important 0 · Minor 4(전부 선택적, 동작 무영향).

---

## 리뷰 요약

리뷰어가 풀링 특유의 위험을 코드 추적으로 모두 안전하게 확인:
- **생명주기 타이밍:** `acquire()`(→onEnable 동기 register, stale `_dead`/`_data` 잔류)와 `reset()`이 동기로 연속 실행되고 그 사이 update가 끼지 않음 → stale 1프레임 update 위험 없음. 최초 생성 경로(addChild→onLoad→onEnable→reset) 순서도 올바름.
- **등록 균형:** `_startDeath` unregister + 풀 반환 시 `onDisable` unregister 중복돼도 `GameManager.unregisterEnemy`의 indexOf 가드로 멱등. register는 onEnable false→true 전이당 1회 → 누수·조기 해제 없음.
- **stale 참조 타격:** `Projectile._checkEnemyHit`/`SpellCaster._findNearestEnemy`가 매 프레임 라이브 `GameManager.enemies`(+isValid) 조회 → 풀의 idle 노드는 표적에서 빠짐.
- **씬 리로드:** 풀 소유자가 씬마다 재생성되는 싱글톤 Component → 풀이 함께 폐기·재생성, stale 노드 참조 없음.
- **순환 import:** `EnemyController→ExperienceManager→XPItemController→(cc)` 단방향으로 끊김 확인.
- **시각 잔류:** 사망 페이드/팝/플래시 색 전부 `reset()→_applyVisualBaseline`로 복원.
- **이중 반환/흡수:** `_despawned`/`_absorbed` 가드가 모든 경로 차단, reset/init이 매번 리셋.

---

## Minor (선택적 — 수정하지 않음, 근거 기록)

| # | 위치 | 내용 | 처리 |
|---|------|------|------|
| M-1 | `EnemyController.reset` (EnemyController.ts) | `DataManager.instance` 비방어 접근(`onEnable`/`onDisable`은 `?.` 사용). | **조치 불필요** — reset JSDoc에 "데이터는 스폰 시점에 항상 로드 완료(EnemySpawner가 DataManager.isReady 게이트)" 전제가 이미 명시됨. 유일 호출부가 게이트를 보장. |
| M-2 | `EnemyController.reset` | `getEnemy(enemyId)` null이면 inert 적이 `maxEnemies` 카운트 영구 점유 가능. | **범위 밖** — director가 유효 id만 선택, **기존 동작과 동일(회귀 아님)**. 데이터 정합성 이슈로만 기록. |
| M-3 | `EnemySpawner` | 무제한 풀(`maxFree=0`) + 무상한 `maxEnemies`의 메모리 수렴점. | **범위 밖(계획 §7·§8)** — 한도는 밸런싱 단계 과제. 풀링은 기존 destroy 대비 피크에서 할당을 캡하므로 개선. |
| M-4 | `Projectile.ts:70` (diff 밖) | 주석 "takeDamage→destroy→unregisterEnemy"가 노후화(이제 적은 destroy가 아니라 연출 후 release). | **무관 이슈 — 언급만**(CLAUDE.md 규칙). 별도 정리 시 한 줄 갱신 권장. |

---

## 수동 QA 재확인 권장 (코드상 안전 확인됨, 인게임 최종 못박기)

- 장시간 처치 반복 후 재사용된 적의 종류별 HP/색/크기 잔류 없음.
- 피격 플래시 도중 사망→재사용 시 색 복귀.
- 재시작(씬 리로드) 후 적·XP 정상 스폰.

> 발사체 슬라이스에서 동일 onEnable 동기 발화 패턴이 이미 검증됨.
