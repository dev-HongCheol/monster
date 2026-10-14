# QA: 경험치 바 채움 시작 위치 (xp-bar-fill)

> - **브랜치:** feat/xp-bar-fill
> - **계획:** [2026-10-14-xp-bar-fill-plan.md](../development/sessions/2026-10-14-xp-bar-fill-plan.md)
> - **요약:** 화면이 1280보다 넓을 때 경험치 바의 노란 채움이 바 안쪽에서 시작하던 문제(F142)를 고친다. `HudController`가 매 프레임 채움 노드의 x를 늘어난 바 폭에 맞춘다.

---

## 1. Impact Map (회귀 기준)

| 변경 파일 | 확인 범위 |
|-----------|----------|
| `scripts/logic/HudFormatLogic.ts` | 순수 함수 `barFillStartX` 추가. 기존 `formatTimer` · `formatNumber` · `barRatio`는 바뀌지 않는다. |
| `scripts/ui/HudController.ts` | XP 바 갱신에서 채움 노드의 x를 맞춘다. 회귀 기준: 화면 폭 1280에서는 지금과 똑같이 보이고, HP 바 · 레벨 라벨은 그대로다. |

## 2. 씬/프리팹 변경 사항

없음. `main.scene`은 고치지 않는다.

## 3. 에디터 연결 체크리스트

새 `@property`가 없다. 기존 연결을 그대로 쓴다.

| 프로퍼티 | 노드 | 상태 |
|---|---|---|
| `HudController.xpBar` | `XpBar`(ProgressBar, 바 스프라이트는 자식 `Bar`) | ✅ |

## 4. 수동 테스트 체크리스트

- [ ] 브라우저 미리보기 창을 1280보다 넓게 키우고 게임을 시작한다. 경험치를 조금 먹었을 때 노란 채움이 바의 **왼쪽 끝**에서 시작한다
- [ ] 같은 넓은 창에서 레벨업 직전까지 채웠을 때 채움이 바의 **오른쪽 끝을 넘지 않는다**
- [ ] 게임 도중 창 폭을 바꾸면 한 프레임 안에 채움이 다시 바 왼쪽 끝에 붙는다
- [ ] 창 폭 1280(기본)에서 바 모양이 고치기 전과 같다
