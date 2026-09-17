"""
G2 — 외곽선 후보 굽기의 Blender 쪽 조각. Line Art 오브젝트를 세우고, 후처리 외곽선용 패스(법선 · 깊이)를
PNG로 굽는다. 인버티드 헐은 툰 사양의 외곽선 키(`toon.py`)로 켜므로 여기 없다.

**Line Art는 Grease Pencil 오브젝트다.** 장면의 메시에서 윤곽 · 주름 · 재질 경계 · 교차선을 계산해 선을
만들고, EEVEE가 그 선을 렌더 위에 얹는다. 굵기는 `radius`(m)라 직교 카메라에서 픽셀 굵기는
2 × radius × (px/m)다(`ops-blender-toon.md` §5.1). 가림 전용 몸은 선을 내지 않되 가리기만 하도록
`lineart.usage`를 `OCCLUSION_ONLY`로 둔다 — 안 그러면 장비 층에 몸의 윤곽선이 함께 그려진다.

**패스는 재질을 갈아 끼워 한 장씩 따로 굽는다.** 컴포지터 File Output은 5.2에서 다층 EXR 한 장만 쓰고
항목별 PNG 덮어쓰기가 먹지 않았다(2026-09-17 실측 — `Unsaved.exr`만 생겼다). EXR 파서를 두는 대신,
본 렌더가 끝난 뒤 모든 메시의 재질을 발광 셰이더로 바꿔 법선은 (n + 1) / 2, 깊이는 카메라 거리 범위를
0~1로 누른 값을 그대로 굽는다. 뷰 변환을 `Raw`로 두고 샘플을 1로 내려 값이 뒤틀리거나 이웃과 섞이지
않게 한다. EEVEE에는 오브젝트 번호 패스가 없어 물체 경계는 깊이 불연속으로 잡는다. 깊이 범위는
카메라에서 몸 중심까지의 거리 둘레 ±0.45m다 — 넓게 잡으면 8비트 한 단계가 수 cm라 끈이 몸에서 갈리지
않는다.

판정은 하지 않는다. 세우고 굽는 것까지이고 선을 긋고 재는 것은 `outline.ts`다
(`README.md` 「판정은 파이썬에 없다」).
"""

import os
import sys
from math import radians

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import _common as common  # noqa: E402


def setup_lineart(spec, line_objects, occluder_objects):
    """
    Line Art 오브젝트를 세운다. `line_objects`는 선을 내고 `occluder_objects`는 가리기만 한다.

    @param spec `radius`(m) · `color`(0~1 RGB) · `crease_degrees`(이보다 작은 각을 주름으로) · `contour` ·
        `crease` · `material` · `intersection` · `silhouette`(`NONE` · `GROUP` · `INDIVIDUAL`)
    @returns `(오브젝트, 모디파이어)`
    """
    for obj in line_objects:
        obj.lineart.usage = 'INCLUDE'
    for obj in occluder_objects:
        obj.lineart.usage = 'OCCLUSION_ONLY'

    bpy.ops.object.grease_pencil_add(type='LINEART_SCENE')
    pencil = bpy.context.active_object
    pencil.name = 'OutlineLineArt'
    # 모디파이어 인스턴스의 `type`은 `LINEART`다(5.2 실측). 종류 이름 `GREASE_PENCIL_LINEART`와 다르다
    modifier = next((m for m in pencil.modifiers if m.type in ('LINEART', 'GREASE_PENCIL_LINEART')), None)
    if modifier is None:
        raise common.GateError('lineart', 'Line Art 오브젝트에 모디파이어가 없다')
    modifier.source_type = 'SCENE'
    modifier.radius = spec.get('radius', 0.0031)
    modifier.use_contour = spec.get('contour', True)
    modifier.use_crease = spec.get('crease', True)
    modifier.crease_threshold = radians(spec.get('crease_degrees', 140.0))
    modifier.use_material = spec.get('material', True)
    modifier.use_intersection = spec.get('intersection', True)
    modifier.use_loose = False
    modifier.silhouette_filtering = spec.get('silhouette', 'NONE')
    # 평면 음영 메시(망토 · 날개 · 갑옷 부품)는 모든 변이 날카로운 변이라, 이 옵션이 켜져 있으면 격자
    # 전체에 주름 선이 그어진다(2026-09-17 첫 판). 끄면 주름은 각도 문턱으로만 잡는다
    modifier.use_crease_on_sharp = spec.get('crease_on_sharp', False)

    color = spec.get('color', (0.061, 0.009, 0.014))
    if not pencil.data.materials:
        raise common.GateError('lineart', 'Line Art 오브젝트에 재질이 없다')
    pencil_material = pencil.data.materials[0].grease_pencil
    pencil_material.color = (color[0], color[1], color[2], 1.0)
    pencil_material.show_stroke = True
    pencil_material.show_fill = False
    return pencil, modifier


def _emission_material(name, build):
    """발광만 하는 재질. `build(nodes, links)`가 색 입력에 이을 소켓을 돌려준다."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Strength'].default_value = 1.0
    links.new(emission.outputs['Emission'], output.inputs['Surface'])
    links.new(build(nodes, links), emission.inputs['Color'])
    return material


def _normal_material():
    def build(nodes, links):
        geometry = nodes.new('ShaderNodeNewGeometry')
        encode = nodes.new('ShaderNodeVectorMath')
        encode.operation = 'MULTIPLY_ADD'
        encode.inputs[1].default_value = (0.5, 0.5, 0.5)
        encode.inputs[2].default_value = (0.5, 0.5, 0.5)
        links.new(geometry.outputs['Normal'], encode.inputs[0])
        return encode.outputs[0]

    return _emission_material('OutlinePassNormal', build)


def _depth_material(depth_from, depth_to):
    def build(nodes, links):
        camera = nodes.new('ShaderNodeCameraData')
        depth_range = nodes.new('ShaderNodeMapRange')
        depth_range.clamp = True
        depth_range.inputs['From Min'].default_value = depth_from
        depth_range.inputs['From Max'].default_value = depth_to
        links.new(camera.outputs['View Z Depth'], depth_range.inputs['Value'])
        return depth_range.outputs['Result']

    return _emission_material('OutlinePassDepth', build)


def render_passes(directory, depth_from, depth_to):
    """
    본 렌더가 끝난 뒤 부른다. 모든 메시의 재질을 갈아 끼워 `normal.png` · `depth.png`를 굽는다.

    장면을 되돌리지 않는다 — 탐침은 한 번 굽고 끝나므로 되돌릴 이유가 없고, 되돌리는 코드는 틀려도
    드러나지 않는다.

    @returns `{이름: 경로}`
    """
    os.makedirs(directory, exist_ok=True)
    scene = bpy.context.scene
    scene.view_settings.view_transform = 'Raw'
    scene.view_settings.look = 'None'
    scene.eevee.taa_render_samples = 1
    materials = {
        'normal': _normal_material(),
        'depth': _depth_material(depth_from, depth_to),
    }
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    written = {}
    for name, material in materials.items():
        for obj in meshes:
            if not obj.material_slots:
                obj.data.materials.append(material)
            for slot in obj.material_slots:
                slot.material = material
        target = os.path.join(directory, name + '.png')
        scene.render.filepath = target
        common.render_still(target)
        written[name] = target.replace(os.sep, '/')
    return written
