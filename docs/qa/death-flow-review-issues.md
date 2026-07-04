# 코드 리뷰 이슈 — death-flow (F26)

> **브랜치:** feat/death-flow
> **리뷰 커밋:** BASE `b841a5d` .. HEAD `7ccae77` (feat `636d5b3`) — 최초 리뷰(아래 M1)
> **재리뷰 커밋:** `f562df3` .. (연출 seam 재설계) — 아래 **재리뷰(2026-07-05)** 참조
> **리뷰어:** general-purpose subagent (superpowers:requesting-code-review 패턴)
> **판정:** 최초 Ready to merge — Yes (Minor 1). 재리뷰 as-is 머지 가능 (Minor 3, M2 수정·M3 QA이관·M4 커버).

---

## 리뷰어가 검증한 강점 (요약)

- 계획(§3)과 정확히 일치 — `scheduleOnce` 위임(지속 타이머 필드 없음), `DEATH_BEAT_SEC` 튜닝 노브, `@executionOrder(100)`, 죽은 코드 제거.
- **프리즈 전제 성립 확인:** 모든 게임플레이 시스템이 `state !== Playing`에 가드(`EnemySpawner`·`WaveManager`·`SpellCaster`·`EnemyController`·`Projectile`·`PlayerController`·`EnemyProjectile` + `GameManager.update`·피해 틱)라 GameOver에 정지, `HudController.update`만 계속 돌며 빈 바(`barRatio(0,·)=0`)를 그린다.
- **중복 스케줄 없음:** `_applyDamage`는 `update`→`_tickPlayerDamage` 경로로만 도달, GameOver 진입 후 `:81` early-return + 피해 제출도 Playing 가드 → 사망당 `scheduleOnce` 정확히 1회.
- 죽은 코드 dangling 참조 0 확인(`gameOverPanel`/`restartButton`/`menuButton`/`_onRestart`/`_onMenu` + `Button` import 제거). `ResultController`의 별도 `menuButton`은 무관·유지.
- executionOrder 안전(코드베이스에 `I18n(-1)`·`HudController(100)` 둘뿐, HUD는 상태를 읽기만 함). `scheduleOnce(cb, delay)` 올바른 사용(화살표로 `this` 바인딩·초 단위), 씬 teardown 시 Cocos가 파괴된 컴포넌트 콜백 자동 해제 → 비트 중 dead-object 발화 위험 없음.
- `_handleStateChange`의 `LevelUp`↔`Playing` 카드 패널 토글 정상 유지.

---

## Minor

### M1 — onLoad 필수 가드가 `hpBar`를 포함하지 않음 → **수정됨**

- **파일:** `ui/HudController.ts:32` (onLoad 가드)
- **지적:** 가드가 `if (!this.hpLabel)`로 줄었는데, 이 슬라이스의 핵심 시각 요소는 **HP 바**다. `hpBar` 미배선 시 `_updateHp`의 `if (this.hpBar)`가 조용히 no-op이 되어 죽음 비트가 안 보이는데도 "required properties not assigned" 에러가 안 뜬다. 회귀는 아니나(기존에도 3개만 검증) diff가 바로 이 줄을 건드리고 `hpBar`가 기능의 load-bearing 요소가 됐으므로 가드에 추가 권장.
- **조치:** `if (!this.hpLabel || !this.hpBar)`로 수정 (커밋 `311ba0e`). 재리뷰(같은 리뷰어) 확정: "M1 closed correctly, no new inconsistency, Ready to merge: Yes" — 나머지 `hpBar` 널가드(`:40`·`:64`)는 무해한 방어 코드로 모순 없음.

---

## 재리뷰 (2026-07-05, 연출 seam 재설계 — `f562df3` .. HEAD)

