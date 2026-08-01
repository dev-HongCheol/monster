# 창 포커스 유실 시 이동키 고착 봉합 — 계획

- **작성일:** 2026-08-01
- **브랜치:** feat/input-focus-reset
- **상태:** 구현·검증·코드리뷰 통과 (2026-08-01). 7단계 사용자 검증 대기
- **닫는 백로그:** [`../backlog-implement.md`](../backlog-implement.md) **F65**(창 포커스를 잃으면 눌린 이동키가 고착된다), **F63**(`hitbox-viewer.html` biome 에러 4건)
- **근거:** Cocos Creator 3.8.8 번들 엔진 소스 직접 확인(`pal/input/web/keyboard-input.ts`, `pal/system-info/web/system-info.ts`), `game/assets/scripts/components/PlayerController.ts`

---

## 1. 이 슬라이스가 하는 일

이동키를 누른 채 다른 앱 창으로 포커스를 옮겼다 돌아오면 캐릭터가 그 방향으로 계속 걷고, 반대 방향 키가 먹지 않는다. 이 슬라이스는 **포커스를 잃는 순간 눌린 것으로 기록된 이동키를 전부 해제**해서 그 고착을 없앤다.

같이 하는 일이 두 가지 더 있다. 하나는 눌린 키 상태를 순수 모듈로 꺼내 이 동작을 자동 테스트로 고정하는 것이고(§4), 다른 하나는 전체 `pnpm check`를 막고 있던 디버그 뷰어의 lint 에러를 닫는 것이다(§7).

## 2. 진단 — 왜 눌린 키가 남나

Cocos의 웹 키보드 입력은 키 이벤트를 **`GameCanvas` 엘리먼트에만** 건다. 번들된 엔진 소스가 그대로 보여 준다.

```ts
// pal/input/web/keyboard-input.ts — KeyboardInputSource._registerEvent()
const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
canvas?.addEventListener('keydown', this._handleKeyboardDown.bind(this));
canvas?.addEventListener('keyup', this._handleKeyboardUp.bind(this));
```

키 이벤트는 **포커스를 가진 엘리먼트**로 배달된다. 그래서 W를 누른 채 다른 앱 창을 클릭하면 포커스가 캔버스를 떠나고, 그 뒤에 손을 뗀 `keyup`은 캔버스가 아니라 새로 포커스를 가져간 쪽으로 간다. 캔버스는 그 이벤트를 못 받으므로 `PlayerController._onKeyUp`이 호출되지 않고, `_keyUp` 플래그가 `true`로 남는다.

여기서 증상이 **반대 방향만 죽는** 특이한 모양이 되는 이유가 나온다. 이동 벡터는 마주 보는 두 축의 뺄셈이다.

```ts
// PlayerController._updateMoveDir()
(this._keyUp ? 1 : 0) - (this._keyDown ? 1 : 0)
```

`_keyUp`이 `true`로 굳은 상태에서 아래키를 누르면 y가 `1 - 1 = 0`이 되어 캐릭터가 제자리에 선다. 반면 좌우는 다른 축이라 이 뺄셈에 끼지 않으므로 멀쩡히 움직인다. 그래서 "위로 계속 걷는데 아래키만 안 먹고 좌우는 정상"으로 보인다.

**피해는 조작 불편에서 끝나지 않는다.** 포커스가 떠난 뒤에도 게임은 계속 돌기 때문에(§3), 사용자는 다른 창을 보는 동안 캐릭터가 혼자 한 방향으로 걸어가 적에게 맞고 있는 상태로 돌아온다.

## 3. 왜 `Game.EVENT_HIDE`로는 못 막나

엔진이 "숨겨졌다"고 알려 주는 신호가 있으니 그걸 쓰면 될 것 같지만, 실제 재현 경로를 못 덮는다. 엔진이 그 이벤트를 어디에 거는지가 이유다.

```ts
// pal/system-info/web/system-info.ts — SystemInfo._registerEvent()
if (typeof document.hidden !== 'undefined') {
  hiddenPropName = 'hidden';
} else if (/* ... 벤더 접두사 세 갈래 ... */) {
} else {
  hiddenPropName = 'hidden';        // 마지막 갈래도 값을 넣는다
}

if (hiddenPropName) {
  // visibilitychange 계열만 등록
} else {
  window.addEventListener('blur', onHidden);   // 여기로는 못 온다
}
```

