# 스킬 라우팅

> 이 상황에 어떤 스킬을 쓰나

- **최초 작성:** 2026-08-12
- **상태:** CONFIRMED
- **이력:** 2026-08-12 — 신설(`CLAUDE.md` 「Skill routing」 절에서 이전)

---

스킬 전체 목록은 세션이 열릴 때 자동으로 로드되므로 여기에 다시 적지 않는다. 이 문서가 드는 것은 **이름만으로 용도가 분명하지 않은 것들의 매핑**뿐이다.

| 하려는 일 | 스킬 |
|---|---|
| 제품 아이디어·브레인스토밍 | `/office-hours` |
| 전략·스코프 결정 | `/plan-ceo-review` |
| 아키텍처 설계 | `/plan-eng-review` |
| 디자인 리뷰 | `/design-consultation` 또는 `/plan-design-review` |
| 전체 리뷰 파이프라인 | `/autoplan` |
| 버그·에러 디버깅 | `/investigate` |
| 보안 점검 (OWASP + STRIDE) | `/cso` |
| UI 개선 (코드 리뷰가 아니다) | `/design-review` |
| 복잡한 기능 분해 | `superpowers:brainstorming` |
| 병렬 구현 (worktree) | `superpowers:dispatching-parallel-agents` |

## 도구 스택과의 관계

세 도구가 서로 다른 구간을 든다. **gstack**은 제품 워크플로(기획 리뷰·설계 검토·QA·보안·배포)라 기획부터 배포까지 전 구간에서 쓰고, **superpowers**는 구현 방법론(TDD·작은 태스크·subagent 병렬 개발)이라 코드를 쓰기 시작하는 시점에 켠다. **Context7 MCP**는 Cocos Creator 공식 문서를 실시간으로 조회한다.

설치 방법은 [`ops-environment.md`](ops-environment.md) § 3에 있다. 설치 후에는 Claude Code를 재시작해야 한다.

웹 브라우징은 항상 gstack의 `/browse`를 쓴다. `mcp__claude-in-chrome__*` 도구는 쓰지 않는다.
