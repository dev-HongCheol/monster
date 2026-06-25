# 적 로스터 S0 — 역할 베이스 확정 (계획)

- **작성일:** 2026-06-25
- **브랜치:** feat/enemy-roster
- **슬라이스:** S0 (역할 베이스 확정) — 적 12종 로스터의 첫 구현 슬라이스
- **상위 설계:** [적 시스템 디자인](../../planning/enemy-system.md) — §10 패밀리 0, §13 슬라이스 로드맵. 이 계획은 그 설계의 S0 부분을 구현 단위로 좁힌 것이다.

---

## 1. 배경·목적

이번 세션에서 적 시스템 전체 기획을 다시 잡아 **한국 요괴 12종 로스터**와 taxonomy(이동 4 / 역할 4 / 공격 6), 데미지 모델, 행동 패밀리별 슬라이스 로드맵(S0~S3)을 `enemy-system.md`에 확정했다. 그 첫 구현 슬라이스가 **S0**다.

현재 적은 placeholder 해골 3종(`skeleton` 표준 / `skeleton_swift` 스워머 / `skeleton_tank` 탱크)뿐이다. S0는 이 셋을 한국 요괴 IP로 리네이밍하고, 네 번째 표준 추격병 **장산범**을 더해 **추격×역할 베이스 4종**을 확정한다. 전부 직진 추격 + 접촉이라 **신규 동작 코드는 없고 데이터·시각(tint) 변경이 중심**이다. 능동 전투(이동 패턴·발사체·근접 휘두르기)는 후속 슬라이스 S1~S3에서 들어온다.

## 2. 이 슬라이스의 스코프 (구현 대상)

| 적 | id | 이동 | 역할 | 공격 | tint(placeholder) | 비고 |
|---|---|---|---|---|---|---|
| 처녀귀신 | `cheonyeo` | 추격 | 표준 | 접촉 | 연회색 | 기본 군집(baseline). 기존 `skeleton` 리네이밍 |
| 도깨비 | `dokkaebi` | 추격 | 탱크 | 접촉 | 짙은 보라 | 느린 벽. 기존 `skeleton_tank` 리네이밍 |
| 달걀귀신 | `dalgyal` | 추격 | 스워머 | 접촉 | 창백한 살구 | 작고 빠른 다수. 기존 `skeleton_swift` 리네이밍 |
| 장산범 | `jangsanbeom` | 추격 | 표준 | 접촉 | 흰빛 베이지 | **신규 4번째.** 처녀귀신보다 약간 단단·빠른 스탯으로 구분(호랑이 미믹) |

**구현 항목:**
1. **`enemies.json`** — 위 4종으로 교체. id·name·tint를 IP로 바꾸고, `movement:"chase"`·`role` 라벨은 유지(이미 존재). 장산범 블록을 새로 추가하되 스탯은 처녀귀신 기준에서 HP·속도·접촉 피해를 약간 높인 placeholder로 둔다(정확한 값은 밸런싱 단계).
2. **`spawn-table.json`** — 웨이브 가중치를 신규 id로 교체하고 장산범을 편입(`enemy-system.md` §11 예시 기준, 정확한 가중치는 밸런싱).
3. **`EnemyController.ts`** — `@property enemyId` 기본값 `'skeleton'` → `'cheonyeo'`(직렬화 기본값 정리. 실제 스폰은 `reset()`이 디렉터 값으로 덮어쓰므로 표시·기본값 용도). *스크립트 편집이라 implementation phase에서 수행.*
4. **`SpawnDirector.test.ts`** — 기존 테스트가 `skeleton*` id를 쓰므로 신규 id로 갱신(GREEN 유지).
5. **`Enemy.prefab`** — 직렬화된 `enemyId:'skeleton'` 기본값. **Cocos 에셋이라 7단계 사용자 에디터 테스트에서 갱신**(AI는 .prefab을 직접 만지지 않는다 — 에셋 `.meta` 관리 규칙과 동일 취지).

## 3. 스코프 밖 (이번 슬라이스에서 안 함)

