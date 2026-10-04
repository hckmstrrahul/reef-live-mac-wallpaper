"""Create an editable Cycles art-direction scene from the actual runtime geometry.
Run from the repository root with Blender --background --python this-file.
The runtime GLSL swimming/current simulation is not a Blender animation bake.
"""
import bpy, math, pathlib
from mathutils import Vector
root=pathlib.Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'assets/blender/reef.glb'))
scene=bpy.context.scene
# glTF import maps renderer Y-up to Blender Z-up: (x,y,z) -> (x,-z,y).
for obj in list(scene.objects):
 if obj.type=='LIGHT':
  bpy.data.objects.remove(obj,do_unlink=True)
  continue
 if obj.type=='MESH':
  for poly in obj.data.polygons: poly.use_smooth=True

def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name,location,energy,color,size,target):
 data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.color=color;data.shape='DISK';data.size=size
 obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=location;aim(obj,target)
area('Soft turquoise water fill',(1,-6,7),1050,(.92,.96,1.),9,(0,1,3))
sun_data=bpy.data.lights.new('Upper-left sunlight','SPOT');sun_data.energy=4250;sun_data.color=(.91,.96,1.);sun_data.spot_size=.68;sun_data.spot_blend=.78;sun_data.shadow_soft_size=.35
sun=bpy.data.objects.new('Upper-left sunlight',sun_data);scene.collection.objects.link(sun);sun.location=(-6.5,-1.0,12.5);aim(sun,(.8,2.,.5))
view_distance=17.3 / 1.1
camdata=bpy.data.cameras.new('Reference composition');cam=bpy.data.objects.new('Reference composition',camdata);scene.collection.objects.link(cam);cam.location=(0,.8-math.cos(.0414)*view_distance,3.35+math.sin(.0414)*view_distance);aim(cam,(0,.8,3.35));camdata.lens=28.5;camdata.sensor_width=36;camdata.dof.use_dof=True;camdata.dof.focus_distance=view_distance;camdata.dof.aperture_fstop=8;scene.camera=cam
world=bpy.data.worlds.new('Deep teal water');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.045,.18,.23,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.28;scene.world=world
env=world.node_tree.nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(root/'assets/lighting/studio_small_08_1k.hdr'));env.image.pack();world.node_tree.links.new(env.outputs['Color'],world.node_tree.nodes['Background'].inputs['Color'])
# Cycles homogeneous participating water medium for offline look development.
bpy.ops.mesh.primitive_cube_add(size=2,location=(0,1,5));volume=bpy.context.object;volume.name='Water volume — offline Cycles scattering';volume.scale=(25,26,10)
mat=bpy.data.materials.new('Water absorption and suspended scattering');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');vol=nodes.new('ShaderNodeVolumePrincipled');vol.inputs['Color'].default_value=(.12,.38,.55,1);vol.inputs['Density'].default_value=.003;vol.inputs['Anisotropy'].default_value=.4;mat.node_tree.links.new(vol.outputs['Volume'],out.inputs['Volume']);volume.data.materials.append(mat);volume.display_type='WIRE'
# Recreate the app's shader-only turquoise background, omitted by GLB export.
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,18,7),rotation=(math.pi/2,0,0))
backdrop=bpy.context.object;backdrop.name='Turquoise depth gradient';backdrop.scale=(32.5,17.5,1)
back_mat=bpy.data.materials.new('Luminous distant water');back_mat.use_nodes=True
nodes=back_mat.node_tree.nodes;nodes.clear();links=back_mat.node_tree.links
out=nodes.new('ShaderNodeOutputMaterial');emission=nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=1
position=nodes.new('ShaderNodeNewGeometry');split=nodes.new('ShaderNodeSeparateXYZ');height=nodes.new('ShaderNodeMapRange');height.inputs['From Min'].default_value=-1;height.inputs['From Max'].default_value=11
ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.008,.045,.10,1);ramp.color_ramp.elements[1].color=(.08,.29,.42,1)
links.new(position.outputs['Position'],split.inputs[0]);links.new(split.outputs['Z'],height.inputs['Value']);links.new(height.outputs['Result'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],emission.inputs['Color']);links.new(emission.outputs[0],out.inputs['Surface']);backdrop.data.materials.append(back_mat)
# A true glass boundary for the separate offline render; the live app uses a
# low-resolution mirrored scene capture with animated GPU heightfield normals.
bpy.ops.mesh.primitive_grid_add(x_subdivisions=150,y_subdivisions=150,size=64,location=(0,8,8.4))
surface=bpy.context.object;surface.name='Rippling water-air boundary — offline'
water_mat=bpy.data.materials.new('Clear water surface');water_mat.use_nodes=True
bsdf=water_mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.75,.94,.97,1);bsdf.inputs['Roughness'].default_value=.06;bsdf.inputs['IOR'].default_value=1.333;bsdf.inputs['Transmission Weight'].default_value=1
surface.data.materials.append(water_mat)
noise=bpy.data.textures.new('Small water ripples',type='CLOUDS');noise.noise_scale=.46;noise.noise_depth=2
ripple=surface.modifiers.new('Fine surface displacement','DISPLACE');ripple.texture=noise;ripple.strength=.035
scene.render.engine='CYCLES' ;scene.cycles.samples=48;scene.cycles.use_denoising=True
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
 for d in prefs.devices:d.use=True
 scene.cycles.device='GPU'
except Exception:pass
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
try:scene.view_settings.view_transform='AgX'
except Exception:scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(root/'assets/blender/reef-cycles.png')
# Art references stay private and are not packed into redistributable exports.
note=bpy.data.texts.new('README: Reef');note.write('Editable snapshot of the real-time Reef aquarium.\nGLSL swimming, GPU waves and live interaction run in the app, not as Blender animation tracks.\nThe Cycles setup is separate offline look development.\nThird-party textures are packed; see docs/THIRD_PARTY.md for their sources and licenses.\n')
bpy.ops.file.pack_all()
for screen in bpy.data.screens:
 for area_ui in screen.areas:
  if area_ui.type=='VIEW_3D':area_ui.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/blender/Reef.blend'))
if '--render-preview' in __import__('sys').argv:bpy.ops.render.render(write_still=True)
print('Saved editable Reef.blend with packed textures and camera.')
