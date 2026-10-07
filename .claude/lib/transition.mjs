// @ts-check
/**
 * 전이 판정 — `pass`가 `user-verification`으로 넘길지, 무엇 때문에 막혔는지, 상태 파일에 무엇을 적을지.
 *
 * 여기 함수는 입력만 받아 답한다. 판정에 필요한 무거운 일(QA 판정은 vitest를 띄우고, 통합 검사는 세
 * 도구를 띄운다)은 `workflow.mjs`가 이 판정이 「필요하다」고 답했을 때만 실행해서 결과를 넣고 다시
 * 부른다. 그래서 모든 경우를 단위 테스트로 확인할 수 있고, `pass cso`처럼 아직 넘길 수 없는 `pass`에서는
 * vitest가 돌지 않는다.
 */

import { applicableGates, CSO_DIFF_COMMAND } from './change-set.mjs';

/** @typedef {import('./change-set.mjs').ChangeSet} ChangeSet */
/** @typedef {import('./change-set.mjs').Gates} Gates */
/** @typedef {import('./verify.mjs').VerifyResult} VerifyResult */
/**
 * QA 문서가 필요한지와 그 까닭. `cause`는 `no-skip`(생략 사유 없음) · `skip-valid`(생략해도 된다) ·
 * `game-change`(사유가 있지만 `game/**` 변경이 생겼다) · `unmeasurable`(변경 집합을 구할 수 없다)이다.
 * @typedef {{ required: boolean, cause: 'no-skip' | 'skip-valid' | 'game-change' | 'unmeasurable',
 *   matches: string[], hint: string }} QaNeed
 */
/**
 * 막힌 까닭. `stage`는 판정 순서의 단계다 — `judgement`(판단 검사 두 개) · `qa` · `canon` · `verify`.
 * `judgement`에서만 막힌 `pass`는 실패가 아니다(`pass cso`를 먼저 친 경우).
 * @typedef {{ stage: 'judgement' | 'qa' | 'canon' | 'verify', message: string }} Blocker
 */
/**
 * 상태 파일에 덮어쓸 값. `verification`은 안쪽 키만 바꾼다(`applyPatch`).
 * @typedef {{ phase?: string, ts_check_scope?: string | null,
 *   verification?: Record<string, boolean>, canon_updated?: string[], canon_skip_reason?: null,
 *   qa_doc_fingerprint?: string | null }} StatePatch
 */

/** 같은 파일 목록을 안내 문구에 다 늘어놓지 않는다. */
const LIST_LIMIT = 5;

/** @param {string[]} files */
function listFiles(files) {
  if (files.length <= LIST_LIMIT) return files.join(', ');
  return `${files.slice(0, LIST_LIMIT).join(', ')} 외 ${files.length - LIST_LIMIT}개`;
}

/**
 * QA 문서가 필요한가. 생략 사유(`qa_skip_reason`)를 적어 두었어도 명령을 친 순간에 확정하지 않고
 * 부를 때마다 다시 판정한다 — `qa-setup`에서는 아직 구현 전이라 어느 슬라이스든 `game/**` 변경이 없기
 * 때문이다. 판정에 쓰는 경로는 `QA_PATHS`(`game/**`)다. 이 함수를 `skip-qa` · `ready-impl` · `pass` ·
 * `status`가 함께 쓴다.
 *
 * @param {{ qa_skip_reason?: string | null }} state 상태 파일. 옛 형식이면 사유 값이 없다
 * @param {ChangeSet} changeSet
 * @returns {QaNeed}
 */
export function qaRequired(state, changeSet) {
  if (!state.qa_skip_reason) return { required: true, cause: 'no-skip', matches: [], hint: '' };
  if (!changeSet.measurable) {
    return { required: true, cause: 'unmeasurable', matches: [], hint: changeSet.hint };
  }
  const qa = applicableGates(changeSet).qa;
  if (qa.applies) return { required: true, cause: 'game-change', matches: qa.matches, hint: '' };
  return { required: false, cause: 'skip-valid', matches: [], hint: '' };
}

/**
 * QA 문서가 필요한데 없을 때의 안내. 생략 사유가 있었으면 「사유가 더는 맞지 않는다」고 말한다 — 사유가
 * 없는데 문서가 없으면 문서를 지웠거나 옛 상태 파일이다.
 *
 * @param {QaNeed} qa
 * @param {string} qaDocRel QA 문서 경로(저장소 기준)
 */
export function qaMissingMessage(qa, qaDocRel) {
  if (qa.cause === 'game-change') {
    return `생략 사유가 더는 맞지 않는다: ${listFiles(qa.matches)} — QA 문서가 필요하다: ${qaDocRel}`;
  }
  if (qa.cause === 'unmeasurable') {
    return `변경 집합을 구할 수 없어 QA 문서가 필요하다: ${qaDocRel} — ${qa.hint}`;
  }
  return `QA 문서가 없다: ${qaDocRel}`;
}

