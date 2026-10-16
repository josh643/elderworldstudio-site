# Builds EWS office clips on the UAL 65-bone rig: base CC0 clip + baked hand IK to desk anchors + finger/spine offsets.
import bpy, math, json, sys
from mathutils import Vector, Quaternion, Euler
U1="/tmp/ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
U2="/tmp/ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb"
OUT=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=U1)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
for o in list(bpy.data.objects):
    if o!=arm: bpy.data.objects.remove(o)
sc=bpy.context.scene; sc.render.fps=30
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
ANCH={}
def bezier_free(): pass
def make_clip(name, base, frames, ik={}, rot={}, woff=None):
    pre={b:f for b,f in rot.items() if not b.startswith(('index','middle','ring','pinky','thumb'))}
    post={b:f for b,f in rot.items() if b not in pre}
    if pre:
        tmp=_clip(name+"__pre_Armature",base,frames,{},pre); return _clip(name,name+"__pre",frames,ik,post,woff)
    return _clip(name,base,frames,ik,post,woff)
def _clip(name, base, frames, ik={}, rot={}, woff=None):
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
        p2=arm.pose.bones["hand_"+side]; c2=p2.constraints.new('DAMPED_TRACK'); c2.target=e; c2.track_axis='TRACK_Y'; cons.append((p2,c2))
        p3=arm.pose.bones["middle_03_"+side]; c3=p3.constraints.new('IK'); c3.target=e; c3.chain_count=3; c3.iterations=200; cons.append((p3,c3))
    bones=[pb for pb in arm.pose.bones]; data={}
    for f in range(1,frames+2):
        t=(f-1)/frames
        for (e,fn),sd in zip(emps,ik): e.location=arm.matrix_world@fn(t); WR[sd].location=arm.matrix_world@(fn(t)+WO[sd])
        sc.frame_set(1+((f-1)%n)); bpy.context.view_layer.update()
        for it in range(6):
            for (e,fn),sd in zip(emps,ik):
                WR[sd].location=WR[sd].location-((arm.matrix_world@arm.pose.bones['middle_04_leaf_'+sd].head)-(arm.matrix_world@fn(t)))
            bpy.context.view_layer.update()
        data[f]={pb.name:pb.matrix.copy() for pb in bones}
    for pb,c in cons: pb.constraints.remove(c)
    for e,_ in emps: bpy.data.objects.remove(e)
    for e in WR.values(): bpy.data.objects.remove(e)
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
WOFF={'l':Vector((0.045,0.09,0.03)),'r':Vector((-0.045,0.09,0.03))}   # wrist rests 7.5 cm behind, 4.5 cm above the fingertip
CH=int(__import__('os').environ.get('CH','3'))
def fing(side,speed,phase):  # finger tap: index/middle curl
    return lambda t: Euler((0.25+0.35*max(0,math.sin(TAU*speed*t+phase)),0,0))
F=90  # 3 s loops at 30 fps
def kb_hand(side):
    base=(KEY_D if side=='l' else KEY_K)+Vector((0,0,0.004))
    def fn(t):
        dx=0.012*math.sin(TAU*2*t+(0 if side=='l' else 1.3)); dz=0.008*max(0,math.sin(TAU*6*t+(0 if side=='l' else 2)))
        return base+Vector((dx,0.0,dz))
    return fn
make_clip("Sit_Type_Loop","Sitting_Idle_Loop",F,
  ik={'l':kb_hand('l'),'r':kb_hand('r')},
  rot={'index_01_l':fing('l',6,0),'index_01_r':fing('r',6,2),'middle_01_l':fing('l',5,1),'middle_01_r':fing('r',5,3),
       'spine_01':lambda t:Euler((0.12,0,0)),'spine_02':lambda t:Euler((0.12,0,0)),'Head':lambda t:Euler((0.10,0.04*math.sin(TAU*t),0))})
ANCH['Sit_Type_Loop']={'l':'kb','r':'kb'}
def mouse_r(t):
    return MOUSE_TOP+Vector((0.012,-0.035,-0.003))+Vector((0.02*math.sin(TAU*2*t),0.015*math.sin(TAU*3*t+0.7),0))
make_clip("Sit_Mouse_Loop","Sitting_Idle_Loop",F,
  ik={'r':mouse_r,'l':lambda t:KEY_D+Vector((0,0,0.004))},
  rot={'index_01_r':lambda t:Euler((0.2+0.4*max(0,math.sin(TAU*4*t)),0,0)),'spine_01':lambda t:Euler((0.12,0,0)),'spine_02':lambda t:Euler((0.12,0,0.06)),'Head':lambda t:Euler((0.1,-0.05,0))},woff={'r':Vector((-0.01,0.10,-0.012))})
MW={'r':Vector((-0.01,0.10,-0.012))}
ANCH['Sit_Mouse_Loop']={'l':'kb','r':'mouse'}
def tgt_of(nm,s,t):
    if nm=='Sit_Type_Loop': p=kb_hand(s)(t)
    elif s=='r': p=mouse_r(t)
    else: p=KEY_D+Vector((0,0,0.004))
    return p,p
rep={}; samples={}
for nm,sides in ANCH.items():
    arm.animation_data.action=bpy.data.actions[nm]; wk=wt=0; samples[nm]={}
    for f in range(1,F+2):
        sc.frame_set(f); bpy.context.view_layer.update(); t=(f-1)/F
        for s in sides:
            kn,tip=tgt_of(nm,s,t)
            wk=max(wk,((arm.matrix_world@arm.pose.bones['hand_'+s].head).z-tip.z))  # wrist height above contact
            wt=max(wt,((arm.matrix_world@arm.pose.bones['middle_04_leaf_'+s].head)-tip).length)
            if (f-1)%3==0: samples[nm].setdefault(s,[]).append([round(c,4) for c in kn]+[round(c,4) for c in tip])
    rep[nm]={'wrist_above_cm':round(wk*100,2),'fingertip_cm':round(wt*100,2)}
print("GATE_CM",rep)
json.dump({'frame':'clip root, Blender axes: -Y forward (three +Z), +X avatar-left, Z up. three = (x, z, -y)',
  'keyboard':{'centre_base':[KBX,KBY,DESK],'tilt_deg':6,'yaw':'Esc on avatar-left'},'mouse':{'centre_base':list(MOUSE_C)},
  'contact_bones':{'knuckle':'middle_01_*','fingertip':'middle_04_leaf_*'},'clips':ANCH,'samples_every':3,'frames':F,'samples':samples},open(OUT+'.anchors.json','w'))
for a in list(bpy.data.actions):
    if a.name.endswith("_Armature"): bpy.data.actions.remove(a)
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',use_selection=False,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_step=1,export_def_bones=False,export_skins=True)
