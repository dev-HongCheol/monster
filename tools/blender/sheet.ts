/**
 * 게이트 1(화풍) 판정에 쓸 비교 시트를 한 장 쓰는 실행기.
 *
 * 3D 걷기 프레임 한 장과 출하된 2D 정면 그림을 원본 크기 · 1440p 게임 크기 · 720p 게임 크기의
 * 세 줄로 나란히 붙인다. 왼쪽 열이 3D, 오른쪽 열이 2D다. 줄이고 섞는 규칙은
 * `ComparisonSheet.ts`가 들고, 이 파일은 PNG를 읽고 쓰는 일과 무엇을 어느 칸에 넣는지만 정한다.
 * 판정 규칙이 실행기와 벤치에 두 벌로 갈리면 한쪽만 고쳤을 때 나머지가 낡은 채로 초록불을
 * 유지하기 때문이다.
 *
 * 돌리는 법: `node --experimental-strip-types tools/blender/sheet.ts`
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_FRAME_SPEC } from '../../tests/helpers/FrameSet.ts';
import { decodePng, encodePng } from '../art/PngCodec.ts';
import {
  composeGrid,
  compositeOver,
  type IRect,
  maskRect,
  type Rgb,
  sampleLikeEngine,
} from './ComparisonSheet.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 시트의 한 줄 — 두 캐릭터를 몇 픽셀로 그리는가. */
interface ISheetRow {
  /** 사람이 읽는 줄 이름 */
  label: string;
  width: number;
  height: number;
}

/**
 * 시트의 세 줄.
 *
 * 게임 크기는 계산이 아니라 실측으로 닫았다. 플레이어 노드는 48×96 월드 단위로 그려지고,
 * 화면 픽셀로 몇 개가 되는지는 디자인 해상도의 세로 값이 정한다(세로 맞춤이라 화면 세로 ÷
 * 디자인 세로가 월드 단위 하나의 픽셀 수다). 2026-09-14 1440p 실행에서 세로 배율이
 * 1391 ÷ 720과 정확히 맞아 디자인 세로가 720으로 확인됐다 — 엔진 기본값 640이었다면 2.17이
 * 나왔다. 그래서 1440p는 96×192, 720p는 48×96이다.
 */
const ROWS: readonly ISheetRow[] = [
  { label: '원본', width: PLAYER_FRAME_SPEC.width, height: PLAYER_FRAME_SPEC.height },
  { label: '1440p', width: 96, height: 192 },
  { label: '720p', width: 48, height: 96 },
];

/**
 * 시트 배경색 — `main.scene` 월드 카메라의 배경색(검정)과 같다.
 *
 * 게임에서 캐릭터 뒤에 깔리는 색이 이것이라, 옷과 배경의 대비까지 게임과 같게 보려고 맞춘다.
 * 배경색이 다르면 그 대비가 달라져서, 게임보다 또렷하거나 흐린 실루엣을 보고 판정하게 된다.
 */
const BACKGROUND: Rgb = [0, 0, 0];

/** 얼굴을 덮는 색. 배경과 구별되고 피부색과도 멀게 중간 회색으로 둔다. */
const MASK_COLOR: Rgb = [128, 128, 128];

/** 칸 사이와 바깥 테두리의 간격(px) */
const GAP = 16;

/**
 * 칸에 넣을 원본과 그 원본에서 얼굴을 가릴 자리.
 *
 * **얼굴만 가리고 머리카락은 남긴다.** 이번 캐릭터의 얼굴은 대충 만든 것이라 얼굴이 보이면
 * 판정이 화풍이 아니라 얼굴 완성도로 흐른다. 반면 머리카락 하이라이트는 3D 느낌을 만드는
 * 주범 셋 중 하나라 판정에서 보여야 한다.
 *
 * 사각형은 2026-09-14에 두 PNG를 10px 격자와 함께 세 배로 확대해 손으로 잰 값이다. 3D는
 * 앞머리가 눈썹을 덮고 있어 앞머리 끝(눈 바로 위)부터 턱까지, 2D는 눈썹부터 턱까지를 덮는다.
 * 3D는 같은 날 머리 꼭대기 행을 고정해 다시 구우면서 인물이 1.067배 커졌다. 그래서 먼저 잰
 * 사각형을 발 밑선과 캔버스 가운데를 기준으로 그 배율만큼 옮기고, 같은 방법으로 확대해 얼굴을
 * 덮는지 확인했다. 원본을 다시 구우면 다시 잰다. 캔버스 크기가 달라졌으면 `maskRect`가 던진다.
 *
 * **3D 칸은 `walk_0006`이다.** 출하된 2D는 두 발로 선 자세라, 한쪽 발을 크게 든 장이나
 * 발바닥이 보이는 장을 옆에 두면 실루엣 차이가 화풍이 아니라 자세에서 난다. 그래서 발바닥이
 * 카메라 쪽으로 5°를 넘게 향하는 장을 빼고, 남은 장 가운데 더 높이 든 발이 가장 낮은 장을
 * 골랐다(3.8cm). 두 발이 더 낮은 `walk_0001`·`walk_0005`는 발뒤꿈치를 딛는 순간이라 발바닥이
 * 16° 보인다. 다른 장으로 바꾸면 머리가 몇 px 움직이므로 얼굴 사각형도 다시 잰다.
 */
