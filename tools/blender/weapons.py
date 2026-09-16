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


def build_part(part):
    """
    부품 하나를 세운다. 모르는 종류면 이름을 말하며 실패한다.

    @param part `type`과 그 종류의 인자, `location` · `rotation`(도) · `scale` · `color`
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
    else:
        raise common.GateError('weapon-spec', '모르는 부품 종류 {0}'.format(kind))

    obj = bpy.context.active_object
    obj.location = Vector(part.get('location', (0.0, 0.0, 0.0)))
    obj.rotation_euler = Euler([radians(a) for a in part.get('rotation', (0.0, 0.0, 0.0))])
    obj.scale = Vector(part.get('scale', (1.0, 1.0, 1.0)))

    color = part.get('color', (200, 200, 200))
    material = bpy.data.materials.new('Part')
    material.use_nodes = True
    # sRGB 정수를 선형으로 바꾸지 않고 그대로 넣는다. 여기서 재는 것은 색의 정확도가 아니라
    # 부품이 서로 구별되는가이고, 툰 세팅은 G2가 잡는다.
    principled = material.node_tree.nodes.get('Principled BSDF')
    if principled is not None:
        principled.inputs['Base Color'].default_value = (
            color[0] / 255.0,
            color[1] / 255.0,
            color[2] / 255.0,
            1.0,
        )
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
