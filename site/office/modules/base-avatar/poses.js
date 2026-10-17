// Procedural pose layers applied after the mixer. The free CC0 clip sets (UAL1/UAL2) have no wave or typing clip, so we
// aim the arm bones at target directions in the avatar's own frame (+z = facing, +x = its left). Axis-agnostic: works on
// any rig with upperarm/lowerarm/hand bones, because we rotate each bone so its child lands along the target direction.
import * as THREE from '../../vendor/three.module.min.js?v=169';
const a = new THREE.Vector3(), b = new THREE.Vector3(), cur = new THREE.Vector3(), tgt = new THREE.Vector3(), q = new THREE.Quaternion(), wq = new THREE.Quaternion(), pq = new THREE.Quaternion(), gq = new THREE.Quaternion();
function aim(bone, child, dir, w, root) {
  if (!bone || !child) return; bone.getWorldPosition(a); child.getWorldPosition(b); cur.subVectors(b, a).normalize();
  root.getWorldQuaternion(gq); tgt.copy(dir).normalize().applyQuaternion(gq);
  q.setFromUnitVectors(cur, tgt); if (w < 1) q.slerp(new THREE.Quaternion(), 1 - w);
  bone.getWorldQuaternion(wq); wq.premultiply(q); bone.parent.getWorldQuaternion(pq); bone.quaternion.copy(pq.invert().multiply(wq)); bone.updateMatrixWorld(true);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export function bonesOf(body) { const m = {}; body.traverse(o => { if (o.isBone) m[o.name.toLowerCase()] = o; }); return m; }
// k: 'wave' | 'type'; t: seconds; w: blend weight 0..1; root: the agent group (defines facing)
export function pose(B, k, t, w, root) {
  if (w <= 0.001) return;
  if (k === 'wave') {
    aim(B.upperarm_r, B.lowerarm_r, V(-0.55, 0.78, 0.18), w, root);
    aim(B.lowerarm_r, B.hand_r, V(-0.12 + Math.sin(t * 9) * 0.38, 1, 0.22), w, root);
    aim(B.hand_r, B.middle_01_r, V(-0.1 + Math.sin(t * 9) * 0.4, 1, 0.3), w, root);
  } else if (k === 'type') {
    for (const [s, x] of [['l', 1], ['r', -1]]) {
      aim(B['upperarm_' + s], B['lowerarm_' + s], V(x * 0.1, -0.85, 0.35), w, root);
      aim(B['lowerarm_' + s], B['hand_' + s], V(-x * 0.2, -0.02, 1), w, root);
      aim(B['hand_' + s], B['middle_01_' + s], V(-x * 0.05, -0.35 + Math.sin(t * 15 + x * 1.7) * 0.12, 1), w, root);
    }
  }
}
