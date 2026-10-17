import bpy,sys
U1="/tmp/ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
U2="/tmp/ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb"
PACKS={'locomotion':['Idle_Loop','Walk_Loop','Walk_Formal_Loop','Jog_Fwd_Loop','Sprint_Loop','Walk_Carry_Loop','Push_Loop','Interact','Crouch_Idle_Loop','ClimbUp_1m'],
 'social':['Idle_Talking_Loop','Sitting_Talking_Loop','Idle_TalkingPhone_Loop','Idle_FoldArms_Loop','Yes','Idle_No_Loop','Dance_Loop','Sitting_Enter','Sitting_Exit','Sitting_Idle_Loop','PickUp_Table'],
 'store':['Chest_Open','Consume','PickUp_Table','Interact','Walk_Carry_Loop'],
 'exterior':['Idle_Rail_Loop','Idle_Rail_Call','Idle_Lantern_Loop','Farm_Watering','Swim_Idle_Loop','LayToIdle','Sitting_Idle_Loop']}
out=sys.argv[sys.argv.index('--')+1]
for pk,names in PACKS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=U1); bpy.ops.import_scene.gltf(filepath=U2)
    arms=[o for o in bpy.data.objects if o.type=='ARMATURE']
    for o in list(bpy.data.objects):
        if o!=arms[0]: bpy.data.objects.remove(o)
    keep=set()
    for a in list(bpy.data.actions):
        base=a.name.replace('_Armature','').split('.')[0]
        if base in names and base not in keep: a.name=base; a.use_fake_user=True; keep.add(base)
    for a in list(bpy.data.actions):
        if a.name not in keep: bpy.data.actions.remove(a)
    print("PACK",pk,sorted(keep))
    bpy.ops.export_scene.gltf(filepath=f"{out}/{pk}_raw.glb",export_format='GLB',export_animation_mode='ACTIONS')
