/**
 * G3가 확정한 동작 — 걷기 · 대기의 키프레임 정의. 모션 파일을 옮기지 않고 위상(0~1)에서 관절 각도를 식으로 낸다.
 *
 * **모션 파일을 버린 이유.** 1라운드는 성인 걷기 모션을 4등신 골격에 옮겼는데, 원본이 허벅지 회전 안에 좌우
 * 흔들림을 앞뒤 흔들림과 섞어 두었고 발뒤꿈치를 디딜 때 발끝을 들었다. 관절마다 비율로 줄여도 한 관절의 회전이
 * 통째로 줄 뿐이라 그 둘만 골라낼 수 없었고(발목 좌우 3.2cm · 발바닥 최대 16°), 정면에서 춤추는 것처럼 보였다.
 * 여기서는 다리를 **앞뒤 평면에서만** 돌리므로 좌우 성분이 식에 아예 없고, 발끝을 드는 각은 상한으로 막는다.
 *
 * **각도는 본마다 「정지 자세에서 모델 축으로 얼마나 돌았나」다.** 부모 기준 로컬 회전이 아니다. 굽는 쪽
 * (`bake_motion.py`)이 그 값을 정지 자세에 곱해 본의 방향을 직접 정한다 — `BASE_ARM_POSE`가 쓰는 방식과 같다.
 * 그래서 발 각도 0은 「정강이가 어디를 보든 발바닥은 수평」이고, 무릎을 굽혀도 발이 따라 돌지 않는다.
 *
 * **Blender는 굽기만 한다.** 각도 · 허리 높이 · 접지 계산이 전부 이 파일에 있어서 vitest가 단언한다. 파이썬은
 * 받은 값을 입히고 실제 발목 · 발바닥 좌표를 돌려줄 뿐이고, 그 좌표로 재는 것도 TS(`retired/motion.ts`)다.
 *
 * 좌표는 (앞, 위) 평면이다. 앞은 캐릭터가 바라보는 쪽(Blender −Y), 위는 Blender +Z. 각도는 도 단위이고
 * **양수가 「아래로 늘어진 것이 앞으로 가는」 방향**이다 — 허벅지 +20°면 무릎이 앞으로 나가고, 발 +4°면
 * 발끝이 들린다. Blender X축 회전과는 부호가 반대라 `toBlenderX`가 한 곳에서 뒤집는다.
 */

/** 다리 한쪽의 정지 자세 치수 — (앞, 위) 평면, m. 좌우가 대칭이라 한쪽만 든다. */
export interface ILegRig {
  /** 허벅지 본의 머리(엉덩 관절) */
  hip: readonly [number, number];
  /** 엉덩 관절 → 무릎 */
  thigh: readonly [number, number];
  /** 무릎 → 발목 */
  shin: readonly [number, number];
  /** 발목 → 발뒤꿈치 바닥 */
  heel: readonly [number, number];
  /** 발목 → 발볼 바닥(발가락 본의 머리 아래) */
  ball: readonly [number, number];
  /** 발목 → 발끝 바닥 */
  tip: readonly [number, number];
}

/**
 * 생산 캐릭터의 다리 치수(2026-09-20 실측, `player_top_a.vrm`의 정지 자세).
 *
 * 세 판(맨살 · 상의 A · 상의 B)은 코어 본이 같으므로(G1 측정) 어느 판에서 재도 같다. 발바닥 점은 발 메시의
 * 가장 낮은 정점(z 0)과 앞뒤 끝(y −0.1346 · +0.0658)에서 뽑았다. 다리가 짧아서(엉덩 관절에서 발목까지 0.35m,
 * 키 1.104m) 같은 각도로 흔들어도 보폭이 성인 비율보다 훨씬 작다.
 */
export const PLAYER_LEG_RIG: ILegRig = {
  hip: [0.0017, 0.4421],
  thigh: [-0.0034, -0.1625],
  shin: [-0.012, -0.1872],
  heel: [-0.0521, -0.0924],
  ball: [0.0982, -0.0924],
  tip: [0.1483, -0.0924],
};

