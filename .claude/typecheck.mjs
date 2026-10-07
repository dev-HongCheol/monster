#!/usr/bin/env node
// @ts-check
// .claude/typecheck.mjs
// 레포 소유 타입체크. `pnpm typecheck`와 `pnpm wf pass ts`가 **같은 코드**를 쓴다 —
// 그래야 "명령은 있는데 게이트는 안 도는" 상황이 생기지 않는다.
//
// 프로젝트 두 개를 검사한다.
//   1) tsconfig.tests.json  — tests/ + logic/ + data/. cc 의존이 없어 **어디서든** 돈다.
//   2) game/tsconfig.json   — 게임 전체. Cocos가 생성하는 game/temp/ 선언이 필요하다.
//
// game/temp/는 gitignore 대상이고 내부에 절대 경로가 박혀 있어, Cocos로 프로젝트를 한 번도
// 열지 않은 머신에서는 (2)가 TS5083으로 죽는다. 그때 날것의 에러 대신 안내를 내고,
// **검사 범위를 "logic-only"로 보고**한다. 호출자(workflow.mjs)가 그 범위를 상태에 기록하고
// approve-pr에서 거부한다 — 그러지 않으면 "Cocos 안 깐 머신 = 타입 게이트 프리패스"가 된다.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

/**
 * `spawnSync`와 같은 모양의 함수. 통합 검사의 단위 테스트가 가짜를 넘긴다.
 * @typedef {(cmd: string, args: string[], opts: import("node:child_process").SpawnSyncOptions) =>
 *   { status: number | null, stdout?: string | null, stderr?: string | null, error?: Error }} Spawn
 */

/** tsc가 수천 줄을 내도 받을 수 있게 한다. 기본값 1MiB로는 `game/temp` 설정이 깨진 날의 출력을 다 받지 못한다. */
const MAX_BUFFER = 64 * 1024 * 1024;

// spawnSync는 겹쳐 정의(overload)된 함수라 Spawn 모양에 바로 맞지 않아서 형을 좁혀 둔다.
const SPAWN_SYNC = /** @type {Spawn} */ (/** @type {unknown} */ (spawnSync));

// tsc를 프로젝트 하나에 대해 돌린다.
// 주의: tsc는 **타입 에러에도 종료코드 2**를 낸다(1이 아니다). 설정 에러(TS5083)도 2다.
// 따라서 `!== 0`으로만 판정한다 — `=== 1` 비교를 쓰면 모든 타입 에러를 통과시킨다.
// spawnSync 자체가 실패하면 status가 null이라 fail-closed지만, error를 따로 보고한다.
// capture 모드에서는 화면에 쓰지 않고 출력과 `spawnSync` 결과를 그대로 돌려준다. 실행기를 실행하지 못한
// 것인지(ENOENT·9009) 출력이 넘친 것인지는 통합 검사(`lib/verify.mjs`)가 그 결과로 가른다.
/**
 * @param {string} project tsconfig 경로(레포 루트 기준)
 * @param {{ capture: boolean, spawn: Spawn, root: string }} opts
 * @returns {{ status: number | null, output: string, raw: ReturnType<Spawn> }}
 *   status 0 = 통과, 그 외 = 실패. capture가 아니면 output은 빈 문자열이다
 */
function runTsc(project, { capture, spawn, root }) {
  const r = spawn("pnpm", ["exec", "tsc", "-p", project, "--noEmit"], {
    cwd: root,
    shell: true, // Windows .cmd 해석
    ...(capture ? { encoding: "utf8", maxBuffer: MAX_BUFFER } : { stdio: "inherit" }),
  });
  if (capture) {
    const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    return { status: r.error ? 1 : r.status, output, raw: r };
  }
  if (r.error) {
    process.stderr.write(`✗ tsc 실행 실패(${project}): ${r.error.message}\n`);
    return { status: 1, output: "", raw: r };
  }
  return { status: r.status, output: "", raw: r };
}

