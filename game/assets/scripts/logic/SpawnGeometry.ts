// 적 스폰 지점을 카메라 뷰 사각형 "밖"에서 뽑는 순수 로직 — cc import 없이 평면 좌표만 다룬다.
//
// 뷰 사각형은 플레이어가 아니라 **카메라**를 중심으로 잡는다. 카메라는 벽에서 클램프되므로
// (ArenaLogic.cameraFollowPosition) 플레이어가 벽에 붙으면 플레이어는 화면 중앙이 아니고,
// 플레이어 기준으로 "충분히 멀다"고 뽑은 점이 반대편에서는 여전히 화면 안일 수 있다.
//
// 뽑는 방법은 기각 재추첨이 아니라 해석적 둘레 클리핑이다. 스폰 사각형(축 정렬)과 아레나(축 정렬)의
// 교집합은 항상 구간 하나이므로, 네 변에서 아레나 안에 들어오는 구간만 남기고 그 유효 길이의 합에
// roll을 매핑하면 기각 없이·편향 없이·난수 한 번으로 균등 샘플이 나온다. 재추첨 루프도 폴백 분기도
// 존재하지 않는다.

import type { Arena, Vec2 } from './ArenaLogic';

/**
 * 스폰 여유(margin)의 하한(px). "화면 밖"은 여유가 아니라 계약이므로 하한을 강제한다 —
 * 적 최대 충돌 반경(두억시니 40)보다 작으면 적 몸통 절반이 화면 안에서 태어난다.
 */
export const MIN_SPAWN_MARGIN = 40;

/**
 * 스폰 지점을 정하는 데 필요한 판 전체.
 *
 * 인자를 객체로 묶는 이유는 `cam`과 `player`가 **둘 다 `Vec2`**라서다. 위치를 바꿔 넘겨도 타입은
 * 통과하는데, 그 순간 이 슬라이스가 고친 회귀(플레이어 기준으로 뽑아 적이 화면 안에서 스폰됨)가
 * 그대로 되살아난다. 이름을 붙여 그 실수를 불가능하게 만든다.
 */
export interface SpawnField {
  /** 카메라 위치 — 벽 클램프가 적용된 **실재 카메라**다(여기서 재계산하지 않는다). */
  cam: Vec2;
  /** 플레이어 위치 — 퇴화 입력에서 폴백 방향을 정하는 데만 쓴다. */
  player: Vec2;
  /** 카메라 뷰 가로 절반(px) */
  viewHalfW: number;
  /** 카메라 뷰 세로 절반(px) */
  viewHalfH: number;
  /** 스폰 여유(px, 하한 클램프됨) */
  margin: number;
  /** 아레나 크기 (width <= 0이면 뷰 사각 둘레에서만 뽑는다) */
  arena: Arena;
  /** 스폰할 적의 충돌 반경(px) */
  radius: number;
}

/** 매 프레임 스윕이 적 하나를 분류한 결과. */
export type EnemyProximity = 'engaged' | 'inbound' | 'recycle';

/** 스폰 사각형 한 변의 유효 구간 — 아레나 밖으로 나간 부분을 잘라낸 뒤의 선분. */
interface Segment {
  /** 고정 좌표값 (세로 변이면 x, 가로 변이면 y) */
  fixed: number;
  /** 변하는 좌표의 시작값 */
  from: number;
  /** true면 x가 고정된 세로 변(좌·우), false면 y가 고정된 가로 변(상·하) */
  fixedIsX: boolean;
  /** 유효 길이(px). 0이면 이 변은 통째로 아레나 밖이다. */
  length: number;
}

