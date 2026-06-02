# i18n 기반(자체 경량 t()) 슬라이스 — 기획/설계

- 작성일: 2026-06-02
- 브랜치: `feat/i18n-foundation`
- 상태: ✅ 구현 완료 (계획 승인 → TDD 구현 → 검증 4종 통과 → 사용자 QA → PR). ADR 005로 방식 결정 기록.
- 관련 메모: 다음 슬라이스 = i18n 기반 결정 (2026-06-02)

## 1. 배경 / 목적

1차 한국어, 추후 영어·기타 언어를 지원한다. i18n은 마법이 아니라 **모든 표시 텍스트에 걸친 횡단 관심사**다. 현재 표시 텍스트가 적어(코드 동적 ~5곳 + 씬 정적 라벨 6개 + JSON 데이터) 틀 까는 비용이 가장 싸고, 로드맵 콘텐츠 단계(마법 16종·적·카드)에서 표시 텍스트가 폭증하므로 그 전에 카탈로그 구조를 갖춰 재추출 공수를 막는다.

## 2. 방식 결정 — 자체 경량 t() (외부 의존성 0)

세 후보 중 **자체 경량 t()** 채택. 근거는 Context7 공식 문서 조회 + Cocos 포럼 조사(2012~2025) 기반.

| 후보 | 채택 | 핵심 이유 |
|------|------|-----------|
| **자체 경량 t()** | ✅ | 평문 JSON(git diff/리뷰 가능), vitest로 lookup·치환 테스트, 재시작 없는 전환, 빌드에서 깨질 에디터 가상 모듈 없음 |
| Cocos 네이티브 L10N | ❌ | `db://localization-editor/...` 가상 모듈 → vitest(cc-free) import 불가, CLI 빌드 깨짐 전력(구 i18n 패키지 `LanguageData` 사례), 언어 변경 시 게임 재시작, 데이터가 에디터 패널 관리라 리뷰 곤란 |
| 외부 라이브러리(i18next 등) | ❌ | Cocos 런타임용 아님 → 번들링·Label 바인딩 어댑터 직접 작성, 작은 게임에 의존성 과함 |

### 조사 핵심 발견
- **Cocos i18n의 진짜 골칫거리는 문자열 처리가 아니라 폰트/글리프 렌더링**(CJK 글자 렌더 문제 다수). 이건 방식과 무관한 별개 관심사 — 한글 폰트는 이미 확보(게임이 한글 렌더 중), 라틴은 기본 폰트 커버. **이 슬라이스 범위 밖, 단 콘텐츠 단계에서 폰트 글리프 커버리지 체크 필요.**
- 네이티브 L10N `changeLanguage()`는 게임 재시작을 유발(공식 문서 확정).
- 커뮤니티는 역사적으로 자체 구현 다수(LanguageData/LocalizedLabel, LanguageManager 등).

> 이 방식 결정은 **ADR 후보**다. 구현 슬라이스에서 `docs/decisions/005-i18n-approach.md`로 기록한다.

## 3. 스코프 (이 슬라이스)

### 포함
1. **카탈로그**: `game/assets/resources/i18n/ko.json`, `en.json` (문자열 id가 키). ko 전량 채움, **en은 빈/스켈레톤 + ko 폴백**.
   - **스키마(게이트 확정 2026-06-02)**: 소스 언어(ko)는 키당 **객체** `{ message, desc, params }` — `desc`는 번역 맥락 노트(오번역 방지), `params`는 치환 토큰 목록. 타겟 언어(en 등)는 **순수** `{ key: messageString }`. `t()`는 `typeof entry === 'object' ? entry.message : entry`로 둘 다 처리(키당 객체/문자열 혼용 허용). `desc`/`params`는 런타임 무시(번들에 실리나 크기 미미).
2. **순수 로직** `logic/I18nLogic.ts`: 카탈로그 lookup + `{param}` 치환 + 폴백(활성 언어 미스 → ko → 키 자체). vitest 테스트.
3. **싱글톤** `systems/I18n.ts`: 활성 언어 보유, `resources`로 카탈로그 로드, `t(key, params)` 노출, `setLanguage(lang)` API(전환 시 LocalizedLabel 갱신). 기본 ko.
4. **UI 래퍼** `ui/LocalizedLabel.ts`: `@property key`(+ 선택 params) → `onEnable`/언어 변경 시 `Label.string = t(key, params)`.
5. **마이그레이션 — 코드 동적 문자열**:
   - `ResultController`: `승리! {wave}웨이브 도달` / `{wave}웨이브 도달` → 키 + params
   - `HudController`: HP/Wave/Lv/XP/timer 라벨 → 파라미터 메시지 템플릿(어순 데모)
   - `DeckLogic`: 합성 `description`과 `CATEGORY_LABEL`을 **로직에서 제거** → 키 + params 산출, 표시 해석은 `CardSelectPanel`(UI)에서 `t()`. **컨벤션의 대표 사례.**