/**
 * 두 프로젝트를 검사한다.
 *
 * capture가 참이면 진행 줄(「▶ 타입체크 1/2」)과 `⚠` 안내를 화면에 쓰지 않고 tsc 출력만 `output`으로
 * 돌려준다. 통합 검사가 세 검사의 결과를 한 번에 정리해 출력하기 때문이다. `pnpm typecheck`로 혼자
 * 실행할 때는 지금처럼 화면에 바로 쓴다.
 *
 * @param {{ capture?: boolean, spawn?: Spawn, root?: string }} [opts]
 *   spawn·root는 테스트가 가짜 실행기와 임시 폴더를 넘길 때 쓴다
 * @returns {{ status: number|null, scope: 'full'|'logic-only'|null, output: string, raw: ReturnType<Spawn> | null }}
 *   status 0 = 통과. 그 외는 실패이며, 프로세스가 시그널로 죽으면 null일 수 있다(호출자는 `!== 0`으로 판정할 것).
 *   scope는 **통과했을 때** 실제로 검사한 범위다 — 'logic-only'면 게임 코드는 안 봤다는 뜻이다.
 *   실패 시 scope는 null이다("검사 못 함"과 "게임 코드는 안 봄"은 다른 상태).
 *   output은 capture일 때의 tsc 출력, raw는 마지막으로 실행한 tsc의 `spawnSync` 결과다.
 */
export function runTypecheck({ capture = false, spawn = SPAWN_SYNC, root = ROOT } = {}) {
  /** @param {string} line */
  const say = (line) => {
    if (!capture) console.log(line);
  };
  const cocosBase = path.join(root, "game", "temp", "tsconfig.cocos.json");

  say("\n▶ 타입체크 1/2: tsconfig.tests.json (tests + logic + data — Cocos 무관)");
  const tests = runTsc("tsconfig.tests.json", { capture, spawn, root });
  // 실패 시 scope는 null이다 — "검사 못 함"과 "게임 코드는 안 봄(logic-only)"은 다른 상태다.
  if (tests.status !== 0) {
    return { status: tests.status, scope: null, output: tests.output, raw: tests.raw };
  }
  say("✓ tests/logic/data 통과");

  if (!fs.existsSync(cocosBase)) {
    if (!capture) {
      console.log("\n▶ 타입체크 2/2: game/tsconfig.json — 건너뜀");
      process.stderr.write(
        "\n⚠ Cocos 생성 파일이 없어 게임 프로젝트를 검사할 수 없습니다.\n" +
          `    없는 파일: ${path.relative(root, cocosBase)} (gitignore 대상 — Cocos가 만든다)\n` +
          "    Cocos Creator로 이 프로젝트를 한 번 열어 temp/를 생성한 뒤 다시 실행하세요.\n" +
          "    지금 검사한 범위: logic-only (게임 코드 미검사 — 이 상태로는 PR 승인이 막힙니다)\n"
      );
    }
    return { status: 0, scope: "logic-only", output: tests.output, raw: tests.raw };
  }

  say("\n▶ 타입체크 2/2: game/tsconfig.json (게임 전체)");
  const game = runTsc("game/tsconfig.json", { capture, spawn, root });
  const output = `${tests.output}${game.output}`;
  if (game.status !== 0) return { status: game.status, scope: null, output, raw: game.raw };
  say("✓ 게임 코드 통과");

  return { status: 0, scope: "full", output, raw: game.raw };
}

// CLI로 직접 실행된 경우 (= `pnpm typecheck`).
// pathToFileURL을 쓴다 — Windows 경로를 손으로 file:// URL로 만들면 슬래시 개수가 어긋난다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { status, scope } = runTypecheck();
  if (status === 0) {
    console.log(`\n✓ 타입체크 통과 (범위: ${scope})`);
  } else {
    process.stderr.write("\n✗ 타입체크 실패\n");
  }
  // status가 null일 수 있다(프로세스가 시그널로 죽은 경우). process.exit(null)은 종료코드 0이라
  // 실패가 성공으로 읽힌다 — CI·훅에 물리는 순간 구멍이 되므로 1로 접는다.
  process.exit(status ?? 1);
}
