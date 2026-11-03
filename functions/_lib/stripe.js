// Stripe Checkout + webhook + portal. TEST mode by default. Fulfillment is webhook-only.
import { PLANS, livePayments, parsePlan, resolvePriceIds, stripeSecret } from './plans.js';
import { newCustomer, newOrder, newSite, shopFromEnv } from './shop.js';
import { sendWelcome, sendReceipt } from './email.js';

const STRIPE = 'https://api.stripe.com/v1';
const enc = new TextEncoder();

export function formBody(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => out.push(...formBody(item, `${key}[${i}]`)));
    else if (typeof v === 'object') out.push(...formBody(v, key));
    else out.push([key, String(v)]);
  }
  return out;
}

export async function stripeFetch(env, path, params, fetcher = fetch) {
  const key = stripeSecret(env);
  if (!key) throw new Error('stripe-unconfigured');
  const body = new URLSearchParams(formBody(params));
  const r = await fetcher(STRIPE + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error?.message || `stripe ${r.status}`);
  return json;
}

export function mockStripe(env) {
  return env.EWS_STRIPE_MOCK === '1' || String(env.STRIPE_SECRET_KEY || '').startsWith('sk_test_mock');
}

export async function createCheckout({ env, plan, email, customerId, origin, fetcher = fetch }) {
  if (!livePayments(env)) return { ok: false, error: 'payments-off', status: 403 };
  const id = parsePlan(plan);
  if (!id) return { ok: false, error: 'Unknown plan.', status: 400 };
  const catalog = PLANS[id];
  const prices = resolvePriceIds(env, id);
  if (!prices && !mockStripe(env)) return { ok: false, error: 'This plan is not priced yet.', status: 503 };
  const base = String(origin || env.PUBLIC_ORIGIN || 'https://elderworldstudio.com').replace(/\/$/, '');
  const success = `${base}/account/?paid=1&plan=${id}`;
  const cancel = `${base}/build/?canceled=1#plans`;
  const metadata = { plan: id, ews_customer_id: customerId || '' };
  const integration = 'ews-web-' + Math.random().toString(36).slice(2, 10);

  if (mockStripe(env)) {
    const sid = 'cs_test_mock_' + crypto.randomUUID().slice(0, 12);
    return {
      ok: true,
      mock: true,
      url: `${base}/__pay/${sid}?plan=${id}&email=${encodeURIComponent(email || '')}`,
      id: sid,
      plan: id,
    };
  }

  const params = {
    mode: catalog.kind === 'one_time' ? 'payment' : 'subscription',
    success_url: success + '&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancel,
    client_reference_id: customerId || email || '',
    customer_email: email || undefined,
    metadata,
    integration_identifier: integration,
  };
  if (catalog.kind === 'one_time') {
    params.line_items = [{ price: prices.setup, quantity: 1 }];
    params.payment_intent_data = { metadata };
  } else {
    params.line_items = [
      { price: prices.setup, quantity: 1 },
      { price: prices.monthly, quantity: 1 },
    ];
    params.subscription_data = { metadata };
  }
  const session = await stripeFetch(env, '/checkout/sessions', params, fetcher);
  return { ok: true, url: session.url, id: session.id, plan: id };
}

export async function createPortal({ env, customer, origin, fetcher = fetch }) {
  if (!customer?.stripe_customer_id) return { ok: false, error: 'No billing account yet.', status: 400 };
  const base = String(origin || env.PUBLIC_ORIGIN || 'https://elderworldstudio.com').replace(/\/$/, '');
  if (mockStripe(env)) {
    return { ok: true, mock: true, url: `${base}/__pay/portal?customer=${encodeURIComponent(customer.stripe_customer_id)}` };
  }
  const session = await stripeFetch(env, '/billing_portal/sessions', {
    customer: customer.stripe_customer_id,
    return_url: `${base}/account/#/billing`,
  }, fetcher);
  return { ok: true, url: session.url };
}

