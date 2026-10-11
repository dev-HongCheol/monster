# 코드 리뷰 이슈 — 워크플로우 다이어트 1단계 (`feat/workflow-diet`)

- **리뷰 커밋:** `5c9d741`(base, `origin/main`) → `cba973e`(head, W8 재리뷰까지)
- **계획:** [`../development/sessions/2026-10-06-workflow-diet-plan.md`](../development/sessions/2026-10-06-workflow-diet-plan.md) (묶음 문서 W1~W7은 같은 폴더의 `2026-10-06-workflow-diet-w*.md`)
- **리뷰어:** `superpowers:requesting-code-review` 템플릿으로 띄운 서브에이전트. 검토 범위는 `.claude/lib/*.mjs` · `.claude/workflow.mjs` · `.claude/typecheck.mjs` · `tests/workflow/**` · `tests/docs/**` · `tests/helpers/**` · `biome.json` · `tsconfig.tests.json` · `package.json` · `.gitignore`다. 리뷰어가 직접 `pnpm vitest run tests/workflow tests/docs`(251 통과 · 1 건너뜀)와 `pnpm typecheck`(통과, 범위 full)를 돌려 확인했다.
- **판정:** 수정 후 승인 — Critical 0 · Important 1 · Minor 6 · 권고 2

잘됐다고 본 것은 다섯이다. 판정 함수(`decideTransition`)와 실행(`workflow.mjs`의 `tryTransition`)이 갈려 있어 「`pass cso`를 먼저 치면 vitest가 돌지 않는다」까지 단위 테스트로 잡힌다. 변경 집합은 git에서만 오고 환경변수 경로가 없다. 적용 경로 상수의 정책 주석이 경로마다 「왜」를 든다. 임시 저장소 격리(`GIT_CONFIG_NOSYSTEM` · `GIT_CONFIG_GLOBAL` · `GIT_CEILING_DIRECTORIES` · 작성자 환경변수)와 Windows의 `PATH` 키 대소문자 처리가 실제로 나는 문제를 미리 막는다. 통합 검사의 실패 분류(실행기 없음 · `ENOBUFS` · 결과 파일 없음 · 종료 코드 0인데 `success: false` · import 단계 실패)가 운영 상황을 겨냥한다. 테스트 시간 줄이기 커밋(`99ea135`)은 테스트 이름과 단언을 바꾸지 않았고, fast-import 저장소의 모양이 옛 `makeRepo`와 같다는 것을 `WfSandbox.test.ts`와 변경 집합 테스트로 확인했다.

지적은 전부 「테스트 도우미가 할 수 있는 일을 좁힌다」는 약속과 그 주변이다. 가장 중요한 것(I1)은 테스트 파일을 `/cso` 대상에서 빼는 근거인 git 허용 목록에, 쓰지도 않으면서 다른 명령을 실행할 수 있는 하위 명령이 남아 있던 것이다.

---

## Important

### I1. `WfSandbox.git`의 허용 목록에 쓰지 않는 하위 명령 넷이 남아 있었다 — **수정됨**

[`tests/workflow/helpers/WfSandbox.ts`](../../tests/workflow/helpers/WfSandbox.ts)의 `ALLOWED_GIT`에 `config` · `branch` · `merge-base` · `rebase`가 있었는데 어느 테스트도 부르지 않는다(`config`·`branch`는 테스트 시간 줄이기 전의 `makeRepo`가 썼고, 나머지 둘은 처음부터 쓰인 적이 없다). 그런데 `git rebase --exec <명령>`은 아무 명령이나 실행하고, `git config core.fsmonitor=<명령>`을 적어 두면 그 뒤의 모든 git 호출 — 같은 프로세스 안에서 `collectChangeSet`이 띄우는 `git diff`까지 — 이 그 명령을 실행한다. 목록 위 주석과 `change-set.mjs`의 `CSO_PATHS` 주석은 「테스트 파일을 `/cso` 대상에서 빼는 대신 도우미가 받는 명령을 좁힌다」고 약속하고 그 근거로 `-c core.fsmonitor=<명령>`을 드는데, `config` 하위 명령이 같은 결과를 한 단계 돌아서 내므로 약속이 서지 않았다.

조치: 넷을 지워 테스트가 실제로 쓰는 아홉 개만 남겼다. `WfSandbox.test.ts`의 「허용 목록 밖의 하위 명령은 예외다」에 `config` · `rebase`를 더해 고정했다. 목록 주석에 「이 목록은 실행 경로를 좁히는 것이지 완전한 격리는 아니다 — `commit`은 저장소의 `.git/hooks`를, `init --template`은 템플릿의 훅을 실행할 수 있다」를 적어 다음에 목록을 늘릴 때의 기준을 뒀다.

---

## Minor

