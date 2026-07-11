# 코드 리뷰 이슈 — feat/map-arena

- **리뷰 커밋:** BASE `a5626f7` (origin/main) → HEAD `5b1c060`
- **리뷰어:** 독립 subagent (general-purpose, superpowers:requesting-code-review 패턴)
- **일시:** 2026-07-11

---

## Critical

### #1 카메라 팔로우가 발사체 화면 밖 컬링을 깨 외곽 링에서 전투가 죽음 — **수정됨**

`Projectile._checkOutOfBounds`·`EnemyProjectile._checkOutOfBounds`가 원점 기준 `|x|>740 || |y|>740`(주석: "좌표계 원점이 화면 중앙이므로")으로 컬링했다. 이 슬라이스가 카메라 팔로우 + 플레이어 클램프(±1175 로밍)를 도입하면서, 발사체는 아레나 절대좌표(정적 `bulletParent`)에 스폰되므로 플레이어가 벽 근처(|x|>740)에서 쏘면 발사체가 즉시 사라졌다. 결과: 아레나 외곽 링에서 전투가 무력화되는 게임브레이킹 회귀.

**수정:** 순수 `ArenaLogic.isOutsideArena(pos, arena, margin)`를 신설(원점 중심 아레나 경계 + 여유 기준)하고, 두 발사체의 `_checkOutOfBounds`가 이를 써 **아레나 경계로 컬링**하도록 바꿨다. 아레나 미로드 시엔 기존 화면 기준으로 폴백. 순수 테스트 4건 추가(안/경계/x초과/y초과). 발사체가 아레나 안이면 살아 있으므로 벽 근처 발사가 정상 동작한다. 이 슬라이스가 만든 로밍이 노출한 회귀라 이 슬라이스에서 수정.

## Important

### #2 `setContentSize`가 Sprite SizeMode에 덮일 수 있음 — **수정됨(QA 레시피 보강)**

`MapManager._sizeBackdrop`의 `setContentSize`는 Sprite `Size Mode`가 TRIMMED/RAW면 스프라이트프레임 원본 크기에 덮인다. **Context7 확인:** 스크립트 `setContentSize`나 인스펙터로 크기를 바꾸면 SizeMode가 CUSTOM으로 **자동 전환**되므로 런타임 코드 경로는 안전하다. 다만 씬 로드 초기 한 프레임 프레임크기로 뜨는 것을 막게 QA 레시피 §4에 "Sprite Size Mode = CUSTOM" 명시 단계를 추가. 코드 수정 불필요.

### #3 벽 근처 발사 회귀를 잡을 QA 항목 부재 — **수정됨(QA 항목 추가)**

#1이 QA 체크리스트에 잡히지 않았다. §6에 "벽 근처 발사체 발사(회귀 방지)" 수동 항목을 추가. 순수 로직은 `isOutsideArena` 테스트로 커버.

## Minor

### #4 벽 근처 스폰이 플레이어에 몰림 — **노트(이월)**

`EnemySpawner._spawnEnemy`가 반경 350 스폰을 아레나 안으로 클램프하면서, 플레이어가 벽에 붙으면 링 일부가 벽에 눌려 적이 플레이어 근처에 스폰될 수 있다. 계획이 스폰 튜닝을 이월했으므로 노트만. 경계형 아레나로 새로 드러난 상호작용이라 스폰 곡선 설계 시 의식. → 백로그 후보.

### #5 런타임 `orthoHeight` 할당만으론 `.scene` churn을 못 막음 — **수정됨(QA 노트)**

`CameraController.onLoad`의 `orthoHeight` 할당은 런타임 변동만 막는다. F9 `.scene` diff churn은 **에디터 값**이 360으로 박혀야 막힌다. QA §6 F9 항목에 에디터 값 고정 명시.

### #6 종횡비 유도 — **조치 없음(확인만)**

`viewHalfW = orthoHeight * (size.width/size.height)`(`getVisibleSize`)는 기존 `Projectile`/`EnemyProjectile` 사용과 일관되고 `fitHeight:true`에 정확. 리뷰어가 확인만 표기.

---

## 재검증

리뷰 #1 수정 후: 피처 테스트 13/13, 전체 스위트 443/443 GREEN. biome clean, TS 진단 0(Projectile·EnemyProjectile·ArenaLogic). 수정이 코드리뷰발이라 `pnpm wf invalidate`로 전체 검증 초기화 후 cso→ts→lint 재통과.

## 재리뷰 (원 리뷰어, HEAD e3f53bb)

**판정: Yes — Critical #1 해소, 진행 가능. 신규 correctness 이슈 없음.** 2400² 아레나에서 컬 임계 ±1300 > 플레이어 로밍 ±1175라 벽 발사가 살아남고, 아레나 밖 ~125px에서만 컬링된다. 미로드 폴백(화면 기준)은 카메라 정적 구간과 정합. 비정방 아레나도 width/height 축 독립 처리로 정상. 임포트 순환 없음.

**비블로킹 옵션 노트(이연) → `backlog-implement.md` F36:** ① 발사체 핫패스 `isOutsideArena({x,y}, …)` 프레임당 리터럴 할당(미미한 GC 압박, G1 할당 위생으로) ② `isOutsideArena` 테스트가 정방만 커버(비정방 케이스 1건 추가 권장). 둘 다 리뷰어가 "지금 고치지 말 것" 권고.
