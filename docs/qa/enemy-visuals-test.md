# QA: 적 시각 구분 + 피격/사망 연출 (enemy-visuals)

> - **브랜치:** feat/enemy-visuals
> - **계획:** [2026-06-05-enemy-visuals-plan.md](../development/sessions/2026-06-05-enemy-visuals-plan.md)
> - **상위 설계:** [enemy-system.md](../planning/enemy-system.md) §7·§13
> - **슬라이스:** enemy-variety S2 (S1=스폰 디렉터/스탯=완료 PR #25)

---

## Impact Map (회귀 테스트 기준)

| 변경 파일 | 확인 범위 |
|-----------|-----------|
| `data/GameTypes.ts` | `IEnemyData` 4필드 추가 — 타입 컴파일, 기존 소비자(EnemyController/DataManager) 무영향 |
| `resources/data/enemies.json` | 3종에 `movement`/`role`/`tint`/`threatScale` 추가 — JSON 로드 성공, 기존 스탯 그대로 |
| `logic/EnemyVisualLogic.ts` | 신규 순수 로직 — 자동 테스트로 검증 |
| `components/EnemyController.ts` | Sprite 컬러·node scale 적용 + 피격 플래시 + 사망 팝/페이드 — **스폰·추적·접촉 데미지·XP 드롭·사망 흐름** 회귀 |

---

## 자동 테스트로 검증 (`tests/logic/EnemyVisuals.test.ts`)

> **통과 근거:** 피처 테스트 17/17 + 전체 스위트 119/119 GREEN (커밋 SHA는 구현 커밋 후 기재).

- [x] `hitFlashBlend`: elapsed=0 → 1, =duration → 0, 중간 → 선형 보간, >duration → 0, 음수 elapsed → 1 클램프, duration≤0 → 0
- [x] `deathScale`: elapsed=0 → 1, 중간(p=0.5) → peak, =duration → 1, duration≤0 → 1
- [x] `deathAlpha`: elapsed=0 → 1, =duration → 0, 단조 감소, >duration → 0
- [x] `isDeathDone`: elapsed<duration → false, ≥duration → true

> `EnemyController`(cc.Sprite/node/Color/scheduler 의존)는 단위 테스트 제외 — 아래 수동 항목으로 검증.

---

## 씬/프리팹 변경 사항

**신규 노드/프리팹 없음.** 기존 `game/assets/Enemy.prefab`의 루트 노드에 이미 있는 단일 `cc.Sprite`를 코드(`EnemyController`)가 제어한다.

- `EnemyController`는 `this.getComponent(Sprite)`로 Sprite를 잡으므로 **신규 `@property` 연결 불필요**.
- 색은 Sprite `color`(곱연산), 크기는 node `scale`, 페이드는 Sprite `color.a`로 적용.

---

## 에디터 연결 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| Enemy.prefab 루트에 `cc.Sprite` 존재 | ✅ (기존) | 코드가 `getComponent(Sprite)`로 접근 |
| 신규 `@property` 연결 | ➖ 없음 | 이번 슬라이스는 코드 주도, 에디터 배선 불필요 |
| Sprite 머티리얼 알파 블렌딩 | ⚠️ 확인 | 사망 페이드(color.a)가 보이려면 기본 2D 스프라이트 머티리얼(builtin-sprite, 알파 블렌드 ON)이어야 함. 커스텀 머티리얼이면 페이드 안 보일 수 있음 |

---

## 수동 테스트 체크리스트 (인게임)

### 시각 구분 (tint / scale)
- [ ] 웨이브 진행 시 **3가지 외형이 한눈에 구분**됨: 표준=기본색·중간 / 스워머=밝은 청록·작음 / 탱크=어두운 보라·큼
- [ ] 같은 종류는 항상 같은 색·크기로 스폰됨 (데이터 일관성)
- [ ] 시각 크기(scale)와 **충돌 판정은 별개** — 탱크가 커 보여도 접촉 반경은 데이터값(collisionRadius)대로 동작 (작은 스워머에 가까이 가야 데미지)

### 피격 플래시
- [ ] 마법 투사체가 적에 명중하면 **흰색으로 순간 점멸** 후 원래색 복귀
- [ ] 연속 피격 시 플래시가 매번 리셋되어 다시 번쩍임
- [ ] 플래시 후 색이 **원래 tint로 정확히 복귀**(색이 영구히 밝아지거나 어두워지지 않음)

### 사망 연출 (팝 + 페이드)
- [ ] 적 사망 시 즉시 사라지지 않고 **살짝 부풀었다(팝) 투명해지며(페이드) 소멸**
- [ ] 사망 연출 중인 적은 **플레이어에게 접촉 데미지를 주지 않음**(이동도 멈춤)
- [ ] 사망 연출 중인 적은 **투사체에 다시 맞지 않음**(중복 처리 없음)
- [ ] XP 아이템이 **정확히 1회** 드롭됨 (연출 중 중복 드롭 없음, 사망 위치에 생성)
- [ ] 연출 종료 후 노드가 완전히 제거됨 (씬에 잔존 노드 없음)

### 회귀 (기존 동작 유지)
- [ ] 스폰·추적·접촉 데미지·웨이브 스케일링 정상 (S1 동작 유지)
- [ ] XP 획득 → 레벨업 → 카드 선택 흐름 정상
