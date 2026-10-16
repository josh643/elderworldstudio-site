// ews-office-limiter: one Durable Object per visitor key (IP). Atomic, strongly consistent counters, so per-visitor
// limits hold no matter which Cloudflare isolate or colo serves the request. Used by Pages Functions via the
// OFFICE_RL Durable Object binding. Also hosts a single "global" object for the daily $ budget.
export class Limiter {
  constructor(state) { this.state = state; }
  async fetch(req) {
    const u = new URL(req.url), rules = JSON.parse(u.searchParams.get('rules') || '[]'), now = Date.now();
    let ok = true, retry = 0; const data = (await this.state.storage.get('w')) || {};
    for (const [name, limit, windowMs] of rules) {
      const w = data[name] && now < data[name].reset ? data[name] : { n: 0, reset: now + windowMs };
      if (w.n >= limit) { ok = false; retry = Math.max(retry, w.reset - now); }
      data[name] = w;
    }
    if (ok) for (const [name] of rules) data[name].n++;
    if (u.searchParams.has('add')) { const k = 'spend:' + new Date().toISOString().slice(0, 10); data[k] = { n: (data[k]?.n || 0) + Number(u.searchParams.get('add')), reset: now + 3 * 864e5 }; }
    await this.state.storage.put('w', data);
    const spentKey = 'spend:' + new Date().toISOString().slice(0, 10);
    return Response.json({ ok, retryMs: retry, spent: data[spentKey]?.n || 0, remaining: Object.fromEntries(rules.map(([n, l]) => [n, l - data[n].n])) });
  }
}
export default { fetch: () => new Response('ews-office-limiter', { status: 404 }) };
