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

  // 3. 라이프사이클 (단순하면 주석 생략, 로직 누적 시 한 줄 설명)
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
```

#### 라이프사이클 메서드 주석

라이프사이클 메서드는 시그니처 자체가 호출 시점을 말하므로, 기본적으로 **JSDoc(`@param`/`@returns` 등 형식 주석)은 생략**한다. 다만 본문에 로직이 누적되면 다음 두 가지를 적용한다.

1. **함수에 한 줄 설명:** 본문이 비어 있거나 자명한 단일 wiring이면 주석을 생략한다. 여러 로직이 쌓여 "이 메서드가 매 프레임/초기화 시 무엇을 하는가"가 한눈에 안 들어오면, 메서드 위에 한 줄 설명 주석을 단다.
2. **내부 코드 인라인 주석:** 본문 내부는 일반 [복잡 로직 인라인 주석](#복잡-로직-인라인-주석) 기준(WHY 위주)을 그대로 따른다.

```ts
onLoad() {}            // 비어 있음 → 주석 생략
start() {
  this._hp = this.maxHp; // 단순 초기화 → 주석 생략
}

// 적 탐색 → 쿨다운 소진 시 발사 → 무적시간 갱신 (매 프레임)
update(dt: number) {
  const target = this._findNearestEnemy();

  this._cooldown -= dt;
  if (target && this._cooldown <= 0) {
    this._shoot(target);
    this._cooldown = this._attackCooldown;
  }

  // 피격 직후 깜빡임 동안만 입력 무시 — 연타 사망 방지
  if (this._invincible > 0) this._invincible -= dt;
}
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

---

## 다국어(i18n)

자체 경량 `t()` 방식. 카탈로그는 `resources/i18n/<lang>.json`. → [ADR 005](../../docs/decisions/005-i18n-approach.md)

### 핵심 규칙

- **`logic/` 순수 로직엔 사용자 표시 문자열을 두지 않는다.** logic은 **키/구조화 데이터**만 산출하고, 표시 해석(`t()`)은 UI(`ui/`)·Component에서 한다.

  ```ts
  // ❌ logic에서 한글 결합 — 언어 종속
  description: `신규 마법 추가 (${CATEGORY_LABEL[cat]} · ${tier}등급)`;

  // ✅ logic은 키/params만 산출, UI가 t()로 결합
  descKey: 'card.add_magic',
  descParams: { category: `category.${cat}`, tier },
  ```

- **조합형 문자열은 단순 연결 대신 파라미터 메시지 템플릿(`{param}`)** 으로 — 언어별 어순/조사 차이를 흡수한다. (`HP: {cur} / {max}`)

- **파라미터 값이 자체 카탈로그 키인 경우(중첩 키), UI가 먼저 `t()`로 해석한 뒤 바깥 템플릿에 치환한다.** 예: 마법 추가 카드 설명 `card.add_magic`의 `{category}`는 `category.fire` 같은 키 → `t('card.add_magic', { category: t('category.fire'), tier })`. `t()`는 1단계 치환만 하므로 분류명 같은 현지화 토큰은 호출부가 사전 해석한다(`CardSelectPanel._resolveDesc` 참고). logic은 키만 산출하고 결합 해석은 UI 책임.

- **카탈로그 키는 안정적 식별자.** 네임스페이스 점 표기(`result.victory`, `hud.hp`, `spell.<id>.name`, `category.<cat>`). 콘텐츠 추가 = 카탈로그 한 줄 + (필요 시) 데이터 한 줄.

- **데이터(JSON)는 언어 중립.** `spells.json`/`cards.json`은 `id`+수치/분류만 두고 표시명은 **id 파생 키**(`spell.<id>.name`, `card.<id>.desc`)로 카탈로그 참조. 데이터 파일·인터페이스에 표시 문자열 필드를 두지 않는다.

- **폴백 체인:** 활성 언어 미스 → ko → 키 자체. en 빈 문자열/누락도 ko 폴백 → en이 비어도 게임 정상. 카탈로그 로드 전에는 키 자체를 노출(크래시 없음).

### 소스 카탈로그(ko) 작성

소스 언어(ko)는 키당 **객체** `{ message, desc?, params? }`, 타겟 언어(en 등)는 **순수 문자열**.

```jsonc
// ko.json — 소스: desc(번역 맥락 노트)로 오번역 방지
"result.victory": { "message": "승리! {wave}웨이브 도달", "desc": "승리 결과 화면", "params": ["wave"] }

// en.json — 타겟: 순수 문자열
"result.victory": "Victory! Reached wave {wave}"
```

- **신규 표시 문구 추가 시 ko 엔트리에 `desc`(번역 맥락 노트)를 함께 단다** — 타겟 언어 번역(특히 AI 번역)의 오역 방지용 단일 참조.

### 정적 라벨 vs 동적 라벨

| 종류 | 방법 |
|------|------|
| 정적 씬 라벨(버튼/타이틀) | `ui/LocalizedLabel` 컴포넌트 부착 + `@property key` |
| 코드 동적 라벨(HUD 수치 등) | Component에서 `I18n.instance.t(key, params)` 직접 호출 |

- **i18n 라벨은 TTF 폰트를 사용한다**(비트맵 `.fnt` 금지). 비트맵 폰트는 미리 구운 글자만 그려 다국어 글리프에 부적합. 폰트 글리프 커버리지는 언어 추가 단계에서 확인.
- 언어 변경 갱신은 `I18n` 싱글톤의 **명시적 레지스트리**로 처리한다(LocalizedLabel가 onEnable 등록 / onDisable·onDestroy 해제, `setLanguage`·`onReady`가 순회 refresh). 이벤트 버스/매 프레임 폴링을 쓰지 않는다.

---

## 문서 작성 스타일 (한국어)

`docs/` 아래 모든 문서(계획·QA·리뷰 이슈·세션 기록·ADR 등)는 **처음부터** 자연스러운 한국어 서술형으로 작성한다. 초안을 영어 용어 섞인 전보체로 쓴 뒤 나중에 정리하지 않는다.

- **영어 용어를 한국어 조사에 그대로 붙이지 않는다.** 한국어로 풀거나 괄호로 병기한다.
  - ❌ `instantiate/destroy churn을 없애`, `메모리 hoarding 방지`, `미부착될 footgun`, `폐기 경로가 dead code`
  - ✅ `반복적으로 생성·삭제되는 것을 없애`, `과도하게 쌓이는 것을 막음`, `부모에 붙지 않은 채 빠질 위험`, `실행되지 않는 코드(dead code)`
- **그대로 두는 것:** API명·식별자(`acquire`/`release`/`active`/`instantiate`/`onLoad` 등), 코드블록, 표의 기록성 데이터(SHA·이슈 ID·체크박스 상태·수치).
- **명사 나열식 끊김보다 서술형 문장을 우선한다.** 단, 표 셀이나 짧은 라벨처럼 밀도가 우선인 곳은 전보체를 허용한다.
  - ❌ `가용분 재사용 또는 신규 생성. 반환 노드 active=true.`
  - ✅ `가용분을 재사용하거나 새로 생성하며, 반환하는 노드는 active=true 상태다.`
- **중의적 표현을 피한다.** 예: "적은 리스크"(적[enemy]은 / 적은[few]?)처럼 오독 가능한 표현은 풀어 쓴다.
- **용어를 통일한다.** 같은 개념을 한 문서 안에서 다른 말로 부르지 않는다(예: "cap" ↔ "보관 한도" 혼용 금지 → "보관 한도"로 통일).
