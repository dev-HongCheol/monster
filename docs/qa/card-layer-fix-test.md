# card-layer-fix — UI 항상-위 렌더(카메라+레이어 분리) + 카드 라벨 잘림 QA

> **브랜치:** feat/card-layer-fix
> **계획:** [2026-06-17-card-layer-fix-plan.md](../development/sessions/2026-06-17-card-layer-fix-plan.md)
> **성격:** 전부 Cocos 에디터/씬/프리팹 설정 변경 — 순수 로직 `.ts` 변경 없음(자동 테스트 스킵). 검증은 **에디터 세팅 + 수동 인게임 테스트**로 한다.

게임 월드와 UI를 레이어로 나누고 각자 전용 카메라로 렌더해, 노드 계층 순서나 런타임 `addChild` 시점과 무관하게 UI가 항상 게임 월드 위에 그려지도록 만든다. 같은 패널을 건드리는 김에 카드 설명 라벨이 양끝부터 잘리는 표시 버그(F8)도 고친다.

---

## 1. Impact Map (회귀 기준)

| 변경 대상 | 확인 범위 |
|---|---|
| `main.scene` — 기존 `Camera` visibility 축소 | 게임 월드(적·발사체·플레이어·경험치·폭발 VFX) 전체가 여전히 보이는가, 이중 렌더 없는가 |
| `main.scene` — 신규 UI 카메라 | HUD·GameOverPanel·CardSelectPanel이 항상 게임 월드 위에 보이는가 |
| `main.scene` — `CardSelectPanel` 서브트리 레이어 변경 | 카드 패널 표시 + **버튼 클릭**(입력 히트테스트)이 정상인가 |
| `Enemy.prefab` 레이어 변경 | 적이 게임 카메라로 정상 렌더되는가(스폰·이동·사망 연출) |
| `Bullet.prefab` 레이어 변경 | 발사체가 정상 렌더되는가 |
| `XPItem.prefab` 레이어 변경 | 경험치 아이템이 정상 렌더·획득되는가 |
| `ExplosionVfx.prefab` 레이어 변경 | 폭발 VFX가 명중 지점에 정상 표시되는가(magic-explosion 회귀) |
| `CardDescLabel_0/1/2` 넘침 속성 변경 | 긴 설명이 양끝부터 잘리지 않고 전체가 읽히는가 |

---

## 2. 씬/프리팹 변경 사항

레이어 값: `DEFAULT = 1073741824`, `UI_2D = 33554432`. 에디터에서는 노드의 **Layer** 드롭다운, 카메라의 **Visibility** 체크박스로 설정한다.

> **접근 수정 (step-7 인게임 테스트, 2026-06-17):** 처음엔 단일 Canvas + 카메라 2개로 시도했으나 인게임에서 게임 월드가 전부 사라졌다. Cocos 3.8에서 **2D 객체는 자신이 속한 Canvas에 연결된 카메라로만 렌더**되기 때문이다(공식 "First Game 2D" 패턴: `Canvas/Camera`는 DEFAULT만, `UICanvas/Camera`는 UI_2D만 렌더). 단일 Canvas는 카메라 하나에만 묶이므로, 게임 월드를 DEFAULT로 내리면 그 Canvas의 카메라(UICamera/UI_2D)에서 컬링돼 보이지 않고, 게임 Camera에는 묶인 Canvas가 없어 아무것도 그리지 않는다. 그래서 계획 §5 폴백대로 **Canvas를 둘로** 나눈다.

### 2-1. 구조 — 두 Canvas로 게임/UI 분리 (핵심)

| Canvas | 연결 카메라(cameraComponent) | 담는 노드 | 레이어 |
|---|---|---|---|
| `Canvas`(기존) | 게임 `Camera` (priority 0, ClearFlags `SOLID_COLOR`) | Player·BulletParent·매니저·EnemySpawner + 런타임 적·발사체·경험치·폭발 | DEFAULT |
| `UICanvas`(신규) | `UICamera` (priority 1, ClearFlags `DEPTH_ONLY`) | HUD·GameOverPanel·CardSelectPanel | UI_2D |

각 Canvas가 자기 카메라로 서브트리를 렌더하고, `UICamera`의 priority(1)가 게임 `Camera`(0)보다 높아 UI가 항상 위에 그려진다. 카메라가 정지(플레이어를 따라가지 않음)라 게임/UI 모두 같은 전화면 직교 뷰를 쓴다.

### 2-2. 에디터 작업 순서

| # | 작업 | 비고 |
|---|---|---|
| 1 | `Canvas`(기존)의 Canvas 컴포넌트 `Camera` 필드를 **게임 `Camera`로 되돌림** | step-7 중 `UICamera`로 바꿔뒀던 것을 원복 |
| 2 | 새 Canvas 노드 생성 → 이름 `UICanvas`. 자동 생성된 자식 Camera는 **삭제** | 카메라가 3개 되는 것 방지 |
| 3 | 기존 `UICamera`를 `UICanvas` 자식으로 이동 → `UICanvas`의 `Camera` 필드 = `UICamera` | 이동 후 화면을 같게 덮는 위치인지 확인 |
| 4 | `HUD`·`GameOverPanel`·`CardSelectPanel`을 `UICanvas` 밑으로 이동 | UI 서브트리 이동 |
| 5 | 게임 월드(Player·BulletParent·매니저·EnemySpawner)는 기존 `Canvas`에 그대로 | `EnemySpawner`가 `playerNode.parent`로 스폰하므로 자동으로 기존 `Canvas`에 붙음(코드 변경 없음) |

