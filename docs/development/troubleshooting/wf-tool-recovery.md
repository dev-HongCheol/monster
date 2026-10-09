# `pnpm wf`가 고장 났을 때

> **분류:** 운영/도구 이슈 + 복구 절차 (워크플로우 도구 자체가 오류를 내거나 잘못 판정할 때 참조)
> **상태:** 복구 절차. 고장을 실제로 겪으면 증상과 원인을 이 문서에 더한다

---

## 증상 (이게 보이면 이 문서다)

- `pnpm wf <명령>`이 안내 문구 대신 스택 트레이스로 죽는다.
- 코드와 문서가 멀쩡한데 `start-verification`·`pass`·`approve-pr`이 막히고, 막힌 이유가 실제 상태와 맞지 않는다.
- `pnpm wf status`가 상태 파일을 읽지 못한다.

먼저 고장이 도구에 있는지 확인한다. `pnpm typecheck`·`pnpm check`·`pnpm exec vitest run`을 직접 돌려 셋 다 통과하는데 `pnpm wf verify`만 실패하면 도구 쪽이다.

## 먼저 멈추고 사용자에게 알린다

AI는 고장을 혼자 돌아서 지나가지 않는다. 아래 방법 가운데 어느 것이든, 쓰기 전에 사용자에게 무엇이 고장 났는지와 어느 방법을 쓰려는지 알리고 확인을 받는다. 방법마다 사람이 승인해야 하는 단계나 도구가 해 주던 검사를 건너뛰게 되기 때문이다. 다른 도구로 대신하는 것도 같다(예: gstack이 고장 나서 `/cso` 대신 `security-review`를 쓰는 것).

## 코드는 어느 단계에서 고칠 수 있나

훅(`.claude/hooks/gate-scripts.mjs`)은 저장소 안의 코드를 `implementation`·`verification`에서만 고칠 수 있게 막는다. 코드는 게임 스크립트, 워크플로우 도구(`.claude/workflow.mjs`·`.claude/lib/**`)와 훅, 테스트, `tools/` 스크립트, 그리고 고치면 훅이나 검사를 끌 수 있는 설정 파일(`.claude/settings.json`·`package.json`·biome·tsconfig·`.husky/`)이다. 테스트 코드만은 RED 테스트를 쓰는 `qa-setup`에서도 고칠 수 있다. 정확한 범위는 훅의 머리 주석에 있다.

그래서 도구를 고치려면 지금 슬라이스가 그 두 단계에 있어야 한다.

- **`verification`에서 생긴 문제는 그 자리에서 고친다.**
- **`user-verification`에서 생긴 문제(`approve-pr` 포함)는 사용자에게 알리고, 사용자가 `리워크`를 입력하면 구현으로 돌아가 고친다.**
- **`rework` 자체가 고장 나서 돌아갈 수 없으면** 아래 방법 2를 쓸지 사용자에게 묻는다.

## 방법 1 — 도구를 고치는 슬라이스를 따로 만든다

지금 슬라이스와 상관없는 도구 고장이면, 다른 작업 폴더에서 새 슬라이스로 고친다(`git worktree add <폴더> origin/main` 뒤 그 폴더에서 `pnpm wf start <이름>`). 상태 파일은 작업 폴더마다 따로라서 지금 슬라이스의 phase는 바뀌지 않는다. 지금 작업 폴더에서 `wf start`를 치면 지금 슬라이스의 상태가 처음으로 돌아가므로 쓰지 않는다.

새 슬라이스는 다른 슬라이스와 같은 절차를 밟으므로, 도구 코드도 `implementation`에 들어가야 고칠 수 있고 검사도 도구가 요구하는 대로 한다. `wf start`도 고장 나서 이 방법을 쓸 수 없으면 방법 2를 쓸지 사용자에게 묻는다.

## 방법 2 — 고장 나기 전의 도구로 상태만 넘긴다

진행 중인 슬라이스를 급히 다음 phase로 넘겨야 할 때 쓴다. 고장 나기 전 커밋을 임시 작업 폴더로 꺼내고, 그 안의 `workflow.mjs`를 지금 작업 폴더의 상태 파일에 대고 실행한다.

```bash
git worktree add <임시 폴더> <고장 나기 전 커밋>
CLAUDE_PROJECT_DIR=<지금 작업 폴더> node <임시 폴더>/.claude/workflow.mjs <명령>
```

`CLAUDE_PROJECT_DIR`이 없으면 옛 도구가 임시 폴더의 상태 파일을 고치므로, 지금 슬라이스의 phase는 그대로 남는다.

**이 방법은 사용자가 직접 지시하거나 승인할 때만 쓴다.** `pnpm wf`로 치는 명령이 아니라서, `approve-plan`·`approve-pr`·`rework`에 걸어 둔 사람 확인창이 뜨지 않는다. AI가 스스로 쓰면 사람이 승인해야 하는 전이를 사람 없이 넘길 수 있다.

쓴 뒤에는 `git diff .claude/workflow-state.json`으로 바뀐 값을 눈으로 확인하고 커밋한다. 옛 도구는 새 값(`qa_skip_reason`·`cso_commit`)을 모르므로, 그 값을 지운 채 상태 파일을 다시 썼을 수 있다. 확인을 마치면 `git worktree remove <임시 폴더>`로 정리한다.
