# 물러난 Blender 도구 — G4가 끝나면 지운다

판정이 끝나 **생산 굽기에 쓰이지 않는 도구**를 모은 폴더다(2026-09-19 사용자 결정). 1라운드 게이트와, 2라운드 G2에서 후보를 굽고 비교 시트를 만들던 실행기들이 여기 있다. main에는 검증이 끝난 최종 흐름과 코드만 남기려는 것이고, 바로 지우지 않고 옮겨 둔 것은 G4가 생산 굽기 도구를 세울 때 아래 「G4가 가져갈 것」을 꺼내 쓰기 때문이다.

**지우는 조건.** G4(카메라 · 굽기 · 아틀라스)가 통과하고 「G4가 가져갈 것」을 생산 도구가 다 가져간 뒤에 이 폴더를 통째로 지운다. 지우기 전의 배치는 태그 `3d-gate-round2-g2-before-cleanup`에 남아 있다.

`tools/` 밖으로 내보내지 않은 이유가 있다. `tsconfig.tests.json`이 `tools/**/*.ts`를 타입체크하므로 이 자리에 있어야 지울 때까지 컴파일이 유지된다. 그물 밖에 두면 위 폴더의 모듈이 바뀌어도 아무도 모른 채 깨지고, 꺼내 쓰려 할 때 이미 돌지 않는다.

## 확정값은 여기 없다

이 도구들이 정한 값은 [`../BakeSpec.ts`](../BakeSpec.ts)로 옮겼고, 이 폴더의 도구도 그 파일에서 읽는다. 값을 고칠 일이 있으면 그 파일 한 곳만 고친다.

| 확정값 | `BakeSpec.ts`의 이름 | 정한 도구 |
|---|---|---|
| 채택한 지팡이 · 방패의 모양과 그립 | `STAFF_ORB` · `SHIELD_ROUND` · `writeChosenSpecs` | `weapons.ts` |
| 외곽선 — 인버티드 헐 1, 폭 0.0062m, 눈 · 얼굴 제외 | `CHOSEN_HULL` · `OUTLINE_WIDTH_M` · `hullMaterials` | `outline.ts` |
| 무기 재질 — 상의 규칙의 MToon | `WEAPON_TOON` | `outline.ts` |
| 장비 기본 재질, 천 · 금속이 덮는 값, 금속 matcap | `GEAR_TOON` · `CLOTH_TOON` · `METAL_TOON` · `metalMatcap` | `gear.ts` |
| 카메라 고도 15°, 마법진 지름 = 캐릭터 키 | `CHOSEN_PITCH` · `CIRCLE_DIAMETER_PER_HEIGHT` | `elevation.ts` |

크기(플레이어 80% · 몬스터는 `collisionRadius`의 직선)는 `mock.ts`가 정했지만 굽기 값이 아니라 게임 데이터라 `BakeSpec.ts`에 없다. G5가 `player.json` · `enemies.json`에 쓴다.

## 파일마다 무엇인가

| 파일 | 무엇을 만들었나 | 어느 판정의 근거였나 | 입력 |
|---|---|---|---|
| `gate-round1.ts` | 1라운드 게이트 0b(VRM 임포트) · 0c(걷기 리타게팅) · 2(테스트 씬 프레임). 실행기는 `../gate.ts`의 것을 쓰고 표만 든다 | 1라운드 전체(2026-09-11 ~ 09-14) | `cloud-storage/art/evidence/player/2026-09-11-3d-gate/`의 `.vrm` · 모션 팩 |
| `import_vrm.py` | 게이트 0b의 Blender 쪽. `gate-round1.ts`만 부른다 | 위와 같다 | 위와 같다 |
| `sheet.ts` | 1라운드 비교 시트(3D 걷기 한 장 대 출하 2D 정면) | 1라운드 게이트 1(화풍) | 위 폴더의 `cocos-test-scene/test-3d-gate/walk_0006.png` |
| `weapons.ts` | 지팡이 셋 · 방패 셋 후보 시트와 채택 컷. `--dump-chosen`은 채택한 둘의 사양 JSON만 쓴다 | G1 무기(2026-09-16) | 없음 — 모양이 코드에 있다 |
| `gear.ts` | 장비 검토 세트(망토 · 날개 · 화려한 장비 · 얇은 장식)의 시트 · 층 합성 수치 · 흔들림 재생 페이지. **`probe_layers.py`를 부르는 단 하나의 TS 길(`bake` · `bakeAsync` · `runPool`)이 이 파일에 있다** | G2 장비 검토 세트(2026-09-16 ~ 09-17) | 생산 `.vrm`(`cloud-storage/art/production/`) |
| `outline.ts` | 외곽선 후보(헐 1 · 2 · 3, Line Art 1 · 2, 후처리 1 · 2)의 방식별 시트 · 방향별 비교 시트 · 몸 헐 가림 탐침 수치 | G2 외곽선(2026-09-17) | 위와 같다 |
| `elevation.ts` | 카메라 고도 0 · 15 · 30 · 45° 후보와 발밑 마법진을 얹은 비교 시트, 고른 고도의 720p 낱장 | G2 고도(2026-09-17) | 생산 `.vrm`, 귀신 표본(`cloud-storage/art/evidence/enemies/`), 출하 2D 정면 |
| `mock.ts` | 720p 게임 화면 흉내(상의 A · B) | G2 크기 · 화풍 게이트(2026-09-17) | `elevation.ts`의 산출물, 귀신 표본, `enemies.json` |

