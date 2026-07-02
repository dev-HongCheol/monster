# 개발 백로그 (living)

> **목적:** 구현·테스트 중 떠오른 "지금 슬라이스 밖" 할 일을 한 곳에 모아, 어느 슬라이스를 시작하든 관련 항목을 함께 집어 진행할 수 있게 한다.
> **작성 시작:** 2026-06-11 (지금까지 슬라이스들의 review-issues·followups·메모리에 흩어져 있던 미해결/이월 항목을 통합)
> **성격:** 계속 갱신하는 living 문서. 슬라이스를 가로지르는 아이디어만 담는다(한 슬라이스 안의 작업 단계는 `pnpm wf`·세션 투두가 관리).

---

## 사용법 / 운영 규칙

- **조회(슬라이스 시작 시 필수):** 새 슬라이스를 계획할 때(워크플로우 1단계) 이 문서를 먼저 본다. 이번 슬라이스의 테마/영향 범위에 걸리는 항목을 골라 스코프에 포함하고, 계획 문서에 "이 슬라이스가 닫는 백로그 항목"으로 명시한다. 같은 영역을 건드리는 김에 후속·로버스트니스 항목을 함께 처리해 왕복을 줄이는 게 이 문서의 목적이다.
- **추가:** 구현·테스트하다 떠오르면 즉시 해당 테마 표에 한 줄 추가한다. 맥락(Why)과 출처를 같이 적어야 나중에 의미가 산다.
- **승격:** 항목이 한 슬라이스 분량으로 커지면 `docs/development/sessions/<날짜>-<feature>-plan.md`로 올리고, 여기서는 취소선 + 링크로 「승격됨」 섹션에 남긴다(히스토리 보존).
- **완료:** 어느 슬라이스에서 처리되면 취소선 + 처리된 슬라이스 링크로 「승격됨/완료」로 옮긴다.
- **출처 문서는 지우지 않는다.** 각 슬라이스의 `*-review-issues.md`·`*-plan.md`는 그 시점 기록(불변 히스토리)이다. 이 백로그는 그것들을 **대체가 아니라 집약**한다 — 각 항목은 출처로 역링크만 건다.
- **태그:** 🐛버그 · ✨기능 · ♻️리팩터 · ⚖️밸런스 · 🎨아트/UX · 🔧인프라 · 📐설계/정책
- **우선:** 높음(다음 슬라이스 후보) · 중 · 낮음(기회 될 때) · 보류(시점 미도래)

> **⚠️ 방향 전환(2026-07-02) — 마법·적 콘텐츠 동결, 완성도 우선:** 마법과 적은 v1 콘텐츠를 여기서 **동결**한다(로드맵 v0.3 「방향 전환」 절). 두 영역은 이후 **버그·밸런스·현 기준 마감**만 하고, 신규 마법·적·효과·공격 패턴은 전부 **2차(v2)로 이월**한다. 이에 따라 이 백로그의 우선순위가 재편됐다:
> - **A(마법 효과 레이어)·G(성능·스케일)** → **2차 이월.** v1 개발에서 착수하지 않는다(각 테마 머리 표시 참조).
> - **B(밸런싱)** → v1 유지. 콘텐츠가 동결됐으니 오히려 이제 확정 대상이다(placeholder 수치 → 실측 튜닝).
> - **F·I(버그·로버스트니스)** → v1 유지. 특히 실제 발현하는 버그(I3 등).
> - **신규 J(v1 완성도 — 맵·스토리·플로우·UI·메타)** → v1의 새 주력 테마. 상세 슬라이스 분해는 후속 `/office-hours`에서 채운다.
>
> 아래 2026-06-11 메모는 그 시점 기록으로 보존한다(방향 전환 전 상황).

> **현재 상황 메모(2026-06-11):** 마법 시스템은 전체 기획을 슬라이스로 쪼개 진행하다 패턴/강화 트랙만 앞서 나가고 **효과 레이어가 통째로 홀딩**된 상태다. 그래서 가장 큰 덩어리는 아래 **A. 마법 효과 레이어**이며, 강화의 일부 옵션(범위·지속시간)은 곱할 대상이 없어 no-op으로 대기 중이다(A3). 마법 슬라이스를 재개할 때 A1·A2·A3를 함께 묶어야 진행도 치우침이 풀린다.

---

## A. 마법 효과 레이어 (~~다음 마법 슬라이스군~~ → **2차 이월, 2026-07-02**)

> **2차 이월(2026-07-02 방향 전환):** 마법 콘텐츠 동결로 이 테마는 **v1에서 착수하지 않는다.** 잔여 효과(빙결·호밍·체인·낙하·폭풍·빔)와 A2(facing 발사)는 전부 2차(v2). 아래 표는 2차 착수 시 참조용 기록으로 보존한다. (A3는 이미 완료.)

| # | 태그 | 항목 | 맥락 · Why | 출처 | 우선 |
|---|------|------|-----------|------|------|
| A1 | ✨ | **마법별 효과 레이어 구현** — 폭발-on-impact / 자기중심 AOE(노바) / DOT / CC(슬로우·빙결) / 호밍 / 체인 / 지정위치 낙하(메테오·썬더스톰) / 무작위 폭풍(블리자드) / 빔 | 현재 패턴 엔진은 `Directional`(직선·부채꼴) 하나뿐. `SpellPatternLogic`의 switch에 case를 추가하는 구조로 설계돼 있다. 마법 10종이 실제 고유 동작을 가지려면 이 레이어가 핵심. 각 마법↔패턴 매핑은 기획서 참조. **진행(2026-06-21):** CC 축 — 정지(magic-S2)·슬로우(magic-S3, F14 강도별 다중 타이머 모델 동반) 구현. **진행(2026-06-23):** 자기중심 Nova 순간버스트 프리미티브 + 프로스트 노바(frost-nova) — Self-AoE 축 개시(디스패치 옵션 B = 별도 버스트 경로, §12.1 출력 일반화는 이월). 빙결·인페르노·호밍·체인·낙하·폭풍·빔 잔여 → A1 계속 열림. **진행(2026-06-24, 계획 feat/inferno):** 인페르노를 궤도형(Orbit)으로 재정의 — 신규 Orbit 패턴(상시 ON 회전 히트볼륨) + 동적 링 + 적별·오브별 재타격 락아웃. Aura(자기중심 지속 DOT 지대) 프리미티브는 v1에서 쓰는 마법이 없어 A1에서 제외(미래 DOT 데미지 지대형 마법 도입 시 부활). 자기중심 축(노바·궤도) 마무리, 빙결·호밍·체인·낙하·폭풍·빔 잔여. | [spell-pattern-engine 메모리], `../planning/magic-system-mage.md` | 높음 |
| A2 | ✨ | **적 없을 때 facing 방향 발사**(지속형 마법) | 사거리 내 적이 없으면 현재는 발사 보류 → 블리자드 등 설치/지속형 마법의 효용이 반감. "적 있음=조준 / 없음=facing 방향" 규칙 필요. **선행 과제:** 플레이어가 8방향 이동만 있고 facing 상태가 없음 → facing 정의(마지막 이동 방향?)부터 정해야 함. | `sessions/2026-06-01-magic-followups.md` §1 ⭐ | 높음 |
| A3 | ✨ | **범위·지속시간 강화 활성화** | 강화 프레임워크에 `UpgradeOption`으로 범위·지속시간이 enum·매트릭스에만 존재하고 **no-op**이다. splash/AOE/DOT 효과 레이어(A1)가 생겨야 곱할 대상이 생긴다 → A1과 한 묶음. **진행(2026-06-23):** 프로스트 노바(frost-nova)로 **범위** 강화가 첫 실제 대상(노바 반경 = `explosionRadius` × rangeFactor)을 얻어 활성화됐다. **지속시간**은 여전히 곱할 대상 없음(노바는 순수 피해 = `onHitStatus` 없음) → 빙결·DOT 등 CC 효과가 생겨야 활성화, A3 계속 열림. **정정·진행(2026-06-24):** A3는 사실상 닫혔다. 위 06-23 노트의 "지속시간 대상 없음"은 magic-S2/S3가 추가한 CC 지속(정지·슬로우)을 빠뜨린 오기였다 — `SpellCaster._buildStatusEffect`가 `durationFactor`를 CC 지속에 이미 곱하고 있다. **범위**는 frost-nova(노바 반경)에 인페르노(오브 크기)가, **지속시간**은 S2/S3 CC 지속에 인페르노(오브 활성 수명 — 첫 비-CC 대상)가 대상을 더한다(feat/inferno). 인페르노는 강화 5종이 전부 의미 있는 유일한 마법이다. 잔여 no-op 없음. | `sessions/2026-06-03-spell-enhancement-framework-plan.md` §42, [spell-enhancement 메모리] | ✅완료(feat/inferno) |
| A4 | 🎨 | **마법별 전용 스프라이트/이펙트** | 현재는 분류 색 틴트(화염=빨강/얼음=하늘/번개=노랑)로만 구분. 아트 단계(로드맵 7-9주)에서 마법별 고유 비주얼. | `sessions/2026-06-01-magic-followups.md` §2 | 낮음 |

