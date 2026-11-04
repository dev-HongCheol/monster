# 코드 리뷰 이슈 — ui-font-probe

**리뷰 커밋:** 9446b13ee49663a9b7dcc0d91e5beee8b9cbc5fc(기준 `1654555`와의 차이)
**리뷰:** 독립 서브에이전트(2026-11-04). 판정은 「고친 뒤 머지」 — 꼭 고칠 것은 없고, 고치는 것이 좋은 것 하나와 작은 것 열하나였다.

---

## Important

### 1. 판정이 끝난 뒤에는 서브셋 도구로 폰트를 다시 만들 수 없는데, 머리 주석에 그 사정이 없다
- 위치: `tools/ui/make_font_subset.py`(머리 주석 · `check_same_glyph_tables` · `run_final` · `--weights` 기본값)
- 판정 뒤 후보 파일을 지웠으므로 `--final`을 다시 돌리면 검사 7이 「비교할 후보 파일이 없다」로 멈춘다. 그렇다고 후보 만들기를 다시 돌리면 후보 이름의 TTF와 고지가 `resources/fonts` · `licenses` 폴더에 다시 생기고, git은 그것을 막지 않는다. 사양서 §10.1이 다시 만드는 방법을 이 머리 주석에 맡겼고 F147이 곧 글자 목록을 바꿔 다시 돌릴 슬라이스라 문제가 된다. `--weights` 기본값도 판정값이 아니라 400,800이었다.
- 수정: `--rebuild <원본 키>`를 더했다. 이긴 원본을 이름으로 받아 후보 파일과 대응표 없이 최종 파일을 만들고, 검사 7은 건너뛴 사유를 보고 파일에 남긴다. 머리 주석에 이 경로와 이유(후보를 다시 만들면 커밋 위험, 글자 목록이 바뀌면 검사 7은 원리상 통과할 수 없다)를 적고, `--weights` 기본값을 `500,800`으로 바꿨다. `--final`과 함께 주면 멈춘다. 스크래치 폴더에서 `--rebuild notosanskr`로 다시 만든 두 파일의 글리프 표와 이름 표가 커밋된 파일과 같음을 확인했다.
- **수정됨** ✅

---

## Minor

### 2. UI 몫 결과 파일 이름에 조건이 없다
- 위치: `components/VfxLab.ts`(`_finish`), `logic/VfxRecipeLogic.ts`(`resultFileName`)
- UI 회차 셋이 모두 `gate-1920x1080-max-all-<시각>.json`이라 이펙트 측정과도, UI 회차끼리도 이름으로 가를 수 없었다. 이름의 `max`도 UI 측정과 상관없는 값이다.
- 수정: `off=ui`이면 `uiResultFileName`이 `ui-<창>-<cache>-<drive>-<시각>.json`을 만든다. 테스트를 더했고, 최종 빌드에서 `ui-1920x1080-char-real-…json`으로 나오는 것을 헤드리스 Chrome으로 확인했다. 이미 저장한 결과 파일 여섯은 이름을 바꾸지 않았다.
- **수정됨** ✅

### 3. K 두 번 누르기 보호가 키 자동 반복에 뚫린다
- 위치: `components/FontProbe.ts`(`_handleKey`)
- K를 반 초쯤 누르고 있으면 자동 반복 입력이 두 번째 누르기가 되어 확인 없이 저장된다. B · L · 1~3도 반복될 때마다 열 전체를 다시 만든다.
- 수정: 자동 반복(`e.repeat`)은 무시한다. `Tab` 반복은 초점 이동만 막는다.
- **수정됨** ✅

### 4. K 확인 대기가 풀려도 아래 띠는 그대로다
- 위치: `components/FontProbe.ts`(`_handleKey`)
- 처리하지 않는 키(WASD 등)로 확인 대기가 풀리면 띠를 다시 그리지 않아, 띠에는 「K를 한 번 더 누르면 저장」이 남았다.
- 수정: 확인 대기가 풀리는 순간 띠를 다시 그린다. 헤드리스 Chrome에서 K 뒤 W를 누르면 띠의 저장 대기 문구가 사라지는 것을 확인했다.
- **수정됨** ✅

### 5. 두 폰트에 공통 본문 굵기가 없는 설정을 막지 않는다
- 위치: `logic/UiFontProbeLogic.ts`(`parseFontProbeConfig` · `nextBodyWeight`)
- body가 겹치지 않으면 한쪽 열이 없는 파일을 찾아 시스템 글꼴로 그려지는데 화면은 「유효」로 떴고, G를 누르면 `nextBodyWeight([], w)`가 `undefined`를 돌려줬다.
- 수정: 폰트가 둘이면 공통 굵기가 없을 때 설정 오류로 낸다. 공통 굵기 계산은 `commonBodyWeights`로 순수 로직에 옮겼고, `nextBodyWeight`는 빈 목록이면 지금 값을 그대로 둔다. 테스트를 더했다.
- **수정됨** ✅

