# QA: 적 로스터 S0 — 역할 베이스 4종 (enemy-roster)

> - **브랜치:** feat/enemy-roster
> - **계획:** [2026-06-25-enemy-roster-plan.md](../development/sessions/2026-06-25-enemy-roster-plan.md)
> - **상위 설계:** [enemy-system.md](../planning/enemy-system.md) §10 패밀리 0·§13 슬라이스 로드맵
> - **슬라이스:** 적 로스터 S0 (역할 베이스 확정) — 적 12종 로스터의 첫 구현 슬라이스

이번 슬라이스는 placeholder 해골 3종(`skeleton`/`skeleton_swift`/`skeleton_tank`)을 한국 요괴 IP로 리네이밍하고, 네 번째 표준 추격병 **장산범**(`jangsanbeom`)을 더해 추격×역할 베이스 4종을 데이터로 확정한다. 넷 다 직진 추격 + 접촉이라 신규 동작 코드는 없고, 데이터(`enemies.json`·`spawn-table.json`)와 시각(tint)·기본값 변경이 중심이다.

---

## Impact Map (회귀 테스트 기준)

| 변경 파일 | 확인 범위 |
|-----------|-----------|
| `resources/data/enemies.json` | 4종으로 교체(id·name·tint를 요괴 IP로, 장산범 신규 추가). JSON 로드 성공, `movement:"chase"`·`role` 라벨 유지. 스탯은 placeholder |
| `resources/data/spawn-table.json` | 웨이브 가중치를 신규 id로 교체 + 장산범 편입. SpawnDirector가 신규 id를 정상 추출하는지 |
| `components/EnemyController.ts` | `@property enemyId` 직렬화 기본값 `'skeleton'` → `'cheonyeo'`. 실제 스폰은 `reset()`이 디렉터 값으로 덮어쓰므로 동작 무영향(표시·기본값 용도). **스폰·추적·접촉·XP 드롭·사망 흐름** 회귀 확인 |
| `tests/logic/SpawnDirector.test.ts` | 픽스처·단언의 `skeleton*` id를 신규 id로 갱신(GREEN 유지) |
| `game/assets/Enemy.prefab` | 직렬화된 `enemyId:'skeleton'` 기본값 → `'cheonyeo'`. **Cocos 에셋이라 7단계 사용자 에디터 테스트에서 갱신**(AI는 .prefab을 직접 만지지 않는다) |
| `tests/logic/EnemyRoster.test.ts` | 신규 데이터 계약 테스트 — 아래 자동 검증 |

---

## 자동 테스트로 검증 (`tests/logic/EnemyRoster.test.ts`)

> **통과 근거:** 피처 테스트 7/7 + 전체 스위트 277/277 GREEN (리뷰 반영 후 최종, 테스트 커밋 `a4c4a46`).

리네이밍은 오타·참조 누락이 나기 쉬워, 신규 순수 로직이 없어도 경량 데이터 계약 테스트로 가드한다.

- [x] **베이스 4종 정합:** `enemies.json`에 `cheonyeo`(standard)·`dokkaebi`(tank)·`dalgyal`(swarmer)·`jangsanbeom`(standard)이 존재하고, 각 `movement:"chase"`·`role`이 설계와 일치
- [x] **스폰 테이블 무결성:** `spawn-table.json`이 참조하는 모든 enemyId가 `enemies.json`에 존재(리네이밍 누락·오타 차단)

> `EnemyController`(cc 의존)는 단위 테스트 제외 — 아래 수동 항목으로 검증.

---

## 씬/프리팹 변경 사항

**신규 노드/프리팹 없음.** 기존 `game/assets/Enemy.prefab` 한 종류를 디렉터가 재사용하며, 스폰 시 `reset(enemyId, …)`이 enemies.json 데이터로 스탯·색·크기를 입힌다(시각 구분은 데이터의 tint·threatScale로만 결정).

- 변경점은 prefab에 **직렬화된 `EnemyController.enemyId` 기본값** 하나뿐(`'skeleton'` → `'cheonyeo'`). 이 값은 표시·기본값 용도이고 실제 스폰 종류는 디렉터가 정한다.
- `.prefab`은 Cocos 에셋이므로 AI가 직접 수정하지 않는다. 7단계에서 사용자가 에디터로 기본값을 바꾸고, 그때 생기는 직렬화 변경·`.meta`를 8단계 `PR 승인` 시 커밋한다.

---

## 에디터 연결 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| Enemy.prefab의 `EnemyController.enemyId` 기본값 | ❌ → ✅ | 7단계에서 인스펙터 기본값을 `'cheonyeo'`로 변경(현재 `'skeleton'`). 동작에는 영향 없으나 직렬화 기본값 정합을 맞춤 |
| 신규 `@property` 연결 | ➖ 없음 | 이번 슬라이스는 데이터 주도, 신규 에디터 배선 없음 |

---

## 수동 테스트 체크리스트 (인게임)

### 로스터 4종 등장·구분
- [ ] 웨이브를 진행하면 **4종이 모두 등장**한다(초반엔 처녀귀신·달걀귀신, 중반부터 도깨비·장산범 가중치 편입 — `spawn-table.json` 기준)
- [ ] tint로 4종이 한눈에 구분된다: 처녀귀신=연회색 / 도깨비=짙은 보라 / 달걀귀신=창백한 살구 / 장산범=흰빛 베이지
- [ ] 같은 종류는 항상 같은 색·크기로 스폰됨(데이터 일관성)
- [ ] 장산범이 처녀귀신과 **스탯으로 구분**됨(약간 더 단단·빠름 — placeholder 값 기준 체감)

### 회귀 (기존 동작 유지)
- [ ] 스폰·추적·접촉 데미지·웨이브 스케일링 정상(리네이밍으로 깨진 참조 없음 — 적이 실제로 등장하고 움직이며 닿으면 피해)
- [ ] 피격 플래시·사망 팝/페이드·XP 드롭·레벨업·카드 선택 흐름 정상
- [ ] 콘솔에 `getEnemy` 미스(존재하지 않는 id 조회) 경고가 없음

> 수치(HP·속도·접촉 피해·tint·스폰 가중치)는 전부 placeholder다. 이번 단계는 4종이 구분되어 등장하고 기존 흐름이 안 깨지는지만 확인하며, 밸런싱은 후속 단계에서 한다.
