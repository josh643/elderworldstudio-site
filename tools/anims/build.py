# Builds EWS office clips on the UAL 65-bone rig: base CC0 clip + baked hand IK to desk anchors + finger/spine offsets.
import bpy, math, json, sys
from mathutils import Vector, Quaternion, Euler
U1="/tmp/ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
U2="/tmp/ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb"
OUT=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=U1)
for a in bpy.data.actions: a['u1']=1
bpy.ops.import_scene.gltf(filepath=U2)
for a in list(bpy.data.actions):
    if 'u1' not in a and a.name.split('.')[0] not in [x.name for x in bpy.data.actions if 'u1' in x]: a.name=a.name.split('.')[0]
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
# retarget: solve on the office body's own skeleton (UBC) so bone lengths stay at its rest pose. UAL clips are applied as
# pose rotations only; per-bone translations are dropped except root/pelvis (they would force UAL proportions on the body).
BODY=__import__('os').environ.get('BODY','/workspace/ews-office-build/site/office/modules/base-avatar/assets/human_Male.glb')
bpy.ops.import_scene.gltf(filepath=BODY)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
if arm.animation_data: arm.animation_data_clear()
arm.animation_data_create()
for o in list(bpy.data.objects):
    if o!=arm: bpy.data.objects.remove(o)
for a in bpy.data.actions:
    for fc in list(a.fcurves):
        if (fc.data_path.endswith('.location') and not any(k in fc.data_path for k in ('"root"','"pelvis"'))) or fc.data_path.endswith('.scale'): a.fcurves.remove(fc)
sc=bpy.context.scene; sc.render.fps=30; bpy.context.view_layer.objects.active=arm; arm.select_set(True)
PEL_Y=0.331                     # seated pelvis is 0.331 m behind root (facing -Y, left=+X, up=Z)
import json as _j
LAY=_j.load(open('/workspace/anims-lib/props/layout.json')); u=0.019; TILT=math.radians(6)
DESK=0.76; KBX=-0.095; KBY=PEL_Y-0.58     # keyboard centre: main block centred on the body, 0.58 m in front of the seat centre
def key_top(lbl):
    k=[k for k in LAY['keys'] if k['l']==lbl][0]; xc=(k['x']+k['w']/2)*u; yc=(k['y']+k['h']/2)*u
    xl=LAY['W']*u/2-xc; yl=LAY['H']*u/2-yc; zl=0.024
    return Vector((KBX+xl, KBY-(yl*math.cos(TILT)-zl*math.sin(TILT)), DESK+0.008+zl*math.cos(TILT)+yl*math.sin(TILT)))