const SOURCES: readonly { label: string; file: string; face: IRect }[] = [
  {
    label: '3D',
    file: 'game/assets/test-3d-gate/walk_0006.png',
    face: { x: 76, y: 92, width: 93, height: 65 },
  },
  {
    label: '2D',
    file: 'game/assets/art/player/player_4dir_front.png',
    face: { x: 76, y: 78, width: 95, height: 71 },
  },
];

/** 시트를 쓰는 자리. 판정 증거라 `.vrm`과 같은 폴더에 두고 커밋한다. */
const OUTPUT = 'art-source/player/2026-09-11-3d-gate/comparison-sheet.png';

/**
 * 이 도구가 요구하는 Node 최소 버전.
 *
 * `--experimental-strip-types`로 `.ts`를 그대로 돌리는데 그 플래그가 22.6에 들어왔다. 낮은
 * Node에서는 스트립이 문법 오류로 죽고 그 메시지에 원인이 Node 버전이라는 것이 안 드러난다.
 * `gate.ts`와 같은 기준이다.
 */
const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 6;

/** Node 버전이 최소 기준보다 낮으면 지금 버전을 말하며 던진다. */
function assertNodeVersion(): void {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR)) return;
  throw new Error(
    `Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} 이상이 필요하다 (지금 ${process.versions.node}) — ` +
      '`--experimental-strip-types`가 그 버전부터 있다.',
  );
}

/** 원본을 읽고 캔버스가 플레이어 규격인지 확인한 뒤 얼굴을 가린 사본을 돌려준다. */
function loadMasked(source: (typeof SOURCES)[number]) {
  const img = decodePng(fs.readFileSync(path.join(ROOT, source.file)));
  // 캔버스가 규격과 다르면 게임 크기 칸의 비율이 게임과 달라진다. 출하 노드는 `Size Mode`가
  // CUSTOM이라 어떤 캔버스든 48×96에 억지로 채우므로, 여기서 멈추지 않으면 찌그러진 칸으로
  // 판정하게 된다.
  if (img.width !== PLAYER_FRAME_SPEC.width || img.height !== PLAYER_FRAME_SPEC.height) {
    throw new Error(
      `${source.file}의 캔버스가 ${img.width}×${img.height}인데 ` +
        `${PLAYER_FRAME_SPEC.width}×${PLAYER_FRAME_SPEC.height}를 기대했다`,
    );
  }
  return maskRect(img, source.face, MASK_COLOR);
}

try {
  assertNodeVersion();

  // 얼굴은 줄이기 **전에** 가린다. 가림막도 텍스처의 일부로 엔진식 축소를 함께 거쳐야 작은
  // 칸에서도 원본 칸과 같은 자리를 덮는다.
  const masked = SOURCES.map(loadMasked);
  const grid = ROWS.map((row) =>
    masked.map((img) => compositeOver(sampleLikeEngine(img, row.width, row.height), BACKGROUND)),
  );
  const sheet = composeGrid(grid, { gap: GAP, background: BACKGROUND });

  const output = path.join(ROOT, OUTPUT);
  fs.writeFileSync(output, encodePng(sheet));

  console.log(`✓ 비교 시트 ${sheet.width}×${sheet.height} — ${OUTPUT}`);
  console.log(`  열: ${SOURCES.map((s) => `${s.label} (${s.file})`).join(' | ')}`);
  console.log(`  줄: ${ROWS.map((r) => `${r.label} ${r.width}×${r.height}`).join(' | ')}`);
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}
