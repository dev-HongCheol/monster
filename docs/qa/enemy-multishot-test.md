# 적 로스터 S2b — 다발 발사체(이무기·물귀신) QA 체크리스트

- **브랜치:** feat/enemy-multishot
- **관련 계획:** `../development/sessions/2026-06-29-enemy-multishot-plan.md`
- **선행:** S2a enemy-projectile(구미호 단발) — 적 발사체 시스템·풀·텔레그래프는 그 슬라이스가 깔아 둔 것을 재사용한다.

> S2b는 S2a 위에 **발사 기하만 증분**한다. 공격 상태기계·`EnemyProjectile` 컴포넌트·발사체 풀은 변경하지 않고, 한 번 발사할 때 1발 대신 N발을 내보내도록만 확장한다. 그래서 신규 에디터 작업은 거의 없고, 검증의 대부분은 순수 로직 자동 테스트와 인게임 동작 관찰이다.

---

## 자동 테스트로 검증

> **통과 근거 (2026-06-30, phase=verification):** 피처 `EnemyMultishot.test.ts` 26/26 + 전체 스위트 344/344(27개 파일). SHA는 6단계 검증 커밋.

- [x] `fanDirections`(부채꼴/호) 순수 테스트 — `tests/logic/EnemyMultishot.test.ts`
- [x] `radialDirections`(확산/링) 순수 테스트 — 같은 파일
- [x] **`SpellPatternEngine.test.ts` 회귀 GREEN** — `directionalPlan`을 `fanDirections` 호출로 리팩터한 뒤에도 마법 부채꼴 동작이 바이트 동일(12/12)
- [x] 유격 정착-사거리 불변식(F20) — kite+attack 적의 `preferredRange + 40 ≤ attack.range`(구미호 360·이무기 380·물귀신 300 모두 ≤ 각 사거리)
- [x] 이무기·물귀신 데이터 존재 + 이동·공격 타입 정합

---

## Impact Map (회귀 확인 범위)

| 변경 파일 | 무엇이 바뀌나 | 확인 범위 |
|-----------|---------------|-----------|
| `logic/FireGeometry.ts` (신규) | 부채꼴(호)·확산(링) 방향 계산 순수 함수 | 단위 테스트 |
| `logic/SpellPatternLogic.ts` | `directionalPlan`이 `fanDirections`를 호출하도록 리팩터(동작 무변경) | **마법 회귀** — `SpellPatternEngine.test.ts` GREEN, 인게임 마법 부채꼴 발사 정상 |
| `components/EnemyController.ts` | `projectile_fan`·`projectile_spread` 배선, `_fireProjectile`가 N발 위임 + F20 주석 정리 | 인게임 — 이무기·물귀신 발사, 구미호 단발 회귀 |
| `data/enemies.json` | 이무기·물귀신 추가 | 데이터 테스트 + 인게임 스폰 |
| `data/spawn-table.json` | 이무기·물귀신 웨이브 편입 | 스폰 무결성 테스트 + 인게임 등장 |

---

## 씬/프리팹 변경 사항

- **신규 프리팹·노드 없음 (확정).** 구현 결과 이무기·물귀신은 `enemies.json`/`spawn-table.json` 데이터만으로 정의됐고, 발사체는 S2a가 만든 `EnemyBullet` 풀을 그대로 쓴다. 발사 기하 분기는 순수 `FireGeometry`에서 처리되어 새 에셋·노드가 없다.

## 에디터 연결 체크리스트

- **신규 `@property` 없음 (확정).** `EnemyController` 변경은 import 추가, 공격 FSM 게이트의 타입 허용 확장, `_fireProjectile`의 N발 위임뿐이고 새 `@property`(노드 참조)를 추가하지 않았다. 발사 위임 콜백(`_fireProjectileFn`)·발사체 풀은 S2a 연결을 재사용한다. → 에디터 신규 연결 작업 없음.

---

## 수동 테스트 체크리스트 (인게임 — 코드로 검증 불가)

- [ ] **이무기 부채꼴:** 전방으로 여러 발이 부챗살 모양으로 퍼져 플레이어 쪽을 향해 날아간다.
- [ ] **물귀신 확산:** 한 번에 사방 360°로 탄막이 깔린다(조준 방향과 무관하게 전 방향).
- [ ] **물귀신 정지형:** 거의 제자리에 머물며 쏜다(kite 데드존 정착). 제자리 탄막이 플레이어에게 이동을 강제하는지.
- [ ] **텔레그래프:** 부채꼴·확산도 발사 직전 단일 윈드업 점멸이 정상으로 뜬다(타입 무관 동일 텔레그래프).
- [ ] **다중 피해 묶임:** 한 볼리의 다발이 같은 순간 플레이어에 닿아도 피해는 틱당 1회(가장 센 1발)만 — player-iframe과 정합.
- [ ] **풀 확장:** 물귀신 확산(예: 8발)이 동시에 나가도 발사체 풀이 정상 확장되고 프레임 드랍이 없다.
- [ ] **구미호 회귀:** 단발 발사체 적(구미호)이 S2a와 동일하게 동작한다(N발 배선이 단발을 깨지 않음).
- [ ] **마법 회귀:** 플레이어 마법의 부채꼴 발사(파이어볼 등)가 기존과 동일하다(`directionalPlan` 추출 영향 없음).
- [ ] **스폰:** 이무기·물귀신이 실제 웨이브에서 스폰돼 등장한다.

> **F19 재확인(미발현 유지):** 이무기·물귀신은 `movement: kite` + `attack`이고 kite 이동은 윈드업 텔레그래프 상태(`_windupActive`)를 건드리지 않는다 → 돌진+발사 겸용 충돌은 여전히 발생하지 않는다. 인게임에서 텔레그래프가 정상이면 확인된 것.
