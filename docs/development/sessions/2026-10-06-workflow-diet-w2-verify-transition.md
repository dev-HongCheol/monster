# 워크플로우 다이어트 W2 — 통합 검사와 전이 판정

- **작성일:** 2026-10-06
- **브랜치:** `feat/workflow-diet`
- **만드는 것:** `.claude/lib/verify.mjs` · `.claude/lib/transition.mjs` · `.claude/typecheck.mjs`의 `capture` 옵션 · `workflow.mjs`의 `start-verification`·`verify`·`pass`·`skip-qa`·`invalidate`·`rework`
- **정본:** [`workflow/verification.md`](../workflow/verification.md) · [`workflow/implementation.md`](../workflow/implementation.md) · [`workflow/qa-setup.md`](../workflow/qa-setup.md) · [`CLAUDE.md`](../../../CLAUDE.md) 명령 표. 이 묶음이 바꾸는 검증 절차와 명령이 적히는 문서다(문구는 W6에서 정한다).
- **개요:** [계획 개요](2026-10-06-workflow-diet-plan.md)

---

## 1. 통합 검사 — `runVerify(runners = defaultRunners, { write = true } = {})`

biome, 타입 검사, vitest를 이 순서로 실행하고 각 출력을 받아 둔다. biome을 먼저 실행하는 이유는, `write`가 참일 때 biome이 고친 코드를 타입 검사와 테스트가 검사하게 하려는 것이다. 순서가 반대면 타입 검사가 본 코드와 디스크에 남는 최종 코드가 달라진다. 하나가 실패해도 멈추지 않고 세 개를 다 실행한다. 세 결과를 한 번에 보게 하려는 것이다.

### 1.1 실행기 세 개

| 실행기 | 실행하는 명령 | 실패했을 때 직접 다시 돌려 보라고 안내하는 명령 |
|---|---|---|
| biome | `pnpm exec biome check --reporter=summary [--write] .` | `pnpm check` |
| 타입 검사 | `typecheck.mjs`의 `runTypecheck({ capture: true })`. 안에서 `pnpm exec tsc -p <프로젝트> --noEmit`을 두 번 실행한다 | `pnpm typecheck` |
| vitest | `pnpm exec vitest run --reporter=json --outputFile=<실행할 때마다 새로 만든 임시 폴더 안의 파일>` | `pnpm exec vitest run`(실패한 파일이 세 개 이하면 `pnpm exec vitest run <파일>`) |

- 각 실행기는 `{status, scope?, summary, details}`를 돌려주고, `runVerify`는 `{ok, results: {biome, typecheck, vitest}}`를 돌려준다. `runVerify`가 실행기를 부르기 전후로 시간을 재서 결과마다 `durationMs`를 더한다. 실행기가 돌려주는 모양은 바꾸지 않는다.
- 기본 실행기는 `verify.mjs` 한 곳에만 정의한다. 실행기를 바꿔 끼우는 환경변수는 만들지 않는다. 시험용 실행기는 단위 테스트가 함수 인자로 넘긴다. `verify.mjs`는 `workflow.mjs`가 import해서 쓰는 모듈이고, 혼자 실행할 수는 없다.
- Windows에서 `.cmd` 파일을 실행하려면 `shell: true`가 필요해서 그대로 둔다. 그래서 인자로 넘기는 경로는 따옴표로 감싼다. 임시 폴더 경로에 `"`가 들어 있으면 「임시 폴더 경로에 따옴표가 들어 있어 명령줄을 만들 수 없다: <경로>」라고 출력하고 실패한다. 명령줄이 잘못 만들어져서 엉뚱한 파일에 조용히 쓰는 것보다 낫기 때문이다.
- 세 실행기의 `spawnSync`에 모두 `maxBuffer: 64 * 1024 * 1024`를 준다. 기본값 1MiB로는 `game/temp` 설정이 깨진 날 tsc가 내는 수천 줄을 다 받지 못한다.
- `runTypecheck({ capture: true })`는 진행 줄(「▶ 타입체크 1/2」)과 `⚠` 안내를 화면에 출력하지 않고, tsc 출력만 `details`로 돌려준다. `pnpm typecheck`를 혼자 실행할 때(capture 없음)는 지금처럼 화면에 바로 출력한다.
- vitest 결과 파일을 고정 경로에 두지 않는 이유는, 원래 폴더와 이 작업 폴더에서 동시에 검사를 돌릴 때 서로의 결과 파일을 읽지 않게 하려는 것이다. 임시 폴더는 `finally`에서 `fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })`로 지운다. 이 정리 코드는 try/catch로 감싸서, 지우다 실패해도 검사 결과가 그 오류로 덮이지 않게 한다. Windows에서는 Defender가 새 파일을 읽는 동안 `EBUSY`/`EPERM` 오류가 날 수 있다.

