/**
 * 환경 스모크(게이트 0a)를 돌리고 산출물을 숫자로 재는 실행기 — 새 장비에서 헤드리스 Blender · 파이썬 · 투명
 * EEVEE가 도는지를 VRoid를 깔기 전에 확인한다.
 *
 * **판정 로직을 여기 베끼지 않는다.** 알파와 상자를 재는 것은 `SpriteMetrics.ts`가, 판정 줄을
 * 고르는 것은 `GateLine.ts`가 이미 한다. 이 파일이 하는 일은 Blender를 부르고, 그 출력에서
 * 판정 줄을 뽑고, 구워진 PNG를 그 함수들에 넘겨 한 줄로 찍는 것까지다. 같은 판정이 실행기와
 * 벤치에 두 벌로 갈리면 한쪽만 고쳤을 때 나머지가 낡은 채로 초록불을 유지한다.
 *
 * **파이썬 쪽은 판정을 하지 않는다.** `tools/**\/*.ts`는 타입체크·lint·vitest 셋을 다
 * 지나가지만 `.py`는 어느 그물에도 없다. 그래서 굽는 일만 파이썬에 두고 재는 일은 전부
 * 여기로 모았고, 그 대가로 판정이 Blender 버전을 안 탄다.
 *
 * 돌리는 법: `node --experimental-strip-types tools/blender/gate.ts 0a`
 * 굽지 않고 이미 있는 산출물만 다시 재려면 `--judge-only`를 붙인다.
 * Blender 실행 파일은 환경 변수 `BLENDER`로 준다. 자세한 것은 `README.md`에 있다.
 *
 * 1라운드 게이트 0b · 0c · 2의 프레임 판정 경로는 지웠다(2026-09-27 — git 이력). 생산 굽기와 그 판정은
 * `bake.ts`가 한다.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type GateLine, parseGateLine } from '../../tests/helpers/GateLine.ts';
import { alphaHistogram, footLineY, trimBox } from '../../tests/helpers/SpriteMetrics.ts';
import { decodePng } from '../art/PngCodec.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 게이트 하나가 무엇을 부르고 무엇을 굽는가. */
export interface IGateSpec {
  /** 부를 파이썬 스크립트의 repo 상대 경로 */
  script: string;
  /** 굽는 산출물의 repo 상대 경로. `docs/temp/`는 추적되지 않는 스크래치다 */
  output: string;
  /** 사람이 읽는 게이트 이름 */
  label: string;
  /**
   * `-- --out <경로>` 뒤에 더 붙일 인자.
   *
   * `repoPath`는 repo 상대 경로라 절대 경로로 바꿔 넘기고, `value`는 그대로 넘긴다.
   */
  extraArgs?: { flag: string; repoPath?: string; value?: string }[];
}

/**
 * Blender 한 번을 기다리는 상한(밀리초).
 *
 * EEVEE가 GPU 컨텍스트에서 멈추면 Blender가 죽지도 끝나지도 않는다. 상한이 없으면 실행기가 영원히
 * 기다려서, 사람은 느린 것인지 멈춘 것인지 가를 수 없다. 게이트 0c 한 번이 2026-09-14에 10분
 * 안에 끝났으므로 두 배인 20분으로 둔다.
 */
const BLENDER_TIMEOUT_MS = 20 * 60 * 1000;

/** 게이트 표 — 환경 스모크 하나다. */
const GATES: Record<string, IGateSpec> = {
  '0a': {
    script: 'tools/blender/smoke.py',
    output: 'docs/temp/3d-gate/gate0a_smoke.png',
    label: '게이트 0a — 환경 스모크',
  },
};

/**
 * Blender 실행 파일의 경로.
 *
 * 환경 변수를 먼저 보는 이유는 윈도우 설치 경로에 버전 번호가 들어가기 때문이다
 * (`Blender Foundation/Blender 4.5/blender.exe`). 버전을 코드가 짐작하면 올릴 때마다
 * 이 파일을 고쳐야 하고, 짐작이 틀린 경우의 메시지가 「파일 없음」이라 원인이 안 드러난다.
 */
function resolveBlender(): string {
  const fromEnv = process.env.BLENDER;
  if (!fromEnv) return 'blender';
  if (!fs.existsSync(fromEnv)) {
    throw new Error(`환경 변수 BLENDER가 가리키는 파일이 없다: ${fromEnv}`);
  }
  return fromEnv;
}

