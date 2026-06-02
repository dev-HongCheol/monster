# Project Guidelines

## 프로젝트 문서 구조

모든 프로젝트 문서는 `docs/` 아래에 있다. 새 문서는 반드시 이 구조 안에 저장한다.

```
docs/
├── planning/               # 기획 (게임 디자인, 컨셉, 로드맵)
├── design/                 # 디자인 (아트 디렉션, UI/UX, 에셋 파이프라인)
├── development/            # 개발 (아키텍처, 환경 설정)
│   └── sessions/           # 개발 세션/의사결정 기록 (날짜-주제.md)
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
- `docs/planning/` — 게임 디자인, 컨셉, 로드맵 (기획 관련 작업 시 참조)
- `docs/design/` — 아트 디렉션, UI/UX (디자인 관련 작업 시 참조)
- `docs/development/sessions/` — 개발 세션 및 의사결정 기록 (맥락 파악 필요 시 참조)
- `docs/decisions/` — ADR (설계 결정 확인 시 참조)
- `docs/qa/` — QA 체크리스트 (구현·검증 단계에서 참조)

지식 추가 기준:
- 주요 기술/설계 결정 → `docs/decisions/NNN-title.md` ADR로 작성
- 개발 세션 기록 → `docs/development/sessions/YYYY-MM-DD-topic.md`
- 새 기획/디자인 문서 → gstack 스킬로 정리 후 해당 폴더에 저장

## Workflow


### 워크플로우 상태 ([ADR 004](docs/decisions/004-workflow-state-machine.md))

상태의 단일 진실은 `.claude/workflow-state.json`의 **`phase`** 하나다. 상태 변경은 **반드시 `pnpm wf <command>` CLI로만** 한다. PreToolUse 훅(`gate-scripts.mjs`)이 상태 파일 직접 편집을 차단하고, phase 기준으로 `game/assets/scripts/**/*.ts` 편집을 게이팅한다. (편집 허용 phase: `implementation`, `verification`)

```
planning → qa-setup → implementation → verification → user-verification → pr-ready → done
```

| 명령 | 주체 | 전이 |
|------|------|------|
| `pnpm wf start <feature>` | AI | 전체 초기화 → `planning` |
| `pnpm wf approve-plan` | 사용자 트리거(`계획 승인`)→AI | `planning` → `qa-setup` |
| `pnpm wf skip-test "<사유>"` | AI | 테스트 스킵 (순수 로직 없음, 사유 필수) |
| `pnpm wf ready-impl` | AI | `qa-setup` → `implementation` (문서·테스트 파일 확인 + 스킵 아니면 피처 테스트 **RED** 검증) |
| `pnpm wf start-verification` | AI | `implementation` → `verification` (전체 스위트 **GREEN** 검증 후 전환) |
| `pnpm wf pass <cso\|ts\|lint\|review>` | AI | 개별 검증 통과 (4개 모두 통과 시 자동 `user-verification`) |
| `pnpm wf invalidate` | AI | `verification` 중 코드 변경 → 전체 검증 초기화 |
| `pnpm wf rework` | 사용자 트리거(`리워크`)→AI | `user-verification` → `implementation` (버그 발견 복귀) |
| `pnpm wf approve-pr` | 사용자 트리거(`PR 승인`)→AI | `user-verification` → `pr-ready` |
| `pnpm wf pr-done` | AI | `pr-ready` → `done` |
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
> **PR 승인 없이 PR 생성 불가.** `phase: "pr-ready"` 상태에서만 PR을 생성한다.

---

### 기능 개발

#### 1단계: 계획 (사용자 주도)
0. **워크플로우 상태 리셋:** `pnpm wf start <feature>` 실행 → 전체 초기화 + `phase: "planning"`.
1. `/office-hours` — 요구사항 재구성 및 스코프 확인
2. `/autoplan` — CEO+Eng 리뷰 → 사용자 승인

#### 2단계: 계획 승인 (사용자)
3. 사용자: **`계획 승인`** 입력 → AI가 `pnpm wf approve-plan` 실행 → `phase: "qa-setup"`

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
   - **GREEN 직후 필수:** `docs/qa/[feature]-test.md`의 "자동 테스트로 검증" 체크리스트 항목을 `[ ]` → `[x]`로 갱신하고, 통과 근거(피처 테스트 N/N + 전체 스위트 M/M, 통과 커밋 SHA)를 섹션 머리에 기재한다. (테스트 코드와 QA 문서가 어긋나지 않도록 — 자주 누락되는 단계)
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
    - Agent tool (`general-purpose` 타입)으로 `code-reviewer.md` 템플릿 사용해 dispatch
    - 모든 이슈 → `docs/qa/[feature]-review-issues.md`에 기록
      - **문서가 이미 존재하면 덮어쓰지 말고 업데이트한다.** 기존 항목은 보존하고, 신규 이슈만 하단에 "재리뷰 (커밋 SHA 또는 차수)" 섹션으로 추가. 이미 "수정됨" 표시된 항목은 그대로 둔다. 상단 "리뷰 커밋"은 최신 SHA로 갱신.
    - **코드 품질·타입 안전성·실제 버그** → 즉시 수정 후 문서에 "수정됨" 표시
      - 수정 발생 시: **`pnpm wf invalidate`** (코드리뷰발 수정도 보안 재검증을 거치도록 cso 포함 전체 초기화) → 8번(/cso)부터 재실행 (9→10→11→12 포함)
      - 추가 수정 없음: `pnpm wf pass review` → 4개 검증 모두 통과 시 자동으로 `phase: "user-verification"`(스크립트 편집 잠금)
    - **게임 정책·설계 관련 지적** → 문서에 기록 후 13번으로 진행. 수정은 사용자 요청 시에만
13. `superpowers:verification-before-completion` 호출

#### 7단계: 사용자 검증 (사용자 주도)
> AI는 이 단계를 수행하지 않는다.
> **6단계 완료 시 AI가 사용자에게 알림:** "7단계입니다. `docs/qa/[feature]-test.md` 체크리스트를 참고해 에디터 세팅 및 인게임 테스트를 진행해 주세요."

14. Cocos Creator 에디터 세팅 (씬 노드 구성, `@property` 연결 — `docs/qa/` 체크리스트 참고)
15. 수동 인게임 테스트 (QA 체크리스트 수동 항목)
    - **버그 발견 시:** 사용자 **`리워크`** 입력 → AI가 `pnpm wf rework` 실행 → `phase: "implementation"`으로 복귀, 검증 초기화, 스크립트 편집 재허용 → 5단계부터 다시 진행

#### 8단계: PR 승인 (사용자)
16. 사용자: **`PR 승인`** 입력 → AI가 `pnpm wf approve-pr` 실행 → `phase: "pr-ready"`

#### 9단계: PR (AI 주도)
17. **PR 생성 전:** 관련 세션 문서·플랜 파일 완료 상태로 업데이트
18. PR 생성 → squash merge → `pnpm wf pr-done`
    - **PR 본문은 사용자가 코드 리뷰를 쉽게 할 수 있도록 자세히 작성한다.** 변경 배경/목적, 주요 변경 사항(파일·로직 단위), 리뷰 시 중점적으로 봐야 할 부분, 테스트·검증 방법을 포함한다.

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
