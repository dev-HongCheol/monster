"""
G1 — 판끼리 몸이 같은지 보려고 메시 구성을 덤프한다.

판정은 하지 않는다. 여기서 하는 일은 `.vrm` 하나를 열어 **메시마다 정점 수와 좌표 지문을
적어 내보내는 것**까지다. 비교는 실행기(`versions.ts`)가 한다 — `tools/**/*.ts`는 타입체크·
lint·vitest 셋을 지나가지만 `.py`는 어느 그물에도 안 걸리므로, 판정을 파이썬에 두면 그 판정만
검사망 밖에 남는다(`README.md` 「판정은 파이썬에 없다」).

**좌표를 통째로 쓰지 않고 지문으로 줄이는 이유.** 몸 메시 하나가 정점 만 개를 넘으므로 JSON에
좌표를 다 담으면 판마다 수 MB가 되고, 그걸 비교해도 결론은 「같다/다르다」 하나다. 그래서
좌표를 소수점 다섯 자리로 반올림해 sha256으로 접는다. 반올림하는 것은 내보내기마다 부동소수점
끝자리가 흔들려도 같은 몸이면 같은 지문이 나오게 하려는 것이다.

돌리는 법과 실패 코드 표는 `tools/blender/README.md`에 있다.
"""

import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import _common as common  # noqa: E402 - 위 경로 주입 뒤에 와야 한다

# 좌표를 접기 전에 반올림할 자리. VRM 단위가 미터이므로 다섯 자리는 0.01mm이고, 같은 모델을
# 두 번 내보냈을 때 흔들리는 끝자리보다 크고 실제 형상 차이보다는 훨씬 작다.
COORD_PRECISION = 5


def mesh_digest(mesh_object):
    """메시의 정점 좌표를 순서대로 반올림해 sha256으로 접는다."""
    digest = hashlib.sha256()
    for vertex in mesh_object.data.vertices:
        for axis in vertex.co:
            digest.update(f'{round(axis, COORD_PRECISION):.5f}|'.encode('ascii'))
    return digest.hexdigest()


def mesh_bounds(mesh_object):
    """메시의 로컬 경계 상자를 (최소, 최대) 두 삼조로 돌려준다."""
    coords = [v.co for v in mesh_object.data.vertices]
    if not coords:
        return None
    lows = [min(c[i] for c in coords) for i in range(3)]
    highs = [max(c[i] for c in coords) for i in range(3)]
    return {
        'min': [round(v, 4) for v in lows],
        'max': [round(v, 4) for v in highs],
    }


def material_groups(mesh_object):
    """
    머티리얼마다 그 면이 쓰는 정점 좌표를 모은다.

    **VRoid는 옷을 별도 오브젝트로 내보내지 않는다.** 몸 · 하의 · 신발 · 상의가 `Body` 메시
    하나에 머티리얼로만 갈려 들어오므로, 층을 가르려면 오브젝트가 아니라 머티리얼을 봐야 한다.
    좌표를 정렬해 담는 것은 판끼리 정점 번호가 어긋나기 때문이다 — 옷에 가려진 맨살을 VRoid가
    지우면서 남은 정점의 번호가 밀리므로, 번호로 맞대면 같은 자리의 점도 다르게 나온다.
    """
    groups = {}
    for polygon in mesh_object.data.polygons:
        slot = mesh_object.material_slots[polygon.material_index] if mesh_object.material_slots else None
        name = slot.material.name if slot and slot.material else '(없음)'
        bucket = groups.setdefault(name, set())
        for index in polygon.vertices:
            co = mesh_object.data.vertices[index].co
            bucket.add(tuple(round(axis, COORD_PRECISION) for axis in co))
    return {
        name: sorted(f'{x:.5f},{y:.5f},{z:.5f}' for x, y, z in coords)
        for name, coords in groups.items()
    }


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

    armature = common.import_vrm(vrm_path)

    meshes = []
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or not obj.data.vertices:
            continue
        meshes.append(
            {
                'name': obj.name,
                'vertices': len(obj.data.vertices),
                'polygons': len(obj.data.polygons),
                'materials': sorted({s.material.name for s in obj.material_slots if s.material}),
                'bounds': mesh_bounds(obj),
                'digest': mesh_digest(obj),
                'byMaterial': material_groups(obj),
            }
        )
    meshes.sort(key=lambda m: m['name'])

    payload = {
        'vrm': os.path.abspath(vrm_path).replace(os.sep, '/'),
        'armature': armature.name,
        'bones': [b.name for b in armature.data.bones],
        'meshes': meshes,
    }
    with open(absolute_out, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    common.gate_ok(
        {
            'gate': 'g1-meshes',
            'blender': bpy.app.version_string,
            'armature': armature.name,
            'bone_count': len(payload['bones']),
            'mesh_count': len(meshes),
            'mesh_names': [m['name'] for m in meshes],
            'output': absolute_out.replace(os.sep, '/'),
        }
    )


if __name__ == '__main__':
    common.run(main)
