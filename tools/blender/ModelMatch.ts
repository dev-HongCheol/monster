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
 * 덤프는 파이썬이 하고 판정은 여기서 한다. 파이썬은 타입체크 · 린트 · vitest 어디에도 안 걸린다
 * (`README.md` 「판정은 파이썬에 없다」). 명세는 `tests/logic/Blender3dGate.test.ts`다.
 */

/** 덤프의 메시 하나 — `inspect_meshes.py`가 적는 값 가운데 판정이 읽는 것. */
export interface IMeshDump {
  name: string;
  vertices: number;
  /** 정점 좌표를 소수점 다섯 자리로 반올림해 순서대로 접은 sha256 */
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

/** `matchModels`의 결과. `problems`가 비어 있으면 같은 몸이다. */
export interface IModelMatch {
  problems: string[];
  /** 두 판이 함께 가진 코어 본 수 */
  coreBones: number;
  /** 덜 입은 판의 맨살 점 수 */
  skinInLess: number;
  /** 더 입은 판의 맨살 점 수 */
  skinInMore: number;
  /** 덜 입은 판에는 있는데 더 입은 판에는 없는 맨살 점 — 옷 아래에서 VRoid가 지운 살이다. 문제가 아니다 */
  skinRemoved: number;
  /** 더 입은 판에만 있는 맨살 점 — 0이어야 한다 */
  skinOutside: number;
}

/**
 * 코어 본의 접두어. VRoid의 사람 골격이 전부 이 이름으로 시작하고, 자세와 무기는 이 본들에만 걸린다. 머리카락과
 * 옷의 흔들림 본(`J_Sec_`)은 입힌 옷에 따라 수가 달라지는 것이 정상이라 견주지 않는다(G1 실측 — 코어 52개는
 * 같고 전체는 120 · 150개였다).
 */
const CORE_BONE_PREFIX = 'J_Bip_';

/** 좌표 지문이 같아야 하는 메시. 옷과 무관한 부위다. */
const SAME_DIGEST_MESHES = ['Face', 'Hair'] as const;

/** 몸 메시에서 맨살 머티리얼을 고르는 말. VRoid의 이름은 `N00_000_00_Body_00_SKIN (Instance)` 꼴이다. */
const SKIN_MATERIAL = '_SKIN';

/** 이름이 `prefix`로 시작하는 메시. Blender가 같은 이름에 `.001`을 붙일 수 있어 앞머리로 찾는다. */
function findMesh(dump: IModelDump, prefix: string): IMeshDump | undefined {
  return dump.meshes.find((mesh) => mesh.name.startsWith(prefix));
}

/** 몸 메시의 맨살 좌표. 맨살 머티리얼이 없으면 `null`. */
function skinCoords(dump: IModelDump): Set<string> | null {
  const body = findMesh(dump, 'Body');
  if (!body) return null;
  const names = Object.keys(body.byMaterial).filter((name) => name.includes(SKIN_MATERIAL));
  if (names.length === 0) return null;
  return new Set(names.flatMap((name) => body.byMaterial[name]));
}

/**
 * 두 판이 같은 몸인지 본다. 코어 본이 같은가, 얼굴 · 머리카락의 좌표 지문이 같은가, 더 입은 판의 맨살이 덜 입은
 * 판의 부분집합인가.
 *
 * @param less 옷을 덜 입은 판 — 가림 전용 몸으로 쓰이는 쪽
 * @param more 옷을 더 입은 판
 */
export function matchModels(less: IModelDump, more: IModelDump): IModelMatch {
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

  for (const name of SAME_DIGEST_MESHES) {
    const a = findMesh(less, name);
    const b = findMesh(more, name);
    if (!a || !b) {
      problems.push(`${name} 메시가 ${a ? '더' : '덜'} 입은 판에 없다`);
    } else if (a.digest !== b.digest) {
      problems.push(
        `${name} 메시의 좌표 지문이 다르다 (정점 ${a.vertices} · ${b.vertices}) — 두 판이 다른 모델에서 나왔다`,
      );
    }
  }

  const lessSkin = skinCoords(less);
  const moreSkin = skinCoords(more);
  let skinRemoved = 0;
  let skinOutside = 0;
  if (!lessSkin || !moreSkin) {
    // 빈 집합은 무엇의 부분집합이기도 하다. 못 고른 것을 「같은 몸」으로 읽으면 이 검사가 아무것도 안 보면서 통과한다
    problems.push(
      `${lessSkin ? '더' : '덜'} 입은 판의 몸 메시에서 맨살 머티리얼(이름에 ${SKIN_MATERIAL})을 못 찾았다 — 머티리얼 이름이 바뀌었는지 덤프를 본다`,
    );
  } else {
    for (const point of moreSkin) if (!lessSkin.has(point)) skinOutside++;
    skinRemoved = lessSkin.size - (moreSkin.size - skinOutside);
    if (skinOutside > 0) {
      problems.push(
        `더 입은 판의 맨살 점 ${skinOutside}개가 덜 입은 판에 없다 — 덜 입은 판을 가림 전용 몸으로 쓰면 그 자리의 가림이 어긋난다`,
      );
    }
  }

  return {
    problems,
    coreBones: [...lessBones].filter((bone) => moreBones.has(bone)).length,
    skinInLess: lessSkin?.size ?? 0,
    skinInMore: moreSkin?.size ?? 0,
    skinRemoved,
    skinOutside,
  };
}
