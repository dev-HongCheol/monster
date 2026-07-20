import { _decorator, Component } from 'cc';

const { ccclass, menu } = _decorator;

/**
 * 원 장애물 마커 — 이 컴포넌트가 붙은 `Obstacles` 자식 노드를 `MapManager`가 원(circle)으로
 * 색인한다(마커가 없으면 사각형이 기본값). 반지름은 노드 `UITransform.width / 2`에서 유도되므로
 * 이 컴포넌트에 세팅할 값은 없다 — 형태 판별을 명명 규칙이 아니라 명시 마커로 두어(원 계획 §3.2)
 * 이름을 바꿔도 조용히 사각형으로 되돌아가지 않고, 신호가 Inspector에 드러나 오배치를 막는다.
 */
@ccclass('CircleObstacle')
@menu('obstacle/CircleObstacle')
export class CircleObstacle extends Component {}
