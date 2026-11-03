// POST /api/checkout — Stripe Checkout session. Refuses unless EWS_LIVE_PAYMENTS is on.
import { livePayments, parsePlan } from '../_lib/plans.js';
import { currentCustomer, isEmail } from '../_lib/auth.js';
import { createCheckout } from '../_lib/stripe.js';
import { shopFromEnv } from '../_lib/shop.js';
import { json, originOf, readJson } from '../_lib/http.js';

export async function onRequestPost({ request, env }) {
  if (!livePayments(env)) return json({ ok: false, error: 'payments-off' }, 403);
  const shop = await shopFromEnv(env);
  if (!shop) return json({ ok: false, error: 'Store is not configured.' }, 503);
  const body = await readJson(request) || {};
  const plan = parsePlan(body.plan);
  if (!plan) return json({ ok: false, error: 'Pick a plan.' }, 400);
  const customer = await currentCustomer(request, env, shop);
  const email = String(body.email || customer?.email || '').trim().toLowerCase();
  if (!isEmail(email)) return json({ ok: false, error: 'Enter a valid email address.' }, 400);
  try {
    const session = await createCheckout({
      env, plan, email, customerId: customer?.id || '', origin: originOf(request, env),
    });
    return json(session, session.ok ? 200 : session.status || 400);
  } catch (e) {
    return json({ ok: false, error: 'Could not start payment.' }, 502);
  }
}

export const onRequestGet = () => new Response(null, { status: 303, headers: { Location: '/build/' } });
