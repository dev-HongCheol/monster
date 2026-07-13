# TS 툴체인 — 타입 게이트를 실제로 켠다 (F27 + F30)

- **작성일:** 2026-07-13 · **2차 개정:** 2026-07-13 (autoplan CEO·Eng 리뷰 결과 2분할)
- **브랜치:** feat/ts-toolchain
- **상태:** **완료** — 구현·검증·수동 QA 통과, PR #56 (2026-07-13). 리뷰 2회가 게이트의 우회 경로 2개를 찾아 봉합했다(`../../qa/ts-toolchain-review-issues.md`). 잔여 stale 구멍은 **F44**로 이관.
- **백로그:** F27(정의 할당 단언 TS1255) · F30(`lib` 미지정 TS2550) 을 닫는다. **F24(싱글톤 null 정직화)는 후속 슬라이스**로 분리하고 이 계획이 그 재료를 넘긴다.
- **성격:** 툴체인 슬라이스. **게임 로직을 바꾸지 않는다.** 타입 게이트를 설치하고, 그 게이트가 강제되게 만든다.

---

## 1. 배경 — 우리가 잘못 알고 있던 것

백로그 F27은 이 문제를 "IDE와 Cocos 번들 TypeScript의 **버전 불일치로 인한 오탐**"으로 기록해 두었다. 확인해 보니 **틀렸다.**

Cocos Creator 3.8.8이 번들하는 TypeScript는 5.8.2다. 그 컴파일러를 직접 돌려도 `static instance!: DataManager;`에 **똑같이 TS1255를 낸다.** 원인은 버전 차이가 아니라 문법 규칙이다 — 정의 할당 단언(`!`)은 **static 멤버에 허용되지 않는다.** 게임이 도는 이유는 **Cocos가 타입 검사를 하지 않고 트랜스파일만 하기 때문**이다. 우리는 진짜 타입 에러를 조용히 무시한 채 개발해 왔다.

## 2. 진짜 문제 — 게이트가 세 겹으로 눈을 감고 있다

**첫째, 도구가 일부만 본다.** 6단계 `pass ts`는 `mcp__ide__getDiagnostics`로 확인하는데, 이 도구는 VS Code에 **열려 있는 파일만** 본다.

**둘째, 게이트가 강제하지 않는다.** `.claude/workflow.mjs`의 `pass()`는 검증 없이 플래그만 뒤집는다(`s.verification[CHECK_FLAG[check]] = true;`). 같은 파일의 `ready-impl`은 vitest로 RED를, `start-verification`은 GREEN을 실제로 확인하는데 **`pass ts`만 명예제도다.** 그래서 CLAUDE.md 문장만 바꿔선 아무것도 달라지지 않는다 — 실행하지 않고도 통과시킬 수 있다.

**셋째, 테스트 코드는 아무도 안 본다.** 루트 `tsconfig.json`이 없고 `game/tsconfig.json`은 `**/*.test.ts`를 제외한다. vitest는 타입을 보지 않는다. 즉 **ADR 003이 테스트 전략의 중심으로 삼은 `logic/`+`tests/`가 통째로 무검사다.**

## 3. 실측

재현 명령을 남긴다. 이 수치가 스코프 결정의 근거다.

```bash
node "C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/bin/tsc" \
  -p game/tsconfig.json --noEmit [--skipLibCheck --lib ES2017,DOM,DOM.Iterable]
```

| 설정 | 라이브러리(`cc.d.ts`) 에러 | 우리 코드 에러 |
|------|--------------------------|---------------|
| 현재 그대로 | 102 | 23 |
| `skipLibCheck` + `lib: ES2017` | **0** | **7** (전부 F27의 TS1255) |

**`lib`은 ES2017이면 충분하다.** 처음엔 ES2020이 필요하다고 봤는데(`matchAll`), 그걸 쓰는 파일이 **`I18nKeyGuard.ts` 단 하나**이고 이 파일은 **자기 테스트만 import하는 테스트 전용 헬퍼**다(게임 코드 참조 0건). 그런데도 `game/assets/scripts/logic/`에 살고 있어 Cocos 번들에 실려 나간다. 이걸 `tests/`로 옮기면 shipped 코드의 `lib` 천장을 올릴 이유가 사라진다(옮긴 뒤 재측정: ES2017로 잔여 에러 0).

**`skipLibCheck`에 대한 정직한 각주:** `cc.d.ts` 에러 102건이 전부 WebGPU 타입 부재는 아니다. 그중 **15건은 미해결 모듈**(`pal/input/*`·`pal/audio/*`·`cc/editor/*`)이고 `skipLibCheck`는 **보고만 끌 뿐** 그 모듈이 타이핑하던 심볼은 `any`로 남는다. `PlayerController`가 쓰는 입력 API가 그 영역이다. 따라서 "에러 0"은 **입력 서브시스템 타입이 `any`로 새는 것을 제외하고** 0이다. 이 슬라이스가 그것까지 막지는 못한다.

