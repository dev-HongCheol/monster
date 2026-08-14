# Project Guidelines

## 프로젝트 문서 구조

모든 프로젝트 문서는 `docs/` 아래에 있다. 새 문서는 반드시 이 구조 안에 저장한다.

```
docs/
├── planning/               # 기획 (게임 디자인, 컨셉, 로드맵)
├── design/                 # 디자인 (아트 디렉션, UI/UX, 에셋 파이프라인)
│   ├── spec/               # 디자인 정본 (art-·ui- 접두사)
│   └── mockups/            # 확정 목업 HTML + 렌더 이미지 (결정 기록 아님)
├── development/            # 개발 (정본·절차·세션 기록)
│   ├── spec/               # 개발 정본 (code-·game-·docs-·ops- 접두사)
│   ├── workflow/           # phase별 절차 문서 (정본 — pnpm wf가 배달)
│   ├── sessions/           # 개발 세션/의사결정 기록 (날짜-주제.md)
│   └── troubleshooting/    # 운영/도구 이슈 + 복구 절차 (에러 발생 시 참조)
├── decisions/              # Architecture Decision Records (ADR, NNN-title.md)
├── qa/                     # QA (테스트 체크리스트, 버그 리포트)
└── etc/                    # 미정리 초안 문서
```

| 역할 | 참고 폴더 |
|------|-----------|
| 개발자 | `docs/development/`, `docs/planning/` |
| 디자이너 | `docs/design/`, `docs/planning/` |
| QA | `docs/qa/`, `docs/development/sessions/` |

### 주요 결정 기록 (ADR)

- [ADR 001: Cocos Creator 버전 선택](docs/decisions/001-cocos-version.md)
- [ADR 002: scripts/logic/ 분리 패턴](docs/decisions/002-scripts-logic-pattern.md)
- [ADR 003: 테스트 전략](docs/decisions/003-testing-strategy.md)
- [ADR 004: 워크플로우 상태 머신](docs/decisions/004-workflow-state-machine.md)
- [ADR 005: i18n 방식 — 자체 경량 t()](docs/decisions/005-i18n-approach.md)
- [ADR 006: 충돌 히트박스 — 플레이어 사각형 / 적 원](docs/decisions/006-collision-hitbox.md)
- [ADR 007: 스킨은 판정에 영향을 주지 않는다](docs/decisions/007-skin-hitbox-independence.md)
- [ADR 008: AI 이미지 생성은 유료 서비스에서 한다](docs/decisions/008-paid-art-generation.md)

> 세션 작업 문서(design doc, plan 등)는 `docs/development/sessions/`에 보관되며 CLAUDE.md에서 별도 관리하지 않는다.

## Safety Rules

### 절대 금지 (확인 없이 하지 않음)
- main 브랜치 force push
- **main에 직접 커밋** — 문서 수정 포함 모든 변경은 피처 브랜치에서 커밋 후 PR로 병합
- 5개 이상 파일 동시 수정 시 먼저 계획 공유
- 씬 파일(.scene), 프리팹(.prefab), 아트 에셋 삭제
- API 키, 크레덴셜 커밋

### 행동 규칙
- 같은 문제 3번 실패 시 → STOP, 상황 보고 후 대기
- 패키지/플러그인 설치 전 반드시 확인
- 현재 작업과 무관한 파일 수정 금지
- 발견한 무관 이슈 → 즉시 수정하지 말고 언급만 (슬라이스 밖 항목은 백로그로)
- **이번에 건드리지 않은 코드의 주석은 손대지 않는다** — 한 함수를 고치면서 같은 파일 다른 함수의 주석이 딸려 지워지는 사고를 막는 규칙이다. **바꾼 코드의 주석은 반드시 함께 갱신하고**(`@param` 포함), 지운 코드의 주석은 함께 지운다.
- **설명 주석·문서는 읽는 사람이 인과를 복원할 수 있게 쓴다** — 원칙 세 가지와 예시는 `docs/development/spec/docs-writing-style.md`가 정본이고, 코드 주석에 적용한 판은 `docs/development/spec/code-conventions.md` § 주석 기준에 있다. **주석·문서를 쓰기 전에 그쪽을 읽는다.** 같은 설명이 코드·테스트·문서에 복사돼 있으면 **함께 고친다**(한 곳만 고치면 나머지가 낡은 채로 남는다)

