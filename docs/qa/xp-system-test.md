# XP 시스템 수동 테스트

- **브랜치:** `feat/walking-skeleton` (최초 작성) / `feat/xp-system` (xpDrop 추가)
- **날짜:** 2026-05-25
- **목적:** XP·레벨업 시스템 에디터 설정 및 인게임 동작 확인

---

## Impact Map — 변경 파일별 테스트 범위

| 변경 파일 | 확인 범위 |
|-----------|----------|
| `logic/ExperienceLogic.ts` | XP 누적, 레벨업 판정, 이월 XP (Vitest 자동 검증) |
| `systems/ExperienceManager.ts` | experience.json 로드, onLevelUp 콜백 → WaveClear 전환 |
| `components/XPItemController.ts` | 아이템 드롭 위치, 픽업 반경 감지, 흡수 후 소멸; xpValue는 스폰 시 EnemyController가 코드로 설정 (인스펙터 값 무시) |
| `resources/data/experience.json` | baseXp·xpMultiplier 수치 인게임 반영 |
| `resources/data/enemies.json` | 몬스터별 xpDrop 수치 인게임 반영 |
| `data/GameTypes.ts` | `GameState.Victory`, `GameResult.gameVictory` 추가; `IEnemyData.xpDrop` 필드 추가 |
| `systems/WaveManager.ts` | 타이머 3분 카운트다운, 타이머 0 → Wave 번호 증가만 (WaveClear 트리거 없음) |
| `systems/GameManager.ts` | onLevelUp 콜백 등록, startNextWave 시 resumeWave 호출, 전체 게임 타이머 카운트다운 → 0 시 승리 처리 |
| `components/EnemyController.ts` | 적 사망 시 XPItem 스폰, playerNode 전달; 스폰 시 enemies.json의 xpDrop 값을 XPItemController.xpValue에 주입 |
| `ui/HudController.ts` | Lv·XP 레이블 실시간 갱신, timerLabel → 전체 게임 잔여 시간(MM:SS) |
| `ui/ResultController.ts` | 승리 시 "승리! N웨이브 도달", 패배 시 기존 텍스트 |

---

## 씬/프리팹 변경 사항

### main.scene — 추가 노드

| 노드 | 타입 | Position | 컴포넌트 | 비고 |
|------|------|----------|----------|------|
| ExperienceManager | 빈 노드 | (-640, -360) | ExperienceManager | 시스템 노드 영역에 추가 |
| HUD > LevelLabel | Label | (-300, 190) | UITransform, Label(fontSize 20) | HudController.levelLabel 연결 |
| HUD > XpLabel | Label | (0, 190) | UITransform, Label(fontSize 20) | HudController.xpLabel 연결 |

> 계층 순서 준수: DataManager → WaveManager → DeckManager → ExperienceManager → GameManager

### main.scene — 수정 노드

| 노드 | 프로퍼티 | 기존 값 | 변경 값 | 비고 |
|------|---------|--------|--------|------|
| WaveManager | waveDuration | 30 | 180 | 웨이브당 3분 |
| GameManager | gameDuration | — | 900 | 전체 게임 15분 (신규 @property) |

### XPItem 프리팹 — 신규 생성

`game/assets/resources/` 또는 `game/assets/prefabs/` 에 `XPItem.prefab` 생성

| 컴포넌트 | 설정 값 |
|----------|---------|
| UITransform | Size: 20×20 |
| Sprite | 임시 흰 원 또는 별 모양 |
| XPItemController | pickupRadius: 50 (xpValue는 스폰 시 코드로 주입되므로 인스펙터 설정 불필요) |

---

## 에디터 연결 체크리스트

### main.scene — HudController

| 프로퍼티 | 연결 노드 | 상태 |
|---------|----------|------|
| levelLabel | HUD > LevelLabel | ❌ 노드 생성 후 연결 필요 |
| xpLabel | HUD > XpLabel | ❌ 노드 생성 후 연결 필요 |

### Enemy 프리팹 — EnemyController

| 프로퍼티 | 연결 대상 | 상태 |
|---------|----------|------|
| xpItemPrefab | XPItem 프리팹 | ❌ 프리팹 생성 후 연결 필요 |

> ⚠️ EnemyController가 씬 노드가 아닌 프리팹으로 관리되는 경우, 프리팹 인스펙터에서 연결.
> EnemySpawner가 씬에서 직접 Enemy 노드를 인스턴스화하는 경우, EnemySpawner의 enemyPrefab에 연결된 프리팹에서 설정.

### main.scene — 노드 순서 확인

아래 순서로 onLoad 의존성이 올바르게 해결된다:

```
DataManager → WaveManager → DeckManager → ExperienceManager → GameManager
```

---

## 수동 테스트 체크리스트

### XP 아이템 드롭 및 수집

- [x] 적 처치 → 해당 위치에 XP 아이템 스폰
- [x] 플레이어가 XP 아이템 반경(기본 50u) 내 진입 → 자동 흡수
- [x] 흡수 후 XP 아이템 노드 소멸
- [x] HUD XpLabel 수치 증가 확인 (`XP: n / 100`)

### 레벨업

- [x] XP 100 채우면 레벨업 → 카드 선택 패널 표시
- [x] HUD LevelLabel `Lv.1` → `Lv.2` 증가
- [x] 레벨업 후 requiredXp 증가 확인 (`XP: 0 / 120`)
- [x] 초과 XP 이월 확인 (110 XP 수집 시 레벨업 후 `XP: 10 / 120`)
- [x] 레벨 3, 4에서도 동일하게 동작 (배율 120% 누적 확인)

### 카드 선택 후 게임 재개

- [x] 카드 선택 → 패널 닫힘, 게임 재개
- [x] 재개 후 새로운 적 스폰 재개

### 웨이브 시스템 (WaveManager 변경 검증)

- [x] 웨이브 타이머 0 → **카드 선택 패널이 뜨지 않음** (WaveClear 트리거 없음 확인)
- [x] 웨이브 타이머 0 → Wave 번호 1 증가 (Wave 1 → Wave 2)
- [x] Wave 2에서 적 스폰 간격/최대 수 변화 확인

### HUD 표시

- [x] `Lv.1` / `XP: 0 / 100` 초기값 표시
- [x] TimerLabel이 `15:00`으로 시작 후 MM:SS 형식으로 카운트다운
- [x] HP, Wave 기존 표시 정상 (회귀 없음)

### 승리 조건

- [x] 전체 타이머 0 도달 → result.scene 이동
- [x] result.scene에 `승리! N웨이브 도달` 표시
- [x] 패배(HP 0) 시 result.scene에 `N웨이브 도달` (승리 문구 없음)

### 데이터 연동

- [x] `experience.json` baseXp: 100 반영 (첫 레벨업 XP 100)
- [x] `experience.json` xpMultiplier: 1.2 반영 (레벨 2 요구 XP 120)
- [x] `enemies.json` skeleton xpDrop 반영 확인 (해골 처치 → XP 아이템 xpValue가 enemies.json 값과 일치: 10)
