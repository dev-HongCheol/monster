# 지팡이 없는 시트 셋을 뽑았다 — 밑판을 입력으로 주는 방식으로 갈아탔다

- **작성일:** 2026-08-24
- **브랜치:** `feat/staff-layer`
- **상태:** 완료 — 시트 셋 확정. 이어지는 열두 장 교체는 `build.ts`가 든다
- **계획:** [`2026-08-23-staff-layer-plan.md`](2026-08-23-staff-layer-plan.md) §5·§6
- **정본:** [`art-generation-playbook.md`](../../design/spec/art-generation-playbook.md) §8.2 — 이 회차에서 확정한 생성 방식(밑판을 입력으로 주고 그 위에 얹거나 벗긴다)과 손 판정 셋, 받은 시트를 재는 항목이 그리로 갔다. 배경이 단색이 아닐 수 있다는 사실은 코드가 든다 — `tools/art/SheetCrop.ts`의 `rowBackground` 주석이다
- **실비:** $0.333 (`openai/gpt-image-2/edit` × 3회, 컷당 $0.111). 실패한 회차 둘이 여기 포함된다

---

## 1. 무엇을 받았나

| 파일 | 무엇 | 입력 |
|---|---|---|
| `art-source/player/2026-08-23/4dir_bald_nostaff.png` | 옷 + 삭발, 지팡이 없음 | `2026-08-06/4dir_bald.png` |
| `art-source/player/2026-08-23/4dir_dressed_nostaff.png` | 옷 + 긴 머리, 지팡이 없음 | `2026-08-23/4dir_bald_nostaff.png` |
| `art-source/player/2026-08-23/4dir_skin_nostaff.png` | 최소 운동복 + 삭발, 지팡이 없음 | `2026-08-23/4dir_bald_nostaff.png` |

**입력 계보가 계획과 다르다.** 계획 §5는 세 시트를 각각 자기 원본에서 편집해 받을 작정이었는데, 그 방식으로 받은 `dressed`가 떨어졌다(§3). 그래서 `bald` 하나를 축으로 삼고 나머지 둘을 거기서 파생시키는 방식으로 갈아탔다.

### 1.1 공통 설정

| 항목 | 값 |
|---|---|
| 엔드포인트 | `openai/gpt-image-2/edit` |
| Aspect Ratio | 16:9 |
| 시드 | 없음 |
| 나온 크기 | 1088×608 (세 장 모두) |
| 컷당 실비 | $0.111 |

**Aspect Ratio를 16:9로 둔 것이 이번에 확인된 값이다.** 2026-08-06 기록은 1단계의 3:4만 남기고 2단계 칸을 안 적어 뒀는데, 이번에 그 자리에서 헤맸다. 4방향 시트는 인물 넷이 나란히 서므로 가로가 길고, 편집 회차도 입력의 프레이밍을 유지해야 하므로 같은 값을 쓴다.

**크기가 입력과 같아야 하는 이유는 후처리가 확대·축소를 안 하기 때문이다.** `alignToCanvas`는 평행 이동만 하므로 시트 안의 인물 세로가 그대로 출하 캔버스의 트림 세로가 된다. 캔버스 493에 발 밑선 여백 3이면 상한이 490이라, 시트가 크게 나오면 열두 장이 전부 정렬에서 멈춘다.

## 2. 프롬프트 전문

### 2.1 `bald` — 원본에서 지팡이만 지운다

입력 한 장: `2026-08-06/4dir_bald.png`

```
Using this exact same 4-view turnaround sheet as the reference, redraw the same
character in the same four views — front view, back view, left side view, right
side view — removing only the staff.

There is no staff anywhere in the image: no wooden shaft, no tip, no shadow of
it, and no part of it behind her body. Wherever the staff used to cross her body
or her head, draw what is behind it complete and unbroken. Her right hand keeps
the exact same half-closed grip it has now, curled as if it were still holding a
shaft as thick as the staff was: the fingers stay curled and stay separated from
one another, the opening inside the grip stays open, and the hand neither closes
into a fist nor opens flat. Her left hand keeps the exact same shape and the
exact same position it has now.

Everything else must stay exactly the same: the same face and the same facial
features, the same completely bald head with bare scalp skin and no hair at all,
the same skin tone, the same clothes and their colors, the same fingerless
gloves, the same four-head-tall proportions, the same pose with the same arm
positions, the same scale and the same ground line in all four views.

Plain flat gray background. Do not include any staff, wand, rod, stick, sword,
weapon, tool, hat, hood, cap, headband, wig, fire, glow, particles or ground
shadow. No frame, no border, no text, no watermark. Only one character.
```

### 2.2 `dressed` — 밑판에 머리카락을 얹는다

입력 한 장: `2026-08-23/4dir_bald_nostaff.png`

