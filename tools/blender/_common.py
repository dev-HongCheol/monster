"""
게이트 0b 이후가 공유하는 부분 — VRM 임포트, 카메라 프레이밍, 렌더 설정.

**`smoke.py`는 이 파일을 import하지 않는다. 그래서 아래 plumbing이 거기에 한 벌 더 있다.**
의도한 중복이다. 게이트 0a는 「이 장비에서 헤드리스 Blender가 도는가」만 물어야 하는데, 그
스크립트가 공용 모듈을 거치면 이 파일의 문제나 VRM 애드온의 문제가 **환경 실패로 보고된다.**
그러면 계획이 0a에 맡긴 역할, 즉 되돌릴 비용이 가장 작은 지점에서 멈추는 일이 깨진다.

중복을 없애려면 plumbing만 담은 제3의 모듈을 만들어야 하는데, 그러면 0a가 다시 남의 파일에
의존하게 되므로 같은 문제로 돌아온다. 그래서 **두 벌을 유지하고 그 이유를 여기 적는다.**
한쪽을 고치면 다른 쪽도 본다.
"""

import json
import os
import sys

import bpy
from mathutils import Vector

# 허용 Blender 범위. `smoke.py`와 같은 값이어야 한다.
MIN_VERSION = (4, 2)
MAX_VERSION = (5, 2)

# EEVEE 식별자를 하드코딩하지 않는 이유는 `smoke.py`에 적었다. 5.2 실측은 `BLENDER_EEVEE`다.
EEVEE_CANDIDATES = ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE')

# 레포 뿌리. 이 파일이 있는 `tools/blender/`에서 두 단계 위다. 출하 아트 경로를 상대 경로로 두면
# Blender를 띄운 작업 디렉터리를 기준으로 풀려서, 다른 폴더에서 부르는 순간 출하 아트를 가리키지
# 못하고 아래 거부가 조용히 꺼진다.
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 출하 아트가 있는 곳. 이 아래로는 어떤 경우에도 쓰지 않는다.
SHIPPED_ART_DIR = os.path.join(REPO_ROOT, 'game', 'assets', 'art')


class GateError(Exception):
    """판정 줄로 보고할 실패. `code`가 README의 실패 코드 표와 같은 어휘다."""

    def __init__(self, code, message):
        super(GateError, self).__init__(message)
        self.code = code
        self.message = message


def gate_ok(payload):
    """성공 줄을 찍는다. 실행기가 stdout에서 뒤에서부터 이 줄을 찾는다."""
    print('GATE_OK ' + json.dumps(payload, sort_keys=True))


def gate_fail(code, message):
    """실패 줄을 찍는다."""
    print('GATE_FAIL {0} {1}'.format(code, message))


def force_utf8_stdout():
    """
    stdout을 UTF-8로 고정한다.

    파이프로 받을 때 파이썬은 로케일 인코딩을 쓰는데 이 장비는 윈도우라 cp949다. 그러면 한글
    실패 메시지가 인코딩 예외를 던져 **판정 줄 자체가 안 찍힌다.** 원인은 메시지 내용인데
    증상은 「판정 줄이 없다」라서, 실행기가 가리키는 곳과 실제 원인이 어긋난다.
    """
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')


def script_args():
    """Blender가 자기 인자를 먹으므로 `--` 뒤만 본다."""
    if '--' not in sys.argv:
        return []
    return sys.argv[sys.argv.index('--') + 1 :]


def parse_arg(args, name, default=None):
    """`--<name> <값>`을 읽는다. 없으면 `default`."""
    flag = '--' + name
    if flag not in args:
        return default
    index = args.index(flag) + 1
    if index >= len(args):
        return default
    return args[index]


