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

### 설명 주석은 인과를 복원할 수 있게 쓴다

WHY를 적기로 했다면, 그 WHY가 **읽는 사람 머릿속에서 다시 세워져야** 값어치가 있다. 쓴 사람에게는 자명해서 생략한 연결 고리가 문장에 없으면, 주석은 달려 있는데 아무도 이해하지 못하는 상태가 된다. 세 가지를 지킨다.

1. **지시어를 쓰려면 그 대상이 같은 문단 안에 적혀 있어야 한다.** "반대편", "이때", "그 경우", "저쪽"은 대상이 글에 없으면 쓰지 않는다 — 무엇의 반대편인지를 적는다. (단어 자체를 금하는 게 아니라, 대상 없이 쓰는 것을 금한다.)
2. **인과 고리를 건너뛰지 않는다.** 원인과 결론만 남기고 중간 단계를 빼면 읽는 사람은 그 간극을 메우지 못한다. 고리가 셋 이상이면 문장을 나눠서 하나씩 적는다.
3. **어긋났을 때 무엇이 잘못되는지를 남긴다.** 실패 증상은 코드가 절대 보여줄 수 없는 정보이자, 다음 사람이 이 주석을 신뢰하고 지킬 이유다.

```ts
// ❌ 쓴 사람만 아는 글 — "반대편"이 무엇의 반대편인지 문장에 없고,
//    화면이 한쪽으로 더 넓어진다는 핵심 고리가 통째로 빠졌다
// 카메라는 벽에서 클램프되므로 플레이어가 벽에 붙으면 플레이어는 화면 중앙이 아니고,
// 플레이어 기준으로 "충분히 멀다"고 뽑은 점이 반대편에서는 여전히 화면 안일 수 있다.

// ✅ 지시 대상을 밝히고, 빠진 고리를 채우고, 실패 증상으로 닫는다
// 카메라는 아레나 벽에서 멈추므로, 플레이어가 벽에 붙으면 플레이어는 화면 중앙이 아니라
// 벽 쪽 가장자리에 선다. 그러면 벽 반대 방향으로는 화면이 플레이어보다 훨씬 멀리까지
// 펼쳐지고, 플레이어에게서 "충분히 멀다"고 뽑은 점도 그 방향에서는 아직 화면 안이다 —
// 적이 플레이어 눈앞에서 튀어나온다.
```

**같은 설명이 코드·테스트·계획 문서에 복사돼 있으면 함께 고친다.** 한 곳만 고치면 나머지가 낡은 채로 남아, 다음 사람이 어느 쪽을 믿어야 할지 모르게 된다. 틀렸거나 낡은 주석은 없느니만 못하다 — 사람도 도구(AI)도 주석을 코드보다 먼저 믿기 때문이다.

