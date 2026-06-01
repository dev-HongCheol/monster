# 코드 리뷰 이슈: loadout-runtime

> **리뷰 커밋:** 8d27aed359a5210272feee6d8b70b6fbb4780ec8 (base 4d96a8a)
> **리뷰 방식:** general-purpose 서브에이전트 (superpowers:requesting-code-review 패턴)
> **결과:** CRITICAL/MUST-FIX **없음**. 스케줄러 의미·단일 마법 회귀·코드 이동·타입/null·Cocos 라이프사이클 모두 검증 통과. 선택/설계 노트만 존재.

---

## 검증 통과 (must-fix 없음)

- **단일 마법 회귀:** `FireSchedulerLogic`가 기존 `_attackTimer` 흐름을 그대로 재현 — 신규 마법 0 시드(즉시 발사), tick 후 타깃 확인, 타깃 없으면 consume 안 함(쿨다운 미소모). base 커밋 대비 동등 확인.
- **stale-id 정리:** `tick`이 `activeIds`에 없는 타이머 삭제 → 재추가 시 즉시 발사. 테스트 일치.
- **타이머 독립성:** id별 Map, 교차 오염 없음.
- **이동 코드 무손실:** `_findNearestEnemy`/`_shoot`는 PlayerController에서 그대로 이관, 잔여 dead code·미사용 import 없음.
- **타입/null:** `getSpell` null 가드됨, `@property` 기본값 적절, JSON `category`/`tier` enum·타입 일치.
- **라이프사이클:** `start()`에서 `DataManager.onReady` 디퍼(ready/pending 모두 처리), `update` 게이팅 정상. 입력 리스너 없으므로 `onDestroy` 불필요(정상 생략).
- **테스트 커버리지:** 스케줄러 전 분기 커버.

---

## 선택 사항 (미조치 — 코드 변경 없음)

1. **`startingSpellIds` 시드 실패 시 무알림 (nit, optional).** `addSpell`이 6슬롯 초과/중복을 조용히 드롭. 시드는 개발자(에디터)가 통제하므로 이번 슬라이스에선 허용. 에디터 오설정 조기 감지용 `console.warn`은 향후 카드 연동 슬라이스에서 함께 검토.
2. **`tick`의 `[...keys()]` 매 프레임 할당 (nit).** 6슬롯 규모라 무시 가능. 현행 유지.

## 설계/기존 노트 (정책 — 수정은 사용자 요청 시)

- **씬에 구 PlayerController 바인딩 잔존:** `main.scene`의 `bulletPrefab`/`activeSpellId`는 에디터가 드롭할 orphan. `SpellCaster`로의 이전은 QA 문서 § 3에 수동 작업으로 명시됨. 코드 이슈 아님.
- **`projectileCount` 추가되었으나 미사용:** 패턴 슬라이스용으로 의도된 것. 정상.
- **전역 강화 마법별 곱적용:** `cooldownMult`/`damageMult`를 모든 마법에 곱 — 플랜 § 1.4 의도대로.
