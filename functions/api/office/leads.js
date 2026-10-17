import { json, authed } from './_util.js';
// GET /api/office/leads (bearer): list pending lead records. POST {ids:[...]} acknowledges (deletes) them after CT111 stored them.
export async function onRequestGet({ request, env }) {
  if (!authed(request, env)) return json({ ok: false }, 401);
  const l = await env.OFFICE_KV.list({ prefix: 'lead:' });
  const leads = (await Promise.all(l.keys.map(k => env.OFFICE_KV.get(k.name, 'json')))).filter(Boolean);
  return json({ ok: true, leads });
}
export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return json({ ok: false }, 401);
  const { ids = [] } = await request.json().catch(() => ({}));
  await Promise.all(ids.slice(0, 100).map(async i => { const k = String(i).replace(/[^0-9a-f-]/gi, ''); await env.OFFICE_KV.delete(`lead:${k}`);
    await env.OFFICE_KV.put(`leadst:${k}`, JSON.stringify({ s: 'in development', team: 'client', t: Date.now() }), { expirationTtl: 60 * 86400 }); }));   /* picked up by the client team on CT111 */
  return json({ ok: true });
}
