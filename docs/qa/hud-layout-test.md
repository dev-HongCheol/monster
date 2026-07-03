# QA — HUD 레이아웃 + 바 + 테마 토대

> **브랜치:** feat/hud-layout
> **슬라이스:** v1 완성도 첫 UI 슬라이스 (HUD 바·레이아웃·테마 토대)
> **계획 문서:** [2026-07-02-hud-layout-plan.md](../development/sessions/2026-07-02-hud-layout-plan.md)
> **레이아웃 청사진:** [hud-layout.html](../decisions/hud-layout.html) / `.png`
> **닫는 백로그:** J4(UI 완성도) — 부분 전진(HUD 바·레이아웃·테마 토대). 설정·도감·결과 통계 등 J4 잔여는 후속 슬라이스.

---

## 1. Impact Map (회귀 테스트 기준)

| 변경 파일 | 변경 내용 | 회귀 확인 범위 |
|---|---|---|
| `logic/HudFormatLogic.ts` (신규) | `formatTimer`·`barRatio`·`formatNumber` 순수 함수 | 단위 테스트로 커버(§2). cc 비의존. `formatNumber`는 HP 숫자 라벨의 천단위 콤마 포맷(리워크 추가). |
| `ui/Theme.ts` (신규) | UI 공통 상수 `COLORS`·`SIZES`·`FONT` placeholder | `cc.Color` 상수라 순수 테스트 대상 아님. 이후 `/design-consultation`이 값만 교체. `COLORS.HP_FILL`/`XP_FILL`만 이번에 `HudController`가 참조. (파일명은 코드 컨벤션대로 PascalCase `Theme.ts`.) |
| `ui/HudController.ts` | HP/XP 바 `@property` 추가 + `barRatio`로 갱신, 타이머를 `formatTimer`로 교체, 웨이브·타이머 좌상 재배치, HP 숫자 라벨을 `formatNumber`로 천단위 콤마 포맷(리워크). `xpLabel` `@property`·`_updateXpInfo`의 XP 수치 라벨 갱신 제거(리워크2). **`_updateXpInfo`가 매 프레임 `xpBar.totalLength`를 바의 실제 `UITransform` 폭으로 맞춤(리워크3)** — 풀폭 스트레치 바의 fill이 폭을 따라가도록. | **기존 HUD 회귀** — 웨이브/레벨 숫자 라벨은 지금과 동일하게 갱신돼야 함. HP 라벨만 천단위 콤마가 붙는다(값 < 1000이면 콤마 없음 = 무변화). XP 수치 라벨은 제거됨. **XP 바 fill이 바 폭 전체 기준으로 왼쪽부터 참(중앙에 조각나지 않음).** 게임오버·레벨업 패널 전환(`_handleStateChange`)·재시작/메뉴 버튼 콜백 무영향. |
| `resources/i18n/ko.json`·`en.json` | `hud.timer` 템플릿을 `{min}:{sec}` → `{time}` 단일 파라미터로 변경(`formatTimer`가 완성된 `mm:ss` 문자열을 산출). **`hud.xp` 키 제거(리워크2)** — XP 수치 라벨 폐지에 맞춰 사용처와 함께 삭제. | **i18n 키 정합 가드**(`I18nKeyGuard.test.ts`) — `hud.timer` 키 자체는 유지(파라미터만 `min`/`sec` → `time`). `hud.xp`는 사용처(`HudController`)와 카탈로그(ko/en)에서 **동시 제거**해 정합 유지. 가드가 여전히 GREEN인지 확인. |
| **main.scene (UI Canvas)** | HP/XP ProgressBar 노드·레이아웃 앵커(Widget)·placeholder 4종 추가. 7단계 사용자 작업. | 아래 §3~§5. |
| **Project Settings → Project Data** | 디자인 해상도 1280×720 + Fit Height. 7단계 사용자 작업. | 세 씬 좌표 재계산 파급 확인(§3.1 주의). |

