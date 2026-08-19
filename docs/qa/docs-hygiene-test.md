# QA — 문서 규칙 게이트 셋과 blame 무시 목록 (`feat/docs-hygiene`)

- **브랜치:** `feat/docs-hygiene`
- **계획:** [`../development/sessions/2026-08-18-docs-hygiene-plan.md`](../development/sessions/2026-08-18-docs-hygiene-plan.md)
- **이전 문서:** [`eol-policy-test.md`](eol-policy-test.md) — 그 슬라이스가 6단계 절차 1번(자동 검증 체크 + 통과 근거)을 빠뜨린 채 사용자 검증까지 갔고, 이번 슬라이스가 그 누락을 게이트로 막는다

이 슬라이스는 검사 도구와 저장소 설정만 바꾼다. `game/assets/` 아래 파일을 하나도 건드리지 않으므로 씬·프리팹·에셋 절이 비어 있고 그 사유는 아래에 적었다.

---

## 1. Impact Map

| 변경 파일 | 무엇이 바뀌나 | 확인 범위 (회귀 기준) |
|---|---|---|
| `.git-blame-ignore-revs` (신설) | 재정규화 머지 커밋 `9ee8519` 하나를 담는다 | 파일이 루트에 있는가 · SHA가 실재 커밋인가 · `git blame --ignore-revs-file`이 재정규화된 8개 문서에서 이전 커밋을 가리키는가 |
| `docs/development/spec/ops-environment.md` | §5에 로컬 `blame.ignoreRevsFile` 설정 한 줄 | 새 장비 절차를 그대로 따라가면 로컬 `git blame`도 무시 목록을 보는가 |
| `tests/helpers/LinkCheck.ts` | `scrubCode()` export 추가(펜스+스팬 제거 조합). `extractLinks`가 그것을 쓰도록 정리 | `DocLinks.test.ts` 39개가 그대로 통과하는가 — 링크 추출 동작이 한 글자도 안 바뀌어야 한다 |
| `tests/helpers/QaDoc.ts` (신설) | QA 문서 판정 순수 로직 — 자동 검증 절 찾기, 절 안의 미체크 세기, 근거 줄 판정, 미확정 표시 찾기 | fixture 단위 테스트 전부 통과 · 문자열 in/위반 out이라 디스크·상태에 의존하지 않는가 |
| `.claude/workflow.mjs` | ① `check-qa`가 `QaDoc` 판정을 쓰도록 배선(코드 스팬 오탐 제거) ② `pass review` 앞에 자동 검증 절 게이트 ③ `resetVerification`에 절 해시 스냅샷 ④ `ensureFeatureBranch`에 기준점 가드 | `wf status`·`check-docs`·`check-links`가 그대로 도는가 · 기존 phase 전이가 안 깨지는가 |
| `tests/logic/DocsHygiene.test.ts` (신설) | 위 넷의 회귀망 | 스윕 셋 + fixture 전부 통과 · 다른 48개 테스트 파일이 그대로 도는가 |
| `docs/development/spec/docs-references.md` | §12 「기계가 잡는 것」 표에 새 검사기 행 | 표가 실제 검사기 목록과 맞는가 |
| `docs/development/workflow/verification.md` | 절차 1번 문구 둘 교체 — 절 이름, `통과 커밋 SHA` → 날짜 + N/N | `ClaudeMdSplit.test.ts`의 크기 예산이 그대로 통과하는가(순증 약 −11자) |

**실측 기준선**(계획 §2, `origin/main` `9ee8519`): 자동 검증 절을 가진 QA 문서 **46 / 55**, 그 절 안의 미체크 **0건**, 근거 줄이 없는 문서 **15개**, origin보다 뒤처진 로컬 브랜치 **47개**.

## 2. 씬/프리팹 변경 사항

**없다.** `game/assets/` 아래 파일을 하나도 고치지 않는다. 이 슬라이스가 건드리는 것은 `tests/`·`.claude/`·`docs/`와 레포 루트 파일 하나뿐이다.

## 3. 에디터 연결 체크리스트

**없다.** 신규 컴포넌트도 `@property`도 없다.

**신규 `.meta` 예상 개수는 0개다.** 만드는 파일이 `.git-blame-ignore-revs`(레포 루트)와 `tests/` 아래 TypeScript 둘이라 셋 다 Cocos가 임포트하는 자산이 아니다. 8단계 `pnpm wf check-meta`에서 신규 `.meta`가 잡히면 이 슬라이스와 무관하므로 커밋 전에 무엇인지 먼저 확인한다.

## 4. 자동 검증 (사용자가 할 일 아님 — 기록용)

AI가 6단계에서 다 돌린다. 여기 적는 것은 무엇이 기계로 덮이는지를 사용자가 알기 위해서다.

**통과 근거(2026-08-19, 자체 리뷰 반영 후):** 피처 테스트 `DocsHygiene.test.ts` 28/28(+1 스킵 — `WF_QA_DOC` 없을 때 꺼지는 현재-문서 검사), 전체 스위트 49파일 870/870, 타입체크 범위 `full`. 리뷰가 잡은 셋은 [`docs-hygiene-review-issues.md`](docs-hygiene-review-issues.md)에 있고 전부 수정됐다.

