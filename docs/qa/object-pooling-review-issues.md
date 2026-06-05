# 코드 리뷰 이슈: object-pooling (발사체)

> - **리뷰 커밋:** 38580f2..b02a787 (BASE..HEAD)
> - **리뷰 방식:** superpowers:requesting-code-review (general-purpose subagent)
> - **결과:** Critical 0 / Important 3(전부 미래 재사용·QA 추적용, 이 슬라이스 버그 아님) / Minor 3 → **머지 가능(코드 1곳만 선반영)**

---

## Critical
없음. 풀링 라이프사이클(이중반환 3중 방어·카운터 회계·재사용 상태 리셋)은 발사체 용도에서 정확.

## Important

### I-1. PoolManager.acquire가 재사용 노드를 재부착하지 않음 — 암묵적 불변식 — **수정됨**
- **위치:** `components/PoolManager.ts` `acquire`/`release`
- **내용:** `addChild`는 최초 생성 경로에서만 실행. 재사용 시 노드가 여전히 `_parent`의 자식이라는 전제(현재 `release`가 `active=false`만 하므로 성립)에 의존. 재사용 인프라(적·XP 슬라이스)에서 누군가 풀 노드를 분리하면 재사용 노드가 조용히 미부착될 footgun.
- **조치:** `acquire`에 방어적 재부착(`node.parent !== _parent`면 `addChild`) 추가 + `release` JSDoc에 "반환 노드는 `parent`의 자식으로 유지된다" 불변식 명시. → **수정됨** (커밋 `20ae7eb`).
- **재리뷰(`b02a787..20ae7eb`):** I-1 해결 확인. 가드는 모든 도달 경로에서 정상(최초 생성=동일 부모 → 스킵, 정상 재사용=동일 부모 → 스킵, 분리 후 재사용=재부착). active=true 이전에 재부착하는 순서도 정상. 신규 Critical/Important 0, 판정 **Ready to merge — Yes**.

### I-2. 씬 재시작 시 풀 미정리 — **비이슈(현 구조), 문서화**
- **위치:** `components/SpellCaster.ts` (`_bulletPool` onLoad 생성, teardown 없음)
- **확인:** 게임 재시작은 `GameManager.restart()` → `director.loadScene('main')`(GameManager.ts:133)로 **씬 리로드**다. 노드 트리 전체가 폐기되므로 옛 SpellCaster와 `_bulletPool`(노드 참조 포함)이 GC되고, 새 `onLoad`가 새 풀을 만든다. **in-place 재시작은 코드베이스에 없음** → 누수·잔류 없음.
- **조치:** 수정 불필요. **단, 향후 in-place 리셋이 도입되면** `PoolManager.clear()`가 필요하므로 후속 과제로 남김. QA §5 장시간 플레이 + 재시작(메뉴→재플레이) 1회를 수동 확인.

### I-3. PoolManager.release 폐기 경로(cap 초과 → destroy) 테스트 공백 — **이월(적·XP 슬라이스)**
- **위치:** `tests/logic/ObjectPooling.test.ts` (순수 로직만 커버), `PoolManager`(cc 의존)
- **내용:** `true→active=false` / `false→destroy` 매핑이 무테스트. 단 `SpellCaster`는 `maxFree` 미지정(무제한)이라 **이 슬라이스에선 폐기 경로가 dead code**.
- **조치:** cc 의존 + 미사용이라 이월. **적·XP 슬라이스에서 `PoolManager` 테스트**(Node 스텁으로 active/destroy 토글 검증) 추가. 계획 §7 후속 항목에 반영.

## Minor

### M-1. `ObjectPoolLogic.release`의 `_free.includes()` O(n) — **유지**
- 발사체 idle 수(수십~저수백)에선 무시 가능. `Set` 도입은 복잡도·할당 증가라 의도적으로 배열 유지. 풀이 수천 단위를 들면 재검토.

### M-2. `spellCategoryColor`가 매 발사 `new Color` 할당 — **범위 밖(기존), 언급만**
- `SpellCaster.ts:153`. 이 슬라이스가 줄이려는 hot path에 있으나 풀링 이전부터 존재. 분류별 Color 캐시로 churn을 마저 줄일 수 있음 → 후속 폴리시/최적화 후보(이번 회귀 아님).

### M-3. `_outOfBoundsLimit`를 onLoad 1회 계산 후 재사용 — **유지**
- 뷰 크기 불변 전제(계획 명시). 런타임 해상도 변경 시 미갱신이나 이 게임에선 허용, 기존 동작과 동일.

---

## 조치 요약
- **코드 수정:** I-1 1곳(PoolManager 방어적 재부착 + 불변식 JSDoc). → 수정 후 `wf invalidate` → cso부터 재검증.
- **문서화/이월:** I-2(비이슈, QA 재시작 확인), I-3(적·XP 슬라이스 PoolManager 테스트), M-2(후속 최적화).
