/**
 * 슬롯 범위 탐침(G4 §12)이 세우는 시험 장비 — **출하하지 않는다.**
 *
 * 탐침의 입력은 슬롯의 기본 아이템이 아니라 그 슬롯에 올 수 있는 가장 나쁜 아이템이다(사용자 결정 2026-09-19).
 * 기본 신발만 보면 하의와 거의 안 만나지만 긴 부츠는 무릎까지 올라와 하의와 앞뒤를 다투고, 몸에 붙는 상의만
 * 보면 맨살 몸의 가림으로 충분하지만 넓은 소매는 몸의 윤곽 밖에서 지팡이와 만난다. 그런 아이템을 기본 도형으로
 * 세운 것이 이 파일이다. 디자인이 아니라 **층끼리의 앞뒤를 잴 부피**이므로 모양은 거칠다.
 *
 * **장비는 본 하나에 강체로 붙는 조각들이다.** 굽는 쪽(`bake_motion.py --gear-spec`)이 조각마다 원점을 그 본의
 * 머리에 놓고 걷는 동안 본을 회전까지 따라가게 한다. 두 다리를 따라 변형되는 한 벌의 옷은 지금 도구로 못 만들어서
 * (그 제작 경로는 v2로 미뤘다 — 백로그 F112) 하의는 골반 · 허벅지 · 정강이 조각으로 나눠 세운다. 걷는 동안 무릎에서
 * 조각이 끊겨 보이지만, 이 탐침이 보려는 것은 하의의 변형이 아니라 하의와 부츠의 앞뒤다.
 *
 * **좌표는 모델 좌표로 적고 `tube`가 본의 머리에서 잰 값으로 옮긴다.** 조각마다 원점이 달라서 부품 좌표로 바로
 * 적으면 부츠 목의 높이와 바지 밑단의 높이를 견줘 읽을 수 없다.
 */

import { BOSS, type IWeaponSpec, METAL, PLATE } from './BakeSpec.ts';

/** 모델 좌표의 점 · 색(m, 0~255 sRGB). */
export type Vec3 = readonly [number, number, number];

/**
 * 기준 자세(`retarget_render.BASE_ARM_POSE`)에서 잰 본의 머리 — 모델 좌표(m, 2026-09-21 실측). 조각의 원점이
 * 여기에 놓이므로 모델 좌표의 점에서 이것을 빼면 부품 좌표다. 오른쪽(`R`)이 −x다.
 *
 * 팔은 기준 자세로 접혀 있고 다리는 곧게 서 있다. 걷기 프레임은 팔을 늘 이 자세로 다시 입히므로(`bake_motion.py`)
 * 팔뚝에 붙는 소매의 방향은 걷는 동안 그대로다.
 */
export const BASE_POSE_HEAD = {
  J_Bip_C_Hips: [0, -0.0046, 0.4748],
  J_Bip_C_UpperChest: [0, 0.0026, 0.631],
  J_Bip_L_UpperLeg: [0.0646, -0.0017, 0.4421],
  J_Bip_R_UpperLeg: [-0.0646, -0.0017, 0.4421],
  J_Bip_L_LowerLeg: [0.0646, 0.0017, 0.2796],
  J_Bip_R_LowerLeg: [-0.0646, 0.0017, 0.2796],
  J_Bip_L_Foot: [0.0646, 0.0137, 0.0924],
  J_Bip_R_Foot: [-0.0646, 0.0137, 0.0924],
  J_Bip_L_LowerArm: [0.1282, 0.0111, 0.6176],
  J_Bip_R_LowerArm: [-0.1282, 0.0111, 0.6176],
} as const satisfies Record<string, Vec3>;

/** 조각을 붙일 수 있는 본. */
export type SlotBone = keyof typeof BASE_POSE_HEAD;

/** 기준 자세의 손목(손 본의 머리) — 소매가 끝나는 자리다(m, 2026-09-21 실측). 두 팔의 높이가 다르다. */
const WRIST = {
  L: [0.1777, -0.0669, 0.6039],
  R: [-0.1777, -0.0654, 0.6381],
} as const satisfies Record<string, Vec3>;

/** 맨 정강이의 살이 정강이 본의 축에서 가장 멀리 나간 거리(m, 2026-09-21 실측). 부츠 통은 이보다 굵어야 한다. */
export const BARE_SHIN_RADIUS_M = 0.068;

/** 부품 하나. 모양 인자는 `weapons.py`의 `build_part`가 해석한다. */
export type ISlotPart = { type: string } & Record<string, unknown>;

