# Blender 게이트 — 실행 계약

3D 마스터에서 걷기 프레임을 구워 게임 화면까지 닿는지 보는 판정 도구다. 계획은
[`2026-09-11-blender-3d-gate-plan.md`](../../docs/development/sessions/2026-09-11-blender-3d-gate-plan.md)이고
확인 항목과 멈춤 규칙은 [`blender-3d-gate-test.md`](../../docs/qa/blender-3d-gate-test.md)가 든다.

**판정은 파이썬에 없다.** Blender 쪽은 굽기만 하고 재는 것은 전부 TypeScript다. `tools/**/*.ts`는
타입체크·lint·vitest 셋을 다 지나가지만 `.py`는 어느 그물에도 안 걸리기 때문이고, 그래서 판정이
Blender 버전을 타지 않는다.

## 깔아야 하는 것

| 무엇 | 조건 |
|---|---|
| Blender | **4.2 이상 5.2 이하.** 상한은 VRM 임포터 애드온이 5.3 이상을 미지원으로 선언해서 정해졌다. 하한은 EEVEE 엔진 식별자가 4.2에서 바뀐 자리다 |
| VRM 임포터 애드온 | 공식 배포처에서 **릴리스 태그로 고정**해 받는다. 받은 zip의 SHA-256을 QA 문서에 적는다 — 태그는 재작성될 수 있어 태그 이름만으로는 같은 파일임을 보장하지 못한다 |
| Node | 22.6 이상. `--experimental-strip-types`가 그 버전부터 있다 |

**버전을 기록만 하지 않는다.** `smoke.py`가 `bpy.app.version`을 직접 확인하고 범위 밖이면
검증된 범위를 이름으로 말하며 실패한다. EEVEE 식별자는 하드코딩하지 않고 설치된 엔진 목록에서
골라, 둘 다 없으면 **실제 목록을 메시지에 담아** 실패한다.

## 어떻게 부르나

Blender 실행 파일의 위치를 환경 변수로 준다. 윈도우 설치 경로에 버전 번호가 들어가므로
코드가 짐작하지 않는다.

```bash
BLENDER='C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' \
  node --experimental-strip-types tools/blender/gate.ts 0a
```

**Git Bash 형식(`/c/Program Files/...`)으로 주면 안 된다.** 실행기는 Node에서 도는데 Node는 윈도우에서 그 형식을 풀지 못하므로, 파일이 있는데도 「BLENDER가 가리키는 파일이 없다」가 난다. 드라이브 문자와 역슬래시를 쓴 윈도우 경로를 그대로 준다.

PATH에 `blender`가 있으면 환경 변수를 생략해도 된다. 실행기가 내부적으로 돌리는 명령은 이렇다.

```bash
blender --background --python-exit-code 1 --python tools/blender/smoke.py -- --out <경로>
```

**`--python-exit-code`가 `--python`보다 앞에 온다.** Blender는 인자를 적힌 순서대로 처리하므로
뒤에 두면 스크립트가 이미 실행된 뒤에 설정돼 예외가 종료 코드에 실리지 않는다.

**게이트 0b·0c·2는 규격 값을 인자로 받는다.** 캔버스와 발·머리 행(`--width`·`--height`·`--foot-row`·`--head-row`)의 주인은 `tests/helpers/FrameSet.ts`의 `PLAYER_FRAME_SPEC`이고, 실행기가 거기서 넘긴다. 스크립트에는 기본값이 없어서 빠지면 `spec-args`로 실패한다. 값을 스크립트에도 적어 두면 한쪽만 고쳤을 때 굽기와 판정이 조용히 갈리기 때문이다.

**굽지 않고 이미 있는 산출물만 다시 잴 수 있다.** `--judge-only`를 붙이면 Blender를 부르지 않고 게이트 표의 출력 자리에 있는 파일을 판정한다. 게임 폴더에 프레임을 덮어 넣은 뒤 그 세트를 다시 재는 데 쓴다(아래 「출하 프레임 다시 굽기」).

