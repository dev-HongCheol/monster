"""
G1 — 무기가 캔버스 안에 들어갈 수 있는 최대 크기를 재려고 손 위치와 몸 상자를 덤프한다.

판정은 하지 않는다. 여기서 하는 일은 기준 자세를 입힌 몸의 세계 좌표 상자와 두 손의 세계
좌표를 적어 내보내는 것까지다. 남는 자리를 픽셀로 환산하는 것은 실행기가 한다
(`README.md` 「판정은 파이썬에 없다」).

**기준 자세를 입히고 재는 이유.** A 포즈로 재면 팔이 수평으로 벌어져 손이 몸에서 가장 멀리
나가 있고, 그 자리는 게임에 나오지 않는다. 무기는 `BASE_ARM_POSE`가 내린 손에 붙으므로 그
자세의 손 위치가 실제로 무기가 놓이는 자리다.

**자세 값을 여기 베끼지 않는다.** `retarget_render.BASE_ARM_POSE`를 그대로 가져다 쓴다. 두 벌로
두면 한쪽만 고쳤을 때 굽기와 측정이 다른 자세를 보게 되고, 그러면 여기서 통과한 크기가 실제
굽기에서 넘친다.

돌리는 법과 실패 코드 표는 `tools/blender/README.md`에 있다.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import _common as common  # noqa: E402 - 위 경로 주입 뒤에 와야 한다
import retarget_render as retarget  # noqa: E402 - 기준 자세 값의 주인이다


def apply_base_pose(armature):
    """`BASE_ARM_POSE`가 정한 팔 각도를 포즈 본에 그대로 입힌다."""
    from math import radians

    from mathutils import Euler

    for name, angles in retarget.BASE_ARM_POSE.items():
        bone = armature.pose.bones.get(name)
        if bone is None:
            raise common.GateError(
                'retarget-bone',
                '기준 자세가 쓰는 본을 이 골격에서 못 찾았다: ' + name,
            )
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = Euler(
            [radians(a) for a in angles], retarget.BASE_POSE_ORDER
        ).to_quaternion()


def main():
    import bpy

    args = common.script_args()
    vrm_path = common.parse_arg(args, 'vrm')
    out_path = common.parse_arg(args, 'out')

    if not vrm_path:
        raise common.GateError('vrm-path', '`-- --vrm <경로>`를 받지 못했다')
    if not out_path:
        raise common.GateError('output-path', '`-- --out <경로>`를 받지 못했다')

    common.assert_version()
    absolute_out = common.assert_output_path(out_path)

    armature = common.import_vrm(vrm_path)
    apply_base_pose(armature)
    bpy.context.view_layer.update()

    lo, hi = common.world_bounds()

    hands = {}
    for label, bone_name in (('right', 'J_Bip_R_Hand'), ('left', 'J_Bip_L_Hand')):
        bone = armature.pose.bones.get(bone_name)
        if bone is None:
            raise common.GateError('retarget-bone', '손 본을 못 찾았다: ' + bone_name)
        head = armature.matrix_world @ bone.head
        tail = armature.matrix_world @ bone.tail
        hands[label] = {
            'bone': bone_name,
            'head': [round(v, 5) for v in head],
            'tail': [round(v, 5) for v in tail],
        }

    payload = {
        'vrm': os.path.abspath(vrm_path).replace(os.sep, '/'),
        'posed': True,
        'bodyBounds': {
            'min': [round(v, 5) for v in lo],
            'max': [round(v, 5) for v in hi],
        },
        'hands': hands,
    }
    with open(absolute_out, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    common.gate_ok(
        {
            'gate': 'g1-weapon-room',
            'blender': bpy.app.version_string,
            'height_m': round(hi.z - lo.z, 5),
            'width_m': round(hi.x - lo.x, 5),
            'right_hand': payload['hands']['right']['head'],
            'left_hand': payload['hands']['left']['head'],
            'output': absolute_out.replace(os.sep, '/'),
        }
    )


if __name__ == '__main__':
    common.run(main)