/** 걷기 · 뛰기 한 벌의 모양을 정하는 값. 각도는 도, 길이는 m, 위상은 0~1. */
export interface IGaitSpec {
  id: string;
  /** 후보 화면에서 부르는 이름 */
  label: string;
  /** 허벅지가 앞뒤로 흔들리는 폭(±) */
  thighSwing: number;
  /** 허벅지 흔들림의 중심. 양수면 무릎을 앞으로 더 끌어올리고 뒤로는 덜 뻗는다 — 뛰는 자세다 */
  thighBias: number;
  /**
   * 허벅지가 가장 앞으로 나가는 때를 디딤보다 이만큼(위상) 앞당긴다. 뛸 때는 다리를 뻗었다가 당기면서 디디므로
   * 0보다 크다. 0이면 가장 뻗은 순간에 디뎌서 발이 몸보다 한참 앞에 떨어지고, 그만큼 몸이 크게 내려앉는다.
   */
  thighLead: number;
  /**
   * 그 발이 땅을 떠나는 위상. 걷기는 0.5(반대쪽 발이 디디는 순간에 뗀다), 뛰기는 그보다 작다 — 이 값과 0.5
   * 사이가 두 발이 다 뜬 구간이다.
   */
  stanceEnd: number;
  /** 디딘 직후 무릎이 눌리는 각. 몸이 내려앉는 프레임을 만든다 */
  kneeStance: number;
  /**
   * 무릎이 눌리는 구간의 폭(위상). 중심은 0.12다. 걷기는 0.24라 디디는 순간에는 무릎이 펴져 있고, 뛰기는
   * 0.4라 디디는 순간에 이미 굽어 있다 — 뛸 때 편 무릎으로 디디면 다리가 막대처럼 땅을 찍는다.
   */
  kneeStanceWidth: number;
  /** 발을 뒤에서 앞으로 가져올 때 무릎을 접는 각. 작으면 발이 바닥을 끈다 */
  kneeSwing: number;
  /**
   * 디딜 때 발끝을 드는 각. **5° 이하로 둔다** — 정면에서 발바닥이 카메라를 향해 보이는 각이 곧 이 값이고,
   * G3 통과 조건이 5°다(1라운드 H는 16°였다).
   */
  footStrike: number;
  /** 뒷발이 땅을 밀 때 뒤꿈치를 드는 각 */
  footOff: number;
  /** 두 발이 다 뜨는 구간의 높이. 0이면 걷기(늘 한 발이 땅에 있다), 양수면 뛰기다 */
  hop: number;
  /** 윗몸을 앞으로 숙이는 각. 머리는 숙이지 않는다 */
  lean: number;
  /** 가슴이 다리와 반대로 비틀리는 폭(±). 팔은 기준 자세로 고정이라 이 비틀림이 팔 흔들기를 대신한다 */
  twist: number;
}

/** 프레임으로 굽는 대기(숨쉬기) 한 벌. 한 장 + 노드 트윈과 견주는 쪽이다. */
export interface IIdleSpec {
  id: string;
  label: string;
  /** 무릎을 굽혀 몸을 내리는 각(가장 내려간 프레임, 도). 크면 숨쉬기가 아니라 앉았다 일어서기로 보인다 */
  kneeFlex: number;
  /** 가슴을 뒤로 젖히는 각 — 숨을 들이쉴 때 */
  chestPitch: number;
  /** 어깨를 올리는 각 */
  shoulderLift: number;
}

/** 본 하나의 각도 — Blender 모델 축 X · Y · Z(도). 굽는 쪽이 오일러 XYZ로 읽는다. */
export type BoneAngles = readonly [number, number, number];

/** 프레임 하나 — 파이썬이 그대로 입힌다. */
export interface IMotionFrame {
  /** 위상(0~1). 대기는 숨쉬기 주기의 위상이다 */
  phase: number;
  /** 허리 본을 정지 위치에서 옮기는 양(Blender 모델 축 x · y · z, m) */
  hips: readonly [number, number, number];
  /**
   * 본 이름과 각도. **부모가 자식보다 앞에 온다** — 굽는 쪽이 본의 위치를 그 순간의 자세에서 읽으므로,
   * 부모가 안 돌아간 채로 자식을 넣으면 자식이 옛 자리에 붙는다.
   */
  bones: readonly (readonly [string, BoneAngles])[];
}

