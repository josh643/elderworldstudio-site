import { blocksPoint, lineClear } from './collision.js?v=1';

// Lightweight, bounded 8-way A* over the existing world collider rectangles. Routes are
// built only when an agent receives a destination; no per-frame grid or mesh work is done.
export function createWorldNav(getColliders, { cell = 0.55, radius = 0.32, margin = 5, maxCells = 50000 } = {}) {
  const rectsFor = (a, b) => (getColliders?.() || []).filter(r => !r?.src?.startsWith?.('inst:chairs:') && r?.src !== 'dynamic-door' &&
    r[2] >= Math.min(a.x, b.x) - margin && r[0] <= Math.max(a.x, b.x) + margin &&
    r[3] >= Math.min(a.z, b.z) - margin && r[1] <= Math.max(a.z, b.z) + margin);
  const route = (a, b, options = {}) => {
    const r = rectsFor(a, b), rad = options.radius ?? radius;
    if (lineClear(a, b, r, rad)) return [];
    const x0 = Math.floor((Math.min(a.x, b.x) - margin) / cell) * cell;
    const z0 = Math.floor((Math.min(a.z, b.z) - margin) / cell) * cell;
    const w = Math.ceil((Math.max(a.x, b.x) + margin - x0) / cell) + 1;
    const h = Math.ceil((Math.max(a.z, b.z) + margin - z0) / cell) + 1;
    if (w * h > maxCells) return null;
    const count = w * h, blocked = new Uint8Array(count), g = new Float32Array(count), came = new Int32Array(count), closed = new Uint8Array(count);
    g.fill(Infinity); came.fill(-1);
    const ix = (x, z) => Math.max(0, Math.min(w - 1, Math.round((x - x0 - cell / 2) / cell)));
    const iz = (z) => Math.max(0, Math.min(h - 1, Math.round((z - z0 - cell / 2) / cell)));
    const id = (x, z) => z * w + x, px = i => x0 + (i % w) * cell + cell / 2, pz = i => z0 + Math.floor(i / w) * cell + cell / 2;
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (blocksPoint(px(id(x, z)), pz(id(x, z)), r, rad)) blocked[id(x, z)] = 1;
    const nearest = p => { const cx = ix(p.x, p.z), cz = iz(p.z); let best = -1, bd = Infinity;
      for (let ring = 0; ring <= 4 && best < 0; ring++) for (let z = Math.max(0, cz - ring); z <= Math.min(h - 1, cz + ring); z++) for (let x = Math.max(0, cx - ring); x <= Math.min(w - 1, cx + ring); x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) !== ring) continue; const k = id(x, z); if (blocked[k]) continue;
        const d = (px(k) - p.x) ** 2 + (pz(k) - p.z) ** 2; if (d < bd) { bd = d; best = k; } }
      return best; };
    const start = nearest(a), goal = nearest(b); if (start < 0 || goal < 0) return null;
    const heap = [], push = n => { let i = heap.length; heap.push(n); while (i) { const p = (i - 1) >> 1; if (heap[p].f <= n.f) break; heap[i] = heap[p]; i = p; } heap[i] = n; };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let i = 0; while (true) { let c = i * 2 + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++; if (heap[c].f >= last.f) break; heap[i] = heap[c]; i = c; } heap[i] = last; } return top; };
    const heuristic = i => Math.hypot(px(i) - px(goal), pz(i) - pz(goal));
    g[start] = 0; push({ i: start, f: heuristic(start) });
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false, visits = 0;
    while (heap.length && visits < count) {
      const cur = pop().i; if (closed[cur]) continue; closed[cur] = 1; visits++;
      if (cur === goal) { found = true; break; }
      const cx = cur % w, cz = Math.floor(cur / w);
      for (const [dx, dz, cost] of dirs) { const nx = cx + dx, nz = cz + dz; if (nx < 0 || nx >= w || nz < 0 || nz >= h) continue; const ni = id(nx, nz); if (blocked[ni] || closed[ni]) continue;
        if (dx && dz && (blocked[id(cx + dx, cz)] || blocked[id(cx, cz + dz)])) continue;
        const ng = g[cur] + cell * cost; if (ng >= g[ni]) continue; came[ni] = cur; g[ni] = ng; push({ i: ni, f: ng + heuristic(ni) }); }
    }
    if (!found) return null;
    const chain = []; for (let at = goal; at !== start && at >= 0; at = came[at]) chain.push({ x: px(at), z: pz(at) }); chain.reverse();
    if (!chain.length) return lineClear(a, b, r, rad) ? [] : null;
    // Greedy line-of-sight smoothing keeps short, stable waypoint lists without cutting corners.
    const smooth = []; let from = a, i = 0;
    while (i < chain.length) { let j = chain.length - 1; while (j > i && !lineClear(from, chain[j], r, rad)) j--; smooth.push(chain[j]); from = chain[j]; i = j + 1; }
    const gap = Math.hypot(from.x - b.x, from.z - b.z);
    if (lineClear(from, b, r, rad)) {
      if (gap > cell * 0.35) smooth.push({ x: b.x, z: b.z });
      else if (smooth.length) smooth[smooth.length - 1] = { x: b.x, z: b.z };
    } else {
      // A target can sit just inside an expanded collider (for example, an authored
      // chair anchor). Stop at the last clear cell instead of snapping into the obstacle.
      if (!smooth.length || gap > cell * 2) return null;
      smooth.snapped = true;
    }
    return smooth;
  };
  return { route, cellSize: cell };
}
