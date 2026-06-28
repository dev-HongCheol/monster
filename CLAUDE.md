# Project Guidelines

## 프로젝트 문서 구조

모든 프로젝트 문서는 `docs/` 아래에 있다. 새 문서는 반드시 이 구조 안에 저장한다.

```
docs/
├── planning/               # 기획 (게임 디자인, 컨셉, 로드맵)
├── design/                 # 디자인 (아트 디렉션, UI/UX, 에셋 파이프라인)
├── development/            # 개발 (아키텍처, 환경 설정)
│   ├── sessions/           # 개발 세션/의사결정 기록 (날짜-주제.md)
│   └── troubleshooting/    # 운영/도구 이슈 + 복구 절차 (에러 발생 시 참조)
├── decisions/              # Architecture Decision Records (ADR, NNN-title.md)
├── qa/                     # QA (테스트 체크리스트, 버그 리포트)
└── etc/                    # 미정리 초안 문서
```

### 역할별 주요 문서 위치

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

> 세션 작업 문서(design doc, plan 등)는 `docs/development/sessions/`에 보관되며 CLAUDE.md에서 별도 관리하지 않는다.

## Safety Rules

### 절대 금지 (확인 없이 하지 않음)
- main 브랜치 force push
- 5개 이상 파일 동시 수정 시 먼저 계획 공유
- 씬 파일(.scene), 프리팹(.prefab), 아트 에셋 삭제
- API 키, 크레덴셜 커밋

### 행동 규칙
- 같은 문제 3번 실패 시 → STOP, 상황 보고 후 대기
- 패키지/플러그인 설치 전 반드시 확인
- 현재 작업과 무관한 파일 수정 금지
- 발견한 무관 이슈 → 즉시 수정하지 말고 언급만
- **기존 JSDoc/인라인 주석 삭제 금지** — 기존 코드에 이미 있는 주석은 수정·기능 추가 시에도 유지한다. 파라미터가 변경된 경우 `@param` 내용을 업데이트한다.

### 루프 방지
같은 파일을 5번 이상 수정해도 진전 없으면 → STOP하고 방향 재확인 요청

## Knowledge Base

모든 최신 정보는 아래에 있다. `docs/etc/`는 초안 폴더이므로 참조하지 않는다.

- `docs/development/conventions.md` — **코드 컨벤션. 코드 작성 전 항상 읽는다**
- `docs/development/writing-style.md` — **문서 작성 스타일(한국어). 계획·설계·QA·PR 등 문서 작성 전 항상 읽는다**
- `docs/planning/` — 게임 디자인, 컨셉, 로드맵 (기획 관련 작업 시 참조)
- `docs/design/` — 아트 디렉션, UI/UX (디자인 관련 작업 시 참조)
- `docs/development/sessions/` — 개발 세션 및 의사결정 기록 (맥락 파악 필요 시 참조)
- `docs/decisions/` — ADR (설계 결정 확인 시 참조)
- `docs/qa/` — QA 체크리스트 (구현·검증 단계에서 참조)
- `docs/development/backlog.md` — **개발 백로그. 슬라이스를 가로지르는 차기 TODO의 단일 정본. 구현·테스트 중 떠오른 후속/이월/밸런싱 항목을 여기 한 곳에 모은다(흩뿌리지 않는다)**
- `docs/development/troubleshooting/` — 워크플로우·도구·환경 운영 이슈와 복구 절차 (에러·이상 동작 발생 시 참조)

지식 추가 기준:
- 주요 기술/설계 결정 → `docs/decisions/NNN-title.md` ADR로 작성
- 개발 세션 기록 → `docs/development/sessions/YYYY-MM-DD-topic.md`
- 재발하는 운영/도구 이슈 + 복구 절차 → `docs/development/troubleshooting/<topic>.md` (세션 기록 아님 — 에러 발생 시 찾아보는 레퍼런스)
- 새 기획/디자인 문서 → gstack 스킬로 정리 후 해당 폴더에 저장
- **슬라이스 밖 차기 TODO**(구현·테스트 중 발견한 후속·이월·밸런싱·로버스트니스 항목) → `docs/development/backlog.md`에 추가한다. 각 슬라이스 `*-review-issues.md`·`*-followups.md`에 흩어 두지 말 것 — 그 출처 문서는 시점 기록으로 **보존**하고, 백로그가 **출처 역링크로 집약**한다. 항목이 한 슬라이스 분량으로 커지면 plan 문서로 승격하고 백로그엔 취소선+링크로 남긴다. 운영 규칙·테마 구분은 backlog.md 머리말 참조.

