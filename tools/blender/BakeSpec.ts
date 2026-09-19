/**
 * G2가 확정한 굽기 값 — 채택한 무기 둘, 외곽선(인버티드 헐 1), 카메라 고도와 마법진 지름, 장비 재질 값.
 *
 * 값은 전부 사람 판정으로 정해졌다(2026-09-16 ~ 09-17). 후보를 굽고 시트를 만든 실행기들은 판정이 끝나
 * `retired/`로 물러났는데, 확정값이 그 실행기들 안에 묻혀 있어서 이 파일로 옮겼다. 물러난 실행기도 이 파일의
 * 값을 읽는다. 같은 값을 두 곳에 두면 한쪽만 고쳤을 때 후보 시트와 생산 굽기가 다른 그림을 굽는데, 그 차이는
 * 타입체크에도 테스트에도 걸리지 않는다.
 *
 * **여기 없는 것.** 크기(플레이어 80% · 몬스터는 `collisionRadius`의 직선)는 굽기 값이 아니라 게임 데이터라
 * G5가 `player.json` · `enemies.json`에 쓴다. 마법진 그림은 아티스트가 그리고 여기에는 지름 규칙만 있다.
 *
 * **유료 아이템의 사양은 여기 두지 않는다(2026-09-19 사용자 결정, 백로그 F109).** 이 레포는 공개이고, 장비의
 * 3D 원본은 `.blend`가 아니라 여기 적는 부품 사양이다. 그래서 사양을 커밋하면 그 장비를 누구나 다시 세울 수
 * 있다. 지금 들어 있는 지팡이 · 방패는 v1 기본 장비이자 이 워크플로우가 유료 스킨까지 되는지를 판정하는
 * 시험물이라 공개해도 된다. v2에서 실제로 파는 아이템은 다르다 — 사양 · 그것을 굽는 코드 · 구운 결과물을
 * **레포를 비공개로 바꾼 뒤에만** 만들고 커밋한다. 공개 상태에서 그 작업을 하게 되면 시작하기 전에 멈추고
 * 비공개 전환부터 확인한다. 한 번 푸시한 것은 PR ref에 남아 되돌릴 수 없다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { PLAYER_FRAME_SPEC } from '../../tests/helpers/FrameSet.ts';
import type { IRgbaImage } from '../../tests/helpers/SpriteMetrics.ts';

/** 부품 하나 — 파이썬이 그대로 세우는 프리미티브다. */
export interface IWeaponPart {
  type: 'cylinder' | 'cone' | 'sphere' | 'torus' | 'cube';
  radius?: number;
  radius1?: number;
  radius2?: number;
  depth?: number;
  vertices?: number;
  subdivisions?: number;
  major_radius?: number;
  minor_radius?: number;
  major_segments?: number;
  minor_segments?: number;
  size?: number;
  location?: readonly [number, number, number];
  /** X · Y · Z 회전(도) */
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number];
  /** 0~255 sRGB */
  color?: readonly [number, number, number];
}

/** 무기 하나의 사양 — `weapons.py`와 `probe_layers.py`가 JSON으로 받는다. */
export interface IWeaponSpec {
  id: string;
  /** 사람이 읽는 이름 — 시트를 보며 고를 때 부르는 말이다 */
  label: string;
  parts: IWeaponPart[];
  /**
   * 손이 쥐는 지점 — 무기 로컬 좌표(m). 굽기가 이 점을 손 본에 맞춘다.
   *
   * **무기마다 다르다.** 완드는 아래쪽을, 스태프는 위쪽을, 방패는 판 중심에서 몸 쪽으로 당긴
   * 자리를 쥔다. 그래서 굽기 코드에 한 값을 박지 않고 무기마다 들려 둔다 — 박아 두면 v2에서
   * 칼 · 도끼 · 활이 올 때마다 그 코드를 고치게 된다.
   *
   * 채택한 무기에만 있다. 떨어진 후보는 쥐어 볼 일이 없어 비워 둔다.
   */
  grip?: readonly [number, number, number];
}

/** 나무 손잡이. */
export const WOOD: readonly [number, number, number] = [110, 80, 55];
/** 쇠붙이 — 테두리와 갈래. */
export const METAL: readonly [number, number, number] = [170, 175, 185];
/** 마법 보석. */
export const GEM: readonly [number, number, number] = [90, 180, 220];
/** 방패 판. */
export const PLATE: readonly [number, number, number] = [140, 120, 95];
/** 방패 가운데 장식. */
export const BOSS: readonly [number, number, number] = [200, 180, 120];

