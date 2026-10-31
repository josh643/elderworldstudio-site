import { MESHLET_TRIS } from '../constants.js';

function morton3(x, y, z) {
  const p = (n) => {
    n = (n | (n << 16)) & 0x030000FF;
    n = (n | (n << 8)) & 0x0300F00F;
    n = (n | (n << 4)) & 0x030C30C3;
    n = (n | (n << 2)) & 0x09249249;
    return n;
  };
  return p(x) | (p(y) << 1) | (p(z) << 2);
}

function boundsOf(positions, indices, start, count) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const nx = [0, 0, 0], nn = [0, 0, 0];
  for (let t = 0; t < count; t++) {
    for (let k = 0; k < 3; k++) {
      const i = indices[start + t * 3 + k] * 3;
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
    }
    const ia = indices[start + t * 3] * 3, ib = indices[start + t * 3 + 1] * 3, ic = indices[start + t * 3 + 2] * 3;
    const ax = positions[ib] - positions[ia], ay = positions[ib + 1] - positions[ia + 1], az = positions[ib + 2] - positions[ia + 2];
    const bx = positions[ic] - positions[ia], by = positions[ic + 1] - positions[ia + 1], bz = positions[ic + 2] - positions[ia + 2];
    let cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const len = Math.hypot(cx, cy, cz) || 1;
    nx[0] += cx / len; nx[1] += cy / len; nx[2] += cz / len;
    nn[0]++;
  }
  const cx = (minX + maxX) * 0.5, cy = (minY + maxY) * 0.5, cz = (minZ + maxZ) * 0.5;
  const radius = Math.hypot(maxX - cx, maxY - cy, maxZ - cz);
  const nl = Math.hypot(nx[0], nx[1], nx[2]) || 1;
  const cone = [nx[0] / nl, nx[1] / nl, nx[2] / nl];
  // cutoff: worst triangle vs mean cone (cos of half-angle)
  let minDot = 1;
  for (let t = 0; t < count; t++) {
    const ia = indices[start + t * 3] * 3, ib = indices[start + t * 3 + 1] * 3, ic = indices[start + t * 3 + 2] * 3;
    const ax = positions[ib] - positions[ia], ay = positions[ib + 1] - positions[ia + 1], az = positions[ib + 2] - positions[ia + 2];
    const bx = positions[ic] - positions[ia], by = positions[ic + 1] - positions[ia + 1], bz = positions[ic + 2] - positions[ia + 2];
    let cxn = ay * bz - az * by, cyn = az * bx - ax * bz, czn = ax * by - ay * bx;
    const len = Math.hypot(cxn, cyn, czn) || 1;
    const d = (cxn * cone[0] + cyn * cone[1] + czn * cone[2]) / len;
    if (d < minDot) minDot = d;
  }
  return { cx, cy, cz, radius, cone, coneCutoff: minDot, ox: 0, oy: 0, oz: 0, tris: count };
}

/** Split a triangle mesh into ~maxTris meshlets via Morton-sorted centroids. */
export function buildMeshlets(positions, indices, maxTris = MESHLET_TRIS) {
  const triCount = (indices.length / 3) | 0;
  if (!triCount) return { meshlets: [], indices: new Uint32Array(0), count: 0 };

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const cents = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    let sx = 0, sy = 0, sz = 0;
    for (let k = 0; k < 3; k++) {
      const i = indices[t * 3 + k] * 3;
      sx += positions[i]; sy += positions[i + 1]; sz += positions[i + 2];
      if (positions[i] < minX) minX = positions[i];
      if (positions[i + 1] < minY) minY = positions[i + 1];
      if (positions[i + 2] < minZ) minZ = positions[i + 2];
      if (positions[i] > maxX) maxX = positions[i];
      if (positions[i + 1] > maxY) maxY = positions[i + 1];
      if (positions[i + 2] > maxZ) maxZ = positions[i + 2];
    }
    cents[t * 3] = sx / 3; cents[t * 3 + 1] = sy / 3; cents[t * 3 + 2] = sz / 3;
  }
  const dx = maxX - minX || 1, dy = maxY - minY || 1, dz = maxZ - minZ || 1;
  const order = new Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const qx = Math.max(0, Math.min(1023, ((cents[t * 3] - minX) / dx * 1023) | 0));
    const qy = Math.max(0, Math.min(1023, ((cents[t * 3 + 1] - minY) / dy * 1023) | 0));
    const qz = Math.max(0, Math.min(1023, ((cents[t * 3 + 2] - minZ) / dz * 1023) | 0));
    order[t] = { t, m: morton3(qx, qy, qz) };
  }
  order.sort((a, b) => a.m - b.m);

  const packed = new Uint32Array(triCount * 3);
  for (let i = 0; i < triCount; i++) {
    const t = order[i].t;
    packed[i * 3] = indices[t * 3];
    packed[i * 3 + 1] = indices[t * 3 + 1];
    packed[i * 3 + 2] = indices[t * 3 + 2];
  }

  const meshlets = [];
  for (let start = 0; start < triCount; start += maxTris) {
    const count = Math.min(maxTris, triCount - start);
    meshlets.push(boundsOf(positions, packed, start * 3, count));
    meshlets[meshlets.length - 1].indexStart = start * 3;
    meshlets[meshlets.length - 1].indexCount = count * 3;
  }
  return { meshlets, indices: packed, count: meshlets.length };
}

/** Geometric error: max vertex displacement from `hi` positions to the nearest vertex on `lo`. */
export function geometricError(hiPos, loPos) {
  let max = 0;
  for (let i = 0; i < hiPos.length; i += 3) {
    let best = Infinity;
    for (let j = 0; j < loPos.length; j += 3) {
      const d = Math.hypot(hiPos[i] - loPos[j], hiPos[i + 1] - loPos[j + 1], hiPos[i + 2] - loPos[j + 2]);
      if (d < best) best = d;
    }
    if (best > max) max = best;
  }
  return max;
}
