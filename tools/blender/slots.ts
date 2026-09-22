/**
 * 슬롯 범위 탐침(G4 §12)의 실행기 — **출하하지 않는 시험 굽기다.**
 *
 * v1은 몸 · 상의 · 지팡이 · 방패 다섯 층으로 출하한다. 이 실행기는 그 밖의 슬롯(하의 · 신발 · 머리카락 …)을 층으로
 * 떼는 것이 이 굽기에서 되는지, 뗀 층끼리의 앞뒤를 겹치는 순서만으로 풀 수 있는지를 시험으로 굽고 잰다. 재는 식은
 * 생산 굽기의 가림 판 채택(G4 §5.1)과 같다 — 층을 겹친 그림을 가림 없이 한 장으로 구운 기준 컷과 견줘 구멍과 앞에
 * 잘못 보인 픽셀을 센다(`LayerBake.ts`의 `stackVerdict`). 남기는 것은 규칙이고, 구운 그림은 추적하지 않는
 * `docs/temp/3d-gate/g4/slots/`에 둔다.
 *
 * 돌리는 법 (레포 루트에서):
 *
 *   BLENDER='C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' \
 *     node --experimental-strip-types tools/blender/slots.ts bake
 *
 *   bake      경우마다 층과 기준 컷을 네 방향으로 굽는다. `--only <경우>`로 하나만 굽는다
 *   judge     굽지 않고, 구운 것을 겹치는 순서 후보마다 기준 컷과 견줘 찍는다. `--only <경우>`
 *   page      굽지도 재지도 않고, 순서 후보와 기준 컷을 나란히 재생하는 화면(`index.html`)을 쓴다. `--only <경우>`
 *
 *   --model-dir <폴더>  생산 `.vrm`이 있는 폴더(기본은 `bake.ts`와 같다)
 *
 * 카메라는 생산 굽기의 기록(`camera.json`)을 그대로 쓴다. 탐침의 층이 생산 층과 같은 크기 · 자리로 구워져야
 * 잰 값이 생산 굽기에 그대로 옮겨진다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_FRAME_SPEC } from '../../tests/helpers/FrameSet.ts';
import type { IRgbaImage } from '../../tests/helpers/SpriteMetrics.ts';
import { decodePng } from '../art/PngCodec.ts';
import { frameName, parseFrameName } from './Atlas.ts';
import { SHIELD_ROUND, STAFF_ORB } from './BakeSpec.ts';
import { runBlender, runPool, writeJson } from './BlenderRun.ts';
import {
  alphaSpill,
  BAKE_FACINGS,
  bakeMotionArgs,
  bakeToon,
  centerOnCanvas,
  gearFollow,
  type ICameraRecord,
  type ICanvas,
  type IGearFrame,
  layerBakeJobs,
  layerCanvas,
  layerSetCheck,
  REFERENCE_LAYER,
  stackVerdict,
} from './LayerBake.ts';
import {
  BULKY_PANTS,
  BULKY_PANTS_CUT,
  CAPE,
  LONG_BOOTS,
  mergeGear,
  SHIELD_HORNED,
  SHIELD_TALL,
  WIDE_SLEEVES,
} from './SlotSpec.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 구운 그림의 자리. 추적되지 않는 스크래치다. */
const SCRATCH = 'docs/temp/3d-gate/g4/slots';

/** 생산 `.vrm`의 기본 자리 — `bake.ts`와 같다. */
const DEFAULT_MODEL_DIR = 'cloud-storage/art/production/player/2026-09-16-player-3d';

/** 채널 차가 이 값을 넘어야 다른 픽셀로 센다 — 생산 굽기의 비교(`bake.ts compare`)와 같은 문턱이다. */
const DIFF_THRESHOLD = 12;

/** 경우가 쓰는 모델 판의 절대 경로. */
type Models = Record<'base' | 'topA', string>;

/** 굽기 인자를 짤 때 경우가 받는 경로들. */
interface ISlotPaths {
  models: Models;
  /** 경우가 `specs`에 선언한 사양을 JSON으로 쓴 파일의 절대 경로 — 이름은 선언한 이름 그대로다 */
  specs: Record<string, string>;
}

/** 기준 컷 하나 — 같은 것을 가림 없이 한 장으로 굽는다. */
interface ISlotReference {
  /** `--vrm`으로 들여올 판. 층은 늘 맨살 판에서 굽지만 기준 컷은 옷을 입은 판을 통째로 구울 수 있다 */
  model: keyof Models;
  args: (paths: ISlotPaths) => string[];
}

/** 탐침 한 경우 — 무엇을 층으로 떼어 굽고, 무엇과 견주고, 어떤 순서 후보를 재는가. */
interface ISlotCase {
  id: string;
  /** 이 경우가 가르려는 것 */
  what: string;
  /** 굽는 쪽에 JSON으로 넘길 장비 · 무기 사양(`SlotSpec.ts` · `BakeSpec.ts`). 이름이 파일 이름이 된다 */
  specs?: Record<string, unknown>;
  /** 층마다 `bake_motion.py`에 넘기는 인자. 이름은 프레임 이름의 층 자리에 들어가므로 영문자와 숫자만 쓴다 */
  layers: Record<string, (paths: ISlotPaths) => string[]>;
  /**
   * 기준 컷. 이름이 층과 같은 자리(폴더 · 프레임 이름)에 들어가므로 층 이름과 겹치면 안 된다.
   *
   * 여럿인 것은 한 경우가 같은 층을 서로 다른 조합으로 재기 때문이다 — 머리카락을 켠 합성과 끈 합성은 층을
   * 같이 쓰고 기준 컷만 다르다. 경우를 둘로 나누면 같은 층을 두 번 굽는다.
   */
  references: Record<string, ISlotReference>;
  /** 잴 것 — 어느 기준 컷에 어떤 겹치는 순서(아래부터)들을 견주나 */
  judgments: { reference: string; orders: string[][] }[];
}