## Workflow


### 워크플로우 상태 ([ADR 004](docs/decisions/004-workflow-state-machine.md))

상태의 단일 진실은 `.claude/workflow-state.json`의 **`phase`** 하나다. 상태 변경은 **반드시 `pnpm wf <command>` CLI로만** 한다. PreToolUse 훅(`gate-scripts.mjs`)이 상태 파일 직접 편집을 차단하고, phase 기준으로 `game/assets/scripts/**/*.ts` 편집을 게이팅한다. (편집 허용 phase: `implementation`, `verification`)

```
planning → qa-setup → implementation → verification → user-verification → pr-ready → done
```

| 명령 | 주체 | 전이 |
|------|------|------|
| `pnpm wf start <feature>` | AI | `feat/<feature>` 브랜치 생성·전환 + 전체 초기화 → `planning` |
| `pnpm wf approve-plan` | 사용자 트리거(`계획 승인`)→AI | `planning` → `qa-setup` (**해당 기능 계획 문서 존재** 확인 후 전환) |
| `pnpm wf skip-test "<사유>"` | AI | 테스트 스킵 (순수 로직 없음, 사유 필수) |
| `pnpm wf ready-impl` | AI | `qa-setup` → `implementation` (문서·테스트 파일 확인 + 스킵 아니면 피처 테스트 **RED** 검증) |
| `pnpm wf start-verification` | AI | `implementation` → `verification` (전체 스위트 **GREEN** 검증 후 전환) |
| `pnpm wf pass <cso\|ts\|lint\|review>` | AI | 개별 검증 통과 (4개 모두 통과 + **QA 확정 게이트** 통과 시 자동 `user-verification`) |
| `pnpm wf invalidate` | AI | `verification` 중 코드 변경 → 전체 검증 초기화 |
| `pnpm wf rework` | 사용자 트리거(`리워크`)→AI | `user-verification` → `implementation` (버그 발견 복귀) |
| `pnpm wf approve-pr` | 사용자 트리거(`PR 승인`)→AI | `user-verification` → `pr-ready` (**에셋 `.meta` 누락 게이트**: 누락 시 차단) |
| `pnpm wf pr-done` | AI | `pr-ready` → `done` |
| `pnpm wf check-meta` | AI/사용자 | 에셋 `.meta` 누락 검사 (전이 없음, 누락 시 종료코드 1) |
| `pnpm wf check-qa` | AI/사용자 | QA 문서 미확정(잠정) 표시 검사 (전이 없음, 남아 있으면 종료코드 1) |
| `pnpm wf status` | — | 현재 상태 + 편집 가능 여부 출력 |

> **사람 게이트 (사용자 트리거 → AI 실행):** 아래 세 전이는 사람의 판단이 필요한 지점이다. 사용자가 자연어로 지시하면 **AI가 해당 커맨드를 대신 실행**한다.
>
> | 사용자 입력 | AI 실행 |
> |------------|--------|
> | `계획 승인` | `pnpm wf approve-plan` |
> | `PR 승인` | `pnpm wf approve-pr` |
> | `리워크` (또는 "버그, 구현 복귀") | `pnpm wf rework` |
>
> 나머지 커맨드(`start`/`skip-test`/`ready-impl`/`start-verification`/`pass`/`invalidate`/`pr-done`)는 AI가 절차에 따라 자동 실행한다.
>
> **머지 가능한 PR은 `PR 승인` 후에만.** `phase: "user-verification"` 진입 시(6단계 완료) AI가 **검토용 Draft PR**을 자동 생성한다 — Draft 상태라 GitHub Merge 버튼이 비활성화되어 실수 머지가 차단된다. Draft 해제(`gh pr ready` → 머지 가능)와 squash merge는 `phase: "pr-ready"`(= `PR 승인` 후)에서만 한다.

---

### 기능 개발

