"""Independent checks against the actual evaluated, fused ceramic mesh."""
import json
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root = Path(__file__).resolve().parent
cup = bpy.data.objects['CoffeeCup_Ceramic']
surface = bpy.data.objects['Coffee_Surface']
scene = bpy.context.scene
result = []
error_frames = []
all_frames = '--all' in sys.argv
requested = next((arg.split('=', 1)[1] for arg in sys.argv if arg.startswith('--frames=')), None)
for frame in ([int(v) for v in requested.split(',')] if requested else range(1, 151) if all_frames else [1, 24, 45, 75, 105, 130, 150]):
    scene.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    evaluated = cup.evaluated_get(dg)
    mesh = evaluated.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.transform(cup.matrix_world)
    if any(not edge.is_manifold for edge in bm.edges):
        raise RuntimeError(f'Cup is not watertight at frame {frame}')
    volume = bm.calc_volume(signed=True)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    evaluated.to_mesh_clear()
    intersections, minimum = 0, 100
    if frame >= 45:
        liquid = surface.evaluated_get(dg)
        lm = liquid.to_mesh()
        for vertex in lm.vertices:
            point = surface.matrix_world @ vertex.co
            nearest, normal, _, distance = tree.find_nearest(point)
            side = (point-nearest).dot(normal)
            minimum = min(minimum, distance)
            if side < -.000025:
                intersections += 1
                if intersections <= 3:
                    print('PENETRATION', frame, vertex.index, tuple(point), tuple(nearest), side, flush=True)
        liquid.to_mesh_clear()
    details = {}
    for name in ['Coffee_Crema', 'Coffee_Stream']:
        ob = bpy.data.objects[name]
        count = 0
        if not ob.hide_render:
            evaluated = ob.evaluated_get(dg)
            mesh = evaluated.to_mesh()
            for vertex in mesh.vertices:
                point = ob.matrix_world @ vertex.co
                nearest, normal, _, distance = tree.find_nearest(point)
                side = (point-nearest).dot(normal)
                if side < -.000025:
                    count += 1
                    if count <= 2:
                        print('PENETRATION', name, frame, vertex.index, tuple(point), side, flush=True)
            evaluated.to_mesh_clear()
        details[name+'VerticesInsideCeramic'] = count
        if count:
            error_frames.append(frame)
    row = dict(frame=frame, cupVolumeM3=volume, liquidVerticesInsideCeramic=intersections, **details,
               minimumClearanceMM=minimum*1000 if minimum < 100 else None)
    result.append(row)
    print(row, flush=True)
    if intersections:
        error_frames.append(frame)
if max(r['cupVolumeM3'] for r in result)-min(r['cupVolumeM3'] for r in result) > 1e-10:
    raise RuntimeError('Cup volume changed during animation')
(root/('scene-verification-all.json' if all_frames else 'scene-verification.json')).write_text(json.dumps(result, indent=2), encoding='utf-8')
if error_frames:
    raise RuntimeError(f'Liquid penetrates ceramic in frames {error_frames}')
print('SCENE_VERIFIED')
