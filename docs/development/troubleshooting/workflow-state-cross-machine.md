# 워크플로우 상태 파일의 크로스머신 동기화 문제 (workflow-state.json)

> **분류:** 운영/도구 이슈 + 복구 절차 (에러·이상 동작 발생 시 참조)
> **최초 관측:** 2026-06-11, `feat/projectile-count` PR 승인·머지 중
> **관련:** [ADR 004 워크플로우 상태 머신](../../decisions/004-workflow-state-machine.md)
> **상태:** 복구 절차 확정 / 영구 정책은 미결(아래 §미결 결정)

---

## 증상 (이게 보이면 이 문서다)

- 브랜치는 `feat/<A>`인데 `pnpm wf status`의 `feature`가 다른 슬라이스(`<B>`)로 떠 있다.
- `phase`가 실제 진행과 안 맞는다(예: 이미 user-verification까지 갔는데 `implementation`).
- `pnpm wf approve-pr`이 "phase=user-verification에서만 가능"이라며 막힌다.

근본 원인: 워크플로우 상태의 단일 진실인 `.claude/workflow-state.json`은 git 추적 파일인데, 이 프로젝트는 **MacBook에서 구현하고 Windows에서 PR을 테스트·승인**하는 2-머신 흐름이라, 상태 전이가 장비를 오갈 때 양방향으로 어긋난다.

---

## 방향 1 — 전이를 커밋하지 않음 → 타 장비에서 stale (실제로 겪음)

MacBook에서 projectile-count를 user-verification까지 올리고 Draft PR(#30)까지 만들었지만, 그 전이를 **커밋하지 않았다**(코드 커밋에 `workflow-state.json` 미포함). 그래서 Windows 장비에서:

- 커밋된 상태가 **이전 슬라이스(passive-effects / user-verification)에 멈춰** 있었다. `feature`도 `passive-effects`.
- Windows 로컬 잔재로 `phase: implementation`까지 끼어 커밋본과도 또 달랐다.
- 결과적으로 `approve-pr`이 막혔다.

### 복구 절차

커밋된 HEAD 상태가 마침 유효한 `user-verification`이었으므로:

```
git restore .claude/workflow-state.json   # 로컬 잔재 폐기 → 커밋본(user-verification) 복원
pnpm wf approve-pr                          # phase만 보므로 통과
```

- `approve-pr`은 **`feature` 이름을 검사하지 않고 `phase`만 본다**(`.claude/workflow.mjs` 337–348행). `feature` 라벨이 틀려도 무해 — 다음 `wf start`가 리셋한다.
- **`wf start`로는 라벨을 못 고친다**: `freshState`로 planning 리셋 + `ready-impl`의 RED 게이트가 **이미 구현돼 통과하는 코드**에서 차단된다. 상태 머신에는 "중간 단계로 되돌려 라벨만 교정"하는 합법 경로가 없다.

---

## 방향 2 — 전이를 커밋함 → 전파·충돌·락 상속 (반대 상황)

방향 1을 막겠다고 전이를 매번 커밋하면 반대편 문제가 생긴다. 상태 파일이 추적되므로 커밋값이 그대로 전파된다.

- **main 오염:** 상태 파일이 PR diff에 실려 머지되면 main이 `user-verification`·`done` 같은 중간/완료 phase를 품은 채 남는다. 다음 슬라이스가 그 main에서 분기하면 상태를 물려받는다. `wf start`가 리셋하므로 대개는 괜찮지만, `wf start`를 깜빡하고 바로 편집하면 훅이 잠긴 phase로 오인해 막거나 엉뚱하게 허용한다.
- **머지 충돌:** 두 피처 브랜치가 각자 전이를 커밋하면 `workflow-state.json` 한 파일에서 머지 충돌이 난다.
- **여전한 stale(거울상):** 커밋했더라도 타 장비가 pull을 깜빡하면 옛 상태를 본다 — 방향 1과 같은 증상이 원인만 바뀐 채 재발한다.

즉 "커밋한다 / 안 한다" 둘 다 함정이 있고, 근본은 **진행 상태(가변·머신 로컬 성격)를 버전 관리 파일에 담았다**는 점이다.

---

## 미결 결정 (선택지)

| 방안 | 내용 | 장점 | 단점 |
|------|------|------|------|
| **(a) 항상 커밋** | 전이마다 `workflow-state.json` 커밋·push | 타 장비가 pull하면 정확한 phase 인계 | main 오염 + 머지 충돌 + pull 누락 시 stale |
| **(b) 추적 제외** | `.gitignore`로 빼고 순수 머신 로컬 상태로 | 충돌·전파 0, 각 장비가 자기 흐름만 관리 | 한 장비에서 시작한 슬라이스를 다른 장비에서 "이어받기" 불가 → 승인 장비가 phase를 모름 |
| **(c) 핸드오프 시점만 커밋** ⭐ | 평소 전이는 로컬, **Draft PR 생성(7단계 진입) 시점에만** `user-verification` 상태를 커밋 | 승인 장비가 정확히 user-verification 인계(이번 사고 직접 예방), 커밋 빈도 최소 → 충돌·오염 최소 | 커밋 시점 규칙을 사람이 지켜야 함(또는 훅/CLI로 강제) |

### 권장

**(c) 핸드오프 시점만 커밋.** 2-머신 흐름(구현=Mac, 승인=Windows)에서는 "승인 장비가 user-verification을 정확히 인계받는 것"만 보장되면 충분하다. 7단계 Draft PR 생성 단계에서 상태 파일을 함께 커밋하도록 규칙을 두면(가능하면 `wf` CLI·훅이 강제) 방향 1을 막고 방향 2의 오염·충돌은 최소화된다. 정책 확정 시 ADR 004에 "상태 파일 커밋 시점" 절을 추가한다.