#### 1단계: 계획 (사용자 주도)
0. **브랜치 생성 + 상태 리셋:** `pnpm wf start <feature>` 실행 → `feat/<feature>` 브랜치를 main 기준으로 **생성·전환**(이미 있으면 전환)한 뒤 전체 초기화 + `phase: "planning"`. 이 시점부터 브랜치가 실재하므로 이후 모든 planning 커밋이 그 브랜치에 쌓인다(main 직접 커밋 방지). **계획 문서에 브랜치를 `(예정)`으로 적지 않는다 — 이미 생성됐으므로 `브랜치: feat/<feature>`로 확정 표기.**
0-1. **백로그 확인(필수):** `docs/development/backlog.md`를 열어 이번 슬라이스의 테마/영향 범위에 해당하는 항목이 있는지 본다. 같은 영역의 후속·이월·로버스트니스 항목 중 **이번에 함께 처리하는 게 합리적인 것**을 골라 슬라이스 스코프에 포함하고, 계획 문서에 "이 슬라이스가 닫는 백로그 항목" 목록으로 명시한다. (구현 완료 후 6~9단계에서 해당 항목을 백로그 「승격됨/완료」로 옮긴다.)
1. `/office-hours` — 요구사항 재구성 및 스코프 확인
2. `/autoplan` — CEO+Eng 리뷰 → 사용자 승인
2-1. **계획 문서 작성(필수):** 리뷰 결과를 `docs/development/sessions/<YYYY-MM-DD>-<feature>-plan.md`로 저장한다. 파일명에 `wf start`의 `<feature>` 슬러그가 포함되어야 한다(게이트가 파일명에서 이 슬러그를 찾는다). 내용·형식은 강제하지 않는다.

#### 2단계: 계획 승인 (사용자)
3. 사용자: **`계획 승인`** 입력 → AI가 `pnpm wf approve-plan` 실행 → `phase: "qa-setup"`
   - **게이트:** 해당 기능 관련 계획 문서가 없으면 전이가 **차단**된다(문서 없이 다음 단계 진입 불가). 차단 시 계획 문서를 먼저 작성한 뒤 다시 승인한다.

#### 3단계: QA 문서 + 테스트 코드 (AI 주도)
4. `superpowers:executing-plans` 호출 → `superpowers:test-driven-development` 호출
   - `docs/qa/[feature]-test.md` 작성 (아래 **QA 문서 작성 규칙** 참고)
   - `tests/logic/[Feature].test.ts` 작성 (RED 상태)
   - **테스트 스킵 조건:** 구현할 코드가 전부 Cocos 프레임워크에 의존해 순수 로직 파일이 없으면 테스트 파일 생성을 생략할 수 있다. 단, `pnpm wf skip-test "<사유>"`로 이유를 기록한다. AI가 혼자 판단하며 사용자 확인은 불필요.

#### 4단계: 구현 준비 완료 (AI 자동)
5. `pnpm wf ready-impl` 실행 → `phase: "implementation"`. CLI가 아래를 직접 확인 (통과 못 하면 전이 실패).
   - `docs/qa/[feature]-test.md` 존재 ✅
   - `tests/logic/[Feature].test.ts` 존재 **또는** `test_skipped: true` (이유 기록됨) ✅
   - **RED 게이트:** 스킵이 아니면 CLI가 피처 테스트를 `vitest run`으로 돌려 **실패(RED)인지** 확인한다. 통과해 버리면(= 실패하는 테스트를 먼저 안 쓴 것) 전이가 차단된다. ✅
   - 이 시점부터 `game/assets/scripts/*.ts` 수정 허용 (훅 해제)

#### 5단계: 구현 (AI 주도)
6. 구현 (GREEN → REFACTOR)

#### 6단계: AI 검증 (AI 주도)
7. 구현 종료 → `pnpm wf start-verification` 실행 → `phase: "verification"`. **GREEN 게이트:** CLI가 전체 스위트(`vitest run`)를 돌려 전부 통과해야만 전이한다. 실패가 있으면 차단되고 `implementation`에 머문다(별도 `pnpm test` 수동 실행 불필요).
   - **GREEN 직후 필수:** ① `docs/qa/[feature]-test.md`의 "자동 테스트로 검증" 체크리스트 항목을 `[ ]` → `[x]`로 갱신하고, 통과 근거(피처 테스트 N/N + 전체 스위트 M/M, 통과 커밋 SHA)를 섹션 머리에 기재한다. ② **프리팹/씬·에디터 연결 섹션을 실제 구현된 컴포넌트(`@property` 이름·노드·부모)에 맞춰 확정**하고 qa-setup의 잠정 태그 `(잠정 …)`/`(가칭 …)`을 `(확정)`으로 바꾼다(코드와 어긋나면 코드 기준 — 코드가 정본, QA 문서가 그 거울). **wf 게이트:** 잠정 태그가 남아 있으면 `pass`의 `user-verification` 자동 전이가 차단된다(`pnpm wf check-qa`로 사전 확인). (테스트 코드·프리팹 레시피와 QA 문서가 어긋나지 않도록 — 자주 누락되는 단계)
