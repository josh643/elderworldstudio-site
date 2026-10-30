// Pure logic for the EWS client area (unit-tested in tests/client_core.test.mjs).
export const PLANS = {
  starter: { name: 'Starter', setup: 349, monthly: 19 },
  business: { name: 'Business', setup: 699, monthly: 39 },
  plus: { name: 'Plus', setup: 1299, monthly: 69 },
};
export const DOMAIN_FEE = 'Domains at registrar cost + $2/yr';
export const PRODUCTS = [
  { kind: 'web_builder', name: 'AI Website', blurb: 'Your AI-built website, unique to your business.', href: '#/sites' },
  { kind: 'receptionist', name: 'AI Receptionist', blurb: 'Answers calls, texts and chat; books appointments. Part of Agent OS.', href: '#/dashboard' },
  { kind: 'review_assistant', name: 'Review & Reply Assistant', blurb: 'Drafts replies to reviews and DMs in your voice. Add-on.', href: '#/dashboard' },
  { kind: 'photo_studio', name: 'Photo & Listing Studio', blurb: 'Phone photos in, clean product shots and listings out. Add-on.', href: '#/dashboard' },
  { kind: 'pos', name: 'Elder POS', blurb: 'Point of sale for your counter, pop-ups and events.', href: '#/dashboard' },
];
export const STATUS_LABEL = { not_active: 'Not active', trial: 'Trial', active: 'Active', paused: 'Paused', canceled: 'Canceled' };
export const TICKET_CATEGORIES = ['general', 'website', 'receptionist', 'billing', 'pos', 'add-ons'];
export const ROUTES = ['login', 'check-email', 'dashboard', 'sites', 'billing', 'support', 'settings'];

export const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(s || '').trim());
export function parseRoute(hash) {
  const r = String(hash || '').replace(/^#\/?/, '').split(/[?/]/)[0];
  return ROUTES.includes(r) ? r : 'dashboard';
}
export function guard(route, signedIn) {
  const open = route === 'login' || route === 'check-email';
  if (!signedIn && !open) return 'login';
  if (signedIn && open) return 'dashboard';
  return route;
}
export function validateTicket(t) {
  const errors = [];
  const subject = String(t.subject || '').trim(), body = String(t.body || '').trim();
  if (subject.length < 3 || subject.length > 150) errors.push('Subject must be 3–150 characters.');
  if (body.length < 10 || body.length > 5000) errors.push('Message must be 10–5000 characters.');
  if (!TICKET_CATEGORIES.includes(t.category)) errors.push('Pick a category.');
  return { ok: !errors.length, errors, value: { subject, body, category: t.category } };
}
export const money = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Never let a secret/service-role key reach the browser.
export function isSecretKey(k) {
  k = String(k || '');
  if (k.startsWith('sb_secret_')) return true;
  const p = k.split('.');
  if (p.length === 3) {
    try { const j = JSON.parse(atob(p[1].replace(/-/g, '+').replace(/_/g, '/'))); return j.role === 'service_role'; } catch { return false; }
  }
  return false;
}
export function mergeProducts(rows) {
  const by = Object.fromEntries((rows || []).map((r) => [r.kind, r]));
  return PRODUCTS.map((p) => ({ ...p, status: by[p.kind]?.status || 'not_active', plan: by[p.kind]?.plan || null }));
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
