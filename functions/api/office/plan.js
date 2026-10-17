import { json, authed } from './_util.js';
// Floor 3 town model (2026-10-16). POST (CT111 publisher, bearer): the approved layout + the architects' proposed redesign,
// geometry only (numbers, enums, short ids). GET: the stored plan for the studio scale model (edge-cached 30 s).
const N = (v, lo = -3000, hi = 3000) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x * 100) / 100)) : null; };
const R = r => Array.isArray(r) && r.length === 4 && r.every(v => N(v) != null) ? r.map(v => N(v)) : null;
const ID = (s, n = 40) => String(s || '').replace(/[^A-Za-z0-9 _.-]/g, '').slice(0, n);
const WORDS = (s, n = 40) => String(s || '').replace(/[^A-Za-z0-9 '&-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const TIERS = ['S', 'M', 'L', 'X'];
function clean(p, status) {
  if (!p || typeof p !== 'object') return null;
  const arr = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
  const fr = p.frame || {}, num = a => arr(a, 16).map(v => N(v)).filter(v => v != null);
  const created = String(p.created || '').slice(0, 40);
  return { id: ID(p.id, 64), status, qa: ['PASS', 'FAIL'].includes(p.qa) ? p.qa : '', approved: status === 'approved', created: Number.isNaN(Date.parse(created)) ? '' : created,
    frame: { avenue_z: N(fr.avenue_z), street_x: num(fr.street_x), street_z: num(fr.street_z), road_w: N(fr.road_w, 0, 60), sidewalk_w: N(fr.sidewalk_w, 0, 20) },
    buildings: arr(p.buildings, 40).map(b => ({ id: ID(b.id), name: WORDS(b.name), rect: R(b.rect), h: N(b.h, 0, 400) })).filter(b => b.rect),
    lots: arr(p.lots, 200).map(l => ({ id: ID(l.id, 28), block: ID(l.block, 12), rect: R(l.rect), tier: TIERS.includes(l.tier) ? l.tier : 'S', status: WORDS(l.status, 16), use: WORDS(l.use, 48), src: arr(l.src, 3).map(x => String(x || '').replace(/[^A-Za-z0-9_.=\[\]-]/g, '').slice(0, 90)).filter(Boolean) })).filter(l => l.rect),
    streets: arr(p.streets, 60).map(s => ({ id: ID(s.id, 16), name: WORDS(s.name, 30), rect: R(s.rect), kind: ['avenue', 'main'].includes(s.kind) ? 'avenue' : 'local', lanes: N(s.lanes, 1, 8) || 2 })).filter(s => s.rect),
    blocks: arr(p.blocks, 80).map(b => ({ id: ID(b.id, 12), phase: N(b.phase, 0, 9) || 1, rect: R(b.rect) })).filter(b => b.rect),
    sites: arr(p.sites, 30).map(x => ({ id: ID(x.id, 24), kind: ID(x.kind, 16), rect: R(x.rect) })).filter(x => x.rect),
    water: arr(p.water, 10).map(w => ({ rect: R(w.rect) })).filter(w => w.rect),
    paths: arr(p.paths, 30).map(q => ({ w: N(q.w, 0.5, 20) || 2, pts: arr(q.pts, 64).map(pt => Array.isArray(pt) && pt.length >= 2 ? [N(pt[0]), N(pt[1])] : null).filter(pt => pt && pt[0] != null && pt[1] != null) })).filter(q => q.pts.length > 1),
    planting: arr(p.planting, 40).map(w => ({ rect: R(w.rect) })).filter(w => w.rect),
    zones: arr(p.zones, 20).map(z => ({ id: ID(z.id, 24), rect: R(z.rect) })).filter(z => z.rect) };
}
export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return json({ ok: false }, 401);
  const b = await request.json().catch(() => null); if (!b) return json({ ok: false }, 400);
  const out = { v: Date.now().toString(36), approved: clean(b.approved, 'approved'), proposed: clean(b.proposed, 'proposed') };
  const s = JSON.stringify(out); if (s.length > 200000) return json({ ok: false }, 413);
  // revision history of the proposed plan (v1, v2, ...): one entry per new draft id, newest last, max 20
  const rv = (Array.isArray(b.revisions) ? b.revisions : []).slice(-20).map(r => ({ id: ID(r.id, 64), qa: ['PASS', 'FAIL'].includes(r.qa) ? r.qa : '', lots: N(r.lots, 0, 999) || 0, created: Number.isNaN(Date.parse(String(r.created || ''))) ? '' : String(r.created).slice(0, 40) })).filter(r => r.id);
  const hist = rv.length ? rv : JSON.parse((await env.OFFICE_KV.get('plan-hist')) || '[]'); const P = out.proposed;
  if (P && P.id && !hist.some(h => h.id === P.id)) { hist.push({ id: P.id, at: new Date().toISOString(), qa: P.qa, lots: P.lots.length, created: P.created }); while (hist.length > 20) hist.shift(); await env.OFFICE_KV.put('plan-hist', JSON.stringify(hist)); }
  out.hist = hist; const s2 = JSON.stringify(out);
  await env.OFFICE_KV.put('plan', s2);
  return json({ ok: true, v: out.v, bytes: s2.length, revisions: hist.length });
}
export async function onRequestGet({ env }) {
  const s = env.OFFICE_KV ? await env.OFFICE_KV.get('plan', { cacheTtl: 30 }) : null;
  return new Response(s || JSON.stringify({ v: null, approved: null, proposed: null }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' } });
}
