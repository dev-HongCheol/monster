# 로드아웃 런타임 배선 — 구현 플랜

> **작성일:** 2026-06-01
> **브랜치(예정):** feat/magic-loadout-runtime
> **워크플로우 피처명:** `loadout-runtime` (wf CLI 피처명 — 테스트 파일 `LoadoutRuntime.test.ts`)
> **관련 기획:** [마법 시스템 — 마법사](../../planning/magic-system-mage.md) § 4·§ 5
> **선행 슬라이스:** magic-loadout-core (#13) — `LoadoutLogic` 순수 로직(현재 런타임 미배선)

---

## 0. 목적

직전 슬라이스에서 만든 `LoadoutLogic`(6슬롯)은 아직 어디에서도 쓰이지 않는 dead code다.
이번 슬라이스는 그것을 런타임에 연결해 **플레이어가 보유 마법 전부를 각자 쿨다운으로 자동 발사**하게 만든다.

- 현재: `PlayerController`가 단일 `activeSpellId`(파이어볼) 하나만 발사.
- 목표: 로드아웃에 든 마법 N개가 각자 독립 쿨다운으로 가장 가까운 적에게 자동 발사.

## 1. 스코프 (확정 전제)

| # | 전제 |
|---|---|
| 1 | 로드아웃 시드는 `@property startingSpellIds: string[]` 로 초기화. 카드로 마법 획득(`addSpell` 연결)은 **다음 슬라이스**. |
| 2 | 패턴 없음 — 신규 마법도 "가장 가까운 적에게 단일 직선 발사"(현 파이어볼과 동일). 자기중심 AOE/호밍/체인 등은 후속. |
| 3 | 마법별 **독립 쿨다운**. 이 스케줄링이 순수 로직 단위(테스트 대상). |
| 4 | 전역 강화(`DeckManager.damageMult`/`cooldownMult`)는 모든 마법에 그대로 곱해 적용(현 동작 유지). 개별/분류 강화는 후속. |
| 5 | `bulletPrefab` 단일 유지. 마법별 비주얼 분리 없음(스탯만 다른 발사체). |
| 6 | 신규 마법 2종 추가 — 아이스 미사일·라이트닝 볼트(tier1, linear 스탯만). 16종 전체 카탈로그는 별도 슬라이스. |

**아키텍처 결정:** 발사 책임을 **신규 `SpellCaster` 컴포넌트**로 분리(이상적 토대). `PlayerController`는 이동/입력/HP만.
패턴 시스템이 들어올 때 자연스럽게 확장되는 지점이 됨.

## 2. 변경 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `logic/FireSchedulerLogic.ts` | 신규 (순수) | 마법별 쿨다운 타이머 관리. cc import 없음. |
| `components/SpellCaster.ts` | 신규 (컴포넌트) | `LoadoutLogic` + `FireSchedulerLogic` 소유. 발사 책임 전담. Player 노드에 부착. |
| `components/PlayerController.ts` | 수정 | 발사 로직(`_updateAttack`/`_findNearestEnemy`/`_shoot`/`activeSpellId`/`bulletPrefab`/`bulletParent`) 제거. 이동/입력/HP 게이팅만 유지. |
| `resources/data/spells.json` | 수정 | `ice_missile`, `lightning_bolt`(tier1) 추가. |
| `tests/logic/LoadoutRuntime.test.ts` | 신규 | `FireSchedulerLogic` 단위 테스트(RED 먼저). |

## 3. 순수 로직 설계 — `FireSchedulerLogic`

```ts
export class FireSchedulerLogic {
  private _timers = new Map<string, number>();

  /** 활성 마법들의 타이머를 dt만큼 감소시키고, 로드아웃에서 빠진 마법 타이머는 정리한다.
   *  신규 마법(타이머 없음)은 0으로 초기화 → 즉시 발사 가능. */
  tick(dt: number, activeIds: string[]): void;

  /** 해당 마법이 발사 준비됐는지(타이머 <= 0). */
  isReady(id: string): boolean;

  /** 발사 후 호출 — 타이머를 쿨다운으로 리셋. */
  consume(id: string, cooldown: number): void;
}
```

**의미 보존:** 발사는 적이 있을 때만 일어나므로, 타깃이 없으면 `consume`을 호출하지 않아 쿨다운이 소모되지 않는다(현 `_attackTimer` 동작과 동일 — 적 등장 즉시 발사).

## 4. SpellCaster 프레임 흐름

```
update(dt):
  if !dataReady or state != Playing: return
  scheduler.tick(dt, loadout.spells)
  target = findNearestEnemy()
  if !target: return
  for id of loadout.spells:
    if !scheduler.isReady(id): continue
    spell = DataManager.getSpell(id); if !spell: continue
    cd = spell.cooldown * DeckManager.cooldownMult
    scheduler.consume(id, cd)
    shoot(target, spell.projectileSpeed, spell.damage * DeckManager.damageMult, spell.projectileRadius)
```

- `start()`에서 `DataManager.onReady` 시 `startingSpellIds`로 `loadout.addSpell` 시드.
- `_findNearestEnemy`/`_shoot`는 `PlayerController`에서 그대로 이관.
- Player 노드에 부착하므로 `this.node.position` = 플레이어 위치.

## 5. 데이터 추가 (spells.json)

```json
{ "id": "ice_missile",    "name": "아이스 미사일",  "category": "ice",       "tier": 1, "damage": 18, "projectileSpeed": 450, "projectileRadius": 8, "cooldown": 0.7, "projectileCount": 1 },
{ "id": "lightning_bolt", "name": "라이트닝 볼트",  "category": "lightning", "tier": 1, "damage": 14, "projectileSpeed": 700, "projectileRadius": 6, "cooldown": 0.35, "projectileCount": 1 }
```
> 수치는 임시(밸런싱 단계 확정). `projectileCount`는 이번 슬라이스에서 미사용(패턴 슬라이스에서 의미 부여).

## 6. 테스트 (LoadoutRuntime.test.ts, RED 먼저)

- 신규 마법은 첫 `tick` 후 `isReady === true`(즉시 발사 가능).
- `consume(id, cd)` 후 `isReady === false`; 누적 `tick(dt)`로 cd 경과 시 다시 `true`.
- 여러 마법 타이머 독립(한쪽 consume이 다른 쪽에 영향 없음).
- 로드아웃에서 빠진 id는 `tick`의 `activeIds`에서 제외 시 타이머 정리(재추가 시 즉시 발사).
- `isReady`는 미등록 id에 대해 안전한 기본값.

## 7. 에디터 영향 (QA 문서에서 상세화)

- Player 노드에 `SpellCaster` 컴포넌트 추가.
- `bulletPrefab`/`bulletParent` `@property` 연결을 `PlayerController` → `SpellCaster`로 **이전**.
- `SpellCaster.startingSpellIds`에 시작 마법 설정(예: `["fireball"]` 또는 `["fireball","ice_missile","lightning_bolt"]`로 다중 발사 확인).
- 회귀: 기존 단일 발사가 SpellCaster 경유로도 동일하게 동작하는지.

## 8. 범위 밖 (후속 슬라이스)

- 카드 "마법 추가" → `addSpell` 연결 + 시작 카드 패널.
- 마법 패턴(AOE/부채꼴/호밍/체인/메테오).
- 개별/분류 강화 엔진(곱셈 합산, cap4, 비선형 곡선).
- 16종 전체 카탈로그 + 마법별 비주얼/이펙트.
