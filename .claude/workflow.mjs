#!/usr/bin/env node
// .claude/workflow.mjs
// 워크플로우 상태의 "단일 작성자".
// 상태 변경은 반드시 이 CLI를 통해서만 일어난다 (hook이 JSON 직접 편집을 차단).
// 사용: node .claude/workflow.mjs <command> [args]

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { git } from "./lib/git.mjs";
import { applicableGates, collectChangeSet, csoBaseUsable } from "./lib/change-set.mjs";
import {
  applyPatch,
  approvePrDecision,
  csoCommand,
  csoGuideLine,
  decideTransition,
  formatGateLines,
  qaMissingMessage,
  qaRequired,
  recordPatch,
} from "./lib/transition.mjs";
import { formatVerifyReport, runVerify, writeModeFor } from "./lib/verify.mjs";
import {
  CANON_INDEX,
  DESIGN_PREFIXES,
  DEV_PREFIXES,
  assertOneLineField,
  insertCanonRow,
  parseCanonSlug,
  renderCanonDoc,
} from "./lib/canon.mjs";
import { EDITABLE_PHASES, PHASES } from "./lib/phases.mjs";
import {
  DOC_EXEMPT_PHASES,
  STEP_DOC_DIR,
  STEP_DOC_INDEX,
  findStepDocIssues,
} from "./lib/workflow-steps.mjs";
import { runTypecheck } from "./typecheck.mjs";

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_PATH = path.join(ROOT, ".claude", "workflow-state.json");

// `pass`로 기록하는 판단 검사. 타입·린트는 통합 검사(lib/verify.mjs)가 돌리고 결과를 기록용 값
// (ts_check_clean·lint_clean·ts_check_scope)으로 적으므로 여기 없다. 그래서 resetVerification이 그
// 기록용 값을 건드리지 않는다.
const CHECKS = ["cso", "review"];
const CHECK_FLAG = {
  cso: "cso_done",
  review: "code_review_clean",
};
// 통합 검사(`verify`)를 칠 수 있는 phase. 코드를 고치거나 고친 코드를 확인하는 phase들이다.
const VERIFY_PHASES = new Set(["implementation", "verification", "user-verification"]);
// QA 문서 생략(`skip-qa`)을 적을 수 있는 phase. 생략은 적은 뒤에도 필요할 때마다 다시 판정한다.
const SKIP_QA_PHASES = new Set(["qa-setup", "implementation", "verification"]);


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
    // 마지막 통합 검사의 타입 검사가 실제로 검사한 범위. "full" = 게임 코드 포함, "logic-only" =
    // Cocos 생성물이 없어 게임 코드를 못 봄. approve-pr이 "full"이 아니면 거부한다(머신 상태로
    // 게이트를 우회하는 것을 막는다). 넘어가는 조건이 아니라 기록이다 — ts_check_clean·lint_clean과
    // 함께 통합 검사가 적고, invalidate·rework는 지우지 않는다. verification 안이 아니라 밖에 두는
    // 이유: 옛 도구의 `Object.values(verification).every(Boolean)` 판정에 문자열이 섞이면 안 된다.
    // 이 슬라이스가 더한 cso_commit(`pass cso`를 친 커밋)·qa_skip_reason(QA 문서 생략 사유)은 처음
    // 상태에 두지 않는다. 그 값을 쓴 적이 없는 상태 파일에는 없고, 읽는 코드는 모두 「없음」을 처리한다.
    ts_check_scope: null,
    // 이번 슬라이스가 갱신·신설한 정본 경로. 비어 있고 canon_skip_reason도 없으면 pass가
    // user-verification 진입을 막는다 — 바꾼 명세가 정본에 안 실린 채 끝나는 것을 막는 게이트다.
    // ts_check_scope와 같은 이유로 verification 밖에 둔다: pass()의
    // `Object.values(verification).every(Boolean)` 판정에 배열·문자열이 섞이면 안 된다.
    canon_updated: [],
    canon_skip_reason: null,
    // 검증을 시작한 시점의 QA 문서 지문. 게이트는 이것과 **달라야** 통과시킨다 — 재검증 회차마다
    // 통과 근거를 다시 적게 하는 장치다(resetVerification·qaDocClean 참조). 이 필드가 없던
    // 시절의 상태 파일에서는 undefined이고, 그때는 검사를 건너뛴다.
    qa_doc_fingerprint: null,
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

// 판단 검사(`/cso`·리뷰)의 통과 표시를 지운다. 기록용 값 셋(ts_check_clean·lint_clean·ts_check_scope)과
// cso_commit은 건드리지 않는다 — 앞의 셋은 넘어가는 조건이 아니라 마지막 통합 검사의 기록이고,
// cso_commit은 통과 표시가 아니라 다음 `/cso`가 어디부터 볼지의 기준이다.
function resetVerification(state) {
  state.verification = state.verification ?? {};
  for (const f of Object.values(CHECK_FLAG)) state.verification[f] = false;
  // 정본 판단도 함께 무효화한다. 이 함수를 부르는 두 경로(invalidate·rework)는 둘 다 "코드가
  // 바뀌었다"는 뜻이고, 코드가 바뀌면 "명세도 바뀌었나"라는 판단이 낡는다. 남겨 두면 초기 구현
  // 기준으로 한 번 declare한 뒤 그 뒤의 모든 변경이 게이트를 그냥 통과한다.
  state.canon_updated = [];
  state.canon_skip_reason = null;
  // QA 자동 검증 절의 통과 근거도 같은 이유로 낡는다. 근거 줄이 "있는가"만 보면 1회차 근거로
  // 2회차를 통과하는데, 낡은 N/N이 남는 것은 없느니만 못하다 — 있으니까 아무도 안 본다.
  // 여기서 지금 문서의 지문을 찍어 두고, 게이트는 그것과 **달라야** 통과시킨다.
  state.qa_doc_fingerprint = qaDocFingerprint(state);
  // docs_delivered는 여기서 건드리지 않는다. invalidate가 이 함수를 부르므로 초기화를 넣으면
  // 매번 전문이 나가 차등 배달이 통째로 무력해진다. 초기화는 phase가 바뀌는 지점에서 한다.
}

