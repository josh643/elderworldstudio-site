// Elderverse live world state (2026-10-16). One object per environment (idFromName('world:<mode>')), hosted by the Limiter class
// so no new Durable Object namespace/migration is needed. Holds town lots, roads and buildings with their construction stage and
// progress, and pushes deltas to every connected visitor over hibernatable WebSockets (idle sockets cost nothing).
// Inputs (all pre-validated by the Pages Function in functions/api/office/world*.js):
//   POST /world/event  {type:'lot.lease'|'site.progress'|'lot.release'|'road.upsert'|'road.progress'|'road.remove'|'agent.pose'|'agent.gone', ...}
//   (shared schema: incoming/world-server/DELTA-SCHEMA.md + schema.ts, CT119 ews-world is the authoritative publisher)
//   POST /world/demo   {lot, secs}  staging-only simulated lease + build (alarm-driven); {clear:true} removes demo entities
//   GET  /world/state  snapshot   ·   GET /world/ws  WebSocket (snap on connect, then {t:'delta'})
// Never touches store or user data: this object only knows lots/roads/buildings.
export const BUILD = ['survey', 'groundwork', 'foundation', 'framing', 'walls', 'glazing', 'signage', 'landscaping', 'open'];
export const ROAD = ['survey', 'grading', 'base', 'paving', 'striping', 'open'];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));

async function load(st) { return (await st.get('world')) || { seq: 0, ents: {} }; }
function stamp(e, stages, ev, now) {
  // progress model: si = stage index, p = progress inside that stage (both REAL, from the pipeline). Optional next = {o, eta}: the
  // pipeline's own estimate of where it will be (overall 0..1) in eta seconds; clients creep toward it but never past it.
  const N = stages.length - 1;
  if (ev.overall != null) { const o = clamp(ev.overall); e.si = Math.min(N, Math.floor(o * N + 1e-9)); e.p = e.si >= N ? 1 : +(o * N - e.si).toFixed(4); }
  else { if (ev.stage != null) { const i = stages.indexOf(ev.stage); if (i >= 0) e.si = i; } if (ev.progress != null) e.p = clamp(ev.progress); }
  if (e.si >= N) { e.si = N; e.p = 1; }
  e.at = now; e.next = ev.next && ev.next.eta > 0 ? { o: clamp(ev.next.o), eta: Math.min(3600, Math.floor(ev.next.eta)) } : null;
}
function applyEvent(w, ev, now) {
  const up = [], rm = [];
  if (ev.type === 'lot.lease' || ev.type === 'site.progress') {
    const id = 'lot:' + ev.lot; let e = w.ents[id];
    if (!e) { if (ev.type !== 'lot.lease') return { up, rm }; e = w.ents[id] = { id, kind: 'site', lot: ev.lot, si: 0, p: 0, since: now }; }
    if (ev.type === 'lot.lease') { Object.assign(e, { tenant: ev.tenant || '', public: !!ev.public, style: ev.style || e.style || {}, parts: ev.parts || e.parts || {}, demo: !!ev.demo });
      if (ev.overall == null && ev.stage == null) { ev = { ...ev, stage: 'survey', progress: 0 }; } }
    stamp(e, BUILD, ev, now); up.push(e);
  } else if (ev.type === 'lot.release') { const id = 'lot:' + ev.lot; if (w.ents[id]) { delete w.ents[id]; rm.push(id); } }
  else if (ev.type === 'road.upsert' || ev.type === 'road.progress') {
    const id = 'road:' + ev.id; let e = w.ents[id];
    if (!e) { if (ev.type !== 'road.upsert') return { up, rm }; e = w.ents[id] = { id, kind: 'road', si: 0, p: 0, since: now }; }
    if (ev.type === 'road.upsert') Object.assign(e, { name: ev.name || e.name || 'Road works', a: ev.a || e.a, b: ev.b || e.b, w: ev.w || e.w || 8, resurface: !!ev.resurface, demo: !!ev.demo });
    stamp(e, ROAD, ev, now); up.push(e);
  } else if (ev.type === 'road.remove') { const id = 'road:' + ev.id; if (w.ents[id]) { delete w.ents[id]; rm.push(id); } }
  // agent poses decided by the CT119 world server (schema v1 extension): zone-local x/z, heading, activity, optional walk target + speed
  else if (ev.type === 'agent.pose') { for (const p of ev.poses || []) { const id = 'agent:' + p.id; const e = w.ents[id] || (w.ents[id] = { id, kind: 'agent', si: 0, p: 0, at: now, since: now });
      for (const k of ['to', 'v', 'lot']) delete e[k]; Object.assign(e, p, { id, kind: 'agent', at: now }); up.push(e); } }
  else if (ev.type === 'agent.gone') { const id = 'agent:' + ev.id; if (w.ents[id]) { delete w.ents[id]; rm.push(id); } }
  return { up, rm };
}

