/**
 * 시트 셋을 출하용 열두 장으로 내보내는 실행기 — 이 폴더의 조각들을 잇는 자리다.
 *
 * 조각은 이미 다 있었다. 패널 분할은 `SheetCrop.ts`, 매팅 호출은 `FalMatting.ts`, 알파 정규화와
 * 정렬은 `Postprocess.ts`, 규격 판정은 `Shipping.ts`가 든다. **없던 것은 그 순서와, 한 번에
 * 열두 장을 갈아 끼우는 원자성이다.** 손으로 하면 순서가 어긋나거나 중간에 멈춰 절반만 새 판인
 * 상태가 남고, 그 상태는 방향을 바꿀 때만 드러나 한참 뒤에 발견된다.
 *
 * 돌리는 법:
 *
 * ```
 * node --experimental-strip-types tools/art/build.ts [--sheets <폴더>] [--dry-run]
 * ```
 *
 * `--sheets`는 시트 셋이 있는 폴더이고 기본값은 채택본이 사는 자리다. `--dry-run`은 매팅까지
 * 돌리고 규격 판정 결과만 찍는다 — 캐시가 차 있으면 과금 없이 규격을 미리 볼 수 있다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IRgbaImage } from '../../tests/helpers/SpriteMetrics.ts';
import { callsUsed, matte } from './FalMatting.ts';
import { assertNodeVersion } from './NodeVersion.ts';
import { decodePng, encodePng } from './PngCodec.ts';
import { alignToCanvas, normalizeAlpha } from './Postprocess.ts';
import { assertPanelGaps, cropColumns, panelColumns } from './SheetCrop.ts';
import { commitAll, type IShipItem, type IShippingSpec } from './Shipping.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * 시트 셋을 찾을 기본 폴더 — **채택본이 사는 자리 하나**다. `--sheets`로 다른 판을 가리킬 수 있다.
 *
 * 회차별 폴더를 두지 않는 이유는 폐기된 회차를 아무도 입력으로 쓰지 않기 때문이다. 채택하면
 * 이 자리를 덮어쓰고, 그러면 여기 있는 것이 항상 지금 게임이 딛고 선 판이 된다 —
 * 어느 폴더가 현재인지를 사람이 기억하지 않아도 된다.
 */
const DEFAULT_SHEET_DIR = 'art-source/player';

/** 채택 매팅 모델. 후보 둘을 패널 셋에 돌려 고른 결과이고 근거는 `judge.ts`가 낸 표에 있다. */
const MATTING_MODEL = 'fal-ai/bria/background/remove';

/** 출력 캔버스와 발 밑선 아래 여백. `art-asset-spec.md`가 소유하는 값이다. */
const CANVAS = { width: 246, height: 493, bottomMargin: 3 };

/**
 * 열두 장이 지켜야 하는 규격.
 *
 * 트림 세로 상한은 캔버스 세로에서 발 밑선 아래 여백을 뺀 값이다 — 발 밑선을 여백 위에 놓고도
 * 머리가 캔버스 안에 들어오려면 그림이 그보다 낮아야 한다.
 */
const SPEC: IShippingSpec = {
  width: CANVAS.width,
  height: CANVAS.height,
  baselineY: CANVAS.height - 1 - CANVAS.bottomMargin,
  // `alignToCanvas`가 발 중심을 맞추는 자리와 같은 식이어야 한다. 둘이 갈리면 정렬이 세운
  // 자리를 판정이 어긋났다고 읽는다.
  centerX: (CANVAS.width - 1) / 2,
  maxTrimHeight: CANVAS.height - CANVAS.bottomMargin,
  // 아래 셋은 장끼리 견주는 판정이 쓴다. 허용 비율의 근거는 `IShippingSpec`의 각 주석에 있고,
  // 둘 다 2026-08-24 리워크에서 실제로 나온 결함과 정상 편차 사이에서 골랐다.
  mirrorDirections: ['left', 'right'] as const,
  mirrorWidthTolerance: 0.05,
  figureHeightTolerance: 0.04,
};

