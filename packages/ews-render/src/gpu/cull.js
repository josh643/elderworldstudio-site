import { screenSpaceError, clusterLodVisible, pickLodLevel } from '../math/sse.js';
import { planesFromVP, sphereInFrustum, coneBackfacing } from '../math/frustum.js';
import { PIXEL_LIMIT, IMPOSTOR_PX } from '../constants.js';
import { projectedPixels } from '../math/sse.js';
import { impostorBlend } from '../math/octahedral.js';

/**
 * CPU reference of the GPU compute cull + LOD select.
 * The WebGPU compute shader implements the same tests so unit tests lock the math.
 */
export function cullClusters(clusters, view) {
  const {
    eye, vp, fov = 62, height = 720, forceMax = false,
    pixelLimit = PIXEL_LIMIT, hiz = null, hizSize = 0,
  } = view;
  const planes = vp ? planesFromVP(vp) : null;
  const visible = [];
  let drew = 0, culledFrustum = 0, culledCone = 0, culledLod = 0, culledHzb = 0, impostors = 0, tris = 0;
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    if (planes && !sphereInFrustum(planes, c.cx, c.cy, c.cz, c.radius)) { culledFrustum++; continue; }
    const vx = eye[0] - c.cx, vy = eye[1] - c.cy, vz = eye[2] - c.cz;
    const dist = Math.hypot(vx, vy, vz) || 0.05;
    if (c.coneCutoff < 0.999 && coneBackfacing(c.cone, c.coneCutoff, vx / dist, vy / dist, vz / dist)) {
      culledCone++; continue;
    }
    if (hiz && !hizVisible(hiz, hizSize, vp, c.cx, c.cy, c.cz, c.radius)) { culledHzb++; continue; }
    const own = screenSpaceError(c.ownError, dist, fov, height);
    const parent = Number.isFinite(c.parentError)
      ? screenSpaceError(c.parentError, dist, fov, height)
      : Infinity;
    let keep;
    if (forceMax) keep = c.lod === 0;
    else if (c.parentError === Infinity && c.lod > 0) keep = own < pixelLimit && (c.lod === 0 || screenSpaceError(c.ownError, dist, fov, height) < pixelLimit);
    else keep = clusterLodVisible(c.ownError, c.parentError, dist, fov, height, pixelLimit);
    if (!keep) { culledLod++; continue; }
    const proj = projectedPixels(c.radius, dist, fov, height);
    const blend = impostorBlend(proj, own, pixelLimit, IMPOSTOR_PX);
    const useImp = !forceMax && blend >= 1;
    if (useImp) impostors++;
    visible.push({
      index: i, lod: c.lod, sse: own, parentSse: parent, dist, projPx: proj,
      impostor: useImp, impostorBlend: blend, tris: useImp ? 2 : (c.tris || 0),
      instance: c.instance, catalog: c.catalog,
    });
    drew++;
    tris += useImp ? 2 : (c.tris || 0);
  }
  return {
    visible, drew, tris,
    culledFrustum, culledCone, culledLod, culledHzb, impostors,
    calls: drew,
  };
}

/** Instance-level LOD pick (Phase 1 compatible). */
export function pickInstanceLod(entry, eye, fov, height, forceMax, pixelLimit = PIXEL_LIMIT) {
  const d = Math.hypot(eye[0] - entry.x, eye[1] - entry.y, eye[2] - entry.z);
  return pickLodLevel(entry.levels, d, fov, height, forceMax, pixelLimit);
}

export function hizVisible(hiz, size, vp, x, y, z, r) {
  if (!hiz || !vp || !size) return true;
  // Conservative: project the sphere's nearest point; reject only if the Hi-Z texel is clearly closer.
  const p = xform(vp, x, y, z);
  if (p[3] <= 0) return true;
  const ndcX = p[0] / p[3], ndcY = p[1] / p[3], ndcZ = p[2] / p[3];
  const u = Math.max(0, Math.min(size - 1, ((ndcX * 0.5 + 0.5) * size) | 0));
  const v = Math.max(0, Math.min(size - 1, ((ndcY * 0.5 + 0.5) * size) | 0));
  const closest = hiz[v * size + u];
  if (closest == null) return true;
  return ndcZ <= closest + 0.02;
}

function xform(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

/** Pack clusters into the 16-float record the WGSL cull shader reads. */
export function packClusterRecords(clusters) {
  const rec = new Float32Array(clusters.length * 16);
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i], o = i * 16;
    rec[o] = c.cx; rec[o + 1] = c.cy; rec[o + 2] = c.cz; rec[o + 3] = c.radius;
    rec[o + 4] = c.cone[0]; rec[o + 5] = c.cone[1]; rec[o + 6] = c.cone[2]; rec[o + 7] = c.coneCutoff;
    rec[o + 8] = c.ownError; rec[o + 9] = Number.isFinite(c.parentError) ? c.parentError : 1e9;
    rec[o + 10] = c.lod; rec[o + 11] = c.tris || 0;
    rec[o + 12] = c.world[0]; rec[o + 13] = c.world[1]; rec[o + 14] = c.world[2]; rec[o + 15] = c.ry || 0;
  }
  return rec;
}
