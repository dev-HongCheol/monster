# Code Review Issues — xp-drop-per-enemy

**리뷰 커밋:** 18059366ba5853772237a3ed5f5e948afd0b8b31

---

## Important

### 1. `_dropXpItem()`의 `_data` null 가드 누락 → xpValue 0 아이템 무음 드롭
- 위치: `EnemyController.ts:66`
- `_data`가 null일 때 `?? 0`으로 xpValue 0 아이템이 스폰됨
- 수정: `_dropXpItem()` 진입부에 `if (!this._data) return` 가드 추가, `?? 0` 제거
- **수정됨** ✅

### 2. JSON 캐스팅 패턴으로 `xpDrop` 누락 시 런타임에 undefined 유입 가능
- 위치: `GameTypes.ts`, `DataManager`의 `as T` 캐스팅
- 현재 skeleton 1종뿐이어서 실질적 위험 없음; 장기 과제로 기록
- 게임 정책·설계 관련 → 사용자 요청 시 대응

---

## Minor

### 3. QA 문서 브랜치명 보완 (원본 브랜치 + xpDrop 추가 브랜치 병기)
- 위치: `docs/qa/xp-system-test.md:3`
- 본문 대부분은 `feat/walking-skeleton` 작성분이므로 원본 브랜치명을 유지하고 `feat/xp-system` (xpDrop 추가)를 병기
- **수정됨** ✅

---

## Recommendations

- DataManager의 JSON `as T` 캐스팅에 zod 또는 assertion 기반 스키마 검증 도입 고려 (장기)
- `xpDrop: 0` 적(소환체, 장애물 등) 설계 시 null 가드와 의도적 0을 구분하는 명시적 처리 고려
