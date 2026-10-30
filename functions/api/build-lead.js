// POST /api/build-lead — website-builder "Get it built" requests. Stored in D1 (binding BUILD_LEADS, db ews-web-builder-leads).
// No email is sent and nothing is charged. Lead review: wrangler d1 execute ews-web-builder-leads --remote --command "select * from leads".
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
export const SCHEMA = `CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, created TEXT NOT NULL, name TEXT, email TEXT, phone TEXT, business TEXT, domain TEXT, notes TEXT, draft TEXT, country TEXT, source TEXT, status TEXT DEFAULT 'new')`;
export function parseLead(b) {
  const d = { name: clean(b.name, 100), email: clean(b.email, 200).toLowerCase(), phone: clean(b.phone, 40), business: clean(b.business, 150),
    domain: clean(b.domain, 80).toLowerCase(), notes: clean(b.notes, 2000) };
  const err = [];
  if (!d.name) err.push('name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) err.push('email');
  if (!d.business) err.push('business');
  if (d.domain && !/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(d.domain)) err.push('domain');
  let draft = '{}';
  try { draft = JSON.stringify(typeof b.draft === 'object' && b.draft ? b.draft : {}).slice(0, 8000); } catch {}
  return { d, err, draft };
}
export async function onRequestPost({ request, env }) {
  const out = (ok, extra, status) => Response.json({ ok, ...extra }, { status: status || (ok ? 200 : 400) });
  let b;
  try { b = await request.json(); } catch { return out(false, { error: 'Bad request.' }); }
  if (!b || typeof b !== 'object') return out(false, { error: 'Bad request.' });
  if (clean(b.website_url, 200)) return out(true, { id: 'ok' });            // honeypot
  const t0 = Number(b.t || 0); if (t0 && Date.now() - t0 < 3000) return out(true, { id: 'ok' }); // too fast: bot
  const { d, err, draft } = parseLead(b);
  if (err.length) return out(false, { error: 'Please check: ' + err.join(', ') + '.' });
  if (!env.BUILD_LEADS) return out(false, { error: 'Requests are not switched on yet.' }, 503);
  const id = 'W-' + new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12) + '-' + crypto.randomUUID().slice(0, 4).toUpperCase();
  const source = request.headers.get('x-ews-e2e') && env.E2E_TOKEN && request.headers.get('x-ews-e2e') === env.E2E_TOKEN ? 'e2e' : 'web-builder';
  await env.BUILD_LEADS.prepare(SCHEMA).run();
  await env.BUILD_LEADS.prepare('INSERT INTO leads (id,created,name,email,phone,business,domain,notes,draft,country,source) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, new Date().toISOString(), d.name, d.email, d.phone, d.business, d.domain, d.notes, draft, request.cf?.country || '', source).run();
  return out(true, { id });
}
export const onRequestGet = () => new Response(null, { status: 303, headers: { Location: '/build/' } });