### 6. 측정을 멈춘 사유가 모두 「시간 초과」로 뭉개진다
- 위치: `components/VfxLab.ts`(폰트 준비 콜백)
- 폰트가 3초 안에 와도 등록 이름을 찾지 못하면(`missing`) 같은 「시간 초과」로 적혀, 느린 연결과 이름 불일치를 결과 파일에서 가를 수 없었다.
- 수정: 사유에 그때의 상태를 붙인다(`시간 초과(상태 loading)` 등).
- **수정됨** ✅

### 7. 낡은 설명 주석
- 위치: `components/VfxLab.ts` 클래스 JSDoc
- 「`LabRuntime.mode.enabled`일 때만 SpellCaster가 붙인다」고 적혀 있었는데, 지금은 `lab=font`이고 오류가 없으면 `FontProbe`가 대신 붙는다.
- 수정: 붙는 조건을 지금 동작대로 고쳤다.
- **수정됨** ✅
- 이번에 건드리지 않은 `systems/EnemySpawner.ts`의 「실험 판(측정 · 비교판)」 주석도 이제 판정 화면이 지나는 코드라 낡았다. 슬라이스 밖이라 언급만 한다.

### 8. 같은 값이 두 곳에 있다
- 위치: 적 수 200(`VfxRecipeLogic` · `FontProbe`), 결과 화면 단계 수 4(`UiFontProbeLogic` · `FontProbe`), 내려받기 함수(`FontProbe` · `VfxLab`), 타이머 `mm:ss`(`FontProbe` · `driverValue`)
- 수정: 넷 모두 한 곳만 남겼다 — `FONT_PROBE_COUNT` · `RESULT_STEPS`를 내보내 판정 화면이 가져다 쓰고, 내려받기는 `VfxLab`의 `downloadBlob`, 타이머 글자는 `timerText`로 모았다. `timerText` 테스트를 더했다.
- **수정됨** ✅

### 9. 라이선스 문구의 인과가 맞지 않는다
- 위치: `docs/development/spec/ops-licensing.md` §2, `game/build-templates/web-mobile/licenses/NOTICE.txt`, `tools/ui/make_font_subset.py`(`modifications`)
- 「예약 이름이 Source라서 UiSans로 바꾼다」, 「as required by the Reserved Font Name clause」라고 적었지만, 예약 이름 「Source」는 원래 이름 「Noto Sans KR」에 없다. 이름을 바꾼 이유는 이름을 가린 판정 뒤 중립 이름 하나로 내보내려는 프로젝트의 선택이다.
- 수정: 정본 문장을 그 인과로 고치고, 고지와 도구 출력을 `Renamed to "UiSans"`로 줄였다.
- **수정됨** ✅

### 10. 정본끼리 값을 옮겨 적었다
- 위치: `docs/development/spec/ops-licensing.md` §2, `docs/development/spec/docs-glossary.md`
- 라이선스 행이 파일 이름 `UiSans-500.ttf` · `UiSans-800.ttf`(곧 본문 굵기 값)를 사양서 §10.1과 함께 들고 있었다. 용어 사전 OFL 항목에는 확인 날짜가 박혀 있었다.
- 수정: 라이선스 행은 `resources/fonts/UiSans-*.ttf`로 가리키고 굵기는 사양서 §10.1에 맡겼다. 용어 사전의 날짜는 지웠다(확인일은 라이선스 정본의 「확인」 칸이 든다).
- **수정됨** ✅

### 11. 판정 틀이 잘못된 주소에서 멈춘다
- 위치: `tools/ui/embed-1280x720.html`
- `build=http://`처럼 해석할 수 없는 값이면 `new URL`이 예외를 던져 틀이 빈 채로 남았다.
- 수정: 예외를 받아 받지 않는 주소와 같이 경고하고 같은 폴더의 빌드를 띄운다. 헤드리스 Chrome으로 확인했다.
- **수정됨** ✅

### 12. 사소한 것 셋
- 가. UI 회차가 끝난 뒤 HUD 라벨의 Cache Mode와 폰트를 되돌리지 않는다(`VfxLab.ts`). 실험실 안의 일이고 측정이 끝나면 페이지를 다시 연다 — 고치지 않고 기록만 한다.
- 나. UI 회차 결과에도 이펙트 판정(`judge` · `nearThreshold`)이 함께 남아 헷갈릴 수 있다. 결과 파일 형식을 바꾸는 일이라 형식 번호를 올려야 하므로, 이번에는 고치지 않고 기록만 한다. UI 판정은 `ui` 칸이 든다.
- 다. K로 저장할 때 쓰는 유효 판정이 최대 0.5초 전의 값이었다(`FontProbe.ts`). 저장 직전에 다시 판정한다. **수정됨** ✅

---

## 게임 정책 · 설계 의견 (기록만)

- UI 몫 측정 세 회차는 `load`를 적지 않아 기본값 max로 돌았다. 이펙트는 두 블록 모두 꺼지고 같은 조건이 두 블록에 걸려 결과는 공정하다. F139가 다시 잴 때 조건이 같아지도록 QA 문서 §5.4에 적었다.
- NONE과 CHAR의 비교는 회차가 하나씩이다. 정본도 「가를 수 없다」고 적었고, Cache Mode는 성능이 아니라 규칙으로 정한다.
