/**
 * 후보 매팅 모델을 같은 패널에 돌려 숫자로 비교하는 실행기.
 *
 * 계획 §3.1이 정한 게이트를 그대로 잰다. **정리 단계를 거치기 전 원본 응답에 대고 재는 것**이
 * 이 파일의 핵심이다 — 알파 임계값과 RGB 정리를 지난 뒤에 재면 「희미한 알파 0」과 「알파 0
 * 픽셀이 검정」은 정리가 정의상 만들어 내는 값이라, 잡음을 뱉는 모델도 그대로 통과한다.
 *
 * 돌리는 법: `node --experimental-strip-types tools/art/judge.ts`
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  alphaHistogram,
  backgroundLeak,
  edgeHalo,
  footLineY,
  type IRgbaImage,
  residualBackgroundRgb,
  trimBox,
} from '../../tests/helpers/SpriteMetrics.ts';
import { callsUsed, matte } from './FalMatting.ts';
import { decodePng, encodePng } from './PngCodec.ts';
import { cropColumns, panelColumns } from './SheetCrop.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 후보 엔드포인트. 계획 §3의 표와 같은 순서다. */
const MODELS = ['fal-ai/bria/background/remove', 'fal-ai/birefnet/v2'];

/**
 * 판정에 쓰는 패널 셋 — 시트마다 하나씩 고른다.
 *
 * 시트 셋을 다 거는 이유는 난이도가 서로 다르기 때문이다. 맨살 판의 회색 운동복은 배경과
 * 색이 가까워, 옷을 배경으로 오인해 뚫는 모델이 여기서만 드러난다. 옷 입은 판만 보면 그
 * 실패가 안 보인 채로 12장에 적용된다.
 *
 * 패널 순서는 생성 프롬프트가 정한 front · back · left · right다.
 */
const PANELS = [
  { sheet: '4dir_dressed', column: 0, label: '옷 입은 판 front' },
  { sheet: '4dir_bald', column: 3, label: '삭발 판 right' },
  { sheet: '4dir_skin', column: 0, label: '맨살 판 front' },
];

/** 배경색은 캔버스 왼쪽 위 모서리에서 뽑는다 — 인물이 거기까지 오는 시트는 없다. */
function cornerBackground(img: IRgbaImage): [number, number, number] {
  return [img.data[0], img.data[1], img.data[2]];
}

