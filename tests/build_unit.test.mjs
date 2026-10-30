// node --test tests/  — unit + regression tests for the web builder and /api/build-lead
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
import { onRequestPost, onRequestGet, parseLead } from '../functions/api/build-lead.js';
const ctx = { window: {}, document: { getElementById: () => null } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../site/build/builder.js', import.meta.url), 'utf8'), ctx);
const B = ctx.window.EWSBuilder;
const fakeDB = () => { const rows = []; return { rows, prepare: (sql) => ({ bind: (...a) => ({ run: async () => rows.push(a) }), run: async () => ({ sql }) }) }; };
const req = (body, h = {}) => new Request('https://x/api/build-lead', { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const good = { name: 'Ann', email: 'ann@example.com', business: 'Bluff City Bakery', domain: 'bluffcitybakery.com', draft: { type: 'bakery' } };

test('render escapes user text (no HTML injection into preview)', () => {
  const d = B.blank(); d.name = '<script>alert(1)</script>'; const h = B.render(d, 'Home');
  assert.ok(!h.includes('<script>alert')); assert.ok(h.includes('&lt;script&gt;'));
});
test('render covers every type, style and page', () => {
  for (const t of Object.keys(B.TYPES)) for (const s of Object.keys(B.STYLES)) for (const p of B.PAGES) {
    const d = B.blank(); d.type = t; d.style = s; d.pages = [...B.PAGES]; const h = B.render(d, p);
    assert.match(h, /^<!doctype html>/); assert.ok(h.includes('Draft by Elder World Studio'));
  }
});
test('render falls back to first page when page is not selected', () => { const d = B.blank(); d.pages = ['About']; assert.ok(B.render(d, 'Home').includes('About Your Business')); });
test('revisions change the output (darker header, accent)', () => {
  const d = B.blank(); const a = B.render(d, 'Home'); B.CHANGES.darker.apply(d); assert.notEqual(a, B.render(d, 'Home'));
  d.accent = '#123456'; assert.ok(B.render(d, 'Home').includes('#123456')); d.accent = 'red;}x{'; assert.ok(!B.render(d, 'Home').includes('red;}x{'));
});
test('client validation + domain suggestion', () => {
  assert.deepEqual([...B.validLead(good)], []); assert.deepEqual([...B.validLead({ email: 'x' })], ['name', 'email', 'business']);
  assert.equal(B.suggestDomain("Joe's Bar & Grill"), 'joesbarandgrill.com'); assert.equal(B.suggestDomain(''), '');
});
test('api stores a valid lead in D1 and returns an id', async () => {
  const db = fakeDB(); const r = await onRequestPost({ request: req(good), env: { BUILD_LEADS: db } }); const j = await r.json();
  assert.equal(r.status, 200); assert.ok(j.ok); assert.match(j.id, /^W-\d{10}-[0-9A-F]{4}$/); assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0][3], 'ann@example.com'); assert.equal(JSON.parse(db.rows[0][8]).type, 'bakery');
});
test('api rejects bad input and bad JSON', async () => {
  const db = fakeDB();
  assert.equal((await onRequestPost({ request: req({ name: 'a', email: 'nope' }), env: { BUILD_LEADS: db } })).status, 400);
  assert.equal((await onRequestPost({ request: req('{bad'), env: { BUILD_LEADS: db } })).status, 400);
  assert.equal((await onRequestPost({ request: req({ ...good, domain: 'a b<c>' }), env: { BUILD_LEADS: db } })).status, 400);
  assert.equal(db.rows.length, 0);
});
test('api: honeypot and too-fast submissions are dropped silently', async () => {
  const db = fakeDB();
  assert.ok((await (await onRequestPost({ request: req({ ...good, website_url: 'spam' }), env: { BUILD_LEADS: db } })).json()).ok);
  assert.ok((await (await onRequestPost({ request: req({ ...good, t: Date.now() }), env: { BUILD_LEADS: db } })).json()).ok);
  assert.equal(db.rows.length, 0);
});
test('api without D1 binding returns 503, never sends email', async () => {
  const orig = globalThis.fetch; let called = false; globalThis.fetch = () => { called = true; };
  const r = await onRequestPost({ request: req(good), env: {} }); globalThis.fetch = orig;
  assert.equal(r.status, 503); assert.equal(called, false);
});
test('field length limits', () => { const { d } = parseLead({ ...good, notes: 'x'.repeat(5000) }); assert.equal(d.notes.length, 2000); });
test('GET redirects to /build/', () => { assert.equal(onRequestGet().headers.get('Location'), '/build/'); });
test('regression: existing services lead form and pages untouched', () => {
  const s = fs.readFileSync(new URL('../site/services/index.html', import.meta.url), 'utf8'); assert.ok(s.includes('action="/api/lead"'));
  const b = fs.readFileSync(new URL('../site/build/index.html', import.meta.url), 'utf8');
  assert.ok(b.includes('Pricing on request')); assert.ok(!/\$\d/.test(b), 'no prices published before Joshua approves');
  assert.ok(b.includes('sandbox=""'));
});
