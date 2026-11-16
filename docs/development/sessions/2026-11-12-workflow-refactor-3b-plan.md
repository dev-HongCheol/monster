# 워크플로 문서 리팩터 3b — `.meta` 규칙의 주인을 색인되는 정본으로 세우고 README에 명령 두 개를 적는다

- **작성:** 2026-11-12
- **상태:** 계획
- **정본:** [`spec/ops-cocos-assets.md`](../spec/ops-cocos-assets.md)(새로 만듦) · [`design/spec/art-asset-spec.md`](../../design/spec/art-asset-spec.md) §9.3 · [`workflow/implementation.md`](../workflow/implementation.md) · [`workflow/README.md`](../workflow/README.md) — `.meta` 규칙의 배경 · 원칙 · 이유를 한 정본으로 모은다
- **백로그:** F121 합계 문장을 고쳐 쓰고, F160 출처 칸에 이 문서 §5 링크를 더하며, `.meta` 쓰기를 훅으로 막는 일을 F161로, 코드 리뷰가 찾은 `wf canon` 템플릿 문구를 F162로 새로 남긴다
- **고치는 파일(9, 상태 파일 `.claude/workflow-state.json` 제외):** `docs/development/spec/ops-cocos-assets.md`(새로) · `docs/development/spec/README.md`(`wf canon`이 등재) · `docs/design/spec/art-asset-spec.md` · `docs/development/workflow/implementation.md` · `docs/development/workflow/README.md` · `docs/development/backlog-docs.md` · `docs/development/backlog-implement.md` · 이 문서(`docs/development/sessions/2026-11-12-workflow-refactor-3b-plan.md`) · `docs/qa/workflow-refactor-3b-review-issues.md`(리뷰 기록, 새로)

---

## 1. 왜 하나

리팩터 6단계는 `CLAUDE.md` 「에셋 `.meta` 관리 규칙」 절을 한 줄과 포인터로 줄인다. 그 포인터가 가리킬 주인이 지금은 없다. `art-asset-spec.md` §9.3과 `implementation.md`도 `CLAUDE.md`를 주인으로 가리킨다. 3b는 주인을 세우고 두 자리가 주인을 가리키게 한다.

README에 명령 두 개를 적는 일도 3b가 한다. 7단계가 `CLAUDE.md` 명령 표를 줄이면, 배달 문서에 이름이 나오지 않는 `pnpm wf check-links`와 `pnpm typecheck`를 절차 폴더 안에서는 찾을 곳이 없어지기 때문이다.

## 2. 뒤집는 결정

**`.meta` 규칙의 주인은 `workflow/README.md`가 아니라 새 정본 `spec/ops-cocos-assets.md`다**(사용자 결정 2026-11-12). 처음 요구와 [3a 계획](2026-11-11-workflow-refactor-3-plan.md) §5의 3b 줄은 「README에 `.meta` 규칙 절」이었다. 그런데 gbrain은 이름이 `README.md`인 파일을 색인에서 빼고 설정으로도 풀 수 없다([`ops-gbrain.md`](../spec/ops-gbrain.md) §5.8, 백로그 F85). 규칙 본문을 README에 두면 「`.meta`가 왜 이렇게 되어 있나」를 의미 검색으로 물을 때 본문에 닿지 못한다.

**F160 출처 칸은 머지 때가 아니라 구현 phase에서 바꾼다.** 3a 계획 §5는 「머지할 때」라고 적었지만, [`pr-ready.md`](../workflow/pr-ready.md) 첫머리와 [`user-verification.md`](../workflow/user-verification.md) §1은 Draft PR 뒤에 상태 표시만 바꾸게 한다. 머지 때 바꾸면 사용자가 보지 않은 변경이 머지된다.

## 3. 고치는 문장

