// Live status feature: polls the edge-cached sanitized snapshot and broadcasts it to every module's onState().
// Multiplayer later: replace polling with a Durable Object room WebSocket that pushes the same snapshot shape.
export default {
  setup(ctx, cfg) {
    const poll = async () => {
      if (!ctx.state) return setTimeout(poll, 500);
      try { const r = await fetch(cfg.url || '/api/office/state', { cache: 'no-store' }); if (r.ok) { const s = await r.json(); ctx.state(s); const n = (s.work || []).length; ctx.setTitle(`Elder World Studio · ${n} agent${n === 1 ? '' : 's'} at work`); ctx.announce(`${n} agents working right now.`); } } catch {}
      setTimeout(poll, cfg.everyMs || 15000);
    };
    setTimeout(poll, 300);
  },
};
