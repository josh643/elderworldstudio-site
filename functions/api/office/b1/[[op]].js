// /api/office/b1/access   GET  -> {allowed} (200 allowed / 403 denied, logged)
// /api/office/b1/feed     GET  -> monitor-wall data (allowlisted only): world summary, agents, gate, budget/fps/deploy feeds from KV
// /api/office/b1/owner-ip POST {key} with B1_OWNER_KEY -> stores the caller's current IP as Joshua's (KV b1:owner_ip); GET ?key= shows it + recent denials
import { allowed, logDenied, denied, clientIp, parseIp } from '../_b1.js';
import { worldDO } from '../world.js';
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const ownerOk = (env, k) => !!env.B1_OWNER_KEY && typeof k === 'string' && k.length >= 24 && k === env.B1_OWNER_KEY;
export async function onRequest({ request, env, params }) {
  const op = (params.op || [])[0] || 'access', u = new URL(request.url);
  if (op === 'owner-ip') {
    let key = u.searchParams.get('key') || ''; if (request.method === 'POST') { try { key = (await request.json()).key || key; } catch {} }
    if (!ownerOk(env, key)) { await logDenied(env, request, 'owner-ip bad key'); return J({ ok: false }, 403); }
    if (request.method === 'POST') { const ip = clientIp(request); if (!parseIp(ip)) return J({ ok: false, error: 'no ip' }, 400);
      const prev = await env.OFFICE_KV.get('b1:owner_ip'); await env.OFFICE_KV.put('b1:owner_ip', ip);
      const log = JSON.parse((await env.OFFICE_KV.get('b1:owner_log')) || '[]'); log.unshift({ at: new Date().toISOString(), ip, prev }); await env.OFFICE_KV.put('b1:owner_log', JSON.stringify(log.slice(0, 50)));
      return J({ ok: true, owner_ip: ip }); }
    return J({ ok: true, owner_ip: await env.OFFICE_KV.get('b1:owner_ip'), denied: JSON.parse((await env.OFFICE_KV.get('b1:denied')) || '[]').slice(0, 50), seen: JSON.parse((await env.OFFICE_KV.get('b1:seen')) || '[]').slice(0, 50) });
  }
  const a = await allowed(request, env);
  if (op === 'access') {
    try { const k = 'b1:seen'; const s = JSON.parse((await env.OFFICE_KV.get(k)) || '[]'); const ent = { ip: a.ip, ua: (request.headers.get('user-agent') || '').slice(0, 100), ok: a.ok, at: new Date().toISOString() };
      if (!s.some(x => x.ip === ent.ip && x.ua === ent.ua)) { s.unshift(ent); await env.OFFICE_KV.put(k, JSON.stringify(s.slice(0, 100))); } } catch {}
    if (!a.ok) { await logDenied(env, request, 'access'); return denied(true); }
    return J({ ok: true, allowed: true });
  }
  if (!a.ok) { await logDenied(env, request, 'api ' + op); return denied(true); }
  if (op === 'feed') {
    let w = {}; try { w = await (await worldDO(env).fetch('https://rl/world/state')).json(); } catch {}
    const ents = w.ents || [], agents = ents.filter(e => e.kind === 'agent');
    let st = {}; try { st = JSON.parse((await env.OFFICE_KV.get('state')) || '{}'); } catch {}
    return J({ ok: true, now: Date.now(), layout: w.layout || { approved: false }, viewers: w.viewers || 0, seq: w.seq || 0,
      agents: agents.map(e => ({ id: e.id.slice(6), zone: e.zone, act: e.act, x: e.x, z: e.z })).slice(0, 120),
      sites: ents.filter(e => e.kind === 'site').map(e => ({ lot: e.lot, si: e.si, p: e.p, hold: !!e.hold, leased: !!e.leased, tenant: e.tenant })),
      work: (st.work || []).slice(0, 60).map(x => ({ agent: x.agent, name: x.name, team: x.team, stage: x.stage, progress: x.progress, task: String(x.task || '').slice(0, 80) })),
      budget: st.budget || null, release: null });
  }
  return J({ ok: false }, 404);
}