/** 뷰 절반 크기를 정규화한다 — 비유한값·음수는 0으로(호출부가 그 프레임 스폰을 보류한다). */
function normSize(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * 좌표를 정규화한다 — 비유한 성분은 0으로.
 * NaN 좌표가 새어 나가면 그 적은 재활용 거리 비교도 교전 판정도 전부 false가 돼(모든 NaN 비교가
 * false), 죽지도 닿지도 사라지지도 않으면서 이동 중 상한 슬롯을 영구 점유한다.
 */
function normPoint(p: Vec2): Vec2 {
  return {
    x: Number.isFinite(p.x) ? p.x : 0,
    y: Number.isFinite(p.y) ? p.y : 0,
  };
}

/** 여유를 정규화한다 — 하한(MIN_SPAWN_MARGIN) 미만·비유한값은 하한으로 올린다. */
function normMargin(margin: number): number {
  return Number.isFinite(margin) && margin > MIN_SPAWN_MARGIN ? margin : MIN_SPAWN_MARGIN;
}

/** roll을 [0,1]로 정규화한다 — 비유한값은 0. */
function normRoll(roll: number): number {
  if (!Number.isFinite(roll)) return 0;
  return Math.min(1, Math.max(0, roll));
}

/**
 * 카메라가 열린 곳에 있을 때(벽 클램프 없음) 적이 스폰될 수 있는 가장 먼 거리(px).
 * 스폰 상한(maxEnemies)이 "살아 있는 적"이 아니라 "교전 중인 적"을 세도록 하는 기준이며,
 * 이렇게 유도하면 열린 곳에서는 갓 스폰된 적이 전부 교전권 안이라 기존 웨이브 밸런스가 그대로다.
 * @param viewHalfW 카메라 뷰 가로 절반(px)
 * @param viewHalfH 카메라 뷰 세로 절반(px)
 * @param margin 스폰 여유(px, 하한 클램프됨)
 */
export function engagementRadius(viewHalfW: number, viewHalfH: number, margin: number): number {
  const m = normMargin(margin);
  return Math.hypot(normSize(viewHalfW) + m, normSize(viewHalfH) + m);
}

/**
 * 어떤 플레이어 위치·roll에서도 스폰점이 넘지 않는 최대 거리(px).
 * 플레이어는 카메라 중심에서 최대 viewHalf만큼 벗어날 수 있고(벽에서 카메라가 클램프될 때),
 * 스폰점은 카메라에서 viewHalf + margin만큼 벗어나므로 둘을 더한 대각선이 상한이다.
 * @param viewHalfW 카메라 뷰 가로 절반(px)
 * @param viewHalfH 카메라 뷰 세로 절반(px)
 * @param margin 스폰 여유(px, 하한 클램프됨)
 */
export function maxSpawnDistance(viewHalfW: number, viewHalfH: number, margin: number): number {
  const m = normMargin(margin);
  return Math.hypot(2 * normSize(viewHalfW) + m, 2 * normSize(viewHalfH) + m);
}

/**
 * 재활용 거리를 최대 스폰 거리 위로 클램프한다 — 안 그러면 스폰하자마자 회수되는 루프가 돈다.
 * @param requested 인스펙터에서 준 재활용 거리(px)
 * @param viewHalfW 카메라 뷰 가로 절반(px)
 * @param viewHalfH 카메라 뷰 세로 절반(px)
 * @param margin 스폰 여유(px)
 */
export function clampRecycleDistance(
  requested: number,
  viewHalfW: number,
  viewHalfH: number,
  margin: number,
): number {
  const floor = maxSpawnDistance(viewHalfW, viewHalfH, margin);
  return Number.isFinite(requested) && requested > floor ? requested : floor;
}

/**
 * 스폰 게이트 — 압박 상한(교전 중인 적)과 성능 상한(이동 중인 적)을 모두 만족해야 스폰한다.
 *
 * 상한이 "살아 있는 적"을 세면 구석에서는 아직 도착하지 못한 적이 상한을 통째로 먹어 신규 스폰이
 * 멈춘다("구석으로 도망가면 적이 안 나온다"). 그래서 압박은 교전 중인 적만 세고, 이동 중인 적은
 * 별도 상한으로 막는다(교전 상한만 두면 파이프라인이 킬레이트 × 이동시간으로 무제한 증식한다).
 *
 * @param engaged 교전 반경 안에 있는 적 수
 * @param inbound 교전 반경 밖에서 걸어오는 중인 적 수
 * @param maxEngaged 교전 중인 적 상한 (웨이브 스케일링 적용된 maxEnemies)
 * @param maxInbound 이동 중인 적 상한
 * @returns 두 상한 모두 여유가 있으면 true. 비정상 상한(NaN·음수)은 폭주 대신 보류(false).
 */
export function canSpawn(
  engaged: number,
  inbound: number,
  maxEngaged: number,
  maxInbound: number,
): boolean {
  return engaged < maxEngaged && inbound < maxInbound;
}

/**
 * 매 프레임 스윕이 적 하나를 분류한다 — 회수 대상인가, 교전 중인가, 걸어오는 중인가.
 *
 * 거리가 비유한값(NaN·무한대)이면 **회수**한다. 순진하게 비교하면 NaN은 모든 비교가 false라
 * "회수도 안 되고 교전도 아닌" inbound로 빠져 상한 슬롯을 영원히 점유한다 — 죽지도 닿지도
 * 사라지지도 않는 유령 적이 된다. 명시적으로 회수로 몰아 스스로 청소되게 한다.
 *
 * @param distSq 플레이어까지의 제곱 거리 (sqrt를 아끼려고 제곱으로 받는다)
 * @param engageSq 교전 반경의 제곱
 * @param recycleSq 재활용 거리의 제곱
 */
export function classifyByDistance(
  distSq: number,
  engageSq: number,
  recycleSq: number,
): EnemyProximity {
  if (!Number.isFinite(distSq)) return 'recycle';
  if (distSq > recycleSq) return 'recycle';
  return distSq <= engageSq ? 'engaged' : 'inbound';
}

/** 스폰 사각형의 네 변 — 고정 좌표가 x인지(세로 변) 정한다. */
const EDGES: readonly {
  readonly signX: number;
  readonly signY: number;
  readonly fixedIsX: boolean;
}[] = [
  { signX: -1, signY: 0, fixedIsX: true }, // 좌변
  { signX: 1, signY: 0, fixedIsX: true }, // 우변
  { signX: 0, signY: -1, fixedIsX: false }, // 하변
  { signX: 0, signY: 1, fixedIsX: false }, // 상변
];

/** 아레나 크기가 실제 경계로 쓸 만한 값인지 — 아니면 제약 없이 뷰 사각 둘레만 쓴다. */
function isBounded(arena: Arena): boolean {
  return (
    Number.isFinite(arena.width) &&
    Number.isFinite(arena.height) &&
    arena.width > 0 &&
    arena.height > 0
  );
}

/**
 * 스폰 사각형 네 변에서 아레나 안에 들어오는 구간만 남긴다.
 * 아레나 데이터가 없으면(width·height <= 0) 제약을 걸지 않고 네 변을 통째로 쓴다 — 이 분기가 없으면
 * 모든 계산이 원점으로 붕괴해 적이 전부 플레이어 몸 안에서 스폰된다.
 */
function clipSegments(field: SpawnField): Segment[] {
  const cam = normPoint(field.cam);
  const m = normMargin(field.margin);
  const hw = normSize(field.viewHalfW) + m;
  const hh = normSize(field.viewHalfH) + m;
  const r = normSize(field.radius);

  const arena = field.arena;
  const bounded = isBounded(arena);
  // 적 반경까지 감안한 아레나 안쪽 허용 범위. 아레나가 없으면 무한 범위 = 클리핑 없음.
  const xMin = bounded ? -arena.width / 2 + r : Number.NEGATIVE_INFINITY;
  const xMax = bounded ? arena.width / 2 - r : Number.POSITIVE_INFINITY;
  const yMin = bounded ? -arena.height / 2 + r : Number.NEGATIVE_INFINITY;
  const yMax = bounded ? arena.height / 2 - r : Number.POSITIVE_INFINITY;

  const segs: Segment[] = [];
  for (const edge of EDGES) {
    const fixed = edge.fixedIsX ? cam.x + edge.signX * hw : cam.y + edge.signY * hh;
    // 고정 좌표가 아레나 밖이면 그 변은 통째로 버린다(벽 쪽 구간이 유효 둘레에서 빠지는 지점 — F35).
    const fixedMin = edge.fixedIsX ? xMin : yMin;
    const fixedMax = edge.fixedIsX ? xMax : yMax;
    if (fixed < fixedMin || fixed > fixedMax) continue;

    // 변하는 좌표를 아레나 안으로 자른다.
    const center = edge.fixedIsX ? cam.y : cam.x;
    const half = edge.fixedIsX ? hh : hw;
    const varMin = edge.fixedIsX ? yMin : xMin;
    const varMax = edge.fixedIsX ? yMax : xMax;
    const from = Math.max(center - half, varMin);
    const to = Math.min(center + half, varMax);
    if (to <= from) continue;

    segs.push({ fixed, from, fixedIsX: edge.fixedIsX, length: to - from });
  }
  return segs;
}

/**
 * 아레나 밖 구간을 잘라낸 뒤 남은 유효 둘레의 총 길이(px).
 * 0이면 뷰 밖이면서 아레나 안인 지점이 존재하지 않는다(아레나가 뷰보다 작은 소형 맵). 호출부가
 * 이 값으로 퇴화 맵을 감지해 경고할 수 있도록 따로 노출한다.
 * @param field 카메라·뷰·아레나·적 반경
 */
export function spawnPerimeterLength(field: SpawnField): number {
  let total = 0;
  for (const s of clipSegments(field)) total += s.length;
  return total;
}

/**
 * 유효 둘레가 0일 때의 폴백 — 플레이어에게서 가장 먼 아레나 안쪽 점.
 * 사각형에서 한 점으로부터 가장 먼 내부 점은 언제나 반대편 구석이다. 절대 중심(= 플레이어 근처)으로
 * 돌아가지 않는다 — 드문 사건이 플레이어 몸 안에서 터지는 것을 막는다.
 *
 * 아레나가 없으면 여기 오지 않는다(제약이 없으니 유효 둘레가 항상 양수다). 그래도 방어적으로,
 * 플레이어 위가 아니라 **스폰 사각형 위쪽 변**을 돌려준다 — 이 함수가 절대 하지 말아야 할 한 가지가
 * "플레이어 위에 스폰"이다.
 */
function fallbackSpawnPoint(field: SpawnField): Vec2 {
  const player = normPoint(field.player);
  const arena = field.arena;
  const r = normSize(field.radius);

  if (!isBounded(arena)) {
    const hh = normSize(field.viewHalfH) + normMargin(field.margin);
    return { x: player.x, y: player.y + hh };
  }

  const xMin = -arena.width / 2 + r;
  const xMax = arena.width / 2 - r;
  const yMin = -arena.height / 2 + r;
  const yMax = arena.height / 2 - r;
  // 반경이 아레나 절반보다 크면 허용 범위가 뒤집힌다 — clampToArena와 같은 규율로 중앙에 둔다.
  return {
    x: xMin > xMax ? 0 : player.x >= 0 ? xMin : xMax,
    y: yMin > yMax ? 0 : player.y >= 0 ? yMin : yMax,
  };
}

/**
 * 카메라 뷰 사각형 바깥 + 아레나 안에서 스폰 지점을 하나 균등 추출한다.
 *
 * 유효 둘레(아레나 밖 구간을 잘라낸 네 변)의 총 길이에 roll을 매핑하므로 기각 재추첨이 없다.
 * 반환점은 항상 ① 뷰 사각형 밖(카메라에서 viewHalf + margin 이상) ② 아레나 안(적 반경 포함)
 * ③ 최대 스폰 거리(maxSpawnDistance) 이내다.
 *
 * **③의 전제조건: 아레나가 적 지름보다 크다(width > 2·radius, height > 2·radius).** 그보다 얇으면
 * 적을 놓을 수 있는 띠 자체가 없어 네 변이 "카메라가 중앙이라서"가 아니라 "둘 곳이 없어서" 잘리고,
 * 그때는 폴백이 아레나 반대편 끝(최대 대각선)을 돌려주므로 ③을 넘을 수 있다. 정상 맵에서는
 * 기하가 스스로 ③을 보장한다 — 네 변이 전부 잘리려면 카메라가 아레나 중앙 근처여야 하고, 그러려면
 * 아레나가 작아야 하므로 대각선이 자동으로 묶인다. 그런 퇴화 맵은 호출부가 1회 경고한다.
 *
 * @param field 카메라·플레이어·뷰·여유·아레나·적 반경 (cam과 player를 바꿔 넘기는 사고를 막으려고 객체로 받는다)
 * @param roll [0,1] 난수 (테스트 결정성을 위해 주입 — 호출부가 Math.random()을 넘긴다)
 */
export function offViewSpawnPoint(field: SpawnField, roll: number): Vec2 {
  const segs = clipSegments(field);
  let total = 0;
  for (const s of segs) total += s.length;
  if (!(total > 0)) return fallbackSpawnPoint(field); // NaN도 여기로 — 비교를 뒤집어 놓았다

  let t = normRoll(roll) * total;
  let last = segs[0];
  for (const s of segs) {
    last = s;
    if (t <= s.length) return pointOn(s, t);
    t -= s.length;
  }
  // roll=1의 부동소수 오차로 어떤 구간에도 못 걸리면 마지막 유효 구간의 끝.
  return pointOn(last, last.length);
}

/** 선분 위의 점 — offset은 시작점(from)에서 잰 거리(px). */
function pointOn(s: Segment, offset: number): Vec2 {
  const v = s.from + Math.min(Math.max(offset, 0), s.length);
  return s.fixedIsX ? { x: s.fixed, y: v } : { x: v, y: s.fixed };
}
