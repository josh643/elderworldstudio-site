import { SPACE_REBASE_M } from '../constants.js';

/** Floating origin: rebase when the camera leaves the safe float32 range. */
export function shouldRebase(cameraPos, threshold = SPACE_REBASE_M) {
  const x = cameraPos[0], z = cameraPos[2];
  return (x * x + z * z) >= threshold * threshold;
}

export function rebase(cameraPos, objects, originAccum, threshold = SPACE_REBASE_M) {
  if (!shouldRebase(cameraPos, threshold)) return { rebased: false, origin: originAccum.slice() };
  const ox = cameraPos[0], oz = cameraPos[2];
  cameraPos[0] -= ox;
  cameraPos[2] -= oz;
  for (const o of objects) {
    o[0] -= ox;
    o[2] -= oz;
  }
  originAccum[0] += ox;
  originAccum[2] += oz;
  return { rebased: true, origin: originAccum.slice(), delta: [ox, 0, oz] };
}

export function worldFromLocal(local, origin) {
  return [local[0] + origin[0], local[1] + (origin[1] || 0), local[2] + origin[2]];
}