8. `/cso` 호출 — 보안 체크 (OWASP + STRIDE)
   - 완료 후: `pnpm wf pass cso`
   - 이슈 발견 시: `docs/qa/[feature]-security-issues.md`에 기록 → 즉시 수정 → 해당 항목에 "수정됨" 표시 → **`pnpm wf invalidate`** (전체 검증 초기화) → 8번 재실행 (이후 9→10→11→12까지 순차 재실행)
   - 재실행 시 기존 문서는 유지하고 신규 이슈만 추가. 모든 이슈 "수정됨" 확인 시 `pass cso`
   - **`pass cso` 전 다음 단계 진행 불가**
9. `mcp__ide__getDiagnostics` 호출 → TypeScript Error severity 0건 확인 (있으면 수정)
   - 완료 후: `pnpm wf pass ts`
10. `pnpm check --write` 실행 → lint + format 최종 확인
    - 완료 후: `pnpm wf pass lint`
11. 기능 단위로 커밋 분리 후 순차 커밋 (husky가 staged 파일에 `biome check --write` 자동 실행)
12. `superpowers:requesting-code-review` 패턴으로 별도 subagent dispatch — 코드 리뷰
    - `git rev-parse origin/main` → BASE_SHA, `git rev-parse HEAD` → HEAD_SHA
    - **리뷰 템플릿은 프로젝트 파일이 아니다.** `superpowers:requesting-code-review` 스킬을 invoke하면 스킬에 동봉된 `code-reviewer.md` 템플릿 위치를 알려준다(플러그인 캐시 내, 버전 경로 포함). repo에서 `code-reviewer.md`를 찾지 말 것 — "없음"으로 뜬다. 스킬이 가리키는 템플릿을 Read해 `{DESCRIPTION}`/`{PLAN_OR_REQUIREMENTS}`/`{BASE_SHA}`/`{HEAD_SHA}`를 채운 뒤 Agent tool(`general-purpose` 타입)로 dispatch한다.
    - 모든 이슈 → `docs/qa/[feature]-review-issues.md`에 기록
      - **문서가 이미 존재하면 덮어쓰지 말고 업데이트한다.** 기존 항목은 보존하고, 신규 이슈만 하단에 "재리뷰 (커밋 SHA 또는 차수)" 섹션으로 추가. 이미 "수정됨" 표시된 항목은 그대로 둔다. 상단 "리뷰 커밋"은 최신 SHA로 갱신.
    - **코드 품질·타입 안전성·실제 버그** → 즉시 수정 후 문서에 "수정됨" 표시
      - 수정 발생 시: **`pnpm wf invalidate`** (코드리뷰발 수정도 보안 재검증을 거치도록 cso 포함 전체 초기화) → 8번(/cso)부터 재실행 (9→10→11→12 포함)
      - 추가 수정 없음: `pnpm wf pass review` → 4개 검증 모두 통과 시 자동으로 `phase: "user-verification"`(스크립트 편집 잠금)
    - **게임 정책·설계 관련 지적** → 문서에 기록 후 13번으로 진행. 수정은 사용자 요청 시에만
13. `superpowers:verification-before-completion` 호출

#### 7단계: 사용자 검증 (사용자 주도)
> AI는 이 단계의 검증(에디터·인게임)을 수행하지 않는다. 단, **진입 시점의 Draft PR 생성만 AI가 수행**한다.
>
> **6단계 완료 시 AI가 순서대로 수행:**
> 1. **검토용 Draft PR 생성** — 브랜치를 push한 뒤 `gh pr create --draft`로 PR을 만든다. 본문은 아래 **9단계의 PR 본문 작성 규칙**대로 코드를 상세히 설명하고, assignee로 레포 소유자를 지정한다. **이미 Draft PR이 있으면**(리워크 후 재진입) 새로 만들지 말고 push로 본문·diff만 최신화한다.
>    - **신규 `.meta` 비포함:** Draft PR에는 `.meta`가 1개도 새로 들어가면 안 된다. AI는 `.meta`를 만들지 않으며(에셋 `.meta` 관리 규칙), 작업 중 어떤 경로로든 `.meta`가 생겼다면 push 전에 제외한다. 모든 신규 `.meta`는 7단계 사용자 Cocos 테스트로 생성돼 8단계에서 커밋된다.
> 2. **사용자에게 알림:** "7단계입니다. Draft PR(`<링크>`)의 Files changed와 `docs/qa/[feature]-test.md` 체크리스트를 참고해 에디터 세팅 및 인게임 테스트를 진행해 주세요."

