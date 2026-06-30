# 발사체 일시정지 가드 (projectile-pause-guard) 코드 리뷰 이슈

- **리뷰 커밋:** `1fb828f` (BASE `origin/main` `3b4f032`)
- **리뷰어:** general-purpose 서브에이전트 (`superpowers:requesting-code-review` 패턴)
- **평결:** **Ready to merge — Yes** · Critical 0 · Important 0 · Minor 2

## Critical / Important

없음. 가드가 두 `update()`의 **맨 첫 문장**(`EnemyProjectile.ts:72`·`Projectile.ts:88`)이라 일시정지 중 이동·`damagePlayer`·`_detonate`·화면 밖 반환이 전부 멈춘다. `GameState`(`GameTypes.ts:4`)·`GameManager.instance`(`static instance!`, `:64`)·`state` 게터(`:47`)·import 경로·biome 정렬 모두 검증 통과. 풀링 정합도 확인 — 정지 중 `update`가 일찍 반환해 `_despawned`가 `false`로 유지, 재개 시 정상 이동·명중·반환(이중 반환 없음). 전체 스위트 344/344 GREEN(회귀 0). skip-test 정당성 인정(싱글톤 읽기 + Cocos 라이프사이클이라 추출할 순수 로직 없음, 유사 가드도 같은 이유로 미테스트).

## Minor

둘 다 리뷰어가 **이 fix의 범위 밖**으로 명시 판정. 코드/버그/타입 수정이 아니라 동작 무영향 관찰이라, 즉시 수정 대신 백로그로 집약한다(CLAUDE.md 「무관 이슈 → 언급만」·로버스트니스→backlog 규칙). `invalidate` 불필요(코드 변경 없음).

### M1 — `XPItemController.update`도 같은 가드 부재 — 백로그 이관(I2)
`XPItemController.ts:51`. 전체 `components/`·`systems/`의 `update()`를 훑은 결과, 다른 티커(`PlayerController:39`·`SpellCaster:154`·`EnemyController:218`·`EnemySpawner:105`·`WaveManager:46`·`GameManager:78`)는 전부 상태 가드가 있고 두 발사체는 이번에 닫혔다. 남은 미가드 티커는 `XPItemController` 하나. 단, 이 컴포넌트는 **이동하지 않고** 플레이어까지 거리만 재 흡수한다. 레벨업 중엔 플레이어도 정지(`PlayerController` 가드)라 상대 거리가 정적이고, 유일한 관측 효과는 *이미 픽업 반경 안에 있던* XP 오브가 정지 프레임에 흡수되는 것뿐이다(경험치 획득 — 무해, 메뉴는 모달). **I1 발사체 공정성 버그와 무관한 기존 동작**이라 이 fix에서 제외가 옳다. → **백로그 I2**(같은 LevelUp 일시정지 정합성 테마).

### M2 — `GameManager.instance` null 가드 부재(엔티티 패턴과 동일) — 백로그 이관(F24)
새 가드는 `EnemySpawner:104`·`WaveManager:46`의 `if (!GameManager.instance) return;` 선행 체크 없이 `GameManager.instance.state`를 직접 읽는다. 단 이는 **신규 리스크가 아니다** — 발사체는 스폰 이후에만 존재해 그 시점엔 `instance`가 세팅돼 있고, null 구간은 씬 teardown(`onDestroy`)뿐인데 이는 `SpellCaster`/`EnemyController`/`PlayerController` 엔티티 가드가 이미 지는 동일 노출이다. fix가 *엔티티* 패턴을 정확히 따랐으므로 바꾸지 않는 게 맞다. 코드베이스에 두 컨벤션(null 체크 유/무)이 공존하는 정리 사안일 뿐. → **백로그 F24**(코드베이스 전역, 별건).

## Recommendation
- 위 M1·M2를 백로그(I2·F24)에 기록해 의도된 제외가 잊히지 않게 한다(리뷰어 권고). 둘 다 이 PR 범위 밖.