### 루프 방지
같은 파일을 5번 이상 수정해도 진전 없으면 → STOP하고 방향 재확인 요청

## Knowledge Base

모든 최신 정보는 아래에 있다. `docs/etc/`는 초안 폴더이므로 참조하지 않는다.

**정본은 질문 종류마다 다르다.** 문서끼리, 또는 문서와 코드가 어긋나면 **코드가 이긴다** — 구현이 실제로 무엇을 하는지는 코드와 그 JSDoc이 쥐고 있고 QA 문서는 그 거울이다. 검색으로 얻은 발췌도 같은 기준으로 판단한다(지나간 세션 기록이 현재 코드보다 위에 뜰 수 있다 — 유사도는 최신성을 걸러 주지 않는다).

| 질문 | 정본 |
|------|------|
| 구현이 무엇을 하나, 왜 그렇게 짰나 | `game/assets/scripts/**/*.ts` + JSDoc. 좌표계 순서·불변식처럼 화면에 안 드러나는 결정은 해당 순수 함수의 JSDoc이 든다 |
| 이 동작이 맞나 | `tests/logic/*.test.ts` — 실행 가능한 명세 |
| 코드를 어떻게 쓰나 | `docs/development/spec/code-conventions.md` — **코드 작성 전 항상 읽는다** |
| 문서를 어떻게 쓰나 | `docs/development/spec/docs-writing-style.md` — **문서 작성 전 항상 읽는다** |
| 그 밖의 개발 정본 — 용어·판정·빌드·환경 | `docs/development/spec/README.md`가 목록. 안 옮긴 것은 `gbrain-setup.md`(F77 뒤)와 로컬 환경 복구 매뉴얼 둘 |
| 지금 단계에서 뭘 하나 | `docs/development/workflow/<phase>.md` — **절차의 정본.** `pnpm wf` 전이가 배달하고 `pnpm wf steps`로 다시 본다 |
| 게임을 어떻게 만드나 | `docs/planning/` — 게임 디자인·컨셉·로드맵 |
| 무엇을 왜 그리나, 몇 px로 뽑나, 어떤 프롬프트로 만드나 | `docs/design/spec/README.md`가 목록 — 아트 정본 셋이 각각 방향·규격·생성 실행을 든다 |
| 다음에 뭘 하나 | `docs/development/backlog.md`(게임) + `backlog-implement.md`(코드) |
| 그 결정이 어느 슬라이스에서 났나 | `backlog-archive.md`·`backlog-implement-archive.md` — 세션 문서로 가는 실질 인덱스 |
| 이 에러를 어떻게 고치나 | `docs/development/troubleshooting/` |
| 그때 왜 그렇게 정했나 | `docs/development/sessions/`, `docs/decisions/` — **시점 기록이지 현재 명세가 아니다** |

