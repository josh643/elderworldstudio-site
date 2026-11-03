// Approved EWS web-builder catalog. Prices match /build/. Price IDs come from env only.
export const PLANS = {
  starter: { id: 'starter', name: 'Starter', setup: 349, monthly: 19, kind: 'subscription' },
  business: { id: 'business', name: 'Business', setup: 699, monthly: 39, kind: 'subscription' },
  plus: { id: 'plus', name: 'Plus', setup: 1299, monthly: 69, kind: 'subscription' },
  take_it: { id: 'take_it', name: 'Take it with you', setup: 99, monthly: 0, kind: 'one_time' },
};

export const PLAN_IDS = Object.keys(PLANS);

export function livePayments(env) {
  const v = String(env && env.EWS_LIVE_PAYMENTS || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

export function publicPlans() {
  return PLAN_IDS.map((id) => {
    const p = PLANS[id];
    return { id, name: p.name, setup: p.setup, monthly: p.monthly, kind: p.kind };
  });
}

export function parsePlan(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'takeit' || s === 'take_it_with_you' || s === 'takeitwithyou') return 'take_it';
  return PLAN_IDS.includes(s) ? s : '';
}

export function priceEnv(plan) {
  if (plan === 'take_it') return { setup: 'STRIPE_PRICE_TAKE_IT' };
  const key = plan.toUpperCase();
  return { setup: `STRIPE_PRICE_${key}_SETUP`, monthly: `STRIPE_PRICE_${key}_MONTHLY` };
}

export function resolvePriceIds(env, plan) {
  const keys = priceEnv(plan);
  const setup = String(env[keys.setup] || '').trim();
  const monthly = keys.monthly ? String(env[keys.monthly] || '').trim() : '';
  const ok = (id) => /^price_[A-Za-z0-9]+$/.test(id);
  if (plan === 'take_it') return ok(setup) ? { setup, monthly: '' } : null;
  return ok(setup) && ok(monthly) ? { setup, monthly } : null;
}

export function isTestStripeKey(key) {
  return /^(sk_test_|rk_test_)/.test(String(key || ''));
}

export function isLiveStripeKey(key) {
  return /^(sk_live_|rk_live_)/.test(String(key || ''));
}

// Never use a live secret unless the live-payments flag is on.
export function stripeSecret(env) {
  const key = String(env && env.STRIPE_SECRET_KEY || '').trim();
  if (!key) return '';
  if (isLiveStripeKey(key) && !livePayments(env)) return '';
  return key;
}

export function canDownload(customer) {
  if (!customer) return false;
  return ['active', 'canceled', 'past_due'].includes(customer.status) && !!customer.plan;
}

export function canPublish(customer) {
  if (!customer) return false;
  return customer.status === 'active' && customer.plan && customer.plan !== 'take_it';
}

export function canEdit(customer) {
  if (!customer) return false;
  return ['active', 'trial', 'past_due'].includes(customer.status) && !!customer.plan;
}

export const COOKIE = 'ews_session';
export const SESSION_DAYS = 30;
