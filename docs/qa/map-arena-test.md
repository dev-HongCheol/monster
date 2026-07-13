# QA 체크리스트 — 맵/배경: 경계형 아레나 + 카메라 팔로우 (feat/map-arena)

- **브랜치:** feat/map-arena
- **계획 문서:** [`../development/sessions/2026-07-11-map-arena-plan.md`](../development/sessions/2026-07-11-map-arena-plan.md)
- **대상:** 경계형 아레나(외곽 벽 + 플레이어 클램프), 카메라 팔로우 + 벽 클램프, 서울 배경 placeholder, 데이터 주도 맵 포맷(`seoul.json`) 최소 스키마. 장애물 충돌·다중 맵 셀렉터는 이월.

---

## 1. Impact Map (변경 파일별 확인 범위)

| 파일 | 변경 | 회귀 확인 범위 |
|------|------|----------------|
| `logic/ArenaLogic.ts` (신규·순수) | `clampToArena`·`cameraFollowPosition`·`isOutsideArena` | 자동 테스트로 전량 검증 |
| `systems/MapManager.ts` (신규·Cocos) | `seoul.json` 로드 → 아레나 크기·배경 구성, 싱글톤 노출 | 씬 로드 시 배경 표시·아레나 크기 주입 |
| `components/CameraController.ts` (신규·Cocos) | 카메라 팔로우 + 벽 클램프 + `orthoHeight` 고정 | 카메라 이동·클램프, 크로스머신 diff(F9) |
| `resources/data/maps/seoul.json` (신규·데이터) | `{ id, size, backdrop }` | 로드 성공, `size` 변경이 아레나에 반영 |
| `components/PlayerController.ts` (수정) | `_move` 말미에 `clampToArena` | 플레이어가 벽을 못 넘는지 + 기존 이동 정상 |
| `systems/EnemySpawner.ts` (수정) | `_spawnEnemy` 스폰 위치 `clampToArena` | 적이 아레나 안에만 스폰 + 기존 스폰 정상 |
| `systems/DataManager.ts` (수정) | 맵 JSON 로드 경로 추가 | 기존 마법·적·카드 로드 회귀 없음 |
| `components/Projectile.ts` (수정·리뷰 #1) | `_checkOutOfBounds` 원점 기준 → 아레나 경계 컬링(`isOutsideArena`) | 벽 근처 발사 시 발사체 정상 비행·명중 |
| `components/EnemyProjectile.ts` (수정·리뷰 #1) | `_checkOutOfBounds` 아레나 경계 컬링 | 적 발사체 외곽 링 정상 동작 |
| `scenes/main.scene` (수정) | Align Canvas 해제·CameraController·MapManager·Backdrop 크기·orthoHeight | 게임/HUD 렌더, 카메라 동작 |

---

## 2. 자동 테스트로 검증 (`tests/logic/MapArena.test.ts`)

> **통과 근거:** 피처 테스트 13/13 + 전체 스위트 443/443 (33 파일) GREEN (리뷰 #1 수정 반영).

- [x] `clampToArena` — 안쪽 위치 보존, 우/하 벽 초과 시 반경만큼 클램프, 모서리 동시 클램프, 반경 > 아레나 절반이면 중앙(0).
- [x] `cameraFollowPosition` — 중앙 일치, 여유 시 그대로 팔로우, 벽 근처 시 뷰 가장자리 클램프, 아레나 < 뷰면 중앙(0).
- [x] `isOutsideArena` — 아레나 안은 밖 아님, 경계+여유는 포함(밖 아님), x·y 각각 초과 시 밖.

이 두 순수 함수 외 카메라·씬·배경 배선은 cc 의존이라 아래 수동 항목으로 검증한다.

---

## 3. 씬 변경 사항 (`main.scene`) — (확정)

원점(0,0) 중심 2400×2400 아레나(placeholder 크기), 720p 기준 카메라. 아래 수치는 placeholder이며 인게임 튜닝 대상이다.

| 노드 | 변경 | 값 |
|------|------|-----------|
| 게임 `Canvas` | `Align Canvas With Screen` **체크 해제** | — (카메라 독립 이동 조건, Context7 확인) |
| `Camera` (게임) | `CameraController` 부착, `Projection=ORTHO`, `orthoHeight` **고정 360** | 현재 1175.29(churn 아티팩트) → 360 |
| `MapManager` (신규 노드) | 빈 노드 + `MapManager` 컴포넌트 | 다른 매니저 노드와 같은 위치 |
| `Backdrop` | Content Size를 아레나에 맞춤 | 2400×2400, Position (0,0) |

---

## 4. 에디터 조립 레시피 — (확정)

> 사용자가 문서만 보고 세팅할 수 있게 순서·수치를 준다. `@property` 이름은 구현 후 코드 기준으로 확정한다.

**목표 계층 (main.scene 관련 부분):**

```
main (Scene)
 ↳ Camera            (게임 카메라 — CameraController 부착)
 ↳ Canvas            (게임 — Align Canvas With Screen 해제)
    ↳ Backdrop       (서울 배경 placeholder, 2400×2400)
    ↳ Player
    ↳ BulletParent
    ↳ … (기존 게임 오브젝트)
 ↳ MapManager        (신규 — MapManager 컴포넌트)
 ↳ GameManager · DataManager · EnemySpawner · … (기존 매니저)
 ↳ UICanvas          (HUD — 영향 없음)
```

**만드는 순서:**

1. **MapManager 노드 생성** — 기존 매니저 노드(GameManager·DataManager 등)와 같은 계층에 빈 노드를 만들고 이름을 `MapManager`로. `Add Component → MapManager` 부착.
2. **Camera에 CameraController 부착** — 게임 `Camera` 노드 선택 → `Add Component → CameraController`. Inspector에서 `Projection=ORTHO` 확인, `orthoHeight=360`으로 고정.
3. **게임 Canvas 설정** — 게임 `Canvas` 노드의 `Canvas` 컴포넌트에서 `Align Canvas With Screen` **체크 해제**. (HUD의 `UICanvas`는 건드리지 않는다.)
4. **Backdrop 크기** — `Backdrop` 노드 Content Size를 `2400 × 2400`, Position `(0, 0)`으로. **Sprite `Size Mode`를 `CUSTOM`으로** 둔다(안 그러면 스프라이트프레임 원본 크기가 Content Size를 덮어 배경이 아레나를 못 덮는다). Context7 확인: 스크립트 `setContentSize`나 인스펙터로 크기를 바꾸면 `Size Mode`가 CUSTOM으로 자동 전환되지만, 명시해 두면 씬 로드 초기 한 프레임 프레임크기로 뜨는 것을 막는다. (서울 배경 스프라이트는 placeholder — 최종 아트는 아트 단계.)
5. **`@property` 연결** — 아래 5절 표대로.

> Cocos 컴포넌트 동작(Camera 팔로우 시 Align Canvas 해제 필요 등)은 계획 §4에서 Context7 공식 문서로 확인했다. `PolygonCollider2D`·`TiledMap`은 이번 슬라이스에서 쓰지 않는다(장애물 이월).

---

## 5. 에디터 연결 체크리스트 (`@property`) — (확정)

| 컴포넌트 | `@property` | 연결 노드 | 상태 |
|----------|-------------|-----------|------|
| `CameraController` (Camera) | `playerNode: Node` | `Player` | ❌ |
| `CameraController` (Camera) | `orthoHeight: number` (기본 360) | — (값, 노드 연결 없음) | ❌ |
| `MapManager` (MapManager) | `backdropSprite: Sprite` | `Backdrop`의 Sprite | ❌ |

> 아레나 크기는 `MapManager`가 `seoul.json`에서 읽어 싱글톤(`MapManager.instance.arena`)으로 노출하고, `CameraController`·`PlayerController`·`EnemySpawner`가 그 값을 읽는다(추가 `@property` 없음). `@property` 이름은 구현 코드 기준으로 확정됐다. `상태` ❌는 7단계 사용자 씬 배선에서 연결한다.

---

## 6. 수동 테스트 체크리스트 (인게임)

- [x] **플레이어 벽 클램프** — 아레나 가장자리로 계속 이동해도 벽을 넘지 못하고 경계에서 멈춘다(네 방향 전부).
- [x] **카메라 팔로우** — 플레이어가 이동하면 카메라가 따라와 플레이어가 대체로 화면 중앙에 유지된다.
- [x] **카메라 벽 클램프** — 플레이어가 벽에 붙어도 화면에 아레나 바깥(빈 공간)이 보이지 않는다. 카메라가 벽에서 멈춘다.
- [x] **벽 근처 발사체 발사 (회귀 방지)** — 네 벽·모서리 근처로 이동해 마법을 발사했을 때 발사체가 즉시 사라지지 않고 정상적으로 날아가 적에 명중한다. 적 발사체도 그 영역에서 정상 동작한다. (발사체가 아레나 절대좌표에 스폰되는데 원점 기준 화면 컬링에 잘려 외곽 링에서 전투가 죽던 회귀 — 리뷰 #1, `isOutsideArena`로 수정.)
- [x] **적 스폰 경계** — 적이 아레나 밖에 스폰돼 벽 너머에 갇히는 일이 없다. 플레이어가 벽 근처일 때도 스폰이 아레나 안에서 이뤄진다.
- [x] **서울 배경 표시** — Backdrop placeholder가 아레나를 덮어 보인다(가장자리에 빈 공간 없음).
- [x] **맵 크기 변경 반영** — `seoul.json`의 `size`를 예: `[3000,3000]`으로 바꾸면 아레나·클램프가 코드 변경 없이 커진다(확인 후 원복). 단 Backdrop은 그 크기를 덮도록 조정 필요.
- [x] **HUD 회귀** — HP/XP 바·타이머·마법 아이콘 행 등 UICanvas HUD가 카메라 팔로우와 무관하게 화면에 고정돼 정상 표시된다.
- [x] **레벨업/일시정지 회귀** — 카드 선택·ESC 일시정지가 카메라 이동 상태에서도 정상 동작한다.
- [x] **크로스머신 diff(F9) — 게임 `Camera`만 해결** — 게임 `Camera`의 `orthoHeight` **에디터 값**이 360으로 고정됐다(코드 할당은 런타임 변동만 막지, 직렬화 값은 에디터 값으로 박힌다). 확인: `Canvas.alignCanvasWithScreen=false`, `Camera.orthoHeight=360`, `CameraController` 부착.
- [ ] ~~**크로스머신 diff(F9) — 전면 해결**~~ → **부분 완료 (F9 잔존)**: `UICamera`의 `_orthoHeight`는 여전히 장비마다 재계산된다(이번 7단계 테스트에서 `1175.2965…` → `871.6564…`로 churn 재발). 원인은 `UICanvas.alignCanvasWithScreen=true`라 Cocos가 화면 크기에 맞춰 UICamera를 재fit·재직렬화하는 것이다. 이번 슬라이스는 **게임 Camera만** 고정했다. UICanvas 정렬 정책을 바꾸면 HUD 스케일링 회귀 검증이 따라붙으므로 별도 작업으로 분리한다 → 백로그 **F9 열린 상태 유지**.