---

## B. 밸런싱 (로드맵 11-12주 — 수치 확정 구간)

| # | 태그 | 항목 | 맥락 · Why | 출처 | 우선 |
|---|------|------|-----------|------|------|
| B1 | ⚖️ | 발사체당 데미지 페널티 비율 `r`(현재 0.1 초안) 확정 + **선형→곱연산 전환 검토** | 기획 §7.6 초안값. 다발=군집 이득/단일 손해 트레이드오프 곡선의 강도를 좌우. 현재 식 `(1 − r × 증가수)`는 선형이라 cap 부근에서 0/음수로 떨어져 하한 클램프에 의존 → 20 Minutes Till Dawn식 곱연산 `(1 − r)^증가수`(음수 없이 부드럽게 감쇠)로 전환할지 함께 확정. | `../qa/projectile-count-review-issues.md`, `../planning/magic-system-mage.md` §7.6, `EnhancementLogic.ts:32-34` | 보류(시점) |
| B2 | ⚖️ | 전역 강화 트랙 cap 검토 | 개별·분류 곡선은 cap 4인데 전역(`addGlobal`)은 무한 누적 → "개별>분류>전역" 위계가 1픽 기준은 보장돼도 다수 누적 시 점근적으로 깨질 수 있음. | `../qa/spell-enhancement-framework-review-issues.md` #4 | 보류(시점) |
| B3 | ⚖️ | 강화 곡선·전역 수치 placeholder 확정 | `INDIVIDUAL_CURVE`/`CATEGORY_CURVE`/전역 ±5% 모두 임시값(설계 §10 TBD). | `../qa/spell-enhancement-framework-review-issues.md` #5 | 보류(시점) |
| B4 | ⚖️ | `spreadAngleDeg` 기본 30° 튜닝 | 총 부채꼴 각도라 발사체가 많아도 외곽 ±15° 고정(촘촘). | `../qa/spell-pattern-engine-review-issues.md` | 보류(시점) |
| B5 | ⚖️ | 마법 카드 추첨 가중치 / 웨이브 등급 게이팅 | 현재 합성 카드가 base 카드와 평면 풀에서 균등 무작위. 마법 종수 늘수록 특정 강화 카드 확률 희석. 기획 §6.2 가중치 추첨 미구현. | `../qa/magic-add-card-review-issues.md` #1, `sessions/2026-06-03-spell-enhancement-framework-plan.md` §43 | 중 |
| B6 | ⚖️ | 무제한 풀(`maxFree=0`)·무상한 `maxEnemies` 메모리 한도 | 풀링이 피크 할당은 캡하지만 수렴 상한은 밸런싱 과제. **→ 대량 적 성능 슬라이스 G1에 흡수**(상한 제거 시 풀 수렴점 재설계 필요). | `../qa/enemy-xp-pooling-review-issues.md` M-3, [G1] | 보류(→G1) |
| B7 | ⚖️ | 레벨업 재개 시 웨이브 타이머 풀 리셋 재검토 | `resumeFromLevelUp`이 `_waveTimer`를 풀 리셋 → 레벨업 잦으면 웨이브가 안 넘어갈 수 있음. 네이밍만 정리하고 행동 미변경 상태(2026-06-02 결정). 웨이브 난이도 곡선 설계 시 재검토. | `sessions/2026-06-01-magic-followups.md` §2 | 중 |
| B8 | ⚖️ | 발사체 수 강화 × 폭발 dedup 상호작용 — 폭발형은 "커버리지만" 이득 | 폭발 발사체도 발사체당 페널티가 곱해진 데미지를 든다. dedup이 군집 내 한 적을 시전당 1회로 캡하므로, 이미 한 폭발로 덮인 촘촘한 군집에선 발사체 수 강화가 발당 데미지를 낮추기만 한다(누적 없음 — 의도된 동작). 단일 명중 마법과 다른 트레이드오프 곡선이라 발사체 수 페널티 `r` 확정(B1) 시 함께 의식. | `../qa/magic-explosion-review-issues.md` #3 | 보류(시점) |

---

## C. i18n 키 타입 안전성 (가드 완료, 타입 코드젠 잔여)

| # | 태그 | 항목 | 맥락 · Why | 출처 | 우선 |
|---|------|------|-----------|------|------|
| C1 | 🔧 | i18n 키 코드젠 + 가드 → **가드 완료 / 타입 코드젠 보류** | **가드(완료 — feat/i18n-key-guard):** 카탈로그↔코드 드리프트(누락=생키 노출·고아·en 오타·param 불일치)를 vitest 영구 게이트로 차단 (`logic/I18nKeyGuard.ts` 순수 가드 + 실카탈로그 게이트). **타입 코드젠(보류·잔여):** `type I18nKey` union + typed `t()`는 AI-주도 개발에서 한계효용 얇음(가드가 같은 오타를 RED로 잡아 결과 중복, 자동완성 이득은 AI엔 거의 0) → 사람이 직접 키를 타이핑하는 비중이 커지면 재검토. | [next-slice-i18n 메모리], ADR 005, `sessions/2026-06-11-i18n-key-guard-plan.md` §1·§6 | 낮음(잔여) |

