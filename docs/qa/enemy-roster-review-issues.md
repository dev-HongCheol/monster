# 코드 리뷰 이슈: 적 로스터 S0 (enemy-roster)

> - **브랜치:** feat/enemy-roster
> - **리뷰 커밋:** `a4c4a46` (1차 `8cc47ec`, base `ec90f36`)
> - **리뷰 방식:** `superpowers:requesting-code-review` 패턴, general-purpose subagent dispatch
> - **판정:** Ready to merge (Yes) — Critical 0건. 아래 항목은 즉시 수정.

## 1차 리뷰 (커밋 8cc47ec)

### Critical
- 없음. 데이터 무결성 유지, 깨진 참조 없음, 회귀 없음.

### Important
- **I-1 (수정됨) — 신규 적 `jangsanbeom` 스폰 도달성 미검증.** `EnemyRoster.test.ts`의 무결성 테스트는 정방향(스폰 id ⊆ 적 id)만 본다. 이번 슬라이스의 유일한 신규 콘텐츠인 4번째 적이 스폰 테이블에 실제로 편입됐는지(역방향)는 아무 테스트도 보지 않아, 향후 누군가 `jangsanbeom`을 spawn-table에서 빼도 전부 GREEN인 채 게임엔 안 나온다.
  - **수정:** `EnemyRoster.test.ts`에 역방향 단언 추가 — spawn-table이 참조하는 id 집합이 4종 로스터 전체(`cheonyeo`/`dalgyal`/`dokkaebi`/`jangsanbeom`)를 포함하는지 확인.

### Minor
- **M-1 (수정됨) — `SpawnDirector.test.ts:7` 픽스처 주석이 항등 매핑으로 깨짐.** `(cheonyeo→cheonyeo, dalgyal→dalgyal, dokkaebi→dokkaebi)`로 적혀 있어 무의미하다. 일괄 id 치환(`replace_all`)이 주석의 원본 id(`skeleton…`)까지 덮어쓴 결과. 실제 리네이밍 매핑(`skeleton→cheonyeo` 등)으로 정정.
- **M-2 (수정됨) — `it()` 제목의 stale `swift`/`tank` 라벨 + 조사 오타.** 픽스처 id는 신규로 바꿨는데 제목의 영어 약칭이 옛 `skeleton_swift`/`skeleton_tank`를 가리키는 `swift`/`tank`로 남음(`:37`, `:64`, `:83`). 단언은 정확하므로 동작엔 영향 없으나 읽는 사람을 오도. 신규 id로 갱신하고 `cheonyeo은`→`cheonyeo는` 조사 정정.
- **M-3 (수정됨) — 로스터에 잔여 `skeleton*` 항목이 남아도 통과하는 공백.** 무결성 테스트는 참조되지 않은 항목을 막지 않는다. `enemies.json`에 옛 id가 잔존해도 통과. 그리드 grep은 현재 깨끗하지만, `enemies.json`에 `skeleton`류 id가 없는지 단언해 리네이밍을 airtight하게 만듦(저위험·저비용).

### 설계·정책 지적 (수정 보류 — 기록만)
- 없음. 리뷰어가 "픽스처 가중치(80/20)가 실제 `spawn-table.json`(70/30)과 다른 건 의도된 단위 테스트 디커플링"이라 확인 — 수정 대상 아님(나중에 '드리프트'로 오인해 고치지 말 것).

## 재리뷰 (커밋 a4c4a46)

1차 지적(I-1·M-1·M-2·M-3) 수정분을 재리뷰했다. **판정: Ready to merge (Yes).**

- **I-1 검증:** 역방향 커버리지 단언이 tautology가 아님을 mutation으로 증명 — `jangsanbeom`을 spawn-table 전 웨이브에서 제거하면 `unspawnable=["jangsanbeom"]`로 실제 실패. `ROSTER`(하드코딩)와 `referencedSpawnIds()`(실데이터)가 독립 출처라 진짜 가드.
- **M-3 검증:** 잔여 skeleton 차단 단언 동작 확인. `referencedSpawnIds()` 헬퍼로 정/역방향 중복 로직을 DRY 정리(동작 변화 없음).
- **M-1·M-2 검증:** 깨진 주석·stale 라벨·조사 오타 전부 제거 확인(grep으로 `swift`·항등 매핑 잔존 없음).
- **잔여 관찰(비차단):** `SpawnDirector.test.ts:46,48`·`EnemyRoster.test.ts:24`의 `tank`는 stale 라벨이 아니라 dokkaebi의 실제 `role:"tank"` 용어 — 정확하므로 **수정하지 않는다**.
- 신규 이슈 없음. 전체 스위트 277/277 GREEN(EnemyRoster 7/7, SpawnDirector 15/15).
