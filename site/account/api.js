// Cloudflare Functions backend (D1 + session cookie). Used when /api/me is available.
export function apiBackend() {
  const j = async (url, opts = {}) => {
    const r = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json', ...(opts.headers || {}) }, ...opts });
    const body = await r.json().catch(() => ({}));
    if (r.status === 401) return { unauthorized: true };
    if (!r.ok && body.ok === false) return body;
    return body;
  };
  let cached = null;
  const me = async (force) => {
    if (!force && cached) return cached;
    cached = await j('/api/me');
    return cached;
  };
  return {
    mode: 'shop',
    async session() {
      const m = await me();
      return m && m.ok ? { email: m.email } : null;
    },
    async sendLink(email) {
      const r = await j('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'request-link', email }) });
      return r;
    },
    async completeDemo() {},
    async consumeToken(token) {
      const r = await j('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'verify', token }) });
      cached = null;
      return r;
    },
    async signOut() {
      await j('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
      cached = null;
    },
    async profile() {
      const m = await me();
      return { full_name: m.name || '', business_name: (m.sites && m.sites[0] && m.sites[0].name) || '', phone: '' };
    },
    async saveProfile() { return; },
    async products() {
      const m = await me();
      const active = m && m.ok && m.plan ? [{ kind: 'web_builder', status: m.status === 'active' ? 'active' : m.status, plan: m.plan }] : [];
      return active;
    },
    async sites() {
      const m = await me(true);
      return (m.sites || []).map((s) => ({
        id: s.id, name: s.name, domain: s.published || s.slug, plan: s.plan, status: s.status,
        preview_url: s.preview, download_url: `/api/sites/${s.id}/download`,
      }));
    },
    async invoices() {
      const m = await me();
      return m.invoices || [];
    },
    async tickets() { return []; },
    async createTicket() { return; },
    async portal() {
      return j('/api/portal', { method: 'POST' });
    },
    async capabilities() {
      const m = await me();
      return { canDownload: !!m.canDownload, canPublish: !!m.canPublish, canEdit: !!m.canEdit, plan: m.plan, status: m.status };
    },
  };
}
