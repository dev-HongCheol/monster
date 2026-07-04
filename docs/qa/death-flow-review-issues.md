# 코드 리뷰 이슈 — death-flow (F26)

> **브랜치:** feat/death-flow
> **리뷰 커밋:** BASE `b841a5d` .. HEAD `7ccae77` (feat `636d5b3`)
> **리뷰어:** general-purpose subagent (superpowers:requesting-code-review 패턴)
> **판정:** Ready to merge — Yes. Critical 0 · Important 0 · Minor 1.

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
- **조치:** `if (!this.hpLabel || !this.hpBar)`로 수정. (커밋: death-flow 리뷰 반영)

---

## 설계/정책 지적 (기록만)

- `GameManager.restart()`/`goToMenu()`가 HudController 버튼 제거로 미사용이 됨 → 리뷰어도 "`goToResult()`와 대칭인 공개 씬 플로우 API로 남겨 두는 결정에 동의, 몇 슬라이스 더 미사용이면 정리" 의견. 이번 슬라이스 유지, 향후 J2/J3(일시정지·메뉴)에서 배선 예정.