```bash
node --experimental-strip-types tools/blender/gate.ts 2 --judge-only
```

## 종료 코드를 믿지 않는다

`blender --background --python`은 스크립트가 예외를 던져도 종료 코드 0을 낸다. 트레이스백은
Blender의 시작 로그에 섞여 흘러가므로, 종료 코드만 보면 실패한 실행과 성공한 실행이 구별되지
않는다. 그러면 하류 판정이 낡거나 없는 PNG를 읽고 아무 값이나 보고한다.

그래서 파이썬 쪽이 기계가 읽는 한 줄을 찍는다.

```
GATE_OK {"gate": "0a", "blender": "4.5.1", "engine": "BLENDER_EEVEE_NEXT", ...}
GATE_FAIL blender-version 기대 4.2~5.2, 지금 4.1.2
```

실행기는 그 줄을 **「마지막 줄」로 읽지 않는다.** Blender가 스크립트 뒤에 자기 종료 로그를 더
찍기 때문에, stdout에서 뒤에서부터 `GATE_` 줄을 찾는다. 그리고 **그런 줄이 하나도 없으면 종료
코드와 무관하게 실패로 접는다** — EEVEE가 컨텍스트를 못 잡아 Blender가 시그널로 죽으면
`--python-exit-code`도 `try/except`도 발화하지 않는데, 그 모양이 막으려는 조용한 실패와
정확히 같다.

**Blender가 멈추면 실행기가 끊는다.** EEVEE가 GPU 컨텍스트에서 멈추면 Blender는 죽지도 끝나지도
않으므로, 실행기가 20분을 기다린 뒤 끊고 그 사실을 말한다. 판정 줄이 없는 실패와 달리 끝나지 않은
것이므로, 같은 명령을 `--background` 없이 돌려 어디서 멈추는지 본다.

## 실패 코드

