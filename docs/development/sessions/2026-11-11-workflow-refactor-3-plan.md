# 워크플로 문서 리팩터 3a — 1·2단계 리뷰 지적을 고치고 다음 단계 조건을 남긴다

- **작성:** 2026-11-11
- **상태:** 완료(2026-11-12, PR #105)
- **정본:** [`spec/code-conventions.md`](../spec/code-conventions.md) · [`workflow/verification.md`](../workflow/verification.md) · [`workflow/user-verification.md`](../workflow/user-verification.md) · [`workflow/qa-setup.md`](../workflow/qa-setup.md) — 1·2단계 독립 리뷰가 짚은 문장을 고친다
- **백로그:** F116 · F121 · F158 · F159를 진척시키고, 하네스 빈틈을 F160으로 새로 남긴다
- **고치는 파일(8, 상태 파일 `.claude/workflow-state.json` 제외):** `docs/development/spec/code-conventions.md` · `docs/development/workflow/verification.md` · `docs/development/workflow/user-verification.md` · `docs/development/workflow/qa-setup.md` · `docs/development/backlog-docs.md` · `docs/development/backlog-implement.md` · 이 문서(`docs/development/sessions/2026-11-11-workflow-refactor-3-plan.md`) · `docs/qa/workflow-refactor-3-review-issues.md`(이 슬라이스의 코드 리뷰 기록, `verification.md` 게이트 2, 새로 만듦)
- **이름:** 브랜치와 파일 이름의 `workflow-refactor-3`은 3a를 가리킨다

---

## 1. 왜 하나

리팩터 1단계(#103)와 2단계(#104)를 머지한 뒤 Claude 서브에이전트가 돌린 독립 리뷰(`git diff 787fbc1 4754a64`)가 지적 열두 개와 확인 필요 하나를 냈다. §3 · §4의 「지적 N」은 그 리뷰의 번호다. 이 슬라이스는 그 지적을 고치고, 다음 단계가 알아야 할 조건을 git에 남긴다.

3단계는 원래 「`workflow/README.md`에 `CLAUDE.md` 내용을 받을 자리를 만든다」였다. 사용자가 검토할 양을 줄이려고 둘로 나눴다(2026-11-11). 이 슬라이스가 3a이고, README에 `.meta` 규칙 절과 사람용 명령 목록을 만드는 일은 3b가 한다.

## 2. 뒤집는 결정

**남은 리팩터 단계는 문서만 바꾸더라도 `pnpm wf`로 진행한다**(사용자 결정 2026-11-11). [1단계 세션 문서](2026-11-10-workflow-docs-refactor.md) §3은 「`pnpm wf`를 거치지 않고 문서 브랜치와 PR로 진행한다」고 적었는데, 그 경로에서는 테스트도 독립 리뷰도 강제되지 않아 1·2단계가 리뷰 없이 머지됐다. 그래서 각 단계가 계획 승인, 통합 검사, 독립 코드 리뷰, PR 승인을 거친다. 이 빈틈을 하네스로 막는 일은 리팩터가 끝난 뒤 F160으로 한다.

## 3. 고치는 문장

| 지적(내용) | 파일 · 자리 | 지금 | 고친 뒤 |
|---|---|---|---|
| 2(2단계 진척을 백로그에 적지 않았다) | [`backlog-docs.md`](../backlog-docs.md) F121 행 설명 칸 끝(출처 칸 앞) | — | 「2026-11-12 실측으로는 파일 내용 합계가 13,420자다(앞의 13,575자 · 15,811자 · 문서별 값은 2026-10-07 실측).」를 더한다. 값은 §7의 명령으로 다시 잰다. 단계별 경위는 적지 않고 출처 칸에 `PR #104`를 더한다 |
| 2(같은 지적) | 같은 문서 F116 행, 「두 파일의 나머지 절과 이력 줄 형태는」으로 시작하는 문장 다음 | — | 「2단계는 `pr-ready.md` gbrain 절에서 사고 이야기 두 건을 걷었다.」를 더하고, 출처 칸에 `PR #104`를 더한다 |
| 4(이력 줄이 실제 범위보다 넓다) | [`code-conventions.md`](../spec/code-conventions.md) 이력 줄 | 「주석 기준을 규칙 표만 남게 줄였다」 | 「「이번에 건드리지 않은 주석은 손대지 않는다」 절을 규칙 표만 남게 줄였다」 |
| 5(같은 말을 되풀이하고 원칙 이름 셋을 옮겨 적었다) | 같은 문서 「설명 주석은 인과를 복원할 수 있게 쓴다」 | 「설명 주석의 원칙(지시 대상 명시 · 인과 고리 · 실패 증상)과 예시는 [링크]에 적혀 있고, 코드 주석에도 그대로 적용한다.」 | 「설명하는 글의 원칙과 예시는 [링크]에 있고, 설명 주석에도 그대로 적용한다.」 링크는 지금 것을 그대로 둔다 |
| 6(파일명 규칙 포인터가 디자인 정본을 빠뜨렸다) | [`verification.md`](../workflow/verification.md) 「그다음 — 정본을 맞춘다」 절, 표 아래 문장 | 「새로 만들 때 파일명을 짓는 규칙은 [`../spec/README.md`](../spec/README.md)에 있다.」 | 「새로 만들 때 파일명 규칙은 [`../spec/README.md`](../spec/README.md)에, 디자인 정본의 접두사는 [`../../design/spec/README.md`](../../design/spec/README.md)에 있다.」 |
| 7(괄호 안 「형식은」이 §11의 내용과 맞지 않는다) | [`user-verification.md`](../workflow/user-verification.md) 「출처에 "이 대화"를 남기지 않는다」 | 「(형식은 [`../spec/docs-references.md`](../spec/docs-references.md) §11)」 | 「(이유와 남기는 자리는 [`../spec/docs-references.md`](../spec/docs-references.md) §11)」 |
| 9(「리뷰는 서브에이전트로」의 코드 리뷰 쪽은 이미 레포에 있다) | [`backlog-docs.md`](../backlog-docs.md) F158 | 「지금 장비 메모리에도 「리뷰는 서브에이전트로 띄운다」 · 「승인 전 초안은 `docs/temp`에 둔다」 · 「QA 문서는 검증 단계에서 채운 뒤 커밋한다」처럼 절차 규칙인데 레포에 없는 것이 더 있다.」 | 「지금 장비 메모리에도 「`/autoplan` 리뷰도 서브에이전트로 띄운다」 · 「문서 경로 PR도 머지 승인을 묻기 전에 `pnpm test`와 독립 리뷰를 돌린다」(F160과 겹친다) · 「승인 전 초안은 `docs/temp`에 둔다」 · 「QA 문서는 검증 단계에서 채운 뒤 커밋한다」처럼 절차 규칙인데 레포에 없는 것이 더 있다.」 둘째 항목은 지금 장비 메모리에만 있는 규칙이라 같은 목록에 더한다 |
| 12(「이전 문서」가 무엇인지 모호하다) | [`qa-setup.md`](../workflow/qa-setup.md) | 「새 문서는 이전 문서를 베끼지 않는다.」 | 「새 문서는 다른 슬라이스의 QA 문서를 베끼지 않는다.」 |
| 확인 필요(압축 뒤 다시 들어오는 것의 설명이 공식 문서와 다르다) | [`backlog-implement.md`](../backlog-implement.md) F159 | 「압축 뒤 다시 들어오는 것은 루트 `CLAUDE.md`뿐이다(Claude Code 공식 문서, 2026-11-10 확인).」 | 「압축 뒤 늘 다시 들어오는 레포 문서는 루트 `CLAUDE.md`와 `paths:` 없는 `.claude/rules/` 파일(이 레포에는 없다)이다(Claude Code 공식 문서 「What survives compaction」 표, 2026-11-12 확인).」 고치기 직전에 그 표(https://code.claude.com/docs/en/context-window#what-survives-compaction)를 다시 연다. 다르면 표 문구대로 고치고 이 행도 함께 고친다. 표가 F159의 전제(압축 뒤 절차 문서가 사라진다)까지 바꾸면 멈추고 사용자에게 알린다 |
| 새 항목(하네스 빈틈) | [`backlog-implement.md`](../backlog-implement.md) F-5 절 | — | 아래 「F160 행 전문」을 F159 바로 아래에 더한다. 번호는 `git fetch` 뒤 `origin/main` 기준으로 백로그 셋과 아카이브 둘(`backlog-archive.md` · `backlog-implement-archive.md`)에서 비어 있는지 확인한 뒤 쓴다. 이미 쓰였으면 다음 빈 번호를 쓰고, `git grep -n F160`으로 찾은 이 문서의 자리를 함께 바꾼다 |

지적 5는 뜻을 바꾸지 않고 같은 말을 줄이는 수정이라 `code-conventions.md`에 이력 항목을 새로 달지 않는다. `CLAUDE.md`에도 비슷한 설명이 있지만 이 문장의 사본이 아니고 뜻도 바뀌지 않아 함께 고치지 않는다. 지적 6은 개발 정본과 접두사가 다른 디자인 정본(`art-` · `ui-`)의 자리도 함께 가리킨다. 지적 12는 5단계가 `qa-setup.md`를 고칠지 아직 정하지 않아(§5 열린 결정) 여기서 고친다.

**F160 행 전문**(`backlog-implement.md` F-5 절, F159 바로 아래):

```md
| F160 | 열림 | 중(리팩터 뒤) | 🔧 문서 작업 경로에도 검사와 독립 리뷰를 강제하고 머지를 막는다 | `wf` 없이 가는 문서 작업 경로에는 테스트도 독립 리뷰도 강제되지 않고, 어느 경로로 갈지 AI가 스스로 정한다. `gh pr merge`를 막는 장치는 두 경로 모두 없다. `wf` 경로에서도 `pass review`는 리뷰를 실제로 했는지 확인하지 않고 상태 파일에 적기만 하며, 머지를 늦추는 것은 Draft 상태뿐인데 이것도 AI가 `gh pr ready`로 풀 수 있다. 워크플로 문서 리팩터 1 · 2단계(#103 · #104)는 문서 작업 경로로 가서 독립 리뷰 없이 머지됐다. 이 항목은 리팩터가 끝난 뒤 처리하고, 그동안 남은 단계(3b~7)는 문서만 바꾸더라도 `pnpm wf`로 진행한다(2026-11-11 사용자 결정). | [`sessions/2026-11-11-workflow-refactor-3-plan.md`](sessions/2026-11-11-workflow-refactor-3-plan.md) §2 · §5 |
```

## 4. 받지 않는 지적

- **지적 1**(`code-conventions.md` 주석 표에 이유 문장을 되살리자): 사용자가 받지 않았다. 그 사고가 기록된 적이 없고, 코드 리뷰 기록 59개에도 그런 지적이 없으며, 규칙은 표와 `CLAUDE.md`에 있다.
- **지적 7의 뒷부분**(백로그 행 불릿에 상세를 옮길 곳으로 `docs/design/` 정본을 되살리자): 그 불릿이 가리키는 [`backlog.md`](../backlog.md) 머리말은 상세를 슬라이스의 `*-review-issues.md` · `*-plan.md`에 두라고 하고, 디자인 정본에는 확인된 것만 적는다. 아직 하지 않은 일의 상세를 디자인 정본으로 옮기라는 옛 문장을 되살리면 두 규칙과 어긋난다.
- **지적 3 · 10**(1단계 세션 문서에 07의 조건과 고정 문구 세 행이 빠졌다): 그 문서는 PR을 올린 기록이라 고치지 않는다([`docs-references.md`](../spec/docs-references.md) §9). 필요한 조건은 §5, 빠진 세 행은 §6에 싣는다.
- **지적 8**(`pr-ready.md` gbrain 절에 지우기로 한 절차 요약 한 문장이 남았다): 다음 문장을 읽으려면 필요해서 둔다.
- **지적 11**(1단계가 `docs-writing-style.md` 인용 규칙 절을 작업 목록 밖에서 정리했다): 알리는 용도라 할 일이 없다.
- **F116 행의 기존 동그라미 숫자:** 이번에 문장을 더하는 행이지만 그 숫자가 든 문장은 고치지 않는다. 이번 수정과 무관한 것은 언급만 한다는 행동 규칙을 따랐다.

## 5. 다음 단계에 넘기는 조건

- **모든 단계:** 3b~7의 계획 문서는 §2의 `wf` 예외와 아래 gbrain 예외를 다시 적는다. 두 예외는 `CLAUDE.md`의 문서 작업 경로와 `pr-ready.md` §3의 기본 절차를 뒤집으므로, 적지 않으면 다음 단계 AI가 기본 절차를 따른다. 각 단계는 머지할 때 F160 행 출처 칸의 §5 링크를 자기 계획 문서 §5로 바꿔, 다음 단계 AI가 백로그에서 가장 최근 조건으로 바로 가게 한다. 이 문서 §2 링크는 남긴다. 1단계 결정을 뒤집은 이유가 이 문서 §2에만 있기 때문이다.
- **3b:** `workflow/README.md`에 `.meta` 규칙 절과 사람용 짧은 명령 목록을 만들고, `implementation.md` · `art-asset-spec.md` §9.3이 그 절을 가리키게 한다. README에는 새 절차를 만들지 않는다. AI가 그 순간 해야 할 행동 줄은 phase 문서에 그대로 둔다. `CLAUDE.md`는 6 · 7단계까지 고치지 않는다. 시작 트리거 설명은 README에 쓰지 않고 7단계로 넘긴다(2026-11-11 사용자 결정). 트리거는 `CLAUDE.md`의 문서 작업 경로와 함께 바뀌어야 하는데, 그 경로를 아직 정하지 않았다. 그래서 1단계 세션 문서 §3 표가 3단계에 넣은 「시작 트리거 설명」은 7단계 일이 된다. 3b는 `pnpm wf start workflow-refactor-3b`로 시작한다. `workflow-refactor-3`을 다시 쓰면 `approve-plan`이 이 문서를 계획 문서로 잡아 3b 계획 없이 통과한다(파일 이름에 피처 이름이 들어 있으면 계획으로 친다).
- **5단계:** 4단계 뒤에 한다(둘 다 `verification.md`를 고친다). `verification.md`의 「선언한다」 표현을 고치더라도 공식 용어 「정본 선언 게이트」는 바꾸지 않는다. 그 말은 `CLAUDE.md` 명령 표, `user-verification.md` §1 「문서 정리」 첫 문단, 루트 `README.md`, `tests/workflow/ClaudeMdSplit.test.ts`의 describe 이름과 그 위 주석이 쓴다.
- **6단계:** `CLAUDE.md` 「행동 규칙」을 줄일 때 절 이름과 「즉시 수정하지 말고 언급만」 줄은 지킨다. `code-conventions.md` 주석 표의 한 행이 「행동 규칙」이라는 이름으로 가리킨다.
- **글자 수:** 배달되는 절차 문서 여섯의 합계는 3a 뒤 13,420자, 상한 13,575자다(여유 155자). 3b~7은 배달 문서를 고치면 §7 명령으로 다시 재고, F121 행에는 새 실측 문장을 덧붙이지 않고 있는 합계 문장을 고쳐 쓴다. 덧붙이면 단계마다 행이 길어진다.
- **gbrain:** 리팩터 동안은 `pr-ready.md` §3의 색인 갱신을 건너뛰고, 끝난 뒤 한 번 한다(사용자 결정 2026-11-11). 마지막 7단계의 pr-ready에서는 `pr-ready.md` §3대로 색인을 갱신한다. 그동안 의미 검색 결과는 Grep으로 다시 확인한다.
- **열린 결정:** 아래 표와 같다.

| 결정 | 정할 때 | 정하면 달라지는 것 |
|---|---|---|
| 리뷰 템플릿을 원문 복사로 할지 프로젝트판으로 새로 쓸지 | 4단계 전 | `verification.md` 「게이트 2」와 F156을 함께 할지 |
| 문체 수정 대상에 `qa-setup.md` · `implementation.md` · README 첫 문단을 더할지 | 5단계 전 | 5단계가 고치는 파일 |
| `CLAUDE.md` 요약 문단 처리 | 6단계 전 | 6단계가 지울 줄 |
| F75(ADR 접기)를 함께 할지 | 6단계 전 | 문서 구조 트리의 `decisions/` 줄 |
| F159(압축 뒤 절차를 다시 넣는 훅)를 먼저 할지 | 6단계 전 | `CLAUDE.md`에 남길 줄을 고르는 기준 |
| F71 관찰 결과(`wf`로 진행한 슬라이스에서 AI가 배달된 절차를 빠뜨린 일이 있었나) | 7단계 전 | 명령 표와 9단계 뼈대를 줄여도 되는지 |
| 코드 없는 문서 항목을 `wf`로 시작할지 문서 경로로 시작할지 | 7단계 전 | 시작 트리거와 문서 작업 경로 문장 |
| 절차 문서 상한(`STEP_DOC_LIMIT`)을 그때 잰 값으로 내릴지 | 리팩터 끝 | 다음 슬라이스가 쓸 수 있는 여유 |

## 6. 테스트가 고정한 문구

전체 표는 [1단계 세션 문서](2026-11-10-workflow-docs-refactor.md) §6에 있다. 그 표에 빠진 세 행은 아래와 같다.

| 대상 | 고정된 것 | 검사하는 곳 |
|---|---|---|
| `CLAUDE.md` · `pr-ready.md` · `user-verification.md` | `CLAUDE.md`에 `### 문서 정리 규칙` 절이 없고, 「문서 정리 규칙」이라는 이름으로 부르던 참조가 남아 있지 않다(`user-verification.md`에는 「`CLAUDE.md`의 「문서 정리 규칙」」이 없다) | `DocsReferences.test.ts` |
| `docs-references.md` | 절 제목 다섯(§2 · §4 · §5 · §9 · §11)이 있다 | `DocsReferences.test.ts` |
| 두 정본 폴더의 모든 정본 | 머리말(제목 · 인용 · 최초 작성 · 상태 · 이력)과 README 목록 등재 순서. 3a가 `code-conventions.md` 이력 줄을 고치므로 이 검사 대상이다(이력 줄이 있는지만 보므로 문구를 고쳐도 통과한다) | `CanonDoc.test.ts` |

## 7. 진행과 확인

세부 순서는 배달되는 절차를 따른다. 이 슬라이스에서 정해 둘 것은 아래와 같다.

- **순서:** `approve-plan` 직후 이 문서를 `git add` 한다. F160 행이 이 문서를 링크하는데, `DocLinks.test.ts`는 git이 추적하는 파일만 보므로, F160 행을 넣은 뒤 이 문서가 추적되지 않은 채 `pnpm wf verify`(implementation부터 돈다)나 `start-verification`을 돌리면 디스크에 있는 이 문서가 「깨진 링크」로 나온다. 이어서 qa-setup에서 `skip-test` · `skip-qa`(사유: 문서만 바뀌고 `game/**` 변경이 없다)를 치고 `ready-impl`로 넘어간다.
- **글자 수:** 지적 6 · 7 · 12가 배달 문서 셋에 89자를 더해 합계가 13,420자가 된다(상한 13,575자). 상한 안이라 이번에는 줄이지 않는다. `ClaudeMdSplit.test.ts`의 `STEP_DOC_LIMIT` 주석은 문장을 더하면 줄일 문장을 먼저 찾으라고 하지만, 이번 PR은 리뷰 지적 수정만 담아 검토 범위를 좁히고 줄이는 일은 F121과 5단계에 맡긴다. 구현 뒤 아래 명령으로 다시 재고, 13,420과 다르면 `git grep -n -e 13,420 -e 155자 -e 89자`로 찾은 자리(F121 행, §5, 이 줄)를 함께 고친다.

  ```
  node -e "const fs=require('fs');let t=0;for(const p of ['planning','qa-setup','implementation','verification','user-verification','pr-ready'])t+=fs.readFileSync('docs/development/workflow/'+p+'.md','utf8').replace(/\r\n/g,'\n').length;console.log(t)"
  ```

- **정본 선언:** `canon-done`에는 `docs/development/spec/code-conventions.md` · `docs/development/workflow/verification.md` · `docs/development/workflow/user-verification.md` · `docs/development/workflow/qa-setup.md`를 넘긴다.
- **gbrain:** `pr-ready.md` §3의 색인 갱신은 §5의 gbrain 줄을 근거로 건너뛴다.
- **대조표:** AI가 PR 본문에 「계획 문구 · 구현 문구 · 같음」 표를 넣는다. 사용자는 PR 승인 전에 다른 줄만 본다.
