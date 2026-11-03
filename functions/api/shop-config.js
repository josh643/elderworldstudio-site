// GET /api/shop-config — public flags and plan list. No secrets. livePayments defaults off.
import { livePayments, publicPlans } from '../_lib/plans.js';
import { json } from '../_lib/http.js';

export async function onRequestGet({ env }) {
  return json({
    livePayments: livePayments(env),
    plans: publicPlans(),
    auth: env.SUPABASE_URL ? 'supabase' : 'shop',
  });
}
