# Project Guidelines

## 프로젝트 문서 구조

모든 프로젝트 문서는 `docs/` 아래에 있다. 새 문서는 반드시 이 구조 안에 저장한다.
외부 경로(`~/.gstack/` 등)에 저장하지 않는다.

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

### 미정리 초안 (참고용)

- [게임 기획서](docs/etc/plan.md)
- [아트 디렉션](docs/etc/design.md)
- [개발 체크리스트](docs/etc/checklist.md)

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

### 루프 방지
같은 파일을 5번 이상 수정해도 진전 없으면 → STOP하고 방향 재확인 요청

## Knowledge Base

작업 전 먼저 확인할 위치:
- `docs/development/conventions.md` — **코드 컨벤션 (코드 작성 전 필수 확인)**
- `docs/planning/` — 게임 디자인, 컨셉, 로드맵
- `docs/design/` — 아트 디렉션, UI/UX, 에셋 파이프라인
- `docs/development/sessions/` — 개발 세션 및 의사결정 기록
- `docs/decisions/` — Architecture Decision Records (ADR)
- `docs/qa/` — QA 체크리스트, 버그 리포트

지식 추가 기준:
- 주요 기술/설계 결정 → `docs/decisions/NNN-title.md` ADR로 작성
- 개발 세션 기록 → `docs/development/sessions/YYYY-MM-DD-topic.md`
- 새 기획/디자인 문서 → gstack 스킬로 정리 후 해당 폴더에 저장

## Workflow

### 기능 개발
1. `/office-hours` — 요구사항 재구성 및 스코프 확인
2. `/plan-and-build` — autoplan(CEO+Eng 리뷰) → 승인 후 superpowers TDD 구현 → /review + /ship 제안
   - 또는 단계 분리: `/autoplan` → 승인 후 `superpowers:executing-plans` + `superpowers:test-driven-development`
3. **PR 생성 전 (피처 브랜치에서):** 관련 세션 문서·플랜 파일 완료 상태로 업데이트 후 커밋
4. PR 생성 → squash merge

### PR Squash Merge 절차
squash merge 전에 반드시 최종 커밋 메시지(subject + body)를 보여주고 사용자 확인 후 실행한다.

커밋 타입 기준:
- `fix:` — 이미 main에 머지된 코드에 회귀가 생긴 경우
- `feat:` — 피처 브랜치 최초 구현 중 발견·수정한 것은 모두 feat 범위

> **규칙: main에 직접 커밋하지 않는다.**
> 문서 업데이트 포함 모든 변경은 피처 브랜치에서 커밋 후 PR로 병합한다.
> PR 생성 전에 문서가 최신 상태인지 반드시 확인한다.

### 문서/설계 작업
1. `/office-hours` 또는 `/plan-ceo-review` — 방향 검토
2. 결과물 → 해당 `docs/` 하위 폴더에 저장
3. 주요 결정은 `docs/decisions/` ADR로 기록

### 커밋 전 lint
husky pre-commit 훅이 staged 파일에 `biome check --write`를 자동 실행한다.
커밋이 막히면 auto-fix로 해결되지 않는 lint 에러가 남아있는 것이므로 `pnpm check`로 에러를 확인하고 수동 수정 후 재커밋한다.

```bash
pnpm check          # 에러 확인
pnpm check --write  # auto-fix 적용
```

### 보안/품질 점검
- 새 코드 작성 후 → `/cso` 보안 체크
- 배포 전 → `/review` + `/qa`

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
gstack과 역할이 달라 충돌 없이 병행 가능 — 실제 병행 효과는 첫 코딩 세션에서 평가.

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
- 기획→구현→리뷰 전체 사이클 → invoke /plan-and-build
- 버그/에러 디버깅 → invoke /investigate
- QA/사이트 동작 테스트 → invoke /qa or /qa-only
- 코드 리뷰 → invoke /review
- UI 개선 → invoke /design-review
- PR 생성/배포 → invoke /ship or /land-and-deploy
- 진행 상황 저장 → invoke /context-save
- 컨텍스트 복원 → invoke /context-restore

**코드 작성 시작 시점에는 superpowers 방법론을 함께 활성화:**
- TDD로 구현 → invoke superpowers:test-driven-development
- 복잡한 기능 분해 → invoke superpowers:brainstorming
- 병렬 구현 (여러 worktree) → invoke superpowers:dispatching-parallel-agents
- 구현 계획 실행 → invoke superpowers:executing-plans
- 브랜치 완료 전 검증 → invoke superpowers:verification-before-completion