- `docs/development/sessions/` — 시스템별 설계 근거는 ADR이 아니라 대개 여기 `*-plan.md`에 있다. "지금 어떻게 되어 있나"는 위 정본에 묻고, 여기는 **왜 그렇게 됐나**를 되짚을 때만 연다. 뒤집힌 내용이 그대로 남아 있어도 정상이며 표시를 달지 않는다(「문서 정리 규칙」). 파일명이 날짜로 시작하므로 정본 이력 줄의 날짜로 찾아 들어간다 — 정본은 여기로 링크하지 않는다
- `docs/decisions/` — ADR. 횡단 규칙·플랫폼·프로세스 결정 위주다. 세션 문서와 같은 **결정 기록**이고 수명만 더 길다 — 결정이 뒤집혀도 기존 ADR을 고치지 않고, 새 ADR을 쓴 뒤 거기에 무엇을 반전시켰는지 적는다(ADR 006이 2026-07-22 결정을 그렇게 뒤집었다)
- `docs/qa/` — 슬라이스별 시점 기록이라 코드와 어긋나면 코드 기준
- **백로그 2분할** — 슬라이스를 가로지르는 차기 TODO의 정본. `backlog.md`=게임(콘텐츠·밸런스·게임필·UI/UX·메타), `backlog-implement.md`=코드(아키텍처·리팩터·타입·툴체인·성능·로버스트니스). **항목 ID(`F27`·`G1`·`B2`)는 영구하며 파일이 갈려도 따라간다 — 재번호 금지.** 운영 규칙·상태 어휘의 정본은 `backlog.md` 머리말. **슬라이스 시작 조회에는 아카이브를 열지 않는다** — 그때 필요한 것은 열린 항목뿐이다

**검색 라우팅 (gbrain 설치 시).** 찾을 대상의 **단어를 이미 아는** 검색은 Grep이 빠르고 정확하다. 반대로 **단어를 모르는** 검색(개념·증상·"예전에 왜 이렇게 했더라")은 gbrain 의미 검색을 먼저 쓴다 — 그 경우 Grep은 무관한 문서를 주거나 0건을 낸다. 심볼의 정의·참조 위치는 `code-def`·`code-refs`가 파일과 줄 범위를 바로 준다. **색인은 특정 커밋 기준이라 낡을 수 있다** — 검색 결과는 단서로만 쓰고 최종 판단은 현재 코드로 확인한다. **결과가 비었거나 엉뚱하면 없다고 결론짓기 전에 `gbrain sources status`로 마지막 동기화 시점을 본다** — 낡은 색인은 침묵하지 않고 가장 비슷한 것을 그럴듯한 점수로 돌려주므로, 지연을 모르면 조용히 틀린 답을 믿게 된다. 미설치 환경이면 그냥 Grep으로 진행한다.

지식 추가 기준:
- **이번 슬라이스가 바꾼 명세** → 위 표의 해당 정본을 고친다(없으면 만든다). 세션·ADR에만 적으면 다음 사람이 시점 기록을 명세로 읽는다
- 주요 기술/설계 결정 → `docs/decisions/NNN-title.md` ADR로 작성
- 개발 세션 기록 → `docs/development/sessions/YYYY-MM-DD-topic.md`
- 재발하는 운영/도구 이슈 + 복구 절차 → `docs/development/troubleshooting/<topic>.md` (세션 기록 아님 — 에러 발생 시 찾아보는 레퍼런스)
- 새 기획/디자인 문서 → gstack 스킬로 정리 후 해당 폴더에 저장
- **슬라이스 밖 차기 TODO** → 성격에 맞는 백로그에 추가한다. 각 슬라이스 `*-review-issues.md`·`*-followups.md`에 흩어 두지 말 것 — 그 출처 문서는 시점 기록으로 **보존**하고, 백로그가 **출처 역링크로 집약**한다. 요약은 1~2문장으로 짧게 쓰고 상세는 출처 링크에 맡긴다. 항목이 한 슬라이스 분량으로 커지면 plan 문서로 승격하고 아카이브 파일에 링크로 남긴다

## Workflow

### 워크플로우 상태

상태의 단일 진실은 `.claude/workflow-state.json`의 **`phase`** 하나다. 상태 변경은 **반드시 `pnpm wf <command>` CLI로만** 한다. PreToolUse 훅(`gate-scripts.mjs`)이 상태 파일 직접 편집을 차단하고, phase 기준으로 `game/assets/scripts/**/*.ts` 편집을 게이팅한다. (편집 허용 phase: `implementation`, `verification`)

```
planning → qa-setup → implementation → verification → user-verification → pr-ready → done
```

