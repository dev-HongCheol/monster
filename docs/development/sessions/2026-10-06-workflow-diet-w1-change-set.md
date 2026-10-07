# 워크플로우 다이어트 W1 — 변경 집합과 적용 판정

- **작성일:** 2026-10-06
- **브랜치:** `feat/workflow-diet`
- **만드는 것:** `.claude/lib/git.mjs` · `.claude/lib/change-set.mjs` · 저장소 `.gitignore`에 더할 줄 · `tests/workflow/WorkflowDiet.test.ts`의 W1 테스트
- **정본:** [`workflow/README.md`](../workflow/README.md)에 「어느 검사를 언제 하는지는 `pnpm wf status`가 보여 주고, 규칙은 `.claude/lib/change-set.mjs`의 상수 위 주석에 적혀 있다」는 한 줄을 더한다. 적용 경로 자체는 그 주석이 정본이다.
- **개요:** [계획 개요](2026-10-06-workflow-diet-plan.md)

---

## 1. git 실행 — `git.mjs`

git을 실행하는 함수는 `.claude/lib/git.mjs`의 `git(root, args, opts = {})` 하나다. `spawnSync`로 실행하고, `maxBuffer: 64 * 1024 * 1024`를 주며, `shell`은 쓰지 않는다. 기본값 1MiB로는 큰 아트 슬라이스의 `git diff` 출력을 다 받지 못한다. `opts`는 `spawnSync` 옵션을 그대로 넘기는 인자다. 지금 `workflow.mjs`의 `git(args, opts)`는 브랜치를 바꿀 때(`switch`) `{ stdio: "inherit" }`를 넘겨서 사용자에게 git 출력을 보여 준다(449~450행). 새 함수에 `opts`가 없으면 `wf start`가 브랜치를 바꿀 때의 출력이 사라진다. `workflow.mjs`는 이 함수를 import해서 쓰고, 자기 안의 `spawnSync("git", …)` 호출은 없앤다.

`.claude/lib/*.mjs`는 상태 파일을 읽거나 쓰지 않는다. 상태 파일은 `workflow.mjs`만 쓴다. git을 실행하는 모듈은 `git.mjs`와 `change-set.mjs`뿐이고, 나머지(`transition.mjs`·`canon.mjs`·`workflow-steps.mjs`·`phases.mjs`)는 입력만 받아 답을 돌려준다. 이 구분에 따라 테스트할 때 임시 저장소가 필요한지가 정해진다.

## 2. 변경 집합 구하기 — `collectChangeSet(root)`

먼저 `git merge-base origin/main HEAD`로 이 브랜치가 main에서 갈라진 커밋을 구한다. git이 추적하는 파일의 변경은 `git diff --name-status -z --no-renames <갈라진 커밋>`으로, 추적하지 않는 새 파일은 `git ls-files -o --exclude-standard -z`로 얻어서 합친다.

- `--no-renames`가 있어야 이름을 바꾼 파일이 「삭제 하나 + 추가 하나」로 나온다. 없으면 한 항목이 세 조각으로 나와서 그 뒤의 항목까지 잘못 읽게 된다.
- 각 항목은 `{status: 'A'|'M'|'D', path}` 모양이다. 경로는 git이 낸 저장소 기준 경로를 그대로 쓴다(소문자로 바꾸지 않는다).
- `git diff --name-status`가 내는 `T`(파일 형식 변경)는 `M`으로 읽는다. `A`·`M`·`D`·`T`가 아닌 글자(`U` 등)가 나오면 아래 §2.1의 「구할 수 없음」으로 처리한다.

변경 집합은 작업 폴더의 지금 파일 기준이다. `git add`만 하고 커밋하지 않은 새 파일은 `A`로, 커밋하지 않은 수정은 `M`으로 잡힌다. 이 슬라이스는 이것을 전제로 하므로 테스트로 확인한다(§7).

변경 집합에서 빼는 것은 두 가지다.

