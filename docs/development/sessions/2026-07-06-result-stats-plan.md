# 결과 화면 런 통계 (J4 P0-4) — 구현 계획

- **작성일:** 2026-07-06
- **브랜치:** feat/result-stats
- **성격:** 기능 개발 계획. `/office-hours` 스코프 확정(통계 항목·마법 표시·킬 종류별) + `/autoplan` 집중 리뷰(Codex 미설치 → 단일 리뷰어) 반영.
- **정본 연결:** `docs/design/ui-completeness-plan.md` §4 P0-4, `docs/development/backlog.md` 테마 J4 · J2, [[project_v1_completeness_pivot]]

---

## 1. 배경과 목적

v1 완성도 전환(로드맵 v0.3) UI 트랙의 P0 중 하나가 "결과 화면 런 통계"다. 지금 결과 화면(`ResultController`)은 **승/패 + 도달 웨이브 숫자 하나**만 보여준다. 한 판을 20분 가까이 돌려도 끝나면 "N웨이브 도달"만 뜨니, 내가 얼마나 버텼고 뭘 잡았고 어떤 빌드였는지 돌아볼 게 없다 — ui-completeness-plan이 "현재 웨이브 숫자만 있는 큰 공백"이라 부른 지점이다. 이 슬라이스는 생존 시간·도달 레벨·킬 수(적 종류별)·보유 마법·패시브 요약을 결과 화면에 얹어 런 요약을 채운다.

## 2. 스코프

`/office-hours`에서 확정(2026-07-06).

### IN (이번 슬라이스)
- **통계 5종 표시:** 생존 시간, 도달 레벨, **킬 수(적 종류별 + 총계)**, 보유 마법(텍스트: 티어 라벨 + 이름), **패시브 요약(최대HP·이동속도·픽업범위 보너스)**. 기존 승/패 + 도달 웨이브 라벨은 유지.
- **킬 카운터 신설:** 현재 없음. `GameManager`가 적 종류별 킬 맵(`Record<enemyId, number>`)을 들고, `EnemyController._startDeath()`에서 `registerKill(enemyId)`로 종류별 +1.
- **씬 간 스냅샷:** main→result는 씬 교체라 `GameManager`·`DeckManager`·`SpellCaster`·`ExperienceManager`가 전부 파괴된다. 그래서 사망/승리 시점(둘 다 `goToResult()` 경유)에 모든 통계를 `GameResult` 전역에 스냅샷하고, `ResultController`는 `GameResult`만 읽는다.
- **순수 로직 seam:** `buildResultStats(스냅샷 + getSpell/getEnemy → 뷰모델)` — 시간 포맷·마법 라벨·킬 종류별 리스트·패시브 조립.

### OUT (후속/이월)
- **적 이름 현지화** — 적 이름은 `enemies.json`에 직접 문자열(처녀귀신 등)로 있고 i18n 키가 없다(`enemy.*` 0건). 킬 리스트의 적 이름은 **한국어 고정**(EN 모드에서도 한국어). 12종 `enemy.*` i18n는 별도 작업이라 이월(도감 J3와 함께 닫을 후보).
- **마법 강화 상세**(개별/분류/전역 브레이크다운) — 호버 툴팁(spell-icon-row 후속)과 함께.
- **메타 통계**(누적 클리어·최고 기록·골드) — 세이브(J3)와 함께.
- **결과 화면 비주얼 폴리시**(레이아웃·모션) — `/design-consultation` 단계.

## 3. 이 슬라이스가 닫는 백로그 항목
- **J4 P0-4** (ui-completeness-plan) — 결과 화면 런 통계. 이 슬라이스가 생존·레벨·킬·마법·패시브 표시를 닫는다.
- **J2 일부** — "게임오버 → 결과 화면" 완성도. 결과 화면이 요약 정보를 갖추며 플로우 완결감이 오른다(J2 자체는 나머지로 계속 열림).

## 4. 설계

### 4.1 데이터 흐름 (씬 전환 스냅샷)

