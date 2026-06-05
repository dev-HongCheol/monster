# 코드 리뷰 이슈: enemy-visuals (S2)

> - **리뷰 커밋:** d63eb8d..3289738 (BASE..HEAD)
> - **리뷰 방식:** superpowers:requesting-code-review (general-purpose subagent)
> - **결과:** Critical 0 / Important 1(코드 아님·QA 검증) / Minor 3 → **머지 가능(코드 수정 불필요)**

---

## Critical
없음.

## Important

### I-1. 사망 페이드 알파 블렌드 — 인게임 가시성 미검증 (코드 아님, 수동 QA)
- **위치:** `EnemyController.ts:151-155` (`color.a` 페이드)
- **내용:** 페이드는 Sprite `color.a`로 구현. Cocos 기본 `builtin-sprite` 머티리얼은 알파 블렌드가 켜져 있어 정상 동작이 기대되나, 프리팹 Sprite가 커스텀/비알파 머티리얼이면 페이드가 안 보이고 팝 후 갑자기 사라질 수 있음.
- **판단:** **코드 버그 아님.** 사망 연출의 핵심 시각이므로 7단계 수동 QA에서 "페이드가 실제로 보이는지" 명시 확인 필요. → QA 문서(`enemy-visuals-test.md`) 에디터 체크리스트 ⚠️ 항목 + 사망 연출 수동 항목 강화함. **상태: QA 항목으로 이관(머지 차단 아님).**

## Minor

### M-1. deathScale 종료값 1.0 (폴리시) — **S3 이월**
- **위치:** `EnemyVisualLogic.ts:34` (`1 → peak → 1`)
- **내용:** 소멸 순간 기준 크기로 복귀. 시각적으로 무난하나 `1 → peak → 약간 축소` 곡선이 더 타격감 있음. 계획상 S3(enemy-feel) 범위 → **이월.**

### M-2. `?? 1` / `?? '#FFFFFF'` 방어코드 (EnemyController.ts:97-99) — **유지**
- 필드가 이제 필수(non-optional)라 타입상 불필요하나, JSON 런타임 malformed 방어로 합리적 → **그대로 유지.**

### M-3. 수기 `.meta` UUID (EnemyVisualLogic.ts.meta) — **저위험**
- 경로 참조 순수 로직이라 UUID 런타임 무관. 타 `.meta`와 중복만 아니면 무방 → 확인 완료, **유지.**

---

## 조치 요약
- **코드 수정:** 없음 (Critical/Important 코드 버그 0).
- **문서 강화:** QA 문서에 페이드 가시성 검증(I-1) 명시.
- **이월:** M-1 → S3(enemy-feel).
- → `pnpm wf pass review` 진행.