/**
 * 다음 `/cso`를 어떻게 돌릴지 한 줄. `cso_commit`을 기준으로 쓸 수 있으면 바뀐 부분만 보고, 쓸 수 없으면
 * 그 까닭과 함께 처음부터 전체를 본다.
 *
 * @param {{ cso: { applies: boolean } }} gates
 * @param {{ usable: true } | { usable: false, reason: string }} usable `csoBaseUsable`의 결과
 * @param {string | null | undefined} csoCommit 상태 파일의 `cso_commit`
 */
export function csoGuideLine(gates, usable, csoCommit) {
  if (!gates.cso.applies) return '`/cso` 해당 없음 — `CSO_PATHS`에 해당하는 변경이 없다';
  if (usable.usable)
    return `\`/cso\`는 바뀐 부분만 다시 본다: \`${CSO_DIFF_COMMAND} ${csoCommit}\``;
  return `\`/cso\`는 처음부터 전체를 본다(기준 커밋: ${usable.reason}): \`/cso\``;
}

/**
 * 안내에 넣을 `/cso` 명령 자체.
 * @param {{ usable: boolean }} usable
 * @param {string | null | undefined} csoCommit
 */
export function csoCommand(usable, csoCommit) {
  return usable.usable ? `${CSO_DIFF_COMMAND} ${csoCommit}` : '/cso';
}

/**
 * 통합 검사가 실패한 까닭을 셋으로 가른다. 하나라도 실제로 실패했으면(`fail`) 코드를 고쳐야 하므로
 * `real`이다. 그렇지 않고 실행기를 실행하지 못했거나 결과 없이 끝났으면 `env`, biome 형식 차이뿐이면
 * `format-only`다.
 *
 * @param {VerifyResult} result
 * @returns {'none' | 'real' | 'env' | 'format-only'}
 */
export function failureKind(result) {
  const all = Object.values(result.results);
  if (all.every((r) => r.status === 'pass')) return 'none';
  if (all.some((r) => r.status === 'fail')) return 'real';
  if (all.some((r) => r.status === 'not-run')) return 'env';
  return 'format-only';
}

/**
 * 통합 검사 결과에서 기록용 값 셋을 뽑는다. 이 값들은 넘어가는 조건이 아니라 마지막 통합 검사의 기록이다.
 * 조건으로 쓰면 `invalidate`가 이 값을 지우므로 코드를 고칠 때마다 검사를 한 번 더 쳐야 한다.
 *
 * @param {VerifyResult} result
 * @returns {StatePatch}
 */
export function recordPatch(result) {
  const { biome, typecheck } = result.results;
  return {
    ts_check_scope: typecheck.status === 'pass' ? (typecheck.scope ?? null) : null,
    verification: {
      ts_check_clean: typecheck.status === 'pass',
      lint_clean: biome.status === 'pass',
    },
  };
}

/**
 * 판정 결과를 상태에 덮어쓴다. `verification`은 안쪽 키만 바꾸고 나머지는 그대로 둔다.
 *
 * @template {Record<string, any>} S
 * @param {S} state
 * @param {StatePatch} patch
 * @returns {S}
 */
export function applyPatch(state, patch) {
  const { verification, ...rest } = patch;
  Object.assign(state, rest);
  /** @type {Record<string, any>} */
  const target = state;
  if (verification) target.verification = { ...(target.verification ?? {}), ...verification };
  return state;
}

/**
 * `pass`가 `user-verification`으로 넘길지 판정한다. 순서는 이렇다.
 *
 * 1. `pass`로 기록하는 판단 검사 두 개를 통과했는가. `code_review_clean`은 항상 보고, `cso_done`은
 *    `/cso`를 해야 할 때만 본다(`gates.cso`).
 * 2. QA 문서가 필요하면(`qa.required`) 확정됐는가. `qaClean`이 없으면 `needsQa`를 돌려준다 — 호출자가
 *    그때 QA 판정을 실행해서 결과를 넣고 다시 부른다. 1번이 다 통과하지 않았으면 QA 판정을 부르지 않는다.
 *    QA 문서가 필요하면 파일이 꼭 있어야 한다(`qaClean: 'missing'`이면 막는다).
 * 3. 정본 갱신을 기록했는가(`canonDeclared`).
 * 4. 1~3번을 다 통과했는데 `verifyResult`가 없으면 `needsVerify`를 돌려준다. 호출자가 통합 검사를 파일을
 *    고치지 않는 방식으로 돌려 결과를 넣고 다시 부른다. 1~3번 중 하나라도 막혀 있으면 돌리지 않는다.
 * 5. 통합 검사가 통과하면 넘어간다.
 *
 * 통합 검사가 타입·린트·테스트로 실제로 실패하면 그 자리에서 `invalidate`와 같은 일을 한다(판단 검사 두
 * 개와 정본 갱신 기록을 지우고 QA 문서 해시값을 새로 적는다). 실패를 보면 코드를 고치고 `pass review`를
 * 다시 치는 것이 가장 자연스러운데, 통과 표시를 남겨 두면 고치기 전 코드로 받은 리뷰와 `/cso`가 그대로
 * 통과한다. 형식 차이만 있거나 실행 환경 문제로 실패한 경우는 판단 검사와 관계가 없어서 지우지 않는다.
 * `cso_commit`과 기록용 값 셋은 어느 경우에도 지우지 않는다.
 *
 * @param {object} input
 * @param {{ verification?: Record<string, boolean> }} input.state 상태 파일
 * @param {{ cso: { applies: boolean } }} input.gates 적용 판정
 * @param {QaNeed} input.qa `qaRequired`의 결과
 * @param {string} input.qaDocRel QA 문서 경로(저장소 기준)
 * @param {boolean | 'missing'} [input.qaClean] QA 판정 결과. 파일이 없으면 `'missing'`
 * @param {boolean} input.canonDeclared 정본 갱신을 기록했는가
 * @param {string} input.csoCommand 안내에 넣을 `/cso` 명령(`csoCommand`의 결과)
 * @param {VerifyResult} [input.verifyResult] 통합 검사 결과
 * @param {string | null} [input.qaFingerprint] 실제 실패일 때 적을 QA 문서 해시값
 * @returns {{ transition: boolean, needsQa: boolean, needsVerify: boolean, blockers: Blocker[],
 *   patch: StatePatch }}
 */
