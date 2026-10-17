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
// Layout gate (Joshua 2026-10-16 11:20 PM: "redo the layout first, not start building first"). Until Anna sets an approved town layout
// (w.layout = {approved:true, version, by, at} via a 'layout.approve' event with the office ingest key), every site, road and zone is held at
// stage 0 (survey: stakes, tape, tripod, planning) no matter what the pipeline or demo posts. Agents keep walking, surveying and patrolling.
const gated = w => !(w.layout && w.layout.approved);
function freeze(e) { e.next = null; e.hold = true; if (!e.frozen) { e.frozen = true; e.fsi = e.si; e.fp = e.p; } }
// Odin layout approval (Joshua 2026-10-17 00:27). layout.approve is accepted ONLY when: the referenced spec was registered by Ve's pipeline
// (ARCH_SPEC_KEY) with verdict PASS and genuine_agent_design true (read from the stored record here, never from the request), it is the
// registered LATEST-REDESIGN, and it moves, resizes or reassigns no currently leased lot. Every approval/revoke is appended to 'approvals'.
export function approveCheck(w, rec, latest, geo) {
  if (!rec) return 'spec not registered by the architecture pipeline';
  if (rec.verdict !== 'PASS') return 'Ve verdict is ' + (rec.verdict || 'missing') + ', not PASS';
  if (rec.genuine !== true) return 'spec is not a genuine agent design';
  if (rec.id !== latest) return 'spec is not the current LATEST-REDESIGN (' + (latest || 'none') + ')';
  const lots = rec.lots || [], same = (a, b) => a && b && a.length === 4 && a.every((v, i) => Math.abs(v - b[i]) < 0.01);
  for (const e of Object.values(w.ents)) { if (!e.leased) continue;
    const l = lots.find(x => x.n === e.lot); if (!l) return 'leased lot ' + e.lot + ' is missing from the spec';
    if (l.tenant && e.tenantId && l.tenant !== e.tenantId) return 'spec reassigns leased lot ' + e.lot;
    const g = (geo || {})[e.lot]; if (g && !same(l.rect, g)) return 'spec moves or resizes leased lot ' + e.lot; }
  return null;
}
function hold(w, e) { if (gated(w) && e.kind !== 'agent' && e.frozen) { e.si = e.fsi; e.p = e.fp; e.next = null; e.hold = true; return; }   // revoked: frozen at its stage, never rolled back
  if (gated(w) && e.kind !== 'agent') { if (e.si > 0) { e.si = 0; e.p = 0.99; } e.p = Math.min(e.p, 0.99); e.next = null; e.hold = true; } else delete e.hold; }   // 0.99: fully staked, never rolls into ground prep