/** `tube`가 세우는 속 빈 관 — `weapons.py`의 `horn`을 굽힘 없이 쓴다. */
export interface ITubePart {
  type: 'horn';
  bend: 0;
  /** 관의 길이(m) */
  length: number;
  /** 시작점 쪽 반지름(m) */
  radius: number;
  /** 끝점 쪽 반지름(m) */
  tip: number;
  /** 시작점 — 붙는 본의 머리에서 잰 부품 좌표(m) */
  location: Vec3;
  /** X · Y · Z 회전(도). 관의 축(+Z)을 시작점에서 끝점 쪽으로 돌린다 */
  rotation: Vec3;
  columns: number;
  rows: number;
  color: Vec3;
  group: 'Gear';
}

/** 본 하나에 강체로 붙는 조각. */
export interface ISlotPiece {
  id: string;
  bone: SlotBone;
  parts: (ISlotPart | ITubePart)[];
}

/** 장비 사양 — `bake_motion.py`의 `--gear-spec`이 읽는다. */
export interface ISlotGear {
  id: string;
  pieces: ISlotPiece[];
}

/** 모델 좌표의 점을 그 본에 붙는 조각의 부품 좌표로 옮긴다. */
function fromHead(bone: SlotBone, point: Vec3): Vec3 {
  const head = BASE_POSE_HEAD[bone];
  return [point[0] - head[0], point[1] - head[1], point[2] - head[2]];
}

/**
 * 두 점을 잇는 속 빈 관. 소매 · 바짓가랑이 · 부츠 통이 이것으로 선다.
 *
 * 속이 비고 양 끝이 열려 있어야 한다. 막힌 원뿔로 세우면 넓은 소매의 입구가 원판으로 덮여, 소매 안쪽 벽과
 * 그 앞의 팔뚝이 한 프레임 안에서 앞뒤로 갈리는 자리가 통째로 사라진다 — 가림이 풀어야 하는 자리다.
 *
 * 회전은 오일러 XYZ(X를 먼저 돌린다)로 +Z를 관의 방향 `d`로 보낸다. X로 `a`, Y로 `b`를 돌린 +Z는
 * `(cos a · sin b, −sin a, cos a · cos b)`이므로 `a = −asin(d.y)`, `b = atan2(d.x, d.z)`다.
 *
 * @param bone 관이 붙는 본. 좌표를 이 본의 머리에서 잰 값으로 옮긴다
 * @param from 시작점 — 모델 좌표(m)
 * @param to 끝점 — 모델 좌표(m)
 * @param radii 시작점 쪽과 끝점 쪽의 반지름(m)
 */
export function tube(
  bone: SlotBone,
  from: Vec3,
  to: Vec3,
  radii: readonly [number, number],
  color: Vec3,
): ITubePart {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const length = Math.hypot(d[0], d[1], d[2]);
  if (length < 1e-9) throw new Error('tube: 시작점과 끝점이 같다');
  const degrees = (rad: number) => (rad * 180) / Math.PI;
  return {
    type: 'horn',
    bend: 0,
    length,
    radius: radii[0],
    tip: radii[1],
    location: fromHead(bone, from),
    rotation: [degrees(-Math.asin(d[1] / length)), degrees(Math.atan2(d[0], d[2])), 0],
    columns: 24,
    rows: 4,
    color,
    group: 'Gear',
  };
}

/** 장비 여럿을 한 사양으로 합친다. 기준 컷은 짝을 이루는 장비를 한꺼번에 받는다(`--gear-spec`은 하나다). */
export function mergeGear(id: string, ...gears: readonly ISlotGear[]): ISlotGear {
  return { id, pieces: gears.flatMap((gear) => gear.pieces) };
}

/** 좌우 다리에 같은 조각을 세운다. `build`는 그 다리의 x(왼쪽이 +)와 본 이름의 `L` · `R`을 받는다. */
function bothLegs(build: (x: number, side: 'L' | 'R') => ISlotPiece): ISlotPiece[] {
  return [build(0.0646, 'L'), build(-0.0646, 'R')];
}

const BOOT_LEATHER: Vec3 = [120, 75, 40];
const PANTS_CLOTH: Vec3 = [60, 75, 130];
const SLEEVE_CLOTH: Vec3 = [120, 60, 140];

/** 긴 부츠의 목이 끝나는 높이(m). 무릎 관절(0.28) 바로 아래다. */
const BOOT_TOP_Z = 0.262;

/**
 * 무릎까지 오는 긴 부츠. 통은 정강이 본을, 발은 발 본을 따라간다.
 *
 * 통의 반지름(0.078 → 0.088)은 맨 정강이(`BARE_SHIN_RADIUS_M`)를 담는 가장 가는 값에서 목으로 갈수록 조금
 * 벌어진다. 발은 길쭉한 타원체다 — 뒤꿈치 뒤 6cm에서 발끝 앞까지, 바닥에서 발등 높이(0.10)까지를 덮는다.
 */
