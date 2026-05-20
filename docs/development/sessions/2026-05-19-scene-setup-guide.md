# Cocos Creator 씬 설정 가이드 — 전투 프로토타입

- **날짜:** 2026-05-19
- **엔진:** Cocos Creator 3.8.8

---

## 1. 흰색 SpriteFrame 준비

단색 사각형을 만들려면 흰색 기본 스프라이트가 필요하다.

1. Assets 패널 → `internal` 폴더 열기
2. `default_sprite` 또는 `default_sprite_splash` 찾기
3. 이 SpriteFrame을 이후 Sprite 컴포넌트에 사용한다

---

## 2. 씬 노드 구조

완성 목표:

```
Scene (main)
├── GameManager          ← 빈 노드
├── EnemySpawner         ← 빈 노드
├── BulletParent         ← 빈 노드
├── Player               ← Sprite 노드
└── Canvas
    └── HUD              ← 빈 노드
        ├── HpLabel      ← Label 노드
        └── GameOverPanel ← 빈 노드 (기본 비활성)
            ├── Label    ← Label 노드 ("GAME OVER")
            └── RestartButton ← Button 노드
```

---

## 3. 노드 생성 순서

### 3-1. GameManager, EnemySpawner, BulletParent (빈 노드)

Hierarchy 빈 공간 우클릭 →
`Create Node` → `Create Empty Node`

이름 변경: 노드 더블클릭 → 이름 입력

각각 생성:
- `GameManager`
- `EnemySpawner`
- `BulletParent`

### 3-2. Player (Sprite 노드)

Hierarchy 우클릭 →
`Create Node` → `2D Object` → `Sprite`

이름: `Player`

**Inspector 설정:**
- `Sprite` 컴포넌트 → SpriteFrame: `internal/default_sprite` 드래그
- `Sprite` 컴포넌트 → Color: 파란색 (R:0 G:100 B:255)
- `UITransform` 컴포넌트 → Content Size: `W:50 H:50`
- Position: `X:0 Y:0 Z:0`

### 3-3. Canvas + HUD

Hierarchy 우클릭 →
`Create Node` → `UI Component` → `Canvas`

Canvas 하위에 HUD 생성:
Canvas 우클릭 → `Create Node` → `Create Empty Node` → 이름 `HUD`

**HUD 하위에 HpLabel 생성:**
HUD 우클릭 → `Create Node` → `UI Component` → `Label`
- 이름: `HpLabel`
- Inspector → `Label` 컴포넌트 → String: `HP: 100 / 100`
- Position: X:-300 Y:220 (좌상단)

**HUD 하위에 GameOverPanel 생성:**
HUD 우클릭 → `Create Node` → `Create Empty Node`
- 이름: `GameOverPanel`
- Inspector 상단 체크박스(Active) → **체크 해제** (비활성 상태로 시작)

**GameOverPanel 하위에 Label 생성:**
GameOverPanel 우클릭 → `Create Node` → `UI Component` → `Label`
- String: `GAME OVER`
- Font Size: 48

**GameOverPanel 하위에 RestartButton 생성:**
GameOverPanel 우클릭 → `Create Node` → `UI Component` → `Button`
- 이름: `RestartButton`
- 하위 Label의 String: `RESTART`
- Position: X:0 Y:-80

---

## 4. 스크립트 연결

각 노드 선택 → Inspector → `Add Component` → `Scripts` → 해당 스크립트 선택

| 노드 | 스크립트 |
|------|----------|
| GameManager | `GameManager` |
| EnemySpawner | `EnemySpawner` |
| Player | `PlayerController` |
| HUD | `HudController` |

---

## 5. Inspector 프로퍼티 연결

Hierarchy에서 노드를 Inspector의 슬롯으로 **드래그**해서 연결한다.

### PlayerController (Player 노드 선택)
| 프로퍼티 | 연결 대상 |
|----------|-----------|
| Bullet Prefab | (아직 없음 — 6단계 후 연결) |
| Bullet Parent | `BulletParent` 노드 |

### EnemySpawner (EnemySpawner 노드 선택)
| 프로퍼티 | 연결 대상 |
|----------|-----------|
| Enemy Prefab | (아직 없음 — 6단계 후 연결) |
| Player Node | `Player` 노드 |

### HudController (HUD 노드 선택)
| 프로퍼티 | 연결 대상 |
|----------|-----------|
| Hp Label | `HpLabel` 노드 |
| Game Over Panel | `GameOverPanel` 노드 |
| Restart Button | `RestartButton` 노드 |

---

## 6. 프리팹 생성

### Enemy 프리팹

1. Hierarchy 우클릭 → `Create Node` → `2D Object` → `Sprite`
   - 이름: `Enemy`
2. Inspector 설정:
   - Sprite → SpriteFrame: `internal/default_sprite`
   - Sprite → Color: 빨간색 (R:255 G:0 B:0)
   - UITransform → Content Size: `W:50 H:50`
3. `Add Component` → `Scripts` → `EnemyController`
   - (Player Node는 EnemySpawner가 스폰 시 자동 연결 — 비워둬도 됨)
4. Hierarchy의 `Enemy` 노드를 Assets `components` 폴더로 **드래그** → 프리팹 생성
5. Hierarchy에서 `Enemy` 노드 **삭제**

### Bullet 프리팹

1. Hierarchy 우클릭 → `Create Node` → `2D Object` → `Sprite`
   - 이름: `Bullet`
2. Inspector 설정:
   - Sprite → SpriteFrame: `internal/default_sprite`
   - Sprite → Color: 노란색 (R:255 G:255 B:0)
   - UITransform → Content Size: `W:15 H:15`
3. `Add Component` → `Scripts` → `Projectile`
4. Hierarchy의 `Bullet` 노드를 Assets `components` 폴더로 **드래그**
5. Hierarchy에서 `Bullet` 노드 **삭제**

---

## 7. 프리팹 연결

프리팹이 생성됐으면 Inspector 슬롯에 연결한다.

### PlayerController
- Bullet Prefab 슬롯 → Assets의 `Bullet` 프리팹 드래그

### EnemySpawner
- Enemy Prefab 슬롯 → Assets의 `Enemy` 프리팹 드래그

---

## 8. 실행 확인

상단 **Play(▶)** 버튼 클릭 후 확인:

- [ ] 파란 사각형(플레이어) 화면 중앙에 표시
- [ ] WASD 키로 이동
- [ ] 2초마다 빨간 사각형(적) 스폰
- [ ] 가장 가까운 적 방향으로 자동 발사
- [ ] 적에게 닿으면 HP 감소 (좌상단 표시)
- [ ] HP 0 → "GAME OVER" 패널 표시
- [ ] RESTART 버튼 클릭 시 재시작
