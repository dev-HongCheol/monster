# 워크플로우 다이어트 W4 — 두 곳에 복사된 판정 코드를 하나로 합치기 (F78)

- **작성일:** 2026-10-06
- **브랜치:** `feat/workflow-diet`
- **만드는 것:** `.claude/lib/canon.mjs` · `.claude/lib/workflow-steps.mjs` · `.claude/lib/phases.mjs` · `tsconfig.tests.json`·`biome.json`·`package.json`(lint-staged) 수정 · `tests/helpers/CanonDoc.ts`·`WorkflowSteps.ts` 삭제
- **정본:** 없음 — 이 묶음은 코드 위치와 검사 설정만 바꾸고 절차는 바꾸지 않는다. 바뀐 코드 위치는 코드 자체(`.claude/lib/*.mjs`의 JSDoc)와 `workflow/README.md`에 더하는 한 줄(W1)에 적힌다.
- **개요:** [계획 개요](2026-10-06-workflow-diet-plan.md)

---

## 1. 무엇을 어디로 옮기나

| 지금 도구가 쓰는 코드 | 테스트용 복사본 | 이번에 하는 일 |
|---|---|---|
| `workflow.mjs`의 `parseCanonSlug`·`assertOneLineField`·`renderCanonDoc`·`insertCanonRow`·`locateCanonListTable`과 접두사 상수(120~202행) | `tests/helpers/CanonDoc.ts`(168줄) | `.claude/lib/canon.mjs`로 옮긴다. `workflow.mjs`와 `CanonDoc.test.ts`가 이 파일을 import하고, `CanonDoc.ts`는 지운다 |
| `workflow.mjs`의 `check-docs` 판정(922~940행) | `tests/helpers/WorkflowSteps.ts`의 `findStepDocIssues`(99줄) | `.claude/lib/workflow-steps.mjs`로 옮긴다. `parsePhases`는 옮기지 않고 지운다. phase 목록을 import할 수 있게 되면, `workflow.mjs`의 소스 글자를 정규식으로 읽어 낼 필요가 없기 때문이다 |
| `DOC_EXEMPT_PHASES`·`STEP_DOC_INDEX` | 같은 파일(`WorkflowSteps.ts`) | `workflow-steps.mjs` 한 곳에만 둔다 |
| `workflow.mjs`의 `PHASES`·`EDITABLE_PHASES` | 훅 `gate-scripts.mjs`의 `EDITABLE_PHASES` | `.claude/lib/phases.mjs`가 내보내고, `workflow.mjs`와 테스트가 import한다. **훅은 import하지 않고 지금 값을 그대로 둔다**(§2) |

각 코드를 부르는 곳이 두 군데씩인 것을 확인했다. 정본 문서 판정은 `workflow.mjs`의 `canon`·`canon-done` 명령과 `CanonDoc.test.ts`가 부르고, 절차 문서 판정은 `check-docs` 명령과 테스트가 부른다.

옮기면 구현 코드 약 377줄(`workflow.mjs` 약 110 + `WorkflowSteps.ts` 99 + `CanonDoc.ts` 168)이 지워지고 약 300줄(세 모듈 + JSDoc)이 생겨서, 줄어드는 양은 약 70줄이다. 줄 수보다 중요한 것은 「규칙을 바꾸면 두 곳을 함께 고쳐야 한다」는 주석(`workflow.mjs` 118~119행)이 필요 없어진다는 점이다. 테스트 쪽은 `ClaudeMdSplit.test.ts`에서 「두 곳에 복사돼 있다」를 확인하던 부분이 「한 모듈에 있다」를 확인하도록 바뀌고 import 경로도 바뀌어서, 전체 변경량은 이보다 크다.

이 세 모듈을 더하면 새 모듈은 모두 일곱 개다(`git`·`change-set`·`verify`·`transition`·`canon`·`workflow-steps`·`phases`). 모듈을 나누는 원칙은 개요 §5에 있다.

## 2. 훅이 `phases.mjs`를 import하지 않는 이유

Claude Code는 PreToolUse 훅이 종료 코드 2가 아닌 다른 코드로 죽으면 편집을 막지 않는다. 그래서 훅이 다른 파일을 import하다 실패하면, 경고만 하고 편집은 그대로 통과시킨다. 실패하면 편집을 막도록 바꾸면 다른 문제가 생긴다. `phases.mjs`에 문법 오류가 하나 생기면, 그 오류를 고치려는 편집까지 막혀서 빠져나올 방법이 없다. 그래서 훅에는 지금 값을 그대로 두고, 훅 파일의 그 값이 `phases.mjs`가 내보내는 값과 같은지를 테스트로 확인한다.

## 3. 타입 검사

