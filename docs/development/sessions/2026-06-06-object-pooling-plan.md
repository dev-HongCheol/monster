# 계획: 객체 풀링 — 발사체 (object-pooling)

> - **작성일:** 2026-06-06
> - **브랜치:** feat/object-pooling
> - **상태:** 완료 — PR #27 머지
> - **상위 설계:** [로드맵 v0.2](../../planning/roadmap.md) §7(객체 풀링 — MVP), §9(코드 설계 원칙 "객체 풀링"), §10(4주차 마일스톤), §12(알려진 위험 "6슬롯 동시 발사 시 성능 저하 → 객체 풀링")
> - **슬라이스 위치:** 객체 풀링 인프라의 **첫 수직 슬라이스 = 발사체.** 적·XP 풀링은 같은 인프라로 후속 슬라이스.

---

## 0. 목표 (한 줄)

마법 자동 발사로 인해 반복적으로 생성·삭제되는 발사체를 **재사용 풀**로 관리하여 GC 끊김(stutter)을 제거하고, 적·XP에도 적용 가능한 **공용 풀 인프라(`ObjectPoolLogic` + `PoolManager`)를 구축**한다.

---

## 1. 배경 / 왜 지금

- 로드맵 §7·§9·§10에서 **객체 풀링은 v1 MVP 시스템(4주차)**이며 §12가 핵심 성능 위험으로 명시("6슬롯 동시 발사 + 적 다수 + 투사체 다수 → 풀링 필수").
- 현재 코드는 발사체·적·XP 모두 `instantiate`로 생성하고 `node.destroy()`로 파괴한다(검증 완료). 호드 서바이벌에서는 초당 수십~수백 개가 생성·파괴되므로, GC가 이를 정리할 때 프레임이 끊긴다.
- 파티클 등 폴리시를 풀링보다 **먼저** 얹으면 같은 성능 위험이 더 커지므로, 풀링을 폴리시보다 앞서 진행해야 한다(슬라이스 선정 분석).

### 왜 발사체부터 (범위 격리)

| 엔티티 | churn | 리셋 난이도 | 이번 슬라이스 |
|--------|-------|------------|--------------|
| **발사체** | **최고** (쿨다운마다 × 6슬롯 × 부채꼴) | **쉬움** — `Projectile.init()`이 이미 리셋 훅 | ✅ |
| 적 | 높음 | 어려움 — 사망 연출이 scale/alpha/`_dead` 변형 + onLoad에 GameManager 등록 | 후속 |
| XP | 중 | 쉬움 (onLoad 없음) | 후속 |

발사체는 **생성·삭제가 가장 잦으면서 상태 리셋이 가장 단순**하다(init 훅이 이미 있고, 사망 연출·등록 로직이 없다). 인프라를 발사체에서 먼저 검증한 뒤, `onLoad`→`onEnable` 전환이 필요한 적은 리스크가 크므로 따로 떼어 후속 슬라이스에서 다룬다.

---

## 2. 설계

### 2.1 풀링의 원리 (Cocos 3.8)

Context7 매뉴얼을 확인한 결과, 3.8은 전용 `NodePool`보다 **`node.active` 토글**을 권장한다. `active=false`로 두면 `onDisable`이 실행되고 컴포넌트와 `update`가 멈추며, `active=true`로 되돌리면 `onEnable`이 실행된다. 따라서:
- `destroy()` 대신 **`active=false`로 숨겨 풀에 반환**.
- 재사용 시 **풀에서 꺼내 위치·상태 리셋 후 `active=true`**.
- 풀이 비었을 때만 `instantiate`.

### 2.2 `logic/ObjectPoolLogic.ts` (신규 · 순수 로직 · TDD 타깃)

`cc`에 의존하지 않는다. 제네릭 free-list(재사용 대기 목록) 컨테이너와 보관 한도(cap) 정책을 담는다. 실제 `cc.Node`는 호출부(PoolManager)가 보관하고, 이 로직은 **장부(가용 목록·총량·활성 수)와 acquire/release 정책**만 책임진다.

```ts
// cc import 없음. T는 제네릭(테스트는 number/object로 검증). 생성은 팩토리 주입.
export class ObjectPoolLogic<T> {
  /** @param maxFree 가용(idle) 보관 상한. 0(기본)=무제한. 활성 수는 제한하지 않음(스폰을 거부하지 않음). */
  constructor(maxFree?: number);
  get freeCount(): number;     // 재사용 대기(idle) 수
  get totalCount(): number;    // 풀이 인지하는 누적 객체 수(활성+가용)
  get activeCount(): number;   // totalCount - freeCount

  /** 가용 항목을 재사용, 없으면 create()로 생성·추적해 반환. (스폰을 절대 거부하지 않음) */
  acquire(create: () => T): T;
  /** 항목을 가용 목록으로 반환. 보관 한도 초과면 false(호출부 폐기, 총량--). 이미 가용이면 true(멱등 no-op). */
  release(item: T): boolean;
}
```

