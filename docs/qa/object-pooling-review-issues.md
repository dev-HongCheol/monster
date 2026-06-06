# 코드 리뷰 이슈: object-pooling (발사체)

> - **리뷰 커밋:** 38580f2..b02a787 (BASE..HEAD)
> - **리뷰 방식:** superpowers:requesting-code-review (general-purpose subagent)
> - **결과:** Critical 0 / Important 3(모두 향후 재사용·QA 추적용이며 이 슬라이스의 버그는 아님) / Minor 3 → **머지 가능(코드는 1곳만 선반영)**

---

## Critical
없음. 풀링 생애주기(이중 반환 3중 방어·카운터 회계·재사용 시 상태 리셋)는 발사체 용도에서 정확하게 동작한다.

## Important

### I-1. PoolManager.acquire가 재사용 노드를 재부착하지 않음 — 암묵적 불변식 — **수정됨**
- **위치:** `components/PoolManager.ts` `acquire`/`release`
- **내용:** `addChild`가 최초 생성 경로에서만 실행된다. 재사용 시에는 노드가 여전히 `_parent`의 자식이라는 전제에 의존하는데(현재 `release`가 `active=false`만 하므로 성립한다), 향후 재사용 인프라(적·XP 슬라이스)에서 누군가 풀 노드를 분리하면 재사용 노드가 부모에 붙지 않은 채 조용히 빠질 위험이 있다.
- **조치:** `acquire`에 방어적 재부착(`node.parent !== _parent`이면 `addChild`)을 추가하고, `release` JSDoc에 "반환된 노드는 `parent`의 자식으로 유지된다"는 불변식을 명시했다. → **수정됨**(커밋 `20ae7eb`).
- **재리뷰(`b02a787..20ae7eb`):** I-1 해결을 확인했다. 가드는 모든 도달 경로에서 정상 동작한다(최초 생성=같은 부모 → 건너뜀, 정상 재사용=같은 부모 → 건너뜀, 분리 후 재사용=재부착). `active=true`보다 재부착을 먼저 하는 순서도 정상이다. 신규 Critical/Important 0건, 판정 **Ready to merge — Yes**.

### I-2. 씬 재시작 시 풀 미정리 — **비이슈(현 구조), 문서화**
- **위치:** `components/SpellCaster.ts` (`_bulletPool` onLoad 생성, teardown 없음)
- **확인:** 게임 재시작은 `GameManager.restart()` → `director.loadScene('main')`(GameManager.ts:133)로 이뤄지는 **씬 리로드**다. 노드 트리 전체가 폐기되므로 기존 SpellCaster와 `_bulletPool`(노드 참조 포함)이 GC되고, 새 `onLoad`가 새 풀을 만든다. **씬을 리로드하지 않는 제자리(in-place) 재시작은 코드베이스에 없으므로** 누수나 잔류가 없다.
- **조치:** 수정이 필요 없다. **다만 향후 제자리 리셋이 도입되면** `PoolManager.clear()`가 필요하므로 후속 과제로 남긴다. QA §5의 장시간 플레이와 재시작(메뉴→재플레이) 1회를 수동으로 확인한다.

### I-3. PoolManager.release 폐기 경로(cap 초과 → destroy) 테스트 공백 — **이월(적·XP 슬라이스)**
- **위치:** `tests/logic/ObjectPooling.test.ts` (순수 로직만 커버), `PoolManager`(cc 의존)
- **내용:** `true→active=false` / `false→destroy` 매핑에 테스트가 없다. 다만 `SpellCaster`는 `maxFree`를 지정하지 않아(무제한) **이 슬라이스에서는 폐기 경로가 실행되지 않는 코드(dead code)다.**
- **조치:** cc에 의존하고 현재 미사용이라 이월한다. **적·XP 슬라이스에서 `PoolManager` 테스트**(Node 스텁으로 active/destroy 토글 검증)를 추가한다. 계획 §7 후속 항목에 반영했다.

## Minor

### M-1. `ObjectPoolLogic.release`의 `_free.includes()`가 O(n) — **유지**
- 발사체의 idle 수(수십~수백)에서는 무시할 만하다. `Set` 도입은 복잡도와 할당을 늘리므로 의도적으로 배열을 유지한다. 풀이 수천 단위를 다루게 되면 다시 검토한다.

### M-2. `spellCategoryColor`가 발사할 때마다 `new Color`를 할당 — **범위 밖(기존), 언급만**
- `SpellCaster.ts:153`. 이 슬라이스가 줄이려는 hot path에 있으나 풀링 이전부터 존재했다. 분류별 Color 캐시로 생성·삭제를 더 줄일 수 있다 → 후속 폴리시/최적화 후보다(이번 회귀는 아니다).

### M-3. `_outOfBoundsLimit`를 onLoad에서 한 번 계산한 뒤 재사용 — **유지**
- 뷰 크기가 변하지 않는다는 전제다(계획에 명시). 런타임에 해상도가 바뀌면 갱신되지 않지만 이 게임에서는 허용되며, 기존 동작과 동일하다.

---

## 조치 요약
- **코드 수정:** I-1 1곳(PoolManager 방어적 재부착 + 불변식 JSDoc). → 수정 후 `wf invalidate`로 cso부터 재검증했다.
- **문서화/이월:** I-2(비이슈, QA 재시작 확인), I-3(적·XP 슬라이스 PoolManager 테스트), M-2(후속 최적화).
