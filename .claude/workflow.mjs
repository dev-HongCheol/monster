#!/usr/bin/env node
// .claude/workflow.mjs
// 워크플로우 상태의 "단일 작성자".
// 상태 변경은 반드시 이 CLI를 통해서만 일어난다 (hook이 JSON 직접 편집을 차단).
// 사용: node .claude/workflow.mjs <command> [args]

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { runTypecheck } from "./typecheck.mjs";

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
    // `pass ts`가 실제로 검사한 범위. "full" = 게임 코드 포함, "logic-only" = Cocos 생성물이
    // 없어 게임 코드를 못 봄. approve-pr이 "full"이 아니면 거부한다(머신 상태로 게이트를
    // 우회하는 것을 막는다). verification 안이 아니라 밖에 두는 이유: pass()의
    // `Object.values(verification).every(Boolean)` 판정에 문자열이 섞이면 안 된다.
    ts_check_scope: null,
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
  state.ts_check_scope = null; // 검사 범위도 함께 무효화 — 재검증 없이 남으면 안 된다
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

// git 명령 실행 헬퍼. encoding="utf8"로 출력 캡처, 결과 객체 반환.
function git(args, opts = {}) {
  return spawnSync("git", args, { cwd: ROOT, encoding: "utf8", ...opts });
}

// Cocos 규칙: assets/ 아래 모든 파일·디렉터리는 형제 `.meta`(UUID 보관)를 가진다.
// `.meta`가 추적되지 않으면 클론·타 환경에서 UUID가 재생성돼 씬/프리팹 참조가 깨진다.
// 추적(git index)되는 에셋 중 `<경로>.meta`가 추적되지 않는 항목 목록을 반환한다.
// 반환: { error: string|null, missing: string[] }
function listMissingAssetMeta() {
  const r = git(["ls-files", "game/assets"]);
  if (r.status !== 0) {
    return { error: (r.stderr || "git ls-files 실패").trim(), missing: [] };
  }
  const tracked = r.stdout.split("\n").filter(Boolean);
  const trackedSet = new Set(tracked);
  const hasMeta = (p) => trackedSet.has(`${p}.meta`);
  const missing = [];

  // 1) 파일 메타: 모든 non-.meta 파일은 <file>.meta 가 추적돼야 한다.
  for (const f of tracked) {
    if (f.endsWith(".meta")) continue;
    if (!hasMeta(f)) missing.push(f);
  }

  // 2) 디렉터리 메타: game/assets/ 하위 모든 디렉터리는 <dir>.meta 가 필요하다.
  //    (game, game/assets 루트는 meta가 없으므로 제외 → i는 2부터)
  const dirs = new Set();
  for (const f of tracked) {
    const parts = f.split("/");
    for (let i = 2; i < parts.length - 1; i++) {
      dirs.add(parts.slice(0, i + 1).join("/"));
    }
  }
  for (const d of dirs) {
    if (!hasMeta(d)) missing.push(`${d}/  (디렉터리)`);
  }

  return { error: null, missing: missing.sort() };
}

// 누락 메타가 있으면 목록을 출력하고 fail()로 차단한다. 없으면 통과 로그.
function requireAssetMeta() {
  const { error, missing } = listMissingAssetMeta();
  if (error) fail(`에셋 메타 검사 실패: ${error}`);
  if (missing.length > 0) {
    process.stderr.write("✗ 추적되지 않은 .meta가 있는 에셋:\n");
    for (const m of missing) process.stderr.write(`    - ${m}\n`);
    fail(
      `위 에셋의 .meta가 커밋되지 않았습니다. 머지 전 반드시 커밋해야 합니다 ` +
        `(누락 시 타 환경에서 UUID 재생성 → 씬/프리팹 참조 깨짐). ` +
        `에디터에서 생성된 .meta를 git add 후 커밋하고 다시 시도하세요.`,
    );
  }
  console.log("✓ 에셋 .meta 누락 없음");
}