| 명령 | 주체 | 전이 |
|------|------|------|
| `pnpm wf start <feature>` | AI | `feat/<feature>` 브랜치 생성·전환 + 전체 초기화 → `planning` |
| `pnpm wf approve-plan` | 사용자 트리거(`계획 승인`)→AI | `planning` → `qa-setup` (**계획 문서 존재** 확인 후 전환) |
| `pnpm wf skip-test "<사유>"` | AI | 테스트 스킵 (순수 로직 없음, 사유 필수) |
| `pnpm wf ready-impl` | AI | `qa-setup` → `implementation` (문서·테스트 파일 확인 + 피처 테스트 **RED** 검증) |
| `pnpm wf start-verification` | AI | `implementation` → `verification` (전체 스위트 **GREEN** 검증 후 전환) |
| `pnpm wf pass <cso\|ts\|lint\|review>` | AI | 개별 검증 통과 (4개 모두 통과 + **QA 확정 게이트** + **정본 선언 게이트** 통과 시 자동 `user-verification`). **`pass ts`는 타입체크를 직접 실행**해 실패하면 차단한다 |
| `pnpm wf invalidate` | AI | `verification` 중 코드 변경 → 전체 검증 초기화 |
| `pnpm wf rework` | 사용자 트리거(`리워크`)→AI | `user-verification` → `implementation` (버그 발견 복귀) |
| `pnpm wf approve-pr` | 사용자 트리거(`PR 승인`)→AI | `user-verification` → `pr-ready` (**에셋 `.meta` 게이트** + **타입체크 범위 게이트**: `logic-only`면 차단) |
| `pnpm wf pr-done` | AI | `pr-ready` → `done` |
| `pnpm wf canon <분류>-<주제> "<제목>" "<질문>" [--design]` | AI | 새 정본 문서 생성 + `spec/README.md` 등재 + 갱신 기록 |
| `pnpm wf canon-done <경로...>` | AI | 기존 정본을 고쳤음을 기록 (경로 존재 확인) |
| `pnpm wf canon-skip "<사유>"` | AI | 이번 슬라이스가 바꾼 명세 없음 (사유 필수) |
| `pnpm wf steps [phase]` | AI/사용자 | 절차 문서 재출력 (전이 없음, 상태 불변) |
| `pnpm wf check-meta` | AI/사용자 | 에셋 `.meta` 누락 검사 (누락 시 종료코드 1) |
| `pnpm wf check-qa` | AI/사용자 | QA 문서 미확정(잠정) 표시 검사 (남아 있으면 종료코드 1) |
| `pnpm wf check-docs` | AI/사용자 | 절차 문서 정합 검사 (누락·잉여 시 종료코드 1) |
| `pnpm wf check-links` | AI/사용자 | 마크다운 링크·앵커 검사 (깨진 링크 시 종료코드 1) |
| `pnpm wf status` | — | 현재 상태 + 편집 가능 여부 + 현재 phase 절차 문서 경로 |

> **`pnpm typecheck`** (wf 커맨드가 아님) — 타입체크 단독 실행. `pass ts`가 내부적으로 **같은 코드**(`.claude/typecheck.mjs`)를 호출하므로, 여기서 통과하면 게이트도 통과한다.

> **절차는 phase가 배달한다.** 전이에 성공하면 `docs/development/workflow/<phase>.md`가 터미널에 출력된다. 같은 phase에 두 번째부터는 제목만 나오고, 전문은 `pnpm wf steps`로 다시 본다. `wf start`를 재출력 수단으로 쓰지 않는다 — phase 가드가 없어 상태가 초기화된다.

> **사람 게이트 (사용자 트리거 → AI 실행):** 아래 세 전이는 사람의 판단이 필요한 지점이다. 사용자가 자연어로 지시하면 **AI가 해당 커맨드를 대신 실행**한다.
>
> | 사용자 입력 | AI 실행 |
> |------------|--------|
> | `계획 승인` | `pnpm wf approve-plan` |
> | `PR 승인` | `pnpm wf approve-pr` |
> | `리워크` (또는 "버그, 구현 복귀") | `pnpm wf rework` |
>
> 나머지 커맨드는 AI가 절차에 따라 자동 실행한다.
>
> **머지 가능한 PR은 `PR 승인` 후에만.** `phase: "user-verification"` 진입 시 AI가 **검토용 Draft PR**을 자동 생성한다 — Draft 상태라 GitHub Merge 버튼이 비활성화되어 실수 머지가 차단된다. Draft 해제(`gh pr ready`)와 squash merge는 `phase: "pr-ready"`에서만 한다.