14. Cocos Creator 에디터 세팅 (씬 노드 구성, `@property` 연결 — `docs/qa/` 체크리스트 참고)
15. 수동 인게임 테스트 (QA 체크리스트 수동 항목)
    - **버그 발견 시:** 사용자 **`리워크`** 입력 → AI가 `pnpm wf rework` 실행 → `phase: "implementation"`으로 복귀, 검증 초기화, 스크립트 편집 재허용 → 5단계부터 다시 진행. **Draft PR은 닫지 않는다** — 재구현·재검증 후 7단계 재진입 시 push만 하면 PR이 자동 갱신된다.

#### 8단계: PR 승인 (사용자)
16. 사용자: **`PR 승인`** 입력 → AI는 (1) **7단계 테스트 중 Cocos가 생성한 모든 신규 `.meta`(로직·데이터·씬 자산 포함)를 먼저 커밋·push**하고 (2) `pnpm wf approve-pr` 실행 → `phase: "pr-ready"`
   - **에셋 `.meta` 게이트:** `approve-pr`이 추적되지 않은 `.meta`를 자동 검사해 누락 시 **차단**한다(머지 후 모든 환경에서 UUID 재생성 → 참조 깨짐 방지). 차단되면 누락 `.meta`를 커밋하고 다시 승인. 미리 `pnpm wf check-meta`로 확인 가능. → 아래 **에셋 `.meta` 관리 규칙** 참고

#### 9단계: PR 머지 (AI 주도)
> Draft PR은 7단계 진입 시 이미 생성돼 있다. 이 단계는 **Draft 해제 + 머지**다.
17. **Draft 해제 전:** 관련 세션 문서·플랜 파일을 완료 상태로 업데이트하고, 변경이 있었으면 push해 Draft PR 본문·diff를 최신화한다.
18. `gh pr ready <PR>`로 Draft 해제(머지 가능 전환) → squash merge → `pnpm wf pr-done`

##### PR 본문 작성 규칙 (Draft 생성·갱신·머지 공통)
**사용자가 코드 리뷰를 쉽게 하도록 코드를 상세히 설명한다.** 작성 스타일은 `docs/development/writing-style.md`를 그대로 따른다 — 처음부터 자연스러운 한국어 서술형으로 쓰고, 영어 용어를 한국어 조사에 그대로 붙이지 않는다(풀거나 괄호 병기). 다음을 포함한다.
- **변경 배경/목적** — 무엇을, 왜 바꾸는가.
- **파일·로직 단위 변경 설명** — 핵심 파일마다 "이 파일에서 무엇이 어떻게 바뀌었고 왜 그렇게 했는지"를 서술한다. 신규 로직은 동작 방식(입력 → 처리 → 출력)을 풀어 설명한다. 단순 파일 목록 나열이 아니라 리뷰어가 코드를 열기 전에 맥락을 잡을 수 있을 만큼 구체적으로.
- **리뷰 중점 포인트** — 특히 봐야 할 부분, 트레이드오프, 의도적 결정.
- **테스트·검증 방법** — 자동 테스트 결과(N/N), 수동 검증 항목.

---

### 문서/설계 작업 (코드 없음)
1. `/office-hours` 또는 `/plan-ceo-review` — 방향 검토
2. 결과물 → 해당 `docs/` 하위 폴더에 저장
3. 주요 결정은 `docs/decisions/` ADR로 기록

---

### PR Squash Merge 절차
squash merge 전에 반드시 최종 커밋 메시지(subject + body)를 보여주고 사용자 확인 후 실행한다.

커밋 타입 기준:
- `fix:` — 이미 main에 머지된 코드에 회귀가 생긴 경우
- `feat:` — 피처 브랜치 최초 구현 중 발견·수정한 것은 모두 feat 범위

