# 계획: 객체 풀링 — 발사체 (object-pooling)

> - **작성일:** 2026-06-06
> - **브랜치:** feat/object-pooling
> - **상태:** 계획 (사용자 승인 대기)
> - **상위 설계:** [로드맵 v0.2](../../planning/roadmap.md) §7(객체 풀링 — MVP), §9(코드 설계 원칙 "객체 풀링"), §10(4주차 마일스톤), §12(알려진 위험 "6슬롯 동시 발사 시 성능 저하 → 객체 풀링")
> - **슬라이스 위치:** 객체 풀링 인프라의 **첫 수직 슬라이스 = 발사체.** 적·XP 풀링은 같은 인프라로 후속 슬라이스.

---

## 0. 목표 (한 줄)

마법 자동 발사로 매 프레임 쏟아지는 발사체의 `instantiate`/`destroy` churn을 **재사용 풀**로 없애 GC 끊김(stutter)을 제거하고, 적·XP에도 재사용할 **풀 인프라(`ObjectPoolLogic` + `PoolManager`)를 확립**한다.

---

## 1. 배경 / 왜 지금

- 로드맵 §7·§9·§10에서 **객체 풀링은 v1 MVP 시스템(4주차)**이며 §12가 핵심 성능 위험으로 명시("6슬롯 동시 발사 + 적 다수 + 투사체 다수 → 풀링 필수").
- 현재 코드는 발사체·적·XP 모두 raw `instantiate` + `node.destroy()` (검증 완료). 호드 서바이벌에서 초당 수십~수백 회 생성·파괴 → GC가 청소할 때 프레임 끊김.
- 폴리시(파티클 등)를 풀링 **이전에** 얹으면 같은 위험을 증폭시키므로, 풀링이 폴리시보다 선행해야 한다(슬라이스 선정 분석).

### 왜 발사체부터 (범위 격리)

| 엔티티 | churn | 리셋 난이도 | 이번 슬라이스 |
|--------|-------|------------|--------------|
| **발사체** | **최고** (쿨다운마다 × 6슬롯 × 부채꼴) | **쉬움** — `Projectile.init()`이 이미 리셋 훅 | ✅ |
| 적 | 높음 | 어려움 — 사망 연출이 scale/alpha/`_dead` 변형 + onLoad에 GameManager 등록 | 후속 |
| XP | 중 | 쉬움 (onLoad 없음) | 후속 |

발사체는 **churn이 가장 크면서 리셋이 가장 단순**(init 훅 존재, 사망 연출·등록 로직 없음)하다. 인프라를 여기서 증명한 뒤, onLoad→onEnable 이주가 필요한 적은 리스크를 분리해 후속 슬라이스로.

---

## 2. 설계

### 2.1 풀링의 원리 (Cocos 3.8)

Context7 매뉴얼 확인 결과, 3.8은 전용 `NodePool`보다 **`node.active` 토글**을 권장한다. `active=false` → `onDisable` 실행 + 컴포넌트/update 정지, `active=true` → `onEnable` 실행. 따라서:
- `destroy()` 대신 **`active=false`로 숨겨 풀에 반환**.
- 재사용 시 **풀에서 꺼내 위치·상태 리셋 후 `active=true`**.
- 풀이 비었을 때만 `instantiate`.

### 2.2 `logic/ObjectPoolLogic.ts` (신규 · 순수 로직 · TDD 타깃)

`cc` 비의존. 제네릭 free-list 컨테이너 + cap 정책. 실제 cc.Node는 호출부(PoolManager)가 보관하고, 이 로직은 **장부(가용 목록·총량·활성 수)와 acquire/release 정책**만 책임진다.

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

- **순수성 근거:** acquire(재사용 vs 생성 결정)·release·cap·counter는 cc 없이 결정적 → `vitest`로 RED→GREEN. 생성 부수효과는 주입된 `create` 콜백으로 격리(로직은 호출 여부만 결정).
- **cap 의미:** `maxFree`는 **idle 보관 상한**(메모리 hoarding 방지)이지 활성 상한이 아니다 — 동시 발사체가 많아도 스폰은 항상 성공하고, 한도 초과분은 release 시 보관하지 않고 폐기한다.
- **재사용성:** 발사체·적·XP가 동일 컨테이너를 T=Node로 사용.

### 2.3 `components/PoolManager.ts` (신규 · cc 바인딩 · 평범한 TS 클래스)

**cc Component가 아님** — `Prefab`+부모 `Node`를 받는 일반 클래스. `ObjectPoolLogic<Node>`를 감싸 실제 노드 생성/토글을 담당. Component가 아니므로 **새 에디터 배선이 필요 없다**(SpellCaster가 이미 가진 `bulletPrefab`/`bulletParent`로 생성).

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

- `acquire`: `logic.acquire(() => instantiate(prefab) + parent.addChild)` — 가용분 재사용 또는 신규 생성. 반환 노드 `active=true`.
- `release`: `logic.release(node)`가 true면 `node.active=false`(숨겨 보관), false(cap 초과)면 `node.destroy()`.

### 2.4 `components/Projectile.ts` (수정)

