import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, livePayments, parsePlan, publicPlans, resolvePriceIds, stripeSecret, canDownload, canPublish, canEdit, useRealStripeTest } from '../functions/_lib/plans.js';
import { ensureTestCatalog, refuseLiveCatalogKey, formatCatalogEnv } from '../functions/_lib/stripe-catalog.js';
import { createMemoryShop, newCustomer, newSite, shopFromEnv } from '../functions/_lib/shop.js';
import { isEmail, requestLoginLink, consumeLoginLink, currentCustomer, sha256Hex } from '../functions/_lib/auth.js';
import { handleStripeEvent, provisionFromSession, verifyStripeSignature, hmacHex, sessionPaid, createCheckout } from '../functions/_lib/stripe.js';
import { welcomeText, receiptText } from '../functions/_lib/email.js';
import { zipFiles, crc32 } from '../functions/_lib/zip.js';
import { renderPage, siteFiles } from '../functions/_lib/render.js';
import { onRequestGet as shopConfig } from '../functions/api/shop-config.js';
import { onRequestPost as checkoutPost } from '../functions/api/checkout.js';

test('approved prices and $99 take-it', () => {
  assert.deepEqual([PLANS.starter.setup, PLANS.starter.monthly, PLANS.business.setup, PLANS.business.monthly, PLANS.plus.setup, PLANS.plus.monthly, PLANS.take_it.setup, PLANS.take_it.monthly], [349, 19, 699, 39, 1299, 69, 99, 0]);
  assert.equal(parsePlan('Take it with you'), 'take_it');
  assert.equal(parsePlan('Business'), 'business');
  assert.equal(publicPlans().length, 4);
});

test('live-payments flag defaults off', async () => {
  assert.equal(livePayments({}), false);
  assert.equal(livePayments({ EWS_LIVE_PAYMENTS: '0' }), false);
  assert.equal(livePayments({ EWS_LIVE_PAYMENTS: '1' }), true);
  const res = await shopConfig({ env: {} });
  const body = await res.json();
  assert.equal(body.livePayments, false);
});

test('live Stripe keys are ignored while the flag is off', () => {
  assert.equal(stripeSecret({ STRIPE_SECRET_KEY: 'sk_live_abc', EWS_LIVE_PAYMENTS: '' }), '');
  assert.equal(stripeSecret({ STRIPE_SECRET_KEY: 'sk_test_abc', EWS_LIVE_PAYMENTS: '' }), 'sk_test_abc');
});

test('price IDs come from env only', () => {
  assert.equal(resolvePriceIds({}, 'starter'), null);
  assert.ok(resolvePriceIds({ STRIPE_PRICE_STARTER_SETUP: 'price_abc123', STRIPE_PRICE_STARTER_MONTHLY: 'price_def456' }, 'starter'));
});

test('checkout is refused when payments are off', async () => {
  const shop = createMemoryShop();
  const res = await checkoutPost({
    request: new Request('http://x/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'starter', email: 'a@b.co' }) }),
    env: { SHOP: shop },
  });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'payments-off');
});

test('magic-link auth issues a session', async () => {
  const shop = createMemoryShop();
  const env = { PUBLIC_ORIGIN: 'http://127.0.0.1:8877', SHOP: shop };
  const link = await requestLoginLink(shop, 'dana@example.com', env);
  assert.ok(link.ok && link.token);
  const used = await consumeLoginLink(shop, link.token, { secure: false });
  assert.ok(used.ok);
  const req = new Request('http://x/api/me', { headers: { cookie: used.cookie.split(';')[0] } });
  const customer = await currentCustomer(req, env, shop);
  assert.equal(customer.email, 'dana@example.com');
  assert.ok(isEmail('dana@example.com'));
  assert.ok(!isEmail('nope'));
  await sha256Hex('x');
});

test('webhook provisions a site and is idempotent', async () => {
  const shop = createMemoryShop();
  const session = {
    id: 'cs_test_1', payment_status: 'paid', customer: 'cus_1', customer_email: 'dana@example.com',
    customer_details: { email: 'dana@example.com', name: 'Dana' }, metadata: { plan: 'starter' }, amount_total: 36800,
  };
  const first = await provisionFromSession(shop, session, {}, false);
  assert.ok(first.ok && first.site && first.customer.status === 'active');
  const again = await provisionFromSession(shop, session, {}, false);
  assert.ok(again.idempotent);
  const sites = await shop.listSites(first.customer.id);
  assert.equal(sites.length, 1);
});

test('unpaid checkout.session.completed does not provision', async () => {
  const shop = createMemoryShop();
  const out = await handleStripeEvent({}, {
    id: 'evt_unpaid', type: 'checkout.session.completed',
    data: { object: { id: 'cs_u', payment_status: 'unpaid', customer_email: 'a@b.co', metadata: { plan: 'starter' } } },
  }, { shop, mailer: false });
  assert.equal(out.skipped, 'unpaid');
  assert.equal(await shop.findCustomerByEmail('a@b.co'), null);
});

test('subscription canceled keeps download, drops publish', async () => {
  const shop = createMemoryShop();
  const customer = await shop.upsertCustomer({ ...newCustomer({ email: 'a@b.co', plan: 'business', status: 'active' }), stripe_customer_id: 'cus_x' });
  await handleStripeEvent({}, {
    id: 'evt_c', type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_x', customer: 'cus_x', status: 'canceled' } },
  }, { shop, mailer: false });
  const after = await shop.findCustomerById(customer.id);
  assert.equal(after.status, 'canceled');
  assert.equal(canDownload(after), true);
  assert.equal(canPublish(after), false);
  assert.equal(canEdit(after), false);
});

