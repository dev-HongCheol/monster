"""
G4 — 시각 층 하나를 굽는다. 층마다 캔버스가 달라도 캐릭터 크기는 같게 유지한다.

**카메라는 언제나 기준 몸 규격으로 계산한다.** 층 캔버스(`--layer-width`·`--layer-height`)는
`ortho_scale`만 비례로 키우고 카메라의 위치·회전·투영은 건드리지 않는다. 그래서 캔버스를 키우면
캐릭터가 커지거나 작아지는 것이 아니라 **주변이 더 보일 뿐**이고, 모든 층의 캔버스 중심이 같은
월드 점에 놓인다. 게임이 층을 겹칠 때 기대는 것이 그 성질이다.

**`ortho_scale`은 긴 변을 덮는다.** 그래서 비례식의 분모는 세로가 아니라 `max(가로, 세로)`다.
세로로 적어 두면 가로가 더 긴 캔버스(눕힌 창·펼친 날개)에서 배율이 조용히 어긋난다.

    per_pixel   = 인물 높이 / (foot_row - head_row)     ← 배율의 유일한 출처
    ortho_scale = per_pixel * max(층 가로, 층 세로)

판정은 하지 않는다. 굽고 실측을 보고하는 것까지이고 재는 것은 실행기가 한다
(`README.md` 「판정은 파이썬에 없다」).

돌리는 법과 실패 코드 표는 `tools/blender/README.md`에 있다.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import _common as common  # noqa: E402 - 위 경로 주입 뒤에 와야 한다
import retarget_render as retarget  # noqa: E402 - 기준 팔 자세 값의 주인이다


def main():
    import bpy

    args = common.script_args()
    vrm_path = common.parse_arg(args, 'vrm')
    out_path = common.parse_arg(args, 'out')

    if not vrm_path:
        raise common.GateError('vrm-path', '`-- --vrm <경로>`를 받지 못했다')
    if not out_path:
        raise common.GateError('output-path', '`-- --out <경로>`를 받지 못했다')

    # 기준 몸 규격. 값의 주인은 `tests/helpers/FrameSet.ts`의 `PLAYER_FRAME_SPEC`이고
    # 실행기가 넘긴다(스크립트에 기본값을 두지 않는 이유는 `common.parse_int_arg`에 있다).
    base_width = common.parse_int_arg(args, 'width')
    base_height = common.parse_int_arg(args, 'height')
    foot_row = common.parse_int_arg(args, 'foot-row')
    head_row = common.parse_int_arg(args, 'head-row')

    # 층 캔버스. 생략하면 기준과 같다 — 몸 층이 그 경우다.
    layer_width = common.parse_arg(args, 'layer-width')
    layer_height = common.parse_arg(args, 'layer-height')
    layer_width = int(layer_width) if layer_width else base_width
    layer_height = int(layer_height) if layer_height else base_height

    if layer_width < base_width or layer_height < base_height:
        raise common.GateError(
            'camera-framing',
            '층 캔버스는 기준 캔버스보다 작을 수 없다 '
            '(기준 {0}×{1}, 층 {2}×{3}) — 작게 잡으면 몸이 잘린다'.format(
                base_width, base_height, layer_width, layer_height
            ),
        )

    common.assert_version()
    engine = common.pick_eevee()
    absolute_out = common.assert_output_path(out_path)

    armature = common.import_vrm(vrm_path)
    # 자세를 먼저 입히고 상자를 잰다. A 포즈로 벌린 팔은 게임에 나오지 않는데도 인물 폭을
    # 결정해 카메라 가로 판정을 떨어뜨린다.
    common.apply_pose(armature, retarget.BASE_ARM_POSE, retarget.BASE_POSE_ORDER)
    lo, hi = common.world_bounds()

    # 카메라는 기준 규격으로 세운다. 층 캔버스는 여기에 관여하지 않는다.
    camera = common.setup_camera(
        lo, hi, base_width, base_height, foot_row=foot_row, head_row=head_row
    )

    # 배율의 유일한 출처. `setup_camera`가 같은 식으로 `ortho_scale`을 정했으므로, 층 캔버스에
    # 맞춰 다시 곱해도 픽셀 하나가 덮는 월드 크기는 변하지 않는다.
    per_pixel = (hi.z - lo.z) / float(foot_row - head_row)
    camera.data.ortho_scale = per_pixel * max(layer_width, layer_height)

    common.setup_lights()
    common.setup_render(engine, layer_width, layer_height, absolute_out)
    common.render_still(absolute_out)

    common.gate_ok(
        {
            'gate': 'g4-layer',
            'blender': bpy.app.version_string,
            'engine': engine,
            'armature': armature.name,
            'base_canvas': [base_width, base_height],
            'layer_canvas': [layer_width, layer_height],
            # 두 층이 같은 배율로 구워졌는지는 이 값이 같은지로 확인한다.
            'per_pixel_m': round(per_pixel, 9),
            'ortho_scale': round(camera.data.ortho_scale, 6),
            'camera_location': [round(v, 6) for v in camera.location],
            'height_m': round(hi.z - lo.z, 6),
            'output': absolute_out.replace(os.sep, '/'),
        }
    )


if __name__ == '__main__':
    common.run(main)
