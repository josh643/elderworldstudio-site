import { PLANS, DOMAIN_FEE, STATUS_LABEL, TICKET_CATEGORIES, isEmail, parseRoute, guard, validateTicket, money, mergeProducts, esc, isSecretKey } from './core.js';
import { demoBackend } from './demo.js';
import { supaBackend } from './supa.js';

const app = document.getElementById('app');
let api;
async function init() {
  let cfg = {};
  try { cfg = await (await fetch('/api/client-config')).json(); } catch {}
  if (cfg.supabaseUrl && cfg.supabaseKey && !isSecretKey(cfg.supabaseKey) && window.supabase) api = supaBackend(cfg);
  else api = demoBackend();
  document.getElementById('mode-note').textContent = api.mode === 'demo' ? ' · demo data, nothing is saved to a server' : '';
  document.getElementById('signout').onclick = async () => { await api.signOut(); location.hash = '#/login'; render(); };
  addEventListener('hashchange', render);
  render();
}
async function render() {
  if (/demo=1/.test(location.hash)) await api.completeDemo();
  const s = await api.session();
  const want = parseRoute(location.hash), route = guard(want, !!s);
  if (route !== want) { history.replaceState(null, '', '#/' + route); }
  document.getElementById('acct-nav').hidden = !s;
  document.querySelectorAll('#acct-nav a').forEach((a) => a.getAttribute('href') === '#/' + route ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  try { await (views[route] || views.dashboard)(s); } catch (e) { app.innerHTML = `<p class="err">Something went wrong: ${esc(e.message)}</p>`; }
}
const views = {
  login() {
    app.innerHTML = `<section class="auth card"><h1>Sign in</h1><p class="muted">We'll email you a one-time sign-in link. No password needed.</p>
      <form class="form" id="f" novalidate><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required>
      <button class="btn" type="submit">Email me a sign-in link</button><p id="msg" role="alert"></p></form></section>`;
    document.getElementById('f').onsubmit = async (e) => {
      e.preventDefault(); const email = e.target.email.value.trim(), msg = document.getElementById('msg');
      if (!isEmail(email)) { msg.className = 'err'; msg.textContent = 'Enter a valid email address.'; return; }
      const r = await api.sendLink(email);
      if (!r.ok) { msg.className = 'err'; msg.textContent = r.error || 'Could not send the link.'; return; }
      sessionStorage.setItem('ews-link', JSON.stringify({ email, demoLink: r.demoLink || null }));
      location.hash = '#/check-email';
    };
  },
  'check-email'() {
    const d = JSON.parse(sessionStorage.getItem('ews-link') || '{}');
    app.innerHTML = `<section class="auth card"><h1>Check your email</h1><p>We sent a sign-in link to <strong>${esc(d.email || 'your inbox')}</strong>. It expires in 1 hour.</p>
      ${d.demoLink ? `<p class="muted">Demo mode: no email is sent. Use the button below in place of the email link.</p><a class="btn" id="demo-link" href="${esc(d.demoLink)}">Open demo sign-in link</a>` : ''}
      <p><a href="#/login">Use a different email</a></p></section>`;
  },
  async dashboard(s) {
    const [p, prods] = await Promise.all([api.profile(), api.products()]);
    app.innerHTML = `<h1>Welcome${p.full_name ? ', ' + esc(p.full_name.split(' ')[0]) : ''}</h1><p class="muted">${esc(p.business_name || s.email)} · everything you get from Elder World Studio, in one place.</p>
      <div class="grid" id="products">${mergeProducts(prods).map((x) => `<article class="card" data-kind="${x.kind}"><h3>${esc(x.name)}</h3>
        <span class="badge ${x.status}">${STATUS_LABEL[x.status]}${x.plan ? ' · ' + esc(PLANS[x.plan]?.name || x.plan) : ''}</span>
        <p class="muted">${esc(x.blurb)}</p>${x.status === 'not_active' ? `<a class="btn ghost" href="#/support?about=${x.kind}">Ask about this</a>` : `<a class="btn ghost" href="${x.href}">Manage</a>`}</article>`).join('')}</div>`;
  },
  async sites() {
    const list = await api.sites();
    app.innerHTML = `<h1>Your websites</h1><p class="muted">Sites made with the EWS AI website builder.</p>
      ${list.length ? `<table class="t"><thead><tr><th>Site</th><th>Domain</th><th>Plan</th><th>Status</th></tr></thead><tbody>${list.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.domain || '—')}</td><td>${esc(PLANS[x.plan]?.name || x.plan)}</td><td><span class="badge ${esc(x.status)}">${esc(x.status)}</span></td></tr>`).join('')}</tbody></table>` : `<p class="card">No sites yet. <a href="/build/">Start one with the builder</a>.</p>`}
      <h2>Plans</h2><div class="grid">${Object.values(PLANS).map((p) => `<div class="card"><h3>${p.name}</h3><p>$${p.setup.toLocaleString()} setup + $${p.monthly}/mo</p></div>`).join('')}</div><p class="muted">${DOMAIN_FEE}.</p>`;
  },
  async billing() {
    const inv = await api.invoices();
    app.innerHTML = `<h1>Billing</h1><div class="card"><h3>Payment method</h3><p class="muted">Card payments run through Stripe. Billing isn't live in this preview, and no card can be added or charged.</p>
      <button class="btn" disabled id="portal">Manage billing in Stripe (coming soon)</button></div>
      <h2>Invoices</h2>${inv.length ? `<table class="t"><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>${inv.map((i) => `<tr><td>${esc(String(i.created_at).slice(0, 10))}</td><td>${esc(i.description)}</td><td>${money(i.amount_cents)}</td><td><span class="badge ${esc(i.status)}">${esc(i.status)}</span></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No invoices yet.</p>'}`;
  },
  async support() {
    const about = (location.hash.match(/about=([\w-]+)/) || [])[1];
    const cat = { web_builder: 'website', receptionist: 'receptionist', pos: 'pos', review_assistant: 'add-ons', photo_studio: 'add-ons' }[about] || 'general';
    const list = await api.tickets();
    app.innerHTML = `<h1>Support</h1><form class="form card" id="tf" novalidate><label for="cat">Category</label><select id="cat" name="category">${TICKET_CATEGORIES.map((c) => `<option ${c === cat ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <label for="subj">Subject</label><input id="subj" name="subject" maxlength="150" required><label for="body">How can we help?</label><textarea id="body" name="body" rows="5" maxlength="5000" required></textarea>
      <button class="btn" type="submit">Send request</button><p id="tmsg" role="alert"></p></form>
      <h2>Your requests</h2><div id="tickets">${list.length ? `<table class="t"><tbody>${list.map((t) => `<tr><td>${esc(t.subject)}</td><td>${esc(t.category)}</td><td><span class="badge ${esc(t.status)}">${esc(t.status)}</span></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No requests yet.</p>'}</div>`;
    document.getElementById('tf').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target, m = document.getElementById('tmsg');
      const v = validateTicket({ subject: f.subject.value, body: f.body.value, category: f.category.value });
      if (!v.ok) { m.className = 'err'; m.textContent = v.errors.join(' '); return; }
      await api.createTicket(v.value); await views.support(); const m2 = document.getElementById('tmsg'); m2.className = 'ok'; m2.textContent = 'Thanks, your request was sent.';
    };
  },
  async settings(s) {
    const p = await api.profile();
    app.innerHTML = `<h1>Settings</h1><form class="form card" id="pf"><label>Email</label><input value="${esc(s.email)}" disabled>
      <label for="fn">Your name</label><input id="fn" name="full_name" maxlength="120" value="${esc(p.full_name || '')}">
      <label for="bn">Business name</label><input id="bn" name="business_name" maxlength="150" value="${esc(p.business_name || '')}">
      <label for="ph">Phone</label><input id="ph" name="phone" maxlength="40" value="${esc(p.phone || '')}">
      <button class="btn" type="submit">Save</button><p id="pmsg" role="alert"></p></form>`;
    document.getElementById('pf').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      await api.saveProfile({ full_name: f.full_name.value.trim(), business_name: f.business_name.value.trim(), phone: f.phone.value.trim() });
      const m = document.getElementById('pmsg'); m.className = 'ok'; m.textContent = 'Saved.';
    };
  },
};
init();
