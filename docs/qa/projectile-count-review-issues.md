# 코드 리뷰 이슈: 발사체 수 강화 (projectile-count)

> - **브랜치:** feat/projectile-count
> - **리뷰 커밋:** cfa9a95 (base 7c5f322)
> - **리뷰어:** general-purpose subagent (superpowers:requesting-code-review 패턴)
> - **판정:** Yes (with one recommended follow-up) — Critical 0, Important 1, Minor 3

---

## Important

### I-1. §8 적격 게이트가 분류 트랙 누수 — 소스에서 닫기 (수정됨)

- **위치:** `EnhancementLogic.ts` — 게이트가 `buildUpgradeCards` 개별 루프에만 있고, `projectileBonus`는 Individual+Category를 합산.
- **문제:** 미래에 자기중심 AOE 마법(예: 인페르노, Fire·`allowsProjectileCount:false`)이 추가되면, Fire 분류 발사체 트랙(fireball 덕에 합법 존재)을 올릴 때 인페르노의 `effectiveProjectileCount`도 증가하고 발당 페널티가 적용됨 → §8 위반.
- **현재 영향:** 0 (AOE 마법 미존재, 현 3종 전부 ✅). 잠재 결함.
- **왜 중요:** 게이트를 지금 깐 목적(F2 — 미래 AOE 안전장치)이 반감. 다운스트림은 count만 클램프하고 적격 재검사 안 함.
- **수정:** `projectileBonus`가 `spell.allowsProjectileCount === false`면 0 반환 → 개별·분류 양쪽 경로를 한 점에서 닫음. `effectiveProjectileCount`=base·penalty=1.0 자동 보장. 개별 루프 게이트는 "쓸모없는 카드 미노출"용으로 유지(상보적). 테스트 추가: inferno + Fire 분류 발사체 레벨↑ → effectiveProjectileCount=base.

## Minor

### M-1. penaltyFor 음수 bonus 상한 미클램프 (수정됨)
- `penaltyFor`에 음수 bonus가 오면 factor>1.0(데미지 부스트). 공개 API론 도달 불가(getLevel 합 ≥0)이나 export·직접 테스트되므로 `Math.min(1, …)` 상한 추가.

### M-2. factor() console.assert 릴리스 빌드 실행 (수용)
- 순수 로직이라 `cc/env` DEV 게이팅 불가, log만 하고 throw 안 함 → 실용적 선택으로 수용(리뷰어 동의).

### M-3. DeckManager:51 주석 (조치 불요)
- "DEV 빌드의 카드 픽 로그" — 정확, 변경 없음.

---

## Strengths (리뷰어 확인)
- 순수 로직/cc 배선 레이어 분리 정확, `effectiveCooldown`/`damageFactor` 패턴 충실 미러.
- bonus=0 회귀 안전성 코드+테스트로 확인.
- 페널티 load-bearing 확인(`SpellPatternLogic:81` 풀데미지).
- penaltyFor 추출로 클램프 직접 테스트, §8 게이트 양방향 테스트.
- 임시 플래그·미사용 import 완전 제거, SpellEnhancementFramework 카드수 갱신 정당.
