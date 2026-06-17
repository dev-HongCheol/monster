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

> **현재 상황 메모(2026-06-11):** 마법 시스템은 전체 기획을 슬라이스로 쪼개 진행하다 패턴/강화 트랙만 앞서 나가고 **효과 레이어가 통째로 홀딩**된 상태다. 그래서 가장 큰 덩어리는 아래 **A. 마법 효과 레이어**이며, 강화의 일부 옵션(범위·지속시간)은 곱할 대상이 없어 no-op으로 대기 중이다(A3). 마법 슬라이스를 재개할 때 A1·A2·A3를 함께 묶어야 진행도 치우침이 풀린다.

---

## A. 마법 효과 레이어 (다음 마법 슬라이스군 — 최대 홀딩 덩어리)

| # | 태그 | 항목 | 맥락 · Why | 출처 | 우선 |
|---|------|------|-----------|------|------|
| A1 | ✨ | **마법별 효과 레이어 구현** — 폭발-on-impact / 자기중심 AOE(노바) / DOT / CC(슬로우·빙결) / 호밍 / 체인 / 지정위치 낙하(메테오·썬더스톰) / 무작위 폭풍(블리자드) / 빔 | 현재 패턴 엔진은 `Directional`(직선·부채꼴) 하나뿐. `SpellPatternLogic`의 switch에 case를 추가하는 구조로 설계돼 있다. 마법 10종이 실제 고유 동작을 가지려면 이 레이어가 핵심. 각 마법↔패턴 매핑은 기획서 참조. | [spell-pattern-engine 메모리], `../planning/magic-system-mage.md` | 높음 |
| A2 | ✨ | **적 없을 때 facing 방향 발사**(지속형 마법) | 사거리 내 적이 없으면 현재는 발사 보류 → 블리자드 등 설치/지속형 마법의 효용이 반감. "적 있음=조준 / 없음=facing 방향" 규칙 필요. **선행 과제:** 플레이어가 8방향 이동만 있고 facing 상태가 없음 → facing 정의(마지막 이동 방향?)부터 정해야 함. | `sessions/2026-06-01-magic-followups.md` §1 ⭐ | 높음 |
| A3 | ✨ | **범위·지속시간 강화 활성화** | 강화 프레임워크에 `UpgradeOption`으로 범위·지속시간이 enum·매트릭스에만 존재하고 **no-op**이다. splash/AOE/DOT 효과 레이어(A1)가 생겨야 곱할 대상이 생긴다 → A1과 한 묶음. | `sessions/2026-06-03-spell-enhancement-framework-plan.md` §42, [spell-enhancement 메모리] | 중 |
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
| D2 | 🔧 | DataManager JSON `as T` 캐스팅 → 스키마 검증(zod/assertion) | 필드 누락 시 런타임에 undefined 유입 가능. 현재 적 1종이라 위험 낮음, 콘텐츠 늘면 방어 필요. `xpDrop:0` 같은 의도적 0 vs 누락 구분도 포함. | `../qa/xp-drop-per-enemy-review-issues.md` Recommendations | 중 |
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

---

## G. 성능 · 스케일 (대량 적 — 동시 적 수 상한 제거의 전제)

> 동시 적 수 상한(`maxEnemies`)은 설계 문서(`enemy-system.md` §8)에 없는 비공식 구현 스로틀이고, 지금 난이도 조절과 성능 안전망 두 역할을 겸하고 있다(2026-06-16 확인). 상한을 없애려면 그 두 역할을 의도적으로 대체해야 한다 — 아래 G1이 그 묶음이다. "수백 마리 적도 프레임 드랍 없이"가 목표(사용자 우선순위).

