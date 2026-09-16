"""
G2 — 임포트된 MToon 머티리얼에 툰 설정을 입히고, 무기 부품도 같은 셰이더로 바꾼다.

**값은 이 파일이 아니라 넘겨받는 JSON(툰 사양)이 든다.** 무기가 `weapons.ts` 표 → JSON →
`weapons.py`로 흐르는 것과 같은 모양이다. 값을 여기 박으면 후보를 바꿀 때마다 파이썬을 고치게
되고, 굽기와 판정이 서로 다른 값을 볼 수 있다.

**값이 그림에서 실제로 무엇을 하는지는 MToon 명세가 아니라 `docs/development/spec/ops-blender-toon.md`
가 든다.** VRM 애드온의 노드가 명세와 다른 식으로 칠해서, 명세만 읽고 사양을 짜면 효과가 없는 값을
후보로 굽게 된다. 이 파일의 사양 키가 명세 이름과 다른 것(`shade_threshold`)도 그 때문이다.

**머티리얼을 이름 끝의 분류로 묶는다.** VRoid가 머티리얼 이름 끝에 `_SKIN` · `_CLOTH` · `_HAIR` ·
`_FACE` · `_EYE`를 붙여 내보내므로(2026-09-16 `player_base.vrm` 실측 16개), 사양은 머티리얼 이름이
아니라 이 분류로 값을 준다. 상의 A · B 판은 머티리얼 이름의 번호가 달라서, 이름으로 주면 판마다
사양을 따로 써야 한다. VRoid 이름이 없는 부품은 `weapons.build_part`가 붙인 머티리얼 이름의 접두사로
묶는다 — `Part`는 무기(`WEAPON`), `Gear`는 망토 · 날개 · 갑옷 같은 장비(`GEAR`)이고, `Raw`는 오라처럼
툰 셰이더로 바꾸면 안 되는 부품이라 아무 분류에도 넣지 않는다.

**분류보다 좁게 부위로도 준다(`Face_SKIN`).** 얼굴 피부와 몸 피부가 같은 `SKIN`이라, 분류로만 주면
얼굴의 음영색만 바꾸려다 팔 · 다리의 음영색까지 바뀐다. 값은 `*` → 분류 → 부위 순으로 덮는다.

**무기 · 장비는 사양이 그 분류를 적었을 때만 MToon으로 바꾼다.** `weapons.py`는 부품을 Principled
BSDF로 세우는데, 사양에 `WEAPON` · `GEAR`가 없으면 그대로 둔다. 몸은 VRoid가 내보낸 원본 음영을 쓰기로
했으므로(2026-09-16 사용자 판정), 사양이 `*`로 몸을 건드리지 않으면서 장비만 몸에 맞춰 볼 수 있어야
하기 때문이다. 이때 `like`로 VRoid 부위 하나(`Tops_CLOTH`)를 지목하면 그 머티리얼의 음영 값과 matcap
텍스처를 복사해 와서, 장비가 옷과 같은 규칙으로 칠해진다.

판정은 하지 않는다. 입힌 값을 그대로 돌려줘 굽기 기록에 남기는 것까지다
(`README.md` 「판정은 파이썬에 없다」).
"""

import os
import re
import sys
from importlib import import_module
from math import radians

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import _common as common  # noqa: E402

# 부위와 분류를 꺼내는 규칙. `N00_000_00_Body_00_SKIN (Instance)`에서 `Body`와 `SKIN`을 얻는다.
# 복제된 머티리얼에 Blender가 붙이는 `.001`도 허용한다.
MATERIAL_CLASS = re.compile(r'_([A-Za-z]+)_\d+_([A-Z]+)(?: \(Instance\))?(?:\.\d+)?$')

# VRoid 이름이 없는 부품의 분류. 머티리얼 이름 접두사 → 분류이고, 접두사의 주인은
# `weapons.MATERIAL_GROUPS`다. `Raw`는 일부러 빠져 있다.
WEAPON_CLASS = 'WEAPON'
GEAR_CLASS = 'GEAR'
PART_PREFIXES = {'Part': WEAPON_CLASS, 'Gear': GEAR_CLASS}

