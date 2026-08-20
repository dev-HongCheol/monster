# 워크플로 절차 문서

phase 하나에 문서 하나다. `pnpm wf` 전이가 성공하면 그 순간 새 phase의 문서가 터미널로 배달되므로, 평소에 이 폴더를 열어 둘 필요가 없다. 다시 보려면 `pnpm wf steps`(현재 phase)나 `pnpm wf steps <phase>`를 친다. **`pnpm wf start`를 재출력 수단으로 쓰지 않는다** — `start`는 phase 가드가 없어 언제 쳐도 상태를 초기화하므로 진행 중인 슬라이스가 날아간다.

여기 있는 것이 **현재 절차의 정본**이다. 낡으면 고친다(그 시점의 기록인 `sessions/`·ADR과 다른 층이다). 그래서 이 문서들은 결정 기록으로 나가는 링크를 두지 않는다 — 링크를 타고 들어간 사람이 폐기된 절차를 현재 절차로 읽는 사고를 막기 위해서다.

## 계획에서 머지까지

| phase | 문서 | 하는 일 | 나가는 게이트 |
|---|---|---|---|
| `planning` | `planning.md` | 백로그 확인, 요구사항 정리, 계획 문서 작성 | `approve-plan` (사용자 `계획 승인`) |
| `qa-setup` | `qa-setup.md` | QA 문서 + 실패하는 테스트 | `ready-impl` |
| `implementation` | `implementation.md` | 구현 (GREEN → REFACTOR) | `start-verification` |
| `verification` | `verification.md` | 보안·타입·린트·커밋·코드 리뷰 | `pass` 4종 |
| `user-verification` | `user-verification.md` | Draft PR, 사용자 에디터·인게임 테스트 | `approve-pr` (사용자 `PR 승인`) 또는 `rework` |
| `pr-ready` | `pr-ready.md` | 상태 표시 확정, Draft 해제, squash merge | `pr-done` |
| `done` | — | 절차 없음 | — |

## 새 문서를 넣는 법

파일명이 곧 phase 이름이고, 그 어휘의 출처는 `.claude/workflow.mjs`의 `PHASES` 배열이다. phase를 추가하면 같은 이름의 `.md`를 여기 만든다. `pnpm wf check-docs`가 누락과 잉여를 검사하며, 배달되지 않는 `.md`(phase 이름도 `README.md`도 아닌 것)도 잉여로 잡는다 — 읽히지 않은 채 낡는 문서를 만들지 않기 위해서다.

**게이트 이름을 `##` 제목에 드러낸다.** 같은 phase에 두 번째로 배달될 때는 제목 줄만 나가므로, 제목이 곧 "다시 돌아야 할 게이트 목록" 구실을 해야 한다.

문서 크기는 개당 4,000자, 합계 16,000자를 넘지 않는 것을 목표로 한다. **재는 기계는 없다** — 2026-08-19에 그 단언 둘을 걷었고, 지금 자수를 재는 것은 `CLAUDE.md`에서 「항상 읽는다」로 지정된 정본의 합계뿐이라 절차 문서는 그 대상이 아니다. 넘으면 임계값을 올리지 말고 무엇이 정본에 있어야 하는 내용인지를 다시 보며, 그 판단은 코드 리뷰가 받는다.
