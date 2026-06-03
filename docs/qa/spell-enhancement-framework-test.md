# QA — per-spell/분류 강화 프레임워크

> **브랜치:** feat/spell-enhancement-framework
> **관련 기획:** [magic-system-mage.md](../planning/magic-system-mage.md) § 6.1, § 7.1~7.4, § 8
> **스코프:** 강화 옵션 중 **데미지·쿨다운** 2종만 실제 적용. 발사체수는 후속(`projectile-count-upgrade`),
> 범위·지속시간은 `UpgradeOption` enum·매트릭스에만 존재(효과 레이어 미구현 → no-op).

---

## 1. 변경 요약

- **3-tier 강화 위계(개별 > 분류 > 전역):** 기획 § 7.3 합산식 `× (1+개별) × (1+분류) × (1+플레이어)`대로 세 트랙 모두 존재. `EnhancementLogic`(순수 로직)이 개별·분류(옵션별 0~4레벨, 트랙별 곡선) + 전역(플레이어, 카드 누적 보너스)을 곱셈 합산해 마법별 데미지/쿨다운 배율 산출. **전역은 위계상 가장 작아 수치를 대폭 낮춤(±20% → placeholder ±5%, 최종 밸런싱은 § 10).**
- **전역 카드 유지:** `damage_boost`/`cooldown_reduce`는 유지하되 효과 수치를 낮춤. `DeckLogic`은 비전투 패시브(maxHp)만 담당.
- **카드 동적 생성:** 레벨업 카드 풀에 "선택 마법 강화"(보유 마법 × 옵션)·"분류 강화"(분류 × 옵션) 카드를 동적 합성. **레벨 4 도달 옵션 제외(§6.2), support 분류 일반옵션 제외(§7.5).** 추첨은 기존대로 균등 무작위(가중치·웨이브 게이팅은 §10 후속).
- **적용 경로:** `SpellCaster`가 발사 시 `DeckManager.damageFactor(spell)`/`effectiveCooldown(spell)`(3-tier 포함)를 사용.
- **[DEV] 강화 디버그 로그:** 카드 픽 직후 `CardSelectPanel`이 보유 마법별 레벨·배율·최종 DMG/CD·DPS를 `console.table`로 출력(`cc/env`의 `DEV` 게이팅 → 에디터/프리뷰에서만, 릴리스 제거). 수치는 순수 `EnhancementLogic.debugSnapshot`이 산출.

---

## 2. Impact Map (회귀 테스트 기준)

| 변경 파일 | 변경 내용 | 확인 범위 |
|---|---|---|
| `data/GameTypes.ts` | `UpgradeOption`/`UpgradeTrack`/`IUpgradeEffect`, `ICardData.type`에 `'upgrade'` 추가, `damageMult`/`cooldownMult`는 전역(플레이어) 보너스로 의미 갱신 | 타입 컴파일 |
| `logic/EnhancementLogic.ts` | 신규 — 개별/분류 레벨 + 전역 보너스·트랙별 곡선·매트릭스·`buildUpgradeCards` | 단위 테스트 전수 |
| `logic/DeckLogic.ts` | 마법 damage/cooldown 합산을 EnhancementLogic으로 이관(비전투 패시브 maxHp만) | `DeckLogic.test.ts` 갱신 |
| `systems/DeckManager.ts` | `EnhancementLogic` 소유, `applyCard` 라우팅(개별/분류/전역/HP), `damageFactor`/`cooldownFactor` 노출, `drawCards`가 upgrade 카드 합성 | 인게임 카드 적용·발사 |
| `components/SpellCaster.ts` | 발사 시 3-tier(개별×분류×전역) 배율 적용 | 인게임 데미지·쿨다운 |
| `ui/CardSelectPanel.ts` | 설명 중첩키 해석 일반화(`spell`/`option`/`category`) | 카드 라벨 표시 |
| `resources/data/cards.json` | 전역 강화 카드 2종 수치↓(유지), hp_up 유지 | 카드 풀 |
| `resources/i18n/ko.json`·`en.json` | 강화 옵션·upgrade 카드 키 추가, 전역 카드 라벨 수치 갱신 | 카드 라벨 |

---

## 3. 씬/프리팹 변경 사항

