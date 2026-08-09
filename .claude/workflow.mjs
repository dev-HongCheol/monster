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
    // 이번 phase에서 이미 전문을 배달한 절차 문서. 두 번째부터는 요약만 낸다.
    // verification 안이 아니라 밖에 두는 이유: resetVerification()이 CHECK_FLAG 키만 순회하므로
    // 안에 넣으면 그 함수가 못 지워 invalidate 이후에도 배달 기록이 남는다.
    docs_delivered: [],
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
  // docs_delivered는 여기서 건드리지 않는다. invalidate가 이 함수를 부르므로 초기화를 넣으면
  // 매번 전문이 나가 차등 배달이 통째로 무력해진다. 초기화는 phase가 바뀌는 지점에서 한다.
}

// ── 절차 문서 배달 ──────────────────────────────────────────────────────────
// phase마다 같은 이름의 절차 문서가 하나 있고(`docs/development/workflow/<phase>.md`), 전이에
// 성공한 순간 그 문서를 그대로 찍는다. CLAUDE.md가 단계별 절차를 상시 들고 있지 않아도 되는 대신,
// 절차가 필요한 순간에 도착하게 하는 것이 이 기구의 전부다.
//
// 지켜야 할 성질 셋. ① 배달은 커맨드 함수 안이 아니라 **디스패치 뒤**에 붙는다 — 모든 실패 경로가
// fail() → process.exit(1)이라 실패한 전이에는 자동으로 배달이 안 간다(특히 pass는 네 검증이 다
// 통과한 뒤에도 QA 잠정 게이트에서 죽을 수 있어, 커맨드 안에서 배달하면 전이하지도 않은 절차가 샌다).
// ② 절대 throw하지 않고 종료코드를 바꾸지 않는다 — 배달이 실패로 보이면 상태는 이미 전이됐는데
// 재실행이 requirePhase에 막혀 사람이 갇힌다. ③ 문서가 없어도 전이를 막지 않는다 — 막으면 문서
// 하나 누락으로 워크플로가 멈추는데 빠져나올 경로가 없다.
const STEP_DOC_DIR = ["docs", "development", "workflow"];
const STEP_DOC_INDEX = "README.md";
// done = 슬라이스가 끝난 상태라 뒤에 밟을 절차가 없다. 면제하지 않으면 pr-done이 없는 done.md를
// 찾아 매 슬라이스 마지막마다 누락 경고를 헛발화한다.
const DOC_EXEMPT_PHASES = new Set(["done"]);
const DELIVERING_COMMANDS = new Set([
  "start",
  "approve-plan",
  "ready-impl",
  "start-verification",
  "pass",
  "rework",
  "approve-pr",
  "invalidate",
]);
// phase가 그대로여도 배달하는 커맨드. invalidate는 절차를 처음부터 다시 돌라는 선언이고,
// start는 새 슬라이스의 시작이다.
const REDELIVERING_COMMANDS = new Set(["start", "invalidate"]);
const SEP = "─".repeat(60);

/** 절차 문서의 repo 상대 경로. 항상 슬래시 — Windows 구분자가 나가면 붙여넣을 수 없는 안내가 된다. */
function stepDocRel(phase) {
  return [...STEP_DOC_DIR, `${phase}.md`].join("/");
}

// 절차 문서 디렉터리의 파일 목록. 디렉터리 자체가 없으면 null(누락 원인을 구분하기 위해).
function stepDocDirFiles() {
  const dir = path.join(ROOT, ...STEP_DOC_DIR);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : null;
}

// 절차 문서 본문. 없거나 읽을 수 없으면 null. 존재 판정은 readdir 결과에 대한 **정확한 문자열
// 비교**다 — existsSync는 대소문자를 무시하는 Windows에서 `Verification.md` 오타를 통과시키고
// Linux에서만 깨진다.
//
// 읽기 실패도 부재와 같이 다룬다. 이름이 readdir에 있는데 읽을 수 없는 경우(권한, 그 자리가
// 디렉터리, I/O 오류)에 예외를 그대로 올리면 두 군데가 깨진다 — 배달 쪽은 상위 catch가 예외와
// 함께 진단까지 삼켜 **아무 말 없이** 절차가 안 나가고(이 기구가 막으려는 단 하나의 결과다),
// `steps`는 try/catch 밖이라 원시 스택으로 죽어 압축 후 복구 경로 자체가 사라진다. null로
// 내려보내면 두 경우 모두 아래 누락 경고가 이유를 말한다.
function readStepDoc(phase) {
  const files = stepDocDirFiles();
  const name = `${phase}.md`;
  if (!files || !files.includes(name)) return null;
  try {
    return fs.readFileSync(path.join(ROOT, ...STEP_DOC_DIR, name), "utf8");
  } catch {
    return null;
  }
}