`hiddenPropName`은 **어느 갈래로 가든 값이 채워지므로 항상 참**이다. 그래서 `else` 가지의 `window` `blur` 등록은 어떤 브라우저에서도 실행되지 않는다. 백로그 F65는 이걸 "구형 브라우저용 폴백"이라고 적었는데, 실제로는 폴백으로도 동작하지 않는 죽은 코드다.

남는 발화 조건은 `visibilitychange`와 `pagehide`뿐이고, 둘 다 **문서가 실제로 숨겨져야** 뜬다. 탭을 바꾸거나 창을 최소화하면 뜨지만, **다른 앱으로 전환하는 경우엔 탭이 화면에 그대로 보이므로 뜨지 않는다.** 우리가 고치려는 재현 경로(Alt+Tab, 알림 팝업, 게임 밖 클릭)가 정확히 그 경우다.

그래서 봉합은 **우리 코드가 포커스 유실을 직접 듣는 것**이어야 한다. `Game.EVENT_HIDE`는 그것을 대신하지 못하고, 브라우저가 아닌 플랫폼에서 백그라운드로 들어가는 경우를 함께 덮는 보조로만 건다.

### 3.1 포커스를 잃는 경로가 하나가 아니다 (리뷰에서 발견)

초안은 `window`의 `blur` 하나만 들으려 했는데, 그것으로는 절반만 덮인다. 캔버스가 **독립적으로 포커스를 갖는 요소**이기 때문이다 — 빌드 템플릿이 `tabindex`를 붙여 내보낸다.

```html
<!-- templates/web-desktop/index.ejs -->
<canvas id="GameCanvas" width="..." height="..." tabindex="99"></canvas>
```

`window`의 `blur`는 **창 전체**가 포커스를 잃을 때 뜬다. 그래서 페이지 안에서 캔버스 바깥을 클릭하면 — 빌드된 페이지는 캔버스가 레터박스로 놓여 여백이 넓으므로 어렵지 않게 일어난다 — 창은 포커스를 유지한 채 **캔버스만** 포커스를 잃는다. 이때 `window` `blur`는 뜨지 않지만 `keyup`은 여전히 캔버스로 오지 않으므로, 초안대로면 이 경로에서 버그가 그대로 남는다.

캔버스는 `game.canvas`로 얻는다. 공개 API이고 타입이 `HTMLCanvasElement | null`이라 브라우저가 아닌 플랫폼에서는 자연스럽게 건너뛴다. `document.getElementById('GameCanvas')`로 id를 손으로 적는 것보다 안전하다.

세 신호를 모두 거는 이유는 서로 덮는 범위가 다르기 때문이다.

| 신호 | 덮는 경우 | v1에서 실제로 발화하나 |
|------|-----------|----------------------|
| `game.canvas`의 `blur` | 캔버스가 포커스를 잃는 모든 경우. `keyup` 유실의 **정확한 조건**이라 원칙적으로 이것 하나로 충분하다 | **발화한다** — §3.2 |
| `window`의 `blur` | 다른 앱이 포커스를 가져가는 주 재현 경로. 창 비활성화 때 요소의 `blur`까지 발화시키는지는 브라우저마다 다를 수 있어, 주 경로를 브라우저 동작 추측에 맡기지 않으려고 함께 건다 | **발화한다** — §3.2 |
| `Game.EVENT_HIDE` | 브라우저가 아닌 플랫폼의 백그라운드 진입(`window`도 `game.canvas`도 없는 환경) | **아니다** — 아래 참고 |

세 핸들러가 같은 일을 하고 해제는 여러 번 불러도 결과가 같으므로, 겹쳐 발화해도 부작용이 없다.

`Game.EVENT_HIDE`와 `sys.isBrowser` 가드는 **v1에서는 실행되지 않는 방어**다. v1 배포 대상이 웹뿐이라 `sys.isBrowser`는 항상 참이고, 탭 전환·최소화는 `window`의 `blur`가 이미 잡는다. 그래도 넣는 이유는 두 줄에 불과하고 v2가 네이티브로 갈 경우 그때 필요해지기 때문이지, 지금 뭔가를 막고 있어서가 아니다. 이 구분을 적어 두지 않으면 나중에 읽는 사람이 "이게 지금 어떤 버그를 막고 있구나"라고 잘못 믿고 함부로 못 건드리게 된다.

### 3.2 배포 환경이 두 경로를 모두 밟는다

