"""Editable, real-scale CEH espresso assets. Run with Blender, not system Python.

blender -b --factory-startup -t 8 -P coffee-3d/create_coffee_scene.py -- --build
blender -b coffee-3d/ceh_coffee_scene.blend -t 8 -P coffee-3d/create_coffee_scene.py -- --keys
blender -b coffee-3d/ceh_coffee_scene.blend -t 8 -P coffee-3d/create_coffee_scene.py -- --sequence
Use --size 1920 --samples 64 --engine CYCLES for final sequences; --4k for 4K key stills.
No Mantaflow cache or frame-change handler is required: editable shape keys are baked.
"""
import argparse
import json
import math
from pathlib import Path
import random
import sys
import struct
import time

import bpy
import bmesh
from mathutils import Vector
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import coffee_dynamics as dynamics
from coffee_shader import flow_nodes
ROOT = HERE.parent
WEB = HERE / 'models'
NOIR = ROOT / 'assets' / 'coffee' / '3d'
TAU = math.tau
SEG = 128
RINGS = 40
PIVOT = .010
INNER = [(0.0110, 0.0), (.0113, .012), (.0125, .021), (.015, .028),
         (.022, .034), (.032, .039), (.046, .0422), (.061, .0437), (.066, .0443)]
KEYS = [1, 24, 45, 75, 105, 130, 150]


def smooth(a, b, p):
    x = max(0., min(1., (p-a)/(b-a)))
    return x*x*(3-2*x)


def state(p):
    return dynamics.state(p)