/**
 * 채택한 지팡이 — 사용자가 후보 셋 중에서 골랐다(2026-09-16). 떨어진 둘은 `retired/weapons.ts`의 후보 표에 있다.
 *
 * 좌표는 미터이고 원점이 바닥이라, 손잡이 길이를 바꾸면 `location`의 z도 절반만큼 함께 옮긴다.
 */
export const STAFF_ORB: IWeaponSpec = {
  id: 'staff_orb',
  label: '지팡이 A — 구슬',
  // **전장 0.883m — 캐릭터 키(1.104m)의 5분의 4다(2026-09-16 사용자 결정).** 종전 1.362m는
  // 키보다 23% 길어서 캔버스를 세로로 키워도 잘렸고, 눈으로도 캐릭터보다 1.5배로 읽혔다.
  //
  // 길이를 줄일 때 구슬과 테도 비율에 맞춰 줄였다. 대 굵기는 아래 부품 주석이 든다.
  //
  // 그립은 아래에서 65% 지점이다. 손이 키의 58% 높이에 있어서, 대의 아래 끝이 바닥에서
  // 30px(0.068m) 뜨고 위 끝이 머리 아래에 온다 — 짚는 것이 아니라 들고 걷는 자리다
  // (2026-09-16 사용자 판정). x는 화면 왼쪽으로 10px 옮긴 값이다.
  grip: [-0.005, 0.015, 0.57],
  parts: [
    {
      type: 'cylinder',
      // 반지름 0.012는 게임 화면(720p)에서 대가 **2.1px**로 나오는 굵기다(소스 10.6px).
      // 0.018(3.1px)은 두껍고 0.006(1.0px)은 게임 크기에서 사라질 만큼 얇았다. 그 사이를
      // 게임 크기 축소판으로 보고 골랐고, 같은 날 G2 툰 세팅에 들어가기 전에 사용자가 이 굵기를
      // 다시 보고 확정했다(2026-09-16).
      radius: 0.012,
      depth: 0.81,
      vertices: 8,
      location: [0, 0, 0.405],
      color: WOOD,
    },
    {
      type: 'torus',
      major_radius: 0.032,
      minor_radius: 0.011,
      major_segments: 10,
      minor_segments: 6,
      location: [0, 0, 0.795],
      rotation: [0, 0, 0],
      color: METAL,
    },
    { type: 'sphere', radius: 0.045, subdivisions: 2, location: [0, 0, 0.838], color: GEM },
  ],
};

/** 채택한 방패 — 사용자가 후보 셋 중에서 골랐다(2026-09-16). 떨어진 둘은 `retired/weapons.ts`의 후보 표에 있다. */
export const SHIELD_ROUND: IWeaponSpec = {
  id: 'shield_round',
  label: '방패 A — 원형',
  // **손은 판의 중심을 쥔다.** x와 z가 판 중심(0, 0.75)과 같은 값인 것이 그 뜻이다.
  //
  // 한동안 x를 0.05로 당겨 뒀다. 손이 몸 바깥에 있어서 중심을 손에 두면 판의 절반이 기준
  // 캔버스를 넘기 때문이었는데, 그 자리가 뒷모습에서 중심이 아닌 것으로 드러났다(2026-09-16
  // 사용자 판정 — 22px 어긋남). 무기 층이 자기 캔버스를 갖게 되면서 당겨 둘 이유도 사라졌다
  // (ADR 009). 넘치는 것은 캔버스를 키워 받는다.
  //
  // y만 0.07로 물려 둔다. **손이 판 뒤에 통째로 들어가야** 하기 때문이다. 판의 반두께가
  // 0.0225라 y를 0.02로 두면 손 앞면이 판의 뒷면에 걸쳐, 정면 렌더에서 손가락이 방패를 뚫고
  // 나온다(2026-09-16 사용자 판정). 방패를 쥔 손은 앞에서 보이면 안 된다.
  grip: [0, 0.07, 0.75],
  // **크기를 절반으로 줄였다(2026-09-16 사용자 판정).** 바깥 반지름이 0.282일 때 방패가 몸을
  // 거의 다 가렸다. 지금은 0.141이고 지름이 키의 25%다.
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
      type: 'torus',
      major_radius: 0.13,
      minor_radius: 0.011,
      major_segments: 16,
      minor_segments: 6,
      location: [0, 0, 0.75],
      rotation: [90, 0, 0],
      color: METAL,
    },
    { type: 'sphere', radius: 0.035, subdivisions: 2, location: [0, -0.015, 0.75], color: BOSS },
  ],
};

