# 워크플로우 다이어트 W5 — 시험용 임시 저장소와 옛 형식 상태 파일

- **작성일:** 2026-10-06
- **브랜치:** `feat/workflow-diet`
- **만드는 것:** `tests/workflow/helpers/WfSandbox.ts` · 가짜 `pnpm` · `tests/workflow/fixtures/workflow-state/user-verification-legacy.json` · `tests/logic/WorkflowDiet.test.ts` · `ClaudeMdSplit.test.ts`·`DocsHygiene.test.ts`·`EolPolicy.test.ts`의 도우미 코드를 `tests/helpers/`로 옮기기
- **정본:** 없음 — 테스트에 쓰는 도구만 바꾼다. 도우미 함수가 무엇을 보장하는지는 `WfSandbox.ts` 머리말 주석에 적는다.
- **개요:** [계획 개요](2026-10-06-workflow-diet-plan.md)

---

이 묶음을 가장 먼저 한다. W1~W3의 테스트가 모두 이 묶음에서 만드는 도구를 쓰고, 기존 E2E 테스트 85건(`ClaudeMdSplit.test.ts` 56건 · `DocsHygiene.test.ts` 29건, 건너뜀 1건)이 새 `pass`에서도 통과해야 하기 때문이다.

## 1. `tests/workflow/helpers/WfSandbox.ts`

지금 테스트 파일 두 곳에 있는 도우미를 하나로 합쳐 이 파일로 옮긴다. `DocsHygiene.test.ts`의 `makeRepo`(임시 git 저장소를 만든다)·`runWf`(그 안에서 `workflow.mjs`를 실행한다), 그리고 `ClaudeMdSplit.test.ts`의 `makeSandbox(opts)`(git이 아닌 폴더에 상태 파일과 문서를 옵션대로 만든다)다. 내보내는 함수는 `makeRepo(opts)`, `runWf(dir, args, env)`, `git(dir, ...args)` 세 개다. `DocsHygiene.test.ts`에 남는 나머지 git 호출(`cat-file`, `reset --hard`)은 `git(dir, ...args)`로 바꾼다. 두 테스트 파일은 이 도우미를 쓰도록 고치되, 확인하는 내용은 바꾸지 않는다.

### 1.1 `makeRepo(opts)`가 만드는 것

임시 폴더 아래에 `repo/`(git 저장소)와 `bin/`(가짜 `pnpm`)을 나란히 만든다. 가짜 `pnpm`이 저장소 안에 있으면 `*.cmd` 파일이 `CSO_PATHS`에 해당해서, 모든 임시 저장소에서 `/cso`를 해야 하는 것으로 판정된다.

커밋은 세 개를 만든다.

- `c1`: 빈 README 하나.
- `c2`(기준 커밋): 절차 문서 빈 파일(`docs/development/workflow/*.md`와 README), 계획 문서, QA 문서(옵션으로 뺄 수 있다), `tests/logic/DocsHygiene.test.ts` 위치의 빈 파일, `.claude/workflow-state.json`. 가짜 vitest는 항상 성공으로 끝나므로 `DocsHygiene.test.ts`의 내용은 상관없다. 이 빈 파일은 `qaDocClean`이 「판정 파일이 있는가」를 확인할 때 통과하려고 둔다. 커밋하지 않은 새 파일이 남지 않게 한다.
- `c3`: 상태 파일을 지정한 phase에 맞게 고친 커밋.

브랜치는 이렇게 둔다. `main`과 `refs/remotes/origin/main`은 `c2`, `feat/stale`은 `c1`(`DocsHygiene.test.ts`의 「`origin/main`보다 커밋 하나 뒤」 상황이 그대로 나온다), `feat/<feature>`는 `c3`이고, `HEAD`는 `feat/<feature>`에 둔다. `main` 브랜치가 있어야 `wf start`(`git switch -c … main`)가 돈다. 변경 집합 테스트의 기준 커밋은 `c2`다.

옵션은 아래와 같다.

| 옵션 | 하는 일 |
|---|---|
| `phase`·`state` | 상태 파일 내용. `makeSandbox`가 받던 옵션을 그대로 받는다 |
| `qaDoc: false` | QA 문서를 만들지 않는다 |
| `gameChange: true` | `c3`에 `game/assets/scripts/x.ts` 하나를 더해서 `game/**` 변경을 만든다 |
| `csoApplicable: true` | `c3`에 `.claude/wf-sandbox.mjs`를 더해서 `/cso`를 해야 하는 상황을 만든다 |
| `checkout: 'main'` | `HEAD`를 `main`에 둔다. `DocsHygiene.test.ts`의 「로컬 main이 뒤처졌으면」 테스트가 `main`에서 `reset --hard HEAD~1`을 하기 때문이다 |
| `git: false` | git 저장소 없이 폴더만 만든다(아래) |

