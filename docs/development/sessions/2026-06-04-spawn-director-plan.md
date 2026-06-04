# 계획: 스폰 디렉터 + 적 종류 (spawn-director)

> - **작성일:** 2026-06-04
> - **브랜치:** feat/spawn-director
> - **상태:** 계획 — 사용자 승인 대기
> - **상위 설계:** [적 시스템 디자인](../../planning/enemy-system.md) §8(스폰 구성)·§13(구현 슬라이스)
> - **슬라이스 위치:** enemy-variety 3분할 중 **S1**. (S2=시각 구분, S3=게임 필은 후속 별도 슬라이스)

---

## 0. 목표 (한 줄)

웨이브에 따라 **여러 종류의 적이 가중치대로 무작위 스폰**되게 한다. 종류 차이는 이번 슬라이스에선 **스탯(HP/속도/접촉 대미지)**으로만 드러난다(시각 구분은 S2).

---

## 1. 스코프

### 포함 (이번 슬라이스)
- **적 종류 3종** — `enemies.json`에 역할별 스탯 프로필로 추가 (기존 스키마 그대로, 신규 필드 없음).
- **가중 스폰 테이블** — 웨이브 구간별 적 등장 가중치 데이터(`spawn-table.json` 신규).
- **`SpawnDirectorLogic`** (신규, 순수 로직) — `(wave, roll, table) → enemyId` 가중 선택. **TDD RED→GREEN 대상.**
- **`DataManager`** — 스폰 테이블 로드.
- **`EnemySpawner`** — 디렉터가 고른 `enemyId`를 인스턴스에 주입(현재는 프리팹 하드코딩).
- **`WaveManager`** — `waveDuration` 기본값 180→**60**(웨이브 1분). 웨이브 게이팅 스폰을 빠르게 검증하기 위한 **테스트 편의값** — 전체 게임 페이싱에 영향을 주는 밸런스값이므로 **출시 전 재검토**(설계/밸런싱 단계).

### 제외 (후속 슬라이스 / v2)
- ~~시각 구분(tint/크기)~~ → **S2** (`movement`/`role`/`tint`/`threatScale` 필드는 그때 추가).
- ~~피격 플래시·사망 연출~~ → **S3**.
- 능동 공격·텔레그래프·엘리트·보스·적 원소 → v2 (설계 문서 §5·§6·§9·§12).
- v2 이동 알고리즘(지그재그/플랭커/돌진) → 이번엔 `movement` 필드조차 추가 안 함(소비자 없음, YAGNI). 전부 직진 추격.

---

## 2. 적 종류 3종 (Open Item §14 — S1 확정안)

기존 `skeleton`을 **표준**으로 유지하고 2종 추가. **셋 다 이번 슬라이스에선 같은 skeleton 프리팹/스프라이트로 스폰**되며 스탯만 다르다(시각 구분은 S2, 최종 스프라이트는 로드맵 7-9주차).

| id | 역할 | maxHp | speed | contactDmg/s | collisionRadius | xpDrop | 비고 |
|----|------|-------|-------|--------------|------------------|--------|------|
| `skeleton` | 표준 | 100 | 150 | 20 | 25 | 20 | 기존 스탯, xp +10 |
| `skeleton_swift` | 스워머 | 50 | 230 | 12 | 18 | 18 | 빠름·약함·작음 |
| `skeleton_tank` | 탱크 | 320 | 80 | 35 | 38 | 35 | 느림·튼튼·큼 |

> **id 네이밍:** 한국 요괴 IP명(구미호/도깨비 등, 설계 §10)은 **아트 단계(7-9주차)에서 외형과 함께 확정**한다. S1은 art-neutral한 `skeleton_*` placeholder id를 쓴다.
> **xpDrop +10:** 세 적 모두 기준 xp에 +10 (빠른 레벨업으로 카드·웨이브 게이팅 검증). 기존 `skeleton`도 10→20. 1분 웨이브와 함께 **테스트 편의 밸런스값 — 출시 전 재검토**. 나머지 수치도 밸런싱 단계 재조정(설계 §14).

---

## 3. 가중 스폰 테이블 (`spawn-table.json`)

웨이브 구간이 올라갈수록 강한 적 가중치 ↑ (난이도 곡선, 설계 §8.2).

```jsonc
[
  { "fromWave": 1, "weights": { "skeleton": 80, "skeleton_swift": 20 } },
  { "fromWave": 3, "weights": { "skeleton": 35, "skeleton_swift": 50, "skeleton_tank": 15 } },
  { "fromWave": 6, "weights": { "skeleton_swift": 50, "skeleton_tank": 50 } }
]
```

- `fromWave` 오름차순. 현재 웨이브 ≥ `fromWave`인 마지막 구간을 선택.
- **웨이브 3:** 스위프트 가중치 50 (스워머 surge).
- **웨이브 6:** 일반 `skeleton` 미등장 — 스워머·탱크만.
- 수치는 초안 — 밸런싱 단계 확정(설계 §14).

