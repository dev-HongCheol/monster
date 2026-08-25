# 1단계: 정면 원본 캐릭터 생성 프롬프트

> **목적:** 이후 4방향 / 변형 / 레이어링(부위 분리)의 기준이 되는 구조적 원본 캐릭터 1장 확정

---

## 📌 핵심 제약 및 사전 확인사항

- **구조적 원본 확립**: 현재 1단계에서 가장 중요한 것은 단순 "예쁜 캐릭터"가 아니라, 이후 v2 단계(부위별 파츠 분리 및 스켈레탈 애니메이션)의 기준이 되는 구조적 원본을 만드는 것입니다.
- **4등신 비율 우선**: "정수리→턱 = 전체의 정확히 1/4"와 "다리 = 전체의 45%" 간의 해석 충돌을 방지하기 위해, 모델에는 **`exactly four-heads-tall`을 최우선**으로 부여하고 다리 45%는 짧은 다리의 시각적 목표를 보조하는 제약으로 설정합니다.
- **손과 지팡이 분리**: 지팡이가 몸과 겹치지 않게 하되, 손은 몸통과는 떨어져 있고 지팡이와는 자연스럽게 접촉하도록 그립 형태를 명시합니다.
- **단일 정면 뷰**: 4방향, 삭발, 맨살 등의 변형은 이 단계에 포함하지 않습니다.

---

## 📝 1단계 프롬프트

