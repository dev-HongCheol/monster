/**
 * 1라운드 게이트 0b · 0c · 2 — 시험용 `.vrm`과 Quaternius 모션 팩으로 걷기 여덟 장을 굽고 재던 게이트다.
 *
 * **판정이 끝나 물러난 도구다(2026-09-19).** 2라운드는 생산 `.vrm` 셋과 스크립트 키프레임으로 다시 굽고(R2-D7),
 * 게이트 2가 굽던 자리인 Cocos 테스트 씬도 게임 폴더에서 뺐다 — 1라운드 그림은 정면 한 방향이고 지금 캐릭터와도
 * 달라서, 4방향 × 층으로 다시 짜는 G5에 쓸 것이 없다. 입력과 출력은 모두 추적하지 않는
 * `cloud-storage/art/evidence/player/2026-09-11-3d-gate/`에 있다. G4가 끝나면 지운다(`README.md`).
 *
 * 실행기는 `../gate.ts`의 것을 그대로 쓰고 이 파일은 표만 든다.
 *
 * 돌리는 법: `node --experimental-strip-types tools/blender/retired/gate-round1.ts 0b`
 * 굽지 않고 이미 있는 산출물만 다시 재려면 `--judge-only`를 붙인다.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANVAS_ARGS, FRAME_ARGS, type IGateSpec, main } from '../gate.ts';

/** 1라운드 입력과 산출물이 있는 폴더. 추적하지 않는다 */
const ROUND1 = 'cloud-storage/art/evidence/player/2026-09-11-3d-gate';

/** 1라운드 시험용 캐릭터 */
const VRM = `${ROUND1}/character.vrm`;

/** Quaternius Universal Animation Library(CC0). 2라운드는 쓰지 않는다 */
const MOTION = `${ROUND1}/motion/Unreal-Godot/UAL1_Standard.glb`;

/**
 * 1라운드 게이트 표. 앞 게이트가 통과한 뒤에 다음 줄을 붙여 왔다.
 *
 * **0c와 2는 같은 스크립트를 부르고 굽는 자리만 다르다.** 0c는 `docs/temp/`에 구워 판정만
 * 하고, 2는 Cocos 테스트 씬 폴더에 구워 Cocos가 임포트할 것을 남겼다. 그래서 2를
 * 돌리기 전에 0c가 먼저 통과해야 하고, 반대로 0c를 다시 돌린다고 씬의 프레임이 바뀌지 않는다.
 * 테스트 씬 폴더는 게임 폴더에서 나와 `cocos-test-scene/` 아래에 보관돼 있다.
 */
const ROUND1_GATES: Record<string, IGateSpec> = {
  '0b': {
    script: 'tools/blender/retired/import_vrm.py',
    output: 'docs/temp/3d-gate/gate0b_front.png',
    label: '게이트 0b — VRM 임포트',
    extraArgs: [
      { flag: '--vrm', repoPath: VRM },
      { flag: '--bones', repoPath: 'docs/temp/3d-gate/bones.json' },
      ...CANVAS_ARGS,
    ],
  },
  '0c': {
    script: 'tools/blender/retarget_render.py',
    output: 'docs/temp/3d-gate/walk',
    label: '게이트 0c — 걷기 리타게팅',
    kind: 'frames',
    expectFrames: 8,
    extraArgs: [
      { flag: '--vrm', repoPath: VRM },
      { flag: '--motion', repoPath: MOTION },
      { flag: '--action', value: 'Walk_Loop' },
      { flag: '--frames', value: '8' },
      { flag: '--gate', value: '0c' },
      ...FRAME_ARGS,
    ],
  },
  '2': {
    script: 'tools/blender/retarget_render.py',
    output: `${ROUND1}/cocos-test-scene/test-3d-gate`,
    label: '게이트 2 — 1라운드 테스트 씬 프레임',
    kind: 'frames',
    expectFrames: 8,
    extraArgs: [
      { flag: '--vrm', repoPath: VRM },
      { flag: '--motion', repoPath: MOTION },
      { flag: '--action', value: 'Walk_Loop' },
      { flag: '--frames', value: '8' },
      { flag: '--gate', value: '2' },
      ...FRAME_ARGS,
    ],
  },
};

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) main(ROUND1_GATES);
