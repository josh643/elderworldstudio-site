import { PIXEL_LIMIT } from '../constants.js';

/** Screen-space geometric error in pixels. Same formula as Phase 1 worlds-lod. */
export function screenSpaceError(geomErr, distance, fovDeg, heightPx) {
  const d = Math.max(0.05, distance);
  return (geomErr * heightPx) / (d * 2 * Math.tan((fovDeg * Math.PI / 180) / 2));
}

export function projectedPixels(radius, distance, fovDeg, heightPx) {
  return screenSpaceError(radius, distance, fovDeg, heightPx);
}

/**
 * Coarsest LOD whose projected geomErr is still under `pixelLimit`.
 * `levels` is [{ lod, geomErr }] or a number[] of geomErr values.
 */
export function pickLodLevel(levels, distance, fovDeg, heightPx, forceMax = false, pixelLimit = PIXEL_LIMIT) {
  if (forceMax || !levels || !levels.length) return 0;
  let chosen = 0;
  for (let i = 1; i < levels.length; i++) {
    const err = typeof levels[i] === 'number' ? levels[i] : levels[i].geomErr;
    if (screenSpaceError(err, distance, fovDeg, heightPx) < pixelLimit) chosen = i;
  }
  return chosen;
}

/** Nanite-style cluster: draw this level iff ownError projects under the limit and parentError does not. */
export function clusterLodVisible(ownError, parentError, distance, fovDeg, heightPx, pixelLimit = PIXEL_LIMIT) {
  const own = screenSpaceError(ownError, distance, fovDeg, heightPx);
  const parent = Number.isFinite(parentError)
    ? screenSpaceError(parentError, distance, fovDeg, heightPx)
    : Infinity;
  return own <= pixelLimit && parent > pixelLimit;
}

export function tanHalfFov(fovDeg) {
  return Math.tan((fovDeg * Math.PI / 180) / 2);
}

export { PIXEL_LIMIT };
