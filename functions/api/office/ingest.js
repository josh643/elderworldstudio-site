import { json, authed, sanitize } from './_util.js';
import names from '../../../site/office/data/names.json';
// POST /api/office/ingest (CT111 publisher, bearer OFFICE_INGEST_KEY). Body is re-sanitized here too,
// so even a buggy publisher cannot leak titles, repos, clients, money or reasons.
export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return json({ ok: false }, 401);
  let raw; try { raw = await request.json(); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  const s = sanitize(raw, names);
  await env.OFFICE_KV.put('state', JSON.stringify(s), { expirationTtl: 3600 });
  return json({ ok: true, published: s.work.length });
}
