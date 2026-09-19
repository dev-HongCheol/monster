# 도구·모델 라이선스와 판매 조건

> 이 도구로 만든 것을 팔아도 되나

- **최초 작성:** 2026-08-20
- **상태:** CONFIRMED
- **이력:** 2026-08-20 — 신설 · 2026-08-22 배경 제거가 fal 매팅으로 옮겨 가 §2 표에서 `rembg` 행을 「과거에 쓴 것」으로 내리고 `bria/background/remove`를 「지금 쓰는 것」으로 세웠다. §2.1의 모델 명시 함정은 폴백용으로 남기되 실효 표시를 달았다 · 2026-09-14 §2 표에 플레이어 3D 경로가 쓰는 도구 셋(VRoid Studio · VRM Add-on for Blender · Quaternius Universal Animation Library)을 더했다. VRoid는 원문을 직접 열지 못해 「미확인」으로 올렸다 · 2026-09-15 VRoid Studio 행을 이용약관(2026-06-24 개정판)과 가이드라인 원문으로 확인해 고치고, Blender 행과 지팡이 · 방패 3D 모델 행을 더했다. VRoid의 세부 조건과 생산 판의 VRM 메타 값은 §2.2를 새로 세워 모았다 · 2026-09-19 §2.2에서 「미확인」으로 남겨 뒀던 VRoid Plus를 약관 개정 이력과 v2.14.0 공지 원문으로 확인해 고쳤다. 광고를 없애는 구독이라 프리셋 항목의 조건과 무관하다. 같은 날 §2 표에 ChatGPT 웹 행을 더하고, 출력 권리의 양도 · 입력 권리의 보증 · 걸리는 금지 행위 셋과 「VRoid 프리셋 텍스처를 생성 입력으로 넣지 않는다」는 규칙을 §2.3에 모았다. Blender 행에는 공개한 bpy 스크립트에 GPL-3.0-or-later를 붙였다는 것을 적었다

---

이 문서는 **정본**이다. 내용이 낡으면 새로 만들지 않고 이 문서를 고친다. 이력 절에는
날짜와 무엇이 바뀌었는지만 한 줄 남기고, 그렇게 정한 경위는 그 슬라이스의 세션 문서가 든다.

## 1. 이 문서가 드는 것과 들지 않는 것

이 문서는 **지금 쓰는 도구의 이용 조건**을 든다 — 그 도구로 만든 것을 상업적으로 써도 되는지, 쓰면서 지켜야 하는 제약이 무엇인지, 팔 때 무엇을 신고해야 하는지다.

인접한 셋은 다른 정본이 소유하므로 여기서 값을 옮겨 적지 않고 가리킨다.

| 무엇 | 소유 정본 |
|---|---|
| 로컬 베이스 모델 8종의 라이선스 원문 확인표 | [`comfyui-setup.md`](../comfyui-setup.md) 부록 C |
| Spine 에디션별 기능·요금 비교 | [`art-asset-spec.md`](../../design/spec/art-asset-spec.md) §5.1 |
| 생성 원본을 어디에 어떻게 보관하나 | [`art-asset-spec.md`](../../design/spec/art-asset-spec.md) §9.1.1 |
| 레퍼런스로 넣는 이미지의 출처를 왜 가리나 | [`art-direction.md`](../../design/spec/art-direction.md) 부록 C |
| 빌드가 무엇을 내놓고 어디에 올리나 | [`ops-build.md`](ops-build.md) |

## 2. 판정 — 지금 쓰는 것

각 행의 「확인」칸은 원문을 직접 연 날짜다. 조건이 낡는 방식은 §7에 있다.

