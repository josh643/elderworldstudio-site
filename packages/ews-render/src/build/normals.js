/** High-poly → LOD object-space normal bake. Output is RGBA8 (xyz in 0..255, a=255). */

function closestNormal(hiPos, hiNrm, hiIdx, x, y, z) {
  let best = Infinity, nx = 0, ny = 1, nz = 0;
  const tris = (hiIdx.length / 3) | 0;
  for (let t = 0; t < tris; t++) {
    const ia = hiIdx[t * 3], ib = hiIdx[t * 3 + 1], ic = hiIdx[t * 3 + 2];
    const ax = hiPos[ia * 3], ay = hiPos[ia * 3 + 1], az = hiPos[ia * 3 + 2];
    const bx = hiPos[ib * 3], by = hiPos[ib * 3 + 1], bz = hiPos[ib * 3 + 2];
    const cx = hiPos[ic * 3], cy = hiPos[ic * 3 + 1], cz = hiPos[ic * 3 + 2];
    const px = (ax + bx + cx) / 3, py = (ay + by + cy) / 3, pz = (az + bz + cz) / 3;
    const d = (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2;
    if (d < best) {
      best = d;
      if (hiNrm) {
        nx = (hiNrm[ia * 3] + hiNrm[ib * 3] + hiNrm[ic * 3]) / 3;
        ny = (hiNrm[ia * 3 + 1] + hiNrm[ib * 3 + 1] + hiNrm[ic * 3 + 1]) / 3;
        nz = (hiNrm[ia * 3 + 2] + hiNrm[ib * 3 + 2] + hiNrm[ic * 3 + 2]) / 3;
      } else {
        const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
        const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
        nx = e1y * e2z - e1z * e2y;
        ny = e1z * e2x - e1x * e2z;
        nz = e1x * e2y - e1y * e2x;
      }
    }
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

export function computeVertexNormals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3, ib = indices[i + 1] * 3, ic = indices[i + 2] * 3;
    const e1x = positions[ib] - positions[ia], e1y = positions[ib + 1] - positions[ia + 1], e1z = positions[ib + 2] - positions[ia + 2];
    const e2x = positions[ic] - positions[ia], e2y = positions[ic + 1] - positions[ia + 1], e2z = positions[ic + 2] - positions[ia + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    n[ia] += nx; n[ia + 1] += ny; n[ia + 2] += nz;
    n[ib] += nx; n[ib + 1] += ny; n[ib + 2] += nz;
    n[ic] += nx; n[ic + 1] += ny; n[ic + 2] += nz;
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

/**
 * Bake high-poly normals onto a LOD mesh. `size` is the square atlas edge.
 * UVs default to a spherical projection so the map is usable without artist UVs.
 */
export function bakeNormalMap(hi, lo, size = 64) {
  const hiN = hi.normals || computeVertexNormals(hi.positions, hi.indices);
  const loN = lo.normals || computeVertexNormals(lo.positions, lo.indices);
  const w = size, h = size;
  const rgba = new Uint8Array(w * h * 4);
  const verts = lo.positions.length / 3;
  // scatter each LOD vertex into the atlas, then flood empty texels from nearest
  const filled = new Uint8Array(w * h);
  for (let v = 0; v < verts; v++) {
    const x = lo.positions[v * 3], y = lo.positions[v * 3 + 1], z = lo.positions[v * 3 + 2];
    const [nx, ny, nz] = closestNormal(hi.positions, hiN, hi.indices, x, y, z);
    let u, vv;
    if (lo.uvs) { u = lo.uvs[v * 2]; vv = lo.uvs[v * 2 + 1]; }
    else {
      const r = Math.hypot(x, y, z) || 1;
      u = 0.5 + Math.atan2(z, x) / (Math.PI * 2);
      vv = 0.5 - Math.asin(Math.max(-1, Math.min(1, y / r))) / Math.PI;
    }
    const px = Math.max(0, Math.min(w - 1, (u * w) | 0));
    const py = Math.max(0, Math.min(h - 1, ((1 - vv) * h) | 0));
    const i = (py * w + px) * 4;
    rgba[i] = Math.round((nx * 0.5 + 0.5) * 255);
    rgba[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    rgba[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    rgba[i + 3] = 255;
    filled[py * w + px] = 1;
  }
  // fill empty from nearest written texel (tiny atlas — O(n²) is fine)
  const seeds = [];
  for (let i = 0; i < filled.length; i++) if (filled[i]) seeds.push(i);
  if (!seeds.length) {
    for (let i = 0; i < rgba.length; i += 4) { rgba[i] = 128; rgba[i + 1] = 255; rgba[i + 2] = 128; rgba[i + 3] = 255; }
  } else {
    for (let i = 0; i < filled.length; i++) {
      if (filled[i]) continue;
      const x = i % w, y = (i / w) | 0;
      let best = 1e9, s = seeds[0];
      for (const k of seeds) {
        const sx = k % w, sy = (k / w) | 0, d = (sx - x) ** 2 + (sy - y) ** 2;
        if (d < best) { best = d; s = k; }
      }
      rgba[i * 4] = rgba[s * 4];
      rgba[i * 4 + 1] = rgba[s * 4 + 1];
      rgba[i * 4 + 2] = rgba[s * 4 + 2];
      rgba[i * 4 + 3] = 255;
    }
  }
  return { width: w, height: h, rgba, vertexNormals: loN };
}

export function decodeNormal(r, g, b) {
  return [r / 255 * 2 - 1, g / 255 * 2 - 1, b / 255 * 2 - 1];
}
