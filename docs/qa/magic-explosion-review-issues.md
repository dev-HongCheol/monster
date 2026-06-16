# 코드 리뷰 이슈 — 마법 효과 레이어 S1 (Explosion + 파이어볼 AoE화)

> **브랜치:** feat/magic-explosion
> **리뷰 커밋 범위:** `2da4e9e`(origin/main) .. `ed817ef`
> **리뷰 방식:** `superpowers:requesting-code-review` 패턴 — general-purpose 서브에이전트 dispatch (2026-06-16)
> **판정:** **Ready to merge — Yes.** Critical 0 · Important 0 · Minor 5 + 권고.

---

## 잘된 점 (리뷰어 확인)

- `ExplosionLogic.selectExplosionHits`가 후보 목록을 인자로 받는 그리드-레디 순수 함수다. 제곱거리 비교 + dedup 불변식을 순수 레이어에 접었다(A1 재사용 프리미티브, 백로그 G1 교체 시 함수 무변경).
- 직격 보너스 없음(§9.3) 정확 구현 — 명중 적도 반경 패스로만 1회 피해(`Projectile.ts:91-97`).
- 시전 단위 dedup이 end-to-end 정확 — 시전마다 `Set` 하나를 `SpellCaster._buildExplosion`에서 만들어 부채꼴 모든 발사체에 참조로 공유(`SpellCaster.ts:149-156`). §10.2 일치.
- 풀 재사용 적의 dedup 앵커로 `spawnId`(reset마다 증가하는 안정 id)가 적절 — 노드 재사용 별칭 방지.
- `_detonate`가 변경 전 스냅샷(targets/ctrls)을 만든 뒤 인덱스로 데미지 적용 → 사망으로 배열이 줄어도 누락·오인덱스 없음(`Projectile.ts:108-123`).
- 범위 카드 게이트가 정확·무회귀 — 반경류 마법/분류에만 Range 추가, 그 외 옵션 집합 불변(강화 회귀 스위트 통과).
- i18n 가드 도메인 확장이 타당 — `upgrade.range` 카탈로그 추가에는 옵션 도메인 확장이 필수(아니면 orphan). `CARD_LABEL_OPTIONS`가 이를 처리하며 Duration은 카탈로그 키 부재라 정확히 제외.
- VFX 풀이 선택적·우아 — prefab 미연결이면 피해는 그대로·VFX만 생략, 콜백 1회 바인딩, release 멱등.

---

## 이슈 (전 항목 Minor — 즉시 수정 0건, 분류·이월)

> 리뷰어 판정 Critical/Important 0건. 아래 5건 모두 실제 버그·타입 안전성 결함이 아니다(밸런스·설계 술어·무해 로버스트니스·폴리시·테스트 nicety). 이 프로젝트 관행(과거 리뷰의 Minor 로버스트니스는 백로그로 이월 — F5·F6 등)에 따라 **즉시 수정하지 않고** 출처 역링크와 함께 백로그로 집약한다. 코드 변경이 없으므로 `wf invalidate` 미발생.

### #1 — 카드 게이트 술어 vs 런타임 효과 술어 불일치 (📐 설계)
- **위치:** `EnhancementLogic.ts:88-90`(`isRangeCapable` = `explosionRadius !== undefined`) vs `SpellCaster.ts:150`(폭발 발사 조건 = `hitEffect === 'explosion' && explosionRadius !== undefined`).
- **내용:** `explosionRadius`는 있으나 `hitEffect: 'explosion'`이 없는 마법을 작성하면 아무것도 안 키우는 "죽은" 범위 카드가 뜰 수 있다. 현재 데이터(파이어볼은 둘 다 보유)로는 미발현.
- **판단(미수정):** 설계 술어 선택 문제다. 현재 기준(`explosionRadius` 보유)은 **계획 D5와 일치**하고, 향후 다른 반경형 `hitEffect`(노바·오라 등)가 `explosionRadius`를 공유할 때도 적격으로 잡아 **더 미래 호환적**이다. 리뷰어 제안(둘 다 요구)은 죽은 카드를 막지만 미래 반경형 효과를 배제할 수 있다. 테스트 픽스처(`MagicExplosion.test.ts:95-106`)도 `hitEffect` 없이 `explosionRadius`만 설정 → 술어 변경 시 픽스처도 함께 바뀜. **설계 판단이라 사용자 요청 시에만 변경.** → 백로그 F12.