// 누락 경고. 파일만 없는 경우와 디렉터리가 없는 경우는 고치는 법이 다르므로 구분해 말한다.
function warnMissingStepDoc(phase) {
  const files = stepDocDirFiles();
  const cause =
    files === null
      ? "절차 문서 디렉터리 자체가 없음"
      : files.includes(`${phase}.md`)
        ? "파일은 있으나 읽을 수 없음 (권한, 또는 그 자리가 디렉터리)"
        : `디렉터리는 있으나 이 파일만 없음 (형제 ${files.filter((f) => f.endsWith(".md")).length}개는 존재)`;
  const rel = stepDocRel(phase);
  process.stderr.write(
    `⚠ [배달] ${phase} 절차 문서를 찾지 못했습니다.\n` +
      `   경로: ${rel}\n` +
      `   원인: ${cause}\n` +
      `   결과: 이 전이에서 절차가 전달되지 않았습니다 —\n` +
      `         다음 단계를 기억에 의존해 진행하게 됩니다.\n` +
      `   조치: git 이력에서 복구(\`git log --diff-filter=D -- ${rel}\`)하거나 사용자에게 알리세요.\n`
  );
}

/**
 * 절차 문서를 출력한다. 경로를 본문보다 먼저 찍는 이유는 vitest·tsc 출력 뒤에 배달되는 커맨드가
 * 있어 본문이 잘릴 수 있기 때문이다 — 잘려도 경로가 남으면 회복된다. 상태 줄을 본문 뒤에 한 번 더
 * 찍는 이유는 배달물이 자체 `#` 제목을 가진 마크다운이라, 구분자가 없으면 문서 제목이 CLI가 하는
 * 말처럼 읽히기 때문이다. 상태·경로·본문은 전부 stdout이다 — 두 스트림은 리다이렉트 시 순서가
 * 보장되지 않아, 나누면 이 순서가 깨진다.
 * @param phase 배달할 phase
 * @param cmd 상태 줄에 쓸 커맨드 표기 — 인자까지 포함한 원본(`pass review`). 읽기 전용 재출력이면 생략
 * @param summary true면 본문 대신 제목 줄만 (같은 phase 두 번째부터)
 * @param transitioned false면 phase가 그대로인 재배달이라 상태 줄이 전이를 함의하지 않게 쓴다
 * @returns 배달했으면 true, 문서를 못 읽어 경고만 했으면 false
 */