---

## D. 콘텐츠 단계 (로드맵 7-9주 — 데이터 늘어날 때)

| # | 태그 | 항목 | 맥락 · Why | 출처 | 우선 |
|---|------|------|-----------|------|------|
| D1 | 🔧 | `IEnemyData.name` → `enemy.<id>.name` 키화 | i18n 1차는 spells/cards만 키화. 현재 `enemy.name` 표시 소비처 없음 → 콘텐츠 단계에 마이그레이션. | `../qa/i18n-foundation-review-issues.md` #3 | 낮음 |
| D2 | 🔧 | DataManager JSON `as T` 캐스팅 → 스키마 검증(zod/assertion) | 필드 누락 시 런타임에 undefined 유입 가능. 현재 적 1종이라 위험 낮음, 콘텐츠 늘면 방어 필요. `xpDrop:0` 같은 의도적 0 vs 누락 구분도 포함. **frost-nova 리뷰 M-2:** 마법 단위 테스트가 실 spells.json이 아닌 픽스처를 써서 데이터 드리프트(오타·필드 누락)를 못 잡는다 — 실데이터를 로드해 마법별 필드(pattern/allowsProjectileCount/explosionRadius)를 단언하는 sanity 테스트를 이 검증과 함께 도입. | `../qa/xp-drop-per-enemy-review-issues.md` Recommendations, `../qa/frost-nova-review-issues.md` M-2 | 중 |
| D3 | ♻️ | `en.json`/`ko.json` 포맷 비대칭 정리 | en은 flat string, ko는 `{message,desc}` 객체. 현재 각 파일 내부 컨벤션은 일관(신규 결함 아님). | `../qa/passive-effects-review-issues.md` #4 | 낮음 |

---

## E. enemy-feel S3 (폴리시 구간 13-15주 — 보류 결정)

| # | 태그 | 항목 | 맥락 · Why | 출처 | 우선 |
|---|------|------|-----------|------|------|
| E1 | 🎨 | 사망 파티클/사운드 · 넉백 · `deathScale` 폴리시(`1→peak→약간 축소`) | enemy-variety 3분할 중 S3(게임필). 로드맵상 juice/사운드는 폴리시 구간이고 파티클은 풀링·아트 전 도입 시 rework·성능 위험, 넉백은 kiting 밸런스 변수 → **보류**(2026-06-06 결정). | `../qa/enemy-visuals-review-issues.md` M-1, [enemy-variety 메모리] | 보류 |

---

## F. 로버스트니스 / 소소 (기회 될 때 — 저위험, 동작 무영향)

