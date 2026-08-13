# QA — 정본 이전 + 링크 검사기 (canon-spec-move)

- **브랜치:** `feat/canon-spec-move`
- **계획:** [`2026-08-13-canon-spec-move-plan.md`](../development/sessions/2026-08-13-canon-spec-move-plan.md)
- **성격:** 문서 구조 작업 + 검사 도구 신설. 게임 코드(`game/assets/scripts/`)와 씬·프리팹은 **한 줄도 건드리지 않는다.**

---

## 이 슬라이스에서 무엇을 확인하나

두 가지다. 첫째, 정본 문서 여섯 개가 `docs/development/spec/` 아래 새 이름으로 옮겨 갔고 그 이사를 따라가지 못한 참조가 하나도 남지 않았는가. 둘째, 앞으로 그런 참조가 다시 깨지면 **테스트가 잡는가.**

첫째는 대부분 자동으로 확인된다. 둘째도 자동이지만, 검사기가 못 보는 사각지대가 하나 있어서 사람 눈이 필요하다 — **평문 파일명 언급**이다. `docs/development/conventions.md`처럼 링크가 아니라 문장 속에 적힌 경로는 마크다운 링크가 아니라서 검사기가 지나친다. 그래서 수동 체크리스트의 절반이 거기에 쓰인다.

## Impact Map

| 변경 대상 | 확인 범위 |
|---|---|
| `docs/development/{conventions,i18n-guide,writing-style,glossary,build-and-distribution,environment-setup}.md` → `spec/` | 새 경로에 있고 옛 경로가 비었는가. 절 번호가 그대로인가. 머리말이 정본 모양인가 |
| `docs/development/architecture.md` (제거) | `git ls-files`에서 사라졌는가. `docs/temp/`에 **추적되지 않은** 사본이 남았는가 |
| `docs/development/spec/game-combat.md` (신설) | ADR 006·007의 현재 결론만 담았는가. 반전 경위가 안 딸려 왔는가 |
| `docs/development/spec/README.md` · `docs/design/spec/README.md` | 「목록」 표가 폴더의 실제 파일과 일치하는가. F73을 가리키던 꼬리 문구가 고쳐졌는가 |
| `CLAUDE.md` | 라우팅 표가 접혔는가. **아트 3행은 남았는가.** 크기 예산(14,000자·240줄) 안인가 |
| `tests/helpers/LinkCheck.ts` (신설) · `.claude/workflow.mjs` (`check-links` 추가) | 단위 테스트 통과. `pnpm wf check-links`가 도는가 |
| `docs/**` 전체 · 루트 `README.md` | 깨진 링크 0건 |
| `docs/development/backlog{,-implement}.md` | F69·F73·F74·F75·F78 행이 현재 사실과 맞는가 |
| `tests/helpers/CanonDoc.ts` · `tests/logic/CanonDoc.test.ts` | 주석 속 `writing-style.md` 언급이 새 이름으로 바뀌었는가 |

**회귀 기준.** 게임 로직에 손대지 않으므로 인게임 동작은 전부 회귀 대상이 아니다. 다만 `pnpm wf` 절차 배달은 문서를 읽어 오므로 회귀 대상이다 — `docs/development/workflow/` 안의 문서가 `conventions.md`·`writing-style.md`를 평문 경로로 부르고 있어서, 그 경로가 낡으면 매 슬라이스 사용자에게 존재하지 않는 파일이 안내된다.

## 씬/프리팹 변경 사항

**없다.** 계획 §4 「하지 않는 것」이 씬 수정을 명시적으로 제외했다. `i18n-guide`에 `LocalizedLabel` 대 `t()` 선택 규칙을 적으면서 `main.scene`의 `LocalizedLabel` 네 개가 의도인지 잔재인지를 가리지만, 그 판정 결과는 문서에만 적고 씬은 그대로 둔다. 고쳐야 한다는 결론이 나오면 백로그 항목으로 올린다.

씬 파일을 열지 않으므로 이 슬라이스는 신규 `.meta`를 만들지 않는다. 다만 `tests/helpers/LinkCheck.ts`는 `game/assets/` 밖이라 `.meta` 대상이 아니고, `pnpm wf check-meta`는 이번에도 0건이어야 한다.

## 에디터 연결 체크리스트

**없다.** `@property`로 노출되는 새 프로퍼티가 없고 새로 만드는 노드도 없다. 사용자가 Cocos 에디터를 여는 이유는 이 슬라이스에서 **인게임 회귀가 없다는 것을 확인하는 것뿐**이다(아래 수동 체크리스트 마지막 항목).

## 수동 테스트 체크리스트

### 자동 검사가 덮는 것 — 먼저 돌린다

- [ ] `pnpm vitest run` — 전체 스위트 통과
- [ ] `pnpm wf check-links` — 깨진 링크 0건
- [ ] `pnpm typecheck` — 통과
- [ ] `pnpm wf check-docs` — 절차 문서 정합 통과
- [ ] `pnpm wf check-meta` — 누락 0건