/** 채택한 무기 둘. 굽기가 이 순서(지팡이 · 방패)로 받는다. */
export const CHOSEN_WEAPONS: readonly IWeaponSpec[] = [STAFF_ORB, SHIELD_ROUND];

/**
 * 채택한 무기의 사양을 파이썬이 읽을 JSON으로 쓰고 경로들을 돌려준다.
 *
 * **그립이 없으면 던진다.** 층 탐침이 그립으로 무기를 손에 맞추는데, 그립이 빠진 사양은 무기
 * 원점을 손에 붙여 지팡이가 손목에서 위로만 솟는 그림을 조용히 굽는다.
 *
 * @param dir 쓸 폴더. 없으면 만든다
 * @returns 쓴 파일의 절대 경로 — `CHOSEN_WEAPONS`와 같은 순서(지팡이 · 방패)
 */
export function writeChosenSpecs(dir: string): string[] {
  fs.mkdirSync(dir, { recursive: true });
  return CHOSEN_WEAPONS.map((weapon) => {
    if (!weapon.grip) throw new Error(`채택한 무기 ${weapon.id}에 grip이 없다`);
    const file = path.join(dir, `${weapon.id}.json`);
    fs.writeFileSync(file, `${JSON.stringify(weapon, null, 2)}\n`, 'utf-8');
    return file;
  });
}

/** 기준 자세 키(m, 2026-09-16 실측). 캔버스 픽셀과 미터를 잇는 유일한 값이다 */
export const MODEL_HEIGHT_M = 1.104;

/** 캔버스의 픽셀/미터. 머리 행에서 발 행까지가 키다 */
export const PX_PER_M =
  (PLAYER_FRAME_SPEC.footLineY - PLAYER_FRAME_SPEC.headLineY) / MODEL_HEIGHT_M;

/** 외곽선의 겨냥 굵기(px, 493px 캔버스). 귀신 표본 둘의 윤곽선이 긴 변의 0.55~0.57%였다. */
export const OUTLINE_WIDTH_PX = 2.75;

/** 겨냥 굵기를 미터로 — 헐이 면을 밀어내는 거리다 */
export const OUTLINE_WIDTH_M = OUTLINE_WIDTH_PX / PX_PER_M;

/** 헐이 재질 분류마다 받는 폭(m). `null`이면 그 분류는 외곽선 없음 */
export type HullWidths = Record<string, number | null>;

/** 인버티드 헐 한 판의 값 — 분류별 폭과 외곽선이 조명을 받는 정도(0이면 조명과 무관한 단색) */
export interface IHull {
  widths: HullWidths;
  lightingMix: number;
}

/**
 * 채택한 외곽선 — 헐 1. 머리카락까지 전부 같은 굵기로 두르고 눈 · 얼굴 그림 재질만 뺀다(2026-09-17 사용자 판정).
 *
 * 머리카락을 빼거나(헐 2) 절반 굵기로 한(헐 3) 판, Line Art, 후처리는 탈락했다. 그 판들은 `retired/outline.ts`의
 * 후보 표에 남아 있다.
 */
export const CHOSEN_HULL: IHull = {
  widths: { '*': OUTLINE_WIDTH_M, EYE: null, FACE: null },
  lightingMix: 0,
};

/** 툰 사양 — `toon.py`가 읽는다. `materials`의 키는 분류(`GEAR` · `WEAPON`)나 `*`(나머지 전부)다. */
export interface IToonSpec {
  id: string;
  materials: Record<string, Record<string, unknown>>;
}

/** 장비(`GEAR`)의 기본 툰 값. 몸은 건드리지 않고 장비만 상의의 음영 규칙을 받는다. */
export const GEAR_TOON = { like: 'Tops_CLOTH', double_sided: true };

/**
 * 무기(`WEAPON`)의 툰 값 — 상의 규칙의 MToon(2026-09-17 확정). 헐 외곽선은 MToon 머티리얼에서만 나와서,
 * 무기를 Principled BSDF로 두면 무기에만 외곽선이 없다.
 */