의존은 한 방향이다: `mock.ts` → `elevation.ts` → `outline.ts` → `gear.ts`, 그리고 넷 모두 → `../BakeSpec.ts`. 그래서 넷은 함께 지운다.

판정에 쓴 그림은 `cloud-storage/art/evidence/`에 있고 구조는 [`cloud-storage/README.md`](../../../cloud-storage/README.md)가 든다. 옮긴 뒤에 `weapons.ts --dump-chosen` · `elevation.ts --sheet-only` · `mock.ts` · `sheet.ts`를 다시 돌려, 무기 · 헐 1 사양 JSON과 시트 · 흉내 여덟 장이 옮기기 전 것과 바이트까지 같은 것을 확인했다(2026-09-19).

## 아직 위 폴더에 남아 있는 후보 코드

파이썬 쪽은 옮길 수 없었다. `probe_layers.py`가 `outline`을 **모듈 이름으로 import하므로** `outline.py`를 이 폴더로 옮기면 생산 굽기가 `ModuleNotFoundError`로 죽는다. 그래서 아래 셋은 자리에 두고 G4에서 함께 지운다.

| 어디 | 무엇 | 왜 후보 전용인가 |
|---|---|---|
| `../outline.py` 전체 | Line Art 오브젝트 세우기, 후처리용 법선 · 깊이 패스 굽기 | 두 방식 모두 탈락했다. 채택한 헐은 툰 사양이 켠다 |
| `../probe_layers.py`의 `--lineart` · `--passes` | 위 파일을 부르는 인자 | 위와 같다 |
| `gear.ts`의 `hardEdge` · `TOON_HARD` | 경계를 딱딱하게 한 판을 망토 · 날개에 더 굽는다 | 몸 음영은 VRoid 원본으로 확정했고, 이 판으로 내린 결정이 없다 |

## G4가 가져갈 것

이 폴더를 지우기 전에 생산 도구가 가져가야 하는 것이다. 값은 이미 `BakeSpec.ts`에 있으므로 여기 적는 것은 **길**이다.

- `gear.ts`의 `bakeArgs` · `bake` · `bakeAsync` · `runPool` — `probe_layers.py`에 인자를 넘기고, 판정 줄을 읽고, 넷씩 동시에 굽는 길. 한 장 11초 중 렌더는 2~3초뿐이라 동시에 굽지 않으면 CPU와 GPU가 논다.
- `elevation.ts`가 판정 줄에서 읽는 `ground_px` — 고도가 있으면 발밑 점이 발 행 규격(489행)에서 올라가(15°에서 485.1행) 계산으로는 못 잡는다. G4가 발 · 머리 행 규격을 15°로 다시 잡을 때 필요하다.
- `elevation.ts`의 `checkCellHeight` — 굽기 캔버스와 표시 배율이 어긋난 사고(3D 칸이 세로 1.46배로 판정에 올라감)를 막는 검사. 같은 검사를 생산 굽기 뒤에 둔다.

## 1라운드 프레임 다시 굽기

게이트 2를 그대로 다시 돌리면 `output-path`로 멈춘다. 렌더 스크립트가 이미 있는 파일을 덮지 않기 때문이고, 이 거부는 일부러 둔 것이다. 편집 게이트 훅이 아트 PNG를 막지 않으므로, 덮어쓰기를 허용하면 게임에 실린 프레임이 바뀐 것을 아무도 모른 채 넘어갈 수 있다.

1라운드 프레임을 다시 구울 일은 이제 없다. 절차를 남겨 두는 것은 **G4의 생산 굽기가 같은 규칙을 이어받기 때문이다** — 스크래치에 먼저 굽고, 판정을 통과한 것만 게임 폴더에 넣는다.

1. `node --experimental-strip-types tools/blender/retired/gate-round1.ts 0c`로 `docs/temp/3d-gate/walk/`에 굽고 판정을 통과시킨다. 이 게이트는 스크래치 폴더에 남은 옛 PNG를 알아서 치운다.
2. 통과한 PNG를 대상 폴더의 같은 이름 파일 위에 **덮어쓴다.** 지우고 새로 넣지 않는다. 게임 폴더라면 `.meta`가 uuid를 들고 있어서 함께 지워지면 클립의 프레임 참조가 전부 끊기는데, Cocos가 켜진 채로 PNG를 지우면 Cocos가 그 `.meta`까지 지울 수 있다.
3. `gate-round1.ts 2 --judge-only`로 대상 폴더의 세트를 다시 판정한다. 덮어쓴 파일에는 판정 줄이 없으므로, 이 단계를 빼면 그 세트는 아무도 재지 않는다.
4. 비교 시트에 쓰는 장(`walk_0006`)의 인물 크기나 위치가 바뀌었으면 `sheet.ts`의 얼굴 가림 사각형을 다시 재고 시트를 다시 만든다. 가림막은 원본마다 손으로 잰 상수라, 안 고치면 얼굴이 드러나거나 엉뚱한 자리를 가린 시트가 나온다.
