# 코드 리뷰 이슈 — ui-font-probe

**리뷰 커밋:** 6d27e7e43a750cb69b69d1e13772f8fac612169d(기준 `1654555`와의 차이 — 아래 「재리뷰」 절은 리워크 커밋 `ef518d9..6d27e7e`를 봤다)
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

---

## 재리뷰 (리워크 커밋 `ef518d9..6d27e7e`, 2026-11-05)

사용자 검증에서 사용자가 「주석만 읽어서는 흐름을 따라갈 수 없다」고 지적해 리워크했다. 바꾼 것은 주석 · 테스트 이름 · 도구 머리말뿐이다. 독립 서브에이전트가 리뷰했고 판정은 「고친 뒤 머지」였다. 리뷰어가 주석을 뺀 구문 트리를 앞뒤로 비교해 게임 코드 여덟 파일의 동작이 그대로인 것을 확인했고, 새로 추적된 `.meta`가 없는 것도 확인했다. 아래 지적은 모두 리워크에서 새로 쓴 주석이 코드와 어긋난 것이라 바로 고쳤다.

### Important

- **R1.** `parseLabUrl` 주석이 sizeScale · countScale도 비교판의 `J` 출력에서 온다고 적었다. `J` 출력(`buildMeasureUrl` · `buildCompareUrl`)은 pick · tune만 채운다. sizeScale · countScale은 측정이 문턱을 넘었을 때 사람이 손으로 붙이는 값이라고 고쳤다. **수정됨** ✅
- **R2.** `parseLabUrl` 주석이 `load=max`를 「가진 마법을 모두 최대로 강화한 상태」라고 적었다. `maxLoadSeed`는 발사체 수 강화(개별 · 분류)만 상한까지 채우고 데미지 · 쿨다운 강화와 더블 캐스팅은 넣지 않는다. 그대로 고쳤다. **수정됨** ✅
- **R3.** `LabRuntime` 주석이 `targetAlive`를 쓰는 쪽에서 비교판(`VfxLab`이 `COMPARE_DUMMY_COUNT`로 쓴다)을 뺐다. 머리 주석과 필드 주석 둘 다 고쳤다. **수정됨** ✅
- **R4.** 이름을 바꾼 용어의 복사본이 남았다. 테스트 이름 셋(「문자열 바꾸기 장치」 · 「측정 장치」), `VfxLab._restoreHud`의 「문자열 주인」, QA 문서의 「HUD 손잡이」 · 「문자열 바꾸기 장치」 · 「문자열 쓰기 주인」 · 「F 상태」 · 「1층 HTML 판정판」을 함께 고쳤다. **수정됨** ✅
- **R5.** `LabRuntime.vfxOff` 필드 주석이 「지금 끔 블록이다」로 남아 있었다. 이 슬라이스가 `off=ui`를 넣은 뒤로 UI 몫 측정의 켬 블록에서도 참이다. 이펙트 측정의 끔 블록과 UI 몫 측정의 모든 단계에서 참이라고 고쳤다. **수정됨** ✅

### Minor

모두 이번 리워크가 쓴 주석이라 함께 고쳤다. **수정됨** ✅

- `FontProbe._handleKey`의 `N` 키 설명에 뒤 화면에는 결과 화면 묶음이 늘 있고 넘친 줄이 그 뒤에 붙는다는 것을 넣었다.
- `LabRuntime` 머리 주석: `hudDriven`은 UI 몫 측정만 쓴다. 모드를 적는 것은 순수 함수 `parseLabUrl`이 아니라 `DataManager._resolveLab`이다. `SpellCaster`는 `onReady` 뒤에 컴포넌트를 붙이고, 측정은 「측정 시작」 버튼이나 Space로 시작한다는 단계를 더했다.
- `parseLabUrl` 주석: `cache`가 바꾸는 것은 HUD 라벨 넷뿐이다. 처음 나오는 `stem`에 뜻을 붙였다. 「(계획 · QA 문서는 거울)」을 「(QA 문서가 이 목록을 옮겨 적는다)」로 고쳤다.
- `ProbeRowId` 주석의 `1-라` · `3` 줄 설명을 실제 고르는 방식(가장 넓은 줄 · 가장 높이 쌓이는 카드 문구)에 맞췄다.
- `FontProbe`의 채팅 질문 주석에 질문 넷이 모두 사람의 판단이라는 이유를 넣고, 판정 조건은 정본 `art-asset-spec.md` §10.1을 가리키게 했다.
- 「HTML 비교 화면」 · 「HTML 비교판」 두 이름을 「HTML 시안 페이지」 하나로 통일했다. 「비교판」은 `lab=compare`의 이름이라 헷갈린다. 외곽선 1단계는 정본 §10.1을 가리킨다.
- 예산 상수 둘(`UI_THRESHOLD_MS` · `FONT_BUDGET_BYTES`)에 정본 §8.5의 상한과 같아야 하고 바꿀 때 함께 고친다는 말을 더했다.
- `nextBodyWeight` 주석의 끊긴 줄바꿈을 이었다.

### 범위 밖 (언급만)

이 슬라이스가 건드리지 않은 코드라 고치지 않는다.

- `EnemyController.ts` · `EnemySpawner.ts`의 「실험 판(측정 · 비교판)」 주석에 이 슬라이스가 `isLabStage`에 넣은 폰트 판정 화면이 빠졌다.
- `LabRuntime.liveCounts` 주석의 「그림 공장」은 앞 슬라이스의 지어낸 말이다.
- `parseLoad` 오류 문구의 「base(기본)」는 실제 기본값(max)과 반대로 읽힌다. 실행 중에 보이는 문구라 동작 변경에 해당한다.