```
Using this exact same 4-view turnaround sheet as the reference, redraw the same
character in the same four views — front view, back view, left side view, right
side view — adding hair and changing nothing else.

She now has long wavy scarlet hair, parted in the middle, with a fringe that
splits to either side of her forehead. It falls over her shoulders and down her
chest at the front, covers her whole back, and reaches down to her hips. The
ends are wavy and taper into loose points. The scarlet is the same deep red as
her hair was before she was drawn bald.

The hair rests on top of her scalp, so the top of her head rises only two or
three pixels above where it is now, and it rises by that same small amount in
all four views. Nothing below her chin moves.

Everything else must stay exactly as it is in the reference. Keep her body, her
face and facial features, her skin tone, her clothes and their colors, her
fingerless gloves, her boots, her pose, her arm positions, her hand shapes, her
scale, her position inside the frame and the line she stands on identical to the
reference. Do not redraw her, do not resize her, do not move her, do not
lengthen or shorten her legs, and do not change the size of her boots. Her feet
stay exactly where they are.

All four views must stay the same size as each other, exactly as they are in the
reference.

There is no staff anywhere in the image. Her right hand keeps the exact
half-closed grip it has in the reference, with the opening inside the grip still
open; it neither closes into a fist nor opens flat.

Plain flat gray background, the same gray as the reference. Do not include any
staff, wand, rod, stick, sword, weapon, tool, hat, hood, cap, headband, fire,
glow, particles or ground shadow. No frame, no border, no text, no watermark.
Only one character.
```

### 2.3 `skin` — 밑판에서 옷과 신발을 벗긴다

입력 한 장: `2026-08-23/4dir_bald_nostaff.png`

```
Using this exact same 4-view turnaround sheet as the reference, redraw the same
character in the same four views — front view, back view, left side view, right
side view — changing only what she wears.

She now wears minimal plain gray sportswear: a simple gray band across her chest
and short gray shorts, and nothing else. Her arms, shoulders, upper chest, upper
back, belly, waist, hips and thighs are all bare skin and covered by nothing.
Her hands are bare skin with every finger drawn separately and she wears no
gloves. She is barefoot, with no boots and no socks, and her toes are drawn.

Because her boots are gone she now stands on her bare soles, so she becomes
slightly shorter than in the reference — and shorter by that same small amount
in all four views.

Everything else must stay exactly as it is in the reference. Keep her body, her
face and facial features, her bald head with bare scalp, her skin tone, her
pose, her arm positions, her hand shapes, her scale and her position inside the
frame identical to the reference. Do not redraw her, do not resize her, do not
move her, and do not lengthen or shorten her legs.

All four views must stay the same size as each other, exactly as they are in the
reference.

There is no staff anywhere in the image. Her right hand keeps the exact
half-closed grip it has in the reference, with the opening inside the grip still
open; it neither closes into a fist nor opens flat.

Plain flat gray background, the same gray as the reference. Do not include any
staff, wand, rod, stick, weapon, tool, glove, boot, shoe, sock, hat, hood, cap,
headband, wig, fire, glow, particles or ground shadow. No frame, no border, no
text, no watermark. Only one character.
```

## 3. 왜 방식을 갈아탔나 — 첫 `dressed`가 떨어졌다

계획대로 원본 `dressed`에서 지팡이만 지워 받은 첫 판은 **네 방향이 서로 다른 크기로 나왔다.**

| | front | back | left | right | 편차 |
|---|---|---|---|---|---|
| 원본 `dressed` | 488 | 486 | 483 | 483 | 5px |
| **첫 시도** | 478 | 497 | 501 | **502** | **24px** |
| 밑판에서 다시 받은 판 | 480 | 482 | 479 | 480 | **3px** |

**지팡이와 손과 머리카락은 첫 판도 전부 통과했다.** 지팡이가 깨끗이 사라졌고, 지팡이가 지나던 자리의 머리카락도 메워졌으며, 쥔 손의 구멍이 열린 채 유지됐고 손가락도 살아 있었다. 떨어진 것은 크기 하나다.

**원인은 지시문의 형태에 있다.** 「지팡이를 지워라」는 그림 전체를 다시 그리게 하는 지시라, 모델이 몸까지 다시 잡을 여지가 열려 있다. 실제로 방향마다 다리 길이와 부츠 크기가 달라졌다. 반대로 「이 몸에 머리카락만 얹어라」는 몸을 입력에 묶으므로 다시 그릴 이유가 없어진다. 같은 문장을 넣어 둔 「the same scale in all four views」는 첫 판에서도 있었지만 듣지 않았다 — **모델에게 지키라고 말하는 것보다 어길 여지를 없애는 편이 강하다.**

**두 시트를 입력으로 주는 방식은 쓸 수 없었다.** 밑판과 머리카락 참조를 함께 주면 가장 정확하겠지만, 쓰는 화면이 참조 이미지를 한 장만 받는다. 그래서 밑판을 이미지로 주고 **머리카락은 문장으로** 기술했다.

**그 대가로 머리카락 볼륨이 줄었다.** 원본은 얼굴 옆으로 크게 부풀고 어깨 앞으로 두껍게 흘러내리는데, 새 판은 얼굴에 붙어 가늘게 내려오고 이마가 더 드러난다. 받아들인 이유가 둘이다 — v1은 96px로 표시되어 이 차이가 사실상 안 보이고, v2에서 머리카락은 갈아 끼울 레이어라 원본과 같아야 할 이유가 없다.