/** 접지 계산이 돌려주는 한쪽 다리의 점들 — (앞, 위), m. */
export interface ILegPoints {
  knee: readonly [number, number];
  ankle: readonly [number, number];
  heel: readonly [number, number];
  ball: readonly [number, number];
  tip: readonly [number, number];
  /** 발바닥 세 점 가운데 가장 낮은 높이 */
  lowest: number;
}

/** 한쪽 다리의 네 각도(도, 앞이 양수). */
export interface ILegAngles {
  thigh: number;
  shin: number;
  foot: number;
  toe: number;
}

const DEG = Math.PI / 180;

/** 뜬 발이 정강이의 기울기를 따라가는 비율. 1이면 발목이 굳은 것이고 0이면 발바닥이 늘 수평이다. */
const SWING_FOOT_FOLLOW = 0.5;

/** 접지 계산에서 뜬 발을 이만큼(m) 높은 것으로 친다. 다리를 가장 크게 벌린 자세의 발 높이 차보다 커야 한다. */
const SWING_IGNORE = 0.08;

/** 위상을 0 이상 1 미만으로 접는다. */
export function wrapPhase(phase: number): number {
  return ((phase % 1) + 1) % 1;
}

/**
 * 위상 `center`에서 1, 양옆 `width / 2`에서 0이 되는 매끈한 혹. 주기를 넘어 이어진다.
 *
 * 혹으로 짜는 이유는 끝이 0이고 기울기도 0이라서다. 구간 끝에서 값이 튀면 그 프레임만 관절이 꺾여 보인다.
 */
export function bump(phase: number, center: number, width: number): number {
  let d = Math.abs(wrapPhase(phase) - wrapPhase(center));
  if (d > 0.5) d = 1 - d;
  if (d >= width / 2) return 0;
  return 0.5 * (1 + Math.cos((2 * Math.PI * d) / width));
}

/** `edge0`에서 0, `edge1`에서 1로 매끈하게 오른다. 주기를 넘지 않는다 — 인자는 이미 접힌 위상이다. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 발이 땅을 딛고 있는 정도(1 = 디딤, 0 = 공중). 위상 0에서 디디고 `stanceEnd` 부근에서 뗀다.
 *
 * 발 각도를 디딤과 공중에서 다른 규칙으로 정하려고 둔다. 디딘 발은 땅에 맞추고(수평 또는 뒤꿈치 들기),
 * 뜬 발은 정강이를 따라간다. 뜬 발까지 수평으로 두면 무릎을 접어 정강이가 눕는 순간 발목이 90° 가까이 꺾인다.
 */
function stanceWeight(spec: IGaitSpec, phase: number): number {
  const p = wrapPhase(phase);
  const end = spec.stanceEnd;
  return 1 - smoothstep(end - 0.05, end + 0.05, p) + smoothstep(0.9, 1.0, p);
}

/**
 * 위상 하나에서 한쪽 다리의 각도. 위상 0이 그 발을 디디는 순간이고 `stanceEnd`가 떼는 순간이다.
 *
 * @param spec 걷기 · 뛰기 한 벌
 * @param phase 그 다리의 위상(반대쪽 다리는 0.5를 더해 부른다)
 */
