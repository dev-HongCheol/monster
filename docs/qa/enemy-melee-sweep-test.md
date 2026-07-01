# 적 로스터 S3 — 근접 휘두르기(두억시니·야차·그슨대) QA 체크리스트

- **브랜치:** feat/enemy-melee-sweep
- **관련 계획:** `../development/sessions/2026-07-01-enemy-melee-sweep-plan.md`
- **설계 정본:** `../planning/enemy-system.md` §5·§6·§10(패밀리 3)·§11·§13(S3)
- **선행:** S1 enemy-movement(돌진 + 첫 텔레그래프·바닥 마커) / S2a enemy-projectile(공격 FSM) / S2b enemy-multishot(발사 기하). 근접 휘두르기는 이들이 깔아 둔 공격 상태기계·텔레그래프를 재사용한다.

> **리워크 반영(2026-07-01):** 부채꼴 마커를 **스프라이트 스케일 방식 → Graphics 섹터(호) 방식**으로 바꿨다. 7단계 인게임 테스트에서 스프라이트-스케일 마커가 방향·anchor·가로세로를 모두 정확히 맞춰야 해 반복적으로 어긋났고, 넓은 각(두억시니 150°)에선 평평한 삼각형이 실제 부채꼴과 크게 달랐다. Graphics가 적별 `range`·`coneAngleDeg`로 **진짜 파이 조각을 직접 그려** PNG·anchor·크기 개념이 사라지고 어떤 각도든 정확하다.

> S3는 발사체 적과 **똑같은 공격 상태기계**(`tickAttack`: 조준→텔레그래프→발사→쿨다운)를 돌리되, 발사(Fire) 순간에 탄을 쏘는 대신 부채꼴 범위 안의 플레이어를 즉시 판정한다. 신규 순수 로직은 부채꼴 명중 판정(`coneHitsTarget`)과 마커 호 파라미터(`meleeConeMarkerArc`) 두 함수이고, 마커 그리기·추격 정지는 컨트롤러 배선이다.

---

## 자동 테스트로 검증

> **통과 근거 (2026-07-01, 리워크 후):** 피처 `EnemyMeleeSweep.test.ts` 20/20(coneHitsTarget 11 + meleeConeMarkerArc 6 + S3 데이터 3) + 전체 스위트 364/364(28개 파일). SHA는 리워크 검증 커밋.

- [x] `coneHitsTarget`(부채꼴 명중 판정) 순수 테스트 — `tests/logic/EnemyMeleeSweep.test.ts`
  - 정면 히트 / 옆으로 빠짐 미스 / 사거리 밖 미스 / 경계각·경계거리 포함(≤) / 경계 바로 밖 미스 / 뒤쪽 미스 / `toTarget` 영벡터(겹침) 히트 / `facing` 영벡터 미스(NaN 가드) / 좌우 대칭 / 대각선 facing 상대각 판정
- [x] `meleeConeMarkerArc`(마커 호 파라미터) 순수 테스트 — 같은 파일
  - radius = range/부모스케일(상쇄) / 시작·끝 각 = ±coneAngleDeg/2 대칭 / 넓은 각 → 큰 호 스팬 / 사거리 → radius / parentScale 0 폴백 / **호 스팬 = coneAngleDeg (마커=판정 각 정합)**
- [x] S3 데이터 정합 — 두억시니·야차·그슨대가 `melee_sweep`으로 존재, `melee.coneAngleDeg`·`melee.range` 보유, `contactDamagePerSec < attack.damage`(이중 피해 방지 불변식 §5)
- [x] **회귀:** 전체 스위트 GREEN — 공격 FSM(`tickAttack`) 게이트 일반화가 기존 발사체 적(구미호·이무기·물귀신) 동작을 깨지 않음

---

## Impact Map (회귀 확인 범위)

| 변경 파일 | 무엇이 바뀌나 | 확인 범위 |
|-----------|---------------|-----------|
| `data/GameTypes.ts` | `IEnemyAttackData`에 `melee?: { coneAngleDeg, range }` 추가(옵셔널) | 타입 컴파일 — 기존 발사체 적 데이터에 영향 없음 |
| `logic/EnemyAttackLogic.ts` | `coneHitsTarget`·`meleeConeMarkerArc` 신규(기존 `tickAttack` 무변경) | 단위 테스트 |
| `components/EnemyController.ts` | 공격 FSM 게이트를 `melee_sweep`까지 일반화, Fire 에지 `_strikeMelee`, 휘두르는 동안 추격 정지, **Graphics로 부채꼴 섹터 1회 그리기(`_drawMeleeCone`) + Telegraph 중 토글·회전** | **발사체 적 회귀**(구미호·이무기·물귀신 발사 정상) + 인게임 근접 3종 |
| `data/enemies.json` | 두억시니·야차·그슨대 추가 | 데이터 테스트 + 인게임 스폰 |
| `data/spawn-table.json` | 근접 3종 후반 웨이브 편입 | 스폰 무결성 + 인게임 등장 |

---

## 씬/프리팹 변경 사항 (확정 — 코드 기준, Graphics 방식)

