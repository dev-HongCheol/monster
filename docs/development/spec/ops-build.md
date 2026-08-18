# 빌드 산출물과 배포 경로

> 이 게임이 **어떤 형태로 만들어져 어디로 나가는지**의 정본. 출시 준비(로드맵 17주차) 전에 알아야 할 제약을 미리 모은다.

- **최초 작성:** 2026-08-01
- **상태:** v1 경로 확인됨 / v2 경로 선택지만 확인됨(결정 없음)
- **이력:** 2026-08-15 — §5의 로드맵 인용을 블록인용과 출처 줄로 옮겼다. 옮기며 「로드맵이 어디까지 적었나」의 범위를 배포 형태로 좁혔다(플랫폼 자체는 로드맵이 여러 곳에서 말한다) · 2026-08-13 — `spec/`으로 이전(`build-and-distribution.md` → `ops-build.md`). §4의 포커스 유실 진단이 세션 문서를 링크하던 것을 끊고 결론을 이 문서가 직접 들게 했다
- **조사 계기:** `feat/input-focus-reset`(F65) 계획 리뷰 중 "포커스 유실 버그가 배포본에 실제로 들어가는가"를 확인하려다 배포 경로 전체를 훑게 됐다. 그 버그의 재현 조건이 **게임이 어떤 페이지에 어떻게 얹히는지**에 달려 있었기 때문이다.
- **플랫폼 계획의 정본은 여기가 아니다** — [`../../planning/roadmap.md`](../../planning/roadmap.md) §2다. 이 문서는 그 계획을 실행할 때 마주치는 기술적 사실을 모은다.

---

## 1. 플랫폼 계획

로드맵 §2가 정한 것은 두 줄이다.

> **플랫폼:** v1 = itch.io 웹, v2 = Steam PC. 모바일 비목표.

v1은 브라우저에서 도는 웹 빌드이고, v2는 Steam으로 파는 PC 빌드다. 아래 §2~§4가 v1, §5가 v2다.

## 2. Cocos 웹 빌드는 정적 폴더다

공식 문서가 배포 방법을 한 문장으로 정리한다 — "빌드 폴더의 내용을 웹 서버에 복사한다"([Publish to Web](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-web.html)). 서버에서 도는 코드가 없다는 뜻이고, 그래서 파일을 그대로 어딘가에 올리기만 하면 동작한다. itch.io의 ZIP 업로드 방식이 성립하는 이유가 이것이다(§3).

### 2.1 어떤 웹 플랫폼을 고르나 — `web-mobile`

Cocos는 웹 빌드를 `web-desktop`과 `web-mobile` 둘로 나눈다. **itch.io에는 `web-mobile`을 쓴다.**

`web-desktop` 템플릿은 페이지에 게임 말고 다른 것을 같이 그린다.

```html
<!-- templates/web-desktop/index.ejs -->
<h1 class="header"><%= projectName %></h1>
<div id="GameDiv" style="width: <%= previewWidth %>px; height: <%= previewHeight %>px;">
  ...
</div>
<p class="footer">Created with <a href="https://www.cocos.com/products">Cocos Creator</a></p>
```

프로젝트 이름을 제목으로 띄우고 아래에 Cocos 링크가 달린 푸터를 붙이며, 게임 영역 크기를 픽셀로 고정한다. itch는 이 페이지를 iframe 안에 통째로 넣으므로 그 제목과 푸터가 게임 위아래에 그대로 보이고, 고정 크기라 iframe 크기가 달라져도 따라가지 않는다. `web-mobile`은 이런 장식 없이 화면을 채우도록 만들어져 있어 임베드에 맞는다.

> 이 선택은 F65와도 얽힌다. `web-desktop`의 푸터 링크(`<a href>`)는 **캔버스 바깥의 포커스 가능한 요소**다. 그걸 클릭하거나 Tab으로 이동하면 창은 포커스를 유지한 채 캔버스만 잃는다 → §4.

## 3. itch.io 업로드 — 자체 서버가 필요 없다

