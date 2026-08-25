# 2단계: 4방향 턴어라운드 시트 생성 프롬프트

> **목적:** 1단계 채택 이미지를 입력(참조)으로 하여, 동일 인물을 유지하면서 4방향(정면·후면·좌측면·우측면)으로 확장한 턴어라운드 시트 생성  
> **사용 환경:** fal.ai Sandbox → `openai/gpt-image-2/edit` (1단계 채택 이미지를 Reference로 입력)

---

## 📌 핵심 제약 및 사전 확인사항

- **동일 인물 유지 (새 캐릭터 생성 금지)**: 새 캐릭터를 그리는 것이 아니라 1단계 원본 캐릭터의 얼굴/머리/의상/색상/비율을 100% 동일하게 유지합니다.
- **4등신 비율 고정 (`four-heads-tall`)**: 절대 변경 금지 (더 커지거나 다리가 길어지지 않도록 강제).
- **시트 내 크기 및 발 위치 일치**: 4방향 모두 캐릭터의 전체 높이, 머리 크기, 발의 수평 정렬선(Ground alignment)이 완벽히 일치해야 합니다.
- **뒷모습 (Back View)**: 얼굴이 보여서는 안 됨 (시선 돌림 금지, 뒷머리와 뒷모습만 노출).
- **좌/우 측면 (Side/Three-Quarter View)**: 완전한 90도 옆모습보다는 게임용 3/4 측면 뷰.
- **지팡이 및 손 유지**: 1단계와 동일한 손에 지팡이를 쥐고 있어야 하며, 몸을 가리지 않고 자연스럽게 분리되어야 함.
- **파츠 분리성 유지**: 팔이 몸에 합쳐지거나 파츠가 융합되지 않도록 명확한 실루엣 유지.
- **추가 요소 배제**: 새 장식/마법 이펙트/악세서리 추가 금지, 2.5단계(삭발/맨살) 변형은 포함하지 않음.

---

## 📝 2단계 프롬프트