### M1. `runWf`의 `extraEnv`가 자식 프로세스 환경에 그대로 들어갔다 — **수정됨**

테스트 파일이 `runWf(repo, ['status'], { NODE_OPTIONS: '--require …' })`를 넘기면 자식 node가 아무 코드나 싣는다. I1과 같은 신뢰 경계다. 지금 테스트가 넘기는 키는 `WF_SHIM_FAIL` 하나다.

조치: `WF_`로 시작하는 키만 받고 그 밖은 예외를 던진다(`ALLOWED_ENV`). `WfSandbox.test.ts`에 `NODE_OPTIONS`는 막히고 `WF_QUIET`는 통과하는 테스트를 더했다.

### M2. 「테스트 파일은 프로세스를 띄우지 않는다」 검사의 한계가 테스트 쪽 주석에 없었다 — **수정됨**

`WorkflowDiet.test.ts`의 그 검사는 문자열 리터럴 import만 본다. `change-set.mjs`의 `CSO_PATHS` 주석은 그 한계를 적었지만, 이 검사가 `/cso` 제외의 근거이므로 테스트 쪽에도 같은 말이 있어야 했다.

조치: 테스트 주석에 「동적 import나 다른 모듈을 거친 우회는 잡지 못하므로 도우미의 API를 좁게 두는 것이 이 검사의 나머지 절반이다」를 적었다.

### M3. 계획 W1 §7의 폴더 경계 항목 하나가 테스트에 없었다 — **수정됨**

「`game/package.json`은 루트 `package.json`에 해당하지 않는다」. `globToRegExp`가 `^…$`로 고정하므로 동작은 맞았지만, 앞 고정이 풀리면 조용히 넓어지는 자리다.

조치: `W1 — 적용 경로의 폴더 경계` 절에 `game/package.json`의 `cso.rule`과 `fullTypecheck.rule`이 `game/package.json`인 것을 확인하는 테스트를 더했다.

### M4. `verify.mjs`의 vitest 실행기가 임시 폴더 경로의 큰따옴표만 걸렀다 — **일부 수정됨**

명령줄을 셸로 돌리므로(`shell: true`) 큰따옴표 안에서도 POSIX는 `$`·백틱을, cmd는 `%`를 푼다. 그런 글자가 든 임시 폴더 경로면 결과 파일이 엉뚱한 곳에 쓰여 「결과 없이 끝남」으로 보고된다.

조치: `$` · 백틱 · `%`까지 걸러 `not-run`으로 보고하고, 그 경우의 테스트를 더했다. 리뷰어가 함께 든 「`tmpRoot`가 없는 폴더면 `mkdtempSync`가 예외를 던져 `pass` 전체가 스택 트레이스로 끝난다」는 고치지 않았다 — `tmpRoot`는 `os.tmpdir()`에서 오고 그 폴더가 없는 장비는 node 자체가 돌지 않으며, 예외가 그대로 나오면 원인이 보인다. 한 줄 더 두는 값어치가 없다고 봤다.

### M5. 돌려쓰는 저장소의 순서 제약이 주석으로만 지켜진다 — **수정됨**

리뷰어가 `sharedRepo` 여섯 블록을 전부 따라가 「첫 테스트만 맨 앞」과 「이력을 바꾸는 테스트는 마지막」이 지켜지고 그 사이 테스트는 상태 파일 복원만으로 독립적인 것을 확인했다. 숨은 결합은 하나로, 변경 집합 절의 이름 바꾸기 테스트가 하는 `git add -A`가 앞 테스트의 잔여물까지 스테이징하지만 단언이 포함 여부만 보므로 결과에 영향이 없다. vitest 기본 순서가 선언 순이라 지금은 안전하고, `sequence.shuffle`을 켜면 깨진다.

조치: `sharedRepo`의 JSDoc에 그 전제를 적었다.

### M6. `workflow.mjs`의 `csoInfo`와 `printGateLines`가 같은 삼항식을 반복했다 — **수정됨**

조치: 「`/cso`를 해야 할 때만 기준 커밋을 확인한다」는 삼항식을 `csoUsable(s, gates)` 하나로 묶었다.

---

## 권고

### R1. `workflow.mjs`에 `// @ts-check`를 붙이고 타입 검사 범위에 넣는다 — 백로그 F128

`.claude/lib/*.mjs`는 `@ts-check`와 JSDoc으로 검사받지만 그 함수를 부르는 `workflow.mjs`는 검사 밖이라 인자의 모양이 틀려도 잡히지 않는다. 이 슬라이스 범위 밖이라 [`../development/backlog-implement.md`](../development/backlog-implement.md) F128로 적었다. 리뷰어가 슬라이스 밖이라 언급만 한 「`approve-pr` 쪽 `s.verification.ts_check_clean = …`에 옛 상태 파일 가드가 없다(main에 있던 줄)」도 같은 항목에 함께 적었다.

