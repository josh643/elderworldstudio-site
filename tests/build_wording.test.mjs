// node --test tests/ — regression: /build/ must never imply the website itself is free.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
test('no "website free" / free-website wording on the builder', () => {
  for (const f of ['../site/build/index.html', '../site/build/builder.js', '../tools/build.py', '../site/privacy/index.html']) {
    const s = read(f);
    assert.ok(!/website[s]?\s+(for\s+)?free|free\s+website|design[^<"]{0,40}\bfree\b|\bfree\b[^<"]{0,20}builder/i.test(s), f);
  }
  const h = read('../site/build/index.html');
  for (const m of h.match(/<(title|meta)[^>]*>[^<]*/gi) || []) assert.ok(!/\bfree\b/i.test(m), m);
});
test('pricing page keeps the approved numbers, launch code, and designer (no reservation form)', () => {
  const h = read('../site/build/index.html');
  assert.ok(h.includes('<h1>AI Web Builder</h1>'));
  assert.ok(h.includes('$349') && h.includes('$19/mo') && h.includes('$699') && h.includes('$1,299') && h.includes('$99'));
  assert.ok(!h.includes('id="build-form"') && h.includes('MEMPHIS249'));
  assert.ok(h.includes('id="builder"') && h.includes('sandbox=""'));
});
