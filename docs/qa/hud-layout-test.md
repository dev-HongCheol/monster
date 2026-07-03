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
| `ui/HudController.ts` | HP/XP 바 `@property` 추가 + `barRatio`로 갱신, 타이머를 `formatTimer`로 교체, 웨이브·타이머 좌상 재배치, HP 숫자 라벨을 `formatNumber`로 천단위 콤마 포맷(리워크) | **기존 HUD 회귀** — 웨이브/레벨/XP 숫자 라벨은 지금과 동일하게 갱신돼야 함. HP 라벨만 천단위 콤마가 붙는다(값 < 1000이면 콤마 없음 = 무변화). 게임오버·레벨업 패널 전환(`_handleStateChange`)·재시작/메뉴 버튼 콜백 무영향. |
| `resources/i18n/ko.json`·`en.json` | `hud.timer` 템플릿을 `{min}:{sec}` → `{time}` 단일 파라미터로 변경(`formatTimer`가 완성된 `mm:ss` 문자열을 산출) | **i18n 키 정합 가드**(`I18nKeyGuard.test.ts`) — `hud.timer` 키 자체는 유지되므로 키 정합은 그대로. 파라미터만 `min`/`sec` → `time`으로 바뀐다. 가드가 여전히 GREEN인지 확인. |
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

> 모든 HUD 노드는 **UI Canvas** 아래에 둔다(`main.scene`은 게임/UI 두 Canvas로 분리 — card-layer-fix). 좌표가 아니라 **`cc.Widget` 앵커**로 배치해 창 크기 변화에 대응한다.
>
> **(확정)** — 아래는 구현된 `HudController`(`@property hpBar`/`xpBar`, `ProgressBar` 타입)에 맞춘 확정본이다. 노드 이름은 사용자 선택(코드가 이름에 의존하지 않음 — `@property` 슬롯 연결만 필요), 크기·오프셋은 목업 기준 권장값이다.

### 4.1 실제 배선 노드 (확정)

> **바 색은 코드가 테마에서 적용한다.** `HudController.onLoad`가 `hpBar.barSprite.color = COLORS.HP_FILL`(빨강)·`xpBar.barSprite.color = COLORS.XP_FILL`(금색 `#FFEB3B`)을 세팅하므로, **에디터의 Bar Sprite는 흰색(틴트 반영되도록)** 으로 두면 된다. 채움 비율은 매 프레임 `progress = barRatio(cur, max)`로 갱신된다.

| 노드 (부모) | 타입/컴포넌트 | Widget 앵커 | 크기·오프셋 (권장) | 비고 |
|---|---|---|---|---|
| `HpBar` (UI Canvas) | `cc.ProgressBar` (Mode=HORIZONTAL, Bar Sprite=흰 텍스처, 배경 노드에 `COLORS.BAR_BG` 톤) | 좌·하 앵커 | 폭 ≈ 200, 높이 ≈ 18, 좌하 여백 ≈ 24 | `@property hpBar`에 연결. `barSprite`(Fill) 지정 필수 — 코드가 이 스프라이트를 틴트. 바 위 숫자 라벨(`hpLabel`) 병기 유지. |
| `XpBar` (UI Canvas) | `cc.ProgressBar` (Mode=HORIZONTAL, Bar Sprite=같은 흰 텍스처) | 좌·우·하 앵커(풀폭) | 높이 ≈ 12, 좌우 여백 ≈ 16, 하단 여백 ≈ 8 | `@property xpBar`에 연결. `barSprite`(Fill) 지정 필수. 왼쪽에 `levelLabel`(`Lv.40`) 병기 유지. 분할(5칸) 룩은 범위 밖 — 단일 바. |
| `WaveLabel` (UI Canvas) | `cc.Label` (기존, 좌상 재배치) | 좌·상 앵커 | 미니맵 placeholder 아래 | 기존 `waveLabel`. `hud.wave`. |
| `TimerLabel` (UI Canvas) | `cc.Label` (기존, 좌상 재배치) | 좌·상 앵커 | 웨이브 라벨 아래 | 기존 `timerLabel`. `formatTimer`로 `mm:ss` 카운트다운. |

### 4.2 placeholder 4종 (확정 — 자리만, 코드 배선 없음)

> 아래 노드는 `HudController`에 `@property`가 **없다**(코드 참조 없음). 순수 씬 노드로 앵커 지점만 잡는다. 이름은 권장값이며 자유롭게 정해도 된다.

| 노드 (부모) | 표현 | Widget 앵커 | 비고 |
|---|---|---|---|
| `MinimapPlaceholder` (UI Canvas) | 정적 빈 사각형(테두리 + "MINIMAP" 라벨) | 좌·상 앵커 | 기능 없음. v2/이월. |
| `BossHpBarPlaceholder` (UI Canvas) | 상단 중앙 바 모양, `active = false` 기본 | 상단 중앙 앵커 | v1 무보스 → 인게임에선 안 보임. v2 앵커 지점만. |
| `MenuButtonPlaceholder` (UI Canvas) | ≡ 버튼 모양(콜백 배선 없음) | 우·상 앵커 | 일시정지는 별도 슬라이스. 기존 게임오버 `menuButton`과 별개. |
| `SkillGrid` (UI Canvas) | 3×2 빈 슬롯 사각형 6칸 | 우·하 앵커 | 보유 마법 표시 자리. 데이터 바인딩·쿨다운 라디얼은 후속. |

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
| `HudController` | `hpLabel`/`waveLabel`/`timerLabel`/`levelLabel`/`xpLabel` (기존) | `Label` | 재배치된 라벨 노드들 | ⬜ 유지 확인 |
| `HudController` | `gameOverPanel`/`restartButton`/`menuButton`/`cardSelectPanel` (기존) | `Node`/`Button` | 무변경 | ⬜ 유지 확인 |

---

## 6. 수동 테스트 체크리스트 (인게임 — 7단계 사용자)

- [ ] HP가 닳으면 **HP 바(좌하단)가 값에 비례해 줄어든다**. 바 위 숫자(HP)도 함께 갱신된다. HP 라벨은 **중앙 흰색**이며, 값이 1000 이상이면 **천단위 콤마**로 표시된다(`formatNumber`; 예: `1,205`. 1000 미만이면 콤마 없음).
- [ ] XP를 얻으면 **XP 바(하단 풀폭, 금색 `#FFEB3B`)가 채워지고**, 레벨업 시 0으로 리셋되며 `Lv.` 숫자가 오른다.
- [ ] HP가 0이 되면 게임오버 패널이 뜬다(기존 동작 회귀 없음).
- [ ] 레벨업 시 카드 선택 패널이 뜬다(기존 동작 회귀 없음).
- [ ] 웨이브 번호(`Wave N`)와 타이머(`mm:ss` 카운트다운)가 **좌상단**에 표시되고 매초 줄어든다.
- [ ] **창 크기를 바꾸거나 전체화면**으로 전환해도 HUD 각 요소가 지정된 모서리(좌상·좌하·우상·우하·상단중앙·하단풀폭)에 유지된다(Widget 앵커).
- [ ] Fit Height가 적용돼 세로가 화면에 맞고, 창 가로비가 넓어지면 좌우로 월드가 더 보인다(HUD는 모서리 유지).
- [ ] placeholder가 자리에 보인다 — 미니맵(좌상 빈 사각형)·메뉴 ≡(우상)·스킬 그리드 6칸(우하). 보스 HP 바는 기본 비활성이라 인게임에선 보이지 않는다.
- [ ] placeholder는 **클릭·기능 반응이 없다**(메뉴 ≡ 눌러도 아무 일 없음 — 일시정지 미배선).