export function legAngles(spec: IGaitSpec, phase: number): ILegAngles {
  const p = wrapPhase(phase);
  const end = spec.stanceEnd;
  const thigh = spec.thighBias + spec.thighSwing * Math.cos(2 * Math.PI * (p + spec.thighLead));
  // 무릎 접기는 발을 떼기 전(`stanceEnd` − 0.12)부터 시작한다. 걷기에서 반대쪽 발이 디디는 순간 뒷다리는
  // 뒤꿈치를 들어 길어져 있는데, 그때 무릎이 펴져 있으면 뒷다리가 몸을 밀어 올려 앞발 뒤꿈치가 땅에 닿지 못한다.
  // 걷기는 펴는 쪽을 디디기 직전(0.84~1.0)에 몰아 둔다. 일찍 펴면 앞으로 나오는 발이 디딘 다리만큼 길어져
  // 땅을 긁는다. 뛰기는 두 발이 뜬 구간만큼 일찍 펴기 시작한다 — 몸이 떠 있어 발이 땅에 닿을 일이 없고,
  // 100° 넘게 접은 무릎을 0.16 주기 안에 다 펴면 한 프레임 사이에 정강이가 20° 넘게 튄다.
  const unfold = 0.84 - 1.2 * (0.5 - end);
  // 뛰기는 접기도 발을 뗀 뒤에 시작한다. 뛸 때는 다리를 편 채로 땅을 밀고 나서 접는데, 떼기 전부터 접으면
  // 아직 디딘 것으로 치는 발이 짧아져 그 발을 땅에 대려고 허리가 꺼진다.
  const fold = end - 0.12 + 0.6 * (0.5 - end);
  const swing = smoothstep(fold, fold + 0.32, p) * (1 - smoothstep(unfold, 1.0, p));
  const knee = spec.kneeStance * bump(p, 0.12, spec.kneeStanceWidth) + spec.kneeSwing * swing;
  const shin = thigh - knee;

  const planted =
    spec.footStrike * bump(p, 0, 0.2) -
    spec.footOff * smoothstep(end - 0.17, end, p) * (1 - smoothstep(end, end + 0.1, p));
  const w = stanceWeight(spec, p);
  // 뜬 발은 정강이가 기운 각의 절반만 따라간다. 전부 따라가면 정강이가 뒤로 40° 누웠을 때 발끝이 그만큼
  // 아래를 향해 땅을 뚫는다 — 실제 걸음에서도 발을 앞으로 가져오는 동안 발목을 당겨 발끝을 든다.
  // 발끝이 들리는 쪽은 `footStrike`에서 막는다. 디디기 직전에는 정강이가 앞으로 20° 넘게 나가 있어서,
  // 막지 않으면 그 각이 발끝을 들어 정면에서 발바닥이 보인다.
  // 디디기 전(0.68~0.88)에는 따라가기를 풀고 디딜 각으로 미리 옮겨 간다. 끝까지 따라가면 앞으로 뻗은
  // 다리에서 발끝이 아래를 향한 채라 발끝이 뒤꿈치보다 먼저 땅에 닿는다.
  const landing = smoothstep(0.68, 0.88, p);
  const swinging = SWING_FOOT_FOLLOW * shin * (1 - landing) + spec.footStrike * landing;
  const foot = Math.min(spec.footStrike, w * planted + (1 - w) * swinging);
  // 디딘 발이 뒤꿈치를 들 때 발가락은 땅에 남는다. 뜬 발에서는 발가락이 발을 따라간다.
  const toe = foot + w * Math.max(0, -foot);
  return { thigh, shin, foot, toe };
}

