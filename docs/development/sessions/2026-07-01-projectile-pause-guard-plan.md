# 발사체 일시정지 가드 — LevelUp 중 날아가던 발사체가 멈추지 않는 버그 수정 (I1)

- **작성일:** 2026-07-01
- **브랜치:** feat/projectile-pause-guard
- **슬라이스:** I1 버그 수정 (일시정지 상태 정합성)
- **출처:** enemy-multishot(S2b) 7단계 인게임 테스트에서 발견 → `docs/development/backlog.md` I1
- **리뷰 수준:** 경량 인라인. 백로그 I1에 근본 원인과 수정안이 파일·줄 단위 정밀도로 이미 확정돼 있어(7단계 디버깅의 산출물) office-hours·풀 autoplan 파이프라인은 슬라이스 규모 대비 과해 생략한다(enemy-multishot S2b와 같은 결).

---

## 1. 배경과 목적

레벨업 카드 선택 중 게임 멈춤은 전역 일시정지(director pause)가 아니라, 각 시스템이 `update()` 안에서 `GameManager.instance.state !== GameState.Playing`을 직접 확인해 일찍 빠져나가는 방식으로 구현돼 있다. `SpellCaster`(`:154`), `EnemyController`(`:218`), `EnemySpawner`, `WaveManager`는 이 가드를 갖고 있어 카드 선택 중 멈춘다.

그런데 **이미 발사돼 날아가고 있는 발사체 두 종류는 `update()`에 이 가드가 없어** 일시정지 중에도 계속 이동하고 명중 판정을 낸다.

- **`EnemyProjectile.update()`(`:68`)** — 적 발사체가 일시정지 중에도 플레이어를 향해 날아가 `damagePlayer`를 호출한다. 카드를 고르는 동안 피해를 입는 공정성 문제다.
- **`Projectile.update()`(`:84`)** — 플레이어 발사체가 일시정지 중에도 이동·명중하고, 폭발 발사체라면 `_detonate`로 폭발 데미지까지 낸다.

이 버그는 S2a(구미호 단발)에서는 발사체가 빨리 사라져 거의 드러나지 않았고, S2b(물귀신 확산 8발 — 느리고 다수)에서 눈에 띄게 가시화됐다. 두 발사체 파일 모두 이번 노출 계기인 enemy-multishot diff 밖에서 도입된 기존 코드다(원인이 아니라 노출 계기).

## 2. 스코프

### 이번 슬라이스가 포함하는 것

두 발사체 컴포넌트의 `update()` 맨 앞에 상태 가드 한 줄을 추가하고, 그에 필요한 `GameState`를 import한다. 그게 전부다.

```ts
update(dt: number) {
  if (GameManager.instance.state !== GameState.Playing) return;
  // ...기존 본문
}
```

- `Projectile.ts` — `update()` 가드 추가 + `GameState` import(`'../data/GameTypes'`). `GameManager`는 이미 import돼 있다.
- `EnemyProjectile.ts` — 동일.

### 이 슬라이스가 닫는 백로그 항목

- **I1**(높음) — 날아가던 발사체가 LevelUp 일시정지를 무시하는 버그. 위 두 가드로 닫는다.

### 명시적으로 범위 밖(NOT in scope)

- **노바·궤도 폭발** — 폭발은 별도 컴포넌트가 없고 직격 폭발(`Projectile._detonate`)·노바·궤도 세 경로뿐이다. 노바·궤도는 `SpellCaster`(`:154`) 가드로 이미 멈추므로, 직격 폭발만 `Projectile.update()` 가드로 함께 닫힌다. 폭발 전용 항목은 불필요하다.
- **적 돌진·접촉 데미지·적 발사 트리거** — `EnemyController.update`의 `:218` 가드 *뒤*에서 호출되므로 이미 정상적으로 멈춘다(버그 아님).
- **`EnemyController._updateDeath`·`_updateFlash`** — `:218` 가드 *앞*이라 일시정지 중에도 진행되지만, 사망 팝·피격 점멸 같은 순수 연출이라 데미지·경험치에 영향이 없다. 별건으로 둔다.

## 3. 테스트 전략 — skip-test

추가하는 가드는 Cocos 라이프사이클 메서드(`update()`) 맨 앞에서 싱글톤 상태(`GameManager.instance.state`)를 읽는 **프레임워크 배선**이다. 분리해 단위 테스트할 순수 로직 모듈이 없고, 코드베이스의 동일한 가드(`SpellCaster:154`·`EnemyController:218`)도 같은 이유로 단위 테스트가 없다. 가드를 순수 술어로 추출하는 것은 trivial한 조건 하나를 위해 코드베이스 관례(컴포넌트 `update()` 인라인 가드)를 벗어나는 과설계다.

따라서 `pnpm wf skip-test`로 처리한다. 검증은 6단계 AI 검증(전체 스위트 GREEN 유지 — 회귀 없음 확인)과 7단계 인게임 수동 테스트(레벨업 중 발사체 정지)로 한다.

## 4. 리스크

극히 낮다. 변경은 2개 파일, 각 1줄(+import 1줄)이고, 정확히 같은 가드 패턴이 코드베이스에 이미 네 곳(`GameManager` 본체 포함하면 그 이상) 자리 잡고 있다. 가드는 `state === Playing`일 때 무동작이라 정상 플레이 동작은 그대로다. 회귀 위험은 일시정지 분기에만 국한된다.

## 5. 검증 (QA)

- **자동:** 전체 vitest 스위트가 GREEN을 유지하는지(발사체·폭발·상태이상 기존 테스트 회귀 없음).
- **수동(7단계 인게임):**
  1. 적 발사체가 날아오는 중 레벨업 → 카드 선택 패널이 뜬 동안 적 발사체가 **제자리에 멈추는지**, 패널 중 피해를 입지 않는지.
  2. 플레이어 발사체(특히 느린 다발·폭발)가 날아가는 중 레벨업 → 발사체가 멈추고 명중·폭발이 일어나지 않는지.
  3. 카드 선택 후 재개 시 발사체가 정상적으로 다시 이동·명중하는지.
