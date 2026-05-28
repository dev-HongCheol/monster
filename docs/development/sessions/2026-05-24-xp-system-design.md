# 설계: 레벨/경험치 시스템 (XP System)

- **작성일:** 2026-05-24
- **브랜치:** feat/walking-skeleton → 다음 피처 브랜치에서 구현
- **상태:** APPROVED
- **관련 ADR:** [ADR 002](../../decisions/002-scripts-logic-pattern.md), [ADR 003](../../decisions/003-testing-strategy.md)

---

## Walking Skeleton과의 관계

Walking skeleton(`feat/walking-skeleton`)은 **30초 타이머** 기반으로 카드 선택 패널을 트리거한다. 이는 전체 플로우(메뉴 → 게임 → 카드 선택 → 게임 재개 → 게임오버)를 검증하기 위한 임시 플레이스홀더다.

- **Walking skeleton (현재):** 30초 타이머 만료 → WaveClear → 카드 선택
- **XP 시스템 구현 후:** 레벨업 → WaveClear → 카드 선택 (타이머는 웨이브 난이도 증가에만 사용)

웨이브 타이머 목표값(3분)은 walking skeleton 테스트에 불필요하므로 이 브랜치에서는 **30초를 유지**한다. XP 시스템 피처 브랜치에서 WaveManager를 수정할 때 함께 180초로 변경한다.

---

## 문제 정의

현재 walking skeleton은 30초 타이머가 만료되면 WaveClear 상태로 전환되고 카드 선택 패널이 나타난다. 이는 최종 설계와 다르다.

**최종 설계에서 카드 선택 트리거는 레벨업이다.** 웨이브 시스템(타이머 기반)과 레벨/경험치 시스템(킬 기반)은 독립적으로 동작한다.

---

## 두 시스템의 관계

```
웨이브 시스템 (타이머 기반)          레벨/경험치 시스템 (킬 기반)
─────────────────────────────        ──────────────────────────────
3분마다 웨이브 증가             vs.  몬스터 처치 → XP 아이템 드롭
→ 몬스터 수/종류 증가                → 플레이어 근접 → XP 흡수
→ 카드 선택과 무관                   → 레벨업 → 카드 선택 패널
```

두 시스템은 독립적으로 진행되며 서로를 블로킹하지 않는다.

---

## 전제 (Premises)

1. 웨이브 타이머 종료 시 카드 선택 패널을 더 이상 트리거하지 않는다
2. 몬스터 사망 시 해당 위치에 XPItem prefab이 스폰된다
3. 플레이어가 XPItem 근처(픽업 반경)에 들어오면 자동 흡수된다 (즉시 흡수 아님)
4. 흡수한 XP가 레벨 요구치에 도달하면 레벨업 → GameState.WaveClear 전환 → 카드 선택
5. 레벨별 요구 XP는 레벨이 오를수록 증가한다
6. HUD에 현재 XP 진행 바(또는 수치)와 현재 레벨이 표시된다
7. XPItem은 씬에 실존하는 노드(Prefab)이며 흡수 후 소멸한다

---

## 구현 방향 비교

### A) ExperienceManager 싱글톤 + logic/ 분리 (권장)

```
logic/ExperienceLogic.ts          — XP 계산 순수 로직 (Vitest 테스트 가능)
systems/ExperienceManager.ts      — 싱글톤, 레벨업 이벤트 → GameManager 연동
components/XPItemController.ts    — 드롭 아이템 컴포넌트, 픽업 반경 감지
```

- ADR 002(logic/ 분리) 준수
- XP 계산 로직 Vitest 테스트 가능
- 파일 3개 신규, 기존 4개 수정 (EnemyController, PlayerController, GameManager, HudController)

### B) PlayerController에 XP 로직 통합

- 파일 수 적음 (신규 1개)
- PlayerController 비대해짐, ADR 002 위반
- XP 로직 테스트 불가

### C) 즉시 흡수 방식 (아이템 없이 처치 즉시 XP 지급)

- 구현 단순 (XPItem prefab 불필요)
- 유저 인터랙션(아이템 수집)이 없어 게임 재미 감소
- 추후 아이템 자석 등 확장 어려움

**권장: A** — ADR 002 준수, Vitest 테스트 가능, 향후 XP 배율 카드 등 확장 쉬움

---

## 권장 구현 상세

### 파일 목록

