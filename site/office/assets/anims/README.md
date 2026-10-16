# EWS office animation library (staging; branch anims-library -> office-3d)
Rig: Quaternius UAL 65-bone skeleton, same as base-avatar human_Male/Female. 30 fps. Scale channels stripped, resampled,
meshopt-compressed (level high; keep translations: the UAL clip rig and the UBC bodies differ in bone offsets).

## Packs (load per room)
| pack | clips | gz |
|---|---|---|
| desk.glb | Sit_Type_Loop, Sit_Mouse_Loop, Sit_ReadMonitor_Loop, Sit_Write_Loop, Sit_ShufflePapers, Sit_Phone_Loop, Sit_Coffee, Sit_Stretch, Sit_LeanBack_Loop, Chair_PullOut | 61 KB |
| move.glb | Door_Open_Pull, Door_Close, Door_Push_Open, Turn_L90, Turn_R90, Idle_LookAround, Idle_WeightShift, Idle_CheckWatch | 38 KB |
| social2.glb | Wave, Point_Fwd, Present_Loop, Handshake, Freyja_Desk_Idle, Freyja_Greet, Freyja_Guide, Hermod_Register_Scan, Hermod_Shelve, Hermod_HandOver, Arcade_Play_Loop | 56 KB |
| locomotion.glb | Idle, Walk, Walk_Formal, Jog, Sprint, Walk_Carry, Push, Interact, Crouch_Idle, ClimbUp_1m (UAL) | 54 KB |
| social.glb | Talk, Sit_Talk, Phone, FoldArms, Yes, No, Dance, Sitting_Enter/Exit/Idle, PickUp_Table (UAL) | 61 KB |
| store.glb | Chest_Open, Consume, Interact, PickUp_Table, Walk_Carry (UAL) | 30 KB |
| exterior.glb | Idle_Rail_Loop, Idle_Rail_Call, Idle_Lantern, Farm_Watering, Swim_Idle, LayToIdle, Sitting_Idle (UAL) | 48 KB |
| desk_input.glb | full-size 104-key keyboard (legend texture, 6 deg tilt) + shaped mouse; 1,832 tris, 1 material | 29 KB |

## Anchors (anchors.json, anchors_<pack>.json) — clip-root frame, Blender axes; three = (x, z, -y), +z forward
- Seat: seated clips put the pelvis 0.331 m behind the root (existing base-avatar +0.25 z offset still applies).
- Keyboard centre: 0.58 m in front of the seat centre, 0.095 m to the agent's right (main block centred on the body),
  base on the desk top (0.76 m), 6 deg tilt, Esc on the agent's left. Hands: left middle fingertip on D, right on K.
- Mouse: 0.29 m right of the keyboard centre, same depth. Fingertip on the left button.
- Paper/notepad: 0.40 m in front of seat, 0.06 m right. Mug: 0.40 m in front, 0.26 m right (today's kit mug at 0.85 m and paper at 0.65 m are out of reach).
- Standing props: door handle 1.0 m high, 0.55 m ahead, hinge 0.45 m left; reception counter 1.05 m, 0.36 m ahead; store counter 1.0 m; shelf 1.55 m; arcade stick 1.02 m / buttons 0.99 m, 0.38-0.40 m ahead.

## Gate (test.html -> gate())
Fingertip (middle_04_leaf) within 5 cm of its anchor on every 3rd frame, and no bind-pose frame (arms+legs within 8 deg of rest).
Last run: 58/58 clips pass (gate-report.json).

## Shirt fix (human_Male_v2.glb, human_Female_v2.glb)
The jagged "torn" edges were the shirt material following the body's triangle staircase. tools/anims/shirt_fix.py bisects
the body mesh along clean cuts (sleeve plane at 45% of the upper arm, 16-plane crew-neck ellipse with a lower front) and
reassigns faces, so borders are straight edge loops; weights interpolate on the new verts. Same materials/node names: drop-in
for base-avatar (swap the filenames in modules/base-avatar/index.js).

## Licences
UAL1/UAL2 clips: CC0 (Quaternius). Derived IK clips, keyboard/mouse, legend texture, shirt re-cut: EWS-made from CC0 inputs.
Legend font: DejaVu Sans (free licence). No paid tools.

## Polish pass v3 (proportions, breathing, loops, interpenetration)
- Retargeted: every clip (new and reused UAL) is now solved on the office body's own skeleton. Only rotations are
  exported, plus root/pelvis translation. The UAL per-bone offsets used to force UAL proportions onto the UBC body
  (neck 17 vs 21.5 cm, forearm 27 vs 25 cm, clavicle 16 vs 19 cm), which was the "disproportionate" look. Bone lengths
  now stay at the body's rest pose.
- Separate female bakes: `<pack>_f.glb` (+ `anchors_<pack>_f.json`), because the female arms are shorter. Use the `_f` packs for female agents (Freyja).
- Sit_LeanBack_Loop rebuilt: reclines through pelvis and spine (-0.45 rad total) with the neck/head counter-tilted to keep
  the gaze level. Fingers interlaced on the back of the skull, elbows driven out to head height by pole targets, 2 breaths per loop.
- All clips: subtle breathing (spine_02, integer cycles per loop). Standing loops get a small pelvis weight shift.
  Base clips are time-fitted to whole cycles, so loops are seamless.
- Gate now also checks interpenetration (arm segments vs head sphere, torso capsule, desk slab, chair back) and the loop
  seam (wrap jump / median frame step < 3). Male 58/58, female 58/58 (gate-report.json, gate-report-female.json).
- OFFICE NOTE: base-avatar computes `k = 1.78 / bbox height`, and the bbox includes the hidden 2 m 'Icosphere' node in the
  UBC glb, so agents are scaled ~0.89 and hands miss desk-height props by ~11%. Use k = 1 (male 1.86 m, female 1.80 m) or exclude 'Icosphere'.
