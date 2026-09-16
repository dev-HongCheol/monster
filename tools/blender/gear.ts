/**
 * 장비 검토 세트를 굽고 사람이 볼 시트와 흔들림 재생 페이지를 만드는 실행기.
 *
 * 플레이어는 몸 · 상의 · 무기를 층으로 굽는데, 나중에 붙을 망토 · 날개 · 화려한 장비 · 오라가 같은
 * 방식에서 깨지는지는 아직 아무도 보지 않았다(G2 검토 세트, 2026-09-16 사용자 요청). 이 파일의 표가
 * 그 예외 경우들이다. 모양은 실제 아트가 아니라 기본 도형이고, 보는 것은 예쁜지가 아니라 **이 굽기
 * 방식에서 깨지는지**다.
 *
 * 경우마다 세 가지를 만든다.
 *
 * - **시트** — 무기와 함께 한 번에 구운 컷을 방향별로, 원본 크기와 720p 크기로 나란히 둔다.
 *   망토 · 날개는 경계를 딱딱하게 한 판도 옆에 둔다.
 * - **층 합성 수치** — 몸 층 위에 장비 층(몸으로 가림)을 겹친 그림이 한 번에 구운 컷과 몇 픽셀
 *   다른지, 장비 층이 캔버스를 넘는지. 판정 기준은 두지 않는다. 사람이 시트를 볼 때 옆에 두는 숫자다.
 * - **흔들림 재생** — 망토 · 날개를 조금씩 바꾼 여러 장을 한 페이지에서 나란히 재생한다. 실제 걷기
 *   동작(G3) 없이 모양만 바꾼 흉내라, 프레임 사이에 그늘 조각이 튀는지를 대략 본다.
 *
 * 몸의 음영은 VRoid가 내보낸 원본 그대로 둔다(2026-09-16 사용자 판정). 장비만 `toon.py`의 `like`로
 * 상의와 같은 음영 규칙을 받는다. 판정은 사람이 하고, 산출물은 추적하지 않는 `docs/temp/`에 둔다.
 *
 * 돌리는 법: `node --experimental-strip-types tools/blender/gear.ts [--only 경우id,경우id] [--vrm 경로] [--sheet-only]`
 * Blender 실행 파일은 환경 변수 `BLENDER`로 준다. 한 경우에 Blender를 스무 번 가까이 부른다.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_FRAME_SPEC } from '../../tests/helpers/FrameSet.ts';
import { parseGateLine } from '../../tests/helpers/GateLine.ts';
import type { IRgbaImage } from '../../tests/helpers/SpriteMetrics.ts';
import { decodePng, encodePng } from '../art/PngCodec.ts';
import {
  composeGrid,
  compositeOver,
  layerOver,
  pixelDiff,
  type Rgb,
  sampleLikeEngine,
} from './ComparisonSheet.ts';
import { writeChosenSpecs } from './weapons.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 산출물 자리. 추적되지 않는 스크래치다. */
const OUT_DIR = 'docs/temp/3d-gate/gear';

/** 상의 A를 입은 판. `--vrm`으로 바꿀 수 있다 — 생산 `.vrm`은 커밋하지 않아 장비마다 경로가 다르다. */
const DEFAULT_VRM = 'art-source/player/2026-09-16-player-3d/player_top_a.vrm';

/**
 * 층 캔버스(px). 날개가 기준 몸 캔버스 246px을 가로로 넘으므로 넓힌다(ADR 009).
 *
 * 가로는 기준 246과 홀짝이 같아야 한다. 어긋나면 층 중심이 반 픽셀 밀려 `probe_layers.py`가 거부한다.
 */
const LAYER = { width: 600, height: PLAYER_FRAME_SPEC.height };

/** 720p에서 층 캔버스가 차지하는 크기. 기준 캔버스 246px이 48단위로 보이는 배율을 그대로 쓴다. */
const GAME_720P = {
  width: Math.round((LAYER.width * 48) / PLAYER_FRAME_SPEC.width),
  height: Math.round((LAYER.height * 96) / PLAYER_FRAME_SPEC.height),
};

/** 방향. 카메라는 그대로 두고 모델을 돌린다(`probe_layers.py`의 `--yaw`). */
const VIEWS = [
  { id: 'front', yaw: 0 },
  { id: 'back', yaw: 180 },
  { id: 'three_quarter', yaw: 45 },
  // 왼쪽 측면 — 270° 돌리면 캐릭터의 왼쪽(+X)이 카메라(-Y)를 본다. 왼팔은 앞에서 방패에, 뒤에서
  // 머리카락에 가려 이 방향에서만 보인다(사용자 2026-09-17). 기본 세 방향에는 안 들고 경우가 고른다
  { id: 'left', yaw: 270 },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];

/** 경우가 `views`를 안 주면 굽는 방향. 시트 줄 순서이기도 하다. */
const DEFAULT_VIEWS: readonly ViewId[] = ['front', 'back', 'three_quarter'];

/** 채널 차가 이 값을 넘어야 바뀐 픽셀로 센다. `layers.ts`와 같은 값이다. */
const DIFF_THRESHOLD = 12;

/** 이 알파를 넘는 픽셀이 캔버스 가장자리에 있으면 장비가 캔버스를 넘은 것으로 본다. */
const ALPHA_ON = 8;

/** 시트 배경 — 게임 월드 카메라와 같은 검정. */
const BACKGROUND: Rgb = [0, 0, 0];

/** Blender 한 번을 기다리는 상한(밀리초). */
const BLENDER_TIMEOUT_MS = 10 * 60 * 1000;

/** 흔들림 재생 프레임 수. 걷기 한 주기를 8장으로 잡은 1라운드와 같다. */
const FLUTTER_FRAMES = 8;

/** 부품 하나. 모양 인자는 `weapons.py`의 `build_part`가 해석한다. */
type IGearPart = { type: string } & Record<string, unknown>;

/** 장비 사양 — `probe_layers.py`의 `--gear-spec`이 읽는다. */
interface IGearSpec {
  id: string;
  /** 붙일 본. 부품 좌표의 원점이 이 본의 머리에 온다 */
  bone: string;
  parts: IGearPart[];
}