/**
 * 패널 양옆으로 더 붙여 자를 열 수.
 *
 * 이유는 `ICropColumnsOptions`의 `margin` 주석이 든다. 값을 8로 잡은 것은 시트에서 인물 사이가
 * 가장 좁은 데가 28열이라 양쪽 8이면 12열이 남기 때문이다. 그보다 키우면 옆 인물이 딸려 들어올
 * 수 있어, 아래 `assertPanelsClear`가 실제 간격을 재서 막는다.
 */
const CROP_MARGIN = 8;

/**
 * 인물 구간을 찾는 기준.
 *
 * 거리와 최소 픽셀 수는 `judge.ts`와 같지만 **배경을 행마다 다시 잡는다.** 판정은 모델 비교용
 * 패널 셋만 보므로 그 시트들이 단색이면 그만이고, 여기는 앞으로 받을 시트를 전부 지나야 한다 —
 * 생성 모델이 균일한 배경을 준다는 보장이 없다. 이유와 실측은 `rowBackground`의 주석에 있다.
 */
const PANEL_DETECTION = { maxDistance: 24, minColumnPixels: 3, rowBackground: true };

/** 패널 순서 — 생성 프롬프트가 정한 front · back · left · right다. */
const DIRECTIONS = ['front', 'back', 'left', 'right'];

/**
 * 어느 시트가 어느 열두 장을 내는가.
 *
 * 옷 입은 판만 게임 폴더로 가고 나머지 여덟은 원본 폴더에 남는다. **여덟도 함께 갈아 끼우는
 * 이유는 그것이 v2 파츠 컷의 입력이기 때문이다** — 게임에 나가는 넷만 새로 뽑으면, 나중에
 * 파츠를 자를 때 옷과 맨살이 옛 판이라 새 몸과 안 맞는다.
 */
const SHEETS = [
  { file: '4dir_dressed_nostaff.png', dir: 'game/assets/art/player', prefix: 'player_4dir' },
  { file: '4dir_bald_nostaff.png', dir: 'art-source/player/base', prefix: 'player_bald' },
  { file: '4dir_skin_nostaff.png', dir: 'art-source/player/base', prefix: 'player_base' },
];

/** 배경색은 캔버스 왼쪽 위 모서리에서 뽑는다 — 인물이 거기까지 오는 시트는 없다. */
function cornerBackground(img: IRgbaImage): [number, number, number] {
  return [img.data[0], img.data[1], img.data[2]];
}

/**
 * 시트를 읽어 네 인물 구간을 확인한다 — **유료 호출 앞에 오는 싼 검사다.**
 *
 * 세 시트를 전부 이걸 지난 뒤에야 매팅 루프를 돈다. 시트마다 「검사 → 매팅 4회」를 되풀이하면
 * 셋째 시트가 떨어질 때 앞 여덟 번을 이미 태운 뒤다. 캐시가 있어 다시 돌릴 때 과금이 0이긴
 * 하지만, 비싼 것 앞에 싼 검사를 두는 것이 이 파일이 곳곳에서 지키는 순서다.
 *
 * @throws 시트가 없거나, 인물 구간이 넷이 아니거나, 여백을 붙여 자르면 옆 인물이 딸려 오면
 */
function readSheet(
  sheet: (typeof SHEETS)[number],
  sheetDir: string,
): { img: IRgbaImage; columns: ReturnType<typeof panelColumns> } {
  const sheetPath = path.join(ROOT, sheetDir, sheet.file);
  if (!fs.existsSync(sheetPath)) {
    throw new Error(`시트가 없다: ${path.join(sheetDir, sheet.file)}`);
  }

  const img = decodePng(new Uint8Array(fs.readFileSync(sheetPath)));
  const background = cornerBackground(img);
  const columns = panelColumns(img, { background, ...PANEL_DETECTION });
  if (columns.length !== DIRECTIONS.length) {
    throw new Error(
      `${sheet.file}에서 인물 구간이 ${DIRECTIONS.length}개가 아니라 ${columns.length}개다`,
    );
  }
  assertPanelGaps(columns, CROP_MARGIN, sheet.file);

  console.log(`■ ${sheet.file} — ${img.width}×${img.height}, 배경 (${background.join(',')})`);
  return { img, columns };
}

