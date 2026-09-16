"""
게이트 0c와 게이트 2 — 걷기를 이 골격에 입히고 프레임을 굽는다.

**리타게팅을 애드온이 아니라 대응표로 한다.** 애드온 프리셋은 실패해도 이유를 안 주지만,
대응표는 어느 본에서 틀어졌는지 이름으로 말할 수 있다. 그리고 애드온을 안 늘리면 Blender
버전이 VRM 애드온이 정한 범위(4.2~5.2)에 그대로 남는다.

**거는 것은 휴머노이드 본뿐이다.** VRoid 아마추어에는 의상의 흔들림 본(`J_Sec_*`)과 눈 보정
본(`J_Adj_*`)이 함께 있는데 모션 쪽에 대응물이 없다. 전부 걸려고 하면 짝이 없는 본에서
실패하고, 그 실패는 골격이 안 맞아서가 아니라 **걸 필요가 없는 것을 걸어서** 난 것이라
원인을 골격에서 찾게 된다.

**카메라는 프레임마다 다시 잡지 않는다.** 프레임별로 상자를 재서 맞추면 팔이 벌어진 프레임과
모은 프레임의 배율이 달라져 캐릭터가 숨 쉬듯 커졌다 작아진다. 그 흔들림은 Cocos에서
「덜컥거린다」로 보여 원인을 재생 설정에서 찾게 만든다. 그래서 굽는 프레임 전체의 상자를
합쳐 한 번만 잡는다.

돌리는 법과 실패 코드 표는 `tools/blender/README.md`에 있다.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import _common as common  # noqa: E402
from math import radians  # noqa: E402
from mathutils import Euler, Quaternion, Vector  # noqa: E402

# 모션 쪽(Quaternius, Unreal 이름 체계) → VRoid 쪽(`J_Bip_*`) 대응.
#
# 두 열 다 2026-09-11에 실측으로 얻었다 — 모션은 `UAL1_Standard.glb`의 본 65개, VRoid는
# 게이트 0b가 뽑은 224개다. 짐작으로 채운 줄이 없다.
BONE_MAP = (
    ('pelvis', 'J_Bip_C_Hips'),
    ('spine_01', 'J_Bip_C_Spine'),
    ('spine_02', 'J_Bip_C_Chest'),
    ('spine_03', 'J_Bip_C_UpperChest'),
    ('neck_01', 'J_Bip_C_Neck'),
    ('Head', 'J_Bip_C_Head'),
    ('clavicle_l', 'J_Bip_L_Shoulder'),
    ('upperarm_l', 'J_Bip_L_UpperArm'),
    ('lowerarm_l', 'J_Bip_L_LowerArm'),
    ('hand_l', 'J_Bip_L_Hand'),
    ('clavicle_r', 'J_Bip_R_Shoulder'),
    ('upperarm_r', 'J_Bip_R_UpperArm'),
    ('lowerarm_r', 'J_Bip_R_LowerArm'),
    ('hand_r', 'J_Bip_R_Hand'),
    ('thigh_l', 'J_Bip_L_UpperLeg'),
    ('calf_l', 'J_Bip_L_LowerLeg'),
    ('foot_l', 'J_Bip_L_Foot'),
    ('ball_l', 'J_Bip_L_ToeBase'),
    ('thigh_r', 'J_Bip_R_UpperLeg'),
    ('calf_r', 'J_Bip_R_LowerLeg'),
    ('foot_r', 'J_Bip_R_Foot'),
    ('ball_r', 'J_Bip_R_ToeBase'),
)

# 이 본에만 위치를 건다. 나머지는 회전만 받는다 — 뼈 길이가 두 골격에서 다르므로 위치를 걸면
# 팔다리가 늘어나거나 관절이 빠진다.
ROOT_BONE = 'pelvis'

# 관절마다 모션을 따르는 비율. 1이면 원본 모션 그대로이고 0.5면 그 관절이 도는 폭이 절반이다.
#
# **원본 모션은 이 체형에 크다.** Quaternius `Walk_Loop`는 성인 걷기이고 리타게팅은 그 비율을 그대로
# 옮긴다. 그래서 머리가 크고 다리가 짧은 캐릭터를 정면에서 보면 흔들림이 과장돼 읽힌다.
# 2026-09-14에 이 캐릭터의 키에 맞춰 잰 원본 모션은 이렇다.
#
# - 다리 — 발을 다리 길이의 30%까지 들고 앞뒤로 80% 가까이 휘두른다. 정면에서는 앞뒤 흔들림이
#   무릎의 오르내림으로만 보여 제자리 행진처럼 읽힌다. `Walk_Formal_Loop`도 무릎 18% · 발 31%라
#   모션을 바꿔서는 풀리지 않는다
# - 몸통 — 허리를 좌우로 4.2cm 옮기면서 골반을 4.9°, 윗가슴을 7° 좌우로 기울이고 윗가슴을 15°
#   비튼다. 머리가 좌우로 3.4cm 흔들리는데, 팔까지 합친 몸 폭이 45cm인 캐릭터라 몸 전체가
#   흔들리는 것으로 읽힌다. 팔은 기준 자세로 고정돼 있어 몸통이 비틀려도 따라가지 않는다
#
# 줄이는 대상은 본마다 **부모에 대해 돌아간 양**이다. 월드 기준 회전을 통째로 줄이면 자식이
# 부모에게서 물려받은 회전까지 함께 줄어, 부모가 튼 만큼 자식이 몸에서 어긋난다.
#
# 루트(허리)의 이동은 둘로 나눠 줄인다. 좌우·앞뒤 이동은 몸통 흔들림이라 `sway`로 줄이고, 위아래
# 오르내림은 허벅지와 같은 비율로 줄인다. 다리를 덜 벌리면 디딘 순간의 다리 높이가 그만큼
# 높아지는데, 허리가 원래 폭대로 내려가면 발이 바닥 아래로 내려가 프레임마다 발 밑선이 흔들린다.
#
# 관절을 이만큼 나눈 것은 사용자 판정을 거친 결과다(2026-09-14). 네 다리 관절을 모두 0.5로 줄인
# 판은 「발목만 움직여 제자리에서 춤추는 것 같다」, 다리만 줄인 판은 「몸 전체가 좌우로 흔들려
# 춤추는 것 같다」는 판정을 받았다. 아래 값은 그 뒤에 몸통 흔들림과 발끝 꺾임을 따로 줄인 후보들
# 가운데 사용자가 고른 것이다.
#
# **비율로는 못 빼는 것이 남는다.** 원본 모션은 발을 몸 가운데로 모았다 벌리는 좌우 흔들림을
# 허벅지 회전 안에 앞뒤 흔들림과 섞어 두었고, 발뒤꿈치를 딛는 순간 발끝을 들어 올린다. 비율은
# 한 관절의 회전 전체를 함께 줄이므로 이 둘만 골라낼 수 없다. 이 값에서도 발목이 좌우로 3.2cm
# 옮겨 가고 발바닥이 카메라 쪽으로 최대 16° 향한다(2026-09-14 실측).
SWING_SCALE = {
    'sway': 0.2,  # 루트의 좌우·앞뒤 이동
    'pelvis': 0.2,
    'spine': 0.2,  # spine_01~03과 쇄골
    'neck': 0.2,  # neck_01과 Head
    'thigh': 0.75,
    'calf': 0.75,
    'foot': 0.35,
    'ball': 0.35,
}

# 흔들림을 줄이는 본의 부모와 비율 이름 — 모션 쪽 이름이다. 부모는 부모에 대해 돌아간 양을 구할 때,
# 비율 이름은 `SWING_SCALE`에서 값을 찾을 때 쓴다. 부모가 `None`이면 정지 자세에서 돌아간 양 전체를
# 줄인다. 부모가 먼저 처리돼 있어야 하는데 `BONE_MAP`이 부모부터 나열돼 있어 그 순서가 보장되고,
# 적어 둔 부모가 모션 골격의 실제 부모인지는 `check_bone_map`이 확인한다.
SWING_CHAIN = {
    'pelvis': (None, 'pelvis'),
    'spine_01': ('pelvis', 'spine'),
    'spine_02': ('spine_01', 'spine'),
    'spine_03': ('spine_02', 'spine'),
    'neck_01': ('spine_03', 'neck'),
    'Head': ('neck_01', 'neck'),
    # 쇄골을 사슬에서 빼면 윗가슴의 회전을 월드 기준으로 통째로 받아서, 척추를 줄여도 어깨만 원래
    # 폭으로 비틀린다. 그래서 척추와 같은 비율로 묶는다.
    'clavicle_l': ('spine_03', 'spine'),
    'clavicle_r': ('spine_03', 'spine'),
    'thigh_l': ('pelvis', 'thigh'),
    'calf_l': ('thigh_l', 'calf'),
    'foot_l': ('calf_l', 'foot'),
    'ball_l': ('foot_l', 'ball'),
    'thigh_r': ('pelvis', 'thigh'),
    'calf_r': ('thigh_r', 'calf'),
    'foot_r': ('calf_r', 'foot'),
    'ball_r': ('foot_r', 'ball'),
}

# 기준 자세 — 팔은 모션을 따르지 않고 이 값으로 고정한다.
#
# **옷이 포즈를 정하지 않게 하려고 둔다.** 팔이 걷기를 그대로 따라 몸통에 붙어 내려오면, 폭이
# 넓은 하의를 입히는 순간 손이 옷 안으로 들어간다. 그것을 옷마다 팔 각도를 조절해 피하면 같은
# 캐릭터가 옷에 따라 다른 자세로 걷게 된다. 그래서 반대로 **자세를 하나로 박고 옷이 거기 맞게**
# 한다. 이 값은 프로젝트 전체에 하나뿐이고 옷과 무관하다.
#
# 노리는 모습은 이렇다. 양팔을 팔꿈치에서 굽혀 몸에서 띄우고, 오른손은 가슴 높이로 들어 지팡이를
# 쥐어도 얼굴과 최소한으로 겹치게, 왼손은 배꼽 높이에 두어 보조 무기를 들 자리를 낸다.
#
# **VRoid 정지 자세는 정확한 T 포즈다.** 2026-09-11 실측으로 팔 본이 정확히 ±X를 향하고
# 세로 성분이 0이었다. A 포즈로 짐작하고 35도만 돌렸다가 팔이 수평으로 뻗은 채 나왔다 —
# T 포즈에서 팔을 내리려면 90도에 가까운 각이 필요하다.
#
# 값은 월드 축 기준 회전(도)이고 각 본의 정지 자세 위에 얹힌다. **순서는 Y 다음 X다**
# (`YXZ`). 팔이 X축을 향한 채라 X축 회전을 먼저 걸면 아무 일도 일어나지 않기 때문이다 —
# 먼저 Y로 팔을 내려 X축에서 떼어 놓아야 그다음 X 회전이 앞뒤로 흔든다.
#
# - **Y** — 팔을 내리는 축. 캐릭터 왼팔(+X 쪽)은 양수가 아래, 오른팔은 음수가 아래다.
#   90도면 수직으로 떨어지고, 그보다 작으면 몸에서 그만큼 벌어진다
# - **X** — 내려온 팔을 앞뒤로 흔드는 축. 음수가 앞쪽이고, 팔꿈치에 크게 주면 주먹이 올라온다
# - **Z** — 쓰지 않는다
#
# `J_Bip_L_*`이 캐릭터 자신의 왼쪽이고 정면 그림에서는 오른쪽에 보인다.
BASE_ARM_POSE = {
    # 캐릭터의 오른팔 — 가슴 높이. 지팡이를 드는 쪽이라 팔꿈치를 더 접는다. Y가 -58도라 팔이
    # 수직(-90도)에서 32도 벌어지는데, 이 벌림이 폭 넓은 하의와 부푼 소매에 손이 박히지 않을
    # 여유다. -75도로는 그 여유가 모자라 손이 옷 안으로 들어갔다.
    'J_Bip_R_UpperArm': (-10.0, -58.0, 0.0),
    'J_Bip_R_LowerArm': (-105.0, -58.0, 0.0),
    # Z는 0이다. `verify_hand_fix.py`가 -50을 제안했으나 그 값은 손등을 등 뒤로 보내 손바닥이
    # 정면을 향했다. 후보 여섯(-50 · 0 · +40 · +80 · +130)을 손만 확대해 견줘 0을 골랐다
    # (2026-09-16 사용자 판정). 주먹의 등이 정면을 보고 손바닥이 안 보이는 자리다.
    'J_Bip_R_Hand': (-105.0, -58.0, 0.0),
    # 캐릭터의 왼팔 — 배꼽 높이. 보조 무기를 드는 자리라 조금 낮다. Y는 오른팔과 같은 이유로
    # 수직(90도)에서 32도 벌어진 58도다.
    'J_Bip_L_UpperArm': (-10.0, 58.0, 0.0),
    'J_Bip_L_LowerArm': (-80.0, 58.0, 0.0),
    'J_Bip_L_Hand': (-80.0, 58.0, 0.0),
}

# 기준 자세의 회전 순서. 위 주석이 이유를 든다.
BASE_POSE_ORDER = 'YXZ'

# 지팡이(오른손)와 방패(왼손)를 쥐기 위한 손가락 그립(주먹) 고정 회전.
# VRoid 휴머노이드 골격의 T-포즈 기준 손가락 로컬 회전(Euler XYZ, 도)이다.
# 네 손가락(Index, Middle, Ring, Little)은 손바닥 쪽으로 구부리고,
# 엄지(Thumb)는 검지 바깥쪽을 감싸쥐도록 안쪽으로 모은다.
#
# 계획에 없던 추가라 근거를 적는다. 축 방향(오른손은 Z+, 왼손은 Z-가 손바닥 쪽)은 렌더로 확인했다 —
# 2026-09-14 `walk_0006`의 두 손을 네 배로 확대해 네 손가락이 손바닥 쪽으로 말린 주먹인 것을 봤다.
# 엄지가 검지 바깥을 감싸는지는 이 캔버스 크기에서 가려내지 못했다. 부호가 반대면 같은 각도만큼
# 손등 쪽으로 젖혀진다.
BASE_FINGER_POSE = {}

# 오른손 네 손가락 (손바닥 쪽으로 굽힘: Z+)
# 마디 합이 125도다. 종전 170도(55·65·50)는 끝마디가 과하게 말려 주먹 밖으로 튀어나왔다
# (2026-09-16 사용자 판정 — `docs/temp/3d-gate/verify_hand_fix.py`의 4방향 렌더로 골랐다).
for _finger in ('Index', 'Middle', 'Ring', 'Little'):
    BASE_FINGER_POSE['J_Bip_R_{0}1'.format(_finger)] = (0.0, 0.0, 45.0)
    BASE_FINGER_POSE['J_Bip_R_{0}2'.format(_finger)] = (0.0, 0.0, 48.0)
    BASE_FINGER_POSE['J_Bip_R_{0}3'.format(_finger)] = (0.0, 0.0, 32.0)

# 오른손 엄지 — 네 손가락 **위로** 덮이는 자리다.
# 밑마디의 Y가 -10이면 엄지가 먼저 접히고 네 손가락이 그 위를 덮어, 주먹에 가려 엄지가 안 보인다.
# 실제 주먹은 네 손가락을 먼저 쥐고 엄지가 검지 위를 가로질러 덮는다. Z(굽힘) 30을 고정하고
# 밑마디의 X·Y를 격자(X 4개 × Y 3개)로 훑어 +20을 골랐다(2026-09-16 사용자 판정).
BASE_FINGER_POSE['J_Bip_R_Thumb1'] = (25.0, 20.0, 30.0)
BASE_FINGER_POSE['J_Bip_R_Thumb2'] = (20.0, 0.0, 20.0)
BASE_FINGER_POSE['J_Bip_R_Thumb3'] = (15.0, 0.0, 15.0)

# 왼손 네 손가락 (손바닥 쪽으로 굽힘: Z-)
for _finger in ('Index', 'Middle', 'Ring', 'Little'):
    BASE_FINGER_POSE['J_Bip_L_{0}1'.format(_finger)] = (0.0, 0.0, -55.0)
    BASE_FINGER_POSE['J_Bip_L_{0}2'.format(_finger)] = (0.0, 0.0, -65.0)
    BASE_FINGER_POSE['J_Bip_L_{0}3'.format(_finger)] = (0.0, 0.0, -50.0)

# 왼손 엄지 — 오른손의 좌우 반전이 **아니다.**
# 오른손이 채택한 `(25, 20, 30)`을 `(X, -Y, -Z)`로 뒤집어 `(25, -20, -30)`을 넣는 것이 거울상인데,
# 실제로 그 값이 맞는지는 왼손을 따로 훑어 확인했다. 오른손 값을 뒤집은 판이 왼손에서 엄지가
# 손가락 밑에 깔리는 일이 먼저 있었기 때문이다(2026-09-16). 왼손 X·Y를 격자(3×4)로 훑어 골랐고,
# 결과적으로 거울상과 같은 자리에 떨어졌다.
BASE_FINGER_POSE['J_Bip_L_Thumb1'] = (25.0, -20.0, -30.0)
BASE_FINGER_POSE['J_Bip_L_Thumb2'] = (20.0, 0.0, -20.0)
BASE_FINGER_POSE['J_Bip_L_Thumb3'] = (15.0, 0.0, -15.0)



def import_motion(path):
    """
    모션 라이브러리를 읽는다. 내장 glTF 임포터를 쓰므로 애드온을 다시 켤 필요가 없다.

    @returns `(아마추어 오브젝트, 이번 임포트로 생긴 액션 이름 집합, 생긴 오브젝트 전부)`
    """
    absolute = os.path.abspath(path)
    if not os.path.exists(absolute):
        raise common.GateError('motion-path', '모션 파일이 없다: {0}'.format(absolute))

    before_objects = set(bpy.data.objects.keys())
    before_actions = set(bpy.data.actions.keys())

    try:
        if absolute.lower().endswith('.glb') or absolute.lower().endswith('.gltf'):
            bpy.ops.import_scene.gltf(filepath=absolute)
        elif absolute.lower().endswith('.fbx'):
            bpy.ops.import_scene.fbx(filepath=absolute)
        else:
            raise common.GateError('motion-path', '모르는 형식이다 (glb·gltf·fbx만): {0}'.format(absolute))
    except common.GateError:
        raise
    except Exception as err:
        raise common.GateError('motion-path', '모션 임포트 실패 {0}: {1}'.format(type(err).__name__, err))

    new_objects = [bpy.data.objects[n] for n in set(bpy.data.objects.keys()) - before_objects]
    armatures = [o for o in new_objects if o.type == 'ARMATURE']
    if not armatures:
        raise common.GateError('motion-path', '모션 파일에 아마추어가 없다')
    return armatures[0], set(bpy.data.actions.keys()) - before_actions, new_objects


def find_action(name, candidates):
    """이름이 정확히 맞는 액션을 고른다. 없으면 후보 목록을 담아 실패한다."""
    if name in bpy.data.actions:
        return bpy.data.actions[name]
    walk_like = sorted(a for a in candidates if 'walk' in a.lower())
    raise common.GateError(
        'motion-action',
        '액션 "{0}"이 없다 — 걷기로 보이는 것 {1}, 전체 {2}개'.format(
            name, walk_like, len(candidates)
        ),
    )


def armature_height(armature):
    """아마추어의 세로 크기. 두 골격의 배율을 맞추는 데 쓴다."""
    return max(armature.dimensions.z, 1e-6)


def align_source_to_target(source, target):
    """
    모션 골격을 대상 골격의 크기와 자리에 맞춘다.

    **배율이 필요한 이유.** `retarget_bake`는 루트(허리)에 모션 루트가 정지 위치에서 움직인 양을
    월드 좌표로 더한다. 모션 쪽은 사람 키(약 1.8m) 기준이고 이 캐릭터는 4등신으로 민 1.1m라,
    배율을 안 맞추면 그 이동량이 사람 키 기준으로 남아 오르내림과 좌우 흔들림이 키에 비해 과장된다.

    배율을 맞춘 뒤 두 골격의 **루트 본 정지 위치**가 겹치도록 평행 이동한다. `retarget_bake`는
    위치의 차이만 옮기므로 이 평행 이동은 구운 결과를 바꾸지 않는다 — 두 골격이 같은 자리에 서
    있어 Blender에서 장면을 열었을 때 겹쳐 보일 뿐이다.
    """
    factor = armature_height(target) / armature_height(source)
    source.scale = (factor, factor, factor)
    bpy.context.view_layer.update()

    if ROOT_BONE not in source.data.bones:
        raise common.GateError(
            'retarget-bone',
            '모션 골격에 루트 본 "{0}"이 없다 — 있는 본 {1}'.format(
                ROOT_BONE, sorted(b.name for b in source.data.bones)[:20]
            ),
        )
    target_root = BONE_MAP[0][1]
    if target_root not in target.data.bones:
        raise common.GateError(
            'retarget-bone', '대상 골격에 루트 본 "{0}"이 없다'.format(target_root)
        )

    source_head = source.matrix_world @ source.data.bones[ROOT_BONE].head_local
    target_head = target.matrix_world @ target.data.bones[target_root].head_local
    source.location = source.location + (target_head - source_head)
    bpy.context.view_layer.update()


def check_bone_map(source, target):
    """
    대응표의 본이 양쪽 골격에 다 있는지, 그리고 `SWING_CHAIN`이 적은 부모가 모션 골격의 실제
    부모인지 본다. 어긋나면 어느 쪽의 어느 이름인지 보고한다.

    부모까지 확인하는 이유는 흔들림을 줄이는 계산이 「부모에 대해 돌아간 양」이기 때문이다. 적어
    둔 부모가 실제와 다르면 계산은 에러 없이 돌지만 엉뚱한 본을 기준으로 줄여, 관절이 조용히
    비틀린 프레임이 나온다.

    @returns 쌍의 수
    """
    missing = []
    for source_name, target_name in BONE_MAP:
        if source_name not in source.pose.bones:
            missing.append('모션:{0}'.format(source_name))
        if target_name not in target.pose.bones:
            missing.append('대상:{0}'.format(target_name))
    if missing:
        raise common.GateError(
            'retarget-bone', '대응표의 본을 찾지 못했다: {0}'.format(', '.join(missing))
        )

    wrong = []
    for name, (parent, _) in SWING_CHAIN.items():
        if parent is None:
            continue
        actual = source.pose.bones[name].parent
        actual_name = actual.name if actual else None
        if actual_name != parent:
            wrong.append('{0}의 부모가 {1}인데 {2}로 적혀 있다'.format(name, actual_name, parent))
    if wrong:
        raise common.GateError(
            'retarget-bone', '흔들림 사슬의 부모가 모션 골격과 다르다: {0}'.format('; '.join(wrong))
        )
    return len(BONE_MAP)


def retarget_bake(source, target, frames):
    """
    모션을 대상 골격에 옮겨 키프레임으로 굳힌다.

    **회전을 그대로 복사하지 않고 「정지 자세로부터 돌아간 양」만 옮긴다.** 같은 회전값이라도
    본이 정지 자세에서 어느 쪽을 향하고 자기 축으로 얼마나 돌아 있는지에 따라 다른 자세가
    되는데, 그 정지 회전은 골격마다 다르다. 2026-09-14에 두 골격을 재 보니 팔은 둘 다 +X를
    향하는 T 포즈로 1° 안에서 같았지만, 허벅지는 같은 방향을 향한 채 자기 축으로 180° 돌아
    있었다. 회전값을 그대로 옮기면 허벅지가 자기 축으로 반 바퀴 돌아 무릎이 뒤를 향한다.

    그래서 모션 본이 자기 정지 자세에서 돌아간 양을 구해 **대상 본의 정지 자세에 얹는다.**
    정지 회전이 달라도 같은 동작이 나온다.

    **몸통과 다리는 `SWING_SCALE`만큼만 따른다.** `SWING_CHAIN`에 적힌 본마다 부모에 대해 돌아간
    양을 떼어 그 관절의 비율로 줄이고, 부모가 실제로 받은 회전 위에 다시 얹는다. 루트의 이동은
    좌우·앞뒤와 위아래를 따로 줄인다. 왜 그렇게 나눠 줄이는지는 그 상수의 주석에 있다.

    **부모부터 자식 순으로 처리하고 한 본마다 갱신한다.** `pose_bone.matrix`를 넣는 값은 그
    시점의 부모 자세를 기준으로 해석되므로, 부모를 아직 안 옮긴 채 자식을 넣으면 자식이
    엉뚱한 자리에 앉는다. `BONE_MAP`이 이미 부모부터 나열돼 있다.

    위치는 루트 하나에만 옮긴다. 뼈 길이가 두 골격에서 다르므로 나머지에 위치를 주면 팔다리가
    늘어나거나 관절이 빠진다.
    """
    root_target = BONE_MAP[0][1]

    for bone in target.pose.bones:
        bone.rotation_mode = 'QUATERNION'

    for frame in frames:
        bpy.context.scene.frame_set(frame)
        # 모션 본이 이 프레임에 정지 자세로부터 돌아간 양과, 대상 본에 실제로 준 양. 둘 다 모션
        # 쪽 이름으로 담는다. `SWING_CHAIN`의 본은 부모의 두 값을 보고 자기 몫을 정한다.
        source_delta = {}
        applied_delta = {}

        for source_name, target_name in BONE_MAP:
            source_bone = source.pose.bones[source_name]
            target_bone = target.pose.bones[target_name]

            # `pose_bone.matrix`와 `bone.matrix_local`은 둘 다 아마추어 **오브젝트 공간**이라
            # 월드로 올리려면 `matrix_world`를 앞에 곱한다.
            source_rest = source.matrix_world @ source.data.bones[source_name].matrix_local
            source_pose = source.matrix_world @ source_bone.matrix
            target_rest = target.matrix_world @ target.data.bones[target_name].matrix_local

            # 기준 자세에 적힌 본은 모션을 안 받는다. 그래야 옷이나 모션이 바뀌어도 팔이
            # 늘 같은 자리에 있다.
            fixed = BASE_ARM_POSE.get(target_name)
            if fixed is not None:
                delta = Euler([radians(a) for a in fixed], BASE_POSE_ORDER).to_quaternion()
            else:
                full = source_pose.to_quaternion() @ source_rest.to_quaternion().inverted()
                source_delta[source_name] = full
                chain = SWING_CHAIN.get(source_name)
                if chain is None:
                    delta = full
                else:
                    parent, joint = chain
                    if parent is None:
                        local, base = full.copy(), Quaternion()
                    else:
                        local = source_delta[parent].inverted() @ full
                        base = applied_delta[parent]
                    # 같은 회전을 뜻하는 쿼터니언이 부호만 반대인 둘이라, w가 음수인 쪽에서
                    # 단위 회전과 보간하면 짧은 길 대신 반대편으로 돌아 관절이 크게 휘돈다.
                    if local.w < 0:
                        local.negate()
                    delta = base @ Quaternion().slerp(local, SWING_SCALE[joint])
            applied_delta[source_name] = delta
            wanted = (delta @ target_rest.to_quaternion()).to_matrix().to_4x4()

            if target_name == root_target:
                # 루트만 위치를 받는다. 모션 골격을 대상 키에 맞춰 이미 줄여 뒀으므로 이
                # 차이는 대상 골격의 축척으로 표현된 값이다. 월드 X가 좌우, Y가 앞뒤, Z가
                # 위아래다. 축마다 다른 비율로 줄이는 이유는 `SWING_SCALE`의 주석에 있다.
                offset = source_pose.translation - source_rest.translation
                offset.x *= SWING_SCALE['sway']
                offset.y *= SWING_SCALE['sway']
                offset.z *= SWING_SCALE['thigh']
                wanted.translation = target_rest.translation + offset
            else:
                wanted.translation = (target.matrix_world @ target_bone.matrix).translation

            target_bone.matrix = target.matrix_world.inverted() @ wanted
            bpy.context.view_layer.update()

        for _, target_name in BONE_MAP:
            bone = target.pose.bones[target_name]
            bone.keyframe_insert('rotation_quaternion', frame=frame)
            if target_name == root_target:
                bone.keyframe_insert('location', frame=frame)

        # 지팡이/방패 그립을 위한 손가락 고정 자세 적용
        for finger_name, rot in BASE_FINGER_POSE.items():
            if finger_name in target.pose.bones:
                bone = target.pose.bones[finger_name]
                bone.rotation_mode = 'QUATERNION'
                bone.rotation_quaternion = Euler([radians(a) for a in rot], 'XYZ').to_quaternion()
                bone.keyframe_insert('rotation_quaternion', frame=frame)
        bpy.context.view_layer.update()


def sample_frames(action, count):
    """
    걷기 한 주기에서 고르게 뽑은 프레임 번호.

    마지막 프레임을 빼는 이유는 루프이기 때문이다. 첫 프레임과 같은 자세라, 넣으면 그 쌍이
    `frameSetIntegrity`의 루프 이음새 검사에 걸리고 재생에서도 한 박자 멈춘 것처럼 보인다.
    """
    start, end = action.frame_range
    span = end - start
    if span <= 0:
        raise common.GateError('motion-action', '액션 길이가 0이다 ({0})'.format(action.name))
    return [int(round(start + span * i / count)) for i in range(count)]


def limb_travel(target, frames, bone_names):
    """
    프레임을 지나는 동안 각 본이 **앞뒤로** 얼마나 움직였는지 잰다.

    정면 뷰에서는 이것을 눈으로 못 본다. 걷기의 팔 스윙은 좌우가 아니라 앞뒤 축이라 정면
    실루엣에서 거의 안 드러나고, 어두운 옷을 입히면 더 안 보인다. 그래서 「팔이 도는가」를
    그림이 아니라 좌표로 답한다 — 리타게팅이 어깨에서 끊기면 이 값이 0에 가깝게 나온다.

    @param bone_names 잴 본 이름들
    @returns 본 이름 → 앞뒤 이동 폭(미터)
    """
    travel = {}
    for name in bone_names:
        if name not in target.pose.bones:
            continue
        values = []
        for frame in frames:
            bpy.context.scene.frame_set(frame)
            values.append((target.matrix_world @ target.pose.bones[name].head).y)
        travel[name] = round(max(values) - min(values), 4)
    return travel


def union_bounds(frames):
    """굽는 프레임 전체를 감싸는 월드 상자. 카메라를 한 번만 잡으려고 미리 합친다."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lo = Vector((float('inf'),) * 3)
    hi = Vector((float('-inf'),) * 3)
    found = False

    for frame in frames:
        bpy.context.scene.frame_set(frame)
        depsgraph.update()
        for obj in bpy.context.scene.objects:
            if obj.type != 'MESH':
                continue
            evaluated = obj.evaluated_get(depsgraph)
            for corner in evaluated.bound_box:
                point = evaluated.matrix_world @ Vector(corner)
                found = True
                for axis in range(3):
                    lo[axis] = min(lo[axis], point[axis])
                    hi[axis] = max(hi[axis], point[axis])

    if not found:
        raise common.GateError('vrm-path', '메시가 없다 — 렌더할 것이 없다')
    return lo, hi