/** 검토할 경우 하나. */
interface IGearCase {
  id: string;
  /** 사람이 읽는 이름 */
  label: string;
  /** 이 경우에서 사람이 볼 것 — 시트를 건넬 때 체크리스트로 찍는다 */
  checks: string[];
  /** 흔들림 없는 기본 모양 */
  spec: IGearSpec;
  /** 경계를 딱딱하게 한 판도 굽는가 — 주름 · 곡면이 큰 천과 막에서만 본다 */
  hardEdge: boolean;
  /**
   * 이 경우의 장비에만 덮는 툰 값(`GEAR` 아래 키). 기준 컷의 조명은 앞 위에서 오므로 옷과 같은
   * 문턱으로는 세로 주름이 그늘지지 않는다 — `ops-blender-toon.md` §3.2로 계산하면 주름 면이
   * 73° 넘게 기울어야 한다. 그래서 천은 여기서 문턱을 따로 준다
   */
  toon?: Record<string, unknown>;
  /** 흔들림 재생. `t`는 0~1(한 주기 안의 위치)이고 그 순간의 사양을 돌려준다 */
  flutter?: { view: ViewId; at: (t: number) => IGearSpec };
  /** 굽는 방향. 없으면 `DEFAULT_VIEWS` */
  views?: readonly ViewId[];
}

/**
 * 등 뒤 장비가 붙는 본. 이 본의 머리는 어깨가 아니라 가슴 높이라(2026-09-16 실측 z 0.631, 키 1.104m)
 * 부품 좌표로 올려 쓴다. 기준 자세의 실측(2026-09-16)은 목 밑 z 0.744, 어깨 관절 z 0.714 · x ±0.067,
 * 어깨 바깥 x ±0.10, 머리카락을 뺀 맨몸의 등 표면 y 0.06~0.08(발목까지 최대 0.082)이다. 상의 A를
 * 입히면 엉덩이 높이(z 0.40~0.45)의 옷단이 y 0.094까지 나온다.
 *
 * 망토 윗단은 목 밑(+11.3cm)에 건다. 17cm로 올렸던 판은 윗단이 뒤통수에서 시작해 어깨에 두른 모양이
 * 아니었다(사용자 판정 2026-09-16 — 25px 아래로). 어깨갑옷의 16cm는 아직 판정 전이다.
 */
const CHEST_BONE = 'J_Bip_C_UpperChest';

/**
 * `CHEST_BONE` 머리의 기준 자세 위치(m, 2026-09-16 실측). 부품 좌표의 원점이라, 세계 좌표로 잰 자리를
 * 부품 좌표로 옮길 때 이것을 뺀다.
 */
const UPPER_CHEST_HEAD = { y: 0.0026, z: 0.631 };

/**
 * 날개 뿌리 면의 중심이 오는 자리 — 날개뼈(세계 좌표, m). 기준 자세에 상의 A를 입힌 등 표면을 날개뼈
 * 열(|x| 0.03~0.06)에서 재니(2026-09-16) 등은 z 0.48~0.76에 있고(위는 목, 아래는 허리) 표면 y는
 * 0.069~0.081이다. 뿌리 면은 그 안에 들어가도록 높이 `WING_ROOT_HEIGHT`로 z 0.54~0.76에 두고, y는
 * 표면보다 안쪽(0.068)에 둬 몸에 붙인다 — 밖에 두면 3/4 방향에서 등과 뿌리 사이가 벌어져 보인다.
 * 안으로 들어간 부분은 몸이 가린다.
 */
const SHOULDER_BLADE = { x: 0.045, y: 0.068, z: 0.65 };

/** 날개 뿌리 면의 높이(m). 날개뼈 열의 등 길이(z 0.48~0.76) 안에 들어가는 값이다. */
const WING_ROOT_HEIGHT = 0.22;

/** 노란빛이 도는 금색(사용자 지정 2026-09-17). */
const GOLD: Rgb = [220, 185, 60];

/** 세계 좌표(m)를 `CHEST_BONE` 부품 좌표로. */
function atChest(x: number, y: number, z: number): [number, number, number] {
  return [x, y - UPPER_CHEST_HEAD.y, z - UPPER_CHEST_HEAD.z];
}

/** 세계 z(m)를 `CHEST_BONE` 부품 z로. `strap`의 (x, z) 경로처럼 y가 없는 곳에 쓴다. */
function chestZ(z: number): number {
  return z - UPPER_CHEST_HEAD.z;
}

/** 허리 장비가 붙는 본. */
const HIPS_BONE = 'J_Bip_C_Hips';

/** `HIPS_BONE` 머리의 기준 자세 위치(m, 2026-09-17 실측). 허리 부품 좌표의 원점이다. */
const HIPS_HEAD = { y: -0.0046, z: 0.4748 };

/**
 * 벨트 높이(z 0.445~0.485) 허리 앞면의 세계 좌표 y를 |x| 열마다 잰 표(상의 A, 2026-09-17). 그 높이의
 * 반폭은 0.114이다. 술이 늘어지는 z 0.30~0.45의 앞면은 이보다 뒤(가운데 −0.1015)라, 벨트 면에 붙인
 * 술이 허벅지에 파묻히지 않는다.
 *
 * 첫 판은 표 없이 엉덩이 본 앞 12.5cm에 벨트를 뒀는데 앞면이 10.3cm라 3/4 방향에서 벨트가 허리 앞에
 * 떠 보였고, 사슬을 ±10cm로 펼쳐 반폭에 육박한 바깥 고리가 뒷모습 허리 옆으로 삐져나왔다(사용자
 * 판정 2026-09-17). 굵기 판정과 무관해 좌표만 고치고 다시 굽지 않았다.
 */
const WAIST_FRONT: readonly (readonly [number, number])[] = [
  [0, -0.1034],
  [0.03, -0.0997],
  [0.045, -0.0916],
  [0.06, -0.089],
  [0.075, -0.0867],
];

/** `WAIST_FRONT`를 |x|로 선형 보간한 허리 앞면 y(세계 좌표). 표 밖은 끝 값이다. */
function waistFront(x: number): number {
  const ax = Math.abs(x);
  for (let i = 1; i < WAIST_FRONT.length; i++) {
    const [x0, y0] = WAIST_FRONT[i - 1];
    const [x1, y1] = WAIST_FRONT[i];
    if (ax <= x1) return y0 + ((y1 - y0) * (ax - x0)) / (x1 - x0);
  }
  return WAIST_FRONT[WAIST_FRONT.length - 1][1];
}