/** 한 장을 계획 §3.1의 항목으로 재서 한 줄로 만든다. */
function measure(img: IRgbaImage, bg: readonly [number, number, number]): string {
  const hist = alphaHistogram(img);
  const box = trimBox(img);
  const residual = residualBackgroundRgb(img);
  const leak = backgroundLeak(img, bg, { maxDistance: 12, minAlpha: 200 });
  const halo = edgeHalo(img, bg);
  const boxText = box ? `${box.width}×${box.height}@${box.x},${box.y}` : '없음';
  const percent = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`.padStart(6);

  return [
    `희미 ${String(hist.faint).padStart(5)}`,
    // 경계(17~200)와 거의불투명(201~254)을 갈라 찍는다. 합치면 `bria`의 내부 양자화
    // 30,113~45,580px이 경계 대역을 덮어써, 경계가 더 얇은 모델이 더 두꺼워 보인다.
    `경계 ${String(hist.semi).padStart(5)}`,
    `거의불투명 ${String(hist.nearOpaque).padStart(6)}`,
    `트림 ${boxText.padEnd(16)}`,
    `발밑 ${String(footLineY(img) ?? -1).padStart(4)}`,
    `알파0색 (${residual.mean.join(',')})`.padEnd(20),
    `배경색불투명 ${String(leak).padStart(5)}`,
    // 좌우를 따로 찍는다. 합치면 깨끗한 쪽이 더러운 쪽을 희석해, 한쪽 윤곽에만 회색 선이
    // 그어진 결과가 절반 값으로 보인다 — 실제로 `birefnet`이 그렇게 통과할 뻔했다.
    `후광 좌${percent(halo.left.ratio)} 우${percent(halo.right.ratio)}`,
  ].join('  ');
}

async function main(): Promise<void> {
  let failures = 0;

  for (const panel of PANELS) {
    const sheetPath = path.join(ROOT, `art-source/player/2026-08-06/${panel.sheet}.png`);
    const sheet = decodePng(fs.readFileSync(sheetPath));
    const bg = cornerBackground(sheet);

    const columns = panelColumns(sheet, { background: bg, maxDistance: 24, minColumnPixels: 3 });
    if (columns.length !== 4) {
      throw new Error(`${panel.sheet}에서 인물 구간이 4개가 아니라 ${columns.length}개다`);
    }

    // **여기서는 여백을 주지 않는다.** 크롭이 달라지면 입력 해시가 달라져 캐시가 통째로
    // 미스가 되고 판정 여섯 번이 다시 과금된다. 모델 결정은 이미 닫혔고, 그 결정을 가른
    // 두 항목(배경색 잔여 0px 대 65px · 오른쪽 후광 한 자리수 대 56~70%)은 자릿수 차이라
    // 인물 바깥 한두 열이 붙고 떨어지는 것으로 뒤집히지 않는다.
    //
    // 반대로 **출하물을 뽑을 때는 반드시 여백을 준다.** 그 이유는 `ICropColumnsOptions`의
    // `margin` 주석에 있고, 그 실행기는 교체 슬라이스(F67)가 붙인다.
    const cropped = cropColumns(sheet, columns[panel.column]);
    const croppedPng = encodePng(cropped);

    console.log(`\n■ ${panel.label} — ${cropped.width}×${cropped.height}, 배경 (${bg.join(',')})`);

    for (const model of MODELS) {
      try {
        const result = await matte(croppedPng, model);
        const flag = result.cached ? '캐시' : '호출';
        console.log(`  ${model.padEnd(34)} [${flag}]  ${measure(decodePng(result.bytes), bg)}`);
      } catch (err) {
        // fal은 무엇이 왜 거부됐는지를 `body.detail`에 담아 보낸다. 메시지만 찍으면
        // "Unprocessable Entity"까지밖에 안 보여서 원인을 추측하게 된다.
        const e = err as { message: string; status?: number; body?: unknown };
        const detail = e.body ? ` ${JSON.stringify(e.body).slice(0, 200)}` : '';
        console.log(`  ${model.padEnd(34)} [실패]  ${e.status ?? ''} ${e.message}${detail}`);
        failures++;
      }
    }
  }

  console.log(`\n과금된 호출 ${callsUsed()}회`);

  // 실패를 잡아 찍고 계속 도는 것은 한 모델이 떨어져도 나머지 판정을 얻기 위해서다. 다만
  // 그대로 0으로 끝내면 **여섯 번 다 실패한 실행과 여섯 번 다 통과한 실행이 종료코드로
  // 구별되지 않는다** — 키가 없거나 요율이 바뀐 날 조용히 빈 표를 얻는다.
  if (failures > 0) {
    console.error(`✗ 실패한 호출 ${failures}건 — 위 [실패] 줄을 본다.`);
    process.exitCode = 1;
  }
}

/**
 * 이 도구가 요구하는 Node 최소 버전.
 *
 * `--experimental-strip-types`로 `.ts`를 그대로 돌리는데 그 플래그가 22.6에 들어왔고,
 * `File` 전역(업로드에 쓴다)도 20부터다. **이 프로젝트는 장비 둘을 오간다** — 낮은 Node가
 * 깔린 쪽에서 돌리면 스트립이 문법 오류로 죽거나 `File is not defined`가 뜨는데, 둘 다
 * 원인이 Node 버전이라는 것이 메시지에 안 드러난다.
 */
const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 6;

function assertNodeVersion(): void {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR)) return;
  throw new Error(
    `Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} 이상이 필요하다 (지금 ${process.versions.node}) — ` +
      '`--experimental-strip-types`가 그 버전부터 있다.',
  );
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
