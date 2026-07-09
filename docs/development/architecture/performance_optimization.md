# ⚡ 성능 및 메모리 최적화 상세 분석 (Performance & Memory Optimization)

이 문서는 대규모 몬스터와 발사체가 동시에 출현할 때 발생하는 연산 병목을 제거하기 위해 `monster` 프로젝트에 적용된 공간 분할(Spatial Grid) 알고리즘 및 가비지 프리(Garbage-free) 객체 풀링(Object Pooling) 구조를 상세히 분석합니다.

---

## 1. 2D 희소 공간 분할 그리드 (Spatial Grid Optimization)

몬스터와 발사체 간의 물리 충돌 판정을 브루트포스 방식으로 전수 비교하게 되면 연산 횟수는 적과 투사체 수의 곱인 $O(N^2)$으로 급증하여 프레임 드랍을 유발합니다. 이를 극복하고자 2D 희소 공간 그리드를 도입했습니다.

### 1.1. 시간 복잡도 변환 ($O(N^2) \to O(N)$)
*   [SpatialGrid.ts](file:///F:/work/monster/game/assets/scripts/logic/SpatialGrid.ts)는 전체 월드 영역을 일정한 변의 길이를 가진 균일 셀(Grid Cell, e.g., 64px)로 구획합니다.
*   **Insert ($O(1)$):** 매 프레임 모든 몬스터의 좌표를 floor 연산하여 1차원 문자열 키로 맵핑하고, 희소 맵의 셀 버킷 리스트에 객체를 삽입합니다.
    $$\text{cellKey}(x, y) = \left\lfloor \frac{x}{\text{cellSize}} \right\rfloor + "," + \left\lfloor \frac{y}{\text{cellSize}} \right\rfloor$$
*   **QueryRadius ($O(1)$):** 투사체 또는 폭발의 반경을 기반으로 검색 범위가 교차하는 인접 셀 집합을 산출하고, 해당 버킷 내에 위치한 적들에 대해서만 정밀 제곱거리 연산을 수행합니다.
*   이에 따라 충돌 연산 비용은 씬 전체의 개체 수 $N$에 비례하지 않고, 투사체 반경 내에 존재하는 국소 밀도에만 종속되어 전체적인 물리 루프 성능을 획기적으로 개선합니다.

### 1.2. 그리드 동기화 오차 보정 공식 (Query Slack)
적들은 씬 루프 내에서 프레임 사이 지속해서 이동하지만, 그리드는 프레임 개시 시점에 일괄적으로 몬스터들의 좌표로 재구축(`clear` 후 `insert`)됩니다. 따라서 이동량이 많은 몬스터가 그리드 경계선을 이탈해 물리 쿼리에서 누락되는 현상이 발생할 수 있습니다.
이를 보증하기 위해 넉넉한 탐색 마진을 부여합니다.
$$\text{QueryRadius}_{\text{final}} = \text{Radius}_{\text{projectile}} + \max(R_{\text{enemy}}) + \text{SLACK}$$

*   **Slack 마진 (`ENEMY_QUERY_SLACK` = 32px):** 몬스터가 최대 약 2프레임 가량 전진할 수 있는 물리 거리를 흡수하여, 그리드가 실제 몬스터의 런타임 물리 노드 좌표보다 미세하게 낡은 상태여도 절대 대상을 탐색 대상에서 빠뜨리지 않고 100% 포착하도록 보장합니다.

---

## 2. 가비지 프리 객체 풀링 시스템 (Garbage-Free Object Pooling)

투사체, 몬스터, 파티클(VFX), 경험치 보석 등 런타임에 빈번히 태어나고 죽는 다량의 동적 노드들을 매번 `instantiate()`하고 `destroy()`하게 되면 메모리 단편화 및 주기적인 가비지 컬렉터(Garbage Collector)의 Stop-the-world 부하로 인해 심각한 프레임 레이트 스파이크가 발생합니다.

### 2.1. 얇은 결합 레이어 아키텍처 (Wrapper & Ledger)
풀링 시스템은 엔진 배선이 제거된 순수 배열 장부와 Cocos Creator 연동 모듈로 이중화되어 있습니다.
1.  **순수 풀링 장부 ([ObjectPoolLogic.ts](file:///F:/work/monster/game/assets/scripts/logic/ObjectPoolLogic.ts)):**
    *   Cocos API를 일절 참조하지 않고 순수 TS 제네릭 배열 `_free: T[]`를 관리합니다.
    *   가용 객체의 `acquire` 분기, 회수 시 `release` 판단, 그리고 누적 활성 개체 수 회계장부 연산에만 전념하여 단위 테스트를 통해 비가비지 작동을 고정합니다.
2.  **노드 풀 연동 ([PoolManager.ts](file:///F:/work/monster/game/assets/scripts/components/PoolManager.ts)):**
    *   `ObjectPoolLogic` 장부 위에 Cocos의 프리팹 객체화(`instantiate`), 렌더링 활성 전환(`active=true/false`), 폐기(`destroy`) 등 부수 효과를 입히는 얇은 Wrapper 역할만 완수합니다.
    *   이로 인해 에디터 상에 컴포넌트 프리팹을 여러 개 중첩 배치하는 배선 비용을 제거하고 소유 컴포넌트가 new 연산자로 즉시 인스턴스화할 수 있도록 구현되었습니다.

### 2.2. 유연한 회수 상한 및 자식 트리 유지 원칙 (Memory Cap & Retention)
*   **Idle 보관 상한 (`maxFree`):** 
    `maxFree`는 풀 내부의 가용(Idle) 대기 객체 수의 최댓값입니다. 
    *   이 상한은 씬에 동시에 존재할 수 있는 활성 개체 수를 인위적으로 제어하거나 제한하지 않습니다.
    *   따라서 무한 스폰은 안전하게 허용하되, 폭발 VFX와 같이 순간 폭증한 뒤 한 번에 반환되는 노드들이 Idle 풀 공간을 전부 점유해 불필요하게 가용 메모리를 할당하고 있는 메모리 비대화를 억제합니다. 상한 초과분은 즉시 `destroy` 처리됩니다.
*   **자식 트리 유지 원칙 (Node Retention):**
    *   노드를 풀에 반환할 때 부모 노드 관계를 해제(`removeChild`)하게 되면 내부 계층 트리 갱신 연산으로 인한 성능 감쇄가 수반됩니다.
    *   따라서 `release` 시에도 부모 관계를 끊지 않고 자식 노드로 그대로 보존한 채 단순히 `active = false` 상태로 토글하여 보관합니다.
    *   `acquire` 시점에만 부모가 유실되었는지를 방어적으로 검사해 재부착하여 노드 소속 무결성과 극도의 런타임 속도를 동시에 쟁취합니다.
