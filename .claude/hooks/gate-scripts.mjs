#!/usr/bin/env node
// .claude/hooks/gate-scripts.mjs
// PreToolUse hook (matcher: "Write|Edit|MultiEdit").
// 1) workflow-state.json 직접 편집 차단 → 상태 변경은 workflow.mjs CLI로만.
// 2) game/assets/scripts/**/*.ts 편집은 phase가 implementation|verification일 때만 허용.
// 출력은 공식 스키마: hookSpecificOutput.permissionDecision.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_PATH = path.join(ROOT, ".claude", "workflow-state.json");
const EDITABLE_PHASES = new Set(["implementation", "verification"]);

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

// (2) 게이트 대상은 게임 스크립트뿐. 그 외(tests/, docs/, 기타 .claude/ 등)는 통과
const isGated = rel.startsWith("game/assets/scripts/") && rel.endsWith(".ts");
if (!isGated) allow();

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

if (EDITABLE_PHASES.has(phase)) allow();

deny(
  `⛔ [GATE] 현재 phase="${phase}". 스크립트 편집은 implementation/verification에서만 가능합니다. ` +
    `검증 완료 후 버그면 \`workflow.mjs rework\`, 계획 전이면 \`approve-plan\`/\`ready-impl\`을 사용하세요.`
);
