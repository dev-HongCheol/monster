# planning — 계획

## 브랜치와 상태 초기화

`pnpm wf start <feature>`가 `feat/<feature>` 브랜치를 main 기준으로 만들고(이미 있으면 전환) 상태를 전부 초기화한다. 이 시점부터 브랜치가 실재하므로 이후 계획 커밋이 그 브랜치에 쌓이고, main에 직접 쌓이는 사고가 막힌다. 계획 문서에 브랜치를 "예정"으로 적지 않는다 — 이미 만들어졌으므로 `브랜치: feat/<feature>`로 확정해 쓴다.

시작 전에 로컬 main이 origin보다 뒤처지지 않았는지 본다. `start`는 로컬 main에서 분기하므로, 뒤처져 있으면 최근에 머지된 인프라가 빠진 채로 슬라이스가 시작된다.

이 문서를 다시 보고 싶을 뿐이라면 `pnpm wf steps planning`을 쓴다. `start`를 다시 치면 상태가 초기화된다.

## 백로그 확인 (필수)

`docs/development/backlog.md`(게임)와 `docs/development/backlog-implement.md`(코드)를 **둘 다** 연다. 이번 슬라이스의 테마·영향 범위에 걸리는 항목 중 함께 처리하는 것이 합리적인 것을 골라 스코프에 넣고, 계획 문서에 "이 슬라이스가 닫는 백로그 항목"으로 ID와 함께 적는다.

아카이브(`backlog-archive.md`·`backlog-implement-archive.md`)는 **여기서 열지 않는다.** 지금 필요한 것은 열린 항목뿐이고, 아카이브는 완료 항목이라 조회 비용만 늘린다.

## 요구사항과 리뷰

`/office-hours`로 요구사항을 재구성하고 스코프를 확인한 뒤, `/autoplan`으로 CEO·Eng 리뷰를 돌려 사용자 승인을 받는다.

## 계획 문서 작성

리뷰 결과를 `docs/development/sessions/<YYYY-MM-DD>-<feature>-plan.md`로 저장한다. **파일명에 `wf start`에 쓴 슬러그가 들어가야 한다** — 아래 게이트가 파일명에서 그 슬러그를 찾는다. 내용과 형식은 강제하지 않는다.

## 나가는 게이트: `approve-plan`

사용자가 **`계획 승인`**이라고 입력하면 `pnpm wf approve-plan`을 실행한다. 해당 기능의 계획 문서가 없으면 전이가 차단되므로, 막히면 문서를 먼저 쓴 뒤 다시 승인받는다.