### 1.2 biome의 `write` 값과 결과 구분

- `start-verification`, 그리고 `implementation`·`verification` phase에서 친 `verify`는 `write: true`로 실행한다. 형식 차이를 고치고 「n개 파일을 고쳤다」를 출력한다. `pass`는 `write: false`다. 커밋과 리뷰가 끝난 뒤라서 파일을 고치지 않는다. `user-verification` phase의 `verify`도 `write: false`다(§3).
- `start-verification`과 `verify`에 `--no-write` 옵션을 둔다. 이 옵션을 주면 biome을 `--write` 없이 실행해서, 형식 차이를 고치지 않고 실패로만 센다. 검사를 끄는 옵션이 아니라 파일 수정만 끄는 옵션이다(개요 §2.2에서 기각한 「환경변수로 실행기를 바꿔 끼우는 장치」와는 다르다).
- `write: true`일 때는 린트 위반만 실패로 센다. biome이 내는 정보 수준 진단(지금 `hitbox-viewer.html`에서 29건)은 실패가 아니므로, 요약 줄에 오류로 섞이지 않게 한다.
- `write: false`일 때 「형식 차이만 있다」와 「린트 실패가 있다」는 종료 코드로 구분한다. `biome check`가 실패하면 `biome lint .`를 한 번 더 실행해서, 그것이 통과하면 형식 차이만 있는 것이고 실패하면 린트 실패다. 이 추가 실행은 실패했을 때만 일어난다(약 0.5초).
  - `--reporter=json`을 쓰지 않는 이유는 biome CLI 문서에 `json`·`json-pretty` 출력이 「실험 기능이라 패치 버전에서도 바뀔 수 있다」고 적혀 있기 때문이다(2026-10-06 확인). summary 출력의 글자를 읽어서 구분하는 방법도, biome 버전이 바뀌면 아무 오류 없이 틀린 결과를 낸다.
  - 「n개 파일을 고쳤다」의 개수는 summary 출력에서 읽는다. 읽지 못하면 출력하지 않는다(판정에는 쓰지 않는다).

### 1.3 출력 모양

검사마다 요약 한 줄을 출력하고, 걸린 시간을 밀리초로 함께 적는다(예: `typecheck: 통과 (2,713ms)`). 세 검사의 합계 시간은 마지막 줄에 적는다. vitest 요약 줄에는 결과 파일에서 읽은 개수를 적는다: 「vitest: 통과 · 파일 n개 · 통과 a · 실패 b · 파일 실패 c · 스킵 d (N ms)」. QA 문서에 적는 「피처 테스트 N/N, 전체 스위트 M/M」은 이 줄에서 옮겨 적는다. 그 개수를 보려고 `pnpm exec vitest run`을 따로 치지 않는다.

실패한 검사에만 상세 내용을 40줄까지 붙이고(넘으면 「…N줄 생략」), 직접 다시 돌려 볼 명령을 출력한다. 상세 내용은 이렇게 가져온다. vitest는 결과 파일의 `testResults[].assertionResults[].failureMessages`와, 테스트 파일을 불러오다 난 오류가 들어 있는 `testResults[].message`에서 뽑는다. 결과 파일이 없으면 stderr를 쓴다. 타입 검사와 biome은 표준 출력과 오류 출력을 그대로 40줄까지 붙인다.