- `.claude/workflow-state.json`. 도구가 스스로 쓰는 파일이라, 넣으면 모든 슬라이스의 변경 집합에 `.claude/**`가 들어가서 `/cso`를 항상 하게 된다.
- git이 추적하지 않는 `*.meta`. Cocos가 만드는 파일이지 개발자가 바꾼 것이 아니다. 빼도 `.meta` 누락 검사 결과는 같다. 그 검사는 「git이 추적하는 자산 파일 옆의 `.meta`도 추적되는가」로 판정하기 때문이다. 새 자산을 추가한 경우에는 자산 파일 자체가 `game/assets/**`에 속하므로 `.meta` 검사가 적용된다. 두 가지를 코드 한 곳에서 빼고, 주석에 이 이유를 적는다.

### 2.1 변경 집합을 구할 수 없으면 모든 검사를 한다

아래 경우에는 `measurable: false`를 돌려준다. 그러면 검사 세 가지(`meta`·`fullTypecheck`·`cso`)를 모두 하고, QA 문서를 쓰지 않는 것도 허용하지 않는다. 건너뛰어도 되는지 알 수 없을 때는 건너뛰지 않기 위해서다.

| 원인 | 어떻게 알아내나 | 출력할 안내 문구 |
|---|---|---|
| `origin/main` 참조가 없다 | `git rev-parse --verify`가 실패한다 | 「`git fetch origin main`」 |
| `origin/main`과 `HEAD`에 공통 조상이 없다 | `git merge-base`가 종료 코드 1과 빈 출력을 낸다(얕은 클론이거나, 이력이 다른 `origin/main`인 경우) | 「`git fetch --unshallow` 또는 `git fetch origin main`」 |
| git 저장소가 아니다 | `git rev-parse`가 실패한다 | 「저장소 루트에서 실행(여기는 git 저장소가 아니다)」 |
| 명령을 실행한 폴더가 저장소 루트가 아니다 | `git rev-parse --show-prefix`가 빈 문자열이 아니다 | 「저장소 루트에서 실행」 |
| git 출력을 받지 못했다 | `spawnSync`의 `error`가 있거나 `status`가 `null`이다 | stderr 첫 줄 + 「`git status`로 확인」 |
| `U` 같은 알 수 없는 상태 글자가 나왔다 | `--name-status` 출력 | 「충돌을 풀고 다시 (`docs/development/troubleshooting/workflow-state-cross-machine.md`)」 |

「공통 조상 없음」을 따로 처리하는 이유는, 이때 `merge-base`의 `status`가 `null`이 아니어서 다른 줄의 조건으로는 잡히지 않기 때문이다. 잡지 않으면 기준 커밋이 빈 문자열인 채로 `git diff`를 실행하게 된다. 저장소 루트인지 판정할 때 경로 문자열을 비교하지 않는 이유는, 이 장비에서 git은 `F:/…`를, Node는 `F:\…`를 내서 비교가 항상 틀리기 때문이다.

안내 문구는 함수 하나가 원인에 따라 만들고, 적용 판정을 쓰는 모든 명령이 같은 문구를 출력한다. 판정하기 전에 `fetch`하지 않는다. 로컬의 `origin/main`이 원격보다 뒤처져 있으면 갈라진 커밋이 더 앞쪽이 되어 변경 집합이 커지기만 한다. 그래서 틀리더라도 검사를 덜 하는 쪽으로는 틀리지 않는다.

## 3. 적용 경로는 이 파일의 상수로 둔다

상수마다 위에 정책 문장을 주석으로 적는다. 나중에 경로 목록만 고치다가 왜 그 경로가 들어갔는지 잊지 않게 하려는 것이다. 적용 경로의 정본은 그 주석이다.

| 상수 | 경로 | 정책 |
|---|---|---|
| `CSO_PATHS` | `.claude/*.mjs`, `.claude/hooks/**`, `.claude/lib/**`, `.claude/settings.json`(저장소가 추적하는 파일만 넣는다. Claude Code가 버전마다 새로 만드는 파일은 해당하지 않는다. `.claude/commands/**`는 생기면 더한다), `tools/**`, `tests/**/helpers/**`, `tests/**/fixtures/**`(영역 폴더마다 있는 도우미와 견본. 테스트 파일 자체는 어느 영역이든 넣지 않는다), `.husky/**`, `.vscode/**`, `vitest.config.*`, 루트의 `package.json`·`pnpm-lock.yaml`·`tsconfig*.json`·`biome.json`·`.gitattributes`·`.gitignore`, `game/tsconfig.json`, `game/package.json`(git이 추적하는 게임 쪽 의존성 목록이다. `game/pnpm-lock.yaml`이 생기면 함께 넣는다), `**/*.{sh,ps1,cmd,bat,py}`. 그리고 생기면 넣을 것: `.github/**`·`.npmrc`·`pnpm-workspace.yaml`·`.gitmodules`·`.mcp.json` | 개발 장비에서 실행되는 코드·자동화·의존성·공급망·git 실행 동작을 바꾸는 파일 |
| `META_PATHS` | `game/assets/**` | Cocos가 `.meta`를 만드는 폴더 |
| `FULL_TYPECHECK_PATHS` | `game/**/*.ts`, `game/tsconfig.json`, `game/package.json`, `game/settings/**`, `pnpm-lock.yaml` | 게임 코드의 타입 검사 결과를 바꿀 수 있는 파일 |
| `QA_PATHS` | `game/**` | 게임 동작을 바꿀 수 있어서, 사용자가 인게임에서 확인할 목록이 필요한 파일 |

