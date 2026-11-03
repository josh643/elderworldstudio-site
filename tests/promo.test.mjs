import test from 'node:test'; import assert from 'node:assert/strict';
import { checkPromo, createCheckout, handleStripeEvent } from '../functions/_lib/stripe.js';
function fakeDb() {
  const rows = new Map();
  const db = { rows, prepare(sql) { let args = []; const st = { bind(...a) { args = a; return st; },
    async run() { if (/INSERT OR IGNORE INTO promo_redemptions/.test(sql) && !rows.has(args[0])) rows.set(args[0], args[1]); return {}; },
    async first() { return { n: [...rows.values()].filter((c) => c === args[0]).length }; } }; return st; } };
  return db;
}
const env = (db) => ({ EWS_LIVE_PAYMENTS: '1', BUILD_LEADS: db, STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_PRICE_STARTER_SETUP: 'price_norm', STRIPE_PRICE_STARTER_MONTHLY: 'price_mo', STRIPE_PRICE_STARTER_SETUP_PROMO: 'price_249',
  STRIPE_PRICE_BUSINESS_SETUP: 'price_b', STRIPE_PRICE_BUSINESS_MONTHLY: 'price_bmo' });
test('MEMPHIS249 is case-insensitive and Starter only', async () => {
  const e = env(fakeDb());
  assert.equal((await checkPromo(e, 'starter', ' memphis249 ')).applied, true);
  assert.equal((await checkPromo(e, 'starter', 'NOPE')).applied, false);
  assert.match((await checkPromo(e, 'business', 'MEMPHIS249')).message, /Starter plan only/);
  assert.deepEqual(await checkPromo(e, 'starter', ''), { applied: false });
});
test('checkout uses the $249 price only when the code passes', async () => {
  const e = env(fakeDb()); const calls = [];
  const fetcher = async (u, o) => { calls.push(String(o.body)); return new Response(JSON.stringify({ id: 'cs_1', url: 'https://x' }), { status: 200 }); };
  const ok = await createCheckout({ env: e, plan: 'starter', email: 'a@b.co', promo: 'Memphis249', fetcher });
  assert.equal(ok.promo, 'applied'); assert.ok(calls[0].includes('price_249') && calls[0].includes('price_mo') && !calls[0].includes('price_norm'));
  const bad = await createCheckout({ env: e, plan: 'starter', email: 'a@b.co', promo: 'xx', fetcher });
  assert.equal(bad.promo, 'rejected'); assert.ok(calls[1].includes('price_norm') && !calls[1].includes('price_249'));
  assert.ok(!calls[0].includes('allow_promotion_codes'));
});
test('only paid webhooks count, cap of 10 enforced, idempotent per session', async () => {
  const db = fakeDb(); const e = env(db);
  const shop = { seenEvent: async () => false, markEvent: async () => {} };
  const ev = (id, paid) => ({ id: 'evt_' + id, type: 'checkout.session.completed', data: { object: { id: 'cs_' + id, payment_status: paid ? 'paid' : 'unpaid', status: 'complete', metadata: { promo: 'MEMPHIS249' } } } });
  await handleStripeEvent(e, ev('u', false), { shop }); assert.equal(db.rows.size, 0);
  for (let i = 0; i < 10; i++) { try { await handleStripeEvent(e, ev(i, true), { shop }); } catch {} }
  try { await handleStripeEvent(e, ev(0, true), { shop }); } catch {}
  assert.equal(db.rows.size, 10);
  assert.match((await checkPromo(e, 'starter', 'MEMPHIS249')).message, /All 10/);
});
test('FRIEND100 swaps in the $100-off setup price on all three tiers and logs paid uses', async () => {
  const rows = []; const db = { prepare(sql) { let a = []; const st = { bind(...x) { a = x; return st; }, async run() { if (/referral_redemptions \(session_id/.test(sql) && /INSERT/.test(sql)) rows.push(a); return {}; }, async first() { return { n: 0 }; } }; return st; } };
  const e = { ...env(db), STRIPE_PRICE_STARTER_SETUP_REF: 'price_sref', STRIPE_PRICE_BUSINESS_SETUP_REF: 'price_bref', STRIPE_PRICE_PLUS_SETUP_REF: 'price_pref' };
  assert.equal((await checkPromo(e, 'starter', 'friend100')).price, 'price_sref');
  assert.equal((await checkPromo(e, 'business', 'FRIEND100')).price, 'price_bref');
  assert.equal((await checkPromo(e, 'plus', 'FRIEND100')).price, 'price_pref');
  assert.equal((await checkPromo(e, 'take_it', 'FRIEND100')).applied, false);
  const shop = { seenEvent: async () => false, markEvent: async () => {} };
  try { await handleStripeEvent(e, { id: 'evt_r', type: 'checkout.session.completed', data: { object: { id: 'cs_r', payment_status: 'paid', status: 'complete', customer_details: { email: 'x@y.co' }, metadata: { promo: 'FRIEND100', plan: 'business' } } } }, { shop }); } catch {}
  assert.deepEqual(rows[0].slice(0, 4), ['cs_r', 'FRIEND100', 'business', 'x@y.co']);
});
