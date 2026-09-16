"""
지팡이 · 방패 후보를 프리미티브로 세워 굽는다 — 사람이 하나씩 고를 비교물이다.

**모양의 정의는 이 파일이 아니라 넘겨받는 JSON이다.** 후보 표를 스크립트에 박으면 비율을
고칠 때마다 파이썬을 고치게 되고, 그 값이 레포의 어디에 있는지도 흐려진다. 여기서는 부품
목록(원기둥 · 원뿔 · 구 · 토러스 · 상자)을 그대로 세우기만 하므로, 「손잡이를 더 길게」는
표의 숫자 하나를 바꾸는 일이 된다.

**후보를 전부 같은 배율로 굽는다.** 후보마다 자기 크기에 맞춰 프레이밍하면 작은 지팡이와 큰
방패가 화면에서 같은 크기로 보여, 정작 판정해야 할 크기 비율이 사라진다. 그래서 모든 후보의
상자를 합쳐 배율을 한 번 정하고, 키 기준 막대를 옆에 함께 세운다.

**몸에 붙는 부품은 표면에 투영해 세운다.** 끈 · 배판 · 어깨판처럼 몸을 따라야 하는 부품은 좌표 표를
손으로 재서 두면 몸(자세 · 상의)이 바뀔 때마다 어긋난다 — 2026-09-17에 얇은 장식이 허리 앞에 떠 있었고
어깨 구는 관절보다 7.7cm 위에 떠 있었다. 그래서 `Surface`가 몸 메시(머리카락 제외)로 광선을 쏴 정점을
표면에 맞추고 간격만큼 띄운다. 무기 후보 굽기처럼 몸이 없는 자리에서는 이 부품을 세울 수 없다.

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
    양이고, `ripple`은 주름의 위상을 길이 방향 물결로 흔드는 양(라디안)이라 `ripple_phase`를
    돌리면 물결이 위에서 아래로 내려간다.

    **흔들림 프레임은 `sway`와 `ripple_phase`로 만들고 `phase`는 돌리지 않는다.** `phase`를 돌리면
    주름 전체가 옆으로 흘러, 뒷모습에서 천이 좌우로 미끄러지는 것으로 보였다(사용자 판정 2026-09-16).
    카메라가 Y축을 보는 뒷모습에서 `sway`는 깊이 방향이라 안 보이므로, 보이는 움직임은 물결과 아래
    호 길이 보정이 만든다.

    **아래 끝을 들어 올리면 그만큼 짧아져 보여야 한다.** 천은 늘어나지 않으므로 `y = sway·v²`로
    뒤로 젖힌 곡선의 호 길이를 `v·length`에 맞춘다 — `z(v) = ∫√(length² − (2·sway·x)²)dx`. 이
    보정이 없으면 끝자락이 젖혀져도 뒷모습에서 길이가 그대로라 흔들림이 안 읽힌다.
    """
    width = part.get('width', 0.4)
    width_bottom = part.get('width_bottom', width)
    length = part.get('length', 0.6)
    folds = part.get('folds', 4)
    depth = part.get('depth', 0.03)
    depth_top = part.get('depth_top', depth * 0.2)
    phase = part.get('phase', 0.0)
    sway = part.get('sway', 0.0)
    ripple = part.get('ripple', 0.0)
    ripple_waves = part.get('ripple_waves', 1.0)
    ripple_phase = part.get('ripple_phase', 0.0)

    lift = 2.0 * sway
    if lift > length:
        raise common.GateError(
            'weapon-spec', 'cloth의 sway({0})는 length({1})의 절반을 넘을 수 없다'.format(sway, length)
        )

    def hang(v):
        """`v`까지 늘어진 천의 세로 깊이. 젖힌 만큼 짧아진 호 길이 보정이다."""
        if lift < 1e-9:
            return v * length
        return 0.5 * (v * math.sqrt(length * length - lift * lift * v * v) + (length * length / lift) * math.asin(lift * v / length))

    def point_at(u, v):
        span = width + (width_bottom - width) * v
        amplitude = depth_top + (depth - depth_top) * v
        local_phase = phase + ripple * math.sin(2.0 * math.pi * ripple_waves * v - ripple_phase)
        return (
            (u - 0.5) * span,
            amplitude * math.sin(2.0 * math.pi * folds * u + local_phase) + sway * v * v,
            -hang(v),
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


class Surface:
    """
    몸 표면. 부품 좌표의 점을 방향으로 쏴서 몸에 맞춘다.

    부품은 자기 좌표(원점이 본 머리, 축은 캐릭터 방향)로 세워지고 나중에 `frame`(부품 → 세계)으로
    놓이므로, 광선은 세계 좌표로 바꿔 쏘고 맞은 점은 부품 좌표로 되돌린다. 머리카락 면은 뺀다 —
    긴 머리가 등을 덮어서, 안 빼면 등의 끈이 머리카락 표면(등 뒤 10cm 넘게)에 붙는다.
    """

    def __init__(self, body_objects, frame):
        from mathutils.bvhtree import BVHTree

        depsgraph = bpy.context.evaluated_depsgraph_get()
        verts = []
        polys = []
        for obj in body_objects:
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.data
            names = [m.name if m else '' for m in mesh.materials]
            base = len(verts)
            verts.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
            for poly in mesh.polygons:
                if names and 'HAIR' in names[poly.material_index]:
                    continue
                polys.append([base + i for i in poly.vertices])
        if not polys:
            raise common.GateError('weapon-spec', '몸 표면을 만들 면이 없다')
        self.tree = BVHTree.FromPolygons(verts, polys)
        self.frame = frame
        self.inverse = frame.inverted()
        self.rotation = frame.to_3x3()

    def project(self, point, direction, standoff):
        """
        부품 좌표 `point`에서 `direction`(부품 좌표, 정규화 불필요)으로 쏴서 처음 맞은 표면에서
        `standoff`만큼 되돌아온 부품 좌표. 못 맞으면 `None`.
        """
        heading = Vector(direction).normalized()
        origin = self.frame @ Vector(point)
        hit, _normal, _index, _distance = self.tree.ray_cast(origin, self.rotation @ heading, 3.0)
        if hit is None:
            return None
        return (self.inverse @ hit) - heading * standoff


def require_surface(surface, kind):
    """몸 표면이 없으면 그 부품 종류를 말하며 실패한다."""
    if surface is None:
        raise common.GateError(
            'weapon-spec',
            '{0} 부품은 몸 표면이 있어야 세운다 — 무기 후보 굽기처럼 몸이 없는 자리에서는 못 쓴다'.format(kind),
        )
    return surface


def projected(surface, part, point, direction, standoff):
    """`Surface.project`에 실패(빗나감)를 좌표와 함께 말하는 포장. 조용히 띄워 두면 부품이 허공에 남는다."""
    hit = surface.project(point, direction, standoff)
    if hit is None:
        raise common.GateError(
            'weapon-spec',
            '{0} 부품의 점 {1}에서 {2} 방향으로 몸을 못 맞혔다 — 범위를 몸 안으로 줄인다'.format(
                part.get('type'), [round(v, 3) for v in point], list(direction)
            ),
        )
    return hit


def faces_outward(point_at, outward):
    """
    격자 면의 법선(u × v)이 `outward(u, v)`와 같은 쪽인지. 다르면 `build_sheet`에 `flip`을 준다.

    투영한 판은 정점이 몸을 따라가므로 u · v 축을 어느 쪽으로 잡았느냐에 따라 법선이 몸 안을 볼 수 있고,
    그러면 카메라 쪽 면이 뒷면이라 툰 음영이 빛을 등진 것으로 칠한다. 가운데 점 하나로 판단한다.
    """
    u, v, h = 0.5, 0.5, 1e-3
    p = Vector(point_at(u, v))
    pu = Vector(point_at(u + h, v))
    pv = Vector(point_at(u, v + h))
    return (pu - p).cross(pv - p).dot(Vector(outward(u, v))) >= 0


def build_wrap(part, surface):
    """
    평면 격자를 한 방향으로 몸에 투영한 판. 배판처럼 몸 앞 · 뒤에 대는 판이 이것으로 선다.

    `origin`에서 `u_axis`로 `width`, `v_axis`로 `height`만큼 펼친 평면의 정점마다 `direction`으로
    쏴서 표면에서 `standoff`만큼 띄운다. 평면은 몸 밖에서 시작해야 한다(앞 판이면 y가 몸 앞보다 작게).
    """
    surface = require_surface(surface, 'wrap')
    origin = Vector(part.get('origin', (0.0, -0.3, 0.0)))
    u_axis = Vector(part.get('u_axis', (1.0, 0.0, 0.0)))
    v_axis = Vector(part.get('v_axis', (0.0, 0.0, -1.0)))
    width = part.get('width', 0.1)
    height = part.get('height', 0.1)
    direction = tuple(part.get('direction', (0.0, 1.0, 0.0)))
    standoff = part.get('standoff', 0.006)

    def point_at(u, v):
        flat = origin + u_axis * (u * width) + v_axis * (v * height)
        return tuple(projected(surface, part, flat, direction, standoff))

    def outward(_u, _v):
        return (-direction[0], -direction[1], -direction[2])

    flip = not faces_outward(point_at, outward)
    return build_sheet('Wrap', part.get('columns', 12), part.get('rows', 8), point_at, flip)


def build_cap(part, surface):
    """
    구면 조각을 중심으로 투영한 판. 어깨갑옷처럼 관절을 감싸는 판이 이것으로 선다.

    `center` 둘레 반지름 `radius`의 구면에서 고도 `elevation`(위에서 잰 각, 도)과 방위 `azimuth`(`out`
    방향이 0이고 ±가 앞뒤, 도) 범위를 격자로 잡고, 정점마다 중심을 향해 쏴서 표면에서 `standoff`만큼
    띄운다. 중심이 몸 안에 있으면 어느 정점이든 몸을 맞힌다 — 위에서 아래로 쏘는 방식은 어깨 바깥에서
    몸을 빗나간다.
    """
    surface = require_surface(surface, 'cap')
    center = Vector(part.get('center', (0.0, 0.0, 0.0)))
    radius = part.get('radius', 0.1)
    out = Vector(part.get('out', (1.0, 0.0, 0.0))).normalized()
    up = Vector((0.0, 0.0, 1.0))
    side_axis = up.cross(out)
    e0, e1 = [radians(a) for a in part.get('elevation', (0.0, 60.0))]
    a0, a1 = [radians(a) for a in part.get('azimuth', (-70.0, 70.0))]
    standoff = part.get('standoff', 0.008)

    def direction_at(u, v):
        az = a0 + (a1 - a0) * u
        el = e0 + (e1 - e0) * v
        return (out * math.cos(az) + side_axis * math.sin(az)) * math.sin(el) + up * math.cos(el)

    def point_at(u, v):
        direction = direction_at(u, v)
        flat = center + direction * radius
        return tuple(projected(surface, part, flat, -direction, standoff))

    def outward(u, v):
        return tuple(direction_at(u, v))

    flip = not faces_outward(point_at, outward)
    return build_sheet('Cap', part.get('columns', 16), part.get('rows', 8), point_at, flip)


def build_strap(part, surface):
    """
    (x, z) 경로를 따라 몸 앞이나 뒤에 붙는 띠. X자 끈이 이것으로 선다.

    경로의 점 사이를 직선으로 잇고, 폭은 XZ 평면에서 경로에 수직인 방향으로 편 뒤 정점마다 `side`
    방향(앞이면 -Y에서 +Y로, 뒤면 그 반대)으로 쏴서 표면에서 `standoff`만큼 띄운다. 겹치는 끈은
    `standoff`를 조금 더 줘 위에 오게 한다.
    """
    surface = require_surface(surface, 'strap')
    path = [Vector((p[0], 0.0, p[1])) for p in part.get('path', ((0.0, 0.0), (0.0, -0.3)))]
    if len(path) < 2:
        raise common.GateError('weapon-spec', 'strap의 path에는 점이 둘 이상 필요하다')
    width = part.get('width', 0.03)
    standoff = part.get('standoff', 0.006)
    front = part.get('side', 'front') == 'front'
    start_y = -0.5 if front else 0.5
    direction = (0.0, 1.0, 0.0) if front else (0.0, -1.0, 0.0)
    lengths = [(path[i + 1] - path[i]).length for i in range(len(path) - 1)]
    total = sum(lengths)

    def along(u):
        target = u * total
        for i, seg in enumerate(lengths):
            if target <= seg or i == len(lengths) - 1:
                t = min(target / seg, 1.0) if seg > 0 else 0.0
                step = path[i + 1] - path[i]
                return path[i] + step * t, step.normalized()
            target -= seg
        return path[-1], (path[-1] - path[-2]).normalized()

    def point_at(u, v):
        point, tangent = along(u)
        across = Vector((-tangent.z, 0.0, tangent.x))
        flat = point + across * ((v - 0.5) * width)
        flat.y = start_y
        return tuple(projected(surface, part, flat, direction, standoff))

    def outward(_u, _v):
        return (-direction[0], -direction[1], -direction[2])

    flip = not faces_outward(point_at, outward)
    return build_sheet('Strap', part.get('columns', 16), part.get('rows', 2), point_at, flip)


def build_band(part, surface):
    """
    몸통 둘레를 감싸 투영한 띠. 허리 위만 그린 멜빵바지의 몸판(앞 · 옆구리 · 뒤)이 이것으로 선다.

    축 `axis`(부품 좌표의 x · y, 몸통 가운데)에서 반지름 `radius`(몸 밖)의 원기둥 면을 격자로 잡고 —
    u가 방위(`azimuth` 범위, 도, 0이 앞 -Y이고 90이 캐릭터 왼쪽 +X), v가 `z_top`에서 `z_bottom`으로 —
    정점마다 축을 향해 쏴서 표면에서 `standoff`만큼 띄운다. 앞 · 뒤 판을 따로 투영하면 옆구리가 빈다
    (2026-09-17 사용자 지적). 방위가 0~360이면 u=0과 u=1이 같은 점에 와 이음새가 닫힌다.
    """
    surface = require_surface(surface, 'band')
    axis = part.get('axis', (0.0, 0.0))
    radius = part.get('radius', 0.25)
    z_top = part.get('z_top', 0.0)
    z_bottom = part.get('z_bottom', -0.1)
    a0, a1 = [radians(a) for a in part.get('azimuth', (0.0, 360.0))]
    standoff = part.get('standoff', 0.008)

    def direction_at(u):
        a = a0 + (a1 - a0) * u
        return Vector((math.sin(a), -math.cos(a), 0.0))

    def point_at(u, v):
        direction = direction_at(u)
        z = z_top + (z_bottom - z_top) * v
        flat = Vector((axis[0], axis[1], z)) + direction * radius
        return tuple(projected(surface, part, flat, -direction, standoff))

    def outward(u, _v):
        return tuple(direction_at(u))

    flip = not faces_outward(point_at, outward)
    return build_sheet('Band', part.get('columns', 48), part.get('rows', 8), point_at, flip)


def build_horn(part):
    """
    굽은 원뿔. 어깨 위 뿔이 이것으로 선다. 원점이 뿌리 원의 중심이고 위(+Z)로 솟다가 `lean` 쪽으로
    굽는다.

    축은 반지름 `length / bend`의 원호이고 굵기는 뿌리 `radius`에서 끝 `tip`까지 줄어든다. 격자의
    u가 둘레, v가 축 방향이라 u=0과 u=1이 같은 점에 와 이음새가 닫힌다. 법선은 둘레 × 축이라 바깥을
    본다.
    """
    length = part.get('length', 0.1)
    radius = part.get('radius', 0.015)
    tip = part.get('tip', 0.002)
    bend = radians(part.get('bend', 90.0))
    lean = Vector(part.get('lean', (1.0, 0.0, 0.0)))
    lean.z = 0.0
    lean = lean.normalized() if lean.length > 1e-9 else Vector((1.0, 0.0, 0.0))
    up = Vector((0.0, 0.0, 1.0))
    curve_radius = length / bend if bend > 1e-6 else 0.0

    def point_at(u, v):
        a = bend * v
        if curve_radius > 0:
            centre = lean * (curve_radius * (1.0 - math.cos(a))) + up * (curve_radius * math.sin(a))
        else:
            centre = up * (length * v)
        tangent = lean * math.sin(a) + up * math.cos(a)
        normal = lean * math.cos(a) - up * math.sin(a)
        binormal = tangent.cross(normal)
        r = radius + (tip - radius) * v
        phi = 2.0 * math.pi * u
        return tuple(centre + normal * (r * math.cos(phi)) + binormal * (r * math.sin(phi)))

    return build_sheet('Horn', part.get('columns', 12), part.get('rows', 10), point_at, part.get('flip', False))


def build_part(part, surface=None):
    """
    부품 하나를 세운다. 모르는 종류면 이름을 말하며 실패한다.

    @param part `type`과 그 종류의 인자, `location` · `rotation`(도) · `scale` · `color`.
        재질 선택지는 `group`(`MATERIAL_GROUPS`, 기본 `Part`) · `emission`(발광 세기) ·
        `emission_color`(발광 색, 없으면 `color`) · `alpha`(0~1, 1보다 작으면 반투명으로 섞는다).
        `snap`(`from` · `direction` · `standoff`)이
        있으면 `location` 대신 `from`에서 `direction`으로 쏴 몸 표면에서 `standoff`만큼 띄운 자리에 놓는다
    @param surface 몸 표면(`Surface`). `wrap` · `cap` · `strap` · `band`와 `snap`에 필요하고, 없으면 그 부품은 실패한다
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
    elif kind == 'wrap':
        build_wrap(part, surface)
    elif kind == 'cap':
        build_cap(part, surface)
    elif kind == 'strap':
        build_strap(part, surface)
    elif kind == 'band':
        build_band(part, surface)
    elif kind == 'horn':
        build_horn(part)
    else:
        raise common.GateError('weapon-spec', '모르는 부품 종류 {0}'.format(kind))

    group = part.get('group', 'Part')
    if group not in MATERIAL_GROUPS:
        raise common.GateError(
            'weapon-spec', '모르는 재질 묶음 {0} (아는 것 {1})'.format(group, list(MATERIAL_GROUPS))
        )

    obj = bpy.context.active_object
    obj.location = Vector(part.get('location', (0.0, 0.0, 0.0)))
    snap = part.get('snap')
    if snap:
        obj.location = projected(
            require_surface(surface, kind),
            part,
            snap.get('from', (0.0, 0.0, 0.0)),
            snap.get('direction', (0.0, 1.0, 0.0)),
            snap.get('standoff', 0.0),
        )
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
            # 발광 색을 기본색과 따로 받는다. 같은 색으로 세기만 올리면 밝은 면에서 채널이 넘쳐
            # 흰색이 된다 — 2026-09-17 명치 보석(파랑, 세기 4)이 흰 점으로 나왔다. 어두운 기본색에
            # 밝은 발광 색을 얹어야 빛나면서 색이 남는다.
            glow = part.get('emission_color', color)
            principled.inputs['Emission Color'].default_value = (
                glow[0] / 255.0,
                glow[1] / 255.0,
                glow[2] / 255.0,
                1.0,
            )
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
