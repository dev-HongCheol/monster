# 코드 리뷰 이슈: 마법 패턴 엔진

- **리뷰 커밋:** `8e26a54` (BASE `e0d76ce`)
- **리뷰 방식:** general-purpose subagent (superpowers:requesting-code-review 패턴)

---

## 발견 (1차 리뷰 — 8e26a54)

### R1 — [LOW] `count=NaN`이 1발 클램프를 빠져나가 무발사 → **수정됨**
- **위치:** `logic/SpellPatternLogic.ts` `directionalPlan`
- **내용:** `Math.max(1, Math.floor(ctx.count))`에서 `ctx.count`가 `NaN`이면 `Math.floor(NaN)=NaN`, `Math.max(1, NaN)=NaN` → `for (i<NaN)`가 한 번도 안 돌아 `[]` 반환(발사체 0개). `count<=0 → 1` 클램프는 NaN을 못 막는다.
- **도달성:** 현재 `count`는 `spell.projectileCount`(신뢰 정수, 전부 1)라 미도달. 단 향후 발사체 수 강화가 산술로 count를 계산하면 NaN 가능 → 방어.
- **수정:** `Number.isFinite` 가드로 비유한값을 1로 클램프. NaN 테스트 케이스 추가.

### 코드 품질·타입·DRY·순수성
- 회귀 없음(count=1 경로는 기존 단발과 방향 동일, 오히려 영벡터 가드는 개선).
- 부채꼴 수학 정확(홀짝 대칭, div-by-zero 없음, 단위벡터 보존).
- 타입 안전 이상 없음. `logic/` 순수성 확인(cc 비의존).

## 게임 정책 관찰 (수정 대상 아님 — 기록만)
- `spreadAngleDeg` 기본 30°는 총 부채꼴 각도라 발사체가 많아도 외곽이 ±15°로 고정(촘촘한 부채꼴). 밸런싱 단계 튜닝 사항.
- 부채꼴은 단일 최근접 적 방향 기준(다중 타겟 아님). directional 패턴 의도대로.
- `projectileCount` 강화 훅은 아직 없음 — count>=2는 현재 테스트로만 도달(설계대로).

## 재리뷰 (NaN 가드 수정 후)
- R1 수정은 리뷰어가 제시한 정확한 권고를 1줄로 반영 + NaN 테스트 추가. 변경이 격리된 단일 함수라 인라인 집중 검증(전체 스위트 GREEN + 신규 테스트)으로 확인. 신규 이슈 없음.
