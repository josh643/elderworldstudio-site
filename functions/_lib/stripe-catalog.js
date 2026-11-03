// TEST-mode only catalog for the four /build/ plans. Never creates live products.
import { PLAN_IDS, PLANS, isLiveStripeKey, isTestStripeKey, priceEnv } from './plans.js';
import { formBody } from './stripe.js';

export const CATALOG_META = 'ews-web-builder-test';
const STRIPE = 'https://api.stripe.com/v1';

export function refuseLiveCatalogKey(key) {
  const k = String(key || '').trim();
  if (isLiveStripeKey(k)) throw new Error('Refusing to create live Stripe products. Use a sk_test_ or rk_test_ key.');
  if (!isTestStripeKey(k) || k.startsWith('sk_test_mock')) throw new Error('Need a Stripe TEST key (sk_test_… or rk_test_…).');
  return k;
}

export async function stripeRequest(key, method, path, params, fetcher = fetch) {
  const opts = { method, headers: { Authorization: `Bearer ${key}` } };
  let url = STRIPE + path;
  if (method === 'GET' && params) url += '?' + new URLSearchParams(formBody(params));
  else if (params && method !== 'GET' && method !== 'DELETE') {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = new URLSearchParams(formBody(params));
  }
  const r = await fetcher(url, opts);
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error?.message || `stripe ${r.status} ${path}`);
  return json;
}

async function listAll(key, path, fetcher, extra = {}) {
  const out = [];
  let starting_after;
  for (let i = 0; i < 10; i++) {
    const page = await stripeRequest(key, 'GET', path, { limit: 100, starting_after, ...extra }, fetcher);
    out.push(...(page.data || []));
    if (!page.has_more) break;
    starting_after = out[out.length - 1] && out[out.length - 1].id;
    if (!starting_after) break;
  }
  return out;
}

function matchPrice(prices, plan, kind) {
  const amount = (kind === 'monthly' ? plan.monthly : plan.setup) * 100;
  return prices.find((p) => {
    if (p.metadata && p.metadata.ews_catalog === CATALOG_META && p.metadata.ews_plan === plan.id && p.metadata.ews_price === kind) return true;
    const recurring = kind === 'monthly';
    const isRecurring = !!(p.recurring && p.recurring.interval === 'month');
    return p.unit_amount === amount && p.currency === 'usd' && isRecurring === recurring && p.active !== false;
  }) || null;
}

async function ensurePrice(key, productId, plan, kind, existing, fetcher) {
  const found = matchPrice(existing, plan, kind);
  if (found) return found;
  const params = {
    product: productId,
    currency: 'usd',
    unit_amount: (kind === 'monthly' ? plan.monthly : plan.setup) * 100,
    metadata: { ews_catalog: CATALOG_META, ews_plan: plan.id, ews_price: kind },
  };
  if (kind === 'monthly') params.recurring = { interval: 'month' };
  return stripeRequest(key, 'POST', '/prices', params, fetcher);
}

export function envFromCatalog(catalog) {
  const env = {};
  for (const id of PLAN_IDS) {
    const keys = priceEnv(id);
    env[keys.setup] = catalog[id].setup;
    if (keys.monthly) env[keys.monthly] = catalog[id].monthly;
  }
  return env;
}

export function formatCatalogEnv(catalog) {
  const env = envFromCatalog(catalog);
  const lines = ['# Stripe TEST catalog — do not paste these IDs into a live environment'];
  for (const [k, v] of Object.entries(env)) lines.push(`export ${k}=${v}`);
  return lines.join('\n');
}

export async function ensureTestCatalog(key, fetcher = fetch) {
  const secret = refuseLiveCatalogKey(key);
  const products = await listAll(secret, '/products', fetcher);
  const catalog = {};
  for (const id of PLAN_IDS) {
    const plan = PLANS[id];
    let product = products.find((p) => p.metadata && p.metadata.ews_catalog === CATALOG_META && p.metadata.ews_plan === id);
    if (!product) {
      product = await stripeRequest(secret, 'POST', '/products', {
        name: `EWS ${plan.name} website (TEST)`,
        description: plan.kind === 'one_time'
          ? 'Take it with you — zip of the static site. TEST catalog only.'
          : `${plan.name} website: setup plus monthly. TEST catalog only.`,
        metadata: { ews_catalog: CATALOG_META, ews_plan: id },
      }, fetcher);
      products.push(product);
    }
    const prices = await listAll(secret, '/prices', fetcher, { product: product.id });
    const setup = await ensurePrice(secret, product.id, plan, 'setup', prices, fetcher);
    const monthly = plan.monthly ? await ensurePrice(secret, product.id, plan, 'monthly', prices, fetcher) : { id: '' };
    catalog[id] = { product: product.id, setup: setup.id, monthly: monthly.id };
  }
  return catalog;
}
