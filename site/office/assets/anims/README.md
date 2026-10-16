# EWS office animation library (staging, branch anims-library)
Rig: Quaternius UAL 65-bone skeleton (same as base-avatar human_Male/Female). All clips 30 fps, resampled + meshopt.
Licenses: UAL1/UAL2 clips CC0 (Quaternius). Sit_Type_Loop / Sit_Mouse_Loop: derived from CC0 Sitting_Idle_Loop + our own baked IK (EWS-owned).
Keyboard/mouse (desk_input.glb, kb_legend.png): built by us procedurally (tools/anims/kb.py, legend.py), EWS-owned. DejaVu font (free licence) for legends.

Packs (load per room): desk_core (seated work), locomotion, social, store, exterior.
Anchors: anchors.json (clip-root frame; three = (x, z, -y)). Keyboard centre 0.58 m in front of seat centre, 0.095 m to the
avatar's right (main block centred on the body), 6 deg tilt, Esc on avatar-left; mouse 0.29 m right of keyboard centre.
Gate: test.html -> gate(): fingertip (middle_04_leaf) within 5 cm of the key/mouse anchor every 3rd frame; no bind-pose frames.
