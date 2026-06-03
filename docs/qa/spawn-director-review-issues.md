# 코드 리뷰 이슈: spawn-director

> **리뷰 커밋:** d25246e (BASE 990a44e)
> **슬라이스:** enemy-variety S1 (spawn-director)
> **리뷰어:** general-purpose subagent (superpowers:requesting-code-review 패턴)

리뷰 종합: Critical 0, Important 4, Minor 3. 핵심 로직·생명주기 수정·통합·테스트는 정확. `SpawnDirectorLogic`이 손으로 편집하는 JSON을 소비하는데 비정상 데이터 경로 3개가 무방비 → 가드 + 테스트 추가 권고.

---

## Important (수정)

### 1. 빈 `weights` → 크래시 — 수정됨
- `SpawnDirectorLogic._pickWeighted`: `weights: {}`이면 `entries=[]`, 루프 스킵, `entries[entries.length-1]` = `entries[-1]` → undefined 접근 크래시. 스폰 틱마다 호출돼 게임 정지.
- **수정:** `entries.length === 0`이면 `''` 반환. 생성자 `_validate()`에서 1회 경고.

### 2. 합=0 weights → 무음 오류(마지막 키) — 수정됨
- `total=0`이면 `target<acc`가 항상 false → 폴스루로 마지막 키 반환(임의값, 데이터 오류 은폐).
- **수정:** `total <= 0`이면 첫 키로 폴백(결정적). 생성자에서 경고.

### 3. 빈 테이블 → 크래시 — 수정됨
- `_entryForWave`가 빈 테이블에서 `this._table[0]`=undefined 반환 → `_pickWeighted(undefined.weights)` 크래시. `DataManager.spawnTable` 기본값 `[]`라 잠재 도달 가능.
- **수정:** `_entryForWave` 반환형 `ISpawnTableEntry | undefined`, `selectEnemyId`이 없으면 `''` 반환. 생성자에서 빈 테이블 경고.

### 4. malformed-data 테스트 누락 — 수정됨
- 계획 §6의 "빈/단일 구간 엣지" 중 빈 구간 미커버.
- **수정:** 빈 weights / 합=0 / 빈 테이블 / roll 음수·≥1 테스트 추가.

---

## Minor (조치/판단)

### 5. `waveDuration` 60 — 코드에 든 밸런스값 (조치 없음)
- 테스트 편의값으로 문서·주석·QA에 "출시 전 재검토" 명시됨. 씬 직렬화값(180) 우선 경고도 QA에 있음. 책임있게 처리됨 — 이번 슬라이스 변경 없음.

### 6. `spawn-table.json.meta` 부재 (예상됨)
- Cocos 에디터가 다음 오픈 시 생성. 7단계(에디터 세팅) 전 import 필요 — QA 수동 체크리스트에 반영.

### 7. `_ensureDirector` lazy 생성 vs `DataManager.onReady` (현행 유지)
- lazy 방식이 콜백 수명/teardown 부담 없이 더 단순. 틱당 비용 무시 가능. 리뷰어도 현행 유지 권고.

---

## 재검증

수정(이슈 1-4)은 코드 품질·실제 버그 → `pnpm wf invalidate` 후 cso→ts→lint→commit→리뷰 재실행.

### 재리뷰 (커밋 2a31040)

동일 리뷰어 재검증 결과 **이슈 1-4 전부 RESOLVED, 신규 이슈 0건, "Ready to merge? Yes."**
- 1: `_pickWeighted` `entries.length===0 → ''` 가드 확인.
- 2: `total<=0 → 첫 키` 결정적 폴백 확인(음수 합 포함).
- 3: `_entryForWave: ISpawnTableEntry | undefined`, `selectEnemyId` 빈 id 단락 확인.
- 4: 엣지 테스트(빈 테이블/빈 weights/합0/roll 음수·≥1 + 정상시 무경고) 15/15 통과.
- 다운스트림 계약 확인: `''` id → `EnemyController._data=null` → update/접촉/추적 early-return(불활성, 크래시 없음). `_validate()`는 생성자 1회만 경고(틱당 아님).
