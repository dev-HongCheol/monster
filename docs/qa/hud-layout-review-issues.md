# HUD 레이아웃 — 코드 리뷰 이슈

- **브랜치:** feat/hud-layout
- **리뷰 커밋:** `ce2903c`(base) → `3c1f9d8`(head). **재리뷰(rework):** `ce2903c`(base) → `88b1d09`(head)
- **리뷰 방식:** `superpowers:requesting-code-review` 패턴 — 별도 subagent(general-purpose) dispatch
- **판정:** **Ready to merge: Yes** — Critical 0, Important 0, Minor 4 (전부 비차단)

> 리뷰어 요약: 스코프대로 잘 떼어낸 저위험 UI 토대 슬라이스. 로직/컴포넌트 분리(ADR 002) 깔끔, 순수 함수 엣지 케이스(음수·소수·0 나눗셈·분 100+) 커버, `@property` nullable + `!` 없음, i18n 키 정합 가드 GREEN 유지, `barSprite.color` 공유 참조는 Cocos가 값 복사라 변이 위험 없음(레포 `EnemyController` 선례로 확인). XP `requiredXp === Infinity`도 `barRatio`가 0을 반환해 정상.

---

## Minor (전부 무조치 또는 이월 — 코드 수정 없음)

### M1 — 분 2자리 패딩은 `main` 대비 가시적 변경(의도 확인) → 무조치(의도됨)
- **위치:** `HudController._updateWaveInfo` → `formatTimer`(`HudFormatLogic.ts`).
- **내용:** 기존은 `{min}`을 raw 숫자로 넘겨 한 자리 분이 `"1:05"`로 표시됐으나, `formatTimer`는 분도 2자리로 패딩해 `"01:05"`가 된다.
- **판단:** 계획이 `mm:ss`를 명시하고 테스트(`65 → "01:05"`)로 고정한 **의도된 변경**. 표준 mm:ss 표기라 유지.

### M2 — 비유한 입력 가드 부재(방어적) → **백로그 이월**
- **위치:** `HudFormatLogic.ts` `formatTimer`/`barRatio`.
- **내용:** `formatTimer(NaN) → "NaN:NaN"`, `formatTimer(Infinity) → "Infinity:NaN"`, `barRatio(NaN, 100) → NaN`(→ `ProgressBar.progress`로 전파). `max = Infinity`는 이미 0 반환으로 처리됨.
- **판단:** 현재 호출자(`gameTimer`·`playerHp/maxPlayerHp`·`currentXp/requiredXp`)는 전부 유한값이라 **도달 불가**한 방어적 hardening. 지금 추가하면 전체 재검증 사이클(invalidate → cso/ts/lint/재리뷰)을 유발한다. CLAUDE.md 규칙대로 슬라이스 밖 로버스트니스 항목으로 **백로그 이월**(`Number.isFinite` 가드 + 테스트). FireGeometry의 R1 가드와 같은 결.

### M3 — HP 라벨(ceil) vs 바(raw) 반올림 불일치 → 무조치(기존 시맨틱)
- **위치:** `HudController._updateHp` — 라벨 `Math.ceil(playerHp)`, 바 `barRatio(playerHp, ...)`.
- **내용:** 1 미만 HP에서 라벨은 `1`, 바는 거의 빈 상태로 보일 수 있다.
- **판단:** 라벨 ceil은 생존 중 `0` 미표시용 **기존 시맨틱**, 바는 비례값이 맞다. 서로 다른 관심사라 결함 아님. 새 바가 차이를 가시화할 뿐. 무조치.

### M4 — `Theme.SIZES`/`FONT` 이번 슬라이스 미참조 → 무조치(의도된 토대)
- **위치:** `Theme.ts`.
- **내용:** `COLORS`만 `HudController`가 쓰고 `SIZES`/`FONT`는 아직 미참조.
- **판단:** 계획 §3.2대로 이후 UI가 얹힐 **의도된 토대**. biome은 미사용 export를 flag하지 않음. dead code 아님. 무조치.

---

## 리뷰어 권고(비차단, 참고)
- 파일명 `Theme.ts`(PascalCase)는 conventions.md 규칙에 맞음 — 계획의 소문자 `theme.ts`는 캐주얼 표기. 유지.
- 최대 레벨(`requiredXp === Infinity`)에서 XP 바가 빈 채로 보이는 건 플레이어에게 어색할 수 있음 — 가득 찬 바가 "최대치"를 더 잘 전달할 수도. 순수 비주얼 판단이라 `/design-consultation` 단계 논의(이번 슬라이스 아님, 현 동작은 문서화됨).

---

## 재리뷰 (rework `88b1d09` — XP 금색 + HP 천단위 콤마)

`superpowers:requesting-code-review` 패턴으로 rework 커밋 재리뷰. **판정: Ready to merge: Yes** — Critical 0, Important 1(테스트 위생), Minor 2.

리뷰어 검증 요약: `formatNumber`가 ADR 002대로 순수 로직에 위치, `-0` 부호 가드(`value < 0 && abs !== 0`) 정확(`-0.5 → "0"`, `-0 → "0"` 확인), 그룹핑 정규식이 천단위 경계·보스 규모·`MAX_SAFE_INTEGER`까지 정확, `ceil→floor` 이중 반올림 없음(ceil 결과는 정수라 내부 floor가 무연산), i18n `_interpolate`가 템플릿 토큰만 스캔하고 치환값을 재파싱하지 않아 사전 포맷 문자열 주입 안전.

### R1 — `abs !== 0` 부호 가드에 회귀 테스트 부재 → **수정됨**
- **위치:** `HudFormatLogic.ts` `formatNumber` / `tests/logic/HudLayout.test.ts`.
- **내용:** 기존 7 케이스는 정수 음수(`-1234`)만 커버. 가드를 `value < 0`으로 단순화해도 `-0.5 → "-0"` 회귀가 **7개 테스트 전부 통과한 채** 새어나갈 수 있음. 함수에서 가장 미묘한 한 줄이라 잠금 필요.
- **조치:** `expect(formatNumber(-0.5)).toBe('0')` + `formatNumber(-0) → "0"` 테스트 2개 추가. 피처 테스트 22/22 GREEN.

### R2 — XP 라벨은 콤마 미적용(HP만 적용) → **백로그 이월**
- **위치:** `HudController._updateXpInfo` (`hud.xp` `cur`/`req` raw).
- **내용:** 후반 HP 라벨은 `1,205`, 바로 아래 XP 라벨은 `1205`로 표기 불일치 가능. 이번 요청 스코프는 HP(+보스 placeholder)라 스코프 밖.
- **조치:** `docs/development/backlog.md`에 이월(XP 스케일 도입 시 두 수치 라벨 포맷 수렴).

### R3 — 비유한/≥1e21 입력 미포맷 → 무조치(도달 불가, YAGNI)
- **내용:** `formatNumber(Infinity) → "Infinity"`, `NaN → "NaN"`, `1e21 → "1e+21"`. HP는 유한·1e21 미만이라 도달 불가. 기존 M2(백로그의 formatTimer 비유한 가드)와 같은 결 — 별도 조치 안 함.