- **순수성 근거:** acquire(재사용할지 새로 생성할지 결정)·release·보관 한도·카운터는 cc 없이도 결과가 결정적이라 `vitest`로 RED→GREEN 검증이 가능하다. 생성에 따르는 부수효과는 주입받은 `create` 콜백으로 분리하므로, 로직은 콜백을 호출할지 여부만 판단한다.
- **보관 한도의 의미:** `maxFree`는 **재사용 대기분의 보관 상한**(놀고 있는 객체가 과도하게 쌓이는 것을 막음)이지 활성 객체 수의 상한이 아니다. 동시 발사체가 많아도 스폰은 항상 성공하며, 한도를 넘긴 객체는 release 시 보관하지 않고 폐기한다.
- **재사용성:** 발사체·적·XP가 같은 컨테이너를 `T=Node`로 공유한다.

### 2.3 `components/PoolManager.ts` (신규 · cc 바인딩 · 평범한 TS 클래스)

**cc Component가 아니라** `Prefab`과 부모 `Node`를 받는 일반 클래스다. `ObjectPoolLogic<Node>`를 감싸 실제 노드 생성과 active 토글을 담당한다. Component가 아니므로 **새 에디터 배선이 필요 없다** — SpellCaster가 이미 가진 `bulletPrefab`/`bulletParent`를 그대로 받아 생성한다.

```ts
import { instantiate, Node, Prefab } from 'cc';
export class PoolManager {
  constructor(prefab: Prefab, parent: Node, maxSize?: number);
  /** 노드를 꺼낸다(가용분 재사용 또는 신규 instantiate). active=true, parent에 부착 보장. */
  acquire(): Node;
  /** 노드를 풀에 반환. active=false (+ cap 초과 시 destroy). */
  release(node: Node): void;
}
```

- `acquire`: `logic.acquire(() => instantiate(prefab) + parent.addChild)`로 가용분을 재사용하거나 새로 생성하며, 반환하는 노드는 `active=true` 상태다.
- `release`: `logic.release(node)`가 true면 `node.active=false`로 숨겨 보관하고, false(보관 한도 초과)면 `node.destroy()`로 폐기한다.

### 2.4 `components/Projectile.ts` (수정)

- 명중·화면밖 두 곳의 `node.destroy()`를 **풀 반환 콜백 호출**로 교체한다.
- 발사체가 풀을 직접 알 필요 없도록, `init`에서 **반환 콜백**을 주입받아 보관한다: `init(dir, speed, damage, radius, onDespawn)`.
- **이중 반환 가드:** `_despawned` 플래그로, 명중과 화면밖이 같은 흐름에서 중복 호출되더라도 단 한 번만 반환한다(명중 시 곧바로 빠져나가므로 현재도 사실상 겹치지 않지만, 풀 반환은 멱등해야 안전하다).
- 기존 JSDoc은 유지하고 `@param`에 `onDespawn`만 추가한다.

### 2.5 `components/SpellCaster.ts` (수정)

- `onLoad`(또는 첫 발사) 시 `bulletPrefab`/`bulletParent`로 `new PoolManager(...)`를 한 번 생성해 보관한다.
- `_spawnShot`에서 `instantiate(this.bulletPrefab)`을 `pool.acquire()`로 바꾼다. 이후 **위치·스프라이트 색·init은 acquire할 때마다 그대로 다시 적용**한다 — 재사용 노드의 상태 리셋을 바로 이 재적용이 담당한다. `init`에는 `(node) => pool.release(node)` 콜백을 넘긴다.

### 2.6 재사용 시 발사체 상태 리셋 — 무엇이 보장되나

acquire 직후 SpellCaster가 매번 다시 설정하므로, 이전 발사의 상태가 남지 않는다:

| 상태 | 리셋 주체 |
|------|----------|
| 위치 | `bullet.setPosition(this.node.position)` (매 acquire) |
| 방향/속도/데미지/반경 | `projectile.init(...)` (매 acquire) |
| 스프라이트 색 | `sprite.color = 분류색` (매 acquire) |
| `_despawned` | `init`에서 false로 초기화 |
| `_outOfBoundsLimit` | onLoad 1회 계산값(뷰 크기 불변) — 재사용해도 유효 |

---

## 3. 영향 파일 (Impact Map)

| 파일 | 변경 | 회귀 확인 |
|------|------|-----------|
| `logic/ObjectPoolLogic.ts` | 신규(순수) | (테스트) |
| `tests/logic/ObjectPooling.test.ts` | 신규 | — |
| `components/PoolManager.ts` | 신규(cc 클래스) | 노드 생성·재사용·반환 |
| `components/Projectile.ts` | destroy→풀반환 콜백 + 이중반환 가드 | **명중 데미지·화면밖 제거·발사체 수명** |
| `components/SpellCaster.ts` | instantiate→pool.acquire + 콜백 전달 | **자동 발사·부채꼴·분류색·데미지 배율** |

