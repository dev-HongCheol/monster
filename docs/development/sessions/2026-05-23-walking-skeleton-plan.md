# Walking Skeleton 구현 계획 세션

- **날짜:** 2026-05-23
- **이전 세션:** [2026-05-23-office-hours-mvp-design.md](./2026-05-23-office-hours-mvp-design.md)
- **브랜치:** `feat/walking-skeleton`
- **상태:** 계획 확정, 구현 진행 중

## 목표

마법 1종 + 몬스터 1종으로 전체 게임 플로우를 먼저 뚫는다.  
마법 종류 확정은 이 플로우가 작동한 후로 미룬다. 데이터 주도 설계를 처음부터 적용해 이후 마법 추가가 데이터 작업만 되도록 한다.

## 결정 사항

| # | 항목 | 결정 | 이유 |
|---|------|------|------|
| D1 | 구현 접근법 | **B — 시스템 분리 우선** | 구조를 먼저 잡아야 마법 9종 추가 시 리팩토링 없음 |
| D2 | 씬 전환 | **A — 별도 씬** (menu / game / result) | 씬 경계가 명확해 나중에 확장 쉬움 |
| D3 | 웨이브 클리어 조건 | **B — 타이머 기반** (X초 생존) | 뱀서 모델과 동일, 직관적이고 검증이 빠름 |

## 전체 플로우 (검증 대상)

```
menu.scene → [Play]
  → main.scene 로드
      웨이브 타이머 시작 (30초)
      적 스폰 (WaveManager → EnemySpawner)
      [타이머 0] → WaveClear
          → CardSelectPanel 표시 (게임 일시정지)
          → 카드 선택 → DeckManager 강화 적용
          → 다음 웨이브 시작
      [HP 0] → GameOver
  → result.scene (웨이브 수, 사망 원인)
      → [Retry] 또는 [Menu]
```

## 구현 범위

### 새 파일 (10개)

| 파일 | 역할 |
|------|------|
| `resources/data/player.json` | 플레이어 수치 (단일 객체) |
| `resources/data/spells.json` | 마법 배열 (1종 → 10종으로 확장) |
| `resources/data/enemies.json` | 적 배열 (1종 → 5종으로 확장) |
| `resources/data/cards.json` | 카드 배열 (3종 → 전체로 확장) |
| `systems/DataManager.ts` | JSON 로드 싱글톤 |
| `systems/WaveManager.ts` | 웨이브 타이머, 클리어 판정, 씬 데이터 관리 |
| `systems/DeckManager.ts` | 카드 풀, 드로우, 강화 적용 |
| `ui/CardSelectPanel.ts` | 웨이브 클리어 시 카드 선택 UI |
| `ui/MainMenuController.ts` | menu.scene 진입 + [Play] 버튼 |
| `ui/ResultController.ts` | result.scene — 웨이브 수, Retry/Menu |

### 수정 파일 (5개)

| 파일 | 변경 내용 |
|------|----------|
| `data/GameTypes.ts` | `WaveClear` 상태 추가, `SpellData` / `CardData` / `WaveData` 인터페이스 추가 |
| `systems/GameManager.ts` | DataManager 연동, `loadScene('menu'/'result')` 추가 |
| `systems/EnemySpawner.ts` | WaveManager 연동 (웨이브별 스폰 간격/최대치 적용) |
| `components/EnemyController.ts` | 하드코딩 수치 → DataManager에서 읽기 |
| `ui/HudController.ts` | 웨이브 타이머 카운트다운 표시 추가 |

### 씬 작업 (에디터 직접)

- `menu.scene` 신규 생성
- `result.scene` 신규 생성
- `main.scene` 에 CardSelectPanel 노드 추가

## 마법 종류 미결 항목

이번 사이클은 **파이어볼 1종**으로만 진행한다.  
마법 풀 7종의 구체적 패턴(projectile_count, homing, explosion_radius 등)은 전체 플로우가 작동한 후 결정한다.  
→ 결정 시점: `feat/walking-skeleton` 플레이 검증 통과 후

## 다음 세션 인계

1. `feat/walking-skeleton` 구현 완료 후 전체 플로우 수동 검증
2. 검증 통과 → `/review` + PR squash merge
3. 이후 사이클: 마법 풀 7종 패턴 결정 → JSON 추가 (코드 변경 없음)