## 4. 층 관계가 이번에 처음으로 성립했다

**이 항목은 사용자가 먼저 짚었다(2026-08-24).** 세 시트는 「같은 몸에 레이어를 더한 것」이어야 한다 — `skin`이 밑판이고, `bald`는 거기에 신발이 붙어 그만큼 커지고, `dressed`는 다시 머리카락이 얹힌다. v2에서 스킨마다 높이가 달라지므로(뾰족한 머리, 굽 높은 신발) 밑판인 `skin`이 가장 작아야 한다.

재 보니 **원본부터 그 관계가 깨져 있었다.**

| | `bald − skin` (front/back/left/right) | 편차 |
|---|---|---|
| 원본 (2026-08-06) | −4 / −5 / −6 / −6 | 2px |
| 첫 시도 | −10 / −9 / −10 / −10 | 1px |
| **이번 확정본** | **+30 / +31 / +31 / +30** | **1px** |

원본과 첫 시도는 **부호가 반대다.** 부츠를 신은 `bald`가 맨발인 `skin`보다 오히려 작았다 — 모델이 부츠를 그리면서 다리를 그만큼 짧게 그렸다는 뜻이고, 세 시트가 같은 몸이 아니라 각각 따로 그려졌다는 증거다. 이번에는 `skin`을 `bald`에서 파생시켜 받았으므로 신발 두께만큼 균일하게 갈렸다.

**남은 어긋남 둘은 적어 둔다.**

- `dressed − bald`가 −4 / 0 / −3 / −1이다. 머리카락을 얹었으니 0~2px 커야 하는데 오히려 조금 작다. 96px 표시로는 0.8px이라 실용상 넘겼다
- 머리 폭이 `skin` 115 대 `bald` 120으로 4% 다르다. `skin`을 `bald`에서 파생시켰는데도 남았다 — 확산 모델은 픽셀 정합을 보장하지 않는다. 파츠 컷에서 얼마나 문제인지는 실제로 잘라 봐야 알 수 있어 리깅 슬라이스로 넘긴다

## 5. 배경이 단색이라는 전제가 깨졌다

`skin` 시트의 배경에 **세로 그라데이션**이 있었다. 위가 176이고 아래가 185로, 좌상 모서리를 배경으로 잡으면 아래쪽 배경이 거리 22까지 멀어진다. `panelColumns`의 임계값이 24라 아래쪽 배경이 전경으로 잡혔고, 인물 구간이 넷이 아니라 **열한 개**로 쪼개졌다.

**고칠 자리는 시트가 아니라 검출이다.** 생성 모델이 균일한 배경을 준다는 보장이 없으므로, 시트마다 사람이 눈으로 확인하게 두면 언젠가 놓친다. `panelColumns`에 `rowBackground` 옵션을 붙여 **행마다 캔버스 양 끝에서 배경을 다시 잡게** 했다 — 인물이 캔버스 끝까지 오는 시트는 없으므로 그 두 점은 언제나 배경이고, 세로로 변하는 밝기를 그대로 따라간다. 고친 뒤 같은 시트에서 구간이 정확히 넷으로 나왔다.

세 시트의 배경 상하 차는 `skin` 16, `dressed` 5, `bald` 2였다. 같은 세션에서 받은 셋인데도 갈렸다.

## 6. 확정 실측

| 시트 | front | back | left | right | 편차 | 상한 490 |
|---|---|---|---|---|---|---|
| `skin` | 454 | 451 | 451 | 451 | 3px | ✅ |
| `bald` | 484 | 482 | 482 | 481 | 3px | ✅ |
| `dressed` | 480 | 482 | 479 | 480 | 3px | ✅ |

세 장 모두 1088×608이고, 인물 구간이 넷이며, 구간 사이가 35~131열이라 여백 8로 잘라도 옆 인물이 안 딸려 온다.

## 7. 판정 결과

- **지팡이** — 세 시트 모두 완전히 사라졌다. 지팡이가 머리카락 위를 지나던 자리도 메워졌고, 후처리로 걷어낼 때 나던 「자로 그은 듯한 세로 직선」 자국이 없다
- **쥔 오른손이 반쯤 열려 있다** — 감긴 손가락 사이 구멍이 열린 채다. 주먹으로 닫히지도 펴지지도 않았다
- **손가락이 살아 있다** — 핑거리스 장갑 밖으로 넷이 분리돼 있고, `skin`은 맨손으로 나왔다
- **손이 몸통·옷에 안 뭉갰다** — 손과 바지·머리카락 사이에 경계가 보인다
- **인물 동일성** — 눈 모양·눈 색·턱선이 원본과 일치하고 좌·우 3/4 각도가 유지됐다

**축소본으로 판정하면 안 된다.** 이 회차에서 두 번 오독했다. 전체 시트를 축소해 보고 「손이 주먹으로 닫혔다」와 「측면에서 얼굴이 머리카락에 가려졌다」로 읽었는데, 3배로 확대하니 둘 다 정상이었다. 손과 얼굴은 **크롭해서 확대한 뒤** 본다.