/**
 * 망토. 위 가장자리를 목 밑 높이(z 0.744) 등 뒤 13cm에 걸고 정강이 중간(z 0.18)까지 늘어뜨린다.
 * 폭은 위가 어깨 폭(실측 0.21)에 맞춘 0.22, 아래가 0.34다 — 첫 판의 0.34 · 0.52는 소매 폭이라
 * 사용자가 2/3로 줄이라고 판정했다(2026-09-16).
 *
 * 등 뒤 13cm는 상의 옷단(엉덩이 높이 y 0.094)에서 나온 값이다. 10cm로 걸었던 판은 끝자락이 덜
 * 젖혀진 프레임에서 안감 판의 주름 골(13cm 아래 3mm, 주름 깊이 2.8cm, 젖힘 0.4cm)이 옷단 안으로
 * 들어가 뒷모습 허리에 흰 상의가 비쳤다(사용자 판정 2026-09-16). 가장 덜 젖힌 프레임에서도 골이
 * 옷단 밖에 1cm 남게 13cm로 뺐다.
 *
 * **바깥 판과 안감 판 두 장이다.** MToon에는 뒷면 색이 없어 한 장으로는 안감 색이 안 나온다. 같은
 * 주름의 판을 3mm 안쪽(-Y)에 뒤집어 한 장 더 두면, 앞모습에서는 안감 판이 카메라에 가까워 안감 색이,
 * 뒷모습에서는 바깥 판이 가까워 겉 색이 보인다. 두 판은 Y로만 밀려 있어 주름이 아무리 가팔라도
 * 서로 뚫지 않는다.
 *
 * 주름은 위에서도 잡혀 있어야 망토로 읽힌다. 첫 판의 윗단 진폭 4mm는 평평한 판으로 보였다.
 *
 * 흔들림은 끝자락 젖힘(`sway`)과 위에서 아래로 내려가는 주름 물결(`ripple_phase`)로 만든다. 주름
 * 위상을 돌리는 방식은 천이 좌우로 미끄러지는 것으로 보여 버렸다(사용자 판정 2026-09-16) —
 * `weapons.py build_cloth`가 그 사정을 든다.
 *
 * @param sway 아래 끝을 등 뒤로 들어 올리는 양(m)
 * @param ripplePhase 주름 물결의 위상(라디안). 늘리면 물결이 아래로 내려간다
 */
function cape(sway: number, ripplePhase: number): IGearSpec {
  const sheet = (flip: boolean, y: number, color: Rgb): IGearPart => ({
    type: 'cloth',
    group: 'Gear',
    width: 0.22,
    width_bottom: 0.34,
    length: 0.56,
    folds: 4,
    depth: 0.04,
    depth_top: 0.01,
    phase: 0,
    sway,
    ripple: 1.0,
    ripple_waves: 1.5,
    ripple_phase: ripplePhase,
    columns: 40,
    rows: 20,
    flip,
    location: [0, y, 0.113],
    color,
  });
  return {
    id: 'cape',
    bone: CHEST_BONE,
    parts: [sheet(false, 0.13, [150, 30, 40]), sheet(true, 0.127, [50, 35, 80])],
  };
}

/**
 * 날개 한 쌍. 뿌리 면의 중심을 날개뼈(`SHOULDER_BLADE`)에 붙이고 좌우로 뻗는다. 부품 원점이 뿌리
 * 위 모서리라, 뿌리 중심에서 높이의 절반만큼 올린 자리가 `location`이다 — 날개 모양(뿌리 높이)이
 * 바뀌어도 뿌리 중심은 날개뼈에 남는다(사용자 요청 2026-09-16).
 *
 * 첫 판의 뿌리는 등을 고려한 것이 아니었다. 가슴 높이 4.5cm 뒤에 직사각형 모서리를 매단 것이고,
 * 뿌리 면적이 넓어 문제로 드러나지 않았을 뿐이다.
 *
 * **경첩은 뿌리의 세로 모서리이고 나비처럼 접힌다.** 첫 판은 깊이 축(Y)으로 끝을 들어 올렸는데, 그
 * 축은 뿌리 위 모서리 한 점만 지나서 뿌리 아랫부분이 등에서 떨어졌다 붙었다 했다(사용자 판정
 * 2026-09-16). Z축 회전은 뿌리 모서리 전체가 축이라, 등에 붙은 면이 고정된 채 날개가 펴졌다 접힌다.
 *
 * @param fold 뿌리 모서리를 축으로 날개를 뒤로 접는 각(도). 0이면 옆으로 활짝, 70이면 등 뒤로 거의 접힘
 */
function wings(fold: number): IGearSpec {
  const wing = (side: 1 | -1): IGearPart => ({
    type: 'wing',
    group: 'Gear',
    side,
    span: 0.5,
    height_root: WING_ROOT_HEIGHT,
    height_tip: 0.12,
    sweep: 0.22,
    bend: 0.06,
    feathers: 4,
    scallop: 0.05,
    location: [
      side * SHOULDER_BLADE.x,
      SHOULDER_BLADE.y - UPPER_CHEST_HEAD.y,
      SHOULDER_BLADE.z + WING_ROOT_HEIGHT / 2 - UPPER_CHEST_HEAD.z,
    ],
    rotation: [0, 0, side * fold],
    color: [220, 215, 240],
  });
  return { id: 'wings', bone: CHEST_BONE, parts: [wing(1), wing(-1)] };
}