def parse_int_arg(args, name):
    """
    `--<name> <정수>`를 읽는다. 없거나 정수가 아니면 `spec-args`로 실패한다.

    **기본값을 두지 않는다.** 이 함수로 읽는 것은 캔버스와 발·머리 행 같은 규격 값이고, 그 주인은
    `tests/helpers/FrameSet.ts`의 `PLAYER_FRAME_SPEC`이다. `gate.ts`가 거기서 넘기는데, 스크립트에
    기본값을 두면 그것이 곧 복사본이다. 한쪽만 고치면 굽기는 옛 값을, 판정은 새 값을 써서 게이트가
    떨어지는데, 실패 메시지가 「인물이 규격보다 작게 구워졌다」 같은 크기·위치 결함을 가리켜서 원인이
    두 벌의 불일치라는 것이 드러나지 않는다.
    """
    raw = parse_arg(args, name)
    if raw is None:
        raise GateError(
            'spec-args', '`-- --{0} <정수>`를 받지 못했다 — gate.ts를 거쳐 부른다'.format(name)
        )
    try:
        return int(raw)
    except ValueError:
        raise GateError('spec-args', '--{0}이 정수가 아니다 (받은 값 {1})'.format(name, raw))


def assert_version():
    """버전이 범위 밖이면 검증된 범위를 이름으로 말하며 실패한다. 앞 두 자리만 비교한다."""
    if MIN_VERSION <= bpy.app.version[:2] <= MAX_VERSION:
        return
    raise GateError(
        'blender-version',
        '기대 {0}.{1}~{2}.{3}, 지금 {4}'.format(
            MIN_VERSION[0], MIN_VERSION[1], MAX_VERSION[0], MAX_VERSION[1], bpy.app.version_string
        ),
    )


def pick_eevee():
    """설치된 엔진 목록에서 EEVEE를 고른다. 없으면 실제 목록을 담아 실패한다."""
    items = bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items
    available = [item.identifier for item in items]
    for name in EEVEE_CANDIDATES:
        if name in available:
            return name
    raise GateError(
        'eevee-missing',
        '기대 {0} 중 하나, 실제 목록 {1}'.format(list(EEVEE_CANDIDATES), available),
    )


def vrm_addon_module():
    """
    켜진 애드온 중 VRM 임포터의 모듈 이름을 돌려준다. 없으면 `None`.

    이름을 하드코딩하지 않는 이유는 설치 방식에 따라 갈리기 때문이다 — 4.2 이후 확장으로 깔면
    `bl_ext.user_default.vrm`이고 레거시 애드온으로 깔면 `io_scene_vrm`이다. EEVEE 식별자와
    같은 이유로 런타임에 찾는다.
    """
    for key in bpy.context.preferences.addons.keys():
        if 'vrm' in key.lower().split('.')[-1]:
            return key
    return None


def assert_vrm_import_operator():
    """
    VRM 임포트 오퍼레이터를 **실제로 부를 수 있는지** 확인한다.

    **`hasattr(bpy.ops.import_scene, 'vrm')`로 재면 안 된다.** `bpy.ops`는 동적 이름공간이라
    없는 오퍼레이터에도 `True`를 돌려준다. 2026-09-11에 실측으로 확인했다 — 애드온이 꺼진
    상태에서도 `hasattr`가 `True`였고 `poll()`만 AttributeError를 냈다. 그 차이를 모르면
    게이트가 「애드온 등록됨」을 보고한 직후 import 줄에서 죽고, 실패 코드가 `vrm-path`로
    잡혀 원인이 파일 쪽인 것처럼 보인다.
    """
    try:
        ready = bpy.ops.import_scene.vrm.poll()
    except AttributeError as err:
        enabled = sorted(bpy.context.preferences.addons.keys())
        raise GateError('vrm-addon-missing', '{0} — 켜진 애드온 {1}'.format(err, enabled))
    if not ready:
        raise GateError(
            'vrm-addon-missing',
            'bpy.ops.import_scene.vrm.poll()이 False다 — 오퍼레이터는 있으나 부를 수 없다',
        )


def is_under(path, directory):
    """
    `path`가 `directory` 자신이거나 그 아래인지 본다.

    **경로를 문자열로 견주지 않는다.** 윈도우는 대소문자를 가리지 않아 `Game\\Assets\\Art`도 같은
    폴더이고, 정션이나 심볼릭 링크를 거치면 겉 경로가 전혀 다르다. 문자열 포함으로 재면 둘 다
    통과해서 출하 아트를 덮는다. 그래서 링크를 푼 실제 경로를 운영체제의 대소문자 규칙으로 맞춘 뒤
    공통 조상을 견준다.

    **`smoke.py`에 같은 함수가 한 벌 더 있다.** 그 파일이 이 모듈을 import하지 않는 이유는 이 파일
    첫머리에 있다. 한쪽을 고치면 다른 쪽도 본다.
    """
    target = os.path.normcase(os.path.realpath(path))
    root = os.path.normcase(os.path.realpath(directory))
    try:
        return os.path.commonpath([target, root]) == root
    except ValueError:
        # 드라이브가 다르면 공통 조상이 없고, 그러면 아래일 수도 없다.
        return False


