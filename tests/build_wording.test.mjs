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
test('hero says see before you pay, shows from $349 and the no-online-charge line', () => {
  const h = read('../site/build/index.html');
  assert.ok(h.includes('<h1>See your website before you pay</h1>')); assert.ok(h.includes('From $349'));
  assert.ok(h.includes('$349 + $19/mo') && /nothing is charged online/i.test(h) && /preview costs nothing/i.test(h));
});
