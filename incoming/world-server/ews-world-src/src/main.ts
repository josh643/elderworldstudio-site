// ews-world: Elderverse world server (staging). Authoritative for town state, construction stages and agent movement;
// publishes deltas OUTBOUND to the Cloudflare world Durable Object (or the local stub). No inbound internet ports:
// the admin/health HTTP listener is bound to 127.0.0.1 only.
import http from 'node:http';
import crypto from 'node:crypto';
import { DoClient } from './doclient.js';
import { Construction, Job } from './construction.js';
import { Agents } from './agents.js';
import { SCHEMA_VERSION, World, Delta, Snap, WorldEvent, applyEvent, clean } from './schema.js';
import { env, envNum, log, readJson, writeAtomic, DATA } from './util.js';

const KEY = env('WORLD_KEY'); if (!KEY) { log('error', 'WORLD_KEY missing (expected in /etc/ews-world/env)'); process.exit(2); }
const BASE = env('WORLD_BASE', 'http://127.0.0.1:8788').replace(/\/$/, '');
const STATUS_URL = env('STATUS_URL', 'https://office-3d.elderworldstudio.pages.dev/api/office/state');
const ROSTER_URL = env('ROSTER_URL', 'https://office-3d.elderworldstudio.pages.dev/office/data/roster.json');
const ADMIN_PORT = envNum('ADMIN_PORT', 8790), STAGING = env('WORLD_MODE', 'staging') === 'staging';
const AGENT_EVENTS = env('WORLD_AGENT_EVENTS', BASE.includes('127.0.0.1') ? '1' : '0') === '1';
const STATE = DATA + '/state.json', started = Date.now();

const saved = readJson<{ town?: World; jobs?: Record<string, Job> }>(STATE, {});
const town: World = saved.town || { seq: 0, ents: {} };
for (const k of Object.keys(town.ents)) if (town.ents[k].kind === 'agent') delete town.ents[k];
const doc = new DoClient({ base: BASE, key: KEY, allowExt: AGENT_EVENTS });
const sim = new Construction(town, ev => doc.enqueue(ev));
sim.jobs = saved.jobs || {};
const agents = new Agents(STATUS_URL, ROSTER_URL);
let remote = { seq: -1, ents: 0, lastDeltaAt: 0, deltas: 0 };
const waiters = new Set<(d: Delta) => void>();
let rt: { ok: boolean; ms?: number; at?: string; err?: string } | null = null;

doc.on('snap', (m: Snap) => { remote = { ...remote, seq: m.seq, ents: m.ents.length };
  // Authoritative reconcile: anything we own that the DO lost or holds stale gets re-sent; our entities the DO has but we no longer own get removed.
  const theirs = new Map(m.ents.map(e => [e.id, e]));
  let stale = 0; for (const j of Object.values(sim.jobs)) { const e = theirs.get(j.id); if (!e || Math.abs(((e.si as number) + (e.p as number)) - ((town.ents[j.id]?.si ?? 0) + (town.ents[j.id]?.p ?? 0))) > 0.01) stale++; }
  if (stale) { log('info', 'reasserting owned entities after snap', { stale }); sim.reassert(); }
  log('info', 'DO snapshot', { seq: m.seq, ents: m.ents.length }); });
doc.on('delta', (d: Delta) => { remote.seq = d.seq; remote.lastDeltaAt = Date.now(); remote.deltas++; for (const w of waiters) w(d); });
doc.start();

// Simulation loops
setInterval(() => sim.tick(), 2000).unref();
let lastAgentTick = Date.now();
setInterval(() => { const now = Date.now(), poses = agents.tick((now - lastAgentTick) / 1000, now); lastAgentTick = now;
  if (poses.length) { applyEvent(town, { type: 'agent.pose', poses }, now); for (let i = 0; i < poses.length; i += 100) doc.enqueue({ type: 'agent.pose', poses: poses.slice(i, i + 100) }); } }, 1000).unref();
agents.pollRoster(); setInterval(() => agents.pollRoster(), 10 * 60e3).unref();
agents.pollStatus(); setInterval(() => agents.pollStatus(), Number(process.env.WORLD_STATUS_POLL_MS) || 30e3).unref();   // 2026-10-17 CF cap: was 10 s
const persist = () => { const t: World = { seq: town.seq, ents: Object.fromEntries(Object.entries(town.ents).filter(([, e]) => e.kind !== 'agent')) };
  writeAtomic(STATE, JSON.stringify({ v: SCHEMA_VERSION, savedAt: new Date().toISOString(), town: t, jobs: sim.jobs, agents: agents.sims })); };
setInterval(persist, 30e3).unref();

