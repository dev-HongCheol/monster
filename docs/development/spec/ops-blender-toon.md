# Blender 툰 렌더

> Blender에서 VRM 툰 셰이더가 실제로 어떻게 칠하고, 그 근거 자료는 어디 있나

- **최초 작성:** 2026-09-16
- **상태:** CONFIRMED
- **이력:** 2026-09-16 — 신설

---

이 문서는 **정본**이다. 내용이 낡으면 새로 만들지 않고 이 문서를 고친다. 이력 절에는
날짜와 무엇이 바뀌었는지만 한 줄 남기고, 그렇게 정한 경위는 그 슬라이스의 세션 문서가 든다.

## 1. 이 문서가 드는 것과 들지 않는 것

플레이어 3D 마스터는 VRoid가 내보낸 `.vrm`을 VRM Add-on for Blender로 들여와 EEVEE로 굽는다. 그때 머티리얼은 VRM 표준 툰 셰이더인 MToon을 애드온이 Blender 노드로 옮긴 것이다. 이 문서는 **그 셰이더가 실제로 무슨 식으로 칠하는지**와 **그것을 확인할 근거 자료가 어디 있는지**를 든다.

툰 값을 고르기 전에 이 문서가 필요한 이유는, 애드온의 실제 식이 공개 명세의 식과 달라서 명세만 읽고 값을 넣으면 효과가 없는 값을 후보로 굽게 되기 때문이다(§4).

인접한 것은 다른 곳이 소유하므로 여기서 값을 옮겨 적지 않고 가리킨다.

| 무엇 | 소유 |
|---|---|
| 툰 사양(JSON)을 머티리얼에 입히는 규칙 | `tools/blender/toon.py` |
| 층 구성 · 캔버스 · 발 밑선 같은 플레이어 규격 | [`art-asset-spec.md`](../../design/spec/art-asset-spec.md) §3 |
| VRoid · Blender · VRM 애드온의 이용 조건 | [`ops-licensing.md`](ops-licensing.md) §2 |
| VRM 애드온 판을 고정하는 방법 | `tools/blender/README.md` 「깔아야 하는 것」 |

## 2. 근거 자료 — 무엇을 답하고 무엇이 없나

**공식 자료 어디에도 애드온의 노드 내부 식은 없다.** 명세는 식을 주지만 애드온이 그 식을 쓰지 않고, 애드온 문서는 패널 사용법까지만 다룬다. 그래서 §3의 식은 노드 그룹의 연결을 직접 읽어 복원했다. 아래 표는 각 자료에서 무엇을 얻을 수 있고 무엇을 찾으면 안 되는지를 적는다. 「확인」칸은 원문을 직접 연 날짜다.