`tsconfig.tests.json`에서 `allowJs: true`를 켜고 `include`에 `.claude/lib/**/*.mjs`를 더한다(`moduleResolution: Bundler`라서 `.ts`에서 `.mjs`를 확장자까지 붙여 import할 수 있다). `.claude/lib/*.mjs`는 첫 줄에 `// @ts-check`를 두고, 내보내는 함수마다 JSDoc(`@param`·`@returns`·`@typedef`)을 단다. JSDoc이 없는 함수는 타입이 `any`가 되어, 테스트에서 타입을 제대로 확인하지 못한다(2026-09-17 실측).

`.claude/typecheck.mjs`에도 `// @ts-check`를 붙인다. `verify.mjs`가 이 파일을 import하면 `allowJs` 때문에 타입 검사 대상에 포함된다. 그런데 `@ts-check`가 붙어 있어야 `runTypecheck`의 JSDoc 반환 타입이 실제로 적용되고, `verify.mjs`에서 이 함수를 부르는 코드가 타입 검사를 받는다.

옮길 코드는 지금까지 타입 검사를 받은 적이 없다. 그래서 `RegExpMatchArray | null`, `spawnSync` 결과의 `status: number | null`처럼 「null일 수 있다」를 처리하는 수정이 여러 군데 생긴다. 함수 하나를 먼저 옮겨서 고칠 양을 재고, 나머지에 드는 양을 다시 어림한다(개요 §10).

## 4. biome

`biome.json`의 제외 목록에서 `!**/.claude` 한 줄을 `!**/.claude/hooks`·`!**/.claude/*.mjs`·`!**/.claude/*.json` 세 줄로 바꿔서, `.claude` 아래에서는 `.claude/lib/**`만 검사 대상이 되게 한다. 「폴더 전체를 제외하고 그 안의 하위 폴더만 다시 포함하는」 방식은 biome 2.4.15에서 동작하지 않는다(2026-09-17 실측). `.claude/*.json`을 제외하므로 상태 파일과 `settings.local.json`도 검사에서 빠진다.

그리고 `"vcs": {"enabled": true, "clientKind": "git", "useIgnoreFile": true}`를 더해서, git이 무시하는 파일을 biome도 무시하게 한다. 그러면 제외 목록 중 `game/` 아래 여섯 줄과 `docs/temp`·`cloud-storage`·`.gstack` 세 줄은 `.gitignore`와 겹치므로 지운다. 이렇게 바꿔도 검사하는 파일 수가 지금과 같은 165개라는 것을 원래 폴더에서 확인했다(2026-09-30, 서브에이전트 검토). biome은 저장소의 `.gitignore`만 읽으므로, W1 §6에서 `.gitignore`에 Claude Code 파일을 적는 일이 여기서도 필요하다. 적지 않으면 `.claude/worktrees/` 같은 폴더가 생겼을 때 biome이 그 안까지 검사한다.

`workflow.mjs`·`typecheck.mjs`는 이번에도 biome 검사 대상에 넣지 않는다. 넣으면 따옴표 형식이 바뀌면서 diff가 크게 생긴다. 넣는 일은 W7에서 새 백로그 항목으로 미룬다(`.claude/**`에만 따로 따옴표 형식을 지정하는 설정을 쓰면 된다).

## 5. 커밋 훅

`package.json`의 lint-staged 대상 `*.{ts,tsx,js,jsx,json}`에 `mjs`와 `cjs`를 더한다. 더하지 않으면 `.claude/lib/*.mjs`는 biome 검사 대상인데 커밋 훅이 형식을 맞춰 주지 않아서, 커밋은 되는데 통합 검사에서 실패한다. `.husky/pre-commit`은 `pnpm lint-staged` 한 줄 그대로 둔다.

## 6. 주석

`workflow.mjs`에서 F78을 이유로 복사본과 vitest 실행을 설명하는 주석 네 개, 그리고 `QaDoc.ts`와 `DocsHygiene.test.ts` 머리말의 관련 설명을 F78을 닫은 뒤의 사실에 맞게 고친다. `check-links`와 `check-qa`가 vitest를 실행하는 이유(판정 코드가 테스트 쪽 한 곳에만 있기 때문이다)를 설명하는 주석은 그대로 둔다.

## 7. 테스트

- `ClaudeMdSplit.test.ts`에서 「판정 코드가 두 곳에 복사돼 있다」를 전제로 확인하던 부분을 「한 모듈에 있다」를 확인하도록 바꾼다.
- 파일 내용을 읽어서 확인하는 것: `workflow.mjs`가 `canon.mjs`·`workflow-steps.mjs`·`phases.mjs`를 import하는지, 훅의 `EDITABLE_PHASES` 값이 `phases.mjs`의 값과 같은지, lint-staged 대상에 `mjs`가 있는지.
- `CanonDoc.test.ts`는 `canon.mjs`를 import하도록 바꾸고, 지금 확인하는 내용은 그대로 확인한다.