```
[플레이 중] EnemyController._startDeath()
   → GameManager.registerKill(enemyId)   // 종류별 킬 맵 +1

[사망/승리] GameManager.goToResult()  (사망: _applyDamage→_startDeathSequence→done, 승리: update)
   → _snapshotResult():  아직 살아 있는 매니저들에서 GameResult로 복사
        survivalSec = gameDuration - gameTimer
        level       = ExperienceManager.level
        killsByType = { ...GameManager 킬 맵 }
        spellIds    = SpellCaster.loadout.spells
        passive{Hp,Move,Pickup}Bonus = DeckManager getter
   → director.loadScene('result')       // 여기서 매니저들 파괴됨

[결과 씬] ResultController.onLoad()
   → buildResultStats(GameResult, DataManager.getSpell, DataManager.getEnemy)  // 순수
   → 라벨들에 렌더(코드 구동 i18n — result.stat.* + 값)
```

**왜 `goToResult()`에서 스냅샷하나:** 사망·승리 두 경로가 모두 이 메서드를 지난다(한 곳). `loadScene` 직전이라 매니저가 전부 살아 있고, 이 시점 이후 값이 바뀌지 않는다(게임은 GameOver/Victory로 얼어 있음). DRY 스냅샷 지점.

### 4.2 아키텍처 (신규/변경)

```
[신규] logic/ResultStatsLogic.ts (순수, cc import 없음)
  - buildResultStats(snapshot, getSpell, getEnemy): ResultStatsView
      ResultStatsView = {
        survivalTime: string,       // formatTimer(survivalSec) = mm:ss
        level: number,
        killTotal: number,
        killsByType: { name: string; count: number }[],  // count 내림차순
        spells: { label: string }[],                      // "F1 파이어볼" 티어 오름차순
        passives: { hpBonus: number; moveSpeedPct: number; pickupPct: number },
      }
      · getEnemy(id)=null 인 킬 항목 생략(정합 가드), getSpell(id)=null 마법 생략
      · 마법 라벨은 SpellIconRowLogic.categoryInitial + 티어 오름차순(재사용)

[변경] data/GameTypes.ts — GameResult 확장
  - survivalSec, level, killsByType: Record<string, number>, spellIds: string[],
    passiveHpBonus, passiveMoveBonus, passivePickupBonus (기존 waveReached·gameVictory 유지)

[변경] systems/GameManager.ts
  - _killsByType: Record<string, number> = {}  (onLoad에서 초기화)
  - registerKill(enemyId: string): 종류별 +1
  - goToResult(): _snapshotResult() 후 loadScene (§4.1)
  - _snapshotResult(): 위 필드들을 GameResult에 복사(매니저 null 가드)

[변경] components/EnemyController.ts
  - _startDeath()에서 GameManager.instance?.registerKill(this.enemyId) 1회
    (takeDamage→_hp<=0→_startDeath 경로 = 실제 킬만. despawn/onDestroy 아님)

[변경] ui/ResultController.ts
  - buildResultStats 호출 → 통계 라벨들 렌더(코드 구동 i18n, main 씬 컨벤션과 동일 [[project_main_scene_i18n_convention]])
  - @property 통계 라벨 추가(생존·레벨·킬·마법·패시브). 기존 waveLabel·retry/menu 버튼 유지

[변경] resources/i18n/ko.json·en.json
  - result.stat.* 키(라벨: 생존시간·레벨·킬·보유마법·패시브 + 단위/포맷). 적 이름은 미대상(§2 OUT)

[변경] result.scene (7단계 에디터)
  - 통계 라벨 노드 추가 + ResultController @property 연결

[재사용] HudFormatLogic.formatTimer, SpellIconRowLogic.categoryInitial/티어정렬,
         DataManager.getSpell/getEnemy, DeckManager.maxHpBonus/moveSpeedBonus/pickupRangeBonus,
         ExperienceManager.level, GameManager.gameTimer/gameDuration
```

## 5. 리뷰 요약 (/autoplan 집중 리뷰 — Codex 미설치, 단일 리뷰어)

### CEO/스코프
- 올바른 P0 문제. "웨이브 숫자만"의 큰 공백을 채워 런 완결감을 준다(저비용·고체감). 재사용이 강함 — 새로 만드는 건 킬 카운터·`GameResult` 스냅샷·순수 `buildResultStats`뿐, 나머지는 기존 매니저/포맷/로직 재사용.
- 킬 종류별·패시브 포함은 사용자 요구 반영한 완성도 확장(단일 킬 수보다 "무엇과 싸웠나"가 요약으로 유의미).
- 6개월 후회 낮음 — 스냅샷 구조는 메타 통계(세이브 J3)·도감으로 그대로 확장된다.

