// Shared 2D capsule collision helpers for office agents. The collider set is the same
// rectangle list the player uses, so navigation and movement agree about clear space.
export function blocksPoint(x, z, colliders, radius = 0.3) {
  for (const r of colliders || []) {
    if (r?.src?.startsWith?.('inst:chairs:')) continue; // reserved chair seats are walk-up destinations
    if (x >= r[0] - radius && x <= r[2] + radius && z >= r[1] - radius && z <= r[3] + radius) return true;
  }
  return false;
}

export function lineClear(a, b, colliders, radius = 0.3, step = 0.16) {
  const dx = b.x - a.x, dz = b.z - a.z, n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / step));
  for (let i = 1; i < n; i++) if (blocksPoint(a.x + dx * i / n, a.z + dz * i / n, colliders, radius)) return false;
  return !blocksPoint(b.x, b.z, colliders, radius);
}

// Resolve a capsule against expanded collider rectangles. Iteration preserves wall sliding
// and the small substeps prevent fast agents tunnelling through a thin door or partition.
export function moveWithCollision(from, dx, dz, colliders, radius = 0.3, maxStep = 0.12) {
  const p = { x: from.x, z: from.z }, n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / maxStep));
  for (let s = 1; s <= n; s++) {
    p.x += dx / n; p.z += dz / n;
    for (let it = 0; it < 3; it++) {
      let changed = false;
      for (const r of colliders || []) {
        if (r?.src?.startsWith?.('inst:chairs:')) continue;
        const x0 = r[0] - radius, z0 = r[1] - radius, x1 = r[2] + radius, z1 = r[3] + radius;
        if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
        const d = [p.x - x0, x1 - p.x, p.z - z0, z1 - p.z], k = d.indexOf(Math.min(...d));
        if (k === 0) p.x = x0 - 0.002; else if (k === 1) p.x = x1 + 0.002; else if (k === 2) p.z = z0 - 0.002; else p.z = z1 + 0.002;
        changed = true;
      }
      if (!changed) break;
    }
  }
  return p;
}

export function separateFromAgents(p, agents, self, radius = 0.58) {
  for (let it = 0; it < 3; it++) for (const av of agents || []) {
    // `visible` is camera culling in the office renderer, not an agent lifecycle flag.
    if (av === self || !av.parent || Math.abs((av.position.y || 0) - (self?.position?.y || 0)) > 1.2) continue;
    let dx = p.x - av.position.x, dz = p.z - av.position.z, d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 < 1e-8) { // deterministic tie break so two exactly overlapping agents can separate
      const h = String(self?.userData?.a?.id || '').split('').reduce((n, c) => n + c.charCodeAt(0), 0);
      const a = ((h % 360) * Math.PI) / 180; dx = Math.cos(a); dz = Math.sin(a); d2 = 1;
    }
    const d = Math.sqrt(d2), push = radius - d + 0.003;
    p.x += dx / d * push; p.z += dz / d * push;
  }
  return p;
}
