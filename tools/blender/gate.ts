/**
 * Blender 게이트를 돌리고 산출물을 숫자로 재는 실행기.
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
 * Blender 실행 파일은 환경 변수 `BLENDER`로 준다. 자세한 것은 `README.md`에 있다.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameSetIntegrity, PLAYER_FRAME_SPEC } from '../../tests/helpers/FrameSet.ts';
import { type GateLine, parseGateLine } from '../../tests/helpers/GateLine.ts';
import { alphaHistogram, footLineY, trimBox } from '../../tests/helpers/SpriteMetrics.ts';
import { decodePng } from '../art/PngCodec.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 게이트 하나가 무엇을 부르고 무엇을 굽는가. */
interface IGateSpec {
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
  /** `still`이면 `output`이 PNG 한 장, `frames`면 프레임을 모을 디렉터리다. 기본 `still` */
  kind?: 'still' | 'frames';
  /** `frames`일 때 기대하는 프레임 수 */
  expectFrames?: number;
}

/**
 * 발 밑선이 기준에서 위로 벗어나도 되는 픽셀 수.
 *
 * 걷기에서 디딘 발이 프레임마다 몇 px 오르내리는 것은 정상이므로 0으로 잡을 수 없다. 초기값과
 * 그 근거는 `docs/qa/blender-3d-gate-test.md` §4.2에 있고, 첫 렌더의 실제 분포를 보고 확정한다.
 */
const FOOT_LINE_TOLERANCE = 12;

/**
 * 게이트 표. 앞 게이트가 통과한 뒤에 다음 줄을 붙여 왔다.
 *
 * **0c와 2는 같은 스크립트를 부르고 굽는 자리만 다르다.** 0c는 `docs/temp/`에 구워 판정만
 * 하고, 2는 `game/assets/test-3d-gate/`에 구워 Cocos가 임포트할 것을 남긴다. 그래서 2를
 * 돌리기 전에 0c가 먼저 통과해야 하고, 반대로 0c를 다시 돌린다고 출하물이 바뀌지 않는다.
 */
