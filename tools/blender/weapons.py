"""
지팡이 · 방패 후보를 프리미티브로 세워 굽는다 — 사람이 하나씩 고를 비교물이다.

**모양의 정의는 이 파일이 아니라 넘겨받는 JSON이다.** 후보 표를 스크립트에 박으면 비율을
고칠 때마다 파이썬을 고치게 되고, 그 값이 레포의 어디에 있는지도 흐려진다. 여기서는 부품
목록(원기둥 · 원뿔 · 구 · 토러스 · 상자)을 그대로 세우기만 하므로, 「손잡이를 더 길게」는
표의 숫자 하나를 바꾸는 일이 된다.

**후보를 전부 같은 배율로 굽는다.** 후보마다 자기 크기에 맞춰 프레이밍하면 작은 지팡이와 큰
방패가 화면에서 같은 크기로 보여, 정작 판정해야 할 크기 비율이 사라진다. 그래서 모든 후보의
상자를 합쳐 배율을 한 번 정하고, 키 기준 막대를 옆에 함께 세운다.

판정은 하지 않는다. 여기서 하는 일은 굽고 경로를 보고하는 것까지이고, 무기 상자 비율을 재는
것은 맨살 몸 렌더가 나온 뒤 TS가 한다.

돌리는 법과 실패 코드 표는 `tools/blender/README.md`에 있다.
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import _common as common  # noqa: E402
from math import radians  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402

# 보는 각도. `front`는 정면(-Y에서 +Y), `three_quarter`는 3/4 각이다.
#
# 둘을 굽는 이유는 실루엣과 두께가 서로 다른 각에서 드러나기 때문이다. 방패는 정면에서 윤곽이
# 보이고 3/4에서 두께가 보이는데, 게임의 옆·대각 방향이 그 3/4에 해당한다.
VIEWS = {
    'front': (0.0, 0.0),
    'three_quarter': (35.0, 18.0),
}


# 부품 머티리얼 이름의 접두사. `toon.py`가 이 접두사로 무기 · 장비 · 원재질을 가른다 — 무기는 사양이
# 무기를 적었을 때만, 장비는 사양이 장비를 적었을 때만 MToon으로 바꾸고, 원재질은 바꾸지 않는다.
MATERIAL_GROUPS = ('Part', 'Gear', 'Raw')


def build_sheet(name, columns, rows, point_at, flip=False):
    """
    두께 없는 격자 판을 세운다. 망토 · 날개처럼 얇은 부품이 이것으로 선다.

    **일부러 두께를 주지 않는다.** 실제 망토 · 날개 에셋도 대개 한 겹 판이고, 그런 판에서 외곽선
    껍데기 · 뒷면 컬링 · 가림이 어떻게 깨지는지 보는 것이 이 부품을 세우는 이유다.

    면은 격자 한 칸마다 네모 하나이고, 기본 법선은 +Y(캐릭터의 등 쪽 바깥)를 향한다.

    @param columns 가로(u) 칸 수
    @param rows 세로(v) 칸 수
    @param point_at `(u, v)` → `(x, y, z)`. u · v는 0~1이다
    @param flip 참이면 면을 뒤집어 법선이 -Y를 향한다
    @returns 만들어진 오브젝트
    """
    import bmesh

    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

    sheet = bmesh.new()
    grid = [
        [sheet.verts.new(point_at(i / float(columns), j / float(rows))) for j in range(rows + 1)]
        for i in range(columns + 1)
    ]
    for i in range(columns):
        for j in range(rows):
            quad = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
            sheet.faces.new(list(reversed(quad)) if flip else quad)
    sheet.to_mesh(mesh)
    sheet.free()

    for other in bpy.context.selected_objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    return obj


def build_cloth(part):
    """
    위 가장자리에 매달려 아래로 늘어진 주름 천을 세운다. 원점이 위 가장자리 가운데다.

    주름은 폭 방향 사인파이고 아래로 갈수록 깊어진다. `sway`는 아래 끝을 등 뒤(+Y)로 들어 올리는
    양이라, 흔들림 프레임은 `phase`와 `sway`만 바꿔 만든다.
    """
    width = part.get('width', 0.4)
    width_bottom = part.get('width_bottom', width)
    length = part.get('length', 0.6)
    folds = part.get('folds', 4)
    depth = part.get('depth', 0.03)
    depth_top = part.get('depth_top', depth * 0.2)
    phase = part.get('phase', 0.0)
    sway = part.get('sway', 0.0)

    def point_at(u, v):
        span = width + (width_bottom - width) * v
        amplitude = depth_top + (depth - depth_top) * v
        return (
            (u - 0.5) * span,
            amplitude * math.sin(2.0 * math.pi * folds * u + phase) + sway * v * v,
            -v * length,
        )

    return build_sheet('Cloth', part.get('columns', 32), part.get('rows', 16), point_at, part.get('flip', False))


def build_wing(part):
    """
    뿌리에서 바깥으로 뻗는 날개 막 한 장을 세운다. 원점이 뿌리 위 모서리다.

    `side`가 1이면 +X(화면 오른쪽), -1이면 -X로 뻗는다. -1일 때 면 순서를 뒤집어 두 날개의 법선이
    같은 쪽(+Y)을 보게 한다 — 안 뒤집으면 한쪽 날개만 뒷면으로 그려져, 뒷면 컬링이나 외곽선
    껍데기를 볼 때 좌우가 다른 결과를 낸다. 퍼덕임은 부품의 `rotation`으로 뿌리를 축 삼아 돌린다.
    """
    side = part.get('side', 1)
    span = part.get('span', 0.45)
    height_root = part.get('height_root', 0.3)
    height_tip = part.get('height_tip', 0.1)
    sweep = part.get('sweep', 0.15)
    bend = part.get('bend', 0.05)
    feathers = part.get('feathers', 4)
    scallop = part.get('scallop', 0.04)

    def point_at(u, v):
        height = height_root + (height_tip - height_root) * u
        z = sweep * u - v * height
        if v >= 1.0:
            z += scallop * abs(math.sin(math.pi * feathers * u))
        return (side * u * span, bend * u * u, z)

    flip = part.get('flip', False) != (side < 0)
    return build_sheet('Wing', part.get('columns', 24), part.get('rows', 8), point_at, flip)


def build_part(part):
    """
    부품 하나를 세운다. 모르는 종류면 이름을 말하며 실패한다.

    @param part `type`과 그 종류의 인자, `location` · `rotation`(도) · `scale` · `color`.
        재질 선택지는 `group`(`MATERIAL_GROUPS`, 기본 `Part`) · `emission`(발광 세기) ·
        `alpha`(0~1, 1보다 작으면 반투명으로 섞는다)
    @returns 만들어진 오브젝트
    """
    kind = part.get('type')
    if kind == 'cylinder':
        bpy.ops.mesh.primitive_cylinder_add(
            radius=part.get('radius', 0.1),
            depth=part.get('depth', 1.0),
            vertices=part.get('vertices', 8),
        )
    elif kind == 'cone':
        bpy.ops.mesh.primitive_cone_add(
            radius1=part.get('radius1', 0.1),
            radius2=part.get('radius2', 0.0),
            depth=part.get('depth', 0.2),
            vertices=part.get('vertices', 6),
        )
    elif kind == 'sphere':
        bpy.ops.mesh.primitive_ico_sphere_add(
            radius=part.get('radius', 0.05),
            subdivisions=part.get('subdivisions', 2),
        )
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(
            major_radius=part.get('major_radius', 0.1),
            minor_radius=part.get('minor_radius', 0.02),
            major_segments=part.get('major_segments', 12),
            minor_segments=part.get('minor_segments', 6),
        )
    elif kind == 'cube':
        bpy.ops.mesh.primitive_cube_add(size=part.get('size', 1.0))
    elif kind == 'cloth':
        build_cloth(part)
    elif kind == 'wing':
        build_wing(part)
    else:
        raise common.GateError('weapon-spec', '모르는 부품 종류 {0}'.format(kind))

    group = part.get('group', 'Part')
    if group not in MATERIAL_GROUPS:
        raise common.GateError(
            'weapon-spec', '모르는 재질 묶음 {0} (아는 것 {1})'.format(group, list(MATERIAL_GROUPS))
        )

    obj = bpy.context.active_object
    obj.location = Vector(part.get('location', (0.0, 0.0, 0.0)))
    obj.rotation_euler = Euler([radians(a) for a in part.get('rotation', (0.0, 0.0, 0.0))])
    obj.scale = Vector(part.get('scale', (1.0, 1.0, 1.0)))

    color = part.get('color', (200, 200, 200))
    material = bpy.data.materials.new(group)
    material.use_nodes = True
    # sRGB 정수를 선형으로 바꾸지 않고 그대로 넣는다. 여기서 재는 것은 색의 정확도가 아니라
    # 부품이 서로 구별되는가이고, 툰 세팅은 G2가 잡는다.
    principled = material.node_tree.nodes.get('Principled BSDF')
    if principled is not None:
        rgba = (color[0] / 255.0, color[1] / 255.0, color[2] / 255.0, 1.0)
        principled.inputs['Base Color'].default_value = rgba
        emission = part.get('emission', 0.0)
        if emission > 0.0:
            principled.inputs['Emission Color'].default_value = rgba
            principled.inputs['Emission Strength'].default_value = emission
        alpha = part.get('alpha', 1.0)
        if alpha < 1.0:
            principled.inputs['Alpha'].default_value = alpha
            # EEVEE는 기본으로 알파를 디더링해 반투명을 점무늬로 흉내 낸다. 섞어 그리게 바꾸지
            # 않으면 오라가 게임 크기에서 반투명이 아니라 자글자글한 점으로 나온다.
            material.surface_render_method = 'BLENDED'
    obj.data.materials.append(material)
    return obj


def build_candidate(candidate, reference):
    """
    후보 하나와 키 기준 막대를 빈 장면에 세운다.

    @param candidate `id`와 `parts`
    @param reference `height`(m)와 `color`. `None`이면 막대를 세우지 않는다
    """
    bpy.ops.wm.read_factory_settings(use_empty=True)

    parts = candidate.get('parts') or []
    if not parts:
        raise common.GateError('weapon-spec', '후보 {0}에 부품이 없다'.format(candidate.get('id')))
    for part in parts:
        build_part(part)

    if reference is not None:
        height = reference.get('height', 1.2)
        build_part(
            {
                'type': 'cylinder',
                'radius': 0.012,
                'depth': height,
                'vertices': 6,
                'location': (reference.get('offset_x', -0.42), 0.0, height / 2.0),
                'color': reference.get('color', (70, 70, 80)),
            }
        )


def mesh_bounds():
    """
    장면의 모든 메시를 감싸는 월드 상자.

    `_common.world_bounds`와 같은 일을 하지만 실패 코드가 다르다. 그쪽은 메시가 없을 때
    `vrm-path`로 보고하는데, 무기 후보에는 `.vrm`이 없으므로 그 어휘가 원인을 엉뚱한 곳으로
    돌린다.

    @returns `(최소 Vector, 최대 Vector)`
    """
    lo = Vector((float('inf'),) * 3)
    hi = Vector((float('-inf'),) * 3)
    found = False

    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        found = True
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                lo[axis] = min(lo[axis], point[axis])
                hi[axis] = max(hi[axis], point[axis])

    if not found:
        raise common.GateError('weapon-spec', '세워진 메시가 없다 — 렌더할 것이 없다')
    return lo, hi


def fit_ortho_scale(span, width_px, height_px, margin):
    """
    합친 상자를 캔버스에 채우는 직교 배율.

    `ortho_scale`은 렌더의 **긴 변**만 덮으므로, 짧은 변에 필요한 값은 종횡비만큼 키운 뒤 둘 중
    큰 쪽을 쓴다. 한쪽만 보고 정하면 반대 변이 잘리거나(잘린 PNG는 파일도 알파도 정상이라
    숫자로 안 드러난다) 물체가 캔버스를 절반도 못 채운다.

    가로는 x 폭이 아니라 **평면 대각선**으로 본다. 3/4 각으로 돌려 굽는 시점이 있어서, x만 보면
    돌렸을 때 깊이(y)가 화면 가로로 들어오며 잘린다.

    @param span 합친 상자의 크기 Vector
    @param margin 물체 크기에 곱하는 여백 비율. 0.08이면 양쪽에 8%씩
    """
    horizontal = math.hypot(span.x, span.y)
    vertical = span.z
    grow = 1.0 + margin * 2.0

    if height_px >= width_px:
        return max(vertical * grow, horizontal * grow * height_px / width_px)
    return max(horizontal * grow, vertical * grow * width_px / height_px)


def setup_camera(center, ortho_scale, view):
    """
    후보를 담는 직교 카메라를 세운다. 배율은 모든 후보가 공유한다.

    카메라는 자기 좌표계의 -Z를 보므로, 회전 행렬로 시선 방향을 구해 그 반대편에 놓는다. 각도를
    손으로 풀어 쓰면 방위각을 바꿀 때마다 부호를 다시 맞춰야 한다.

    @param center 바라볼 지점
    @param ortho_scale 직교 배율. 모든 후보에 같은 값을 쓴다
    @param view `VIEWS`의 키
    """
    azimuth, elevation = VIEWS[view]
    rotation = Euler((radians(90.0 - elevation), 0.0, radians(azimuth)))
    direction = rotation.to_matrix() @ Vector((0.0, 0.0, -1.0))

    data = bpy.data.cameras.new('WeaponCamera')
    data.type = 'ORTHO'
    data.ortho_scale = ortho_scale

    camera = bpy.data.objects.new('WeaponCamera', data)
    camera.location = center - direction * max(4.0, ortho_scale * 2.0)
    camera.rotation_euler = rotation
    bpy.context.scene.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    return camera


def main():
    args = common.script_args()
    spec_path = common.parse_arg(args, 'spec')
    out_dir = common.parse_arg(args, 'out-dir')
    canvas_width = common.parse_int_arg(args, 'canvas-width')
    canvas_height = common.parse_int_arg(args, 'canvas-height')

    if not spec_path:
        raise common.GateError('weapon-spec', '`-- --spec <경로>`를 받지 못했다')
    if not out_dir:
        raise common.GateError('output-path', '`-- --out-dir <경로>`를 받지 못했다')
    if not os.path.exists(spec_path):
        raise common.GateError(
            'weapon-spec', '후보 표가 없다: {0}'.format(os.path.abspath(spec_path))
        )

    with open(spec_path, 'r', encoding='utf-8') as handle:
        spec = json.load(handle)

    candidates = spec.get('candidates') or []
    if not candidates:
        raise common.GateError('weapon-spec', '후보가 0개다')
    reference = spec.get('reference')
    margin = spec.get('margin', 0.08)

    common.assert_version()
    engine = common.pick_eevee()

    # 1차로 전부 세워 상자만 잰다. 배율을 후보마다 따로 잡으면 크기 비율이 화면에서 사라진다.
    union_lo = Vector((float('inf'),) * 3)
    union_hi = Vector((float('-inf'),) * 3)
    for candidate in candidates:
        build_candidate(candidate, reference)
        lo, hi = mesh_bounds()
        for axis in range(3):
            union_lo[axis] = min(union_lo[axis], lo[axis])
            union_hi[axis] = max(union_hi[axis], hi[axis])

    center = (union_lo + union_hi) / 2.0
    ortho_scale = fit_ortho_scale(union_hi - union_lo, canvas_width, canvas_height, margin)

    written = []
    for candidate in candidates:
        build_candidate(candidate, reference)
        common.setup_lights()
        for view in candidate.get('views', list(VIEWS)):
            if view not in VIEWS:
                raise common.GateError(
                    'weapon-spec', '모르는 시점 {0} (가능 {1})'.format(view, list(VIEWS))
                )
            setup_camera(center, ortho_scale, view)
            out_path = common.assert_output_path(
                os.path.join(out_dir, '{0}_{1}.png'.format(candidate['id'], view))
            )
            common.setup_render(engine, canvas_width, canvas_height, out_path)
            common.render_still(out_path)
            written.append(out_path.replace('\\', '/'))

    common.gate_ok(
        {
            'gate': 'weapons',
            'blender': bpy.app.version_string,
            'engine': engine,
            'candidates': len(candidates),
            'ortho_scale': round(ortho_scale, 4),
            'canvas': '{0}x{1}'.format(canvas_width, canvas_height),
            'written': written,
        }
    )


if __name__ == '__main__':
    common.run(main)
