// ews-office-limiter: one Durable Object per visitor key (IP). Atomic, strongly consistent counters, so per-visitor
// limits hold no matter which Cloudflare isolate or colo serves the request. Used by Pages Functions via the
// OFFICE_RL Durable Object binding. Also hosts a single "global" object for the daily $ budget.
export class Limiter {
  constructor(state) { this.state = state; }
  async fetch(req) {
    if (new URL(req.url).pathname.startsWith('/tts/')) return this.tts(req);
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
/* Piper TTS store (one object, idFromName('tts')): queue + rendered audio, strongly consistent, so the voice is ready the
   moment CT111 posts it (KV's eventual consistency and cached misses made it ~2 min). Audio is chunked (DO value cap 128 KiB),
   kept 24 h, max 300 clips. */
Limiter.prototype.tts = async function (req) {
  const u = new URL(req.url), op = u.pathname.slice(5), st = this.state.storage, now = Date.now();
  if (op === 'enqueue') { const j = await req.json(); if (await st.get('m:' + j.h)) return Response.json({ ready: true });
    const q = ((await st.get('q')) || []).filter(x => x.h !== j.h && now - x.t < 600e3).slice(-30); q.push({ ...j, t: now }); await st.put('q', q); return Response.json({ ready: false }); }
  if (op === 'take') { const q = (await st.get('q')) || []; await st.put('q', []); return Response.json({ jobs: q }); }
  if (op === 'put') { const { h, b64 } = await req.json(); const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), C = 120000, n = Math.ceil(bin.length / C), w = {};
    for (let i = 0; i < n; i++) w['a:' + h + ':' + i] = bin.slice(i * C, (i + 1) * C); w['m:' + h] = { n, t: now }; await st.put(w);
    const idx = ((await st.get('idx')) || []).filter(x => x !== h); idx.push(h); const old = idx.splice(0, Math.max(0, idx.length - 300));
    for (const o of old) { const m = await st.get('m:' + o); if (m) await st.delete(['m:' + o, ...Array.from({ length: m.n }, (_, i) => 'a:' + o + ':' + i)]); }
    await st.put('idx', idx); return Response.json({ ok: true }); }
  if (op === 'get') { const h = u.searchParams.get('h'), m = await st.get('m:' + h); if (!m || now - m.t > 864e5) return new Response(null, { status: 202 });
    const parts = await st.get(Array.from({ length: m.n }, (_, i) => 'a:' + h + ':' + i)); const out = new Uint8Array([...parts.values()].reduce((a, b) => a + b.length, 0)); let o = 0; for (const b of parts.values()) { out.set(b, o); o += b.length; }
    return new Response(out, { headers: { 'content-type': 'audio/mpeg' } }); }
  return new Response('no', { status: 404 });
};
export default { fetch: () => new Response('ews-office-limiter', { status: 404 }) };
