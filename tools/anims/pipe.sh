set -e; cd /workspace/anims-lib; A=/workspace/ews-anims/site/office/assets/anims
for p in "$@"; do blender -b --python build.py -- /workspace/anims-lib/out_$p.glb $p 2>&1 | grep -E "BUILT|GATE|Error|line "; node strip.mjs out_$p.glb $A/$p.glb; cp out_$p.glb.anchors.json $A/anchors_$p.json; done