`CSO_PATHS` 위 주석에는 정책 문장과 함께 아래 네 가지를 적는다.

- **테스트 파일(`tests/**/*.test.ts`)을 빼는 예외.** 테스트도 개발 장비에서 실행되는 코드다. 하지만 넣으면 모든 슬라이스가 만드는 기능 테스트 파일 때문에 `/cso`가 「해당 없음」으로 나오는 경우가 한 번도 없다(2026-09-17 결정). 그 대신 프로세스를 띄우는 테스트 코드는 각 영역의 `helpers/`에 둔다.
  - 이 규칙은 테스트 하나로 지킨다. 「`helpers/`·`fixtures/` 밖의 `tests/` 파일은 프로세스를 띄우지 않는다」(§7). 지금 프로세스를 직접 띄우는 세 파일은 W5에서 고친다.
  - 이 예외가 안전하려면 `tests/helpers/`의 도우미 함수가 할 수 있는 일이 좁아야 한다. 위 테스트는 테스트 파일이 프로세스 모듈을 직접 import하는지만 본다. 그래서 `helpers/`의 git 도우미가 받은 인자를 그대로 git에 넘기면, 테스트 파일에서 그 도우미를 통해 아무 명령이나 실행할 수 있다. 이를 막으려고 W5에서 도우미가 받는 git 하위 명령을 허용 목록으로 제한한다.
- **게임 코드(`game/**`)를 넣지 않는 것도 조건이 붙은 예외다.** 지금 게임에는 결제·로그인·서버·외부 연동이 없다. 그래서 게임 코드가 바뀌어도 `/cso`가 찾는 위험(개발 장비에서 명령이 실행되거나 비밀값이 밖으로 새는 것)이 생기지 않는다. 그런데 v2는 Steam 유료 출시와 스킨 판매를 계획한다(백로그 F61). 구매 확인이나 Steam 연동 코드가 게임에 들어오면 「사지 않은 스킨이 풀린다」, 「저장 파일을 고쳐 유료 아이템을 얻는다」 같은 위험이 게임 코드 안에 생긴다. 그 경로가 `CSO_PATHS`에 없으면 그 코드는 보안 점검 없이 머지된다. 그래서 「그런 코드가 들어오면 그 경로를 `CSO_PATHS`에 더한다」를 이 주석과 `verification.md`의 `/cso` 적용 문장 옆에 함께 적고, 같은 할 일을 F61 항목에도 적는다(W7).
- **외부 기여자의 PR을 받기 시작하면** `CLAUDE.md`·`.claude/commands/**`·`docs/development/workflow/**`를 더한다. 이 파일들은 AI가 그대로 따라 실행하는 지시문이라 자동화 설정과 같기 때문이다. 백로그 F109(레포 공개 여부) 항목에도 같은 한 줄을 적는다(W7). `verification.md`에는 글자 수 상한 때문에 적지 않는다.
- **`.claude/**` 전체가 아니라 추적하는 파일만 넣는 이유.** 지금 git이 추적하는 `.claude` 파일 여섯 개(`workflow.mjs`·`typecheck.mjs`·`hooks/gate-scripts.mjs`·`hooks/check-gstack.sh`·`settings.json`·`workflow-state.json`)는 전부 위 경로에 들어간다(상태 파일은 변경 집합에서 빼므로 해당하지 않는다). 그리고 Claude Code가 버전마다 새로 만드는 파일은 처음부터 해당하지 않게 된다.