# 사양 키 → MToon 속성. 왼쪽이 사양에 쓰는 이름이다. `vrmc_materials_mtoon` 아래에 있는 것과
# 머티리얼 확장 바로 아래에 있는 것(`emissive_factor`)이 갈린다.
MTOON_KEYS = {
    'shading_toony': 'shading_toony_factor',
    'gi_equalization': 'gi_equalization_factor',
    'shade_color': 'shade_color_factor',
    'matcap': 'matcap_factor',
    'rim_color': 'parametric_rim_color_factor',
    'rim_lighting_mix': 'rim_lighting_mix_factor',
    'outline_mode': 'outline_width_mode',
    'outline_width': 'outline_width_factor',
    'outline_color': 'outline_color_factor',
    'outline_lighting_mix': 'outline_lighting_mix_factor',
}
EXTENSION_KEYS = {'emissive': 'emissive_factor', 'double_sided': 'double_sided'}

# `like`가 복사해 오는 MToon 속성. 색(기본색 · 음영색)은 빼고 음영을 끊는 규칙과 외곽선만 옮긴다 —
# 색까지 옮기면 장비가 옷 색으로 칠해진다.
LIKE_ATTRIBUTES = (
    'shading_toony_factor',
    'shading_shift_factor',
    'gi_equalization_factor',
    'matcap_factor',
    'parametric_rim_color_factor',
    'rim_lighting_mix_factor',
    'parametric_rim_fresnel_power_factor',
    'parametric_rim_lift_factor',
    'outline_width_mode',
    'outline_width_factor',
    'outline_color_factor',
    'outline_lighting_mix_factor',
)

# 그늘 문턱(0~1). 애드온 노드는 `shading_shift_factor`의 부호를 뒤집어 0~1로 자른 값을 문턱으로
# 쓴다(`ops-blender-toon.md` §3.2). 그래서 명세 이름대로 `shading_shift`를 받으면 0보다 큰 값이
# 전부 0과 같아지는데, 굽기는 멀쩡히 끝나서 사람은 그 후보를 「값을 바꿔도 차이가 없다」로 판정한다.
# 2026-09-16에 얼굴에 1.0과 2.0을 넣어 실제로 그렇게 됐다. 효과가 있는 범위만 받으려고 문턱으로
# 이름을 바꾸고, 0~1 밖의 값은 실패로 접는다. 클수록 그늘이 넓다.
THRESHOLD_KEY = 'shade_threshold'

# 무기 · 장비 전용 키. 이 부품들에는 VRoid가 준 음영색 텍스처가 없어서 기본색에 곱할 비율로 음영색을
# 만들고(`shade_ratio`), 음영 규칙은 `like`가 지목한 VRoid 부위에서 복사해 온다.
CONVERTED_KEYS = {'shade_ratio', 'like'}

# matcap 텍스처 파일(절대 경로). `like`가 복사한 부위에 matcap이 없을 때(VRoid 옷이 그렇다) 금속 반사점을
# 주려고 쓴다. 애드온의 matcap 항은 더해지기만 해서 밝히기만 하고 어둡게는 못 하므로, 금속의 어두운 면은
# `shade_ratio`로 만들고 여기서는 반사만 준다. 2026-09-17 어깨갑옷이 상의 규칙만 복사해 흰 덩어리로 나온
# 뒤 생겼다.
MATCAP_IMAGE_KEY = 'matcap_image'


def material_accessor():
    """
    VRM 애드온의 머티리얼 확장 접근 함수를 돌려준다.

    모듈 경로를 하드코딩하지 않는 이유는 `_common.vrm_addon_module`에 있다 — 설치 방식에 따라
    `bl_ext.user_default.vrm`과 `io_scene_vrm`으로 갈린다.
    """
    module = common.vrm_addon_module()
    if module is None:
        raise common.GateError('vrm-addon-missing', '툰 설정을 입히려는데 VRM 애드온이 꺼져 있다')
    return import_module(module + '.editor.extension_accessor').get_material_extension