| 파일 | 타입 | 내용 |
|------|------|------|
| `logic/ExperienceLogic.ts` | 신규 | XP 누적, 레벨업 판정, 레벨별 요구치 계산 |
| `systems/ExperienceManager.ts` | 신규 | 싱글톤, ExperienceLogic 래퍼, onLevelUp 콜백 |
| `components/XPItemController.ts` | 신규 | 드롭 아이템, 픽업 반경, 흡수 시 소멸 |
| `resources/data/experience.json` | 신규 | 레벨별 요구 XP 테이블 |
| `data/GameTypes.ts` | 수정 | IXPItemData 인터페이스 추가 |
| `systems/EnemyController.ts` | 수정 | 사망 시 XPItem 스폰 |
| `systems/GameManager.ts` | 수정 | onLevelUp 연결 → WaveClear 전환 (웨이브 타이머 트리거 제거), `gameDuration` 신규 @property(900초), 전체 게임 타이머 카운트다운 → 0 시 Victory |
| `systems/WaveManager.ts` | 수정 | 타이머 종료 시 WaveClear 전환 제거, 웨이브 번호 증가만 수행 |
| `ui/HudController.ts` | 수정 | XP·레벨 레이블 추가, timerLabel을 웨이브 타이머에서 **전체 게임 잔여 시간(MM:SS)** 으로 변경 |

### logic/ExperienceLogic.ts

```typescript
export class ExperienceLogic {
  private _level: number = 1;
  private _currentXp: number = 0;

  /** 레벨별 요구 XP: index 0 = 레벨1→2에 필요한 XP */
  constructor(private _xpTable: number[]) {}

  get level() { return this._level; }
  get currentXp() { return this._currentXp; }
  get requiredXp() { return this._xpTable[this._level - 1] ?? Infinity; }

  /** XP를 추가하고 레벨업 여부를 반환한다. */
  addXp(amount: number): boolean {
    this._currentXp += amount;
    if (this._currentXp >= this.requiredXp) {
      this._currentXp -= this.requiredXp;
      this._level++;
      return true;
    }
    return false;
  }
}
```

### experience.json (예시)

```json
{
  "xpTable": [100, 150, 220, 310, 420, 550, 700, 870, 1060, 1270]
}
```

레벨 10 이후는 마지막 값 반복 또는 별도 로직으로 처리.

### XPItemController 동작

- `@property xpValue: number` — 이 아이템이 주는 XP량
- `@property pickupRadius: number = 50` — 흡수 반경 (units)
- `update(dt)` 에서 플레이어와의 거리 계산 → 반경 이내 진입 시 `ExperienceManager.instance.addXp(xpValue)` → `this.node.destroy()`

### WaveManager 변경 사항

```typescript
// 변경 전: 타이머 0 → setWaveClear()
// 변경 후: 타이머 0 → 웨이브 번호 증가만 (EnemySpawner에 웨이브 변경 알림)
update(dt: number) {
  if (!this._started) return;
  if (GameManager.instance.state !== GameState.Playing) return;
  this._waveTimer -= dt;
  if (this._waveTimer <= 0) {
    this._waveTimer = 0;
    this._waveNumber++;
    this._waveTimer = this.waveDuration;
    // TODO: EnemySpawner에 웨이브 변경 신호
  }
}
```

---

## 씬 변경 사항 (main.scene)

| 추가 노드 | 타입 | 컴포넌트 | 연결 대상 |
|----------|------|----------|----------|
| ExperienceManager | 빈 노드 | ExperienceManager | — |
| XpBar (HUD 하위) | Sprite 또는 Label | UITransform | HudController.xpLabel |
| LevelLabel (HUD 하위) | Label | UITransform, Label | HudController.levelLabel |
| XPItem | Prefab | UITransform, Sprite, XPItemController | — |

---

## TDD 계획

`logic/ExperienceLogic.ts`는 `cc` import 없는 순수 클래스이므로 Vitest로 테스트한다.

```typescript
// logic/ExperienceLogic.test.ts
describe('ExperienceLogic', () => {
  test('XP 추가 후 레벨업 미달 시 false 반환', () => { ... });
  test('요구치 도달 시 레벨업 true 반환 및 레벨 증가', () => { ... });
  test('레벨업 후 초과 XP는 이월된다', () => { ... });
  test('레벨 10 이후 XP 테이블 범위 초과 시 Infinity 처리', () => { ... });
});
```

---

## 열린 질문

- 웨이브 변경 시 EnemySpawner에 어떻게 알릴 것인가? (이벤트 vs. 직접 참조)
- XPItem이 화면 밖으로 밀려날 경우 처리 필요한가?
- 레벨 최대치는 얼마인가? (현재 xpTable 길이에 종속)
- 최종 보스 트리거 조건: 10분 타이머인가, 특정 웨이브인가?

---

## 다음 단계

1. 이 문서를 기반으로 `feat/xp-system` 피처 브랜치 생성
2. `logic/ExperienceLogic.test.ts` 먼저 작성 (TDD RED)
3. `ExperienceLogic` 구현 (GREEN)
4. `ExperienceManager`, `XPItemController` 구현
5. WaveManager에서 WaveClear 트리거 제거
6. 씬 노드 추가 및 Inspector 연결
7. 수동 인게임 테스트