### 1.4 실패를 구분하는 규칙

- **통과인지 실패인지는 실행기의 종료 코드로 정한다.** vitest 결과 파일의 `success`가 거짓이면, `numFailedTests`가 0이어도 실패로 출력한다. vitest의 JSON 출력은 테스트 파일 하나가 import 단계에서 죽으면(테스트를 불러오다 난 오류다. `tsconfig.cocos.json`이 없을 때 이렇게 된다) `testResults[].status='failed'`와 `message`를 채우고 `numFailedTestSuites`를 올리지만, `numFailedTests`는 0일 수 있다. 요약 줄에 「파일 실패 n」을 따로 두는 이유다.
- **실행기 자체가 실패한 경우는 `error.code`로 구분한다.**
  - `error.code === 'ENOENT'`이거나, stdout이 비어 있고 `status`가 9009(`cmd.exe`)·127(`sh`)이면: 「실행기 `<이름>`을 실행할 수 없다(`pnpm` 경로 확인)」와 stderr 첫 줄을 출력한다. `shell: true`로 실행하면 `pnpm`이 없어도 `error`는 비어 있고 `status`만 그 값으로 오며, stderr에 셸의 오류 메시지가 찍힌다.
  - `ENOBUFS`이면: 「출력이 너무 커서 잘렸다 — `<직접 다시 돌려 볼 명령>`으로 직접 보라」.
  - 그 밖의 `error`이면: `error.message`를 그대로 출력한다.
  - `error`를 전부 「pnpm 경로 확인」으로 처리하면, 타입 오류 수천 줄로 출력이 넘친 경우까지 「pnpm이 없다」고 보고하게 된다.
- **vitest가 결과 파일 없이 끝났거나, 결과 파일이 JSON으로 읽히지 않으면**(중간에 죽은 경우) 두 경우 모두 「테스트 실행기가 결과 없이 끝났다 — `pnpm exec vitest run`으로 다시 돌려 보라」를 출력한다.
- **vitest 실패 출력에 `tsconfig.cocos.json`이 보이면**(결과 파일의 메시지든 stderr든) 해결 방법 두 가지를 출력한다: 「`<작업 폴더>/game`을 Cocos Creator로 한 번 연다」 또는 「다른 체크아웃의 `game/temp/tsconfig.cocos.json`을 같은 위치로 복사한다(git이 무시하는 파일이라 커밋되지 않는다)」. W7의 백로그 항목에도 이 두 방법을 적는다.

## 2. `start-verification`

지금은 전체 테스트만 돌린다. 이제는 `runVerify`를 돌리고, 세 검사가 모두 통과해야 `verification`으로 넘어간다. 넘어가면서 `ts_check_clean`·`lint_clean`·`ts_check_scope`를 상태 파일에 적는다. 성공 출력 끝에는 `status`가 보여 주는 것과 같은 적용 판정 표를 출력해서, `status`를 따로 칠 필요가 없게 한다(그 표는 `transition.mjs`의 `formatGateLines`가 만들고, `status`도 같은 함수를 쓴다. W3). 리워크 뒤에 친 `start-verification`은 `/cso`를 해야 하고 `cso_commit`을 쓸 수 있으면 「`/cso`는 바뀐 부분만 다시 본다: `/cso --diff --base <cso_commit>`」을 안내한다(§5).

실패했을 때의 안내는 「절차: `pnpm wf steps implementation`」 한 줄로 끝낸다. 실패하면 phase는 아직 `implementation`이고, 그 phase를 끝내는 조건은 그 절차 문서에 적혀 있다. 실패했을 때는 절차 문서가 출력되지 않으므로, 이 한 줄이 절차 문서를 찾아가는 유일한 안내다.

## 3. `verify` (새 명령)

