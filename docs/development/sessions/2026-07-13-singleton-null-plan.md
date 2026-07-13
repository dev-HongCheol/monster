# 싱글톤 타입 정직화 (F24) — 계획

- **작성일:** 2026-07-13 · **개정:** 2026-07-14 (autoplan CEO·Eng 리뷰 반영 — 설계를 A안에서 C안으로 교체)
- **브랜치:** feat/singleton-null
- **상태:** **구현 완료** — 타입체크 에러 0(변경 전 65건), 전체 스위트 443/443, 수동 QA 대기(7단계)
- **닫는 백로그 항목:** **F24**(싱글톤 타입 정직화), **F3**(`resources.load` 콜백 asset 널 가드), **F44**(`approve-pr`이 타입체크를 실측하게)
- **선행 슬라이스:** `feat/ts-toolchain`(PR #56)이 타입 게이트를 켰다. 이 계획은 그 게이트가 아직 못 보는 구멍을 닫는다.
- **성격:** 게임 로직 변경. 잘못 넣으면 **에러 없이 조용히** 게임이 죽는다. 순수 로직(`logic/`)은 건드리지 않는다.

---

## 1. 왜 지금인가

매니저 7개의 타입은 거짓말을 한다.

```ts
static instance: GameManager = null as unknown as GameManager;
```

7개 전부 `onDestroy`에서 `instance`에 null을 되돌린다. **null은 정상 런타임 값**이다. 이건 추론이 아니라 관측된 사실이다 — 커밋 `497fb90`(2026-05-21)이 바로 그 크래시를 고쳤다. 씬 리로드 때 `GameManager.onDestroy`가 `EnemyController.onDestroy`보다 먼저 돌아 정적 참조가 null이 됐고, 수정은 `instance = null` 정리와 소비자 쪽 `?.` 추가였다.

그런데 타입은 컴파일러에게 "절대 null이 아니다"라고 말한다. 그래서 방금 켠 타입 게이트가 이 축에서 눈을 감고 있다. `I18n.ts:26`은 이미 `static instance: I18n | null = null`로 정직하게 쓰고 있어 선례가 있다.

**이 슬라이스는 그 거짓말을 지운다.** 다만 리뷰가 밝혀낸 대로, 지우는 *방법*이 결과를 가른다.

## 2. 리뷰가 뒤집은 것 (2026-07-14)

계획 초안은 "선언을 `T | null`로 바꾸고 드러나는 73곳에 개별 가드를 넣는다"(A안)였다. CEO·Eng 리뷰가 이를 실측으로 반박했다.

**첫째, 지뢰는 3곳이 아니라 16곳이다.** 조기 return이 상태 전이를 반쪽만 실행시키는 자리를 기계적으로 세어 보니 16곳이었다. 초안이 알던 3곳 외에 이런 것들이 있다.

| 자리 | 기계적 조기 return을 넣으면 |
|------|---------------------------|
| `GameManager.update():97` | 승리 전이 직전에 `WaveManager`를 읽는다 → 타이머가 0에 박힌 채 **런이 영원히 끝나지 않는다.** 발견하려면 15분을 앉아 있어야 한다 |
| `GameManager._onDataReady():117-118` | `_started = true` 다음 줄들이다 → 게임은 부팅되는데 **웨이브가 영영 시작되지 않고 레벨업 콜백도 안 걸린다** |
| `ExperienceManager.start():53` | `_logic`이 null로 남는다 → **경험치가 영영 쌓이지 않는다** |
| `SpellCaster.start():146` · `PlayerController.start():28` | `_dataReady`가 안 켜진다 → **마법을 안 쏘고 플레이어가 안 움직인다** |
| `EnemyProjectile.init():59` · `EnemyController.reset():212` | 풀링 노드 재초기화 중간이다 → `_despawned`·`_data`가 **이전 생의 값으로 남아** 죽지 않는 발사체·엉뚱한 적 종류가 된다 |

전부 **에러 없이 "돌아가는 것처럼 보이는"** 실패다. 그리고 이 목록은 눈으로 훑어서는 다시 놓친다.

**둘째, 73곳 중 약 85%는 null이 도달할 수 없는 자리다.** Cocos는 노드·컴포넌트 파괴를 **프레임 끝으로 미루고**, `enabled = false`나 노드 비활성화는 `onDisable`을 부르지 `onDestroy`를 부르지 않는다. `instance`는 `onDestroy`에서만 null이 된다. 따라서 `update()`가 도는 동안 매니저가 사라지는 일은 구조적으로 없다. 실제로 null이 오는 자리를 분류하면 이렇다.

| 구간 | 개수 | 상태 |
|------|------|------|
| 핫패스(`update()`·게임플레이) — 매니저가 전부 살아 있음 | ~60 | null 도달 불가. 여기서 `instance`가 null이면 그건 **배선 실수**지 수명주기 경쟁이 아니다 |
| `onLoad`/활성화 순서 | 0 | 매니저 간 참조는 전부 `start()`에서 일어나고, Cocos는 모든 `onLoad`가 끝난 뒤 `start`를 부른다 |
| teardown(`onDisable`/`onDestroy`) — **null이 실재** | 1 | `EnemyController.onDisable:167` — `497fb90`이 고친 바로 그 자리. **이미 `?.`로 막혀 있다** |
| 다른 씬(result·menu) | 0 | 두 씬에는 `I18n`만 있고, 그 소비자는 전부 이미 가드돼 있다 |

즉 A안은 **도달 불가능한 창을 60개의 새 분기로 방어하면서**, 그 60개 중 하나만 잘못 넣어도 게임을 조용히 죽인다. 위험만 남고 실익이 없다.

**셋째, "던지는 게터"(CEO 대안)는 실행해 보니 더 나쁘다.** `static get instance(): T { if (!_inst) throw ... }` 형태는 `X.instance?.foo()`도 `if (!X.instance) return;`도 **게터가 먼저 던져서** 무력화한다. `497fb90`이 고친 크래시를 같은 경로에서 되살리고, 컴파일러도 Biome도 그 이행을 강제해 주지 못한다. 폐기한다.

## 3. 설계 — C안: 활성화 시 1회 검사 후 캐시

**타입은 정직하게, 검사는 컴포넌트당 한 번, 실패는 시끄럽게.**

```ts
// 매니저 (7개 전부)
static instance: GameManager | null = null;   // I18n.ts:26과 같은 형태
onDestroy() { if (GameManager.instance === this) GameManager.instance = null; }

// 소비 컴포넌트
private _gm: GameManager | null = null;

start() {                                  // Cocos가 모든 onLoad 뒤에 부른다 → instance는 이미 세팅됨
  const gm = GameManager.instance;
  if (!gm) {
    console.error('[Projectile] GameManager 없음 — 씬 배선을 확인하세요. 컴포넌트를 비활성화합니다.');
    this.enabled = false;
    return;
  }
  this._gm = gm;
}

update(dt: number) {
  const gm = this._gm;
  if (!gm) return;                         // 함수 진입부 1회. 아래 모든 참조가 이 하나로 좁혀진다
  if (gm.state !== GameState.Playing) return;
  …
}
```

핫패스는 `GameManager.instance.x` → `gm.x` **기계적 리네임**이 된다. 새 분기는 **함수당 1개**(호출부당 1개가 아니라)이고, 그 하나는 함수 **맨 앞**, 어떤 상태 변경보다도 앞에 있다. **그래서 지뢰 16곳이 설계 문제가 아니라 구조적으로 사라진다** — 상태 전이 중간에 빠져나갈 자리 자체가 생기지 않는다.

컴파일러의 강제력은 그대로다. `const gm = this._gm;` 뒤에 가드를 빼면 `TS18047`이 뜬다.

### 경로별 규칙

| 경로 | 규칙 |
|------|------|
| **핫패스**(`update`와 그에서 불리는 헬퍼) | 캐시 필드를 함수 진입부에서 1회 호이스트 + 조기 return |
| **콜드패스**(버튼 핸들러 등 1회성) | 지역 호이스트. **상태 전이 호출은 항상 시도한다** — 값이 없어도 `gm?.resumeFromLevelUp()`처럼 void 호출로 반드시 실행 |
| **장식적 값**(결과 화면 통계 등) | `?? 폴백` 허용. `GameResult.waveReached = this._wave?.waveNumber ?? 0`은 안전하다 — 틀린 통계지 깨진 게임이 아니다 |
| **게임플레이 값**(쿨다운·피해·반경) | **`?? 폴백` 금지.** `effectiveCooldown ?? 0`은 매 프레임 발사, `damageFactor ?? 0`은 전 마법 피해 0, `pickupRadius ?? 0`은 경험치 영구 미획득이다. 값이 필요하면 호이스트 + 조기 return |
| **teardown**(`onDisable`/`onDestroy`) | **캐시 필드를 쓰지 않는다.** 정적 참조 + `?.` 유지 — 캐시는 이미 파괴된 매니저를 가리킬 수 있다 |
| **클로저**(`onReady(() => …)`·`.map(cb)`) | 내로잉이 살아남지 않으므로 클로저 **안에서 다시** 호이스트한다. 여기에 `this.isValid` 가드도 함께 |
| **매니저가 없을 때** | 컴포넌트당 **1회** `console.error` + `this.enabled = false`(loud-fail). 핫패스에서 매니저 부재는 배선 실수이므로 조용한 no-op 60개가 아니라 부팅 시 큰 소리 하나가 맞다 |

**캐시가 안전한 근거:** `addPersistRootNode` 사용이 0건이라 모든 소비 컴포넌트의 수명이 자기 씬의 수명 안에 들어간다. 풀링 노드도 현재 씬 트리에 `instantiate`되므로 같은 경계 안이다. 따라서 캐시된 참조가 씬을 건너뛰어 낡을 수 없다. **persist root node를 도입하면 이 전제가 깨진다** — `conventions.md`에 그 조건을 함께 적는다.

### 개별 설계가 필요한 자리

C안이 지뢰를 없애지만, 세 자리는 여전히 손으로 설계한다.

**`CardSelectPanel._onPickCard()`** — 초안의 규칙("하나라도 없으면 카드 적용을 시작하지 않는다")은 그 자체로 모순이었다. `DeckManager`만 없어도 `resumeFromLevelUp()`에 도달하지 못해 **패널이 열린 채 영구 정지**한다. 올바른 처리는 카드 적용은 건너뛰되 **재개는 무조건 실행**하는 것이다.

```ts
private _onPickCard(idx: number): void {
  const card = this._drawnCards[idx];
  if (!card) return;
  const deck = DeckManager.instance;
  if (card.type === 'magic' && card.spellId) SpellCaster.instance?.addSpell(card.spellId);
  else if (deck) deck.applyCard(card);
  else console.error('[CardSelectPanel] DeckManager 없음 — 카드 적용을 건너뛰고 재개합니다.');
  …
  GameManager.instance?.resumeFromLevelUp();   // 무슨 일이 있어도 재개
}
```

또한 이 패널은 `active = false`로 시작해 **`onEnable`이 `start`보다 먼저** 돈다. 호이스트를 `start()`에 일괄로 넣는 방식이 여기만 조용히 빗나가므로 `onEnable`에서 처리한다.

**`GameManager._onDataReady()`** — 이 슬라이스에서 가장 위험한 함수다. 8줄 안에 치명 지뢰가 셋이고 전부 `_started = true` 뒤에 온다. `_started`·`setOnLevelUp`·`startWave()`는 **한 덩어리로 성공하거나 한 덩어리로 실패**해야 한다. 필요한 매니저를 클로저 진입부에서 전부 호이스트하고, 하나라도 없으면 `_started`를 켜지 않은 채 loud-fail한다.

**`ExperienceManager._pickupRadius`** — 화살표 함수 필드(`() => number`)라 조기 return을 쓸 수 없고, `?? 0`으로 폴백하면 픽업 반경이 0이 되어 **경험치를 영영 못 줍는다**(계획이 금지한 바로 그 패턴). 데이터 준비 시점에 기본 반경을 필드로 캐시해 화살표 함수가 싱글톤을 역참조하지 않게 만든다. XP 아이템은 데이터 준비 이후에만 생기므로 순서가 보장된다.

## 4. 함께 닫는 것

- **F3 — `resources.load` 콜백 널 가드.** `DataManager._load`와 `I18n`이 `asset`을 검사 없이 쓴다. 주의: Cocos 타입 정의상 `asset`이 non-nullable이라 **타입체크가 이걸 강제해 주지 않는다** — 손으로 넣어야 한다. 그리고 `!asset`만이 아니라 `asset.json == null`까지 봐야 한다(`JsonAsset.json`이 nullable이고, 지금 `resolve(asset.json as T)`가 null을 그대로 흘려보낸다).
- **`DataManager` 콜백 누수.** `_loadAll()`이 비동기인데 `onDestroy()`가 `_onReadyCallbacks`를 비우지 않는다. 로딩 중 재시작하면 파괴된 옛 컴포넌트의 콜백이 나중에 발화하고, 그때 `DataManager.instance`는 null이 아니라 **새 씬의 인스턴스**다 — 옵셔널 체이닝으로는 절대 못 잡는다. `onDestroy`에서 목록을 비우고, 5개 `onReady` 클로저 안에 `this.isValid` 가드를 넣는다.
- **`I18n` 콜백 누수 (신규).** 똑같은 버그가 `I18n.ts:46`에도 있다 — `onDestroy`가 `_onReadyCallbacks`도 `_registry`도 비우지 않는다. `ResultController`가 `render` 클로저를 등록하므로, 카탈로그 로딩 중 result 씬을 떠나면 파괴된 컴포넌트의 Label에 쓴다. 같은 부류이므로 같이 닫는다.
- **데이터 로드 실패를 시끄럽게 (신규).** `DataManager._loadAll`의 `catch`가 `console.error`만 찍고 `_isReady`를 세우지 않아, 모든 `onReady` 콜백이 영영 버려진다 → 게임이 시작도 안 하고 플레이어도 안 움직이는데 화면엔 아무 안내가 없다. F3을 넣으면 이 `catch`로 떨어지는 경로가 오히려 늘어난다. `I18n`처럼 실패해도 눈에 보이게 만든다.
- **`DataManager` 게터 정직화.** `playerData`·`xpData`·`mapData`가 `as`로 null을 지운다(두 번째 거짓말 층). 정직한 타입으로 바꾸면 호출부 10곳이 드러나는데, 이 null은 **도달 가능하다** — 위 콜백 누수 경로에서 실제로 null인 게터를 읽는다.
- **F44 — `approve-pr`이 타입체크를 실측.** 지금은 `ts_check_scope` **기록**만 본다. `verification`에서는 스크립트 편집이 허용되므로 `pass ts` 뒤에 코드를 고치고 `invalidate`를 잊으면 타입이 깨진 채 머지된다. `approve-pr`이 `runTypecheck()`를 직접 돌리게 한다. 단, 두 가지를 빠뜨리면 안 된다 — ① 신선한 결과가 `scope === "full"`인지까지 봐야 한다(Cocos 미실행 머신에서 `logic-only`로 통과하면 게이트가 무의미해진다), ② 상태 파일의 `ts_check_scope`를 새 결과로 **덮어쓴다**.

## 5. 변경 대상

**매니저 선언 7개** — `GameManager`·`DataManager`·`DeckManager`·`ExperienceManager`·`WaveManager`·`MapManager`·`SpellCaster`.

**소비 컴포넌트 (캐시 + 호이스트)** — `systems/`(`EnemySpawner`·`WaveManager`·`ExperienceManager`·`DeckManager`·`GameManager`·`MapManager`), `components/`(`SpellCaster`·`PlayerController`·`EnemyController`·`EnemyProjectile`·`Projectile`·`XPItemController`), `ui/`(`HudController`·`CardSelectPanel`·`PauseController`·`ResultController`·`LocalizedLabel`). `CameraController`도 `MapManager.instance`를 읽지만 이미 `?.`라 변경이 없을 수 있다(타입체크가 판정한다).

**수명주기** — `DataManager`(콜백 정리 + 게터 정직화 + `_load` 널 가드 + 로드 실패 loud-fail), `I18n`(같은 셋).

**툴체인** — `.claude/workflow.mjs`(F44).

**문서** — `conventions.md` 싱글톤 절을 C안 패턴으로 교체(캐시 전제인 "persist root node 없음"도 함께 명시), `backlog-implement.md`에서 F24·F3·F44를 완료 아카이브로, `docs/qa/singleton-null-test.md` 신규.

## 6. 테스트 전략 — 스킵

새로 만드는 순수 로직이 없다. 변경은 싱글톤 선언, cc 의존 컴포넌트의 캐시·호이스트, `DataManager`·`I18n` 수명주기, 워크플로우 CLI뿐이다. 대상 파일은 전부 `systems/`·`components/`·`ui/`라 vitest 커버리지가 0%이고 이 슬라이스가 그 사실을 바꾸지 않는다. 기존 전체 스위트는 계속 초록이어야 한다(`logic/`을 안 건드리므로).

그물은 두 겹이다.

1. **타입체크** — 가드의 **존재**를 강제한다. 다만 한계를 정확히 알고 쓴다. TypeScript의 내로잉은 함수 호출을 건너뛰어도 유지되므로(불건전하지만 사실이다), 게이트가 보장하는 것은 "**흐름당 가드 하나**"지 "73곳 각각의 가드"가 아니다.
2. **수동 플레이스루(7단계)** — 타입체크는 가드의 **의미**를 증명하지 않는다. 위 실패들은 전부 타입체크 초록불이고, 대부분 **에러 없이 조용하다**. QA 체크리스트가 유일한 그물이므로 다음을 **이름으로** 박는다.
   - 콜드 부팅: 웨이브 1이 실제로 시작되는가 · 경험치가 쌓이는가 · 마법이 발사되는가 · 플레이어가 움직이는가 (전부 조용한 실패 모드다)
   - 사망 → 결과 화면 · 카드 픽 → 재개 · 레벨업 → 재개
   - **승리(타이머 0:00) → 결과 화면** (15분이 걸리므로 `gameDuration`을 임시로 줄여 확인하는 절차를 QA 문서에 적는다)
   - 풀링 재사용: 적을 죽인 뒤 다음 적·다음 발사체가 정상 동작하는가
   - 로딩 중 재시작(일시정지 메뉴 → 재시작 연타)에서 콘솔 에러가 없는가

## 7. 리스크

**가장 큰 위험은 여전히 "타입은 통과하는데 조용히 죽는" 것이다.** C안은 조기 return을 함수 진입부로 몰아 이 위험을 구조적으로 줄이지만, 개별 설계가 필요한 세 자리(`_onPickCard`·`_onDataReady`·`_pickupRadius`)는 손으로 맞춰야 한다.

**두 번째는 teardown 경로에서 캐시 필드를 쓰는 실수다.** `onDisable`/`onDestroy`에서 `this._gm`을 쓰면 이미 파괴된 매니저를 가리킬 수 있다. 그 경로는 정적 참조 + `?.`를 유지한다. `conventions.md`에 규칙으로 박는다.

**세 번째는 `enabled = false`와 풀링의 상호작용이다.** loud-fail로 컴포넌트를 끄면 풀에서 재사용될 때도 꺼진 채로 남는다. 다만 이 경로는 이미 배선이 깨진 상태이므로 감수한다.
