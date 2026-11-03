// Demo backend (used when no Supabase project is configured). Generic small-shop sample data, stored in localStorage only.
const K = 'ews-client-demo';
const load = () => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch { return {}; } };
const save = (s) => localStorage.setItem(K, JSON.stringify(s));
const seed = (email) => ({
  session: { email, pending: false },
  profile: { full_name: 'Sam Rivera', business_name: 'Sample Corner Bakery', phone: '(555) 010-0199' },
  products: [{ kind: 'web_builder', status: 'trial', plan: 'starter' }],
  sites: [{ id: 'demo-1', name: 'Sample Corner Bakery', domain: 'samplecornerbakery.example', plan: 'starter', status: 'preview', preview_url: null }],
  invoices: [{ id: 'inv-demo-1', description: 'Starter website setup (sample, not charged)', amount_cents: 34900, status: 'draft', created_at: '2026-10-29' }],
  tickets: [],
});
export function demoBackend() {
  return {
    mode: 'demo',
    async session() { const s = load(); return s.session && !s.session.pending ? { email: s.session.email } : null; },
    async sendLink(email) { save({ session: { email, pending: true } }); return { ok: true, demoLink: '#/dashboard?demo=1' }; },
    async completeDemo() { const s = load(); if (s.session?.pending) save(seed(s.session.email)); },
    async signOut() { localStorage.removeItem(K); },
    async profile() { return load().profile || {}; },
    async saveProfile(p) { const s = load(); s.profile = { ...s.profile, ...p }; save(s); },
    async products() { return load().products || []; },
    async sites() { return load().sites || []; },
    async invoices() { return load().invoices || []; },
    async tickets() { return load().tickets || []; },
    async createTicket(t) { const s = load(); s.tickets = [{ id: 'T-' + Date.now().toString(36).toUpperCase(), ...t, status: 'open', created_at: new Date().toISOString() }, ...(s.tickets || [])]; save(s); },
  };
}