- S1~S3 행동 — 신규 이동(지그재그·돌진·유격), 발사체, 근접 휘두르기, 텔레그래프.
- `attack`·`moveParams` 스키마 필드의 **실제 구현**(S0는 베이스 4종이 전부 접촉이라 `attack` 불필요 — 스키마 자리는 후속 슬라이스에서 채움).
- 데미지 모델의 능동 공격(버스트) 경로 — S0는 접촉 DoT만 쓴다.
- 밸런싱 수치 확정(HP·속도·접촉 피해·가중치 — placeholder).
- 최종 스프라이트·아트(로드맵 7-9주차).

## 4. 백로그 확인 (워크플로우 0-1)

`docs/development/backlog.md`를 확인했다. **S0가 닫는 백로그 항목은 없다**(S0는 데이터 리네이밍 + 1종 추가뿐). 다만 적 데이터가 늘기 시작하므로 다음 항목이 **후속 적 슬라이스(S1+, `attack` 데이터 도입 시)에서 관련**된다:

- **D2(중) — DataManager JSON 스키마 검증 + 실데이터 sanity 테스트.** `attack`·`moveParams` 필드가 들어오는 S1부터 필드 누락·오타 방어가 필요해진다. S0에서는 경량 sanity 테스트(아래 §5)로 일부 미리 깐다.
- **D1(낮음) — `IEnemyData.name` → `enemy.<id>.name` i18n 키화.** 콘텐츠 단계. 지금 enemy.name 표시 소비처가 없어 보류.

## 5. 테스트 전략

S0는 신규 순수 로직이 없어 테스트 스킵 후보지만, **리네이밍은 오타·참조 누락이 나기 쉬운 작업**이라 경량 데이터 계약 테스트로 RED→GREEN을 가져간다(스킵보다 가드가 이득).

- **파일:** `tests/logic/EnemyRoster.test.ts` (피처명 PascalCase = `EnemyRoster` — `ready-impl` 게이트 규칙).
- **단언:**
  1. `enemies.json`에 4종 base id(`cheonyeo`/`dokkaebi`/`dalgyal`/`jangsanbeom`)가 존재하고, 각 `movement:"chase"`·`role`이 설계와 일치.
  2. **무결성:** `spawn-table.json`이 참조하는 모든 enemyId가 `enemies.json`에 존재(리네이밍 누락·오타 차단 — D2의 일부를 미리).
- 신규 id가 아직 없으니 1번이 **RED**로 시작 → 데이터 교체 후 **GREEN**. 기존 `SpawnDirector.test.ts`도 신규 id로 갱신해 전체 스위트 GREEN 유지.
- 최종 테스트 구성은 3단계(QA 문서 + 테스트 코드)에서 확정.

## 6. 위험·주의

- **id 리네이밍 파급:** `skeleton*` 참조는 활성 5곳(enemies.json·spawn-table.json·EnemyController.ts·Enemy.prefab·SpawnDirector.test.ts). 나머지 매치는 역사 문서(세션·QA 기록)라 **보존**한다(수정하지 않음). 무결성 테스트가 데이터 쪽 누락을 잡고, prefab은 7단계 에디터에서 갱신.
- **`Enemy.prefab` 기본 enemyId:** AI는 .prefab을 직접 수정하지 않는다. 7단계 사용자 인게임 테스트에서 에디터로 갱신하고, 그때 생기는 `.meta`/직렬화 변경을 8단계 `PR 승인` 시 커밋한다.
- **수치는 전부 placeholder.** tint·스탯·스폰 가중치는 구분/동작 확인용이며 밸런싱 단계에서 확정한다.

## 7. 후속 슬라이스 (예고 — 이번 스코프 아님)

- **S1 — 신규 이동 + 텔레그래프 토대:** 어둑시니(지그재그) · 불가사리(돌진). `MovementLogic` + 돌진 상태기계 + 텔레그래프 1차.
- **S2 — 적 발사체:** 구미호 · 이무기 · 물귀신. 유격 이동 + 적 발사체 + 발사 형태.
- **S3 — 근접 휘두르기:** 두억시니 · 야차 · 그슨대. 부채꼴 즉시 판정 + 범위 텔레그래프.

각 슬라이스는 별도 `feat/enemy-*` 브랜치로 워크플로우를 다시 탄다.
