import { octViewDir, octEncode } from '../math/octahedral.js';
import { IMPOSTOR_PX, PIXEL_LIMIT } from '../constants.js';
import { impostorBlend } from '../math/octahedral.js';

/**
 * Offline octahedral impostor atlas: color + linear depth + object-space normals.
 * Runtime uses this only when pixel-identical (last LOD SSE < 1 px and projected size < 2 px).
 */
export function bakeOctahedralImpostor(mesh, views = 8, tile = 32) {
  const n = views;
  const size = n * tile;
  const color = new Uint8Array(size * size * 4);
  const depth = new Float32Array(size * size);
  const normal = new Uint8Array(size * size * 4);
  const positions = mesh.positions;
  const indices = mesh.indices;
  const radius = mesh.radius || radiusOf(positions);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const dir = octViewDir(i, j, n);
    rasterTile(positions, indices, dir, radius, color, depth, normal, i * tile, j * tile, tile, size);
  }
  return {
    views: n,
    tile,
    size,
    color,
    depth,
    normal,
    radius,
    note: 'Use only when last LOD sse < 1 px and projected diameter < 2 px. Dither the crossfade.',
  };
}

function radiusOf(p) {
  let r = 0;
  for (let i = 0; i < p.length; i += 3) r = Math.max(r, Math.hypot(p[i], p[i + 1], p[i + 2]));
  return r || 1;
}

function rasterTile(pos, idx, dir, radius, color, depth, normal, ox, oy, tile, stride) {
  // Orthographic software raster of the mesh from `dir` into a tile. Enough for tests + distant cards.
  const zax = dir[0], zay = dir[1], zaz = dir[2];
  let xx = -zaz, xy = 0, xz = zax;
  let xl = Math.hypot(xx, xy, xz);
  if (xl < 1e-5) { xx = 1; xy = 0; xz = 0; xl = 1; }
  xx /= xl; xy /= xl; xz /= xl;
  const yx = zay * xz - zaz * xy, yy = zaz * xx - zax * xz, yz = zax * xy - zay * xx;
  const s = tile / (2 * radius * 1.05);
  const zbuf = new Float32Array(tile * tile);
  zbuf.fill(-Infinity);
  const tris = (idx.length / 3) | 0;
  for (let t = 0; t < tris; t++) {
    const ia = idx[t * 3], ib = idx[t * 3 + 1], ic = idx[t * 3 + 2];
    const A = project(pos, ia, xx, xy, xz, yx, yy, yz, zax, zay, zaz, s, tile);
    const B = project(pos, ib, xx, xy, xz, yx, yy, yz, zax, zay, zaz, s, tile);
    const C = project(pos, ic, xx, xy, xz, yx, yy, yz, zax, zay, zaz, s, tile);
    const nx = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (nx <= 0) continue; // backface in view
    const e1x = pos[ib * 3] - pos[ia * 3], e1y = pos[ib * 3 + 1] - pos[ia * 3 + 1], e1z = pos[ib * 3 + 2] - pos[ia * 3 + 2];
    const e2x = pos[ic * 3] - pos[ia * 3], e2y = pos[ic * 3 + 1] - pos[ia * 3 + 1], e2z = pos[ic * 3 + 2] - pos[ia * 3 + 2];
    let wx = e1y * e2z - e1z * e2y, wy = e1z * e2x - e1x * e2z, wz = e1x * e2y - e1y * e2x;
    const wl = Math.hypot(wx, wy, wz) || 1;
    wx /= wl; wy /= wl; wz /= wl;
    const minX = Math.max(0, Math.min(tile - 1, Math.floor(Math.min(A[0], B[0], C[0]))));
    const maxX = Math.max(0, Math.min(tile - 1, Math.ceil(Math.max(A[0], B[0], C[0]))));
    const minY = Math.max(0, Math.min(tile - 1, Math.floor(Math.min(A[1], B[1], C[1]))));
    const maxY = Math.max(0, Math.min(tile - 1, Math.ceil(Math.max(A[1], B[1], C[1]))));
    const area = edge(A, B, C) || 1;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const P = [x + 0.5, y + 0.5];
      const w0 = edge(B, C, P) / area, w1 = edge(C, A, P) / area, w2 = edge(A, B, P) / area;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * A[2] + w1 * B[2] + w2 * C[2];
      const zi = y * tile + x;
      if (z <= zbuf[zi]) continue;
      zbuf[zi] = z;
      const px = ox + x, py = oy + y, pi = (py * stride + px) * 4;
      const lambert = Math.max(0.15, wx * 0.35 + wy * 0.8 + wz * 0.15);
      color[pi] = Math.round(40 + lambert * 180);
      color[pi + 1] = Math.round(50 + lambert * 170);
      color[pi + 2] = Math.round(45 + lambert * 160);
      color[pi + 3] = 255;
      depth[py * stride + px] = (z / (2 * radius)) * 0.5 + 0.5;
      normal[pi] = Math.round((wx * 0.5 + 0.5) * 255);
      normal[pi + 1] = Math.round((wy * 0.5 + 0.5) * 255);
      normal[pi + 2] = Math.round((wz * 0.5 + 0.5) * 255);
      normal[pi + 3] = 255;
    }
  }
}

function project(pos, i, xx, xy, xz, yx, yy, yz, zx, zy, zz, s, tile) {
  const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
  return [
    (x * xx + y * xy + z * xz) * s + tile * 0.5,
    (x * yx + y * yy + z * yz) * s + tile * 0.5,
    x * zx + y * zy + z * zz,
  ];
}
function edge(a, b, c) { return (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]); }

export function shouldUseImpostor(projPx, lastSse, pixelLimit = PIXEL_LIMIT, impostorPx = IMPOSTOR_PX) {
  return impostorBlend(projPx, lastSse, pixelLimit, impostorPx) >= 1
    || (lastSse < pixelLimit && projPx < impostorPx);
}

export function sampleImpostorUV(dir, views) {
  const [u, v] = octEncode(dir[0], dir[1], dir[2]);
  return [u, v, views];
}
