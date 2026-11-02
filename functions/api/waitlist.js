// POST /api/waitlist — Agent OS waitlist (/agentos/). Stores to D1 (binding BUILD_LEADS, table agentos_waitlist).
const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
export async function onRequestPost({ request, env }) {
  const json = (request.headers.get('accept') || '').includes('application/json');
  const reply = (ok, error) => json ? Response.json({ ok, error: error || null }, { status: ok ? 200 : 400 })
    : new Response(null, { status: 303, headers: { Location: `/agentos/?joined=${ok ? 1 : 0}#waitlist` } });
  let f; try { f = await request.formData(); } catch { return reply(false, 'Bad form.'); }
  if (clean(f.get('website_url'), 200)) return reply(true);              // honeypot
  const t0 = Number(f.get('t') || 0); if (t0 && Date.now() - t0 < 2000) return reply(true); // too fast: bot
  const email = clean(f.get('email'), 200).toLowerCase(), business = clean(f.get('business'), 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return reply(false, 'Please enter a valid email address.');
  if (!env.BUILD_LEADS) return reply(false, 'Waitlist is not configured yet.');
  const id = crypto.randomUUID();
  await env.BUILD_LEADS.prepare(`INSERT INTO agentos_waitlist (id, created, email, business, country, referrer, ua) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET business = COALESCE(NULLIF(excluded.business,''), agentos_waitlist.business)`)
    .bind(id, new Date().toISOString(), email, business, request.cf?.country || '', clean(request.headers.get('referer'), 300), clean(request.headers.get('user-agent'), 300)).run();
  return reply(true);
}
export const onRequestGet = () => new Response(null, { status: 303, headers: { Location: '/agentos/#waitlist' } });
