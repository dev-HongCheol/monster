/**
 * 두 `.vrm` 판이 같은 몸인지 견주는 실행기. 옷 판을 더할 때와 옷을 전부 끈 판을 들여올 때 굽기 전에 돌린다.
 *
 * 하는 일은 셋이다. 두 판을 `inspect_meshes.py`로 덤프하고, `ModelMatch.ts`의 `matchModels`로 판정하고, 결과를
 * 찍는다. 같은 몸이 아니면 종료 코드 1이다. 판정 기준과 그 이유는 `ModelMatch.ts` 머리 주석이 든다.
 *
 * 돌리는 법 (레포 루트에서):
 *
 *   BLENDER='C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' \
 *     node --experimental-strip-types tools/blender/match.ts --less <덜 입은 판.vrm> --more <더 입은 판.vrm>
 *
 *   --less   옷을 덜 입은 판 — 가림 전용 몸으로 쓰이는 쪽(`player_base.vrm`, 옷을 전부 끈 판)
 *   --more   옷을 더 입은 판(`player_top_a.vrm` …). 맨살 판과 옷을 전부 끈 판을 견줄 때는 맨살 판이 이쪽이다
 *   --ignore-below <m>  이 높이 아래의 맨살은 부분집합 검사에서 뺀다. 신발을 벗긴 판과 견줄 때 발목 높이(0.1)를
 *            준다 — 신발 속의 발은 굽에 맞춰 세워져 있어 맨발과 모양이 다르다. 뺀 점의 수는 결과에 찍는다
 *
 * 두 판이 통째로 옮겨져 있으면(신발을 벗긴 판은 밑창만큼 내려간다) 그 이동을 빼고 견주고, 잰 이동을 찍는다.
 *
 * 덤프는 추적하지 않는 `docs/temp/3d-gate/g4/match/`에 쓴다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBlender } from './BlenderRun.ts';
import { type IModelDump, matchModels } from './ModelMatch.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 덤프의 자리. 추적되지 않는 스크래치다. */
const SCRATCH = 'docs/temp/3d-gate/g4/match';

/** 명령줄 인자에서 `--name 값`을 읽는다. 없으면 무엇이 빠졌는지 말하며 던진다. */
function required(name: string): string {
  const at = process.argv.indexOf(`--${name}`);
  const value = at >= 0 ? process.argv[at + 1] : undefined;
  if (!value) throw new Error(`--${name} <.vrm 경로>가 빠졌다 — 사용법은 이 파일 머리 주석에 있다`);
  const full = path.resolve(ROOT, value);
  if (!fs.existsSync(full)) throw new Error(`--${name}이 가리키는 파일이 없다: ${full}`);
  return full;
}

/** 판 하나를 덤프해 읽는다. 덤프가 실패하면 `runBlender`가 던지므로 앞 실행의 덤프를 읽을 일은 없다. */
async function dump(vrm: string): Promise<IModelDump> {
  const out = path.join(ROOT, SCRATCH, `${path.basename(vrm, '.vrm')}.json`);
  await runBlender(
    path.join(ROOT, 'tools/blender/inspect_meshes.py'),
    ['--vrm', vrm, '--out', out],
    path.basename(vrm),
  );
  return JSON.parse(fs.readFileSync(out, 'utf-8')) as IModelDump;
}

async function main(): Promise<void> {
  const lessPath = required('less');
  const morePath = required('more');
  // 두 덤프는 서로 기다릴 것이 없다. Blender 시작과 `.vrm` 불러오기가 한 판에 10초쯤이다
  const [less, more] = await Promise.all([dump(lessPath), dump(morePath)]);

  const at = process.argv.indexOf('--ignore-below');
  const ignoreBelowZ = at >= 0 ? Number(process.argv[at + 1]) : undefined;
  if (ignoreBelowZ !== undefined && !Number.isFinite(ignoreBelowZ)) {
    throw new Error('--ignore-below에는 높이(m)를 숫자로 준다');
  }

  const match = matchModels(less, more, { ignoreBelowZ });
  console.log(`덜 입은 판 ${path.basename(lessPath)} · 더 입은 판 ${path.basename(morePath)}`);
  console.log(
    `  더 입은 판의 이동 (${match.offset.map((v) => `${(v * 1000).toFixed(2)}mm`).join(', ')}) · 코어 본 ${match.coreBones}개 일치`,
  );
  console.log(
    `  맨살 점 ${match.skinInLess} · ${match.skinInMore} — 덜 입은 판에만 있는 점 ${match.skinRemoved} · 더 입은 판에만 있는 점 ${match.skinOutside}${ignoreBelowZ === undefined ? '' : ` · ${ignoreBelowZ}m 아래라 뺀 점 ${match.skinIgnored}`}`,
  );
  if (match.problems.length > 0) {
    for (const problem of match.problems) console.error(`✗ ${problem}`);
    throw new Error('두 판은 같은 몸이 아니다 — 한쪽을 가림 전용 몸으로 쓰면 가림이 어긋난다');
  }
  console.log('✓ 같은 몸이다 — 코어 본 · 얼굴과 머리카락의 모양 · 맨살의 부분집합 관계를 통과했다');
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
