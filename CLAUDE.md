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


### 워크플로우 상태 명령어

AI는 아래 명령어를 받으면 `.claude/workflow-state.json`을 즉시 업데이트한다.

| 사용자 입력 | AI 동작 | 상태 변화 |
|------------|--------|----------|
| `계획 승인` | plan_approved → true | phase: "qa-setup" |
| `커밋 승인` | commit_approved → true | phase: "commit_approved" |

**커밋 승인 없이 커밋 불가.** `commit_approved: true` 상태에서만 커밋을 진행한다.

---

### 기능 개발

#### 1단계: 계획 (사용자 주도)
1. `/office-hours` — 요구사항 재구성 및 스코프 확인
2. `/autoplan` — CEO+Eng 리뷰 → 사용자 승인

#### 2단계: 계획 승인 (사용자)
3. 사용자: **`계획 승인`** → AI가 workflow-state.json 업데이트

#### 3단계: QA 문서 + 테스트 코드 (AI 주도)
4. `superpowers:executing-plans` 호출 → `superpowers:test-driven-development` 호출
   - `docs/qa/[feature]-test.md` 작성 (아래 **QA 문서 작성 규칙** 참고)
   - `tests/logic/[Feature].test.ts` 작성 (RED 상태)
   - **테스트 스킵 조건:** 구현할 코드가 전부 Cocos 프레임워크에 의존해 순수 로직 파일이 없으면 테스트 파일 생성을 생략할 수 있다. 단, 반드시 이유를 명시하고 `workflow-state.json`의 `test_skipped: true`, `test_skip_reason`에 기록한다. AI가 혼자 판단하며 사용자 확인은 불필요.

#### 4단계: 구현 준비 완료 (AI 자동)
5. AI가 아래 조건을 직접 확인 후 통과 시 workflow-state.json 업데이트 → `qa_doc_ready: true`, phase: "implementation"
   - `docs/qa/[feature]-test.md` 존재 ✅
   - `tests/logic/[Feature].test.ts` 존재 **또는** `test_skipped: true` (이유 기록됨) ✅
   - 이 시점부터 `game/assets/scripts/*.ts` 수정 허용 (훅 해제)

#### 5단계: 구현 (AI 주도)
6. 구현 (GREEN → REFACTOR)

#### 6단계: AI 검증 (AI 주도)
7. `pnpm test` 실행 → 전체 통과 확인
8. `/cso` 호출 — 보안 체크 (OWASP + STRIDE), 이슈 발견 시 수정 후 재실행
9. `/review` 실행 — 코드 리뷰
10. `superpowers:verification-before-completion` 호출

#### 7단계: 사용자 검증 (사용자 주도)
> AI는 이 단계를 수행하지 않는다.

11. Cocos Creator 에디터 세팅 (씬 노드 구성, `@property` 연결 — `docs/qa/` 체크리스트 참고)
12. 수동 인게임 테스트 (QA 체크리스트 수동 항목)

#### 8단계: 커밋 승인 (사용자)
13. 사용자: **`커밋 승인`** → AI가 workflow-state.json 업데이트

#### 9단계: 커밋 (AI 주도)
14. `pnpm check --write` 실행 (전체 lint + format 확인)
15. 기능 단위로 커밋 분리 후 순차 커밋
    - 각 커밋 시 husky가 staged 파일에 `biome check --write` 자동 실행
    - 커밋이 막히면 auto-fix 미해결 에러 존재 → `pnpm check`로 확인 후 수동 수정
16. **PR 생성 전:** 관련 세션 문서·플랜 파일 완료 상태로 업데이트
17. PR 생성 → squash merge

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

## gstack

Use the /browse skill from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

### Available Skills

- `/office-hours` - Product interrogation with forcing questions
- `/plan-ceo-review` - Strategic challenge and scope review
- `/plan-eng-review` - Engineering architecture review
- `/plan-design-review` - Design and UX review
- `/design-consultation` - Design consultation
- `/design-shotgun` - Rapid design iterations
- `/design-html` - HTML/CSS design work
- `/review` - Code review
- `/ship` - Ship the PR
- `/land-and-deploy` - Land and deploy
- `/canary` - Canary deployment
- `/benchmark` - Performance benchmarking
- `/browse` - Web browsing
- `/connect-chrome` - Connect to Chrome browser
- `/qa` - QA testing on staging URL
- `/qa-only` - QA testing only
- `/design-review` - Design review
- `/setup-browser-cookies` - Setup browser cookies
- `/setup-deploy` - Setup deployment
- `/setup-gbrain` - Setup GBrain
- `/retro` - Engineering retrospective
- `/investigate` - Root cause debugging
- `/document-release` - Document release notes
- `/codex` - Codex integration
- `/cso` - Security audit (OWASP + STRIDE)
- `/autoplan` - Automated planning
- `/plan-devex-review` - Developer experience review
- `/devex-review` - DevEx review
- `/careful` - Careful mode
- `/freeze` - Freeze changes
- `/guard` - Guard mode
- `/unfreeze` - Unfreeze changes
- `/gstack-upgrade` - Upgrade gstack
- `/learn` - Learn from documentation

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- 제품 아이디어/브레인스토밍 → invoke /office-hours
- 전략/스코프 결정 → invoke /plan-ceo-review
- 아키텍처 설계 → invoke /plan-eng-review
- 디자인 리뷰 → invoke /design-consultation or /plan-design-review
- 전체 리뷰 파이프라인 → invoke /autoplan
- 버그/에러 디버깅 → invoke /investigate
- QA/사이트 동작 테스트 → invoke /qa or /qa-only
- 코드 리뷰 → invoke /review
- UI 개선 → invoke /design-review
- PR 생성/배포 → invoke /ship or /land-and-deploy
- 진행 상황 저장 → invoke /context-save
- 컨텍스트 복원 → invoke /context-restore

**superpowers 추가 라우팅:**
- 복잡한 기능 분해 → invoke superpowers:brainstorming
- 병렬 구현 (여러 worktree) → invoke superpowers:dispatching-parallel-agents

→ 기능 개발 절차는 Workflow 섹션 참고