| 코드 | 무엇이 안 됐나 | 다음에 뭘 하나 | 찍는 곳 |
|---|---|---|---|
| `blender-version` | Blender 버전이 허용 범위 밖이다 | 메시지가 기대 범위와 실측 버전을 둘 다 담는다. 4.2~5.2 안의 판을 깐다 | `smoke.py` · `_common.py` |
| `eevee-missing` | 엔진 목록에 EEVEE 식별자가 없다 | 메시지의 실제 목록을 본다. 그 목록에 있는 이름을 `EEVEE_CANDIDATES`에 더한다 | `smoke.py` · `_common.py` |
| `output-path` | 출력 경로에 쓸 수 없다. 디렉터리를 못 만들거나, 출하 아트 아래거나, `--out`이 빠졌거나, 렌더 뒤 파일이 없거나, **이미 있는 프레임 파일을 덮으려 했다** | 메시지의 절대 경로를 본다. 출하 아트 아래로는 어떤 경우에도 쓰지 않는다. 프레임을 다시 굽는 중이면 아래 「출하 프레임 다시 굽기」를 따른다 | `smoke.py` · `_common.py` · `import_vrm.py` · `retarget_render.py` |
| `unexpected` | 위 어디에도 안 들어가는 파이썬 예외 | 메시지에 예외 타입과 원문이 담긴다. 같은 명령을 `--background` 없이 손으로 돌려 본다 | `smoke.py` · `_common.py` |
| `no-gate-line` | stdout에 판정 줄이 하나도 없다 | 실행기가 stderr 꼬리를 함께 찍는다. GPU·드라이버 쪽을 먼저 본다 | `gate.ts` |
| `bad-gate-payload` | `GATE_OK`의 JSON을 읽을 수 없거나 `GATE_FAIL`에 실패 코드가 없다 | 굽기는 끝났는데 보고가 깨진 것이다. 파이썬 쪽 `gate_ok`·`gate_fail` 호출을 본다 | `gate.ts` |
| `spec-args` | 규격 인자(`--width`·`--height`·`--foot-row`·`--head-row`)가 빠졌거나 정수가 아니다 | 실행기(`gate.ts`)를 거쳐 부른다. 손으로 부를 때는 `PLAYER_FRAME_SPEC`의 값을 그대로 준다 | `_common.py` |
| `vrm-addon-missing` | VRM 임포터 확장이 켜져 있지 않거나 `poll()`이 거부한다 | 확장을 켜고 다시 돌린다. `read_factory_settings`가 사용자 설치 확장을 떨어뜨리므로 스크립트가 초기화 뒤 다시 켠다 | `_common.py` |
| `vrm-path` | `.vrm` 경로가 없거나(`--vrm`이 빠진 경우 포함), 임포트가 실패했거나, 골격·메시가 없다 | VRoid에서 **VRM 1.0**으로 감축 없이 다시 내보낸다 | `_common.py` · `import_vrm.py` · `retarget_render.py` |
| `camera-framing` | 인물 높이가 0이거나, 발·머리 행을 하나만 줬거나, 두 행 사이로 키를 맞춘 배율에서 인물 폭이 여백 안에 안 들어온다 | 높이가 0이면 임포트가 메시를 실제로 들여왔는지 본다. 폭이 넘치면 메시지의 픽셀 폭을 보고 팔 자세(`BASE_ARM_POSE`)나 의상 폭을 줄인다 — 배율을 줄여 맞추면 인물이 출하 아트보다 작아진다 | `_common.py` |
| `motion-path` | 모션 파일이 없거나(`--motion`이 빠진 경우 포함), 형식을 모르거나, 아마추어가 없다 | glb·gltf·fbx만 받는다. 경로를 확인한다 | `retarget_render.py` |
| `motion-action` | 그 이름의 액션이 없거나, 길이가 0이거나, `--frames`가 1 이상의 정수가 아니다 | 메시지가 걷기로 보이는 액션 이름을 함께 준다. `--action`에 그것을 넘긴다 | `retarget_render.py` |
| `retarget-bone` | 대응표의 본을 한쪽 골격에서 못 찾았거나, `SWING_CHAIN`이 적은 부모가 모션 골격의 실제 부모와 다르다 | 못 찾았으면 메시지가 그쪽을 `모션:`·`대상:` 접두어로 말하니 `BONE_MAP`을 그 이름에 맞춘다. 부모가 다르면 메시지가 실제 부모 이름을 말하니 `SWING_CHAIN`을 그 이름에 맞춘다 | `retarget_render.py` |

**메시지에 실측값을 박는다.** 「버전이 맞지 않는다」가 아니라 「기대 4.2~5.2, 지금 4.1.2」로
적는다. 이 레포의 다른 도구가 이미 그 형태다 — `tools/art/Postprocess.ts`의 예외가 수치를 담고,
`.claude/typecheck.mjs`의 실패가 없는 파일 경로와 만드는 법과 지금 상태를 셋 다 찍는다.

## 파일 구성

대칭이 아니다. `smoke.py`만 독립이고 나머지는 공용 모듈을 쓴다.

| 파일 | 무엇 | 상태 |
|---|---|---|
| `smoke.py` | 게이트 0a. **독립이다** — VRM 애드온도 모델도 사용자의 시작 파일도 쓰지 않는다 | 있음 |
| `gate.ts` | 실행기. Blender를 부르고 판정 줄을 뽑고 구워진 PNG를 재서 한 줄로 찍는다. `--judge-only`면 굽지 않고 이미 있는 산출물만 잰다 | 있음 |
| `_common.py` | VRM 임포트 · 카메라 프레이밍 · 렌더 설정. **plumbing이 `smoke.py`와 두 벌인 것은 의도한 것이고** 이유는 그 파일 첫머리에 있다 | 있음 |
| `import_vrm.py` | 게이트 0b | 있음 |
| `retarget_render.py` | 게이트 0c와 2. 모션을 입히고 프레임을 굽는다. 본 대응표와 관절별 흔들림 비율(`SWING_SCALE`)을 든다 | 있음 |
| `ComparisonSheet.ts` | 게이트 1 비교 시트의 순수 로직 — 엔진식 축소 · 알파 합성 · 얼굴 가림 · 칸 배치. 명세는 `tests/logic/Blender3dGate.test.ts`에 있다 | 있음 |
| `sheet.ts` | 비교 시트 실행기. 3D 프레임 한 장과 출하된 2D 정면을 원본 · 1440p · 720p 세 줄로 붙인다 | 있음 |

