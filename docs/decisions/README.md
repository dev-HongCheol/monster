# 결정 기록 (ADR)

> 이 폴더에 어떤 결정이 있고 새 ADR을 어떻게 더하나

이 폴더의 ADR은 **결정 기록**이다. 「그때 무엇을 왜 정했나」를 적는다. 「지금 어떻게 되어 있나」는 정본(`../development/spec/` · `../design/spec/` · 코드와 JSDoc)이 답한다 — 층의 구분은 [`docs-references.md`](../development/spec/docs-references.md) §1이 든다.

ADR은 횡단 규칙 · 플랫폼 · 프로세스처럼 여러 슬라이스에 걸친 결정에 쓴다. 한 시스템의 설계 근거는 대개 그 슬라이스의 `../development/sessions/*-plan.md`에 있다.

## 목록

| 번호 | 결정 |
|---|---|
| [001](001-cocos-version.md) | Cocos Creator 버전 선택 |
| [002](002-scripts-logic-pattern.md) | `scripts/logic/` 분리 패턴 |
| [003](003-testing-strategy.md) | 테스트 전략 |
| [004](004-workflow-state-machine.md) | 워크플로우 상태 머신 |
| [005](005-i18n-approach.md) | i18n 방식 — 자체 경량 `t()` |
| [006](006-collision-hitbox.md) | 충돌 히트박스 — 플레이어 사각형 / 적 원 |
| [007](007-skin-hitbox-independence.md) | 스킨은 판정에 영향을 주지 않는다 |
| [008](008-paid-art-generation.md) | AI 이미지 생성은 유료 서비스에서 한다 |
| [009](009-visual-bounds-exceed-body.md) | 시각 층은 몸보다 클 수 있다 |
| [010](010-player-art-3d-layer-bake.md) | 플레이어 아트는 3D 마스터에서 층별 프레임으로 굽는다 |

## 새 ADR을 더할 때

- 파일명은 `NNN-title.md`이고 번호는 이어서 붙인다. 이미 쓴 번호를 다시 쓰지 않는다.
- 이 목록에 한 줄을 더한다. 목록이 `CLAUDE.md`가 아니라 여기 있는 것은, `CLAUDE.md`가 매 세션 통째로 읽히는 문서라 ADR이 늘 때마다 그 부피가 쌓이기 때문이다(2026-09-28).
- 기존 결정을 뒤집을 때의 규칙은 [`docs-references.md`](../development/spec/docs-references.md) §9가 든다.

이 README는 결정 기록 층 안에 있지만 **고치는 색인**이다. 결정 기록은 고치지 않는다는 규칙(`docs-references.md` §9)은 ADR 본문에 걸리고, 이 목록은 ADR이 늘 때마다 한 줄씩 자란다.