**없음.** `EnhancementLogic`은 기존 `DeckManager` 싱글톤에 포함되므로 신규 노드·프리팹·컴포넌트가 없다.

## 4. 에디터 연결 체크리스트

**없음.** 신규 `@property`가 없어 인스펙터 추가 배선이 필요 없다. (기존 `DeckManager`·`SpellCaster`·`CardSelectPanel` 노드 구성 유지)

---

## 5. 자동 테스트로 검증 (`tests/logic/SpellEnhancementFramework.test.ts`)

> **GREEN 근거:** 피처 테스트 17/17 + 전체 스위트 85/85 통과 (코드리뷰 수정 반영, HEAD `af15cd2`). 검증 4종(cso/ts/lint/review) 통과 → user-verification.

- [x] 초기 레벨 0, 배율 1.0
- [x] `raise`가 레벨을 +1 하고 cap(4) 도달 시 `false` 반환
- [x] `factor` = 개별 곡선 × 분류 곡선 × (1 + 전역 보너스) (3-tier 곱셈 §7.3)
- [x] **강화 위계: 개별 > 분류 > 전역** (레벨1 1회 강화 기준)
- [x] 전역 강화는 모든 마법에 공통 적용
- [x] 개별·분류 트랙 독립 관리
- [x] `damageFactor`/`cooldownFactor` 편의 접근
- [x] `buildUpgradeCards`: 보유 마법 × {damage,cooldown} 개별 카드 + fire/ice/lightning × {damage,cooldown} 분류 카드 생성
- [x] maxed(레벨4) 옵션은 카드 풀에서 제외
- [x] support 분류·support 마법은 일반 옵션 카드에서 제외(§7.5)
- [x] upgrade 카드는 한글 표시 문자열 없이 키/params만 산출(i18n)
- [x] `debugSnapshot`: 마법별 레벨·배율(개별×분류×전역)·최종 DMG/CD·DPS + 전역 보너스 산출, rows 순서 보존

---

## 6. 수동 테스트 체크리스트 (인게임)

> 코드로 검증 불가한 인게임 동작만. 에디터에서 게임 실행 후 확인.

- [x] 레벨업 카드 패널에 "선택 마법 강화"(보유 마법명 + 데미지/쿨다운) 카드가 등장한다
- [x] 레벨업 카드 패널에 "분류 강화"(화염/얼음/번개 + 데미지/쿨다운) 카드가 등장한다
- [ ] 카드 라벨이 활성 언어로 올바르게 표시된다(ko/en 전환 시 마법명·옵션명·분류명 모두 번역)
- [ ] **개별 데미지 강화**를 고르면 **그 마법만** 데미지가 증가(다른 마법 불변)
- [ ] **분류 데미지 강화**를 고르면 **그 분류 마법 전체** 데미지가 증가
- [ ] 개별+분류 데미지 강화를 함께 받으면 곱셈으로 합산(체감상 더 큼)
- [ ] 위계 체감: 같은 1회 강화라도 개별 > 분류 > 전역(`damage_boost`) 순으로 증가폭이 크다
- [ ] **쿨다운 강화**를 받으면 해당 마법/분류의 발사 간격이 짧아진다
- [ ] 같은 옵션을 4번 받으면(레벨4 도달) 이후 카드 풀에서 그 옵션이 사라진다
- [ ] support 마법(있다면)·보조 분류 카드는 데미지/쿨다운 강화로 등장하지 않는다
- [ ] **[DEV 로그]** 카드 픽마다 콘솔에 `[강화] 픽: …` + `console.table`(개D/분D/배율D/DMG/기본/개C/분C/배율C/CD/DPS)이 찍히고, 강화한 마법/분류의 레벨·배율·최종 수치가 픽에 맞게 갱신된다(위계·곱셈을 눈으로 확인)

### 회귀

- [x] 전역 `damage_boost`/`cooldown_reduce` 카드는 여전히 모든 마법을 강화한다(단, 효과 수치가 대폭 작아짐 — 개별/분류보다 체감 작음)
- [x] "마법 추가" 카드는 기존대로 미보유 마법을 슬롯에 추가한다
- [x] "생명력 강화"(hp_up) 패시브는 기존대로 최대 HP를 올린다
- [x] 신규 마법 추가 후 해당 마법의 개별 강화 카드가 다음 레벨업부터 등장한다