/** 시트 한 장을 네 방향 출하물로 만든다. 방향당 유료 호출 한 번이다. */
async function buildSheet(
  sheet: (typeof SHEETS)[number],
  img: IRgbaImage,
  columns: ReturnType<typeof panelColumns>,
): Promise<IShipItem[]> {
  console.log(`\n■ ${sheet.file}`);

  const items: IShipItem[] = [];
  for (let i = 0; i < DIRECTIONS.length; i++) {
    const cropped = cropColumns(img, columns[i], { margin: CROP_MARGIN });
    const result = await matte(encodePng(cropped), MATTING_MODEL);

    // 정렬은 알파 정규화 **뒤에** 온다. 순서가 뒤집히면 발 밑선을 잡는 기준이 잡음 알파를
    // 세게 되고, 시트마다 잡음이 다르므로 네 장의 기준이 서로 어긋난다.
    const name = `${sheet.dir}/${sheet.prefix}_${DIRECTIONS[i]}.png`;
    let aligned: IRgbaImage;
    try {
      aligned = alignToCanvas(normalizeAlpha(decodePng(result.bytes)), CANVAS);
    } catch (err) {
      // 정렬이 던지는 메시지는 「캐릭터 높이 491이 캔버스 493을 벗어난다」처럼 숫자만 든다.
      // 어느 방향인지와 **어느 파일을 열어 봐야 하는지**가 없으면, 사람이 그림을 확인하려고
      // 매팅 캐시를 손으로 뒤지게 된다. 그 자리를 여기서 붙여 준다.
      throw new Error(`${name} 정렬 실패: ${(err as Error).message}
    매팅 결과: ${result.cachePath}`);
    }
    items.push({ name, sheet: sheet.prefix, direction: DIRECTIONS[i], image: aligned });

    console.log(`  ${DIRECTIONS[i].padEnd(5)} [${result.cached ? '캐시' : '호출'}] → ${name}`);
  }
  return items;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sheetDir = args.includes('--sheets')
    ? args[args.indexOf('--sheets') + 1]
    : DEFAULT_SHEET_DIR;
  // 값이 없거나 다음 플래그를 먹은 경우를 함께 막는다. `--sheets --dry-run`을 그냥 받으면
  // `--dry-run`이 폴더 이름이 되고 모의 실행도 안 켜진다.
  if (!sheetDir || sheetDir.startsWith('--')) throw new Error('--sheets 뒤에 폴더를 적는다');

  // 세 시트를 먼저 다 읽고 구간을 확인한 뒤에야 유료 호출을 시작한다.
  const sheets = SHEETS.map((sheet) => ({ sheet, ...readSheet(sheet, sheetDir) }));

  const items: IShipItem[] = [];
  for (const { sheet, img, columns } of sheets) {
    items.push(...(await buildSheet(sheet, img, columns)));
  }

  // 판정을 전부 먼저 돌리고 통과할 때만 쓴다. `--dry-run`은 그 쓰기만 안 하는 것이라, 규격
  // 판정은 실제 실행과 똑같이 지난다 — 판정을 건너뛰면 미리 보는 값어치가 없다.
  console.log('');
  commitAll(items, SPEC, (item) => {
    if (dryRun) {
      console.log(`  [모의] ${item.name}`);
      return;
    }
    const out = path.join(ROOT, item.name);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, encodePng(item.image));
    console.log(`  ✓ ${item.name}`);
  });

  console.log(
    `\n${dryRun ? '규격 통과 (모의 실행이라 쓰지 않았다)' : `${items.length}장 교체 완료`}`,
  );
  console.log(`과금된 호출 ${callsUsed()}회`);
}

try {
  assertNodeVersion();
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