/** 몸 메시에서 지워 맨몸을 남길 옷의 머티리얼. 하의 · 신발을 층으로 떼는 경우들이 나눠 쓴다. */
const STRIPPED = ['--drop-materials', 'Bottoms,Shoes'];

/** 머리카락 오브젝트를 지운다 — 머리카락 없는 몸 층 · 가림 전용 몸 · 기준 컷을 세운다. */
const HAIRLESS = ['--drop-objects', 'Hair'];

const CASES: ISlotCase[] = [
  {
    id: 'bottomsShoes',
    what: '기본 하의 · 신발을 머티리얼로 골라 층으로 떼어도 걷는 동안 몸과 어긋나지 않는가, 둘의 앞뒤는 어느 쪽인가',
    layers: {
      // 맨살 판의 몸 메시에서 옷의 면을 지운 맨몸. 옷을 전부 끈 판을 안 쓰는 이유는 `bake_motion.py`의
      // `drop_materials`가 든다(그 판은 신발 밑창만큼 내려가 있고 발 모양이 다르다)
      bodyBare: () => ['--layer', 'body', ...STRIPPED],
      bottoms: ({ models }) => [
        '--layer',
        'top',
        '--top-vrm',
        models.base,
        '--keep-material',
        'Bottoms',
        ...STRIPPED,
      ],
      shoes: ({ models }) => [
        '--layer',
        'top',
        '--top-vrm',
        models.base,
        '--keep-material',
        'Shoes',
        ...STRIPPED,
      ],
    },
    references: { whole: { model: 'base', args: () => ['--layer', REFERENCE_LAYER] } },
    judgments: [
      {
        reference: 'whole',
        orders: [
          ['bodyBare', 'bottoms', 'shoes'],
          ['bodyBare', 'shoes', 'bottoms'],
        ],
      },
    ],
  },
  {
    id: 'hair',
    what: '머리카락을 몸 뒤 · 몸 앞 두 층으로 갈라 겹친 것이 기준 컷과 같은가, 머리카락 없는 가림 몸으로 구운 상의에 구멍이 없는가',
    layers: {
      bodyNoHair: () => ['--layer', 'body', ...HAIRLESS],
      // 가림 전용 몸에서 머리카락을 뺀 상의. 생산 굽기의 상의(`topHeld`)는 머리카락에 가린 자리가 비어 있다
      top: ({ models }) => ['--layer', 'top', '--top-vrm', models.topA, ...HAIRLESS],
      topHeld: ({ models }) => ['--layer', 'top', '--top-vrm', models.topA],
      hairFront: () => ['--layer', 'hair', '--split-keep', 'near'],
      // 몸 아래에 깔리는 층은 가림 없이 굽는다. 가려 구운 판(`hairBackHeld`)과 견줘 어느 쪽이 나은지 잰다
      hairBack: () => ['--layer', 'hair', '--split-keep', 'far', '--unoccluded', '1'],
      hairBackHeld: () => ['--layer', 'hair', '--split-keep', 'far'],
      // 가르지 않은 머리카락 — 가르지 않으면 어디서 깨지는지를 재는 대조군이다
      hairWhole: () => ['--layer', 'hair'],
    },
    references: {
      whole: { model: 'topA', args: () => ['--layer', REFERENCE_LAYER] },
      wholeNoHair: { model: 'topA', args: () => ['--layer', REFERENCE_LAYER, ...HAIRLESS] },
    },
    judgments: [
      {
        reference: 'whole',
        orders: [
          ['hairBack', 'bodyNoHair', 'top', 'hairFront'],
          ['hairBackHeld', 'bodyNoHair', 'top', 'hairFront'],
          ['bodyNoHair', 'top', 'hairWhole'],
          ['bodyNoHair', 'hairWhole', 'top'],
        ],
      },
      {
        reference: 'wholeNoHair',
        orders: [
          ['bodyNoHair', 'top'],
          ['bodyNoHair', 'topHeld'],
        ],
      },
    ],
  },
  {
    id: 'pantsBoots',
    what: '부피 있는 하의와 긴 부츠의 앞뒤를 아이템이 든 그리기 순서만으로 풀 수 있는가, 못 풀면 하의를 긴 신발용으로 자른 변형으로 풀리는가',
    specs: {
      pants: BULKY_PANTS,
      pantsCut: BULKY_PANTS_CUT,
      boots: LONG_BOOTS,
      over: mergeGear('over', BULKY_PANTS, LONG_BOOTS),
      tucked: mergeGear('tucked', BULKY_PANTS_CUT, LONG_BOOTS),
    },
    layers: {
      bodyBare: () => ['--layer', 'body', ...STRIPPED],
      pants: gearLayer('pants'),
      pantsCut: gearLayer('pantsCut'),
      boots: gearLayer('boots'),
      // 서로를 가림 전용으로 둔 판 — 짝마다 따로 굽는다(하의 N × 신발 M). 이름은 「무엇 X 무엇에 가려」다
      pantsXboots: gearLayer('pants', 'boots'),
      bootsXpants: gearLayer('boots', 'pants'),
      pantsCutXboots: gearLayer('pantsCut', 'boots'),
      bootsXpantsCut: gearLayer('boots', 'pantsCut'),
    },
    references: {
      // 바지가 부츠를 덮는다 — 온전한 바지를 그대로 입는다
      wholeOver: wholeWith({ gear: 'over' }),
      // 바지를 부츠 안에 넣는다 — 3D에서 부츠 안의 바지는 안 보이므로 자른 바지로 세운다
      wholeTucked: wholeWith({ gear: 'tucked' }),
    },
    judgments: [
      {
        reference: 'wholeOver',
        orders: [
          ['bodyBare', 'boots', 'pants'],
          ['bodyBare', 'pants', 'boots'],
          ['bodyBare', 'bootsXpants', 'pantsXboots'],
        ],
      },
      {
        reference: 'wholeTucked',
        orders: [
          // 하의의 굽기는 하나이고 순서만 아이템이 든다 → 굵은 바지가 부츠 통 밖으로 남는다
          ['bodyBare', 'pants', 'boots'],
          // 하의를 긴 신발용으로 자른 변형을 하나 더 굽는다
          ['bodyBare', 'pantsCut', 'boots'],
          ['bodyBare', 'boots', 'pantsCut'],
          ['bodyBare', 'bootsXpantsCut', 'pantsCutXboots'],
        ],
      },
    ],
  },
  {
    id: 'narrowPantsBoots',
    what: '통이 좁은 기본 하의를 긴 부츠 안에 넣어 신으면 그리기 순서만으로 되는가 — 부피 있는 하의에서 안 된 것이 부츠 탓인지 하의의 부피 탓인지를 가른다',
    specs: { boots: LONG_BOOTS },
    layers: {
      bodyBare: () => ['--layer', 'body', ...STRIPPED],
      bottoms: ({ models }) => [
        '--layer',
        'top',
        '--top-vrm',
        models.base,
        '--keep-material',
        'Bottoms',
        ...STRIPPED,
      ],
      boots: gearLayer('boots'),
    },
    references: {
      // 기본 하의는 입은 채로 신발만 벗기고 부츠를 신긴다
      whole: {
        model: 'base',
        args: ({ specs }) => [
          '--layer',
          REFERENCE_LAYER,
          '--gear-spec',
          specs.boots,
          '--drop-materials',
          'Shoes',
        ],
      },
    },
    judgments: [
      {
        reference: 'whole',
        orders: [
          ['bodyBare', 'bottoms', 'boots'],
          ['bodyBare', 'boots', 'bottoms'],
        ],
      },
    ],
  },
  shieldCase(),
  {
    id: 'sleevesWeapons',
    what: '넓은 소매의 상의가 맨살 몸의 윤곽 밖에서 지팡이 · 방패와 만나도 방향별 겹치는 순서(STACK_ORDER) 그대로 되는가',
    specs: { sleeves: WIDE_SLEEVES, staff: STAFF_ORB, shield: SHIELD_ROUND },
    layers: {
      // 생산 굽기와 같은 몸이다 — 머리카락 · 하의 · 신발이 든 맨살 판을 그대로 가림 전용으로 둔다
      body: () => ['--layer', 'body'],
      // 소매는 상의의 일부라 상의의 면과 한 층으로 굽는다. 따로 구우면 소매와 몸판 사이의 앞뒤가 잰 값에 섞여
      // 무기와의 앞뒤를 가린다(처음 그렇게 구웠더니 뒷모습을 뺀 세 방향에서 어느 순서로든 소매 층에
      // 2,700 ~ 4,300px가 깔렸다)
      top: ({ models, specs }) => [
        '--layer',
        'top',
        '--top-vrm',
        models.topA,
        '--gear-spec',
        specs.sleeves,
      ],
      staff: ({ specs }) => ['--layer', 'staff', '--staff-spec', specs.staff],
      shield: ({ specs }) => ['--layer', 'shield', '--shield-spec', specs.shield],
    },
    references: {
      whole: {
        model: 'topA',
        args: ({ specs }) => [
          '--layer',
          REFERENCE_LAYER,
          '--gear-spec',
          specs.sleeves,
          '--staff-spec',
          specs.staff,
          '--shield-spec',
          specs.shield,
        ],
      },
    },
    // 몸 위 세 층의 순서 여섯 가지를 전부 잰다 — 생산 층의 순서를 고를 때와 같은 방법이다(G4 §5.1)
    judgments: [
      {
        reference: 'whole',
        orders: permutations(['top', 'staff', 'shield']).map((order) => ['body', ...order]),
      },
    ],
  },
];