### 검사기가 못 보는 것 — 사람이 본다

평문 언급은 마크다운 링크가 아니라서 검사기가 지나친다. 아래는 그중 **낡으면 실제로 사람을 잘못 안내하는 자리**만 골랐다.

- [ ] `docs/development/workflow/implementation.md`가 부르는 코드 규약 문서 경로가 `docs/development/spec/code-conventions.md`인가
- [ ] `docs/development/workflow/user-verification.md`가 부르는 문체 문서 경로가 `docs/development/spec/docs-writing-style.md`인가
- [ ] `CLAUDE.md` 「행동 규칙」의 두 문서 경로가 새 경로인가 (라우팅 표 밖이라 표 접기로는 안 고쳐진다)
- [ ] `git grep -n "development/conventions\.md\|development/writing-style\.md\|development/glossary\.md\|development/i18n-guide\.md\|development/build-and-distribution\.md\|development/environment-setup\.md"` — 결과가 시점 기록(`sessions/`·`qa/`)의 맨 파일명 언급뿐인가. 정본·`CLAUDE.md`·`workflow/`에 남아 있으면 놓친 것이다
- [ ] `git grep -n "code-code-\|docs-docs-"` — 0건인가 (부분 문자열 충돌로 이름이 겹쳐 붙은 사고 확인)

### 문서가 사람에게 제대로 보이는가

- [ ] GitHub PR의 **Files changed**에서 옮긴 문서 여섯 개를 열어 본문 링크를 클릭 — 전부 열리는가
- [ ] `docs/development/spec/README.md`의 「목록」 표에 일곱 줄(옮긴 6 + `game-combat.md`)이 슬러그 사전순으로 있는가
- [ ] `docs/design/spec/README.md`의 꼬리 문구가 F73이 아니라 **F69**를 가리키는가
- [ ] `CLAUDE.md` 라우팅 표에서 "무엇을 왜 그렇게 그리나"·"몇 px·어떤 피벗인가"·"어떤 프롬프트로 뽑나" **세 행이 아직 파일명으로 남아 있는가** (지금 접으면 빈 인덱스로 보내진다 — 계획 CN1)
- [ ] `docs/temp/architecture.md`가 로컬에 있고 `git status`에 안 뜨는가

### 절차와 인게임이 그대로인가

- [ ] `pnpm wf steps implementation` — 절차 문서가 정상 출력되는가
- [ ] Cocos 에디터로 게임을 한 판 돌려 본다. 이 슬라이스는 게임 코드를 건드리지 않았으므로 **아무것도 달라지지 않아야 한다** — 달라졌다면 슬라이스 밖의 파일을 건드린 것이다

---

## 확정 이력

- 2026-08-13 — 계획 승인 직후 작성. 씬·프리팹·에디터 절은 이 슬라이스에 해당 사항이 **없음으로 확정**이라 사유와 함께 비웠다.
- 2026-08-13 — 구현 완료 후 확정. 검사기가 실제로 잡은 수치로 아래 「구현이 확인한 것」을 채웠다.

## 구현이 확인한 것

계획이 추정으로 적었던 것 중 구현이 실제로 재서 확정한 값이다.

| 항목 | 확정값 |
|---|---|
| 이동 전 레포 전체 깨진 링크 | **10건** — 루트 `README.md` 4 + 세션 문서 6 |
| 이동이 새로 깨뜨린 링크 | **10건** — 옮긴 여섯이 **내보내던** 상대 링크다. 검사기가 전부 잡았고 그 자리에서 닫았다 |
| 걷어낸 결정기록 링크 | **4건** — `code-conventions` 2(ADR 002·005) · `docs-glossary` 1(ADR 007) · `ops-build` 1(세션 문서) |
| 앵커 불일치 | **0건** — 다만 CRLF 문서에서 제목을 하나도 못 찾는 버그가 있어 한때 11건으로 잡혔다(아래) |
| `main.scene`의 `LocalizedLabel` 4개 | **잔재로 확정.** `PauseController`가 같은 네 노드에 같은 네 키를 코드로 넣고 있다. 씬 편집이라 백로그 **F79**로 올렸다 |

**검사기가 CRLF에서 조용히 틀렸던 것을 레포 전체 그물이 잡았다.** 이 레포는 줄 끝을 섞어 쓰는데(`art-generation-playbook.md`는 CRLF, `code-conventions.md`는 LF), 제목 정규식의 `$`가 줄 끝 `\r` 앞에서 안 맞아 CRLF 문서의 앵커가 **하나도** 수집되지 않았다. 그 결과 멀쩡한 앵커 링크 11개가 깨진 것으로 신고됐다. 단위 테스트만 있었으면 통과했을 버그다 — 픽스처 문자열은 전부 LF였기 때문이다.