**카메라 설정 (이미 맞음 — 확인만):** 게임 `Camera` Visibility `DEFAULT`만·priority 0·ClearFlags `SOLID_COLOR`. `UICamera` Visibility `UI_2D`만·priority 1·ClearFlags `DEPTH_ONLY`.

**레이어 (이미 맞음 — 확인만):**

| 대상 | 레이어 |
|---|---|
| Player (씬) | DEFAULT |
| `Enemy`·`Bullet`·`XPItem`·`ExplosionVfx` 프리팹 루트 | DEFAULT |
| `CardSelectPanel` + 자식·HUD·GameOverPanel | UI_2D |

> 매니저 노드(DataManager·I18n·WaveManager·DeckManager·GameManager·EnemySpawner·ExperienceManager)는 그릴 것이 없어 레이어 무관 — 손대지 않는다.
> **중복 렌더 방지:** 두 카메라 Visibility가 겹치지 않게(게임=`DEFAULT`만, UI=`UI_2D`만) 유지한다.

### 2-3. F8 — 카드 설명 라벨 넘침

| 노드 | 변경 | 비고 |
|---|---|---|
| `CardDescLabel_0/1/2` | `Overflow` `CLAMP` → **`SHRINK`**(권장) | 글자 크기를 줄여 한 줄에 맞춤. 카드 크기 불변, 가장 단순 |

> 대안: `Overflow=RESIZE_HEIGHT` + `wrapText=true`(줄바꿈, 단 긴 설명 시 카드 높이 흔들림) / 라벨·카드 너비 확대. 7단계에서 실제로 보고 택일. 순수 표시 속성이라 카드 로직·드로우 영향 없음.

---

## 3. 에디터 연결 체크리스트

이번 슬라이스는 새 스크립트 `@property`가 없다. 확인할 연결은 카메라/레이어 설정뿐이다.

| 항목 | 대상 | 상태 |
|---|---|---|
| 기존 `Canvas.Camera` | 게임 `Camera`로 되돌림(DEFAULT) | ❌ |
| `UICanvas` 생성 + `UICanvas.Camera` | `UICamera`(UI_2D) | ❌ |
| `UICamera` Visibility / ClearFlags / Priority | `UI_2D`만 / `DEPTH_ONLY` / 1 | ❌ |
| 기존 `Camera` Visibility / Priority | `DEFAULT`만 / 0 | ❌ |
| HUD·GameOverPanel·CardSelectPanel | `UICanvas` 밑으로 이동(레이어 UI_2D) | ❌ |
| `Enemy`/`Bullet`/`XPItem`/`ExplosionVfx` 프리팹 Layer | `DEFAULT` | ❌ |
| `CardDescLabel_0/1/2` Overflow | `SHRINK`(또는 택일안) | ❌ |

> 기존 연결(`SpellCaster.bulletParent`·`explosionVfxPrefab`, `EnemySpawner.playerNode`/`enemyPrefab` 등)은 변경 없음 — 레이어/카메라만 바꾼다.

---

## 4. 수동 테스트 체크리스트

코드로 검증 불가한 인게임 렌더/입력 동작만 담는다.

**렌더 순서(H1 핵심):**
- [x] 게임 시작 후 적·발사체·플레이어·경험치 아이템·폭발 VFX가 모두 정상 표시되고, **누락이나 이중 렌더(겹쳐 두 번 그려짐)가 없다**.
- [x] 레벨업(웨이브 클리어) 시 **카드 선택 패널이 적·플레이어 위에 온전히** 보인다(겹쳐 가려지지 않음).
- [x] HUD(체력·웨이브·타이머·레벨·XP 라벨)가 게임 플레이 중 **항상 게임 월드 위에** 보인다.
- [x] 게임오버 시 GameOverPanel이 **항상 위에** 보인다.

**입력(레이어 이동 부작용 확인):**
- [x] 레벨업 카드 **버튼 3개를 클릭하면 정상 선택**된다(레이어를 UI_2D로 옮긴 뒤 입력 히트테스트가 깨지지 않았다).
- [x] RestartButton·MenuButton(GameOverPanel) 클릭도 정상이다.

**F8 — 라벨 잘림:**
- [x] 카드 설명 라벨이 **양끝부터 잘리지 않는다**. 긴 설명(예: `"파이어볼 발사체 수 +1레벨"`)도 전체가 읽혀 다른 카드로 오인되지 않는다.

**회귀(magic-explosion):**
- [x] 폭발형 마법(파이어볼) 명중 시 폭발 VFX가 명중 지점에 정상 표시되고 피해도 정상(레이어 변경이 폭발 연출/판정에 영향 없음).

> **검증 핵심:** 위 "렌더 순서" 4항목이 모두 통과하면 두-Canvas 분리가 성립한 것이다. (단일 Canvas + 2-카메라는 step-7에서 게임 월드가 사라져 폐기했고, §2 머리말 근거로 두-Canvas로 전환했다.) 그래도 게임 월드가 안 보이거나 UI가 가려지면 `리워크` 후 카메라 priority(UI>게임)·각 Canvas의 Camera 연결·레이어 일치를 다시 점검한다.

---

## 5. 신규 `.meta` 안내

UI 카메라 노드는 씬 내부 노드라 별도 에셋 `.meta`를 만들지 않는다. 다만 프리팹 4종(`Enemy`·`Bullet`·`XPItem`·`ExplosionVfx`)을 에디터에서 수정·저장하면 `.prefab` 내용이 바뀌고, 신규 자산이 추가되지는 않으므로 새 `.meta`는 원칙적으로 없다. 7단계 테스트 중 어떤 경로로든 신규 `.meta`가 생기면 `PR 승인`(8단계) 시점에 일괄 커밋한다.
