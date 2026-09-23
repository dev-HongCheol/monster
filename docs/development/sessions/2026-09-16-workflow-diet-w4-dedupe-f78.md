# 워크플로우 다이어트 W4 — 판정 사본 제거 (F78)

- **작성일:** 2026-09-16 (계획 승인 게이트 2026-09-17)
- **브랜치:** `feat/workflow-diet` · worktree `F:\work\monster-wf`
- **상태:** 계획 — `/autoplan` 리뷰 완료·최종 게이트 승인(2026-09-17). 다음은 사용자 `계획 승인` → `pnpm wf approve-plan`
- **정본:** 없음 — 판정 코드의 자리만 옮기고 명세는 바꾸지 않는다. 구현이 무엇을 하는지는 `.claude/lib/*.mjs`의 JSDoc이 든다
- **개요:** [`2026-09-16-workflow-diet-plan.md`](2026-09-16-workflow-diet-plan.md) — 목표·결정·제약·통과 조건과 절 번호(§n)는 그 문서의 것이다

---

#### W4. 판정 사본 제거(F78)

| 원본 | 사본 | 이번에 |
|---|---|---|
| `workflow.mjs`의 `parseCanonSlug`·`assertOneLineField`·`renderCanonDoc`·`insertCanonRow`·`locateCanonListTable`·접두사 상수 | `tests/helpers/CanonDoc.ts` | `.claude/lib/canon.mjs`로 옮긴다(JSDoc 타입, `CanonSlug`는 `@typedef`). `workflow.mjs`와 `CanonDoc.test.ts`가 import하고 `CanonDoc.ts`는 지운다 |
| `workflow.mjs`의 `check-docs` 판정 | `tests/helpers/WorkflowSteps.ts`의 `findStepDocIssues` | `.claude/lib/workflow-steps.mjs`로 옮긴다. `parsePhases`는 옮기지 않고 지운다 — `phases.mjs`가 `PHASES`를 export하는 순간 소스 텍스트를 정규식으로 파싱할 이유가 사라진다. `ClaudeMdSplit.test.ts`의 「parsePhases — fixture」 두 케이스도 지우고 실물 게이트는 `PHASES`를 import한다 |
| `DOC_EXEMPT_PHASES`(CLI `Set`, 헬퍼 배열)·`STEP_DOC_INDEX` | 같은 파일 | `workflow-steps.mjs`에 한 벌. 배열로 통일하고 CLI는 `.includes`로 바꾼다 |
| `workflow.mjs`의 `PHASES`·`EDITABLE_PHASES` | `gate-scripts.mjs`의 `EDITABLE_PHASES` · `WorkflowSteps.ts`의 `parsePhases`(정규식으로 `PHASES`를 파생) | `.claude/lib/phases.mjs`가 `PHASES`·`EDITABLE_PHASES`·`DOC_EXEMPT_PHASES`를 export하고 `workflow.mjs`와 테스트가 import한다. **훅은 import하지 않고 자기 리터럴을 유지한다** — PreToolUse 훅은 lib 로드 실패가 fail-open(경고 후 진행)이고, fail-closed로 바꾸면 `phases.mjs`의 문법 오류 하나가 그 오류를 고치는 편집까지 막는 자기 잠금이 된다(matcher가 `Write|Edit|MultiEdit`). 대신 테스트가 훅 소스의 리터럴과 `phases.mjs`의 export가 같은지 단언한다 — 사본 하나 + 이빨 있는 테스트가 의존성 있는 훅보다 싸다 |