export const WEAPON_TOON = { like: 'Tops_CLOTH', shade_ratio: 0.6 };

/**
 * 천 장비가 `GEAR_TOON` 위에 덮는 값. 몸 조명이 앞 위(고도 57°)에서 와서 상의와 같은 문턱(0.05)으로는 세로
 * 주름이 그늘지지 않는다 — 주름 면이 73° 넘게 기울어야 하는데 천 주름은 그렇게 안 기운다
 * (`ops-blender-toon.md` §3.2). 망토 세 번째 판이 이 값으로 통과했다(2026-09-17). 천 재질을 확정할 때까지는
 * 후보값이다.
 */
export const CLOTH_TOON = { shade_threshold: 0.8 };

/**
 * 금속 장비가 `GEAR_TOON` 위에 덮는 값 — 어두운 음영색(기본색의 35%) · 넓은 그늘 · 반사점 matcap. 화려한 장비
 * 다섯 번째 판이 이 값으로 통과했다(2026-09-17). matcap 그림은 `metalMatcap`이 만들고, 굽는 쪽이 그 파일의
 * 절대 경로를 `matcap_image`로 함께 넘긴다.
 */
export const METAL_TOON = { shade_ratio: 0.35, shade_threshold: 0.5, matcap: [1, 1, 1] };

/**
 * 헐 외곽선을 입힌 툰 재질 표. 몸(`*`)과 분류마다 외곽선 폭을 주고 색은 재질 것을 둔다 — 무기 · 장비는
 * `like`가 상의의 외곽선 색을 복사해 오므로 같은 색이 된다.
 *
 * @param hull 분류별 폭과 조명 섞임
 * @param gear 장비(`GEAR`)의 툰 값
 * @param bodyHull 거짓이면 몸의 헐을 끈다. 가림 탐침용이고, VRoid 기본값(0.8mm)도 남기지 않도록 `none`을 준다
 */
export function hullMaterials(
  hull: IHull,
  gear: Record<string, unknown>,
  bodyHull = true,
): Record<string, Record<string, unknown>> {
  const { widths, lightingMix } = hull;
  const entry = (width: number | null | undefined): Record<string, unknown> =>
    width == null
      ? { outline_mode: 'none' }
      : {
          outline_mode: 'worldCoordinates',
          outline_width: width,
          outline_lighting_mix: lightingMix,
        };
  const materials: Record<string, Record<string, unknown>> = { GEAR: gear };
  materials['*'] = bodyHull ? entry(widths['*']) : { outline_mode: 'none' };
  for (const [klass, width] of Object.entries(widths)) {
    if (klass !== '*') materials[klass] = entry(width);
  }
  materials.WEAPON = { ...WEAPON_TOON, ...entry(widths.WEAPON ?? widths['*']) };
  materials.GEAR = { ...gear, ...entry(widths.GEAR ?? widths['*']) };
  return materials;
}

/**
 * 금속용 matcap. 구 법선에 따라 따뜻한 반사점 하나와 약한 보조 반사, 넓은 그라디언트를 준다.
 *
 * 애드온의 matcap 항은 더해지기만 해서 어둡게는 못 하므로(`toon.py`) 어두운 면은 `shade_ratio`가 만들고,
 * 여기서는 밝은 반사만 든다. 원 밖은 검정(효과 없음)이다. 값을 파일로 두지 않고 만드는 이유는 산출물
 * 자리가 추적되지 않는 폴더라서다.
 */
export function metalMatcap(size: number): IRgbaImage {
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

/** 카메라 고도(도) — 15° 내려다본다. 0 · 15 · 30 · 45 후보를 본 사용자가 골랐다(2026-09-17) */
export const CHOSEN_PITCH = 15;

/**
 * 발밑 마법진의 지름을 캐릭터 키의 몇 배로 하나. 참고 그림은 두 배쯤이었는데 후보를 본 사용자가 절반(키와 같게)
 * 으로 정했다(2026-09-17). 마법진은 프레임에 굽지 않고 게임이 별도 노드로 얹는다 — 정원 텍스처를 자식으로 두고
 * 부모의 세로 배율을 sin(`CHOSEN_PITCH`)로 눌러 타원으로 만든다.
 */
export const CIRCLE_DIAMETER_PER_HEIGHT = 1.0;