> 5개 파일(신규 3 + 수정 2)로 "5개 이상 동시 수정" 안전 경계에 걸리므로 이 문서로 미리 공유한다. 변경은 모두 단일 기능(발사체 풀링)에 모여 있다.
> **에디터 배선 변경 없음** — PoolManager가 Component가 아니라 SpellCaster의 기존 `@property`(bulletPrefab/bulletParent)를 재사용하기 때문이다. 신규 `.meta`는 순수 `.ts` 3개분뿐이며 AI가 만들지 않는다(7단계에서 Cocos가 생성 → 8단계에서 커밋).

---

## 4. 테스트 계획 (`tests/logic/ObjectPooling.test.ts`)

순수 로직인 `ObjectPoolLogic`만 단위 테스트한다(피처명 PascalCase = `ObjectPooling`). cc·노드에 의존하는 PoolManager/Projectile/SpellCaster는 수동 QA로 검증한다.

- **신규 풀:** `freeCount=0`, `totalCount=0`, `activeCount=0`.
- **빈 풀 acquire:** `undefined` 반환(호출부 생성 신호). 이후 `register(item)` → `totalCount=1`, `activeCount=1`, `freeCount=0`.
- **release:** `release(item)` → `freeCount=1`, `activeCount=0`. 반환값 `true`.
- **재사용:** release 후 `acquire()` → **그 항목 반환**, `freeCount=0`, `activeCount=1`(신규 생성 없음, `totalCount` 불변).
- **보관 한도(maxSize=N):** 활성 N개 상태에서 빈 풀을 acquire하면 undefined가 나오고, register가 한도 안이면 허용된다. 한도에 도달한 뒤 `release`가 한도를 넘겨 보관하려 하면 `false`를 반환한다(호출부가 destroy). 정확한 한도 동작은 RED 단계에서 고정한다.
- **멱등/방어:** 같은 항목을 중복 release해도 free 목록에 중복 적재되지 않는다.

> `EnemySpawner`/`XPItem` 등 생성·삭제가 잦은 다른 곳은 이번 변경 대상이 아니다(회귀만 확인).

---

## 5. 수동 QA 포인트 (7단계, 상세는 `docs/qa/object-pooling-test.md`)

- 발사체가 정상적으로 발사·이동·명중되고 화면 밖에서 제거되는가(기존과 체감이 같은가).
- **재사용 검증:** 장시간 플레이해도 발사체가 색·방향·데미지의 섞임 없이 매번 올바르게 나오는가(이전 상태가 남지 않는가).
- 부채꼴·다중 슬롯·분류색·데미지 배율에 회귀가 없는가.
- (선택) 프로파일러로 발사 중 GC 스파이크와 프레임 안정성이 개선됐는지 확인한다.

---

## 6. 완료 정의 (DoD)

- [ ] `ObjectPooling.test.ts` GREEN + 전체 스위트 GREEN.
- [ ] 발사체가 `instantiate`/`destroy` 없이 풀에서 재사용됨(코드상 destroy 경로 제거).
- [ ] 자동 발사·부채꼴·분류색·데미지·명중·화면밖 제거 **회귀 없음**.
- [ ] 재사용 시 상태 잔류(이전 방향/색/데미지) 없음.
- [ ] cso / ts / lint / 코드리뷰 통과.

---

## 7. 범위 밖 (후속)

- **적 풀링** — `onLoad`→`onEnable` 전환(GameManager 등록)과 사망 연출 상태(scale/alpha/`_dead`) 리셋이 필요하다. 같은 `ObjectPoolLogic`을 재사용하되, 회귀 리스크를 분리하기 위해 별도 슬라이스로 진행한다.
- **XP 풀링** — `XPItemController`는 `onLoad`가 없어 단순하다. 적 풀링과 함께 또는 그 직후에 진행한다.
- 파티클·사운드·넉백 등 게임 필(폴리시, 로드맵 13-15주).
- 풀 워밍업(prewarm), 동적 축소 등 고급 정책은 필요할 때 후속으로 다룬다.

---

## 8. 미해결/결정 포인트 (승인 전 확인)

- **풀 보관 한도 정책:** 기본은 무제한(`maxSize=0`)으로 시작하길 권장한다 — 발사체는 수명이 짧아 동시 최대치 부근에서 풀 크기가 수렴하기 때문이다. 한도가 필요하면 구체적인 수치는 밸런싱 단계에서 정한다.
- **PoolManager 위치:** 발사체와 동선을 맞춰 `components/`에 둔다. 적·XP로 확장할 때 `systems/`로 옮길지 검토한다.
