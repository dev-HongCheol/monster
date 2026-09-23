# 워크플로우 다이어트 W5 — 공유 샌드박스와 옛 상태 파일 호환

- **작성일:** 2026-09-16 (계획 승인 게이트 2026-09-17)
- **브랜치:** `feat/workflow-diet` · worktree `F:\work\monster-wf`
- **상태:** 계획 — `/autoplan` 리뷰 완료·최종 게이트 승인(2026-09-17). 다음은 사용자 `계획 승인` → `pnpm wf approve-plan`
- **정본:** 없음 — 테스트 기반과 픽스처만 만든다. 실행 가능한 명세는 `tests/logic/WorkflowDiet.test.ts`가 든다
- **개요:** [`2026-09-16-workflow-diet-plan.md`](2026-09-16-workflow-diet-plan.md) — 목표·결정·제약·통과 조건과 절 번호(§n)는 그 문서의 것이다

---

#### W5. 공유 샌드박스와 옛 상태 파일 호환

- `tests/helpers/WfSandbox.ts`(신설): `makeRepo`(`git -c core.autocrlf=false init`, 커밋 둘, `refs/remotes/origin/main`)와 `runWf`를 `DocsHygiene.test.ts`·`ClaudeMdSplit.test.ts`에서 올린다. 기존 두 테스트는 이 헬퍼를 쓰게 고치되 단언은 바꾸지 않는다. `GIT_CEILING_DIRECTORIES`를 샌드박스 부모로 줘 상위 저장소로 올라가지 않게 하되, 샌드박스 경로를 `fs.realpathSync.native`로 편 뒤 넣고 구분자는 `path.delimiter`를 쓴다(Windows의 8.3 짧은 경로에서 천장이 안 먹는 것을 피한다). W1 테스트의 첫 케이스는 「샌드박스 루트에서 `measurable: true`, `origin/main` 있음」이다. `autocrlf`를 끄는 이유는 Windows에서 줄 끝 변환이 샌드박스 파일의 해시와 diff를 흔들기 때문이다.
- `WfSandbox`의 **`pnpm` 심**: 샌드박스 `bin/`에 `pnpm.cmd`(Windows)와 `pnpm`(POSIX) 두 파일을 쓰고 `runWf`가 `PATH` 앞에 그 폴더를 붙인다(`GIT_CEILING_DIRECTORIES`와 같은 자리에서 조립). 심은 `exec tsc …`·`exec biome …`이면 0으로 끝나고, `exec vitest run … --outputFile=<경로>`면 최소 vitest JSON(`numFailedTests: 0`)을 그 경로에 쓰고 0으로 끝난다. 심 전용 변수 `WF_SHIM_FAIL=vitest`를 주면 실패 JSON과 종료코드 1을 낸다 — 이 변수는 심 스크립트만 읽고 `workflow.mjs`·`verify.mjs`에는 그런 분기가 없으므로 §2에서 기각한 「환경변수 우회」가 아니다. 이것 없이는 `pass`가 전이 직전에 기본 러너를 돌리는 순간 툴체인 없는 샌드박스의 E2E 세 개가 깨지고(W2, `pnpm exec`가 `ERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE`로 죽는 것을 실측), §12의 「검사 통과 → 전이」 절반을 E2E로 잴 방법이 없다.
- 3D 브랜치 상태 파일 픽스처: `tests/fixtures/workflow-state/qa-setup-legacy.json`(키 열 개, 플래그 넷 `false`)을 두고, 새 `workflow.mjs`가 `status`·`ready-impl` 실패 경로(테스트 파일 없음)까지 도는지 고정한다. 둘째 픽스처 `verification-legacy.json`(옛 `pass ts`가 남긴 `ts_check_clean: true`·`ts_check_scope: 'full'`·`code_review_clean: true`)으로 「기록을 믿지 않고 전이 직전 검사가 판정한다」를 고정한다 — 3D 브랜치가 이 PR을 받은 뒤 검증에 들어갈 때 실제로 지나는 경로다.
- 피처 테스트 파일은 `tests/logic/WorkflowDiet.test.ts`다(`ready-impl`이 피처 이름의 PascalCase로 찾는다). W1~W3의 새 케이스를 여기에 두고, 기존 파일의 단언 변경은 그 파일에 둔다.