export function decideTransition(input) {
  const v = input.state.verification ?? {};
  const stop = (/** @type {Blocker[]} */ blockers, patch = {}, flags = {}) => ({
    transition: false,
    needsQa: false,
    needsVerify: false,
    blockers,
    patch,
    ...flags,
  });

  /** @type {Blocker[]} */
  const judgement = [];
  if (input.gates.cso.applies && !v.cso_done) {
    judgement.push({
      stage: 'judgement',
      message: `\`/cso\`가 남았다 — \`${input.csoCommand}\` 뒤 \`pnpm wf pass cso\``,
    });
  }
  if (!v.code_review_clean) {
    judgement.push({
      stage: 'judgement',
      message: '코드 리뷰가 남았다 — 리뷰 뒤 `pnpm wf pass review`',
    });
  }
  if (judgement.length > 0) return stop(judgement);

  /** @type {Blocker[]} */
  const blockers = [];
  if (input.qa.required) {
    if (input.qaClean === undefined) return stop([], {}, { needsQa: true });
    if (input.qaClean === 'missing') {
      blockers.push({ stage: 'qa', message: qaMissingMessage(input.qa, input.qaDocRel) });
    } else if (!input.qaClean) {
      blockers.push({
        stage: 'qa',
        message: 'QA 문서가 아직 확정되지 않았다 — 위 실패 메시지가 무엇을 고칠지 든다',
      });
    }
  }
  if (!input.canonDeclared) {
    blockers.push({
      stage: 'canon',
      message:
        '정본 갱신 여부가 선언되지 않았습니다 — 이번 슬라이스가 바꾼 명세는 정본에 실려야 합니다.\n' +
        '    새로 만들기:  pnpm wf canon <분류>-<주제> "<제목>" "<답하는 질문>"\n' +
        '    기존 것 고침: pnpm wf canon-done <경로...>\n' +
        '    바꾼 명세 없음: pnpm wf canon-skip "<사유>"',
    });
  }
  if (blockers.length > 0) return stop(blockers);

  if (!input.verifyResult) return stop([], {}, { needsVerify: true });

  const record = recordPatch(input.verifyResult);
  const kind = failureKind(input.verifyResult);
  if (kind === 'none') {
    return {
      transition: true,
      needsQa: false,
      needsVerify: false,
      blockers: [],
      patch: { phase: 'user-verification', ...record },
    };
  }
  if (kind === 'real') {
    return stop(
      [
        {
          stage: 'verify',
          message:
            '통합 검사 실패 — 판단 검사 결과를 지웠다. 고친 뒤 절차대로 다시 한다' +
            '(정본 갱신 기록 → QA 문서가 필요하면 갱신 → 커밋 → ' +
            `\`/cso\`를 해야 하면 \`${input.csoCommand}\` → 리뷰 → \`pass review\`)`,
        },
      ],
      {
        ...record,
        verification: { ...record.verification, cso_done: false, code_review_clean: false },
        canon_updated: [],
        canon_skip_reason: null,
        qa_doc_fingerprint: input.qaFingerprint ?? null,
      },
    );
  }
  if (kind === 'format-only') {
    // 커밋 훅(lint-staged)이 커밋하는 파일의 형식을 맞춰 주므로, 여기서 형식 차이가 나왔다는 것은
    // 커밋하지 않은 파일이 있다는 뜻이다.
    const what = input.verifyResult.results.biome.summary || '형식 차이';
    return stop(
      [
        {
          stage: 'verify',
          message:
            `${what} — \`pnpm wf verify\`로 고치고 커밋한 뒤 \`pnpm wf pass review\`를 다시 친다. ` +
            '형식만 고친 경우는 판단 검사를 다시 하지 않는다',
        },
      ],
      record,
    );
  }
  return stop(
    [
      {
        stage: 'verify',
        message:
          '통합 검사를 끝까지 돌리지 못했다(실행 환경 문제) — 위 안내대로 고친 뒤 같은 `pass`를 다시 친다. ' +
          '판단 검사 결과는 그대로 둔다',
      },
    ],
    record,
  );
}
