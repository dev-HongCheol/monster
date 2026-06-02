# i18n 기반 슬라이스 — QA 테스트 체크리스트

- 브랜치: `feat/i18n-foundation`
- 관련 기획/설계: `docs/development/sessions/2026-06-02-i18n-foundation-plan.md`
- ADR: `docs/decisions/005-i18n-approach.md` (구현 슬라이스에서 작성)

## 자동 테스트로 검증

> **통과 근거:** 피처 테스트(I18nFoundation) **12/12** + 전체 스위트 **60/60** GREEN (`pnpm wf start-verification` 통과). 통과 커밋 SHA: _(커밋 후 기재)_

- [x] `tests/logic/I18nFoundation.test.ts` — I18nLogic lookup·치환·폴백체인 (12 케이스)
  - 객체 엔트리 `.message` 추출 / 문자열 엔트리 그대로
  - 단일·다중 `{param}` 치환, params 미전달·누락 토큰 보존
  - 폴백체인: 활성 언어 → ko → 키 자체, en 빈 문자열 = 미번역 → ko 폴백
- [x] `tests/logic/MagicAddCard.test.ts`(갱신) — `buildDrawPool`가 한글 description 대신 `nameKey`/`descKey`/`descParams`(category 키·tier) 산출, 정적 카드 id 파생 키
- [x] `tests/logic/DeckLogic.test.ts`(갱신) — `makeCard`에서 name/description 제거 (키 산출 반영)

## Impact Map (회귀 기준)

| 변경 파일 | 종류 | 확인 범위 |
|-----------|------|-----------|
| `logic/I18nLogic.ts` | 신규 | 순수 lookup/치환/폴백 — 자동 테스트 |
| `systems/I18n.ts` | 신규 | 카탈로그 `resources.load`, `t()`, `setLanguage()`, 라벨 레지스트리 refresh |
| `ui/LocalizedLabel.ts` | 신규 | `@property key`/params → `Label.string`, onEnable 등록 / onDisable·onDestroy 해제 |
| `resources/i18n/ko.json`·`en.json` | 신규 | 카탈로그 — ko 전량, en 스켈레톤(ko 폴백) |
| `ui/ResultController.ts` | 수정 | 승리/패배 라벨이 `t('result.victory'/'result.defeat', {wave})` |
| `ui/HudController.ts` | 수정 | HP/Wave/timer/Lv/XP 라벨이 `t('hud.*', params)` |
| `ui/CardSelectPanel.ts` | 수정 | 카드 name/desc를 `t(nameKey)`/`t(descKey, descParams)`로 표시 |
| `logic/DeckLogic.ts` | 수정 | `CATEGORY_LABEL`(한글) 제거, magic 카드가 `nameKey`/`descKey`/`descParams` 산출 |
| `systems/DataManager.ts` | 수정 | spells/cards가 name/desc 없이도 로드 (키 파생은 소비처) |
| `data/GameTypes.ts` | 수정 | ISpellData/ICardData에서 `name`/`description` 제거 |
| `resources/data/spells.json`·`cards.json` | 수정 | name/description 제거 (언어 중립) |

회귀 확인 핵심: **표시 텍스트가 이전과 동일하게 보여야 한다**(기본 ko). 마법 추가 카드 설명, HUD 라벨, 결과 화면 문구가 한글로 정상 출력되는지.

## 씬/프리팹 변경 사항

기존 정적 라벨 노드에 **`LocalizedLabel` 컴포넌트를 부착**하고 `key`를 지정한다(라벨 텍스트는 카탈로그가 결정하므로 씬의 `_string` 초기값은 무시됨).

| 씬 | 노드 | 기존 텍스트 | 부착 컴포넌트 | `key` |
|----|------|-------------|---------------|-------|
| menu.scene | (타이틀 Label) | `MONSTER` | LocalizedLabel | `menu.title` |
| menu.scene | PlayButton/Label | `PLAY` | LocalizedLabel | `menu.play` |
| result.scene | RetryButton/Label | `RETRY` | LocalizedLabel | `result.retry` |
| result.scene | MenuButton/Label | `MENU` | LocalizedLabel | `result.menu` |
| main.scene | GAME OVER (Label) | `GAME OVER` | LocalizedLabel | `gameover.title` |
| main.scene | RestartButton/Label | `RESTART` | LocalizedLabel | `gameover.restart` |
| main.scene | (GameOver)MenuButton/Label | `MENU` | LocalizedLabel | `gameover.menu` |

> **동적 라벨은 LocalizedLabel을 붙이지 않는다.** result.scene의 `0웨이브 도달`(waveLabel), main.scene의 `HP:.../Wave.../30s/LevelLabel/XpLabel`은 ResultController·HudController가 코드에서 `t()`로 채운다.

> **I18n 싱글톤 노드 필요.** 각 씬(또는 공통 부트스트랩)에 `I18n` 컴포넌트를 가진 노드가 있어야 카탈로그가 로드된다. DataManager와 같은 노드/계층에 두는 것을 권장.

> **폰트 규칙:** LocalizedLabel을 붙이는 Label은 **TTF 폰트**여야 한다(비트맵 `.fnt` 금지). 기존 라벨이 비트맵 폰트면 TTF로 교체.

## 에디터 연결 체크리스트

`@property` ↔ 노드 매핑 (구현 후 사용자가 에디터에서 연결, ✅/❌ 표시).

### I18n 싱글톤 노드
- [ ] 씬에 `I18n` 컴포넌트 노드 존재 (DataManager 인접 권장)

### LocalizedLabel (각 노드의 컴포넌트 `key` 프로퍼티)
- [ ] menu.scene 타이틀 → `key = menu.title`
- [ ] menu.scene PlayButton Label → `key = menu.play`
- [ ] result.scene RetryButton Label → `key = result.retry`
- [ ] result.scene MenuButton Label → `key = result.menu`
- [ ] main.scene GAME OVER Label → `key = gameover.title`
- [ ] main.scene RestartButton Label → `key = gameover.restart`
- [ ] main.scene GameOver MenuButton Label → `key = gameover.menu`

## 수동 테스트 체크리스트 (인게임)

코드/자동 테스트로 검증 불가한 항목만.

- [ ] **메뉴 화면**: 타이틀 `MONSTER`, 버튼 `PLAY`가 정상 표시된다.
- [ ] **HUD**: 게임 진행 중 HP/Wave/타이머/Lv/XP 라벨이 이전과 동일하게(한글/기존 포맷) 표시된다.
- [ ] **레벨업 카드 선택**: 강화/패시브 카드 이름·설명이 정상 표시된다.
- [ ] **마법 추가 카드**: 미보유 마법 카드 설명이 `신규 마법 추가 (화염 · 1등급)`처럼 분류·등급이 한글로 정상 결합된다.
- [ ] **게임오버 패널**: `GAME OVER`, `RESTART`, `MENU` 정상 표시.
- [ ] **결과 화면**: 승리 시 `승리! N웨이브 도달`, 패배 시 `N웨이브 도달`로 wave 숫자가 치환되어 표시된다. `RETRY`, `MENU` 버튼 정상.
- [ ] **카탈로그 로드 지연 내성**: 라벨이 일시적으로 키/공백으로 보이지 않고, 로드 완료 후 즉시 텍스트가 채워진다(크래시 없음).
- [ ] **(개발 확인) `setLanguage('en')` 부분 번역**: en에 있는 키는 영문, 없는 키는 ko 폴백으로 혼합 표시된다(언어 전환 UI는 이 슬라이스 범위 밖 — 콘솔/임시 호출로 확인).