// feat/<feature> 브랜치를 보장한다 — 없으면 main 기준 생성, 있으면 전환.
// 슬라이스 시작점 = 브랜치 시작점. planning 커밋이 main에 직접 쌓이는 사고를 막는다.
function ensureFeatureBranch(feature) {
  const branch = `feat/${feature}`;
  const exists =
    git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0;
  const r = exists
    ? git(["switch", branch], { stdio: "inherit" })
    : git(["switch", "-c", branch, "main"], { stdio: "inherit" });
  if (r.status !== 0) {
    fail(
      `브랜치 전환/생성 실패: ${branch}\n` +
        "  작업 트리에 충돌하는 변경이 있으면 정리(commit/stash) 후 다시 실행하세요."
    );
  }
  return branch;
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

// QA 문서의 미확정(잠정) 표시 검사. qa-setup에선 프리팹/씬·에디터 섹션을 계획 기준 잠정안으로
// 쓰며 제목/값에 `(잠정 …)`·`(가칭 …)` 태그를 단다. 구현 완료 후(GREEN 직후) 실제 컴포넌트에
// 맞춰 확정하며 그 태그를 `(확정)`으로 바꾼다 — 코드가 정본이고 QA 문서가 그 거울이다.
// feature QA 문서에 남은 잠정 태그 줄(번호:내용)을 반환한다(없으면 빈 배열).
function listQaProvisionalMarkers(state) {
  const p = qaDocPath(state);
  if (!fs.existsSync(p)) return [];
  const out = [];
  const lines = fs.readFileSync(p, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/\(잠정|\(가칭/.test(line)) out.push(`${i + 1}: ${line.trim()}`);
  });
  return out;
}

const commands = {
  // 새 기능 시작 — feat/<feature> 브랜치 생성·전환 + 모든 플래그 초기화
  start(args) {
    const feature = args[0];
    if (!feature) fail("사용법: start <feature-slug>");
    // 브랜치를 먼저 보장한 뒤, 그 브랜치의 작업 트리에 초기 상태를 기록한다.
    const branch = ensureFeatureBranch(feature);
    save(freshState(feature));
    console.log(
      `✓ start: feature="${feature}", branch=${branch}, phase=planning (전체 초기화)`
    );
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

    // TS 게이트: 다른 검증(cso·lint·review)은 사람/AI의 판단이라 플래그로만 기록하지만,
    // 타입체크는 기계가 판정할 수 있다. 그러니 실제로 돌린다 — 안 돌리면 `pass ts`는
    // "돌렸다고 말하는 것"에 지나지 않는다. ready-impl이 vitest로 RED를,
    // start-verification이 GREEN을 확인하는 것과 같은 패턴이다.
    if (check === "ts") {
      const { status, scope } = runTypecheck();
      if (status !== 0) {
        fail("타입체크 실패 — 에러를 고친 뒤 다시 실행하세요. (`pnpm typecheck`로 재현)");
      }
      s.ts_check_scope = scope;
    }

    s.verification[CHECK_FLAG[check]] = true;
    const allClean = Object.values(s.verification).every(Boolean);
    if (allClean) {
      // QA 확정 게이트: user-verification 진입 전, QA 프리팹/에디터 섹션이 코드에 맞춰 확정됐는지
      // (= 잠정 태그가 제거됐는지) 확인한다. 남아 있으면 전이를 막는다(pass 플래그는 보존 — 확정 후
      // 같은 `pass`를 다시 실행하면 곧장 전이). stale 프리팹 레시피가 7단계 사용자 테스트로 새는 것을 막는다.
      const prov = listQaProvisionalMarkers(s);
      if (prov.length > 0) {
        save(s);
        const rel = path.relative(ROOT, qaDocPath(s));
        process.stderr.write(
          "✗ QA 문서에 미확정(잠정) 표시가 남아 있습니다 — 구현된 코드·컴포넌트에 맞춰 확정하세요:\n"
        );
        for (const h of prov) process.stderr.write(`    ${rel}:${h}\n`);
        fail(
          "프리팹/씬·에디터 섹션의 `(잠정)`/`(가칭)`을 실제 값으로 고쳐 `(확정)`으로 바꾼 뒤 " +
            `\`pnpm wf pass ${check}\`를 다시 실행하면 user-verification으로 전이됩니다.`
        );
      }
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
    // 타입체크 범위 게이트: `pass ts`가 게임 코드까지 봤어야 한다.
    // Cocos를 한 번도 안 연 머신에서는 game/temp/가 없어 게임 프로젝트를 검사할 수 없고,
    // 그 상태를 통과시키면 "Cocos 안 깐 머신 = 타입 게이트 프리패스"가 된다.
    if (s.ts_check_scope !== "full") {
      fail(
        `타입체크 범위가 "${s.ts_check_scope ?? "미검사"}"입니다 — 게임 코드가 검사되지 않았습니다.\n` +
          "    Cocos Creator로 프로젝트를 한 번 열어 game/temp/를 생성한 뒤 " +
          "`pnpm wf invalidate` → 검증을 다시 돌리세요."
      );
    }
    // 메타 게이트: 신규 자산의 .meta가 모두 커밋돼야 PR을 승인할 수 있다.
    // (머지 직전 마지막 안전장치 — 누락 시 머지 후 모든 환경에서 참조가 깨진다.)
    console.log("\n▶ 에셋 .meta 누락 검사");
    requireAssetMeta();
    s.phase = "pr-ready";
    save(s);
    console.log("✓ approve-pr → phase=pr-ready");
  },

  // 에셋 .meta 누락 검사 (단독 실행 — 언제든 확인용). 누락 있으면 종료코드 1.
  "check-meta"() {
    requireAssetMeta();
  },

  // QA 문서 미확정(잠정) 표시 검사 (단독 실행 — 언제든 확인용). 남아 있으면 종료코드 1.
  "check-qa"() {
    const s = load();
    const prov = listQaProvisionalMarkers(s);
    if (prov.length > 0) {
      const rel = path.relative(ROOT, qaDocPath(s));
      process.stderr.write("✗ QA 문서 미확정(잠정) 표시:\n");
      for (const h of prov) process.stderr.write(`    ${rel}:${h}\n`);
      process.exit(1);
    }
    console.log("✓ QA 문서 확정됨 (잠정 표시 없음)");
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