function emitStepDoc(phase, { cmd = null, summary = false, transitioned = true } = {}) {
  const body = readStepDoc(phase);
  if (body === null) {
    warnMissingStepDoc(phase);
    return false;
  }
  console.log(SEP);
  console.log(`▶ ${phase} 절차: ${stepDocRel(phase)}`);
  console.log(`   (다시 보려면 \`pnpm wf steps ${phase}\`)`);
  console.log(SEP);
  // 억제는 전부 아니면 전무다 — 잘린 절차는 이 기구가 막으려는 실패 그 자체다.
  if (process.env.WF_QUIET !== "1") {
    if (summary) {
      for (const line of body.split("\n")) {
        if (/^#{1,3} /.test(line)) console.log(line);
      }
      console.log(`\n전문: pnpm wf steps ${phase}`);
    } else {
      console.log(body.trimEnd());
    }
    console.log(SEP);
  }
  // 전이가 없었는데 `→ phase=`를 쓰면 그 화살표가 전이를 함의해 오독된다.
  if (cmd) {
    console.log(
      transitioned ? `✓ ${cmd} → phase=${phase}` : `✓ ${cmd} — phase=${phase} 절차 재배달`
    );
  }
  return true;
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
        // 실패는 이전 통과를 **능동적으로 회수**한다. 그냥 fail()만 하면 디스크의
        // ts_check_clean=true가 남아, verification 중 코드를 고쳐 타입이 깨져도
        // 나머지 pass만 채우면 user-verification·approve-pr까지 통과해 버린다
        // (= 이 슬라이스가 죽이려던 바로 그 명예제도).
        s.verification.ts_check_clean = false;
        s.ts_check_scope = null;
        save(s);
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
    // 타입 게이트(머지 직전 실측): 기록이 아니라 **지금 코드**를 검사한다.
    //
    // `pass ts`의 통과 기록만 믿으면 구멍이 남는다 — phase="verification"에서는 스크립트 편집이
    // 허용되므로 `pass ts` 뒤에 코드를 고치고 invalidate를 잊으면, 나머지 pass만 채워
    // user-verification까지 올라온 뒤 깨진 타입이 그대로 머지된다. 타 장비에서 편집한 경우도
    // 같은 구멍의 변형이다. 여기는 사람이 트리거하는 마지막 게이트라 tsc 1회 비용이 무의미하고,
    // 편집·invalidate 순서와 무관하게 머지될 코드 그 자체를 본다. (F44)
    console.log("\n▶ 타입체크 (머지 직전 실측)");
    const { status, scope } = runTypecheck();
    // 실측 결과를 상태에 반영한다 — 안 그러면 상태 파일이 낡은 값을 계속 말한다.
    s.ts_check_scope = status === 0 ? scope : null;
    s.verification.ts_check_clean = status === 0;
    save(s);
    if (status !== 0) {
      // 복구 경로를 먼저 말한다 — 지금 phase는 user-verification이라 훅이 스크립트 편집을
      // 막고 있다. "고친 뒤 다시 승인하세요"를 앞세우면 게임 코드 에러일 때 따라갈 수 없는
      // 안내가 된다(아래 범위 게이트가 피하는 것과 같은 막다른 길).
      fail(
        "타입체크 실패 — 머지될 코드에 타입 에러가 있습니다.\n" +
          "    `pnpm wf rework` → 구현으로 복귀해 고친 뒤 → `pnpm wf start-verification`으로 검증을 다시 돌리세요.\n" +
          "    (에러 재현: `pnpm typecheck`)"
      );
    }
    // 범위 게이트: 게임 코드까지 봤어야 한다. Cocos를 한 번도 안 연 머신에는 game/temp/가 없어
    // 게임 프로젝트를 검사할 수 없고, 그 상태를 통과시키면 "Cocos 안 깐 머신 = 타입 게이트 프리패스"가 된다.
    if (scope !== "full") {
      // 복구 경로는 rework다 — invalidate는 phase="verification"에서만 되는데
      // approve-pr은 user-verification에서 돌므로 여기서 invalidate를 안내하면 막다른 길이다.
      fail(
        `타입체크 범위가 "${scope ?? "미검사"}"입니다 — 게임 코드가 검사되지 않았습니다.\n` +
          "    Cocos Creator로 프로젝트를 한 번 열어 game/temp/를 생성한 뒤,\n" +
          "    `pnpm wf rework` → 구현으로 복귀 → `pnpm wf start-verification` → 검증을 다시 돌리세요."
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

  // 현재(또는 인자로 받은) phase의 절차 문서를 다시 출력한다. 상태를 바꾸지 않는 읽기 전용이라
  // 차등 배달 규칙을 타지 않는다 — 다시 보려고 친 명령이므로 항상 전문이다.
  steps(args) {
    // phase를 명시했으면 상태 파일을 읽지 않는다. steps는 "절차를 잃어버렸을 때" 치는 커맨드라,
    // 상태까지 잃은 상황에서 `먼저 start를 실행하세요`로 죽으면 복구 경로가 사라진다.
    const phase = args[0] ?? load().phase;
    if (!PHASES.includes(phase)) {
      fail(`알 수 없는 phase: "${phase}" (가능: ${PHASES.join(", ")})`);
    }
    if (DOC_EXEMPT_PHASES.has(phase)) {
      console.log(`phase="${phase}"에는 절차 문서가 없습니다.`);
      return;
    }
    emitStepDoc(phase);
  },

  // 절차 문서 정합 검사 (단독 실행 — 언제든 확인용). 누락·잉여가 있으면 종료코드 1.
  // 같은 판정이 tests/helpers/WorkflowSteps.ts에도 있다(그쪽이 fixture로 검증된다).
  // CLI에서 그 모듈을 import할 수 없어 생긴 복사본이므로, 규칙을 바꾸면 두 곳을 함께 고친다.
  "check-docs"() {
    const files = stepDocDirFiles();
    if (files === null) fail(`절차 문서 디렉터리 없음: ${STEP_DOC_DIR.join("/")}/`);
    const phaseDocs = PHASES.filter((p) => !DOC_EXEMPT_PHASES.has(p)).map((p) => `${p}.md`);
    const expected = [STEP_DOC_INDEX, ...phaseDocs]; // 인덱스도 있어야 한다 — 통독 경로가 그것뿐이다
    const markdown = files.filter((f) => f.endsWith(".md"));
    const missing = expected.filter((n) => !markdown.includes(n));
    const unexpected = markdown.filter((n) => !expected.includes(n));
    if (missing.length > 0 || unexpected.length > 0) {
      process.stderr.write("✗ 절차 문서 정합 실패:\n");
      for (const n of missing) process.stderr.write(`    - 누락: ${n}\n`);
      for (const n of unexpected) {
        process.stderr.write(`    - 잉여: ${n} (배달되지 않는 문서 — 읽히지 않은 채 낡는다)\n`);
      }
      process.exit(1);
    }
    console.log(`✓ 절차 문서 정합 (phase ${phaseDocs.length}개 + ${STEP_DOC_INDEX})`);
  },

  status() {
    const s = load();
    const editable = EDITABLE_PHASES.has(s.phase);
    console.log(JSON.stringify(s, null, 2));
    console.log(`\nscripts editable: ${editable ? "YES" : "no (locked)"}`);
    // 경로 한 줄만 — 본문은 안 낸다. status는 "나 어디 있지"의 정본 커맨드라 일상적으로 돌아가고,
    // 그러면 절차 문서의 **존재**로 신호가 온다. 압축 이후 "절차를 모르면 문서를 읽어라"는 지시가
    // 안 듣는 이유가 여기에 있다 — 부재는 스스로를 알리지 않으므로 방아쇠가 될 수 없다.
    // PHASES 검사를 한 번 태운다 — 상태가 어떤 이유로든 어휘 밖 값을 들고 있을 때
    // 진단 커맨드가 그럴듯한 가짜 경로를 말하지 않게 한다.
    if (PHASES.includes(s.phase) && !DOC_EXEMPT_PHASES.has(s.phase)) {
      console.log(`\n▶ ${s.phase} 절차: ${stepDocRel(s.phase)}`);
      console.log("   (전문: `pnpm wf steps`)");
    }
  },
};

// 디스패치 직전의 phase. 전이가 실제로 일어났는지 판정하는 기준이라 커맨드 실행 전에 읽는다.
// 상태 파일이 없을 수 있다(start 최초 실행).
function phaseBeforeDispatch() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")).phase ?? null;
  } catch {
    return null;
  }
}

/**
 * 디스패치가 성공으로 끝난 뒤 절차 문서를 배달한다. 여기까지 실행이 왔다는 것 자체가 전이 성공의
 * 증거다(모든 실패 경로는 process.exit(1)로 끝난다). 어떤 이유로도 throw하지 않는다.
 * @param cmd 방금 실행한 커맨드 이름
 * @param args 그 커맨드의 인자 — 상태 줄을 원본 그대로(`pass review`) 찍기 위해 받는다
 * @param phaseBefore 디스패치 직전의 phase (null이면 상태 파일이 없었다)
 */
function deliverAfterDispatch(cmd, args, phaseBefore) {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    const phase = state.phase;
    if (DOC_EXEMPT_PHASES.has(phase)) return;

    const phaseChanged = phase !== phaseBefore;
    if (!phaseChanged && !REDELIVERING_COMMANDS.has(cmd)) return;

    // 기존 상태 파일에는 이 필드가 없어 첫 실행 시 undefined다.
    // phase가 바뀔 때마다 비우므로 실제로는 항상 [] 아니면 [현재 phase] 하나다 —
    // 여러 phase의 이력이 쌓이지 않는다.
    let delivered = Array.isArray(state.docs_delivered) ? state.docs_delivered : [];
    if (phaseChanged) delivered = []; // 새 phase = 새 회차. rework도 여기 걸린다

    const summary = delivered.includes(phase);
    const label = [cmd, ...args].join(" ");
    if (emitStepDoc(phase, { cmd: label, summary, transitioned: phaseChanged }) && !summary) {
      delivered = [...delivered, phase];
    }

    state.docs_delivered = delivered;
    save(state);
  } catch (e) {
    // 배달은 곁가지다. 여기서 죽으면 이미 전이된 상태와 실패한 종료코드가 어긋난다.
    // 다만 조용히 삼키지는 않는다 — 절차가 안 나갔다는 사실 자체가 이 기구의 실패다.
    // String(e)로 받는다. `e.message`는 e가 null로 던져지면 catch **안에서** 다시 던져
    // 이 catch가 지키려는 불변식을 스스로 깬다(도달 가능성은 사실상 0이지만 비용도 0이다).
    process.stderr.write(`⚠ [배달] 절차 문서 배달에 실패했습니다: ${String(e)}\n`);
  }
}

const [, , cmd, ...args] = process.argv;
if (!cmd || !commands[cmd]) {
  console.log(`commands: ${Object.keys(commands).join(", ")}`);
  process.exit(cmd ? 1 : 0);
}
const phaseBefore = DELIVERING_COMMANDS.has(cmd) ? phaseBeforeDispatch() : null;
commands[cmd](args);
if (DELIVERING_COMMANDS.has(cmd)) deliverAfterDispatch(cmd, args, phaseBefore);