KEY_D=key_top('D'); KEY_K=key_top('K')
MOUSE_C=Vector((KBX-0.29, KBY, DESK)); MOUSE_TOP=MOUSE_C+Vector((0,0.0,0.033))
KNUCK=Vector((0,0.05,0.035))     # knuckles sit ~5 cm behind and 3.5 cm above the fingertip contact
KB=KEY_D; MOUSE=MOUSE_TOP
ANCH={}; SAMPLES={}; ERR={}; CUR={}; LOOPBASE={}; FRAMES={}
def bezier_free(): pass
def make_clip(name, base, frames=None, ik={}, rot={}, woff=None, pole=None, breathe=True):
    frames=frames or int(bpy.data.actions[base+'_Armature'].frame_range[1])-1
    rot=dict(rot)
    if breathe:   # subtle breathing + weight shift, integer cycles over the clip so loops stay seamless
        nb=max(1,round(frames/120)); prev=rot.get('spine_02'); prevp=rot.get('pelvis'); seated=base.startswith('Sitting') or name.startswith('Sit_')
        rot['spine_02']=(lambda t,prev=prev,nb=nb: Euler(((prev(t).x if prev else 0)+0.012*math.sin(TAU*nb*t),(prev(t).y if prev else 0),(prev(t).z if prev else 0))))
        if not seated: rot['pelvis']=(lambda t,prevp=prevp,nb=nb: Euler(((prevp(t).x if prevp else 0),(prevp(t).y if prevp else 0)+0.02*math.sin(TAU*max(1,nb//2)*t),(prevp(t).z if prevp else 0))))
    pre={b:f for b,f in rot.items() if not b.startswith(('index','middle','ring','pinky','thumb'))}
    post={b:f for b,f in rot.items() if b not in pre}
    if pre:
        tmp=_clip(name+"__pre_Armature",base,frames,{},pre); return _clip(name,name+"__pre",frames,ik,post,woff,pole)
    return _clip(name,base,frames,ik,post,woff,pole)
def _clip(name, base, frames, ik={}, rot={}, woff=None, pole=None):
    pole=pole or {}; PO={}
    FRAMES[name.replace('__pre','')]=frames
    WO=dict(WOFF); WO.update(woff or {})
    """ik: side->fn(t)->Vector contact point for knuckles (middle_01 head); rot: bone->fn(t)->Euler offset"""
    src=bpy.data.actions[base+"_Armature"]; n=int(src.frame_range[1])
    arm.animation_data.action=src
    bpy.ops.object.mode_set(mode='POSE')
    cons=[]; emps=[]; WR={}
    for side,fn in ik.items():
        e=bpy.data.objects.new("T_"+side,None); sc.collection.objects.link(e); emps.append((e,fn))
        ew=bpy.data.objects.new("W_"+side,None); sc.collection.objects.link(ew); WR[side]=ew
        p1=arm.pose.bones["lowerarm_"+side]; c1=p1.constraints.new('IK'); c1.target=ew; c1.chain_count=2; c1.iterations=500; cons.append((p1,c1))
        if side in pole:
            ep=bpy.data.objects.new("P_"+side,None); sc.collection.objects.link(ep); PO[side]=ep; c1.pole_target=ep; c1.pole_angle=math.radians(POLE_ANG[side])
        p2=arm.pose.bones["hand_"+side]; c2=p2.constraints.new('DAMPED_TRACK'); c2.target=e; c2.track_axis='TRACK_Y'; cons.append((p2,c2))
        p3=arm.pose.bones["middle_03_"+side]; c3=p3.constraints.new('IK'); c3.target=e; c3.chain_count=3; c3.iterations=200; cons.append((p3,c3))
    bones=[pb for pb in arm.pose.bones]; data={}
    for f in range(1,frames+2):
        t=(f-1)/frames
        cyc=max(1,round(frames/max(1,n-1))); ph=1+((t*cyc*(n-1))%(n-1)) if t<1 else 1+(n-1 if cyc else 0)
        if not ik and not rot: ph=f
        sc.frame_set(int(ph),subframe=ph-int(ph)); bpy.context.view_layer.update()
        CUR['head']=arm.pose.bones['Head'].head.copy(); CUR['t']=t
        for sd,ep in PO.items(): ep.location=arm.matrix_world@pole[sd](t)
        for (e,fn),sd in zip(emps,ik): e.location=arm.matrix_world@fn(t); WR[sd].location=arm.matrix_world@(fn(t)+WO[sd])
        bpy.context.view_layer.update()
        for it in range(6):
            for (e,fn),sd in zip(emps,ik):
                WR[sd].location=WR[sd].location-((arm.matrix_world@arm.pose.bones['middle_04_leaf_'+sd].head)-(arm.matrix_world@fn(t)))
            bpy.context.view_layer.update()
        data[f]={pb.name:pb.matrix.copy() for pb in bones}
        if ik and (f-1)%3==0:
            for sd,fn in ik.items():
                p=fn(t); SAMPLES.setdefault(name,{}).setdefault(sd,[]).append([round(c,4) for c in p]*2)
                for sd2 in PO: ELB[name]=max(ELB.get(name,0),((arm.matrix_world@arm.pose.bones['lowerarm_'+sd2].head)-PO[sd2].location).length)
                ERR[name]=max(ERR.get(name,0),((arm.matrix_world@arm.pose.bones['middle_04_leaf_'+sd].head)-p).length)
    for pb,c in cons: pb.constraints.remove(c)
    for e,_ in emps: bpy.data.objects.remove(e)
    for e in WR.values(): bpy.data.objects.remove(e)
    for e in PO.values(): bpy.data.objects.remove(e)
    act=bpy.data.actions.new(name); arm.animation_data.action=act
    for f,mats in data.items():
        for pb in bones: pb.matrix=mats[pb.name]; bpy.context.view_layer.update()
        t=(f-1)/frames
        for b,fn in rot.items():
            pb=arm.pose.bones[b]; pb.rotation_quaternion=pb.rotation_quaternion@fn(t).to_quaternion()
        for pb in bones:
            pb.keyframe_insert("rotation_quaternion",frame=f)
            if pb.name in("root","pelvis"): pb.keyframe_insert("location",frame=f)
    act.use_fake_user=True
    bpy.ops.object.mode_set(mode='OBJECT')
    return act
TAU=2*math.pi
import os
POLE_ANG={'l':float(os.environ.get('PA_L','-90')),'r':float(os.environ.get('PA_R','-90'))}
ELB={}
WOFF={'l':Vector((0.045,0.09,0.03)),'r':Vector((-0.045,0.09,0.03))}
def fing(side,speed,phase): return lambda t: Euler((0.25+0.35*max(0,math.sin(TAU*speed*t+phase)),0,0))
def ease(x): x=max(0,min(1,x)); return x*x*(3-2*x)
def lerp(a,b,k): return a+(b-a)*k
V=lambda x,y,z: Vector((x,y,z))
PACK=sys.argv[sys.argv.index('--')+2]
exec(open(f'/workspace/anims-lib/specs/{PACK}.py').read())
names=[a.name for a in bpy.data.actions if not a.name.endswith('_Armature') and '__pre' not in a.name and a.users>=0 and a.use_fake_user]
print("BUILT",PACK,names)
print("GATE_CM",{k:round(v*100,2) for k,v in ERR.items()})
print("ELBOW_TO_POLE_CM",{k:round(v*100,1) for k,v in ELB.items()})
json.dump({'frame':'clip root, Blender axes: -Y forward (three +Z), +X avatar-left, Z up. three = (x, z, -y)',
  'keyboard':{'centre_base':[KBX,KBY,DESK],'tilt_deg':6,'yaw':'Esc on avatar-left'},'mouse':{'centre_base':list(MOUSE_C)},
  'contact_bones':{'fingertip':'middle_04_leaf_*'},'samples_every':3,'frames':{k:FRAMES[k] for k in SAMPLES},'samples':SAMPLES},open(OUT+'.anchors.json','w'))
for a in list(bpy.data.actions):
    if a.name.endswith("_Armature") or '__pre' in a.name or 'u1' in a or not a.use_fake_user: bpy.data.actions.remove(a)
for a in list(bpy.data.actions):
    if a.name.split('.')[0]!=a.name: bpy.data.actions.remove(a)
for o in list(bpy.data.objects):
    if o!=arm: bpy.data.objects.remove(o)
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',export_animation_mode='ACTIONS',export_force_sampling=True)