export async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  const x = String(a), y = String(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

export async function verifyStripeSignature(payload, header, secret, now = Date.now()) {
  if (!secret || !header) return false;
  const parts = {};
  for (const p of String(header).split(',')) {
    const i = p.indexOf('=');
    if (i > 0) {
      const k = p.slice(0, i).trim();
      const v = p.slice(i + 1).trim();
      (parts[k] = parts[k] || []).push(v);
    }
  }
  const t = Number(parts.t && parts.t[0]);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const expected = await hmacHex(secret, `${t}.${payload}`);
  return (parts.v1 || []).some((s) => timingSafeEqual(s, expected));
}

export function sessionPaid(session) {
  if (!session) return false;
  return session.payment_status && session.payment_status !== 'unpaid';
}

export function planFromSession(session) {
  return parsePlan(session?.metadata?.plan || session?.subscription_details?.metadata?.plan || '');
}

export async function provisionFromSession(shop, session, env, mailer) {
  const email = String(session.customer_details?.email || session.customer_email || '').toLowerCase().trim();
  const plan = planFromSession(session);
  if (!email || !plan) return { ok: false, error: 'missing-email-or-plan' };
  const existingOrder = await shop.findOrderBySession(session.id);
  if (existingOrder) return { ok: true, idempotent: true, order: existingOrder };

  let customer = (session.metadata?.ews_customer_id && await shop.findCustomerById(session.metadata.ews_customer_id))
    || (session.customer && await shop.findCustomerByStripe(session.customer))
    || await shop.findCustomerByEmail(email);
  if (!customer) customer = newCustomer({ email, name: session.customer_details?.name || '' });
  customer.email = email;
  if (session.customer_details?.name) customer.name = session.customer_details.name;
  if (session.customer) customer.stripe_customer_id = session.customer;
  if (typeof session.subscription === 'string') customer.stripe_subscription_id = session.subscription;
  else if (session.subscription?.id) customer.stripe_subscription_id = session.subscription.id;
  customer.plan = plan;
  customer.status = 'active';
  customer = await shop.upsertCustomer(customer);

  const amount = PLANS[plan].setup * 100 + PLANS[plan].monthly * 100;
  const order = await shop.insertOrder(newOrder({
    customer_id: customer.id,
    email,
    stripe_session_id: session.id,
    plan,
    kind: PLANS[plan].kind,
    amount_cents: session.amount_total || amount,
    status: 'paid',
  }));

  const sites = await shop.listSites(customer.id);
  let site = sites[0];
  if (!site) {
    site = await shop.upsertSite(newSite({
      customer_id: customer.id,
      name: customer.name || 'My website',
      plan,
    }));
  } else if (site.plan !== plan) {
    site = await shop.upsertSite({ ...site, plan, updated: new Date().toISOString() });
  }

  await shop.insertInvoice({
    id: 'inv-' + crypto.randomUUID(),
    customer_id: customer.id,
    stripe_invoice_id: session.invoice || ('sess-' + session.id),
    amount_cents: order.amount_cents,
    description: `${PLANS[plan].name} website`,
    status: 'paid',
    hosted_url: session.url || '',
    created: new Date().toISOString(),
  });

  if (mailer !== false) {
    await sendWelcome(env, customer, plan, site).catch(() => {});
    await sendReceipt(env, customer, plan, order).catch(() => {});
  }
  return { ok: true, customer, site, order };
}

export async function applySubscriptionEvent(shop, sub) {
  const customer = (sub.customer && await shop.findCustomerByStripe(sub.customer)) || null;
  if (!customer) return { ok: false, error: 'unknown-customer' };
  const status = ({ active: 'active', trialing: 'trial', past_due: 'past_due', canceled: 'canceled', unpaid: 'past_due', incomplete: 'none' })[sub.status] || customer.status;
  customer.status = status;
  if (sub.id) customer.stripe_subscription_id = sub.id;
  if (status === 'canceled') { /* keep plan so download still works */ }
  await shop.upsertCustomer(customer);
  return { ok: true, customer };
}

export async function handleStripeEvent(env, event, { shop, mailer } = {}) {
  shop = shop || await shopFromEnv(env);
  if (!shop) return { ok: false, error: 'no-store' };
  if (event.id && await shop.seenEvent(event.id)) return { ok: true, idempotent: true };
  if (event.id) await shop.markEvent(event.id, event.type);
  const obj = event.data && event.data.object ? event.data.object : {};
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    if (!sessionPaid(obj) && event.type === 'checkout.session.completed') return { ok: true, skipped: 'unpaid' };
    return provisionFromSession(shop, obj, env, mailer);
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    if (event.type === 'customer.subscription.deleted') obj.status = 'canceled';
    return applySubscriptionEvent(shop, obj);
  }
  if (event.type === 'invoice.paid' && obj.customer) {
    const customer = await shop.findCustomerByStripe(obj.customer);
    if (customer && obj.id) {
      await shop.insertInvoice({
        id: 'inv-' + crypto.randomUUID(),
        customer_id: customer.id,
        stripe_invoice_id: obj.id,
        amount_cents: obj.amount_paid || 0,
        description: obj.description || 'Website plan',
        status: 'paid',
        hosted_url: obj.hosted_invoice_url || '',
        created: new Date((obj.created || Date.now() / 1000) * 1000).toISOString(),
      });
    }
    return { ok: true };
  }
  return { ok: true, ignored: event.type };
}
