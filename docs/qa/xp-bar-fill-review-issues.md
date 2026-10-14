# 코드 리뷰 이슈: xp-bar-fill

> - **브랜치:** feat/xp-bar-fill
> - **리뷰 범위:** acd4547..d6377c7
> - **판정:** 머지 가능. Critical · Important 없음

| # | 등급 | 위치 | 지적 | 처리 |
|---|---|---|---|---|
| 1 | Minor | `game/assets/scripts/ui/HudController.ts` XP 바 갱신 | x 값이 그대로여도 매 프레임 `setPosition`을 불러 노드 변환을 바뀐 것으로 표시한다 | 수정됨 — 값이 다를 때만 넣는다 |
| 2 | Minor | 같은 자리 | 엔진은 채움이 바의 직계 자식일 때만 x를 놓는데 새 코드는 부모를 확인하지 않는다. 씬에서 채움 노드를 옮기면 엉뚱한 좌표가 들어간다 | 수정됨 — `fill.parent === xpBar.node` 조건을 더했다 |
| 3 | Minor | `game/assets/scripts/logic/HudFormatLogic.ts` | `barFillStartX`는 표시 문자열이 아니라 배치 계산이라 파일 이름과 조금 어긋난다 | 기록만 — 계획이 `barRatio` 옆으로 정했고 같은 바 계산이다 |
| 4 | Minor | `docs/qa/xp-bar-fill-test.md` §1 | 경로를 `scripts/...`로 줄여 쓴 표기가 다른 QA 문서와 맞는지 | 변경 없음 — 직전 QA 문서(`magic-effect-gate-test.md`)도 같은 표기다 |