**`smoke.py`가 독립인 것이 설계다.** 공용 모듈을 거치면 애드온이나 모델 때문에 난 실패가 환경
실패로 보고되고, 그러면 「여기서 막히면 VRoid를 설치하지 않는다」는 규칙이 조용히 깨진다. 되돌릴
비용이 가장 작은 지점을 지나친 채로 캐릭터 작업에 들어가게 된다.

## 출하 프레임 다시 굽기

게이트 2를 그대로 다시 돌리면 `output-path`로 멈춘다. 렌더 스크립트가 이미 있는 파일을 덮지 않기
때문이고, 이 거부는 일부러 둔 것이다. 편집 게이트 훅이 아트 PNG를 막지 않으므로, 덮어쓰기를
허용하면 게임에 실린 프레임이 바뀐 것을 아무도 모른 채 넘어갈 수 있다.

그래서 다시 구울 때는 스크래치에 먼저 굽고, 판정을 통과한 것만 게임 폴더에 넣는다.

1. `node --experimental-strip-types tools/blender/gate.ts 0c`로 `docs/temp/3d-gate/walk/`에 굽고
   판정을 통과시킨다. 이 게이트는 스크래치 폴더에 남은 옛 PNG를 알아서 치운다.
2. 통과한 PNG 여덟 장을 `game/assets/test-3d-gate/`의 같은 이름 파일 위에 **덮어쓴다.** 지우고 새로
   넣지 않는다. `.meta`가 uuid를 들고 있어서 함께 지워지면 `walk.anim`의 프레임 참조가 전부 끊기는데,
   Cocos가 켜진 채로 PNG를 지우면 Cocos가 그 `.meta`까지 지울 수 있다.
3. `node --experimental-strip-types tools/blender/gate.ts 2 --judge-only`로 게임 폴더의 세트를 다시
   판정한다. 덮어쓴 파일에는 판정 줄이 없으므로, 이 단계를 빼면 게임에 실린 세트는 아무도 재지 않는다.
4. 비교 시트에 쓰는 장(`walk_0006`)의 인물 크기나 위치가 바뀌었으면 `sheet.ts`의 얼굴 가림 사각형을
   다시 재고 `sheet.ts`로 시트를 다시 만든다. 가림막은 원본마다 손으로 잰 상수라, 안 고치면 얼굴이
   드러나거나 엉뚱한 자리를 가린 시트가 나온다.

Cocos가 꺼져 있어 `.meta`를 확실히 남길 수 있으면, 게임 폴더의 PNG만 지우고 `gate.ts 2`를 돌려도 된다.

## 산출물이 가는 곳

| 무엇 | 어디 | 추적 |
|---|---|---|
| 게이트 0a 스모크 PNG | `docs/temp/3d-gate/` | 안 함 — 스크립트로 다시 만들 수 있는 것만 둔다 |
| 걷기 프레임 | `game/assets/test-3d-gate/` | 함 |
| 게이트 1 비교 시트 | `art-source/player/2026-09-11-3d-gate/comparison-sheet.png` | 함 |
| `.vrm` 마스터와 판정 증거 | `art-source/player/2026-09-11-3d-gate/` | 함 |

`.vrm`은 커밋한다. 커밋하지 않으면 사슬의 출발점이 한 장비에만 남는다. 크기 상한은 50MB이고
넘으면 텍스처 해상도를 낮춘 판을 넣는다. `.blend`는 커밋하지 않는다 — 재현 단위는 `.vrm`과
이 폴더의 스크립트이고, 스크립트가 있으면 `.blend`는 파생물이다.
