# gstack 사용 가이드

이 문서는 프로젝트에서 gstack을 사용하는 방법에 대한 가이드입니다.

## gstack이란?

gstack은 Claude Code를 가상 엔지니어링 팀으로 변환하는 오픈소스 도구입니다. 23개의 전문 AI 역할(CEO, 디자이너, 엔지니어 매니저, QA 리드, 릴리즈 엔지니어 등)을 슬래시 커맨드로 제공합니다.

- 공식 저장소: https://github.com/garrytan/gstack

## 설치 확인

이 프로젝트는 이미 gstack이 설치되어 있습니다:
- gstack 위치: `~/.claude/skills/gstack`
- 팀 모드 활성화됨 (자동 업데이트 지원)

## 주요 커맨드

### 제품 기획 및 전략

#### `/office-hours`
제품 아이디어를 검토하고 6가지 핵심 질문으로 문제를 파고듭니다.

**사용 예시:**
```
User: /office-hours
User: 게임 내 아이템 드랍 시스템을 개선하고 싶어요.
```

**결과:**
- 구체적인 문제 파악을 위한 질문
- 가정에 대한 도전
- 구현 접근 방식 제안

#### `/plan-ceo-review`
전략적 관점에서 기능 계획을 검토하고 범위를 조정합니다.

**사용 시기:** 새로운 기능을 구현하기 전

#### `/plan-eng-review`
엔지니어링 아키텍처 관점에서 계획을 검토합니다.

#### `/plan-design-review`
디자인과 UX 관점에서 계획을 검토합니다.

### 자동 계획 생성

#### `/autoplan`
현재 작업에 대한 전체적인 계획을 자동으로 생성합니다.

**사용 예시:**
```
User: /autoplan
User: 챕터 전환 시스템을 구현하고 싶습니다.
```

**결과:**
- Think → Plan → Build → Review → Test → Ship 단계별 계획
- 구현 단계별 상세 설명

### 코드 리뷰 및 품질 관리

#### `/review`
현재 브랜치의 코드 변경사항을 검토합니다.

**사용 시기:** 코드 작성 후, 커밋 전

**검토 항목:**
- 코드 품질
- 보안 취약점
- 성능 문제
- 베스트 프랙티스

#### `/cso` (Chief Security Officer)
OWASP 및 STRIDE 기준으로 보안 감사를 수행합니다.

**사용 예시:**
```
User: /cso
```

**결과:**
- 보안 취약점 분석
- 위험도 평가
- 수정 권장사항

### QA 및 테스팅

#### `/qa <URL>`
스테이징 URL에서 실제 브라우저를 열고 QA 테스트를 수행합니다.

**사용 예시:**
```
User: /qa http://localhost:8080
```

**결과:**
- 브라우저 자동 조작
- UI/UX 문제 발견
- 기능 테스트 수행

#### `/qa-only`
QA 테스트만 수행합니다.

### 배포 및 릴리즈

#### `/ship`
PR을 생성하고 배포 준비를 합니다.

**수행 작업:**
1. 코드 리뷰
2. 테스트 실행
3. 릴리즈 노트 작성
4. PR 생성

#### `/land-and-deploy`
PR을 머지하고 배포합니다.

#### `/document-release`
릴리즈 노트를 작성합니다.

### 디자인 및 UI

#### `/design-consultation`
디자인 컨설팅을 받습니다.

#### `/design-review`
디자인 검토를 수행합니다.

#### `/design-html`
HTML/CSS 디자인 작업을 수행합니다.

### 브라우징 및 조사

#### `/browse <URL>`
웹 페이지를 브라우징하고 정보를 추출합니다.

**사용 예시:**
```
User: /browse https://docs.cocos.com/creator/manual/en/
User: Cocos Creator의 씬 로딩 방법에 대해 알려줘
```

#### `/learn`
문서를 학습하고 이해합니다.

### 디버깅 및 조사

#### `/investigate`
근본 원인을 디버깅하는 방법론을 따릅니다.

**사용 예시:**
```
User: /investigate
User: 게임이 특정 씬에서 크래시가 발생해요.
```

**결과:**
- 문제 재현 단계
- 로그 분석
- 원인 추정
- 해결 방법 제안

### 회고 및 개선

#### `/retro`
주간 엔지니어링 회고를 수행합니다.

**사용 시기:** 주간 단위로 정기적으로

### 유틸리티

#### `/freeze`
변경사항을 잠급니다.

#### `/unfreeze`
잠금을 해제합니다.

#### `/gstack-upgrade`
gstack을 최신 버전으로 업그레이드합니다.

## superpowers 설치

