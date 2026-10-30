// node --test tests/ — AI spec: validation, sanitization, rate limits + $ cap, fallback, training log (PII + consent), JSONL export, client renderer.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
import * as L from '../functions/_lib/sitespec.js';
import { onRequestPost } from '../functions/api/build-ai.js';
import { toTriples } from '../tools/training-jsonl.mjs';

// Minimal D1 stand-in that understands the statements sitespec.js issues.
function memD1() {
  const rl = new Map(), cost = new Map(), train = [];
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b),
    async run() { if (/^INSERT INTO ai_cost/.test(sql)) { const c = cost.get(a[0]) || { usd: 0, calls: 0 }; c.usd += a[1]; c.calls++; cost.set(a[0], c); }
      else if (/^INSERT INTO train_events/.test(sql)) { const k = ['created', 'session', 'event', 'name_consent', 'input', 'request', 'spec', 'diff', 'outcome', 'source', 'generator']; train.push(Object.fromEntries(k.map((x, i) => [x, a[i]]))); }
      else if (/^DELETE FROM ai_rl/.test(sql)) { for (const [k, v] of rl) if (v.exp < a[0]) rl.delete(k); } return { success: true }; },
    async first() { if (/^SELECT usd FROM ai_cost/.test(sql)) return cost.get(a[0]) || null;
      if (/^INSERT INTO ai_rl/.test(sql)) { const [k, exp, now] = a, v = rl.get(k); if (!v || v.exp < now) rl.set(k, { n: 1, exp }); else v.n++; return { n: rl.get(k).n }; } return null; } });
  return { rl, cost, train, prepare: (sql) => stmt(sql), batch: async (s) => Promise.all(s.map(x => x.run())) };
}
const good = () => ({ palette: { bg: '#fdf8f2', surface: '#f2e6d8', ink: '#2b1a10', accent: '#b5542a', accent2: '#5b3a22' }, fonts: { head: 'fraunces', body: 'lora' }, hero: 'split', radius: 14,
  headline: 'Bread worth the drive', subhead: 'Sourdough on Broad Ave', about: 'Since 2011.', tone: 'warm', imagery: 'flour-dusted hands, morning light', cta: { label: 'Order a loaf', note: 'Call ahead' },
  sections: [{ kind: 'menu', variant: 'list', title: 'Today', intro: '', items: [{ name: 'Sourdough', text: 'Crackly crust', price: '$9' }] }, { kind: 'testimonials', variant: 'quote', title: 'Neighbors say', intro: '', items: [{ name: 'Dee', text: 'Best in Memphis' }] }] });
const inp = (o = {}) => L.parseInput({ name: 'Bluff City Bakery', type: 'bakery', story: 'Family bakery. Call 901-555-0123 or bluff@example.com', ...o });
const req = (b, ip = '1.2.3.4') => new Request('https://x/api/build-ai', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(b) });
const aiOK = (spec = good(), neurons = 900) => ({ run: async () => ({ response: spec, usage: { prompt_tokens: 900, completion_tokens: 700 }, neurons }) });