| # | 태그 | 항목 | 맥락 · Why | 출처 | 우선 |
|---|------|------|-----------|------|------|
| F1 | ✨ | `startingSpellIds` 시드 실패 무알림 → `console.warn` | `addSpell`이 6슬롯 초과/중복을 조용히 drop. 진단 추가. | `sessions/2026-06-01-magic-followups.md` §2 | 낮음 |
| F2 | 🐛 | `_onPickCard`가 `addSpell` boolean 반환을 버림 | 현재 1회 픽 흐름엔 무해. 향후 다중 픽 패널 생기면 거부된 추가가 픽을 소모할 수 있음. | `../qa/magic-add-card-review-issues.md` | 낮음 |
| F3 | 🐛 | 두 싱글톤(I18n/DataManager) `resources.load` 콜백 asset 널 가드 일괄 | 로드 실패 시 방어. | [next-slice-i18n 메모리] | 낮음 |
| F4 | 🐛 | `getEnemy(enemyId)` null이면 inert 적이 `maxEnemies` 영구 점유 | director가 유효 id만 선택해 현재 미발현(회귀 아님). 데이터 정합성 이슈. | `../qa/enemy-xp-pooling-review-issues.md` M-2 | 낮음 |
| F5 | ♻️ | `Projectile.ts:70` 노후 주석 갱신 | "takeDamage→destroy→unregisterEnemy"가 이제 "연출 후 release"로 바뀜. 한 줄 정리. | `../qa/enemy-xp-pooling-review-issues.md` M-4 | 낮음 |
| F6 | ♻️ | `spellCategoryColor` 발사마다 `new Color` 할당 → 분류별 Color 캐시 | hot path에 있으나 풀링 이전부터 존재. 후속 최적화. | `../qa/object-pooling-review-issues.md` M-2 | 낮음 |
| F7 | 🔧 | `PoolManager` cap/destroy 경로 테스트 + in-place 리셋 도입 시 `clear()` | 현재 `maxFree=0`(무제한)이라 폐기 경로는 dead path. 재시작도 씬 리로드라 teardown 불필요. 한도/제자리 리셋이 생기면 함께. | `../qa/object-pooling-review-issues.md` I-2·I-3 | 낮음 |
| F8 | 🐛 | 카드 설명 라벨 텍스트 잘림 — 긴 설명이 양끝부터 잘려 다른 카드로 오인 | `CardDescLabel_0/1/2`가 너비 150·`overflow=CLAMP`·중앙정렬·`wrapText=false`. 예: `"파이어볼 발사체 수 +1레벨"` → 화면엔 `"이어볼 발사체 수 +1레"`로 잘려 **아이스볼 카드로 오인**. 발사체 로직·드로우는 정상(순수 표시 버그). 수정 방향(택1): 라벨 `overflow=SHRINK` / `wrapText`+`RESIZE_HEIGHT` / 라벨·카드 너비 확대. (증거 스크린샷은 미커밋) | projectile-count 7단계 인게임 테스트 (2026-06-11) | ✅완료(card-layer-fix) |
| F9 | 🔧 | 씬 카메라 크로스머신 churn — MacBook 작업 / Windows 테스트 시 `main.scene` Camera 노드 `_lpos.y`·`_orthoHeight`가 재계산돼 무관 diff 발생 | 장비별 화면/해상도 차이로 에디터가 카메라를 재fit→재직렬화. 매 PR 테스트마다 반복. 커밋 전 `git diff *.scene`로 거르거나, 카메라 fit 정책/고정값으로 안정화 검토. | projectile-count 테스트 중 확인 (2026-06-11) | 낮음 |
| F10 | 🔧 | `workflow-state.json` 크로스머신 동기화 정책 결정 | 전이 미커밋→타 장비 stale(겪음) / 전이 커밋→main 오염·머지 충돌·락 상속(반대). 추적 유지+핸드오프 시점만 커밋(권장) vs `.gitignore` 제외 중 택해 ADR 004에 반영. | `troubleshooting/workflow-state-cross-machine.md`, ADR 004 | 중 |
| F11 | ♻️ | `Projectile._despawn`에서 `_explosion = null`로 공유 dedup 집합 즉시 해제 | 풀 반환된 발사체가 다음 `init`까지 이전 시전의 `ProjectileExplosion`(및 `hitSet`) 참조를 보유. 풀 크기로 유계·비활성 노드는 update 안 돌아 무해. 한 줄 정리. | `../qa/magic-explosion-review-issues.md` #2 | 낮음 |
| F12 | 📐 | 범위 카드 게이트 술어 — `explosionRadius` 보유 vs `hitEffect='explosion'`까지 요구 | `isRangeCapable`은 `explosionRadius` 보유만 본다(계획 D5·미래 반경형 효과 호환). `explosionRadius`만 있고 `hitEffect`가 explosion이 아닌 마법을 작성하면 아무것도 안 키우는 "죽은" 카드가 가능(현재 미발현). 둘째 폭발/반경형 마법을 추가할 때 "explosionRadius ⇒ hitEffect explosion" 불변식을 데이터 검증(D2)으로 강제할지 함께 결정. | `../qa/magic-explosion-review-issues.md` #1 | 낮음 |
| F13 | 🎨 | 폭발 VFX 기준 반경(`EXPLOSION_VFX_BASE_RADIUS=70`) 마법 데이터 커플링 | VFX 스케일 = `radius/70`이 파이어볼 기본 반경과 중복. 기본 반경이 다른 미래 폭발 마법은 `rangeFactor=1`에서도 비-1 스케일로 렌더. 기본값을 마법에서 유도하거나 커플링 문서화. | `../qa/magic-explosion-review-issues.md` #4 | 낮음 |
| F14 | 📐 | **CC 다중 타이머 모델 전환** — 강도별 독립 타이머·동시 감소·"가장 센 것" 적용 (모델 결정됨 2026-06-21) | **결정(2026-06-21):** F14의 열린 질문(per-source vs max/max)을 동시 타이머로 확정. 단일 슬롯(강도 max·지속 max)을 폐기하고, 슬로우·정지·빙결이 **각자 타이머를 들고 동시에 감소**하며 매 순간 살아 있는 것 중 **가장 센 강도**를 적용한다. 재적중은 그 강도의 타이머만 max로 재충전하고 다른 강도는 독립으로 계속 흐른다. 시나리오1) 스턴3·슬로우5·빙결1 동시 적용 → 빙결 1초 → 스턴 2초 → 슬로우 2초(총 5초, 가장 긴 단일 지속). 시나리오2) t=1에 빙결을 다시 걸면 빙결이 1초 재충전돼 다시 1초 보이고, 그 밑에서 스턴 타이머가 같이 흘러 스턴은 남은 2초 중 1초만 노출. **현 문제:** 기존 `applyControl`은 강도·지속을 각각 max로 합쳐, 약하고 긴 소스가 강한 강도의 잔여를 늘린다(설계 오류). **휴면:** 지금은 `spells.json`이 stun만 생산해 강도가 안 섞여 미발현 — 단일 슬롯과 적용 결과 동일이라 magic-cc(S2)는 현 상태로 정상·머지 가능. **슬로우(S3)에서 두 번째 강도가 처음 생길 때 관측되므로 S3에서 함께 구현**한다. **변경 범위:** `StatusEffectLogic.ts`(자료구조→강도별 타이머 + `applyControl`/`tickControl` 재작성 + 신규 `appliedStrength`/`hasActiveControl` + 헤더 JSDoc), `EnemyController.ts`(`_control.strength` 읽는 4곳→`appliedStrength`·틱 가드→`hasActiveControl`), `MagicCc.test.ts`(cross-strength·tick 재작성 + 동시감소·재충전 시나리오 추가), `magic-cc-test.md`, 기획 §9.4(단일 슬롯→다중 타이머로 재서술). | `../qa/magic-cc-review-issues.md` #2, 이 대화(2026-06-21 사용자 결정) | ✅완료(magic-S3) |
| F15 | 🐛 | `hitEffect='explosion'` + `onHitStatus` 동시 보유 마법은 폭발 경로가 CC를 조용히 누락 | `Projectile._checkEnemyHit`에서 폭발이면 `_detonate`만 타고 `_applyStatus`를 안 거쳐, 폭발 마법에 CC를 붙여도 적용되지 않는다. 현재 그런 마법이 없어 미발현. 폭발+CC 마법을 추가할 때 폭발 경로로 CC를 확장하거나, "explosion과 onHitStatus는 공존 불가" 불변식을 데이터 검증(D2)으로 강제할지 결정. | `../qa/magic-cc-review-issues.md` #5 | 낮음 |
| F16 | ♻️ | 그리드 질의 → 타겟 수집 루프 중복 (`SpellCaster._castNova` ↔ `Projectile._detonate`) | 두 곳이 같은 "반경으로 그리드 질의 → `ExplosionTarget[]` + `EnemyController[]` 병렬 수집" 블록이라 `ExplosionTarget` 필드 변경 시 두 군데를 고쳐야 함. `collectExplosionTargets(cx,cy,r)→{targets,ctrls}` 공유 헬퍼로 추출 가능. frost-nova 디스패치 옵션 B의 의도된 트레이드오프. **완료(feat/inferno, 2026-06-24):** 세 번째 호출부(인페르노 궤도 충돌 `_applyOrbHit`)가 생겨 rule-of-three 성립 → `GameManager.collectTargetsInRadius(cx,cy,r)→{targets,ctrls}`로 수집 서브루프를 추출, `_castNova`·`Projectile._detonate`·`_applyOrbHit`가 공유한다(동작 무변경). dedup 집합 수명 통합(전체 추출)은 §12.1 출력 일반화와 함께 잔여 — 다음 비-발사체 패턴 도입 시 재검토. | `../qa/frost-nova-review-issues.md` M-1, `../qa/inferno-review-issues.md` M2, `../planning/magic-system-mage.md` §12.1 | ✅완료(feat/inferno, 잔여 통합은 보류) |
| F17 | 🐛 | 돌진 Chase/Cooldown 이동에 겹침 가드 부재 — 플레이어와 정확히 겹칠 때 서브픽셀 진동 | `EnemyController._moveLunge`의 Chase·Cooldown 이동은 `MovementLogic.lungeMovement`가 `normalize(toPlayer)`를 반환하는데, 기존 `_followPlayer`에 있는 `dir.lengthSqr()<1`(1px 이내 정지) 가드가 없다. 플레이어와 거의 겹칠 때 매 프레임 방향이 뒤집혀 ~1.6px 코스메틱 진동 가능. 미발현에 가까움(적은 `lungeRange` 200px에서 Windup으로 멈추고, Cooldown 중 정확한 겹침은 드묾). `lungeMovement` 추격 분기 또는 컨트롤러 이동부에 `lengthSqr<1` 가드 추가 + 순수 테스트 1건. | `../qa/enemy-movement-review-issues.md` #1 (S1 인라인 리뷰 2026-06-26) | 낮음 |
| F19 | 🐛📐 | **공유 `_windupActive` 클로버 — "돌진+발사 겸용 적" 텔레그래프 충돌** | `EnemyController`의 `_updateAttackTelegraph`(발사)와 `_updateLungeTelegraph`(돌진)가 같은 `_windupActive`/`_windupBlendVal`에 쓴다. `update()`가 `_move`→`_tickEnemyAttack` 순이라, `movement:'lunge'` **AND** `attack` 블록을 동시에 가진 적이 생기면 공격 경로가 돌진 텔레그래프를 매 프레임 덮어 돌진 점멸을 조용히 억제(에러 없음). **현재 미발현**(겸용 적 없음 — kumiho=kite+발사, kite는 `_windupActive` 미접촉). 12종 로스터에서 겸용 적이 실제 생길 때(S2b/S3) 처리: `reset()`에 lunge+attack 동시 선언 경고/assert, 또는 공격용 별도 `_attackWindupActive`를 `_updateTint`에서 OR. | `../qa/enemy-projectile-review-issues.md` I-1 (S2a 리뷰 2026-06-28) | 낮음(미발현) |
| F20 | 🔧 | **kite 정착-vs-사거리 불변식 테스트 + `_fireProjectileFn` 죽은 가드 정리** | (a) 유격 적은 `preferredRange + KITE_DEADZONE_BAND ≤ attack.range`라야 정착점이 발사 사거리 안이다(구미호 360 ≤ 420으로 성립). 어기면 적이 사거리 밖에 정착해 거의 안 쏜다 — 두 필드 보유 시 이 불변식을 단언하는 데이터 정합 테스트 추가(D2 인접). (b) `EnemyController._fireProjectileFn` null 가드 주석이 "풀 미연결" 케이스를 말하나 실제 그 케이스는 `EnemySpawner._fireEnemyProjectile`가 처리 — 주석 정리(무해 방어 코드). | `../qa/enemy-projectile-review-issues.md` M-1·M-4 (S2a 리뷰 2026-06-28) | ✅완료(feat/enemy-multishot, 2026-06-30) |
| F18 | 🎨 | 글로서리 "창"(window 직역) 용어 → "구간" 통일 | i-frame 용어집 항목이 영어 *window*를 "보호 창"으로 직역(`glossary.md:151`). 한국어 단독 "창"은 窓(창문)·槍(무기)로 먼저 읽혀 시간 스팬 의미로는 비관용적이다. "무적 **구간**"(범용·표준)이 더 명확하고, i-frame 길이를 "피격 틱"으로 부르는 네이밍과도 정합. 동작 무영향 문서 용어 정리 — 다른 글로서리·QA 문서까지 일괄 점검. | 이 대화(2026-06-28), `docs/development/glossary.md:151` | ✅완료(feat/player-iframe, 2026-06-28) |
| F21 | ♻️ | `radialDirections` 부분 확산(spread<360) 비대칭 — JSDoc 경고 또는 중심 분포 변형 | `FireGeometry.radialDirections`는 aim에서 한쪽(CCW)으로만 분포해, `spread<360`이면 aim이 호의 **가장자리**가 된다(`fanDirections`는 중심 분포라 대비). 유일 소비자 물귀신이 360을 써 완전 등분이라 미발현. 부분 호 소비자가 생기면 발현 → JSDoc 경고 한 줄 또는 중심 분포 변형. | `../qa/enemy-multishot-review-issues.md` M1 (S2b 리뷰 2026-06-30) | 낮음(미발현) |
| F22 | ♻️ | 적 부채꼴 기본각 `?? 0` 스택 footgun + `origin` 라이브 참조 계약 주석 | (a) `EnemyController._fireProjectile`에서 `projectile_fan`인데 `spreadAngleDeg`가 빠지면 N발이 offset 0으로 겹쳐 발사(부채꼴→단발). 이무기 항상 지정(34)이라 미발현 — fan 타입에 `spreadAngleDeg` 사실상 필수화하거나 "0=스택 의도" 주석. (b) `_fireProjectile`의 `origin`은 노드 내부 벡터 라이브 참조라 "즉시 소비·저장 금지" 계약 주석을 못 박으면 참조 보관 사고 예방. | `../qa/enemy-multishot-review-issues.md` M2·Rec (S2b 리뷰 2026-06-30) | 낮음(미발현) |
| F23 | ♻️🔧 | `KITE_DEADZONE_BAND`를 `MovementLogic`로 추출해 컨트롤러·테스트 공유 | F20 데이터 테스트가 cc 의존 상수(40)를 하드코딩 미러링해 밴드 튜닝 시 테스트가 조용히 드리프트할 수 있다. 그 상수는 순수 `MovementLogic.kiteDirection(band)`로 흘러가는 값이라, `MovementLogic.ts`(또는 순수 상수 모듈)로 올려 `EnemyController`·테스트가 같은 출처를 import하면 드리프트가 원천 제거된다. 단순 미러링이라 현재는 안전. | `../qa/enemy-multishot-review-issues.md` M3 (S2b 리뷰 2026-06-30) | 낮음 |
| F24 | ♻️ | **`GameManager.instance` 접근 null 가드 컨벤션 불일치 정리** — 코드베이스에 두 패턴이 공존한다. `EnemySpawner:104`·`WaveManager:46`은 `if (!GameManager.instance) return;`를 선행하고, 엔티티(`SpellCaster`·`EnemyController`·`PlayerController` + 신규 두 발사체)는 `GameManager.instance.state`를 직접 읽는다. 신규 리스크는 아니다 — 엔티티는 스폰 이후에만 존재해 그 시점엔 `instance`가 항상 세팅돼 있고, null 구간은 씬 teardown(`onDestroy`)뿐인데 이는 기존 엔티티 가드와 동일 노출이다. 전역적으로 한 컨벤션(선행 null 체크 유/무)으로 통일할지 결정. | `../qa/projectile-pause-guard-review-issues.md` M2 (코드 리뷰 2026-07-01) | 낮음 |
| F25 | 🐛 | `HudFormatLogic` 비유한 입력 가드 — `formatTimer(NaN)→"NaN:NaN"`·`formatTimer(Infinity)→"Infinity:NaN"`·`barRatio(NaN,·)→NaN`(→`ProgressBar.progress`로 전파) | 현재 호출자(`gameTimer`·`playerHp/maxPlayerHp`·`currentXp/requiredXp`)는 전부 유한이라 **미발현**. `max=Infinity`는 이미 0 반환으로 처리됨. `Number.isFinite` 가드(→`"00:00"`/`0`) + 순수 테스트 추가. FireGeometry R1 가드와 같은 결. | `../qa/hud-layout-review-issues.md` M2 (코드 리뷰 2026-07-02) | 낮음(미발현) |