> **왜 `formatTimer`가 문자열을 산출하나(i18n 규칙과의 관계):** `mm:ss`(예: `01:05`)는 콜론 구분의 **언어 중립 숫자 포맷**이라 현지화 문자열이 아니다(숫자 천단위 포맷과 같은 성격). 그래서 순수 로직에 두어도 "logic엔 사용자 표시 문자열을 두지 않는다" 원칙에 어긋나지 않는다. `hud.timer` i18n 키는 유지해, 특정 언어가 시간 표기를 감싸고 싶을 때(`{time}`) 여지를 남긴다.

---

## 2. 자동 테스트로 검증 (`tests/logic/HudLayout.test.ts`)

> **RED 확인(2026-07-02):** 모듈(`HudFormatLogic`) 미존재로 피처 테스트 RED — `pnpm wf ready-impl` RED 게이트 통과.
> **GREEN 통과 근거(2026-07-02):** 피처 테스트 13/13 + 전체 스위트 377/377 통과(`pnpm wf start-verification` GREEN 게이트). 통과 커밋 SHA는 `feat/hud-layout` 구현 커밋.
> **재검증 근거(2026-07-03, XP 금색·HP 콤마 리워크):** `formatNumber` 추가로 피처 테스트 20/20 + 전체 스위트 384/384 통과(`start-verification` GREEN). 통과 커밋 SHA는 아래 리워크 커밋.

- [x] `formatTimer` — `0 → "00:00"`
- [x] `formatTimer` — `65 → "01:05"` (분/초 분리)
- [x] `formatTimer` — `600 → "10:00"` (2자리 분)
- [x] `formatTimer` — `9 → "00:09"` (초 2자리 패딩)
- [x] `formatTimer` — 음수 클램프(`-3 → "00:00"`)
- [x] `formatTimer` — 소수 초 내림(`65.9 → "01:05"`)
- [x] `formatTimer` — 분 100 이상 자리수 유지(`6000 → "100:00"`)
- [x] `barRatio` — 정상 비율(`50, 100 → 0.5`)
- [x] `barRatio` — 가득(`100, 100 → 1`)
- [x] `barRatio` — 초과 클램프(`120, 100 → 1`)
- [x] `barRatio` — `max = 0 → 0` (0 나눗셈 가드)
- [x] `barRatio` — `max` 음수 → 0
- [x] `barRatio` — `cur` 음수 클램프(`-5, 100 → 0`)
- [x] `formatNumber` — 3자리 이하 콤마 없음(`205 → "205"`)
- [x] `formatNumber` — 콤마 경계 직전(`999 → "999"`)
- [x] `formatNumber` — 첫 콤마(`1000 → "1,000"`)
- [x] `formatNumber` — 보스 체력 규모(`10058650 → "10,058,650"`)
- [x] `formatNumber` — `0 → "0"`
- [x] `formatNumber` — 소수 내림(`1234.7 → "1,234"`)
- [x] `formatNumber` — 음수 부호 보존(`-1234 → "-1,234"`)

> **코드로 검증 불가(수동 항목):** HP/XP 바가 값에 맞게 시각적으로 차는지, 창 리사이즈 시 HUD 앵커 유지, placeholder 배치·룩 — §6.

---

## 3. 디자인 해상도 + Fit 정책 설정 (7단계 사용자 — Cocos 에디터)

### 3.1 설정 경로와 값

**Project → Project Settings → Project Data → Default canvas setting** 에서 설정한다(Cocos Creator 3.8 공식: Fit Width/Fit Height는 여기서 관리).

| 항목 | 확정값 (계획 §4) | 상태 |
|---|---|---|
| Design Resolution (Width × Height) | **1280 × 720** (16:9, 웹 표준·목업 해상도와 일치) | ❌ |
| Fit Width | **끄기(off)** | ❌ |
| Fit Height | **켜기(on)** — 세로 맞춤, 좌우로 월드가 더 보임 | ❌ |

> **주의(계획 §7 리스크):** Project Data의 디자인 해상도 값은 **새로 만드는 Canvas에 적용**된다. 이미 존재하는 세 씬(main·menu 등)의 Canvas가 기존 해상도(엔진 기본값)를 들고 있으면, 씬을 다시 열어 Canvas가 새 값에 맞게 재동기화되는지 확인한다. 씬 좌표가 새 디자인 해상도 기준으로 재계산되면(백로그 F9 카메라 churn과 유사) 무관한 diff가 생길 수 있으니 커밋 전 확인한다.