def material_class(material):
    """
    머티리얼의 `(분류, 부위 분류)`. VRoid 이름이면 `('SKIN', 'Face_SKIN')`, 무기 부품이면
    `('WEAPON', 'WEAPON')`, 장비 부품이면 `('GEAR', 'GEAR')`, 어디에도 안 들면 `(None, None)`.
    """
    for prefix, klass in PART_PREFIXES.items():
        if material.name.startswith(prefix):
            return klass, klass
    found = MATERIAL_CLASS.search(material.name)
    if not found:
        return None, None
    return found.group(2), '{0}_{1}'.format(found.group(1), found.group(2))


def merged_settings(spec, klass, part):
    """
    `*` 위에 분류별 값을, 그 위에 부위별 값을 얹어 한 머티리얼이 받을 설정을 만든다.

    **모르는 키는 실패로 접는다.** 조용히 넘기면 오타 난 키(`shading_tooney`)가 아무 일도 안 한 채
    후보가 구워지고, 사람은 그 후보를 「값을 바꿔도 차이가 없다」로 판정한다.
    """
    table = spec.get('materials') or {}
    settings = dict(table.get('*') or {})
    settings.update(table.get(klass) or {})
    if part != klass:
        settings.update(table.get(part) or {})
    known = set(MTOON_KEYS) | set(EXTENSION_KEYS) | {THRESHOLD_KEY, MATCAP_IMAGE_KEY} | CONVERTED_KEYS
    unknown = sorted(set(settings) - known)
    if unknown:
        raise common.GateError(
            'toon-spec', '툰 사양에 모르는 키 {0} (분류 {1}, 아는 키 {2})'.format(unknown, klass, sorted(known))
        )
    return settings


def find_reference(get_extension, part):
    """
    `like`가 지목한 VRoid 부위의 MToon 확장을 찾는다. 없으면 장면에 있는 부위를 말하며 실패한다.

    조용히 넘기면 장비가 애드온 기본값(명세 기본값과도 VRoid 값과도 다르다)으로 칠해지는데, 사람은
    그 그림을 「옷과 같은 규칙으로 칠한 장비」로 보고 판정한다.
    """
    seen = []
    for material in bpy.data.materials:
        _, part_class = material_class(material)
        ext = get_extension(material).mtoon1
        if part_class is None or ext.is_outline_material or not ext.enabled:
            continue
        if part_class == part:
            return ext
        seen.append(part_class)
    raise common.GateError(
        'toon-spec', 'like가 지목한 부위 {0}가 장면에 없다 (있는 것 {1})'.format(part, sorted(set(seen)))
    )


def convert_part_material(ext, material, settings, reference):
    """
    Principled BSDF로 세운 무기 · 장비 머티리얼을 MToon으로 바꾼다.

    음영색은 기본색에 `shade_ratio`를 곱해 만든다. `reference`가 있으면 그 머티리얼의 음영 규칙과
    matcap 텍스처를 복사한다. 부품에 준 발광(`emission`)은 MToon 발광으로 옮긴다 — 안 옮기면 변환이
    Principled 노드를 갈아 끼우면서 빛나는 보석이 그냥 파란 돌이 된다.

    **색과 발광을 변환 전에 읽는다.** 변환이 노드 트리를 MToon 것으로 갈아 끼우므로, 뒤에 읽으면
    Principled 노드가 이미 없다.
    """
    principled = material.node_tree.nodes.get('Principled BSDF') if material.node_tree else None
    base = tuple(principled.inputs['Base Color'].default_value) if principled else (0.8, 0.8, 0.8, 1.0)
    emission = principled.inputs['Emission Strength'].default_value if principled else 0.0

    ext.enabled = True
    mtoon = ext.extensions.vrmc_materials_mtoon
    if reference is not None:
        source = reference.extensions.vrmc_materials_mtoon
        for name in LIKE_ATTRIBUTES:
            setattr(mtoon, name, getattr(source, name))
        mtoon.matcap_texture.index.source = source.matcap_texture.index.source
    ext.pbr_metallic_roughness.base_color_factor = base
    ratio = settings.get('shade_ratio', 0.6)
    mtoon.shade_color_factor = tuple(c * ratio for c in base[:3])
    if emission > 0.0:
        ext.emissive_factor = base[:3]
        ext.extensions.khr_materials_emissive_strength.emissive_strength = emission