**배포 경로의 정본은 [`../build-and-distribution.md`](../build-and-distribution.md)다.** 사용자 행동별로 어느 신호가 뜨는지의 대응표는 그 문서 §4에 있고, 여기서는 이 슬라이스의 판단에 필요한 결론만 적는다.

세 가지가 확인됐다.

1. **이 버그는 배포본에 들어간다.** `cc.config.json`의 web 플랫폼 블록이 `pal/input`을 `pal/input/web/index.ts`로 매핑한다 — §2·§3에서 읽은 그 코드가 웹 빌드에 실린다.
2. **캔버스는 실제 산출물에서도 독립 포커스를 갖는다.** 2026-08-01 첫 웹 빌드로 생성된 `index.html`에 `<canvas id="GameCanvas" ... tabindex="99">`가 그대로 있다(build-and-distribution §6.3). 템플릿상의 이야기가 아니다.
3. **v1 배포처인 itch.io는 게임을 iframe으로 얹고, 그 위에 전체화면 버튼을 겹쳐 그린다.** 주변 페이지에도 댓글·링크가 있다. 그래서 §3.1의 두 경로가 모두 일상 동선이며, 특히 **itch가 얹는 전체화면 버튼을 누르는 것**이 캔버스만 포커스를 잃게 만드는 가장 흔한 경우다.

## 4. 설계 결정

### 결정 1 — 눌린 키 상태를 `logic/MoveInputLogic.ts`로 꺼낸다

지금 눌린 키는 `PlayerController`의 불리언 4개이고, 이동 벡터 계산도 그 안에 있다. 이대로 두면 이 슬라이스에 순수 로직이 하나도 없어 테스트 파일 없이(`pnpm wf skip-test`) 가야 하고, **"해제 뒤 반대 방향이 즉시 먹는다"를 자동으로 확인할 방법이 사라진다.** 이 버그의 핵심 증상이 바로 그 지점이라 회귀 그물이 없는 건 아깝다.

상태와 벡터 계산을 순수 모듈로 옮기면 그 시퀀스를 테스트로 못 박을 수 있다. `FacingLogic`·`FootprintLogic`이 이미 같은 모양이라 새 패턴을 들이는 것도 아니다.

### 결정 2 — `KeyCode` 매핑은 컨트롤러에 남긴다