| 파일 · 자리 | 지금 | 고친 뒤 |
|---|---|---|
| `spec/ops-cocos-assets.md`(새로) | — | 표 아래 「정본 만들기 명령」으로 만들고 본문은 아래 「새 정본 본문」대로 쓴다. 템플릿의 안내 두 줄은 남긴다 |
| [`art-asset-spec.md`](../../design/spec/art-asset-spec.md) §9.3 본문(545행) | 「**AI는 `.meta`를 직접 만들지 않는다.** `.meta`는 Cocos가 … 상세 규칙은 CLAUDE.md의 「에셋 `.meta` 관리 규칙」이 정본이다.」 | 「**AI는 `.meta`를 직접 만들지 않는다.** `.meta`가 하는 일, 커밋해야 하는 이유, AI가 만들지 않는 이유는 [`../../development/spec/ops-cocos-assets.md`](../../development/spec/ops-cocos-assets.md)에 있다.」 제목은 그대로 둔다(357행 · 537행이 §9.3을 가리킨다). 지금 문장의 Draft PR · `PR 승인` 시점 문장은 지운다(phase 문서가 맡는다, §4 셋째 줄) |
| 같은 문서 이력 줄 맨 끝(오래된 날짜부터 적혀 있다) | — | 「 · <날짜> `.meta`의 이유는 `ops-cocos-assets.md`에 있다(§9.3)」를 더한다. <날짜>는 `wf canon`이 새 정본의 「최초 작성」에 찍은 날짜와 같게 쓴다(명령을 친 날의 로컬 날짜) |
| [`implementation.md`](../workflow/implementation.md) 21행 | 「(원칙과 근거는 `CLAUDE.md`의 「에셋 `.meta` 관리 규칙」)」 | 「(이유는 [`ops-cocos-assets.md`](../spec/ops-cocos-assets.md))」. 행동 줄과 「테스트와 빌드는 … 경로로 import한다」는 그대로 둔다 |
| [`workflow/README.md`](../workflow/README.md) 「계획에서 머지까지」 절 끝 문단(「어느 검사를 언제 하는지는 …」) 다음 | — | 머리 문장 「따로 치는 검사 명령(배달 문서에는 나오지 않는다):」과 목록 두 줄 「- `pnpm wf check-links` — 마크다운 링크와 앵커를 검사한다(통합 검사에도 들어 있다).」 · 「- `pnpm typecheck` — 타입 검사만 따로 돌린다.」를 더한다. 절은 새로 만들지 않는다. 7단계가 명령을 더할 때 줄만 늘리면 된다 |
| [`backlog-docs.md`](../backlog-docs.md) F121 합계 문장 | 「2026-11-12 실측으로는 파일 내용 합계가 13,420자다(…)」 | 날짜와 숫자를 §6 명령으로 다시 잰 날과 값으로 고쳐 쓴다(문장을 덧붙이지 않는다) |
| [`backlog-implement.md`](../backlog-implement.md) F160 출처 칸 | 3a 계획 §2 · §5를 가리키는 링크 하나 | 표 아래 「F160 출처 칸 전문」으로 바꾼다 |
| 같은 문서 F-5 절, F160 행 바로 아래 | — | 표 아래 「F161 행 전문」을 더한다. 번호는 `git fetch` 뒤 `origin/main` 기준으로 백로그 셋과 아카이브 둘에서 비어 있는지 다시 본다 |
| `backlog-docs.md` 「문서 규칙 · 절차 문서」 표, F158 행 바로 아래 | — | F162(`wf canon` 템플릿 안내 문장의 「든다」를 고친다)를 더한다. 코드 리뷰에서 나온 항목이다(리뷰 기록 Minor 5) |

**정본 만들기 명령**(Bash 도구로 친다. 셸이 제목의 백틱을 명령으로 읽지 않도록 작은따옴표로 감싼다):

```
pnpm wf canon ops-cocos-assets 'Cocos 에셋과 `.meta`' 'Cocos 에셋의 `.meta`는 누가 만들고, 왜 커밋해야 하나'
```

**F160 출처 칸 전문**(`backlog-implement.md` F160 행의 마지막 칸):

```md
| [`sessions/2026-11-11-workflow-refactor-3-plan.md`](sessions/2026-11-11-workflow-refactor-3-plan.md) §2 · §5, [`sessions/2026-11-12-workflow-refactor-3b-plan.md`](sessions/2026-11-12-workflow-refactor-3b-plan.md) §5 |
```

**F161 행 전문**(`backlog-implement.md` F-5 절, F160 행 바로 아래):

