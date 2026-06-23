# 코드 리뷰 이슈 — frost-nova

> **브랜치:** feat/frost-nova
> **리뷰 커밋:** d8fa66f (BASE 03acab3)
> **리뷰 방식:** superpowers:requesting-code-review 패턴 — general-purpose 서브에이전트 dispatch
> **결과:** Critical 0 · Important 0 · Minor 3. 실제 버그·타입 문제 없음. 아래 Minor는 전부 의도된 트레이드오프이거나 선택적 후속이라 이번 슬라이스에서 수정하지 않고 백로그로 이월한다.

---

## Minor (이월 — 수정 안 함)

### M-1. 그리드 질의 → 타겟 수집 루프 중복 (SpellCaster ↔ Projectile)
- **위치:** `components/SpellCaster.ts` `_castNova` (그리드 질의 → `ExplosionTarget[]` + `EnemyController[]` 병렬 수집) ↔ `components/Projectile.ts` `_detonate` 동일 블록.
- **지적:** 두 곳이 사실상 같은 루프라 `ExplosionTarget` 필드가 바뀌면 두 군데를 고쳐야 한다(드리프트 위험). `collectExplosionTargets(cx, cy, r) → { targets, ctrls }` 같은 공유 헬퍼로 추출 가능.
- **판단:** **이월.** 계획 §4가 디스패치 옵션 B(별도 버스트 경로, 최소 변경)를 의도하면서 받아들인 트레이드오프다. 현재 중복은 2곳뿐이고, 두 번째 비발사체 패턴(S5 낙하·S8 빔)이 들어올 때 §12.1 출력 일반화와 함께 해소하는 게 합리적. → 백로그.

### M-2. 단위 테스트가 실 spells.json이 아닌 픽스처 사용
- **위치:** `tests/logic/FrostNova.test.ts`의 `frostNova()` 픽스처는 데이터를 손으로 복제 — 실 `spells.json`의 `frost_nova`와 드리프트(오타·필드 누락)가 나도 카드 적격 계약 테스트가 못 잡는다(i18n 키만 실데이터 가드 대상).
- **판단:** **이월.** 필드 정합은 Cocos 런타임 + 수동 QA에 맡기는 기존 프로젝트 패턴과 동일. 실데이터 스키마 검증은 백로그 D2(DataManager 스키마 검증)의 범위 — 거기로 집약. (값싼 보강: spells.json을 로드해 frost_nova의 pattern/allowsProjectileCount/explosionRadius를 단언하는 sanity 테스트.)

### M-3. nova 단독 로드아웃에서도 `_findNearestEnemy` 매 프레임 실행
- **위치:** `components/SpellCaster.ts` `update` — 자기중심 마법만 보유해도 최근접 적 선형 스캔이 돌고 그 결과(`aim`)는 미사용.
- **판단:** **이월(저우선).** O(n) 스캔이고 플레이어는 보통 발사체 마법을 함께 보유. 제어 흐름 복잡화 대비 이득 미미. 대량 적 성능(G1)에서 최근접 질의를 그리드로 옮길 때 자연 해소.

---

## 리뷰 총평

> "Ready to merge? **Yes** (Minor는 선택적 후속, blocker 아님). 구현이 기존 폭발 경로를 충실히 미러링하고, update() 재구조화가 발사체 쿨다운·발사보류 동작을 정확히 보존하면서 적 무관 노바 발동을 가능케 함. 236 테스트 통과, 디스패치 계약·카드 적격 매트릭스 순수 로직 커버리지 적절."
