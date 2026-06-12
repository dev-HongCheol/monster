# QA: i18n 키 정합 가드 (i18n-key-guard)

> - **브랜치:** feat/i18n-key-guard
> - **계획:** [2026-06-11-i18n-key-guard-plan.md](../development/sessions/2026-06-11-i18n-key-guard-plan.md)
> - **요약:** `ko.json`/`en.json`이 코드·데이터가 실제 참조하는 키와 어긋나지 않도록 vitest 가드로 강제한다. 누락 키(플레이어 생키 노출)·고아 키·ko↔en 불일치·param 토큰 불일치를 CI에서 RED로 차단한다. **런타임·씬·프리팹·데이터 변경 0**, 코드 생성·타입 변경 0. 유일한 소스 변경은 `EnhancementLogic.ts`의 `SLICE_OPTIONS`에 `export` 한 단어를 붙여 가드 도메인을 진실 출처와 일치시키는 것뿐이다.

---

## 1. Impact Map (회귀 기준)

| 변경 파일 | 확인 범위 |
|-----------|----------|
| `logic/I18nKeyGuard.ts` | **신규** 순수 가드 함수 `findCatalogIssues`. cc import 없음. 파일을 읽는 부분은 테스트가 맡고 가드는 이미 읽힌 입력만 받는다. |
| `tests/logic/I18nKeyGuard.test.ts` | **신규** fixture 단위 테스트 + 실제 카탈로그 게이트. `game/assets/` 밖이라 `.meta` 없음. |
| `logic/EnhancementLogic.ts` | `const SLICE_OPTIONS` → `export const SLICE_OPTIONS` **한 단어만 추가.** 동작 무변경 — 카드 생성·factor·발사체 로직·기존 테스트 전부 불변(회귀 확인). |

> **런타임·API·씬·프리팹·데이터 변경 0.** `t()` 시그니처·호출부·카탈로그 내용 전부 그대로다. 가드는 테스트·CI 게이트만 추가하며 게임 실행 경로를 건드리지 않는다.

---

## 2. 씬/프리팹 변경 사항

**없음.** 신규 노드·프리팹 없음. 가드는 빌드·런타임에 포함되지 않는 순수 로직 + 테스트라 씬 작업이 필요 없다.

## 3. 에디터 연결 체크리스트

**없음.** 신규 `@property` 없음. 에디터 작업 0.

---

## 4. 자동 테스트로 검증 (순수 로직 — `tests/logic/I18nKeyGuard.test.ts`)

> **GREEN 통과:** 피처 테스트 9/9 + 전체 스위트 164/164. 통과 커밋 SHA는 커밋 후 기재.

### fixture 단위 테스트 (인위 입력으로 이슈 4종 + allowlist 검증)
- [x] 정합한 입력은 이슈 0건을 반환한다.
- [x] **missing**: 코드·데이터가 쓰는 키가 ko에 없으면 그 키만 플래그한다(최우선). 다른 이슈는 안 생긴다.
- [x] **orphan**: ko에 있으나 코드 어디서도 안 쓰는 키를 플래그한다.
- [x] **orphan 제외**: `sceneKeyPrefixes`(`menu.`/`result.`/`gameover.`)로 시작하는 씬 라벨 키는 고아로 보지 않는다(.ts에 없어도 오탐 방지).
- [x] **enOrphan**: en에만 있고 ko에 없는 키를 플래그한다(ko 폴백 불가 = en 오타).
- [x] **paramMismatch**: en이 ko에 없는 `{token}`을 쓰면 플래그한다(치환 누락). 반대로 en 토큰이 ko의 부분집합이면 정상.
- [x] **upgrade 도메인 갭**: 도메인을 `SLICE_OPTIONS`(damage·cooldown·projectile_count 3종)로 한정하므로 `upgrade.range`/`upgrade.duration` 부재는 어떤 이슈에도 잡히지 않는다(의도된 갭 = 비-이슈).

### 실제 카탈로그 게이트 (영구 CI 게이트)
- [x] 진짜 `ko.json`/`en.json`/`spells.json`/`cards.json`을 읽고 `game/assets/scripts/**/*.ts`를 스캔해 `usedLiterals`를 모은 뒤 `findCatalogIssues`로 **이슈 0건**을 단언한다. 이후 누락·고아·불일치 회귀가 들어오면 RED.

---

## 5. 수동 테스트 체크리스트 (인게임 — 회귀 확인용)

> 가드 슬라이스는 게임 실행 경로를 바꾸지 않는다. 수동 항목은 **회귀가 없는지**만 본다.

### 회귀 (게임 동작 불변)
- [ ] 카드 선택 패널이 기존대로 카드 이름·설명을 한국어로 표시한다(생키 노출 없음).
- [ ] 강화 카드(`마법 강화`/`분류 강화`)·마법 추가 카드·패시브 카드가 기존대로 등장하고 적용된다(`SLICE_OPTIONS` export가 카드 생성을 깨지 않는지 확인).
- [ ] HUD(HP·웨이브·타이머·레벨·XP)가 기존대로 표시된다.

### `.meta` (8단계 PR 승인 시 커밋)
- [ ] 7단계 Cocos 테스트에서 신규 `logic/I18nKeyGuard.ts`의 `.meta`가 생성된다(가드 1개분). 테스트 파일은 `game/assets/` 밖이라 `.meta` 없음.
