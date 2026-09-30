/**
 * 두 `.vrm` 판이 같은 몸인지 가르는 순수 로직. 입력은 `inspect_meshes.py`가 낸 덤프 둘이다.
 *
 * **왜 필요한가.** 플레이어는 층으로 구워 게임에서 겹친다. 화면에 보이는 몸 · 얼굴 · 머리카락은 늘 맨살 판의
 * 것이고, 다른 층은 전부 그 맨살 판을 가림 전용 몸으로 두고 굽는다. 옷을 입힌 판이 맨살 판과 다른 몸이면 —
 * 슬라이더를 만진 뒤에 내보냈거나 다른 `.vroid`에서 나왔으면 — 상의가 엉뚱한 몸에 가려진 채로 구워져 겹쳤을
 * 때 구멍이나 겹침이 생긴다. 굽기는 끝까지 돌고 그림도 한 장씩은 멀쩡해서, 견주지 않으면 드러나지 않는다.
 * 옷 판을 더할 때마다, 그리고 옷을 전부 끈 판(G4 §12)을 들여올 때 먼저 돌린다.
 *
 * **「정점 수가 같다」로 보지 않는다.** VRoid는 옷 아래의 살을 지운 채 내보내므로 정점 수는 판마다 다른 것이
 * 정상이다(G1 실측 — 흰 티 아래 708점, 나시 아래 327점이 지워졌다). 지워진 만큼 정점 번호도 밀린다. 그래서
 * 맨살은 번호가 아니라 **좌표의 집합**으로 견주고, 잣대는 「옷을 더 입은 판에 남은 살이 전부 덜 입은 판에도
 * 있는가」다 — 덜 입은 판이 상위 집합이라는 것이 가림 전용 몸으로 쓸 때 필요한 성질 그대로다.
 *
 * **모델이 통째로 옮겨져 있으면 그 이동을 빼고 견준다.** 신발을 벗긴 판은 VRoid가 밑창 높이만큼 모델 전체를
 * 내려서 내보낸다(2026-09-21 실측 — 옷을 전부 끈 판이 맨살 판보다 16.23mm 낮았고, 얼굴 · 머리카락 · 발목 위의
 * 맨살은 그만큼 옮기면 전부 맞았다). 좌표를 그대로 견주면 같은 몸인데도 모든 점이 어긋난다. 이동은 얼굴 메시의
 * 무게중심 차이로 잰다 — 얼굴은 옷과 무관한 강체라, 같은 모델이면 그 차이가 곧 모델의 이동이다. 다른 모델이면
 * 이 값은 뜻이 없지만, 그때는 바로 뒤의 얼굴 비교가 떨어진다. 잰 이동은 결과에 돌려준다 — 굽기가 두 판을 같은
 * 자리에 세우려면 이 값이 필요하다.
 *
 * 덤프는 파이썬이 하고 판정은 여기서 한다. 파이썬은 타입체크 · 린트 · vitest 어디에도 안 걸린다
 * (`README.md` 「판정은 파이썬에 없다」). 명세는 `tests/logic/Blender3dGate.test.ts`다.
 */

/** 덤프의 메시 하나 — `inspect_meshes.py`가 적는 값 가운데 판정이 읽는 것. */
export interface IMeshDump {
  name: string;
  vertices: number;
  /** 정점 좌표를 소수점 다섯 자리로 반올림해 순서대로 접은 sha256. 판정은 쓰지 않는다 — 이동이 있으면 뜻이 없다 */
  digest: string;
  /** 머티리얼마다 그 면이 쓰는 정점 좌표(`x,y,z` 문자열, 정렬돼 있고 겹치지 않는다) */
  byMaterial: Record<string, string[]>;
}

/** `.vrm` 하나의 덤프. */
export interface IModelDump {
  vrm: string;
  bones: string[];
  meshes: IMeshDump[];
}

/** `matchModels`의 선택지. */
export interface IMatchOptions {
  /**
   * 이 높이(m, 더 입은 판의 좌표) 아래의 맨살은 부분집합 검사에서 뺀다. 신발 속의 발은 굽에 맞춰 세워져 있어
   * 맨발과 모양이 다르므로, 신발을 벗긴 판과 견줄 때 발목 높이를 준다. 기본은 빼지 않는다 — 조용히 빼면 다른
   * 자리의 어긋남까지 묻힌다
   */
  ignoreBelowZ?: number;
}