옵션 없이 부르면 phase는 `verification`, QA 문서 있음, 게임 변경 없음, `/cso` 해당 없음(`csoApplicable: false`), `HEAD`는 `feat/<feature>`, git 저장소 있음(`git: true`)이다. 이 기본값을 머리말 주석에 한 줄로 적는다.

`makeRepo({ git: false })`는 git 저장소 없이 폴더만 만든다(지금 `ClaudeMdSplit.test.ts`의 `makeSandbox`가 하는 일이다). 이 폴더에서는 변경 집합을 구할 수 없어서 모든 검사를 하게 되고, 통합 검사는 가짜 `pnpm` 덕분에 통과하며, `pass cso`는 `HEAD`를 읽지 못해 `cso_commit`을 적지 않는다. `ClaudeMdSplit.test.ts`의 임시 폴더 테스트 약 40개 중 변경 집합이나 `cso_commit`을 확인하지 않는 테스트는 이 방식을 쓴다. 전부 git 저장소로 만들면 Windows에서 전체 테스트 시간이 몇 초 늘어서, 개요 §10에서 재려는 「통합 검사 한 번의 시간」이 달라지기 때문이다.

### 1.2 장비의 git 설정 영향 막기

`makeRepo`는 `git init` 뒤에 저장소 안에 `core.autocrlf=false`(Windows의 줄 끝 변환이 diff를 바꾸지 않게)와 `commit.gpgsign=false`를 `git config`로 적는다. `git -c <설정> init`으로 주면 그 설정은 `init` 한 번에만 적용되고, 뒤의 `add`·`commit`·`diff`는 전역 설정을 읽기 때문이다.

도우미가 실행하는 모든 git 명령에는 환경변수 `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=<임시 폴더의 빈 gitconfig 파일>`, `GIT_AUTHOR_NAME`·`GIT_AUTHOR_EMAIL`·`GIT_COMMITTER_NAME`·`GIT_COMMITTER_EMAIL`, `GIT_CEILING_DIRECTORIES`를 준다. 전역 설정에 `commit.gpgsign=true`나 `core.hooksPath`가 있는 장비에서, 임시 저장소의 커밋이 서명 비밀번호 입력창을 기다리거나 다른 저장소의 훅을 실행하지 않게 하려는 것이다. `GIT_CEILING_DIRECTORIES`에는 임시 폴더의 부모 폴더를 줘서 git이 그 바깥의 저장소를 찾아 올라가지 않게 한다. 임시 폴더 경로는 `fs.realpathSync.native`로 전체 경로로 바꾼 뒤 넣는다. Windows의 짧은 경로 이름(`CHOI-H~1` 같은)으로 주면 이 설정이 적용되지 않기 때문이다.

### 1.3 `git(dir, ...args)`는 허용된 하위 명령만 받는다

허용하는 git 하위 명령은 `init`·`config`·`add`·`commit`·`branch`·`switch`·`checkout`·`update-ref`·`reset`·`cat-file`·`rev-parse`·`merge-base`·`rebase`다. 첫 인자가 이 밖이면 예외를 던진다. `-c`·`-C`·`--exec-path`·`--git-dir`·`--work-tree`·`--config-env` 같은 전역 옵션도 마찬가지다.

이렇게 제한하는 이유는 이렇다. W1 §7의 「`helpers/`·`fixtures/` 밖의 `tests/` 파일은 프로세스를 띄우지 않는다」 테스트는 프로세스 모듈을 직접 import하는지만 본다. 그런데 도우미가 받은 인자를 그대로 git에 넘기면, `/cso` 점검 대상이 아닌 테스트 파일에서 `-c core.fsmonitor=<명령>` 같은 인자로 아무 명령이나 실행할 수 있다. 도우미가 할 수 있는 일이 좁아야 테스트 파일을 `CSO_PATHS`에서 빼도 안전하다.

### 1.4 `runWf(dir, args, env)`

가짜 `pnpm` 폴더를 `PATH` 맨 앞에 붙일 때, `process.env`에서 대소문자를 구분하지 않고 `PATH` 키를 찾아(Windows에서는 `Path`) 그 키의 값을 고친다. 키를 새로 만들지 않는다. 이름이 같은 키가 두 개가 되면 자식 프로세스가 어느 쪽을 읽을지 보장되지 않기 때문이다.

### 1.5 정리

임시 폴더는 `fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })`로 지운다. Windows에서는 Defender가 새 파일을 읽는 중이거나 git이 파일을 아직 놓지 않았을 때 `EBUSY`/`EPERM` 오류가 난다.

## 2. 가짜 `pnpm`

