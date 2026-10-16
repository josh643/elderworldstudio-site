import bpy, bmesh, json, math
from mathutils import Vector
L=json.load(open('/workspace/anims-lib/props/layout.json'))
bpy.ops.wm.read_factory_settings(use_empty=True)
u=0.019; W,H=L['W'],L['H']; pad=0.011
TW,TH=L['tex']; sx=L['sx']; M=L['M']
def kuv(xu,yu): return ((M+xu*sx)/TW, 1-(M+yu*sx)/TH)
mat=bpy.data.materials.new('KB'); mat.use_nodes=True; bsdf=mat.node_tree.nodes['Principled BSDF']
tex=mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=bpy.data.images.load('/workspace/anims-lib/props/kb_legend.png')
mat.node_tree.links.new(tex.outputs[0],bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value=0.55
bm=bmesh.new(); uvl=bm.loops.layers.uv.new()
cw,cd=W*u+2*pad,H*u+2*pad
def box(x0,y0,x1,y1,z0,z1,top_inset=0.0,uvf=None,bev=0):
    # y here = rows going toward the user (+), mapped to -Y fwd later; build in kb local: x right, y toward user
    vs=[]
    for z,ins in((z0,0),(z1,top_inset)):
        for (x,y) in((x0+ins,y0+ins),(x1-ins,y0+ins),(x1-ins,y1-ins),(x0+ins,y1-ins)): vs.append(bm.verts.new((x,-y,z)))
    F=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    for f in F:
        face=bm.faces.new([vs[i] for i in f])
        for lp in face.loops:
            co=lp.vert.co; lp[uvl].uv=uvf(co.x,-co.y)
bm.verts.ensure_lookup_table()
# case: dark (map to bottom-right dark area)
dark=lambda x,y:(0.98,0.02)
box(-pad,-pad,W*u+pad,H*u+pad,0,0.018,0.002,dark)
for k in L['keys']:
    x0=k['x']*u+0.0012; y0=k['y']*u+0.0012; x1=(k['x']+k['w'])*u-0.0012; y1=(k['y']+k['h'])*u-0.0012
    f=lambda x,y:kuv(x/u,y/u)
    box(x0,y0,x1,y1,0.014,0.024,0.0022,f)
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
me=bpy.data.meshes.new('Keyboard'); bm.to_mesh(me); kb=bpy.data.objects.new('Keyboard',me); bpy.context.collection.objects.link(kb); me.materials.append(mat)
for p in me.polygons: p.use_smooth=False
# centre, tilt 6deg (back edge up)
for v in me.vertices: v.co.x-=W*u/2; v.co.y+=H*u/2
kb.rotation_euler=(math.radians(-6)*-1,0,0)
# --- mouse
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1)
m=bpy.context.object; m.name='Mouse'
mb=L['mouse']
for v in m.data.vertices:
    v.co.z=max(v.co.z,-0.15)+0.15
    v.co.x*=0.031; v.co.y*=0.058; v.co.z*=0.033
    v.co.y+= -0.004*(v.co.y<0)  # slightly longer front
for lp in m.data.loops:
    co=m.data.vertices[lp.vertex_index].co
    px=mb[0]+(co.x/0.031*0.5+0.5)*(mb[2]-mb[0]); py=mb[1]+(-co.y/0.058*0.5+0.5)*(mb[3]-mb[1])
    m.data.uv_layers.active.data[lp.index].uv=(px/TW,1-py/TH)
m.data.materials.append(mat)
bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=0.0085,depth=0.006,location=(0,-0.030,0.031),rotation=(0,math.pi/2,0))
w=bpy.context.object
for lp in w.data.loops: w.data.uv_layers.active.data[lp.index].uv=((100)/TW,1-(L['mouse'][1]+40)/TH)
w.data.materials.append(mat)
bpy.ops.object.select_all(action='DESELECT'); w.select_set(True); m.select_set(True); bpy.context.view_layer.objects.active=m; bpy.ops.object.join()
m.location=(0.29,0,0)
print("TRIS",sum(len(p.vertices)-2 for o in (kb,m) for p in o.data.polygons))
bpy.ops.export_scene.gltf(filepath='/workspace/anims-lib/props/desk_input.glb',export_format='GLB')
