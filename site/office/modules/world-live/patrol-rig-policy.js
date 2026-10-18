// Keep patrol rigs inside both the avatar's visible range and its regular mixer-update range.
export function patrolRigLimit(lod = 1) {
  const L = lod || 1;
  return Math.min(15 * Math.max(0.8, L), 16 * L);
}

export function wantsPatrolRig(distance, lod = 1) {
  const L = lod || 1;
  return L >= 0.5 && distance < patrolRigLimit(L);
}
