# QA 체크리스트: 객체 풀링 — 적·XP (enemy-xp-pooling)

> - **브랜치:** feat/enemy-xp-pooling
> - **계획:** [2026-06-07-enemy-xp-pooling-plan.md](../development/sessions/2026-06-07-enemy-xp-pooling-plan.md)
> - **선행:** [object-pooling-test.md](object-pooling-test.md) (발사체 풀링) — 같은 풀 인프라
> - **테스트 코드:** **스킵** (사유는 아래 "자동 테스트" 섹션 참고)

이 슬라이스는 적·XP의 생성·파괴를 `instantiate`/`destroy`에서 풀 재사용(`PoolManager`)으로 바꾼다. **신규 파일·신규 에디터 노드·신규 `@property`가 없으므로** 에디터 작업은 "기존 배선 유지 확인 + 인게임 회귀 검증"이 전부다.

---

## 1. Impact Map (변경 파일별 회귀 확인 범위)

| 파일 | 변경 | 회귀로 반드시 확인할 동작 |
|------|------|--------------------------|
| `systems/EnemySpawner.ts` | instantiate→풀 acquire, reset/release 주입 | 스폰 위치(플레이어 주변 원형)·웨이브별 스폰 간격↓·최대 적 수↑·동시 적 수 상한 |
| `components/EnemyController.ts` | onLoad/onEnable/onDisable 이주, 동기 reset, 사망→풀반환, XP드롭 위임 | 추적 이동·접촉 데미지·피격 플래시·사망 팝/페이드·종류별 HP/색/크기·XP 드롭 |
| `systems/ExperienceManager.ts` | XP 풀 + spawnXpItem + 흡수 콜백 | XP 가산·레벨업 트리거·카드 선택 진입 |
| `components/XPItemController.ts` | 콜백 흡수 + 재사용 리셋 + 이중흡수 가드 | XP 흡수 반경·획득 값 |

---

## 2. 씬/프리팹 변경 사항

**없음.** 새 노드·새 컴포넌트·새 프리팹을 추가하지 않는다. 풀은 런타임에 기존 프리팹(`enemyPrefab`, `xpItemPrefab`)과 기존 부모(Canvas)로 생성된다.

---

## 3. 에디터 연결 체크리스트 (기존 배선 — 변경 없음, 존재만 확인)

신규 `@property`는 없다. 기존 연결이 그대로 유효한지만 확인한다.

| 컴포넌트 | 프로퍼티 | 연결 대상 | 상태 |
|----------|----------|-----------|------|
| `EnemySpawner` | `enemyPrefab` | 적 프리팹 | ☐ 기존 유지 |
| `EnemySpawner` | `playerNode` | Player 노드 | ☐ 기존 유지 |
| `EnemyController`(적 프리팹) | `xpItemPrefab` | XP 아이템 프리팹 | ☐ 기존 유지 (위치 변경 없음 — 매니저로 옮기지 않음) |
| `EnemyController`(적 프리팹) | `playerNode` | 스폰 시 코드 주입 | ☐ 기존 유지 |

> `xpItemPrefab`은 의도적으로 EnemyController에 **그대로 둔다**(에디터 재배선 회피). 매니저가 이 prefab 참조를 받아 풀을 만든다.

---

## 4. 자동 테스트로 검증 — **스킵**

**사유:** 순수 풀 장부 `ObjectPoolLogic`은 선행 슬라이스의 `tests/logic/ObjectPooling.test.ts`(재사용·생성 팩토리·idle 보관 한도(maxFree) true/false·총량 회계·멱등 release·다중 acquire/release)가 이미 완전히 커버한다. 이번 슬라이스가 추가하는 코드는 전부 cc 바인딩(노드 active 토글·`instantiate`·`Sprite.color`·`node.setScale`·`DataManager`·`Vec3`·`GameManager` 등록)이라 새 순수 로직 파일이 없다 → `pnpm wf skip-test`. `PoolManager`의 `destroy` 분기(cap 초과)도 cc 의존이며, 이번 슬라이스는 `maxFree=0`(무제한)이라 프로덕션에선 dead path.

- [x] 전체 스위트 GREEN 확인 — `vitest run` **128/128 통과** (신규 테스트 없음, 기존 회귀 없음). `start-verification` GREEN 게이트로 검증됨. 통과 커밋: 본 피처 커밋.

---

## 5. 수동 테스트 체크리스트 (인게임 — 코드로 검증 불가)

### 적 풀링
- [ ] 게임 시작 후 적이 플레이어 주변에 정상 스폰된다(스폰 위치·간격 기존과 동일).
- [ ] 적이 플레이어를 추적해 이동하고, 접촉 시 초당 데미지를 준다.
- [ ] 발사체 명중 시 피격 플래시(흰색 점멸)가 뜨고 원래 색으로 복귀한다.
- [ ] 적 사망 시 팝(살짝 커짐)+페이드(투명해짐) 연출 후 사라진다.
- [ ] **재사용 무결성(핵심):** 장시간 플레이하며 적을 계속 처치해도, 새로 스폰되는 적이 **종류별 올바른 HP·색·크기·이동속도**로 나온다(이전 적의 사망 연출 잔상 — 작아진 채/반투명/큰 채로 나오지 않음).
- [ ] **종류 섞임 없음:** skeleton/swift/tank가 재사용을 거쳐도 각자 올바른 스탯·색·크기를 유지한다.
- [ ] 동시 최대 적 수 상한이 그대로 적용된다(무한정 늘어나지 않음).
- [ ] 웨이브가 올라갈수록 스폰이 빨라지고 최대 적 수가 늘어난다(기존 스케일링 유지).

### XP 풀링
- [ ] 적 사망 위치에 XP 아이템이 드롭된다.
- [ ] 플레이어가 XP에 근접하면 흡수되고 XP가 가산된다.
- [ ] XP가 충분히 쌓이면 레벨업 → 카드 선택 화면이 뜬다.
- [ ] **재사용 무결성:** 재사용된 XP 노드가 **올바른 획득 값**으로 동작한다(이전 드롭의 값이 잔류하지 않음 — 적 종류별 xpDrop이 섞이지 않음).
- [ ] XP 흡수 반경이 기존과 동일하다.

### 씬 리로드 (풀 teardown)
- [ ] 게임오버/승리 → result → **재시작** 후, 적·XP가 처음처럼 정상 스폰·동작한다(이전 씬의 풀 노드가 남거나 깨지지 않음).

### 성능 (선택)
- [ ] 프로파일러로 다수 적 스폰/사망이 반복되는 구간에서 GC 스파이크가 줄고 프레임이 안정적인지 확인.
