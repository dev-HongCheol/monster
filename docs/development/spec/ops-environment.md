# 개발 환경 설정 가이드

> 새 장비에 뭘 까나

- **최초 작성:** 2026-05-21
- **상태:** CONFIRMED
- **이력:** 2026-08-13 — `spec/`으로 이전(`environment-setup.md` → `ops-environment.md`)

---

새 장비에서 이 프로젝트를 시작할 때 필요한 도구를 설치 순서대로 적는다.

---

## 설치 순서 요약

```
1. Claude Code 설치
2. gstack 설치
3. superpowers 플러그인 활성화
4. Context7 MCP → ~/.claude.json에 추가
5. Claude Code 재시작
6. (선택) gbrain → 레포 의미 검색. 별도 문서 참고
```

---

## 1. Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

---

## 2. gstack

Claude Code의 제품 워크플로우 스킬 모음 (기획 리뷰, QA, 보안, 배포 등).

```bash
mkdir -p ~/.claude/skills
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

> `--team` 옵션은 Claude Code 세션 시작 시 gstack을 자동 업데이트하는 훅을 `~/.claude/settings.json`에 등록한다. 단독 작업이라 자동 업데이트가 불필요하면 `./setup`만 실행.
>
> 사전 요구사항: `bun` (`npm i -g bun`), Git Bash 또는 WSL bash. PowerShell에서는 `./setup` 직접 실행이 안 되므로 Git Bash로 실행한다.

설치 확인: Claude Code 재시작 후 `/browse`, `/office-hours` 등 gstack 스킬이 노출되는지 확인.

---

## 3. superpowers

구현 방법론 플러그인 (TDD, 병렬 worktree 개발 등).

### Windows 설치 (확인됨: Windows 11, Git Bash)

터미널에서:
```bash
claude plugin marketplace add obra/superpowers-marketplace
claude plugin install superpowers@superpowers-marketplace
```

**중요: 설치 후 Claude Code 재시작 필수**

### 설치 확인

Claude Code 재시작 후, 다음 스킬이 사용 가능하면 정상:

| 스킬 | 사용 시점 |
|------|-----------|
| `superpowers:test-driven-development` | 코드 작성 시 TDD (RED-GREEN-REFACTOR) |
| `superpowers:executing-plans` | 계획 승인 후 태스크 단위 실행 |
| `superpowers:brainstorming` | 복잡한 기능 분해 |
| `superpowers:dispatching-parallel-agents` | 여러 worktree 병렬 구현 |
| `superpowers:verification-before-completion` | 브랜치 완료 전 검증 |

---

## 4. Context7 MCP

Cocos Creator 공식 문서를 실시간 조회하는 MCP 서버. **Cocos 관련 작업 시 AI가 훈련 데이터 대신 공식 문서를 참조하게 한다.**

### 설치

`~/.claude.json`의 `mcpServers`에 추가:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

`~/.claude.json`에 `mcpServers` 키가 없으면 새로 추가, 있으면 merge.

### 가격

- Free: 월 1,000 API 호출 (개인 프로젝트 수준으로 충분)
- 회원가입 불필요, npx로 바로 실행

### 사용되는 Cocos 문서 소스

| ID | 내용 |
|----|------|
| `/websites/cocos_creator_3_8_manual_en` | Cocos Creator 3.8 공식 영문 매뉴얼 (trustScore 9.9) |
| `/cocos/cocos-engine` | Cocos Engine v3.8.8 소스 |

### 설치 확인

Claude Code 재시작 후 대화에서:
```
context7로 cocos canvas hierarchy 조회해줘
```

---

## 5. 프로젝트 설정 파일

### ~/.claude/settings.json (글로벌)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/<username>/.claude/skills/gstack/bin/gstack-session-update"
          }
        ]
      }
    ]
  },
  "alwaysThinkingEnabled": true,
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true
  }
}
```

`<username>` 부분을 실제 사용자명으로 변경.

### .claude/settings.json (프로젝트, git 관리)

이미 레포에 포함되어 있으므로 별도 설정 불필요.

---

## 6. gbrain — 레포 의미 검색 (선택)

문서와 코드를 의미 기반으로 검색한다. 찾으려는 대상의 정확한 단어를 모를 때 `grep`이 못 찾는 것을 찾는 용도이고, 임베딩을 로컬에서 돌리므로 비용도 외부 전송도 없다.

필수는 아니다. 설치하지 않아도 이 프로젝트의 모든 작업이 그대로 굴러간다.

설치·색인·MCP 연결 절차와 윈도우에서 겪는 함정은 [`../gbrain-setup.md`](../gbrain-setup.md)가 정본이다.

---

## gstack 주요 커맨드

### 기획 · 전략

| 커맨드 | 설명 |
|--------|------|
| `/office-hours` | 제품 아이디어를 핵심 질문으로 파고들기 |
| `/plan-ceo-review` | 전략적 관점에서 범위와 방향 검토 |
| `/plan-eng-review` | 엔지니어링 아키텍처 검토 |
| `/autoplan` | 전체 구현 계획 자동 생성 |

### 구현 · 리뷰

| 커맨드 | 설명 |
|--------|------|
| `/review` | 코드 변경사항 검토 |
| `/cso` | OWASP + STRIDE 보안 감사 |
| `/investigate` | 버그 근본 원인 디버깅 |

### QA · 배포

| 커맨드 | 설명 |
|--------|------|
| `/qa <URL>` | 스테이징 URL에서 브라우저 QA 테스트 |
| `/ship` | PR 생성 및 배포 준비 |
| `/land-and-deploy` | PR 머지 및 배포 |

### 유틸리티

| 커맨드 | 설명 |
|--------|------|
| `/browse <URL>` | 웹 브라우징 및 정보 추출 |
| `/retro` | 엔지니어링 회고 |
| `/gstack-upgrade` | gstack 최신 버전 업그레이드 |

---

## 기본 워크플로우

### 새 기능 개발

```
1. /office-hours          아이디어 검토
2. /autoplan              상세 구현 계획
3. [승인 후] superpowers:executing-plans + superpowers:test-driven-development
4. /review                코드 리뷰
5. /ship                  PR 생성
```

### 버그 수정

```
1. /investigate   원인 조사
2. [코드 수정]
3. /review        수정 사항 검토
4. /ship          PR 생성
```

### 보안 점검

```
1. /cso     보안 감사
2. [수정]
3. /review  검토
```