임시 폴더의 `bin/`에 `pnpm.cmd`(Windows용)와 `pnpm`(그 밖의 OS용)을 만든다. `bin/pnpm.cmd`는 `node "%~dp0fake-pnpm.mjs" %*` 한 줄이고, `bin/pnpm`은 같은 파일을 부르는 셸 스크립트 한 줄이다. 인자 해석과 `WF_SHIM_FAIL` 처리는 `bin/fake-pnpm.mjs` 한 곳에 둔다. `cmd` 배치 파일은 `=`를 인자 구분자로 잘라서, `--outputFile=<경로>`가 두 조각으로 나뉘기 때문이다. `bin/pnpm`을 만든 뒤에는 `fs.chmodSync(path, 0o755)`로 실행 권한을 준다. 실행 권한이 없으면 `spawnSync`가 `EACCES`로 끝나서, 맥북에서 E2E 테스트가 모두 실패한다.

가짜 `pnpm`의 동작은 이렇다.

- `exec tsc …`와 `exec biome …`(`check`·`lint` 모두)에는 성공으로 끝난다.
- `exec vitest run … --outputFile=<경로>`에는 「실패 0건」인 최소한의 결과 파일을 쓰고 성공으로 끝난다.
- `--outputFile`이 없는 `exec vitest run …`(`qaDocClean`이 이 모양으로 부른다)에는 항상 종료 코드 0으로 끝난다.
- 환경변수 `WF_SHIM_FAIL=vitest`를 주면, `--outputFile`이 있는 호출(통합 검사)에만 실패 결과와 실패 종료 코드를 낸다. 그래야 「`pass review`가 넘기기 직전 검사에서 실패하면 넘어가지 않는다」는 테스트가, QA 판정이 아니라 통합 검사에서 막히는 것을 확인할 수 있다.

이 환경변수는 가짜 `pnpm`만 읽고 `workflow.mjs`와 `verify.mjs`는 읽지 않는다. 그래서 개요 §2.2에서 기각한 「환경변수로 검사 실행기를 바꿔 끼우는 장치」와는 다르다. 가짜 `pnpm`이 없으면, 개발 도구가 설치되지 않은 임시 폴더에서 `pass`가 통합 검사를 실행하다 실패한다.

## 3. 옛 형식 상태 파일 견본 하나

`tests/workflow/fixtures/workflow-state/user-verification-legacy.json`에 2026-09-30 main에 있던 실제 상태 파일을 둔다(3D 슬라이스의 `user-verification` 상태, 통과 표시 네 개가 모두 참, 새로 더하는 값 없음). 새 `workflow.mjs`의 `status`가 이 파일을 읽고 적용 판정 표를 출력하는지, `approvePrDecision`이 판정을 내는지 테스트로 확인한다(W3). 새로 더하는 값을 읽는 나머지 곳은, W2의 단위 테스트가 그 값이 없는 상태 객체로 확인한다.

## 4. 프로세스를 띄우는 코드를 `tests/helpers/`로 모은다

지금 `tests/logic/`에서 `node:child_process`를 직접 쓰는 파일은 세 개다. `ClaudeMdSplit.test.ts`와 `DocsHygiene.test.ts`는 `WfSandbox.ts`를 쓰도록 바꾸면 해결된다. `EolPolicy.test.ts`는 git을 실행하는 부분을 `tests/helpers/`의 도우미로 옮긴다. 그 뒤로는 W1의 테스트(「`tests/logic/` 아래 파일은 프로세스를 띄우지 않는다」)가 이 상태가 유지되는지 확인한다.

## 5. 이 슬라이스의 테스트 파일과 실행 시간

이 슬라이스의 테스트 파일은 `tests/workflow/WorkflowDiet.test.ts`다(`ready-impl`이 기능 이름을 PascalCase로 바꿔서 이 파일을 찾는다). W1~W3의 새 테스트는 여기에 두고, 기존 테스트 파일에서 확인 내용을 바꾸는 것은 그 파일에서 한다.

`WfSandbox`를 쓰는 테스트 파일에는 `testTimeout: 30_000`을 둔다. 기본값 5초로는 CPU가 바쁠 때 시간 초과가 난다. 통합 검사까지 실제로 돌리는 E2E 테스트는 여섯 개 이하로 둔다(W2 §8). 구현 뒤 개요 §10에 「전체 테스트」와 「임시 저장소 테스트 파일만」의 시간을 따로 적는다.

## 6. 테스트

- `git(dir, ...args)`가 허용 목록 밖의 인자(전역 옵션 포함)를 받으면 예외를 던지는지.
- 기존 E2E 85건이 도우미로 옮긴 뒤에도 같은 내용을 확인하는지(확인 내용은 바꾸지 않는다).
- 가짜 `pnpm`이 `--outputFile` 유무와 `WF_SHIM_FAIL`에 따라 §2의 규칙대로 끝나는지.