## 4. 2분할 — 이 슬라이스가 하는 것과 하지 않는 것

리뷰 결과 원래 스코프에 성격이 다른 두 덩어리가 섞여 있음이 드러나 나눴다.

**이번 슬라이스(게이트):** 컴파일러와 게이트를 설치한다. 게임 로직은 건드리지 않으므로 회귀 위험이 거의 없고 수동 QA가 가볍다.

**다음 슬라이스(F24 — 싱글톤 null 정직화):** 매니저 7개의 `static instance` 타입을 `T | null`로 바꾸고 **가드 없는 역참조 73곳(13파일)** 에 가드를 넣는다. 이건 게임 로직 변경이고, 잘못 넣으면 조용히 게임이 깨진다(§7 참고). **이번 슬라이스가 켜는 타입 게이트가 그 73곳을 하나하나 검증해 준다** — 그래서 순서가 이렇다.

### 임시 다리 — 의도적으로 남기는 거짓말

매니저 7개는 이번에 `static instance: T = null as unknown as T;`로 바꾼다(`= null!`이 아니다 — Biome의 `noNonNullAssertion`이 `!`를 금지하며, `onDestroy`가 이미 쓰던 관용구가 이쪽이다). 이건 **거짓말이다** — 7개 전부 `onDestroy`에서 `instance`에 null을 넣으므로 null은 정상 런타임 값인데, 이 타입은 컴파일러에게 "절대 null 아님"이라 말한다.

그런데도 이렇게 하는 이유는, **게이트를 초록불로 만들어 지금 강제하기 위해서**다. TS1255 7건이 남아 있으면 `pnpm typecheck`가 통과하지 못하고 게이트를 켤 수 없다. 이 다리는 **다음 슬라이스가 곧바로 철거한다.** 오래 두지 않으며, F24가 73곳 측정치와 함께 백로그 상단에 대기한다.

**따라서 이 슬라이스는 "타입이 안전해졌다"고 주장하지 않는다.** 주장하는 것은 "타입체크가 전 파일에 대해 실제로 돌고, 안 돌면 진행이 막힌다"까지다.

## 5. 변경 내역

**컴파일러 설정 (F30)**
- `game/tsconfig.json` 커스텀 절에 `lib: ["ES2017", "DOM", "DOM.Iterable"]`과 `skipLibCheck: true`를 더한다.
- `game/assets/scripts/logic/I18nKeyGuard.ts` → `tests/helpers/I18nKeyGuard.ts`로 옮긴다(테스트 import 경로 수정, Cocos가 만들었던 `.meta` 제거). 게임 번들에서 빠지고, shipped 코드의 `lib`이 ES2017로 내려간다.

**임시 다리 (F27)**
- 싱글톤 선언 7곳(`GameManager`·`DataManager`·`DeckManager`·`WaveManager`·`MapManager`·`ExperienceManager`·`SpellCaster`)을 `static instance: T = null as unknown as T;`로. §4의 단서를 코드 주석에도 남겨 다음 슬라이스가 철거 대상임을 알게 한다.

**타입체크 명령**
- `package.json` — `typescript`(Cocos 번들과 같은 5.8.x 고정)와 **`@types/node`** 를 devDependency로 추가하고 `typecheck` 스크립트를 더한다. `@types/node`가 없으면 새 테스트 프로젝트가 `node:fs` 등으로 TS2307 18건을 낸다(테스트 6개가 JSON을 `fs`로 읽는다).
- **`tsconfig.tests.json` 신설** — `tests/**` + `game/assets/scripts/logic/**` + `game/assets/scripts/data/**`를 덮는다. **Cocos base를 extends하지 않는다**(그 base는 `module: ES2015`라 `import.meta`가 TS1343으로 터진다 — 테스트 6개가 쓴다). 독립 설정으로 `module: ES2020` 이상 + `types: ["node"]` + `strict`. **`logic/`은 `cc`를 import하지 않으므로 이 프로젝트는 Cocos 설치 없이, 프레시 클론에서도 돈다.**
- `tests/logic/MagicAddCard.test.ts:15` — 기존 테스트에 **진짜 타입 에러**가 있다(TS2741: `ISpellData`의 필수 필드 `pattern` 누락). vitest가 타입을 안 봐서 지금껏 통과했다. 새 프로젝트의 첫 빨간불이며, 고친다.

