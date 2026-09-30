"""
게이트 0a — 이 장비에서 헤드리스 Blender와 파이썬과 투명 EEVEE가 도는가.

**이 파일은 독립이다.** VRM 애드온도 모델도 `_common`도 import하지 않고, 사용자의 시작
파일조차 쓰지 않는다. 공용 모듈을 거치면 「여기서 막히면 VRoid를 설치하지 않는다」가 조용히
깨진다 — 애드온이나 모델 때문에 난 실패가 환경 실패로 보고되면, 되돌릴 비용이 가장 작은
지점을 지나친 채로 캐릭터 작업에 들어가게 된다.

판정은 하지 않는다. 여기서 하는 일은 PNG 한 장을 쓰고 그 경로를 기계가 읽는 한 줄로
보고하는 것까지다. 알파가 제대로 비었는지는 실행기(`gate.ts`)가 잰다. 그래야 판정이
Blender 버전을 안 탄다.

돌리는 법과 실패 코드 표는 `tools/blender/README.md`에 있다.
"""

import json
import os
import sys

import bpy

# 허용 Blender 범위. 상한은 VRM 임포터 애드온이 정한다 — 그 애드온이 5.3 이상을 미지원으로
# 선언했다. 하한은 EEVEE 엔진 식별자가 4.2에서 바뀐 자리여서, 그 아래는 이 스크립트가
# 고르는 식별자가 존재하지 않는다.
MIN_VERSION = (4, 2)
MAX_VERSION = (5, 2)

# EEVEE 식별자를 하드코딩하지 않는다. 4.2에서 `BLENDER_EEVEE`가 `BLENDER_EEVEE_NEXT`로
# 바뀐 전례가 있고 5.x에서 또 바뀔 수 있다. 런타임에 실제 목록을 보고 고르면 어느 쪽이든
# 맞고, 둘 다 없을 때는 **실제 목록을 메시지에 담아** 실패할 수 있다.
EEVEE_CANDIDATES = ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE')

# 스모크라 작게 굽는다. 여기서 재는 것은 그림이 아니라 「투명 렌더가 도는가」다.
RESOLUTION = 256

# 레포 뿌리. 이 파일이 있는 `tools/blender/`에서 두 단계 위다. 출하 아트 경로를 상대 경로로 두면
# Blender를 띄운 작업 디렉터리를 기준으로 풀려서, 다른 폴더에서 부르는 순간 출하 아트를 가리키지
# 못하고 아래 거부가 조용히 꺼진다.
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 출하 아트가 있는 곳. 이 아래로는 어떤 경우에도 쓰지 않는다.
SHIPPED_ART_DIR = os.path.join(REPO_ROOT, 'game', 'assets', 'art')


def gate_ok(payload):
    """성공 줄을 찍는다. 실행기가 stdout에서 뒤에서부터 이 줄을 찾는다."""
    print('GATE_OK ' + json.dumps(payload, sort_keys=True))


def gate_fail(code, message):
    """실패 줄을 찍는다. `code`로 무엇이 안 됐는지를 갈라 보고 `message`는 사람이 읽는다."""
    print('GATE_FAIL {0} {1}'.format(code, message))


def force_utf8_stdout():
    """
    stdout을 UTF-8로 고정한다.

    실행기가 파이프로 받을 때 파이썬은 로케일 인코딩을 쓰는데, 이 프로젝트의 장비는
    윈도우라 그것이 cp949다. 그러면 실패 메시지의 한글이 인코딩 예외를 던지고, **판정 줄
    자체가 안 찍힌다.** 원인이 메시지 내용인데 증상은 「판정 줄이 없다」로 나타나므로,
    실행기가 가리키는 곳과 실제 원인이 어긋난다.
    """
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')


def script_args():
    """Blender가 자기 인자를 먹으므로 `--` 뒤만 본다."""
    if '--' not in sys.argv:
        return []
    return sys.argv[sys.argv.index('--') + 1 :]


def parse_out_path(args):
    """`--out <경로>`를 읽는다. 없으면 `None`."""
    if '--out' not in args:
        return None
    index = args.index('--out') + 1
    if index >= len(args):
        return None
    return args[index]


