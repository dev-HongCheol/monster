// 이동 주체를 "발밑 접지점" 기준으로 다루는 순수 로직 (player-4dir 리워크, 2026-07-25).
// cc import 없이 평면 좌표·길이만 다뤄 결정적으로 테스트한다. 오프셋 계산(footprintOffsetY)과
// 그 오프셋을 실제 이동에 적용하는 순서(resolveMoveAtFootprint) 두 가지를 제공하며, 후자가
// 장애물 해소(ObstacleLogic)와 아레나 클램프(ArenaLogic)를 어느 좌표계에서 부르는지 고정한다.

import { type Arena, clampToArena, type Vec2 } from './ArenaLogic';
import { type Obstacle, resolveCircleMove } from './ObstacleLogic';

/**
 * 노드 원점에서 이동 충돌 원의 중심까지 내려야 할 y 오프셋(px, 항상 0 이하).
 *
 * 원의 아래 끝을 그림의 발바닥에 맞추는 값이다 — `오프셋 - 반지름 == -반높이`가 성립한다.
 * 앵커가 (0.5, 0.5)면 노드 원점이 캐릭터 한가운데(허리)에 앉는데, 사람이 "장애물에 닿았다"고
 * 느끼는 지점은 허리가 아니라 발이다. 그래서 내리지 않으면 캐릭터가 장애물 위쪽 변에서 멈출 때
 * 다리가 `반높이 - 반지름`만큼 잠긴 채로 보인다(72×96 그림에 반지름 25면 23px, 그림 높이의
 * 24%로 정강이까지).
 *
 * 오프셋을 캐릭터 데이터로 받지 않고 반높이에서 유도하는 이유는, 캐릭터가 늘어도 각자의 Content
 * Size가 곧 답이라 사람이 다시 잴 값이 없기 때문이다. 유도가 성립하려면 모든 캐릭터가 네 규약을
 * 지켜야 한다 — 앵커 (0.5, 0.5) · Trim 켬 · 직립 전신 · **발이 그림의 최하단**. 넷 중 마지막이
 * 가장 먼저 깨지기 쉽다(발밑에 깔리는 불꽃·그림자·긴 망토는 알파 박스의 바닥을 발보다 아래로
 * 밀어 원을 필요 이상으로 내린다 — 그러면 캐릭터가 장애물 앞에서 허공을 두고 멈춘다).
 * 공중에 뜬 실루엣처럼 규약이 깨지는 캐릭터가 나오면 그때 캐릭터별 override를 얹는다.
 *
 * @param halfHeight 그림의 반높이 (px, `UITransform.height / 2`)
 * @param radius 이동 충돌 원의 반지름 (px, `collisionRadius`)
 * @returns 내릴 거리(음수) — 내릴 필요가 없거나 입력이 비정상이면 0
 */
export function footprintOffsetY(halfHeight: number, radius: number): number {
  // 비정상 입력에 0을 돌려주면 오프셋 없음 = 리워크 이전 동작이라, 그림이 잠깐 어색해질 뿐
  // 이동은 계속 굴러간다. NaN을 그대로 흘리면 해소에 넘길 좌표가 통째로 NaN이 돼
  // 캐릭터가 화면에서 사라진다.
  if (!Number.isFinite(halfHeight) || !Number.isFinite(radius)) return 0;
  if (halfHeight < 0 || radius < 0) return 0;
  const drop = halfHeight - radius;
  // 원이 이미 발바닥까지 덮은 캐릭터(반지름 >= 반높이)를 더 내리면 원이 그림 아래로 삐져나와,
  // 이번엔 캐릭터가 장애물 앞에서 허공을 두고 멈춘다.
  return drop > 0 ? -drop : 0;
}

/**
 * 이동을 **발밑 좌표에서 풀고 노드 원점 좌표로 되돌려** 최종 위치를 돌려준다.
 *
 * 순서가 이 함수의 내용이다 — ① 출발·목적지를 오프셋만큼 내려 장애물을 해소하고 ② 결과를 다시
 * 올려 원점 좌표로 되돌린 뒤 ③ 아레나를 클램프한다. 셋 중 하나만 어긋나도 증상이 다르다:
 * ②를 빼먹으면 캐릭터가 매 프레임 오프셋만큼 가라앉고, ①을 목적지에만 걸면 첫 프레임에 한 번
 * 튀며, ③까지 발밑 좌표에서 하면 **아레나 경계가 통째로 오프셋만큼 밀린다**. 마지막 것은 경계에
 * 그려진 벽이 없어 화면에 아무 표시도 나지 않으므로, 자동 테스트가 유일한 그물이다.
 *
 * 클램프를 원점 기준으로 두는 것은 의도다. 아레나 경계는 눈에 보이는 면이 아니라 발을 맞출
 * 대상이 없고, "플레이어 원점은 아레나 밖으로 안 나간다"는 기존 불변식을 그대로 유지한다.
 *
 * @param from 현재 위치 (노드 원점 좌표)
 * @param to 이동 후보 위치 (노드 원점 좌표)
 * @param radius 이동 충돌 원의 반지름(px)
 * @param halfHeight 그림의 반높이(px) — 0이면 오프셋 없이 원점 기준으로 푼다
 * @param obstacles 장애물 목록 (맵 로드 전엔 빈 배열이라 무보정 통과)
 * @param arena 아레나 크기 — null이거나 width가 0 이하면 클램프하지 않는다(맵 로드 전)
 * @returns 최종 위치 (노드 원점 좌표, 새 객체)
 */
export function resolveMoveAtFootprint(
  from: Vec2,
  to: Vec2,
  radius: number,
  halfHeight: number,
  obstacles: readonly Obstacle[],
  arena: Arena | null,
): Vec2 {
  const offsetY = footprintOffsetY(halfHeight, radius);
  const resolved = resolveCircleMove(
    { x: from.x, y: from.y + offsetY },
    { x: to.x, y: to.y + offsetY },
    radius,
    obstacles,
  );
  const origin = { x: resolved.x, y: resolved.y - offsetY };
  // 크기 0인 아레나에 클램프하면 허용 범위가 뒤집혀 원점(0,0)이 나온다 — 맵 로드 전에
  // 그러면 플레이어가 맵 한가운데로 빨려 들어간다.
  if (!arena || arena.width <= 0) return origin;
  return clampToArena(origin, radius, arena);
}
