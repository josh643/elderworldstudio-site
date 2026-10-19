// Shared lightweight collision response for moving office agents. The engine owns the
// world collider list; this module routes agent steps through that same resolver.
export default {
  setup(ctx) {
    const stats = { moves: 0, contacts: 0, worldContacts: 0, agentContacts: 0, correctedM: 0, maxMoveMs: 0, moveMs: 0, sampledAt: 0 };
    const apply = (actor, dx, dz, commit, options = {}) => {
      if (!actor?.position || !Number.isFinite(dx) || !Number.isFinite(dz)) return null;
      const p = actor.position.clone(), x0 = p.x, z0 = p.z, requested = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(requested / 0.12));
      const seatIndex = options.seat?.i;
      const allowSeat = Number.isInteger(seatIndex) ? c => c.src?.startsWith('inst:chairs:') && c.src.endsWith('#' + seatIndex) : null;
      const t0 = performance.now(); let worldHits = 0, agentHits = 0;
      for (let i = 0; i < steps; i++) { p.x += dx / steps; p.z += dz / steps;
        const hits = ctx.collide?.(p, false, actor, allowSeat) || { worldHits: 0, agentHits: 0 }; worldHits += hits.worldHits; agentHits += hits.agentHits; }
      const elapsed = performance.now() - t0;
      const actual = Math.hypot(p.x - x0, p.z - z0), corrected = Math.hypot(p.x - (x0 + dx), p.z - (z0 + dz));
      if (commit) {
        actor.position.x = p.x; actor.position.z = p.z;
        stats.moves++; stats.contacts += corrected > 0.001 ? 1 : 0; stats.worldContacts += worldHits ? 1 : 0; stats.agentContacts += agentHits ? 1 : 0;
        stats.correctedM += corrected; stats.moveMs += elapsed; stats.maxMoveMs = Math.max(stats.maxMoveMs, elapsed); stats.sampledAt = performance.now();
      }
      return { x: p.x, z: p.z, requested, actual, correction: corrected, blocked: corrected > 0.001, worldHits, agentHits, substeps: steps, ms: elapsed };
    };
    const api = {
      move(actor, dx, dz, options) { return apply(actor, dx, dz, true, options); },
      probe(actor, dx, dz) { return apply(actor, dx, dz, false); },
      snapshot() {
        return { ...stats, fps: ctx.performanceMetrics?.fps || 0, avgMoveMs: stats.moves ? stats.moveMs / stats.moves : 0,
          colliders: ctx.colliders?.length || 0, agents: ctx.use('avatar')?.all?.length || 0 };
      },
    };
    ctx.provide('worldPhysics', api);
    this.api = api;
  },
  onFrame() {
    if (!window.__ewsOffice || !this.api) return;
    window.__ewsOffice.physics = () => this.api.snapshot();
    window.__ewsOffice.fps = () => this.api.snapshot().fps;
  },
};
