# 코드 리뷰 — HUD 마법 아이콘 행 (feat/spell-icon-row)

- **리뷰 커밋:** BASE `8c4443c`(origin/main) → HEAD `66ddf13`
- **리뷰 방식:** 집중 자체 리뷰(인라인). 이 슬라이스는 사용자가 서브에이전트 스폰 없이 진행을 택했고(autoplan·코드리뷰 공통) 플랜이 무단 에이전트 스폰을 지양해, 워크플로 12단계의 독립 서브에이전트 디스패치를 인라인 집중 리뷰로 대체했다. Codex는 미설치.
- **결과:** 수정할 코드 품질·타입·버그 이슈 **없음**. 저위험 관찰 1건(비차단, 미수정).

---

## 검토 범위

| 파일 | 검토 관점 | 결과 |
|---|---|---|
| `logic/SpellIconRowLogic.ts` (신규, 순수) | 정확성·엣지·타입 | ✅ 12건 테스트 커버(티어 안정 정렬·null 가드·클램프·빈칸 패딩·라벨 포맷). 버그 없음 |
| `ui/HudController.ts` | 초기화·재빌드 타이밍·컴포넌트 조회·인덱스 정렬 | ✅ 정합. 아래 관찰 1건 |

## 정합성 확인 (버그 아님)

- **재빌드 타이밍:** `_updateSpellRow`의 `_spellRowKey` 서명 비교가 데이터 준비 타이밍 갭을 자연 처리한다 — `DataManager.isReady` 전엔 early-return, 준비 후 로드아웃이 seed되면(빈→`fireball`) 서명이 달라져 재빌드. 초기 build를 latch하지 않아 seed 지연에도 안전.
- **인덱스 정렬:** `buildSpellIconRow` 결과 길이 = `MAX_SLOTS` = `_spellSlots.length`(프리팹/컨테이너 미배선이면 `_spellSlots`가 비어 early-return). `row[i]`가 항상 정의됨.
- **컴포넌트 조회:** `_applySlot`이 `getComponent(Sprite)`(루트)·`getComponentInChildren(Label)`로 찾는 구조를 QA §3.1 프리팹 레시피가 명시(루트 Sprite + 자식 Label). 정합.
- **타입/린트:** `mcp__ide__getDiagnostics` 0건, `biome check` 통과.

## 관찰 (저위험·비차단·미수정)

| # | 태그 | 내용 | 판단 |
|---|---|---|---|
| R1 | ♻️ | `_updateSpellRow`가 매 프레임 `caster.loadout.spells`(getter가 `[...]` 복사본 반환) + `join(',')`으로 서명을 만든다. | 6슬롯 기준 무시할 수준이고, 기존 HUD가 매 프레임 라벨 포맷(`formatNumber`·문자열 보간)을 하는 것과 동일한 성격이라 회귀 아님. 필요 시 로드아웃 버전 카운터/길이+마지막id 비교로 최적화 가능하나 현재 불필요. 성능 위생 슬라이스(백로그 G/F 계열)에서 함께 다룰 후보. |
