#!/usr/bin/env node
// .claude/hooks/gate-scripts.mjs
// PreToolUse hook (matcher: "Write|Edit|MultiEdit").
// 1) workflow-state.json 직접 편집 차단 → 상태 변경은 workflow.mjs CLI로만.
// 2) 저장소 안의 코드 편집은 phase가 implementation|verification일 때만 허용한다. 코드는 게임 스크립트,
//    워크플로우 도구와 훅, 테스트, tools/ 스크립트, 그리고 고치면 훅이나 검사를 끌 수 있는 설정 파일이다.
//    테스트 코드는 RED 테스트를 쓰는 qa-setup에서도 허용한다.
// 출력은 공식 스키마: hookSpecificOutput.permissionDecision.
//
// 도구가 고장 나서 잠긴 phase에서 코드를 고쳐야 할 때도 이 훅은 길을 열어 두지 않는다. 다른 길로
// 돌아가는 판단은 사용자가 한다(docs/development/troubleshooting/wf-tool-recovery.md).

import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_PATH = path.join(ROOT, ".claude", "workflow-state.json");
export const EDITABLE_PHASES = new Set(["implementation", "verification"]);
export const TEST_EDITABLE_PHASES = new Set(["qa-setup", "implementation", "verification"]);

/** 확장자로 가르는 코드 파일. 저장소 어디에 있든 잠근다. */
const CODE_EXT = /\.(ts|tsx|js|mjs|cjs|py|sh|ps1)$/;

/**
 * 확장자는 코드가 아니지만 잠그는 파일. 훅을 등록하는 `.claude/settings.json`, 실행할 스크립트와 커밋 훅
 * 대상을 정하는 `package.json`, 검사 범위를 정하는 biome·tsconfig 설정, 커밋 훅이다. 이 파일들을 고치면
 * 이 훅이나 통합 검사를 끌 수 있어서, 코드만 잠그면 잠금을 빠져나갈 길이 남는다.
 */
function isCheckConfig(rel) {
  return (
    rel === ".claude/settings.json" ||
    rel.startsWith(".husky/") ||
    /(^|\/)(package|biome|tsconfig[^/]*)\.json$/.test(rel)
  );
}

/**
 * 저장소 기준 상대 경로의 파일을 고칠 수 있는 phase 목록. 잠그지 않는 파일이면 `null`이다.
 * 상태 파일은 여기서 다루지 않는다 — phase와 상관없이 늘 막는다.
 *
 * @param {string} rel `/`로 구분한 저장소 기준 상대 경로. 저장소 밖이면 `../`로 시작한다
 * @returns {Set<string> | null}
 */
export function editablePhasesFor(rel) {
  if (rel.startsWith("../") || path.isAbsolute(rel)) return null;
  if (rel.startsWith("node_modules/") || rel.includes("/node_modules/")) return null;
  if (isCheckConfig(rel)) return EDITABLE_PHASES;
  if (!CODE_EXT.test(rel)) return null;
  return rel.startsWith("tests/") ? TEST_EDITABLE_PHASES : EDITABLE_PHASES;
}

/**
 * 잠긴 파일을 막을 때 보여 줄 이유. AI가 다른 길로 돌아가지 않고 멈추도록, 사용자에게 알리라는 말을 넣는다.
 *
 * @param {string} rel 막은 파일의 저장소 기준 상대 경로
 * @param {string | undefined} phase 지금 phase
 * @param {Set<string>} phases 이 파일을 고칠 수 있는 phase 목록
 */
export function lockedReason(rel, phase, phases) {
  return (
    `⛔ [GATE] 현재 phase="${phase}". ${rel} 파일은 ${[...phases].join("/")}에서만 고칠 수 있습니다. ` +
    "구현 전이면 `ready-impl`로 구현에 들어가고, user-verification이면 사용자가 `리워크`를 입력해 돌아갑니다. " +
    "도구가 고장 나서 그 단계로 갈 수 없으면, " +
    "다른 방법으로 돌아가지 말고 멈춘 뒤 사용자에게 알리고 확인을 받으세요."
  );
}

function allow() {
  // 결정을 내리지 않고 통과 → 일반 권한 플로우를 따른다.
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function readStdin() {
  return new Promise((resolve) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => resolve(d));
  });
}

function norm(p) {
  // 절대/상대 모두 ROOT 기준 상대경로로 정규화 (구분자 통일)
  const rel = path.relative(ROOT, path.resolve(ROOT, p));
  return rel.split(path.sep).join("/");
}

async function main() {
  const raw = await readStdin();

  let filePath;
  try {
    filePath = JSON.parse(raw)?.tool_input?.file_path;
  } catch {
    // 입력을 못 읽으면 게이트 판단 불가 → fail-closed (조용한 우회보다 안전)
    deny("⛔ [GATE] hook 입력 파싱 실패. 게이트 판단 불가로 차단합니다.");
  }

  if (!filePath) allow();

  const rel = norm(filePath);

  // (1) 상태 파일 직접 편집 차단 — 모든 전이는 CLI로만
  if (rel === ".claude/workflow-state.json") {
    deny(
      "⛔ [GATE] workflow-state.json은 직접 수정할 수 없습니다. " +
        "`node .claude/workflow.mjs <command>`로 전이하세요."
    );
  }

  // (2) 잠그는 파일인지 — 코드가 아니면(docs/, 데이터 json 등) 통과
  const phases = editablePhasesFor(rel);
  if (!phases) allow();

  // 게이트 대상 → phase 확인 (없으면 fail-closed)
  if (!fs.existsSync(STATE_PATH)) {
    deny("⛔ [GATE] workflow-state.json 없음. `workflow.mjs start <feature>`부터 시작하세요.");
  }

  let phase;
  try {
    phase = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"))?.phase;
  } catch {
    deny("⛔ [GATE] workflow-state.json 파싱 실패로 차단합니다.");
  }

  if (phases.has(phase)) allow();

  deny(lockedReason(rel, phase, phases));
}

// 테스트는 판정 함수만 쓰려고 GATE_HOOK_IMPORT_ONLY를 켜고 import한다. 그런데 이 값만 보고 main()을
// 건너뛰면, 사용자 설정(settings.local.json의 env 등)에 이 값이 들어갔을 때 훅이 아무것도 하지 않아
// 잠금이 풀린다. 그래서 훅 파일을 직접 실행했으면 이 값과 상관없이 main()을 돈다. 직접 실행인지는 파일
// 이름만 비교한다 — 전체 경로를 비교하면 드라이브 문자 대소문자 같은 표기 차이로 어긋나서, 훅이 아무것도
// 하지 않고 끝날 수 있다.
const launchedDirectly = path.basename(process.argv[1] ?? "") === "gate-scripts.mjs";
if (launchedDirectly || process.env.GATE_HOOK_IMPORT_ONLY !== "1") await main();
