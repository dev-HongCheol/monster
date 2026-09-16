# auto 모드인데 셸 명령마다 확인창이 뜬다

> **분류:** 운영/도구 이슈 + 복구 절차 (확인창이 갑자기 늘었을 때 참조)
> **최초 관측:** 2026-09-11, `feat/blender-3d-gate` 진행 중
> **상태:** 원인 확정 · 복구 절차 확정(2026-09-16). 이 문서가 기대는 Claude Code 동작은 2026-09-16에 공식 문서로 확인한 것이다

---

## 증상 (이게 보이면 이 문서다)

- 권한 모드가 auto인데 `grep`·`sed -n`·`git log`처럼 읽기만 하는 셸 명령에서 확인창이 뜬다.
- Read·Grep·Glob 도구가 확인창 없이 `... is outside ...; the permissions.blockReadsOutsideWorkingDirectories setting blocks reads outside the working directories` 오류로 거절된다.
- `.claude/settings.local.json`에 허용 규칙을 더해도 확인창이 줄지 않는다.

## 원인 — 사용자 설정 하나가 셸 명령까지 막는다

### 1. 확인창에서 고른 답이 사용자 설정으로 남는다

Claude Code는 auto 모드에서 Read·Grep·Glob이 작업 폴더 밖을 처음 읽으려 할 때, 앞으로도 그런 읽기를 허용할지 한 번 묻는다. 여기서 **Block from now on**을 고르면 Claude Code가 사용자 설정 파일 `~/.claude/settings.json`의 `permissions`에 `blockReadsOutsideWorkingDirectories: true`를 직접 써 넣는다. 설정 파일을 손으로 고친 적이 없는데도 이 줄이 생기는 것은 이 때문이다.

이 프로젝트에서는 2026-09-11 04:13(한국 시각)에 그렇게 들어갔다. 한 세션이 gstack의 `autoplan` 섹션 파일을 Read로 읽다가 거절된 기록의 시각과, 사용자 설정 파일이 수정된 시각이 1초 안쪽으로 맞는다.

### 2. 이 설정은 v2.1.257부터 셸 명령에도 확인창을 띄운다

설정 이름만 보면 파일 도구만 막는 것 같지만, Claude Code 문서는 셸 명령에도 확인창을 띄운다고 적는다.

> Reads outside the working directories while `permissions.blockReadsOutsideWorkingDirectories` is on: recognized file-reading Bash commands prompt even in auto mode and `bypassPermissions` mode, and so does any unsandboxed retry that needs approval to run outside the sandbox. Requires Claude Code v2.1.257 or later.
>
> A command the shell parser can't trace, such as one that changes directory more than once or runs a subshell, prompts the same way even when it names no outside path.
>
> — [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) 「Actions no mode auto-approves」

그래서 설정이 켜진 뒤로는 두 종류의 셸 명령이 auto 모드에서도 사람에게 넘어간다. 하나는 작업 폴더 밖 경로를 읽는 명령이고, 다른 하나는 셸 파서가 무엇을 읽는지 추적하지 못하는 명령이다. 두 번째는 폴더 밖을 전혀 가리키지 않아도 확인창을 띄운다.

### 3. 파일 도구가 막히면 셸로 돌아가다 확인창이 더 늘어난다

설정이 켜진 상태에서 모델이 폴더 밖 파일을 Read로 읽으려 하면 확인창 없이 거절된다. 그러면 모델은 같은 내용을 `cat`·`ls` 같은 셸 명령으로 다시 읽으려 하고, 그 셸 명령은 2의 규칙에 걸려 확인창을 띄운다. 파일 도구에서 조용히 끝났을 거절 한 번이 사람이 눌러야 하는 확인창 하나로 바뀌는 것이다.

### 4. 허용 규칙으로는 이 확인창을 넘길 수 없다

Claude Code 문서는 이 확인창을 어떤 권한 모드도 자동 승인하지 않는 동작으로 분류한다. 허용 규칙이 명령과 맞아도 확인창은 그대로 뜬다. `fewer-permission-prompts` 스킬처럼 세션 기록을 훑어 허용 규칙을 더하는 방법이 이 증상에 듣지 않는 것은 이 때문이다.

같은 이유로 "허용 규칙은 명령 전체가 맞아야 통과한다"는 사실도 auto 모드 확인창의 원인이 아니다. auto 모드에서 허용 규칙에 맞지 않는 명령은 분류기로 넘어가고, 분류기는 확인창 없이 허용하거나 차단한다.

## 근거 — 세션 기록 실측 (2026-08-17 ~ 2026-09-16)

승인한 확인창은 세션 기록(`~/.claude/projects/<폴더>/*.jsonl`)에 남지 않고, 거부한 확인창만 남는다. 그래서 금방 끝나는 조회 명령(`grep`·`sed`·`ls`·`cat`·`git log` 등)이 결과를 받기까지 5초 이상 걸린 비율을 확인창의 대리 지표로 썼다. 사람이 자리를 비웠거나 같은 턴에 함께 부른 다른 명령의 확인창을 기다린 경우도 느리게 잡히므로, 개별 명령이 아니라 비율의 변화로 읽는다.

| 명령 형태 | 설정 전 | 설정 후 |
|---|---|---|
| 단순 명령 | 0% (0/243) | 11% (15/131) |
| `;`·`&&`·`\|`로 연결만 한 명령 | 2% (15/759) | 15% (24/156) |
| 작업 폴더 밖 경로가 든 명령 | 6% (6/102) | 60% (24/40) |
| 추적 불가 형태(반복문·변수·heredoc·서브셸) | 4% (6/149) | 52% (17/33) |
| 밖 경로와 추적 불가 형태가 모두 든 명령 | 12% (12/103) | 62% (21/34) |