`implementation`·`verification`·`user-verification` phase에서 칠 수 있다. 통합 검사를 다시 돌리고 기록용 값 셋만 다시 적는다. 어느 phase에서 쳐도 다음 phase로 넘어가지 않는다. 기록용 값은 넘어가는 조건이 아니므로 어느 phase에서 적어도 문제가 없다. `pass`가 다음 phase로 넘기기 직전에 스스로 통합 검사를 돌리므로, 코드를 고친 뒤 `verify`를 꼭 먼저 칠 필요는 없다. `verify`를 쓰는 때는 두 가지다. 「다음 phase로 넘기지 않고 지금 결과만 보고 싶을 때」와 「`user-verification`에서 사용자가 발견한 작은 문제를 고친 뒤 기계 검사 세 개를 한 번에 돌릴 때」다.

`user-verification`에서는 biome을 `write: false`로 실행한다(옵션으로도 바꿀 수 없다). 이 phase에서는 훅이 게임 스크립트 편집을 막는다. 그런데 `biome.json`은 `game/assets/scripts`도 검사 대상으로 두므로, `--write`로 실행하면 편집이 막힌 코드를 도구가 고치게 된다. 형식 차이가 나오면 실패로 세고, 「`pnpm wf rework` 뒤 `pnpm wf verify`로 고친다」를 안내한다.

그 밖의 phase(`planning`·`qa-setup`·`pr-ready`·`done`)에서 치면 「코드를 검사하는 phase가 아니다」라고 출력하고 거부한다. `verify`는 QA 문서를 보지 않는다. `status`의 명령 목록에서 `verify` 옆에는 「(phase가 바뀌지 않음)」을 붙인다. 실패했을 때의 안내는 「절차: `pnpm wf steps verification`」으로 끝낸다.

## 4. 전이 판정 — `transition.mjs`

### 4.1 `decideTransition`

`decideTransition({state, gates, qaRequired, qaClean?, canonDeclared, verifyResult?})`는 `{transition, needsQa, needsVerify, blockers, patch}`를 돌려준다. 입력만 받아 답하는 함수라서, 모든 경우를 단위 테스트로 확인할 수 있다. JSDoc에 아래 판정 순서를 적는다.

1. `pass`로 기록하는 판단 검사 두 개를 통과했는가. `code_review_clean`은 항상 본다. `cso_done`은 `/cso`를 해야 할 때만 본다.
2. QA 문서가 필요하면(§6 표) 확정됐는가.
   - `qaClean`은 처음부터 받지 않는다. 1번을 통과했고 `qaRequired`가 참인데 `qaClean`이 없으면 `needsQa: true`를 돌려준다. 그러면 `workflow.mjs`가 그때 QA 판정 `qaDocClean`을 실행해서(vitest를 띄운다) 결과를 넣고 다시 부른다. 그래서 `pass cso`만 친 경우처럼 1번이 아직 다 통과하지 않은 `pass`에서는 vitest가 돌지 않는다(지금 동작과 같다).
   - `qaRequired`가 참이면 QA 문서 파일이 있어야 한다. `qaDocClean`의 「파일이 없으면 통과」 규칙은 여기에 적용하지 않는다. 그 규칙은 `ready-impl`이 QA 문서가 꼭 있게 강제하던 때에 만든 것이다.
   - 파일이 없을 때의 안내는 두 가지로 나눈다. `qa_skip_reason`이 있으면 「생략 사유가 더는 맞지 않는다: <해당한 파일> — QA 문서가 필요하다: <경로>」. 없으면(문서를 지웠거나 옛 상태 파일인 경우) 「QA 문서가 없다: <경로>」.
3. 정본 갱신을 기록했는가(`canon_updated`에 경로가 있거나 `canon_skip_reason`이 있는가).
4. 1~3번을 다 통과했는데 `verifyResult`가 없으면 `needsVerify: true`를 돌려준다. 그러면 `workflow.mjs`가 통합 검사를 `write: false`로 돌리고, 그 결과를 넣어 다시 부른다. 커밋과 리뷰가 끝난 뒤라서 파일을 고치지 않는 방식으로 돌린다. 1~3번 중 하나라도 막혀 있으면 통합 검사를 돌리지 않는다.
5. 통합 검사가 통과하면 `user-verification`으로 넘어간다.