```text
Use the provided image as the PRIMARY AND AUTHORITATIVE CHARACTER REFERENCE.

Create a single four-direction turnaround sheet of the EXACT SAME CHARACTER from the reference image.

Do NOT redesign the character.
Do NOT reinterpret the character.
Do NOT create a new character.

The reference image defines the character's identity, face, hair, skin tone, body proportions, clothing, clothing colors, gloves, boots, staff, hand shapes, and overall visual style. Preserve these elements exactly.

## ABSOLUTE PROPORTION LOCK
The character is EXACTLY FOUR-HEADS-TALL.
The vertical distance from the crown of the head to the bottom of the chin is exactly one quarter of the total vertical distance from the crown of the head to the bottom of the boots.
This is a chibi/SD character with a large head and very short legs.
DO NOT convert the character into realistic human proportions.
DO NOT make the character taller.
DO NOT lengthen the legs.
DO NOT change the head-to-body ratio.

All four views must preserve exactly the same four-head-tall body proportions as the reference image.
The character's overall height, head size, torso size, leg length, arm length, hand size, boot size, and staff scale must remain consistent across all four views.

## REQUIRED FOUR VIEWS
Create exactly four views of the same character:
1. FRONT VIEW
2. BACK VIEW
3. LEFT SIDE / LEFT THREE-QUARTER VIEW
4. RIGHT SIDE / RIGHT THREE-QUARTER VIEW

Arrange the four views horizontally as one clean turnaround sheet.
All four characters must have exactly the same overall height and visual scale.
Their feet must rest on exactly the same horizontal ground alignment.
Their heads must align at the same vertical height.
Their overall character centers must remain consistently aligned.
Do not allow one view to become larger or smaller than another.
Do not allow one view to stand higher or lower than another.
Do not crop any character.

## IDENTITY PRESERVATION
The FRONT VIEW must remain the same character as the reference image.
The face, eyes, nose, mouth, hair color, skin tone, clothing colors, gloves, boots, body proportions, and staff must remain unchanged.
The three additional views must represent the SAME PERSON from different directions.
Do not introduce a different face.
Do not change the hairstyle design.
Do not change the clothing design.
Do not change the clothing colors.
Do not change the body proportions.
Do not make the character older or younger.
Do not add accessories.
Do not redesign the staff.
Do not add decorative elements.

## FRONT VIEW
Preserve the reference front view as closely as possible.
Do not redesign or regenerate the front view unnecessarily.
The front view is the identity anchor for all other views.

## BACK VIEW
The back view must show the back of the EXACT SAME CHARACTER.
The character's face must NOT be visible from the back.
Do NOT use a three-quarter back pose that reveals the face.
Do NOT turn the head toward the viewer.
The back of the head, back of the hair, back of the tunic, back of the pants, back of the gloves, and back of the boots must be consistent with the front-view character.
The body remains upright and naturally aligned.
The torso and lower body must face exactly the same direction.
Do not twist the upper body relative to the hips.
The back view must still preserve the same four-head-tall silhouette.
The staff remains in the same hand as in the reference character.
The staff must remain clearly identifiable as the same plain wooden staff.

## LEFT SIDE / LEFT THREE-QUARTER VIEW
Create a natural left-side three-quarter character view derived from the reference character.
Do not create an extreme perspective view.
Do not make the head dramatically larger because of perspective.
Do not stretch or compress the body.
The entire body must rotate consistently.
The head, shoulders, torso, hips, legs, and feet must all correspond to the same left-facing orientation.
Do not twist the torso independently from the hips.
The character's anatomy must remain coherent.
The character still has exactly two arms and two hands.
The staff remains in the SAME HAND as in the reference.
The staff remains a separate object.
The staff must be held naturally by the correct hand.
The staff must not float.
The staff must not pass through the body.
The staff must not disappear.
The staff must remain clearly visible as a single vertical wooden staff.

## RIGHT SIDE / RIGHT THREE-QUARTER VIEW
Create the corresponding natural right-side three-quarter view of the same character.
The entire body must rotate consistently.
The head, shoulders, torso, hips, legs, and feet must correspond to the same right-facing orientation.
Do not twist the torso independently from the hips.
The character still has exactly two arms and two hands.
The staff remains in the SAME HAND as in the reference.
The staff must be held naturally by the correct hand.
The staff must not float.
The staff must not pass through the body.
The staff must remain clearly visible as a single vertical wooden staff.

## ARM AND HAND CONSISTENCY
Preserve the exact hand shapes established by the reference image.
The staff-holding hand remains a relaxed half-grip.
It must NOT become an open hand.
It must NOT become a closed fist.
The empty hand remains gently curled inward.
It must NOT become an open hand.
It must NOT become a fist.
Do not redesign the fingers.
Do not spread the fingers widely.
Do not merge the fingers into another hand.
Exactly two arms.
Exactly two hands.
No third hand.
No extra arm.
No missing arm.
No duplicated limb.
No fused hands.
No hand growing from the torso.
No hand appearing behind the hip without a corresponding arm.
In side views, natural occlusion by the torso is allowed where physically necessary, but the hidden arm must still be anatomically present and correctly connected to its shoulder.

## STAFF SEPARATION
The staff is a separate visual component.
It must NOT be baked into the torso.
It must NOT cross the chest.
It must NOT cross the abdomen.
It must NOT cross the hips.
It must NOT be fused with the clothing.
It must remain a single plain wooden staff without ornament.
Do not add a magical crystal.
Do not add a glowing orb.
Do not add flames.
Do not add decorations.
Do not create a second staff.

## CLOTHING PRESERVATION
The tunic remains SHORT.
Its hemline remains at the waist, immediately above the belt.
The tunic must NOT extend over the hips or thighs.
The entire belt remains visible in views where it is physically visible.
Do not turn the tunic into a dress or skirt.
The pants remain dark brown.
The boots remain medium leather brown.
The boots remain ankle boots.
Do NOT extend the boots toward the calves.
The sleeves remain short sleeves.
Do not convert the sleeves into long sleeves.
The fingerless gloves remain fingerless gloves.
Do not add armor.
Do not add jewelry.
Do not add belts, pouches, capes, scarves, or accessories that are not present in the reference.

## HAIR CONSISTENCY
The character retains the same long scarlet hair.
The hair must remain consistent with the reference from every direction.
Do not shorten the hair.
Do not add a new hairstyle.
Do not add a ponytail unless it already exists in the reference.
Do not add hair accessories.
The hair must not completely hide the shoulders or clothing boundaries.
In the back view, naturally show the back of the long hair.
In the side views, maintain a clean readable separation between hair, shoulders, arms, and clothing.

## POSE
Use a simple standing idle pose.
Both feet remain on the same horizontal ground alignment.
Do not introduce walking, running, attacking, casting, jumping, leaning, crouching, or dynamic poses.
All four views represent the same neutral standing pose.
Do not change the leg stance between views.
Do not move the feet independently between views.
Do not change the distance between the feet.
The pose must be consistent enough that the four views could later be used as separate directional sprite references for the same skeletal character.

## ASSET AND LAYERING REQUIREMENTS
This turnaround sheet is an intermediate SOURCE for later 2D skeletal animation and wardrobe/ equipment replacement.
The goal is not a polished illustration.
The goal is consistent, clean, separable character construction.
Do not hide important anatomy behind clothing, hair, hands, or the staff unless that occlusion is physically unavoidable in the requested view.
Do not invent missing anatomy.
Do not erase limbs because they are partially hidden.
Do not fuse arms into the torso.
Do not fuse hands into clothing.
Do not fuse the staff into the hand or body.
Maintain clear, readable silhouettes.

## SHEET CONSISTENCY
All four views must have:
* identical character height
* identical four-head-tall proportions
* identical head size
* identical leg length
* identical boot size
* identical overall scale
* identical ground alignment
* identical visual weight
* identical color palette
* identical character identity

Do not allow the side views to become taller.
Do not allow the back view to become shorter.
Do not allow perspective to significantly alter body proportions.
Do not allow the front view to be regenerated into a different character.

## BACKGROUND
Use the same completely uniform flat gray background as the reference.
The entire sheet background must be one consistent flat gray.
No gradient.
No texture.
No stains.
No noise.
No vignette.
No corner darkening.
No lighting variation in the background.
No environment.
No ground plane.
No ground shadow.
No ground line.

## FORBIDDEN ADDITIONS
No second character.
No second staff.
No second weapon.
No sword.
No wand.
No shield.
No magical effects.
No flames.
No glow.
No particles.
No aura.
No jewelry.
No hat.
No hood.
No cap.
No headband.
No new accessories.
No text.
No labels.
No frame.
No border.
No watermark.

## MOST IMPORTANT INSTRUCTION
Treat the supplied reference image as the locked source of truth for the character.
Generate the three additional views by rotating and reconstructing THIS SAME CHARACTER, not by inventing three similar characters.
Preserve the exact four-head-tall chibi/SD proportions, character identity, clothing design, colors, hand shapes, staff, and overall silhouette.
The front view is the identity anchor.
The back view must truly show the back.
The left and right views must truly show the corresponding sides.
All four views must be consistent enough to become the four directional source images for the same 2D game character.
Do not create any bald version or skinless/bare-skin version at this stage.
```