def assert_version():
    """
    버전이 범위 밖이면 검증된 범위를 이름으로 말하며 실패한다.

    앞 두 자리만 비교한다. 세 자리를 그대로 견주면 `(5, 2, 3) <= (5, 2)`가 거짓이라
    5.2의 패치 판이 범위 밖으로 떨어진다.
    """
    version = bpy.app.version
    if MIN_VERSION <= version[:2] <= MAX_VERSION:
        return
    raise GateError(
        'blender-version',
        '기대 {0}.{1}~{2}.{3}, 지금 {4}'.format(
            MIN_VERSION[0],
            MIN_VERSION[1],
            MAX_VERSION[0],
            MAX_VERSION[1],
            bpy.app.version_string,
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
        '기대 {0} 중 하나, 실제 목록 {1}'.format(
            list(EEVEE_CANDIDATES),
            available,
        ),
    )


def is_under(path, directory):
    """
    `path`가 `directory` 자신이거나 그 아래인지 본다.

    **경로를 문자열로 견주지 않는다.** 윈도우는 대소문자를 가리지 않아 `Game\\Assets\\Art`도 같은
    폴더이고, 정션이나 심볼릭 링크를 거치면 겉 경로가 전혀 다르다. 문자열 포함으로 재면 둘 다
    통과해서 출하 아트를 덮는다. 그래서 링크를 푼 실제 경로를 운영체제의 대소문자 규칙으로 맞춘 뒤
    공통 조상을 견준다. `_common.py`에 같은 함수가 한 벌 더 있다.
    """
    target = os.path.normcase(os.path.realpath(path))
    root = os.path.normcase(os.path.realpath(directory))
    try:
        return os.path.commonpath([target, root]) == root
    except ValueError:
        # 드라이브가 다르면 공통 조상이 없고, 그러면 아래일 수도 없다.
        return False


def assert_output_path(path):
    """
    출력 경로를 쓸 수 있는지 확인하고, 출하 아트 아래면 거부한다.

    거부가 필요한 이유는 편집 게이트 훅이 `game/assets/scripts/**/*.ts`만 보기 때문이다.
    아트 PNG 덮어쓰기는 어느 phase에서도 막히지 않고, `.meta`가 남아 있는 자리에 파일을
    덮으면 Cocos가 조용히 재임포트해서 출하 아트가 바뀐 것을 아무도 모른다.
    """
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


def build_scene():
    """
    큐브·카메라·광원을 직접 세운다. 사용자의 시작 파일에 의존하지 않는다.

    `use_empty=True`로 빈 장면에서 출발하는 이유가 있다. 시작 파일은 사람마다 다르고,
    누가 기본 큐브를 지워 둔 장비에서는 「투명 렌더가 됐는데 내용이 비었다」가 나온다.
    그 결과는 EEVEE가 고장 난 것과 구별되지 않는다.
    """
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0.0, 0.0, 0.0))

    # 직교 카메라를 쓴다. 원근이면 거리에 따라 크기가 바뀌어 프레이밍 실패와 렌더 실패가
    # 같은 증상으로 보인다.
    camera_data = bpy.data.cameras.new('GateCamera')
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 4.0
    camera = bpy.data.objects.new('GateCamera', camera_data)
    camera.location = (0.0, 0.0, 6.0)
    scene.collection.objects.link(camera)
    scene.camera = camera

    light_data = bpy.data.lights.new('GateLight', type='SUN')
    light_data.energy = 3.0
    light = bpy.data.objects.new('GateLight', light_data)
    light.location = (4.0, -4.0, 6.0)
    light.rotation_euler = (0.8, 0.2, 0.6)
    scene.collection.objects.link(light)

    return scene


def render_transparent(scene, engine, out_path):
    """투명 배경 RGBA PNG 한 장을 쓴다."""
    scene.render.engine = engine
    scene.render.film_transparent = True
    scene.render.resolution_x = RESOLUTION
    scene.render.resolution_y = RESOLUTION
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)

    if not os.path.exists(out_path):
        raise GateError('output-path', '렌더가 끝났는데 파일이 없다: {0}'.format(out_path))
    if os.path.getsize(out_path) == 0:
        raise GateError('output-path', '파일이 0바이트다: {0}'.format(out_path))


class GateError(Exception):
    """판정 줄로 보고할 실패. `code`가 README의 실패 코드 표와 같은 어휘다."""

    def __init__(self, code, message):
        super(GateError, self).__init__(message)
        self.code = code
        self.message = message


def main():
    force_utf8_stdout()

    out_path = parse_out_path(script_args())
    if out_path is None:
        raise GateError('output-path', '`-- --out <경로>`를 받지 못했다')

    assert_version()
    engine = pick_eevee()
    absolute = assert_output_path(out_path)
    scene = build_scene()
    render_transparent(scene, engine, absolute)

    gate_ok(
        {
            'gate': '0a',
            'blender': bpy.app.version_string,
            'engine': engine,
            'output': absolute.replace('\\', '/'),
            'width': RESOLUTION,
            'height': RESOLUTION,
        }
    )


# 종료 코드만으로는 성공과 실패가 갈리지 않는다. `blender --background --python`은 스크립트가
# 예외를 던져도 0을 내므로, 호출 쪽에 `--python-exit-code 1`을 걸고 여기서도 직접 나간다.
if __name__ == '__main__':
    try:
        main()
    except GateError as err:
        gate_fail(err.code, err.message)
        sys.exit(1)
    except Exception as err:  # noqa: BLE001 - 어떤 예외든 판정 줄로 바꿔야 한다
        gate_fail('unexpected', '{0}: {1}'.format(type(err).__name__, err))
        sys.exit(1)