export async function world(state, req) {
  const u = new URL(req.url), op = u.pathname.slice(7), st = state.storage, now = Date.now();
  if (op === 'ws') {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    if (state.getWebSockets('world').length >= 2000) return new Response('busy', { status: 503 });
    const pair = new WebSocketPair(); state.acceptWebSocket(pair[1], ['world']);
    const w = await load(st); pair[1].send(JSON.stringify({ t: 'snap', seq: w.seq, now, ents: Object.values(w.ents), build: BUILD, road: ROAD }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  if (op === 'state') { const w = await load(st); return Response.json({ t: 'snap', seq: w.seq, now, ents: Object.values(w.ents), build: BUILD, road: ROAD, viewers: state.getWebSockets('world').length }); }
  if (op === 'event' && req.method === 'POST') {
    const evs = [].concat(await req.json()).slice(0, 50); const w = await load(st); const up = new Map(), rm = new Set();
    for (const ev of evs) { const r = applyEvent(w, ev, now); r.up.forEach(e => up.set(e.id, e)); r.rm.forEach(id => { rm.add(id); up.delete(id); }); }
    if (!up.size && !rm.size) return Response.json({ ok: true, changed: 0, seq: w.seq });
    w.seq++; await st.put('world', w); broadcast(state, { t: 'delta', seq: w.seq, now, up: [...up.values()], rm: [...rm] });
    return Response.json({ ok: true, changed: up.size + rm.size, seq: w.seq });
  }
  if (op === 'demo' && req.method === 'POST') {
    const j = await req.json().catch(() => ({})), w = await load(st);
    if (j.clear) { const ids = Object.keys(w.ents).filter(k => w.ents[k].demo); ids.forEach(k => delete w.ents[k]); await st.delete('demo'); w.seq++; await st.put('world', w);
      broadcast(state, { t: 'delta', seq: w.seq, now, up: [], rm: ids }); return Response.json({ ok: true, cleared: ids.length }); }
    const prev = await st.get('demo'); if (prev && now - prev.t0 < 60e3) return Response.json({ ok: false, error: 'a demo just started; try again in a minute', retryMs: 60e3 - (now - prev.t0) }, { status: 429 });
    const lot = j.lot || 9, secs = Math.max(60, Math.min(900, j.secs || 240)), dir = j.dir === 1 ? 1 : -1;
    if (w.ents['lot:' + lot] && !w.ents['lot:' + lot].demo) return Response.json({ ok: false, error: 'lot ' + lot + ' is leased for real; pick another' }, { status: 409 });
    const demo = { t0: now, secs, lot, road: j.road || null, done: false }; await st.put('demo', demo);
    const evs = [{ type: 'lot.lease', lot, tenant: j.tenant || 'Demo Shop', public: true, demo: true, style: j.style || { floors: 2, color: 'sandstone', kind: 'shop' }, parts: j.parts || {}, stage: 'survey', progress: 0 }];
    if (demo.road) evs.push({ type: 'road.upsert', id: 'demo-ave', name: demo.road.name || 'Avenue resurfacing', a: demo.road.a, b: demo.road.b, w: demo.road.w || 10, resurface: true, demo: true, stage: 'survey', progress: 0 });
    const up = []; for (const ev of evs) up.push(...applyEvent(w, ev, now).up); w.seq++; await st.put('world', w);
    broadcast(state, { t: 'delta', seq: w.seq, now, up, rm: [] }); await state.storage.setAlarm(now + 1500);
    return Response.json({ ok: true, lot, secs, seq: w.seq });
  }
  return new Response('no', { status: 404 });
}
function broadcast(state, msg) { const s = JSON.stringify(msg); for (const ws of state.getWebSockets('world')) { try { ws.send(s); } catch {} } }

// Demo driver (staging only): the ONE place progress is simulated. Ticks every 2 s; road runs over the first 60% of the build time.
// Each tick also sends next = where the demo will be at the following tick, so clients creep smoothly exactly like real pipelines.
export async function worldAlarm(state) {
  const st = state.storage, d = await st.get('demo'); if (!d || d.done) return; const now = Date.now(), w = await load(st);
  const T = (now - d.t0) / 1000, o = clamp(T / d.secs), step = 2, on = clamp((T + step) / d.secs), evs = [];
  if (w.ents['lot:' + d.lot]?.demo) evs.push({ type: 'site.progress', lot: d.lot, overall: o, next: o < 1 ? { o: on, eta: step } : null });
  if (d.road && w.ents['road:demo-ave']) { const ro = clamp(T / (d.secs * 0.6)), rn = clamp((T + step) / (d.secs * 0.6)); evs.push({ type: 'road.progress', id: 'demo-ave', overall: ro, next: ro < 1 ? { o: rn, eta: step } : null }); }
  const up = []; for (const ev of evs) up.push(...applyEvent(w, ev, now).up);
  if (up.length) { w.seq++; await st.put('world', w); broadcast(state, { t: 'delta', seq: w.seq, now, up, rm: [] }); }
  if (o >= 1) { d.done = true; await st.put('demo', d); return; }
  await st.setAlarm(now + step * 1000);
}