- **부채꼴 범위 마커 자식 노드 `MeleeConeMarker` (Graphics):** `Enemy.prefab`에 **빈 Node + `cc.Graphics` 컴포넌트**를 자식으로 하나 둔다. 스프라이트·SpriteFrame·PNG·anchor·ContentSize **전부 불필요** — 코드(`_drawMeleeCone`)가 적별 `range`·`coneAngleDeg`로 섹터를 직접 그린다.
  - **노드:** Position (0,0,0), Scale (1,1,1), 기본 `active=false`. 계층에서 본체 Sprite보다 **먼저(뒤 레이어)** 둔다(범위 표시라 적 밑에 깔림 — LungeMarker와 동일 배치).
  - **컴포넌트:** `cc.Graphics` 1개만 추가하면 된다(UITransform은 Graphics가 자동 부착). 색·모양은 코드가 그림(반투명 빨강 placeholder, 최종 이펙트는 아트 단계).
  - 런타임: reset에서 섹터를 1회 그리고, 윈드업(Telegraph) 동안만 `active=true` + 조준 방향으로 회전. 미부착(Graphics 없음)·미연결(null)이어도 마커 없이 정상 동작한다(로직 null 가드).
  - **이전 스프라이트 방식 잔재 정리:** 리워크 전 만들었던 `MeleeConeMarker`의 자식 `Sprite` 노드·cone-marker.png 임포트는 더 이상 쓰지 않는다. 노드를 위 Graphics 구성으로 교체하고, 안 쓰는 PNG는 지워도 된다.

## 에디터 연결 체크리스트 (확정 — 코드 기준)

| `@property` | 연결 대상 노드 | 상태 |
|-------------|----------------|------|
| `EnemyController.meleeConeMarker` (`Node | null`) | `Enemy.prefab` 자식 `MeleeConeMarker` (**Graphics** 컴포넌트) | ❌ 재구성 필요 → 7단계에서 Graphics 노드로 교체·연결 |

> `@property` 이름(`meleeConeMarker`)은 구현 코드와 일치한다. 노드 이름 `MeleeConeMarker`는 권장값이며, 실제 연결은 이름과 무관하게 `@property`에 드래그로 매핑한다.

---

## 수동 테스트 체크리스트 (인게임 — 코드로 검증 불가)

> 리워크(마커 Graphics 전환)로 이전 수동 결과는 무효화됐다. 아래 항목을 새 마커로 다시 확인한다.

- [ ] **접근 → 정지 → 휘두르기:** 근접 적이 추격으로 붙다가 사거리 안에 들면 **멈춰 서서** 윈드업(부채꼴 섹터 표시) → 윈드업 끝에 1회 가격 → 쿨다운 뒤 다시 접근하는 루프가 보인다.
- [ ] **부채꼴 섹터 마커:** 윈드업 동안 잠근 조준 방향으로 **파이 조각(호) 모양** 범위가 뜨고, 꼭짓점이 적 중심에 붙는다. 각도·사거리가 적별로 다르다(두억시니 넓고 짧게 150° / 그슨대 좁고 짧게 90°). 섹터가 실제 명중 판정 범위와 일치한다.
- [ ] **첫 스폰(풀 미재사용) 마커:** 게임 시작 후 **처음 등장한** 근접 적(풀에서 재사용된 게 아닌 최초 인스턴스)의 첫 윈드업에서도 섹터가 **빈 화면 없이** 제대로 그려진다. (마커는 비활성으로 시작하므로 코드가 활성화 에지에서 그린다 — 첫 생애에 블랭크로 뜨지 않는지 확인. 리뷰 I1.)
- [ ] **예고 보고 회피:** 윈드업 중 플레이어가 섹터 밖으로(옆으로 빠지거나 뒤로) 벗어나면 피해를 안 입는다. 섹터 안에 남아 있으면 맞는다.
- [ ] **적별 차별화:** 두억시니(느림·넓은 각·긴 윈드업), 야차(표준), 그슨대(빠름·좁은 각·짧은 윈드업·빠른 쿨다운)의 체감이 다르다.
- [ ] **이중 피해 없음:** 근접 적에 딱 붙어 있어도 접촉 DoT와 휘두르기 버스트가 같은 순간 이중으로 갈리지 않는다(틱당 max 게이트 + 낮은 접촉/높은 버스트 데이터).
- [ ] **윈드업 중 사망:** 휘두르기 윈드업 도중 적이 죽으면 부채꼴 마커가 시체에 남지 않고 사라진다(`_startDeath`에서 비활성화).
- [ ] **일시정지 정합:** 레벨업 카드 선택 중에는 휘두르기 FSM이 멈춘다(정지 중 가격 없음).
- [ ] **발사체 적 회귀:** 구미호(단발)·이무기(부채꼴)·물귀신(확산)이 기존대로 발사한다(공격 FSM 게이트 일반화가 발사체 경로를 깨지 않음).
- [ ] **스폰:** 두억시니·야차·그슨대가 실제 후반 웨이브에서 스폰돼 등장한다.

> **F19 재확인(미발현 유지):** 근접 휘두르기 적은 `movement: chase` + `attack`이라 돌진 전용 텔레그래프 경로(`_updateLungeTelegraph`)를 타지 않는다 → `lunge` + `attack` 겸용의 `_windupActive` 충돌은 여전히 발생하지 않는다.