> 죽음 비트를 "빈 정지 0.8초(`GameManager`가 `scheduleOnce`로 직행)"에서 **연출 seam**으로 재설계한 뒤 재리뷰. 신규 `ui/DeathSequence.ts`(오버레이 페이드) + `GameManager._startDeathSequence`(위임/폴백).
> **판정:** Ready to merge — With fixes(optional), as-is 머지 가능. Critical 0 · Important 0 · Minor 3.
> **강점(요약):** seam이 `GameManager`를 연출 무지로 유지(교체 시 `DeathSequence`만 손댐 — 요구 1), `onLoad`의 opacity 0 강제로 평상시 오버레이 투명 보장(요구 2), 폴백·`_playing` 중복재생 가드·승리경로 즉시로드 전부 충족(요구 3·4·5), 순환 import 없음, 컨벤션 클린(no `!`, `@property |null`, JSDoc, 구조 순서), `tween(uiOpacity).to(...).call(cb).start()`가 3.8 정석 페이드.

### M2 — 폴백이 미배선을 조용히 삼킴 → **수정됨**

- **파일:** `ui/DeathSequence.ts`(`overlay` 미배선), `systems/GameManager.ts:_startDeathSequence`(`deathSequence` 미배선)
- **지적:** 에디터에서 `overlay`/`deathSequence`가 미배선이면 `scheduleOnce` 폴백으로 조용히 넘어가, 이 슬라이스가 없애려던 정적 프리즈(렉 느낌)를 콘솔 경고 없이 그대로 재현한다. 배선이 7단계 수동 작업이라 세팅 실수가 조용히 묻힌다.
- **조치:** 두 미배선 지점에 `warn()` 추가 — `DeathSequence.onLoad`(overlay 미배선, 로드 시점 조기 경고)와 `GameManager._startDeathSequence`의 else(deathSequence 미배선). 이 재리뷰 반영 커밋에 포함.

### M3 — 항상 활성 오버레이 overdraw → **QA 확인 항목으로 이관**

- **파일:** `ui/DeathSequence.ts` + QA §3.2(`active: true`)
- **지적:** opacity 0인 풀스크린 오버레이가 상시 활성이라 드로우가 컬링 안 될 수 있어 매 프레임 투명 quad overdraw 가능. bullet-heaven에선 무시할 수준으로 예상되나 측정 권고(블로커 아님).
- **조치:** QA §5에 프로파일러 확인 체크 항목 추가. 유의미하면 백로그(F28)에서 활성화-온-데스 전환 검토 — 단 그 전환은 아래 M4(비활성 노드 hang)와 상충하므로 현재로선 항상-활성 유지가 더 안전.

### M4 — 비활성 노드의 `scheduleOnce` 폴백 hang → **M2로 커버(레시피 + 경고)**

- **파일:** `ui/DeathSequence.ts:play` 폴백
- **지적:** `DeathSequence`가 비활성 노드에 붙으면 `onLoad` 미실행 + 비활성 노드의 `scheduleOnce` 미발화 → `onComplete` 미호출 → 씬 전환 hang. 오배치 시에만 발생(낮은 확률).
- **조치:** QA 레시피가 항상-활성 호스트(UICanvas/GameManager 노드)를 명시하고, M2의 `warn`이 미배선/오배치를 조기 노출한다. 추가 코드 변경 불필요.

---

## 설계/정책 지적 (기록만)

- `GameManager.restart()`/`goToMenu()`가 HudController 버튼 제거로 미사용이 됨 → 리뷰어도 "`goToResult()`와 대칭인 공개 씬 플로우 API로 남겨 두는 결정에 동의, 몇 슬라이스 더 미사용이면 정리" 의견. 이번 슬라이스 유지, 향후 J2/J3(일시정지·메뉴)에서 배선 예정.
- **씬 로드 플래시(재리뷰):** `DeathOverlay`는 `director.loadScene` 시 파괴돼 완전 암전 뒤 로드 순간 플래시는 못 덮는다 — 리뷰어도 "계획에 정확히 문서화된 알려진 한계, 스코프 밖이라 결함 아님"으로 확인. 백로그 F28에 집약.