```md
| F161 | 열림 | 중(6단계 전) | 🔧 `game/assets/` 아래 `.meta`를 AI가 쓰지 못하게 훅으로 막는다 | AI가 Write · Edit · MultiEdit로 `game/assets/**/*.meta`를 만들거나 고치는 것을 훅이 막게 한다. 지금은 `approve-pr` 검사(`listMissingAssetMeta`)가 git이 추적하지 않는 `.meta`만 잡고, 편집 잠금 훅(`gate-scripts.mjs`)은 `.meta`를 어느 phase에서도 막지 않는다. | [`sessions/2026-11-12-workflow-refactor-3b-plan.md`](sessions/2026-11-12-workflow-refactor-3b-plan.md) §5 |
```

새 정본이 맡는 것과 `art-asset-spec.md` §9가 계속 맡는 것의 경계는 이렇다. 새 정본은 `game/assets/` 전체(`.ts` · `.json` · 폴더 포함)에 걸리는 Cocos 임포트와 `.meta`, 버전 관리 조건을 맡는다. §9는 아트의 경로 · 파일명 · 원본 자리를 맡는다.

**새 정본 본문**(템플릿의 `## (본문)` 자리를 아래로 바꾼다):

```md
## 1. `.meta`는 Cocos 에디터만 만든다

`.meta`는 Cocos 에디터만 만들고, AI는 직접 만들지 않는다. 구현하는 동안 새 파일의 `.meta`를 만들지 않는다는 것은 [`../workflow/implementation.md`](../workflow/implementation.md)에, `.meta`가 언제 생기고 언제 커밋되는지는 [`../workflow/user-verification.md`](../workflow/user-verification.md)에 적혀 있다. 아트 파일의 경로 · 파일명 · 원본 자리는 [`../../design/spec/art-asset-spec.md`](../../design/spec/art-asset-spec.md) §9가 맡는다.

## 2. `.meta`가 하는 일

Cocos는 `game/assets/` 아래의 파일과 폴더마다 같은 이름의 `.meta`를 만든다(`body_idle.png`라면 `body_idle.png.meta`). `.meta`에는 그 자산의 UUID와 설정이 들어 있고, 씬과 프리팹은 다른 자산을 경로가 아니라 이 UUID로 가리킨다.

그래서 `.meta`를 커밋하지 않으면, 다른 장비에서 클론한 뒤 Cocos가 그 자산에 `.meta`를 새로 만들면서 UUID도 새로 매긴다. 씬과 프리팹은 옛 UUID를 가리키고 있으므로 참조가 끊긴다. 공식 매뉴얼도 `.meta`를 버전 관리에 함께 올리라고 한다.

> Each file in `assets` generates a `.meta` file with the same name after importing the project, which is used to store the corresponding asset configuration and index information. The `.meta` file needs to be submitted to the version control system as well, …
>
> — [Cocos Creator 3.8 Manual — Project Structure](https://docs.cocos.com/creator/3.8/manual/en/getting-started/project-structure/) (2026-11-12 확인)

## 3. AI가 손으로 만들지 않는 이유

`.meta`에는 UUID 말고도 에디터가 자산을 읽고 채우는 값이 들어 있다. 이미지라면 크기 · 오프셋 · 테두리 값이다([Cocos Creator 3.8 Manual — meta files](https://docs.cocos.com/creator/3.8/manual/en/asset/meta.html), 2026-11-12 확인). 형식만 맞춰 손으로 만들면 이 값이 에디터가 만들 값과 달라질 수 있다. 그래서 이 프로젝트는 Cocos 에디터가 자산을 임포트하면서 만든 `.meta`만 믿는다.

## 4. 커밋을 빠뜨리면 무엇이 막나

루트와 `game/`의 `.gitignore`는 `.meta`를 무시하지 않을 뿐, 커밋을 강제하지는 않는다. `pnpm wf approve-pr`은 git이 추적하는 자산 파일과 그 폴더 가운데 같은 이름의 `.meta`가 추적되지 않는 것을 찾으면 `pr-ready`로 넘어가지 못하게 한다(PR 승인이 거부된다). 머지 자체를 막는 장치는 아니다. 그 검사를 언제 돌리는지는 `.claude/lib/change-set.mjs`의 `META_PATHS`가, 무엇을 검사하는지는 `.claude/workflow.mjs`의 `listMissingAssetMeta`가 정한다. 같은 검사는 `pnpm wf check-meta`로 언제든 돌릴 수 있다.
```