`ts_check_clean`·`lint_clean`·`ts_check_scope`는 넘어가는 조건이 아니라, 4번에서 돌린 통합 검사의 결과를 적는 기록이다. 조건으로 쓰면 `invalidate`가 이 값을 거짓으로 바꾸므로, 코드를 고칠 때마다 `verify`를 한 번 더 쳐야 한다. 이 슬라이스가 줄이려는 것이 바로 그런 반복이다.

### 4.2 통합 검사가 실패했을 때

4번에서 통합 검사가 실패하면 다음 phase로 넘어가지 않는다. 타입·린트·테스트 중 하나라도 실제로 실패했다면 코드를 고쳐야 한다는 뜻이므로, 그 자리에서 `invalidate`와 같은 일을 한다.

- 지우는 것: 통과 표시 두 개(`cso_done`·`code_review_clean`)와 정본 갱신 기록.
- 새로 적는 것: QA 문서의 해시값(`qa_doc_fingerprint`). 다시 넘어가기 전에 QA 문서의 테스트 수를 새 결과로 고쳤는지 확인하는 데 쓰는 값이다.
- 그대로 두는 것: `cso_commit`과 기록용 값 셋.

안내만 하고 통과 표시를 남겨 두면 이런 일이 생긴다. 실패를 보면 바로 코드를 고치고 `pass review`를 다시 치는 것이 가장 자연스러운데, 그러면 고치기 전 코드로 받은 리뷰와 `/cso` 통과 표시가 그대로 통과한다. 개요 §6에서 「세기 어렵다」고 적은 둘째 경우가 이 순서에서 가장 자주 생긴다. 이렇게 하면 「코드를 고쳤으면 통과 표시를 지운다」는 규칙(`CLAUDE.md` 9단계 6번)을 도구가 대신 지키게 되고, AI가 칠 명령 수는 늘지 않는다(어차피 `invalidate`를 쳐야 했다). 이 처리는 `/autoplan` 최종 승인에서 사용자가 고른 항목이다(개요 §2.1의 여섯째).

아래 두 경우의 실패에서는 통과 표시를 지우지 않는다.

- biome 형식 차이만으로 실패한 경우. 판단 검사와 관계가 없다. 출력은 「형식 차이 n개 파일 — `pnpm wf verify`로 고치고 커밋한 뒤 `pnpm wf pass review`를 다시 친다. 형식만 고친 경우는 판단 검사를 다시 하지 않는다」다. 커밋 훅(lint-staged)이 커밋하는 파일의 형식을 맞춰 주므로, 여기서 형식 차이가 나왔다는 것은 커밋하지 않은 파일이 있다는 뜻이다.
- 실행기를 실행하지 못했거나 테스트 실행기가 결과 없이 끝난 경우. 코드가 아니라 실행 환경의 문제다.

실제 실패일 때의 안내는 「통합 검사 실패 — 판단 검사 결과를 지웠다. 고친 뒤 절차대로 다시 한다(정본 갱신 기록 → QA 문서가 필요하면 갱신 → 커밋 → `/cso`를 해야 하면 `/cso --diff --base <커밋>` → 리뷰 → `pass review`)」다. 막혔을 때는 `status`와 같은 모양의 줄(어느 검사를 왜 하는지)과 다음에 칠 명령을 출력하고, 「절차: `pnpm wf steps verification`」으로 끝낸다.

### 4.3 `pass`

인자는 `cso`와 `review`만 받는다. `ts`나 `lint`를 치면 「타입·린트 결과는 통합 검사가 기록한다 — 따로 기록할 것이 없다. 결과만 다시 보려면 `pnpm wf verify`」를 안내하고 실패로 끝낸다.

