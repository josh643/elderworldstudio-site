// POST /api/portal — Stripe Customer Portal (cancel / update card).
import { currentCustomer } from '../_lib/auth.js';
import { createPortal } from '../_lib/stripe.js';
import { shopFromEnv } from '../_lib/shop.js';
import { json, originOf } from '../_lib/http.js';

export async function onRequestPost({ request, env }) {
  const shop = await shopFromEnv(env);
  if (!shop) return json({ ok: false, error: 'Store is not configured.' }, 503);
  const customer = await currentCustomer(request, env, shop);
  if (!customer) return json({ ok: false, error: 'Sign in first.' }, 401);
  try {
    const r = await createPortal({ env, customer, origin: originOf(request, env) });
    return json(r, r.ok ? 200 : r.status || 400);
  } catch {
    return json({ ok: false, error: 'Could not open billing.' }, 502);
  }
}
