# 코드 컨벤션 — Cocos Creator TypeScript

> 모든 코드 작성 시 이 문서를 기준으로 한다.

- **최초 작성:** 2026-05-19
- **상태:** CONFIRMED

---

## 파일 & 클래스 명명

- 파일명은 `PascalCase.ts` — 클래스명과 일치시킨다
- 파일 하나에 클래스 하나
- 파일 최상단 `@file` 블록 주석은 작성하지 않는다 (파일명이 이미 설명)

---

## 컴포넌트 구조 순서

```ts
@ccclass('PlayerController')
export class PlayerController extends Component {
  // 1. @property (인스펙터 노출)
  @property(Prefab) bulletPrefab: Prefab | null = null;

  // 2. private 상태 필드 (_언더스코어 prefix)
  private _hp: number = 100;
  private _speed: number = 5; // units/sec

  // 3. 라이프사이클 (주석 생략 — Cocos 개발자면 자명)
  onLoad() {}
  start() {}
  update(dt: number) {}

  // 4. public 메서드
  takeDamage(amount: number): boolean {}

  // 5. private 메서드
  private _spawnBullet() {}
}
```

---

## 프라이빗 필드

```ts
private _hp: number = 100;   // ✅ 언더스코어 prefix
#hp: number = 100;            // ❌ @property 데코레이터와 충돌 가능
```

---

## 주석 기준

### 원칙: WHY를 적고, WHAT은 코드가 말하게

```ts
// ❌ WHAT — 코드 자체가 이미 말함
// hp에서 amount를 뺀다
this._hp -= amount;

// ✅ WHY — 코드만 봐서는 모르는 이유
// 0 이하도 허용 — 음수 HP로 오버킬 데미지 계산
this._hp -= amount;
```

### 클래스 & 인터페이스

클래스와 인터페이스에는 한 줄 JSDoc을 작성한다.

```ts
/** 플레이어 데이터 구조 */
interface IPlayerData {
  /** 이동 속도 (units/sec) */
  speed: number;
  maxHp: number; // 자명한 것은 생략
}

/** 플레이어 이동, 공격, HP를 관리하는 컴포넌트 */
@ccclass('PlayerController')
export class PlayerController extends Component {
```

### 프로퍼티 & 필드

단위나 허용 범위가 중요한 숫자에만 주석을 단다.

```ts
/** 이동 속도 (units/sec) */
private _speed: number = 5;

/** 공격 쿨다운 (초) */
private _attackCooldown: number = 0.5;

private _isAlive: boolean = true; // 자명 → 주석 생략
```

### 메서드 JSDoc

라이프사이클 메서드(`onLoad`, `start`, `update`, `onDestroy` 등)를 제외한 모든 메서드에 JSDoc을 작성한다. private 메서드 포함.

```ts
/** 대상 방향으로 발사체를 생성하고 발사한다. */
private _shoot(target: Node): void { ... }

/**
 * 피해를 입히고 사망 여부를 반환한다.
 * @param amount 피해량 (0 이상, 음수 무시됨)
 * @returns true면 이 프레임에 사망
 */
takeDamage(amount: number): boolean { ... }

onLoad() { ... }      // 라이프사이클 — 주석 생략
update(dt: number) {} // 라이프사이클 — 주석 생략
```

### 복잡 로직 인라인 주석

"다음 사람이 이걸 보고 왜?라고 물을 것인가"가 기준.
라인 수가 아니라 비직관성이 기준이다.

```ts
// ✅ 3줄이지만 WHY가 필요
// 대각선 이동 시 속도가 √2배 되는 것 방지
if (input.length() > 1) {
  input.normalize();
}

// ✅ 비직관적 수식 → 출처 링크
// Easing: https://easings.net/#easeOutQuart
return 1 - Math.pow(1 - t, 4);

// ❌ 자명한 것 — 주석 불필요
const dx = targetX - this.node.position.x;
const dy = targetY - this.node.position.y;
const dist = Math.sqrt(dx * dx + dy * dy);
```

---

## 타입 정의

```ts
// 객체 구조 → interface
interface IEnemyData {
  hp: number;
  speed: number;
}

// 유니온/별칭 → type
type ItemCategory = 'weapon' | 'armor' | 'food';

// 상수 집합 → enum
enum GameState { Playing, Paused, GameOver }
```

---

## 컴포넌트 통신

| 방법 | 사용 시점 |
|------|-----------|
| 싱글톤 매니저 | 전역 상태, 씬 간 접근 |
| `node.emit / node.on` | 부모↔자식 이벤트 |
| `@property` 직접 참조 | 씬에서 고정 연결된 관계 |

싱글톤 패턴:

```ts
export class GameManager extends Component {
  static instance: GameManager = null!;

  onLoad() {
    GameManager.instance = this;
  }
}
```

---

## null 처리

`@property` 필드는 Cocos 직렬화 요구로 `| null` 타입이 강제된다.

### onLoad 검증

모든 필드를 한 번에 검증하고, 실패 시 `this.enabled = false`로 `update()` 호출을 차단한다.

```ts
onLoad() {
  if (!this.bulletPrefab || !this.bulletParent) {
    console.error('[ClassName] required properties not assigned');
    this.enabled = false;
    return;
  }
  // 초기화 로직
}
```

### 메서드 내 null 체크

각 메서드가 자신이 필요한 필드만 직접 체크한다. `if (!this.x) return` 이후 동일 스코프 내에서 TypeScript narrowing이 유지되므로 `!` 없이 사용 가능하다.

```ts
private _shoot(): void {
  if (!this.bulletPrefab || !this.bulletParent) return;
  const bullet = instantiate(this.bulletPrefab); // ! 불필요
  this.bulletParent.addChild(bullet);
}
```

`!` (non-null assertion 연산자) 사용 금지 — Biome `noNonNullAssertion` 규칙.

---

## 폴더 구조

```
scripts/
  logic/        # cc import 없는 순수 TypeScript 클래스 (Vitest 테스트 대상)
  components/   # Node에 붙는 컴포넌트 (logic을 감싸는 껍데기)
  systems/      # 글로벌 매니저 (GameManager, SpawnSystem 등)
  data/         # 타입/인터페이스 정의
  ui/           # UI 컴포넌트
```

게임 규칙 로직은 `logic/`에 구현하고 Component는 라이프사이클 + wiring만 담당한다. → [ADR 002](../../docs/decisions/002-scripts-logic-pattern.md)