test('validateSpec accepts a good spec and keeps the layout', () => { const v = L.validateSpec(good()); assert.ok(v.ok, v.errors); assert.equal(v.spec.hero, 'split'); assert.equal(v.spec.sections[0].kind, 'menu'); });
test('validateSpec rejects/repairs bad colors, fonts, enums and caps sections', () => {
  const g = good(); g.palette.accent = 'red;}body{x'; g.fonts.head = 'Comic Sans'; g.hero = 'javascript'; g.sections = Array(30).fill(g.sections[0]); g.sections.push({ kind: 'iframe', title: 'x', items: [] });
  const v = L.validateSpec(g); const s = JSON.stringify(v.spec);
  assert.ok(/^#[0-9a-f]{6}$/i.test(v.spec.palette.accent)); assert.ok(L.FONTS[v.spec.fonts.head]); assert.ok(L.HERO.includes(v.spec.hero));
  assert.ok(v.spec.sections.length <= 10); assert.ok(!s.includes('iframe')); assert.ok(!s.includes('red;}'));
});
test('validateSpec fixes unreadable ink-on-bg contrast', () => { const g = good(); g.palette.ink = '#fefefe'; const v = L.validateSpec(g); assert.ok(L.contrast(v.spec.palette.ink, v.spec.palette.bg) >= 4.5); });
test('validateSpec fails on garbage', () => { assert.equal(L.validateSpec(null).ok, false); assert.equal(L.validateSpec('x').ok, false); assert.equal(L.validateSpec({}).ok, false); });
test('cleanText strips HTML, script URLs and handlers', () => {
  for (const bad of ['<script>alert(1)</script>Hi', '<img src=x onerror=alert(1)>', 'javascript:alert(1)', 'data:text/html,<b>', 'x onload=evil()']) {
    const c = L.cleanText(bad); assert.ok(!/[<>]/.test(c), c); assert.ok(!/javascript:|data:text|on\w+\s*=/i.test(c), c);
  }
  assert.equal(L.cleanText('a'.repeat(500), 50).length, 50);
});
test('spec text is sanitized end to end (model output with HTML)', () => { const g = good(); g.headline = '<b onclick=x()>Hi</b>'; g.sections[0].items[0].name = '<script>steal()</script>Loaf'; const s = JSON.stringify(L.validateSpec(g).spec); assert.ok(!/<|onclick|script>/.test(s)); });
test('fallback spec is valid for every business type and varies by type', () => {
  const seen = new Set(); for (const t of ['bakery', 'restaurant', 'salon', 'retail', 'auto', 'pro', 'other', 'nonsense']) { const f = L.fallbackSpec(inp({ type: t })); assert.ok(L.validateSpec(f).ok); seen.add(f.palette.accent); }
  assert.ok(seen.size >= 6);
});
test('costUSD uses neurons and token fallback', () => { assert.ok(Math.abs(L.costUSD({ neurons: 1000 }) - 0.011) < 1e-9 || L.costUSD({ neurons: 1000 }) > 0); assert.ok(L.costUSD({ prompt_tokens: 1000, completion_tokens: 500 }) > 0); assert.equal(L.costUSD(null), 0.003, 'unknown usage is charged a conservative estimate'); });
test('rate limit: burst per IP, separate per IP', async () => {
  const db = memD1(), now = Date.UTC(2026, 9, 29, 12); let r;
  for (let i = 0; i < L.LIMITS.burst; i++) { r = await L.checkLimits(db, '9.9.9.9', 3, now); assert.ok(r.ok, 'call ' + i); }
  r = await L.checkLimits(db, '9.9.9.9', 3, now); assert.deepEqual([r.ok, r.reason], [false, 'rate']);
  assert.ok((await L.checkLimits(db, '8.8.8.8', 3, now)).ok);
  assert.ok((await L.checkLimits(db, '9.9.9.9', 3, now + 11 * 60000)).ok, 'burst window resets');
});
test('rate limit: per-day cap per IP', async () => {
  const db = memD1(), t0 = Date.UTC(2026, 9, 29, 0); let ok = 0;
  for (let i = 0; i < 60; i++) if ((await L.checkLimits(db, '7.7.7.7', 3, t0 + i * 11 * 60000)).ok) ok++;
  assert.equal(ok, L.LIMITS.perDay);
});
test('daily $ cap blocks everyone once spent', async () => { const db = memD1(), now = Date.UTC(2026, 9, 29, 12); await L.addCost(db, '2026-10-29', 3.01); const r = await L.checkLimits(db, '1.1.1.1', 3, now); assert.deepEqual([r.ok, r.reason], [false, 'budget']); });
test('ip is hashed, never stored raw', async () => { const db = memD1(); await L.checkLimits(db, '203.0.113.7', 3); assert.ok(![...db.rl.keys()].some(k => k.includes('203.0.113.7'))); });

test('api: AI path returns validated spec + cost, logs cost', async () => {
  const db = memD1(), r = await onRequestPost({ request: req({ action: 'generate', input: inp() }), env: { AI: aiOK(), BUILD_LEADS: db } }); const j = await r.json();
  assert.equal(j.source, 'ai'); assert.equal(j.spec.hero, 'split'); assert.ok(j.cost > 0); assert.equal([...db.cost.values()][0].calls, 1);
});
test('api: falls back to preset when AI throws, returns junk, is off, or budget spent', async () => {
  const cases = [{ AI: { run: async () => { throw new Error('boom'); } } }, { AI: { run: async () => ({ response: 'not json' }) } }, { AI: { run: async () => ({ response: { hello: 1 } }) } }, { AI: null }];
  for (const env of cases) { const j = await (await onRequestPost({ request: req({ input: inp() }), env: { BUILD_LEADS: memD1(), ...env } })).json(); assert.equal(j.source, 'fallback'); assert.ok(L.validateSpec(j.spec).ok); }
  const db = memD1(); await L.addCost(db, new Date().toISOString().slice(0, 10), 99);
  const j = await (await onRequestPost({ request: req({ input: inp() }), env: { AI: aiOK(), BUILD_LEADS: db } })).json(); assert.equal(j.source, 'fallback'); assert.equal(j.reason, 'budget');
});
test('api: 429 + fallback spec when rate limited', async () => {
  const db = memD1(), env = { AI: aiOK(), BUILD_LEADS: db }; let r;
  for (let i = 0; i <= L.LIMITS.burst; i++) r = await onRequestPost({ request: req({ input: inp() }, '5.5.5.5'), env });
  assert.equal(r.status, 429); const j = await r.json(); assert.equal(j.source, 'fallback'); assert.ok(j.spec);
});
test('api: edit needs a request and current spec; bad body is 400', async () => {
  const env = { AI: aiOK(), BUILD_LEADS: memD1() };
  assert.equal((await onRequestPost({ request: req({ action: 'edit', input: inp() }), env })).status, 400);
  assert.equal((await onRequestPost({ request: req({ input: { name: '' } }), env })).status, 400);
  assert.equal((await onRequestPost({ request: new Request('https://x', { method: 'POST', body: '{' }), env })).status, 400);
  const j = await (await onRequestPost({ request: req({ action: 'edit', input: inp(), spec: good(), request: 'make it darker' }), env })).json(); assert.equal(j.source, 'ai');
});

test('stripPII removes email, phone, URLs, street addresses and the business name', () => {
  const t = L.stripPII('Bluff City Bakery at 123 Main St. Call (901) 555-0123, 901.555.9999 or +1 901 555 7777, email ann.lee@example.com, site https://bluff.example', 'Bluff City Bakery');
  for (const bad of ['Bluff City Bakery', '123 Main St', '555-0123', '555.9999', '555 7777', 'ann.lee@example.com', 'https://bluff.example']) assert.ok(!t.includes(bad), bad + ' in ' + t);
  assert.ok(t.includes('{{BUSINESS}}'));
});
test('anonInput drops name/phone/address and keeps the useful bits', () => {
  const a = L.anonInput(inp({ phone: '901-555-0100', address: '55 Broad Ave', hours: 'Tue-Sat' }), false), s = JSON.stringify(a);
  assert.ok(!/Bluff City|901-555|55 Broad|example\.com/.test(s), s); assert.equal(a.type, 'bakery');
  const b = L.anonInput(inp(), true); assert.ok(JSON.stringify(b).includes('Bluff City Bakery'), 'name kept only with consent'); assert.ok(!JSON.stringify(b).includes('example.com'));
});
test('consent gating: no consent -> no training row, nothing written', async () => {
  assert.equal(L.trainRow({ consent: false, session: 'wabc12345', event: 'generate', inp: inp(), spec: good() }), null);
  assert.equal(L.trainRow({ consent: 'yes', session: 'wabc12345', event: 'generate', inp: inp(), spec: good() }), null);
  assert.equal(L.trainRow({ consent: true, session: 'x', event: 'generate', inp: inp(), spec: good() }), null, 'bad session id');
  const db = memD1(); await onRequestPost({ request: req({ input: inp(), session: 'wabc12345' }), env: { AI: aiOK(), BUILD_LEADS: db } }); assert.equal(db.train.length, 0);
});
test('consent: logs generate, edit (with diff), regenerate and final outcome, all PII-free, source=web', async () => {
  const db = memD1(), env = { AI: aiOK(), BUILD_LEADS: db }, base = { input: inp(), session: 'wsess0001', consent: true };
  await onRequestPost({ request: req({ ...base, action: 'generate' }), env });
  const dark = good(); dark.palette.bg = '#111111'; dark.palette.ink = '#f5f5f5'; dark.headline = 'Bluff City Bakery after dark';
  await onRequestPost({ request: req({ ...base, action: 'edit', spec: good(), request: 'make it darker, call me at 901-555-2222' }), env: { AI: aiOK(dark), BUILD_LEADS: db } });
  await onRequestPost({ request: req({ ...base, action: 'regenerate' }), env });
  await onRequestPost({ request: req({ ...base, action: 'outcome', outcome: 'lead', spec: dark }), env });
  assert.deepEqual(db.train.map(r => r.event), ['generate', 'edit', 'regenerate', 'final']);
  const all = JSON.stringify(db.train); assert.ok(!/Bluff City|555-0123|555-2222|example\.com/.test(all), all);
  assert.ok(db.train.every(r => r.source === 'web')); assert.ok(JSON.parse(db.train[1].diff).some(x => x.path === 'palette.bg' && x.to === '#111111')); assert.equal(db.train[3].outcome, 'lead');
});
test('JSONL export: triples in the EWS training envelope, outcome label attached', async () => {
  const db = memD1(), env = { AI: aiOK(), BUILD_LEADS: db }, base = { input: inp(), session: 'wsess0002', consent: true };
  await onRequestPost({ request: req({ ...base, action: 'generate' }), env });
  await onRequestPost({ request: req({ ...base, action: 'edit', spec: good(), request: 'bigger headline' }), env });
  await onRequestPost({ request: req({ ...base, action: 'outcome', outcome: 'lead', spec: good() }), env });
  const t = toTriples(db.train); assert.equal(t.length, 2);
  for (const k of ['ts', 'channel', 'brand', 'contact_hash', 'turns', 'outcome', 'thread', 'source', 'license', 'prompt', 'spec', 'feedback']) assert.ok(k in t[0], k);
  assert.equal(t[0].source, 'web'); assert.equal(t[1].outcome, 'lead'); assert.equal(t[1].prompt.change_request, 'bigger headline');
  assert.doesNotThrow(() => t.map(x => JSON.parse(JSON.stringify(x))));
});

const ctx = { window: {}, document: { getElementById: () => null } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../site/build/builder.js', import.meta.url), 'utf8'), ctx);
const B = ctx.window.EWSBuilder;
test('renderSpec renders every hero/kind/variant and escapes text', () => {
  for (const hero of L.HERO) for (const v of L.VARIANTS) {
    const g = good(); g.hero = hero; g.sections = L.KINDS.map(k => ({ kind: k, variant: v, title: k, intro: 'i', items: [{ name: 'a', text: 'b', price: '$1' }] }));
    const s = L.validateSpec(g).spec; s.headline = '<script>x()</script>';
    for (const p of ['Home', 'Menu', 'About', 'Contact', 'Gallery']) { const d = B.blank(); d.name = '<img onerror=1>'; d.pages = ['Home', 'Menu', 'About', 'Contact', 'Gallery'];
      const h = B.renderSpec(s, d, p, { logo: 'javascript:alert(1)', photo: 'data:image/png;base64,AAAA' }); assert.ok(!h.includes('<script>x') && !h.includes('<img onerror') && !h.includes('javascript:'), p); }
  }
});
test('different specs render visibly different sites', () => {
  const a = L.validateSpec(good()).spec, b = L.fallbackSpec(inp({ type: 'salon', name: 'Fade Lab' })), d = B.blank();
  assert.notEqual(B.renderSpec(a, d, 'Home'), B.renderSpec(b, d, 'Home'));
});
test('design direction differs per business and per regenerate seed; edit keeps the model layout', () => {
  const biz = [inp({ name: 'Summer Ave Fades', type: 'salon', story: 'Old-school barbershop since 1998', vibe: 'Old-school' }), inp({ name: 'Broad Ave Bread Co', type: 'bakery', story: 'sourdough bakery', vibe: 'Cozy' }), inp({ name: 'Midsouth Lids', type: 'retail', story: 'fitted caps and embroidery for crews', vibe: 'Bold' })];
  const ds = biz.map(L.direction), key = d => d.mood + d.hero + d.order.join();
  assert.equal(new Set(ds.map(key)).size, 3);
  const seeds = new Set([1, 2, 3, 4, 5, 6].map(seed => key(L.direction({ ...biz[0], seed })))); assert.ok(seeds.size >= 4);
  const sp = L.applyDirection(L.validateSpec(good()).spec, ds[1]); assert.equal(sp.hero, ds[1].hero); assert.equal(sp.fonts.head, ds[1].fonts[0]);
  assert.ok(L.prompt(biz[0])[1].content.includes(ds[0].mood)); assert.ok(!L.prompt(biz[0], good(), 'darker')[1].content.includes('Design direction'));
});
test('every selected page renders content even if the AI skipped that section kind', () => {
  const s = L.validateSpec(good()).spec, d = B.blank(); d.pages = ['Home', 'Menu', 'About', 'Contact', 'Gallery'];
  for (const p of d.pages) assert.match(B.renderSpec(s, d, p), /<section class="s /, p);
  assert.ok(B.renderSpec(s, d, 'Gallery').includes('class="gal"'));
});
