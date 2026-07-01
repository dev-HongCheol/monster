# 적 로스터 S3 — 근접 휘두르기(두억시니·야차·그슨대) QA 체크리스트

- **브랜치:** feat/enemy-melee-sweep
- **관련 계획:** `../development/sessions/2026-07-01-enemy-melee-sweep-plan.md`
- **설계 정본:** `../planning/enemy-system.md` §5·§6·§10(패밀리 3)·§11·§13(S3)
- **선행:** S1 enemy-movement(돌진 + 첫 텔레그래프·바닥 마커) / S2a enemy-projectile(공격 FSM) / S2b enemy-multishot(발사 기하). 근접 휘두르기는 이들이 깔아 둔 공격 상태기계·텔레그래프·마커 패턴을 재사용한다.

> S3는 발사체 적과 **똑같은 공격 상태기계**(`tickAttack`: 조준→텔레그래프→발사→쿨다운)를 돌리되, 발사(Fire) 순간에 탄을 쏘는 대신 부채꼴 범위 안의 플레이어를 즉시 판정한다. 그래서 신규 로직은 부채꼴 명중 판정(`coneHitsTarget`)과 마커 치수(`meleeConeMarkerScale`) 두 순수 함수, 그리고 휘두르는 동안 추격을 멈추는 배선뿐이다. 검증의 대부분은 순수 로직 자동 테스트와 인게임 동작 관찰이다.

---

## 자동 테스트로 검증

> **통과 근거 (2026-07-01, phase=verification):** 피처 `EnemyMeleeSweep.test.ts` 22/22(coneHitsTarget 11 + meleeConeMarkerScale 8 + S3 데이터 3) + 전체 스위트 366/366(28개 파일). SHA는 6단계 검증 커밋.

- [x] `coneHitsTarget`(부채꼴 명중 판정) 순수 테스트 — `tests/logic/EnemyMeleeSweep.test.ts`
  - 정면 히트 / 옆으로 빠짐 미스 / 사거리 밖 미스 / 경계각·경계거리 포함(≤) / 경계 바로 밖 미스 / 뒤쪽 미스 / `toTarget` 영벡터(겹침) 히트 / `facing` 영벡터 미스(NaN 가드) / 좌우 대칭 / 대각선 facing 상대각 판정
- [x] `meleeConeMarkerScale`(마커 치수) 순수 테스트 — 같은 파일
  - scaleX = 사거리 기반 / scaleY = 각도 기반(넓은 각 → 큰 scaleY) / 부모 스케일 상쇄 / coneAngle 0·극단·parentScale 0 유한 가드
- [x] S3 데이터 정합 — 두억시니·야차·그슨대가 `melee_sweep`으로 존재, `melee.coneAngleDeg`·`melee.range` 보유, `contactDamagePerSec < attack.damage`(이중 피해 방지 불변식 §5)
- [x] **회귀:** 전체 스위트 GREEN — 공격 FSM(`tickAttack`) 게이트 일반화가 기존 발사체 적(구미호·이무기·물귀신) 동작을 깨지 않음

---

## Impact Map (회귀 확인 범위)

| 변경 파일 | 무엇이 바뀌나 | 확인 범위 |
|-----------|---------------|-----------|
| `data/GameTypes.ts` | `IEnemyAttackData`에 `melee?: { coneAngleDeg, range }` 추가(옵셔널) | 타입 컴파일 — 기존 발사체 적 데이터에 영향 없음 |
| `logic/EnemyAttackLogic.ts` | `coneHitsTarget`·`meleeConeMarkerScale` + 마커 기준 상수 신규 추가(기존 `tickAttack` 무변경) | 단위 테스트 |
| `components/EnemyController.ts` | 공격 FSM 게이트를 `melee_sweep`까지 일반화, Fire 에지에 `_strikeMelee`, 휘두르는 동안 추격 정지, 부채꼴 마커 노드 토글·회전·스케일 | **발사체 적 회귀**(구미호·이무기·물귀신 발사 정상) + 인게임 근접 3종 |
| `data/enemies.json` | 두억시니·야차·그슨대 추가 | 데이터 테스트 + 인게임 스폰 |
| `data/spawn-table.json` | 근접 3종 후반 웨이브 편입 | 스폰 무결성 + 인게임 등장 |

---

## 씬/프리팹 변경 사항 (확정 — 코드 기준)