> **규칙: main에 직접 커밋하지 않는다.**
> 문서 업데이트 포함 모든 변경은 피처 브랜치에서 커밋 후 PR로 병합한다.
> PR 생성 전에 문서가 최신 상태인지 반드시 확인한다.

---


## QA 문서 작성 규칙

3단계(QA 문서 + 테스트 코드 작성) 시점에, 에디터 작업과 수동 테스트가 필요한 모든 정보를 `docs/qa/[feature]-test.md`에 작성한다.

### 반드시 포함해야 하는 항목

| 섹션 | 내용 |
|------|------|
| **Impact Map** | 변경 파일별 확인 범위 (회귀 테스트 기준) |
| **씬/프리팹 변경 사항** | 추가·수정할 노드 목록 (타입, Position, Size, 컴포넌트) |
| **에디터 연결 체크리스트** | `@property` 프로퍼티 ↔ 노드 매핑. ✅/❌ 상태 표시 |
| **수동 테스트 체크리스트** | `[ ]` 항목. 코드로 검증 불가한 인게임 동작만 포함 |

### 작성 기준

- **기존 문서 보완:** 기존 `docs/qa/` 문서의 테스트 항목이 코드 변경으로 인해 더 이상 유효하지 않으면 아래 기준으로 처리한다.
  - **동작이 의도적으로 제거되거나 다른 방식으로 대체된 경우** → 취소선 + 이유 주석으로 남긴다. 형식: `~~기존 항목~~ → **변경됨/의도적 제거**: 이유 (피처명)`. 히스토리가 남아야 이후 구현 시 맥락을 파악할 수 있다.
  - **수치·레이블 등 단순 값 변경** → 항목 내 값을 직접 수정한다.
- **신규 문서 생성:** 새 피처 브랜치마다 별도 문서 생성 (`[feature]-test.md`).
- **에디터 노드 생성 규칙:** Position, Size는 씬 좌표계 기준으로 명시. 의존 노드 계층 순서가 있으면 반드시 명시.
- **프리팹/에디터 잠정 → 확정 (필수, wf 게이트):** qa-setup(구현 전)엔 프리팹/씬·에디터 섹션을 계획 기준으로 쓰되, 미확정 제목/값에 `(잠정 …)`(placeholder 이름은 `(가칭 …)`) 태그를 단다. **구현 완료 후(GREEN 직후) 실제 구현된 컴포넌트(`@property`·노드·부모)에 맞춰 확정**하고 그 태그를 `(확정)`으로 바꾼다 — 코드가 정본이고 QA 문서가 그 거울이다. `pnpm wf check-qa`와 `pass`의 자동 전이 게이트가 feature QA 문서에 잠정 태그가 남아 있으면 `user-verification` 진입을 차단한다(stale 레시피가 7단계 사용자 테스트로 새는 것 방지).
- **체크리스트 항목 작성 기준:** 사용자가 에디터를 열지 않아도 항목만 보고 무엇을 해야 하는지 알 수 있을 만큼 구체적으로 작성.
- **브랜치 표기 규칙:** QA 문서 상단의 브랜치 표기는 본문 작성 당시 브랜치를 보존한다. 후속 피처가 같은 문서를 이어 쓸 때는 덮어쓰지 말고 `원본 브랜치 / 추가 브랜치 (변경 범위)` 형식으로 병기한다. 예: `feat/walking-skeleton / feat/xp-system (xpDrop 추가)`.

---

## Cocos Creator 구현 규칙

Cocos Creator 관련 코드/문서 작성 전 반드시 Context7로 공식 문서를 먼저 조회한다. 훈련 데이터 기반으로 추측하지 않는다.

```
// 사용 예시
mcp__context7__resolve-library-id: "cocos creator 3.8"
mcp__context7__get-library-docs: "/websites/cocos_creator_3_8_manual_en" topic="Canvas hierarchy"
```

확인이 필요한 주제 예시: Canvas 계층 구조, 컴포넌트 생성 방법, SpriteFrame 경로, 좌표계, 레이어 설정.

### 에셋 `.meta` 관리 규칙

