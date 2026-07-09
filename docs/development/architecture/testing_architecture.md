# 🧪 단위 테스트 아키텍처 및 검증 보고서 (Testing Architecture & Verification)

이 문서는 `monster` 프로젝트의 순수 비즈니스 로직과 Cocos 엔진 간 격리 설계가 어떻게 높은 테스트 용이성(Testability)을 달성하는지, 그리고 복잡한 기하학 및 물리 연산을 테스트로 보증하는 검증 패턴을 분석합니다.

---

## 1. Cocos 엔진 격리 및 고속 테스트 전략

Cocos Creator 엔진(`.prefab`, `cc.Node`, 씬 계층 구조)에 강하게 결합된 코드는 테스트를 수행하기 위해 무거운 게임 에디터 런타임이나 브라우저 샌드박스를 띄워야 하므로 테스트 실행 비용이 크고 CI/CD 파이프라인 통합이 까다롭습니다.

### 1.1. 로직-컴포넌트 분리 패턴 (Architecture Isolation)
본 프로젝트는 [002-scripts-logic-pattern.md](file:///F:/work/monster/docs/decisions/002-scripts-logic-pattern.md) 의사결정에 의거하여 모든 게임 기획 규칙을 순수 TypeScript 클래스로 격리하여 작성합니다.
*   **비즈니스 로직 (`logic/`):** Cocos API(cc) 임포트가 단 한 줄도 없는 순수한 TypeScript 클래스 및 함수들입니다. (예: `DeckLogic`, `FireSchedulerLogic`, `SpatialGrid` 등)
*   **컴포넌트 래퍼 (`components/`, `ui/`):** Cocos 노드에 부착되어 Cocos 라이프사이클을 연계하고, 순수 로직 클래스를 인스턴스화하여 감싸는 껍데기 역할만 담당합니다.
*   **테스트 고속화:** 이 격리 구조 덕분에 무거운 게임 엔진 로딩 없이 가볍고 정밀한 단위 테스트 프레임워크인 Vitest 환경에서 로직들을 1초 미만의 속도로 고속 실행하여 검증할 수 있습니다.

---

## 2. 테스트 패턴 분석 (Test Patterns)

`tests/logic/` 폴더 내에 배치된 31개의 단위 테스트들은 복잡한 수학 연산과 상태 기계를 완벽하게 모킹하고 검증하기 위해 세 가지 고도의 테스트 기법을 활용합니다.

### 2.1. LCG 난수 생성기를 이용한 결정성 테스트 (Deterministic Testing)
확률적인 카드 드로우 풀 구성이나 몬스터 스폰 선출을 검증할 때 단순 `Math.random()`을 사용하면 실행할 때마다 결과가 달라져 일시적인 테스트 실패(Flaky Test)를 만듭니다.
이를 배제하고자 선형 합동 생성기(Linear Congruential Generator, LCG) 알고리즘을 테스트 코드 내부에서 생성하여 난수로 주입합니다.
```typescript
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
```
*   **결정성 확보:** 동일한 시드 값을 사용하면 난수 흐름이 항상 바이트 단위로 동일하게 재생되므로, 무작위 드로우 확률 분포나 스폰 가중치 분배를 100% 동일하게 재현하고 어설션(`expect`)할 수 있습니다.

### 2.2. 브루트포스 비교를 통한 Parity 테스트 (Mathematical Parity)
공간 격자 그리드(`SpatialGrid`)나 부채꼴 범위 충돌과 같이 다차원 배열 탐색 및 수학 기하학이 얽힌 연산의 무결성을 증명하기 위해, 단순하고 직관적이지만 느린 브루트포스(Brute-force) 탐색 논리를 테스트 내부에 구현한 뒤 프로덕션 격자 쿼리와 결과를 교차 검증합니다.
*   [SpatialGrid.test.ts](file:///F:/work/monster/tests/logic/SpatialGrid.test.ts#L163-L201)는 임의의 좌표에 수백 개의 서로 다른 충돌 반경을 가진 몬스터를 스폰하고, 무작위 위치에서 질의를 던져:
    1.  모든 개체를 선형 루프로 돌며 기하학 거리를 전수 비교한 정밀 목록(`preciseHits`)을 얻습니다.
    2.  Spatial Grid가 돌려준 최적화된 후보 리스트(`candidates`)를 조회합니다.
    3.  `preciseHits`에 든 모든 항목이 `candidates` 안에 단 하나도 빠짐없이(`preciseHits` $\subseteq$ `candidates`) 포착되었는지 검증하여 수학적 누락이 없음을 완전 무결하게 입증합니다.

### 2.3. 프레임 시뮬레이션 기반 FSM 검증 (State Machine Simulation)
몬스터의 돌진(Lunge FSM)이나 가격 쿨다운, 플레이어 무적시간 프레임 등 시간에 종속되는 상태 기계들의 상태 전이를 검증하기 위해 인위적으로 프레임 델타 `dt`를 여러 번 끊어서 틱으로 밀어 넣는 시간 시뮬레이션 기법을 사용합니다.
*   예를 들어, 윈드업 대기 0.5초 동안 이동 차단 상태를 유지하는지 검증하기 위해 `tickLunge` 함수에 `dt = 0.1`초를 5번 연속으로 호출하며 매 스텝 적의 속도와 상태 코드가 알맞게 전이되는지를 가상 시간선에서 정밀 모니터링합니다.