---

## 4. 씬/프리팹 변경 사항 — HUD 레이아웃 (7단계 사용자 — Cocos 에디터)

> **부모 계층 (중요):** 새 HUD 노드는 UICanvas 바로 아래가 아니라 **`HUD` 노드 아래**에 둔다 — 실제 씬 계층은 `UICanvas > HUD > {HpLabel·WaveLabel·TimerLabel·LevelLabel·XpLabel}`이고 `HudController`는 **HUD 노드**에 붙어 있다. 새 `HpBar`·`XpBar`·placeholder는 기존 라벨과 **형제**(HUD의 자식)로 만든다. (`main.scene`은 게임/UI 두 Canvas로 분리 — card-layer-fix.)
>
> **Widget 인스펙터 UI (Cocos 3.8):** 개별 체크박스가 아니라 **`Horizontal Alignment`·`Vertical Alignment` 두 줄**로 나뉜다. 각 줄은 `NONE` 다음에 아이콘 4개 — 가로는 `Left · Center · Right · Left&Right(양쪽)`, 세로는 `Top · Center · Bottom · Top&Bottom(양쪽)`. **줄마다 하나씩** 고르고(두 줄이라 총 2선택), 고른 변마다 **거리(px)** 입력칸이 나타난다(이 거리가 아래 표의 "여백/오프셋"). **맨 오른쪽 "양쪽" 아이콘 = 그 방향 스트레치**(공식: left+right 둘 다 정렬하면 가로로, top+bottom이면 세로로 노드가 늘어남). `Target`은 부모(기본), `Align Mode`는 **`ON_WINDOW_RESIZE`** 권장. 스트레치되는 축은 크기가 Widget으로 결정되고, 아닌 축만 `UITransform`에서 정한다.
>
> **선행 필수 — HUD 노드를 화면 전체로 스트레치:** 현재 `HUD` 노드는 `UITransform` 100×100(중앙, Widget 없음)이다. 이대로면 자식 Widget이 이 작은 박스에 앵커돼 화면 모서리에 안 붙는다. **HUD 노드에 `cc.Widget`을 추가**하고 **Horizontal Alignment = `Left&Right`(맨 오른쪽)·Vertical Alignment = `Top&Bottom`(맨 오른쪽)**을 골라 Left/Right/Top/Bottom 값을 전부 **0**으로 둬 UICanvas(=화면) 전체를 채운다. HUD 앵커는 (0.5,0.5) 유지라 기존 라벨 위치는 그대로다. 이후 자식 바의 Widget Target 기본값(부모=스트레치된 HUD)이 곧 화면 모서리가 된다.
>
> **(확정)** — 아래는 구현된 `HudController`(`@property hpBar`/`xpBar`, `ProgressBar` 타입)에 맞춘 확정본이다. 노드 이름은 사용자 선택(코드가 이름에 의존하지 않음 — `@property` 슬롯 연결만 필요), 크기·오프셋은 목업 기준 권장값이다.

### 4.0 전체 좌표 요약 (겹침 점검용, 1280×720)

목업(`hud-layout.html`) 기준 앵커(모서리로부터 px). 같은 모서리에 여러 요소가 몰리는 좌상·좌하만 **세로로 안 겹치는지** 확인한다.

| 영역 | 요소 | 앵커 | 세로 구간(대략) |
|---|---|---|---|
| 좌상 | 미니맵(ph) | L24 · T24, 160×160 | y 24 ~ 184 |
| 좌상 | WaveLabel | L24 · **T192** | y 192 ~ 212 |
| 좌상 | TimerLabel | L24 · **T216** | y 216 ~ 246 |
| 상단중앙 | 보스HP바(ph) | T24 · HCenter | — |
| 우상 | 메뉴(ph) | R24 · T24, 36×36 | — |
| 좌하 | HpBar | L24 · **B44**, 200×18 | 아래서 44 ~ 62 |
| 좌하 | LevelLabel | L24 · **B16** | 아래서 16 ~ 36 |
| 하단풀폭 | XpBar | L0·R0·B0, 1280×12 | 아래서 0 ~ 12 |
| 우하 | 스킬그리드(ph) | R24 · B44, ≈136×88 | 아래서 44 ~ 132 |