그 밖의 경로 결정은 이렇다.

- `QA_PATHS`를 `META_PATHS`보다 넓게 잡는 이유는, 화면 크기나 물리 설정이 들어 있는 `game/settings/` 아래 파일만 고쳐도 게임 동작이 바뀌기 때문이다.
- `FULL_TYPECHECK_PATHS`를 `game/**` 전체로 두지 않는다. `game/assets/`에는 그림과 `.meta`가 많아서, 그렇게 두면 그림만 바꿔도 게임 전체 타입 검사를 해야 한다. TypeScript 파일은 폴더가 아니라 확장자로 지정한다. 지금 `.ts` 파일은 `game/assets/scripts/`에만 있지만(2026-10-05 확인), 나중에 다른 폴더에 생겨도 해당해야 하기 때문이다.
- 게임 코드는 지금 JSON 파일을 import하지 않는다(2026-10-05 확인). import하기 시작하면 JSON을 바꿔도 타입 검사 결과가 바뀐다. 그래서 「`game/assets/scripts/` 아래 코드가 `.json`을 import하지 않는다」를 테스트 하나로 확인하고, 이 테스트가 실패하면 그때 적용 경로를 넓힌다.
- 루트 `package.json`은 `FULL_TYPECHECK_PATHS`에 넣지 않는다. 의존성이 바뀌면 `pnpm-lock.yaml`도 함께 바뀌고, `scripts` 줄만 고치는 것은 타입과 관계가 없다. 이 슬라이스도 lint-staged 설정 때문에 루트 `package.json`을 고친다.
- `.env*`는 `CSO_PATHS`에 넣지 않는다. `.env`와 `.env.local`은 이미 git이 무시해서 변경 집합에 들어오지 않는다. 그리고 비밀값은 어느 파일에든 들어갈 수 있어서 경로로는 잡을 수 없다. 비밀값은 코드 리뷰가 확인한다(W6).
- 경로를 비교할 때 폴더 경계를 지킨다. `toolsmith/x`는 `tools/**`에 해당하지 않고, `game/package.json`은 루트 `package.json`에 해당하지 않는다. 보호하는 폴더 이름과 대소문자만 다른 경로(`.Claude/`)는 같은 폴더로 본다.

### 3.1 경로 비교를 git에 맡길지는 시험해 보고 정한다

W1을 짜기 전에 git의 pathspec 기능으로 같은 판정이 나오는지 한 번 돌려 본다. 쓸 명령은 `git diff --name-status --no-renames <기준> -- ':(glob)<경로>'`와 `git ls-files -o --exclude-standard -- ':(glob,icase)<경로>'`다(이 장비의 git 2.50에서 `:(glob)`·`icase`가 동작한다, 2026-10-06 확인).

- §4의 대표 변경 집합 일곱 줄의 판정이 표와 똑같이 나오면, 직접 짠 경로 비교 코드와 폴더 경계 테스트(`toolsmith/x`·`game/package.json`·`.Claude/`)를 빼고 git에 맡긴다.
- 다르게 나오면 그 경우를 기록하고, 직접 짠 비교 코드로 간다.
- 어느 쪽이든 지켜야 할 기준은 §4의 판정 표와 §2.1의 `measurable: false` 규칙이다.

시험하기 전에 세 가지를 정해 둔다. 시험 결과를 읽을 때 해석이 흔들리지 않게 하려는 것이다.

- `:(glob)`은 중괄호를 풀어 주지 않으므로, `**/*.{sh,ps1,cmd,bat,py}`는 pathspec 다섯 개로 나눠 쓴다.
- `icase`는 pathspec 전체에 적용되므로, `.claude` 항목에만 붙인다.
- 검사 하나당 git을 한 번만 실행한다(경로 여러 개를 한 번에 넘긴다). 결과의 `rule` 값에는 어느 경로가 해당했는지를 JS에서 다시 맞춰 보지 않고, 「그 검사의 경로 목록 전체」를 적는다. `status`를 한 번 칠 때 git 실행 횟수가 검사 수(네 개)+3을 넘지 않게 하려는 것이다.

