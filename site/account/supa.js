// Supabase backend: Auth (email magic link) + Postgres with RLS. Uses only the publishable/anon key.
export function supaBackend(cfg) {
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
  const uid = async () => (await sb.auth.getUser()).data.user?.id;
  const rows = async (q) => { const { data, error } = await q; if (error) throw error; return data || []; };
  return {
    mode: 'supabase',
    async session() { const { data } = await sb.auth.getSession(); return data.session ? { email: data.session.user.email } : null; },
    async sendLink(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/account/#/dashboard', shouldCreateUser: true } });
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async completeDemo() {},
    async signOut() { await sb.auth.signOut(); },
    async profile() { return (await rows(sb.from('profiles').select('full_name,business_name,phone').limit(1)))[0] || {}; },
    async saveProfile(p) { const { error } = await sb.from('profiles').upsert({ id: await uid(), ...p, updated_at: new Date().toISOString() }); if (error) throw error; },
    async products() { return rows(sb.from('products').select('kind,status,plan')); },
    async sites() { return rows(sb.from('sites').select('*').order('created_at', { ascending: false })); },
    async invoices() { return rows(sb.from('invoices').select('*').order('created_at', { ascending: false })); },
    async tickets() { return rows(sb.from('support_tickets').select('*').order('created_at', { ascending: false })); },
    async createTicket(t) { const { error } = await sb.from('support_tickets').insert({ ...t, user_id: await uid() }); if (error) throw error; },
  };
}