/** `matchModels`의 결과. `problems`가 비어 있으면 같은 몸이다. */
export interface IModelMatch {
  problems: string[];
  /** 더 입은 판이 덜 입은 판보다 옮겨져 있는 거리(m) — 더 입은 판의 좌표에서 이 값을 빼면 덜 입은 판의 좌표다 */
  offset: [number, number, number];
  /** 두 판이 함께 가진 코어 본 수 */
  coreBones: number;
  /** 덜 입은 판의 맨살 점 수 */
  skinInLess: number;
  /** 더 입은 판의 맨살 점 수 */
  skinInMore: number;
  /** 덜 입은 판에는 있는데 더 입은 판에는 없는 맨살 점 — 옷 아래에서 VRoid가 지운 살이다. 문제가 아니다 */
  skinRemoved: number;
  /** 더 입은 판에만 있는 맨살 점 — 0이어야 한다. `ignoreBelowZ` 아래의 점은 세지 않는다 */
  skinOutside: number;
  /** `ignoreBelowZ` 때문에 검사에서 뺀, 더 입은 판에만 있는 맨살 점 */
  skinIgnored: number;
}

/**
 * 코어 본의 접두어. VRoid의 사람 골격이 전부 이 이름으로 시작하고, 자세와 무기는 이 본들에만 걸린다. 머리카락과
 * 옷의 흔들림 본(`J_Sec_`)은 입힌 옷에 따라 수가 달라지는 것이 정상이라 견주지 않는다(G1 실측 — 코어 52개는
 * 같고 전체는 120 · 150개였다).
 */
const CORE_BONE_PREFIX = 'J_Bip_';

/** 모양이 같아야 하는 메시. 옷과 무관한 부위다. */
const SAME_SHAPE_MESHES = ['Face', 'Hair'] as const;

/** 몸 메시에서 맨살 머티리얼을 고르는 말. VRoid의 이름은 `N00_000_00_Body_00_SKIN (Instance)` 꼴이다. */
const SKIN_MATERIAL = '_SKIN';

/**
 * 두 좌표를 같은 점으로 보는 거리(m, 축마다). 덤프가 좌표를 소수점 다섯 자리로 반올림하므로 두 판의 같은 점이
 * 반올림만으로 0.01mm까지 벌어지고, 이동을 뺄 때 그 오차가 한 번 더 실린다. 0.05mm는 그보다 넉넉하고 실제
 * 형상 차이(발 모양은 mm 단위로 다르다)보다 훨씬 작다.
 */
const SAME_POINT_M = 5e-5;

type Point = readonly [number, number, number];

/** 이름이 `prefix`로 시작하는 메시. Blender가 같은 이름에 `.001`을 붙일 수 있어 앞머리로 찾는다. */
function findMesh(dump: IModelDump, prefix: string): IMeshDump | undefined {
  return dump.meshes.find((mesh) => mesh.name.startsWith(prefix));
}

/** 메시에서 이름에 `needle`이 든 머티리얼의 좌표를 읽는다. `needle`이 비면 전부다. */
function pointsOf(mesh: IMeshDump, needle = ''): Point[] {
  return Object.entries(mesh.byMaterial)
    .filter(([name]) => name.includes(needle))
    .flatMap(([, coords]) =>
      coords.map((text) => {
        const [x, y, z] = text.split(',').map(Number);
        return [x, y, z] as const;
      }),
    );
}

/** 점들의 무게중심. */
function centroid(points: readonly Point[]): Point {
  const sum = [0, 0, 0];
  for (const point of points) for (let axis = 0; axis < 3; axis++) sum[axis] += point[axis];
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}

/**
 * 점 집합을 「허용 거리 안에 같은 점이 있는가」로 물을 수 있게 격자에 담는다. 반올림된 좌표는 문자열로 맞대면
 * 경계에 걸린 점이 어긋나므로, 칸을 허용 거리보다 크게 잡고 이웃 칸까지 본다.
 */
