// POST /api/stripe-webhook — verify signature, provision plan + site. Never trust the success page.
import { handleStripeEvent, verifyStripeSignature, mockStripe } from '../_lib/stripe.js';
import { shopFromEnv } from '../_lib/shop.js';
import { json } from '../_lib/http.js';

export async function onRequestPost({ request, env }) {
  const payload = await request.text();
  const sig = request.headers.get('stripe-signature') || '';
  const secret = env.STRIPE_WEBHOOK_SECRET || '';
  if (secret) {
    const ok = await verifyStripeSignature(payload, sig, secret);
    if (!ok) return json({ ok: false, error: 'bad signature' }, 400);
  } else if (!mockStripe(env)) {
    return json({ ok: false, error: 'webhook secret missing' }, 503);
  }
  let event;
  try { event = JSON.parse(payload); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  if (!event || !event.type) return json({ ok: false, error: 'bad event' }, 400);
  const shop = await shopFromEnv(env);
  const out = await handleStripeEvent(env, event, { shop });
  return json({ ok: !!out.ok, ...out }, out.ok ? 200 : 400);
}

export const onRequestGet = () => new Response(null, { status: 404 });