/** 레포 루트 기준 상대 경로 — 항상 슬래시. Windows 구분자가 상태 파일에 들어가면 머신마다 갈린다. */
function toRel(full) {
  return path.relative(ROOT, full).split(path.sep).join("/");
}

/** 정본 갱신을 상태에 기록한다. 상태 파일이 없으면 조용히 넘어간다(슬라이스 밖 사용). */
function recordCanon(...rels) {
  if (!fs.existsSync(STATE_PATH)) return null;
  const s = load();
  const merged = new Set([...(s.canon_updated ?? []), ...rels]);
  s.canon_updated = [...merged].sort();
  s.canon_skip_reason = null; // 갱신을 선언했으므로 "바꾼 것 없음"과 공존할 수 없다
  save(s);
  return s;
}

// ── 절차 문서 배달 ──────────────────────────────────────────────────────────
// phase마다 같은 이름의 절차 문서가 하나 있고(`docs/development/workflow/<phase>.md`), 전이에
// 성공한 순간 그 문서를 그대로 찍는다. CLAUDE.md가 단계별 절차를 상시 들고 있지 않아도 되는 대신,
// 절차가 필요한 순간에 도착하게 하는 것이 이 기구의 전부다.
//
// 지켜야 할 성질 셋. ① 배달은 커맨드 함수 안이 아니라 **디스패치 뒤**에 붙는다 — 모든 실패 경로가
// fail() → process.exit(1)이라 실패한 전이에는 자동으로 배달이 안 간다(특히 pass는 판단 검사 두 개를
// 다 기록한 뒤에도 QA 확정·정본 선언·통합 검사에서 죽을 수 있어, 커맨드 안에서 배달하면 전이하지도
// 않은 절차가 샌다).
// ② 절대 throw하지 않고 종료코드를 바꾸지 않는다 — 배달이 실패로 보이면 상태는 이미 전이됐는데
// 재실행이 requirePhase에 막혀 사람이 갇힌다. ③ 문서가 없어도 전이를 막지 않는다 — 막으면 문서
// 하나 누락으로 워크플로가 멈추는데 빠져나올 경로가 없다.
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
function runVitest(extraArgs = [], env = {}) {
  const r = spawnSync("pnpm", ["exec", "vitest", "run", ...extraArgs], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true, // Windows .cmd 해석
    env: { ...process.env, ...env },
  });
  return r.status;
}