## 4. 받지 않는 것

- **README에 `.meta` 규칙 절을 두는 안:** §2의 이유로 받지 않았다.
- **`art-asset-spec.md` §9.3을 주인으로 키우는 안:** 규칙이 `.ts` · `.json` · 폴더에도 걸리는데 아트 정본이 주인이 되어 받지 않았다.
- **`CLAUDE.md` 절의 시점 표 · 원칙 문단의 7 · 8단계 시점 문장 · 「테스트 · 빌드는 `.meta`가 없어도 동작한다」 괄호 · 게이트 문단을 새 정본에 옮기는 것:** phase 문서와 코드가 이미 맡은 내용이라 옮기면 사본이 하나 는다(F96 「나.」가 짚은 중복).
- **`.claude/workflow.mjs` · `.claude/lib/transition.mjs` · `tools/blender/` 주석과 오류 문구, 루트 `.gitignore` 주석, `user-verification.md` 54행, `art-asset-spec.md` 191 · 515 · 537행:** 자기 동작의 이유이거나 그 순간의 행동 맥락이거나 다른 규칙의 이유라 고치지 않는다. 코드와 `.gitignore`는 고치면 `CSO_PATHS`에 걸려 `/cso` 대상이 된다.
- **`CLAUDE.md`의 「그래서 `.gitignore`도 `*.meta` 추적을 강제한다」:** 틀린 문장이지만 `CLAUDE.md`는 6 · 7단계까지 고치지 않는다. 3b 머지부터 6단계까지 이 문장 하나가 새 정본과 다르고, 그동안은 새 정본과 코드가 이긴다.

## 5. 다음 단계에 넘기는 조건

- **모든 단계:**
  - 3a 계획 §5의 두 예외를 다시 적는다. 남은 단계는 문서만 바꾸더라도 `pnpm wf`로 진행하고, 리팩터 동안은 `pr-ready.md` §3의 gbrain 색인 갱신을 건너뛴다(마지막 7단계의 pr-ready에서만 갱신한다). 그동안은 새 정본도 의미 검색에 잡히지 않으므로 리뷰와 확인은 Grep으로 한다.
  - 3a 계획 §5의 나머지 줄(5단계 · 6단계 줄과 「열린 결정」 표)은 그대로 유효하다.
  - 각 단계는 구현 phase에서 F160 출처 칸의 마지막 링크(앞 단계 계획 §5)를 자기 계획 문서 §5로 바꾸고, 3a 계획 §2 · §5 링크는 남긴다. 자기 §5에는 앞 단계 §5에서 아직 유효한 줄을 이어받는다.
  - README에는 새 규칙 본문을 더하지 않고 목록과 포인터만 더한다. gbrain이 `README.md`를 색인에서 빼기 때문이다(F85).
- **6단계:** `CLAUDE.md` `.meta` 절을 줄이기 전에 새 정본과 대조한다. §4 셋째 · 다섯째 줄의 내용은 새 정본에 옮기지 않고, `CLAUDE.md`의 「`.gitignore`도 `*.meta` 추적을 강제한다」 문장은 지운다. 그 밖의 차이는 사실을 확인한 뒤에만 새 정본에 반영하고, 확인되지 않는 문장은 버린다. F161(`.meta` 쓰기 차단 훅)은 6단계 계획 전에 할지 정하고, 하면 `CLAUDE.md`의 `.meta` 줄을 줄일지 지울지를 그때 정한다. F161을 정할 때는 사용자 승인으로 푸는 길, 두 장비 사이 `.meta` 병합 충돌, 거부 메시지(무엇이 · 왜 · 어떻게 고치나와 새 정본 경로), Bash로 쓰는 길(F129), Cocos가 작업 중에 만든 `.meta`, `/cso` 대상임을 함께 본다.
- **7단계:** `CLAUDE.md` 명령 표를 줄일 때 README의 명령 문단에 더할 명령이 있는지 본다. 시작 트리거 설명도 7단계가 문서 작업 경로와 함께 쓴다(3a 계획 §5의 3b 줄).
- **글자 수:** 배달 문서를 고치면 §6 명령으로 다시 재고, F121 행의 합계 문장을 고쳐 쓴다.

