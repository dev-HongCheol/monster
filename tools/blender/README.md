# Blender 게이트 — 실행 계약

3D 마스터에서 플레이어의 층별 프레임을 굽고, 구운 결과를 판정하는 도구다. 계획 개요는
[`2026-09-11-blender-3d-gate-plan.md`](../../docs/development/sessions/2026-09-11-blender-3d-gate-plan.md)이고
게이트별 판정 기준과 결과는 [`blender-3d-gate-test.md`](../../docs/qa/blender-3d-gate-test.md)가 든다.

**판정은 파이썬에 없다.** Blender 쪽은 굽기만 하고 재는 것은 전부 TypeScript다. `tools/**/*.ts`는
타입체크·lint·vitest 셋을 다 지나가지만 `.py`는 어느 그물에도 안 걸리기 때문이고, 그래서 판정이
Blender 버전을 타지 않는다.

**이 폴더에는 생산 굽기에 쓰는 것만 둔다(2026-09-19).** 1라운드 게이트와 G2에서 후보를 굽고 비교 시트를 만들던
실행기는 판정이 끝나 [`retired/`](retired/README.md)로 물러났고 G4가 끝나면 지운다. 그 실행기들이 정한 값은
`BakeSpec.ts`에 있다.

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

**규격 캔버스에 굽는 게이트는 규격 값을 인자로 받는다.** 지금은 1라운드 게이트 0b·0c·2(`retired/gate-round1.ts`)가 그렇다. 0b는 캔버스(`--width`·`--height`)를, 0c·2는 캔버스와 발·머리 행(`--foot-row`·`--head-row`)을 받는다. 값의 주인은 `tests/helpers/FrameSet.ts`의 `PLAYER_FRAME_SPEC`이고, 실행기가 거기서 넘긴다. 스크립트에는 기본값이 없어서 빠지면 `spec-args`로 실패한다. 값을 스크립트에도 적어 두면 한쪽만 고쳤을 때 게이트가 크기·위치 결함으로 떨어져, 원인이 두 벌의 불일치라는 것이 드러나지 않기 때문이다.

**굽지 않고 이미 있는 산출물만 다시 잴 수 있다.** `--judge-only`를 붙이면 Blender를 부르지 않고 게이트 표의 출력 자리에 있는 파일을 판정한다. 프레임을 대상 폴더에 덮어 넣은 뒤 그 세트를 다시 재는 데 쓴다(`retired/README.md` 「1라운드 프레임 다시 굽기」).

