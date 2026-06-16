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

### 2-1. 신규 노드 — UI 카메라 (사용자가 Cocos 에디터에서 생성)

| 항목 | 값 | 근거 |
|---|---|---|
| **노드 이름** | `UICamera` | 기존 `Camera`와 구분 |
| **부모** | `Canvas` 아래(기존 `Camera`와 같은 부모) | 같은 화면 정렬 |
| **컴포넌트** | `cc.Camera` 1개 | — |
| **Projection** | `ORTHO`(직교) | 기존 게임 카메라와 동일(2D) |
| **Visibility** | **`UI_2D`만** 체크(나머지 해제) | UI 레이어만 본다 |
| **ClearFlags** | **`DEPTH_ONLY`** | 게임 카메라가 그린 화면을 지우지 않고 그 위에 UI만 덧그린다 |
| **Priority** | **1**(게임 카메라 0보다 높게) | Cocos는 priority 낮은 카메라부터 그림 → 높은 UI 카메라가 나중에 = 위에 |
| **OrthoHeight / Near / Far / Position** | 기존 `Camera`와 동일(OrthoHeight ≈ 788.9, Near 0, Far 2000) | 화면 정렬 일치 |

### 2-2. 기존 노드 수정

| 노드/프리팹 | 변경 | 현재 → 목표 |
|---|---|---|
| `Camera`(기존, 게임용) | **Visibility를 `DEFAULT`만**으로 축소(현재 DEFAULT+UI_2D+IGNORE_RAYCAST) | visibility 1108344832 → 1073741824 |
| `Camera`(기존) | ClearFlags `SOLID_COLOR` 유지, Priority 0 유지 | 변경 없음 |
| `Canvas` | `Camera` 프로퍼티(cameraComponent)를 **`UICamera`로** 변경 | 기존 `Camera` → `UICamera` (둘 다 전화면 직교라 정렬 영향 적음. UI 어긋나면 기존 `Camera`로 되돌려 확인) |
| **`CardSelectPanel` + 모든 자식** | Layer `DEFAULT` → **`UI_2D`** | 에디터에서 부모 레이어 변경 시 "자식도 함께 변경" 적용. 대상: `CardSelectPanel`, `CardButton_0/1/2`, `CardNameLabel_0/1/2`, `CardDescLabel_0/1/2` |
| `Enemy.prefab` 루트 | Layer `UI_2D` → **`DEFAULT`** | 프리팹 열어 루트 노드 레이어 변경 후 저장 |
| `Bullet.prefab` 루트 | Layer `UI_2D` → **`DEFAULT`** | 〃 |
| `XPItem.prefab` 루트 | Layer `UI_2D` → **`DEFAULT`** | 〃 |
| `ExplosionVfx.prefab` 루트 | Layer `UI_2D` → **`DEFAULT`** | 〃 |

> **중복 렌더 방지(중요):** 두 카메라의 Visibility가 겹치면 안 된다. 한 노드 레이어가 두 마스크에 모두 걸리면 두 번 그려진다. 그래서 **레이어 정리(2-2 레이어 행)를 먼저 끝낸 뒤** 카메라 Visibility를 좁힌다.

> 매니저 노드(DataManager·I18n·WaveManager·DeckManager·GameManager·EnemySpawner·ExperienceManager)는 그릴 것이 없어 레이어 무관 — 손대지 않는다.

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
| `Canvas.cameraComponent` | `UICamera`로 변경됨 | ❌ |
| `UICamera` Visibility | `UI_2D`만 | ❌ |
| `UICamera` ClearFlags / Priority | `DEPTH_ONLY` / 1 | ❌ |
| 기존 `Camera` Visibility | `DEFAULT`만 | ❌ |
| `CardSelectPanel` 서브트리 Layer | `UI_2D` | ❌ |
| `Enemy`/`Bullet`/`XPItem`/`ExplosionVfx` 프리팹 Layer | `DEFAULT` | ❌ |
| `CardDescLabel_0/1/2` Overflow | `SHRINK`(또는 택일안) | ❌ |

> 기존 연결(`SpellCaster.bulletParent`·`explosionVfxPrefab`, `EnemySpawner.playerNode`/`enemyPrefab` 등)은 변경 없음 — 레이어/카메라만 바꾼다.

---

## 4. 수동 테스트 체크리스트

코드로 검증 불가한 인게임 렌더/입력 동작만 담는다.

**렌더 순서(H1 핵심):**
- [ ] 게임 시작 후 적·발사체·플레이어·경험치 아이템·폭발 VFX가 모두 정상 표시되고, **누락이나 이중 렌더(겹쳐 두 번 그려짐)가 없다**.
- [ ] 레벨업(웨이브 클리어) 시 **카드 선택 패널이 적·플레이어 위에 온전히** 보인다(겹쳐 가려지지 않음).
- [ ] HUD(체력·웨이브·타이머·레벨·XP 라벨)가 게임 플레이 중 **항상 게임 월드 위에** 보인다.
- [ ] 게임오버 시 GameOverPanel이 **항상 위에** 보인다.

**입력(레이어 이동 부작용 확인):**
- [ ] 레벨업 카드 **버튼 3개를 클릭하면 정상 선택**된다(레이어를 UI_2D로 옮긴 뒤 입력 히트테스트가 깨지지 않았다).
- [ ] RestartButton·MenuButton(GameOverPanel) 클릭도 정상이다.

**F8 — 라벨 잘림:**
- [ ] 카드 설명 라벨이 **양끝부터 잘리지 않는다**. 긴 설명(예: `"파이어볼 발사체 수 +1레벨"`)도 전체가 읽혀 다른 카드로 오인되지 않는다.

**회귀(magic-explosion):**
- [ ] 폭발형 마법(파이어볼) 명중 시 폭발 VFX가 명중 지점에 정상 표시되고 피해도 정상(레이어 변경이 폭발 연출/판정에 영향 없음).

> **주 리스크 검증:** 위 "렌더 순서" 4항목이 모두 통과하면 단일 Canvas + 2-카메라 분리가 성립한 것이다. 만약 게임 월드가 안 보이거나 이중 렌더가 나거나 UI가 여전히 가려지면, 계획 §5의 **폴백(UI 노드를 별도 Canvas로 분리)** 으로 `리워크`한다.

---

## 5. 신규 `.meta` 안내

UI 카메라 노드는 씬 내부 노드라 별도 에셋 `.meta`를 만들지 않는다. 다만 프리팹 4종(`Enemy`·`Bullet`·`XPItem`·`ExplosionVfx`)을 에디터에서 수정·저장하면 `.prefab` 내용이 바뀌고, 신규 자산이 추가되지는 않으므로 새 `.meta`는 원칙적으로 없다. 7단계 테스트 중 어떤 경로로든 신규 `.meta`가 생기면 `PR 승인`(8단계) 시점에 일괄 커밋한다.