function pointLookup(points: readonly Point[]): (point: Point) => boolean {
  const cell = SAME_POINT_M * 2;
  const grid = new Map<string, Point[]>();
  const keyOf = (x: number, y: number, z: number) => `${x},${y},${z}`;
  for (const point of points) {
    const key = keyOf(
      Math.floor(point[0] / cell),
      Math.floor(point[1] / cell),
      Math.floor(point[2] / cell),
    );
    const bucket = grid.get(key);
    if (bucket) bucket.push(point);
    else grid.set(key, [point]);
  }
  return (point) => {
    const cx = Math.floor(point[0] / cell);
    const cy = Math.floor(point[1] / cell);
    const cz = Math.floor(point[2] / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(keyOf(cx + dx, cy + dy, cz + dz));
          if (
            bucket?.some(
              (other) =>
                Math.abs(other[0] - point[0]) <= SAME_POINT_M &&
                Math.abs(other[1] - point[1]) <= SAME_POINT_M &&
                Math.abs(other[2] - point[2]) <= SAME_POINT_M,
            )
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };
}

/**
 * 두 판이 같은 몸인지 본다. 코어 본이 같은가, 얼굴 · 머리카락의 모양이 같은가, 더 입은 판의 맨살이 덜 입은 판의
 * 부분집합인가. 좌표는 모델의 이동(얼굴의 무게중심 차이)을 뺀 뒤에 견준다.
 *
 * @param less 옷을 덜 입은 판 — 가림 전용 몸으로 쓰이는 쪽
 * @param more 옷을 더 입은 판
 */
export function matchModels(
  less: IModelDump,
  more: IModelDump,
  options: IMatchOptions = {},
): IModelMatch {
  const problems: string[] = [];

  const coreOf = (dump: IModelDump) =>
    new Set(dump.bones.filter((bone) => bone.startsWith(CORE_BONE_PREFIX)));
  const lessBones = coreOf(less);
  const moreBones = coreOf(more);
  const onlyLess = [...lessBones].filter((bone) => !moreBones.has(bone));
  const onlyMore = [...moreBones].filter((bone) => !lessBones.has(bone));
  if (onlyLess.length > 0) {
    problems.push(`덜 입은 판에만 있는 코어 본: ${onlyLess.join(' · ')}`);
  }
  if (onlyMore.length > 0) {
    problems.push(`더 입은 판에만 있는 코어 본: ${onlyMore.join(' · ')}`);
  }

  // 이동은 얼굴로 잰다. 얼굴이 한쪽에 없으면 0으로 두고, 없다는 것은 아래 모양 비교가 말한다
  const lessFace = findMesh(less, 'Face');
  const moreFace = findMesh(more, 'Face');
  let offset: [number, number, number] = [0, 0, 0];
  if (lessFace && moreFace) {
    const a = centroid(pointsOf(lessFace));
    const b = centroid(pointsOf(moreFace));
    offset = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  }
  const toLess = (point: Point): Point => [
    point[0] - offset[0],
    point[1] - offset[1],
    point[2] - offset[2],
  ];

  for (const name of SAME_SHAPE_MESHES) {
    const a = findMesh(less, name);
    const b = findMesh(more, name);
    if (!a || !b) {
      const where = !a && !b ? '두 판 모두' : a ? '더 입은 판' : '덜 입은 판';
      problems.push(`${name} 메시가 ${where}에 없다`);
      continue;
    }
    const lessPoints = pointsOf(a);
    const morePoints = pointsOf(b).map(toLess);
    const inLess = pointLookup(lessPoints);
    const inMore = pointLookup(morePoints);
    const missing =
      morePoints.filter((point) => !inLess(point)).length +
      lessPoints.filter((point) => !inMore(point)).length;
    if (missing > 0) {
      problems.push(
        `${name} 메시의 모양이 다르다 — 서로 없는 점이 ${missing}개다(${lessPoints.length} · ${morePoints.length}점). 두 판이 다른 모델에서 나왔다`,
      );
    }
  }

  const lessBody = findMesh(less, 'Body');
  const moreBody = findMesh(more, 'Body');
  const lessSkin = lessBody ? pointsOf(lessBody, SKIN_MATERIAL) : [];
  const moreSkin = moreBody ? pointsOf(moreBody, SKIN_MATERIAL) : [];
  let skinRemoved = 0;
  let skinOutside = 0;
  let skinIgnored = 0;
  if (lessSkin.length === 0 || moreSkin.length === 0) {
    // 빈 집합은 무엇의 부분집합이기도 하다. 못 고른 것을 「같은 몸」으로 읽으면 이 검사가 아무것도 안 보면서 통과한다
    problems.push(
      `${lessSkin.length === 0 && moreSkin.length === 0 ? '두 판 모두' : lessSkin.length === 0 ? '덜 입은 판' : '더 입은 판'}의 몸 메시에서 맨살 머티리얼(이름에 ${SKIN_MATERIAL})을 못 찾았다 — 머티리얼 이름이 바뀌었는지 덤프를 본다`,
    );
  } else {
    const inLess = pointLookup(lessSkin);
    const heights: number[] = [];
    for (const point of moreSkin) {
      if (inLess(toLess(point))) continue;
      if (options.ignoreBelowZ !== undefined && point[2] < options.ignoreBelowZ) skinIgnored++;
      else heights.push(point[2]);
    }
    skinOutside = heights.length;
    // 덜 입은 판의 점 가운데 더 입은 판에 짝이 없는 것을 센다. 더 입은 판 쪽에서 맞은 수를 빼면, 같은 좌표에 점이
    // 겹친 머티리얼 경계에서 한 점이 여러 번 맞아 음수나 과소가 나온다
    const inMore = pointLookup(moreSkin.map(toLess));
    skinRemoved = lessSkin.filter((point) => !inMore(point)).length;
    if (skinOutside > 0) {
      problems.push(
        `더 입은 판의 맨살 점 ${skinOutside}개가 덜 입은 판에 없다(높이 ${Math.min(...heights).toFixed(3)} ~ ${Math.max(...heights).toFixed(3)}m) — 덜 입은 판을 가림 전용 몸으로 쓰면 그 자리의 가림이 어긋난다`,
      );
    }
  }

  return {
    problems,
    offset,
    coreBones: [...lessBones].filter((bone) => moreBones.has(bone)).length,
    skinInLess: lessSkin.length,
    skinInMore: moreSkin.length,
    skinRemoved,
    skinOutside,
    skinIgnored,
  };
}