/**
 * 화려한 장비 — 사용자가 준 사진(가죽 어깨갑옷 + 가슴에서 X자로 교차하는 끈 + 버클, 어깨의 굽은 뿔)을
 * 금색 금속으로 옮긴 것이다(2026-09-17). 사진과 다른 점은 사용자 지정이다 — 털 장식은 뺐고, 끈은
 * 등에서도 X자로 교차하며, 명치 아래에서 허리까지 몸통을 한 바퀴 감싸는 몸판이 있고, 교차점에 파란
 * 발광 보석이 있다. 끈도 금색 금속 띠다.
 *
 * **구조는 허리 위만 그린 멜빵바지다(사용자 판정 2026-09-17).** 몸판이 멜빵바지의 가슴받이이고, 끈은
 * 양 어깨에서 시작해 반대쪽 몸판 위 모서리에 닿아 끝난다. 두 번째 판은 끈이 몸판을 지나 허리까지
 * 내려가 있었고, 세 번째 판은 앞 · 뒤 판만 있어 옆구리가 비었다(사용자 지적) — 몸통 둘레로 한 바퀴
 * 투영한 `band`로 바꿨다. 끈이 몸판 위 모서리(x ±0.08, z 0.58)에서 끝나면 교차점은 그 위 7cm(z 0.655,
 * 흉골 가운데)에 온다 — 끈이 어깨(x ∓0.07, z 0.72)에서 출발하는 이상 교차점을 더 내리려면 몸판을 더
 * 낮게 잘라야 한다. 보석은 그 교차점에 둔다.
 *
 * **위팔 판은 소매에서 2cm 띄운다.** 소매에 7mm로 붙이니 소매 끝을 금색으로 칠한 것처럼 보였다
 * (사용자 판정 2026-09-17). 범위도 줄여 어깨 판 아래에 따로 선 판으로 읽히게 한다. 왼팔은 앞에서
 * 방패에, 뒤에서 머리카락에 가려서 이 경우만 왼쪽 측면(`views`)을 함께 굽는다.
 *
 * 판 · 끈 · 보석 · 버클은 전부 몸 표면에 투영해 붙인다(`weapons.py Surface`). 첫 판의 어깨 구는 어깨
 * 관절보다 7.7cm 위에 떠서 「흰 계란 두 개」로 보였고(사용자 판정 2026-09-17), 재질도 상의 규칙만 복사해
 * 금속으로 읽힐 재료가 없었다. 금속은 이 경우의 `toon`(어두운 음영색 + 금속 matcap)이 만든다.
 *
 * 보석은 `Raw`(툰으로 바꾸지 않음)다. 두 번째 판에서 발광 세기 4의 파란 구가 흰 점으로 나왔다 — 밝은
 * 기본색에 같은 색 발광을 세게 얹으니 채널이 넘쳤고, 금색 matcap까지 더해졌다. 어두운 기본색 위에
 * 파란 발광 색을 약하게 얹어 색이 남게 한다.
 *
 * 좌표는 세계 기준(m)으로 적고 `atChest` · `chestZ`로 부품 좌표로 옮긴다. 어깨 관절은 (±0.067, 0.028,
 * 0.714), 위팔 축은 z 0.655에서 x ±0.104다(2026-09-16 실측).
 */
function armor(): IGearSpec {
  const sides = [1, -1] as const;
  /** 몸판(가슴받이) 위 가장자리의 세계 z. 끈이 여기서 끝나고 버클이 여기 앉는다 */
  const bibTop = 0.58;
  /** 끈이 닿는 몸판 앞 · 뒤 모서리의 x */
  const bibHalfWidth = 0.08;
  const shoulder = (side: 1 | -1): IGearPart[] => [
    {
      // 어깨 위 판 — 관절을 중심으로 한 구면 조각을 어깨에 투영한다. 고도 0이 꼭대기다
      type: 'cap',
      group: 'Gear',
      center: atChest(side * 0.067, 0.028, 0.714),
      radius: 0.1,
      out: [side, 0, 0],
      elevation: [0, 70],
      azimuth: [-75, 75],
      standoff: 0.008,
      columns: 16,
      rows: 8,
      color: GOLD,
    },
    {
      // 위팔 판 — 어깨 판 아래에서 팔 바깥을 감싼다. 중심이 위팔 축 위에 있고, 소매에서 2cm 띄운다
      type: 'cap',
      group: 'Gear',
      center: atChest(side * 0.104, 0.018, 0.655),
      radius: 0.09,
      out: [side, 0, 0],
      elevation: [55, 95],
      azimuth: [-50, 50],
      standoff: 0.02,
      columns: 12,
      rows: 5,
      color: GOLD,
    },
    {
      // 뿔 — 어깨 판 위에 앉혀 바깥 · 뒤로 굽는다. 위에서 아래로 쏴 어깨 표면 + 판 두께에 뿌리를 둔다
      type: 'horn',
      group: 'Gear',
      length: 0.11,
      radius: 0.017,
      tip: 0.002,
      bend: 100,
      lean: [side * 0.7, 0.5, 0],
      snap: { from: atChest(side * 0.078, 0.02, 0.8), direction: [0, 0, -1], standoff: 0.008 },
      color: GOLD,
    },
  ];
  // 멜빵끈 — 어깨 판 앞(뒤) 가운데에서 반대쪽 배판 위 모서리로. 끝을 배판 안으로 2cm 넣어 겹치고,
  // 판(0.008)보다 띄워 위에 놓는다. 두 번째 끈은 조금 더 띄워 교차점에서 위에 겹친다
  const straps = (face: 'front' | 'back'): IGearPart[] =>
    sides.map((side, i) => ({
      type: 'strap',
      group: 'Gear',
      side: face,
      path: [
        [side * -0.07, chestZ(0.72)],
        [side * (bibHalfWidth - 0.006), chestZ(bibTop - 0.02)],
      ],
      width: 0.032,
      standoff: 0.011 + i * 0.004,
      columns: 16,
      rows: 2,
      color: GOLD,
    }));
  // 몸판 — 명치 아래에서 허리까지 몸통을 한 바퀴 감싼다. 축은 몸통 가운데(세계 y -0.01)다
  const bib: IGearPart = {
    type: 'band',
    group: 'Gear',
    axis: [0, -0.01 - UPPER_CHEST_HEAD.y],
    radius: 0.25,
    z_top: chestZ(bibTop),
    z_bottom: chestZ(0.455),
    azimuth: [0, 360],
    standoff: 0.008,
    columns: 48,
    rows: 8,
    color: GOLD,
  };
  return {
    id: 'armor',
    bone: CHEST_BONE,
    parts: [
      ...shoulder(1),
      ...shoulder(-1),
      bib,
      ...straps('front'),
      ...straps('back'),
      ...sides.map((side) => ({
        // 버클 — 앞 끈이 배판 위 모서리에 닿는 자리
        type: 'cube',
        group: 'Gear',
        size: 0.03,
        scale: [1, 0.3, 1.1],
        snap: {
          from: atChest(side * (bibHalfWidth - 0.008), -0.4, bibTop - 0.012),
          direction: [0, 1, 0],
          standoff: 0.016,
        },
        color: GOLD,
      })),
      {
        // 보석 — 앞 끈이 교차하는 흉골 가운데(z 0.655)에 반쯤 박힌 파란 발광 구
        type: 'sphere',
        group: 'Raw',
        radius: 0.022,
        subdivisions: 2,
        snap: { from: atChest(0, -0.4, 0.655), direction: [0, 1, 0], standoff: 0.012 },
        color: [10, 30, 140],
        emission_color: [40, 100, 255],
        emission: 0.6,
      },
    ],
  };
}

