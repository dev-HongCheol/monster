"""
G3 — 키프레임 정의가 준 자세를 프레임마다 입혀 한 프로세스에서 여러 장을 굽는다.

**한 프로세스에서 여러 장을 굽는 이유는 시간이다.** `probe_layers.py`는 한 장마다 Blender를 새로 띄우는데,
한 장 11초 가운데 렌더는 2~3초이고 나머지가 시작과 `.vrm` 불러오기다(2026-09-17 실측). 걷기 후보 넷을
세 방향 · 열두 위상으로 구우면 144장이라, 한 장씩 띄우면 불러오기만 스무 분이 넘는다.

**자세는 계산하지 않고 받은 값을 입히기만 한다.** 위상에서 각도를 내는 식, 허리 높이, 접지는 전부
`MotionSpec.ts`에 있고 vitest가 단언한다. 여기서 같은 계산을 다시 하면 굽기와 단언이 다른 자세를 보게 된다.

**팔은 프레임마다 다시 입힌다.** 팔 자세(`retarget_render.BASE_ARM_POSE`)는 본의 방향을 직접 정하는 값인데,
입히는 순간의 부모 자세에 맞춰 로컬 회전으로 저장된다. 그래서 그 뒤에 가슴을 비틀면 팔이 함께 돌아가
지팡이가 기운다. 윗몸을 먼저 입히고 그다음에 팔을 입혀야 팔이 늘 같은 방향을 본다.

**무기는 프레임마다 손 위치로 옮긴다.** `probe_layers.attach_weapon`은 무기를 본에 부모로 붙이지 않고 월드에
곧게 세운다(그 함수의 주석이 이유를 든다). 자세가 한 판일 때는 그것으로 충분했지만, 여기서는 몸이 오르내리고
가슴이 비틀려 손이 움직이므로 붙일 때 잰 「손 → 무기 원점」 거리를 프레임마다 손 위치에 더한다. 회전은 그대로
둔다 — 지팡이를 곧게 세워 쥔다는 결정이 그대로다.

**재는 값은 모델 좌표로 돌려준다.** 방향(`--yaw`)은 모델을 돌려 만들므로 월드 좌표로 재면 방향마다 축이
달라진다. G3 §4가 「모델 기준의 좌우 축으로 잰다」고 정한 것도 같은 이유다. 판정은 하지 않는다 — 재는 것은
실행기(`retired/motion.ts`, G4부터는 생산 굽기 도구 `bake.ts`)다.

**G4의 층 굽기도 이 파일이 한다(`--layer`).** `body`는 맨살 판만, `top`은 상의 판(`--top-vrm`)에서 `Tops`
머티리얼의 면만, `staff` · `shield`는 그 무기만 굽는다. 몸이 아닌 층은 맨살 몸을 가림 전용(Holdout)으로 두어
몸에 가려진 픽셀이 투명하게 나온다(`probe_layers.py` 머리 주석). `whole`은 받은 판에 받은 무기를 들려 가림 없이
한 장으로 굽는 기준 컷이고, `--layer`를 안 주면 이것이다. 상의 층은 골격이 둘이라 프레임마다 두 골격에 같은
자세를 입힌다 — 한쪽만 입히면 상의가 몸에서 떨어진다.

**`--camera`를 주면 몸 상자를 재지 않고 기록된 카메라를 그대로 쓴다.** 생산 굽기는 늘 이 길이다. 이유와
기록의 모양은 `_common.setup_recorded_camera`에 있다.

돌리는 법과 실패 코드 표는 `tools/blender/README.md`에 있다.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import _common as common  # noqa: E402 - 위 경로 주입 뒤에 와야 한다
import bpy  # noqa: E402
import probe_layers as probe  # noqa: E402 - 무기 붙이기 · 색 관리의 주인이다
import retarget_render as retarget  # noqa: E402 - 기준 팔 자세의 주인이다
import toon  # noqa: E402 - 툰 사양 입히기의 주인이다

# `probe_layers`는 `main()` 안에서 `bpy`를 전역으로 올린다. 그 `main()`을 거치지 않고 함수만 빌려 쓰므로
# 여기서 올려 준다. 안 올리면 `attach_weapon`이 `NameError`로 죽는데, 메시지가 이 파일을 가리키지 않는다.
probe.bpy = bpy

# 발 메시를 고르는 버텍스 그룹. 이 본들에 절반 넘게 물린 정점을 그 발의 정점으로 본다.
FOOT_GROUPS = {
    'L': ('J_Bip_L_Foot', 'J_Bip_L_ToeBase'),
    'R': ('J_Bip_R_Foot', 'J_Bip_R_ToeBase'),
}

# 굽는 층. `whole`은 층이 아니라 가림 없이 한 장으로 굽는 기준 컷이다.
LAYERS = ('body', 'top', 'staff', 'shield', 'whole')

# 층마다 드는 무기. `whole`은 받은 것을 전부 들고, 몸 · 상의 층은 아무것도 안 든다.
LAYER_WEAPONS = {'staff': ('staff',), 'shield': ('shield',), 'whole': ('staff', 'shield')}

# 좌표를 돌려주는 본. 발목 좌우 이동 · 머리 흔들림 · 손 위치를 실행기가 잰다.
REPORT_BONES = (
    'J_Bip_C_Hips',
    'J_Bip_C_Head',
    'J_Bip_L_Foot',
    'J_Bip_R_Foot',
    'J_Bip_L_ToeBase',
    'J_Bip_R_ToeBase',
    'J_Bip_L_Hand',
    'J_Bip_R_Hand',
)


def apply_model_delta_pose(armature, angles_by_bone, order):
    """
    각도를 **모델 축에서 정지 자세에 곱하는 델타**로 보고 입힌다.

    `_common.apply_world_delta_pose`와 같은 식인데 월드가 아니라 아마추어 좌표에서 곱한다. 월드에서 곱하면
    모델을 `--yaw`로 돌린 뒤에는 「앞뒤로 흔든다」가 카메라 기준 앞뒤가 되어, 옆모습에서 다리가 좌우로 벌어진다.
    프레임마다 자세를 다시 입혀야 하므로 돌리기 전에 한 번 입히는 길은 쓸 수 없다.

    @param armature 포즈를 입힐 아마추어 오브젝트
    @param angles_by_bone `[(본 이름, (x, y, z)), ...]` — 각도는 도 단위. 부모가 자식보다 앞에 온다
    @param order 오일러 회전 순서 문자열
    """
    from math import radians

    from mathutils import Euler

    for name, angles in angles_by_bone:
        bone = armature.pose.bones.get(name)
        if bone is None:
            raise common.GateError(
                'retarget-bone', '자세가 쓰는 본을 이 골격에서 못 찾았다: {0}'.format(name)
            )
        rest = armature.data.bones[name].matrix_local
        delta = Euler([radians(a) for a in angles], order).to_quaternion()
        wanted = (delta @ rest.to_quaternion()).to_matrix().to_4x4()
        wanted.translation = bone.matrix.translation
        bone.matrix = wanted
        bpy.context.view_layer.update()


def reset_pose(armature, keep):
    """`keep`에 없는 본을 전부 정지 자세로 되돌린다. 손가락은 한 번 입힌 로컬 회전을 그대로 둔다."""
    from mathutils import Matrix

    for bone in armature.pose.bones:
        if bone.name in keep:
            continue
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


def apply_frame(armature, frame):
    """프레임 하나의 자세를 입힌다 — 허리 이동, 받은 본들, 그다음 팔."""
    from mathutils import Vector

    reset_pose(armature, retarget.BASE_FINGER_POSE)

    hips = armature.pose.bones.get('J_Bip_C_Hips')
    if hips is None:
        raise common.GateError('retarget-bone', '허리 본(J_Bip_C_Hips)이 없다')
    moved = hips.matrix.copy()
    moved.translation = moved.translation + Vector(frame['hips'])
    hips.matrix = moved
    bpy.context.view_layer.update()

    apply_model_delta_pose(armature, [(name, angles) for name, angles in frame['bones']], 'XYZ')
    apply_model_delta_pose(armature, list(retarget.BASE_ARM_POSE.items()), retarget.BASE_POSE_ORDER)


def foot_vertex_indices(body):
    """몸 메시에서 왼발 · 오른발에 절반 넘게 물린 정점 번호."""
    found = {}
    for side, names in FOOT_GROUPS.items():
        groups = {body.vertex_groups[n].index for n in names if n in body.vertex_groups}
        indices = []
        for vertex in body.data.vertices:
            weight = sum(g.weight for g in vertex.groups if g.group in groups)
            if weight > 0.5:
                indices.append(vertex.index)
        found[side] = indices
    return found


def measure(armature, body, feet):
    """
    지금 자세에서 본 위치와 발바닥을 모델 좌표로 잰다.

    발바닥 높이는 본이 아니라 **변형된 메시**에서 잰다. 접지 계산(`MotionSpec.ts`)은 다리를 막대로 보고
    발바닥 세 점만 따지는데, 실제 신발은 스키닝으로 휘므로 계산이 맞는지는 메시를 봐야 안다.
    """
    from mathutils import Vector

    out = {'bones': {}, 'sole_min_z': {}, 'sole_front_deg': {}}
    for name in REPORT_BONES:
        bone = armature.pose.bones.get(name)
        if bone is not None:
            out['bones'][name] = [round(v, 5) for v in bone.head]

    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = body.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    # 메시 좌표를 아마추어(모델) 좌표로 — 둘 다 같은 월드 회전을 받았으므로 월드를 거쳐 되돌린다
    to_model = armature.matrix_world.inverted() @ evaluated.matrix_world
    try:
        for side, indices in feet.items():
            lowest = min((to_model @ mesh.vertices[i].co).z for i in indices) if indices else None
            out['sole_min_z'][side] = None if lowest is None else round(lowest, 5)
    finally:
        evaluated.to_mesh_clear()

    # 발바닥이 앞(카메라 쪽, 모델 −Y)을 얼마나 향하나. 발 본의 정지 자세에서 아래(−Z)이던 방향을 지금 자세로
    # 옮겨 앞 성분을 본다. 0이면 발바닥이 땅을 보고, 양수면 정면 카메라에 발바닥이 그만큼 보인다.
    from math import asin, degrees

    for side in ('L', 'R'):
        name = 'J_Bip_{0}_Foot'.format(side)
        bone = armature.pose.bones.get(name)
        if bone is None:
            continue
        rest = armature.data.bones[name].matrix_local.to_3x3()
        now = bone.matrix.to_3x3()
        sole = (now @ rest.inverted()) @ Vector((0.0, 0.0, -1.0))
        out['sole_front_deg'][side] = round(degrees(asin(max(-1.0, min(1.0, -sole.y)))), 3)
    return out


def main():
    from math import radians

    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Matrix, Vector

    args = common.script_args()
    vrm = common.parse_arg(args, 'vrm')
    frames_path = common.parse_arg(args, 'frames')
    out_dir = common.parse_arg(args, 'out-dir')
    yaw = float(common.parse_arg(args, 'yaw') or 0.0)
    pitch = float(common.parse_arg(args, 'pitch') or 0.0)
    layer = common.parse_arg(args, 'layer') or 'whole'
    top_vrm = common.parse_arg(args, 'top-vrm')
    camera_path = common.parse_arg(args, 'camera')

    if not vrm:
        raise common.GateError('vrm-path', '`-- --vrm <경로>`를 받지 못했다')
    if layer not in LAYERS:
        raise common.GateError(
            'weapon-spec', 'layer는 {0} 중 하나여야 한다 (받은 값 {1})'.format(' · '.join(LAYERS), layer)
        )
    if layer == 'top' and not top_vrm:
        raise common.GateError('vrm-path', '상의 층에는 `--top-vrm <경로>`가 필요하다')
    if camera_path and not os.path.exists(camera_path):
        raise common.GateError('camera-record', '카메라 기록이 없다: {0}'.format(camera_path))
    if not frames_path or not os.path.exists(frames_path):
        raise common.GateError(
            'motion-path', '키프레임 정의 JSON이 없다: {0} — `MotionSpec.ts`의 값을 JSON으로 써서 넘기는 실행기를 거쳐 부른다'.format(frames_path)
        )
    if not out_dir:
        raise common.GateError('output-path', '`-- --out-dir <폴더>`를 받지 못했다')

    base_width = common.parse_int_arg(args, 'width')
    base_height = common.parse_int_arg(args, 'height')
    foot_row = common.parse_int_arg(args, 'foot-row')
    head_row = common.parse_int_arg(args, 'head-row')
    layer_width = int(common.parse_arg(args, 'layer-width') or base_width)
    layer_height = int(common.parse_arg(args, 'layer-height') or base_height)
    if layer_width % 2 != base_width % 2 or layer_height % 2 != base_height % 2:
        raise common.GateError(
            'camera-framing',
            '층 캔버스 {0}×{1}이 기준 {2}×{3}과 홀짝이 다르다 — 중심이 0.5px 밀린다'.format(
                layer_width, layer_height, base_width, base_height
            ),
        )

    with open(frames_path, encoding='utf-8') as handle:
        definition = json.load(handle)
    frames = definition.get('frames') or []
    if not frames:
        raise common.GateError('motion-action', '키프레임 정의에 프레임이 없다: {0}'.format(frames_path))

    common.assert_version()
    engine = common.pick_eevee()

    record = None
    if camera_path:
        with open(camera_path, encoding='utf-8') as handle:
            record = json.load(handle)
        common.assert_camera_record(record)

    armature = common.import_vrm(vrm)
    # 모델 축 = 월드 축이어야 `apply_model_delta_pose`의 각도와 `measure`의 좌표가 계획대로 읽힌다
    identity = Matrix.Identity(4)
    if any(
        abs(armature.matrix_world[r][c] - identity[r][c]) > 1e-6 for r in range(4) for c in range(4)
    ):
        raise common.GateError('vrm-path', '임포트한 아마추어의 월드 행렬이 단위 행렬이 아니다')
    body_objects = list(probe.scene_meshes())
    body = next((o for o in body_objects if o.name.startswith('Body')), None)
    if body is None:
        raise common.GateError('vrm-path', '`Body` 메시가 없다 — 발바닥을 잴 수 없다')
    feet = foot_vertex_indices(body)

    detail = {}
    armatures = [armature]
    # 상의 층은 상의 판을 하나 더 들여와 `Tops` 머티리얼의 면만 남긴다(`probe_layers.keep_only_materials`의
    # 주석이 이유를 든다). 얼굴 · 머리카락은 맨살 판 것이 이미 있으므로 지운다 — 두 벌을 겹치면 같은 자리에
    # 두 번 그려져 알파 경계가 두꺼워진다.
    if layer == 'top':
        top_armature, added = common.append_vrm(top_vrm)
        armatures.append(top_armature)
        kept = 0
        for obj in added:
            if obj.type != 'MESH':
                continue
            if obj.name.startswith('Body'):
                kept = probe.keep_only_materials(obj, 'Tops')
            else:
                bpy.data.objects.remove(obj, do_unlink=True)
        detail['top_faces'] = kept

    # 기준 자세(팔 · 손가락)로 몸 상자를 잰다. 카메라는 걷는 자세가 아니라 이 자세에 맞춘다 — 후보마다
    # 카메라가 달라지면 나란히 놓았을 때 인물 크기가 후보마다 다르다. 걷기의 오르내림은 층 캔버스 여백이 받는다.
    # (기록된 카메라를 받으면 이 상자는 쓰지 않는다.)
    for each in armatures:
        common.apply_world_delta_pose(each, retarget.BASE_ARM_POSE, retarget.BASE_POSE_ORDER)
        common.apply_local_pose(each, retarget.BASE_FINGER_POSE, 'XYZ')
    bpy.context.view_layer.update()
    body_lo, body_hi = common.object_bounds(body_objects)

    if yaw:
        for each in armatures:
            each.matrix_world = Matrix.Rotation(radians(yaw), 4, 'Z') @ each.matrix_world
    bpy.context.view_layer.update()

    # 무기는 기준 자세의 손에 붙이고, 손에서 무기 원점까지의 거리를 기억해 프레임마다 다시 놓는다
    carried = []
    for kind, flag in (('staff', 'staff-spec'), ('shield', 'shield-spec')):
        if kind not in LAYER_WEAPONS.get(layer, ()):
            continue
        path = common.parse_arg(args, flag)
        if not path:
            # 기준 컷은 받은 무기만 든다. 무기 층은 그 무기가 곧 내용이라 사양이 없으면 구울 것이 없다
            if layer == 'whole':
                continue
            raise common.GateError('weapon-spec', '{0} 층에는 `--{1} <경로>`가 필요하다'.format(layer, flag))
        with open(path, encoding='utf-8') as handle:
            weapon = probe.attach_weapon(armature, json.load(handle), probe.WEAPON_HAND[kind], yaw)
        hand = armature.pose.bones[probe.WEAPON_HAND[kind]]
        offset = weapon.matrix_world.translation - (armature.matrix_world @ hand.head)
        carried.append((weapon, hand, offset.copy()))

    # 몸이 아닌 층은 맨살 몸을 가림 전용으로 둔다. `--no-holdout`은 층이 비어 나올 때 가려져서인지 애초에
    # 없어서인지를 가르는 수단이다 — 둘은 고칠 곳이 완전히 다르다.
    skip_holdout = common.parse_arg(args, 'no-holdout') is not None
    held_out = 0
    if layer in ('top', 'staff', 'shield') and not skip_holdout:
        held_out = probe.move_to_holdout(body_objects)
    detail['held_out_objects'] = held_out

    # 툰 사양은 무기를 붙인 **뒤에** 입힌다. 앞에서 입히면 뒤에 세운 부품만 Principled BSDF로 남는다
    toon_path = common.parse_arg(args, 'toon')
    toon_spec = None
    if toon_path:
        with open(toon_path, encoding='utf-8') as handle:
            toon_spec = json.load(handle)
        detail['toon'] = toon_spec.get('id')
        detail['toon_materials'] = len(toon.apply_to_materials(toon_spec))

    if record is not None:
        camera = common.setup_recorded_camera(record, layer_width, layer_height)
        per_pixel = record['per_pixel_m']
        pitch = record['pitch_deg']
    else:
        camera = common.setup_camera(
            body_lo, body_hi, base_width, base_height, foot_row=foot_row, head_row=head_row, pitch=pitch
        )
        per_pixel = (body_hi.z - body_lo.z) / float(foot_row - head_row)
        camera.data.ortho_scale = per_pixel * max(layer_width, layer_height)
    if toon_spec is None or toon.setup_lights(toon_spec) is None:
        common.setup_lights()

    out_dir = os.path.abspath(out_dir)
    first = common.assert_output_path(os.path.join(out_dir, frames[0]['name'] + '.png'))
    common.setup_render(engine, layer_width, layer_height, first)
    view_transform = probe.set_standard_view_transform()

    measured = []
    for frame in frames:
        for each in armatures:
            apply_frame(each, frame)
        for weapon, hand, offset in carried:
            placed = weapon.matrix_world.copy()
            placed.translation = (armature.matrix_world @ hand.head) + offset
            weapon.matrix_world = placed
        bpy.context.view_layer.update()

        out_path = common.assert_output_path(os.path.join(out_dir, frame['name'] + '.png'))
        bpy.context.scene.render.filepath = out_path
        common.render_still(out_path)

        row = measure(armature, body, feet)
        row['name'] = frame['name']
        row['phase'] = frame.get('phase')
        measured.append(row)

    ground = world_to_camera_view(bpy.context.scene, camera, Vector((0.0, 0.0, 0.0)))
    payload = {
        'gate': 'g3-motion',
        'id': definition.get('id'),
        'layer': layer,
        'blender': bpy.app.version_string,
        'vrm_addon': common.vrm_addon_version(),
        'engine': engine,
        'yaw': yaw,
        'pitch': pitch,
        'view_transform': view_transform,
        'ortho_scale': round(camera.data.ortho_scale, 6),
        'per_pixel_m': round(per_pixel, 9),
        'layer_canvas': [layer_width, layer_height],
        'ground_px': [round(ground.x * layer_width, 2), round((1.0 - ground.y) * layer_height, 2)],
        'foot_vertices': {side: len(indices) for side, indices in feet.items()},
        'frames': measured,
        'output_dir': out_dir.replace(os.sep, '/'),
    }
    payload.update(detail)
    common.gate_ok(payload)


if __name__ == '__main__':
    common.run(main)