// Round trip: post a throwaway road far outside the playable area, wait for the DO delta, remove it, wait again.
async function roundTrip(): Promise<typeof rt> {
  const id = 'rt-' + crypto.randomBytes(3).toString('hex'), t0 = Date.now();
  const wait = (pred: (d: Delta) => boolean, ms: number) => new Promise<boolean>(res => { const f = (d: Delta) => { if (pred(d)) { waiters.delete(f); clearTimeout(to); res(true); } };
    const to = setTimeout(() => { waiters.delete(f); res(false); }, ms); waiters.add(f); });
  if (!doc.connected) return (rt = { ok: false, at: new Date().toISOString(), err: 'not connected: ' + doc.lastErr });
  const seen = wait(d => d.up.some(e => e.id === 'road:' + id), 10000);
  const p = await doc.post([{ type: 'road.upsert', id, name: 'World server check', a: [1900, 1900], b: [1901, 1900], w: 3, stage: 'survey', progress: 0 }]);
  if (!p.ok) return (rt = { ok: false, at: new Date().toISOString(), err: 'post ' + p.status });
  const ok1 = await seen, gone = wait(d => d.rm.includes('road:' + id), 10000);
  await doc.post([{ type: 'road.remove', id }]); const ok2 = await gone;
  rt = { ok: ok1 && ok2, ms: Date.now() - t0, at: new Date().toISOString(), err: ok1 && ok2 ? undefined : 'delta not seen (' + (ok1 ? 'remove' : 'upsert') + ')' };
  log(rt.ok ? 'info' : 'warn', 'round trip', rt); return rt;
}
setTimeout(() => roundTrip(), 8000).unref(); setInterval(() => roundTrip(), 30 * 60e3).unref();

function health() {
  const now = Date.now(), wsFresh = doc.connected && now - doc.lastMsgAt < 90e3, statusFresh = !!agents.statusAt && now - agents.statusAt < 120e3;
  const ok = wsFresh && statusFresh && (rt?.ok ?? true);
  return { ok, mode: STAGING ? 'staging' : 'prod', schema: SCHEMA_VERSION, uptimeSec: Math.round((now - started) / 1000),
    do: { base: BASE, stub: BASE.includes('127.0.0.1'), connected: doc.connected, lastMsgAgeSec: doc.lastMsgAt ? Math.round((now - doc.lastMsgAt) / 1000) : null, connects: doc.connects,
      remoteSeq: remote.seq, deltasSeen: remote.deltas, posted: doc.postOk, postErrors: doc.postErr, pending: doc.pending, agentEvents: AGENT_EVENTS, lastErr: doc.lastErr || undefined },
    roundTrip: rt, town: { seq: town.seq, ents: Object.keys(town.ents).length }, construction: sim.summary(), agents: agents.summary(),
    mem: { rssMB: Math.round(process.memoryUsage().rss / 1048576) } };
}
const send = (res: http.ServerResponse, code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body, null, 1)); };
async function body(req: http.IncomingMessage) { let raw = ''; for await (const c of req) { raw += c; if (raw.length > 64e3) throw new Error('too big'); } return raw ? JSON.parse(raw) : {}; }
http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', 'http://x');
  try {
    if (u.pathname === '/healthz') { const h = health(); return send(res, h.ok ? 200 : 503, h); }
    if (u.pathname === '/state') return send(res, 200, { seq: town.seq, ents: Object.values(town.ents) });
    if (req.method !== 'POST') return send(res, 404, { ok: false });
    if ((req.headers.authorization || '') !== 'Bearer ' + KEY) return send(res, 401, { ok: false });   // admin needs the key even on localhost
    const j = await body(req);
    if (u.pathname === '/admin/roundtrip') return send(res, 200, await roundTrip());
    if (u.pathname === '/admin/lease') { const lot = Number(j.lot); if (!Number.isInteger(lot) || lot < 1 || lot > 80) return send(res, 400, { ok: false, error: 'lot 1..80' });
      if (j.demo && !STAGING) return send(res, 403, { ok: false, error: 'demo is staging only' });
      const c = clean({ type: 'lot.lease', lot, tenant: j.tenant, public: j.public, style: j.style, parts: j.parts }, false) as any;
      return send(res, 200, sim.lease({ lot, tenant: c.tenant, public: c.public, style: c.style, parts: c.parts, real: j.real, demo: j.demo ? { t0: Date.now(), secs: Math.max(60, Math.min(900, Number(j.secs) || 240)) } : null })); }
    if (u.pathname === '/admin/road') { const c = clean({ type: 'road.upsert', ...j }, false) as any; if (!c) return send(res, 400, { ok: false, error: 'invalid road' });
      if (j.demo && !STAGING) return send(res, 403, { ok: false });
      return send(res, 200, sim.road({ id: c.id, name: c.name, a: c.a, b: c.b, w: c.w, resurface: c.resurface, real: j.real, demo: j.demo ? { t0: Date.now(), secs: Math.max(60, Math.min(900, Number(j.secs) || 240)) } : null })); }
    if (u.pathname === '/admin/progress') { const r = sim.report(String(j.id), Number(j.real)); return send(res, r ? 200 : 404, r || { ok: false }); }
    if (u.pathname === '/admin/remove') return send(res, 200, { ok: sim.remove(String(j.id)) });
    if (u.pathname === '/admin/snapshot') { persist(); return send(res, 200, { ok: true, file: STATE }); }
    return send(res, 404, { ok: false });
  } catch (e: any) { return send(res, 400, { ok: false, error: String(e?.message || e).slice(0, 200) }); }
}).listen(ADMIN_PORT, '127.0.0.1', () => log('info', 'ews-world up', { admin: '127.0.0.1:' + ADMIN_PORT, do: BASE, agentEvents: AGENT_EVENTS, jobs: Object.keys(sim.jobs).length }));

for (const s of ['SIGTERM', 'SIGINT'] as const) process.on(s, () => { try { persist(); } catch {} log('info', 'shutdown', { signal: s }); process.exit(0); });