### Eng
- **아키텍처 건전.** `GameResult` 전역 스냅샷이 씬 파괴를 넘는 유일한 올바른 경로. `buildResultStats` 순수·`ResultController` 렌더 전용 분리.
- **킬 카운트 위치:** `_startDeath()`가 `takeDamage`의 `_hp<=0`에서만 불려 킬당 정확히 1회. `unregisterEnemy`/`onDestroy`(씬 teardown 포함 모든 제거)엔 넣지 않아 오버카운트 없음. `EnemyController.enemyId`(@property) 존재 → 인자 확보.
- **스냅샷 타이밍:** 사망 경로는 `_startDeathSequence`(연출 ~0.8s) 후 `goToResult()`지만, 그 사이 값이 안 변함(GameOver 프리즈). 승리도 `goToResult()` 경유. 한 곳 스냅샷으로 양쪽 커버. `_snapshotResult`는 매니저 null 가드.
- **엣지:** 킬 0/마법 0 → 빈 리스트, `getEnemy/getSpell=null` → 해당 항목 생략(정합 가드, SpellIconRow·F4류), 승리 시 `survivalSec=gameDuration`(gameTimer=0).
- **테스트 seam:** `buildResultStats`는 순수(스냅샷 + 조회 콜백) → 피처 테스트로 덮음. **스킵 아님.**

### Design (UI 스코프)
- **정보 위계:** 승/패 결과(기존) → 생존시간·레벨(핵심 지표) → 킬(총계 + 종류별) → 보유 마법 → 패시브. retry/menu 버튼 유지.
- **레이아웃:** 통계는 라벨 몇 개(생존·레벨·킬 총계 헤더) + 리스트 라벨(킬 종류별·마법). 구체 노드·좌표는 7단계 QA 레시피에서 확정.
- **i18n:** 라벨은 `result.stat.*` 코드 구동. 적 이름은 한국어 고정(§2 OUT — 기존 갭).

### 타세(taste) 결정 — 계획 승인 시 조정 가능
- **킬 리스트 정렬:** count 내림차순(많이 잡은 순) 권장. 로스터 순서도 가능.
- **적 이름 현지화 미포함:** EN 모드서도 적 이름 한국어. 이번 스코프 밖(별도 enemy.* i18n 작업). 계획 승인 시 포함 요청 가능하나 12종 키 추가 = 스코프 확대.

## 6. 테스트 전략
- **피처 테스트 `tests/logic/ResultStats.test.ts`** (RED→GREEN):
  - 생존시간 포맷(예 600초 → "10:00"), 레벨 전달, 킬 총계 = 종류별 합, 킬 리스트 count 내림차순, 마법 라벨(티어 오름차순 "F1"·"I3"), 패시브 값 전달, `getEnemy=null` 킬 생략, `getSpell=null` 마법 생략, 빈 입력(킬 0·마법 0).
- **Cocos 의존부**(스냅샷 실제 채움, registerKill 실동작, 라벨 렌더, 씬 전환)는 순수 밖 → 수동 QA. 순수 조립은 피처 테스트가 덮음 → **전체 스킵 아님.**
- wf 파일명 규칙: 피처 PascalCase = `ResultStats` ([[project_wf_test_filename]]).

## 7. QA·에디터 (7단계용 — 상세는 qa 문서)
- result.scene에 통계 라벨 노드 추가(생존·레벨·킬 총계·킬 종류별 리스트·마법 리스트·패시브) + `ResultController` @property 연결.
- 인게임: 한 판 플레이 → 사망 또는 20분 승리 → 결과 화면에서 생존시간·레벨·킬(총계+종류별)·보유 마법·패시브가 실제 플레이와 맞는지 확인. 킬 카운트가 종류별로 정확한지(적 몇 마리 잡고 확인).

## 8. 열어 두는 후속 (백로그 반영)
- 적 이름 i18n(`enemy.*` 12종) — 도감(J3)과 함께.
- 메타 통계(누적 클리어·최고 기록) — 세이브(J3).
- 결과 화면 비주얼 폴리시 — `/design-consultation`.
- 마법 강화 상세 — 호버 툴팁(spell-icon-row 후속).