def assert_output_path(path):
    """출력 경로를 쓸 수 있는지 확인하고, 출하 아트 아래면 거부한다."""
    absolute = os.path.abspath(path)
    if is_under(absolute, SHIPPED_ART_DIR):
        raise GateError('output-path', '출하 아트 아래로는 쓰지 않는다: {0}'.format(absolute))

    parent = os.path.dirname(absolute)
    try:
        os.makedirs(parent, exist_ok=True)
    except OSError as err:
        raise GateError('output-path', '디렉터리를 만들 수 없다 {0}: {1}'.format(parent, err))
    if not os.access(parent, os.W_OK):
        raise GateError('output-path', '쓸 수 없는 디렉터리다: {0}'.format(parent))
    return absolute


def import_vrm(vrm_path):
    """
    빈 장면에서 출발해 `.vrm`을 읽는다.

    @param vrm_path `.vrm` 파일 경로
    @returns 임포트된 아마추어 오브젝트
    """
    absolute = os.path.abspath(vrm_path)
    if not os.path.exists(absolute):
        raise GateError('vrm-path', '파일이 없다: {0}'.format(absolute))

    # **모듈 이름을 초기화 전에 잡는다.** 아래 `read_factory_settings`가 환경설정을 공장 기본으로
    # 되돌리므로 **사용자가 설치한 확장이 빠진다**(2026-09-11 실측: 9개 중 VRM 확장 하나만
    # 사라지고 `io_scene_gltf2` 같은 내장은 남는다). 빠진 뒤에 이름을 찾으면 찾을 것이 없다.
    module = vrm_addon_module()
    if module is None:
        raise GateError(
            'vrm-addon-missing',
            'VRM 애드온이 켜져 있지 않다 — 켜진 애드온 {0}'.format(
                sorted(bpy.context.preferences.addons.keys())
            ),
        )

    bpy.ops.wm.read_factory_settings(use_empty=True)

    # 빈 장면에서 출발하는 이점은 유지하고, 초기화가 끈 애드온만 다시 켠다.
    bpy.ops.preferences.addon_enable(module=module)
    assert_vrm_import_operator()

    try:
        bpy.ops.import_scene.vrm(filepath=absolute)
    except Exception as err:
        raise GateError('vrm-path', '임포트 실패 {0}: {1}'.format(type(err).__name__, err))

    armatures = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    if not armatures:
        raise GateError('vrm-path', '임포트는 됐는데 아마추어가 없다 — 골격 없는 VRM이다')
    return armatures[0]


def append_vrm(vrm_path):
    """
    **이미 있는 장면에** `.vrm`을 하나 더 읽는다. 초기화하지 않는다.

    `import_vrm`은 빈 장면에서 출발하려고 `read_factory_settings`를 부르므로, 두 번째로 부르면
    첫 임포트가 통째로 사라진다(2026-09-16 실측: 그 뒤 첫 임포트의 오브젝트를 만지면
    `StructRNA of type Object has been removed`가 난다). 상의 층처럼 두 판을 한 장면에 놓아야
    하는 자리가 이 함수를 쓴다.

    애드온은 다시 켜지 않는다. 초기화를 안 하므로 `import_vrm`이 켜 둔 상태가 그대로 살아 있다.

    @returns `(아마추어, 이번 임포트로 생긴 오브젝트 전부)`
    """
    absolute = os.path.abspath(vrm_path)
    if not os.path.exists(absolute):
        raise GateError('vrm-path', '파일이 없다: {0}'.format(absolute))

    assert_vrm_import_operator()
    before = set(bpy.data.objects)
    try:
        bpy.ops.import_scene.vrm(filepath=absolute)
    except Exception as err:
        raise GateError('vrm-path', '임포트 실패 {0}: {1}'.format(type(err).__name__, err))

    added = [o for o in bpy.data.objects if o not in before]
    armatures = [o for o in added if o.type == 'ARMATURE']
    if not armatures:
        raise GateError('vrm-path', '덧붙인 임포트에 아마추어가 없다: {0}'.format(absolute))
    return armatures[0], added


