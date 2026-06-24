# 인페르노(궤도형) 코드 리뷰 이슈

- 리뷰 커밋: `76fc1419e22b18701467edbc90dd51853c6002a4` (base `fc0c6d53aca1ba96af453c5578ca607030aa4021`)
- 리뷰 방식: `superpowers:requesting-code-review` 패턴, general-purpose subagent dispatch
- 전체 스위트 260/260 GREEN · TypeScript Error 0건 확인 상태에서 리뷰

리뷰어는 Critical 0건으로 "수정 후 머지 가능(With fixes)" 판정을 냈다. 강점으로는 순수 로직/컴포넌트 분리, 계획이 HIGH로 표시한 재시전 VFX 노드 누수(`_reconcileOrbVfx`로 멱등 재조정) 대응, F16 공유 헬퍼 추출의 정당성, 오브별 소반경 그리드 질의로 성능 형태가 합리적인 점, count=1·음수 회전·수명 만료·락아웃 등 엣지 처리를 꼽았다.

## Important

### I1. 재타격 락아웃 키에 spellId 누락 — 궤도 마법 2종 이상에서 교차 간섭 (수정됨)

- 위치: `game/assets/scripts/logic/OrbitLogic.ts` `_rehit` / `canHit` / `registerHit`
- 내용: 락아웃 맵 키가 `${orbIndex}:${spawnId}`였다. `_orbits`·`_orbNodes`는 마법별로 스코프되는데 락아웃만 그렇지 않아, 궤도형 마법이 둘 이상 되면(로드맵상 S5/S6/S8) A 마법의 오브 0과 B 마법의 오브 0이 같은 적에 대해 같은 키를 공유한다. A가 적 7을 때리면 락아웃 동안 B의 적 7 타격이 조용히 묻힌다(크래시 아닌 무성 언더히트라 발견이 어려움).
- 조치: 키를 `${spellId}:${orbIndex}:${spawnId}`로 바꾸고 `canHit`/`registerHit` 시그니처에 `spellId`를 추가, `SpellCaster._applyOrbHit`가 `orbit.spellId`를 넘기도록 했다. `tests/logic/OrbitLogic.test.ts`에 "다른 궤도 마법과 독립" 테스트를 추가했다. 기존 락아웃 테스트 호출도 새 시그니처로 갱신.

## Minor

### M1. `_positionOrbVfx` 문서/구현 불일치 (수정됨)

- 위치: `docs/qa/inferno-test.md` Impact Map, 계획 §8
- 내용: 계획·QA 문서는 `_positionOrbVfx` 메서드를 적었으나 실제 위치 지정은 `_advanceOrbits` 안에 인라인됐다(`nodes?.[i]?.setPosition`). 동작엔 문제 없음.
- 조치: QA Impact Map의 메서드 목록을 실제 코드에 맞게 갱신.

### M2. 오브 핫패스 프레임당 할당 (보류 — 의도된 이월)

- 위치: `game/assets/scripts/components/SpellCaster.ts` `_applyOrbHit`
- 내용: 오브당 매 프레임 `collectTargetsInRadius`가 배열 2개 + `new Set<number>()`를 만든다(최대 10오브 × 60fps). 현재 규모에선 허용 범위이고 성능 위생은 계획 §11/백로그 G1로 명시 이월됨.
- 판단: `selectExplosionHits`에 넘기는 `alreadyHit` 집합을 오브 간 공유하면 — 만약 그 함수가 집합을 변형한다면 — 오브 독립성이 깨질 수 있어, 오브당 새 집합을 두는 현재 선택을 **유지**한다. 백로그 G1에서 dedup 수명 통합과 함께 재검토.

### M3. 백로그 시제 정리 (수정됨)

- 위치: `docs/development/backlog.md`
- 내용: F16이 "추출 예정"으로 미래 시제였으나 이번 슬라이스에서 추출 완료. A3는 "사실상 닫힘"으로만 표기.
- 조치: F16을 완료로, A3를 닫힘으로 정리.

## 판정

리뷰어 최초: **With fixes** — Critical/실버그 없음, 260/260 GREEN, TS 에러 0. 유일한 실질 지적(I1 락아웃 키)을 즉시 수정했고 나머지는 문서/성능 폴리시였다. I1 수정에 따라 `pnpm wf invalidate` 후 /cso부터 전체 검증을 재실행했다.

## 재리뷰 (I1 수정 후 — 커밋 `fa1e0f0`, 새 HEAD `732eb58`)

I1 수정만 집중 재리뷰(별도 subagent)했다. 결과:

- **수정 판정: 정확·완전.** 락아웃 키가 `${spellId}:${orbIndex}:${spawnId}`로 바뀌었고 `canHit`·`registerHit`·`_applyOrbHit` 선언과 `_advanceOrbits`의 호출부까지 모든 호출 지점에 `spellId`가 전달된다. 레포 전역 grep으로 누락 호출부·잔존 `${orbIndex}:${spawnId}` 문자열 0건 확인. `tickRehit`는 키를 제네릭하게 순회해 수정 불필요.
- **회귀: 없음.** 기존 락아웃 테스트는 새 시그니처로 갱신되며 의미 동일, 신규 "다른 궤도 마법과 독립" 테스트가 충돌 케이스(같은 오브 인덱스+같은 적, 다른 spellId)를 정확히 증명. `OrbitLogic.test.ts` 18/18, 전체 261/261 GREEN.
- **신규 이슈: 0건.** JSDoc/주석도 `(마법, 오브, 적)` 삼중으로 갱신됨.
- **머지 가능 판정: Yes.**

선택적 잔여(미반영): 재리뷰어가 교차 독립 테스트에 대칭 단언 1줄을 더하면 약간 강해진다고 했으나, 현 단언으로 키 구별이 이미 증명되어 추가하지 않음.

검증 재실행 결과: cso/ts/lint 모두 재통과(261/261 GREEN). review 게이트 통과 → user-verification 진입.