`/cso`가 「해당 없음」인데 `pass cso`를 치면 명령은 받는다. 다만 「`/cso` 해당 없음(`CSO_PATHS`에 해당하는 변경 없음 — `pnpm wf status`로 확인) — 기준 커밋만 기록한다」를 출력하고 `cso_commit`만 적는다. `cso_done`은 거짓으로 둔다. 하지 않아도 되는데 스스로 돌린 점검의 기준 커밋은 남기되, 통과 표시는 `/cso`를 해야 할 때만 생기게 하려는 것이다. 「해당 없음」일 때 `cso_done`을 참으로 적어 두면 이런 문제가 생긴다. 나중에 `.claude/**`를 고쳐서 `/cso`를 해야 하는 상황으로 바뀌었는데 `invalidate`를 잊으면, 그 참 값 때문에 판정이 그냥 통과한다. 할지 말지는 매번 다시 계산하는데 통과 표시는 그와 상관없이 남아 있어서 생기는 문제다.

`pass review`·`canon-done`·`canon-skip`과 `user-verification`으로 넘어갈 때의 출력 줄에 그때 `HEAD`의 짧은 해시를 적는다(예: `✓ pass review (HEAD 2c41977)`). 상태 파일에는 적지 않는다(개요 §4 「새로 더하는 값은 두 개」). 개요 §6의 셋째 값(③)은 이 해시와 `git diff --stat`로 잰다.

## 5. 코드를 고친 뒤 `/cso`는 바뀐 부분만 본다

`/cso` 통과 표시는 지금처럼 코드를 고칠 때마다 지운다(`invalidate`와 `rework`, 그리고 §4.2의 자동 삭제가 지운다). 달라지는 것은 다시 점검할 때의 범위다.

- `pass cso`를 치면 그때의 `HEAD` 커밋을 `cso_commit`에 적는다.
- `invalidate`와 리워크 뒤의 `start-verification`은, `/cso`를 해야 하고 `cso_commit`을 쓸 수 있으면(W1 §5의 `csoBaseUsable`) 「`/cso`는 바뀐 부분만 다시 본다: `/cso --diff --base <cso_commit>`」을 안내한다. 쓸 수 없으면 처음부터 전체를 보는 `/cso`를 안내한다.
- 절차는 커밋한 뒤에 `/cso` → `pass cso`를 치게 한다(개요 §3). 그래도 커밋 전에 `pass cso`를 쳤다면, `cso_commit`에는 점검한 내용이 들어가기 전의 커밋이 적힌다. 그러면 다음 점검이 이미 본 부분까지 다시 본다. 틀리더라도 더 많이 보는 쪽으로만 틀린다. 이때 경고는 출력하지 않는다. 절차상 거의 항상 커밋하지 않은 변경이 있어서 경고가 매번 뜨기 때문이다(개요 §2.2).
- `cso_commit`은 통과 표시가 아니라 다음 점검의 기준일 뿐이다. 통과 표시를 지우는 함수는 이 값을 건드리지 않는다. `wf start`가 만드는 새 상태 파일에는 이 값이 없다.

## 6. QA 문서 생략 — `skip-qa "<사유>"` (새 명령)

`qa-setup`·`implementation`·`verification` phase에서 칠 수 있다. 사유를 상태 파일의 `qa_skip_reason`에 적는다. `skip-qa --clear`는 이 값을 지워서 「생략 안 함」으로 되돌린다. 상태 파일을 손으로 고치는 것은 훅이 막으므로, 되돌리는 명령이 따로 있어야 한다.

생략해도 되는지는 명령을 친 순간에 확정하지 않고, 필요할 때마다 다시 판정한다. `qa-setup`에서는 아직 구현 전이라 어떤 슬라이스든 변경 집합에 게임 파일이 없기 때문이다. 판정에 쓰는 경로는 `QA_PATHS`(`game/**`)다.

| `qa_skip_reason` | 변경 집합에 `game/**` 파일이 | QA 문서 |
|---|---|---|
| 없음 | 상관없음 | 필요하다(지금과 같다) |
| 있음 | 없음 | 생략해도 된다 |
| 있음 | 있음 | 필요하다. 「생략 사유가 더는 맞지 않는다: <해당한 파일>」을 안내한다. 적어 둔 사유는 지우지 않는다 |
| 있음 | 변경 집합을 구할 수 없음 | 필요하다. 「변경 집합을 구할 수 없어 QA 문서가 필요하다: <경로> — <W1 §2.1의 원인별 안내 문구>」를 안내한다 |

