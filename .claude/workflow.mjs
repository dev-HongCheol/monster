#!/usr/bin/env node
// .claude/workflow.mjs
// 워크플로우 상태의 "단일 작성자".
// 상태 변경은 반드시 이 CLI를 통해서만 일어난다 (hook이 JSON 직접 편집을 차단).
// 사용: node .claude/workflow.mjs <command> [args]

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

// kebab-case feature → PascalCase (테스트 파일명 일관성)
function toPascal(slug) {
  return String(slug)
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");
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
    s.phase = "qa-setup";
    resetVerification(s);
    save(s);
    console.log("✓ approve-plan → phase=qa-setup");
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
    s.phase = "implementation";
    save(s);
    console.log("✓ ready-impl → phase=implementation (스크립트 편집 허용)");
  },

  // 구현 종료 → 검증 진입
  "start-verification"() {
    const s = load();
    requirePhase(s, "implementation");
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