**시험 결과(2026-10-07): 직접 짠 비교 코드로 간다.** pathspec 자체는 기대대로 동작했다(`:(glob)tests/**/helpers/**`가 `tests/helpers/`도 잡고, `:(glob,icase).Claude/*.mjs`가 `.claude/*.mjs`를 잡는다). 그런데도 git에 맡기지 않는 이유는 판정 함수(`applicableGates`)가 메모리의 변경 집합만 받아야 하기 때문이다. 테스트가 git 출력을 흉내 내서 넣는 경우(`T`·`U` 상태 글자, 실행 실패, Windows에서는 만들 수 없는 `.Claude/`)를 pathspec으로는 확인할 수 없고, 검사마다 git을 다시 띄우면 변경 집합을 한 번 구해 네 번 판정하는 지금 구조가 깨진다. 글롭 비교 코드는 `**` · `*` · `{a,b}` · 글자 그대로 네 가지만 지원하고 대소문자를 구분하지 않는다. 폴더 경계 테스트는 그대로 둔다.

## 4. 검사별로 할지 말지 판정 — `applicableGates(changeSet)`

`meta`·`fullTypecheck`·`cso`·`qa` 각각에 대해 `{applies, matches, rule}`을 돌려준다.

- `qa`는 변경 집합에 `QA_PATHS`에 해당하는 파일이 있는지이고, QA 문서가 필요한지 판정할 때 쓴다(W2).
- `matches`는 변경 집합에서 해당한 파일 경로이고, `rule`은 그 파일이 해당한 적용 경로다.
- `status`와, 전이가 막혔을 때의 안내가 이 값을 써서 「어느 파일 때문에 이 검사를 하는지」와 「어느 경로의 파일이 없어서 해당 없음인지」를 출력한다.
- 판정 결과는 저장하지 않는다. `status`·`skip-qa`·`ready-impl`·`start-verification`·`pass`·`approve-pr`이 부를 때마다 다시 계산한다.

대표 변경 집합 일곱 개의 판정은 아래와 같다. 구현은 이 표와 같은 결과를 내야 한다.

| 바꾼 것 | `meta` | `fullTypecheck` | `cso` | QA 문서 |
|---|---|---|---|---|
| 문서만(`docs/**`) | 해당 없음 | 해당 없음 | 해당 없음 | 생략 가능 |
| 도구만(`tools/blender/**` 또는 `.claude/workflow.mjs`) | 해당 없음 | 해당 없음 | 적용 | 생략 가능 |
| 순수 로직 테스트만(`tests/logic/**`) | 해당 없음 | 해당 없음 | 해당 없음 | 생략 가능 |
| git이 추적하지 않는 `.meta`만 | 해당 없음 | 해당 없음 | 해당 없음 | 생략 가능 |
| 그림과 `.meta`만(`game/assets/art/**`) | 적용 | 해당 없음 | 해당 없음 | 필요 |
| 게임 TypeScript(`game/assets/scripts/**`) | 적용 | 적용 | 해당 없음 | 필요 |
| 게임 프로젝트 설정만(`game/settings/**`) | 해당 없음 | 적용 | 해당 없음 | 필요 |

판정 결과를 출력용 문자열로 만드는 `formatGateLines`와 `approve-pr`의 판정은 입력만 받아 답하는 함수라서 `transition.mjs`에 둔다(W2·W3). 이 파일에는 git을 실행하는 코드와 경로 정책만 둔다.

## 5. `cso_commit`을 기준 커밋으로 쓸 수 있는지 — `csoBaseUsable(csoCommit, root)`

`cso_commit`을 쓸 수 있는지는 이 함수 하나로 판정한다. 상태 파일에 값이 있고, `git merge-base --is-ancestor <cso_commit> HEAD`가 참이면 쓸 수 있다. `invalidate`·`start-verification`·`status`가 모두 이 함수를 부른다(W2·W3). 쓸 수 없는 경우는 세 가지로 나눠서 알려 준다.

- 상태 파일에 값이 없다: 「기록 없음」.
- 그 커밋이 지금 `HEAD`의 조상이 아니다(`--is-ancestor`가 1을 낸다): 리베이스를 했거나 main에서 들어온 변경이 섞였을 때다. 조상이 아닌데도 그 커밋을 기준으로 안내하면, 명령이 실패하거나 main에서 들어온 변경까지 점검 범위에 들어간다.
- 그 커밋이 지금 저장소에 없다(`--is-ancestor`가 128을 낸다): 다른 장비로 옮겼는데 그 장비에 그 커밋이 없을 때다. 이 경우를 변경 집합을 구할 수 없는 경우(`measurable: false`)와 섞지 않는다. 이 경우는 「`/cso`를 처음부터 전체로 하라」고 안내할 뿐, 어떤 검사를 할지는 바꾸지 않는다.