| # | 태그 | 항목 | 맥락 · Why | 출처 | 우선 |
|---|------|------|-----------|------|------|
| G1 | 🔧📐 | **동시 적 수 상한 제거 + 대량 적 성능 슬라이스** — (a) `maxEnemies` 캡 제거 + 의도적 스폰 속도 곡선으로 난이도 대체, (b) 공간 그리드 순수 모듈(`logic/SpatialGrid.ts`)로 충돌·최근접·AoE·체인·빔 질의를 O(p×n)→~O(p+n)로, (c) 핫패스 할당 제거(스크래치 Vec3·발사체 `[...enemies]` 복사 제거·제곱거리·`unregisterEnemy` swap-remove·Color 캐시[F6 흡수]), (d) 적/발사체 스프라이트 아틀라스 배칭(드로우콜), (e) 풀 idle 보관 한도/제자리 리셋(B6 흡수) | 현재 전수 비교(all-pairs) 구조라 ~100마리에서 흔들리고 300+에서 깨짐. 병목 순서: 할당/GC > `Projectile._checkEnemyHit` O(p×n)+배열복사 > 드로우콜 > `GameManager.unregisterEnemy` O(n) splice. 그리드 + 할당 위생 + 배칭으로 수백~1000마리 60fps 달성 가능(이 장르 표준 기법). 토대 우호적(순수 로직 분리·풀링 기존). **마법 효과 타겟팅은 전부 반경/라인 질의라 그리드가 모든 효과 슬라이스에 공유 이득.** 적 발사체(미래)는 대상이 플레이어 1명이라 단일 대상 O(e)로 쌈 — 다대다는 그리드가 이미 커버. | `sessions/2026-06-16-magic-explosion-plan.md` §3(그리드-레디 노트), `EnemySpawner.ts:69-70`, `Projectile.ts:68`, `GameManager.ts:90`, `EnemyController.ts:212`, [B6]·[F6]·[F4] 흡수 | 높음 |

> **S1과의 접점:** S1(`magic-explosion`)의 `selectExplosionHits`는 후보 적 목록을 인자로 받게 설계해, 지금은 전체 목록·나중엔 그리드 질의 결과를 같은 인터페이스로 넘긴다(재작업 없이 그리드-레디). G1 착수 전까진 폭발 테스트용으로 인스펙터에서 `maxEnemies`만 임시로 올린다(비커밋).
>
> **G1을 3개 슬라이스로 분할(2026-06-17):** G1은 한 슬라이스로 크고 (a)가 난이도 곡선이라는 게임 디자인 결정을 품어, (d) 배칭은 스프라이트 아틀라스 아트가 선행돼야 해서 분할했다.
> - **S1 — 공간 그리드 코어** (`feat/spatial-grid`, 진행 중): (b) `logic/SpatialGrid.ts` 희소 해시 격자 + 충돌·폭발을 그리드 질의로 전환(배열복사 제거·O(p×n)→O(p+n)·제곱거리). `maxEnemies`는 유지. → `sessions/2026-06-17-spatial-grid-plan.md`
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

## 승격됨 / 완료 (히스토리)

- ~~`projectileCount` 미사용 필드 (spells.json에 있으나 미사용)~~ → **완료**: 발사체 수 강화 슬라이스(`feat/projectile-count`)에서 다발·부채꼴 발사에 사용. 출처: `sessions/2026-06-01-magic-followups.md` §2 4번째 항목.
- ~~`HIDE_CATEGORY_UPGRADE_CARDS = false` 복원 (passive-effects가 QA용으로 켜둔 DEV 플래그)~~ → **완료**: `feat/projectile-count` 구현 진입 첫 작업으로 복원(현재 `DeckManager.ts`에서 플래그 제거됨). 출처: `../qa/passive-effects-review-issues.md` #1, `sessions/2026-06-10-projectile-count-plan.md` §113.
- ~~H1: UI 항상-위 렌더 — UI 카메라 + 레이어 분리~~ → **완료**: `card-layer-fix` 슬라이스(PR #35)에서 게임/UI를 두 Canvas로 분리(게임 `Camera`/DEFAULT/priority 0, `UICamera`/UI_2D/priority 1·DEPTH_ONLY)해 닫음. 단일 Canvas+2카메라 시도는 게임 월드가 그 Canvas의 UICamera에서 컬링돼 폐기하고 공식 두-Canvas 패턴을 채택. 출처: `sessions/2026-06-17-card-layer-fix-plan.md`.
- ~~F8: 카드 설명 라벨 텍스트 잘림~~ → **완료**: 같은 슬라이스에서 `CardDescLabel_0/1/2`의 overflow를 SHRINK로 바꿔 양끝 잘림을 해소. 출처: 위 계획 문서, `../qa/card-layer-fix-test.md` §2-3.
