# Re-cut the UBC shirt: bisect the body mesh along clean planes (sleeves, crew neck) so the shirt/skin border is a
# straight edge loop instead of a jagged triangle staircase. Weights interpolate on the new verts. Output: *_v2.glb
import bpy, bmesh, sys
from mathutils import Vector
src,dst,sleeve=sys.argv[sys.argv.index('--')+1:][:3]; sleeve=float(sleeve)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
body=[o for o in bpy.data.objects if o.type=='MESH' and 'Shirt' in [m.name for m in o.data.materials]][0]
for o in list(bpy.data.objects):
    if o.name=='Icosphere': bpy.data.objects.remove(o)
mats=[m.name for m in body.data.materials]; SK=0; SH=mats.index('Shirt'); PA=mats.index('Pants')
B=arm.data.bones; ua=B['upperarm_l']; ax=(ua.tail_local-ua.head_local); SX=ua.head_local.x+sleeve*ax.length
nk=B['neck_01'].head_local.z
bm=bmesh.new(); bm.from_mesh(body.data)
def cut(co,no,sel):
    geom=[f for f in bm.faces if sel(f.calc_center_median())]
    g=list({v for f in geom for v in f.verts})+list({e for f in geom for e in f.edges})+geom
    bmesh.ops.bisect_plane(bm,geom=g,plane_co=co,plane_no=no)
for s in (1,-1): cut(Vector((s*SX,0,0)),Vector((1,0,0)),lambda c:c.z>nk-0.25 and abs(c.x-s*SX)<0.06)
import math
NCO=Vector((0,0,nk-0.035)); NNO=Vector((0,-0.35,1)).normalized()   # collar floor: front ~3 cm lower than the back
RX,RY,CY=0.085,0.078,0.025; N=16                                  # crew-neck ellipse around the neck (UE rig: front = -Y)
planes=[]
for i in range(N):
    th=2*math.pi*i/N; p=Vector((RX*math.cos(th),CY+RY*math.sin(th),0)); n=Vector((math.cos(th)/RX,math.sin(th)/RY,0)).normalized(); planes.append((p,n,th))
for p,n,th in planes:
    cut(Vector((p.x,p.y,nk)),n,lambda c,th=th: 1.40<c.z<1.66 and abs(((math.atan2((c.y-CY)/RY,c.x/RX)-th+math.pi)%(2*math.pi))-math.pi)<2*math.pi/N*0.75)
cut(NCO,NNO,lambda c:1.40<c.z<1.62 and (c.x/RX)**2+((c.y-CY)/RY)**2<1.6)
bm.faces.ensure_lookup_table(); n_sh=0
for f in bm.faces:
    c=f.calc_center_median()
    if f.material_index in (SK,SH):
        hole=all((c-Vector((p.x,p.y,c.z))).dot(n)<0 for p,n,_ in planes) and (c-NCO).dot(NNO)>0
        inside= 1.0<c.z<nk+0.05 and not hole and abs(c.x)<SX and not (abs(c.x)>0.2 and c.z<1.30)
        f.material_index=SH if inside else SK; n_sh+=inside
bm.to_mesh(body.data); bm.free()
print("SHIRT_FACES",n_sh,"SX",round(SX,3),"neck",round(nk,3),"polys",len(body.data.polygons))
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',export_draco_mesh_compression_enable=True,export_animations=False)