function applyEvent(w, ev, now) {
  const up = [], rm = [];
  if (ev.type === 'layout.approve') { w.layout = { approved: true, version: ev.version, by: ev.by || 'odin', at: now, why: String(ev.why || '').slice(0, 600), revokeBy: now + 864e5, guard: 'odin-v1' }; for (const e of Object.values(w.ents)) if (e.hold || e.frozen) { delete e.hold; delete e.frozen; delete e.fsi; delete e.fp; up.push(e); } return { up, rm, layout: true }; }
  if (ev.type === 'layout.revoke') { w.layout = { approved: false, version: null, by: ev.by || 'anna', at: now, revoked: (w.layout && w.layout.version) || null, why: String(ev.why || '').slice(0, 300) };
    for (const e of Object.values(w.ents)) { if (e.kind === 'agent') continue; freeze(e); /* revoke: freeze at current stage, nothing demolished */ e.at = now; up.push(e); } return { up, rm, layout: true }; }
  const r = applyEvent0(w, ev, now); for (const e of r.up) hold(w, e); return r;
}
// Leased-lot protection (Joshua HARD RULE 2026-10-17 00:00): agents run, fix and build the world but NEVER change a lot leased to a client
// (boundaries, building, content, signage, layout or data). A leased lot has leased:true + tenantId. Any event that would create, alter,
// progress or release it is refused (403) unless the Pages Function marked it lease_ok (client/owner key LEASE_EDIT_KEY, never an agent key).
// Engine/render/collision/perf bug fixes ship as code and never post lot events, so they cannot alter the client's stored content.
export function leaseGuard(w, ev) {
  if (!ev || !/^(lot\.|site\.)/.test(ev.type || '')) return null;
  const e = w.ents['lot:' + ev.lot];
  if (ev.lease_ok === true) return null;
  if (e && e.leased) return 'lot ' + ev.lot + ' is leased to ' + (e.tenantId || 'a client') + ': agents may not change it (client/owner authorization required)';
  if (ev.type === 'lot.lease' && ev.leased) return 'creating a client lease needs client/owner authorization';
  return null;
}
function applyEvent0(w, ev, now) {
  const up = [], rm = [];
  if (ev.type === 'lot.lease' || ev.type === 'site.progress') {
    const id = 'lot:' + ev.lot; let e = w.ents[id];
    if (!e) { if (ev.type !== 'lot.lease') return { up, rm }; e = w.ents[id] = { id, kind: 'site', lot: ev.lot, si: 0, p: 0, since: now }; }
    if (ev.type === 'lot.lease') { Object.assign(e, { tenant: ev.tenant || '', public: !!ev.public, style: ev.style || e.style || {}, parts: ev.parts || e.parts || {}, demo: !!ev.demo, arch: !!ev.arch, job: ev.job || e.job || '' }); if (ev.leased && ev.lease_ok === true) { e.leased = true; e.tenantId = ev.tenantId || e.tenantId || ''; }
      if (ev.overall == null && ev.stage == null) { ev = { ...ev, stage: 'survey', progress: 0 }; } }
    stamp(e, BUILD, ev, now); up.push(e);
  } else if (ev.type === 'lot.release') { const id = 'lot:' + ev.lot; if (w.ents[id]) { delete w.ents[id]; rm.push(id); } }
  else if (ev.type === 'road.upsert' || ev.type === 'road.progress') {
    const id = 'road:' + ev.id; let e = w.ents[id];
    if (!e) { if (ev.type !== 'road.upsert') return { up, rm }; e = w.ents[id] = { id, kind: 'road', si: 0, p: 0, since: now }; }
    if (ev.type === 'road.upsert') Object.assign(e, { name: ev.name || e.name || 'Road works', a: ev.a || e.a, b: ev.b || e.b, w: ev.w || e.w || 8, resurface: !!ev.resurface, demo: !!ev.demo });
    stamp(e, ROAD, ev, now); up.push(e);
  } else if (ev.type === 'road.remove') { const id = 'road:' + ev.id; if (w.ents[id]) { delete w.ents[id]; rm.push(id); } }
  // zone jobs (2026-10-16): work areas without a lot, e.g. 'campus ground floor' rebuild. rect in the campus frame (x right, z out of the
  // building, origin = lobby entrance centre), floor 'G'..'5'. Same stage list + progress model as buildings.
  else if (ev.type === 'zone.upsert' || ev.type === 'zone.progress') {
    const id = 'zone:' + ev.id; let e = w.ents[id];
    if (!e) { if (ev.type !== 'zone.upsert') return { up, rm }; e = w.ents[id] = { id, kind: 'zone', si: 0, p: 0, since: now }; }
    if (ev.type === 'zone.upsert') Object.assign(e, { name: ev.name || e.name || 'Work zone', rect: ev.rect || e.rect, floor: ev.floor || e.floor || 'G', arch: !!ev.arch, demo: !!ev.demo });
    stamp(e, BUILD, ev, now); up.push(e);
  } else if (ev.type === 'zone.remove') { const id = 'zone:' + ev.id; if (w.ents[id]) { delete w.ents[id]; rm.push(id); } }
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
    const w = await load(st); pair[1].send(JSON.stringify({ t: 'snap', seq: w.seq, now, layout: w.layout || { approved: false }, ents: Object.values(w.ents), build: BUILD, road: ROAD }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  if (op === 'state') { const w = await load(st); return Response.json({ t: 'snap', seq: w.seq, now, layout: w.layout || { approved: false }, ents: Object.values(w.ents), build: BUILD, road: ROAD, viewers: state.getWebSockets('world').length }); }
  if (op === 'event' && req.method === 'POST') {
    const evs = [].concat(await req.json()).slice(0, 50); const w = await load(st); const up = new Map(), rm = new Set();
    for (const ev of evs) if (ev && ev.type === 'layout.approve') {
      const rec = await st.get('spec:' + ev.version), latest = await st.get('spec:latest'), geo = (await st.get('lotgeo')) || {};
      const why = approveCheck(w, rec, latest, geo);
      const logA = async (x) => { const a = (await st.get('approvals')) || []; a.unshift(x); await st.put('approvals', a.slice(0, 50)); };
      if (why) { await logA({ t: 'refused', spec: ev.version, by: ev.by, at: now, reason: why }); return Response.json({ ok: false, error: 'layout approval refused: ' + why, guard: 'odin-v1' }, { status: 403 }); }
      for (const l of rec.lots || []) if (l.n) geo[l.n] = l.rect; await st.put('lotgeo', geo);
      await logA({ t: 'approved', spec: ev.version, by: ev.by, at: now, why: String(ev.why || '').slice(0, 600), revokeBy: now + 864e5 }); }
    for (const ev of evs) if (ev && ev.type === 'layout.revoke') { const a = (await st.get('approvals')) || []; a.unshift({ t: 'revoked', spec: (w.layout && w.layout.version) || null, by: ev.by, at: now, why: String(ev.why || '').slice(0, 300) }); await st.put('approvals', a.slice(0, 50)); }
    const refused = evs.map((ev, i) => [i, leaseGuard(w, ev)]).filter(x => x[1]); if (refused.length) return Response.json({ ok: false, error: 'leased lot protected', refused }, { status: 403 });
    let lay = false; for (const ev of evs) { const r = applyEvent(w, ev, now); if (r.layout) lay = true; r.up.forEach(e => up.set(e.id, e)); r.rm.forEach(id => { rm.add(id); up.delete(id); }); }
    if (lay) { if (!w.layout.approved) { await st.put('snap:' + now, { ...w, ents: { ...w.ents } }); await st.delete('demo'); await st.deleteAlarm(); }   // restorable snapshot + demo driver stopped
      w.seq++; await st.put('world', w); broadcast(state, { t: 'delta', seq: w.seq, now, layout: w.layout, up: [...up.values()], rm: [...rm] }); return Response.json({ ok: true, layout: w.layout, changed: up.size + rm.size, seq: w.seq }); }
    if (!up.size && !rm.size) return Response.json({ ok: true, changed: 0, seq: w.seq, guard: 'lease-v1' });
    w.seq++; await st.put('world', w); broadcast(state, { t: 'delta', seq: w.seq, now, up: [...up.values()], rm: [...rm] });
    return Response.json({ ok: true, changed: up.size + rm.size, seq: w.seq, guard: 'lease-v1' });
  }
  // spec registry (Pages checks ARCH_SPEC_KEY): {id, verdict, genuine, latest, lots:[{id, n?, rect, tenant?}], hash}
  if (op === 'spec' && req.method === 'POST') { const j = await req.json().catch(() => ({}));
    if (!/^[\w.:-]{1,64}$/.test(j.id || '')) return Response.json({ ok: false, error: 'bad id' }, { status: 400 });
    const rec = { id: j.id, verdict: j.verdict === 'PASS' ? 'PASS' : 'FAIL', genuine: j.genuine === true, hash: String(j.hash || '').slice(0, 64), at: now,
      lots: (j.lots || []).slice(0, 400).map(l => ({ id: String(l.id || '').slice(0, 40), n: Number.isInteger(l.n) ? l.n : null, rect: (l.rect || []).slice(0, 4).map(Number), tenant: l.tenant ? String(l.tenant).slice(0, 40) : null })) };
    await st.put('spec:' + rec.id, rec); if (j.latest === true) await st.put('spec:latest', rec.id);
    return Response.json({ ok: true, id: rec.id, verdict: rec.verdict, genuine: rec.genuine, latest: await st.get('spec:latest') }); }
  if (op === 'spec-latest' && req.method === 'POST') { const j = await req.json().catch(() => ({})); if (!(await st.get('spec:' + j.id))) return Response.json({ ok: false, error: 'unknown spec' }, { status: 404 }); await st.put('spec:latest', j.id); return Response.json({ ok: true, latest: j.id }); }
  if (op === 'approvals') { const w = await load(st); return Response.json({ ok: true, layout: w.layout || { approved: false }, latest: (await st.get('spec:latest')) || null, log: ((await st.get('approvals')) || []).slice(0, 20) }); }
  // release notice (staging deploys): every connected visitor re-checks /office/manifest.json now and hot-swaps what changed
  if (op === 'release' && req.method === 'POST') { const j = await req.json().catch(() => ({})); const msg = { t: 'release', now, code: String(j.code || '').slice(0, 16), modules: Object.keys(j.modules || {}).slice(0, 64), assets: (j.assets | 0) };
    await st.put('release', msg); broadcast(state, msg); return Response.json({ ok: true, viewers: state.getWebSockets('world').length }); }
  if (op === 'demo' && req.method === 'POST') {
    const j = await req.json().catch(() => ({})), w = await load(st);
    if (j.clear) { const ids = Object.keys(w.ents).filter(k => w.ents[k].demo); ids.forEach(k => delete w.ents[k]); await st.delete('demo'); w.seq++; await st.put('world', w);
      broadcast(state, { t: 'delta', seq: w.seq, now, up: [], rm: ids }); return Response.json({ ok: true, cleared: ids.length }); }
    if (gated(w)) return Response.json({ ok: false, error: 'construction is on hold until the town layout is approved (Anna sets layout.approve)', layout: w.layout || { approved: false } }, { status: 409 });
    const prev = await st.get('demo'); if (prev && now - prev.t0 < 60e3) return Response.json({ ok: false, error: 'a demo just started; try again in a minute', retryMs: 60e3 - (now - prev.t0) }, { status: 429 });
    const lot = j.lot || 9, secs = Math.max(60, Math.min(900, j.secs || 240)), dir = j.dir === 1 ? 1 : -1;
    if (w.ents['lot:' + lot] && (w.ents['lot:' + lot].leased || !w.ents['lot:' + lot].demo)) return Response.json({ ok: false, error: 'lot ' + lot + ' is leased for real; pick another' }, { status: 409 });
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
  if (gated(w)) { await st.delete('demo'); return; }   // layout gate: the demo driver refuses to build
  const T = (now - d.t0) / 1000, o = clamp(T / d.secs), step = 2, on = clamp((T + step) / d.secs), evs = [];
  if (w.ents['lot:' + d.lot]?.demo) evs.push({ type: 'site.progress', lot: d.lot, overall: o, next: o < 1 ? { o: on, eta: step } : null });
  if (d.road && w.ents['road:demo-ave']) { const ro = clamp(T / (d.secs * 0.6)), rn = clamp((T + step) / (d.secs * 0.6)); evs.push({ type: 'road.progress', id: 'demo-ave', overall: ro, next: ro < 1 ? { o: rn, eta: step } : null }); }
  const up = []; for (const ev of evs) up.push(...applyEvent(w, ev, now).up);
  if (up.length) { w.seq++; await st.put('world', w); broadcast(state, { t: 'delta', seq: w.seq, now, up, rm: [] }); }
  if (o >= 1) { d.done = true; await st.put('demo', d); return; }
  await st.setAlarm(now + step * 1000);
}
