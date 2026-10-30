import test from 'node:test'; import assert from 'node:assert/strict';
import * as c from '../site/account/core.js';
import { onRequestGet } from '../functions/api/client-config.js';
const jwt = (role) => 'x.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.y';
test('route guard', () => {
  assert.equal(c.guard('dashboard', false), 'login'); assert.equal(c.guard('login', true), 'dashboard');
  assert.equal(c.guard('support', true), 'support'); assert.equal(c.parseRoute('#/billing'), 'billing');
  assert.equal(c.parseRoute('#/nope'), 'dashboard'); assert.equal(c.parseRoute('#/support?about=pos'), 'support');
});
test('email + ticket validation', () => {
  assert.ok(c.isEmail('a@b.co')); assert.ok(!c.isEmail('a@b')); assert.ok(!c.isEmail(''));
  assert.ok(c.validateTicket({ subject: 'Help me', body: 'Need a new menu page', category: 'website' }).ok);
  assert.ok(!c.validateTicket({ subject: 'x', body: 'short', category: 'bogus' }).ok);
  assert.equal(c.validateTicket({ subject: 'x', body: 'short', category: 'bogus' }).errors.length, 3);
});
test('approved prices', () => {
  assert.deepEqual([c.PLANS.starter.setup, c.PLANS.starter.monthly, c.PLANS.business.setup, c.PLANS.business.monthly, c.PLANS.plus.setup, c.PLANS.plus.monthly], [349, 19, 699, 39, 1299, 69]);
});
test('products default to not active', () => {
  const m = c.mergeProducts([{ kind: 'pos', status: 'active' }]);
  assert.equal(m.length, 5); assert.equal(m.find((x) => x.kind === 'pos').status, 'active');
  assert.equal(m.filter((x) => x.status === 'not_active').length, 4);
});
test('escaping + money', () => { assert.equal(c.esc('<a "x">'), '&lt;a &quot;x&quot;&gt;'); assert.equal(c.money(34900), '$349.00'); });
test('secret keys detected', () => {
  assert.ok(c.isSecretKey('sb_secret_abc')); assert.ok(c.isSecretKey(jwt('service_role')));
  assert.ok(!c.isSecretKey(jwt('anon'))); assert.ok(!c.isSecretKey('sb_publishable_abc'));
});
test('client-config never returns a secret key', async () => {
  const g = async (env) => (await onRequestGet({ env })).json();
  assert.deepEqual(await g({}), { mode: 'demo' });
  assert.deepEqual(await g({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_zzz' }), { mode: 'demo' });
  assert.deepEqual(await g({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: jwt('service_role') }), { mode: 'demo' });
  assert.equal((await g({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ok' })).supabaseKey, 'sb_publishable_ok');
});
test('domain price is a flat customer price with no markup wording', () => {
  assert.equal(c.DOMAIN_PRICE_YR, 13); assert.equal(c.DOMAIN_FEE, 'Custom domain: from $13/yr');
  assert.doesNotMatch(c.DOMAIN_FEE, /registrar|cost|\+|markup/i);
});
