import { json, authed } from './_util.js';
import { worldDO } from './world.js';
// POST /api/office/world-event (bearer OFFICE_INGEST_KEY = CT111 world_events.py, or WORLD_SERVER_KEY = CT119 ews-world; staging secret). One event or a list (max 50).
// Strict allowlist: numbers/enums only plus short plain-word tenant/road names. Unknown fields are dropped.
const ACTS = ['desk', 'walk', 'idle', 'field', 'meet', 'away'];
const BUILD = ['survey', 'groundwork', 'foundation', 'framing', 'walls', 'glazing', 'signage', 'landscaping', 'open'];
const ROAD = ['survey', 'grading', 'base', 'paving', 'striping', 'open'];
const COLORS = ['sandstone', 'brick', 'slate', 'cream', 'timber', 'teal'], KINDS = ['shop', 'cafe', 'studio', 'office', 'gallery'];
const words = (s, n) => String(s || '').replace(/[^A-Za-z0-9 &'.-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v, a, b) => { const x = Number(v); return Number.isFinite(x) ? Math.max(a, Math.min(b, x)) : null; };
const pt = p => Array.isArray(p) && p.length === 2 && p.every(v => Number.isFinite(Number(v)) && Math.abs(v) < 2000) ? [+p[0], +p[1]] : null;
const part = u => typeof u === 'string' && /^\/office\/assets\/[A-Za-z0-9_\/.-]+\.glb(\?v=[A-Za-z0-9]+)?$/.test(u) && !u.includes('..') ? u : null;
export function clean(e) {
  const t = e && e.type, o = { type: t };
  const prog = () => { if (e.overall != null) o.overall = num(e.overall, 0, 1); if (e.progress != null) o.progress = num(e.progress, 0, 1);
    if (e.next && e.next.eta) o.next = { o: num(e.next.o, 0, 1) ?? 0, eta: num(e.next.eta, 1, 3600) }; };
  if (['lot.lease', 'site.progress', 'lot.release'].includes(t)) {
    o.lot = num(e.lot, 1, 80); if (!o.lot || !Number.isInteger(o.lot)) return null;
    if (t === 'lot.lease') { o.public = e.public === true; o.tenant = o.public ? words(e.tenant, 28) : '';
      const s = e.style || {}; o.style = { floors: Math.round(num(s.floors, 1, 4) || 2), color: COLORS.includes(s.color) ? s.color : 'sandstone', kind: KINDS.includes(s.kind) ? s.kind : 'shop' };
      o.arch = e.arch === true; o.job = words(e.job, 40); if (e.leased === true) { o.leased = true; o.tenantId = String(e.tenantId || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40); } o.parts = {}; for (const [k, v] of Object.entries(e.parts || {}).slice(0, 12)) if (BUILD.includes(k) && part(v)) o.parts[k] = part(v); }
    if (t !== 'lot.release') { if (e.stage != null) { if (!BUILD.includes(e.stage)) return null; o.stage = e.stage; } prog(); }
    return o;
  }
  if (['road.upsert', 'road.progress', 'road.remove'].includes(t)) {
    o.id = String(e.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 32); if (!o.id) return null;
    if (t === 'road.upsert') { o.name = words(e.name, 40) || 'Road works'; o.a = pt(e.a); o.b = pt(e.b); o.w = num(e.w, 3, 16) || 8; o.resurface = e.resurface === true; if (!o.a || !o.b) return null; }
    if (t !== 'road.remove') { if (e.stage != null) { if (!ROAD.includes(e.stage)) return null; o.stage = e.stage; } prog(); }
    return o;
  }
  if (['zone.upsert', 'zone.progress', 'zone.remove'].includes(t)) {   // work zones without a lot (campus frame rect, floor G..5)
    o.id = String(e.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 32); if (!o.id) return null;
    if (t === 'zone.upsert') { o.name = words(e.name, 40) || 'Work zone'; o.floor = /^[G1-5]$/.test(e.floor || 'G') ? (e.floor || 'G') : 'G'; o.arch = e.arch === true;
      const r = Array.isArray(e.rect) && e.rect.length === 4 && e.rect.every(v => Number.isFinite(Number(v)) && Math.abs(v) < 400) ? e.rect.map(Number) : null; if (!r) return null; o.rect = r; }
    if (t !== 'zone.remove') { if (e.stage != null) { if (!BUILD.includes(e.stage)) return null; o.stage = e.stage; } prog(); }
    return o;
  }
  if (t === 'agent.pose') {   // schema v1 extension (incoming/world-server/schema.ts): numbers + enums only, <=200 poses
    const poses = (Array.isArray(e.poses) ? e.poses : []).slice(0, 200).map(p => {
      const id = String(p.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 32), zone = String(p.zone || '').replace(/[^a-z0-9:-]/gi, '').slice(0, 32);
      const x = num(p.x, -2000, 2000), z = num(p.z, -2000, 2000), h = num(p.h, -7, 7) ?? 0, act = ACTS.includes(p.act) ? p.act : null;
      if (!id || !zone || x == null || z == null || !act) return null;
      const r = { id, zone, x: +x.toFixed(2), z: +z.toFixed(2), h: +h.toFixed(3), act };
      const to = pt(p.to); if (to) r.to = to; const v = num(p.v, 0, 6); if (v) r.v = v; const lot = num(p.lot, 1, 80); if (lot && Number.isInteger(lot)) r.lot = lot;
      return r; });
    if (!poses.length || poses.some(p => !p)) return null; o.poses = poses; return o;
  }
  if (t === 'agent.gone') { o.id = String(e.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 32); return o.id ? o : null; }
  return null;
}
const keyOk = (request, env) => { const a = request.headers.get('authorization') || ''; return authed(request, env) || (!!env.WORLD_SERVER_KEY && a === `Bearer ${env.WORLD_SERVER_KEY}`); };
export async function onRequestPost({ request, env }) {
  if (!keyOk(request, env)) return json({ ok: false }, 401);
  if (!env.OFFICE_RL) return json({ ok: false, error: 'no world binding' }, 503);
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  const raw = [].concat(body).slice(0, 50);
  // layout gate: only Anna (the office ingest key, never the CT119 world-server key) may approve or revoke the town layout
  if (raw.some(e => e && /^layout\./.test(e.type))) {
    if (!authed(request, env)) return json({ ok: false, error: 'layout approval needs the office key' }, 403);
    const L = raw.map(e => e && (e.type === 'layout.approve' && typeof e.version === 'string' && /^[\w.:-]{1,64}$/.test(e.version) ? { type: e.type, version: e.version, by: 'anna' } : e.type === 'layout.revoke' ? { type: e.type, by: 'anna' } : null));
    if (L.some(e => !e)) return json({ ok: false, error: 'invalid layout event (layout.approve needs a version string; do not mix with other events)' }, 400);
    const r = await worldDO(env).fetch('https://rl/world/event', { method: 'POST', body: JSON.stringify(L) }); return json(await r.json(), r.status);
  }
  const evs = raw.map(clean); if (evs.some(e => !e)) return json({ ok: false, error: 'invalid event', index: evs.findIndex(e => !e) }, 400);
  // leased lots: only a client/owner-authorized edit (separate secret LEASE_EDIT_KEY, never given to agents) may touch them; the DO enforces (403)
  const la = request.headers.get('x-ews-lease-auth') || ''; const leaseOk = !!env.LEASE_EDIT_KEY && la === `Bearer ${env.LEASE_EDIT_KEY}`;
  for (const e of evs) if (leaseOk) e.lease_ok = true; else delete e.lease_ok;
  const r = await worldDO(env).fetch('https://rl/world/event', { method: 'POST', body: JSON.stringify(evs) }); const o = await r.json(); o.fn = 'lease-v1'; return json(o, r.status);
}