## 6. 진행과 확인

세부 순서는 배달되는 절차를 따른다. 이 슬라이스에서 정해 둘 것은 아래와 같다.

- **순서:** `approve-plan` 직후 이 문서를 `git add` 한다. qa-setup에서 `skip-test` · `skip-qa`(사유: 문서만 바뀌고 `game/**` 변경이 없다)를 치고 `ready-impl`로 넘어간다. 구현 phase에서 `pnpm wf canon`으로 새 정본을 만들고 본문을 쓴 뒤 **바로 `git add`** 한다. 링크 검사는 git이 추적하는 파일만 보므로, 새 정본을 추적하기 전에 `pnpm wf verify`나 `start-verification`을 돌리면 그 정본을 가리키는 링크가 깨진 링크로 나온다.
- **글자 수:** `implementation.md` 괄호가 링크로 바뀌어 배달 문서 합계가 17자 는다(3a 뒤 13,420자, 상한 13,575자). `workflow/README.md`와 `STEP_DOC_LIMIT` 주석은 문장을 더하면 줄일 문장을 먼저 찾으라고 하지만, 링크로 걸어야 정본 이름이 바뀌었을 때 링크 검사가 잡으므로 늘어나는 것을 받고, 줄이는 일은 F121과 5단계에 맡긴다. 아래 명령(Bash 도구로 친다)으로 재서 F121 행에 적는다.

  ```
  node -e "const fs=require('fs');let t=0;for(const p of ['planning','qa-setup','implementation','verification','user-verification','pr-ready'])t+=fs.readFileSync('docs/development/workflow/'+p+'.md','utf8').replace(/\r\n/g,'\n').length;console.log(t)"
  ```

- **정본 선언:** `start-verification`이 정본 기록을 지우므로 검증 phase에 들어온 뒤 `canon-done`에 `docs/development/spec/ops-cocos-assets.md` · `docs/design/spec/art-asset-spec.md` · `docs/development/workflow/implementation.md` · `docs/development/workflow/README.md`를 넘긴다.
- **확인:**
  - 정본 층에서 `CLAUDE.md`의 그 절을 가리키는 줄이 없다. `git grep -n -e CLAUDE.md --and -e "관리 규칙" -- docs/development/spec docs/design/spec docs/development/workflow`의 출력이 비어 있다(출력 없이 종료 코드 1이면 통과다. 3b 전에는 `art-asset-spec.md` 545행과 `implementation.md` 21행이 나온다).
  - 새 정본이 `CanonDoc.test.ts`를 통과하고 `spec/README.md` 목록에 있다. `wf canon` 직후 새 정본의 제목 · 질문 줄과 `spec/README.md` 목록 행이 백틱까지 의도한 글 그대로인지 본다.
  - `art-asset-spec.md` 이력 항목의 날짜가 새 정본 「최초 작성」 날짜와 같다.
  - README에 적은 두 명령을 한 번씩 실제로 돌려 본다.
  - 세션 문서에는 이 계획의 §1~§6만 옮긴다. 리뷰 도구가 붙인 받은 요구 목록은 옮기지 않는다.
  - phase 문서만 읽고 `.meta` 행동을 끝낼 수 있다. 행동 줄은 phase 문서에 그대로 있고, `implementation.md`의 새 링크는 이유를 보러 갈 때만 쓴다.
  - 새 정본의 사실 문장이 출처와 맞는다. 매뉴얼 두 문장은 Context7로 확인했다(2026-11-12). 폴더 `.meta`는 `game/assets/*.meta`가 추적되는 것으로, `.gitignore` 두 파일과 `META_PATHS` · `listMissingAssetMeta` · `check-meta`는 코드를 읽어 리뷰에서 대조한다.
- **대조표:** AI가 PR 본문에 「계획 문구 · 구현 문구 · 같음」 표를 넣는다. 사용자는 PR 승인 전에 다른 줄만 본다.