### 기능 개발 — 9단계 뼈대

상세 절차는 `pnpm wf`가 phase 문서로 배달한다. 여기 있는 것은 **커맨드 순서**뿐이다.

```
1~2 계획       wf start <feature> → 백로그 2종 확인 → /office-hours → /autoplan
               → sessions/<날짜>-<feature>-plan.md 작성 → 사용자 `계획 승인`
3~4 QA·테스트  docs/qa/<feature>-test.md + tests/logic/<Feature>.test.ts(RED)
               → wf ready-impl (RED 게이트)
5   구현       GREEN → REFACTOR → wf start-verification (GREEN 게이트)
6   AI 검증    QA 문서 확정(잠정→확정) → 정본 갱신(wf canon/canon-done/canon-skip)
               → /cso → pass cso → pnpm typecheck → pass ts → pnpm check --write
               → pass lint → 기능 단위 커밋 → 코드리뷰 → pass review
               코드 수정이 끼면 invalidate로 cso·정본 선언부터 다시
7   사용자 검증 정본 갱신·문서 정리 → gh pr create --draft → 사용자 에디터 세팅·인게임 테스트
               버그 발견 시 사용자 `리워크`
8   PR 승인    신규 .meta 커밋·push → 사용자 `PR 승인` → wf approve-pr
9   머지       상태 표시 확정 → gh pr ready → squash merge → wf pr-done → gbrain 색인 갱신
```

상세: `pnpm wf steps [phase]` · 인덱스: `docs/development/workflow/README.md`

### 문서/설계 작업 (코드 없음)

`/office-hours` 또는 `/plan-ceo-review`로 방향을 검토하고, 결과물을 해당 `docs/` 하위 폴더에 저장한다. 주요 결정은 `docs/decisions/` ADR로 기록한다.

### 문서 정리 규칙 (7단계 — PR을 올리기 전 재검토)

자주 읽는 문서(두 백로그·`docs/design/` 정본·이 파일)는 슬라이스마다 조금씩 자란다. 한 슬라이스 안에서는 티가 안 나지만 쌓이면 다음 슬라이스의 조회 비용이 된다 — 2026-08-06에 두 백로그 조회만 57.6k 토큰이었고 그 부피의 38%가 항목 **여섯 개**에 몰려 있었다. 그래서 **PR을 올리기 직전에 이번 슬라이스가 건드린 문서만** 아래로 훑는다(전수 점검이 아니다).

**머지 직전이 아니라 PR을 올릴 때인 이유는, 정리 결과가 리뷰 대상 안에 있어야 하기 때문이다.** 머지 직전에 문서를 손보면 그 변경은 사용자가 검토한 적 없는 채로 머지된다. 8·9단계에서 문서에 허용되는 변경은 **상태 표시**(플랜을 "완료"로, 백로그 행의 상태 어휘)뿐이고, 내용을 옮기거나 줄이는 일은 여기서 끝나 있어야 한다.