/** (앞, 위) 벡터를 `degrees`만큼 돌린다. 양수면 아래로 늘어진 벡터가 앞으로 간다. */
function rotate(v: readonly [number, number], degrees: number): [number, number] {
  const c = Math.cos(degrees * DEG);
  const s = Math.sin(degrees * DEG);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

/**
 * 각도에서 다리의 점들을 낸다(순기구학). 허리 높이를 정하는 접지 계산과, 굽기 전 보폭 계산에 쓴다.
 *
 * @param rig 정지 자세 치수
 * @param angles `legAngles`가 낸 각도
 * @param hipsUp 허리를 정지 높이에서 올린 양(m)
 */
export function legPoints(rig: ILegRig, angles: ILegAngles, hipsUp = 0): ILegPoints {
  const add = (a: readonly [number, number], b: readonly [number, number]): [number, number] => [
    a[0] + b[0],
    a[1] + b[1],
  ];
  const hip: [number, number] = [rig.hip[0], rig.hip[1] + hipsUp];
  const knee = add(hip, rotate(rig.thigh, angles.thigh));
  const ankle = add(knee, rotate(rig.shin, angles.shin));
  const heel = add(ankle, rotate(rig.heel, angles.foot));
  const ball = add(ankle, rotate(rig.ball, angles.foot));
  const toeVector: [number, number] = [rig.tip[0] - rig.ball[0], rig.tip[1] - rig.ball[1]];
  const tip = add(ball, rotate(toeVector, angles.toe));
  return { knee, ankle, heel, ball, tip, lowest: Math.min(heel[1], ball[1], tip[1]) };
}

/**
 * 디딘 발을 땅(높이 0)에 놓으려면 허리를 얼마나 올려야(음수면 내려야) 하나.
 *
 * 뜬 발은 계산에서 뺀다. 그냥 두 발의 최솟값을 쓰면, 앞으로 가져오는 발의 발끝이 디딘 발보다 낮아지는 순간
 * 몸 전체가 그 발끝에 맞춰 올라가 디딘 발이 허공에 뜬다. 끊어서 빼지 않고 `SWING_IGNORE`만큼 높은 것으로 쳐서
 * 빼는 이유는 디딤 정도가 매끈하게 바뀌기 때문이다 — 끊으면 발을 바꾸는 프레임에서 허리가 튄다.
 */
function plantedLift(spec: IGaitSpec, rig: ILegRig, phase: number): number {
  const legs = [phase, phase + 0.5].map((p) => ({
    lowest: legPoints(rig, legAngles(spec, p)).lowest,
    ignore: (1 - stanceWeight(spec, p)) * SWING_IGNORE,
  }));
  return -Math.min(...legs.map((leg) => leg.lowest + leg.ignore));
}

/**
 * 그 위상에서 허리를 얼마나 올려야(음수면 내려야) 하나.
 *
 * **디딘 발의 가장 낮은 점을 땅에 놓는다.** 다리를 벌리면 발이 땅에서 뜨므로 허리가 그만큼 내려가야 하고,
 * 이것이 걷기의 오르내림을 식에서 따로 짜지 않아도 만들어 준다. 허리를 안 내리면 발이 허공을 딛는다.
 *
 * **두 발이 다 뜬 구간에서는 접지를 쓰지 않는다.** 그 구간에서 접지를 그대로 쓰면 디딘 발이 없는데도 낮은
 * 쪽 발끝을 땅에 대려고 몸을 끌어내려, 뛰어오르는 한가운데서 허리가 푹 꺼진다. 그래서 발을 떼기 직전의
 * 높이와 반대쪽 발을 디딘 순간의 높이를 곧게 잇고, 그 위에 `hop`의 혹을 얹는다.
 */
export function hipsLift(spec: IGaitSpec, rig: ILegRig, phase: number): number {
  const p = wrapPhase(phase);
  // 두 다리가 반 주기 차이로 같은 동작을 하므로 앞 절반과 뒤 절반의 허리 높이는 같다
  const half = p < 0.5 ? p : p - 0.5;
  const leave = spec.stanceEnd - 0.05;
  if (half <= leave) return plantedLift(spec, rig, p);
  // 발을 떼기 시작한 뒤로는 접지를 섞지 않는다. 섞으면 떼는 발이 접히거나 디딜 발이 아직 내려오는 동안에도
  // 그 발을 땅에 대려고 허리를 끌어내려, 뛰어오르는 곡선 한가운데가 꺼졌다 올라온다. 떼는 순간의 높이에서
  // 디디는 순간의 높이까지를 포물선 하나로 잇는다 — 꼭대기가 직선보다 `hop`만큼 높다. 걷기는 `hop`이 0이고
  // 이 구간이 0.05 주기뿐이라 직선으로 이어도 디딘 발이 1mm 안쪽으로만 어긋난다.
  const u = (half - leave) / (0.5 - leave);
  const glide = plantedLift(spec, rig, leave) * (1 - u) + plantedLift(spec, rig, 0.5) * u;
  return glide + 4 * spec.hop * u * (1 - u);
}

/** 앞이 양수인 각을 Blender X축 회전으로 바꾼다. Blender에서는 X 음수가 앞쪽이다(`BASE_ARM_POSE` 주석). */
function toBlenderX(degrees: number): number {
  return -degrees;
}

const round = (value: number, digits: number): number => {
  const k = 10 ** digits;
  return Math.round(value * k) / k + 0; // `+ 0`은 −0을 0으로 접는다. JSON에 −0이 섞이면 해시가 갈린다
};

/** 한쪽 다리의 본 넷을 부모부터 늘어놓는다. */
function legBones(side: 'L' | 'R', angles: ILegAngles): [string, BoneAngles][] {
  const at = (degrees: number): BoneAngles => [round(toBlenderX(degrees), 3), 0, 0];
  return [
    [`J_Bip_${side}_UpperLeg`, at(angles.thigh)],
    [`J_Bip_${side}_LowerLeg`, at(angles.shin)],
    [`J_Bip_${side}_Foot`, at(angles.foot)],
    [`J_Bip_${side}_ToeBase`, at(angles.toe)],
  ];
}

/**
 * 걷기 · 뛰기의 한 프레임. 왼다리가 위상 `phase`, 오른다리가 반 주기 뒤를 간다.
 *
 * 윗몸은 셋만 움직인다. 허리뼈 위(`Spine`)를 `lean`만큼 숙이고, 윗가슴을 다리와 반대로 비틀고, 머리는 각도
 * 0으로 되돌린다. 머리를 되돌리는 것은 얼굴이 방향 스프라이트의 정체이기 때문이다 — 몸을 따라 고개가 돌면
 * 정면 프레임에서 얼굴이 좌우로 흔들려 작은 크기에서 떨림으로 보인다.
 */
export function gaitFrame(spec: IGaitSpec, rig: ILegRig, phase: number): IMotionFrame {
  const p = wrapPhase(phase);
  // 왼다리가 앞일 때(위상 0) 오른 어깨가 앞으로 나온다. Z 양수 회전이 오른 어깨(−X)를 앞(−Y)으로 보낸다.
  const twist = spec.twist * Math.cos(2 * Math.PI * p);
  // 앞으로 숙이기는 「아래로 늘어진 것이 앞으로」의 반대 방향이라 Blender X로는 양수다.
  const lean = spec.lean;
  return {
    phase: round(p, 6),
    hips: [0, 0, round(hipsLift(spec, rig, p), 5)],
    bones: [
      ['J_Bip_C_Spine', [round(lean, 3), 0, 0]],
      ['J_Bip_C_UpperChest', [round(lean, 3), 0, round(twist, 3)]],
      ['J_Bip_C_Head', [0, 0, 0]],
      ...legBones('L', legAngles(spec, p)),
      ...legBones('R', legAngles(spec, p + 0.5)),
    ],
  };
}

/** 서 있는 한 장 — 다리는 정지 자세 그대로다. 「한 장 + 숨쉬기」 대기와 대기 프레임의 기준이 이것이다. */
export function standFrame(): IMotionFrame {
  return { phase: 0, hips: [0, 0, 0], bones: [] };
}

/**
 * 프레임으로 굽는 대기의 한 장. 위상 0이 숨을 다 내쉰 자세(= 서 있는 한 장)이고 0.5가 다 들이쉰 자세다.
 *
 * 무릎을 굽히는 것은 가슴과 어깨만 움직이면 하체가 굳어 보이기 때문이다. 다만 굽힘으로 몸 전체를 오르내리게
 * 하지는 않는다 — 게임 크기에서 몸이 1px쯤 오르내리게 굽히면(30°) 크게 볼 때 앉았다 일어서기로 보인다
 * (2026-09-21 사용자 판정). 채택한 굽힘에서 몸은 720p에서 반 픽셀도 안 내려앉는다(`IDLE_BAKED`).
 */
export function idleFrame(spec: IIdleSpec, rig: ILegRig, phase: number): IMotionFrame {
  const p = wrapPhase(phase);
  const breath = 0.5 * (1 - Math.cos(2 * Math.PI * p));
  // 숨을 내쉴 때 몸이 내려앉는다 — 들이쉰 자세(0.5)가 가장 높다.
  const sink = 1 - breath;
  const flex = spec.kneeFlex * sink;
  const angles: ILegAngles = { thigh: flex / 2, shin: -flex / 2, foot: 0, toe: 0 };
  const lift = -legPoints(rig, angles).lowest;
  const at = (degrees: number): BoneAngles => [round(toBlenderX(degrees), 3), 0, 0];
  const shoulder = spec.shoulderLift * breath;
  return {
    phase: round(p, 6),
    hips: [0, 0, round(lift, 5)],
    bones: [
      // 가슴을 뒤로 젖히는 것은 「아래로 늘어진 것이 앞으로」와 같은 방향이라 앞-양수 각 그대로다.
      ['J_Bip_C_UpperChest', at(spec.chestPitch * breath)],
      // Y축은 왼쪽(+X) 어깨가 음수에서, 오른쪽이 양수에서 올라간다(`BASE_ARM_POSE` 주석의 반대 방향).
      ['J_Bip_L_Shoulder', [0, round(-shoulder, 3), 0]],
      ['J_Bip_R_Shoulder', [0, round(shoulder, 3), 0]],
      ['J_Bip_C_Head', [0, 0, 0]],
      ['J_Bip_L_UpperLeg', at(angles.thigh)],
      ['J_Bip_L_LowerLeg', at(angles.shin)],
      ['J_Bip_L_Foot', at(0)],
      ['J_Bip_R_UpperLeg', at(angles.thigh)],
      ['J_Bip_R_LowerLeg', at(angles.shin)],
      ['J_Bip_R_Foot', at(0)],
    ],
  };
}

/**
 * 프레임으로 굽는 대기를 굽는 위상과 재생 순서.
 *
 * 숨쉬기는 들이쉬는 절반과 내쉬는 절반이 같은 자세를 거꾸로 지나가므로, 네 박자(0 · 0.25 · 0.5 · 0.75) 가운데
 * 0.25와 0.75가 같은 그림이다. 그래서 세 장만 굽고 0 → 1 → 2 → 1로 되짚어 재생한다. 네 장을 다 구우면 층마다
 * 방향 넷에 한 장씩, 이미 있는 것과 똑같은 그림을 아틀라스에 더 싣게 된다.
 */
export const IDLE_PLAYBACK = { phases: [0, 0.25, 0.5], order: [0, 1, 2, 1] } as const;

/** 프레임 `count`장의 위상 — 0부터 같은 간격. 0이 왼발 디딤, 0.5가 오른발 디딤이다. */
export function samplePhases(count: number): number[] {
  if (!Number.isInteger(count) || count < 2)
    throw new Error(`프레임 수는 2 이상의 정수다: ${count}`);
  return Array.from({ length: count }, (_, i) => i / count);
}

/**
 * 여러 프레임 수를 한 번에 굽기 위한 위상 목록과, 프레임 수마다 그 목록의 몇 번째를 쓰는지.
 *
 * 8장 판과 6장 판을 따로 구우면 위상 0과 0.5를 두 번 굽는다. 합쳐서 한 번만 굽고 재생할 때 골라 쓴다.
 */
export function mergedPhases(counts: readonly number[]): {
  phases: number[];
  picks: Record<number, number[]>;
} {
  const key = (phase: number): string => phase.toFixed(6);
  const all = new Map<string, number>();
  for (const count of counts) for (const phase of samplePhases(count)) all.set(key(phase), phase);
  const phases = [...all.values()].sort((a, b) => a - b);
  const index = new Map(phases.map((phase, i) => [key(phase), i]));
  const picks: Record<number, number[]> = {};
  for (const count of counts) {
    picks[count] = samplePhases(count).map((phase) => index.get(key(phase)) as number);
  }
  return { phases, picks };
}

/** 한 걸음의 길이(m) — 디딘 순간 두 발목 사이의 앞뒤 거리. 굽기 전에 미끄러짐을 어림하는 입력이다. */
export function stepLength(spec: IGaitSpec, rig: ILegRig): number {
  const front = legPoints(rig, legAngles(spec, 0)).ankle[0];
  const rear = legPoints(rig, legAngles(spec, 0.5)).ankle[0];
  return front - rear;
}

/**
 * 한 주기 동안 게임이 옮기는 거리가 두 걸음 길이의 몇 배인가. 1이면 발이 안 미끄러지고, 클수록 미끄러진다.
 *
 * 뛰기는 두 발이 다 뜬 동안에도 몸이 나아가므로 1보다 큰 것이 정상이다. 걷기가 3을 넘으면 발을 디딘 채
 * 몸만 밀려 가는 것처럼 보이기 쉽다.
 *
 * @param speed 게임의 이동 속도(월드 단위/초, `player.json`의 `speed`)
 * @param cycleSeconds 한 주기(두 걸음)의 길이 — 프레임 수 ÷ 재생 속도
 * @param unitsPerMeter 월드 단위/m — 캐릭터 표시 높이 ÷ 모델 키
 */
export function slideRatio(
  spec: IGaitSpec,
  rig: ILegRig,
  speed: number,
  cycleSeconds: number,
  unitsPerMeter: number,
): number {
  return (speed * cycleSeconds) / (2 * stepLength(spec, rig) * unitsPerMeter);
}

/**
 * 채택한 걷기 — 후보 A 「차분한 걷기」(2026-09-20 사용자 판정).
 *
 * 걷기 둘 · 뛰기 둘을 정면 · 옆 · 뒤에서 나란히 재생해 보고 골랐다. 게임의 이동 속도(초당 300단위)는 표시 높이
 * 77의 3.9배라 이 보폭(한 걸음 21.3단위)으로는 8장 · 10fps 한 주기에 보폭의 5.6배를 미끄러진다. 그래서 뛰는
 * 모양을 함께 냈는데, 바닥을 그 속도로 흘려 놓고 본 사용자가 걷는 쪽을 골랐다. 떨어진 후보 셋의 값은
 * `retired/motion.ts`에 있다.
 *
 * **G4는 이 값으로 굽고, 굽기마다 이 정의의 해시를 카메라 기록과 견준다.** 값을 고치면 모든 층을 다시 구워야 한다.
 */
export const CHOSEN_GAIT: IGaitSpec = {
  id: 'walk_calm',
  label: 'A 차분한 걷기',
  thighSwing: 22,
  thighBias: 0,
  thighLead: 0,
  stanceEnd: 0.5,
  kneeStance: 8,
  kneeStanceWidth: 0.24,
  kneeSwing: 50,
  footStrike: 4,
  footOff: 18,
  hop: 0,
  lean: 2,
  twist: 2,
};

/**
 * 채택한 대기 — 프레임으로 굽는다(2026-09-20 사용자 판정).
 *
 * 서 있는 한 장, 한 장에 코드로 세로 배율을 흔드는 숨쉬기, 프레임 셋을 나란히 봤고 프레임이 훨씬 자연스럽다는
 * 판정을 받았다. 굽는 장은 셋이고 네 박자로 재생한다(`IDLE_PLAYBACK`). 아틀라스 용량이 한도에 걸리면 첫 장만
 * 남겨 정지로 되돌릴 수 있다 — 걷기 프레임과 게임 코드는 그대로다.
 *
 * **무릎 굽힘은 10°다(2026-09-21 사용자 판정).** G3에서 고를 때는 30°였는데, 생산 캐릭터를 층으로 구워 겹친
 * 화면에서 굽힘이 너무 크다는 판정을 받았다. 30 · 20 · 14 · 10 · 6°를 정면과 오른쪽에서 나란히 재생해 골랐다.
 * 굽힘을 줄인 만큼 몸이 내려앉는 폭도 준다 — 30°의 0.99px(720p)에서 0.15px(720p) · 0.29px(1440p)로. 사용자가
 * 게임 크기 보기에서 그 폭을 함께 보고 받았다.
 */
export const IDLE_BAKED: IIdleSpec = {
  id: 'idle_baked',
  label: '대기 — 프레임',
  kneeFlex: 10,
  chestPitch: 1.5,
  shoulderLift: 2.5,
};

/**
 * 굽기와 재생의 확정값(2026-09-20 사용자 판정).
 *
 * - `walkFrames` — 걷기 한 방향의 장 수. 6장과 8장을 같은 주기에서 골라 견줬다.
 * - `walkFps` — 걷기 재생 속도. 굽기에 박히지 않는 값이라 G5의 동기화 컴포넌트가 속성으로 받고, 인게임에서
 *   다시 맞출 수 있다. 8장이면 한 주기가 0.8초다.
 * - `idleFps` — 대기 재생 속도. 후보 화면의 기본값이고 사용자가 따로 고르지 않았다. 역시 G5에서 맞춘다.
 * - `sideYaw` — 좌우 방향에서 모델을 돌리는 각(도). 90°가 완전 측면이고 75°는 거기서 정면으로 15° 튼 각이다.
 *   오른쪽은 이 값, 왼쪽은 360에서 뺀 값으로 **따로** 굽는다 — 지팡이와 방패를 서로 다른 손에 들어서 좌우를
 *   반전하면 손이 바뀐다. 규격 정본이 적은 3/4 각도(45~60°)는 걷는 모습에서 게걸음으로 보여 떨어졌다: 게임은
 *   캐릭터를 화면에서 가로로 옮기는데 몸이 틀어져 있으면 다리가 카메라 쪽 대각선으로 디딘다. 완전 측면은 걷는
 *   방향과는 맞지만 카메라 반대쪽 손의 물건이 몸에 거의 가려서, 15°만 틀었다.
 */
export const CHOSEN_MOTION = { walkFrames: 8, walkFps: 10, idleFps: 3, sideYaw: 75 } as const;
