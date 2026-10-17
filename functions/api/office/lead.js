import { json, doLimit, visitor } from './_util.js';
// POST /api/office/lead: visitor demo request from the office kiosk or Freyja. Stored as a LEAD RECORD in KV
// (lead:<id>). No outbound email. The CT111 publisher pulls them (GET /api/office/leads) into the client team's queue.
const clean = (v, n) => String(v || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
export async function onRequestPost({ request, env }) {
  let f; try { f = await request.json(); } catch { return json({ ok: false, error: 'bad request' }, 400); }
  if (clean(f.website_url, 100)) return json({ ok: true });
  if (f.t && Date.now() - Number(f.t) < 3000) return json({ ok: true });
  const ip = visitor(request);
  if (!(await doLimit(env, 'lead:' + ip, [['day', 5, 864e5]])).ok) return json({ ok: false, error: 'Too many requests today. Please use the services page.' }, 429);
  const d = { name: clean(f.name, 100), email: clean(f.email, 200), business: clean(f.business, 150), type: clean(f.type, 30), description: clean(f.description, 2000), source: clean(f.source, 30) || 'office', client_language: f.client_language === 'es' ? 'es' : 'en' };   /* records stay English; replies go back in this language */
  if (!d.name || !d.business || !d.description || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return json({ ok: false, error: 'Please fill in name, a valid email, business and what you need.' }, 400);
  const testers = String(env.OFFICE_TEST_EMAILS || 'jw027722@gmail.com,rbearded@gmail.com').toLowerCase().split(',').map(x => x.trim());
  d.test = testers.includes(d.email.toLowerCase()) || /^test\b|\btest (inc|co|llc)\b/i.test(d.business) || f.test === true;   /* test submissions never enter the client pipeline */
  const id = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12) + '-' + crypto.randomUUID().slice(0, 6);
  await env.OFFICE_KV.put(`lead:${id}`, JSON.stringify({ id, ...d, country: request.cf?.country || '?', created: new Date().toISOString(), untrusted: true }), { expirationTtl: 60 * 86400 });
  await env.OFFICE_KV.put(`leadst:${id}`, JSON.stringify({ s: 'received', team: 'client', t: Date.now() }), { expirationTtl: 60 * 86400 });
  return json({ ok: true, id });
}