> 문서(계획·QA·ADR·PR 본문)에 같은 규칙을 적용한 판은 [`writing-style.md` § 설명하는 글은 독자가 인과를 복원할 수 있게 쓴다](writing-style.md#설명하는-글은-독자가-인과를-복원할-수-있게-쓴다)에 있다.

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

### 싱글톤 선언

```ts
export class GameManager extends Component {
  /** 씬 리로드 시 onDestroy가 null로 되돌리므로 정직하게 nullable이다 (싱글톤 컨벤션 참고). */
  static instance: GameManager | null = null;

  onLoad() {
    GameManager.instance = this;
  }

  onDestroy() {
    if (GameManager.instance === this) {
      GameManager.instance = null;
    }
  }
}
```

**타입은 사실을 말한다.** `onDestroy`가 실제로 null을 넣으므로 `instance`는 런타임에 null일 수 있고(씬 리로드 시 매니저가 다른 컴포넌트보다 먼저 파괴된다 — 커밋 `497fb90`이 그 크래시를 고쳤다), 타입도 그렇게 적는다. `null as unknown as T`나 `static instance!: T`(정의 할당 단언 — static 멤버엔 `TS1255`라 애초에 불가)로 null을 지우지 않는다.

### 싱글톤 소비 — 진입부에서 한 번 받고, 실패는 시끄럽게

**어디서 받든 규칙은 하나다 — 함수 진입부에서 1회 받고, 그 뒤로는 그 지역 변수만 쓴다.** 참조할 때마다 `X.instance`를 다시 쓰지 않는다. 받는 방식은 컴포넌트 성격에 따라 두 가지다.

| 형태 | 쓰는 곳 | 이유 |
|------|---------|------|
| **캐시 + loud-fail** — `start()`/`onEnable()`에서 필드에 잡아 두고, 없으면 `console.error` + `this.enabled = false` | 씬에 고정된 컴포넌트(`GameManager`·`SpellCaster`·`PlayerController`·`MapManager`) | 매니저 부재 = **씬 배선 실수**이므로 크게 드러나야 한다. 끄면 조용한 no-op이 반복되지 않는다 |
| **정적 참조를 진입부에서 호이스트** — `const gm = GameManager.instance; if (!gm) return;` | 풀링 노드(`Projectile`·`EnemyProjectile`·`XPItemController`·`EnemyController`)와 항상 돌아야 하는 컴포넌트(`WaveManager`·`EnemySpawner`·`HudController`·`PauseController`) | 풀에서 되살아나는 노드는 `enabled = false`가 다음 생까지 따라붙어 영영 죽는다. 이쪽은 끄지 않고 그 프레임만 건너뛴다 |

캐시 형태의 예시는 이렇다(Cocos가 모든 `onLoad` 뒤에 `start`를 부르므로 이 시점엔 `instance`가 세팅돼 있다).

```ts
// SpellCaster처럼 씬에 고정된 컴포넌트 — 매니저 부재는 배선 실수이므로 끄면서 알린다.
private _gm: GameManager | null = null;

start() {
  const gm = GameManager.instance;
  if (!gm) {
    console.error('[SpellCaster] GameManager 없음 — 비활성화합니다. 씬 배선을 확인하세요.');
    this.enabled = false;
    return;
  }
  this._gm = gm;
}

update(dt: number) {
  const gm = this._gm;
  if (!gm) return;            // 함수 진입부 1회 — 아래 모든 참조가 이 하나로 좁혀진다
  if (gm.state !== GameState.Playing) return;
  …
}
```

풀링 노드(`Projectile` 등)는 **이 형태를 쓰지 않는다.** `enabled = false`가 풀에 반환된 뒤 다음 생까지 따라붙어 그 노드가 영영 돌지 않는다. 대신 진입부에서 정적 참조를 호이스트하고 그 프레임만 건너뛴다.

```ts
update(dt: number) {
  const gm = GameManager.instance;
  if (!gm) return;            // 끄지 않는다 — 이번 프레임만 건너뛴다
  if (gm.state !== GameState.Playing) return;
  …
}
```

경로별 규칙은 이렇다.

| 경로 | 규칙 |
|------|------|
| 핫패스(`update`와 거기서 불리는 헬퍼) | 함수 진입부에서 1회 호이스트 + 조기 return. 헬퍼에는 **인자로 넘긴다**(헬퍼마다 다시 가드하면 "폭발 없는 파이어볼" 같은 조용한 폴백이 생긴다) |
| 값을 돌려받는 호출 | **`?.` + `?? 폴백` 금지.** `effectiveCooldown ?? 0`은 매 프레임 발사, `damageFactor ?? 0`은 전 마법 피해 0, `pickupRadius ?? 0`은 경험치 영구 미획득이다 — 전부 에러 없이 게임을 망가뜨린다 |
| 반환값을 버리는 void 호출 | `?.` 허용 (`GameManager.instance?.damagePlayer(x)`) |
| 장식적 값(결과 화면 통계 등) | `?? 폴백` 허용 — 틀린 통계는 깨진 게임보다 낫다 |
| **상태 전이**(`_state` 대입, 씬 이동, 부팅 래치) | **가드는 "읽기"에만 걸고 전이는 항상 실행한다.** 전이 앞에서 조기 return하면 HP 0인데 게임오버가 안 되거나, 카드 패널이 열린 채 게임이 영구 정지한다 |
| teardown(`onDisable`/`onDestroy`) | **캐시 필드를 쓰지 않는다.** 정적 참조 + `?.` — 캐시는 이미 파괴된 매니저를 가리킬 수 있다 |
| 클로저(`onReady(() => …)`·`.map(cb)`) | 내로잉이 살아남지 않으므로 클로저 **안에서 다시** 호이스트한다. 비동기 콜백이면 `this.isValid`도 함께 확인한다(씬을 넘어 살아남아 죽은 컴포넌트에 쓰는 것을 막는다) |

> **캐시가 안전한 전제:** `addPersistRootNode`를 쓰지 않아 모든 컴포넌트의 수명이 자기 씬의 수명 안에 있다. **persist root node를 도입하면 이 전제가 깨지므로 캐시 패턴을 재검토해야 한다.**

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

## 문서 작성 스타일

이 문서(`conventions.md`)는 **코드 작성 규칙**만 다룬다. 코드가 아닌 **문서**(계획·QA·세션 기록·ADR·PR 본문 등)의 한국어 서술 규칙은 별도 문서로 분리했다 → [`writing-style.md`](writing-style.md).