Cocos는 `game/assets/` 아래 **모든 파일·디렉터리에 `.meta`(UUID 보관)** 를 만든다. 엔진은 자산을 경로가 아니라 UUID로 참조하고, **씬/프리팹은 참조 대상의 UUID를 저장**한다. `.meta`가 커밋되지 않으면 클론·타 환경에서 UUID가 재생성돼 **씬/프리팹 참조가 깨진다**(공식 매뉴얼: ".meta should be included in version control"). 그래서 `.gitignore`도 `*.meta` 추적을 강제한다.

**핵심 원칙: `.meta`는 Cocos 에디터만 생성한다. AI는 `.meta`를 절대 직접 만들지 않는다.**
- `.meta`는 Cocos가 자산을 임포트할 때 **동적으로 생성하는 산출물**이다. AI가 포맷만 맞춰 손으로 만들면 최종 Cocos가 생성하는 것과 내용이 달라질 수 있다(특히 구현이 바뀌면 작업 중 임시 `.meta`와 최종본이 불일치). **최종 사용 주체인 Cocos가 만든 것이 유일한 진실**이다.
- 따라서 순수 로직 `.ts`·`resources/*.json`을 포함한 **모든 `.meta`는 사용자가 7단계에서 Cocos로 최종 테스트할 때 생성**되고, **8단계 `PR 승인` 시점에 일괄 커밋**한다. (테스트·빌드는 `.meta`가 없어도 동작 — vitest/tsc는 경로로 import한다.)

**누가 언제:**

| 시점 | `.meta` 처리 |
|------|--------------|
| AI 구현 중 (5~6단계) | AI는 신규 `.ts`/`.json`만 만들고 **`.meta`는 만들지 않는다.** |
| 7단계 진입 Draft PR | **신규 `.meta` 0개.** AI가 만든 것도, 작업 중 테스트로 생긴 것도 **비포함**한다. |
| 7단계 사용자 테스트 | 사용자가 Cocos 에디터로 인게임 테스트 → Cocos가 신규 자산의 `.meta`를 모두 생성 |
| 8단계 `PR 승인` | Cocos가 생성한 **모든 신규 `.meta`를 먼저 커밋·push**한 뒤 `pnpm wf approve-pr` |

**게이트:** `pnpm wf approve-pr`이 추적되지 않은 `.meta`를 자동 검사해 **누락 시 PR 승인을 차단**한다(8단계에서 Cocos가 만든 `.meta`가 모두 커밋됐는지 확인하는 마지막 안전장치). 언제든 `pnpm wf check-meta`로 확인. 구현은 `.claude/workflow.mjs`의 `listMissingAssetMeta()`.

> **규칙: AI는 `.meta`를 직접 생성·커밋하지 않는다.** 모든 `.meta`는 Cocos 에디터가 생성하며, 사용자의 최종 테스트(7단계)를 거쳐 `PR 승인`(8단계) 시점에 커밋한다.

## 도구 스택

### gstack
제품 워크플로우 (기획 리뷰, 설계 검토, QA, 보안, 배포).
기획→구현→리뷰→배포 전 단계에서 사용.

### superpowers
구현 방법론 (TDD, bite-sized 태스크, subagent+worktree 병렬 개발).
**코드 작성 시작 시점에 활성화.**
설치 방법: `docs/development/environment-setup.md` § 3 참고 (설치 후 Claude Code 재시작 필수).

### Context7 MCP
Cocos Creator 공식 문서를 실시간 조회. 설치 방법: `docs/development/environment-setup.md` 참고.

## gstack 사용 규칙

웹 브라우징은 항상 gstack의 `/browse` 사용. `mcp__claude-in-chrome__*` 도구는 사용 금지.

## Skill routing

스킬 전체 목록은 세션 시작 시 자동 로드된다. 이름만으로 용도가 분명하지 않은 스킬은 아래 매핑을 참고한다.

- 제품 아이디어/브레인스토밍 → `/office-hours`
- 전략/스코프 결정 → `/plan-ceo-review`
- 아키텍처 설계 → `/plan-eng-review`
- 디자인 리뷰 → `/design-consultation` 또는 `/plan-design-review`
- 전체 리뷰 파이프라인 → `/autoplan`
- 버그/에러 디버깅 → `/investigate`
- 보안 점검 (OWASP + STRIDE) → `/cso`
- UI 개선 (코드 리뷰 아님) → `/design-review`
- 복잡한 기능 분해 → `superpowers:brainstorming`
- 병렬 구현 (worktree) → `superpowers:dispatching-parallel-agents`

→ 기능 개발 절차는 Workflow 섹션 참고
