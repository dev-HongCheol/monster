"""
G3 — 키프레임 정의가 준 자세를 프레임마다 입혀 한 프로세스에서 여러 장을 굽는다.

**한 프로세스에서 여러 장을 굽는 이유는 시간이다.** G2의 층 탐침은 한 장마다 Blender를 새로 띄웠는데,
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
실행기다(G3의 `retired/motion.ts`는 G4를 닫으며 지웠고, 지금은 생산 굽기 도구 `bake.ts`가 잰다).

**G4의 층 굽기도 이 파일이 한다(`--layer`).** `body`는 맨살 판만, `top`은 상의 판(`--top-vrm`)에서 `Tops`
머티리얼의 면만, `staff` · `shield`는 그 무기만 굽는다. 몸이 아닌 층은 맨살 몸을 가림 전용(Holdout)으로 두어
몸에 가려진 픽셀이 투명하게 나온다(`probe_layers.py` 머리 주석). `whole`은 받은 판에 받은 무기를 들려 가림 없이
한 장으로 굽는 기준 컷이고, `--layer`를 안 주면 이것이다. 상의 층은 골격이 둘이라 프레임마다 두 골격에 같은
자세를 입힌다 — 한쪽만 입히면 상의가 몸에서 떨어진다.

**`--camera`를 주면 몸 상자를 재지 않고 기록된 카메라를 그대로 쓴다.** 생산 굽기는 늘 이 길이다. 이유와
기록의 모양은 `_common.setup_recorded_camera`에 있다.

**장비(`--gear-spec`)는 무기와 달리 붙은 본을 회전까지 그대로 따라간다.** 무기는 손이 어디로 가든 곧게 서 있어야
해서 위치만 옮기지만, 부츠나 다리에 붙는 조각은 정강이가 굽으면 함께 기울어야 한다. 위치만 옮기면 걷는 동안
부츠가 곧게 선 채로 다리를 뚫고 나온다. 그래서 기준 자세에서 세운 뒤 「본에서 본 장비의 자리」를 기억해 두고,
프레임마다 그 본의 지금 자세에 그 자리를 다시 곱한다. 본에 부모로 붙이지 않는 이유는 `probe_layers.attach_weapon`의
주석에 있다(본의 꼬리가 원점이 되어 자리가 밀린다). 사양은 조각 하나(`bone` · `parts`)이거나 조각 여럿
(`pieces`)이다 — 두 다리에 따로 붙는 부츠처럼 본이 여럿인 장비가 있어서다. `gear` 층은 맨살 몸을 가림 전용으로
두고 장비만 굽고, `whole`은 받은 장비를 함께 굽는다. `top` 층에 주면 상의의 면과 장비를 한 층으로 굽는다(넓은
소매처럼 상의의 일부인 부피). `--occluder-gear-spec`은 다른 장비를 하나 더 세워 그리지 않고
가리기만 하게 한다 — 두 장비가 서로를 가림 전용으로 두고 구운 판을 만든다. G4 §12의 슬롯 범위 탐침이 쓴다.

**`top` 층이 남기는 머티리얼은 `--keep-material`로 바꾼다(기본 `Tops`).** 하의 · 신발도 상의처럼 `Body` 메시
안에 머티리얼로만 갈려 있어서, `Bottoms`나 `Shoes`의 면만 남기면 그 층이 된다. 그 층들의 몸은
`--drop-materials Bottoms,Shoes`로 세운다 — `--vrm`으로 받은 판의 몸 메시에서 그 머티리얼의 면을 지워 맨몸을
남긴다(`drop_materials`의 주석이 옷을 전부 끈 판을 따로 안 쓰는 이유를 든다). 몸 층으로 구우면 맨몸 층이 되고,
다른 층에서는 그 맨몸이 가림 전용 몸이 된다.

**머리카락은 오브젝트로 떼고 평면으로 가른다(`--layer hair` · `--drop-objects` · `--split-keep`).** VRoid는
머리카락을 옷과 달리 `Hair` 오브젝트로 따로 내보낸다. `--drop-objects Hair`는 그 오브젝트를 지워 머리카락 없는
몸을 남기고(몸 층 · 가림 전용 몸 · 기준 컷 어디에나 쓴다), `hair` 층은 머리카락만 굽고 나머지를 가림 전용으로
둔다. `--split-keep near|far`는 머리카락을 카메라에서 가까운 쪽과 먼 쪽으로 갈라 한쪽만 남긴다 — 먼 쪽은 몸
아래에, 가까운 쪽은 몸과 옷 위에 그리는 두 층이 된다(`split_by_plane`의 주석이 가르는 기준을 든다).

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

# `probe_layers`의 함수는 전역 `bpy`를 쓰고, 그 값은 부르는 쪽이 넣는다. 안 넣으면 `attach_weapon`이
# `None`의 속성을 읽다 죽는데, 메시지가 이 파일을 가리키지 않는다.
probe.bpy = bpy

# 발 메시를 고르는 버텍스 그룹. 이 본들에 절반 넘게 물린 정점을 그 발의 정점으로 본다.
FOOT_GROUPS = {
    'L': ('J_Bip_L_Foot', 'J_Bip_L_ToeBase'),
    'R': ('J_Bip_R_Foot', 'J_Bip_R_ToeBase'),
}

# 굽는 층. `whole`은 층이 아니라 가림 없이 한 장으로 굽는 기준 컷이다.
LAYERS = ('body', 'top', 'staff', 'shield', 'gear', 'hair', 'whole')

# 맨살 몸을 가림 전용으로 두고 굽는 층. 몸 층과 기준 컷만 빠진다.
HELD_OUT_LAYERS = ('top', 'staff', 'shield', 'gear', 'hair')

# 머리카락 오브젝트의 이름 머리말. VRoid는 머리카락을 이 이름의 메시 하나로 내보낸다(2026-09-21 덤프).
HAIR_PREFIX = 'Hair'

# 머리카락을 가르는 평면이 지나는 본. 머리카락은 이 본에 붙어 움직이므로 평면도 머리를 따라간다.
SPLIT_BONE = 'J_Bip_C_Head'

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


def drop_materials(obj, needles):
    """
    메시에서 이름에 `needles` 가운데 하나라도 든 머티리얼의 면을 지운다. `probe_layers.keep_only_materials`의 반대다.

    하의 · 신발을 층으로 뗄 때 몸 층과 가림 전용 몸을 이것으로 세운다. 옷을 전부 끈 판을 따로 내보내 쓰지 않는
    이유는 그 판이 신발 밑창만큼 통째로 내려가 있고 발 모양도 달라서다(2026-09-21 실측 16.23mm — G4 §12).
    맨살 판은 바지와 신발 아래에 살을 그대로 갖고 있어서, 옷의 면만 지우면 다른 층과 좌표가 같은 맨몸이 남는다.

    말에 맞는 머티리얼이 하나도 없으면 실패한다 — 이름이 바뀌어 아무것도 못 지웠는데 굽기가 그대로 돌면, 옷을
    입은 몸이 맨몸 층으로 실린다.

    @returns 지운 면 수
    """
    import bmesh

    doomed_slots = set()
    for needle in needles:
        hits = {
            index
            for index, slot in enumerate(obj.material_slots)
            if slot.material is not None and needle in slot.material.name
        }
        if not hits:
            names = [s.material.name if s.material else '(없음)' for s in obj.material_slots]
            raise common.GateError(
                'weapon-spec',
                '{0}에 "{1}"가 든 머티리얼이 없다 (있는 것: {2})'.format(obj.name, needle, names),
            )
        doomed_slots |= hits

    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    doomed = [f for f in mesh.faces if f.material_index in doomed_slots]
    bmesh.ops.delete(mesh, geom=doomed, context='FACES')
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()
    return len(doomed)


def drop_objects(objects, needles):
    """
    이름이 `needles` 가운데 하나로 시작하는 메시 오브젝트를 장면에서 지우고 남은 목록을 돌려준다.

    머리카락을 층으로 뗄 때 쓴다. 가림 전용 몸에 머리카락이 남아 있으면 머리카락에 가린 상의 픽셀이 투명하게
    구워져 상의 층에 머리카락 모양의 구멍이 난다. 머리카락이 늘 같으면 그 구멍은 머리카락이 덮지만, 머리카락을
    바꾸거나 끄면 구멍으로 아래의 살이 비친다.

    말에 맞는 오브젝트가 하나도 없으면 실패한다 — 이름이 바뀌어 아무것도 못 지웠는데 굽기가 그대로 돌면,
    머리카락이 든 몸이 머리카락 없는 몸으로 실린다.

    @returns 남은 오브젝트의 목록
    """
    doomed = []
    for needle in needles:
        hits = [o for o in objects if o.name.startswith(needle)]
        if not hits:
            raise common.GateError(
                'weapon-spec',
                '이름이 "{0}"로 시작하는 메시가 없다 (있는 것: {1})'.format(needle, [o.name for o in objects]),
            )
        doomed.extend(o for o in hits if o not in doomed)
    left = [o for o in objects if o not in doomed]
    for obj in doomed:
        bpy.data.objects.remove(obj, do_unlink=True)
    return left


def split_by_plane(obj, armature, yaw, keep):
    """
    메시를 머리 본을 지나는 수직 평면으로 갈라, 카메라에서 가까운 쪽(`near`)이나 먼 쪽(`far`)만 남긴다.

    머리카락을 두 층으로 가르는 데 쓴다. 옷은 맨살 몸보다 나와 있어서, 맨살 몸만 가림 전용으로 두고 구운
    머리카락을 옷 위에 그리면 몸 뒤로 늘어진 머리카락이 어깨 · 소매 앞에 그려진다. 옷까지 가림 전용으로 두면
    머리카락 층을 옷마다 다시 구워야 한다. 그래서 몸 뒤의 머리카락을 따로 떼어 몸과 옷 아래에 그린다.

    **평면은 카메라의 클립 면이 아니라 모델 좌표의 수직면이다.** 카메라가 15° 내려다보므로 클립 면은 그만큼
    기울어 있고, 머리 높이에서 몸의 중심을 지나게 맞추면 30cm 아래 허리에서는 카메라 쪽으로 8cm 나와 있다.
    뒷모습에서 그 자리는 등을 덮은 긴 머리카락의 두께 안이라, 등 위에 보여야 할 머리카락의 일부가 「먼 쪽」으로
    갈려 몸 아래에 깔린다. 수직면은 높이에 따라 옮겨 가지 않는다.

    **정지 자세의 메시를 가른다.** 머리카락은 머리 본에 붙어 움직이므로, 정지 자세에서 머리 본의 머리를 지나게
    가른 면은 걷는 동안 머리를 따라간다. 프레임마다 가르면 가른 자리가 프레임마다 달라져 두 층의 경계가 떤다.

    평면의 방향은 방향(`yaw`)에만 달려 있고 옷과 무관하다 — 그래야 머리카락 층을 옷마다 다시 굽지 않는다.
    모델을 Z축으로 `yaw`만큼 돌려 −Y의 카메라 앞에 세우므로, 카메라에서 멀어지는 방향(세계 +Y)은 모델
    좌표에서 `(sin yaw, cos yaw, 0)`이다.

    @param armature 돌리기 전의 아마추어(모델 좌표 = 세계 좌표)
    @param yaw 모델을 돌릴 각(도)
    @param keep `near`면 카메라 쪽 절반, `far`면 반대쪽 절반을 남긴다
    @returns 가르기 전과 뒤의 면 수 `(before, after)`
    """
    from math import cos, radians, sin

    import bmesh
    from mathutils import Vector

    bone = armature.data.bones.get(SPLIT_BONE)
    if bone is None:
        raise common.GateError('retarget-bone', '가르는 평면이 지날 본이 없다: ' + SPLIT_BONE)
    if obj.data.shape_keys is not None:
        # 셰이프 키가 있는 메시는 위상을 바꿔 되쓰면 키의 정점 수가 어긋난다. VRoid 머리카락에는 없다
        raise common.GateError('weapon-spec', '{0}에 셰이프 키가 있어 가를 수 없다'.format(obj.name))

    to_local = obj.matrix_world.inverted()
    point = to_local @ (armature.matrix_world @ bone.head_local)
    far = to_local.to_3x3() @ Vector((sin(radians(yaw)), cos(radians(yaw)), 0.0))

    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    before = len(mesh.faces)
    # `clear_outer`는 법선이 가리키는 쪽(먼 쪽)을, `clear_inner`는 그 반대쪽을 지운다
    bmesh.ops.bisect_plane(
        mesh,
        geom=mesh.verts[:] + mesh.edges[:] + mesh.faces[:],
        dist=1e-6,
        plane_co=point,
        plane_no=far,
        clear_outer=(keep == 'near'),
        clear_inner=(keep == 'far'),
    )
    after = len(mesh.faces)
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()
    return before, after


def gear_pieces(spec):
    """장비 사양을 조각의 목록으로 편다. 조각 하나짜리 사양(`bone` · `parts`)과 여럿짜리(`pieces`)를 둘 다 받는다."""
    pieces = spec.get('pieces') or [spec]
    for piece in pieces:
        if not piece.get('bone'):
            raise common.GateError(
                'weapon-spec', '장비 조각에 붙일 본(`bone`)이 없다: {0}'.format(piece.get('id', '(이름 없음)'))
            )
    return pieces


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
    keep_material = common.parse_arg(args, 'keep-material') or 'Tops'
    gear_spec_path = common.parse_arg(args, 'gear-spec')
    camera_path = common.parse_arg(args, 'camera')
    split_keep = common.parse_arg(args, 'split-keep')

    if not vrm:
        raise common.GateError('vrm-path', '`-- --vrm <경로>`를 받지 못했다')
    if layer not in LAYERS:
        raise common.GateError(
            'weapon-spec', 'layer는 {0} 중 하나여야 한다 (받은 값 {1})'.format(' · '.join(LAYERS), layer)
        )
    if layer == 'top' and not top_vrm:
        raise common.GateError('vrm-path', '상의 층에는 `--top-vrm <경로>`가 필요하다')
    if layer == 'gear' and not gear_spec_path:
        raise common.GateError('weapon-spec', 'gear 층에는 `--gear-spec <경로>`가 필요하다')
    if split_keep is not None and (layer != 'hair' or split_keep not in ('near', 'far')):
        raise common.GateError(
            'weapon-spec',
            '`--split-keep`은 hair 층에서 near · far 중 하나로 준다 (받은 값 {0}, 층 {1})'.format(split_keep, layer),
        )
    if gear_spec_path and not os.path.exists(gear_spec_path):
        raise common.GateError('weapon-spec', '장비 사양이 없다: {0}'.format(gear_spec_path))
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
    detail = {}
    dropped_objects = [n for n in (common.parse_arg(args, 'drop-objects') or '').split(',') if n]
    if dropped_objects:
        body_objects = drop_objects(body_objects, dropped_objects)
        detail['dropped_objects'] = dropped_objects
    body = next((o for o in body_objects if o.name.startswith('Body')), None)
    if body is None:
        raise common.GateError('vrm-path', '`Body` 메시가 없다 — 발바닥을 잴 수 없다')

    # 머리카락 층은 머리카락만 굽고 나머지 메시를 가림 전용으로 둔다. 가르는 것은 모델을 돌리기 전에 한다 —
    # 평면을 모델 좌표로 세우므로 아마추어가 아직 세계 축과 나란해야 한다(위의 단위 행렬 검사)
    hair_objects = []
    if layer == 'hair':
        hair_objects = [o for o in body_objects if o.name.startswith(HAIR_PREFIX)]
        if not hair_objects:
            raise common.GateError(
                'weapon-spec',
                '머리카락 메시(`{0}…`)가 없다 (있는 것: {1})'.format(HAIR_PREFIX, [o.name for o in body_objects]),
            )
        if split_keep is not None:
            faces = [split_by_plane(o, armature, yaw, split_keep) for o in hair_objects]
            detail['split'] = {
                'keep': split_keep,
                'faces_before': sum(before for before, _ in faces),
                'faces_after': sum(after for _, after in faces),
            }
    # 옷을 지우는 것은 발의 정점을 고르기 **전에** 한다. 면을 지우면 정점 번호가 밀려서, 먼저 골라 둔 번호는 다른
    # 정점을 가리킨다
    dropped = [n for n in (common.parse_arg(args, 'drop-materials') or '').split(',') if n]
    if dropped:
        detail['dropped_faces'] = drop_materials(body, dropped)
    feet = foot_vertex_indices(body)

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
                kept = probe.keep_only_materials(obj, keep_material)
            else:
                bpy.data.objects.remove(obj, do_unlink=True)
        detail['top_faces'] = kept
        detail['keep_material'] = keep_material

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

    # 장비도 기준 자세에서 세우고, 본에서 본 장비의 자리를 기억해 프레임마다 그 본의 자세에 다시 곱한다.
    # 몸 목록을 넘기는 것은 몸 표면에 붙는 부품(`wrap` · `cap` …)이 몸 메시에 광선을 쏘기 때문이다
    followers = []
    # 상의 층도 장비를 받는다 — 넓은 소매처럼 상의의 일부인 부피는 상의의 면과 한 층으로 구워야 한다. 따로 구우면
    # 소매와 몸판 사이의 앞뒤까지 겹치는 순서로 풀어야 하는데, 한 층 안의 앞뒤는 렌더러가 이미 푼다
    if gear_spec_path and layer in ('gear', 'whole', 'top'):
        with open(gear_spec_path, encoding='utf-8') as handle:
            gear_spec = json.load(handle)
        for piece in gear_pieces(gear_spec):
            gear = probe.attach_weapon(armature, piece, piece['bone'], yaw, body_objects)
            bone = armature.pose.bones[piece['bone']]
            seat = (armature.matrix_world @ bone.matrix).inverted() @ gear.matrix_world
            followers.append((gear, bone, seat))

    # 가림 전용 장비(`--occluder-gear-spec`)는 구울 장비와 똑같이 세워 본을 따라가게 하되, 그리지 않고 가리기만
    # 한다. 「서로를 가림 전용으로 둔 판」이 이것이다(G4 §5의 셋째 판) — 부츠를 구울 때 바지를, 바지를 구울 때
    # 부츠를 가림으로 두면 층마다 실제로 보이는 픽셀만 남아 겹치는 순서와 무관하게 기준 컷대로 합성된다. 대가는
    # 조합마다 굽는 것이다. 몸이 아닌 층에서만 뜻이 있다 — 몸 층과 기준 컷은 가림 전용 컬렉션을 안 만든다
    occluding_gear = []
    occluder_spec_path = common.parse_arg(args, 'occluder-gear-spec')
    if occluder_spec_path:
        if layer not in HELD_OUT_LAYERS:
            raise common.GateError(
                'weapon-spec', '`--occluder-gear-spec`은 가림 전용 몸을 두는 층에서만 쓴다 (받은 층 {0})'.format(layer)
            )
        if not os.path.exists(occluder_spec_path):
            raise common.GateError('weapon-spec', '가림 전용 장비의 사양이 없다: {0}'.format(occluder_spec_path))
        with open(occluder_spec_path, encoding='utf-8') as handle:
            occluder_spec = json.load(handle)
        for piece in gear_pieces(occluder_spec):
            gear = probe.attach_weapon(armature, piece, piece['bone'], yaw, body_objects)
            bone = armature.pose.bones[piece['bone']]
            seat = (armature.matrix_world @ bone.matrix).inverted() @ gear.matrix_world
            followers.append((gear, bone, seat))
            occluding_gear.append(gear)
    if followers:
        detail['gear'] = [gear.name for gear, _, _ in followers]

    # 몸이 아닌 층은 맨살 몸을 가림 전용으로 둔다. `--no-holdout`은 층이 비어 나올 때 가려져서인지 애초에
    # 없어서인지를 가르는 수단이다 — 둘은 고칠 곳이 완전히 다르다.
    skip_holdout = common.parse_arg(args, 'no-holdout') is not None
    # `--unoccluded`는 가림 전용 몸을 두지 않고 그 층만 굽는다 — 몸을 렌더에서 아예 뺀다. 몸 아래에 깔리는 층
    # (몸 뒤의 머리카락)은 몸이 어차피 덮으므로 가릴 필요가 없고, 가려 구우면 몸의 윤곽을 따라 두 층의 반투명한
    # 가장자리가 만나 배경이 비친다. `--no-holdout`과 다르다 — 그쪽은 몸을 그대로 함께 굽는 진단용이다
    unoccluded = common.parse_arg(args, 'unoccluded') is not None
    occluders = [o for o in body_objects if o not in hair_objects] + occluding_gear
    held_out = 0
    if layer in HELD_OUT_LAYERS and unoccluded:
        for obj in occluders:
            obj.hide_render = True
    elif layer in HELD_OUT_LAYERS and not skip_holdout:
        held_out = probe.move_to_holdout(occluders)
    detail['held_out_objects'] = held_out
    detail['unoccluded'] = unoccluded

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
        for gear, bone, seat in followers:
            gear.matrix_world = (armature.matrix_world @ bone.matrix) @ seat
        bpy.context.view_layer.update()

        out_path = common.assert_output_path(os.path.join(out_dir, frame['name'] + '.png'))
        bpy.context.scene.render.filepath = out_path
        common.render_still(out_path)

        row = measure(armature, body, feet)
        # 장비가 붙은 본을 회전까지 따라갔는지는 실행기가 판정한다(`LayerBake.ts`의 `gearFollow`). 그러려면 점이
        # 넷 필요하다 — 장비의 원점과 장비 위의 한 점, 본의 머리와 꼬리. 원점 하나만으로는 회전이 안 드러난다:
        # 위치만 옮겨 따라간 장비도 원점은 본 머리에서 늘 같은 거리에 있다. 좌표는 전부 모델 좌표다
        to_model = armature.matrix_world.inverted()
        row['gear'] = {
            gear.name: {
                'bone': bone.name,
                'origin': [round(v, 5) for v in (to_model @ gear.matrix_world.translation)],
                'up': [round(v, 5) for v in (to_model @ (gear.matrix_world @ Vector((0.0, 0.0, 0.1))))],
                'head': [round(v, 5) for v in bone.head],
                'tail': [round(v, 5) for v in bone.tail],
            }
            for gear, bone, _ in followers
        }
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