def object_bounds(objects):
    """
    주어진 오브젝트만 감싸는 월드 좌표 상자.

    `world_bounds`가 장면의 모든 메시를 보는 것과 다르다. 카메라는 **몸에만** 맞춰야 하므로
    (G4 §3), 무기와 상의를 장면에 올린 뒤에도 몸만 골라 잴 수단이 필요하다.
    """
    from mathutils import Vector

    lows, highs = None, None
    for obj in objects:
        if obj.type != 'MESH':
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            if lows is None:
                lows, highs = point.copy(), point.copy()
                continue
            for axis in range(3):
                lows[axis] = min(lows[axis], point[axis])
                highs[axis] = max(highs[axis], point[axis])
    if lows is None:
        raise GateError('camera-framing', '상자를 잴 메시가 없다')
    return lows, highs


def apply_world_delta_pose(armature, angles_by_bone, order):
    """
    각도를 **월드 공간에서 rest 자세에 곱하는 델타**로 보고 입힌다. 팔 자세가 이 방식이다.

    **로컬 회전으로 넣으면 안 된다.** `pose_bone.rotation_quaternion`에 그대로 넣으면 Blender가
    그것을 부모 기준 로컬 회전으로 해석하는데, `BASE_ARM_POSE`의 값은 그 기준계로 잰 것이
    아니다. 2026-09-16에 실제로 그렇게 넣었다가 두 팔이 머리 위로 올라가 손이 서로 가까워진
    자세가 나왔다. `retarget_render.retarget_bake`가 쓰는 식과 같은 식을 여기 둔다.

        wanted = (delta × rest_회전)을 행렬로, 위치는 본의 현재 위치를 그대로
        pose_bone.matrix = 아마추어_월드⁻¹ × wanted

    **부모부터 자식 순으로 넣고 그때마다 뷰 레이어를 갱신한다.** 위치를 본의 **현재** 행렬에서
    가져오므로, 부모가 아직 안 돌아간 상태에서 자식을 넣으면 자식이 옛 자리에 붙는다.

    **값은 여기 두지 않는다.** 주인은 `retarget_render.BASE_ARM_POSE`이고 이 함수는 입히는
    기계만 맡는다. 값을 복사해 두면 굽기와 측정이 서로 다른 자세를 보게 되고, 그러면 측정이
    통과시킨 크기가 실제 굽기에서 캔버스를 넘는다.

    @param armature 포즈를 입힐 아마추어 오브젝트
    @param angles_by_bone `{본 이름: (x, y, z)}` — 각도는 도 단위. 부모가 자식보다 앞에 온다
    @param order 오일러 회전 순서 문자열 (팔은 `YXZ`)
    """
    from math import radians

    from mathutils import Euler

    for name, angles in angles_by_bone.items():
        bone = armature.pose.bones.get(name)
        if bone is None:
            raise GateError(
                'retarget-bone', '자세가 쓰는 본을 이 골격에서 못 찾았다: {0}'.format(name)
            )
        rest = armature.matrix_world @ armature.data.bones[name].matrix_local
        delta = Euler([radians(a) for a in angles], order).to_quaternion()
        wanted = (delta @ rest.to_quaternion()).to_matrix().to_4x4()
        wanted.translation = (armature.matrix_world @ bone.matrix).translation
        bone.matrix = armature.matrix_world.inverted() @ wanted
        bpy.context.view_layer.update()


