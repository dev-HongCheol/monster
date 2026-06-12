# 계획: i18n 키 정합 가드 (i18n-key-guard)

> - **작성일:** 2026-06-11
> - **브랜치:** feat/i18n-key-guard
> - **상태:** 계획 (승인 대기)
> - **상위 설계:** [ADR 005: i18n 방식 — 자체 경량 t()](../../decisions/005-i18n-approach.md). [i18n 기반 슬라이스 plan](2026-06-02-i18n-foundation-plan.md).
> - **선행:** i18n 기반(자체 경량 t(), PR #17) 머지 완료. 카탈로그·`I18nLogic`·`I18n`·`LocalizedLabel` 기존재.
> - **닫는 백로그 항목:** **C1 (i18n 키 코드젠 + 가드)** — `docs/development/backlog.md` §C. 이번에는 **가드 부분만** 닫고, "타입 코드젠"은 의도적으로 범위에서 제외한다(아래 §1 근거).

---

## 0. 목표 (한 줄)

`ko.json`/`en.json`이 **코드·데이터가 실제로 참조하는 키와 어긋나지 않도록** vitest 가드로 강제한다. 누락 키(플레이어에게 생키 노출)·고아 키·ko↔en 불일치·파라미터 토큰 불일치를 **CI에서 테스트 실패(RED)로 차단**한다. 코드 생성·타입 변경·런타임 변경은 전혀 없다.

---

## 1. 배경 / 왜 가드만 (스코프 결정 2026-06-11)

C1 원안은 "타입 코드젠(`I18nKey` union + typed `t()`) + 가드"였다. 검토 결과 **타입 레이어는 이 프로젝트(AI 주도 개발)에서 얻는 이득이 적다**:

- **자동완성**은 사람이 `t('…')`를 직접 타이핑할 때 생기는 이득인데, 여기서는 AI가 `ko.json`을 읽고 작성하므로 거의 가치가 없다.
- **컴파일 시점 키 오타 차단**은 가치가 있으나, **가드 테스트가 같은 오류를 실패(RED)로 잡아내므로** 효과가 겹친다.
- 반면 비용은 코드 생성기 ~120줄, 생성물 ~150줄, 타입이 붙은 `t()` 호출부 파급, 영향 파일 11개로 작지 않다.

반면 **카탈로그↔코드 드리프트**(고아 키 / 코드가 쓰는데 카탈로그에 없음 / ko·en 불일치)는 **누가 코드를 작성하든 무관하게 반복되는** 버그 유형이고, 지금으로선 이를 막을 안전망이 전혀 없다. 증상은 플레이어가 화면에서 `menu.ply` 같은 **생키 문자열**을 보는 것이다. AI가 여러 세션에 걸쳐 카드·마법을 추가하며 키를 깜빡하거나, ko만 고치고 사용처를 놓치면 반드시 발생한다. (예를 들어 projectile-count 슬라이스에서 `upgrade.projectile_count`를 ko·en 양쪽에 넣어야 하는데 한쪽을 빠뜨렸다면, 현재는 아무도 잡지 못한다.)

→ 따라서 전체에서 정말 중요한 20%(가드)만 원안 대비 약 30% 비용으로 구현한다. 타입 코드젠은 사람이 직접 키를 타이핑하는 비중이 커지면 다시 검토하며, 백로그에 잔여 항목으로 남긴다.

지금이 적기인 이유: 카탈로그가 ~40키로 작고 깨끗할 때 가드를 깔아두면, 콘텐츠 폭증(마법 16종·적·카드) 시점부터 드리프트를 자동 차단한다(ADR 005의 "콘텐츠 전 구조화" 논리 동일).

---

## 2. 키가 만들어지는 방식 (가드 설계 입력)

가드가 "코드·데이터가 참조하는 키 집합"을 알아야 한다. 두 출처다.

**(a) 정적 리터럴 키** — 코드(.ts)에 문자열 그대로 박혀 있다:
- 씬 라벨(LocalizedLabel `@property key`): `menu.*`·`result.*`·`gameover.*` — **.scene에 박혀 있어 .ts에는 없다**(가드의 소스 스캔 범위 밖이라 접두사 허용 목록으로 처리한다).
- UI 코드: `t('hud.hp')` 같은 `hud.*` (`HudController`).
- logic 리터럴: `'card.add_magic'`, `'card.spell_upgrade.{name,desc}'`, `'card.category_upgrade.{name,desc}'` (`EnhancementLogic`).

**(b) 동적 패밀리 키** — template literal로 데이터에서 조립(`DeckLogic`/`EnhancementLogic`):

| 패밀리 | 도메인(데이터/enum) |
|--------|---------------------|
| `spell.<id>.name` | spells.json id |
| `card.<id>.{name,desc}` | cards.json id (정적 카드) |
| `category.<cat>` | `SpellCategory` enum (4) |
| `upgrade.<opt>` | `SLICE_OPTIONS` (damage·cooldown·projectile_count) |

> **의도적 카탈로그 갭(정상):** `UpgradeOption`은 5종이지만 `upgrade.<opt>`는 실제로 `SLICE_OPTIONS` 3종만 조립한다(range·duration은 효과 계층 A3 전까지 동작하지 않는다). 따라서 카탈로그에 `upgrade.range/duration`이 없는 것은 **버그가 아니다** — 가드가 도메인을 `SLICE_OPTIONS`로 잡으므로 자동으로 이슈에서 빠진다.

---

## 3. 설계 — 순수 가드 + 피처 테스트 (코드 생성·타입 변경 없음)

### 3.1 `logic/I18nKeyGuard.ts` (신규, 순수 — cc import 없음)

파일을 읽는 부분은 테스트가 맡고, 가드는 **이미 읽힌 입력만 받는 순수 함수**다.

```
findCatalogIssues(input: {
  ko: Record<string, unknown>;            // ko.json
  en: Record<string, unknown>;            // en.json
  usedLiterals: string[];                 // .ts 소스에서 스캔한 t('...')·nameKey/descKey 리터럴
  spellIds: string[]; cardIds: string[];  // spells.json·cards.json id
  categories: string[]; options: string[];// SpellCategory 값 · SLICE_OPTIONS 값
  sceneKeyPrefixes: string[];             // ['menu.','result.','gameover.'] — 씬 라벨 allowlist
}): I18nKeyIssue[]
```

내부:
- **familyKeys** = `spell.<id>.name` ∀id ∪ `card.<id>.{name,desc}` ∀id ∪ `category.<cat>` ∀cat ∪ `upgrade.<opt>` ∀opt.
- **expected** = `usedLiterals ∪ familyKeys`.
- **이슈 4종(각각 키 목록 반환):**
  1. **missing**: `expected − keys(ko)` — 코드·데이터가 쓰는데 ko에 없음(= 플레이어 생키 노출). **최우선.**
  2. **orphan**: `keys(ko) − expected`, 단 `sceneKeyPrefixes`로 시작하는 키 제외 — ko에 있으나 어디서도 안 씀(죽은 키/오타).
  3. **enOrphan**: `keys(en) − keys(ko)` — en에만 있는 키(= en 오타, ko 폴백도 못 함).
  4. **paramMismatch**: ko·en 공통 키에서 `tokens(en.message) ⊄ tokens(ko.message)` — en이 ko에 없는 `{token}`을 써 치환 누락. (`message` 추출은 `I18nLogic`과 동일 규칙: 객체면 `.message`, 문자열이면 그대로. 토큰 정규식 `/\{(\w+)\}/g`도 동일 재사용.)
- 헬퍼: `extractMessage(entry)`·`extractTokens(msg)`는 `I18nLogic`의 비공개 로직과 동일한 규칙을 따른다(중복이지만 가드를 cc·I18n에서 독립으로 유지하기 위함이다). 또는 `I18nLogic`에서 토큰 정규식만 export해 공유한다 — 구현 시 마찰이 적은 쪽을 택한다.

### 3.2 `tests/logic/I18nKeyGuard.test.ts` (신규 — 피처 테스트, RED 우선)

피처명 PascalCase = `I18nKeyGuard` → ready-impl 게이트 통과.

- **고정 입력(fixture) 단위 테스트** (RED 상태 — 아직 가드 함수가 없음): missing·orphan·enOrphan·paramMismatch 각각에 인위 입력을 1건씩 주입해 정확히 그 이슈만 잡히는지 본다. 씬 접두사와 `SLICE_OPTIONS` 도메인 허용 목록이 정상 동작하는지(`upgrade.range`가 잡히지 않는지) 확인한다.
- **실제 카탈로그 게이트**: 진짜 `ko.json`/`en.json`/`spells.json`/`cards.json`을 읽고 `game/assets/scripts/**/*.ts`를 스캔(`t\(['"]([^'"]+)`, `(?:name|desc)Key:\s*['"]([^'"]+)`)해 `usedLiterals`를 모은 뒤 `findCatalogIssues`로 **이슈 0건임을 단언한다.** 누락·고아·불일치 회귀가 들어오면 실패(RED)한다. 이것이 **영구 CI 게이트**다.

### 3.3 단 하나의 소스 노출 — `SLICE_OPTIONS` export

가드 도메인을 실제 값과 일치시키려고 `EnhancementLogic.ts`의 `const SLICE_OPTIONS`에 **`export` 한 단어만 붙인다.** 동작은 변하지 않고 카드 생성 로직도 그대로다. `SpellCategory`는 이미 export돼 있다. (대안으로 도메인을 테스트에 하드코딩할 수도 있으나, 단일 진실 출처와 어긋날 수 있어 export를 택한다.)

---

## 4. 테스트 (TDD — 순수 로직, 스킵 아님)

가드가 순수 함수이므로 RED에서 GREEN으로 간다. 절차는 §3.2 그대로다. 실제 카탈로그 게이트는 현재 카탈로그가 정합이면 GREEN이고, 이후 회귀가 들어오면 RED가 된다.

---

## 5. Impact Map (회귀 기준)

| 파일 | 변경 | 회귀 확인 |
|------|------|----------|
| `logic/I18nKeyGuard.ts` | **신규** 순수 가드 | — |
| `tests/logic/I18nKeyGuard.test.ts` | **신규** fixture + 실카탈로그 게이트 | — |
| `logic/EnhancementLogic.ts` | `SLICE_OPTIONS`에 `export` 한 단어 | 카드 생성·factor·발사체 로직 전부 불변(기존 테스트 GREEN) |

> **런타임·API·씬·프리팹·데이터 변경은 전혀 없다.** `t()` 시그니처와 호출부, 카탈로그 내용이 모두 그대로다. 신규 `.meta`는 `I18nKeyGuard.ts` 1개분으로, 7단계 Cocos 테스트에서 생성돼 8단계에 커밋된다(`.meta` 규칙). 테스트 파일은 `game/assets/` 밖이라 `.meta`가 없다.

---

## 6. 스코프 밖 (후속)

- **타입 코드젠 / typed `t()`**(C1 원안의 타입 레이어) — AI 주도 개발에서는 이득이 적어 보류한다. 사람이 직접 키를 타이핑하는 비중이 커지면 다시 검토한다. 이에 맞춰 backlog C1을 "가드=완료 / 타입 코드젠=잔여"로 분리해 갱신한다.
- **씬 정적 라벨 키 검증**(`.scene` 파싱) — 1차에서는 접두사 허용 목록으로 우회한다. .scene 키가 ko에서 사라져도 잡지 못하지만, 빈도가 낮고 처리 마찰이 커서 후속으로 미룬다.
- en 전량 번역과 언어 전환 UI는 ADR 005의 스코프 밖으로 유지한다.
- `IEnemyData.name` 키화(백로그 D1)와 DataManager의 zod 검증(D2)은 별개 작업이다.

---

## 7. 백로그·문서 연계

- **부분 종료:** C1의 "가드로 고아·오타 키를 CI에서 차단" 항목을 닫는다. 구현 후 `backlog.md` §C 항목을 취소선이 아니라 **갱신**으로 처리한다 — "가드=완료(본 PR), 타입 코드젠=보류(잔여)"로 적어 히스토리를 보존한다.
- **문서 업데이트 (PR 승인 시 — 이번 슬라이스 필수 산출물):** `docs/development/i18n-guide.md`(i18n 시스템 심층 설명)에 **키 정합 가드 섹션을 추가**한다. 현재 가이드는 init·LocalizedLabel 라이프사이클·런타임 전환·logic/UI 분리·레이스 컨디션만 다룰 뿐 **키↔카탈로그 정합 안전망은 없다.** 그래서 가드를 도입한 뒤 "§7 키 정합 가드 (CI)" 같은 절을 두어, 가드가 잡는 4종(missing/orphan/enOrphan/paramMismatch)·동적 패밀리 도메인 규칙·씬 접두사 허용 목록·`SLICE_OPTIONS` 갭 처리를 기술한다. **워크플로우 9단계(Draft 해제 전 문서 최신화, 워크플로우 §17)에서 가이드를 갱신·push**해 PR diff에 포함시킨다. (이 항목은 본 슬라이스에 한해 가이드 업데이트를 PR에 묶는다.)

---

## 8. 인라인 리뷰 종합 (office-hours fast-path + 스코프 다운)

> 잘 정의된 엔지니어링 가드여서 /autoplan 전체 파이프라인 대신 전제·대안·리스크를 인라인으로 점검한다. 원하면 `/plan-eng-review`를 따로 실행할 수 있다.

**전제(확인됨):**
1. 잡으려는 버그 유형은 카탈로그↔코드 드리프트(플레이어에게 생키 노출)이며, 현재 안전망이 전혀 없다.
2. 키 정합은 데이터(spells/cards.json)·소스 스캔·카탈로그만으로 순수하게 계산할 수 있어 코드 생성이 필요 없다.
3. 타입 레이어는 AI 주도 개발에서 이득이 적으므로 가드만 만든다.

**eng 리스크·완화:**

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | 소스 스캔 정규식이 동적 키(template literal)를 놓침 | 동적 키는 **패밀리 규칙**(데이터 도메인)으로 별도 커버 — 스캔은 리터럴만 |
| 2 | 씬 라벨 키가 .ts에 없어 고아 오탐 | `menu./result./gameover.` prefix allowlist |
| 3 | `upgrade.range/duration` 누락 오탐 | 도메인을 `SLICE_OPTIONS`(3종)로 한정 → 자동 비-이슈 |
| 4 | 토큰/메시지 추출 규칙이 `I18nLogic`과 어긋남 | 동일 규칙(정규식·`.message` 추출) 재사용 또는 공유 export |

**리뷰 종합:** 설계 결함이 없다. 동작이 바뀌지 않고(테스트·게이트만 추가) 영향 범위가 최소라 승인 가능하다.
