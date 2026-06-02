# QA: 라이프사이클 메서드 주석 추가 (lifecycle-comments)

> 브랜치: `docs/lifecycle-comment-rule`
> 성격: **문서/주석 전용 변경.** 런타임 로직·시그니처·씬/프리팹 변경 없음.

## 개요

`docs/development/conventions.md`의 라이프사이클 메서드 주석 규칙 개정(단순하면 생략, 로직 누적 시 한 줄 설명 + 내부 WHY 주석)에 맞춰, 본문에 로직이 누적된 라이프사이클 메서드에 `//` 한 줄 기능 설명을 추가한다. **코드 동작은 일절 바뀌지 않는다.**

## Impact Map

| 변경 파일 | 변경 내용 | 회귀 확인 범위 |
|-----------|-----------|----------------|
| `components/SpellCaster.ts` | `update` 한 줄 설명 | 주석만 — 동작 불변 |
| `systems/GameManager.ts` | `update` 한 줄 설명 | 주석만 — 동작 불변 |
| `systems/WaveManager.ts` | `update` 한 줄 설명 | 주석만 — 동작 불변 |
| `systems/EnemySpawner.ts` | `onLoad`/`update` 한 줄 설명 | 주석만 — 동작 불변 |
| `components/EnemyController.ts` | `onLoad`/`update` 한 줄 설명 | 주석만 — 동작 불변 |
| `components/Projectile.ts` | `onLoad`(WHY)/`update` 한 줄 설명 | 주석만 — 동작 불변 |
| `ui/HudController.ts` | `onLoad`/`update` 한 줄 설명 | 주석만 — 동작 불변 |
| `ui/CardSelectPanel.ts` | `onEnable` 한 줄 설명 | 주석만 — 동작 불변 |
| `ui/ResultController.ts` | `onLoad` 한 줄 설명 | 주석만 — 동작 불변 |
| `components/PlayerController.ts` | `update` 한 줄 설명 | 주석만 — 동작 불변 |

## 씬/프리팹 변경 사항

**없음.** 노드·컴포넌트·`@property` 추가/수정 없음.

## 에디터 연결 체크리스트

**해당 없음.** 인스펙터 연결 변경 없음.

## 자동 테스트로 검증

> 통과 근거: 피처 테스트 없음(skip-test, 주석 전용) + 전체 스위트 **60/60 GREEN** (`vitest run`, phase=verification 전환 게이트).

- 주석 전용 변경이므로 신규 피처 테스트 없음 (`pnpm wf skip-test`로 기록).
- [x] `pnpm check`(biome lint + format) 통과 (52개 파일, 수정 없음)
- [x] `mcp__ide__getDiagnostics` — 변경 파일 TypeScript Error 0건 (※ `game/tsconfig.json` `moduleResolution=node10` deprecated는 본 변경과 무관한 기존 이슈)
- [x] `vitest run` 전체 스위트 GREEN (60/60, 기존 테스트 회귀 없음 확인)

## 수동 테스트 체크리스트

> 동작 변경이 없으므로 인게임 수동 검증은 형식상 항목만 둔다.

- [ ] 빌드/실행 시 기존과 동일하게 동작 (메뉴 → 플레이 → 웨이브/카드/결과 흐름 정상)
- [ ] 콘솔 신규 에러/경고 없음