- **백로그 행은 요약이지 본문이 아니다.** 이번에 추가·수정한 항목이 몇 문단으로 자랐으면 진단·수치·대안 비교 같은 상세를 정본(세션 `*-plan.md`·ADR·`docs/design/` 정본)으로 옮기고, 행에는 **무엇을·왜·상태 + 정확한 링크**만 남긴다. 행은 출처를 대체하지 않고 **집약**한다.
- **출처에 "이 대화"를 남기지 않는다.** 슬라이스 밖에서 난 결정도 세션 문서로 적고 행은 그 문서를 링크한다. 근거를 적을 데가 없으면 **행에 쓰게 되고**, 그렇게 부푼 행은 아무도 다시 줄이지 않는다. **검토하고 접은 안도 세션 문서에 남긴다** — 기각 기록이 없으면 그 항목을 집는 다음 사람이 같은 안을 다시 낸다.
- **완료 항목을 아카이브로 옮긴다** — `backlog-archive.md`(게임)·`backlog-implement-archive.md`(코드)로 한 줄.
- **순환 참조를 만들지 않는다.** 두 문서가 서로를 "상세는 저쪽"으로 가리키면 어느 쪽에도 답이 없고 양쪽 다 전문을 들게 된다. 한쪽을 정본으로 정하고 반대편은 포인터만 둔다.
- **낡은 참조를 고친다.** 아카이브로 옮긴 항목 ID를 가리키는 참조, 이번에 닫은 항목을 아직 "진행 중"으로 적은 문서, 깨진 링크.
- **명세를 드는 정본은 결정 기록(세션 문서·ADR)을 링크하지 않는다.** "지금 이렇다"를 말하는 문서(두 `spec/`·`docs/planning/`·`docs/development/workflow/`·코드)가 대상이다. `docs/design/` 바로 아래는 초안·진행 중 계획의 자리라 대상이 아니다. **백로그는 아니다** — 백로그가 말하는 것은 "다음에 이걸 한다"라서 그 일을 집을 사람이 갈 링크가 행의 일이고, 아카이브는 아예 세션 문서 인덱스로 정해져 있다. 명세 정본은 현재 결론과 그 이유를 스스로 들고, 이력이 필요하면 그 문서 안의 이력 절에 **날짜와 무엇이 바뀌었는지**만 남긴다. 세션 파일명이 날짜로 시작하므로 링크가 없어도 `sessions/2026-08-04-*`로 찾아갈 수 있고, 링크와 달리 날짜는 낡거나 깨지지 않는다. 링크는 **결정 기록 → 정본** 한 방향으로만 건다(세션 문서 머리말의 `정본:` 줄). 정본이 반대 방향으로 이으면 결정이 바뀔 때마다 그 세션 문서를 찾아가 낡음을 표시해야 하는데 그 추적은 매번 놓친다 — `art-direction.md` 머리말이 스타일 확정 기록을 가리키고 있던 때, 사용자가 링크를 타고 들어가 그 문서의 폐기된 외형 명세를 현재 명세로 읽은 일이 실제로 있었다(2026-08-08). 한 결론이 세션 문서 여럿에 걸쳐 있어도 출처를 나열하지 않고 **현재 결론 한 문장으로 다시 쓴다.**
- **다른 슬라이스의 결정 기록은 찾아가 고치지 않는다.** 세션 문서와 ADR은 그때의 기록이라 낡는 것이 정상이고, 뒤집혔다는 표시를 달기 위해 과거 문서를 뒤지지 않는다. 세션 문서가 60개를 넘는데 "방금 뒤집은 결정을 과거 어느 문서가 주장하는가"를 찾을 방법이 없어서(낡은 문구를 이미 알 때만 Grep이 듣는다) 그 표시는 반드시 빠뜨린 채로 남고, 하나만 달아 두면 "표시된 것은 낡았고 나머지는 현재"라는 더 나쁜 오해를 만든다. 고칠 곳은 정본 한 곳이다. **지금 진행 중인 슬라이스에서 쓴 문서는 예외** — 아직 쓰는 중이므로 슬라이스가 끝날 때까지 계속 고친다. 세션 문서는 「확정」을 주장하지 않는다. 그때 무엇을 정했는지를 적고, 확정은 정본이 든다.
- **정본 문서의 절 번호를 바꾸지 않는다.** 다른 문서들이 `§2.3`처럼 **번호로** 참조하므로 재번호하면 그 참조가 조용히 어긋난다(`art-generation-playbook.md` 한 파일만 26곳·8파일에서 절 번호로 참조된다). 절을 새로 넣어야 하면 `§2.0`처럼 **끼워 넣고**, 제목을 바꿀 때는 그 문서 안의 앵커 링크(`](#...)`)를 함께 고친다.
- **이력은 지우지 말고 한 줄로 줄인다.** 기각·뒤집힌 안을 통째로 지우면 다음 슬라이스에서 같은 안이 다시 제안된다. `기각: <안 이름> → <링크>`로 이름만 남기고 이유는 링크가 들게 한다.

