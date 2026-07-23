# player-hitbox — 테스트 체크리스트

- **브랜치:** feat/player-hitbox
- **정본:** [`../decisions/006-collision-hitbox.md`](../decisions/006-collision-hitbox.md) (ADR 006), [`../development/sessions/2026-07-23-player-hitbox-plan.md`](../development/sessions/2026-07-23-player-hitbox-plan.md)
- **범위:** 플레이어가 **적·적 발사체에 맞는 피해 판정**을 원(반지름 25)에서 **AABB 박스**로 바꾼다. 플레이어 이동·벽 충돌·적·픽업은 무변경.

## Impact Map

| 변경 파일 | 확인 범위 (회귀 기준) |
|-----------|----------------------|
| `logic/HitboxLogic.ts` (신규 순수) | `circleIntersectsBox` 자동 테스트 |
| `data/GameTypes.ts` `IPlayerBaseData` + `resources/data/player.json` | 데이터 로드 정상, 박스 필드 존재 |
| `EnemyController._checkContactDamage` | 적 접촉 피해 — 세로 정합, 좌우 억울 피격 제거 |
| `EnemyProjectile._checkPlayerHit` | 적 발사체 피격 — 동일 기준 |
| **무변경(회귀 확인)** | 플레이어 이동·벽·아레나(`resolveCircleMove`), 픽업 반경, XP 흡수, 마법, 적끼리·발사체-적 판정 |

## 씬/프리팹 변경 사항

**없음** — 데이터·순수 로직만 바뀐다. 플레이어 노드·`Sprite`·`UITransform`·`@property` 모두 그대로다.

## 에디터 연결 체크리스트

**없음** — 이 슬라이스는 에디터 조립·`@property` 연결 항목이 없다(사용자 에디터 작업 0).

## 자동 테스트로 검증

> **통과(2026-07-23):** 피처 테스트 `PlayerHitbox` 8/8 + 전체 스위트 595/595 GREEN.

- [x] `circleIntersectsBox` — 원 중심 내부/외부, 면 접함(거리 == 반지름 = 겹침 아님)/파고듦, **세로 박스가 머리 높이 명중을 잡음**(원-원이면 놓칠 지점), **좌우 그레이즈가 안 겹침**(높이 맞춤 원이면 났을 억울 피격 제거), 코너 최근접점, 비원점 박스(플레이어 위치). → `tests/logic/PlayerHitbox.test.ts`

## 수동 테스트 체크리스트 (7단계 인게임)

- [ ] 세로 브릿지에서 적이 **머리·발 높이**로 접촉해도 피해가 들어온다(원-원이면 놓치던 상/하단이 이제 잡힌다).
- [ ] 적이 **좌우로 스쳐 지날** 때 억울한 피격이 없다(닿지 않았는데 맞는 일이 없어야 한다).
- [ ] 적 **발사체**가 같은 기준으로 명중/회피된다(몸통엔 맞고 옆으로 스치면 안 맞음).
- [ ] 벽·건물 **미끄러짐**과 아레나 클램프가 그대로다(이동 원 무변경 — ADR 006 「결과·후속」의 세로 겹침은 이 슬라이스 밖).
- [ ] **픽업 반경·XP 흡수**가 그대로다(별개 축, 무변경).
- [ ] 무적(i-frame) 구간 피격 무시가 그대로다.
