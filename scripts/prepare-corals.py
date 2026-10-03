"""Normalize Smithsonian CC0 specimen scans; remove Draco for offline WebKit.
Run with Blender --background --python scripts/prepare-corals.py.
"""
import bpy, pathlib, bmesh
from mathutils import Vector
root = pathlib.Path(__file__).resolve().parents[1]
base = root / 'assets/models/corals'
bpy.ops.wm.read_factory_settings(use_empty=True)
colonies = []
for index, name in enumerate(['table', 'lobed', 'bush', 'lettuce', 'plate', 'brain']):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=str(base / 'source' / (name + '.glb')))
    objects = list(bpy.context.selected_objects)
    meshes = [o for o in objects if o.type == 'MESH']
    points = [o.matrix_world @ Vector(p) for o in meshes for p in o.bound_box]
    low = Vector(tuple(min(p[a] for p in points) for a in range(3)))
    high = Vector(tuple(max(p[a] for p in points) for a in range(3)))
    size = high - low
    print(name, 'source bounds', low[:], high[:], 'dimensions', size[:])
    # A broad colony has unit horizontal diameter and sits on the seabed.
    scale = 1 / max(size.x, size.y)
    offset = Vector((-(low.x + high.x)/2, -(low.y + high.y)/2, -low.z))
    for o in meshes:
        world = o.matrix_world.copy()
        for v in o.data.vertices: v.co = (world @ v.co + offset) * scale
        o.parent = None
        o.matrix_world.identity()
        # Trim the display plinth from the two mounted museum specimens.
        cutoff = {'table': .24, 'lobed': .24, 'plate': .24}.get(name, 0) * size.z * scale
        if cutoff:
            bm=bmesh.new();bm.from_mesh(o.data)
            bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=0.00001,plane_co=(0,0,cutoff),plane_no=(0,0,1),clear_inner=True)
            bm.to_mesh(o.data);bm.free()
            for v in o.data.vertices: v.co.z -= cutoff
        o.name = 'Smithsonian scan — ' + name
        # Silhouette/atlas-preserving runtime reduction: pores remain in the
        # original 2K photogrammetry atlas, not 100k triangles per instance.
        bpy.context.view_layer.objects.active=o
        reduction=o.modifiers.new('Runtime triangle budget','DECIMATE')
        reduction.ratio={'table': .60, 'lobed': .35, 'bush': .65, 'lettuce': .40, 'plate': .40, 'brain': .50}[name]
        reduction.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=reduction.name)
        for p in o.data.polygons: p.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(base / (name + '.glb')), export_format='GLB', use_selection=True, export_draco_mesh_compression_enable=False)
    for o in objects:
        if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
    for o in meshes:
        o.location.x = (index % 3 - 1) * 1.4
        o.location.z = -(index // 3) * 1.6
    colonies.extend(meshes)
scene = bpy.context.scene
world = bpy.data.worlds.new('Studio'); world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.09,.12,.15,1); scene.world=world
data=bpy.data.lights.new('Key','AREA');data.energy=350;data.size=5
light=bpy.data.objects.new('Key',data);scene.collection.objects.link(light);light.location=(-2,-3,5)
data=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',data);scene.collection.objects.link(cam);cam.location=(0,-6,2.1);cam.rotation_euler=(Vector((0,0,-.1))-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=4.6;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1150;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(root/'build/coral-scans.png')
bpy.ops.render.render(write_still=True)