test('webhook signature verifies', async () => {
  const payload = '{"id":"evt_1"}';
  const secret = 'whsec_test';
  const t = Math.floor(Date.now() / 1000);
  const v1 = await hmacHex(secret, `${t}.${payload}`);
  assert.ok(await verifyStripeSignature(payload, `t=${t},v1=${v1}`, secret));
  assert.ok(!(await verifyStripeSignature(payload, `t=${t},v1=deadbeef`, secret)));
});

test('real Stripe TEST is detected from sk_test_/rk_test_ keys', () => {
  assert.equal(useRealStripeTest({ STRIPE_SECRET_KEY: 'sk_test_abc' }), true);
  assert.equal(useRealStripeTest({ STRIPE_SECRET_KEY: 'rk_test_abc' }), true);
  assert.equal(useRealStripeTest({ STRIPE_SECRET_KEY: 'sk_test_mock' }), false);
  assert.equal(useRealStripeTest({ STRIPE_SECRET_KEY: 'sk_test_abc', EWS_STRIPE_MOCK: '1' }), false);
  assert.equal(useRealStripeTest({ STRIPE_SECRET_KEY: 'sk_live_abc' }), false);
});

test('TEST catalog script refuses live keys and creates four plans', async () => {
  assert.throws(() => refuseLiveCatalogKey('sk_live_abc'), /live/);
  assert.throws(() => refuseLiveCatalogKey('sk_test_mock'), /TEST key/);
  const products = [];
  const prices = [];
  let n = 1;
  const fetcher = async (url, opts = {}) => {
    const u = new URL(url);
    const method = opts.method || 'GET';
    const body = opts.body ? Object.fromEntries(new URLSearchParams(opts.body)) : {};
    if (method === 'GET' && u.pathname === '/v1/products') return new Response(JSON.stringify({ data: products, has_more: false }), { headers: { 'content-type': 'application/json' } });
    if (method === 'GET' && u.pathname === '/v1/prices') {
      const prod = u.searchParams.get('product');
      return new Response(JSON.stringify({ data: prices.filter((p) => !prod || p.product === prod), has_more: false }), { headers: { 'content-type': 'application/json' } });
    }
    if (method === 'POST' && u.pathname === '/v1/products') {
      const p = { id: 'prod_' + n++, name: body.name, metadata: { ews_catalog: body['metadata[ews_catalog]'], ews_plan: body['metadata[ews_plan]'] } };
      products.push(p);
      return new Response(JSON.stringify(p), { headers: { 'content-type': 'application/json' } });
    }
    if (method === 'POST' && u.pathname === '/v1/prices') {
      const p = { id: 'price_' + n++, product: body.product, unit_amount: Number(body.unit_amount), currency: body.currency, recurring: body['recurring[interval]'] ? { interval: body['recurring[interval]'] } : null, metadata: { ews_catalog: body['metadata[ews_catalog]'], ews_plan: body['metadata[ews_plan]'], ews_price: body['metadata[ews_price]'] } };
      prices.push(p);
      return new Response(JSON.stringify(p), { headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: { message: 'unexpected ' + method + ' ' + u.pathname } }), { status: 400 });
  };
  const catalog = await ensureTestCatalog('sk_test_unit', fetcher);
  assert.equal(Object.keys(catalog).length, 4);
  assert.match(catalog.starter.setup, /^price_/);
  assert.match(catalog.starter.monthly, /^price_/);
  assert.match(catalog.take_it.setup, /^price_/);
  assert.equal(catalog.take_it.monthly, '');
  const again = await ensureTestCatalog('sk_test_unit', fetcher);
  assert.equal(again.starter.setup, catalog.starter.setup);
  assert.match(formatCatalogEnv(catalog), /STRIPE_PRICE_TAKE_IT=price_/);
});

test('sessionPaid and mock checkout url', async () => {
  assert.ok(sessionPaid({ payment_status: 'paid' }));
  assert.ok(!sessionPaid({ payment_status: 'unpaid' }));
  const r = await createCheckout({ env: { EWS_LIVE_PAYMENTS: '1', EWS_STRIPE_MOCK: '1', PUBLIC_ORIGIN: 'http://x' }, plan: 'plus', email: 'a@b.co' });
  assert.ok(r.ok && r.mock && r.url.includes('/__pay/'));
});

test('welcome and receipt copy stay generic', () => {
  const c = { email: 'dana@example.com', name: 'Dana' };
  const w = welcomeText(c, 'starter', { id: 'site-1' });
  const r = receiptText(c, 'starter', { amount_cents: 36800 });
  assert.match(w, /Starter/);
  assert.match(r, /\$368\.00/);
  assert.doesNotMatch(w + r, /marlon|cap\s*bar/i);
});

test('zip + render escape owner text', () => {
  const site = newSite({ customer_id: 'c1', name: '<script>x</script>', plan: 'starter' });
  site.draft = JSON.stringify({ name: '<script>x</script>', pages: ['Home'] });
  const html = renderPage(site, 'Home');
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('&lt;script&gt;'));
  const zip = zipFiles(siteFiles(site));
  assert.equal(zip[0], 0x50);
  assert.equal(zip[1], 0x4b);
  assert.equal(crc32(new TextEncoder().encode('hello')) >>> 0, 0x3610a686);
});

test('shopFromEnv uses injected store', async () => {
  const shop = createMemoryShop();
  assert.equal(await shopFromEnv({ SHOP: shop }), shop);
});