- `node.destroy()` 2곳(명중·화면밖)을 **풀 반환 콜백 호출**로 교체.
- 풀을 직접 알 필요 없이, `init`에서 **반환 콜백**을 주입받아 보관: `init(dir, speed, damage, radius, onDespawn)`.
- **이중 반환 가드:** `_despawned` 플래그 — 명중·화면밖이 같은 흐름에서 중복 호출돼도 1회만 반환(현재도 명중 시 early-return이라 사실상 배타지만 풀 반환은 멱등이어야 안전).
- 기존 JSDoc 유지, `@param`에 `onDespawn` 추가.

### 2.5 `components/SpellCaster.ts` (수정)

- `onLoad`(또는 첫 발사)에서 `bulletPrefab`/`bulletParent`로 `new PoolManager(...)` 1회 생성·보관.
- `_spawnShot`: `instantiate(this.bulletPrefab)` → `pool.acquire()`. 이후 **위치·스프라이트 색·init은 매 acquire마다 그대로 재적용**(재사용 노드의 상태 리셋 = 이 재적용이 담당). `init`에 `(node) => pool.release(node)` 콜백 전달.

### 2.6 재사용 시 발사체 상태 리셋 — 무엇이 보장되나

acquire 직후 SpellCaster가 매번 다시 세팅하므로 잔여 상태가 남지 않는다:

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

> 5개 파일(신규 3 + 수정 2) — "5개 이상 동시 수정" 안전 경계라 이 문서로 사전 공유. 단일 기능(발사체 풀링)에 응집.
> **에디터 배선 변경 없음** — PoolManager가 Component가 아니라 SpellCaster의 기존 `@property`(bulletPrefab/bulletParent)를 재사용. `.meta` 신규는 순수 `.ts` 3개분이며 AI가 만들지 않음(7단계 Cocos 생성 → 8단계 커밋).

---

## 4. 테스트 계획 (`tests/logic/ObjectPooling.test.ts`)

순수 `ObjectPoolLogic`만 단위 테스트(피처명 PascalCase = `ObjectPooling`). PoolManager/Projectile/SpellCaster(cc·노드 의존)는 수동 QA.

- **신규 풀:** `freeCount=0`, `totalCount=0`, `activeCount=0`.
- **빈 풀 acquire:** `undefined` 반환(호출부 생성 신호). 이후 `register(item)` → `totalCount=1`, `activeCount=1`, `freeCount=0`.
- **release:** `release(item)` → `freeCount=1`, `activeCount=0`. 반환값 `true`.
- **재사용:** release 후 `acquire()` → **그 항목 반환**, `freeCount=0`, `activeCount=1`(신규 생성 없음, `totalCount` 불변).
- **cap(maxSize=N):** 활성 N개 상태에서 빈 풀 acquire→undefined→register가 cap 내면 허용, cap 도달 후 `release`가 cap 초과 보관이면 `false`(호출부 destroy). (정확한 cap 의미는 RED 단계에서 고정.)
- **멱등/방어:** 같은 항목 중복 release 시 free 목록 중복 적재 방지.

> `EnemySpawner`/`XPItem` 등 다른 churn 소스는 이번 변경 대상 아님(회귀만 확인).

---

## 5. 수동 QA 포인트 (7단계, 상세는 `docs/qa/object-pooling-test.md`)

- 발사체가 정상 발사·이동·명중·화면밖 제거되는가(기존과 동일 체감).
- **재사용 검증:** 장시간 플레이 시 발사체가 색·방향·데미지 섞임 없이 매번 올바르게 나오는가(상태 잔류 없음).
- 부채꼴·다중 슬롯·분류색·데미지 배율 회귀 없음.
- (선택) 프로파일러로 발사 중 GC 스파이크/프레임 안정성 개선 확인.

---

## 6. 완료 정의 (DoD)

- [ ] `ObjectPooling.test.ts` GREEN + 전체 스위트 GREEN.
- [ ] 발사체가 `instantiate`/`destroy` 없이 풀에서 재사용됨(코드상 destroy 경로 제거).
- [ ] 자동 발사·부채꼴·분류색·데미지·명중·화면밖 제거 **회귀 없음**.
- [ ] 재사용 시 상태 잔류(이전 방향/색/데미지) 없음.
- [ ] cso / ts / lint / 코드리뷰 통과.

---

## 7. 범위 밖 (후속)

- **적 풀링** — onLoad→onEnable 이주(GameManager 등록) + 사망 연출 상태(scale/alpha/`_dead`) 리셋. 같은 `ObjectPoolLogic` 재사용. 별도 슬라이스(회귀 리스크 격리).
- **XP 풀링** — `XPItemController`(onLoad 없음) 단순. 적 풀링과 함께 또는 직후.
- 파티클·사운드·넉백 등 게임 필(폴리시, 로드맵 13-15주).
- 풀 워밍업(prewarm)·동적 축소 등 고급 정책 — 필요 시 후속.

---

## 8. 미해결/결정 포인트 (승인 전 확인)

- **풀 cap 정책:** 기본 무제한(`maxSize=0`)으로 시작 권장 — 발사체는 수명이 짧아 동시 최대치에서 풀 크기 수렴. cap이 필요하면 수치는 밸런싱 단계.
- **PoolManager 위치:** `components/`에 둠(발사체와 동선). 적·XP 확장 시 `systems/`로 승격 검토.
