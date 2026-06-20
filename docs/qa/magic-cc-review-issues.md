# magic-cc 코드 리뷰 이슈

> 브랜치: `feat/magic-cc` (magic-S2 — CC 단일 슬롯 + 라이트닝 볼트 확률 정지 + 지속시간 강화)
> 리뷰 커밋: `0325764` (리뷰 범위 `b510a6b..0325764`, `superpowers:requesting-code-review` 패턴 subagent)
> 판정: **With fixes** — 구현은 §9.4에 충실하고 S1 폭발 설정 패턴과 깔끔히 통합됨. 유일한 실질 공백은 지속(Duration) 강화 게이트의 회귀 테스트 부재(#1).

리뷰어가 꼽은 강점은 순수/cc 분리(`StatusEffectLogic`는 완전 불변·`cc` 무의존), magic-S1 폭발 설정 패턴의 충실한 미러링, 틴트 우선순위(사망>플래시>CC>기본)의 견고함, Stun만 생산하지만 세 강도를 모두 해석하는 전방 대비, i18n 키 정합 유지였다.

아래는 지적 사항과 처리 결과다. 코드 품질·버그성 항목은 즉시 수정했고, 설계 판단이 필요한 항목은 백로그로 집약했다.

---

## Important

### #1 지속(Duration) 강화 게이트에 회귀 테스트가 없음 — **수정됨**

`tests/logic/MagicCc.test.ts`가 `StatusEffectLogic` 순수 함수만 검증하고 `EnhancementLogic`을 전혀 임포트하지 않았다. 이번 슬라이스의 핵심 산출물(백로그 A3)인 `isDurationCapable` 게이트 + `Duration` 카드 생성(`EnhancementLogic.buildUpgradeCards`)이 회귀 가드 없이 비어 있었다. 같은 패턴의 선례(`MagicExplosion.test.ts`의 Range 게이트 테스트)가 이미 레포에 있어 대칭 케이스를 그대로 추가할 수 있었다.

**수정:** `MagicCc.test.ts`에 A3 게이트 테스트 4개 추가.
- CC(`onHitStatus`) 보유 마법은 개별 `upg_lightning_bolt_duration` 카드 생성.
- CC 없는 마법(폭발만 가진 마법 포함)은 `_duration` 카드 미생성 — 범위 적격이지만 지속 부적격인 fireball을 반대 케이스로 고정.
- 적격 마법이 있는 분류만 `cupg_lightning_duration` 생성, `cupg_fire_duration`·`cupg_ice_duration` 미생성.
- Duration 레벨 4(maxed)면 해당 마법 Duration 카드 제외(다른 옵션은 유지).

검증: MagicCc 22/22 통과.

### #2 단일 슬롯 max/max 합치기 — cross-strength 지속 결합은 S3/S6 전방 위험 — **기록(백로그 F14)**

이번 슬라이스(Stun 단일 강도, 모든 소스 동일 강도)에서는 합치기가 정확하다. 우려는 강도가 섞이기 시작할 때다. `applyControl({Freeze, 0.3}, Slow, 1.0)` → `{Freeze, 1.0}`, 즉 더 약하고 더 긴 슬로우가 빙결의 남은 시간을 1.0초로 늘린다. 기획서 §9.4("지속시간은 활성 소스 중 max")의 문자적 해석으로는 방어 가능하지만, "활성 소스"는 단일 슬롯이 표현 못 하는 소스별 만료를 함의한다.

**처리:** 현 동작이 의도임을 테스트에 고정 — `MagicCc.test.ts`의 cross-strength 합치기 케이스에 `.remaining` 단언과 주석 추가(약한·긴 소스가 강한 강도의 지속을 max로 연장하는 현 동작을 명시, S3·S6에서 의미 정밀화 결정). 백로그 **F14**(📐)로 등재해 슬로우(S3)·빙결(S6) 착수 시 소스별 추적 vs 현 max/max 유지를 명시적으로 결정하도록 했다.

---

## Minor

### #3 `tickControl`이 매 프레임 모든 적에게 `ControlState`를 새로 할당 — **수정됨**

제어가 걸리지 않은 적도 매 프레임 `emptyControl()`을 만들어 빈 상태를 유지했다. `_followPlayer`의 기존 `new Vec3()`와 같은 종류라 회귀는 아니지만, 적 밀집 서바이버류에서 피할 수 있는 GC이고 이 파일은 할당 회피(`_scratchColor`)에 명시적으로 신경 쓴다.

**수정:** `EnemyController.update`에서 `if (this._control.strength !== ControlStrength.None) this._control = tickControl(this._control, dt);`로 가드. 빈 슬롯은 `applyControl` 없이는 비지 않은 상태가 되지 않으므로 안전하다.

### #4 `shouldApplyStun`은 Stun 이름이지만 실제로는 일반 CC 롤 — **수정됨**

`Projectile._applyStatus`가 이미 강도 무관(`s.strength`가 슬로우·빙결일 수 있음)하게 쓰는데 이름이 Stun에 묶여 있어, S3/S6 재사용 시 오해를 부른다.

**수정:** `shouldApplyStun` → `shouldApplyControl`로 개명(`StatusEffectLogic.ts` 정의, `Projectile.ts` 임포트·호출·JSDoc, `MagicCc.test.ts` 임포트·테스트 일괄).

### #5 `hitEffect: explosion` + `onHitStatus` 동시 보유 마법은 폭발 경로가 CC를 조용히 누락 — **기록(백로그 F15)**

`Projectile._checkEnemyHit`의 폭발 분기는 `_detonate`만 타고 `_applyStatus`를 거치지 않아, 폭발 마법에 CC를 붙여도 적용되지 않는다. 계획에서 명시적으로 스코프 밖이고 현재 그런 마법이 없어 무해하지만, 가드나 경고가 없어 미래 데이터 작성자가 조용히 당할 수 있다.

**처리:** 백로그 **F15**(🐛)로 등재 — 폭발+CC 마법을 추가할 때 폭발 경로로 CC를 확장하거나 "explosion과 onHitStatus 공존 불가" 불변식을 데이터 검증(D2)으로 강제할지 결정.

---

## 권고 처리 (리뷰어 Recommendations)

- **#1 머지 전 닫기** → 수정 완료.
- **#2 백로그 노트로 캡처** → F14 등재 + 테스트 고정.
- **#3 가드 적용** → 수정 완료.
- **TEMP `startingSpellIds` → `['fireball']` 되돌리기는 머지 단계에서** → 7단계 인게임 테스트를 위해 현재 의도적으로 `['lightning_bolt']`로 커밋됨. QA 문서·계획 문서의 되돌리기 체크리스트로 추적, 9단계(머지) 직전 복구.

---

## 재리뷰 (커밋 `e2ab3d9`, 수정분 `c06c75e`+`e2ab3d9`)

수정 후 같은 범위(`b510a6b..e2ab3d9`)로 재리뷰. 판정: **Ready to merge — Yes.**

리뷰어가 HEAD 코드를 직접 추적해 5건 모두 정상 종결됨을 확인했다.
- #1: 4개 Duration 게이트 테스트가 형식적이 아니라 실제 회귀 가드 — 범위 적격(`explosionRadius`)이 지속 적격으로 새지 않음을 비-CC 케이스가 검증(핵심 단언), 분류·maxed 케이스도 의미대로 격리.
- #3: tick 가드가 증명상 정확 — `strength === None ⟺ 빈 슬롯`이고 빈 슬롯 tick은 무연산이라 스킵해도 동작 동일, 만료 프레임은 여전히 tick 돼 틴트 복원 정상.
- #4: 개명 완전·순수(본문 `return rand < chance` 불변). 남은 `shouldApplyStun` 토큰은 이 문서의 개명 서술뿐(올바른 히스토리).
- #2·#5: 전방 노트(F14·F15) 처리가 적절 — 지금 머지 의미를 바꾸면 추측적·테스트 불가, 폭발+CC 가드는 현재 dead code.

**남은 Minor 2건 (선택, 미차단 — 추가 수정 없이 기록만):**
- `MagicCc.test.ts:139-164` `makeCcSpell`/`makePlainSpell`가 마지막 필드만 달라 공통 팩토리로 묶을 여지(순전히 미용, 기존 테스트 스타일과 일치). → 차단 아님.
- `MagicCc.test.ts:190-199` maxed 제외 테스트가 Individual 트랙만 커버. 분류 트랙은 같은 `continue` 로직을 공유해 위험 미미하나, 한 줄 분류-maxed 단언으로 대칭을 닫을 수 있음. → 선택.

두 항목은 리뷰어가 "negligible/optional, not worth blocking"으로 명시했고, 수정 시 전체 검증 재순환 비용이 이득에 비해 과하다고 판단해 이 문서 기록으로 갈음한다(코드 변경 없음).
