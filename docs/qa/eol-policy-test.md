# QA — 줄 끝 정책을 git이 강제하게 한다 (`feat/eol-policy`)

- **브랜치:** `feat/eol-policy`
- **계획:** [`../development/sessions/2026-08-18-eol-policy-plan.md`](../development/sessions/2026-08-18-eol-policy-plan.md)
- **이전 문서:** [`docs-references-test.md`](docs-references-test.md) — 그 슬라이스에서 CRLF 문서가 정본 게이트를 거짓으로 실패시켰고, 이번 슬라이스가 그 뿌리를 닫는다

이 슬라이스는 저장소 설정과 문서의 줄 끝만 바꾼다. `game/assets/` 아래 파일 내용을 하나도 고치지 않으므로 씬·프리팹·에셋 절이 비어 있고, 그 사유는 아래에 적었다.

---

## 1. Impact Map

| 변경 파일 | 무엇이 바뀌나 | 확인 범위 (회귀 기준) |
|---|---|---|
| `.gitattributes` (신설) | 저장소 전체에 `text=auto eol=lf`. 바이너리 확장자 명시, `*.url`만 제외 | 파일이 루트에 있는가 · 전체 규칙 줄을 드는가 · 왜 이 정책인지를 주석이 복원할 수 있는가 |
| 재정규화 대상 문서 8개 | 저장된 바이트가 CRLF에서 LF로. 내용은 한 글자도 안 바뀐다 | 8개 파일의 **본문 diff가 0**인가(줄 끝만 바뀌어야 한다) · `git ls-files --eol`의 `i/` 칸에 `crlf`가 0건인가 |
| 작업 트리의 같은 8개 | 재체크아웃으로 디스크 바이트도 LF가 된다 | `w/` 칸도 `lf`인가 · 파일을 열었을 때 내용이 멀쩡한가 |
| `tests/logic/EolPolicy.test.ts` (신설) | 인덱스 기준 CRLF 0건 + 정책 파일 존재 + 검사가 실제로 돌았는지 | 단언 셋이 전부 통과하는가 · 다른 47개 테스트 파일이 그대로 도는가 |
| `docs/development/backlog-implement.md` | `F72` 완료 표시와 아카이브 이동은 **9단계 몫이라 여기서 하지 않는다** | 이 슬라이스에서는 건드리지 않는다 |

**재정규화 대상 8개와 줄 수**(합계 1,777줄): `art-generation-playbook.md` 965 · `code-i18n.md` 183 · `2026-08-15-canon-quote-guard-plan.md` 179 · `backlog.md` 139 · `etc/init.md` 115 · `etc/plan.md` 95 · `etc/design.md` 52 · `etc/checklist.md` 49.

## 2. 씬/프리팹 변경 사항

**없다.** `game/assets/` 아래 파일의 **내용**을 하나도 고치지 않는다. 다만 `.gitattributes`는 저장소 전체에 걸리므로 그 폴더도 정책 안에 들어온다. 실측상 그 아래 텍스트 파일(`.meta` 101 · `.prefab` 9 · `.scene` 3 · `.ts`·`.json`)은 **이미 전부 LF**라 재정규화로 바뀌는 바이트가 0이다. 그래도 실제로 0인지는 아래 수동 체크리스트가 확인한다.

## 3. 에디터 연결 체크리스트

**없다.** 신규 컴포넌트도 `@property`도 없다.

**신규 `.meta` 예상 개수는 0개다.** 이 슬라이스가 만드는 파일은 `.gitattributes`(레포 루트)와 `tests/` 아래 TypeScript뿐이라 둘 다 Cocos가 임포트하는 자산이 아니다. 8단계 `pnpm wf check-meta`에서 신규 `.meta`가 잡히면 이 슬라이스와 무관한 것이므로, 커밋하기 전에 무엇인지 먼저 확인한다.

## 4. 자동 검증 (사용자가 할 일 아님 — 기록용)