/** 사람이 고를 경우 표. */
export const CASES: readonly IGearCase[] = [
  {
    id: 'cape',
    label: '망토',
    checks: [
      '주름에 그늘이 흉터처럼 얼룩지나 (원본 음영 · 딱딱한 경계 두 판 모두)',
      '앞모습에서 몸 옆으로 보이는 안감이 겉과 다른 색으로 갈리나',
      '긴 머리카락과 망토가 서로 뚫고 나오나',
      '720p에서 망토가 망토로 읽히나',
    ],
    spec: cape(0.06, 0),
    hardEdge: true,
    toon: { shade_threshold: 0.8 },
    flutter: {
      view: 'back',
      at: (t) => cape(0.06 + 0.05 * Math.sin(2 * Math.PI * t), 2 * Math.PI * t),
    },
  },
  {
    id: 'wings',
    label: '날개',
    checks: [
      '뿌리 면이 날개뼈 자리에 등과 붙어 보이나 (뒤 · 3/4)',
      '날개가 층 캔버스를 넘나 (아래 수치의 넘침)',
      '앞모습에서 날개와 팔 · 방패가 서로 가리는 경계가 이상한가',
      '얇은 막의 가장자리가 720p에서 사라지거나 깨지나',
      '나비처럼 접혔다 펴질 때 뿌리가 등에서 떨어지거나 막에 그늘 조각이 튀나',
    ],
    spec: wings(25),
    hardEdge: true,
    flutter: { view: 'three_quarter', at: (t) => wings(35 + 35 * Math.sin(2 * Math.PI * t)) },
  },
  {
    id: 'armor',
    label: '화려한 장비 — 금색 어깨갑옷 · X자 끈 · 배판 · 뿔 · 명치 보석',
    checks: [
      '판 · 끈 · 뿔이 금속으로 읽히나 (반사점이 보이나, 흰 덩어리로 보이나)',
      '끈이 양 어깨에서 반대쪽 몸판 위 모서리로 이어져 끝나나 (앞 · 뒤)',
      '옆구리까지 감싼 몸판과 끈이 몸에 붙어 보이나 (앞 · 뒤 · 3/4 · 왼쪽)',
      '위팔 판이 소매를 칠한 것처럼 보이지 않나 (왼쪽 측면에서 왼팔)',
      '보석이 그늘에 묻히지 않나',
      '720p에서 보석 · 뿔 · 끈이 남나',
    ],
    spec: armor(),
    hardEdge: false,
    views: ['front', 'back', 'three_quarter', 'left'],
    // 금속 — 어두운 음영색(기본색의 35%) · 넓은 그늘 · 도구가 만든 금속 matcap의 반사점
    toon: {
      shade_ratio: 0.35,
      shade_threshold: 0.5,
      matcap: [1, 1, 1],
      matcap_image: 'matcap_gold.png',
    },
  },
  {
    id: 'ornament',
    label: '얇은 장식 — 허리 술과 사슬',
    checks: [
      '술 · 사슬이 720p에서 사라지나',
      '사라진다면 몇 px 굵기부터 남는지 판단할 근거가 되나',
    ],
    spec: {
      id: 'ornament',
      bone: HIPS_BONE,
      // 술은 벨트 아래 z 0.31~0.45에 매달리고, 고리는 z 0.46의 벨트 선에 앞면을 따라 납작하게 붙는다.
      // 둘 다 `waistFront`에서 굵기의 절반보다 조금 더 앞에 둬 표면에 닿게 한다.
      parts: [
        ...[-0.06, -0.03, 0, 0.03, 0.06].map((x) => ({
          type: 'cylinder',
          group: 'Gear',
          radius: 0.004,
          depth: 0.14,
          vertices: 6,
          location: [x, waistFront(x) - 0.006 - HIPS_HEAD.y, 0.38 - HIPS_HEAD.z],
          color: [200, 160, 60],
        })),
        ...[-0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075].map((x) => ({
          type: 'torus',
          group: 'Gear',
          major_radius: 0.011,
          minor_radius: 0.0025,
          major_segments: 10,
          minor_segments: 4,
          location: [x, waistFront(x) - 0.004 - HIPS_HEAD.y, 0.46 - HIPS_HEAD.z],
          rotation: [90, 0, 0],
          color: [210, 210, 220],
        })),
      ],
    },
    hardEdge: false,
  },
];

// 오라(몸을 감싸는 반투명 발광 껍데기, `Raw` 재질)는 2026-09-17에 검토 세트에서 뺐다. 사용자가 발밑에서
// 회전하는 마법진(워크3 패시브식)으로 바꿨고, 그것은 프레임에 굽지 않고 게임에서 별도 노드로 얹는다 —
// 회전이 걷기 주기와 무관해야 하고, 바닥 원판은 층 캔버스를 넘치며(첫 판 오라가 세 방향 모두 넘쳤다),
// 패시브마다 켜고 꺼야 한다. 굽기 쪽에서 정할 것은 카메라 고도 하나라, 그 후보 시트에 원판을 넣는다.

/** 툰 사양 — `toon.py`가 읽는다. `materials`의 키는 분류(`GEAR`)다. */
interface IToonSpec {
  id: string;
  materials: Record<string, Record<string, unknown>>;
}

/** 장비에 입히는 툰 사양. 몸은 건드리지 않고(`*` 없음) 장비만 상의의 음영 규칙을 받는다. */
const TOON_ORIGINAL: IToonSpec = {
  id: 'gear_original',
  materials: { GEAR: { like: 'Tops_CLOTH', double_sided: true } },
};