> **좌상 세로 스택:** 미니맵(24–184) → Wave(192–212) → Timer(216–246). 서로 8px 이상 떨어져 안 겹침. (이전 값 Wave/Timer Top=24/56은 미니맵과 겹쳐 **오류였음** — 수정됨.)
> **좌하 세로 스택:** XP바(0–12) → Level(16–36) → HpBar(44–62). 겹침 없음. HpBar를 예전 Bottom=24로 두면 Level(16–36)과 겹치므로 **44로 올림**.

### 4.1 실제 배선 노드 (확정)

> **바 색은 코드가 테마에서 적용한다.** `HudController.onLoad`가 `hpBar.barSprite.color = COLORS.HP_FILL`(빨강)·`xpBar.barSprite.color = COLORS.XP_FILL`(금색 `#FFEB3B`)을 세팅하므로, **에디터의 Bar Sprite는 흰색(틴트 반영되도록)** 으로 두면 된다. 채움 비율은 매 프레임 `progress = barRatio(cur, max)`로 갱신된다.

> 부모는 전부 **HUD 노드**(위 스트레치 선행 조건 적용). Widget 필드는 체크할 변 + 거리(px).

| 노드 (부모) | 타입/컴포넌트 | Widget 앵커 (체크 + 거리 px) | 크기 (UITransform) | 비고 |
|---|---|---|---|---|
| `HpBar` (HUD) | `cc.ProgressBar` (Mode=HORIZONTAL, Bar Sprite=흰 텍스처, 배경 노드에 `COLORS.BAR_BG` 톤) | ☑Left=24 · ☑Bottom=44 (레벨 라벨·XP 바 위) | 폭 ≈ 200 · 높이 ≈ 18 | `@property hpBar`에 연결. `barSprite`(Fill) 지정 필수 — 코드가 이 스프라이트를 틴트. 바 위 숫자 라벨(`hpLabel`) 병기 유지. |
| `XpBar` (HUD) | `cc.ProgressBar` (Mode=HORIZONTAL, Bar Sprite=같은 흰 텍스처) | ☑Left=0 · ☑Right=0 · ☑Bottom=0 (Left+Right = 가로 풀폭, **여백 0 = 화면 양 끝까지**) | 높이 ≈ 12 (폭은 스트레치가 결정, 디자인 1280) | `@property xpBar`에 연결. `barSprite`(Fill) 지정 필수. 분할(5칸) 룩은 범위 밖 — 단일 바. **엣지-투-엣지 확정(2026-07-03 사용자): 아래 영역을 좌우 여백 없이 꽉 채운다.** |
| `LevelLabel` (HUD) | `cc.Label` (기존) | ☑Left=24 · ☑Bottom=16 (XP 바 바로 위) | 라벨 자동 | 기존 `levelLabel`. `hud.level`(`Lv.40`). XP 바를 풀폭으로 바꿔 "왼쪽 병기"가 불가하므로 바 왼쪽 **위**에 얹는다(겹쳐 표기 원하면 Bottom=0). |
| `WaveLabel` (HUD) | `cc.Label` (기존, 좌상 재배치) | ☑Left=24 · ☑Top=192 (미니맵 아래) | 라벨 자동 | 기존 `waveLabel`. `hud.wave`. 미니맵(Top 24 · 높이 160 → 하단 y≈184) **아래**. ⚠️ Top=24로 두면 미니맵과 겹침. |
| `TimerLabel` (HUD) | `cc.Label` (기존, 좌상 재배치) | ☑Left=24 · ☑Top≈216 (웨이브 아래) | 라벨 자동 | 기존 `timerLabel`. `formatTimer`로 `mm:ss` 카운트다운. |

