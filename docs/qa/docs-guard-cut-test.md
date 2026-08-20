# QA — 문서 검사기 폐기와 예산 지표 교체 (`feat/docs-guard-cut`)

- **브랜치:** `feat/docs-guard-cut`
- **계획:** [`../development/sessions/2026-08-19-docs-guard-cut-plan.md`](../development/sessions/2026-08-19-docs-guard-cut-plan.md)
- **이전 문서:** [`docs-hygiene-test.md`](docs-hygiene-test.md) — 그 슬라이스가 QA 문서 게이트와 `wf start` 기준점 가드를 세웠고, 이번 슬라이스는 반대 방향으로 검사기 셋을 걷어낸다

이 슬라이스는 검사 도구와 문서만 바꾼다. `game/assets/` 아래를 하나도 건드리지 않으므로 씬·프리팹·에셋 절이 비어 있고 그 사유는 아래에 적었다.

---

## 1. Impact Map

| 변경 파일 | 무엇이 바뀌나 | 확인 범위 (회귀 기준) |
|---|---|---|
| `tests/logic/CanonSpecMove.test.ts` (삭제) | 개발 정본 여섯의 이사 단언 20건 | 삭제 후 전체 스위트가 그대로 도는가 · 다른 파일이 이 파일을 import하지 않는가 |
| `tests/logic/ArtCanonMove.test.ts` (삭제) | 아트 정본 셋의 이사 단언 13건 | 위와 같음 |
| `tests/logic/CanonQuoteGuard.test.ts` (삭제) | 인용 형태 검사기의 명세 19건 | 위와 같음 |
| `tests/helpers/LinkCheck.ts` | 뒤쪽 212줄(`CANON_ALIASES`·`ATTRIBUTION_VERBS`·`INLINE_QUOTE`·`findInlineCanonQuotes`와 그 보조 넷)을 걷어낸다 | **링크 검사 39건이 한 건도 안 줄고 그대로 통과하는가** — 링크 검사 코드부는 한 글자도 바뀌지 않아야 한다(머리말 JSDoc은 무엇을 검사하는 파일인지 다시 적으므로 예외다) |
| `tests/logic/DocLinks.test.ts` | 인용 스윕 `it` 1건과 그 import 제거 | 나머지 38건이 그대로 통과하는가 · `wf check-links`가 그대로 도는가 |
| `tests/logic/ClaudeMdSplit.test.ts` | 「크기 예산」 네 단언을 의무 독서 합계 한 단언으로 교체 | 나머지 53건(배달·정본 선언 E2E)이 그대로 통과하는가 · 새 단언이 현재 레포에서 통과하는가 |
| `docs/development/spec/docs-writing-style.md` | 인용 절에서 기계 강제 서술을 걷어내고 규칙과 이유는 남긴다 | 절 앵커를 가리키는 인바운드 링크가 안 깨지는가 |
| `docs/development/spec/docs-references.md` | §12 표의 §3-2 행을 「기계 있음」에서 「불가」로 옮기고 근거를 적는다 | 표가 실제 검사기 목록과 맞는가 |
| `docs/development/backlog-implement.md` | F87·F89·F91 제거, F88 흡수, F90 완료, F82 ② 문장 정정 | 남은 항목의 ID가 하나도 안 바뀌는가(재번호 금지) |
| `docs/development/backlog-implement-archive.md` | 위 다섯을 폐기·완료로 기록 | 폐기 사유가 근거와 함께 남는가 |

**실측 기준선**(계획 §1·§4, `origin/main` `f4eb4b8`): 문서 정책 검사 코드 약 **2,450줄**, 전체 스위트 **49파일 871테스트**(스킵 1 포함), 「항상 읽는다」 문서 합계 **37,845자**, `backlog-implement.md` 항목 텍스트 중 문서·절차 16건이 **9,177자 / 23,452자(39%)**.

## 2. 씬/프리팹 변경 사항