- **부채꼴 범위 마커 자식 노드 `MeleeConeMarker`:** `Enemy.prefab`에 placeholder 섹터(부채꼴) 모양 Sprite 자식 노드를 하나 추가한다. 돌진 바닥 마커(`LungeMarker`)를 미러한 것으로, 적 노드의 자식이라 부모(threatScale) 스케일을 함께 받는다 — 그래서 로직이 `meleeConeMarkerScale`로 부모 스케일을 상쇄한다.
  - **모양:** 꼭짓점이 적 중심, +X 방향으로 뻗는 단색 부채꼴/삼각형 placeholder Sprite. 최종 이펙트는 아트 단계.
  - **기준 치수:** 스프라이트를 기준 길이 **100px(`MELEE_MARKER_BASE_LENGTH`) × 기준 폭 100px(`MELEE_MARKER_BASE_WIDTH`)** 로 만들고 꼭짓점을 왼쪽 중앙(anchor x=0, y=0.5)에 둬 +X로 뻗게 한다. 두 기준값은 `EnemyAttackLogic.ts`의 export 상수가 정본이다. 런타임에 `meleeConeMarker.angle = 조준 방향`, `setScale(scaleX, scaleY)`로 회전·치수가 적용된다.
  - 노드는 기본 비활성(`active=false`)으로 두면 되고, 윈드업 중에만 로직이 켠다. 미연결(null)이어도 마커 없이 정상 동작한다(로직은 null 가드) — `LungeMarker`와 동일.

## 에디터 연결 체크리스트 (확정 — 코드 기준)

| `@property` | 연결 대상 노드 | 상태 |
|-------------|----------------|------|
| `EnemyController.meleeConeMarker` (`Node | null`) | `Enemy.prefab` 자식 `MeleeConeMarker` (Sprite) | ❌ 미연결 → 7단계에서 노드 추가·연결 |

> `@property` 이름(`meleeConeMarker`)·기준 치수 상수(100×100)는 위 표가 구현 코드(`EnemyController.ts`·`EnemyAttackLogic.ts`)와 일치한다. 노드 이름 `MeleeConeMarker`는 권장값으로, 실제 연결은 이름과 무관하게 `@property`에 드래그로 매핑하면 된다.

---

## 수동 테스트 체크리스트 (인게임 — 코드로 검증 불가)

- [ ] **접근 → 정지 → 휘두르기:** 근접 적이 플레이어에게 추격으로 붙다가 사거리 안에 들면 **멈춰 서서** 윈드업(부채꼴 마커 표시) → 윈드업 끝에 1회 가격 → 쿨다운 뒤 다시 접근하는 루프가 보인다.
- [ ] **부채꼴 마커:** 윈드업 동안 잠근 조준 방향으로 부채꼴 범위 마커가 뜨고, 각도·사거리가 적별로 다르다(두억시니 넓고 길게 / 그슨대 좁고 짧게). 마커가 실제 명중 판정 범위와 일치한다.
- [ ] **예고 보고 회피:** 윈드업 중 플레이어가 부채꼴 밖으로(옆으로 빠지거나 뒤로) 벗어나면 피해를 안 입는다. 부채꼴 안에 남아 있으면 맞는다.
- [ ] **적별 차별화:** 두억시니(느림·넓은 각·긴 윈드업), 야차(표준), 그슨대(빠름·좁은 각·짧은 윈드업·빠른 쿨다운)의 체감이 다르다.
- [ ] **이중 피해 없음:** 근접 적에 딱 붙어 있어도 접촉 DoT와 휘두르기 버스트가 같은 순간 이중으로 갈리지 않는다(틱당 max 게이트 + 낮은 접촉/높은 버스트 데이터).
- [ ] **윈드업 중 사망:** 휘두르기 윈드업 도중 적이 죽으면 부채꼴 마커가 시체에 남지 않고 사라진다(풀 재사용·`_startDeath` 처리).
- [ ] **일시정지 정합:** 레벨업 카드 선택 중에는 휘두르기 FSM이 멈춘다(정지 중 가격 없음).
- [ ] **발사체 적 회귀:** 구미호(단발)·이무기(부채꼴)·물귀신(확산)이 기존대로 발사한다(공격 FSM 게이트 일반화가 발사체 경로를 깨지 않음).
- [ ] **스폰:** 두억시니·야차·그슨대가 실제 후반 웨이브에서 스폰돼 등장한다.

> **F19 재확인(미발현 유지):** 근접 휘두르기 적은 `movement: chase` + `attack`이라 돌진 전용 텔레그래프 경로(`_updateLungeTelegraph`)를 타지 않는다 → `lunge` + `attack` 겸용의 `_windupActive` 충돌은 여전히 발생하지 않는다.
