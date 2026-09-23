# 워크플로우 다이어트 W7 — 백로그 정리

- **작성일:** 2026-09-16 (계획 승인 게이트 2026-09-17)
- **브랜치:** `feat/workflow-diet` · worktree `F:\work\monster-wf`
- **상태:** 계획 — `/autoplan` 리뷰 완료·최종 게이트 승인(2026-09-17). 다음은 사용자 `계획 승인` → `pnpm wf approve-plan`
- **정본:** 없음 — 백로그 항목을 닫고 열 뿐 명세를 바꾸지 않는다
- **개요:** [`2026-09-16-workflow-diet-plan.md`](2026-09-16-workflow-diet-plan.md) — 목표·결정·제약·통과 조건과 절 번호(§n)는 그 문서의 것이다

---

#### W7. 백로그

- `F78` 닫음 → `backlog-docs.md` 완료 아카이브로.
- `F10` 행에 D12 결정을 한 줄 더한다(닫지 않음).
- `F95`·`F96` 행에 「2단계 `workflow-obligations`에서 배달 문서 예산과 함께」를 적는다.
- 새 항목(`F109`부터): 「도구 슬라이스의 QA 문서 자체 생략 여부」는 T1 `skip-qa`로 닫혀 항목을 만들지 않는다(F109 번호는 비운다), 「상태 파일 핸드오프 수단(`wf handoff`)과 F10」(F110), 「`engines.node` 명시와 Node 22.18+에서 strip-types 재평가」(F111), 「`wf status`의 다음 명령 추천·`verify` 소요 시간·`wf steps`의 해당 없음 표시·`qaDocClean`이 `DocsHygiene`을 따로 띄우는 것을 전체 스위트 결과로 대체」(F112, 2단계 `status` 재작성 때).
- `backlog-implement.md`에 2단계 슬라이스 항목을 하나 둔다: 「`workflow-obligations` — 게이트 표·지문·`scope:`·장부·배달 문서 예산. 계약은 계획 문서 §6」.
- `F107`(gstack 산출물이 `pnpm check`를 빨갛게 만든다)을 `biome.json`의 `!**/.gstack`으로 닫고 아카이브한다. 3D 브랜치와 같은 행이라 머지 충돌 1건은 각오한다.
- 새 항목 `F113`: 새 클론·worktree에서 `game/temp/tsconfig.cocos.json`이 없어 vitest 39파일이 불러오기에서 실패한다(브리프 §4.4). 이 슬라이스는 W2의 실패 요약이 그 패턴을 감지해 복구 안내를 찍는 데까지만 한다. 근본 처방(`vitest.config.ts`의 `esbuild.tsconfigRaw`로 `game/tsconfig.json` 탐색을 끊기)은 F113으로 남긴다. 덧붙여 worktree에 복사해 둔 그 파일의 `paths`는 원 폴더(`F:\work\monster\game\assets\*`)를 가리켜 worktree의 `scope: full`이 다른 체크아웃의 경로 위에서 성립한다 — 같은 항목에 적는다.
