# 도구·모델 라이선스와 판매 조건

> 이 도구로 만든 것을 팔아도 되나

- **최초 작성:** 2026-08-20
- **상태:** CONFIRMED
- **이력:** 2026-08-20 — 신설

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
| **SDXL 1.0 base + 자체 LoRA** | `player_mage_bridge.png` 한 장(유료 전환 이전) | `openrail++`이고 자체 학습 LoRA를 배포하지 않으므로 게임에 걸리지 않는다. 원문 확인표는 §1이 가리키는 복구 매뉴얼이 든다 | 2026-07-21 |
| **rembg** (로컬) | **과거에 쓴 것** — `player_mage_bridge.png` 한 장의 배경 제거 | 코드는 MIT지만 **모델 가중치는 각자 다른 라이선스**다. 이 장비가 받아 둔 것은 `u2net.onnx` 하나이고 그 출처인 [U-2-Net](https://github.com/xuebinqin/U-2-Net)은 Apache-2.0이라 상업 사용에 문제가 없다. **다만 아래 함정이 있다.** 2026-08-22에 배경 제거가 fal 매팅으로 옮겨 가 이 경로는 더 쓰지 않지만, 근거를 대는 그 PNG가 아직 레포에 추적 중이라 행을 지우지 않는다 | 2026-08-20 · [rembg](https://github.com/danielgatis/rembg) |
| **`bria/background/remove`** (fal) | **지금 쓰는 것** — 캐릭터 배경 제거 | 모델 페이지에 `Commercial use` 표시가 붙는다. BRIA는 자체 배포판이 유료 계약을 요구하지만 **fal 경유에는 그 조건이 붙지 않는다.** 후보 둘을 숫자로 견줘 2026-08-22에 채택했고, 판정 항목은 `art-generation-playbook.md` §8.5가 든다 | 2026-08-20 |
| **fal 배경 제거 대안 2종** | 폴백 | `birefnet/v2` · `imageutils/rembg` 둘 다 모델 페이지에 `Commercial use` 표시가 붙는다. `birefnet/v2`는 품질 판정에서 떨어졌을 뿐 라이선스는 문제없다 | 2026-08-20 |
| **Spine** | 리깅(아직 결제 전) | 에디터 라이선스가 런타임을 제품에 넣을 권한을 함께 준다 — 런타임은 별도 구매가 아니다. 재배포물에 라이선스와 저작권 고지를 포함해야 한다. 등급·요금은 §1이 가리키는 사양서가 든다 | 2026-08-20 · [런타임 라이선스](https://esotericsoftware.com/spine-runtimes-license) |
| **Cocos Creator** | 엔진 | 게임 개발 목적의 사용이 무료이고 로열티가 없다. 사용자 서비스 약관이 유료화 시 사전 공지를 약속한다. 스플래시·크레딧 표기 의무 조항은 없고 상표 사용 제한만 있다 | 2026-08-20 · [약관](https://download.cocos.com/CocosUdc/agreement/Cocos_User_Service_Agreement_en_20220901.html) |
| 폰트 · 사운드 | 아직 없다 | `game/assets/` 아래에 폰트 파일도 오디오 파일도 0개다. 고르는 시점에 이 표에 행이 붙는다 | 2026-08-20 |

### 2.1 rembg를 쓸 때는 모델을 명시한다

`rembg`를 옵션 없이 돌리면 **기본 모델이 `bria-rmbg`**이고, 그 모델은 상업 이용에 유료 계약을 요구한다.

> Note that RMBG-2.0 is released under a BRIA license that requires a paid agreement for commercial use. Model weights carry their own licenses, independent of rembg's MIT license — check the linked source before using any model commercially.
> — [rembg README](https://github.com/danielgatis/rembg) (2026-08-20 확인)

이 기본값은 2026-08-17 커밋으로 바뀐 것이라, 그 전에 처리한 `player_mage_bridge.png`에는 소급되지 않는다.

**이 함정은 2026-08-22에 실효됐지만 절을 남긴다.** 배경 제거가 fal 매팅으로 옮겨 가 로컬 `rembg`를 부를 일이 없어졌기 때문이다. 그래도 지우지 않는 이유는 폴백으로 돌아올 수 있어서다 — 그때 로컬 rembg를 쓴다면 **`-m u2net`을 명시**한다. 명시하지 않으면 도구를 갱신한 날부터 유료 라이선스 모델로 처리되고, 결과 PNG만 봐서는 어느 모델이 만들었는지 구분할 수 없다.

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
