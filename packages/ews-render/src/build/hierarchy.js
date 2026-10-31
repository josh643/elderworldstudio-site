import { buildMeshlets, geometricError } from './meshlets.js';
import { MESHLET_TRIS } from '../constants.js';

function quantize(positions, cells) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }
  const dx = maxX - minX || 1, dy = maxY - minY || 1, dz = maxZ - minZ || 1;
  const keyOf = (x, y, z) => {
    const qx = Math.round((x - minX) / dx * cells);
    const qy = Math.round((y - minY) / dy * cells);
    const qz = Math.round((z - minZ) / dz * cells);
    return qx + ',' + qy + ',' + qz;
  };
  const map = new Map();
  const out = [];
  const remap = new Uint32Array(positions.length / 3);
  for (let i = 0, v = 0; i < positions.length; i += 3, v++) {
    const k = keyOf(positions[i], positions[i + 1], positions[i + 2]);
    if (!map.has(k)) {
      map.set(k, out.length / 3);
      out.push(positions[i], positions[i + 1], positions[i + 2]);
    }
    remap[v] = map.get(k);
  }
  return { positions: new Float32Array(out), remap };
}

function remapIndices(indices, remap) {
  const out = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = remap[indices[i]], b = remap[indices[i + 1]], c = remap[indices[i + 2]];
    if (a === b || b === c || a === c) continue;
    const t = [a, b, c].sort((x, y) => x - y).join(',');
    out.push(a, b, c, t);
  }
  const seen = new Set();
  const idx = [];
  for (let i = 0; i < out.length; i += 4) {
    const t = out[i + 3];
    if (seen.has(t)) continue;
    seen.add(t);
    idx.push(out[i], out[i + 1], out[i + 2]);
  }
  return new Uint32Array(idx);
}

/**
 * Build a meshlet LOD hierarchy. LOD0 is the source mesh; coarser levels quantize
 * positions and keep the measured geometric error vs LOD0.
 */
export function buildLodHierarchy(positions, indices, opts = {}) {
  const levelsN = opts.levels || 4;
  const maxTris = opts.maxTris || MESHLET_TRIS;
  const cells = opts.cells || [0, 48, 20, 10];
  const hi = positions instanceof Float32Array ? positions : new Float32Array(positions);
  const hiIdx = indices instanceof Uint32Array ? indices : new Uint32Array(indices);
  const levels = [];
  let curPos = hi, curIdx = hiIdx;
  for (let lod = 0; lod < levelsN; lod++) {
    if (lod > 0) {
      const q = quantize(hi, cells[lod] || Math.max(4, 48 >> lod));
      curPos = q.positions;
      curIdx = remapIndices(hiIdx, q.remap);
    }
    const set = buildMeshlets(curPos, curIdx, Math.max(8, maxTris >> lod));
    const geomErr = lod === 0 ? 0 : geometricError(hi, curPos);
    levels.push({
      lod,
      geomErr,
      meshlets: set.count,
      clusters: set.meshlets,
      positions: curPos,
      indices: set.indices,
      vertexCount: curPos.length / 3,
      triangleCount: set.indices.length / 3,
    });
  }
  return {
    radius: radiusOf(hi),
    levels,
    srcTriangles: hiIdx.length / 3,
    srcVertices: hi.length / 3,
  };
}

function radiusOf(p) {
  let r = 0;
  for (let i = 0; i < p.length; i += 3) r = Math.max(r, Math.hypot(p[i], p[i + 1], p[i + 2]));
  return r;
}

/** Unit box / icosphere proxies used when a catalog GLB is missing. */
export function primitiveMesh(kind) {
  if (kind === 'sphere' || kind === 'tree' || kind === 'shrub') return icosphere(2);
  if (kind === 'cyl' || kind === 'well' || kind === 'pad') return cylinder(10, 0.5, 1);
  return box(1, 1, 1);
}

export function box(w, h, d) {
  const x = w / 2, y = h / 2, z = d / 2;
  const p = [
    -x, -y, -z, x, -y, -z, x, y, -z, -x, y, -z,
    -x, -y, z, x, -y, z, x, y, z, -x, y, z,
  ];
  const idx = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7,
    0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2,
  ];
  return { positions: new Float32Array(p), indices: new Uint32Array(idx) };
}

export function cylinder(seg, r, h) {
  const p = [0, -h / 2, 0, 0, h / 2, 0];
  const idx = [];
  for (let i = 0; i < seg; i++) {
    const a = i / seg * Math.PI * 2;
    p.push(Math.cos(a) * r, -h / 2, Math.sin(a) * r);
    p.push(Math.cos(a) * r, h / 2, Math.sin(a) * r);
  }
  for (let i = 0; i < seg; i++) {
    const a = 2 + i * 2, b = 2 + ((i + 1) % seg) * 2;
    idx.push(0, b, a, 1, a + 1, b + 1, a, b, b + 1, a, b + 1, a + 1);
  }
  return { positions: new Float32Array(p), indices: new Uint32Array(idx) };
}

export function icosphere(sub) {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(v => {
    const l = Math.hypot(...v); return v.map(c => c / l);
  });
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const mid = new Map();
  const midpoint = (a, b) => {
    const k = a < b ? a + ':' + b : b + ':' + a;
    if (mid.has(k)) return mid.get(k);
    const va = verts[a], vb = verts[b];
    const m = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
    const l = Math.hypot(...m);
    const i = verts.length;
    verts.push(m.map(c => c / l));
    mid.set(k, i);
    return i;
  };
  for (let s = 0; s < sub; s++) {
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => { positions[i * 3] = v[0]; positions[i * 3 + 1] = v[1]; positions[i * 3 + 2] = v[2]; });
  return { positions, indices: new Uint32Array(faces.flat()) };
}
