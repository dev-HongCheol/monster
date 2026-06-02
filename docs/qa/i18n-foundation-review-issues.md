# i18n 기반 슬라이스 — 코드 리뷰 이슈

- 브랜치: `feat/i18n-foundation`
- 리뷰 커밋: `94fdfb97968ea68a2c529303d02c044832ecff8a` (BASE `13ee6e0`)
- 리뷰 방식: superpowers:requesting-code-review 패턴, general-purpose subagent (code-reviewer.md)
- **종합 판정: Ready to merge — Yes** (Critical 0 / Important 0 / Minor 5)

## Critical / Important
없음.

## Minor (트리아지)

| # | 항목 | 위치 | 판정 |
|---|------|------|------|
| 1 | `resources.load` 콜백에서 `err`는 null인데 `asset`이 null인 희귀 케이스 미가드 | `systems/I18n.ts` `_load` | **유지** — DataManager(`DataManager.ts:97-102`)와 동일한 기존 프로젝트 관용구. 한 파일만 바꾸면 패턴 불일치. 리뷰어도 "consistency only"로 표기. 콘텐츠 단계에서 두 싱글톤을 함께 손보면 일괄 개선 고려. |
| 2 | `category` 중첩 키 2단 해석이 UI(CardSelectPanel)에 약간 결합 | `ui/CardSelectPanel.ts:53-62` | **수정됨(문서)** — 리뷰어가 "tradeoff 적절(로직에서 풀면 컨벤션 위반)"로 인정. conventions.md § 다국어에 "파라미터 값이 자체 카탈로그 키인 경우 UI가 먼저 t()로 해석" 노트 추가. 코드 무변경. |
| 3 | `IEnemyData.name`은 여전히 원시 표시 문자열(spells/cards만 키화됨) | `data/GameTypes.ts:87` | **범위 밖(이월)** — 플랜 §3가 spells/cards만 대상으로 명시. 현재 `enemy.name` 표시 소비처 없음(grep 확인). 콘텐츠 단계에서 `enemy.<id>.name`으로 마이그레이션. |
| 4 | `LocalizedLabel`에 `onDestroy` 없음(JSDoc/ADR은 "onDisable·onDestroy 해제"로 표기) | `ui/LocalizedLabel.ts` | **유지(근거)** — Cocos 라이프사이클상 노드 파괴 시 `onDisable`이 `onDestroy`보다 먼저 발생하므로 `onDisable` 해제만으로 누수 없음. 리뷰어 "Harmless". 문구는 해제 의도(비활성·파괴 모두 등록 해제됨)를 포괄 표현한 것. |
| 5 | 신규 `.ts`/`.json` 에셋의 `.meta` 미생성 | (신규 파일 전반) | **정상** — 에디터가 임포트 시 자동 생성(7단계 사용자 세팅). 리뷰 대상 아님. |

## 적용한 변경
- conventions.md § 다국어: 중첩 키(파라미터 값이 카탈로그 키인 경우) 해석 규칙 한 줄 추가 (#2).

## 후속(콘텐츠 단계 TODO)
- `IEnemyData.name` → `enemy.<id>.name` 키화 (#3)
- 두 싱글톤(I18n/DataManager) `resources.load` 콜백에 `asset` null 가드 일괄 추가 검토 (#1)
