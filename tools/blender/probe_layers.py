"""
G2 — 층 하나를 가림 전용 몸과 함께 굽는다. 가림 렌더가 되는지 보는 탐침이다.

**층을 따로 굽는 이유는 옷과 무기를 갈아입히기 위해서다.** 옷 입은 캐릭터를 한 장에 통째로
구우면 옷만 벗길 수 없다. 그래서 몸을 한 장, 상의를 한 장, 무기를 한 장씩 굽고 게임에서 겹친다.

**가림이 이 방식의 관건이다.** 상의나 무기를 단독으로 구우면 몸에 가려져야 할 픽셀까지 그려진다.
예를 들어 지팡이가 몸통 뒤를 지나는 자세에서, 지팡이만 구우면 몸통에 가린 부분이 그대로 보인다.
그래서 몸을 **Holdout 컬렉션**에 넣는다 — 몸은 렌더에 안 나오면서 뒤에 있는 것을 가리기만 하므로,
몸에 가려진 지팡이 픽셀이 알파 0으로 나온다.

**모든 층을 View Transform `Standard`로 굽는다.** Blender 5.x의 기본은 `AgX`인데, 층마다 이
값이 다르면 같은 픽셀의 색이 층끼리 달라져 겹친 경계에 색띠가 생긴다. `_common.setup_render`가
이 값을 안 건드리므로 여기서 명시한다.

판정은 하지 않는다. 굽고 실측을 보고하는 것까지이고 재는 것은 실행기가 한다
(`README.md` 「판정은 파이썬에 없다」).

돌리는 법과 실패 코드 표는 `tools/blender/README.md`에 있다.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import _common as common  # noqa: E402 - 위 경로 주입 뒤에 와야 한다
import retarget_render as retarget  # noqa: E402 - 기준 자세 값의 주인이다
import weapons  # noqa: E402 - 부품 세우기의 주인이다

# 가림 전용 몸을 담는 컬렉션 이름. 이름으로 찾아 Holdout을 켜므로 다른 곳에서 쓰면 안 된다.
HOLDOUT_COLLECTION = 'GateHoldout'

# 무기를 붙일 손 본. 지팡이는 오른손, 방패는 왼손이다(G2 §2).
WEAPON_HAND = {'staff': 'J_Bip_R_Hand', 'shield': 'J_Bip_L_Hand'}


def set_standard_view_transform():
    """색 관리를 Standard로 고정하고 그 값을 돌려준다."""
    view = bpy.context.scene.view_settings
    view.view_transform = 'Standard'
    view.look = 'None'
    return view.view_transform


def scene_meshes():
    """지금 장면의 메시 오브젝트 전부."""
    return [o for o in bpy.data.objects if o.type == 'MESH']


def keep_only_materials(obj, needle):
    """
    메시에서 이름에 `needle`이 든 머티리얼의 면만 남기고 나머지를 지운다.

    **VRoid는 옷을 별도 오브젝트로 내보내지 않는다.** 상의 · 하의 · 신발이 `Body` 메시 하나에
    머티리얼로만 갈려 들어오므로(G1 §4.2 실측), 상의 층을 만들려면 오브젝트가 아니라 머티리얼로
    면을 골라야 한다.

    @returns 남은 면 수
    """
    import bmesh

    keep = {
        index
        for index, slot in enumerate(obj.material_slots)
        if slot.material is not None and needle in slot.material.name
    }
    if not keep:
        names = [s.material.name if s.material else '(없음)' for s in obj.material_slots]
        raise common.GateError(
            'weapon-spec',
            '{0}에 "{1}"가 든 머티리얼이 없다 (있는 것: {2})'.format(obj.name, needle, names),
        )

    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    doomed = [f for f in mesh.faces if f.material_index not in keep]
    bmesh.ops.delete(mesh, geom=doomed, context='FACES')
    left = len(mesh.faces)
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()
    return left


def move_to_holdout(objects):
    """오브젝트들을 가림 전용 컬렉션으로 옮기고 Holdout을 켠다."""
    scene = bpy.context.scene
    collection = bpy.data.collections.new(HOLDOUT_COLLECTION)
    scene.collection.children.link(collection)
    for obj in objects:
        for parent in list(obj.users_collection):
            parent.objects.unlink(obj)
        collection.objects.link(obj)

    layer = bpy.context.view_layer.layer_collection.children.get(HOLDOUT_COLLECTION)
    if layer is None:
        raise common.GateError('unexpected', '가림 컬렉션을 뷰 레이어에서 못 찾았다')
    layer.holdout = True
    return len(objects)


def attach_weapon(armature, spec, bone_name, yaw):
    """
    부품으로 무기를 세워 손 본에 붙인다.

    붙이는 방식은 2026-09-14 `verify_hand_fix.py`가 실물로 확인한 것을 따른다 — 손 본의 머리
    위치에 두고 `matrix_parent_inverse`로 본의 현재 자세를 상쇄한다. 상쇄하지 않으면 자세를 입힌
    만큼 무기가 한 번 더 돌아간다.
    """
    from mathutils import Vector

    parts = spec.get('parts') or []
    if not parts:
        raise common.GateError('weapon-spec', '무기 사양에 부품이 없다')

    built = [weapons.build_part(part) for part in parts]
    for obj in built:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = built[0]
    if len(built) > 1:
        bpy.ops.object.join()
    weapon = bpy.context.active_object
    weapon.name = spec.get('id', 'Weapon')

    # **합친 뒤 변환을 메시에 구워 넣는다.** 그래야 오브젝트의 로컬 좌표가 사양 좌표와 같아져
    # `grip`을 그대로 쓸 수 있다. 2026-09-16에 두 가지가 여기서 어긋났다.
    #
    # - `join`은 합친 오브젝트의 **원점을 활성 오브젝트의 원점**으로 잡는데 그것은 첫 부품의
    #   `location`이다(지팡이는 대의 중심 z 0.625). 그래서 지팡이가 정확히 0.625m 내려앉았다.
    # - `join`은 첫 부품의 **회전도 오브젝트 변환으로 남긴다.** 방패의 첫 부품이 90도 누운
    #   원판이라, 아래에서 `matrix_world`를 덮어쓰는 순간 그 회전이 지워져 방패가 상 위에 놓인
    #   접시처럼 납작하게 누웠다(실측 z 두께 0.14, 지름이 X로 눕는다).
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bone = armature.pose.bones.get(bone_name)
    if bone is None:
        raise common.GateError('retarget-bone', '무기를 붙일 본이 없다: ' + bone_name)

    from math import radians

    from mathutils import Euler, Matrix

    hand = armature.matrix_world @ bone.matrix

    # **무기는 손 본의 회전이 아니라 곧게 세운다.** 손은 팔 자세 때문에 -105도로 꺾여 있어서,
    # 그 회전을 무기에 물리면 지팡이가 팔뚝 방향으로 눕는다. 2026-09-16에 실제로 그렇게 나왔다 —
    # 그립 벡터(z 0.98)가 아래로 돌아가 지팡이가 골반 아래까지 내려갔고 방패는 화면 밖으로
    # 사라졌다. 마법사는 지팡이를 곧게 세워 쥐므로 기울기는 `tilt`로만 준다.
    #
    # **다만 캐릭터의 방향은 따라가야 한다.** 월드 기준으로만 세우면 캐릭터가 돌아도 무기는 늘
    # 카메라를 향한 채 손 앞에 놓인다. 뒷모습에서 그 일이 났다 — 방패가 앞면을 보인 채 카메라와
    # 등 사이에 끼어 왼팔을 통째로 가렸다. 그립 오프셋도 같은 회전을 타야 몸 앞뒤가 맞는다.
    tilt = spec.get('tilt', (0.0, 0.0, 0.0))
    facing = Matrix.Rotation(radians(yaw), 4, 'Z')
    upright = facing @ Euler([radians(a) for a in tilt], 'XYZ').to_matrix().to_4x4()

    # **그립은 무기에서 손이 잡는 점이므로 빼야 한다.** 무기의 로컬 점 `grip`이 손 위치에
    # 오려면 원점을 그만큼 반대로 밀어야 한다(`R@grip + T = H` → `T = H − R@grip`).
    grip = spec.get('grip', (0.0, 0.0, 0.0))
    offset = upright.to_3x3() @ Vector(grip)
    placed = upright.copy()
    placed.translation = (armature.matrix_world @ bone.head) - offset

    # **부모로 붙이지 않고 월드에 그대로 놓는다.** `parent_type='BONE'`은 본의 **꼬리**를 원점으로
    # 삼아서, 붙이는 순간 월드 행렬이 `본꼬리 × 부모역행렬 × 기준행렬`로 다시 계산된다. 그 결과
    # 지팡이가 계산해 둔 자리에서 0.616m 더 내려갔다(2026-09-16 실측 — 기대 z −0.342~1.020,
    # 실제 −0.958~0.404).
    #
    # 정적 탐침에는 부모 관계가 필요 없다. 자세가 한 판뿐이라 무기가 손을 따라다닐 일이 없고,
    # 월드에 놓는 것과 렌더 결과가 같다. 걷기 프레임마다 손을 따라가야 하는 것은 G4의 굽기이고,
    # 그때 이 보정을 제대로 풀어야 한다.
    weapon.matrix_world = placed
    bpy.context.view_layer.update()
    return weapon


def main():
    global bpy
    import bpy

    args = common.script_args()
    base_vrm = common.parse_arg(args, 'base-vrm')
    layer = common.parse_arg(args, 'layer')
    out_path = common.parse_arg(args, 'out')
    top_vrm = common.parse_arg(args, 'top-vrm')
    weapon_spec_path = common.parse_arg(args, 'weapon-spec')
    yaw = float(common.parse_arg(args, 'yaw') or 0.0)

    if not base_vrm:
        raise common.GateError('vrm-path', '`-- --base-vrm <경로>`를 받지 못했다')
    if not out_path:
        raise common.GateError('output-path', '`-- --out <경로>`를 받지 못했다')
    if layer not in ('body', 'top', 'staff', 'shield'):
        raise common.GateError(
            'weapon-spec', 'layer는 body · top · staff · shield 중 하나여야 한다 (받은 값 {0})'.format(layer)
        )

    base_width = common.parse_int_arg(args, 'width')
    base_height = common.parse_int_arg(args, 'height')
    foot_row = common.parse_int_arg(args, 'foot-row')
    head_row = common.parse_int_arg(args, 'head-row')

    common.assert_version()
    engine = common.pick_eevee()
    absolute_out = common.assert_output_path(out_path)

    from math import radians

    from mathutils import Matrix

    armature = common.import_vrm(base_vrm)
    body_objects = list(scene_meshes())
    armatures = [armature]
    detail = {}

    # 상의는 몸보다 **먼저** 올린다. 자세를 두 골격에 똑같이 입혀야 상의가 몸을 따라오기
    # 때문이다. 상의 메시는 자기 골격에 물려 있으므로, 그 골격을 안 돌리면 몸만 자세를 잡고
    # 상의는 T 포즈로 남아 서로 어긋난다.
    if layer == 'top':
        if not top_vrm:
            raise common.GateError('vrm-path', '상의 층에는 `--top-vrm <경로>`가 필요하다')
        top_armature, added = common.append_vrm(top_vrm)
        armatures.append(top_armature)
        kept = 0
        for obj in added:
            if obj.type != 'MESH':
                continue
            if obj.name.startswith('Body'):
                kept = keep_only_materials(obj, 'Tops')
            else:
                # 얼굴 · 머리카락은 맨살 판 것이 이미 있다. 두 벌을 겹치면 같은 자리에 두 번
                # 그려져 알파 경계가 두꺼워진다.
                bpy.data.objects.remove(obj, do_unlink=True)
        detail['top_faces'] = kept

    for each in armatures:
        common.apply_world_delta_pose(each, retarget.BASE_ARM_POSE, retarget.BASE_POSE_ORDER)
        common.apply_local_pose(each, retarget.BASE_FINGER_POSE, 'XYZ')
        # 방향은 모델을 돌려 만든다(G2 §2). 카메라는 그대로 두고 인물만 돌린다 — 카메라를
        # 옮기면 층마다 카메라가 갈려 정렬이 깨진다.
        #
        # **`rotation_euler`로 돌리면 안 된다.** VRM 골격은 회전 모드가 쿼터니언이라 그 값이
        # 무시된다. 2026-09-16에 yaw 180을 줬는데 손 위치가 소수점까지 그대로였고, 뒷모습을
        # 구우라고 시킨 렌더가 앞모습으로 나왔다. 행렬을 곱하면 회전 모드와 무관하게 돈다.
        if yaw:
            each.matrix_world = Matrix.Rotation(radians(yaw), 4, 'Z') @ each.matrix_world
    bpy.context.view_layer.update()

    # **카메라 상자는 몸만 보고 잡는다.** 무기 · 상의를 넣으면 머리 위로 올라간 지팡이까지
    # 담으려고 배율이 줄어 인물이 층마다 다른 크기로 나온다(실측: 몸 층 `ortho_scale` 1.118 대
    # 지팡이 층 2.363). G4 §3이 「무기와 상의는 이 계산에 넣지 않는다」로 정한 것이 이 자리다.
    body_lo, body_hi = common.object_bounds(body_objects)

    if layer in ('staff', 'shield'):
        with open(weapon_spec_path, encoding='utf-8') as handle:
            spec = json.load(handle)
        weapon = attach_weapon(armature, spec, WEAPON_HAND[layer], yaw)
        detail['weapon'] = weapon.name
        # 무기가 어디에 놓였는지를 그림이 아니라 숫자로 남긴다. 「보이지 않는다」가 가림 때문인지
        # 자리 때문인지를 렌더를 열지 않고 가를 수 있어야 한다.
        hand_bone = armature.pose.bones[WEAPON_HAND[layer]]
        weapon_lo, weapon_hi = common.object_bounds([weapon])
        detail['weapon_z'] = [round(weapon_lo.z, 4), round(weapon_hi.z, 4)]
        detail['weapon_x'] = [round(weapon_lo.x, 4), round(weapon_hi.x, 4)]
        detail['hand_world'] = [
            round(v, 4) for v in (armature.matrix_world @ hand_bone.head)
        ]

    # 가림을 끄고 굽는 길을 둔다. 층이 비어 나올 때 그것이 **가려져서**인지 **애초에 없어서**인지
    # 를 가르는 유일한 수단이고, 둘은 고칠 곳이 완전히 다르다.
    skip_holdout = common.parse_arg(args, 'no-holdout') is not None
    held_out = 0 if (layer == 'body' or skip_holdout) else move_to_holdout(body_objects)

    camera = common.setup_camera(
        body_lo, body_hi, base_width, base_height, foot_row=foot_row, head_row=head_row
    )

    # 층 캔버스를 키운다. 카메라는 몸 규격 그대로 두고 `ortho_scale`만 비례로 늘리므로 인물
    # 크기는 안 변하고 주변이 더 보인다(ADR 009). 무기가 캔버스를 넘을 때 **전체를 봐야**
    # 어디를 쥐었는지 판정할 수 있어서, 탐침에도 이 길이 필요하다.
    layer_width = int(common.parse_arg(args, 'layer-width') or base_width)
    layer_height = int(common.parse_arg(args, 'layer-height') or base_height)
    if layer_width % 2 != base_width % 2 or layer_height % 2 != base_height % 2:
        raise common.GateError(
            'camera-framing',
            '층 캔버스 {0}×{1}이 기준 {2}×{3}과 홀짝이 다르다 — 중심이 0.5px 밀린다'.format(
                layer_width, layer_height, base_width, base_height
            ),
        )
    per_pixel = (body_hi.z - body_lo.z) / float(foot_row - head_row)
    camera.data.ortho_scale = per_pixel * max(layer_width, layer_height)
    common.setup_lights()
    common.setup_render(engine, layer_width, layer_height, absolute_out)
    view_transform = set_standard_view_transform()
    common.render_still(absolute_out)

    payload = {
        'gate': 'g2-probe',
        'blender': bpy.app.version_string,
        'engine': engine,
        'layer': layer,
        'yaw': yaw,
        'held_out_objects': held_out,
        'view_transform': view_transform,
        'ortho_scale': round(camera.data.ortho_scale, 6),
        'layer_canvas': [layer_width, layer_height],
        'body_x': [round(body_lo.x, 4), round(body_hi.x, 4)],
        'body_y': [round(body_lo.y, 4), round(body_hi.y, 4)],
        'output': absolute_out.replace(os.sep, '/'),
    }
    payload.update(detail)
    common.gate_ok(payload)


if __name__ == '__main__':
    common.run(main)