---

## 4. SpawnDirectorLogic (순수 로직 — 테스트 핵심)

```ts
// 의존: cc 없음 (순수 TS). enemyId 결정만 책임.
class SpawnDirectorLogic {
  constructor(table: ISpawnTableEntry[]);
  // wave에 해당하는 구간을 찾고, 가중치 비례로 enemyId 선택.
  // roll = [0,1) 난수(주입식 — 테스트 결정성). 
  selectEnemyId(wave: number, roll: number): string;
}
```

테스트 결정성을 위해 **난수를 주입**(roll 인자)한다. `EnemySpawner`가 `Math.random()`을 넘긴다.

### 타입 추가 (`GameTypes.ts`)
```ts
interface ISpawnTableEntry {
  fromWave: number;
  weights: Record<string, number>; // enemyId → 가중치
}
```
> `IEnemyData`에는 **신규 필드 없음** (S1은 기존 스탯만 사용).

---

## 5. EnemySpawner 배선 (enemyId 주입 — 타이밍 주의)

현재: `instantiate → addChild → getComponent → set playerNode`. `enemyId`는 프리팹 `@property` 기본값('skeleton') 그대로.

변경: 디렉터가 고른 id를 **컴포넌트 활성화(onLoad) 전에** 주입해야 한다. `EnemyController.onLoad`가 `enemyId`로 데이터를 읽기 때문.

```
const id = director.selectEnemyId(wave, Math.random());
const enemy = instantiate(prefab);
const ctrl = enemy.getComponent(EnemyController);
ctrl.enemyId = id;          // ← addChild(활성화) 전에 주입
ctrl.playerNode = playerNode;
canvas.addChild(enemy);     // 여기서 onLoad → onReady가 올바른 id로 데이터 로드
```

> **핵심 리스크:** Cocos `onLoad`는 활성 씬에 `addChild`될 때 실행된다. 현재 코드처럼 `addChild` 후 프로퍼티를 세팅하면 이미 'skeleton'으로 로드된 뒤다. **반드시 순서를 `addChild` 전으로 바꾼다.** (Context7로 Cocos 컴포넌트 생명주기 확인 후 구현.)

---

## 6. 테스트 계획 (RED → GREEN)

`tests/logic/SpawnDirector.test.ts` (피처명 PascalCase = `SpawnDirector`):

- 웨이브 1에서 roll에 따라 `skeleton`/`skeleton_swift`만 나오고 `skeleton_tank`는 안 나온다(구간 게이팅).
- 웨이브 6에선 3종 모두 가능.
- 가중치 경계: roll=0 → 첫 항목, roll→1 직전 → 마지막 항목.
- `fromWave` 사이 값(예: wave 2)은 직전 구간(wave 1) 사용.
- 빈/단일 구간 등 엣지.

> `EnemySpawner`/`EnemyController`/`DataManager`(Cocos 의존)는 단위 테스트 제외 — 수동 QA로 검증(QA 문서).

---

## 7. 영향 파일 (Impact Map)

| 파일 | 변경 | 회귀 확인 |
|------|------|-----------|
| `data/GameTypes.ts` | `ISpawnTableEntry` 추가 | 타입 컴파일 |
| `resources/data/enemies.json` | 2종 추가 | 기존 skeleton 로드 |
| `resources/data/spawn-table.json` | 신규 | 로드 성공 |
| `logic/SpawnDirectorLogic.ts` | 신규 | (테스트) |
| `systems/DataManager.ts` | 스폰 테이블 로드 | 기존 데이터 로드 무영향 |
| `systems/EnemySpawner.ts` | 디렉터 연동 + enemyId 주입 순서 | **스폰 동작·적 추적** |
| `systems/WaveManager.ts` | `waveDuration` 180→60 (테스트값) | 웨이브 타이머·카드 패널 주기 |
| `tests/logic/SpawnDirector.test.ts` | 신규 | — |

> 8개 파일 — "5개 이상 동시 수정" 안전 규칙에 따라 이 계획 문서로 사전 공유. 단일 기능(스폰 다양성)에 응집. `WaveManager`는 이 슬라이스의 웨이브 게이팅을 빠르게 검증하기 위한 테스트 편의 변경.

---

## 8. 완료 정의 (DoD)

- [ ] `SpawnDirector.test.ts` GREEN (피처 + 전체 스위트)
- [ ] 인게임: 웨이브가 오르면 빠른 적·탱키 적이 섞여 나옴(스탯 차이 체감 — 같은 모양이라도 속도/맷집 다름)
- [ ] 기존 단일 적 스폰·추적·접촉 대미지 회귀 없음
- [ ] cso / ts / lint / 코드리뷰 통과

---

## 9. 다음 슬라이스 예고

- **S2 (enemy-visuals):** `movement`/`role`/`tint`/`threatScale` 필드 추가 + `EnemyController`가 색·크기 적용 → 종류를 눈으로 구분.
- **S3 (enemy-feel):** 피격 플래시 + 사망 연출.