const GATES: Record<string, IGateSpec> = {
  '0a': {
    script: 'tools/blender/smoke.py',
    output: 'docs/temp/3d-gate/gate0a_smoke.png',
    label: '게이트 0a — 환경 스모크',
  },
  '0b': {
    script: 'tools/blender/import_vrm.py',
    output: 'docs/temp/3d-gate/gate0b_front.png',
    label: '게이트 0b — VRM 임포트',
    extraArgs: [
      { flag: '--vrm', repoPath: 'art-source/player/2026-09-11-3d-gate/character.vrm' },
      { flag: '--bones', repoPath: 'docs/temp/3d-gate/bones.json' },
    ],
  },
  '0c': {
    script: 'tools/blender/retarget_render.py',
    output: 'docs/temp/3d-gate/walk',
    label: '게이트 0c — 걷기 리타게팅',
    kind: 'frames',
    expectFrames: 8,
    extraArgs: [
      { flag: '--vrm', repoPath: 'art-source/player/2026-09-11-3d-gate/character.vrm' },
      {
        flag: '--motion',
        repoPath: 'art-source/player/2026-09-11-3d-gate/motion/Unreal-Godot/UAL1_Standard.glb',
      },
      { flag: '--action', value: 'Walk_Loop' },
      { flag: '--frames', value: '8' },
      { flag: '--gate', value: '0c' },
    ],
  },
  '2': {
    script: 'tools/blender/retarget_render.py',
    output: 'game/assets/test-3d-gate',
    label: '게이트 2 — 출하 프레임',
    kind: 'frames',
    expectFrames: 8,
    extraArgs: [
      { flag: '--vrm', repoPath: 'art-source/player/2026-09-11-3d-gate/character.vrm' },
      {
        flag: '--motion',
        repoPath: 'art-source/player/2026-09-11-3d-gate/motion/Unreal-Godot/UAL1_Standard.glb',
      },
      { flag: '--action', value: 'Walk_Loop' },
      { flag: '--frames', value: '8' },
      { flag: '--gate', value: '2' },
    ],
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

/**
 * 구운 프레임 세트를 `frameSetIntegrity`로 판정한다.
 *
 * 파일 목록을 디렉터리를 훑어 얻지 않고 **판정 줄이 말한 것을 쓴다.** 디렉터리를 훑으면 지난
 * 실행이 남긴 프레임이 섞여 들어와, 이번에 아무것도 안 구웠는데 통과하는 경우가 생긴다.
 */
function judgeFrames(payload: unknown, spec: IGateSpec): { problems: string[]; summary: string } {
  const written = (payload as { written?: unknown }).written;
  if (!Array.isArray(written) || written.some((p) => typeof p !== 'string')) {
    return {
      problems: ['판정 줄에 written 목록이 없다 — 무엇을 구웠는지 알 수 없다'],
      summary: '',
    };
  }

  const paths = written as string[];
  const missing = paths.filter((p) => !fs.existsSync(p));
  if (missing.length > 0) {
    return { problems: [`판정 줄이 말한 파일이 없다: ${missing.join(', ')}`], summary: '' };
  }

  const images = paths.map((p) => decodePng(fs.readFileSync(p)));
  // 알파 대역을 함께 찍는다. 빈 프레임 임계값을 16으로 둔 근거가 「희미한 알파가 실제로 얼마나
  // 있는가」인데, 불투명 픽셀 수만 보고는 그 값을 확인할 수 없다.
  const bands = images.map(alphaHistogram);

  const report = frameSetIntegrity(images, {
    count: spec.expectFrames ?? paths.length,
    width: PLAYER_FRAME_SPEC.width,
    height: PLAYER_FRAME_SPEC.height,
    footLineY: PLAYER_FRAME_SPEC.footLineY,
    footLineTolerance: FOOT_LINE_TOLERANCE,
  });

  const summary = report.frames
    .map((f) => {
      const b = bands[f.index];
      return (
        `#${f.index} 불투명 ${f.opaquePixels} 발밑 ${f.footLineY ?? -1} ` +
        `희미 ${b.faint} 경계 ${b.semi} 거의불투명 ${b.nearOpaque}`
      );
    })
    .join('\n  ');
  return { problems: report.problems, summary };
}

/** 판정 줄을 사람이 읽는 한 줄로 만든다. */
function describe(line: GateLine): string {
  return line.ok
    ? `GATE_OK ${JSON.stringify(line.payload)}`
    : `GATE_FAIL ${line.code} ${line.message}`;
}

function runGate(name: string): number {
  const spec = GATES[name];
  if (!spec) {
    throw new Error(`모르는 게이트 "${name}" (가능: ${Object.keys(GATES).join(', ')})`);
  }

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

  // 렌더 스크립트는 이미 있는 파일을 덮지 않는다. 출하 아트를 지키는 규칙이지만 스크래치
  // 재실행까지 막으므로, `docs/temp/` 아래 자기 산출물만 먼저 치운다. 그 폴더는 「스크립트로
  // 다시 만들 수 있는 것만 둔다」가 `.gitignore`에 적힌 자리다.
  if (spec.kind === 'frames' && spec.output.startsWith('docs/temp/') && fs.existsSync(output)) {
    for (const name of fs.readdirSync(output)) {
      if (name.endsWith('.png')) fs.rmSync(path.join(output, name));
    }
    console.log(`  (스크래치 정리: ${spec.output})`);
  }

  console.log(`\n■ ${spec.label}`);
  console.log(`  ${blender} ${args.join(' ')}`);

  const run = spawnSync(blender, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  if (run.error) {
    const code = (run.error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(
        `Blender를 실행할 수 없다 (${blender}). PATH에 없으면 환경 변수 BLENDER에 ` +
          'blender 실행 파일의 전체 경로를 넣는다.',
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

  if (spec.kind !== 'frames' && !fs.existsSync(output)) {
    console.error(`  ✗ 판정 줄은 성공인데 산출물이 없다: ${spec.output}`);
    return 1;
  }

  const { problems, summary } =
    spec.kind === 'frames' ? judgeFrames(line.payload, spec) : judgeRender(output);
  console.log(`  ${summary}`);
  if (problems.length > 0) {
    for (const p of problems) console.error(`  ✗ ${p}`);
    return 1;
  }

  console.log(`  ✓ ${spec.label} 통과 — ${spec.output}`);
  return 0;
}

/**
 * 이 도구가 요구하는 Node 최소 버전.
 *
 * `--experimental-strip-types`로 `.ts`를 그대로 돌리는데 그 플래그가 22.6에 들어왔다. 이
 * 프로젝트는 장비 둘을 오가므로, 낮은 Node가 깔린 쪽에서는 스트립이 문법 오류로 죽고 그
 * 메시지에 원인이 Node 버전이라는 것이 안 드러난다. `tools/art/judge.ts`와 같은 기준이다.
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
  const name = process.argv[2];
  if (!name) {
    throw new Error(`사용법: gate.ts <${Object.keys(GATES).join('|')}>`);
  }
  process.exitCode = runGate(name);
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}
