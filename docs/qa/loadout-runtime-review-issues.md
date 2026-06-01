# 코드 리뷰 이슈: loadout-runtime

> **최신 리뷰 커밋:** 3d38987 (색 틴트 리워크) · 초기 리뷰 8d27aed
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

---

## 재리뷰 (커밋 3d38987 — 분류 색 틴트 리워크)

> **결과:** CRITICAL/MUST-FIX **없음**. "ship it."

- **검증 통과:** Sprite null 가드가 `Projectile.init` 앞에 위치해 발사/틴트 분리 정상(Sprite 없어도 발사 안 막힘), RGB 0~255 유효(alpha 기본 255), 순수/cc 분리 유지(`SpellVisual.ts` cc import 없음), 튜플 타이핑·구조분해 정상.
- **`category: string` 시그니처(분류 enum 대신):** 의도된 선택 — `default` 분기로 미매핑('support'/'unknown') 흰색 처리 가능. enum으로 좁히면 fallback 테스트가 막혀 과제약. 현행 적절.
- **테스트 적정:** 분류 distinctness·기본값·범위 커버. 정확한 hue 단정은 밸런싱성 값이라 일부러 미단정(브리틀 방지) — 적절.
- **NIT(미조치):** `_shoot`마다 `new Color` 할당 — 6슬롯·저빈도라 무시 가능. 현행 유지.
