# 결정 기록 (ADR)

> 이 폴더에 어떤 결정이 있고, 이 폴더가 어디로 가나

**이 폴더는 폐지 예정이다(2026-09-28 사용자 결정, 백로그 F75).** ADR이 답하던 「그때 무엇을 왜 정했나」는 세션 문서(`../development/sessions/`)가 이미 답하고, 「지금 어떻게 되어 있나」는 정본이 답한다. ADR은 그 사이에서 정본의 내용을 복사해 들고 있다가 낡는 층이 됐다 — 고치지 않는다는 규칙 때문에 004의 명령 표와 007의 이행 상태가 그대로 굳었고, 010이 008을 반쯤 뒤집었는데 008을 읽는 사람은 그것을 모른다. 그래서 남은 ADR 일곱을 각자의 정본으로 접고 폴더를 없앤다. 그때까지 아래 목록은 그대로 읽되, **현재 명세로 읽지 않는다.**

## 목록

| 번호 | 결정 | 접을 정본 |
|---|---|---|
| [001](001-cocos-version.md) | Cocos Creator 버전 선택 | `../development/spec/ops-build.md` |
| [002](002-scripts-logic-pattern.md) | `scripts/logic/` 분리 패턴 | `../development/spec/code-conventions.md` |
| [003](003-testing-strategy.md) | 테스트 전략 | `../development/spec/code-conventions.md` |
| [004](004-workflow-state-machine.md) | 워크플로우 상태 머신 | `../development/workflow/README.md` |
| [005](005-i18n-approach.md) | i18n 방식 — 자체 경량 `t()` | `../development/spec/code-i18n.md` |
| [006](006-collision-hitbox.md) | 충돌 히트박스 — 플레이어 사각형 / 적 원 | `../development/spec/game-combat.md` §1 (이미 있다) |
| [007](007-skin-hitbox-independence.md) | 스킨은 판정에 영향을 주지 않는다 | `../development/spec/game-combat.md` §3 (이미 있다) |
| 008 | AI 이미지 생성은 유료 서비스에서 한다 | **철회 · 삭제(2026-09-28)** — 2D 생성 경로의 이력을 걷어 내며 지웠다. 결정의 요지는 [`../etc/2026-09-28-2d-generation-reference.md`](../etc/2026-09-28-2d-generation-reference.md) §1에 남겼다 |
| 009 · 010 | 시각 층은 몸보다 클 수 있다 · 플레이어 아트는 3D 마스터에서 층별 프레임으로 굽는다 | **정본에 접었다(2026-09-28)** — `../design/spec/art-asset-spec.md` §3 · §8.3, `../design/spec/art-direction.md` §3, `../development/spec/game-combat.md` §3. 브랜치에서 썼다가 main에 올리지 않았다 |

## 새 ADR을 쓰지 않는다

새 결정은 그 슬라이스의 세션 문서에 「왜」를 적고, 정본의 해당 절과 이력 줄에 「지금」을 적는다. 결정이 뒤집히면 정본 이력 줄에 무엇을 반전시켰는지 적고 세션 문서를 링크한다 — 새 ADR을 쓰지 않는다. 이 규칙을 `CLAUDE.md`와 `docs-references.md` §9에 옮기는 것과 위 일곱을 접는 것이 F75의 일이다.