- `tsconfig.tests.json`에 `allowJs: true`를 켠다. 실측(2026-09-17): import를 따라 들어온 `.mjs`만 프로그램에 잡히고, JSDoc이 붙은 export는 타입이 흐르며(잘못된 인자에 TS2345), JSDoc이 없는 export는 `any`가 된다. 그래서 `.claude/lib/*.mjs`의 export 전부에 JSDoc(`@param`·`@returns`·`@typedef`)을 달고 각 파일 첫 줄에 `// @ts-check`를 두어 tsc가 JSDoc 정합을 기계로 검사하게 한다. `include`에 `".claude/lib/**/*.mjs"`를 명시한다 — 지금 `include`는 `*.ts` 글롭만이라 어느 테스트도 import하지 않는 lib 파일(`phases.mjs`)은 프로그램에 안 들어가 `@ts-check`가 장식이 된다. 옮길 코드는 지금까지 어떤 컴파일러도 본 적이 없으므로 함수 하나를 먼저 옮겨 `noImplicitAny`·`RegExp.exec` null·`string|undefined` 좁히기 비용을 실측하고 W4 분량을 다시 잡는다. `.d.mts`는 쓰지 않는다.
- `biome.json`의 `includes`에서 `!**/.claude`를 `!**/.claude/hooks`·`!**/.claude/*.mjs`·`!**/.claude/*.json`으로 바꿔 `.claude/lib/**`만 린트·포맷 대상이 되게 한다. 실측(biome 2.4.15): 제외한 상위 폴더의 하위를 다시 포함하는 패턴(`**/.claude/lib/**`)은 동작하지 않고, 제외를 좁히는 방법은 동작한다. `workflow.mjs`·훅·`typecheck.mjs`·상태 파일·설정 JSON은 제외를 유지한다(재포맷 diff 회피). `!**/.gstack`은 더하지 않고 `"vcs": {"enabled": true, "clientKind": "git", "useIgnoreFile": true}`를 둔다. 실측(2026-09-17, biome 2.4.15, `.git`이 파일인 worktree): gitignore된 `game/temp`·`docs/temp`가 「Checked 0 files」로 무시된다(설정이 루트 `biome.json`에 있으면 `root` 지정은 필요 없다). 이것으로 원래 폴더의 `.gstack/`(F107)뿐 아니라 `docs/temp/`·`game/native/`처럼 git은 무시하는데 biome은 훑던 부류 전체가 닫히고, `includes`의 `!**/game/*` 여섯 줄도 `.gitignore`와 겹치므로 지운다(`!**/.claude/*` 셋만 남는다). 통합 검사가 biome을 게이트로 삼는 순간 머지 직후 첫 슬라이스가 장비 로컬 미추적 파일 때문에 검증 진입에 실패하는 것을 막는다. `package.json`의 lint-staged 글롭 `*.{ts,tsx,js,jsx,json}`에 `mjs`·`cjs`를 더한다 — 없으면 `.claude/lib/*.mjs`가 biome 대상인데 커밋 훅은 포맷하지 않아 커밋은 되고 `verify`는 빨갗다. 글롭에 `mjs`가 있는지 소스 텍스트로 단언하는 테스트 하나.
- `QaDoc.ts`·`DocsHygiene.test.ts` 머리말의 「`.mjs`가 `.ts`를 import하면 TS7016」 서술을 실제 방향(`.ts`가 `.mjs`를 import할 때)으로 고친다. `workflow.mjs`에서 F78을 근거로 사본·vitest 띄우기를 설명하는 주석 넷(정본 절 머리, `qaDocClean` 머리, `qaDocFingerprint`, `check-links`)도 F78이 닫힌 뒤의 사실로 고친다 — `check-links`·`check-qa`가 vitest를 띄우는 이유(판정 한 벌)는 남되 「F78이 그 상태다」 문구는 지운다. `DocLinks.test.ts`의 `check-links` 정규식은 그 블록의 큰따옴표 `runVitest(["…"])`에 묶여 있어 `workflow.mjs`가 biome 밖에 남는 것이 전제다 — 한 줄 적어 둔다. 과거 세션 문서는 고치지 않는다.
- 고정 테스트: `ClaudeMdSplit.test.ts`의 「판정 로직이 두 곳에 복사돼 있다」 주석과 그 단언을 「한 모듈」 단언으로 바꾼다. `workflow.mjs`가 `canon.mjs`·`workflow-steps.mjs`·`phases.mjs`를 import하는지, 그리고 `gate-scripts.mjs`의 `EDITABLE_PHASES` 리터럴이 `phases.mjs`의 export와 같은지를 소스 텍스트로 확인하는 단언을 둔다(`DocLinks.test.ts`가 `check-links` 인자를 소스에서 뽑는 방식과 같다).