> **ProgressBar Bar(fill) 자식 설정 (필수 — 안 맞으면 fill이 중앙에 일부만 보임):** `cc.ProgressBar`는 fill 스프라이트(=`barSprite`)의 폭을 `totalLength × progress`로 그리고, fill의 **왼쪽 끝**부터 채운다(Mode HORIZONTAL). 따라서 Bar 자식은 **앵커 `(0, 0.5)`**(왼쪽 기준) + **위치를 부모 바의 왼쪽 끝**에 둔다(폭 W인 바는 로컬 x = −W/2). `totalLength`는 **코드가 매 프레임 바의 실제 폭으로 맞추므로**(`_updateXpInfo`) 에디터에서 손댈 필요 없다 — XP 바가 하단 풀폭이라 Widget 스트레치 폭을 따라가야 하기 때문이다(고정 px면 창 비율 변화 시 fill이 어긋남). HP 바는 고정폭(200)이라 무관하지만 같은 fill 규칙을 따른다.
>
> **XP 바 = 하단 엣지-투-엣지 풀폭(확정):** XpBar는 화면 맨 아래를 좌우 여백 없이 꽉 채운다 — Widget `Left=0·Right=0·Bottom=0` → 폭 = 디자인 해상도 **1280**. Bar(fill) 자식은 앵커 `(0,0.5)` + Position `X = −640`(= 1280 폭의 왼쪽 끝, −1280/2). `totalLength`는 코드가 1280으로 자동 세팅. (Bar 높이는 XpBar와 맞춰 12 권장.)

### 4.2 placeholder 4종 (자리만, 코드 배선 없음 — 이름·정밀좌표는 사용자 재량)

> **노드 이름은 예시일 뿐 실제 사용 명칭이 아니다 — 자유롭게 정한다.** 이들은 `HudController`에 `@property`가 **없어**(코드 참조 없음) 이름·좌표를 코드가 전혀 모른다. 여기서 확정된 건 **역할과 대략적 앵커 지점(어느 모서리에 두는가)**뿐이고, 정확한 px·크기는 에디터에서 눈으로 맞춘다. 부모는 전부 **HUD 노드**. 아래 표는 "이 역할을 이 모서리에" 수준의 참고값이다.

| 역할 (예시 이름) | 표현 | Widget 앵커 (모서리 참고값) | 비고 |
|---|---|---|---|
| 미니맵 (`Minimap…`) | 정적 빈 사각형(테두리 + "MINIMAP" 라벨) | 좌·상 (Left≈24 · Top≈24), 크기 ≈160×160 | 기능 없음. v2/이월. **아래 WaveLabel(Top 192)과 겹치지 않게** 하단 y≈184에서 끝남. |
| 보스 HP 바 (`BossHpBar…`) | 상단 중앙 바 모양, `active = false` 기본 | 상단 중앙 (Top≈24 · HorizontalCenter=0), 폭 ≈640 | v1 무보스 → 인게임에선 안 보임. v2 앵커 지점만. |
| 메뉴 버튼 (`MenuButton…`) | ≡ 버튼 모양(콜백 배선 없음) | 우·상 (Right≈24 · Top≈24), 36×36 | 일시정지는 별도 슬라이스. 기존 게임오버 `menuButton`과 별개. |
| 스킬 그리드 (`SkillGrid…`) | 3×2 빈 슬롯 사각형 6칸 | 우·하 (Right≈24 · Bottom≈44), ≈136×88 | 보유 마법 표시 자리. HpBar(좌하)와 같은 하단 밴드, 좌우 반대편. 데이터 바인딩·쿨다운 라디얼은 후속. |

### 4.3 바 스프라이트 에셋 (확정)

| 항목 | 값 | 비고 |
|---|---|---|
| 바 텍스처 | **흰색**(또는 둥근 모서리) 1장 SpriteFrame(placeholder) | HP·XP가 같은 흰 텍스처를 재사용하고 **코드가 `COLORS`로 각각 틴트**한다(§4.1). 에셋이라 사용자가 준비, `.meta`는 7단계 Cocos 생성. |

