// GET /api/client-config — public browser config for the client area. Only the publishable/anon key, never a secret.
import { isSecretKey } from '../../site/account/core.js';
export async function onRequestGet({ env }) {
  const url = env.SUPABASE_URL || '', key = env.SUPABASE_PUBLISHABLE_KEY || '';
  const ok = url.startsWith('https://') && key && !isSecretKey(key);
  return Response.json(ok ? { supabaseUrl: url, supabaseKey: key } : { mode: 'demo' }, { headers: { 'Cache-Control': 'no-store' } });
}