**게이트를 진짜로 만들기**
- **`.claude/workflow.mjs`** — `pass("ts")`가 실제로 타입체크를 돌리고 실패하면 전이를 막는다. `runVitest`(`spawnSync` + 종료코드 판정)와 같은 패턴을 재사용한다. **`status !== 0`으로 판정한다** — tsc는 타입 에러에도 **종료코드 2**를 내므로(1이 아니다) `=== 1` 비교를 쓰면 모든 타입 에러를 통과시킨다. `spawnSync` 자체가 실패하면 `status`가 `null`이라 fail-closed지만, `error`도 확인해 엉뚱한 메시지를 내지 않게 한다.
- **프레시 클론 처리 + 검사 범위 기록.** `game/temp/tsconfig.cocos.json`은 gitignore 대상이고 내부에 절대 경로(`F:\work\monster\...`, `C:\ProgramData\cocos\...`)가 박혀 있어, **Cocos로 프로젝트를 한 번도 안 연 머신에서는 게임 프로젝트 타입체크가 TS5083으로 죽는다.** 사용자는 크로스머신으로 작업한다(F9).
  - 테스트 프로젝트는 **항상** 돈다(Cocos 무관).
  - 게임 프로젝트는 그 파일이 있을 때만 돌리고, 없으면 사람이 읽는 안내를 낸다.
  - 어느 범위가 돌았는지를 상태 파일 최상위의 `ts_check_scope: "full" | "logic-only"`로 남기고(`verification` 객체 **안이 아니다** — 안에 넣으면 `pass()`의 `Object.values(verification).every(Boolean)` 판정에 문자열이 섞여 `pass` 하나만으로 조기 전이한다), **`approve-pr`이 `logic-only`를 거부한다.** 이게 없으면 "Cocos 안 깐 머신 = 타입 게이트 프리패스"가 되어, 죽이려던 명예제도가 머신 상태를 키로 부활한다.
- `.vscode/settings.json` — `typescript.tsdk`를 워크스페이스 TypeScript로 지정해 편집기와 CLI가 같은 컴파일러를 본다.
- `CLAUDE.md` — 6단계 9번의 `pass ts` 절차를 `pnpm typecheck` 기준으로 바꾸고, 프레시 클론 전제조건을 한 줄 명시한다.

**문서**
- `docs/development/backlog-implement.md` — F27·F30을 완료 아카이브로. F27에는 "오탐이 아니라 진짜 에러였다"는 정정을 남긴다. **F24를 다음 슬라이스 후보로 승격**하고 §7의 재료(73곳 측정, 가드 규칙, 지뢰 3곳, `DataManager` 콜백 버그)를 기록한다.
- `docs/development/troubleshooting/` — TypeScript 핀이 Cocos 3.8.8 번들(5.8.2)에 맞춘 것이며 Cocos 업그레이드 시 함께 올려야 한다는 절차. 이 드리프트가 애초에 F27을 오진하게 만든 원인이다.

## 6. 함께 처리하는 백로그 위생 (코드 무관)

- **J1(맵/배경)** 완료 처리 — PR #55로 구조 부분이 마감됐는데 표가 아직 `열림`이다.
- **map-arena 명시 이월 6건** 등록(건물·한강 충돌 장애물화, 한강 배리어, 적 경로탐색, 다중 맵 셀렉터, 최종 픽셀 아트, 카메라 스무딩).
- **F37(레벨업 카드 리롤)** 등록 — 완료됨.

## 7. 다음 슬라이스(F24)에 넘기는 재료 — 여기서 실행하지 않는다

리뷰가 실측으로 찾아낸 것들이다. 백로그 F24에 그대로 옮긴다.

**73곳은 기계적이지 않다. 조기 return이 상태 전이를 반쪽 실행시키는 자리가 셋 있다.**
- `GameManager._applyDamage()` — HP를 0으로 깎은 **다음** 줄에서 `WaveManager.instance.waveNumber`를 읽는다. 여기서 조기 return하면 **HP 0인데 GameOver 전이도 죽음 연출도 안 일어난다.**
- `CardSelectPanel._onPickCard()` — `DeckManager.instance.applyCard()` 다음 줄이 `GameManager.instance.resumeFromLevelUp()`이다. 앞에서 빠져나오면 **카드 패널이 열린 채 게임이 영구 정지한다.**
- `GameManager.resumeFromLevelUp()` — 장식적인 HP 보너스 계산 때문에 조기 return을 넣으면 `this._state = GameState.Playing`에 도달하지 못해 **레벨업에서 영구 락된다.**

