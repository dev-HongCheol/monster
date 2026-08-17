# 👹 Monster (몬스터)

> **판타지 영웅이 한국 신화 세계에서 귀신과 싸우는 정통 덱 호드 서바이벌 (탑다운 2D 액션 로그라이크)**

---

## 📌 목차
- [1. 게임 소개 (Overview)](#1-게임-소개-overview)
- [2. 기술 스택 (Tech Stack)](#2-기술-스택-tech-stack)
- [3. 핵심 게임 시스템 (Core Systems)](#3-핵심-게임-시스템-core-systems)
- [4. 아키텍처 및 설계 원칙 (Architecture)](#4-아키텍처-및-설계-원칙-architecture)
- [5. AI 기반 개발 워크플로우 (AI-Driven Development)](#5-ai-기반-개발-워크플로우-ai-driven-development)
- [6. 프로젝트 구조 (Directory Structure)](#6-프로젝트-구조-directory-structure)
- [7. 시작 가이드 (Getting Started)](#7-시작-가이드-getting-started)
- [8. 개발 워크플로우 & 스크립트 (Workflow & Scripts)](#8-개발-워크플로우--스크립트-workflow--scripts)
- [9. 문서 가이드 (Documentation)](#9-문서-가이드-documentation)

---

## 1. 게임 소개 (Overview)

### 📖 시나리오 & 세계관
한국 무당, 일본 무녀, 중국 스님의 합동 소환 의식 도중 발생한 차원 균열로 인해 이계의 판타지 영웅들이 한국으로 소환됩니다. 한강과 서울 도심지 곳곳에서 쏟아져 나오는 한국 전승 귀신 및 요괴들의 공세에 맞서 살아남고, 세계를 구원하여 본래의 세계로 귀환해야 합니다.

### 🎮 장르 및 핵심 플레이 루프
- **장르:** 탑다운 2D 덱 빌딩 호드 서바이벌 액션 로그라이크 (*Vampire Survivors*, *Brotato*, *Hell Maiden*, *Magic Survival* 계열)
- **플레이어 직업:** 마법사 (Mage — 화염, 얼음, 번개 마법 및 보조 패시브)
- **핵심 루프:**
  1. 사방에서 몰려오는 한국 귀신/요괴 웨이브 속에서 4방향 이동 및 회피
  2. 자동 시전되는 마법 투사체 및 광역기로 적 처치
  3. 경험치 젬을 획득하여 레벨업하고, 3장의 카드 중 1장을 선택해 덱 빌딩 및 마법 증강
  4. 아레나 장애물과 한강 위험 구역(지속 피해 및 감속)을 전략적으로 활용하여 생존

---

## 2. 기술 스택 (Tech Stack)

| 구분 | 기술 / 도구 | 설명 |
|---|---|---|
| **Game Engine** | Cocos Creator `3.8.8` | 2D/3D 크로스 플랫폼 게임 엔진 |
| **Language** | TypeScript `5.8.2` | 정적 타입 기반 개발 |
| **Testing** | Vitest `^3.2.3` | 순수 로직 단위 테스트 프레임워크 (790+ 테스트) |
| **Linter / Formatter** | Biome `^2.4.15` | 고속 코드 린팅 및 포맷팅 |
| **Package Manager** | pnpm `10.15.1` | 효율적인 의존성 관리 |
| **Art Pipeline** | GPT-Image-2 (fal.ai) / Spine | 애니 셀 화풍 2D 캐릭터/몬스터 및 스켈레탈 애니메이션 |

---

## 3. 핵심 게임 시스템 (Core Systems)

### 🧙 1) 플레이어 & 조작 (`player/`, `logic/`)
- **4방향 이동 및 조작:** 가상 조이스틱 / 키보드 입력을 기반으로 부드러운 4방향 이동과 시선 방향(Facing) 처리
- **독립된 피격/충돌 판정 불변식:**
  - **피격 판정(Hurtbox):** 플레이어는 세로로 긴 축정렬 직사각형(AABB)을 적용하여 시각적 직관성 확보
  - **이동 충돌(Collision):** 캐릭터 발밑 기준 원형(Circle) 판정을 사용하여 벽이나 장애물 모서리에서 매끄럽게 미끄러짐
  - **스킨-판정 독립:** 외형 스킨이나 장비 변경이 판정 수치에 영향을 주지 않도록 JSON 데이터(`player.json`) 기반 고정 수치 사용

### ⚡ 2) 마법 & 전투 시스템 (`combat/`, `systems/DeckManager.ts`)
- **마법사 5대 핵심 마법:**
  - 🔥 **파이어볼 (Fireball):** 단일 직선 발사 후 명중 시 폭발 범위 피해
  - 🔥 **인페르노 (Inferno):** 플레이어 주변을 공전하며 접촉한 적에게 피해를 주는 화염 구체
  - ❄️ **아이스 미사일 (Ice Missile):** 적을 관통하거나 명중 시 둔화(Slow) 디버프를 부여하는 얼음 투사체
  - ❄️ **프로스트 노바 (Frost Nova):** 플레이어 중심으로 즉각 확장되는 원형 냉기 폭발
  - ⚡ **라이트닝 볼트 (Lightning Bolt):** 가까운 적에게 즉발 낙하하는 고위력 전격
- **효과 메커니즘 레이어:**
  - 패턴(직선, 부채꼴, 궤도 회전, 노바) × 효과(폭발, 둔화, 기절) × 상태이상의 유기적 조합
- **덱 빌딩 & 레벨업 증강:** 레벨업 시 덱에서 3장의 카드가 제시되며, 마법 신규 획득 및 쿨다운 감소, 투사체 수 증가, 범위 확장 등 증강 선택 가능

### 👹 3) 적 & 스폰 디렉터 (`enemy/`, `systems/EnemySpawner.ts`)
- **한국 전승 기반 12종 몬스터 로스터:** 달걀귀신, 처녀귀신, 저승사자, 도깨비 등 고유의 외형과 행동 패턴을 지닌 몬스터 군단
- **다양한 행동 패밀리:**
  - 단순 직진 추격, 지그재그 기동, 유격 원거리 사격, 고속 돌진, 근접 부채꼴 휘두르기(Melee Sweep)
  - 공격 전 텔레그래프(바닥 경고 마커 및 점멸)를 통한 공정한 회피 기회 제공
- **스폰 지오메트리 & 디렉터:** 원형 외곽 스폰, 군집(Flock) 스폰, 포위 링(Ring) 스폰 등 웨이브별 지능적 적 배치

### 🗺 4) 맵 환경 & 아레나 (`map/`, `systems/MapManager.ts`)
- **단일 아레나 필드:** 카메라 트래킹 및 경계 영역 제한
- **한강 위험 구역 (Han River Hazard):** 물에 들어갈 경우 이동 속도가 감소하고 지속 피해를 입는 환경 기믹
- **건물 및 장애물 충돌:** 원형 장애물(`CircleObstacle`) 및 직사각형 건물 충돌체(`BuildingCollision`)와의 물리적 인터랙션

### 🚀 5) 성능 최적화 (Optimization)
- **SpatialGrid (공간 분할):** 수백 마리의 적과 투사체 간 충돌/거리 질의를 고속으로 처리하기 위한 공간 인덱싱
- **Object Pooling:** 빈번하게 생성/소멸되는 적, 마법 투사체, 적 탄환, 경험치 젬을 풀링하여 GC 스파이크 방지

---

## 4. 아키텍처 및 설계 원칙 (Architecture)

```
       [ Cocos Creator Engine (View & Lifecycle) ]
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
  [ Components ]                          [ Systems ]
(PlayerController, EnemyController,    (GameManager, DeckManager,
 SpellCaster, RegionRenderer ...)       EnemySpawner, MapManager ...)
         │                                       │
         └───────────────────┬───────────────────┘
                             │ (순수 데이터 전달 & 호출)
                             ▼
                 [ scripts/logic/ (Pure Logic) ]
          (MovementLogic, SpellPatternLogic, SpatialGrid,
           HitboxLogic, EnhancementLogic, ObjectPoolLogic ...)
                             ▲
                             │ (100% 독립 테스트)
                 [ tests/logic/ (Vitest Suite) ]
```

### 1) 순수 로직 분리 패턴 (`scripts/logic/`)
엔진 종속성(Cocos Creator의 `Node`, `Component`, `Vec3` 등)을 배제하고, 순수한 TypeScript 함수와 데이터 구조로 핵심 게임 규칙을 구현합니다.
- **장점:** Cocos 에디터를 실행하지 않고도 CLI 환경에서 `vitest`를 통해 모든 비즈니스 로직을 밀리초 단위로 100% 독립 검증할 수 있습니다.
- **역할 분담:** `components/`는 씬과 노드 바인딩 및 렌더링을 얇게 담당하고, 실제 계산은 `logic/`에 위임합니다.

### 2) 데이터 주도 설계 (Data-Driven Architecture)
플레이어 스탯, 마법 계수, 적 로스터, 스폰 테이블, 다국어 텍스트는 `resources/data/`의 JSON 파일로 관리됩니다. 새 적이나 밸런스 변경 시 코드 수정 없이 데이터 확장만으로 반영할 수 있습니다.

### 3) 자체 경량 i18n 시스템
외부 무거운 라이브러리 없이 `I18nLogic`과 `LocalizedLabel` 컴포넌트를 통해 한국어/영어 등 다국어 번역을 지원하며, 빌드 타임에 번역 키 정합성을 자동으로 검증합니다.

---

## 5. AI 기반 개발 워크플로우 (AI-Driven Development)

본 프로젝트는 AI 에이전트와 개발자가 고도의 신뢰성과 생산성을 유지하며 협업할 수 있도록 **엄격한 자동화 파이프라인과 안전 가드**를 구축하여 개발되고 있습니다.

> **루프 엔지니어링 & 서브 에이전트 검증:** 격리된 순수 로직 테스트 하네스(Vitest) 위에서 서브 에이전트의 다면 리뷰(CSO·코드리뷰)와 `invalidate` 자동 재구현 피드백 루프를 결합하여, AI가 실패 시 스스로 수정하고 완결성을 보장하는 루프 엔지니어링이 적용되어 있습니다.

```
[ planning ] ──► [ qa-setup ] ──► [ implementation ] ──► [ verification ] ──► [ user-verification ] ──► [ pr-ready ] ──► [ done ]
 (계획 수립)     (RED 테스트)        (GREEN 구현)         (AI 자체 검증)        (사용자 검증/Draft PR)     (PR 승인)     (머지)
      ▲                                                                                 │
      └─────────────────────────── 버그 발견 시 리워크 (rework) ─────────────────────────┘
```

### 🤖 1) 워크플로우 상태 머신 & TDD 강제 (`.claude/workflow.mjs`)
- **CLI 상태 머신:** 상태의 단일 진실은 `.claude/workflow-state.json`이며, `pnpm wf` 명령어로만 단계 전이가 가능합니다.
- **코드 수정 통제 (PreToolUse Hook):** `gate-scripts.mjs` 훅이 AI의 임의 코드 수정을 차단하며, 오직 `implementation` 및 `verification` 단계에서만 스크립트 수정을 허용합니다.
- **테스트 주도 개발 (TDD):**
  - `qa-setup` 단계에서 기획 명세를 바탕으로 실패하는 테스트(`tests/logic/*.test.ts`, **RED**)를 먼저 작성해야만 구현 단계(`ready-impl`)로 전이됩니다.
  - `implementation` 단계에서 테스트를 모두 통과(**GREEN**)시킨 후 리팩터링을 거쳐 검증 단계(`start-verification`)로 진입합니다.

### 🛡️ 2) 인간-AI 협업 경계 (Human-in-the-Loop & Safety)
- **3대 사람 게이트 (Human Gates):** 중요한 의사결정 지점은 개발자의 명시적 지시가 있어야만 AI가 다음 단계로 전이합니다.
  - `계획 승인` ➔ `pnpm wf approve-plan` (기획/설계 문서 확인 후 테스트 작성 진입)
  - `PR 승인` ➔ `pnpm wf approve-pr` (인게임 검증 및 `.meta` 생성 확인 후 PR 완료)
  - `리워크` ➔ `pnpm wf rework` (인게임 플레이 중 버그 발견 시 구현 단계로 복귀)
- **실수 머지 차단 (Draft PR):** 사용자 검증 단계 진입 시 검토용 Draft PR을 자동 생성하여 미승인 머지를 원천 차단합니다.
- **Cocos 에셋 `.meta` 관리 규칙:**
  - Cocos Creator의 UUID 일관성을 유지하기 위해 **AI는 `.meta` 파일을 직접 생성하지 않습니다.**
  - 사용자가 Cocos 에디터에서 인게임 테스트를 수행할 때 엔진이 생성한 정품 `.meta`를 8단계(`PR 승인`) 시점에 일괄 커밋합니다.

### 🎨 3) AI 그래픽 파이프라인 (AI Art Pipeline)
- **일관된 애니 셀 화풍 생성:** 유료 이미지 생성 서비스(fal.ai Sandbox / GPT-Image-2)를 활용하여 한국 귀신 및 캐릭터의 4방향 시점과 화풍 일관성을 유지하며 에셋을 제작합니다.
- **Spine 2D 스켈레탈 리깅:** 생성된 2D 일러스트레이션 파츠를 Spine으로 리깅하여 유기적인 전투 및 이동 애니메이션을 구현합니다.

### 📚 4) 단일 진실 공급원(SSOT)과 정본(Canon) 시스템
- **코드가 이긴다 (Code as Ultimate Truth):** 문서와 구현이 어긋날 경우 실제 동작하는 코드와 JSDoc이 최상위 기준이 됩니다.
- **정본 선언 게이트:** 기능 개발 완료 시 `pnpm wf canon` 또는 `canon-done`을 통해 `docs/` 내 정본 문서를 반드시 갱신하도록 강제합니다.
- **링크 무결성 회귀망:** `DocLinks.test.ts`를 통해 레포지토리 내 모든 마크다운 문서 간의 상대 경로 및 앵커 링크가 유효한지 자동으로 검사합니다.

---

## 6. 프로젝트 구조 (Directory Structure)

```
monster/
├── .claude/                   # 개발 워크플로우 CLI 및 훅 스크립트
├── docs/                      # 프로젝트 문서 체계
│   ├── planning/              # 기획 (게임 디자인, 마법/적 시스템, 로드맵)
│   ├── design/                # 디자인 (아트 디렉션, 에셋 스펙, 프롬프트 플레이북)
│   ├── development/           # 개발 정본 (코드 컨벤션, 전투 판정 규칙, 환경 가이드)
│   └── decisions/             # Architecture Decision Records (ADR 001~008)
├── game/                      # Cocos Creator 프로젝트 루트
│   └── assets/
│       ├── art/               # 스프라이트, 텍스처, Spine 애니메이션 에셋
│       ├── prefabs/           # 플레이어, 적, 투사체, UI 프리팹
│       ├── resources/data/    # 마법, 적, 플레이어, i18n JSON 데이터
│       ├── scenes/            # 메인 게임 씬 및 메뉴 씬
│       └── scripts/           # TypeScript 소스 코드
│           ├── components/    # Cocos Component (엔진 바인딩 레이어)
│           ├── data/          # 게임 공용 인터페이스 및 타입 정의 (GameTypes.ts)
│           ├── logic/         # 순수 비즈니스/수학/판정 로직 (엔진 독립적)
│           ├── systems/       # 게임 관리자 및 매니저 싱글톤/서비스
│           └── ui/            # HUD, 카드 선택, 결과 화면, 일시정지 UI 컨트롤러
├── tests/                     # 순수 로직 단위 테스트 스위트 (Vitest)
│   ├── helpers/               # 테스트 하네스 및 유틸리티
│   └── logic/                 # 시스템별 단위 테스트 (45+ 테스트 파일)
├── CLAUDE.md                  # 프로젝트 통합 가이드 및 워크플로우 규칙
├── hitbox-viewer.html         # 피격/충돌 히트박스 시각화 검증 도구
├── package.json               # 프로젝트 의존성 및 스크립트 설정
└── biome.json                 # Biome 린터/포매터 설정
```

---

## 7. 시작 가이드 (Getting Started)

### 사전 요구사항 (Prerequisites)
- **Node.js:** `v20.0.0` 이상 권장
- **pnpm:** `v10.15.1` 이상
- **Cocos Creator:** `v3.8.8`

### 설치 (Installation)
```bash
# 저장소 클론 후 의존성 패키지 설치
pnpm install
```

### 게임 실행 및 에디터 로드
1. **Cocos Dashboard**를 실행합니다.
2. `Add` 버튼을 눌러 레포지토리 내 `game/` 디렉토리를 프로젝트로 추가합니다.
3. Cocos Creator `3.8.8` 버전으로 프로젝트를 엽니다.
4. `assets/scenes/GameScene.scene` 또는 `assets/scenes/MainScene.scene`을 열고 상단 재생(Play) 버튼을 누르면 브라우저/시뮬레이터에서 실행됩니다.

---

## 8. 개발 워크플로우 & 스크립트 (Workflow & Scripts)

| 명령어 | 설명 |
|---|---|
| `pnpm test` | Vitest 대화형 테스트 모드 실행 |
| `pnpm test:run` | 전체 단위 테스트 1회 일괄 실행 (CI / 게이트 검증용) |
| `pnpm typecheck` | TypeScript 타입 무결성 검증 |
| `pnpm check` | Biome을 통한 린트 및 포맷팅 정적 분석 |
| `pnpm format` | Biome 포매터를 통한 코드 자동 정리 |
| `pnpm wf status` | 현재 피처 개발 단계(Workflow Phase) 확인 |

---

## 9. 문서 가이드 (Documentation)

자세한 기획, 아트, 아키텍처 및 코딩 컨벤션은 `docs/` 하위 정본 문서에 기술되어 있습니다.

- **기획 & 게임 디자인:**
  - 🗺 [로드맵 (Roadmap)](docs/planning/roadmap.md)
  - 🪄 [마법사 마법 시스템 디자인](docs/planning/magic-system-mage.md)
  - 👹 [적 시스템 디자인](docs/planning/enemy-system.md)
- **디자인 & 아트 파이프라인:**
  - 🎨 [아트 디렉션 (Art Direction)](docs/design/spec/art-direction.md)
  - 📐 [아트 에셋 규격 (Asset Spec)](docs/design/spec/art-asset-spec.md)
  - 🖌 [AI 이미지 생성 플레이북](docs/design/spec/art-generation-playbook.md)
- **개발 정본 & 규약:**
  - 💻 [코드 컨벤션 (Code Conventions)](docs/development/spec/code-conventions.md)
  - 🎯 [판정 및 전투 규칙 (Game Combat Rules)](docs/development/spec/game-combat.md)
  - 🛠 [개발 환경 설정 (Ops Environment)](docs/development/spec/ops-environment.md)
  - 📖 [용어 사전 (Glossary)](docs/development/spec/docs-glossary.md)
- **핵심 아키텍처 결정 기록 (ADR):**
  - [ADR 001: Cocos Creator 버전 선택](docs/decisions/001-cocos-version.md)
  - [ADR 002: scripts/logic/ 분리 패턴](docs/decisions/002-scripts-logic-pattern.md)
  - [ADR 003: 테스트 전략 (Vitest)](docs/decisions/003-testing-strategy.md)
  - [ADR 004: 워크플로우 상태 머신](docs/decisions/004-workflow-state-machine.md)
  - [ADR 005: 자체 경량 i18n 방식](docs/decisions/005-i18n-approach.md)
  - [ADR 006: 충돌 히트박스 (플레이어 사각형 / 적 원)](docs/decisions/006-collision-hitbox.md)
  - [ADR 007: 스킨과 판정 독립성](docs/decisions/007-skin-hitbox-independence.md)
  - [ADR 008: AI 이미지 생성 서비스 결정](docs/decisions/008-paid-art-generation.md)
- **프로젝트 룰 & 전체 가이드:** [`CLAUDE.md`](CLAUDE.md)