---

## G. 성능 · 스케일 (대량 적 — ~~동시 적 수 상한 제거의 전제~~ → **2차 이월, 2026-07-02**)

> **2차 이월(2026-07-02 방향 전환):** 적을 더 안 늘리기로 해 현재 `maxEnemies` 캡으로 성능이 안전하다 → 대량 적 성능 트랙(G1)은 **2차로 미룬다.** 단, 완성도 작업 중 실제 프레임 드랍이 관측되면 그 시점에 재검토한다(로드맵 v0.3 스코프 경계). 아래는 착수 시 참조 기록.
>
> 동시 적 수 상한(`maxEnemies`)은 설계 문서(`enemy-system.md` §8)에 없는 비공식 구현 스로틀이고, 지금 난이도 조절과 성능 안전망 두 역할을 겸하고 있다(2026-06-16 확인). 상한을 없애려면 그 두 역할을 의도적으로 대체해야 한다 — 아래 G1이 그 묶음이다. "수백 마리 적도 프레임 드랍 없이"가 목표(사용자 우선순위).

| # | 태그 | 항목 | 맥락 · Why | 출처 | 우선 |
|---|------|------|-----------|------|------|
| G1 | 🔧📐 | **동시 적 수 상한 제거 + 대량 적 성능 슬라이스** — (a) `maxEnemies` 캡 제거 + 의도적 스폰 속도 곡선으로 난이도 대체, (b) 공간 그리드 순수 모듈(`logic/SpatialGrid.ts`)로 충돌·최근접·AoE·체인·빔 질의를 O(p×n)→~O(p+n)로, (c) 핫패스 할당 제거(스크래치 Vec3·발사체 `[...enemies]` 복사 제거·제곱거리·`unregisterEnemy` swap-remove·Color 캐시[F6 흡수]), (d) 적/발사체 스프라이트 아틀라스 배칭(드로우콜), (e) 풀 idle 보관 한도/제자리 리셋(B6 흡수) | 현재 전수 비교(all-pairs) 구조라 ~100마리에서 흔들리고 300+에서 깨짐. 병목 순서: 할당/GC > `Projectile._checkEnemyHit` O(p×n)+배열복사 > 드로우콜 > `GameManager.unregisterEnemy` O(n) splice. 그리드 + 할당 위생 + 배칭으로 수백~1000마리 60fps 달성 가능(이 장르 표준 기법). 토대 우호적(순수 로직 분리·풀링 기존). **마법 효과 타겟팅은 전부 반경/라인 질의라 그리드가 모든 효과 슬라이스에 공유 이득.** 적 발사체(미래)는 대상이 플레이어 1명이라 단일 대상 O(e)로 쌈 — 다대다는 그리드가 이미 커버. | `sessions/2026-06-16-magic-explosion-plan.md` §3(그리드-레디 노트), `EnemySpawner.ts:69-70`, `Projectile.ts:68`, `GameManager.ts:90`, `EnemyController.ts:212`, [B6]·[F6]·[F4] 흡수 | 높음 |