def material(name, color, roughness, coat=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = 0
    bs.inputs['IOR'].default_value = 1.46
    bs.inputs['Coat Weight'].default_value = coat
    bs.inputs['Coat Roughness'].default_value = .08
    return m


def porcelain_material(existing=None):
    """Glazed porcelain: a dielectric body underneath a polished glass glaze."""
    m = existing or material('Porcelain_White_Glaze', (.82, .81, .79), .055, 1.0)
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value = .055
    bs.inputs['IOR'].default_value = 1.52
    bs.inputs['Coat Weight'].default_value = 1.0
    bs.inputs['Coat Roughness'].default_value = .025
    bs.inputs['Coat IOR'].default_value = 1.50
    bs.inputs['Metallic'].default_value = 0
    m['finish'] = 'polished porcelain glaze v2'
    return m


def mesh_obj(name, verts, faces, mat=None):
    mesh = bpy.data.meshes.new(name+'_Mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        mesh.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def apply(obj, modifier):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def catmull(points, subdivisions=4):
    result = []
    for i in range(len(points)-1):
        p0, p1, p2, p3 = [Vector(points[max(0, min(len(points)-1, j))]) for j in [i-1, i, i+1, i+2]]
        for k in range(subdivisions):
            t = k/subdivisions
            v = .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
            result.append(tuple(v))
    result.append(points[-1])
    return result


def lathe(name, profile, mat):
    pts = catmull(profile, 4)
    verts = []
    rows = []
    for radius, z in pts:
        if radius < .00001:
            rows.append([len(verts)])
            verts.append((0, 0, z))
        else:
            rows.append(list(range(len(verts), len(verts)+SEG)))
            verts.extend((radius*math.cos(TAU*j/SEG), radius*math.sin(TAU*j/SEG), z) for j in range(SEG))
    faces = []
    for a, b in zip(rows, rows[1:]):
        for j in range(SEG):
            n = (j+1) % SEG
            if len(a) == 1:
                faces.append((a[0], b[n], b[j]))
            elif len(b) == 1:
                faces.append((a[j], a[n], b[0]))
            else:
                faces.append((a[j], a[n], b[n], b[j]))
    return mesh_obj(name, verts, faces, mat)


def create_cup(ceramic):
    # A closed cross-section: underside, foot, outer wall, rolled rim, inner wall, floor.
    profile = [(0, .0015), (.018, .0015), (.023, .0012), (.0245, .0000),
               (.026, .0000), (.0268, .0012), (.0270, .0031), (.030, .0055),
               (.0345, .011), (.0395, .020), (.0435, .031), (.046, .044),
               (.0473, .057), (.0476, .0640), (.0474, .0656), (.0466, .06655),
               (.0455, .06675), (.0445, .06605), (.0441, .0648), (.0437, .061),
               (.0422, .046), (.039, .032), (.034, .022), (.028, .015),
               (.021, .0125), (.012, .0113), (0, .011)]
    body = lathe('CoffeeCup_Body', profile, ceramic)
    # Open oval loop, both capped ends buried ONLY in the outer ceramic wall.
    control = [(.0442, 0, .053), (.054, 0, .056), (.066, 0, .053),
               (.074, 0, .043), (.073, 0, .030), (.064, 0, .019),
               (.051, 0, .015), (.038, 0, .018)]
    path = catmull(control, 14)
    verts, faces = [], []
    sides = 20
    for i, co in enumerate(path):
        pos = Vector(co)
        tangent = Vector(path[min(i+1, len(path)-1)])-Vector(path[max(0, i-1)])
        tangent.normalize()
        cross = Vector((-tangent.z, 0, tangent.x))
        f = i/(len(path)-1)
        # The ends flare into the cup rather than ending in blunt torus intersections.
        radius = .0041+.0015*(math.exp(-f*20)+math.exp(-(1-f)*20))
        for j in range(sides):
            a = TAU*j/sides
            v = pos+cross*math.cos(a)*radius+Vector((0, math.sin(a)*radius*.90, 0))
            verts.append(tuple(v))
    for i in range(len(path)-1):
        for j in range(sides):
            n = (j+1) % sides
            a, b = i*sides, (i+1)*sides
            faces.append((a+j, a+n, b+n, b+j))
    faces.extend([tuple(reversed(range(sides))), tuple((len(path)-1)*sides+j for j in range(sides))])
    handle = mesh_obj('CoffeeCup_Handle', verts, faces, ceramic)
    sources = bpy.data.collections.new('Construction_Editable_Source')
    bpy.context.scene.collection.children.link(sources)
    for obj in [body, handle]:
        copy = obj.copy()
        copy.data = obj.data.copy()
        sources.objects.link(copy)
        copy.name = obj.name+'_Source'
    sources.hide_render = True
    sources.hide_viewport = True
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    handle.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = 'CoffeeCup_Ceramic'
    remesh = body.modifiers.new('Seamless_handle_junction', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = .00031
    remesh.use_smooth_shade = True
    apply(body, remesh)
    relax = body.modifiers.new('Porcelain_surface_relax', 'SMOOTH')
    relax.factor = .80
    relax.iterations = 5
    apply(body, relax)
    decimate = body.modifiers.new('Web_topology', 'DECIMATE')
    decimate.ratio = .050
    apply(body, decimate)
    # Keep smooth normal interpolation; no autosmooth split at the rounded lip.
    for p in body.data.polygons:
        p.use_smooth = True
    rig = bpy.data.objects.new('CoffeeCup_Rig', None)
    bpy.context.collection.objects.link(rig)
    rig.location.z = PIVOT
    body.parent = rig
    body.location.z = -PIVOT
    return body, rig


def noise_grid(x, y, freq, rng):
    grid = rng.random((freq+2, freq+2)).astype(np.float32)
    xx, yy = (x % 1)*freq, (y % 1)*freq
    ix, iy = xx.astype(int), yy.astype(int)
    fx, fy = xx-ix, yy-iy
    fx, fy = fx*fx*(3-2*fx), fy*fy*(3-2*fy)
    return (grid[iy, ix]*(1-fx)+grid[iy, ix+1]*fx)*(1-fy)+(grid[iy+1, ix]*(1-fx)+grid[iy+1, ix+1]*fx)*fy


def image_from_array(name, array):
    h, w = array.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(array.astype(np.float32).ravel())
    img.filepath_raw = str(WEB / (name+'.png'))
    img.file_format = 'PNG'
    img.save()
    return img


def create_textures():
    names = ['espresso-crema.png', 'espresso-surface.png', 'steam-wisp.png']
    if not all((WEB/name).exists() for name in names+['espresso-micro-normal.png']):
        raise RuntimeError('Run python coffee-3d/prepare_coffee_texture.py; keep the supplied steam-wisp.png asset.')
    return tuple(bpy.data.images.load(str(WEB/name), check_existing=True) for name in names)


def mapped_material(name, image, roughness, alpha=False):
    m = material(name, (.1, .03, .008), roughness)
    nodes, links = m.node_tree.nodes, m.node_tree.links
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    texture.extension = 'EXTEND'
    uv = nodes.new('ShaderNodeTexCoord')
    uv.name = 'Coffee_UV'
    mapping = nodes.new('ShaderNodeMapping')
    mapping.name = 'Coffee_FlowMapping'
    if name in ['Espresso_Surface_PBR', 'Espresso_Crema_Microbubbles']:
        flow, mask = flow_nodes(nodes, links, uv.outputs['UV'], alpha)
        links.new(flow, mapping.inputs['Vector'])
    else:
        mask = None
        links.new(uv.outputs['UV'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], texture.inputs['Vector'])
    bs = nodes.get('Principled BSDF')
    links.new(texture.outputs['Color'], bs.inputs['Base Color'])
    if alpha:
        coverage = nodes.new('ShaderNodeMath')
        coverage.name = 'Coffee_CremaCoverage'
        coverage.operation = 'MULTIPLY'
        coverage.inputs[1].default_value = 1
        links.new(texture.outputs['Alpha'], coverage.inputs[0])
        if mask:
            swept = nodes.new('ShaderNodeMath')
            swept.operation = 'MULTIPLY'
            links.new(coverage.outputs[0], swept.inputs[0])
            links.new(mask, swept.inputs[1])
            links.new(swept.outputs[0], bs.inputs['Alpha'])
        else:
            links.new(coverage.outputs[0], bs.inputs['Alpha'])
        m.surface_render_method = 'DITHERED'
    if name.startswith('Espresso_'):
        jet = name == 'Espresso_Stream_PBR'
        normal_image = bpy.data.images.load(str(WEB/('espresso-stream-normal.png' if jet else 'espresso-micro-normal.png')), check_existing=True)
        normal_image.colorspace_settings.name = 'Non-Color'
        normal_texture = nodes.new('ShaderNodeTexImage')
        normal_texture.image = normal_image
        normal_texture.extension = 'EXTEND'
        normal = nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = .55 if alpha else .05 if jet else .08
        links.new(mapping.outputs['Vector'], normal_texture.inputs['Vector'])
        links.new(normal_texture.outputs['Color'], normal.inputs['Color'])
        links.new(normal.outputs['Normal'], bs.inputs['Normal'])
        if alpha or jet:
            rough = nodes.new('ShaderNodeTexImage')
            rough.image = bpy.data.images.load(str(WEB/('espresso-stream-roughness.png' if jet else 'espresso-crema-roughness.png')), check_existing=True)
            rough.image.colorspace_settings.name = 'Non-Color'
            links.new(mapping.outputs['Vector'], rough.inputs['Vector'])
            links.new(rough.outputs['Color'], bs.inputs['Roughness'])
    return m


def radius_at(z):
    if z <= INNER[0][0]:
        return 0.000001
    for (za, ra), (zb, rb) in zip(INNER, INNER[1:]):
        if z <= zb:
            return ra+(rb-ra)*(z-za)/(zb-za)
    return INNER[-1][1]


def boundary(height, tilt, segments=SEG):
    c, s = math.cos(tilt), math.sin(tilt)
    cy = -(height-PIVOT)*math.tan(tilt)
    zc = PIVOT+(height-PIVOT)/c
    radii = []
    for j in range(segments):
        a = TAU*j/segments
        ca, sa = math.cos(a), math.sin(a)
        lo, hi = 0., .049
        for _ in range(22):
            r = (lo+hi)*.5
            zl = zc-r*sa*s
            rr = r*math.sqrt(ca*ca+sa*sa*c*c)
            if rr < radius_at(zl)-.00048:
                lo = r
            else:
                hi = r
        radii.append(lo)
    return cy, radii


def surface_vertices(st, crema=False):
    return dynamics.surface_vertices(st, crema, SEG, RINGS)


def disk_faces():
    faces = [(0, 1+j, 1+(j+1)%SEG) for j in range(SEG)]
    for i in range(RINGS-1):
        a, b = 1+i*SEG, 1+(i+1)*SEG
        for j in range(SEG):
            n = (j+1) % SEG
            faces.append((a+j, b+j, b+n, a+n))
    return faces


def disk_uv(obj):
    uv = obj.data.uv_layers.new(name='CremaUV')
    coords = [(.5, .5)]
    for i in range(1, RINGS+1):
        for j in range(SEG):
            a = TAU*j/SEG
            coords.append((.5+.5*(i/RINGS)**1.35*math.cos(a), .5+.5*(i/RINGS)**1.35*math.sin(a)))
    for poly in obj.data.polygons:
        for li in poly.loop_indices:
            uv.data[li].uv = coords[obj.data.loops[li].vertex_index]


def volume_vertices(st):
    return dynamics.volume_vertices(st, SEG)


def stream_vertices(st):
    return dynamics.stream_vertices(st)


def create_liquid(coffee_img, crema_img):
    coffee_mat = mapped_material('Espresso_Surface_PBR', coffee_img, .12)
    coffee_mat.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value = 0
    coffee_mat.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value = .325
    coffee_mat.node_tree.nodes.get('Principled BSDF').inputs['IOR'].default_value = 1.335
    volume_mat = material('Espresso_Volume_PBR', (.021, .0055, .0013), .12, .25)
    crema_mat = mapped_material('Espresso_Crema_Microbubbles', crema_img, .28, True)
    st = state(1)
    surface = mesh_obj('Coffee_Surface', surface_vertices(st), disk_faces(), coffee_mat)
    crema = mesh_obj('Coffee_Crema', surface_vertices(st, True), disk_faces(), crema_mat)
    disk_uv(surface)
    disk_uv(crema)
    faces = []
    for i in range(10):
        for j in range(SEG):
            n, a, b = (j+1)%SEG, i*SEG, (i+1)*SEG
            faces.append((a+j, a+n, b+n, b+j))
    # The separate animated surface closes the volume. A flat second lid would
    # occlude the impact crater and the negative half of every ripple.
    faces.append(tuple(reversed(range(SEG))))
    volume = mesh_obj('Coffee_Liquid', volume_vertices(st), faces, volume_mat)
    faces = []
    stride = dynamics.STREAM_SIDES+1
    for i in range(dynamics.STREAM_RINGS):
        for j in range(dynamics.STREAM_SIDES):
            n, a, b = j+1, i*stride, (i+1)*stride
            faces.append((a+j, a+n, b+n, b+j))
    faces.extend([tuple(reversed(range(dynamics.STREAM_SIDES))), tuple(dynamics.STREAM_RINGS*stride+j for j in range(dynamics.STREAM_SIDES))])
    stream_mat = mapped_material('Espresso_Stream_PBR', bpy.data.images.load(str(WEB/'espresso-stream.png')), .16)
    bs = stream_mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['IOR'].default_value = 1.335
    bs.inputs['Coat Weight'].default_value = 0
    bs.inputs['Specular IOR Level'].default_value = .35
    bs.inputs['Transmission Weight'].default_value = .96
    stream_mat.use_backface_culling = True
    absorption_volume = stream_mat.node_tree.nodes.new('ShaderNodeVolumeAbsorption')
    absorption_volume.inputs['Color'].default_value = (.0595, .0123, .00243, 1)
    absorption_volume.inputs['Density'].default_value = .95/.0016
    stream_mat.node_tree.links.new(absorption_volume.outputs[0], stream_mat.node_tree.nodes['Material Output'].inputs['Volume'])
    settings_group = bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    settings_group.interface.new_socket(name='Thickness', in_out='INPUT', socket_type='NodeSocketFloat')
    settings_node = stream_mat.node_tree.nodes.new('ShaderNodeGroup')
    settings_node.node_tree = settings_group
    settings_node.inputs['Thickness'].default_value = .0026
    for node in stream_mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE':
            node.extension = 'REPEAT'
    stream = mesh_obj('Coffee_Stream', stream_vertices(state(.45)), faces, stream_mat)
    absorption = stream.data.color_attributes.new(name='JetAbsorption', type='FLOAT_COLOR', domain='POINT')
    for i, value in enumerate(absorption.data):
        t = (i//stride)/dynamics.STREAM_RINGS
        shade = .24+.76*smooth(0, .045, t)
        value.color = (shade, shade, shade, 1)
    nodes, links = stream_mat.node_tree.nodes, stream_mat.node_tree.links
    color = nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'JetAbsorption'
    mix = nodes.new('ShaderNodeMixRGB')
    mix.blend_type = 'MULTIPLY'
    mix.inputs[0].default_value = 1
    texture_color = next(link.from_socket for link in bs.inputs['Base Color'].links)
    links.new(texture_color, mix.inputs[1])
    links.new(color.outputs['Color'], mix.inputs[2])
    links.new(mix.outputs[0], bs.inputs['Base Color'])
    uv = stream.data.uv_layers.new(name='JetUV')
    for loop in stream.data.loops:
        i, j = divmod(loop.vertex_index, stride)
        uv.data[loop.index].uv = (j/dynamics.STREAM_SIDES, (1-i/dynamics.STREAM_RINGS)*6)
    for polygon in stream.data.polygons[-2:]:
        for li in polygon.loop_indices:
            j = stream.data.loops[li].vertex_index % stride
            uv.data[li].uv = (.5+.5*math.cos(TAU*j/dynamics.STREAM_SIDES), .5+.5*math.sin(TAU*j/dynamics.STREAM_SIDES))
    seam = stream.modifiers.new('Continuous jet seam normals', 'WELD')
    seam.merge_threshold = .0000001
    triangles = stream.modifiers.new('Portable cap tangents', 'TRIANGULATE')
    triangles.quad_method = 'FIXED'
    return volume, surface, crema, stream


def create_bubbles(mat):
    random.seed(40)
    bubbles = []
    for i in range(144):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1)
        ob = bpy.context.object
        ob.name = f'Coffee_Bubble_{i:02d}'
        ob.data.materials.append(mat)
        for poly in ob.data.polygons:
            poly.use_smooth = True
        bubbles.append(ob)
    return bubbles


def create_splashes(mat, count=12, prefix='Coffee_SplashDrop_'):
    result = []
    for i in range(count):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1)
        ob = bpy.context.object
        ob.name = f'{prefix}{i:02d}'
        ob.data.materials.append(mat)
        for face in ob.data.polygons:
            face.use_smooth = True
        result.append(ob)
    return result


def create_steam(image):
    mat = mapped_material('Steam_Alpha', image, 1, True)
    mat.node_tree.nodes['Coffee_CremaCoverage'].inputs[1].default_value = .065
    bs = mat.node_tree.nodes.get('Principled BSDF')
    # Emission stays very low; the real texture alpha is the extinction mask.
    bs.inputs['Emission Color'].default_value = (.026, .026, .028, 1)
    bs.inputs['Emission Strength'].default_value = .05
    steam = []
    for i in range(3):
        bpy.ops.mesh.primitive_plane_add(size=1, location=((i-1)*.013, .004, .093))
        ob = bpy.context.object
        ob.name = 'Coffee_Steam_'+str(i)
        ob.rotation_euler = (math.pi/2, 0, (i-1)*.15)
        ob.scale = (.035, .065, 1)
        ob.data.materials.append(mat)
        steam.append(ob)
    return steam


def aim(ob, target):
    ob.rotation_euler = (Vector(target)-ob.location).to_track_quat('-Z', 'Y').to_euler()


def light(name, location, power, color, size, target, size_y=None):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.color, data.shape, data.size = power, color, 'RECTANGLE', size
    data.size_y = size_y or size*1.7
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.location = location
    aim(ob, target)
    return ob


def studio():
    target = (.006, 0, .032)
    light('Light_Key', (-.12, -.12, .20), .75, (1, .96, .91), .10, target, .19)
    light('Light_Fill', (.13, -.05, .11), .21, (.91, .94, 1), .045, target, .14)
    light('Light_BlueRim', (-.11, .035, .075), .13, (.55, .67, 1), .07, target, .13)
    light('Light_WarmAccent', (.025, .07, .15), .25, (1, .80, .57), .055, target, .11)
    light('Light_StripLeft', (-.085, -.085, .020), .20, (.94, .96, 1), .018, target, .12)
    light('Light_StripRight', (.08, -.04, .020), .12, (1, .97, .92), .010, target, .08)
    data = bpy.data.cameras.new('Camera_Main')
    cam = bpy.data.objects.new('Camera_Main', data)
    bpy.context.collection.objects.link(cam)
    cam.location = (.012, -.247, .167)
    data.lens = 63
    aim(cam, (.012, 0, .043))
    bpy.context.scene.camera = cam
    scene = bpy.context.scene
    scene.world.color = (0, 0, 0)
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.028, .032, .042, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .22
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.resolution_percentage = 100
    scene.render.fps = 30
    scene.frame_start, scene.frame_end = 1, 150
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.transparent_max_bounces = 8
    scene.render.resolution_x = scene.render.resolution_y = 1920
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'OPTIX'
        prefs.get_devices()
        for device in prefs.devices:
            device.use = device.type != 'CPU'
        scene.cycles.device = 'GPU'
    except Exception as error:
        print('GPU fallback:', error)
    return cam


def add_shape(ob, name, coords):
    key = ob.shape_key_add(name=name)
    key.data.foreach_set('co', np.array(coords, dtype=np.float32).ravel())
    key.interpolation = 'KEY_LINEAR'
    return key


def bake_animation(rig, liquid, bubbles, steam, splashes, tails):
    volume, surface, crema, stream = liquid
    objects = [(volume, volume_vertices), (surface, surface_vertices),
               (crema, lambda st: surface_vertices(st, True)), (stream, stream_vertices)]
    frames = list(range(1, 151))
    for ob, fn in objects:
        ob.shape_key_add(name='Basis')
        for index, frame in enumerate(frames):
            key = add_shape(ob, f'Frame_{frame:04d}', fn(state((frame-1)/149)))
            if index:
                key.value = 0
                key.keyframe_insert(data_path='value', frame=frames[index-1])
            key.value = 1
            key.keyframe_insert(data_path='value', frame=frame)
            if index+1 < len(frames):
                key.value = 0
                key.keyframe_insert(data_path='value', frame=frames[index+1])
        # Default Bezier would produce negative key weights and geometry overshoot.
        action = ob.data.shape_keys.animation_data.action
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:
                            kp.interpolation = 'LINEAR'
    print('Shape animation baked', flush=True)
    for frame in range(1, 151):
        st = state((frame-1)/149)
        rig.rotation_euler.x = st['tilt']
        rig.keyframe_insert('rotation_euler', frame=frame)
        for ob in [volume, surface, crema]:
            ob.hide_render = st['p'] < .29
            ob.keyframe_insert('hide_render', frame=frame)
        stream.hide_render = not (.235 < st['p'] < .765)
        stream.keyframe_insert('hide_render', frame=frame)
        for name in ['Espresso_Surface_PBR', 'Espresso_Crema_Microbubbles']:
            nodes = bpy.data.materials[name].node_tree.nodes
            mapping = nodes['Coffee_FlowMapping']
            for name, value in [('Phase', st['phase']), ('Agitation', st['agitation']), ('Impact', st['impact']), ('ImpactX', st['ix']), ('ImpactY', st['iy'])]:
                node = nodes.get('Coffee_'+name)
                if node:
                    node.outputs[0].default_value = value
                    node.outputs[0].keyframe_insert('default_value', frame=frame)
            if nodes.get('Coffee_CremaCoverage'):
                node = nodes['Coffee_CremaCoverage']
                node.inputs[1].default_value = st['foam']
                node.inputs[1].keyframe_insert('default_value', frame=frame)
        jet_mapping = bpy.data.materials['Espresso_Stream_PBR'].node_tree.nodes['Coffee_FlowMapping']
        jet_mapping.inputs['Location'].default_value = (0, -st['p']*14, 0)
        jet_mapping.inputs['Location'].keyframe_insert('default_value', frame=frame)
        section = dynamics.boundary(st['level'], st['tilt'], SEG)
        for i, ob in enumerate(bubbles):
            location, size = dynamics.bubble(st, i, section)
            ob.location = location
            ob.scale = (size, size, size*.35)
            ob.keyframe_insert('location', frame=frame)
            ob.keyframe_insert('scale', frame=frame)
            ob.hide_render = st['foam'] <= .01
            ob.keyframe_insert('hide_render', frame=frame)
        for i, ob in enumerate(splashes):
            location, radius = dynamics.splash(st, i)
            ob.location = location
            ob.scale = (radius, radius, radius*1.35)
            ob.hide_render = st['impact'] < .05
            for key in ['location', 'scale', 'hide_render']:
                ob.keyframe_insert(key, frame=frame)
        for i, ob in enumerate(tails):
            location, radius, stretch = dynamics.tail_drop(st, i)
            ob.location = location
            ob.scale = (radius, radius, radius*stretch)
            ob.hide_render = not (.72 < st['p'] < .82) or radius == 0
            for key in ['location', 'scale', 'hide_render']:
                ob.keyframe_insert(key, frame=frame)
        for i, ob in enumerate(steam):
            ob.hide_render = st['p'] < .82
            ob.keyframe_insert('hide_render', frame=frame)
            ob.location.x = (i-1)*.013+.002*math.sin(st['p']*18+i)
            ob.keyframe_insert('location', frame=frame)
        for ob in bpy.data.objects:
            if ob.type == 'LIGHT':
                power = {'Light_Key': .75, 'Light_Fill': .21, 'Light_BlueRim': .13, 'Light_WarmAccent': .25,
                         'Light_StripLeft': .20, 'Light_StripRight': .12}[ob.name]
                ob.data.energy = power*st['reveal']
                ob.data.keyframe_insert('energy', frame=frame)
    bpy.context.scene.frame_set(150)


def mesh_report(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    report = dict(vertices=len(bm.verts), triangles=sum(len(f.verts)-2 for f in bm.faces),
                  boundary_edges=sum(e.is_boundary for e in bm.edges),
                  nonmanifold_edges=sum(not e.is_manifold for e in bm.edges),
                  volume_m3=bm.calc_volume(signed=True))
    bm.free()
    if report['nonmanifold_edges'] or report['volume_m3'] <= 0:
        raise RuntimeError('Invalid cup topology: '+str(report))
    return report


def export_glb(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    # Freeze the evaluated pose, including shape keys. GLB files are explicitly static.
    # A plain export_morph=False can otherwise silently export the undeformed Basis.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    temporary = []
    temp_materials = []
    st = state((bpy.context.scene.frame_current-1)/149)
    for ob in objects:
        if ob.type != 'MESH':
            continue
        mesh = bpy.data.meshes.new_from_object(ob.evaluated_get(depsgraph))
        snapshot = bpy.data.objects.new(ob.name+'_Export', mesh)
        snapshot['source_name'] = ob.name
        bpy.context.collection.objects.link(snapshot)
        snapshot.matrix_world = ob.matrix_world
        if ob.name in ['Coffee_Surface', 'Coffee_Crema']:
            uv = mesh.uv_layers.active
            for loop in mesh.loops:
                index = loop.vertex_index
                t = 0 if index == 0 else (((index-1)//SEG+1)/RINGS)**1.35
                a = 0 if index == 0 else TAU*((index-1) % SEG)/SEG
                uv.data[loop.index].uv = dynamics.flow_uv(st, t, a)
            if ob.name == 'Coffee_Crema':
                colors = mesh.color_attributes.new(name='FoamCoverage', type='FLOAT_COLOR', domain='CORNER')
                for loop in mesh.loops:
                    x, y, _ = mesh.vertices[loop.vertex_index].co
                    colors.data[loop.index].color = (1, 1, 1, dynamics.foam_coverage(st, x, y))
            mat = mesh.materials[0].copy()
            mat.animation_data_clear()
            mat.node_tree.animation_data_clear()
            temp_materials.append(mat)
            mesh.materials[0] = mat
            nodes, links = mat.node_tree.nodes, mat.node_tree.links
            mapping = nodes['Coffee_FlowMapping']
            links.new(nodes['Coffee_UV'].outputs['UV'], mapping.inputs['Vector'])
            if ob.name == 'Coffee_Crema':
                coverage = nodes['Coffee_CremaCoverage']
                coverage.inputs[1].default_value = st['foam']
                color = nodes.new('ShaderNodeVertexColor')
                color.layer_name = 'FoamCoverage'
                # Explicit material use makes the exporter retain COLOR_0 alpha.
                mix = nodes.new('ShaderNodeMixRGB')
                mix.blend_type = 'MULTIPLY'
                mix.inputs[0].default_value = 1
                texture_color = next(link.from_socket for link in nodes['Principled BSDF'].inputs['Base Color'].links)
                links.new(texture_color, mix.inputs[1])
                links.new(color.outputs['Color'], mix.inputs[2])
                links.new(mix.outputs[0], nodes['Principled BSDF'].inputs['Base Color'])
                links.new(coverage.outputs[0], nodes['Principled BSDF'].inputs['Alpha'])
        snapshot.select_set(True)
        temporary.append(snapshot)
    bpy.context.view_layer.objects.active = temporary[0]
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_animations=False, export_morph=False, export_apply=False,
                              export_cameras=False, export_lights=False, export_yup=True,
                              export_extras=True, export_tangents=True)
    for ob in temporary:
        mesh = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.meshes.remove(mesh)
    for mat in temp_materials:
        bpy.data.materials.remove(mat)
    # Blender 5.2 exports vertex-colour RGB and alpha as two sets, and can
    # omit alphaMode when the node multiplier evaluates to one. Consolidate the
    # known RGBA attribute and explicitly preserve this translucent foam film.
    payload = path.read_bytes()
    json_size = struct.unpack_from('<I', payload, 12)[0]
    gltf = json.loads(payload[20:20+json_size])
    for mat in gltf.get('materials', []):
        if mat['name'].startswith('Espresso_Crema_'):
            mat['alphaMode'] = 'BLEND'
            mat['pbrMetallicRoughness']['baseColorFactor'] = [1, 1, 1, st['foam']]
        if mat['name'] == 'Espresso_Stream_PBR':
            mat.setdefault('extensions', {})['KHR_materials_volume'] = dict(thicknessFactor=.0026, attenuationColor=[.0595, .0123, .00243], attenuationDistance=.0016/.95)
            if 'KHR_materials_volume' not in gltf.setdefault('extensionsUsed', []):
                gltf['extensionsUsed'].append('KHR_materials_volume')
    for mesh in gltf['meshes']:
        if mesh['name'].startswith(('Coffee_Crema', 'Coffee_Stream')):
            for primitive in mesh['primitives']:
                attributes = primitive['attributes']
                if 'COLOR_1' in attributes:
                    attributes['COLOR_0'] = attributes.pop('COLOR_1')
    encoded = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    encoded += b' '*((-len(encoded)) % 4)
    tail = payload[20+json_size:]
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, 20+len(encoded)+len(tail))+struct.pack('<II', len(encoded), 0x4e4f534a)+encoded+tail)
    print('EXPORTED', path.name, path.stat().st_size, flush=True)


def prepare_ui():
    scene = bpy.context.scene
    animated = [ob for ob in bpy.data.objects if ob.name.startswith(('Coffee_',))]
    for frame in range(1, 151):
        scene.frame_set(frame)
        for ob in animated:
            ob.hide_viewport = ob.hide_render
            ob.keyframe_insert('hide_viewport', frame=frame)
    scene.frame_set(150)
    bpy.ops.object.select_all(action='DESELECT')
    cup = bpy.data.objects['CoffeeCup_Ceramic']
    cup.select_set(True)
    bpy.context.view_layer.objects.active = cup
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.clip_start = .001
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.shading.type = 'MATERIAL'
                area.spaces.active.shading.use_scene_lights = True
                area.spaces.active.shading.use_scene_world = True
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'ceh_coffee_scene.blend'), compress=True)


def build():
    print('BLENDER', bpy.app.version_string, flush=True)
    for folder in [WEB, NOIR, HERE/'renders'/'keys', HERE/'renders'/'master']:
        folder.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    ceramic = porcelain_material()
    body, rig = create_cup(ceramic)
    report = mesh_report(body)
    print('CUP_GEOMETRY', json.dumps(report), flush=True)
    crema_image, coffee_image, steam_image = create_textures()
    liquid = create_liquid(coffee_image, crema_image)
    bubbles = create_bubbles(material('Espresso_Bubble_Gloss', (.148, .036, .006), .13, .06))
    steam = create_steam(steam_image)
    droplet = material('Espresso_Droplet_PBR', (.034, .008, .0018), .12, .03)
    droplet.node_tree.nodes['Principled BSDF'].inputs['IOR'].default_value = 1.335
    droplet.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = .10
    splashes = create_splashes(droplet)
    tails = create_splashes(droplet, 5, 'Coffee_TailDrop_')
    studio()
    bake_animation(rig, liquid, bubbles, steam, splashes, tails)
    scene = bpy.context.scene
    scene.frame_set(150)
    export_glb(WEB/'cup.glb', [rig, body])
    export_glb(WEB/'coffee-liquid.glb', [*liquid[:3], *bubbles])
    scene.frame_set(75)
    export_glb(WEB/'coffee-stream.glb', [liquid[3]])
    export_glb(WEB/'ceh-coffee-pouring.glb', [rig, body, *liquid, *bubbles, *splashes])
    scene.frame_set(150)
    # Stream is deliberately omitted from the static final model; load its separate GLB.
    export_glb(WEB/'ceh-coffee.glb', [rig, body, *liquid[:3], *bubbles])
    manifest = dict(blender=bpy.app.version_string, units='metres', gltfUp='+Y',
                    cup=dict(height=.06675, diameter=.0952, pivot=PIVOT, geometry=report),
                    animation=dict(kind='procedural baked shape keys in blend; browser procedural meshes',
                                   fps=30, frames=150, fluidSimulation=False, glbAnimation=False),
                    liquid=dict(segments=SEG, radialRings=RINGS, innerProfile=INNER, bottom=.0125, top=.059),
                    porcelain=dict(revision=2, roughness=.055, clearcoat=1, clearcoatRoughness=.025, ior=1.52),
                    coffee=dict(revision=4, photographicCrema=True, cellularMicrofoam=True, microcells=16540, advectedFoam=True, lateFoam=True, gravityTaperedJet=True, capillaryJetWaves=True, darkTranslucentJet=True, streamTransmission=.96, streamThickness=.0026, streamAttenuationDistance=.0016/.95, streamBrightnessGain=1.05, asymmetricImpactCrown=True, ballisticTailDrops=True, volumeDriven=True, bakedFrames=150, impactCrater=True),
                    files=['cup.glb', 'coffee-liquid.glb', 'coffee-stream.glb', 'ceh-coffee.glb', 'ceh-coffee-pouring.glb'],
                    reference='User-supplied white ceramic cup images, 2026-10-29. Model is a reconstruction, not a scan.')
    (WEB/'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    import shutil
    for path in WEB.iterdir():
        if path.is_file():
            shutil.copy2(path, NOIR/path.name)
    for image in bpy.data.images:
        if image.source != 'GENERATED' or image.has_data:
            try:
                image.pack()
            except RuntimeError:
                pass
    scene['README'] = 'Real scale metres; +Z up in Blender / +Y in GLB. Editable construction in hidden collection. Procedural fluid, not Mantaflow. All animation baked. GLBs static; browser driver is required for pouring.'
    scene.frame_set(150)
    prepare_ui()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'ceh_coffee_scene.blend'), compress=True)
    (HERE/'geometry-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('BUILD_COMPLETE', flush=True)


def refresh_porcelain():
    """Update the existing editable scene and only the three GLBs with ceramics."""
    import shutil
    porcelain_material(bpy.data.materials['Porcelain_White_Glaze'])
    scene = bpy.context.scene
    rig, body = bpy.data.objects['CoffeeCup_Rig'], bpy.data.objects['CoffeeCup_Ceramic']
    liquid = [bpy.data.objects[name] for name in ['Coffee_Liquid', 'Coffee_Surface', 'Coffee_Crema', 'Coffee_Stream']]
    bubbles = [ob for ob in bpy.data.objects if ob.name.startswith('Coffee_Bubble_')]
    splashes = [ob for ob in bpy.data.objects if ob.name.startswith('Coffee_SplashDrop_')]
    scene.frame_set(150)
    export_glb(WEB/'cup.glb', [rig, body])
    export_glb(WEB/'ceh-coffee.glb', [rig, body, *liquid[:3], *bubbles])
    scene.frame_set(75)
    export_glb(WEB/'ceh-coffee-pouring.glb', [rig, body, *liquid, *bubbles, *splashes])
    for name in ['cup.glb', 'ceh-coffee.glb', 'ceh-coffee-pouring.glb']:
        shutil.copy2(WEB/name, NOIR/name)
    manifest = json.loads((WEB/'manifest.json').read_text(encoding='utf-8'))
    manifest['porcelain'] = dict(revision=2, roughness=.055, clearcoat=1, clearcoatRoughness=.025, ior=1.52)
    for folder in [WEB, NOIR]:
        (folder/'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    scene.frame_set(150)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'ceh_coffee_scene.blend'), compress=True)
    print('PORCELAIN_UPDATED', flush=True)


def render(args):
    scene = bpy.context.scene
    scene.render.engine = args.engine
    scene.render.use_persistent_data = True
    if args.engine == 'CYCLES':
        scene.cycles.samples = args.samples
        try:
            prefs = bpy.context.preferences.addons['cycles'].preferences
            prefs.compute_device_type = 'OPTIX'
            prefs.get_devices()
            for device in prefs.devices:
                device.use = device.type != 'CPU'
            scene.cycles.device = 'GPU'
        except Exception as error:
            print('GPU fallback:', error)
    scene.render.resolution_x = scene.render.resolution_y = 3840 if args.four_k else args.size
    frames = [int(v) for v in args.frames.split(',')] if args.frames else KEYS if args.keys else range(1, 151)
    if any(frame < 1 or frame > 150 for frame in frames):
        raise ValueError('Frame range is 1 through 150')
    folder = HERE/'renders'/('keys-4k' if args.four_k else 'keys' if args.keys else 'master')
    folder.mkdir(parents=True, exist_ok=True)
    started = time.time()
    for frame in frames:
        target = folder/f'frame_{frame:04d}.png'
        if target.exists() and not args.overwrite:
            continue
        scene.frame_set(frame)
        scene.render.filepath = str(target)
        bpy.ops.render.render(write_still=True)
        print('RENDERED', frame, 'elapsed', round(time.time()-started, 1), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--build', action='store_true')
    parser.add_argument('--keys', action='store_true')
    parser.add_argument('--sequence', action='store_true')
    parser.add_argument('--refresh-ui', action='store_true')
    parser.add_argument('--porcelain', action='store_true')
    parser.add_argument('--4k', dest='four_k', action='store_true')
    parser.add_argument('--size', type=int, default=1024)
    parser.add_argument('--frames', default='')
    parser.add_argument('--samples', type=int, default=48)
    parser.add_argument('--engine', default='CYCLES', choices=['CYCLES', 'BLENDER_EEVEE_NEXT'])
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.build:
        build()
    if args.refresh_ui:
        prepare_ui()
    if args.porcelain:
        refresh_porcelain()
    if args.keys or args.sequence:
        render(args)