- 이 판정은 `qaRequired(state, gates)` 함수 하나가 한다(`transition.mjs`). 이 함수를 쓰는 곳은 네 군데다.
  - `skip-qa`: 치는 순간 이미 `game/**` 변경이 있으면 「QA 문서가 필요하다: <해당한 파일>」을 출력하고 받지 않는다.
  - `ready-impl`: QA 문서가 필요할 때만 문서가 있는지 확인한다(지금은 항상 확인한다).
  - `pass`: `user-verification`으로 넘기기 전에, QA 문서가 필요할 때만 문서가 확정됐는지 확인한다.
  - `status`: 사유와 함께 지금도 생략이 유효한지 출력하고, 사유가 없으면 「QA 문서 생략: 없음」을 출력한다.
- `skip-qa`는 사유를 적은 뒤 성공 출력에 「생략은 `game/**` 변경이 없는 동안만 유효하다 — 그 변경이 생기면 `pass`가 QA 문서를 요구한다」 한 줄을 덧붙인다.
- `start-verification`은 지금도 QA 문서를 보지 않고, 앞으로도 보지 않는다. `approve-pr`은 생략이 유효한지 다시 판정하지 않는다(개요 §6의 「1단계가 막지 못하는 경우」와 같은 종류다).
- 게임 슬라이스가 `qa-setup`에서 QA 문서를 생략했다가 검증 단계에서 막히는 것은, 의도한 사용법이 아니라 실수를 잡는 안전장치다. `qa-setup.md`에 「계획이 `game/**`를 건드리면 생략하지 않는다」고 적는다(W6).
- `ready-impl`·`skip-qa`가 거부할 때의 출력도 「절차: `pnpm wf steps <그 phase>`」로 끝낸다.

## 7. `invalidate`와 `rework`

둘 다 지금처럼 `resetVerification`을 부른다. 검사 목록 `CHECKS`에서 `ts`·`lint`가 빠지므로, 기록용 값 셋은 자연히 지워지지 않는다. `cso_commit`도 지워지지 않는다. `invalidate`는 `/cso`를 해야 하고 `cso_commit`을 쓸 수 있으면 `/cso --diff --base`를 안내하고, 아니면 전체 `/cso`를 안내한다(§5).

`qaDocClean`에 있는 「`tests` 폴더가 없으면 건너뛴다」는 예외는 없앤다. 이 예외는 개발 도구가 설치되지 않은 임시 폴더에서 테스트를 돌리려고 만든 것인데, W5의 가짜 `pnpm`이 그 문제를 해결한다. 판정에 쓰는 테스트 파일(`tests/logic/DocsHygiene.test.ts`) 하나만 없을 때 막는 동작은 그대로 둔다. 통합 검사에도 「`tests/logic`이 없으면 건너뛴다」 같은 예외는 두지 않는다. 그런 예외가 있으면 폴더 하나를 지우는 것만으로 기계 검사가 꺼진다.

## 8. 테스트

**단위 테스트(임시 저장소 없이).**
- `decideTransition`
  - 모두 통과하면 다음 phase로 넘어가고, 적을 값이 맞는지.
  - 통합 검사가 타입·린트·테스트로 실패하면 넘어가지 않고, 통과 표시 두 개와 정본 갱신 기록이 지워지고, QA 문서 해시값이 적히고, `cso_commit`과 기록용 값 셋은 남는지.
  - 형식 차이만 있는 실패, 실행기를 실행하지 못한 경우, 결과 없이 끝난 경우에는 넘어가지 않되 통과 표시는 그대로인지.
  - `/cso`가 해당 없음이면 `cso_done`이 거짓이어도 통과하는지.
  - QA 문서와 정본 갱신 기록에서 막히는지.
  - 앞의 조건에서 막혔으면 `needsVerify`가 거짓인지.
  - 통과 표시가 다 차지 않았으면 `needsQa`가 거짓이고, 다 찼고 QA 문서가 필요하면 참인지.
