# QA — 문서끼리의 참조 규칙 정본화 (`feat/docs-references`)

- **브랜치:** `feat/docs-references`
- **계획:** [`../development/sessions/2026-08-18-docs-references-plan.md`](../development/sessions/2026-08-18-docs-references-plan.md)
- **이전 문서:** [`canon-quote-guard-test.md`](canon-quote-guard-test.md) — 인용 형태 검사기를 세운 직전 슬라이스. 이번 검사기는 그것과 층이 다르다(그쪽은 정본, 이쪽은 결정 기록)

이 슬라이스는 문서와 테스트만 건드린다. `game/assets/` 아래를 하나도 바꾸지 않으므로 씬·프리팹·에셋 절이 비어 있고, 그 사유는 아래에 적었다.

---

## 1. Impact Map

| 변경 파일 | 무엇이 바뀌나 | 확인 범위 (회귀 기준) |
|---|---|---|
| `docs/development/spec/docs-references.md` (신설) | 참조 규칙의 정본. `wf canon`이 뼈대를 만들고 초안 본문을 채운다 | `spec/README.md` 목록에 등재됐는가 · 정본 층 검사 넷(깨진 링크·앵커·결정 기록 링크 금지·인라인 인용)에 걸리지 않는가 |
| `docs/development/spec/README.md` | 목록에 새 행 하나 | 행이 알파벳 순서를 지키는가 · `wf canon`이 넣은 형식과 같은가 |
| `CLAUDE.md` | 「문서 정리 규칙」 절 삭제 + Knowledge Base 표에 행 하나 추가 + `:83`의 낡은 참조 수정 | 크기 예산 둘(14,000자·240줄) · 남은 절 번호와 목차가 어긋나지 않는가 |
| `docs/development/workflow/user-verification.md` | 절차 조항 넷과 도입부를 받는다 | 개당 상한 4,000자 · 절차 문서 합계 16,000자 · `wf check-docs` 정합 |
| `docs/development/workflow/planning.md` | `정본:` 줄 요구와 탈출구 추가, 「내용과 형식은 강제하지 않는다」 수정 | 같은 두 크기 예산 · 이 문서가 배달될 때 실제로 읽히는 내용인가 |
| `docs/development/workflow/pr-ready.md` | `:11`의 낡은 참조를 `user-verification.md`로 수정 | 깨진 링크 0건 |
| `tests/helpers/DocFs.ts` | `loadSessionDocs()` 추가 | 기존 `findTrackedFiles`·`loadDocs` 소비처 넷이 그대로 도는가 |
| `tests/helpers/CanonRef.ts` (신설) | §7 판정 순수 함수 | 디스크를 읽지 않는가(`LinkCheck.ts`와 같은 규약) |
| `tests/logic/DocsReferences.test.ts` (신설) | §7 검사 + 이번 이전의 결과 검증 | — |
| `tests/logic/DocLinks.test.ts` | `:263` 주석의 지목을 새 정본으로 수정 | 기존 단언 전부 그대로 통과 |
| 두 백로그 | `F81` 완료 처리 + 신규 항목 셋 | 항목 ID 중복 없음(`origin/main` 기준) |

## 2. 씬/프리팹 변경 사항

**없다.** `game/assets/` 아래를 하나도 건드리지 않는다. 이 슬라이스가 만드는 것은 마크다운 문서와 `tests/` 아래 TypeScript뿐이고, 둘 다 Cocos가 임포트하는 자산이 아니다.

## 3. 에디터 연결 체크리스트

**없다.** 신규 컴포넌트도 `@property`도 없다.

**신규 `.meta` 예상 개수는 0개다.** `tests/` 아래 파일은 `game/assets/` 밖이라 Cocos가 임포트하지 않고, `docs/` 아래 마크다운도 마찬가지다. 8단계 `pnpm wf check-meta`에서 신규 `.meta`가 잡히면 그것은 이 슬라이스와 무관한 것이므로, 커밋하기 전에 무엇인지 먼저 확인한다.

## 4. 자동 검증 (사용자가 할 일 아님 — 기록용)

AI가 6단계에서 다 돌린다. 여기 적는 것은 무엇이 기계로 덮이는지를 사용자가 알기 위해서다.

- [ ] `pnpm vitest run tests/logic/DocsReferences.test.ts` — §7 검사 + 이전 결과 검증
- [ ] `pnpm vitest run` — 전체 스위트. 특히 `ClaudeMdSplit`(크기 예산 넷)·`DocLinks`(링크·앵커·정본 층 규칙)·`CanonDoc`(정본 등재 형식)
- [ ] `pnpm wf check-links` — 깨진 링크·앵커 0건
- [ ] `pnpm wf check-docs` — 절차 문서 정합
- [ ] `pnpm typecheck`

## 5. 수동 테스트 체크리스트

기계가 못 재는 것만 남겼다. 전부 문서를 읽는 일이고 에디터를 열 필요가 없다.

**새 정본이 혼자 읽히는가**

- [ ] `docs/development/spec/docs-references.md`를 처음부터 끝까지 읽었을 때, 참조 규칙을 알기 위해 `CLAUDE.md`나 세션 문서를 열어야 하는 대목이 없다
- [ ] §3-2가 인용 형식을 `docs-writing-style.md`에 넘기는데, 그 포인터를 타고 갔을 때 실제로 답이 있다(양쪽이 서로 미루지 않는다)
- [ ] §12 표의 「있음/불가」가 지금 레포 상태와 맞다 — §2는 `DocLinks.test.ts`에, §5·§10은 `wf check-links`에, §7은 이번 검사기에 있고, §4·§3-1·§3-3·§6은 검사기가 없다

**`CLAUDE.md`에서 뺀 것이 실제로 다른 데서 읽히는가**

- [ ] `pnpm wf steps user-verification`을 돌리면 옮겨 간 절차 조항 넷이 터미널에 나온다
- [ ] `pnpm wf steps planning`을 돌리면 `정본:` 줄 요구와 `정본: 없음 — <사유>` 탈출구가 나온다
- [ ] `CLAUDE.md`만 읽는 사람이 참조 규칙을 찾아갈 수 있다 — Knowledge Base 표의 새 행이 그 경로다

**검사기가 사람에게 쓸모 있는가**

- [ ] 세션 문서를 하나 만들어 `정본:` 줄 없이 두고 `pnpm vitest run tests/logic/DocsReferences.test.ts`를 돌리면, 실패 메시지만 보고 무엇을 어떻게 고칠지 안다 (확인 후 그 파일은 지운다)
- [ ] 같은 파일에 `- **정본:** 없음` 만 적고(사유 없이) 돌리면 사유를 요구하는 메시지가 나온다

## 6. 이번에 확정한 것

- **§7의 대상은 세션 문서뿐이다.** ADR은 `정본:` 줄을 쓰지 않고 `관련 설계:`를 쓰는 문서가 넷(005~008), 아무 필드도 없는 것이 넷(001~004)이라 개명 비용만 들고 얻는 것이 없다.
- **경계는 파일명의 날짜 `2026-08-18` 이상이다.** 기존 세션 문서 62개는 대상이 아니다.
- **「머리말」은 첫 `---` 이전이다.** 기존 13개가 전부 6~8행에 있어 이 경계로 0건에서 출발한다.
- **완료 항목의 아카이브 이동은 `pr-ready`(9단계)가 소유한다.** 지금까지 `CLAUDE.md:180`(7단계)과 `pr-ready.md:9`(9단계)가 같은 일을 다른 phase에서 하라고 적고 있었다.