/** 이름들을 늘어놓는 모든 순서. */
function permutations(names: readonly string[]): string[][] {
  if (names.length <= 1) return [[...names]];
  return names.flatMap((first, at) =>
    permutations(names.filter((_, i) => i !== at)).map((rest) => [first, ...rest]),
  );
}

/**
 * 장비 하나를 맨몸(`STRIPPED`)으로 가려 굽는 층의 인자. `spec`은 경우의 `specs`에 선언한 이름이다.
 *
 * @param occluder 가림 전용으로 함께 세울 장비의 이름. 주면 그 장비에 가린 픽셀도 지워진다
 */
function gearLayer(spec: string, occluder?: string): (paths: ISlotPaths) => string[] {
  return ({ specs }) => [
    '--layer',
    'gear',
    '--gear-spec',
    specs[spec],
    ...(occluder ? ['--occluder-gear-spec', specs[occluder]] : []),
    ...STRIPPED,
  ];
}

/**
 * 맨몸에 장비 · 방패를 들려 가림 없이 한 장으로 굽는 기준 컷. 상의가 상대면 상의 A를 입은 판을 굽는다 —
 * 상의는 장비 사양이 아니라 모델 판에 들어 있다.
 */
function wholeWith(held: { gear?: string; shield?: string; top?: boolean }): ISlotReference {
  return {
    model: held.top ? 'topA' : 'base',
    args: ({ specs }) => [
      '--layer',
      REFERENCE_LAYER,
      ...(held.gear ? ['--gear-spec', specs[held.gear]] : []),
      ...(held.shield ? ['--shield-spec', specs[held.shield]] : []),
      ...STRIPPED,
    ],
  };
}