- `qaRequired`: §6 표의 네 줄.
- `runVerify`(시험용 실행기 사용)
  - 전부 성공, 일부 실패, 전부 실패일 때의 결과와 출력 모양(검사마다 한 줄에 시간, vitest 줄의 개수 다섯 가지, 실패한 검사만 상세 내용).
  - 실행 순서가 biome → 타입 검사 → vitest인지.
  - 실행기를 실행하지 못한 경우(`ENOENT`, 그리고 stdout이 비고 9009/127인 경우 — 시험용 실행기는 stderr를 채운 모양으로 만든다), `ENOBUFS`, vitest가 결과 없이 끝난 경우와 결과 파일이 깨진 경우, 「파일 실패 1·테스트 실패 0」 모양의 결과 파일, 형식만 실패한 경우와 린트 실패 두 가지.
  - `--no-write` 옵션을 줬을 때와 `user-verification` phase일 때 시험용 biome 실행기에 `write: false`가 전달되는지.
- 새로 더한 값이 없는 상태 파일(옛 형식)을 읽는 다섯 곳: `ready-impl`과 `pass`는 QA 문서를 요구하는지, `status`는 「QA 문서 생략: 없음」을 출력하고 멈추지 않는지, `invalidate`와 `start-verification`은 전체 `/cso`를 안내하는지.

**명령 테스트(W5의 임시 저장소에서).**
- `pass ts`가 안내와 함께 실패한다.
- `/cso`가 해당 없음일 때 `pass cso`가 「기준 커밋만 기록한다」를 출력하고, `cso_commit`만 적으며 `cso_done`은 거짓 그대로다.
- `pass cso`가 `cso_commit`을 적는다.
- `invalidate`가 `/cso` 통과 표시를 지우고, `cso_commit`과 기록용 값 셋은 남긴다.
- `/cso`를 해야 하는데 `pass cso` 전에 `pass review`를 치면 통합 검사가 돌지 않는다.
- `skip-qa`가 `game/**` 변경이 있으면 받지 않는다. `--clear` 뒤 `status`가 「QA 문서 생략: 없음」을 출력한다. `origin/main`이 없는 임시 저장소에서 §6 표 넷째 줄의 안내가 나온다.
- `verify`가 세 phase에서 각각 돌고 phase가 그대로인지, `planning`에서는 거부하는지. `verify`가 phase뿐 아니라 `cso_done`·`code_review_clean`·`canon_*`·`qa_doc_fingerprint`도 건드리지 않는지.
- `cso_commit`이 `HEAD`의 조상이 아닐 때(리베이스로 만든다) 전체 `/cso`를 안내하는지.
- 통합 검사까지 실제로 돌려 보는 처음부터 끝까지 테스트(E2E)는 여섯 개 이하로 둔다.
  - `start-verification` 성공: `verification`으로 넘어가고 기록용 값 셋이 적힌다.
  - `start-verification` 실패(`WF_SHIM_FAIL=vitest`): 넘어가지 않고 기록용 값이 실패로 적힌다.
  - `verify`: phase가 바뀌지 않는다.
  - `pass review` 실패: 넘어가지 않고 통과 표시가 지워진다.
  - `pass review` 형식만 실패: 통과 표시가 남는다.
  - `skip-qa` 뒤 `game/**` 변경이 생기면, QA 문서 없이는 `pass review`가 넘어가지 않는다.

  그 밖의 경우는 단위 테스트로 확인한다. Windows에서 E2E 한 건이 node를 약 다섯 번 띄워 1~1.5초가 걸리기 때문이다.
- 실제 프로세스를 띄우는 기존 테스트: `ClaudeMdSplit.test.ts`의 세 테스트(「전체 pass → user-verification」, 「막힌 뒤 기록하고 다시 치면 넘어간다」, 「canon-done이 기록하면 넘어간다」)는 `pass`를 자식 프로세스로 실행한다. 새 `pass`는 넘기기 직전에 통합 검사를 돌리므로, 개발 도구가 설치되지 않은 임시 폴더에서는 이 세 테스트가 실패한다. W5의 가짜 `pnpm`으로 통과하게 유지한다.
