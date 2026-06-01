# QA: magic-loadout-core (마법 데이터 모델 + 로드아웃 코어)

> **브랜치:** feat/magic-loadout-core
> **작성일:** 2026-06-01
> **관련 기획:** [마법 시스템 디자인 — 마법사](../planning/magic-system-mage.md) § 1·2·4·6.1
> **성격:** 순수 로직 슬라이스. Cocos 런타임 배선·씬/프리팹 변경 **없음**.

---

## 0. 범위

이번 슬라이스에 포함:
- `GameTypes.ts`: `SpellCategory` enum, `SpellTier` 타입, `ISpellData`에 `category`·`tier` 필드 추가
- `spells.json`: 기존 파이어볼에 `category`·`tier` 부여
- `logic/LoadoutLogic.ts`: 6슬롯 로드아웃 순수 로직 (신규)
- `tests/logic/MagicLoadoutCore.test.ts`: 단위 테스트 (신규, 파일명은 워크플로우 CLI 피처명 규칙)

범위 밖(별도 슬라이스): 16종 마법 전체 데이터, 강화 합산 룰, 카드 추첨, 런타임 배선·시작 카드 패널.

---

## 1. Impact Map

| 변경 파일 | 변경 내용 | 회귀 확인 범위 |
|---|---|---|
| `data/GameTypes.ts` | `SpellCategory`·`SpellTier` 추가, `ISpellData`에 필드 **추가**(기존 필드 유지) | `ISpellData` 소비처: `DataManager.getSpell`, `PlayerController.fire` — 필드 추가만이라 기존 코드 컴파일/동작 영향 없음 |
| `resources/data/spells.json` | 파이어볼 항목에 `category: "fire"`, `tier: 1` 추가 | `DataManager` 로드 시 JSON ↔ `ISpellData` 형상 일치 |
| `logic/LoadoutLogic.ts` | 신규 순수 클래스 | 신규 — 기존 코드 의존 없음 |
| `tests/logic/LoadoutLogic.test.ts` | 신규 테스트 | — |

---

## 2. 씬/프리팹 변경 사항

**없음.** 이 슬라이스는 데이터 타입 + 순수 로직만 다룬다. 노드·컴포넌트 추가 없음.

## 3. 에디터 연결 체크리스트

**없음.** `@property` 연결 변경 없음.

---

## 4. 자동 테스트로 검증 (MagicLoadoutCore.test.ts)

순수 로직이므로 단위 테스트로 전부 커버한다. 사용자 수동 작업 불필요.

검증 동작 (기획 § 4·§ 6.1 근거):
- [ ] 빈 로드아웃은 `count === 0`, `isFull === false`
- [ ] `addSpell(id)`로 마법 추가 시 `true` 반환, `count` 증가, `hasSpell(id) === true`
- [ ] **분류 중복 허용**: 같은 분류의 서로 다른 마법(예: fireball, meteor) 동시 보유 가능
- [ ] **동일 마법 중복 불가**: 이미 보유한 id를 다시 `addSpell` → `false`, `count` 불변
- [ ] 6슬롯 가득 차면 `isFull === true`, 7번째 `addSpell` → `false`
- [ ] `removeSpell(id)`: 보유 중이면 제거 후 `true`, 미보유면 `false`
- [ ] `spells` getter는 내부 배열의 **복사본**을 반환(외부 변형이 내부에 영향 없음)

## 5. 수동 테스트 체크리스트

**없음.** 인게임 동작 변화 없음(로직은 아직 런타임에 배선되지 않음). 런타임 통합은 다음 슬라이스 QA 문서에서 다룬다.