/**
 * 특이한 방패 둘을 상대 넷(상의 · 부피 있는 하의 · 긴 부츠 · 망토)과 **짝마다** 재는 경우.
 *
 * 전부를 한 번에 겹쳐 방패의 자리만 옮겨 가며 재지 않는 이유는 어느 상대에서 깨지는지가 안 갈리기 때문이다.
 * 상대끼리의 앞뒤(하의와 부츠, 망토와 상의)가 내는 차이가 방패와 무관하게 깔려서, 방패의 자리를 옮겨도 남는
 * 값이 방패의 것인지 알 수 없다. 짝마다 기준 컷을 따로 구우면 그 짝의 앞뒤만 남는다. 층은 짝들이 나눠 쓴다 —
 * 방패 층은 어느 상대와 재든 맨몸으로 가려 구운 하나다(그것이 「조합마다 굽지 않는다」의 뜻이다).
 */
function shieldCase(): ISlotCase {
  const shields = ['shieldTall', 'shieldHorned'];
  const partners = ['top', 'pants', 'boots', 'cape'];
  const pairs = shields.flatMap((shield) => partners.map((partner) => ({ shield, partner })));
  // 기준 컷의 이름도 프레임 이름에 들어가므로 영문자와 숫자만 쓴다
  const referenceName = (pair: { shield: string; partner: string }) =>
    `whole${pair.shield.replace('shield', '')}${pair.partner[0].toUpperCase()}${pair.partner.slice(1)}`;
  return {
    id: 'shields',
    what: '세로로 긴 방패 · 뿔이 난 방패가 상의 · 부피 있는 하의 · 긴 부츠 · 망토와 만날 때 방향별 겹치는 순서 하나로 되는가',
    specs: {
      pants: BULKY_PANTS,
      boots: LONG_BOOTS,
      cape: CAPE,
      shieldTall: SHIELD_TALL,
      shieldHorned: SHIELD_HORNED,
    },
    layers: {
      bodyBare: () => ['--layer', 'body', ...STRIPPED],
      top: ({ models }) => ['--layer', 'top', '--top-vrm', models.topA, ...STRIPPED],
      pants: gearLayer('pants'),
      boots: gearLayer('boots'),
      cape: gearLayer('cape'),
      ...Object.fromEntries(
        shields.map((shield) => [
          shield,
          ({ specs }: ISlotPaths) => [
            '--layer',
            'shield',
            '--shield-spec',
            specs[shield],
            ...STRIPPED,
          ],
        ]),
      ),
    },
    references: Object.fromEntries(
      pairs.map((pair) => [
        referenceName(pair),
        pair.partner === 'top'
          ? wholeWith({ shield: pair.shield, top: true })
          : wholeWith({ shield: pair.shield, gear: pair.partner }),
      ]),
    ),
    judgments: pairs.map((pair) => ({
      reference: referenceName(pair),
      orders: [
        ['bodyBare', pair.partner, pair.shield],
        ['bodyBare', pair.shield, pair.partner],
      ],
    })),
  };
}