[itch.io HTML5 문서](https://itch.io/docs/creators/html5)가 명시한다.

> All of your game's assets are hosted by us so you don't need to worry about uploading files anywhere else.

즉 **어딘가에 올려 두고 URL을 알려 주는 방식이 아니다.** itch가 파일을 직접 호스팅하고, 프로젝트 페이지에 그 호스팅 경로를 가리키는 iframe을 박는다.

**절차**

1. 게임 페이지의 "Kind of Game"을 **HTML Game**으로 설정한다.
2. **루트에 `index.html`이 있는 ZIP**을 업로드한다. 파일이 하나뿐인 프로젝트라면 `.html`을 압축 없이 올려도 되지만, Cocos 빌드는 항상 여러 파일이므로 ZIP이다.
3. itch가 압축을 풀어 처리하고 나면 페이지에서 바로 플레이된다. 새 버전은 새 ZIP을 올리고 옛것을 지운다.

**ZIP 제한** — 넘기면 업로드가 거부되므로 에셋이 늘기 전에 알고 있어야 한다.

| 항목 | 한도 |
|------|------|
| 압축 해제 후 파일 **개수** | 1,000개 |
| 압축 해제 후 총 용량 | 500MB |
| 단일 파일 용량 | 200MB |
| 파일명 + 경로 길이 | 240자 |

파일명은 대소문자를 구분하고, 에셋은 상대경로로 참조해야 한다.

> 넷 중 먼저 닿을 만한 것은 용량이 아니라 **개수**다. Cocos는 에셋 번들의 `native/` 아래에 이미지·오디오를 파일 하나씩 떨어뜨리기 때문이다. 다만 실측해 보니 현재 72개라 여유가 크고, 아트 파이프라인이 커져도 닿지 않을 전망이다 → §6.2.

**임베드 옵션**

- **Embed in page** — 뷰포트 크기를 지정해 페이지 안에서 바로 돌린다.
- **Click to launch in fullscreen** — "Launch game"을 누르면 전체 화면으로 펼친다. 크기를 지정하지 않아도 되고, 대신 게임이 임의의 크기에 적응해야 한다.
- **Click to Play** — 기본으로 켜져 있다. 페이지를 열자마자 게임이 브라우저를 무겁게 만들지 않도록 플레이어가 한 번 클릭해야 시작한다.
- **Fullscreen Button** — itch가 오른쪽 아래에 전체화면 버튼을 **겹쳐서** 그려 준다.

## 4. 임베드가 만드는 런타임 조건

> **이 절은 itch 전용 문제를 설명하는 게 아니다.** 아래 포커스 문제는 웹으로 도는 모든 환경에서 발생하며, **Cocos 에디터 프리뷰도 포함**한다(프리뷰가 Chromium이라 같은 `pal/input/web`을 쓴다 — 실제로 F65는 배포가 아니라 7단계 인게임 테스트에서 발견됐다). itch 임베드는 **원인이 아니라 재현 경로를 늘리는 쪽**이다. 네이티브 빌드는 구조가 달라 이 메커니즘이 없다(§5.1).

배포 형태가 코드 동작에 영향을 주는 지점이 하나 있다. 게임이 **iframe 안에서 돌고 주변에 다른 요소가 있다**는 것이다.

itch 프로젝트 페이지에는 댓글창·링크·버튼이 있고, itch가 얹는 전체화면 버튼은 게임 화면 위에 겹쳐 있다. 그리고 Cocos가 내보내는 캔버스는 `tabindex`가 붙어 **독립적으로 포커스를 갖는 요소**다.

```html
<!-- 빌드 템플릿이 내보내는 캔버스 -->
<canvas id="GameCanvas" ... tabindex="99"></canvas>
```

그래서 포커스를 잃는 사건이 두 종류로 갈린다.

| 사용자 행동 | 포커스를 잃는 대상 | 발화하는 이벤트 |
|------------|------------------|----------------|
| itch 페이지의 댓글·링크 클릭(iframe 바깥) | iframe의 창 | `window`의 `blur` |
| itch가 겹쳐 그리는 전체화면 버튼 클릭 | iframe의 창 (그 버튼은 **부모 페이지**에 있다) | `window`의 `blur` |
| iframe 안에서 캔버스 여백 클릭 | 캔버스만 | `game.canvas`의 `blur` |
| 다른 앱으로 전환(Alt+Tab·Cmd+Tab) | 창 | `window`의 `blur` |
| 탭 전환·창 최소화 | 창 + 문서 | `window`의 `blur`, `Game.EVENT_HIDE` |

**이 구분이 중요한 이유**는 Cocos의 웹 키보드 입력이 키 이벤트를 캔버스 엘리먼트에만 걸기 때문이다. 캔버스가 포커스를 잃으면 그 뒤의 `keyup`이 캔버스로 오지 않아, 눌린 키를 상태로 들고 있는 코드는 그 키가 계속 눌려 있다고 믿는다. 창 포커스만 보고 있으면 위 표의 둘째 줄(캔버스만 잃는 경우)을 통째로 놓친다.

그래서 포커스 복귀 시점에 눌린 키 상태를 통째로 비운다. 창 포커스만이 아니라 캔버스 포커스도 함께 봐야 위 표의 둘째 줄이 덮인다. 이 진단과 봉합은 2026-08-01 슬라이스에서 났고 백로그 항목은 **F65**다.

## 5. v2 Steam — 네이티브 빌드가 내장돼 있다

Cocos Creator 3.8.8은 데스크톱 네이티브를 1급 플랫폼으로 지원한다. 설치본의 빌드 템플릿이 그대로 보여 준다.

```
templates/windows/  CMakeLists.txt · main.cpp · game.rc · resource.h   → 네이티브 실행 파일
templates/mac/      CMakeLists.txt · main.mm · Info.plist · Icon.icns  → Xcode 프로젝트
templates/linux/
```

즉 Steam 배포에 웹 빌드를 Electron 같은 것으로 감쌀 필요가 없다. **Windows 네이티브 빌드 → Steamworks SDK 연동 → SteamPipe 업로드**가 표준 경로다.

**아직 결정된 것은 아니다.** 로드맵이 정한 것은 어느 플랫폼에 내는가까지이고, 거기서 배포 형태는 말하지 않는다.

> **플랫폼:** v1 = itch.io 웹, v2 = Steam PC. 모바일 비목표.
> — [`roadmap.md`](../../planning/roadmap.md) 「플랫폼」 줄

네이티브를 택한다는 기록은 어디에도 없다. 지금 확인된 것은 **선택지가 실재한다**는 사실까지다.

### 5.1 네이티브로 가면 웹 전용 코드가 빠진다

엔진은 플랫폼별로 구현을 갈아끼운다. `cc.config.json`의 web 블록은 이렇게 매핑한다.

```json
"pal/system-info": "pal/system-info/web/system-info.ts",
"pal/input": "pal/input/web/index.ts",
```

네이티브 블록은 같은 자리에 `pal/input/native/index.ts`가 들어간다. 그래서 §4에서 설명한 캔버스 기반 입력 경로는 네이티브 빌드에 **존재하지 않고**, `window`나 `game.canvas` 같은 DOM 객체도 없다.

우리 코드가 DOM API를 부를 때 `sys.isBrowser` 가드와 `game.canvas?.`를 거는 이유가 이것이다. v1에서는 항상 참이라 실행되지 않는 방어처럼 보이지만, v2가 네이티브로 가는 순간 그 가드가 실제로 갈라진다.

네이티브 키보드 입력은 엘리먼트가 아니라 전역 콜백으로 들어온다.

```ts
// pal/input/native/keyboard-input.ts
jsb.onKeyDown = this._handleKeyboardDown;
jsb.onKeyUp = this._handleKeyboardUp;
```

포커스를 가진 엘리먼트라는 개념이 없으므로 §4의 메커니즘(캔버스가 포커스를 잃어 `keyup`이 딴 데로 감)은 네이티브에 존재하지 않는다. **다만 "앱 창이 포커스를 잃은 동안 키를 떼면 OS가 그 `keyup`을 앱에 전달하는가"는 별개 문제이고, 그 답은 C++ 창 관리 코드에 있어 아직 확인하지 않았다.** 네이티브 빌드를 실제로 만드는 시점에 확인할 것. `Game.EVENT_HIDE` 구독이 덮으려는 것이 이 불확실성이다.

## 6. 실측 — 첫 웹 빌드 (2026-08-01)

이 프로젝트의 **첫 빌드**다. 명령줄로 돌렸고 37초 걸렸다.

```bash
"/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator" \
  --project "<repo>/game" --build "platform=web-mobile;debug=false"
```

산출물은 `game/build/web-mobile/`에 떨어진다(`game/build/`는 `.gitignore` 대상이라 커밋되지 않는다).

### 6.1 실제 구조

```
game/build/web-mobile/
├── index.html          2.0 KB   ← itch가 요구하는 진입점
├── index.js            0.8 KB
├── application.js      3.3 KB   부트스트랩
├── style.css           1.2 KB
├── src/                 76 KB   6개 — 시스템 번들·프로젝트 설정
├── cocos-js/           3.0 MB   8개 — 엔진 청크
└── assets/             1.5 MB  54개 — 에셋 번들 3개
    ├── internal/       244 KB   3개
    ├── main/           1.2 MB  39개
    └── resources/       52 KB  12개
```

`assets/` 아래 확장자 분포는 json 36 · png 15 · js 3이다. 번들마다 `config.json`·`index.js`와 함께 직렬화 에셋이 `import/`에, 원본 이미지가 `native/`에 들어간다.

### 6.2 itch.io 한도 대비

| 항목 | 한도 | 실측 | 여유 |
|------|------|------|------|
| 파일 개수 | 1,000 | **72** | 928개 |
| 총 용량 | 500 MB | **4.6 MB** | 495 MB |
| 단일 파일 | 200 MB | **2.4 MB** (`cocos-js`의 엔진 청크) | 충분 |
| 경로 길이 | 240자 | **68자** | 충분 |

**§3에서 걱정한 파일 개수 한도는 실측 결과 현실적 제약이 아니다.** 스프라이트 하나가 대략 원본 png 한 개와 직렬화 json 한 개를 더하므로 남은 928개는 새 스프라이트 수백 장에 해당한다. 아트 파이프라인(**F60** — 적 12종·마법 이펙트·맵)이 그 규모에 닿지 않고, 나중에 스프라이트 아틀라스로 묶으면(백로그 **G1**의 배칭 조각) 오히려 줄어든다. **그래서 이 건으로 백로그 항목을 만들지 않는다** — 조사 전 세운 가정이 실측으로 기각된 경우다.

용량은 **엔진이 게임보다 크다**(엔진 3.0MB vs 에셋 1.5MB). 최종 아트가 들어오면 역전되겠지만, 500MB 한도까지는 아주 멀다.

### 6.3 배포될 캔버스 확인

생성된 `index.html`이 §4에서 설명한 그 캔버스를 그대로 담고 있다.

```html
<canvas id="GameCanvas" oncontextmenu="event.preventDefault()" tabindex="99"></canvas>
```

`tabindex`가 실제 산출물에 있으므로, 캔버스가 창과 별개로 포커스를 잃는 경로(§4)는 템플릿상의 이야기가 아니라 **배포본의 성질**이다.

## 7. 열린 질문

- **v2를 네이티브로 갈 것인가.** 선택지는 확인됐고 결정은 없다(§5). 네이티브를 택하면 C++ 툴체인·Steamworks 연동이 따라오고, 웹 빌드를 데스크톱 앱으로 감싸는 길을 택하면 그 반대다. v2 착수 시점에 정한다.
- **임베드 방식(페이지 내 고정 크기 vs 전체화면 실행).** §3의 두 옵션 중 무엇을 쓸지는 HUD가 해상도에 어떻게 반응하는지를 보고 정한다. 현재 HUD 좌표 컨벤션이 1280×720 기준이고 `UICanvas`가 화면에 맞춰 재조정되는 문제(백로그 **F9**)가 남아 있어, 임베드 크기를 정하는 일과 그 항목이 같은 자리에서 만난다.
- ~~에셋 번들 전략과 itch 파일 개수 한도~~ → **닫힘(2026-08-01).** 실측 72/1,000이라 현실적 제약이 아니다(§6.2). 백로그 항목을 만들지 않는다.