| 자료 | 무엇을 답하나 | 무엇이 없나 | 확인 |
|---|---|---|---|
| **MToon 1.0 명세** (VRM 컨소시엄) | 파라미터 정의와 기본값, 음영 식(`dot(N, L) + shadingShift` → `linearstep`), 외곽선 폭의 단위 | 그림자와의 관계, `lightColor`의 정의. 렌더러 구현에 맡겨 둔다 | 2026-09-16 · [명세](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_materials_mtoon-1.0/README.md) |
| **VRM Add-on for Blender 문서** 「Create Anime Style Material」 | 패널에서 MToon 값을 넣는 예시(`Shading Toony` · `Outline Width` · World Coordinates), 외곽선 표시가 Blender 3.3과 3.5 이상에서만 된다는 것 | 노드 내부 식, 그림자, 렌더용 조명 권장 | 2026-09-16 · [문서](https://vrm-addon-for-blender.info/en-us/material-mtoon/) |
| **애드온 이슈 #314** 「Status of the Blender shader node group?」 | Blender 셰이더가 Unity와 결과가 다르고 특정 빛 각도에서 이상하다는 보고. `Light Vector Emulation`의 나눗셈 출력이 빛 각도에 따라 크게 변한다는 지적 | 관리자 답변. 확인 시점에 열린 채 담당자 · 라벨이 없다 | 2026-09-16 · [이슈](https://github.com/saturday06/VRM-Addon-for-Blender/issues/314) |
| **Blender 5.2 매뉴얼** 「Shader To RGB」 | EEVEE 전용이고 조명을 계산한 색을 낸다는 것, 그 대가로 생기는 제약(아래 인용) | 그림자가 결과에 들어가는지에 대한 명시 | 2026-09-16 · [매뉴얼](https://docs.blender.org/manual/en/latest/render/shader_nodes/color/shader_to_rgb.html) · [원본](https://projects.blender.org/blender/blender-manual/raw/branch/main/manual/render/shader_nodes/color/shader_to_rgb.rst) |
| DeepWiki 「MToon Material System」 — **공식 자료가 아니다** | 애드온의 속성 그룹이 노드 소켓과 값을 주고받는 구조, 노드 트리가 `mtoon1.blend` 템플릿에서 복사된다는 것 | 노드 내부 식 | 2026-09-16 · [페이지](https://deepwiki.com/saturday06/VRM-Addon-for-Blender/4.1-mtoon-material-system) |

매뉴얼이 Shader to RGB에 붙인 제약은 이렇다. MToon 노드가 조명을 이 노드로 읽으므로(§3.2) 그대로 이 셰이더의 제약이 된다.

> Using this conversion breaks the PBR pipeline and thus makes the result unpredictable when used in combination with effects such as ambient occlusion, contact shadows, soft shadows and screen space refraction.
> — [Blender 5.2 매뉴얼 「Shader To RGB」](https://docs.blender.org/manual/en/latest/render/shader_nodes/color/shader_to_rgb.html) (2026-09-16 확인)

검색에 걸렸지만 열지 않은 자료가 하나 있다. UniVRM의 [MToon 설명](https://vrm.dev/en/univrm/shaders/shader_mtoon/)은 Unity 구현을 다루는데, Unity와 Blender의 결과가 다르다는 것이 이슈 #314의 요지라 이 문서의 판단 근거로 쓰지 않았다.

## 3. 애드온이 실제로 칠하는 식

아래는 **VRM Add-on v4.7.1 · Blender 5.2.1 LTS**에서 읽은 것이다. 판이 바뀌면 §6대로 다시 확인한다.

### 3.1 명세의 식은 노드에 있지만 연결돼 있지 않다

명세의 음영 식은 이렇다.

```
shading = dot(N, L) + shadingShiftFactor + texture(shadingShiftTexture) × scale
shading = linearstep(−1 + shadingToonyFactor, 1 − shadingToonyFactor, shading)
color   = lerp(shadeColorTerm, baseColorTerm, shading) × lightColor
```

노드 그룹 `VRM Add-on MToon 1.0 Output Revision 1` 안에도 이 식을 짠 노드가 `Make Toon` 프레임에 있다. 그러나 그 출력이 `New`라는 이름의 경유 노드에서 끝나고 **어디에도 이어지지 않는다.** 기본색과 음영색을 섞는 `Mix Lit and Shade` 프레임의 혼합 비율은 `Old Lit and Shade Mix Factor (will be removed)` 프레임에서 온다. 명세를 읽고 값을 정하면 실제 식과 어긋나는 이유가 이것이다.

### 3.2 실제 식

```
D(n) = Shader to RGB( Diffuse BSDF(법선 n) )      EEVEE가 그 법선에 준 조명
I    = 채널 최댓값( (D(N) − D(아래)) / max(D(위) − D(아래), 0.0001) )
m    = max( clamp(−(shadingShift + shadingShiftTexture × scale), 0, 1), 0.0005 )
t    = clamp(1 − shadingToony, 0, 1)

shadingToony = 1 (t = 0) → 밝음 = I ≥ m 이면 1, 아니면 0
shadingToony < 1         → 밝음 = clamp( (I − (m − t)) / (2t), 0, 1 )

색   = mix(음영색 × 음영 텍스처, 기본색 × 기본 텍스처, 밝음)
```

`N`은 표면 법선이고, `위`와 `아래`는 법선이 `(0, 0, 1)`과 `(0, 0, −1)`인 가상의 면이다. `I`를 만드는 부분이 이슈 #314가 가리킨 `Light Vector Emulation` 프레임이다.

## 4. 이 식에서 나오는 제약

### 4.1 음영 경계(shading shift)는 0보다 크면 효과가 없다

문턱 `m`은 음영 경계의 부호를 뒤집은 뒤 0~1로 자른 값이다. 그래서 **0보다 큰 음영 경계는 전부 0과 같다.** 그늘을 넓히는 쪽(0보다 작은 값)만 효과가 있고, 그늘을 좁히는 값은 없다.

VRoid는 얼굴 피부에 0.71, 몸 피부에 −0.05처럼 서로 다른 값을 내보낸다. 명세의 식으로 읽으면 얼굴이 몸보다 훨씬 덜 그늘지는 설정이지만, 실제로는 얼굴의 문턱이 0이고 몸의 문턱이 0.05라 거의 같다. 이 차이를 모르면 0보다 큰 값을 후보로 굽고 결과가 기준과 같게 나오는 것을 「값을 바꿔도 차이가 없다」로 판정하게 된다. 2026-09-16에 얼굴 피부의 음영 경계를 1.0과 2.0으로 굽자 둘 다 기준 컷과 픽셀 차이가 없었다.

### 4.2 빛을 등진 면은 값으로 밝힐 수 없다

빛을 등진 면은 Diffuse BSDF가 받는 빛이 없어 `D(N) = 0`이고 `I = 0`이다. `m`은 0.0005 이상이므로 계단 정도(shading toony)가 1이면 이 면은 **늘 음영색**이다. 계단 정도를 0까지 내려도 `(0 − (m − 1)) / 2`라서 절반까지만 밝아진다.

그래서 얼굴 한쪽에 지는 그늘처럼 빛을 등진 면의 그늘은 음영 경계와 계단 정도로 지울 수 없다. 지울 수단은 둘뿐이다. 하나는 조명을 옮겨 그 면이 빛을 등지지 않게 하는 것이고, 다른 하나는 그 머티리얼의 음영색을 기본색과 같게 두는 것이다. 뒤쪽은 음영 텍스처와 기본 텍스처가 같을 때만 그늘이 사라지는데, VRoid 텍스처가 그런지는 모델마다 확인해야 한다. 2026-09-16에 얼굴 피부의 음영색을 초록으로 칠하고 음영 경계를 2.0으로 올려 구웠다. 계단 정도 1에서는 뺨에 순수한 초록 388픽셀이 그대로 남았고, 0.99와 0.9에서는 순수한 초록이 0으로 사라진 대신 피부색과 절반쯤 섞인 초록 413 · 443픽셀이 남았다. 위 식이 예측한 그대로다.

### 4.3 같은 문턱이라도 태양 고도에 따라 그늘 폭이 달라진다

`I`는 그 면의 조명을 **위를 향한 면의 조명**으로 나눈 값이다. 태양광 하나가 수평선에서 `e`도 위에 있으면 위를 향한 면이 받는 몫이 `sin(e)`라, 문턱 `m`은 `dot(N, L) ≥ m × sin(e)`와 같다. 태양을 높이 올리면 같은 `m`에서 그늘이 넓어지고, 낮추면 좁아진다. 태양이 수평선 아래로 가면 분모가 0.0001로 막혀 빛을 등지지 않은 면은 거의 다 밝아진다.

그래서 조명 방향과 문턱은 **조명을 먼저 정하고 문턱을 그 위에서 고른다.** 둘을 한 후보 시트에서 함께 바꾸면 어느 쪽이 그늘 폭을 바꿨는지 가를 수 없다. 문턱을 고른 뒤 조명을 옮기면, 골라 둔 문턱의 그늘 폭이 아무 경고 없이 달라진다. 이슈 #314가 보고한 「빛 각도에 따른 이상」도 이 나눗셈에서 나온다.

### 4.4 계단 정도 1은 켜고 끄는 비교다

계단 정도가 1이면 `m − t`와 `m + t`가 같아져 노드가 선형 보간 대신 비교(`I ≥ m`) 가지를 탄다. 경계가 샘플마다 켜지거나 꺼질 뿐이라, 경계의 부드러움은 EEVEE의 안티에일리어싱만 정한다. 1보다 조금 작은 값은 `2t` 폭의 선형 경사를 만든다.

### 4.5 그림자 투사로 그늘을 조절하지 않는다

2026-09-16에 왼쪽 위 태양광 하나로 구운 기준 컷에서 조명의 그림자 투사(`use_shadow`)를 끄고, 모든 메시의 그림자 표시(`visible_shadow`)도 끄고 다시 구웠다. 두 경우 모두 기준 컷과 픽셀 차이가 없었다. 게다가 §2의 매뉴얼 인용대로 Shader to RGB는 그림자와 섞이면 결과를 예측할 수 없다. 그래서 그늘의 모양은 그림자 설정이 아니라 조명 방향(§4.3)과 문턱(§4.1)으로만 다룬다.

## 5. 외곽선 — 명세 단위와 애드온 구현

명세는 외곽선 폭 방식을 셋으로 정한다. `none`, `worldCoordinates`(폭의 단위가 미터), `screenCoordinates`(화면 세로에 대한 비율)다.

애드온은 외곽선을 **셰이더가 아니라 지오메트리로** 만든다. 외곽선을 켠 머티리얼마다 그 메시에 `MToon Outline (<머티리얼 이름>)` 지오메트리 노드 모디파이어가 붙고, 모디파이어의 노드 그룹 `VRM Add-on MToon 1.0 Outline Geometry Revision 1`이 면을 밀어내고(Extrude Mesh) 뒤집는다(Flip Faces). 뒤집힌 껍데기를 몸보다 조금 크게 두는 인버티드 헐 방식이다. 껍데기는 `MToon Outline (...)`라는 별도 머티리얼로 칠하고, 그 머티리얼은 원본 머티리얼의 값을 따라간다.

모디파이어가 원본 메시에 붙으므로 **몸을 가림 전용 컬렉션에 넣으면 몸의 외곽선 껍데기도 함께 가린다.** 껍데기가 몸보다 두께만큼 크므로, 무기가 몸 뒤를 지나는 자리에서는 몸 윤곽보다 그 두께만큼 더 넓게 지워진다. 이 효과를 실제로 구워 잰 적은 아직 없다.

아래 둘은 아직 확인하지 않았다. 외곽선 방식을 고를 때 확인하고 이 절을 고친다.

- `worldCoordinates`에서 밀어내는 거리가 폭 값과 같은지, 절반인지
- 직교 카메라에서 `screenCoordinates`가 어떻게 동작하는지

## 6. 다시 확인해야 하는 때와 확인하는 법

§3과 §4는 한 판의 애드온에서 노드를 읽은 결과라, 아래 둘 중 하나가 바뀌면 다시 확인한다.

- **VRM 애드온 판이 바뀔 때.** 실제로 쓰이는 경로의 프레임 이름이 `(will be removed)`라서, 애드온이 판을 올리며 명세 식(§3.1)으로 갈아 끼울 수 있다. 그러면 §4.1~§4.4가 전부 달라지고, 그 전에 골라 둔 문턱과 계단 정도가 같은 그림을 내지 않는다.
- **Blender 판이 바뀔 때.** 식의 입력이 EEVEE의 Shader to RGB라, 엔진이 조명이나 그림자를 이 노드에 넘기는 방식이 바뀌면 `I`가 달라진다.

**`tools/blender/inspect_mtoon.py`가 이 확인을 한 번에 한다.** `.vrm` 하나를 받아 MToon 머티리얼 값을 JSON으로 쓰고, 판정 줄에 애드온 판(`vrm_addon`)과 음영 혼합이 어느 프레임에서 오는지(`shading_path`)를 찍는다. `old`면 §3.2가 그대로이고, `new`면 명세 식으로 바뀐 것이며, `unknown`이면 노드 그룹의 구조 자체가 바뀐 것이라 아래 손 확인으로 넘어간다. 돌리는 법은 그 파일 머리 주석에 있다.

손으로 확인할 때는 Blender에서 한다. `.vrm`을 들여온 뒤 MToon 머티리얼의 셰이더 편집기에서 `VRM Add-on MToon 1.0 Output` 노드 그룹에 들어가, `Mix Lit and Shade` 프레임의 혼합 노드 `Factor` 입력을 거슬러 올라간다. 그 입력이 `Old Lit and Shade Mix Factor` 프레임에서 오면 §3.2가 그대로이고, `Make Toon` 프레임에서 오면 명세 식으로 바뀐 것이다. 렌더로 가르려면 음영 경계를 0보다 크게 넣어 본다. 그림이 달라지면 §4.1이 더는 맞지 않는다.