`logic/`은 **cc를 import하지 않는 순수 TypeScript**가 규칙이다([conventions.md § 폴더 구조](../conventions.md#폴더-구조)). `KeyCode`는 cc의 enum이므로 모듈이 그것을 받으면 규칙이 깨진다.

숫자 코드를 모듈이 자체 상수로 들고 있는 방법도 있지만, 그러면 cc의 `KeyCode` 값을 손으로 베껴 두는 셈이라 엔진이 값을 바꾸면 조용히 어긋난다. 그래서 **컨트롤러가 `KeyCode`를 `'up' | 'down' | 'left' | 'right'` 축 이름으로 옮기고**, 모듈은 그 축 이름만 받는다. 매핑은 `switch` 한 덩어리라 눈으로 검사된다.

### 결정 3 — 해제 핸들러는 화살표 프로퍼티로 둔다

`window.removeEventListener`는 **등록할 때와 같은 함수 참조**를 줘야 해제된다. `this._onFocusLost.bind(this)`를 등록 시점에 만들면 매번 새 함수가 나와 `onDestroy`에서 아무것도 못 지우고, 씬을 다시 로드할 때마다 죽은 컴포넌트를 붙든 리스너가 쌓인다. 이것은 이미 겪은 적 있는 유형의 사고다(`DataManager`·`I18n` 콜백 누수, 백로그 F24 아카이브).

그래서 핸들러를 클래스 필드의 화살표 함수로 두어 참조가 인스턴스당 하나로 고정되게 한다.

### 결정 4 — 대각선 정규화는 곱셈 상수로 바꾼다

현재는 `Vec3.lengthSqr() > 1`을 검사하고 `Vec3.normalize()`를 부른다. 순수 모듈은 cc를 못 쓰므로 같은 결과를 직접 계산한다 — 두 축이 모두 0이 아니면(=대각선) 각 성분에 `Math.SQRT1_2`를 곱한다. 조건 `lengthSqr > 1`이 성립하는 경우는 대각선뿐이라(단일 축이면 1, 무입력이면 0) 동작은 같다(→ **§9 정정**: 부동소수 마지막 자리에서 1 ULP 차이는 있다).

## 5. 파일별 변경

| 파일 | 변경 |
|------|------|
| `game/assets/scripts/logic/MoveInputLogic.ts` | **신규.** 축 이름 타입, 눌린 키 상태, `setMoveKey`·`releaseAllMoveKeys`·`moveInputToVector` |
| `game/assets/scripts/components/PlayerController.ts` | 불리언 4개 → 모듈 상태로 교체, `KeyCode` → 축 매핑, 포커스 유실 신호 세 개 구독·해제 |
| `tests/logic/InputFocusReset.test.ts` | **신규.** 해제 후 반대 방향 즉시 반응, 대각선 정규화, 축 매핑 왕복 |
| `docs/qa/input-focus-reset-test.md` | **신규.** 수동 재현·검증 체크리스트 |
| `hitbox-viewer.html` | biome 에러 4건 수정(§7) |
| `docs/development/build-and-distribution.md` | **신규(계획 이후 추가).** §3.2가 의존하는 배포 경로의 정본. 이 슬라이스 조사 중에 만들었고 CLAUDE.md 지식 베이스에 색인했다 |

`MoveInputLogic`의 겉모습은 이렇다.

```ts
export type MoveKey = 'up' | 'down' | 'left' | 'right';
export interface IMoveInputState { up: boolean; down: boolean; left: boolean; right: boolean; }

export function createMoveInputState(): IMoveInputState;
export function setMoveKey(state: IMoveInputState, key: MoveKey, pressed: boolean): void;
export function releaseAllMoveKeys(state: IMoveInputState): void;
export function moveInputToVector(state: IMoveInputState, out: { x: number; y: number }): void;
```

`moveInputToVector`가 결과 객체를 만들어 돌려주지 않고 `out`에 쓰는 이유는, 이 함수가 **매 프레임 호출**되기 때문이다. 프레임마다 객체를 새로 만들면 발사체 핫패스에서 이미 지적된 것과 같은 종류의 할당 압박이 생긴다(백로그 F36). 호출부는 기존 `_moveDir`(Vec3)을 그대로 넘긴다 — `Vec3`가 `x`·`y`를 숫자 프로퍼티로 갖고 있어 구조가 맞는다.

이때 **`z`는 건드리지 않는다.** 지금 코드는 `set(x, y, 0)`으로 `z`에 0을 쓰지만 `_moveDir.z`는 어디서도 0이 아닌 값이 되지 않으므로(생성 시 0, 이후 `x`·`y`만 읽힌다) 동작은 같다. 다만 읽는 사람이 "이 함수가 벡터 전체를 관리한다"고 오해하면 나중에 `z`를 쓰는 코드를 넣었을 때 조용히 낡은 값을 읽게 되므로, JSDoc에 `z`를 손대지 않는다고 명시한다.

포커스 유실 배선은 이렇게 붙는다.

```ts
onLoad() {
  input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
  input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
  if (sys.isBrowser) window.addEventListener('blur', this._onFocusLost);
  game.canvas?.addEventListener('blur', this._onFocusLost);
  game.on(Game.EVENT_HIDE, this._onFocusLost, this);
  // ... 기존 Sprite·반높이 캐시
}

onDestroy() {
  input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
  input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
  if (sys.isBrowser) window.removeEventListener('blur', this._onFocusLost);
  game.canvas?.removeEventListener('blur', this._onFocusLost);
  game.off(Game.EVENT_HIDE, this._onFocusLost, this);
}

/** 포커스를 잃으면 눌린 것으로 기록된 이동키를 전부 해제한다(§2·§3). */
private _onFocusLost = (): void => {
  releaseAllMoveKeys(this._moveInput);
};
```

등록과 해제의 가드 모양을 똑같이 맞춘다. `sys.isBrowser`가 실행 중에 바뀌지는 않지만, 두 곳의 조건이 눈으로 봐서 같아야 "한쪽만 걸려 리스너가 남는" 실수를 리뷰에서 잡을 수 있다.

## 6. 테스트 계획

순수 모듈이 생기므로 테스트를 건너뛰지 않는다. `tests/logic/InputFocusReset.test.ts`에 다음을 담는다.

1. **고착 재현과 해소(이 슬라이스의 중심).** 위로 이동 중인 상태에서 `releaseAllMoveKeys`를 부르고 곧바로 아래키를 누르면 y가 `-1`이 된다. 해제를 부르지 않으면 같은 순서에서 y가 `0`이 되어(두 축이 상쇄) 제자리에 선다 — 버그의 모양을 테스트가 직접 들고 있게 한다.
2. **해제의 전면성.** 네 축을 모두 누른 뒤 `releaseAllMoveKeys` 한 번으로 전부 꺼진다.
3. **대각선 정규화.** 두 축 동시 입력이면 각 성분이 `Math.SQRT1_2`, 단일 축이면 `1`, 무입력이면 `0`.
4. **마주 보는 축 상쇄.** 위아래를 동시에 누르면 y가 `0`이다(기존 동작 보존).
5. **`out` 재사용.** 같은 객체를 두 번 넘겼을 때 이전 값이 남지 않는다.
6. **해제는 여러 번 불러도 같다.** 아무것도 안 눌린 상태에서 `releaseAllMoveKeys`를 불러도 변화가 없다. 신호 세 개가 겹쳐 발화할 수 있으므로(§3.1) 이게 성립해야 한다.

RED 게이트는 모듈이 없는 상태에서 이 파일이 실패하는 것으로 통과시킨다.

**자동 테스트로 못 잡는 것**은 포커스 유실 그 자체다. `blur` 발화와 Cocos 이벤트 배선은 브라우저 환경이 필요하므로 7단계 수동 검증으로 넘긴다. QA 문서에는 §3.1의 두 경로를 **각각** 항목으로 넣는다 — 다른 앱으로 전환(창 포커스 유실)과 페이지 안 캔버스 바깥 클릭(캔버스만 포커스 유실)은 서로 다른 신호가 잡으므로, 하나만 확인하면 나머지 배선이 빠져도 통과해 버린다.

## 7. F63 동반 처리 — `hitbox-viewer.html`

`pnpm check --write`를 레포 전체에 돌리면 이 파일 때문에 종료코드 1이 난다. 슬라이스별 lint 게이트는 변경 파일만 보므로 지금까지 안 걸렸을 뿐이고, 이 슬라이스의 10단계에서 그대로 마주친다.

에러는 정확히 4건이다.

| 위치 | 규칙 | 수정 |
|------|------|------|
| 159:9, 160:9, 207:5 | `lint/a11y/useButtonType` | `<button>`에 `type="button"` 추가 |
| 278:47 | `lint/suspicious/useIterableCallbackReturn` | `forEach` 화살표 본문을 중괄호로 감싸 반환값 제거 |

나머지 29건은 정보 수준(`lint/style/useTemplate`)이라 종료코드에 영향이 없어 건드리지 않는다.

**biome 대상에서 제외하는 대안은 택하지 않는다.** 제외하면 파일이 검사 밖으로 나가 조용히 낡는데, 이 뷰어는 F62 최종 아트가 들어와 히트박스를 다시 재는 시점에 또 쓸 도구다. 4줄 고치는 쪽이 싸다.

## 8. 스코프 밖

- **다른 입력 소비처의 포커스 정책.** `PauseController`는 `KEY_DOWN`만 듣는 엣지 트리거라 눌린 상태를 갖지 않는다. 이 버그의 영향권 밖이고, 지금 소비처가 둘뿐이라 전역 입력 매니저로 올릴 근거가 아직 없다.
- **키 리바인딩·게임패드.** 축 이름 타입이 나중에 그쪽 토대가 될 수 있지만 이 슬라이스에서 만들지 않는다.
- **`hitbox-viewer.html`의 정보 수준 지적 29건.** 종료코드에 영향이 없다.

## 9. 리스크

- **DOM API 첫 사용.** `game/assets/scripts/` 어디에도 `window`·`document`를 직접 부르는 전례가 없다. 브라우저가 아닌 플랫폼에서 `window`가 없으므로 `sys.isBrowser` 가드 없이 부르면 그 플랫폼에서 터진다. 가드를 등록·해제 **양쪽 모두**에 건다(한쪽만 걸면 해제가 건너뛰어져 리스너가 남는다). 캔버스 쪽은 `game.canvas`의 타입이 이미 nullable이라 `?.`가 같은 일을 한다.
- **리스너 해제 누락.** 결정 3의 화살표 프로퍼티가 이걸 막는다. `onDestroy`에서 세 신호를 모두 해제하는지 코드 리뷰에서 확인한다.
- **두 포커스 경로 중 하나만 배선.** §3.1에서 드러난 대로 창 포커스와 캔버스 포커스는 다른 사건이다. 한쪽만 걸면 다른 쪽 경로에서 버그가 그대로 남는데 **자동 테스트가 못 잡는다**(둘 다 브라우저 환경 필요). QA 체크리스트에서 두 항목으로 분리해 방어한다(§6).
- **동작 동등성.** 이동 벡터 계산을 옮기는 과정에서 기존 동작이 바뀌면 조작감이 통째로 흔들린다. 대각선·단일 축·상쇄·무입력 네 경우를 테스트가 고정한다(§6).
- **받아들인 동작 변화 하나 (코드 리뷰에서 발견, 2026-08-01).** 위 네 경우는 같지만, **키를 계속 누른 채 포커스가 돌아오는 경우**는 이전과 다르다. 브라우저가 이미 눌려 있는 키의 `keydown`을 다시 보내지 않으므로, 해제한 기록을 되살릴 방법이 없어 캐릭터가 멈춘 채로 있다(그 키를 한 번 떼었다 다시 누르면 움직인다). 고치기 전에는 계속 걸었다. 고착을 없애려면 피할 수 없는 비용이고 같은 문제를 고치는 게임이 모두 같은 선택을 하지만, **적어 두지 않으면 7단계에서 회귀로 신고돼 불필요한 리워크를 부른다.** QA 항목 B-6이 이것을 「의도된 동작」으로 명시한다.
- **부동소수 1 ULP 차이.** `Math.SQRT1_2` 곱셈은 `Vec3.normalize()`가 만들던 값과 마지막 자리에서 약 1.1e-16 어긋난다(§4 결정 4의 "동작은 같다"를 리뷰가 정정). 프레임당 변위 차이가 그 규모라 화면에 드러나지 않고 방향 판정도 영향받지 않지만, 정확한 동등성을 단언하는 테스트를 쓰면 깨진다 — 모듈 상수와 테스트 주석에 적어 뒀다.

---

## 10. 구조

```
  [Cocos 입력]                    [포커스 유실 신호]
  input KEY_DOWN/KEY_UP        window.blur   canvas.blur   Game.EVENT_HIDE
        │                            └──────────┼──────────────┘
        │                                       │
        ▼                                       ▼
  PlayerController._onKeyDown/_onKeyUp    _onFocusLost
        │  KeyCode → MoveKey 매핑                │
        └───────────────┬───────────────────────┘
                        ▼
        logic/MoveInputLogic  (cc 없음 · 테스트 대상)
          setMoveKey / releaseAllMoveKeys / moveInputToVector
                        │
                        ▼  _moveDir(Vec3)에 기록
        PlayerController.update
          ├─ FacingLogic.facingFromMoveDir  (방향 판정 — 무변경)
          └─ _move → FootprintLogic          (이동 해소 — 무변경)
```

`FacingLogic`과 `FootprintLogic`은 이 슬라이스에서 손대지 않는다. 둘 다 `_moveDir`을 입력으로 받으므로, 그 값을 만드는 방식만 바뀌고 소비하는 쪽은 그대로다.

## 11. 검증 경로 대응표

| 새 경로 | 무엇이 검증하나 |
|---------|----------------|
| `setMoveKey` 누름·해제 | 순수 테스트 §6-1·§6-4 |
| `releaseAllMoveKeys` | 순수 테스트 §6-1·§6-2·§6-6 |
| `moveInputToVector` 대각선·단일·무입력 | 순수 테스트 §6-3·§6-5 |
| `KeyCode` → `MoveKey` 매핑 | 순수 테스트로는 못 잡는다(cc enum) — 7단계에서 WASD·방향키 8방향 이동으로 확인 |
| `window.blur` 배선 | 7단계 수동 — 다른 앱으로 전환 후 복귀 |
| `canvas.blur` 배선 | 7단계 수동 — 페이지 안 캔버스 바깥 클릭 후 복귀 |
| `Game.EVENT_HIDE` 배선 | 7단계 수동 — 탭 전환·최소화 후 복귀 |
| `onDestroy` 해제 | 7단계 수동 — 재시작을 두세 번 반복해도 이동이 정상인지 |

---

## GSTACK REVIEW REPORT

`/autoplan` 파이프라인. UI 스코프 없음(디버그 뷰어의 `<button>`은 게임 UI가 아님) → 디자인 페이즈 생략. 개발자 대상 산출물 없음(게임이지 개발 도구가 아님) → DX 페이즈 생략. **외부 목소리 없음** — `codex` 미설치이고 서브에이전트를 띄우지 않았다. 단일 리뷰어 모드이므로 교차 검증 강도는 평소보다 낮다.

### 전제 확인

| # | 전제 | 판정 |
|---|------|------|
| 1 | 봉합은 우리 코드가 포커스 유실을 직접 들어야 한다 | **확인** — 엔진 소스로 `Game.EVENT_HIDE` 경로가 창 전환을 못 덮음을 확인(§3) |
| 2 | `PlayerController`가 눌린 키를 쥔 유일한 곳이다 | **확인** — `PauseController`는 `KEY_DOWN` 엣지만 듣는다 |
| 3 | 지금 고칠 값어치가 있다 | **확인** — 코드 백로그의 유일한 `높음`, 항상 재현, 배포본 포함 |

### 이미 있는 것 (새로 만들지 않는다)

- `logic/FacingLogic.ts`·`logic/FootprintLogic.ts` — 순수 모듈의 형태와 JSDoc 밀도 기준
- `PlayerController._updateMoveDir()` — 옮길 벡터 계산 본체(새로 쓰지 않고 이동)
- `game.canvas` — 캔버스를 얻는 공개 API(id 하드코딩 불필요)
- Cocos `mouse-input.ts`가 캔버스 클릭 시 `focus()`를 다시 준다 — 복귀 동선은 엔진이 이미 처리

### 엔지니어링 리뷰에서 고친 것

| # | 심각도 | 발견 | 조치 |
|---|--------|------|------|
| E1 | 높음 | 초안이 `window.blur` 하나만 들어, 페이지 안에서 캔버스 바깥을 클릭하는 경로를 놓쳤다. 캔버스가 `tabindex`로 독립 포커스를 갖기 때문이다. v1 배포 대상이 itch.io 웹(게임을 iframe으로 임베드)이라 이 경로가 이론이 아니라 일상 동선이다 | §3.1·§3.2 신설, `game.canvas`의 `blur` 추가 |
| E2 | 중 | 캔버스를 `document.getElementById('GameCanvas')`로 얻으면 id를 손으로 적는 셈이라 템플릿이 바뀌면 조용히 끊긴다 | 공개 API `game.canvas`로 확정 |
| E3 | 중 | `moveInputToVector`가 `z`를 안 건드리는데 그게 계약에 안 드러나면, 나중에 `z`를 쓰는 코드가 낡은 값을 읽는다 | JSDoc에 명시하기로 §5에 기록 |
| E4 | 낮음 | 신호 세 개가 겹쳐 발화하므로 해제가 여러 번 불릴 수 있다 | 테스트 §6-6 추가 |
| E5 | 낮음 | 등록·해제 가드 모양이 다르면 리스너 누락을 눈으로 못 잡는다 | §5에 동일 가드 규칙 기록 |

### 스코프 밖으로 미룬 것

§8에 적은 세 가지(다른 입력 소비처의 포커스 정책, 리바인딩·게임패드, 정보 수준 lint 29건). 백로그에 새로 추가할 항목은 없다 — 전부 기존 항목이거나 현재 근거가 없는 가정이다.

### 결정 기록

| # | 페이즈 | 결정 | 분류 | 근거 |
|---|--------|------|------|------|
| 1 | 방향 | 순수 모듈 추출(인라인·전역 매니저 기각) | 사용자 판단 | 2026-08-01. 회귀 테스트 확보 + RED 게이트 정상 통과 |
| 2 | 방향 | F63 동반 처리 | 사용자 판단 | 2026-08-01. 이 슬라이스 lint 게이트에서 실제로 마주치는 잔해 |
| 3 | Eng | 포커스 신호 세 개 모두 구독 | 자동 | 겹쳐 발화해도 무해하고, 한 신호에 브라우저 동작을 걸지 않는다 |
| 4 | Eng | `KeyCode` 매핑은 컨트롤러에 잔류 | 자동 | `logic/`은 cc import 금지(conventions.md § 폴더 구조) |
| 5 | Eng | 대각선 정규화를 `Math.SQRT1_2` 곱으로 | 자동 | cc의 `Vec3.normalize` 없이 같은 결과, 할당 없음 |
| 6 | Eng | F63은 수정(제외 아님) | 자동 | 제외하면 검사 밖에서 낡는다. F62 히트박스 재측정 때 다시 쓸 도구 |