**없다.** `game/assets/` 아래 파일을 하나도 고치지 않는다. 이 슬라이스가 건드리는 것은 `tests/`와 `docs/`뿐이다.

## 3. 에디터 연결 체크리스트

**없다.** 신규 컴포넌트도 `@property`도 없다.

**신규 `.meta` 예상 개수는 0개다.** 이 슬라이스는 파일을 만들지 않고 지우기만 하며, 지우는 것도 `tests/` 아래라 Cocos가 임포트하는 자산이 아니다. 8단계 `pnpm wf check-meta`에서 신규 `.meta`가 잡히면 이 슬라이스와 무관하므로 커밋 전에 무엇인지 먼저 확인한다.

## 4. 자동 검증 (사용자가 할 일 아님 — 기록용)

AI가 6단계에서 다 돌린다. 여기 적는 것은 무엇이 기계로 덮이는지를 사용자가 알기 위해서다.

**통과 근거(2026-08-20, 코드 리뷰 수정 반영 2회차):** 전체 스위트 46파일 816/816(+스킵 1), 타입체크 범위 `full`, biome 종료코드 0(정보 29건은 기존 `hitbox-viewer.html`), `check-links`·`check-docs`·`check-qa` 전부 통과. 이 슬라이스는 피처 테스트가 없다(`wf skip-test` 사유는 상태 파일에 있다) — 회귀는 `DocLinks` 38건과 `ClaudeMdSplit` 56건이 받는다.

> 1회차(2026-08-19) 근거도 같은 수치였다. 2회차를 다시 돌린 이유는 코드 리뷰가 낸 아홉 건을 고치면서 `ClaudeMdSplit.test.ts`의 예산 단언을 리포트 문자열 비교로 바꿨기 때문이다([`docs-guard-cut-review-issues.md`](docs-guard-cut-review-issues.md) I2). 수정 직후 두 가지가 실제로 걸렸다 — 새로 만든 리뷰 이슈 문서가 `git add` 전이라 링크 검사가 `missing-file`로 잡았고(`DocFs.ts`가 존재를 추적 목록으로 재는 설계다), 새 단언의 들여쓰기가 biome 포맷에 걸렸다. 둘 다 닫고 다시 초록이다.

**의무 독서 합계(2026-08-20 실측):** **37,725자** / 상한 38,000자 — 여유 **275자**.

| 문서 | 자수 |
|---|---|
| `CLAUDE.md` | 11,582 |
| `spec/code-conventions.md` | 12,087 |
| `spec/docs-writing-style.md` | 5,616 |
| `spec/docs-references.md` | 8,440 |

재는 방법은 `String.length`(UTF-8 문자열 길이)다. PowerShell로 재면 한국어 문서가 약 1.18배 부풀고 빈 줄이 누락돼 값이 어긋난다. `.gitattributes`의 `* text=auto eol=lf`가 CRLF 유입을 막으므로 어느 머신에서 재도 같은 값이 나온다.