| 도구·모델 | 무엇에 쓰나 | 조건 | 확인 |
|---|---|---|---|
| **fal.ai** (플랫폼) | 아트 생성 전반 | 이용약관 2026-07-31판이 적용된다. 상업 이용을 막는 조항은 없고, 제약은 §3에 모았다 | 2026-08-20 · [약관](https://fal.ai/legal/terms-of-service) |
| **`openai/gpt-image-2`** · **`/edit`** | 플레이어 4방향 시트와 그 파생본 전부 | 모델 페이지 사양표의 License 칸이 `Commercial use via fal Partner agreement`. 편집 엔드포인트에도 같은 `Commercial use` 표시가 붙는다 | 2026-08-20 · [모델](https://fal.ai/models/openai/gpt-image-2) · [편집](https://fal.ai/models/openai/gpt-image-2/edit) |
| **ChatGPT 웹** (OpenAI 개인용 서비스) | 2D 이미지 생성 — 사용자가 웹에서 직접 만든다(2026-09-15 결정). 첫 산출물은 화풍 비교에 쓴 귀신 표본이다. fal 경유 생성을 대신하지만, 출하된 플레이어 4방향 아트가 fal에서 나왔으므로 위 fal 행들은 그 근거로 남는다 | 이용약관이 출력의 권리를 이용자에게 양도하고, 상업 이용을 막는 조항은 없다. 다만 출력이 독창적이지 않을 수 있다고 적고, 넣는 입력의 권리는 이용자가 보증해야 한다. 조항 인용과 이 프로젝트가 지킬 것은 §2.3에 있다 | 2026-09-19 · [이용약관](https://openai.com/policies/terms-of-use/) |
| **SDXL 1.0 base + 자체 LoRA** | `player_mage_bridge.png` 한 장(유료 전환 이전) | `openrail++`이고 자체 학습 LoRA를 배포하지 않으므로 게임에 걸리지 않는다. 원문 확인표는 §1이 가리키는 복구 매뉴얼이 든다 | 2026-07-21 |
| **rembg** (로컬) | **과거에 쓴 것** — `player_mage_bridge.png` 한 장의 배경 제거 | 코드는 MIT지만 **모델 가중치는 각자 다른 라이선스**다. 이 장비가 받아 둔 것은 `u2net.onnx` 하나이고 그 출처인 [U-2-Net](https://github.com/xuebinqin/U-2-Net)은 Apache-2.0이라 상업 사용에 문제가 없다. **다만 아래 함정이 있다.** 2026-08-22에 배경 제거가 fal 매팅으로 옮겨 가 이 경로는 더 쓰지 않지만, 근거를 대는 그 PNG가 아직 레포에 추적 중이라 행을 지우지 않는다 | 2026-08-20 · [rembg](https://github.com/danielgatis/rembg) |
| **`bria/background/remove`** (fal) | **지금 쓰는 것** — 캐릭터 배경 제거 | 모델 페이지에 `Commercial use` 표시가 붙는다. BRIA는 자체 배포판이 유료 계약을 요구하지만 **fal 경유에는 그 조건이 붙지 않는다.** 후보 둘을 숫자로 견줘 2026-08-22에 채택했고, 판정 항목은 `art-generation-playbook.md` §8.5가 든다 | 2026-08-20 |
| **fal 배경 제거 대안 2종** | 폴백 | `birefnet/v2` · `imageutils/rembg` 둘 다 모델 페이지에 `Commercial use` 표시가 붙는다. `birefnet/v2`는 품질 판정에서 떨어졌을 뿐 라이선스는 문제없다 | 2026-08-20 |
| **Spine** | 리깅(아직 결제 전) | 에디터 라이선스가 런타임을 제품에 넣을 권한을 함께 준다 — 런타임은 별도 구매가 아니다. 재배포물에 라이선스와 저작권 고지를 포함해야 한다. 등급·요금은 §1이 가리키는 사양서가 든다 | 2026-08-20 · [런타임 라이선스](https://esotericsoftware.com/spine-runtimes-license) |
| **Cocos Creator** | 엔진 | 게임 개발 목적의 사용이 무료이고 로열티가 없다. 사용자 서비스 약관이 유료화 시 사전 공지를 약속한다. 스플래시·크레딧 표기 의무 조항은 없고 상표 사용 제한만 있다 | 2026-08-20 · [약관](https://download.cocos.com/CocosUdc/agreement/Cocos_User_Service_Agreement_en_20220901.html) |
| **VRoid Studio** | 플레이어 3D 마스터(`.vrm`) | 만든 캐릭터의 렌더를 게임에 싣고 그 게임을 팔아도 된다. 다만 pixiv가 제공하는 기본 모델 · 의상 · 프리셋은 CC0가 아니다. pixiv가 권리를 가진 채 이용을 허락하는 것이고, 특별 조항이 표시된 항목은 그 조항을 따른다. 제공 콘텐츠로 아바타를 만들어 내는 앱에는 별도 라이선스가 필요하고, 다른 제작자의 에셋은 그 에셋의 조건을 따른다. 원문 인용, 생산 판의 VRM 메타 값, 원본을 공개하지 않는 이유는 §2.2에 있다 | 2026-09-15 · [이용약관](https://policies.pixiv.net/en.html#vroidstudio) · [가이드라인](https://vroid.com/en/studio/guidelines) |
| **Blender** | `.vrm`을 층별 프레임으로 굽기, 지팡이 · 방패 모델링 — `tools/blender/` | 프로그램은 GPL이지만 Blender로 만든 결과물에는 GPL이 붙지 않는다. 라이선스 페이지가 「What you create with Blender is your sole property」라고 적고, 그 대상에 이미지 · 영상과 `.blend` 등 데이터 파일을 넣는다. GPL이 따라붙는 것은 Blender를 배포하거나 Blender 파이썬 API를 쓰는 스크립트를 공개할 때이고, 그런 스크립트는 GPL 호환 라이선스로 공유해야 한다. 공개 레포에 있는 `tools/blender/`의 파이썬 스크립트가 여기에 해당한다. 그래서 그 스크립트들에만 GPL-3.0-or-later를 붙였다(2026-09-19). 범위는 루트 `LICENSE` §2가 들고, 같은 폴더의 TypeScript 실행기 · 사양 JSON · 구운 결과물은 거기 들지 않는다 | 2026-09-15 · [라이선스](https://www.blender.org/about/license/) |
| **지팡이 · 방패 3D 모델** | 기본 무기 층의 원본 | Blender에서 직접 만든다. 외부 모델이나 생성 서비스를 거치지 않으므로 권리가 전부 이 프로젝트에 있고 따라붙는 약관이 없다. 외부 모델을 받게 되면 `.glb` · `.obj`로만 받고, 받기 전에 이 표에 행을 붙인다. `.blend`를 받지 않는 것은 파일에 든 파이썬이 열 때 자동 실행되는 공격 경로가 되기 때문이다. 기각: AI 3D 생성(Meshy · Tripo) · 커미션(2026-09-15) | 2026-09-15 |
| **VRM Add-on for Blender** | `.vrm`을 Blender로 들여오기 — `tools/blender/` | MIT와 GPL-3.0 가운데 골라 쓰는 이중 라이선스다. Blender 안에서 도구로만 쓰고 게임에 싣지 않으므로 게임 쪽에 붙는 의무가 없다. 판을 고정하는 방법은 `tools/blender/README.md`가 든다 | 2026-09-11 · [확장 페이지](https://extensions.blender.org/add-ons/vrm/) |
| **Quaternius Universal Animation Library** | 걷기 모션 원본 — `tools/blender/`가 리타게팅한다 | CC0 1.0(퍼블릭 도메인 헌정)이라 표기 의무도 재배포 제한도 없다. 그래서 받은 파일을 라이선스 파일과 함께 `art-source/`에 커밋한다 | 2026-09-14 · 동봉 `License.txt` · [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| 폰트 · 사운드 | 아직 없다 | `game/assets/` 아래에 폰트 파일도 오디오 파일도 0개다. 고르는 시점에 이 표에 행이 붙는다 | 2026-08-20 |

### 2.1 rembg를 쓸 때는 모델을 명시한다

`rembg`를 옵션 없이 돌리면 **기본 모델이 `bria-rmbg`**이고, 그 모델은 상업 이용에 유료 계약을 요구한다.

> Note that RMBG-2.0 is released under a BRIA license that requires a paid agreement for commercial use. Model weights carry their own licenses, independent of rembg's MIT license — check the linked source before using any model commercially.
> — [rembg README](https://github.com/danielgatis/rembg) (2026-08-20 확인)

이 기본값은 2026-08-17 커밋으로 바뀐 것이라, 그 전에 처리한 `player_mage_bridge.png`에는 소급되지 않는다.

**이 함정은 2026-08-22에 실효됐지만 절을 남긴다.** 배경 제거가 fal 매팅으로 옮겨 가 로컬 `rembg`를 부를 일이 없어졌기 때문이다. 그래도 지우지 않는 이유는 폴백으로 돌아올 수 있어서다 — 그때 로컬 rembg를 쓴다면 **`-m u2net`을 명시**한다. 명시하지 않으면 도구를 갱신한 날부터 유료 라이선스 모델로 처리되고, 결과 PNG만 봐서는 어느 모델이 만들었는지 구분할 수 없다.

### 2.2 VRoid Studio로 만든 캐릭터에 붙는 조건

판정의 근거는 VRoid Studio 이용약관과 가이드라인 두 문서다. 약관은 일본어 원문이 우선하고 영문판은 참고 번역인데, 아래 약관 인용은 영문판에서 옮겼다. 도움말 센터의 FAQ는 봇 확인 화면에서 멈춰 자동으로 열리지 않았지만, FAQ가 요약하는 조건의 원문이 이 두 문서다.

**약관 조항 번호는 가이드라인과 어긋난다.** 가이드라인(2023-12-21판)이 가리키는 제11조 · 제5조는 2026-06-24 개정에서 유료 서비스 조항이 끼어 들어 지금은 제13조 · 제7조다. 가이드라인의 번호로 약관을 찾으면 다른 조항이 나오므로, 아래는 개정판 번호로 적는다.

**게임에 싣고 파는 것은 허용이다.** 모델의 이미지를 게임에 써서 수익을 내는 것이 허용 목록에 들어 있다.

> You can use images and videos of models created with VRoid Studio and generate profit from videos, books, printed materials such as posters and cards, goods such as acrylic keychains and T-shirts, games, applications, software, collections of materials, websites, icons for SNS, etc.
> — [VRoid Studio Guidelines](https://vroid.com/en/studio/guidelines) (2023-12-21판, 2026-09-15 확인)

**기본 데이터는 CC0가 아니고, 따로 조건이 붙은 항목이 있다.** pixiv는 제공 콘텐츠의 권리를 가진 채 넓게 이용을 허락하지만, 항목마다 다른 조건을 표시할 수 있다.

> All content provided by pixiv, including the base models when creating a new avatar, is not CC0.
> — [VRoid Studio Guidelines](https://vroid.com/en/studio/guidelines) (2023-12-21판, 2026-09-15 확인)

> The Company will grant Users a non-exclusive, perpetual, worldwide, non-transferable, non-sublicensable license to use, duplicate, archive, modify, and display Provided Content, subject to restrictions common to all licenses, for (1) any purpose and (2) any use, except where different license conditions are specified and displayed for individual items of Provided Content.
> — [VRoid Studio 이용약관](https://policies.pixiv.net/en.html#vroidstudio) 제13조 1항 (2026-06-24 개정판, 2026-09-15 확인)

그래서 캐릭터와 옷은 VRoid 기본 프리셋, 그것을 직접 고친 것, 직접 만든 텍스처로만 구성하고, 별도 라이선스가 표시된 항목은 쓰지 않는다. 표시는 항목마다 붙으므로 항목을 고를 때마다 본다.

**유료 구독 VRoid Plus는 프리셋 항목의 조건과 무관하다.** 약관의 유료 서비스 조항(제4조 · 제5조)은 VRoid Plus를 들이면서 생겼고, 공지와 도움말이 적는 VRoid Plus의 혜택은 iPad판의 광고를 없애는 것 하나다. 그래서 항목을 고를 때 볼 것은 구독 여부가 아니라 그 항목에 표시된 특별 조항이다.

> In connection with the introduction of the paid service VRoid Plus, the fee provisions have been revised and new articles regarding paid services, cancellation, and data management have been added.
> — [VRoid Studio 이용약관](https://policies.pixiv.net/en.html#vroidstudio) 개정 이력 (2026-09-19 확인)

> A new subscription service, VRoid Plus, is now available. … Subscribing to a plan removes ads from the app.
> — [VRoid Studio v2.14.0 공지](https://vroid.com/en/studio/notice/7roAawRAU0e1ntT8nNuQr9)의 iPad판 항목 (2026-06-29판, 2026-09-19 확인)

도움말 센터의 「About VRoid Plus」도 같은 내용이다. 그 페이지는 봇 확인 화면에서 멈춰 자동으로 열리지 않으므로 브라우저에서 직접 열어 확인했다.

**기본 프리셋을 고친 의상은 따로 팔 수 있다.** v2 스킨 판매가 이 조건에 기댄다. 게임이 파는 것은 모델 데이터가 아니라 구운 2D 층이라, 위의 「이미지를 게임에 써서 수익을 내는」 허용에도 함께 들어간다.

> You can sell the data created by modifying preset items, as long as those preset items have no special clauses written in the license.
> — [VRoid Studio Guidelines](https://vroid.com/en/studio/guidelines) (2023-12-21판, 2026-09-15 확인)

**제공 콘텐츠로 3D 모델을 만들어 내는 앱에는 별도 라이선스가 필요하다.** 본인만 쓰는 앱은 예외다.

> Users are not licensed to use Provided Content, or 3D models or Output Items containing Provided Content, to create applications having functions that allow avatars, items, or other 3D models to be created by deforming meshes or combining meshes or textures.
> — [VRoid Studio 이용약관](https://policies.pixiv.net/en.html#vroidstudio) 제13조 3항 (2026-06-24 개정판, 2026-09-15 확인)

지금 게임이 옷을 바꾸는 방식은 미리 구운 2D 층을 바꿔 끼우는 것이라, 메시나 텍스처를 조합해 3D 모델을 만들어 내는 기능이 아니다. 반면 게임 안에서 VRoid 메시와 텍스처를 조합해 3D 캐릭터를 꾸미게 하는 런타임 3D 방식이면 이 조항에 걸린다. 그 방식을 검토하게 되면 이 판정부터 다시 한다.

**다른 제작자의 에셋은 그 에셋의 조건을 따른다.** 구입한 텍스처처럼 권리가 다른 제작자에게 있는 데이터에는 VRoid 조건이 아니라 그 데이터의 조건이 붙는다. 지금 캐릭터에는 제3자 에셋이 없고, 들이려면 §2 표에 행을 먼저 붙인다.

**크레딧 표기 의무는 없다.** 약관과 가이드라인 어디에도 표기를 요구하는 조항이 없다.

**VRM 메타는 그 파일을 쓰는 다른 사람에게 주는 조건이다.** 약관 제12조 2항이 제공 콘텐츠 조건을 어기지 않는 한 VRM의 라이선스를 자유롭게 정하게 하고, VRM 1.0 명세의 메타 항목은 그 모델을 쓰는 사람이 무엇을 할 수 있는지를 적는다. 생산 판은 공개하지 않으므로(아래) 이 값이 실제로 작동하는 것은 파일이 새어 나갔을 때다. 그래서 다른 사람에게는 가장 좁게 열고, 개발 주체가 법인으로 바뀌어도 판을 다시 내보낼 일이 없게 `commercialUsage`만 넓힌다.

| 필드 | 값 |
|---|---|
| `avatarPermission` | `onlyAuthor` |
| `commercialUsage` | `corporation` |
| `allowRedistribution` | `false` |
| `modification` | `prohibited` |
| `creditNotation` | `required` |
| `allowExcessivelyViolentUsage` · `allowExcessivelySexualUsage` · `allowPoliticalOrReligiousUsage` · `allowAntisocialOrHateUsage` | `false` |
| `authors` | `monster` |
| `contactInformation` · `references` · `copyrightInformation` | 비운다 |

`authors`는 명세상 필수이고 빈 문자열이 아닌 항목이 하나 이상 있어야 해서 비울 수 없다. 레포가 공개라 실명 · 계정명 대신 프로젝트 이름을 넣는다. VRoid가 내보낼 때 이 필드들을 채울 수 있으므로 내보낸 파일의 메타를 읽어 확인한다.

**생산 `.vrm` · `.vroid`는 공개 레포에 올리지 않는다.** 약관만 보면 공개가 금지되지는 않는다. 가이드라인이 내보낸 모델 데이터를 팔아도 된다고 적기 때문이다. 그래도 올리지 않는 것은, 공개하면 누구나 플레이어 캐릭터와 상의 판(v2 유료 스킨의 원형)을 내려받아 쓸 수 있고, 한 번 푸시한 파일은 PR ref에 남아 되돌릴 수 없어서다. 두 파일을 어디에 두는지는 §1이 가리키는 사양서가 든다.

### 2.3 ChatGPT 웹으로 만든 그림에 붙는 조건

판정의 근거는 OpenAI 이용약관(개인용 서비스, 2026-01-01 발효판)의 한국어판이다. API와 기업용 서비스에는 별도의 사업자 약관이 적용되므로, 이 절은 사용자가 웹에서 직접 만든 그림에만 해당한다. 약관 페이지는 봇 확인 화면에서 멈춰 자동으로 열리지 않으므로 브라우저에서 직접 연 본문으로 확인했다. 약관이 함께 지키라고 적는 사용 정책과 공유 및 공개 정책은 열지 않았다.

**출력의 권리는 OpenAI가 이용자에게 양도한다.** fal 약관에는 없던 문장이다(§4).

> 귀하와 OpenAI 간에 관련 법률이 허용하는 한도 내에서, 귀하는 (a) 입력에 대한 소유권을 유지하고 (b) 출력을 소유합니다. 당사는 출력에 대한 모든 권리, 소유권 및 이권을 이로써 귀하에게 양도합니다.
> — [OpenAI 이용약관](https://openai.com/policies/terms-of-use/) 「콘텐츠의 소유권」 (2026-01-01 발효판, 2026-09-19 확인)

**그 양도가 독점을 뜻하지는 않는다.** 넘어오는 것은 OpenAI가 가진 권리이고, 그 그림에 저작권이 성립하는지는 약관이 정하지 않는다. 같은 약관이 다른 이용자도 비슷한 출력을 받을 수 있다고 적는다.

> 서비스와 인공지능의 일반적인 특성상, 출력은 독창적이지 않을 수 있으며 다른 사용자들도 서비스로부터 유사한 출력을 받을 수 있습니다. 위 조항에 따른 당사의 양도는 다른 사용자의 출력이나 제3자 출력에 적용되지 않습니다.
> — [OpenAI 이용약관](https://openai.com/policies/terms-of-use/) 「콘텐츠 유사성」 (2026-01-01 발효판, 2026-09-19 확인)

그래서 유료 스킨을 파는 관점의 결론은 §4와 같다. 제3자가 비슷한 그림을 내놓아도 이 약관에서는 막을 근거가 나오지 않고, 근거가 생기는 자리는 사람 손이 더해진 부분이다.

**넣는 것의 권리는 우리가 보증한다.**

> 귀하는 서비스에 입력을 제공하는 데 필요한 모든 권리, 라이선스 및 권한을 보유하고 있음을 진술하고 보장합니다.
> — [OpenAI 이용약관](https://openai.com/policies/terms-of-use/) 「귀하의 콘텐츠」 (2026-01-01 발효판, 2026-09-19 확인)

그래서 **VRoid가 제공한 프리셋 텍스처를 레퍼런스나 편집 원본으로 넣지 않는다.** 프리셋은 pixiv가 권리를 가진 채 재허락할 수 없는 조건으로 이용을 허락한 것이고(§2.2), VRoid Studio 약관에는 제3자 생성 서비스에 올리는 경우를 다룬 조항이 없다(2026-09-19에 VRoid Studio 절 전체를 검색해 확인). 허락도 금지도 적혀 있지 않은 자리에서 위 보증을 서게 되므로, 옷 텍스처는 빈 UV나 우리가 그린 원본 위에서 새로 만든다. 약관 해석에 기대지 않고 위험이 생길 자리 자체를 없애는 규칙이다.

**넣은 것과 받은 것은 OpenAI의 모델 학습에 쓰일 수 있고, 설정으로 끌 수 있다.** 미공개 캐릭터의 그림을 레퍼런스로 넣게 되므로, 생성에 쓰는 계정은 학습 이용을 꺼 둔다.

> 귀하의 콘텐츠를 당사의 모델을 학습시키는 데 사용하지 않기를 원한다면, 이 문서의 설명에 따라 거부할 수 있습니다.
> — [OpenAI 이용약관](https://openai.com/policies/terms-of-use/) 「거부」 (2026-01-01 발효판, 2026-09-19 확인)

**금지 행위 가운데 이 프로젝트에 걸리는 것은 셋이다.**

| 약관이 금지하는 것 | 이 프로젝트에서 뜻하는 것 |
|---|---|
| 「출력이 사람이 생성한 것이 아님에도 불구하고 사람이 생성하였다고 하는 행위」 | 상점의 AI 고지(§6)와 같은 방향이다. 생성물을 손그림이라고 소개하지 않는다 |
| 「OpenAI와 경쟁하는 모델을 개발하기 위해 출력을 사용하는 행위」 | fal 경유 때와 같다(§3). 받은 그림을 이미지 생성 모델의 학습 씨앗으로 쓰지 않는다 |
| 「자동으로 또는 프로그래밍 방식으로 데이터나 출력(아래에 정의됨)을 추출하는 행위」 | 웹 화면을 스크립트나 브라우저 자동화로 돌려 그림을 받지 않는다. 생성은 사람이 웹에서 직접 한다 |

## 3. 생성에 붙는 제약 — fal 경유

약관이 금지하는 것 중 이 프로젝트에 실제로 걸리는 것은 둘이다.

> use or access any Third-Party Materials or any outputs derived from such materials to develop, modify, fine-tune, or improve any products or services that compete with those Third Party Materials, including to develop, fine-tune, or train any artificial intelligence or machine learning algorithms or models
> — fal.ai Terms of Service §14 (2026-07-31판, 2026-08-20 확인)

fal이 호스팅하는 모델은 전부 여기서 말하는 Third-Party Materials다. 따라서 **fal에서 받은 이미지를 다른 이미지 생성 모델의 학습·파인튜닝 씨앗으로 쓸 수 없다.** 로컬 스타일 LoRA를 다시 굽게 되더라도 씨앗은 로컬 생성분으로 한정한다.

> generate or use content in a way that replicates or closely mimics the original assets used to train any AI incorporated into Third Party Materials.
> — fal.ai Terms of Service §14 (2026-07-31판, 2026-08-20 확인)

특정 작가의 그림이나 기존 지식재산을 겨냥해 뽑는 것을 막는 조항이다. 레퍼런스로 넣는 이미지의 출처를 가리라는 요구가 취향이 아니라 약관에서도 나온다는 뜻이며, 그 요구 자체는 §1이 가리키는 아트 방향 정본이 소유한다.

**우리가 넣은 것에 대한 책임은 우리가 진다.** 약관 §17이 Customer Input이 제3자 권리를 침해한다는 주장에 대해 이용자가 fal을 면책하도록 정한다. 편집에 레퍼런스 이미지를 넣는 지금 방식에서는 이 조항이 실제로 작동하는 자리가 있다.

## 4. 출력물의 권리 — 약관은 답하지 않는다

fal 약관에서 소유권을 명시하는 문장은 하나뿐이고, 그 대상은 우리가 **넣은 것**이다.

> Subject to the license granted to Company in this Agreement, Customer owns and retains all right, title, and interest in and to the Customer Input.
> — fal.ai Terms of Service §6(c) (2026-07-31판, 2026-08-20 확인)

Output Content에 대응하는 문장은 약관 어디에도 없다. 상업적으로 쓸 권리는 파트너 계약이 주지만, **그 결과물이 누구 것인지는 계약이 정해 주지 않는다.** 유료 스킨을 파는 관점에서 이것이 뜻하는 바는 하나다 — 제3자가 우리 스프라이트를 그대로 가져다 써도 fal 약관에서는 들 근거가 나오지 않는다. 근거가 생기는 자리는 사람 손이 더해진 부분이고, 그 논지는 §1이 가리키는 아트 방향 정본이 이미 든다. **이 문단은 "찾았는데 없더라"를 기록해 두는 것이 목적이다.** 적어 두지 않으면 다음 사람이 같은 조사를 처음부터 반복한다.

**ChatGPT 웹은 이 점이 다르다.** OpenAI 이용약관은 출력의 권리를 이용자에게 양도한다고 적는다(§2.3). 다만 그 양도도 독점을 주지는 않으므로, 근거가 생기는 자리가 사람 손이 더해진 부분이라는 위 결론은 두 경로에서 같다.

**우리 입력에서 파생된 익명 데이터는 fal의 모델 개발에 쓰일 수 있다.** 약관 §2가 Usage Data를 "익명화 또는 집계된 데이터로서 Customer Input에 기반하거나 그로부터 파생된 것을 포함할 수 있다"고 정의하고, §6(d)가 그 Usage Data를 자사 AI 모델의 설계·개발에 쓸 수 있다고 정한다. 우리가 넣은 이미지 자체를 학습에 쓴다는 조항은 아니지만 — §6(a)의 라이선스는 목적이 서비스 제공으로 한정된다 — 파생 데이터 축은 열려 있다.

## 5. 워터마크와 생성 증빙

fal은 자사 호스팅 애플리케이션이 만든 매체 전부에 두 가지를 넣는다고 밝힌다.

> Every piece of media generated through fal's hosted applications is signed with Content Credentials (C2PA) — an open, industry-standard cryptographic signature — and embedded with an invisible watermark.
> — [fal.ai Verify](https://fal.ai/verify) (2026-08-20 확인)

레포에서 실제로 확인된 것은 이렇다. `art-source/player/2026-08-06/`에 내려받아 둔 원본 넉 장은 전부 PNG의 C2PA 매니페스트 청크(`caBX`)를 달고 있고, 배경을 지우고 잘라 낸 뒤의 산출물과 게임에 실린 PNG에는 그 청크가 없다. **후처리와 재저장이 C2PA 서명을 벗겨 낸다.**

**비가시 워터마크가 후처리를 견디는지는 확인되지 않았다.** 픽셀에 실리는 방식이라 메타데이터와 달리 크롭·재저장을 통과할 수 있지만, 우리 쪽에서 검출할 수단이 없다. 확인되지 않았다는 사실 자체를 여기 적어 둔다 — 살아 있다면 배포본이 AI 생성물로 검출 가능하다는 뜻이고, 그것은 §6의 고지 의무와 같은 방향이라 불리하지 않다.

**서명을 벗겨 내는 것 자체는 약관 위반이 아니다.** 고지 제거를 금지하는 조항이 있으나 대상이 다르다.

> remove, alter, or obfuscate any copyright, trademark, or other proprietary rights notices included with the Services or Documentation
> — fal.ai Terms of Service §6(e)(5) (2026-07-31판, 2026-08-20 확인)

대상이 서비스와 문서이지 Output Content가 아니다. 그러므로 편집 과정에서 메타데이터가 사라지는 것은 이 조항에 걸리지 않는다.

**대신 원본을 남긴다.** 서명이 붙은 원본이 있으면 그 그림을 언제 어느 서비스가 만들었는지 나중에 증명할 수 있다. 보관 위치와 규칙은 §1이 가리키는 사양서가 소유한다. **파생물에 provenance를 이어 붙이는 작업은 하지 않는다** — C2PA는 편집본에 원본을 재료로 기록하는 방식을 지원하지만, 그 도구를 파이프라인에 넣는 비용보다 원본 폴더가 증빙을 드는 편이 싸다.

## 6. 팔 때 신고하는 것

**Steam.** 배포 전 콘텐츠 설문에 AI 사용을 기재해야 하고, 그 내용이 스토어 페이지에 공개된다.

> AI disclosure section, where you'll need to describe how you are using AI in the development and execution of your game.
> — [Valve, Steamworks 공지](https://steamcommunity.com/groups/steamworks/announcements/detail/3862463747997849619) (2026-08-20 확인)

**itch.io.** 프로젝트 편집 화면의 AI Disclosure 항목으로 표기한다. 표기하지 않으면 목록에서 내려갈 수 있다.

> we are strictly enforcing disclosure for all game asset pages due to legal ambiguity around rights associated with Generative AI content. Failure to tag your asset page may result in delisting.
> — [itch.io Quality guidelines](https://itch.io/docs/creators/quality-guidelines) (2026-08-20 확인)

둘 다 **제출 시점에 하는 일**이므로 실제 작업은 출시 준비에서 한다. 여기서 못 박는 것은 그 의무가 존재한다는 사실과, 우리 게임이 대상이라는 판단이다 — 아트가 생성 AI 산출물이므로 두 상점 모두 표기 대상이다.

## 7. 이 판정이 낡는 방식

세 가지가 각각 다른 속도로 낡는다.

- **약관은 개정된다.** fal 약관은 최신 수정일을 문서 머리에 표시하므로, 위 인용을 다시 확인할 때 그 날짜부터 본다.
- **도구의 기본값이 바뀐다.** §2.1의 rembg가 그 사례다. 라이선스가 바뀐 것이 아니라 **기본으로 고르는 모델이 바뀌어** 조건이 달라졌고, 이런 변화는 약관을 다시 읽어도 안 보인다. 도구를 갱신할 때 무엇이 기본값인지 함께 본다.
- **상점 정책이 바뀐다.** 고지 의무는 최근 몇 년 사이에 생긴 것이라 형태가 계속 움직인다.

**약관 전문을 레포에 떠 두지 않는다.** 이 레포는 공개이고 제3자 약관은 그쪽의 저작물이라, 전문을 커밋하는 것은 재배포가 된다. 대신 판단의 근거가 된 조항을 위와 같이 **원문 그대로 인용하고 URL과 확인 날짜를 함께 단다.** 이 문서의 git 이력이 그 인용을 언제 적었는지를 보증한다.