def apply_local_pose(armature, angles_by_bone, order):
    """
    각도를 **부모 기준 로컬 회전**으로 보고 입힌다. 손가락 그립이 이 방식이다.

    팔과 방식이 다른 것은 의도한 것이다. `retarget_render`가 팔은 월드 델타로, 손가락은 로컬
    회전으로 넣고 오일러 순서도 각각 `YXZ`와 `XYZ`로 다르다. 한쪽 방식으로 통일하면 그 값들이
    잰 기준계가 바뀌어 손이 엉뚱하게 꺾인다.

    **없는 본은 건너뛴다.** 손가락 본은 모델에 따라 빠질 수 있고, 그때 멈추면 손가락이 없는
    골격으로는 아무것도 굽지 못한다.

    @param armature 포즈를 입힐 아마추어 오브젝트
    @param angles_by_bone `{본 이름: (x, y, z)}` — 각도는 도 단위
    @param order 오일러 회전 순서 문자열 (손가락은 `XYZ`)
    """
    from math import radians

    from mathutils import Euler

    for name, angles in angles_by_bone.items():
        bone = armature.pose.bones.get(name)
        if bone is None:
            continue
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = Euler([radians(a) for a in angles], order).to_quaternion()
    bpy.context.view_layer.update()


def world_bounds():
    """
    장면의 모든 메시를 감싸는 월드 좌표 상자.

    아마추어의 상자를 쓰지 않는 이유는 본이 메시 밖으로 나갈 수 있고 머리카락·옷처럼 실제로
    화면을 차지하는 것이 메시에만 있기 때문이다. 카메라가 봐야 하는 것은 그려지는 쪽이다.

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
        raise GateError('vrm-path', '메시가 없다 — 렌더할 것이 없다')
    return lo, hi


def setup_camera(
    lo, hi, width_px, height_px, margin=0.04, foot_row=None, head_row=None, view='front', pitch=0.0
):
    """
    인물을 정면에서 담는 직교 카메라를 세운다. `pitch`(도)를 주면 정면에서 그만큼 내려다본다.

    **직교를 쓴다.** 원근이면 거리에 따라 크기가 바뀌어 프레이밍 실패와 렌더 실패가 같은 증상으로
    보이고, 프레임마다 팔다리가 앞뒤로 움직이는 걷기에서는 원근 왜곡이 등신비를 흔든다.

    VRM 1.0 모델은 +Z를 향하고, 애드온이 Blender의 Z-up으로 옮기면 정면이 -Y 쪽에서 보는
    방향이 된다. 그래서 카메라를 -Y에 두고 +Y를 보게 한다. 2026-09-11 게이트 0b의 첫 렌더로
    이 방향이 실제로 정면임을 확인했다.

    **가로와 세로를 둘 다 본다.** `ortho_scale`은 렌더의 **긴 변**만 덮으므로, 세로만 맞추면
    가로가 좁은 채로 남는다. 첫 판이 그렇게 짜여 있었고 A 포즈로 벌린 손이 좌우로 잘렸는데,
    잘린 PNG는 파일도 알파도 정상이라 숫자만 봐서는 안 드러났다(트림 상자 가로가 캔버스 폭과
    같아진 것이 유일한 단서였다).

    **규격 캔버스에 구울 때는 발과 머리의 행을 둘 다 정한다.** 발 밑선 하나만 고정하고 배율을
    사방 여백으로 정하면, 위아래 여백 몫이 발 아래로 갈 수 없으므로 전부 머리 위로 몰린다.
    그러면 인물이 캔버스를 덜 채우고, 출하 아트와 같은 48×96 상자에 넣는 게임에서 3D 인물만
    작게 보인다. 2026-09-14까지 구운 프레임이 그랬다 — 여백 4%에서 머리 꼭대기가 33~40행이라
    키가 출하된 2D 정면(2행에서 489행까지)의 92%였다. 그래서 두 행을 받으면 세로는 여백 없이
    그 사이를 채우고, 여백은 가로가 캔버스 안에 들어오는지만 판정한다.

    @param width_px 렌더 가로 픽셀
    @param height_px 렌더 세로 픽셀
    @param margin 여백의 비율. 캔버스가 아니라 **인물 크기**에 곱하므로 0.04면 인물 폭(과 높이)의
        4%씩 양쪽에 여유가 생긴다. `foot_row`·`head_row`를 주지 않으면 사방에 두고, 주면 가로
        양쪽에만 둔다
    @param foot_row 인물의 **가장 낮은 점**이 놓일 픽셀 행(위에서부터 0). `None`이면 세로
        가운데에 맞춘다. 출하 규격의 발 밑선에 맞추려면 이 값을 준다 — 가운데 맞춤으로 구우면
        발 밑선이 프레이밍에 따라 아무 데나 잡혀 규격 판정이 성립하지 않는다. **`head_row`와
        함께 줘야 한다**
    @param head_row 인물의 **가장 높은 점**이 놓일 픽셀 행. `foot_row`와 함께 주면 둘 사이의
        행 수가 배율을 정한다. 인물 폭이 그 배율로 여백 안에 안 들어오면 줄여 맞추지 않고
        `camera-framing`으로 실패한다 — 몰래 줄이면 이 함수가 막으려는 크기 어긋남이 다시 난다
    @param view `front`면 정면, `side`면 왼쪽 옆에서 본다. **측면은 진단용이다** — 걷기의 팔
        스윙과 팔이 몸 앞뒤 어디에 붙어 있는지는 정면 실루엣에 안 드러나서, 팔이 안쪽으로
        말려도 정면 렌더만 보면 「소매만 보인다」로 끝난다
    @returns 카메라 오브젝트
    """
    scene = bpy.context.scene
    center = (lo + hi) / 2.0
    height = hi.z - lo.z
    # 가로로 담아야 하는 실제 폭은 보는 방향에 따라 다르다. 정면은 좌우 폭(X), 측면은 앞뒤
    # 깊이(Y)가 화면 가로를 채운다.
    width = (hi.x - lo.x) if view == 'front' else (hi.y - lo.y)
    if height <= 0:
        raise GateError('camera-framing', '인물 높이가 0이다 (상자 {0} ~ {1})'.format(lo, hi))
    if view not in ('front', 'side'):
        raise GateError('camera-framing', 'view는 front나 side여야 한다 (받은 값 {0})'.format(view))
    if (foot_row is None) != (head_row is None):
        raise GateError(
            'camera-framing',
            'foot_row와 head_row는 함께 줘야 한다 (foot_row {0}, head_row {1}) — 하나만 주면 '
            '여백이 반대쪽으로 몰려 인물 크기가 규격과 달라진다'.format(foot_row, head_row),
        )

    grow = 1.0 + margin * 2.0
    if foot_row is not None:
        if not 0 <= head_row < foot_row < height_px:
            raise GateError(
                'camera-framing',
                '행이 0 ≤ head_row < foot_row < {0}이어야 한다 (head_row {1}, foot_row {2})'.format(
                    height_px, head_row, foot_row
                ),
            )
        # 가장 높은 점과 가장 낮은 점이 각자의 행 중심에 오도록 픽셀 하나의 월드 크기를 정한다.
        per_pixel = height / float(foot_row - head_row)
        width_rows = width / per_pixel
        allowed = width_px / grow
        if width_rows > allowed:
            raise GateError(
                'camera-framing',
                '인물 폭이 {0:.1f}px라 여백 {1:.0f}%를 둔 가로 {2:.1f}px를 넘는다 '
                '(캔버스 {3}×{4}, 행 {5}~{6})'.format(
                    width_rows, margin * 100, allowed, width_px, height_px, head_row, foot_row
                ),
            )
        need = per_pixel * max(width_px, height_px)
    # 긴 변이 `ortho_scale`을 그대로 받고 짧은 변은 종횡비만큼 좁아진다. 그래서 짧은 변에
    # 필요한 값은 종횡비로 나눠 키운 뒤, 둘 중 큰 쪽을 쓴다.
    elif height_px >= width_px:
        need = max(height * grow, width * grow * height_px / width_px)
    else:
        need = max(width * grow, height * grow * width_px / height_px)

    data = bpy.data.cameras.new('GateCamera')
    data.type = 'ORTHO'
    data.ortho_scale = need

    # 세로 중심을 정한다. `foot_row`를 주면 가장 낮은 점이 그 행의 픽셀 중심에 오도록 카메라를
    # 올린다. 픽셀 하나의 월드 크기는 두 행으로 배율을 정할 때 구한 `per_pixel`을 그대로 쓴다 —
    # `need`에서 거꾸로 다시 구하면 같은 값을 두 경로로 얻게 되어, 한쪽만 고쳤을 때 어긋난다.
    if foot_row is None:
        center_z = center.z
    else:
        center_z = lo.z + (foot_row - (height_px - 1) / 2.0) * per_pixel

    camera = bpy.data.objects.new('GateCamera', data)
    distance = max(2.0, height * 2.0)
    if view == 'front' and pitch:
        # 고도 후보(G2)를 굽는 길이다. 시선을 +Y에서 `pitch`도 아래로 기울이고, 몸 중심(x · y)과
        # 세로 중심(`center_z`)을 겨냥한 채 카메라를 그 시선의 반대쪽으로 물린다. 직교라 배율은
        # 그대로고, 인물은 cos(pitch)만큼 짧아 보이며 바닥의 원판은 sin(pitch) 비율의 타원으로
        # 열린다. 발 · 머리 행은 pitch 0에서만 정확하다 — 고도를 견주는 시트용이라 그 오차는
        # 받아들이고, 출하 프레임은 고도가 정해진 뒤 행 규격을 다시 잡는다(2026-09-17).
        from math import cos, radians, sin

        tilt = radians(pitch)
        camera.location = (
            center.x,
            center.y - distance * cos(tilt),
            center_z + distance * sin(tilt),
        )
        camera.rotation_euler = (1.5707963 - tilt, 0.0, 0.0)
    elif view == 'front':
        # X축 90도만 돌리면 카메라가 -Y에서 +Y를 본다. 기본 카메라는 -Z를 보기 때문이다.
        camera.location = (center.x, lo.y - distance, center_z)
        camera.rotation_euler = (1.5707963, 0.0, 0.0)
    else:
        # 거기서 Z축으로 90도 더 돌리면 시선이 +Y에서 -X로 옮겨 간다. 그래서 +X에 놓는다.
        camera.location = (hi.x + distance, center.y, center_z)
        camera.rotation_euler = (1.5707963, 0.0, 1.5707963)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return camera


def setup_lights():
    """툰 판정 전 단계의 기본 조명. 정면 하나와 보조 하나로 실루엣이 보이게만 한다."""
    scene = bpy.context.scene
    for name, location, rotation, energy in (
        ('KeyLight', (0.0, -4.0, 3.0), (1.0, 0.0, 0.0), 4.0),
        ('FillLight', (3.0, -3.0, 2.0), (1.2, 0.0, 0.8), 1.5),
    ):
        data = bpy.data.lights.new(name, type='SUN')
        data.energy = energy
        light = bpy.data.objects.new(name, data)
        light.location = location
        light.rotation_euler = rotation
        scene.collection.objects.link(light)


def setup_render(engine, width, height, out_path):
    """투명 배경 RGBA PNG를 쓸 렌더 설정."""
    render = bpy.context.scene.render
    render.engine = engine
    render.film_transparent = True
    render.resolution_x = width
    render.resolution_y = height
    render.resolution_percentage = 100
    render.image_settings.file_format = 'PNG'
    render.image_settings.color_mode = 'RGBA'
    render.filepath = out_path


def render_still(out_path):
    """한 장을 굽고 실제로 파일이 생겼는지 확인한다."""
    bpy.ops.render.render(write_still=True)
    if not os.path.exists(out_path):
        raise GateError('output-path', '렌더가 끝났는데 파일이 없다: {0}'.format(out_path))
    if os.path.getsize(out_path) == 0:
        raise GateError('output-path', '파일이 0바이트다: {0}'.format(out_path))


def run(main):
    """
    게이트 본문을 감싸 예외를 판정 줄로 바꾼다.

    종료 코드만으로는 성공과 실패가 갈리지 않는다. `blender --background --python`은 스크립트가
    예외를 던져도 0을 내므로, 호출 쪽의 `--python-exit-code 1`과 여기의 `sys.exit(1)`이 한 쌍이다.
    """
    force_utf8_stdout()
    try:
        main()
    except GateError as err:
        gate_fail(err.code, err.message)
        sys.exit(1)
    except Exception as err:  # noqa: BLE001 - 어떤 예외든 판정 줄로 바꿔야 한다
        gate_fail('unexpected', '{0}: {1}'.format(type(err).__name__, err))
        sys.exit(1)