- [x] `pnpm vitest run tests/logic/DocsHygiene.test.ts` — 스윕 셋 + fixture + `wf start` 가드 E2E 셋
- [x] `pnpm vitest run` — 전체 스위트. `DocLinks`(39)가 `scrubCode` 추출 뒤에도 그대로 돌고, `ClaudeMdSplit`(57)이 절차 문서 문구 교체 뒤에도 통과한다
- [x] `pnpm wf check-qa` — **이 문서 자신에 대해** 돈다. §7의 코드 스팬 실험이 통과해야 F92가 닫힌 것이다
- [x] `pnpm wf check-links` · `pnpm wf check-docs` — 깨진 링크 0건, 절차 문서 정합(phase 6 + README)
- [x] `pnpm typecheck` — `QaDoc.ts` 신설과 `LinkCheck.ts` export 변경이 두 프로젝트에서 통과한다
- [x] `git blame --ignore-revs-file .git-blame-ignore-revs docs/development/backlog.md`가 재정규화 커밋을 안 가리킨다

## 5. 수동 테스트 체크리스트

인게임 테스트가 아니다. 이 슬라이스가 바꾸는 것은 **당신이 다음 슬라이스를 시작할 때 지나가는 관문**이라, 확인할 것도 그 관문이 실제로 막는가 하나다.

**`wf start` 가드가 낡은 기준점을 막는가**

- [ ] `pnpm wf start docs-hygiene`을 다시 실행한다. 지금 브랜치는 `origin/main`과 같으므로 **막히지 않고** 그대로 전환된다
- [ ] 낡은 브랜치 이름으로 시도한다 — `pnpm wf start cocos-setup`(그 브랜치는 92커밋 뒤처져 있다). **막히고**, 무엇을 하라는 안내가 나온다(ff 머지 또는 다른 이름). 확인 후 `git switch feat/docs-hygiene`으로 돌아온다
- [ ] 안내 문구만 읽고 다음에 무엇을 할지 알 수 있다(SHA나 내부 용어가 아니라 실행할 명령이 적혀 있다)

**blame 무시 목록이 로컬에서도 먹는가**

- [ ] `git config blame.ignoreRevsFile .git-blame-ignore-revs`를 실행한다(`ops-environment.md` §5의 그 줄이다)
- [ ] `git blame docs/development/backlog.md | head -20`을 본다. 줄들이 **재정규화 커밋(`9ee8519`)이 아니라** 그 내용을 실제로 쓴 예전 커밋을 가리킨다
- [ ] GitHub에서 같은 파일의 blame을 연다. 설정 없이도 같은 결과다(GitHub는 파일을 자동으로 읽는다)

**게이트가 실제로 막는가**

- [ ] QA 문서(이 파일) §4의 `[x]` 하나를 `[ ]`로 되돌리고 `pnpm wf check-qa`를 돌린다. **막힌다**. 되돌린 뒤 다시 돌리면 통과한다

## 6. 이번에 확정한 것

**(확정)** 절 판정은 접두어 `^## (\d+\. )?자동`이다. 완전 일치는 55개 중 3개만 잡고, 계획 초판이 제안했던 새 문자열은 2개만 잡아 **가장 최근 문서부터** 검사에서 빠졌다. 접두어는 46개를 덮는다.

**(확정)** 레포 전체 스윕은 **미체크만** 본다. 근거 줄은 15개 문서에 없어서 레포 전체에 걸면 과거 기록을 소급 수정해야 하고, 그것은 `docs-references.md` §9가 금지한다. 근거 줄은 현재 슬라이스 문서에만 CLI가 요구한다. 그래서 이 슬라이스에는 **레거시 예외 목록이 없다** — 얼려 둘 목록 자체가 안 생긴다.

**(확정)** 통과 근거는 날짜 + 피처 N/N + 전체 M/M까지만 요구한다. PR 번호는 게이트가 안 본다 — verification 시점에는 Draft PR이 아직 없다.

## 7. 이 문서 자신이 F92의 실험이다

계획 §3-2가 닫는 오탐은 **미확정 표시를 코드 스팬 안에 써도 게이트가 위반으로 문다**는 것이다. 직전 슬라이스는 그 태그 이름을 아예 안 쓰는 쪽으로 문장을 비틀어 우회했다.

이 문서는 우회하지 않는다. 아래에 그 두 태그를 코드 스팬으로 적어 둔다.

> 미확정 제목·값에는 `(잠정 …)`을, 이름이 안 정해진 것에는 `(가칭 …)`을 붙인다.

**고친 `check-qa`는 이 줄을 위반으로 물면 안 된다.** 물면 F92가 안 닫힌 것이고, 6단계에서 바로 드러난다. 이 문서에 실제 미확정 항목은 없다 — 프리팹·씬 조립 레시피가 없고, 계획이 정한 값이 전부 실측에서 나왔다.
