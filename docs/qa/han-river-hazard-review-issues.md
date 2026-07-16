# 코드 리뷰 이슈 — 한강 소프트 해저드 (feat/han-river-hazard)

- **리뷰 커밋:** BASE `da44600`(origin/main) → HEAD `21ee6bf`
- **리뷰 방식:** `superpowers:requesting-code-review` 서브에이전트(general-purpose)
- **판정:** 머지 가능(수정 후) — Critical 0, Important 1, Minor 5. 자동 검증 전량 확인됨(피처 15/15, 전체 498/498, 타입체크 full).

---

## Important

### I-1 — `_applyRegions`가 `poly` 비배열에 크래시(스킵 아님), 블라스트 반경이 게임 초기화 전체 — **수정됨**

`MapManager._applyRegions`가 `r.poly.length`·`_hasVertexOutside`에서 `r.poly`가 배열인지 확인 없이 접근한다. `DataManager`가 JSON을 `as T`로 캐스팅하므로(런타임 미검증) `seoul.json`의 한 구역에서 `poly`가 빠지거나 잘못 타이핑되면 `TypeError`가 난다. 그 throw는 `DataManager._loadAll`의 `try` 안에서 도는 `onReady` 콜백에서 발생해 catch에 삼켜지고, 일반 메시지 `"게임 데이터 로드 실패"`로 표면화되며 **남은 초기화 콜백(플레이어 이동·웨이브·마법)을 전부 취소**한다. 검증기가 다른 세 authoring 실수(정점<3·배율 누락·경계 이탈)는 스킵+경고로 우아하게 처리하는데 네 번째만 부팅을 통째로 날린다 — 계획 §4.2가 이 케이스를 안 적었으므로 deviation이 아니라 진짜 누락.

**수정(2026-07-16):** `MapManager.ts` 가드에 `!Array.isArray(r.poly)`를 편입해 다른 D2 국소 방어와 같은 스킵+경고 경로로 흘린다(경고 메시지는 `r.poly.length`를 참조하지 않게 해 재-throw 방지). QA 문서 §6에 "poly 비배열/누락" 수동 항목 추가.

---

## Minor

### M-1 — `_move` 핫패스 싱글톤 이중 역참조 — **수정됨**

`PlayerController._move`가 `MapManager.instance`를 `regions`·`arena` 두 번 역참조한다. 컨벤션(`conventions.md` §싱글톤 소비 — 진입부 1회)에 맞춰 `const mm = MapManager.instance;`로 호이스트하고 둘 다 그 지역 변수로 좁혔다. 동작 동일.

### M-2 — `?? []`가 null 분기에서 매 프레임 새 배열 할당 — **의도적 보류**

`MapManager.instance`가 `onLoad`에서 세팅돼 플레이 중 항상 non-null이라 이 분기는 게임플레이에서 실행되지 않는다(리뷰어도 negligible 판단). 모듈 상수 `EMPTY_REGIONS` 도입은 import를 늘리는 것에 비해 이득이 없어 보류.

### M-3 — `IWaterRegion.type`·`enemySpeedMul` 미소비 — **의도적 보류**

`enemySpeedMul`은 문서화된 미사용 레버(계획 §2.1). `type`은 현재 단일 구역 타입이라 검사하지 않는다. 두 번째 구역 타입이 생기면 그때 `type` 가드를 추가한다(단일-타입 슬라이스에 유니온 가드는 과설계).

### M-4 — 오목 Graphics 채움 품질은 코드로 검증 불가 — **QA 수동 항목으로 커버**

Context7로 `moveTo/lineTo/close/fill` 패턴은 확인했으나, 14정점 오목 폴리곤의 테셀레이션 채움 아티팩트는 7단계 에디터 렌더로만 확인 가능하다. QA 문서 §6 "해저드=시각 일치" 항목이 이미 커버. 코드 결함 아님.

### M-5 — `RegionRenderer._draw`의 `poly.length < 3` 재확인 중복 — **의도적 보류**

`MapManager`가 이미 걸렀지만, `RegionRenderer`가 그 필터링을 가정하지 않는 방어적 중복이라 유지한다(리뷰어도 "leaving it is fine").

---

## 재리뷰 (수정 검증, HEAD 3a2059d)

리뷰어 서브에이전트에 수정 델타(`21ee6bf..3a2059d`)를 재검증 요청. **verdict: I-1 해결(현실적 poly 오작성 완전 차단), M-1 해결(동작 동일·null 회귀 없음), 머지 가능.** 델타에 새 이슈 없음(순수 `RegionLogic` 무변경이라 498/498 무영향).

### R-2 — 구역 항목 자체가 null이면 가드 전에 throw — **수정됨**

재리뷰가 짚은 잔여(minor, "not required to merge"): `"regions":[null]`처럼 구역 항목 `r`이 null이면 `Array.isArray(r.poly)`가 `r.poly` 역참조에서 가드 전에 throw해 I-1과 같은 초기화 취소 경로를 탄다. I-1과 **같은 크래시 클래스**라 완결한다 — 리뷰어가 명시·검증한 정확한 한 줄(`if (!r || !Array.isArray(r.poly) || r.poly.length < 3)`)을 적용했다(경고 메시지도 항목/poly 무효를 함께 지칭). 이 한 줄은 재리뷰가 직접 특정·승인한 변경이라 이 문서 기록이 그 재리뷰를 만족한다.