**가드 규칙 (반드시 이 방향):** 값을 반환하는 호출에 **옵셔널 체이닝을 쓰지 않는다.** `?.`는 `undefined`를 내고 `strict`가 `?? fallback`을 강제하는데, 그럴듯한 fallback이 전부 조용히 게임을 깨뜨린다 — `effectiveCooldown ?? 0`이면 **쿨다운 0 → 매 프레임 발사**, `damageFactor ?? 0`이면 **전 마법 데미지 0**, `_pickupRadius ?? 0`이면 **XP 픽업 영구 불능**. `?.`는 반환값을 버리는 void 호출에만 쓴다. 값이 필요하면 **호이스트 + 조기 return**이다. `SpellCaster.update()`는 루프 진입 전 3개를 몰아 받으면 23건 중 상당수가 가드 하나로 사라진다.

**클로저에서는 내로잉이 살아남지 않는다.** `if (!X.instance) return;` 뒤라도 `.map(cb)`·`onReady(() => …)` 안에서는 TS18047이 다시 뜬다(Cocos 번들 tsc로 확인). 해당 자리에서 호이스트는 선택이 아니라 강제다.

**`DataManager`에 기존 버그가 있다.** `_loadAll()`이 async인데 `onDestroy()`가 `_onReadyCallbacks`를 비우지 않는다. 로딩 중 재시작하면 파괴된 구 컴포넌트의 콜백이 나중에 발화하고, 그때 `DataManager.instance`는 **null이 아니라 새 씬의 인스턴스**다. 옵셔널 체이닝은 이걸 전혀 못 본다 — 새 인스턴스에 대해 멀쩡히 성공해 그 결과를 죽은 컴포넌트에 쓴다. Cocos 관용구 `this.isValid` 가드와 `onDestroy`에서의 콜백 정리가 필요하다.

**타입체크는 가드의 *존재*만 증명하지 *의미*를 증명하지 않는다.** 위 지뢰들은 전부 타입체크 초록불이다. 그리고 가드가 들어갈 13개 파일은 전부 `systems/`·`components/`·`ui/`라 **vitest 커버리지가 0%**다. F24의 유일한 그물은 수동 플레이스루이며, 그 체크리스트에 위 세 자리를 이름으로 박아야 한다.

**house 패턴이 이미 3종 공존한다** — `?.`+`??`(`GameManager._snapshotResult`), 호이스트+조기 return(`HudController`), 무가드. 73곳을 손대기 전에 **한 가지로 확정**해야 한다.

## 8. 테스트 전략 — 스킵

새로 만드는 순수 로직이 없다. 변경은 컴파일러 설정, 워크플로우 CLI, 임시 선언, 테스트 헬퍼 이동뿐이다. `pnpm wf skip-test`로 사유를 기록한다.

다만 이번 슬라이스는 **기존 테스트 코드를 처음으로 타입체크한다** — 그 자체가 새 그물이고, 실제로 `MagicAddCard.test.ts`의 진짜 타입 에러를 하나 잡는다.

## 9. 검증

- **자동:** `pnpm typecheck` → 두 프로젝트 모두 에러 0. `pnpm test:run` → 기존 스위트 전부 통과. `pnpm check` → lint·format 통과.
- **게이트 자체 검증:** 일부러 타입 에러를 넣고 `pnpm wf pass ts`가 **실패하는지** 확인한다. 게이트가 강제된다는 주장의 유일한 근거다.
- **수동(7단계) — 가볍다.** 게임 로직이 안 바뀌었으므로 정상 한 바퀴(시작 → 웨이브 → 레벨업 → 사망 → 결과 → 재시작)면 충분하다. 확인 대상은 **`I18nKeyGuard` 이동이 Cocos 번들을 깨지 않았는지**(그 파일이 게임에서 안 쓰이므로 안 깨져야 한다)와 싱글톤 선언 형태 변경이 런타임에 무해한지다.
- **에디터 작업 없음:** 씬·프리팹 변경이 없다.

## 10. 리스크

`static instance: T = null as unknown as T`는 정적 초기화 시점에 실제로 `null`을 대입한다(기존 `instance!:` 형태는 코드를 만들지 않았다). `target: ES2015` + `useDefineForClassFields` 미사용이라 모듈 평가 시점의 단순 대입으로 컴파일되며 `onLoad`보다 앞서므로 안전하다. 다만 **에디터 프리뷰의 스크립트 핫리로드**로 모듈이 재평가되면 살아 있는 인스턴스를 지울 수 있다 — 실무상 Cocos가 씬을 리로드하므로 위험은 낮지만, 7단계에서 에디터 프리뷰를 껐다 켜는 경로를 한 번 밟아 본다.

`I18nKeyGuard.ts`를 `game/assets/`에서 빼면 Cocos가 그 자산을 잃는다. 게임 코드가 이 파일을 import하지 않음을 확인했으므로(참조 0건) 씬·프리팹 참조가 깨질 여지가 없다.
