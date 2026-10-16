set -e; cd /workspace/anims-lib; A=/workspace/ews-anims/site/office/assets/anims
export BODY=/workspace/ews-office-build/site/office/modules/base-avatar/assets/human_Female.glb
for p in "$@"; do blender -b --python build.py -- /workspace/anims-lib/outf_$p.glb $p 2>&1 | grep -E "GATE|Error|line "; node strip.mjs outf_$p.glb $A/${p}_f.glb >/dev/null 2>&1; python3 -c "
import json;j=json.load(open('outf_$p.glb.anchors.json'));json.dump(j,open('$A/anchors_${p}_f.json','w'))"; done
