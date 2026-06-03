#!/usr/bin/env node
// .claude/workflow.mjs
// 워크플로우 상태의 "단일 작성자".
// 상태 변경은 반드시 이 CLI를 통해서만 일어난다 (hook이 JSON 직접 편집을 차단).
// 사용: node .claude/workflow.mjs <command> [args]

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_PATH = path.join(ROOT, ".claude", "workflow-state.json");

// phase = 단일 진실. 아래 순서가 곧 정상 진행 순서다.
const PHASES = [
  "planning",
  "qa-setup",
  "implementation",
  "verification",
  "user-verification",
  "pr-ready",
  "done",
];

const CHECKS = ["cso", "ts", "lint", "review"]; // verification 하위 단계
const CHECK_FLAG = {
  cso: "cso_done",
  ts: "ts_check_clean",
  lint: "lint_clean",
  review: "code_review_clean",
};

// 스크립트 편집이 허용되는 phase (hook과 동일한 기준)
export const EDITABLE_PHASES = new Set(["implementation", "verification"]);

function fail(msg) {
  process.stderr.write(`✗ ${msg}\n`);
  process.exit(1);
}

function freshState(feature) {
  return {
    feature: feature ?? null,
    phase: "planning",
    test_skipped: false,
    test_skip_reason: null,
    verification: {
      cso_done: false,
      ts_check_clean: false,
      lint_clean: false,
      code_review_clean: false,
    },
  };
}

