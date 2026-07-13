# 코드 리뷰 이슈 — TS 툴체인 (F27 · F30)

- **브랜치:** feat/ts-toolchain
- **리뷰 커밋:** `a2e6adb..f1096fa`
- **리뷰 판정:** 조건부 머지 가능 (With fixes) — 게임 런타임 회귀 위험은 0으로 확인됐으나, 게이트에 구멍 2개
- **계획:** [`../development/sessions/2026-07-13-ts-toolchain-plan.md`](../development/sessions/2026-07-13-ts-toolchain-plan.md)

---

## Important — 게이트의 구멍 (둘 다 이 슬라이스의 명제를 무너뜨림)

### I-1. `pass ts` 실패가 이전 통과 플래그를 회수하지 않는다 — **수정됨**

`.claude/workflow.mjs`의 `pass()`에서 `fail()`은 `save()` 없이 종료한다. 그래서 타입체크가 실패해도 **디스크의 `ts_check_clean: true`가 그대로 남는다.**

악용(이라기보다 사고) 경로: ① `pass ts` 통과 → ② `verification` phase는 스크립트 편집이 허용되므로 코드를 고친다 → ③ `pass ts` 재실행 → 실패. 그런데 디스크엔 여전히 `true` → ④ `pass lint`·`pass review`를 치면 `every(Boolean)`이 참이라 **자동으로 `user-verification` 전이** → ⑤ `approve-pr`도 `ts_check_scope === "full"`이라 통과.

**타입체크가 방금 빨간불인데 PR 승인까지 간다.** "사람이 `invalidate`를 눌렀어야 한다"가 답인데, 그 명예제도를 죽이는 것이 바로 이 슬라이스의 목적이었다.

**수정:** 실패 시 `ts_check_clean = false` + `ts_check_scope = null`을 저장한 뒤 `fail()`한다. 즉 **실패가 이전 통과를 능동적으로 회수한다.**

### I-2. `approve-pr`의 복구 안내가 실행 불가능한 명령을 가리킨다 — **수정됨**

타입체크 범위 게이트가 막을 때 안내가 `pnpm wf invalidate`를 가리키는데, `approve-pr`은 `user-verification`에서 돌고 `invalidate`는 `verification`에서만 가능하다. 안내대로 치면 phase 에러만 난다. 상태 파일 직접 편집은 훅이 막으므로 손으로 되돌릴 수도 없다.

이 게이트는 **크로스머신 작업(F9)에서 정확히 발동하도록 설계됐다** — 사용자가 실제로 부딪히는 자리이고, 부딪힌 그 순간 문서가 막다른 길을 가리킨다.

**수정:** 실제 복구 경로인 `pnpm wf rework`를 안내한다.

---

## Minor — 수정함

- **M-1. `process.exit(status)`에서 `status`가 `null`일 수 있다** — **수정됨.** `spawnSync`가 시그널로 죽으면 `r.status`가 `null`이고 `process.exit(null)`은 **종료코드 0**이다. stderr엔 실패라고 찍히는데 셸은 성공으로 읽는다. `pass ts` 경로는 `!== 0`이라 fail-closed지만, `pnpm typecheck`를 CI·훅에 물리는 순간 구멍이 된다. → `process.exit(status ?? 1)`.
- **M-2. 테스트 프로젝트 실패 시 `scope: "logic-only"` 반환** — **수정됨.** "검사 못 함"과 "게임 코드 안 봄"이 같은 값으로 뭉개진다. `scope: null`이 정직하다.
- **M-3. `pathToFileURL(process.argv[1])`이 `argv[1]` 부재 시 TypeError** — **수정됨.** 현재 호출 경로엔 없지만 방어 한 줄.
- **M-4. `tsconfig.tests.json`에 `skipLibCheck`가 없다** — **수정됨.** `@types/node`가 캐럿 범위(`^22`)라 마이너 업그레이드가 라이브러리 선언 에러를 들여오면 **우리 코드와 무관하게 게이트가 빨간불**이 된다. 게임 프로젝트는 켜 뒀으니 대칭도 안 맞았다.
- **M-6. CLAUDE.md의 `pnpm typecheck` 행이 `pnpm wf` 서브커맨드 표에 섞여 있다** — **수정됨.** wf 커맨드가 아니다.

## Minor — 인지하고 남김

- **M-5. `logic/`·`data/`가 두 프로젝트에 모두 포함되는데 `lib` 천장이 다르다** (tests=ES2020, game=ES2017). `logic/`에 ES2018~2020 API를 쓰면 tests 프로젝트는 통과하고 게임 프로젝트만 잡는다 → Cocos 없는 머신(`logic-only`)에선 못 잡는다. **다만 `approve-pr`의 범위 게이트가 결국 막으므로 머지엔 샐 수 없다.** 지금 프로젝트를 쪼개는 건 과하다. 인지만 남긴다.

---

## 문서 드리프트 — 수정함

