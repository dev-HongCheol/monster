# 계획: i18n 키 정합 가드 (i18n-key-guard)

> - **작성일:** 2026-06-11
> - **브랜치:** feat/i18n-key-guard
> - **상태:** 계획 (승인 대기)
> - **상위 설계:** [ADR 005: i18n 방식 — 자체 경량 t()](../../decisions/005-i18n-approach.md). [i18n 기반 슬라이스 plan](2026-06-02-i18n-foundation-plan.md).
> - **선행:** i18n 기반(자체 경량 t(), PR #17) 머지 완료. 카탈로그·`I18nLogic`·`I18n`·`LocalizedLabel` 기존재.
> - **닫는 백로그 항목:** **C1 (i18n 키 코드젠 + 가드)** — `docs/development/backlog.md` §C. **가드 부분만** 이번에 닫고, "타입 코드젠"은 의도적으로 스코프 제외(아래 §1 근거).

---

## 0. 목표 (한 줄)

`ko.json`/`en.json`이 **코드·데이터가 실제로 참조하는 키와 어긋나지 않도록** vitest 가드로 강제한다 — 누락 키(플레이어가 생키 노출)·고아 키·ko↔en 불일치·param 토큰 불일치를 **CI에서 RED로 차단**. 코드 생성·타입 변경·런타임 변경 0.

---

## 1. 배경 / 왜 가드만 (스코프 결정 2026-06-11)

C1 원안은 "타입 코드젠(`I18nKey` union + typed `t()`) + 가드"였다. 검토 결과 **타입 레이어는 이 프로젝트(AI-주도 개발)에서 한계효용이 얇다**:

- **자동완성** = 사람이 `t('…')`를 타이핑할 때의 이득. 여기선 AI가 `ko.json`을 읽고 작성 → 거의 무가치.
- **컴파일타임 키 오타 차단** = 가치 있으나 **가드 테스트가 같은 오류를 RED로 잡아** 결과가 중복.
- 비용은 코드젠 ~120줄 + 생성 ~150줄 + typed t() 호출부 파급 + 11파일.

반면 **카탈로그↔코드 드리프트**(고아 키 / 코드가 쓰는데 카탈로그에 없음 / ko·en 불일치)는 **누가 코드를 치든 무관하게 반복되는** 버그류이고, **지금 유일하게 안전망이 0**이다. 증상은 플레이어가 화면에서 `menu.ply` 같은 **생키 문자열**을 보는 것. AI가 여러 세션에 걸쳐 카드·마법을 추가하며 키를 깜빡하거나 ko만 고치고 usage를 놓치면 반드시 발생한다. (예: projectile-count 슬라이스에서 `upgrade.projectile_count`를 ko·en 양쪽에 넣었는데 한쪽을 빠뜨렸다면 현재는 아무도 못 잡는다.)

→ **load-bearing한 20%(가드)만** 싼 값(~30% 비용)에 구현한다. 타입 코드젠은 "사람이 직접 키를 타이핑하는 비중이 커지면" 재검토(백로그 잔여 항목으로 남김).

지금이 적기인 이유: 카탈로그가 ~40키로 작고 깨끗할 때 가드를 깔아두면, 콘텐츠 폭증(마법 16종·적·카드) 시점부터 드리프트를 자동 차단한다(ADR 005의 "콘텐츠 전 구조화" 논리 동일).

---

## 2. 키가 만들어지는 방식 (가드 설계 입력)

가드가 "코드·데이터가 참조하는 키 집합"을 알아야 한다. 두 출처다.

**(a) 정적 리터럴 키** — 코드(.ts)에 문자열 그대로:
- 씬 라벨(LocalizedLabel `@property key`): `menu.*`·`result.*`·`gameover.*` — **.scene에 박혀 .ts엔 없음**(가드의 소스 스캔 밖 → prefix allowlist).
- UI 코드: `t('hud.hp')` 등 `hud.*` (`HudController`).
- logic 리터럴: `'card.add_magic'`, `'card.spell_upgrade.{name,desc}'`, `'card.category_upgrade.{name,desc}'` (`EnhancementLogic`).

**(b) 동적 패밀리 키** — template literal로 데이터에서 조립(`DeckLogic`/`EnhancementLogic`):

| 패밀리 | 도메인(데이터/enum) |
|--------|---------------------|
| `spell.<id>.name` | spells.json id |
| `card.<id>.{name,desc}` | cards.json id (정적 카드) |
| `category.<cat>` | `SpellCategory` enum (4) |
| `upgrade.<opt>` | `SLICE_OPTIONS` (damage·cooldown·projectile_count) |

> **의도적 카탈로그 갭(정상):** `UpgradeOption`은 5종이나 `upgrade.<opt>`는 실제로 `SLICE_OPTIONS` 3종만 조립된다(range·duration은 효과 레이어 A3 전까지 no-op). 카탈로그의 `upgrade.range/duration` 부재는 **버그가 아님** — 가드는 도메인을 `SLICE_OPTIONS`로 잡으므로 자동으로 비-이슈.

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
- 헬퍼: `extractMessage(entry)`, `extractTokens(msg)` — `I18nLogic`의 비공개 로직과 동일 규칙(중복이지만 가드를 cc·I18n 독립으로 유지). 또는 `I18nLogic`에서 토큰 정규식만 export해 공유(impl에서 마찰 적은 쪽).

### 3.2 `tests/logic/I18nKeyGuard.test.ts` (신규 — 피처 테스트, RED 우선)

피처명 PascalCase = `I18nKeyGuard` → ready-impl 게이트 통과.

- **fixture 단위 테스트** (RED: 가드 함수 부재): missing/orphan/enOrphan/paramMismatch 각각 인위 입력 1건 주입 → 정확히 그 이슈만 플래그. 씬 prefix·`SLICE_OPTIONS` 도메인 allowlist가 정상 동작(`upgrade.range` 미플래그) 확인.
- **실제 카탈로그 게이트**: 진짜 `ko.json`/`en.json`/`spells.json`/`cards.json`을 읽고, `game/assets/scripts/**/*.ts`를 스캔(`t\(['"]([^'"]+)`, `(?:name|desc)Key:\s*['"]([^'"]+)`)해 `usedLiterals` 수집 → `findCatalogIssues` → **이슈 0건 단언.** 회귀(누락·고아·불일치) 시 RED. = **영구 CI 게이트.**

### 3.3 단 하나의 소스 노출 — `SLICE_OPTIONS` export

가드 도메인을 실제 값과 일치시키려고 `EnhancementLogic.ts`의 `const SLICE_OPTIONS`를 **`export`**(한 단어). 동작 무변경, 카드 생성 로직 그대로. `SpellCategory`는 이미 export됨. (대안: 테스트에 도메인 하드코딩 — 진실 출처와 어긋날 수 있어 export 선호.)

---

## 4. 테스트 (TDD — 순수 로직, 스킵 아님)

가드가 순수 함수라 RED→GREEN. §3.2 그대로. 실제 카탈로그 게이트는 현 카탈로그가 정합이면 GREEN, 이후 회귀에서 RED.

---

## 5. Impact Map (회귀 기준)

| 파일 | 변경 | 회귀 확인 |
|------|------|----------|
| `logic/I18nKeyGuard.ts` | **신규** 순수 가드 | — |
| `tests/logic/I18nKeyGuard.test.ts` | **신규** fixture + 실카탈로그 게이트 | — |
| `logic/EnhancementLogic.ts` | `SLICE_OPTIONS`에 `export` 한 단어 | 카드 생성·factor·발사체 로직 전부 불변(기존 테스트 GREEN) |

> **런타임·API·씬·프리팹·데이터 변경 0.** `t()` 시그니처, 호출부, 카탈로그 내용 전부 그대로. 신규 `.meta`는 `I18nKeyGuard.ts` 1개분(7단계 Cocos 테스트에서 생성, 8단계 커밋 — `.meta` 규칙). 테스트 파일은 `game/assets/` 밖이라 `.meta` 없음.

---

## 6. 스코프 밖 (후속)

- **타입 코드젠 / typed `t()`** (C1 원안의 타입 레이어) — AI-주도 개발에선 한계효용 얇아 보류. 사람이 직접 키를 타이핑하는 비중이 커지면 재검토. → backlog C1을 "가드=완료 / 타입 코드젠=잔여"로 분리 갱신.
- **씬 정적 라벨 키 검증**(`.scene` 파싱) — 1차는 prefix allowlist로 우회. .scene 키가 ko에서 사라져도 못 잡음(저빈도·고마찰) → 후속.
- en 전량 번역·언어 전환 UI(ADR 005 스코프 밖 유지).
- `IEnemyData.name` 키화(백로그 D1)·DataManager zod 검증(D2) — 별개.

---

## 7. 백로그·문서 연계

- **부분 종료:** C1 "가드로 고아/오타 키 CI 차단"을 닫는다. 구현 후 backlog.md §C 항목을 **갱신**(취소선 아님): "가드=완료(본 PR), 타입 코드젠=보류(잔여)". 히스토리 보존.
- **문서 업데이트 (PR 승인 시 — 이번 슬라이스 필수 산출물):** `docs/development/i18n-guide.md`(i18n 시스템 딥다이브)에 **키 정합 가드 섹션을 추가**한다. 현 가이드는 init·LocalizedLabel 라이프사이클·런타임 전환·logic/UI 분리·레이스 컨디션만 다루고 **키↔카탈로그 정합 안전망은 없다** → 가드 도입 후 "§7 키 정합 가드 (CI)" 같은 절로, 가드가 잡는 4종(missing/orphan/enOrphan/paramMismatch)·동적 패밀리 도메인 규칙·씬 prefix allowlist·`SLICE_OPTIONS` 갭 처리를 기술. **워크플로우 9단계(Draft 해제 전 문서 최신화, 워크플로우 §17)에서 가이드를 갱신·push**해 PR diff에 포함시킨다. (이 항목은 본 슬라이스에 한해 가이드 업데이트를 PR에 묶는다.)

---

## 8. 인라인 리뷰 종합 (office-hours fast-path + 스코프 다운)

> 잘 정의된 엔지니어링 가드라 /autoplan 풀 파이프라인 대신 인라인 전제·대안·리스크 점검. 원하면 `/plan-eng-review` 별도 실행 가능.

**전제(확인됨):**
1. 잡을 버그류 = 카탈로그↔코드 드리프트(플레이어 생키 노출). 현재 안전망 0.
2. 키 정합은 데이터(spells/cards.json)·소스 스캔·카탈로그만으로 순수 계산 가능 — 코드젠 불필요.
3. 타입 레이어는 AI-주도 개발에서 한계효용 얇음 → 가드만.

**eng 리스크·완화:**

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | 소스 스캔 정규식이 동적 키(template literal)를 놓침 | 동적 키는 **패밀리 규칙**(데이터 도메인)으로 별도 커버 — 스캔은 리터럴만 |
| 2 | 씬 라벨 키가 .ts에 없어 고아 오탐 | `menu./result./gameover.` prefix allowlist |
| 3 | `upgrade.range/duration` 누락 오탐 | 도메인을 `SLICE_OPTIONS`(3종)로 한정 → 자동 비-이슈 |
| 4 | 토큰/메시지 추출 규칙이 `I18nLogic`과 어긋남 | 동일 규칙(정규식·`.message` 추출) 재사용 또는 공유 export |

**리뷰 종합:** 설계 결함 0. 동작 무변경(테스트·게이트만 추가), blast radius 최소. 승인 가능.