function load() {
  if (!fs.existsSync(STATE_PATH)) {
    fail("workflow-state.json 없음. 먼저 `start <feature>`를 실행하세요.");
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch (e) {
    fail(`workflow-state.json 파싱 실패: ${e.message}`);
  }
}

function save(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  const tmp = `${STATE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  fs.renameSync(tmp, STATE_PATH); // 원자적 교체
}

function requirePhase(state, expected) {
  if (state.phase !== expected) {
    fail(`현재 phase="${state.phase}" — 이 명령은 phase="${expected}"에서만 가능합니다.`);
  }
}

function resetVerification(state) {
  for (const f of Object.values(CHECK_FLAG)) state.verification[f] = false;
}

// vitest를 항상 run 모드로 실행한다 (bare vitest = watch 모드 → hang 방지).
// stdio는 상속해 결과가 그대로 보이게 하고, 예외가 아니라 종료코드로 판단한다.
// 반환: 0 = 통과, 그 외 = 실패/오류.
function runVitest(extraArgs = []) {
  const r = spawnSync("pnpm", ["exec", "vitest", "run", ...extraArgs], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true, // Windows .cmd 해석
  });
  return r.status;
}

// kebab-case feature → PascalCase (테스트 파일명 일관성)
function toPascal(slug) {
  return String(slug)
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");
}

// 해당 기능 관련 계획 문서: docs/development/sessions/ 안에서 파일명에
// feature 슬러그가 포함된 .md 를 찾는다(존재 여부만 검사 — 내용/형식은 무관).
function planDocPath(state) {
  const dir = path.join(ROOT, "docs", "development", "sessions");
  if (!fs.existsSync(dir) || !state.feature) return null;
  const hit = fs
    .readdirSync(dir)
    .find((f) => f.endsWith(".md") && f.includes(state.feature));
  return hit ? path.join(dir, hit) : null;
}

function qaDocPath(state) {
  return path.join(ROOT, "docs", "qa", `${state.feature}-test.md`);
}
function testFilePath(state) {
  return path.join(ROOT, "tests", "logic", `${toPascal(state.feature)}.test.ts`);
}

const commands = {
  // 새 기능 시작 — 모든 플래그 초기화
  start(args) {
    const feature = args[0];
    if (!feature) fail("사용법: start <feature-slug>");
    save(freshState(feature));
    console.log(`✓ start: feature="${feature}", phase=planning (전체 초기화)`);
  },

  // 사람의 계획 승인
  "approve-plan"() {
    const s = load();
    requirePhase(s, "planning");

    // 문서 게이트: 해당 기능 관련 계획 문서가 없으면 전이 차단.
    // (planning→qa-setup이 문서 없이 넘어가던 빈틈을 막는다. 존재 여부만 검사.)
    const doc = planDocPath(s);
    if (!doc) {
      fail(
        `계획 문서 없음: docs/development/sessions/ 에 "${s.feature}"가 포함된 .md가 없습니다.\n` +
          `  계획 승인 전에 계획 문서를 먼저 작성하세요 (예: <YYYY-MM-DD>-${s.feature}-plan.md).`
      );
    }

    s.phase = "qa-setup";
    resetVerification(s);
    save(s);
    console.log(
      `✓ approve-plan → phase=qa-setup (계획 문서 확인: ${path.relative(ROOT, doc)})`
    );
  },

  // 순수 로직 없음 → 테스트 스킵 (사유 필수)
  "skip-test"(args) {
    const s = load();
    requirePhase(s, "qa-setup");
    const reason = args.join(" ").trim();
    if (!reason) fail("사용법: skip-test \"<사유>\"");
    s.test_skipped = true;
    s.test_skip_reason = reason;
    save(s);
    console.log("✓ test_skipped=true");
  },

  // 구현 준비 완료 — 플래그가 아니라 디스크에서 직접 검증
  "ready-impl"() {
    const s = load();
    requirePhase(s, "qa-setup");
    const docOk = fs.existsSync(qaDocPath(s));
    const testOk = s.test_skipped || fs.existsSync(testFilePath(s));
    if (!docOk) fail(`QA 문서 없음: ${path.relative(ROOT, qaDocPath(s))}`);
    if (!testOk)
      fail(
        `테스트 파일 없음(스킵도 아님): ${path.relative(ROOT, testFilePath(s))}`
      );

    // RED 게이트: 스킵이 아니면 피처 테스트가 실제로 실패(RED)하는지 검증.
    // 구현이 없어 실패하는 게 정상적인 TDD 시작점이므로, 통과해 버리면 차단한다.
    if (!s.test_skipped) {
      const rel = path.relative(ROOT, testFilePath(s)).split(path.sep).join("/");
      console.log(`\n▶ RED 확인: vitest run ${rel}`);
      const status = runVitest([rel]);
      if (status === 0) {
        fail(
          "테스트가 RED가 아닙니다 (피처 테스트가 통과함). " +
            "구현 전 실패하는 테스트를 먼저 작성하세요."
        );
      }
      console.log("✓ RED 확인됨 (피처 테스트 실패 — 정상)\n");
    }

    s.phase = "implementation";
    save(s);
    console.log("✓ ready-impl → phase=implementation (스크립트 편집 허용)");
  },

  // 구현 종료 → 검증 진입
  "start-verification"() {
    const s = load();
    requirePhase(s, "implementation");

    // GREEN 게이트: 전체 스위트가 통과해야 검증에 진입한다.
    // (test_skipped 여부와 무관 — 다른 로직 테스트는 항상 통과해야 한다.)
    console.log("\n▶ GREEN 확인: vitest run (전체 스위트)");
    if (runVitest([]) !== 0) {
      fail(
        "테스트 실패 — 전체 스위트가 통과해야 검증에 진입할 수 있습니다. 수정 후 다시 실행하세요."
      );
    }
    console.log("✓ GREEN 확인됨 (전체 스위트 통과)\n");

    s.phase = "verification";
    resetVerification(s);
    save(s);
    console.log("✓ start-verification → phase=verification");
  },

  // 개별 검증 통과 표시. 4개 모두 통과 시 자동으로 user-verification 진입
  pass(args) {
    const s = load();
    requirePhase(s, "verification");
    const check = args[0];
    if (!CHECKS.includes(check))
      fail(`사용법: pass <${CHECKS.join("|")}>`);
    s.verification[CHECK_FLAG[check]] = true;
    const allClean = Object.values(s.verification).every(Boolean);
    if (allClean) {
      s.phase = "user-verification";
      save(s);
      console.log(`✓ pass ${check} → 전체 통과 → phase=user-verification (편집 잠금)`);
    } else {
      save(s);
      console.log(`✓ pass ${check}`);
    }
  },

  // verification 중 코드 변경 → 모든 검증 무효화 (cso 포함, 비대칭 제거)
  invalidate() {
    const s = load();
    requirePhase(s, "verification");
    resetVerification(s);
    save(s);
    console.log("✓ invalidate: 전체 검증 초기화 — cso부터 다시 실행하세요");
  },

  // 사용자 검증 중 버그 발견 → 구현으로 복귀 (편집 재허용)
  rework() {
    const s = load();
    requirePhase(s, "user-verification");
    s.phase = "implementation";
    resetVerification(s);
    save(s);
    console.log("✓ rework → phase=implementation (스크립트 편집 재허용)");
  },

  // 사람의 PR 승인
  "approve-pr"() {
    const s = load();
    requirePhase(s, "user-verification");
    s.phase = "pr-ready";
    save(s);
    console.log("✓ approve-pr → phase=pr-ready");
  },

  // PR 생성·머지 완료
  "pr-done"() {
    const s = load();
    requirePhase(s, "pr-ready");
    s.phase = "done";
    save(s);
    console.log("✓ pr-done → phase=done");
  },

  status() {
    const s = load();
    const editable = EDITABLE_PHASES.has(s.phase);
    console.log(JSON.stringify(s, null, 2));
    console.log(`\nscripts editable: ${editable ? "YES" : "no (locked)"}`);
  },
};

const [, , cmd, ...args] = process.argv;
if (!cmd || !commands[cmd]) {
  console.log(`commands: ${Object.keys(commands).join(", ")}`);
  process.exit(cmd ? 1 : 0);
}
commands[cmd](args);