/** 딱딱한 경계 판. 장비의 계단 정도만 1로 올린다. */
const TOON_HARD: IToonSpec = {
  id: 'gear_hard',
  materials: { GEAR: { like: 'Tops_CLOTH', double_sided: true, shading_toony: 1 } },
};

/** 굽기 한 번의 인자. */
interface IBake {
  out: string;
  layer: 'body' | 'gear' | 'whole';
  yaw: number;
  gearSpec?: string;
  toon?: string;
  weapons?: boolean;
}

/** 경로 묶음 — 한 실행 안에서 한 번만 정한다. */
interface IPaths {
  /** 거짓이면 굽지 않고 이미 있는 PNG로 시트와 수치만 다시 만든다(`--sheet-only`) */
  bakeEnabled: boolean;
  outDir: string;
  vrm: string;
  staff: string;
  shield: string;
  toonOriginal: string;
  toonHard: string;
}

/** Blender 실행 파일. `weapons.ts`와 같은 규칙이다. */
function resolveBlender(): string {
  const fromEnv = process.env.BLENDER;
  if (!fromEnv) return 'blender';
  if (!fs.existsSync(fromEnv))
    throw new Error(`환경 변수 BLENDER가 가리키는 파일이 없다: ${fromEnv}`);
  return fromEnv;
}

