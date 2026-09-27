"""
층을 굽는 공용 부품 — 무기 · 장비를 손 본에 붙이기(`attach_weapon`), 가림 전용 몸(`move_to_holdout`), 머티리얼
골라 남기기(`keep_only_materials`), 색 관리(`set_standard_view_transform`). 생산 굽기(`bake_motion.py`)가 import해
쓴다.

**이름이 「탐침」인 이유.** G2에서 층 하나를 가림 전용 몸과 함께 굽는 탐침으로 시작했고, 그 실행 부분(`main`)은
부르는 곳이 없어져 지웠다(2026-09-27 — git 이력). 남은 것은 생산 굽기가 빌려 쓰는 함수뿐이다.

**층을 따로 굽는 이유는 옷과 무기를 갈아입히기 위해서다.** 옷 입은 캐릭터를 한 장에 통째로
구우면 옷만 벗길 수 없다. 그래서 몸을 한 장, 상의를 한 장, 무기를 한 장씩 굽고 게임에서 겹친다.

**가림이 이 방식의 관건이다.** 상의나 무기를 단독으로 구우면 몸에 가려져야 할 픽셀까지 그려진다.
예를 들어 지팡이가 몸통 뒤를 지나는 자세에서, 지팡이만 구우면 몸통에 가린 부분이 그대로 보인다.
그래서 몸을 **Holdout 컬렉션**에 넣는다 — 몸은 렌더에 안 나오면서 뒤에 있는 것을 가리기만 하므로,
몸에 가려진 지팡이 픽셀이 알파 0으로 나온다.

**모든 층을 View Transform `Standard`로 굽는다.** Blender 5.x의 기본은 `AgX`인데, 층마다 이
값이 다르면 같은 픽셀의 색이 층끼리 달라져 겹친 경계에 색띠가 생긴다. `_common.setup_render`가
이 값을 안 건드리므로 `set_standard_view_transform`이 명시한다.

**`bpy`는 부르는 쪽이 넣는다**(`probe.bpy = bpy`). 예전에는 실행 부분이 `bpy`를 전역으로 올렸는데 그 부분을
지워서, 이제 이 파일에는 `bpy`를 올릴 자리가 없다. 안 넣으면 함수가 `None`의 속성을 읽다 죽는다.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import _common as common  # noqa: E402 - 위 경로 주입 뒤에 와야 한다
import toon  # noqa: E402 - 툰 사양 입히기의 주인이다
import weapons  # noqa: E402 - 부품 세우기의 주인이다

# 부르는 쪽이 넣는다 — 위 머리 주석
bpy = None

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


def attach_weapon(armature, spec, bone_name, yaw, body_objects=None):
    """
    부품으로 무기를 세워 본에 붙인다. 망토 · 날개 · 갑옷 같은 장비도 같은 식으로 붙인다.

    무기는 손 본에, 장비는 사양의 `bone`(등이면 `J_Bip_C_UpperChest`)에 붙는다. 어느 쪽이든 사양의
    `grip` 점이 본의 머리 위치에 오고, 부품은 본의 회전이 아니라 캐릭터 방향만 따라 곧게 선다
    (아래 본문 주석).

    @param body_objects 몸 메시 목록. 주면 끈 · 판처럼 몸 표면에 붙는 부품(`weapons.Surface`)을 세울 수 있다
    """
    from math import radians

    from mathutils import Euler, Matrix, Vector

    parts = spec.get('parts') or []
    if not parts:
        raise common.GateError('weapon-spec', '무기 사양에 부품이 없다')

    bone = armature.pose.bones.get(bone_name)
    if bone is None:
        raise common.GateError('retarget-bone', '무기를 붙일 본이 없다: ' + bone_name)

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

    # **놓일 자리를 부품보다 먼저 정한다.** 몸 표면에 붙는 부품(`wrap` · `cap` · `strap` · `snap`)은
    # 부품 좌표의 점을 세계 좌표로 옮겨 몸에 광선을 쏴야 하는데, 그 변환이 `placed`다. 몸 목록이
    # 없으면 그런 부품은 `weapons.build_part`가 실패로 접는다.
    surface = weapons.Surface(body_objects, placed) if body_objects else None
    built = [weapons.build_part(part, surface) for part in parts]
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