```bash
node --experimental-strip-types tools/blender/retired/gate-round1.ts 2 --judge-only
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
않으므로, 실행기가 20분을 기다린 뒤 끊고 그 사실을 말한다. 끊기 전까지 찍힌 stdout·stderr의 꼬리를
함께 보여 주므로 임포트·굽기·렌더 중 어디서 멈췄는지를 먼저 거기서 보고, 그걸로 모자라면 같은 명령을
`--background` 없이 돌린다.

## 실패 코드

| 코드 | 무엇이 안 됐나 | 다음에 뭘 하나 | 찍는 곳 |
|---|---|---|---|
| `blender-version` | Blender 버전이 허용 범위 밖이다 | 메시지가 기대 범위와 실측 버전을 둘 다 담는다. 4.2~5.2 안의 판을 깐다 | `smoke.py` · `_common.py` |
| `eevee-missing` | 엔진 목록에 EEVEE 식별자가 없다 | 메시지의 실제 목록을 본다. 그 목록에 있는 이름을 `EEVEE_CANDIDATES`에 더한다 | `smoke.py` · `_common.py` |
| `output-path` | 출력 경로에 쓸 수 없다. 디렉터리를 못 만들거나, 출하 아트 아래거나, `--out`이 빠졌거나, 렌더 뒤 파일이 없거나, **이미 있는 프레임 파일을 덮으려 했다** | `--out`이 빠졌으면 실행기(`gate.ts`)를 거쳐 부른다. 그 밖에는 메시지의 절대 경로를 본다. 출하 아트 아래로는 어떤 경우에도 쓰지 않는다. 프레임을 다시 굽는 중이면 `retired/README.md` 「1라운드 프레임 다시 굽기」를 따른다 | `smoke.py` · `_common.py` · `retired/import_vrm.py` · `retarget_render.py` |
| `unexpected` | 위 어디에도 안 들어가는 파이썬 예외 | 메시지에 예외 타입과 원문이 담긴다. 같은 명령을 `--background` 없이 손으로 돌려 본다 | `smoke.py` · `_common.py` |
| `no-gate-line` | stdout에 판정 줄이 하나도 없다 | 실행기가 stderr 꼬리를 함께 찍는다. GPU·드라이버 쪽을 먼저 본다 | `gate.ts` |
| `bad-gate-payload` | `GATE_OK`의 JSON을 읽을 수 없거나 `GATE_FAIL`에 실패 코드가 없다 | 굽기는 끝났는데 보고가 깨진 것이다. 파이썬 쪽 `gate_ok`·`gate_fail` 호출을 본다 | `gate.ts` |
| `spec-args` | 규격 인자(`--width`·`--height`·`--foot-row`·`--head-row`)가 빠졌거나 정수가 아니다 | 실행기(`gate.ts`)를 거쳐 부른다. 손으로 부를 때는 `PLAYER_FRAME_SPEC`의 값을 그대로 준다 | `_common.py` |
| `vrm-addon-missing` | VRM 임포터 확장이 켜져 있지 않거나 `poll()`이 거부한다 | 확장을 켜고 다시 돌린다. `read_factory_settings`가 사용자 설치 확장을 떨어뜨리므로 스크립트가 초기화 뒤 다시 켠다 | `_common.py` |
| `vrm-path` | `.vrm` 경로가 없거나(`--vrm`이 빠진 경우 포함), 임포트가 실패했거나, 골격·메시가 없다 | `--vrm`이 빠졌으면 실행기(`gate.ts`)를 거쳐 부른다. 파일이 있는데 임포트가 실패하거나 골격·메시가 없으면 VRoid에서 **VRM 1.0**으로 감축 없이 다시 내보낸다 | `_common.py` · `retired/import_vrm.py` · `retarget_render.py` · `bake_motion.py` |
| `camera-framing` | 인물 높이가 0이거나, 발·머리 행을 하나만 줬거나, 두 행 사이로 키를 맞춘 배율에서 인물 폭이 여백 안에 안 들어온다 | 높이가 0이면 임포트가 메시를 실제로 들여왔는지 본다. 폭이 넘치면 메시지의 픽셀 폭을 보고 팔 자세(`BASE_ARM_POSE`)나 의상 폭을 줄인다 — 배율을 줄여 맞추면 인물이 출하 아트보다 작아진다. 층 캔버스의 홀짝이 기준과 다른 경우도 여기로 온다 | `_common.py` · `probe_layers.py` · `bake_motion.py` |
| `camera-record` | `--camera`가 가리키는 기록이 없거나, 고도 · 겨냥 높이 · 픽셀 크기 가운데 빠진 값이 있다 | 기록은 손으로 쓰지 않는다. `bake.ts camera`로 `camera.json`을 다시 만들고 실행기를 거쳐 부른다 | `_common.py` · `bake_motion.py` |
| `camera-stale` | 카메라를 잡을 때의 Blender나 VRM 애드온 판이 지금 도는 판과 다르다 | 도구를 올린 것이 의도라면 `bake.ts camera`로 카메라를 다시 잡고 **모든 층을 다시 굽는다** — 일부 층만 다시 구우면 새 층이 옛 층과 임포트 결과나 음영이 달라도 드러나지 않는다. 의도가 아니면 QA 문서 §3의 판으로 되돌린다 | `_common.py` |
| `motion-path` | 모션 파일이 없거나(`--motion`이 빠진 경우 포함), 형식을 모르거나, 아마추어가 없다. 동작 굽기에서는 키프레임 정의 JSON(`--frames`)이 없는 경우다 | glb·gltf·fbx만 받는다. 경로를 확인한다. 키프레임 정의는 손으로 쓰지 않고 `MotionSpec.ts`의 값을 JSON으로 써서 넘긴다(`retired/motion.ts`의 `bake`가 그 길이다) | `retarget_render.py` · `bake_motion.py` |
| `motion-action` | 그 이름의 액션이 없거나, 길이가 0이거나, `--frames`가 1 이상의 정수가 아니다 | 액션이 없으면 메시지가 걷기로 보이는 액션 이름을 함께 주니 `--action`에 그것을 넘긴다. `--frames` 오류면 1 이상의 정수를 준다. 동작 굽기에서는 키프레임 정의에 프레임이 하나도 없는 경우다 | `retarget_render.py` · `bake_motion.py` |
| `retarget-bone` | 대응표의 본을 한쪽 골격에서 못 찾았거나, `SWING_CHAIN`이 적은 부모가 모션 골격의 실제 부모와 다르다 | 못 찾았으면 메시지가 그쪽을 `모션:`·`대상:` 접두어로 말하니 `BONE_MAP`을 그 이름에 맞춘다. 부모가 다르면 메시지가 실제 부모 이름을 말하니 `SWING_CHAIN`을 그 이름에 맞춘다. 동작 굽기에서는 키프레임 정의가 쓰는 본(`J_Bip_*`)이 이 골격에 없는 경우다 | `retarget_render.py` · `bake_motion.py` |
| `weapon-spec` | 무기 후보 표가 없거나, 후보가 0개거나, 부품이 없거나, 모르는 부품 종류·시점·재질 묶음이다. 층 탐침에서는 layer 값이 틀렸거나, `gear` 층에 `--gear-spec`이 없거나, 장비 사양에 `bone`이 없는 경우도 여기로 온다 | 채택한 무기 사양은 `BakeSpec.ts`의 `writeChosenSpecs`가, 후보 표와 장비 사양은 `retired/weapons.ts`·`retired/gear.ts`가 만드므로 그쪽을 거쳐 부른다. 부품 종류를 늘리려면 `weapons.py`의 `build_part`에 분기를 더한다. 동작 굽기에서는 `gear` 층에 `--gear-spec`이 없거나 그 파일이 없거나 장비 조각에 `bone`이 없는 경우다 | `weapons.py` · `probe_layers.py` · `bake_motion.py` |
| `toon-spec` | 툰 사양에 모르는 키가 있거나, `shade_threshold`가 0~1 밖이거나, `like`가 지목한 VRoid 부위가 장면에 없다 | 메시지가 아는 키·있는 부위를 함께 준다. 값이 그림에서 무엇을 하는지는 `docs/development/spec/ops-blender-toon.md`에 있다 — 명세 이름(`shading_shift`)을 받지 않는 이유도 거기 있다 | `toon.py` |
| `mtoon-inspect` | `.vrm`에 MToon 노드 그룹이 없다 | MToon 머티리얼로 내보낸 판인지 확인한다 | `inspect_mtoon.py` |
| `lineart` | Line Art 오브젝트를 만들었는데 모디파이어나 재질이 없다 | Blender 판이 바뀌어 `grease_pencil_add(type='LINEART_SCENE')`의 산출이 달라진 것이다. 5.2에서는 모디파이어 `type`이 `LINEART`, 재질이 `Black` 하나다 | `outline.py` |

**메시지에 실측값을 박는다.** 「버전이 맞지 않는다」가 아니라 「기대 4.2~5.2, 지금 4.1.2」로
적는다. 이 레포의 다른 도구가 이미 그 형태다 — `tools/art/Postprocess.ts`의 예외가 수치를 담고,
`.claude/typecheck.mjs`의 실패가 없는 파일 경로와 만드는 법과 지금 상태를 셋 다 찍는다.

## 파일 구성

대칭이 아니다. `smoke.py`만 독립이고 나머지는 공용 모듈을 쓴다.

| 파일 | 무엇 | 상태 |
|---|---|---|
| `smoke.py` | 게이트 0a. **독립이다** — VRM 애드온도 모델도 사용자의 시작 파일도 쓰지 않는다 | 있음 |
| `gate.ts` | 실행기. Blender를 부르고 판정 줄을 뽑고 구워진 PNG를 재서 한 줄로 찍는다. `--judge-only`면 굽지 않고 이미 있는 산출물만 잰다. 게이트 표를 밖에서 받으므로(`main`) 이 파일의 표에는 0a만 있고 1라운드 게이트는 `retired/gate-round1.ts`가 자기 표로 부른다 | 있음 |
| `BakeSpec.ts` | **G2가 확정한 굽기 값** — 채택한 지팡이 · 방패의 모양과 그립(`writeChosenSpecs`가 JSON으로 쓴다), 외곽선 헐 1(`CHOSEN_HULL` · `hullMaterials`), 무기 · 장비 · 천 · 금속의 툰 값과 금속 matcap, 카메라 고도 15°와 마법진 지름. 물러난 실행기도 여기서 읽어 값의 주인이 하나다 | 있음 |
| `_common.py` | VRM 임포트 · 카메라 프레이밍 · 렌더 설정. **plumbing이 `smoke.py`와 두 벌인 것은 의도한 것이고** 이유는 그 파일 첫머리에 있다 | 있음 |
| `retarget_render.py` | 1라운드 게이트 0c와 2(`retired/gate-round1.ts`). 모션을 입히고 프레임을 굽는다. 본 대응표와 관절별 흔들림 비율(`SWING_SCALE`)을 든다. **기준 자세(`BASE_ARM_POSE`)의 주인이라** 층 탐침과 무기 자리 측정이 import한다 — 모션 리타게팅은 2라운드가 스크립트 키프레임으로 바꾸지만(G3) 이 값 때문에 물러나지 않았다 | 있음 |
| `ComparisonSheet.ts` | 비교 시트의 순수 로직 — 엔진식 축소 · 알파 합성 · 얼굴 가림 · 칸 배치, 그리고 층 겹치기 · 가림 부분집합 · 픽셀 차이. 명세는 `tests/logic/Blender3dGate.test.ts`에 있다 | 있음 |
| `Atlas.ts` | 층별 프레임을 트림해 한 장에 담는 순수 로직 — 이름 규칙과 되가르기 · 선반 패킹 · plist 직렬화와 파싱 · 왕복 복원 · 들어간 plist 검사 둘(원본 크기 · 층별 프레임 수). 명세는 `tests/logic/Blender3dGate.test.ts`에 있다 | 있음 |
| `weapons.py` | 지팡이 · 방패 · 장비 부품을 프리미티브로 세운다. 모양의 정의는 받는 JSON에 있고(채택한 무기는 `BakeSpec.ts`) 이 파일은 세우기만 한다. 몸 표면 투영(`Surface`)도 여기 있어 끈 · 판 · 뿔을 몸 메시에 붙인다 | 있음 |
| `probe_layers.py` | G2 층 탐침. 층 하나(몸 · 상의 · 무기 · 장비)를 가림 전용 몸과 함께 굽거나, 가림 없이 한 번에 구운 기준 컷(`whole`)을 굽는다. `--toon`으로 툰 사양을 입히고, `--pitch`로 카메라 고도를 준다. `--lineart` · `--passes`는 탈락한 외곽선 후보(Line Art · 후처리용 패스)용이라 G4에서 지운다. TS에서 이 스크립트를 부르는 길은 아직 `retired/gear.ts`의 `bake`뿐이고 G4가 생산 도구로 가져간다 | 있음 |
| `toon.py` | 툰 사양 JSON을 MToon 머티리얼에 입힌다. 무기 · 장비 부품은 사양이 그 분류를 적었을 때만 MToon으로 바꾼다 | 있음 |
| `inspect_mtoon.py` | `.vrm`의 MToon 값을 덤프하고, 애드온 셰이더가 명세 식과 옛 식 중 어느 쪽을 음영 혼합에 물렸는지 보고한다. 애드온 · Blender 판을 바꾼 뒤 먼저 돌린다 | 있음 |
| `layers.ts` | 층 PNG 실행기 — 가림 부분집합 판정(`subset`), 층 겹치기와 720p 축소(`stack`), 기준 컷과의 차이(`diff`). 규칙은 `ComparisonSheet.ts`가 든다 | 있음 |
| `outline.py` | 탈락한 외곽선 후보의 Blender 쪽 조각. Line Art(Grease Pencil) 오브젝트를 세우고, 후처리용 법선 · 깊이 패스를 재질을 갈아 끼워 한 장씩 굽는다. 채택한 인버티드 헐은 이 파일이 아니라 툰 사양이 켠다. `probe_layers.py`가 모듈 이름으로 import해서 `retired/`로 옮기지 못했고 G4에서 그 인자와 함께 지운다 | 있음 |
| `bake_layer.py` | G4 층 굽기. 층 캔버스(`--layer-width` · `--layer-height`)를 기준 몸 규격과 달리 주더라도 카메라는 기준 규격으로만 계산해 캐릭터 크기를 같게 둔다 — 캔버스를 키우면 캐릭터가 커지는 것이 아니라 주변이 더 보일 뿐이고, 모든 층의 캔버스 중심이 같은 월드 점에 놓인다. ADR 009의 실증에 썼다 | 있음 |
| `inspect_meshes.py` | G1 메시 · 머티리얼 · 정점 지문 덤프. 판끼리 몸이 같은지 보려고 메시마다 정점 수와 좌표 지문(소수점 다섯 자리로 반올림한 뒤 sha256), 머티리얼별 정점 좌표를 적어 낸다. 판정은 하지 않는다 — 덤프를 견주는 것은 `match.ts`다 | 있음 |
| `ModelMatch.ts` | **두 판이 같은 몸인지 가르는 순수 로직.** 코어 본(`J_Bip_`)이 같은가, 얼굴 · 머리카락의 좌표 지문이 같은가, 옷을 더 입은 판의 맨살 좌표가 덜 입은 판의 부분집합인가를 본다. 정점 수는 견주지 않는다 — VRoid가 옷 아래의 살을 지운 채 내보내 판마다 다른 것이 정상이다. 명세는 `tests/logic/Blender3dGate.test.ts`에 있다 | 있음 |
| `match.ts` | 판 일치 비교 실행기. `--less <덜 입은 판>` · `--more <더 입은 판>` 두 `.vrm`을 `inspect_meshes.py`로 덤프하고 `ModelMatch.ts`로 판정한다. 같은 몸이 아니면 종료 코드 1이다. 옷 판을 더하거나 옷을 전부 끈 판을 들여올 때 굽기 전에 돌린다 | 있음 |
| `MotionSpec.ts` | **G3가 확정한 동작** — 걷기 · 대기의 키프레임 정의. 모션 파일을 옮기지 않고 위상(0~1)에서 관절 각도 · 허리 높이 · 접지를 식으로 낸다. 다리를 앞뒤 평면에서만 돌리므로 1라운드의 좌우 흔들림이 식에 없고, 발끝을 드는 각은 5°에서 막는다. 채택한 걷기(`CHOSEN_GAIT`) · 대기(`IDLE_BAKED` · `IDLE_PLAYBACK`) · 걷기 8장 · 10fps · 좌우 75°(`CHOSEN_MOTION`)와 다리 치수(`PLAYER_LEG_RIG`)를 든다. 명세는 `tests/logic/Blender3dGate.test.ts`에 있다 | 있음 |
| `bake_motion.py` | 동작 굽기(G3)이자 **G4의 층 굽기.** `MotionSpec.ts`가 낸 프레임별 각도를 그대로 입혀 **한 프로세스에서 여러 장**을 굽고, 본 위치와 변형된 발바닥 높이를 모델 좌표로 돌려준다. 자세 계산은 하지 않는다. 팔은 프레임마다 `BASE_ARM_POSE`로 다시 입히고 무기는 손 위치로 다시 놓는다. `--layer`(`body` · `top` · `staff` · `shield` · `whole`)로 층을 고르면 몸이 아닌 층은 맨살 몸을 가림 전용으로 두고 굽고, `--camera <json>`을 주면 몸 상자를 재지 않고 기록된 카메라를 그대로 쓴다. 두 인자를 안 주면 G3 때의 동작 그대로다. 슬롯 범위 탐침(G4 §12)용으로 둘을 더 받는다 — `--gear-spec <json>`은 장비를 사양의 `bone`에 붙여 `gear` 층(맨살 몸으로 가림)이나 `whole`에 굽는데, 무기와 달리 **붙은 본을 회전까지 따라간다**(부츠는 정강이가 굽으면 함께 기운다). 사양은 조각 하나이거나 `pieces` 여럿이다. `--keep-material <말>`은 `top` 층이 남기는 머티리얼을 바꿔(기본 `Tops`) 하의(`Bottoms`) · 신발(`Shoes`)을 같은 길로 층으로 굽는다 | 있음 |
| `BlenderRun.ts` | Blender를 띄워 굽기 스크립트 하나를 돌리고 판정 줄의 값을 돌려준다(`runBlender`). 여러 굽기를 동시에 돌리는 풀(`runPool`)도 든다. `retired/gear.ts`의 `bakeAsync`가 `probe_layers.py`에 묶여 있어서 부르는 부분만 일반형으로 뗐다. 생산 굽기 실행기(`bake.ts`)와 물러난 G3 실행기(`retired/motion.ts`)가 쓴다 | 있음 |
| `LayerBake.ts` | **G4 생산 굽기의 순수 로직** — 층 다섯 × 방향 넷의 굽기 일감과 프레임 이름, 고도가 있는 직교 카메라에서 점이 놓이는 행(`projectRow`), 맨살 몸 합집합의 머리 · 발 행에서 카메라를 맞추는 식(`fitCamera`), 몸 층 캔버스 가로(`bodyCanvasWidth`), 층마다 굽는 캔버스와 출처(`layerCanvas` · `layerSource`), 상의 · 무기 층의 세트 검사(`layerSetCheck`), 생산 굽기의 툰 사양(`bakeToon`), 카메라를 잡은 입력의 지문과 「낡음」 판정(`bakeDefinition` · `definitionHash` · `staleReasons`). 층끼리의 가림을 재는 것도 여기 있다 — 기준 컷의 일감(`referenceBakeJobs`), 캔버스가 다른 층을 중심을 맞춰 같은 캔버스로 옮기기(`centerOnCanvas`), 두 층의 내용이 겹치는 픽셀 수(`alphaOverlap`), 층을 겹친 그림과 기준 컷의 차이를 구멍과 층별 「앞에 잘못 보인 픽셀」로 갈라 세기(`stackVerdict` — 맨 위 층을 걷어내면 기준 컷과 맞는 자리만 앞뒤의 오류로 센다), 그 측정으로 채택한 방향별 겹치는 순서(`STACK_ORDER` · `stackOrder` — 뒷모습만 무기가 상의 아래다), 구운 폴더가 어느 입력으로 구워졌는지의 도장(`bakeStamp`), 구운 프레임을 층 × 동작 단위로 묶는 표(`atlasGroups`), 장비가 붙은 본을 회전까지 따라갔는지의 판정(`gearFollow`). 명세는 `tests/logic/Blender3dGate.test.ts`에 있다 | 있음 |
| `bake.ts` | G4 생산 굽기 실행기. `camera` 명령이 맨살 몸을 네 배 캔버스로 구워 합집합을 재고, 카메라를 맞춰 몸 층 캔버스로 다시 구워 확인한 뒤 `camera.json`을 쓴다. `layers` 명령은 다섯 층을 네 방향으로 굽고 층별 판정을 건다 — 몸은 세트 검사와 합집합 머리 · 발 행, 상의 · 무기는 `LayerBake.ts`의 `layerSetCheck`, 모든 층은 발밑 점이 기록된 카메라의 자리에 있는지다. 카메라를 잡은 뒤에 입력이 바뀌었으면 굽지 않는다. `preview` 명령은 굽지 않고, 구운 층을 겹쳐 재생하는 화면을 `docs/temp/3d-gate/g4/preview.html`에 쓴다. 층끼리의 가림은 세 명령이 잰다 — `overlap`이 구운 층끼리 내용이 겹치는 픽셀 수를 방향 · 짝마다 재고, `reference`가 상의 A · B를 입은 판에 무기 둘을 들려 가림 없이 한 장으로 구운 기준 컷을 층과 같은 자세 · 카메라로 굽고, `compare`가 층을 게임의 형제 순서(방향별 — `STACK_ORDER`)로 겹친 그림을 기준 컷과 견줘 구멍과 앞에 잘못 보인 픽셀을 센다(`--same-order`면 모든 방향을 정면의 순서로). 굽는 명령은 구운 폴더마다 입력의 도장(`stamp.json`)을 찍고, 재는 명령은 층과 기준 컷의 도장이 지금 입력의 것이 아니면 재지 않는다. `atlas` 명령은 굽지 않고, 구운 층을 층 × 동작 열 묶음으로 아틀라스(PNG + plist)에 담아 `docs/temp/3d-gate/g4/atlas/`에 쓴 뒤 원본 크기 · 프레임 수 · 왕복을 검사하고 바이트를 찍는다. `--install`을 주면 검사를 통과한 것을 `game/assets/art/player/layers/`에 넣는데, PNG와 plist만 쓰고 `.meta`는 읽지도 만들지도 지우지도 않는다(다시 구워 넣어도 Cocos가 매긴 UUID와 씬 참조가 남는다). `--padding 8`은 밉맵을 켜는 판의 여백이다. `check-atlas` 명령은 게임 폴더에 들어간 plist를 읽어 원본 크기 · 층별 프레임 수 · 빠진 프레임 · PNG 크기를 검사한다. 생산 `.vrm`의 자리는 `--model-dir`로 받는다 | 있음 |
| `layers_preview.html` | 층 합성 화면의 템플릿. 다섯 층을 게임의 형제 순서(방향별 — 실행기가 `STACK_ORDER`를 넣는다. 「방향별 순서」를 끄면 모든 방향이 정면의 순서)로 캔버스 중심을 맞춰 겹치고, 네 방향을 나란히 재생한다. 상의 A · B와 무기를 켜고 끌 수 있고, 720p · 1440p 게임 크기로 볼 수 있고, 발밑 점을 표시하며, 맨 끝 칸이 제자리에서 돌아선다. 기준 컷이 구워져 있으면 층 합성 대신 기준 컷을 같은 자리에 그려(R 키) 두 그림을 번갈아 볼 수 있다. 규격값은 템플릿에 없고 `bake.ts preview`가 카메라 기록에서 박아 넣는다 | 있음 |
| `camera.json` | **기록된 카메라** — 고도 · 겨냥 높이 · 픽셀 크기, 몸 층 캔버스, 발밑 점의 행, 그리고 카메라를 잡을 때의 입력 지문(굽기 정의 · 모델 판 셋 · Blender와 VRM 애드온의 판). 손으로 고치지 않고 `bake.ts camera`로 다시 쓴다. 모든 층이 이 카메라 하나로 구워졌다는 근거라 커밋한다 | 있음 |
| `measure_weapon_room.py` | G1 무기 자리 측정. 기준 자세(`retarget_render.BASE_ARM_POSE`)를 입힌 몸의 세계 좌표 상자와 두 손의 세계 좌표를 덤프한다. A 포즈로 재면 손이 게임에 안 나오는 자리에 있으므로 굽기와 같은 자세로 잰다. 남는 자리를 픽셀로 환산하는 것은 실행기 몫이다 | 있음 |

**`smoke.py`가 독립인 것이 설계다.** 공용 모듈을 거치면 애드온이나 모델 때문에 난 실패가 환경
실패로 보고되고, 그러면 「여기서 막히면 VRoid를 설치하지 않는다」는 규칙이 조용히 깨진다. 되돌릴
비용이 가장 작은 지점을 지나친 채로 캐릭터 작업에 들어가게 된다.

## 산출물이 가는 곳

| 무엇 | 어디 | 추적 |
|---|---|---|
| 게이트 0a 스모크 PNG, 층 탐침과 물러난 실행기들의 산출물 | `docs/temp/3d-gate/<도구>/` | 안 함 — 도구로 다시 만들 수 있는 것만 둔다. **스크립트는 여기 두지 않는다** — 이 폴더는 추적되지 않아 여기 둔 스크립트는 장비 하나에만 남는다 |
| 생산 `.vrm` 셋과 VRoid 원본 | `cloud-storage/art/production/player/2026-09-16-player-3d/` | 안 함 — 레포가 공개라 올리지 않는다. 드라이브에 둔다 |
| 판정에 쓴 시트 · 흉내, 귀신 표본 원본, 1라운드 `.vrm` · 모션 팩 · 테스트 씬 | `cloud-storage/art/evidence/` | 안 함 — 시험 자료는 레포가 아니라 드라이브에 둔다(2026-09-19 사용자 결정) |
| 층별 아틀라스(PNG + plist 열 쌍) | `game/assets/art/player/layers/` | **한다** — 게임이 싣는 출하물이다. `bake.ts atlas --install`이 넣고, `.meta`는 Cocos가 만든 것을 `PR 승인` 때 커밋한다 |

`cloud-storage/`의 구조와 파일마다 무엇인지는 [`cloud-storage/README.md`](../../cloud-storage/README.md)가 든다. 그 폴더는 README 하나만
추적하므로 클론만 해서는 비어 있고, 다른 장비에서는 드라이브에서 받아 같은 경로에 풀어야 도구가 입력을 찾는다.

`.vrm`도 `.blend`도 커밋하지 않는다. 생산 `.vrm`은 공개 레포에 올리면 누구나 내려받을 수 있고 한 번 푸시한
파일은 되돌릴 수 없어서 드라이브에 둔다. `.blend`는 재현 단위가 `.vrm`과 이 폴더의 스크립트라, 스크립트가
있으면 파생물이다. 층별 아틀라스는 게임 폴더에 들어가 있고 추적한다(위 표) — 원본이 아니라 `.vrm`과 굽기 정의에서 다시 나오는 출하물이다.
