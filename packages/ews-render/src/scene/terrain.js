import { screenSpaceError } from '../math/sse.js';
import { PIXEL_LIMIT, HEIGHT_N, HEIGHT_COVER } from '../constants.js';

export function sampleHeight(field, x, z, cover = HEIGHT_COVER) {
  if (!field || !field.h) return 0;
  const n = field.n || HEIGHT_N, half = cover / 2;
  const u = (x / cover + 0.5) * (n - 1), v = (z / cover + 0.5) * (n - 1);
  const x0 = Math.max(0, Math.min(n - 2, Math.floor(u)));
  const z0 = Math.max(0, Math.min(n - 2, Math.floor(v)));
  const tx = u - x0, tz = v - z0;
  const h00 = field.h[z0 * n + x0] || 0, h10 = field.h[z0 * n + x0 + 1] || 0;
  const h01 = field.h[(z0 + 1) * n + x0] || 0, h11 = field.h[(z0 + 1) * n + x0 + 1] || 0;
  return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
}

export function morphFactor(geomErr, distance, fov, height, forceMax, pixelLimit = PIXEL_LIMIT) {
  if (forceMax) return 0;
  const px = screenSpaceError(geomErr, distance, fov, height);
  return Math.min(1, Math.max(0, (px - 0.35) / 0.65));
}

/**
 * GPU CDLOD / clipmap: rings of increasing size. Vertex morph is SSE-driven, not a fixed distance.
 * `apply` writes Y into `out` (or a new array) using the same math the terrain vertex shader uses.
 */
export function morphClipRing(opts) {
  const {
    positions, /* xz pairs or xyz */
    stride = 3,
    cx, cz, step,
    field, cover = HEIGHT_COVER,
    cam, fov, height, forceMax = false,
    geomErr,
  } = opts;
  const parentStep = step * 2;
  const d = Math.max(8, Math.hypot(cam[0] - cx, cam[2] - cz));
  const morph = morphFactor(geomErr, d, fov, height, forceMax);
  const out = opts.out || new Float32Array(positions.length);
  const count = positions.length / stride;
  for (let v = 0; v < count; v++) {
    const lx = positions[v * stride], lz = positions[v * stride + 2];
    const wx = lx + cx, wz = lz + cz;
    const yFine = sampleHeight(field, wx, wz, cover);
    const yCoarse = sampleHeight(field, Math.round(wx / parentStep) * parentStep, Math.round(wz / parentStep) * parentStep, cover);
    const y = yFine * (1 - morph) + yCoarse * morph;
    if (stride === 3) {
      out[v * 3] = lx; out[v * 3 + 1] = y; out[v * 3 + 2] = lz;
    } else {
      out[v * stride] = y;
    }
  }
  return { positions: out, morph, sse: screenSpaceError(geomErr, d, fov, height) };
}

export function clipRingGeomErr(size, seg) {
  return (size / seg) * 0.35;
}

export function heightTextureR32(field) {
  const n = field.n || HEIGHT_N;
  const data = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) data[i] = field.h?.[i] || 0;
  return { n, data };
}

export function makePlane(size, seg) {
  const pos = new Float32Array((seg + 1) * (seg + 1) * 3);
  const idx = new Uint32Array(seg * seg * 6);
  let p = 0;
  for (let z = 0; z <= seg; z++) for (let x = 0; x <= seg; x++) {
    pos[p++] = (x / seg - 0.5) * size;
    pos[p++] = 0;
    pos[p++] = (z / seg - 0.5) * size;
  }
  let i = 0;
  for (let z = 0; z < seg; z++) for (let x = 0; x < seg; x++) {
    const a = z * (seg + 1) + x, b = a + 1, c = a + (seg + 1), d = c + 1;
    idx[i++] = a; idx[i++] = c; idx[i++] = b;
    idx[i++] = b; idx[i++] = c; idx[i++] = d;
  }
  return { positions: pos, indices: idx, geomErr: clipRingGeomErr(size, seg) };
}
