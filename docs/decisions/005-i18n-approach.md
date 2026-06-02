# ADR 005: i18n 방식 — 자체 경량 t()

- **날짜:** 2026-06-02
- **상태:** 결정됨
- **관련 설계:** `docs/development/sessions/2026-06-02-i18n-foundation-plan.md`

## 컨텍스트

1차 한국어, 추후 영어·기타 언어를 지원한다. i18n은 마법 같은 한 기능이 아니라 **모든 표시 텍스트에 걸친 횡단 관심사**다. 현재 표시 텍스트가 적은 시점(코드 동적 ~5곳 + 씬 정적 라벨 6개 + JSON 데이터)에 틀을 까는 비용이 가장 싸고, 로드맵 콘텐츠 단계(마법 16종·적·카드)에서 표시 텍스트가 폭증하므로 그 전에 카탈로그 구조를 갖춰 재추출 공수를 막는다.

세 후보를 Context7 공식 문서 + Cocos 포럼 조사(2012~2025) 기반으로 비교했다.

## 결정

**외부 의존성 0의 자체 경량 `t()`를 채택한다.** 평문 JSON 카탈로그(`resources/i18n/<lang>.json`) + 순수 로직(`logic/I18nLogic`) + 싱글톤(`systems/I18n`) + UI 래퍼(`ui/LocalizedLabel`) 구조다.

| 후보 | 채택 | 핵심 이유 |
|------|------|-----------|
| **자체 경량 t()** | ✅ | 평문 JSON(git diff/리뷰 가능), vitest로 lookup·치환 테스트, 재시작 없는 언어 전환, 빌드에서 깨질 에디터 가상 모듈 없음 |
| Cocos 네이티브 L10N | ❌ | `db://localization-editor/...` 가상 모듈 → vitest(cc-free) import 불가, CLI 빌드 깨짐 전력, 언어 변경 시 게임 재시작, 데이터가 에디터 패널 관리라 리뷰 곤란 |
| 외부 라이브러리(i18next 등) | ❌ | Cocos 런타임용 아님 → 번들링·Label 바인딩 어댑터 직접 작성, 작은 게임에 의존성 과함 |

### 조사 핵심 발견

- **Cocos i18n의 진짜 골칫거리는 문자열 처리가 아니라 폰트/글리프 렌더링**(CJK 글자 렌더 문제 다수). 방식과 무관한 별개 관심사 — 한글 폰트는 이미 확보, 라틴은 기본 폰트 커버. **이 슬라이스 범위 밖, 단 콘텐츠/언어 추가 단계에서 폰트 글리프 커버리지 체크 필요.**
- 네이티브 L10N `changeLanguage()`는 게임 재시작을 유발(공식 문서 확정).

## 아키텍처

```
resources/i18n/ko.json · en.json          (카탈로그 데이터)
        │ resources.load (async)
        ▼
systems/I18n  (싱글톤, cc)  ──위임──►  logic/I18nLogic  (순수: lookup + {param} 치환 + 폴백체인)
   · isReady / onReady(cb)                  ▲ vitest
   · t(key, params) · setLanguage(lang)     │
   · LocalizedLabel 레지스트리              │
        ├──► ui/LocalizedLabel        (정적 씬 라벨: @property key → label.string)
        └──► ui/ResultController·HudController·CardSelectPanel  (코드에서 t() 직접)
```

[ADR 002](002-scripts-logic-pattern.md)의 **싱글톤 + 순수 로직** 패턴을 답습한다(DeckManager/DeckLogic과 동형). cc import는 싱글톤(`I18n`)에만 있고, lookup·치환·폴백은 `I18nLogic`에서 vitest로 검증한다.

## 카탈로그 스키마

소스 언어(ko)는 키당 **객체** `{ message, desc?, params? }`, 타겟 언어(en 등)는 **순수 문자열** `{ key: message }`. `t()`는 `typeof entry === 'object' ? entry.message : entry`로 둘 다 처리한다(키당 혼용 허용). `desc`(번역 맥락 노트)·`params`는 런타임 무시 — 번들에 실리나 크기 미미.

```jsonc
// ko.json (소스)
"result.victory": { "message": "승리! {wave}웨이브 도달", "desc": "승리 결과 화면", "params": ["wave"] }
// en.json (타겟)
"result.victory": "Victory! Reached wave {wave}"
```

## 폴백 체인

활성 언어 미스 → ko → 키 자체. en 빈 문자열은 **미번역**으로 보고 ko 폴백(en이 비어도 게임 정상). 누락 param 토큰은 `{name}` 그대로 보존(개발 신호). 카탈로그 로드 실패/지연 시에도 `t()`는 키 폴백으로 크래시 없이 동작.

## 언어 전환 갱신 메커니즘

`I18n` 싱글톤의 **명시적 레지스트리**. `LocalizedLabel`가 `onEnable` 등록 / `onDisable`·`onDestroy` 해제, `setLanguage`·`onReady`가 레지스트리를 순회해 refresh한다. 이벤트 버스/매 프레임 폴링을 배제(명시성). 카탈로그가 라벨보다 늦게 와도 `onReady` refresh로 갱신된다.

## 결과

- 데이터(`spells.json`/`cards.json`)는 `id`+수치만 두는 **언어 중립** 구조가 됐고, 표시명은 id 파생 키로 카탈로그가 보유한다(DRY).
- `logic/`에 표시 문자열 0 — 컨벤션으로 고정(`conventions.md` § 다국어).

## NOT in scope (후속)

언어 전환 UI(설정 화면 미존재 — `setLanguage` API만 구축, 기본 ko 고정), en 전량 번역, 폰트 글리프 커버리지 작업(콘텐츠/언어 추가 단계로 이월).
