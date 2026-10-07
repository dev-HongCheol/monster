# `pnpm wf`가 고장 났을 때

> **분류:** 운영/도구 이슈 + 복구 절차 (워크플로우 도구 자체가 오류를 내거나 잘못 판정할 때 참조)
> **상태:** 복구 절차. 고장을 실제로 겪으면 증상과 원인을 이 문서에 더한다

---

## 증상 (이게 보이면 이 문서다)

- `pnpm wf <명령>`이 안내 문구 대신 스택 트레이스로 죽는다.
- 코드와 문서가 멀쩡한데 `start-verification`·`pass`·`approve-pr`이 막히고, 막힌 이유가 실제 상태와 맞지 않는다.
- `pnpm wf status`가 상태 파일을 읽지 못한다.

먼저 고장이 도구에 있는지 확인한다. `pnpm typecheck`·`pnpm check`·`pnpm exec vitest run`을 직접 돌려 셋 다 통과하는데 `pnpm wf verify`만 실패하면 도구 쪽이다.

## 어디서 생긴 문제인가에 따라

- **`verification`에서 생긴 문제는 그 자리에서 고친다.** 이 phase에서는 코드를 고칠 수 있다.
- **`approve-pr`에서 생긴 문제는 `pnpm wf rework`로 돌아가 고친다.** `user-verification`에서는 훅이 게임 스크립트 편집을 막는다.

## 방법 1 — 도구를 고치는 브랜치를 따로 만든다

`.claude/workflow.mjs`·`.claude/lib/**`·훅은 phase와 상관없이 고칠 수 있다. 훅이 phase로 막는 것은 `game/assets/scripts/**/*.ts` 편집뿐이기 때문이다. 그러니 `pnpm wf start` 없이 git으로 브랜치를 만들어 고친다(`git switch -c fix/<이름> origin/main`).

이 방법에서는 도구가 검사를 요구하지 않으므로 검사를 손으로 한다. 전체 테스트, 타입 검사, 바뀐 부분에 대한 `/cso`, 서브에이전트 코드 리뷰를 하고 PR 본문에 그 결과를 적는다.

## 방법 2 — 고장 나기 전의 도구로 상태만 넘긴다

진행 중인 슬라이스를 급히 다음 phase로 넘겨야 할 때 쓴다. 고장 나기 전 커밋을 임시 작업 폴더로 꺼내고, 그 안의 `workflow.mjs`를 지금 작업 폴더의 상태 파일에 대고 실행한다.

```bash
git worktree add <임시 폴더> <고장 나기 전 커밋>
CLAUDE_PROJECT_DIR=<지금 작업 폴더> node <임시 폴더>/.claude/workflow.mjs <명령>
```

`CLAUDE_PROJECT_DIR`이 없으면 옛 도구가 임시 폴더의 상태 파일을 고치므로, 지금 슬라이스의 phase는 그대로 남는다.

**이 방법은 사용자가 직접 지시할 때만 쓴다.** `pnpm wf`로 치는 명령이 아니라서, `approve-plan`·`approve-pr`·`rework`에 걸어 둔 사람 확인창이 뜨지 않는다. AI가 스스로 쓰면 사람이 승인해야 하는 전이를 사람 없이 넘길 수 있다.

쓴 뒤에는 `git diff .claude/workflow-state.json`으로 바뀐 값을 눈으로 확인하고 커밋한다. 옛 도구는 새 값(`qa_skip_reason`·`cso_commit`)을 모르므로, 그 값을 지운 채 상태 파일을 다시 썼을 수 있다. 확인을 마치면 `git worktree remove <임시 폴더>`로 정리한다.