`/cso` 명령 문자열(`/cso --diff --base <커밋>`)은 이 파일의 상수 하나로 두고, `invalidate`·`start-verification`·`status`와 테스트가 모두 그 상수를 쓴다. 절차 문서에는 「바뀐 부분만 본다(기준 커밋은 `status`가 보여 준다)」까지만 적는다. 정확한 옵션과, gstack이 고장 났을 때 대신 쓸 방법(Claude Code의 `security-review`는 브랜치에서 아직 main에 들어가지 않은 변경을 본다)은 `docs/development/spec/ops-skill-routing.md`의 `/cso` 행에 한 줄로 적는다(W6).

## 6. 저장소 `.gitignore`에 Claude Code가 만드는 파일을 적는다

대상은 `.claude/settings.local.json`과 실행 중에 생기는 파일들(`.claude/scheduled_tasks.json`·`.claude/scheduled_tasks.lock`·`.claude/worktrees/`·`.claude/checkpoints/`·`.claude/mailbox/`·`.claude/routines/.state/`·`.claude/agent-registry.json`·`.claude/agent-memory-local`·`.claude/first-run`·`.claude/assistant-daemon-state.json`)이다. 지금은 이 파일들을 무시하는 규칙이 이 장비의 전역 git 설정과 `.git/info/exclude`에만 있다. biome은 저장소의 `.gitignore`만 읽으므로(`vcs.useIgnoreFile`, W4), 그 설정이 없는 장비에서는 biome이 이 파일들까지 검사한다. `/cso`를 할지 여부는 이 파일들의 영향을 받지 않는다. `CSO_PATHS`에는 `.claude` 아래에서 git이 추적하는 파일만 들어 있기 때문이다.

## 7. 테스트 (W5의 임시 저장소에서)

- 변경 집합: 추적 파일 수정, 새 파일, 삭제, 이름 바꾸기(삭제 + 추가로 읽히는지), 공백이 들어간 파일명, 한글 파일명, 상태 파일이 빠지는지, git이 추적하지 않는 `*.meta`가 빠지는지, `git add`만 한 새 파일이 `A`로·커밋하지 않은 수정이 `M`으로 잡히는지, `T` 한 줄이 든 출력이 `M`으로 읽히는지.
- 변경 집합을 구할 수 없는 경우 여섯 가지: `origin/main`이 없을 때, 공통 조상이 없을 때(이력이 다른 `origin/main`을 둔 임시 저장소), git 저장소가 아닐 때(`makeRepo({ git: false })`), 하위 폴더에서 실행했을 때, git 출력을 받지 못했을 때(`error`를 일부러 넣는다), `U` 한 줄이 든 출력. 각 경우에 모든 검사를 하게 되는지, 안내 문구가 §2.1 표와 같은지 본다.
- 폴더 경계(pathspec 시험 결과 git에 맡기기로 하면 뺀다): `toolsmith/x`는 `tools/**`에 해당하지 않는다, `game/package.json`은 루트 `package.json`에 해당하지 않는다, `game/assets/art/a.png`는 `FULL_TYPECHECK_PATHS`에 해당하지 않는다, `game/elsewhere/x.ts`는 `FULL_TYPECHECK_PATHS`에 해당한다.
- 대표 변경 집합 일곱 개의 판정이 §4 표와 같은지.
- `csoBaseUsable`: 조상일 때 참이다. 리베이스로 조상이 아니게 됐을 때와 저장소에 없는 커밋일 때는 각각 다른 이유를 달고 거짓이다.
- 파일 내용을 읽어서 확인하는 것 세 가지: 저장소 `.gitignore`에 §6의 줄들이 있는지, 게임 코드가 `.json`을 import하지 않는지, `helpers/`·`fixtures/` 밖의 `tests/` 파일이 프로세스를 띄우지 않는지. 마지막 것은 `node:child_process`뿐 아니라 접두사 없는 `child_process`, `node:worker_threads`, `worker_threads`의 import도 잡아야 한다.