/** JSON을 쓰고 경로를 돌려준다. */
function writeJson(file: string, value: unknown): string {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`, 'utf-8');
  return file;
}

/**
 * 경우 하나가 쓸 툰 사양 파일 둘(원본 음영 · 딱딱한 경계). 경우가 `toon`으로 `GEAR` 값을 덮으면
 * 공용 파일 대신 그 경우 이름을 붙인 파일을 따로 쓴다 — 공용 파일을 고치면 다른 경우까지 바뀐다.
 */
function toonFor(paths: IPaths, item: IGearCase): { original: string; hard: string } {
  if (!item.toon) return { original: paths.toonOriginal, hard: paths.toonHard };
  const override = { ...item.toon };
  // matcap 파일은 산출물 자리에 도구가 만들고 절대 경로로 넘긴다 — `toon.py`는 경로만 안다
  if (typeof override.matcap_image === 'string') {
    const file = path.join(paths.outDir, override.matcap_image);
    if (!fs.existsSync(file)) fs.writeFileSync(file, encodePng(metalMatcap(256)));
    override.matcap_image = file;
  }
  const merged = (base: IToonSpec): IToonSpec => ({
    id: `${base.id}_${item.id}`,
    materials: { ...base.materials, GEAR: { ...base.materials.GEAR, ...override } },
  });
  return {
    original: writeJson(
      path.join(paths.outDir, `toon_original_${item.id}.json`),
      merged(TOON_ORIGINAL),
    ),
    hard: writeJson(path.join(paths.outDir, `toon_hard_${item.id}.json`), merged(TOON_HARD)),
  };
}

/**
 * 금속용 matcap. 구 법선에 따라 따뜻한 반사점 하나와 약한 보조 반사, 넓은 그라디언트를 준다.
 *
 * 애드온의 matcap 항은 더해지기만 해서 어둡게는 못 하므로(`toon.py`) 어두운 면은 `shade_ratio`가 만들고,
 * 여기서는 밝은 반사만 든다. 원 밖은 검정(효과 없음)이다. 값을 파일로 두지 않고 만드는 이유는 산출물
 * 자리가 추적되지 않는 폴더라서다.
 */
function metalMatcap(size: number): IRgbaImage {
  const unit = (v: [number, number, number]): [number, number, number] => {
    const n = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / n, v[1] / n, v[2] / n];
  };
  const key = unit([-0.45, 0.65, 0.6]);
  const fill = unit([0.6, -0.3, 0.75]);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size) * 2 - 1;
      const ny = 1 - ((y + 0.5) / size) * 2;
      const r2 = nx * nx + ny * ny;
      const at = (y * size + x) * 4;
      data[at + 3] = 255;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      const d1 = Math.max(0, nx * key[0] + ny * key[1] + nz * key[2]);
      const d2 = Math.max(0, nx * fill[0] + ny * fill[1] + nz * fill[2]);
      const v = Math.min(1, d1 ** 60 * 0.95 + d2 ** 25 * 0.3 + d1 * 0.12);
      data[at] = Math.round(v * 255);
      data[at + 1] = Math.round(v * 0.96 * 255);
      data[at + 2] = Math.round(v * 0.85 * 255);
    }
  }
  return { width: size, height: size, data };
}

/**
 * `probe_layers.py`를 한 번 부른다. 판정 줄이 실패면 코드와 stderr 꼬리를 담아 던진다.
 *
 * `--sheet-only`면 굽지 않고 산출물이 이미 있는지만 본다. 시트 배치를 고칠 때마다 Blender를 여든
 * 번 넘게 다시 부르지 않으려는 것이다.
 */
function bake(paths: IPaths, job: IBake): void {
  if (!paths.bakeEnabled) {
    if (!fs.existsSync(job.out)) throw new Error(`--sheet-only인데 구운 파일이 없다: ${job.out}`);
    return;
  }
  const args = [
    '--background',
    '--python-exit-code',
    '1',
    '--python',
    path.join(ROOT, 'tools/blender/probe_layers.py'),
    '--',
    '--base-vrm',
    paths.vrm,
    '--layer',
    job.layer,
    '--yaw',
    String(job.yaw),
    '--out',
    job.out,
    '--width',
    String(PLAYER_FRAME_SPEC.width),
    '--height',
    String(PLAYER_FRAME_SPEC.height),
    '--foot-row',
    String(PLAYER_FRAME_SPEC.footLineY),
    '--head-row',
    String(PLAYER_FRAME_SPEC.headLineY),
    '--layer-width',
    String(LAYER.width),
    '--layer-height',
    String(LAYER.height),
  ];
  if (job.gearSpec) args.push('--gear-spec', job.gearSpec);
  if (job.toon) args.push('--toon', job.toon);
  if (job.weapons) args.push('--staff-spec', paths.staff, '--shield-spec', paths.shield);

  const result = spawnSync(resolveBlender(), args, {
    encoding: 'utf-8',
    timeout: BLENDER_TIMEOUT_MS,
  });
  const line = parseGateLine(result.stdout ?? '');
  if (line.ok) return;
  const tail = (result.stderr ?? '').split('\n').slice(-12).join('\n');
  throw new Error(`${path.basename(job.out)}: ${line.code} ${line.message}\n${tail}`);
}

/** PNG 한 장을 읽는다. */
function read(file: string): IRgbaImage {
  return decodePng(fs.readFileSync(file));
}

/** 캔버스 가장자리 한 줄에 보이는 픽셀 수 — 0보다 크면 부품이 캔버스를 넘은 것이다. */
function edgePixels(img: IRgbaImage): number {
  let count = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (x !== 0 && y !== 0 && x !== img.width - 1 && y !== img.height - 1) continue;
      if (img.data[(y * img.width + x) * 4 + 3] > ALPHA_ON) count++;
    }
  }
  return count;
}

/**
 * 픽셀 하나를 `factor`×`factor` 칸으로 그대로 늘린다. 보간하지 않는다.
 *
 * 720p 칸은 117×96이라 원본 칸 옆에 두면 너무 작아 판정할 수 없다. 부드럽게 늘리면 게임 크기에서
 * 사라지는 선이 흐리게 되살아나므로, 픽셀 경계를 그대로 둔 채 키운다.
 */
function enlarge(img: IRgbaImage, factor: number): IRgbaImage {
  const width = img.width * factor;
  const height = img.height * factor;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (Math.floor(y / factor) * img.width + Math.floor(x / factor)) * 4;
      data.set(img.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** 720p 칸을 시트에서 키우는 배율. 흔들림 재생 페이지와 같은 세 배다. */
const GAME_ENLARGE = 3;

/** 원본 크기 칸과 720p 칸(세 배로 키움)을 배경 위에 얹어 만든다. */
function cells(file: string): { source: IRgbaImage; game: IRgbaImage } {
  const img = read(file);
  const game = compositeOver(sampleLikeEngine(img, GAME_720P.width, GAME_720P.height), BACKGROUND);
  return { source: compositeOver(img, BACKGROUND), game: enlarge(game, GAME_ENLARGE) };
}

/** 경우 하나를 굽고 시트와 수치를 쓴다. 수치를 돌려준다. */
function runCase(paths: IPaths, item: IGearCase): Record<string, unknown>[] {
  const dir = paths.outDir;
  const specFile = writeJson(path.join(dir, `${item.id}.json`), item.spec);
  const toon = toonFor(paths, item);
  const rows: IRgbaImage[][] = [];
  const numbers: Record<string, unknown>[] = [];

  const wanted = item.views ?? DEFAULT_VIEWS;
  for (const view of VIEWS.filter((v) => wanted.includes(v.id))) {
    const base = path.join(dir, `${item.id}_${view.id}`);
    const bodyFile = path.join(dir, `body_${view.id}.png`);
    if (!fs.existsSync(bodyFile)) bake(paths, { out: bodyFile, layer: 'body', yaw: view.yaw });

    const whole = `${base}_whole.png`;
    bake(paths, {
      out: whole,
      layer: 'whole',
      yaw: view.yaw,
      gearSpec: specFile,
      toon: toon.original,
      weapons: true,
    });
    const hard = `${base}_hard.png`;
    if (item.hardEdge) {
      bake(paths, {
        out: hard,
        layer: 'whole',
        yaw: view.yaw,
        gearSpec: specFile,
        toon: toon.hard,
        weapons: true,
      });
    }
    const ref = `${base}_ref.png`;
    bake(paths, {
      out: ref,
      layer: 'whole',
      yaw: view.yaw,
      gearSpec: specFile,
      toon: toon.original,
    });
    const layer = `${base}_layer.png`;
    bake(paths, {
      out: layer,
      layer: 'gear',
      yaw: view.yaw,
      gearSpec: specFile,
      toon: toon.original,
    });

    const layerImg = read(layer);
    const stacked = layerOver(read(bodyFile), layerImg);
    const stackedFile = `${base}_stacked.png`;
    fs.writeFileSync(stackedFile, encodePng(stacked));
    const { changed, maxChannel } = pixelDiff(stacked, read(ref), DIFF_THRESHOLD);
    numbers.push({
      case: item.id,
      view: view.id,
      stackedVsRef: changed,
      maxChannel,
      layerEdge: edgePixels(layerImg),
    });

    const w = cells(whole);
    const s = cells(stackedFile);
    const row = [w.source];
    if (item.hardEdge) row.push(cells(hard).source);
    row.push(w.game);
    if (item.hardEdge) row.push(cells(hard).game);
    row.push(s.game);
    rows.push(row);
  }

  const sheet = composeGrid(rows, { gap: 12, background: [40, 40, 44] });
  fs.writeFileSync(path.join(dir, `sheet_${item.id}.png`), encodePng(sheet));
  return numbers;
}

/** 흔들림 프레임 파일 이름(확장자 없음). 굽는 쪽과 페이지가 같은 이름을 보게 한 곳에서 만든다. */
function flutterNames(item: IGearCase): { original: string[]; hard: string[] } {
  const of = (kind: 'original' | 'hard') =>
    Array.from({ length: FLUTTER_FRAMES }, (_, i) => `${item.id}_${kind}_${i}`);
  return { original: of('original'), hard: of('hard') };
}

/** 흔들림 프레임을 굽고 720p 사본을 만든다. 파일 이름 목록을 돌려준다. */
function runFlutter(paths: IPaths, item: IGearCase): { original: string[]; hard: string[] } {
  if (!item.flutter) return { original: [], hard: [] };
  const flutter = item.flutter;
  const dir = path.join(paths.outDir, 'flutter');
  fs.mkdirSync(dir, { recursive: true });
  const yaw = VIEWS.find((v) => v.id === flutter.view)?.yaw ?? 0;
  const files = toonFor(paths, item);
  const names = flutterNames(item);

  for (let i = 0; i < FLUTTER_FRAMES; i++) {
    const specFile = writeJson(
      path.join(dir, `${item.id}_${i}.json`),
      flutter.at(i / FLUTTER_FRAMES),
    );
    for (const kind of ['original', 'hard'] as const) {
      const name = names[kind][i];
      const file = path.join(dir, `${name}.png`);
      const toon = kind === 'original' ? files.original : files.hard;
      bake(paths, { out: file, layer: 'whole', yaw, gearSpec: specFile, toon, weapons: true });
      const img = read(file);
      fs.writeFileSync(
        path.join(dir, `${name}_720p.png`),
        encodePng(sampleLikeEngine(img, GAME_720P.width, GAME_720P.height)),
      );
    }
  }
  return names;
}

/**
 * 흔들림 재생 페이지를 쓴다. 후보를 한 판씩 굽지 않고 나란히 재생해 고르는 방식이다.
 *
 * 720p 칸은 엔진식으로 줄인 PNG를 픽셀 그대로 세 배 키워 보여 준다. 브라우저가 부드럽게 늘리면
 * 게임 크기에서 튀는 그늘 조각이 뭉개져 안 보인다.
 */
function writeFlutterPage(
  paths: IPaths,
  groups: { item: IGearCase; names: { original: string[]; hard: string[] } }[],
): string {
  const block = (item: IGearCase, kind: string, names: string[]) => `
    <figure><figcaption>${item.label} · ${kind === 'original' ? '원본 음영' : '딱딱한 경계'}</figcaption>
      <div class="pair">
        <img class="src" data-frames="${names.map((n) => `flutter/${n}.png`).join(',')}">
        <img class="game" data-frames="${names.map((n) => `flutter/${n}_720p.png`).join(',')}">
      </div>
    </figure>`;
  const html = `<!doctype html>
<html lang="ko"><meta charset="utf-8"><title>장비 흔들림 재생</title>
<style>
  body { background: #1c1c20; color: #ddd; font: 14px sans-serif; margin: 16px; }
  .grid { display: flex; flex-wrap: wrap; gap: 24px; }
  figure { margin: 0; } figcaption { margin-bottom: 6px; }
  .pair { display: flex; gap: 12px; align-items: flex-end; background: #000; padding: 8px; }
  .src { width: 300px; } .game { width: ${GAME_720P.width * 3}px; image-rendering: pixelated; }
</style>
<p>한 주기 ${FLUTTER_FRAMES}장을 8fps로 반복한다. 왼쪽은 원본 크기(절반으로 표시), 오른쪽은 720p를 픽셀 그대로 세 배.</p>
<div class="grid">${groups
    .map(
      ({ item, names }) =>
        block(item, 'original', names.original) + block(item, 'hard', names.hard),
    )
    .join('')}</div>
<script>
  const imgs = [...document.querySelectorAll('img[data-frames]')].map((el) => ({ el, frames: el.dataset.frames.split(',') }));
  let i = 0;
  const tick = () => { for (const { el, frames } of imgs) el.src = frames[i % frames.length]; i++; };
  tick(); setInterval(tick, 125);
</script>
</html>
`;
  const file = path.join(paths.outDir, 'flutter.html');
  fs.writeFileSync(file, html, 'utf-8');
  return file;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const argv = process.argv.slice(2);
    const onlyAt = argv.indexOf('--only');
    const only = onlyAt >= 0 ? argv[onlyAt + 1].split(',') : null;
    const vrmAt = argv.indexOf('--vrm');
    const vrm = path.resolve(ROOT, vrmAt >= 0 ? argv[vrmAt + 1] : DEFAULT_VRM);
    if (!fs.existsSync(vrm)) throw new Error(`.vrm이 없다: ${vrm} — --vrm으로 경로를 준다`);

    const outDir = path.join(ROOT, OUT_DIR);
    fs.mkdirSync(outDir, { recursive: true });
    const [staff, shield] = writeChosenSpecs(outDir);
    const paths: IPaths = {
      bakeEnabled: !argv.includes('--sheet-only'),
      outDir,
      vrm,
      staff,
      shield,
      toonOriginal: writeJson(path.join(outDir, 'toon_original.json'), TOON_ORIGINAL),
      toonHard: writeJson(path.join(outDir, 'toon_hard.json'), TOON_HARD),
    };

    const chosen = CASES.filter((c) => !only || only.includes(c.id));
    const numbers: Record<string, unknown>[] = [];
    const flutters: { item: IGearCase; names: { original: string[]; hard: string[] } }[] = [];
    for (const item of chosen) {
      const started = Date.now();
      numbers.push(...runCase(paths, item));
      if (item.flutter) flutters.push({ item, names: runFlutter(paths, item) });
      console.log(
        `✓ ${item.id} ${((Date.now() - started) / 1000).toFixed(0)}s — sheet_${item.id}.png`,
      );
    }
    // `--only`로 한 경우만 다시 구워도 페이지는 흔들림이 있는 경우를 전부 실어야 한다. 안 그러면
    // 망토만 고친 뒤 날개 흔들림이 페이지에서 사라진다(2026-09-16에 실제로 그랬다). 이번에 안 구운
    // 경우는 프레임이 이미 있을 때만 싣는다.
    for (const item of CASES) {
      if (!item.flutter || chosen.includes(item)) continue;
      const names = flutterNames(item);
      if (fs.existsSync(path.join(outDir, 'flutter', `${names.original[0]}.png`)))
        flutters.push({ item, names });
    }
    if (flutters.length > 0)
      console.log(`✓ ${path.relative(ROOT, writeFlutterPage(paths, flutters))}`);

    writeJson(path.join(outDir, 'numbers.json'), numbers);
    console.log('\n경우      방향            층합성차이  최대채널차  캔버스넘침');
    for (const n of numbers) {
      console.log(
        `${String(n.case).padEnd(9)} ${String(n.view).padEnd(15)} ${String(n.stackedVsRef).padStart(9)}  ${String(n.maxChannel).padStart(9)}  ${String(n.layerEdge).padStart(9)}`,
      );
    }
    console.log(
      '\n시트 열: 원본 음영(원본 크기) · [딱딱한 경계(원본 크기)] · 원본 음영 720p · [딱딱한 경계 720p] · 층 합성 720p',
    );
    console.log('시트 줄: 앞 · 뒤 · 3/4 (경우가 views를 주면 그 순서 — 왼쪽 측면은 화려한 장비만)');
    for (const item of chosen) {
      console.log(`\n[${item.label}] sheet_${item.id}.png`);
      for (const check of item.checks) console.log(`  - ${check}`);
    }
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
}