### R2. `format-only` 판정에 import 정렬이 포함된다는 설명 — **수정됨**

`verify.mjs`는 `biome check` 실패 + `biome lint` 통과를 형식 차이로 읽는데, import 정렬 같은 다른 `--write` 대상도 같은 길로 들어온다. 결과는 맞지만 뒤에 혼동이 없게 `CheckStatus` 주석에 적었다.

---

## 재리뷰 — W8 편집 잠금 넓히기 (`e62fdf6` → `f9702f6`)

사용자 검증 중 리워크로 더한 W8(편집 잠금을 모든 코드로 넓히고, 고장 때는 멈춰서 확인받기)만 봤다. 판정은 「고친 뒤 머지 가능」이었고 Critical은 없었다.

### W8-I1. Windows에서 대소문자만 바꾼 경로로 잠금을 빠져나갈 수 있었다 — **수정됨**

훅이 경로를 대소문자를 가려 비교해서 `.CLAUDE/Settings.json`·`tools/a.MJS`·`Package.json`이 잠기지 않았다. NTFS에서는 같은 파일이다. 판정과 상태 파일 비교를 소문자로 하도록 고치고, 표 테스트와 훅 프로세스 테스트에 대문자 경로를 넣었다.

### W8-I2. `.claude/settings.local.json`을 잠그지 않는 근거가 사실과 달랐다 — **수정됨**

이 파일에는 `disableAllHooks`와 환경변수를 넣을 수 있어 잠금 전체를 끌 수 있다. 사용자가 잠그기로 정해(2026-10-09) 잠금 대상에 넣었다. 잠긴 단계에서는 AI가 권한 규칙을 고칠 수 없다는 점을 계획 W8 §4에 적었다. 저장소 밖의 사용자 전역 설정은 훅이 판정하지 않으므로 F129에 함께 적었다.

### W8-I3. `qa-setup.md`가 아직 게임 스크립트만 열린다고 적었다 — **수정됨**

「통과하면 코드 편집이 열린다」로 고쳤다.

### W8-M1. 잠긴 단계에서 권한 규칙 편집이 막힌다는 설명이 없었다 — **수정됨**

계획 W8 §4에 한 줄을 더했다.

### W8-M2. 확장자 목록이 `.mts`·`.cts`·`.jsx`·`.cmd`·`.bat`, 설정 목록이 `.jsonc`를 빠뜨렸다 — **수정됨**

### W8-M3. 같은 저장소의 다른 작업 폴더 파일은 잠기지 않는다 — **수정됨(문서)**

의도한 동작(저장소 밖 파일은 통과)의 결과라 코드는 그대로 두고 계획 W8 §2 표에 적었다.

### W8-M4. 복구 문서가 `pr-ready`에서 생긴 고장을 다루지 않았다 — **수정됨**

### W8-M5. 고치지 않은 코드의 주석 셋이 「훅이 게임 스크립트 편집을 막는다」고 적는다 — **기록만**

`transition.mjs:321`·`verify.mjs:443`·`workflow.mjs:695`. 게임 스크립트도 여전히 잠기므로 틀린 말은 아니고, 이번에 손대지 않은 코드의 주석이라 규칙대로 그대로 둔다.

### W8-M6. `NotebookEdit`은 훅의 matcher에 없다 — **기록만**

`.ipynb`는 코드 확장자 목록에도 없고 저장소에 노트북이 없어서 지금은 영향이 없다.

### W8-M7. NTFS 데이터 스트림 표기로는 아직 빠져나갈 수 있다 — **백로그 F129**

경로 끝에 `::$DATA`를 붙이면(`.claude/settings.json::$DATA`) Windows는 본래 파일을 고치는데, 훅은 이 경로를 잠그지 않는 파일로 본다. 재리뷰(`f9702f6` → `cba973e`)에서 찾았다. Edit 도구가 이런 경로를 받는지는 확인하지 않았고, 일부러 숨기려고 해야 쓰는 길이라 Bash로 고치는 길과 함께 F129에 적었다.

---

## 이력

- 2026-10-09 — 1차 리뷰(`5c9d741` → `388f5c5`). I1 · M1~M6 · R2를 같은 날 고쳐 다음 커밋에 넣었다.
- 2026-10-09 — W8 재리뷰(`e62fdf6` → `f9702f6`). W8-I1~I3 · M1~M4를 같은 날 고쳤고 M5 · M6은 기록만 했다.
- 2026-10-09 — W8 재리뷰 두 번째(`f9702f6` → `cba973e`). 지난 지적이 모두 맞게 풀렸고 새 문제는 W8-M7 하나(백로그로 보냄)였다.