### #2 — `_explosion`이 despawn 시 비워지지 않음 (♻️ 로버스트니스, 무해)
- **위치:** `Projectile.ts:135-141`(`_despawn`).
- **내용:** 풀 반환된 발사체가 다음 `init`까지 이전 시전의 `ProjectileExplosion`(및 `hitSet`) 참조를 보유. 풀 크기로 유계이고 비활성 노드는 update 안 돌아 무해. `_despawn`에서 `this._explosion = null`로 즉시 해제 가능(trivial).
- **판단(미수정):** 동작 무영향·유계 → 후속 로버스트니스 스윕에서. → 백로그 F11.

### #3 — 발사체당 데미지 페널티 × 폭발 dedup 상호작용 (⚖️ 밸런스)
- **위치:** `SpellCaster.ts:132-134` → `Projectile.ts:123`.
- **내용:** 폭발 발사체도 발사체당 페널티가 곱해진 데미지를 든다. dedup이 군집 내 한 적을 시전당 1회로 캡하므로, 이미 한 폭발로 덮인 촘촘한 군집에선 발사체 수 강화가 **발당 데미지를 낮추기만**(커버리지만 이득, 누적 없음). 계획의 "겹친 폭발 = 커버리지지 누적 아님" 의도와 일치 — 버그 아님.
- **판단(미수정):** 의도된 동작이나 밸런싱 시 의식할 뉘앙스 → 밸런스 구간에 명시. → 백로그 B8.

### #4 — `EXPLOSION_VFX_BASE_RADIUS = 70`이 파이어볼 `explosionRadius`와 중복 (🎨 폴리시)
- **위치:** `SpellCaster.ts:18` vs `spells.json`(fireball.explosionRadius=70).
- **내용:** VFX 스케일 = `radius/70`. 기본 반경이 다른 미래 폭발 마법은 `rangeFactor=1`에서도 비-1 스케일로 렌더. 현재 무해.
- **판단(미수정):** 기본값을 마법에서 유도하거나 커플링 문서화 → 폴리시. → 백로그 F13.

### #5 — 테스트 갭 (저위험)
- **내용:** (a) 유효 반경 계산(`base × rangeFactor`)이 컴포넌트 `_buildExplosion`에만 있어 단위 미커버(`factor(Range)>1`만 검증, 곱 자체는 미검증). (b) 서로 다른 중심의 2차 폭발이 새 적을 때리는 dedup 시나리오는 미실행(같은 중심 2차-빈만 검증).
- **판단(미수정):** 반경 계산은 컴포넌트의 단순 곱 — 단위 테스트만을 위한 순수 추출은 스코프 크리프. 중심-다른 dedup은 같은 중심 로직과 동치라 사실상 커버됨. review-issues에 기록만(매우 낮음).

---

## 권고 (리뷰어)

- #1 술어 정합 / #2 참조 해제 / #3 밸런스 노트 → 백로그 이월(위).
- `_detonate`의 배열 할당·VFX 클로저는 G1(공간 그리드 + 할당 위생) 스코프로 정확히 분리됨 — 지금 조치 없음, 이미 추적.

---

## 디스포지션 요약

| # | 분류 | 처리 | 이월처 |
|---|------|------|--------|
| #1 | 📐 설계 술어 | 미수정(설계 판단, 계획 일치·미래 호환) | 백로그 F12 |
| #2 | ♻️ 로버스트니스(무해) | 미수정(동작 무영향·유계) | 백로그 F11 |
| #3 | ⚖️ 밸런스 | 미수정(의도된 동작) | 백로그 B8 |
| #4 | 🎨 폴리시 | 미수정(현재 무해) | 백로그 F13 |
| #5 | 🧪 테스트 nicety | 미수정(추출=스코프 크리프) | 기록만 |

→ Critical/Important 0건, 즉시 수정 0건 → `pnpm wf pass review`로 진행.