- **`docs/development/i18n-guide.md`** — "순수 로직은 `logic/I18nKeyGuard.ts`"라고 적혀 있는데 파일이 `tests/helpers/`로 옮겨졌다. **이 슬라이스가 만든 실제 stale 참조**라 다음 세션이 없는 경로를 찾게 된다. → 수정됨
- **계획·QA 문서의 `= null!` 표기** — 실제 코드는 `null as unknown as T`다(Biome `noNonNullAssertion` 때문에 바뀌었고, `conventions.md`만 실제 형태를 반영했다). **코드가 정본이고 QA 문서가 그 거울**이므로 문서를 코드에 맞췄다. → 수정됨
- **QA 문서의 게이트 검증 근거 재현 불가** — 주입한 코드와 잔여 확인 grep이 어긋나 있었다. 실제 프로브 이름(`__gateProbe`)을 함께 적어 재현 가능하게 했다. → 수정됨
- **백로그 F24 ID 재사용** — 기존 F24(「`GameManager.instance` 접근 null 가드 컨벤션 불일치」)의 서술을 새 F24(「싱글톤 타입 정직화 + 73곳 가드」)로 갈아끼웠다. 주제가 같아 사실상 흡수·승격이지만 「ID 영구」 규칙상 원 서술이 사라진 건 기록 손실이다. → **원 서술을 새 행 안에 접어 넣어 보존**했다.

---

## 리뷰가 확인한 강점 (기록)

- **`ts_check_scope`를 `verification` 객체 *밖*에 둔 것.** 안에 넣었으면 `Object.values(s.verification).every(Boolean)`에서 문자열이 항상 truthy가 되어 **`pass` 하나만으로 `user-verification`에 조기 전이**했을 것이다.

---

# 재리뷰 (`f1096fa..83985c8` — 수정분 검증)

**판정:** I-1·I-2의 코드 수정은 **정확하고 부작용이 없다.** 재리뷰가 상태 경로를 전수해 "실패했는데 디스크는 초록" 상태가 **도달 불가**임을 확인했다. `scope: null`의 모든 소비자도 안전하고, `skipLibCheck`가 우리 코드 에러를 하나도 숨기지 않음을 실측(`--skipLibCheck false`와 대조)으로 확인했다.

세 가지가 남아 있었고 전부 고쳤다.

### R-1. `CLAUDE.md`가 코드에서 지운 막다른 길을 그대로 말하고 있었다 — **수정됨**

I-2가 `approve-pr`의 안내 메시지를 `invalidate` → `rework`로 고쳤는데, **같은 안내가 `CLAUDE.md` 9번 항목에 그대로 남아 있었다.** AI가 절차서로 읽는 문서가 실행 불가 명령을 지시하므로 코드 수정의 효과가 반감된다. → `rework` → `start-verification`으로 정정하고 왜 `invalidate`를 쓸 수 없는지도 한 줄 남겼다.

### R-2. `runTypecheck()`의 JSDoc이 바뀐 계약을 안 따라왔다 — **수정됨**

`@returns {{ status: number, scope: 'full'|'logic-only' }}`인데 수정으로 **둘 다 `null`일 수 있게** 됐다(시그널사 시 `status`, 실패 시 `scope`). 시그니처가 바뀌면 JSDoc을 갱신한다는 규칙 대상이다.

### R-3. 계획 문서가 상태 키 위치를 틀리게 적고 있었다 — **수정됨**

`verification.ts_check_scope`로 적었으나 실제 코드는 **`verification` 밖 최상위**다. 안에 넣었으면 `every(Boolean)`이 문자열을 truthy로 먹어 조기 전이했을 자리라 **코드가 옳고 문서가 낡았다.** 코드 기준으로 고치고 그 이유도 함께 적었다.

---

## 재리뷰가 찾은 잔여 구멍 — 백로그 **F44**로 이관 (이번 슬라이스 밖)

`verification` phase는 스크립트 편집이 허용되므로, `pass ts` 통과 → **코드 수정 → `invalidate`도 `pass ts` 재실행도 안 함** → 나머지 `pass`만 채우면 타입이 깨진 코드가 머지된다. 크로스머신 stale도 같은 구멍의 변형이다.

**이번 슬라이스가 회귀시킨 것이 아니다.** 성질이 `cso`·`lint`·`review` 세 플래그가 이미 갖고 있는 노출과 동일하고(같은 편집이 저 셋도 stale로 만든다), `CLAUDE.md`가 "코드 수정 → `invalidate`"를 절차로 못박아 규율 층에서 덮고 있다. 상태 머신의 원래 설계 경계다.

다만 **`ts`만은 기계 검증이 가능하다**는 것이 이 슬라이스의 명제이므로 여기까지 마감할 수 있다. 봉합안(`approve-pr`이 `runTypecheck()`를 실측)과 함께 **F44**로 등록했다.
- **`ts_check_scope` 초기화 경로에 새는 곳이 없다** — `freshState`(start)·`resetVerification`(approve-plan·start-verification·invalidate·rework) 전수 확인.
- **종료코드 2를 안 것.** `=== 1`로 짰으면 **모든 타입 에러를 통과시키는** 게이트가 됐다.
- **프레시 클론 경로가 루프홀이 아니다.** exit 0 + `scope: logic-only`는 통과처럼 보이지만 `approve-pr`이 거부하므로 머지 전에 반드시 게임 코드가 검사된다.
- **런타임 무변경 확인.** `.instance`를 `undefined`/`null`로 구별하는 코드가 **0건**이고, `onDestroy`가 이미 `null`을 넣고 있었으므로 새 초기값이 새로운 상태를 만들지 않는다. `useDefineForClassFields`는 어디에도 설정돼 있지 않다.
- **신규 `.meta` 0건** — CLAUDE.md 규칙 준수.
