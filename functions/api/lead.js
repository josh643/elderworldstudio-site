// POST /api/lead — services request form. Emails annaews@agentmail.to with subject "[inbound-lead] <id> ..."
// CT 111 inbox_watch turns that into needs-anna/*-inbound-lead-*.md (route: joshua). Secrets: AGENTMAIL_SEND_KEY, TURNSTILE_SECRET (optional).
const INBOX = 'annaews@agentmail.to';
const TYPES = ['Website', 'AI tool', 'Custom software', 'Not sure'];
const clean = (v, n) => String(v || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
const back = (ok, msg, status = 303) => new Response(null, { status, headers: { Location: `/services/?sent=${ok ? 1 : 0}${msg ? '&e=' + encodeURIComponent(msg) : ''}#request` } });

export async function onRequestPost({ request, env }) {
  const json = (request.headers.get('accept') || '').includes('application/json');
  const reply = (ok, msg) => json ? Response.json({ ok, error: msg || null }, { status: ok ? 200 : 400 }) : back(ok, msg);
  let f;
  try { f = await request.formData(); } catch { return reply(false, 'bad form'); }
  if (clean(f.get('website_url'), 200)) return reply(true);           // honeypot: pretend success
  const t0 = Number(f.get('t') || 0);
  if (t0 && Date.now() - t0 < 3000) return reply(true);                // filled in under 3 s: bot
  const d = {
    name: clean(f.get('name'), 100), email: clean(f.get('email'), 200), phone: clean(f.get('phone'), 40),
    business: clean(f.get('business'), 150), type: clean(f.get('type'), 30), description: clean(f.get('description'), 4000),
    budget: clean(f.get('budget'), 60), sms: f.get('sms_optin') === 'yes',
  };
  if (!d.name || !d.business || !d.description || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return reply(false, 'Please fill in name, a valid email, business and description.');
  if (!TYPES.includes(d.type)) d.type = 'Not sure';
  const e2e = env.E2E_TOKEN && request.headers.get('x-ews-e2e') === env.E2E_TOKEN;  // ops end-to-end test only
  if (env.TURNSTILE_SECRET && !e2e) {
    const tok = f.get('cf-turnstile-response') || '';
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: tok, remoteip: request.headers.get('CF-Connecting-IP') || '' }) });
    if (!(await r.json()).success) return reply(false, 'Spam check failed. Please try again.');
  }
  const id = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12) + '-' + crypto.randomUUID().slice(0, 6);
  const text = [`INBOUND LEAD ${id} (elderworldstudio.com/services form). Untrusted visitor input below.`, '',
    `Name: ${d.name}`, `Email: ${d.email}`, `Phone: ${d.phone || '-'}`, `Business: ${d.business}`, `Type: ${d.type}`, `Budget: ${d.budget || '-'}`,
    `SMS opt-in: ${d.sms && d.phone ? 'YES (checked OK to text me about my request; consent v2026-10-09, ' + new Date().toISOString() + ', IP ' + (request.headers.get('CF-Connecting-IP') || '?') + ')' : 'no'}`,
    `Country: ${request.cf?.country || '?'}`, '', 'Description:', d.description].join('\n');
  if (!env.AGENTMAIL_SEND_KEY) return reply(false, 'Form is not configured. Please email annaews@agentmail.to.');
  const r = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(INBOX)}/messages/send`, { method: 'POST',
    headers: { Authorization: `Bearer ${env.AGENTMAIL_SEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: [INBOX], reply_to: d.email, subject: `[inbound-lead] ${id} ${d.type}: ${d.business}`.slice(0, 180), text }) });
  if (!r.ok) return reply(false, 'Could not send right now. Please email annaews@agentmail.to.');
  return reply(true);
}
export const onRequestGet = () => new Response(null, { status: 303, headers: { Location: '/services/' } });