- [x] `pnpm vitest run` — 전체 스위트. 파일 49→46, 테스트 871→817. **줄어든 54건의 내역이 맞는가**를 확인했다: 삭제한 세 파일이 52건(`CanonSpecMove` 20 · `ArtCanonMove` 13 · `CanonQuoteGuard` 19 — 삭제 전 상태에서 직접 돌려 쟀다), 인용 스윕 1건, `ClaudeMdSplit` 순감 1건(예산 4단언을 3단언으로 교체). 계획 단계의 추정치(41건)는 틀렸고 실측이 52건이다
- [x] `pnpm vitest run tests/logic/DocLinks.test.ts` — 39건에서 38건으로만 줄고 전부 통과한다. `LinkCheck.ts` 앞쪽 링크 검사부는 한 글자도 안 바뀌었다
- [x] `pnpm wf check-links` — 깨진 링크 0건
- [x] `pnpm wf check-docs` — 절차 문서 정합(phase 6개 + README)
- [x] `pnpm wf check-qa` — 이 문서 자신에 대해 통과한다
- [x] `pnpm typecheck` — 범위 `full`(두 프로젝트 통과). `LinkCheck.ts`에서 사라진 export 넷을 부르던 자리가 남지 않았다
- [x] `pnpm check` — biome 종료코드 0. 미사용 import 없음(정보 29건은 기존 `hitbox-viewer.html`의 `useTemplate`으로 종료코드에 영향이 없다)
- [x] 새 예산 단언이 실제로 막는가 — `docs-references.md`에 300자를 더해 합계를 38,147자로 올리자 `expected 38147 to be less than or equal to 38000`으로 **빨개졌고**, 되돌리니 통과했다. 단언이 장식이 아니다
- [x] 실패 메시지가 무엇을 해야 하는지 말하는가(2회차 추가) — 상한을 37,000으로 잠시 내려 재현했다. 한 줄 요약은 잘리지만 그 아래 diff 블록이 **파일별 자수 넷과 「쪼개서는 통과할 수 없다」 지시문, 경위 문서 경로까지 전부** 낸다. `DocLinks.test.ts`의 죽은 링크 단언이 배열 대신 문자열을 비교하는 것과 같은 이유이고 같은 동작이다
- [x] 이 슬라이스 자신이 예산에 걸렸다 — 정본 수정 초판이 합계를 38,008자로 밀어 올려 실제로 막혔다. 상한을 올리지 않고 설명을 압축하고 `docs-references.md` §13의 소급 재고표(F88 폐기로 목적이 사라진 표)를 걷어 **37,719자**로 내렸다

## 5. 수동 테스트 체크리스트

인게임 동작을 바꾸지 않으므로 게임을 켤 일이 없다. 확인할 것은 **다음 슬라이스에서 당신이 지나갈 관문이 그대로인가** 둘뿐이다.

- [ ] `pnpm wf check-links`를 직접 돌린다. 인용 검사기를 걷어낸 뒤에도 링크 검사가 그대로 돈다(이 커맨드가 부르는 것은 `DocLinks.test.ts`이고, 그 파일은 남는다)
- [ ] `docs/development/spec/docs-writing-style.md`의 인용 절을 읽는다. **규칙은 그대로 있고 "기계가 잡는다"는 말만 없다** — 앞으로 이 규칙은 코드 리뷰가 받는다는 것이 문장으로 읽히는가

## 6. 이번에 확정한 것

**(확정)** 검사기 채택 기준은 「이 규칙이 깨지면 AI가 틀린 코드를 짜거나 낡은 문서를 정본으로 읽는가」다. 계획 §2가 근거를 들고, 이 기준으로 지운 것과 남긴 것이 계획 §3·§5에 갈려 있다.

**(확정)** 크기 예산은 없애지 않고 **재는 대상을 바꾼다.** `CLAUDE.md` 자수는 쪼개면 통과하는 지표라 실제로 8월 18일에 그렇게 통과했고(감시 지표 −2,280자, 실제 비용 +8,519자), 그 통과가 다시 F91을 낳았다. 새 단언은 「항상 읽는다」로 지정된 문서 전체의 합계를 재므로 쪼개서는 통과할 수 없다.

**(확정)** 상한은 38,000자다. 현재 **37,725자**라 여유가 **275자**뿐인데, 이것은 의도한 것이다 — 다음에 무엇을 「항상 읽는다」로 올리려면 같은 분량을 덜어내야 한다. 다만 이 여유는 0.7%라 정본 유지보수 몇 번이면 닿는다. **걸렸을 때 상한을 올리면 이 단언이 태어난 이유가 사라지므로**, 덜어낼 후보를 미리 정하는 일을 `backlog-implement.md` F96으로 남겼다.

**(확정)** 이 슬라이스는 삭제를 단언하는 테스트를 만들지 않는다. 그런 파일을 만들면 지금 지우는 `CanonSpecMove`·`ArtCanonMove`와 똑같은 과거-사건 단언이 하나 더 생긴다. 삭제가 유지되는지는 이 QA 문서와 아카이브 기록이 든다.