superpowers는 TDD, 태스크 분해, subagent 병렬 개발 등 구현 방법론을 제공하는 Claude Code 플러그인입니다.  
gstack이 기획/리뷰/배포를 담당하고, superpowers는 코드 작성 시점에 활성화됩니다.

### Claude Code (Mac / Windows 공통)

Claude Code 내에서 다음 명령을 실행합니다 (OS 무관, Claude Code 명령어):

```
/plugin install superpowers@claude-plugins-official
```

또는 Superpowers 마켓플레이스를 통해:

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

### 설치 확인

설치 후 다음 스킬이 사용 가능하면 정상:

```
superpowers:test-driven-development
superpowers:executing-plans
superpowers:brainstorming
```

### 주요 스킬

| 스킬 | 사용 시점 |
|------|-----------|
| `superpowers:test-driven-development` | 코드 작성 시 TDD 강제 (RED-GREEN-REFACTOR) |
| `superpowers:executing-plans` | 계획 승인 후 태스크 단위 실행 |
| `superpowers:brainstorming` | 복잡한 기능 분해 |
| `superpowers:dispatching-parallel-agents` | 여러 worktree 병렬 구현 |
| `superpowers:verification-before-completion` | 브랜치 완료 전 검증 |

---

## plan-and-build 스킬

gstack + superpowers를 체이닝하는 커스텀 스킬입니다.  
`/autoplan` → superpowers 구현 → `/review` + `/ship` 제안을 하나의 워크플로우로 연결합니다.

**스킬 파일 및 설치 방법:** [docs/etc/skill/GUIDE.md](./skill/GUIDE.md)

**언제 사용하나요:**
- 기능 개발 전체 사이클 (기획부터 구현까지 한 번에)
- superpowers TDD를 빠뜨리지 않고 확실히 사용하고 싶을 때

---

## 일반적인 워크플로우

### 1. 새로운 기능 개발 시

```
1. /office-hours      - 아이디어 검토
2. /plan-and-build    - autoplan → superpowers TDD 구현 → review/ship 체이닝
   (또는 단계 분리)
   2a. /autoplan      - 상세 구현 계획
   2b. [승인 후] superpowers:executing-plans + superpowers:test-driven-development
   2c. /review        - 코드 리뷰
   2d. /ship          - PR 생성 및 배포
```

### 2. 버그 수정 시

```
1. /investigate - 문제 원인 조사
2. [코드 수정]
3. /review - 코드 리뷰
4. /ship - PR 생성
```

### 3. 보안 점검 시

```
1. /cso - 보안 감사
2. [취약점 수정]
3. /review - 수정 사항 검토
```

### 4. 디자인 작업 시

```
1. /design-consultation - 디자인 컨설팅
2. [디자인 작업]
3. /design-review - 디자인 검토
```

## 팁과 베스트 프랙티스

### 1. 단계별로 진행하기
각 커맨드는 특정 목적을 가지고 있습니다. 단계를 건너뛰지 말고 순차적으로 진행하세요.

### 2. 피드백 활용하기
각 커맨드의 결과를 신중히 검토하고 제안사항을 적용하세요.

### 3. 문서화 습관
`/document-release`를 통해 변경사항을 문서화하는 습관을 들이세요.

### 4. 정기적인 회고
`/retro`를 주간 단위로 실행하여 개발 프로세스를 개선하세요.

### 5. 보안 우선
중요한 기능 추가 후에는 반드시 `/cso`로 보안 점검을 수행하세요.

## 자주 묻는 질문

### Q: 커맨드가 작동하지 않아요
A: 다음을 확인하세요:
- gstack이 제대로 설치되었는지 확인 (`~/.claude/skills/gstack` 존재 여부)
- CLAUDE.md 파일에 gstack 섹션이 있는지 확인
- Claude Code를 재시작해보세요

### Q: 팀원들은 어떻게 설치하나요?
A: 팀원들은 다음 명령어를 실행하면 됩니다:
```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

### Q: gstack을 업데이트하려면?
A: `/gstack-upgrade` 커맨드를 실행하세요.

## 추가 리소스

- [gstack 공식 문서](https://github.com/garrytan/gstack)
- [gstack README](https://github.com/garrytan/gstack/blob/main/README.md)
- [브라우저 기능 가이드](https://github.com/garrytan/gstack/blob/main/BROWSER.md)

## 문제 해결

문제가 발생하면:
1. gstack GitHub Issues 확인: https://github.com/garrytan/gstack/issues
2. 로컬 설치 확인: `ls -la ~/.claude/skills/gstack`
3. 설정 파일 확인: `.claude/settings.json`, `CLAUDE.md`

---

**Happy coding with gstack!**