---

## 5. 에디터 연결 체크리스트 (`@property` ↔ 노드) — 확정

> 구현된 `HudController`의 `@property` 이름 기준(확정). 신규는 `hpBar`·`xpBar` 두 개뿐이다.

| 컴포넌트 | `@property` | 타입 | 연결 대상 | 상태 |
|---|---|---|---|---|
| `HudController` | `hpBar` | `ProgressBar` | `HpBar` ProgressBar 노드 (`barSprite`에 Fill 스프라이트 지정) | ❌ |
| `HudController` | `xpBar` | `ProgressBar` | `XpBar` ProgressBar 노드 (`barSprite`에 Fill 스프라이트 지정) | ❌ |
| `HudController` | `hpLabel`/`waveLabel`/`timerLabel`/`levelLabel` (기존) | `Label` | 재배치된 라벨 노드들 | ⬜ 유지 확인 |
| `HudController` | `gameOverPanel`/`restartButton`/`menuButton`/`cardSelectPanel` (기존) | `Node`/`Button` | 무변경 | ⬜ 유지 확인 |

> **`XpLabel` 노드 삭제 (필수, 사용자 에디터 작업):** 기획상 XP는 바만 표시하고 수치 텍스트는 없다. `xpLabel` `@property`와 `hud.xp` i18n 키를 코드에서 제거했으므로, 씬의 **`XpLabel` 노드(`UICanvas > HUD` 하위, `HpLabel` 등과 형제)를 삭제**한다. 안 지우면 코드가 갱신하지 않아 노드 기본 문자열 `"XpLabel"`이 화면에 그대로 노출된다. 삭제 후 씬을 재저장하면 `HudController`에 남은 직렬화 `xpLabel` 참조도 씻긴다(Cocos는 클래스에 없는 프로퍼티를 로드 시 조용히 버려 런타임 오류는 없음).

---

## 6. 수동 테스트 체크리스트 (인게임 — 7단계 사용자)

- [ ] HP가 닳으면 **HP 바(좌하단)가 값에 비례해 줄어든다**. 바 위 숫자(HP)도 함께 갱신된다. HP 라벨은 **중앙 흰색**이며, 값이 1000 이상이면 **천단위 콤마**로 표시된다(`formatNumber`; 예: `1,205`. 1000 미만이면 콤마 없음).
- [ ] XP를 얻으면 **XP 바(하단 풀폭, 금색 `#FFEB3B`)가 채워지고**, 레벨업 시 0으로 리셋되며 `Lv.` 숫자가 오른다. **fill이 바 왼쪽 끝부터 폭 전체 기준으로 차오른다**(중앙에 조각으로 뜨지 않음 — `totalLength`를 코드가 폭에 맞춤). **화면에 XP 수치 텍스트(`XP: n / n`)는 표시되지 않는다** — 진행은 바로만 표현(기획).
- [ ] HP가 0이 되면 게임오버 패널이 뜬다(기존 동작 회귀 없음).
- [ ] 레벨업 시 카드 선택 패널이 뜬다(기존 동작 회귀 없음).
- [ ] 웨이브 번호(`Wave N`)와 타이머(`mm:ss` 카운트다운)가 **좌상단**에 표시되고 매초 줄어든다.
- [ ] **창 크기를 바꾸거나 전체화면**으로 전환해도 HUD 각 요소가 지정된 모서리(좌상·좌하·우상·우하·상단중앙·하단풀폭)에 유지된다(Widget 앵커).
- [ ] Fit Height가 적용돼 세로가 화면에 맞고, 창 가로비가 넓어지면 좌우로 월드가 더 보인다(HUD는 모서리 유지).
- [ ] placeholder가 자리에 보인다 — 미니맵(좌상 빈 사각형)·메뉴 ≡(우상)·스킬 그리드 6칸(우하). 보스 HP 바는 기본 비활성이라 인게임에선 보이지 않는다.
- [ ] placeholder는 **클릭·기능 반응이 없다**(메뉴 ≡ 눌러도 아무 일 없음 — 일시정지 미배선).