> **S1과의 접점:** S1(`magic-explosion`)의 `selectExplosionHits`는 후보 적 목록을 인자로 받게 설계해, 지금은 전체 목록·나중엔 그리드 질의 결과를 같은 인터페이스로 넘긴다(재작업 없이 그리드-레디). G1 착수 전까진 폭발 테스트용으로 인스펙터에서 `maxEnemies`만 임시로 올린다(비커밋).
>
> **G1을 3개 슬라이스로 분할(2026-06-17):** G1은 한 슬라이스로 크고 (a)가 난이도 곡선이라는 게임 디자인 결정을 품어, (d) 배칭은 스프라이트 아틀라스 아트가 선행돼야 해서 분할했다.
> - **S1 — 공간 그리드 코어** (`feat/spatial-grid`, 완료 — PR #36): (b) `logic/SpatialGrid.ts` 희소 해시 격자 + 충돌·폭발을 그리드 질의로 전환(배열복사 제거·O(p×n)→O(p+n)·제곱거리). `maxEnemies`는 유지. → `sessions/2026-06-17-spatial-grid-plan.md`
> - **S2 — 할당·레지스트리 위생** (대기): (c 잔여) `unregisterEnemy` swap-remove + Color 캐시(F6 흡수) + (e) 풀 보관 한도/제자리 리셋(B6 흡수) + **그리드 신규 할당 출처 정리** — `SpatialGrid` 재구축·질의가 프레임마다 엔트리 객체·버킷 배열·셀 키 문자열·결과 배열을 새로 만든다(스크래치 재사용/제자리 리셋 검토). 출처: spatial-grid 코드 리뷰 2026-06-17.
> - **S3 — 캡 제거 + 스폰 곡선** (대기): (a) `maxEnemies` 상한 제거 + 난이도 스폰 속도 곡선 + 멀리 떨어진 적 컬링.
> - **(d) 배칭**은 아트 단계(스프라이트 아틀라스 선행)로 분리.
>
> **미래 그리드 소비처:** `SpellCaster._findNearestEnemy`는 시전당 전역 최근접이라 여전히 all-pairs(프레임당 발사체 루프 아님 — 정당한 비스코프). 그리드 최근접은 확장-링 탐색이 필요하다. 마법 효과 레이어(A1)의 노바·체인·빔 타겟팅과 함께 그리드로 묶을 후보. 출처: spatial-grid 코드 리뷰 2026-06-17.

---

## H. UI 렌더 / 레이어 (✅ 완료 — `card-layer-fix`, PR #35)

> magic-explosion 7단계 인게임 테스트(2026-06-17)에서 발견. 레벨업 카드 선택 패널 위로 적·플레이어가 겹쳐 보임. **근본 원인:** 씬이 단일 Canvas + 단일 카메라(`main.scene` cc.Camera 하나, visibility=DEFAULT+UI_2D) 구조라 2D 렌더 순서가 **Canvas 자식 배열 순서**로 정해진다. 그런데 적은 `EnemySpawner.ts:49,55`에서 `playerNode.parent`(=Canvas)에 **런타임 `addChild`** → 항상 배열 맨 뒤(=위)로 붙는다. 따라서 **에디터에서 카드 패널을 마지막 자식으로 옮기는 것만으로는 안 고쳐진다**(스폰된 적이 또 뒤에 붙음). 레벨업 중에는 새 적이 안 생기지만(`GameManager.enterLevelUp`→`LevelUp`, `EnemySpawner.update` state 가드), 정공법으로 분리하기로 결정.

| # | 태그 | 항목 | 맥락 · Why | 출처 | 우선 |
|---|------|------|-----------|------|------|
| H1 | 🎨🔧 | **UI 항상-위 렌더 — UI 카메라 + 레이어 분리** | 결정된 접근(2026-06-17): 게임 카메라는 DEFAULT만(priority 0), 신규 **UI 카메라**는 UI_2D만(priority↑, clearFlags=DEPTH_ONLY)으로 위에 렌더. HUD·GameOverPanel·CardSelectPanel을 UI_2D 레이어로 통일(현재 HUD는 UI_2D=33554432인데 CardSelectPanel은 DEFAULT=1073741824로 어긋나 있음 — 이 불일치가 패널만 가려진 한 원인). 계층/런타임 append와 무관하게 UI가 항상 위. Cocos 카메라/레이어 API는 구현 시 Context7로 확인. | 이 슬라이스(magic-explosion) user-verification 인게임 테스트 (2026-06-17) | ✅완료(card-layer-fix) |

> **같이 처리 후보:** [F8] 카드 설명 라벨 텍스트 잘림 — 같은 `CardSelectPanel`·씬 UI를 건드리므로 `card-layer-fix` 슬라이스에서 함께 닫는 게 합리적.

---

## I. 일시정지(LevelUp) 상태 정합성

> 레벨업 카드 선택은 `GameManager.enterLevelUp()`이 `GameState.LevelUp`으로 전환해 게임을 멈춘다(`GameManager.ts:220`). 멈춤은 각 시스템이 `update()`에서 `state !== Playing`을 직접 확인하는 방식이라(전역 director pause가 아님), 가드를 안 단 컴포넌트는 일시정지 중에도 계속 동작한다. enemy-multishot 7단계 인게임 테스트에서 발견.

| # | 태그 | 항목 | 맥락 · Why | 출처 | 우선 |
|---|------|------|-----------|------|------|
| I1 | 🐛 | **날아가던 발사체가 LevelUp 일시정지를 무시 — `Projectile`·`EnemyProjectile`의 `update()` 상태 가드 누락** | 카드 선택 중 `SpellCaster`(`:154`)·`EnemyController`(`:218`)·`EnemySpawner`·`WaveManager`는 상태 가드로 멈추는데, **이미 발사된 발사체 두 종류는 `update()`에 가드가 없어 계속 이동·명중**한다. (a) `EnemyProjectile.update()`(`:68`) — 적 발사체가 일시정지 중에도 플레이어로 날아가 `damagePlayer`가 발생(메뉴 중 피격 — 공정성 문제). (b) `Projectile.update()`(`:84`) — 플레이어 발사체가 일시정지 중에도 이동·명중하고 `_detonate`로 폭발 데미지까지 낸다. **폭발은 별도 컴포넌트가 없고 이 경로(+노바·궤도)뿐이라, 노바·궤도는 `SpellCaster` 가드로 이미 멈추고 직격 폭발만 이 가드 추가로 함께 닫힌다 — 폭발 전용 항목 불필요.** 적 돌진(`_moveLunge`)·접촉 데미지·적 발사 트리거는 `EnemyController.update`의 `:218` 가드 *뒤*에서 호출되므로 **이미 정상적으로 멈춘다(버그 아님)**. S2a 단발(구미호)은 발사체가 빨리 사라져 미발현에 가까웠고, S2b 물귀신 확산 8발(느림·다수)에서 가시화됐다(인과 아닌 노출 계기 — 두 파일 모두 이번 슬라이스 diff 밖, `EnemyProjectile`은 S2a `498044e`·`Projectile`은 그 이전 도입). **수정:** 두 `update()` 맨 앞에 `if (GameManager.instance.state !== GameState.Playing) return;` 추가 + `GameState` import(`'../data/GameTypes'`). 작은 독립 fix 브랜치로 처리 가능. **곁가지:** `EnemyController._updateDeath`/`_updateFlash`는 가드 앞이라 일시정지 중에도 진행되지만 순수 연출(사망 팝·피격 점멸 — 데미지·XP 무영향)이라 별건. | 이 대화(2026-07-01), enemy-multishot 7단계 인게임 테스트. `Projectile.ts:84`, `EnemyProjectile.ts:68`, `GameManager.ts:220` | ✅완료(projectile-pause-guard) |
| I2 | 🐛 | **`XPItemController.update`가 LevelUp 일시정지 중 픽업 반경 내 XP를 흡수** — `update()`(`:51`)에 `state !== Playing` 가드 없음. 단 이 컴포넌트는 **이동하지 않고** 플레이어까지 거리만 재 흡수하며, 레벨업 중엔 플레이어도 정지(`PlayerController` 가드)라 상대 거리가 정적이다. 유일한 관측 효과는 *이미 픽업 반경 안*에 있던 오브가 정지 프레임에 흡수되는 것뿐이다(경험치 획득 — 무해, 메뉴는 모달). I1 발사체 공정성 버그와 무관한 **기존 동작**이라 projectile-pause-guard에서 의도적 제외. 닫으려면 `XPItemController.update` 맨 앞에 같은 가드(+`GameState` import) 추가. | `../qa/projectile-pause-guard-review-issues.md` M1 (코드 리뷰 2026-07-01) | 낮음 |
| I3 | 🐛🎨 | **정지한 발사체가 레벨업 카드 선택 패널 위로 렌더돼 카드 글씨를 가림** — projectile-pause-guard(I1)로 발사체가 일시정지 중 화면에 멈춰 서면서 가시화된 **레이어 버그**(인과 아닌 노출 계기). 적 발사체(및 플레이어 발사체)가 UI(카드 선택 패널)보다 **위**에 그려져, 멈춘 발사체가 카드에 겹치면 이름/설명 텍스트를 가린다. **발사체 노드를 덱(카드 패널) UI 뒤로 렌더**해야 한다. 기술 축은 H1(UI 카메라 + 레이어 분리, card-layer-fix)과 동일 — 발사체가 게임 Canvas(DEFAULT, UICamera 아래)에 붙는지, 혹은 Layer가 UI_2D로 새는지 점검. 정상 플레이 중엔 전체 화면 UI가 없어 눈에 안 띄지만 레이어 배정 자체는 항상 존재하는 문제. | 이 대화(2026-07-01), projectile-pause-guard 7단계 인게임 테스트 | 중 |

---

## J. v1 완성도 — 맵·스토리·플로우·UI·메타 (2026-07-02 신설, v1 새 주력)

> **성격:** 마법·적 동결 후 v1의 남은 '넓이'를 채우는 테마(로드맵 v0.3 방향 전환). 아래는 로드맵 §7·§13에 이미 잡혀 있던 완성도 항목을 **스캐폴드로 옮겨 온 것**이며, 각 항목의 **현재 구현 현황 감사 + 슬라이스 분해 + 우선순위**는 후속 `/office-hours` 세션에서 확정한다. 지금은 무엇이 남았는지 한눈에 보기 위한 목록이지, 순서를 확정한 계획이 아니다.
>
> **현황 미확인 주의:** 걷는 해골 단계에서 menu/main/result 씬과 HUD·게임오버 패널 골격은 이미 있다. 아래 항목 중 일부는 골격만 있고 미완일 수 있으므로, office-hours 첫 순서로 현황을 감사한 뒤 "신규 vs 마감"을 가른다.

| # | 태그 | 항목 | 맥락 · Why (로드맵 출처) | 우선 |
|---|------|------|------------------------|------|
| J1 | 🎨🔧 | **맵/배경 구성** — 단일 아레나 배경(타일맵), 경계·카메라 범위, 시각적 밀도 | 현재 배경이 placeholder 수준. 로드맵 §7 "배경 타일맵(단일 아레나 1종)". 아트 파이프라인(픽셀) 확정과 연동. | office-hours 확정 |
| J2 | ✨📐 | **전체 게임 플로우** — 20분 타이머 + 클리어 조건, 게임오버 → 결과 화면 → 재시작/메뉴 복귀 | 로드맵 §7 "20분 타이머/클리어 조건", "게임오버 + 결과 화면". 골격(GameOverPanel) 존재 여부·완성도 감사 필요. | office-hours 확정 |
| J3 | ✨🔧 | **메타 — 메인 메뉴 + 세이브 + 도감** — 시작/도감/설정 메뉴, localStorage 세이브(클리어 수·도감·설정), 해금 도감 | 로드맵 §7 "메인 메뉴", "도감", "세이브(localStorage)". menu.scene 골격 존재. | office-hours 확정 |
| J4 | 🎨🔧 | **UI 완성도** — 현황 감사 + 장르 표준 요소 리스트(P0~P2)로 상세화 완료 → **`../design/ui-completeness-plan.md`** 참조. HP/XP 바·마법 아이콘 행·일시정지 메뉴·결과 통계·설정·도감·세이브 등. | 로드맵 §7 "UI 에셋". 2026-07-02 UI 기획 문서로 리스트화(감사+갭). 슬라이스 분해·순서는 office-hours 몫. | office-hours 확정 |
| J5 | ✨ | **스토리 구성** — 인트로 텍스트(판타지 영웅 소환 시나리오), 최소 서사 전달 | 로드맵 §2 시나리오, §7 "시나리오 컷씬(인트로 텍스트만)". 컷씬은 v1 제외, 인트로 텍스트 수준. | office-hours 확정 |
| J6 | 🎨 | **사운드** — BGM 1-2종 + SFX 15-20종(히트·픽업·UI·마법 발사) | 로드맵 §7·§13(13주 사운드). 로열티 프리 또는 AI 생성. | office-hours 확정 |

> **J4 진행 — HUD 레이아웃·바·테마 토대(첫 분해):** `feat/hud-layout` 슬라이스가 J4의 첫 조각으로 HUD 바 승격 + 목업(`../decisions/hud-layout.html`) 기준 전체 레이아웃 + 테마/해상도 토대를 깐다(계획: `sessions/2026-07-02-hud-layout-plan.md`). 이 슬라이스가 청사진 자리만 잡고 **후속으로 남긴** 사항: ① 스킬 그리드 쿨다운 라디얼(발사 후 회색 시계형, 마법 쿨다운 데이터 배선 필요·사용자 확정 비전) ② 미니맵 실제 기능(v2/이월) ③ 보스 체력바 데이터 배선(v1 무보스, v2) ④ 분할 XP 바 룩(`/design-consultation`). 근거·범위는 그 계획 §2 OUT 참조.

---

## 승격됨 / 완료 (히스토리)

- ~~F25: 근접 휘두르기 마커 반각 클램프(89°) vs `coneHitsTarget` 무제한 각 비대칭~~ → **해결**: enemy-melee-sweep 슬라이스 내 리워크에서 마커를 스프라이트 스케일 → **Graphics 섹터(호)** 방식으로 전환하며 소멸. 이제 마커가 `arc(-coneAngleDeg/2, +coneAngleDeg/2)`로 실제 각을 그려(클램프 없음) 어떤 각도에서도 `coneHitsTarget`과 정합한다. 피처 테스트가 "호 스팬 = coneAngleDeg"를 단언한다. 출처: `../qa/enemy-melee-sweep-review-issues.md` M1, `sessions/2026-07-01-enemy-melee-sweep-plan.md`.
- ~~I1: 날아가던 발사체가 LevelUp 일시정지를 무시~~ → **완료**: `projectile-pause-guard` 슬라이스(PR #47)에서 `Projectile.update()`·`EnemyProjectile.update()` 맨 앞에 `if (GameManager.instance.state !== GameState.Playing) return;` 가드를 추가해, 카드 선택 일시정지 중 발사체 이동·명중·`damagePlayer`·직격 폭발을 멈췄다. 코드베이스 기존 가드(`SpellCaster:154`·`EnemyController:218`)와 동일 패턴. 후속으로 같은 테마의 I2(`XPItemController` 흡수)·I3(정지 발사체 렌더 레이어)와 F24(null 가드 컨벤션)를 열어 둠. 출처: `sessions/2026-07-01-projectile-pause-guard-plan.md`, `../qa/projectile-pause-guard-review-issues.md`.
- ~~`projectileCount` 미사용 필드 (spells.json에 있으나 미사용)~~ → **완료**: 발사체 수 강화 슬라이스(`feat/projectile-count`)에서 다발·부채꼴 발사에 사용. 출처: `sessions/2026-06-01-magic-followups.md` §2 4번째 항목.
- ~~`HIDE_CATEGORY_UPGRADE_CARDS = false` 복원 (passive-effects가 QA용으로 켜둔 DEV 플래그)~~ → **완료**: `feat/projectile-count` 구현 진입 첫 작업으로 복원(현재 `DeckManager.ts`에서 플래그 제거됨). 출처: `../qa/passive-effects-review-issues.md` #1, `sessions/2026-06-10-projectile-count-plan.md` §113.
- ~~H1: UI 항상-위 렌더 — UI 카메라 + 레이어 분리~~ → **완료**: `card-layer-fix` 슬라이스(PR #35)에서 게임/UI를 두 Canvas로 분리(게임 `Camera`/DEFAULT/priority 0, `UICamera`/UI_2D/priority 1·DEPTH_ONLY)해 닫음. 단일 Canvas+2카메라 시도는 게임 월드가 그 Canvas의 UICamera에서 컬링돼 폐기하고 공식 두-Canvas 패턴을 채택. 출처: `sessions/2026-06-17-card-layer-fix-plan.md`.
- ~~F8: 카드 설명 라벨 텍스트 잘림~~ → **완료**: 같은 슬라이스에서 `CardDescLabel_0/1/2`의 overflow를 SHRINK로 바꿔 양끝 잘림을 해소. 출처: 위 계획 문서, `../qa/card-layer-fix-test.md` §2-3.
- ~~F18: 글로서리 "창"(window 직역) 용어 → "구간" 통일~~ → **완료**: feat/player-iframe 브랜치에서 i-frame의 "보호 창"·"무적 창"·"i-frame 창" 등 시간 스팬을 뜻하던 "창"(window 직역)을 모두 "구간"으로 통일(`glossary.md`, `player-iframe-test.md`, `player-iframe-review-issues.md`, `2026-06-27-player-iframe-plan.md`). 단어 속 "창"(창백한·얼음 창·확인 창 등)은 보존. 출처: 이 대화(2026-06-28).
- ~~F14: CC 다중 타이머 모델 전환~~ → **완료**: magic-S3 슬라이스(PR #38)에서 단일 슬롯(강도·지속 max/max)을 강도별 독립 타이머로 재작성 — 동시 감소·"가장 센 강도" 적용·재적중 시 해당 강도만 max 재충전. 슬로우(아이스 미사일)가 두 번째 강도로 들어오며 약하고 긴 소스가 강한 정지의 잔여를 늘리던 설계 결함을 해소. A1의 CC 축 일부(슬로우)도 이 슬라이스에서 닫힘(A1 자체는 잔여 효과로 계속 열림). 출처: `sessions/2026-06-21-magic-slow-plan.md` §2.1, `../qa/magic-slow-review-issues.md`.
- ~~F20: kite 정착-vs-사거리 불변식 테스트 + `_fireProjectileFn` 죽은 가드 정리~~ → **완료**: feat/enemy-multishot(#46)에서 (a) 실 `enemies.json`을 로드해 `movement: kite` + `attack` 보유 적 전부가 `preferredRange + KITE_DEADZONE_BAND(40) ≤ attack.range`를 만족하는지 단언하는 데이터 정합 테스트를 추가(구미호 360≤420·이무기 380≤460·물귀신 300≤520), (b) `EnemyController._fireProjectileFn` null 가드 주석을 "풀 미연결은 `EnemySpawner._fireEnemyProjectile`가 막고 이 체크는 방어용"으로 정정. 출처: `sessions/2026-06-29-enemy-multishot-plan.md` §8, `../qa/enemy-projectile-review-issues.md` M-1·M-4.
