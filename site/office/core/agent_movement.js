import { moveWithCollision, separateFromAgents } from './collision.js?v=1';

// Local reciprocal avoidance plus swept collision resolution. The caller supplies the
// frame's short desired step; this helper never changes targets or floor transitions.
export function createAgentMovement(ctx, { radius = 0.31, personalSpace = 0.58 } = {}) {
  const move = (av, dx, dz, distance) => {
    const len = Math.hypot(dx, dz); if (len < 1e-6 || distance <= 0) return 0;
    dx /= len; dz /= len;
    const agents = ctx.use('avatar')?.all || [], allColliders = ctx.getColliders?.() || ctx.colliders || [];
    const reach = distance + personalSpace + radius;
    const colliders = allColliders.filter(r => r[2] >= av.position.x - reach && r[0] <= av.position.x + reach && r[3] >= av.position.z - reach && r[1] <= av.position.z + reach);
    const neighbors = [];
    let ax = 0, az = 0;
    for (const other of agents) {
      // Renderer visibility is view-frustum culling; off-camera agents still occupy space.
      if (other === av || !other.parent || Math.abs((other.position.y || 0) - (av.position.y || 0)) > 1.2) continue;
      const ox = av.position.x - other.position.x, oz = av.position.z - other.position.z, d = Math.hypot(ox, oz);
      if (d <= personalSpace + distance + 0.4) neighbors.push(other);
      if (d > 1.25) continue;
      if (d < 1e-5) { const h = String(av.userData.a?.id || '').length * 1.618; ax += Math.cos(h); az += Math.sin(h); }
      else { const weight = (1.25 - d) / 1.25; ax += ox / d * weight; az += oz / d * weight; }
    }
    // Avoidance bends the heading around nearby bodies while retaining forward intent.
    let sx = dx + ax * 0.8, sz = dz + az * 0.8, sl = Math.hypot(sx, sz);
    if (sl > 1e-5) { sx /= sl; sz /= sl; } else { sx = dx; sz = dz; }
    const candidates = [[sx, sz], [dx, dz], [dx - dz * 0.55, dz + dx * 0.55], [dx + dz * 0.55, dz - dx * 0.55]];
    let best = { x: av.position.x, z: av.position.z }, bestScore = -Infinity;
    for (const [cx0, cz0] of candidates) {
      const cl = Math.hypot(cx0, cz0), cx = cx0 / cl, cz = cz0 / cl;
      let p = moveWithCollision(av.position, cx * distance, cz * distance, colliders, radius);
      separateFromAgents(p, neighbors, av, personalSpace);
      p = moveWithCollision(p, 0, 0, colliders, radius);
      const mx = p.x - av.position.x, mz = p.z - av.position.z, progress = mx * dx + mz * dz;
      const score = progress + Math.hypot(mx, mz) * 0.08;
      if (score > bestScore) { best = p; bestScore = score; }
    }
    const moved = Math.hypot(best.x - av.position.x, best.z - av.position.z);
    av.position.x = best.x; av.position.z = best.z;
    return moved;
  };
  return { move, radius, personalSpace };
}
