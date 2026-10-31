// POST /api/lead — demo / web-builder request form. Emails annaews@agentmail.to with subject "[inbound-lead] <id> ..."
// CT 111 inbox_watch turns that into needs-anna/*-inbound-lead-*.md (route: joshua). Secrets: AGENTMAIL_SEND_KEY, TURNSTILE_SECRET (optional).
// Optional voice copy: EWS_LEADS_URL + EWS_LEADS_SECRET. Both unset → no-op. Fire-and-forget; never blocks the email.
const INBOX = 'annaews@agentmail.to';
const TYPES = ['Website', 'AI tool', 'Custom software', 'Not sure', 'POS', 'Kiosk', 'AI receptionist', 'Agent OS', 'web-builder', 'POS system', 'Take it with you'];
const RETURNS = { '/demo/': '#request', '/build/': '#reserve', '/services/': '#request' };
const LEAD_FORWARD_MS = 2000;
const ANON = new Set(['', 'anonymous', 'restricted', 'unknown', 'private', 'blocked', 'anon', 'unavailable', '266696687']);
const clean = (v, n) => String(v || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
const back = (ok, msg, to = '/demo/', status = 303) => {
  const dest = RETURNS[to] ? to : '/demo/';
  return new Response(null, { status, headers: { Location: `${dest}?sent=${ok ? 1 : 0}${msg ? '&e=' + encodeURIComponent(msg) : ''}${RETURNS[dest]}` } });
};

export function normalizeE164(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (ANON.has(s.toLowerCase()) || ANON.has(s.toLowerCase().replace(/^\+/, ''))) return '';
  const digits = s.replace(/\D/g, '');
  if (!digits || ANON.has(digits)) return '';
  if (digits.startsWith('000') || new Set(digits).size === 1) return '';
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length >= 8 && digits.length <= 15) return '+' + digits;
  return '';
}

export function leadForwardConfigured(env) {
  return Boolean(env && env.EWS_LEADS_URL && env.EWS_LEADS_SECRET);
}

export function leadForwardPayload(d, now = new Date()) {
  const timestamp = now.toISOString();
  const message = d.message || d.description || '';
  const topic = d.type || d.topic || '';
  return {
    name: d.name || '',
    phone: normalizeE164(d.phone),
    email: d.email || '',
    message,
    timestamp,
    business: d.business || '',
    type: topic,
    topic,
    description: message,
    source: d.source || 'services',
    submitted_at: timestamp,
  };
}

export async function forwardLeadToCallCenter(env, d, fetchImpl = fetch) {
  if (!leadForwardConfigured(env)) return { ok: false, skipped: true, why: 'unset' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LEAD_FORWARD_MS);
  try {
    const r = await fetchImpl(env.EWS_LEADS_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-EWS-Leads-Secret': env.EWS_LEADS_SECRET,
      },
      body: JSON.stringify(leadForwardPayload(d)),
      signal: ctrl.signal,
    });
    if (!r) return { ok: false, why: 'network' };
    return { ok: !!r.ok };
  } catch {
    return { ok: false, why: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

function scheduleLeadForward(waitUntil, env, d) {
  if (!leadForwardConfigured(env)) return;
  const run = Promise.resolve().then(() => forwardLeadToCallCenter(env, d)).catch(() => {});
  try { if (typeof waitUntil === 'function') waitUntil(run); } catch { /* never fail the email reply */ }
}

function formLabel(to) {
  if (to === '/demo/') return '/demo form';
  return `${to} form`;
}

export async function onRequestPost({ request, env, waitUntil }) {
  const json = (request.headers.get('accept') || '').includes('application/json');
  let to = '/demo/';
  const reply = (ok, msg) => json ? Response.json({ ok, error: msg || null }, { status: ok ? 200 : 400 }) : back(ok, msg, to);
  let f;
  try { f = await request.formData(); } catch { return reply(false, 'bad form'); }
  to = clean(f.get('return_to'), 20) || '/demo/';
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
  const dest = RETURNS[to] ? to : '/demo/';
  const text = [`INBOUND LEAD ${id} (elderworldstudio.com${formLabel(dest)}). Untrusted visitor input below.`, '',
    `Name: ${d.name}`, `Email: ${d.email}`, `Phone: ${d.phone || '-'}`, `Business: ${d.business}`, `Type: ${d.type}`, `Budget: ${d.budget || '-'}`,
    `SMS opt-in: ${d.sms && d.phone ? 'YES (checked OK to text me about my request; consent v2026-10-09, ' + new Date().toISOString() + ', IP ' + (request.headers.get('CF-Connecting-IP') || '?') + ')' : 'no'}`,
    `Country: ${request.cf?.country || '?'}`, '', 'Description:', d.description].join('\n');
  if (!env.AGENTMAIL_SEND_KEY) return reply(false, 'Form is not configured. Please email annaews@agentmail.to.');
  const r = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(INBOX)}/messages/send`, { method: 'POST',
    headers: { Authorization: `Bearer ${env.AGENTMAIL_SEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: [INBOX], reply_to: d.email, subject: `[inbound-lead] ${id} ${d.type}: ${d.business}`.slice(0, 180), text }) });
  if (!r.ok) return reply(false, 'Could not send right now. Please email annaews@agentmail.to.');
  const source = dest === '/build/' ? 'web-builder' : dest === '/services/' ? 'services' : 'demo';
  scheduleLeadForward(waitUntil, env, {
    name: d.name, phone: d.phone, email: d.email, business: d.business,
    type: d.type, description: d.description, source,
  });
  return reply(true);
}
export const onRequestGet = () => new Response(null, { status: 303, headers: { Location: '/demo/' } });