export const LONG_BOOTS: ISlotGear = {
  id: 'longBoots',
  pieces: [
    ...bothLegs((x, side) => ({
      id: `bootShaft${side}`,
      bone: `J_Bip_${side}_LowerLeg`,
      parts: [
        tube(
          `J_Bip_${side}_LowerLeg`,
          [x, 0.012, 0.085],
          [x, 0.003, BOOT_TOP_Z],
          [0.078, 0.088],
          BOOT_LEATHER,
        ),
      ],
    })),
    ...bothLegs((x, side) => ({
      id: `bootFoot${side}`,
      bone: `J_Bip_${side}_Foot`,
      parts: [
        {
          type: 'sphere',
          radius: 0.05,
          subdivisions: 3,
          scale: [1.15, 2.3, 1.0],
          location: fromHead(`J_Bip_${side}_Foot`, [x, -0.055, 0.052]),
          color: BOOT_LEATHER,
          group: 'Gear',
        },
      ],
    })),
  ],
};

/**
 * 부피 있는 하의의 조각들. `shinEndZ`가 정강이 관이 끝나는 높이다.
 *
 * 같은 축에서 이어지는 관은 겹치는 구간의 반지름을 다르게 둔다(허벅지 끝 0.103, 정강이 시작 0.099). 같으면 두
 * 면이 한 자리에 놓여 어느 쪽이 그려질지가 픽셀마다 흔들리고, 그 흔들림이 층과 기준 컷에서 다르게 나와 잰 값에
 * 가림과 무관한 차이가 섞인다.
 */
function bulkyPants(id: string, shinEndZ: number, shinEndRadius: number): ISlotGear {
  return {
    id,
    pieces: [
      {
        id: 'pantsHips',
        bone: 'J_Bip_C_Hips',
        parts: [tube('J_Bip_C_Hips', [0, 0, 0.52], [0, 0, 0.4], [0.118, 0.135], PANTS_CLOTH)],
      },
      ...bothLegs((x, side) => ({
        id: `pantsThigh${side}`,
        bone: `J_Bip_${side}_UpperLeg`,
        parts: [
          tube(
            `J_Bip_${side}_UpperLeg`,
            [x, -0.002, 0.445],
            [x, 0.002, 0.285],
            [0.098, 0.103],
            PANTS_CLOTH,
          ),
        ],
      })),
      ...bothLegs((x, side) => ({
        id: `pantsShin${side}`,
        bone: `J_Bip_${side}_LowerLeg`,
        parts: [
          tube(
            `J_Bip_${side}_LowerLeg`,
            [x, 0.002, 0.29],
            // 정강이 본은 아래로 1m 내려갈 때 뒤로 0.064m 간다(무릎 y 0.0017 → 발목 y 0.0137). 관이 그 축을 따른다
            [x, 0.002 + (0.29 - shinEndZ) * 0.064, shinEndZ],
            [0.099, shinEndRadius],
            PANTS_CLOTH,
          ),
        ],
      })),
    ],
  };
}

/**
 * 통이 넓은 바지 — 밑단(반지름 0.112)이 발목까지 내려온다. 정강이가 부츠 통(`LONG_BOOTS`)보다 굵어서, 부츠를
 * 위에 그려도 부츠 통의 바깥으로 남는다. 하의의 굽기는 신발과 무관하게 한 번이라는 가정의 가장 나쁜 입력이다.
 */
export const BULKY_PANTS: ISlotGear = bulkyPants('bulkyPants', 0.105, 0.112);

/**
 * 같은 바지를 긴 신발용으로 무릎 아래에서 자른 변형 — 부츠 목(`BOOT_TOP_Z`)을 4mm 덮고 끝난다. 바지를 부츠 안에
 * 넣어 신은 모양의 기준 컷이기도 하다. 3D에서 부츠 안의 바지는 어차피 안 보인다.
 */
export const BULKY_PANTS_CUT: ISlotGear = bulkyPants('bulkyPantsCut', BOOT_TOP_Z - 0.004, 0.101);

/**
 * 넓은 소매 — 팔꿈치(반지름 0.04)에서 손목(0.11)으로 벌어지는 관. 몸에 붙는 상의(반팔티 · 나시)와 달리 맨살 몸의
 * 윤곽 밖으로 크게 나가므로, 맨살 몸만 가림 전용으로 두고 구운 지팡이가 소매 앞에 잘못 그려지는 픽셀이 가장
 * 많이 나오는 입력이다. 손목에서 끝나서 손 안의 지팡이와 3D로 맞닿지는 않는다.
 */
export const WIDE_SLEEVES: ISlotGear = {
  id: 'wideSleeves',
  pieces: (['L', 'R'] as const).map((side) => ({
    id: `sleeve${side}`,
    bone: `J_Bip_${side}_LowerArm`,
    parts: [
      tube(
        `J_Bip_${side}_LowerArm`,
        BASE_POSE_HEAD[`J_Bip_${side}_LowerArm`],
        WRIST[side],
        [0.04, 0.11],
        SLEEVE_CLOTH,
      ),
    ],
  })),
};