## Cocos Creator 구현 규칙

Cocos Creator 관련 코드/문서 작성 전 반드시 Context7로 공식 문서를 먼저 조회한다. 훈련 데이터 기반으로 추측하지 않는다. (`mcp__context7__resolve-library-id` → `get-library-docs`, 예: `/websites/cocos_creator_3_8_manual_en`) 확인이 필요한 주제: Canvas 계층 구조, 컴포넌트 생성 방법, SpriteFrame 경로, 좌표계, 레이어 설정, Layout·Widget 동작.

### 에셋 `.meta` 관리 규칙

Cocos는 `game/assets/` 아래 **모든 파일·디렉터리에 `.meta`(UUID 보관)** 를 만든다. 엔진은 자산을 경로가 아니라 UUID로 참조하고, **씬/프리팹은 참조 대상의 UUID를 저장**한다. `.meta`가 커밋되지 않으면 클론·타 환경에서 UUID가 재생성돼 **씬/프리팹 참조가 깨진다**(공식 매뉴얼: ".meta should be included in version control"). 그래서 `.gitignore`도 `*.meta` 추적을 강제한다.

**핵심 원칙: `.meta`는 Cocos 에디터만 생성한다. AI는 `.meta`를 절대 직접 만들지 않는다.** `.meta`는 Cocos가 자산을 임포트할 때 **동적으로 생성하는 산출물**이라, AI가 포맷만 맞춰 손으로 만들면 최종 Cocos가 생성하는 것과 내용이 달라질 수 있다. **최종 사용 주체인 Cocos가 만든 것이 유일한 진실**이다. 따라서 순수 로직 `.ts`·`resources/*.json`을 포함한 **모든 `.meta`는 사용자가 7단계에서 Cocos로 최종 테스트할 때 생성**되고 **8단계 `PR 승인` 시점에 일괄 커밋**한다. (테스트·빌드는 `.meta`가 없어도 동작 — vitest/tsc는 경로로 import한다.)

| 시점 | `.meta` 처리 |
|------|--------------|
| AI 구현 중 (5~6단계) | AI는 신규 `.ts`/`.json`만 만들고 **`.meta`는 만들지 않는다.** |
| 7단계 진입 Draft PR | **신규 `.meta` 0개.** AI가 만든 것도, 작업 중 생긴 것도 **비포함**한다. |
| 7단계 사용자 테스트 | 사용자가 Cocos 에디터로 인게임 테스트 → Cocos가 신규 자산의 `.meta`를 모두 생성 |
| 8단계 `PR 승인` | Cocos가 생성한 **모든 신규 `.meta`를 먼저 커밋·push**한 뒤 `pnpm wf approve-pr` |

**게이트:** `pnpm wf approve-pr`이 추적되지 않은 `.meta`를 자동 검사해 **누락 시 PR 승인을 차단**한다(머지 후 모든 환경에서 UUID 재생성 → 참조 깨짐 방지). 언제든 `pnpm wf check-meta`로 확인.

## 도구 스택

**gstack**(제품 워크플로) · **superpowers**(구현 방법론, 코드 작성 시점에 활성화) · **Context7 MCP**(Cocos 공식 문서 조회) 셋을 쓴다. **어느 구간에 무엇을 쓰고 어떻게 까는지, 이름만으로 용도가 안 드러나는 스킬의 매핑은 `docs/development/spec/ops-skill-routing.md`가 정본이다.**

웹 브라우징은 항상 gstack의 `/browse` 사용. `mcp__claude-in-chrome__*` 도구는 사용 금지.