6. **마이그레이션 — 씬 정적 라벨**: `PLAY`, `RETRY`, `MENU`, `MONSTER`, `GAME OVER`, `0웨이브 도달` 등 → `LocalizedLabel` 컴포넌트(에디터 연결은 7단계 사용자).
7. **컨벤션 문서화**: `docs/development/conventions.md`에 "logic/엔 표시 문자열 금지 — 키/구조화 데이터만 산출, 표시는 UI가 t()로 해석" 규칙 추가.

### 데이터(JSON) name/description 처리 — ✅ 확정: id 파생 키 (포함)
`spells.json`/`cards.json`은 `id`+수치만 언어 중립으로 두고, name/description은 **id 파생 키**(`spell.fireball.name`, `spell.fireball.desc`)로 카탈로그 참조. DataManager/UI가 t()로 해석 → 데이터 파일은 언어 중립 유지. ISpellData/ICardData에서 표시 문자열 필드 제거(또는 키 필드화), DataManager·소비처 파급(~5파일) 포함. (승인 게이트 결정 2026-06-02)

### 제외(후속)
- 언어 전환 **UI**(설정 화면 미존재) — `setLanguage` API만 구축, 기본 ko 고정.
- en 전량 번역(나중에 `en.json` 값만 채움).
- 폰트 글리프 커버리지 작업(별개 관심사).

## 4. 컨벤션 (확정)
- **`logic/` 순수 로직엔 사용자 표시 문자열을 두지 않는다.** logic은 키/구조화 데이터만 산출, 표시는 UI에서 `t()`로 해석.
- 조합형 문자열은 단순 연결 말고 **파라미터 메시지 템플릿**(`{param}`)으로 — 언어별 어순/조사 차이 흡수.
- 카탈로그 키는 안정적 식별자(`result.victory`, `card.add_magic`, `spell.<id>.name`). 콘텐츠 추가 = 카탈로그 한 줄 + (필요 시) 데이터 한 줄.
- 폴백: 활성 언어 미스 → ko → 키 자체. en 빈 채로도 게임 정상.
- **소스 카탈로그(ko)는 키당 `desc`(번역 맥락 노트)를 단다** — 신규 표시 문구 추가 시 desc도 함께. 타겟 언어 번역 시(특히 AI 번역) 오역 방지용 단일 참조.
- **i18n 라벨은 TTF 폰트 사용**(비트맵 .fnt 금지). 비트맵 폰트는 미리 구운 글자만 그려 다국어 글리프에 부적합. 폰트 글리프 커버리지(언어별 글자를 폰트가 그릴 수 있는지)는 콘텐츠/언어 추가 단계에서 확인.

## 5. 영향 범위 (회귀 기준)
- 신규: `resources/i18n/ko.json`·`en.json`, `logic/I18nLogic.ts`, `systems/I18n.ts`, `ui/LocalizedLabel.ts`
- 수정: `ui/ResultController.ts`, `ui/HudController.ts`, `ui/CardSelectPanel.ts`, `logic/DeckLogic.ts`, (데이터 패턴 확정 시) `systems/DataManager.ts`·`data/GameTypes.ts`, `resources/data/spells.json`·`cards.json`
- 씬: `menu.scene`, `result.scene`, `main.scene` 정적 라벨에 LocalizedLabel 부착(에디터)
- 테스트: `tests/logic/I18n.test.ts`(신규), `DeckLogic`/`MagicAddCard` 테스트는 키/params 산출로 변경 → 갱신

## 6. 미해결 질문 (→ /autoplan)
1. 데이터 JSON name/description 현지화 패턴: id 파생 키 vs `nameKey` 필드.
2. `DeckLogic`/`MagicAddCard` 테스트가 한글 description 단언 → 키/params 단언으로 어떻게 재구성?
3. HUD의 `HP`/`Wave`/`Lv`/`XP` 같은 라틴 약어: 키로 뺄지(완전 i18n) vs 유지(범용 기호로 간주).
4. LocalizedLabel가 언어 변경 시 갱신되는 메커니즘(I18n 싱글톤 구독 vs 씬 순회).

---

## 7. /autoplan 리뷰 결과 (2026-06-02, 인라인·Codex 부재)

> Codex 부재로 듀얼보이스는 단일 모델. 슬라이스 규모상 콜드 서브에이전트 스폰 없이 인라인 풀뎁스 리뷰. 자동결정은 6원칙(완전성·blast radius·실용·DRY·명시성·행동편향) 적용.

### 7.1 전제 (Phase 1 게이트 — 사용자 확인 필요)
1. i18n 틀을 **콘텐츠 단계 전 지금** 깐다(재추출 공수 최소 시점). — 타당
2. **자체 경량 t()** 채택(네이티브 L10N·외부 lib 배제). — 근거 §2, 확정
3. **ko가 소스/기본**, en은 채울 때까지 ko 폴백. — 확정
4. **logic/엔 표시 문자열 0**(키만 산출), UI가 t()로 해석. — 컨벤션