/**
 * 망토 — G2의 장비 검토 세트에서 판정을 지난 모양 그대로다(목 밑 높이 · 어깨 폭 · 등 뒤 13cm · 겉과 안감 두 장).
 * 그 사양은 `retired/gear.ts`에 있었는데 그 폴더를 G4를 닫으며 지우기로 돼 있어서 값을 여기로 옮겼다(지운 것은 2026-09-23). 흔들림은 뺐다 —
 * 걷는 동안 가슴 본을 강체로 따라간다.
 */
export const CAPE: ISlotGear = {
  id: 'cape',
  pieces: [
    {
      id: 'cape',
      bone: 'J_Bip_C_UpperChest',
      parts: [
        { flip: false, y: 0.13, color: [150, 30, 40] },
        { flip: true, y: 0.127, color: [50, 35, 80] },
      ].map(({ flip, y, color }) => ({
        type: 'cloth',
        group: 'Gear',
        width: 0.22,
        width_bottom: 0.34,
        length: 0.56,
        folds: 4,
        depth: 0.04,
        depth_top: 0.01,
        phase: 0,
        sway: 0.06,
        ripple: 1.0,
        ripple_waves: 1.5,
        ripple_phase: 0,
        columns: 40,
        rows: 20,
        flip,
        location: [0, y, 0.113],
        color,
      })),
    },
  ],
};

/**
 * 시험 방패가 손에서 앞으로 나가는 거리(m) — 그립의 y. 채택한 원형 방패(0.07)보다 멀다.
 *
 * 부피 있는 하의의 허벅지가 앞으로 22° 나올 때 앞면이 y −0.16까지 오는데, 0.07에 들면 방패 뒷면(−0.125)이 그
 * 안에 들어간다. 두 물체가 3D에서 서로 뚫으면 기준 컷 자체가 한 프레임 안에서 앞뒤가 섞인 그림이 되어, 겹치는
 * 순서로 풀 수 있는지를 잴 수 없다.
 */
const PROBE_SHIELD_REACH = 0.12;

/**
 * 세로로 긴 방패 — 폭 0.26 · 높이 0.56의 판. 위쪽 3분의 1을 쥐어서 어깨에서 부츠 목 아래(모델 z 0.17)까지
 * 내려온다. 원형 방패는 몸통 앞에만 놓이지만 이것은 상의 · 하의 · 부츠에 한꺼번에 걸친다.
 */
export const SHIELD_TALL: IWeaponSpec = {
  id: 'shield_tall',
  label: '시험 방패 — 세로로 긴',
  grip: [0, PROBE_SHIELD_REACH, 0.62],
  parts: [
    { type: 'cube', size: 1, scale: [0.26, 0.025, 0.56], location: [0, 0, 0.47], color: PLATE },
    { type: 'sphere', radius: 0.04, subdivisions: 2, location: [0, -0.02, 0.55], color: BOSS },
  ],
};

/**
 * 뿔이 난 방패 — 채택한 원형 방패의 판에 가시 다섯을 세웠다. 가운데 가시는 앞으로 12cm, 테두리의 넷은 판의
 * 면을 따라 위 · 아래 · 좌우로 10cm 나간다. 윤곽이 판보다 10cm 넓어서 턱 밑에서 허벅지까지, 몸 가운데까지 걸친다.
 */
export const SHIELD_HORNED: IWeaponSpec = {
  id: 'shield_horned',
  label: '시험 방패 — 뿔이 난',
  grip: [0, PROBE_SHIELD_REACH, 0.75],
  parts: [
    {
      type: 'cylinder',
      radius: 0.13,
      depth: 0.0225,
      vertices: 16,
      location: [0, 0, 0.75],
      rotation: [90, 0, 0],
      color: PLATE,
    },
    {
      type: 'cone',
      radius1: 0.03,
      radius2: 0,
      depth: 0.12,
      vertices: 8,
      location: [0, -0.071, 0.75],
      rotation: [90, 0, 0],
      color: METAL,
    },
    ...(
      [
        { at: [0, 0, 0.93], rotation: [0, 0, 0] },
        { at: [0, 0, 0.57], rotation: [180, 0, 0] },
        { at: [0.18, 0, 0.75], rotation: [0, 90, 0] },
        { at: [-0.18, 0, 0.75], rotation: [0, -90, 0] },
      ] as const
    ).map(({ at, rotation }) => ({
      type: 'cone' as const,
      radius1: 0.025,
      radius2: 0,
      depth: 0.1,
      vertices: 8,
      location: at,
      rotation,
      color: METAL,
    })),
  ],
};