// Cocos 규칙: assets/ 아래 모든 파일·디렉터리는 형제 `.meta`(UUID 보관)를 가진다.
// `.meta`가 추적되지 않으면 클론·타 환경에서 UUID가 재생성돼 씬/프리팹 참조가 깨진다.
// 추적(git index)되는 에셋 중 `<경로>.meta`가 추적되지 않는 항목 목록을 반환한다.
// 반환: { error: string|null, missing: string[] }
function listMissingAssetMeta() {
  const r = git(ROOT, ["ls-files", "game/assets"]);
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

// 슬라이스의 시작점이 origin/main을 담고 있는지 확인하고, 아니면 막는다.
//
// 낡게 시작하는 길이 둘인데 둘 다 조용했다. **로컬 main이 origin보다 뒤처진 채로 자르거나**,
// **같은 이름의 브랜치가 예전에 만들어져 있으면 그 낡은 지점으로 그냥 전환하거나**다. 후자는
// 2026-08-19에 실제로 났다 — `feat/docs-hygiene`이 직전 main에서 미리 만들어져 있어서, 계획이
// `.gitattributes`도 백로그 새 항목도 없는 트리 위에 섰고 리뷰어 둘이 그것을 첫 발견으로 냈다.
// 전자는 그전에 두 번 났고 백로그 ID 충돌로 남았다(F47·F48, backlog.md 머리말 2026-07-17 정리).
//
// 자동으로 rebase하지 않는다. 브랜치에 남의 커밋이 얹혀 있을 수 있고, 무엇을 버리고 무엇을 살릴지는
// 사람의 판단이다. 여기서는 막고 다음에 칠 명령을 알려 주기만 한다.
function requireCurrentBase(base, branch) {
  git(ROOT, ["fetch", "origin", "main", "--quiet"]); // 오프라인이면 실패해도 그냥 로컬 기준으로 잰다
  const originMain = git(ROOT, ["rev-parse", "--verify", "--quiet", "refs/remotes/origin/main"]);
  if (originMain.status !== 0) return; // origin이 없는 클론에서는 잴 기준이 없다
  if (git(ROOT, ["merge-base", "--is-ancestor", "origin/main", base]).status === 0) return;

  const behind = git(ROOT, ["rev-list", "--count", `${base}..origin/main`]).stdout.trim();
  fail(
    `${base}이(가) origin/main보다 ${behind}커밋 뒤처져 있습니다 — 여기서 시작하면 최근 머지된 ` +
      "인프라·백로그 항목이 없는 트리 위에 슬라이스가 섭니다.\n" +
      `  먼저 맞추세요:  git switch ${base} && git merge --ff-only origin/main\n` +
      `  ${base === "main" ? "" : `또는 다른 이름으로 시작하세요 (지금 이름: ${branch})\n`}` +
      "  맞춘 뒤 `pnpm wf start`를 다시 실행합니다."
  );
}

// feat/<feature> 브랜치를 보장한다 — 없으면 main 기준 생성, 있으면 전환.
// 슬라이스 시작점 = 브랜치 시작점. planning 커밋이 main에 직접 쌓이는 사고를 막는다.
function ensureFeatureBranch(feature) {
  const branch = `feat/${feature}`;
  const exists =
    git(ROOT, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0;
  requireCurrentBase(exists ? branch : "main", branch);
  const r = exists
    ? git(ROOT, ["switch", branch], { stdio: "inherit" })
    : git(ROOT, ["switch", "-c", branch, "main"], { stdio: "inherit" });
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
// 기능 테스트는 tests/ 바로 아래 영역 폴더(logic·workflow·docs …) 어디에나 둘 수 있다 — 영역은
// 무엇을 검사하나로 나뉘고, 게이트가 보는 것은 파일명뿐이다. 어디에도 없으면 안내용으로
// tests/logic 경로를 돌려준다(그 경로가 없다는 메시지가 나간다).
function testFilePath(state) {
  const name = `${toPascal(state.feature)}.test.ts`;
  const testsDir = path.join(ROOT, "tests");
  const fallback = path.join(testsDir, "logic", name);
  if (!fs.existsSync(testsDir)) return fallback;
  const hit = fs
    .readdirSync(testsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(testsDir, d.name, name))
    .find((p) => fs.existsSync(p));
  return hit ?? fallback;
}

// 현재 슬라이스 QA 문서를 검사한다. 통과하면 true.
//
// 묻는 것은 셋이다. ① 미확정(잠정) 표시가 남았는가 — qa-setup에선 프리팹/씬·에디터 섹션을 계획
// 기준 잠정안으로 쓰며 `(잠정 …)`·`(가칭 …)` 태그를 달고, 구현 후 실제 컴포넌트에 맞춰 확정한다
// (코드가 정본이고 QA 문서가 그 거울이다). ② 자동 검증 절이 있고 그 안에 미체크가 없는가.
// ③ 통과 근거가 적혔는가.
//
// **판정을 여기 베끼지 않고 vitest를 띄운다.** 로직은 tests/helpers/QaDoc.ts 한 벌이고, 이
// 커맨드는 문서 경로만 `WF_QA_DOC`으로 건넨다 — 상태 파일을 아는 쪽은 CLI뿐이고 판정을 아는 쪽은
// 그 헬퍼뿐이라 경로 하나만 넘기면 사본이 안 생긴다. check-links가 세운 형태이고, CLI가 판정을
// 복사하면 한쪽만 고쳤을 때 나머지가 낡은 채로 초록불을 유지한다. 정본·절차 문서 판정은 lib/로 옮겨
// CLI와 테스트가 함께 import하지만(F78), 이 판정은 .ts 도우미에 있어 Node가 바로 불러올 수 없다.
//
// 옛 인라인 판정은 줄 전체에서 태그 문자열만 찾아 **코드 스팬 안팎을 못 갈랐다.** 그래서 "미확정
// 항목이 없다"고 설명한 문장 자체가 위반으로 잡혀 게이트가 거짓으로 실패했다(2026-08-18, F92).
const QA_JUDGE_TEST = "tests/workflow/DocsHygiene.test.ts";

function qaDocClean(state) {
  const p = qaDocPath(state);
  // 파일이 없을 때 통과로 보는 것은 `check-qa`를 위한 것이다. `pass`는 QA 문서가 필요하면 이 함수를
  // 부르기 전에 파일이 있는지부터 본다(lib/transition.mjs의 qaRequired).
  if (!fs.existsSync(p)) return true;
  // **판정 파일이 없으면 건너뛰지 않고 막는다.** 그렇게 하지 않으면 그 파일을 지우는 것만으로
  // 게이트가 꺼지는데, 지워도 스위트는 초록을 유지하므로(그 파일이 자기 존재를 단언할 수는 없다)
  // 아무도 알아채지 못한다. 같은 까닭으로 「tests/ 폴더가 없으면 건너뛴다」 예외도 두지 않는다 —
  // 개발 도구가 없는 임시 폴더는 가짜 pnpm(tests/workflow/fixtures/fake-pnpm.mjs)으로 돌린다.
  if (!fs.existsSync(path.join(ROOT, QA_JUDGE_TEST))) {
    process.stderr.write(`✗ ${QA_JUDGE_TEST}이 없습니다 — QA 문서 게이트의 판정 파일입니다.\n`);
    return false;
  }
  const rel = path.relative(ROOT, p).split(path.sep).join("/");
  if (runVitest([QA_JUDGE_TEST], { WF_QA_DOC: rel }) !== 0) return false;

  // 검증을 다시 시작한 뒤로 문서가 손대지지 않았으면 근거가 낡은 것이다(resetVerification 참조).
  if (state.qa_doc_fingerprint && state.qa_doc_fingerprint === qaDocFingerprint(state)) {
    process.stderr.write(
      `✗ ${rel}이(가) 재검증 시작 이후 한 번도 바뀌지 않았습니다 — 통과 근거가 이전 회차의 값입니다.\n` +
        "    이번 회차의 피처 N/N·전체 M/M로 갱신하세요.\n"
    );
    return false;
  }
  return true;
}

// QA 문서의 지문. **절이 아니라 파일 전체**를 해싱한다 — 절만 잘라 내려면 판정 로직을 CLI에
// 복사해야 하고(F78이 막은 형태다), 그 대가가 여기서 얻는 정밀도보다 크다. 문서의 다른 곳만
// 고쳐도 지문이 바뀌므로 이 검사는 "손댔는가"까지만 보장하고 "근거를 갱신했는가"는 사람이 진다.
function qaDocFingerprint(state) {
  const p = qaDocPath(state);
  if (!fs.existsSync(p)) return null;
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex").slice(0, 16);
}

// 실패 안내 끝에 절차 문서를 찾아갈 한 줄을 붙여 죽는다. 실패한 전이에는 절차 문서가 배달되지 않으므로
// 이 한 줄이 그 phase를 끝내는 조건을 찾아가는 유일한 안내다.
function failWithSteps(msg, phase) {
  fail(`${msg}\n절차: \`pnpm wf steps ${phase}\``);
}

// 지금 HEAD 커밋. git 저장소가 아니면 null이다.
function headCommit({ short = false } = {}) {
  const r = git(ROOT, ["rev-parse", ...(short ? ["--short"] : []), "HEAD"]);
  return r.status === 0 ? r.stdout.trim() : null;
}

// 변경 집합과 적용 판정. 구할 수 없으면 모든 검사를 하고, 그 원인과 처방을 한 줄 알린다(quiet가 아니면).
function changeContext({ quiet = false } = {}) {
  const cs = collectChangeSet(ROOT);
  if (!cs.measurable && !quiet) process.stderr.write(`⚠ ${cs.hint}\n`);
  return { cs, gates: applicableGates(cs) };
}

// 다음 `/cso` 안내 한 줄과 안내에 넣을 명령. 해당 없으면 기준 커밋을 확인하지 않는다(git을 띄우지 않는다).
function csoInfo(s, gates) {
  const usable = gates.cso.applies
    ? csoBaseUsable(s.cso_commit, ROOT)
    : { usable: false, reason: "해당 없음" };
  return { line: csoGuideLine(gates, usable, s.cso_commit), command: csoCommand(usable, s.cso_commit) };
}

// 적용 판정 출력(lib/transition.mjs의 formatGateLines). `/cso`를 해야 할 때만 기준 커밋을 확인한다.
function printGateLines(s, cs, gates) {
  const usable = gates.cso.applies
    ? csoBaseUsable(s.cso_commit, ROOT)
    : { usable: false, reason: "해당 없음" };
  for (const line of formatGateLines(gates, cs, s, usable)) console.log(line);
}

function printVerify(result) {
  for (const line of formatVerifyReport(result)) console.log(line);
}

// `pass`가 기록한 뒤 user-verification으로 넘길지 판정하고 결과를 적는다. 판정은 lib/transition.mjs의
// decideTransition이 하고, 이 함수는 그 판정이 「필요하다」고 답한 무거운 일(QA 판정 · 통합 검사)만
// 실행해서 결과를 넣고 다시 부른다. 그래서 판단 검사가 다 차지 않은 `pass`에서는 vitest가 돌지 않는다.
//
// 판단 검사만 남아 막힌 것은 실패가 아니다(`pass cso`를 먼저 친 경우). 그 밖의 단계에서 막히면
// 판정이 돌려준 값(통과 표시 삭제 포함)을 적고 실패로 끝낸다.
function tryTransition(s, cs, gates, check) {
  const cso = csoInfo(s, gates);
  const base = {
    state: s,
    gates,
    qa: qaRequired(s, cs),
    qaDocRel: toRel(qaDocPath(s)),
    canonDeclared: (s.canon_updated ?? []).length > 0 || Boolean(s.canon_skip_reason),
    csoCommand: cso.command,
  };
  let d = decideTransition(base);
  let qaClean;
  if (d.needsQa) {
    qaClean = fs.existsSync(qaDocPath(s)) ? qaDocClean(s) : "missing";
    d = decideTransition({ ...base, qaClean });
  }
  if (d.needsVerify) {
    // 커밋과 리뷰가 끝난 뒤라 파일을 고치지 않는다.
    console.log("\n▶ 통합 검사 (biome → typecheck → vitest, 파일은 고치지 않는다)");
    const verifyResult = runVerify(undefined, { write: false });
    printVerify(verifyResult);
    d = decideTransition({ ...base, qaClean, verifyResult, qaFingerprint: qaDocFingerprint(s) });
  }
  applyPatch(s, d.patch);
  save(s);

  if (d.transition) {
    console.log(
      `✓ pass ${check} → 전체 통과 → phase=user-verification (HEAD ${headCommit({ short: true }) ?? "알 수 없음"}, 편집 잠금)`
    );
    return;
  }
  if (d.blockers.every((b) => b.stage === "judgement")) {
    for (const b of d.blockers) console.log(`  남은 것: ${b.message}`);
    return;
  }
  for (const b of d.blockers) process.stderr.write(`✗ ${b.message}\n`);
  failWithSteps(`처리한 뒤 \`pnpm wf pass ${check}\`를 다시 친다.`, "verification");
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
    // QA 문서는 필요할 때만 확인한다(`skip-qa`로 생략했고 그 생략이 아직 유효하면 건너뛴다).
    const qa = qaRequired(s, changeContext({ quiet: true }).cs);
    if (qa.required && !fs.existsSync(qaDocPath(s))) {
      failWithSteps(qaMissingMessage(qa, toRel(qaDocPath(s))), "qa-setup");
    }
    const testOk = s.test_skipped || fs.existsSync(testFilePath(s));
    if (!testOk)
      failWithSteps(`테스트 파일 없음(스킵도 아님): ${toRel(testFilePath(s))}`, "qa-setup");

    // RED 게이트: 스킵이 아니면 피처 테스트가 실제로 실패(RED)하는지 검증.
    // 구현이 없어 실패하는 게 정상적인 TDD 시작점이므로, 통과해 버리면 차단한다.
    if (!s.test_skipped) {
      const rel = path.relative(ROOT, testFilePath(s)).split(path.sep).join("/");
      console.log(`\n▶ RED 확인: vitest run ${rel}`);
      const status = runVitest([rel]);
      if (status === 0) {
        failWithSteps(
          "테스트가 RED가 아닙니다 (피처 테스트가 통과함). " +
            "구현 전 실패하는 테스트를 먼저 작성하세요.",
          "qa-setup"
        );
      }
      console.log("✓ RED 확인됨 (피처 테스트 실패 — 정상)\n");
    }

    s.phase = "implementation";
    save(s);
    console.log("✓ ready-impl → phase=implementation (스크립트 편집 허용)");
  },

  // 구현 종료 → 검증 진입
  "start-verification"(args) {
    const s = load();
    requirePhase(s, "implementation");

    // 통합 검사 게이트: biome · 타입 검사 · 전체 테스트가 모두 통과해야 검증에 진입한다.
    // (test_skipped 여부와 무관 — 다른 로직 테스트는 항상 통과해야 한다.) 실패해도 기록용 값은 적는다 —
    // status가 마지막 통합 검사 결과를 보여 준다.
    console.log("\n▶ 통합 검사 (biome → typecheck → vitest)");
    const result = runVerify(undefined, { write: writeModeFor(s.phase, args) });
    printVerify(result);
    applyPatch(s, recordPatch(result));
    if (!result.ok) {
      save(s);
      failWithSteps("통합 검사 실패 — 세 검사가 모두 통과해야 verification으로 넘어간다.", "implementation");
    }

    s.phase = "verification";
    resetVerification(s);
    save(s);
    console.log("✓ start-verification → phase=verification");
    // status와 같은 적용 판정을 함께 보여 status를 따로 칠 필요가 없게 한다(다음 /cso 줄 포함).
    const { cs, gates } = changeContext({ quiet: true });
    printGateLines(s, cs, gates);
  },

  // 통합 검사만 다시 돌린다. phase는 바뀌지 않고 기록용 값 셋만 적는다 — 기록용 값은 넘어가는 조건이
  // 아니므로 어느 phase에서 적어도 문제가 없다. `pass`가 넘기기 직전에 스스로 돌리므로, 코드를 고친 뒤
  // 꼭 먼저 칠 필요는 없다.
  verify(args) {
    const s = load();
    if (!VERIFY_PHASES.has(s.phase)) {
      fail(
        `코드를 검사하는 phase가 아니다(phase="${s.phase}") — ` +
          `verify는 ${[...VERIFY_PHASES].join("·")}에서 친다.`
      );
    }
    const write = writeModeFor(s.phase, args);
    console.log(`\n▶ 통합 검사 (biome → typecheck → vitest${write ? "" : ", 파일은 고치지 않는다"})`);
    const result = runVerify(undefined, { write });
    printVerify(result);
    applyPatch(s, recordPatch(result));
    save(s);
    if (!result.ok) {
      // user-verification에서는 훅이 게임 스크립트 편집을 막으므로 형식 차이도 구현으로 돌아가 고친다.
      const back =
        s.phase === "user-verification" && result.results.biome.status === "format-only"
          ? "\n`pnpm wf rework` 뒤 `pnpm wf verify`로 고친다."
          : "";
      failWithSteps(`통합 검사 실패 — phase는 그대로다.${back}`, "verification");
    }
    console.log(`✓ verify: 통과 (phase=${s.phase} 그대로)`);
  },

  // QA 문서를 쓰지 않는 사유를 적는다(`--clear`로 되돌린다). 생략해도 되는지는 이 순간에 확정하지 않고
  // 필요할 때마다 다시 판정한다(lib/transition.mjs의 qaRequired) — qa-setup에서는 아직 구현 전이라
  // 어느 슬라이스든 game/** 변경이 없기 때문이다. 상태 파일을 손으로 고치는 것은 훅이 막으므로 되돌리는
  // 명령이 따로 있어야 한다.
  "skip-qa"(args) {
    const s = load();
    if (!SKIP_QA_PHASES.has(s.phase)) {
      fail(`skip-qa는 ${[...SKIP_QA_PHASES].join("·")}에서 친다(phase="${s.phase}").`);
    }
    if (args[0] === "--clear") {
      delete s.qa_skip_reason;
      save(s);
      console.log("✓ skip-qa --clear: QA 문서 생략을 되돌렸다");
      return;
    }
    const reason = args.join(" ").trim();
    if (!reason) fail('사용법: skip-qa "<사유>" | skip-qa --clear');

    const qa = qaRequired({ qa_skip_reason: reason }, changeContext({ quiet: true }).cs);
    if (qa.required) {
      failWithSteps(
        qa.cause === "game-change"
          ? `QA 문서가 필요하다: ${qa.matches.join(", ")}`
          : qaMissingMessage(qa, toRel(qaDocPath(s))),
        s.phase
      );
    }
    s.qa_skip_reason = reason;
    save(s);
    console.log(`✓ skip-qa: ${reason}`);
    console.log("생략은 `game/**` 변경이 없는 동안만 유효하다 — 그 변경이 생기면 `pass`가 QA 문서를 요구한다");
  },

  // 판단 검사 통과 표시(`/cso`·리뷰). 기록한 뒤 넘길 수 있으면 통합 검사를 돌려 user-verification으로
  // 넘긴다(tryTransition). QA 확정 게이트와 정본 게이트는 lib/transition.mjs의 decideTransition에 있다.
  pass(args) {
    const s = load();
    requirePhase(s, "verification");
    const check = args[0];
    // 타입·린트는 기계가 판정하므로 표시를 받지 않는다 — 통합 검사가 돌리고 결과를 기록한다.
    if (check === "ts" || check === "lint") {
      fail("타입·린트 결과는 통합 검사가 기록한다 — 따로 기록할 것이 없다. 결과만 다시 보려면 `pnpm wf verify`");
    }
    if (!CHECKS.includes(check)) fail(`사용법: pass <${CHECKS.join("|")}>`);

    const { cs, gates } = changeContext();
    s.verification = s.verification ?? {};
    if (check === "cso") {
      // cso_commit은 다음 `/cso --diff --base`의 기준이다. 커밋하지 않은 변경이 있어도 경고하지 않는다 —
      // 절차상 거의 항상 있어서 경고가 매번 뜬다. 그때는 기준이 앞선 커밋이 되어 다음 점검이 더 넓게
      // 볼 뿐이다.
      const head = headCommit();
      if (head) s.cso_commit = head;
      if (gates.cso.applies) {
        s.verification.cso_done = true;
      } else {
        // 해당 없을 때 통과 표시를 적어 두면, 나중에 /cso 대상 파일을 고쳐 해야 하는 상황으로 바뀌었는데
        // invalidate를 잊었을 때 그 표시 때문에 판정이 그냥 통과한다. 그래서 기준 커밋만 적는다.
        console.log(
          "`/cso` 해당 없음(`CSO_PATHS`에 해당하는 변경 없음 — `pnpm wf status`로 확인) — 기준 커밋만 기록한다"
        );
      }
    } else {
      s.verification[CHECK_FLAG[check]] = true;
    }
    save(s);
    console.log(`✓ pass ${check} (HEAD ${headCommit({ short: true }) ?? "알 수 없음"})`);
    tryTransition(s, cs, gates, check);
  },

  // 새 정본 문서를 규칙에 맞게 만들고 인덱스에 등재한다. 만든 것 자체가 정본 갱신이므로
  // canon_updated에도 바로 기록한다(상태 파일이 없으면 문서만 만든다 — 슬라이스 밖에서도 쓸 수 있게).
  canon(args) {
    const design = args.includes("--design");
    const rest = args.filter((a) => a !== "--design");
    const [slug, title, question] = rest;
    if (!slug || !title || !question) {
      fail('사용법: canon <분류>-<주제> "<제목>" "<답하는 질문>" [--design]');
    }

    const allowed = design ? DESIGN_PREFIXES : DEV_PREFIXES;
    try {
      parseCanonSlug(slug, allowed);
      assertOneLineField(title, "제목");
      assertOneLineField(question, "답하는 질문");
    } catch (e) {
      fail(e.message);
    }

    const dir = path.join(ROOT, "docs", design ? "design" : "development", "spec");
    const docPath = path.join(dir, `${slug}.md`);
    if (fs.existsSync(docPath)) {
      fail(
        `이미 있습니다: ${toRel(docPath)}\n` +
          "  정본은 새로 만들지 않고 고칩니다. 고쳤다면 `pnpm wf canon-done`으로 기록하세요."
      );
    }

    const readmePath = path.join(dir, CANON_INDEX);
    if (!fs.existsSync(readmePath)) {
      fail(`인덱스가 없습니다: ${toRel(readmePath)} — 정본 폴더가 아직 준비되지 않았습니다.`);
    }

    let readme;
    try {
      readme = insertCanonRow(fs.readFileSync(readmePath, "utf8"), slug, question);
    } catch (e) {
      fail(e.message);
    }

    // toISOString()은 UTC라 KST 저녁 이후에는 하루 이른 날짜가 찍힌다. 문서 날짜는 사람이
    // 세션 파일을 날짜로 찾는 인덱스라 어긋나면 안 된다 — sv-SE 로캘이 로컬 YYYY-MM-DD를 준다.
    const today = new Date().toLocaleDateString("sv-SE");
    // **인덱스를 먼저 쓴다.** 문서를 먼저 쓰고 인덱스에서 죽으면 등재 안 된 정본이 남는데,
    // 재실행하면 `이미 있습니다`로 막혀 canon-done으로 밀려나고 등재는 영영 안 된다.
    // 반대 순서의 최악은 가리키는 대상이 없는 인덱스 행 하나이고, 그건 눈에 보인다.
    // insertCanonRow가 멱등이라 재실행도 안전하다.
    fs.writeFileSync(readmePath, readme);
    fs.writeFileSync(docPath, renderCanonDoc({ slug, title, question, date: today }));
    console.log(`✓ canon: ${toRel(docPath)} 생성 + ${toRel(readmePath)} 등재`);

    recordCanon(toRel(docPath));
  },

  // 기존 정본을 고쳤을 때 기록한다. 경로가 실제로 있는지 확인한다 — 없는 경로를 적어
  // 게이트만 통과시키는 것을 막는다.
  "canon-done"(args) {
    if (args.length === 0) fail("사용법: canon-done <경로...> (레포 루트 기준)");
    const rels = [];
    for (const a of args) {
      const full = path.resolve(ROOT, a);
      // 레포 밖을 막는다. 파일을 쓰지는 않지만, 밖을 가리키는 경로는 타 머신에서 의미가 없고
      // 존재 검사를 넣은 목적(아무 경로로 게이트만 통과시키는 것을 막는다)이 그대로 샌다.
      // path.isAbsolute도 본다. Windows에서 드라이브가 다르면 path.relative가 `../`가 아니라
      // 절대 경로를 그대로 돌려주므로(ROOT가 C:, 인자가 F:\...), 앞 두 조건만으로는 샌다.
      const rel = toRel(full);
      if (rel === "" || rel.startsWith("../") || path.isAbsolute(rel)) {
        fail(`레포 밖 경로입니다: ${a}\n  정본은 이 레포 안의 파일이어야 합니다.`);
      }
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
        fail(`그런 파일이 없습니다: ${a}`);
      }
      rels.push(rel);
    }
    const s = recordCanon(...rels);
    // recordCanon은 상태 파일이 없으면 null이다(슬라이스 밖 사용). 그 경우 기록만 건너뛴다.
    console.log(
      s ? `✓ canon-done: ${s.canon_updated.join(", ")} (HEAD ${headCommit({ short: true }) ?? "알 수 없음"})` : `✓ canon-done: ${rels.join(", ")} (상태 파일이 없어 기록은 생략)`
    );
  },

  // 이번 슬라이스가 바꾼 명세가 없을 때. 사유를 남기는 것이 요점이다 — skip-test와 같은 형태로,
  // "생각해 보고 없다고 판단했다"와 "생각하지 않았다"를 구분한다.
  "canon-skip"(args) {
    const reason = args.join(" ").trim();
    if (!reason) fail('사용법: canon-skip "<사유>"');
    const s = load();
    s.canon_updated = [];
    s.canon_skip_reason = reason;
    save(s);
    console.log(`✓ canon-skip: ${reason} (HEAD ${headCommit({ short: true }) ?? "알 수 없음"})`);
  },

  // verification 중 코드 변경 → 판단 검사 무효화 (cso 포함, 비대칭 제거). 다음 `/cso`는 cso_commit을
  // 기준으로 쓸 수 있으면 바뀐 부분만 본다.
  invalidate() {
    const s = load();
    requirePhase(s, "verification");
    resetVerification(s);
    save(s);
    console.log("✓ invalidate: 판단 검사 결과(/cso·리뷰)와 정본 갱신 기록을 지웠다");
    console.log(csoInfo(s, changeContext().gates).line);
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
    // 무엇을 검사하고 무엇을 건너뛰는지를 결과보다 먼저 보인다. 판정은 lib/transition.mjs의
    // approvePrDecision이 하고, 여기서는 머지 직전의 실측 두 가지(타입 검사 · .meta)만 한다.
    const { cs, gates } = changeContext({ quiet: true });
    printGateLines(s, cs, gates);

    // 타입 게이트(머지 직전 실측): 기록이 아니라 **지금 코드**를 검사한다.
    //
    // 통합 검사의 기록만 믿으면 구멍이 남는다 — phase="verification"에서는 스크립트 편집이 허용되므로,
    // 통합 검사 뒤에 코드를 고치면 기록과 머지될 코드가 달라진다. 타 장비에서 편집한 경우도 같은 구멍의
    // 변형이다. 여기는 사람이 트리거하는 마지막 게이트라 tsc 1회 비용이 무의미하고, 편집 순서와 무관하게
    // 머지될 코드 그 자체를 본다. (F44)
    console.log("\n▶ 타입체크 (머지 직전 실측)");
    const { status, scope } = runTypecheck();
    // 실측 결과를 상태에 반영한다 — 안 그러면 상태 파일이 낡은 값을 계속 말한다.
    s.ts_check_scope = status === 0 ? scope : null;
    s.verification.ts_check_clean = status === 0;
    save(s);

    // 메타 게이트: 신규 자산의 .meta가 모두 커밋돼야 PR을 승인할 수 있다(누락 시 머지 후 모든 환경에서
    // 참조가 깨진다). game/assets/** 변경이 없으면 건너뛴다 — 따로 치는 check-meta는 항상 검사한다.
    let missingMeta = null;
    if (gates.meta.applies) {
      console.log("\n▶ 에셋 .meta 누락 검사");
      missingMeta = listMissingAssetMeta();
    } else {
      console.log("\n▶ 에셋 .meta 누락 검사 — 해당 없음 (game/assets/** 변경 없음)");
    }

    const decision = approvePrDecision({ gates, tsScope: scope, tsStatus: status, missingMeta });
    if (!decision.ok) {
      for (const r of decision.reasons) process.stderr.write(`✗ ${r}\n`);
      failWithSteps("PR 승인을 막았다.", "user-verification");
    }
    if (missingMeta) console.log("✓ 에셋 .meta 누락 없음");
    s.phase = "pr-ready";
    save(s);
    console.log("✓ approve-pr → phase=pr-ready");
  },

  // 에셋 .meta 누락 검사 (단독 실행 — 언제든 확인용). 누락 있으면 종료코드 1.
  "check-meta"() {
    requireAssetMeta();
  },

  // QA 문서 검사 (단독 실행 — 언제든 확인용). 위반이 있으면 종료코드 1.
  // 미확정 표시 + 자동 검증 절(미체크 0 · 통과 근거)을 함께 본다. 판정은 qaDocClean 참조.
  "check-qa"() {
    if (!qaDocClean(load())) process.exit(1);
    console.log("✓ QA 문서 확정됨 (미확정 표시 없음 · 자동 검증 절 채워짐)");
  },

  // 마크다운 링크·앵커 검사 (단독 실행 — 언제든 확인용). 깨진 링크가 있으면 종료코드 1.
  //
  // 판정을 여기 베끼지 않고 vitest를 띄운다. 로직은 tests/helpers/LinkCheck.ts 한 벌뿐이고
  // tests/logic/DocLinks.test.ts가 그것을 부르므로, 이 커맨드는 그 테스트를 실행하기만 한다.
  // CLI가 판정을 복사하면 한쪽만 고쳤을 때 나머지가 낡은 채로 초록불을 유지한다(F78이 있던 상태다.
  // check-docs·canon의 판정은 lib/로 옮겨 닫았다). 새로 만드는 검사에까지 그 함정을 파지 않는다.
  //
  // 회귀를 실제로 막는 것은 이 커맨드가 아니라 vitest 스위트다 — start-verification과 pass의
  // 통합 검사가 매 슬라이스 강제로 돌린다. 이 커맨드는 사람이 중간에 확인할 때 쓴다.
  "check-links"() {
    console.log("\n▶ 마크다운 링크·앵커 검사: vitest run tests/logic/DocLinks.test.ts");
    if (runVitest(["tests/logic/DocLinks.test.ts"]) !== 0) {
      fail("깨진 링크가 있습니다 — 위 목록의 `파일:줄 → 대상`을 고치세요.");
    }
    console.log("✓ 깨진 링크 없음");
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
  // 판정은 lib/workflow-steps.mjs의 findStepDocIssues가 하고, ClaudeMdSplit.test.ts가 같은 함수를
  // fixture로 검증한다.
  "check-docs"() {
    const files = stepDocDirFiles();
    if (files === null) fail(`절차 문서 디렉터리 없음: ${STEP_DOC_DIR.join("/")}/`);
    const issues = findStepDocIssues(PHASES, files);
    if (issues.length > 0) {
      process.stderr.write("✗ 절차 문서 정합 실패:\n");
      for (const { type, name } of issues) {
        process.stderr.write(
          type === "missing"
            ? `    - 누락: ${name}\n`
            : `    - 잉여: ${name} (배달되지 않는 문서 — 읽히지 않은 채 낡는다)\n`
        );
      }
      process.exit(1);
    }
    const phaseDocs = PHASES.filter((p) => !DOC_EXEMPT_PHASES.has(p)).length;
    console.log(`✓ 절차 문서 정합 (phase ${phaseDocs}개 + ${STEP_DOC_INDEX})`);
  },

  status() {
    const s = load();
    const editable = EDITABLE_PHASES.has(s.phase);
    console.log(JSON.stringify(s, null, 2));
    console.log(`\nscripts editable: ${editable ? "YES" : "no (locked)"}`);
    // 이번 변경 집합으로 계산한 적용 판정. 상태 파일은 고치지 않는다. git 저장소가 아니어도 멈추지 않고
    // 원인을 첫 줄에 적는다.
    console.log("");
    const { cs, gates } = changeContext({ quiet: true });
    printGateLines(s, cs, gates);
    console.log(`\n명령: ${commandList()}`);
    // 경로 한 줄만 — 본문은 안 낸다. status는 "나 어디 있지"의 정본 커맨드라 일상적으로 돌아가고,
    // 그러면 절차 문서의 **존재**로 신호가 온다. 압축 이후 "절차를 모르면 문서를 읽어라"는 지시가
    // 안 듣는 이유가 여기에 있다 — 부재는 스스로를 알리지 않으므로 방아쇠가 될 수 없다.
    // PHASES 검사를 한 번 태운다 — 상태가 어떤 이유로든 어휘 밖 값을 들고 있을 때
    // 진단 커맨드가 그럴듯한 가짜 경로를 말하지 않게 한다.
    if (PHASES.includes(s.phase) && !DOC_EXEMPT_PHASES.has(s.phase)) {
      console.log(`\n▶ ${s.phase} 절차: ${stepDocRel(s.phase)}`);
      console.log(`절차: \`pnpm wf steps ${s.phase}\``);
    }
  },
};

// 명령 목록. phase를 바꾸지 않는 verify에는 그 사실을 붙인다 — 이름만 보면 다른 전이 명령과 구별되지
// 않아서, 결과만 보려고 친 명령이 다음 단계로 넘길 것처럼 읽힌다.
function commandList() {
  return Object.keys(commands)
    .map((k) => (k === "verify" ? "verify (phase가 바뀌지 않음)" : k))
    .join(", ");
}

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
if (!cmd) {
  console.log(`commands: ${commandList()}`);
  process.exit(0);
}
if (!commands[cmd]) {
  process.stderr.write(`✗ 알 수 없는 명령: ${cmd}\ncommands: ${commandList()}\n`);
  process.exit(1);
}
const phaseBefore = DELIVERING_COMMANDS.has(cmd) ? phaseBeforeDispatch() : null;
commands[cmd](args);
if (DELIVERING_COMMANDS.has(cmd)) deliverAfterDispatch(cmd, args, phaseBefore);