/** 구워진 PNG를 재서 위반 목록으로 만든다. 빈 배열이면 통과다. */
function judgeRender(outPath: string): { problems: string[]; summary: string } {
  const img = decodePng(fs.readFileSync(outPath));
  const hist = alphaHistogram(img);
  const box = trimBox(img);
  const problems: string[] = [];

  // 투명 렌더가 도는가를 재는 자리다. `film_transparent`가 안 걸리면 배경이 불투명한 회색으로
  // 채워져 알파 0 픽셀이 한 개도 없다. 파일은 정상이고 크기도 맞으므로 파일 검사로는 안 걸린다.
  if (hist.transparent === 0) {
    problems.push('완전 투명 픽셀이 0개다 — film_transparent가 안 걸렸다');
  }
  // 반대쪽도 본다. 피사체가 카메라 밖이거나 장면이 비면 전부 투명한 PNG가 나오는데, 그것도
  // 「투명 렌더 성공」으로 읽히기 때문이다.
  if (hist.opaque === 0) {
    problems.push('불투명 픽셀이 0개다 — 피사체가 안 찍혔거나 카메라 프레이밍 밖이다');
  }
  // 잘린 렌더는 파일도 알파도 정상이라 위 둘로는 안 걸린다. 유일한 단서가 트림 상자가
  // 캔버스 변에 닿는 것이다. 2026-09-11 게이트 0b의 첫 렌더에서 A 포즈로 벌린 손이 실제로
  // 좌우로 잘렸고, 숫자만 보고는 통과로 읽었다.
  if (box && (box.x === 0 || box.y === 0)) {
    problems.push(`트림 상자가 캔버스 왼쪽·위 변에 닿는다 (${box.x},${box.y}) — 잘렸을 수 있다`);
  }
  if (box && (box.x + box.width === img.width || box.y + box.height === img.height)) {
    problems.push('트림 상자가 캔버스 오른쪽·아래 변에 닿는다 — 잘렸을 수 있다');
  }

  const boxText = box ? `${box.width}×${box.height}@${box.x},${box.y}` : '없음';
  const summary = [
    `${img.width}×${img.height}`,
    `투명 ${hist.transparent}`,
    `경계 ${hist.semi}`,
    `불투명 ${hist.opaque}`,
    `트림 ${boxText}`,
    `발밑 ${footLineY(img) ?? -1}`,
  ].join('  ');

  return { problems, summary };
}

/** 판정 줄을 사람이 읽는 한 줄로 만든다. */
function describe(line: GateLine): string {
  return line.ok
    ? `GATE_OK ${JSON.stringify(line.payload)}`
    : `GATE_FAIL ${line.code} ${line.message}`;
}

/** 게이트 이름으로 표의 줄을 찾는다. 없으면 가능한 이름을 말하며 던진다. */
function specOf(gates: Record<string, IGateSpec>, name: string): IGateSpec {
  const spec = gates[name];
  if (!spec) {
    throw new Error(`모르는 게이트 "${name}" (가능: ${Object.keys(gates).join(', ')})`);
  }
  return spec;
}

/** 판정 결과를 찍고 종료 코드를 돌려준다. 위반이 하나라도 있으면 1이다. */
function report(spec: IGateSpec, problems: string[], summary: string): number {
  console.log(`  ${summary}`);
  if (problems.length > 0) {
    for (const p of problems) console.error(`  ✗ ${p}`);
    return 1;
  }

  console.log(`  ✓ ${spec.label} 통과 — ${spec.output}`);
  return 0;
}