v2.1.257 이상을 쓰기 시작한 2026-09-03부터 설정이 들어가기 전인 2026-09-10까지는 느린 조회 명령이 68건 중 3건이었다. 버전이 올라간 것만으로는 확인창이 늘지 않았고, 새 버전에 이 설정이 더해진 뒤에 늘었다.

설정 후 느렸던 명령에서 되풀이된 형태는 아래와 같다. 개별 명령이 확인창을 띄웠다는 직접 기록은 없으므로 형태의 경향으로만 읽는다.

- 반복문(`for ... do`), 변수 대입과 확장(`B=...`, `$HOME`, `$CLAUDE_PROJECT_DIR`), heredoc, 서브셸
- 작업 폴더를 Git Bash식 경로로 적은 명령(`git -C /f/work/monster ...`, `cd /f/work/monster && ...`). 가리키는 곳이 작업 폴더인데도 느렸으므로, 파서가 이 표기를 작업 폴더로 알아보지 못하는 것으로 보인다
- `sed -n '/^## 3/,/^## 4/p'`처럼 `/`로 시작하는 정규식 주소. 인자가 절대 경로와 같은 모양이다
- `~/.gstack`·`~/.claude` 아래를 셸로 읽은 명령

2026-09-16에 사용자가 거부한 셸 명령 가운데 Blender를 부른 넷은 모두 실행 파일을 `C:/Program Files/Blender Foundation/...` 전체 경로(또는 그 경로를 담은 변수)로 부르면서 반복문·`;`·`&&`·`|`를 함께 썼다. Blender 같은 외부 프로그램을 실행해서 확인창이 뜬 것이 아니라, 그 명령의 형태가 2의 규칙에 걸린 것으로 본다. Blender 명령은 렌더 시간이 길어 지연 지표로는 가를 수 없으므로 이 판단은 거부 기록에만 기댄다.

## 복구 절차 — 설정을 끈다

auto 모드는 설정 파일 수정을 자기 권한을 바꾸는 동작으로 보고 막는다. 그래서 이 절차는 사람이 직접 한다.

1. 사용자 설정 파일 `C:\Users\<사용자>\.claude\settings.json`을 연다. 레포의 `.claude/settings.json`에는 이 줄이 없다.
2. `permissions`에서 `blockReadsOutsideWorkingDirectories` 줄을 지우고, 바로 위 줄 끝의 쉼표도 함께 지운다. 쉼표가 남으면 JSON이 깨진다.

   ```json
   "permissions": {
     "defaultMode": "auto",
     "blockReadsOutsideWorkingDirectories": true
   },
   ```

   위를 아래처럼 바꾼다.

   ```json
   "permissions": {
     "defaultMode": "auto"
   },
   ```

3. **새 세션을 연다.** Claude Code 문서는 `permissions` 수정이 실행 중인 세션에 곧바로 반영된다고 적지만, 2026-09-16(v2.1.273)에 실측해 보니 이 설정은 반영되지 않았다. 설정 파일에서 줄이 빠진 것을 확인한 뒤에도 원래 세션의 Read는 같은 오류로 계속 거절됐고, 새로 띄운 세션에서만 읽혔다. 실행 중인 세션에서 확인하면 복구가 실패한 것으로 오판하게 된다.
4. 새 세션에서 Claude에게 작업 폴더 밖 파일 하나를 Read로 읽게 해서 확인한다. `blockReadsOutsideWorkingDirectories` 오류 없이 읽히면 복구된 것이다. 대화를 끊지 않고 확인하려면 셸에서 `claude -p "Use the Read tool to read <폴더 밖 파일>. Reply READ_OK or READ_FAIL with the error." --model sonnet --permission-mode auto`를 돌린다. 모델은 auto 모드를 지원하는 것으로 고른다. Haiku처럼 auto 모드를 지원하지 않는 모델은 Manual 모드로 돌기 때문에, 비대화식 실행에서는 확인창을 띄울 수 없어 설정과 상관없이 읽기가 거절된다.
5. 이후 폴더 밖 첫 읽기 확인창이 다시 뜨면 **Keep allowing**을 고른다. Block from now on을 고르면 같은 줄이 다시 생긴다.

설정을 끄면 작업 폴더 밖 파일을 읽지 못하게 막던 보호가 사라진다. 대신 auto 모드 분류기는 그대로 돌아서, 저장소 밖으로 데이터를 내보내는 것 같은 위험한 동작은 여전히 차단된다.

## 설정을 켠 채로 쓰려면

보호를 유지하려면 설정은 그대로 두고, 확인창에 걸리는 명령 형태를 피한다.

- 작업 폴더 밖에서 자주 읽는 폴더는 `/add-dir`이나 `permissions.additionalDirectories`로 작업 폴더에 넣는다.
- 파일 조회는 셸 대신 Read·Grep·Glob으로 한다. 폴더 밖이면 이 도구들도 거절되지만, 확인창은 뜨지 않는다.
- 셸 명령에 반복문·변수·heredoc·서브셸을 쓰지 않는다. 외부 프로그램을 여러 번 돌려야 하면 반복을 레포의 고정 스크립트 안에 두고, 셸에서는 그 스크립트를 한 번만 부른다.
- 작업 폴더 안은 상대 경로로 적고, `git -C`나 `cd`로 경로를 다시 지정하지 않는다.

이렇게 해도 추적 불가 형태가 꼭 필요한 명령에서는 확인창이 남는다.
