"""
`.vrm`의 MToon 머티리얼 값을 덤프하고, 애드온 셰이더가 어느 음영 식을 쓰는지 확인한다.

**애드온의 실제 음영 식은 MToon 명세와 다르다.** 노드 그룹 안에 명세 식(`Make Toon` 프레임)과 옛
식(`Old Lit and Shade Mix Factor (will be removed)` 프레임)이 둘 다 있고, 2026-09-16 기준 애드온
v4.7.1은 옛 식을 음영 혼합에 물린다. 그 차이가 툰 값의 의미를 통째로 바꾸므로
(`docs/development/spec/ops-blender-toon.md` §3 · §4), 애드온이나 Blender 판을 바꾼 뒤에는 이 도구로
어느 식이 물렸는지부터 본다. 그 문서 §6이 이 확인을 요구한다.

판정은 하지 않는다. 어느 프레임에서 왔는지를 이름으로 보고하고, 머티리얼 값을 JSON으로 쓴다
(`README.md` 「판정은 파이썬에 없다」).

돌리는 법:

    blender --background --python-exit-code 1 --python tools/blender/inspect_mtoon.py -- \\
      --vrm <.vrm 경로> --out <JSON 경로>
"""

import json
import os
import sys
from importlib import import_module

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import _common as common  # noqa: E402 - 위 경로 주입 뒤에 와야 한다

# 음영 식을 가르는 프레임 이름. 애드온이 노드 그룹 안에 붙여 둔 라벨이다.
OUTPUT_GROUP_PREFIX = 'VRM Add-on MToon 1.0 Output'
MIX_FRAME = 'Mix Lit and Shade'
OLD_FRAME_PREFIX = 'Old Lit and Shade Mix Factor'
NEW_FRAME = 'Make Toon'


def rounded(values):
    """색 · 벡터 값을 넷째 자리로 줄인 목록."""
    return [round(v, 4) for v in values]


def material_row(ext):
    """
    MToon이 켜진 머티리얼 하나의 값.

    텍스처는 붙어 있는지만 적는다. 이미지 이름은 내보내기마다 바뀌어 판끼리 견줄 때 잡음이 된다.
    """
    mtoon = ext.extensions.vrmc_materials_mtoon
    return {
        'alpha_mode': ext.alpha_mode,
        'base_color': rounded(ext.pbr_metallic_roughness.base_color_factor),
        'shade_color': rounded(mtoon.shade_color_factor),
        'has_shade_texture': mtoon.shade_multiply_texture.index.source is not None,
        'shading_shift': round(mtoon.shading_shift_factor, 4),
        'has_shading_shift_texture': mtoon.shading_shift_texture.index.source is not None,
        'shading_toony': round(mtoon.shading_toony_factor, 4),
        'gi_equalization': round(mtoon.gi_equalization_factor, 4),
        'matcap': rounded(mtoon.matcap_factor),
        'has_matcap_texture': mtoon.matcap_texture.index.source is not None,
        'rim_color': rounded(mtoon.parametric_rim_color_factor),
        'rim_lighting_mix': round(mtoon.rim_lighting_mix_factor, 4),
        'rim_fresnel_power': round(mtoon.parametric_rim_fresnel_power_factor, 4),
        'rim_lift': round(mtoon.parametric_rim_lift_factor, 4),
        'outline_mode': mtoon.outline_width_mode,
        'outline_width': round(mtoon.outline_width_factor, 5),
        'outline_color': rounded(mtoon.outline_color_factor),
        'emissive': rounded(ext.emissive_factor),
    }


def shading_path(bpy):
    """
    음영 혼합 비율이 어느 프레임에서 오는지 찾는다.

    `Mix Lit and Shade` 프레임의 혼합 노드에서 `Factor` 입력을 거슬러 올라가며 경유 노드(reroute)를
    건너뛰고, 처음 만나는 계산 노드가 속한 프레임 이름을 본다.

    @returns `(그룹 이름, 'old' | 'new' | 'unknown', 찾은 프레임 이름)`
    """
    group = next((g for g in bpy.data.node_groups if g.name.startswith(OUTPUT_GROUP_PREFIX)), None)
    if group is None:
        raise common.GateError(
            'mtoon-inspect', '`{0}` 노드 그룹이 없다 — MToon 머티리얼이 없는 판이다'.format(OUTPUT_GROUP_PREFIX)
        )

    mix = next(
        (
            n
            for n in group.nodes
            if n.bl_idname == 'ShaderNodeMix' and n.parent is not None and n.parent.label == MIX_FRAME
        ),
        None,
    )
    if mix is None:
        return group.name, 'unknown', '(`{0}` 프레임의 혼합 노드 없음)'.format(MIX_FRAME)

    socket = mix.inputs['Factor']
    while socket.is_linked:
        node = socket.links[0].from_node
        if node.bl_idname != 'NodeReroute':
            frame = node.parent.label if node.parent is not None else ''
            if frame.startswith(OLD_FRAME_PREFIX):
                return group.name, 'old', frame
            if frame == NEW_FRAME:
                return group.name, 'new', frame
            return group.name, 'unknown', frame
        socket = node.inputs[0]
    return group.name, 'unknown', '(Factor 입력이 비었다)'


def addon_version():
    """켜진 VRM 애드온의 판. 확장 매니페스트에서 읽고, 없으면 `None`."""
    module = common.vrm_addon_module()
    if module is None:
        return None
    manifest = os.path.join(os.path.dirname(import_module(module).__file__), 'blender_manifest.toml')
    if not os.path.exists(manifest):
        return None
    with open(manifest, encoding='utf-8') as handle:
        for line in handle:
            if line.strip().startswith('version'):
                return line.split('=', 1)[1].strip().strip('"')
    return None


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
    common.import_vrm(vrm_path)

    get_extension = import_module(common.vrm_addon_module() + '.editor.extension_accessor').get_material_extension
    materials = {}
    for material in bpy.data.materials:
        ext = get_extension(material).mtoon1
        if ext.enabled and not ext.is_outline_material:
            materials[material.name] = material_row(ext)

    group, path, frame = shading_path(bpy)
    with open(absolute_out, 'w', encoding='utf-8') as handle:
        json.dump(materials, handle, ensure_ascii=False, indent=1, sort_keys=True)

    common.gate_ok(
        {
            'gate': 'mtoon-inspect',
            'blender': bpy.app.version_string,
            'vrm_addon': addon_version(),
            'output_group': group,
            'shading_path': path,
            'shading_frame': frame,
            'materials': len(materials),
            'output': absolute_out.replace(os.sep, '/'),
        }
    )


if __name__ == '__main__':
    common.run(main)
