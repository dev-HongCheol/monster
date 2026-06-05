# 계획: 적 시각 구분 + 피격/사망 연출 (enemy-visuals)

> - **작성일:** 2026-06-05
> - **브랜치:** feat/enemy-visuals
> - **상태:** 계획 — 승인 대기
> - **상위 설계:** [적 시스템 디자인](../../planning/enemy-system.md) §7(위협·시각 언어)·§13(구현 슬라이스)
> - **슬라이스 위치:** enemy-variety 3분할 중 **S2**. (S1=스폰 디렉터·스탯 구분=완료/PR #25, S3=게임 필은 후속)

---

## 0. 목표 (한 줄)

S1에서 추가한 적 3종(표준/스워머/탱크)이 지금은 **외형이 똑같다**. 색·크기로 **눈에 띄게 구분**하고, **피격 플래시 + 사망 연출**로 타격감을 준다.

---

## 1. 스코프

### 포함 (이번 슬라이스 — 설계 §13)
- **`IEnemyData` 필드 추가** — `movement`/`role`/`tint`/`threatScale` (설계 §11 스키마). v1 구현은 `tint`·`threatScale`만 소비, `movement`·`role`은 데이터 자리 확보(라벨/그룹화용, 런타임 분기 없음).
- **`enemies.json` 3종에 값 채움** — placeholder 색·크기(아래 §3).
- **`EnemyVisualLogic`** (신규, 순수 로직) — 경과시간 → 피격 플래시 블렌드/사망 스케일·알파/완료 여부 계산. **TDD RED→GREEN 대상.**
- **`EnemyController`** — 데이터의 `tint`(Sprite color)·`threatScale`(node scale) 적용 + 피격 플래시 + 사망 팝/페이드. 매 프레임 `EnemyVisualLogic`이 계산한 값을 Sprite/node에 적용만.

### 제외 (후속 슬라이스 / v2 — 스키마 자리만)
- ~~v2 이동(지그재그/플랭커/돌진)·능동 공격·텔레그래프·엘리트~~ → `movement` 필드는 `"chase"` 고정, `attack`/`eliteModifiers`는 이번에도 추가 안 함(소비자 없음, YAGNI). 설계 §11의 v2 자리는 **그 필드가 실제로 필요한 슬라이스에서** 추가.
- ~~외곽선/글로우(엘리트 표시)·원소 색~~ → 설계 §7 v2.
- 사망 파티클·사운드 → S3(enemy-feel) 또는 아트 단계.

---

## 2. 신규 필드 (`IEnemyData` — `GameTypes.ts`)

```ts
interface IEnemyData {
  // ... 기존 필드(maxHp/speed/contactDamagePerSec/collisionRadius/xpDrop) 유지 ...
  /** 이동 알고리즘 (설계 §3). v1은 "chase" 고정 — 데이터 자리만(런타임 분기 없음). */
  movement: string;
  /** 역할·스탯 프로필 라벨 (설계 §4). standard|swarmer|tank — 그룹화/도감용. */
  role: string;
  /** placeholder 색 (설계 §7). hex 문자열. Sprite 컬러에 적용. */
  tint: string;
  /** 시각 크기 배율 (설계 §7). node scale에 적용. */
  threatScale: number;
}
```

> `movement`/`role`을 옵셔널이 아닌 필수로 두는 이유: 데이터 3종 모두 값을 채울 거라 런타임 분기가 없어도 타입이 단순. v2 이동/공격 enum화는 그 기능 슬라이스에서.

---

## 3. placeholder 색·크기 (설계 §7 — S2 확정안)

| id | role | tint | threatScale | 의도 (설계 §7) |
|----|------|------|-------------|----------------|
| `skeleton` | standard | `#FFFFFF` (흰색=기본 스프라이트색) | 1.0 | 기준 |
| `skeleton_swift` | swarmer | `#7FE0D0` (밝은 청록) | 0.7 | 밝음·작음 = 약함·빠름 |
| `skeleton_tank` | tank | `#5A3A8A` (어두운 보라) | 1.4 | 어두움·큼 = 강함·느림 |

> **placeholder다.** 역할 구분이 목적이지 최종 색 결정이 아님. 밸런싱/아트 단계 재조정(설계 §7·§14). `tint`는 Sprite `_color`에 곱연산으로 적용되므로 스프라이트 원본색에 따라 체감이 달라질 수 있음 — 인게임에서 구분되는지는 수동 QA로 확인.
>
> **아트 단계(7-9주차) 함의 — 역할 구분용 tint 값은 사라진다.** 적마다 고유 스프라이트가 들어오면 종류 구분은 스프라이트가 담당하므로, 이 placeholder 색값(`#7FE0D0`/`#5A3A8A`)은 `#FFFFFF`(중립=원본색 그대로)로 되돌린다. `tint` **필드 자체**는 제거하지 않고 남길 수 있다 — 곱연산 중립(흰색)이면 무효과이고, v2 엘리트 표시(빨강)·원소 색(설계 §7·§9)이 같은 채널을 재활용한다.
>
> **⚠️ 피격 플래시 함정:** 이번 플래시는 `baseTint → 흰색` lerp이라, 아트 적용 후 tint가 중립 흰색이 되면 "흰색 → 흰색"이라 **플래시가 안 보인다.** 그 시점엔 플래시를 다른 방식(밝기 가산/머티리얼 오버레이)으로 교체해야 한다 — **S3/아트 단계 과제**로 이월.

---

## 4. EnemyVisualLogic (순수 로직 — 테스트 핵심)

`cc` 비의존. 경과시간 → 시각 상태 수치만 계산. cc.Color/tween은 호출부(EnemyController)가 담당. (biome `noStaticOnlyClass` 권장에 따라 정적 클래스가 아닌 **순수 함수 모듈**로 export.)

```ts
// 의존: cc 없음 (순수 TS). 시간 기반 보간값만 책임. named export.
/** 피격 플래시 블렌드 비율 [0,1]. 0초=1(완전 흰색), duration 이상=0(원래색). 선형 감쇠. */
export function hitFlashBlend(elapsed: number, duration: number): number;
/** 사망 팝 스케일 배율. 0초=1 → 중간 peak로 부풀었다가 → 1로. (baseScale에 곱해 적용) */
export function deathScale(elapsed: number, duration: number, peak: number): number;
/** 사망 페이드 알파 [0,1]. 0초=1 → duration에서 0. */
export function deathAlpha(elapsed: number, duration: number): number;
/** 사망 연출 종료 여부(elapsed >= duration). true면 호출부가 노드를 destroy. */
export function isDeathDone(elapsed: number, duration: number): boolean;
```

- **호출부 적용 매핑(EnemyController):**
  - 플래시: `Color.lerp(out, baseTint, WHITE, hitFlashBlend(...))` → `sprite.color = out`
  - 사망: `node.setScale(threatScale * deathScale(...))`, `sprite.color.a = 255 * deathAlpha(...)`
- 시간/엣지(음수 elapsed, duration=0, elapsed>duration)는 로직에서 클램프 — 테스트로 고정.

### 테스트 계획 (`tests/logic/EnemyVisuals.test.ts`, 피처명 PascalCase=`EnemyVisuals`)
- `hitFlashBlend`: elapsed=0 → 1, elapsed=duration → 0, 중간 → 선형 보간값, elapsed>duration → 0, 음수 elapsed → 1로 클램프.
- `deathScale`: elapsed=0 → 1, 중간 → peak에 근접, elapsed=duration → 1 부근(또는 정의된 종료값). duration=0 방어.
- `deathAlpha`: 0초 → 1, duration → 0, 단조 감소.
- `isDeathDone`: elapsed<duration → false, ≥duration → true.

> `EnemyController`(Sprite/node/cc.Color/scheduler 의존)는 단위 테스트 제외 — 수동 QA로 검증(QA 문서).

---

## 5. EnemyController 배선

현재: `onLoad`에서 데이터 로드 후 HP·반경만 초기화. 시각 요소 미사용. `takeDamage`는 HP<=0이면 즉시 XP 드롭 + `destroy()`.

변경:
1. **Sprite 참조 확보** — 프리팹 루트 Enemy 노드에 단일 `cc.Sprite` 존재 → `this.getComponent(Sprite)`. (Context7로 Cocos Sprite color/scale API 확인 후 구현.)
2. **데이터 적용(onReady 콜백 내):** `this._baseTint = Color.fromHEX(new Color(), data.tint)`; `sprite.color = baseTint`; `node.setScale(data.threatScale)`.
3. **피격 플래시:** `takeDamage`에서 사망이 아니면 `_flashElapsed = 0`(플래시 시작). `update`에서 `_flashElapsed += dt`, `hitFlashBlend`로 색 블렌드 적용.
4. **사망 연출(팝+페이드):** HP<=0이면 즉시 destroy 대신:
   - `_dead = true` 설정, `GameManager.unregisterEnemy(this)` 호출(투사체·접촉이 죽은 적 무시), XP 드롭(기존 위치/값 유지 — 게임플레이 동일).
   - `update`에서 `_dead`면 이동·접촉 데미지 스킵하고 `_deathElapsed += dt`, `deathScale`/`deathAlpha` 적용, `isDeathDone`이면 `node.destroy()`.
   - 죽은 적의 `takeDamage` 재호출은 무시(`if (this._dead) return`).

> **핵심 리스크:** XP 드롭/언레지스터 타이밍. 현재는 destroy 직전 1회 드롭이라, 사망 연출 시작 시점으로 옮기되 **정확히 1회만** 드롭되도록 `_dead` 가드. 연출 중 적이 화면에 남지만 `_dead`라 데미지·이동 없음 → 게임플레이 회귀 없음. (설계 §7 사망 연출 = 팝+페이드)

---

## 6. 영향 파일 (Impact Map)

| 파일 | 변경 | 회귀 확인 |
|------|------|-----------|
| `data/GameTypes.ts` | `IEnemyData`에 4필드 추가 | 타입 컴파일, 기존 소비자 |
| `resources/data/enemies.json` | 3종에 `movement`/`role`/`tint`/`threatScale` 추가 | 데이터 로드, 기존 스탯 무영향 |
| `logic/EnemyVisualLogic.ts` | 신규(순수 로직) + `.meta` 즉시 생성 | (테스트) |
| `components/EnemyController.ts` | Sprite/scale 적용 + 플래시 + 사망 연출 | **스폰·추적·접촉 데미지·XP 드롭·사망** |
| `tests/logic/EnemyVisuals.test.ts` | 신규 | — |

> 5개 파일(코드 4 + 테스트 1) — "5개 이상 동시 수정" 안전 규칙 경계라 이 계획 문서로 사전 공유. 단일 기능(적 시각 구분)에 응집.
> `.meta`: 신규 순수 로직 `EnemyVisualLogic.ts`는 AI가 즉시 생성·커밋(경로 참조). 에디터 자산 변경 없음(기존 Enemy.prefab의 Sprite/node를 코드로 제어).

---

## 7. 완료 정의 (DoD)

- [ ] `EnemyVisuals.test.ts` GREEN (피처 N/N + 전체 스위트 M/M, 통과 커밋 SHA 기재)
- [ ] 인게임: 표준=흰/중간, 스워머=밝은 청록/작음, 탱크=어두운 보라/큼 으로 **한눈에 구분**됨
- [ ] 피격 시 흰색 플래시, 사망 시 팝+페이드 연출 보임
- [ ] 기존 스폰·추적·접촉 데미지·XP 드롭 회귀 없음(특히 XP 정확히 1회 드롭)
- [ ] cso / ts / lint / 코드리뷰 통과

---

## 8. 다음 슬라이스 예고

- **S3 (enemy-feel):** 사망 파티클/사운드, 넉백 등 게임 필 강화.
- v2: `movement` enum화 + 실제 이동 알고리즘(지그재그/플랭커/돌진), 능동 공격·텔레그래프.