### 7.2 아키텍처 (Eng 리뷰)
```
resources/i18n/ko.json · en.json          (카탈로그 데이터)
        │ resources.load (async)
        ▼
systems/I18n  (싱글톤, cc)  ──위임──►  logic/I18nLogic  (순수: lookup + {param} 치환 + 폴백체인)
   · isReady / onReady(cb)                  ▲ vitest
   · t(key, params) · setLanguage(lang)     │
   · LocalizedLabel 레지스트리              │
        ├──► ui/LocalizedLabel        (정적 씬 라벨: @property key → label.string)
        ├──► ui/ResultController·HudController·CardSelectPanel  (코드에서 t() 직접)
        └──► (Q1=A 시) DataManager / spells·cards 키 참조
```
- **DeckManager/DeckLogic 패턴 답습**: 싱글톤(cc, 로드·레지스트리) + 순수 로직(lookup·치환·폴백, vitest). cc import는 싱글톤에만.
- **로드 타이밍**: I18n가 startup에 두 카탈로그 `resources.load`, `isReady`/`onReady` 노출. LocalizedLabel는 `onEnable`에 레지스트리 등록 + 즉시 1회 resolve, `onReady`/`setLanguage` 시 레지스트리 순회 refresh → 카탈로그가 라벨보다 늦게 와도 갱신됨.
- **갱신 메커니즘(Q4 확정)**: I18n 싱글톤의 **명시적 레지스트리**(LocalizedLabel가 onEnable 등록 / onDisable·onDestroy 해제, setLanguage·onReady가 순회 refresh). 이벤트 버스/매 프레임 폴링 배제(P5 명시성).
- **폴백체인(I18nLogic.t)**: 활성 언어 미스 → ko → 키 자체. 누락 param 토큰은 `{name}` 그대로 보존(개발 신호).

### 7.3 미해결 질문 해소
- **Q1 데이터 JSON 현지화 = id 파생 키** (✅ 게이트 확정 2026-06-02, 포함): spells·cards는 `id` + 수치/분류만 언어 중립으로 두고, 표시명은 `spell.<id>.name`·`spell.<id>.desc` 카탈로그 키로. 데이터에서 name/description 제거(DRY — 중복 금지). ISpellData/ICardData·DataManager 파급 포함.
- **Q2 테스트 재구성**: `buildDrawPool`이 한글 description 대신 `nameKey`/`descKey`(+ category는 enum 키) 산출 → `MagicAddCard.test`는 `descKey: 'card.add_magic'` + `descParams:{category, tier}` 단언. `CATEGORY_LABEL` 한글맵 → 카탈로그(`category.fire`=화염)로 이전, DeckLogic에서 제거. (테스트가 한글 결합에서 풀려 더 견고)
- **Q3 HUD 라틴 약어 = 키화**(P1 완전성): 코드는 `hud.hp`·`hud.wave`·`hud.level`·`hud.xp` 키 사용, 실제 표기("HP" 유지 vs "체력")는 ko 카탈로그 콘텐츠가 결정 → 코드에 하드코딩 0.

### 7.4 실패 모드 레지스트리
| 모드 | 영향 | 완화 |
|------|------|------|
| 카탈로그 로드 실패 | 라벨이 키 노출(크래시 아님) | DataManager처럼 에러 로그, t()는 키 폴백 |
| 라벨이 카탈로그보다 먼저 렌더 | 일시 키/공백 | onReady 레지스트리 refresh |
| 키 누락 | — | ko→키 폴백 |
| LocalizedLabel가 Label 없는 노드 | 무동작 | getComponent(Label) null 가드 |
| en 빈 값 | — | ko 폴백(설계 의도) |

### 7.5 테스트 다이어그램 (Section 3)
| 코드패스 | 테스트 |
|----------|--------|
| 카탈로그 lookup 적중 | I18n.test (신규, RED 우선) |
| entry가 객체면 .message 추출, 문자열이면 그대로 | I18n.test |
| 활성 언어 미스 → ko 폴백 | I18n.test |
| ko·en 둘 다 미스 → 키 반환 | I18n.test |
| `{param}` 단일/다중 치환 | I18n.test |
| 누락 param 토큰 보존 | I18n.test |
| buildDrawPool가 키/params 산출 | MagicAddCard.test (갱신) |
| 씬 라벨 LocalizedLabel 표시 | 수동 QA(7단계) |
| setLanguage('en') 부분 en → 혼합 폴백 | 수동 QA |

### 7.6 NOT in scope (재확인)
언어 전환 UI·en 전량 번역·폰트 글리프 커버리지. (폰트는 콘텐츠 단계 체크 항목으로 이월)

### 7.7 ADR
방식 결정 → 구현 슬라이스에서 `docs/decisions/005-i18n-approach.md` 작성.