---

## 💡 3/4 측면 각도 수정 및 정측면 전환 이유

이전 프롬프트에서 `LEFT SIDE / LEFT THREE-QUARTER VIEW`, `RIGHT SIDE / RIGHT THREE-QUARTER VIEW`라고 명시했던 이유는 게임의 탑다운 캐릭터에서 완전한 정측면보다 약간 3/4 각도가 더 자연스럽게 보일 수 있기 때문이었습니다.

하지만 현재 **「monster」** 파이프라인의 목적에는 3/4 각도를 넣는 것이 오히려 좋지 않습니다.

### 1. 수정이 필요한 이유

현재 4방향은 다음과 같이 명확한 방향별 스프라이트 원본이어야 합니다:
- **정면:** `↓`
- **뒷면:** `↑`
- **왼쪽:** `←`
- **오른쪽:** `→`

그런데 좌우를 3/4 각도로 제작하면 다음과 같이 방향이 왜곡됩니다:

```text
       뒤 ↑
         │
좌측 ↖  캐릭터  ↗ 우측
         │
       정면 ↓
```

- **방향성 왜곡:** 좌측 이동인데 캐릭터가 약간 정면(↖)을 바라보고 있는 것처럼 보입니다.
- **파츠 앞뒤 관계 임의 재구성:** 3/4 각도에서는 AI 모델이 팔·손·지팡이의 앞뒤 관계(Z-order)를 임의로 재구성할 가능성이 커집니다.
- **Spine 리깅 원본 목적:** 일반 일러스트가 아니라 Spine에 붙일 방향별 원본이 목적이므로, 애매한 3/4보다 정확한 방향성이 훨씬 중요합니다.

### 2. 수정 방향 (정확한 좌/우 측면)

- **좌측:** 정확한 좌측면
- **우측:** 정확한 우측면

단, 여기서 말하는 좌우는 **캐릭터 기준**으로 명확히 해야 합니다:
- `Character's left-facing view`: 캐릭터가 왼쪽을 바라봄
- `Character's right-facing view`: 캐릭터가 오른쪽을 바라봄
- 머리, 얼굴, 가슴/골반, 다리 전체가 일관되게 해당 방향을 향함
- 상체와 하체가 서로 다른 방향을 바라보지 않음
- 정면을 향한 3/4 각도 금지

> [!NOTE]
> 완전한 옆모습이라고 해서 신체가 2D 선처럼 납작해져서는 안 됩니다. 캐릭터의 기존 4등신 체형과 볼륨을 유지하면서 방향만 정확히 90° 돌린 형태가 되어야 합니다.

### 3. 결론

이 수정은 상당히 중요하므로, 이전 프롬프트의 three-quarter 관련 문구는 제거하는 것이 좋습니다.  
즉, 다음 단계에서는 제가 만든 2단계 프롬프트를 그대로 쓰지 말고 **`LEFT SIDE` / `RIGHT SIDE`를 정확한 좌우 측면으로 다시 작성**하는 것이 맞습니다. 특히 팔/지팡이의 앞뒤 관계까지 포함해서 다시 만드는 편이 안전합니다.