# 계획: 객체 풀링 — 적·XP (enemy-xp-pooling)

> - **작성일:** 2026-06-07
> - **브랜치:** feat/enemy-xp-pooling
> - **상태:** 계획 (승인 대기)
> - **상위 설계:** [로드맵 v0.2](../../planning/roadmap.md) §7(객체 풀링 — MVP)·§9·§12(성능 위험)
> - **선행 슬라이스:** [발사체 풀링(PR #27)](2026-06-06-object-pooling-plan.md) — `ObjectPoolLogic`+`PoolManager` 공용 인프라 구축 완료
> - **슬라이스 위치:** 객체 풀링의 **두 번째 수직 슬라이스 = 적·XP.** 선행 슬라이스가 만든 인프라를 그대로 재사용한다.

---

## 0. 목표 (한 줄)

호드 서바이벌에서 가장 빈번하게 생성·파괴되는 **적**과 **XP 아이템**을, 발사체에서 검증된 공용 풀 인프라(`PoolManager`+`ObjectPoolLogic`)로 재사용 관리해 GC 끊김을 제거한다. **신규 파일·에디터 배선 없이** 기존 4개 파일만 수정한다.

---

## 1. 배경 / 왜 지금

- 발사체 풀링(PR #27)으로 공용 인프라가 검증됐다. 같은 인프라를 적·XP에 확장하는 것이 자연스러운 다음 슬라이스다([로드맵 §7·§12]).
- 적은 웨이브 스케일링으로 동시 수십 마리가 스폰·사망을 반복하고, XP는 적 사망마다 드롭→흡수로 파괴된다. 둘 다 `instantiate`/`destroy` 빈도가 높아 GC 스파이크의 주요 원인이다.
- 선행 슬라이스가 적·XP를 후속으로 분리한 이유는 **회귀 리스크 격리**였다(적은 `onLoad`→`onEnable` 이주 + 사망 연출 상태 리셋 필요). 인프라가 안정된 지금 그 리스크를 따로 다룬다.

### 적이 발사체보다 까다로운 점 (이번 슬라이스의 핵심 난이도)

| 항목 | 발사체 | 적 |
|------|--------|----|
| 등록 | 없음 | `GameManager.registerEnemy` — 재사용 시 재등록 필요 |
| 상태 변형 | 위치·방향만 | 사망 연출이 scale·alpha·`_dead`를 변형 → 재사용 전 복원 필요 |
| 데이터 | 고정 | `enemyId`별 HP·색·크기 — 재사용마다 다른 종류로 재설정 |
| 생명주기 훅 | 없음 | `onLoad`(1회)와 재사용(active 토글)이 다름 |

XP는 `onLoad`가 없어 발사체만큼 단순하다.

---

## 2. 설계

> **핵심 원칙:** 신규 파일·신규 `@property`·신규 에디터 노드를 만들지 않는다. 발사체 슬라이스가 정한 "기존 `@property` 재사용 + acquire 직후 호출부가 상태 전량 재적용" 패턴을 그대로 따른다.

### 2.1 풀 소유자 — 씬 리로드 안전성 기준

재시작은 씬 리로드(`director.loadScene('main')`)다. 따라서 **풀은 씬마다 재생성되는 Component 인스턴스가 소유**해야 한다(static 풀은 리로드 후 폐기된 노드를 참조해 깨진다). 발사체 풀이 `SpellCaster`(인스턴스 필드)에 사는 것과 같은 이유다.

| 엔티티 | 풀 소유자 | 근거 |
|--------|----------|------|
| **적** | `EnemySpawner` (인스턴스 필드) | 이미 `enemyPrefab`+부모(canvas)를 보유 → 새 배선 0 |
| **XP** | `ExperienceManager` (인스턴스 필드) | 씬마다 재생성되는 싱글톤. XP 개념의 소유처. prefab/parent는 호출부가 lazy 주입 → 새 배선 0 |

### 2.2 `systems/EnemySpawner.ts` (수정) — 적 풀 소유

- `onLoad`에서 canvas 확보 후 `this._enemyPool = new PoolManager(this.enemyPrefab, this._canvas)` 1회 생성.
- 반환 콜백을 1회 바인딩해 재사용: `_releaseEnemy = (n: Node) => this._enemyPool?.release(n)`.
- `_spawnEnemy`: `instantiate(this.enemyPrefab)` → `this._enemyPool.acquire()`. 이후 위치·`reset(...)`을 매 acquire마다 재적용:
  ```ts
  const node = this._enemyPool.acquire();
  node.setPosition(spawnPos);
  const ctrl = node.getComponent(EnemyController);
  if (!ctrl) { this._enemyPool.release(node); return; } // destroy 대신 반환
  ctrl.reset(enemyId, this.playerNode, this._releaseEnemy);
  ```
- `maxEnemies` 게이트(`enemies.length >= maxEnemies`)는 그대로 — 사망 연출 중인 적은 이미 목록에서 빠져 있으므로(아래 2.3) 계산 의미가 변하지 않는다.

### 2.3 `components/EnemyController.ts` (수정) — 생명주기 이주 + 재사용 리셋

**등록 타이밍 이주** (재사용은 `onLoad`가 아니라 active 토글이므로):

| 훅 | 변경 후 책임 |
|----|-------------|
| `onLoad` | `_sprite` 캐시만 (컴포넌트는 재사용해도 유지되므로 1회면 충분) |
| `onEnable` | `GameManager.registerEnemy(this)` — 최초 활성 + 재사용 활성마다 |
| `onDisable` | `GameManager.unregisterEnemy(this)` — 풀 반환(active=false) + 씬 해제 모두 커버 (멱등) |

> 기존 `onDestroy`의 unregister는 `onDisable`이 포섭하므로 `onDisable`로 대체한다(노드 파괴 시 onDisable→onDestroy 순으로 둘 다 호출됨). `_startDeath`의 unregister는 **유지** — 사망 연출 중(아직 active=true) 투사체·접촉 표적에서 빼야 하므로. 이후 풀 반환 시 `onDisable`이 다시 unregister해도 멱등(no-op)이라 안전.

**동기 `reset(enemyId, playerNode, onDespawn)` 신설** — acquire 직후 스포너가 호출. 데이터는 **스폰 시점에 항상 로드 완료**(`EnemySpawner._ensureDirector`가 `DataManager.isReady`를 게이트)이므로 비동기 `onReady` 없이 **동기로 즉시 재적용**한다:
- `enemyId`/`playerNode`/`_onDespawn` 설정
- 데이터 동기 적용: `getEnemy(enemyId)` → `_hp`, `collisionRadius`, `_playerCollisionRadius`, `_applyVisualBaseline(data)`(색·크기 복원)
- 연출 상태 리셋: `_dead=false`, `_deathElapsed=0`, `_flashing=false`, `_flashElapsed=0`

> 기존 `onLoad`의 `DataManager.onReady(...)` 데이터 로딩 블록은 이 동기 `reset`으로 대체된다. 스폰 게이트가 데이터 준비를 보장하므로 콜백이 불필요하고, 재사용마다 다른 `enemyId`를 다시 읽어야 하므로 동기 재적용이 옳다.

**사망 종료 → 풀 반환**: `_updateDeath`의 `this.node.destroy()`를 풀 반환 콜백 호출로 교체. 이중 반환 방어 가드(`_despawned` 패턴, 발사체와 동일)를 둔다. 콜백이 없으면 `destroy` 폴백.

**XP 드롭 위임**: `_dropXpItem`이 직접 `instantiate`하던 것을 `ExperienceManager.instance.spawnXpItem(this.xpItemPrefab, this.node.parent, this.node.position, this._data.xpDrop, this.playerNode)`로 위임. `xpItemPrefab` @property는 **EnemyController에 그대로 둔다**(에디터 재배선 회피) — prefab 참조만 매니저로 넘긴다.

**import 변화**: `XPItemController` import 제거(더 이상 getComponent 안 함), `ExperienceManager` import 추가. 순환 없음(`ExperienceManager`는 `EnemyController`를 import하지 않음).

### 2.4 `systems/ExperienceManager.ts` (수정) — XP 풀 소유 + 스폰 API

- 필드: `private _xpPool: PoolManager | null = null`, 반환 콜백 `_absorb`.
- `spawnXpItem(prefab: Prefab, parent: Node, pos: Vec3, value: number, playerNode: Node): void`:
  ```ts
  if (!this._xpPool) this._xpPool = new PoolManager(prefab, parent); // lazy: 첫 드롭 때 생성
  const node = this._xpPool.acquire();
  node.setPosition(pos);
  const ctrl = node.getComponent(XPItemController);
  if (!ctrl) { this._xpPool.release(node); return; }
  ctrl.init(playerNode, value, this._absorb);
  ```
- `_absorb = (value: number, node: Node) => { this.addXp(value); this._xpPool?.release(node); }` — 흡수 시 XP 가산 + 풀 반환을 매니저가 책임진다.
- import 추가: `PoolManager`, `XPItemController`, `Node`/`Prefab`/`Vec3`(cc). **단방향** import(`ExperienceManager`→`XPItemController`)라 순환 없음.

### 2.5 `components/XPItemController.ts` (수정) — 콜백 기반 흡수 + 재사용 리셋

- `ExperienceManager` import **제거** → 순환 차단. 흡수를 콜백으로 역주입받는다.
- `init(playerNode: Node, xpValue: number, onAbsorb: (xpValue: number, node: Node) => void)`: 상태 재설정 + `_absorbed=false`.
- `update`: 반경 내 진입 && `!_absorbed` → `_absorbed=true`; `onAbsorb(this.xpValue, this.node)` (기존 `addXp`+`destroy` 대체). 이중 흡수 방어.

### 2.6 재사용 시 상태 리셋 — 무엇이 보장되나

| 엔티티 | 상태 | 리셋 주체 |
|--------|------|----------|
| 적 | 위치 | 스포너 `setPosition` (매 acquire) |
| 적 | HP·반경·색·크기 | `reset()` → `_applyVisualBaseline` (매 acquire) |
| 적 | `_dead`/`_deathElapsed`/`_flashing`/`_flashElapsed` | `reset()` (매 acquire) |
| 적 | 목록 등록 | `onEnable` (활성마다) |
| XP | 위치 | 매니저 `setPosition` (매 acquire) |
| XP | `playerNode`/`xpValue`/`_absorbed` | `init()` (매 acquire) |

---

## 3. 영향 파일 (Impact Map)

| 파일 | 변경 | 회귀 확인 |
|------|------|-----------|
| `systems/EnemySpawner.ts` | 풀 소유 + instantiate→acquire + reset/release 주입 | **스폰 위치·웨이브 스케일링·최대 적 수** |
| `components/EnemyController.ts` | onLoad/onEnable/onDisable 이주 + 동기 reset + 사망→풀반환 + XP드롭 위임 | **추적·접촉 데미지·피격 플래시·사망 연출·XP 드롭·종류별 스탯/색/크기** |
| `systems/ExperienceManager.ts` | XP 풀 + `spawnXpItem` + `_absorb` | **XP 가산·레벨업** |
| `components/XPItemController.ts` | 콜백 흡수 + init/재사용 리셋 + 이중흡수 가드 | **XP 흡수 반경·값** |

> **수정 4개 파일, 신규 파일 0개** → "5개 이상 동시 수정" 경계 미만. 변경은 모두 단일 기능(적·XP 풀링)에 모여 있다.
> **신규 `.meta` 0개** — 신규 `.ts`가 없고 새 `@property`/노드도 없다. 7단계 에디터 작업은 "기존 동작 회귀 확인" 위주이며, 8단계에서 커밋할 신규 `.meta`도 없을 것으로 예상한다(에디터가 기존 자산을 재임포트하며 `.meta`를 갱신할 경우만 커밋).

---

## 4. 테스트 계획 — **스킵 (사유 기록)**

순수 풀 장부 `ObjectPoolLogic`은 선행 슬라이스의 `tests/logic/ObjectPooling.test.ts`가 **이미 완전히 커버**한다(재사용·생성 팩토리·idle 보관 한도(maxFree) true/false·총량 회계·멱등 release·다중 acquire/release). 이번 슬라이스가 추가하는 코드는 **전부 cc 바인딩**이다:

- `EnemySpawner`/`ExperienceManager`의 풀 배선, `PoolManager.acquire/release` 호출 → cc.Node·instantiate·active 토글
- `EnemyController.reset`/생명주기 훅 → `DataManager`·`Sprite.color`·`node.setScale`·`GameManager` 등록
- `XPItemController.init`/흡수 → `Vec3.distance`·콜백

새 **순수 로직 파일이 없으므로** `pnpm wf skip-test "<사유>"`로 테스트 생성을 생략한다. 사유: *풀 장부 로직은 ObjectPooling.test.ts가 이미 커버, 신규 코드는 전량 cc 의존(노드 토글·Sprite·DataManager·Vec3)이라 순수 단위 테스트 대상 아님 → 수동 QA로 검증.* `PoolManager`의 `destroy` 분기(cap 초과)도 cc 의존이라 수동 QA 영역이며, 이번 슬라이스는 발사체와 동일하게 `maxFree=0`(무제한)이라 프로덕션에선 dead path다.

---

## 5. 수동 QA 포인트 (7단계, 상세는 `docs/qa/enemy-xp-pooling-test.md`)

- **적 재사용 무결성:** 장시간 플레이 시 적이 종류별 HP·색·크기·이동·접촉 데미지에 섞임 없이 매번 올바르게 스폰되는가(이전 사망 연출의 scale/alpha/`_dead` 잔류 없음).
- **사망 연출 회귀:** 팝(스케일)+페이드(알파)가 기존과 동일하게 재생되고, 연출 종료 후 노드가 사라지는가(파괴 대신 풀 반환으로 바뀐 뒤에도 체감 동일).
- **피격 플래시 회귀:** 재사용된 적도 피격 시 흰색 점멸 후 기준색으로 정확히 복귀하는가.
- **최대 적 수·웨이브 스케일링:** 동시 적 수 상한과 웨이브별 증가가 그대로 동작하는가.
- **XP 회귀:** 적 사망 시 XP가 올바른 위치·값으로 드롭되고, 플레이어 근접 시 흡수→XP 가산→레벨업이 정상인가. 재사용된 XP 노드에 이전 값이 잔류하지 않는가.
- **재시작:** result→재시작(씬 리로드) 후 적·XP가 정상 스폰되는가(풀이 씬과 함께 폐기·재생성).
- (선택) 프로파일러로 다수 적 스폰/사망 중 GC 스파이크·프레임 안정성 개선 확인.

---

## 6. 완료 정의 (DoD)

- [ ] 전체 테스트 스위트 GREEN(신규 테스트 없음 — 기존 유지).
- [ ] 적·XP가 `instantiate`/`destroy` 없이 풀에서 재사용됨(코드상 destroy 경로 제거, 사망 종료/흡수가 풀 반환으로 교체).
- [ ] 적 추적·접촉·피격 플래시·사망 연출·종류별 스탯/색/크기 **회귀 없음**.
- [ ] XP 드롭·흡수·레벨업 **회귀 없음**.
- [ ] 재사용 시 상태 잔류(이전 종류/연출/XP값) 없음, 씬 리로드 후 정상.
- [ ] cso / ts / lint / 코드리뷰 통과.

---

## 7. 범위 밖 (후속)

- `PoolManager` 위치를 `components/`→`systems/`로 옮길지 여부 — 이번엔 `.meta`/import churn 회피 위해 **현 위치 유지**(선행 슬라이스 §8에서 제기된 검토 항목, 필요 시 별도 정리 슬라이스).
- 풀 워밍업(prewarm)·동적 축소·활성 상한 정책 — 필요 시 후속.
- 파티클·사운드·넉백 등 게임 필(폴리시, 로드맵 13-15주).

---

## 8. 미해결/결정 포인트 (승인 전 확인)

- **XP 풀 소유자 = `ExperienceManager`** 로 제안한다(씬 재생성 싱글톤이라 리로드 안전 + XP 개념 소유처 + 배선 0). 대안은 `EnemySpawner`가 두 풀을 모두 소유하는 것이나, 스포너에 XP 책임을 섞고 싱글톤화가 필요해 응집도가 떨어진다.
- **`xpItemPrefab` @property 위치 = `EnemyController` 유지.** 매니저로 옮기면 에디터 재배선이 생기므로, prefab 참조만 호출 시 넘기는 방식으로 배선 변경을 0으로 둔다.
- **풀 보관 한도 = 무제한(`maxFree=0`)** 으로 시작(발사체와 동일). 적·XP도 수명이 유한해 동시 최대치 부근에서 풀 크기가 수렴한다. 한도 수치는 밸런싱 단계에서.
