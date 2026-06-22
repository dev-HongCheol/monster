# magic-slow 코드 리뷰 이슈

> 브랜치: `feat/magic-slow` (magic-S3 — 슬로우 + CC 다중 타이머 모델 전환 F14)
> 리뷰 범위: `091189e..8cef50a` (`superpowers:requesting-code-review` 패턴, general-purpose 서브에이전트)
> 판정: **With fixes** — 구현은 정확하고 정지 단독 동작 불변, "무변경" 표면 주장 전부 코드로 검증됨(230/230 GREEN). 유일한 머지 게이트는 의도된 TEMP `startingSpellIds` 복원(이미 QA 문서 추적 중).

리뷰어가 꼽은 강점: 정지 단독 경로의 동작 불변성을 만료 경계(중간·정확 만료·초과)에서 추적해 단일 슬롯과 동일 확인, `appliedStrength`를 틱 이후 1회 산출해 3 소비처에 전달하는 순서 정확(스테일니스 함정 회피), `STATUS_KIND_STRENGTH(slow)`·`Projectile._applyStatus` 강도 무관·단일명중 경로·`isDurationCapable(onHitStatus)` 등 "무변경" 주장 전부 코드로 검증, 틴트 우선순위(사망>플래시>CC>기본) 보존 + 정지색 바이트 동일, 테스트가 튜플 내부가 아닌 공개 함수로 실동작 검증.

---

## Critical
없음.

## Important

### #1 TEMP `startingSpellIds` — 머지 차단 항목 (의도됨, 추적 중)

`SpellCaster.ts:50`의 `startingSpellIds = ['ice_missile', 'lightning_bolt']`는 테스트 전용 변경(L49 주석 명시)이다. 머지 전 `['fireball']`로 복원해야 한다. 워크플로우상 7단계 사용자 테스트 후 9단계(머지) 직전 복원하며, QA 문서(`magic-slow-test.md`) 수동 체크리스트에 복원 항목이 이미 있다. **결함이 아니라 예정된 절차 항목** — 누락 방지용으로 기록.

→ 처리: 9단계 머지 직전 복원 (QA 체크리스트로 추적).

## Minor (조치 불필요 — 기록만)

### #2 `spells.json` 슬로우 placeholder 수치 — 밸런싱 TBD
`ice_missile`의 `onHitStatus { chance: 0.9, durationSec: 2 }`는 영구 커밋되는 placeholder다(TEMP 로드아웃과 달리 머지됨). 계획상 §밸런싱 TBD. 코드 이슈 아님 — 밸런싱 단계(백로그 B 계열)에서 확정. 현 값은 "슬로우=거의 항상·약하게" 정체성에 맞춘 초안.

### #3 튜플 인덱스 0(None) 미가드 — 무해
`StatusEffectLogic.applyControl`이 `next[strength]`에 쓴다. `None`(0)으로 호출하면 미사용 슬롯에 쓰이나, `tickControl`이 인덱스 0을 항상 0으로 고정하고 `appliedStrength`/`hasActiveControl`이 0번을 안 읽어 무해하며, 어떤 호출부도 `None`을 넘기지 않는다. 로버스트니스 노트.

### #4 CC 틴트 색 3개 per-instance — 공유 상수화 여지
`_stunTint`/`_slowTint`/`_freezeTint`가 인스턴스별 불변 `Color`다. 모듈 상수로 올릴 수 있으나 기존 `_ccTint` 패턴과 동일해 회귀 아님. `_freezeTint`는 S6 전까지 미사용(전방 배선, 문서화됨). 후속 정리 기회.

### #5 `durationSec=0` 동작 차이 — 개선(무해)
구 단일 슬롯은 0지속 정지를 한 프레임 Stun으로 읽을 수 있었으나, 새 모델은 즉시 None. `> 0` 불변식에 부합하는 더 깔끔한 동작이며 실데이터에 그런 입력 없음. `MagicCc.test.ts:55-59`로 고정.

---

## 처리 요약

- **코드 품질·타입 안전성·실제 버그 이슈: 0건.** 코드 수정 없음 → `wf invalidate` 불필요.
- #1은 9단계 머지 직전 복원(워크플로우 절차, QA 추적).
- #2~#5는 기록만(조치 불필요/후속).
- → `wf pass review`로 진행.
