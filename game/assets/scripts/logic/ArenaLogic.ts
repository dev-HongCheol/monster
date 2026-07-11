// 경계형 아레나의 순수 로직 — cc import 없이 평면 좌표·크기만 다뤄 결정적으로 테스트한다.
// 아레나는 월드 원점(0,0)을 중심으로 하는 width×height 사각이며, 경계는
// x ∈ [-width/2, width/2], y ∈ [-height/2, height/2]. 가변 상태(플레이어·카메라 위치)는
// 컨트롤러가 보관하고, 이 모듈은 그 값을 받아 클램프 결과를 계산하는 순수 함수만 제공한다.

/** 평면 2D 벡터 (cc.Vec3을 logic 경계 밖으로 넘기지 않기 위한 경량 타입). */
export interface Vec2 {
  x: number;
  y: number;
}

/** 원점(0,0) 중심 경계형 아레나 크기(px). MapManager가 맵 데이터에서 읽어 주입한다. */
export interface Arena {
  /** 아레나 가로 크기(px) */
  width: number;
  /** 아레나 세로 크기(px) */
  height: number;
}

/** 값을 [min,max]로 클램프한다. 범위가 뒤집히면(min>max) 중점을 돌려준다(대칭 범위라 0). */
function clampRange(v: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/**
 * 반경을 가진 엔티티 위치를 아레나 벽 안으로 클램프한다(플레이어 이동·적 스폰이 공유).
 * 엔티티가 벽을 파고들지 않도록 경계에서 반경만큼 안쪽까지만 허용한다. 반경이 아레나 절반보다
 * 크면(허용 범위 뒤집힘) 중앙(0)에 둔다.
 * @param pos 클램프할 위치
 * @param radius 엔티티 충돌 반경(px)
 * @param arena 아레나 크기
 */
export function clampToArena(pos: Vec2, radius: number, arena: Arena): Vec2 {
  const halfW = arena.width / 2;
  const halfH = arena.height / 2;
  return {
    x: clampRange(pos.x, -halfW + radius, halfW - radius),
    y: clampRange(pos.y, -halfH + radius, halfH - radius),
  };
}

/**
 * 플레이어를 따라가되 카메라 뷰가 아레나 밖으로 나가지 않도록 클램프한 카메라 위치를 돌려준다.
 * 아레나가 뷰보다 작으면(허용 범위 뒤집힘) 중앙(0)에 둬 아레나 전체가 보이게 한다.
 * @param player 플레이어 위치
 * @param viewHalfW 카메라 뷰 가로 절반(px)
 * @param viewHalfH 카메라 뷰 세로 절반(px)
 * @param arena 아레나 크기
 */
export function cameraFollowPosition(
  player: Vec2,
  viewHalfW: number,
  viewHalfH: number,
  arena: Arena,
): Vec2 {
  const halfW = arena.width / 2;
  const halfH = arena.height / 2;
  return {
    x: clampRange(player.x, -halfW + viewHalfW, halfW - viewHalfW),
    y: clampRange(player.y, -halfH + viewHalfH, halfH - viewHalfH),
  };
}

/**
 * 위치가 아레나(원점 중심) 경계에서 margin을 넘어 벗어났는지 판정한다(발사체 화면 밖 컬링).
 * 카메라가 플레이어를 따라가므로 컬링 기준을 화면 원점이 아니라 아레나 경계로 잡는다 —
 * 안 그러면 플레이어가 벽 근처에서 쏜 발사체가 원점 기준 한도를 넘어 즉시 사라진다.
 * @param pos 판정할 위치
 * @param arena 아레나 크기
 * @param margin 경계 바깥 허용 여유(px)
 */
export function isOutsideArena(pos: Vec2, arena: Arena, margin: number): boolean {
  return Math.abs(pos.x) > arena.width / 2 + margin || Math.abs(pos.y) > arena.height / 2 + margin;
}
