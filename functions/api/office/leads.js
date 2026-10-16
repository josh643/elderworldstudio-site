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
  await Promise.all(ids.slice(0, 100).map(i => env.OFFICE_KV.delete(`lead:${String(i).replace(/[^0-9a-f-]/gi, '')}`)));
  return json({ ok: true });
}