```text
The character MUST be EXACTLY FOUR-HEADS-TALL: the vertical distance from the crown of the head to the bottom of the chin is exactly one quarter of the total vertical distance from the crown of the head to the bottom of the boots. This is a deliberately stylized chibi/SD body with a very large head and very short legs, NOT realistic human anatomy. The legs should occupy approximately 45% of the character's total height while preserving the strict four-head-tall proportion.

young woman fire mage, long scarlet hair, amber eyes, fair and pale skin,
short tunic with short sleeves in bright cream orange, pants in dark brown,
ankle boots in medium leather brown, fingerless gloves in dark brick red,
plain wooden staff without ornament

Create exactly ONE full-body FRONT VIEW character.

The character stands upright in a simple standing idle pose, facing directly toward the viewer. The entire body must face forward consistently: head, shoulders, torso, hips, both legs, and both feet all share the same front-facing orientation. No three-quarter view, no side-facing body, no twisted torso, no rotated hips, no perspective pose.

The character's proportions must remain strongly chibi/SD: a large head, compact torso, short legs, and small overall body mass. Do not reinterpret the character as a normally proportioned young woman. Do not use realistic anatomy or elongated legs.

The face must follow the same chibi proportion: large expressive amber eyes, very small nose, and very small mouth. The face must be attractive and clearly anime-styled, but remain compact and consistent with the four-head-tall body.

Both feet must be completely visible inside the image. Do not crop the head, feet, staff, hands, or any other part of the character.

## BODY AND CLOTHING BOUNDARIES
The short tunic has an intentionally VERY SHORT hemline.
The tunic ends exactly at the waistline, immediately ABOVE the belt.
The tunic does NOT extend over the hips.
The tunic does NOT cover the buttocks or thighs.
The tunic does NOT overlap any part of the pants.
The entire belt must be completely visible from left to right.
The pants must begin immediately below the fully visible belt and must be completely drawn from the waist to the boots.
Do not create a long tunic, dress, skirt-like tunic, coat tails, hanging fabric, or any cloth extending over the thighs.
Both legs must remain completely visible and unobstructed.
The legs are short because this is a four-head-tall chibi/SD character, not because clothing hides part of them.

The boots are SIMPLE ANKLE BOOTS.
The boots end immediately around the ankles.
The boots must NOT extend up the calves.
Do not create mid-calf boots, knee-high boots, tall boots, leg armor, or high footwear.
The boundary between bare lower leg and ankle boot must be clearly readable.

The short sleeves must expose the character's lower arms as visible skin. The sleeves must not extend to the wrists.

## HAIR
Keep the long scarlet hair primarily behind the shoulders.
Minimize the amount of hair covering the shoulders, sleeves, upper torso, arms, hands, belt, and tunic.
Do not allow large masses of hair to cover important clothing or body boundaries.
The shoulders and the upper portions of both arms must remain clearly readable.
Do not let the hair merge with the sleeves or torso.

## ARMS AND HANDS
Exactly TWO arms and exactly TWO hands.
Both arms must be fully present from shoulder to hand.
Both arms must remain visually separated from the torso by a small but clearly visible area of gray background.
Do not merge either arm into the torso, tunic, hips, or clothing.

The character holds the ONE staff in her RIGHT hand.
The RIGHT hand is the staff-holding hand.
The right hand must have a relaxed HALF-GRIP around the staff.
The right hand must be neither an open hand nor a closed fist.
The fingers must form a compact, natural half-closed shape around the staff handle, leaving a clear opening through which the staff passes.
The right hand must remain fully readable and must not be hidden behind the torso, hip, tunic, or pants.

The character's LEFT hand is the empty hand.
The left hand must be held slightly away from the torso and gently curled inward.
The left hand must be neither an open hand nor a closed fist.
The left hand must have a complete independent silhouette.
The two hands must never touch or overlap.
The left hand must not touch the torso, hip, clothing, or staff.
The right hand must not touch the left hand.
There must be exactly two hands: no third hand, no duplicated hand, no extra fingers forming another hand, no missing hand.

The fingers must extend outside the fingerless gloves but remain close together as compact readable groups.
Do not spread the fingers widely.
Do not create tiny individually separated fingers that disappear at small game resolution.

## STAFF
Exactly ONE plain wooden staff without ornament.
The staff is held in the RIGHT hand.
The staff stands perfectly VERTICAL beside the character.
The staff must remain completely outside the torso silhouette.
The staff must NOT cross in front of the chest, abdomen, waist, hips, or legs.
The staff must NOT pass through the body.
The staff must NOT overlap the torso or clothing.
Keep a clearly visible strip of flat gray background between the staff and the character's body wherever the staff runs alongside the character.
The staff must remain visually separable as its own independent object.
The staff must not be fused with the character.

No second staff.
No wand.
No sword.
No weapon other than the single plain wooden staff.

## ASSET-SEPARATION REQUIREMENTS
This image is the SOURCE BASE for a later 2D skeletal animation and interchangeable equipment pipeline.
It is NOT a finished illustration intended only for viewing.
Every major body and clothing component must be clearly drawable, recoverable, and separable into independent parts.
Do not use one element to hide another element.
Do not intentionally omit anatomy beneath clothing.
Do not create hidden or fused boundaries that would make later cutting ambiguous.

The following must remain independently readable:
* head
* hair
* face
* torso
* left arm
* right arm
* left hand
* right hand
* belt
* pants
* left leg
* right leg
* left boot
* right boot
* staff

The tunic must not hide the pants.
The pants must be completely drawn underneath the tunic.
The hair must not substantially hide the shoulders or upper clothing.
The arms must not merge with the torso.
The hands must not merge with one another.
The staff must not hide the torso.
The staff must not cross the torso.
The character must not contain any area where an important underlying part is simply missing because another object covers it.

## SILHOUETTE AND GAME-SCALE DESIGN
The character will later be displayed at a small game size, approximately 96 vertical units.
Design the character using LARGE, SIMPLE, STRONG shapes that remain readable after approximately five-times reduction.
Avoid tiny ornaments.
Avoid intricate clothing patterns.
Avoid excessive tiny folds.
Avoid thin decorative straps.
Avoid small accessories.
Avoid highly detailed fingers.
Avoid fragile narrow silhouettes.
The major identity should come from the large silhouette, hair shape, clothing blocks, body proportions, boots, gloves, and large vertical staff.

## ART STYLE
Anime cel shading.
Stylized western high-fantasy color and shape language.
Warm scarlet, dark brown, cream-orange, medium leather brown, brick red, amber, and pale skin should create strong readable color separation.
The character should have a clean, attractive anime face while maintaining the deliberately compressed chibi/SD anatomy.

## BACKGROUND AND OUTPUT
Use one completely uniform flat medium-gray background.
The gray must be identical across the entire image.
No gradient.
No texture.
No vignette.
No corner darkening.
No stains.
No noise.
No pattern.
No environmental background.
No ground plane.
No ground line.
No ground shadow.
No contact shadow.

Do not bake fire or magic effects into the character.
No flames.
No fire aura.
No glow.
No particles.
No magical effects.
No glowing staff ornament.

No frame.
No border.
No text.
No label.
No watermark.

Exactly ONE character.
Exactly ONE staff.
Exactly TWO arms.
Exactly TWO hands.
Exactly TWO legs.
Exactly TWO feet.

## FINAL PROPORTION CHECK
The character MUST remain a strict FOUR-HEAD-TALL CHIBI/SD CHARACTER.
Crown-to-chin = exactly 1/4 of crown-to-bottom-of-boots.
The head must be large.
The legs must be short and approximately 45% of total character height.
Do NOT produce a 5-head, 6-head, 6.5-head, 7-head, or realistic human proportion.
The four-head-tall proportion is the highest-priority constraint in the entire image.

Create only this single front-view character. Do not create multiple views, a turnaround sheet, side views, back views, bald variants, or skinless variants.
```