/** 게이트 하나를 굽고 판정해 종료 코드를 돌려준다. */
function runGate(gates: Record<string, IGateSpec>, name: string): number {
  const spec = specOf(gates, name);
  const blender = resolveBlender();
  const output = path.join(ROOT, spec.output);

  // `--python-exit-code`를 `--python`보다 **앞에** 둔다. Blender는 인자를 적힌 순서대로
  // 처리하므로, 뒤에 두면 스크립트가 이미 실행된 뒤에 설정돼 예외가 종료 코드에 안 실린다.
  const args = [
    '--background',
    '--python-exit-code',
    '1',
    '--python',
    path.join(ROOT, spec.script),
    '--',
    '--out',
    output,
  ];
  for (const extra of spec.extraArgs ?? []) {
    args.push(extra.flag, extra.repoPath ? path.join(ROOT, extra.repoPath) : (extra.value ?? ''));
  }

  console.log(`\n■ ${spec.label}`);
  console.log(`  ${blender} ${args.join(' ')}`);

  const run = spawnSync(blender, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: BLENDER_TIMEOUT_MS,
  });

  if (run.error) {
    const code = (run.error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(
        `Blender를 실행할 수 없다 (${blender}). PATH에 없으면 환경 변수 BLENDER에 ` +
          'blender 실행 파일의 전체 경로를 넣는다.',
      );
    }
    // 상한에 걸리면 Node가 Blender를 끊고 이 코드를 준다. 그대로 던지면 `spawnSync ... ETIMEDOUT`
    // 한 줄만 남아 어디를 볼지 알 수 없다. 그래서 끊기 전까지 찍힌 로그의 꼬리를 먼저 보여 준다 —
    // 임포트·굽기·렌더 중 어디서 멈췄는지가 거기 드러나서, 20분을 기다린 뒤 같은 명령을 손으로
    // 다시 돌리지 않아도 된다.
    if (code === 'ETIMEDOUT') {
      const outTail = (run.stdout ?? '').trim().split('\n').slice(-8).join('\n    ');
      if (outTail) console.error(`  stdout 꼬리:\n    ${outTail}`);
      const errTail = (run.stderr ?? '').trim().split('\n').slice(-8).join('\n    ');
      if (errTail) console.error(`  stderr 꼬리:\n    ${errTail}`);
      throw new Error(
        `Blender가 ${BLENDER_TIMEOUT_MS / 60000}분 안에 끝나지 않아 끊었다 — GPU 컨텍스트에서 ` +
          '멈췄을 수 있다. 위 로그 꼬리에서 멈춘 단계를 보고, 모자라면 같은 명령을 --background ' +
          '없이 돌려 본다.',
      );
    }
    throw run.error;
  }

  const line = parseGateLine(run.stdout ?? '');
  console.log(`  ${describe(line)}`);
  console.log(`  종료 코드 ${run.status}`);

  if (!line.ok) {
    // 판정 줄이 아예 없으면 원인이 stdout에 없다. Blender는 시작 진단과 GPU 오류를 stderr로
    // 보내므로 꼬리를 함께 찍어 준다 — 없으면 사람이 같은 명령을 손으로 다시 돌려야 한다.
    const tail = (run.stderr ?? '').trim().split('\n').slice(-8).join('\n    ');
    if (tail) console.error(`  stderr 꼬리:\n    ${tail}`);
    return 1;
  }

  if (!fs.existsSync(output)) {
    console.error(`  ✗ 판정 줄은 성공인데 산출물이 없다: ${spec.output}`);
    return 1;
  }

  const { problems, summary } = judgeRender(output);
  return report(spec, problems, summary);
}

/**
 * Blender를 부르지 않고 게이트 표의 출력 자리에 이미 있는 산출물만 다시 잰다.
 *
 * 굽기는 됐는데 판정만 다시 보고 싶을 때 쓴다 — 스모크 PNG가 스크래치에 남아 있으면 Blender를 다시 띄울
 * 필요가 없다.
 */
function judgeExisting(gates: Record<string, IGateSpec>, name: string): number {
  const spec = specOf(gates, name);
  const output = path.join(ROOT, spec.output);
  console.log(`\n■ ${spec.label} — 판정만 (Blender를 부르지 않는다)`);
  if (!fs.existsSync(output)) {
    return report(spec, [`판정할 산출물이 없다: ${spec.output}`], '');
  }
  const { problems, summary } = judgeRender(output);
  return report(spec, problems, summary);
}

/**
 * 이 도구가 요구하는 Node 최소 버전.
 *
 * `--experimental-strip-types`로 `.ts`를 그대로 돌리는데 그 플래그가 22.6에 들어왔다. 이
 * 프로젝트는 장비 둘을 오가므로, 낮은 Node가 깔린 쪽에서는 스트립이 문법 오류로 죽고 그
 * 메시지에 원인이 Node 버전이라는 것이 안 드러난다. 지운 `tools/art/judge.ts`(2026-09-28)가 세운 기준을 이어받았다.
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

/**
 * 명령줄을 읽어 `gates` 표의 게이트 하나를 돌린다. 종료 코드를 직접 정한다.
 *
 * @param gates 이름 → 게이트
 */
function main(gates: Record<string, IGateSpec>): void {
  try {
    assertNodeVersion();
    const name = process.argv[2];
    if (!name) {
      throw new Error(
        `사용법: ${path.basename(process.argv[1] ?? 'gate.ts')} <${Object.keys(gates).join('|')}> [--judge-only]`,
      );
    }
    const judgeOnly = process.argv.slice(3).includes('--judge-only');
    process.exitCode = judgeOnly ? judgeExisting(gates, name) : runGate(gates, name);
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
}

main(GATES);
