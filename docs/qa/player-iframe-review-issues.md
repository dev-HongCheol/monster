# 플레이어 피격 무적(i-frame) 게이트 — 코드 리뷰 이슈

- **브랜치:** feat/player-iframe
- **리뷰 커밋:** `0a7af57` (base `4e4a545`)
- **리뷰어 판정:** Ready to merge — With fixes (테스트 1건). Critical 0, Important 1, Minor 5.

---

## Important (수정함)

### 1. `dt > T` 랙 스파이크 케이스 테스트 누락 — `tests/logic/PlayerIframe.test.ts`

**수정됨** (`<재검증 커밋>`).

- **지적:** 단일 `tickDamage` 호출은 `dt`가 아무리 커도 `pendingMax`를 **딱 1회만** 적용한다(랙 스파이크가 한 프레임에 여러 틱분 피해를 쌓지 않음). 구현은 이미 올바르나, 이 모델의 가장 위험한 가장자리 불변식이 어떤 테스트로도 고정돼 있지 않았다. 기존 이월 테스트는 `dt=0.1 < T`, DPS 루프는 `dt == T`만 다룬다.
- **수정:** `tickDamage(0, 40, 1.2, 0.5)` → `applied: 40`(1회만), `timer: 0.7`(`dt − T` 이월), `pendingMax: 0`을 단언하는 케이스 추가. 소스 변경 없음(테스트만).

---

## Minor (기록만 — 설계상 의도된 트레이드오프, 백로그/플랜에 이미 추적)

2. **심한 스파이크 후 이월값이 T를 초과 가능** — `PlayerDamageLogic.ts:51`. `dt > 2T`면 다음 프레임이 즉시 경계를 넘어 연속 프레임에 두 번 명중할 수 있다. DPS는 실경과 시간을 따라가 자기보정되므로 의도된 동작(이월 비클램프 = DPS 보존). 의도를 알리는 인라인 주석을 추가한다.
3. **틱 내 max가 sticky** — `GameManager.ts`. 한 구간 안에서 `pendingMax`는 감소하지 않아, 센 적이 일찍 스쳐 떠나도 경계에서 그 청크가 적용된다. 틱당 max 구간(max-window) 모델의 본질, ≤T로 한정. 기록만.
4. **짧게 스치는 접촉이 한 틱 분량으로 증폭** — `contactDamagePerTick`. `< T` 접촉도 다음 경계에서 `C·T` 전체를 준다. 지속 접촉의 평균 DPS만 보존된다. 플랜 §7 / QA 백로그(T 밸런싱)에서 이미 추적. 밸런싱 패스에서 검증.
5. **GameManager 통합 경로 자동 커버리지 없음** — 상태 가드·`_applyDamage` GameOver 경로·update 순서는 수동 QA만. 프로젝트 컨벤션(cc 의존 → 수동)에 부합하나, GameOver 트리거가 즉시 경로→틱 경로로 **이동**해 회귀 위험이 커진 점을 QA 수동 항목으로 명시(이미 체크리스트에 사망 전이 포함).
6. **플랜/구현 필드명 드리프트(외형)** — 플랜 §4.2는 `_tickTimer`/`_tickMax`, 구현은 `_hitTickTimer`/`_pendingDamageMax`. 구현 쪽이 더 명확. 문서/코드 차이 기록만.

---

## 처리 방침

- Important 1 → 즉시 수정(테스트 추가) + Minor 2 의도 주석 추가.
- Minor 3·4·5·6 → 설계상 의도/컨벤션 부합으로 코드 변경 없음. 4는 밸런싱 백로그에서 추적, 5는 QA 수동 체크리스트로 커버.