AI가 6단계에서 다 돌린다. 여기 적는 것은 무엇이 기계로 덮이는지를 사용자가 알기 위해서다.

- [ ] `pnpm vitest run tests/logic/EolPolicy.test.ts` — 인덱스 CRLF 0건 + 정책 파일 + 검사 실행 확인
- [ ] `pnpm vitest run` — 전체 스위트. 특히 문서를 읽는 검사들(`DocLinks`·`DocsReferences`·`CanonDoc`·`ClaudeMdSplit`)이 줄 끝이 바뀐 8개 문서에서 그대로 도는가
- [ ] `pnpm wf check-links` — 깨진 링크·앵커 0건
- [ ] `pnpm wf check-docs` — 절차 문서 정합
- [ ] `pnpm typecheck`
- [ ] `git diff --stat`로 재정규화 커밋이 **줄 끝만** 바꿨는지 확인(`git diff --ignore-cr-at-eol`이 비어야 한다)

## 5. 수동 테스트 체크리스트

인게임 테스트가 아니다. 이번에 사용자가 확인할 것은 **Cocos 에디터와 편집기가 새 정책과 부딪히지 않는가** 하나다. 계획이 "Cocos도 LF로 쓴다"를 실측에 근거해 전제하고 있으므로, 그 전제가 실제 도구에서도 유지되는지 보는 자리다.

**Cocos 에디터가 유령 diff를 만들지 않는가**

- [ ] Cocos 에디터로 프로젝트를 연다. 임포트가 끝난 뒤 `git status`가 깨끗하다(에디터가 `.meta`나 씬을 CRLF로 다시 써서 변경으로 잡히지 않는다)
- [ ] `main.scene`을 열고 아무것도 바꾸지 않은 채 저장한다. `git diff main.scene`이 비어 있거나, 나오더라도 줄 끝 때문이 아니다
- [ ] 씬에서 노드를 하나 옮겼다 되돌린 뒤 저장한다. diff가 실제로 바뀐 줄만 담는다

**편집기가 정책을 되돌리지 않는가**

- [ ] `docs/development/backlog.md`를 편집기로 열어 한 줄 고치고 저장한 뒤 `git diff`를 본다. **바꾼 줄만** 나온다(파일 전체가 바뀐 것으로 나오면 그 편집기가 CRLF로 다시 쓴 것이므로 보고한다)
- [ ] 같은 파일을 되돌린다(`git checkout -- docs/development/backlog.md`)

**정책이 실제로 걸렸는가**

- [ ] `git ls-files --eol | grep crlf` 결과가 비어 있다
- [ ] 새 파일을 CRLF로 만들어 `git add` 한 뒤 `git ls-files --eol`로 보면 `i/lf`로 들어간다(확인 후 그 파일은 지운다)

## 6. 이번에 확정한 것

**(확정)** 이 문서에는 미확정 표시가 하나도 없다. 프리팹·씬 조립 레시피가 없고, 계획이 정한 값이 전부 실측에서 나왔기 때문이다 — 확장자별 줄 끝 분포, 재정규화 대상 8개와 1,777줄, `.editorconfig`가 이미 선언한 `end_of_line = lf`가 그것이다.

> 미확정 표시의 이름을 여기 적지 않는 이유가 있다. `pnpm wf check-qa`는 줄 안에 그 문자열이 있는지만 보고 코드 스팬 안팎을 가리지 않으므로, **"미확정 항목이 없다"고 적은 문장 자체가 미확정 표시로 잡혀** 게이트가 거짓으로 실패한다. 실제로 이 문서에서 한 번 났다. 검사기 쪽을 고치는 일은 이 슬라이스 밖이라 백로그로 뗀다.

**(확정)** 정책 범위는 **저장소 전체**다. 원안은 `game/assets/`를 빼려 했는데, 그 폴더의 텍스트 파일이 전부 이미 LF라 뺄 이유가 없고 빼면 `.editorconfig`(`[*]`)와 범위가 어긋난다.
