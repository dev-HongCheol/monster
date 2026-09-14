"""
게이트 0b — VRM 임포터가 VRoid 산출물을 읽고, 그 모델이 같은 카메라로 렌더되는가.

판정은 하지 않는다. 여기서 하는 일은 읽고 굽고 **실측을 보고하는 것**까지다. 알파와 상자를
재는 것은 실행기(`gate.ts`)가 한다.

본 이름 목록을 함께 뱉는 이유는 게이트 0c가 그것을 필요로 하기 때문이다. 리타게팅은 애드온
프리셋이 아니라 본 이름 대응표로 하므로, 이 골격이 실제로 어떤 이름을 쓰는지가 그 표의 한쪽
열이 된다. 모델을 이미 열어 둔 자리에서 뽑아 두면 0c가 같은 파일을 다시 열지 않아도 된다.

돌리는 법과 실패 코드 표는 `tools/blender/README.md`에 있다.
"""

import json
import os
import sys

# `blender --python <파일>`은 그 파일의 디렉터리를 `sys.path`에 넣어 주지 않는다. 넣지 않으면
# 아래 import가 ModuleNotFoundError로 죽는데, 그 예외는 `_common.run`의 감싸기 **전에** 나므로
# 판정 줄도 안 찍힌다. 실행기에게는 「판정 줄이 없다」로 보여 원인이 엉뚱한 곳을 가리킨다.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import _common as common  # noqa: E402 - 위 경로 주입 뒤에 와야 한다

# 대응표를 만들 때 먼저 확인할 핵심 본. VRM 1.0 휴머노이드가 반드시 갖는 것들이다.
CORE_BONE_HINTS = (
    'hips',
    'spine',
    'chest',
    'neck',
    'head',
    'shoulder',
    'upperarm',
    'lowerarm',
    'hand',
    'upperleg',
    'lowerleg',
    'foot',
)


def core_bones(names):
    """
    핵심 본으로 보이는 이름만 골라 힌트별로 묶는다.

    이름 표기는 도구마다 갈린다(`J_Bip_C_Hips` · `Hips` · `mixamorig:Hips`). 그래서 정확히
    일치시키지 않고 소문자에서 부분 일치로 모은다 — 대응표를 사람이 채울 때 후보를 좁히는
    것이 목적이고, 확정은 게이트 0c가 한다.
    """
    found = {}
    for hint in CORE_BONE_HINTS:
        hits = [n for n in names if hint in n.lower().replace('_', '')]
        if hits:
            found[hint] = sorted(hits)
    return found


def main():
    args = common.script_args()
    vrm_path = common.parse_arg(args, 'vrm')
    out_path = common.parse_arg(args, 'out')
    bones_path = common.parse_arg(args, 'bones')

    if not vrm_path:
        raise common.GateError('vrm-path', '`-- --vrm <경로>`를 받지 못했다')
    if not out_path:
        raise common.GateError('output-path', '`-- --out <경로>`를 받지 못했다')
    # 캔버스는 게이트 2가 굽는 규격과 같고 `gate.ts`가 `PLAYER_FRAME_SPEC`에서 넘긴다(스크립트에
    # 복사해 두지 않는 이유는 `common.parse_int_arg`에 있다). 0b에서부터 같은 캔버스로 보는 이유는,
    # 프레이밍을 나중에 바꾸면 0b가 통과시킨 구도와 게이트 2가 굽는 구도가 달라져 0b의 통과가
    # 아무것도 보장하지 않게 되기 때문이다.
    canvas_width = common.parse_int_arg(args, 'width')
    canvas_height = common.parse_int_arg(args, 'height')

    common.assert_version()
    engine = common.pick_eevee()
    absolute_out = common.assert_output_path(out_path)

    armature = common.import_vrm(vrm_path)
    names = [b.name for b in armature.data.bones]

    lo, hi = common.world_bounds()
    camera = common.setup_camera(lo, hi, canvas_width, canvas_height)
    common.setup_lights()
    common.setup_render(engine, canvas_width, canvas_height, absolute_out)
    common.render_still(absolute_out)

    if bones_path:
        target = common.assert_output_path(bones_path)
        with open(target, 'w', encoding='utf-8') as handle:
            json.dump(
                {'armature': armature.name, 'count': len(names), 'bones': names},
                handle,
                ensure_ascii=False,
                indent=2,
            )

    common.gate_ok(
        {
            'gate': '0b',
            'blender': __import__('bpy').app.version_string,
            'engine': engine,
            'armature': armature.name,
            'bone_count': len(names),
            'core_bones': core_bones(names),
            # 인물의 실측 크기. VRM 단위는 미터이므로 `height`가 대략 키다. 4등신을 VRoid
            # 슬라이더로 밀었는지는 사람이 보지만, 키가 터무니없으면 여기서 먼저 드러난다.
            'height_m': round(hi.z - lo.z, 4),
            'width_m': round(hi.x - lo.x, 4),
            'depth_m': round(hi.y - lo.y, 4),
            'ortho_scale': round(camera.data.ortho_scale, 4),
            'output': absolute_out.replace('\\', '/'),
            'bones_json': os.path.abspath(bones_path).replace('\\', '/') if bones_path else None,
            'width': canvas_width,
            'height': canvas_height,
        }
    )


if __name__ == '__main__':
    common.run(main)