def main():
    args = common.script_args()
    vrm_path = common.parse_arg(args, 'vrm')
    motion_path = common.parse_arg(args, 'motion')
    out_dir = common.parse_arg(args, 'out')
    action_name = common.parse_arg(args, 'action', 'Walk_Loop')
    raw_frames = common.parse_arg(args, 'frames', '8')
    prefix = common.parse_arg(args, 'prefix', 'walk')
    # 게이트 이름을 인자로 받는다. 이 스크립트는 0c와 2 둘 다에 쓰이는데 차이는 어디에 굽느냐
    # 뿐이라, 이름을 박아 두면 게이트 2의 판정 줄이 자기를 0c라고 보고한다.
    gate_name = common.parse_arg(args, 'gate', '0c')
    # 측면은 진단용이다. 정면 실루엣에는 팔이 몸 앞뒤 어디에 있는지가 안 드러나서, 팔이
    # 안쪽으로 말려도 「소매만 보인다」로 끝난다.
    view = common.parse_arg(args, 'view', 'front')

    # 빠진 경로 인자는 그 경로가 가리키는 대상의 실패 코드로 보고한다. README의 실패 코드 표가
    # 코드마다 다음 할 일을 적어 두었으므로, 전부 `output-path`로 접으면 `.vrm` 경로가 빠진
    # 실패에 「출력 경로를 본다」를 안내하게 된다.
    for name, value, code in (
        ('vrm', vrm_path, 'vrm-path'),
        ('motion', motion_path, 'motion-path'),
        ('out', out_dir, 'output-path'),
    ):
        if not value:
            raise common.GateError(code, '`-- --{0} <경로>`를 받지 못했다'.format(name))

    # 0장을 받으면 굽기가 아무것도 안 하고 지나가 상자 계산에서 「메시가 없다」로 떨어진다. 원인이
    # 인자인데 모델을 의심하게 되므로 여기서 멈춘다.
    try:
        frame_count = int(raw_frames)
    except ValueError:
        frame_count = 0
    if frame_count < 1:
        raise common.GateError(
            'motion-action', '--frames는 1 이상의 정수여야 한다 (받은 값 {0})'.format(raw_frames)
        )

    # 캔버스와 발·머리 행은 `gate.ts`가 `PLAYER_FRAME_SPEC`에서 넘긴다. 스크립트에 복사해 두지
    # 않는 이유는 `common.parse_int_arg`에 적었다.
    canvas_width = common.parse_int_arg(args, 'width')
    canvas_height = common.parse_int_arg(args, 'height')
    foot_row = common.parse_int_arg(args, 'foot-row')
    head_row = common.parse_int_arg(args, 'head-row')

    # 쓸 자리를 무거운 임포트와 굽기 **전에** 전부 확인한다. 프레임마다 굽고 나서 확인하면, 3번
    # 파일만 남아 있을 때 1·2번을 새로 쓴 뒤 실패해서 새 프레임과 옛 프레임이 섞인 세트가 추적
    # 폴더에 남는다.
    planned = []
    for index in range(1, frame_count + 1):
        # 자리수를 채운다. `walk_1`·`walk_10`·`walk_2`는 사전순이 어긋나 사람이 클립에 그대로
        # 잘못된 순서로 넣게 되고, 그 결과인 덜컥거림은 「3D 느낌」으로 오분류된다.
        name = '{0}_{1:04d}.png'.format(prefix, index)
        path = common.assert_output_path(os.path.join(out_dir, name))
        # 이미 있는 파일은 덮지 않는다. 편집 게이트 훅은 `game/assets/scripts/**/*.ts`만 보므로
        # 이 스크립트가 PNG를 덮어써도 어느 phase에서도 막히지 않는다. 그 자리에 `.meta`가 남아
        # 있으면 Cocos가 새 PNG를 조용히 다시 임포트해서, 게임에 실린 프레임이 바뀐 것을 아무도
        # 모른 채 넘어간다. 다시 구우려면 PNG만 지우고 `.meta`는 남긴다 — `.meta`가 uuid를 들고
        # 있어서 함께 지우면 `walk.anim`의 프레임 참조가 전부 끊긴다. Cocos가 켜져 있을 때 쓰는
        # 절차는 README의 「출하 프레임 다시 굽기」에 있다.
        if os.path.exists(path):
            raise common.GateError('output-path', '이미 있는 파일을 덮지 않는다: {0}'.format(path))
        planned.append(path)

    common.assert_version()
    engine = common.pick_eevee()

    target = common.import_vrm(vrm_path)
    source, new_actions, motion_objects = import_motion(motion_path)
    action = find_action(action_name, new_actions)

    if source.animation_data is None:
        source.animation_data_create()
    source.animation_data.action = action

    align_source_to_target(source, target)
    linked = check_bone_map(source, target)

    frames = sample_frames(action, frame_count)
    retarget_bake(source, target, frames)

    # **모션 파일이 들여온 것을 전부 지운다. 아마추어만으로는 부족하다.** 이 라이브러리는 본만
    # 있는 게 아니라 그 본이 움직이는 기본 인물 메시도 함께 들여오는데, 아마추어만 지우면 그
    # 메시가 장면에 남아 상자 계산과 렌더에 같이 들어간다. 2026-09-11 첫 실행이 그랬다 —
    # 인물 키가 1.11m인데 상자가 2.83m로 나왔고, 카메라가 둘을 다 담으려고 물러나면서 프레임
    # 여덟 장에 캐릭터 둘이 작게 찍혔다. 프레임 개수도 알파도 정상이라 발 밑선 판정이
    # 아니었으면 그대로 통과했다.
    for obj in motion_objects:
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)

    travel = limb_travel(
        target,
        frames,
        ('J_Bip_L_Hand', 'J_Bip_R_Hand', 'J_Bip_L_Foot', 'J_Bip_R_Foot', 'J_Bip_C_Head'),
    )

    lo, hi = union_bounds(frames)
    camera = common.setup_camera(
        lo, hi, canvas_width, canvas_height, foot_row=foot_row, head_row=head_row, view=view
    )
    common.setup_lights()

    written = []
    for frame, path in zip(frames, planned):
        bpy.context.scene.frame_set(frame)
        common.setup_render(engine, canvas_width, canvas_height, path)
        common.render_still(path)
        written.append(path.replace('\\', '/'))

    common.gate_ok(
        {
            'gate': gate_name,
            'blender': bpy.app.version_string,
            'engine': engine,
            'action': action.name,
            'action_range': [round(v, 2) for v in action.frame_range],
            'bones_linked': linked,
            'swing_scale': SWING_SCALE,
            'limb_travel_m': travel,
            'frames': frames,
            'frame_count': len(frames),
            'height_m': round(hi.z - lo.z, 4),
            # 화면 가로를 채우는 폭이다. 정면은 좌우(X), 측면 진단 렌더는 앞뒤(Y)가 화면 가로라서,
            # 좌우 폭을 그대로 보고하면 측면 렌더에서 프레이밍과 맞지 않는 값이 찍힌다.
            'width_m': round((hi.x - lo.x) if view == 'front' else (hi.y - lo.y), 4),
            'ortho_scale': round(camera.data.ortho_scale, 4),
            'written': written,
            'width': canvas_width,
            'height': canvas_height,
            'foot_row': foot_row,
            'head_row': head_row,
        }
    )


if __name__ == '__main__':
    common.run(main)
