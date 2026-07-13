#!/usr/bin/env node
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
const COCOS_BASE = path.join(ROOT, "game", "temp", "tsconfig.cocos.json");

// tsc를 프로젝트 하나에 대해 돌린다.
// 주의: tsc는 **타입 에러에도 종료코드 2**를 낸다(1이 아니다). 설정 에러(TS5083)도 2다.
// 따라서 `!== 0`으로만 판정한다 — `=== 1` 비교를 쓰면 모든 타입 에러를 통과시킨다.
// spawnSync 자체가 실패하면 status가 null이라 fail-closed지만, error를 따로 보고한다.
// 반환: 0 = 통과, 그 외 = 실패.
function runTsc(project) {
  const r = spawnSync("pnpm", ["exec", "tsc", "-p", project, "--noEmit"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true, // Windows .cmd 해석
  });
  if (r.error) {
    process.stderr.write(`✗ tsc 실행 실패(${project}): ${r.error.message}\n`);
    return 1;
  }
  return r.status;
}

/**
 * 두 프로젝트를 검사한다.
 * @returns {{ status: number|null, scope: 'full'|'logic-only'|null }}
 *   status 0 = 통과. 그 외는 실패이며, 프로세스가 시그널로 죽으면 null일 수 있다(호출자는 `!== 0`으로 판정할 것).
 *   scope는 **통과했을 때** 실제로 검사한 범위다 — 'logic-only'면 게임 코드는 안 봤다는 뜻이다.
 *   실패 시 scope는 null이다("검사 못 함"과 "게임 코드는 안 봄"은 다른 상태).
 */
export function runTypecheck() {
  console.log("\n▶ 타입체크 1/2: tsconfig.tests.json (tests + logic + data — Cocos 무관)");
  const testsStatus = runTsc("tsconfig.tests.json");
  // 실패 시 scope는 null이다 — "검사 못 함"과 "게임 코드는 안 봄(logic-only)"은 다른 상태다.
  if (testsStatus !== 0) return { status: testsStatus, scope: null };
  console.log("✓ tests/logic/data 통과");

  if (!fs.existsSync(COCOS_BASE)) {
    console.log("\n▶ 타입체크 2/2: game/tsconfig.json — 건너뜀");
    process.stderr.write(
      "\n⚠ Cocos 생성 파일이 없어 게임 프로젝트를 검사할 수 없습니다.\n" +
        `    없는 파일: ${path.relative(ROOT, COCOS_BASE)} (gitignore 대상 — Cocos가 만든다)\n` +
        "    Cocos Creator로 이 프로젝트를 한 번 열어 temp/를 생성한 뒤 다시 실행하세요.\n" +
        "    지금 검사한 범위: logic-only (게임 코드 미검사 — 이 상태로는 PR 승인이 막힙니다)\n"
    );
    return { status: 0, scope: "logic-only" };
  }

  console.log("\n▶ 타입체크 2/2: game/tsconfig.json (게임 전체)");
  const gameStatus = runTsc("game/tsconfig.json");
  if (gameStatus !== 0) return { status: gameStatus, scope: null };
  console.log("✓ 게임 코드 통과");

  return { status: 0, scope: "full" };
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
