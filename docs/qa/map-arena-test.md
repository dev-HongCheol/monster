# QA 체크리스트 — 맵/배경: 경계형 아레나 + 카메라 팔로우 (feat/map-arena)

- **브랜치:** feat/map-arena
- **계획 문서:** [`../development/sessions/2026-07-11-map-arena-plan.md`](../development/sessions/2026-07-11-map-arena-plan.md)
- **대상:** 경계형 아레나(외곽 벽 + 플레이어 클램프), 카메라 팔로우 + 벽 클램프, 서울 배경 placeholder, 데이터 주도 맵 포맷(`seoul.json`) 최소 스키마. 장애물 충돌·다중 맵 셀렉터는 이월.

---

## 1. Impact Map (변경 파일별 확인 범위)

| 파일 | 변경 | 회귀 확인 범위 |
|------|------|----------------|
| `logic/ArenaLogic.ts` (신규·순수) | `clampToArena`·`cameraFollowPosition` | 자동 테스트로 전량 검증 |
| `systems/MapManager.ts` (신규·Cocos) | `seoul.json` 로드 → 아레나 크기·배경 구성, 싱글톤 노출 | 씬 로드 시 배경 표시·아레나 크기 주입 |
| `components/CameraController.ts` (신규·Cocos) | 카메라 팔로우 + 벽 클램프 + `orthoHeight` 고정 | 카메라 이동·클램프, 크로스머신 diff(F9) |
| `resources/data/maps/seoul.json` (신규·데이터) | `{ id, size, backdrop }` | 로드 성공, `size` 변경이 아레나에 반영 |
| `components/PlayerController.ts` (수정) | `_move` 말미에 `clampToArena` | 플레이어가 벽을 못 넘는지 + 기존 이동 정상 |
| `systems/EnemySpawner.ts` (수정) | `_spawnEnemy` 스폰 위치 `clampToArena` | 적이 아레나 안에만 스폰 + 기존 스폰 정상 |
| `systems/DataManager.ts` (수정) | 맵 JSON 로드 경로 추가 | 기존 마법·적·카드 로드 회귀 없음 |
| `scenes/main.scene` (수정) | Align Canvas 해제·CameraController·MapManager·Backdrop 크기·orthoHeight | 게임/HUD 렌더, 카메라 동작 |

---

## 2. 자동 테스트로 검증 (`tests/logic/MapArena.test.ts`)

> **통과 근거:** 피처 테스트 9/9 + 전체 스위트 439/439 (33 파일) GREEN (feat/map-arena 구현 커밋).

- [x] `clampToArena` — 안쪽 위치 보존, 우/하 벽 초과 시 반경만큼 클램프, 모서리 동시 클램프, 반경 > 아레나 절반이면 중앙(0).
- [x] `cameraFollowPosition` — 중앙 일치, 여유 시 그대로 팔로우, 벽 근처 시 뷰 가장자리 클램프, 아레나 < 뷰면 중앙(0).

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
4. **Backdrop 크기** — `Backdrop` 노드 Content Size를 `2400 × 2400`, Position `(0, 0)`으로. (서울 배경 스프라이트는 placeholder — 최종 아트는 아트 단계.)
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

- [ ] **플레이어 벽 클램프** — 아레나 가장자리로 계속 이동해도 벽을 넘지 못하고 경계에서 멈춘다(네 방향 전부).
- [ ] **카메라 팔로우** — 플레이어가 이동하면 카메라가 따라와 플레이어가 대체로 화면 중앙에 유지된다.
- [ ] **카메라 벽 클램프** — 플레이어가 벽에 붙어도 화면에 아레나 바깥(빈 공간)이 보이지 않는다. 카메라가 벽에서 멈춘다.
- [ ] **적 스폰 경계** — 적이 아레나 밖에 스폰돼 벽 너머에 갇히는 일이 없다. 플레이어가 벽 근처일 때도 스폰이 아레나 안에서 이뤄진다.
- [ ] **서울 배경 표시** — Backdrop placeholder가 아레나를 덮어 보인다(가장자리에 빈 공간 없음).
- [ ] **맵 크기 변경 반영** — `seoul.json`의 `size`를 예: `[3000,3000]`으로 바꾸면 아레나·클램프가 코드 변경 없이 커진다(확인 후 원복). 단 Backdrop은 그 크기를 덮도록 조정 필요.
- [ ] **HUD 회귀** — HP/XP 바·타이머·마법 아이콘 행 등 UICanvas HUD가 카메라 팔로우와 무관하게 화면에 고정돼 정상 표시된다.
- [ ] **레벨업/일시정지 회귀** — 카드 선택·ESC 일시정지가 카메라 이동 상태에서도 정상 동작한다.
- [ ] **크로스머신 diff(F9)** — 저장 후 `git diff main.scene`에 `_orthoHeight` churn이 재발하지 않는다(고정값 유지).