def apply_to_materials(spec):
    """
    장면의 머티리얼마다 분류를 찾아 설정을 입힌다.

    **윤곽 전용 머티리얼은 건너뛴다.** 애드온이 외곽선마다 `MToon Outline (...)` 머티리얼을 따로
    두고 원본 머티리얼의 값을 따라가게 하므로, 그쪽에 직접 쓰면 원본을 고칠 때 다시 덮인다.

    @returns `{머티리얼 이름: 입힌 설정}` — 굽기 기록에 그대로 남긴다
    """
    get_extension = material_accessor()
    table = spec.get('materials') or {}
    applied = {}
    for material in list(bpy.data.materials):
        ext = get_extension(material).mtoon1
        if ext.is_outline_material:
            continue
        klass, part = material_class(material)
        if klass is None:
            continue
        if klass in PART_PREFIXES.values() and klass not in table:
            continue
        settings = merged_settings(spec, klass, part)
        if klass in PART_PREFIXES.values():
            like = settings.get('like')
            reference = find_reference(get_extension, like) if like else None
            convert_part_material(ext, material, settings, reference)
        if not ext.enabled:
            continue

        mtoon = ext.extensions.vrmc_materials_mtoon
        for key, value in settings.items():
            if key in MTOON_KEYS:
                setattr(mtoon, MTOON_KEYS[key], value)
            elif key in EXTENSION_KEYS:
                setattr(ext, EXTENSION_KEYS[key], value)
            elif key == MATCAP_IMAGE_KEY:
                if not os.path.isfile(value):
                    raise common.GateError('toon-spec', 'matcap 파일이 없다: {0}'.format(value))
                image = bpy.data.images.load(value, check_existing=True)
                image.colorspace_settings.name = 'sRGB'
                mtoon.matcap_texture.index.source = image
            elif key == THRESHOLD_KEY:
                if not 0.0 <= value <= 1.0:
                    raise common.GateError(
                        'toon-spec',
                        '{0}는 0~1이어야 한다 (받은 값 {1}, 부위 {2}) — 밖의 값은 노드가 잘라 내 효과가 '
                        '없다'.format(THRESHOLD_KEY, value, part),
                    )
                mtoon.shading_shift_factor = -value
        applied[material.name] = dict(settings, klass=part)
    return applied


def setup_lights(spec):
    """
    장면의 조명을 지우고 사양의 태양광으로 다시 세운다. 사양에 `lights`가 없으면 아무것도 안 한다.

    **조명은 그늘 문턱과 한 쌍이다.** 애드온 노드는 면의 조명을 위를 향한 면의 조명으로 나눈 값에
    문턱을 대므로, 태양의 고도를 바꾸면 같은 문턱에서도 그늘 폭이 달라진다(`ops-blender-toon.md`
    §4.3). 조명을 사양에 함께 적어 두지 않으면 문턱만 같은 두 후보가 다른 그늘로 구워진다.

    그림자 투사 설정은 받지 않는다. 2026-09-16에 태양광의 `use_shadow`와 메시의 `visible_shadow`를
    끄고 구웠는데 기준 컷과 픽셀 차이가 없었다(같은 문서 §4.5).

    @returns 세운 조명 수. 사양에 없으면 `None`
    """
    lights = spec.get('lights')
    if lights is None:
        return None
    for obj in [o for o in bpy.data.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(obj, do_unlink=True)
    scene = bpy.context.scene
    for index, light in enumerate(lights):
        data = bpy.data.lights.new('ToonLight{0}'.format(index), type='SUN')
        data.energy = light.get('energy', 4.0)
        obj = bpy.data.objects.new('ToonLight{0}'.format(index), data)
        obj.rotation_euler = [radians(a) for a in light.get('rotation', (57.0, 0.0, 0.0))]
        scene.collection.objects.link(obj)
    return len(lights)