/** 명령줄 인자에서 `--name 값`을 읽는다. */
function option(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

/** 돌릴 경우들. `--only`가 모르는 이름이면 아는 이름을 말하며 던진다. */
function chosenCases(): ISlotCase[] {
  const only = option('only');
  if (!only) return CASES;
  const found = CASES.filter((each) => each.id === only);
  if (found.length === 0) {
    throw new Error(
      `경우를 모른다: ${only} — ${CASES.map((each) => each.id).join(' · ')} 중 하나를 준다`,
    );
  }
  return found;
}

/** 모델 판의 절대 경로. 없으면 어디 있어야 하는지 말하며 던진다. */
function modelPaths(): Models {
  const dir = path.resolve(ROOT, option('model-dir') ?? DEFAULT_MODEL_DIR);
  const models: Models = {
    base: path.join(dir, 'player_base.vrm'),
    topA: path.join(dir, 'player_top_a.vrm'),
  };
  for (const file of Object.values(models)) {
    if (!fs.existsSync(file)) {
      throw new Error(
        `생산 .vrm이 없다: ${file}\n  커밋하지 않는 파일이다. 다른 자리에 있으면 --model-dir로 준다.`,
      );
    }
  }
  return models;
}

/** 생산 굽기의 카메라 기록. */
function readCameraRecord(): ICameraRecord {
  const file = path.join(ROOT, 'tools/blender/camera.json');
  if (!fs.existsSync(file)) throw new Error('카메라 기록이 없다 — `bake.ts camera`를 먼저 돌린다');
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as ICameraRecord;
}

/** 탐침의 캔버스 — 생산 굽기에서 층을 겹쳐 재는 캔버스(무기 층의 것)와 같다. 장비가 몸 캔버스를 넘을 수 있다. */
function probeCanvas(record: ICameraRecord): ICanvas {
  return layerCanvas('staff', record.bodyCanvas);
}

/** 한 방향에서 굽는 프레임의 자세. 생산 굽기와 같은 함수에서 낸다 — 자세가 다르면 잰 값을 옮길 수 없다. */
function facingPoses(facing: string) {
  const job = layerBakeJobs().find((each) => each.layer === 'body' && each.facing === facing);
  if (!job) throw new Error(`굽는 방향에 ${facing}이 없다`);
  return job;
}

/** 자세에 그 층의 이름을 붙인다. */
function namedFor(layer: string, facing: string) {
  return facingPoses(facing).frames.map((frame) => {
    const parts = parseFrameName(frame.name);
    if (!parts) throw new Error(`프레임 이름이 규칙에 안 맞는다: ${frame.name}`);
    return { ...frame, name: frameName(layer, parts.action, facing, parts.index) };
  });
}

/** 경우마다 층과 기준 컷을 네 방향으로 굽고, 구운 세트가 비지 않았고 캔버스 변에 안 닿았는지 본다. */
async function commandBake(): Promise<void> {
  const models = modelPaths();
  const record = readCameraRecord();
  const canvas = probeCanvas(record);

  for (const item of chosenCases()) {
    const outDir = path.join(ROOT, SCRATCH, item.id);
    fs.rmSync(outDir, { recursive: true, force: true });
    const camera = writeJson(path.join(outDir, 'specs', 'camera.json'), {
      pitch_deg: record.camera.pitchDeg,
      aim_z: record.camera.aimZ,
      per_pixel_m: record.camera.perPixelM,
      blender: record.inputs.blender,
      vrm_addon: record.inputs.vrmAddon,
    });
    const toon = writeJson(path.join(outDir, 'specs', 'toon.json'), bakeToon());
    // 장비 · 무기 사양은 카메라 · 툰 사양과 폴더를 나눈다 — 같은 폴더면 `camera`라는 이름의 사양이 카메라 기록을 덮는다
    const paths: ISlotPaths = {
      models,
      specs: Object.fromEntries(
        Object.entries(item.specs ?? {}).map(([name, spec]) => [
          name,
          writeJson(path.join(outDir, 'specs', 'gear', `${name}.json`), spec),
        ]),
      ),
    };

    const clash = Object.keys(item.references).filter((name) => name in item.layers);
    if (clash.length > 0) {
      throw new Error(`${item.id}: 기준 컷의 이름이 층과 겹친다 — ${clash.join(' · ')}`);
    }
    const bakes = [
      ...Object.entries(item.layers).map(([layer, args]) => ({
        layer,
        vrm: models.base,
        extra: args(paths),
      })),
      ...Object.entries(item.references).map(([layer, reference]) => ({
        layer,
        vrm: models[reference.model],
        extra: reference.args(paths),
      })),
    ];
    const jobs = bakes.flatMap(({ layer, vrm, extra }) =>
      BAKE_FACINGS.map((facing) => async () => {
        const frames = namedFor(layer, facing.id);
        const definition = writeJson(path.join(outDir, 'defs', `${layer}_${facing.id}.json`), {
          id: `${layer}_${facing.id}`,
          frames,
        });
        const dir = path.join(outDir, layer, facing.id);
        const baked = await runBlender(
          path.join(ROOT, 'tools/blender/bake_motion.py'),
          bakeMotionArgs({
            vrm,
            frames: definition,
            outDir: dir,
            yaw: facing.yaw,
            camera,
            toon,
            canvas,
            extra,
          }),
          `${item.id} ${layer}/${facing.id}`,
        );
        const images = frames.map((frame) => readFrame(dir, frame.name));
        return [
          ...layerSetCheck(images, { count: frames.length, canvas }),
          ...gearFollowProblems(baked),
        ].map((problem) => `${layer}/${facing.id}: ${problem}`);
      }),
    );

    console.log(`${item.id} — 굽기 ${jobs.length}건`);
    const started = Date.now();
    const problems = (await runPool(jobs)).flat();
    console.log(`  ${Math.round((Date.now() - started) / 1000)}초`);
    if (problems.length > 0) {
      for (const problem of problems) console.error(`✗ ${problem}`);
      throw new Error(`${item.id}: 구운 세트 ${problems.length}건이 검사에서 떨어졌다`);
    }
  }
  console.log(`✓ ${SCRATCH}`);
}

/** 장비가 붙은 본에서 떨어져도 되는 폭(m). 굽는 쪽이 좌표를 소수 다섯 자리로 반올림하므로 그 자릿수의 몇 배다. */
const GEAR_FOLLOW_TOLERANCE_M = 1e-4;

/**
 * 굽는 쪽이 돌려준 값에서, 세운 장비 조각마다 붙은 본을 회전까지 따라갔는지 본다(`gearFollow`). 안 따라간 조각은
 * 걷는 동안 다리를 뚫고 나오는데, 그 그림도 층과 기준 컷에서 똑같이 틀려서 견주는 값에는 안 드러난다.
 */
function gearFollowProblems(baked: Record<string, unknown>): string[] {
  const names = (baked.gear as string[] | undefined) ?? [];
  const frames = baked.frames as IGearFrame[];
  return names.flatMap((name) => {
    const { spread } = gearFollow(frames, name);
    return spread > GEAR_FOLLOW_TOLERANCE_M
      ? [
          `장비 ${name}이 붙은 본에서 ${(spread * 1000).toFixed(2)}mm 떨어졌다 — 본을 따라가지 않았다`,
        ]
      : [];
  });
}

/** 구운 프레임 한 장을 읽는다. */
function readFrame(dir: string, name: string): IRgbaImage {
  const file = path.join(dir, `${name}.png`);
  if (!fs.existsSync(file))
    throw new Error(`구운 프레임이 없다: ${file} — \`slots.ts bake\`를 먼저 돌린다`);
  return decodePng(fs.readFileSync(file));
}

/** 겹치는 순서 하나를 한 방향에서 잰 값 — 그 방향 11장의 합계다. `judge`가 쓰고 `page`가 읽는다. */
interface IJudgedOrder {
  reference: string;
  order: string[];
  facing: string;
  holes: number;
  /** 층별 「앞에 잘못 보임」 */
  misdrawn: Record<string, number>;
  unmatched: number;
  spill: number;
  /** 구멍과 「앞에 잘못 보임」이 가장 많은 장 */
  worst: { frame: string; pixels: number };
}

/**
 * 구운 그림 1px이 720p 게임 화면에서 차지하는 크기. 게임이 그리는 플레이어 높이 77단위(G5 §2.6, 720p에서 1단위가
 * 1px)를 기준 캔버스 높이로 나눈 값이다. `bake.ts`의 합성 화면이 같은 77을 쓴다 — 그 파일은 불러오면 명령이
 * 돌아서 값을 가져올 수 없다.
 */
const GAME_SCALE = 77 / PLAYER_FRAME_SPEC.height;

/**
 * `page`가 쓰는 화면. `__DATA__` 자리에 경우 · 프레임 · 잰 값이 JSON으로 들어간다.
 *
 * 한 칸은 층 그림을 순서대로 같은 캔버스에 포갠 것이고, 뒤에 그리는 그림이 위에 오므로 그것이 곧 게임의 형제
 * 순서다. 게임 크기 보기는 브라우저가 줄인 그림이라 엔진의 축소와 픽셀까지 같지는 않다 — 눈에 띄는 크기인지를
 * 보는 데 쓴다.
 *
 * **한 장의 층은 전부 읽힌 뒤에 한 번에 그린다.** 처음에는 층마다 `<img>`를 두고 틱마다 `src`를 바꿨는데, 바지
 * 그림이 아직 안 읽힌 틱에 몸 그림만 먼저 바뀌면 그 틱에 맨다리가 보였다(2026-09-21 사용자 관찰 — 구운 데이터는
 * 장마다 하의 층이 고르게 차 있어 데이터의 문제가 아니었다). 그래서 그림을 미리 읽어 들고, 그 장의 층 가운데 하나라도
 * 안 읽혔으면 그 틱은 그리지 않고 앞 틱의 그림을 둔다. 화면에 보이는 칸만 그린다 — 칸이 200개를 넘는다.
 */
const PAGE_TEMPLATE = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>슬롯 범위 탐침 — 순서 후보와 기준 컷</title>
<style>
  body { margin: 16px; background: #2b2f36; color: #e6e6e6; font: 13px/1.5 system-ui, sans-serif; }
  h2 { margin: 28px 0 4px; font-size: 16px; } h3 { margin: 16px 0 6px; font-size: 13px; color: #9fc3ff; }
  .bar { position: sticky; top: 0; z-index: 9; padding: 8px 0; background: #2b2f36; }
  .bar label { margin-right: 14px; }
  .row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
  .cell { background: #3a4a3a; padding: 6px; border-radius: 4px; }
  .cell.reference { background: #4a3f5a; }
  .view { display: block; }
  .cap { max-width: 400px; margin-top: 4px; font-size: 12px; color: #cfd6df; }
  .cap b { color: #fff; } .num { color: #ffd479; }
</style></head><body>
<div class="bar">
  <label><input type="radio" name="action" value="walk" checked> 걷기</label>
  <label><input type="radio" name="action" value="idle"> 대기</label>
  <label><input type="radio" name="scale" value="1" checked> 원본</label>
  <label><input type="radio" name="scale" value="game3"> 720p 게임 크기 ×3</label>
  <label><input type="radio" name="scale" value="game"> 720p 게임 크기</label>
  <label><input type="checkbox" id="paused"> 멈춤 (←/→로 한 장씩)</label>
  <span id="frameLabel"></span>
</div>
<div id="root"></div>
<script>
const DATA = __DATA__;
const state = { action: 'walk', scale: '1', tick: 0, paused: false };
const views = [];
const FACING_LABEL = { front: '정면', right: '오른쪽', back: '뒤', left: '왼쪽' };

function scaleValue() {
  if (state.scale === 'game') return DATA.gameScale;
  if (state.scale === 'game3') return DATA.gameScale * 3;
  return 1;
}
function framesOf(facing) { return DATA.frames[facing].filter((f) => f.action === state.action); }
function src(caseId, layer, facing, frame) {
  const name = layer + '_' + frame.action + '_' + facing + '_' + String(frame.index).padStart(2, '0');
  return caseId + '/' + layer + '/' + facing + '/' + name + '.png';
}
// 경로 → Image. 같은 그림을 여러 칸이 쓰므로 한 번만 읽는다
const images = new Map();
function imageAt(path) {
  let img = images.get(path);
  if (!img) { img = new Image(); img.src = path; images.set(path, img); }
  return img;
}
function loaded(img) { return img.complete && img.naturalWidth > 0; }
const watcher = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const view = views.find((each) => each.canvas === entry.target);
    if (!view) continue;
    view.visible = entry.isIntersecting;
    if (view.visible) drawView(view);
  }
}, { rootMargin: '300px' });
function addView(parent, caseId, layers, facing) {
  const canvas = document.createElement('canvas');
  canvas.className = 'view';
  parent.appendChild(canvas);
  const view = { canvas, ctx: canvas.getContext('2d'), caseId, layers, facing, visible: false, drawn: '' };
  views.push(view);
  sizeCanvas(view);
  watcher.observe(canvas);
  // 이 칸이 쓸 그림을 전부 미리 읽어 둔다 — 걷기 · 대기 모두
  for (const frame of DATA.frames[facing]) for (const layer of layers) imageAt(src(caseId, layer, facing, frame));
}
function sizeCanvas(view) {
  const scale = scaleValue();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(DATA.window.width * scale);
  const height = Math.round(DATA.window.height * scale);
  view.canvas.style.width = width + 'px';
  view.canvas.style.height = height + 'px';
  view.canvas.width = Math.round(width * dpr);
  view.canvas.height = Math.round(height * dpr);
}
function drawView(view) {
  const frames = framesOf(view.facing);
  const frame = frames[state.tick % frames.length];
  const key = state.action + ':' + frame.index + ':' + state.scale;
  if (view.drawn === key) return;
  const layers = view.layers.map((layer) => imageAt(src(view.caseId, layer, view.facing, frame)));
  // 한 장이라도 아직 안 읽혔으면 이번 틱은 건너뛴다 — 층 하나가 빠진 그림을 한 틱이라도 보이지 않는다
  if (!layers.every(loaded)) return;
  if (view.drawn.split(':')[2] !== state.scale) sizeCanvas(view);
  const { canvas, ctx } = view;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sx = (DATA.canvas.width - DATA.window.width) / 2;
  const sy = (DATA.canvas.height - DATA.window.height) / 2;
  for (const img of layers) {
    ctx.drawImage(img, sx, sy, DATA.window.width, DATA.window.height, 0, 0, canvas.width, canvas.height);
  }
  view.drawn = key;
}
function draw() {
  for (const view of views) if (view.visible) drawView(view);
  const sample = framesOf('front');
  document.getElementById('frameLabel').textContent =
    state.action + ' ' + sample[state.tick % sample.length].index;
}
function build() {
  const root = document.getElementById('root');
  for (const item of DATA.cases) {
    const title = root.appendChild(document.createElement('h2'));
    title.textContent = item.id + ' — ' + item.what;
    for (const judgment of item.judgments) {
      for (const facing of Object.keys(DATA.frames)) {
        const head = root.appendChild(document.createElement('h3'));
        head.textContent = '기준 컷 ' + judgment.reference + ' · ' + FACING_LABEL[facing];
        const row = root.appendChild(document.createElement('div'));
        row.className = 'row';
        for (const order of judgment.orders) {
          const cell = row.appendChild(document.createElement('div'));
          cell.className = 'cell';
          addView(cell, item.id, order, facing);
          const cap = cell.appendChild(document.createElement('div'));
          cap.className = 'cap';
          const judged = item.report.find((r) => r.reference === judgment.reference
            && r.facing === facing && r.order.join() === order.join());
          const wrong = judged ? Object.values(judged.misdrawn).reduce((a, b) => a + b, 0) : null;
          cap.innerHTML = '<b>' + order.join(' → ') + '</b>' + (judged
            ? '<br>구멍 <span class="num">' + judged.holes + '</span> · 앞에 잘못 보임 <span class="num">'
              + wrong + '</span> · 삐져나옴 <span class="num">' + judged.spill
              + '</span><br>가장 나쁜 장 ' + judged.worst.frame + ' (' + judged.worst.pixels + 'px)'
            : '<br>(잰 값 없음 — judge를 먼저 돌린다)');
        }
        const cell = row.appendChild(document.createElement('div'));
        cell.className = 'cell reference';
        addView(cell, item.id, [judgment.reference], facing);
        const cap = cell.appendChild(document.createElement('div'));
        cap.className = 'cap';
        cap.innerHTML = '<b>기준 컷</b> — 가림 없이 한 장으로 구운 것';
      }
    }
  }
}
for (const name of ['action', 'scale']) {
  for (const input of document.querySelectorAll('input[name=' + name + ']')) {
    input.addEventListener('change', () => {
      state[name] = input.value;
      state.tick = 0;
      // 크기가 바뀌면 안 보이는 칸까지 먼저 새 크기로 비워 둔다 — 스크롤해 들어올 때 옛 크기의 그림이 잠깐 남지 않게
      if (name === 'scale') for (const view of views) { sizeCanvas(view); view.drawn = ''; }
      draw();
    });
  }
}
document.getElementById('paused').addEventListener('change', (e) => { state.paused = e.target.checked; });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  state.tick = Math.max(0, state.tick + (e.key === 'ArrowRight' ? 1 : -1));
  draw();
});
build();
draw();
setInterval(() => { if (!state.paused) { state.tick++; draw(); } }, 100);
</script></body></html>
`;

/**
 * 경우마다 겹치는 순서 후보를 기준 컷과 견줘 찍는다. 한 줄은 그 방향 11장의 합계다.
 *
 * 「앞에 잘못 보임」이 순서를 가르는 값이고, 「걷어내도 안 맞음」은 층을 따로 구워 겹치면 어느 순서에서든 윤곽을
 * 따라 나오는 차이다(G4 §5.1). 「삐져나옴」은 기준 컷이 빈 자리에 층이 그린 픽셀이다 — 순서를 어떻게 두든 남으므로
 * 이 값이 크면 그 층의 굽기(모양)를 바꿔야 한다(`alphaSpill`).
 */
function commandJudge(): void {
  const canvas = probeCanvas(readCameraRecord());
  for (const item of chosenCases()) {
    const outDir = path.join(ROOT, SCRATCH, item.id);
    const report: IJudgedOrder[] = [];
    console.log(`${item.id} — ${item.what}`);
    // 같은 층이 순서 후보마다 다시 쓰이므로 읽어 캔버스에 옮긴 그림을 들고 있는다
    const loaded = new Map<string, IRgbaImage>();
    const at = (layer: string, facing: string, action: string, index: number): IRgbaImage => {
      const name = frameName(layer, action, facing, index);
      let image = loaded.get(name);
      if (!image) {
        image = centerOnCanvas(readFrame(path.join(outDir, layer, facing), name), canvas);
        loaded.set(name, image);
      }
      return image;
    };
    for (const judgment of item.judgments) {
      console.log(`  기준 컷 ${judgment.reference}`);
      for (const order of judgment.orders) {
        console.log(`  순서 ${order.join(' → ')}`);
        for (const facing of BAKE_FACINGS) {
          let holes = 0;
          let unmatched = 0;
          let spill = 0;
          const misdrawn: Record<string, number> = Object.fromEntries(
            order.map((layer) => [layer, 0]),
          );
          let worst = { frame: '', pixels: 0 };
          for (const pose of facingPoses(facing.id).frames) {
            const parts = parseFrameName(pose.name);
            if (!parts) throw new Error(`프레임 이름이 규칙에 안 맞는다: ${pose.name}`);
            const reference = at(judgment.reference, facing.id, parts.action, parts.index);
            const layers = order.map((layer) => ({
              name: layer,
              image: at(layer, facing.id, parts.action, parts.index),
            }));
            const verdict = stackVerdict(layers, reference, DIFF_THRESHOLD);
            spill += alphaSpill(
              layers.map((layer) => layer.image),
              reference,
            );
            holes += verdict.holes;
            let here = verdict.holes;
            for (const layer of order) {
              misdrawn[layer] += verdict.misdrawn[layer];
              unmatched += verdict.unmatched[layer];
              here += verdict.misdrawn[layer];
            }
            if (here > worst.pixels)
              worst = { frame: `${parts.action} ${parts.index}`, pixels: here };
          }
          report.push({
            reference: judgment.reference,
            order,
            facing: facing.id,
            holes,
            misdrawn,
            unmatched,
            spill,
            worst,
          });
          const total = Object.values(misdrawn).reduce((a, b) => a + b, 0);
          console.log(
            `    ${facing.id.padEnd(5)} 구멍 ${String(holes).padStart(3)} · 앞에 잘못 보임 ${String(total).padStart(5)} (${order
              .map((layer) => `${layer} ${misdrawn[layer]}`)
              .join(
                ' · ',
              )}) · 가장 나쁜 장 ${worst.frame} ${worst.pixels}px · 걷어내도 안 맞음 ${unmatched} · 삐져나옴 ${spill}`,
          );
        }
      }
    }
    // 경우마다 따로 쓴다 — 한 파일에 쓰면 `--only`로 한 경우만 다시 쟀을 때 나머지 경우의 값이 지워진다
    writeJson(path.join(outDir, 'report.json'), report);
    console.log(`✓ ${SCRATCH}/${item.id}/report.json`);
  }
}

/** 화면이 그림을 잘라 보여 주는 창(px). 캔버스(600×701)의 가운데이고, 둘레는 어느 경우에도 비어 있다. */
const PAGE_WINDOW = { width: 400, height: 580 };

/**
 * 사람이 보는 화면을 쓴다 — 굽지도 재지도 않는다. 경우 · 기준 컷 · 방향마다, 겹치는 순서 후보들과 기준 컷을 나란히
 * 재생한다. 잰 값이 있으면(`judge`) 칸마다 함께 적는다.
 *
 * 수치는 순서를 가르지만 「게임 크기에서 눈에 띄는가」는 못 가른다. 그것은 사람이 보고 정하므로(인계 문서 §5),
 * 후보를 한 장씩 열어 보게 하지 않고 나란히 움직이는 채로 보인다. 층은 모두 같은 캔버스로 구워져 있어서 그림을
 * 같은 자리에 포개기만 하면 게임의 형제 순서가 된다 — 합성한 그림을 따로 쓰지 않는다.
 */
function commandPage(): void {
  const canvas = probeCanvas(readCameraRecord());
  const cases = chosenCases().map((item) => {
    const reportFile = path.join(ROOT, SCRATCH, item.id, 'report.json');
    const report: IJudgedOrder[] = fs.existsSync(reportFile)
      ? (JSON.parse(fs.readFileSync(reportFile, 'utf-8')) as IJudgedOrder[])
      : [];
    return { id: item.id, what: item.what, judgments: item.judgments, report };
  });
  const frames = Object.fromEntries(
    BAKE_FACINGS.map((facing) => [
      facing.id,
      facingPoses(facing.id).frames.map((frame) => {
        const parts = parseFrameName(frame.name);
        if (!parts) throw new Error(`프레임 이름이 규칙에 안 맞는다: ${frame.name}`);
        return { action: parts.action, index: parts.index };
      }),
    ]),
  );
  const data = { cases, frames, canvas, window: PAGE_WINDOW, gameScale: GAME_SCALE };
  const file = path.join(ROOT, SCRATCH, 'index.html');
  fs.writeFileSync(file, PAGE_TEMPLATE.replace('__DATA__', JSON.stringify(data)), 'utf-8');
  console.log(`✓ ${SCRATCH}/index.html`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'bake') return commandBake();
  if (command === 'judge') return commandJudge();
  if (command === 'page') return commandPage();
  throw new Error(`명령을 모른다: ${command ?? '(없음)'} — bake · judge · page 중 하나를 준다`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
